/**
 * PER Compliance Audit Service
 * 
 * HIPAA and IRS 1075 Compliance Integration for Payment Error Reduction Module
 * 
 * Provides audit logging and compliance hooks for all PER operations to ensure:
 * - HIPAA PHI access logging for client benefit data
 * - IRS 1075 FTI (Federal Tax Information) access controls
 * - Audit trail for all income verification and risk scoring operations
 * - Security event logging for duplicate detection and fraud referrals
 */

import { HipaaComplianceService } from '../hipaa.service';
import { auditLogService } from '../auditLog.service';
import { logger } from '../logger.service';
import { Request } from 'express';
import { nanoid } from 'nanoid';

const hipaaService = new HipaaComplianceService();

export type PerOperationType = 
  | 'income_verification'
  | 'consistency_check'
  | 'duplicate_detection'
  | 'risk_score_calculation'
  | 'nudge_generation'
  | 'nudge_action'
  | 'perm_sampling'
  | 'perm_review'
  | 'wage_data_access'
  | 'case_assessment';

export interface PerAuditContext {
  operationType: PerOperationType;
  caseId: string;
  userId?: string;
  stateCode?: string;
  tenantId?: string;
  req?: Request;
}

export interface Irs1075AccessContext {
  dataType: 'w2_wage_data' | 'fti_income' | 'ein_employer' | 'ssn_match';
  accessReason: string;
  dataSourceId?: string;
  encryptionVerified?: boolean;
}

class PerComplianceAuditService {
  /**
   * Log PER operation for HIPAA/IRS 1075 compliance
   */
  async logPerOperation(
    context: PerAuditContext,
    details: {
      action: string;
      riskScore?: number;
      success: boolean;
      dataAccessed?: string[];
      irs1075?: Irs1075AccessContext;
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      await auditLogService.log({
        userId: context.userId,
        action: `PER_${context.operationType.toUpperCase()}_${details.action}`,
        resource: 'per_module',
        resourceId: context.caseId,
        details: {
          operationType: context.operationType,
          stateCode: context.stateCode,
          tenantId: context.tenantId,
          riskScore: details.riskScore,
          dataAccessed: details.dataAccessed,
          irs1075Context: details.irs1075,
          timestamp: new Date().toISOString()
        },
        sensitiveDataAccessed: !!details.irs1075 || details.dataAccessed?.some(d => 
          ['ssn', 'income', 'wages', 'ein'].some(s => d.toLowerCase().includes(s))
        ),
        piiFields: details.dataAccessed?.filter(d => 
          ['ssn', 'income', 'wages', 'ein', 'dob', 'address'].some(s => d.toLowerCase().includes(s))
        ),
        success: details.success,
        errorMessage: details.errorMessage,
        req: context.req
      });

      if (this.isPhiOperation(context.operationType)) {
        await this.logHipaaPhiAccess(context, details);
      }

      if (details.irs1075) {
        await this.logIrs1075Access(context, details.irs1075);
      }

    } catch (error) {
      logger.error('PER compliance audit logging failed', {
        service: 'PerComplianceAuditService',
        operationType: context.operationType,
        caseId: context.caseId,
        error: error instanceof Error ? error.message : 'Unknown'
      });
    }
  }

  /**
   * Log wage data access for IRS 1075 compliance
   */
  async logWageDataAccess(
    caseId: string,
    userId: string | undefined,
    accessReason: string,
    wageRecordCount: number,
    req?: Request
  ): Promise<void> {
    await this.logPerOperation(
      {
        operationType: 'wage_data_access',
        caseId,
        userId,
        req
      },
      {
        action: 'ACCESS',
        success: true,
        dataAccessed: ['w2_wages', 'employer_ein', 'gross_income'],
        irs1075: {
          dataType: 'w2_wage_data',
          accessReason,
          encryptionVerified: true
        }
      }
    );

    logger.info('IRS 1075 wage data access logged', {
      service: 'PerComplianceAuditService',
      caseId,
      userId,
      wageRecordCount,
      accessReason
    });
  }

  /**
   * Log income verification with compliance context
   */
  async logIncomeVerification(
    context: PerAuditContext,
    result: {
      discrepancyFound: boolean;
      discrepancyAmount?: number;
      verificationSource: string;
      success: boolean;
    }
  ): Promise<void> {
    await this.logPerOperation(context, {
      action: result.discrepancyFound ? 'DISCREPANCY_DETECTED' : 'VERIFIED',
      success: result.success,
      dataAccessed: ['reported_income', 'verified_income', 'wage_data'],
      irs1075: {
        dataType: 'fti_income',
        accessReason: 'SNAP income eligibility verification',
        dataSourceId: result.verificationSource,
        encryptionVerified: true
      }
    });
  }

  /**
   * Log duplicate detection operation
   */
  async logDuplicateDetection(
    context: PerAuditContext,
    result: {
      matchFound: boolean;
      matchType?: string;
      potentialFraud: boolean;
      success: boolean;
    }
  ): Promise<void> {
    await this.logPerOperation(context, {
      action: result.matchFound ? 'MATCH_FOUND' : 'NO_MATCH',
      success: result.success,
      dataAccessed: ['ssn', 'dob', 'name', 'household_composition']
    });

    if (result.potentialFraud) {
      await this.logSecurityEvent(context, {
        eventType: 'potential_fraud_detected',
        severity: 'high',
        details: {
          matchType: result.matchType,
          requiresInvestigation: true
        }
      });
    }
  }

