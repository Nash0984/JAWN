import { jsPDF } from 'jspdf';
import type { TaxCalculationResult, TaxHouseholdInput } from './policyEngineTaxCalculation';
import { db } from '../db';
import { countyTaxRates } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Maryland Form 502 PDF Generator
 * 
 * Generates printable Maryland Form 502 (Maryland Resident Income Tax Return) PDF
 * from federal Form 1040 data and PolicyEngine calculations.
 * 
 * Features:
 * - Maryland AGI (federal AGI with MD-specific additions/subtractions)
 * - Progressive state tax brackets (2% to 5.75%)
 * - County tax calculation with county-specific rates
 * - Maryland EITC (50% of federal EITC)
 * - Poverty level credit
 * - Property tax credit / Homeowners credit
 * - Renter's tax credit
 * - Professional PDF layout matching MD Comptroller format
 * - DRAFT watermark for navigator review
 * 
 * Supports Maryland DHS Navigator workflow: Federal → State → Review → Generate PDF
 */

export interface Form502PersonalInfo {
  // Taxpayer
  taxpayerFirstName: string;
  taxpayerLastName: string;
  taxpayerSSN: string;
  
  // Spouse (if married filing jointly)
  spouseFirstName?: string;
  spouseLastName?: string;
  spouseSSN?: string;
  
  // Address
  streetAddress: string;
  aptNumber?: string;
  city: string;
  state: string;
  zipCode: string;
  county: string; // Maryland county for local tax
  
  // Dependents
  dependents?: Array<{
    firstName: string;
    lastName: string;
    ssn: string;
    relationship: string;
  }>;
  
  // Maryland-specific
  marylandResident: boolean;
  yearsInMaryland?: number;
}

export interface MarylandSpecificInput {
  // Additions to federal AGI
  stateTaxRefund?: number; // State/local tax refunds received
  
  // Subtractions from federal AGI
  socialSecurityBenefits?: number; // Full SS benefits (subtract from MD AGI)
  railroadRetirement?: number;
  pensionIncome?: number; // Up to $35,700 deductible
  
  // Credits
  propertyTaxPaid?: number; // For property tax credit
  rentPaid?: number; // For renter's tax credit
  
  // Other Maryland items
  childcareExpenses?: number;
  marylandWithholding?: number; // State tax withheld
}

export interface Form502Options {
  taxYear: number;
  preparerName?: string;
  preparerPTIN?: string;
  preparationDate?: Date;
  includeWatermark?: boolean;
}

export interface MarylandTaxResult {
  // Maryland AGI calculation
  federalAGI: number;
  marylandAdditions: number;
  marylandSubtractions: number;
  marylandAGI: number;
  
  // Deductions
  marylandStandardDeduction: number;
  marylandItemizedDeduction: number;
  marylandDeduction: number;
  marylandTaxableIncome: number;
  
  // State tax calculation
  marylandStateTax: number;
  countyTax: number;
  totalMarylandTax: number;
  
  // Credits
  marylandEITC: number; // 50% of federal EITC
  povertyLevelCredit: number;
  propertyTaxCredit: number;
  rentersTaxCredit: number;
  totalMarylandCredits: number;
  
  // Net tax and refund
  taxAfterCredits: number;
  marylandWithholding: number;
  marylandRefund: number; // Positive = refund, Negative = owed
  
  // Breakdown
  countyRate: number;
  effectiveMarylandRate: number;
}

