import { db } from "../db";
import {
  lawProvisions, ontologyTerms, provisionOntologyMappings,
  LawProvision, InsertProvisionOntologyMapping
} from "@shared/schema";
import { eq, and, or, ilike, sql, desc, inArray } from "drizzle-orm";
import { generateTextWithGemini, generateEmbedding, cosineSimilarity } from "./gemini.service";
import { logger } from "./logger.service";

export type MappingType = "amends" | "supersedes" | "adds_exception" | "modifies_threshold" | "clarifies" | "removes" | "creates";
export type MatchMethod = "citation_match" | "semantic_similarity" | "ai_inference" | "hybrid";

export interface ProposedMapping {
  lawProvisionId: string;
  ontologyTermId: string;
  mappingType: MappingType;
  mappingReason: string;
  impactDescription: string;
  matchMethod: MatchMethod;
  citationMatchScore?: number;
  semanticSimilarityScore?: number;
  aiConfidenceScore: number;
  priorityLevel: "urgent" | "high" | "normal" | "low";
}

export interface MatchingResult {
  success: boolean;
  provisionId: string;
  mappingsProposed: number;
  mappingIds: string[];
  errors: string[];
  processingTimeMs: number;
}

const SEMANTIC_SIMILARITY_THRESHOLD = 0.75;
const AI_MODEL = "gemini-2.0-flash";

const US_CODE_TO_PROGRAM: Record<string, string> = {
  "7": "SNAP",
  "42": "Medicaid",
  "26": "Tax Credits"
};

function normalizeUSCodeCitation(citation: string): { title: string; section: string } | null {
  const patterns = [
    /(\d+)\s*U\.?S\.?C\.?\s*(\d+)/i,
    /(\d+)\s*USC\s*(\d+)/i,
    /Title\s*(\d+).*Section\s*(\d+)/i
  ];
  
  for (const pattern of patterns) {
    const match = citation.match(pattern);
    if (match) {
      return { title: match[1], section: match[2] };
    }
  }
  return null;
}

function determineMappingType(provisionType: string, provisionText: string): MappingType {
  const lowerText = provisionText.toLowerCase();
  
  if (provisionType === "repeal" || lowerText.includes("is repealed") || lowerText.includes("is struck")) {
    return "removes";
  }
  if (provisionType === "new_section" || lowerText.includes("is added") || lowerText.includes("insert the following")) {
    return "creates";
  }
  if (lowerText.includes("exception") || lowerText.includes("except that") || lowerText.includes("notwithstanding")) {
    return "adds_exception";
  }
  if (lowerText.includes("percent") || lowerText.includes("$") || lowerText.includes("threshold") || 
      lowerText.includes("limit") || /\d+%/.test(lowerText)) {
    return "modifies_threshold";
  }
  if (lowerText.includes("clarif") || lowerText.includes("means") || lowerText.includes("definition")) {
    return "clarifies";
  }
  if (lowerText.includes("supersede") || lowerText.includes("shall apply in lieu of")) {
    return "supersedes";
  }
  
  return "amends";
}

