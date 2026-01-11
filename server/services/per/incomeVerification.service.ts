/**
 * Income Verification Service
 * 
 * SNAP Payment Error Reduction Module - Income Verification Component
 * Matches reported income against external wage data (W-2, state wage DB)
 * to detect discrepancies and prevent payment errors.
 * 
 * Per Arnold Ventures/MD DHS Blueprint for SNAP PER Reduction
 */

import { db } from '../../db';
import {
  perIncomeVerifications,
  clientCases,
  householdProfiles,
  eligibilityCalculations,
  type InsertPerIncomeVerification,
  type PerIncomeVerification
} from '@shared/schema';
import { eq, and, gte, lte, desc, sql, isNull } from 'drizzle-orm';
import { logger } from '../logger.service';
import { GoogleGenAI } from '@google/genai';
import { 
  neuroSymbolicHybridGateway,
  type IncomeVerificationInput
} from '../neuroSymbolicHybridGateway';

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// Discrepancy thresholds per FNS guidance
const DISCREPANCY_THRESHOLDS = {
  MINOR: 50,      // Under $50 difference - minor discrepancy
  MODERATE: 100,  // $50-$100 - moderate, requires review
  MAJOR: 200,     // $100-$200 - major, likely payment error
  CRITICAL: 500,  // Over $500 - critical, definite payment error
  PERCENT_THRESHOLD: 10, // 10% variance triggers review
};

export interface WageDataRecord {
  employerId: string;
  employerName: string;
  quarterlyWages: number;
  quarter: string; // e.g., "2025-Q1"
  reportedDate: Date;
  source: 'w2' | 'state_wage_db' | 'ssa' | 'employer_direct';
}

export interface IncomeDiscrepancy {
  caseId: string;
  householdMemberId?: string;
  reportedMonthlyIncome: number;
  verifiedMonthlyIncome: number;
  discrepancyAmount: number;
  discrepancyPercent: number;
  discrepancyType: 'underreported' | 'overreported' | 'unreported_employer' | 'missing_income';
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  isPaymentError: boolean;
  errorType?: 'overpayment' | 'underpayment' | 'none';
  estimatedErrorAmount?: number;
  source: string;
  quarter: string;
}

export interface HybridVerificationContext {
  gatewayRunId: string;
  isDiscrepancyViolation: boolean;
  statutoryCitations: string[];
  recommendation: string;
  grade6Explanation: string;
  solverRunId?: string;
  unsatCore?: string[];
  processingPath?: string[];
}

export interface VerificationResult {
  caseId: string;
  verificationsRun: number;
  discrepanciesFound: number;
  paymentErrorsDetected: number;
  totalEstimatedErrorAmount: number;
  discrepancies: IncomeDiscrepancy[];
  aiAnalysis?: string;
  hybridVerification?: HybridVerificationContext;
}

