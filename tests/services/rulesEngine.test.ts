import { describe, it, expect, beforeEach, vi } from 'vitest';
import { marylandHouseholds } from '../fixtures';
import type { HouseholdInput } from '../../server/services/rulesEngine';

// Mock data based on Maryland FY 2025 SNAP rules
const mockIncomeLimits = {
  1: { id: 'limit-1', grossMonthlyLimit: 230100, netMonthlyLimit: 115050, householdSize: 1, benefitProgramId: 'test-snap', isActive: true, effectiveDate: new Date('2024-10-01'), endDate: new Date('2025-09-30'), percentOfPoverty: 200 },
  2: { id: 'limit-2', grossMonthlyLimit: 310900, netMonthlyLimit: 155450, householdSize: 2, benefitProgramId: 'test-snap', isActive: true, effectiveDate: new Date('2024-10-01'), endDate: new Date('2025-09-30'), percentOfPoverty: 200 },
  3: { id: 'limit-3', grossMonthlyLimit: 391700, netMonthlyLimit: 195850, householdSize: 3, benefitProgramId: 'test-snap', isActive: true, effectiveDate: new Date('2024-10-01'), endDate: new Date('2025-09-30'), percentOfPoverty: 200 },
  4: { id: 'limit-4', grossMonthlyLimit: 472500, netMonthlyLimit: 236250, householdSize: 4, benefitProgramId: 'test-snap', isActive: true, effectiveDate: new Date('2024-10-01'), endDate: new Date('2025-09-30'), percentOfPoverty: 200 },
  8: { id: 'limit-8', grossMonthlyLimit: 795700, netMonthlyLimit: 397850, householdSize: 8, benefitProgramId: 'test-snap', isActive: true, effectiveDate: new Date('2024-10-01'), endDate: new Date('2025-09-30'), percentOfPoverty: 200 },
};

const mockDeductions = [
  { id: 'deduction-standard', deductionType: 'standard', amount: 19300, percentage: null, minAmount: null, maxAmount: null },
  { id: 'deduction-earned', deductionType: 'earned_income', amount: null, percentage: 20, minAmount: null, maxAmount: null },
  { id: 'deduction-dependent', deductionType: 'dependent_care', amount: null, percentage: null, minAmount: null, maxAmount: 20000000 },
  { id: 'deduction-medical', deductionType: 'medical', amount: null, percentage: null, minAmount: 3500, maxAmount: null },
  { id: 'deduction-shelter', deductionType: 'shelter', amount: null, percentage: null, minAmount: null, maxAmount: 67700 },
];

const mockAllotments = {
  1: { id: 'allotment-1', maxMonthlyBenefit: 29100, minMonthlyBenefit: 2300, householdSize: 1, benefitProgramId: 'test-snap', isActive: true, effectiveDate: new Date('2024-10-01'), endDate: new Date('2025-09-30') },
  2: { id: 'allotment-2', maxMonthlyBenefit: 53500, minMonthlyBenefit: 2300, householdSize: 2, benefitProgramId: 'test-snap', isActive: true, effectiveDate: new Date('2024-10-01'), endDate: new Date('2025-09-30') },
  3: { id: 'allotment-3', maxMonthlyBenefit: 76600, minMonthlyBenefit: null, householdSize: 3, benefitProgramId: 'test-snap', isActive: true, effectiveDate: new Date('2024-10-01'), endDate: new Date('2025-09-30') },
  4: { id: 'allotment-4', maxMonthlyBenefit: 97500, minMonthlyBenefit: null, householdSize: 4, benefitProgramId: 'test-snap', isActive: true, effectiveDate: new Date('2024-10-01'), endDate: new Date('2025-09-30') },
  8: { id: 'allotment-8', maxMonthlyBenefit: 175400, minMonthlyBenefit: null, householdSize: 8, benefitProgramId: 'test-snap', isActive: true, effectiveDate: new Date('2024-10-01'), endDate: new Date('2025-09-30') },
};