  /**
   * Log risk score calculation
   */
  async logRiskScoreCalculation(
    context: PerAuditContext,
    result: {
      riskScore: number;
      riskLevel: string;
      factorsAnalyzed: number;
      success: boolean;
    }
  ): Promise<void> {
    await this.logPerOperation(context, {
      action: 'CALCULATE',
      riskScore: result.riskScore,
      success: result.success,
      dataAccessed: [
        'income_history',
        'household_composition',
        'verification_history',
        'nudge_history'
      ]
    });
  }

  /**
   * Log nudge generation with hybrid gateway grounding
   */
  async logNudgeGeneration(
    context: PerAuditContext,
    result: {
      nudgesGenerated: number;
      hybridGatewayUsed: boolean;
      statutoryCitationsIncluded: boolean;
      success: boolean;
    }
  ): Promise<void> {
    await this.logPerOperation(context, {
      action: 'GENERATE',
      success: result.success,
      dataAccessed: [
        'case_findings',
        'risk_factors',
        'ontology_terms'
      ]
    });
  }

  /**
   * Log PERM sampling for FNS compliance
   */
  async logPermSampling(
    context: PerAuditContext,
    result: {
      samplePeriod: string;
      activeCasesSampled: number;
      negativeCasesSampled: number;
      success: boolean;
    }
  ): Promise<void> {
    await this.logPerOperation(context, {
      action: 'SAMPLE',
      success: result.success,
      dataAccessed: [
        'active_cases',
        'negative_actions',
        'case_identifiers'
      ]
    });

    logger.info('PERM sampling logged for FNS compliance', {
      service: 'PerComplianceAuditService',
      samplePeriod: result.samplePeriod,
      activeCases: result.activeCasesSampled,
      negativeCases: result.negativeCasesSampled
    });
  }

  /**
   * Get compliance report for date range
   */
  async getComplianceReport(
    stateCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalOperations: number;
    byOperationType: Record<string, number>;
    sensitiveAccessCount: number;
    irs1075AccessCount: number;
    securityEventsCount: number;
    complianceScore: number;
  }> {
    const phiLogs = await hipaaService.getPhiAccessLogs({
      startDate,
      endDate,
      resourceType: 'per_module',
      limit: 10000
    });

    const byOperationType: Record<string, number> = {};
    let irs1075Count = 0;

    for (const log of phiLogs) {
      const opType = (log.phiType || 'unknown') as string;
      byOperationType[opType] = (byOperationType[opType] || 0) + 1;
      if (log.accessContext && typeof log.accessContext === 'object' && 
          'irs1075' in log.accessContext) {
        irs1075Count++;
      }
    }

    const flaggedLogs = phiLogs.filter(l => l.flaggedForReview);
    const complianceScore = phiLogs.length > 0
      ? Math.round(((phiLogs.length - flaggedLogs.length) / phiLogs.length) * 100)
      : 100;

    return {
      totalOperations: phiLogs.length,
      byOperationType,
      sensitiveAccessCount: phiLogs.filter(l => l.accessContext).length,
      irs1075AccessCount: irs1075Count,
      securityEventsCount: flaggedLogs.length,
      complianceScore
    };
  }

  private isPhiOperation(operationType: PerOperationType): boolean {
    const phiOperations: PerOperationType[] = [
      'income_verification',
      'duplicate_detection',
      'wage_data_access',
      'case_assessment',
      'risk_score_calculation'
    ];
    return phiOperations.includes(operationType);
  }

  private async logHipaaPhiAccess(
    context: PerAuditContext,
    details: { action: string; dataAccessed?: string[]; success: boolean }
  ): Promise<void> {
    try {
      await hipaaService.logPhiAccess({
        userId: context.userId || 'system',
        patientId: context.caseId,
        accessType: details.action,
        phiType: context.operationType,
        resourceType: 'per_module',
        resourceId: context.caseId,
        accessPurpose: `PER ${context.operationType} for SNAP error prevention`,
        accessContext: {
          stateCode: context.stateCode,
          tenantId: context.tenantId,
          dataAccessed: details.dataAccessed
        },
        minNecessary: true,
        ipAddress: context.req?.ip || 'internal',
        userAgent: context.req?.get('user-agent') || 'PER-System'
      });
    } catch (error) {
      logger.error('HIPAA PHI logging failed', {
        service: 'PerComplianceAuditService',
        error: error instanceof Error ? error.message : 'Unknown'
      });
    }
  }

  private async logIrs1075Access(
    context: PerAuditContext,
    irs1075Context: Irs1075AccessContext
  ): Promise<void> {
    await hipaaService.createAuditLog({
      eventType: 'irs_1075_access',
      userId: context.userId || 'system',
      resourceType: 'federal_tax_information',
      resourceId: context.caseId,
      action: `${irs1075Context.dataType}_access`,
      details: {
        dataType: irs1075Context.dataType,
        accessReason: irs1075Context.accessReason,
        dataSourceId: irs1075Context.dataSourceId,
        encryptionVerified: irs1075Context.encryptionVerified,
        stateCode: context.stateCode,
        complianceFramework: 'IRS Publication 1075'
      },
      ipAddress: context.req?.ip || 'internal',
      userAgent: context.req?.get('user-agent') || 'PER-System'
    });
  }

  private async logSecurityEvent(
    context: PerAuditContext,
    event: {
      eventType: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      details: Record<string, any>;
    }
  ): Promise<void> {
    await auditLogService.logSecurityEvent({
      eventType: event.eventType,
      severity: event.severity,
      userId: context.userId,
      details: {
        ...event.details,
        caseId: context.caseId,
        stateCode: context.stateCode,
        perModule: true
      },
      req: context.req
    });
  }
}

export const perComplianceAuditService = new PerComplianceAuditService();
