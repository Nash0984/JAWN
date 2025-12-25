import type { TaxHouseholdInput } from '../../../server/services/policyEngineTaxCalculation';

/**
 * Tax Household Test Fixtures for 2024
 * 
 * Representative tax scenarios for federal tax return testing
 * Covers EITC, CTC, filing statuses, and various income situations
 */

export const taxHouseholds2024: Record<string, TaxHouseholdInput> = {
  // Single filer, W-2 wage earner
  singleW2: {
    taxYear: 2024,
    filingStatus: 'single' as const,
    stateCode: 'MD',
    taxpayer: { age: 35 },
    w2Income: {
      taxpayerWages: 45000,
      federalWithholding: 5400,
      socialSecurityWithholding: 2790,
      medicareWithholding: 652.50,
    },
  },
  
  // Married filing jointly with 2 children (EITC eligible)
  marriedWithKidsEitc: {
    taxYear: 2024,
    filingStatus: 'married_joint' as const,
    stateCode: 'MD',
    taxpayer: { age: 32 },
    spouse: { age: 30 },
    dependents: [
      { age: 5, relationship: 'child' as const },
      { age: 3, relationship: 'child' as const },
    ],
    w2Income: {
      taxpayerWages: 35000,
      spouseWages: 28000,
      federalWithholding: 7560,
      socialSecurityWithholding: 3906,
      medicareWithholding: 913.50,
    },
    childcareCosts: 8000, // Eligible for child care credit
  },
  
  // Head of household with 1 child (EITC + CTC)
  headOfHouseholdEitc: {
    taxYear: 2024,
    filingStatus: 'head_of_household' as const,
    stateCode: 'MD',
    taxpayer: { age: 28 },
    dependents: [{ age: 6, relationship: 'child' as const }],
    w2Income: {
      taxpayerWages: 42000,
      federalWithholding: 5040,
      socialSecurityWithholding: 2604,
      medicareWithholding: 609,
    },
  },

  // Low-income single parent (maximum EITC)
  lowIncomeSingleParent: {
    taxYear: 2024,
    filingStatus: 'head_of_household' as const,
    stateCode: 'MD',
    taxpayer: { age: 26 },
    dependents: [
      { age: 4, relationship: 'child' as const },
      { age: 2, relationship: 'child' as const },
    ],
    w2Income: {
      taxpayerWages: 18000, // Optimal for EITC with 2 kids
      federalWithholding: 1080,
      socialSecurityWithholding: 1116,
      medicareWithholding: 261,
    },
  },

  // High earner single filer (no EITC/CTC)
  highEarnerSingle: {
    taxYear: 2024,
    filingStatus: 'single' as const,
    stateCode: 'MD',
    taxpayer: { age: 45 },
    w2Income: {
      taxpayerWages: 120000,
      federalWithholding: 28800,
      socialSecurityWithholding: 7440, // Max SS wage base
      medicareWithholding: 1740,
    },
    capitalGains: 5000,
    dividendIncome: 2500,
  },

  // Self-employed single filer
  selfEmployedSingle: {
    taxYear: 2024,
    filingStatus: 'single' as const,
    stateCode: 'MD',
    taxpayer: { age: 38 },
    selfEmploymentIncome: {
      gross: 65000,
      expenses: 15000, // Schedule C deductions
    },
  },

  // Retiree with Social Security and pension
  retireeSingleWithPension: {
    taxYear: 2024,
    filingStatus: 'single' as const,
    stateCode: 'MD',
    taxpayer: { age: 68 },
    socialSecurityBenefits: 24000, // Annual SS
    pensionDistributions: {
      total: 30000,
      taxable: 30000,
    },
    iraDistributions: {
      total: 12000,
      taxable: 12000,
    },
  },

  // Married couple with education expenses
  marriedWithEducation: {
    taxYear: 2024,
    filingStatus: 'married_joint' as const,
    stateCode: 'MD',
    taxpayer: { age: 40 },
    spouse: { age: 38 },
    dependents: [{ age: 19, relationship: 'child' as const, studentStatus: 'full_time' as const }],
    w2Income: {
      taxpayerWages: 55000,
      spouseWages: 48000,
      federalWithholding: 12360,
      socialSecurityWithholding: 6386,
      medicareWithholding: 1493.50,
    },
    educationExpenses: 6000, // American Opportunity Credit eligible
  },

  // Married with ACA health insurance (Premium Tax Credit)
  marriedWithAca: {
    taxYear: 2024,
    filingStatus: 'married_joint' as const,
    stateCode: 'MD',
    taxpayer: { age: 35 },
    spouse: { age: 33 },
    dependents: [{ age: 7, relationship: 'child' as const }],
    w2Income: {
      taxpayerWages: 52000,
      federalWithholding: 6240,
      socialSecurityWithholding: 3224,
      medicareWithholding: 754,
    },
    healthInsurance: {
      monthlyPremium: 800,
      slcspPremium: 900, // Second Lowest Cost Silver Plan
      aptcReceived: 4800, // Advance Premium Tax Credit ($400/mo)
    },
  },

  // Single with unemployment compensation
  singleWithUnemployment: {
    taxYear: 2024,
    filingStatus: 'single' as const,
    stateCode: 'MD',
    taxpayer: { age: 42 },
    w2Income: {
      taxpayerWages: 25000,
      federalWithholding: 3000,
      socialSecurityWithholding: 1550,
      medicareWithholding: 362.50,
    },
    unemploymentCompensation: 8000,
  },

  // Married filing separately (edge case)
  marriedFilingSeparately: {
    taxYear: 2024,
    filingStatus: 'married_separate' as const,
    stateCode: 'MD',
    taxpayer: { age: 50 },
    w2Income: {
      taxpayerWages: 60000,
      federalWithholding: 7200,
      socialSecurityWithholding: 3720,
      medicareWithholding: 870,
    },
  },

  // Qualifying widow(er) with dependent child
  qualifyingWidow: {
    taxYear: 2024,
    filingStatus: 'qualifying_widow' as const,
    stateCode: 'MD',
    taxpayer: { age: 48 },
    dependents: [{ age: 12, relationship: 'child' as const }],
    w2Income: {
      taxpayerWages: 58000,
      federalWithholding: 6960,
      socialSecurityWithholding: 3596,
      medicareWithholding: 841,
    },
  },

  // Married with itemized deductions (high state tax, mortgage)
  marriedItemized: {
    taxYear: 2024,
    filingStatus: 'married_joint' as const,
    stateCode: 'MD',
    taxpayer: { age: 52 },
    spouse: { age: 50 },
    w2Income: {
      taxpayerWages: 95000,
      spouseWages: 85000,
      federalWithholding: 21600,
      socialSecurityWithholding: 11160,
      medicareWithholding: 2610,
    },
    mortgageInterest: 15000,
    charitableContributions: 8000,
  },

  // Low-income elderly couple (special standard deduction)
  elderlyCoupleLowIncome: {
    taxYear: 2024,
    filingStatus: 'married_joint' as const,
    stateCode: 'MD',
    taxpayer: { age: 67, isBlind: false },
    spouse: { age: 70, isBlind: false },
    socialSecurityBenefits: 36000, // Annual SS for both
    w2Income: {
      taxpayerWages: 12000, // Part-time work
      federalWithholding: 720,
      socialSecurityWithholding: 744,
      medicareWithholding: 174,
    },
  },

  // Three children (maximum CTC scenario)
  marriedThreeKids: {
    taxYear: 2024,
    filingStatus: 'married_joint' as const,
    stateCode: 'MD',
    taxpayer: { age: 36 },
    spouse: { age: 34 },
    dependents: [
      { age: 8, relationship: 'child' as const },
      { age: 5, relationship: 'child' as const },
      { age: 2, relationship: 'child' as const },
    ],
    w2Income: {
      taxpayerWages: 72000,
      spouseWages: 58000,
      federalWithholding: 15600,
      socialSecurityWithholding: 8060,
      medicareWithholding: 1885,
    },
    childcareCosts: 12000, // $1000/mo for 3 kids
  },

  // Single with disabled dependent
  singleWithDisabledDependent: {
    taxYear: 2024,
    filingStatus: 'head_of_household' as const,
    stateCode: 'MD',
    taxpayer: { age: 44 },
    dependents: [{ age: 15, relationship: 'child' as const, disabilityStatus: true }],
    w2Income: {
      taxpayerWages: 48000,
      federalWithholding: 5760,
      socialSecurityWithholding: 2976,
      medicareWithholding: 696,
    },
    medicalExpenses: 8000, // High medical for disabled child
  },
};