function determinePriority(provision: LawProvision, mappingType: MappingType): "urgent" | "high" | "normal" | "low" {
  if (mappingType === "supersedes" || mappingType === "removes") {
    return "urgent";
  }
  
  if (provision.effectiveDate) {
    const effective = new Date(provision.effectiveDate);
    const now = new Date();
    const daysUntilEffective = Math.floor((effective.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilEffective <= 30) return "urgent";
    if (daysUntilEffective <= 90) return "high";
  }
  
  if (mappingType === "modifies_threshold" || mappingType === "adds_exception") {
    return "high";
  }
  
  return "normal";
}

async function buildAIMatchingPrompt(provision: LawProvision, candidateTerms: any[]): Promise<string> {
  const termList = candidateTerms.map(t => 
    `- ${t.canonicalName} (${t.domain}): ${t.definition || t.termName}`
  ).join("\n");

  return `You are a legal analyst matching legislative provisions to a legal ontology for a benefits eligibility system.

PROVISION FROM PUBLIC LAW:
Section: ${provision.sectionNumber || "Unknown"}
Type: ${provision.provisionType}
U.S. Code Citation: ${provision.usCodeCitation || "Not specified"}
Text: ${provision.provisionText}
Summary: ${provision.provisionSummary || "Not available"}
Affected Programs: ${provision.affectedPrograms?.join(", ") || "Not specified"}

CANDIDATE ONTOLOGY TERMS:
${termList}

For each ontology term that this provision affects, provide:
1. The canonicalName of the affected term
2. How it affects the term: "amends", "supersedes", "adds_exception", "modifies_threshold", "clarifies", "removes", "creates"
3. Why this mapping is relevant (brief explanation)
4. Impact description (how the term's meaning or application changes)
5. Confidence score (0.0 to 1.0)

Respond in JSON format:
{
  "mappings": [
    {
      "canonicalName": "Income_GrossIncome",
      "mappingType": "modifies_threshold",
      "reason": "The provision changes the gross income limit from 130% to 200% FPL",
      "impact": "Expands eligibility by raising the income threshold, allowing households with higher incomes to qualify",
      "confidence": 0.92
    }
  ]
}

Only include mappings where there is a clear, direct relationship. If no terms are affected, return: {"mappings": []}`;
}

class OntologyMatcherService {
  async matchProvisionToOntology(provisionId: string): Promise<MatchingResult> {
    const startTime = Date.now();
    const result: MatchingResult = {
      success: false,
      provisionId,
      mappingsProposed: 0,
      mappingIds: [],
      errors: [],
      processingTimeMs: 0
    };

    try {
      const [provision] = await db.select().from(lawProvisions).where(eq(lawProvisions.id, provisionId));
      
      if (!provision) {
        result.errors.push(`Provision not found: ${provisionId}`);
        return result;
      }

      logger.info("Matching provision to ontology", {
        provisionId,
        usCodeCitation: provision.usCodeCitation,
        affectedPrograms: provision.affectedPrograms
      });

      const proposedMappings: ProposedMapping[] = [];

      if (provision.usCodeCitation) {
        const citationMatches = await this.matchByCitation(provision);
        proposedMappings.push(...citationMatches);
      }

      const semanticMatches = await this.matchBySemantic(provision);
      for (const match of semanticMatches) {
        if (!proposedMappings.some(m => m.ontologyTermId === match.ontologyTermId)) {
          proposedMappings.push(match);
        }
      }

      if (proposedMappings.length < 3) {
        const candidateTerms = await this.getCandidateTerms(provision);
        if (candidateTerms.length > 0) {
          const aiMatches = await this.matchByAI(provision, candidateTerms);
          for (const match of aiMatches) {
            if (!proposedMappings.some(m => m.ontologyTermId === match.ontologyTermId)) {
              proposedMappings.push(match);
            }
          }
        }
      }

      for (const mapping of proposedMappings) {
        try {
          const [inserted] = await db.insert(provisionOntologyMappings).values({
            lawProvisionId: provisionId,
            ontologyTermId: mapping.ontologyTermId,
            mappingType: mapping.mappingType,
            mappingReason: mapping.mappingReason,
            impactDescription: mapping.impactDescription,
            matchMethod: mapping.matchMethod,
            citationMatchScore: mapping.citationMatchScore || null,
            semanticSimilarityScore: mapping.semanticSimilarityScore || null,
            aiConfidenceScore: mapping.aiConfidenceScore,
            reviewStatus: "pending_review",
            priorityLevel: mapping.priorityLevel
          }).returning();

          result.mappingIds.push(inserted.id);
          result.mappingsProposed++;

          logger.info("Created provision mapping", {
            mappingId: inserted.id,
            provisionId,
            ontologyTermId: mapping.ontologyTermId,
            matchMethod: mapping.matchMethod
          });
        } catch (insertError) {
          logger.error("Failed to insert mapping", {
            error: insertError instanceof Error ? insertError.message : String(insertError)
          });
          result.errors.push(`Failed to insert mapping: ${insertError}`);
        }
      }

      if (result.mappingsProposed > 0) {
        await db.update(lawProvisions)
          .set({ processingStatus: "matched", updatedAt: new Date() })
          .where(eq(lawProvisions.id, provisionId));
      }

      result.success = result.mappingsProposed > 0;
      result.processingTimeMs = Date.now() - startTime;

      logger.info("Ontology matching completed", {
        provisionId,
        mappingsProposed: result.mappingsProposed,
        processingTimeMs: result.processingTimeMs
      });

      return result;
    } catch (error) {
      logger.error("Failed to match provision", {
        provisionId,
        error: error instanceof Error ? error.message : String(error)
      });
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.processingTimeMs = Date.now() - startTime;
      return result;
    }
  }

  private async matchByCitation(provision: LawProvision): Promise<ProposedMapping[]> {
    const mappings: ProposedMapping[] = [];
    
    if (!provision.usCodeCitation) return mappings;

    const normalized = normalizeUSCodeCitation(provision.usCodeCitation);
    if (!normalized) return mappings;

    const matchingTerms = await db.select()
      .from(ontologyTerms)
      .where(and(
        eq(ontologyTerms.isActive, true),
        or(
          ilike(ontologyTerms.statutoryCitation, `%${normalized.title} U.S.C. ${normalized.section}%`),
          ilike(ontologyTerms.statutoryCitation, `%${normalized.title} USC ${normalized.section}%`),
          ilike(ontologyTerms.statutoryCitation, `%7 CFR 273%`)
        )
      ));

    for (const term of matchingTerms) {
      mappings.push({
        lawProvisionId: provision.id,
        ontologyTermId: term.id,
        mappingType: determineMappingType(provision.provisionType, provision.provisionText),
        mappingReason: `Citation match: Provision cites ${provision.usCodeCitation}, term references ${term.statutoryCitation}`,
        impactDescription: `This provision may affect the definition or application of "${term.termName}"`,
        matchMethod: "citation_match",
        citationMatchScore: 0.95,
        aiConfidenceScore: 0.85,
        priorityLevel: determinePriority(provision, determineMappingType(provision.provisionType, provision.provisionText))
      });
    }

    return mappings;
  }

  private async matchBySemantic(provision: LawProvision): Promise<ProposedMapping[]> {
    const mappings: ProposedMapping[] = [];
    
    const textToEmbed = `${provision.provisionSummary || ""} ${provision.provisionText.substring(0, 500)}`;
    
    let provisionEmbedding: number[];
    try {
      provisionEmbedding = await generateEmbedding(textToEmbed);
    } catch (error) {
      logger.warn("Failed to generate embedding for provision", { provisionId: provision.id });
      return mappings;
    }

    const programs = provision.affectedPrograms || [];
    let candidateTerms;
    
    if (programs.length > 0) {
      candidateTerms = await db.select()
        .from(ontologyTerms)
        .where(and(
          eq(ontologyTerms.isActive, true),
          inArray(ontologyTerms.programCode, programs)
        ));
    } else {
      candidateTerms = await db.select()
        .from(ontologyTerms)
        .where(eq(ontologyTerms.isActive, true))
        .limit(100);
    }

    for (const term of candidateTerms) {
      if (!term.embedding) continue;
      
      const similarity = cosineSimilarity(provisionEmbedding, term.embedding as number[]);
      
      if (similarity >= SEMANTIC_SIMILARITY_THRESHOLD) {
        mappings.push({
          lawProvisionId: provision.id,
          ontologyTermId: term.id,
          mappingType: determineMappingType(provision.provisionType, provision.provisionText),
          mappingReason: `Semantic similarity: Provision text is ${(similarity * 100).toFixed(1)}% similar to term "${term.termName}"`,
          impactDescription: `High semantic overlap suggests this provision affects the concept of "${term.termName}"`,
          matchMethod: "semantic_similarity",
          semanticSimilarityScore: similarity,
          aiConfidenceScore: similarity * 0.9,
          priorityLevel: determinePriority(provision, determineMappingType(provision.provisionType, provision.provisionText))
        });
      }
    }

    return mappings.sort((a, b) => (b.semanticSimilarityScore || 0) - (a.semanticSimilarityScore || 0)).slice(0, 5);
  }

  private async getCandidateTerms(provision: LawProvision): Promise<any[]> {
    const programs = provision.affectedPrograms || [];
    
    if (programs.length > 0) {
      return db.select()
        .from(ontologyTerms)
        .where(and(
          eq(ontologyTerms.isActive, true),
          inArray(ontologyTerms.programCode, programs)
        ))
        .limit(20);
    }
    
    return db.select()
      .from(ontologyTerms)
      .where(eq(ontologyTerms.isActive, true))
      .limit(20);
  }

  private async matchByAI(provision: LawProvision, candidateTerms: any[]): Promise<ProposedMapping[]> {
    const mappings: ProposedMapping[] = [];
    
    try {
      const prompt = await buildAIMatchingPrompt(provision, candidateTerms);
      
      const response = await generateTextWithGemini(prompt, {
        model: AI_MODEL,
        temperature: 0.1,
        maxTokens: 2000
      });

      let parsed: { mappings: any[] };
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found");
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        return mappings;
      }

      if (!parsed.mappings || !Array.isArray(parsed.mappings)) {
        return mappings;
      }

      for (const aiMapping of parsed.mappings) {
        const term = candidateTerms.find(t => t.canonicalName === aiMapping.canonicalName);
        if (!term) continue;

        mappings.push({
          lawProvisionId: provision.id,
          ontologyTermId: term.id,
          mappingType: aiMapping.mappingType as MappingType || "amends",
          mappingReason: aiMapping.reason || "AI-inferred relationship",
          impactDescription: aiMapping.impact || "Impact to be reviewed",
          matchMethod: "ai_inference",
          aiConfidenceScore: aiMapping.confidence || 0.7,
          priorityLevel: determinePriority(provision, aiMapping.mappingType || "amends")
        });
      }
    } catch (error) {
      logger.warn("AI matching failed", { provisionId: provision.id, error });
    }

    return mappings;
  }

  async matchAllUnmatchedProvisions(): Promise<MatchingResult[]> {
    const unmatched = await db.select()
      .from(lawProvisions)
      .where(eq(lawProvisions.processingStatus, "extracted"))
      .orderBy(lawProvisions.createdAt);

    const results: MatchingResult[] = [];
    
    for (const provision of unmatched) {
      const result = await this.matchProvisionToOntology(provision.id);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  async getPendingMappings(limit = 50, offset = 0): Promise<any[]> {
    return db.select({
      mapping: provisionOntologyMappings,
      provision: lawProvisions,
      term: ontologyTerms
    })
      .from(provisionOntologyMappings)
      .innerJoin(lawProvisions, eq(provisionOntologyMappings.lawProvisionId, lawProvisions.id))
      .innerJoin(ontologyTerms, eq(provisionOntologyMappings.ontologyTermId, ontologyTerms.id))
      .where(eq(provisionOntologyMappings.reviewStatus, "pending_review"))
      .orderBy(
        sql`CASE ${provisionOntologyMappings.priorityLevel} 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'normal' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 END`,
        desc(provisionOntologyMappings.createdAt)
      )
      .limit(limit)
      .offset(offset);
  }

  async getMappingStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    byPriority: Record<string, number>;
  }> {
    const stats = await db.select({
      status: provisionOntologyMappings.reviewStatus,
      priority: provisionOntologyMappings.priorityLevel,
      count: sql<number>`count(*)`
    })
      .from(provisionOntologyMappings)
      .groupBy(provisionOntologyMappings.reviewStatus, provisionOntologyMappings.priorityLevel);

    const result = {
      pending: 0,
      approved: 0,
      rejected: 0,
      byPriority: {} as Record<string, number>
    };

    for (const row of stats) {
      if (row.status === "pending_review") result.pending += Number(row.count);
      if (row.status === "approved") result.approved += Number(row.count);
      if (row.status === "rejected") result.rejected += Number(row.count);
      
      if (row.status === "pending_review") {
        result.byPriority[row.priority || "normal"] = 
          (result.byPriority[row.priority || "normal"] || 0) + Number(row.count);
      }
    }

    return result;
  }
}

export const ontologyMatcherService = new OntologyMatcherService();
