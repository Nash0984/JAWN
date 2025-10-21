/**
 * BAR (Benefits Access Review) Notification Service
 * 
 * Production service for automated case checkpoint monitoring and notifications.
 * Sends reminders to caseworkers and supervisors to ensure timely case processing.
 * 
 * Features:
 * - Sends caseworker reminders 3 days and 1 day before checkpoints
 * - Sends supervisor review prompts for sampled cases
 * - Sends overdue alerts to both caseworkers and supervisors
 * - Tracks notification history to avoid duplicates
 * - Gracefully degrades when email service unavailable
 */

import { db } from "../db";
import {
  caseLifecycleEvents,
  benefitsAccessReviews,
  clientCases,
  users,
  type CaseLifecycleEvent,
  type BenefitsAccessReview,
} from "@shared/schema";
import { eq, and, gte, lte, isNull, or, sql } from "drizzle-orm";
import { emailService } from "./email.service";
import { caseworkerReminderTemplate } from "../templates/bar/caseworkerReminder";
import { supervisorReviewPromptTemplate } from "../templates/bar/supervisorReviewPrompt";
import { overdueAlertTemplate } from "../templates/bar/overdueAlert";
import { createLogger } from "./logger.service";

const logger = createLogger('BARNotification');

// ============================================================================
// TYPES
// ============================================================================

interface NotificationResult {
  success: boolean;
  checkpointId?: string;
  error?: string;
}

interface CheckpointData {
  checkpoint: CaseLifecycleEvent;
  caseworkerEmail: string;
  caseworkerName: string;
  caseId: string;
}

interface OverdueCheckpointData extends CheckpointData {
  supervisorEmail: string;
  supervisorName: string;
  daysOverdue: number;
}

// ============================================================================
// BAR NOTIFICATION SERVICE
// ============================================================================

export class BARNotificationService {
  
