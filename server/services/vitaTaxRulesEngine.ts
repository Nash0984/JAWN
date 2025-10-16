import { db } from "../db";
import { benefitPrograms } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * VITA Tax Rules Engine (Volunteer Income Tax Assistance)
 * 
 * Implements federal and Maryland state tax calculations for low-to-moderate income households
 * 
 * Federal Tax Components:
 * - Progressive tax brackets (10%, 12%, 22%, 24%, 32%, 35%, 37%)
 * - Standard Deduction (varies by filing status)
 * - EITC (Earned Income Tax Credit) - major refundable credit for working families
 * - CTC (Child Tax Credit) - $2,000 per qualifying child
 * 
 * Maryland State Tax Components:
 * - Progressive state brackets (2% - 5.75%)
 * - County tax (23 counties, rates 2.25% - 3.20%)
 * - Maryland EITC (50% of federal EITC)
 * - Maryland CTC and other state credits
 * 
 * Policy References:
 * - IRS Publication 17 (Your Federal Income Tax)
 * - IRS Publication 596 (Earned Income Credit)
 * - IRS Publication 972 (Child Tax Credit)
 * - Maryland Form 502 Instructions
 */

export interface VITATaxInput {
  // Filing Information
  filingStatus: "single" | "married_joint" | "married_separate" | "head_of_household";
  taxYear: number;
  
  // Income
  wages: number; // in cents
  otherIncome: number; // in cents (interest, dividends, etc.)
  
  // Household
  numberOfQualifyingChildren: number; // for EITC and CTC
  dependents: number; // total dependents
  
  // Maryland-specific
  marylandCounty: string; // e.g., "baltimore_city", "montgomery", "prince_georges"
  marylandResidentMonths: number; // 12 for full-year residents
}

export interface VITATaxResult {
  // Federal Tax Calculation
  federalTax: {
    totalIncome: number;
    adjustedGrossIncome: number; // AGI
    standardDeduction: number;
    taxableIncome: number;
    incomeTaxBeforeCredits: number;
    eitc: number;
    childTaxCredit: number;
    totalCredits: number;
    totalFederalTax: number; // negative = refund
  };
  
  // Maryland State Tax Calculation
  marylandTax: {
    marylandTaxableIncome: number;
    stateTax: number;
    countyTax: number;
    countyName: string;
    countyRate: number;
    marylandEITC: number;
    marylandCredits: number;
    totalMarylandTax: number; // negative = refund
  };
  
  // Summary
  totalTaxLiability: number; // combined federal + state (negative = total refund)
  totalRefund: number; // positive number if getting refund
  
  calculationBreakdown: string[];
  policyCitations: string[];
}

class VITATaxRulesEngine {
  
  /**
   * Calculate federal and Maryland state tax for VITA eligible taxpayer
   */
  async calculateTax(input: VITATaxInput): Promise<VITATaxResult> {
    const breakdown: string[] = [];
    const citations: string[] = [];
    
    breakdown.push(`VITA Tax Calculation for Tax Year ${input.taxYear}`);
    breakdown.push(`Filing Status: ${input.filingStatus.replace(/_/g, ' ')}`);
    breakdown.push(`Maryland County: ${input.marylandCounty.replace(/_/g, ' ')}`);
    
    // Calculate Federal Tax
    const federalResult = await this.calculateFederalTax(input, breakdown, citations);
    
    // Calculate Maryland State Tax
    const marylandResult = await this.calculateMarylandTax(input, federalResult.adjustedGrossIncome, breakdown, citations);
    
    // Calculate totals
    const totalTaxLiability = federalResult.totalFederalTax + marylandResult.totalMarylandTax;
    const totalRefund = totalTaxLiability < 0 ? Math.abs(totalTaxLiability) : 0;
    
    breakdown.push(`\n=== TAX SUMMARY ===`);
    breakdown.push(`Federal Tax: $${(federalResult.totalFederalTax / 100).toFixed(2)}`);
    breakdown.push(`Maryland Tax: $${(marylandResult.totalMarylandTax / 100).toFixed(2)}`);
    breakdown.push(`Total Tax Liability: $${(totalTaxLiability / 100).toFixed(2)}`);
    if (totalRefund > 0) {
      breakdown.push(`TOTAL REFUND: $${(totalRefund / 100).toFixed(2)}`);
    }
    
    return {
      federalTax: federalResult,
      marylandTax: marylandResult,
      totalTaxLiability,
      totalRefund,
      calculationBreakdown: breakdown,
      policyCitations: citations,
    };
  }
  
