import axios from 'axios';
import type { W2Data, Form1099MISCData, Form1099NECData } from './taxDocumentExtraction';
import { createLogger } from './logger.service';

const logger = createLogger('PolicyEngineTaxCalculation');

/**
 * PolicyEngine Tax Calculation Service
 * 
 * Enhanced tax calculation service for federal tax preparation:
 * - Form 1040 calculations (AGI, taxable income, total tax)
 * - EITC, CTC, ACTC (Additional Child Tax Credit)
 * - Premium Tax Credit (for 1095-A/ACA coverage)
 * - Filing status support (single, married filing jointly, head of household, etc.)
 * - W-2 and 1099 income integration
 * - Standard vs. itemized deduction optimization
 * 
 * Integrates with existing benefits calculations for unified household profiling.
 */

const POLICY_ENGINE_API_URL = 'https://api.policyengine.org/us/calculate';

export interface TaxHouseholdInput {
  // Filing information
  taxYear: number;
  filingStatus: 'single' | 'married_joint' | 'married_separate' | 'head_of_household' | 'qualifying_widow';
  stateCode: string;
  
  // Household members
  taxpayer: {
    age: number;
    isBlind?: boolean;
    isDisabled?: boolean;
  };
  spouse?: {
    age: number;
    isBlind?: boolean;
    isDisabled?: boolean;
  };
  dependents?: Array<{
    age: number;
    relationship: 'child' | 'other_dependent';
    studentStatus?: 'full_time' | 'part_time' | 'none';
    disabilityStatus?: boolean;
  }>;
  
  // Income from W-2s
  w2Income?: {
    taxpayerWages: number;
    spouseWages?: number;
    federalWithholding: number;
    socialSecurityWithholding: number;
    medicareWithholding: number;
  };
  
  // Self-employment/1099 income
  selfEmploymentIncome?: {
    gross: number;
    expenses: number; // Schedule C deductions
  };
  
  // Other income
  interestIncome?: number;
  dividendIncome?: number;
  capitalGains?: number;
  unemploymentCompensation?: number;
  socialSecurityBenefits?: number;
  
  // Retirement income
  iraDistributions?: {
    total: number;
    taxable: number;
  };
  pensionDistributions?: {
    total: number;
    taxable: number;
  };
  
  // Deductions and expenses
  medicalExpenses?: number;
  mortgageInterest?: number;
  charitableContributions?: number;
  childcareCosts?: number;
  educationExpenses?: number;
  
  // Health insurance (for Premium Tax Credit)
  healthInsurance?: {
    monthlyPremium: number;
    slcspPremium: number; // Second Lowest Cost Silver Plan
    aptcReceived: number; // Advance Premium Tax Credit received
  };
  
  // Prior year (for EITC/CTC phase-outs)
  priorYearAGI?: number;
}

export interface TaxCalculationResult {
  // Form 1040 Line Items
  totalIncome: number; // Line 9
  adjustedGrossIncome: number; // Line 11 (AGI)
  deduction: number; // Line 12 (standard or itemized)
  taxableIncome: number; // Line 15
  
  // Taxable portions (for Form 1040 companion lines)
  taxableSocialSecurity: number; // Line 6b
  
  // Tax calculation
  incomeTax: number; // Line 16 (before credits)
  totalCredits: number; // Line 19
  totalTax: number; // Line 24
  
  // Key tax credits
  eitc: number; // Earned Income Tax Credit
  childTaxCredit: number; // Child Tax Credit (CTC)
  additionalChildTaxCredit: number; // Additional CTC (refundable)
  premiumTaxCredit: number; // Premium Tax Credit (ACA)
  childDependentCareCredit: number; // Child and Dependent Care Credit
  educationCredits: number; // American Opportunity + Lifetime Learning
  
  // Withholding and payments
  federalWithholding: number;
  estimatedTaxPayments: number;
  
  // Refund or amount owed
  refund: number; // Positive = refund, Negative = owed
  
  // Detailed breakdowns
  deductionBreakdown: {
    standardDeduction: number;
    itemizedDeduction: number;
    usedStandardDeduction: boolean;
  };
  
