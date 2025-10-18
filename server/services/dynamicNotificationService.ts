import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  dynamicNotificationTemplates,
  generatedNotifications,
  householdProfiles,
  users,
  snapIncomeLimits,
  type DynamicNotificationTemplate,
  type InsertGeneratedNotification,
} from "@shared/schema";
import { rulesEngine } from "./rulesEngine";
import { form1040Generator } from "./form1040Generator";
import { policyEngineTaxCalculation } from "./policyEngineTaxCalculation";

/**
 * Dynamic Notification Engine
 * 
 * Policy-driven template system that auto-generates official notices by pulling
 * content from Rules as Code. When policy rules change, notification content
 * automatically updates - no more static messages or version control nightmares!
 * 
 * Features:
 * - Template-based notification generation
 * - Real-time RaC data integration
 * - Audit trail with policy version tracking
 * - Multiple delivery channels (email, portal, SMS, mail)
 * - Legal compliance with required disclosures
 */

export interface GeneratedNotificationResult {
  id: string;
  generatedContent: string;
  generatedFormat: string;
  deliveryChannel: string;
  deliveryStatus: string;
  contextData: Record<string, any>;
  racVersion: string;
  policySourceVersions: Record<string, any>;
  generatedAt: Date;
}

export interface NotificationPreview {
  generatedContent: string;
  resolvedData: Record<string, any>;
  racVersion: string;
  legalCitations: string[];
  requiredDisclosures: string[];
  appealRights?: string;
}

