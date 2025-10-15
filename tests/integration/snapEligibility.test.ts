import { describe, it, expect, beforeEach } from 'vitest';
import { marylandHouseholds } from '../fixtures';
import { toCents, formatCurrency, assertWithinRange } from '../utils/testHelpers';

/**
 * SNAP Eligibility Calculation Tests
 * 
 * Example test suite demonstrating how to use the test fixtures
 * for Maryland SNAP eligibility testing
 */

describe('SNAP Eligibility - Maryland Households', () => {
  describe('Income Limits', () => {
    it('should pass gross income test for single working adult', () => {
      const household = marylandHouseholds.singleAdultWorking;
      
      expect(household.size).toBe(1);
      expect(household.grossMonthlyIncome).toBe(150000); // $1,500 in cents
      expect(household.earnedIncome).toBe(150000);
      
      // Verify income is in cents
      expect(household.grossMonthlyIncome).toBeLessThan(220000); // $2,200 limit for size 1
    });

    it('should fail gross income test for high earner', () => {
      const household = marylandHouseholds.highIncome;
      
      expect(household.size).toBe(2);
      expect(household.grossMonthlyIncome).toBe(500000); // $5,000 in cents
      
      // High income should exceed limits
      expect(household.grossMonthlyIncome).toBeGreaterThan(300000);
    });
  });

  describe('Categorical Eligibility', () => {
    it('should bypass income tests for SSI recipients', () => {
      const household = marylandHouseholds.elderlySsi;
      
      expect(household.categoricalEligibility).toBe('SSI');
      expect(household.hasElderly).toBe(true);
      expect(household.grossMonthlyIncome).toBe(91400); // $914 SSI
    });

    it('should bypass income tests for TANF recipients', () => {
      const household = marylandHouseholds.tanfRecipient;
      
      expect(household.categoricalEligibility).toBe('TANF');
      expect(household.size).toBe(3);
    });
  });

  describe('Deductions', () => {
    it('should apply medical deduction for elderly household', () => {
      const household = marylandHouseholds.elderlyCouple;
      
      expect(household.hasElderly).toBe(true);
      expect(household.medicalExpenses).toBe(40000); // $400 in cents
      expect(household.size).toBe(2);
    });

    it('should apply dependent care deduction', () => {
      const household = marylandHouseholds.familyWithChildren;
      
      expect(household.dependentCareExpenses).toBe(60000); // $600 in cents
      expect(household.size).toBe(4);
    });

    it('should apply shelter deduction', () => {
      const household = marylandHouseholds.highShelterCosts;
      
      expect(household.shelterCosts).toBe(180000); // $1,800 in cents
      expect(household.grossMonthlyIncome).toBe(250000); // $2,500
      
      // Shelter costs are 72% of income (high)
      const shelterPercentage = ((household.shelterCosts || 0) / household.grossMonthlyIncome) * 100;
      expect(shelterPercentage).toBeGreaterThan(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero income household', () => {
      const household = marylandHouseholds.zeroIncome;
      
      expect(household.grossMonthlyIncome).toBe(0);
      expect(household.earnedIncome).toBe(0);
      expect(household.unearnedIncome).toBe(0);
    });

    it('should handle mixed income sources', () => {
      const household = marylandHouseholds.mixedIncome;
      
      expect(household.earnedIncome).toBe(180000); // $1,800
      expect(household.unearnedIncome).toBe(100000); // $1,000
      expect(household.grossMonthlyIncome).toBe(280000); // $2,800 total
    });

    it('should handle large family (8 members)', () => {
      const household = marylandHouseholds.largeFamilyEightMembers;
      
      expect(household.size).toBe(8);
      expect(household.dependentCareExpenses).toBe(120000); // $1,200
    });
  });

  describe('Borderline Cases', () => {
    it('should be eligible just under gross limit', () => {
      const household = marylandHouseholds.borderlineEligible;
      
      expect(household.grossMonthlyIncome).toBe(210000); // $2,100
      expect(household.size).toBe(1);
    });

    it('should be ineligible just over gross limit', () => {
      const household = marylandHouseholds.borderlineIneligible;
      
      expect(household.grossMonthlyIncome).toBe(220000); // $2,200
      expect(household.size).toBe(1);
    });
  });

  describe('Test Helper Functions', () => {
    it('should convert dollars to cents correctly', () => {
      expect(toCents(15.50)).toBe(1550);
      expect(toCents(1500)).toBe(150000);
      expect(toCents(0.01)).toBe(1);
    });

    it('should format currency correctly', () => {
      expect(formatCurrency(150000)).toBe('$1,500.00');
      expect(formatCurrency(1550)).toBe('$15.50');
    });

    it('should assert values within range', () => {
      expect(() => assertWithinRange(100, 100, 0)).not.toThrow();
      expect(() => assertWithinRange(99, 100, 1)).not.toThrow();
      expect(() => assertWithinRange(101, 100, 1)).not.toThrow();
      expect(() => assertWithinRange(95, 100, 1)).toThrow();
    });
  });
});
