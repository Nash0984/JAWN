/**
 * Explainable Nudge Service (XAI)
 * 
 * SNAP Payment Error Reduction Module - Explainable AI Component
 * Generates plain-language caseworker guidance with specific risk factor explanations.
 * 
 * Per MD DHS Blueprint: "Explainable AI (XAI): Every alert will include a clear, 
 * plain-language explanation of why a case was flagged"
 */

import { db } from '../../db';
import {
  perCaseworkerNudges,
  perIncomeVerifications,
  perConsistencyChecks,
  perDuplicateClaims,
  clientCases,
  users,
  type InsertPerCaseworkerNudge,
  type PerCaseworkerNudge
} from '@shared/schema';
import { eq, and, desc, gte, lte, isNull, or } from 'drizzle-orm';
import { logger } from '../logger.service';
import { GoogleGenAI } from '@google/genai';

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

export type NudgeType = 
  | 'income_discrepancy'
  | 'duplicate_claim'
  | 'documentation_gap'
  | 'pattern_alert'
  | 'resource_limit'
  | 'household_change'
  | 'work_requirement';

export interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
  source: string;
}

export interface CaseworkerNudge {
  caseId: string;
  caseworkerId?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  nudgeTitle: string;
  nudgeDescription: string; // Plain language XAI explanation
  primaryAction: string;
  additionalActions: string[];
  documentationToReview: string[];
  questionsToAsk: string[];
  dataSourcesUsed: string[];
  evidenceSummary: Record<string, any>;
  confidenceScore: number;
  reasoningTrace: string;
  nudgeType: NudgeType;
}

export interface NudgeGenerationResult {
  caseId: string;
  nudgesGenerated: number;
  nudges: CaseworkerNudge[];
}

