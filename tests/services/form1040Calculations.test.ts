import { describe, it, expect, beforeEach, vi } from 'vitest';
import { policyEngineTaxCalculationService } from '../../server/services/policyEngineTaxCalculation';
import { taxHouseholds2024 } from '../fixtures/households/taxHouseholds';
import axios from 'axios';

/**
 * Form 1040 Federal Tax Calculations Test Suite (2024)
 * 
 * Comprehensive tests for federal tax calculations using PolicyEngine API
 * Covers AGI, taxable income, tax liability, EITC, CTC, and various credits
 * 
 * 2024 IRS Reference Values:
 * - Standard deduction single: $14,600
 * - Standard deduction married filing jointly: $29,200
 * - Standard deduction head of household: $21,900
 * - CTC: $2,000 per qualifying child
 * - Max EITC (no children): $600
 * - Max EITC (1 child): $3,995
 * - Max EITC (2 children): $6,604
 * - Max EITC (3+ children): $7,430
 */

vi.mock('axios');

/**
 * Helper function to create mock PolicyEngine response
 */
function mockPolicyEngineResponse(values: Record<string, any>) {
  const year = 2024;
  const response: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(values)) {
    response[key] = { [year]: value };
  }
  
  return response;
}

describe('Form 1040 Federal Tax Calculations (2024)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup axios mock
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: {},
    } as any);
  });

  describe('Basic Tax Calculations', () => {
    it('should calculate tax for single filer with W-2 income only', async () => {
      const household = taxHouseholds2024.singleW2;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 45000,
          standard_deduction: 14600,
          taxable_income: 30400,
          income_tax_before_credits: 3412,
          eitc: 0,
          ctc: 0,
          additional_ctc: 0,
          income_tax: 3412,
          marginal_tax_rate: 0.12,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.adjustedGrossIncome).toBe(45000);
      expect(result.deduction).toBe(14600);
      expect(result.taxableIncome).toBe(30400);
      expect(result.incomeTax).toBe(3412);
      expect(result.eitc).toBe(0);
      expect(result.childTaxCredit).toBe(0);
      expect(result.federalWithholding).toBe(5400);
    });

    it('should calculate tax for married filing jointly with dual W-2 income', async () => {
      const household = taxHouseholds2024.marriedWithKidsEitc;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 63000,
          standard_deduction: 29200,
          itemized_deductions: 0,
          taxable_income: 33800,
          income_tax_before_credits: 3784,
          eitc: 6000,
          ctc: 4000,
          additional_ctc: 1600,
          cdcc: 600,
          income_tax: 0,
          marginal_tax_rate: 0.12,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.totalIncome).toBe(63000);
      expect(result.adjustedGrossIncome).toBe(63000);
      expect(result.deduction).toBe(29200);
      expect(result.taxableIncome).toBe(33800);
      expect(result.eitc).toBe(6000);
      expect(result.childTaxCredit).toBe(4000);
      expect(result.additionalChildTaxCredit).toBe(1600);
      expect(result.childDependentCareCredit).toBe(600);
      expect(result.deductionBreakdown.usedStandardDeduction).toBe(true);
    });

    it('should calculate tax for head of household with W-2 income', async () => {
      const household = taxHouseholds2024.headOfHouseholdEitc;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 42000,
          standard_deduction: 21900,
          taxable_income: 20100,
          income_tax_before_credits: 2212,
          eitc: 3900,
          ctc: 2000,
          additional_ctc: 800,
          income_tax: 0,
          marginal_tax_rate: 0.12,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.adjustedGrossIncome).toBe(42000);
      expect(result.deduction).toBe(21900);
      expect(result.taxableIncome).toBe(20100);
      expect(result.eitc).toBe(3900);
      expect(result.childTaxCredit).toBe(2000);
      expect(result.additionalChildTaxCredit).toBe(800);
    });

    it('should calculate total income (Form 1040 line 9) correctly', async () => {
      const household = taxHouseholds2024.singleW2;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 45000,
          standard_deduction: 14600,
          taxable_income: 30400,
          income_tax_before_credits: 3412,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.totalIncome).toBe(45000);
      expect(result.adjustedGrossIncome).toBe(result.totalIncome);
    });
  });

  describe('AGI Calculations', () => {
    it('should calculate AGI correctly with W-2 wages only', async () => {
      const household = taxHouseholds2024.singleW2;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 45000,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.adjustedGrossIncome).toBe(45000);
      expect(result.totalIncome).toBe(result.adjustedGrossIncome);
    });

    it('should calculate AGI with W-2 + self-employment income deduction', async () => {
      const household = taxHouseholds2024.selfEmployedSingle;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 47176,
          self_employment_tax: 7065,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.adjustedGrossIncome).toBe(47176);
    });

    it('should calculate AGI with multiple income sources (wages + interest + dividends)', async () => {
      const household = taxHouseholds2024.highEarnerSingle;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 127500,
          taxable_interest_income: 0,
          qualified_dividend_income: 2500,
          long_term_capital_gains: 5000,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.adjustedGrossIncome).toBe(127500);
      expect(result.totalIncome).toBe(127500);
    });
  });

  describe('Standard vs Itemized Deduction Tests', () => {
    it('should apply correct standard deduction for single filer (2024: $14,600)', async () => {
      const household = taxHouseholds2024.singleW2;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          standard_deduction: 14600,
          itemized_deductions: 0,
          adjusted_gross_income: 45000,
          taxable_income: 30400,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.deduction).toBe(14600);
      expect(result.deductionBreakdown.standardDeduction).toBe(14600);
      expect(result.deductionBreakdown.usedStandardDeduction).toBe(true);
    });

    it('should apply correct standard deduction for married filing jointly (2024: $29,200)', async () => {
      const household = taxHouseholds2024.marriedWithKidsEitc;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          standard_deduction: 29200,
          itemized_deductions: 0,
          adjusted_gross_income: 63000,
          taxable_income: 33800,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.deduction).toBe(29200);
      expect(result.deductionBreakdown.standardDeduction).toBe(29200);
      expect(result.deductionBreakdown.usedStandardDeduction).toBe(true);
    });

    it('should apply correct standard deduction for head of household (2024: $21,900)', async () => {
      const household = taxHouseholds2024.headOfHouseholdEitc;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          standard_deduction: 21900,
          itemized_deductions: 0,
          adjusted_gross_income: 42000,
          taxable_income: 20100,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.deduction).toBe(21900);
      expect(result.deductionBreakdown.standardDeduction).toBe(21900);
      expect(result.deductionBreakdown.usedStandardDeduction).toBe(true);
    });
  });

  describe('Tax Bracket Calculations', () => {
    it('should calculate tax in 12% bracket for single filer', async () => {
      const household = {
        ...taxHouseholds2024.singleW2,
        w2Income: {
          taxpayerWages: 30000,
          federalWithholding: 3000,
          socialSecurityWithholding: 1860,
          medicareWithholding: 435,
        },
      };
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 30000,
          standard_deduction: 14600,
          taxable_income: 15400,
          income_tax_before_credits: 1548,
          marginal_tax_rate: 0.12,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.taxableIncome).toBe(15400);
      expect(result.incomeTax).toBe(1548);
      expect(result.marginalTaxRate).toBe(0.12);
    });

    it('should calculate tax in 22% bracket for single filer', async () => {
      const household = {
        ...taxHouseholds2024.singleW2,
        w2Income: {
          taxpayerWages: 80000,
          federalWithholding: 12000,
          socialSecurityWithholding: 4960,
          medicareWithholding: 1160,
        },
      };
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 80000,
          standard_deduction: 14600,
          taxable_income: 65400,
          income_tax_before_credits: 9988,
          marginal_tax_rate: 0.22,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.taxableIncome).toBe(65400);
      expect(result.incomeTax).toBe(9988);
      expect(result.marginalTaxRate).toBe(0.22);
    });

    it('should calculate tax in 12% bracket for married filing jointly', async () => {
      const household = taxHouseholds2024.marriedWithKidsEitc;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 63000,
          standard_deduction: 29200,
          taxable_income: 33800,
          income_tax_before_credits: 3784,
          marginal_tax_rate: 0.12,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.taxableIncome).toBe(33800);
      expect(result.marginalTaxRate).toBe(0.12);
    });

    it('should verify progressive tax calculation (multiple brackets)', async () => {
      const household = taxHouseholds2024.highEarnerSingle;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 127500,
          standard_deduction: 14600,
          taxable_income: 112900,
          income_tax_before_credits: 21418,
          marginal_tax_rate: 0.24,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.incomeTax).toBe(21418);
      expect(result.marginalTaxRate).toBe(0.24);
      expect(result.effectiveTaxRate).toBeGreaterThan(0);
      expect(result.effectiveTaxRate).toBeLessThan(result.marginalTaxRate * 100);
    });
  });

  describe('Earned Income Tax Credit (EITC)', () => {
    it('should calculate EITC for single with 1 child', async () => {
      const household = {
        ...taxHouseholds2024.headOfHouseholdEitc,
        w2Income: {
          taxpayerWages: 25000,
          federalWithholding: 2000,
          socialSecurityWithholding: 1550,
          medicareWithholding: 362.50,
        },
      };
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 25000,
          eitc: 3995,
          standard_deduction: 21900,
          taxable_income: 3100,
          income_tax_before_credits: 310,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.eitc).toBeGreaterThan(0);
      expect(result.eitc).toBeLessThanOrEqual(3995);
    });

    it('should calculate EITC for married filing jointly with 2 children', async () => {
      const household = taxHouseholds2024.marriedWithKidsEitc;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 63000,
          eitc: 6000,
          ctc: 4000,
          standard_deduction: 29200,
          taxable_income: 33800,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.eitc).toBeGreaterThan(0);
      expect(result.eitc).toBe(6000);
    });

    it('should phase out EITC for higher incomes', async () => {
      const household = {
        ...taxHouseholds2024.marriedWithKidsEitc,
        w2Income: {
          taxpayerWages: 50000,
          spouseWages: 50000,
          federalWithholding: 15000,
          socialSecurityWithholding: 6200,
          medicareWithholding: 1450,
        },
      };
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 100000,
          eitc: 0,
          ctc: 4000,
          standard_deduction: 29200,
          taxable_income: 70800,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.eitc).toBe(0);
    });

    it('should not provide EITC for taxpayer without qualifying children', async () => {
      const household = taxHouseholds2024.singleW2;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 45000,
          eitc: 0,
          standard_deduction: 14600,
          taxable_income: 30400,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.eitc).toBe(0);
    });
  });

  describe('Child Tax Credit (CTC)', () => {
    it('should calculate CTC for 2 qualifying children (2024: $2,000 per child)', async () => {
      const household = taxHouseholds2024.marriedWithKidsEitc;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 63000,
          ctc: 4000,
          additional_ctc: 0,
          income_tax_before_credits: 3784,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.childTaxCredit).toBe(4000);
    });

    it('should calculate Additional Child Tax Credit (refundable portion)', async () => {
      const household = taxHouseholds2024.marriedWithKidsEitc;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 63000,
          ctc: 4000,
          additional_ctc: 1600,
          income_tax_before_credits: 3784,
          income_tax: 0,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.childTaxCredit).toBe(4000);
      expect(result.additionalChildTaxCredit).toBe(1600);
      expect(result.additionalChildTaxCredit).toBeGreaterThan(0);
    });

    it('should phase out CTC for high earners', async () => {
      const household = {
        ...taxHouseholds2024.marriedWithKidsEitc,
        w2Income: {
          taxpayerWages: 250000,
          spouseWages: 250000,
          federalWithholding: 75000,
          socialSecurityWithholding: 19864,
          medicareWithholding: 7250,
        },
      };
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 500000,
          ctc: 0,
          additional_ctc: 0,
          standard_deduction: 29200,
          taxable_income: 470800,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.childTaxCredit).toBe(0);
      expect(result.additionalChildTaxCredit).toBe(0);
    });
  });

  describe('Other Tax Credits', () => {
    it('should calculate Child and Dependent Care Credit', async () => {
      const household = taxHouseholds2024.marriedWithKidsEitc;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 63000,
          cdcc: 600,
          ctc: 4000,
          eitc: 6000,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.childDependentCareCredit).toBe(600);
      expect(result.childDependentCareCredit).toBeGreaterThan(0);
    });

    it('should calculate Education credits (American Opportunity/Lifetime Learning)', async () => {
      const household = taxHouseholds2024.marriedWithEducation;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 103000,
          american_opportunity_credit: 2500,
          standard_deduction: 29200,
          taxable_income: 73800,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.educationCredits).toBe(2500);
      expect(result.educationCredits).toBeGreaterThan(0);
    });
  });

  describe('Refund Calculations', () => {
    it('should calculate refund correctly with withheld taxes and refundable credits', async () => {
      const household = taxHouseholds2024.marriedWithKidsEitc;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 63000,
          income_tax_before_credits: 3784,
          eitc: 6000,
          ctc: 4000,
          additional_ctc: 1600,
          income_tax: 0,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.refund).toBeGreaterThan(0);
      expect(result.federalWithholding).toBe(7560);
    });

    it('should calculate amount owed when tax exceeds withholding', async () => {
      const household = {
        ...taxHouseholds2024.singleW2,
        w2Income: {
          taxpayerWages: 80000,
          federalWithholding: 5000,
          socialSecurityWithholding: 4960,
          medicareWithholding: 1160,
        },
      };
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 80000,
          standard_deduction: 14600,
          taxable_income: 65400,
          income_tax_before_credits: 9988,
          income_tax: 9988,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.totalTax).toBe(9988);
      expect(result.federalWithholding).toBe(5000);
      expect(result.refund).toBeLessThan(0);
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle self-employment income with deductions', async () => {
      const household = taxHouseholds2024.selfEmployedSingle;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          self_employment_income: 50000,
          adjusted_gross_income: 47176,
          self_employment_tax: 7065,
          standard_deduction: 14600,
          taxable_income: 32576,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.adjustedGrossIncome).toBeLessThan(50000);
    });

    it('should calculate tax for retiree with Social Security and pension', async () => {
      const household = taxHouseholds2024.retireeSingleWithPension;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          social_security: 24000,
          taxable_social_security: 20400,
          adjusted_gross_income: 62400,
          standard_deduction: 16550,
          taxable_income: 45850,
          income_tax_before_credits: 5258,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.taxableSocialSecurity).toBe(20400);
      expect(result.adjustedGrossIncome).toBe(62400);
    });

    it('should handle married filing separately edge case', async () => {
      const household = taxHouseholds2024.marriedFilingSeparately;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 60000,
          standard_deduction: 14600,
          taxable_income: 45400,
          income_tax_before_credits: 5588,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.deduction).toBe(14600);
      expect(result.adjustedGrossIncome).toBe(60000);
    });

    it('should calculate for household with three children (maximum CTC scenario)', async () => {
      const household = taxHouseholds2024.marriedThreeKids;
      
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: mockPolicyEngineResponse({
          adjusted_gross_income: 130000,
          ctc: 6000,
          additional_ctc: 0,
          cdcc: 1200,
          standard_deduction: 29200,
          taxable_income: 100800,
        }),
      });
      
      const result = await policyEngineTaxCalculationService.calculateTax(household);
      
      expect(result.childTaxCredit).toBe(6000);
      expect(result.childDependentCareCredit).toBe(1200);
    });
  });
});
