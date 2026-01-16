import { db } from '../db';
import { policyEngineVerifications } from '../../shared/schema';
import { sql, eq, desc } from 'drizzle-orm';
import { logger } from './logger.service';

export interface PolicyEngineGuardrailResult {
  verified: boolean;
  discrepancyDetected: boolean;
  discrepancyType?: 'eligibility_mismatch' | 'benefit_amount_variance' | 'threshold_violation';
  discrepancySeverity?: 'low' | 'medium' | 'high' | 'critical';
  racResult: unknown;
  policyEngineResult?: unknown;
  recommendation: string;
  auditTrail: {
    timestamp: Date;
    racVersion: string;
    policyEngineVersion?: string;
    inputHash: string;
  };
}

export interface EligibilityDecision {
  programId: string;
  eligible: boolean;
  benefitAmount?: number;
  reasonCodes: string[];
  legalCitations: string[];
  calculationMethod: string;
}

export class PolicyEngineGuardrailService {
  private static instance: PolicyEngineGuardrailService;
  
  static getInstance(): PolicyEngineGuardrailService {
    if (!PolicyEngineGuardrailService.instance) {
      PolicyEngineGuardrailService.instance = new PolicyEngineGuardrailService();
    }
    return PolicyEngineGuardrailService.instance;
  }

  async crossValidate(
    programId: string,
    householdData: unknown,
    racDecision: EligibilityDecision,
    policyEngineResult?: unknown
  ): Promise<PolicyEngineGuardrailResult> {
    const inputHash = this.hashInput(householdData);
    const timestamp = new Date();
    
    const result: PolicyEngineGuardrailResult = {
      verified: true,
      discrepancyDetected: false,
      racResult: racDecision,
      policyEngineResult,
      recommendation: 'RaC/Z3 decision stands as authoritative.',
      auditTrail: {
        timestamp,
        racVersion: '1.0.0',
        policyEngineVersion: policyEngineResult ? '2025.1' : undefined,
        inputHash,
      },
    };

    if (!policyEngineResult) {
      result.recommendation = 'PolicyEngine verification skipped. RaC/Z3 decision stands as authoritative.';
      await this.logVerification(programId, householdData, racDecision, null, result);
      return result;
    }

    const discrepancy = this.detectDiscrepancy(racDecision, policyEngineResult);
    
    if (discrepancy) {
      result.discrepancyDetected = true;
      result.discrepancyType = discrepancy.type;
      result.discrepancySeverity = discrepancy.severity;
      result.verified = discrepancy.severity !== 'critical';
      
      result.recommendation = this.generateRecommendation(discrepancy, racDecision);
      
      logger.warn('[PolicyEngineGuardrail] Discrepancy detected', {
        programId,
        discrepancyType: discrepancy.type,
        discrepancySeverity: discrepancy.severity,
        inputHash,
      });
    }

    await this.logVerification(programId, householdData, racDecision, policyEngineResult, result);
    
    return result;
  }

  private detectDiscrepancy(
    racDecision: EligibilityDecision,
    policyEngineResult: unknown
  ): { type: PolicyEngineGuardrailResult['discrepancyType']; severity: PolicyEngineGuardrailResult['discrepancySeverity'] } | null {
    const peResult = policyEngineResult as {
      eligible?: boolean;
      benefitAmount?: number;
      household?: {
        [key: string]: {
          value?: number;
          eligible?: boolean;
        };
      };
    };

    if (typeof peResult.eligible === 'boolean' && peResult.eligible !== racDecision.eligible) {
      return {
        type: 'eligibility_mismatch',
        severity: 'high',
      };
    }

    if (typeof peResult.benefitAmount === 'number' && racDecision.benefitAmount) {
      const variance = Math.abs(peResult.benefitAmount - racDecision.benefitAmount) / racDecision.benefitAmount;
      if (variance > 0.1) {
        return {
          type: 'benefit_amount_variance',
          severity: variance > 0.25 ? 'high' : 'medium',
        };
      }
    }

    return null;
  }

  private generateRecommendation(
    discrepancy: { type: PolicyEngineGuardrailResult['discrepancyType']; severity: PolicyEngineGuardrailResult['discrepancySeverity'] },
    racDecision: EligibilityDecision
  ): string {
    const messages = {
      eligibility_mismatch: 'Eligibility determination differs from PolicyEngine. RaC/Z3 decision prevails as it is based on formal statutory verification. Manual review recommended if discrepancy persists.',
      benefit_amount_variance: `Benefit amount differs from PolicyEngine by significant margin. RaC/Z3 calculation of ${racDecision.benefitAmount} cents prevails. Consider auditing calculation parameters.`,
      threshold_violation: 'Income/asset threshold calculation differs. RaC/Z3 statutory thresholds are authoritative.',
    };

    return messages[discrepancy.type as keyof typeof messages] || 'RaC/Z3 decision stands. Discrepancy logged for audit.';
  }

  private async logVerification(
    programId: string,
    inputData: unknown,
    racResult: EligibilityDecision,
    policyEngineResult: unknown,
    guardrailResult: PolicyEngineGuardrailResult
  ): Promise<void> {
    try {
      await db.insert(policyEngineVerifications).values({
        benefitProgramId: programId,
        verificationType: 'eligibility_check',
        inputData: inputData as object,
        ourResult: racResult,
        ourCalculationMethod: racResult.calculationMethod,
        policyEngineResult: policyEngineResult || null,
        policyEngineVersion: guardrailResult.auditTrail.policyEngineVersion || null,
        matchStatus: guardrailResult.discrepancyDetected ? 'mismatch' : 'match',
        discrepancyDetails: guardrailResult.discrepancyDetected ? {
          type: guardrailResult.discrepancyType,
          severity: guardrailResult.discrepancySeverity,
        } : null,
        verifiedAt: guardrailResult.auditTrail.timestamp,
      });
    } catch (error) {
      logger.error('[PolicyEngineGuardrail] Failed to log verification', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private hashInput(data: unknown): string {
    return Buffer.from(JSON.stringify(data)).toString('base64').substring(0, 32);
  }

  async getRecentDiscrepancies(limit = 20): Promise<any[]> {
    const results = await db
      .select()
      .from(policyEngineVerifications)
      .where(eq(policyEngineVerifications.matchStatus, 'mismatch'))
      .orderBy(desc(policyEngineVerifications.verifiedAt))
      .limit(limit);
    
    return results;
  }

  async getVerificationStats(): Promise<{
    totalVerifications: number;
    matchCount: number;
    mismatchCount: number;
    matchRate: number;
  }> {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE match_status = 'match') as matches,
        COUNT(*) FILTER (WHERE match_status = 'mismatch') as mismatches
      FROM policy_engine_verifications
    `);

    const row = stats.rows[0] as any || { total: 0, matches: 0, mismatches: 0 };
    const total = parseInt(row.total) || 0;
    const matches = parseInt(row.matches) || 0;
    const mismatches = parseInt(row.mismatches) || 0;

    return {
      totalVerifications: total,
      matchCount: matches,
      mismatchCount: mismatches,
      matchRate: total > 0 ? matches / total : 1,
    };
  }
}

export const policyEngineGuardrail = PolicyEngineGuardrailService.getInstance();
