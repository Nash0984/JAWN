import { db } from "../db";
import { eq, and, lte, gte, isNull, desc, or } from "drizzle-orm";
import {
  tanfIncomeLimits,
  tanfAssetLimits,
  tanfWorkRequirements,
  tanfTimeLimits,
  type TanfIncomeLimit,
  type TanfAssetLimit,
  type TanfWorkRequirement,
  type TanfTimeLimit,
} from "../../shared/schema";
import { neuroSymbolicHybridGateway } from "./neuroSymbolicHybridGateway";
import { logger } from "./logger.service";

// ============================================================================
// Maryland TANF (TCA) Rules Engine - Temporary Cash Assistance
// ============================================================================

export interface TANFHouseholdInput {
  size: number;
  countableMonthlyIncome: number; // in cents - after exemptions
  liquidAssets: number; // in cents - checking, savings, cash
  vehicleValue?: number; // in cents
  hasEarnedIncome: boolean;
  householdType: "single_parent" | "two_parent";
  // Work requirement tracking
  isWorkExempt?: boolean;
  exemptionReason?: string; // disabled, caring_for_infant, etc
  currentWorkHours?: number; // Hours per week
  // Time limit tracking
  monthsReceived?: number; // Lifetime months of TANF
  continuousMonthsReceived?: number; // Current consecutive months
  hasHardshipExemption?: boolean;
}

export interface TANFHybridVerificationContext {
  z3SolverRunId?: string;
  neuralConfidence?: number;
  ontologyTermsMatched?: string[];
  unsatCore?: string[];
  statutoryCitations?: string[];
  verificationStatus?: 'verified' | 'unverified' | 'conflict' | 'error';
  grade6Explanation?: string;
  auditLogId?: string;
}

export interface TANFEligibilityResult {
  isEligible: boolean;
  reason?: string;
  ineligibilityReasons?: string[];
  incomeTest: {
    passed: boolean;
    needsStandard: number; // Income limit in cents
    countableIncome: number; // Actual income in cents
  };
  assetTest: {
    passed: boolean;
    liquidAssetLimit: number;
    actualLiquidAssets: number;
    vehicleTestPassed: boolean;
  };
  workRequirements: {
    requirementsMet: boolean;
    requiredHours: number;
    actualHours?: number;
    isExempt: boolean;
    exemptionReason?: string;
  };
  timeLimits: {
    withinLimits: boolean;
    lifetimeMonthsUsed: number;
    lifetimeMonthsRemaining: number;
    continuousMonthsUsed: number;
    hasHardshipExemption: boolean;
  };
  monthlyBenefit: number; // in cents
  calculationBreakdown: string[];
  rulesSnapshot: {
    incomeLimitId: string;
    assetLimitIds: string[];
    workRequirementId?: string;
    timeLimitId?: string;
  };
  policyCitations: Array<{
    sectionNumber: string;
    sectionTitle: string;
    ruleType: string;
    description: string;
  }>;
  hybridVerification?: TANFHybridVerificationContext;
}

class TANFRulesEngine {
  /**
   * Get active TANF income limits (needs standard)
   */
  private async getActiveIncomeLimits(
    householdSize: number,
    effectiveDate: Date = new Date()
  ): Promise<TanfIncomeLimit | null> {
    const limits = await db
      .select()
      .from(tanfIncomeLimits)
      .where(
        and(
          eq(tanfIncomeLimits.householdSize, householdSize),
          eq(tanfIncomeLimits.isActive, true),
          lte(tanfIncomeLimits.effectiveDate, effectiveDate),
          or(
            isNull(tanfIncomeLimits.endDate),
            gte(tanfIncomeLimits.endDate, effectiveDate)
          )
        )
      )
      .orderBy(desc(tanfIncomeLimits.effectiveDate))
      .limit(1);

    return limits[0] || null;
  }