// Maryland county tax rates (2024)
const COUNTY_TAX_RATES: Record<string, { min: number; max: number }> = {
  'ALLEGANY': { min: 0.0225, max: 0.032 },
  'ANNE ARUNDEL': { min: 0.0225, max: 0.032 },
  'BALTIMORE CITY': { min: 0.032, max: 0.032 },
  'BALTIMORE COUNTY': { min: 0.0225, max: 0.032 },
  'CALVERT': { min: 0.0225, max: 0.03 },
  'CAROLINE': { min: 0.0225, max: 0.0285 },
  'CARROLL': { min: 0.0225, max: 0.03 },
  'CECIL': { min: 0.0225, max: 0.028 },
  'CHARLES': { min: 0.0225, max: 0.03 },
  'DORCHESTER': { min: 0.0225, max: 0.0262 },
  'FREDERICK': { min: 0.0225, max: 0.0296 },
  'GARRETT': { min: 0.0225, max: 0.0265 },
  'HARFORD': { min: 0.0225, max: 0.0306 },
  'HOWARD': { min: 0.0225, max: 0.032 },
  'KENT': { min: 0.0225, max: 0.032 },
  'MONTGOMERY': { min: 0.0225, max: 0.032 },
  'PRINCE GEORGE\'S': { min: 0.0225, max: 0.032 },
  'QUEEN ANNE\'S': { min: 0.0225, max: 0.032 },
  'ST. MARY\'S': { min: 0.0225, max: 0.03175 },
  'SOMERSET': { min: 0.0225, max: 0.032 },
  'TALBOT': { min: 0.0225, max: 0.0248 },
  'WASHINGTON': { min: 0.0225, max: 0.028 },
  'WICOMICO': { min: 0.0225, max: 0.032 },
  'WORCESTER': { min: 0.0225, max: 0.0125 }
};

// Maryland state tax brackets (2024)
const MARYLAND_TAX_BRACKETS = [
  { limit: 1000, rate: 0.02 },
  { limit: 2000, rate: 0.03 },
  { limit: 3000, rate: 0.04 },
  { limit: 100000, rate: 0.0475 },
  { limit: 125000, rate: 0.05 },
  { limit: 150000, rate: 0.0525 },
  { limit: 250000, rate: 0.055 },
  { limit: Infinity, rate: 0.0575 }
];

// Maryland standard deductions (2024)
const MARYLAND_STANDARD_DEDUCTIONS: Record<string, number> = {
  'single': 2350,
  'married_joint': 4700,
  'married_separate': 2350,
  'head_of_household': 2350,
  'qualifying_widow': 4700
};

export class Form502Generator {
  private doc!: jsPDF;
  private readonly pageWidth = 8.5 * 72;
  private readonly pageHeight = 11 * 72;
  private readonly margin = 0.5 * 72;
  private readonly lineHeight = 14;
  private currentY = this.margin;
  
  /**
   * Calculate Maryland tax from federal tax results
   */
  async calculateMarylandTax(
    federalTaxResult: TaxCalculationResult,
    taxInput: TaxHouseholdInput,
    marylandInput: MarylandSpecificInput,
    county: string,
    taxYear: number = 2025
  ): Promise<MarylandTaxResult> {
    const federalAGI = federalTaxResult.adjustedGrossIncome;
    
    // Maryland additions to federal AGI
    const marylandAdditions = marylandInput.stateTaxRefund || 0;
    
    // Maryland subtractions from federal AGI
    const ssSubtraction = marylandInput.socialSecurityBenefits || 0;
    const railroadSubtraction = marylandInput.railroadRetirement || 0;
    const pensionSubtraction = Math.min(marylandInput.pensionIncome || 0, 35700);
    const marylandSubtractions = ssSubtraction + railroadSubtraction + pensionSubtraction;
    
    // Maryland AGI
    const marylandAGI = federalAGI + marylandAdditions - marylandSubtractions;
    
    // Maryland deductions
    const marylandStandardDeduction = MARYLAND_STANDARD_DEDUCTIONS[taxInput.filingStatus] || 2350;
    const marylandItemizedDeduction = federalTaxResult.deductionBreakdown.itemizedDeduction * 0.85; // MD allows 85% of federal itemized
    const marylandDeduction = Math.max(marylandStandardDeduction, marylandItemizedDeduction);
    
    // Maryland taxable income
    const marylandTaxableIncome = Math.max(0, marylandAGI - marylandDeduction);
    
    // Calculate Maryland state tax using progressive brackets
    const marylandStateTax = this.calculateProgressiveTax(marylandTaxableIncome, MARYLAND_TAX_BRACKETS);
    
    // Calculate county tax (fetch from database with fallback to hard-coded rates)
    const countyRate = await this.getCountyTaxRate(county, marylandTaxableIncome, taxYear);
    const countyTax = marylandTaxableIncome * countyRate;
    
    const totalMarylandTax = marylandStateTax + countyTax;
    
    // Maryland EITC (50% of federal EITC for 2024)
    const marylandEITC = federalTaxResult.eitc * 0.50;
    
    // Poverty level credit (simplified calculation)
    const povertyLevelCredit = this.calculatePovertyLevelCredit(marylandAGI, taxInput.filingStatus);
    
    // Property tax credit
    const propertyTaxCredit = this.calculatePropertyTaxCredit(
      marylandInput.propertyTaxPaid || 0,
      marylandAGI
    );
    
    // Renter's tax credit
    const rentersTaxCredit = this.calculateRentersTaxCredit(
      marylandInput.rentPaid || 0,
      marylandAGI
    );
    
    const totalMarylandCredits = marylandEITC + povertyLevelCredit + propertyTaxCredit + rentersTaxCredit;
    
    // Tax after credits
    const taxAfterCredits = Math.max(0, totalMarylandTax - totalMarylandCredits);
    
    // Withholding and refund
    const marylandWithholding = marylandInput.marylandWithholding || 0;
    const marylandRefund = marylandWithholding - taxAfterCredits;
    
    // Effective rate
    const effectiveMarylandRate = marylandAGI > 0 ? (totalMarylandTax / marylandAGI) * 100 : 0;
    
    return {
      federalAGI,
      marylandAdditions,
      marylandSubtractions,
      marylandAGI,
      marylandStandardDeduction,
      marylandItemizedDeduction,
      marylandDeduction,
      marylandTaxableIncome,
      marylandStateTax,
      countyTax,
      totalMarylandTax,
      marylandEITC,
      povertyLevelCredit,
      propertyTaxCredit,
      rentersTaxCredit,
      totalMarylandCredits,
      taxAfterCredits,
      marylandWithholding,
      marylandRefund,
      countyRate,
      effectiveMarylandRate
    };
  }
  
