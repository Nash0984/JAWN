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

  // Table to category mapping - 35 tables covered for CRIT-002 compliance
  private readonly TABLE_CATEGORY_MAP: Record<string, string> = {
    // Tax-related tables (IRS Pub 1075: 7-year retention from filedAt) - 6 tables
    'federal_tax_returns': this.RETENTION_CATEGORIES.TAX_7YR,
    'maryland_tax_returns': this.RETENTION_CATEGORIES.TAX_7YR,
    'tax_documents': this.RETENTION_CATEGORIES.TAX_7YR,
    'vita_intake_sessions': this.RETENTION_CATEGORIES.TAX_7YR,
    'taxslayer_returns': this.RETENTION_CATEGORIES.TAX_7YR,
    'household_profiles': this.RETENTION_CATEGORIES.TAX_7YR,
    
    // Benefit application tables (7-year retention from submittedAt) - 9 tables
    'client_cases': this.RETENTION_CATEGORIES.BENEFIT_7YR,
    'documents': this.RETENTION_CATEGORIES.BENEFIT_7YR,
    'ee_clients': this.RETENTION_CATEGORIES.BENEFIT_7YR,
    'ee_export_batches': this.RETENTION_CATEGORIES.BENEFIT_7YR,
    'cross_enrollment_opportunities': this.RETENTION_CATEGORIES.BENEFIT_7YR,
    'cross_enrollment_predictions': this.RETENTION_CATEGORIES.BENEFIT_7YR,
    'client_verification_documents': this.RETENTION_CATEGORIES.BENEFIT_7YR,
    'document_verifications': this.RETENTION_CATEGORIES.BENEFIT_7YR,
    'household_members': this.RETENTION_CATEGORIES.BENEFIT_7YR,
    
    // Audit and compliance tables (7-year retention from createdAt) - 11 tables
    'audit_logs': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'security_events': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'gdpr_consents': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'gdpr_data_subject_requests': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'gdpr_breach_incidents': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'cross_enrollment_audit_events': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'client_interaction_sessions': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'intake_sessions': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'appointments': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'feedback_submissions': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'sms_messages': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    
    // HIPAA/PHI tables (7-year retention per HIPAA §164.310(d)(2) from serviceDate) - 5 tables
    'hipaa_phi_access_logs': this.RETENTION_CATEGORIES.PHI_7YR,
    'hipaa_business_associate_agreements': this.RETENTION_CATEGORIES.PHI_7YR,
    'hipaa_risk_assessments': this.RETENTION_CATEGORIES.PHI_7YR,
    'hipaa_security_incidents': this.RETENTION_CATEGORIES.PHI_7YR,
    'hipaa_audit_logs': this.RETENTION_CATEGORIES.PHI_7YR,
    
    // Consent and signature tables (7-year retention) - 3 tables
    'user_consents': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'client_consents': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    'consent_forms': this.RETENTION_CATEGORIES.AUDIT_LOG_7YR,
    
    // User accounts (90-day post-closure purge per GDPR) - 1 table
    'users': this.RETENTION_CATEGORIES.USER_ACCOUNT_90D,
  };
  
  // Total: 6 + 9 + 11 + 5 + 3 + 1 = 35 tables

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
   * Calculate retention expiration date based on category and record-specific dates
   * Returns null for permanent retention categories
   * 
   * Compliance-driven date selection:
   * - TAX_7YR: Uses filedAt (IRS Pub 1075 §9.3.4: "7 years from filing date")
   * - BENEFIT_7YR: Uses submittedAt (7 years from application submission)
   * - PHI_7YR: Uses serviceDate (HIPAA §164.310(d)(2): "7 years from service date")
   * - AUDIT_LOG_7YR: Uses createdAt (7 years from log creation)
   * - USER_ACCOUNT_90D: Uses deletedAt or createdAt (GDPR Art. 5: 90 days post-closure)
   * 
   * Fallback chain: filedAt → submittedAt → serviceDate → createdAt
   */
  calculateRetentionUntil(category: string, record: any): Date | null {
    // Determine reference date based on compliance requirements
    // Check both snake_case (from database) and camelCase (from ORM) variants
    let referenceDate: Date | null = null;
    
    // Priority 1: filedAt (for tax returns - IRS compliance)
    if (record.filed_at || record.filedAt) {
      referenceDate = new Date(record.filed_at || record.filedAt);
    }
    // Priority 2: submittedAt (for benefit applications)
    else if (record.submitted_at || record.submittedAt) {
      referenceDate = new Date(record.submitted_at || record.submittedAt);
    }
    // Priority 3: serviceDate (for HIPAA PHI - service date compliance)
    else if (record.service_date || record.serviceDate) {
      referenceDate = new Date(record.service_date || record.serviceDate);
    }
    // Priority 4: createdAt (fallback for all other records)
    else if (record.created_at || record.createdAt) {
      referenceDate = new Date(record.created_at || record.createdAt);
    }
    
    // If no valid date found, cannot calculate retention
    if (!referenceDate || isNaN(referenceDate.getTime())) {
      logger.warn('Cannot calculate retention: no valid reference date', {
        category,
        record: { 
          id: record.id, 
          filed_at: record.filed_at, 
          filedAt: record.filedAt, 
          submitted_at: record.submitted_at, 
          submittedAt: record.submittedAt, 
          service_date: record.service_date, 
          serviceDate: record.serviceDate, 
          created_at: record.created_at, 
          createdAt: record.createdAt 
        },
      });
      return null;
    }

    const retentionDate = new Date(referenceDate);

    switch (category) {
      case this.RETENTION_CATEGORIES.TAX_7YR:
      case this.RETENTION_CATEGORIES.BENEFIT_7YR:
      case this.RETENTION_CATEGORIES.AUDIT_LOG_7YR:
      case this.RETENTION_CATEGORIES.PHI_7YR:
        // 7 years from reference date (filedAt, submittedAt, serviceDate, or createdAt)
        retentionDate.setFullYear(retentionDate.getFullYear() + 7);
        return retentionDate;

      case this.RETENTION_CATEGORIES.USER_ACCOUNT_90D:
        // 90 days from deletion/creation (GDPR post-account closure)
        // Use deletedAt if available, otherwise createdAt
        const userDate = (record.deleted_at || record.deletedAt) 
          ? new Date(record.deleted_at || record.deletedAt) 
          : referenceDate;
        userDate.setDate(userDate.getDate() + 90);
        return userDate;

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
   * Helper: Check if table contains tax-related data (FTI)
   * Used for legal hold checks and IRS audit status verification
   */
  private isTaxRelatedTable(tableName: string): boolean {
    const taxTables = [
      'federal_tax_returns',
      'maryland_tax_returns',
      'tax_documents',
      'vita_intake_sessions',
      'household_profiles',
      'taxslayer_returns', // TaxSlayer integration FTI
    ];
    return taxTables.includes(tableName);
  }

  /**
   * Batch update retention metadata for existing records
   * Useful for backfilling retention categories and expiration dates
   * 
   * Uses compliance-driven reference date selection:
   * - filedAt for tax records (IRS Pub 1075 §9.3.4)
   * - submittedAt for benefit applications
   * - serviceDate for PHI records (HIPAA §164.310(d)(2))
   * - createdAt as fallback
   */
  async backfillRetentionMetadata(tableName: string): Promise<number> {
    try {
      const category = this.TABLE_CATEGORY_MAP[tableName];
      if (!category) {
        logger.warn('No retention category defined for table', { tableName });
        return 0;
      }

      // SQL expression for reference date selection (filedAt → submittedAt → serviceDate → createdAt)
      // Using COALESCE for null-safe fallback chain
      const referenceDateExpr = sql`COALESCE(filed_at, submitted_at, service_date, created_at)`;

      // Update records that don't have retention metadata
      const result = await db.execute(sql`
        UPDATE ${sql.identifier(tableName)}
        SET retention_category = ${category},
            retention_until = CASE
              WHEN ${category} = 'tax_7yr' OR ${category} = 'benefit_7yr' OR ${category} = 'audit_log_7yr' OR ${category} = 'phi_7yr'
                THEN ${referenceDateExpr} + INTERVAL '7 years'
              WHEN ${category} = 'user_account_90d'
                THEN COALESCE(deleted_at, ${referenceDateExpr}) + INTERVAL '90 days'
              ELSE NULL
            END
        WHERE retention_category IS NULL
          AND ${referenceDateExpr} IS NOT NULL
      `);

      const updatedCount = result.rowCount || 0;
      logger.info('Backfilled retention metadata with record-specific dates', {
        tableName,
        category,
        updatedCount,
        referenceDatePriority: 'filedAt → submittedAt → serviceDate → createdAt',
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
