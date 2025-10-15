import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean, uuid, real, index, date } from "drizzle-orm/pg-core";
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
  tenantId: varchar("tenant_id").references((): any => tenants.id), // References tenant for data isolation
  // Maryland DHS staff fields
  dhsEmployeeId: text("dhs_employee_id"), // for navigators and caseworkers
  officeLocation: text("office_location"), // local DHS office location
  // IRS VITA certification tracking (for tax preparation quality review)
  vitaCertificationLevel: text("vita_certification_level"), // basic, advanced, military, none
  vitaCertificationDate: timestamp("vita_certification_date"), // when certification was earned
  vitaCertificationExpiry: timestamp("vita_certification_expiry"), // expiration date (typically Dec 31 annually)
  vitaCertificationNumber: text("vita_certification_number"), // IRS-issued certification ID
  isActive: boolean("is_active").default(true).notNull(),
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
  tenantId: varchar("tenant_id").references((): any => tenants.id), // Multi-tenant isolation
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
  syncType: text("sync_type").notNull(), // manual, api, web_scraping
  syncSchedule: text("sync_schedule"), // off, daily, weekly, monthly
  maxAllowedFrequency: text("max_allowed_frequency"), // Maximum frequency admin can set (daily, weekly, monthly)
  syncConfig: jsonb("sync_config"), // configuration for automated sync
  lastSyncAt: timestamp("last_sync_at"),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at"),
  syncStatus: text("sync_status").default("idle"), // idle, syncing, success, error
  syncError: text("sync_error"),
  documentCount: integer("document_count").default(0),
  priority: integer("priority").default(0), // Higher priority sources synced first
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
});

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
  tenantId: varchar("tenant_id").references((): any => tenants.id), // Multi-tenant isolation
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

export const insertClientConsentSchema = createInsertSchema(clientConsents).omit({
  id: true,
  consentDate: true,
  createdAt: true,
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
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("household_profiles_user_idx").on(table.userId),
  clientCaseIdIdx: index("household_profiles_case_idx").on(table.clientCaseId),
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
  tenantId: varchar("tenant_id").references((): any => tenants.id), // Multi-tenant isolation
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  scenarioIdIdx: index("tax_documents_scenario_idx").on(table.scenarioId),
  federalReturnIdIdx: index("tax_documents_federal_return_idx").on(table.federalReturnId),
  vitaSessionIdIdx: index("tax_documents_vita_session_idx").on(table.vitaSessionId),
  documentTypeIdx: index("tax_documents_type_idx").on(table.documentType),
  verificationStatusIdx: index("tax_documents_verification_idx").on(table.verificationStatus),
}));

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
  stateOptionId: varchar("state_option_id").references(() => stateOptionsWaivers.id).notNull(),
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
  parentTenantId: varchar("parent_tenant_id").references((): any => tenants.id), // For counties under states
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
  tenantId: varchar("tenant_id").references((): any => tenants.id).notNull(), // Multi-tenant isolation
  
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
  
  // API key reference
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id, { onDelete: "cascade" }).notNull(),
  
  // Webhook config
  url: text("url").notNull(), // Partner's webhook URL
  events: jsonb("events").notNull(), // Array of event types: ['eligibility.checked', 'document.verified']
  secret: text("secret").notNull(), // HMAC secret for signature verification
  
  // Status
  status: text("status").notNull().default("active"), // active, paused, failed
  
  // Delivery tracking
  lastDeliveryAt: timestamp("last_delivery_at"),
  lastDeliveryStatus: text("last_delivery_status"), // success, failed
  failureCount: integer("failure_count").notNull().default(0),
  
  // Config
  retryConfig: jsonb("retry_config"), // Retry configuration
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  apiKeyIdx: index("webhooks_api_key_idx").on(table.apiKeyId),
  statusIdx: index("webhooks_status_idx").on(table.status),
}));

// Webhook insert/select types
export const insertWebhookSchema = createInsertSchema(webhooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  failureCount: true,
});

export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
export type Webhook = typeof webhooks.$inferSelect;

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

// Insert/select schemas
export const insertMonitoringMetricSchema = createInsertSchema(monitoringMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertAlertHistorySchema = createInsertSchema(alertHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertMonitoringMetric = z.infer<typeof insertMonitoringMetricSchema>;
export type MonitoringMetric = typeof monitoringMetrics.$inferSelect;
export type InsertAlertHistory = z.infer<typeof insertAlertHistorySchema>;
export type AlertHistory = typeof alertHistory.$inferSelect;

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
