import { db } from "../db";
import { ontologyTerms, ontologyRelationships, statutorySources } from "@shared/schema";
import { eq, and, or, ilike, inArray, desc, sql } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "./gemini.service";
import { logger } from "./logger.service";

export type OntologyDomain = 
  | "income" 
  | "residency" 
  | "citizenship" 
  | "resources" 
  | "work_requirement" 
  | "student_status"
  | "household_composition"
  | "age"
  | "disability"
  | "verification"
  | "categorical_eligibility"
  | "deductions"
  | "assets"
  | "time_limits";

export type RelationshipType = 
  | "is_a"
  | "has_property" 
  | "requires"
  | "implies"
  | "excludes"
  | "depends_on"
  | "constrains"
  | "part_of"
  | "equivalent_to";

export interface CreateTermInput {
  stateCode: string;
  programCode: string;
  termName: string;
  domain: OntologyDomain;
  definition?: string;
  statutoryCitation?: string;
  statutorySourceId?: string;
  parentTermId?: string;
  synonyms?: string[];
  createdBy?: string;
}

export interface CreateRelationshipInput {
  fromTermId: string;
  toTermId: string;
  relationshipType: RelationshipType;
  statutoryCitation?: string;
  description?: string;
  weight?: number;
}

export interface SimilarTerm {
  term: typeof ontologyTerms.$inferSelect;
  similarity: number;
}

const SIMILARITY_THRESHOLD = 0.85;

class LegalOntologyService {
  
  async createTerm(input: CreateTermInput): Promise<typeof ontologyTerms.$inferSelect> {
    try {
      const canonicalName = this.generateCanonicalName(input.domain, input.termName);
      
      const existingTerm = await this.findByCanonicalName(canonicalName, input.stateCode, input.programCode);
      if (existingTerm) {
        logger.warn("Term already exists with canonical name", { 
          canonicalName, 
          existingId: existingTerm.id 
        });
        return existingTerm;
      }
      
      const textToEmbed = this.prepareTextForEmbedding(input.termName, input.definition, input.synonyms);
      const embedding = await generateEmbedding(textToEmbed);
      
      const duplicateTerm = await this.findDuplicate(embedding, input.stateCode, input.programCode);
      if (duplicateTerm) {
        logger.info("Found semantically similar term, returning existing", {
          newTerm: input.termName,
          existingTerm: duplicateTerm.term.termName,
          similarity: duplicateTerm.similarity
        });
        return duplicateTerm.term;
      }
      
      const [newTerm] = await db.insert(ontologyTerms).values({
        stateCode: input.stateCode,
        programCode: input.programCode,
        termName: input.termName,
        canonicalName,
        domain: input.domain,
        definition: input.definition,
        statutoryCitation: input.statutoryCitation,
        statutorySourceId: input.statutorySourceId,
        parentTermId: input.parentTermId,
        synonyms: input.synonyms,
        embedding,
        embeddingModel: "gemini-embedding-001",
        createdBy: input.createdBy || "system",
        isActive: true,
      }).returning();
      
      logger.info("Created new ontology term", {
        id: newTerm.id,
        termName: newTerm.termName,
        canonicalName: newTerm.canonicalName,
        domain: newTerm.domain
      });
      
      return newTerm;
    } catch (error) {
      logger.error("Error creating ontology term", { error, input });
      throw error;
    }
  }
  
  async updateTerm(
    termId: string, 
    updates: Partial<CreateTermInput>
  ): Promise<typeof ontologyTerms.$inferSelect | null> {
    try {
      const existing = await this.getTermById(termId);
      if (!existing) {
        return null;
      }
      
      let newEmbedding = existing.embedding;
      let newCanonicalName = existing.canonicalName;
      
      if (updates.termName || updates.definition || updates.synonyms) {
        const textToEmbed = this.prepareTextForEmbedding(
          updates.termName || existing.termName,
          updates.definition || existing.definition || undefined,
          updates.synonyms || existing.synonyms || undefined
        );
        newEmbedding = await generateEmbedding(textToEmbed);
      }
      
      if (updates.domain || updates.termName) {
        newCanonicalName = this.generateCanonicalName(
          updates.domain || existing.domain as OntologyDomain,
          updates.termName || existing.termName
        );
      }
      
      const [updated] = await db.update(ontologyTerms)
        .set({
          ...updates,
          canonicalName: newCanonicalName,
          embedding: newEmbedding,
          updatedAt: new Date(),
        })
        .where(eq(ontologyTerms.id, termId))
        .returning();
      
      return updated;
    } catch (error) {
      logger.error("Error updating ontology term", { error, termId, updates });
      throw error;
    }
  }
  
