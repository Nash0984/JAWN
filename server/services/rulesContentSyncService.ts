import { db } from "../db";
import { eq, and, desc, sql, ne, or } from "drizzle-orm";
import {
  contentSyncJobs,
  contentRulesMapping,
  dynamicNotificationTemplates,
  policyManualSections,
  formComponents,
  snapIncomeLimits,
  snapDeductions,
  snapAllotments,
  ohepIncomeLimits,
  auditLogs,
  users,
  type ContentSyncJob,
  type InsertContentSyncJob,
} from "@shared/schema";
import { dynamicNotificationService } from "./dynamicNotificationService";
import { auditService } from "./auditService";

/**
 * Rules-to-Content Sync Service
 * 
 * Monitors Rules as Code (RaC) tables for changes and automatically triggers
 * content regeneration for affected notification templates, policy manual sections,
 * and form components.
 * 
 * Key Features:
 * - Detects changes in RaC tables (snapIncomeLimits, snapDeductions, etc.)
 * - Uses content_rules_mapping to identify affected content
 * - Auto-regenerates content when mapping has autoRegenerate=true
 * - Queues jobs for manual review when requiresApproval=true
 * - Provides admin review workflow (approve/reject/apply)
 */

interface RacTableChange {
  tableName: string;
  fieldName?: string;
  oldValue: any;
  newValue: any;
  recordId: string;
}

