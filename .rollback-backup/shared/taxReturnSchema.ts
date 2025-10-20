import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, clientCases } from "./schema";

// ============================================================================
// FEDERAL TAX RETURNS - IRS Form 1040 E-Filing Management
// ============================================================================

export const federalTaxReturns = pgTable("federal_tax_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User and case association
  userId: varchar("user_id").references(() => users.id).notNull(),
  clientCaseId: varchar("client_case_id").references(() => clientCases.id),
  
  // Tax year and filing information
  taxYear: integer("tax_year").notNull(),
  filingStatus: text("filing_status").notNull(), // single, married_joint, married_separate, head_of_household, qualifying_widow
  
  // Form 1040 data
  form1040Data: jsonb("form_1040_data"), // Complete form data structure
  
  // Key financial values (for quick queries)
  adjustedGrossIncome: real("adjusted_gross_income"),
  taxableIncome: real("taxable_income"),
  totalTax: real("total_tax"),
  federalWithholding: real("federal_withholding"),
  refundAmount: real("refund_amount"),
  amountOwed: real("amount_owed"),
  
  // E-filing status tracking
  efileStatus: text("efile_status").notNull().default("draft"), 
  // draft -> ready -> transmitted -> accepted/rejected/pending
  
  // E-filing submission tracking (NEW FIELDS)
  submissionAttempts: integer("submission_attempts").default(0).notNull(),
  lastSubmissionAt: timestamp("last_submission_at"),
  nextRetryAt: timestamp("next_retry_at"), // For retry scheduling
  
  // IRS MeF tracking (NEW FIELDS)
  mefTransmissionId: text("mef_transmission_id"), // IRS MeF transmission ID
  mefSubmissionId: text("mef_submission_id"), // MeF submission ID from IRS
  dcnNumber: text("dcn_number"), // Declaration Control Number from IRS
  
  // Acknowledgment data (NEW FIELD)
  acknowledgmentData: jsonb("acknowledgment_data"), // Full IRS acknowledgment response
  acknowledgmentReceivedAt: timestamp("acknowledgment_received_at"),
  
  // Rejection tracking
  rejectionCode: text("rejection_code"),
  rejectionReason: text("rejection_reason"),
  rejectionDetails: jsonb("rejection_details"),
  
  // Priority queuing (NEW FIELD)
  submissionPriority: integer("submission_priority").default(0), // Higher = higher priority
  isAmendedReturn: boolean("is_amended_return").default(false),
  
  // Queue status (NEW FIELDS)
  queueStatus: text("queue_status"), // queued, processing, retrying, failed, completed
  queuedAt: timestamp("queued_at"),
  processedAt: timestamp("processed_at"),
  
  // Error tracking (NEW FIELDS)
  lastErrorType: text("last_error_type"), // network, validation, business_rule, schema
  lastErrorMessage: text("last_error_message"),
  lastErrorAt: timestamp("last_error_at"),
  deadLettered: boolean("dead_lettered").default(false), // Moved to dead letter queue
  deadLetterReason: text("dead_letter_reason"),
  
  // XML generation
  xmlGenerated: boolean("xml_generated").default(false),
  xmlGeneratedAt: timestamp("xml_generated_at"),
  xmlStoragePath: text("xml_storage_path"), // Path to stored XML file
  xmlHash: text("xml_hash"), // SHA-256 hash of XML for integrity
  
  // Validation
  validationErrors: jsonb("validation_errors"),
  validationStatus: text("validation_status"), // pending, valid, invalid
  validatedAt: timestamp("validated_at"),
  
  // Signatures
  taxpayerPin: text("taxpayer_pin"), // Self-select PIN
  spousePin: text("spouse_pin"), // Spouse self-select PIN
  paidPreparerPin: text("paid_preparer_pin"), // Preparer PIN
  
  // Preparer information
  preparerId: varchar("preparer_id").references(() => users.id),
  preparerPtin: text("preparer_ptin"),
  preparerEin: text("preparer_ein"),
  
  // Testing/mock mode flag (NEW FIELD)
  isMockSubmission: boolean("is_mock_submission").default(true), // Default to mock mode
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  transmittedAt: timestamp("transmitted_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
}, (table) => ({
  userIdIdx: index("federal_returns_user_idx").on(table.userId),
  taxYearIdx: index("federal_returns_tax_year_idx").on(table.taxYear),
  efileStatusIdx: index("federal_returns_efile_status_idx").on(table.efileStatus),
  queueStatusIdx: index("federal_returns_queue_status_idx").on(table.queueStatus),
  priorityIdx: index("federal_returns_priority_idx").on(table.submissionPriority),
  mefTransmissionIdx: index("federal_returns_mef_transmission_idx").on(table.mefTransmissionId),
  dcnIdx: index("federal_returns_dcn_idx").on(table.dcnNumber),
  nextRetryIdx: index("federal_returns_next_retry_idx").on(table.nextRetryAt),
  deadLetterIdx: index("federal_returns_dead_letter_idx").on(table.deadLettered),
}));

