/**
 * Payment Error Reduction Service (Orchestrator)
 * 
 * SNAP Payment Error Reduction Module - Main Orchestration Service
 * Coordinates all PER components and integrates with existing qcAnalytics.
 * 
 * Implements the "Predict and Prevent" strategy per MD DHS Blueprint
 */

import { db } from '../../db';
import {
  perIncomeVerifications,
  perConsistencyChecks,
  perDuplicateClaims,
  perCaseworkerNudges,
  perPermSamples,
  clientCases,
  eligibilityCalculations
} from '@shared/schema';
import { eq, and, desc, gte, sql, count } from 'drizzle-orm';
import { logger } from '../logger.service';
import { qcAnalyticsService } from '../qcAnalytics.service';
import { incomeVerificationService, WageDataRecord, VerificationResult } from './incomeVerification.service';
import { preSubmissionValidatorService, ValidationResult } from './preSubmissionValidator.service';
import { duplicateClaimDetectorService, DuplicateScanResult } from './duplicateClaimDetector.service';
import { explainableNudgeService, NudgeGenerationResult } from './explainableNudge.service';
import { permReportingService, PermRateReport } from './permReporting.service';

export interface CaseRiskAssessment {
  caseId: string;
  overallRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  predictedErrorType?: 'overpayment' | 'underpayment' | 'none';
  estimatedErrorAmount?: number;
  readyForApproval: boolean;
  incomeVerification?: VerificationResult;
  preSubmissionValidation?: ValidationResult;
  duplicateScan?: DuplicateScanResult;
  nudges?: NudgeGenerationResult;
  recommendations: string[];
}

export interface PerDashboardMetrics {
  // Error prevention metrics
  totalCasesScanned: number;
  errorsPreventedCount: number;
  errorsPreventedAmount: number;
  // Active issues
  pendingIncomeVerifications: number;
  pendingConsistencyChecks: number;
  pendingDuplicateClaims: number;
  activeNudges: number;
  // Error rates
  currentErrorRate: number;
  errorRateTrend: 'improving' | 'stable' | 'worsening';
  targetErrorRate: number;
  // By type breakdown
  errorsByType: Record<string, number>;
  errorsByCategory: Record<string, number>;
  // Compliance status
  permCompliant: boolean;
  lastPermReportPeriod?: string;
  lastPermErrorRate?: number;
}

export interface PerSystemHealth {
  servicesOperational: {
    incomeVerification: boolean;
    preSubmissionValidator: boolean;
    duplicateDetection: boolean;
    nudgeGeneration: boolean;
    permReporting: boolean;
  };
  lastActivityTime: Date;
  processingBacklog: number;
  systemStatus: 'healthy' | 'degraded' | 'offline';
}

