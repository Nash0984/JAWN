import { policyEngineHttpClient, PolicyEngineHouseholdInput } from './policyEngineHttpClient';

/**
 * PolicyEngine Service
 * Uses PolicyEngine REST API for multi-benefit eligibility calculations
 * Bypasses Python library dependency issues
 */

export interface PolicyEngineHousehold {
  adults: number;
  children: number;
  employmentIncome: number;
  unearnedIncome?: number;
  stateCode: string;
  year?: number;
  // Additional household details
  householdAssets?: number;
  rentOrMortgage?: number;
  utilityCosts?: number;
  medicalExpenses?: number;
  childcareExpenses?: number;
  elderlyOrDisabled?: boolean;
}

export interface BenefitResult {
  snap: number;
  medicaid: boolean;
  eitc: number;
  childTaxCredit: number;
  ssi: number;
  tanf: number;
  householdNetIncome: number;
  householdTax: number;
  householdBenefits: number;
  marginalTaxRate: number;
}

export interface PolicyEngineResponse {
  success: boolean;
  benefits: BenefitResult;
  error?: string;
  calculationDetails?: {
    eligibilityTests: Record<string, boolean>;
    deductions: Record<string, number>;
    warnings: string[];
  };
}

class PolicyEngineService {
  /**
   * Calculate benefits for a household using PolicyEngine REST API
   */
  async calculateBenefits(household: PolicyEngineHousehold): Promise<PolicyEngineResponse> {
    try {
      // Convert to HTTP client input format
      const input: PolicyEngineHouseholdInput = {
        adults: household.adults,
        children: household.children,
        employmentIncome: household.employmentIncome,
        unearnedIncome: household.unearnedIncome,
        stateCode: household.stateCode,
        year: household.year,
        householdAssets: household.householdAssets,
        rentOrMortgage: household.rentOrMortgage,
        utilityCosts: household.utilityCosts,
        medicalExpenses: household.medicalExpenses,
        childcareExpenses: household.childcareExpenses,
        elderlyOrDisabled: household.elderlyOrDisabled
      };
      
      // Call HTTP API
      const benefits = await policyEngineHttpClient.calculateBenefits(input);
      
      // Build eligibility tests from benefit amounts
      const eligibilityTests = {
        snap: benefits.snap > 0,
        medicaid: benefits.medicaid,
        eitc: benefits.eitc > 0,
        ctc: benefits.childTaxCredit > 0
      };
      
      return {
        success: true,
        benefits,
        calculationDetails: {
          eligibilityTests,
          deductions: {
            standard: 0 // API doesn't return this in basic response
          },
          warnings: []
        }
      };
    } catch (error) {
      console.error('PolicyEngine calculation error:', error);
      return {
        success: false,
        benefits: this.getZeroBenefits(),
        error: error instanceof Error ? error.message : 'Unknown error during calculation'
      };
    }
  }

  /**
   * Get zero benefits object (fallback)
   */
  private getZeroBenefits(): BenefitResult {
    return {
      snap: 0,
      medicaid: false,
      eitc: 0,
      childTaxCredit: 0,
      ssi: 0,
      tanf: 0,
      householdNetIncome: 0,
      householdTax: 0,
      householdBenefits: 0,
      marginalTaxRate: 0
    };
  }

  /**
   * Format benefits for human-readable display
   */
  formatBenefitsResponse(result: PolicyEngineResponse): string {
    if (!result.success) {
      return `Unable to calculate benefits: ${result.error}`;
    }

    const { benefits } = result;
    const benefitList: string[] = [];

    if (benefits.snap > 0) {
      benefitList.push(`• SNAP: $${benefits.snap.toFixed(0)}/month`);
    }
    if (benefits.medicaid) {
      benefitList.push(`• Medicaid: Eligible`);
    }
    if (benefits.eitc > 0) {
      benefitList.push(`• EITC: $${benefits.eitc.toFixed(0)}/year`);
    }
    if (benefits.childTaxCredit > 0) {
      benefitList.push(`• Child Tax Credit: $${benefits.childTaxCredit.toFixed(0)}/year`);
    }
    if (benefits.ssi > 0) {
      benefitList.push(`• SSI: $${benefits.ssi.toFixed(0)}/month`);
    }
    if (benefits.tanf > 0) {
      benefitList.push(`• TANF: $${benefits.tanf.toFixed(0)}/month`);
    }

    if (benefitList.length === 0) {
      return 'Based on the information provided, you may not qualify for these benefits. However, eligibility can vary based on additional factors.';
    }

    return `Based on your household information, you may be eligible for:\n\n${benefitList.join('\n')}\n\nNet household income: $${benefits.householdNetIncome.toFixed(0)}/year\nTotal benefits: $${benefits.householdBenefits.toFixed(0)}/year`;
  }

  /**
   * Test PolicyEngine availability (HTTP API)
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await policyEngineHttpClient.testConnection();
      console.log('PolicyEngine API status:', result.message);
      return result.available;
    } catch (error) {
      console.error('PolicyEngine test failed:', error);
      return false;
    }
  }
}

export const policyEngineService = new PolicyEngineService();
