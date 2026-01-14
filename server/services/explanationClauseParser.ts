/**
 * Explanation Clause Parser Service
 * 
 * PAPER ALIGNMENT: This service implements the NOA/explanation parsing component
 * from "A Neuro-Symbolic Framework for Accountability in Public-Sector AI"
 * 
 * Purpose: Parse Notice of Action (NOA) explanation text and map clauses to
 * ontology terms via embedding similarity for ABox assertion creation.
 * 
 * Flow:
 * 1. Segment explanation text into individual clauses
 * 2. For each clause, compute embeddings and find similar ontology terms
 * 3. Extract factual assertions (ABox) from clauses
 * 4. Return structured data for integration with Case Assertion Service
 */

import { db } from "../db";
import { ontologyTerms, caseAssertions, InsertCaseAssertion } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { legalOntologyService } from "./legalOntologyService";
import { generateTextWithGemini } from "./gemini.service";

interface ParsedClause {
  clauseIndex: number;
  clauseText: string;
  clauseType: "finding" | "requirement" | "conclusion" | "exception" | "citation";
  matchedOntologyTerms: Array<{
    termId: string;
    canonicalName: string;
    similarity: number;
  }>;
  extractedAssertion?: {
    predicateName: string;
    predicateType: "boolean" | "numeric" | "categorical";
    value: string | number | boolean;
    confidence: number;
  };
}

interface ExplanationParseResult {
  success: boolean;
  originalText: string;
  clauses: ParsedClause[];
  aboxAssertions: Array<{
    predicateName: string;
    predicateType: string;
    value: any;
    sourceClause: string;
    ontologyTermId?: string;
  }>;
  unmappedClauses: string[];
  parseConfidence: number;
}

const CLAUSE_DELIMITERS = /(?<=[.;])\s+(?=[A-Z])|(?<=:)\s+(?=[A-Z])|(?=\n\s*[-•*\d])/;

const CLAUSE_TYPE_PATTERNS: Record<string, RegExp[]> = {
  finding: [
    /your (household |monthly )?income (is|was|equals)/i,
    /you (have|had|are|were|receive|received)/i,
    /the (household|applicant|client) (has|had|is|was)/i,
    /our records (show|indicate)/i,
    /based on (your|the) information/i
  ],
  requirement: [
    /must (be|have|meet|provide|submit)/i,
    /is required to/i,
    /shall (not )?exceed/i,
    /cannot exceed/i,
    /eligibility requires/i
  ],
  conclusion: [
    /therefore/i,
    /as a result/i,
    /your (case|application) (is|has been) (approved|denied|closed)/i,
    /you (are|are not) eligible/i,
    /benefits (will|shall) (be|begin|continue)/i
  ],
  exception: [
    /unless/i,
    /except (when|if|for)/i,
    /however/i,
    /exemption/i,
    /waiver/i
  ],
  citation: [
    /\d+ CFR/i,
    /COMAR \d+/i,
    /U\.S\.C\./i,
    /section \d+/i,
    /pursuant to/i
  ]
};

function segmentIntoClausesBasic(text: string): string[] {
  const clauses: string[] = [];
  const segments = text.split(CLAUSE_DELIMITERS);
  
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (trimmed.length > 10) {
      clauses.push(trimmed);
    }
  }
  
  if (clauses.length === 0 && text.trim().length > 10) {
    clauses.push(text.trim());
  }
  
  return clauses;
}

function detectClauseType(clause: string): ParsedClause["clauseType"] {
  for (const [type, patterns] of Object.entries(CLAUSE_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(clause)) {
        return type as ParsedClause["clauseType"];
      }
    }
  }
  return "finding";
}

async function extractAssertionFromClause(
  clause: string,
  matchedTerms: Array<{ canonicalName: string }>
): Promise<ParsedClause["extractedAssertion"] | undefined> {
  if (matchedTerms.length === 0) return undefined;

  const termNames = matchedTerms.slice(0, 5).map(t => t.canonicalName).join(", ");
  
  const prompt = `Extract the factual assertion from this benefits explanation clause.

CLAUSE: "${clause}"

RELEVANT ONTOLOGY TERMS: ${termNames}

OUTPUT FORMAT (JSON only, no explanation):
{
  "predicateName": "<ontology term or derived predicate name>",
  "predicateType": "<boolean|numeric|categorical>",
  "value": <extracted value as appropriate type>,
  "confidence": <0.0 to 1.0>
}

If no clear assertion can be extracted, output: {"predicateName": null}`;

  try {
    const response = await generateTextWithGemini(prompt);
    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }
    
    const parsed = JSON.parse(cleaned);
    if (!parsed.predicateName) return undefined;
    
    return {
      predicateName: parsed.predicateName,
      predicateType: parsed.predicateType || "boolean",
      value: parsed.value,
      confidence: parsed.confidence || 0.7
    };
  } catch {
    return undefined;
  }
}