class PaymentErrorReductionService {
  /**
   * Run full PER assessment on a case (predict & prevent)
   */
  async assessCase(
    caseId: string,
    options: {
      wageData?: WageDataRecord[];
      stateCode?: string;
      tenantId?: string;
      caseworkerId?: string;
    } = {}
  ): Promise<CaseRiskAssessment> {
    const { wageData = [], stateCode = 'MD', tenantId, caseworkerId } = options;

    logger.info('Starting PER case assessment', {
      service: 'PaymentErrorReductionService',
      caseId
    });

    try {
      const results: Partial<CaseRiskAssessment> = {
        caseId,
        riskFactors: [],
        recommendations: []
      };

      // Run all checks in parallel
      const [
        incomeResult,
        validationResult,
        duplicateResult
      ] = await Promise.all([
        wageData.length > 0 
          ? incomeVerificationService.verifyCaseIncome(caseId, wageData, { stateCode, tenantId })
          : Promise.resolve(null),
        preSubmissionValidatorService.validateCase(caseId, { stateCode, tenantId }),
        duplicateClaimDetectorService.scanCaseForDuplicates(caseId, { stateCode, tenantId })
      ]);

      // Store results
      if (incomeResult) results.incomeVerification = incomeResult;
      results.preSubmissionValidation = validationResult;
      results.duplicateScan = duplicateResult;

      // Aggregate risk factors
      if (incomeResult?.paymentErrorsDetected > 0) {
        results.riskFactors!.push(`${incomeResult.paymentErrorsDetected} income discrepancies detected`);
        results.recommendations!.push('Review income verification findings before approval');
      }

      if (validationResult.checksFailed > 0) {
        results.riskFactors!.push(`${validationResult.checksFailed} pre-submission checks failed`);
        results.recommendations!.push(...validationResult.recommendedActions);
      }

      if (duplicateResult.duplicatesFound > 0) {
        results.riskFactors!.push(`${duplicateResult.duplicatesFound} potential duplicate claims found`);
        results.recommendations!.push('Resolve duplicate claim findings before approval');
      }

      // Calculate overall risk score
      let riskScore = 0;
      riskScore += (incomeResult?.paymentErrorsDetected || 0) * 20;
      riskScore += validationResult.checksFailed * 15;
      riskScore += validationResult.checksWarning * 5;
      riskScore += duplicateResult.duplicatesFound * 25;
      riskScore += duplicateResult.potentialFraudCases * 40;
      riskScore = Math.min(100, riskScore);

      results.overallRiskScore = riskScore;
      results.riskLevel = this.calculateRiskLevel(riskScore);

      // Determine if ready for approval
      results.readyForApproval = 
        validationResult.overallStatus === 'passed' &&
        (incomeResult?.paymentErrorsDetected || 0) === 0 &&
        duplicateResult.potentialFraudCases === 0;

      // Estimate error amount
      if (!results.readyForApproval) {
        results.estimatedErrorAmount = 
          (incomeResult?.totalEstimatedErrorAmount || 0) +
          (validationResult.checks
            .filter(c => c.estimatedImpact)
            .reduce((sum, c) => sum + (c.estimatedImpact || 0), 0));
        
        results.predictedErrorType = results.estimatedErrorAmount > 0 ? 'overpayment' : 'none';
      }

      // Generate nudges if issues found
      if (results.riskFactors!.length > 0) {
        const nudges = await explainableNudgeService.generateNudgesForCase(caseId, {
          stateCode,
          tenantId,
          caseworkerId
        });
        results.nudges = nudges;
      }

      // Get QC analytics risk assessment as additional context
      try {
        const qcAnalysis = await qcAnalyticsService.analyzeCase(caseId);
        if (qcAnalysis && qcAnalysis.riskScore > riskScore) {
          results.overallRiskScore = Math.max(riskScore, qcAnalysis.riskScore);
          results.riskFactors!.push(...(qcAnalysis.errorHistory || []));
        }
      } catch (qcError) {
        // QC analytics is optional enhancement
        logger.debug('QC analytics unavailable', { caseId });
      }

      logger.info('PER case assessment completed', {
        service: 'PaymentErrorReductionService',
        caseId,
        riskScore: results.overallRiskScore,
        readyForApproval: results.readyForApproval
      });

      return results as CaseRiskAssessment;

    } catch (error) {
      logger.error('PER case assessment failed', {
        service: 'PaymentErrorReductionService',
        method: 'assessCase',
        caseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get dashboard metrics for PER monitoring
   */
  async getDashboardMetrics(
    stateCode: string = 'MD',
    days: number = 30
  ): Promise<PerDashboardMetrics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      // Get counts in parallel
      const [
        incomeVerifications,
        consistencyChecks,
        duplicateClaims,
        caseworkerNudges,
        permStats
      ] = await Promise.all([
        db.select()
          .from(perIncomeVerifications)
          .where(and(
            eq(perIncomeVerifications.stateCode, stateCode),
            gte(perIncomeVerifications.createdAt, startDate)
          )),
        db.select()
          .from(perConsistencyChecks)
          .where(and(
            eq(perConsistencyChecks.stateCode, stateCode),
            gte(perConsistencyChecks.createdAt, startDate)
          )),
        db.select()
          .from(perDuplicateClaims)
          .where(and(
            eq(perDuplicateClaims.stateCode, stateCode),
            gte(perDuplicateClaims.createdAt, startDate)
          )),
        db.select()
          .from(perCaseworkerNudges)
          .where(and(
            eq(perCaseworkerNudges.stateCode, stateCode),
            gte(perCaseworkerNudges.createdAt, startDate)
          )),
        permReportingService.getSamplePeriodProgress(stateCode)
      ]);

      // Calculate error prevention metrics
      const errorsPreventedAmount = caseworkerNudges
        .filter(n => n.outcomeType === 'error_prevented')
        .reduce((sum, n) => sum + (n.actualErrorAmount || 0), 0);

      // Count pending items
      const pendingIncomeVerifications = incomeVerifications
        .filter(v => v.resolutionStatus === 'pending' && v.isPaymentError).length;
      const pendingConsistencyChecks = consistencyChecks
        .filter(c => !c.wasAddressed && c.checkStatus === 'failed').length;
      const pendingDuplicateClaims = duplicateClaims
        .filter(d => d.resolutionStatus === 'pending').length;
      const activeNudges = caseworkerNudges
        .filter(n => n.nudgeStatus === 'pending').length;

      // Error type breakdown
      const errorsByType: Record<string, number> = {};
      for (const v of incomeVerifications.filter(v => v.isPaymentError)) {
        const type = v.errorType || 'unknown';
        errorsByType[type] = (errorsByType[type] || 0) + 1;
      }

      const errorsByCategory: Record<string, number> = {
        income_verification: incomeVerifications.filter(v => v.isPaymentError).length,
        consistency_check: consistencyChecks.filter(c => c.checkStatus === 'failed').length,
        duplicate_claim: duplicateClaims.length
      };

      // Get PERM compliance info
      const latestPerm = permStats[0];
      const lastPermErrorRate = latestPerm?.errorsFound && latestPerm?.reviewed
        ? (latestPerm.errorsFound / latestPerm.reviewed) * 100
        : 0;

      return {
        totalCasesScanned: new Set([
          ...incomeVerifications.map(v => v.caseId),
          ...consistencyChecks.map(c => c.caseId),
          ...duplicateClaims.map(d => d.primaryCaseId)
        ]).size,
        errorsPreventedCount: caseworkerNudges.filter(n => n.outcomeType === 'error_prevented').length,
        errorsPreventedAmount,
        pendingIncomeVerifications,
        pendingConsistencyChecks,
        pendingDuplicateClaims,
        activeNudges,
        currentErrorRate: lastPermErrorRate,
        errorRateTrend: 'stable', // Would calculate from historical data
        targetErrorRate: 6.0,
        errorsByType,
        errorsByCategory,
        permCompliant: lastPermErrorRate <= 6.0,
        lastPermReportPeriod: latestPerm?.samplePeriod,
        lastPermErrorRate
      };

    } catch (error) {
      logger.error('Dashboard metrics fetch failed', {
        service: 'PaymentErrorReductionService',
        method: 'getDashboardMetrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<PerSystemHealth> {
    const servicesOperational = {
      incomeVerification: true,
      preSubmissionValidator: true,
      duplicateDetection: true,
      nudgeGeneration: true,
      permReporting: true
    };

    try {
      // Simple health check - verify services are instantiated
      servicesOperational.incomeVerification = !!incomeVerificationService;
      servicesOperational.preSubmissionValidator = !!preSubmissionValidatorService;
      servicesOperational.duplicateDetection = !!duplicateClaimDetectorService;
      servicesOperational.nudgeGeneration = !!explainableNudgeService;
      servicesOperational.permReporting = !!permReportingService;

      // Check database connectivity
      const [recentActivity] = await db.select()
        .from(perCaseworkerNudges)
        .orderBy(desc(perCaseworkerNudges.createdAt))
        .limit(1);

      // Count processing backlog
      const pendingCounts = await Promise.all([
        db.select({ count: count() })
          .from(perIncomeVerifications)
          .where(eq(perIncomeVerifications.resolutionStatus, 'pending')),
        db.select({ count: count() })
          .from(perConsistencyChecks)
          .where(eq(perConsistencyChecks.wasAddressed, false)),
        db.select({ count: count() })
          .from(perDuplicateClaims)
          .where(eq(perDuplicateClaims.resolutionStatus, 'pending'))
      ]);

      const totalBacklog = pendingCounts.reduce(
        (sum, [{ count: c }]) => sum + (c || 0),
        0
      );

      const allOperational = Object.values(servicesOperational).every(v => v);

      return {
        servicesOperational,
        lastActivityTime: recentActivity?.createdAt || new Date(),
        processingBacklog: totalBacklog,
        systemStatus: allOperational ? 'healthy' : 'degraded'
      };

    } catch (error) {
      logger.error('System health check failed', {
        service: 'PaymentErrorReductionService',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        servicesOperational,
        lastActivityTime: new Date(),
        processingBacklog: 0,
        systemStatus: 'offline'
      };
    }
  }

  /**
   * Run batch PER processing for multiple cases
   */
  async batchAssessCases(
    caseIds: string[],
    options: {
      wageDataByCase?: Map<string, WageDataRecord[]>;
      stateCode?: string;
      tenantId?: string;
    } = {}
  ): Promise<Map<string, CaseRiskAssessment>> {
    const { wageDataByCase = new Map(), stateCode = 'MD', tenantId } = options;
    const results = new Map<string, CaseRiskAssessment>();

    for (const caseId of caseIds) {
      try {
        const wageData = wageDataByCase.get(caseId) || [];
        const assessment = await this.assessCase(caseId, {
          wageData,
          stateCode,
          tenantId
        });
        results.set(caseId, assessment);
      } catch (error) {
        logger.error('Batch assessment failed for case', {
          service: 'PaymentErrorReductionService',
          caseId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Generate comprehensive PER report
   */
  async generateComprehensiveReport(
    stateCode: string = 'MD',
    samplePeriod?: string
  ): Promise<{
    metrics: PerDashboardMetrics;
    permReport?: PermRateReport;
    topRiskCases: Array<{ caseId: string; riskScore: number; issues: string[] }>;
    recommendations: string[];
  }> {
    const metrics = await this.getDashboardMetrics(stateCode);

    let permReport: PermRateReport | undefined;
    if (samplePeriod) {
      try {
        permReport = await permReportingService.generatePermReport(samplePeriod, stateCode);
      } catch (error) {
        logger.warn('PERM report not available', { samplePeriod });
      }
    }

    // Get top risk cases from nudges
    const highRiskNudges = await explainableNudgeService.getHighPriorityNudges(stateCode, 10);
    const topRiskCases = highRiskNudges.map(n => ({
      caseId: n.caseId,
      riskScore: n.riskScore,
      issues: n.riskFactors || []
    }));

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (metrics.pendingIncomeVerifications > 10) {
      recommendations.push('High volume of pending income verifications - prioritize review');
    }
    if (metrics.pendingDuplicateClaims > 5) {
      recommendations.push('Resolve duplicate claim findings to prevent dual enrollment');
    }
    if (!metrics.permCompliant) {
      recommendations.push('CRITICAL: Error rate exceeds FNS threshold - implement corrective actions');
    }
    if (metrics.activeNudges > 20) {
      recommendations.push('Caseworker nudge backlog growing - review staffing allocation');
    }

    return {
      metrics,
      permReport,
      topRiskCases,
      recommendations
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
}

export const paymentErrorReductionService = new PaymentErrorReductionService();
