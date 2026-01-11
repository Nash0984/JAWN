import { logger } from "./logger.service";
import { storage } from "../storage";
import type { HouseholdProfile, StateBenefitProgram } from "@shared/schema";

export interface StateEligibilityInput {
  stateCode: string;
  program: "SNAP" | "TANF" | "MEDICAID";
  householdSize: number;
  grossMonthlyIncome: number;
  earnedIncome: number;
  unearnedIncome: number;
  assets?: number;
  hasElderly?: boolean;
  hasDisabled?: boolean;
  shelterCosts?: number;
  dependentCareExpenses?: number;
  medicalExpenses?: number;
  childrenUnder18?: number;
  isPregnant?: boolean;
}

export interface StateEligibilityResult {
  isEligible: boolean;
  program: string;
  stateCode: string;
  stateProgramName: string;
  monthlyBenefit?: number;
  reason?: string;
  ineligibilityReasons?: string[];
  incomeTest: {
    passed: boolean;
    grossLimit?: number;
    netLimit?: number;
    actualGross: number;
    actualNet?: number;
  };
  assetTest?: {
    passed: boolean;
    limit: number;
    actual: number;
  };
  deductions?: {
    standard: number;
    earnedIncome: number;
    dependentCare: number;
    shelter: number;
    medical: number;
    total: number;
  };
  calculationBreakdown: string[];
  policyCitations: Array<{
    code: string;
    title: string;
    description: string;
  }>;
}

const FPL_2025 = {
  1: 15060,
  2: 20440,
  3: 25820,
  4: 31200,
  5: 36580,
  6: 41960,
  7: 47340,
  8: 52720,
  additionalPerson: 5380
};

function getFPL(householdSize: number): number {
  if (householdSize <= 8) {
    return FPL_2025[householdSize as keyof typeof FPL_2025] as number;
  }
  return FPL_2025[8] + (householdSize - 8) * FPL_2025.additionalPerson;
}

function getMonthlyFPLPercent(householdSize: number, percent: number): number {
  return Math.floor((getFPL(householdSize) * percent) / 100 / 12);
}