// ============================================================================
// MARYLAND TAX RETURNS - Form 502 State Filing Management
// ============================================================================

export const marylandTaxReturns = pgTable("maryland_tax_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to federal return
  federalReturnId: varchar("federal_return_id").references(() => federalTaxReturns.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Tax year and filing information
  taxYear: integer("tax_year").notNull(),
  filingStatus: text("filing_status").notNull(),
  
  // Form 502 data
  form502Data: jsonb("form_502_data"), // Complete Maryland form data
  
  // Personal Information (NEW FIELDS)
  personalInfo: jsonb("personal_info"), // Form502PersonalInfo structure
  taxInput: jsonb("tax_input"), // TaxHouseholdInput structure
  marylandInput: jsonb("maryland_input"), // MarylandSpecificInput structure
  marylandTaxResult: jsonb("maryland_tax_result"), // MarylandTaxResult structure
  
  // Key Maryland values
  marylandAgi: real("maryland_agi"),
  marylandTaxableIncome: real("maryland_taxable_income"),
  marylandTax: real("maryland_tax"),
  localTax: real("local_tax"),
  marylandWithholding: real("maryland_withholding"),
  marylandRefundAmount: real("maryland_refund_amount"),
  marylandAmountOwed: real("maryland_amount_owed"),
  
  // County Information (NEW FIELDS)
  countyCode: text("county_code"), // BALTIMORE_CITY, MONTGOMERY, etc.
  countyName: text("county_name"),
  localTaxAmount: real("local_tax_amount"), // Actual county tax calculated
  
  // E-filing status
  efileStatus: text("efile_status").notNull().default("draft"),
  
  // Maryland iFile tracking
  ifileTransmissionId: text("ifile_transmission_id"),
  ifileConfirmationNumber: text("ifile_confirmation_number"),
  marylandConfirmationNumber: text("maryland_confirmation_number"), // MCF number from Maryland
  marylandSubmissionStatus: text("maryland_submission_status"), // draft, submitted, accepted, rejected, pending
  
  // Submission tracking
  submissionAttempts: integer("submission_attempts").default(0).notNull(),
  lastSubmissionAt: timestamp("last_submission_at"),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Acknowledgment
  acknowledgmentData: jsonb("acknowledgment_data"),
  acknowledgmentReceivedAt: timestamp("acknowledgment_received_at"),
  
  // Rejection tracking
  rejectionCode: text("rejection_code"),
  rejectionReason: text("rejection_reason"),
  
  // Queue management
  queueStatus: text("queue_status"), // queued, processing, retry, pending_federal, failed, completed
  submissionPriority: integer("submission_priority").default(0),
  queuedAt: timestamp("queued_at"),
  lastProcessedAt: timestamp("last_processed_at"),
  
  // Notification preferences (NEW FIELDS)
  notifyOnStatusChange: boolean("notify_on_status_change").default(false),
  
  // Error tracking (NEW FIELDS)
  lastError: text("last_error"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),
  
  // Audit fields (NEW FIELDS)
  submittedBy: varchar("submitted_by").references(() => users.id),
  submissionStatus: text("submission_status"), // draft, submitted, accepted, rejected
  
  // XML generation
  xmlGenerated: boolean("xml_generated").default(false),
  xmlGeneratedAt: timestamp("xml_generated_at"),
  xmlStoragePath: text("xml_storage_path"),
  
  // Validation
  validationErrors: jsonb("validation_errors"),
  validationStatus: text("validation_status"),
  
  // Testing flag
  isMockSubmission: boolean("is_mock_submission").default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  transmittedAt: timestamp("transmitted_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
}, (table) => ({
  federalReturnIdx: index("maryland_returns_federal_idx").on(table.federalReturnId),
  userIdIdx: index("maryland_returns_user_idx").on(table.userId),
  taxYearIdx: index("maryland_returns_tax_year_idx").on(table.taxYear),
  efileStatusIdx: index("maryland_returns_efile_status_idx").on(table.efileStatus),
  queueStatusIdx: index("maryland_returns_queue_status_idx").on(table.queueStatus),
  priorityIdx: index("maryland_returns_priority_idx").on(table.submissionPriority),
  ifileTransmissionIdx: index("maryland_returns_ifile_idx").on(table.ifileTransmissionId),
  countyCodeIdx: index("maryland_returns_county_idx").on(table.countyCode),
  marylandStatusIdx: index("maryland_returns_md_status_idx").on(table.marylandSubmissionStatus),
  nextRetryIdx: index("maryland_returns_next_retry_idx").on(table.nextRetryAt),
}));

// ============================================================================
// E-FILE SUBMISSION LOGS - Comprehensive Audit Trail
// ============================================================================

export const efileSubmissionLogs = pgTable("efile_submission_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Return association
  federalReturnId: varchar("federal_return_id").references(() => federalTaxReturns.id, { onDelete: "cascade" }),
  marylandReturnId: varchar("maryland_return_id").references(() => marylandTaxReturns.id, { onDelete: "cascade" }),
  
  // Return type
  returnType: text("return_type").notNull(), // federal, maryland
  
  // Action details
  action: text("action").notNull(), // submitted, retried, accepted, rejected, error, dead_lettered
  actionDetails: jsonb("action_details"), // Detailed action information
  
  // Submission details
  submissionAttempt: integer("submission_attempt"),
  transmissionId: text("transmission_id"),
  submissionId: text("submission_id"),
  
  // Request/Response tracking
  requestData: jsonb("request_data"), // Request sent to IRS/MD
  responseData: jsonb("response_data"), // Response received
  responseCode: text("response_code"),
  
  // Error details
  errorType: text("error_type"),
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  
  // Performance metrics
  requestDuration: integer("request_duration"), // in milliseconds
  queueWaitTime: integer("queue_wait_time"), // in milliseconds
  
  // Circuit breaker tracking
  circuitBreakerStatus: text("circuit_breaker_status"), // open, closed, half_open
  
  // Mock/Production flag
  isMockSubmission: boolean("is_mock_submission").default(true),
  
  // User and system tracking
  submittedBy: varchar("submitted_by").references(() => users.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Timestamp
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  federalReturnIdx: index("efile_logs_federal_idx").on(table.federalReturnId),
  marylandReturnIdx: index("efile_logs_maryland_idx").on(table.marylandReturnId),
  actionIdx: index("efile_logs_action_idx").on(table.action),
  errorTypeIdx: index("efile_logs_error_type_idx").on(table.errorType),
  createdAtIdx: index("efile_logs_created_idx").on(table.createdAt),
  transmissionIdx: index("efile_logs_transmission_idx").on(table.transmissionId),
}));