  /**
   * Send reminder to caseworker about upcoming checkpoint
   * Called for checkpoints due in 3 days or 1 day
   */
  async sendCaseworkerReminder(
    checkpointId: string,
    daysUntil: number
  ): Promise<NotificationResult> {
    logger.info('Sending caseworker reminder', { checkpointId, daysUntil });
    
    try {
      // Get checkpoint data
      const checkpointData = await this.getCheckpointData(checkpointId);
      if (!checkpointData) {
        const error = `Checkpoint ${checkpointId} not found`;
        logger.error('Checkpoint not found', { checkpointId, error });
        return { success: false, error };
      }
      
      const { checkpoint, caseworkerEmail, caseworkerName, caseId } = checkpointData;
      
      // Check if reminder already sent for this day count
      const reminderSentDays = checkpoint.reminderSentDays || [];
      if (reminderSentDays.includes(daysUntil)) {
        logger.info('Reminder already sent - skipping', { checkpointId, daysUntil });
        return { success: true, checkpointId };
      }
      
      // Validate caseworker email
      if (!caseworkerEmail) {
        const error = `Caseworker email not found for checkpoint ${checkpointId}`;
        logger.warn('Cannot send email - caseworker email not found', { checkpointId });
        return { success: false, error };
      }
      
      // Format due date
      const dueDate = checkpoint.expectedDate 
        ? new Date(checkpoint.expectedDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : 'Not specified';
      
      // Generate email content
      const emailContent = caseworkerReminderTemplate({
        caseworkerName,
        caseId,
        checkpointName: checkpoint.checkpointName,
        dueDate,
        daysUntil,
      });
      
      // Send email
      const emailSent = await emailService.sendEmail({
        to: caseworkerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
      
      if (!emailSent) {
        logger.warn('Email failed to send, but continuing', { caseworkerEmail, checkpointId });
      }
      
      // Update checkpoint: add to reminderSentDays array and set notificationSentAt
      const updatedReminderDays = [...reminderSentDays, daysUntil];
      
      await db.update(caseLifecycleEvents)
        .set({
          reminderSentDays: updatedReminderDays,
          notificationSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(caseLifecycleEvents.id, checkpointId));
      
      logger.info('Caseworker reminder sent', {
        checkpointId,
        caseworkerEmail,
        daysUntil
      });
      return { success: true, checkpointId };
      
    } catch (error) {
      const errorMsg = `Failed to send caseworker reminder: ${error}`;
      logger.error('Error in BAR operation', { error: errorMsg });
      return { success: false, checkpointId, error: errorMsg };
    }
  }
  
  /**
   * Send review prompt to supervisor for sampled case
   * Note: This requires adding supervisorNotifiedAt column to benefitsAccessReviews
   */
  async sendSupervisorReviewPrompt(reviewId: string): Promise<NotificationResult> {
    logger.info('Sending supervisor review prompt', { reviewId });
    
    try {
      // Get review data
      const review = await db.select()
        .from(benefitsAccessReviews)
        .where(eq(benefitsAccessReviews.id, reviewId))
        .limit(1);
      
      if (review.length === 0) {
        const error = `Review ${reviewId} not found`;
        logger.error('BAR operation error', { error });
        return { success: false, error };
      }
      
      const reviewData = review[0];
      
      // Get supervisor data
      const supervisorId = reviewData.supervisorId;
      if (!supervisorId) {
        const error = `No supervisor assigned to review ${reviewId}`;
        logger.warn('BAR operation warning', { error });
        return { success: false, error };
      }
      
      const supervisor = await db.select()
        .from(users)
        .where(eq(users.id, supervisorId))
        .limit(1);
      
      if (supervisor.length === 0 || !supervisor[0].email) {
        const error = `Supervisor email not found for review ${reviewId}`;
        logger.warn('BAR operation warning', { error });
        return { success: false, error };
      }
      
      const supervisorEmail = supervisor[0].email;
      const supervisorName = supervisor[0].fullName || supervisor[0].username;
      
      // Generate anonymized case ID (simplified - in production use proper anonymization)
      const anonymizedCaseId = reviewData.anonymizedCaseId || `ANON_${reviewId.substring(0, 8)}`;
      
      // Format review deadline
      const reviewDeadline = reviewData.reviewDeadline
        ? new Date(reviewData.reviewDeadline).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'Not specified';
      
      // Generate dashboard link
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'http://localhost:5000';
      const dashboardLink = `${baseUrl}/supervisor-cockpit?review=${reviewId}`;
      
      // Generate email content
      const emailContent = supervisorReviewPromptTemplate({
        supervisorName,
        anonymizedCaseId,
        reviewDeadline,
        dashboardLink,
      });
      
      // Send email
      const emailSent = await emailService.sendEmail({
        to: supervisorEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
      
      if (!emailSent) {
        logger.warn('Email failed to send to supervisor, but continuing', { supervisorEmail, reviewId });
      }
      
      // Update review: set supervisorNotifiedAt
      // Note: This requires adding the supervisorNotifiedAt column to schema
      // For now, we'll track in metadata
      const metadata = reviewData.metadata || {};
      await db.update(benefitsAccessReviews)
        .set({
          metadata: {
            ...metadata,
            supervisorNotifiedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(benefitsAccessReviews.id, reviewId));
      
      logger.info('Supervisor review prompt sent', { supervisorEmail, reviewId });
      return { success: true };
      
    } catch (error) {
      const errorMsg = `Failed to send supervisor review prompt: ${error}`;
      logger.error('Error in BAR operation', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }
  
  /**
   * Send overdue alert to both caseworker and supervisor
   */
  async sendOverdueAlert(checkpointId: string): Promise<NotificationResult> {
    logger.info('Sending overdue alert', { checkpointId });
    
    try {
      // Get checkpoint and extended data
      const overdueData = await this.getOverdueCheckpointData(checkpointId);
      if (!overdueData) {
        const error = `Checkpoint ${checkpointId} not found or incomplete data`;
        logger.error('BAR operation error', { error });
        return { success: false, error };
      }
      
      const { checkpoint, caseworkerEmail, caseworkerName, supervisorEmail, supervisorName, daysOverdue, caseId } = overdueData;
      
      // Check if alert already sent in last 24 hours (avoid spam)
      if (checkpoint.overdueAlertSentAt) {
        const lastAlertTime = new Date(checkpoint.overdueAlertSentAt).getTime();
        const now = new Date().getTime();
        const hoursSinceLastAlert = (now - lastAlertTime) / (1000 * 60 * 60);
        
        if (hoursSinceLastAlert < 24) {
          logger.info('Overdue alert recently sent - skipping', { 
            checkpointId, 
            hoursSinceLastAlert: hoursSinceLastAlert.toFixed(1) 
          });
          return { success: true, checkpointId };
        }
      }
      
      // Determine urgency (> 5 days = urgent)
      const isUrgent = daysOverdue > 5;
      
      // Generate email content
      const emailContent = overdueAlertTemplate({
        recipientName: caseworkerName,
        checkpointName: checkpoint.checkpointName,
        caseId,
        daysOverdue,
        isUrgent,
      });
      
      // Send to caseworker
      if (caseworkerEmail) {
        const caseworkerEmailSent = await emailService.sendEmail({
          to: caseworkerEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
        
        if (caseworkerEmailSent) {
          logger.info('Overdue alert sent to caseworker', { checkpointId, caseworkerEmail });
        } else {
          logger.warn('Failed to send overdue alert to caseworker', { checkpointId, caseworkerEmail });
        }
      }
      
      // Send to supervisor
      if (supervisorEmail) {
        const supervisorEmailContent = overdueAlertTemplate({
          recipientName: supervisorName,
          checkpointName: checkpoint.checkpointName,
          caseId,
          daysOverdue,
          isUrgent,
        });
        
        const supervisorEmailSent = await emailService.sendEmail({
          to: supervisorEmail,
          subject: supervisorEmailContent.subject,
          html: supervisorEmailContent.html,
          text: supervisorEmailContent.text,
        });
        
        if (supervisorEmailSent) {
          logger.info('Overdue alert sent to supervisor', { checkpointId, supervisorEmail });
        } else {
          logger.warn('Failed to send overdue alert to supervisor', { checkpointId, supervisorEmail });
        }
      }
      
      // Update checkpoint: set overdueAlertSentAt
      await db.update(caseLifecycleEvents)
        .set({
          overdueAlertSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(caseLifecycleEvents.id, checkpointId));
      
      logger.info('Overdue alert processing complete', { checkpointId });
      return { success: true, checkpointId };
      
    } catch (error) {
      const errorMsg = `Failed to send overdue alert: ${error}`;
      logger.error('Error in BAR operation', { error: errorMsg });
      return { success: false, checkpointId, error: errorMsg };
    }
  }
  
  /**
   * Check for upcoming checkpoints and send reminders
   * Runs daily at 9 AM via smart scheduler
   */
  async checkUpcomingCheckpoints(): Promise<number> {
    logger.info('Checking for upcoming checkpoints', { service: 'BARNotificationService' });
    
    try {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
      
      // Query for checkpoints due in 3 days or 1 day
      // Status must be 'pending' and expectedDate must be within range
      const upcomingCheckpoints = await db.select()
        .from(caseLifecycleEvents)
        .where(
          and(
            eq(caseLifecycleEvents.status, 'pending'),
            gte(caseLifecycleEvents.expectedDate, now),
            lte(caseLifecycleEvents.expectedDate, threeDaysFromNow)
          )
        );
      
      logger.info('Found upcoming checkpoints', { count: upcomingCheckpoints.length });
      
      let notificationsSent = 0;
      
      for (const checkpoint of upcomingCheckpoints) {
        if (!checkpoint.expectedDate) continue;
        
        // Calculate days until due
        const expectedDate = new Date(checkpoint.expectedDate);
        const daysUntil = Math.ceil((expectedDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        
        // Only send for 3-day and 1-day reminders
        if (daysUntil !== 3 && daysUntil !== 1) {
          continue;
        }
        
        // Check if reminder already sent for this day count
        const reminderSentDays = checkpoint.reminderSentDays || [];
        if (reminderSentDays.includes(daysUntil)) {
          logger.info('Reminder already sent for checkpoint', { 
            checkpointId: checkpoint.id, 
            daysUntil 
          });
          continue;
        }
        
        // Send reminder
        const result = await this.sendCaseworkerReminder(checkpoint.id, daysUntil);
        if (result.success) {
          notificationsSent++;
        }
      }
      
      logger.info('Upcoming checkpoint reminders sent', { notificationsSent });
      return notificationsSent;
      
    } catch (error) {
      logger.error('Error checking upcoming checkpoints', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return 0;
    }
  }
  
  /**
   * Check for overdue checkpoints and send alerts
   * Runs daily at 9 AM via smart scheduler
   */
  async checkOverdueCheckpoints(): Promise<number> {
    logger.info('Checking for overdue checkpoints', { service: 'BARNotificationService' });
    
    try {
      const now = new Date();
      
      // Query for overdue checkpoints
      // Status must be 'pending' or 'overdue' and expectedDate must be in the past
      const overdueCheckpoints = await db.select()
        .from(caseLifecycleEvents)
        .where(
          and(
            or(
              eq(caseLifecycleEvents.status, 'pending'),
              eq(caseLifecycleEvents.status, 'overdue')
            ),
            lte(caseLifecycleEvents.expectedDate, now)
          )
        );
      
      logger.info('Found overdue checkpoints', { count: overdueCheckpoints.length });
      
      let alertsSent = 0;
      
      for (const checkpoint of overdueCheckpoints) {
        // Check if alert sent in last 24 hours
        if (checkpoint.overdueAlertSentAt) {
          const lastAlertTime = new Date(checkpoint.overdueAlertSentAt).getTime();
          const hoursSinceLastAlert = (now.getTime() - lastAlertTime) / (1000 * 60 * 60);
          
          if (hoursSinceLastAlert < 24) {
            continue;
          }
        }
        
        // Update status to 'overdue' if still 'pending'
        if (checkpoint.status === 'pending') {
          await db.update(caseLifecycleEvents)
            .set({
              status: 'overdue',
              updatedAt: new Date(),
            })
            .where(eq(caseLifecycleEvents.id, checkpoint.id));
        }
        
        // Send overdue alert
        const result = await this.sendOverdueAlert(checkpoint.id);
        if (result.success) {
          alertsSent++;
        }
      }
      
      logger.info('Overdue checkpoint alerts sent', { alertsSent });
      return alertsSent;
      
    } catch (error) {
      logger.error('Error checking overdue checkpoints', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  /**
   * Get checkpoint data with caseworker information
   */
  private async getCheckpointData(checkpointId: string): Promise<CheckpointData | null> {
    try {
      const result = await db.select({
        checkpoint: caseLifecycleEvents,
        caseworkerEmail: users.email,
        caseworkerName: users.fullName,
        caseworkerUsername: users.username,
        caseId: clientCases.id,
      })
        .from(caseLifecycleEvents)
        .innerJoin(clientCases, eq(caseLifecycleEvents.caseId, clientCases.id))
        .innerJoin(users, eq(clientCases.userId, users.id))
        .where(eq(caseLifecycleEvents.id, checkpointId))
        .limit(1);
      
      if (result.length === 0) {
        return null;
      }
      
      const row = result[0];
      return {
        checkpoint: row.checkpoint,
        caseworkerEmail: row.caseworkerEmail || '',
        caseworkerName: row.caseworkerName || row.caseworkerUsername || 'Caseworker',
        caseId: row.caseId,
      };
    } catch (error) {
      logger.error('Error fetching checkpoint data', {
        checkpointId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
  
  /**
   * Get overdue checkpoint data with both caseworker and supervisor information
   */
  private async getOverdueCheckpointData(checkpointId: string): Promise<OverdueCheckpointData | null> {
    try {
      // First get checkpoint and caseworker data
      const checkpointData = await this.getCheckpointData(checkpointId);
      if (!checkpointData) {
        return null;
      }
      
      // Calculate days overdue
      const now = new Date();
      const expectedDate = checkpointData.checkpoint.expectedDate 
        ? new Date(checkpointData.checkpoint.expectedDate) 
        : now;
      const daysOverdue = Math.ceil((now.getTime() - expectedDate.getTime()) / (24 * 60 * 60 * 1000));
      
      // Get supervisor info (via review)
      const review = await db.select({
        supervisorId: benefitsAccessReviews.supervisorId,
      })
        .from(benefitsAccessReviews)
        .where(eq(benefitsAccessReviews.id, checkpointData.checkpoint.reviewId))
        .limit(1);
      
      let supervisorEmail = '';
      let supervisorName = 'Supervisor';
      
      if (review.length > 0 && review[0].supervisorId) {
        const supervisor = await db.select()
          .from(users)
          .where(eq(users.id, review[0].supervisorId))
          .limit(1);
        
        if (supervisor.length > 0) {
          supervisorEmail = supervisor[0].email || '';
          supervisorName = supervisor[0].fullName || supervisor[0].username || 'Supervisor';
        }
      }
      
      return {
        ...checkpointData,
        supervisorEmail,
        supervisorName,
        daysOverdue,
      };
    } catch (error) {
      logger.error('Error fetching overdue checkpoint data', {
        checkpointId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
}

// Export singleton instance
export const barNotificationService = new BARNotificationService();
