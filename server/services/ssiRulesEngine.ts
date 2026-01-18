import { neuroSymbolicHybridGateway } from "./neuroSymbolicHybridGateway";
import { logger } from "./logger.service";

/**
 * SSI (Supplemental Security Income) Rules Engine
 * 
 * Implements federal SSI eligibility determination for:
 * - Aged (65 or older)
 * - Blind
 * - Disabled
 * 
 * with limited income and resources.
 * 
 * SSI is a FEDERAL program administered by the Social Security Administration.
 * States may provide optional supplemental payments.
 * 
 * Policy References:
 * - 42 U.S.C. § 1382 (SSI eligibility)
 * - 20 CFR Part 416 (SSI regulations)
 * - POMS SI 00501.001 (SSI eligibility requirements)
 */

export interface SSIHouseholdInput {
  age: number;
  isBlind: boolean;
  isDisabled: boolean;
  
  countableMonthlyIncome: number;
  earnedIncome: number;
  unearnedIncome: number;
  
  countableResources: number;
  
  maritalStatus: 'single' | 'married' | 'separated' | 'widowed';
  hasEligibleSpouse: boolean;
  spouseReceivesSSI: boolean;
  
  livingSituation: 'own_household' | 'another_household' | 'institution';
  
  isCitizen: boolean;
  meetsResidencyRequirements: boolean;
  
  stateCode?: string;
}

export interface SSIHybridVerificationContext {
  z3SolverRunId?: string;
  neuralConfidence?: number;
  ontologyTermsMatched?: string[];
  unsatCore?: string[];
  statutoryCitations?: string[];
  verificationStatus?: 'verified' | 'unverified' | 'conflict' | 'error';
  grade6Explanation?: string;
  auditLogId?: string;
}

export interface SSIEligibilityResult {
  isEligible: boolean;
  reason?: string;
  ineligibilityReasons?: string[];
  
  categoryTest: {
    passed: boolean;
    category: 'aged' | 'blind' | 'disabled' | 'none';
    details: string;
  };
  
  incomeTest: {
    passed: boolean;
    countableIncome: number;
    federalBenefitRate: number;
    earnedIncomeExclusion: number;
    unearnedIncomeExclusion: number;
  };
  
  resourceTest: {
    passed: boolean;
    countableResources: number;
    resourceLimit: number;
  };
  
  citizenshipTest: {
    passed: boolean;
    details: string;
  };
  
  monthlyBenefit: number;
  stateSupplementAmount: number;
  totalMonthlyBenefit: number;
  
  calculationBreakdown: string[];
  policyCitations: string[];
  hybridVerification?: SSIHybridVerificationContext;
}

const FBR_2024_INDIVIDUAL = 94300;
const FBR_2024_COUPLE = 141450;

const RESOURCE_LIMIT_INDIVIDUAL = 200000;
const RESOURCE_LIMIT_COUPLE = 300000;

const GENERAL_INCOME_EXCLUSION = 2000;
const EARNED_INCOME_EXCLUSION = 6500;

const MD_STATE_SUPPLEMENT_INDIVIDUAL = 0;
const MD_STATE_SUPPLEMENT_COUPLE = 0;

class SSIRulesEngine {
  
  /**
   * Calculate SSI eligibility with neuro-symbolic hybrid verification
   */
  async calculateEligibilityWithHybridVerification(
    input: SSIHouseholdInput,
    stateCode: string = 'MD',
    caseId: string
  ): Promise<SSIEligibilityResult> {
    const result = await this.calculateEligibility(input);
    
    try {
      const hybridResult = await neuroSymbolicHybridGateway.verifyEligibility(
        caseId,
        stateCode,
        'SSI',
        {
          age: input.age,
          isBlind: input.isBlind,
          isDisabled: input.isDisabled,
          countableMonthlyIncome: input.countableMonthlyIncome,
          countableResources: input.countableResources,
          isCitizen: input.isCitizen,
        },
        { triggeredBy: 'ssiRulesEngine.calculateEligibilityWithHybridVerification' }
      );
      
      result.hybridVerification = {
        z3SolverRunId: hybridResult.symbolicLayer.solverRunId,
        ontologyTermsMatched: hybridResult.rulesContext.ontologyTermsMatched.map(t => t.termLabel),
        statutoryCitations: hybridResult.rulesContext.statutoryCitations,
        verificationStatus: hybridResult.symbolicLayer.isSatisfied ? 'verified' : 'conflict',
        grade6Explanation: hybridResult.grade6Explanation,
        auditLogId: hybridResult.auditLogId
      };
      
      logger.info('[SSIRulesEngine] Hybrid verification completed', {
        caseId,
        isEligible: result.isEligible,
        verificationStatus: result.hybridVerification.verificationStatus,
        service: 'SSIRulesEngine'
      });
    } catch (hybridError) {
      logger.warn('[SSIRulesEngine] Hybrid verification failed', {
        caseId,
        error: hybridError instanceof Error ? hybridError.message : 'Unknown',
        service: 'SSIRulesEngine'
      });
      result.hybridVerification = {
        verificationStatus: 'error',
        grade6Explanation: 'Formal verification was not available. Eligibility calculated using rules only.'
      };
    }
    
    return result;
  }
  