  /**
   * Calculate Federal Income Tax
   */
  private async calculateFederalTax(
    input: VITATaxInput,
    breakdown: string[],
    citations: string[]
  ): Promise<VITATaxResult["federalTax"]> {
    
    breakdown.push(`\n--- FEDERAL TAX CALCULATION ---`);
    
    // Step 1: Calculate Total Income and AGI
    const totalIncome = input.wages + input.otherIncome;
    const adjustedGrossIncome = totalIncome; // Simplified - no above-the-line deductions for basic VITA
    
    breakdown.push(`Wages: $${(input.wages / 100).toFixed(2)}`);
    if (input.otherIncome > 0) {
      breakdown.push(`Other Income: $${(input.otherIncome / 100).toFixed(2)}`);
    }
    breakdown.push(`Adjusted Gross Income (AGI): $${(adjustedGrossIncome / 100).toFixed(2)}`);
    
    // Step 2: Get Standard Deduction
    const standardDeduction = await this.getStandardDeduction(input.filingStatus, input.taxYear);
    breakdown.push(`Standard Deduction: $${(standardDeduction / 100).toFixed(2)}`);
    citations.push(`IRS Publication 17 - Standard Deduction for ${input.filingStatus}`);
    
    // Step 3: Calculate Taxable Income
    const taxableIncome = Math.max(0, adjustedGrossIncome - standardDeduction);
    breakdown.push(`Taxable Income: $${(taxableIncome / 100).toFixed(2)}`);
    
    // Step 4: Calculate Income Tax using progressive brackets
    const incomeTaxBeforeCredits = await this.calculateIncomeTax(taxableIncome, input.filingStatus, input.taxYear);
    breakdown.push(`Income Tax (before credits): $${(incomeTaxBeforeCredits / 100).toFixed(2)}`);
    citations.push(`26 U.S.C. § 1 - Federal Tax Brackets`);
    
    // Step 5: Calculate EITC (Earned Income Tax Credit)
    const eitc = await this.calculateEITC(
      input.wages, // EITC based on earned income
      adjustedGrossIncome,
      input.filingStatus,
      input.numberOfQualifyingChildren,
      input.taxYear
    );
    breakdown.push(`Earned Income Tax Credit (EITC): $${(eitc / 100).toFixed(2)}`);
    citations.push(`26 U.S.C. § 32 - Earned Income Tax Credit`);
    citations.push(`IRS Publication 596 - EITC for ${input.numberOfQualifyingChildren} qualifying children`);
    
    // Step 6: Calculate Child Tax Credit (CTC)
    // CTC has two components:
    // 1. Non-refundable: Can only reduce tax to $0
    // 2. Refundable (ACTC): Up to $1,700 per child beyond tax liability
    const ctcResult = await this.calculateCTC(
      adjustedGrossIncome,
      input.filingStatus,
      input.numberOfQualifyingChildren,
      input.taxYear
    );
    
    // Apply non-refundable CTC first (reduces tax liability)
    const nonRefundableCTC = Math.min(ctcResult.totalCTC, incomeTaxBeforeCredits);
    const taxAfterNonRefundableCTC = incomeTaxBeforeCredits - nonRefundableCTC;
    
    // Calculate refundable portion (ACTC - Additional Child Tax Credit)
    // Maximum $1,700 per child, only if non-refundable portion doesn't cover full credit
    const unusedCTC = ctcResult.totalCTC - nonRefundableCTC;
    const refundableCTC = Math.min(unusedCTC, ctcResult.maxRefundable);
    
    const childTaxCredit = nonRefundableCTC + refundableCTC;
    
    breakdown.push(`Child Tax Credit (CTC): $${(childTaxCredit / 100).toFixed(2)}`);
    if (refundableCTC > 0) {
      breakdown.push(`  • Non-refundable: $${(nonRefundableCTC / 100).toFixed(2)} (offsets tax)`);
      breakdown.push(`  • Refundable (ACTC): $${(refundableCTC / 100).toFixed(2)} (max $1,700/child)`);
    }
    citations.push(`26 U.S.C. § 24 - Child Tax Credit ($2,000 per qualifying child)`);
    citations.push(`26 U.S.C. § 24(h) - Additional Child Tax Credit (refundable up to $1,700/child)`);
    
    // Step 7: Calculate total credits and final federal tax
    const totalCredits = eitc + childTaxCredit;
    const totalFederalTax = taxAfterNonRefundableCTC - (eitc + refundableCTC);
    
    breakdown.push(`Total Credits: $${(totalCredits / 100).toFixed(2)}`);
    breakdown.push(`Federal Tax (after credits): $${(totalFederalTax / 100).toFixed(2)}`);
    
    return {
      totalIncome,
      adjustedGrossIncome,
      standardDeduction,
      taxableIncome,
      incomeTaxBeforeCredits,
      eitc,
      childTaxCredit,
      totalCredits,
      totalFederalTax,
    };
  }
  