export class UtahRulesEngine {
  async calculateSNAPEligibility(input: StateEligibilityInput): Promise<StateEligibilityResult> {
    const breakdown: string[] = [];
    const ineligibilityReasons: string[] = [];
    
    breakdown.push(`Utah SNAP Eligibility Calculation`);
    breakdown.push(`Household size: ${input.householdSize}`);
    breakdown.push(`Gross monthly income: $${(input.grossMonthlyIncome / 100).toFixed(2)}`);
    
    const grossLimit = getMonthlyFPLPercent(input.householdSize, 130) * 100;
    const netLimit = getMonthlyFPLPercent(input.householdSize, 100) * 100;
    
    breakdown.push(`Gross income limit (130% FPL): $${(grossLimit / 100).toFixed(2)}`);
    breakdown.push(`Net income limit (100% FPL): $${(netLimit / 100).toFixed(2)}`);
    
    const assetLimit = (input.hasElderly || input.hasDisabled) ? 425000 : 275000;
    let assetTestPassed = true;
    
    if (input.assets !== undefined) {
      if (input.assets > assetLimit) {
        assetTestPassed = false;
        ineligibilityReasons.push(`Assets ($${(input.assets / 100).toFixed(2)}) exceed limit ($${(assetLimit / 100).toFixed(2)})`);
        breakdown.push(`✗ Asset test failed`);
      } else {
        breakdown.push(`✓ Asset test passed: $${(input.assets / 100).toFixed(2)} ≤ $${(assetLimit / 100).toFixed(2)}`);
      }
    }
    
    let grossTestPassed = input.grossMonthlyIncome <= grossLimit;
    if (input.hasElderly || input.hasDisabled) {
      grossTestPassed = true;
      breakdown.push(`✓ Gross income test bypassed (elderly/disabled household)`);
    } else if (!grossTestPassed) {
      ineligibilityReasons.push(`Gross income exceeds 130% FPL limit`);
      breakdown.push(`✗ Gross income test failed`);
    } else {
      breakdown.push(`✓ Gross income test passed`);
    }
    
    const standardDeduction = input.householdSize <= 3 ? 19800 : 
                               input.householdSize === 4 ? 20800 : 
                               input.householdSize === 5 ? 24300 : 27800;
    const earnedIncomeDeduction = Math.floor(input.earnedIncome * 0.20);
    const dependentCareDeduction = Math.min(input.dependentCareExpenses || 0, 20000);
    
    let medicalDeduction = 0;
    if ((input.hasElderly || input.hasDisabled) && input.medicalExpenses) {
      medicalDeduction = Math.max(0, input.medicalExpenses - 3500);
    }
    
    let shelterDeduction = 0;
    if (input.shelterCosts) {
      const incomeAfterDeductions = input.grossMonthlyIncome - standardDeduction - earnedIncomeDeduction - dependentCareDeduction - medicalDeduction;
      const halfIncome = Math.floor(incomeAfterDeductions / 2);
      const excessShelter = Math.max(0, input.shelterCosts - halfIncome);
      const shelterCap = (input.hasElderly || input.hasDisabled) ? Infinity : 67200;
      shelterDeduction = Math.min(excessShelter, shelterCap);
    }
    
    const totalDeductions = standardDeduction + earnedIncomeDeduction + dependentCareDeduction + medicalDeduction + shelterDeduction;
    const netIncome = Math.max(0, input.grossMonthlyIncome - totalDeductions);
    
    breakdown.push(`Total deductions: $${(totalDeductions / 100).toFixed(2)}`);
    breakdown.push(`Net income: $${(netIncome / 100).toFixed(2)}`);
    
    const netTestPassed = netIncome <= netLimit;
    if (!netTestPassed) {
      ineligibilityReasons.push(`Net income exceeds 100% FPL limit`);
      breakdown.push(`✗ Net income test failed`);
    } else {
      breakdown.push(`✓ Net income test passed`);
    }
    
    const isEligible = assetTestPassed && grossTestPassed && netTestPassed;
    
    let monthlyBenefit = 0;
    if (isEligible) {
      const maxAllotments: Record<number, number> = {
        1: 29200, 2: 53600, 3: 76800, 4: 97500, 5: 115800, 6: 138900, 7: 153600, 8: 175600
      };
      const maxAllotment = maxAllotments[Math.min(input.householdSize, 8)] || 
                           maxAllotments[8] + (input.householdSize - 8) * 21900;
      monthlyBenefit = Math.max(0, maxAllotment - Math.floor(netIncome * 0.30));
      breakdown.push(`Monthly benefit: $${(monthlyBenefit / 100).toFixed(2)}`);
    }
    
    return {
      isEligible,
      program: "SNAP",
      stateCode: "UT",
      stateProgramName: "Utah SNAP",
      monthlyBenefit,
      reason: isEligible ? "Eligible for Utah SNAP" : ineligibilityReasons[0],
      ineligibilityReasons: isEligible ? undefined : ineligibilityReasons,
      incomeTest: {
        passed: grossTestPassed && netTestPassed,
        grossLimit,
        netLimit,
        actualGross: input.grossMonthlyIncome,
        actualNet: netIncome
      },
      assetTest: {
        passed: assetTestPassed,
        limit: assetLimit,
        actual: input.assets || 0
      },
      deductions: {
        standard: standardDeduction,
        earnedIncome: earnedIncomeDeduction,
        dependentCare: dependentCareDeduction,
        shelter: shelterDeduction,
        medical: medicalDeduction,
        total: totalDeductions
      },
      calculationBreakdown: breakdown,
      policyCitations: [
        { code: "Utah Admin Code R986-200", title: "SNAP Eligibility", description: "Utah uses federal SNAP eligibility standards without BBCE expansion" }
      ]
    };
  }