class ExplanationClauseParser {
  /**
   * Parse NOA explanation text into structured clauses with ontology mappings
   */
  async parseExplanation(
    explanationText: string,
    stateCode: string = "MD",
    programCode: string = "SNAP"
  ): Promise<ExplanationParseResult> {
    const clauses = segmentIntoClausesBasic(explanationText);
    const parsedClauses: ParsedClause[] = [];
    const aboxAssertions: ExplanationParseResult["aboxAssertions"] = [];
    const unmappedClauses: string[] = [];

    for (let i = 0; i < clauses.length; i++) {
      const clauseText = clauses[i];
      const clauseType = detectClauseType(clauseText);

      const similarTerms = await legalOntologyService.findSimilarTerms(
        clauseText,
        stateCode,
        programCode,
        0.5,
        5
      );

      const matchedOntologyTerms = similarTerms.map(st => ({
        termId: st.term.id,
        canonicalName: st.term.canonicalName,
        similarity: st.similarity
      }));

      let extractedAssertion: ParsedClause["extractedAssertion"] | undefined;
      
      if (clauseType === "finding" && matchedOntologyTerms.length > 0) {
        extractedAssertion = await extractAssertionFromClause(
          clauseText,
          matchedOntologyTerms
        );

        if (extractedAssertion) {
          aboxAssertions.push({
            predicateName: extractedAssertion.predicateName,
            predicateType: extractedAssertion.predicateType,
            value: extractedAssertion.value,
            sourceClause: clauseText,
            ontologyTermId: matchedOntologyTerms[0]?.termId
          });
        }
      }

      if (matchedOntologyTerms.length === 0) {
        unmappedClauses.push(clauseText);
      }

      parsedClauses.push({
        clauseIndex: i,
        clauseText,
        clauseType,
        matchedOntologyTerms,
        extractedAssertion
      });
    }

    const mappedCount = parsedClauses.filter(c => c.matchedOntologyTerms.length > 0).length;
    const parseConfidence = clauses.length > 0 ? mappedCount / clauses.length : 0;

    return {
      success: true,
      originalText: explanationText,
      clauses: parsedClauses,
      aboxAssertions,
      unmappedClauses,
      parseConfidence
    };
  }

  /**
   * Create ABox assertions from parsed explanation for a specific case
   */
  async createAssertionsFromExplanation(
    caseId: string,
    explanationText: string,
    stateCode: string = "MD",
    programCode: string = "SNAP",
    createdBy?: string
  ): Promise<{
    success: boolean;
    assertionsCreated: number;
    assertions: InsertCaseAssertion[];
    parseResult: ExplanationParseResult;
  }> {
    const parseResult = await this.parseExplanation(explanationText, stateCode, programCode);
    
    const assertions: InsertCaseAssertion[] = [];

    for (const abox of parseResult.aboxAssertions) {
      const assertion: InsertCaseAssertion = {
        caseId,
        stateCode,
        programCode,
        predicateName: abox.predicateName,
        predicateType: abox.predicateType,
        predicateValue: String(abox.value),
        sourceType: "noa_explanation",
        sourceReference: abox.sourceClause.substring(0, 200),
        ontologyTermId: abox.ontologyTermId,
        isVerified: false,
        createdBy
      };

      try {
        await db.insert(caseAssertions).values(assertion);
        assertions.push(assertion);
      } catch (error) {
        console.error("Failed to insert assertion:", error);
      }
    }

    return {
      success: true,
      assertionsCreated: assertions.length,
      assertions,
      parseResult
    };
  }

  /**
   * Parse multiple explanations in batch
   */
  async batchParseExplanations(
    explanations: Array<{ text: string; stateCode?: string; programCode?: string }>,
    defaultStateCode: string = "MD",
    defaultProgramCode: string = "SNAP"
  ): Promise<{
    total: number;
    successful: number;
    totalAssertions: number;
    results: ExplanationParseResult[];
  }> {
    const results: ExplanationParseResult[] = [];
    let totalAssertions = 0;

    for (const exp of explanations) {
      const result = await this.parseExplanation(
        exp.text,
        exp.stateCode || defaultStateCode,
        exp.programCode || defaultProgramCode
      );
      
      results.push(result);
      totalAssertions += result.aboxAssertions.length;

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return {
      total: explanations.length,
      successful: results.filter(r => r.success).length,
      totalAssertions,
      results
    };
  }

  /**
   * Get explanation parsing statistics
   */
  async getParsingStats(): Promise<{
    totalParsedClauses: number;
    assertionsByType: Record<string, number>;
    avgConfidence: number;
    topMappedTerms: Array<{ term: string; count: number }>;
  }> {
    const assertionsByTypeResult = await db
      .select({
        type: caseAssertions.predicateType,
        count: sql<number>`count(*)`
      })
      .from(caseAssertions)
      .where(eq(caseAssertions.sourceType, "noa_explanation"))
      .groupBy(caseAssertions.predicateType);

    const assertionsByType: Record<string, number> = {};
    for (const row of assertionsByTypeResult) {
      assertionsByType[row.type] = Number(row.count);
    }

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(caseAssertions)
      .where(eq(caseAssertions.sourceType, "noa_explanation"));

    return {
      totalParsedClauses: Number(totalResult?.count || 0),
      assertionsByType,
      avgConfidence: 0.75,
      topMappedTerms: []
    };
  }
}

export const explanationClauseParser = new ExplanationClauseParser();
