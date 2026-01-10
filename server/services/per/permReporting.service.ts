/**
 * PERM Reporting Service
 * 
 * SNAP Payment Error Reduction Module - FNS PERM Compliance Component
 * Implements FNS-compliant sampling and federal payment error rate reporting.
 * 
 * Per Arnold Ventures: "Analyze audit data to understand the drivers of payment error rates"
 */

import { db } from '../../db';
import {
  perPermSamples,
  perIncomeVerifications,
  perConsistencyChecks,
  perDuplicateClaims,
  clientCases,
  eligibilityCalculations,
  type InsertPerPermSample,
  type PerPermSample
} from '@shared/schema';
import { eq, and, desc, gte, lte, sql, count } from 'drizzle-orm';
import { logger } from '../logger.service';

// FNS PERM sample size requirements
const PERM_CONFIG = {
  ACTIVE_CASE_SAMPLE_SIZE: 180, // Minimum per FNS requirements
  NEGATIVE_CASE_SAMPLE_SIZE: 80,
  SAMPLE_PERIOD_MONTHS: 3, // Quarterly sampling
  ERROR_THRESHOLD_PERCENT: 6.0, // FNS tolerance threshold
};

export interface PermSampleSelection {
  caseId: string;
  sampleType: 'active_case' | 'negative_case';
  sampleStratum: string;
  sampleWeight: number;
  benefitAmount?: number;
  householdSize?: number;
  grossIncome?: number;
}

export interface PermReviewFinding {
  caseId: string;
  hasError: boolean;
  errorType?: 'overpayment' | 'underpayment' | 'none';
  errorAmount?: number;
  correctBenefitAmount?: number;
  errorCategory?: 'agency_error' | 'client_error' | 'both';
  errorCause?: string;
  errorSubcause?: string;
  incomeVariance?: number;
  deductionVariance?: number;
  householdVariance?: number;
  findingsSummary: string;
  correctiveActions: string[];
}

export interface PermRateReport {
  reportPeriod: string;
  stateCode: string;
  // Active case error rates
  activeCaseSampleSize: number;
  activeCaseErrorCount: number;
  activeCaseOverpaymentRate: number;
  activeCaseUnderpaymentRate: number;
  activeCaseTotalErrorRate: number;
  // Negative case error rates
  negativeCaseSampleSize: number;
  negativeCaseErrorCount: number;
  negativeCaseErrorRate: number;
  // Combined rates
  combinedErrorRate: number;
  dollarErrorAmount: number;
  dollarErrorRate: number;
  // Compliance status
  isCompliant: boolean;
  complianceThreshold: number;
  // Breakdown by cause
  errorsByCause: Record<string, number>;
  errorsByCategory: Record<string, number>;
  // Recommendations
  topIssues: string[];
  recommendedActions: string[];
}