  /**
   * Get active asset limits
   */
  private async getActiveAssetLimits(
    effectiveDate: Date = new Date()
  ): Promise<TanfAssetLimit[]> {
    return await db
      .select()
      .from(tanfAssetLimits)
      .where(
        and(
          eq(tanfAssetLimits.isActive, true),
          lte(tanfAssetLimits.effectiveDate, effectiveDate),
          or(
            isNull(tanfAssetLimits.endDate),
            gte(tanfAssetLimits.endDate, effectiveDate)
          )
        )
      )
      .orderBy(desc(tanfAssetLimits.effectiveDate));
  }

  /**
   * Get active work requirements
   */
  private async getActiveWorkRequirements(
    householdType: string,
    effectiveDate: Date = new Date()
  ): Promise<TanfWorkRequirement | null> {
    const requirements = await db
      .select()
      .from(tanfWorkRequirements)
      .where(
        and(
          eq(tanfWorkRequirements.householdType, householdType),
          eq(tanfWorkRequirements.isActive, true),
          lte(tanfWorkRequirements.effectiveDate, effectiveDate),
          or(
            isNull(tanfWorkRequirements.endDate),
            gte(tanfWorkRequirements.endDate, effectiveDate)
          )
        )
      )
      .orderBy(desc(tanfWorkRequirements.effectiveDate))
      .limit(1);

    return requirements[0] || null;
  }

  /**
   * Get active time limits
   */
  private async getActiveTimeLimits(
    effectiveDate: Date = new Date()
  ): Promise<TanfTimeLimit[]> {
    return await db
      .select()
      .from(tanfTimeLimits)
      .where(
        and(
          eq(tanfTimeLimits.isActive, true),
          lte(tanfTimeLimits.effectiveDate, effectiveDate),
          or(
            isNull(tanfTimeLimits.endDate),
            gte(tanfTimeLimits.endDate, effectiveDate)
          )
        )
      )
      .orderBy(desc(tanfTimeLimits.effectiveDate));
  }

  /**
   * Calculate TANF benefit amount
   * TANF benefit = Payment Standard - Countable Income
   */
  private calculateBenefit(
    paymentStandard: number,
    countableIncome: number
  ): number {
    const benefit = paymentStandard - countableIncome;
    return Math.max(0, benefit); // Benefit cannot be negative
  }

