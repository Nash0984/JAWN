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

export const searchQueries = pgTable("search_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  query: text("query").notNull(),
  userId: varchar("user_id").references(() => users.id),
  benefitProgramId: varchar("benefit_program_id").references(() => benefitPrograms.id),
  response: jsonb("response"), // AI response with sources
  relevanceScore: real("relevance_score"),
  responseTime: integer("response_time"), // in milliseconds
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

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
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

export type DocumentType = typeof documentTypes.$inferSelect;