  async calculateTANFEligibility(input: StateEligibilityInput): Promise<StateEligibilityResult> {
    const breakdown: string[] = [];
    const ineligibilityReasons: string[] = [];
    
    breakdown.push(`Utah Family Employment Program (FEP) Eligibility`);
    breakdown.push(`Household size: ${input.householdSize}`);
    
    const maxBenefits: Record<number, number> = { 1: 27800, 2: 38800, 3: 49800, 4: 59200, 5: 68000, 6: 76800 };
    const maxBenefit = maxBenefits[Math.min(input.householdSize, 6)] || maxBenefits[6] + (input.householdSize - 6) * 8000;
    
    const incomeLimit = Math.floor(maxBenefit * 1.85);
    const assetLimit = 200000;
    
    breakdown.push(`Income limit (185% of grant): $${(incomeLimit / 100).toFixed(2)}`);
    breakdown.push(`Asset limit: $${(assetLimit / 100).toFixed(2)}`);
    
    const incomePassed = input.grossMonthlyIncome <= incomeLimit;
    if (!incomePassed) {
      ineligibilityReasons.push(`Income exceeds 185% of maximum grant`);
      breakdown.push(`✗ Income test failed`);
    } else {
      breakdown.push(`✓ Income test passed`);
    }
    
    let assetsPassed = true;
    if (input.assets !== undefined && input.assets > assetLimit) {
      assetsPassed = false;
      ineligibilityReasons.push(`Assets exceed $2,000 limit`);
      breakdown.push(`✗ Asset test failed`);
    }
    
    const hasChildren = (input.childrenUnder18 || 0) > 0 || input.isPregnant;
    if (!hasChildren) {
      ineligibilityReasons.push(`TANF requires dependent children`);
      breakdown.push(`✗ Must have dependent children`);
    }
    
    const isEligible = incomePassed && assetsPassed && hasChildren;
    
    let monthlyBenefit = 0;
    if (isEligible) {
      const earnedIncomeDisregard = Math.floor(input.earnedIncome * 0.50);
      const countableIncome = Math.max(0, input.grossMonthlyIncome - earnedIncomeDisregard);
      monthlyBenefit = Math.max(0, maxBenefit - countableIncome);
      breakdown.push(`Monthly benefit: $${(monthlyBenefit / 100).toFixed(2)}`);
    }
    
    return {
      isEligible,
      program: "TANF",
      stateCode: "UT",
      stateProgramName: "Utah Family Employment Program (FEP)",
      monthlyBenefit,
      reason: isEligible ? "Eligible for Utah FEP" : ineligibilityReasons[0],
      ineligibilityReasons: isEligible ? undefined : ineligibilityReasons,
      incomeTest: {
        passed: incomePassed,
        grossLimit: incomeLimit,
        actualGross: input.grossMonthlyIncome
      },
      assetTest: {
        passed: assetsPassed,
        limit: assetLimit,
        actual: input.assets || 0
      },
      calculationBreakdown: breakdown,
      policyCitations: [
        { code: "Utah Admin Code R986-100", title: "Family Employment Program", description: "Utah TANF with 36-month lifetime limit" }
      ]
    };
  }

  async calculateMedicaidEligibility(input: StateEligibilityInput): Promise<StateEligibilityResult> {
    const breakdown: string[] = [];
    const ineligibilityReasons: string[] = [];
    
    breakdown.push(`Utah Medicaid Eligibility Calculation`);
    
    let incomeLimit: number;
    let category: string;
    
    if (input.isPregnant) {
      incomeLimit = getMonthlyFPLPercent(input.householdSize, 141) * 100;
      category = "Pregnant Women";
    } else if (input.childrenUnder18 && input.childrenUnder18 > 0) {
      incomeLimit = getMonthlyFPLPercent(input.householdSize, 200) * 100;
      category = "Children";
    } else if (input.hasDisabled) {
      incomeLimit = getMonthlyFPLPercent(input.householdSize, 100) * 100;
      category = "Disabled Adults";
    } else {
      incomeLimit = getMonthlyFPLPercent(input.householdSize, 138) * 100;
      category = "Adult Expansion";
    }
    
    breakdown.push(`Category: ${category}`);
    breakdown.push(`Income limit: $${(incomeLimit / 100).toFixed(2)}/month`);
    
    const magiIncome = input.grossMonthlyIncome - Math.floor(input.grossMonthlyIncome * 0.05);
    breakdown.push(`MAGI income (after 5% disregard): $${(magiIncome / 100).toFixed(2)}`);
    
    const incomePassed = magiIncome <= incomeLimit;
    if (!incomePassed) {
      ineligibilityReasons.push(`MAGI income exceeds ${category} limit`);
      breakdown.push(`✗ Income test failed`);
    } else {
      breakdown.push(`✓ Income test passed`);
    }
    
    const isEligible = incomePassed;
    
    return {
      isEligible,
      program: "MEDICAID",
      stateCode: "UT",
      stateProgramName: "Utah Medicaid",
      reason: isEligible ? `Eligible for Utah Medicaid (${category})` : ineligibilityReasons[0],
      ineligibilityReasons: isEligible ? undefined : ineligibilityReasons,
      incomeTest: {
        passed: incomePassed,
        grossLimit: incomeLimit,
        actualGross: magiIncome
      },
      calculationBreakdown: breakdown,
      policyCitations: [
        { code: "Utah Admin Code R414", title: "Medicaid Eligibility", description: "Utah Medicaid expansion implemented 2020" }
      ]
    };
  }
}

