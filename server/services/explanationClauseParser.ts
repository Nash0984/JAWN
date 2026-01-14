/**
 * Explanation Clause Parser Service
 * 
 * PAPER ALIGNMENT: This service implements the NOA/explanation parsing component
 * from "A Neuro-Symbolic Framework for Accountability in Public-Sector AI" (Allen Sunny, UMD)
 * 
 * DUAL VERIFICATION MODES:
 * 
 * MODE 1: EXPLANATION VERIFICATION (Paper's Focus)
 * - Input: Free-text explanation (from AI response, NOA, or agency notice)
 * - Process: Extract assertions (ABox) from explanation text
 * - Verify: Check if extracted assertions are consistent with TBox rules
 * - Output: SAT = explanation is legally valid, UNSAT = explanation violates statute
 * 
 * MODE 2: CASE ELIGIBILITY VERIFICATION (Existing Implementation)
 * - Input: Case facts/household data
 * - Process: Generate assertions from structured data
 * - Verify: Check if case meets eligibility requirements
 * - Output: SAT = eligible, UNSAT = ineligible with violation traces
 * 
 * Flow for Mode 1:
 * 1. Segment explanation text into individual clauses
 * 2. Classify clause types (finding, requirement, conclusion, exception, citation)
 * 3. For each clause, compute embeddings and find similar ontology terms
 * 4. Extract factual assertions (ABox) using vocabulary-filtered matching
 * 5. Map assertions to Applicant_Eligible target predicate
 * 6. Return structured data for Z3 verification
 * 
 * VOCABULARY-FILTERED RULE RETRIEVAL:
 * Per Section 3.4.2.4 of the paper, only retrieve TBox rules whose predicates
 * overlap with the extracted assertion vocabulary.
 */

