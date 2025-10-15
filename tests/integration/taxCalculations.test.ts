import { describe, it, expect } from 'vitest';
import { taxHouseholds2024, w2Samples } from '../fixtures';
import { toCents, formatCurrency } from '../utils/testHelpers';

/**
 * Tax Calculation Tests
 * 
 * Example test suite demonstrating how to use tax household
 * and W-2 fixtures for tax calculation testing
 */

describe('Tax Calculations - 2024 Tax Year', () => {
  describe('Filing Status', () => {
    it('should use single filing status for unmarried taxpayer', () => {
      const household = taxHouseholds2024.singleW2;
      
      expect(household.filingStatus).toBe('single');
      expect(household.taxYear).toBe(2024);
      expect(household.taxpayer.age).toBe(35);
      expect(household.spouse).toBeUndefined();
    });

    it('should use married filing jointly for couple', () => {
      const household = taxHouseholds2024.marriedWithKidsEitc;
      
      expect(household.filingStatus).toBe('married_joint');
      expect(household.spouse).toBeDefined();
      expect(household.spouse?.age).toBe(30);
    });

    it('should use head of household for single parent', () => {
      const household = taxHouseholds2024.headOfHouseholdEitc;
      
      expect(household.filingStatus).toBe('head_of_household');
      expect(household.dependents).toHaveLength(1);
      expect(household.dependents?.[0].relationship).toBe('child');
    });
  });

  describe('Income Sources', () => {
    it('should calculate total W-2 wages for single filer', () => {
      const household = taxHouseholds2024.singleW2;
      
      expect(household.w2Income?.taxpayerWages).toBe(45000);
      expect(household.w2Income?.federalWithholding).toBe(5400);
    });

    it('should combine spouse wages for married filing jointly', () => {
      const household = taxHouseholds2024.marriedWithKidsEitc;
      
      const totalWages = 
        (household.w2Income?.taxpayerWages || 0) + 
        (household.w2Income?.spouseWages || 0);
      
      expect(totalWages).toBe(63000); // 35000 + 28000
    });

    it('should handle self-employment income', () => {
      const household = taxHouseholds2024.selfEmployedSingle;
      
      expect(household.selfEmploymentIncome).toBeDefined();
      expect(household.selfEmploymentIncome?.gross).toBe(65000);
      expect(household.selfEmploymentIncome?.expenses).toBe(15000);
      
      const netIncome = 
        (household.selfEmploymentIncome?.gross || 0) - 
        (household.selfEmploymentIncome?.expenses || 0);
      expect(netIncome).toBe(50000);
    });

    it('should handle retirement income', () => {
      const household = taxHouseholds2024.retireeSingleWithPension;
      
      expect(household.socialSecurityBenefits).toBe(24000);
      expect(household.pensionDistributions?.total).toBe(30000);
      expect(household.iraDistributions?.total).toBe(12000);
    });
  });

  describe('Credits and Deductions', () => {
    it('should track childcare costs for dependent care credit', () => {
      const household = taxHouseholds2024.marriedWithKidsEitc;
      
      expect(household.childcareCosts).toBe(8000);
      expect(household.dependents).toHaveLength(2);
    });

    it('should track education expenses for education credits', () => {
      const household = taxHouseholds2024.marriedWithEducation;
      
      expect(household.educationExpenses).toBe(6000);
      expect(household.dependents?.[0].studentStatus).toBe('full_time');
    });

    it('should track ACA health insurance for premium tax credit', () => {
      const household = taxHouseholds2024.marriedWithAca;
      
      expect(household.healthInsurance).toBeDefined();
      expect(household.healthInsurance?.monthlyPremium).toBe(800);
      expect(household.healthInsurance?.slcspPremium).toBe(900);
      expect(household.healthInsurance?.aptcReceived).toBe(4800);
    });

    it('should support itemized deductions', () => {
      const household = taxHouseholds2024.marriedItemized;
      
      expect(household.mortgageInterest).toBe(15000);
      expect(household.charitableContributions).toBe(8000);
      
      const totalItemized = 
        (household.mortgageInterest || 0) + 
        (household.charitableContributions || 0);
      expect(totalItemized).toBe(23000);
    });
  });

  describe('W-2 Document Extraction', () => {
    it('should extract standard W-2 data', () => {
      const w2 = w2Samples.standard2024;
      
      expect(w2.taxYear).toBe(2024);
      expect(w2.employerName).toBe('Maryland Tech Solutions Inc');
      expect(w2.box1_wages).toBe(45000);
      expect(w2.box2_federalTaxWithheld).toBe(5400);
    });

    it('should extract Maryland state tax withholding', () => {
      const w2 = w2Samples.standard2024;
      
      expect(w2.box16_stateWages).toBe(45000);
      expect(w2.box17_stateIncomeTax).toBe(2475);
      expect(w2.box20_localityName).toBe('Baltimore City');
    });

    it('should extract retirement plan contributions', () => {
      const w2 = w2Samples.standard2024;
      
      expect(w2.box13_retirementPlan).toBe(true);
      expect(w2.box12_codes).toHaveLength(1);
      expect(w2.box12_codes[0].code).toBe('D'); // 401k
      expect(w2.box12_codes[0].amount).toBe(3600);
    });

    it('should handle high earner with multiple box 12 codes', () => {
      const w2 = w2Samples.highEarner2024;
      
      expect(w2.box1_wages).toBe(125000);
      expect(w2.box12_codes).toHaveLength(2);
      
      const codes = w2.box12_codes.map(c => c.code);
      expect(codes).toContain('D'); // 401k
      expect(codes).toContain('DD'); // Employer health coverage
    });

    it('should handle restaurant worker with tips', () => {
      const w2 = w2Samples.restaurantWorkerWithTips2024;
      
      expect(w2.box7_socialSecurityTips).toBe(12000);
      expect(w2.box1_wages).toBeGreaterThan(0);
      
      // Tips are included in total wages
      const totalCompensation = w2.box1_wages;
      expect(totalCompensation).toBeGreaterThan(w2.box7_socialSecurityTips);
    });

    it('should handle dual job W-2s for same person', () => {
      const w2First = w2Samples.dualJobs2024_First;
      const w2Second = w2Samples.dualJobs2024_Second;
      
      // Same employee
      expect(w2First.employeeSSN).toBe(w2Second.employeeSSN);
      expect(w2First.employeeName).toBe(w2Second.employeeName);
      
      // Different employers
      expect(w2First.employerName).not.toBe(w2Second.employerName);
      
      // Total wages
      const totalWages = w2First.box1_wages + w2Second.box1_wages;
      expect(totalWages).toBe(50000); // 35000 + 15000
    });
  });

  describe('EITC Eligibility', () => {
    it('should identify EITC eligible household with children', () => {
      const household = taxHouseholds2024.lowIncomeSingleParent;
      
      expect(household.filingStatus).toBe('head_of_household');
      expect(household.dependents).toHaveLength(2);
      expect(household.w2Income?.taxpayerWages).toBe(18000);
      
      // Income in EITC sweet spot for 2 kids
      expect(household.w2Income?.taxpayerWages).toBeLessThan(50000);
    });

    it('should exclude high earners from EITC', () => {
      const household = taxHouseholds2024.highEarnerSingle;
      
      expect(household.w2Income?.taxpayerWages).toBe(120000);
      // High income should phase out EITC
      expect(household.w2Income?.taxpayerWages).toBeGreaterThan(60000);
    });
  });

  describe('Child Tax Credit', () => {
    it('should count eligible children for CTC', () => {
      const household = taxHouseholds2024.marriedThreeKids;
      
      expect(household.dependents).toHaveLength(3);
      household.dependents?.forEach(dep => {
        expect(dep.relationship).toBe('child');
        expect(dep.age).toBeLessThan(17); // CTC age limit
      });
    });
  });

  describe('Test Helper Functions', () => {
    it('should format tax amounts correctly', () => {
      const wages = 45000;
      const federalTax = 5400;
      
      expect(formatCurrency(toCents(wages))).toBe('$45,000.00');
      expect(formatCurrency(toCents(federalTax))).toBe('$5,400.00');
    });
  });
});