const mockCategoricalRules = {
  SSI: { id: 'categorical-ssi', ruleName: 'SSI Recipients', ruleCode: 'SSI', bypassGrossIncomeTest: true, bypassNetIncomeTest: false, benefitProgramId: 'test-snap', isActive: true },
  TANF: { id: 'categorical-tanf', ruleName: 'TANF Recipients', ruleCode: 'TANF', bypassGrossIncomeTest: true, bypassNetIncomeTest: false, benefitProgramId: 'test-snap', isActive: true },
  GA: { id: 'categorical-ga', ruleName: 'General Assistance Recipients', ruleCode: 'GA', bypassGrossIncomeTest: true, bypassNetIncomeTest: false, benefitProgramId: 'test-snap', isActive: true },
  BBCE: { id: 'categorical-bbce', ruleName: 'Broad-Based Categorical Eligibility', ruleCode: 'BBCE', bypassGrossIncomeTest: false, bypassNetIncomeTest: false, benefitProgramId: 'test-snap', isActive: true },
};

// Track household size and categorical eligibility for current test
let currentHouseholdSize = 1;
let currentCategoricalEligibility: string | undefined;
let queryCallCount = 0;

// Mock the database module
vi.mock('../../server/db', () => {
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => {
              queryCallCount++;
              const callNum = queryCallCount;
              
              // Call sequence in calculateEligibility:
              // 1. getActiveIncomeLimits - returns income limit (with .limit())
              // 2. getActiveDeductions - returns deductions array (no .limit(), direct await)
              // 3. getActiveAllotment - returns allotment (with .limit())
              // 4. getCategoricalEligibilityRule - returns categorical rule (with .limit())
              
              // Deductions query (call #2) - returns directly
              if (callNum === 2) {
                return Promise.resolve(mockDeductions);
              }
              
              // Other queries return object with .limit()
              return {
                limit: () => {
                  if (callNum === 1) {
                    // Income limits
                    return Promise.resolve([mockIncomeLimits[currentHouseholdSize] || mockIncomeLimits[1]]);
                  } else if (callNum === 3) {
                    // Allotments
                    return Promise.resolve([mockAllotments[currentHouseholdSize] || mockAllotments[1]]);
                  } else if (callNum === 4) {
                    // Categorical eligibility
                    if (currentCategoricalEligibility && mockCategoricalRules[currentCategoricalEligibility]) {
                      return Promise.resolve([mockCategoricalRules[currentCategoricalEligibility]]);
                    }
                    return Promise.resolve([]);
                  }
                  return Promise.resolve([]);
                },
              };
            },
          }),
        }),
      }),
    },
  };
});