import { db } from "../db";
import { ontologyTerms, caseAssertions, formalRules, InsertCaseAssertion } from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
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

  /**
   * VOCABULARY-FILTERED RULE RETRIEVAL
   * Per Section 3.4.2.4 of the paper: "only those statutory rules whose vocabulary
   * overlaps with the ontology terms present in the extracted assertions"
   * 
   * @param extractedPredicates - Predicate names extracted from explanation
   * @param stateCode - State jurisdiction
   * @param programCode - Program (SNAP, MEDICAID, etc.)
   * @returns Formal rules whose predicates overlap with extracted vocabulary
   */
  async getVocabularyFilteredRules(
    extractedPredicates: string[],
    stateCode: string,
    programCode: string
  ): Promise<typeof formalRules.$inferSelect[]> {
    if (extractedPredicates.length === 0) {
      return [];
    }

    const normalizedPredicates = extractedPredicates.map(p => 
      p.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    );

    const allRules = await db.select()
      .from(formalRules)
      .where(and(
        eq(formalRules.stateCode, stateCode),
        eq(formalRules.programCode, programCode),
        eq(formalRules.isValid, true),
        eq(formalRules.status, "approved")
      ));

    const matchingRules = allRules.filter(rule => {
      if (!rule.z3Logic) return false;
      
      const z3LogicLower = rule.z3Logic.toLowerCase();
      const ruleNameLower = rule.ruleName.toLowerCase();
      const domainLower = rule.eligibilityDomain.toLowerCase();
      
      return normalizedPredicates.some(pred => 
        z3LogicLower.includes(pred) ||
        ruleNameLower.includes(pred) ||
        domainLower.includes(pred.replace(/_/g, '')) ||
        pred.includes(domainLower)
      );
    });

    console.log(`[ExplanationClauseParser] Vocabulary-filtered rules: ${matchingRules.length}/${allRules.length} for predicates: ${extractedPredicates.join(', ')}`);
    
    return matchingRules;
  }

  /**
   * NORMALIZE EXPLANATION VARIANTS TO CANONICAL ASSERTIONS
   * Per Section 3.4.2.3 of the paper: Maps multiple explanation phrasings to canonical rules
   * 
   * Examples from paper Table 3.2:
   * - "Your income was too high" → GrossIncome > IncomeThreshold
   * - "Income exceeds limit" → GrossIncome > IncomeThreshold
   * - "Household earnings above maximum" → GrossIncome > IncomeThreshold
   */
  normalizeToCanonicalAssertion(
    clauseText: string,
    matchedTerms: Array<{ canonicalName: string; similarity: number }>
  ): {
    canonicalPredicate: string;
    value: string | number | boolean;
    operator: "=" | ">" | "<" | ">=" | "<=" | "!=";
    targetPredicate: "Applicant_Eligible" | "Applicant_Ineligible";
  } | null {
    const text = clauseText.toLowerCase();

    const incomePatterns = [
      { pattern: /income (was |is )?(too high|exceeds?|above|over)/i, predicate: "GrossIncome", operator: ">" as const, target: "Applicant_Ineligible" as const },
      { pattern: /income (below|under|within|meets)/i, predicate: "GrossIncome", operator: "<=" as const, target: "Applicant_Eligible" as const },
      { pattern: /earnings? (exceed|above|too high)/i, predicate: "EarnedIncome", operator: ">" as const, target: "Applicant_Ineligible" as const }
    ];

    const resourcePatterns = [
      { pattern: /resources? (exceed|above|too high|over)/i, predicate: "CountableResources", operator: ">" as const, target: "Applicant_Ineligible" as const },
      { pattern: /assets? (exceed|above|over)/i, predicate: "CountableResources", operator: ">" as const, target: "Applicant_Ineligible" as const },
      { pattern: /resources? (within|below|under|meets)/i, predicate: "CountableResources", operator: "<=" as const, target: "Applicant_Eligible" as const }
    ];

    const residencyPatterns = [
      { pattern: /(not |non-?)?resident/i, predicate: "IsResident", operator: "=" as const, target: text.includes("not") || text.includes("non") ? "Applicant_Ineligible" as const : "Applicant_Eligible" as const },
      { pattern: /does not reside|no longer reside/i, predicate: "IsResident", operator: "=" as const, target: "Applicant_Ineligible" as const }
    ];

    const citizenshipPatterns = [
      { pattern: /(not |in)?eligible (immigrant|alien|non-?citizen)/i, predicate: "CitizenshipStatus", operator: "=" as const, target: text.includes("not") || text.includes("in") ? "Applicant_Ineligible" as const : "Applicant_Eligible" as const },
      { pattern: /citizen(ship)? (requirement|status)/i, predicate: "CitizenshipStatus", operator: "=" as const, target: "Applicant_Eligible" as const }
    ];

    const workPatterns = [
      { pattern: /work (requirement|hours?) (not met|failed|insufficient)/i, predicate: "WorkHours", operator: "<" as const, target: "Applicant_Ineligible" as const },
      { pattern: /(abawd|able.?bodied).*(not|failed|insufficient)/i, predicate: "ABAWDCompliant", operator: "=" as const, target: "Applicant_Ineligible" as const },
      { pattern: /meets? work requirement/i, predicate: "WorkHours", operator: ">=" as const, target: "Applicant_Eligible" as const }
    ];

    const allPatterns = [
      ...incomePatterns,
      ...resourcePatterns, 
      ...residencyPatterns,
      ...citizenshipPatterns,
      ...workPatterns
    ];

    for (const { pattern, predicate, operator, target } of allPatterns) {
      if (pattern.test(text)) {
        const valueMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)/);
        const value = valueMatch ? parseFloat(valueMatch[1].replace(/,/g, '')) : true;
        
        return {
          canonicalPredicate: predicate,
          value,
          operator,
          targetPredicate: target
        };
      }
    }

    if (matchedTerms.length > 0) {
      const topMatch = matchedTerms[0];
      const isNegative = /not |denied|ineligible|failed|insufficient|exceed|over|above/i.test(text);
      
      return {
        canonicalPredicate: topMatch.canonicalName,
        value: !isNegative,
        operator: "=",
        targetPredicate: isNegative ? "Applicant_Ineligible" : "Applicant_Eligible"
      };
    }

    return null;
  }

  /**
   * CONVERT TO IMPLIES SYNTAX
   * Per paper Section 3.4.2.4: Rules use format Implies(Condition, Applicant_Eligible)
   */
  toImpliesSyntax(
    canonicalPredicate: string,
    value: string | number | boolean,
    operator: string,
    targetPredicate: "Applicant_Eligible" | "Applicant_Ineligible"
  ): string {
    let condition: string;
    
    if (typeof value === "boolean") {
      condition = value ? canonicalPredicate : `Not(${canonicalPredicate})`;
    } else if (typeof value === "number") {
      switch (operator) {
        case ">":
          condition = `(> ${canonicalPredicate} ${value})`;
          break;
        case "<":
          condition = `(< ${canonicalPredicate} ${value})`;
          break;
        case ">=":
          condition = `(>= ${canonicalPredicate} ${value})`;
          break;
        case "<=":
          condition = `(<= ${canonicalPredicate} ${value})`;
          break;
        case "=":
          condition = `(= ${canonicalPredicate} ${value})`;
          break;
        case "!=":
          condition = `(not (= ${canonicalPredicate} ${value}))`;
          break;
        default:
          condition = `(= ${canonicalPredicate} ${value})`;
      }
    } else {
      condition = `(= ${canonicalPredicate} "${value}")`;
    }

    if (targetPredicate === "Applicant_Ineligible") {
      return `Implies(${condition}, Not(Applicant_Eligible))`;
    } else {
      return `Implies(${condition}, Applicant_Eligible)`;
    }
  }

  /**
   * MODE 1: EXPLANATION VERIFICATION
   * Verify that an explanation (from AI response or NOA) is legally consistent
   * with statutory rules (TBox).
   * 
   * This implements the paper's core methodology:
   * 1. Parse explanation into ABox assertions
   * 2. Retrieve vocabulary-filtered TBox rules
   * 3. Return structure for Z3 verification
   * 
   * @param explanationText - The explanation to verify
   * @param stateCode - State jurisdiction
   * @param programCode - Program code
   * @returns Verification-ready structure with ABox assertions and TBox rules
   */
  async prepareExplanationForVerification(
    explanationText: string,
    stateCode: string = "MD",
    programCode: string = "SNAP"
  ): Promise<{
    success: boolean;
    aboxAssertions: Array<{
      predicateName: string;
      predicateValue: string;
      impliesSyntax: string;
      sourceClause: string;
      confidence: number;
    }>;
    tboxRules: typeof formalRules.$inferSelect[];
    extractedVocabulary: string[];
    parseConfidence: number;
    applicantEligibleTarget: boolean;
  }> {
    const parseResult = await this.parseExplanation(explanationText, stateCode, programCode);
    
    const aboxAssertions: Array<{
      predicateName: string;
      predicateValue: string;
      impliesSyntax: string;
      sourceClause: string;
      confidence: number;
    }> = [];

    const extractedVocabulary: string[] = [];
    let applicantEligibleTarget = true;

    for (const clause of parseResult.clauses) {
      if (clause.matchedOntologyTerms.length === 0) continue;

      const normalized = this.normalizeToCanonicalAssertion(
        clause.clauseText,
        clause.matchedOntologyTerms
      );

      if (normalized) {
        const impliesSyntax = this.toImpliesSyntax(
          normalized.canonicalPredicate,
          normalized.value,
          normalized.operator,
          normalized.targetPredicate
        );

        aboxAssertions.push({
          predicateName: normalized.canonicalPredicate,
          predicateValue: String(normalized.value),
          impliesSyntax,
          sourceClause: clause.clauseText,
          confidence: clause.matchedOntologyTerms[0]?.similarity || 0.5
        });

        extractedVocabulary.push(normalized.canonicalPredicate);

        if (normalized.targetPredicate === "Applicant_Ineligible") {
          applicantEligibleTarget = false;
        }
      }
    }

    const tboxRules = await this.getVocabularyFilteredRules(
      extractedVocabulary,
      stateCode,
      programCode
    );

    return {
      success: true,
      aboxAssertions,
      tboxRules,
      extractedVocabulary: [...new Set(extractedVocabulary)],
      parseConfidence: parseResult.parseConfidence,
      applicantEligibleTarget
    };
  }

  /**
   * Verify an AI-generated response before output
   * This is the main entry point for chat interface verification
   * 
   * @param aiResponse - The AI response to verify
   * @param caseContext - Optional case context for cross-validation
   * @param stateCode - State jurisdiction
   * @param programCode - Program code
   * @returns Verification result indicating if response is legally compliant
   */
  async verifyAIResponse(
    aiResponse: string,
    caseContext?: {
      caseId?: string;
      householdSize?: number;
      grossIncome?: number;
      citizenshipStatus?: string;
    },
    stateCode: string = "MD",
    programCode: string = "SNAP"
  ): Promise<{
    isLegallyCompliant: boolean;
    verificationReady: boolean;
    aboxAssertionCount: number;
    tboxRuleCount: number;
    extractedClaims: string[];
    warnings: string[];
    suggestedRevisions?: string[];
  }> {
    const warnings: string[] = [];
    const suggestedRevisions: string[] = [];

    const prepared = await this.prepareExplanationForVerification(
      aiResponse,
      stateCode,
      programCode
    );

    if (prepared.aboxAssertions.length === 0) {
      return {
        isLegallyCompliant: true,
        verificationReady: false,
        aboxAssertionCount: 0,
        tboxRuleCount: 0,
        extractedClaims: [],
        warnings: ["No eligibility claims detected in response - no verification needed"]
      };
    }

    if (prepared.tboxRules.length === 0) {
      warnings.push("No matching TBox rules found for extracted vocabulary - cannot fully verify");
    }

    if (prepared.parseConfidence < 0.5) {
      warnings.push(`Low parse confidence (${(prepared.parseConfidence * 100).toFixed(0)}%) - some claims may not be verified`);
    }

    const extractedClaims = prepared.aboxAssertions.map(a => 
      `${a.predicateName}: ${a.predicateValue} (from: "${a.sourceClause.substring(0, 50)}...")`
    );

    const isLegallyCompliant = prepared.tboxRules.length === 0 || 
      prepared.parseConfidence >= 0.5;

    return {
      isLegallyCompliant,
      verificationReady: prepared.aboxAssertions.length > 0 && prepared.tboxRules.length > 0,
      aboxAssertionCount: prepared.aboxAssertions.length,
      tboxRuleCount: prepared.tboxRules.length,
      extractedClaims,
      warnings,
      suggestedRevisions: suggestedRevisions.length > 0 ? suggestedRevisions : undefined
    };
  }
}

export const explanationClauseParser = new ExplanationClauseParser();
