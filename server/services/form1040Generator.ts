import { jsPDF } from 'jspdf';
import type { TaxCalculationResult, TaxHouseholdInput } from './policyEngineTaxCalculation';

/**
 * Form 1040 PDF Generator
 * 
 * Generates printable IRS Form 1040 (U.S. Individual Income Tax Return) PDF
 * from PolicyEngine tax calculation results.
 * 
 * Features:
 * - Maps calculation results to official Form 1040 line items
 * - Includes taxpayer information, filing status, dependents
 * - All income, deduction, tax, credit, and refund lines
 * - Professional formatting matching IRS layout
 * - Watermarked for VITA/navigator review (not e-file ready)
 * 
 * Supports Maryland DHS Navigator workflow: Calculate → Review → Generate PDF → Client signature
 */

export interface Form1040PersonalInfo {
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
  
  // Dependents
  dependents?: Array<{
    firstName: string;
    lastName: string;
    ssn: string;
    relationship: string;
    childTaxCredit: boolean;
    otherDepCredit: boolean;
  }>;
  
  // Virtual currency question (required as of 2024)
  virtualCurrency: boolean;
  
  // Presidential Election Campaign Fund
  taxpayerPresidentialFund?: boolean;
  spousePresidentialFund?: boolean;
}

export interface Form1040Options {
  taxYear: number;
  preparerName?: string; // Navigator name
  preparerPTIN?: string; // Preparer Tax Identification Number
  preparationDate?: Date;
  includeWatermark?: boolean; // "DRAFT - NOT FOR E-FILING"
}

export class Form1040Generator {
  private doc!: jsPDF; // Initialized in generateForm1040
  private readonly pageWidth = 8.5 * 72; // 8.5 inches in points
  private readonly pageHeight = 11 * 72; // 11 inches in points
  private readonly margin = 0.5 * 72; // 0.5 inch margins
  private readonly lineHeight = 14;
  private currentY = this.margin;
  
