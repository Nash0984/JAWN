/**
 * Rules Engine Adapter Layer
 * 
 * Provides unified interface for all Maryland rules engines
 * with input/output normalization and error handling
 */

import { rulesEngine } from './rulesEngine';
import { ohepRulesEngine } from './ohepRulesEngine';
import { tanfRulesEngine } from './tanfRulesEngine';
import { medicaidRulesEngine } from './medicaidRulesEngine';
// REMOVED - Benefits-only version: vitaTaxRulesEngine import removed
// import { vitaTaxRulesEngine } from './vitaTaxRulesEngine';
import { cacheService, CACHE_KEYS, generateHouseholdHash } from './cacheService';
import { logger } from './logger.service';

export interface HybridEligibilityPayload {
  // Common household fields
  householdSize?: number;
  income?: number;
  earnedIncome?: number;
  unearnedIncome?: number;
  
  // Demographics
  age?: number;
  hasElderly?: boolean;
  hasDisabled?: boolean;
  isPregnant?: boolean;
  
  // Program-specific
  hasSSI?: boolean;
  hasTANF?: boolean;
  assets?: number;
  
  // OHEP specific
  hasCrisis?: boolean;
  utilityArrears?: number;
  
  // Tax specific
  wages?: number;
  filingStatus?: 'single' | 'married_joint' | 'married_separate' | 'head_of_household';
  numberOfQualifyingChildren?: number;
  taxYear?: number;
  
  // TANF specific
  workHoursPerWeek?: number;
  monthsReceivedBenefits?: number;
  
  // Medicaid specific
  receivesSSI?: boolean;
  
  // Other
  shelterCosts?: number;
  medicalExpenses?: number;
  dependentCareExpenses?: number;
  
  // Program context
  benefitProgramId?: string;
}

export interface HybridCalculationResult {
  // Common result fields
  eligible: boolean;
  estimatedBenefit?: number; // In cents
  reason: string;
  breakdown: string[];
  citations: string[];
  
  // Tax-specific (when applicable)
  federalTax?: number;
  stateTax?: number;
  totalTax?: number;
  refund?: number;
  
  // Additional metadata
  programCode: string;
  calculationType: 'eligibility' | 'tax' | 'hybrid';
  
  // PolicyEngine verification (optional)
  policyEngineVerification?: {
    match: boolean;
    policyEngineResult?: any;
    discrepancy?: string;
  };
}

type RulesEngineAdapter = (
  input: HybridEligibilityPayload
) => Promise<HybridCalculationResult | null>;

class RulesEngineAdapterService {
  // Benefits-only version: Removed MD_VITA_TAX and TAX_CREDITS adapters
  private adapters: Record<string, RulesEngineAdapter> = {
    'MD_SNAP': this.snapAdapter.bind(this),
    'MD_OHEP': this.ohepAdapter.bind(this),
    'MD_TANF': this.tanfAdapter.bind(this),
    'MEDICAID': this.medicaidAdapter.bind(this),
  };