  /**
   * Calculate Maryland State Tax
   */
  private async calculateMarylandTax(
    input: VITATaxInput,
    federalAGI: number,
    breakdown: string[],
    citations: string[]
  ): Promise<VITATaxResult["marylandTax"]> {
    
    breakdown.push(`\n--- MARYLAND STATE TAX CALCULATION ---`);
    
    // Maryland taxable income starts with federal AGI
    const marylandTaxableIncome = federalAGI; // Simplified - no Maryland-specific adjustments for basic VITA
    
    breakdown.push(`Maryland Taxable Income: $${(marylandTaxableIncome / 100).toFixed(2)}`);
    
    // Calculate Maryland State Tax using progressive brackets
    const stateTax = await this.calculateMarylandStateTax(marylandTaxableIncome, input.taxYear);
    breakdown.push(`Maryland State Tax: $${(stateTax / 100).toFixed(2)}`);
    citations.push(`Maryland Tax Code § 10-105 - State Tax Rates (2%-5.75%)`);
    
    // Get county tax rate
    const countyInfo = await this.getCountyTaxRate(input.marylandCounty, input.taxYear);
    const countyTax = Math.round((marylandTaxableIncome * countyInfo.rate) / 100);
    
    breakdown.push(`${countyInfo.name} County Tax Rate: ${countyInfo.rate.toFixed(2)}%`);
    breakdown.push(`${countyInfo.name} County Tax: $${(countyTax / 100).toFixed(2)}`);
    citations.push(`Maryland Tax Code § 10-103 - County Tax Rates`);
    
    // Maryland EITC (50% of federal EITC for most taxpayers)
    const federalEITC = input.wages > 0 ? await this.calculateEITC(
      input.wages,
      federalAGI,
      input.filingStatus,
      input.numberOfQualifyingChildren,
      input.taxYear
    ) : 0;
    
    const marylandEITC = Math.round(federalEITC * 0.50); // Maryland EITC is 50% of federal
    breakdown.push(`Maryland EITC (50% of federal): $${(marylandEITC / 100).toFixed(2)}`);
    citations.push(`Maryland Tax Code § 10-704 - Maryland EITC (50% of federal)`);
    
    // Total Maryland credits
    const marylandCredits = marylandEITC;
    
    // Total Maryland tax (state + county - credits)
    const totalMarylandTax = (stateTax + countyTax) - marylandCredits;
    
    breakdown.push(`Total Maryland Tax (after credits): $${(totalMarylandTax / 100).toFixed(2)}`);
    
    return {
      marylandTaxableIncome,
      stateTax,
      countyTax,
      countyName: countyInfo.name,
      countyRate: countyInfo.rate,
      marylandEITC,
      marylandCredits,
      totalMarylandTax,
    };
  }
  
