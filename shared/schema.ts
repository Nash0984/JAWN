import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean, uuid, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // user, admin, super_admin
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const benefitPrograms = pgTable("benefit_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // SNAP, MEDICAID, etc.
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documentTypes = pgTable("document_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // POLICY_MANUAL, GUIDANCE, etc.
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  objectPath: text("object_path"), // path in object storage
  documentTypeId: varchar("document_type_id").references(() => documentTypes.id),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id),
  fileSize: integer("file_size"), // in bytes
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  status: text("status").notNull().default("uploaded"), // uploaded, processing, processed, failed
  processingStatus: jsonb("processing_status"), // detailed processing info
  qualityScore: real("quality_score"), // 0-1 quality assessment
  ocrAccuracy: real("ocr_accuracy"), // 0-1 OCR accuracy
  metadata: jsonb("metadata"), // extracted metadata
  // Audit trail fields for golden source documents
  sourceUrl: text("source_url"), // original URL where document was downloaded from
  downloadedAt: timestamp("downloaded_at"), // when document was ingested from source
  documentHash: text("document_hash"), // SHA-256 hash of original document for integrity
  isGoldenSource: boolean("is_golden_source").default(false).notNull(), // marks official policy documents
  sectionNumber: text("section_number"), // e.g., "100", "200", for SNAP manual sections
  lastModifiedAt: timestamp("last_modified_at"), // last modified date from source
  auditTrail: jsonb("audit_trail"), // detailed provenance information
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documentChunks = pgTable("document_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embeddings: text("embeddings"), // JSON string of vector embeddings
  vectorId: text("vector_id"), // ID in vector database
  metadata: jsonb("metadata"), // chunk-specific metadata
  pageNumber: integer("page_number"),
  startOffset: integer("start_offset"),
  endOffset: integer("end_offset"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const policySources = pgTable("policy_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url"),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id),
  syncType: text("sync_type").notNull(), // manual, api, web_scraping
  syncConfig: jsonb("sync_config"), // configuration for automated sync
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: text("sync_status").default("idle"), // idle, syncing, error
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Document versioning for golden source tracking
export const documentVersions = pgTable("document_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  versionNumber: integer("version_number").notNull(),
  documentHash: text("document_hash").notNull(), // SHA-256 hash of this version
  sourceUrl: text("source_url").notNull(),
  downloadedAt: timestamp("downloaded_at").notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
  fileSize: integer("file_size"),
  httpHeaders: jsonb("http_headers"), // HTTP headers from download
  changesSummary: text("changes_summary"), // Summary of what changed
  auditTrail: jsonb("audit_trail"), // Full audit information
  objectPath: text("object_path"), // Path in object storage for this version
  isActive: boolean("is_active").default(true).notNull(), // Current active version
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// RAG search results for transparency and caching
export const searchResults = pgTable("search_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queryId: varchar("query_id").references(() => searchQueries.id, { onDelete: "cascade" }).notNull(),
  chunkId: varchar("chunk_id").references(() => documentChunks.id, { onDelete: "cascade" }).notNull(),
  relevanceScore: real("relevance_score").notNull(),
  rankPosition: integer("rank_position").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const searchQueries = pgTable("search_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  query: text("query").notNull(),
  userId: varchar("user_id").references(() => users.id),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id),
  response: jsonb("response"), // AI response with sources
  relevanceScore: real("relevance_score"),
  responseTime: integer("response_time"), // in milliseconds
  searchType: text("search_type").default("semantic").notNull(), // semantic, keyword, hybrid
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const modelVersions = pgTable("model_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  version: text("version").notNull(),
  modelType: text("model_type").notNull(), // classification, embedding, etc.
  status: text("status").notNull(), // training, staging, production, archived
  config: jsonb("config"), // model configuration
  performance: jsonb("performance"), // performance metrics
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deployedAt: timestamp("deployed_at"),
});

export const trainingJobs = pgTable("training_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelVersionId: varchar("model_version_id").references(() => modelVersions.id),
  status: text("status").notNull(), // queued, running, completed, failed
  progress: real("progress").default(0), // 0-1
  config: jsonb("config"), // training configuration
  metrics: jsonb("metrics"), // training metrics
  logs: text("logs"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const documentsRelations = relations(documents, ({ one, many }) => ({
  documentType: one(documentTypes, {
    fields: [documents.documentTypeId],
    references: [documentTypes.id],
  }),
  benefitProgram: one(benefitPrograms, {
    fields: [documents.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  uploadedByUser: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
  chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

export const policySourcesRelations = relations(policySources, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [policySources.benefitProgramId],
    references: [benefitPrograms.id],
  }),
}));

export const searchQueriesRelations = relations(searchQueries, ({ one }) => ({
  user: one(users, {
    fields: [searchQueries.userId],
    references: [users.id],
  }),
  benefitProgram: one(benefitPrograms, {
    fields: [searchQueries.benefitProgramId],
    references: [benefitPrograms.id],
  }),
}));

export const trainingJobsRelations = relations(trainingJobs, ({ one }) => ({
  modelVersion: one(modelVersions, {
    fields: [trainingJobs.modelVersionId],
    references: [modelVersions.id],
  }),
}));

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, {
    fields: [documentVersions.documentId],
    references: [documents.id],
  }),
}));

export const searchResultsRelations = relations(searchResults, ({ one }) => ({
  query: one(searchQueries, {
    fields: [searchResults.queryId],
    references: [searchQueries.id],
  }),
  chunk: one(documentChunks, {
    fields: [searchResults.chunkId],
    references: [documentChunks.id],
  }),
}));

// ============================================================================
// RULES AS CODE TABLES - Versioned, Editable Policy Rules
// ============================================================================

// Federal Poverty Levels - Updated annually
export const povertyLevels = pgTable("poverty_levels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  householdSize: integer("household_size").notNull(),
  monthlyIncome: integer("monthly_income").notNull(), // 100% FPL in cents
  annualIncome: integer("annual_income").notNull(), // 100% FPL in cents
  effectiveDate: timestamp("effective_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// SNAP Income Limits - Gross and net income limits by household size
export const snapIncomeLimits = pgTable("snap_income_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  householdSize: integer("household_size").notNull(),
  grossMonthlyLimit: integer("gross_monthly_limit").notNull(), // in cents
  netMonthlyLimit: integer("net_monthly_limit").notNull(), // in cents
  percentOfPoverty: integer("percent_of_poverty").notNull(), // e.g., 200 for 200% FPL
  effectiveDate: timestamp("effective_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// SNAP Deduction Rules - Standard, earned income, dependent care, shelter, medical
export const snapDeductions = pgTable("snap_deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  deductionType: text("deduction_type").notNull(), // standard, earned_income, dependent_care, shelter, medical
  deductionName: text("deduction_name").notNull(),
  calculationType: text("calculation_type").notNull(), // fixed, percentage, tiered, capped
  amount: integer("amount"), // Fixed amount in cents (for standard deduction)
  percentage: integer("percentage"), // Percentage as integer (20 = 20%)
  minAmount: integer("min_amount"), // Minimum in cents
  maxAmount: integer("max_amount"), // Maximum in cents (shelter cap, medical deduction threshold)
  conditions: jsonb("conditions"), // Eligibility conditions for this deduction
  effectiveDate: timestamp("effective_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// SNAP Allotment Amounts - Maximum monthly benefit by household size
export const snapAllotments = pgTable("snap_allotments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  householdSize: integer("household_size").notNull(),
  maxMonthlyBenefit: integer("max_monthly_benefit").notNull(), // in cents
  minMonthlyBenefit: integer("min_monthly_benefit"), // Minimum benefit (e.g., $23 for 1-2 person)
  effectiveDate: timestamp("effective_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Categorical Eligibility Rules - SSI, TANF, General Assistance recipients
export const categoricalEligibilityRules = pgTable("categorical_eligibility_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  ruleName: text("rule_name").notNull(),
  ruleCode: text("rule_code").notNull().unique(), // SSI, TANF, GA, BBCE
  description: text("description"),
  bypassGrossIncomeTest: boolean("bypass_gross_income_test").default(false).notNull(),
  bypassAssetTest: boolean("bypass_asset_test").default(false).notNull(),
  bypassNetIncomeTest: boolean("bypass_net_income_test").default(false).notNull(),
  conditions: jsonb("conditions"), // Required conditions to qualify
  effectiveDate: timestamp("effective_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Document Requirement Rules - Required documents based on circumstances
export const documentRequirementRules = pgTable("document_requirement_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  requirementName: text("requirement_name").notNull(),
  documentType: text("document_type").notNull(), // income, identity, residency, expenses
  requiredWhen: jsonb("required_when").notNull(), // Conditions when this document is required
  acceptableDocuments: jsonb("acceptable_documents").notNull(), // List of acceptable document types
  validityPeriod: integer("validity_period"), // Days document remains valid (e.g., 60 for paystubs)
  isRequired: boolean("is_required").default(true).notNull(),
  canBeWaived: boolean("can_be_waived").default(false).notNull(),
  waiverConditions: jsonb("waiver_conditions"),
  effectiveDate: timestamp("effective_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Eligibility Calculations - Audit trail of all eligibility determinations
export const eligibilityCalculations = pgTable("eligibility_calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  householdSize: integer("household_size").notNull(),
  grossMonthlyIncome: integer("gross_monthly_income").notNull(), // in cents
  netMonthlyIncome: integer("net_monthly_income").notNull(), // in cents
  deductions: jsonb("deductions").notNull(), // Breakdown of all deductions applied
  categoricalEligibility: text("categorical_eligibility"), // Which categorical rule applied, if any
  isEligible: boolean("is_eligible").notNull(),
  monthlyBenefit: integer("monthly_benefit"), // Calculated benefit in cents
  ineligibilityReasons: jsonb("ineligibility_reasons"), // If not eligible, why?
  rulesSnapshot: jsonb("rules_snapshot").notNull(), // Which rule versions were used
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  calculatedBy: varchar("calculated_by").references(() => users.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

// Rule Change Log - Track all changes to policy rules
export const ruleChangeLogs = pgTable("rule_change_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleTable: text("rule_table").notNull(), // Which table was changed
  ruleId: varchar("rule_id").notNull(), // ID of the changed rule
  changeType: text("change_type").notNull(), // create, update, delete, approve
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values").notNull(),
  changeReason: text("change_reason"),
  changedBy: varchar("changed_by").references(() => users.id).notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Audit Logs - Comprehensive audit trail for all system events
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(), // e.g., "API_REQUEST", "ERROR", "AUTH_LOGIN", "ADMIN_UPDATE", "DOCUMENT_UPLOAD"
  entityType: text("entity_type"), // e.g., "USER", "RULE", "DOCUMENT", "REQUEST"
  entityId: varchar("entity_id"), // ID of the affected entity
  userId: varchar("user_id").references(() => users.id), // User who performed the action
  metadata: jsonb("metadata").notNull().default({}), // Additional context
  ipAddress: text("ip_address"), // IP address of the request
  userAgent: text("user_agent"), // User agent string
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  indexed: boolean("indexed").default(false).notNull(), // For indexing/archival
});

// Client Cases - Track individual client cases for navigators
export const clientCases = pgTable("client_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  clientIdentifier: text("client_identifier"), // Last 4 SSN or case number
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  assignedNavigator: varchar("assigned_navigator").references(() => users.id),
  status: text("status").notNull().default("screening"), // screening, documents_pending, submitted, approved, denied
  householdSize: integer("household_size"),
  estimatedIncome: integer("estimated_income"), // in cents
  eligibilityCalculationId: varchar("eligibility_calculation_id").references(() => eligibilityCalculations.id),
  applicationSubmittedAt: timestamp("application_submitted_at"),
  applicationApprovedAt: timestamp("application_approved_at"),
  notes: text("notes"),
  tags: jsonb("tags"), // For categorization/filtering
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations for Rules as Code tables
export const povertyLevelsRelations = relations(povertyLevels, ({ one }) => ({
  creator: one(users, {
    fields: [povertyLevels.createdBy],
    references: [users.id],
  }),
}));

export const snapIncomeLimitsRelations = relations(snapIncomeLimits, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [snapIncomeLimits.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  creator: one(users, {
    fields: [snapIncomeLimits.createdBy],
    references: [users.id],
  }),
}));

export const snapDeductionsRelations = relations(snapDeductions, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [snapDeductions.benefitProgramId],
    references: [benefitPrograms.id],
  }),
}));

export const snapAllotmentsRelations = relations(snapAllotments, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [snapAllotments.benefitProgramId],
    references: [benefitPrograms.id],
  }),
}));

export const categoricalEligibilityRulesRelations = relations(categoricalEligibilityRules, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [categoricalEligibilityRules.benefitProgramId],
    references: [benefitPrograms.id],
  }),
}));

export const documentRequirementRulesRelations = relations(documentRequirementRules, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [documentRequirementRules.benefitProgramId],
    references: [benefitPrograms.id],
  }),
}));