  /**
   * Main TANF eligibility calculation
   */
  async calculateEligibility(
    household: TANFHouseholdInput,
    effectiveDate: Date = new Date(),
    benefitProgramId?: string
  ): Promise<TANFEligibilityResult> {
    const breakdown: string[] = [];
    const ineligibilityReasons: string[] = [];

    breakdown.push(
      `TANF Eligibility Calculation for ${household.householdType} household, size ${household.size}`
    );
    breakdown.push(
      `Countable Monthly Income: $${(household.countableMonthlyIncome / 100).toFixed(2)}`
    );

    // Step 1: Get income limits (needs standard)
    const incomeLimit = await this.getActiveIncomeLimits(
      household.size,
      effectiveDate
    );

    if (!incomeLimit) {
      return {
        isEligible: false,
        reason: `No income limits found for household size ${household.size}`,
        ineligibilityReasons: [
          `No TANF income limits configured for household size ${household.size}`,
        ],
        incomeTest: {
          passed: false,
          needsStandard: 0,
          countableIncome: household.countableMonthlyIncome,
        },
        assetTest: {
          passed: false,
          liquidAssetLimit: 0,
          actualLiquidAssets: household.liquidAssets,
          vehicleTestPassed: false,
        },
        workRequirements: {
          requirementsMet: false,
          requiredHours: 0,
          isExempt: household.isWorkExempt || false,
          exemptionReason: household.exemptionReason,
        },
        timeLimits: {
          withinLimits: false,
          lifetimeMonthsUsed: household.monthsReceived || 0,
          lifetimeMonthsRemaining: 0,
          continuousMonthsUsed: household.continuousMonthsReceived || 0,
          hasHardshipExemption: household.hasHardshipExemption || false,
        },
        monthlyBenefit: 0,
        calculationBreakdown: breakdown,
        rulesSnapshot: {
          incomeLimitId: "",
          assetLimitIds: [],
        },
        policyCitations: [],
      };
    }

    breakdown.push(
      `TANF Needs Standard (Income Limit): $${(incomeLimit.needsStandard / 100).toFixed(2)}/month`
    );
    breakdown.push(
      `TANF Payment Standard (Max Benefit): $${(incomeLimit.paymentStandard / 100).toFixed(2)}/month`
    );

    // Step 2: Income test
    const incomeTestPassed =
      household.countableMonthlyIncome <= incomeLimit.needsStandard;

    if (!incomeTestPassed) {
      ineligibilityReasons.push(
        `Countable income $${(household.countableMonthlyIncome / 100).toFixed(2)} exceeds needs standard $${(
          incomeLimit.needsStandard / 100
        ).toFixed(2)}`
      );
      breakdown.push(`✗ Income test FAILED`);
    } else {
      breakdown.push(`✓ Income test PASSED`);
    }

    // Step 3: Asset test
    const assetLimits = await this.getActiveAssetLimits(effectiveDate);
    const liquidAssetLimit = assetLimits.find((a) => a.assetType === "liquid");
    const vehicleAssetLimit = assetLimits.find((a) => a.assetType === "vehicle");

    let assetTestPassed = true;
    let vehicleTestPassed = true;

    if (liquidAssetLimit) {
      assetTestPassed =
        household.liquidAssets <= liquidAssetLimit.maxAssetValue;
      breakdown.push(
        `Liquid Asset Limit: $${(liquidAssetLimit.maxAssetValue / 100).toFixed(2)}`
      );
      breakdown.push(
        `Actual Liquid Assets: $${(household.liquidAssets / 100).toFixed(2)}`
      );

      if (!assetTestPassed) {
        ineligibilityReasons.push(
          `Liquid assets $${(household.liquidAssets / 100).toFixed(2)} exceed limit $${(
            liquidAssetLimit.maxAssetValue / 100
          ).toFixed(2)}`
        );
        breakdown.push(`✗ Asset test FAILED`);
      } else {
        breakdown.push(`✓ Asset test PASSED`);
      }
    }

    if (vehicleAssetLimit && household.vehicleValue) {
      vehicleTestPassed =
        household.vehicleValue <= vehicleAssetLimit.maxAssetValue;
      if (!vehicleTestPassed) {
        assetTestPassed = false;
        ineligibilityReasons.push(
          `Vehicle value exceeds limit`
        );
        breakdown.push(`✗ Vehicle asset test FAILED`);
      } else {
        breakdown.push(`✓ Vehicle asset test PASSED`);
      }
    }

    // Step 4: Work requirements
    const workReqs = await this.getActiveWorkRequirements(
      household.householdType,
      effectiveDate
    );

    let workRequirementsMet = true;
    let requiredHours = 0;

    if (workReqs) {
      requiredHours = workReqs.requiredHoursPerWeek;

      if (household.isWorkExempt) {
        breakdown.push(
          `Work requirement EXEMPT: ${household.exemptionReason || "unknown reason"}`
        );
        workRequirementsMet = true;
      } else {
        const actualHours = household.currentWorkHours || 0;
        workRequirementsMet = actualHours >= requiredHours;

        breakdown.push(
          `Work Requirement: ${requiredHours} hours/week`
        );
        breakdown.push(`Actual Work Hours: ${actualHours} hours/week`);

        if (!workRequirementsMet) {
          ineligibilityReasons.push(
            `Work hours ${actualHours}/week below required ${requiredHours}/week`
          );
          breakdown.push(`✗ Work requirement NOT MET (sanctions may apply)`);
        } else {
          breakdown.push(`✓ Work requirement MET`);
        }
      }
    }

    // Step 5: Time limits
    const timeLimits = await this.getActiveTimeLimits(effectiveDate);
    const lifetimeLimit = timeLimits.find((t) => t.limitType === "lifetime");
    const continuousLimit = timeLimits.find((t) => t.limitType === "continuous");

    const lifetimeMonthsUsed = household.monthsReceived || 0;
    const continuousMonthsUsed = household.continuousMonthsReceived || 0;

    let timeLimitsOk = true;

    if (lifetimeLimit && !household.hasHardshipExemption) {
      const lifetimeMonthsRemaining = lifetimeLimit.maxMonths - lifetimeMonthsUsed;
      breakdown.push(
        `Lifetime Limit: ${lifetimeLimit.maxMonths} months (${lifetimeMonthsRemaining} remaining)`
      );

      if (lifetimeMonthsRemaining <= 0) {
        timeLimitsOk = false;
        ineligibilityReasons.push(
          `Lifetime time limit reached (${lifetimeLimit.maxMonths} months)`
        );
        breakdown.push(`✗ Lifetime time limit EXCEEDED`);
      } else {
        breakdown.push(`✓ Within lifetime time limit`);
      }
    }

    if (household.hasHardshipExemption) {
      breakdown.push(`Time limit EXEMPT: Hardship exemption granted`);
      timeLimitsOk = true;
    }

    // Step 6: Calculate benefit
    let monthlyBenefit = 0;
    if (incomeTestPassed && assetTestPassed && timeLimitsOk) {
      monthlyBenefit = this.calculateBenefit(
        incomeLimit.paymentStandard,
        household.countableMonthlyIncome
      );
      breakdown.push(
        `Monthly Benefit: $${(incomeLimit.paymentStandard / 100).toFixed(2)} - $${(
          household.countableMonthlyIncome / 100
        ).toFixed(2)} = $${(monthlyBenefit / 100).toFixed(2)}`
      );
    }

    const isEligible =
      incomeTestPassed && assetTestPassed && timeLimitsOk;

    return {
      isEligible,
      reason: isEligible
        ? `Eligible for TANF with monthly benefit of $${(monthlyBenefit / 100).toFixed(2)}`
        : ineligibilityReasons[0],
      ineligibilityReasons: isEligible ? undefined : ineligibilityReasons,
      incomeTest: {
        passed: incomeTestPassed,
        needsStandard: incomeLimit.needsStandard,
        countableIncome: household.countableMonthlyIncome,
      },
      assetTest: {
        passed: assetTestPassed,
        liquidAssetLimit: liquidAssetLimit?.maxAssetValue || 0,
        actualLiquidAssets: household.liquidAssets,
        vehicleTestPassed,
      },
      workRequirements: {
        requirementsMet: workRequirementsMet,
        requiredHours,
        actualHours: household.currentWorkHours,
        isExempt: household.isWorkExempt || false,
        exemptionReason: household.exemptionReason,
      },
      timeLimits: {
        withinLimits: timeLimitsOk,
        lifetimeMonthsUsed,
        lifetimeMonthsRemaining: lifetimeLimit
          ? lifetimeLimit.maxMonths - lifetimeMonthsUsed
          : 0,
        continuousMonthsUsed,
        hasHardshipExemption: household.hasHardshipExemption || false,
      },
      monthlyBenefit,
      calculationBreakdown: breakdown,
      rulesSnapshot: {
        incomeLimitId: incomeLimit.id,
        assetLimitIds: assetLimits.map((a) => a.id),
        workRequirementId: workReqs?.id,
        timeLimitId: lifetimeLimit?.id,
      },
      policyCitations: [
        {
          sectionNumber: "TCA-100",
          sectionTitle: "TANF Income Eligibility",
          ruleType: "income",
          description: `Countable income must not exceed needs standard of $${(
            incomeLimit.needsStandard / 100
          ).toFixed(2)}/month`,
        },
        {
          sectionNumber: "TCA-200",
          sectionTitle: "TANF Asset Limits",
          ruleType: "asset",
          description: `Liquid assets must not exceed $${(
            (liquidAssetLimit?.maxAssetValue || 0) / 100
          ).toFixed(2)}`,
        },
        {
          sectionNumber: "TCA-300",
          sectionTitle: "TANF Work Requirements",
          ruleType: "work",
          description: `${household.householdType} must work ${requiredHours} hours/week unless exempt`,
        },
      ],
    };
  }

