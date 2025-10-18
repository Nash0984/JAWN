import { db } from "../db";
import { povertyLevels } from "@shared/schema";
import { eq, and, lte, gte, isNull, desc, or } from "drizzle-orm";

/**
 * Maryland Tax Credits Rules Engine
 * 
 * Implements Maryland state tax credits:
 * 
 * 1. Renters' Tax Credit
 *    - AGI < $50,000
 *    - 15% of rent paid
 *    - Maximum credit: $1,000
 *    - Reference: Maryland Tax-General Article § 10-704
 * 
 * 2. Homeowners' Property Tax Credit
 *    - AGI < $60,000
 *    - 60-80% of property tax paid (based on income)
 *    - Maximum credit: $1,200
 *    - Reference: Maryland Tax-Property Article § 9-104
 * 
 * 3. Poverty Level Credit
 *    - AGI < 125% of Federal Poverty Level
 *    - Maximum credit: $500
 *    - Reference: Maryland Tax-General Article § 10-704.1
 */

export interface TaxCreditsInput {
  // Income
  adjustedGrossIncome: number; // AGI in cents
  
  // Household info
  householdSize: number;
  filingStatus: 'single' | 'married_joint' | 'married_separate' | 'head_of_household';
  
  // Housing costs (in cents)
  rentPaid?: number; // Annual rent paid
  propertyTaxPaid?: number; // Annual property tax paid
  
  // Homeowner status
  isHomeowner?: boolean;
  isRenter?: boolean;
  
  // Tax year
  taxYear?: number;
}

export interface TaxCreditsEligibilityResult {
  isEligible: boolean;
  totalCredits: number; // Total credits in cents
  
  // Individual credits
  rentersCredit: number;
  propertyTaxCredit: number;
  povertyLevelCredit: number;
  
  // Eligibility details
  creditsBreakdown: Array<{
    creditType: string;
    eligible: boolean;
    amount: number;
    reason: string;
  }>;
  
  reason?: string;
  ineligibilityReasons?: string[];
  calculationBreakdown: string[];
  policyCitations: string[];
}

class MarylandTaxCreditsRulesEngine {
  /**
   * Get Federal Poverty Level for household size and year
   */
  private async getFederalPovertyLevel(
    householdSize: number,
    year: number = 2025
  ): Promise<number> {
    const fpl = await db
      .select()
      .from(povertyLevels)
      .where(
        and(
          eq(povertyLevels.householdSize, householdSize),
          eq(povertyLevels.year, year),
          eq(povertyLevels.isActive, true)
        )
      )
      .orderBy(desc(povertyLevels.effectiveDate))
      .limit(1);

    if (!fpl[0]) {
      // Fallback to approximate FPL if not in database
      // 2025 FPL: $15,060 for 1 person + $5,380 per additional person
      const baseFPL = 1506000; // $15,060 in cents
      const perPersonAddition = 538000; // $5,380 in cents
      return baseFPL + (householdSize - 1) * perPersonAddition;
    }

    return fpl[0].annualIncome;
  }

  /**
   * Calculate Maryland Renters' Tax Credit
   * Reference: Maryland Tax-General Article § 10-704
   */
  private calculateRentersTaxCredit(rentPaid: number, agi: number): {
    eligible: boolean;
    amount: number;
    reason: string;
  } {
    const maxAGI = 5000000; // $50,000 in cents
    const maxCredit = 100000; // $1,000 in cents
    const creditRate = 0.15; // 15% of rent paid

    if (agi > maxAGI) {
      return {
        eligible: false,
        amount: 0,
        reason: `AGI ($${(agi / 100).toFixed(2)}) exceeds $50,000 limit for Renters' Credit`,
      };
    }

    if (!rentPaid || rentPaid <= 0) {
      return {
        eligible: false,
        amount: 0,
        reason: "No rent paid - not eligible for Renters' Credit",
      };
    }

    const calculatedCredit = Math.round(rentPaid * creditRate);
    const creditAmount = Math.min(maxCredit, calculatedCredit);

    return {
      eligible: true,
      amount: creditAmount,
      reason: `Renters' Credit: 15% of $${(rentPaid / 100).toFixed(2)} rent = $${(creditAmount / 100).toFixed(2)} (max $1,000)`,
    };
  }

