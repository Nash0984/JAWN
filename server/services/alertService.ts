/**
 * Alert Service - Database-Driven Alert Rules System
 * 
 * Monitors metrics and sends alerts when thresholds are exceeded.
 * Supports email, SMS, and in-app notifications with cooldown protection.
 */

import { db } from "../db";
import { alertRules, alertHistory, users, type AlertRule, type InsertAlertHistory } from "@shared/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { metricsService } from "./metricsService";
import { notificationService } from "./notification.service";
import { emailService } from "./email.service";
import { sendSMS } from "./smsService";

export class AlertService {
  /**
   * Check all enabled alert rules against current metrics
   */
  async evaluateAlerts(tenantId?: string): Promise<void> {
    try {
      const rules = await this.getEnabledRules(tenantId);
      
      if (rules.length === 0) {
        return;
      }

      const timeRange = {
        start: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        end: new Date()
      };

      const metrics = await metricsService.getAllMetrics(timeRange, tenantId || undefined);
      
      for (const rule of rules) {
        await this.evaluateRule(rule, metrics);
      }
    } catch (error) {
      console.error('Error evaluating alerts:', error);
    }
  }

  /**
   * Get all enabled alert rules
   */
  private async getEnabledRules(tenantId?: string): Promise<AlertRule[]> {
    const conditions = [eq(alertRules.enabled, true)];
    
    if (tenantId) {
      conditions.push(eq(alertRules.tenantId, tenantId));
    }

    return await db.query.alertRules.findMany({
      where: and(...conditions)
    });
  }

  /**
   * Evaluate single rule against metrics
   */
  private async evaluateRule(rule: AlertRule, metrics: any): Promise<void> {
    try {
      // Extract metric value based on metricType
      const metricValue = this.extractMetricValue(rule.metricType, metrics);
      
      if (metricValue === null || metricValue === undefined) {
        return; // Metric not available
      }
      
      // Check threshold
      const triggered = this.checkThreshold(metricValue, rule.threshold, rule.comparison);
      
      if (triggered) {
        // Check cooldown
        if (this.isInCooldown(rule)) {
          return;
        }
        
        // Trigger alert
        await this.triggerAlert(rule, metricValue);
      }
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
    }
  }

  /**
   * Trigger alert and send notifications
   */
  private async triggerAlert(rule: AlertRule, metricValue: number): Promise<void> {
    const message = `Alert: ${rule.name} - ${rule.metricType} is ${metricValue.toFixed(2)} (threshold: ${rule.threshold})`;
    
    // Record in alert_history
    await db.insert(alertHistory).values({
      alertType: rule.metricType,
      severity: rule.severity,
      message,
      channels: rule.channels,
      tenantId: rule.tenantId || null,
    });

    // Update lastTriggered
    await db.update(alertRules)
      .set({ lastTriggered: new Date() })
      .where(eq(alertRules.id, rule.id));

    // Send notifications via channels
    await this.sendNotifications(rule, metricValue, message);
    
    console.log(`🚨 Alert triggered: ${rule.name} (${rule.severity}) - Value: ${metricValue}`);
  }