  /**
   * Calculate eligibility using appropriate rules engine
   * with caching support
   */
  async calculateEligibility(
    programCode: string,
    input: HybridEligibilityPayload
  ): Promise<HybridCalculationResult | null> {
    const adapter = this.adapters[programCode];
    
    if (!adapter) {
      logger.warn('No adapter found for program', {
        service: 'RulesEngineAdapter',
        programCode
      });
      return null;
    }

    try {
      // Generate cache key from household data
      const householdHash = generateHouseholdHash(input);
      const cacheKey = CACHE_KEYS.RULES_ENGINE_CALC(programCode, householdHash);
      
      // Check cache first
      const cachedResult = cacheService.get<HybridCalculationResult>(cacheKey);
      if (cachedResult) {
        logger.debug('Cache hit for calculation', {
          service: 'RulesEngineAdapter',
          programCode,
          householdHash
        });
        return cachedResult;
      }
      
      // Cache miss - compute using adapter
      logger.debug('Cache miss for calculation', {
        service: 'RulesEngineAdapter',
        programCode,
        householdHash
      });
      const result = await adapter(input);
      
      // Cache the result before returning (default TTL: 300 seconds)
      if (result) {
        cacheService.set(cacheKey, result);
        logger.debug('Cached calculation result', {
          service: 'RulesEngineAdapter',
          programCode,
          householdHash
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Error in adapter', {
        service: 'RulesEngineAdapter',
        programCode,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * SNAP Adapter
   */
  private async snapAdapter(input: HybridEligibilityPayload): Promise<HybridCalculationResult | null> {
    if (!input.benefitProgramId) return null;

    // Convert dollars to cents for rules engine (expects all values in cents)
    const household = {
      size: input.householdSize || 1,
      grossMonthlyIncome: (input.income || 0) * 100, // Convert dollars to cents
      earnedIncome: (input.earnedIncome || 0) * 100,
      unearnedIncome: (input.unearnedIncome || input.income || 0) * 100,
      assets: input.assets !== undefined ? input.assets * 100 : undefined, // Convert dollars to cents
      hasElderly: input.hasElderly || false,
      hasDisabled: input.hasDisabled || false,
      dependentCareExpenses: (input.dependentCareExpenses || 0) * 100,
      medicalExpenses: (input.medicalExpenses || 0) * 100,
      shelterCosts: (input.shelterCosts || 0) * 100,
      categoricalEligibility: input.hasSSI ? 'SSI' : input.hasTANF ? 'TANF' : undefined,
    };

    const result = await rulesEngine.calculateEligibility(input.benefitProgramId, household);

    return {
      eligible: result.isEligible,
      estimatedBenefit: result.monthlyBenefit,
      reason: result.reason || '',
      breakdown: result.calculationBreakdown || [],
      citations: result.policyCitations?.map(c => 
        `${c.sectionNumber}: ${c.description}`
      ) || [],
      programCode: 'MD_SNAP',
      calculationType: 'eligibility'
    };
  }

  /**
   * OHEP Adapter
   */
  private async ohepAdapter(input: HybridEligibilityPayload): Promise<HybridCalculationResult | null> {
    const monthlyIncome = input.income || 0;
    const household = {
      size: input.householdSize || 1,
      grossMonthlyIncome: monthlyIncome,
      grossAnnualIncome: monthlyIncome * 12,
      hasElderlyMember: input.hasElderly || false,
      hasDisabledMember: input.hasDisabled || false,
      hasChildUnder6: false, // Would need to extract from age data
      isCrisisSituation: input.hasCrisis || false,
      hasArrearage: (input.utilityArrears || 0) > 0,
    };

    const result = await ohepRulesEngine.calculateEligibility(household);

    return {
      eligible: result.isEligible,
      estimatedBenefit: result.benefitAmount,
      reason: result.reason || '',
      breakdown: result.calculationBreakdown,
      citations: result.policyCitations.map(c => `${c.sectionNumber}: ${c.description}`),
      programCode: 'MD_OHEP',
      calculationType: 'eligibility'
    };
  }

  /**
   * TANF Adapter
   */
  private async tanfAdapter(input: HybridEligibilityPayload): Promise<HybridCalculationResult | null> {
    const household = {
      size: input.householdSize || 1,
      countableMonthlyIncome: input.income || 0,
      liquidAssets: input.assets || 0,
      hasEarnedIncome: (input.earnedIncome || 0) > 0,
      householdType: "single_parent" as const, // Default - would need to extract from data
      isWorkExempt: input.hasDisabled || input.hasElderly,
      exemptionReason: input.hasDisabled ? 'disabled' : input.hasElderly ? 'elderly' : undefined,
      currentWorkHours: input.workHoursPerWeek,
      monthsReceived: input.monthsReceivedBenefits,
      continuousMonthsReceived: 0, // Would need to track
    };

    const result = await tanfRulesEngine.calculateEligibility(household);

    return {
      eligible: result.isEligible,
      estimatedBenefit: result.monthlyBenefit,
      reason: result.reason || '',
      breakdown: result.calculationBreakdown,
      citations: result.policyCitations.map(c => `${c.sectionNumber}: ${c.description}`),
      programCode: 'MD_TANF',
      calculationType: 'eligibility'
    };
  }

  /**
   * Medicaid Adapter
   */
  private async medicaidAdapter(input: HybridEligibilityPayload): Promise<HybridCalculationResult | null> {
    const monthlyIncome = input.income || 0;
    const household = {
      size: input.householdSize || 1,
      monthlyIncome,
      annualIncome: monthlyIncome * 12,
      age: input.age || 30,
      isPregnant: input.isPregnant || false,
      isDisabled: input.hasDisabled || false,
      isElderly: input.hasElderly || (input.age || 0) >= 65,
      isBlind: false, // Would need to extract
      isSSIRecipient: input.receivesSSI || input.hasSSI || false,
      liquidAssets: input.assets || 0,
    };

    const result = await medicaidRulesEngine.calculateEligibility(household);

    return {
      eligible: result.isEligible,
      estimatedBenefit: 0, // Medicaid doesn't have monthly benefit amount
      reason: result.reason || '',
      breakdown: result.calculationBreakdown,
      citations: result.policyCitations,
      programCode: 'MEDICAID',
      calculationType: 'eligibility'
    };
  }

  // REMOVED - Benefits-only version: VITA Tax Adapter and Tax Credits Adapter removed
  // Tax calculations are not available in benefits-only deployment

  /**
   * Get supported program codes
   */
  getSupportedPrograms(): string[] {
    return Object.keys(this.adapters);
  }

  /**
   * Check if program is supported
   */
  isSupported(programCode: string): boolean {
    return programCode in this.adapters;
  }
}

export const rulesEngineAdapter = new RulesEngineAdapterService();