  /**
   * Calculate Maryland Homeowners' Property Tax Credit
   * Reference: Maryland Tax-Property Article § 9-104
   */
  private calculatePropertyTaxCredit(propertyTaxPaid: number, agi: number): {
    eligible: boolean;
    amount: number;
    reason: string;
  } {
    const maxAGI = 6000000; // $60,000 in cents
    const maxCredit = 120000; // $1,200 in cents

    if (agi > maxAGI) {
      return {
        eligible: false,
        amount: 0,
        reason: `AGI ($${(agi / 100).toFixed(2)}) exceeds $60,000 limit for Property Tax Credit`,
      };
    }

    if (!propertyTaxPaid || propertyTaxPaid <= 0) {
      return {
        eligible: false,
        amount: 0,
        reason: "No property tax paid - not eligible for Property Tax Credit",
      };
    }

    // Credit rate based on income (higher rate for lower income)
    const lowIncomeThreshold = 3000000; // $30,000 in cents
    const creditRate = agi < lowIncomeThreshold ? 0.8 : 0.6; // 80% for AGI < $30k, 60% otherwise

    const calculatedCredit = Math.round(propertyTaxPaid * creditRate);
    const creditAmount = Math.min(maxCredit, calculatedCredit);

    return {
      eligible: true,
      amount: creditAmount,
      reason: `Property Tax Credit: ${(creditRate * 100).toFixed(0)}% of $${(propertyTaxPaid / 100).toFixed(2)} = $${(creditAmount / 100).toFixed(2)} (max $1,200)`,
    };
  }

  /**
   * Calculate Maryland Poverty Level Credit
   * Reference: Maryland Tax-General Article § 10-704.1
   */
  private async calculatePovertyLevelCredit(
    agi: number,
    filingStatus: string,
    householdSize: number,
    taxYear: number
  ): Promise<{
    eligible: boolean;
    amount: number;
    reason: string;
  }> {
    const maxCredit = 50000; // $500 in cents

    // Get FPL for household
    const fpl = await this.getFederalPovertyLevel(householdSize, taxYear);
    const povertyThreshold = Math.round(fpl * 1.25); // 125% of FPL

    if (agi >= povertyThreshold) {
      return {
        eligible: false,
        amount: 0,
        reason: `AGI ($${(agi / 100).toFixed(2)}) exceeds 125% of poverty threshold ($${(povertyThreshold / 100).toFixed(2)})`,
      };
    }

    // Credit scales based on how far below threshold
    const incomeGap = povertyThreshold - agi;
    const calculatedCredit = Math.round(Math.min(maxCredit, incomeGap * 0.05));
    const creditAmount = Math.max(0, calculatedCredit);

    return {
      eligible: creditAmount > 0,
      amount: creditAmount,
      reason: creditAmount > 0
        ? `Poverty Level Credit: AGI below 125% FPL threshold = $${(creditAmount / 100).toFixed(2)}`
        : "AGI too close to poverty threshold for credit",
    };
  }