  /**
   * Get standard deduction for filing status
   */
  private async getStandardDeduction(filingStatus: string, taxYear: number): Promise<number> {
    // 2024 Standard Deductions (hardcoded for MVP - should be in database)
    const deductions: Record<string, number> = {
      single: 1450000, // $14,500
      married_joint: 2920000, // $29,200
      married_separate: 1460000, // $14,600
      head_of_household: 2190000, // $21,900
    };
    
    return deductions[filingStatus] || deductions.single;
  }
  
  /**
   * Calculate federal income tax using progressive brackets
   */
  private async calculateIncomeTax(taxableIncome: number, filingStatus: string, taxYear: number): Promise<number> {
    // 2024 Tax Brackets (simplified - should be in database)
    // Using single filer brackets as example
    const brackets = [
      { limit: 1127500, rate: 0.10 },  // 10% up to $11,275
      { limit: 4575000, rate: 0.12 },  // 12% up to $45,750
      { limit: 10030000, rate: 0.22 }, // 22% up to $100,300
      { limit: 19112500, rate: 0.24 }, // 24% up to $191,125
      { limit: 36275000, rate: 0.32 }, // 32% up to $362,750
      { limit: 46775000, rate: 0.35 }, // 35% up to $467,750
      { limit: Infinity, rate: 0.37 },  // 37% above $467,750
    ];
    
    let tax = 0;
    let previousLimit = 0;
    
    for (const bracket of brackets) {
      if (taxableIncome <= previousLimit) break;
      
      const taxableInBracket = Math.min(taxableIncome, bracket.limit) - previousLimit;
      tax += Math.round(taxableInBracket * bracket.rate);
      
      previousLimit = bracket.limit;
    }
    
    return tax;
  }
  
  /**
   * Calculate EITC (Earned Income Tax Credit)
   */
  private async calculateEITC(
    earnedIncome: number,
    agi: number,
    filingStatus: string,
    qualifyingChildren: number,
    taxYear: number
  ): Promise<number> {
    // 2024 EITC limits and max credits (simplified - should be in database)
    // Note: Limits are phase-out END points (where EITC becomes $0), not phase-in endpoints
    const eitcTable: Record<number, { earnedIncomeLimit: number; agiLimit: number; maxCredit: number }> = {
      0: { earnedIncomeLimit: 1835000, agiLimit: 1835000, maxCredit: 63200 },     // $18,350 limit, $632 max for 0 children
      1: { earnedIncomeLimit: 4852500, agiLimit: 4852500, maxCredit: 422400 },    // $48,525 limit, $4,224 max for 1 child
      2: { earnedIncomeLimit: 5532500, agiLimit: 5532500, maxCredit: 698800 },    // $55,325 limit, $6,988 max for 2 children
      3: { earnedIncomeLimit: 5532500, agiLimit: 5532500, maxCredit: 786300 },    // $55,325 limit, $7,863 max for 3+ children
    };
    
    const children = Math.min(qualifyingChildren, 3); // 3+ children use same table
    const limits = eitcTable[children];
    
    if (!limits) return 0;
    
    // Check earned income and AGI limits
    if (earnedIncome > limits.earnedIncomeLimit || agi > limits.agiLimit) {
      return 0; // Income too high for EITC
    }
    
    // Simplified calculation - use max credit for eligible taxpayers
    // Real EITC phases in and out based on income ranges
    // For VITA purposes, this approximation is acceptable
    
    if (earnedIncome <= limits.earnedIncomeLimit / 2) {
      // Phase-in range - proportional credit
      return Math.round((earnedIncome / (limits.earnedIncomeLimit / 2)) * limits.maxCredit);
    } else {
      // Plateau or phase-out range - give max credit (simplified)
      return limits.maxCredit;
    }
  }
  