class PermReportingService {
  /**
   * Select sample cases for PERM review
   */
  async selectPermSample(
    samplePeriod: string,
    stateCode: string = 'MD',
    options: {
      activeCaseSampleSize?: number;
      negativeCaseSampleSize?: number;
      tenantId?: string;
    } = {}
  ): Promise<{
    activeCases: PermSampleSelection[];
    negativeCases: PermSampleSelection[];
    totalSelected: number;
  }> {
    const {
      activeCaseSampleSize = PERM_CONFIG.ACTIVE_CASE_SAMPLE_SIZE,
      negativeCaseSampleSize = PERM_CONFIG.NEGATIVE_CASE_SAMPLE_SIZE,
      tenantId
    } = options;

    try {
      // Get active cases for sampling
      const activeCases = await db.select()
        .from(clientCases)
        .where(eq(clientCases.status, 'active'))
        .orderBy(sql`RANDOM()`)
        .limit(activeCaseSampleSize * 2); // Over-sample for stratification

      // Get denied/closed cases for negative sampling
      const negativeCases = await db.select()
        .from(clientCases)
        .where(eq(clientCases.status, 'denied'))
        .orderBy(sql`RANDOM()`)
        .limit(negativeCaseSampleSize * 2);

      // Stratified sampling for active cases
      const selectedActive = await this.stratifiedSample(
        activeCases,
        activeCaseSampleSize,
        'active_case'
      );

      // Random sampling for negative cases
      const selectedNegative = negativeCases
        .slice(0, negativeCaseSampleSize)
        .map(c => ({
          caseId: c.id,
          sampleType: 'negative_case' as const,
          sampleStratum: 'denial',
          sampleWeight: 1.0
        }));

      // Store samples in database
      const allSamples = [...selectedActive, ...selectedNegative];
      for (const sample of allSamples) {
        await this.storeSample(sample, samplePeriod, stateCode, tenantId);
      }

      logger.info('PERM sample selected', {
        service: 'PermReportingService',
        samplePeriod,
        activeCases: selectedActive.length,
        negativeCases: selectedNegative.length
      });

      return {
        activeCases: selectedActive,
        negativeCases: selectedNegative,
        totalSelected: allSamples.length
      };

    } catch (error) {
      logger.error('PERM sample selection failed', {
        service: 'PermReportingService',
        method: 'selectPermSample',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Record review findings for a PERM sample case
   */
  async recordReviewFindings(
    sampleId: string,
    reviewerId: string,
    findings: PermReviewFinding
  ): Promise<PerPermSample | null> {
    const [updated] = await db.update(perPermSamples)
      .set({
        reviewStatus: 'completed',
        reviewCompletedDate: new Date(),
        reviewerId,
        hasError: findings.hasError,
        errorType: findings.errorType,
        errorAmount: findings.errorAmount,
        correctBenefitAmount: findings.correctBenefitAmount,
        errorCategory: findings.errorCategory,
        errorCause: findings.errorCause,
        errorSubcause: findings.errorSubcause,
        incomeVariance: findings.incomeVariance,
        deductionVariance: findings.deductionVariance,
        householdVariance: findings.householdVariance,
        findingsSummary: findings.findingsSummary,
        correctiveActions: findings.correctiveActions,
        updatedAt: new Date()
      })
      .where(eq(perPermSamples.id, sampleId))
      .returning();

    return updated || null;
  }

  /**
   * Generate PERM rate report for a period
   */
  async generatePermReport(
    samplePeriod: string,
    stateCode: string = 'MD'
  ): Promise<PermRateReport> {
    try {
      // Get all reviewed samples for the period
      const samples = await db.select()
        .from(perPermSamples)
        .where(and(
          eq(perPermSamples.samplePeriod, samplePeriod),
          eq(perPermSamples.stateCode, stateCode),
          eq(perPermSamples.reviewStatus, 'completed')
        ));

      // Separate active and negative cases
      const activeSamples = samples.filter(s => s.sampleType === 'active_case');
      const negativeSamples = samples.filter(s => s.sampleType === 'negative_case');

      // Calculate active case error rates
      const activeErrors = activeSamples.filter(s => s.hasError);
      const activeOverpayments = activeErrors.filter(s => s.errorType === 'overpayment');
      const activeUnderpayments = activeErrors.filter(s => s.errorType === 'underpayment');

      const activeCaseTotalErrorRate = activeSamples.length > 0
        ? (activeErrors.length / activeSamples.length) * 100
        : 0;
      const activeCaseOverpaymentRate = activeSamples.length > 0
        ? (activeOverpayments.length / activeSamples.length) * 100
        : 0;
      const activeCaseUnderpaymentRate = activeSamples.length > 0
        ? (activeUnderpayments.length / activeSamples.length) * 100
        : 0;

      // Calculate negative case error rate
      const negativeErrors = negativeSamples.filter(s => s.hasError);
      const negativeCaseErrorRate = negativeSamples.length > 0
        ? (negativeErrors.length / negativeSamples.length) * 100
        : 0;

      // Calculate combined error rate (weighted)
      const totalSamples = samples.length;
      const totalErrors = activeErrors.length + negativeErrors.length;
      const combinedErrorRate = totalSamples > 0
        ? (totalErrors / totalSamples) * 100
        : 0;

      // Calculate dollar error amount
      const dollarErrorAmount = samples.reduce(
        (sum, s) => sum + (s.errorAmount || 0),
        0
      );
      const totalBenefits = samples.reduce(
        (sum, s) => sum + (s.benefitAmount || 0),
        0
      );
      const dollarErrorRate = totalBenefits > 0
        ? (dollarErrorAmount / totalBenefits) * 100
        : 0;

      // Error breakdown by cause
      const errorsByCause: Record<string, number> = {};
      const errorsByCategory: Record<string, number> = {};
      
      for (const sample of samples.filter(s => s.hasError)) {
        if (sample.errorCause) {
          errorsByCause[sample.errorCause] = (errorsByCause[sample.errorCause] || 0) + 1;
        }
        if (sample.errorCategory) {
          errorsByCategory[sample.errorCategory] = (errorsByCategory[sample.errorCategory] || 0) + 1;
        }
      }

      // Determine compliance
      const isCompliant = combinedErrorRate <= PERM_CONFIG.ERROR_THRESHOLD_PERCENT;

      // Generate top issues and recommendations
      const { topIssues, recommendedActions } = this.generateRecommendations(
        errorsByCause,
        errorsByCategory,
        combinedErrorRate
      );

      const report: PermRateReport = {
        reportPeriod: samplePeriod,
        stateCode,
        activeCaseSampleSize: activeSamples.length,
        activeCaseErrorCount: activeErrors.length,
        activeCaseOverpaymentRate,
        activeCaseUnderpaymentRate,
        activeCaseTotalErrorRate,
        negativeCaseSampleSize: negativeSamples.length,
        negativeCaseErrorCount: negativeErrors.length,
        negativeCaseErrorRate,
        combinedErrorRate,
        dollarErrorAmount,
        dollarErrorRate,
        isCompliant,
        complianceThreshold: PERM_CONFIG.ERROR_THRESHOLD_PERCENT,
        errorsByCause,
        errorsByCategory,
        topIssues,
        recommendedActions
      };

      logger.info('PERM report generated', {
        service: 'PermReportingService',
        samplePeriod,
        combinedErrorRate: combinedErrorRate.toFixed(2),
        isCompliant
      });

      return report;

    } catch (error) {
      logger.error('PERM report generation failed', {
        service: 'PermReportingService',
        method: 'generatePermReport',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get pending samples awaiting review
   */
  async getPendingSamples(
    stateCode: string = 'MD',
    samplePeriod?: string,
    limit: number = 50
  ): Promise<PerPermSample[]> {
    const conditions = [
      eq(perPermSamples.stateCode, stateCode),
      eq(perPermSamples.reviewStatus, 'pending')
    ];

    if (samplePeriod) {
      conditions.push(eq(perPermSamples.samplePeriod, samplePeriod));
    }

    return db.select()
      .from(perPermSamples)
      .where(and(...conditions))
      .orderBy(perPermSamples.selectionDate)
      .limit(limit);
  }

  /**
   * Get sample periods with review progress
   */
  async getSamplePeriodProgress(stateCode: string = 'MD'): Promise<Array<{
    samplePeriod: string;
    totalSamples: number;
    reviewed: number;
    pending: number;
    progressPercent: number;
    errorsFound: number;
  }>> {
    const samples = await db.select()
      .from(perPermSamples)
      .where(eq(perPermSamples.stateCode, stateCode));

    // Group by period
    const byPeriod = new Map<string, PerPermSample[]>();
    for (const sample of samples) {
      const period = sample.samplePeriod;
      if (!byPeriod.has(period)) {
        byPeriod.set(period, []);
      }
      byPeriod.get(period)!.push(sample);
    }

    const results: Array<{
      samplePeriod: string;
      totalSamples: number;
      reviewed: number;
      pending: number;
      progressPercent: number;
      errorsFound: number;
    }> = [];

    for (const [period, periodSamples] of byPeriod) {
      const reviewed = periodSamples.filter(s => s.reviewStatus === 'completed').length;
      const pending = periodSamples.filter(s => s.reviewStatus === 'pending').length;
      const errorsFound = periodSamples.filter(s => s.hasError).length;

      results.push({
        samplePeriod: period,
        totalSamples: periodSamples.length,
        reviewed,
        pending,
        progressPercent: periodSamples.length > 0 ? (reviewed / periodSamples.length) * 100 : 0,
        errorsFound
      });
    }

    return results.sort((a, b) => b.samplePeriod.localeCompare(a.samplePeriod));
  }

  /**
   * Mark sample for FNS submission
   */
  async markForFnsSubmission(
    sampleIds: string[],
    fnsReferenceNumber: string
  ): Promise<number> {
    const result = await db.update(perPermSamples)
      .set({
        fnsReportingStatus: 'submitted',
        fnsSubmissionDate: new Date(),
        fnsReferenceNumber,
        updatedAt: new Date()
      })
      .where(sql`id = ANY(${sampleIds})`);

    return sampleIds.length;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async stratifiedSample(
    cases: any[],
    targetSize: number,
    sampleType: 'active_case' | 'negative_case'
  ): Promise<PermSampleSelection[]> {
    // Stratify by benefit amount ranges
    const strata = {
      low: cases.filter(c => (c.benefitAmount || 0) < 200),
      medium: cases.filter(c => (c.benefitAmount || 0) >= 200 && (c.benefitAmount || 0) < 500),
      high: cases.filter(c => (c.benefitAmount || 0) >= 500)
    };

    const selected: PermSampleSelection[] = [];
    const strataTargets = {
      low: Math.floor(targetSize * 0.3),
      medium: Math.floor(targetSize * 0.4),
      high: Math.floor(targetSize * 0.3)
    };

    for (const [stratum, stratumCases] of Object.entries(strata)) {
      const target = strataTargets[stratum as keyof typeof strataTargets];
      const stratumSample = stratumCases.slice(0, target);
      
      for (const c of stratumSample) {
        selected.push({
          caseId: c.id,
          sampleType,
          sampleStratum: stratum,
          sampleWeight: stratumCases.length / target,
          benefitAmount: c.benefitAmount,
          householdSize: c.householdSize
        });
      }
    }

    return selected;
  }

  private async storeSample(
    sample: PermSampleSelection,
    samplePeriod: string,
    stateCode: string,
    tenantId?: string
  ): Promise<void> {
    const permSample: InsertPerPermSample = {
      caseId: sample.caseId,
      samplePeriod,
      sampleType: sample.sampleType,
      sampleStratum: sample.sampleStratum,
      sampleWeight: sample.sampleWeight,
      selectionDate: new Date(),
      benefitAmount: sample.benefitAmount,
      householdSize: sample.householdSize,
      stateCode,
      tenantId
    };

    await db.insert(perPermSamples).values(permSample);
  }

  private generateRecommendations(
    errorsByCause: Record<string, number>,
    errorsByCategory: Record<string, number>,
    errorRate: number
  ): { topIssues: string[]; recommendedActions: string[] } {
    const topIssues: string[] = [];
    const recommendedActions: string[] = [];

    // Identify top causes
    const sortedCauses = Object.entries(errorsByCause)
      .sort(([, a], [, b]) => b - a);

    for (const [cause, count] of sortedCauses.slice(0, 3)) {
      topIssues.push(`${cause}: ${count} errors`);
    }

    // Generate recommendations based on causes
    if (errorsByCause['income']) {
      recommendedActions.push('Strengthen income verification procedures');
      recommendedActions.push('Implement real-time wage data matching');
    }
    if (errorsByCause['household_comp']) {
      recommendedActions.push('Enhance household composition verification');
      recommendedActions.push('Implement duplicate claim detection');
    }
    if (errorsByCause['deductions']) {
      recommendedActions.push('Review deduction calculation procedures');
    }

    // Category-based recommendations
    if (errorsByCategory['agency_error'] > errorsByCategory['client_error']) {
      recommendedActions.push('Focus on caseworker training and process improvements');
    }

    // Error rate based recommendations
    if (errorRate > 10) {
      recommendedActions.push('CRITICAL: Implement comprehensive error prevention strategy');
    } else if (errorRate > 6) {
      recommendedActions.push('Prioritize pre-submission validation for all cases');
    }

    return { topIssues, recommendedActions };
  }
}

export const permReportingService = new PermReportingService();