  /**
   * Calculate SSI eligibility
   */
  async calculateEligibility(input: SSIHouseholdInput): Promise<SSIEligibilityResult> {
    const breakdown: string[] = [];
    const ineligibilityReasons: string[] = [];
    const policyCitations: string[] = [
      '42 U.S.C. § 1382 - SSI Eligibility',
      '20 CFR § 416.110 - Purpose of Program',
      '20 CFR § 416.202 - Requirements for Eligibility'
    ];
    
    const isCouple = input.maritalStatus === 'married' && input.hasEligibleSpouse;
    
    const categoryTest = this.evaluateCategoryTest(input);
    breakdown.push(`Category Test: ${categoryTest.passed ? 'PASSED' : 'FAILED'} - ${categoryTest.details}`);
    if (!categoryTest.passed) {
      ineligibilityReasons.push(`Not in eligible category (aged, blind, or disabled)`);
    }
    
    const citizenshipTest = this.evaluateCitizenshipTest(input);
    breakdown.push(`Citizenship Test: ${citizenshipTest.passed ? 'PASSED' : 'FAILED'} - ${citizenshipTest.details}`);
    if (!citizenshipTest.passed) {
      ineligibilityReasons.push(`Does not meet citizenship or residency requirements`);
    }
    
    const resourceLimit = isCouple ? RESOURCE_LIMIT_COUPLE : RESOURCE_LIMIT_INDIVIDUAL;
    const resourceTest = {
      passed: input.countableResources <= resourceLimit,
      countableResources: input.countableResources,
      resourceLimit
    };
    breakdown.push(`Resource Test: ${resourceTest.passed ? 'PASSED' : 'FAILED'} - Resources: $${(input.countableResources / 100).toFixed(2)}, Limit: $${(resourceLimit / 100).toFixed(2)}`);
    if (!resourceTest.passed) {
      ineligibilityReasons.push(`Resources exceed limit of $${(resourceLimit / 100).toFixed(2)}`);
      policyCitations.push('20 CFR § 416.1205 - Resource Exclusions');
    }
    
    const federalBenefitRate = isCouple ? FBR_2024_COUPLE : FBR_2024_INDIVIDUAL;
    
    const unearnedIncomeAfterExclusion = Math.max(0, input.unearnedIncome - GENERAL_INCOME_EXCLUSION);
    
    let remainingGeneralExclusion = Math.max(0, GENERAL_INCOME_EXCLUSION - input.unearnedIncome);
    const earnedIncomeAfterGeneralExclusion = Math.max(0, input.earnedIncome - remainingGeneralExclusion);
    const earnedIncomeAfterEarnedExclusion = Math.max(0, earnedIncomeAfterGeneralExclusion - EARNED_INCOME_EXCLUSION);
    const earnedIncomeCountable = Math.floor(earnedIncomeAfterEarnedExclusion / 2);
    
    const totalCountableIncome = unearnedIncomeAfterExclusion + earnedIncomeCountable;
    
    const incomeTest = {
      passed: totalCountableIncome < federalBenefitRate,
      countableIncome: totalCountableIncome,
      federalBenefitRate,
      earnedIncomeExclusion: EARNED_INCOME_EXCLUSION + Math.floor(earnedIncomeAfterEarnedExclusion / 2),
      unearnedIncomeExclusion: GENERAL_INCOME_EXCLUSION
    };
    breakdown.push(`Income Test: ${incomeTest.passed ? 'PASSED' : 'FAILED'} - Countable Income: $${(totalCountableIncome / 100).toFixed(2)}, FBR: $${(federalBenefitRate / 100).toFixed(2)}`);
    breakdown.push(`  - Earned Income: $${(input.earnedIncome / 100).toFixed(2)} → Countable: $${(earnedIncomeCountable / 100).toFixed(2)} (after $20 + $65 + 1/2 exclusion)`);
    breakdown.push(`  - Unearned Income: $${(input.unearnedIncome / 100).toFixed(2)} → Countable: $${(unearnedIncomeAfterExclusion / 100).toFixed(2)} (after $20 exclusion)`);
    if (!incomeTest.passed) {
      ineligibilityReasons.push(`Countable income exceeds Federal Benefit Rate of $${(federalBenefitRate / 100).toFixed(2)}`);
      policyCitations.push('20 CFR § 416.1100 - Income');
    }
    
    const isEligible = categoryTest.passed && citizenshipTest.passed && resourceTest.passed && incomeTest.passed;
    
    let monthlyBenefit = 0;
    let stateSupplementAmount = 0;
    
    if (isEligible) {
      monthlyBenefit = Math.max(0, federalBenefitRate - totalCountableIncome);
      stateSupplementAmount = isCouple ? MD_STATE_SUPPLEMENT_COUPLE : MD_STATE_SUPPLEMENT_INDIVIDUAL;
      
      if (input.livingSituation === 'another_household') {
        monthlyBenefit = Math.floor(monthlyBenefit * 2 / 3);
        breakdown.push(`Living Arrangement Reduction: Benefit reduced by 1/3 for living in another's household`);
        policyCitations.push('20 CFR § 416.1131 - Value of One-Third Reduction');
      }
      
      breakdown.push(`Monthly SSI Benefit: $${(monthlyBenefit / 100).toFixed(2)} (FBR - Countable Income)`);
      if (stateSupplementAmount > 0) {
        breakdown.push(`State Supplement: $${(stateSupplementAmount / 100).toFixed(2)}`);
      }
    }
    
    const totalMonthlyBenefit = monthlyBenefit + stateSupplementAmount;
    
    return {
      isEligible,
      reason: isEligible 
        ? `Eligible for SSI as ${categoryTest.category} individual with limited income and resources`
        : ineligibilityReasons.join('; '),
      ineligibilityReasons: isEligible ? undefined : ineligibilityReasons,
      categoryTest,
      incomeTest,
      resourceTest,
      citizenshipTest,
      monthlyBenefit,
      stateSupplementAmount,
      totalMonthlyBenefit,
      calculationBreakdown: breakdown,
      policyCitations
    };
  }
  