export class IndianaRulesEngine {
  async calculateSNAPEligibility(input: StateEligibilityInput): Promise<StateEligibilityResult> {
    const breakdown: string[] = [];
    const ineligibilityReasons: string[] = [];
    
    breakdown.push(`Indiana SNAP Eligibility Calculation`);
    breakdown.push(`Household size: ${input.householdSize}`);
    
    const grossLimit = getMonthlyFPLPercent(input.householdSize, 130) * 100;
    const netLimit = getMonthlyFPLPercent(input.householdSize, 100) * 100;
    const assetLimit = (input.hasElderly || input.hasDisabled) ? 425000 : 275000;
    
    breakdown.push(`Gross income limit (130% FPL): $${(grossLimit / 100).toFixed(2)}`);
    breakdown.push(`Net income limit (100% FPL): $${(netLimit / 100).toFixed(2)}`);
    
    let assetTestPassed = true;
    if (input.assets !== undefined && input.assets > assetLimit) {
      assetTestPassed = false;
      ineligibilityReasons.push(`Assets exceed $${(assetLimit / 100).toFixed(2)} limit`);
      breakdown.push(`✗ Asset test failed`);
    } else if (input.assets !== undefined) {
      breakdown.push(`✓ Asset test passed`);
    }
    
    let grossTestPassed = input.grossMonthlyIncome <= grossLimit;
    if (input.hasElderly || input.hasDisabled) {
      grossTestPassed = true;
      breakdown.push(`✓ Gross income test bypassed (elderly/disabled)`);
    } else if (!grossTestPassed) {
      ineligibilityReasons.push(`Gross income exceeds 130% FPL`);
      breakdown.push(`✗ Gross income test failed`);
    } else {
      breakdown.push(`✓ Gross income test passed`);
    }
    
    const standardDeduction = input.householdSize <= 3 ? 19800 : 
                               input.householdSize === 4 ? 20800 : 
                               input.householdSize === 5 ? 24300 : 27800;
    const earnedIncomeDeduction = Math.floor(input.earnedIncome * 0.20);
    const totalDeductions = standardDeduction + earnedIncomeDeduction + 
                           Math.min(input.dependentCareExpenses || 0, 20000);
    
    const netIncome = Math.max(0, input.grossMonthlyIncome - totalDeductions);
    const netTestPassed = netIncome <= netLimit;
    
    if (!netTestPassed) {
      ineligibilityReasons.push(`Net income exceeds 100% FPL`);
      breakdown.push(`✗ Net income test failed`);
    } else {
      breakdown.push(`✓ Net income test passed`);
    }
    
    const isEligible = assetTestPassed && grossTestPassed && netTestPassed;
    
    let monthlyBenefit = 0;
    if (isEligible) {
      const maxAllotments: Record<number, number> = {
        1: 29200, 2: 53600, 3: 76800, 4: 97500, 5: 115800, 6: 138900, 7: 153600, 8: 175600
      };
      const maxAllotment = maxAllotments[Math.min(input.householdSize, 8)] || 
                           maxAllotments[8] + (input.householdSize - 8) * 21900;
      monthlyBenefit = Math.max(0, maxAllotment - Math.floor(netIncome * 0.30));
      breakdown.push(`Monthly benefit: $${(monthlyBenefit / 100).toFixed(2)}`);
    }
    
    return {
      isEligible,
      program: "SNAP",
      stateCode: "IN",
      stateProgramName: "Indiana SNAP",
      monthlyBenefit,
      reason: isEligible ? "Eligible for Indiana SNAP" : ineligibilityReasons[0],
      ineligibilityReasons: isEligible ? undefined : ineligibilityReasons,
      incomeTest: {
        passed: grossTestPassed && netTestPassed,
        grossLimit,
        netLimit,
        actualGross: input.grossMonthlyIncome,
        actualNet: netIncome
      },
      assetTest: {
        passed: assetTestPassed,
        limit: assetLimit,
        actual: input.assets || 0
      },
      deductions: {
        standard: standardDeduction,
        earnedIncome: earnedIncomeDeduction,
        dependentCare: Math.min(input.dependentCareExpenses || 0, 20000),
        shelter: 0,
        medical: 0,
        total: totalDeductions
      },
      calculationBreakdown: breakdown,
      policyCitations: [
        { code: "470 IAC 6.5", title: "Indiana SNAP", description: "Indiana uses federal SNAP eligibility without BBCE" }
      ]
    };
  }