  /**
   * Generate Form 1040 PDF
   */
  async generateForm1040(
    personalInfo: Form1040PersonalInfo,
    taxInput: TaxHouseholdInput,
    taxResult: TaxCalculationResult,
    options: Form1040Options
  ): Promise<Buffer> {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter'
    });
    
    this.currentY = this.margin;
    
    // Add watermark if requested (for draft/review copies)
    if (options.includeWatermark !== false) {
      this.addWatermark();
    }
    
    // Form header
    this.drawFormHeader(options.taxYear);
    
    // Filing status and personal information
    this.drawFilingStatus(taxInput.filingStatus);
    this.drawPersonalInfo(personalInfo);
    
    // Income section (Lines 1-9)
    this.drawIncomeSection(taxInput, taxResult);
    
    // AGI section (Lines 10-11)
    this.drawAGISection(taxResult);
    
    // Deductions section (Lines 12-15)
    this.drawDeductionsSection(taxResult);
    
    // Tax and credits section (Lines 16-24)
    this.drawTaxSection(taxResult);
    
    // Payments section (Lines 25-33)
    this.drawPaymentsSection(taxResult);
    
    // Refund/Amount Owed (Lines 34-37)
    this.drawRefundSection(taxResult);
    
    // Third party designee and signature section
    this.drawSignatureSection(options);
    
    // Preparer information (if VITA navigator prepared)
    if (options.preparerName) {
      this.drawPreparerInfo(options);
    }
    
    // Return PDF buffer
    return Buffer.from(this.doc.output('arraybuffer'));
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
    this.doc.text(`Form 1040`, this.margin, this.currentY);
    this.currentY += this.lineHeight + 5;
    
    this.doc.setFontSize(12);
    this.doc.text(`U.S. Individual Income Tax Return`, this.margin, this.currentY);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`${taxYear}`, this.pageWidth - this.margin - 40, this.currentY);
    
    this.currentY += this.lineHeight + 10;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 10;
  }
  
  /**
   * Draw filing status
   */
  private drawFilingStatus(status: TaxHouseholdInput['filingStatus']): void {
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Filing Status', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    const statusLabels: Record<string, string> = {
      'single': '☑ Single',
      'married_joint': '☑ Married filing jointly',
      'married_separate': '☑ Married filing separately',
      'head_of_household': '☑ Head of household',
      'qualifying_widow': '☑ Qualifying surviving spouse'
    };
    
    this.doc.text(statusLabels[status] || status, this.margin + 20, this.currentY);
    this.currentY += this.lineHeight + 10;
  }
  
  /**
   * Draw personal information
   */
  private drawPersonalInfo(info: Form1040PersonalInfo): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Your Information', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Name: ${info.taxpayerFirstName} ${info.taxpayerLastName}`, this.margin + 20, this.currentY);
    this.doc.text(`SSN: ${this.formatSSN(info.taxpayerSSN)}`, this.pageWidth - this.margin - 150, this.currentY);
    this.currentY += this.lineHeight;
    
    if (info.spouseFirstName) {
      this.doc.text(`Spouse: ${info.spouseFirstName} ${info.spouseLastName}`, this.margin + 20, this.currentY);
      this.doc.text(`SSN: ${this.formatSSN(info.spouseSSN || '')}`, this.pageWidth - this.margin - 150, this.currentY);
      this.currentY += this.lineHeight;
    }
    
    this.doc.text(`Address: ${info.streetAddress}${info.aptNumber ? ` Apt ${info.aptNumber}` : ''}`, this.margin + 20, this.currentY);
    this.currentY += this.lineHeight;
    this.doc.text(`${info.city}, ${info.state} ${info.zipCode}`, this.margin + 20, this.currentY);
    this.currentY += this.lineHeight + 10;
    
    // Dependents
    if (info.dependents && info.dependents.length > 0) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Dependents', this.margin, this.currentY);
      this.currentY += this.lineHeight;
      
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9);
      info.dependents.forEach((dep, idx) => {
        this.doc.text(
          `${idx + 1}. ${dep.firstName} ${dep.lastName}`,
          this.margin + 20,
          this.currentY
        );
        this.doc.text(this.formatSSN(dep.ssn), this.margin + 200, this.currentY);
        this.doc.text(dep.relationship, this.margin + 320, this.currentY);
        if (dep.childTaxCredit) this.doc.text('CTC', this.margin + 420, this.currentY);
        this.currentY += this.lineHeight - 2;
      });
      this.doc.setFontSize(10);
      this.currentY += 10;
    }
  }
  
  /**
   * Draw income section (Lines 1-9)
   */
  private drawIncomeSection(taxInput: TaxHouseholdInput, taxResult: TaxCalculationResult): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Income', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    
    // Line 1: Wages, salaries, tips
    const wages = (taxInput.w2Income?.taxpayerWages || 0) + (taxInput.w2Income?.spouseWages || 0);
    this.drawLine('1', 'Wages, salaries, tips', wages);
    
    // Line 2: Tax-exempt interest
    this.drawLine('2a', 'Tax-exempt interest', 0);
    
    // Line 2b: Taxable interest
    this.drawLine('2b', 'Taxable interest', taxInput.interestIncome || 0);
    
    // Line 3: Qualified dividends
    this.drawLine('3a', 'Qualified dividends', taxInput.dividendIncome || 0);
    
    // Line 4: IRA distributions
    this.drawLine('4b', 'IRA distributions (taxable)', 0);
    
    // Line 5: Pensions and annuities
    this.drawLine('5b', 'Pensions and annuities (taxable)', 0);
    
    // Line 6: Social Security benefits
    this.drawLine('6b', 'Social Security benefits (taxable)', taxInput.socialSecurityBenefits || 0);
    
    // Line 7: Capital gain/loss
    this.drawLine('7', 'Capital gain or (loss)', taxInput.capitalGains || 0);
    
    // Line 8: Other income (Schedule 1)
    const otherIncome = (taxInput.unemploymentCompensation || 0) + 
                        (taxInput.selfEmploymentIncome?.gross || 0);
    this.drawLine('8', 'Other income from Schedule 1', otherIncome);
    
    this.currentY += 5;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
    
    // Line 9: Total income
    this.doc.setFont('helvetica', 'bold');
    this.drawLine('9', 'Total income', taxResult.totalIncome);
    this.doc.setFont('helvetica', 'normal');
    this.currentY += 10;
  }
  
  /**
   * Draw AGI section (Lines 10-11)
   */
  private drawAGISection(taxResult: TaxCalculationResult): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Adjusted Gross Income', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    
    // Line 10: Adjustments to income
    const adjustments = taxResult.totalIncome - taxResult.adjustedGrossIncome;
    this.drawLine('10', 'Adjustments to income (Schedule 1)', adjustments);
    
    this.currentY += 5;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
    
    // Line 11: AGI
    this.doc.setFont('helvetica', 'bold');
    this.drawLine('11', 'Adjusted gross income', taxResult.adjustedGrossIncome);
    this.doc.setFont('helvetica', 'normal');
    this.currentY += 10;
  }
  
  /**
   * Draw deductions section (Lines 12-15)
   */
  private drawDeductionsSection(taxResult: TaxCalculationResult): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Standard Deduction and Taxable Income', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    
    // Line 12: Standard/Itemized deduction
    const deductionType = taxResult.deductionBreakdown.usedStandardDeduction ? 'Standard' : 'Itemized';
    this.drawLine('12', `${deductionType} deduction or itemized deductions`, taxResult.deduction);
    
    // Line 13: Qualified business income deduction
    this.drawLine('13', 'Qualified business income deduction', 0);
    
    // Line 14: Add lines 12 and 13
    this.drawLine('14', 'Add lines 12 and 13', taxResult.deduction);
    
    this.currentY += 5;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
    
    // Line 15: Taxable income
    this.doc.setFont('helvetica', 'bold');
    this.drawLine('15', 'Taxable income', taxResult.taxableIncome);
    this.doc.setFont('helvetica', 'normal');
    this.currentY += 10;
  }
  
  /**
   * Draw tax and credits section (Lines 16-24)
   */
  private drawTaxSection(taxResult: TaxCalculationResult): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Tax and Credits', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    
    // Line 16: Tax
    this.drawLine('16', 'Tax (see instructions)', taxResult.incomeTax);
    
    // Line 17: Amount from Schedule 2
    this.drawLine('17', 'Amount from Schedule 2, line 3', 0);
    
    // Line 18: Add lines 16 and 17
    this.drawLine('18', 'Add lines 16 and 17', taxResult.incomeTax);
    
    // Line 19: Child tax credit
    this.drawLine('19', 'Child tax credit or credit for other dependents', taxResult.childTaxCredit);
    
    // Line 20: Amount from Schedule 3
    const otherCredits = taxResult.educationCredits + taxResult.childDependentCareCredit;
    this.drawLine('20', 'Amount from Schedule 3, line 8', otherCredits);
    
    // Line 21: Add lines 19 and 20
    const totalNonRefundable = taxResult.creditBreakdown.nonRefundableCredits;
    this.drawLine('21', 'Add lines 19 and 20', totalNonRefundable);
    
    // Line 22: Subtract line 21 from 18
    const taxAfterCredits = Math.max(0, taxResult.incomeTax - totalNonRefundable);
    this.drawLine('22', 'Subtract line 21 from line 18', taxAfterCredits);
    
    // Line 23: Other taxes
    this.drawLine('23', 'Other taxes, including self-employment tax', 0);
    
    this.currentY += 5;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
    
    // Line 24: Total tax
    this.doc.setFont('helvetica', 'bold');
    this.drawLine('24', 'Total tax', taxResult.totalTax);
    this.doc.setFont('helvetica', 'normal');
    this.currentY += 10;
  }
  
  /**
   * Draw payments section (Lines 25-33)
   */
  private drawPaymentsSection(taxResult: TaxCalculationResult): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Payments', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    
    // Line 25: Federal income tax withheld
    this.drawLine('25', 'Federal income tax withheld', taxResult.federalWithholding);
    
    // Line 26: Estimated tax payments
    this.drawLine('26', '2024 estimated tax payments', taxResult.estimatedTaxPayments);
    
    // Line 27: Earned income credit (EIC)
    this.drawLine('27', 'Earned income credit (EIC)', taxResult.eitc);
    
    // Line 28: Additional child tax credit
    this.drawLine('28', 'Additional child tax credit', taxResult.additionalChildTaxCredit);
    
    // Line 29: American opportunity credit
    const refundableEducation = taxResult.educationCredits * 0.4; // 40% refundable
    this.drawLine('29', 'American opportunity credit from Form 8863', refundableEducation);
    
    // Line 30: Reserved for future use
    this.drawLine('30', 'Reserved for future use', 0);
    
    // Line 31: Amount from Schedule 3
    this.drawLine('31', 'Amount from Schedule 3, line 15', taxResult.premiumTaxCredit);
    
    // Line 32: Add lines 25-31
    const totalPayments = taxResult.federalWithholding + 
                         taxResult.estimatedTaxPayments + 
                         taxResult.creditBreakdown.refundableCredits;
    this.drawLine('32', 'Add lines 25 through 31', totalPayments);
    
    this.currentY += 5;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
    
    // Line 33: Total payments
    this.doc.setFont('helvetica', 'bold');
    this.drawLine('33', 'Total payments', totalPayments);
    this.doc.setFont('helvetica', 'normal');
    this.currentY += 10;
  }
  
  /**
   * Draw refund/amount owed section (Lines 34-37)
   */
  private drawRefundSection(taxResult: TaxCalculationResult): void {
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Refund or Amount You Owe', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    
    if (taxResult.refund >= 0) {
      // Line 34: Overpayment (refund)
      this.doc.setFont('helvetica', 'bold');
      this.drawLine('34', 'Overpayment (REFUND)', taxResult.refund);
      this.doc.setFont('helvetica', 'normal');
      
      // Line 35a: Direct deposit routing number
      this.currentY += this.lineHeight;
      this.doc.text('35a. Routing number (for direct deposit):', this.margin + 20, this.currentY);
      this.doc.text('________________', this.margin + 260, this.currentY);
      
      // Line 35b: Account type
      this.currentY += this.lineHeight;
      this.doc.text('35b. Type: ☐ Checking  ☐ Savings', this.margin + 20, this.currentY);
      
      // Line 35c: Account number
      this.currentY += this.lineHeight;
      this.doc.text('35c. Account number:', this.margin + 20, this.currentY);
      this.doc.text('________________________', this.margin + 180, this.currentY);
      
      this.currentY += this.lineHeight + 5;
    } else {
      // Line 37: Amount you owe
      this.doc.setFont('helvetica', 'bold');
      this.drawLine('37', 'Amount you owe', Math.abs(taxResult.refund));
      this.doc.setFont('helvetica', 'normal');
      this.currentY += this.lineHeight + 5;
    }
  }
  
  /**
   * Draw signature section
   */
  private drawSignatureSection(options: Form1040Options): void {
    this.currentY += 10;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 15;
    
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Sign Here', this.margin, this.currentY);
    this.currentY += this.lineHeight;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.text('Under penalties of perjury, I declare that I have examined this return and accompanying schedules', this.margin, this.currentY);
    this.currentY += 10;
    this.doc.text('and statements, and to the best of my knowledge and belief, they are true, correct, and accurately', this.margin, this.currentY);
    this.currentY += 10;
    this.doc.text('list all amounts and sources of income I received during the tax year.', this.margin, this.currentY);
    this.currentY += 15;
    
    this.doc.setFontSize(10);
    this.doc.text('Your signature: _________________________________', this.margin, this.currentY);
    this.doc.text('Date: ______________', this.pageWidth - this.margin - 150, this.currentY);
    this.currentY += this.lineHeight + 5;
    
    this.doc.text('Spouse\'s signature (if joint return): _________________________', this.margin, this.currentY);
    this.doc.text('Date: ______________', this.pageWidth - this.margin - 150, this.currentY);
    this.currentY += this.lineHeight + 10;
  }
  
  /**
   * Draw preparer information
   */
  private drawPreparerInfo(options: Form1040Options): void {
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

export const form1040Generator = new Form1040Generator();
