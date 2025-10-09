import {
  users,
  documents,
  documentChunks,
  documentVersions,
  benefitPrograms,
  documentTypes,
  policySources,
  searchQueries,
  modelVersions,
  trainingJobs,
  snapIncomeLimits,
  snapDeductions,
  snapAllotments,
  categoricalEligibilityRules,
  documentRequirementRules,
  eligibilityCalculations,
  clientCases,
  povertyLevels,
  manualSections,
  sectionCrossReferences,
  type User,
  type InsertUser,
  type Document,
  type InsertDocument,
  type DocumentChunk,
  type InsertDocumentChunk,
  type DocumentVersion,
  type InsertDocumentVersion,
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
  type SnapIncomeLimit,
  type InsertSnapIncomeLimit,
  type SnapDeduction,
  type InsertSnapDeduction,
  type SnapAllotment,
  type InsertSnapAllotment,
  type CategoricalEligibilityRule,
  type InsertCategoricalEligibilityRule,
  type DocumentRequirementRule,
  type InsertDocumentRequirementRule,
  type EligibilityCalculation,
  type InsertEligibilityCalculation,
  type ClientCase,
  type InsertClientCase,
  type PovertyLevel,
  type InsertPovertyLevel,
  clientInteractionSessions,
  type ClientInteractionSession,
  type InsertClientInteractionSession,
  eeExportBatches,
  type EEExportBatch,
  type InsertEEExportBatch,
  consentForms,
  type ConsentForm,
  type InsertConsentForm,
  clientConsents,
  type ClientConsent,
  type InsertClientConsent,
  policyChanges,
  type PolicyChange,
  type InsertPolicyChange,
  policyChangeImpacts,
  type PolicyChangeImpact,
  type InsertPolicyChangeImpact,
  complianceRules,
  type ComplianceRule,
  type InsertComplianceRule,
  complianceViolations,
  type ComplianceViolation,
  type InsertComplianceViolation,
  intakeSessions,
  type IntakeSession,
  type InsertIntakeSession,
  intakeMessages,
  type IntakeMessage,
  type InsertIntakeMessage,
  applicationForms,
  type ApplicationForm,
  type InsertApplicationForm,
  anonymousScreeningSessions,
  type AnonymousScreeningSession,
  type InsertAnonymousScreeningSession,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, sql, or, isNull, lte, gte } from "drizzle-orm";

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
  getBenefitProgramByCode(code: string): Promise<BenefitProgram | undefined>;

  // Document Types
  getDocumentTypes(): Promise<DocumentType[]>;
  createDocumentType(docType: { code: string; name: string; description?: string }): Promise<DocumentType>;

  // Policy Sources
  getPolicySources(): Promise<PolicySource[]>;
  getPolicySourceById(id: string): Promise<PolicySource | undefined>;
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

  // Document Versions
  createDocumentVersion(version: InsertDocumentVersion): Promise<DocumentVersion>;
  getDocumentVersions(documentId: string): Promise<DocumentVersion[]>;
  getActiveDocumentVersion(documentId: string): Promise<DocumentVersion | null>;
  updateDocumentVersion(id: string, updates: Partial<DocumentVersion>): Promise<DocumentVersion>;
  deactivateDocumentVersions(documentId: string): Promise<void>;

  // Rules as Code - SNAP Income Limits
  createSnapIncomeLimit(limit: InsertSnapIncomeLimit): Promise<SnapIncomeLimit>;
  getSnapIncomeLimits(benefitProgramId: string): Promise<SnapIncomeLimit[]>;
  updateSnapIncomeLimit(id: string, updates: Partial<SnapIncomeLimit>): Promise<SnapIncomeLimit>;

  // Rules as Code - SNAP Deductions
  createSnapDeduction(deduction: InsertSnapDeduction): Promise<SnapDeduction>;
  getSnapDeductions(benefitProgramId: string): Promise<SnapDeduction[]>;
  updateSnapDeduction(id: string, updates: Partial<SnapDeduction>): Promise<SnapDeduction>;

  // Rules as Code - SNAP Allotments
  createSnapAllotment(allotment: InsertSnapAllotment): Promise<SnapAllotment>;
  getSnapAllotments(benefitProgramId: string): Promise<SnapAllotment[]>;
  updateSnapAllotment(id: string, updates: Partial<SnapAllotment>): Promise<SnapAllotment>;

  // Rules as Code - Categorical Eligibility
  createCategoricalEligibilityRule(rule: InsertCategoricalEligibilityRule): Promise<CategoricalEligibilityRule>;
  getCategoricalEligibilityRules(benefitProgramId: string): Promise<CategoricalEligibilityRule[]>;
  updateCategoricalEligibilityRule(id: string, updates: Partial<CategoricalEligibilityRule>): Promise<CategoricalEligibilityRule>;

  // Rules as Code - Document Requirements
  createDocumentRequirementRule(rule: InsertDocumentRequirementRule): Promise<DocumentRequirementRule>;
  getDocumentRequirementRules(benefitProgramId: string): Promise<DocumentRequirementRule[]>;
  updateDocumentRequirementRule(id: string, updates: Partial<DocumentRequirementRule>): Promise<DocumentRequirementRule>;

  // Rules as Code - Eligibility Calculations
  createEligibilityCalculation(calculation: InsertEligibilityCalculation): Promise<EligibilityCalculation>;
  getEligibilityCalculations(userId?: string, limit?: number): Promise<EligibilityCalculation[]>;

  // Rules as Code - Client Cases
  createClientCase(clientCase: InsertClientCase): Promise<ClientCase>;
  getClientCases(navigatorId?: string, status?: string): Promise<ClientCase[]>;
  getClientCase(id: string): Promise<ClientCase | undefined>;
  updateClientCase(id: string, updates: Partial<ClientCase>): Promise<ClientCase>;

  // Rules as Code - Poverty Levels
  createPovertyLevel(level: InsertPovertyLevel): Promise<PovertyLevel>;
  getPovertyLevels(year?: number): Promise<PovertyLevel[]>;

  // Policy Manual Sections
  getManualSections(): Promise<any[]>;
  getManualSection(id: string): Promise<any | undefined>;
  getSectionCrossReferences(sectionId: string): Promise<any[]>;
  getSectionChunks(sectionId: string): Promise<any[]>;

  // Navigator Workspace - Client Interaction Sessions
  createClientInteractionSession(session: InsertClientInteractionSession): Promise<ClientInteractionSession>;
  getClientInteractionSessions(navigatorId?: string): Promise<ClientInteractionSession[]>;
  getUnexportedSessions(): Promise<ClientInteractionSession[]>;
  markSessionsAsExported(sessionIds: string[], exportBatchId: string): Promise<void>;
  getSessionsByExportBatch(exportBatchId: string): Promise<ClientInteractionSession[]>;

  // Navigator Workspace - E&E Export Batches
  createEEExportBatch(batch: InsertEEExportBatch): Promise<EEExportBatch>;
  getEEExportBatches(): Promise<EEExportBatch[]>;
  getEEExportBatch(id: string): Promise<EEExportBatch | undefined>;

  // Consent Management - Forms
  createConsentForm(form: InsertConsentForm): Promise<ConsentForm>;
  getConsentForms(): Promise<ConsentForm[]>;
  getConsentForm(id: string): Promise<ConsentForm | undefined>;

  // Consent Management - Client Consents
  createClientConsent(consent: InsertClientConsent): Promise<ClientConsent>;
  getClientConsents(clientCaseId?: string): Promise<ClientConsent[]>;

  // Policy Change Monitoring
  createPolicyChange(change: InsertPolicyChange): Promise<PolicyChange>;
  getPolicyChanges(filters?: { benefitProgramId?: string; status?: string; limit?: number }): Promise<PolicyChange[]>;
  getPolicyChange(id: string): Promise<PolicyChange | undefined>;
  updatePolicyChange(id: string, updates: Partial<PolicyChange>): Promise<PolicyChange>;
  
  createPolicyChangeImpact(impact: InsertPolicyChangeImpact): Promise<PolicyChangeImpact>;
  getPolicyChangeImpact(id: string): Promise<PolicyChangeImpact | undefined>;
  getPolicyChangeImpacts(policyChangeId: string): Promise<PolicyChangeImpact[]>;
  getUserPolicyChangeImpacts(userId: string, unresolved?: boolean): Promise<PolicyChangeImpact[]>;
  updatePolicyChangeImpact(id: string, updates: Partial<PolicyChangeImpact>): Promise<PolicyChangeImpact>;

  // Compliance Assurance Suite
  createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule>;
  getComplianceRules(filters?: { ruleType?: string; category?: string; benefitProgramId?: string; isActive?: boolean }): Promise<ComplianceRule[]>;
  getComplianceRule(id: string): Promise<ComplianceRule | undefined>;
  getComplianceRuleByCode(ruleCode: string): Promise<ComplianceRule | undefined>;
  updateComplianceRule(id: string, updates: Partial<ComplianceRule>): Promise<ComplianceRule>;
  deleteComplianceRule(id: string): Promise<void>;
  
  createComplianceViolation(violation: InsertComplianceViolation): Promise<ComplianceViolation>;
  getComplianceViolations(filters?: { complianceRuleId?: string; status?: string; severity?: string; entityType?: string }): Promise<ComplianceViolation[]>;
  getComplianceViolation(id: string): Promise<ComplianceViolation | undefined>;
  updateComplianceViolation(id: string, updates: Partial<ComplianceViolation>): Promise<ComplianceViolation>;
  deleteComplianceViolation(id: string): Promise<void>;

  // Adaptive Intake Copilot - Sessions
  createIntakeSession(session: InsertIntakeSession): Promise<IntakeSession>;
  getIntakeSession(id: string): Promise<IntakeSession | undefined>;
  getIntakeSessions(filters?: { userId?: string; status?: string; limit?: number }): Promise<IntakeSession[]>;
  updateIntakeSession(id: string, updates: Partial<IntakeSession>): Promise<IntakeSession>;
  
  // Adaptive Intake Copilot - Messages
  createIntakeMessage(message: InsertIntakeMessage): Promise<IntakeMessage>;
  getIntakeMessages(sessionId: string): Promise<IntakeMessage[]>;
  
  // Adaptive Intake Copilot - Application Forms
  createApplicationForm(form: InsertApplicationForm): Promise<ApplicationForm>;
  getApplicationForm(id: string): Promise<ApplicationForm | undefined>;
  getApplicationFormBySession(sessionId: string): Promise<ApplicationForm | undefined>;
  updateApplicationForm(id: string, updates: Partial<ApplicationForm>): Promise<ApplicationForm>;
  getApplicationForms(filters?: { userId?: string; exportStatus?: string; limit?: number }): Promise<ApplicationForm[]>;

  // Anonymous Screening Sessions
  createAnonymousScreeningSession(session: InsertAnonymousScreeningSession): Promise<AnonymousScreeningSession>;
  getAnonymousScreeningSession(sessionId: string): Promise<AnonymousScreeningSession | undefined>;
  getAnonymousScreeningSessionsByUser(userId: string): Promise<AnonymousScreeningSession[]>;
  updateAnonymousScreeningSession(id: string, updates: Partial<AnonymousScreeningSession>): Promise<AnonymousScreeningSession>;
  claimAnonymousScreeningSession(sessionId: string, userId: string): Promise<AnonymousScreeningSession>;
  deleteOldAnonymousSessions(daysOld: number): Promise<number>;
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

  async getBenefitProgramByCode(code: string): Promise<BenefitProgram | undefined> {
    const [program] = await db
      .select()
      .from(benefitPrograms)
      .where(eq(benefitPrograms.code, code));
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

  async createDocumentType(docType: { code: string; name: string; description?: string }): Promise<DocumentType> {
    const [type] = await db.insert(documentTypes).values(docType).returning();
    return type;
  }

  // Policy Sources
  async getPolicySources(): Promise<PolicySource[]> {
    return await db
      .select()
      .from(policySources)
      .where(eq(policySources.isActive, true))
      .orderBy(desc(policySources.createdAt));
  }

  async getPolicySourceById(id: string): Promise<PolicySource | undefined> {
    const [source] = await db
      .select()
      .from(policySources)
      .where(eq(policySources.id, id));
    return source || undefined;
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

  // Document Versions
  async createDocumentVersion(version: InsertDocumentVersion): Promise<DocumentVersion> {
    const [docVersion] = await db.insert(documentVersions).values(version).returning();
    return docVersion;
  }

  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    return await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.versionNumber));
  }

  async getActiveDocumentVersion(documentId: string): Promise<DocumentVersion | null> {
    const [activeVersion] = await db
      .select()
      .from(documentVersions)
      .where(and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.isActive, true)
      ))
      .limit(1);
    return activeVersion || null;
  }

  async updateDocumentVersion(id: string, updates: Partial<DocumentVersion>): Promise<DocumentVersion> {
    const [version] = await db
      .update(documentVersions)
      .set(updates)
      .where(eq(documentVersions.id, id))
      .returning();
    return version;
  }

  async deactivateDocumentVersions(documentId: string): Promise<void> {
    await db
      .update(documentVersions)
      .set({ isActive: false })
      .where(eq(documentVersions.documentId, documentId));
  }

  // Rules as Code - SNAP Income Limits
  async createSnapIncomeLimit(limit: InsertSnapIncomeLimit): Promise<SnapIncomeLimit> {
    const [incomeLimit] = await db.insert(snapIncomeLimits).values(limit).returning();
    return incomeLimit;
  }

  async getSnapIncomeLimits(benefitProgramId: string): Promise<SnapIncomeLimit[]> {
    return await db
      .select()
      .from(snapIncomeLimits)
      .where(eq(snapIncomeLimits.benefitProgramId, benefitProgramId))
      .orderBy(desc(snapIncomeLimits.effectiveDate));
  }

  async updateSnapIncomeLimit(id: string, updates: Partial<SnapIncomeLimit>): Promise<SnapIncomeLimit> {
    const [limit] = await db
      .update(snapIncomeLimits)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(snapIncomeLimits.id, id))
      .returning();
    return limit;
  }

  // Rules as Code - SNAP Deductions
  async createSnapDeduction(deduction: InsertSnapDeduction): Promise<SnapDeduction> {
    const [snapDeduction] = await db.insert(snapDeductions).values(deduction).returning();
    return snapDeduction;
  }

  async getSnapDeductions(benefitProgramId: string): Promise<SnapDeduction[]> {
    return await db
      .select()
      .from(snapDeductions)
      .where(eq(snapDeductions.benefitProgramId, benefitProgramId))
      .orderBy(snapDeductions.deductionType);
  }

  async updateSnapDeduction(id: string, updates: Partial<SnapDeduction>): Promise<SnapDeduction> {
    const [deduction] = await db
      .update(snapDeductions)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(snapDeductions.id, id))
      .returning();
    return deduction;
  }

  // Rules as Code - SNAP Allotments
  async createSnapAllotment(allotment: InsertSnapAllotment): Promise<SnapAllotment> {
    const [snapAllotment] = await db.insert(snapAllotments).values(allotment).returning();
    return snapAllotment;
  }

  async getSnapAllotments(benefitProgramId: string): Promise<SnapAllotment[]> {
    return await db
      .select()
      .from(snapAllotments)
      .where(eq(snapAllotments.benefitProgramId, benefitProgramId))
      .orderBy(desc(snapAllotments.effectiveDate));
  }

  async updateSnapAllotment(id: string, updates: Partial<SnapAllotment>): Promise<SnapAllotment> {
    const [allotment] = await db
      .update(snapAllotments)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(snapAllotments.id, id))
      .returning();
    return allotment;
  }

  // Rules as Code - Categorical Eligibility
  async createCategoricalEligibilityRule(rule: InsertCategoricalEligibilityRule): Promise<CategoricalEligibilityRule> {
    const [catRule] = await db.insert(categoricalEligibilityRules).values(rule).returning();
    return catRule;
  }

  async getCategoricalEligibilityRules(benefitProgramId: string): Promise<CategoricalEligibilityRule[]> {
    return await db
      .select()
      .from(categoricalEligibilityRules)
      .where(eq(categoricalEligibilityRules.benefitProgramId, benefitProgramId))
      .orderBy(desc(categoricalEligibilityRules.effectiveDate));
  }

  async updateCategoricalEligibilityRule(id: string, updates: Partial<CategoricalEligibilityRule>): Promise<CategoricalEligibilityRule> {
    const [rule] = await db
      .update(categoricalEligibilityRules)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(categoricalEligibilityRules.id, id))
      .returning();
    return rule;
  }

  // Rules as Code - Document Requirements
  async createDocumentRequirementRule(rule: InsertDocumentRequirementRule): Promise<DocumentRequirementRule> {
    const [docRule] = await db.insert(documentRequirementRules).values(rule).returning();
    return docRule;
  }

  async getDocumentRequirementRules(benefitProgramId: string): Promise<DocumentRequirementRule[]> {
    return await db
      .select()
      .from(documentRequirementRules)
      .where(eq(documentRequirementRules.benefitProgramId, benefitProgramId))
      .orderBy(desc(documentRequirementRules.effectiveDate));
  }

  async updateDocumentRequirementRule(id: string, updates: Partial<DocumentRequirementRule>): Promise<DocumentRequirementRule> {
    const [rule] = await db
      .update(documentRequirementRules)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(documentRequirementRules.id, id))
      .returning();
    return rule;
  }

  // Rules as Code - Eligibility Calculations
  async createEligibilityCalculation(calculation: InsertEligibilityCalculation): Promise<EligibilityCalculation> {
    const [calc] = await db.insert(eligibilityCalculations).values(calculation).returning();
    return calc;
  }

  async getEligibilityCalculations(userId?: string, limit: number = 50): Promise<EligibilityCalculation[]> {
    let query = db.select().from(eligibilityCalculations);
    
    if (userId) {
      query = query.where(eq(eligibilityCalculations.userId, userId));
    }
    
    return await query
      .orderBy(desc(eligibilityCalculations.calculatedAt))
      .limit(limit);
  }

  // Rules as Code - Client Cases
  async createClientCase(clientCase: InsertClientCase): Promise<ClientCase> {
    const [newCase] = await db.insert(clientCases).values(clientCase).returning();
    return newCase;
  }

  async getClientCases(navigatorId?: string, status?: string): Promise<ClientCase[]> {
    let query = db.select().from(clientCases);
    
    const conditions = [];
    if (navigatorId) {
      conditions.push(eq(clientCases.assignedNavigator, navigatorId));
    }
    if (status) {
      conditions.push(eq(clientCases.status, status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(clientCases.updatedAt));
  }

  async getClientCase(id: string): Promise<ClientCase | undefined> {
    const [clientCase] = await db.select().from(clientCases).where(eq(clientCases.id, id));
    return clientCase || undefined;
  }

  async updateClientCase(id: string, updates: Partial<ClientCase>): Promise<ClientCase> {
    const [clientCase] = await db
      .update(clientCases)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(clientCases.id, id))
      .returning();
    return clientCase;
  }

  // Rules as Code - Poverty Levels
  async createPovertyLevel(level: InsertPovertyLevel): Promise<PovertyLevel> {
    const [povertyLevel] = await db.insert(povertyLevels).values(level).returning();
    return povertyLevel;
  }

  async getPovertyLevels(year?: number): Promise<PovertyLevel[]> {
    let query = db.select().from(povertyLevels);
    
    if (year) {
      query = query.where(eq(povertyLevels.year, year));
    }
    
    return await query.orderBy(desc(povertyLevels.year), povertyLevels.householdSize);
  }

  // Policy Manual Sections
  async getManualSections(): Promise<any[]> {
    return await db.select().from(manualSections).orderBy(manualSections.sortOrder);
  }

  async getManualSection(id: string): Promise<any | undefined> {
    const [section] = await db.select().from(manualSections).where(eq(manualSections.id, id));
    return section || undefined;
  }

  async getSectionCrossReferences(sectionId: string): Promise<any[]> {
    return await db
      .select()
      .from(sectionCrossReferences)
      .where(eq(sectionCrossReferences.fromSectionId, sectionId));
  }

  async getSectionChunks(sectionId: string): Promise<any[]> {
    // First get the section to find its document ID
    const [section] = await db.select().from(manualSections).where(eq(manualSections.id, sectionId));
    if (!section || !section.documentId) {
      return [];
    }
    
    // Then get chunks for that document
    const chunks = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, section.documentId))
      .orderBy(documentChunks.chunkIndex);
    return chunks;
  }

  // Navigator Workspace - Client Interaction Sessions
  async createClientInteractionSession(session: InsertClientInteractionSession): Promise<ClientInteractionSession> {
    const [newSession] = await db.insert(clientInteractionSessions).values(session).returning();
    return newSession;
  }

  async getClientInteractionSessions(navigatorId?: string): Promise<ClientInteractionSession[]> {
    let query = db.select().from(clientInteractionSessions);
    
    if (navigatorId) {
      query = query.where(eq(clientInteractionSessions.navigatorId, navigatorId));
    }
    
    return await query.orderBy(desc(clientInteractionSessions.interactionDate));
  }

  async getUnexportedSessions(): Promise<ClientInteractionSession[]> {
    return await db
      .select()
      .from(clientInteractionSessions)
      .where(eq(clientInteractionSessions.exportedToEE, false))
      .orderBy(desc(clientInteractionSessions.interactionDate));
  }

  async markSessionsAsExported(sessionIds: string[], exportBatchId: string): Promise<void> {
    await db
      .update(clientInteractionSessions)
      .set({ 
        exportedToEE: true, 
        exportedAt: sql`NOW()`,
        exportBatchId 
      })
      .where(sql`${clientInteractionSessions.id} = ANY(${sessionIds})`);
  }

  async getSessionsByExportBatch(exportBatchId: string): Promise<ClientInteractionSession[]> {
    return await db
      .select()
      .from(clientInteractionSessions)
      .where(eq(clientInteractionSessions.exportBatchId, exportBatchId))
      .orderBy(desc(clientInteractionSessions.interactionDate));
  }

  // Navigator Workspace - E&E Export Batches
  async createEEExportBatch(batch: InsertEEExportBatch): Promise<EEExportBatch> {
    const [newBatch] = await db.insert(eeExportBatches).values(batch).returning();
    return newBatch;
  }

  async getEEExportBatches(): Promise<EEExportBatch[]> {
    return await db
      .select()
      .from(eeExportBatches)
      .orderBy(desc(eeExportBatches.exportedAt));
  }

  async getEEExportBatch(id: string): Promise<EEExportBatch | undefined> {
    const [batch] = await db.select().from(eeExportBatches).where(eq(eeExportBatches.id, id));
    return batch || undefined;
  }

  // Consent Management - Forms
  async createConsentForm(form: InsertConsentForm): Promise<ConsentForm> {
    const [newForm] = await db.insert(consentForms).values(form).returning();
    return newForm;
  }

  async getConsentForms(): Promise<ConsentForm[]> {
    return await db
      .select()
      .from(consentForms)
      .orderBy(desc(consentForms.createdAt));
  }

  async getConsentForm(id: string): Promise<ConsentForm | undefined> {
    const [form] = await db.select().from(consentForms).where(eq(consentForms.id, id));
    return form || undefined;
  }

  // Consent Management - Client Consents
  async createClientConsent(consent: InsertClientConsent): Promise<ClientConsent> {
    const [newConsent] = await db.insert(clientConsents).values(consent).returning();
    return newConsent;
  }

  async getClientConsents(clientCaseId?: string): Promise<ClientConsent[]> {
    let query = db.select().from(clientConsents);
    
    if (clientCaseId) {
      query = query.where(eq(clientConsents.clientCaseId, clientCaseId));
    }
    
    return await query.orderBy(desc(clientConsents.consentDate));
  }

  // Policy Change Monitoring
  async createPolicyChange(change: InsertPolicyChange): Promise<PolicyChange> {
    const [newChange] = await db.insert(policyChanges).values(change).returning();
    return newChange;
  }

  async getPolicyChanges(filters?: { benefitProgramId?: string; status?: string; limit?: number }): Promise<PolicyChange[]> {
    let query = db.select().from(policyChanges);
    
    const conditions = [];
    if (filters?.benefitProgramId) {
      conditions.push(eq(policyChanges.benefitProgramId, filters.benefitProgramId));
    }
    if (filters?.status) {
      conditions.push(eq(policyChanges.status, filters.status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(policyChanges.effectiveDate));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    return await query;
  }

  async getPolicyChange(id: string): Promise<PolicyChange | undefined> {
    const [change] = await db.select().from(policyChanges).where(eq(policyChanges.id, id));
    return change;
  }

  async updatePolicyChange(id: string, updates: Partial<PolicyChange>): Promise<PolicyChange> {
    const [updated] = await db
      .update(policyChanges)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(policyChanges.id, id))
      .returning();
    return updated;
  }

  async createPolicyChangeImpact(impact: InsertPolicyChangeImpact): Promise<PolicyChangeImpact> {
    const [newImpact] = await db.insert(policyChangeImpacts).values(impact).returning();
    return newImpact;
  }

  async getPolicyChangeImpact(id: string): Promise<PolicyChangeImpact | undefined> {
    const [impact] = await db.select().from(policyChangeImpacts).where(eq(policyChangeImpacts.id, id));
    return impact;
  }

  async getPolicyChangeImpacts(policyChangeId: string): Promise<PolicyChangeImpact[]> {
    return await db
      .select()
      .from(policyChangeImpacts)
      .where(eq(policyChangeImpacts.policyChangeId, policyChangeId))
      .orderBy(desc(policyChangeImpacts.impactSeverity));
  }

  async getUserPolicyChangeImpacts(userId: string, unresolved?: boolean): Promise<PolicyChangeImpact[]> {
    let query = db
      .select()
      .from(policyChangeImpacts)
      .where(eq(policyChangeImpacts.affectedUserId, userId));
    
    if (unresolved) {
      query = query.where(eq(policyChangeImpacts.resolved, false));
    }
    
    return await query.orderBy(desc(policyChangeImpacts.createdAt));
  }

  async updatePolicyChangeImpact(id: string, updates: Partial<PolicyChangeImpact>): Promise<PolicyChangeImpact> {
    const [updated] = await db
      .update(policyChangeImpacts)
      .set(updates)
      .where(eq(policyChangeImpacts.id, id))
      .returning();
    return updated;
  }

  // Compliance Assurance Suite
  async createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule> {
    const [newRule] = await db.insert(complianceRules).values(rule).returning();
    return newRule;
  }

  async getComplianceRules(filters?: { 
    ruleType?: string; 
    category?: string; 
    benefitProgramId?: string; 
    isActive?: boolean 
  }): Promise<ComplianceRule[]> {
    let query = db.select().from(complianceRules);
    
    const conditions = [];
    if (filters?.ruleType) {
      conditions.push(eq(complianceRules.ruleType, filters.ruleType));
    }
    if (filters?.category) {
      conditions.push(eq(complianceRules.category, filters.category));
    }
    if (filters?.benefitProgramId) {
      conditions.push(eq(complianceRules.benefitProgramId, filters.benefitProgramId));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(complianceRules.isActive, filters.isActive));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Order by severity (critical > high > medium > low) then by creation date
    return await query.orderBy(
      sql`CASE ${complianceRules.severityLevel} WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`,
      desc(complianceRules.createdAt)
    );
  }

  async getComplianceRule(id: string): Promise<ComplianceRule | undefined> {
    const [rule] = await db.select().from(complianceRules).where(eq(complianceRules.id, id));
    return rule;
  }

  async getComplianceRuleByCode(ruleCode: string): Promise<ComplianceRule | undefined> {
    const [rule] = await db.select().from(complianceRules).where(eq(complianceRules.ruleCode, ruleCode));
    return rule;
  }

  async updateComplianceRule(id: string, updates: Partial<ComplianceRule>): Promise<ComplianceRule> {
    const [updated] = await db
      .update(complianceRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(complianceRules.id, id))
      .returning();
    return updated;
  }

  async deleteComplianceRule(id: string): Promise<void> {
    await db.delete(complianceRules).where(eq(complianceRules.id, id));
  }

  async createComplianceViolation(violation: InsertComplianceViolation): Promise<ComplianceViolation> {
    const [newViolation] = await db.insert(complianceViolations).values(violation).returning();
    return newViolation;
  }

  async getComplianceViolations(filters?: { 
    complianceRuleId?: string; 
    status?: string; 
    severity?: string;
    entityType?: string;
  }): Promise<ComplianceViolation[]> {
    let query = db.select().from(complianceViolations);
    
    const conditions = [];
    if (filters?.complianceRuleId) {
      conditions.push(eq(complianceViolations.complianceRuleId, filters.complianceRuleId));
    }
    if (filters?.status) {
      conditions.push(eq(complianceViolations.status, filters.status));
    }
    if (filters?.severity) {
      conditions.push(eq(complianceViolations.severity, filters.severity));
    }
    if (filters?.entityType) {
      conditions.push(eq(complianceViolations.entityType, filters.entityType));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Order by severity (critical > high > medium > low) then by detection date
    return await query.orderBy(
      sql`CASE ${complianceViolations.severity} WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`,
      desc(complianceViolations.detectedAt)
    );
  }

  async getComplianceViolation(id: string): Promise<ComplianceViolation | undefined> {
    const [violation] = await db.select().from(complianceViolations).where(eq(complianceViolations.id, id));
    return violation;
  }

  async updateComplianceViolation(id: string, updates: Partial<ComplianceViolation>): Promise<ComplianceViolation> {
    const [updated] = await db
      .update(complianceViolations)
      .set(updates)
      .where(eq(complianceViolations.id, id))
      .returning();
    return updated;
  }

  async deleteComplianceViolation(id: string): Promise<void> {
    await db.delete(complianceViolations).where(eq(complianceViolations.id, id));
  }

  // Adaptive Intake Copilot - Sessions
  async createIntakeSession(session: InsertIntakeSession): Promise<IntakeSession> {
    const [newSession] = await db.insert(intakeSessions).values(session).returning();
    return newSession;
  }

  async getIntakeSession(id: string): Promise<IntakeSession | undefined> {
    const [session] = await db.select().from(intakeSessions).where(eq(intakeSessions.id, id));
    return session;
  }

  async getIntakeSessions(filters?: { userId?: string; status?: string; limit?: number }): Promise<IntakeSession[]> {
    let query = db.select().from(intakeSessions);
    
    const conditions = [];
    if (filters?.userId) {
      conditions.push(eq(intakeSessions.userId, filters.userId));
    }
    if (filters?.status) {
      conditions.push(eq(intakeSessions.status, filters.status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(intakeSessions.updatedAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    return await query;
  }

  async updateIntakeSession(id: string, updates: Partial<IntakeSession>): Promise<IntakeSession> {
    const [updated] = await db
      .update(intakeSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(intakeSessions.id, id))
      .returning();
    return updated;
  }

  // Adaptive Intake Copilot - Messages
  async createIntakeMessage(message: InsertIntakeMessage): Promise<IntakeMessage> {
    const [newMessage] = await db.insert(intakeMessages).values(message).returning();
    
    // Update session message count and last message time
    await db
      .update(intakeSessions)
      .set({
        messageCount: sql`${intakeSessions.messageCount} + 1`,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(intakeSessions.id, message.sessionId));
    
    return newMessage;
  }

  async getIntakeMessages(sessionId: string): Promise<IntakeMessage[]> {
    return await db
      .select()
      .from(intakeMessages)
      .where(eq(intakeMessages.sessionId, sessionId))
      .orderBy(intakeMessages.createdAt);
  }

  // Adaptive Intake Copilot - Application Forms
  async createApplicationForm(form: InsertApplicationForm): Promise<ApplicationForm> {
    const [newForm] = await db.insert(applicationForms).values(form).returning();
    return newForm;
  }

  async getApplicationForm(id: string): Promise<ApplicationForm | undefined> {
    const [form] = await db.select().from(applicationForms).where(eq(applicationForms.id, id));
    return form;
  }

  async getApplicationFormBySession(sessionId: string): Promise<ApplicationForm | undefined> {
    const [form] = await db.select().from(applicationForms).where(eq(applicationForms.sessionId, sessionId));
    return form;
  }

  async updateApplicationForm(id: string, updates: Partial<ApplicationForm>): Promise<ApplicationForm> {
    const [updated] = await db
      .update(applicationForms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(applicationForms.id, id))
      .returning();
    return updated;
  }

  async getApplicationForms(filters?: { userId?: string; exportStatus?: string; limit?: number }): Promise<ApplicationForm[]> {
    let query = db.select().from(applicationForms);
    
    const conditions = [];
    if (filters?.userId) {
      conditions.push(eq(applicationForms.userId, filters.userId));
    }
    if (filters?.exportStatus) {
      conditions.push(eq(applicationForms.exportStatus, filters.exportStatus));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(applicationForms.updatedAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    return await query;
  }

  // Anonymous Screening Sessions
  async createAnonymousScreeningSession(session: InsertAnonymousScreeningSession): Promise<AnonymousScreeningSession> {
    const [newSession] = await db.insert(anonymousScreeningSessions).values(session).returning();
    return newSession;
  }

  async getAnonymousScreeningSession(sessionId: string): Promise<AnonymousScreeningSession | undefined> {
    const [session] = await db
      .select()
      .from(anonymousScreeningSessions)
      .where(eq(anonymousScreeningSessions.sessionId, sessionId));
    return session;
  }

  async getAnonymousScreeningSessionsByUser(userId: string): Promise<AnonymousScreeningSession[]> {
    return await db
      .select()
      .from(anonymousScreeningSessions)
      .where(eq(anonymousScreeningSessions.userId, userId))
      .orderBy(desc(anonymousScreeningSessions.createdAt));
  }

  async updateAnonymousScreeningSession(id: string, updates: Partial<AnonymousScreeningSession>): Promise<AnonymousScreeningSession> {
    const [updated] = await db
      .update(anonymousScreeningSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(anonymousScreeningSessions.id, id))
      .returning();
    return updated;
  }

  async claimAnonymousScreeningSession(sessionId: string, userId: string): Promise<AnonymousScreeningSession> {
    const [updated] = await db
      .update(anonymousScreeningSessions)
      .set({ 
        userId, 
        claimedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(anonymousScreeningSessions.sessionId, sessionId))
      .returning();
    return updated;
  }

  async deleteOldAnonymousSessions(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await db
      .delete(anonymousScreeningSessions)
      .where(
        and(
          lte(anonymousScreeningSessions.createdAt, cutoffDate),
          isNull(anonymousScreeningSessions.userId) // Only delete unclaimed sessions
        )
      );
    
    return result.rowCount || 0;
  }
}

export const storage = new DatabaseStorage();