export const eligibilityCalculationsRelations = relations(eligibilityCalculations, ({ one }) => ({
  user: one(users, {
    fields: [eligibilityCalculations.userId],
    references: [users.id],
  }),
  benefitProgram: one(benefitPrograms, {
    fields: [eligibilityCalculations.benefitProgramId],
    references: [benefitPrograms.id],
  }),
}));

export const clientCasesRelations = relations(clientCases, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [clientCases.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  navigator: one(users, {
    fields: [clientCases.assignedNavigator],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [clientCases.createdBy],
    references: [users.id],
  }),
  eligibilityCalculation: one(eligibilityCalculations, {
    fields: [clientCases.eligibilityCalculationId],
    references: [eligibilityCalculations.id],
  }),
}));

// Manual Sections - Table of Contents for browsing the policy manual
export const manualSections = pgTable("manual_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionNumber: text("section_number").notNull().unique(), // e.g., "100", "115", "200"
  sectionTitle: text("section_title").notNull(), // e.g., "Household Composition"
  category: text("category").notNull(), // e.g., "100s - Eligibility", "200s - Income & Resources", "400s - Application Process"
  parentSection: text("parent_section"), // For sub-sections
  sortOrder: integer("sort_order").notNull(), // Display order
  documentId: varchar("document_id").references(() => documents.id), // Link to actual document
  sourceUrl: text("source_url"), // Original URL
  fileType: text("file_type"), // PDF, DOCX, etc.
  fileSize: integer("file_size"), // in bytes
  lastModified: timestamp("last_modified"), // from source
  effectiveDate: timestamp("effective_date"),
  isActive: boolean("is_active").default(true).notNull(),
  hasContent: boolean("has_content").default(false).notNull(), // Whether content has been ingested
  metadata: jsonb("metadata"), // Additional section metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const manualSectionsRelations = relations(manualSections, ({ one }) => ({
  document: one(documents, {
    fields: [manualSections.documentId],
    references: [documents.id],
  }),
}));