  /**
   * Calculate progressive tax using brackets
   */
  private calculateProgressiveTax(
    income: number,
    brackets: Array<{ limit: number; rate: number }>
  ): number {
    let tax = 0;
    let previousLimit = 0;
    
    for (const bracket of brackets) {
      if (income <= previousLimit) break;
      
      const taxableInBracket = Math.min(income, bracket.limit) - previousLimit;
      tax += taxableInBracket * bracket.rate;
      
      previousLimit = bracket.limit;
    }
    
    return tax;
  }
  
  /**
   * Fetch county tax rates from database
   */
  private async fetchCountyRatesFromDB(county: string, taxYear: number): Promise<{ min: number; max: number } | null> {
    try {
      const countyUpper = county.toUpperCase().trim();
      const results = await db
        .select()
        .from(countyTaxRates)
        .where(
          and(
            eq(countyTaxRates.countyName, countyUpper),
            eq(countyTaxRates.taxYear, taxYear)
          )
        )
        .limit(1);
      
      if (results.length > 0) {
        return {
          min: results[0].minRate,
          max: results[0].maxRate,
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching county tax rates from database:', error);
      return null;
    }
  }

  /**
   * Get county tax rate (progressive based on income)
   * Fetches from database first, falls back to hard-coded rates
   */
  private async getCountyTaxRate(county: string, income: number, taxYear: number = 2025): Promise<number> {
    const countyUpper = county.toUpperCase().trim();
    
    // Try to fetch from database first
    const dbRates = await this.fetchCountyRatesFromDB(countyUpper, taxYear);
    
    // Fall back to hard-coded rates if database fetch fails
    const rates = dbRates || COUNTY_TAX_RATES[countyUpper] || { min: 0.0225, max: 0.032 };
    
    // Progressive county tax: use max rate for income over $50,000
    if (income > 50000) {
      return rates.max;
    } else if (income > 25000) {
      // Interpolate between min and max
      const ratio = (income - 25000) / 25000;
      return rates.min + (rates.max - rates.min) * ratio;
    } else {
      return rates.min;
    }
  }
  
  /**
   * Calculate Maryland poverty level credit
   */
  private calculatePovertyLevelCredit(agi: number, filingStatus: string): number {
    // Simplified poverty level credit (actual calculation is more complex)
    const povertyThreshold = filingStatus === 'married_joint' ? 25000 : 15000;
    
    if (agi < povertyThreshold * 1.25) {
      return Math.min(500, Math.max(0, (povertyThreshold * 1.25 - agi) * 0.05));
    }
    
    return 0;
  }
  
  /**
   * Calculate property tax credit
   */
  private calculatePropertyTaxCredit(propertyTaxPaid: number, agi: number): number {
    // Maryland property tax credit (up to certain limits)
    if (agi > 60000) return 0;
    
    const maxCredit = 1200;
    const creditRate = agi < 30000 ? 0.8 : 0.6;
    
    return Math.min(maxCredit, propertyTaxPaid * creditRate);
  }
  
  /**
   * Calculate renter's tax credit
   */
  private calculateRentersTaxCredit(rentPaid: number, agi: number): number {
    // Maryland renter's tax credit
    if (agi > 50000) return 0;
    
    const maxCredit = 1000;
    const creditRate = 0.15; // 15% of rent paid
    
    return Math.min(maxCredit, rentPaid * creditRate);
  }
  
  /**
   * Generate Form 502 PDF
   */
  async generateForm502(
    personalInfo: Form502PersonalInfo,
    taxInput: TaxHouseholdInput,
    federalTaxResult: TaxCalculationResult,
    marylandInput: MarylandSpecificInput,
    options: Form502Options
  ): Promise<{ pdf: Buffer; marylandTaxResult: MarylandTaxResult }> {
    // Calculate Maryland tax (with database lookup for county rates)
    const marylandTaxResult = await this.calculateMarylandTax(
      federalTaxResult,
      taxInput,
      marylandInput,
      personalInfo.county,
      options.taxYear
    );
    
    // Generate PDF
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter'
    });
    
    this.currentY = this.margin;
    
    // Add watermark
    if (options.includeWatermark !== false) {
      this.addWatermark();
    }
    
    // Form header
    this.drawFormHeader(options.taxYear);
    
    // Personal information
    this.drawPersonalInfo(personalInfo, taxInput.filingStatus);
    
    // Income and Maryland AGI
    this.drawIncomeSection(federalTaxResult, marylandTaxResult);
    
    // Deductions and taxable income
    this.drawDeductionsSection(marylandTaxResult);
    
    // Tax calculation
    this.drawTaxSection(marylandTaxResult, personalInfo.county);
    
    // Credits
    this.drawCreditsSection(marylandTaxResult);
    
    // Withholding and refund
    this.drawRefundSection(marylandTaxResult);
    
    // Signature section
    this.drawSignatureSection(options);
    
    // Preparer information
    if (options.preparerName) {
      this.drawPreparerInfo(options);
    }
    
    const pdfBuffer = Buffer.from(this.doc.output('arraybuffer'));
    
    return {
      pdf: pdfBuffer,
      marylandTaxResult
    };
  }
  