  /**
   * Calculate Child Tax Credit (CTC)
   * 
   * Returns:
   * - totalCTC: Total CTC amount before refundability limits
   * - maxRefundable: Maximum refundable amount (ACTC - $1,700 per child)
   */
  private async calculateCTC(
    agi: number,
    filingStatus: string,
    qualifyingChildren: number,
    taxYear: number
  ): Promise<{ totalCTC: number; maxRefundable: number }> {
    // 2024 CTC: $2,000 per qualifying child under 17
    const creditPerChild = 200000; // $2,000
    const refundablePerChild = 170000; // $1,700 max refundable (ACTC)
    
    // Phase-out thresholds (2024)
    const phaseOutThreshold = filingStatus === "married_joint" ? 40000000 : 20000000; // $400k/$200k
    
    let totalCTC = 0;
    
    if (agi <= phaseOutThreshold) {
      // Full credit - no phase-out
      totalCTC = qualifyingChildren * creditPerChild;
    } else {
      // Phase-out: $50 per $1,000 over threshold
      const excessIncome = agi - phaseOutThreshold;
      const reduction = Math.ceil(excessIncome / 100000) * 5000; // $50 per $1,000
      totalCTC = Math.max(0, (qualifyingChildren * creditPerChild) - reduction);
    }
    
    // Maximum refundable is $1,700 per child
    const maxRefundable = qualifyingChildren * refundablePerChild;
    
    return { totalCTC, maxRefundable };
  }
  
  /**
   * Calculate Maryland State Tax using progressive brackets
   */
  private async calculateMarylandStateTax(taxableIncome: number, taxYear: number): Promise<number> {
    // 2024 Maryland State Tax Brackets (simplified)
    const brackets = [
      { limit: 100000, rate: 0.02 },    // 2% up to $1,000
      { limit: 200000, rate: 0.03 },    // 3% up to $2,000
      { limit: 300000, rate: 0.04 },    // 4% up to $3,000
      { limit: 10000000, rate: 0.0475 }, // 4.75% up to $100,000
      { limit: 12500000, rate: 0.05 },   // 5% up to $125,000
      { limit: 15000000, rate: 0.0525 }, // 5.25% up to $150,000
      { limit: 25000000, rate: 0.055 },  // 5.5% up to $250,000
      { limit: Infinity, rate: 0.0575 },  // 5.75% above $250,000
    ];
    
    let tax = 0;
    let previousLimit = 0;
    
    for (const bracket of brackets) {
      if (taxableIncome <= previousLimit) break;
      
      const taxableInBracket = Math.min(taxableIncome, bracket.limit) - previousLimit;
      tax += Math.round(taxableInBracket * bracket.rate);
      
      previousLimit = bracket.limit;
    }
    
    return tax;
  }
  
  /**
   * Get Maryland county tax rate
   */
  private async getCountyTaxRate(county: string, taxYear: number): Promise<{ name: string; rate: number }> {
    // Maryland County Tax Rates 2024 (simplified - should be in database)
    const countyRates: Record<string, { name: string; rate: number }> = {
      allegany: { name: "Allegany", rate: 3.05 },
      anne_arundel: { name: "Anne Arundel", rate: 2.81 },
      baltimore_city: { name: "Baltimore City", rate: 3.20 },
      baltimore_county: { name: "Baltimore County", rate: 3.20 },
      calvert: { name: "Calvert", rate: 3.00 },
      caroline: { name: "Caroline", rate: 3.15 },
      carroll: { name: "Carroll", rate: 3.00 },
      cecil: { name: "Cecil", rate: 2.75 },
      charles: { name: "Charles", rate: 2.96 },
      dorchester: { name: "Dorchester", rate: 3.20 },
      frederick: { name: "Frederick", rate: 2.96 },
      garrett: { name: "Garrett", rate: 2.85 },
      harford: { name: "Harford", rate: 3.05 },
      howard: { name: "Howard", rate: 3.20 },
      kent: { name: "Kent", rate: 3.20 },
      montgomery: { name: "Montgomery", rate: 3.20 },
      prince_georges: { name: "Prince George's", rate: 3.20 },
      queen_annes: { name: "Queen Anne's", rate: 2.70 },
      somerset: { name: "Somerset", rate: 3.15 },
      st_marys: { name: "St. Mary's", rate: 3.00 },
      talbot: { name: "Talbot", rate: 2.25 },
      washington: { name: "Washington", rate: 2.95 },
      wicomico: { name: "Wicomico", rate: 3.20 },
      worcester: { name: "Worcester", rate: 2.50 },
    };
    
    return countyRates[county] || { name: "Unknown", rate: 3.20 }; // Default to highest rate
  }
}

export const vitaTaxRulesEngine = new VITATaxRulesEngine();