// Cross References - Track references between manual sections
export const sectionCrossReferences = pgTable("section_cross_references", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromSectionId: varchar("from_section_id").references(() => manualSections.id, { onDelete: "cascade" }).notNull(),
  toSectionNumber: text("to_section_number").notNull(), // Section being referenced (e.g., "115", "200")
  referenceType: text("reference_type").notNull(), // "see_section", "defined_in", "related_to", "superseded_by"
  context: text("context"), // The text snippet where reference appears
  chunkId: varchar("chunk_id").references(() => documentChunks.id, { onDelete: "set null" }), // Which chunk contains this reference
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sectionCrossReferencesRelations = relations(sectionCrossReferences, ({ one }) => ({
  fromSection: one(manualSections, {
    fields: [sectionCrossReferences.fromSectionId],
    references: [manualSections.id],
  }),
  chunk: one(documentChunks, {
    fields: [sectionCrossReferences.chunkId],
    references: [documentChunks.id],
  }),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export const insertManualSectionSchema = createInsertSchema(manualSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBenefitProgramSchema = createInsertSchema(benefitPrograms).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for document ingestion with audit trail
export const insertGoldenSourceDocumentSchema = createInsertSchema(documents)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    sourceUrl: z.string().url(),
    downloadedAt: z.date(),
    documentHash: z.string(),
    isGoldenSource: z.boolean().default(true),
    sectionNumber: z.string().optional(),
    lastModifiedAt: z.date().optional(),
    auditTrail: z.any(),
  });

export const insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({
  id: true,
  createdAt: true,
});

export const insertPolicySourceSchema = createInsertSchema(policySources).omit({
  id: true,
  createdAt: true,
});

export const insertSearchQuerySchema = createInsertSchema(searchQueries).omit({
  id: true,
  createdAt: true,
});

export const insertModelVersionSchema = createInsertSchema(modelVersions).omit({
  id: true,
  createdAt: true,
});

export const insertTrainingJobSchema = createInsertSchema(trainingJobs).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentVersionSchema = createInsertSchema(documentVersions).omit({
  id: true,
  createdAt: true,
});

export const insertSearchResultSchema = createInsertSchema(searchResults).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertBenefitProgram = z.infer<typeof insertBenefitProgramSchema>;
export type BenefitProgram = typeof benefitPrograms.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type DocumentChunk = typeof documentChunks.$inferSelect;

export type InsertPolicySource = z.infer<typeof insertPolicySourceSchema>;
export type PolicySource = typeof policySources.$inferSelect;

export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;
export type SearchQuery = typeof searchQueries.$inferSelect;

export type InsertModelVersion = z.infer<typeof insertModelVersionSchema>;
export type ModelVersion = typeof modelVersions.$inferSelect;

export type InsertTrainingJob = z.infer<typeof insertTrainingJobSchema>;
export type TrainingJob = typeof trainingJobs.$inferSelect;

export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;
export type DocumentVersion = typeof documentVersions.$inferSelect;

export type InsertSearchResult = z.infer<typeof insertSearchResultSchema>;
export type SearchResult = typeof searchResults.$inferSelect;

export type DocumentType = typeof documentTypes.$inferSelect;

// Rules as Code Insert Schemas
export const insertPovertyLevelSchema = createInsertSchema(povertyLevels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSnapIncomeLimitSchema = createInsertSchema(snapIncomeLimits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSnapDeductionSchema = createInsertSchema(snapDeductions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSnapAllotmentSchema = createInsertSchema(snapAllotments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCategoricalEligibilityRuleSchema = createInsertSchema(categoricalEligibilityRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentRequirementRuleSchema = createInsertSchema(documentRequirementRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEligibilityCalculationSchema = createInsertSchema(eligibilityCalculations).omit({
  id: true,
  calculatedAt: true,
});

export const insertRuleChangeLogSchema = createInsertSchema(ruleChangeLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertClientCaseSchema = createInsertSchema(clientCases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Rules as Code Types
export type InsertPovertyLevel = z.infer<typeof insertPovertyLevelSchema>;
export type PovertyLevel = typeof povertyLevels.$inferSelect;

export type InsertSnapIncomeLimit = z.infer<typeof insertSnapIncomeLimitSchema>;
export type SnapIncomeLimit = typeof snapIncomeLimits.$inferSelect;

export type InsertSnapDeduction = z.infer<typeof insertSnapDeductionSchema>;
export type SnapDeduction = typeof snapDeductions.$inferSelect;

export type InsertSnapAllotment = z.infer<typeof insertSnapAllotmentSchema>;
export type SnapAllotment = typeof snapAllotments.$inferSelect;

export type InsertCategoricalEligibilityRule = z.infer<typeof insertCategoricalEligibilityRuleSchema>;
export type CategoricalEligibilityRule = typeof categoricalEligibilityRules.$inferSelect;

export type InsertDocumentRequirementRule = z.infer<typeof insertDocumentRequirementRuleSchema>;
export type DocumentRequirementRule = typeof documentRequirementRules.$inferSelect;

export type InsertEligibilityCalculation = z.infer<typeof insertEligibilityCalculationSchema>;
export type EligibilityCalculation = typeof eligibilityCalculations.$inferSelect;

export type InsertRuleChangeLog = z.infer<typeof insertRuleChangeLogSchema>;
export type RuleChangeLog = typeof ruleChangeLogs.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertClientCase = z.infer<typeof insertClientCaseSchema>;
export type ClientCase = typeof clientCases.$inferSelect;