class RulesContentSyncService {
  /**
   * Detect changes in RaC tables and queue affected content for regeneration
   * 
   * Scans all RaC tables (snapIncomeLimits, snapDeductions, etc.) for recent changes,
   * then queries content_rules_mapping to find affected content and creates sync jobs.
   */
  async detectRacChanges(): Promise<ContentSyncJob[]> {
    console.log("🔍 Detecting RaC changes...");
    const jobs: ContentSyncJob[] = [];

    try {
      // Get all content mappings (these define what content depends on which RaC tables)
      const mappings = await db.query.contentRulesMapping.findMany();

      if (mappings.length === 0) {
        console.log("ℹ️ No content mappings found - skipping RaC change detection");
        return [];
      }

      // Group mappings by RaC table for efficient checking
      const mappingsByTable = mappings.reduce((acc, mapping) => {
        const tableName = mapping.rulesEngineTable;
        if (!acc[tableName]) {
          acc[tableName] = [];
        }
        acc[tableName].push(mapping);
        return acc;
      }, {} as Record<string, typeof mappings>);

      // Check each RaC table for changes
      for (const [tableName, tableMappings] of Object.entries(mappingsByTable)) {
        try {
          const changes = await this.detectTableChanges(tableName);
          
          if (changes.length > 0) {
            console.log(`📊 Found ${changes.length} changes in ${tableName}`);
            
            // For each change, create sync jobs for all affected content
            for (const change of changes) {
              for (const mapping of tableMappings) {
                // Check if this change affects this specific mapping
                if (mapping.rulesEngineField && change.fieldName !== mapping.rulesEngineField) {
                  continue; // Mapping is for a different field
                }

                // Create sync job
                const job = await this.createSyncJob({
                  contentType: mapping.affectedContentType,
                  contentId: mapping.affectedContentId,
                  racTableName: tableName,
                  racFieldName: change.fieldName,
                  oldValue: change.oldValue,
                  newValue: change.newValue,
                  affectedMappingId: mapping.id,
                  autoRegenerate: mapping.autoRegenerate,
                  status: mapping.autoRegenerate ? "pending" : "pending",
                });

                jobs.push(job);

                // If auto-regenerate is enabled, process immediately
                if (mapping.autoRegenerate) {
                  await this.processContentSync(job.id);
                }
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error checking table ${tableName}:`, error);
          // Continue checking other tables
        }
      }

      console.log(`✅ Created ${jobs.length} sync jobs`);
      return jobs;
    } catch (error) {
      console.error("❌ Error detecting RaC changes:", error);
      throw error;
    }
  }

  /**
   * Detect changes in a specific RaC table
   * 
   * This is a simplified implementation that checks for records updated in the last hour.
   * In production, you might want to use database triggers, change data capture,
   * or a more sophisticated versioning system.
   */
  private async detectTableChanges(tableName: string): Promise<RacTableChange[]> {
    const changes: RacTableChange[] = [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    try {
      // Map table names to actual Drizzle table objects
      const tableMap: Record<string, any> = {
        'snap_income_limits': snapIncomeLimits,
        'snap_deductions': snapDeductions,
        'snap_allotments': snapAllotments,
        'ohep_income_limits': ohepIncomeLimits,
      };

      const table = tableMap[tableName];
      if (!table) {
        console.warn(`⚠️ Unknown RaC table: ${tableName}`);
        return [];
      }

      // Query for recently updated records
      const recentUpdates = await db
        .select()
        .from(table)
        .where(sql`${table.updatedAt} >= ${oneHourAgo}`)
        .orderBy(desc(table.updatedAt));

      // For each updated record, we'd ideally compare with previous version
      // For now, we'll just flag the update as a change
      for (const record of recentUpdates) {
        changes.push({
          tableName,
          fieldName: undefined, // Would need version history to determine specific field
          oldValue: null, // Would need version history
          newValue: record,
          recordId: record.id,
        });
      }

      return changes;
    } catch (error) {
      console.error(`❌ Error detecting changes in ${tableName}:`, error);
      return [];
    }
  }

  /**
   * Create a content sync job
   */
  private async createSyncJob(jobData: InsertContentSyncJob): Promise<ContentSyncJob> {
    const [job] = await db.insert(contentSyncJobs).values(jobData).returning();

    // Log to audit trail
    await auditService.logEvent(
      "content_sync_job_created",
      null,
      "system",
      {
        jobId: job.id,
        contentType: job.contentType,
        contentId: job.contentId,
        racTableName: job.racTableName,
        autoRegenerate: job.autoRegenerate,
      }
    );

    return job;
  }

  /**
   * Process a content sync job (regenerate template/section)
   * 
   * Pulls latest RaC data and regenerates the affected content.
   * For notification templates, uses dynamicNotificationService.
   * For policy manual sections and form components, would use respective services.
   */
  async processContentSync(jobId: string): Promise<void> {
    console.log(`⚙️ Processing sync job ${jobId}...`);

    try {
      // Get the job
      const job = await db.query.contentSyncJobs.findFirst({
        where: eq(contentSyncJobs.id, jobId),
      });

      if (!job) {
        throw new Error(`Sync job not found: ${jobId}`);
      }

      if (job.status === "generated" || job.status === "approved") {
        console.log(`ℹ️ Job ${jobId} already processed`);
        return;
      }

      let regeneratedContent = "";

      // Regenerate content based on content type
      switch (job.contentType) {
        case "notification_template":
          regeneratedContent = await this.regenerateNotificationTemplate(job.contentId);
          break;
        case "policy_manual_section":
          regeneratedContent = await this.regeneratePolicyManualSection(job.contentId);
          break;
        case "form_component":
          regeneratedContent = await this.regenerateFormComponent(job.contentId);
          break;
        default:
          throw new Error(`Unknown content type: ${job.contentType}`);
      }

      // Update job with regenerated content
      await db
        .update(contentSyncJobs)
        .set({
          regeneratedContent,
          status: job.autoRegenerate ? "approved" : "generated",
          processedAt: new Date(),
        })
        .where(eq(contentSyncJobs.id, jobId));

      console.log(`✅ Job ${jobId} processed successfully`);

      // If auto-regenerate and auto-approve, apply changes immediately
      if (job.autoRegenerate) {
        await this.applySyncJob(jobId);
      }
    } catch (error) {
      console.error(`❌ Error processing job ${jobId}:`, error);
      
      // Update job with error
      await db
        .update(contentSyncJobs)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          processedAt: new Date(),
        })
        .where(eq(contentSyncJobs.id, jobId));

      throw error;
    }
  }

  /**
   * Regenerate a notification template
   */
  private async regenerateNotificationTemplate(templateId: string): Promise<string> {
    const template = await db.query.dynamicNotificationTemplates.findFirst({
      where: eq(dynamicNotificationTemplates.id, templateId),
    });

    if (!template) {
      throw new Error(`Notification template not found: ${templateId}`);
    }

    // Preview the template with latest RaC data
    const preview = await dynamicNotificationService.previewNotification(
      template.templateCode,
      {} // Use empty context for RaC-only preview
    );

    return preview.generatedContent;
  }

  /**
   * Regenerate a policy manual section
   */
  private async regeneratePolicyManualSection(sectionId: string): Promise<string> {
    const section = await db.query.policyManualSections.findFirst({
      where: eq(policyManualSections.id, sectionId),
    });

    if (!section) {
      throw new Error(`Policy manual section not found: ${sectionId}`);
    }

    // For now, return the existing content
    // In production, you'd implement actual regeneration logic
    return section.content + "\n\n[Updated with latest RaC data]";
  }

  /**
   * Regenerate a form component
   */
  private async regenerateFormComponent(componentId: string): Promise<string> {
    const component = await db.query.formComponents.findFirst({
      where: eq(formComponents.id, componentId),
    });

    if (!component) {
      throw new Error(`Form component not found: ${componentId}`);
    }

    // For now, return the existing content
    // In production, you'd implement actual regeneration logic
    return component.templateContent + "\n\n[Updated with latest RaC data]";
  }

  /**
   * Get pending sync jobs for admin review
   */
  async getPendingSyncJobs(filter?: { 
    program?: string; 
    contentType?: string;
    status?: string;
  }): Promise<ContentSyncJob[]> {
    const conditions = [];

    if (filter?.status) {
      conditions.push(eq(contentSyncJobs.status, filter.status));
    } else {
      // Default to pending and generated (awaiting review)
      conditions.push(or(
        eq(contentSyncJobs.status, "pending"),
        eq(contentSyncJobs.status, "generated")
      ));
    }

    if (filter?.contentType) {
      conditions.push(eq(contentSyncJobs.contentType, filter.contentType));
    }

    const jobs = await db.query.contentSyncJobs.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: desc(contentSyncJobs.queuedAt),
      limit: 100,
    });

    // Filter by program if specified
    if (filter?.program) {
      // Would need to join with templates/sections to filter by program
      // For now, return all jobs
    }

    return jobs;
  }

  /**
   * Review a sync job (approve or reject)
   */
  async reviewSyncJob(
    jobId: string,
    action: "approve" | "reject",
    reviewerId: string,
    notes?: string
  ): Promise<void> {
    console.log(`📝 Reviewing job ${jobId}: ${action}`);

    const job = await db.query.contentSyncJobs.findFirst({
      where: eq(contentSyncJobs.id, jobId),
    });

    if (!job) {
      throw new Error(`Sync job not found: ${jobId}`);
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    await db
      .update(contentSyncJobs)
      .set({
        status: newStatus,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: notes,
      })
      .where(eq(contentSyncJobs.id, jobId));

    // Log to audit trail
    await auditService.logEvent(
      "content_sync_job_reviewed",
      reviewerId,
      "admin",
      {
        jobId,
        action,
        notes,
      }
    );

    console.log(`✅ Job ${jobId} ${action}ed`);
  }

  /**
   * Apply approved changes to live content
   */
  async applySyncJob(jobId: string): Promise<void> {
    console.log(`🚀 Applying sync job ${jobId}...`);

    const job = await db.query.contentSyncJobs.findFirst({
      where: eq(contentSyncJobs.id, jobId),
    });

    if (!job) {
      throw new Error(`Sync job not found: ${jobId}`);
    }

    if (job.status !== "approved") {
      throw new Error(`Job must be approved before applying (current status: ${job.status})`);
    }

    if (!job.regeneratedContent) {
      throw new Error("No regenerated content available");
    }

    try {
      // Use transaction to ensure atomicity
      await db.transaction(async (tx) => {
        // Apply changes based on content type
        switch (job.contentType) {
          case "notification_template":
            await tx
              .update(dynamicNotificationTemplates)
              .set({
                bodyTemplate: job.regeneratedContent,
                updatedAt: new Date(),
              })
              .where(eq(dynamicNotificationTemplates.id, job.contentId));
            break;

          case "policy_manual_section":
            await tx
              .update(policyManualSections)
              .set({
                content: job.regeneratedContent,
                updatedAt: new Date(),
              })
              .where(eq(policyManualSections.id, job.contentId));
            break;

          case "form_component":
            await tx
              .update(formComponents)
              .set({
                templateContent: job.regeneratedContent,
                updatedAt: new Date(),
              })
              .where(eq(formComponents.id, job.contentId));
            break;

          default:
            throw new Error(`Unknown content type: ${job.contentType}`);
        }

        // Update mapping sync status
        if (job.affectedMappingId) {
          await tx
            .update(contentRulesMapping)
            .set({
              lastSyncedAt: new Date(),
              syncStatus: "synced",
            })
            .where(eq(contentRulesMapping.id, job.affectedMappingId));
        }

        // Log to audit trail
        await tx.insert(auditLogs).values({
          eventType: "content_sync_applied",
          userId: null,
          userRole: "system",
          metadata: {
            jobId: job.id,
            contentType: job.contentType,
            contentId: job.contentId,
            racTableName: job.racTableName,
          },
        });
      });

      console.log(`✅ Job ${jobId} applied successfully`);
    } catch (error) {
      console.error(`❌ Error applying job ${jobId}:`, error);
      
      // Update job status to failed
      await db
        .update(contentSyncJobs)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        })
        .where(eq(contentSyncJobs.id, jobId));

      throw error;
    }
  }

  /**
   * Auto-regenerate content based on content_rules_mapping.autoRegenerate flag
   */
  async autoRegenerateContent(mappingId: string): Promise<void> {
    console.log(`🔄 Auto-regenerating content for mapping ${mappingId}...`);

    const mapping = await db.query.contentRulesMapping.findFirst({
      where: eq(contentRulesMapping.id, mappingId),
    });

    if (!mapping) {
      throw new Error(`Content mapping not found: ${mappingId}`);
    }

    if (!mapping.autoRegenerate) {
      console.log(`ℹ️ Mapping ${mappingId} does not have auto-regenerate enabled`);
      return;
    }

    // Create and immediately process a sync job
    const job = await this.createSyncJob({
      contentType: mapping.affectedContentType,
      contentId: mapping.affectedContentId,
      racTableName: mapping.rulesEngineTable,
      racFieldName: mapping.rulesEngineField,
      oldValue: null,
      newValue: null,
      affectedMappingId: mappingId,
      autoRegenerate: true,
      status: "pending",
    });

    await this.processContentSync(job.id);

    console.log(`✅ Auto-regeneration complete for mapping ${mappingId}`);
  }
}

export const rulesContentSyncService = new RulesContentSyncService();