  creditBreakdown: {
    nonRefundableCredits: number;
    refundableCredits: number;
  };
  
  // PolicyEngine metadata
  marginalTaxRate: number;
  effectiveTaxRate: number;
}

export interface CombinedBenefitsTaxResult {
  tax: TaxCalculationResult;
  benefits: {
    snap: number;
    medicaid: boolean;
    ssi: number;
    tanf: number;
  };
  netHouseholdIncome: number; // After tax + benefits
  totalFederalSupport: number; // EITC + CTC + ACTC + Benefits
}

export class PolicyEngineTaxCalculationService {
  /**
   * Build PolicyEngine API payload for tax calculations
   */
  private buildTaxPayload(input: TaxHouseholdInput): any {
    const year = input.taxYear;
    const people: Record<string, any> = {};
    const allMembers: string[] = [];
    
    // Add taxpayer
    people.taxpayer = {
      age: { [year]: input.taxpayer.age },
      is_blind: { [year]: input.taxpayer.isBlind || false },
      is_disabled: { [year]: input.taxpayer.isDisabled || false }
    };
    allMembers.push('taxpayer');
    
    // Add W-2 income for taxpayer
    if (input.w2Income?.taxpayerWages) {
      people.taxpayer.employment_income = { [year]: input.w2Income.taxpayerWages };
    }
    
    // Add spouse if married filing jointly
    if (input.spouse && input.filingStatus === 'married_joint') {
      people.spouse = {
        age: { [year]: input.spouse.age },
        is_blind: { [year]: input.spouse.isBlind || false },
        is_disabled: { [year]: input.spouse.isDisabled || false }
      };
      allMembers.push('spouse');
      
      if (input.w2Income?.spouseWages) {
        people.spouse.employment_income = { [year]: input.w2Income.spouseWages };
      }
    }
    
    // Add dependents
    if (input.dependents) {
      input.dependents.forEach((dep, idx) => {
        const depId = `dependent_${idx}`;
        people[depId] = {
          age: { [year]: dep.age },
          is_full_time_student: { [year]: dep.studentStatus === 'full_time' },
          is_disabled: { [year]: dep.disabilityStatus || false }
        };
        allMembers.push(depId);
      });
    }
    
    // Build tax unit with filing status
    const taxUnit: any = {
      members: allMembers,
      tax_unit_filing_status: { [year]: this.mapFilingStatus(input.filingStatus) }
    };
    
    // Add other income sources
    if (input.interestIncome) {
      people.taxpayer.taxable_interest_income = { [year]: input.interestIncome };
    }
    if (input.dividendIncome) {
      people.taxpayer.qualified_dividend_income = { [year]: input.dividendIncome };
    }
    if (input.capitalGains) {
      people.taxpayer.long_term_capital_gains = { [year]: input.capitalGains };
    }
    if (input.unemploymentCompensation) {
      people.taxpayer.unemployment_compensation = { [year]: input.unemploymentCompensation };
    }
    if (input.socialSecurityBenefits) {
      people.taxpayer.social_security = { [year]: input.socialSecurityBenefits };
    }
    
    // Self-employment income
    if (input.selfEmploymentIncome) {
      people.taxpayer.self_employment_income = { 
        [year]: input.selfEmploymentIncome.gross - input.selfEmploymentIncome.expenses 
      };
    }
    
    // Build household with deductions
    const household: any = {
      members: allMembers,
      state_code: { [year]: input.stateCode }
    };
    
    if (input.medicalExpenses) {
      household.medical_out_of_pocket_expenses = { [year]: input.medicalExpenses };
    }
    if (input.childcareCosts) {
      household.childcare_expenses = { [year]: input.childcareCosts };
    }
    
    // Itemized deductions
    if (input.mortgageInterest) {
      taxUnit.mortgage_interest = { [year]: input.mortgageInterest };
    }
    if (input.charitableContributions) {
      taxUnit.charitable_contributions = { [year]: input.charitableContributions };
    }
    
    // Tax withholding
    if (input.w2Income?.federalWithholding) {
      taxUnit.income_tax_withheld = { [year]: input.w2Income.federalWithholding };
    }
    
    // Premium Tax Credit (ACA)
    if (input.healthInsurance) {
      household.health_insurance_premium = { [year]: input.healthInsurance.monthlyPremium * 12 };
      household.slcsp_premium = { [year]: input.healthInsurance.slcspPremium * 12 };
      taxUnit.premium_tax_credit_received = { [year]: input.healthInsurance.aptcReceived };
    }
    
    return {
      people,
      households: { household },
      tax_units: { tax_unit: taxUnit },
      families: { family: { members: allMembers } }
    };
  }
  