describe('Maryland SNAP Rules Engine', () => {
  // Import rulesEngine locally in each test
  let rulesEngine: any;
  const TEST_BENEFIT_PROGRAM_ID = 'test-md-snap-program-id';

  beforeEach(async () => {
    // Reset to defaults
    currentHouseholdSize = 1;
    currentCategoricalEligibility = undefined;
    queryCallCount = 0; // Reset query counter
    
    // Import rulesEngine with mocked db
    const module = await import('../../server/services/rulesEngine');
    rulesEngine = module.rulesEngine;
  });

  // Helper to setup test context
  const setupMock = (size: number, categoricalEligibility?: string) => {
    currentHouseholdSize = size;
    currentCategoricalEligibility = categoricalEligibility;
    queryCallCount = 0; // Reset query counter for this test
  };

  // ============================================================================
  // GROSS INCOME TESTS
  // ============================================================================
  
  describe('Gross Income Tests', () => {
    it('should pass gross income test for eligible single adult (household size 1)', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.grossIncomeTest.passed).toBe(true);
      expect(result.grossIncomeTest.actual).toBe(household.grossMonthlyIncome);
      expect(result.grossIncomeTest.limit).toBe(230100); // $2,301
      expect(result.grossIncomeTest.actual).toBeLessThanOrEqual(result.grossIncomeTest.limit);
    });

    it('should pass gross income test for household size 2', async () => {
      setupMock(2);
      const household: HouseholdInput = {
        size: 2,
        grossMonthlyIncome: 300000, // $3,000
        earnedIncome: 300000,
        unearnedIncome: 0,
        shelterCosts: 100000,
      };
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.grossIncomeTest.passed).toBe(true);
      expect(result.grossIncomeTest.limit).toBe(310900); // $3,109
    });

    it('should pass gross income test for household size 4', async () => {
      setupMock(4);
      const household = marylandHouseholds.familyWithChildren;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.grossIncomeTest.passed).toBe(true);
      expect(result.grossIncomeTest.limit).toBe(472500); // $4,725
    });

    it('should pass gross income test for large household size 8', async () => {
      setupMock(8);
      const household = marylandHouseholds.largeFamilyEightMembers;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.grossIncomeTest.passed).toBe(true);
      expect(result.grossIncomeTest.limit).toBe(795700); // $7,957
    });

    it('should fail gross income test for high income household', async () => {
      setupMock(2);
      const household = marylandHouseholds.highIncome;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.grossIncomeTest.passed).toBe(false);
      expect(result.isEligible).toBe(false);
      expect(result.ineligibilityReasons).toBeDefined();
      expect(result.ineligibilityReasons!.some(r => r.includes('Gross income'))).toBe(true);
    });

    it('should bypass gross income test for elderly household even with high income', async () => {
      setupMock(2);
      const household: HouseholdInput = {
        size: 2,
        grossMonthlyIncome: 400000, // $4,000 - over limit
        earnedIncome: 0,
        unearnedIncome: 400000,
        hasElderly: true,
        shelterCosts: 100000,
      };
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.grossIncomeTest.passed).toBe(true);
      expect(result.grossIncomeTest.bypassedBy).toBe('Elderly/Disabled Exemption');
    });

    it('should bypass gross income test for disabled household', async () => {
      setupMock(1);
      const household: HouseholdInput = {
        size: 1,
        grossMonthlyIncome: 300000, // $3,000 - over limit
        earnedIncome: 0,
        unearnedIncome: 300000,
        hasDisabled: true,
        shelterCosts: 70000,
      };
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.grossIncomeTest.passed).toBe(true);
      expect(result.grossIncomeTest.bypassedBy).toBe('Elderly/Disabled Exemption');
    });

    it('should handle zero income household', async () => {
      setupMock(1);
      const household = marylandHouseholds.zeroIncome;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.grossIncomeTest.passed).toBe(true);
      expect(result.grossIncomeTest.actual).toBe(0);
      expect(result.isEligible).toBe(true);
    });
  });

  // ============================================================================
  // NET INCOME TESTS
  // ============================================================================
  
  describe('Net Income Tests', () => {
    it('should calculate net income correctly after deductions', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      const expectedNet = Math.max(0, household.grossMonthlyIncome - result.deductions.total);
      expect(result.netIncomeTest.actual).toBe(expectedNet);
    });

    it('should pass net income test when net income is below limit', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.netIncomeTest.passed).toBe(true);
      expect(result.netIncomeTest.actual).toBeLessThanOrEqual(result.netIncomeTest.limit);
      expect(result.netIncomeTest.limit).toBe(115050); // $1,150.50 for size 1
    });

    it('should fail net income test when net income exceeds limit', async () => {
      setupMock(1);
      const household: HouseholdInput = {
        size: 1,
        grossMonthlyIncome: 200000, // $2,000
        earnedIncome: 200000,
        unearnedIncome: 0,
        shelterCosts: 0, // No deductions except standard and earned income
      };
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      // Net income = $2,000 - $193 (standard) - $400 (20% earned) = $1,407
      // This exceeds the $1,150.50 limit
      expect(result.netIncomeTest.passed).toBe(false);
      expect(result.isEligible).toBe(false);
    });
  });

  // ============================================================================
  // STANDARD DEDUCTION TESTS
  // ============================================================================
  
  describe('Standard Deduction Tests', () => {
    it('should apply standard deduction for household size 1-3', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.deductions.standardDeduction).toBe(19300); // $193
    });

    it('should apply standard deduction for household size 2', async () => {
      setupMock(2);
      const household: HouseholdInput = {
        size: 2,
        grossMonthlyIncome: 200000,
        earnedIncome: 200000,
        unearnedIncome: 0,
        shelterCosts: 100000,
      };
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.deductions.standardDeduction).toBe(19300); // $193 (same for 1-3)
    });

    it('should automatically apply standard deduction to all households', async () => {
      setupMock(4);
      const household = marylandHouseholds.familyWithChildren;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.deductions.standardDeduction).toBeGreaterThan(0);
      expect(result.calculationBreakdown.some(line => line.includes('Standard deduction'))).toBe(true);
    });
  });

  // ============================================================================
  // EARNED INCOME DEDUCTION TESTS
  // ============================================================================
  
  describe('Earned Income Deduction Tests', () => {
    it('should apply 20% earned income deduction', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      const expected = Math.floor(household.earnedIncome * 0.20);
      expect(result.deductions.earnedIncomeDeduction).toBe(expected);
      expect(result.deductions.earnedIncomeDeduction).toBe(30000); // 20% of $1,500
    });

    it('should handle mixed earned and unearned income correctly', async () => {
      setupMock(2);
      const household = marylandHouseholds.mixedIncome;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      // Should only deduct 20% of EARNED income, not unearned
      const expectedEarnedDeduction = Math.floor(household.earnedIncome * 0.20);
      expect(result.deductions.earnedIncomeDeduction).toBe(expectedEarnedDeduction);
      expect(result.deductions.earnedIncomeDeduction).toBe(36000); // 20% of $1,800
    });

    it('should not apply earned income deduction when income is all unearned', async () => {
      setupMock(1);
      const household: HouseholdInput = {
        size: 1,
        grossMonthlyIncome: 100000, // $1,000
        earnedIncome: 0,
        unearnedIncome: 100000, // All unearned (SSI, etc.)
        shelterCosts: 60000,
      };
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.deductions.earnedIncomeDeduction).toBe(0);
    });
  });

  // ============================================================================
  // SHELTER DEDUCTION TESTS
  // ============================================================================
  
  describe('Shelter Deduction Tests', () => {
    it('should calculate excess shelter deduction correctly', async () => {
      setupMock(3);
      const household = marylandHouseholds.highShelterCosts;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.deductions.shelterDeduction).toBeGreaterThan(0);
      
      // Verify calculation: shelter costs - 50% of income after other deductions
      const incomeAfterOtherDeductions = household.grossMonthlyIncome - (
        result.deductions.standardDeduction +
        result.deductions.earnedIncomeDeduction +
        result.deductions.dependentCareDeduction +
        result.deductions.medicalExpenseDeduction
      );
      const halfIncome = Math.floor(incomeAfterOtherDeductions / 2);
      const excessShelter = Math.max(0, household.shelterCosts! - halfIncome);
      
      expect(result.deductions.shelterDeduction).toBeLessThanOrEqual(excessShelter);
    });

    it('should apply shelter deduction cap for non-elderly/disabled households', async () => {
      setupMock(3);
      const household: HouseholdInput = {
        size: 3,
        grossMonthlyIncome: 250000, // $2,500
        earnedIncome: 250000,
        unearnedIncome: 0,
        hasElderly: false,
        hasDisabled: false,
        shelterCosts: 200000, // $2,000 - very high
      };
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      // Should be capped at $677 for non-elderly/disabled
      expect(result.deductions.shelterDeduction).toBeLessThanOrEqual(67700);
    });

    it('should not cap shelter deduction for elderly households', async () => {
      setupMock(2);
      const household = marylandHouseholds.elderlyCouple;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      // Elderly households have no shelter cap
      if (household.shelterCosts) {
        const incomeAfterOtherDeductions = household.grossMonthlyIncome - (
          result.deductions.standardDeduction +
          result.deductions.earnedIncomeDeduction +
          result.deductions.dependentCareDeduction +
          result.deductions.medicalExpenseDeduction
        );
        const halfIncome = Math.floor(incomeAfterOtherDeductions / 2);
        const excessShelter = Math.max(0, household.shelterCosts - halfIncome);
        
        expect(result.deductions.shelterDeduction).toBe(excessShelter);
      }
    });

    it('should handle zero shelter costs', async () => {
      setupMock(1);
      const household: HouseholdInput = {
        size: 1,
        grossMonthlyIncome: 150000,
        earnedIncome: 150000,
        unearnedIncome: 0,
        shelterCosts: 0,
      };
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.deductions.shelterDeduction).toBe(0);
    });
  });

  // ============================================================================
  // MEDICAL EXPENSE DEDUCTION TESTS
  // ============================================================================
  
  describe('Medical Expense Deduction Tests', () => {
    it('should apply medical deduction for elderly household with expenses over $35', async () => {
      setupMock(2);
      const household = marylandHouseholds.elderlyCouple;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      // Medical expenses over $35 threshold
      const expectedDeduction = (household.medicalExpenses || 0) - 3500;
      expect(result.deductions.medicalExpenseDeduction).toBe(expectedDeduction);
      expect(result.deductions.medicalExpenseDeduction).toBeGreaterThan(0);
    });

    it('should apply medical deduction for disabled household', async () => {
      setupMock(1);
      const household = marylandHouseholds.disabledAdult;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      // Medical expenses over $35 threshold
      const expectedDeduction = (household.medicalExpenses || 0) - 3500;
      expect(result.deductions.medicalExpenseDeduction).toBe(expectedDeduction);
      expect(result.deductions.medicalExpenseDeduction).toBe(21500); // $250 - $35 = $215
    });

    it('should not apply medical deduction when expenses are under $35 threshold', async () => {
      setupMock(1);
      const household: HouseholdInput = {
        size: 1,
        grossMonthlyIncome: 100000,
        earnedIncome: 0,
        unearnedIncome: 100000,
        hasElderly: true,
        shelterCosts: 60000,
        medicalExpenses: 3000, // $30 - under $35 threshold
      };
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.deductions.medicalExpenseDeduction).toBe(0);
    });
  });

  // ============================================================================
  // DEPENDENT CARE DEDUCTION TESTS
  // ============================================================================
  
  describe('Dependent Care Deduction Tests', () => {
    it('should apply dependent care deduction for working household with childcare', async () => {
      setupMock(4);
      const household = marylandHouseholds.familyWithChildren;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.deductions.dependentCareDeduction).toBe(household.dependentCareExpenses);
      expect(result.deductions.dependentCareDeduction).toBe(60000); // $600
    });

    it('should not apply dependent care deduction when expenses are zero', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.deductions.dependentCareDeduction).toBe(0);
    });
  });

  // ============================================================================
  // CATEGORICAL ELIGIBILITY TESTS
  // ============================================================================
  
  describe('Categorical Eligibility Tests', () => {
    it('should bypass gross income test for SSI recipients', async () => {
      setupMock(1, 'SSI');
      const household = marylandHouseholds.elderlySsi;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.grossIncomeTest.bypassedBy).toBe('SSI Recipients');
      expect(result.grossIncomeTest.passed).toBe(true);
    });

    it('should bypass gross income test for TANF recipients', async () => {
      setupMock(3, 'TANF');
      const household = marylandHouseholds.tanfRecipient;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.grossIncomeTest.bypassedBy).toBe('TANF Recipients');
      expect(result.grossIncomeTest.passed).toBe(true);
    });

    it('should bypass gross income test for GA recipients', async () => {
      setupMock(1, 'GA');
      const household: HouseholdInput = {
        size: 1,
        grossMonthlyIncome: 80000,
        earnedIncome: 0,
        unearnedIncome: 80000,
        categoricalEligibility: 'GA',
        shelterCosts: 60000,
      };
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.grossIncomeTest.bypassedBy).toBe('General Assistance Recipients');
      expect(result.grossIncomeTest.passed).toBe(true);
    });

    it('should handle BBCE (Broad-Based Categorical Eligibility)', async () => {
      setupMock(3, 'BBCE');
      const household = marylandHouseholds.bbceEligible;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      // BBCE does NOT bypass gross income test in Maryland
      expect(result.grossIncomeTest.bypassedBy).toBeUndefined();
      // But household should still be eligible if income is within limits
      expect(result.grossIncomeTest.passed).toBe(true);
    });

    it('should not bypass income tests for households without categorical eligibility', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.grossIncomeTest.bypassedBy).toBeUndefined();
      expect(result.netIncomeTest.bypassedBy).toBeUndefined();
    });
  });

  // ============================================================================
  // BENEFIT CALCULATION TESTS
  // ============================================================================
  
  describe('Benefit Amount Calculation', () => {
    it('should calculate SNAP benefit amount correctly', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      if (result.isEligible) {
        // Benefit = Max Allotment - (30% of net income)
        const thirtyPercentOfNet = Math.floor(result.netIncomeTest.actual * 0.30);
        const expectedBenefit = Math.max(0, result.maxAllotment - thirtyPercentOfNet);
        
        expect(result.monthlyBenefit).toBe(expectedBenefit);
        expect(result.monthlyBenefit).toBeGreaterThan(0);
        expect(result.monthlyBenefit).toBeLessThanOrEqual(result.maxAllotment);
      }
    });

    it('should set benefit to max allotment for zero income household', async () => {
      setupMock(1);
      const household = marylandHouseholds.zeroIncome;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.isEligible).toBe(true);
      expect(result.monthlyBenefit).toBe(result.maxAllotment);
      expect(result.monthlyBenefit).toBe(29100); // $291 for size 1
    });

    it('should calculate correct max allotment for household size 4', async () => {
      setupMock(4);
      const household = marylandHouseholds.familyWithChildren;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.maxAllotment).toBe(97500); // $975 for size 4
    });

    it('should apply minimum benefit for eligible 1-2 person elderly/disabled households', async () => {
      setupMock(1);
      const household: HouseholdInput = {
        size: 1,
        grossMonthlyIncome: 110000, // $1,100
        earnedIncome: 110000,
        unearnedIncome: 0,
        hasElderly: true,
        shelterCosts: 50000,
      };
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      if (result.isEligible && result.monthlyBenefit > 0) {
        // Should be at least minimum benefit ($23) for 1-2 person elderly/disabled
        expect(result.monthlyBenefit).toBeGreaterThanOrEqual(2300);
      }
    });
  });

  // ============================================================================
  // EDGE CASES AND ERROR HANDLING
  // ============================================================================
  
  describe('Edge Cases', () => {
    it('should handle borderline household (passes gross but fails net income test)', async () => {
      setupMock(1);
      const household = marylandHouseholds.borderlineEligible;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      // Passes gross income test (under $2,301)
      expect(result.grossIncomeTest.passed).toBe(true);
      // But fails net income test (after deductions, still over $1,150.50)
      expect(result.netIncomeTest.passed).toBe(false);
      expect(result.isEligible).toBe(false);
    });

    it('should reject household with income just over net limit', async () => {
      setupMock(1);
      const household = marylandHouseholds.borderlineIneligible;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      // Passes gross income test (under $2,301)
      expect(result.grossIncomeTest.passed).toBe(true);
      // But fails net income test
      expect(result.netIncomeTest.passed).toBe(false);
      expect(result.isEligible).toBe(false);
    });

    it('should handle large family (8 members) correctly', async () => {
      setupMock(8);
      const household = marylandHouseholds.largeFamilyEightMembers;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.maxAllotment).toBe(175400); // $1,754 for size 8
      expect(result.grossIncomeTest.limit).toBe(795700); // $7,957
    });

    it('should provide detailed ineligibility reasons', async () => {
      setupMock(2);
      const household = marylandHouseholds.highIncome;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.isEligible).toBe(false);
      expect(result.ineligibilityReasons).toBeDefined();
      expect(result.ineligibilityReasons!.length).toBeGreaterThan(0);
      expect(result.reason).toContain('income');
    });

    it('should handle household with all types of deductions', async () => {
      setupMock(2);
      const household: HouseholdInput = {
        size: 2,
        grossMonthlyIncome: 250000, // $2,500
        earnedIncome: 200000, // $2,000
        unearnedIncome: 50000, // $500
        hasElderly: true,
        hasDisabled: false,
        shelterCosts: 120000, // $1,200
        medicalExpenses: 10000, // $100
        dependentCareExpenses: 40000, // $400
      };
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.deductions.standardDeduction).toBeGreaterThan(0);
      expect(result.deductions.earnedIncomeDeduction).toBeGreaterThan(0);
      expect(result.deductions.dependentCareDeduction).toBeGreaterThan(0);
      expect(result.deductions.medicalExpenseDeduction).toBeGreaterThan(0);
      expect(result.deductions.shelterDeduction).toBeGreaterThan(0);
      expect(result.deductions.total).toBe(
        result.deductions.standardDeduction +
        result.deductions.earnedIncomeDeduction +
        result.deductions.dependentCareDeduction +
        result.deductions.medicalExpenseDeduction +
        result.deductions.shelterDeduction
      );
    });
  });

  // ============================================================================
  // POLICY CITATIONS TESTS
  // ============================================================================
  
  describe('Policy Citations', () => {
    it('should include policy citations in results', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.policyCitations).toBeDefined();
      expect(result.policyCitations.length).toBeGreaterThan(0);
    });

    it('should include section numbers and titles in citations', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      result.policyCitations.forEach(citation => {
        expect(citation).toHaveProperty('sectionNumber');
        expect(citation).toHaveProperty('sectionTitle');
        expect(citation).toHaveProperty('ruleType');
        expect(citation).toHaveProperty('description');
      });
    });

    it('should include appropriate citations for categorical eligibility', async () => {
      setupMock(1, 'SSI');
      const household = marylandHouseholds.elderlySsi;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      const categoricalCitation = result.policyCitations.find(c => c.ruleType === 'categorical');
      expect(categoricalCitation).toBeDefined();
      expect(categoricalCitation?.description).toContain('categorical eligibility');
    });
  });

  // ============================================================================
  // RULES SNAPSHOT TESTS
  // ============================================================================
  
  describe('Rules Snapshot', () => {
    it('should capture rules snapshot for audit trail', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.rulesSnapshot).toBeDefined();
      expect(result.rulesSnapshot.incomeLimitId).toBeDefined();
      expect(result.rulesSnapshot.allotmentId).toBeDefined();
      expect(result.rulesSnapshot.deductionIds).toBeDefined();
      expect(result.rulesSnapshot.deductionIds.length).toBeGreaterThan(0);
    });

    it('should include categorical rule ID when applicable', async () => {
      setupMock(1, 'SSI');
      const household = marylandHouseholds.elderlySsi;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.rulesSnapshot.categoricalRuleId).toBeDefined();
      expect(result.rulesSnapshot.categoricalRuleId).toBe('categorical-ssi');
    });

    it('should not include categorical rule ID when not applicable', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.rulesSnapshot.categoricalRuleId).toBeUndefined();
    });
  });

  // ============================================================================
  // CALCULATION BREAKDOWN TESTS
  // ============================================================================
  
  describe('Calculation Breakdown', () => {
    it('should provide detailed calculation breakdown', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.calculationBreakdown).toBeDefined();
      expect(result.calculationBreakdown.length).toBeGreaterThan(0);
      expect(result.calculationBreakdown.some(line => line.includes('Household size'))).toBe(true);
      expect(result.calculationBreakdown.some(line => line.includes('Gross monthly income'))).toBe(true);
    });

    it('should include deduction details in breakdown', async () => {
      setupMock(4);
      const household = marylandHouseholds.familyWithChildren;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      expect(result.calculationBreakdown.some(line => line.includes('Standard deduction'))).toBe(true);
      expect(result.calculationBreakdown.some(line => line.includes('Earned income deduction'))).toBe(true);
      expect(result.calculationBreakdown.some(line => line.includes('Total deductions'))).toBe(true);
    });

    it('should show benefit calculation formula in breakdown', async () => {
      setupMock(1);
      const household = marylandHouseholds.singleAdultWorking;
      
      const result = await rulesEngine.calculateEligibility(TEST_BENEFIT_PROGRAM_ID, household);
      
      if (result.isEligible) {
        expect(result.calculationBreakdown.some(line => line.includes('Benefit calculation'))).toBe(true);
      }
    });
  });
});
