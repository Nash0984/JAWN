/**
 * Alert Service
 * 
 * Monitors metrics and sends alerts when thresholds are exceeded
 * Prevents alert spam with rate limiting and cooldown periods
 */

import { db } from "../db";
import { alertHistory, type InsertAlertHistory } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { ALERT_THRESHOLDS, CRITICAL_ERROR_PATTERNS, ALERT_CHANNELS, ALERT_RATE_LIMITS } from "../config/alerts";
import { metricsService } from "./metricsService";

interface AlertContext {
  metric: string;
  value: number;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  metadata?: Record<string, any>;
  tenantId?: string | null;
}

export class AlertService {
  private alertCounts: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Check all metric thresholds and send alerts if needed
   */
  async checkThresholds(tenantId?: string | null): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    for (const threshold of ALERT_THRESHOLDS) {
      try {
        const windowStart = new Date(now.getTime() - threshold.window * 1000);
        
        // Get metric summary for the time window, filtered by tenantId if provided
        const summary = await metricsService.getMetricsSummary(
          threshold.metric,
          windowStart,
          now,
          tenantId
        );

        if (!summary) continue;

        // Check if threshold is exceeded
        let shouldAlert = false;
        let actualValue = 0;

        if (threshold.metric.includes('rate')) {
          // For rates, use average
          actualValue = summary.avg;
          shouldAlert = actualValue > threshold.threshold;
        } else if (threshold.metric.includes('p95')) {
          actualValue = summary.p95;
          shouldAlert = actualValue > threshold.threshold;
        } else if (threshold.metric.includes('p50')) {
          actualValue = summary.p50;
          shouldAlert = actualValue > threshold.threshold;
        } else {
          actualValue = summary.avg;
          shouldAlert = actualValue > threshold.threshold;
        }

        if (shouldAlert) {
          await this.sendAlert({
            metric: threshold.metric,
            value: actualValue,
            threshold: threshold.threshold,
            severity: threshold.severity,
            metadata: {
              description: threshold.description,
              summary,
            },
            tenantId,
          });
        }
      } catch (error) {
        console.error(`Failed to check threshold for ${threshold.metric}:`, error);
      }
    }
  }

  /**
   * Check for critical error patterns in recent errors
   */
  async checkCriticalPatterns(tenantId?: string | null): Promise<void> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const topErrors = await metricsService.getTopErrors(fiveMinutesAgo, now, 20, tenantId);

    for (const error of topErrors) {
      const errorType = error.errorType.toLowerCase();
      
      for (const pattern of CRITICAL_ERROR_PATTERNS) {
        if (errorType.includes(pattern.toLowerCase())) {
          await this.sendAlert({
            metric: 'critical_error_pattern',
            value: error.count,
            threshold: 0,
            severity: 'critical',
            metadata: {
              description: `Critical error pattern detected: ${pattern}`,
              errorType: error.errorType,
              count: error.count,
              lastOccurrence: error.lastOccurrence,
            },
            tenantId,
          });
          break;
        }
      }
    }
  }

  /**
   * Send an alert through configured channels
   */
  async sendAlert(context: AlertContext): Promise<void> {
    // Check rate limits
    if (!this.shouldSendAlert(context.metric)) {
      console.log(`Alert rate limited for metric: ${context.metric}`);
      return;
    }

    const message = this.buildAlertMessage(context);
    const channels: string[] = [];

    // Send through all enabled channels
    for (const channel of ALERT_CHANNELS) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'console':
            this.sendConsoleAlert(message, context);
            channels.push('console');
            break;
          case 'email':
            await this.sendEmailAlert(message, context, channel.config);
            channels.push('email');
            break;
          case 'slack':
            await this.sendSlackAlert(message, context, channel.config);
            channels.push('slack');
            break;
          case 'webhook':
            await this.sendWebhookAlert(message, context, channel.config);
            channels.push('webhook');
            break;
        }
      } catch (error) {
        console.error(`Failed to send alert via ${channel.type}:`, error);
      }
    }

    // Record alert in history with tenantId for proper isolation
    try {
      await db.insert(alertHistory).values({
        alertType: context.metric,
        severity: context.severity,
        message,
        metadata: context.metadata as any,
        channels: channels as any,
        resolved: false,
        tenantId: context.tenantId || null,
      });
    } catch (error) {
      console.error("Failed to record alert history:", error);
    }

    // Update rate limit counter
    this.incrementAlertCount(context.metric);
  }

  /**
   * Build alert message
   */
  private buildAlertMessage(context: AlertContext): string {
    const emoji = context.severity === 'critical' ? '🚨' : context.severity === 'warning' ? '⚠️' : 'ℹ️';
    
    return `${emoji} ${context.severity.toUpperCase()} ALERT: ${context.metadata?.description || context.metric}
    
Metric: ${context.metric}
Current Value: ${context.value.toFixed(2)}
Threshold: ${context.threshold}
Time: ${new Date().toISOString()}

${context.metadata ? `Additional Context:\n${JSON.stringify(context.metadata, null, 2)}` : ''}`;
  }

  /**
   * Send console alert (always enabled)
   */
  private sendConsoleAlert(message: string, context: AlertContext): void {
    const logLevel = context.severity === 'critical' || context.severity === 'warning' ? 'error' : 'warn';
    console[logLevel]('\n' + '='.repeat(80));
    console[logLevel](message);
    console[logLevel]('='.repeat(80) + '\n');
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(message: string, context: AlertContext, config: any): Promise<void> {
    // Email sending would integrate with your email service
    // For now, just log
    console.log(`[EMAIL ALERT] To: ${config.to}`, message);
    
    // TODO: Integrate with email service (e.g., Nodemailer, SendGrid, etc.)
    // const emailService = require('./email.service');
    // await emailService.sendEmail({
    //   to: config.to,
    //   from: config.from,
    //   subject: `[${context.severity.toUpperCase()}] Alert: ${context.metric}`,
    //   text: message,
    // });
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(message: string, context: AlertContext, config: any): Promise<void> {
    if (!config.webhookUrl) return;

    try {
      const color = context.severity === 'critical' ? 'danger' : context.severity === 'warning' ? 'warning' : 'good';
      
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: config.channel,
          username: config.username,
          attachments: [{
            color,
            title: `${context.severity.toUpperCase()} Alert: ${context.metric}`,
            text: message,
            ts: Math.floor(Date.now() / 1000),
          }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to send Slack alert:", error);
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(message: string, context: AlertContext, config: any): Promise<void> {
    if (!config.url) return;

    try {
      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify({
          metric: context.metric,
          value: context.value,
          threshold: context.threshold,
          severity: context.severity,
          message,
          metadata: context.metadata,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to send webhook alert:", error);
    }
  }

  /**
   * Check if alert should be sent based on rate limits
   */
  private shouldSendAlert(metric: string): boolean {
    const now = Date.now();
    const key = metric;
    const existing = this.alertCounts.get(key);

    // Reset counter if cooldown period has passed
    if (existing && now > existing.resetTime) {
      this.alertCounts.delete(key);
      return true;
    }

    // Check if we've exceeded the rate limit
    if (existing && existing.count >= ALERT_RATE_LIMITS.maxAlertsPerMetricPerHour) {
      return false;
    }

    return true;
  }

  /**
   * Increment alert count for rate limiting
   */
  private incrementAlertCount(metric: string): void {
    const now = Date.now();
    const key = metric;
    const existing = this.alertCounts.get(key);

    if (existing) {
      existing.count++;
    } else {
      this.alertCounts.set(key, {
        count: 1,
        resetTime: now + ALERT_RATE_LIMITS.alertCooldownPeriod * 1000,
      });
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    try {
      await db
        .update(alertHistory)
        .set({
          resolved: true,
          resolvedAt: new Date(),
        })
        .where(eq(alertHistory.id, alertId));
    } catch (error) {
      console.error("Failed to resolve alert:", error);
    }
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts(limit: number = 50, severity?: string, tenantId?: string | null): Promise<any[]> {
    try {
      const conditions = [];
      
      if (severity) {
        conditions.push(eq(alertHistory.severity, severity));
      }

      if (tenantId) {
        conditions.push(eq(alertHistory.tenantId, tenantId));
      }

      const query = db
        .select()
        .from(alertHistory)
        .orderBy(desc(alertHistory.createdAt))
        .limit(limit);

      if (conditions.length > 0) {
        return await query.where(and(...conditions));
      }

      return await query;
    } catch (error) {
      console.error("Failed to get recent alerts:", error);
      return [];
    }
  }
}

export const alertService = new AlertService();

// Run threshold checks every 5 minutes
setInterval(() => {
  alertService.checkThresholds().catch(console.error);
  alertService.checkCriticalPatterns().catch(console.error);
}, 5 * 60 * 1000);

console.log("📊 Alert service initialized - checking thresholds every 5 minutes");