class ExplainableNudgeService {
  /**
   * Generate nudges for a case based on all PER findings
   */
  async generateNudgesForCase(
    caseId: string,
    options: {
      stateCode?: string;
      tenantId?: string;
      caseworkerId?: string;
    } = {}
  ): Promise<NudgeGenerationResult> {
    const { stateCode = 'MD', tenantId, caseworkerId } = options;

    try {
      // Gather all PER findings for this case
      const [incomeVerifications, consistencyChecks, duplicateClaims] = await Promise.all([
        db.select().from(perIncomeVerifications)
          .where(and(
            eq(perIncomeVerifications.caseId, caseId),
            eq(perIncomeVerifications.resolutionStatus, 'pending')
          )),
        db.select().from(perConsistencyChecks)
          .where(and(
            eq(perConsistencyChecks.caseId, caseId),
            eq(perConsistencyChecks.wasAddressed, false)
          )),
        db.select().from(perDuplicateClaims)
          .where(and(
            eq(perDuplicateClaims.primaryCaseId, caseId),
            eq(perDuplicateClaims.resolutionStatus, 'pending')
          ))
      ]);

      const nudges: CaseworkerNudge[] = [];

      // Generate nudges for income discrepancies
      for (const verification of incomeVerifications) {
        if (verification.isPaymentError) {
          const nudge = await this.createIncomeDiscrepancyNudge(verification, caseId);
          nudges.push(nudge);
          await this.storeNudge(nudge, stateCode, tenantId);
        }
      }

      // Generate nudges for consistency check failures
      for (const check of consistencyChecks) {
        if (check.checkStatus === 'failed' || check.riskLevel === 'high' || check.riskLevel === 'critical') {
          const nudge = await this.createConsistencyNudge(check, caseId);
          nudges.push(nudge);
          await this.storeNudge(nudge, stateCode, tenantId);
        }
      }

      // Generate nudges for duplicate claims
      for (const duplicate of duplicateClaims) {
        const nudge = await this.createDuplicateClaimNudge(duplicate, caseId);
        nudges.push(nudge);
        await this.storeNudge(nudge, stateCode, tenantId);
      }

      // If no specific issues found, check for pattern-based alerts
      if (nudges.length === 0) {
        const patternNudge = await this.checkForPatternAlerts(caseId);
        if (patternNudge) {
          nudges.push(patternNudge);
          await this.storeNudge(patternNudge, stateCode, tenantId);
        }
      }

      logger.info('Nudges generated for case', {
        service: 'ExplainableNudgeService',
        caseId,
        nudgesGenerated: nudges.length
      });

      return {
        caseId,
        nudgesGenerated: nudges.length,
        nudges
      };

    } catch (error) {
      logger.error('Nudge generation failed', {
        service: 'ExplainableNudgeService',
        method: 'generateNudgesForCase',
        caseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get pending nudges for a caseworker
   */
  async getPendingNudges(
    caseworkerId?: string,
    stateCode: string = 'MD',
    limit: number = 20
  ): Promise<PerCaseworkerNudge[]> {
    const conditions = [
      eq(perCaseworkerNudges.stateCode, stateCode),
      eq(perCaseworkerNudges.nudgeStatus, 'pending')
    ];

    if (caseworkerId) {
      conditions.push(eq(perCaseworkerNudges.caseworkerId, caseworkerId));
    }

    return db.select()
      .from(perCaseworkerNudges)
      .where(and(...conditions))
      .orderBy(desc(perCaseworkerNudges.riskScore))
      .limit(limit);
  }

  /**
   * Get high-priority nudges (risk dashboard)
   */
  async getHighPriorityNudges(
    stateCode: string = 'MD',
    limit: number = 10
  ): Promise<PerCaseworkerNudge[]> {
    return db.select()
      .from(perCaseworkerNudges)
      .where(and(
        eq(perCaseworkerNudges.stateCode, stateCode),
        eq(perCaseworkerNudges.nudgeStatus, 'pending'),
        or(
          eq(perCaseworkerNudges.riskLevel, 'critical'),
          eq(perCaseworkerNudges.riskLevel, 'high')
        )
      ))
      .orderBy(desc(perCaseworkerNudges.riskScore))
      .limit(limit);
  }

  /**
   * Mark a nudge as viewed
   */
  async markNudgeViewed(nudgeId: string): Promise<void> {
    await db.update(perCaseworkerNudges)
      .set({
        nudgeStatus: 'viewed',
        viewedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(perCaseworkerNudges.id, nudgeId));
  }

  /**
   * Record action taken on a nudge
   */
  async recordNudgeAction(
    nudgeId: string,
    action: string,
    outcome?: {
      type: 'error_prevented' | 'error_found' | 'false_positive' | 'no_action_needed';
      actualErrorAmount?: number;
    },
    feedback?: {
      rating: number; // 1-5
      comment?: string;
    }
  ): Promise<PerCaseworkerNudge | null> {
    const updateData: any = {
      nudgeStatus: 'acted_upon',
      actionTaken: action,
      actionTakenAt: new Date(),
      updatedAt: new Date()
    };

    if (outcome) {
      updateData.outcomeType = outcome.type;
      updateData.actualErrorAmount = outcome.actualErrorAmount;
    }

    if (feedback) {
      updateData.feedbackRating = feedback.rating;
      updateData.caseworkerFeedback = feedback.comment;
    }

    const [updated] = await db.update(perCaseworkerNudges)
      .set(updateData)
      .where(eq(perCaseworkerNudges.id, nudgeId))
      .returning();

    return updated || null;
  }

  /**
   * Get nudge effectiveness statistics
   */
  async getNudgeEffectivenessStats(
    stateCode: string = 'MD',
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalNudges: number;
    viewed: number;
    actedUpon: number;
    errorsPreventedCount: number;
    errorsFoundCount: number;
    falsePositiveCount: number;
    totalErrorsPreventedAmount: number;
    avgFeedbackRating: number;
    byNudgeType: Record<string, { count: number; effectiveness: number }>;
  }> {
    const conditions = [eq(perCaseworkerNudges.stateCode, stateCode)];
    
    if (startDate) {
      conditions.push(gte(perCaseworkerNudges.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(perCaseworkerNudges.createdAt, endDate));
    }

    const nudges = await db.select()
      .from(perCaseworkerNudges)
      .where(and(...conditions));

    const byNudgeType: Record<string, { count: number; effectiveness: number }> = {};
    let viewed = 0, actedUpon = 0;
    let errorsPrevented = 0, errorsFound = 0, falsePositives = 0;
    let totalPreventedAmount = 0;
    let totalRating = 0, ratingCount = 0;

    for (const nudge of nudges) {
      if (nudge.nudgeStatus === 'viewed' || nudge.nudgeStatus === 'acted_upon') viewed++;
      if (nudge.nudgeStatus === 'acted_upon') actedUpon++;

      switch (nudge.outcomeType) {
        case 'error_prevented':
          errorsPrevented++;
          totalPreventedAmount += nudge.actualErrorAmount || 0;
          break;
        case 'error_found':
          errorsFound++;
          break;
        case 'false_positive':
          falsePositives++;
          break;
      }

      if (nudge.feedbackRating) {
        totalRating += nudge.feedbackRating;
        ratingCount++;
      }

      // By type stats
      if (nudge.nudgeType) {
        if (!byNudgeType[nudge.nudgeType]) {
          byNudgeType[nudge.nudgeType] = { count: 0, effectiveness: 0 };
        }
        byNudgeType[nudge.nudgeType].count++;
        if (nudge.outcomeType === 'error_prevented' || nudge.outcomeType === 'error_found') {
          byNudgeType[nudge.nudgeType].effectiveness++;
        }
      }
    }

    // Calculate effectiveness percentages
    for (const type of Object.keys(byNudgeType)) {
      const typeData = byNudgeType[type];
      typeData.effectiveness = typeData.count > 0 
        ? (typeData.effectiveness / typeData.count) * 100 
        : 0;
    }

    return {
      totalNudges: nudges.length,
      viewed,
      actedUpon,
      errorsPreventedCount: errorsPrevented,
      errorsFoundCount: errorsFound,
      falsePositiveCount: falsePositives,
      totalErrorsPreventedAmount: totalPreventedAmount,
      avgFeedbackRating: ratingCount > 0 ? totalRating / ratingCount : 0,
      byNudgeType
    };
  }

  // ============================================================================
  // NUDGE CREATION METHODS
  // ============================================================================

  private async createIncomeDiscrepancyNudge(
    verification: any,
    caseId: string
  ): Promise<CaseworkerNudge> {
    const riskFactors: RiskFactor[] = [{
      factor: 'Income discrepancy detected',
      severity: verification.discrepancyPercent > 20 ? 'high' : 'medium',
      evidence: `Reported: $${verification.reportedGrossIncome}, Verified: $${verification.verifiedGrossIncome}`,
      source: verification.verifiedIncomeSource || 'wage_data'
    }];

    const riskScore = Math.min(100, 50 + (verification.discrepancyPercent || 0));
    const riskLevel = this.calculateRiskLevel(riskScore);

    // Generate plain language explanation
    const nudgeDescription = await this.generatePlainLanguageExplanation(
      'income_discrepancy',
      {
        reported: verification.reportedGrossIncome,
        verified: verification.verifiedGrossIncome,
        difference: verification.discrepancyAmount,
        type: verification.discrepancyType,
        source: verification.verifiedIncomeSource
      }
    );

    return {
      caseId,
      riskScore,
      riskLevel,
      riskFactors,
      nudgeTitle: `Income Verification Alert: $${verification.discrepancyAmount} Discrepancy`,
      nudgeDescription,
      primaryAction: 'Request updated income documentation from client',
      additionalActions: [
        'Compare reported employer with wage data employer',
        'Check if client changed jobs recently',
        'Review all income sources in application'
      ],
      documentationToReview: ['Pay stubs', 'W-2 forms', 'Employer verification'],
      questionsToAsk: [
        'Has your employment changed recently?',
        'Do you have additional sources of income?',
        'Are you working multiple jobs?'
      ],
      dataSourcesUsed: ['state_wage_db', 'application_data'],
      evidenceSummary: {
        reportedIncome: verification.reportedGrossIncome,
        verifiedIncome: verification.verifiedGrossIncome,
        discrepancy: verification.discrepancyAmount,
        source: verification.verifiedIncomeSource
      },
      confidenceScore: 0.85,
      reasoningTrace: `Detected ${verification.discrepancyType} of $${verification.discrepancyAmount} (${verification.discrepancyPercent?.toFixed(1)}%) between reported and verified income.`,
      nudgeType: 'income_discrepancy'
    };
  }

  private async createConsistencyNudge(
    check: any,
    caseId: string
  ): Promise<CaseworkerNudge> {
    const riskFactors: RiskFactor[] = [{
      factor: check.checkName,
      severity: check.riskLevel || 'medium',
      evidence: check.discrepancyDetails || 'Consistency check failed',
      source: 'application_validation'
    }];

    const nudgeDescription = await this.generatePlainLanguageExplanation(
      'consistency_check',
      {
        checkName: check.checkName,
        expected: check.expectedValue,
        actual: check.actualValue,
        details: check.discrepancyDetails
      }
    );

    return {
      caseId,
      riskScore: check.riskScore || 60,
      riskLevel: check.riskLevel || 'medium',
      riskFactors,
      nudgeTitle: `Data Consistency Issue: ${check.checkName}`,
      nudgeDescription,
      primaryAction: check.recommendedAction || 'Review and correct application data',
      additionalActions: [
        'Verify all related fields',
        'Request clarification from client if needed'
      ],
      documentationToReview: check.documentationNeeded || [],
      questionsToAsk: [
        'Can you confirm the information you provided?',
        'Has anything changed since you submitted your application?'
      ],
      dataSourcesUsed: ['application_data'],
      evidenceSummary: {
        checkType: check.checkType,
        expected: check.expectedValue,
        actual: check.actualValue,
        details: check.discrepancyDetails
      },
      confidenceScore: 0.9,
      reasoningTrace: `Pre-submission validation detected: ${check.discrepancyDetails}`,
      nudgeType: check.checkType === 'documentation_complete' ? 'documentation_gap' : 'pattern_alert'
    };
  }

  private async createDuplicateClaimNudge(
    duplicate: any,
    caseId: string
  ): Promise<CaseworkerNudge> {
    const riskFactors: RiskFactor[] = [{
      factor: 'Potential duplicate claim',
      severity: duplicate.isPotentialFraud ? 'critical' : 'high',
      evidence: `${duplicate.personFirstName} ${duplicate.personLastName} may be claimed on another case`,
      source: 'duplicate_detection'
    }];

    const riskScore = duplicate.isPotentialFraud ? 95 : 75;
    const riskLevel = this.calculateRiskLevel(riskScore);

    const nudgeDescription = await this.generatePlainLanguageExplanation(
      'duplicate_claim',
      {
        personName: `${duplicate.personFirstName} ${duplicate.personLastName}`,
        matchType: duplicate.matchType,
        duplicateType: duplicate.duplicateType,
        confidence: duplicate.matchConfidence
      }
    );

    return {
      caseId,
      riskScore,
      riskLevel,
      riskFactors,
      nudgeTitle: `Duplicate Claim Alert: ${duplicate.personFirstName} ${duplicate.personLastName}`,
      nudgeDescription,
      primaryAction: 'Verify this individual is not already receiving benefits on another case',
      additionalActions: [
        'Check case history for this individual',
        'Contact other case worker if duplicate confirmed',
        duplicate.isPotentialFraud ? 'Consider referral for fraud investigation' : 'Document resolution'
      ],
      documentationToReview: ['ID verification', 'Proof of residence', 'Household composition'],
      questionsToAsk: [
        'Is this person currently receiving SNAP benefits elsewhere?',
        'Have they recently moved from another household?',
        'Can you provide additional identification?'
      ],
      dataSourcesUsed: ['case_database', 'duplicate_detection'],
      evidenceSummary: {
        person: `${duplicate.personFirstName} ${duplicate.personLastName}`,
        matchType: duplicate.matchType,
        matchConfidence: duplicate.matchConfidence,
        duplicateType: duplicate.duplicateType
      },
      confidenceScore: duplicate.matchConfidence,
      reasoningTrace: `Detected ${duplicate.matchType} match for ${duplicate.duplicateType}. Match confidence: ${(duplicate.matchConfidence * 100).toFixed(0)}%.`,
      nudgeType: 'duplicate_claim'
    };
  }

  private async checkForPatternAlerts(caseId: string): Promise<CaseworkerNudge | null> {
    // Placeholder for pattern-based alerts
    // Would analyze case history for unusual patterns
    return null;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async generatePlainLanguageExplanation(
    type: string,
    data: Record<string, any>
  ): Promise<string> {
    if (!gemini) {
      return this.generateFallbackExplanation(type, data);
    }

    try {
      const prompt = `
        Generate a clear, plain-language explanation for a caseworker about the following ${type} issue:
        
        ${JSON.stringify(data, null, 2)}
        
        Requirements:
        1. Use simple, non-technical language
        2. Explain what was found and why it matters
        3. Be concise (2-3 sentences max)
        4. Focus on actionable information
        
        Example for income discrepancy:
        "The income reported on this application ($X) doesn't match what we found in state wage records ($Y). This $Z difference could affect the benefit amount. Please verify the client's current income before approving."
      `;

      const response = await gemini.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      return response.text || this.generateFallbackExplanation(type, data);
    } catch (error) {
      logger.error('AI explanation generation failed', {
        service: 'ExplainableNudgeService',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return this.generateFallbackExplanation(type, data);
    }
  }

  private generateFallbackExplanation(type: string, data: Record<string, any>): string {
    switch (type) {
      case 'income_discrepancy':
        return `The reported income ($${data.reported}) differs from verified records ($${data.verified}) by $${data.difference}. This ${data.type} could affect benefit calculations. Please verify income documentation.`;
      
      case 'consistency_check':
        return `A data inconsistency was found: ${data.details}. Expected "${data.expected}" but found "${data.actual}". Please review and correct before approval.`;
      
      case 'duplicate_claim':
        return `${data.personName} may already be receiving benefits on another case (${data.matchType} match with ${(data.confidence * 100).toFixed(0)}% confidence). Please verify this person's eligibility before proceeding.`;
      
      default:
        return 'An issue was detected that requires caseworker review. Please verify the flagged information before proceeding.';
    }
  }

  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private async storeNudge(
    nudge: CaseworkerNudge,
    stateCode: string,
    tenantId?: string
  ): Promise<void> {
    const nudgeRecord: InsertPerCaseworkerNudge = {
      caseId: nudge.caseId,
      caseworkerId: nudge.caseworkerId,
      riskScore: nudge.riskScore,
      riskLevel: nudge.riskLevel,
      riskFactors: nudge.riskFactors.map(f => f.factor),
      nudgeTitle: nudge.nudgeTitle,
      nudgeDescription: nudge.nudgeDescription,
      primaryAction: nudge.primaryAction,
      additionalActions: nudge.additionalActions,
      documentationToReview: nudge.documentationToReview,
      questionsToAsk: nudge.questionsToAsk,
      dataSourcesUsed: nudge.dataSourcesUsed,
      evidenceSummary: nudge.evidenceSummary,
      confidenceScore: nudge.confidenceScore,
      reasoningTrace: nudge.reasoningTrace,
      nudgeType: nudge.nudgeType,
      stateCode,
      tenantId
    };

    await db.insert(perCaseworkerNudges).values(nudgeRecord);
  }
}

export const explainableNudgeService = new ExplainableNudgeService();