  async calculateTANFEligibility(input: StateEligibilityInput): Promise<StateEligibilityResult> {
    const breakdown: string[] = [];
    const ineligibilityReasons: string[] = [];
    
    breakdown.push(`Indiana TANF Eligibility Calculation`);
    
    const maxBenefits: Record<number, number> = { 1: 13900, 2: 22900, 3: 28800, 4: 34600, 5: 40300, 6: 46000 };
    const maxBenefit = maxBenefits[Math.min(input.householdSize, 6)] || maxBenefits[6] + (input.householdSize - 6) * 5700;
    
    const incomeLimit = Math.floor(maxBenefit * 1.50);
    const assetLimit = 100000;
    
    breakdown.push(`Maximum benefit: $${(maxBenefit / 100).toFixed(2)}`);
    breakdown.push(`Income limit: $${(incomeLimit / 100).toFixed(2)}`);
    breakdown.push(`Asset limit: $${(assetLimit / 100).toFixed(2)}`);
    
    const incomePassed = input.grossMonthlyIncome <= incomeLimit;
    if (!incomePassed) {
      ineligibilityReasons.push(`Income exceeds limit`);
      breakdown.push(`✗ Income test failed`);
    } else {
      breakdown.push(`✓ Income test passed`);
    }
    
    let assetsPassed = true;
    if (input.assets !== undefined && input.assets > assetLimit) {
      assetsPassed = false;
      ineligibilityReasons.push(`Assets exceed $1,000 limit`);
      breakdown.push(`✗ Asset test failed`);
    }
    
    const hasChildren = (input.childrenUnder18 || 0) > 0 || input.isPregnant;
    if (!hasChildren) {
      ineligibilityReasons.push(`TANF requires dependent children`);
      breakdown.push(`✗ Must have dependent children`);
    }
    
    const isEligible = incomePassed && assetsPassed && hasChildren;
    
    let monthlyBenefit = 0;
    if (isEligible) {
      const countableIncome = Math.max(0, input.grossMonthlyIncome - Math.floor(input.earnedIncome * 0.50));
      monthlyBenefit = Math.max(0, maxBenefit - countableIncome);
      breakdown.push(`Monthly benefit: $${(monthlyBenefit / 100).toFixed(2)}`);
    }
    
    return {
      isEligible,
      program: "TANF",
      stateCode: "IN",
      stateProgramName: "Indiana TANF Assistance Grant",
      monthlyBenefit,
      reason: isEligible ? "Eligible for Indiana TANF" : ineligibilityReasons[0],
      ineligibilityReasons: isEligible ? undefined : ineligibilityReasons,
      incomeTest: {
        passed: incomePassed,
        grossLimit: incomeLimit,
        actualGross: input.grossMonthlyIncome
      },
      assetTest: {
        passed: assetsPassed,
        limit: assetLimit,
        actual: input.assets || 0
      },
      calculationBreakdown: breakdown,
      policyCitations: [
        { code: "470 IAC 10", title: "Indiana TANF", description: "24-month consecutive limit, 60-month lifetime" }
      ]
    };
  }

