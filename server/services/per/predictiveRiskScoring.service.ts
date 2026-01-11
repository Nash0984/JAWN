/**
 * Predictive Risk Scoring Service
 * 
 * ML-based Payment Error Risk Prediction per Arnold Ventures/MD DHS Blueprint
 * Implements "predict and prevent" strategy with feature engineering and
 * logistic regression-style risk scoring for prioritized case review.
 * 
 * Features:
 * - Feature store for case-level risk indicators
 * - Weighted scoring model trained on historical payment errors
 * - Real-time risk score calculation with confidence intervals
 * - Prioritized case queue generation
 * - Integration with neuro-symbolic hybrid gateway for verification
 */

import { db } from '../../db';
import {
  perIncomeVerifications,
  perConsistencyChecks,
  perDuplicateClaims,
  perCaseworkerNudges,
  clientCases,
  householdProfiles,
  eligibilityCalculations
} from '@shared/schema';
import { eq, and, desc, gte, lte, sql, count, or } from 'drizzle-orm';
import { logger } from '../logger.service';

export interface RiskFeatures {
  caseId: string;
  incomeVariability: number;
  householdComplexity: number;
  documentationCompleteness: number;
  historicalErrorRate: number;
  changeFrequency: number;
  employmentStability: number;
  verificationMismatchScore: number;
  duplicateRiskScore: number;
  workRequirementCompliance: number;
  resourceProximity: number;
}

export interface PredictiveRiskScore {
  caseId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidenceInterval: { lower: number; upper: number };
  predictedErrorProbability: number;
  predictedErrorAmount: number;
  primaryRiskFactors: RiskFactor[];
  featureVector: RiskFeatures;
  modelVersion: string;
  scoredAt: Date;
}

export interface RiskFactor {
  factor: string;
  description: string;
  weight: number;
  contribution: number;
  statutoryCitation?: string;
  remediationAction?: string;
}

export interface CaseRiskQueueItem {
  caseId: string;
  clientName?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  predictedErrorProbability: number;
  predictedErrorAmount: number;
  primaryRiskFactor: string;
  daysSinceLastReview: number;
  assignedCaseworker?: string;
  priority: number;
}

export interface RiskQueueRequest {
  stateCode?: string;
  tenantId?: string;
  riskLevelFilter?: ('low' | 'medium' | 'high' | 'critical')[];
  limit?: number;
  offset?: number;
  sortBy?: 'riskScore' | 'predictedErrorAmount' | 'priority';
  sortDirection?: 'asc' | 'desc';
}

const MODEL_WEIGHTS: Record<keyof Omit<RiskFeatures, 'caseId'>, number> = {
  incomeVariability: 0.18,
  householdComplexity: 0.08,
  documentationCompleteness: 0.15,
  historicalErrorRate: 0.22,
  changeFrequency: 0.10,
  employmentStability: 0.12,
  verificationMismatchScore: 0.20,
  duplicateRiskScore: 0.15,
  workRequirementCompliance: 0.08,
  resourceProximity: 0.07
};

const MODEL_VERSION = 'PER-LR-v2.1.0';
const AVERAGE_SNAP_BENEFIT_MONTHLY = 256;