  /**
   * Evaluate category test (aged, blind, or disabled)
   */
  private evaluateCategoryTest(input: SSIHouseholdInput): {
    passed: boolean;
    category: 'aged' | 'blind' | 'disabled' | 'none';
    details: string;
  } {
    if (input.age >= 65) {
      return {
        passed: true,
        category: 'aged',
        details: `Age ${input.age} meets aged category (65+)`
      };
    }
    
    if (input.isBlind) {
      return {
        passed: true,
        category: 'blind',
        details: 'Meets blindness criteria per SSA definition'
      };
    }
    
    if (input.isDisabled) {
      return {
        passed: true,
        category: 'disabled',
        details: 'Meets disability criteria per SSA definition (unable to engage in SGA)'
      };
    }
    
    return {
      passed: false,
      category: 'none',
      details: 'Does not meet aged (65+), blind, or disabled category requirements'
    };
  }
  
  /**
   * Evaluate citizenship and residency test
   */
  private evaluateCitizenshipTest(input: SSIHouseholdInput): {
    passed: boolean;
    details: string;
  } {
    if (!input.isCitizen && !input.meetsResidencyRequirements) {
      return {
        passed: false,
        details: 'Must be a U.S. citizen or qualifying non-citizen with valid residency status'
      };
    }
    
    if (!input.meetsResidencyRequirements) {
      return {
        passed: false,
        details: 'Does not meet U.S. residency requirements'
      };
    }
    
    return {
      passed: true,
      details: input.isCitizen 
        ? 'U.S. citizen meeting residency requirements'
        : 'Qualifying non-citizen meeting residency requirements'
    };
  }
}

export const ssiRulesEngine = new SSIRulesEngine();
