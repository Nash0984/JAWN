import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean, uuid, real, index, uniqueIndex, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  fullName: text("full_name"),
  phone: text("phone"),
  role: text("role").notNull().default("client"), // client, navigator, caseworker, admin, super_admin
  // Multi-tenant isolation
  tenantId: varchar("tenant_id"), // References tenant for data isolation - relation defined below
  // Maryland DHS staff fields
  dhsEmployeeId: text("dhs_employee_id"), // for navigators and caseworkers
  officeLocation: text("office_location"), // local DHS office location
  // IRS VITA certification tracking (for tax preparation quality review)
  vitaCertificationLevel: text("vita_certification_level"), // basic, advanced, military, none
  vitaCertificationDate: timestamp("vita_certification_date"), // when certification was earned
  vitaCertificationExpiry: timestamp("vita_certification_expiry"), // expiration date (typically Dec 31 annually)
  vitaCertificationNumber: text("vita_certification_number"), // IRS-issued certification ID
  // TaxSlayer role tracking (for VITA coordination documentation only - not permission control)
  taxslayerRole: text("taxslayer_role"), // Administrator, Superuser, Preparer Current Year, Preparer All Years, Interviewer, Reviewer
  isActive: boolean("is_active").default(true).notNull(),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const benefitPrograms = pgTable("benefit_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // SNAP, MEDICAID, VITA, etc.
  description: text("description"),
  programType: text("program_type").notNull().default("benefit"), // benefit, tax, hybrid
  // Program capabilities flags
  hasRulesEngine: boolean("has_rules_engine").default(false).notNull(), // supports deterministic rules extraction
  hasPolicyEngineValidation: boolean("has_policy_engine_validation").default(false).notNull(), // can verify with PolicyEngine
  hasConversationalAI: boolean("has_conversational_ai").default(true).notNull(), // supports RAG chat
  // Source configuration
  primarySourceUrl: text("primary_source_url"), // main policy manual/document URL
  sourceType: text("source_type"), // pdf, web_scraping, api
  scrapingConfig: jsonb("scraping_config"), // configuration for scraping expandable sections, etc.
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documentTypes = pgTable("document_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // POLICY_MANUAL, GUIDANCE, etc.
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const dhsForms = pgTable("dhs_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formNumber: text("form_number").notNull(), // DHS-FIA-9780, DHS-FIA-9711, etc.
  name: text("name").notNull(), // "OHEP Application", "Request for Assistance", etc.
  language: text("language").notNull().default("en"), // en, es, am (Amharic), ar (Arabic), bu (Burmese), zh (Chinese)
  languageName: text("language_name").notNull().default("English"), // English, Spanish, Amharic, Arabic, Burmese, Chinese
  version: text("version").notNull(), // "2025", "2024-04-01", etc.
  programCode: text("program_code"), // MD_SNAP, MD_OHEP, MD_TANF, MD_MEDICAID, etc.
  formType: text("form_type").notNull(), // application, supplemental, change_report, appeal, verification
  description: text("description"),
  objectPath: text("object_path"), // GCS path to stored PDF
  sourceUrl: text("source_url").notNull(), // Original DHS URL
  fileSize: integer("file_size"), // in bytes
  documentHash: text("document_hash"), // SHA-256 hash for integrity
  downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"), // Last modified date from source
  isLatestVersion: boolean("is_latest_version").default(true).notNull(), // Marks current version
  isFillable: boolean("is_fillable").default(false).notNull(), // PDF has form fields
  metadata: jsonb("metadata"), // Additional form-specific metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  languageIdx: index("dhs_forms_language_idx").on(table.language),
  programCodeIdx: index("dhs_forms_program_code_idx").on(table.programCode),
  formTypeIdx: index("dhs_forms_form_type_idx").on(table.formType),
  latestVersionIdx: index("dhs_forms_latest_version_idx").on(table.isLatestVersion),
}));

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
  tenantId: varchar("tenant_id"), // Multi-tenant isolation - relation defined below
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
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  benefitProgramIdx: index("documents_benefit_program_idx").on(table.benefitProgramId),
  statusIdx: index("documents_status_idx").on(table.status),
  sectionNumberIdx: index("documents_section_number_idx").on(table.sectionNumber),
}));

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
}, (table) => ({
  documentIdIdx: index("chunks_document_id_idx").on(table.documentId),
}));

export const policySources = pgTable("policy_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(), // federal_regulation, state_regulation, federal_guidance, state_policy, federal_memo
  jurisdiction: text("jurisdiction").notNull(), // federal, maryland
  description: text("description"),
  url: text("url"),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id),
  syncType: text("sync_type").notNull(), // manual, api, web_scraping, bulk_download, direct_download
  syncSchedule: text("sync_schedule"), // off, weekly, bi-weekly, monthly, custom
  maxAllowedFrequency: text("max_allowed_frequency"), // Maximum frequency admin can set (weekly, bi-weekly, monthly)
  syncConfig: jsonb("sync_config"), // configuration for automated sync (cron expression for custom)
  lastSyncAt: timestamp("last_sync_at"),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at"),
  syncStatus: text("sync_status").default("idle"), // idle, syncing, success, error
  syncError: text("sync_error"),
  documentCount: integer("document_count").default(0),
  priority: integer("priority").default(0), // Higher priority sources synced first
  hasNewData: boolean("has_new_data").default(false), // True if new data detected in last sync
  racStatus: text("rac_status"), // production_ready, in_progress, planned, auto_update, null
  racCodeLocation: text("rac_code_location"), // Link to implementing code file
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
}, (table) => ({
  userIdIdx: index("search_queries_user_id_idx").on(table.userId),
  benefitProgramIdx: index("search_queries_benefit_program_idx").on(table.benefitProgramId),
}));

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
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
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
}, (table) => ({
  householdSizeActiveIdx: index("snap_income_limits_household_size_active_idx").on(table.householdSize, table.isActive),
  effectiveDateActiveIdx: index("snap_income_limits_effective_date_active_idx").on(table.effectiveDate, table.isActive),
  benefitProgramHouseholdActiveIdx: index("snap_income_limits_benefit_program_household_active_idx").on(table.benefitProgramId, table.householdSize, table.isActive),
}));

// SNAP Deduction Rules - Standard, earned income, dependent care, shelter, medical
export const snapDeductions = pgTable("snap_deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
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
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
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
}, (table) => ({
  householdSizeActiveIdx: index("snap_allotments_household_size_active_idx").on(table.householdSize, table.isActive),
  benefitProgramHouseholdActiveIdx: index("snap_allotments_benefit_program_household_active_idx").on(table.benefitProgramId, table.householdSize, table.isActive),
}));

// ============================================================================
// OHEP (Office of Home Energy Programs) RULES ENGINE TABLES
// ============================================================================

// OHEP Income Limits - Based on % FPL
export const ohepIncomeLimits = pgTable("ohep_income_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
  householdSize: integer("household_size").notNull(),
  percentOfFPL: integer("percent_of_fpl").notNull(), // e.g., 60 for 60% FPL
  monthlyIncomeLimit: integer("monthly_income_limit").notNull(), // in cents
  annualIncomeLimit: integer("annual_income_limit").notNull(), // in cents
  effectiveDate: timestamp("effective_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  householdSizeActiveIdx: index("ohep_income_limits_household_size_active_idx").on(table.householdSize, table.isActive),
  effectiveDateActiveIdx: index("ohep_income_limits_effective_date_active_idx").on(table.effectiveDate, table.isActive),
  benefitProgramHouseholdActiveIdx: index("ohep_income_limits_benefit_program_household_active_idx").on(table.benefitProgramId, table.householdSize, table.isActive),
}));

// OHEP Benefit Tiers - Crisis vs Regular Assistance
export const ohepBenefitTiers = pgTable("ohep_benefit_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
  tierType: text("tier_type").notNull(), // crisis, regular, arrearage
  benefitName: text("benefit_name").notNull(),
  maxBenefitAmount: integer("max_benefit_amount").notNull(), // in cents
  eligibilityConditions: jsonb("eligibility_conditions"), // When this tier applies
  vendorPaymentOnly: boolean("vendor_payment_only").default(true).notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tierTypeActiveIdx: index("ohep_benefit_tiers_tier_type_active_idx").on(table.tierType, table.isActive),
  benefitProgramTierActiveIdx: index("ohep_benefit_tiers_benefit_program_tier_active_idx").on(table.benefitProgramId, table.tierType, table.isActive),
}));

// OHEP Seasonal Factors - Heating vs Cooling Season
export const ohepSeasonalFactors = pgTable("ohep_seasonal_factors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  season: text("season").notNull(), // heating, cooling
  startMonth: integer("start_month").notNull(), // 1-12
  endMonth: integer("end_month").notNull(), // 1-12
  priorityGroups: jsonb("priority_groups"), // elderly, disabled, children under 6
  effectiveYear: integer("effective_year").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// TANF (Temporary Cash Assistance) RULES ENGINE TABLES
// ============================================================================

// TANF Income Limits - Needs standard by household size
export const tanfIncomeLimits = pgTable("tanf_income_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
  householdSize: integer("household_size").notNull(),
  needsStandard: integer("needs_standard").notNull(), // in cents - max countable income
  paymentStandard: integer("payment_standard").notNull(), // in cents - max benefit
  effectiveDate: timestamp("effective_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  householdSizeActiveIdx: index("tanf_income_limits_household_size_active_idx").on(table.householdSize, table.isActive),
  effectiveDateActiveIdx: index("tanf_income_limits_effective_date_active_idx").on(table.effectiveDate, table.isActive),
  benefitProgramHouseholdActiveIdx: index("tanf_income_limits_benefit_program_household_active_idx").on(table.benefitProgramId, table.householdSize, table.isActive),
}));

// TANF Asset Limits
export const tanfAssetLimits = pgTable("tanf_asset_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
  assetType: text("asset_type").notNull(), // liquid, vehicle, property
  maxAssetValue: integer("max_asset_value").notNull(), // in cents
  exclusions: jsonb("exclusions"), // What assets are excluded
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

// TANF Work Requirements
export const tanfWorkRequirements = pgTable("tanf_work_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
  householdType: text("household_type").notNull(), // single_parent, two_parent
  requiredHoursPerWeek: integer("required_hours_per_week").notNull(),
  exemptionCategories: jsonb("exemption_categories"), // disabled, caring for infant, etc.
  sanctionPolicy: jsonb("sanction_policy"), // What happens if requirements not met
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

// TANF Time Limits
export const tanfTimeLimits = pgTable("tanf_time_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
  limitType: text("limit_type").notNull(), // lifetime, continuous
  maxMonths: integer("max_months").notNull(),
  hardshipExemptions: jsonb("hardship_exemptions"),
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

// ============================================================================
// MEDICAID RULES ENGINE TABLES
// ============================================================================

// Medicaid Income Limits - By Category (Adult, Child, Pregnant, Elderly)
export const medicaidIncomeLimits = pgTable("medicaid_income_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
  category: text("category").notNull(), // adult, child, pregnant, elderly_disabled
  householdSize: integer("household_size").notNull(),
  percentOfFPL: integer("percent_of_fpl").notNull(), // e.g., 138 for adults, 322 for children
  monthlyIncomeLimit: integer("monthly_income_limit").notNull(), // in cents
  annualIncomeLimit: integer("annual_income_limit").notNull(), // in cents
  effectiveDate: timestamp("effective_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  householdSizeActiveIdx: index("medicaid_income_limits_household_size_active_idx").on(table.householdSize, table.isActive),
  effectiveDateActiveIdx: index("medicaid_income_limits_effective_date_active_idx").on(table.effectiveDate, table.isActive),
  benefitProgramHouseholdActiveIdx: index("medicaid_income_limits_benefit_program_household_active_idx").on(table.benefitProgramId, table.householdSize, table.isActive),
}));

// Medicaid MAGI Rules - Modified Adjusted Gross Income methodology
export const medicaidMAGIRules = pgTable("medicaid_magi_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
  ruleName: text("rule_name").notNull(),
  incomeInclusions: jsonb("income_inclusions").notNull(), // What income counts
  incomeExclusions: jsonb("income_exclusions").notNull(), // What income doesn't count
  deductionsAllowed: jsonb("deductions_allowed"), // Allowed deductions from MAGI
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

// Medicaid Non-MAGI Rules - For elderly/disabled populations
export const medicaidNonMAGIRules = pgTable("medicaid_non_magi_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
  ruleName: text("rule_name").notNull(),
  category: text("category").notNull(), // ssi_related, aged_blind_disabled
  incomeMethodology: jsonb("income_methodology").notNull(),
  assetTest: jsonb("asset_test"), // Asset limits and exclusions
  medicallyNeedyRules: jsonb("medically_needy_rules"), // Spenddown rules
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

// Medicaid Categories - Defines all eligibility pathways
export const medicaidCategories = pgTable("medicaid_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  categoryCode: text("category_code").notNull().unique(), // MAGI_ADULT, MAGI_CHILD, MAGI_PREGNANT, SSI, ABD
  categoryName: text("category_name").notNull(),
  description: text("description"),
  usesMAGI: boolean("uses_magi").notNull(), // true = MAGI methodology, false = Non-MAGI
  eligibilityCriteria: jsonb("eligibility_criteria").notNull(),
  priorityOrder: integer("priority_order").notNull(), // Order to check categories
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

// ============================================================================
// VITA TAX RULES ENGINE TABLES - Federal Tax Calculations
// ============================================================================

// Federal Tax Brackets - Progressive tax rates
export const federalTaxBrackets = pgTable("federal_tax_brackets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxYear: integer("tax_year").notNull(),
  filingStatus: text("filing_status").notNull(), // single, married_joint, married_separate, head_of_household
  bracketNumber: integer("bracket_number").notNull(), // 1-7
  minIncome: integer("min_income").notNull(), // in cents
  maxIncome: integer("max_income"), // in cents, null for top bracket
  taxRate: real("tax_rate").notNull(), // e.g., 0.10 for 10%
  effectiveDate: timestamp("effective_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Federal Standard Deductions
export const federalStandardDeductions = pgTable("federal_standard_deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxYear: integer("tax_year").notNull(),
  filingStatus: text("filing_status").notNull(),
  deductionAmount: integer("deduction_amount").notNull(), // in cents
  additionalAge65: integer("additional_age_65"), // Additional deduction if 65+
  additionalBlind: integer("additional_blind"), // Additional if blind
  effectiveDate: timestamp("effective_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// EITC Tables - Earned Income Tax Credit lookup tables
export const eitcTables = pgTable("eitc_tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxYear: integer("tax_year").notNull(),
  qualifyingChildren: integer("qualifying_children").notNull(), // 0, 1, 2, 3+
  filingStatus: text("filing_status").notNull(),
  maxCredit: integer("max_credit").notNull(), // in cents
  phaseInRate: real("phase_in_rate").notNull(), // e.g., 0.34 for 34%
  phaseOutStart: integer("phase_out_start").notNull(), // AGI where phaseout begins (cents)
  phaseOutRate: real("phase_out_rate").notNull(),
  phaseOutEnd: integer("phase_out_end").notNull(), // AGI where credit = 0
  investmentIncomeLimit: integer("investment_income_limit"), // Max investment income allowed
  effectiveDate: timestamp("effective_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Child Tax Credit Rules
export const ctcRules = pgTable("ctc_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxYear: integer("tax_year").notNull(),
  creditPerChild: integer("credit_per_child").notNull(), // in cents
  refundableAmount: integer("refundable_amount").notNull(), // Additional CTC refundable portion
  phaseOutStart: integer("phase_out_start").notNull(), // AGI threshold by filing status
  phaseOutRate: real("phase_out_rate").notNull(),
  childAgeCutoff: integer("child_age_cutoff").notNull(), // e.g., 17
  effectiveDate: timestamp("effective_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// MARYLAND STATE TAX RULES ENGINE TABLES
// ============================================================================

// Maryland Tax Rates - State income tax brackets
export const marylandTaxRates = pgTable("maryland_tax_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxYear: integer("tax_year").notNull(),
  filingStatus: text("filing_status").notNull(),
  bracketNumber: integer("bracket_number").notNull(),
  minIncome: integer("min_income").notNull(), // in cents
  maxIncome: integer("max_income"), // in cents
  taxRate: real("tax_rate").notNull(), // State tax rate
  effectiveDate: timestamp("effective_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Maryland County Tax Rates - Local income tax by county
export const marylandCountyTaxRates = pgTable("maryland_county_tax_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxYear: integer("tax_year").notNull(),
  countyCode: text("county_code").notNull(), // BALTIMORE, MONTGOMERY, etc.
  countyName: text("county_name").notNull(),
  taxRate: real("tax_rate").notNull(), // County tax rate
  effectiveDate: timestamp("effective_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Maryland State Credits
export const marylandStateCredits = pgTable("maryland_state_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxYear: integer("tax_year").notNull(),
  creditCode: text("credit_code").notNull(), // MD_EITC, POVERTY_CREDIT, etc.
  creditName: text("credit_name").notNull(),
  creditType: text("credit_type").notNull(), // refundable, nonrefundable
  calculationMethod: jsonb("calculation_method").notNull(), // How to calculate
  maxCredit: integer("max_credit"), // Maximum credit amount in cents
  effectiveDate: timestamp("effective_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Categorical Eligibility Rules - SSI, TANF, General Assistance recipients
export const categoricalEligibilityRules = pgTable("categorical_eligibility_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
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
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id),
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
  tenantId: varchar("tenant_id"), // Multi-tenant isolation - relation defined below
  stateCode: text("state_code"), // Jurisdiction state code (MD, PA, etc.)
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
}, (table) => ({
  userIdIdx: index("eligibility_calculations_user_id_idx").on(table.userId),
  benefitProgramIdIdx: index("eligibility_calculations_benefit_program_id_idx").on(table.benefitProgramId),
  calculatedAtIdx: index("eligibility_calculations_calculated_at_idx").on(table.calculatedAt),
  benefitProgramCalculatedIdx: index("eligibility_calculations_benefit_program_calculated_idx").on(table.benefitProgramId, table.calculatedAt),
}));

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


// Quick Ratings - Simple thumbs up/down feedback for AI responses
export const quickRatings = pgTable("quick_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // What is being rated
  ratingType: text("rating_type").notNull(), // policy_search, document_verification, intake_copilot, ai_response
  relatedEntityType: text("related_entity_type"), // search_query, verification_document, client_case
  relatedEntityId: varchar("related_entity_id"), // ID of related entity
  
  // Rating
  rating: text("rating").notNull(), // thumbs_up, thumbs_down
  
  // Optional follow-up
  followUpComment: text("follow_up_comment"), // Optional brief comment
  
  // Metadata
  metadata: jsonb("metadata"), // Additional context (page, session, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("quick_ratings_user_id_idx").on(table.userId),
  typeIdx: index("quick_ratings_type_idx").on(table.ratingType),
  entityIdx: index("quick_ratings_entity_idx").on(table.relatedEntityType, table.relatedEntityId),
}));

// Feedback Submissions - User feedback on AI responses, eligibility results, policy content
export const feedbackSubmissions = pgTable("feedback_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  submitterName: text("submitter_name"), // For anonymous feedback
  submitterEmail: text("submitter_email"), // For follow-up
  
  // Context of feedback
  feedbackType: text("feedback_type").notNull(), // ai_response, eligibility_result, policy_content, document_verification, system_issue
  category: text("category").notNull(), // incorrect_answer, missing_info, confusing, technical_error, bias_concern, accessibility_issue, other
  severity: text("severity").notNull().default("medium"), // low, medium, high, critical
  
  // Reference to what the feedback is about
  relatedEntityType: text("related_entity_type"), // search_query, eligibility_calculation, manual_section, document
  relatedEntityId: varchar("related_entity_id"), // ID of related entity
  pageUrl: text("page_url"), // URL where feedback was submitted
  
  // Feedback content
  title: text("title").notNull(), // Short description
  description: text("description").notNull(), // Detailed feedback
  expectedBehavior: text("expected_behavior"), // What user expected
  actualBehavior: text("actual_behavior"), // What actually happened
  screenshotUrl: text("screenshot_url"), // Optional screenshot from object storage
  
  // Admin review
  status: text("status").notNull().default("submitted"), // submitted, under_review, resolved, closed, wont_fix
  priority: text("priority"), // low, medium, high
  assignedTo: varchar("assigned_to").references(() => users.id), // Admin assigned to review
  adminNotes: text("admin_notes"), // Internal notes
  resolution: text("resolution"), // How it was resolved
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  
  // Metadata
  metadata: jsonb("metadata"), // Additional context (browser, device, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("feedback_status_idx").on(table.status),
  userIdIdx: index("feedback_user_id_idx").on(table.userId),
  assignedToIdx: index("feedback_assigned_to_idx").on(table.assignedTo),
}));

// Notifications - Real-time alerts for users
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // policy_change, feedback_new, rule_extraction_complete, navigator_assignment, system_alert
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedEntityType: text("related_entity_type"), // feedback, rule, document, client_case
  relatedEntityId: varchar("related_entity_id"), // ID of related entity
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  actionUrl: text("action_url"), // URL to navigate to when clicked
  metadata: jsonb("metadata"), // Additional context
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdReadIdx: index("notifications_user_read_idx").on(table.userId, table.isRead),
  createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
}));

// Notification Preferences - User notification settings
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  // Category-specific preferences
  policyChanges: boolean("policy_changes").notNull().default(true),
  feedbackAlerts: boolean("feedback_alerts").notNull().default(true),
  navigatorAlerts: boolean("navigator_alerts").notNull().default(true),
  systemAlerts: boolean("system_alerts").notNull().default(true),
  ruleExtractionAlerts: boolean("rule_extraction_alerts").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notification Templates - Reusable notification message templates
export const notificationTemplates = pgTable("notification_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // FEEDBACK_NEW, RULE_EXTRACTION_COMPLETE, etc.
  type: text("type").notNull(), // Matches notification type
  title: text("title").notNull(),
  messageTemplate: text("message_template").notNull(), // Template with {{placeholders}}
  priority: text("priority").notNull().default("normal"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Client Cases - Track individual client cases for navigators
export const clientCases = pgTable("client_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  clientIdentifier: text("client_identifier"), // Last 4 SSN or case number
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  assignedNavigator: varchar("assigned_navigator").references(() => users.id),
  tenantId: varchar("tenant_id"), // Multi-tenant isolation - relation defined below
  stateCode: text("state_code"), // Jurisdiction state code (MD, PA, etc.)
  countyCode: text("county_code"), // County/locality code for sub-jurisdictions
  status: text("status").notNull().default("screening"), // screening, documents_pending, submitted, approved, denied
  householdSize: integer("household_size"),
  estimatedIncome: integer("estimated_income"), // in cents
  eligibilityCalculationId: varchar("eligibility_calculation_id").references(() => eligibilityCalculations.id),
  applicationSubmittedAt: timestamp("application_submitted_at"),
  applicationApprovedAt: timestamp("application_approved_at"),
  notes: text("notes"),
  tags: jsonb("tags"), // For categorization/filtering
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  benefitProgramStatusIdx: index("client_cases_benefit_program_status_idx").on(table.benefitProgramId, table.status),
  navigatorStatusIdx: index("client_cases_assigned_navigator_status_idx").on(table.assignedNavigator, table.status),
  tenantStateIdx: index("client_cases_tenant_state_idx").on(table.tenantId, table.stateCode),
  createdAtIdx: index("client_cases_created_at_idx").on(table.createdAt),
}));

// Cross-Enrollment Intelligence Tables
export const crossEnrollmentRecommendations = pgTable("cross_enrollment_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  householdProfileId: varchar("household_profile_id").references(() => householdProfiles.id, { onDelete: "cascade" }),
  clientCaseId: varchar("client_case_id").references(() => clientCases.id, { onDelete: "cascade" }),
  
  // Program recommendations
  recommendedProgramId: varchar("recommended_program_id").references(() => benefitPrograms.id).notNull(),
  currentEnrollments: jsonb("current_enrollments"), // Array of currently enrolled programs
  
  // AI Predictions
  eligibilityConfidence: real("eligibility_confidence").notNull(), // 0-1 confidence score
  estimatedBenefitAmount: integer("estimated_benefit_amount"), // in cents
  impactScore: real("impact_score"), // 0-100 score of potential impact
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  
  // Recommendation details
  recommendationType: text("recommendation_type").notNull(), // new_enrollment, renewal, recertification, appeal
  explanation: text("explanation").notNull(), // AI-generated explanation
  requirements: jsonb("requirements"), // List of requirements to qualify
  estimatedProcessingTime: integer("estimated_processing_time"), // in days
  applicationDeadline: timestamp("application_deadline"),
  
  // Status tracking
  status: text("status").notNull().default("pending"), // pending, accepted, declined, applied, enrolled
  userResponse: text("user_response"), // User's response to recommendation
  respondedAt: timestamp("responded_at"),
  appliedAt: timestamp("applied_at"),
  enrolledAt: timestamp("enrolled_at"),
  
  // Metadata
  modelVersion: text("model_version"),
  predictionMetadata: jsonb("prediction_metadata"), // Additional AI model outputs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  householdIdx: index("cross_enrollment_household_idx").on(table.householdProfileId),
  statusIdx: index("cross_enrollment_status_idx").on(table.status),
  priorityIdx: index("cross_enrollment_priority_idx").on(table.priority),
}));

// Predictive Analytics History
export const predictionHistory = pgTable("prediction_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  predictionType: text("prediction_type").notNull(), // case_outcome, processing_time, renewal_likelihood, benefit_amount, resource_allocation
  
  // Reference to entity
  entityType: text("entity_type").notNull(), // client_case, household_profile, benefit_program, office
  entityId: varchar("entity_id").notNull(),
  
  // Prediction details
  prediction: jsonb("prediction").notNull(), // Actual prediction values
  confidence: real("confidence"), // 0-1 confidence score
  features: jsonb("features"), // Input features used for prediction
  modelName: text("model_name").notNull(),
  modelVersion: text("model_version").notNull(),
  
  // Outcome tracking (for model improvement)
  actualOutcome: jsonb("actual_outcome"), // Actual outcome when known
  outcomeRecordedAt: timestamp("outcome_recorded_at"),
  predictionAccuracy: real("prediction_accuracy"), // 0-1 accuracy score
  
  // Metadata
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  entityIdx: index("prediction_history_entity_idx").on(table.entityType, table.entityId),
  typeIdx: index("prediction_history_type_idx").on(table.predictionType),
  createdAtIdx: index("prediction_history_created_idx").on(table.createdAt),
}));

// ML Model Registry
export const mlModels = pgTable("ml_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelName: text("model_name").notNull(),
  modelType: text("model_type").notNull(), // classification, regression, clustering, anomaly_detection
  targetVariable: text("target_variable").notNull(),
  version: text("version").notNull(),
  
  // Model details
  algorithm: text("algorithm"), // random_forest, xgboost, neural_network, etc.
  features: jsonb("features").notNull(), // List of feature names and types
  hyperparameters: jsonb("hyperparameters"),
  
  // Performance metrics
  trainingMetrics: jsonb("training_metrics"), // accuracy, precision, recall, f1, etc.
  validationMetrics: jsonb("validation_metrics"),
  testMetrics: jsonb("test_metrics"),
  
  // Training data
  trainingDataSize: integer("training_data_size"),
  trainingStartDate: timestamp("training_start_date"),
  trainingEndDate: timestamp("training_end_date"),
  lastRetrainedAt: timestamp("last_retrained_at"),
  
  // Deployment
  status: text("status").notNull().default("development"), // development, staging, production, deprecated
  deployedAt: timestamp("deployed_at"),
  deployedBy: varchar("deployed_by").references(() => users.id),
  
  // Monitoring
  driftThreshold: real("drift_threshold"), // Threshold for data drift detection
  lastDriftCheck: timestamp("last_drift_check"),
  driftDetected: boolean("drift_detected").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  modelNameVersionIdx: uniqueIndex("ml_models_name_version_idx").on(table.modelName, table.version),
  statusIdx: index("ml_models_status_idx").on(table.status),
}));

// AI Training Examples for Few-Shot Learning
export const aiTrainingExamples = pgTable("ai_training_examples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Use case categorization
  useCase: text("use_case").notNull(), // tax_document_classification, benefits_form_extraction, field_extraction, cross_enrollment_intelligence, policy_qa
  documentType: text("document_type"), // w2, 1099, pay_stub, utility_bill, dhs_form, birth_certificate, etc.
  
  // Example data
  exampleDocument: text("example_document"), // Object storage path to example document/file
  exampleText: text("example_text"), // Text content for text-based examples
  correctLabel: text("correct_label").notNull(), // The correct classification/label
  extractedData: jsonb("extracted_data"), // For field extraction examples: structured JSON of correct extractions
  
  // Quality metrics
  confidence: real("confidence").default(1.0), // 0-1 confidence in this example (1.0 = verified correct)
  version: integer("version").default(1).notNull(), // Version number for A/B testing
  isActive: boolean("is_active").default(true).notNull(), // Whether this example is currently being used
  
  // Prompt template association
  promptTemplate: text("prompt_template"), // Associated prompt template version
  
  // Multi-tenant and audit
  tenantId: varchar("tenant_id"),
  createdBy: varchar("created_by").references(() => users.id),
  verifiedBy: varchar("verified_by").references(() => users.id), // Admin who verified this example
  
  // Metadata
  metadata: jsonb("metadata"), // Additional context, notes, edge case flags
  notes: text("notes"), // Human-readable notes about this example
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  useCaseIdx: index("ai_training_examples_use_case_idx").on(table.useCase),
  documentTypeIdx: index("ai_training_examples_document_type_idx").on(table.documentType),
  activeIdx: index("ai_training_examples_active_idx").on(table.isActive),
  versionIdx: index("ai_training_examples_version_idx").on(table.version),
}));

// Analytics Aggregations
export const analyticsAggregations = pgTable("analytics_aggregations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aggregationType: text("aggregation_type").notNull(), // daily, weekly, monthly
  metricCategory: text("metric_category").notNull(), // cross_enrollment, predictions, processing_times, outcomes
  
  // Time period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Dimensions
  programId: varchar("program_id").references(() => benefitPrograms.id),
  officeLocation: text("office_location"),
  countyCode: text("county_code"),
  
  // Metrics
  metrics: jsonb("metrics").notNull(), // Aggregated metrics
  
  // Metadata
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  periodIdx: index("analytics_aggregations_period_idx").on(table.periodStart, table.periodEnd),
  categoryIdx: index("analytics_aggregations_category_idx").on(table.metricCategory),
  programIdx: index("analytics_aggregations_program_idx").on(table.programId),
}));

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
  manualSection: one(manualSections, {
    fields: [snapIncomeLimits.manualSectionId],
    references: [manualSections.id],
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
  manualSection: one(manualSections, {
    fields: [snapDeductions.manualSectionId],
    references: [manualSections.id],
  }),
}));

export const snapAllotmentsRelations = relations(snapAllotments, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [snapAllotments.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  manualSection: one(manualSections, {
    fields: [snapAllotments.manualSectionId],
    references: [manualSections.id],
  }),
}));

// OHEP Relations
export const ohepIncomeLimitsRelations = relations(ohepIncomeLimits, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [ohepIncomeLimits.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  manualSection: one(manualSections, {
    fields: [ohepIncomeLimits.manualSectionId],
    references: [manualSections.id],
  }),
}));

export const ohepBenefitTiersRelations = relations(ohepBenefitTiers, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [ohepBenefitTiers.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  manualSection: one(manualSections, {
    fields: [ohepBenefitTiers.manualSectionId],
    references: [manualSections.id],
  }),
}));

export const ohepSeasonalFactorsRelations = relations(ohepSeasonalFactors, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [ohepSeasonalFactors.benefitProgramId],
    references: [benefitPrograms.id],
  }),
}));

// TANF Relations
export const tanfIncomeLimitsRelations = relations(tanfIncomeLimits, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [tanfIncomeLimits.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  manualSection: one(manualSections, {
    fields: [tanfIncomeLimits.manualSectionId],
    references: [manualSections.id],
  }),
}));

export const tanfAssetLimitsRelations = relations(tanfAssetLimits, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [tanfAssetLimits.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  manualSection: one(manualSections, {
    fields: [tanfAssetLimits.manualSectionId],
    references: [manualSections.id],
  }),
}));

export const tanfWorkRequirementsRelations = relations(tanfWorkRequirements, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [tanfWorkRequirements.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  manualSection: one(manualSections, {
    fields: [tanfWorkRequirements.manualSectionId],
    references: [manualSections.id],
  }),
}));

export const tanfTimeLimitsRelations = relations(tanfTimeLimits, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [tanfTimeLimits.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  manualSection: one(manualSections, {
    fields: [tanfTimeLimits.manualSectionId],
    references: [manualSections.id],
  }),
}));

// Medicaid Relations
export const medicaidIncomeLimitsRelations = relations(medicaidIncomeLimits, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [medicaidIncomeLimits.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  manualSection: one(manualSections, {
    fields: [medicaidIncomeLimits.manualSectionId],
    references: [manualSections.id],
  }),
}));

export const medicaidMAGIRulesRelations = relations(medicaidMAGIRules, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [medicaidMAGIRules.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  manualSection: one(manualSections, {
    fields: [medicaidMAGIRules.manualSectionId],
    references: [manualSections.id],
  }),
}));

export const medicaidNonMAGIRulesRelations = relations(medicaidNonMAGIRules, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [medicaidNonMAGIRules.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  manualSection: one(manualSections, {
    fields: [medicaidNonMAGIRules.manualSectionId],
    references: [manualSections.id],
  }),
}));

export const medicaidCategoriesRelations = relations(medicaidCategories, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [medicaidCategories.benefitProgramId],
    references: [benefitPrograms.id],
  }),
}));

// Tax Rules Relations
export const federalTaxBracketsRelations = relations(federalTaxBrackets, ({ one }) => ({
  creator: one(users, {
    fields: [federalTaxBrackets.createdBy],
    references: [users.id],
  }),
}));

export const federalStandardDeductionsRelations = relations(federalStandardDeductions, ({ one }) => ({
  creator: one(users, {
    fields: [federalStandardDeductions.createdBy],
    references: [users.id],
  }),
}));

export const eitcTablesRelations = relations(eitcTables, ({ one }) => ({
  creator: one(users, {
    fields: [eitcTables.createdBy],
    references: [users.id],
  }),
}));

export const ctcRulesRelations = relations(ctcRules, ({ one }) => ({
  creator: one(users, {
    fields: [ctcRules.createdBy],
    references: [users.id],
  }),
}));

export const marylandTaxRatesRelations = relations(marylandTaxRates, ({ one }) => ({
  creator: one(users, {
    fields: [marylandTaxRates.createdBy],
    references: [users.id],
  }),
}));

export const marylandCountyTaxRatesRelations = relations(marylandCountyTaxRates, ({ one }) => ({
  creator: one(users, {
    fields: [marylandCountyTaxRates.createdBy],
    references: [users.id],
  }),
}));

export const marylandStateCreditsRelations = relations(marylandStateCredits, ({ one }) => ({
  creator: one(users, {
    fields: [marylandStateCredits.createdBy],
    references: [users.id],
  }),
}));

export const categoricalEligibilityRulesRelations = relations(categoricalEligibilityRules, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [categoricalEligibilityRules.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  manualSection: one(manualSections, {
    fields: [categoricalEligibilityRules.manualSectionId],
    references: [manualSections.id],
  }),
}));

export const documentRequirementRulesRelations = relations(documentRequirementRules, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [documentRequirementRules.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  manualSection: one(manualSections, {
    fields: [documentRequirementRules.manualSectionId],
    references: [manualSections.id],
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

// ============================================================================
// CITATION TRACKING - Federal and State Source Citations with Variance Analysis
// ============================================================================

export const policyCitations = pgTable("policy_citations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleTable: text("rule_table").notNull(), // Which rule table this citation applies to
  ruleId: varchar("rule_id").notNull(), // ID of the rule
  citationType: text("citation_type").notNull(), // federal_regulation, state_regulation, federal_guidance, state_policy
  authority: text("authority").notNull(), // e.g., "7 CFR §273.10", "COMAR 10.01.01.15", "AT 24-17"
  sourceDocumentId: varchar("source_document_id").references(() => documents.id),
  sectionReference: text("section_reference"), // Specific section/page in source
  effectiveDate: timestamp("effective_date"),
  citationText: text("citation_text"), // Actual text from the source
  url: text("url"), // Direct link to source
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const policyVariances = pgTable("policy_variances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleTable: text("rule_table").notNull(),
  ruleId: varchar("rule_id").notNull(),
  federalCitationId: varchar("federal_citation_id").references(() => policyCitations.id),
  stateCitationId: varchar("state_citation_id").references(() => policyCitations.id),
  varianceType: text("variance_type").notNull(), // state_option, more_generous, less_generous, different_implementation
  explanation: text("explanation").notNull(), // Why Maryland differs from federal baseline
  federalAuthority: text("federal_authority"), // e.g., "7 CFR §273.2(j)(2) permits state option"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// NAVIGATOR WORKSPACE - Client Interaction Tracking for E&E Export
// ============================================================================

export const clientInteractionSessions = pgTable("client_interaction_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientCaseId: varchar("client_case_id").references(() => clientCases.id),
  navigatorId: varchar("navigator_id").references(() => users.id).notNull(),
  sessionType: text("session_type").notNull(), // screening, application_assist, recert_assist, documentation, follow_up
  interactionDate: timestamp("interaction_date").defaultNow().notNull(),
  durationMinutes: integer("duration_minutes"),
  location: text("location"), // office, phone, field_visit, video
  topicsDiscussed: jsonb("topics_discussed"), // Array of topics covered
  documentsReceived: jsonb("documents_received"), // Documents submitted during session
  documentsVerified: jsonb("documents_verified"), // Verification results
  actionItems: jsonb("action_items"), // Follow-up tasks
  notes: text("notes"),
  outcomeStatus: text("outcome_status"), // completed, needs_follow_up, referred, application_submitted
  
  // Accountability Pathway - Track client's progress through stages
  pathwayStage: text("pathway_stage"), // unaware, blame_others, wait_and_hope, acknowledge_reality, own_action, find_solutions, make_it_happen
  previousPathwayStage: text("previous_pathway_stage"), // Previous stage before transition
  pathwayTransitionedAt: timestamp("pathway_transitioned_at"), // When stage last changed
  pathwayNotes: text("pathway_notes"), // Navigator notes about pathway progress
  
  exportedToEE: boolean("exported_to_ee").default(false).notNull(),
  exportedAt: timestamp("exported_at"),
  exportBatchId: varchar("export_batch_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const eeExportBatches = pgTable("ee_export_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exportType: text("export_type").notNull(), // daily, weekly, manual
  sessionCount: integer("session_count").notNull(),
  exportFormat: text("export_format").notNull(), // csv, json, xml
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  exportedBy: varchar("exported_by").references(() => users.id).notNull(),
  exportedAt: timestamp("exported_at").defaultNow().notNull(),
  uploadedToEE: boolean("uploaded_to_ee").default(false).notNull(),
  uploadedAt: timestamp("uploaded_at"),
  uploadConfirmation: text("upload_confirmation"),
  notes: text("notes"),
});

// ============================================================================
// RULES EXTRACTION - Track AI-powered extraction of rules from manual sections
// ============================================================================

export const extractionJobs = pgTable("extraction_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  manualSectionId: varchar("manual_section_id").references(() => manualSections.id).notNull(),
  sectionNumber: text("section_number").notNull(),
  sectionTitle: text("section_title").notNull(),
  extractionType: text("extraction_type").notNull(), // income_limits, deductions, allotments, categorical_eligibility, document_requirements, full_auto
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed, reviewed, approved
  rulesExtracted: integer("rules_extracted").default(0).notNull(),
  extractedRules: jsonb("extracted_rules"), // JSON array of extracted rules before DB insertion
  errorMessage: text("error_message"),
  extractedBy: varchar("extracted_by").references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  reviewedAt: timestamp("reviewed_at"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// DOCUMENT VERIFICATION - Track verification results and requirements satisfaction
// ============================================================================

export const documentVerifications = pgTable("document_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  clientCaseId: varchar("client_case_id").references(() => clientCases.id),
  sessionId: varchar("session_id").references(() => clientInteractionSessions.id),
  requirementType: text("requirement_type").notNull(), // income, identity, residency, work_exemption, etc.
  verificationStatus: text("verification_status").notNull(), // verified, rejected, pending_review, expired
  isValid: boolean("is_valid").notNull(),
  confidenceScore: real("confidence_score"),
  satisfiesRequirements: jsonb("satisfies_requirements"), // Array of requirement IDs satisfied
  rejectionReasons: jsonb("rejection_reasons"), // Array of rejection reason strings
  warnings: jsonb("warnings"), // Array of warning strings
  extractedData: jsonb("extracted_data"), // Structured data extracted from document
  analysisResult: jsonb("analysis_result"), // Full Gemini Vision analysis
  validFrom: timestamp("valid_from").defaultNow().notNull(),
  validUntil: timestamp("valid_until"),
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verificationRequirementsMet = pgTable("verification_requirements_met", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verificationId: varchar("verification_id").references(() => documentVerifications.id, { onDelete: "cascade" }).notNull(),
  requirementId: varchar("requirement_id").references(() => documentRequirementRules.id).notNull(),
  clientCaseId: varchar("client_case_id").references(() => clientCases.id).notNull(),
  metAt: timestamp("met_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// CLIENT VERIFICATION DOCUMENTS - Navigator workspace document uploads
// ============================================================================

export const clientVerificationDocuments = pgTable("client_verification_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => clientInteractionSessions.id, { onDelete: "cascade" }).notNull(),
  clientCaseId: varchar("client_case_id").references(() => clientCases.id).notNull(),
  documentType: text("document_type").notNull(), // rent_receipt, utility_bill, pay_stub, bank_statement, medical_bill, childcare_receipt
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // Path in object storage
  fileSize: integer("file_size"), // in bytes
  mimeType: text("mime_type").notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  
  // Gemini Vision Analysis Results
  visionAnalysisStatus: text("vision_analysis_status").notNull().default("pending"), // pending, processing, completed, failed
  visionAnalysisError: text("vision_analysis_error"),
  extractedData: jsonb("extracted_data"), // Structured data: {amount, date, address, payee, etc.}
  rawVisionResponse: jsonb("raw_vision_response"), // Full Gemini Vision API response
  confidenceScore: real("confidence_score"), // 0-1 confidence in extraction accuracy
  
  // Validation and Review
  verificationStatus: text("verification_status").notNull().default("pending_review"), // pending_review, approved, rejected, needs_more_info
  validationWarnings: jsonb("validation_warnings"), // Array of warning messages
  validationErrors: jsonb("validation_errors"), // Array of error messages
  
  // Manual Review
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  manuallyEditedData: jsonb("manually_edited_data"), // If navigator corrects extracted data
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("client_verif_docs_session_idx").on(table.sessionId),
  clientCaseIdIdx: index("client_verif_docs_case_idx").on(table.clientCaseId),
  verificationStatusIdx: index("client_verif_docs_status_idx").on(table.verificationStatus),
}));

// ============================================================================
// CONSENT MANAGEMENT - Admin-Configurable Consent Forms
// ============================================================================

export const consentForms = pgTable("consent_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formName: text("form_name").notNull(),
  formCode: text("form_code").notNull().unique(), // benefits_disclosure, information_sharing, etc.
  formTitle: text("form_title").notNull(),
  formContent: text("form_content").notNull(), // HTML content editable by admin
  purpose: text("purpose").notNull(), // Description of why this consent is needed
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").default(false).notNull(),
  requiresSignature: boolean("requires_signature").default(true).notNull(),
  expirationDays: integer("expiration_days"), // How long consent is valid (null = indefinite)
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  effectiveDate: timestamp("effective_date"),
  endDate: timestamp("end_date"),
  
  // IRS-specific fields for Use & Disclosure Consent
  benefitPrograms: jsonb("benefit_programs"), // Array of program codes: ['snap', 'medicaid', 'tca', 'ohep']
  legalLanguageVersion: text("legal_language_version"), // Track IRS language version for compliance
  irsPublicationRef: text("irs_publication_ref"), // e.g., "Pub 4299 (2024)"
  disclosureScope: jsonb("disclosure_scope"), // Specific data elements authorized for disclosure
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Add index for code lookups
  formCodeIdx: index("consent_forms_code_idx").on(table.formCode),
}));

export const clientConsents = pgTable("client_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientCaseId: varchar("client_case_id").references(() => clientCases.id).notNull(),
  consentFormId: varchar("consent_form_id").references(() => consentForms.id).notNull(),
  sessionId: varchar("session_id").references(() => clientInteractionSessions.id),
  consentGiven: boolean("consent_given").notNull(),
  consentDate: timestamp("consent_date").defaultNow().notNull(),
  signatureData: text("signature_data"), // Base64 encoded signature image
  signatureMethod: text("signature_method"), // digital, wet_signature, verbal, electronic
  witnessedBy: varchar("witnessed_by").references(() => users.id),
  ipAddress: text("ip_address"),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  notes: text("notes"),
  metadata: jsonb("metadata"), // Additional consent metadata (benefitPrograms, userAgent, formVersion, etc.)
  
  // Enhanced signature metadata and IRS compliance tracking
  signatureMetadata: jsonb("signature_metadata"), // {typedName, date, ipAddress, userAgent, method}
  acceptedFormVersion: text("accepted_form_version"), // Version of form accepted (for audit)
  acceptedFormContent: text("accepted_form_content"), // Copy of accepted text (for legal record)
  benefitProgramsAuthorized: jsonb("benefit_programs_authorized"), // Programs authorized in this consent
  vitaIntakeSessionId: varchar("vita_intake_session_id").references(() => vitaIntakeSessions.id), // Link to VITA session
  userAgent: text("user_agent"), // Browser user agent
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Add indexes for common queries
  vitaSessionIdx: index("client_consents_vita_session_idx").on(table.vitaIntakeSessionId),
  formVersionIdx: index("client_consents_form_version_idx").on(table.acceptedFormVersion),
  clientCaseIdx: index("client_consents_client_case_idx").on(table.clientCaseId),
}));

// Relations for new tables
export const policyCitationsRelations = relations(policyCitations, ({ one }) => ({
  sourceDocument: one(documents, {
    fields: [policyCitations.sourceDocumentId],
    references: [documents.id],
  }),
}));

export const policyVariancesRelations = relations(policyVariances, ({ one }) => ({
  federalCitation: one(policyCitations, {
    fields: [policyVariances.federalCitationId],
    references: [policyCitations.id],
  }),
  stateCitation: one(policyCitations, {
    fields: [policyVariances.stateCitationId],
    references: [policyCitations.id],
  }),
}));

export const clientInteractionSessionsRelations = relations(clientInteractionSessions, ({ one }) => ({
  clientCase: one(clientCases, {
    fields: [clientInteractionSessions.clientCaseId],
    references: [clientCases.id],
  }),
  navigator: one(users, {
    fields: [clientInteractionSessions.navigatorId],
    references: [users.id],
  }),
}));

export const eeExportBatchesRelations = relations(eeExportBatches, ({ one }) => ({
  exportedByUser: one(users, {
    fields: [eeExportBatches.exportedBy],
    references: [users.id],
  }),
}));

export const consentFormsRelations = relations(consentForms, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [consentForms.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  creator: one(users, {
    fields: [consentForms.createdBy],
    references: [users.id],
  }),
}));

export const clientConsentsRelations = relations(clientConsents, ({ one }) => ({
  clientCase: one(clientCases, {
    fields: [clientConsents.clientCaseId],
    references: [clientCases.id],
  }),
  consentForm: one(consentForms, {
    fields: [clientConsents.consentFormId],
    references: [consentForms.id],
  }),
  session: one(clientInteractionSessions, {
    fields: [clientConsents.sessionId],
    references: [clientInteractionSessions.id],
  }),
  witness: one(users, {
    fields: [clientConsents.witnessedBy],
    references: [users.id],
  }),
}));

export const documentVerificationsRelations = relations(documentVerifications, ({ one }) => ({
  document: one(documents, {
    fields: [documentVerifications.documentId],
    references: [documents.id],
  }),
  clientCase: one(clientCases, {
    fields: [documentVerifications.clientCaseId],
    references: [clientCases.id],
  }),
  session: one(clientInteractionSessions, {
    fields: [documentVerifications.sessionId],
    references: [clientInteractionSessions.id],
  }),
  verifiedByUser: one(users, {
    fields: [documentVerifications.verifiedBy],
    references: [users.id],
  }),
}));

export const verificationRequirementsMetRelations = relations(verificationRequirementsMet, ({ one }) => ({
  verification: one(documentVerifications, {
    fields: [verificationRequirementsMet.verificationId],
    references: [documentVerifications.id],
  }),
  requirement: one(documentRequirementRules, {
    fields: [verificationRequirementsMet.requirementId],
    references: [documentRequirementRules.id],
  }),
  clientCase: one(clientCases, {
    fields: [verificationRequirementsMet.clientCaseId],
    references: [clientCases.id],
  }),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  role: z.enum(["client", "navigator", "caseworker", "admin"]).default("client"),
  email: z.string().email().optional(),
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

export const insertDocumentTypeSchema = createInsertSchema(documentTypes).omit({
  id: true,
});
export type InsertDocumentType = z.infer<typeof insertDocumentTypeSchema>;
export type DocumentType = typeof documentTypes.$inferSelect;

export const insertDhsFormSchema = createInsertSchema(dhsForms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  downloadedAt: true,
});
export type InsertDhsForm = z.infer<typeof insertDhsFormSchema>;
export type DhsForm = typeof dhsForms.$inferSelect;

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

export const insertClientCaseSchema = createInsertSchema(clientCases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPolicyCitationSchema = createInsertSchema(policyCitations).omit({
  id: true,
  createdAt: true,
});

export const insertPolicyVarianceSchema = createInsertSchema(policyVariances).omit({
  id: true,
  createdAt: true,
});

export const insertClientInteractionSessionSchema = createInsertSchema(clientInteractionSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEEExportBatchSchema = createInsertSchema(eeExportBatches).omit({
  id: true,
  exportedAt: true,
});

export const insertExtractionJobSchema = createInsertSchema(extractionJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsentFormSchema = createInsertSchema(consentForms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true, // Auto-incremented
}).extend({
  benefitPrograms: z.array(z.string()).optional(),
  disclosureScope: z.record(z.boolean()).optional(),
});

export const insertClientConsentSchema = createInsertSchema(clientConsents).omit({
  id: true,
  consentDate: true,
  createdAt: true,
}).extend({
  signatureMetadata: z.object({
    typedName: z.string(),
    date: z.string(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    method: z.enum(['electronic', 'verbal', 'physical']),
  }).optional(),
  benefitProgramsAuthorized: z.array(z.string()).optional(),
});

export const insertDocumentVerificationSchema = createInsertSchema(documentVerifications).omit({
  id: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVerificationRequirementMetSchema = createInsertSchema(verificationRequirementsMet).omit({
  id: true,
  metAt: true,
  createdAt: true,
});

export const insertClientVerificationDocumentSchema = createInsertSchema(clientVerificationDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuickRatingSchema = createInsertSchema(quickRatings).omit({
  id: true,
  createdAt: true,
});

export const insertFeedbackSubmissionSchema = createInsertSchema(feedbackSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  updatedAt: true,
});

export const insertNotificationTemplateSchema = createInsertSchema(notificationTemplates).omit({
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

// OHEP Types
export type OhepIncomeLimit = typeof ohepIncomeLimits.$inferSelect;
export type OhepBenefitTier = typeof ohepBenefitTiers.$inferSelect;
export type OhepSeasonalFactor = typeof ohepSeasonalFactors.$inferSelect;

// TANF Types
export type TanfIncomeLimit = typeof tanfIncomeLimits.$inferSelect;
export type TanfAssetLimit = typeof tanfAssetLimits.$inferSelect;
export type TanfWorkRequirement = typeof tanfWorkRequirements.$inferSelect;
export type TanfTimeLimit = typeof tanfTimeLimits.$inferSelect;

// Medicaid Types
export type MedicaidIncomeLimit = typeof medicaidIncomeLimits.$inferSelect;
export type MedicaidMAGIRule = typeof medicaidMAGIRules.$inferSelect;
export type MedicaidNonMAGIRule = typeof medicaidNonMAGIRules.$inferSelect;
export type MedicaidCategory = typeof medicaidCategories.$inferSelect;

// Tax Rules Types
export type FederalTaxBracket = typeof federalTaxBrackets.$inferSelect;
export type FederalStandardDeduction = typeof federalStandardDeductions.$inferSelect;
export type EitcTable = typeof eitcTables.$inferSelect;
export type CtcRule = typeof ctcRules.$inferSelect;
export type MarylandTaxRate = typeof marylandTaxRates.$inferSelect;
export type MarylandCountyTaxRate = typeof marylandCountyTaxRates.$inferSelect;
export type MarylandStateCredit = typeof marylandStateCredits.$inferSelect;

export type InsertCategoricalEligibilityRule = z.infer<typeof insertCategoricalEligibilityRuleSchema>;
export type CategoricalEligibilityRule = typeof categoricalEligibilityRules.$inferSelect;

export type InsertDocumentRequirementRule = z.infer<typeof insertDocumentRequirementRuleSchema>;
export type DocumentRequirementRule = typeof documentRequirementRules.$inferSelect;

export type InsertEligibilityCalculation = z.infer<typeof insertEligibilityCalculationSchema>;
export type EligibilityCalculation = typeof eligibilityCalculations.$inferSelect;

export type InsertRuleChangeLog = z.infer<typeof insertRuleChangeLogSchema>;
export type RuleChangeLog = typeof ruleChangeLogs.$inferSelect;

export type InsertClientCase = z.infer<typeof insertClientCaseSchema>;
export type ClientCase = typeof clientCases.$inferSelect;

export type InsertPolicyCitation = z.infer<typeof insertPolicyCitationSchema>;
export type PolicyCitation = typeof policyCitations.$inferSelect;

export type InsertPolicyVariance = z.infer<typeof insertPolicyVarianceSchema>;
export type PolicyVariance = typeof policyVariances.$inferSelect;

export type InsertClientInteractionSession = z.infer<typeof insertClientInteractionSessionSchema>;
export type ClientInteractionSession = typeof clientInteractionSessions.$inferSelect;

export type InsertEEExportBatch = z.infer<typeof insertEEExportBatchSchema>;
export type EEExportBatch = typeof eeExportBatches.$inferSelect;

export type InsertExtractionJob = z.infer<typeof insertExtractionJobSchema>;
export type ExtractionJob = typeof extractionJobs.$inferSelect;

export type InsertConsentForm = z.infer<typeof insertConsentFormSchema>;
export type ConsentForm = typeof consentForms.$inferSelect;

export type InsertClientConsent = z.infer<typeof insertClientConsentSchema>;
export type ClientConsent = typeof clientConsents.$inferSelect;

export type InsertDocumentVerification = z.infer<typeof insertDocumentVerificationSchema>;
export type DocumentVerification = typeof documentVerifications.$inferSelect;

export type InsertVerificationRequirementMet = z.infer<typeof insertVerificationRequirementMetSchema>;
export type VerificationRequirementMet = typeof verificationRequirementsMet.$inferSelect;

export type InsertClientVerificationDocument = z.infer<typeof insertClientVerificationDocumentSchema>;
export type ClientVerificationDocument = typeof clientVerificationDocuments.$inferSelect;

export type InsertQuickRating = z.infer<typeof insertQuickRatingSchema>;
export type QuickRating = typeof quickRatings.$inferSelect;

export type InsertFeedbackSubmission = z.infer<typeof insertFeedbackSubmissionSchema>;
export type FeedbackSubmission = typeof feedbackSubmissions.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferenceSchema>;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;

export type InsertNotificationTemplate = z.infer<typeof insertNotificationTemplateSchema>;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;

// Public Portal Tables

// Document Requirement Templates - Plain language explanations for DHS documents
export const documentRequirementTemplates = pgTable("document_requirement_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentType: text("document_type").notNull(), // e.g., "Proof of Income", "Identity Verification"
  dhsCategory: text("dhs_category").notNull(), // matches DHS notice categories
  plainLanguageTitle: text("plain_language_title").notNull(),
  explanation: text("explanation").notNull(), // What this document is
  examples: text("examples").array().notNull(), // List of example documents
  whereToGet: text("where_to_get"), // How/where to obtain
  commonMistakes: text("common_mistakes").array(), // What to avoid
  keywords: text("keywords").array(), // for matching AI-extracted text
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notice Templates - Common DHS notices explained
export const noticeTemplates = pgTable("notice_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noticeType: text("notice_type").notNull(), // e.g., "Approval", "Denial", "Renewal"
  noticeCode: text("notice_code"), // DHS notice code if available
  plainLanguageTitle: text("plain_language_title").notNull(),
  whatItMeans: text("what_it_means").notNull(), // Plain language explanation
  whatToDoNext: text("what_to_do_next"), // Required actions
  importantDeadlines: jsonb("important_deadlines"), // Array of {description, daysFrom}
  appealRights: text("appeal_rights"), // How to appeal if applicable
  keywords: text("keywords").array(), // for AI matching
  exampleText: text("example_text"), // Sample notice text
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Public FAQ - Pre-written Q&A for simple mode
export const publicFaq = pgTable("public_faq", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // income, resources, eligibility, deductions, etc.
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  relatedQuestions: text("related_questions").array(), // IDs of related FAQs
  keywords: text("keywords").array(), // for search
  sortOrder: integer("sort_order").default(0),
  viewCount: integer("view_count").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// POLICY CHANGE MONITORING - Phase 1 Feature
// ============================================================================

// Policy Changes - Aggregates related rule changes into coherent policy updates
export const policyChanges = pgTable("policy_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  changeTitle: text("change_title").notNull(), // e.g., "2025 COLA Adjustment"
  changeType: text("change_type").notNull(), // income_limit, deduction, allotment, categorical, document_requirement, multiple
  changeCategory: text("change_category").notNull(), // federal_mandate, state_policy, correction, clarification
  severity: text("severity").notNull().default("medium"), // low, medium, high, critical
  
  // Change details
  summary: text("summary").notNull(), // Plain language summary
  technicalDescription: text("technical_description"), // Technical details for staff
  impactAnalysis: text("impact_analysis"), // Who/what is affected
  effectiveDate: timestamp("effective_date").notNull(),
  
  // Related changes
  affectedRuleTables: text("affected_rule_tables").array(), // Which rule tables changed
  ruleChangeIds: text("rule_change_ids").array(), // Related rule_change_logs IDs
  documentVersionId: varchar("document_version_id").references(() => documentVersions.id), // Related document version
  
  // Diff information
  changesDiff: jsonb("changes_diff"), // Structured diff of what changed
  beforeSnapshot: jsonb("before_snapshot"), // State before change
  afterSnapshot: jsonb("after_snapshot"), // State after change
  
  // Notification & review
  status: text("status").notNull().default("pending"), // pending, reviewed, published, archived
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  publishedAt: timestamp("published_at"),
  notificationsSent: boolean("notifications_sent").notNull().default(false),
  
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  benefitProgramIdx: index("policy_changes_benefit_program_idx").on(table.benefitProgramId),
  effectiveDateIdx: index("policy_changes_effective_date_idx").on(table.effectiveDate),
  statusIdx: index("policy_changes_status_idx").on(table.status),
}));

// Policy Change Impacts - Tracks affected entities and users
export const policyChangeImpacts = pgTable("policy_change_impacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyChangeId: varchar("policy_change_id").references(() => policyChanges.id, { onDelete: "cascade" }).notNull(),
  
  // Impact scope
  impactType: text("impact_type").notNull(), // case, calculation, navigator, system
  impactSeverity: text("impact_severity").notNull(), // minimal, moderate, significant, major
  
  // Affected entities
  affectedEntityType: text("affected_entity_type"), // user, eligibility_calculation, navigator_session
  affectedEntityId: varchar("affected_entity_id"), // ID of affected entity
  affectedUserId: varchar("affected_user_id").references(() => users.id), // Direct user reference
  
  // Impact details
  impactDescription: text("impact_description").notNull(), // How this entity is affected
  actionRequired: boolean("action_required").notNull().default(false), // Does user need to take action?
  actionDescription: text("action_description"), // What action is needed
  actionDeadline: timestamp("action_deadline"), // When action must be taken
  
  // Notification tracking
  notified: boolean("notified").notNull().default(false),
  notifiedAt: timestamp("notified_at"),
  notificationId: varchar("notification_id").references(() => notifications.id),
  
  // Resolution tracking
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  policyChangeIdx: index("policy_change_impacts_policy_change_idx").on(table.policyChangeId),
  affectedUserIdx: index("policy_change_impacts_user_idx").on(table.affectedUserId),
  notifiedIdx: index("policy_change_impacts_notified_idx").on(table.notified),
}));

// Relations for policy changes
export const policyChangesRelations = relations(policyChanges, ({ one, many }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [policyChanges.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  documentVersion: one(documentVersions, {
    fields: [policyChanges.documentVersionId],
    references: [documentVersions.id],
  }),
  createdByUser: one(users, {
    fields: [policyChanges.createdBy],
    references: [users.id],
  }),
  reviewedByUser: one(users, {
    fields: [policyChanges.reviewedBy],
    references: [users.id],
  }),
  impacts: many(policyChangeImpacts),
}));

export const policyChangeImpactsRelations = relations(policyChangeImpacts, ({ one }) => ({
  policyChange: one(policyChanges, {
    fields: [policyChangeImpacts.policyChangeId],
    references: [policyChanges.id],
  }),
  affectedUser: one(users, {
    fields: [policyChangeImpacts.affectedUserId],
    references: [users.id],
  }),
  notification: one(notifications, {
    fields: [policyChangeImpacts.notificationId],
    references: [notifications.id],
  }),
}));

// Insert schemas for policy changes
export const insertPolicyChangeSchema = createInsertSchema(policyChanges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPolicyChangeImpactSchema = createInsertSchema(policyChangeImpacts).omit({
  id: true,
  createdAt: true,
});

// Types for policy changes
export type InsertPolicyChange = z.infer<typeof insertPolicyChangeSchema>;
export type PolicyChange = typeof policyChanges.$inferSelect;

export type InsertPolicyChangeImpact = z.infer<typeof insertPolicyChangeImpactSchema>;
export type PolicyChangeImpact = typeof policyChangeImpacts.$inferSelect;

// Insert schemas for public portal
export const insertDocumentRequirementTemplateSchema = createInsertSchema(documentRequirementTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNoticeTemplateSchema = createInsertSchema(noticeTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPublicFaqSchema = createInsertSchema(publicFaq).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for public portal
export type InsertDocumentRequirementTemplate = z.infer<typeof insertDocumentRequirementTemplateSchema>;
export type DocumentRequirementTemplate = typeof documentRequirementTemplates.$inferSelect;

export type InsertNoticeTemplate = z.infer<typeof insertNoticeTemplateSchema>;
export type NoticeTemplate = typeof noticeTemplates.$inferSelect;

export type InsertPublicFaq = z.infer<typeof insertPublicFaqSchema>;
export type PublicFaq = typeof publicFaq.$inferSelect;

// ============================================================================
// COMPLIANCE ASSURANCE SUITE - Phase 1, Task 4
// ============================================================================

// Compliance Rules - Regulatory requirements and validation rules
export const complianceRules = pgTable("compliance_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleCode: text("rule_code").notNull().unique(), // SNAP_FED_273.2, MD_SNAP_110.1, etc.
  title: text("title").notNull(),
  description: text("description").notNull(),
  ruleType: text("rule_type").notNull(), // federal_regulation, state_regulation, policy_content, data_quality, process_compliance
  category: text("category").notNull(), // eligibility, income, deductions, reporting, verification, etc.
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id),
  
  // Regulatory source
  sourceRegulation: text("source_regulation"), // 7 CFR 273.2, COMAR 10.09.24, etc.
  sourceSection: text("source_section"), // specific citation
  sourceUrl: text("source_url"), // link to official regulation
  
  // Validation logic
  validationPrompt: text("validation_prompt").notNull(), // Gemini prompt for validation
  validationCriteria: jsonb("validation_criteria"), // structured validation criteria
  severityLevel: text("severity_level").notNull().default("medium"), // low, medium, high, critical
  
  // Related entities
  relatedRuleIds: text("related_rule_ids").array(), // Related rules as code
  affectedSections: text("affected_sections").array(), // Policy manual sections this rule applies to
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  requiresManualReview: boolean("requires_manual_review").default(false).notNull(),
  
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  ruleTypeIdx: index("compliance_rules_type_idx").on(table.ruleType),
  categoryIdx: index("compliance_rules_category_idx").on(table.category),
  benefitProgramIdx: index("compliance_rules_benefit_program_idx").on(table.benefitProgramId),
}));

// Compliance Violations - Track when compliance rules are violated
export const complianceViolations = pgTable("compliance_violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  complianceRuleId: varchar("compliance_rule_id").references(() => complianceRules.id).notNull(),
  
  // Violation context
  violationType: text("violation_type").notNull(), // content_mismatch, missing_data, invalid_calculation, process_deviation
  severity: text("severity").notNull(), // low, medium, high, critical (inherited from rule or assessed)
  
  // What was violated
  entityType: text("entity_type").notNull(), // rule_extraction, policy_content, user_input, calculation, document
  entityId: varchar("entity_id"), // ID of the violated entity
  violationContext: jsonb("violation_context").notNull(), // detailed context of the violation
  
  // Violation details
  detectedValue: text("detected_value"), // what was found
  expectedValue: text("expected_value"), // what was expected
  aiAnalysis: text("ai_analysis"), // Gemini's analysis of the violation
  confidenceScore: real("confidence_score"), // 0-1 confidence in the violation detection
  
  // Resolution
  status: text("status").notNull().default("open"), // open, acknowledged, resolved, dismissed
  resolution: text("resolution"), // how it was resolved
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  
  // Audit
  detectedBy: varchar("detected_by").references(() => users.id), // user who triggered the check, or 'system'
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  ruleIdIdx: index("compliance_violations_rule_idx").on(table.complianceRuleId),
  statusIdx: index("compliance_violations_status_idx").on(table.status),
  severityIdx: index("compliance_violations_severity_idx").on(table.severity),
  entityIdx: index("compliance_violations_entity_idx").on(table.entityType, table.entityId),
}));

// Relations for compliance assurance
export const complianceRulesRelations = relations(complianceRules, ({ one, many }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [complianceRules.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  createdByUser: one(users, {
    fields: [complianceRules.createdBy],
    references: [users.id],
  }),
  violations: many(complianceViolations),
}));

export const complianceViolationsRelations = relations(complianceViolations, ({ one }) => ({
  complianceRule: one(complianceRules, {
    fields: [complianceViolations.complianceRuleId],
    references: [complianceRules.id],
  }),
  detectedByUser: one(users, {
    fields: [complianceViolations.detectedBy],
    references: [users.id],
  }),
  resolvedByUser: one(users, {
    fields: [complianceViolations.resolvedBy],
    references: [users.id],
  }),
}));

// Insert schemas for compliance assurance
export const insertComplianceRuleSchema = createInsertSchema(complianceRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceViolationSchema = createInsertSchema(complianceViolations).omit({
  id: true,
  createdAt: true,
});

// Types for compliance assurance
export type InsertComplianceRule = z.infer<typeof insertComplianceRuleSchema>;
export type ComplianceRule = typeof complianceRules.$inferSelect;

export type InsertComplianceViolation = z.infer<typeof insertComplianceViolationSchema>;
export type ComplianceViolation = typeof complianceViolations.$inferSelect;

// ===== ADAPTIVE INTAKE COPILOT SCHEMA =====

// Intake Sessions - Conversational application intake sessions
export const intakeSessions = pgTable("intake_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Session context
  userId: varchar("user_id").references(() => users.id),
  sessionType: text("session_type").notNull().default("snap_application"), // snap_application, recertification, change_report
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id),
  
  // Session state
  status: text("status").notNull().default("active"), // active, completed, abandoned, exported
  currentStep: text("current_step"), // household_info, income, expenses, etc.
  progress: integer("progress").default(0), // 0-100 percentage
  
  // Conversation metadata
  messageCount: integer("message_count").default(0),
  lastMessageAt: timestamp("last_message_at"),
  
  // Extracted data summary
  extractedData: jsonb("extracted_data"), // Accumulated structured data
  dataCompleteness: real("data_completeness").default(0), // 0-1 score for how complete the application is
  missingFields: text("missing_fields").array(), // Fields still needed
  
  // E&E export
  exportedToEE: boolean("exported_to_ee").default(false),
  exportedAt: timestamp("exported_at"),
  eeApplicationId: text("ee_application_id"), // ID from E&E system
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("intake_sessions_user_idx").on(table.userId),
  statusIdx: index("intake_sessions_status_idx").on(table.status),
}));

// Intake Messages - Conversation messages between user and AI copilot
export const intakeMessages = pgTable("intake_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => intakeSessions.id, { onDelete: "cascade" }).notNull(),
  
  // Message content
  role: text("role").notNull(), // user, assistant, system
  content: text("content").notNull(),
  
  // AI context
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  model: text("model"), // gemini-2.0-flash, etc.
  
  // Data extraction
  extractedFields: jsonb("extracted_fields"), // Fields extracted from this message
  confidenceScores: jsonb("confidence_scores"), // Confidence for each extracted field
  
  // Follow-up questions
  suggestedQuestions: text("suggested_questions").array(), // Next questions to ask
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("intake_messages_session_idx").on(table.sessionId),
}));

// Application Forms - Structured SNAP applications ready for E&E export
export const applicationForms = pgTable("application_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => intakeSessions.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id),
  
  // Applicant information
  applicantInfo: jsonb("applicant_info").notNull(), // name, dob, ssn, contact
  
  // Household composition
  householdMembers: jsonb("household_members").notNull(), // array of household members
  householdSize: integer("household_size").notNull(),
  
  // Income information
  incomeInfo: jsonb("income_info").notNull(), // sources, amounts, frequency
  totalMonthlyIncome: real("total_monthly_income"),
  
  // Expense information
  expenseInfo: jsonb("expense_info"), // rent, utilities, medical, etc.
  totalMonthlyExpenses: real("total_monthly_expenses"),
  
  // Assets
  assetInfo: jsonb("asset_info"), // bank accounts, vehicles, property
  
  // Special circumstances
  categoricalEligibility: boolean("categorical_eligibility").default(false),
  expeditedService: boolean("expedited_service").default(false),
  specialCircumstances: jsonb("special_circumstances"),
  
  // Eligibility calculation
  eligibilityResult: jsonb("eligibility_result"), // From rules engine
  estimatedBenefit: real("estimated_benefit"),
  
  // E&E export
  eeExportData: jsonb("ee_export_data"), // Formatted for E&E system
  exportStatus: text("export_status").default("draft"), // draft, ready, exported, error
  exportedAt: timestamp("exported_at"),
  
  // Verification
  verificationStatus: text("verification_status").default("pending"), // pending, in_progress, verified, rejected
  requiredDocuments: text("required_documents").array(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("application_forms_session_idx").on(table.sessionId),
  userIdIdx: index("application_forms_user_idx").on(table.userId),
  exportStatusIdx: index("application_forms_export_status_idx").on(table.exportStatus),
}));

// ===== ANONYMOUS SCREENING SESSIONS SCHEMA =====

// Anonymous Screening Sessions - Store results from /screener for anonymous users
export const anonymousScreeningSessions = pgTable("anonymous_screening_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Session identifier (used for retrieval before account creation)
  sessionId: varchar("session_id").notNull().unique(), // Browser session ID or generated ID
  
  // User association (null for anonymous, set when claimed)
  userId: varchar("user_id").references(() => users.id),
  claimedAt: timestamp("claimed_at"), // When user saved by creating account
  
  // Household input data
  householdData: jsonb("household_data").notNull(), // All form inputs from screener
  
  // PolicyEngine calculation results
  benefitResults: jsonb("benefit_results").notNull(), // Full PolicyEngine response
  
  // Summary metrics
  totalMonthlyBenefits: real("total_monthly_benefits").default(0),
  totalYearlyBenefits: real("total_yearly_benefits").default(0),
  eligibleProgramCount: integer("eligible_program_count").default(0),
  
  // State information
  stateCode: text("state_code").notNull(),
  
  // Metadata
  ipAddress: text("ip_address"), // For rate limiting/fraud detection
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("anonymous_screening_session_idx").on(table.sessionId),
  userIdIdx: index("anonymous_screening_user_idx").on(table.userId),
  createdAtIdx: index("anonymous_screening_created_idx").on(table.createdAt),
}));

// ============================================================================
// Household Scenario Workspace
// ============================================================================

// Household scenarios for what-if modeling and benefit comparison
export const householdScenarios = pgTable("household_scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Ownership and metadata
  userId: varchar("user_id").references(() => users.id).notNull(), // Navigator who created scenario
  name: text("name").notNull(), // e.g., "Client A - With Job", "Client A - Disabled + Child Care"
  description: text("description"), // Notes about this scenario
  
  // Household configuration (input data only)
  householdData: jsonb("household_data").notNull(), // Same structure as PolicyEngine input
  
  // State information
  stateCode: text("state_code").notNull().default("MD"),
  
  // Tags for organization
  tags: text("tags").array(), // e.g., ["employment-change", "disability", "high-priority"]
  
  // Client association (optional - for tracking which scenarios relate to which client)
  clientIdentifier: text("client_identifier"), // Could be case number, client ID, etc.
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("household_scenarios_user_idx").on(table.userId),
  clientIdIdx: index("household_scenarios_client_idx").on(table.clientIdentifier),
  createdAtIdx: index("household_scenarios_created_idx").on(table.createdAt),
}));

// Scenario calculations - tracks PolicyEngine results for scenarios over time
export const scenarioCalculations = pgTable("scenario_calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Scenario reference
  scenarioId: varchar("scenario_id").references(() => householdScenarios.id, { onDelete: "cascade" }).notNull(),
  
  // PolicyEngine calculation results
  benefitResults: jsonb("benefit_results").notNull(), // Full PolicyEngine response
  
  // Summary metrics (denormalized for performance)
  totalMonthlyBenefits: real("total_monthly_benefits").default(0),
  totalYearlyBenefits: real("total_yearly_benefits").default(0),
  eligibleProgramCount: integer("eligible_program_count").default(0),
  snapAmount: real("snap_amount").default(0),
  medicaidEligible: boolean("medicaid_eligible").default(false),
  eitcAmount: real("eitc_amount").default(0),
  childTaxCreditAmount: real("child_tax_credit_amount").default(0),
  ssiAmount: real("ssi_amount").default(0),
  tanfAmount: real("tanf_amount").default(0),
  
  // Calculation metadata
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  calculationVersion: text("calculation_version"), // Track PolicyEngine version used
  notes: text("notes"), // Optional notes about this calculation run
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  scenarioIdIdx: index("scenario_calculations_scenario_idx").on(table.scenarioId),
  calculatedAtIdx: index("scenario_calculations_calculated_idx").on(table.calculatedAt),
}));

// Household Profiles - Unified data collection for both benefits and tax
export const householdProfiles = pgTable("household_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Ownership
  userId: varchar("user_id").references(() => users.id).notNull(), // Navigator/preparer who created profile
  name: text("name").notNull(), // e.g., "Smith Family", "Client 12345"
  
  // Profile mode - determines which fields are required
  profileMode: text("profile_mode").notNull(), // 'combined', 'benefits_only', 'tax_only'
  
  // Basic demographic info (all modes)
  householdSize: integer("household_size").notNull(),
  stateCode: text("state_code").notNull().default("MD"),
  county: text("county"), // Maryland county for tax calculations
  
  // Income info (all modes)
  employmentIncome: real("employment_income").default(0),
  unearnedIncome: real("unearned_income").default(0),
  selfEmploymentIncome: real("self_employment_income").default(0),
  
  // Benefits-specific fields
  householdAssets: real("household_assets").default(0),
  rentOrMortgage: real("rent_or_mortgage").default(0),
  utilityCosts: real("utility_costs").default(0),
  medicalExpenses: real("medical_expenses").default(0),
  childcareExpenses: real("childcare_expenses").default(0),
  elderlyOrDisabled: boolean("elderly_or_disabled").default(false),
  
  // Tax-specific fields
  filingStatus: text("filing_status"), // 'single', 'married_joint', 'married_separate', 'head_of_household'
  
  // Taxpayer info (tax mode)
  taxpayerFirstName: text("taxpayer_first_name"),
  taxpayerLastName: text("taxpayer_last_name"),
  taxpayerSSN: jsonb("taxpayer_ssn"), // Encrypted EncryptionResult
  taxpayerDateOfBirth: date("taxpayer_date_of_birth"),
  taxpayerBlind: boolean("taxpayer_blind").default(false),
  taxpayerDisabled: boolean("taxpayer_disabled").default(false),
  
  // Spouse info (tax mode, married filers)
  spouseFirstName: text("spouse_first_name"),
  spouseLastName: text("spouse_last_name"),
  spouseSSN: jsonb("spouse_ssn"), // Encrypted EncryptionResult
  spouseDateOfBirth: date("spouse_date_of_birth"),
  spouseBlind: boolean("spouse_blind").default(false),
  spouseDisabled: boolean("spouse_disabled").default(false),
  
  // Address (tax mode)
  streetAddress: text("street_address"),
  aptNumber: text("apt_number"),
  city: text("city"),
  zipCode: text("zip_code"),
  
  // Dependents (stored as JSONB for flexibility)
  dependents: jsonb("dependents").default([]), // Array of dependent objects
  
  // Additional tax info
  wageWithholding: real("wage_withholding").default(0),
  estimatedTaxPayments: real("estimated_tax_payments").default(0),
  
  // Client association
  clientCaseId: varchar("client_case_id").references(() => clientCases.id),
  clientIdentifier: text("client_identifier"), // Case number or other ID
  
  // Metadata
  notes: text("notes"),
  tags: text("tags").array(),
  isActive: boolean("is_active").notNull().default(true),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("household_profiles_user_idx").on(table.userId),
  clientCaseIdIdx: index("household_profiles_case_idx").on(table.clientCaseId),
  stateCodeIdx: index("household_profiles_state_code_idx").on(table.stateCode),
  profileModeIdx: index("household_profiles_mode_idx").on(table.profileMode),
  isActiveIdx: index("household_profiles_active_idx").on(table.isActive),
}));

export type HouseholdProfile = typeof householdProfiles.$inferSelect;
export type InsertHouseholdProfile = typeof householdProfiles.$inferInsert;

// Insert schema for household profiles
export const insertHouseholdProfileSchema = createInsertSchema(householdProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// VITA Intake Sessions - Digital Form 13614-C for VITA tax assistance
export const vitaIntakeSessions = pgTable("vita_intake_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Ownership & session management
  userId: varchar("user_id").references(() => users.id).notNull(), // Navigator/preparer
  tenantId: varchar("tenant_id"), // Multi-tenant isolation - relation defined below
  clientCaseId: varchar("client_case_id").references(() => clientCases.id),
  householdProfileId: varchar("household_profile_id").references(() => householdProfiles.id), // Optional pre-fill
  
  // Session status
  status: text("status").notNull().default("in_progress"), // 'in_progress', 'review_needed', 'completed', 'filed'
  currentStep: integer("current_step").default(1), // Which step of the wizard (1-5)
  
  // Section 1: Personal Information (Form 13614-C Page 1)
  // Primary taxpayer
  primaryFirstName: text("primary_first_name"),
  primaryMiddleInitial: text("primary_middle_initial"),
  primaryLastName: text("primary_last_name"),
  primaryDateOfBirth: date("primary_date_of_birth"),
  primaryJobTitle: text("primary_job_title"),
  primaryTelephone: text("primary_telephone"),
  primarySSN: jsonb("primary_ssn"), // Encrypted EncryptionResult
  
  // Spouse
  spouseFirstName: text("spouse_first_name"),
  spouseMiddleInitial: text("spouse_middle_initial"),
  spouseLastName: text("spouse_last_name"),
  spouseDateOfBirth: date("spouse_date_of_birth"),
  spouseJobTitle: text("spouse_job_title"),
  spouseTelephone: text("spouse_telephone"),
  spouseSSN: jsonb("spouse_ssn"), // Encrypted EncryptionResult
  
  // Address
  mailingAddress: text("mailing_address"),
  aptNumber: text("apt_number"),
  city: text("city"),
  state: text("state").default("MD"),
  zipCode: text("zip_code"),
  email: text("email"),
  
  // Multi-state presence
  livedOrWorkedInMultipleStates: boolean("lived_or_worked_in_multiple_states").default(false),
  
  // Status flags
  canAnyoneClaimYou: boolean("can_anyone_claim_you").default(false),
  primaryLegallyBlind: boolean("primary_legally_blind").default(false),
  spouseLegallyBlind: boolean("spouse_legally_blind").default(false),
  primaryUSCitizen: boolean("primary_us_citizen").default(true),
  spouseUSCitizen: boolean("spouse_us_citizen").default(true),
  primaryOnVisa: boolean("primary_on_visa").default(false),
  spouseOnVisa: boolean("spouse_on_visa").default(false),
  primaryFullTimeStudent: boolean("primary_full_time_student").default(false),
  spouseFullTimeStudent: boolean("spouse_full_time_student").default(false),
  primaryTotallyPermanentlyDisabled: boolean("primary_totally_permanently_disabled").default(false),
  spouseTotallyPermanentlyDisabled: boolean("spouse_totally_permanently_disabled").default(false),
  primaryIssuedIPPIN: boolean("primary_issued_ippin").default(false), // Identity Protection PIN
  spouseIssuedIPPIN: boolean("spouse_issued_ippin").default(false),
  primaryOwnerDigitalAssets: boolean("primary_owner_digital_assets").default(false),
  spouseOwnerDigitalAssets: boolean("spouse_owner_digital_assets").default(false),
  
  // Refund preferences
  refundMethod: text("refund_method"), // 'direct_deposit', 'check', 'apply_to_next_year'
  bankAccountNumber: jsonb("bank_account_number"), // Encrypted EncryptionResult
  bankRoutingNumber: jsonb("bank_routing_number"), // Encrypted EncryptionResult
  
  // IRS preferences
  preferredIRSLanguage: text("preferred_irs_language"),
  
  // Presidential Election Campaign Fund
  primaryPresidentialCampaignFund: boolean("primary_presidential_campaign_fund").default(false),
  spousePresidentialCampaignFund: boolean("spouse_presidential_campaign_fund").default(false),
  
  // Section 2: Marital Status & Household (Form 13614-C Page 2)
  maritalStatusDec31: text("marital_status_dec_31"), // 'single', 'married', 'divorced', 'widowed', 'legally_separated'
  marriedOnLastDay: boolean("married_on_last_day"),
  livedApartLast6Months: boolean("lived_apart_last_6_months").default(false),
  separationDate: date("separation_date"),
  divorceDate: date("divorce_date"),
  
  // Dependents - stored as JSONB array
  // Each dependent: { name, dateOfBirth, relationship, monthsInHome, singleOrMarried, usCitizen, 
  //   fullTimeStudent, permanentlyDisabled, issuedIPPIN, qualifyingChildOfOther, 
  //   providedOwnSupport, hadIncomeLessThan5200, taxpayerProvidedSupport, taxpayerPaidHalfCostHome }
  dependents: jsonb("dependents").default([]),
  
  // Section 3: Income (Form 13614-C Page 3)
  // Employment income
  hasW2Income: boolean("has_w2_income").default(false),
  w2JobCount: integer("w2_job_count").default(0),
  hasTips: boolean("has_tips").default(false),
  
  // Retirement & benefits
  hasRetirementIncome: boolean("has_retirement_income").default(false),
  hasQualifiedCharitableDistribution: boolean("has_qualified_charitable_distribution").default(false),
  qcdAmount: real("qcd_amount").default(0),
  hasDisabilityIncome: boolean("has_disability_income").default(false),
  hasSocialSecurityIncome: boolean("has_social_security_income").default(false),
  hasUnemploymentIncome: boolean("has_unemployment_income").default(false),
  
  // State/local refund
  hasStateLocalRefund: boolean("has_state_local_refund").default(false),
  stateLocalRefundAmount: real("state_local_refund_amount").default(0),
  itemizedLastYear: boolean("itemized_last_year").default(false),
  
  // Investment income
  hasInterestIncome: boolean("has_interest_income").default(false),
  hasDividendIncome: boolean("has_dividend_income").default(false),
  hasCapitalGains: boolean("has_capital_gains").default(false),
  reportedLossLastYear: boolean("reported_loss_last_year").default(false),
  hasCapitalLossCarryover: boolean("has_capital_loss_carryover").default(false),
  
  // Alimony
  hasAlimonyIncome: boolean("has_alimony_income").default(false),
  alimonyAmount: real("alimony_amount").default(0),
  
  // Rental income
  hasRentalIncome: boolean("has_rental_income").default(false),
  rentedDwellingAsResidence: boolean("rented_dwelling_as_residence").default(false),
  rentedFewerThan15Days: boolean("rented_fewer_than_15_days").default(false),
  rentalExpenseAmount: real("rental_expense_amount").default(0),
  hasPersonalPropertyRental: boolean("has_personal_property_rental").default(false),
  
  // Gambling
  hasGamblingIncome: boolean("has_gambling_income").default(false),
  
  // Self-employment
  hasSelfEmploymentIncome: boolean("has_self_employment_income").default(false),
  reportedSelfEmploymentLossLastYear: boolean("reported_self_employment_loss_last_year").default(false),
  scheduleCExpenses: real("schedule_c_expenses").default(0),
  
  // Other income
  hasOtherIncome: boolean("has_other_income").default(false),
  otherIncomeDescription: text("other_income_description"),
  
  // Section 4: Deductions & Credits (Form 13614-C Page 4)
  // Education
  hasStudentLoanInterest: boolean("has_student_loan_interest").default(false),
  hasTuitionExpenses: boolean("has_tuition_expenses").default(false),
  
  // Childcare & dependents
  hasChildcareExpenses: boolean("has_childcare_expenses").default(false),
  hasAdoptionExpenses: boolean("has_adoption_expenses").default(false),
  
  // Energy
  hasEnergyImprovements: boolean("has_energy_improvements").default(false),
  
  // Health
  hasHealthCoverage: boolean("has_health_coverage").default(false),
  purchasedMarketplaceInsurance: boolean("purchased_marketplace_insurance").default(false),
  hasForm1095A: boolean("has_form_1095a").default(false),
  
  // Charitable
  hasCharitableContributions: boolean("has_charitable_contributions").default(false),
  
  // Homeownership
  hasMortgageInterest: boolean("has_mortgage_interest").default(false),
  soldHome: boolean("sold_home").default(false),
  
  // Medical
  hasMedicalExpenses: boolean("has_medical_expenses").default(false),
  
  // Tax payments
  hasEstimatedTaxPayments: boolean("has_estimated_tax_payments").default(false),
  
  // Retirement contributions
  hasRetirementContributions: boolean("has_retirement_contributions").default(false),
  
  // Life events and situations (Page 5)
  receivedAdvancedChildTaxCredit: boolean("received_advanced_child_tax_credit").default(false),
  receivedEconomicImpactPayment: boolean("received_economic_impact_payment").default(false),
  hadDebtForgiven: boolean("had_debt_forgiven").default(false),
  receivedStateLocalStimulus: boolean("received_state_local_stimulus").default(false),
  receivedDisasterRelief: boolean("received_disaster_relief").default(false),
  
  // Document tracking
  uploadedDocuments: jsonb("uploaded_documents").default([]), // Array of { type, filename, extractedData }
  missingDocuments: text("missing_documents").array(),
  
  // Quality review (for navigator)
  reviewStatus: text("review_status"), // 'pending', 'in_review', 'approved', 'needs_correction'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  certificationLevel: text("certification_level"), // 'basic', 'advanced', 'military'
  
  // Consent & signatures
  globalCarryForwardConsent: boolean("global_carry_forward_consent").default(false),
  primaryTaxpayerSignature: text("primary_taxpayer_signature"),
  primaryTaxpayerSignedAt: timestamp("primary_taxpayer_signed_at"),
  spouseTaxpayerSignature: text("spouse_taxpayer_signature"),
  spouseTaxpayerSignedAt: timestamp("spouse_taxpayer_signed_at"),
  
  // Optional demographic questions (not transmitted to IRS)
  englishConversationLevel: text("english_conversation_level"), // 'very_well', 'well', 'not_well', 'not_at_all', 'prefer_not_to_answer'
  englishReadingLevel: text("english_reading_level"),
  hasDisabilityInHousehold: boolean("has_disability_in_household"),
  isVeteran: boolean("is_veteran"),
  primaryRaceEthnicity: text("primary_race_ethnicity").array(),
  spouseRaceEthnicity: text("spouse_race_ethnicity").array(),
  
  // Notes & metadata
  additionalNotes: text("additional_notes"),
  internalNotes: text("internal_notes"), // For navigator use only
  
  // Timestamps
  completedAt: timestamp("completed_at"),
  filedAt: timestamp("filed_at"),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("vita_intake_user_idx").on(table.userId),
  clientCaseIdIdx: index("vita_intake_case_idx").on(table.clientCaseId),
  statusIdx: index("vita_intake_status_idx").on(table.status),
  reviewStatusIdx: index("vita_intake_review_idx").on(table.reviewStatus),
  createdAtIdx: index("vita_intake_created_idx").on(table.createdAt),
}));

export type VitaIntakeSession = typeof vitaIntakeSessions.$inferSelect;
export type InsertVitaIntakeSession = typeof vitaIntakeSessions.$inferInsert;

// Insert schema for VITA intake sessions
export const insertVitaIntakeSessionSchema = createInsertSchema(vitaIntakeSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Scenario comparisons - groups scenarios for side-by-side analysis
export const scenarioComparisons = pgTable("scenario_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Ownership
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Comparison metadata
  name: text("name").notNull(), // e.g., "Client A - Employment Options", "Family Benefits Analysis"
  description: text("description"),
  
  // Scenarios to compare (array of scenario IDs)
  scenarioIds: text("scenario_ids").array().notNull(), // References householdScenarios.id
  
  // Export/sharing
  exportedAt: timestamp("exported_at"), // When this was exported as PDF/report
  exportFormat: text("export_format"), // pdf, csv, json
  sharedWith: text("shared_with").array(), // User IDs who have access
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("scenario_comparisons_user_idx").on(table.userId),
  createdAtIdx: index("scenario_comparisons_created_idx").on(table.createdAt),
}));

// Relations for intake copilot
export const intakeSessionsRelations = relations(intakeSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [intakeSessions.userId],
    references: [users.id],
  }),
  benefitProgram: one(benefitPrograms, {
    fields: [intakeSessions.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  messages: many(intakeMessages),
  applicationForm: one(applicationForms, {
    fields: [intakeSessions.id],
    references: [applicationForms.sessionId],
  }),
}));

export const intakeMessagesRelations = relations(intakeMessages, ({ one }) => ({
  session: one(intakeSessions, {
    fields: [intakeMessages.sessionId],
    references: [intakeSessions.id],
  }),
}));

export const applicationFormsRelations = relations(applicationForms, ({ one }) => ({
  session: one(intakeSessions, {
    fields: [applicationForms.sessionId],
    references: [intakeSessions.id],
  }),
  user: one(users, {
    fields: [applicationForms.userId],
    references: [users.id],
  }),
  benefitProgram: one(benefitPrograms, {
    fields: [applicationForms.benefitProgramId],
    references: [benefitPrograms.id],
  }),
}));

// Insert schemas for intake copilot
export const insertIntakeSessionSchema = createInsertSchema(intakeSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntakeMessageSchema = createInsertSchema(intakeMessages).omit({
  id: true,
  createdAt: true,
});

export const insertApplicationFormSchema = createInsertSchema(applicationForms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for intake copilot
export type InsertIntakeSession = z.infer<typeof insertIntakeSessionSchema>;
export type IntakeSession = typeof intakeSessions.$inferSelect;

export type InsertIntakeMessage = z.infer<typeof insertIntakeMessageSchema>;
export type IntakeMessage = typeof intakeMessages.$inferSelect;

export type InsertApplicationForm = z.infer<typeof insertApplicationFormSchema>;
export type ApplicationForm = typeof applicationForms.$inferSelect;

// Insert schemas for anonymous screening
export const insertAnonymousScreeningSessionSchema = createInsertSchema(anonymousScreeningSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for anonymous screening
export type InsertAnonymousScreeningSession = z.infer<typeof insertAnonymousScreeningSessionSchema>;
export type AnonymousScreeningSession = typeof anonymousScreeningSessions.$inferSelect;

// PolicyEngine verification tracking
export const policyEngineVerifications = pgTable("policy_engine_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  
  // What we're verifying
  verificationType: text("verification_type").notNull(), // rules_calculation, eligibility_check, benefit_amount
  inputData: jsonb("input_data").notNull(), // household data used for calculation
  
  // Our system's result (from Rules as Code)
  ourResult: jsonb("our_result"),
  ourCalculationMethod: text("our_calculation_method"), // which rule/logic we used
  
  // PolicyEngine's result
  policyEngineResult: jsonb("policy_engine_result"),
  policyEngineVersion: text("policy_engine_version"),
  
  // Comparison
  variance: real("variance"), // numeric difference if applicable
  variancePercentage: real("variance_percentage"),
  isMatch: boolean("is_match"), // true if results match within tolerance
  confidenceScore: real("confidence_score"), // 0-1 confidence in our result
  
  // Metadata
  sessionId: text("session_id"), // link to intake session, scenario, etc.
  performedBy: varchar("performed_by").references(() => users.id),
  errorDetails: text("error_details"), // if verification failed
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  benefitProgramIdx: index("pe_verifications_program_idx").on(table.benefitProgramId),
  isMatchIdx: index("pe_verifications_match_idx").on(table.isMatch),
  createdAtIdx: index("pe_verifications_created_idx").on(table.createdAt),
}));

export const policyEngineVerificationsRelations = relations(policyEngineVerifications, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [policyEngineVerifications.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  user: one(users, {
    fields: [policyEngineVerifications.performedBy],
    references: [users.id],
  }),
}));

export const insertPolicyEngineVerificationSchema = createInsertSchema(policyEngineVerifications).omit({
  id: true,
  createdAt: true,
});

export type InsertPolicyEngineVerification = z.infer<typeof insertPolicyEngineVerificationSchema>;
export type PolicyEngineVerification = typeof policyEngineVerifications.$inferSelect;

// Insert schemas for household scenario workspace
export const insertHouseholdScenarioSchema = createInsertSchema(householdScenarios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScenarioCalculationSchema = createInsertSchema(scenarioCalculations).omit({
  id: true,
  createdAt: true,
});

export const insertScenarioComparisonSchema = createInsertSchema(scenarioComparisons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for household scenario workspace
export type InsertHouseholdScenario = z.infer<typeof insertHouseholdScenarioSchema>;
export type HouseholdScenario = typeof householdScenarios.$inferSelect;
export type InsertScenarioCalculation = z.infer<typeof insertScenarioCalculationSchema>;
export type ScenarioCalculation = typeof scenarioCalculations.$inferSelect;
export type InsertScenarioComparison = z.infer<typeof insertScenarioComparisonSchema>;
export type ScenarioComparison = typeof scenarioComparisons.$inferSelect;

// ============================================================================
// ABAWD EXEMPTION VERIFICATION - SNAP Work Requirements
// ============================================================================

// ABAWD Exemption Verifications - Track Able-Bodied Adults Without Dependents exemptions
export const abawdExemptionVerifications = pgTable("abawd_exemption_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientCaseId: varchar("client_case_id").references(() => clientCases.id, { onDelete: "cascade" }),
  clientName: text("client_name").notNull(), // Denormalized for easy access
  clientIdentifier: text("client_identifier"), // Last 4 SSN or case number
  
  // Exemption details
  exemptionType: text("exemption_type").notNull(), // medical, disability, pregnancy, homeless, student, caretaker_under_6, caretaker_disabled, employed_20hrs, workfare_participant, unable_to_work
  exemptionStatus: text("exemption_status").notNull().default("pending"), // pending, verified, denied, expired
  
  // Supporting information
  verificationMethod: text("verification_method"), // doctor_note, homeless_verification, school_enrollment, disability_determination, work_verification
  supportingDocuments: jsonb("supporting_documents"), // Array of {documentId, documentName, uploadDate}
  verificationNotes: text("verification_notes"),
  
  // Dates
  exemptionStartDate: timestamp("exemption_start_date"),
  exemptionEndDate: timestamp("exemption_end_date"), // For temporary exemptions
  verificationDate: timestamp("verification_date"),
  nextReviewDate: timestamp("next_review_date"), // When to re-verify
  
  // Staff tracking
  verifiedBy: varchar("verified_by").references(() => users.id), // Navigator or caseworker who verified
  reviewedBy: varchar("reviewed_by").references(() => users.id), // Supervisor review
  
  // Metadata
  policyReference: text("policy_reference"), // SNAP Section 106 citation
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  clientCaseIdx: index("abawd_client_case_idx").on(table.clientCaseId),
  statusIdx: index("abawd_status_idx").on(table.exemptionStatus),
  exemptionTypeIdx: index("abawd_exemption_type_idx").on(table.exemptionType),
}));

// ============================================================================
// CROSS-ENROLLMENT ANALYSIS - Multi-Program Participation Tracking
// ============================================================================

// Program Enrollments - Track client enrollment across all benefit programs
export const programEnrollments = pgTable("program_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Client identification (allows tracking across programs)
  clientIdentifier: text("client_identifier").notNull(), // Shared identifier (last 4 SSN, case number, etc.)
  clientName: text("client_name").notNull(),
  dateOfBirth: timestamp("date_of_birth"), // For age-based program eligibility
  
  // Program enrollment details
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  clientCaseId: varchar("client_case_id").references(() => clientCases.id), // Link to specific case if exists
  
  // Enrollment status
  enrollmentStatus: text("enrollment_status").notNull().default("screening"), // screening, enrolled, denied, terminated, suspended
  enrollmentDate: timestamp("enrollment_date"),
  terminationDate: timestamp("termination_date"),
  terminationReason: text("termination_reason"),
  
  // Household composition (for eligibility cross-check)
  householdSize: integer("household_size"),
  householdIncome: integer("household_income"), // Monthly income in cents
  householdAssets: integer("household_assets"), // Total assets in cents
  
  // Cross-enrollment flags
  isEligibleForOtherPrograms: boolean("is_eligible_for_other_programs").default(false), // AI/rules flagged
  suggestedPrograms: jsonb("suggested_programs"), // Array of {programId, programName, eligibilityScore, reason}
  crossEnrollmentReviewedAt: timestamp("cross_enrollment_reviewed_at"),
  crossEnrollmentReviewedBy: varchar("cross_enrollment_reviewed_by").references(() => users.id),
  
  // Metadata
  notes: text("notes"),
  assignedNavigator: varchar("assigned_navigator").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  clientIdentifierIdx: index("enrollments_client_identifier_idx").on(table.clientIdentifier),
  programIdx: index("enrollments_program_idx").on(table.benefitProgramId),
  statusIdx: index("enrollments_status_idx").on(table.enrollmentStatus),
  eligibilityFlagIdx: index("enrollments_eligibility_flag_idx").on(table.isEligibleForOtherPrograms),
}));

// ============================================================================
// EVALUATION FRAMEWORK
// ============================================================================

// Maryland-focused evaluation framework (adapted from Propel snap-eval)
export const evaluationTestCases = pgTable("evaluation_test_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  program: varchar("program", { length: 50 }).notNull(), // MD_SNAP, MD_MEDICAID, MD_TANF, etc.
  category: varchar("category", { length: 50 }).notNull(), // 'eligibility', 'calculation', 'edge_case'
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  inputData: jsonb("input_data").notNull(), // Household scenario data
  expectedResult: jsonb("expected_result").notNull(), // Expected eligibility/benefit amount
  tolerance: real("tolerance").default(2.00), // 2% variance tolerance
  tags: text("tags").array(), // MD-specific tags like 'md_asset_limit', 'md_drug_felony', 'bbce'
  source: varchar("source", { length: 255 }), // Reference to policy document or regulation
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const evaluationRuns = pgTable("evaluation_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runName: varchar("run_name", { length: 255 }).notNull(),
  program: varchar("program", { length: 50 }), // Filter by program, or null for all programs
  totalCases: integer("total_cases").notNull(),
  passedCases: integer("passed_cases").notNull().default(0),
  failedCases: integer("failed_cases").notNull().default(0),
  passRate: real("pass_rate"), // Pass@1 percentage
  averageVariance: real("average_variance"), // Average % variance from expected
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  runBy: varchar("run_by").references(() => users.id),
  status: varchar("status", { length: 20 }).default("running").notNull(), // 'running', 'completed', 'failed'
  metadata: jsonb("metadata"), // Store run configuration, model version, etc.
});

export const evaluationResults = pgTable("evaluation_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").references(() => evaluationRuns.id).notNull(),
  testCaseId: varchar("test_case_id").references(() => evaluationTestCases.id).notNull(),
  passed: boolean("passed").notNull(),
  actualResult: jsonb("actual_result"), // Actual eligibility/benefit amount returned by system
  variance: real("variance"), // % variance from expected
  executionTimeMs: integer("execution_time_ms"), // How long the test took
  errorMessage: text("error_message"), // Error details if test failed
  aiResponse: text("ai_response"), // Full AI response for debugging
  citations: jsonb("citations"), // Source citations used by AI
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const evaluationTestCasesRelations = relations(evaluationTestCases, ({ one, many }) => ({
  creator: one(users, {
    fields: [evaluationTestCases.createdBy],
    references: [users.id],
  }),
  results: many(evaluationResults),
}));

export const evaluationRunsRelations = relations(evaluationRuns, ({ one, many }) => ({
  runner: one(users, {
    fields: [evaluationRuns.runBy],
    references: [users.id],
  }),
  results: many(evaluationResults),
}));

export const evaluationResultsRelations = relations(evaluationResults, ({ one }) => ({
  run: one(evaluationRuns, {
    fields: [evaluationResults.runId],
    references: [evaluationRuns.id],
  }),
  testCase: one(evaluationTestCases, {
    fields: [evaluationResults.testCaseId],
    references: [evaluationTestCases.id],
  }),
}));

export const abawdExemptionVerificationsRelations = relations(abawdExemptionVerifications, ({ one }) => ({
  clientCase: one(clientCases, {
    fields: [abawdExemptionVerifications.clientCaseId],
    references: [clientCases.id],
  }),
  verifier: one(users, {
    fields: [abawdExemptionVerifications.verifiedBy],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [abawdExemptionVerifications.reviewedBy],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [abawdExemptionVerifications.createdBy],
    references: [users.id],
  }),
}));

export const programEnrollmentsRelations = relations(programEnrollments, ({ one }) => ({
  benefitProgram: one(benefitPrograms, {
    fields: [programEnrollments.benefitProgramId],
    references: [benefitPrograms.id],
  }),
  clientCase: one(clientCases, {
    fields: [programEnrollments.clientCaseId],
    references: [clientCases.id],
  }),
  navigator: one(users, {
    fields: [programEnrollments.assignedNavigator],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [programEnrollments.crossEnrollmentReviewedBy],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [programEnrollments.createdBy],
    references: [users.id],
  }),
}));

// ============================================================================
// E&E CROSS-ENROLLMENT INTELLIGENCE - Dataset Management & Analysis
// ============================================================================

// E&E Datasets - Track uploaded E&E report files
export const eeDatasets = pgTable("ee_datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  dataSource: text("data_source").notNull(), // dhs_snap, dhs_medicaid, dhs_tanf, external_agency, etc.
  reportPeriodStart: timestamp("report_period_start"),
  reportPeriodEnd: timestamp("report_period_end"),
  
  // Dataset activation and access control
  isActive: boolean("is_active").default(false).notNull(), // Admin can activate/deactivate
  isProcessed: boolean("is_processed").default(false).notNull(),
  
  // Processing metadata
  totalRecords: integer("total_records").default(0),
  validRecords: integer("valid_records").default(0),
  invalidRecords: integer("invalid_records").default(0),
  duplicateRecords: integer("duplicate_records").default(0),
  processingStatus: text("processing_status").default("pending"), // pending, processing, completed, failed
  processingError: text("processing_error"),
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  
  // Data retention and compliance
  retentionPolicyDays: integer("retention_policy_days").default(90), // Days before auto-purge
  purgeScheduledAt: timestamp("purge_scheduled_at"),
  
  // Audit
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  dataSourceIdx: index("ee_datasets_data_source_idx").on(table.dataSource),
  isActiveIdx: index("ee_datasets_is_active_idx").on(table.isActive),
  processingStatusIdx: index("ee_datasets_processing_status_idx").on(table.processingStatus),
}));

// E&E Dataset Files - Track uploaded files in GCS
export const eeDatasetFiles = pgTable("ee_dataset_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetId: varchar("dataset_id").references(() => eeDatasets.id, { onDelete: "cascade" }).notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  objectPath: text("object_path").notNull(), // GCS path
  fileSize: integer("file_size"), // bytes
  mimeType: text("mime_type"),
  fileHash: text("file_hash"), // SHA-256 for integrity
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  datasetIdIdx: index("ee_dataset_files_dataset_id_idx").on(table.datasetId),
}));

// E&E Clients - Encrypted client data from E&E datasets with matching
export const eeClients = pgTable("ee_clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetId: varchar("dataset_id").references(() => eeDatasets.id, { onDelete: "cascade" }).notNull(),
  
  // Encrypted PII (stored encrypted at rest)
  clientName: jsonb("client_name").notNull(), // Encrypted EncryptionResult
  ssnLast4: jsonb("ssn_last_4").notNull(), // Encrypted EncryptionResult
  dateOfBirth: jsonb("date_of_birth"), // Encrypted EncryptionResult
  
  // Hashed identifiers for matching (not reversible)
  clientNameHash: text("client_name_hash"), // Phonetic hash (Double Metaphone)
  clientIdentifierHash: text("client_identifier_hash"), // Hash of SSN4+DOB for deterministic matching
  
  // Enrollment data from E&E
  enrolledProgramId: varchar("enrolled_program_id").references(() => benefitPrograms.id),
  enrollmentStatus: text("enrollment_status"), // from E&E: active, pending, denied, terminated
  caseNumber: text("case_number"), // E&E case number
  
  // Household data for eligibility analysis
  householdSize: integer("household_size"),
  householdIncome: integer("household_income"), // Monthly in cents
  householdAssets: integer("household_assets"), // Total in cents
  householdComposition: jsonb("household_composition"), // Array of household members
  
  // Matching status
  matchStatus: text("match_status").default("pending"), // pending, matched, no_match, needs_review
  matchedClientCaseId: varchar("matched_client_case_id").references(() => clientCases.id),
  matchConfidenceScore: real("match_confidence_score"), // 0-1
  matchMethod: text("match_method"), // deterministic, fuzzy, manual
  
  // Raw data preservation
  rawDataRow: jsonb("raw_data_row"), // Original CSV row data
  
  // Metadata
  reviewedBy: varchar("reviewed_by").references(() => users.id), // Admin who reviewed fuzzy match
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  datasetIdIdx: index("ee_clients_dataset_id_idx").on(table.datasetId),
  matchStatusIdx: index("ee_clients_match_status_idx").on(table.matchStatus),
  clientIdentifierHashIdx: index("ee_clients_identifier_hash_idx").on(table.clientIdentifierHash),
  clientNameHashIdx: index("ee_clients_name_hash_idx").on(table.clientNameHash),
  enrolledProgramIdx: index("ee_clients_enrolled_program_idx").on(table.enrolledProgramId),
}));

// Cross-Enrollment Opportunities - Identified cross-enrollment possibilities
export const crossEnrollmentOpportunities = pgTable("cross_enrollment_opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Client reference (either from E&E or existing case)
  eeClientId: varchar("ee_client_id").references(() => eeClients.id, { onDelete: "cascade" }),
  clientCaseId: varchar("client_case_id").references(() => clientCases.id),
  
  // Program pairing
  currentProgramId: varchar("current_program_id").references(() => benefitPrograms.id).notNull(), // Program they're enrolled in
  targetProgramId: varchar("target_program_id").references(() => benefitPrograms.id).notNull(), // Program they may be eligible for
  
  // Eligibility analysis
  eligibilityScore: real("eligibility_score"), // 0-1 confidence score
  eligibilityReason: text("eligibility_reason"), // AI-generated explanation
  policyEngineResult: jsonb("policy_engine_result"), // Full PolicyEngine calculation
  estimatedBenefitAmount: integer("estimated_benefit_amount"), // Monthly benefit in cents
  
  // Opportunity prioritization
  priority: text("priority").default("medium"), // high, medium, low
  potentialImpact: text("potential_impact"), // financial, health, stability
  
  // Outreach tracking
  outreachStatus: text("outreach_status").default("identified"), // identified, pending_contact, contacted, enrolled, declined, ineligible
  contactAttempts: integer("contact_attempts").default(0),
  lastContactedAt: timestamp("last_contacted_at"),
  contactedBy: varchar("contacted_by").references(() => users.id), // Navigator who contacted
  
  // Resolution
  outcomeStatus: text("outcome_status"), // successful_enrollment, client_declined, ineligible, no_response
  outcomeNotes: text("outcome_notes"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  
  // Metadata
  identifiedAt: timestamp("identified_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  eeClientIdIdx: index("cross_opportunities_ee_client_idx").on(table.eeClientId),
  clientCaseIdIdx: index("cross_opportunities_client_case_idx").on(table.clientCaseId),
  outreachStatusIdx: index("cross_opportunities_outreach_status_idx").on(table.outreachStatus),
  priorityIdx: index("cross_opportunities_priority_idx").on(table.priority),
  targetProgramIdx: index("cross_opportunities_target_program_idx").on(table.targetProgramId),
}));

// Cross-Enrollment Audit Events - Compliance trail for E&E operations
export const crossEnrollmentAuditEvents = pgTable("cross_enrollment_audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(), // dataset_upload, dataset_activation, matching_run, eligibility_analysis, outreach_action, export
  eventCategory: text("event_category").notNull(), // admin, navigator, system
  
  // Event details (PII-light)
  datasetId: varchar("dataset_id").references(() => eeDatasets.id, { onDelete: "cascade" }),
  opportunityId: varchar("opportunity_id").references(() => crossEnrollmentOpportunities.id, { onDelete: "cascade" }),
  
  // Action details
  actionTaken: text("action_taken").notNull(),
  actionResult: text("action_result"),
  metadata: jsonb("metadata"), // Additional context without PII
  
  // Actor
  userId: varchar("user_id").references(() => users.id).notNull(),
  userRole: text("user_role").notNull(),
  
  // Compliance
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  eventTypeIdx: index("cross_audit_event_type_idx").on(table.eventType),
  datasetIdIdx: index("cross_audit_dataset_id_idx").on(table.datasetId),
  userIdIdx: index("cross_audit_user_id_idx").on(table.userId),
  createdAtIdx: index("cross_audit_created_at_idx").on(table.createdAt),
}));

// Relations
export const eeDatasetsRelations = relations(eeDatasets, ({ one, many }) => ({
  uploader: one(users, {
    fields: [eeDatasets.uploadedBy],
    references: [users.id],
  }),
  files: many(eeDatasetFiles),
  clients: many(eeClients),
  auditEvents: many(crossEnrollmentAuditEvents),
}));

export const eeDatasetFilesRelations = relations(eeDatasetFiles, ({ one }) => ({
  dataset: one(eeDatasets, {
    fields: [eeDatasetFiles.datasetId],
    references: [eeDatasets.id],
  }),
  uploader: one(users, {
    fields: [eeDatasetFiles.uploadedBy],
    references: [users.id],
  }),
}));

export const eeClientsRelations = relations(eeClients, ({ one, many }) => ({
  dataset: one(eeDatasets, {
    fields: [eeClients.datasetId],
    references: [eeDatasets.id],
  }),
  enrolledProgram: one(benefitPrograms, {
    fields: [eeClients.enrolledProgramId],
    references: [benefitPrograms.id],
  }),
  matchedClientCase: one(clientCases, {
    fields: [eeClients.matchedClientCaseId],
    references: [clientCases.id],
  }),
  reviewer: one(users, {
    fields: [eeClients.reviewedBy],
    references: [users.id],
  }),
  opportunities: many(crossEnrollmentOpportunities),
}));

export const crossEnrollmentOpportunitiesRelations = relations(crossEnrollmentOpportunities, ({ one, many }) => ({
  eeClient: one(eeClients, {
    fields: [crossEnrollmentOpportunities.eeClientId],
    references: [eeClients.id],
  }),
  clientCase: one(clientCases, {
    fields: [crossEnrollmentOpportunities.clientCaseId],
    references: [clientCases.id],
  }),
  currentProgram: one(benefitPrograms, {
    fields: [crossEnrollmentOpportunities.currentProgramId],
    references: [benefitPrograms.id],
  }),
  targetProgram: one(benefitPrograms, {
    fields: [crossEnrollmentOpportunities.targetProgramId],
    references: [benefitPrograms.id],
  }),
  contacter: one(users, {
    fields: [crossEnrollmentOpportunities.contactedBy],
    references: [users.id],
  }),
  resolver: one(users, {
    fields: [crossEnrollmentOpportunities.resolvedBy],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [crossEnrollmentOpportunities.createdBy],
    references: [users.id],
  }),
  auditEvents: many(crossEnrollmentAuditEvents),
}));

export const crossEnrollmentAuditEventsRelations = relations(crossEnrollmentAuditEvents, ({ one }) => ({
  dataset: one(eeDatasets, {
    fields: [crossEnrollmentAuditEvents.datasetId],
    references: [eeDatasets.id],
  }),
  opportunity: one(crossEnrollmentOpportunities, {
    fields: [crossEnrollmentAuditEvents.opportunityId],
    references: [crossEnrollmentOpportunities.id],
  }),
  user: one(users, {
    fields: [crossEnrollmentAuditEvents.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// Tax Preparation Tables
// ============================================================================

export const federalTaxReturns = pgTable("federal_tax_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to household scenario (unified profile)
  scenarioId: varchar("scenario_id").references(() => householdScenarios.id, { onDelete: "cascade" }),
  
  // Preparer information
  preparerId: varchar("preparer_id").references(() => users.id).notNull(), // Navigator who prepared
  
  // Tax year and filing details
  taxYear: integer("tax_year").notNull(), // e.g., 2024, 2025
  filingStatus: text("filing_status").notNull(), // single, married_joint, married_separate, head_of_household, qualifying_widow
  
  // Form 1040 data (structured)
  form1040Data: jsonb("form_1040_data").notNull(), // All Form 1040 fields
  
  // Schedules and additional forms
  schedules: jsonb("schedules"), // Schedule A (itemized), C (business), EIC, etc.
  
  // Income documents
  w2Forms: jsonb("w2_forms").array(), // Array of W-2 data
  form1099s: jsonb("form_1099s").array(), // Array of 1099 data
  
  // Key calculations (denormalized for performance)
  adjustedGrossIncome: real("adjusted_gross_income").default(0),
  taxableIncome: real("taxable_income").default(0),
  totalTax: real("total_tax").default(0),
  totalCredits: real("total_credits").default(0),
  eitcAmount: real("eitc_amount").default(0),
  childTaxCredit: real("child_tax_credit").default(0),
  additionalChildTaxCredit: real("additional_child_tax_credit").default(0),
  refundAmount: real("refund_amount").default(0), // or amount owed (negative)
  
  // E-filing status
  efileStatus: text("efile_status").default("draft"), // draft, ready, transmitted, accepted, rejected, amended
  efileTransmissionId: text("efile_transmission_id"), // IRS acknowledgment ID
  efileSubmittedAt: timestamp("efile_submitted_at"),
  efileAcceptedAt: timestamp("efile_accepted_at"),
  efileRejectionReason: text("efile_rejection_reason"),
  
  // Validation and quality
  validationErrors: jsonb("validation_errors"), // IRS business rule violations
  qualityReview: jsonb("quality_review"), // QA checklist results
  reviewedBy: varchar("reviewed_by").references(() => users.id), // QA reviewer
  reviewedAt: timestamp("reviewed_at"),
  
  // VITA program compliance
  vitaDueDiligence: jsonb("vita_due_diligence"), // Due diligence checklist for EITC
  vitaCertLevel: text("vita_cert_level"), // basic, advanced, military, international
  
  // Audit trail
  notes: text("notes"),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  scenarioIdIdx: index("federal_tax_returns_scenario_idx").on(table.scenarioId),
  preparerIdIdx: index("federal_tax_returns_preparer_idx").on(table.preparerId),
  taxYearIdx: index("federal_tax_returns_tax_year_idx").on(table.taxYear),
  efileStatusIdx: index("federal_tax_returns_efile_status_idx").on(table.efileStatus),
}));

export const marylandTaxReturns = pgTable("maryland_tax_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to federal return (required for state conformity)
  federalReturnId: varchar("federal_return_id").references(() => federalTaxReturns.id, { onDelete: "cascade" }).notNull(),
  
  // Maryland Form 502 data
  form502Data: jsonb("form_502_data").notNull(), // All Form 502 fields
  
  // Key Maryland-specific calculations
  marylandAGI: real("maryland_agi").default(0), // After Maryland modifications
  marylandTaxableIncome: real("maryland_taxable_income").default(0),
  marylandTax: real("maryland_tax").default(0),
  
  // Local tax (county-specific)
  countyCode: text("county_code").notNull(), // e.g., "24", "03" for Baltimore County, Baltimore City
  countyTax: real("county_tax").default(0),
  localTaxRate: real("local_tax_rate"), // County-specific rate
  
  // Maryland credits
  marylandEITC: real("maryland_eitc").default(0), // 50% of federal EITC
  childTaxCreditMD: real("child_tax_credit_md").default(0),
  
  // Refund/payment
  stateRefund: real("state_refund").default(0), // or amount owed (negative)
  
  // E-filing status (Maryland Comptroller system)
  efileStatus: text("efile_status").default("draft"), // draft, ready, transmitted, accepted, rejected
  efileTransmissionId: text("efile_transmission_id"), // MDTAX iFile acknowledgment
  efileSubmittedAt: timestamp("efile_submitted_at"),
  efileAcceptedAt: timestamp("efile_accepted_at"),
  
  // Audit trail
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  federalReturnIdIdx: index("maryland_tax_returns_federal_idx").on(table.federalReturnId),
  countyCodeIdx: index("maryland_tax_returns_county_idx").on(table.countyCode),
}));

export const taxDocuments = pgTable("tax_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to household scenario, federal return, or VITA session
  scenarioId: varchar("scenario_id").references(() => householdScenarios.id, { onDelete: "cascade" }),
  federalReturnId: varchar("federal_return_id").references(() => federalTaxReturns.id, { onDelete: "cascade" }),
  vitaSessionId: varchar("vita_session_id").references(() => vitaIntakeSessions.id, { onDelete: "cascade" }),
  
  // Document type
  documentType: text("document_type").notNull(), // w2, 1099-misc, 1099-nec, 1099-int, 1099-div, 1095-a, schedule_c, other
  
  // Storage reference
  documentId: varchar("document_id").references(() => documents.id), // Link to main documents table for file storage
  
  // Extracted data (from Gemini Vision)
  extractedData: jsonb("extracted_data").notNull(), // Structured tax form fields
  
  // Quality and verification
  geminiConfidence: real("gemini_confidence"), // 0-1 confidence score from extraction
  verificationStatus: text("verification_status").default("pending"), // pending, verified, flagged, rejected
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  
  // Flags for issues
  qualityFlags: jsonb("quality_flags"), // Array of quality issues detected
  requiresManualReview: boolean("requires_manual_review").default(false),
  
  // Metadata
  taxYear: integer("tax_year"), // Which tax year this document applies to
  notes: text("notes"),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  scenarioIdIdx: index("tax_documents_scenario_idx").on(table.scenarioId),
  federalReturnIdIdx: index("tax_documents_federal_return_idx").on(table.federalReturnId),
  vitaSessionIdIdx: index("tax_documents_vita_session_idx").on(table.vitaSessionId),
  documentTypeIdx: index("tax_documents_type_idx").on(table.documentType),
  verificationStatusIdx: index("tax_documents_verification_idx").on(table.verificationStatus),
}));

// TaxSlayer Returns - Manual data entry from TaxSlayer Pro (no API)
export const taxslayerReturns = pgTable("taxslayer_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Foreign key to VITA intake session
  vitaIntakeSessionId: varchar("vita_intake_session_id").references(() => vitaIntakeSessions.id, { onDelete: "cascade" }).notNull(),
  
  // Tax year and filing metadata
  taxYear: integer("tax_year").notNull(),
  filingStatus: text("filing_status").notNull(), // single, married_joint, married_separate, head_of_household, qualifying_widow
  preparedDate: date("prepared_date"),
  
  // Federal return summary
  federalAGI: real("federal_agi").default(0),
  federalTaxableIncome: real("federal_taxable_income").default(0),
  federalTax: real("federal_tax").default(0),
  federalWithheld: real("federal_withheld").default(0),
  federalRefund: real("federal_refund").default(0), // or amount owed (negative)
  
  // State return summary (Maryland)
  stateAGI: real("state_agi").default(0),
  stateTax: real("state_tax").default(0),
  stateWithheld: real("state_withheld").default(0),
  stateRefund: real("state_refund").default(0), // or amount owed (negative)
  
  // Tax credits
  eitcAmount: real("eitc_amount").default(0),
  ctcAmount: real("ctc_amount").default(0),
  additionalChildTaxCredit: real("additional_child_tax_credit").default(0),
  educationCredits: real("education_credits").default(0), // AOTC + LLC combined
  americanOpportunityCredit: real("american_opportunity_credit").default(0),
  lifetimeLearningCredit: real("lifetime_learning_credit").default(0),
  otherCredits: real("other_credits").default(0),
  
  // Income documents (JSONB arrays for structured data)
  // W-2 format: { employer, ein, wages, federalWithheld, stateWithheld, socialSecurityWages, medicareWages }
  w2Forms: jsonb("w2_forms").default([]),
  
  // 1099 format: { type (INT, DIV, MISC, NEC, etc), payer, amount, federalWithheld }
  form1099s: jsonb("form_1099s").default([]),
  
  // Schedule C (self-employment) - if applicable
  // Format: { businessName, ein, grossReceipts, expenses, netProfit }
  scheduleC: jsonb("schedule_c"),
  
  // Other income/deduction details
  retirementIncome: real("retirement_income").default(0),
  socialSecurityIncome: real("social_security_income").default(0),
  studentLoanInterestPaid: real("student_loan_interest_paid").default(0),
  mortgageInterestPaid: real("mortgage_interest_paid").default(0),
  charitableContributions: real("charitable_contributions").default(0),
  
  // Validation flags (for data quality)
  hasValidationWarnings: boolean("has_validation_warnings").default(false),
  validationWarnings: jsonb("validation_warnings").default([]), // Array of warning messages
  
  // Comparison results (vs our system calculation)
  comparisonStatus: text("comparison_status"), // pending, reviewed, approved, flagged
  comparisonNotes: text("comparison_notes"),
  
  // Notes and metadata
  notes: text("notes"),
  
  // Import audit trail
  importedAt: timestamp("imported_at").defaultNow().notNull(),
  importedBy: varchar("imported_by").references(() => users.id).notNull(), // Navigator who entered data
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  vitaSessionIdIdx: index("taxslayer_returns_vita_session_idx").on(table.vitaIntakeSessionId),
  taxYearIdx: index("taxslayer_returns_tax_year_idx").on(table.taxYear),
  importedByIdx: index("taxslayer_returns_imported_by_idx").on(table.importedBy),
}));

export type TaxslayerReturn = typeof taxslayerReturns.$inferSelect;
export type InsertTaxslayerReturn = typeof taxslayerReturns.$inferInsert;

export const insertTaxslayerReturnSchema = createInsertSchema(taxslayerReturns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Taxpayer Self-Service Portal Tables

// Document Requests - Navigator requests specific documents from taxpayer
export const documentRequests = pgTable("document_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to VITA session
  vitaSessionId: varchar("vita_session_id").references(() => vitaIntakeSessions.id, { onDelete: "cascade" }).notNull(),
  
  // Requested by (Navigator)
  requestedBy: varchar("requested_by").references(() => users.id).notNull(),
  
  // Document details
  documentType: text("document_type").notNull(), // w2, 1099-misc, proof_of_income, etc.
  documentName: text("document_name").notNull(), // Display name for taxpayer
  description: text("description"), // What specifically is needed and why
  dueDate: timestamp("due_date"), // When navigator needs this by
  
  // Status tracking
  status: text("status").default("pending").notNull(), // pending, fulfilled, cancelled
  fulfilledAt: timestamp("fulfilled_at"),
  
  // Taxpayer response
  uploadedDocumentId: varchar("uploaded_document_id").references(() => documents.id), // Link to uploaded document
  taxpayerNotes: text("taxpayer_notes"), // Message from taxpayer when uploading
  
  // Priority and visibility
  priority: text("priority").default("normal"), // low, normal, high, urgent
  isVisible: boolean("is_visible").default(true), // Can be hidden after resolution
  
  // Audit trail
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  vitaSessionIdIdx: index("document_requests_vita_session_idx").on(table.vitaSessionId),
  requestedByIdx: index("document_requests_requested_by_idx").on(table.requestedBy),
  statusIdx: index("document_requests_status_idx").on(table.status),
  dueDateIdx: index("document_requests_due_date_idx").on(table.dueDate),
}));

export type DocumentRequest = typeof documentRequests.$inferSelect;
export type InsertDocumentRequest = typeof documentRequests.$inferInsert;

export const insertDocumentRequestSchema = createInsertSchema(documentRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Messages - Secure communication between navigator and taxpayer
export const taxpayerMessages = pgTable("taxpayer_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to VITA session
  vitaSessionId: varchar("vita_session_id").references(() => vitaIntakeSessions.id, { onDelete: "cascade" }).notNull(),
  
  // Message sender
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  senderRole: text("sender_role").notNull(), // navigator, taxpayer
  
  // Message content
  subject: text("subject"), // Optional subject line
  message: text("message").notNull(), // Message body (encrypted if contains PII)
  
  // Threading
  parentMessageId: varchar("parent_message_id").references(() => taxpayerMessages.id), // For replies
  threadId: varchar("thread_id"), // Group related messages
  
  // Status
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  
  // Visibility and priority
  priority: text("priority").default("normal"), // low, normal, high, urgent
  isSystemMessage: boolean("is_system_message").default(false), // Auto-generated messages
  
  // Audit trail
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  vitaSessionIdIdx: index("taxpayer_messages_vita_session_idx").on(table.vitaSessionId),
  senderIdIdx: index("taxpayer_messages_sender_idx").on(table.senderId),
  threadIdIdx: index("taxpayer_messages_thread_idx").on(table.threadId),
  isReadIdx: index("taxpayer_messages_is_read_idx").on(table.isRead),
  createdAtIdx: index("taxpayer_messages_created_at_idx").on(table.createdAt),
}));

// Message Attachments - Join table for message attachments (many-to-many)
export const taxpayerMessageAttachments = pgTable("taxpayer_message_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Foreign keys
  messageId: varchar("message_id").references(() => taxpayerMessages.id, { onDelete: "cascade" }).notNull(),
  documentId: varchar("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  messageIdIdx: index("taxpayer_message_attachments_message_idx").on(table.messageId),
  documentIdIdx: index("taxpayer_message_attachments_document_idx").on(table.documentId),
  // Unique constraint to prevent duplicate attachments
  uniqueMessageDocument: uniqueIndex("taxpayer_message_attachments_unique").on(table.messageId, table.documentId),
}));

export type TaxpayerMessage = typeof taxpayerMessages.$inferSelect;
export type InsertTaxpayerMessage = typeof taxpayerMessages.$inferInsert;

export const insertTaxpayerMessageSchema = createInsertSchema(taxpayerMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TaxpayerMessageAttachment = typeof taxpayerMessageAttachments.$inferSelect;
export type InsertTaxpayerMessageAttachment = typeof taxpayerMessageAttachments.$inferInsert;

export const insertTaxpayerMessageAttachmentSchema = createInsertSchema(taxpayerMessageAttachments).omit({
  id: true,
  createdAt: true,
});

// E-Signatures - Legal compliance for IRS forms and consent
export const eSignatures = pgTable("e_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to VITA session or federal tax return
  vitaSessionId: varchar("vita_session_id").references(() => vitaIntakeSessions.id, { onDelete: "cascade" }),
  federalReturnId: varchar("federal_return_id").references(() => federalTaxReturns.id, { onDelete: "cascade" }),
  
  // Signer information
  signerId: varchar("signer_id").references(() => users.id).notNull(),
  signerName: text("signer_name").notNull(), // Full legal name as typed/signed
  signerRole: text("signer_role").notNull(), // taxpayer, spouse, preparer, quality_reviewer
  
  // Form information
  formType: text("form_type").notNull(), // irs_consent_8879, form_1040, form_13614c, quality_review, etc.
  formName: text("form_name").notNull(), // Display name (e.g., "IRS Publication 4299 Consent")
  formYear: integer("form_year"), // Tax year if applicable
  
  // Signature data
  signatureType: text("signature_type").notNull(), // typed, drawn, uploaded
  signatureData: text("signature_data").notNull(), // Base64 encoded image or typed text
  
  // Legal compliance fields (ESIGN Act requirements)
  ipAddress: text("ip_address").notNull(), // IP address at time of signing
  userAgent: text("user_agent").notNull(), // Browser/device info
  geolocation: jsonb("geolocation"), // Optional GPS coordinates if available
  
  // Consent and disclosures
  disclosureAccepted: boolean("disclosure_accepted").default(true).notNull(), // Must be true
  disclosureText: text("disclosure_text").notNull(), // Full disclosure shown to signer
  consentTimestamp: timestamp("consent_timestamp").defaultNow().notNull(), // When they consented
  
  // Verification
  verificationMethod: text("verification_method"), // email, sms, knowledge_based, in_person
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by").references(() => users.id), // Navigator who witnessed signature
  
  // Document attachment and integrity
  signedDocumentId: varchar("signed_document_id").references(() => documents.id), // PDF with signature
  documentHash: text("document_hash").notNull(), // SHA-256 hash of signed document for tamper detection (required for legal validity)
  
  // Audit trail and legal validity
  isValid: boolean("is_valid").default(true), // Can be invalidated if fraud suspected
  invalidatedAt: timestamp("invalidated_at"),
  invalidationReason: text("invalidation_reason"),
  
  // Metadata
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  vitaSessionIdIdx: index("e_signatures_vita_session_idx").on(table.vitaSessionId),
  federalReturnIdIdx: index("e_signatures_federal_return_idx").on(table.federalReturnId),
  signerIdIdx: index("e_signatures_signer_idx").on(table.signerId),
  formTypeIdx: index("e_signatures_form_type_idx").on(table.formType),
  isValidIdx: index("e_signatures_is_valid_idx").on(table.isValid),
  consentTimestampIdx: index("e_signatures_consent_timestamp_idx").on(table.consentTimestamp),
}));

export type ESignature = typeof eSignatures.$inferSelect;
export type InsertESignature = typeof eSignatures.$inferInsert;

export const insertESignatureSchema = createInsertSchema(eSignatures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tax table relations
export const federalTaxReturnsRelations = relations(federalTaxReturns, ({ one, many }) => ({
  scenario: one(householdScenarios, {
    fields: [federalTaxReturns.scenarioId],
    references: [householdScenarios.id],
  }),
  preparer: one(users, {
    fields: [federalTaxReturns.preparerId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [federalTaxReturns.reviewedBy],
    references: [users.id],
  }),
  marylandReturn: one(marylandTaxReturns),
  taxDocuments: many(taxDocuments),
}));

export const marylandTaxReturnsRelations = relations(marylandTaxReturns, ({ one }) => ({
  federalReturn: one(federalTaxReturns, {
    fields: [marylandTaxReturns.federalReturnId],
    references: [federalTaxReturns.id],
  }),
}));

export const taxDocumentsRelations = relations(taxDocuments, ({ one }) => ({
  scenario: one(householdScenarios, {
    fields: [taxDocuments.scenarioId],
    references: [householdScenarios.id],
  }),
  federalReturn: one(federalTaxReturns, {
    fields: [taxDocuments.federalReturnId],
    references: [federalTaxReturns.id],
  }),
  vitaSession: one(vitaIntakeSessions, {
    fields: [taxDocuments.vitaSessionId],
    references: [vitaIntakeSessions.id],
  }),
  document: one(documents, {
    fields: [taxDocuments.documentId],
    references: [documents.id],
  }),
  verifier: one(users, {
    fields: [taxDocuments.verifiedBy],
    references: [users.id],
  }),
}));

export const taxslayerReturnsRelations = relations(taxslayerReturns, ({ one }) => ({
  vitaSession: one(vitaIntakeSessions, {
    fields: [taxslayerReturns.vitaIntakeSessionId],
    references: [vitaIntakeSessions.id],
  }),
  importer: one(users, {
    fields: [taxslayerReturns.importedBy],
    references: [users.id],
  }),
}));

export const documentRequestsRelations = relations(documentRequests, ({ one }) => ({
  vitaSession: one(vitaIntakeSessions, {
    fields: [documentRequests.vitaSessionId],
    references: [vitaIntakeSessions.id],
  }),
  requestor: one(users, {
    fields: [documentRequests.requestedBy],
    references: [users.id],
  }),
  uploadedDocument: one(documents, {
    fields: [documentRequests.uploadedDocumentId],
    references: [documents.id],
  }),
}));

export const taxpayerMessagesRelations = relations(taxpayerMessages, ({ one, many }) => ({
  vitaSession: one(vitaIntakeSessions, {
    fields: [taxpayerMessages.vitaSessionId],
    references: [vitaIntakeSessions.id],
  }),
  sender: one(users, {
    fields: [taxpayerMessages.senderId],
    references: [users.id],
  }),
  parentMessage: one(taxpayerMessages, {
    fields: [taxpayerMessages.parentMessageId],
    references: [taxpayerMessages.id],
  }),
  attachments: many(taxpayerMessageAttachments),
}));

export const taxpayerMessageAttachmentsRelations = relations(taxpayerMessageAttachments, ({ one }) => ({
  message: one(taxpayerMessages, {
    fields: [taxpayerMessageAttachments.messageId],
    references: [taxpayerMessages.id],
  }),
  document: one(documents, {
    fields: [taxpayerMessageAttachments.documentId],
    references: [documents.id],
  }),
}));

export const eSignaturesRelations = relations(eSignatures, ({ one }) => ({
  vitaSession: one(vitaIntakeSessions, {
    fields: [eSignatures.vitaSessionId],
    references: [vitaIntakeSessions.id],
  }),
  federalReturn: one(federalTaxReturns, {
    fields: [eSignatures.federalReturnId],
    references: [federalTaxReturns.id],
  }),
  signer: one(users, {
    fields: [eSignatures.signerId],
    references: [users.id],
  }),
  verifier: one(users, {
    fields: [eSignatures.verifiedBy],
    references: [users.id],
  }),
  signedDocument: one(documents, {
    fields: [eSignatures.signedDocumentId],
    references: [documents.id],
  }),
}));

// Insert schemas
export const insertEvaluationTestCaseSchema = createInsertSchema(evaluationTestCases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEvaluationRunSchema = createInsertSchema(evaluationRuns).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertEvaluationResultSchema = createInsertSchema(evaluationResults).omit({
  id: true,
  createdAt: true,
});

export const insertAbawdExemptionVerificationSchema = createInsertSchema(abawdExemptionVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProgramEnrollmentSchema = createInsertSchema(programEnrollments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertEvaluationTestCase = z.infer<typeof insertEvaluationTestCaseSchema>;
export type EvaluationTestCase = typeof evaluationTestCases.$inferSelect;
export type InsertEvaluationRun = z.infer<typeof insertEvaluationRunSchema>;
export type EvaluationRun = typeof evaluationRuns.$inferSelect;
export type InsertEvaluationResult = z.infer<typeof insertEvaluationResultSchema>;
export type EvaluationResult = typeof evaluationResults.$inferSelect;

export type InsertAbawdExemptionVerification = z.infer<typeof insertAbawdExemptionVerificationSchema>;
export type AbawdExemptionVerification = typeof abawdExemptionVerifications.$inferSelect;

export type InsertProgramEnrollment = z.infer<typeof insertProgramEnrollmentSchema>;
export type ProgramEnrollment = typeof programEnrollments.$inferSelect;

// E&E Cross-Enrollment schemas
export const insertEeDatasetSchema = createInsertSchema(eeDatasets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEeDatasetFileSchema = createInsertSchema(eeDatasetFiles).omit({
  id: true,
  createdAt: true,
});

export const insertEeClientSchema = createInsertSchema(eeClients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrossEnrollmentOpportunitySchema = createInsertSchema(crossEnrollmentOpportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrossEnrollmentAuditEventSchema = createInsertSchema(crossEnrollmentAuditEvents).omit({
  id: true,
  createdAt: true,
});

// E&E Types
export type InsertEeDataset = z.infer<typeof insertEeDatasetSchema>;
export type EeDataset = typeof eeDatasets.$inferSelect;
export type InsertEeDatasetFile = z.infer<typeof insertEeDatasetFileSchema>;
export type EeDatasetFile = typeof eeDatasetFiles.$inferSelect;
export type InsertEeClient = z.infer<typeof insertEeClientSchema>;
export type EeClient = typeof eeClients.$inferSelect;
export type InsertCrossEnrollmentOpportunity = z.infer<typeof insertCrossEnrollmentOpportunitySchema>;
export type CrossEnrollmentOpportunity = typeof crossEnrollmentOpportunities.$inferSelect;
export type InsertCrossEnrollmentAuditEvent = z.infer<typeof insertCrossEnrollmentAuditEventSchema>;
export type CrossEnrollmentAuditEvent = typeof crossEnrollmentAuditEvents.$inferSelect;

// Tax preparation insert schemas
export const insertFederalTaxReturnSchema = createInsertSchema(federalTaxReturns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarylandTaxReturnSchema = createInsertSchema(marylandTaxReturns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaxDocumentSchema = createInsertSchema(taxDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tax preparation types
export type InsertFederalTaxReturn = z.infer<typeof insertFederalTaxReturnSchema>;
export type FederalTaxReturn = typeof federalTaxReturns.$inferSelect;
export type InsertMarylandTaxReturn = z.infer<typeof insertMarylandTaxReturnSchema>;
export type MarylandTaxReturn = typeof marylandTaxReturns.$inferSelect;
export type InsertTaxDocument = z.infer<typeof insertTaxDocumentSchema>;
export type TaxDocument = typeof taxDocuments.$inferSelect;

// ============================================================================
// LEGISLATIVE IMPACT ANALYSIS - War Gaming & State Options
// ============================================================================

// Federal Bills - Track proposed federal legislation
export const federalBills = pgTable("federal_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billNumber: text("bill_number").notNull(), // e.g., "HR 5376", "S 2345"
  congress: integer("congress").notNull(), // e.g., 119 for 119th Congress
  billType: text("bill_type").notNull(), // hr, s, hjres, sjres, hconres, sconres
  title: text("title").notNull(),
  summary: text("summary"),
  fullText: text("full_text"), // Complete bill text
  introducedDate: timestamp("introduced_date"),
  latestActionDate: timestamp("latest_action_date"),
  latestActionText: text("latest_action_text"),
  status: text("status").notNull().default("introduced"), // introduced, passed_house, passed_senate, enacted, vetoed
  sponsors: jsonb("sponsors"), // Array of sponsor objects
  cosponsors: jsonb("cosponsors"), // Array of cosponsor objects
  committees: jsonb("committees"), // Assigned committees
  relatedPrograms: text("related_programs").array(), // SNAP, MEDICAID, TANF, etc.
  policyChanges: jsonb("policy_changes"), // Gemini-extracted policy changes
  sourceUrl: text("source_url"), // Congress.gov or GovInfo URL
  govInfoPackageId: text("govinfo_package_id"), // e.g., "BILLS-119hr1234ih"
  billStatusXml: text("bill_status_xml"), // Full XML from GovInfo
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  billNumberIdx: index("federal_bills_bill_number_idx").on(table.billNumber),
  congressIdx: index("federal_bills_congress_idx").on(table.congress),
  statusIdx: index("federal_bills_status_idx").on(table.status),
}));

// Maryland Bills - Track Maryland General Assembly legislation
export const marylandBills = pgTable("maryland_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billNumber: text("bill_number").notNull(), // e.g., "HB0001", "SB0234"
  session: text("session").notNull(), // e.g., "2025RS" (Regular Session)
  billType: text("bill_type").notNull(), // HB, SB, HJ, SJ
  title: text("title").notNull(),
  synopsis: text("synopsis"),
  fiscalNote: text("fiscal_note"),
  fullTextUrl: text("full_text_url"),
  pdfUrl: text("pdf_url"),
  introducedDate: timestamp("introduced_date"),
  firstReadingDate: timestamp("first_reading_date"),
  crossFiledWith: text("cross_filed_with"), // Cross-filed bill number
  status: text("status").notNull().default("prefiled"), // prefiled, introduced, committee, passed_first, passed_second, enacted
  sponsors: jsonb("sponsors"),
  committees: jsonb("committees"),
  relatedPrograms: text("related_programs").array(),
  policyChanges: jsonb("policy_changes"), // Gemini-extracted changes
  sourceUrl: text("source_url"), // mgaleg.maryland.gov URL
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  billNumberIdx: index("maryland_bills_bill_number_idx").on(table.billNumber),
  sessionIdx: index("maryland_bills_session_idx").on(table.session),
  statusIdx: index("maryland_bills_status_idx").on(table.status),
}));

// Public Laws - Enacted federal legislation (USLM XML from GovInfo)
export const publicLaws = pgTable("public_laws", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  publicLawNumber: text("public_law_number").notNull(), // e.g., "119-4"
  congress: integer("congress").notNull(),
  lawType: text("law_type").notNull().default("public"), // public, private
  title: text("title").notNull(),
  enactmentDate: timestamp("enactment_date").notNull(),
  billNumber: text("bill_number"), // Original bill that became law
  fullText: text("full_text"), // Complete law text
  uslmXml: text("uslm_xml"), // Full USLM XML from GovInfo
  affectedPrograms: text("affected_programs").array(), // Programs modified by this law
  policyChanges: jsonb("policy_changes"), // Codified policy changes
  govInfoPackageId: text("govinfo_package_id"), // e.g., "PLAW-119publ4"
  sourceUrl: text("source_url"), // GovInfo URL
  usCodeCitations: jsonb("us_code_citations"), // Array of USC sections modified
  downloadedAt: timestamp("downloaded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  publicLawNumberIdx: index("public_laws_number_idx").on(table.publicLawNumber),
  congressIdx: index("public_laws_congress_idx").on(table.congress),
}));

// Version Check Logs - Track version checks for GovInfo data sources
export const versionCheckLogs = pgTable("version_check_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checkType: text("check_type").notNull(), // ecfr, bill_status, public_laws
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
  currentVersion: timestamp("current_version"), // Current version we have
  latestVersion: timestamp("latest_version"), // Latest version available
  updateDetected: boolean("update_detected").notNull().default(false),
  checksumCurrent: text("checksum_current"), // Optional hash for data integrity
  checksumLatest: text("checksum_latest"), // Optional hash for latest version
  metadata: jsonb("metadata"), // Additional check metadata (e.g., packages checked)
  errorMessage: text("error_message"), // If check failed
  triggeredBy: varchar("triggered_by").references(() => users.id), // Manual or scheduled
  autoSyncTriggered: boolean("auto_sync_triggered").default(false).notNull(), // Did we trigger download?
}, (table) => ({
  checkTypeIdx: index("version_check_logs_type_idx").on(table.checkType),
  checkedAtIdx: index("version_check_logs_checked_at_idx").on(table.checkedAt),
  updateDetectedIdx: index("version_check_logs_update_detected_idx").on(table.updateDetected),
}));

// Smart Scheduler Configuration - Admin-configurable settings for each data source
export const schedulerConfigs = pgTable("scheduler_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceName: text("source_name").notNull().unique(), // ecfr, irs_publications, federal_bills, etc.
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  cronExpression: text("cron_expression").notNull(), // 0 0 * * 0 for weekly
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  lastStatus: text("last_status"), // success, error
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  sourceNameIdx: index("scheduler_configs_source_name_idx").on(table.sourceName),
  isEnabledIdx: index("scheduler_configs_is_enabled_idx").on(table.isEnabled),
}));

// Verified Data Sources - Admin-uploaded golden source documents
export const verifiedDataSources = pgTable("verified_data_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceName: text("source_name").notNull(), // ecfr, irs_publications, etc.
  fileName: text("file_name").notNull(),
  objectPath: text("object_path").notNull(), // Path in object storage
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  version: text("version").notNull(), // Edition number, date, or version identifier
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  verificationNotes: text("verification_notes"),
  replacesVersion: text("replaces_version"), // Version this replaces
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sourceNameIdx: index("verified_data_sources_source_name_idx").on(table.sourceName),
  isActiveIdx: index("verified_data_sources_is_active_idx").on(table.isActive),
  uploadedByIdx: index("verified_data_sources_uploaded_by_idx").on(table.uploadedBy),
}));

// State Options & Waivers - Master list of 28 FNS SNAP options/waivers
export const stateOptionsWaivers = pgTable("state_options_waivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  optionCode: text("option_code").notNull().unique(), // e.g., "BBCE", "SIMPLIFIED_REPORTING"
  optionName: text("option_name").notNull(),
  category: text("category").notNull(), // eligibility, reporting, deductions, waivers
  description: text("description").notNull(),
  statutoryCitation: text("statutory_citation"), // Food and Nutrition Act section
  regulatoryCitation: text("regulatory_citation"), // 7 CFR section
  policyEngineVariable: text("policy_engine_variable"), // Corresponding PolicyEngine parameter
  eligibilityImpact: text("eligibility_impact"), // How it affects eligibility
  benefitImpact: text("benefit_impact"), // How it affects benefit amounts
  administrativeImpact: text("administrative_impact"), // Administrative burden/savings
  statesUsing: jsonb("states_using"), // Array of state codes using this option
  fnsReportEdition: text("fns_report_edition").notNull(), // e.g., "17th Edition (Aug 2025)"
  fnsReportSection: text("fns_report_section"), // Section in FNS report
  sourceUrl: text("source_url"), // FNS State Options Report URL
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  optionCodeIdx: index("state_options_code_idx").on(table.optionCode),
  categoryIdx: index("state_options_category_idx").on(table.category),
}));

// Maryland State Option Status - What Maryland currently participates in
export const marylandStateOptionStatus = pgTable("maryland_state_option_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateOptionId: varchar("state_option_id").references(() => stateOptionsWaivers.id).notNull().unique(),
  isParticipating: boolean("is_participating").notNull(), // Maryland's current status
  adoptionDate: timestamp("adoption_date"), // When Maryland adopted this option
  expirationDate: timestamp("expiration_date"), // For temporary waivers
  waiverType: text("waiver_type"), // statewide, county_specific, time_limited
  affectedCounties: text("affected_counties").array(), // For county-specific waivers
  policyReference: text("policy_reference"), // COMAR or DHS manual citation
  notes: text("notes"),
  dataSource: text("data_source").notNull(), // ai_extracted, manual_override, fns_report
  extractedBy: varchar("extracted_by").references(() => users.id), // AI or admin user
  lastVerifiedAt: timestamp("last_verified_at"),
  lastVerifiedBy: varchar("last_verified_by").references(() => users.id),
  overrideReason: text("override_reason"), // If manually overridden
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  stateOptionIdx: index("md_state_option_status_option_idx").on(table.stateOptionId),
  isParticipatingIdx: index("md_state_option_participating_idx").on(table.isParticipating),
}));

// War Gaming Scenarios - Save scenario configurations for comparison
export const warGamingScenarios = pgTable("war_gaming_scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  scenarioType: text("scenario_type").notNull(), // proposed_bill, state_option_change, custom
  billId: varchar("bill_id"), // References federalBills or marylandBills if applicable
  billType: text("bill_type"), // federal, maryland
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  isBaseline: boolean("is_baseline").default(false).notNull(), // True for current Maryland policy
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  createdByIdx: index("war_gaming_scenarios_created_by_idx").on(table.createdBy),
  billIdIdx: index("war_gaming_scenarios_bill_id_idx").on(table.billId),
}));

// Scenario State Option Configuration - Which options are enabled in this scenario
export const scenarioStateOptions = pgTable("scenario_state_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scenarioId: varchar("scenario_id").references(() => warGamingScenarios.id, { onDelete: "cascade" }).notNull(),
  stateOptionId: varchar("state_option_id").references(() => stateOptionsWaivers.id).notNull(),
  isEnabled: boolean("is_enabled").notNull(), // Toggle state in this scenario
  configurationNotes: text("configuration_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  scenarioIdIdx: index("scenario_state_options_scenario_idx").on(table.scenarioId),
  stateOptionIdIdx: index("scenario_state_options_option_idx").on(table.stateOptionId),
}));

// State Option Status History - Audit trail for admin overrides and changes
export const stateOptionStatusHistory = pgTable("state_option_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateOptionStatusId: varchar("state_option_status_id").references(() => marylandStateOptionStatus.id, { onDelete: "cascade" }).notNull(),
  stateOptionId: varchar("state_option_id").references(() => stateOptionsWaivers.id).notNull(),
  changeType: text("change_type").notNull(), // ai_extraction, manual_override, verification
  previousValue: boolean("previous_value"), // Was it enabled before?
  newValue: boolean("new_value").notNull(), // Is it enabled now?
  dataSource: text("data_source").notNull(), // ai_extracted, manual_override, fns_report
  changedBy: varchar("changed_by").references(() => users.id).notNull(),
  changeReason: text("change_reason"), // Why was this overridden?
  evidenceUrl: text("evidence_url"), // Link to supporting documentation
  changedAt: timestamp("changed_at").defaultNow().notNull(),
}, (table) => ({
  stateOptionStatusIdIdx: index("state_option_history_status_idx").on(table.stateOptionStatusId),
  changedByIdx: index("state_option_history_changed_by_idx").on(table.changedBy),
  changedAtIdx: index("state_option_history_changed_at_idx").on(table.changedAt),
}));

// Legislative Impact Analysis - PolicyEngine calculations for scenarios
export const legislativeImpacts = pgTable("legislative_impacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scenarioId: varchar("scenario_id").references(() => warGamingScenarios.id, { onDelete: "cascade" }).notNull(),
  baselineScenarioId: varchar("baseline_scenario_id").references(() => warGamingScenarios.id), // For comparison
  billType: text("bill_type"), // federal, maryland (if scenario is based on bill)
  billId: varchar("bill_id"), // References federalBills or marylandBills
  affectedProgram: text("affected_program").notNull(), // SNAP, MEDICAID, etc.
  impactType: text("impact_type").notNull(), // eligibility, benefit_amount, administrative
  policyEngineInputBaseline: jsonb("policy_engine_input_baseline"), // Baseline params
  policyEngineInputProposed: jsonb("policy_engine_input_proposed"), // Proposed params
  policyEngineOutputBaseline: jsonb("policy_engine_output_baseline"), // Baseline results
  policyEngineOutputProposed: jsonb("policy_engine_output_proposed"), // Proposed results
  enrollmentImpact: jsonb("enrollment_impact"), // Newly eligible/ineligible counts
  budgetImpact: jsonb("budget_impact"), // Monthly/annual benefit changes
  demographicImpact: jsonb("demographic_impact"), // Who is affected
  confidence: text("confidence").notNull().default("medium"), // low, medium, high
  analysisMethod: text("analysis_method").notNull(), // policy_engine, gemini_estimate, manual
  calculatedBy: varchar("calculated_by").references(() => users.id),
  calculatedAt: timestamp("calculated_at").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  scenarioIdIdx: index("legislative_impacts_scenario_idx").on(table.scenarioId),
  billIdIdx: index("legislative_impacts_bill_id_idx").on(table.billId),
  affectedProgramIdx: index("legislative_impacts_program_idx").on(table.affectedProgram),
}));

// Legislative tracking insert schemas
export const insertFederalBillSchema = createInsertSchema(federalBills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarylandBillSchema = createInsertSchema(marylandBills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPublicLawSchema = createInsertSchema(publicLaws).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVersionCheckLogSchema = createInsertSchema(versionCheckLogs).omit({
  id: true,
  checkedAt: true,
});

export const insertSchedulerConfigSchema = createInsertSchema(schedulerConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVerifiedDataSourceSchema = createInsertSchema(verifiedDataSources).omit({
  id: true,
  createdAt: true,
});

export const insertStateOptionWaiverSchema = createInsertSchema(stateOptionsWaivers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarylandStateOptionStatusSchema = createInsertSchema(marylandStateOptionStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLegislativeImpactSchema = createInsertSchema(legislativeImpacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarGamingScenarioSchema = createInsertSchema(warGamingScenarios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScenarioStateOptionSchema = createInsertSchema(scenarioStateOptions).omit({
  id: true,
  createdAt: true,
});

export const insertStateOptionStatusHistorySchema = createInsertSchema(stateOptionStatusHistory).omit({
  id: true,
  changedAt: true,
});

// Legislative tracking types
export type InsertFederalBill = z.infer<typeof insertFederalBillSchema>;
export type FederalBill = typeof federalBills.$inferSelect;
export type InsertMarylandBill = z.infer<typeof insertMarylandBillSchema>;
export type MarylandBill = typeof marylandBills.$inferSelect;
export type InsertPublicLaw = z.infer<typeof insertPublicLawSchema>;
export type PublicLaw = typeof publicLaws.$inferSelect;
export type InsertVersionCheckLog = z.infer<typeof insertVersionCheckLogSchema>;
export type VersionCheckLog = typeof versionCheckLogs.$inferSelect;
export type InsertSchedulerConfig = z.infer<typeof insertSchedulerConfigSchema>;
export type SchedulerConfig = typeof schedulerConfigs.$inferSelect;
export type InsertVerifiedDataSource = z.infer<typeof insertVerifiedDataSourceSchema>;
export type VerifiedDataSource = typeof verifiedDataSources.$inferSelect;
export type InsertStateOptionWaiver = z.infer<typeof insertStateOptionWaiverSchema>;
export type StateOptionWaiver = typeof stateOptionsWaivers.$inferSelect;
export type InsertMarylandStateOptionStatus = z.infer<typeof insertMarylandStateOptionStatusSchema>;
export type MarylandStateOptionStatus = typeof marylandStateOptionStatus.$inferSelect;
export type InsertLegislativeImpact = z.infer<typeof insertLegislativeImpactSchema>;
export type LegislativeImpact = typeof legislativeImpacts.$inferSelect;
export type InsertWarGamingScenario = z.infer<typeof insertWarGamingScenarioSchema>;
export type WarGamingScenario = typeof warGamingScenarios.$inferSelect;
export type InsertScenarioStateOption = z.infer<typeof insertScenarioStateOptionSchema>;
export type ScenarioStateOption = typeof scenarioStateOptions.$inferSelect;
export type InsertStateOptionStatusHistory = z.infer<typeof insertStateOptionStatusHistorySchema>;
export type StateOptionStatusHistory = typeof stateOptionStatusHistory.$inferSelect;

// ============================================================================
// MULTI-COUNTY DEPLOYMENT SYSTEM
// ============================================================================

// Counties/LDSSs - Maryland jurisdictions with customized experiences
export const counties = pgTable("counties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "Baltimore City", "Montgomery County", etc.
  code: text("code").notNull().unique(), // "BALTIMORE_CITY", "MONTGOMERY", etc.
  countyType: text("county_type").notNull().default("ldss"), // ldss, pilot, demo
  
  // Branding configuration
  brandingConfig: jsonb("branding_config"), // { primaryColor, secondaryColor, logoUrl, headerText }
  contactInfo: jsonb("contact_info"), // { phone, email, address, hours }
  welcomeMessage: text("welcome_message"), // Custom welcome message for county
  
  // Geographic and demographic info
  region: text("region"), // "central", "southern", "western", "eastern"
  population: integer("population"),
  coverage: text("coverage").array(), // ZIP codes or service areas
  
  // System configuration
  enabledPrograms: text("enabled_programs").array(), // Which programs this county offers
  customPolicies: jsonb("custom_policies"), // County-specific policy variations (future use)
  features: jsonb("features"), // Feature flags per county { enableGamification: true, etc. }
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isPilot: boolean("is_pilot").default(false).notNull(), // Pilot LDSS marker
  launchDate: timestamp("launch_date"),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeIdx: index("counties_code_idx").on(table.code),
  regionIdx: index("counties_region_idx").on(table.region),
}));

// County Users - Junction table for user-county assignments
export const countyUsers = pgTable("county_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countyId: varchar("county_id").references(() => counties.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Assignment details
  role: text("role").notNull(), // "navigator", "caseworker", "supervisor", "admin"
  isPrimary: boolean("is_primary").default(true).notNull(), // Primary county assignment
  accessLevel: text("access_level").default("full"), // full, readonly, limited
  
  // Assignment period
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  assignedBy: varchar("assigned_by").references(() => users.id),
  deactivatedAt: timestamp("deactivated_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  countyUserIdx: index("county_users_county_user_idx").on(table.countyId, table.userId),
  userIdx: index("county_users_user_idx").on(table.userId),
  primaryIdx: index("county_users_primary_idx").on(table.isPrimary),
}));

// County Metrics - Aggregate performance metrics per county
export const countyMetrics = pgTable("county_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countyId: varchar("county_id").references(() => counties.id, { onDelete: "cascade" }).notNull(),
  
  // Time period
  periodType: text("period_type").notNull(), // daily, weekly, monthly, quarterly
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Case metrics
  totalCases: integer("total_cases").default(0),
  casesOpened: integer("cases_opened").default(0),
  casesClosed: integer("cases_closed").default(0),
  casesApproved: integer("cases_approved").default(0),
  casesDenied: integer("cases_denied").default(0),
  
  // Benefit metrics
  totalBenefitsSecured: real("total_benefits_secured").default(0), // In dollars
  avgBenefitPerCase: real("avg_benefit_per_case").default(0),
  
  // Performance metrics
  avgResponseTime: real("avg_response_time").default(0), // In hours
  avgCaseCompletionTime: real("avg_case_completion_time").default(0), // In days
  successRate: real("success_rate").default(0), // Percentage
  
  // Staff metrics
  activeNavigators: integer("active_navigators").default(0),
  activeCaseworkers: integer("active_caseworkers").default(0),
  avgCasesPerNavigator: real("avg_cases_per_navigator").default(0),
  
  // Document metrics
  documentsProcessed: integer("documents_processed").default(0),
  avgDocumentQuality: real("avg_document_quality").default(0), // Gemini confidence avg
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  countyPeriodIdx: index("county_metrics_county_period_idx").on(table.countyId, table.periodType, table.periodStart),
}));

// ============================================================================
// WHITE-LABEL MULTI-TENANT SYSTEM
// ============================================================================

// Tenants - State/County level organizations with custom branding and data isolation
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(), // URL identifier: "maryland", "virginia", "baltimore-county"
  name: text("name").notNull(), // Display name: "Maryland Department of Human Services"
  type: text("type").notNull(), // "state" or "county"
  parentTenantId: varchar("parent_tenant_id"), // For counties under states - self-referential relation
  status: text("status").notNull().default("active"), // active, inactive, demo
  domain: text("domain").unique(), // Custom domain: "benefits.maryland.gov"
  config: jsonb("config"), // Feature toggles, settings, etc.
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  slugIdx: index("tenants_slug_idx").on(table.slug),
  domainIdx: index("tenants_domain_idx").on(table.domain),
  typeIdx: index("tenants_type_idx").on(table.type),
  parentTenantIdx: index("tenants_parent_tenant_idx").on(table.parentTenantId),
}));

// Tenant Branding - Custom visual identity per tenant
export const tenantBranding = pgTable("tenant_branding", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull().unique(),
  primaryColor: text("primary_color"), // Hex color: "#0D4F8B"
  secondaryColor: text("secondary_color"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  customCss: text("custom_css"),
  headerHtml: text("header_html"),
  footerHtml: text("footer_html"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("tenant_branding_tenant_idx").on(table.tenantId),
}));

// ============================================================================
// GAMIFICATION & NAVIGATOR PERFORMANCE SYSTEM
// ============================================================================

// Navigator KPIs - Track individual navigator performance metrics
export const navigatorKpis = pgTable("navigator_kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  navigatorId: varchar("navigator_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  countyId: varchar("county_id").references(() => counties.id), // Optional county context
  
  // Time period
  periodType: text("period_type").notNull(), // daily, weekly, monthly, all_time
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Case KPIs
  casesClosed: integer("cases_closed").default(0),
  casesApproved: integer("cases_approved").default(0),
  casesDenied: integer("cases_denied").default(0),
  successRate: real("success_rate").default(0), // Approval rate percentage
  
  // Benefit KPIs
  totalBenefitsSecured: real("total_benefits_secured").default(0), // Total $ amount
  avgBenefitPerCase: real("avg_benefit_per_case").default(0),
  highValueCases: integer("high_value_cases").default(0), // Cases > $1000/month
  
  // Efficiency KPIs
  avgResponseTime: real("avg_response_time").default(0), // Hours to first response
  avgCaseCompletionTime: real("avg_case_completion_time").default(0), // Days to close
  documentsProcessed: integer("documents_processed").default(0),
  documentsVerified: integer("documents_verified").default(0),
  
  // Quality KPIs
  avgDocumentQuality: real("avg_document_quality").default(0), // Avg Gemini confidence
  crossEnrollmentsIdentified: integer("cross_enrollments_identified").default(0),
  aiRecommendationsAccepted: integer("ai_recommendations_accepted").default(0),
  
  // Composite score (weighted combination of metrics)
  performanceScore: real("performance_score").default(0), // 0-100 calculated score
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  navigatorPeriodIdx: index("navigator_kpis_nav_period_idx").on(table.navigatorId, table.periodType, table.periodStart),
  countyIdx: index("navigator_kpis_county_idx").on(table.countyId),
  scoreIdx: index("navigator_kpis_score_idx").on(table.performanceScore),
}));

// Achievements - Gamification achievement definitions
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Achievement details
  name: text("name").notNull(), // "First Case Closed", "$10K Benefits Unlocked"
  slug: text("slug").notNull().unique(), // first_case, benefits_10k
  description: text("description").notNull(),
  category: text("category").notNull(), // milestone, performance, quality, teamwork
  tier: text("tier").notNull().default("bronze"), // bronze, silver, gold, platinum
  
  // Visual
  iconName: text("icon_name"), // Lucide icon name
  iconColor: text("icon_color"),
  badgeUrl: text("badge_url"), // Optional custom badge image
  
  // Criteria (JSON-based flexible criteria)
  criteriaType: text("criteria_type").notNull(), // kpi_threshold, case_count, benefit_amount, streak, rate
  criteriaConfig: jsonb("criteria_config").notNull(), // { metric: "casesClosed", threshold: 10, operator: "gte" }
  
  // Rewards
  pointsAwarded: integer("points_awarded").default(0),
  
  // Visibility and status
  isVisible: boolean("is_visible").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Navigator Achievements - Track earned achievements
export const navigatorAchievements = pgTable("navigator_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  navigatorId: varchar("navigator_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  achievementId: varchar("achievement_id").references(() => achievements.id, { onDelete: "cascade" }).notNull(),
  
  // Achievement details
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
  triggerMetric: text("trigger_metric"), // Which KPI triggered the achievement
  triggerValue: real("trigger_value"), // Value that triggered it
  
  // Context
  countyId: varchar("county_id").references(() => counties.id), // County where earned
  relatedCaseId: varchar("related_case_id").references(() => clientCases.id), // Case that triggered it
  
  // Notification
  notified: boolean("notified").default(false),
  notifiedAt: timestamp("notified_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  navigatorAchievementIdx: index("nav_achievements_nav_achievement_idx").on(table.navigatorId, table.achievementId),
  earnedAtIdx: index("nav_achievements_earned_at_idx").on(table.earnedAt),
}));

// Leaderboards - Cached leaderboard rankings
export const leaderboards = pgTable("leaderboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Leaderboard configuration
  leaderboardType: text("leaderboard_type").notNull(), // cases_closed, benefits_amount, success_rate, performance_score
  scope: text("scope").notNull(), // county, statewide
  countyId: varchar("county_id").references(() => counties.id), // null for statewide
  
  // Time period
  periodType: text("period_type").notNull(), // daily, weekly, monthly, all_time
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Rankings (JSON array with full KPI breakdown: { rank, navigatorId, navigatorName, value, countyName, countyId, casesClosed, totalBenefitsSecured, successRate, avgResponseTime, performanceScore })
  rankings: jsonb("rankings").notNull(),
  
  // Metadata
  totalParticipants: integer("total_participants").default(0),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  typesScopeIdx: index("leaderboards_type_scope_period_idx").on(table.leaderboardType, table.scope, table.periodType),
  countyIdx: index("leaderboards_county_idx").on(table.countyId),
}));

// Case Activity Events - Track navigator actions for KPI calculation
export const caseActivityEvents = pgTable("case_activity_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Who and where
  navigatorId: varchar("navigator_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  caseId: varchar("case_id").references(() => clientCases.id, { onDelete: "cascade" }),
  countyId: varchar("county_id").references(() => counties.id),
  
  // Event details
  eventType: text("event_type").notNull(), // case_opened, case_closed, case_approved, case_denied, document_verified, cross_enrollment_identified, ai_recommendation_accepted
  eventData: jsonb("event_data"), // Additional context
  
  // Metrics tracked
  benefitAmount: real("benefit_amount"), // Monthly benefit secured (if applicable)
  responseTime: real("response_time"), // Hours (if applicable)
  documentQuality: real("document_quality"), // Gemini confidence (if applicable)
  
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  navigatorIdx: index("case_events_navigator_idx").on(table.navigatorId, table.occurredAt),
  caseIdx: index("case_events_case_idx").on(table.caseId),
  eventTypeIdx: index("case_events_type_idx").on(table.eventType),
}));

// ============================================================================
// AUDIT LOGGING - Comprehensive audit trail for compliance and security
// ============================================================================

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Who performed the action
  userId: varchar("user_id").references(() => users.id),
  username: text("username"), // Cached for performance
  userRole: text("user_role"), // Cached role at time of action
  
  // What was done
  action: text("action").notNull(), // CREATE, READ, UPDATE, DELETE, EXPORT, LOGIN, LOGOUT, etc.
  resource: text("resource").notNull(), // user, client_case, document, tax_return, etc.
  resourceId: varchar("resource_id"), // ID of affected resource
  
  // Details
  details: jsonb("details"), // Action-specific details
  changesBefore: jsonb("changes_before"), // State before change (for UPDATE/DELETE)
  changesAfter: jsonb("changes_after"), // State after change (for UPDATE/CREATE)
  
  // Context
  ipAddress: text("ip_address"), // Client IP
  userAgent: text("user_agent"), // Browser/client info
  sessionId: text("session_id"), // Session identifier
  requestId: text("request_id"), // Request correlation ID
  
  // Security flags
  sensitiveDataAccessed: boolean("sensitive_data_accessed").default(false), // SSN, bank account, etc.
  piiFields: text("pii_fields").array(), // List of PII fields accessed
  
  // Outcome
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"), // If action failed
  
  // Metadata
  countyId: varchar("county_id").references(() => counties.id), // Multi-tenant context
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("audit_logs_user_idx").on(table.userId, table.createdAt),
  resourceIdx: index("audit_logs_resource_idx").on(table.resource, table.resourceId),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  sensitiveIdx: index("audit_logs_sensitive_idx").on(table.sensitiveDataAccessed, table.createdAt),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
}));

// Audit log insert/select types
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ============================================================================
// SECURITY MONITORING - Failed logins, suspicious activity tracking
// ============================================================================

export const securityEvents = pgTable("security_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Event classification
  eventType: text("event_type").notNull(), // failed_login, suspicious_activity, rate_limit_exceeded, brute_force_attempt, etc.
  severity: text("severity").notNull().default("low"), // low, medium, high, critical
  
  // User context (nullable for unauthenticated events)
  userId: varchar("user_id").references(() => users.id),
  username: text("username"), // Attempted username (even if user doesn't exist)
  
  // Request context
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent"),
  requestPath: text("request_path"),
  requestMethod: text("request_method"),
  
  // Event details
  details: jsonb("details").notNull(), // Event-specific information
  
  // Response
  blocked: boolean("blocked").default(false), // Was request blocked
  actionTaken: text("action_taken"), // account_locked, ip_banned, alert_sent, etc.
  
  // Investigation
  reviewed: boolean("reviewed").default(false),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  falsePositive: boolean("false_positive").default(false),
  
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  eventTypeIdx: index("security_events_type_idx").on(table.eventType, table.occurredAt),
  ipIdx: index("security_events_ip_idx").on(table.ipAddress, table.occurredAt),
  userIdx: index("security_events_user_idx").on(table.userId, table.occurredAt),
  severityIdx: index("security_events_severity_idx").on(table.severity, table.occurredAt),
  reviewedIdx: index("security_events_reviewed_idx").on(table.reviewed),
}));

// Security event insert/select types
export const insertSecurityEventSchema = createInsertSchema(securityEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;
export type SecurityEvent = typeof securityEvents.$inferSelect;

// ============================================================================
// API KEYS - Third-party API access management
// ============================================================================

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // API key (hashed like passwords)
  key: text("key").notNull().unique(), // Hashed API key (bcrypt)
  
  // Organization info
  name: text("name").notNull(), // Organization/partner name
  organizationId: varchar("organization_id"), // Optional link to organization entity
  tenantId: varchar("tenant_id").notNull(), // References tenants table // Multi-tenant isolation
  
  // Permissions and limits
  scopes: jsonb("scopes").notNull(), // Array of scopes: ['eligibility:read', 'documents:write', etc.]
  rateLimit: integer("rate_limit").notNull().default(1000), // Requests per hour
  
  // Status
  status: text("status").notNull().default("active"), // active, suspended, revoked
  
  // Usage tracking
  lastUsedAt: timestamp("last_used_at"),
  requestCount: integer("request_count").notNull().default(0), // Total requests made
  
  // Expiration
  expiresAt: timestamp("expires_at"), // Optional expiration date
  
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  revokedBy: varchar("revoked_by").references(() => users.id),
}, (table) => ({
  tenantIdx: index("api_keys_tenant_idx").on(table.tenantId),
  statusIdx: index("api_keys_status_idx").on(table.status),
  organizationIdx: index("api_keys_organization_idx").on(table.organizationId),
}));

// API key insert/select types
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  requestCount: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// ============================================================================
// API USAGE LOGS - Track API usage for analytics and billing
// ============================================================================

export const apiUsageLogs = pgTable("api_usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // API key reference
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id, { onDelete: "cascade" }).notNull(),
  
  // Request details
  endpoint: text("endpoint").notNull(), // /api/v1/eligibility/check
  method: text("method").notNull(), // GET, POST, etc.
  statusCode: integer("status_code").notNull(), // 200, 400, 500, etc.
  responseTime: integer("response_time"), // Response time in milliseconds
  
  // Request metadata
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  requestSize: integer("request_size"), // Request body size in bytes
  responseSize: integer("response_size"), // Response body size in bytes
  
  // Error tracking
  errorMessage: text("error_message"), // Error message if failed
  errorCode: text("error_code"), // Standardized error code
  
  // Additional metadata
  metadata: jsonb("metadata"), // Any additional context
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  apiKeyIdx: index("api_usage_logs_key_idx").on(table.apiKeyId, table.createdAt),
  endpointIdx: index("api_usage_logs_endpoint_idx").on(table.endpoint, table.createdAt),
  statusIdx: index("api_usage_logs_status_idx").on(table.statusCode, table.createdAt),
  createdAtIdx: index("api_usage_logs_created_at_idx").on(table.createdAt),
}));

// API usage log insert/select types
export const insertApiUsageLogSchema = createInsertSchema(apiUsageLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertApiUsageLog = z.infer<typeof insertApiUsageLogSchema>;
export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;

// ============================================================================
// WEBHOOKS - Partner event notification system
// ============================================================================

export const webhooks = pgTable("webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // API key reference (optional - for API partner webhooks)
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id, { onDelete: "cascade" }),
  
  // Multi-tenant support
  tenantId: varchar("tenant_id"), // References tenants table - relation defined below
  
  // Webhook config
  url: text("url").notNull(), // Partner's webhook URL
  events: text("events").array().notNull(), // Array of event types: ['sms.received', 'application.submitted', 'document.processed']
  secret: text("secret").notNull(), // HMAC secret for signature verification
  
  // Status
  status: text("status").notNull().default("active"), // active, paused, failed
  
  // Retry configuration
  maxRetries: integer("max_retries").notNull().default(3),
  retryCount: integer("retry_count").notNull().default(0),
  
  // Delivery tracking
  lastTriggeredAt: timestamp("last_triggered_at"),
  lastDeliveryAt: timestamp("last_delivery_at"),
  lastDeliveryStatus: text("last_delivery_status"), // success, failed
  lastResponse: jsonb("last_response"), // Last webhook response
  failureCount: integer("failure_count").notNull().default(0),
  
  // Config
  retryConfig: jsonb("retry_config"), // Advanced retry configuration
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  apiKeyIdx: index("webhooks_api_key_idx").on(table.apiKeyId),
  tenantIdx: index("webhooks_tenant_idx").on(table.tenantId),
  statusIdx: index("webhooks_status_idx").on(table.status),
}));

// Webhook Delivery Logs - Track individual webhook delivery attempts
export const webhookDeliveryLogs = pgTable("webhook_delivery_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookId: varchar("webhook_id").references(() => webhooks.id, { onDelete: "cascade" }).notNull(),
  
  // Event details
  eventType: text("event_type").notNull(), // 'sms.received', 'application.submitted', etc.
  payload: jsonb("payload").notNull(), // The event payload sent
  
  // Delivery attempt
  attemptNumber: integer("attempt_number").notNull().default(1),
  httpStatus: integer("http_status"), // HTTP response status code
  responseBody: text("response_body"), // Response from webhook endpoint
  responseHeaders: jsonb("response_headers"), // Response headers
  
  // Timing
  deliveredAt: timestamp("delivered_at"),
  responseTime: integer("response_time"), // in milliseconds
  
  // Status
  status: text("status").notNull(), // 'success', 'failed', 'pending'
  errorMessage: text("error_message"), // Error message if failed
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  webhookIdIdx: index("webhook_logs_webhook_id_idx").on(table.webhookId),
  statusIdx: index("webhook_logs_status_idx").on(table.status),
  createdAtIdx: index("webhook_logs_created_at_idx").on(table.createdAt),
}));

// Webhook insert/select types
export const insertWebhookSchema = createInsertSchema(webhooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  failureCount: true,
  retryCount: true,
});

export const insertWebhookDeliveryLogSchema = createInsertSchema(webhookDeliveryLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhookDeliveryLog = z.infer<typeof insertWebhookDeliveryLogSchema>;
export type WebhookDeliveryLog = typeof webhookDeliveryLogs.$inferSelect;

// Multi-county schema insert/select types
export const insertCountySchema = createInsertSchema(counties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCountyUserSchema = createInsertSchema(countyUsers).omit({
  id: true,
  createdAt: true,
});

export const insertCountyMetricSchema = createInsertSchema(countyMetrics).omit({
  id: true,
  createdAt: true,
});

export type InsertCounty = z.infer<typeof insertCountySchema>;
export type County = typeof counties.$inferSelect;
export type InsertCountyUser = z.infer<typeof insertCountyUserSchema>;
export type CountyUser = typeof countyUsers.$inferSelect;
export type InsertCountyMetric = z.infer<typeof insertCountyMetricSchema>;
export type CountyMetric = typeof countyMetrics.$inferSelect;

// Gamification schema insert/select types
export const insertNavigatorKpiSchema = createInsertSchema(navigatorKpis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNavigatorAchievementSchema = createInsertSchema(navigatorAchievements).omit({
  id: true,
  createdAt: true,
});

export const insertLeaderboardSchema = createInsertSchema(leaderboards).omit({
  id: true,
  createdAt: true,
});

export const insertCaseActivityEventSchema = createInsertSchema(caseActivityEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertNavigatorKpi = z.infer<typeof insertNavigatorKpiSchema>;
export type NavigatorKpi = typeof navigatorKpis.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievements.$inferSelect;
export type InsertNavigatorAchievement = z.infer<typeof insertNavigatorAchievementSchema>;
export type NavigatorAchievement = typeof navigatorAchievements.$inferSelect;
export type InsertLeaderboard = z.infer<typeof insertLeaderboardSchema>;
export type Leaderboard = typeof leaderboards.$inferSelect;
export type InsertCaseActivityEvent = z.infer<typeof insertCaseActivityEventSchema>;
export type CaseActivityEvent = typeof caseActivityEvents.$inferSelect;

// ============================================================================
// SMS INTEGRATION FOR TEXT-BASED BENEFIT SCREENING & INTAKE
// ============================================================================

// SMS Conversations - Track SMS-based benefit screening and intake sessions
export const smsConversations = pgTable("sms_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // Which tenant/state
  phoneNumber: text("phone_number").notNull(), // User's phone (normalized E.164 format)
  sessionType: text("session_type").notNull(), // 'screener', 'intake', 'document_help', 'general_inquiry'
  state: text("state").notNull().default("started"), // 'started', 'collecting_info', 'completed', 'abandoned'
  context: jsonb("context"), // Store conversation data (household size, income, answers, etc.)
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantPhoneIdx: index("sms_conversations_tenant_phone_idx").on(table.tenantId, table.phoneNumber),
  stateIdx: index("sms_conversations_state_idx").on(table.state),
  lastMessageIdx: index("sms_conversations_last_message_idx").on(table.lastMessageAt),
}));

// SMS Messages - Individual text messages in conversations
export const smsMessages = pgTable("sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => smsConversations.id, { onDelete: "cascade" }).notNull(),
  direction: text("direction").notNull(), // 'inbound' or 'outbound'
  messageBody: text("message_body").notNull(),
  twilioSid: text("twilio_sid"), // Twilio message ID
  status: text("status").notNull().default("sent"), // 'sent', 'delivered', 'failed', 'received'
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: index("sms_messages_conversation_idx").on(table.conversationId),
  twilioSidIdx: index("sms_messages_twilio_sid_idx").on(table.twilioSid),
  statusIdx: index("sms_messages_status_idx").on(table.status),
}));

// SMS Tenant Configuration - Map Twilio phone numbers to tenants
export const smsTenantConfig = pgTable("sms_tenant_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull().unique(),
  twilioPhoneNumber: text("twilio_phone_number").notNull().unique(), // Tenant's Twilio number in E.164 format
  isActive: boolean("is_active").default(true).notNull(),
  config: jsonb("config"), // SMS-specific configuration (templates, keywords, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  phoneNumberIdx: index("sms_tenant_config_phone_idx").on(table.twilioPhoneNumber),
}));

// Relations for SMS tables
export const smsConversationsRelations = relations(smsConversations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [smsConversations.tenantId],
    references: [tenants.id],
  }),
  messages: many(smsMessages),
}));

export const smsMessagesRelations = relations(smsMessages, ({ one }) => ({
  conversation: one(smsConversations, {
    fields: [smsMessages.conversationId],
    references: [smsConversations.id],
  }),
}));

export const smsTenantConfigRelations = relations(smsTenantConfig, ({ one }) => ({
  tenant: one(tenants, {
    fields: [smsTenantConfig.tenantId],
    references: [tenants.id],
  }),
}));

// SMS schema insert/select types
export const insertSmsConversationSchema = createInsertSchema(smsConversations).omit({
  id: true,
  createdAt: true,
  lastMessageAt: true,
});

export const insertSmsMessageSchema = createInsertSchema(smsMessages).omit({
  id: true,
  sentAt: true,
});

export const insertSmsTenantConfigSchema = createInsertSchema(smsTenantConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSmsConversation = z.infer<typeof insertSmsConversationSchema>;
export type SmsConversation = typeof smsConversations.$inferSelect;
export type InsertSmsMessage = z.infer<typeof insertSmsMessageSchema>;
export type SmsMessage = typeof smsMessages.$inferSelect;
export type InsertSmsTenantConfig = z.infer<typeof insertSmsTenantConfigSchema>;
export type SmsTenantConfig = typeof smsTenantConfig.$inferSelect;

// Tenant schema insert/select types
export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantBrandingSchema = createInsertSchema(tenantBranding).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenantBranding = z.infer<typeof insertTenantBrandingSchema>;
export type TenantBranding = typeof tenantBranding.$inferSelect;

// ============================================================================
// PHONE SYSTEM TABLES - Voice Call Infrastructure
// ============================================================================

// Phone System Configuration for Multi-tenant Setup
export const phoneSystemConfigs = pgTable("phone_system_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(), // References tenants table
  systemType: text("system_type").notNull(), // twilio, asterisk, freepbx, cisco, custom_sip
  systemName: text("system_name").notNull(),
  
  // SIP/PBX Configuration
  sipHost: text("sip_host"), // SIP server hostname/IP
  sipPort: integer("sip_port").default(5060),
  sipUsername: text("sip_username"),
  sipPassword: text("sip_password"), // encrypted
  sipDomain: text("sip_domain"),
  sipTransport: text("sip_transport").default("udp"), // udp, tcp, tls
  
  // Twilio Configuration
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"), // encrypted
  twilioPhoneNumber: text("twilio_phone_number"),
  twilioApiKey: text("twilio_api_key"),
  twilioApiSecret: text("twilio_api_secret"), // encrypted
  
  // WebRTC Configuration
  stunServers: jsonb("stun_servers"), // Array of STUN server URLs
  turnServers: jsonb("turn_servers"), // Array of TURN server configs
  
  // Features
  supportsRecording: boolean("supports_recording").default(true),
  supportsTranscription: boolean("supports_transcription").default(false),
  supportsWhisper: boolean("supports_whisper").default(false),
  supportsDTMF: boolean("supports_dtmf").default(true),
  
  priority: integer("priority").default(0), // Higher priority systems tried first
  isActive: boolean("is_active").default(true).notNull(),
  isDefault: boolean("is_default").default(false), // Default system for tenant
  
  metadata: jsonb("metadata"), // Additional system-specific config
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("phone_system_configs_tenant_id_idx").on(table.tenantId),
  tenantActiveIdx: index("phone_system_configs_tenant_active_idx").on(table.tenantId, table.isActive),
}));

// Phone Call Records - Main call tracking table
export const phoneCallRecords = pgTable("phone_call_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(), // References tenants table
  systemConfigId: varchar("system_config_id").references(() => phoneSystemConfigs.id),
  
  // Call identifiers
  callId: text("call_id").notNull().unique(), // Unique call identifier (SID for Twilio, UUID for others)
  parentCallId: text("parent_call_id"), // For transfers/conferences
  sessionId: text("session_id"), // WebRTC session ID if applicable
  
  // Call parties
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  agentId: varchar("agent_id").references(() => users.id),
  clientId: varchar("client_id").references(() => users.id),
  
  // Call details
  direction: text("direction").notNull(), // inbound, outbound
  status: text("status").notNull(), // queued, ringing, in-progress, completed, failed, busy, no-answer
  disposition: text("disposition"), // answered, voicemail, abandoned, transferred
  
  // Timestamps
  queuedAt: timestamp("queued_at"),
  startTime: timestamp("start_time"),
  answerTime: timestamp("answer_time"),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // seconds
  talkTime: integer("talk_time"), // actual talk time in seconds
  holdTime: integer("hold_time"), // total hold time in seconds
  
  // Recording & Transcription
  recordingUrl: text("recording_url"),
  recordingDuration: integer("recording_duration"),
  transcriptionText: text("transcription_text"),
  transcriptionUrl: text("transcription_url"),
  consentGiven: boolean("consent_given").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  
  // IVR Navigation
  ivrPath: jsonb("ivr_path"), // Array of IVR menu selections
  ivrCompletedAt: timestamp("ivr_completed_at"),
  dtmfInputs: jsonb("dtmf_inputs"), // DTMF tones pressed
  
  // Quality & Analytics
  qualityScore: real("quality_score"), // 0-1 call quality score
  sentimentScore: real("sentiment_score"), // -1 to 1 sentiment analysis
  audioQualityMetrics: jsonb("audio_quality_metrics"), // jitter, packet loss, etc.
  
  // Cost tracking
  cost: integer("cost"), // in cents
  billingDuration: integer("billing_duration"), // billable duration in seconds
  
  notes: text("notes"),
  metadata: jsonb("metadata"), // Additional call-specific data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  callIdIdx: index("phone_call_records_call_id_idx").on(table.callId),
  tenantIdIdx: index("phone_call_records_tenant_id_idx").on(table.tenantId),
  agentIdIdx: index("phone_call_records_agent_id_idx").on(table.agentId),
  clientIdIdx: index("phone_call_records_client_id_idx").on(table.clientId),
  statusIdx: index("phone_call_records_status_idx").on(table.status),
  startTimeIdx: index("phone_call_records_start_time_idx").on(table.startTime),
}));

// IVR Menu Configuration
export const ivrMenus = pgTable("ivr_menus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(), // References tenants table
  menuId: text("menu_id").notNull(), // Unique menu identifier
  parentMenuId: text("parent_menu_id"), // For nested menus
  
  // Menu properties
  name: text("name").notNull(),
  description: text("description"),
  greetingText: text("greeting_text").notNull(), // Text to be spoken
  greetingAudioUrl: text("greeting_audio_url"), // Pre-recorded audio
  
  // Language support
  language: text("language").default("en").notNull(), // en, es, etc.
  voiceGender: text("voice_gender").default("female"), // male, female
  voiceName: text("voice_name"), // Specific TTS voice name
  
  // Input handling
  inputType: text("input_type").default("dtmf").notNull(), // dtmf, voice, both
  maxDigits: integer("max_digits").default(1),
  timeout: integer("timeout").default(5), // seconds to wait for input
  maxRetries: integer("max_retries").default(3),
  
  // Natural language understanding (for voice input)
  speechModel: text("speech_model"), // Speech recognition model
  intentKeywords: jsonb("intent_keywords"), // Keywords for voice recognition
  
  isActive: boolean("is_active").default(true).notNull(),
  priority: integer("priority").default(0), // Menu ordering
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantMenuIdx: index("ivr_menus_tenant_menu_idx").on(table.tenantId, table.menuId),
  parentMenuIdx: index("ivr_menus_parent_menu_idx").on(table.parentMenuId),
}));

// IVR Menu Options
export const ivrMenuOptions = pgTable("ivr_menu_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  menuId: varchar("menu_id").references(() => ivrMenus.id, { onDelete: "cascade" }).notNull(),
  
  // Option trigger
  dtmfKey: text("dtmf_key"), // "1", "2", "#", "*", etc.
  voiceKeyword: text("voice_keyword"), // "benefits", "status", etc.
  
  // Option details
  label: text("label").notNull(), // "Benefit Screening"
  promptText: text("prompt_text").notNull(), // "Press 1 for benefit screening"
  
  // Action
  actionType: text("action_type").notNull(), // menu, transfer, callback, hangup, record
  actionTarget: text("action_target"), // Menu ID, phone number, queue name
  actionMetadata: jsonb("action_metadata"), // Additional action-specific data
  
  priority: integer("priority").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  menuIdIdx: index("ivr_menu_options_menu_id_idx").on(table.menuId),
  dtmfKeyIdx: index("ivr_menu_options_dtmf_key_idx").on(table.menuId, table.dtmfKey),
}));

// Call Queue Management
export const callQueues = pgTable("call_queues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(), // References tenants table
  
  queueName: text("queue_name").notNull(),
  description: text("description"),
  
  // Queue configuration
  maxWaitTime: integer("max_wait_time").default(1800), // seconds (30 min default)
  maxQueueSize: integer("max_queue_size").default(100),
  priorityEnabled: boolean("priority_enabled").default(false),
  
  // Music/Messages
  holdMusicUrl: text("hold_music_url"),
  positionAnnouncementInterval: integer("position_announcement_interval").default(60), // seconds
  waitTimeAnnouncementInterval: integer("wait_time_announcement_interval").default(120), // seconds
  
  // Routing
  routingStrategy: text("routing_strategy").default("round_robin"), // round_robin, least_recent, skills_based
  overflowQueueId: varchar("overflow_queue_id"), // Transfer to another queue if full
  
  // Operating hours
  operatingHours: jsonb("operating_hours"), // Schedule by day of week
  afterHoursAction: text("after_hours_action"), // voicemail, transfer, message
  afterHoursTarget: text("after_hours_target"),
  
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantQueueIdx: index("call_queues_tenant_queue_idx").on(table.tenantId, table.queueName),
}));

// Call Queue Entries - Active calls in queue
export const callQueueEntries = pgTable("call_queue_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queueId: varchar("queue_id").references(() => callQueues.id, { onDelete: "cascade" }).notNull(),
  callRecordId: varchar("call_record_id").references(() => phoneCallRecords.id).notNull(),
  
  position: integer("position").notNull(),
  priority: integer("priority").default(0), // Higher priority served first
  
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  abandonedAt: timestamp("abandoned_at"),
  answeredAt: timestamp("answered_at"),
  
  estimatedWaitTime: integer("estimated_wait_time"), // seconds
  actualWaitTime: integer("actual_wait_time"), // seconds
  
  status: text("status").notNull(), // waiting, abandoned, answered
  metadata: jsonb("metadata"),
}, (table) => ({
  queueIdIdx: index("call_queue_entries_queue_id_idx").on(table.queueId),
  statusIdx: index("call_queue_entries_status_idx").on(table.status),
  positionIdx: index("call_queue_entries_position_idx").on(table.queueId, table.position),
}));

// Call Recording Consent Tracking
export const callRecordingConsents = pgTable("call_recording_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callRecordId: varchar("call_record_id").references(() => phoneCallRecords.id).notNull(),
  
  consentType: text("consent_type").notNull(), // verbal, dtmf, written
  consentGiven: boolean("consent_given").notNull(),
  consentTimestamp: timestamp("consent_timestamp").defaultNow().notNull(),
  
  // Consent details
  consentMethod: text("consent_method"), // How consent was obtained
  consentText: text("consent_text"), // What was said/shown
  dtmfResponse: text("dtmf_response"), // DTMF key pressed for consent
  
  // Legal compliance
  stateCode: text("state_code"), // State where call originated
  requiresTwoPartyConsent: boolean("requires_two_party_consent"),
  
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  callRecordIdx: index("call_recording_consents_call_record_idx").on(table.callRecordId),
}));

// Agent Call Status - Real-time agent availability
export const agentCallStatus = pgTable("agent_call_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => users.id).notNull().unique(),
  
  status: text("status").notNull(), // available, busy, on_call, after_call_work, break, offline
  currentCallId: varchar("current_call_id").references(() => phoneCallRecords.id),
  
  // Statistics
  callsHandledToday: integer("calls_handled_today").default(0),
  totalTalkTimeToday: integer("total_talk_time_today").default(0), // seconds
  averageHandleTime: integer("average_handle_time"), // seconds
  
  // Availability
  availableSince: timestamp("available_since"),
  lastCallEndedAt: timestamp("last_call_ended_at"),
  nextAvailableAt: timestamp("next_available_at"),
  
  // Queue assignments
  assignedQueues: jsonb("assigned_queues"), // Array of queue IDs
  skills: jsonb("skills"), // Array of skill tags for routing
  
  metadata: jsonb("metadata"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("agent_call_status_status_idx").on(table.status),
  agentIdIdx: index("agent_call_status_agent_id_idx").on(table.agentId),
}));

// ============================================================================
// MONITORING METRICS - Error tracking and performance monitoring
// ============================================================================

export const monitoringMetrics = pgTable("monitoring_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  metricType: text("metric_type").notNull(), // error_rate, response_time, cache_hit, database_query, api_latency, etc.
  metricValue: real("metric_value").notNull(), // Numeric value of the metric
  metadata: jsonb("metadata"), // Additional context: endpoint, tenant, error type, user, etc.
  tenantId: varchar("tenant_id").references(() => tenants.id), // Multi-tenant isolation
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("monitoring_metrics_type_idx").on(table.metricType),
  timestampIdx: index("monitoring_metrics_timestamp_idx").on(table.timestamp),
  tenantIdx: index("monitoring_metrics_tenant_idx").on(table.tenantId),
}));

export const alertHistory = pgTable("alert_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertType: text("alert_type").notNull(), // error_rate, slow_response, database_error, api_failure, etc.
  severity: text("severity").notNull(), // critical, warning, info
  message: text("message").notNull(),
  metadata: jsonb("metadata"), // Additional alert context
  channels: jsonb("channels"), // Where the alert was sent (email, slack, etc.)
  resolved: boolean("resolved").default(false).notNull(),
  resolvedAt: timestamp("resolved_at"),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("alert_history_type_idx").on(table.alertType),
  severityIdx: index("alert_history_severity_idx").on(table.severity),
  resolvedIdx: index("alert_history_resolved_idx").on(table.resolved),
  createdAtIdx: index("alert_history_created_at_idx").on(table.createdAt),
}));

export const alertRules = pgTable("alert_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "High Error Rate", "Slow API Response", etc.
  metricType: text("metric_type").notNull(), // error_rate, response_time, cache_hit_rate, etc.
  threshold: real("threshold").notNull(), // Numeric threshold value
  comparison: text("comparison").notNull(), // greater_than, less_than, equals
  severity: text("severity").notNull(), // critical, warning, info
  channels: jsonb("channels").notNull(), // ['email', 'sms', 'in_app']
  enabled: boolean("enabled").notNull().default(true),
  cooldownMinutes: integer("cooldown_minutes").default(30), // Prevent alert spam
  lastTriggered: timestamp("last_triggered"),
  recipientUserIds: jsonb("recipient_user_ids"), // Array of user IDs to notify
  recipientRoles: jsonb("recipient_roles"), // ['admin', 'navigator'] - role-based recipients
  metadata: jsonb("metadata"), // Additional config
  tenantId: varchar("tenant_id").references(() => tenants.id),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  metricTypeIdx: index("alert_rules_metric_type_idx").on(table.metricType),
  enabledIdx: index("alert_rules_enabled_idx").on(table.enabled),
  tenantIdx: index("alert_rules_tenant_idx").on(table.tenantId),
}));

// Relations
export const monitoringMetricsRelations = relations(monitoringMetrics, ({ one }) => ({
  tenant: one(tenants, {
    fields: [monitoringMetrics.tenantId],
    references: [tenants.id],
  }),
}));

export const alertHistoryRelations = relations(alertHistory, ({ one }) => ({
  tenant: one(tenants, {
    fields: [alertHistory.tenantId],
    references: [tenants.id],
  }),
}));

export const alertRulesRelations = relations(alertRules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [alertRules.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(users, {
    fields: [alertRules.createdBy],
    references: [users.id],
  }),
}));

// Insert/select schemas
export const insertMonitoringMetricSchema = createInsertSchema(monitoringMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertAlertHistorySchema = createInsertSchema(alertHistory).omit({
  id: true,
  createdAt: true,
});

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTriggered: true,
});

export type InsertMonitoringMetric = z.infer<typeof insertMonitoringMetricSchema>;
export type MonitoringMetric = typeof monitoringMetrics.$inferSelect;
export type InsertAlertHistory = z.infer<typeof insertAlertHistorySchema>;
export type AlertHistory = typeof alertHistory.$inferSelect;
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRules.$inferSelect;

// ============================================================================
// COUNTY TAX RATES - Maryland County Tax Rate Management
// ============================================================================

export const countyTaxRates = pgTable("county_tax_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countyName: text("county_name").notNull(),
  taxYear: integer("tax_year").notNull(),
  minRate: real("min_rate").notNull(),
  maxRate: real("max_rate").notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  countyYearIdx: index("county_tax_rates_county_year_idx").on(table.countyName, table.taxYear),
}));

// Insert/select schemas
export const insertCountyTaxRateSchema = createInsertSchema(countyTaxRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCountyTaxRate = z.infer<typeof insertCountyTaxRateSchema>;
export type CountyTaxRate = typeof countyTaxRates.$inferSelect;

// ============================================================================
// QC (QUALITY CONTROL) ANALYTICS - Maryland SNAP Predictive Analytics
// ============================================================================

// QC Error Patterns - Track error trends over time for predictive analytics
export const qcErrorPatterns = pgTable("qc_error_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  errorCategory: text("error_category").notNull(), // shelter_utility, income_verification, asset_verification, categorical_eligibility, etc.
  errorSubtype: text("error_subtype").notNull(), // incorrect_sua_calculation, missing_income_doc, etc.
  errorDescription: text("error_description").notNull(),
  quarterOccurred: text("quarter_occurred").notNull(), // 2024-Q1, 2024-Q2, etc.
  errorCount: integer("error_count").notNull(),
  totalCases: integer("total_cases").notNull(),
  errorRate: real("error_rate").notNull(), // Calculated percentage
  trendDirection: text("trend_direction").notNull(), // increasing, decreasing, stable
  severity: text("severity").notNull(), // critical, high, medium, low
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index("qc_error_patterns_category_idx").on(table.errorCategory),
  quarterIdx: index("qc_error_patterns_quarter_idx").on(table.quarterOccurred),
  severityIdx: index("qc_error_patterns_severity_idx").on(table.severity),
}));

// Flagged Cases - High-risk cases for supervisor review
export const flaggedCases = pgTable("flagged_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: text("case_id").notNull(), // Synthetic case identifier
  clientName: text("client_name").notNull(), // Fake name like "Case #12345"
  assignedCaseworkerId: varchar("assigned_caseworker_id").references(() => users.id),
  riskScore: real("risk_score").notNull(), // 0.0 to 1.0
  riskLevel: text("risk_level").notNull(), // high, medium, low
  flaggedErrorTypes: text("flagged_error_types").array().notNull(), // Array of potential error categories
  flaggedDate: timestamp("flagged_date").defaultNow().notNull(),
  reviewStatus: text("review_status").notNull().default("pending"), // pending, reviewed, cleared
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  caseworkerIdx: index("flagged_cases_caseworker_idx").on(table.assignedCaseworkerId),
  statusIdx: index("flagged_cases_status_idx").on(table.reviewStatus),
  riskLevelIdx: index("flagged_cases_risk_level_idx").on(table.riskLevel),
}));

// Job Aids - Training materials and guidance documents
export const jobAids = pgTable("job_aids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: text("category").notNull(), // Links to error categories
  content: text("content").notNull(), // Markdown or HTML guidance
  policyReference: text("policy_reference"), // "7 CFR 273.9(d)(6)"
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index("job_aids_category_idx").on(table.category),
}));

// Training Interventions - Track training effectiveness
export const trainingInterventions = pgTable("training_interventions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trainingTitle: text("training_title").notNull(),
  targetErrorCategory: text("target_error_category").notNull(),
  completedBy: varchar("completed_by").array().notNull(), // User IDs who completed
  completedDate: timestamp("completed_date").notNull(),
  preTrainingErrorRate: real("pre_training_error_rate").notNull(),
  postTrainingErrorRate: real("post_training_error_rate"),
  impactScore: real("impact_score"), // Calculated improvement
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index("training_interventions_category_idx").on(table.targetErrorCategory),
}));

// Relations
export const flaggedCasesRelations = relations(flaggedCases, ({ one }) => ({
  caseworker: one(users, {
    fields: [flaggedCases.assignedCaseworkerId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [flaggedCases.reviewedBy],
    references: [users.id],
  }),
}));

// Insert/select schemas
export const insertQcErrorPatternSchema = createInsertSchema(qcErrorPatterns).omit({
  id: true,
  createdAt: true,
});

export const insertFlaggedCaseSchema = createInsertSchema(flaggedCases).omit({
  id: true,
  createdAt: true,
  flaggedDate: true,
});

export const insertJobAidSchema = createInsertSchema(jobAids).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertTrainingInterventionSchema = createInsertSchema(trainingInterventions).omit({
  id: true,
  createdAt: true,
});

export type InsertQcErrorPattern = z.infer<typeof insertQcErrorPatternSchema>;
export type QcErrorPattern = typeof qcErrorPatterns.$inferSelect;
export type InsertFlaggedCase = z.infer<typeof insertFlaggedCaseSchema>;
export type FlaggedCase = typeof flaggedCases.$inferSelect;
export type InsertJobAid = z.infer<typeof insertJobAidSchema>;
export type JobAid = typeof jobAids.$inferSelect;
export type InsertTrainingIntervention = z.infer<typeof insertTrainingInterventionSchema>;
export type TrainingIntervention = typeof trainingInterventions.$inferSelect;

// ============================================================================
// USER CONSENTS - HIPAA Compliance & Legal Policy Tracking
// ============================================================================

export const userConsents = pgTable("user_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  policyType: text("policy_type").notNull(), // 'privacy', 'terms', 'both'
  policyVersion: text("policy_version").notNull(), // '1.0', '2.0', etc.
  consentedAt: timestamp("consented_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_consents_user_id_idx").on(table.userId),
  policyTypeIdx: index("user_consents_policy_type_idx").on(table.policyType),
}));

// Relations
export const userConsentsRelations = relations(userConsents, ({ one }) => ({
  user: one(users, {
    fields: [userConsents.userId],
    references: [users.id],
  }),
}));

// Insert/select schemas
export const insertUserConsentSchema = createInsertSchema(userConsents).omit({
  id: true,
  consentedAt: true,
  createdAt: true,
});

export type InsertUserConsent = z.infer<typeof insertUserConsentSchema>;
export type UserConsent = typeof userConsents.$inferSelect;

// ============================================================================
// VITA DOCUMENT UPLOAD PORTAL - Tax Document Management & E-Signatures
// ============================================================================

// VITA Document Categories - Tax-specific document types
export type VitaDocumentCategory = 
  | "W2" 
  | "1099_MISC" 
  | "1099_NEC" 
  | "1099_INT" 
  | "1099_DIV" 
  | "1099_R" 
  | "1095_A" 
  | "ID_DOCUMENT" 
  | "SUPPORTING_RECEIPT" 
  | "OTHER";

// VITA Document Requests - Track document collection for tax prep
export const vitaDocumentRequests = pgTable("vita_document_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to VITA intake session
  vitaSessionId: varchar("vita_session_id").references(() => vitaIntakeSessions.id, { onDelete: "cascade" }).notNull(),
  
  // Document category and metadata
  category: text("category").notNull(), // W2, 1099_MISC, 1099_NEC, 1099_INT, 1099_DIV, 1099_R, 1095_A, ID_DOCUMENT, SUPPORTING_RECEIPT, OTHER
  categoryLabel: text("category_label").notNull(), // Human-readable name like "W-2 Wage and Tax Statement"
  
  // TaxSlayer enhancement: Document organization
  taxYear: integer("tax_year"), // Tax year this document pertains to
  householdMember: text("household_member"), // Primary taxpayer, spouse, dependent name
  batchId: text("batch_id"), // Group related documents from same upload session
  
  // Upload status - Enhanced workflow
  status: text("status").notNull().default("pending"), // pending, uploaded, reviewed, approved, rejected, replaced, included_in_return
  processingStatus: text("processing_status"), // queued, extracting, validating, complete, failed
  
  // Document reference (if uploaded)
  documentId: varchar("document_id").references(() => documents.id, { onDelete: "set null" }),
  taxDocumentId: varchar("tax_document_id").references(() => taxDocuments.id, { onDelete: "set null" }),
  
  // TaxSlayer enhancement: Document replacement tracking
  replacesDocumentId: varchar("replaces_document_id"), // Points to previous version - self-reference
  replacedByDocumentId: varchar("replaced_by_document_id"), // Points to newer version - self-reference
  replacementReason: text("replacement_reason"), // poor_quality, incomplete, wrong_document, updated_version
  
  // TaxSlayer enhancement: Quality validation metrics
  qualityValidation: jsonb("quality_validation"), // { imageResolution, fileSize, pageCount, orientation, readability, issues: [] }
  qualityScore: real("quality_score"), // 0-1 confidence score from Gemini
  qualityIssues: jsonb("quality_issues").default([]), // Array of quality problems: [{type, severity, description}]
  isQualityAcceptable: boolean("is_quality_acceptable").default(true), // False if quality check fails
  
  // Extracted data (from Gemini Vision)
  extractedData: jsonb("extracted_data"), // Structured form fields from tax document
  
  // Navigator notes and review
  navigatorNotes: text("navigator_notes"),
  requestedBy: varchar("requested_by").references(() => users.id), // Navigator who requested this document
  reviewedBy: varchar("reviewed_by").references(() => users.id), // Staff who reviewed the document
  approvedBy: varchar("approved_by").references(() => users.id), // Staff who approved for tax return
  
  // TaxSlayer enhancement: Secure document access
  secureDownloadExpiry: timestamp("secure_download_expiry"), // When signed URL expires
  downloadCount: integer("download_count").default(0), // Track how many times downloaded
  lastDownloadedAt: timestamp("last_downloaded_at"),
  lastDownloadedBy: varchar("last_downloaded_by").references(() => users.id),
  
  // Timestamps
  uploadedAt: timestamp("uploaded_at"),
  extractedAt: timestamp("extracted_at"),
  verifiedAt: timestamp("verified_at"),
  reviewedAt: timestamp("reviewed_at"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("vita_doc_requests_session_idx").on(table.vitaSessionId),
  categoryIdx: index("vita_doc_requests_category_idx").on(table.category),
  statusIdx: index("vita_doc_requests_status_idx").on(table.status),
  batchIdIdx: index("vita_doc_requests_batch_idx").on(table.batchId),
  taxYearIdx: index("vita_doc_requests_tax_year_idx").on(table.taxYear),
}));

// VITA Signature Requests - E-signature workflow for Form 8879 and consents
export const vitaSignatureRequests = pgTable("vita_signature_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to VITA intake session
  vitaSessionId: varchar("vita_session_id").references(() => vitaIntakeSessions.id, { onDelete: "cascade" }).notNull(),
  
  // Form type and metadata
  formType: text("form_type").notNull(), // form_8879, consent_form, both
  formTitle: text("form_title").notNull(), // "IRS e-file Authorization (Form 8879)"
  
  // Signature status
  status: text("status").notNull().default("pending"), // pending, sent, signed, declined, expired
  
  // Signature data (encrypted)
  signatureData: jsonb("signature_data"), // { taxpayerSignature: string, spouseSignature?: string, signedFields: {} }
  
  // Compliance tracking
  ipAddress: text("ip_address"), // IP address at time of signature
  userAgent: text("user_agent"), // Browser/device info
  geolocation: jsonb("geolocation"), // Optional GPS coordinates
  
  // Session management
  expiresAt: timestamp("expires_at"), // Signature request expiry
  signedAt: timestamp("signed_at"),
  
  // Audit trail
  requestedBy: varchar("requested_by").references(() => users.id).notNull(), // Navigator who requested
  signedBy: varchar("signed_by").references(() => users.id), // Taxpayer who signed
  
  // Webhook integration
  webhookUrl: text("webhook_url"), // Callback URL for external systems
  webhookDelivered: boolean("webhook_delivered").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("vita_sig_requests_session_idx").on(table.vitaSessionId),
  statusIdx: index("vita_sig_requests_status_idx").on(table.status),
  expiresAtIdx: index("vita_sig_requests_expires_idx").on(table.expiresAt),
}));

// VITA Messages - Secure messaging between navigator and taxpayer
export const vitaMessages = pgTable("vita_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to VITA intake session
  vitaSessionId: varchar("vita_session_id").references(() => vitaIntakeSessions.id, { onDelete: "cascade" }).notNull(),
  
  // Sender information
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  senderRole: text("sender_role").notNull(), // navigator, taxpayer
  senderName: text("sender_name").notNull(), // Display name for UI
  
  // Message content (encrypted)
  messageText: text("message_text").notNull(),
  
  // Attachments (references to documents)
  attachments: jsonb("attachments").default([]), // [{ documentId, filename, fileSize, mimeType }]
  
  // Message metadata
  messageType: text("message_type").default("standard"), // standard, system_notification, document_request, document_rejection
  relatedDocumentRequestId: varchar("related_document_request_id").references(() => vitaDocumentRequests.id, { onDelete: "set null" }),
  
  // Read tracking
  readAt: timestamp("read_at"),
  
  // Moderation
  flaggedForReview: boolean("flagged_for_review").default(false),
  moderatedBy: varchar("moderated_by").references(() => users.id),
  moderationNotes: text("moderation_notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("vita_messages_session_idx").on(table.vitaSessionId),
  senderIdIdx: index("vita_messages_sender_idx").on(table.senderId),
  createdAtIdx: index("vita_messages_created_idx").on(table.createdAt),
  readAtIdx: index("vita_messages_read_idx").on(table.readAt),
}));

// Relations
export const vitaDocumentRequestsRelations = relations(vitaDocumentRequests, ({ one }) => ({
  vitaSession: one(vitaIntakeSessions, {
    fields: [vitaDocumentRequests.vitaSessionId],
    references: [vitaIntakeSessions.id],
  }),
  document: one(documents, {
    fields: [vitaDocumentRequests.documentId],
    references: [documents.id],
  }),
  taxDocument: one(taxDocuments, {
    fields: [vitaDocumentRequests.taxDocumentId],
    references: [taxDocuments.id],
  }),
  requester: one(users, {
    fields: [vitaDocumentRequests.requestedBy],
    references: [users.id],
  }),
}));

export const vitaSignatureRequestsRelations = relations(vitaSignatureRequests, ({ one }) => ({
  vitaSession: one(vitaIntakeSessions, {
    fields: [vitaSignatureRequests.vitaSessionId],
    references: [vitaIntakeSessions.id],
  }),
  requester: one(users, {
    fields: [vitaSignatureRequests.requestedBy],
    references: [users.id],
  }),
  signer: one(users, {
    fields: [vitaSignatureRequests.signedBy],
    references: [users.id],
  }),
}));

export const vitaMessagesRelations = relations(vitaMessages, ({ one }) => ({
  vitaSession: one(vitaIntakeSessions, {
    fields: [vitaMessages.vitaSessionId],
    references: [vitaIntakeSessions.id],
  }),
  sender: one(users, {
    fields: [vitaMessages.senderId],
    references: [users.id],
  }),
  relatedDocumentRequest: one(vitaDocumentRequests, {
    fields: [vitaMessages.relatedDocumentRequestId],
    references: [vitaDocumentRequests.id],
  }),
  moderator: one(users, {
    fields: [vitaMessages.moderatedBy],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertVitaDocumentRequestSchema = createInsertSchema(vitaDocumentRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVitaSignatureRequestSchema = createInsertSchema(vitaSignatureRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVitaMessageSchema = createInsertSchema(vitaMessages).omit({
  id: true,
  createdAt: true,
});

// VITA Document Audit Trail - Track all document access and modifications
export const vitaDocumentAudit = pgTable("vita_document_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Document reference
  documentRequestId: varchar("document_request_id").references(() => vitaDocumentRequests.id, { onDelete: "cascade" }).notNull(),
  vitaSessionId: varchar("vita_session_id").references(() => vitaIntakeSessions.id, { onDelete: "cascade" }).notNull(),
  
  // Audit action
  action: text("action").notNull(), // uploaded, downloaded, viewed, replaced, approved, rejected, deleted, modified
  actionDetails: jsonb("action_details"), // Additional context about the action
  
  // User tracking
  userId: varchar("user_id").references(() => users.id).notNull(),
  userRole: text("user_role").notNull(), // navigator, caseworker, admin, client
  userName: text("user_name").notNull(),
  
  // Access metadata
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // GCS integration
  objectPath: text("object_path"), // GCS path if applicable
  signedUrlGenerated: boolean("signed_url_generated").default(false), // Whether a signed URL was created
  signedUrlExpiry: timestamp("signed_url_expiry"), // When the signed URL expires
  
  // Change tracking
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  changeReason: text("change_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  documentRequestIdx: index("vita_audit_doc_request_idx").on(table.documentRequestId),
  sessionIdx: index("vita_audit_session_idx").on(table.vitaSessionId),
  userIdx: index("vita_audit_user_idx").on(table.userId),
  actionIdx: index("vita_audit_action_idx").on(table.action),
  createdAtIdx: index("vita_audit_created_idx").on(table.createdAt),
}));

// Relations
export const vitaDocumentAuditRelations = relations(vitaDocumentAudit, ({ one }) => ({
  documentRequest: one(vitaDocumentRequests, {
    fields: [vitaDocumentAudit.documentRequestId],
    references: [vitaDocumentRequests.id],
  }),
  vitaSession: one(vitaIntakeSessions, {
    fields: [vitaDocumentAudit.vitaSessionId],
    references: [vitaIntakeSessions.id],
  }),
  user: one(users, {
    fields: [vitaDocumentAudit.userId],
    references: [users.id],
  }),
}));

export const insertVitaDocumentAuditSchema = createInsertSchema(vitaDocumentAudit).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertVitaDocumentAudit = z.infer<typeof insertVitaDocumentAuditSchema>;
export type VitaDocumentAudit = typeof vitaDocumentAudit.$inferSelect;

export type InsertVitaDocumentRequest = z.infer<typeof insertVitaDocumentRequestSchema>;
export type VitaDocumentRequest = typeof vitaDocumentRequests.$inferSelect;

export type InsertVitaSignatureRequest = z.infer<typeof insertVitaSignatureRequestSchema>;
export type VitaSignatureRequest = typeof vitaSignatureRequests.$inferSelect;

export type InsertVitaMessage = z.infer<typeof insertVitaMessageSchema>;
export type VitaMessage = typeof vitaMessages.$inferSelect;

// Google Calendar Appointments for VITA scheduling
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Google Calendar integration
  googleCalendarEventId: text("google_calendar_event_id").unique(), // Google Calendar event ID for sync
  // Appointment details
  title: text("title").notNull(),
  description: text("description"),
  appointmentType: text("appointment_type").notNull().default("vita_intake"), // vita_intake, vita_review, benefits_consultation, followup
  status: text("status").notNull().default("scheduled"), // scheduled, confirmed, completed, cancelled, no_show
  // Participants
  navigatorId: varchar("navigator_id").references(() => users.id), // assigned navigator/volunteer
  clientId: varchar("client_id").references(() => users.id), // client/applicant
  // Time and duration
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  timeZone: text("time_zone").notNull().default("America/New_York"),
  duration: integer("duration").notNull().default(60), // minutes
  // Location
  locationType: text("location_type").notNull().default("virtual"), // virtual, in_person, phone
  locationDetails: text("location_details"), // Zoom link, office address, phone number
  // VITA specific
  vitaSessionId: varchar("vita_session_id").references(() => vitaIntakeSessions.id),
  taxYear: integer("tax_year"),
  preparerCertificationRequired: text("preparer_certification_required"), // basic, advanced, military
  // Reminders and notifications
  reminderSent: boolean("reminder_sent").default(false).notNull(),
  reminderSentAt: timestamp("reminder_sent_at"),
  confirmationSent: boolean("confirmation_sent").default(false).notNull(),
  confirmationSentAt: timestamp("confirmation_sent_at"),
  // Metadata
  tenantId: varchar("tenant_id").references((): any => tenants.id),
  metadata: jsonb("metadata"), // Additional appointment metadata
  notes: text("notes"), // Internal notes for navigator
  cancellationReason: text("cancellation_reason"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  navigatorIdIdx: index("appointments_navigator_id_idx").on(table.navigatorId),
  clientIdIdx: index("appointments_client_id_idx").on(table.clientId),
  statusIdx: index("appointments_status_idx").on(table.status),
  startTimeIdx: index("appointments_start_time_idx").on(table.startTime),
  appointmentTypeIdx: index("appointments_appointment_type_idx").on(table.appointmentType),
  vitaSessionIdIdx: index("appointments_vita_session_id_idx").on(table.vitaSessionId),
  googleCalendarEventIdIdx: index("appointments_google_calendar_event_id_idx").on(table.googleCalendarEventId),
}));

// Appointment relations
export const appointmentsRelations = relations(appointments, ({ one }) => ({
  navigator: one(users, {
    fields: [appointments.navigatorId],
    references: [users.id],
  }),
  client: one(users, {
    fields: [appointments.clientId],
    references: [users.id],
  }),
  vitaSession: one(vitaIntakeSessions, {
    fields: [appointments.vitaSessionId],
    references: [vitaIntakeSessions.id],
  }),
  creator: one(users, {
    fields: [appointments.createdBy],
    references: [users.id],
  }),
  canceller: one(users, {
    fields: [appointments.cancelledBy],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [appointments.tenantId],
    references: [tenants.id],
  }),
}));

// Insert schema
export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;

// ============================================================================
// MAIVE - AI Validation Engine Tables
// ============================================================================

// MAIVE Test Cases - Define test scenarios for validation
export const maiveTestCases = pgTable("maive_test_cases", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // benefit_calculation, policy_interpretation, document_extraction, eligibility_determination, work_requirements
  scenario: text("scenario").notNull(), // Description of what we're testing
  inputs: jsonb("inputs").notNull(), // Test input data
  expectedOutput: jsonb("expected_output").notNull(), // Ground truth expected output
  accuracyThreshold: real("accuracy_threshold").default(0.95).notNull(), // Required accuracy (0-1)
  stateSpecific: varchar("state_specific"), // State code if state-specific (e.g., "MD", "CA")
  tags: text("tags").array(), // Tags for categorization
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index("maive_test_cases_category_idx").on(table.category),
  stateIdx: index("maive_test_cases_state_idx").on(table.stateSpecific),
  activeIdx: index("maive_test_cases_active_idx").on(table.isActive),
}));

// MAIVE Test Runs - Track test suite executions
export const maiveTestRuns = pgTable("maive_test_runs", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  totalTests: integer("total_tests").notNull(),
  passedTests: integer("passed_tests").notNull(),
  failedTests: integer("failed_tests").notNull(),
  overallAccuracy: real("overall_accuracy").notNull(), // Average accuracy across all tests
  status: text("status").notNull(), // running, passed, failed
  state: varchar("state"), // State being tested (if state-specific)
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  statusIdx: index("maive_test_runs_status_idx").on(table.status),
  stateIdx: index("maive_test_runs_state_idx").on(table.state),
  startedAtIdx: index("maive_test_runs_started_idx").on(table.startedAt),
}));

// MAIVE Evaluations - Individual test case evaluation results
export const maiveEvaluations = pgTable("maive_evaluations", {
  id: varchar("id").primaryKey(),
  testCaseId: varchar("test_case_id").references(() => maiveTestCases.id).notNull(),
  testRunId: varchar("test_run_id").references(() => maiveTestRuns.id).notNull(),
  actualOutput: jsonb("actual_output").notNull(),
  expectedOutput: jsonb("expected_output").notNull(),
  accuracy: real("accuracy").notNull(), // 0-100 accuracy score
  passed: boolean("passed").notNull(),
  reasoning: text("reasoning").notNull(), // LLM's reasoning for the score
  deviations: text("deviations").array(), // List of critical deviations
  executionTime: integer("execution_time").notNull(), // in milliseconds
  llmJudgment: text("llm_judgment").notNull(), // PASS, FAIL, or NEEDS_REVIEW
  evaluatedAt: timestamp("evaluated_at").notNull(),
}, (table) => ({
  testCaseIdx: index("maive_evaluations_test_case_idx").on(table.testCaseId),
  testRunIdx: index("maive_evaluations_test_run_idx").on(table.testRunId),
  passedIdx: index("maive_evaluations_passed_idx").on(table.passed),
  evaluatedAtIdx: index("maive_evaluations_evaluated_idx").on(table.evaluatedAt),
}));

// Insert schemas for MAIVE
export const insertMaiveTestCaseSchema = createInsertSchema(maiveTestCases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMaiveTestRunSchema = createInsertSchema(maiveTestRuns).omit({
  id: true,
});

export const insertMaiveEvaluationSchema = createInsertSchema(maiveEvaluations).omit({
  id: true,
});

// Types for MAIVE
export type InsertMaiveTestCase = z.infer<typeof insertMaiveTestCaseSchema>;
export type MaiveTestCase = typeof maiveTestCases.$inferSelect;
export type InsertMaiveTestRun = z.infer<typeof insertMaiveTestRunSchema>;
export type MaiveTestRun = typeof maiveTestRuns.$inferSelect;
export type InsertMaiveEvaluation = z.infer<typeof insertMaiveEvaluationSchema>;
export type MaiveEvaluation = typeof maiveEvaluations.$inferSelect;

// ============================================================================
// STATE CONFIGURATION SYSTEM - Multi-State White-Labeling Foundation
// ============================================================================

// State Configurations - Core state/jurisdiction settings
export const stateConfigurations = pgTable("state_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull().unique(),
  
  // Basic Information
  stateName: text("state_name").notNull(), // "Maryland", "Pennsylvania", etc.
  stateCode: text("state_code").notNull().unique(), // "MD", "PA", etc.
  abbreviation: text("abbreviation").notNull(), // Display abbreviation
  timezone: text("timezone").notNull().default("America/New_York"), // Timezone identifier
  region: text("region").notNull(), // "Mid-Atlantic", "Northeast", etc.
  
  // Agency Information
  agencyName: text("agency_name").notNull(), // "Maryland Department of Human Services"
  agencyAcronym: text("agency_acronym"), // "MD DHS"
  agencyWebsite: text("agency_website"),
  agencyAddress: text("agency_address"),
  agencyPhone: text("agency_phone"),
  agencyEmail: text("agency_email"),
  
  // Contact Information
  mainContactName: text("main_contact_name"),
  mainContactTitle: text("main_contact_title"),
  mainContactPhone: text("main_contact_phone"),
  mainContactEmail: text("main_contact_email"),
  
  // Emergency/After-Hours Contact
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactEmail: text("emergency_contact_email"),
  
  // Support Channels
  supportPhone: text("support_phone"),
  supportEmail: text("support_email"),
  supportHours: text("support_hours"), // "Mon-Fri 8AM-5PM EST"
  supportLanguages: text("support_languages").array().default(sql`'{en}'::text[]`), // ["en", "es", "zh", etc.]
  
  // Policy Configuration
  policyManualUrl: text("policy_manual_url"),
  regulationsUrl: text("regulations_url"),
  legislativeUrl: text("legislative_url"),
  
  // Feature Flags
  features: jsonb("features").default('{}'), // { "enableVita": true, "enableSms": false, etc. }
  
  // Metadata
  isActive: boolean("is_active").default(true).notNull(),
  launchDate: timestamp("launch_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  stateCodeIdx: index("state_configs_state_code_idx").on(table.stateCode),
  tenantIdx: index("state_configs_tenant_idx").on(table.tenantId),
  activeIdx: index("state_configs_active_idx").on(table.isActive),
}));

// State Benefit Programs - Programs available in each state
export const stateBenefitPrograms = pgTable("state_benefit_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateConfigId: varchar("state_config_id").references(() => stateConfigurations.id, { onDelete: "cascade" }).notNull(),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id).notNull(),
  
  // State-specific program details
  stateProgramName: text("state_program_name"), // State's name for the program
  stateProgramCode: text("state_program_code"), // State's internal code
  stateProgramUrl: text("state_program_url"), // State-specific program website
  
  // Eligibility variations
  eligibilityOverrides: jsonb("eligibility_overrides"), // State-specific eligibility rules
  incomeLimitMultiplier: real("income_limit_multiplier").default(1.0), // Adjust federal poverty level
  assetLimitOverride: integer("asset_limit_override"), // State-specific asset limit
  
  // Application process
  applicationUrl: text("application_url"),
  applicationPhone: text("application_phone"),
  applicationMethods: text("application_methods").array(), // ["online", "phone", "in-person", "mail"]
  averageProcessingTime: integer("average_processing_time"), // in days
  
  // Required documents
  requiredDocuments: jsonb("required_documents"), // State-specific document requirements
  
  // Feature flags
  isActive: boolean("is_active").default(true).notNull(),
  allowsOnlineApplication: boolean("allows_online_application").default(true),
  requiresInterview: boolean("requires_interview").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  stateConfigProgramIdx: uniqueIndex("state_benefit_programs_unique_idx").on(table.stateConfigId, table.benefitProgramId),
  activeIdx: index("state_benefit_programs_active_idx").on(table.isActive),
}));

// State Forms - State-specific forms and documents
export const stateForms = pgTable("state_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateConfigId: varchar("state_config_id").references(() => stateConfigurations.id, { onDelete: "cascade" }).notNull(),
  
  // Form identification
  formNumber: text("form_number").notNull(), // "DHS-9780", "PA-600", etc.
  formName: text("form_name").notNull(),
  formType: text("form_type").notNull(), // "application", "renewal", "change_report", etc.
  
  // Program association
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id),
  
  // Language support
  language: text("language").notNull().default("en"),
  languageName: text("language_name").notNull().default("English"),
  
  // Version control
  version: text("version").notNull(),
  effectiveDate: timestamp("effective_date"),
  expirationDate: timestamp("expiration_date"),
  
  // Storage
  objectPath: text("object_path"), // Path in object storage
  sourceUrl: text("source_url"), // Original state URL
  
  // Metadata
  isFillable: boolean("is_fillable").default(false),
  isRequired: boolean("is_required").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  stateFormNumberIdx: index("state_forms_state_number_idx").on(table.stateConfigId, table.formNumber),
  formTypeIdx: index("state_forms_type_idx").on(table.formType),
  languageIdx: index("state_forms_language_idx").on(table.language),
}));

// State Policy Rules - Jurisdiction-specific rules and criteria
export const statePolicyRules = pgTable("state_policy_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateConfigId: varchar("state_config_id").references(() => stateConfigurations.id, { onDelete: "cascade" }).notNull(),
  
  // Rule identification
  ruleName: text("rule_name").notNull(),
  ruleCode: text("rule_code").notNull(),
  ruleCategory: text("rule_category").notNull(), // "eligibility", "benefit_calculation", "documentation", etc.
  
  // Program association
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id),
  
  // Rule definition
  ruleType: text("rule_type").notNull(), // "income_limit", "asset_test", "categorical", etc.
  ruleLogic: jsonb("rule_logic").notNull(), // Structured rule definition
  
  // Priority and conflicts
  priority: integer("priority").default(0), // Higher priority rules apply first
  overridesFederalRule: boolean("overrides_federal_rule").default(false),
  
  // Effective dates
  effectiveDate: timestamp("effective_date"),
  expirationDate: timestamp("expiration_date"),
  
  // Source and compliance
  sourceRegulation: text("source_regulation"), // Citation/reference
  sourceUrl: text("source_url"),
  lastVerifiedDate: timestamp("last_verified_date"),
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isTemporary: boolean("is_temporary").default(false), // Emergency/temporary rules
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  stateRuleCodeIdx: uniqueIndex("state_policy_rules_unique_idx").on(table.stateConfigId, table.ruleCode),
  categoryIdx: index("state_policy_rules_category_idx").on(table.ruleCategory),
  programIdx: index("state_policy_rules_program_idx").on(table.benefitProgramId),
}));

// ============================================================================
// CROSS-STATE RULES ARCHITECTURE
// ============================================================================

// Cross-State Rules - Track rule conflicts and resolutions across jurisdictions
export const crossStateRules = pgTable("cross_state_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Rule identification
  ruleName: text("rule_name").notNull(),
  ruleCode: text("rule_code").notNull().unique(),
  ruleDescription: text("rule_description").notNull(),
  
  // States involved
  primaryState: text("primary_state").notNull(), // Main state being evaluated
  secondaryState: text("secondary_state"), // Comparison or conflict state
  affectedStates: text("affected_states").array(), // All states impacted
  
  // Rule type and category
  ruleType: text("rule_type").notNull(), // conflict_resolution, reciprocity, portability, border_worker
  conflictType: text("conflict_type"), // income_threshold, asset_limit, work_requirement, eligibility_criteria
  
  // Resolution strategy
  resolutionStrategy: text("resolution_strategy").notNull(), // primary_residence, work_state, most_favorable, federal_override
  resolutionLogic: jsonb("resolution_logic").notNull(), // Detailed logic for resolution
  
  // Program association
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id),
  
  // Priority and precedence
  priority: integer("priority").default(0), // Higher priority rules apply first
  overridesStandardRules: boolean("overrides_standard_rules").default(false),
  
  // Effective dates
  effectiveDate: timestamp("effective_date"),
  expirationDate: timestamp("expiration_date"),
  
  // Compliance and source
  federalRegulation: text("federal_regulation"), // Federal law/reg that governs
  stateRegulations: jsonb("state_regulations"), // State-specific regulations
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isTemporary: boolean("is_temporary").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  ruleTypeIdx: index("cross_state_rules_type_idx").on(table.ruleType),
  primaryStateIdx: index("cross_state_rules_primary_state_idx").on(table.primaryState),
  programIdx: index("cross_state_rules_program_idx").on(table.benefitProgramId),
  activeIdx: index("cross_state_rules_active_idx").on(table.isActive),
}));

// Jurisdiction Hierarchies - Define precedence rules for overlapping jurisdictions
export const jurisdictionHierarchies = pgTable("jurisdiction_hierarchies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Jurisdiction levels
  jurisdictionType: text("jurisdiction_type").notNull(), // federal, state, county, city, special_district
  jurisdictionCode: text("jurisdiction_code").notNull(), // US, MD, NYC, DC-FED
  jurisdictionName: text("jurisdiction_name").notNull(),
  
  // Parent jurisdiction
  parentJurisdictionId: varchar("parent_jurisdiction_id"), // Self-reference to parent jurisdiction
  
  // Hierarchy level (0 = federal, 1 = state, 2 = county, etc.)
  hierarchyLevel: integer("hierarchy_level").notNull(),
  
  // Special flags
  isFederalTerritory: boolean("is_federal_territory").default(false), // DC, territories
  hasSpecialStatus: boolean("has_special_status").default(false), // NYC, DC federal employees
  specialStatusDetails: jsonb("special_status_details"),
  
  // Override rules
  canOverrideParent: boolean("can_override_parent").default(false),
  overrideCategories: text("override_categories").array(), // Which rules can be overridden
  
  // Geographic bounds (for mapping)
  geoBounds: jsonb("geo_bounds"), // GeoJSON or boundary data
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("jurisdiction_hierarchies_type_idx").on(table.jurisdictionType),
  codeIdx: uniqueIndex("jurisdiction_hierarchies_code_idx").on(table.jurisdictionCode),
  levelIdx: index("jurisdiction_hierarchies_level_idx").on(table.hierarchyLevel),
  parentIdx: index("jurisdiction_hierarchies_parent_idx").on(table.parentJurisdictionId),
}));

// State Reciprocity Agreements - Track inter-state benefit agreements
export const stateReciprocityAgreements = pgTable("state_reciprocity_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // States in agreement
  stateA: text("state_a").notNull(),
  stateB: text("state_b").notNull(),
  additionalStates: text("additional_states").array(), // For multi-state compacts
  
  // Agreement details
  agreementName: text("agreement_name").notNull(),
  agreementType: text("agreement_type").notNull(), // mutual_recognition, portability, work_credit, tax_reciprocity
  agreementScope: text("agreement_scope").array(), // Which benefits are covered
  
  // Program coverage
  coveredPrograms: text("covered_programs").array(), // SNAP, TANF, Medicaid, etc.
  excludedPrograms: text("excluded_programs").array(),
  
  // Specific terms
  terms: jsonb("terms").notNull(), // Detailed agreement terms
  specialConditions: jsonb("special_conditions"), // Any special conditions or exceptions
  
  // Portability rules
  benefitPortability: boolean("benefit_portability").default(false),
  waitingPeriodDays: integer("waiting_period_days"), // Days before benefits transfer
  documentationRequired: jsonb("documentation_required"),
  
  // Effective dates
  effectiveDate: timestamp("effective_date").notNull(),
  expirationDate: timestamp("expiration_date"),
  renewalDate: timestamp("renewal_date"),
  
  // Legal references
  legalAuthority: text("legal_authority"), // Law or regulation establishing agreement
  agreementDocumentUrl: text("agreement_document_url"),
  
  // Status
  status: text("status").notNull().default("active"), // active, pending, expired, terminated
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  statesIdx: uniqueIndex("reciprocity_states_idx").on(table.stateA, table.stateB),
  typeIdx: index("reciprocity_type_idx").on(table.agreementType),
  statusIdx: index("reciprocity_status_idx").on(table.status),
}));

// Multi-State Households - Track households with members in different states
export const multiStateHouseholds = pgTable("multi_state_households", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Household reference
  householdId: varchar("household_id").references(() => householdProfiles.id).notNull(),
  clientCaseId: varchar("client_case_id").references(() => clientCases.id),
  
  // Primary residence
  primaryResidenceState: text("primary_residence_state").notNull(),
  primaryResidenceCounty: text("primary_residence_county"),
  primaryResidenceZip: text("primary_residence_zip"),
  
  // Work location (if different)
  workState: text("work_state"),
  workCounty: text("work_county"),
  workZip: text("work_zip"),
  
  // Member locations
  memberStates: jsonb("member_states").notNull(), // {memberId: state} mapping
  outOfStateMembers: integer("out_of_state_members").default(0),
  
  // Scenarios
  scenario: text("scenario").notNull(), // border_worker, college_student, military, shared_custody, relocation
  scenarioDetails: jsonb("scenario_details"),
  
  // Federal employment
  hasFederalEmployee: boolean("has_federal_employee").default(false),
  federalEmployeeDetails: jsonb("federal_employee_details"),
  
  // Military status
  hasMilitaryMember: boolean("has_military_member").default(false),
  homeOfRecord: text("home_of_record"), // Military home of record state
  militaryDetails: jsonb("military_details"),
  
  // Resolution applied
  appliedResolutionStrategy: text("applied_resolution_strategy"),
  resolutionDate: timestamp("resolution_date"),
  resolutionNotes: text("resolution_notes"),
  
  // Benefit implications
  benefitImplications: jsonb("benefit_implications"), // How benefits are affected
  requiredDocumentation: jsonb("required_documentation"),
  
  // Status
  status: text("status").notNull().default("pending"), // pending, resolved, requires_review
  reviewRequired: boolean("review_required").default(false),
  lastReviewedBy: varchar("last_reviewed_by").references(() => users.id),
  lastReviewedAt: timestamp("last_reviewed_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  householdIdx: index("multi_state_households_household_idx").on(table.householdId),
  caseIdx: index("multi_state_households_case_idx").on(table.clientCaseId),
  scenarioIdx: index("multi_state_households_scenario_idx").on(table.scenario),
  statusIdx: index("multi_state_households_status_idx").on(table.status),
}));

// Cross-State Rule Applications - Track when cross-state rules are applied to cases
export const crossStateRuleApplications = pgTable("cross_state_rule_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Case reference
  clientCaseId: varchar("client_case_id").references(() => clientCases.id).notNull(),
  householdId: varchar("household_id").references(() => householdProfiles.id),
  multiStateHouseholdId: varchar("multi_state_household_id").references(() => multiStateHouseholds.id),
  
  // Rule applied
  crossStateRuleId: varchar("cross_state_rule_id").references(() => crossStateRules.id).notNull(),
  
  // States involved
  fromState: text("from_state").notNull(),
  toState: text("to_state"),
  affectedStates: text("affected_states").array(),
  
  // Application details
  applicationReason: text("application_reason").notNull(),
  conflictsDetected: jsonb("conflicts_detected"),
  resolutionApplied: jsonb("resolution_applied"),
  
  // Outcome
  outcome: text("outcome").notNull(), // approved, denied, partial, pending_review
  benefitAmount: integer("benefit_amount"),
  effectiveDate: timestamp("effective_date"),
  
  // Review and approval
  requiresReview: boolean("requires_review").default(false),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  // Audit trail
  appliedBy: varchar("applied_by").references(() => users.id),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  caseIdx: index("cross_state_applications_case_idx").on(table.clientCaseId),
  ruleIdx: index("cross_state_applications_rule_idx").on(table.crossStateRuleId),
  outcomeIdx: index("cross_state_applications_outcome_idx").on(table.outcome),
}));


// SMS Screening Links - Secure, time-limited screening URLs
export const smsScreeningLinks = pgTable("sms_screening_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(), // Unique nanoid token for URL
  phoneHash: text("phone_hash").notNull(), // SHA-256 hash of phone number
  tenantId: varchar("tenant_id").notNull(), // References tenants table
  conversationId: varchar("conversation_id").references(() => smsConversations.id),
  
  // Link properties
  shortUrl: text("short_url"), // Optional custom short URL
  fullUrl: text("full_url").notNull(), // Full screening URL with token
  
  // Usage tracking
  usageCount: integer("usage_count").default(0).notNull(),
  maxUsage: integer("max_usage").default(1).notNull(), // Default one-time use
  lastAccessedAt: timestamp("last_accessed_at"),
  lastAccessIp: text("last_access_ip"),
  
  // Validity
  expiresAt: timestamp("expires_at").notNull(),
  status: text("status").notNull().default("pending"), // pending, accessed, used, expired, revoked
  
  // Screening data
  screeningData: jsonb("screening_data"), // Saved progress data
  completedAt: timestamp("completed_at"),
  completionData: jsonb("completion_data"), // Final screening results
  
  // Rate limiting
  dailyLinkCount: integer("daily_link_count").default(1), // Links generated today for this phone
  lastGeneratedDate: date("last_generated_date"), // Date of last link generation
  
  // Security
  ipRestriction: text("ip_restriction"), // Optional IP whitelist
  captchaRequired: boolean("captcha_required").default(true).notNull(),
  captchaCompleted: boolean("captcha_completed").default(false),
  
  // Analytics
  source: text("source"), // Where link was requested from
  campaign: text("campaign"), // Marketing campaign identifier
  metadata: jsonb("metadata"), // Additional tracking data
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tokenIdx: uniqueIndex("sms_screening_links_token_idx").on(table.token),
  phoneHashIdx: index("sms_screening_links_phone_hash_idx").on(table.phoneHash),
  tenantIdIdx: index("sms_screening_links_tenant_id_idx").on(table.tenantId),
  statusIdx: index("sms_screening_links_status_idx").on(table.status),
  expiresAtIdx: index("sms_screening_links_expires_at_idx").on(table.expiresAt),
  createdAtIdx: index("sms_screening_links_created_at_idx").on(table.createdAt),
}));

// ============================================================================
// GDPR COMPLIANCE TABLES - Data Protection and Privacy Management
// ============================================================================

// GDPR Consents - Track user consent for data processing purposes
export const gdprConsents = pgTable("gdpr_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  purpose: text("purpose").notNull(), // marketing, analytics, service, research
  consentGiven: boolean("consent_given").notNull(),
  consentDate: timestamp("consent_date").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // Consent expiration date
  ipAddress: text("ip_address"), // IP address at time of consent
  userAgent: text("user_agent"), // Browser/device info for audit trail
  consentMethod: text("consent_method").notNull(), // web_form, api, verbal, written
  consentText: text("consent_text"), // Exact text user consented to
  withdrawnAt: timestamp("withdrawn_at"), // When consent was withdrawn
  withdrawalReason: text("withdrawal_reason"),
  notes: text("notes"),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("gdpr_consents_user_id_idx").on(table.userId),
  purposeIdx: index("gdpr_consents_purpose_idx").on(table.purpose),
  activeConsentIdx: index("gdpr_consents_active_idx").on(table.userId, table.purpose, table.consentGiven),
}));

// GDPR Data Subject Requests - Track GDPR right requests
export const gdprDataSubjectRequests = pgTable("gdpr_data_subject_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  requestType: text("request_type").notNull(), // access, erasure, portability, rectification, restriction, objection
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, denied, cancelled
  requestDate: timestamp("request_date").notNull().defaultNow(),
  completedDate: timestamp("completed_date"),
  dueDate: timestamp("due_date").notNull(), // 30-day deadline
  requestedBy: varchar("requested_by").references(() => users.id), // User who made the request (could be different from subject)
  handledBy: varchar("handled_by").references(() => users.id), // Staff member handling the request
  verificationToken: text("verification_token"), // Token for identity verification
  verificationCompleted: boolean("verification_completed").default(false),
  verificationDate: timestamp("verification_date"),
  requestDetails: jsonb("request_details"), // Specific details about the request
  responseData: jsonb("response_data"), // Generated export data or response
  denialReason: text("denial_reason"), // Reason if denied
  notes: text("notes"),
  remindersSent: integer("reminders_sent").default(0), // Track deadline reminders
  lastReminderAt: timestamp("last_reminder_at"),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("gdpr_dsr_user_id_idx").on(table.userId),
  statusIdx: index("gdpr_dsr_status_idx").on(table.status),
  dueDateIdx: index("gdpr_dsr_due_date_idx").on(table.dueDate),
  requestTypeIdx: index("gdpr_dsr_request_type_idx").on(table.requestType),
}));

// GDPR Data Processing Activities - Record of processing activities register
export const gdprDataProcessingActivities = pgTable("gdpr_data_processing_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  activityName: text("activity_name").notNull(),
  activityCode: text("activity_code").notNull().unique(), // Unique identifier
  purpose: text("purpose").notNull(), // Purpose of processing
  dataCategories: text("data_categories").array().notNull(), // Types of personal data processed
  dataSubjectCategories: text("data_subject_categories").array(), // Categories of individuals
  legalBasis: text("legal_basis").notNull(), // consent, contract, legal_obligation, vital_interests, public_task, legitimate_interests
  legalBasisDetails: text("legal_basis_details"),
  retentionPeriod: text("retention_period").notNull(), // How long data is kept
  retentionJustification: text("retention_justification"),
  recipients: text("recipients").array(), // Who receives the data
  recipientCategories: text("recipient_categories").array(), // Categories of recipients
  crossBorderTransfer: boolean("cross_border_transfer").default(false),
  transferCountries: text("transfer_countries").array(), // Countries data is transferred to
  transferSafeguards: text("transfer_safeguards"), // Safeguards for cross-border transfers
  dataMinimization: boolean("data_minimization").default(true),
  securityMeasures: jsonb("security_measures"), // Technical and organizational measures
  automatedDecisionMaking: boolean("automated_decision_making").default(false),
  profilingUsed: boolean("profiling_used").default(false),
  dpiaRequired: boolean("dpia_required").default(false), // Data Protection Impact Assessment required
  dpiaId: varchar("dpia_id"), // References privacy impact assessment
  responsiblePerson: varchar("responsible_person").references(() => users.id),
  dataProtectionOfficer: varchar("data_protection_officer").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  lastReviewDate: timestamp("last_review_date"),
  nextReviewDate: timestamp("next_review_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  activityCodeIdx: uniqueIndex("gdpr_dpa_activity_code_idx").on(table.activityCode),
  legalBasisIdx: index("gdpr_dpa_legal_basis_idx").on(table.legalBasis),
  activeIdx: index("gdpr_dpa_active_idx").on(table.isActive),
  reviewDateIdx: index("gdpr_dpa_review_date_idx").on(table.nextReviewDate),
}));

// GDPR Privacy Impact Assessments - Track PIAs for high-risk processing
export const gdprPrivacyImpactAssessments = pgTable("gdpr_privacy_impact_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentName: text("assessment_name").notNull(),
  assessmentCode: text("assessment_code").notNull().unique(),
  processingActivity: text("processing_activity").notNull(),
  processingActivityId: varchar("processing_activity_id"), // References data processing activity
  description: text("description").notNull(),
  necessity: text("necessity").notNull(), // Why the processing is necessary
  proportionality: text("proportionality").notNull(), // Is it proportionate to the purpose
  riskLevel: text("risk_level").notNull(), // low, medium, high, critical
  riskDescription: text("risk_description").notNull(),
  risksIdentified: jsonb("risks_identified").notNull(), // Array of identified risks
  impactOnRights: text("impact_on_rights").notNull(), // Impact on data subject rights
  mitigations: jsonb("mitigations").notNull(), // Mitigation measures
  residualRisk: text("residual_risk"), // Risk after mitigations
  consultationRequired: boolean("consultation_required").default(false),
  consultationDetails: text("consultation_details"),
  assessmentDate: timestamp("assessment_date").notNull(),
  reviewDate: timestamp("review_date"), // When to review again
  nextReviewDue: timestamp("next_review_due"),
  assessorId: varchar("assessor_id").references(() => users.id).notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvalDate: timestamp("approval_date"),
  status: text("status").notNull().default("draft"), // draft, in_review, approved, rejected, archived
  dpoReviewed: boolean("dpo_reviewed").default(false),
  dpoComments: text("dpo_comments"),
  implementationStatus: text("implementation_status"), // not_started, in_progress, completed
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  assessmentCodeIdx: uniqueIndex("gdpr_pia_assessment_code_idx").on(table.assessmentCode),
  riskLevelIdx: index("gdpr_pia_risk_level_idx").on(table.riskLevel),
  statusIdx: index("gdpr_pia_status_idx").on(table.status),
  reviewDateIdx: index("gdpr_pia_review_date_idx").on(table.nextReviewDue),
}));

// GDPR Breach Incidents - Data breach tracking and notification
export const gdprBreachIncidents = pgTable("gdpr_breach_incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentNumber: text("incident_number").notNull().unique(), // Unique incident ID
  incidentDate: timestamp("incident_date").notNull(), // When breach occurred
  discoveryDate: timestamp("discovery_date").notNull(), // When breach was discovered
  reportedDate: timestamp("reported_date"), // When it was reported internally
  description: text("description").notNull(),
  natureOfBreach: text("nature_of_breach").notNull(), // unauthorized_access, loss, alteration, disclosure, etc.
  causeOfBreach: text("cause_of_breach"), // human_error, malicious_attack, system_failure, etc.
  affectedUsers: integer("affected_users").default(0), // Number of affected users
  affectedUserIds: text("affected_user_ids").array(), // IDs of affected users
  dataTypes: text("data_types").array().notNull(), // Types of data compromised
  dataVolume: text("data_volume"), // Volume of data affected
  severity: text("severity").notNull(), // low, medium, high, critical
  riskAssessment: text("risk_assessment").notNull(), // Assessment of risk to individuals
  likelyConsequences: text("likely_consequences"), // Likely impact on individuals
  containmentActions: jsonb("containment_actions").notNull(), // Actions taken to contain breach
  containmentDate: timestamp("containment_date"), // When breach was contained
  mitigationMeasures: jsonb("mitigation_measures"), // Measures to mitigate effects
  notificationsSent: boolean("notifications_sent").default(false),
  userNotificationDate: timestamp("user_notification_date"), // When users were notified
  userNotificationMethod: text("user_notification_method"), // email, letter, phone, etc.
  reportedToAuthority: boolean("reported_to_authority").default(false),
  reportedToAuthorityDate: timestamp("reported_to_authority_date"), // When DPA was notified
  authorityName: text("authority_name"), // Which authority was notified
  authorityReferenceNumber: text("authority_reference_number"),
  reportWithin72Hours: boolean("report_within_72_hours"), // Met 72-hour requirement
  delayJustification: text("delay_justification"), // If reported after 72 hours
  externalPartiesNotified: boolean("external_parties_notified").default(false),
  externalPartiesDetails: jsonb("external_parties_details"), // Law enforcement, etc.
  mediaInvolvement: boolean("media_involvement").default(false),
  status: text("status").notNull().default("open"), // open, contained, resolved, closed
  incidentOwner: varchar("incident_owner").references(() => users.id).notNull(),
  investigatedBy: varchar("investigated_by").references(() => users.id),
  closedBy: varchar("closed_by").references(() => users.id),
  closedDate: timestamp("closed_date"),
  lessonsLearned: text("lessons_learned"),
  preventiveMeasures: jsonb("preventive_measures"), // Measures to prevent recurrence
  documents: jsonb("documents"), // Links to related documents
  notes: text("notes"),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  incidentNumberIdx: uniqueIndex("gdpr_breach_incident_number_idx").on(table.incidentNumber),
  severityIdx: index("gdpr_breach_severity_idx").on(table.severity),
  statusIdx: index("gdpr_breach_status_idx").on(table.status),
  discoveryDateIdx: index("gdpr_breach_discovery_date_idx").on(table.discoveryDate),
  reportedToAuthorityIdx: index("gdpr_breach_reported_authority_idx").on(table.reportedToAuthority),
}));

// Insert schemas for State Configuration
export const insertStateConfigurationSchema = createInsertSchema(stateConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStateBenefitProgramSchema = createInsertSchema(stateBenefitPrograms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStateFormSchema = createInsertSchema(stateForms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStatePolicyRuleSchema = createInsertSchema(statePolicyRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schemas for Cross-State Rules
export const insertCrossStateRuleSchema = createInsertSchema(crossStateRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJurisdictionHierarchySchema = createInsertSchema(jurisdictionHierarchies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStateReciprocityAgreementSchema = createInsertSchema(stateReciprocityAgreements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMultiStateHouseholdSchema = createInsertSchema(multiStateHouseholds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrossStateRuleApplicationSchema = createInsertSchema(crossStateRuleApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schemas for GDPR Compliance
export const insertGdprConsentSchema = createInsertSchema(gdprConsents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGdprDataSubjectRequestSchema = createInsertSchema(gdprDataSubjectRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGdprDataProcessingActivitySchema = createInsertSchema(gdprDataProcessingActivities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGdprPrivacyImpactAssessmentSchema = createInsertSchema(gdprPrivacyImpactAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGdprBreachIncidentSchema = createInsertSchema(gdprBreachIncidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for State Configuration
export type StateConfiguration = typeof stateConfigurations.$inferSelect;
export type InsertStateConfiguration = z.infer<typeof insertStateConfigurationSchema>;
export type StateBenefitProgram = typeof stateBenefitPrograms.$inferSelect;
export type InsertStateBenefitProgram = z.infer<typeof insertStateBenefitProgramSchema>;
export type StateForm = typeof stateForms.$inferSelect;
export type InsertStateForm = z.infer<typeof insertStateFormSchema>;
export type StatePolicyRule = typeof statePolicyRules.$inferSelect;
export type InsertStatePolicyRule = z.infer<typeof insertStatePolicyRuleSchema>;

// Types for Cross-State Rules
export type CrossStateRule = typeof crossStateRules.$inferSelect;
export type InsertCrossStateRule = z.infer<typeof insertCrossStateRuleSchema>;
export type JurisdictionHierarchy = typeof jurisdictionHierarchies.$inferSelect;
export type InsertJurisdictionHierarchy = z.infer<typeof insertJurisdictionHierarchySchema>;
export type StateReciprocityAgreement = typeof stateReciprocityAgreements.$inferSelect;
export type InsertStateReciprocityAgreement = z.infer<typeof insertStateReciprocityAgreementSchema>;
export type MultiStateHousehold = typeof multiStateHouseholds.$inferSelect;
export type InsertMultiStateHousehold = z.infer<typeof insertMultiStateHouseholdSchema>;
export type CrossStateRuleApplication = typeof crossStateRuleApplications.$inferSelect;
export type InsertCrossStateRuleApplication = z.infer<typeof insertCrossStateRuleApplicationSchema>;

// Types for GDPR Compliance
export type GdprConsent = typeof gdprConsents.$inferSelect;
export type InsertGdprConsent = z.infer<typeof insertGdprConsentSchema>;
export type GdprDataSubjectRequest = typeof gdprDataSubjectRequests.$inferSelect;
export type InsertGdprDataSubjectRequest = z.infer<typeof insertGdprDataSubjectRequestSchema>;
export type GdprDataProcessingActivity = typeof gdprDataProcessingActivities.$inferSelect;
export type InsertGdprDataProcessingActivity = z.infer<typeof insertGdprDataProcessingActivitySchema>;
export type GdprPrivacyImpactAssessment = typeof gdprPrivacyImpactAssessments.$inferSelect;
export type InsertGdprPrivacyImpactAssessment = z.infer<typeof insertGdprPrivacyImpactAssessmentSchema>;
export type GdprBreachIncident = typeof gdprBreachIncidents.$inferSelect;
export type InsertGdprBreachIncident = z.infer<typeof insertGdprBreachIncidentSchema>;

// ============================================================================
// HIPAA COMPLIANCE - Healthcare Data Protection & PHI Security
// ============================================================================

// HIPAA PHI Access Logs - Track all Protected Health Information access
export const hipaaPhiAccessLogs = pgTable("hipaa_phi_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  patientId: varchar("patient_id").references(() => users.id), // Patient whose PHI was accessed
  accessType: text("access_type").notNull(), // view, create, update, delete, export, print
  resourceType: text("resource_type").notNull(), // patient_record, document, household_profile, tax_return, etc.
  resourceId: varchar("resource_id").notNull(), // ID of the accessed resource
  dataElements: text("data_elements").array(), // Specific PHI fields accessed
  purpose: text("purpose").notNull(), // treatment, payment, operations, research, etc.
  minimumNecessary: boolean("minimum_necessary").default(true).notNull(), // Met minimum necessary standard
  justification: text("justification"), // Why access was needed
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  location: text("location"), // Geographic location
  sessionId: varchar("session_id"),
  requestMethod: text("request_method"), // GET, POST, PUT, DELETE
  requestUrl: text("request_url"),
  responseStatus: integer("response_status"),
  accessDuration: integer("access_duration"), // Duration in milliseconds
  emergencyAccess: boolean("emergency_access").default(false), // Break-glass access
  delegatedAccess: boolean("delegated_access").default(false), // Access on behalf of another user
  delegatedBy: varchar("delegated_by").references(() => users.id),
  auditReviewed: boolean("audit_reviewed").default(false),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  flaggedForReview: boolean("flagged_for_review").default(false),
  flagReason: text("flag_reason"),
  accessedAt: timestamp("accessed_at").defaultNow().notNull(),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("hipaa_phi_access_user_id_idx").on(table.userId),
  patientIdIdx: index("hipaa_phi_access_patient_id_idx").on(table.patientId),
  resourceIdx: index("hipaa_phi_access_resource_idx").on(table.resourceType, table.resourceId),
  accessTypeIdx: index("hipaa_phi_access_type_idx").on(table.accessType),
  accessedAtIdx: index("hipaa_phi_access_accessed_at_idx").on(table.accessedAt),
  flaggedIdx: index("hipaa_phi_access_flagged_idx").on(table.flaggedForReview),
}));

// HIPAA Business Associate Agreements - Track BAAs and covered entities
export const hipaaBusinessAssociateAgreements = pgTable("hipaa_business_associate_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agreementNumber: text("agreement_number").notNull().unique(),
  businessAssociateName: text("business_associate_name").notNull(),
  businessAssociateType: text("business_associate_type").notNull(), // vendor, subcontractor, cloud_provider, etc.
  contactPerson: text("contact_person").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  servicesProvided: text("services_provided").array().notNull(),
  phiCategories: text("phi_categories").array().notNull(), // Types of PHI they can access
  permittedUses: text("permitted_uses").array().notNull(), // What they're allowed to do with PHI
  permittedDisclosures: text("permitted_disclosures").array(),
  subcontractorsAllowed: boolean("subcontractors_allowed").default(false),
  subcontractorsList: jsonb("subcontractors_list"), // List of approved subcontractors
  signedDate: timestamp("signed_date").notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  expirationDate: timestamp("expiration_date"),
  autoRenewal: boolean("auto_renewal").default(false),
  renewalTerms: text("renewal_terms"),
  terminationDate: timestamp("termination_date"),
  terminationReason: text("termination_reason"),
  status: text("status").notNull().default("active"), // active, expired, terminated, under_review
  securityRequirements: jsonb("security_requirements").notNull(), // Required security controls
  breachNotificationRequired: boolean("breach_notification_required").default(true).notNull(),
  breachNotificationTimeframe: text("breach_notification_timeframe").default("60 days"),
  auditRights: boolean("audit_rights").default(true).notNull(),
  lastAuditDate: timestamp("last_audit_date"),
  nextAuditDue: timestamp("next_audit_due"),
  auditFindings: text("audit_findings"),
  complianceStatus: text("compliance_status").default("compliant"), // compliant, non_compliant, under_review
  attestationProvided: boolean("attestation_provided").default(false),
  attestationDate: timestamp("attestation_date"),
  insuranceRequired: boolean("insurance_required").default(false),
  insuranceCoverage: text("insurance_coverage"),
  insuranceExpirationDate: timestamp("insurance_expiration_date"),
  documentUrl: text("document_url"), // Link to signed BAA document
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  updatedBy: varchar("updated_by").references(() => users.id),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agreementNumberIdx: uniqueIndex("hipaa_baa_agreement_number_idx").on(table.agreementNumber),
  statusIdx: index("hipaa_baa_status_idx").on(table.status),
  expirationDateIdx: index("hipaa_baa_expiration_date_idx").on(table.expirationDate),
  nextAuditIdx: index("hipaa_baa_next_audit_idx").on(table.nextAuditDue),
}));

// HIPAA Risk Assessments - Security Risk Analysis (SRA) tracking
export const hipaaRiskAssessments = pgTable("hipaa_risk_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentNumber: text("assessment_number").notNull().unique(),
  assessmentType: text("assessment_type").notNull(), // annual, incident_driven, change_driven, vendor_assessment
  scope: text("scope").notNull(), // Full scope description
  assessmentDate: timestamp("assessment_date").notNull(),
  assessor: varchar("assessor").references(() => users.id).notNull(),
  assessorQualifications: text("assessor_qualifications"),
  methodology: text("methodology").notNull(), // NIST, OCTAVE, custom, etc.
  physicalSafeguards: jsonb("physical_safeguards").notNull(), // Assessment of physical controls
  technicalSafeguards: jsonb("technical_safeguards").notNull(), // Assessment of technical controls
  administrativeSafeguards: jsonb("administrative_safeguards").notNull(), // Assessment of admin controls
  threatsIdentified: jsonb("threats_identified").notNull(), // List of threats
  vulnerabilitiesIdentified: jsonb("vulnerabilities_identified").notNull(), // List of vulnerabilities
  riskLevel: text("risk_level").notNull(), // low, medium, high, critical
  impactAnalysis: jsonb("impact_analysis").notNull(), // Analysis of potential impact
  likelihoodAnalysis: jsonb("likelihood_analysis").notNull(), // Analysis of likelihood
  currentControls: jsonb("current_controls").notNull(), // Existing security controls
  controlEffectiveness: text("control_effectiveness").notNull(), // effective, partially_effective, ineffective
  gaps: jsonb("gaps").notNull(), // Identified gaps in security
  recommendations: jsonb("recommendations").notNull(), // Recommended actions
  remediationPlan: jsonb("remediation_plan"), // Plan to address risks
  remediationDeadline: timestamp("remediation_deadline"),
  remediationStatus: text("remediation_status").default("pending"), // pending, in_progress, completed, deferred
  residualRisk: text("residual_risk"), // Risk level after remediation
  acceptedRisks: jsonb("accepted_risks"), // Risks accepted by management
  riskAcceptanceJustification: text("risk_acceptance_justification"),
  acceptedBy: varchar("accepted_by").references(() => users.id),
  acceptedDate: timestamp("accepted_date"),
  reviewDate: timestamp("review_date"),
  nextReviewDue: timestamp("next_review_due").notNull(),
  status: text("status").notNull().default("draft"), // draft, in_review, approved, implemented
  approvedBy: varchar("approved_by").references(() => users.id),
  approvalDate: timestamp("approval_date"),
  documentUrl: text("document_url"),
  notes: text("notes"),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  assessmentNumberIdx: uniqueIndex("hipaa_ra_assessment_number_idx").on(table.assessmentNumber),
  assessmentTypeIdx: index("hipaa_ra_assessment_type_idx").on(table.assessmentType),
  riskLevelIdx: index("hipaa_ra_risk_level_idx").on(table.riskLevel),
  statusIdx: index("hipaa_ra_status_idx").on(table.status),
  nextReviewIdx: index("hipaa_ra_next_review_idx").on(table.nextReviewDue),
}));

// HIPAA Security Incidents - Track security incidents and breaches
export const hipaaSecurityIncidents = pgTable("hipaa_security_incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentNumber: text("incident_number").notNull().unique(),
  incidentType: text("incident_type").notNull(), // breach, unauthorized_access, lost_device, ransomware, phishing, etc.
  incidentDate: timestamp("incident_date").notNull(),
  discoveryDate: timestamp("discovery_date").notNull(),
  reportedDate: timestamp("reported_date"),
  reportedBy: varchar("reported_by").references(() => users.id).notNull(),
  description: text("description").notNull(),
  affectedSystems: text("affected_systems").array(),
  phiInvolved: boolean("phi_involved").default(false).notNull(),
  phiTypes: text("phi_types").array(), // Types of PHI affected
  numberOfRecords: integer("number_of_records").default(0),
  affectedPatients: integer("affected_patients").default(0),
  affectedPatientIds: text("affected_patient_ids").array(),
  breachThresholdMet: boolean("breach_threshold_met").default(false), // > 500 individuals
  hhs_notification_required: boolean("hhs_notification_required").default(false),
  media_notification_required: boolean("media_notification_required").default(false),
  severity: text("severity").notNull(), // low, medium, high, critical
  riskAnalysis: text("risk_analysis").notNull(), // Risk to affected individuals
  probabilityOfCompromise: text("probability_of_compromise"), // low, medium, high
  containmentActions: jsonb("containment_actions").notNull(),
  containmentDate: timestamp("containment_date"),
  investigationFindings: text("investigation_findings"),
  investigatedBy: varchar("investigated_by").references(() => users.id),
  investigationCompletedDate: timestamp("investigation_completed_date"),
  rootCause: text("root_cause"),
  contributingFactors: text("contributing_factors").array(),
  correctiveActions: jsonb("corrective_actions").notNull(),
  preventiveMeasures: jsonb("preventive_measures"),
  individualsNotified: boolean("individuals_notified").default(false),
  individualNotificationDate: timestamp("individual_notification_date"),
  individualNotificationMethod: text("individual_notification_method"), // mail, email, phone, substitute_notice
  hhsNotified: boolean("hhs_notified").default(false),
  hhsNotificationDate: timestamp("hhs_notification_date"),
  hhsNotificationMethod: text("hhs_notification_method"), // web_portal, written
  mediaNotified: boolean("media_notified").default(false),
  mediaNotificationDate: timestamp("media_notification_date"),
  lawEnforcementNotified: boolean("law_enforcement_notified").default(false),
  lawEnforcementDetails: jsonb("law_enforcement_details"),
  insuranceClaimFiled: boolean("insurance_claim_filed").default(false),
  insuranceClaimNumber: text("insurance_claim_number"),
  status: text("status").notNull().default("open"), // open, investigating, contained, resolved, closed
  incidentOwner: varchar("incident_owner").references(() => users.id).notNull(),
  closedDate: timestamp("closed_date"),
  closedBy: varchar("closed_by").references(() => users.id),
  lessonsLearned: text("lessons_learned"),
  policyUpdatesNeeded: boolean("policy_updates_needed").default(false),
  trainingNeeded: boolean("training_needed").default(false),
  documentUrl: text("document_url"),
  notes: text("notes"),
  // Data retention tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation)
  retentionCategory: text("retention_category"), // tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent
  retentionUntil: timestamp("retention_until"), // Calculated expiration date
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(), // Soft delete flag
  deletionApprovedBy: varchar("deletion_approved_by"), // Admin who approved deletion
  deletionApprovedAt: timestamp("deletion_approved_at"), // When deletion was approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  incidentNumberIdx: uniqueIndex("hipaa_incident_number_idx").on(table.incidentNumber),
  incidentTypeIdx: index("hipaa_incident_type_idx").on(table.incidentType),
  severityIdx: index("hipaa_incident_severity_idx").on(table.severity),
  statusIdx: index("hipaa_incident_status_idx").on(table.status),
  discoveryDateIdx: index("hipaa_incident_discovery_date_idx").on(table.discoveryDate),
  breachIdx: index("hipaa_incident_breach_idx").on(table.breachThresholdMet),
}));

// HIPAA Audit Logs - Comprehensive audit trail for all system activities
export const hipaaAuditLogs = pgTable("hipaa_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: varchar("user_id").references(() => users.id),
  userName: text("user_name"),
  userRole: text("user_role"),
  action: text("action").notNull(), // login, logout, create, read, update, delete, export, etc.
  actionCategory: text("action_category").notNull(), // authentication, data_access, configuration, system, etc.
  resourceType: text("resource_type"), // user, patient, document, household_profile, etc.
  resourceId: varchar("resource_id"),
  resourceName: text("resource_name"),
  changesMade: jsonb("changes_made"), // Before/after values
  outcome: text("outcome").notNull(), // success, failure, partial
  failureReason: text("failure_reason"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  requestMethod: text("request_method"),
  requestUrl: text("request_url"),
  responseStatus: integer("response_status"),
  responseTime: integer("response_time"), // milliseconds
  phiAccessed: boolean("phi_accessed").default(false),
  securityRelevant: boolean("security_relevant").default(false), // Flag for security-relevant events
  complianceRelevant: boolean("compliance_relevant").default(false), // Flag for compliance audits
  retentionPeriod: integer("retention_period").default(2555).notNull(), // Days to retain (default 7 years)
  archived: boolean("archived").default(false),
  archivedDate: timestamp("archived_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  timestampIdx: index("hipaa_audit_timestamp_idx").on(table.timestamp),
  userIdIdx: index("hipaa_audit_user_id_idx").on(table.userId),
  actionIdx: index("hipaa_audit_action_idx").on(table.action),
  actionCategoryIdx: index("hipaa_audit_action_category_idx").on(table.actionCategory),
  resourceIdx: index("hipaa_audit_resource_idx").on(table.resourceType, table.resourceId),
  phiAccessedIdx: index("hipaa_audit_phi_accessed_idx").on(table.phiAccessed),
  securityRelevantIdx: index("hipaa_audit_security_relevant_idx").on(table.securityRelevant),
}));

// Insert schemas for HIPAA Compliance
export const insertHipaaPhiAccessLogSchema = createInsertSchema(hipaaPhiAccessLogs).omit({
  id: true,
  accessedAt: true,
  createdAt: true,
});

export const insertHipaaBusinessAssociateAgreementSchema = createInsertSchema(hipaaBusinessAssociateAgreements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHipaaRiskAssessmentSchema = createInsertSchema(hipaaRiskAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHipaaSecurityIncidentSchema = createInsertSchema(hipaaSecurityIncidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHipaaAuditLogSchema = createInsertSchema(hipaaAuditLogs).omit({
  id: true,
  timestamp: true,
  createdAt: true,
});

// Types for HIPAA Compliance
export type HipaaPhiAccessLog = typeof hipaaPhiAccessLogs.$inferSelect;
export type InsertHipaaPhiAccessLog = z.infer<typeof insertHipaaPhiAccessLogSchema>;
export type HipaaBusinessAssociateAgreement = typeof hipaaBusinessAssociateAgreements.$inferSelect;
export type InsertHipaaBusinessAssociateAgreement = z.infer<typeof insertHipaaBusinessAssociateAgreementSchema>;
export type HipaaRiskAssessment = typeof hipaaRiskAssessments.$inferSelect;
export type InsertHipaaRiskAssessment = z.infer<typeof insertHipaaRiskAssessmentSchema>;
export type HipaaSecurityIncident = typeof hipaaSecurityIncidents.$inferSelect;
export type InsertHipaaSecurityIncident = z.infer<typeof insertHipaaSecurityIncidentSchema>;
export type HipaaAuditLog = typeof hipaaAuditLogs.$inferSelect;
export type InsertHipaaAuditLog = z.infer<typeof insertHipaaAuditLogSchema>;

// Insert schemas for Cross-Enrollment and Predictive Analytics
export const insertCrossEnrollmentRecommendationSchema = createInsertSchema(crossEnrollmentRecommendations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPredictionHistorySchema = createInsertSchema(predictionHistory).omit({
  id: true,
  createdAt: true,
});

export const insertMlModelSchema = createInsertSchema(mlModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiTrainingExampleSchema = createInsertSchema(aiTrainingExamples).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnalyticsAggregationSchema = createInsertSchema(analyticsAggregations).omit({
  id: true,
  calculatedAt: true,
  createdAt: true,
});

// Types for Cross-Enrollment and Predictive Analytics
export type CrossEnrollmentRecommendation = typeof crossEnrollmentRecommendations.$inferSelect;
export type InsertCrossEnrollmentRecommendation = z.infer<typeof insertCrossEnrollmentRecommendationSchema>;
export type PredictionHistory = typeof predictionHistory.$inferSelect;
export type InsertPredictionHistory = z.infer<typeof insertPredictionHistorySchema>;
export type MlModel = typeof mlModels.$inferSelect;
export type InsertMlModel = z.infer<typeof insertMlModelSchema>;
export type AiTrainingExample = typeof aiTrainingExamples.$inferSelect;
export type InsertAiTrainingExample = z.infer<typeof insertAiTrainingExampleSchema>;
export type AnalyticsAggregation = typeof analyticsAggregations.$inferSelect;
export type InsertAnalyticsAggregation = z.infer<typeof insertAnalyticsAggregationSchema>;

// ============================================================================
// BENEFITS ACCESS REVIEW MODULE - Autonomous case monitoring system
// ============================================================================

// Benefits Access Reviews - Main table for tracking case lifecycle
export const benefitsAccessReviews = pgTable("benefits_access_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => clientCases.id, { onDelete: "cascade" }).notNull(),
  caseworkerId: varchar("caseworker_id").references(() => users.id).notNull(),
  supervisorId: varchar("supervisor_id").references(() => users.id), // Assigned supervisor
  
  // Review period tracking (30-60 days)
  reviewPeriodStart: timestamp("review_period_start").notNull(),
  reviewPeriodEnd: timestamp("review_period_end").notNull(),
  reviewDuration: integer("review_duration").notNull(), // days (30-60)
  
  // Sampling metadata
  samplingMethod: text("sampling_method").notNull(), // stratified, random, targeted
  samplingCriteria: jsonb("sampling_criteria"), // demographic, program, county stratification
  selectedForReview: boolean("selected_for_review").default(false).notNull(),
  selectionWeight: real("selection_weight"), // probability weight used in sampling
  
  // Review status
  reviewStatus: text("review_status").notNull().default("pending"), // pending, in_progress, completed, escalated
  reviewPriority: text("review_priority").default("normal"), // low, normal, high, urgent
  
  // Anonymization for blind review
  anonymizedCaseId: text("anonymized_case_id"), // hashed ID for blind review
  anonymizedWorkerId: text("anonymized_worker_id"), // hashed worker ID for blind review
  blindReviewMode: boolean("blind_review_mode").default(true).notNull(),
  
  // AI assessment
  aiAssessmentScore: real("ai_assessment_score"), // 0-1 quality score from Gemini
  aiAssessmentSummary: text("ai_assessment_summary"), // AI-generated summary
  aiAssessmentDetails: jsonb("ai_assessment_details"), // detailed AI analysis
  aiAssessmentDate: timestamp("ai_assessment_date"),
  
  // Supervisor feedback
  supervisorFeedbackId: varchar("supervisor_feedback_id"), // References reviewer feedback - self-reference
  supervisorReviewDate: timestamp("supervisor_review_date"),
  supervisorScore: real("supervisor_score"), // 0-100 score
  
  // Lifecycle checkpoints
  checkpointsCompleted: integer("checkpoints_completed").default(0),
  totalCheckpoints: integer("total_checkpoints").default(0),
  checkpointStatus: jsonb("checkpoint_status"), // status of each checkpoint
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  caseIdIdx: index("bar_case_id_idx").on(table.caseId),
  caseworkerIdIdx: index("bar_caseworker_id_idx").on(table.caseworkerId),
  supervisorIdIdx: index("bar_supervisor_id_idx").on(table.supervisorId),
  reviewStatusIdx: index("bar_review_status_idx").on(table.reviewStatus),
  selectedForReviewIdx: index("bar_selected_for_review_idx").on(table.selectedForReview),
  reviewPeriodIdx: index("bar_review_period_idx").on(table.reviewPeriodStart, table.reviewPeriodEnd),
}));

// Review Samples - Statistical sampling records
export const reviewSamples = pgTable("review_samples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  samplingPeriod: text("sampling_period").notNull(), // e.g., "2025-W42" for week 42 of 2025
  samplingDate: timestamp("sampling_date").defaultNow().notNull(),
  
  // Sampling parameters
  totalCases: integer("total_cases").notNull(), // total cases in the pool
  selectedCases: integer("selected_cases").notNull(), // number of cases selected
  samplingRate: real("sampling_rate").notNull(), // selected / total
  
  // Stratification metadata
  stratificationDimensions: jsonb("stratification_dimensions"), // dimensions used (program, county, etc.)
  stratificationDistribution: jsonb("stratification_distribution"), // actual distribution of selected cases
  
  // Sample quality metrics
  diversityScore: real("diversity_score"), // 0-1 measure of sample diversity
  representativenessScore: real("representativeness_score"), // 0-1 measure of population representation
  
  // Worker allocation (2 cases per worker target)
  workersIncluded: integer("workers_included").notNull(),
  casesPerWorker: jsonb("cases_per_worker"), // distribution of cases per worker
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  samplingPeriodIdx: index("rs_sampling_period_idx").on(table.samplingPeriod),
  samplingDateIdx: index("rs_sampling_date_idx").on(table.samplingDate),
}));

// Reviewer Feedback - Structured feedback from supervisors
export const reviewerFeedback = pgTable("reviewer_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").references(() => benefitsAccessReviews.id, { onDelete: "cascade" }).notNull(),
  reviewerId: varchar("reviewer_id").references(() => users.id).notNull(),
  
  // Feedback dimensions
  accuracyScore: real("accuracy_score"), // 0-100 accuracy of determination
  timelinessScore: real("timeliness_score"), // 0-100 processing timeliness
  documentationScore: real("documentation_score"), // 0-100 documentation quality
  customerServiceScore: real("customer_service_score"), // 0-100 customer interaction quality
  overallScore: real("overall_score"), // 0-100 overall performance
  
  // Structured feedback
  strengths: text("strengths").array(), // array of strength categories
  areasForImprovement: text("areas_for_improvement").array(), // array of improvement areas
  criticalIssues: text("critical_issues").array(), // array of critical issues found
  
  // Detailed feedback
  feedbackNotes: text("feedback_notes"), // detailed written feedback
  recommendations: text("recommendations"), // specific recommendations for improvement
  
  // Follow-up actions
  requiresFollowUp: boolean("requires_follow_up").default(false),
  followUpActions: jsonb("follow_up_actions"), // specific actions to take
  escalationRequired: boolean("escalation_required").default(false),
  escalationReason: text("escalation_reason"),
  
  // Metadata
  reviewDate: timestamp("review_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  reviewIdIdx: index("rf_review_id_idx").on(table.reviewId),
  reviewerIdIdx: index("rf_reviewer_id_idx").on(table.reviewerId),
  reviewDateIdx: index("rf_review_date_idx").on(table.reviewDate),
  escalationIdx: index("rf_escalation_idx").on(table.escalationRequired),
}));

// Case Lifecycle Events - Checkpoint tracking (30-60 day lifecycle)
export const caseLifecycleEvents = pgTable("case_lifecycle_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").references(() => benefitsAccessReviews.id, { onDelete: "cascade" }).notNull(),
  caseId: varchar("case_id").references(() => clientCases.id, { onDelete: "cascade" }).notNull(),
  
  // Checkpoint tracking
  checkpointType: text("checkpoint_type").notNull(), // intake, verification, determination, notification, followup
  checkpointName: text("checkpoint_name").notNull(), // descriptive name
  checkpointDescription: text("checkpoint_description"),
  
  // Timing
  expectedDate: timestamp("expected_date"), // when checkpoint should occur
  actualDate: timestamp("actual_date"), // when checkpoint actually occurred
  daysFromStart: integer("days_from_start"), // days since case started
  isOnTime: boolean("is_on_time"), // true if met within expected timeframe
  delayDays: integer("delay_days"), // days delayed (if applicable)
  
  // Status
  status: text("status").notNull().default("pending"), // pending, completed, overdue, skipped
  completedBy: varchar("completed_by").references(() => users.id),
  
  // Details
  eventDetails: jsonb("event_details"), // checkpoint-specific details
  notes: text("notes"), // additional notes
  
  // AI monitoring
  aiAlerted: boolean("ai_alerted").default(false), // true if AI flagged this event
  aiAlertReason: text("ai_alert_reason"), // why AI flagged this
  
  // Notification tracking (BAR)
  notificationSentAt: timestamp("notification_sent_at"), // when last notification was sent
  reminderSentDays: integer("reminder_sent_days").array(), // which day-before reminders were sent (e.g., [3, 1])
  overdueAlertSentAt: timestamp("overdue_alert_sent_at"), // when overdue alert was sent
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  reviewIdIdx: index("cle_review_id_idx").on(table.reviewId),
  caseIdIdx: index("cle_case_id_idx").on(table.caseId),
  checkpointTypeIdx: index("cle_checkpoint_type_idx").on(table.checkpointType),
  statusIdx: index("cle_status_idx").on(table.status),
  expectedDateIdx: index("cle_expected_date_idx").on(table.expectedDate),
  aiAlertedIdx: index("cle_ai_alerted_idx").on(table.aiAlerted),
}));

// Insert schemas for Benefits Access Review
export const insertBenefitsAccessReviewSchema = createInsertSchema(benefitsAccessReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReviewSampleSchema = createInsertSchema(reviewSamples).omit({
  id: true,
  createdAt: true,
});

export const insertReviewerFeedbackSchema = createInsertSchema(reviewerFeedback).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCaseLifecycleEventSchema = createInsertSchema(caseLifecycleEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for Benefits Access Review
export type BenefitsAccessReview = typeof benefitsAccessReviews.$inferSelect;
export type InsertBenefitsAccessReview = z.infer<typeof insertBenefitsAccessReviewSchema>;
export type ReviewSample = typeof reviewSamples.$inferSelect;
export type InsertReviewSample = z.infer<typeof insertReviewSampleSchema>;
export type ReviewerFeedback = typeof reviewerFeedback.$inferSelect;
export type InsertReviewerFeedback = z.infer<typeof insertReviewerFeedbackSchema>;
export type CaseLifecycleEvent = typeof caseLifecycleEvents.$inferSelect;
export type InsertCaseLifecycleEvent = z.infer<typeof insertCaseLifecycleEventSchema>;

// AI and ML Tables for Production Features
export const crossEnrollmentPredictions = pgTable("cross_enrollment_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  predictedProgram: text("predicted_program").notNull(), // SNAP, MEDICAID, TANF, etc.
  confidenceScore: real("confidence_score").notNull(), // 0.0 to 1.0
  predictionReason: jsonb("prediction_reason"), // Structured explanation
  modelVersion: text("model_version").notNull(),
  features: jsonb("features"), // Input features used for prediction
  outcome: text("outcome"), // accepted, rejected, pending
  outcomeDate: timestamp("outcome_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index("cross_enrollment_predictions_client_id_idx").on(table.clientId),
  programIdx: index("cross_enrollment_predictions_program_idx").on(table.predictedProgram),
  confidenceIdx: index("cross_enrollment_predictions_confidence_idx").on(table.confidenceScore),
  createdAtIdx: index("cross_enrollment_predictions_created_at_idx").on(table.createdAt),
}));

export const fraudDetectionAlerts = pgTable("fraud_detection_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertType: text("alert_type").notNull(), // unusual_pattern, duplicate_application, identity_mismatch, etc.
  severity: text("severity").notNull(), // low, medium, high, critical
  entityType: text("entity_type").notNull(), // client, application, document
  entityId: varchar("entity_id").notNull(),
  detectionMethod: text("detection_method").notNull(), // ml_model, rule_based, behavioral
  anomalyScore: real("anomaly_score"), // 0.0 to 1.0
  details: jsonb("details").notNull(), // Structured alert details
  status: text("status").notNull().default("pending"), // pending, investigating, resolved, false_positive
  investigatorId: varchar("investigator_id"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  entityIdx: index("fraud_detection_alerts_entity_idx").on(table.entityType, table.entityId),
  severityIdx: index("fraud_detection_alerts_severity_idx").on(table.severity),
  statusIdx: index("fraud_detection_alerts_status_idx").on(table.status),
  createdAtIdx: index("fraud_detection_alerts_created_at_idx").on(table.createdAt),
}));

export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  service: text("service").notNull(), // gemini, policyengine, ocr, rag, etc.
  operation: text("operation").notNull(), // text_generation, document_extraction, embedding, etc.
  userId: varchar("user_id"),
  tenantId: varchar("tenant_id"),
  model: text("model"), // gemini-1.5-flash, text-embedding-004, etc.
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  totalTokens: integer("total_tokens"),
  estimatedCost: real("estimated_cost"), // In USD
  responseTime: integer("response_time"), // In milliseconds
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"), // Additional context
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  serviceIdx: index("ai_usage_logs_service_idx").on(table.service),
  userIdx: index("ai_usage_logs_user_idx").on(table.userId),
  tenantIdx: index("ai_usage_logs_tenant_idx").on(table.tenantId),
  createdAtIdx: index("ai_usage_logs_created_at_idx").on(table.createdAt),
  costIdx: index("ai_usage_logs_cost_idx").on(table.estimatedCost),
}));

// Create schemas and types for the new tables
export const insertCrossEnrollmentPredictionSchema = createInsertSchema(crossEnrollmentPredictions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFraudDetectionAlertSchema = createInsertSchema(fraudDetectionAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiUsageLogSchema = createInsertSchema(aiUsageLogs).omit({
  id: true,
  createdAt: true,
});

// Types for AI/ML tables
export type CrossEnrollmentPrediction = typeof crossEnrollmentPredictions.$inferSelect;
export type InsertCrossEnrollmentPrediction = z.infer<typeof insertCrossEnrollmentPredictionSchema>;
export type FraudDetectionAlert = typeof fraudDetectionAlerts.$inferSelect;
export type InsertFraudDetectionAlert = z.infer<typeof insertFraudDetectionAlertSchema>;
export type AiUsageLog = typeof aiUsageLogs.$inferSelect;
export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;

// ============================================================================
// DATA DISPOSAL AUDIT TRAIL - CRIT-002 Compliance
// ============================================================================

// Data Disposal Logs - Comprehensive audit trail for all data deletion operations
export const dataDisposalLogs = pgTable("data_disposal_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableName: text("table_name").notNull(),
  recordId: varchar("record_id").notNull(),
  deletionReason: text("deletion_reason").notNull(), // retention_expired, gdpr_request, legal_purge, manual_admin
  deletedBy: varchar("deleted_by").references(() => users.id).notNull(),
  deletionMethod: text("deletion_method").notNull(), // soft_delete, hard_delete, crypto_shred
  recordSnapshot: jsonb("record_snapshot"), // Metadata of deleted record (NOT full data)
  legalHoldStatus: text("legal_hold_status"), // none, irs_7yr, litigation_hold, regulatory_hold
  approvalChain: jsonb("approval_chain"), // Audit trail of approvals
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  auditTrail: jsonb("audit_trail"), // Compliance evidence
}, (table) => ({
  tableNameIdx: index("data_disposal_logs_table_name_idx").on(table.tableName),
  recordIdIdx: index("data_disposal_logs_record_id_idx").on(table.recordId),
  deletedAtIdx: index("data_disposal_logs_deleted_at_idx").on(table.deletedAt),
}));

// Insert schema for data disposal logs
export const insertDataDisposalLogSchema = createInsertSchema(dataDisposalLogs).omit({
  id: true,
  deletedAt: true,
});

// Types for data disposal logs
export type DataDisposalLog = typeof dataDisposalLogs.$inferSelect;
export type InsertDataDisposalLog = z.infer<typeof insertDataDisposalLogSchema>;

// ============================================================================
// NEURO-SYMBOLIC AI FRAMEWORK - Legal Ontology & SMT Verification
// Based on: "A Neuro-Symbolic Framework for Accountability in Public-Sector AI"
// ============================================================================

// Statutory Sources - Policy manuals and regulatory documents (TBox foundation)
export const statutorySources = pgTable("statutory_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateCode: text("state_code").notNull(), // MD, PA, VA, UT, IN, MI
  programCode: text("program_code").notNull(), // SNAP, MEDICAID, TANF, OHEP, TAX_CREDITS, SSI
  sourceType: text("source_type").notNull(), // policy_manual, comar, cfr, statute, guidance
  citation: text("citation").notNull(), // e.g., "MPP 63-401.1", "COMAR 07.03.03.01", "7 CFR 273.2"
  title: text("title").notNull(),
  fullText: text("full_text").notNull(),
  effectiveDate: date("effective_date"),
  expirationDate: date("expiration_date"),
  parentCitation: text("parent_citation"), // hierarchical reference
  crossReferences: text("cross_references").array(), // related citations
  sourceUrl: text("source_url"),
  documentHash: text("document_hash"), // SHA-256 for version tracking
  version: text("version").notNull().default("1.0"),
  isActive: boolean("is_active").default(true).notNull(),
  lastScrapedAt: timestamp("last_scraped_at"),
  metadata: jsonb("metadata"), // jurisdiction-specific metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  stateCodeIdx: index("statutory_sources_state_code_idx").on(table.stateCode),
  programCodeIdx: index("statutory_sources_program_code_idx").on(table.programCode),
  citationIdx: index("statutory_sources_citation_idx").on(table.citation),
  effectiveDateIdx: index("statutory_sources_effective_date_idx").on(table.effectiveDate),
  isActiveIdx: index("statutory_sources_is_active_idx").on(table.isActive),
}));

// Ontology Terms - TBox: Legal concepts extracted from policy manuals
export const ontologyTerms = pgTable("ontology_terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateCode: text("state_code").notNull(), // MD, PA, VA, UT, IN, MI
  programCode: text("program_code").notNull(), // SNAP, MEDICAID, TANF, OHEP, TAX_CREDITS, SSI
  termName: text("term_name").notNull(), // e.g., "GrossIncome", "ResidencyRequirement"
  canonicalName: text("canonical_name").notNull(), // Normalized form: "Income_GrossIncome"
  domain: text("domain").notNull(), // income, residency, citizenship, resources, work_requirement, student_status
  definition: text("definition"),
  statutoryCitation: text("statutory_citation"), // MPP section, COMAR reference
  statutorySourceId: varchar("statutory_source_id").references(() => statutorySources.id),
  parentTermId: varchar("parent_term_id"), // Hierarchical relationship (self-reference)
  synonyms: text("synonyms").array(), // Alternative terms
  embedding: real("embedding").array(), // e5-large-v2 embedding vector (1024 dimensions)
  embeddingModel: text("embedding_model").default("e5-large-v2"),
  version: text("version").notNull().default("1.0"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by"), // system, admin user, or AI extraction
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  stateCodeIdx: index("ontology_terms_state_code_idx").on(table.stateCode),
  programCodeIdx: index("ontology_terms_program_code_idx").on(table.programCode),
  domainIdx: index("ontology_terms_domain_idx").on(table.domain),
  canonicalNameIdx: index("ontology_terms_canonical_name_idx").on(table.canonicalName),
  parentTermIdx: index("ontology_terms_parent_term_idx").on(table.parentTermId),
  isActiveIdx: index("ontology_terms_is_active_idx").on(table.isActive),
  stateProgramIdx: index("ontology_terms_state_program_idx").on(table.stateCode, table.programCode),
}));

// Ontology Relationships - Edges between ontology terms (knowledge graph)
export const ontologyRelationships = pgTable("ontology_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromTermId: varchar("from_term_id").references(() => ontologyTerms.id).notNull(),
  toTermId: varchar("to_term_id").references(() => ontologyTerms.id).notNull(),
  relationshipType: text("relationship_type").notNull(), // depends_on, constrains, requires, implies, excludes
  statutoryCitation: text("statutory_citation"),
  description: text("description"),
  weight: real("weight").default(1.0), // relationship strength
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  fromTermIdx: index("ontology_relationships_from_term_idx").on(table.fromTermId),
  toTermIdx: index("ontology_relationships_to_term_idx").on(table.toTermId),
  relationshipTypeIdx: index("ontology_relationships_type_idx").on(table.relationshipType),
}));

// Rule Fragments - Clauses extracted from statutory text before formalization
export const ruleFragments = pgTable("rule_fragments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  statutorySourceId: varchar("statutory_source_id").references(() => statutorySources.id).notNull(),
  clauseText: text("clause_text").notNull(), // Original statutory clause
  clauseNumber: integer("clause_number"), // Position within source
  extractedConcepts: text("extracted_concepts").array(), // Ontology term references
  eligibilityDomain: text("eligibility_domain").notNull(), // income, residency, citizenship, etc.
  ruleType: text("rule_type").notNull(), // requirement, exception, threshold, verification
  extractionMethod: text("extraction_method").notNull(), // manual, llm_extraction, nlp_pipeline
  extractionModel: text("extraction_model"), // gemini-1.5-pro, gpt-4o, etc.
  confidenceScore: real("confidence_score"), // 0.0 to 1.0
  needsReview: boolean("needs_review").default(true).notNull(),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  statutorySourceIdx: index("rule_fragments_statutory_source_idx").on(table.statutorySourceId),
  eligibilityDomainIdx: index("rule_fragments_eligibility_domain_idx").on(table.eligibilityDomain),
  ruleTypeIdx: index("rule_fragments_rule_type_idx").on(table.ruleType),
  needsReviewIdx: index("rule_fragments_needs_review_idx").on(table.needsReview),
}));

// Formal Rules - Z3-compatible logical rules derived from rule fragments
export const formalRules = pgTable("formal_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleFragmentId: varchar("rule_fragment_id").references(() => ruleFragments.id),
  stateCode: text("state_code").notNull(),
  programCode: text("program_code").notNull(),
  ruleName: text("rule_name").notNull(), // Human-readable rule identifier
  eligibilityDomain: text("eligibility_domain").notNull(),
  ruleType: text("rule_type").default("requirement"), // requirement, threshold, exception, verification
  // Z3 SMT Solver logic
  z3Logic: text("z3_logic").notNull(), // e.g., "Implies(And(GrossIncome <= IncomeThreshold), Applicant_Eligible)"
  description: text("description"), // Human-readable description of the rule
  ontologyTermsUsed: text("ontology_terms_used").array(), // References to ontology_terms
  statutoryCitation: text("statutory_citation").notNull(),
  // Versioning and validation
  version: text("version").notNull().default("1.0"),
  previousVersionId: varchar("previous_version_id"), // For version history
  isValid: boolean("is_valid").default(true).notNull(), // Passes Z3 syntax validation
  validationErrors: text("validation_errors").array(),
  // Extraction metadata
  extractionPrompt: text("extraction_prompt"), // LLM prompt used
  extractionModel: text("extraction_model"), // gemini-1.5-pro, gpt-o1, etc.
  promptingStrategy: text("prompting_strategy"), // vanilla, undirected, directed_symbolic
  extractionConfidence: real("extraction_confidence"),
  isVerified: boolean("is_verified").default(false), // Manually verified by human
  extractedAt: timestamp("extracted_at"), // When the rule was extracted
  // Approval workflow
  status: text("status").notNull().default("draft"), // draft, pending_review, approved, deprecated
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  deprecatedAt: timestamp("deprecated_at"),
  deprecationReason: text("deprecation_reason"),
  // Audit
  createdBy: varchar("created_by"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  stateCodeIdx: index("formal_rules_state_code_idx").on(table.stateCode),
  programCodeIdx: index("formal_rules_program_code_idx").on(table.programCode),
  eligibilityDomainIdx: index("formal_rules_eligibility_domain_idx").on(table.eligibilityDomain),
  ruleTypeIdx: index("formal_rules_rule_type_idx").on(table.ruleType),
  statusIdx: index("formal_rules_status_idx").on(table.status),
  isValidIdx: index("formal_rules_is_valid_idx").on(table.isValid),
  stateProgramIdx: index("formal_rules_state_program_idx").on(table.stateCode, table.programCode),
}));

// Rule Extraction Audit Logs - Track LLM prompting attempts for rules
export const ruleExtractionLogs = pgTable("rule_extraction_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleFragmentId: varchar("rule_fragment_id").references(() => ruleFragments.id),
  formalRuleId: varchar("formal_rule_id").references(() => formalRules.id),
  extractionModel: text("extraction_model").notNull(),
  promptStrategy: text("prompt_strategy").notNull(), // vanilla, undirected, directed_symbolic
  prompt: text("prompt").notNull(),
  response: text("response").notNull(),
  extractedLogic: text("extracted_logic"),
  isSuccess: boolean("is_success").notNull(),
  errorMessage: text("error_message"),
  z3ValidationResult: text("z3_validation_result"), // valid, syntax_error, semantic_error
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  ruleFragmentIdx: index("rule_extraction_logs_rule_fragment_idx").on(table.ruleFragmentId),
  extractionModelIdx: index("rule_extraction_logs_model_idx").on(table.extractionModel),
  promptStrategyIdx: index("rule_extraction_logs_strategy_idx").on(table.promptStrategy),
  isSuccessIdx: index("rule_extraction_logs_success_idx").on(table.isSuccess),
}));

// Case Assertions - ABox: Case-level facts instantiated from household profiles
export const caseAssertions = pgTable("case_assertions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => clientCases.id).notNull(),
  householdProfileId: varchar("household_profile_id"), // References household_profiles
  stateCode: text("state_code").notNull(),
  programCode: text("program_code").notNull(),
  // Assertion content
  assertionType: text("assertion_type").notNull(), // fact, claim, explanation_derived
  ontologyTermId: varchar("ontology_term_id").references(() => ontologyTerms.id),
  predicateName: text("predicate_name").notNull(), // e.g., "GrossIncome", "HouseholdSize"
  predicateValue: text("predicate_value"), // Actual value (e.g., "45000", "3", "true")
  predicateOperator: text("predicate_operator"), // =, <, >, <=, >=, !=
  comparisonValue: text("comparison_value"), // For threshold comparisons
  // Z3 assertion
  z3Assertion: text("z3_assertion"), // Z3-compatible format
  // Source tracking
  sourceField: text("source_field"), // Field in household profile
  sourceValue: text("source_value"), // Original value before normalization
  extractionMethod: text("extraction_method"), // direct_mapping, llm_extraction, calculation
  // Verification
  isVerified: boolean("is_verified").default(false).notNull(),
  verificationDocumentId: varchar("verification_document_id"),
  // Multi-tenancy
  tenantId: varchar("tenant_id"),
  // Data retention
  retentionCategory: text("retention_category"),
  retentionUntil: timestamp("retention_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  caseIdIdx: index("case_assertions_case_id_idx").on(table.caseId),
  stateCodeIdx: index("case_assertions_state_code_idx").on(table.stateCode),
  programCodeIdx: index("case_assertions_program_code_idx").on(table.programCode),
  assertionTypeIdx: index("case_assertions_assertion_type_idx").on(table.assertionType),
  predicateNameIdx: index("case_assertions_predicate_name_idx").on(table.predicateName),
  tenantIdIdx: index("case_assertions_tenant_id_idx").on(table.tenantId),
}));

// Explanation Clauses - Individual claims from decision explanations (for verification)
export const explanationClauses = pgTable("explanation_clauses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => clientCases.id).notNull(),
  eligibilityCalculationId: varchar("eligibility_calculation_id").references(() => eligibilityCalculations.id),
  clauseNumber: integer("clause_number").notNull(),
  clauseText: text("clause_text").notNull(), // Original explanation text
  normalizedClause: text("normalized_clause"), // Canonical form
  // Ontology mapping
  mappedOntologyTerms: text("mapped_ontology_terms").array(), // Ontology term IDs
  mappedPredicates: text("mapped_predicates").array(), // Extracted predicates
  z3Assertion: text("z3_assertion"), // Z3-compatible assertion
  // Mapping confidence
  mappingConfidence: real("mapping_confidence"),
  mappingModel: text("mapping_model"), // LLM used for mapping
  // Verification result (filled after solver run)
  verificationResult: text("verification_result"), // satisfied, violated, unknown
  violatedRuleIds: text("violated_rule_ids").array(), // References to formal_rules
  // Source
  explanationType: text("explanation_type").notNull(), // denial, approval, reduction, termination
  sourceSystem: text("source_system"), // rules_engine, policyengine, ai_copilot
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  caseIdIdx: index("explanation_clauses_case_id_idx").on(table.caseId),
  eligibilityCalcIdx: index("explanation_clauses_eligibility_calc_idx").on(table.eligibilityCalculationId),
  verificationResultIdx: index("explanation_clauses_verification_result_idx").on(table.verificationResult),
  explanationTypeIdx: index("explanation_clauses_explanation_type_idx").on(table.explanationType),
}));

// Solver Runs - SMT solver execution records
export const solverRuns = pgTable("solver_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => clientCases.id).notNull(),
  stateCode: text("state_code").notNull(),
  programCode: text("program_code").notNull(),
  // Solver input
  tboxRuleIds: text("tbox_rule_ids").array(), // formal_rules used
  aboxAssertionIds: text("abox_assertion_ids").array(), // case_assertions used
  explanationClauseIds: text("explanation_clause_ids").array(), // explanation_clauses checked
  // Solver output
  solverResult: text("solver_result").notNull(), // SAT, UNSAT, UNKNOWN, TIMEOUT
  isSatisfied: boolean("is_satisfied"), // true if SAT (legally valid)
  unsatCore: text("unsat_core").array(), // Minimal unsatisfiable constraint set
  violatedRuleIds: text("violated_rule_ids").array(), // formal_rules violated
  violatedCitations: text("violated_citations").array(), // Statutory citations violated
  satisfiedRuleIds: text("satisfied_rule_ids").array(), // Rules that passed
  // Performance
  solverVersion: text("solver_version"), // z3 version
  solverTimeMs: integer("solver_time_ms"),
  constraintCount: integer("constraint_count"),
  variableCount: integer("variable_count"),
  // Execution context
  triggeredBy: text("triggered_by").notNull(), // eligibility_calculation, appeal_review, manual_check
  userId: varchar("user_id").references(() => users.id),
  tenantId: varchar("tenant_id"),
  // Full solver trace (for debugging)
  solverTrace: jsonb("solver_trace"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  caseIdIdx: index("solver_runs_case_id_idx").on(table.caseId),
  stateCodeIdx: index("solver_runs_state_code_idx").on(table.stateCode),
  programCodeIdx: index("solver_runs_program_code_idx").on(table.programCode),
  solverResultIdx: index("solver_runs_solver_result_idx").on(table.solverResult),
  isSatisfiedIdx: index("solver_runs_is_satisfied_idx").on(table.isSatisfied),
  triggeredByIdx: index("solver_runs_triggered_by_idx").on(table.triggeredBy),
  tenantIdIdx: index("solver_runs_tenant_id_idx").on(table.tenantId),
  createdAtIdx: index("solver_runs_created_at_idx").on(table.createdAt),
}));

// Violation Traces - Detailed statutory violation records with citation links
export const violationTraces = pgTable("violation_traces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  solverRunId: varchar("solver_run_id").references(() => solverRuns.id).notNull(),
  caseId: varchar("case_id").references(() => clientCases.id).notNull(),
  // Violated rule details
  formalRuleId: varchar("formal_rule_id").references(() => formalRules.id).notNull(),
  ruleName: text("rule_name").notNull(),
  eligibilityDomain: text("eligibility_domain").notNull(),
  // Statutory citation
  statutoryCitation: text("statutory_citation").notNull(),
  statutorySourceId: varchar("statutory_source_id").references(() => statutorySources.id),
  statutoryText: text("statutory_text"), // Relevant excerpt
  // Violation details
  violationType: text("violation_type").notNull(), // threshold_exceeded, requirement_missing, condition_failed
  violationDescription: text("violation_description").notNull(), // Human-readable explanation
  // Conflicting assertions
  conflictingAssertionIds: text("conflicting_assertion_ids").array(),
  conflictingPredicates: jsonb("conflicting_predicates"), // {predicate, expected, actual}
  // Appeal support
  appealRecommendation: text("appeal_recommendation"), // AI-generated appeal guidance
  requiredDocumentation: text("required_documentation").array(), // Documents needed to contest
  // UI display
  severityLevel: text("severity_level").notNull().default("high"), // low, medium, high, critical
  displayOrder: integer("display_order"), // Order in violation trace visualization
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  solverRunIdx: index("violation_traces_solver_run_idx").on(table.solverRunId),
  caseIdIdx: index("violation_traces_case_id_idx").on(table.caseId),
  formalRuleIdx: index("violation_traces_formal_rule_idx").on(table.formalRuleId),
  eligibilityDomainIdx: index("violation_traces_eligibility_domain_idx").on(table.eligibilityDomain),
  violationTypeIdx: index("violation_traces_violation_type_idx").on(table.violationType),
  severityLevelIdx: index("violation_traces_severity_level_idx").on(table.severityLevel),
}));

// ============================================================================
// PAYMENT ERROR REDUCTION (PER) MODULE TABLES
// SNAP Payment Error Rate Reduction per Arnold Ventures/MD DHS Blueprint
// ============================================================================

// PER Income Verifications - W-2 wage data matching against reported income
export const perIncomeVerifications = pgTable("per_income_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => clientCases.id).notNull(),
  householdMemberId: varchar("household_member_id"),
  // Reported income from application
  reportedGrossIncome: integer("reported_gross_income"), // Monthly
  reportedIncomeSource: text("reported_income_source"),
  reportedEmployer: text("reported_employer"),
  // Verified income from external sources
  verifiedGrossIncome: integer("verified_gross_income"),
  verifiedIncomeSource: text("verified_income_source"), // w2, state_wage_db, ssa, employer_direct
  verifiedEmployer: text("verified_employer"),
  verificationQuarter: text("verification_quarter"), // e.g., "2025-Q1"
  verificationDate: timestamp("verification_date"),
  // Discrepancy analysis
  discrepancyAmount: integer("discrepancy_amount"), // Difference in dollars
  discrepancyPercent: real("discrepancy_percent"),
  discrepancyType: text("discrepancy_type"), // underreported, overreported, unreported_employer, missing_income
  // Error classification
  isPaymentError: boolean("is_payment_error").default(false),
  errorType: text("error_type"), // overpayment, underpayment, none
  estimatedErrorAmount: integer("estimated_error_amount"), // Impact on benefit calculation
  // Resolution
  resolutionStatus: text("resolution_status").default("pending"), // pending, resolved, escalated, waived
  resolutionAction: text("resolution_action"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  // Audit trail
  stateCode: text("state_code").notNull().default("MD"),
  tenantId: varchar("tenant_id"),
  createdBy: varchar("created_by").references(() => users.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  caseIdIdx: index("per_income_verifications_case_id_idx").on(table.caseId),
  stateCodeIdx: index("per_income_verifications_state_code_idx").on(table.stateCode),
  isPaymentErrorIdx: index("per_income_verifications_is_payment_error_idx").on(table.isPaymentError),
  errorTypeIdx: index("per_income_verifications_error_type_idx").on(table.errorType),
  resolutionStatusIdx: index("per_income_verifications_resolution_status_idx").on(table.resolutionStatus),
  verificationQuarterIdx: index("per_income_verifications_quarter_idx").on(table.verificationQuarter),
  tenantIdIdx: index("per_income_verifications_tenant_id_idx").on(table.tenantId),
}));

// PER Consistency Checks - Pre-submission validation before case approval
export const perConsistencyChecks = pgTable("per_consistency_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => clientCases.id).notNull(),
  checkType: text("check_type").notNull(), // income_total, household_composition, documentation_complete, duplicate_person, income_source_match
  checkName: text("check_name").notNull(),
  checkDescription: text("check_description"),
  message: text("message"), // Human-readable check message
  details: text("details"), // Additional context
  fieldName: text("field_name"), // The field being checked
  // Check results
  checkStatus: text("check_status").notNull(), // passed, failed, warning, skipped
  passed: boolean("passed").default(true), // Quick access boolean for pass/fail
  severity: text("severity"), // info, warning, critical
  riskScore: integer("risk_score"), // 0-100
  riskLevel: text("risk_level"), // low, medium, high, critical
  // Specific findings
  expectedValue: text("expected_value"),
  actualValue: text("actual_value"),
  discrepancyDetails: text("discrepancy_details"),
  affectedFields: text("affected_fields").array(),
  // Impact assessment
  potentialErrorType: text("potential_error_type"), // overpayment, underpayment, none
  estimatedImpact: integer("estimated_impact"), // Dollar amount if not corrected
  impactAmount: integer("impact_amount"), // Alias for estimatedImpact
  // Caseworker guidance
  recommendedAction: text("recommended_action"),
  documentationNeeded: text("documentation_needed").array(),
  // Resolution tracking
  wasAddressed: boolean("was_addressed").default(false),
  addressedBy: varchar("addressed_by").references(() => users.id),
  addressedAt: timestamp("addressed_at"),
  addressedAction: text("addressed_action"),
  // Execution context
  triggeredBy: text("triggered_by").notNull(), // pre_submission, periodic_review, qc_sample, manual
  stateCode: text("state_code").notNull().default("MD"),
  tenantId: varchar("tenant_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  caseIdIdx: index("per_consistency_checks_case_id_idx").on(table.caseId),
  checkTypeIdx: index("per_consistency_checks_check_type_idx").on(table.checkType),
  checkStatusIdx: index("per_consistency_checks_check_status_idx").on(table.checkStatus),
  riskLevelIdx: index("per_consistency_checks_risk_level_idx").on(table.riskLevel),
  wasAddressedIdx: index("per_consistency_checks_was_addressed_idx").on(table.wasAddressed),
  triggeredByIdx: index("per_consistency_checks_triggered_by_idx").on(table.triggeredBy),
  stateCodeIdx: index("per_consistency_checks_state_code_idx").on(table.stateCode),
  tenantIdIdx: index("per_consistency_checks_tenant_id_idx").on(table.tenantId),
}));

// PER Duplicate Claims - Detect individuals/children on multiple SNAP applications
export const perDuplicateClaims = pgTable("per_duplicate_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Primary case (the one being reviewed)
  primaryCaseId: varchar("primary_case_id").references(() => clientCases.id).notNull(),
  primaryHouseholdId: varchar("primary_household_id").references(() => householdProfiles.id),
  // Duplicate case (the conflicting case)
  duplicateCaseId: varchar("duplicate_case_id").references(() => clientCases.id),
  duplicateHouseholdId: varchar("duplicate_household_id").references(() => householdProfiles.id),
  // Person details
  personFirstName: text("person_first_name"),
  personLastName: text("person_last_name"),
  personDob: date("person_dob"),
  personSsn4: text("person_ssn_4"), // Last 4 digits only for matching
  personRelationship: text("person_relationship"), // child, spouse, parent, other
  // Match analysis
  matchType: text("match_type").notNull(), // exact_ssn, name_dob, name_address, fuzzy
  matchConfidence: real("match_confidence"), // 0.0-1.0
  matchingFields: text("matching_fields").array(), // Which fields matched
  // Duplicate classification
  duplicateType: text("duplicate_type").notNull(), // same_person_multiple_households, child_claimed_twice, identity_mismatch
  isPotentialFraud: boolean("is_potential_fraud").default(false),
  // Impact
  impactedBenefitAmount: integer("impacted_benefit_amount"),
  impactedProgram: text("impacted_program").default("SNAP"),
  // Resolution
  resolutionStatus: text("resolution_status").default("pending"), // pending, confirmed_duplicate, false_positive, resolved
  resolutionAction: text("resolution_action"), // merged, removed_from_primary, removed_from_duplicate, referred_fraud
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  // Detection context
  detectedBy: text("detected_by").notNull(), // pre_submission, batch_scan, qc_review, external_match
  stateCode: text("state_code").notNull().default("MD"),
  tenantId: varchar("tenant_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  primaryCaseIdx: index("per_duplicate_claims_primary_case_idx").on(table.primaryCaseId),
  duplicateCaseIdx: index("per_duplicate_claims_duplicate_case_idx").on(table.duplicateCaseId),
  matchTypeIdx: index("per_duplicate_claims_match_type_idx").on(table.matchType),
  duplicateTypeIdx: index("per_duplicate_claims_duplicate_type_idx").on(table.duplicateType),
  resolutionStatusIdx: index("per_duplicate_claims_resolution_status_idx").on(table.resolutionStatus),
  isPotentialFraudIdx: index("per_duplicate_claims_is_potential_fraud_idx").on(table.isPotentialFraud),
  stateCodeIdx: index("per_duplicate_claims_state_code_idx").on(table.stateCode),
  tenantIdIdx: index("per_duplicate_claims_tenant_id_idx").on(table.tenantId),
}));

// PER Caseworker Nudges - Explainable AI guidance for caseworkers (XAI)
export const perCaseworkerNudges = pgTable("per_caseworker_nudges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => clientCases.id).notNull(),
  caseworkerId: varchar("caseworker_id").references(() => users.id),
  // Risk scoring context
  riskScore: integer("risk_score").notNull(), // 0-100
  riskLevel: text("risk_level").notNull(), // low, medium, high, critical
  riskFactors: text("risk_factors").array(), // List of contributing factors
  // Plain language explanation (XAI)
  nudgeTitle: text("nudge_title").notNull(),
  nudgeDescription: text("nudge_description").notNull(), // Plain language explanation of why flagged
  // Specific guidance
  primaryAction: text("primary_action").notNull(), // What the caseworker should do first
  additionalActions: text("additional_actions").array(),
  documentationToReview: text("documentation_to_review").array(),
  questionsToAsk: text("questions_to_ask").array(), // Suggested verification questions
  // Source data citations
  dataSourcesUsed: text("data_sources_used").array(), // w2_data, household_history, case_patterns
  evidenceSummary: jsonb("evidence_summary"), // Structured evidence for the nudge
  // Confidence and reasoning
  confidenceScore: real("confidence_score"), // AI confidence in this nudge
  reasoningTrace: text("reasoning_trace"), // Step-by-step logic (for audit)
  modelVersion: text("model_version"),
  // Caseworker interaction
  nudgeStatus: text("nudge_status").default("pending"), // pending, viewed, acted_upon, dismissed
  viewedAt: timestamp("viewed_at"),
  actionTaken: text("action_taken"),
  actionTakenAt: timestamp("action_taken_at"),
  caseworkerFeedback: text("caseworker_feedback"), // Was this nudge helpful?
  feedbackRating: integer("feedback_rating"), // 1-5 stars
  // Outcome tracking
  outcomeType: text("outcome_type"), // error_prevented, error_found, false_positive, no_action_needed
  outcome: text("outcome"), // Alias for outcomeType - error_prevented, error_found, false_positive, no_action_needed
  actualErrorAmount: integer("actual_error_amount"),
  estimatedImpactAmount: integer("estimated_impact_amount"), // Estimated dollar impact of this nudge
  // Acknowledgment tracking
  acknowledgedAt: timestamp("acknowledged_at"),
  rating: integer("rating"), // 1-5 caseworker rating of nudge usefulness
  // Statutory citations from hybrid gateway
  statutoryCitations: text("statutory_citations").array(), // Legal citations from Z3 UNSAT core
  hybridGatewayRunId: varchar("hybrid_gateway_run_id"), // Link to solver_runs for verification audit
  // Supervisor review (for pre-case coaching workflow)
  supervisorReviewedAt: timestamp("supervisor_reviewed_at"),
  supervisorReviewedBy: varchar("supervisor_reviewed_by").references(() => users.id),
  supervisorNotes: text("supervisor_notes"),
  supervisorAction: text("supervisor_action"), // coached, escalated, approved, training_assigned
  trainingAssigned: text("training_assigned"), // ID of training module assigned
  // Context
  nudgeType: text("nudge_type").notNull(), // income_discrepancy, duplicate_claim, documentation_gap, pattern_alert
  programType: text("program_type").default("SNAP"),
  stateCode: text("state_code").notNull().default("MD"),
  tenantId: varchar("tenant_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  caseIdIdx: index("per_caseworker_nudges_case_id_idx").on(table.caseId),
  caseworkerIdIdx: index("per_caseworker_nudges_caseworker_id_idx").on(table.caseworkerId),
  riskLevelIdx: index("per_caseworker_nudges_risk_level_idx").on(table.riskLevel),
  nudgeStatusIdx: index("per_caseworker_nudges_nudge_status_idx").on(table.nudgeStatus),
  nudgeTypeIdx: index("per_caseworker_nudges_nudge_type_idx").on(table.nudgeType),
  outcomeTypeIdx: index("per_caseworker_nudges_outcome_type_idx").on(table.outcomeType),
  stateCodeIdx: index("per_caseworker_nudges_state_code_idx").on(table.stateCode),
  tenantIdIdx: index("per_caseworker_nudges_tenant_id_idx").on(table.tenantId),
  createdAtIdx: index("per_caseworker_nudges_created_at_idx").on(table.createdAt),
}));

// PER PERM Samples - FNS Payment Error Rate Measurement sampling and reporting
export const perPermSamples = pgTable("per_perm_samples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => clientCases.id).notNull(),
  // Sample metadata
  samplePeriod: text("sample_period").notNull(), // e.g., "FY2025-Q2"
  sampleType: text("sample_type").notNull(), // active_case, negative_case
  sampleStratum: text("sample_stratum"), // Stratification category
  sampleWeight: real("sample_weight"), // Statistical weight for extrapolation
  selectionDate: timestamp("selection_date").notNull(),
  // Case snapshot at selection
  benefitAmount: integer("benefit_amount"), // Monthly SNAP benefit at selection
  householdSize: integer("household_size"),
  grossIncome: integer("gross_income"),
  netIncome: integer("net_income"),
  certificationPeriod: text("certification_period"),
  // Review findings
  reviewStatus: text("review_status").default("pending"), // pending, in_review, completed, unable_to_review
  reviewStartDate: timestamp("review_start_date"),
  reviewCompletedDate: timestamp("review_completed_date"),
  reviewerId: varchar("reviewer_id").references(() => users.id),
  // Error findings
  hasError: boolean("has_error").default(false),
  errorType: text("error_type"), // overpayment, underpayment, none
  errorAmount: integer("error_amount"), // Dollar amount of error
  correctBenefitAmount: integer("correct_benefit_amount"),
  // Error classification per FNS
  errorCategory: text("error_category"), // agency_error, client_error, both
  errorCause: text("error_cause"), // income, deductions, household_comp, resources, other
  errorSubcause: text("error_subcause"), // More specific cause
  errorResponsibility: text("error_responsibility"), // state_agency, local_office, client, other
  // Variance analysis
  incomeVariance: integer("income_variance"),
  deductionVariance: integer("deduction_variance"),
  householdVariance: integer("household_variance"),
  // Documentation
  reviewNotes: text("review_notes"),
  findingsSummary: text("findings_summary"),
  correctiveActions: text("corrective_actions").array(),
  // FNS reporting fields
  fnsReportingStatus: text("fns_reporting_status").default("pending"), // pending, submitted, accepted, rejected
  fnsSubmissionDate: timestamp("fns_submission_date"),
  fnsReferenceNumber: text("fns_reference_number"),
  // State tracking
  stateCode: text("state_code").notNull().default("MD"),
  countyCode: text("county_code"),
  tenantId: varchar("tenant_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  caseIdIdx: index("per_perm_samples_case_id_idx").on(table.caseId),
  samplePeriodIdx: index("per_perm_samples_sample_period_idx").on(table.samplePeriod),
  sampleTypeIdx: index("per_perm_samples_sample_type_idx").on(table.sampleType),
  reviewStatusIdx: index("per_perm_samples_review_status_idx").on(table.reviewStatus),
  hasErrorIdx: index("per_perm_samples_has_error_idx").on(table.hasError),
  errorTypeIdx: index("per_perm_samples_error_type_idx").on(table.errorType),
  errorCategoryIdx: index("per_perm_samples_error_category_idx").on(table.errorCategory),
  fnsReportingStatusIdx: index("per_perm_samples_fns_reporting_status_idx").on(table.fnsReportingStatus),
  stateCodeIdx: index("per_perm_samples_state_code_idx").on(table.stateCode),
  tenantIdIdx: index("per_perm_samples_tenant_id_idx").on(table.tenantId),
}));

// ============================================================================
// NEURO-SYMBOLIC HYBRID GATEWAY AUDIT LOGS
// Comprehensive audit trail for all decisions routed through the hybrid engine
// ============================================================================

export const hybridGatewayAuditLogs = pgTable("hybrid_gateway_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gatewayRunId: varchar("gateway_run_id").notNull(), // Unique identifier for this gateway invocation
  caseId: varchar("case_id").references(() => clientCases.id),
  stateCode: text("state_code").notNull(),
  programCode: text("program_code").notNull(),
  // Operation context
  operationType: text("operation_type").notNull(), // eligibility_verification, income_discrepancy_check, consistency_validation, etc.
  triggeredBy: text("triggered_by").notNull(), // manual, per_service, intake_copilot, benefit_screening, rag_service
  // Neural layer metrics
  neuralExtractionConfidence: real("neural_extraction_confidence"), // 0-1 confidence from LLM extraction
  neuralProcessingTimeMs: integer("neural_processing_time_ms"),
  extractedFactCount: integer("extracted_fact_count"),
  // Symbolic layer metrics  
  solverRunId: varchar("solver_run_id").references(() => solverRuns.id),
  solverResult: text("solver_result"), // SAT, UNSAT, UNKNOWN, ERROR
  solverTimeMs: integer("solver_time_ms"),
  constraintCount: integer("constraint_count"),
  // Ontology/TBox metrics
  ontologyTermsMatched: jsonb("ontology_terms_matched"), // Array of matched term IDs
  formalRulesEvaluated: jsonb("formal_rules_evaluated"), // Array of rule IDs used
  // UNSAT core analysis (for ineligible determinations)
  unsatCore: jsonb("unsat_core"), // Minimal unsatisfiable constraint set
  violatedRuleIds: jsonb("violated_rule_ids"), // Rules that were violated
  // Statutory grounding
  statutoryCitations: jsonb("statutory_citations"), // Array of citations backing the decision
  isLegallyGrounded: boolean("is_legally_grounded").default(false).notNull(),
  // Processing trace
  processingPath: jsonb("processing_path"), // Array of processing steps taken
  totalProcessingTimeMs: integer("total_processing_time_ms"),
  // Decision output
  determination: text("determination"), // eligible, ineligible, needs_review, error
  appealReady: boolean("appeal_ready").default(false),
  violationTraceCount: integer("violation_trace_count"),
  // Error tracking
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  // Tenant isolation
  tenantId: varchar("tenant_id"),
  userId: varchar("user_id").references(() => users.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  gatewayRunIdIdx: index("hybrid_gateway_audit_logs_gateway_run_id_idx").on(table.gatewayRunId),
  caseIdIdx: index("hybrid_gateway_audit_logs_case_id_idx").on(table.caseId),
  stateCodeIdx: index("hybrid_gateway_audit_logs_state_code_idx").on(table.stateCode),
  programCodeIdx: index("hybrid_gateway_audit_logs_program_code_idx").on(table.programCode),
  operationTypeIdx: index("hybrid_gateway_audit_logs_operation_type_idx").on(table.operationType),
  solverResultIdx: index("hybrid_gateway_audit_logs_solver_result_idx").on(table.solverResult),
  determinationIdx: index("hybrid_gateway_audit_logs_determination_idx").on(table.determination),
  isLegallyGroundedIdx: index("hybrid_gateway_audit_logs_is_legally_grounded_idx").on(table.isLegallyGrounded),
  tenantIdIdx: index("hybrid_gateway_audit_logs_tenant_id_idx").on(table.tenantId),
  createdAtIdx: index("hybrid_gateway_audit_logs_created_at_idx").on(table.createdAt),
}));

// Insert schemas for neuro-symbolic tables
export const insertStatutorySourceSchema = createInsertSchema(statutorySources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOntologyTermSchema = createInsertSchema(ontologyTerms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOntologyRelationshipSchema = createInsertSchema(ontologyRelationships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRuleFragmentSchema = createInsertSchema(ruleFragments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFormalRuleSchema = createInsertSchema(formalRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRuleExtractionLogSchema = createInsertSchema(ruleExtractionLogs).omit({
  id: true,
  createdAt: true,
});

export const insertCaseAssertionSchema = createInsertSchema(caseAssertions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExplanationClauseSchema = createInsertSchema(explanationClauses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSolverRunSchema = createInsertSchema(solverRuns).omit({
  id: true,
  createdAt: true,
});

export const insertViolationTraceSchema = createInsertSchema(violationTraces).omit({
  id: true,
  createdAt: true,
});

// Insert schemas for PER (Payment Error Reduction) tables
export const insertPerIncomeVerificationSchema = createInsertSchema(perIncomeVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerConsistencyCheckSchema = createInsertSchema(perConsistencyChecks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerDuplicateClaimSchema = createInsertSchema(perDuplicateClaims).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerCaseworkerNudgeSchema = createInsertSchema(perCaseworkerNudges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerPermSampleSchema = createInsertSchema(perPermSamples).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schema for hybrid gateway audit logs
export const insertHybridGatewayAuditLogSchema = createInsertSchema(hybridGatewayAuditLogs).omit({
  id: true,
  createdAt: true,
});

// Types for neuro-symbolic tables
export type StatutorySource = typeof statutorySources.$inferSelect;
export type InsertStatutorySource = z.infer<typeof insertStatutorySourceSchema>;
export type OntologyTerm = typeof ontologyTerms.$inferSelect;
export type InsertOntologyTerm = z.infer<typeof insertOntologyTermSchema>;
export type OntologyRelationship = typeof ontologyRelationships.$inferSelect;
export type InsertOntologyRelationship = z.infer<typeof insertOntologyRelationshipSchema>;
export type RuleFragment = typeof ruleFragments.$inferSelect;
export type InsertRuleFragment = z.infer<typeof insertRuleFragmentSchema>;
export type FormalRule = typeof formalRules.$inferSelect;
export type InsertFormalRule = z.infer<typeof insertFormalRuleSchema>;
export type RuleExtractionLog = typeof ruleExtractionLogs.$inferSelect;
export type InsertRuleExtractionLog = z.infer<typeof insertRuleExtractionLogSchema>;
export type CaseAssertion = typeof caseAssertions.$inferSelect;
export type InsertCaseAssertion = z.infer<typeof insertCaseAssertionSchema>;
export type ExplanationClause = typeof explanationClauses.$inferSelect;
export type InsertExplanationClause = z.infer<typeof insertExplanationClauseSchema>;
export type SolverRun = typeof solverRuns.$inferSelect;
export type InsertSolverRun = z.infer<typeof insertSolverRunSchema>;
export type ViolationTrace = typeof violationTraces.$inferSelect;
export type InsertViolationTrace = z.infer<typeof insertViolationTraceSchema>;

// Types for PER (Payment Error Reduction) tables
export type PerIncomeVerification = typeof perIncomeVerifications.$inferSelect;
export type InsertPerIncomeVerification = z.infer<typeof insertPerIncomeVerificationSchema>;
export type PerConsistencyCheck = typeof perConsistencyChecks.$inferSelect;
export type InsertPerConsistencyCheck = z.infer<typeof insertPerConsistencyCheckSchema>;
export type PerDuplicateClaim = typeof perDuplicateClaims.$inferSelect;
export type InsertPerDuplicateClaim = z.infer<typeof insertPerDuplicateClaimSchema>;
export type PerCaseworkerNudge = typeof perCaseworkerNudges.$inferSelect;
export type InsertPerCaseworkerNudge = z.infer<typeof insertPerCaseworkerNudgeSchema>;
export type PerPermSample = typeof perPermSamples.$inferSelect;
export type InsertPerPermSample = z.infer<typeof insertPerPermSampleSchema>;

// Types for hybrid gateway audit logs
export type HybridGatewayAuditLog = typeof hybridGatewayAuditLogs.$inferSelect;
export type InsertHybridGatewayAuditLog = z.infer<typeof insertHybridGatewayAuditLogSchema>;

// ============================================================================
// E&E Data Dictionary Tables (172 fields per PTIG specification)
// ============================================================================

// E&E Data Dictionary Field Definitions
export const eeDataDictionaryFields = pgTable("ee_data_dictionary_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  fieldLabel: varchar("field_label", { length: 255 }).notNull(),
  fieldDescription: text("field_description"),
  dataType: varchar("data_type", { length: 50 }).notNull(), // string, number, date, boolean, array
  category: varchar("category", { length: 100 }).notNull(), // demographics, address, income, deductions, program, verification
  subcategory: varchar("subcategory", { length: 100 }),
  isRequired: boolean("is_required").default(false),
  isEncrypted: boolean("is_encrypted").default(false), // For PII like SSN
  sourceSystem: varchar("source_system", { length: 100 }), // E&E, MD_SAIL, NDNH, etc.
  mappingExpression: text("mapping_expression"), // JSONPath or transformation expression
  validationRules: jsonb("validation_rules"), // JSON validation rules
  defaultValue: text("default_value"),
  displayOrder: integer("display_order"),
  stateCode: varchar("state_code", { length: 10 }).default('MD'),
  programCodes: text("program_codes").array(), // SNAP, MEDICAID, TANF, etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// E&E Field Mapping Configurations (per state/program)
export const eeFieldMappings = pgTable("ee_field_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldId: varchar("field_id").references(() => eeDataDictionaryFields.id),
  stateCode: varchar("state_code", { length: 10 }).notNull(),
  programCode: varchar("program_code", { length: 20 }).notNull(),
  sourceFieldName: varchar("source_field_name", { length: 100 }).notNull(),
  sourceTable: varchar("source_table", { length: 100 }),
  transformationLogic: text("transformation_logic"),
  validationQuery: text("validation_query"),
  lastSyncedAt: timestamp("last_synced_at"),
  syncStatus: varchar("sync_status", { length: 20 }).default('active'), // active, deprecated, error
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// E&E Individual Records (normalized storage)
export const eeIndividualRecords = pgTable("ee_individual_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualId: varchar("individual_id", { length: 50 }).notNull(),
  mdmId: varchar("mdm_id", { length: 50 }), // Master Data Management ID
  sourceSystem: varchar("source_system", { length: 50 }).notNull(),
  stateCode: varchar("state_code", { length: 10 }).notNull(),
  fieldValues: jsonb("field_values").notNull(), // JSON blob of all 172 field values
  dataQualityScore: real("data_quality_score"), // 0.0 to 1.0
  lastVerifiedAt: timestamp("last_verified_at"),
  verificationSource: varchar("verification_source", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// E&E Verification Results
export const eeVerificationResults = pgTable("ee_verification_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualRecordId: varchar("individual_record_id").references(() => eeIndividualRecords.id),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  verificationSource: varchar("verification_source", { length: 100 }).notNull(), // NDNH, state_wage_registry, employer_direct
  verifiedValue: text("verified_value"),
  reportedValue: text("reported_value"),
  discrepancyDetected: boolean("discrepancy_detected").default(false),
  discrepancyDetails: text("discrepancy_details"),
  confidenceLevel: varchar("confidence_level", { length: 20 }), // high, medium, low
  verifiedAt: timestamp("verified_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for E&E tables
export const insertEEDataDictionaryFieldSchema = createInsertSchema(eeDataDictionaryFields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEEFieldMappingSchema = createInsertSchema(eeFieldMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEEIndividualRecordSchema = createInsertSchema(eeIndividualRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEEVerificationResultSchema = createInsertSchema(eeVerificationResults).omit({
  id: true,
  createdAt: true,
});

// Types for E&E tables
export type EEDataDictionaryField = typeof eeDataDictionaryFields.$inferSelect;
export type InsertEEDataDictionaryField = z.infer<typeof insertEEDataDictionaryFieldSchema>;
export type EEFieldMapping = typeof eeFieldMappings.$inferSelect;
export type InsertEEFieldMapping = z.infer<typeof insertEEFieldMappingSchema>;
export type EEIndividualRecord = typeof eeIndividualRecords.$inferSelect;
export type InsertEEIndividualRecord = z.infer<typeof insertEEIndividualRecordSchema>;
export type EEVerificationResult = typeof eeVerificationResults.$inferSelect;
export type InsertEEVerificationResult = z.infer<typeof insertEEVerificationResultSchema>;

// ============================================================================
// E&E SYNTHETIC DATABASE - Complete 172-field representation for sidecar testing
// Based on Maryland E&E Data Dictionary (system simulation)
// ============================================================================

// E&E Synthetic Individuals - Fields 1-38 (Demographics, Names, Personal Info)
export const eeSyntheticIndividuals = pgTable("ee_synthetic_individuals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualId: varchar("individual_id", { length: 50 }).notNull().unique(),
  mdmId: varchar("mdm_id", { length: 50 }),
  sourceSystem: varchar("source_system", { length: 50 }).default("E&E"),
  ssn: varchar("ssn", { length: 11 }),
  dateOfBirth: date("date_of_birth"),
  birthStateCode: varchar("birth_state_code", { length: 2 }),
  birthState: varchar("birth_state", { length: 50 }),
  deathDate: date("death_date"),
  deathState: varchar("death_state", { length: 50 }),
  deathStateCode: varchar("death_state_code", { length: 2 }),
  domesticViolenceInd: boolean("domestic_violence_ind").default(false),
  effectiveBeginDate: date("effective_begin_date"),
  effectiveEndDate: date("effective_end_date"),
  genderCode: varchar("gender_code", { length: 1 }),
  gender: varchar("gender", { length: 20 }),
  raceCode: varchar("race_code", { length: 2 }),
  race: varchar("race", { length: 50 }),
  ethnicityCode: varchar("ethnicity_code", { length: 1 }),
  ethnicity: varchar("ethnicity", { length: 50 }),
  citizenshipStatusCode: varchar("citizenship_status_code", { length: 10 }),
  citizenship: varchar("citizenship", { length: 50 }),
  countryOfOriginCode: varchar("country_of_origin_code", { length: 3 }),
  countryOfOrigin: varchar("country_of_origin", { length: 100 }),
  maritalStatusInd: varchar("marital_status_ind", { length: 10 }),
  maritalStatus: varchar("marital_status", { length: 30 }),
  ssnVerificationSourceCode: varchar("ssn_verification_source_code", { length: 10 }),
  ssnVerificationSource: varchar("ssn_verification_source", { length: 100 }),
  ssnVerificationIndicator: boolean("ssn_verification_indicator"),
  hearingImpairedIndicator: boolean("hearing_impaired_indicator").default(false),
  preferredLanguageCode: varchar("preferred_language_code", { length: 10 }),
  preferredLanguage: varchar("preferred_language", { length: 50 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  middleName: varchar("middle_name", { length: 100 }),
  suffixCode: varchar("suffix_code", { length: 10 }),
  suffix: varchar("suffix", { length: 20 }),
  nameEffectiveBeginDate: date("name_effective_begin_date"),
  nameEffectiveEndDate: date("name_effective_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  individualIdIdx: index("ee_synth_ind_individual_id_idx").on(table.individualId),
  mdmIdIdx: index("ee_synth_ind_mdm_id_idx").on(table.mdmId),
  ssnIdx: index("ee_synth_ind_ssn_idx").on(table.ssn),
  nameIdx: index("ee_synth_ind_name_idx").on(table.lastName, table.firstName),
}));

// E&E Synthetic Contacts - Fields 39-86 (Business, Personal, Other contact details, Employer, Emergency, Authorized Rep)
export const eeSyntheticContacts = pgTable("ee_synthetic_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualId: varchar("individual_id", { length: 50 }).notNull(),
  caseNumber: varchar("case_number", { length: 50 }),
  contactType: varchar("contact_type", { length: 20 }).notNull(), // business, personal, other, employer, emergency, authorized_rep
  phoneNumber: varchar("phone_number", { length: 20 }),
  phoneNumberExt: varchar("phone_number_ext", { length: 10 }),
  phoneNumberTypeCode: varchar("phone_number_type_code", { length: 10 }),
  phoneType: varchar("phone_type", { length: 30 }),
  altPhoneNumber: varchar("alt_phone_number", { length: 20 }),
  altPhoneNumberExt: varchar("alt_phone_number_ext", { length: 10 }),
  altPhoneNumberTypeCode: varchar("alt_phone_number_type_code", { length: 10 }),
  altPhoneType: varchar("alt_phone_type", { length: 30 }),
  faxNumber: varchar("fax_number", { length: 20 }),
  commModeCode: varchar("comm_mode_code", { length: 10 }),
  communicationMode: varchar("communication_mode", { length: 30 }),
  commPrefTimeCode: varchar("comm_pref_time_code", { length: 10 }),
  commPrefTime: varchar("comm_pref_time", { length: 50 }),
  email: varchar("email", { length: 255 }),
  emailVerified: boolean("email_verified").default(false),
  textMessageOptIn: boolean("text_message_opt_in").default(false),
  employerName: varchar("employer_name", { length: 255 }),
  employerAddressLine1: varchar("employer_address_line_1", { length: 255 }),
  employerAddressLine2: varchar("employer_address_line_2", { length: 255 }),
  employerCity: varchar("employer_city", { length: 100 }),
  employerStateCode: varchar("employer_state_code", { length: 2 }),
  employerZipCode: varchar("employer_zip_code", { length: 10 }),
  employerPhone: varchar("employer_phone", { length: 20 }),
  employerFein: varchar("employer_fein", { length: 20 }),
  emergencyContactName: varchar("emergency_contact_name", { length: 255 }),
  emergencyContactRelationship: varchar("emergency_contact_relationship", { length: 50 }),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),
  authorizedRepName: varchar("authorized_rep_name", { length: 255 }),
  authorizedRepRelationship: varchar("authorized_rep_relationship", { length: 50 }),
  authorizedRepPhone: varchar("authorized_rep_phone", { length: 20 }),
  authorizedRepAddressLine1: varchar("authorized_rep_address_line_1", { length: 255 }),
  authorizedRepCity: varchar("authorized_rep_city", { length: 100 }),
  authorizedRepStateCode: varchar("authorized_rep_state_code", { length: 2 }),
  authorizedRepZipCode: varchar("authorized_rep_zip_code", { length: 10 }),
  authorizedRepTypeCode: varchar("authorized_rep_type_code", { length: 10 }),
  authorizedRepType: varchar("authorized_rep_type", { length: 50 }),
  effectiveBeginDate: date("effective_begin_date"),
  effectiveEndDate: date("effective_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  individualIdIdx: index("ee_synth_contacts_individual_id_idx").on(table.individualId),
  caseNumberIdx: index("ee_synth_contacts_case_number_idx").on(table.caseNumber),
  contactTypeIdx: index("ee_synth_contacts_type_idx").on(table.contactType),
}));

// E&E Synthetic Addresses - Fields 87-128 (Residential, Mailing, Other, Shelter, Homeless addresses)
export const eeSyntheticAddresses = pgTable("ee_synthetic_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualId: varchar("individual_id", { length: 50 }).notNull(),
  caseNumber: varchar("case_number", { length: 50 }),
  addressType: varchar("address_type", { length: 20 }).notNull(), // residential, mailing, shelter, homeless, temporary
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  addressLine3: varchar("address_line_3", { length: 255 }),
  city: varchar("city", { length: 100 }),
  countyCode: varchar("county_code", { length: 3 }),
  county: varchar("county", { length: 100 }),
  stateCode: varchar("state_code", { length: 2 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 5 }),
  zip4Code: varchar("zip_4_code", { length: 4 }),
  countryCode: varchar("country_code", { length: 3 }),
  country: varchar("country", { length: 100 }),
  homelessIndicator: boolean("homeless_indicator").default(false),
  homelessTypeCode: varchar("homeless_type_code", { length: 10 }),
  homelessType: varchar("homeless_type", { length: 50 }),
  shelterName: varchar("shelter_name", { length: 255 }),
  shelterPhone: varchar("shelter_phone", { length: 20 }),
  shelterContactName: varchar("shelter_contact_name", { length: 255 }),
  addressVerificationCode: varchar("address_verification_code", { length: 10 }),
  addressVerificationStatus: varchar("address_verification_status", { length: 30 }),
  addressVerificationDate: date("address_verification_date"),
  addressVerificationSource: varchar("address_verification_source", { length: 50 }),
  residencyStartDate: date("residency_start_date"),
  residencyEndDate: date("residency_end_date"),
  ldssServiceAreaCode: varchar("ldss_service_area_code", { length: 20 }),
  ldssServiceArea: varchar("ldss_service_area", { length: 100 }),
  congressionalDistrict: varchar("congressional_district", { length: 10 }),
  legislativeDistrict: varchar("legislative_district", { length: 10 }),
  censusTrack: varchar("census_track", { length: 20 }),
  censusBlockGroup: varchar("census_block_group", { length: 20 }),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  isPrimaryResidence: boolean("is_primary_residence").default(true),
  isMailingAddress: boolean("is_mailing_address").default(false),
  effectiveBeginDate: date("effective_begin_date"),
  effectiveEndDate: date("effective_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  individualIdIdx: index("ee_synth_addr_individual_id_idx").on(table.individualId),
  caseNumberIdx: index("ee_synth_addr_case_number_idx").on(table.caseNumber),
  addressTypeIdx: index("ee_synth_addr_type_idx").on(table.addressType),
  countyCodeIdx: index("ee_synth_addr_county_code_idx").on(table.countyCode),
  zipCodeIdx: index("ee_synth_addr_zip_code_idx").on(table.zipCode),
  homelessIdx: index("ee_synth_addr_homeless_idx").on(table.homelessIndicator),
  ldssServiceAreaIdx: index("ee_synth_addr_ldss_area_idx").on(table.ldssServiceAreaCode),
}));

// E&E Synthetic Identification - Fields 129-136 (IRN, MA ID, PIN, Passport, Alien Number)
export const eeSyntheticIdentification = pgTable("ee_synthetic_identification", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualId: varchar("individual_id", { length: 50 }).notNull(),
  mdmId: varchar("mdm_id", { length: 50 }),
  irn: varchar("irn", { length: 9 }),
  maId: varchar("ma_id", { length: 50 }),
  maIdSuffix: varchar("ma_id_suffix", { length: 10 }),
  pin: varchar("pin", { length: 20 }),
  passportNumber: varchar("passport_number", { length: 50 }),
  alienNumber: varchar("alien_number", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  individualIdIdx: index("ee_synth_ident_individual_id_idx").on(table.individualId),
  irnIdx: index("ee_synth_ident_irn_idx").on(table.irn),
  maIdIdx: index("ee_synth_ident_ma_id_idx").on(table.maId),
}));

// E&E Synthetic Cases - Fields 137-147 (Case information, HOH, Status, LDSS)
export const eeSyntheticCases = pgTable("ee_synthetic_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseNumber: varchar("case_number", { length: 50 }).notNull().unique(),
  hohIndividualId: varchar("hoh_individual_id", { length: 50 }).notNull(),
  hohIndicator: boolean("hoh_indicator").default(true),
  caseStatusCode: varchar("case_status_code", { length: 10 }),
  caseStatus: varchar("case_status", { length: 30 }),
  caseModeCode: varchar("case_mode_code", { length: 10 }),
  caseMode: varchar("case_mode", { length: 30 }),
  effectiveBeginDate: date("effective_begin_date"),
  effectiveEndDate: date("effective_end_date"),
  ldssCode: varchar("ldss_code", { length: 20 }),
  districtOffice: varchar("district_office", { length: 100 }),
  householdSize: integer("household_size").default(1),
  monthlyIncome: integer("monthly_income"),
  monthlyExpenses: integer("monthly_expenses"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  caseNumberIdx: index("ee_synth_cases_case_number_idx").on(table.caseNumber),
  hohIndividualIdIdx: index("ee_synth_cases_hoh_idx").on(table.hohIndividualId),
  caseStatusIdx: index("ee_synth_cases_status_idx").on(table.caseStatus),
  ldssCodeIdx: index("ee_synth_cases_ldss_idx").on(table.ldssCode),
}));

// E&E Synthetic Program Enrollments - Fields 148-160 (Programs, status, workers)
export const eeSyntheticProgramEnrollments = pgTable("ee_synthetic_program_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualId: varchar("individual_id", { length: 50 }).notNull(),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  programCode: varchar("program_code", { length: 20 }).notNull(),
  programName: varchar("program_name", { length: 100 }),
  coverageGroupCode: varchar("coverage_group_code", { length: 20 }),
  programStatusCode: varchar("program_status_code", { length: 10 }),
  programStatus: varchar("program_status", { length: 30 }),
  effectiveBeginDate: date("effective_begin_date"),
  effectiveEndDate: date("effective_end_date"),
  ldssCode: varchar("ldss_code", { length: 20 }),
  districtOffice: varchar("district_office", { length: 100 }),
  worker: varchar("worker", { length: 100 }),
  supervisor: varchar("supervisor", { length: 100 }),
  monthlyBenefitAmount: integer("monthly_benefit_amount"),
  certificationPeriodEnd: date("certification_period_end"),
  redeterminationDue: date("redetermination_due"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  individualIdIdx: index("ee_synth_prog_individual_id_idx").on(table.individualId),
  caseNumberIdx: index("ee_synth_prog_case_number_idx").on(table.caseNumber),
  programCodeIdx: index("ee_synth_prog_program_code_idx").on(table.programCode),
  programStatusIdx: index("ee_synth_prog_status_idx").on(table.programStatus),
  ldssCodeIdx: index("ee_synth_prog_ldss_idx").on(table.ldssCode),
}));

// E&E Synthetic Providers - Fields 161-172 (Provider details)
export const eeSyntheticProviders = pgTable("ee_synthetic_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualId: varchar("individual_id", { length: 50 }),
  providerId: varchar("provider_id", { length: 50 }).notNull(),
  providerName: varchar("provider_name", { length: 255 }),
  providerAddressLine1: varchar("provider_address_line_1", { length: 255 }),
  providerAddressLine2: varchar("provider_address_line_2", { length: 255 }),
  providerCity: varchar("provider_city", { length: 100 }),
  providerStateCode: varchar("provider_state_code", { length: 2 }),
  providerState: varchar("provider_state", { length: 50 }),
  providerZipcode: varchar("provider_zipcode", { length: 10 }),
  effectiveBeginDate: date("effective_begin_date"),
  effectiveEndDate: date("effective_end_date"),
  systemId: varchar("system_id", { length: 50 }).default("E&E"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerIdIdx: index("ee_synth_prov_provider_id_idx").on(table.providerId),
  individualIdIdx: index("ee_synth_prov_individual_id_idx").on(table.individualId),
}));

// E&E Synthetic Case Closures - For churn analysis testing (from SNAP Churn Analysis)
export const eeSyntheticCaseClosures = pgTable("ee_synthetic_case_closures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  programCode: varchar("program_code", { length: 20 }).notNull(),
  closureDate: date("closure_date").notNull(),
  closureReasonCode: varchar("closure_reason_code", { length: 20 }),
  closureReason: varchar("closure_reason", { length: 255 }),
  closureCategory: varchar("closure_category", { length: 50 }),
  ldssCode: varchar("ldss_code", { length: 20 }),
  regionCode: varchar("region_code", { length: 20 }),
  fiscalMonth: varchar("fiscal_month", { length: 7 }),
  wasChurn: boolean("was_churn").default(false),
  daysUntilReopen: integer("days_until_reopen"),
  reopenedCaseNumber: varchar("reopened_case_number", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  caseNumberIdx: index("ee_synth_closure_case_number_idx").on(table.caseNumber),
  programCodeIdx: index("ee_synth_closure_program_code_idx").on(table.programCode),
  closureDateIdx: index("ee_synth_closure_date_idx").on(table.closureDate),
  closureReasonIdx: index("ee_synth_closure_reason_idx").on(table.closureReasonCode),
  ldssCodeIdx: index("ee_synth_closure_ldss_idx").on(table.ldssCode),
  fiscalMonthIdx: index("ee_synth_closure_fiscal_month_idx").on(table.fiscalMonth),
}));

// E&E Synthetic Case Members - Link individuals to cases (household composition)
export const eeSyntheticCaseMembers = pgTable("ee_synthetic_case_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  individualId: varchar("individual_id", { length: 50 }).notNull(),
  relationshipToHoh: varchar("relationship_to_hoh", { length: 50 }),
  isHoh: boolean("is_hoh").default(false),
  isApplicant: boolean("is_applicant").default(false),
  memberStatusCode: varchar("member_status_code", { length: 10 }),
  memberStatus: varchar("member_status", { length: 30 }),
  effectiveBeginDate: date("effective_begin_date"),
  effectiveEndDate: date("effective_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  caseNumberIdx: index("ee_synth_member_case_number_idx").on(table.caseNumber),
  individualIdIdx: index("ee_synth_member_individual_id_idx").on(table.individualId),
}));

// E&E Synthetic Income - Employment, self-employment, unearned income sources
export const eeSyntheticIncome = pgTable("ee_synthetic_income", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualId: varchar("individual_id", { length: 50 }).notNull(),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  incomeTypeCode: varchar("income_type_code", { length: 20 }).notNull(),
  incomeType: varchar("income_type", { length: 100 }),
  incomeSourceCode: varchar("income_source_code", { length: 20 }),
  incomeSource: varchar("income_source", { length: 100 }),
  employerName: varchar("employer_name", { length: 255 }),
  employerFein: varchar("employer_fein", { length: 20 }),
  employerAddressLine1: varchar("employer_address_line_1", { length: 255 }),
  employerCity: varchar("employer_city", { length: 100 }),
  employerStateCode: varchar("employer_state_code", { length: 2 }),
  employerZipCode: varchar("employer_zip_code", { length: 10 }),
  employerPhone: varchar("employer_phone", { length: 20 }),
  jobTitle: varchar("job_title", { length: 100 }),
  employmentStatusCode: varchar("employment_status_code", { length: 10 }),
  employmentStatus: varchar("employment_status", { length: 50 }),
  hoursPerWeek: integer("hours_per_week"),
  payFrequencyCode: varchar("pay_frequency_code", { length: 10 }),
  payFrequency: varchar("pay_frequency", { length: 30 }),
  grossAmount: integer("gross_amount"),
  netAmount: integer("net_amount"),
  monthlyGross: integer("monthly_gross"),
  monthlyNet: integer("monthly_net"),
  annualGross: integer("annual_gross"),
  selfEmploymentIndicator: boolean("self_employment_indicator").default(false),
  selfEmploymentExpenses: integer("self_employment_expenses"),
  seasonalIndicator: boolean("seasonal_indicator").default(false),
  variableIncomeIndicator: boolean("variable_income_indicator").default(false),
  verificationStatusCode: varchar("verification_status_code", { length: 10 }),
  verificationStatus: varchar("verification_status", { length: 50 }),
  verificationDate: date("verification_date"),
  verificationSource: varchar("verification_source", { length: 100 }),
  ndnhVerified: boolean("ndnh_verified").default(false),
  swicaVerified: boolean("swica_verified").default(false),
  wageRecordDate: date("wage_record_date"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  effectiveBeginDate: date("effective_begin_date"),
  effectiveEndDate: date("effective_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  individualIdIdx: index("ee_synth_income_individual_id_idx").on(table.individualId),
  caseNumberIdx: index("ee_synth_income_case_number_idx").on(table.caseNumber),
  incomeTypeIdx: index("ee_synth_income_type_idx").on(table.incomeTypeCode),
  employerFeinIdx: index("ee_synth_income_employer_fein_idx").on(table.employerFein),
  verificationIdx: index("ee_synth_income_verification_idx").on(table.verificationStatusCode),
}));

// E&E Synthetic Resources - Countable assets for SNAP eligibility
export const eeSyntheticResources = pgTable("ee_synthetic_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualId: varchar("individual_id", { length: 50 }).notNull(),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  resourceTypeCode: varchar("resource_type_code", { length: 20 }).notNull(),
  resourceType: varchar("resource_type", { length: 100 }),
  resourceDescription: varchar("resource_description", { length: 500 }),
  accountNumber: varchar("account_number", { length: 100 }),
  institutionName: varchar("institution_name", { length: 255 }),
  institutionAddressLine1: varchar("institution_address_line_1", { length: 255 }),
  institutionCity: varchar("institution_city", { length: 100 }),
  institutionStateCode: varchar("institution_state_code", { length: 2 }),
  institutionZipCode: varchar("institution_zip_code", { length: 10 }),
  currentValue: integer("current_value"),
  fairMarketValue: integer("fair_market_value"),
  encumbrance: integer("encumbrance"),
  countableValue: integer("countable_value"),
  ownershipTypeCode: varchar("ownership_type_code", { length: 10 }),
  ownershipType: varchar("ownership_type", { length: 50 }),
  ownershipPercentage: integer("ownership_percentage"),
  isCountable: boolean("is_countable").default(true),
  isExempt: boolean("is_exempt").default(false),
  exemptionReasonCode: varchar("exemption_reason_code", { length: 20 }),
  exemptionReason: varchar("exemption_reason", { length: 255 }),
  vehicleYear: varchar("vehicle_year", { length: 4 }),
  vehicleMake: varchar("vehicle_make", { length: 50 }),
  vehicleModel: varchar("vehicle_model", { length: 50 }),
  vehicleVin: varchar("vehicle_vin", { length: 20 }),
  vehicleUseCode: varchar("vehicle_use_code", { length: 10 }),
  vehicleUse: varchar("vehicle_use", { length: 50 }),
  propertyAddressLine1: varchar("property_address_line_1", { length: 255 }),
  propertyCity: varchar("property_city", { length: 100 }),
  propertyStateCode: varchar("property_state_code", { length: 2 }),
  propertyZipCode: varchar("property_zip_code", { length: 10 }),
  propertyTypeCode: varchar("property_type_code", { length: 10 }),
  propertyType: varchar("property_type", { length: 50 }),
  verificationStatusCode: varchar("verification_status_code", { length: 10 }),
  verificationStatus: varchar("verification_status", { length: 50 }),
  verificationDate: date("verification_date"),
  verificationSource: varchar("verification_source", { length: 100 }),
  effectiveBeginDate: date("effective_begin_date"),
  effectiveEndDate: date("effective_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  individualIdIdx: index("ee_synth_resources_individual_id_idx").on(table.individualId),
  caseNumberIdx: index("ee_synth_resources_case_number_idx").on(table.caseNumber),
  resourceTypeIdx: index("ee_synth_resources_type_idx").on(table.resourceTypeCode),
  countableIdx: index("ee_synth_resources_countable_idx").on(table.isCountable),
}));

// E&E Synthetic Expenses - Shelter, medical, childcare, utility deductions
export const eeSyntheticExpenses = pgTable("ee_synthetic_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualId: varchar("individual_id", { length: 50 }).notNull(),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  expenseTypeCode: varchar("expense_type_code", { length: 20 }).notNull(),
  expenseType: varchar("expense_type", { length: 100 }),
  expenseCategoryCode: varchar("expense_category_code", { length: 20 }),
  expenseCategory: varchar("expense_category", { length: 100 }),
  payeeName: varchar("payee_name", { length: 255 }),
  payeeAddressLine1: varchar("payee_address_line_1", { length: 255 }),
  payeeCity: varchar("payee_city", { length: 100 }),
  payeeStateCode: varchar("payee_state_code", { length: 2 }),
  payeeZipCode: varchar("payee_zip_code", { length: 10 }),
  payeePhone: varchar("payee_phone", { length: 20 }),
  monthlyAmount: integer("monthly_amount"),
  annualAmount: integer("annual_amount"),
  frequencyCode: varchar("frequency_code", { length: 10 }),
  frequency: varchar("frequency", { length: 30 }),
  actualAmount: integer("actual_amount"),
  standardUtilityAllowanceCode: varchar("sua_code", { length: 10 }),
  standardUtilityAllowance: varchar("sua", { length: 100 }),
  suaType: varchar("sua_type", { length: 50 }),
  rentMortgageAmount: integer("rent_mortgage_amount"),
  propertyTaxAmount: integer("property_tax_amount"),
  insuranceAmount: integer("insurance_amount"),
  heatingFuelType: varchar("heating_fuel_type", { length: 50 }),
  coolingIndicator: boolean("cooling_indicator").default(false),
  phoneIndicator: boolean("phone_indicator").default(false),
  electricIndicator: boolean("electric_indicator").default(false),
  gasIndicator: boolean("gas_indicator").default(false),
  waterSewerIndicator: boolean("water_sewer_indicator").default(false),
  trashIndicator: boolean("trash_indicator").default(false),
  medicalExpenseType: varchar("medical_expense_type", { length: 100 }),
  medicalProviderName: varchar("medical_provider_name", { length: 255 }),
  dependentCareProviderName: varchar("dependent_care_provider_name", { length: 255 }),
  dependentCareProviderType: varchar("dependent_care_provider_type", { length: 50 }),
  childSupportObligationAmount: integer("child_support_obligation_amount"),
  childSupportCourtOrderNumber: varchar("child_support_court_order_number", { length: 50 }),
  verificationStatusCode: varchar("verification_status_code", { length: 10 }),
  verificationStatus: varchar("verification_status", { length: 50 }),
  verificationDate: date("verification_date"),
  verificationSource: varchar("verification_source", { length: 100 }),
  effectiveBeginDate: date("effective_begin_date"),
  effectiveEndDate: date("effective_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  individualIdIdx: index("ee_synth_expenses_individual_id_idx").on(table.individualId),
  caseNumberIdx: index("ee_synth_expenses_case_number_idx").on(table.caseNumber),
  expenseTypeIdx: index("ee_synth_expenses_type_idx").on(table.expenseTypeCode),
  categoryIdx: index("ee_synth_expenses_category_idx").on(table.expenseCategoryCode),
}));

// E&E Synthetic Verifications - Document verification tracking
export const eeSyntheticVerifications = pgTable("ee_synthetic_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualId: varchar("individual_id", { length: 50 }).notNull(),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  verificationTypeCode: varchar("verification_type_code", { length: 20 }).notNull(),
  verificationType: varchar("verification_type", { length: 100 }),
  verificationCategoryCode: varchar("verification_category_code", { length: 20 }),
  verificationCategory: varchar("verification_category", { length: 100 }),
  documentTypeCode: varchar("document_type_code", { length: 20 }),
  documentType: varchar("document_type", { length: 100 }),
  documentDescription: varchar("document_description", { length: 500 }),
  documentNumber: varchar("document_number", { length: 100 }),
  issuingAuthority: varchar("issuing_authority", { length: 255 }),
  issueDate: date("issue_date"),
  expirationDate: date("expiration_date"),
  verificationStatusCode: varchar("verification_status_code", { length: 10 }),
  verificationStatus: varchar("verification_status", { length: 50 }),
  verificationDate: date("verification_date"),
  verifiedBy: varchar("verified_by", { length: 100 }),
  verificationMethod: varchar("verification_method", { length: 50 }),
  verificationSource: varchar("verification_source", { length: 100 }),
  electronicVerificationCode: varchar("electronic_verification_code", { length: 20 }),
  electronicVerification: varchar("electronic_verification", { length: 100 }),
  ssnVerificationSource: varchar("ssn_verification_source", { length: 50 }),
  ssnVerificationDate: date("ssn_verification_date"),
  identityVerificationSource: varchar("identity_verification_source", { length: 50 }),
  identityVerificationDate: date("identity_verification_date"),
  citizenshipVerificationSource: varchar("citizenship_verification_source", { length: 50 }),
  citizenshipVerificationDate: date("citizenship_verification_date"),
  incomeVerificationSource: varchar("income_verification_source", { length: 50 }),
  incomeVerificationDate: date("income_verification_date"),
  residencyVerificationSource: varchar("residency_verification_source", { length: 50 }),
  residencyVerificationDate: date("residency_verification_date"),
  wasPending: boolean("was_pending").default(false),
  pendingReasonCode: varchar("pending_reason_code", { length: 20 }),
  pendingReason: varchar("pending_reason", { length: 255 }),
  dueDate: date("due_date"),
  receivedDate: date("received_date"),
  notes: text("notes"),
  effectiveBeginDate: date("effective_begin_date"),
  effectiveEndDate: date("effective_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  individualIdIdx: index("ee_synth_verif_individual_id_idx").on(table.individualId),
  caseNumberIdx: index("ee_synth_verif_case_number_idx").on(table.caseNumber),
  verificationTypeIdx: index("ee_synth_verif_type_idx").on(table.verificationTypeCode),
  statusIdx: index("ee_synth_verif_status_idx").on(table.verificationStatusCode),
  pendingIdx: index("ee_synth_verif_pending_idx").on(table.wasPending),
}));

// E&E Synthetic ABAWD - Able-Bodied Adults Without Dependents work requirement tracking
export const eeSyntheticAbawd = pgTable("ee_synthetic_abawd", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  individualId: varchar("individual_id", { length: 50 }).notNull(),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  abawdStatusCode: varchar("abawd_status_code", { length: 10 }),
  abawdStatus: varchar("abawd_status", { length: 50 }),
  isAbawd: boolean("is_abawd").default(false),
  isExempt: boolean("is_exempt").default(false),
  exemptionReasonCode: varchar("exemption_reason_code", { length: 20 }),
  exemptionReason: varchar("exemption_reason", { length: 255 }),
  exemptionStartDate: date("exemption_start_date"),
  exemptionEndDate: date("exemption_end_date"),
  workRequirementMonthsUsed: integer("work_requirement_months_used").default(0),
  workRequirementMonthsRemaining: integer("work_requirement_months_remaining"),
  workRequirementPeriodStart: date("work_requirement_period_start"),
  workRequirementPeriodEnd: date("work_requirement_period_end"),
  countableMonthsIn36: integer("countable_months_in_36").default(0),
  lastCountableMonth: varchar("last_countable_month", { length: 7 }),
  workHoursPerWeek: integer("work_hours_per_week"),
  workProgramCode: varchar("work_program_code", { length: 20 }),
  workProgram: varchar("work_program", { length: 100 }),
  workProgramEnrollmentDate: date("work_program_enrollment_date"),
  workProgramCompletionDate: date("work_program_completion_date"),
  workProgramStatusCode: varchar("work_program_status_code", { length: 10 }),
  workProgramStatus: varchar("work_program_status", { length: 50 }),
  volunteerHoursPerMonth: integer("volunteer_hours_per_month"),
  volunteerOrganization: varchar("volunteer_organization", { length: 255 }),
  workfareParticipant: boolean("workfare_participant").default(false),
  workfareHoursRequired: integer("workfare_hours_required"),
  workfareHoursCompleted: integer("workfare_hours_completed"),
  goodCauseExemptionCode: varchar("good_cause_exemption_code", { length: 20 }),
  goodCauseExemption: varchar("good_cause_exemption", { length: 255 }),
  goodCauseStartDate: date("good_cause_start_date"),
  goodCauseEndDate: date("good_cause_end_date"),
  sanctionIndicator: boolean("sanction_indicator").default(false),
  sanctionStartDate: date("sanction_start_date"),
  sanctionEndDate: date("sanction_end_date"),
  sanctionReasonCode: varchar("sanction_reason_code", { length: 20 }),
  sanctionReason: varchar("sanction_reason", { length: 255 }),
  waiverCountyIndicator: boolean("waiver_county_indicator").default(false),
  waiverTypeCode: varchar("waiver_type_code", { length: 20 }),
  waiverType: varchar("waiver_type", { length: 100 }),
  effectiveBeginDate: date("effective_begin_date"),
  effectiveEndDate: date("effective_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  individualIdIdx: index("ee_synth_abawd_individual_id_idx").on(table.individualId),
  caseNumberIdx: index("ee_synth_abawd_case_number_idx").on(table.caseNumber),
  abawdStatusIdx: index("ee_synth_abawd_status_idx").on(table.abawdStatusCode),
  exemptIdx: index("ee_synth_abawd_exempt_idx").on(table.isExempt),
  sanctionIdx: index("ee_synth_abawd_sanction_idx").on(table.sanctionIndicator),
}));

// Insert schemas for E&E Synthetic tables
export const insertEESyntheticIndividualSchema = createInsertSchema(eeSyntheticIndividuals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEESyntheticContactSchema = createInsertSchema(eeSyntheticContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEESyntheticAddressSchema = createInsertSchema(eeSyntheticAddresses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEESyntheticIdentificationSchema = createInsertSchema(eeSyntheticIdentification).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEESyntheticCaseSchema = createInsertSchema(eeSyntheticCases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEESyntheticProgramEnrollmentSchema = createInsertSchema(eeSyntheticProgramEnrollments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEESyntheticProviderSchema = createInsertSchema(eeSyntheticProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEESyntheticCaseClosureSchema = createInsertSchema(eeSyntheticCaseClosures).omit({
  id: true,
  createdAt: true,
});

export const insertEESyntheticCaseMemberSchema = createInsertSchema(eeSyntheticCaseMembers).omit({
  id: true,
  createdAt: true,
});

export const insertEESyntheticIncomeSchema = createInsertSchema(eeSyntheticIncome).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEESyntheticResourceSchema = createInsertSchema(eeSyntheticResources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEESyntheticExpenseSchema = createInsertSchema(eeSyntheticExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEESyntheticVerificationSchema = createInsertSchema(eeSyntheticVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEESyntheticAbawdSchema = createInsertSchema(eeSyntheticAbawd).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for E&E Synthetic tables
export type EESyntheticIndividual = typeof eeSyntheticIndividuals.$inferSelect;
export type InsertEESyntheticIndividual = z.infer<typeof insertEESyntheticIndividualSchema>;
export type EESyntheticContact = typeof eeSyntheticContacts.$inferSelect;
export type InsertEESyntheticContact = z.infer<typeof insertEESyntheticContactSchema>;
export type EESyntheticAddress = typeof eeSyntheticAddresses.$inferSelect;
export type InsertEESyntheticAddress = z.infer<typeof insertEESyntheticAddressSchema>;
export type EESyntheticIdentification = typeof eeSyntheticIdentification.$inferSelect;
export type InsertEESyntheticIdentification = z.infer<typeof insertEESyntheticIdentificationSchema>;
export type EESyntheticCase = typeof eeSyntheticCases.$inferSelect;
export type InsertEESyntheticCase = z.infer<typeof insertEESyntheticCaseSchema>;
export type EESyntheticProgramEnrollment = typeof eeSyntheticProgramEnrollments.$inferSelect;
export type InsertEESyntheticProgramEnrollment = z.infer<typeof insertEESyntheticProgramEnrollmentSchema>;
export type EESyntheticProvider = typeof eeSyntheticProviders.$inferSelect;
export type InsertEESyntheticProvider = z.infer<typeof insertEESyntheticProviderSchema>;
export type EESyntheticCaseClosure = typeof eeSyntheticCaseClosures.$inferSelect;
export type InsertEESyntheticCaseClosure = z.infer<typeof insertEESyntheticCaseClosureSchema>;
export type EESyntheticCaseMember = typeof eeSyntheticCaseMembers.$inferSelect;
export type InsertEESyntheticCaseMember = z.infer<typeof insertEESyntheticCaseMemberSchema>;
export type EESyntheticIncome = typeof eeSyntheticIncome.$inferSelect;
export type InsertEESyntheticIncome = z.infer<typeof insertEESyntheticIncomeSchema>;
export type EESyntheticResource = typeof eeSyntheticResources.$inferSelect;
export type InsertEESyntheticResource = z.infer<typeof insertEESyntheticResourceSchema>;
export type EESyntheticExpense = typeof eeSyntheticExpenses.$inferSelect;
export type InsertEESyntheticExpense = z.infer<typeof insertEESyntheticExpenseSchema>;
export type EESyntheticVerification = typeof eeSyntheticVerifications.$inferSelect;
export type InsertEESyntheticVerification = z.infer<typeof insertEESyntheticVerificationSchema>;
export type EESyntheticAbawd = typeof eeSyntheticAbawd.$inferSelect;
export type InsertEESyntheticAbawd = z.infer<typeof insertEESyntheticAbawdSchema>;

// Export tax return tables from taxReturnSchema
// COMMENTED OUT DURING SCHEMA ROLLBACK - taxReturnSchema.ts moved to backup
// export * from './taxReturnSchema';