  async getTermById(termId: string): Promise<typeof ontologyTerms.$inferSelect | null> {
    const [term] = await db.select()
      .from(ontologyTerms)
      .where(eq(ontologyTerms.id, termId))
      .limit(1);
    return term || null;
  }
  
  async findByCanonicalName(
    canonicalName: string, 
    stateCode: string, 
    programCode: string
  ): Promise<typeof ontologyTerms.$inferSelect | null> {
    const [term] = await db.select()
      .from(ontologyTerms)
      .where(and(
        eq(ontologyTerms.canonicalName, canonicalName),
        eq(ontologyTerms.stateCode, stateCode),
        eq(ontologyTerms.programCode, programCode),
        eq(ontologyTerms.isActive, true)
      ))
      .limit(1);
    return term || null;
  }
  
  async searchTermsByText(
    query: string, 
    stateCode?: string, 
    programCode?: string,
    domain?: OntologyDomain,
    limit: number = 10
  ): Promise<typeof ontologyTerms.$inferSelect[]> {
    let whereConditions = [eq(ontologyTerms.isActive, true)];
    
    if (stateCode) {
      whereConditions.push(eq(ontologyTerms.stateCode, stateCode));
    }
    if (programCode) {
      whereConditions.push(eq(ontologyTerms.programCode, programCode));
    }
    if (domain) {
      whereConditions.push(eq(ontologyTerms.domain, domain));
    }
    
    const searchPattern = `%${query}%`;
    whereConditions.push(
      or(
        ilike(ontologyTerms.termName, searchPattern),
        ilike(ontologyTerms.definition, searchPattern),
        ilike(ontologyTerms.canonicalName, searchPattern)
      )!
    );
    
    return db.select()
      .from(ontologyTerms)
      .where(and(...whereConditions))
      .limit(limit);
  }
  
  async findSimilarTerms(
    text: string,
    stateCode?: string,
    programCode?: string,
    threshold: number = SIMILARITY_THRESHOLD,
    limit: number = 10
  ): Promise<SimilarTerm[]> {
    try {
      const queryEmbedding = await generateEmbedding(text);
      
      let whereConditions = [eq(ontologyTerms.isActive, true)];
      if (stateCode) {
        whereConditions.push(eq(ontologyTerms.stateCode, stateCode));
      }
      if (programCode) {
        whereConditions.push(eq(ontologyTerms.programCode, programCode));
      }
      
      const allTerms = await db.select()
        .from(ontologyTerms)
        .where(and(...whereConditions));
      
      const similarities: SimilarTerm[] = [];
      
      for (const term of allTerms) {
        if (!term.embedding || term.embedding.length === 0) {
          continue;
        }
        
        const similarity = cosineSimilarity(queryEmbedding, term.embedding);
        
        if (similarity >= threshold) {
          similarities.push({ term, similarity });
        }
      }
      
      similarities.sort((a, b) => b.similarity - a.similarity);
      
      return similarities.slice(0, limit);
    } catch (error) {
      logger.error("Error finding similar terms", { error, text });
      return [];
    }
  }
  
  async findDuplicate(
    embedding: number[],
    stateCode: string,
    programCode: string
  ): Promise<SimilarTerm | null> {
    const termsInScope = await db.select()
      .from(ontologyTerms)
      .where(and(
        eq(ontologyTerms.stateCode, stateCode),
        eq(ontologyTerms.programCode, programCode),
        eq(ontologyTerms.isActive, true)
      ));
    
    for (const term of termsInScope) {
      if (!term.embedding || term.embedding.length === 0) {
        continue;
      }
      
      const similarity = cosineSimilarity(embedding, term.embedding);
      
      if (similarity >= SIMILARITY_THRESHOLD) {
        return { term, similarity };
      }
    }
    
    return null;
  }
  
