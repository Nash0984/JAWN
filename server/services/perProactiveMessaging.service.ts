/**
 * PER Proactive Messaging Framework
 * 
 * Per PTIG specifications: Risk-driven SMS/email automation for:
 * - Missing verification reminders
 * - Deadline notifications
 * - Work requirement alerts
 * - Redetermination reminders
 */

import { db } from "../db";
import { notificationService } from "./notification.service";
import { emailService } from "./email.service";
import { logger } from "./logger.service";
import { perCaseworkerNudges, clientCases, users } from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

export interface ProactiveMessage {
  templateType: string;
  recipientType: 'client' | 'caseworker';
  recipientId: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channels: ('in_app' | 'email' | 'sms')[];
  subject: string;
  body: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface RiskThreshold {
  riskScore: number;
  escalationLevel: 'warning' | 'critical' | 'urgent';
  daysUntilDeadline: number;
}

const MESSAGE_TEMPLATES: Record<string, { subject: string; body: string }> = {
  missing_income_verification: {
    subject: "Action Required: Income Verification Needed",
    body: `Your SNAP case requires income verification. Please submit your most recent 4 pay stubs or proof of income by {deadline}. Failure to provide this documentation may affect your benefits.

What you need to do:
1. Gather your most recent pay stubs (last 4 weeks)
2. If self-employed, provide your Schedule SE or profit/loss statement
3. Submit documents online at {actionUrl} or bring to your local office

Need help? Call 1-800-332-6347 or visit {actionUrl}
`
  },
  missing_shelter_verification: {
    subject: "Action Required: Housing Cost Documentation Needed",
    body: `Your SNAP case requires documentation of your housing costs. Please submit proof of your rent or mortgage payment and utility bills by {deadline}.

What you need to do:
1. Provide a copy of your lease or mortgage statement
2. Submit recent utility bills (electric, gas, water)
3. Submit documents online at {actionUrl} or bring to your local office

Need help? Call 1-800-332-6347
`
  },
  abawd_work_requirement_warning: {
    subject: "Important: SNAP Work Requirement Notice",
    body: `As an able-bodied adult without dependents (ABAWD), you must meet work requirements to continue receiving SNAP benefits.

Current Status:
- Months of benefits used: {monthsUsed}/3
- Work hours reported this month: {hoursReported}

To maintain your benefits, you must:
- Work at least 80 hours per month, OR
- Participate in approved training/education, OR
- Apply for an exemption if you qualify

Report your work hours at {actionUrl} or call 1-800-332-6347.
`
  },
  redetermination_reminder_30day: {
    subject: "SNAP Renewal Required - 30 Days Remaining",
    body: `Your SNAP benefits certification period ends on {certEndDate}. You must complete your renewal to continue receiving benefits.

What you need to do:
1. Complete your renewal form online at {actionUrl}
2. Provide updated income and household information
3. Submit any requested documentation

Don't wait - renew now at {actionUrl} to avoid a gap in benefits.
`
  },
  redetermination_reminder_10day: {
    subject: "URGENT: SNAP Renewal Deadline Approaching",
    body: `Your SNAP benefits will end on {certEndDate} - only 10 days remaining!

Complete your renewal TODAY at {actionUrl} to avoid losing your benefits.

Need help? Call 1-800-332-6347 immediately.
`
  },
  high_risk_case_alert: {
    subject: "High-Risk Case Alert - Review Required",
    body: `Case #{caseNumber} has been flagged for high payment error risk.

Risk Category: {errorCategory}
Risk Score: {riskScore}%
Flagged Date: {flaggedDate}

Recommended Actions:
{aiGuidance}

Review this case immediately at {actionUrl}
`
  },
  nudge_compliance_reminder: {
    subject: "AI Nudge Follow-up Required",
    body: `You have {pendingNudges} pending AI guidance alerts that require acknowledgment.

Most Critical:
- Case #{caseNumber}: {nudgeType}
- Risk Level: {riskLevel}

Please review and acknowledge these alerts at {actionUrl}

Timely response to AI guidance helps maintain quality standards and prevents payment errors.
`
  }
};

class PerProactiveMessagingService {
  
