import { db } from '../db';
import { sql } from 'drizzle-orm';
import { auditLogService } from './auditLog.service';
import { logger } from './logger.service';

/**
 * Data Retention Policy Engine Service
 * 
 * Implements automated data retention and disposal policies for:
 * - IRS Publication 1075: 7-year retention for Federal Tax Information (FTI)
 * - HIPAA §164.310(d)(2): 7-year retention for PHI and audit logs
 * - GDPR Art. 5: Storage limitation (90-day post-account closure)
 * - Maryland benefit program records: 7-year retention
 * 
 * Features:
 * - Automatic retention category classification
 * - Retention period calculation
 * - Legal hold checks
 * - Soft delete (scheduled for deletion) and hard delete operations
 * - Comprehensive audit trails in data_disposal_logs table
 */

interface DataDisposalLog {
  tableName: string;
  recordId: string;
  deletionReason: string;
  deletedBy: string;
  deletionMethod: 'soft_delete' | 'hard_delete';
  recordSnapshot?: any;
  legalHoldStatus?: string;
  approvalChain?: any;
  auditTrail?: any;
}

export class DataRetentionService {
  // Retention category definitions (compliance-driven)
  private readonly RETENTION_CATEGORIES = {
    TAX_7YR: 'tax_7yr',           // IRS Publication 1075: 7-year retention for FTI
    BENEFIT_7YR: 'benefit_7yr',    // Benefit application data: 7-year retention
    AUDIT_LOG_7YR: 'audit_log_7yr',// Audit logs: 7-year retention
    PHI_7YR: 'phi_7yr',            // HIPAA §164.310(d)(2): 7-year retention for PHI
    USER_ACCOUNT_90D: 'user_account_90d', // GDPR Art. 5: 90-day account closure purge
    REFERENCE_DATA_PERMANENT: 'reference_data_permanent' // No expiration
  };

  // Table to category mapping
  private readonly TABLE_CATEGORY_MAP: Record<string, string> = {
    // Tax-related tables (IRS Pub 1075: 7-year retention)
    'federal_tax_returns': this.RETENTION_CATEGORIES.TAX_7YR,
    'maryland_tax_returns': this.RETENTION_CATEGORIES.TAX_7YR,
    'tax_documents': this.RETENTION_CATEGORIES.TAX_7YR,
    'vita_intake_sessions': this.RETENTION_CATEGORIES.TAX_7YR,
    'household_profiles': this.RETENTION_CATEGORIES.TAX_7YR, // May contain tax household data
    
    // Benefit application tables (7-year retention)
    'client_cases': this.RETENTION_CATEGORIES.BENEFIT_7YR,
    'documents': this.RETENTION_CATEGORIES.BENEFIT_7YR,
    
    // Audit and compliance tables (7-year retention)
    'audit_logs': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'security_events': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'gdpr_consents': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'gdpr_data_subject_requests': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'gdpr_breach_incidents': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    
    // HIPAA/PHI tables (7-year retention per HIPAA §164.310(d)(2))
    'hipaa_phi_access_logs': this.RETENTION_CATEGORIES.PHI_7YR,
    'hipaa_business_associate_agreements': this.RETENTION_CATEGORIES.PHI_7YR,
    'hipaa_risk_assessments': this.RETENTION_CATEGORIES.PHI_7YR,
    'hipaa_security_incidents': this.RETENTION_CATEGORIES.PHI_7YR,
    
    // User accounts (90-day post-closure purge per GDPR)
    'users': this.RETENTION_CATEGORIES.USER_ACCOUNT_90D,
  };

  /**
   * Classify data category for a given table and record
   * Returns the retention category or null if permanent/unclassified
   */
  classifyDataCategory(tableName: string, record: any): string | null {
    // Check if table has explicit mapping
    const category = this.TABLE_CATEGORY_MAP[tableName];
    if (category) {
      return category;
    }

    // Check if record has retention_category field already set
    if (record?.retention_category) {
      return record.retention_category;
    }

    // Special case: documents table can have different categories
    if (tableName === 'documents' && record?.isGoldenSource) {
      return this.RETENTION_CATEGORIES.REFERENCE_DATA_PERMANENT;
    }

    // Default: no category (permanent retention)
    return null;
  }

