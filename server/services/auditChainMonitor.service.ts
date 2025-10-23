import { log } from '../vite';
import { immutableAuditService } from './immutableAudit.service';
import { logger } from './logger.service';
import { notificationService } from './notification.service';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Audit Chain Monitor Service
 * 
 * Provides automated verification of the immutable audit log chain
 * 
 * Compliance:
 * - NIST 800-53 AU-6: Weekly ISSO review of audit records
 * - IRS Pub 1075: Automated monitoring of audit logs
 * - SOC 2 CC5.2: Continuous monitoring of system activity
 * 
 * Verification Schedule:
 * - Weekly: Last 1000 entries (fast, catches recent tampering)
 * - Monthly: Full chain verification (comprehensive but expensive)
 */

export class AuditChainMonitorService {
  
  /**
   * Send alert notifications to all admin users when chain integrity is compromised
   */
  private async notifyAdminsOfChainFailure(details: {
    verificationType: string;
    brokenLinks: number;
    verifiedEntries: number;
    totalEntries: number;
  }): Promise<void> {
    try {
      // Get all admin users
      const adminUsers = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.role, 'admin'));
      
      if (adminUsers.length === 0) {
        logger.warn('No admin users found to notify about chain integrity compromise');
        return;
      }
      
      // Send notification to each admin
      for (const admin of adminUsers) {
        await notificationService.createNotification({
          userId: admin.id,
          type: 'alert',
          title: '🚨 CRITICAL: Audit Log Chain Integrity Compromised',
          message: `The immutable audit log chain has ${details.brokenLinks} broken link(s). Immediate investigation required. Verification type: ${details.verificationType}. Verified ${details.verifiedEntries} of ${details.totalEntries} entries.`,
          priority: 'high',
          relatedEntityType: 'audit_log',
          relatedEntityId: null,
          actionUrl: '/admin/monitoring?tab=audit',
          metadata: {
            brokenLinks: details.brokenLinks,
            verificationType: details.verificationType,
            verifiedEntries: details.verifiedEntries,
            totalEntries: details.totalEntries,
            severity: 'critical',
            complianceImpact: 'NIST 800-53 AU-9, IRS Pub 1075 9.3.1, HIPAA § 164.312(b)',
          },
        });
      }
      
      logger.info('Sent chain integrity failure notifications to admin users', {
        adminCount: adminUsers.length,
        brokenLinks: details.brokenLinks,
      });
    } catch (error) {
      logger.error('Failed to send admin notifications for chain failure', { error });
    }
  }
  
  /**
   * Verify recent audit log entries (last 1000)
   * Runs weekly on Sunday 3 AM per NIST AU-6 requirements
   */
  async verifyRecentEntries(): Promise<{
    success: boolean;
    isValid: boolean;
    verifiedEntries: number;
    totalEntries: number;
    brokenLinks: number;
  }> {
    try {
      log('🔍 Audit Chain Monitor: Verifying recent entries (last 1000)...');
      
      const result = await immutableAuditService.verifyRecentEntries(1000);
      
      if (result.isValid) {
        log(`✅ Audit Chain: Verified ${result.verifiedEntries} recent entries - integrity intact`);
        
        // Log successful verification to audit log
        await immutableAuditService.logEvent({
          userId: 'system',
          action: 'audit_chain_verified',
          resource: 'audit_chain',
          resourceId: null,
          details: {
            verifiedEntries: result.verifiedEntries,
            totalEntries: result.totalEntries,
            verificationType: 'recent_1000',
          },
        });
      } else {
        logger.error('❌ Audit Chain: Integrity compromised - broken links detected', {
          brokenLinks: result.brokenLinks.length,
          verifiedEntries: result.verifiedEntries,
          totalEntries: result.totalEntries,
        });
        
        // Log chain integrity compromise
        await immutableAuditService.logEvent({
          userId: 'system',
          action: 'chain_integrity_compromised',
          resource: 'audit_chain',
          resourceId: null,
          details: {
            brokenLinks: result.brokenLinks,
            verifiedEntries: result.verifiedEntries,
            totalEntries: result.totalEntries,
            verificationType: 'recent_1000',
          },
        });
        
        // Send critical alert to all admins
        await this.notifyAdminsOfChainFailure({
          verificationType: 'recent_1000',
          brokenLinks: result.brokenLinks.length,
          verifiedEntries: result.verifiedEntries,
          totalEntries: result.totalEntries,
        });
      }
      
      return {
        success: true,
        isValid: result.isValid,
        verifiedEntries: result.verifiedEntries,
        totalEntries: result.totalEntries,
        brokenLinks: result.brokenLinks.length,
      };
    } catch (error) {
      logger.error('Audit chain verification failed', { error });
      return {
        success: false,
        isValid: false,
        verifiedEntries: 0,
        totalEntries: 0,
        brokenLinks: 0,
      };
    }
  }
  
  /**
   * Verify full audit chain (all entries)
   * Runs monthly on first Sunday of the month at 3 AM
   * More expensive but provides comprehensive verification
   */
  async verifyFullChain(): Promise<{
    success: boolean;
    isValid: boolean;
    verifiedEntries: number;
    totalEntries: number;
    brokenLinks: number;
  }> {
    try {
      log('🔍 Audit Chain Monitor: Verifying FULL chain (all entries)...');
      
      const result = await immutableAuditService.verifyFullChain();
      
      if (result.isValid) {
        log(`✅ Audit Chain: Verified ${result.verifiedEntries} total entries - full chain integrity intact`);
        
        // Log successful full chain verification
        await immutableAuditService.logEvent({
          userId: 'system',
          action: 'audit_chain_verified',
          resource: 'audit_chain',
          resourceId: null,
          details: {
            verifiedEntries: result.verifiedEntries,
            totalEntries: result.totalEntries,
            verificationType: 'full_chain',
          },
        });
      } else {
        logger.error('❌ Audit Chain: FULL chain integrity compromised - broken links detected', {
          brokenLinks: result.brokenLinks.length,
          verifiedEntries: result.verifiedEntries,
          totalEntries: result.totalEntries,
        });
        
        // Log chain integrity compromise
        await immutableAuditService.logEvent({
          userId: 'system',
          action: 'chain_integrity_compromised',
          resource: 'audit_chain',
          resourceId: null,
          details: {
            brokenLinks: result.brokenLinks,
            verifiedEntries: result.verifiedEntries,
            totalEntries: result.totalEntries,
            verificationType: 'full_chain',
          },
        });
        
        // Send critical alert to all admins
        await this.notifyAdminsOfChainFailure({
          verificationType: 'full_chain',
          brokenLinks: result.brokenLinks.length,
          verifiedEntries: result.verifiedEntries,
          totalEntries: result.totalEntries,
        });
      }
      
      return {
        success: true,
        isValid: result.isValid,
        verifiedEntries: result.verifiedEntries,
        totalEntries: result.totalEntries,
        brokenLinks: result.brokenLinks.length,
      };
    } catch (error) {
      logger.error('Full audit chain verification failed', { error });
      return {
        success: false,
        isValid: false,
        verifiedEntries: 0,
        totalEntries: 0,
        brokenLinks: 0,
      };
    }
  }
  
  /**
   * Determine if today is the first Sunday of the month
   * Used for monthly full chain verification
   */
  isFirstSundayOfMonth(): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const dayOfMonth = now.getDate();
    
    // Must be Sunday (0) and day 1-7
    return dayOfWeek === 0 && dayOfMonth <= 7;
  }
}

export const auditChainMonitor = new AuditChainMonitorService();