  async sendProactiveMessage(message: ProactiveMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const messageId = `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
      
      logger.info('Sending proactive message', {
        messageId,
        templateType: message.templateType,
        recipientType: message.recipientType,
        recipientId: message.recipientId,
        priority: message.priority,
        channels: message.channels
      });

      // In-app notification
      if (message.channels.includes('in_app')) {
        await notificationService.createNotification({
          userId: message.recipientId,
          type: `per_${message.templateType}`,
          title: message.subject,
          message: message.body,
          priority: message.priority,
          actionUrl: message.actionUrl,
          metadata: message.metadata
        });
      }

      // Email notification
      if (message.channels.includes('email')) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, message.recipientId)
        });

        if (user?.email) {
          await emailService.sendEmail({
            to: user.email,
            subject: message.subject,
            text: message.body,
            html: this.formatEmailHtml(message)
          });
        }
      }

      // SMS notification (placeholder - would integrate with Twilio or similar)
      if (message.channels.includes('sms')) {
        logger.info('SMS notification queued', {
          messageId,
          recipientId: message.recipientId,
          note: 'SMS integration pending - would send via Twilio'
        });
      }

      return { success: true, messageId };
    } catch (error) {
      logger.error('Failed to send proactive message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateType: message.templateType,
        recipientId: message.recipientId
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendMissingVerificationReminder(
    clientId: string, 
    verificationType: 'income' | 'shelter' | 'household' | 'work_status',
    deadline: Date,
    actionUrl: string
  ): Promise<void> {
    const templateKey = `missing_${verificationType}_verification`;
    const template = MESSAGE_TEMPLATES[templateKey] || MESSAGE_TEMPLATES.missing_income_verification;

    const body = template.body
      .replace('{deadline}', deadline.toLocaleDateString())
      .replace(/{actionUrl}/g, actionUrl);

    await this.sendProactiveMessage({
      templateType: templateKey,
      recipientType: 'client',
      recipientId: clientId,
      priority: this.getPriorityFromDeadline(deadline),
      channels: ['in_app', 'email'],
      subject: template.subject,
      body,
      actionUrl,
      metadata: { verificationType, deadline: deadline.toISOString() }
    });
  }

  async sendRedeterminationReminder(
    clientId: string,
    certEndDate: Date,
    actionUrl: string
  ): Promise<void> {
    const daysRemaining = Math.ceil((certEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    let templateKey = 'redetermination_reminder_30day';
    let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
    
    if (daysRemaining <= 10) {
      templateKey = 'redetermination_reminder_10day';
      priority = 'urgent';
    } else if (daysRemaining <= 30) {
      templateKey = 'redetermination_reminder_30day';
      priority = 'high';
    }

    const template = MESSAGE_TEMPLATES[templateKey];
    const body = template.body
      .replace('{certEndDate}', certEndDate.toLocaleDateString())
      .replace(/{actionUrl}/g, actionUrl);

    await this.sendProactiveMessage({
      templateType: templateKey,
      recipientType: 'client',
      recipientId: clientId,
      priority,
      channels: ['in_app', 'email'],
      subject: template.subject,
      body,
      actionUrl,
      metadata: { certEndDate: certEndDate.toISOString(), daysRemaining }
    });
  }

  async sendAbawdWorkRequirementAlert(
    clientId: string,
    monthsUsed: number,
    hoursReported: number,
    actionUrl: string
  ): Promise<void> {
    const template = MESSAGE_TEMPLATES.abawd_work_requirement_warning;
    
    const body = template.body
      .replace('{monthsUsed}', monthsUsed.toString())
      .replace('{hoursReported}', hoursReported.toString())
      .replace(/{actionUrl}/g, actionUrl);

    const priority = monthsUsed >= 2 ? 'urgent' : monthsUsed >= 1 ? 'high' : 'normal';

    await this.sendProactiveMessage({
      templateType: 'abawd_work_requirement_warning',
      recipientType: 'client',
      recipientId: clientId,
      priority,
      channels: ['in_app', 'email'],
      subject: template.subject,
      body,
      actionUrl,
      metadata: { monthsUsed, hoursReported }
    });
  }

  async sendHighRiskCaseAlert(
    caseworkerId: string,
    caseNumber: string,
    errorCategory: string,
    riskScore: number,
    aiGuidance: string,
    actionUrl: string
  ): Promise<void> {
    const template = MESSAGE_TEMPLATES.high_risk_case_alert;
    
    const body = template.body
      .replace('{caseNumber}', caseNumber)
      .replace('{errorCategory}', errorCategory)
      .replace('{riskScore}', (riskScore * 100).toFixed(0))
      .replace('{flaggedDate}', new Date().toLocaleDateString())
      .replace('{aiGuidance}', aiGuidance)
      .replace(/{actionUrl}/g, actionUrl);

    const priority = riskScore > 0.8 ? 'urgent' : riskScore > 0.6 ? 'high' : 'normal';

    await this.sendProactiveMessage({
      templateType: 'high_risk_case_alert',
      recipientType: 'caseworker',
      recipientId: caseworkerId,
      priority,
      channels: ['in_app', 'email'],
      subject: template.subject,
      body,
      actionUrl,
      metadata: { caseNumber, errorCategory, riskScore }
    });
  }

  async sendNudgeComplianceReminder(
    caseworkerId: string,
    pendingNudges: number,
    topCase: { caseNumber: string; nudgeType: string; riskLevel: string },
    actionUrl: string
  ): Promise<void> {
    const template = MESSAGE_TEMPLATES.nudge_compliance_reminder;
    
    const body = template.body
      .replace('{pendingNudges}', pendingNudges.toString())
      .replace('{caseNumber}', topCase.caseNumber)
      .replace('{nudgeType}', topCase.nudgeType)
      .replace('{riskLevel}', topCase.riskLevel)
      .replace(/{actionUrl}/g, actionUrl);

    await this.sendProactiveMessage({
      templateType: 'nudge_compliance_reminder',
      recipientType: 'caseworker',
      recipientId: caseworkerId,
      priority: pendingNudges > 5 ? 'high' : 'normal',
      channels: ['in_app'],
      subject: template.subject,
      body,
      actionUrl,
      metadata: { pendingNudges, topCase }
    });
  }

  async processDailyProactiveMessages(): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    try {
      // Find cases with pending high-risk nudges not acknowledged
      const pendingHighRiskCases = await db.select({
        caseworkerId: perCaseworkerNudges.caseworkerId,
        caseId: perCaseworkerNudges.caseId,
        caseNumber: clientCases.caseNumber,
        nudgeType: perCaseworkerNudges.nudgeType,
        riskScore: perCaseworkerNudges.riskScore,
        nudgeMessage: perCaseworkerNudges.nudgeMessage,
        errorCategory: perCaseworkerNudges.errorCategory
      })
      .from(perCaseworkerNudges)
      .innerJoin(clientCases, eq(perCaseworkerNudges.caseId, clientCases.id))
      .where(and(
        eq(perCaseworkerNudges.nudgeStatus, 'pending'),
        gte(perCaseworkerNudges.riskScore, 0.7)
      ))
      .limit(50);

      // Group by caseworker and send consolidated alerts
      const caseworkerNudges: Map<string, typeof pendingHighRiskCases> = new Map();
      
      for (const nudge of pendingHighRiskCases) {
        if (nudge.caseworkerId) {
          const existing = caseworkerNudges.get(nudge.caseworkerId) || [];
          existing.push(nudge);
          caseworkerNudges.set(nudge.caseworkerId, existing);
        }
      }

      for (const [caseworkerId, nudges] of caseworkerNudges) {
        try {
          const topNudge = nudges[0];
          await this.sendNudgeComplianceReminder(
            caseworkerId,
            nudges.length,
            {
              caseNumber: topNudge.caseNumber || 'Unknown',
              nudgeType: topNudge.nudgeType || 'Risk Alert',
              riskLevel: (topNudge.riskScore || 0) > 0.8 ? 'Critical' : 'High'
            },
            '/caseworker/cockpit'
          );
          sent++;
        } catch (error) {
          failed++;
          logger.error('Failed to send nudge reminder', {
            caseworkerId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('Daily proactive messaging completed', {
        totalCaseworkers: caseworkerNudges.size,
        messagesSent: sent,
        messagesFailed: failed
      });

    } catch (error) {
      logger.error('Error in daily proactive messaging', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return { sent, failed };
  }

  private getPriorityFromDeadline(deadline: Date): 'low' | 'normal' | 'high' | 'urgent' {
    const daysRemaining = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= 3) return 'urgent';
    if (daysRemaining <= 7) return 'high';
    if (daysRemaining <= 14) return 'normal';
    return 'low';
  }

  private formatEmailHtml(message: ProactiveMessage): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8fafc; }
          .action-button { 
            display: inline-block; 
            background: #2563eb; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Maryland Benefits Navigator</h1>
          </div>
          <div class="content">
            <h2>${message.subject}</h2>
            ${message.body.split('\n').map(line => `<p>${line}</p>`).join('')}
            ${message.actionUrl ? `<a href="${message.actionUrl}" class="action-button">Take Action Now</a>` : ''}
          </div>
          <div class="footer">
            <p>This is an automated message from the Maryland Benefits Navigator system.</p>
            <p>If you have questions, call 1-800-332-6347</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const perProactiveMessagingService = new PerProactiveMessagingService();