  async calculateMedicaidEligibility(input: StateEligibilityInput): Promise<StateEligibilityResult> {
    const breakdown: string[] = [];
    const ineligibilityReasons: string[] = [];
    
    breakdown.push(`Indiana Healthy Indiana Plan (HIP) 2.0 Eligibility`);
    
    let incomeLimit: number;
    let category: string;
    
    if (input.isPregnant) {
      incomeLimit = getMonthlyFPLPercent(input.householdSize, 204) * 100;
      category = "Pregnant Women";
    } else if (input.childrenUnder18 && input.childrenUnder18 > 0) {
      incomeLimit = getMonthlyFPLPercent(input.householdSize, 255) * 100;
      category = "Children (CHIP)";
    } else {
      incomeLimit = getMonthlyFPLPercent(input.householdSize, 138) * 100;
      category = "HIP 2.0 Adult Expansion";
    }
    
    breakdown.push(`Category: ${category}`);
    breakdown.push(`Income limit: $${(incomeLimit / 100).toFixed(2)}/month`);
    
    const magiIncome = input.grossMonthlyIncome - Math.floor(input.grossMonthlyIncome * 0.05);
    breakdown.push(`MAGI income: $${(magiIncome / 100).toFixed(2)}`);
    
    const incomePassed = magiIncome <= incomeLimit;
    if (!incomePassed) {
      ineligibilityReasons.push(`Income exceeds ${category} limit`);
      breakdown.push(`✗ Income test failed`);
    } else {
      breakdown.push(`✓ Income test passed`);
    }
    
    const isEligible = incomePassed;
    
    return {
      isEligible,
      program: "MEDICAID",
      stateCode: "IN",
      stateProgramName: "Healthy Indiana Plan (HIP) 2.0",
      reason: isEligible ? `Eligible for ${category}` : ineligibilityReasons[0],
      ineligibilityReasons: isEligible ? undefined : ineligibilityReasons,
      incomeTest: {
        passed: incomePassed,
        grossLimit: incomeLimit,
        actualGross: magiIncome
      },
      calculationBreakdown: breakdown,
      policyCitations: [
        { code: "405 IAC 5", title: "Indiana Medicaid", description: "HIP 2.0 expansion program since 2015" }
      ]
    };
  }
}

export class MichiganRulesEngine {
  async calculateSNAPEligibility(input: StateEligibilityInput): Promise<StateEligibilityResult> {
    const breakdown: string[] = [];
    const ineligibilityReasons: string[] = [];
    
    breakdown.push(`Michigan Food Assistance Program (FAP) Eligibility`);
    breakdown.push(`Household size: ${input.householdSize}`);
    
    const grossLimit = getMonthlyFPLPercent(input.householdSize, 200) * 100;
    const netLimit = getMonthlyFPLPercent(input.householdSize, 100) * 100;
    
    breakdown.push(`Gross income limit (200% FPL - BBCE): $${(grossLimit / 100).toFixed(2)}`);
    breakdown.push(`Net income limit (100% FPL): $${(netLimit / 100).toFixed(2)}`);
    
    let grossTestPassed = input.grossMonthlyIncome <= grossLimit;
    if (!grossTestPassed) {
      ineligibilityReasons.push(`Gross income exceeds 200% FPL`);
      breakdown.push(`✗ Gross income test failed`);
    } else {
      breakdown.push(`✓ Gross income test passed`);
    }
    
    const standardDeduction = input.householdSize <= 3 ? 19800 : 
                               input.householdSize === 4 ? 20800 : 
                               input.householdSize === 5 ? 24300 : 27800;
    const earnedIncomeDeduction = Math.floor(input.earnedIncome * 0.20);
    
    let shelterDeduction = 0;
    if (input.shelterCosts) {
      const incomeAfterDeductions = input.grossMonthlyIncome - standardDeduction - earnedIncomeDeduction;
      const halfIncome = Math.floor(incomeAfterDeductions / 2);
      const excessShelter = Math.max(0, input.shelterCosts - halfIncome);
      const shelterCap = (input.hasElderly || input.hasDisabled) ? Infinity : 67200;
      shelterDeduction = Math.min(excessShelter, shelterCap);
    }
    
    const totalDeductions = standardDeduction + earnedIncomeDeduction + shelterDeduction;
    const netIncome = Math.max(0, input.grossMonthlyIncome - totalDeductions);
    
    breakdown.push(`Total deductions: $${(totalDeductions / 100).toFixed(2)}`);
    breakdown.push(`Net income: $${(netIncome / 100).toFixed(2)}`);
    
    const netTestPassed = netIncome <= netLimit;
    if (!netTestPassed) {
      ineligibilityReasons.push(`Net income exceeds 100% FPL`);
      breakdown.push(`✗ Net income test failed`);
    } else {
      breakdown.push(`✓ Net income test passed`);
    }
    
    const isEligible = grossTestPassed && netTestPassed;
    
    let monthlyBenefit = 0;
    if (isEligible) {
      const maxAllotments: Record<number, number> = {
        1: 29200, 2: 53600, 3: 76800, 4: 97500, 5: 115800, 6: 138900, 7: 153600, 8: 175600
      };
      const maxAllotment = maxAllotments[Math.min(input.householdSize, 8)] || 
                           maxAllotments[8] + (input.householdSize - 8) * 21900;
      monthlyBenefit = Math.max(0, maxAllotment - Math.floor(netIncome * 0.30));
      breakdown.push(`Monthly benefit: $${(monthlyBenefit / 100).toFixed(2)}`);
    }
    
    return {
      isEligible,
      program: "SNAP",
      stateCode: "MI",
      stateProgramName: "Michigan Food Assistance Program (FAP)",
      monthlyBenefit,
      reason: isEligible ? "Eligible for Michigan FAP" : ineligibilityReasons[0],
      ineligibilityReasons: isEligible ? undefined : ineligibilityReasons,
      incomeTest: {
        passed: grossTestPassed && netTestPassed,
        grossLimit,
        netLimit,
        actualGross: input.grossMonthlyIncome,
        actualNet: netIncome
      },
      deductions: {
        standard: standardDeduction,
        earnedIncome: earnedIncomeDeduction,
        dependentCare: 0,
        shelter: shelterDeduction,
        medical: 0,
        total: totalDeductions
      },
      calculationBreakdown: breakdown,
      policyCitations: [
        { code: "Mich Admin Code R 400.3101", title: "Michigan FAP", description: "Michigan uses BBCE with 200% FPL gross income limit" }
      ]
    };
  }