  /**
   * Calculate retention expiration date based on category and creation date
   * Returns null for permanent retention categories
   */
  calculateRetentionUntil(category: string, createdAt: Date): Date | null {
    const retentionDate = new Date(createdAt);

    switch (category) {
      case this.RETENTION_CATEGORIES.TAX_7YR:
      case this.RETENTION_CATEGORIES.BENEFIT_7YR:
      case this.RETENTION_CATEGORIES.AUDIT_LOG_7YR:
      case this.RETENTION_CATEGORIES.PHI_7YR:
        // 7 years from creation date
        retentionDate.setFullYear(retentionDate.getFullYear() + 7);
        return retentionDate;

      case this.RETENTION_CATEGORIES.USER_ACCOUNT_90D:
        // 90 days from creation (or account closure date if provided)
        retentionDate.setDate(retentionDate.getDate() + 90);
        return retentionDate;

      case this.RETENTION_CATEGORIES.REFERENCE_DATA_PERMANENT:
        // Permanent retention - no expiration
        return null;

      default:
        // Unknown category - no expiration (safe default)
        return null;
    }
  }

  /**
   * Get records eligible for deletion from a specific table
   * Returns records where retention_until has passed and not already scheduled for deletion
   */
  async getRecordsEligibleForDeletion(tableName: string): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT *
        FROM ${sql.identifier(tableName)}
        WHERE retention_until IS NOT NULL
          AND retention_until < NOW()
          AND scheduled_for_deletion = false
        ORDER BY retention_until ASC
      `);

      return result.rows;
    } catch (error) {
      logger.error('Error fetching records eligible for deletion', {
        tableName,
        error,
      });
      throw error;
    }
  }

  /**
   * Soft delete a record (mark as scheduled for deletion)
   * Does NOT physically delete the record - sets scheduled_for_deletion flag
   */
  async softDeleteRecord(
    tableName: string,
    recordId: string,
    deletedBy: string,
    reason: string
  ): Promise<void> {
    try {
      // Check for legal holds
      const legalHolds = await this.checkLegalHolds(tableName, recordId);
      if (legalHolds.length > 0) {
        throw new Error(`Cannot delete record: Legal holds in effect: ${legalHolds.join(', ')}`);
      }

      // Fetch record snapshot before soft delete
      const recordResult = await db.execute(sql`
        SELECT *
        FROM ${sql.identifier(tableName)}
        WHERE id = ${recordId}
      `);

      if (recordResult.rows.length === 0) {
        throw new Error(`Record not found: ${tableName}:${recordId}`);
      }

      const recordSnapshot = recordResult.rows[0];

      // Perform soft delete
      await db.execute(sql`
        UPDATE ${sql.identifier(tableName)}
        SET scheduled_for_deletion = true,
            deletion_approved_by = ${deletedBy},
            deletion_approved_at = NOW()
        WHERE id = ${recordId}
      `);

      // Log to data_disposal_logs
      await this.logDisposal({
        tableName,
        recordId,
        deletionReason: reason,
        deletedBy,
        deletionMethod: 'soft_delete',
        recordSnapshot,
        legalHoldStatus: 'no_holds',
        auditTrail: {
          action: 'soft_delete',
          timestamp: new Date().toISOString(),
          performedBy: deletedBy,
        },
      });

      // Create audit log entry
      await auditLogService.log({
        userId: deletedBy,
        action: 'SOFT_DELETE',
        resource: tableName,
        resourceId: recordId,
        details: {
          reason,
          retentionCategory: recordSnapshot.retention_category,
          retentionUntil: recordSnapshot.retention_until,
        },
      });

      logger.info('Record soft deleted', {
        tableName,
        recordId,
        deletedBy,
        reason,
      });
    } catch (error) {
      logger.error('Error soft deleting record', {
        tableName,
        recordId,
        error,
      });
      throw error;
    }
  }

  /**
   * Hard delete a record (permanent physical deletion)
   * WARNING: This is irreversible - only use after soft delete review period
   */
  async hardDeleteRecord(
    tableName: string,
    recordId: string,
    deletedBy: string
  ): Promise<void> {
    try {
      // Check for legal holds
      const legalHolds = await this.checkLegalHolds(tableName, recordId);
      if (legalHolds.length > 0) {
        throw new Error(`Cannot delete record: Legal holds in effect: ${legalHolds.join(', ')}`);
      }

      // Fetch record snapshot before deletion
      const recordResult = await db.execute(sql`
        SELECT *
        FROM ${sql.identifier(tableName)}
        WHERE id = ${recordId}
      `);

      if (recordResult.rows.length === 0) {
        throw new Error(`Record not found: ${tableName}:${recordId}`);
      }

      const recordSnapshot = recordResult.rows[0];

      // Verify record is scheduled for deletion
      if (!recordSnapshot.scheduled_for_deletion) {
        throw new Error('Record must be soft deleted before hard deletion');
      }

      // Perform hard delete
      await db.execute(sql`
        DELETE FROM ${sql.identifier(tableName)}
        WHERE id = ${recordId}
      `);

      // Log to data_disposal_logs
      await this.logDisposal({
        tableName,
        recordId,
        deletionReason: 'retention_period_expired',
        deletedBy,
        deletionMethod: 'hard_delete',
        recordSnapshot,
        legalHoldStatus: 'no_holds',
        approvalChain: {
          softDeleteApprovedBy: recordSnapshot.deletion_approved_by,
          softDeleteApprovedAt: recordSnapshot.deletion_approved_at,
          hardDeleteApprovedBy: deletedBy,
          hardDeleteApprovedAt: new Date().toISOString(),
        },
        auditTrail: {
          action: 'hard_delete',
          timestamp: new Date().toISOString(),
          performedBy: deletedBy,
        },
      });

      // Create audit log entry
      await auditLogService.log({
        userId: deletedBy,
        action: 'HARD_DELETE',
        resource: tableName,
        resourceId: recordId,
        details: {
          retentionCategory: recordSnapshot.retention_category,
          retentionUntil: recordSnapshot.retention_until,
          softDeletedAt: recordSnapshot.deletion_approved_at,
        },
      });

      logger.info('Record hard deleted', {
        tableName,
        recordId,
        deletedBy,
      });
    } catch (error) {
      logger.error('Error hard deleting record', {
        tableName,
        recordId,
        error,
      });
      throw error;
    }
  }

  /**
   * Check for legal holds on a record
   * Returns array of legal hold reasons (empty if no holds)
   * 
   * Legal holds prevent deletion even if retention period has expired:
   * - Active tax audits (IRS/state)
   * - Litigation holds
   * - Regulatory investigations
   * - Data subject requests in progress
   */
  async checkLegalHolds(tableName: string, recordId: string): Promise<string[]> {
    const holds: string[] = [];

    try {
      // Check for tax-related legal holds
      if (this.isTaxRelatedTable(tableName)) {
        const taxHoldResult = await db.execute(sql`
          SELECT COUNT(*) as count
          FROM federal_tax_returns
          WHERE id = ${recordId}
            AND (audit_status = 'under_audit' OR audit_status = 'pending_review')
        `);

        if (Number(taxHoldResult.rows[0]?.count) > 0) {
          holds.push('IRS_AUDIT_IN_PROGRESS');
        }
      }

      // Check for active GDPR data subject requests
      const gdprHoldResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM gdpr_data_subject_requests
        WHERE status = 'in_progress'
          AND (request_type = 'deletion' OR request_type = 'export')
      `);

      if (Number(gdprHoldResult.rows[0]?.count) > 0) {
        holds.push('GDPR_REQUEST_IN_PROGRESS');
      }

      // Check for litigation holds (example - would need actual litigation tracking table)
      // This is a placeholder for future implementation
      // const litigationHoldResult = await db.execute(sql`...`);

    } catch (error) {
      logger.error('Error checking legal holds', {
        tableName,
        recordId,
        error,
      });
      // Fail safe: if we can't check holds, assume there might be holds
      holds.push('ERROR_CHECKING_HOLDS');
    }

    return holds;
  }

  /**
   * Log data disposal action to data_disposal_logs table
   */
  private async logDisposal(disposalLog: DataDisposalLog): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO data_disposal_logs (
          table_name,
          record_id,
          deletion_reason,
          deleted_by,
          deletion_method,
          record_snapshot,
          legal_hold_status,
          approval_chain,
          audit_trail
        ) VALUES (
          ${disposalLog.tableName},
          ${disposalLog.recordId},
          ${disposalLog.deletionReason},
          ${disposalLog.deletedBy},
          ${disposalLog.deletionMethod},
          ${JSON.stringify(disposalLog.recordSnapshot)},
          ${disposalLog.legalHoldStatus || null},
          ${JSON.stringify(disposalLog.approvalChain || {})},
          ${JSON.stringify(disposalLog.auditTrail || {})}
        )
      `);
    } catch (error) {
      logger.error('Error logging disposal', {
        tableName: disposalLog.tableName,
        recordId: disposalLog.recordId,
        error,
      });
      // Don't throw - disposal logging failure should not block deletion
    }
  }

  /**
   * Helper: Check if table contains tax-related data
   */
  private isTaxRelatedTable(tableName: string): boolean {
    const taxTables = [
      'federal_tax_returns',
      'maryland_tax_returns',
      'tax_documents',
      'vita_intake_sessions',
      'household_profiles',
    ];
    return taxTables.includes(tableName);
  }

  /**
   * Batch update retention metadata for existing records
   * Useful for backfilling retention categories and expiration dates
   */
  async backfillRetentionMetadata(tableName: string): Promise<number> {
    try {
      const category = this.TABLE_CATEGORY_MAP[tableName];
      if (!category) {
        logger.warn('No retention category defined for table', { tableName });
        return 0;
      }

      // Update records that don't have retention metadata
      const result = await db.execute(sql`
        UPDATE ${sql.identifier(tableName)}
        SET retention_category = ${category},
            retention_until = CASE
              WHEN ${category} = 'tax_7yr' OR ${category} = 'benefit_7yr' OR ${category} = 'audit_log_7yr' OR ${category} = 'phi_7yr'
                THEN created_at + INTERVAL '7 years'
              WHEN ${category} = 'user_account_90d'
                THEN created_at + INTERVAL '90 days'
              ELSE NULL
            END
        WHERE retention_category IS NULL
          AND created_at IS NOT NULL
      `);

      const updatedCount = result.rowCount || 0;
      logger.info('Backfilled retention metadata', {
        tableName,
        category,
        updatedCount,
      });

      return updatedCount;
    } catch (error) {
      logger.error('Error backfilling retention metadata', {
        tableName,
        error,
      });
      throw error;
    }
  }

  /**
   * Get retention policy summary for a table
   */
  getRetentionPolicy(tableName: string): {
    category: string | null;
    retentionPeriod: string;
    legalBasis: string;
  } {
    const category = this.TABLE_CATEGORY_MAP[tableName];

    const policies: Record<string, { retentionPeriod: string; legalBasis: string }> = {
      [this.RETENTION_CATEGORIES.TAX_7YR]: {
        retentionPeriod: '7 years',
        legalBasis: 'IRS Publication 1075 - Federal Tax Information Security',
      },
      [this.RETENTION_CATEGORIES.BENEFIT_7YR]: {
        retentionPeriod: '7 years',
        legalBasis: 'Maryland State Benefit Program Retention Requirements',
      },
      [this.RETENTION_CATEGORIES.AUDIT_LOG_7YR]: {
        retentionPeriod: '7 years',
        legalBasis: 'HIPAA §164.310(d)(2) - Audit Log Retention',
      },
      [this.RETENTION_CATEGORIES.PHI_7YR]: {
        retentionPeriod: '7 years',
        legalBasis: 'HIPAA §164.310(d)(2) - Protected Health Information Retention',
      },
      [this.RETENTION_CATEGORIES.USER_ACCOUNT_90D]: {
        retentionPeriod: '90 days',
        legalBasis: 'GDPR Article 5 - Storage Limitation Principle',
      },
      [this.RETENTION_CATEGORIES.REFERENCE_DATA_PERMANENT]: {
        retentionPeriod: 'Permanent',
        legalBasis: 'Reference data required for system operation',
      },
    };

    if (!category) {
      return {
        category: null,
        retentionPeriod: 'Permanent (no category)',
        legalBasis: 'No specific retention policy defined',
      };
    }

    return {
      category,
      ...policies[category],
    };
  }
}

export const dataRetentionService = new DataRetentionService();