  async createRelationship(input: CreateRelationshipInput): Promise<typeof ontologyRelationships.$inferSelect> {
    try {
      const [fromTerm, toTerm] = await Promise.all([
        this.getTermById(input.fromTermId),
        this.getTermById(input.toTermId)
      ]);
      
      if (!fromTerm) {
        throw new Error(`From term not found: ${input.fromTermId}`);
      }
      if (!toTerm) {
        throw new Error(`To term not found: ${input.toTermId}`);
      }
      
      const existing = await db.select()
        .from(ontologyRelationships)
        .where(and(
          eq(ontologyRelationships.fromTermId, input.fromTermId),
          eq(ontologyRelationships.toTermId, input.toTermId),
          eq(ontologyRelationships.relationshipType, input.relationshipType),
          eq(ontologyRelationships.isActive, true)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        logger.info("Relationship already exists", { 
          fromTermId: input.fromTermId, 
          toTermId: input.toTermId,
          type: input.relationshipType 
        });
        return existing[0];
      }
      
      const [relationship] = await db.insert(ontologyRelationships).values({
        fromTermId: input.fromTermId,
        toTermId: input.toTermId,
        relationshipType: input.relationshipType,
        statutoryCitation: input.statutoryCitation,
        description: input.description,
        weight: input.weight || 1.0,
        isActive: true,
      }).returning();
      
      logger.info("Created ontology relationship", {
        id: relationship.id,
        from: fromTerm.termName,
        to: toTerm.termName,
        type: input.relationshipType
      });
      
      return relationship;
    } catch (error) {
      logger.error("Error creating ontology relationship", { error, input });
      throw error;
    }
  }
  
  async getRelationshipsFrom(
    termId: string, 
    relationshipType?: RelationshipType
  ): Promise<Array<{
    relationship: typeof ontologyRelationships.$inferSelect;
    targetTerm: typeof ontologyTerms.$inferSelect;
  }>> {
    let whereConditions = [
      eq(ontologyRelationships.fromTermId, termId),
      eq(ontologyRelationships.isActive, true)
    ];
    
    if (relationshipType) {
      whereConditions.push(eq(ontologyRelationships.relationshipType, relationshipType));
    }
    
    const relationships = await db.select()
      .from(ontologyRelationships)
      .where(and(...whereConditions));
    
    const results = [];
    for (const rel of relationships) {
      const targetTerm = await this.getTermById(rel.toTermId);
      if (targetTerm) {
        results.push({ relationship: rel, targetTerm });
      }
    }
    
    return results;
  }
  
  async getRelationshipsTo(
    termId: string,
    relationshipType?: RelationshipType
  ): Promise<Array<{
    relationship: typeof ontologyRelationships.$inferSelect;
    sourceTerm: typeof ontologyTerms.$inferSelect;
  }>> {
    let whereConditions = [
      eq(ontologyRelationships.toTermId, termId),
      eq(ontologyRelationships.isActive, true)
    ];
    
    if (relationshipType) {
      whereConditions.push(eq(ontologyRelationships.relationshipType, relationshipType));
    }
    
    const relationships = await db.select()
      .from(ontologyRelationships)
      .where(and(...whereConditions));
    
    const results = [];
    for (const rel of relationships) {
      const sourceTerm = await this.getTermById(rel.fromTermId);
      if (sourceTerm) {
        results.push({ relationship: rel, sourceTerm });
      }
    }
    
    return results;
  }
  
  async traverseGraph(
    startTermId: string,
    relationshipTypes: RelationshipType[],
    maxDepth: number = 3
  ): Promise<Map<string, { term: typeof ontologyTerms.$inferSelect; depth: number }>> {
    const visited = new Map<string, { term: typeof ontologyTerms.$inferSelect; depth: number }>();
    const queue: Array<{ termId: string; depth: number }> = [{ termId: startTermId, depth: 0 }];
    
    while (queue.length > 0) {
      const { termId, depth } = queue.shift()!;
      
      if (visited.has(termId) || depth > maxDepth) {
        continue;
      }
      
      const term = await this.getTermById(termId);
      if (!term) continue;
      
      visited.set(termId, { term, depth });
      
      if (depth < maxDepth) {
        for (const relType of relationshipTypes) {
          const outgoing = await this.getRelationshipsFrom(termId, relType);
          for (const { targetTerm } of outgoing) {
            if (!visited.has(targetTerm.id)) {
              queue.push({ termId: targetTerm.id, depth: depth + 1 });
            }
          }
        }
      }
    }
    
    return visited;
  }
  
  async getTermsByDomain(
    domain: OntologyDomain,
    stateCode?: string,
    programCode?: string
  ): Promise<typeof ontologyTerms.$inferSelect[]> {
    let whereConditions = [
      eq(ontologyTerms.domain, domain),
      eq(ontologyTerms.isActive, true)
    ];
    
    if (stateCode) {
      whereConditions.push(eq(ontologyTerms.stateCode, stateCode));
    }
    if (programCode) {
      whereConditions.push(eq(ontologyTerms.programCode, programCode));
    }
    
    return db.select()
      .from(ontologyTerms)
      .where(and(...whereConditions))
      .orderBy(ontologyTerms.canonicalName);
  }
  
  async getTermsByProgram(
    stateCode: string,
    programCode: string
  ): Promise<typeof ontologyTerms.$inferSelect[]> {
    return db.select()
      .from(ontologyTerms)
      .where(and(
        eq(ontologyTerms.stateCode, stateCode),
        eq(ontologyTerms.programCode, programCode),
        eq(ontologyTerms.isActive, true)
      ))
      .orderBy(ontologyTerms.domain, ontologyTerms.canonicalName);
  }
  
  async deactivateTerm(termId: string): Promise<boolean> {
    const [updated] = await db.update(ontologyTerms)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(ontologyTerms.id, termId))
      .returning();
    
    if (updated) {
      await db.update(ontologyRelationships)
        .set({ isActive: false, updatedAt: new Date() })
        .where(or(
          eq(ontologyRelationships.fromTermId, termId),
          eq(ontologyRelationships.toTermId, termId)
        ));
    }
    
    return !!updated;
  }
  
