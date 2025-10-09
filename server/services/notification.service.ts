import { db } from "../db";
import { 
  notifications, 
  notificationPreferences, 
  notificationTemplates,
  users,
  type InsertNotification,
  type NotificationPreference
} from "@shared/schema";
import { eq, and, desc, isNull, count, or } from "drizzle-orm";

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface NotificationServiceInterface {
  createNotification(params: CreateNotificationParams): Promise<void>;
  createNotificationFromTemplate(
    templateCode: string, 
    userId: string, 
    variables: Record<string, string>,
    options?: Partial<CreateNotificationParams>
  ): Promise<void>;
  createBulkNotifications(
    userIds: string[], 
    params: Omit<CreateNotificationParams, "userId">
  ): Promise<void>;
  getUserPreferences(userId: string): Promise<NotificationPreference | null>;
  updateUserPreferences(userId: string, preferences: Partial<NotificationPreference>): Promise<void>;
  notifyAdminsOfFeedback(feedbackId: string, feedbackTitle: string): Promise<void>;
  notifyStaffOfRuleExtraction(extractionJobId: string, sectionName: string): Promise<void>;
  notifyNavigatorOfAssignment(navigatorId: string, clientCaseId: string, clientName: string): Promise<void>;
  notifyUserOfPolicyChange(userId: string, policyDescription: string): Promise<void>;
}

class NotificationService implements NotificationServiceInterface {
  
  async createNotification(params: CreateNotificationParams): Promise<void> {
    const {
      userId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      priority = "normal",
      actionUrl,
      metadata
    } = params;

    // Check user preferences
    const prefs = await this.getUserPreferences(userId);
    if (prefs && !prefs.inAppEnabled) {
      return; // User has disabled in-app notifications
    }

    // Check category-specific preferences
    if (prefs) {
      if (type === "policy_change" && !prefs.policyChanges) return;
      if (type === "feedback_new" && !prefs.feedbackAlerts) return;
      if (type === "navigator_assignment" && !prefs.navigatorAlerts) return;
      if (type === "system_alert" && !prefs.systemAlerts) return;
      if (type === "rule_extraction_complete" && !prefs.ruleExtractionAlerts) return;
    }

    await db.insert(notifications).values({
      userId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      priority,
      actionUrl,
      metadata,
      isRead: false
    });
  }

  async createNotificationFromTemplate(
    templateCode: string,
    userId: string,
    variables: Record<string, string>,
    options?: Partial<CreateNotificationParams>
  ): Promise<void> {
    const template = await db.query.notificationTemplates.findFirst({
      where: and(
        eq(notificationTemplates.code, templateCode),
        eq(notificationTemplates.isActive, true)
      )
    });

    if (!template) {
      console.error(`Notification template not found: ${templateCode}`);
      return;
    }

    // Replace placeholders in message template
    let message = template.messageTemplate;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    await this.createNotification({
      userId,
      type: template.type,
      title: template.title,
      message,
      priority: (options?.priority || template.priority) as any,
      ...options
    });
  }

  async createBulkNotifications(
    userIds: string[],
    params: Omit<CreateNotificationParams, "userId">
  ): Promise<void> {
    // Create notifications in batches to avoid overwhelming the DB
    const batchSize = 100;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      await Promise.all(
        batch.map(userId => 
          this.createNotification({ ...params, userId })
        )
      );
    }
  }

  async getUserPreferences(userId: string): Promise<NotificationPreference | null> {
    const prefs = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId)
    });

    // Create default preferences if none exist
    if (!prefs) {
      const [newPrefs] = await db.insert(notificationPreferences).values({
        userId,
        emailEnabled: true,
        inAppEnabled: true,
        policyChanges: true,
        feedbackAlerts: true,
        navigatorAlerts: true,
        systemAlerts: true,
        ruleExtractionAlerts: true
      }).returning();
      return newPrefs;
    }

    return prefs;
  }

  async updateUserPreferences(
    userId: string, 
    preferences: Partial<NotificationPreference>
  ): Promise<void> {
    // Check if preferences exist
    const existing = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId)
    });

    if (existing) {
      // Update existing preferences
      await db.update(notificationPreferences)
        .set({
          ...preferences,
          updatedAt: new Date()
        })
        .where(eq(notificationPreferences.userId, userId));
    } else {
      // Insert new preferences with defaults merged with provided values
      await db.insert(notificationPreferences).values({
        userId,
        emailEnabled: preferences.emailEnabled ?? true,
        inAppEnabled: preferences.inAppEnabled ?? true,
        policyChanges: preferences.policyChanges ?? true,
        feedbackAlerts: preferences.feedbackAlerts ?? true,
        navigatorAlerts: preferences.navigatorAlerts ?? true,
        systemAlerts: preferences.systemAlerts ?? true,
        ruleExtractionAlerts: preferences.ruleExtractionAlerts ?? true
      });
    }
  }

  // Convenience methods for common notification scenarios

  async notifyAdminsOfFeedback(feedbackId: string, feedbackTitle: string): Promise<void> {
    // Get all admin users
    const admins = await db.query.users.findMany({
      where: or(
        eq(users.role, "admin"),
        eq(users.role, "super_admin")
      )
    });

    await this.createBulkNotifications(
      admins.map(admin => admin.id),
      {
        type: "feedback_new",
        title: "New Feedback Submission",
        message: `New feedback received: "${feedbackTitle}"`,
        relatedEntityType: "feedback",
        relatedEntityId: feedbackId,
        priority: "normal",
        actionUrl: `/admin/feedback`
      }
    );
  }

  async notifyStaffOfRuleExtraction(extractionJobId: string, sectionName: string): Promise<void> {
    // Get all staff users (caseworkers, admins)
    const staff = await db.query.users.findMany({
      where: or(
        eq(users.role, "caseworker"),
        eq(users.role, "admin"),
        eq(users.role, "super_admin")
      )
    });

    await this.createBulkNotifications(
      staff.map(s => s.id),
      {
        type: "rule_extraction_complete",
        title: "Rule Extraction Complete",
        message: `Rules have been extracted from section "${sectionName}"`,
        relatedEntityType: "extraction_job",
        relatedEntityId: extractionJobId,
        priority: "normal",
        actionUrl: `/admin/rules/extraction`
      }
    );
  }

  async notifyNavigatorOfAssignment(
    navigatorId: string, 
    clientCaseId: string, 
    clientName: string
  ): Promise<void> {
    await this.createNotification({
      userId: navigatorId,
      type: "navigator_assignment",
      title: "New Client Assignment",
      message: `You have been assigned to client: ${clientName}`,
      relatedEntityType: "client_case",
      relatedEntityId: clientCaseId,
      priority: "high",
      actionUrl: `/navigator`
    });
  }

  async notifyUserOfPolicyChange(userId: string, policyDescription: string): Promise<void> {
    await this.createNotification({
      userId,
      type: "policy_change",
      title: "Policy Update",
      message: `Important policy change: ${policyDescription}`,
      priority: "high",
      actionUrl: "/manual"
    });
  }
}

export const notificationService = new NotificationService();
