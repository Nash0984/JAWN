import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean, uuid, real, index } from "drizzle-orm/pg-core";
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
  role: text("role").notNull().default("client"), // client, navigator, caseworker, admin
  // Maryland DHS staff fields
  dhsEmployeeId: text("dhs_employee_id"), // for navigators and caseworkers
  officeLocation: text("office_location"), // local DHS office location
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  syncSchedule: text("sync_schedule"), // daily, weekly, monthly
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

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
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

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

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