  /**
   * Send notifications via email/SMS/in-app
   */
  private async sendNotifications(rule: AlertRule, metricValue: number, message: string): Promise<void> {
    try {
      const channels = rule.channels as string[];
      const recipients = await this.getRecipients(rule);
      
      if (recipients.length === 0) {
        console.warn(`No recipients found for alert rule: ${rule.name}`);
        return;
      }

      for (const user of recipients) {
        // In-app notification
        if (channels.includes('in_app')) {
          try {
            await notificationService.createNotification({
              userId: user.id,
              type: 'system_alert',
              title: `Alert: ${rule.name}`,
              message: `${rule.metricType} is ${metricValue.toFixed(2)} (threshold: ${rule.threshold})`,
              priority: rule.severity === 'critical' ? 'urgent' : 'high',
            });
          } catch (error) {
            console.error(`Failed to create in-app notification for user ${user.id}:`, error);
          }
        }

        // Email notification
        if (channels.includes('email') && user.email) {
          try {
            await emailService.sendNotificationEmail(
              user.email,
              `Alert: ${rule.name}`,
              message
            );
          } catch (error) {
            console.error(`Failed to send email to ${user.email}:`, error);
          }
        }

        // SMS notification
        if (channels.includes('sms') && user.phone && rule.tenantId) {
          try {
            await sendSMS(
              user.phone,
              `ALERT: ${rule.name} - ${rule.metricType} is ${metricValue.toFixed(2)}`,
              rule.tenantId
            );
          } catch (error) {
            console.error(`Failed to send SMS to ${user.phone}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  /**
   * Get alert recipients (by user IDs or roles)
   */
  private async getRecipients(rule: AlertRule): Promise<Array<{ id: string; email: string | null; phone: string | null }>> {
    const conditions = [];

    // Get users by specific IDs
    if (rule.recipientUserIds && Array.isArray(rule.recipientUserIds) && rule.recipientUserIds.length > 0) {
      conditions.push(inArray(users.id, rule.recipientUserIds as string[]));
    }

    // Get users by roles
    if (rule.recipientRoles && Array.isArray(rule.recipientRoles) && rule.recipientRoles.length > 0) {
      conditions.push(inArray(users.role, rule.recipientRoles as string[]));
    }

    // If no conditions, return empty array
    if (conditions.length === 0) {
      return [];
    }

    const recipients = await db.query.users.findMany({
      where: or(...conditions),
      columns: {
        id: true,
        email: true,
        phone: true,
      }
    });

    return recipients;
  }

  /**
   * Extract metric value from metrics object based on metricType
   */
  private extractMetricValue(metricType: string, metrics: any): number | null {
    // Map metric types to their locations in the metrics object
    const metricMap: Record<string, () => number | null> = {
      // Error metrics
      'error_rate': () => metrics.errors?.rate || null,
      'error_total': () => metrics.errors?.total || null,
      
      // Performance metrics
      'response_time': () => metrics.performance?.avgResponseTime || null,
      'response_time_p95': () => metrics.performance?.p95ResponseTime || null,
      'response_time_p99': () => metrics.performance?.p99ResponseTime || null,
      'database_query_time': () => metrics.performance?.databaseQueryTime || null,
      'api_latency': () => metrics.performance?.apiLatency || null,
      
      // Security metrics
      'security_events': () => metrics.security?.totalEvents || null,
      'failed_logins': () => metrics.security?.failedLogins || null,
      'suspicious_activity': () => metrics.security?.suspiciousActivity || null,
      
      // E-Filing metrics
      'efile_submissions': () => metrics.eFiling?.totalSubmissions || null,
      'efile_error_rate': () => metrics.eFiling?.errorRate || null,
      'efile_processing_time': () => metrics.eFiling?.avgProcessingTime || null,
      
      // AI metrics
      'ai_cost': () => metrics.ai?.totalCost || null,
      'ai_calls': () => metrics.ai?.totalCalls || null,
      'ai_tokens': () => metrics.ai?.totalTokens || null,
      
      // Cache metrics (parse hit rate percentage string)
      'cache_hit_rate': () => {
        const hitRates = metrics.cache?.hitRates;
        if (!hitRates) return null;
        
        // Get overall or first available hit rate
        const rateStr = hitRates.overall || Object.values(hitRates)[0] as string;
        if (!rateStr) return null;
        
        const match = rateStr.match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
      },
    };

    const extractor = metricMap[metricType];
    if (extractor) {
      return extractor();
    }

    console.warn(`Unknown metric type: ${metricType}`);
    return null;
  }

  /**
   * Check if value meets threshold condition
   */
  private checkThreshold(value: number, threshold: number, comparison: string): boolean {
    switch (comparison) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'greater_than_or_equal':
        return value >= threshold;
      case 'less_than_or_equal':
        return value <= threshold;
      default:
        console.warn(`Unknown comparison operator: ${comparison}`);
        return false;
    }
  }

  /**
   * Check if rule is in cooldown period
   */
  private isInCooldown(rule: AlertRule): boolean {
    if (!rule.lastTriggered || !rule.cooldownMinutes) {
      return false;
    }
    
    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
    
    return timeSinceLastTrigger < cooldownMs;
  }

  /**
   * Get recent alert history
   */
  async getAlertHistory(limit: number = 50, tenantId?: string): Promise<any[]> {
    const conditions = [];
    
    if (tenantId) {
      conditions.push(eq(alertHistory.tenantId, tenantId));
    }

    const query = db.query.alertHistory.findMany({
      limit,
      orderBy: (alertHistory, { desc }) => [desc(alertHistory.createdAt)]
    });

    if (conditions.length > 0) {
      return await db.query.alertHistory.findMany({
        where: and(...conditions),
        limit,
        orderBy: (alertHistory, { desc }) => [desc(alertHistory.createdAt)]
      });
    }

    return await query;
  }

  /**
   * Resolve an alert (for backward compatibility)
   */
  async resolveAlert(alertId: string): Promise<void> {
    await db.update(alertHistory)
      .set({ 
        resolved: true, 
        resolvedAt: new Date() 
      })
      .where(eq(alertHistory.id, alertId));
  }

  /**
   * Get recent alerts (for backward compatibility)
   */
  async getRecentAlerts(limit: number = 50, severity?: string, tenantId?: string | null): Promise<any[]> {
    return this.getAlertHistory(limit, tenantId || undefined);
  }
}

export const alertService = new AlertService();

console.log("📊 Database-driven Alert Service initialized");