  /**
   * Map filing status to PolicyEngine format
   */
  private mapFilingStatus(status: TaxHouseholdInput['filingStatus']): string {
    const mapping: Record<string, string> = {
      'single': 'SINGLE',
      'married_joint': 'JOINT',
      'married_separate': 'SEPARATE',
      'head_of_household': 'HEAD_OF_HOUSEHOLD',
      'qualifying_widow': 'SURVIVING_SPOUSE'
    };
    return mapping[status] || 'SINGLE';
  }
  
  /**
   * Calculate federal tax return using PolicyEngine
   */
  async calculateTax(input: TaxHouseholdInput): Promise<TaxCalculationResult> {
    const year = input.taxYear;
    const payload = this.buildTaxPayload(input);
    
    try {
      const response = await axios.post(POLICY_ENGINE_API_URL, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      const data = response.data;
      
      // Extract Form 1040 values
      const totalIncome = this.extractValue(data, 'adjusted_gross_income', year) || 0;
      const agi = this.extractValue(data, 'adjusted_gross_income', year) || 0;
      const standardDeduction = this.extractValue(data, 'standard_deduction', year) || 0;
      const itemizedDeduction = this.extractValue(data, 'itemized_deductions', year) || 0;
      const deduction = Math.max(standardDeduction, itemizedDeduction);
      const taxableIncome = Math.max(0, agi - deduction);
      const incomeTax = this.extractValue(data, 'income_tax_before_credits', year) || 0;
      
      // Extract credits
      const eitc = this.extractValue(data, 'eitc', year) || 0;
      const ctc = this.extractValue(data, 'ctc', year) || 0;
      const actc = this.extractValue(data, 'additional_ctc', year) || 0;
      const premiumTaxCredit = this.extractValue(data, 'premium_tax_credit', year) || 0;
      const childDependentCareCredit = this.extractValue(data, 'cdcc', year) || 0;
      const educationCredits = this.extractValue(data, 'american_opportunity_credit', year) || 0;
      
      // Separate refundable from non-refundable credits
      const refundableCredits = eitc + actc + premiumTaxCredit; // EITC, ACTC, PTC are refundable
      const nonRefundableCredits = ctc + childDependentCareCredit + educationCredits;
      
      // Total tax = income tax minus ONLY non-refundable credits
      const totalTax = Math.max(0, incomeTax - nonRefundableCredits);
      const totalCredits = refundableCredits + nonRefundableCredits;
      
      // Withholding
      const federalWithholding = input.w2Income?.federalWithholding || 0;
      
      // Refund = withholding + refundable credits - total tax
      const refund = federalWithholding + refundableCredits - totalTax;
      
      // Marginal and effective rates
      const marginalTaxRate = this.extractValue(data, 'marginal_tax_rate', year) || 0;
      const effectiveTaxRate = agi > 0 ? (totalTax / agi) * 100 : 0;
      
      // Extract taxable Social Security (Line 6b)
      const taxableSocialSecurity = this.extractValue(data, 'taxable_social_security', year) || 
                                    this.extractValue(data, 'social_security_taxable', year) || 0;
      
      return {
        totalIncome,
        adjustedGrossIncome: agi,
        deduction,
        taxableIncome,
        taxableSocialSecurity,
        incomeTax,
        totalCredits,
        totalTax,
        eitc,
        childTaxCredit: ctc,
        additionalChildTaxCredit: actc,
        premiumTaxCredit,
        childDependentCareCredit,
        educationCredits,
        federalWithholding,
        estimatedTaxPayments: 0,
        refund,
        deductionBreakdown: {
          standardDeduction,
          itemizedDeduction,
          usedStandardDeduction: standardDeduction >= itemizedDeduction
        },
        creditBreakdown: {
          nonRefundableCredits,
          refundableCredits
        },
        marginalTaxRate,
        effectiveTaxRate
      };
    } catch (error) {
      logger.error('PolicyEngine tax calculation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
        taxYear: input.taxYear,
        service: 'PolicyEngineTaxCalculation'
      });
      throw new Error(
        `Tax calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  /**
   * Calculate combined benefits and tax (unified household profile)
   */
  async calculateCombinedBenefitsTax(input: TaxHouseholdInput): Promise<CombinedBenefitsTaxResult> {
    const taxResult = await this.calculateTax(input);
    
    // Also calculate benefits using the same household data
    const benefitPayload = this.buildTaxPayload(input);
    
    try {
      const response = await axios.post(POLICY_ENGINE_API_URL, benefitPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      const data = response.data;
      const year = input.taxYear;
      
      const benefits = {
        snap: this.extractValue(data, 'snap', year) || 0,
        medicaid: this.extractValue(data, 'medicaid_eligible', year) || false,
        ssi: this.extractValue(data, 'ssi', year) || 0,
        tanf: this.extractValue(data, 'tanf', year) || 0
      };
      
      // Calculate net household income (income - tax + benefits)
      const netHouseholdIncome = 
        taxResult.adjustedGrossIncome - 
        taxResult.totalTax + 
        (benefits.snap * 12) + 
        (benefits.ssi * 12) + 
        (benefits.tanf * 12);
      
      const totalFederalSupport = 
        taxResult.eitc + 
        taxResult.childTaxCredit + 
        taxResult.additionalChildTaxCredit + 
        (benefits.snap * 12) + 
        (benefits.ssi * 12) + 
        (benefits.tanf * 12);
      
      return {
        tax: taxResult,
        benefits,
        netHouseholdIncome,
        totalFederalSupport
      };
    } catch (error) {
      logger.error('Combined calculation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
        taxYear: input.taxYear,
        service: 'PolicyEngineTaxCalculation'
      });
      throw error;
    }
  }
  
  /**
   * Extract W-2 data and convert to tax input
   */
  extractW2ToTaxInput(w2Data: W2Data): Partial<TaxHouseholdInput['w2Income']> {
    return {
      taxpayerWages: w2Data.box1_wages || 0,
      federalWithholding: w2Data.box2_federalTaxWithheld || 0,
      socialSecurityWithholding: w2Data.box4_socialSecurityTaxWithheld || 0,
      medicareWithholding: w2Data.box6_medicareTaxWithheld || 0
    };
  }
  
  /**
   * Extract 1099 data and convert to tax input
   */
  extract1099ToTaxInput(form1099: Form1099MISCData | Form1099NECData): Partial<TaxHouseholdInput> {
    if ('box1_nonemployeeCompensation' in form1099) {
      // 1099-NEC
      const necData = form1099 as Form1099NECData;
      return {
        selfEmploymentIncome: {
          gross: necData.box1_nonemployeeCompensation || 0,
          expenses: 0 // User must provide expenses separately
        }
      };
    } else {
      // 1099-MISC
      const miscData = form1099 as Form1099MISCData;
      return {
        selfEmploymentIncome: {
          gross: (miscData.box1_rents || 0) + (miscData.box2_royalties || 0),
          expenses: 0
        }
      };
    }
  }
  
  /**
   * Helper to extract value from PolicyEngine response
   */
  private extractValue(data: any, variable: string, year: number): any {
    if (!data || !data[variable]) {
      return null;
    }
    
    const varData = data[variable];
    
    if (typeof varData === 'object' && varData[year] !== undefined) {
      return varData[year];
    }
    
    if (typeof varData === 'number' || typeof varData === 'boolean') {
      return varData;
    }
    
    return null;
  }
}

export const policyEngineTaxCalculationService = new PolicyEngineTaxCalculationService();