class IncomeVerificationService {
  /**
   * Verify income for a specific case against available wage data
   */
  async verifyCaseIncome(
    caseId: string,
    wageData: WageDataRecord[],
    options: {
      stateCode?: string;
      tenantId?: string;
      createdBy?: string;
    } = {}
  ): Promise<VerificationResult> {
    const { stateCode = 'MD', tenantId, createdBy } = options;

    try {
      // Get case and household data
      const clientCase = await db.query.clientCases.findFirst({
        where: eq(clientCases.id, caseId)
      });

      if (!clientCase) {
        throw new Error(`Case ${caseId} not found`);
      }

      // Get eligibility calculations for income data
      const eligibilityCalcs = await db.select()
        .from(eligibilityCalculations)
        .where(eq(eligibilityCalculations.caseId, caseId))
        .orderBy(desc(eligibilityCalculations.createdAt))
        .limit(1);

      const eligibilityCalc = eligibilityCalcs[0];
      const reportedIncome = this.extractReportedIncome(eligibilityCalc);

      const discrepancies: IncomeDiscrepancy[] = [];
      let totalEstimatedErrorAmount = 0;

      // Process each wage record against reported income
      for (const wageRecord of wageData) {
        const monthlyWage = wageRecord.quarterlyWages / 3; // Convert quarterly to monthly

        // Find matching reported income source
        const matchingReported = reportedIncome.find(
          r => this.isEmployerMatch(r.employer, wageRecord.employerName)
        );

        if (!matchingReported) {
          // Unreported employer
          const discrepancy = this.createDiscrepancy(
            caseId,
            0,
            monthlyWage,
            'unreported_employer',
            wageRecord
          );
          discrepancies.push(discrepancy);

          if (discrepancy.isPaymentError) {
            totalEstimatedErrorAmount += discrepancy.estimatedErrorAmount || 0;
          }

          // Store verification record
          await this.storeVerification(
            caseId,
            null,
            0,
            monthlyWage,
            discrepancy,
            wageRecord,
            stateCode,
            tenantId,
            createdBy
          );
        } else {
          // Compare reported vs verified
          const diff = monthlyWage - matchingReported.amount;
          const discrepancyType = diff > 0 ? 'underreported' : 'overreported';

          if (Math.abs(diff) > DISCREPANCY_THRESHOLDS.MINOR) {
            const discrepancy = this.createDiscrepancy(
              caseId,
              matchingReported.amount,
              monthlyWage,
              discrepancyType,
              wageRecord
            );
            discrepancies.push(discrepancy);

            if (discrepancy.isPaymentError) {
              totalEstimatedErrorAmount += discrepancy.estimatedErrorAmount || 0;
            }

            await this.storeVerification(
              caseId,
              matchingReported.memberId,
              matchingReported.amount,
              monthlyWage,
              discrepancy,
              wageRecord,
              stateCode,
              tenantId,
              createdBy
            );
          }
        }
      }

      // Check for reported income with no wage data match (potential overreporting)
      for (const reported of reportedIncome) {
        const hasMatch = wageData.some(
          w => this.isEmployerMatch(reported.employer, w.employerName)
        );
        if (!hasMatch && reported.amount > 0 && reported.source === 'employment') {
          const discrepancy = this.createDiscrepancy(
            caseId,
            reported.amount,
            0,
            'missing_income',
            { quarter: 'current', source: 'application' } as any
          );
          discrepancies.push(discrepancy);
        }
      }

      // Get AI analysis if discrepancies found
      let aiAnalysis: string | undefined;
      if (discrepancies.length > 0 && gemini) {
        aiAnalysis = await this.getAIAnalysis(clientCase, discrepancies);
      }

      let hybridVerification: HybridVerificationContext | undefined;
      
      if (discrepancies.length > 0) {
        const largestDiscrepancy = discrepancies.reduce((max, d) => 
          d.discrepancyAmount > max.discrepancyAmount ? d : max, discrepancies[0]);
        
        try {
          const hybridInput: IncomeVerificationInput = {
            caseId,
            reportedIncome: largestDiscrepancy.reportedMonthlyIncome,
            verifiedIncome: largestDiscrepancy.verifiedMonthlyIncome,
            incomeSource: largestDiscrepancy.source,
            verificationDate: new Date().toISOString(),
            discrepancyAmount: largestDiscrepancy.discrepancyAmount
          };

          const hybridResult = await neuroSymbolicHybridGateway.verifyIncomeDiscrepancy(
            hybridInput,
            stateCode,
            'SNAP',
            { tenantId, triggeredBy: createdBy }
          );

          hybridVerification = {
            gatewayRunId: hybridResult.gatewayRunId,
            isDiscrepancyViolation: hybridResult.isDiscrepancyViolation,
            statutoryCitations: hybridResult.statutoryCitations,
            recommendation: hybridResult.recommendation,
            grade6Explanation: hybridResult.grade6Explanation,
            solverRunId: hybridResult.symbolicVerification?.solverRunId,
            unsatCore: hybridResult.auditTrail.unsatCore,
            processingPath: hybridResult.auditTrail.processingPath
          };

          logger.info('Hybrid gateway income verification completed', {
            service: 'IncomeVerificationService',
            caseId,
            gatewayRunId: hybridResult.gatewayRunId,
            isViolation: hybridResult.isDiscrepancyViolation,
            statutoryCitations: hybridResult.statutoryCitations.length
          });
        } catch (error) {
          logger.warn('Hybrid gateway verification failed, continuing without', {
            service: 'IncomeVerificationService',
            caseId,
            error: error instanceof Error ? error.message : 'Unknown'
          });
        }
      }

      const result: VerificationResult = {
        caseId,
        verificationsRun: wageData.length + reportedIncome.length,
        discrepanciesFound: discrepancies.length,
        paymentErrorsDetected: discrepancies.filter(d => d.isPaymentError).length,
        totalEstimatedErrorAmount,
        discrepancies,
        aiAnalysis,
        hybridVerification
      };

      logger.info('Income verification completed', {
        service: 'IncomeVerificationService',
        caseId,
        discrepanciesFound: result.discrepanciesFound,
        paymentErrorsDetected: result.paymentErrorsDetected,
        hasHybridVerification: !!hybridVerification
      });

      return result;

    } catch (error) {
      logger.error('Income verification failed', {
        service: 'IncomeVerificationService',
        method: 'verifyCaseIncome',
        caseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Batch verify income for multiple cases
   */
  async batchVerifyIncome(
    caseIds: string[],
    wageDataByCase: Map<string, WageDataRecord[]>,
    options: { stateCode?: string; tenantId?: string; createdBy?: string } = {}
  ): Promise<Map<string, VerificationResult>> {
    const results = new Map<string, VerificationResult>();

    for (const caseId of caseIds) {
      const wageData = wageDataByCase.get(caseId) || [];
      try {
        const result = await this.verifyCaseIncome(caseId, wageData, options);
        results.set(caseId, result);
      } catch (error) {
        logger.error('Batch verification failed for case', {
          service: 'IncomeVerificationService',
          caseId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Get pending verifications that need resolution
   */
  async getPendingVerifications(
    stateCode: string = 'MD',
    limit: number = 50
  ): Promise<PerIncomeVerification[]> {
    return db.select()
      .from(perIncomeVerifications)
      .where(and(
        eq(perIncomeVerifications.stateCode, stateCode),
        eq(perIncomeVerifications.resolutionStatus, 'pending'),
        eq(perIncomeVerifications.isPaymentError, true)
      ))
      .orderBy(desc(perIncomeVerifications.createdAt))
      .limit(limit);
  }

  /**
   * Resolve an income verification finding
   */
  async resolveVerification(
    verificationId: string,
    resolution: {
      action: string;
      resolvedBy: string;
      notes?: string;
    }
  ): Promise<PerIncomeVerification | null> {
    const [updated] = await db.update(perIncomeVerifications)
      .set({
        resolutionStatus: 'resolved',
        resolutionAction: resolution.action,
        resolvedBy: resolution.resolvedBy,
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(perIncomeVerifications.id, verificationId))
      .returning();

    return updated || null;
  }

  /**
   * Get verification statistics for reporting
   */
  async getVerificationStats(
    stateCode: string = 'MD',
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalVerifications: number;
    totalDiscrepancies: number;
    paymentErrorsFound: number;
    totalErrorAmount: number;
    byErrorType: Record<string, number>;
    byResolutionStatus: Record<string, number>;
  }> {
    const conditions = [eq(perIncomeVerifications.stateCode, stateCode)];
    
    if (startDate) {
      conditions.push(gte(perIncomeVerifications.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(perIncomeVerifications.createdAt, endDate));
    }

    const verifications = await db.select()
      .from(perIncomeVerifications)
      .where(and(...conditions));

    const byErrorType: Record<string, number> = {};
    const byResolutionStatus: Record<string, number> = {};
    let paymentErrorsFound = 0;
    let totalErrorAmount = 0;

    for (const v of verifications) {
      if (v.errorType) {
        byErrorType[v.errorType] = (byErrorType[v.errorType] || 0) + 1;
      }
      if (v.resolutionStatus) {
        byResolutionStatus[v.resolutionStatus] = (byResolutionStatus[v.resolutionStatus] || 0) + 1;
      }
      if (v.isPaymentError) {
        paymentErrorsFound++;
        totalErrorAmount += v.estimatedErrorAmount || 0;
      }
    }

    return {
      totalVerifications: verifications.length,
      totalDiscrepancies: verifications.filter(v => v.discrepancyAmount && v.discrepancyAmount > 0).length,
      paymentErrorsFound,
      totalErrorAmount,
      byErrorType,
      byResolutionStatus
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private extractReportedIncome(eligibilityCalc: any): Array<{
    memberId?: string;
    employer: string;
    amount: number;
    source: string;
  }> {
    if (!eligibilityCalc?.inputData) {
      return [];
    }

    const inputData = eligibilityCalc.inputData;
    const incomes: Array<{ memberId?: string; employer: string; amount: number; source: string }> = [];

    // Extract from common income structures
    if (inputData.income) {
      if (typeof inputData.income === 'number') {
        incomes.push({
          employer: 'Primary',
          amount: inputData.income,
          source: 'employment'
        });
      } else if (Array.isArray(inputData.income)) {
        for (const inc of inputData.income) {
          incomes.push({
            memberId: inc.memberId,
            employer: inc.employer || inc.source || 'Unknown',
            amount: inc.amount || inc.monthly || 0,
            source: inc.type || 'employment'
          });
        }
      }
    }

    // Extract earned income specifically
    if (inputData.earnedIncome) {
      incomes.push({
        employer: inputData.employer || 'Primary Employer',
        amount: inputData.earnedIncome,
        source: 'employment'
      });
    }

    // Extract from household members if present
    if (inputData.householdMembers && Array.isArray(inputData.householdMembers)) {
      for (const member of inputData.householdMembers) {
        if (member.income && member.income > 0) {
          incomes.push({
            memberId: member.id,
            employer: member.employer || 'Unknown',
            amount: member.income,
            source: 'employment'
          });
        }
      }
    }

    return incomes;
  }

  private isEmployerMatch(employer1: string, employer2: string): boolean {
    const normalize = (s: string) => s.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/inc|llc|corp|corporation|company|co/g, '');
    
    const n1 = normalize(employer1);
    const n2 = normalize(employer2);

    // Exact match after normalization
    if (n1 === n2) return true;

    // One contains the other
    if (n1.includes(n2) || n2.includes(n1)) return true;

    // Simple similarity check
    const shorter = n1.length < n2.length ? n1 : n2;
    const longer = n1.length < n2.length ? n2 : n1;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    
    return matches / shorter.length > 0.8;
  }

  private createDiscrepancy(
    caseId: string,
    reportedAmount: number,
    verifiedAmount: number,
    type: 'underreported' | 'overreported' | 'unreported_employer' | 'missing_income',
    wageRecord: WageDataRecord | { quarter: string; source: string }
  ): IncomeDiscrepancy {
    const diff = Math.abs(verifiedAmount - reportedAmount);
    const percentDiff = reportedAmount > 0 
      ? (diff / reportedAmount) * 100 
      : 100;

    let severity: 'minor' | 'moderate' | 'major' | 'critical';
    if (diff < DISCREPANCY_THRESHOLDS.MINOR) {
      severity = 'minor';
    } else if (diff < DISCREPANCY_THRESHOLDS.MODERATE) {
      severity = 'moderate';
    } else if (diff < DISCREPANCY_THRESHOLDS.MAJOR) {
      severity = 'major';
    } else {
      severity = 'critical';
    }

    // Determine if this is a payment error
    const isPaymentError = diff >= DISCREPANCY_THRESHOLDS.MODERATE || 
      percentDiff >= DISCREPANCY_THRESHOLDS.PERCENT_THRESHOLD;

    // Determine error type
    let errorType: 'overpayment' | 'underpayment' | 'none' = 'none';
    if (isPaymentError) {
      // If client underreported income, they received MORE than entitled = overpayment
      // If client overreported income, they received LESS than entitled = underpayment
      if (type === 'underreported' || type === 'unreported_employer') {
        errorType = 'overpayment';
      } else if (type === 'overreported') {
        errorType = 'underpayment';
      }
    }

    // Estimate error amount (simplified - actual would use benefit calculation)
    // Roughly 30% of income difference affects SNAP benefit
    const estimatedErrorAmount = isPaymentError ? Math.round(diff * 0.3) : 0;

    return {
      caseId,
      reportedMonthlyIncome: reportedAmount,
      verifiedMonthlyIncome: verifiedAmount,
      discrepancyAmount: diff,
      discrepancyPercent: percentDiff,
      discrepancyType: type,
      severity,
      isPaymentError,
      errorType: errorType === 'none' ? undefined : errorType,
      estimatedErrorAmount,
      source: wageRecord.source,
      quarter: wageRecord.quarter
    };
  }

  private async storeVerification(
    caseId: string,
    householdMemberId: string | null,
    reportedAmount: number,
    verifiedAmount: number,
    discrepancy: IncomeDiscrepancy,
    wageRecord: WageDataRecord,
    stateCode: string,
    tenantId?: string,
    createdBy?: string
  ): Promise<void> {
    const verification: InsertPerIncomeVerification = {
      caseId,
      householdMemberId: householdMemberId || undefined,
      reportedGrossIncome: reportedAmount,
      reportedEmployer: wageRecord.employerName,
      verifiedGrossIncome: verifiedAmount,
      verifiedIncomeSource: wageRecord.source,
      verifiedEmployer: wageRecord.employerName,
      verificationQuarter: wageRecord.quarter,
      verificationDate: new Date(),
      discrepancyAmount: discrepancy.discrepancyAmount,
      discrepancyPercent: discrepancy.discrepancyPercent,
      discrepancyType: discrepancy.discrepancyType,
      isPaymentError: discrepancy.isPaymentError,
      errorType: discrepancy.errorType,
      estimatedErrorAmount: discrepancy.estimatedErrorAmount,
      stateCode,
      tenantId,
      createdBy
    };

    await db.insert(perIncomeVerifications).values(verification);
  }

  private async getAIAnalysis(
    clientCase: any,
    discrepancies: IncomeDiscrepancy[]
  ): Promise<string | undefined> {
    if (!gemini) return undefined;

    try {
      const prompt = `
        Analyze the following income discrepancies for SNAP case ${clientCase.id}:
        
        ${JSON.stringify(discrepancies, null, 2)}
        
        Provide:
        1. Root cause assessment (why might this discrepancy have occurred?)
        2. Risk assessment (likelihood this is a true payment error vs data timing issue)
        3. Recommended next steps for the caseworker
        4. Documentation that should be requested
        
        Keep response concise and actionable.
      `;

      const response = await gemini.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      return response.text;
    } catch (error) {
      logger.error('AI analysis failed', {
        service: 'IncomeVerificationService',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return undefined;
    }
  }
}

export const incomeVerificationService = new IncomeVerificationService();