  /**
   * Calculate TANF eligibility with neuro-symbolic hybrid verification
   * Wraps calculateEligibility with Gateway verification for formal rule checking
   */
  async calculateEligibilityWithHybridVerification(
    household: TANFHouseholdInput,
    stateCode: string = 'MD',
    caseId?: string,
    effectiveDate: Date = new Date()
  ): Promise<TANFEligibilityResult> {
    const result = await this.calculateEligibility(household, effectiveDate);
    const effectiveCaseId = caseId || `tanf-eligibility-${Date.now()}`;
    
    try {
      const hybridResult = await neuroSymbolicHybridGateway.verifyEligibility(
        effectiveCaseId,
        stateCode,
        'TANF',
        {
          householdSize: household.size,
          grossMonthlyIncome: household.countableMonthlyIncome / 100,
          countableResources: household.liquidAssets / 100,
          earnedIncome: household.hasEarnedIncome ? household.countableMonthlyIncome / 100 : 0,
        },
        { triggeredBy: 'tanfRulesEngine.calculateEligibilityWithHybridVerification' }
      );

      const ontologyTerms = hybridResult.rulesAsCodeContext?.ontologyTermsMatched || [];
      const formalRules = hybridResult.rulesAsCodeContext?.formalRulesUsed || [];
      const statutoryCitations = formalRules
        .map(r => r.statutoryCitation)
        .filter((c): c is string => Boolean(c));

      result.hybridVerification = {
        z3SolverRunId: hybridResult.symbolicLayer.solverRunId,
        neuralConfidence: hybridResult.neuralLayer.averageConfidence,
        ontologyTermsMatched: ontologyTerms.map(t => t.termName),
        unsatCore: hybridResult.symbolicLayer.unsatCore,
        statutoryCitations: statutoryCitations,
        verificationStatus: hybridResult.symbolicLayer.isSatisfied ? 'verified' : 
                           hybridResult.decision.determination === 'error' ? 'error' : 'conflict',
        grade6Explanation: undefined,
        auditLogId: hybridResult.gatewayRunId
      };

      if (hybridResult.symbolicLayer.isSatisfied) {
        result.calculationBreakdown.push(
          `✓ Z3 symbolic verification passed (Run ID: ${hybridResult.symbolicLayer.solverRunId})`
        );
      } else {
        result.calculationBreakdown.push(
          `⚠ Z3 verification: ${hybridResult.decision.determination.toUpperCase()}`
        );
        result.calculationBreakdown.push(
          `  UNSAT core: ${hybridResult.symbolicLayer.unsatCore?.join(', ') || 'N/A'}`
        );
      }

      for (const citation of statutoryCitations) {
        result.policyCitations.push({
          sectionNumber: citation,
          sectionTitle: 'Z3 Verified',
          ruleType: 'formal_verification',
          description: `Formally verified via neuro-symbolic hybrid gateway`
        });
      }
    } catch (error) {
      logger.warn("[TANFRulesEngine] Gateway verification failed, continuing with rules engine result", {
        error: error instanceof Error ? error.message : "Unknown error",
        caseId: effectiveCaseId,
        service: "TANFRulesEngine"
      });
      result.hybridVerification = {
        verificationStatus: 'error',
        grade6Explanation: 'The system was unable to complete formal verification. Decision based on rules engine calculation.'
      };
    }

    return result;
  }
}

export const tanfRulesEngine = new TANFRulesEngine();
