import type { HouseholdInput } from '../../../server/services/rulesEngine';

/**
 * Maryland SNAP Household Test Fixtures
 * 
 * Representative household scenarios for SNAP eligibility testing
 * All monetary values are in CENTS (not dollars)
 * Based on 2024 Maryland SNAP rules
 */

export const marylandHouseholds: Record<string, HouseholdInput> = {
  // Single adult, working poor (eligible)
  singleAdultWorking: {
    size: 1,
    grossMonthlyIncome: 150000, // $1,500 in cents
    earnedIncome: 150000,
    unearnedIncome: 0,
    hasElderly: false,
    hasDisabled: false,
    shelterCosts: 80000, // $800 rent
    dependentCareExpenses: 0,
    medicalExpenses: 0,
  },
  
  // Family with 2 children (eligible)
  familyWithChildren: {
    size: 4, // 2 adults + 2 children
    grossMonthlyIncome: 350000, // $3,500
    earnedIncome: 350000,
    unearnedIncome: 0,
    hasElderly: false,
    hasDisabled: false,
    shelterCosts: 150000, // $1,500
    dependentCareExpenses: 60000, // $600 childcare
    medicalExpenses: 0,
  },
  
  // Elderly person with SSI (categorically eligible)
  elderlySsi: {
    size: 1,
    grossMonthlyIncome: 91400, // $914 SSI
    earnedIncome: 0,
    unearnedIncome: 91400,
    hasElderly: true,
    hasDisabled: false,
    shelterCosts: 60000,
    medicalExpenses: 15000, // $150 medical costs
    categoricalEligibility: 'SSI',
  },
  
  // Disabled adult (eligible with medical deductions)
  disabledAdult: {
    size: 1,
    grossMonthlyIncome: 130000, // $1,300 SSDI
    earnedIncome: 0,
    unearnedIncome: 130000,
    hasElderly: false,
    hasDisabled: true,
    shelterCosts: 70000,
    medicalExpenses: 25000, // $250 medical costs
  },
  
  // High income (ineligible - over gross income limit)
  highIncome: {
    size: 2,
    grossMonthlyIncome: 500000, // $5,000
    earnedIncome: 500000,
    unearnedIncome: 0,
    hasElderly: false,
    hasDisabled: false,
    shelterCosts: 200000,
  },

  // Edge case: Zero income (eligible for minimum benefit)
  zeroIncome: {
    size: 1,
    grossMonthlyIncome: 0,
    earnedIncome: 0,
    unearnedIncome: 0,
    hasElderly: false,
    hasDisabled: false,
    shelterCosts: 50000, // $500 shelter
    dependentCareExpenses: 0,
    medicalExpenses: 0,
  },

  // TANF recipient (categorically eligible)
  tanfRecipient: {
    size: 3,
    grossMonthlyIncome: 80000, // $800 TANF
    earnedIncome: 0,
    unearnedIncome: 80000,
    hasElderly: false,
    hasDisabled: false,
    shelterCosts: 90000, // $900
    categoricalEligibility: 'TANF',
  },

  // Large family (8 members)
  largeFamilyEightMembers: {
    size: 8,
    grossMonthlyIncome: 500000, // $5,000
    earnedIncome: 500000,
    unearnedIncome: 0,
    hasElderly: false,
    hasDisabled: false,
    shelterCosts: 250000, // $2,500
    dependentCareExpenses: 120000, // $1,200
    medicalExpenses: 0,
  },

  // Elderly couple with high medical costs
  elderlyCouple: {
    size: 2,
    grossMonthlyIncome: 200000, // $2,000 combined SSI
    earnedIncome: 0,
    unearnedIncome: 200000,
    hasElderly: true,
    hasDisabled: false,
    shelterCosts: 100000, // $1,000
    medicalExpenses: 40000, // $400 medical costs
  },

  // Mixed income: earned + unearned
  mixedIncome: {
    size: 2,
    grossMonthlyIncome: 280000, // $2,800 total
    earnedIncome: 180000, // $1,800 wages
    unearnedIncome: 100000, // $1,000 SSI
    hasElderly: false,
    hasDisabled: true,
    shelterCosts: 120000, // $1,200
    medicalExpenses: 20000, // $200
  },

  // Borderline ineligible (just over gross limit)
  borderlineIneligible: {
    size: 1,
    grossMonthlyIncome: 220000, // $2,200 (just over limit)
    earnedIncome: 220000,
    unearnedIncome: 0,
    hasElderly: false,
    hasDisabled: false,
    shelterCosts: 80000,
  },

  // Borderline eligible (just under gross limit)
  borderlineEligible: {
    size: 1,
    grossMonthlyIncome: 210000, // $2,100 (just under limit)
    earnedIncome: 210000,
    unearnedIncome: 0,
    hasElderly: false,
    hasDisabled: false,
    shelterCosts: 80000,
  },

  // High shelter costs (excess shelter deduction test)
  highShelterCosts: {
    size: 3,
    grossMonthlyIncome: 250000, // $2,500
    earnedIncome: 250000,
    unearnedIncome: 0,
    hasElderly: false,
    hasDisabled: false,
    shelterCosts: 180000, // $1,800 (high for income level)
    dependentCareExpenses: 0,
    medicalExpenses: 0,
  },

  // Single parent with childcare costs
  singleParentChildcare: {
    size: 2, // parent + child
    grossMonthlyIncome: 220000, // $2,200
    earnedIncome: 220000,
    unearnedIncome: 0,
    hasElderly: false,
    hasDisabled: false,
    shelterCosts: 110000, // $1,100
    dependentCareExpenses: 80000, // $800 childcare
    medicalExpenses: 0,
  },

  // Broad-Based Categorical Eligibility (BBCE)
  bbceEligible: {
    size: 3,
    grossMonthlyIncome: 300000, // $3,000
    earnedIncome: 300000,
    unearnedIncome: 0,
    hasElderly: false,
    hasDisabled: false,
    shelterCosts: 140000, // $1,400
    categoricalEligibility: 'BBCE',
  },
};