  async calculateTANFEligibility(input: StateEligibilityInput): Promise<StateEligibilityResult> {
    const breakdown: string[] = [];
    const ineligibilityReasons: string[] = [];
    
    breakdown.push(`Michigan Family Independence Program (FIP) Eligibility`);
    
    const maxBenefits: Record<number, number> = { 1: 25700, 2: 38700, 3: 49200, 4: 58600, 5: 67100, 6: 74100 };
    const maxBenefit = maxBenefits[Math.min(input.householdSize, 6)] || maxBenefits[6] + (input.householdSize - 6) * 7000;
    
    const incomeLimit = Math.floor(maxBenefit * 1.72);
    
    breakdown.push(`Maximum benefit: $${(maxBenefit / 100).toFixed(2)}`);
    breakdown.push(`Income limit: $${(incomeLimit / 100).toFixed(2)}`);
    
    const incomePassed = input.grossMonthlyIncome <= incomeLimit;
    if (!incomePassed) {
      ineligibilityReasons.push(`Income exceeds limit`);
      breakdown.push(`✗ Income test failed`);
    } else {
      breakdown.push(`✓ Income test passed`);
    }
    
    const hasChildren = (input.childrenUnder18 || 0) > 0 || input.isPregnant;
    if (!hasChildren) {
      ineligibilityReasons.push(`TANF requires dependent children`);
      breakdown.push(`✗ Must have dependent children`);
    }
    
    const isEligible = incomePassed && hasChildren;
    
    let monthlyBenefit = 0;
    if (isEligible) {
      const countableIncome = Math.max(0, input.grossMonthlyIncome - Math.floor(input.earnedIncome * 0.20) - 20000);
      monthlyBenefit = Math.max(0, maxBenefit - countableIncome);
      breakdown.push(`Monthly benefit: $${(monthlyBenefit / 100).toFixed(2)}`);
    }
    
    return {
      isEligible,
      program: "TANF",
      stateCode: "MI",
      stateProgramName: "Michigan Family Independence Program (FIP)",
      monthlyBenefit,
      reason: isEligible ? "Eligible for Michigan FIP" : ineligibilityReasons[0],
      ineligibilityReasons: isEligible ? undefined : ineligibilityReasons,
      incomeTest: {
        passed: incomePassed,
        grossLimit: incomeLimit,
        actualGross: input.grossMonthlyIncome
      },
      calculationBreakdown: breakdown,
      policyCitations: [
        { code: "Mich Admin Code R 400.1101", title: "Michigan FIP", description: "60-month lifetime limit" }
      ]
    };
  }

