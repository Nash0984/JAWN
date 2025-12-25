import { db } from "../db";
import {
  medicaidIncomeLimits,
  medicaidCategories,
  medicaidMAGIRules,
  medicaidNonMAGIRules,
  benefitPrograms,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Maryland Medicaid Rules Engine
 * 
 * Implements Maryland's Medicaid eligibility determination with multiple pathways:
 * 
 * MAGI Pathways (Modified Adjusted Gross Income):
 * - Adults (19-64): 138% FPL (ACA expansion)
 * - Children (<19): 322% FPL (includes CHIP)
 * - Pregnant Women: 264% FPL
 * 
 * Non-MAGI Pathways:
 * - SSI Recipients: Automatic eligibility
 * - Aged/Blind/Disabled (ABD): Asset + income tests
 * 
 * Maryland is a Medicaid expansion state under the ACA
 * 
 * Policy References:
 * - COMAR 10.09.24 (Medicaid Medical Assistance)
 * - Maryland HealthChoice Manual
 * - ACA Section 2001, 42 U.S.C. § 1396a
 */

export interface MedicaidEligibilityInput {
  // Household Information
  size: number;
  age: number;
  isPregnant?: boolean;
  
  // Income (in cents)
  monthlyIncome: number;
  annualIncome: number;
  
  // Special Statuses
  isSSIRecipient?: boolean;
  isDisabled?: boolean;
  isBlind?: boolean;
  isElderly?: boolean; // 65+
  
  // Assets (for Non-MAGI only, in cents)
  countableAssets?: number;
  
  // MAGI-specific
  magiAdjustments?: number; // Additional MAGI-specific deductions (in cents)
}

export interface MedicaidEligibilityResult {
  isEligible: boolean;
  category: string; // MAGI_ADULT, MAGI_CHILD, MAGI_PREGNANT, SSI, ABD
  categoryName: string;
  pathway: "MAGI" | "Non-MAGI";
  
  incomeTest: {
    passed: boolean;
    testType: "MAGI" | "Non-MAGI" | "SSI_Automatic";
    monthlyIncome: number;
    annualIncome: number;
    incomeLimit: number;
    percentOfFPL: number;
  };
  
  assetTest?: {
    passed: boolean;
    countableAssets: number;
    assetLimit: number;
  };
  
  coverageType: "Full Medicaid" | "CHIP" | "Medically Needy" | null;
  hasSpenddown: boolean;
  spenddownAmount?: number;
  
  reason?: string;
  ineligibilityReasons?: string[];
  calculationBreakdown: string[];
  policyCitations: string[];
}

class MedicaidRulesEngine {
  
  /**
   * Calculate Medicaid eligibility for Maryland
   */
  async calculateEligibility(input: MedicaidEligibilityInput): Promise<MedicaidEligibilityResult> {
    const breakdown: string[] = [];
    const citations: string[] = [];
    
    // Get Medicaid program
    const medicaidProgram = await db.query.benefitPrograms.findFirst({
      where: eq(benefitPrograms.code, "MEDICAID"),
    });
    
    if (!medicaidProgram) {
      throw new Error("Medicaid program not found in database");
    }
    
    breakdown.push(`Maryland Medicaid Eligibility Determination`);
    breakdown.push(`Household Size: ${input.size}, Age: ${input.age}`);
    
    // Step 1: Determine eligibility category (in priority order)
    const category = this.determineCategory(input);
    breakdown.push(`Eligibility Category: ${category.categoryName} (${category.pathway})`);
    citations.push(`COMAR 10.09.24 - Maryland Medicaid Medical Assistance`);
    
    // Step 2: SSI Recipients get automatic eligibility (Non-MAGI)
    if (input.isSSIRecipient) {
      breakdown.push(`✓ SSI recipient - AUTOMATIC ELIGIBILITY`);
      citations.push(`42 U.S.C. § 1396a(a)(10)(A)(i)(II) - SSI recipients automatically eligible`);
      
      return {
        isEligible: true,
        category: "SSI",
        categoryName: "SSI Recipients",
        pathway: "Non-MAGI",
        incomeTest: {
          passed: true,
          testType: "SSI_Automatic",
          monthlyIncome: input.monthlyIncome,
          annualIncome: input.annualIncome,
          incomeLimit: 0, // N/A for SSI
          percentOfFPL: 0,
        },
        coverageType: "Full Medicaid",
        hasSpenddown: false,
        calculationBreakdown: breakdown,
        policyCitations: citations,
      };
    }
    
    // Step 3: Apply appropriate income test based on pathway
    if (category.pathway === "MAGI") {
      return await this.applyMAGITest(input, category, breakdown, citations);
    } else {
      return await this.applyNonMAGITest(input, category, breakdown, citations);
    }
  }
  
  /**
   * Determine which Medicaid category applies (in priority order)
   * 
   * IMPORTANT: Pregnancy household size adjustment
   * Medicaid counts a pregnant woman as herself + number of unborn children
   * For simplicity, we add 1 to household size for pregnant applicants
   */
  private determineCategory(input: MedicaidEligibilityInput): { 
    code: string; 
    categoryName: string; 
    pathway: "MAGI" | "Non-MAGI";
    percentOfFPL: number;
    adjustedHouseholdSize: number; // Adjusted for pregnancy
  } {
    // Adjust household size for pregnancy (pregnant woman counts as 2)
    const adjustedHouseholdSize = input.isPregnant ? input.size + 1 : input.size;
    
    // Priority 1: SSI Recipients (automatic)
    if (input.isSSIRecipient) {
      return { 
        code: "SSI", 
        categoryName: "SSI Recipients", 
        pathway: "Non-MAGI",
        percentOfFPL: 0, // N/A
        adjustedHouseholdSize,
      };
    }
    
    // Priority 2: Non-MAGI Aged/Blind/Disabled (65+ or disabled/blind)
    if (input.isElderly || input.isDisabled || input.isBlind) {
      return { 
        code: "ABD", 
        categoryName: "Aged, Blind, or Disabled", 
        pathway: "Non-MAGI",
        percentOfFPL: 100, // Typically 100% FPL for Non-MAGI ABD
        adjustedHouseholdSize,
      };
    }
    
    // Priority 3: MAGI Pregnant Women (use adjusted household size)
    if (input.isPregnant) {
      return { 
        code: "MAGI_PREGNANT", 
        categoryName: "Pregnant Women", 
        pathway: "MAGI",
        percentOfFPL: 264, // Maryland: 264% FPL for pregnant women
        adjustedHouseholdSize,
      };
    }
    
    // Priority 4: MAGI Children (<19)
    if (input.age < 19) {
      return { 
        code: "MAGI_CHILD", 
        categoryName: "Children", 
        pathway: "MAGI",
        percentOfFPL: 322, // Maryland: 322% FPL for children (includes CHIP)
        adjustedHouseholdSize,
      };
    }
    
    // Priority 5: MAGI Adults (19-64)
    return { 
      code: "MAGI_ADULT", 
      categoryName: "Adults", 
      pathway: "MAGI",
      percentOfFPL: 138, // Maryland: 138% FPL for adults (ACA expansion)
      adjustedHouseholdSize,
    };
  }
  
  /**
   * Apply MAGI (Modified Adjusted Gross Income) eligibility test
   */
  private async applyMAGITest(
    input: MedicaidEligibilityInput,
    category: { code: string; categoryName: string; pathway: "MAGI" | "Non-MAGI"; percentOfFPL: number; adjustedHouseholdSize: number },
    breakdown: string[],
    citations: string[]
  ): Promise<MedicaidEligibilityResult> {
    
    // Get MAGI income limit from database using ADJUSTED household size (pregnancy adjustment)
    const incomeLimit = await db.query.medicaidIncomeLimits.findFirst({
      where: and(
        eq(medicaidIncomeLimits.category, category.code.toLowerCase().replace('magi_', '')),
        eq(medicaidIncomeLimits.householdSize, category.adjustedHouseholdSize),
        eq(medicaidIncomeLimits.isActive, true)
      ),
    });
    
    if (!incomeLimit) {
      throw new Error(`No MAGI income limit found for category ${category.code}, household size ${input.size}`);
    }
    
    // Calculate MAGI (income with any adjustments)
    const magi = input.monthlyIncome - (input.magiAdjustments || 0);
    const percentOfFPL = Math.round((input.annualIncome / incomeLimit.annualIncomeLimit) * incomeLimit.percentOfFPL);
    
    breakdown.push(`Monthly Income: $${(input.monthlyIncome / 100).toFixed(2)}`);
    if (input.magiAdjustments) {
      breakdown.push(`MAGI Adjustments: -$${(input.magiAdjustments / 100).toFixed(2)}`);
      breakdown.push(`Adjusted MAGI: $${(magi / 100).toFixed(2)}`);
    }
    breakdown.push(`Income Limit: ${incomeLimit.percentOfFPL}% FPL = $${(incomeLimit.monthlyIncomeLimit / 100).toFixed(2)}/month`);
    breakdown.push(`Household is at ${percentOfFPL}% of Federal Poverty Level`);
    
    const incomePassed = magi <= incomeLimit.monthlyIncomeLimit;
    
    if (incomePassed) {
      breakdown.push(`✓ Income test PASSED`);
      
      // Determine coverage type
      let coverageType: "Full Medicaid" | "CHIP" | "Medically Needy" = "Full Medicaid";
      if (category.code === "MAGI_CHILD" && percentOfFPL > 200) {
        coverageType = "CHIP"; // Children >200% FPL typically get CHIP
        breakdown.push(`Coverage: Children's Health Insurance Program (CHIP)`);
      } else {
        breakdown.push(`Coverage: Full Medicaid`);
      }
      
      citations.push(`ACA Section 2001 - Medicaid expansion to ${incomeLimit.percentOfFPL}% FPL`);
      citations.push(`Maryland HealthChoice Manual - MAGI methodology for ${category.categoryName.toLowerCase()}`);
      
      return {
        isEligible: true,
        category: category.code,
        categoryName: category.categoryName,
        pathway: "MAGI",
        incomeTest: {
          passed: true,
          testType: "MAGI",
          monthlyIncome: input.monthlyIncome,
          annualIncome: input.annualIncome,
          incomeLimit: incomeLimit.monthlyIncomeLimit,
          percentOfFPL,
        },
        coverageType,
        hasSpenddown: false,
        calculationBreakdown: breakdown,
        policyCitations: citations,
      };
    } else {
      breakdown.push(`✗ Income test FAILED`);
      const excessIncome = magi - incomeLimit.monthlyIncomeLimit;
      breakdown.push(`Excess Income: $${(excessIncome / 100).toFixed(2)}/month`);
      
      // Check for Medically Needy with spenddown
      const medicallyNeedyLimit = Math.round(incomeLimit.monthlyIncomeLimit * 0.50); // Typically 50% of MAGI limit
      if (magi <= incomeLimit.monthlyIncomeLimit * 2) {
        // Potentially eligible for medically needy with spenddown
        breakdown.push(`May qualify for Medically Needy with spenddown`);
        breakdown.push(`Spenddown Amount: $${(excessIncome / 100).toFixed(2)}/month`);
        
        citations.push(`COMAR 10.09.24.04 - Medically Needy Program with spenddown`);
        
        return {
          isEligible: true,
          category: category.code,
          categoryName: category.categoryName + " (Medically Needy)",
          pathway: "MAGI",
          incomeTest: {
            passed: false,
            testType: "MAGI",
            monthlyIncome: input.monthlyIncome,
            annualIncome: input.annualIncome,
            incomeLimit: incomeLimit.monthlyIncomeLimit,
            percentOfFPL,
          },
          coverageType: "Medically Needy",
          hasSpenddown: true,
          spenddownAmount: excessIncome,
          calculationBreakdown: breakdown,
          policyCitations: citations,
        };
      }
      
      return {
        isEligible: false,
        category: category.code,
        categoryName: category.categoryName,
        pathway: "MAGI",
        incomeTest: {
          passed: false,
          testType: "MAGI",
          monthlyIncome: input.monthlyIncome,
          annualIncome: input.annualIncome,
          incomeLimit: incomeLimit.monthlyIncomeLimit,
          percentOfFPL,
        },
        coverageType: null,
        hasSpenddown: false,
        reason: `Income $${(magi / 100).toFixed(2)} exceeds ${incomeLimit.percentOfFPL}% FPL limit of $${(incomeLimit.monthlyIncomeLimit / 100).toFixed(2)}`,
        ineligibilityReasons: [
          `Income exceeds ${incomeLimit.percentOfFPL}% FPL limit`,
          `Too high for Medically Needy spenddown eligibility`
        ],
        calculationBreakdown: breakdown,
        policyCitations: citations,
      };
    }
  }
  
  /**
   * Apply Non-MAGI eligibility test (for Aged, Blind, Disabled)
   */
  private async applyNonMAGITest(
    input: MedicaidEligibilityInput,
    category: { code: string; categoryName: string; pathway: "MAGI" | "Non-MAGI"; percentOfFPL: number; adjustedHouseholdSize: number },
    breakdown: string[],
    citations: string[]
  ): Promise<MedicaidEligibilityResult> {
    
    // Non-MAGI income limit (typically 100% FPL for ABD)
    const incomeLimit = await db.query.medicaidIncomeLimits.findFirst({
      where: and(
        eq(medicaidIncomeLimits.category, "elderly_disabled"),
        eq(medicaidIncomeLimits.householdSize, category.adjustedHouseholdSize),
        eq(medicaidIncomeLimits.isActive, true)
      ),
    });
    
    if (!incomeLimit) {
      throw new Error(`No Non-MAGI income limit found for ABD, household size ${input.size}`);
    }
    
    const percentOfFPL = Math.round((input.annualIncome / incomeLimit.annualIncomeLimit) * incomeLimit.percentOfFPL);
    
    breakdown.push(`Non-MAGI Income Test`);
    breakdown.push(`Monthly Income: $${(input.monthlyIncome / 100).toFixed(2)}`);
    breakdown.push(`Income Limit: ${incomeLimit.percentOfFPL}% FPL = $${(incomeLimit.monthlyIncomeLimit / 100).toFixed(2)}/month`);
    breakdown.push(`Household is at ${percentOfFPL}% of Federal Poverty Level`);
    
    const incomePassed = input.monthlyIncome <= incomeLimit.monthlyIncomeLimit;
    
    // Asset test for Non-MAGI (typically $2,000 for individual, $3,000 for couple)
    const assetLimit = input.size === 1 ? 200000 : 300000; // $2,000 or $3,000
    const assetsPassed = (input.countableAssets || 0) <= assetLimit;
    
    breakdown.push(`Asset Limit: $${(assetLimit / 100).toFixed(2)}`);
    breakdown.push(`Countable Assets: $${((input.countableAssets || 0) / 100).toFixed(2)}`);
    
    if (incomePassed) {
      breakdown.push(`✓ Income test PASSED`);
    } else {
      breakdown.push(`✗ Income test FAILED`);
    }
    
    if (assetsPassed) {
      breakdown.push(`✓ Asset test PASSED`);
    } else {
      breakdown.push(`✗ Asset test FAILED`);
    }
    
    citations.push(`COMAR 10.09.24.07 - Non-MAGI Aged, Blind, or Disabled`);
    citations.push(`42 CFR 435.121 - Eligibility for individuals age 65 or older`);
    
    if (incomePassed && assetsPassed) {
      return {
        isEligible: true,
        category: category.code,
        categoryName: category.categoryName,
        pathway: "Non-MAGI",
        incomeTest: {
          passed: true,
          testType: "Non-MAGI",
          monthlyIncome: input.monthlyIncome,
          annualIncome: input.annualIncome,
          incomeLimit: incomeLimit.monthlyIncomeLimit,
          percentOfFPL,
        },
        assetTest: {
          passed: true,
          countableAssets: input.countableAssets || 0,
          assetLimit,
        },
        coverageType: "Full Medicaid",
        hasSpenddown: false,
        calculationBreakdown: breakdown,
        policyCitations: citations,
      };
    } else {
      const reasons: string[] = [];
      if (!incomePassed) {
        reasons.push(`Income $${(input.monthlyIncome / 100).toFixed(2)} exceeds limit $${(incomeLimit.monthlyIncomeLimit / 100).toFixed(2)}`);
      }
      if (!assetsPassed) {
        reasons.push(`Assets $${((input.countableAssets || 0) / 100).toFixed(2)} exceed limit $${(assetLimit / 100).toFixed(2)}`);
      }
      
      return {
        isEligible: false,
        category: category.code,
        categoryName: category.categoryName,
        pathway: "Non-MAGI",
        incomeTest: {
          passed: incomePassed,
          testType: "Non-MAGI",
          monthlyIncome: input.monthlyIncome,
          annualIncome: input.annualIncome,
          incomeLimit: incomeLimit.monthlyIncomeLimit,
          percentOfFPL,
        },
        assetTest: {
          passed: assetsPassed,
          countableAssets: input.countableAssets || 0,
          assetLimit,
        },
        coverageType: null,
        hasSpenddown: false,
        reason: reasons.join("; "),
        ineligibilityReasons: reasons,
        calculationBreakdown: breakdown,
        policyCitations: citations,
      };
    }
  }
}

export const medicaidRulesEngine = new MedicaidRulesEngine();
