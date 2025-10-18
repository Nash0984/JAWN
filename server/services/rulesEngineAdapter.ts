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
import { vitaTaxRulesEngine } from './vitaTaxRulesEngine';
import { marylandTaxCreditsRulesEngine } from './marylandTaxCreditsRulesEngine';
import { cacheService, CACHE_KEYS, generateHouseholdHash } from './cacheService';

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
  
  // Housing status (for tax credits)
  isRenter?: boolean;
  isHomeowner?: boolean;
  rentPaid?: number; // Monthly rent paid (in dollars)
  propertyTaxPaid?: number; // Annual property tax paid (in dollars)
  
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
  private adapters: Record<string, RulesEngineAdapter> = {
    'MD_SNAP': this.snapAdapter.bind(this),
    'MD_OHEP': this.ohepAdapter.bind(this),
    'MD_TANF': this.tanfAdapter.bind(this),
    'MEDICAID': this.medicaidAdapter.bind(this),
    'MD_VITA_TAX': this.vitaTaxAdapter.bind(this),
    'TAX_CREDITS': this.taxCreditsAdapter.bind(this), // Not implemented yet
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
      console.warn(`No adapter found for program: ${programCode}`);
      return null;
    }

    try {
      // Generate cache key from household data
      const householdHash = generateHouseholdHash(input);
      const cacheKey = CACHE_KEYS.RULES_ENGINE_CALC(programCode, householdHash);
      
      // Check cache first
      const cachedResult = cacheService.get<HybridCalculationResult>(cacheKey);
      if (cachedResult) {
        console.log(`✅ Cache hit for ${programCode} calculation (hash: ${householdHash})`);
        return cachedResult;
      }
      
      // Cache miss - compute using adapter
      console.log(`❌ Cache miss for ${programCode} calculation (hash: ${householdHash})`);
      const result = await adapter(input);
      
      // Cache the result before returning (default TTL: 300 seconds)
      if (result) {
        cacheService.set(cacheKey, result);
        console.log(`💾 Cached ${programCode} calculation result (hash: ${householdHash})`);
      }
      
      return result;
    } catch (error) {
      console.error(`Error in ${programCode} adapter:`, error);
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

  /**
   * VITA Tax Adapter
   */
  private async vitaTaxAdapter(input: HybridEligibilityPayload): Promise<HybridCalculationResult | null> {
    if (!input.wages || !input.filingStatus) {
      return null; // Missing required tax parameters
    }

    const taxInput = {
      wages: input.wages,
      otherIncome: 0, // Would need to extract
      filingStatus: input.filingStatus,
      numberOfQualifyingChildren: input.numberOfQualifyingChildren || 0,
      dependents: input.numberOfQualifyingChildren || 0,
      taxYear: input.taxYear || 2024,
      marylandCounty: 'baltimore_city', // Default - could extract from location data
      marylandResidentMonths: 12, // Full year default
    };

    const result = await vitaTaxRulesEngine.calculateTax(taxInput);

    const refund = result.totalRefund || 0;
    const taxOwed = result.totalTaxLiability > 0 ? result.totalTaxLiability : 0;

    return {
      eligible: true, // Tax calculations are always "eligible"
      estimatedBenefit: refund,
      reason: refund > 0 
        ? `Eligible for tax refund of $${(refund / 100).toFixed(2)}`
        : taxOwed > 0
          ? `Tax owed: $${(taxOwed / 100).toFixed(2)}`
          : 'No tax owed or refund',
      breakdown: result.calculationBreakdown,
      citations: result.policyCitations,
      federalTax: result.federalTax.totalFederalTax,
      stateTax: result.marylandTax.totalMarylandTax,
      totalTax: result.totalTaxLiability,
      refund,
      programCode: 'MD_VITA_TAX',
      calculationType: 'tax'
    };
  }

  /**
   * Tax Credits Adapter
   * Calculates Maryland state tax credits (Renters', Property Tax, Poverty Level)
   */
  private async taxCreditsAdapter(input: HybridEligibilityPayload): Promise<HybridCalculationResult | null> {
    // ========================================
    // CRITICAL INPUT VALIDATION
    // ========================================
    
    // 1. Validate required fields for AGI calculation and eligibility
    if (!input.income || input.income <= 0) {
      console.warn('Tax Credits: Missing or invalid income (required for AGI calculation)');
      return null;
    }
    
    if (!input.householdSize || input.householdSize <= 0) {
      console.warn('Tax Credits: Missing or invalid householdSize (required for poverty level credit)');
      return null;
    }
    
    if (!input.filingStatus) {
      console.warn('Tax Credits: Missing filingStatus (required for poverty threshold calculation)');
      return null;
    }

    // 2. Enforce mutually exclusive housing status
    if (input.isRenter && input.isHomeowner) {
      console.warn('Tax Credits: Both isRenter and isHomeowner are true - mutually exclusive');
      return null;
    }
    
    if (!input.isRenter && !input.isHomeowner) {
      console.warn('Tax Credits: No housing status provided - need isRenter or isHomeowner');
      return null;
    }

    // 3. Require housing cost fields based on status
    if (input.isRenter && (!input.rentPaid || input.rentPaid <= 0)) {
      console.warn('Tax Credits: Renter status but no rentPaid amount provided');
      return null;
    }
    
    if (input.isHomeowner && (!input.propertyTaxPaid || input.propertyTaxPaid <= 0)) {
      console.warn('Tax Credits: Homeowner status but no propertyTaxPaid amount provided');
      return null;
    }

    // 4. Validate tax year
    const taxYear = input.taxYear || 2024; // Default to current tax year (2024)
    if (taxYear < 2020 || taxYear > 2025) {
      console.warn(`Tax Credits: Tax year ${taxYear} out of supported range (2020-2025)`);
      return null;
    }

    // ========================================
    // DATA PROCESSING (after validation)
    // ========================================

    // CRITICAL FIX #1: Income annualization
    // input.income is MONTHLY income throughout the codebase
    // Tax credits need ANNUAL AGI, so multiply by 12 before converting to cents
    const annualAgiInCents = ((input.income || 0) * 12) * 100;

    // CRITICAL FIX #2: Use explicit housing status fields instead of placeholder logic
    const isRenter = input.isRenter || false;
    const isHomeowner = input.isHomeowner || false;

    // CRITICAL FIX #3: Use separate rent and property tax fields
    // rentPaid is monthly, so annualize it (* 12), then convert to cents (* 100)
    // propertyTaxPaid is already annual, so just convert to cents
    const annualRentPaidInCents = input.rentPaid ? (input.rentPaid * 12) * 100 : undefined;
    const propertyTaxPaidInCents = input.propertyTaxPaid ? input.propertyTaxPaid * 100 : undefined;

    // Prepare input for tax credits rules engine
    const taxCreditsInput = {
      adjustedGrossIncome: annualAgiInCents,
      householdSize: input.householdSize,
      filingStatus: input.filingStatus,
      rentPaid: annualRentPaidInCents,
      propertyTaxPaid: propertyTaxPaidInCents,
      isRenter,
      isHomeowner,
      taxYear,
    };

    // Calculate eligibility using Maryland Tax Credits rules engine
    const result = await marylandTaxCreditsRulesEngine.calculateEligibility(taxCreditsInput);

    // Build breakdown with individual credit amounts
    const breakdown: string[] = [];
    
    breakdown.push(`Total Maryland Tax Credits: $${(result.totalCredits / 100).toFixed(2)}`);
    
    if (result.rentersCredit > 0) {
      breakdown.push(`• Renters' Credit: $${(result.rentersCredit / 100).toFixed(2)}`);
    }
    
    if (result.propertyTaxCredit > 0) {
      breakdown.push(`• Property Tax Credit: $${(result.propertyTaxCredit / 100).toFixed(2)}`);
    }
    
    if (result.povertyLevelCredit > 0) {
      breakdown.push(`• Poverty Level Credit: $${(result.povertyLevelCredit / 100).toFixed(2)}`);
    }
    
    // Add detailed breakdown from rules engine
    breakdown.push(...result.calculationBreakdown);

    return {
      eligible: result.isEligible,
      estimatedBenefit: result.totalCredits,
      reason: result.reason || 'Not eligible for any Maryland tax credits',
      breakdown,
      citations: result.policyCitations,
      programCode: 'TAX_CREDITS',
      calculationType: 'tax',
    };
  }

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