  async getStats(stateCode?: string, programCode?: string): Promise<{
    totalTerms: number;
    totalRelationships: number;
    termsByDomain: Record<string, number>;
    termsByProgram: Record<string, number>;
  }> {
    let termConditions = [eq(ontologyTerms.isActive, true)];
    if (stateCode) termConditions.push(eq(ontologyTerms.stateCode, stateCode));
    if (programCode) termConditions.push(eq(ontologyTerms.programCode, programCode));
    
    const terms = await db.select()
      .from(ontologyTerms)
      .where(and(...termConditions));
    
    const relationships = await db.select()
      .from(ontologyRelationships)
      .where(eq(ontologyRelationships.isActive, true));
    
    const termsByDomain: Record<string, number> = {};
    const termsByProgram: Record<string, number> = {};
    
    for (const term of terms) {
      termsByDomain[term.domain] = (termsByDomain[term.domain] || 0) + 1;
      const key = `${term.stateCode}_${term.programCode}`;
      termsByProgram[key] = (termsByProgram[key] || 0) + 1;
    }
    
    return {
      totalTerms: terms.length,
      totalRelationships: relationships.length,
      termsByDomain,
      termsByProgram
    };
  }
  
  private generateCanonicalName(domain: OntologyDomain, termName: string): string {
    const normalizedTerm = termName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toUpperCase();
    
    return `${domain.toUpperCase()}_${normalizedTerm}`;
  }
  
  private prepareTextForEmbedding(
    termName: string, 
    definition?: string, 
    synonyms?: string[]
  ): string {
    const parts = [termName];
    
    if (definition) {
      parts.push(definition);
    }
    
    if (synonyms && synonyms.length > 0) {
      parts.push(`Also known as: ${synonyms.join(", ")}`);
    }
    
    return parts.join(". ");
  }
}

export const legalOntologyService = new LegalOntologyService();