class DynamicNotificationService {
  /**
   * Generate notification from template + RaC data
   * Pulls real-time policy data and creates official notice
   */
  async generateNotification(
    templateCode: string,
    recipientId: string,
    householdId: string,
    contextData: any = {},
    deliveryChannel: string = "portal",
    generatedBy?: string
  ): Promise<GeneratedNotificationResult> {
    // Step 1: Get template
    const template = await db.query.dynamicNotificationTemplates.findFirst({
      where: eq(dynamicNotificationTemplates.templateCode, templateCode),
    });

    if (!template) {
      throw new Error(`Notification template not found: ${templateCode}`);
    }

    if (!template.isActive) {
      throw new Error(`Notification template is inactive: ${templateCode}`);
    }

    // Step 2: Get recipient and household data
    const [recipient, household] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, recipientId),
      }),
      db.query.householdProfiles.findFirst({
        where: eq(householdProfiles.id, householdId),
      }),
    ]);

    if (!recipient) {
      throw new Error(`Recipient not found: ${recipientId}`);
    }

    if (!household) {
      throw new Error(`Household not found: ${householdId}`);
    }

    // Step 3: Resolve content rules - pull data from RaC
    const resolvedData = await this.resolveContentRules(
      template.contentRules as Record<string, any>,
      {
        ...contextData,
        recipient,
        household,
        householdProfile: household.householdData,
      }
    );

    // Step 4: Add recipient name (common across all templates)
    resolvedData.recipientName = recipient.fullName || recipient.username;

    // Step 5: Render template
    const generatedContent = this.renderTemplate(template.bodyTemplate, resolvedData);

    // Step 6: Add header and footer if present
    let fullContent = generatedContent;
    if (template.headerContent) {
      fullContent = template.headerContent + "\n\n" + fullContent;
    }
    if (template.footerContent) {
      fullContent = fullContent + "\n\n" + template.footerContent;
    }

    // Step 7: Add required disclosures
    if (template.requiredDisclosures && template.requiredDisclosures.length > 0) {
      fullContent += "\n\n--- IMPORTANT INFORMATION ---\n";
      template.requiredDisclosures.forEach((disclosure, index) => {
        fullContent += `\n${index + 1}. ${disclosure}`;
      });
    }

    // Step 8: Add appeal rights if present
    if (template.appealRightsTemplate) {
      const appealRights = this.renderTemplate(template.appealRightsTemplate, resolvedData);
      fullContent += "\n\n--- YOUR APPEAL RIGHTS ---\n";
      fullContent += appealRights;
    }

    // Step 9: Add legal citations
    if (template.legalCitations && template.legalCitations.length > 0) {
      fullContent += "\n\n--- LEGAL CITATIONS ---\n";
      fullContent += template.legalCitations.join(", ");
    }

    // Step 10: Get RaC version info for audit trail
    const racVersion = await this.getRacVersionInfo(template.program);
    const policySourceVersions = await this.getPolicySourceVersions(template.program);

    // Step 11: Save to database
    const notification = await db.insert(generatedNotifications).values({
      templateId: template.id,
      recipientId,
      householdId,
      generatedContent: fullContent,
      generatedFormat: "text",
      contextData: resolvedData,
      racVersion: JSON.stringify(racVersion),
      policySourceVersions: policySourceVersions,
      deliveryChannel,
      deliveryStatus: "pending",
      generatedBy: generatedBy || recipientId,
      generatedAt: new Date(),
    }).returning();

    return {
      id: notification[0].id,
      generatedContent: notification[0].generatedContent,
      generatedFormat: notification[0].generatedFormat,
      deliveryChannel: notification[0].deliveryChannel,
      deliveryStatus: notification[0].deliveryStatus,
      contextData: notification[0].contextData as Record<string, any>,
      racVersion: notification[0].racVersion || "",
      policySourceVersions: notification[0].policySourceVersions as Record<string, any>,
      generatedAt: notification[0].generatedAt,
    };
  }

  /**
   * Preview notification without saving
   * Useful for testing templates or showing preview to users
   */
  async previewNotification(
    templateCode: string,
    contextData: any = {}
  ): Promise<NotificationPreview> {
    // Get template
    const template = await db.query.dynamicNotificationTemplates.findFirst({
      where: eq(dynamicNotificationTemplates.templateCode, templateCode),
    });

    if (!template) {
      throw new Error(`Notification template not found: ${templateCode}`);
    }

    // Resolve content rules
    const resolvedData = await this.resolveContentRules(
      template.contentRules as Record<string, any>,
      contextData
    );

    // Render template
    const generatedContent = this.renderTemplate(template.bodyTemplate, resolvedData);

    // Get RaC version
    const racVersion = await this.getRacVersionInfo(template.program);

    return {
      generatedContent,
      resolvedData,
      racVersion: JSON.stringify(racVersion),
      legalCitations: template.legalCitations || [],
      requiredDisclosures: template.requiredDisclosures || [],
      appealRights: template.appealRightsTemplate || undefined,
    };
  }

  /**
   * Resolve content rules - pull data from RaC
   * Maps template variables to their data sources (rulesEngine, database queries, etc.)
   */
  async resolveContentRules(
    contentRules: Record<string, any>,
    contextData: any
  ): Promise<Record<string, any>> {
    const resolved: Record<string, any> = {};

    for (const [variable, rule] of Object.entries(contentRules)) {
      try {
        const value = await this.resolveRule(rule, contextData);
        resolved[variable] = this.formatValue(value, rule.format);
      } catch (error) {
        console.error(`Error resolving rule for ${variable}:`, error);
        resolved[variable] = `[Error: ${variable}]`;
      }
    }

    return resolved;
  }

  /**
   * Resolve a single content rule
   */
  private async resolveRule(rule: any, contextData: any): Promise<any> {
    const { source, params, fallback } = rule;

    try {
      // Handle different data sources
      if (source.startsWith("rulesEngine.")) {
        return await this.resolveRulesEngineSource(source, params, contextData);
      } else if (source.startsWith("household.")) {
        return this.resolveHouseholdSource(source, contextData);
      } else if (source.startsWith("database.")) {
        return await this.resolveDatabaseSource(source, params, contextData);
      } else if (source.startsWith("tax.")) {
        return await this.resolveTaxSource(source, params, contextData);
      } else if (source.startsWith("context.")) {
        // Direct context data reference
        const path = source.replace("context.", "");
        return this.getNestedValue(contextData, path);
      } else {
        // Literal value
        return source;
      }
    } catch (error) {
      console.error(`Error resolving source ${source}:`, error);
      return fallback || `[Error]`;
    }
  }

  /**
   * Resolve data from Rules Engine
   */
  private async resolveRulesEngineSource(
    source: string,
    params: string[],
    contextData: any
  ): Promise<any> {
    const method = source.replace("rulesEngine.", "");

    switch (method) {
      case "calculateSNAPBenefit": {
        // Get benefit program ID
        const snapProgram = await db.query.benefitPrograms.findFirst({
          where: (table, { eq }) => eq(table.code, "MD_SNAP"),
        });

        if (!snapProgram) {
          throw new Error("SNAP program not found");
        }

        // Extract household data
        const householdData = contextData.householdProfile || contextData.household?.householdData;
        if (!householdData) {
          throw new Error("Household data not found in context");
        }

        // Calculate eligibility
        const result = await rulesEngine.calculateEligibility(
          snapProgram.id,
          {
            size: householdData.household?.household_size || 1,
            grossMonthlyIncome: (householdData.income?.employment_income || 0) * 100, // Convert to cents
            earnedIncome: (householdData.income?.employment_income || 0) * 100,
            unearnedIncome: (householdData.income?.unearned_income || 0) * 100,
            dependentCareExpenses: (householdData.expenses?.childcare || 0) * 100,
            medicalExpenses: (householdData.expenses?.medical || 0) * 100,
            shelterCosts: ((householdData.expenses?.rent || 0) + (householdData.expenses?.utilities || 0)) * 100,
            hasElderly: householdData.household?.elderly_or_disabled || false,
            hasDisabled: householdData.household?.elderly_or_disabled || false,
          }
        );

        // Return benefit amount in dollars (convert from cents)
        return (result.monthlyBenefit / 100).toFixed(2);
      }

      case "getSNAPIncomeLimit": {
        const householdSize = contextData.householdProfile?.household?.household_size || 1;
        
        const limit = await db.query.snapIncomeLimits.findFirst({
          where: and(
            eq(snapIncomeLimits.householdSize, householdSize),
            eq(snapIncomeLimits.isActive, true)
          ),
          orderBy: desc(snapIncomeLimits.effectiveDate),
        });

        if (!limit) {
          throw new Error(`No income limit found for household size ${householdSize}`);
        }

        // Return gross income limit in dollars
        return (limit.grossMonthlyLimit / 100).toFixed(2);
      }

      default:
        throw new Error(`Unknown rules engine method: ${method}`);
    }
  }

  /**
   * Resolve data from household profile
   */
  private resolveHouseholdSource(source: string, contextData: any): any {
    const path = source.replace("household.", "");
    const householdData = contextData.householdProfile || contextData.household?.householdData;
    
    if (!householdData) {
      throw new Error("Household data not found in context");
    }

    return this.getNestedValue(householdData, path);
  }

  /**
   * Resolve data from database queries
   */
  private async resolveDatabaseSource(
    source: string,
    params: any,
    contextData: any
  ): Promise<any> {
    // Example: "database.snap_income_limits" with params
    const tableName = source.replace("database.", "");
    
    // This is a simplified implementation - extend as needed
    throw new Error(`Database source resolution not implemented for: ${tableName}`);
  }

  /**
   * Resolve data from tax calculations
   */
  private async resolveTaxSource(
    source: string,
    params: any,
    contextData: any
  ): Promise<any> {
    const calculation = source.replace("tax.", "");

    switch (calculation) {
      case "estimatedEITC": {
        // This would call PolicyEngine tax calculation
        // Simplified for now
        return "0.00";
      }

      case "estimatedRefund": {
        // This would call PolicyEngine tax calculation
        return "0.00";
      }

      default:
        throw new Error(`Unknown tax calculation: ${calculation}`);
    }
  }

  /**
   * Render template by replacing {{variables}} with resolved data
   */
  renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template;

    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      const stringValue = value?.toString() || "";
      rendered = rendered.replace(new RegExp(placeholder, "g"), stringValue);
    }

    // Check for unresolved variables
    const unresolvedMatches = rendered.match(/\{\{([^}]+)\}\}/g);
    if (unresolvedMatches) {
      console.warn("Unresolved template variables:", unresolvedMatches);
    }

    return rendered;
  }

  /**
   * Format value according to specified format
   */
  private formatValue(value: any, format?: string): any {
    if (!format) return value;

    switch (format) {
      case "currency":
        if (typeof value === "number") {
          return value.toFixed(2);
        }
        return value;

      case "date":
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        return value;

      case "percentage":
        if (typeof value === "number") {
          return `${(value * 100).toFixed(1)}%`;
        }
        return value;

      default:
        return value;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get RaC version info for audit trail
   * Tracks which version of rules were used to generate this notification
   */
  private async getRacVersionInfo(program: string): Promise<Record<string, any>> {
    const now = new Date();
    
    // Get active rule versions for this program
    const snapProgram = await db.query.benefitPrograms.findFirst({
      where: (table, { eq }) => eq(table.code, program === "SNAP" ? "MD_SNAP" : program),
    });

    if (!snapProgram) {
      return { program, timestamp: now.toISOString() };
    }

    // Query active rules
    const [incomeLimits, deductions, allotments] = await Promise.all([
      db.query.snapIncomeLimits.findMany({
        where: and(
          eq(snapIncomeLimits.benefitProgramId, snapProgram.id),
          eq(snapIncomeLimits.isActive, true)
        ),
        limit: 1,
        orderBy: desc(snapIncomeLimits.effectiveDate),
      }),
      db.query.snapDeductions.findMany({
        where: (table, { eq, and }) => and(
          eq(table.benefitProgramId, snapProgram.id),
          eq(table.isActive, true)
        ),
        limit: 1,
        orderBy: (table) => desc(table.effectiveDate),
      }),
      db.query.snapAllotments.findMany({
        where: (table, { eq, and }) => and(
          eq(table.benefitProgramId, snapProgram.id),
          eq(table.isActive, true)
        ),
        limit: 1,
        orderBy: (table) => desc(table.effectiveDate),
      }),
    ]);

    return {
      program,
      benefitProgramId: snapProgram.id,
      timestamp: now.toISOString(),
      incomeLimitVersion: incomeLimits[0]?.effectiveDate || null,
      deductionVersion: deductions[0]?.effectiveDate || null,
      allotmentVersion: allotments[0]?.effectiveDate || null,
    };
  }

  /**
   * Get policy source versions for audit trail
   */
  private async getPolicySourceVersions(program: string): Promise<Record<string, any>> {
    const sources = await db.query.policySources.findMany({
      where: (table, { eq }) => eq(table.isActive, true),
      limit: 5,
    });

    const versions: Record<string, any> = {};
    for (const source of sources) {
      versions[source.name] = {
        lastSyncAt: source.lastSyncAt,
        syncStatus: source.syncStatus,
      };
    }

    return versions;
  }

  /**
   * Get all notification templates
   */
  async getTemplates(program?: string): Promise<DynamicNotificationTemplate[]> {
    if (program) {
      return await db.query.dynamicNotificationTemplates.findMany({
        where: and(
          eq(dynamicNotificationTemplates.program, program),
          eq(dynamicNotificationTemplates.isActive, true)
        ),
      });
    }

    return await db.query.dynamicNotificationTemplates.findMany({
      where: eq(dynamicNotificationTemplates.isActive, true),
    });
  }

  /**
   * Get generated notifications for a recipient
   */
  async getGeneratedNotifications(recipientId: string, limit: number = 50) {
    return await db.query.generatedNotifications.findMany({
      where: eq(generatedNotifications.recipientId, recipientId),
      orderBy: desc(generatedNotifications.generatedAt),
      limit,
      with: {
        template: true,
        recipient: {
          columns: {
            id: true,
            username: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get a specific generated notification
   */
  async getGeneratedNotification(notificationId: string) {
    return await db.query.generatedNotifications.findFirst({
      where: eq(generatedNotifications.id, notificationId),
      with: {
        template: true,
        recipient: {
          columns: {
            id: true,
            username: true,
            fullName: true,
            email: true,
          },
        },
        household: true,
      },
    });
  }

  /**
   * Mark notification as sent
   */
  async markAsSent(notificationId: string): Promise<void> {
    await db.update(generatedNotifications)
      .set({
        deliveryStatus: "sent",
        sentAt: new Date(),
      })
      .where(eq(generatedNotifications.id, notificationId));
  }

  /**
   * Mark notification as delivered
   */
  async markAsDelivered(notificationId: string): Promise<void> {
    await db.update(generatedNotifications)
      .set({
        deliveryStatus: "delivered",
        deliveredAt: new Date(),
      })
      .where(eq(generatedNotifications.id, notificationId));
  }
}

export const dynamicNotificationService = new DynamicNotificationService();