  async calculateMedicaidEligibility(input: StateEligibilityInput): Promise<StateEligibilityResult> {
    const breakdown: string[] = [];
    const ineligibilityReasons: string[] = [];
    
    breakdown.push(`Michigan Medicaid (Healthy Michigan Plan) Eligibility`);
    
    let incomeLimit: number;
    let category: string;
    
    if (input.isPregnant) {
      incomeLimit = getMonthlyFPLPercent(input.householdSize, 195) * 100;
      category = "Pregnant Women";
    } else if (input.childrenUnder18 && input.childrenUnder18 > 0) {
      incomeLimit = getMonthlyFPLPercent(input.householdSize, 217) * 100;
      category = "Children (MIChild)";
    } else {
      incomeLimit = getMonthlyFPLPercent(input.householdSize, 138) * 100;
      category = "Healthy Michigan Plan";
    }
    
    breakdown.push(`Category: ${category}`);
    breakdown.push(`Income limit: $${(incomeLimit / 100).toFixed(2)}/month`);
    
    const magiIncome = input.grossMonthlyIncome - Math.floor(input.grossMonthlyIncome * 0.05);
    breakdown.push(`MAGI income: $${(magiIncome / 100).toFixed(2)}`);
    
    const incomePassed = magiIncome <= incomeLimit;
    if (!incomePassed) {
      ineligibilityReasons.push(`Income exceeds ${category} limit`);
      breakdown.push(`✗ Income test failed`);
    } else {
      breakdown.push(`✓ Income test passed`);
    }
    
    const isEligible = incomePassed;
    
    return {
      isEligible,
      program: "MEDICAID",
      stateCode: "MI",
      stateProgramName: "Healthy Michigan Plan",
      reason: isEligible ? `Eligible for ${category}` : ineligibilityReasons[0],
      ineligibilityReasons: isEligible ? undefined : ineligibilityReasons,
      incomeTest: {
        passed: incomePassed,
        grossLimit: incomeLimit,
        actualGross: magiIncome
      },
      calculationBreakdown: breakdown,
      policyCitations: [
        { code: "Mich Admin Code R 400.1301", title: "Michigan Medicaid", description: "Healthy Michigan Plan expansion" }
      ]
    };
  }
}

export const utahRulesEngine = new UtahRulesEngine();
export const indianaRulesEngine = new IndianaRulesEngine();
export const michiganRulesEngine = new MichiganRulesEngine();

export async function calculateStateEligibility(input: StateEligibilityInput): Promise<StateEligibilityResult> {
  const { stateCode, program } = input;
  
  logger.info(`Calculating ${program} eligibility for ${stateCode}`, {
    service: "StateRulesEngine",
    action: "calculateEligibility",
    stateCode,
    program,
    householdSize: input.householdSize
  });
  
  switch (stateCode) {
    case "UT":
      switch (program) {
        case "SNAP": return utahRulesEngine.calculateSNAPEligibility(input);
        case "TANF": return utahRulesEngine.calculateTANFEligibility(input);
        case "MEDICAID": return utahRulesEngine.calculateMedicaidEligibility(input);
      }
      break;
    case "IN":
      switch (program) {
        case "SNAP": return indianaRulesEngine.calculateSNAPEligibility(input);
        case "TANF": return indianaRulesEngine.calculateTANFEligibility(input);
        case "MEDICAID": return indianaRulesEngine.calculateMedicaidEligibility(input);
      }
      break;
    case "MI":
      switch (program) {
        case "SNAP": return michiganRulesEngine.calculateSNAPEligibility(input);
        case "TANF": return michiganRulesEngine.calculateTANFEligibility(input);
        case "MEDICAID": return michiganRulesEngine.calculateMedicaidEligibility(input);
      }
      break;
    default:
      throw new Error(`State ${stateCode} rules engine not implemented`);
  }
  
  throw new Error(`Program ${program} not supported for state ${stateCode}`);
}
