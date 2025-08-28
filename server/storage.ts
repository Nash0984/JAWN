import {
  users,
  documents,
  documentChunks,
  benefitPrograms,
  documentTypes,
  policySources,
  searchQueries,
  modelVersions,
  trainingJobs,
  type User,
  type InsertUser,
  type Document,
  type InsertDocument,
  type DocumentChunk,
  type InsertDocumentChunk,
  type BenefitProgram,
  type InsertBenefitProgram,
  type DocumentType,
  type PolicySource,
  type InsertPolicySource,
  type SearchQuery,
  type InsertSearchQuery,
  type ModelVersion,
  type InsertModelVersion,
  type TrainingJob,
  type InsertTrainingJob,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Documents
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocuments(filters?: { benefitProgramId?: string; status?: string; limit?: number }): Promise<Document[]>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

  // Document Chunks
  createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;
  getDocumentChunks(documentId: string): Promise<DocumentChunk[]>;
  updateDocumentChunk(id: string, updates: Partial<DocumentChunk>): Promise<DocumentChunk>;

  // Benefit Programs
  getBenefitPrograms(): Promise<BenefitProgram[]>;
  createBenefitProgram(program: InsertBenefitProgram): Promise<BenefitProgram>;
  getBenefitProgram(id: string): Promise<BenefitProgram | undefined>;

  // Document Types
  getDocumentTypes(): Promise<DocumentType[]>;

  // Policy Sources
  getPolicySources(): Promise<PolicySource[]>;
  createPolicySource(source: InsertPolicySource): Promise<PolicySource>;
  updatePolicySource(id: string, updates: Partial<PolicySource>): Promise<PolicySource>;

  // Search Queries
  createSearchQuery(query: InsertSearchQuery): Promise<SearchQuery>;
  getSearchQueries(userId?: string, limit?: number): Promise<SearchQuery[]>;

  // Model Versions
  getModelVersions(): Promise<ModelVersion[]>;
  createModelVersion(version: InsertModelVersion): Promise<ModelVersion>;
  updateModelVersion(id: string, updates: Partial<ModelVersion>): Promise<ModelVersion>;

  // Training Jobs
  createTrainingJob(job: InsertTrainingJob): Promise<TrainingJob>;
  getTrainingJobs(limit?: number): Promise<TrainingJob[]>;
  updateTrainingJob(id: string, updates: Partial<TrainingJob>): Promise<TrainingJob>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Documents
  async createDocument(document: InsertDocument): Promise<Document> {
    const [doc] = await db.insert(documents).values(document).returning();
    return doc;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc || undefined;
  }

  async getDocuments(filters?: { benefitProgramId?: string; status?: string; limit?: number }): Promise<Document[]> {
    let query = db.select().from(documents);
    
    const conditions = [];
    if (filters?.benefitProgramId) {
      conditions.push(eq(documents.benefitProgramId, filters.benefitProgramId));
    }
    if (filters?.status) {
      conditions.push(eq(documents.status, filters.status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(documents.createdAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    return await query;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
    const [doc] = await db
      .update(documents)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(documents.id, id))
      .returning();
    return doc;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // Document Chunks
  async createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk> {
    const [docChunk] = await db.insert(documentChunks).values(chunk).returning();
    return docChunk;
  }

  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    return await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .orderBy(documentChunks.chunkIndex);
  }

  async updateDocumentChunk(id: string, updates: Partial<DocumentChunk>): Promise<DocumentChunk> {
    const [chunk] = await db
      .update(documentChunks)
      .set(updates)
      .where(eq(documentChunks.id, id))
      .returning();
    return chunk;
  }

  // Benefit Programs
  async getBenefitPrograms(): Promise<BenefitProgram[]> {
    // Ensure Maryland benefit programs are seeded
    await this.seedMarylandBenefitPrograms();
    
    return await db
      .select()
      .from(benefitPrograms)
      .where(eq(benefitPrograms.isActive, true))
      .orderBy(benefitPrograms.name);
  }
  
  private async seedMarylandBenefitPrograms(): Promise<void> {
    const marylandPrograms = [
      {
        name: "Maryland SNAP",
        code: "MD_SNAP",
        description: "Supplemental Nutrition Assistance Program providing food assistance to Maryland families and individuals"
      },
      {
        name: "Maryland Medicaid",
        code: "MD_MEDICAID", 
        description: "Health insurance coverage for eligible Maryland residents through Maryland Health Connection"
      },
      {
        name: "Maryland TANF",
        code: "MD_TANF",
        description: "Temporary Assistance for Needy Families providing cash assistance to Maryland families"
      },
      {
        name: "Maryland Energy Assistance",
        code: "MD_ENERGY",
        description: "Energy assistance programs to help Maryland residents with utility bills and energy costs"
      },
      {
        name: "Maryland WIC",
        code: "MD_WIC",
        description: "Women, Infants and Children program providing nutrition assistance for pregnant women and children"
      },
      {
        name: "Maryland Children's Health Program",
        code: "MD_MCHP", 
        description: "Health benefits for Maryland children up to age 19"
      },
      {
        name: "VITA Tax Assistance",
        code: "MD_VITA",
        description: "Free tax preparation assistance for Maryland residents with income under $67,000"
      }
    ];

    for (const program of marylandPrograms) {
      try {
        const existing = await db
          .select()
          .from(benefitPrograms) 
          .where(eq(benefitPrograms.code, program.code))
          .limit(1);
          
        if (existing.length === 0) {
          await db.insert(benefitPrograms).values(program);
        }
      } catch (error) {
        // Program might already exist, continue with others
        console.log(`Program ${program.code} already exists or error occurred`);
      }
    }
  }

  async createBenefitProgram(program: InsertBenefitProgram): Promise<BenefitProgram> {
    const [prog] = await db.insert(benefitPrograms).values(program).returning();
    return prog;
  }

  async getBenefitProgram(id: string): Promise<BenefitProgram | undefined> {
    const [program] = await db
      .select()
      .from(benefitPrograms)
      .where(eq(benefitPrograms.id, id));
    return program || undefined;
  }

  // Document Types
  async getDocumentTypes(): Promise<DocumentType[]> {
    return await db
      .select()
      .from(documentTypes)
      .where(eq(documentTypes.isActive, true))
      .orderBy(documentTypes.name);
  }

  // Policy Sources
  async getPolicySources(): Promise<PolicySource[]> {
    return await db
      .select()
      .from(policySources)
      .where(eq(policySources.isActive, true))
      .orderBy(desc(policySources.createdAt));
  }

  async createPolicySource(source: InsertPolicySource): Promise<PolicySource> {
    const [src] = await db.insert(policySources).values(source).returning();
    return src;
  }

  async updatePolicySource(id: string, updates: Partial<PolicySource>): Promise<PolicySource> {
    const [source] = await db
      .update(policySources)
      .set(updates)
      .where(eq(policySources.id, id))
      .returning();
    return source;
  }

  // Search Queries
  async createSearchQuery(query: InsertSearchQuery): Promise<SearchQuery> {
    const [searchQuery] = await db.insert(searchQueries).values(query).returning();
    return searchQuery;
  }

  async getSearchQueries(userId?: string, limit: number = 50): Promise<SearchQuery[]> {
    let query = db.select().from(searchQueries);
    
    if (userId) {
      query = query.where(eq(searchQueries.userId, userId));
    }
    
    return await query
      .orderBy(desc(searchQueries.createdAt))
      .limit(limit);
  }

  // Model Versions
  async getModelVersions(): Promise<ModelVersion[]> {
    return await db
      .select()
      .from(modelVersions)
      .orderBy(desc(modelVersions.createdAt));
  }

  async createModelVersion(version: InsertModelVersion): Promise<ModelVersion> {
    const [modelVersion] = await db.insert(modelVersions).values(version).returning();
    return modelVersion;
  }

  async updateModelVersion(id: string, updates: Partial<ModelVersion>): Promise<ModelVersion> {
    const [version] = await db
      .update(modelVersions)
      .set(updates)
      .where(eq(modelVersions.id, id))
      .returning();
    return version;
  }

  // Training Jobs
  async createTrainingJob(job: InsertTrainingJob): Promise<TrainingJob> {
    const [trainingJob] = await db.insert(trainingJobs).values(job).returning();
    return trainingJob;
  }

  async getTrainingJobs(limit: number = 20): Promise<TrainingJob[]> {
    return await db
      .select()
      .from(trainingJobs)
      .orderBy(desc(trainingJobs.createdAt))
      .limit(limit);
  }

  async updateTrainingJob(id: string, updates: Partial<TrainingJob>): Promise<TrainingJob> {
    const [job] = await db
      .update(trainingJobs)
      .set(updates)
      .where(eq(trainingJobs.id, id))
      .returning();
    return job;
  }
}

export const storage = new DatabaseStorage();