  /**
   * Main tax credits eligibility calculation
   */
  async calculateEligibility(
    input: TaxCreditsInput
  ): Promise<TaxCreditsEligibilityResult> {
    const breakdown: string[] = [];
    const citations: string[] = [];
    const ineligibilityReasons: string[] = [];
    const creditsBreakdown: Array<{
      creditType: string;
      eligible: boolean;
      amount: number;
      reason: string;
    }> = [];

    const taxYear = input.taxYear || 2025;
    const agi = input.adjustedGrossIncome;

    breakdown.push(`Maryland Tax Credits Calculation (Tax Year ${taxYear})`);
    breakdown.push(`AGI: $${(agi / 100).toFixed(2)}`);
    breakdown.push(`Household Size: ${input.householdSize}`);
    breakdown.push(`Filing Status: ${input.filingStatus}`);

    // Calculate Renters' Credit
    let rentersCredit = 0;
    if (input.isRenter && input.rentPaid) {
      const renterResult = this.calculateRentersTaxCredit(input.rentPaid, agi);
      rentersCredit = renterResult.amount;
      
      creditsBreakdown.push({
        creditType: "Renters' Tax Credit",
        eligible: renterResult.eligible,
        amount: renterResult.amount,
        reason: renterResult.reason,
      });
      
      breakdown.push(`\n--- Renters' Tax Credit ---`);
      breakdown.push(renterResult.reason);
      
      if (renterResult.eligible) {
        citations.push("Maryland Tax-General Article § 10-704 - Renters' Tax Credit");
      } else {
        ineligibilityReasons.push(renterResult.reason);
      }
    }

    // Calculate Property Tax Credit
    let propertyTaxCredit = 0;
    if (input.isHomeowner && input.propertyTaxPaid) {
      const propertyResult = this.calculatePropertyTaxCredit(input.propertyTaxPaid, agi);
      propertyTaxCredit = propertyResult.amount;
      
      creditsBreakdown.push({
        creditType: "Homeowners' Property Tax Credit",
        eligible: propertyResult.eligible,
        amount: propertyResult.amount,
        reason: propertyResult.reason,
      });
      
      breakdown.push(`\n--- Homeowners' Property Tax Credit ---`);
      breakdown.push(propertyResult.reason);
      
      if (propertyResult.eligible) {
        citations.push("Maryland Tax-Property Article § 9-104 - Homeowners' Property Tax Credit");
      } else {
        ineligibilityReasons.push(propertyResult.reason);
      }
    }

    // Calculate Poverty Level Credit
    const povertyResult = await this.calculatePovertyLevelCredit(
      agi,
      input.filingStatus,
      input.householdSize,
      taxYear
    );
    const povertyLevelCredit = povertyResult.amount;
    
    creditsBreakdown.push({
      creditType: "Poverty Level Credit",
      eligible: povertyResult.eligible,
      amount: povertyResult.amount,
      reason: povertyResult.reason,
    });
    
    breakdown.push(`\n--- Poverty Level Credit ---`);
    breakdown.push(povertyResult.reason);
    
    if (povertyResult.eligible) {
      citations.push("Maryland Tax-General Article § 10-704.1 - Poverty Level Credit");
    } else {
      ineligibilityReasons.push(povertyResult.reason);
    }

    // Calculate total credits
    const totalCredits = rentersCredit + propertyTaxCredit + povertyLevelCredit;
    const isEligible = totalCredits > 0;

    breakdown.push(`\n--- Total Credits ---`);
    breakdown.push(`Total Maryland Tax Credits: $${(totalCredits / 100).toFixed(2)}`);

    // Generate summary reason
    const eligibleCredits: string[] = [];
    if (rentersCredit > 0) eligibleCredits.push(`Renters' ($${(rentersCredit / 100).toFixed(2)})`);
    if (propertyTaxCredit > 0) eligibleCredits.push(`Property Tax ($${(propertyTaxCredit / 100).toFixed(2)})`);
    if (povertyLevelCredit > 0) eligibleCredits.push(`Poverty Level ($${(povertyLevelCredit / 100).toFixed(2)})`);

    const reason = isEligible
      ? `Eligible for Maryland tax credits: ${eligibleCredits.join(", ")}. Total: $${(totalCredits / 100).toFixed(2)}`
      : "Not eligible for any Maryland tax credits based on income and household information";

    return {
      isEligible,
      totalCredits,
      rentersCredit,
      propertyTaxCredit,
      povertyLevelCredit,
      creditsBreakdown,
      reason,
      ineligibilityReasons: isEligible ? [] : ineligibilityReasons,
      calculationBreakdown: breakdown,
      policyCitations: citations,
    };
  }
}

export const marylandTaxCreditsRulesEngine = new MarylandTaxCreditsRulesEngine();