// ============================================================================
// E-FILE QUEUE METADATA - Track Queue Health and Performance
// ============================================================================

export const efileQueueMetadata = pgTable("efile_queue_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Queue metrics
  queueName: text("queue_name").notNull(), // federal_primary, federal_amended, maryland_primary
  activeItems: integer("active_items").default(0),
  pendingItems: integer("pending_items").default(0),
  failedItems: integer("failed_items").default(0),
  deadLetteredItems: integer("dead_lettered_items").default(0),
  
  // Performance metrics
  averageProcessingTime: integer("average_processing_time"), // in seconds
  successRate: real("success_rate"), // 0-1
  
  // Circuit breaker state
  circuitBreakerState: text("circuit_breaker_state").default("closed"), // open, closed, half_open
  circuitBreakerOpenedAt: timestamp("circuit_breaker_opened_at"),
  circuitBreakerFailureCount: integer("circuit_breaker_failure_count").default(0),
  
  // Rate limiting
  currentThroughput: integer("current_throughput"), // requests per minute
  maxThroughput: integer("max_throughput").default(60), // max requests per minute
  
  // Health status
  healthStatus: text("health_status").default("healthy"), // healthy, degraded, unhealthy
  lastHealthCheck: timestamp("last_health_check"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  queueNameIdx: uniqueIndex("queue_metadata_name_idx").on(table.queueName),
  healthStatusIdx: index("queue_metadata_health_idx").on(table.healthStatus),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const federalTaxReturnsRelations = relations(federalTaxReturns, ({ one, many }) => ({
  user: one(users, {
    fields: [federalTaxReturns.userId],
    references: [users.id],
  }),
  clientCase: one(clientCases, {
    fields: [federalTaxReturns.clientCaseId],
    references: [clientCases.id],
  }),
  preparer: one(users, {
    fields: [federalTaxReturns.preparerId],
    references: [users.id],
  }),
  marylandReturn: one(marylandTaxReturns, {
    fields: [federalTaxReturns.id],
    references: [marylandTaxReturns.federalReturnId],
  }),
  submissionLogs: many(efileSubmissionLogs),
}));

export const marylandTaxReturnsRelations = relations(marylandTaxReturns, ({ one, many }) => ({
  federalReturn: one(federalTaxReturns, {
    fields: [marylandTaxReturns.federalReturnId],
    references: [federalTaxReturns.id],
  }),
  user: one(users, {
    fields: [marylandTaxReturns.userId],
    references: [users.id],
  }),
  submissionLogs: many(efileSubmissionLogs),
}));

export const efileSubmissionLogsRelations = relations(efileSubmissionLogs, ({ one }) => ({
  federalReturn: one(federalTaxReturns, {
    fields: [efileSubmissionLogs.federalReturnId],
    references: [federalTaxReturns.id],
  }),
  marylandReturn: one(marylandTaxReturns, {
    fields: [efileSubmissionLogs.marylandReturnId],
    references: [marylandTaxReturns.id],
  }),
  submittedBy: one(users, {
    fields: [efileSubmissionLogs.submittedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// INSERT SCHEMAS AND TYPES
// ============================================================================

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

export const insertEfileSubmissionLogSchema = createInsertSchema(efileSubmissionLogs).omit({
  id: true,
  createdAt: true,
});

export const insertEfileQueueMetadataSchema = createInsertSchema(efileQueueMetadata).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type FederalTaxReturn = typeof federalTaxReturns.$inferSelect;
export type InsertFederalTaxReturn = z.infer<typeof insertFederalTaxReturnSchema>;

export type MarylandTaxReturn = typeof marylandTaxReturns.$inferSelect;
export type InsertMarylandTaxReturn = z.infer<typeof insertMarylandTaxReturnSchema>;

export type EfileSubmissionLog = typeof efileSubmissionLogs.$inferSelect;
export type InsertEfileSubmissionLog = z.infer<typeof insertEfileSubmissionLogSchema>;

export type EfileQueueMetadata = typeof efileQueueMetadata.$inferSelect;
export type InsertEfileQueueMetadata = z.infer<typeof insertEfileQueueMetadataSchema>;