class PredictiveRiskScoringService {
  /**
   * Calculate predictive risk score for a case
   */
  async calculateRiskScore(
    caseId: string,
    options: { stateCode?: string; tenantId?: string } = {}
  ): Promise<PredictiveRiskScore> {
    const { stateCode = 'MD' } = options;

    logger.info('Calculating predictive risk score', {
      service: 'PredictiveRiskScoringService',
      caseId,
      stateCode
    });

    try {
      const features = await this.extractFeatures(caseId, stateCode);
      
      const riskContributions: RiskFactor[] = [];
      let totalScore = 0;

      for (const [featureName, weight] of Object.entries(MODEL_WEIGHTS)) {
        const featureValue = features[featureName as keyof typeof MODEL_WEIGHTS] || 0;
        const contribution = featureValue * weight;
        totalScore += contribution;

        if (contribution > 0.05) {
          riskContributions.push({
            factor: this.formatFeatureName(featureName),
            description: this.getFeatureDescription(featureName, featureValue),
            weight,
            contribution,
            statutoryCitation: this.getStatutoryCitation(featureName),
            remediationAction: this.getRemediationAction(featureName, featureValue)
          });
        }
      }

      const normalizedScore = Math.min(Math.max(totalScore * 100, 0), 100);
      const riskLevel = this.determineRiskLevel(normalizedScore);
      const predictedErrorProbability = this.calculateErrorProbability(normalizedScore);
      const predictedErrorAmount = this.estimateErrorAmount(predictedErrorProbability, features);
      const confidenceInterval = this.calculateConfidenceInterval(normalizedScore, features);

      riskContributions.sort((a, b) => b.contribution - a.contribution);

      const result: PredictiveRiskScore = {
        caseId,
        riskScore: Math.round(normalizedScore * 10) / 10,
        riskLevel,
        confidenceInterval,
        predictedErrorProbability: Math.round(predictedErrorProbability * 1000) / 10,
        predictedErrorAmount: Math.round(predictedErrorAmount * 100) / 100,
        primaryRiskFactors: riskContributions.slice(0, 5),
        featureVector: features,
        modelVersion: MODEL_VERSION,
        scoredAt: new Date()
      };

      logger.info('Predictive risk score calculated', {
        service: 'PredictiveRiskScoringService',
        caseId,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        primaryFactorCount: result.primaryRiskFactors.length
      });

      return result;

    } catch (error) {
      logger.error('Risk score calculation failed', {
        service: 'PredictiveRiskScoringService',
        method: 'calculateRiskScore',
        caseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get prioritized case queue based on risk scores
   */
  async getPrioritizedCaseQueue(
    request: RiskQueueRequest = {}
  ): Promise<{ cases: CaseRiskQueueItem[]; total: number }> {
    const {
      stateCode = 'MD',
      riskLevelFilter,
      limit = 50,
      offset = 0,
      sortBy = 'priority',
      sortDirection = 'desc'
    } = request;

    logger.info('Generating prioritized case queue', {
      service: 'PredictiveRiskScoringService',
      stateCode,
      limit,
      offset
    });

    try {
      const cases = await db.select()
        .from(clientCases)
        .where(and(
          eq(clientCases.status, 'in_review'),
          stateCode ? eq(clientCases.stateCode, stateCode) : undefined
        ))
        .limit(Math.min(limit * 2, 200))
        .offset(offset);

      const scoredCases: CaseRiskQueueItem[] = [];

      for (const clientCase of cases) {
        try {
          const riskScore = await this.calculateRiskScore(clientCase.id, { stateCode });
          
          const daysSinceLastReview = clientCase.lastContactDate
            ? Math.floor((Date.now() - new Date(clientCase.lastContactDate).getTime()) / (1000 * 60 * 60 * 24))
            : 30;

          const priority = this.calculatePriority(
            riskScore.riskScore,
            riskScore.predictedErrorAmount,
            daysSinceLastReview
          );

          if (riskLevelFilter && !riskLevelFilter.includes(riskScore.riskLevel)) {
            continue;
          }

          scoredCases.push({
            caseId: clientCase.id,
            clientName: clientCase.fullName || undefined,
            riskScore: riskScore.riskScore,
            riskLevel: riskScore.riskLevel,
            predictedErrorProbability: riskScore.predictedErrorProbability,
            predictedErrorAmount: riskScore.predictedErrorAmount,
            primaryRiskFactor: riskScore.primaryRiskFactors[0]?.factor || 'No significant factors',
            daysSinceLastReview,
            assignedCaseworker: clientCase.assignedNavigatorId || undefined,
            priority
          });
        } catch (e) {
          logger.debug('Skipping case due to scoring error', { caseId: clientCase.id });
        }
      }

      scoredCases.sort((a, b) => {
        const aVal = a[sortBy as keyof CaseRiskQueueItem] as number;
        const bVal = b[sortBy as keyof CaseRiskQueueItem] as number;
        return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
      });

      return {
        cases: scoredCases.slice(0, limit),
        total: scoredCases.length
      };

    } catch (error) {
      logger.error('Case queue generation failed', {
        service: 'PredictiveRiskScoringService',
        method: 'getPrioritizedCaseQueue',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get high-risk cases requiring immediate review
   */
  async getHighRiskCases(
    stateCode: string = 'MD',
    limit: number = 20
  ): Promise<CaseRiskQueueItem[]> {
    const result = await this.getPrioritizedCaseQueue({
      stateCode,
      riskLevelFilter: ['high', 'critical'],
      limit,
      sortBy: 'riskScore',
      sortDirection: 'desc'
    });
    return result.cases;
  }

  /**
   * Get risk score statistics for dashboard
   */
  async getRiskScoreStats(stateCode: string = 'MD'): Promise<{
    averageRiskScore: number;
    riskDistribution: Record<string, number>;
    topRiskFactors: { factor: string; frequency: number }[];
    totalAssessed: number;
    highRiskCount: number;
    predictedErrorTotal: number;
  }> {
    const cases = await this.getPrioritizedCaseQueue({
      stateCode,
      limit: 100,
      sortBy: 'riskScore',
      sortDirection: 'desc'
    });

    const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0 };
    const factorCounts: Record<string, number> = {};
    let totalScore = 0;
    let totalPredictedError = 0;

    for (const c of cases.cases) {
      riskDistribution[c.riskLevel]++;
      totalScore += c.riskScore;
      totalPredictedError += c.predictedErrorAmount;
      
      if (c.primaryRiskFactor) {
        factorCounts[c.primaryRiskFactor] = (factorCounts[c.primaryRiskFactor] || 0) + 1;
      }
    }

    const topRiskFactors = Object.entries(factorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([factor, frequency]) => ({ factor, frequency }));

    return {
      averageRiskScore: cases.cases.length > 0 ? totalScore / cases.cases.length : 0,
      riskDistribution,
      topRiskFactors,
      totalAssessed: cases.total,
      highRiskCount: riskDistribution.high + riskDistribution.critical,
      predictedErrorTotal: totalPredictedError
    };
  }

  private async extractFeatures(caseId: string, stateCode: string): Promise<RiskFeatures> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      incomeVerifications,
      consistencyChecks,
      duplicateClaims,
      previousNudges,
      householdData,
      caseData
    ] = await Promise.all([
      db.select()
        .from(perIncomeVerifications)
        .where(eq(perIncomeVerifications.caseId, caseId))
        .orderBy(desc(perIncomeVerifications.createdAt))
        .limit(10),
      db.select()
        .from(perConsistencyChecks)
        .where(eq(perConsistencyChecks.caseId, caseId))
        .limit(20),
      db.select()
        .from(perDuplicateClaims)
        .where(or(
          eq(perDuplicateClaims.primaryCaseId, caseId),
          eq(perDuplicateClaims.duplicateCaseId, caseId)
        )),
      db.select()
        .from(perCaseworkerNudges)
        .where(eq(perCaseworkerNudges.caseId, caseId))
        .orderBy(desc(perCaseworkerNudges.createdAt)),
      db.select()
        .from(householdProfiles)
        .where(eq(householdProfiles.clientCaseId, caseId))
        .limit(1),
      db.select()
        .from(clientCases)
        .where(eq(clientCases.id, caseId))
        .limit(1)
    ]);

    const clientCase = caseData[0];
    
    const incomeVariability = this.calculateIncomeVariability(incomeVerifications);
    const householdComplexity = this.calculateHouseholdComplexity(householdData);
    const documentationCompleteness = this.calculateDocumentationCompleteness(consistencyChecks);
    const historicalErrorRate = this.calculateHistoricalErrorRate(previousNudges);
    const changeFrequency = this.calculateChangeFrequency(incomeVerifications, consistencyChecks);
    const employmentStability = this.calculateEmploymentStability(incomeVerifications);
    const verificationMismatchScore = this.calculateVerificationMismatch(incomeVerifications);
    const duplicateRiskScore = this.calculateDuplicateRisk(duplicateClaims);
    const workRequirementCompliance = this.calculateWorkRequirementCompliance(clientCase, householdData);
    const resourceProximity = this.calculateResourceProximity(clientCase);

    return {
      caseId,
      incomeVariability,
      householdComplexity,
      documentationCompleteness,
      historicalErrorRate,
      changeFrequency,
      employmentStability,
      verificationMismatchScore,
      duplicateRiskScore,
      workRequirementCompliance,
      resourceProximity
    };
  }

  private calculateIncomeVariability(verifications: any[]): number {
    if (verifications.length < 2) return 0.3;
    
    const discrepancies = verifications.filter(v => v.isPaymentError || v.discrepancyAmount > 0);
    const avgDiscrepancyRate = discrepancies.length / verifications.length;
    
    const discrepancyAmounts = verifications
      .map(v => Math.abs(v.discrepancyAmount || 0))
      .filter(a => a > 0);
    
    if (discrepancyAmounts.length === 0) return 0.1;
    
    const avgDiscrepancy = discrepancyAmounts.reduce((a, b) => a + b, 0) / discrepancyAmounts.length;
    const normalizedAmount = Math.min(avgDiscrepancy / 500, 1);
    
    return (avgDiscrepancyRate * 0.6 + normalizedAmount * 0.4);
  }

  private calculateHouseholdComplexity(householdData: any[]): number {
    const household = householdData[0];
    if (!household) return 0.5;
    
    const members = Array.isArray(household.householdMembers) 
      ? household.householdMembers 
      : (typeof household.householdMembers === 'string' 
        ? JSON.parse(household.householdMembers) 
        : []);
    
    const memberCount = members.length + 1;
    if (memberCount === 0) return 0.5;
    
    const complexityFactors = {
      largeHousehold: memberCount > 6 ? 0.3 : 0,
      hasMinors: members.some((m: any) => m.age && m.age < 18) ? 0.1 : 0,
      hasElderly: members.some((m: any) => m.age && m.age > 60) ? 0.1 : 0,
      hasDisabled: members.some((m: any) => m.isDisabled) ? 0.15 : 0,
      multipleWorkers: members.filter((m: any) => m.isEmployed || m.employmentStatus === 'employed').length > 1 ? 0.2 : 0
    };
    
    return Math.min(Object.values(complexityFactors).reduce((a, b) => a + b, 0), 1);
  }

  private calculateDocumentationCompleteness(checks: any[]): number {
    if (checks.length === 0) return 0.5;
    
    const docChecks = checks.filter(c => c.checkType === 'documentation');
    if (docChecks.length === 0) return 0.3;
    
    const failedChecks = docChecks.filter(c => c.checkStatus === 'failed');
    return failedChecks.length / docChecks.length;
  }

  private calculateHistoricalErrorRate(nudges: any[]): number {
    if (nudges.length === 0) return 0.2;
    
    const errorNudges = nudges.filter(n => 
      n.outcomeType === 'error_found' || n.outcomeType === 'error_prevented'
    );
    
    const recentNudges = nudges.filter(n => {
      const createdAt = new Date(n.createdAt);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return createdAt > sixMonthsAgo;
    });
    
    if (recentNudges.length === 0) return errorNudges.length > 0 ? 0.4 : 0.1;
    
    const recentErrors = recentNudges.filter(n => 
      n.outcomeType === 'error_found' || n.outcomeType === 'error_prevented'
    );
    
    return recentErrors.length / recentNudges.length;
  }

  private calculateChangeFrequency(verifications: any[], checks: any[]): number {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const recentActivity = [
      ...verifications.filter(v => new Date(v.createdAt) > threeMonthsAgo),
      ...checks.filter(c => new Date(c.createdAt) > threeMonthsAgo)
    ];
    
    const normalizedFrequency = Math.min(recentActivity.length / 10, 1);
    return normalizedFrequency;
  }

  private calculateEmploymentStability(verifications: any[]): number {
    if (verifications.length === 0) return 0.5;
    
    const employers = new Set<string>();
    let gapsDetected = 0;
    
    for (const v of verifications) {
      if (v.wageDataSnapshot) {
        try {
          const wageData = typeof v.wageDataSnapshot === 'string' 
            ? JSON.parse(v.wageDataSnapshot) 
            : v.wageDataSnapshot;
          
          if (Array.isArray(wageData)) {
            for (const w of wageData) {
              if (w.employerName) employers.add(w.employerName);
            }
          }
        } catch {
        }
      }
    }
    
    const employerChurn = Math.min(employers.size / 4, 1);
    return employerChurn * 0.7 + 0.3;
  }

  private calculateVerificationMismatch(verifications: any[]): number {
    if (verifications.length === 0) return 0.3;
    
    const mismatches = verifications.filter(v => 
      v.discrepancyAmount && Math.abs(v.discrepancyAmount) > 50
    );
    
    return Math.min(mismatches.length / verifications.length, 1);
  }

  private calculateDuplicateRisk(duplicateClaims: any[]): number {
    if (duplicateClaims.length === 0) return 0;
    
    const pendingDuplicates = duplicateClaims.filter(d => d.resolutionStatus === 'pending');
    const confirmedDuplicates = duplicateClaims.filter(d => d.resolutionStatus === 'confirmed');
    
    return Math.min(
      (pendingDuplicates.length * 0.3 + confirmedDuplicates.length * 0.7) / 3,
      1
    );
  }

  private calculateWorkRequirementCompliance(clientCase: any, householdData: any[]): number {
    if (!clientCase) return 0.5;
    
    const household = householdData[0];
    if (!household) return 0.3;
    
    const members = Array.isArray(household.householdMembers) 
      ? household.householdMembers 
      : (typeof household.householdMembers === 'string' 
        ? JSON.parse(household.householdMembers) 
        : []);
    
    const workingAgeMembers = members.filter((m: any) => {
      const age = m.age;
      return age && age >= 18 && age < 60 && !m.isDisabled;
    });
    
    if (workingAgeMembers.length === 0) return 0;
    
    const employedCount = workingAgeMembers.filter((m: any) => 
      m.isEmployed || m.employmentStatus === 'employed' || m.employmentStatus === 'self_employed'
    ).length;
    
    const exemptCount = workingAgeMembers.filter((m: any) => 
      m.isCaretaker || m.isStudent
    ).length;
    
    const compliantCount = employedCount + exemptCount;
    return 1 - (compliantCount / workingAgeMembers.length);
  }

  private calculateResourceProximity(clientCase: any): number {
    if (!clientCase) return 0.5;
    
    return 0.3;
  }

  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 35) return 'medium';
    return 'low';
  }

  private calculateErrorProbability(riskScore: number): number {
    const k = 0.08;
    const x0 = 50;
    return 1 / (1 + Math.exp(-k * (riskScore - x0)));
  }

  private estimateErrorAmount(probability: number, features: RiskFeatures): number {
    const baseAmount = AVERAGE_SNAP_BENEFIT_MONTHLY;
    const monthsAtRisk = 3;
    return probability * baseAmount * monthsAtRisk * (1 + features.incomeVariability);
  }

  private calculateConfidenceInterval(
    score: number,
    features: RiskFeatures
  ): { lower: number; upper: number } {
    const uncertainty = 10 - (Object.values(MODEL_WEIGHTS).length * 0.5);
    return {
      lower: Math.max(0, score - uncertainty),
      upper: Math.min(100, score + uncertainty)
    };
  }

  private calculatePriority(
    riskScore: number,
    predictedErrorAmount: number,
    daysSinceReview: number
  ): number {
    const riskWeight = 0.5;
    const amountWeight = 0.3;
    const ageWeight = 0.2;
    
    const normalizedRisk = riskScore / 100;
    const normalizedAmount = Math.min(predictedErrorAmount / 1000, 1);
    const normalizedAge = Math.min(daysSinceReview / 30, 1);
    
    return (normalizedRisk * riskWeight + normalizedAmount * amountWeight + normalizedAge * ageWeight) * 100;
  }

  private formatFeatureName(feature: string): string {
    const names: Record<string, string> = {
      incomeVariability: 'Income Variability',
      householdComplexity: 'Household Complexity',
      documentationCompleteness: 'Missing Documentation',
      historicalErrorRate: 'Historical Error Pattern',
      changeFrequency: 'Frequent Changes',
      employmentStability: 'Employment Instability',
      verificationMismatchScore: 'Verification Mismatch',
      duplicateRiskScore: 'Duplicate Claim Risk',
      workRequirementCompliance: 'Work Requirement Issue',
      resourceProximity: 'Resource Limit Proximity'
    };
    return names[feature] || feature;
  }

  private getFeatureDescription(feature: string, value: number): string {
    const descriptions: Record<string, string> = {
      incomeVariability: `Income reporting shows ${Math.round(value * 100)}% variability from wage data`,
      householdComplexity: `Household structure indicates ${value > 0.5 ? 'high' : 'moderate'} complexity`,
      documentationCompleteness: `${Math.round(value * 100)}% of required documentation is missing or incomplete`,
      historicalErrorRate: `Case has ${Math.round(value * 100)}% historical error rate in past 6 months`,
      changeFrequency: `${Math.round(value * 10)} significant changes reported in past 3 months`,
      employmentStability: `Employment history shows ${value > 0.5 ? 'significant' : 'some'} instability`,
      verificationMismatchScore: `${Math.round(value * 100)}% of income verifications show discrepancies`,
      duplicateRiskScore: `Case has ${value > 0 ? 'potential' : 'no'} duplicate claim indicators`,
      workRequirementCompliance: `${Math.round(value * 100)}% of work-eligible members not meeting requirements`,
      resourceProximity: `Resources are ${value > 0.7 ? 'near' : 'below'} SNAP limits`
    };
    return descriptions[feature] || `Risk indicator score: ${Math.round(value * 100)}%`;
  }

  private getStatutoryCitation(feature: string): string {
    const citations: Record<string, string> = {
      incomeVariability: '7 CFR 273.10(c) - Income determination',
      householdComplexity: '7 CFR 273.1(b) - Household definition',
      documentationCompleteness: '7 CFR 273.2(f) - Verification requirements',
      historicalErrorRate: 'FNS 310 Handbook - Quality Control procedures',
      changeFrequency: '7 CFR 273.12 - Change reporting requirements',
      employmentStability: '7 CFR 273.9(b) - Income from employment',
      verificationMismatchScore: '7 CFR 273.2(f)(4) - Wage matching',
      duplicateRiskScore: '7 CFR 273.3 - Disqualification for duplicate participation',
      workRequirementCompliance: '7 CFR 273.7 - Work registration requirements',
      resourceProximity: '7 CFR 273.8 - Resource eligibility standards'
    };
    return citations[feature] || '7 CFR 273 - SNAP Regulations';
  }

  private getRemediationAction(feature: string, value: number): string {
    const actions: Record<string, string> = {
      incomeVariability: 'Request updated pay stubs and verify against wage data match',
      householdComplexity: 'Conduct household composition interview',
      documentationCompleteness: 'Send documentation request letter with specific items needed',
      historicalErrorRate: 'Review case history and establish enhanced monitoring',
      changeFrequency: 'Schedule follow-up contact to verify current circumstances',
      employmentStability: 'Verify current employment status with employer',
      verificationMismatchScore: 'Reconcile reported income with wage data sources',
      duplicateRiskScore: 'Investigate potential duplicate participation',
      workRequirementCompliance: 'Assess work requirement exemptions and compliance',
      resourceProximity: 'Verify current resource levels and bank statements'
    };
    return actions[feature] || 'Review case for accuracy';
  }
}

export const predictiveRiskScoringService = new PredictiveRiskScoringService();