  /**
   * Add draft watermark
   */
  private addWatermark(): void {
    this.doc.setTextColor(220, 220, 220);
    this.doc.setFontSize(60);
    this.doc.text('DRAFT', this.pageWidth / 2, this.pageHeight / 2, {
      angle: 45,
      align: 'center'
    });
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(10);
  }
  
  /**
   * Draw form header
   */
  private drawFormHeader(taxYear: number): void {
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Form 502', this.margin, this.currentY);
    this.currentY += this.lineHeight + 5;
    
    this.doc.setFontSize(12);
    this.doc.text('Maryland Resident Income Tax Return', this.margin, this.currentY);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`${taxYear}`, this.pageWidth - this.margin - 40, this.currentY);
    
    this.currentY += this.lineHeight + 10;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 10;
  }
  
  /**
   * Draw personal information
   */
  private drawPersonalInfo(info: Form502PersonalInfo, filingStatus: string): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Taxpayer Information', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Name: ${info.taxpayerFirstName} ${info.taxpayerLastName}`, this.margin + 20, this.currentY);
    this.doc.text(`SSN: ${this.formatSSN(info.taxpayerSSN)}`, this.pageWidth - this.margin - 150, this.currentY);
    this.currentY += this.lineHeight;
    
    if (info.spouseFirstName && filingStatus === 'married_joint') {
      this.doc.text(`Spouse: ${info.spouseFirstName} ${info.spouseLastName}`, this.margin + 20, this.currentY);
      this.doc.text(`SSN: ${this.formatSSN(info.spouseSSN || '')}`, this.pageWidth - this.margin - 150, this.currentY);
      this.currentY += this.lineHeight;
    }
    
    this.doc.text(`Address: ${info.streetAddress}${info.aptNumber ? ` Apt ${info.aptNumber}` : ''}`, this.margin + 20, this.currentY);
    this.currentY += this.lineHeight;
    this.doc.text(`${info.city}, ${info.state} ${info.zipCode}`, this.margin + 20, this.currentY);
    this.currentY += this.lineHeight;
    this.doc.text(`County: ${info.county}`, this.margin + 20, this.currentY);
    this.currentY += this.lineHeight + 10;
  }
  
  /**
   * Draw income section
   */
  private drawIncomeSection(federalResult: TaxCalculationResult, mdResult: MarylandTaxResult): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Income', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    
    // Line 1: Federal AGI
    this.drawLine('1', 'Federal adjusted gross income (from Form 1040)', mdResult.federalAGI);
    
    // Line 2: Maryland additions
    this.drawLine('2', 'Maryland additions (state tax refunds)', mdResult.marylandAdditions);
    
    // Line 3: Subtotal
    const subtotal = mdResult.federalAGI + mdResult.marylandAdditions;
    this.drawLine('3', 'Add lines 1 and 2', subtotal);
    
    // Line 4: Maryland subtractions
    this.drawLine('4', 'Maryland subtractions (SS, pension, etc.)', mdResult.marylandSubtractions);
    
    this.currentY += 5;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
    
    // Line 5: Maryland AGI
    this.doc.setFont('helvetica', 'bold');
    this.drawLine('5', 'Maryland adjusted gross income', mdResult.marylandAGI);
    this.doc.setFont('helvetica', 'normal');
    this.currentY += 10;
  }
  
  /**
   * Draw deductions section
   */
  private drawDeductionsSection(mdResult: MarylandTaxResult): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Deductions', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    
    // Line 6: Deduction
    const deductionType = mdResult.marylandDeduction === mdResult.marylandStandardDeduction ? 'Standard' : 'Itemized';
    this.drawLine('6', `${deductionType} deduction`, mdResult.marylandDeduction);
    
    this.currentY += 5;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
    
    // Line 7: Taxable income
    this.doc.setFont('helvetica', 'bold');
    this.drawLine('7', 'Maryland taxable net income', mdResult.marylandTaxableIncome);
    this.doc.setFont('helvetica', 'normal');
    this.currentY += 10;
  }
  
  /**
   * Draw tax section
   */
  private drawTaxSection(mdResult: MarylandTaxResult, county: string): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Tax Computation', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    
    // Line 8: Maryland state tax
    this.drawLine('8', 'Maryland state tax', mdResult.marylandStateTax);
    
    // Line 9: County tax
    const countyRatePercent = (mdResult.countyRate * 100).toFixed(2);
    this.drawLine('9', `${county} County tax (${countyRatePercent}%)`, mdResult.countyTax);
    
    this.currentY += 5;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
    
    // Line 10: Total Maryland tax
    this.doc.setFont('helvetica', 'bold');
    this.drawLine('10', 'Total Maryland tax', mdResult.totalMarylandTax);
    this.doc.setFont('helvetica', 'normal');
    this.currentY += 10;
  }
  
  /**
   * Draw credits section
   */
  private drawCreditsSection(mdResult: MarylandTaxResult): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Credits', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    
    // Line 11: Maryland EITC
    this.drawLine('11', 'Maryland earned income tax credit (50% of federal)', mdResult.marylandEITC);
    
    // Line 12: Poverty level credit
    this.drawLine('12', 'Poverty level credit', mdResult.povertyLevelCredit);
    
    // Line 13: Property tax credit
    this.drawLine('13', 'Property tax credit', mdResult.propertyTaxCredit);
    
    // Line 14: Renter's tax credit
    this.drawLine('14', 'Renter\'s tax credit', mdResult.rentersTaxCredit);
    
    this.currentY += 5;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
    
    // Line 15: Total credits
    this.doc.setFont('helvetica', 'bold');
    this.drawLine('15', 'Total credits', mdResult.totalMarylandCredits);
    this.doc.setFont('helvetica', 'normal');
    this.currentY += 10;
    
    // Line 16: Tax after credits
    this.doc.setFont('helvetica', 'bold');
    this.drawLine('16', 'Tax after credits', mdResult.taxAfterCredits);
    this.doc.setFont('helvetica', 'normal');
    this.currentY += 10;
  }
  
  /**
   * Draw refund section
   */
  private drawRefundSection(mdResult: MarylandTaxResult): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Payments and Refund', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    
    // Line 17: Maryland withholding
    this.drawLine('17', 'Maryland income tax withheld', mdResult.marylandWithholding);
    
    this.currentY += 5;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
    
    if (mdResult.marylandRefund >= 0) {
      // Line 18: Refund
      this.doc.setFont('helvetica', 'bold');
      this.drawLine('18', 'Overpayment (REFUND)', mdResult.marylandRefund);
      this.doc.setFont('helvetica', 'normal');
      
      this.currentY += this.lineHeight;
      this.doc.text('Direct deposit to:', this.margin + 20, this.currentY);
      this.currentY += this.lineHeight;
      this.doc.text('Routing number: ________________', this.margin + 40, this.currentY);
      this.currentY += this.lineHeight;
      this.doc.text('Account number: ________________', this.margin + 40, this.currentY);
      this.currentY += this.lineHeight + 5;
    } else {
      // Line 19: Amount owed
      this.doc.setFont('helvetica', 'bold');
      this.drawLine('19', 'Amount you owe', Math.abs(mdResult.marylandRefund));
      this.doc.setFont('helvetica', 'normal');
      this.currentY += this.lineHeight + 5;
    }
  }
  
  /**
   * Draw signature section
   */
  private drawSignatureSection(options: Form502Options): void {
    this.currentY += 10;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 15;
    
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Declaration', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.text('Under penalties of perjury, I declare that I have examined this return, including', this.margin, this.currentY);
    this.currentY += 10;
    this.doc.text('accompanying schedules and statements, and to the best of my knowledge and belief,', this.margin, this.currentY);
    this.currentY += 10;
    this.doc.text('it is true, correct, and complete.', this.margin, this.currentY);
    this.currentY += 15;
    
    this.doc.setFontSize(10);
    this.doc.text('Your signature: _________________________________', this.margin, this.currentY);
    this.doc.text('Date: ______________', this.pageWidth - this.margin - 150, this.currentY);
    this.currentY += this.lineHeight + 5;
    
    this.doc.text('Spouse\'s signature (if filing jointly): _________________________', this.margin, this.currentY);
    this.doc.text('Date: ______________', this.pageWidth - this.margin - 150, this.currentY);
    this.currentY += this.lineHeight + 10;
  }
  
  /**
   * Draw preparer information
   */
  private drawPreparerInfo(options: Form502Options): void {
    this.currentY += 5;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 15;
    
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Paid Preparer Use Only', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Preparer's name: ${options.preparerName}`, this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    if (options.preparerPTIN) {
      this.doc.text(`PTIN: ${options.preparerPTIN}`, this.margin, this.currentY);
      this.currentY += this.lineHeight;
    }
    
    if (options.preparationDate) {
      this.doc.text(`Date: ${options.preparationDate.toLocaleDateString()}`, this.margin, this.currentY);
      this.currentY += this.lineHeight;
    }
    
    this.doc.setFontSize(8);
    this.doc.text('Prepared through Maryland DHS VITA Tax Assistance Program', this.margin, this.currentY);
  }
  
  /**
   * Draw a single line item
   */
  private drawLine(lineNumber: string, description: string, amount: number): void {
    const amountStr = amount >= 0 ? `$${amount.toFixed(2)}` : `($${Math.abs(amount).toFixed(2)})`;
    
    this.doc.text(`${lineNumber}.`, this.margin + 10, this.currentY);
    this.doc.text(description, this.margin + 40, this.currentY);
    this.doc.text(amountStr, this.pageWidth - this.margin - 100, this.currentY, { align: 'right' });
    this.currentY += this.lineHeight;
  }
  
  /**
   * Format SSN for display
   */
  private formatSSN(ssn: string): string {
    const digits = ssn.replace(/\D/g, '');
    if (digits.length === 9) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    }
    return ssn;
  }
}

export const form502Generator = new Form502Generator();
