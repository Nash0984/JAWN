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
  qcErrorPatterns,
  flaggedCases,
  jobAids,
  trainingInterventions,
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
  type QcErrorPattern,
  type InsertQcErrorPattern,
  type FlaggedCase,
  type InsertFlaggedCase,
  type JobAid,
  type InsertJobAid,
  type TrainingIntervention,
  type InsertTrainingIntervention,
  clientInteractionSessions,
  type ClientInteractionSession,
  type InsertClientInteractionSession,
  eeExportBatches,
  type EEExportBatch,
  type InsertEEExportBatch,
  clientVerificationDocuments,
  type ClientVerificationDocument,
  type InsertClientVerificationDocument,
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
  householdScenarios,
  type HouseholdScenario,
  type InsertHouseholdScenario,
  scenarioCalculations,
  type ScenarioCalculation,
  type InsertScenarioCalculation,
  scenarioComparisons,
  type ScenarioComparison,
  type InsertScenarioComparison,
  policyEngineVerifications,
  type PolicyEngineVerification,
  type InsertPolicyEngineVerification,
  evaluationTestCases,
  type EvaluationTestCase,
  type InsertEvaluationTestCase,
  evaluationRuns,
  type EvaluationRun,
  type InsertEvaluationRun,
  evaluationResults,
  type EvaluationResult,
  type InsertEvaluationResult,
  abawdExemptionVerifications,
  type AbawdExemptionVerification,
  type InsertAbawdExemptionVerification,
  programEnrollments,
  type ProgramEnrollment,
  type InsertProgramEnrollment,
  eeDatasets,
  type EeDataset,
  type InsertEeDataset,
  federalTaxReturns,
  type FederalTaxReturn,
  type InsertFederalTaxReturn,
  marylandTaxReturns,
  type MarylandTaxReturn,
  type InsertMarylandTaxReturn,
  taxDocuments,
  type TaxDocument,
  type InsertTaxDocument,
  eeDatasetFiles,
  type EeDatasetFile,
  type InsertEeDatasetFile,
  eeClients,
  type EeClient,
  type InsertEeClient,
  crossEnrollmentOpportunities,
  type CrossEnrollmentOpportunity,
  type InsertCrossEnrollmentOpportunity,
  crossEnrollmentAuditEvents,
  type CrossEnrollmentAuditEvent,
  type InsertCrossEnrollmentAuditEvent,
  counties,
  type County,
  type InsertCounty,
  countyUsers,
  type CountyUser,
  type InsertCountyUser,
  countyMetrics,
  type CountyMetric,
  type InsertCountyMetric,
  tenants,
  type Tenant,
  type InsertTenant,
  tenantBranding,
  type TenantBranding,
  type InsertTenantBranding,
  navigatorKpis,
  type NavigatorKpi,
  type InsertNavigatorKpi,
  achievements,
  type Achievement,
  type InsertAchievement,
  navigatorAchievements,
  type NavigatorAchievement,
  type InsertNavigatorAchievement,
  leaderboards,
  type Leaderboard,
  type InsertLeaderboard,
  caseActivityEvents,
  type CaseActivityEvent,
  type InsertCaseActivityEvent,
  householdProfiles,
  type HouseholdProfile,
  type InsertHouseholdProfile,
  vitaIntakeSessions,
  type VitaIntakeSession,
  type InsertVitaIntakeSession,
  auditLogs,
  type AuditLog,
  type InsertAuditLog,
  securityEvents,
  type SecurityEvent,
  type InsertSecurityEvent,
  webhooks,
  type Webhook,
  type InsertWebhook,
  webhookDeliveryLogs,
  type WebhookDeliveryLog,
  type InsertWebhookDeliveryLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, sql, or, isNull, lte, gte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(filters?: { role?: string; countyId?: string }): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;

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
  getEligibilityCalculation(id: string): Promise<EligibilityCalculation | undefined>;
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
  getClientInteractionSessionsByIds(sessionIds: string[]): Promise<ClientInteractionSession[]>;
  getUnexportedSessions(): Promise<ClientInteractionSession[]>;
  markSessionsAsExported(sessionIds: string[], exportBatchId: string): Promise<void>;
  getSessionsByExportBatch(exportBatchId: string): Promise<ClientInteractionSession[]>;

  // Navigator Workspace - E&E Export Batches
  createEEExportBatch(batch: InsertEEExportBatch): Promise<EEExportBatch>;
  getEEExportBatches(): Promise<EEExportBatch[]>;
  getEEExportBatch(id: string): Promise<EEExportBatch | undefined>;

  // Navigator Workspace - Client Verification Documents
  createClientVerificationDocument(doc: InsertClientVerificationDocument): Promise<ClientVerificationDocument>;
  getClientVerificationDocument(id: string): Promise<ClientVerificationDocument | undefined>;
  getClientVerificationDocuments(filters?: { sessionId?: string; clientCaseId?: string; verificationStatus?: string }): Promise<ClientVerificationDocument[]>;
  updateClientVerificationDocument(id: string, updates: Partial<ClientVerificationDocument>): Promise<ClientVerificationDocument>;
  deleteClientVerificationDocument(id: string): Promise<void>;

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

  // Household Scenarios
  createHouseholdScenario(scenario: InsertHouseholdScenario): Promise<HouseholdScenario>;
  getHouseholdScenario(id: string): Promise<HouseholdScenario | undefined>;
  getHouseholdScenariosByUser(userId: string): Promise<HouseholdScenario[]>;
  updateHouseholdScenario(id: string, updates: Partial<HouseholdScenario>): Promise<HouseholdScenario>;
  deleteHouseholdScenario(id: string): Promise<void>;

  // Scenario Calculations
  createScenarioCalculation(calculation: InsertScenarioCalculation): Promise<ScenarioCalculation>;
  getScenarioCalculation(id: string): Promise<ScenarioCalculation | undefined>;
  getScenarioCalculationsByScenario(scenarioId: string): Promise<ScenarioCalculation[]>;
  getLatestScenarioCalculation(scenarioId: string): Promise<ScenarioCalculation | undefined>;

  // Scenario Comparisons
  createScenarioComparison(comparison: InsertScenarioComparison): Promise<ScenarioComparison>;
  getScenarioComparison(id: string): Promise<ScenarioComparison | undefined>;
  getScenarioComparisonsByUser(userId: string): Promise<ScenarioComparison[]>;
  updateScenarioComparison(id: string, updates: Partial<ScenarioComparison>): Promise<ScenarioComparison>;
  deleteScenarioComparison(id: string): Promise<void>;

  // PolicyEngine Verifications
  createPolicyEngineVerification(verification: InsertPolicyEngineVerification): Promise<PolicyEngineVerification>;
  getPolicyEngineVerification(id: string): Promise<PolicyEngineVerification | undefined>;
  getPolicyEngineVerificationsByProgram(benefitProgramId: string): Promise<PolicyEngineVerification[]>;
  getPolicyEngineVerificationsBySession(sessionId: string): Promise<PolicyEngineVerification[]>;

  // Maryland Evaluation Framework
  createEvaluationTestCase(testCase: InsertEvaluationTestCase): Promise<EvaluationTestCase>;
  getEvaluationTestCase(id: string): Promise<EvaluationTestCase | undefined>;
  getEvaluationTestCases(filters?: { program?: string; category?: string; isActive?: boolean }): Promise<EvaluationTestCase[]>;
  updateEvaluationTestCase(id: string, updates: Partial<EvaluationTestCase>): Promise<EvaluationTestCase>;
  deleteEvaluationTestCase(id: string): Promise<void>;

  // ABAWD Exemption Verification
  createAbawdExemptionVerification(verification: InsertAbawdExemptionVerification): Promise<AbawdExemptionVerification>;
  getAbawdExemptionVerification(id: string): Promise<AbawdExemptionVerification | undefined>;
  getAbawdExemptionVerifications(filters?: { 
    clientCaseId?: string; 
    exemptionStatus?: string; 
    exemptionType?: string; 
    verifiedBy?: string;
  }): Promise<AbawdExemptionVerification[]>;
  updateAbawdExemptionVerification(id: string, updates: Partial<AbawdExemptionVerification>): Promise<AbawdExemptionVerification>;
  deleteAbawdExemptionVerification(id: string): Promise<void>;

  // Cross-Enrollment Analysis
  createProgramEnrollment(enrollment: InsertProgramEnrollment): Promise<ProgramEnrollment>;
  getProgramEnrollment(id: string): Promise<ProgramEnrollment | undefined>;
  getProgramEnrollments(filters?: {
    clientIdentifier?: string;
    benefitProgramId?: string;
    enrollmentStatus?: string;
    isEligibleForOtherPrograms?: boolean;
  }): Promise<ProgramEnrollment[]>;
  getProgramEnrollmentsByClient(clientIdentifier: string): Promise<ProgramEnrollment[]>;
  updateProgramEnrollment(id: string, updates: Partial<ProgramEnrollment>): Promise<ProgramEnrollment>;
  analyzeCrossEnrollmentOpportunities(clientIdentifier: string): Promise<{ 
    enrolledPrograms: ProgramEnrollment[]; 
    suggestedPrograms: { programId: string; programName: string; reason: string }[];
  }>;

  createEvaluationRun(run: InsertEvaluationRun): Promise<EvaluationRun>;
  getEvaluationRun(id: string): Promise<EvaluationRun | undefined>;
  getEvaluationRuns(filters?: { program?: string; status?: string; limit?: number }): Promise<EvaluationRun[]>;
  updateEvaluationRun(id: string, updates: Partial<EvaluationRun>): Promise<EvaluationRun>;

  createEvaluationResult(result: InsertEvaluationResult): Promise<EvaluationResult>;
  getEvaluationResult(id: string): Promise<EvaluationResult | undefined>;
  getEvaluationResultsByRun(runId: string): Promise<EvaluationResult[]>;
  getEvaluationResultsByTestCase(testCaseId: string): Promise<EvaluationResult[]>;

  // Tax Preparation - Federal Returns
  createFederalTaxReturn(taxReturn: InsertFederalTaxReturn): Promise<FederalTaxReturn>;
  getFederalTaxReturn(id: string): Promise<FederalTaxReturn | undefined>;
  getFederalTaxReturns(filters?: { scenarioId?: string; preparerId?: string; taxYear?: number; efileStatus?: string }): Promise<FederalTaxReturn[]>;
  getFederalTaxReturnsByScenario(scenarioId: string): Promise<FederalTaxReturn[]>;
  getFederalTaxReturnsByPreparer(preparerId: string, taxYear?: number): Promise<FederalTaxReturn[]>;
  updateFederalTaxReturn(id: string, updates: Partial<FederalTaxReturn>): Promise<FederalTaxReturn>;
  deleteFederalTaxReturn(id: string): Promise<void>;

  // Tax Preparation - Maryland Returns
  createMarylandTaxReturn(taxReturn: InsertMarylandTaxReturn): Promise<MarylandTaxReturn>;
  getMarylandTaxReturn(id: string): Promise<MarylandTaxReturn | undefined>;
  getMarylandTaxReturnByFederalId(federalReturnId: string): Promise<MarylandTaxReturn | undefined>;
  updateMarylandTaxReturn(id: string, updates: Partial<MarylandTaxReturn>): Promise<MarylandTaxReturn>;
  deleteMarylandTaxReturn(id: string): Promise<void>;

  // Tax Preparation - Tax Documents
  createTaxDocument(taxDoc: InsertTaxDocument): Promise<TaxDocument>;
  getTaxDocument(id: string): Promise<TaxDocument | undefined>;
  getTaxDocuments(filters?: { scenarioId?: string; federalReturnId?: string; vitaSessionId?: string; documentType?: string; verificationStatus?: string }): Promise<TaxDocument[]>;
  getTaxDocumentsByScenario(scenarioId: string): Promise<TaxDocument[]>;
  getTaxDocumentsByFederalReturn(federalReturnId: string): Promise<TaxDocument[]>;
  updateTaxDocument(id: string, updates: Partial<TaxDocument>): Promise<TaxDocument>;
  deleteTaxDocument(id: string): Promise<void>;

  // E&E Cross-Enrollment - Datasets
  createEeDataset(dataset: InsertEeDataset): Promise<EeDataset>;
  getEeDataset(id: string): Promise<EeDataset | undefined>;
  getEeDatasets(filters?: { dataSource?: string; isActive?: boolean; processingStatus?: string }): Promise<EeDataset[]>;
  updateEeDataset(id: string, updates: Partial<EeDataset>): Promise<EeDataset>;
  deleteEeDataset(id: string): Promise<void>;

  // E&E Cross-Enrollment - Dataset Files
  createEeDatasetFile(file: InsertEeDatasetFile): Promise<EeDatasetFile>;
  getEeDatasetFile(id: string): Promise<EeDatasetFile | undefined>;
  getEeDatasetFiles(datasetId: string): Promise<EeDatasetFile[]>;
  deleteEeDatasetFile(id: string): Promise<void>;

  // E&E Cross-Enrollment - Clients
  createEeClient(client: InsertEeClient): Promise<EeClient>;
  getEeClient(id: string): Promise<EeClient | undefined>;
  getEeClients(filters?: { datasetId?: string; matchStatus?: string; enrolledProgramId?: string }): Promise<EeClient[]>;
  updateEeClient(id: string, updates: Partial<EeClient>): Promise<EeClient>;
  deleteEeClient(id: string): Promise<void>;

  // E&E Cross-Enrollment - Opportunities
  createCrossEnrollmentOpportunity(opportunity: InsertCrossEnrollmentOpportunity): Promise<CrossEnrollmentOpportunity>;
  getCrossEnrollmentOpportunity(id: string): Promise<CrossEnrollmentOpportunity | undefined>;
  getCrossEnrollmentOpportunities(filters?: { 
    eeClientId?: string; 
    clientCaseId?: string; 
    outreachStatus?: string;
    priority?: string;
    targetProgramId?: string;
  }): Promise<CrossEnrollmentOpportunity[]>;
  updateCrossEnrollmentOpportunity(id: string, updates: Partial<CrossEnrollmentOpportunity>): Promise<CrossEnrollmentOpportunity>;
  deleteCrossEnrollmentOpportunity(id: string): Promise<void>;

  // E&E Cross-Enrollment - Audit Events
  createCrossEnrollmentAuditEvent(event: InsertCrossEnrollmentAuditEvent): Promise<CrossEnrollmentAuditEvent>;
  getCrossEnrollmentAuditEvents(filters?: { 
    datasetId?: string; 
    opportunityId?: string; 
    eventType?: string;
    userId?: string;
  }): Promise<CrossEnrollmentAuditEvent[]>;

  // ============================================================================
  // Multi-County Deployment
  // ============================================================================
  
  // Counties
  createCounty(county: InsertCounty): Promise<County>;
  getCounty(id: string): Promise<County | undefined>;
  getCountyByCode(code: string): Promise<County | undefined>;
  getCounties(filters?: { isActive?: boolean; isPilot?: boolean; region?: string }): Promise<County[]>;
  updateCounty(id: string, updates: Partial<County>): Promise<County>;
  deleteCounty(id: string): Promise<void>;

  // County Users - User-County Assignments
  assignUserToCounty(assignment: InsertCountyUser): Promise<CountyUser>;
  getUserCounties(userId: string): Promise<CountyUser[]>;
  getCountyUsers(countyId: string, role?: string): Promise<CountyUser[]>;
  getPrimaryCounty(userId: string): Promise<County | undefined>;
  removeUserFromCounty(id: string): Promise<void>;
  updateCountyUserAssignment(id: string, updates: Partial<CountyUser>): Promise<CountyUser>;

  // County Metrics
  createCountyMetric(metric: InsertCountyMetric): Promise<CountyMetric>;
  getCountyMetrics(countyId: string, periodType?: string, limit?: number): Promise<CountyMetric[]>;
  getLatestCountyMetric(countyId: string, periodType: string): Promise<CountyMetric | undefined>;

  // Tenants - Multi-tenant system
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  getTenantByDomain(domain: string): Promise<Tenant | undefined>;
  getTenants(filters?: { type?: string; status?: string; parentTenantId?: string }): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant>;
  deleteTenant(id: string): Promise<void>;

  // Tenant Branding
  getTenantBranding(tenantId: string): Promise<TenantBranding | undefined>;
  createTenantBranding(branding: InsertTenantBranding): Promise<TenantBranding>;
  updateTenantBranding(tenantId: string, updates: Partial<TenantBranding>): Promise<TenantBranding>;
  deleteTenantBranding(tenantId: string): Promise<void>;

  // ============================================================================
  // Gamification & Navigator Performance
  // ============================================================================

  // Navigator KPIs
  createNavigatorKpi(kpi: InsertNavigatorKpi): Promise<NavigatorKpi>;
  getNavigatorKpi(id: string): Promise<NavigatorKpi | undefined>;
  getNavigatorKpis(navigatorId: string, periodType?: string, limit?: number): Promise<NavigatorKpi[]>;
  getLatestNavigatorKpi(navigatorId: string, periodType: string): Promise<NavigatorKpi | undefined>;
  updateNavigatorKpi(id: string, updates: Partial<NavigatorKpi>): Promise<NavigatorKpi>;

  // Achievements
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  getAchievement(id: string): Promise<Achievement | undefined>;
  getAchievements(filters?: { category?: string; tier?: string; isActive?: boolean }): Promise<Achievement[]>;
  updateAchievement(id: string, updates: Partial<Achievement>): Promise<Achievement>;
  deleteAchievement(id: string): Promise<void>;

  // Navigator Achievements
  awardAchievement(award: InsertNavigatorAchievement): Promise<NavigatorAchievement>;
  getNavigatorAchievements(navigatorId: string): Promise<NavigatorAchievement[]>;
  getUnnotifiedAchievements(navigatorId: string): Promise<NavigatorAchievement[]>;
  markAchievementNotified(id: string): Promise<void>;

  // Leaderboards
  createLeaderboard(leaderboard: InsertLeaderboard): Promise<Leaderboard>;
  getLeaderboard(id: string): Promise<Leaderboard | undefined>;
  getLeaderboards(filters: { leaderboardType: string; scope: string; periodType: string; countyId?: string }): Promise<Leaderboard[]>;
  updateLeaderboard(id: string, updates: Partial<Leaderboard>): Promise<Leaderboard>;

  // Case Activity Events
  createCaseActivityEvent(event: InsertCaseActivityEvent): Promise<CaseActivityEvent>;
  getCaseActivityEvents(navigatorId: string, eventType?: string, limit?: number): Promise<CaseActivityEvent[]>;
  getCaseEvents(caseId: string): Promise<CaseActivityEvent[]>;

  // Household Profiles
  createHouseholdProfile(profile: InsertHouseholdProfile): Promise<HouseholdProfile>;
  getHouseholdProfile(id: string): Promise<HouseholdProfile | undefined>;
  getHouseholdProfiles(userId: string, filters?: { profileMode?: string; clientCaseId?: string; isActive?: boolean }): Promise<HouseholdProfile[]>;
  updateHouseholdProfile(id: string, updates: Partial<HouseholdProfile>): Promise<HouseholdProfile>;
  deleteHouseholdProfile(id: string): Promise<void>;
  
  // VITA Intake Sessions
  createVitaIntakeSession(session: InsertVitaIntakeSession): Promise<VitaIntakeSession>;
  getVitaIntakeSession(id: string): Promise<VitaIntakeSession | undefined>;
  getVitaIntakeSessions(userId: string, filters?: { status?: string; clientCaseId?: string; reviewStatus?: string }): Promise<VitaIntakeSession[]>;
  updateVitaIntakeSession(id: string, updates: Partial<VitaIntakeSession>): Promise<VitaIntakeSession>;
  deleteVitaIntakeSession(id: string): Promise<void>;

  // ============================================================================
  // Audit Logging & Security Monitoring
  // ============================================================================

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLog(id: string): Promise<AuditLog | undefined>;
  getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    sensitiveDataAccessed?: boolean;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLog[]>;

  // Security Events
  createSecurityEvent(event: InsertSecurityEvent): Promise<SecurityEvent>;
  getSecurityEvent(id: string): Promise<SecurityEvent | undefined>;
  getSecurityEvents(filters?: {
    eventType?: string;
    severity?: string;
    userId?: string;
    ipAddress?: string;
    reviewed?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SecurityEvent[]>;
  updateSecurityEvent(id: string, updates: Partial<SecurityEvent>): Promise<SecurityEvent>;

  // ============================================================================
  // QC Analytics - Maryland SNAP Predictive Analytics
  // ============================================================================

  // QC Error Patterns
  createQcErrorPattern(pattern: InsertQcErrorPattern): Promise<QcErrorPattern>;
  getQcErrorPatterns(filters?: { errorCategory?: string; quarterOccurred?: string; severity?: string }): Promise<QcErrorPattern[]>;
  
  // Flagged Cases
  createFlaggedCase(flaggedCase: InsertFlaggedCase): Promise<FlaggedCase>;
  getFlaggedCase(id: string): Promise<FlaggedCase | undefined>;
  getFlaggedCasesByCaseworker(caseworkerId: string): Promise<FlaggedCase[]>;
  getFlaggedCasesForSupervisor(supervisorId: string): Promise<FlaggedCase[]>;
  updateFlaggedCaseStatus(caseId: string, status: string, reviewedBy?: string, reviewNotes?: string): Promise<FlaggedCase>;
  assignFlaggedCase(caseId: string, assignedCaseworkerId: string, reviewedBy: string, reviewNotes?: string): Promise<FlaggedCase>;
  
  // Job Aids
  createJobAid(jobAid: InsertJobAid): Promise<JobAid>;
  getJobAid(id: string): Promise<JobAid | undefined>;
  getJobAids(filters?: { category?: string }): Promise<JobAid[]>;
  getJobAidsByCategory(category: string): Promise<JobAid[]>;
  
  // Training Interventions
  createTrainingIntervention(intervention: InsertTrainingIntervention): Promise<TrainingIntervention>;
  getTrainingIntervention(id: string): Promise<TrainingIntervention | undefined>;
  getTrainingInterventions(filters?: { targetErrorCategory?: string }): Promise<TrainingIntervention[]>;

  // ============================================================================
  // Webhooks - Event notification system
  // ============================================================================

  // Webhooks
  createWebhook(webhook: InsertWebhook): Promise<Webhook>;
  getWebhook(id: string): Promise<Webhook | undefined>;
  getWebhooks(filters?: { tenantId?: string; apiKeyId?: string; status?: string }): Promise<Webhook[]>;
  updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook>;
  deleteWebhook(id: string): Promise<void>;

  // Webhook Delivery Logs
  createWebhookDeliveryLog(log: InsertWebhookDeliveryLog): Promise<WebhookDeliveryLog>;
  getWebhookDeliveryLogs(webhookId: string, limit?: number): Promise<WebhookDeliveryLog[]>;
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

  async getUsers(filters?: { role?: string; countyId?: string }): Promise<User[]> {
    let query = db.select().from(users);
    
    const conditions = [];
    if (filters?.role) {
      conditions.push(eq(users.role, filters.role));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(users.fullName);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
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

  async getEligibilityCalculation(id: string): Promise<EligibilityCalculation | undefined> {
    const [calc] = await db.select().from(eligibilityCalculations).where(eq(eligibilityCalculations.id, id));
    return calc || undefined;
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

  async getClientInteractionSessionsByIds(sessionIds: string[]): Promise<ClientInteractionSession[]> {
    if (sessionIds.length === 0) {
      return [];
    }
    
    return await db
      .select()
      .from(clientInteractionSessions)
      .where(inArray(clientInteractionSessions.id, sessionIds))
      .orderBy(desc(clientInteractionSessions.interactionDate));
  }

  async getUnexportedSessions(): Promise<ClientInteractionSession[]> {
    return await db
      .select()
      .from(clientInteractionSessions)
      .where(eq(clientInteractionSessions.exportedToEE, false))
      .orderBy(desc(clientInteractionSessions.interactionDate));
  }

  async markSessionsAsExported(sessionIds: string[], exportBatchId: string): Promise<void> {
    if (sessionIds.length === 0) {
      return;
    }
    
    await db
      .update(clientInteractionSessions)
      .set({ 
        exportedToEE: true, 
        exportedAt: sql`NOW()`,
        exportBatchId 
      })
      .where(inArray(clientInteractionSessions.id, sessionIds));
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

  // Navigator Workspace - Client Verification Documents
  async createClientVerificationDocument(doc: InsertClientVerificationDocument): Promise<ClientVerificationDocument> {
    const [newDoc] = await db.insert(clientVerificationDocuments).values(doc).returning();
    return newDoc;
  }

  async getClientVerificationDocument(id: string): Promise<ClientVerificationDocument | undefined> {
    const [doc] = await db.select().from(clientVerificationDocuments).where(eq(clientVerificationDocuments.id, id));
    return doc || undefined;
  }

  async getClientVerificationDocuments(filters?: { sessionId?: string; clientCaseId?: string; verificationStatus?: string }): Promise<ClientVerificationDocument[]> {
    const conditions = [];
    
    if (filters?.sessionId) {
      conditions.push(eq(clientVerificationDocuments.sessionId, filters.sessionId));
    }
    
    if (filters?.clientCaseId) {
      conditions.push(eq(clientVerificationDocuments.clientCaseId, filters.clientCaseId));
    }
    
    if (filters?.verificationStatus) {
      conditions.push(eq(clientVerificationDocuments.verificationStatus, filters.verificationStatus));
    }
    
    let query = db.select().from(clientVerificationDocuments);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(clientVerificationDocuments.createdAt));
  }

  async updateClientVerificationDocument(id: string, updates: Partial<ClientVerificationDocument>): Promise<ClientVerificationDocument> {
    const [updated] = await db
      .update(clientVerificationDocuments)
      .set(updates)
      .where(eq(clientVerificationDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteClientVerificationDocument(id: string): Promise<void> {
    await db.delete(clientVerificationDocuments).where(eq(clientVerificationDocuments.id, id));
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

  // Household Scenarios
  async createHouseholdScenario(scenario: InsertHouseholdScenario): Promise<HouseholdScenario> {
    const [newScenario] = await db.insert(householdScenarios).values(scenario).returning();
    return newScenario;
  }

  async getHouseholdScenario(id: string): Promise<HouseholdScenario | undefined> {
    const [scenario] = await db
      .select()
      .from(householdScenarios)
      .where(eq(householdScenarios.id, id));
    return scenario;
  }

  async getHouseholdScenariosByUser(userId: string): Promise<HouseholdScenario[]> {
    return await db
      .select()
      .from(householdScenarios)
      .where(eq(householdScenarios.userId, userId))
      .orderBy(desc(householdScenarios.createdAt));
  }

  async updateHouseholdScenario(id: string, updates: Partial<HouseholdScenario>): Promise<HouseholdScenario> {
    const [updated] = await db
      .update(householdScenarios)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(householdScenarios.id, id))
      .returning();
    return updated;
  }

  async deleteHouseholdScenario(id: string): Promise<void> {
    await db.delete(householdScenarios).where(eq(householdScenarios.id, id));
  }

  // Scenario Calculations
  async createScenarioCalculation(calculation: InsertScenarioCalculation): Promise<ScenarioCalculation> {
    const [newCalculation] = await db.insert(scenarioCalculations).values(calculation).returning();
    return newCalculation;
  }

  async getScenarioCalculation(id: string): Promise<ScenarioCalculation | undefined> {
    const [calculation] = await db
      .select()
      .from(scenarioCalculations)
      .where(eq(scenarioCalculations.id, id));
    return calculation;
  }

  async getScenarioCalculationsByScenario(scenarioId: string): Promise<ScenarioCalculation[]> {
    return await db
      .select()
      .from(scenarioCalculations)
      .where(eq(scenarioCalculations.scenarioId, scenarioId))
      .orderBy(desc(scenarioCalculations.calculatedAt));
  }

  async getLatestScenarioCalculation(scenarioId: string): Promise<ScenarioCalculation | undefined> {
    const [calculation] = await db
      .select()
      .from(scenarioCalculations)
      .where(eq(scenarioCalculations.scenarioId, scenarioId))
      .orderBy(desc(scenarioCalculations.calculatedAt))
      .limit(1);
    return calculation;
  }

  // Scenario Comparisons
  async createScenarioComparison(comparison: InsertScenarioComparison): Promise<ScenarioComparison> {
    const [newComparison] = await db.insert(scenarioComparisons).values(comparison).returning();
    return newComparison;
  }

  async getScenarioComparison(id: string): Promise<ScenarioComparison | undefined> {
    const [comparison] = await db
      .select()
      .from(scenarioComparisons)
      .where(eq(scenarioComparisons.id, id));
    return comparison;
  }

  async getScenarioComparisonsByUser(userId: string): Promise<ScenarioComparison[]> {
    return await db
      .select()
      .from(scenarioComparisons)
      .where(eq(scenarioComparisons.userId, userId))
      .orderBy(desc(scenarioComparisons.createdAt));
  }

  async updateScenarioComparison(id: string, updates: Partial<ScenarioComparison>): Promise<ScenarioComparison> {
    const [updated] = await db
      .update(scenarioComparisons)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(scenarioComparisons.id, id))
      .returning();
    return updated;
  }

  async deleteScenarioComparison(id: string): Promise<void> {
    await db.delete(scenarioComparisons).where(eq(scenarioComparisons.id, id));
  }

  // PolicyEngine Verifications
  async createPolicyEngineVerification(verification: InsertPolicyEngineVerification): Promise<PolicyEngineVerification> {
    const [newVerification] = await db.insert(policyEngineVerifications).values(verification).returning();
    return newVerification;
  }

  async getPolicyEngineVerification(id: string): Promise<PolicyEngineVerification | undefined> {
    const [verification] = await db
      .select()
      .from(policyEngineVerifications)
      .where(eq(policyEngineVerifications.id, id));
    return verification;
  }

  async getPolicyEngineVerificationsByProgram(benefitProgramId: string): Promise<PolicyEngineVerification[]> {
    return await db
      .select()
      .from(policyEngineVerifications)
      .where(eq(policyEngineVerifications.benefitProgramId, benefitProgramId))
      .orderBy(desc(policyEngineVerifications.createdAt));
  }

  async getPolicyEngineVerificationsBySession(sessionId: string): Promise<PolicyEngineVerification[]> {
    return await db
      .select()
      .from(policyEngineVerifications)
      .where(eq(policyEngineVerifications.sessionId, sessionId))
      .orderBy(desc(policyEngineVerifications.createdAt));
  }

  // Maryland Evaluation Framework
  async createEvaluationTestCase(testCase: InsertEvaluationTestCase): Promise<EvaluationTestCase> {
    const [newTestCase] = await db.insert(evaluationTestCases).values(testCase).returning();
    return newTestCase;
  }

  async getEvaluationTestCase(id: string): Promise<EvaluationTestCase | undefined> {
    const [testCase] = await db
      .select()
      .from(evaluationTestCases)
      .where(eq(evaluationTestCases.id, id));
    return testCase;
  }

  async getEvaluationTestCases(filters?: { program?: string; category?: string; isActive?: boolean }): Promise<EvaluationTestCase[]> {
    let query = db.select().from(evaluationTestCases);

    const conditions = [];
    if (filters?.program) {
      conditions.push(eq(evaluationTestCases.program, filters.program));
    }
    if (filters?.category) {
      conditions.push(eq(evaluationTestCases.category, filters.category));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(evaluationTestCases.isActive, filters.isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(evaluationTestCases.createdAt));
  }

  async updateEvaluationTestCase(id: string, updates: Partial<EvaluationTestCase>): Promise<EvaluationTestCase> {
    const [updated] = await db
      .update(evaluationTestCases)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(evaluationTestCases.id, id))
      .returning();
    return updated;
  }

  async deleteEvaluationTestCase(id: string): Promise<void> {
    await db.delete(evaluationTestCases).where(eq(evaluationTestCases.id, id));
  }

  async createEvaluationRun(run: InsertEvaluationRun): Promise<EvaluationRun> {
    const [newRun] = await db.insert(evaluationRuns).values(run).returning();
    return newRun;
  }

  async getEvaluationRun(id: string): Promise<EvaluationRun | undefined> {
    const [run] = await db
      .select()
      .from(evaluationRuns)
      .where(eq(evaluationRuns.id, id));
    return run;
  }

  async getEvaluationRuns(filters?: { program?: string; status?: string; limit?: number }): Promise<EvaluationRun[]> {
    let query = db.select().from(evaluationRuns);

    const conditions = [];
    if (filters?.program) {
      conditions.push(eq(evaluationRuns.program, filters.program));
    }
    if (filters?.status) {
      conditions.push(eq(evaluationRuns.status, filters.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(evaluationRuns.startedAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }

  async updateEvaluationRun(id: string, updates: Partial<EvaluationRun>): Promise<EvaluationRun> {
    const [updated] = await db
      .update(evaluationRuns)
      .set(updates)
      .where(eq(evaluationRuns.id, id))
      .returning();
    return updated;
  }

  async createEvaluationResult(result: InsertEvaluationResult): Promise<EvaluationResult> {
    const [newResult] = await db.insert(evaluationResults).values(result).returning();
    return newResult;
  }

  async getEvaluationResult(id: string): Promise<EvaluationResult | undefined> {
    const [result] = await db
      .select()
      .from(evaluationResults)
      .where(eq(evaluationResults.id, id));
    return result;
  }

  async getEvaluationResultsByRun(runId: string): Promise<EvaluationResult[]> {
    return await db
      .select()
      .from(evaluationResults)
      .where(eq(evaluationResults.runId, runId))
      .orderBy(desc(evaluationResults.createdAt));
  }

  async getEvaluationResultsByTestCase(testCaseId: string): Promise<EvaluationResult[]> {
    return await db
      .select()
      .from(evaluationResults)
      .where(eq(evaluationResults.testCaseId, testCaseId))
      .orderBy(desc(evaluationResults.createdAt));
  }

  // ABAWD Exemption Verification
  async createAbawdExemptionVerification(verification: InsertAbawdExemptionVerification): Promise<AbawdExemptionVerification> {
    const [newVerification] = await db.insert(abawdExemptionVerifications).values(verification).returning();
    return newVerification;
  }

  async getAbawdExemptionVerification(id: string): Promise<AbawdExemptionVerification | undefined> {
    const [verification] = await db
      .select()
      .from(abawdExemptionVerifications)
      .where(eq(abawdExemptionVerifications.id, id));
    return verification;
  }

  async getAbawdExemptionVerifications(filters?: { 
    clientCaseId?: string; 
    exemptionStatus?: string; 
    exemptionType?: string; 
    verifiedBy?: string;
  }): Promise<AbawdExemptionVerification[]> {
    let query = db.select().from(abawdExemptionVerifications);

    const conditions = [];
    if (filters?.clientCaseId) {
      conditions.push(eq(abawdExemptionVerifications.clientCaseId, filters.clientCaseId));
    }
    if (filters?.exemptionStatus) {
      conditions.push(eq(abawdExemptionVerifications.exemptionStatus, filters.exemptionStatus));
    }
    if (filters?.exemptionType) {
      conditions.push(eq(abawdExemptionVerifications.exemptionType, filters.exemptionType));
    }
    if (filters?.verifiedBy) {
      conditions.push(eq(abawdExemptionVerifications.verifiedBy, filters.verifiedBy));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(abawdExemptionVerifications.createdAt));
  }

  async updateAbawdExemptionVerification(id: string, updates: Partial<AbawdExemptionVerification>): Promise<AbawdExemptionVerification> {
    const [updated] = await db
      .update(abawdExemptionVerifications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(abawdExemptionVerifications.id, id))
      .returning();
    return updated;
  }

  async deleteAbawdExemptionVerification(id: string): Promise<void> {
    await db.delete(abawdExemptionVerifications).where(eq(abawdExemptionVerifications.id, id));
  }

  // Cross-Enrollment Analysis
  async createProgramEnrollment(enrollment: InsertProgramEnrollment): Promise<ProgramEnrollment> {
    const [newEnrollment] = await db.insert(programEnrollments).values(enrollment).returning();
    return newEnrollment;
  }

  async getProgramEnrollment(id: string): Promise<ProgramEnrollment | undefined> {
    const [enrollment] = await db
      .select()
      .from(programEnrollments)
      .where(eq(programEnrollments.id, id));
    return enrollment;
  }

  async getProgramEnrollments(filters?: {
    clientIdentifier?: string;
    benefitProgramId?: string;
    enrollmentStatus?: string;
    isEligibleForOtherPrograms?: boolean;
  }): Promise<ProgramEnrollment[]> {
    let query = db.select().from(programEnrollments);

    const conditions = [];
    if (filters?.clientIdentifier) {
      conditions.push(eq(programEnrollments.clientIdentifier, filters.clientIdentifier));
    }
    if (filters?.benefitProgramId) {
      conditions.push(eq(programEnrollments.benefitProgramId, filters.benefitProgramId));
    }
    if (filters?.enrollmentStatus) {
      conditions.push(eq(programEnrollments.enrollmentStatus, filters.enrollmentStatus));
    }
    if (filters?.isEligibleForOtherPrograms !== undefined) {
      conditions.push(eq(programEnrollments.isEligibleForOtherPrograms, filters.isEligibleForOtherPrograms));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(programEnrollments.createdAt));
  }

  async getProgramEnrollmentsByClient(clientIdentifier: string): Promise<ProgramEnrollment[]> {
    return await db
      .select()
      .from(programEnrollments)
      .where(eq(programEnrollments.clientIdentifier, clientIdentifier))
      .orderBy(desc(programEnrollments.createdAt));
  }

  async updateProgramEnrollment(id: string, updates: Partial<ProgramEnrollment>): Promise<ProgramEnrollment> {
    const [updated] = await db
      .update(programEnrollments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(programEnrollments.id, id))
      .returning();
    return updated;
  }

  async analyzeCrossEnrollmentOpportunities(clientIdentifier: string): Promise<{ 
    enrolledPrograms: ProgramEnrollment[]; 
    suggestedPrograms: { programId: string; programName: string; reason: string }[];
  }> {
    // Get all enrollments for this client
    const enrolledPrograms = await this.getProgramEnrollmentsByClient(clientIdentifier);
    
    // Get all active benefit programs
    const allPrograms = await this.getBenefitPrograms();
    
    // Find programs client is NOT enrolled in
    const enrolledProgramIds = new Set(enrolledPrograms.map(e => e.benefitProgramId));
    const notEnrolledPrograms = allPrograms.filter(p => !enrolledProgramIds.has(p.id) && p.isActive);
    
    // Build suggestions based on household data from existing enrollments
    const suggestedPrograms: { programId: string; programName: string; reason: string }[] = [];
    
    if (enrolledPrograms.length > 0) {
      const sampleEnrollment = enrolledPrograms[0];
      const householdSize = sampleEnrollment.householdSize || 0;
      const householdIncome = sampleEnrollment.householdIncome || 0;
      
      for (const program of notEnrolledPrograms) {
        let reason = '';
        
        // SNAP eligibility logic
        if (program.code === 'MD_SNAP' && householdIncome < 200000) { // Rough SNAP threshold
          reason = 'Household income may qualify for food assistance';
        }
        // Medicaid eligibility logic
        else if (program.code === 'MD_MEDICAID' && householdIncome < 300000) { // Rough Medicaid threshold
          reason = 'Household income may qualify for health coverage';
        }
        // WIC eligibility (pregnant/infants/children)
        else if (program.code === 'MD_WIC' && householdSize > 0) {
          reason = 'Households with children may qualify for nutrition assistance';
        }
        // TANF eligibility
        else if (program.code === 'MD_TANF' && householdIncome < 150000) {
          reason = 'Household may qualify for temporary cash assistance';
        }
        // Energy assistance
        else if (program.code === 'MD_OHEP' && householdIncome < 250000) {
          reason = 'Household may qualify for energy bill assistance';
        }
        // Children's Health Program
        else if (program.code === 'MD_MCHP' && householdSize > 1) {
          reason = 'Children in household may qualify for health coverage';
        }
        // VITA tax assistance
        else if (program.code === 'VITA' && householdIncome < 600000) {
          reason = 'Free tax preparation available for lower-income households';
        }
        
        if (reason) {
          suggestedPrograms.push({
            programId: program.id,
            programName: program.name,
            reason
          });
        }
      }
    }
    
    return {
      enrolledPrograms,
      suggestedPrograms
    };
  }

  // E&E Cross-Enrollment - Datasets
  async createEeDataset(dataset: InsertEeDataset): Promise<EeDataset> {
    const [created] = await db.insert(eeDatasets).values(dataset).returning();
    return created;
  }

  async getEeDataset(id: string): Promise<EeDataset | undefined> {
    const [dataset] = await db.select().from(eeDatasets).where(eq(eeDatasets.id, id));
    return dataset || undefined;
  }

  async getEeDatasets(filters?: { dataSource?: string; isActive?: boolean; processingStatus?: string }): Promise<EeDataset[]> {
    let query = db.select().from(eeDatasets);
    
    const conditions = [];
    if (filters?.dataSource) {
      conditions.push(eq(eeDatasets.dataSource, filters.dataSource));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(eeDatasets.isActive, filters.isActive));
    }
    if (filters?.processingStatus) {
      conditions.push(eq(eeDatasets.processingStatus, filters.processingStatus));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(eeDatasets.createdAt));
  }

  async updateEeDataset(id: string, updates: Partial<EeDataset>): Promise<EeDataset> {
    const [updated] = await db
      .update(eeDatasets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(eeDatasets.id, id))
      .returning();
    return updated;
  }

  async deleteEeDataset(id: string): Promise<void> {
    await db.delete(eeDatasets).where(eq(eeDatasets.id, id));
  }

  // E&E Cross-Enrollment - Dataset Files
  async createEeDatasetFile(file: InsertEeDatasetFile): Promise<EeDatasetFile> {
    const [created] = await db.insert(eeDatasetFiles).values(file).returning();
    return created;
  }

  async getEeDatasetFile(id: string): Promise<EeDatasetFile | undefined> {
    const [file] = await db.select().from(eeDatasetFiles).where(eq(eeDatasetFiles.id, id));
    return file || undefined;
  }

  async getEeDatasetFiles(datasetId: string): Promise<EeDatasetFile[]> {
    return await db
      .select()
      .from(eeDatasetFiles)
      .where(eq(eeDatasetFiles.datasetId, datasetId))
      .orderBy(desc(eeDatasetFiles.createdAt));
  }

  async deleteEeDatasetFile(id: string): Promise<void> {
    await db.delete(eeDatasetFiles).where(eq(eeDatasetFiles.id, id));
  }

  // E&E Cross-Enrollment - Clients
  async createEeClient(client: InsertEeClient): Promise<EeClient> {
    const [created] = await db.insert(eeClients).values(client).returning();
    return created;
  }

  async getEeClient(id: string): Promise<EeClient | undefined> {
    const [client] = await db.select().from(eeClients).where(eq(eeClients.id, id));
    return client || undefined;
  }

  async getEeClients(filters?: { datasetId?: string; matchStatus?: string; enrolledProgramId?: string }): Promise<EeClient[]> {
    let query = db.select().from(eeClients);
    
    const conditions = [];
    if (filters?.datasetId) {
      conditions.push(eq(eeClients.datasetId, filters.datasetId));
    }
    if (filters?.matchStatus) {
      conditions.push(eq(eeClients.matchStatus, filters.matchStatus));
    }
    if (filters?.enrolledProgramId) {
      conditions.push(eq(eeClients.enrolledProgramId, filters.enrolledProgramId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(eeClients.createdAt));
  }

  async updateEeClient(id: string, updates: Partial<EeClient>): Promise<EeClient> {
    const [updated] = await db
      .update(eeClients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(eeClients.id, id))
      .returning();
    return updated;
  }

  async deleteEeClient(id: string): Promise<void> {
    await db.delete(eeClients).where(eq(eeClients.id, id));
  }

  // E&E Cross-Enrollment - Opportunities
  async createCrossEnrollmentOpportunity(opportunity: InsertCrossEnrollmentOpportunity): Promise<CrossEnrollmentOpportunity> {
    const [created] = await db.insert(crossEnrollmentOpportunities).values(opportunity).returning();
    return created;
  }

  async getCrossEnrollmentOpportunity(id: string): Promise<CrossEnrollmentOpportunity | undefined> {
    const [opportunity] = await db.select().from(crossEnrollmentOpportunities).where(eq(crossEnrollmentOpportunities.id, id));
    return opportunity || undefined;
  }

  async getCrossEnrollmentOpportunities(filters?: {
    eeClientId?: string;
    clientCaseId?: string;
    outreachStatus?: string;
    priority?: string;
    targetProgramId?: string;
  }): Promise<CrossEnrollmentOpportunity[]> {
    let query = db.select().from(crossEnrollmentOpportunities);
    
    const conditions = [];
    if (filters?.eeClientId) {
      conditions.push(eq(crossEnrollmentOpportunities.eeClientId, filters.eeClientId));
    }
    if (filters?.clientCaseId) {
      conditions.push(eq(crossEnrollmentOpportunities.clientCaseId, filters.clientCaseId));
    }
    if (filters?.outreachStatus) {
      conditions.push(eq(crossEnrollmentOpportunities.outreachStatus, filters.outreachStatus));
    }
    if (filters?.priority) {
      conditions.push(eq(crossEnrollmentOpportunities.priority, filters.priority));
    }
    if (filters?.targetProgramId) {
      conditions.push(eq(crossEnrollmentOpportunities.targetProgramId, filters.targetProgramId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(crossEnrollmentOpportunities.identifiedAt));
  }

  async updateCrossEnrollmentOpportunity(id: string, updates: Partial<CrossEnrollmentOpportunity>): Promise<CrossEnrollmentOpportunity> {
    const [updated] = await db
      .update(crossEnrollmentOpportunities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crossEnrollmentOpportunities.id, id))
      .returning();
    return updated;
  }

  async deleteCrossEnrollmentOpportunity(id: string): Promise<void> {
    await db.delete(crossEnrollmentOpportunities).where(eq(crossEnrollmentOpportunities.id, id));
  }

  // E&E Cross-Enrollment - Audit Events
  async createCrossEnrollmentAuditEvent(event: InsertCrossEnrollmentAuditEvent): Promise<CrossEnrollmentAuditEvent> {
    const [created] = await db.insert(crossEnrollmentAuditEvents).values(event).returning();
    return created;
  }

  async getCrossEnrollmentAuditEvents(filters?: {
    datasetId?: string;
    opportunityId?: string;
    eventType?: string;
    userId?: string;
  }): Promise<CrossEnrollmentAuditEvent[]> {
    let query = db.select().from(crossEnrollmentAuditEvents);
    
    const conditions = [];
    if (filters?.datasetId) {
      conditions.push(eq(crossEnrollmentAuditEvents.datasetId, filters.datasetId));
    }
    if (filters?.opportunityId) {
      conditions.push(eq(crossEnrollmentAuditEvents.opportunityId, filters.opportunityId));
    }
    if (filters?.eventType) {
      conditions.push(eq(crossEnrollmentAuditEvents.eventType, filters.eventType));
    }
    if (filters?.userId) {
      conditions.push(eq(crossEnrollmentAuditEvents.userId, filters.userId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(crossEnrollmentAuditEvents.createdAt));
  }

  // ============================================================================
  // Tax Preparation Methods
  // ============================================================================

  // Federal Tax Returns
  async createFederalTaxReturn(taxReturn: InsertFederalTaxReturn): Promise<FederalTaxReturn> {
    const [created] = await db.insert(federalTaxReturns).values(taxReturn).returning();
    return created;
  }

  async getFederalTaxReturn(id: string): Promise<FederalTaxReturn | undefined> {
    return await db.query.federalTaxReturns.findFirst({
      where: eq(federalTaxReturns.id, id),
    });
  }

  async getFederalTaxReturns(filters?: { 
    scenarioId?: string; 
    preparerId?: string; 
    taxYear?: number; 
    efileStatus?: string 
  }): Promise<FederalTaxReturn[]> {
    let query = db.select().from(federalTaxReturns);
    
    const conditions = [];
    if (filters?.scenarioId) {
      conditions.push(eq(federalTaxReturns.scenarioId, filters.scenarioId));
    }
    if (filters?.preparerId) {
      conditions.push(eq(federalTaxReturns.preparerId, filters.preparerId));
    }
    if (filters?.taxYear) {
      conditions.push(eq(federalTaxReturns.taxYear, filters.taxYear));
    }
    if (filters?.efileStatus) {
      conditions.push(eq(federalTaxReturns.efileStatus, filters.efileStatus));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(federalTaxReturns.createdAt));
  }

  async getFederalTaxReturnsByScenario(scenarioId: string): Promise<FederalTaxReturn[]> {
    return await db.query.federalTaxReturns.findMany({
      where: eq(federalTaxReturns.scenarioId, scenarioId),
      orderBy: [desc(federalTaxReturns.taxYear)],
    });
  }

  async getFederalTaxReturnsByPreparer(preparerId: string, taxYear?: number): Promise<FederalTaxReturn[]> {
    const conditions = [eq(federalTaxReturns.preparerId, preparerId)];
    if (taxYear) {
      conditions.push(eq(federalTaxReturns.taxYear, taxYear));
    }
    
    return await db.query.federalTaxReturns.findMany({
      where: and(...conditions),
      orderBy: [desc(federalTaxReturns.createdAt)],
    });
  }

  async updateFederalTaxReturn(id: string, updates: Partial<FederalTaxReturn>): Promise<FederalTaxReturn> {
    const [updated] = await db
      .update(federalTaxReturns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(federalTaxReturns.id, id))
      .returning();
    return updated;
  }

  async deleteFederalTaxReturn(id: string): Promise<void> {
    await db.delete(federalTaxReturns).where(eq(federalTaxReturns.id, id));
  }

  // Maryland Tax Returns
  async createMarylandTaxReturn(taxReturn: InsertMarylandTaxReturn): Promise<MarylandTaxReturn> {
    const [created] = await db.insert(marylandTaxReturns).values(taxReturn).returning();
    return created;
  }

  async getMarylandTaxReturn(id: string): Promise<MarylandTaxReturn | undefined> {
    return await db.query.marylandTaxReturns.findFirst({
      where: eq(marylandTaxReturns.id, id),
    });
  }

  async getMarylandTaxReturnByFederalId(federalReturnId: string): Promise<MarylandTaxReturn | undefined> {
    return await db.query.marylandTaxReturns.findFirst({
      where: eq(marylandTaxReturns.federalReturnId, federalReturnId),
    });
  }

  async updateMarylandTaxReturn(id: string, updates: Partial<MarylandTaxReturn>): Promise<MarylandTaxReturn> {
    const [updated] = await db
      .update(marylandTaxReturns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marylandTaxReturns.id, id))
      .returning();
    return updated;
  }

  async deleteMarylandTaxReturn(id: string): Promise<void> {
    await db.delete(marylandTaxReturns).where(eq(marylandTaxReturns.id, id));
  }

  // Tax Documents
  async createTaxDocument(taxDoc: InsertTaxDocument): Promise<TaxDocument> {
    const [created] = await db.insert(taxDocuments).values(taxDoc).returning();
    return created;
  }

  async getTaxDocument(id: string): Promise<TaxDocument | undefined> {
    return await db.query.taxDocuments.findFirst({
      where: eq(taxDocuments.id, id),
    });
  }

  async getTaxDocuments(filters?: { 
    scenarioId?: string; 
    federalReturnId?: string; 
    vitaSessionId?: string;
    documentType?: string; 
    verificationStatus?: string 
  }): Promise<TaxDocument[]> {
    let query = db.select().from(taxDocuments);
    
    const conditions = [];
    if (filters?.scenarioId) {
      conditions.push(eq(taxDocuments.scenarioId, filters.scenarioId));
    }
    if (filters?.federalReturnId) {
      conditions.push(eq(taxDocuments.federalReturnId, filters.federalReturnId));
    }
    if (filters?.vitaSessionId) {
      conditions.push(eq(taxDocuments.vitaSessionId, filters.vitaSessionId));
    }
    if (filters?.documentType) {
      conditions.push(eq(taxDocuments.documentType, filters.documentType));
    }
    if (filters?.verificationStatus) {
      conditions.push(eq(taxDocuments.verificationStatus, filters.verificationStatus));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(taxDocuments.createdAt));
  }

  async getTaxDocumentsByScenario(scenarioId: string): Promise<TaxDocument[]> {
    return await db.query.taxDocuments.findMany({
      where: eq(taxDocuments.scenarioId, scenarioId),
      orderBy: [desc(taxDocuments.createdAt)],
    });
  }

  async getTaxDocumentsByFederalReturn(federalReturnId: string): Promise<TaxDocument[]> {
    return await db.query.taxDocuments.findMany({
      where: eq(taxDocuments.federalReturnId, federalReturnId),
      orderBy: [desc(taxDocuments.createdAt)],
    });
  }

  async updateTaxDocument(id: string, updates: Partial<TaxDocument>): Promise<TaxDocument> {
    const [updated] = await db
      .update(taxDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(taxDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteTaxDocument(id: string): Promise<void> {
    await db.delete(taxDocuments).where(eq(taxDocuments.id, id));
  }

  // ============================================================================
  // Multi-County Deployment
  // ============================================================================

  // Counties
  async createCounty(county: InsertCounty): Promise<County> {
    const [created] = await db.insert(counties).values(county).returning();
    return created;
  }

  async getCounty(id: string): Promise<County | undefined> {
    return await db.query.counties.findFirst({
      where: eq(counties.id, id),
    });
  }

  async getCountyByCode(code: string): Promise<County | undefined> {
    return await db.query.counties.findFirst({
      where: eq(counties.code, code),
    });
  }

  async getCounties(filters?: { isActive?: boolean; isPilot?: boolean; region?: string }): Promise<County[]> {
    let query = db.select().from(counties);
    
    const conditions = [];
    if (filters?.isActive !== undefined) {
      conditions.push(eq(counties.isActive, filters.isActive));
    }
    if (filters?.isPilot !== undefined) {
      conditions.push(eq(counties.isPilot, filters.isPilot));
    }
    if (filters?.region) {
      conditions.push(eq(counties.region, filters.region));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(counties.name);
  }

  async updateCounty(id: string, updates: Partial<County>): Promise<County> {
    const [updated] = await db
      .update(counties)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(counties.id, id))
      .returning();
    return updated;
  }

  async deleteCounty(id: string): Promise<void> {
    await db.delete(counties).where(eq(counties.id, id));
  }

  // County Users
  async assignUserToCounty(assignment: InsertCountyUser): Promise<CountyUser> {
    const [created] = await db.insert(countyUsers).values(assignment).returning();
    return created;
  }

  async getUserCounties(userId: string): Promise<CountyUser[]> {
    return await db.query.countyUsers.findMany({
      where: eq(countyUsers.userId, userId),
      orderBy: [desc(countyUsers.isPrimary), desc(countyUsers.assignedAt)],
    });
  }

  async getCountyUsers(countyId: string, role?: string): Promise<CountyUser[]> {
    let query = db.select().from(countyUsers).where(eq(countyUsers.countyId, countyId));
    
    if (role) {
      query = query.where(and(eq(countyUsers.countyId, countyId), eq(countyUsers.role, role))) as any;
    }
    
    return await query.orderBy(desc(countyUsers.assignedAt));
  }

  async getPrimaryCounty(userId: string): Promise<County | undefined> {
    const primaryAssignment = await db.query.countyUsers.findFirst({
      where: and(
        eq(countyUsers.userId, userId),
        eq(countyUsers.isPrimary, true),
        isNull(countyUsers.deactivatedAt)
      ),
    });

    if (!primaryAssignment) {
      return undefined;
    }

    return await this.getCounty(primaryAssignment.countyId);
  }

  async removeUserFromCounty(id: string): Promise<void> {
    await db.delete(countyUsers).where(eq(countyUsers.id, id));
  }

  async updateCountyUserAssignment(id: string, updates: Partial<CountyUser>): Promise<CountyUser> {
    const [updated] = await db
      .update(countyUsers)
      .set(updates)
      .where(eq(countyUsers.id, id))
      .returning();
    return updated;
  }

  // County Metrics
  async createCountyMetric(metric: InsertCountyMetric): Promise<CountyMetric> {
    const [created] = await db.insert(countyMetrics).values(metric).returning();
    return created;
  }

  async getCountyMetrics(countyId: string, periodType?: string, limit: number = 10): Promise<CountyMetric[]> {
    let query = db.select().from(countyMetrics).where(eq(countyMetrics.countyId, countyId));
    
    if (periodType) {
      query = query.where(and(eq(countyMetrics.countyId, countyId), eq(countyMetrics.periodType, periodType))) as any;
    }
    
    return await query
      .orderBy(desc(countyMetrics.periodStart))
      .limit(limit);
  }

  async getLatestCountyMetric(countyId: string, periodType: string): Promise<CountyMetric | undefined> {
    return await db.query.countyMetrics.findFirst({
      where: and(
        eq(countyMetrics.countyId, countyId),
        eq(countyMetrics.periodType, periodType)
      ),
      orderBy: [desc(countyMetrics.periodStart)],
    });
  }

  // ============================================================================
  // Multi-Tenant System
  // ============================================================================

  // Tenants
  async getTenant(id: string): Promise<Tenant | undefined> {
    return await db.query.tenants.findFirst({
      where: eq(tenants.id, id),
      with: {
        branding: true,
      },
    });
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    return await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
      with: {
        branding: true,
      },
    });
  }

  async getTenantByDomain(domain: string): Promise<Tenant | undefined> {
    return await db.query.tenants.findFirst({
      where: eq(tenants.domain, domain),
      with: {
        branding: true,
      },
    });
  }

  async getTenants(filters?: { type?: string; status?: string; parentTenantId?: string }): Promise<Tenant[]> {
    let query = db.select().from(tenants);
    
    const conditions = [];
    if (filters?.type) {
      conditions.push(eq(tenants.type, filters.type));
    }
    if (filters?.status) {
      conditions.push(eq(tenants.status, filters.status));
    }
    if (filters?.parentTenantId) {
      conditions.push(eq(tenants.parentTenantId, filters.parentTenantId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(tenants.name);
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(tenant).returning();
    return created;
  }

  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant> {
    const [updated] = await db
      .update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return updated;
  }

  async deleteTenant(id: string): Promise<void> {
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  // Tenant Branding
  async getTenantBranding(tenantId: string): Promise<TenantBranding | undefined> {
    return await db.query.tenantBranding.findFirst({
      where: eq(tenantBranding.tenantId, tenantId),
    });
  }

  async createTenantBranding(branding: InsertTenantBranding): Promise<TenantBranding> {
    const [created] = await db.insert(tenantBranding).values(branding).returning();
    return created;
  }

  async updateTenantBranding(tenantId: string, updates: Partial<TenantBranding>): Promise<TenantBranding> {
    const [updated] = await db
      .update(tenantBranding)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenantBranding.tenantId, tenantId))
      .returning();
    return updated;
  }

  async deleteTenantBranding(tenantId: string): Promise<void> {
    await db.delete(tenantBranding).where(eq(tenantBranding.tenantId, tenantId));
  }

  // ============================================================================
  // Gamification & Navigator Performance
  // ============================================================================

  // Navigator KPIs
  async createNavigatorKpi(kpi: InsertNavigatorKpi): Promise<NavigatorKpi> {
    const [created] = await db.insert(navigatorKpis).values(kpi).returning();
    return created;
  }

  async getNavigatorKpi(id: string): Promise<NavigatorKpi | undefined> {
    return await db.query.navigatorKpis.findFirst({
      where: eq(navigatorKpis.id, id),
    });
  }

  async getNavigatorKpis(navigatorId: string, periodType?: string, limit: number = 10): Promise<NavigatorKpi[]> {
    let query = db.select().from(navigatorKpis).where(eq(navigatorKpis.navigatorId, navigatorId));
    
    if (periodType) {
      query = query.where(
        and(
          eq(navigatorKpis.navigatorId, navigatorId), 
          eq(navigatorKpis.periodType, periodType)
        )
      ) as any;
    }
    
    return await query
      .orderBy(desc(navigatorKpis.periodStart))
      .limit(limit);
  }

  async getLatestNavigatorKpi(navigatorId: string, periodType: string): Promise<NavigatorKpi | undefined> {
    return await db.query.navigatorKpis.findFirst({
      where: and(
        eq(navigatorKpis.navigatorId, navigatorId),
        eq(navigatorKpis.periodType, periodType)
      ),
      orderBy: [desc(navigatorKpis.periodStart)],
    });
  }

  async updateNavigatorKpi(id: string, updates: Partial<NavigatorKpi>): Promise<NavigatorKpi> {
    const [updated] = await db
      .update(navigatorKpis)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(navigatorKpis.id, id))
      .returning();
    return updated;
  }

  // Achievements
  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const [created] = await db.insert(achievements).values(achievement).returning();
    return created;
  }

  async getAchievement(id: string): Promise<Achievement | undefined> {
    return await db.query.achievements.findFirst({
      where: eq(achievements.id, id),
    });
  }

  async getAchievements(filters?: { category?: string; tier?: string; isActive?: boolean }): Promise<Achievement[]> {
    let query = db.select().from(achievements);
    
    const conditions = [];
    if (filters?.category) {
      conditions.push(eq(achievements.category, filters.category));
    }
    if (filters?.tier) {
      conditions.push(eq(achievements.tier, filters.tier));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(achievements.isActive, filters.isActive));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(achievements.sortOrder, achievements.name);
  }

  async updateAchievement(id: string, updates: Partial<Achievement>): Promise<Achievement> {
    const [updated] = await db
      .update(achievements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(achievements.id, id))
      .returning();
    return updated;
  }

  async deleteAchievement(id: string): Promise<void> {
    await db.delete(achievements).where(eq(achievements.id, id));
  }

  // Navigator Achievements
  async awardAchievement(award: InsertNavigatorAchievement): Promise<NavigatorAchievement> {
    const [created] = await db.insert(navigatorAchievements).values(award).returning();
    return created;
  }

  async getNavigatorAchievements(navigatorId: string): Promise<NavigatorAchievement[]> {
    return await db.query.navigatorAchievements.findMany({
      where: eq(navigatorAchievements.navigatorId, navigatorId),
      orderBy: [desc(navigatorAchievements.earnedAt)],
    });
  }

  async getUnnotifiedAchievements(navigatorId: string): Promise<NavigatorAchievement[]> {
    return await db.query.navigatorAchievements.findMany({
      where: and(
        eq(navigatorAchievements.navigatorId, navigatorId),
        eq(navigatorAchievements.notified, false)
      ),
      orderBy: [desc(navigatorAchievements.earnedAt)],
    });
  }

  async markAchievementNotified(id: string): Promise<void> {
    await db
      .update(navigatorAchievements)
      .set({ notified: true, notifiedAt: new Date() })
      .where(eq(navigatorAchievements.id, id));
  }

  // Leaderboards
  async createLeaderboard(leaderboard: InsertLeaderboard): Promise<Leaderboard> {
    const [created] = await db.insert(leaderboards).values(leaderboard).returning();
    return created;
  }

  async getLeaderboard(id: string): Promise<Leaderboard | undefined> {
    return await db.query.leaderboards.findFirst({
      where: eq(leaderboards.id, id),
    });
  }

  async getLeaderboards(filters: { 
    leaderboardType: string; 
    scope: string; 
    periodType: string; 
    countyId?: string 
  }): Promise<Leaderboard[]> {
    const conditions = [
      eq(leaderboards.leaderboardType, filters.leaderboardType),
      eq(leaderboards.scope, filters.scope),
      eq(leaderboards.periodType, filters.periodType),
    ];

    if (filters.countyId) {
      conditions.push(eq(leaderboards.countyId, filters.countyId));
    }

    return await db.query.leaderboards.findMany({
      where: and(...conditions),
      orderBy: [desc(leaderboards.periodStart)],
    });
  }

  async updateLeaderboard(id: string, updates: Partial<Leaderboard>): Promise<Leaderboard> {
    const [updated] = await db
      .update(leaderboards)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(leaderboards.id, id))
      .returning();
    return updated;
  }

  // Case Activity Events
  async createCaseActivityEvent(event: InsertCaseActivityEvent): Promise<CaseActivityEvent> {
    const [created] = await db.insert(caseActivityEvents).values(event).returning();
    return created;
  }

  async getCaseActivityEvents(navigatorId: string, eventType?: string, limit: number = 50): Promise<CaseActivityEvent[]> {
    let query = db.select().from(caseActivityEvents).where(eq(caseActivityEvents.navigatorId, navigatorId));
    
    if (eventType) {
      query = query.where(
        and(
          eq(caseActivityEvents.navigatorId, navigatorId),
          eq(caseActivityEvents.eventType, eventType)
        )
      ) as any;
    }
    
    return await query
      .orderBy(desc(caseActivityEvents.occurredAt))
      .limit(limit);
  }

  async getCaseEvents(caseId: string): Promise<CaseActivityEvent[]> {
    return await db.query.caseActivityEvents.findMany({
      where: eq(caseActivityEvents.caseId, caseId),
      orderBy: [desc(caseActivityEvents.occurredAt)],
    });
  }

  // Household Profiles
  async createHouseholdProfile(profile: InsertHouseholdProfile): Promise<HouseholdProfile> {
    const [created] = await db.insert(householdProfiles).values(profile).returning();
    return created;
  }

  async getHouseholdProfile(id: string): Promise<HouseholdProfile | undefined> {
    return await db.query.householdProfiles.findFirst({
      where: eq(householdProfiles.id, id),
    });
  }

  async getHouseholdProfiles(userId: string, filters?: { profileMode?: string; clientCaseId?: string; isActive?: boolean }): Promise<HouseholdProfile[]> {
    const conditions = [eq(householdProfiles.userId, userId)];

    if (filters?.profileMode) {
      conditions.push(eq(householdProfiles.profileMode, filters.profileMode));
    }

    if (filters?.clientCaseId) {
      conditions.push(eq(householdProfiles.clientCaseId, filters.clientCaseId));
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(householdProfiles.isActive, filters.isActive));
    }

    return await db.query.householdProfiles.findMany({
      where: and(...conditions),
      orderBy: [desc(householdProfiles.updatedAt)],
    });
  }

  async updateHouseholdProfile(id: string, updates: Partial<HouseholdProfile>): Promise<HouseholdProfile> {
    const [updated] = await db
      .update(householdProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(householdProfiles.id, id))
      .returning();
    return updated;
  }

  async deleteHouseholdProfile(id: string): Promise<void> {
    await db.delete(householdProfiles).where(eq(householdProfiles.id, id));
  }

  // VITA Intake Sessions
  async createVitaIntakeSession(session: InsertVitaIntakeSession): Promise<VitaIntakeSession> {
    const [created] = await db.insert(vitaIntakeSessions).values(session).returning();
    return created;
  }

  async getVitaIntakeSession(id: string): Promise<VitaIntakeSession | undefined> {
    return await db.query.vitaIntakeSessions.findFirst({
      where: eq(vitaIntakeSessions.id, id),
    });
  }

  async getVitaIntakeSessions(userId: string, filters?: { status?: string; clientCaseId?: string; reviewStatus?: string }): Promise<VitaIntakeSession[]> {
    const conditions = [eq(vitaIntakeSessions.userId, userId)];

    if (filters?.status) {
      conditions.push(eq(vitaIntakeSessions.status, filters.status));
    }

    if (filters?.clientCaseId) {
      conditions.push(eq(vitaIntakeSessions.clientCaseId, filters.clientCaseId));
    }

    if (filters?.reviewStatus) {
      conditions.push(eq(vitaIntakeSessions.reviewStatus, filters.reviewStatus));
    }

    return await db.query.vitaIntakeSessions.findMany({
      where: and(...conditions),
      orderBy: [desc(vitaIntakeSessions.updatedAt)],
    });
  }

  async updateVitaIntakeSession(id: string, updates: Partial<VitaIntakeSession>): Promise<VitaIntakeSession> {
    const [updated] = await db
      .update(vitaIntakeSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vitaIntakeSessions.id, id))
      .returning();
    return updated;
  }

  async deleteVitaIntakeSession(id: string): Promise<void> {
    await db.delete(vitaIntakeSessions).where(eq(vitaIntakeSessions.id, id));
  }

  // ============================================================================
  // Audit Logging & Security Monitoring
  // ============================================================================

  // Audit Logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLog(id: string): Promise<AuditLog | undefined> {
    return await db.query.auditLogs.findFirst({
      where: eq(auditLogs.id, id),
    });
  }

  async getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    sensitiveDataAccessed?: boolean;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLog[]> {
    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.resource) {
      conditions.push(eq(auditLogs.resource, filters.resource));
    }
    if (filters?.resourceId) {
      conditions.push(eq(auditLogs.resourceId, filters.resourceId));
    }
    if (filters?.sensitiveDataAccessed !== undefined) {
      conditions.push(eq(auditLogs.sensitiveDataAccessed, filters.sensitiveDataAccessed));
    }
    if (filters?.success !== undefined) {
      conditions.push(eq(auditLogs.success, filters.success));
    }
    if (filters?.startDate) {
      conditions.push(gte(auditLogs.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(auditLogs.createdAt, filters.endDate));
    }

    let query = db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }

  // Security Events
  async createSecurityEvent(event: InsertSecurityEvent): Promise<SecurityEvent> {
    const [created] = await db.insert(securityEvents).values(event).returning();
    return created;
  }

  async getSecurityEvent(id: string): Promise<SecurityEvent | undefined> {
    return await db.query.securityEvents.findFirst({
      where: eq(securityEvents.id, id),
    });
  }

  async getSecurityEvents(filters?: {
    eventType?: string;
    severity?: string;
    userId?: string;
    ipAddress?: string;
    reviewed?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SecurityEvent[]> {
    const conditions = [];

    if (filters?.eventType) {
      conditions.push(eq(securityEvents.eventType, filters.eventType));
    }
    if (filters?.severity) {
      conditions.push(eq(securityEvents.severity, filters.severity));
    }
    if (filters?.userId) {
      conditions.push(eq(securityEvents.userId, filters.userId));
    }
    if (filters?.ipAddress) {
      conditions.push(eq(securityEvents.ipAddress, filters.ipAddress));
    }
    if (filters?.reviewed !== undefined) {
      conditions.push(eq(securityEvents.reviewed, filters.reviewed));
    }
    if (filters?.startDate) {
      conditions.push(gte(securityEvents.occurredAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(securityEvents.occurredAt, filters.endDate));
    }

    let query = db
      .select()
      .from(securityEvents)
      .orderBy(desc(securityEvents.occurredAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }

  async updateSecurityEvent(id: string, updates: Partial<SecurityEvent>): Promise<SecurityEvent> {
    const [updated] = await db
      .update(securityEvents)
      .set(updates)
      .where(eq(securityEvents.id, id))
      .returning();
    return updated;
  }

  // ============================================================================
  // QC Analytics - Maryland SNAP Predictive Analytics
  // ============================================================================

  // QC Error Patterns
  async createQcErrorPattern(pattern: InsertQcErrorPattern): Promise<QcErrorPattern> {
    const [created] = await db.insert(qcErrorPatterns).values(pattern).returning();
    return created;
  }

  async getQcErrorPatterns(filters?: { errorCategory?: string; quarterOccurred?: string; severity?: string }): Promise<QcErrorPattern[]> {
    const conditions = [];

    if (filters?.errorCategory) {
      conditions.push(eq(qcErrorPatterns.errorCategory, filters.errorCategory));
    }
    if (filters?.quarterOccurred) {
      conditions.push(eq(qcErrorPatterns.quarterOccurred, filters.quarterOccurred));
    }
    if (filters?.severity) {
      conditions.push(eq(qcErrorPatterns.severity, filters.severity));
    }

    let query = db
      .select()
      .from(qcErrorPatterns)
      .orderBy(qcErrorPatterns.quarterOccurred, desc(qcErrorPatterns.errorRate));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query;
  }

  // Flagged Cases
  async createFlaggedCase(flaggedCase: InsertFlaggedCase): Promise<FlaggedCase> {
    const [created] = await db.insert(flaggedCases).values(flaggedCase).returning();
    return created;
  }

  async getFlaggedCase(id: string): Promise<FlaggedCase | undefined> {
    return await db.query.flaggedCases.findFirst({
      where: eq(flaggedCases.id, id),
      with: {
        caseworker: true,
        reviewer: true,
      },
    });
  }

  async getFlaggedCasesByCaseworker(caseworkerId: string): Promise<FlaggedCase[]> {
    return await db.query.flaggedCases.findMany({
      where: eq(flaggedCases.assignedCaseworkerId, caseworkerId),
      with: {
        caseworker: true,
        reviewer: true,
      },
      orderBy: [desc(flaggedCases.riskScore), desc(flaggedCases.flaggedDate)],
    });
  }

  async getFlaggedCasesForSupervisor(supervisorId: string): Promise<FlaggedCase[]> {
    // Get all flagged cases that are pending review or were reviewed by this supervisor
    return await db.query.flaggedCases.findMany({
      where: or(
        eq(flaggedCases.reviewStatus, 'pending'),
        eq(flaggedCases.reviewedBy, supervisorId)
      ),
      with: {
        caseworker: true,
        reviewer: true,
      },
      orderBy: [desc(flaggedCases.riskScore), desc(flaggedCases.flaggedDate)],
    });
  }

  async updateFlaggedCaseStatus(caseId: string, status: string, reviewedBy?: string, reviewNotes?: string): Promise<FlaggedCase> {
    const [updated] = await db
      .update(flaggedCases)
      .set({
        reviewStatus: status,
        reviewedBy: reviewedBy || null,
        reviewNotes: reviewNotes || null,
      })
      .where(eq(flaggedCases.id, caseId))
      .returning();
    return updated;
  }

  async assignFlaggedCase(caseId: string, assignedCaseworkerId: string, reviewedBy: string, reviewNotes?: string): Promise<FlaggedCase> {
    const [updated] = await db
      .update(flaggedCases)
      .set({
        assignedCaseworkerId,
        reviewedBy,
        reviewNotes: reviewNotes || null,
        reviewStatus: 'assigned',
      })
      .where(eq(flaggedCases.id, caseId))
      .returning();
    return updated;
  }

  // Job Aids
  async createJobAid(jobAid: InsertJobAid): Promise<JobAid> {
    const [created] = await db.insert(jobAids).values(jobAid).returning();
    return created;
  }

  async getJobAid(id: string): Promise<JobAid | undefined> {
    return await db.query.jobAids.findFirst({
      where: eq(jobAids.id, id),
    });
  }

  async getJobAids(filters?: { category?: string }): Promise<JobAid[]> {
    if (filters?.category) {
      return await db
        .select()
        .from(jobAids)
        .where(eq(jobAids.category, filters.category))
        .orderBy(jobAids.title);
    }

    return await db
      .select()
      .from(jobAids)
      .orderBy(jobAids.category, jobAids.title);
  }

  async getJobAidsByCategory(category: string): Promise<JobAid[]> {
    return await db
      .select()
      .from(jobAids)
      .where(eq(jobAids.category, category))
      .orderBy(jobAids.title);
  }

  // Training Interventions
  async createTrainingIntervention(intervention: InsertTrainingIntervention): Promise<TrainingIntervention> {
    const [created] = await db.insert(trainingInterventions).values(intervention).returning();
    return created;
  }

  async getTrainingIntervention(id: string): Promise<TrainingIntervention | undefined> {
    return await db.query.trainingInterventions.findFirst({
      where: eq(trainingInterventions.id, id),
    });
  }

  async getTrainingInterventions(filters?: { targetErrorCategory?: string }): Promise<TrainingIntervention[]> {
    if (filters?.targetErrorCategory) {
      return await db
        .select()
        .from(trainingInterventions)
        .where(eq(trainingInterventions.targetErrorCategory, filters.targetErrorCategory))
        .orderBy(desc(trainingInterventions.completedDate));
    }

    return await db
      .select()
      .from(trainingInterventions)
      .orderBy(desc(trainingInterventions.completedDate));
  }

  // ============================================================================
  // Webhooks - Event notification system
  // ============================================================================

  async createWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const [created] = await db.insert(webhooks).values(webhook).returning();
    return created;
  }

  async getWebhook(id: string): Promise<Webhook | undefined> {
    return await db.query.webhooks.findFirst({
      where: eq(webhooks.id, id),
    });
  }

  async getWebhooks(filters?: { tenantId?: string; apiKeyId?: string; status?: string }): Promise<Webhook[]> {
    let query = db.select().from(webhooks);

    const conditions = [];
    if (filters?.tenantId) {
      conditions.push(eq(webhooks.tenantId, filters.tenantId));
    }
    if (filters?.apiKeyId) {
      conditions.push(eq(webhooks.apiKeyId, filters.apiKeyId));
    }
    if (filters?.status) {
      conditions.push(eq(webhooks.status, filters.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(desc(webhooks.createdAt));
  }

  async updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook> {
    const [updated] = await db
      .update(webhooks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(webhooks.id, id))
      .returning();
    return updated;
  }

  async deleteWebhook(id: string): Promise<void> {
    await db.delete(webhooks).where(eq(webhooks.id, id));
  }

  // Webhook Delivery Logs
  async createWebhookDeliveryLog(log: InsertWebhookDeliveryLog): Promise<WebhookDeliveryLog> {
    const [created] = await db.insert(webhookDeliveryLogs).values(log).returning();
    return created;
  }

  async getWebhookDeliveryLogs(webhookId: string, limit: number = 50): Promise<WebhookDeliveryLog[]> {
    return await db
      .select()
      .from(webhookDeliveryLogs)
      .where(eq(webhookDeliveryLogs.webhookId, webhookId))
      .orderBy(desc(webhookDeliveryLogs.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
