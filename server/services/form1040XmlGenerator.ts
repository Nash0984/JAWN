import { Builder } from 'xml2js';
import { nanoid } from 'nanoid';
import type { Form1040PersonalInfo } from './form1040Generator';
import type { TaxCalculationResult, TaxHouseholdInput } from './policyEngineTaxCalculation';

/**
 * IRS Form 1040 XML Generator (MeF Format)
 * 
 * Generates IRS-compliant XML in Modernized e-File (MeF) format for electronic submission.
 * 
 * Features:
 * - IRS MeF schema-compliant XML structure
 * - Maps Form 1040 line items to XML elements
 * - Validates required fields (SSN, names, addresses)
 * - Generates unique submission IDs
 * - Supports all filing statuses and dependents
 * - Includes income, deductions, credits, and refund/owed amounts
 * 
 * IMPORTANT NOTES:
 * - This generates the XML structure only
 * - Actual IRS e-file submission requires:
 *   1. EFIN (Electronic Filing Identification Number) from IRS
 *   2. MeF production API credentials
 *   3. Digital signature/authentication
 *   4. IRS-approved transmission software
 * - This XML is for testing/development purposes
 * - For production e-filing, partner with IRS-authorized e-file providers
 * 
 * IRS MeF Resources:
 * - MeF Schema: https://www.irs.gov/e-file-providers/modernized-e-file-mef-schema-and-business-rules
 * - EFIN Application: https://www.irs.gov/tax-professionals/e-file-application
 */

export interface Form1040XmlOptions {
  taxYear: number;
  preparerName?: string;
  preparerPTIN?: string;
  preparerEIN?: string;
  softwareId?: string;
  softwareVersion?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export class Form1040XmlGenerator {
  private xmlBuilder: Builder;
  
  constructor() {
    this.xmlBuilder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true, indent: '  ' }
    });
  }
  
  /**
   * Generate Form 1040 XML in IRS MeF format
   */
  async generateForm1040XML(
    personalInfo: Form1040PersonalInfo,
    taxInput: TaxHouseholdInput,
    taxResult: TaxCalculationResult,
    options: Form1040XmlOptions
  ): Promise<string> {
    // Validate required fields
    const errors = this.validateRequiredFields(personalInfo, taxInput, taxResult);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
    }
    
    // Generate unique submission ID
    const submissionId = this.generateSubmissionId();
    
    // Build MeF XML structure
    const returnData = {
      Return: {
        $: {
          xmlns: 'http://www.irs.gov/efile',
          'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          returnVersion: '2024v1.0'
        },
        ReturnHeader: this.buildReturnHeader(personalInfo, taxInput, options, submissionId),
        ReturnData: {
          IRS1040: this.buildIRS1040(personalInfo, taxInput, taxResult, options)
        }
      }
    };
    
    return this.xmlBuilder.buildObject(returnData);
  }
  
  /**
   * Validate required fields for IRS e-file
   */
  private validateRequiredFields(
    personalInfo: Form1040PersonalInfo,
    taxInput: TaxHouseholdInput,
    taxResult: TaxCalculationResult
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Taxpayer validation
    if (!personalInfo.taxpayerFirstName?.trim()) {
      errors.push({ field: 'taxpayerFirstName', message: 'Taxpayer first name is required' });
    }
    if (!personalInfo.taxpayerLastName?.trim()) {
      errors.push({ field: 'taxpayerLastName', message: 'Taxpayer last name is required' });
    }
    if (!this.isValidSSN(personalInfo.taxpayerSSN)) {
      errors.push({ field: 'taxpayerSSN', message: 'Valid taxpayer SSN is required (format: XXX-XX-XXXX)' });
    }
    
    // Spouse validation (if married filing jointly)
    if (taxInput.filingStatus === 'married_joint') {
      if (!personalInfo.spouseFirstName?.trim()) {
        errors.push({ field: 'spouseFirstName', message: 'Spouse first name is required for married filing jointly' });
      }
      if (!personalInfo.spouseLastName?.trim()) {
        errors.push({ field: 'spouseLastName', message: 'Spouse last name is required for married filing jointly' });
      }
      if (!this.isValidSSN(personalInfo.spouseSSN)) {
        errors.push({ field: 'spouseSSN', message: 'Valid spouse SSN is required for married filing jointly' });
      }
    }
    
    // Address validation
    if (!personalInfo.streetAddress?.trim()) {
      errors.push({ field: 'streetAddress', message: 'Street address is required' });
    }
    if (!personalInfo.city?.trim()) {
      errors.push({ field: 'city', message: 'City is required' });
    }
    if (!personalInfo.state?.trim()) {
      errors.push({ field: 'state', message: 'State is required' });
    }
    if (!this.isValidZipCode(personalInfo.zipCode)) {
      errors.push({ field: 'zipCode', message: 'Valid ZIP code is required (format: XXXXX or XXXXX-XXXX)' });
    }
    
    // Dependent validation
    if (personalInfo.dependents) {
      personalInfo.dependents.forEach((dep, idx) => {
        if (!dep.firstName?.trim()) {
          errors.push({ field: `dependents[${idx}].firstName`, message: 'Dependent first name is required' });
        }
        if (!dep.lastName?.trim()) {
          errors.push({ field: `dependents[${idx}].lastName`, message: 'Dependent last name is required' });
        }
        if (!this.isValidSSN(dep.ssn)) {
          errors.push({ field: `dependents[${idx}].ssn`, message: 'Valid dependent SSN is required' });
        }
      });
    }
    
    return errors;
  }
  
  /**
   * Build ReturnHeader section
   */
  private buildReturnHeader(
    personalInfo: Form1040PersonalInfo,
    taxInput: TaxHouseholdInput,
    options: Form1040XmlOptions,
    submissionId: string
  ): any {
    const taxYear = options.taxYear;
    
    const header: any = {
      ReturnTs: new Date().toISOString(),
      TaxYr: taxYear,
      TaxPeriodBeginDt: `${taxYear}-01-01`,
      TaxPeriodEndDt: `${taxYear}-12-31`,
      ReturnTypeCd: '1040',
      SubmissionId: submissionId,
      Filer: {
        PrimarySSN: this.formatSSNForXML(personalInfo.taxpayerSSN),
        JurisdictionCd: 'US',
        Name: {
          NameLine1: `${personalInfo.taxpayerFirstName} ${personalInfo.taxpayerLastName}`
        },
        USAddress: {
          AddressLine1: personalInfo.streetAddress,
          ...(personalInfo.aptNumber && { AddressLine2: `Apt ${personalInfo.aptNumber}` }),
          City: personalInfo.city,
          State: personalInfo.state,
          ZIPCode: personalInfo.zipCode
        }
      }
    };
    
    // Add spouse if married filing jointly
    if (taxInput.filingStatus === 'married_joint' && personalInfo.spouseSSN) {
      header.Filer.SpouseSSN = this.formatSSNForXML(personalInfo.spouseSSN);
      header.Filer.Name.NameLine1 += ` & ${personalInfo.spouseFirstName} ${personalInfo.spouseLastName}`;
    }
    
    // Add preparer information if available
    if (options.preparerName) {
      header.Preparer = {
        PreparerPersonName: options.preparerName,
        ...(options.preparerPTIN && { PTIN: options.preparerPTIN }),
        ...(options.preparerEIN && { PreparerFirmEIN: options.preparerEIN })
      };
    }
    
    // Add software information
    if (options.softwareId) {
      header.SoftwareId = options.softwareId;
      header.SoftwareVersion = options.softwareVersion || '1.0';
    }
    
    return header;
  }
  
  /**
   * Build IRS1040 section with all form lines
   */
  private buildIRS1040(
    personalInfo: Form1040PersonalInfo,
    taxInput: TaxHouseholdInput,
    taxResult: TaxCalculationResult,
    options: Form1040XmlOptions
  ): any {
    const form1040: any = {
      // Filing Status
      FilingStatus: this.mapFilingStatusToXML(taxInput.filingStatus),
      
      // Virtual Currency Question (required as of 2024)
      VirtualCurrencyInd: personalInfo.virtualCurrency ? 'X' : '',
      
      // Presidential Election Campaign Fund
      ...(personalInfo.taxpayerPresidentialFund !== undefined && {
        PrimaryClaimAsDependentInd: personalInfo.taxpayerPresidentialFund ? 'X' : ''
      }),
      ...(personalInfo.spousePresidentialFund !== undefined && {
        SpouseClaimAsDependentInd: personalInfo.spousePresidentialFund ? 'X' : ''
      }),
      
      // Personal Information
      TaxpayerName: {
        FirstName: personalInfo.taxpayerFirstName,
        LastName: personalInfo.taxpayerLastName
      },
      TaxpayerSSN: this.formatSSNForXML(personalInfo.taxpayerSSN)
    };
    
    // Add spouse if applicable
    if (taxInput.filingStatus === 'married_joint' && personalInfo.spouseSSN) {
      form1040.SpouseName = {
        FirstName: personalInfo.spouseFirstName,
        LastName: personalInfo.spouseLastName
      };
      form1040.SpouseSSN = this.formatSSNForXML(personalInfo.spouseSSN);
    }
    
    // Add dependents
    if (personalInfo.dependents && personalInfo.dependents.length > 0) {
      form1040.DependentInformation = personalInfo.dependents.map(dep => ({
        DependentName: {
          FirstName: dep.firstName,
          LastName: dep.lastName
        },
        DependentSSN: this.formatSSNForXML(dep.ssn),
        DependentRelationship: dep.relationship,
        EligibleForChildTaxCreditInd: dep.childTaxCredit ? 'X' : '',
        EligibleForODCInd: dep.otherDepCredit ? 'X' : ''
      }));
    }
    
    // Income Section (Lines 1-9)
    const wages = (taxInput.w2Income?.taxpayerWages || 0) + (taxInput.w2Income?.spouseWages || 0);
    if (wages > 0) {
      form1040.WagesSalariesAndTipsAmt = this.formatAmount(wages);
    }
    
    if (taxInput.interestIncome) {
      form1040.TaxExemptInterestAmt = 0;
      form1040.TaxableInterestAmt = this.formatAmount(taxInput.interestIncome);
    }
    
    if (taxInput.dividendIncome) {
      form1040.QualifiedDividendsAmt = this.formatAmount(taxInput.dividendIncome);
      form1040.OrdinaryDividendsAmt = this.formatAmount(taxInput.dividendIncome);
    }
    
    if (taxInput.iraDistributions) {
      form1040.IRADistributionsAmt = this.formatAmount(taxInput.iraDistributions.total);
      form1040.TaxableIRADistributionsAmt = this.formatAmount(taxInput.iraDistributions.taxable);
    }
    
    if (taxInput.pensionDistributions) {
      form1040.PensionsAnnuitiesAmt = this.formatAmount(taxInput.pensionDistributions.total);
      form1040.TaxablePensionsAnnuitiesAmt = this.formatAmount(taxInput.pensionDistributions.taxable);
    }
    
    if (taxInput.socialSecurityBenefits) {
      form1040.SocialSecurityBenefitsAmt = this.formatAmount(taxInput.socialSecurityBenefits);
      form1040.TaxableSocialSecurityAmt = this.formatAmount(taxResult.taxableSocialSecurity);
    }
    
    if (taxInput.capitalGains) {
      form1040.CapitalGainLossAmt = this.formatAmount(taxInput.capitalGains);
    }
    
    const otherIncome = (taxInput.unemploymentCompensation || 0) + 
                        (taxInput.selfEmploymentIncome?.gross || 0);
    if (otherIncome > 0) {
      form1040.OtherIncomeAmt = this.formatAmount(otherIncome);
    }
    
    // Line 9: Total Income
    form1040.TotalIncomeAmt = this.formatAmount(taxResult.totalIncome);
    
    // AGI Section (Lines 10-11)
    const adjustments = taxResult.totalIncome - taxResult.adjustedGrossIncome;
    if (adjustments > 0) {
      form1040.AdjustmentsToIncomeAmt = this.formatAmount(adjustments);
    }
    form1040.AdjustedGrossIncomeAmt = this.formatAmount(taxResult.adjustedGrossIncome);
    
    // Deductions (Lines 12-15)
    if (taxResult.deductionBreakdown.usedStandardDeduction) {
      form1040.TotalItemizedOrStandardDedAmt = this.formatAmount(taxResult.deductionBreakdown.standardDeduction);
      form1040.StandardDeductionInd = 'X';
    } else {
      form1040.TotalItemizedOrStandardDedAmt = this.formatAmount(taxResult.deductionBreakdown.itemizedDeduction);
      form1040.ItemizedDeductionInd = 'X';
    }
    
    form1040.QualifiedBusinessIncomeDedAmt = 0;
    form1040.TotalDeductionsAmt = this.formatAmount(taxResult.deduction);
    form1040.TaxableIncomeAmt = this.formatAmount(taxResult.taxableIncome);
    
    // Tax and Credits (Lines 16-24)
    form1040.TaxAmt = this.formatAmount(taxResult.incomeTax);
    
    // Schedule 2: Additional taxes (if any)
    form1040.Schedule2TaxAmt = 0;
    
    // Add total of lines 16-23 (tax before credits)
    form1040.TotalTaxBeforeCreditsAmt = this.formatAmount(taxResult.incomeTax);
    
    // Credits (Line 19)
    if (taxResult.childTaxCredit > 0) {
      form1040.ChildTaxCreditAmt = this.formatAmount(taxResult.childTaxCredit);
    }
    
    if (taxResult.educationCredits > 0) {
      form1040.EducationCreditAmt = this.formatAmount(taxResult.educationCredits);
    }
    
    if (taxResult.childDependentCareCredit > 0) {
      form1040.ChildDepCareCreditAmt = this.formatAmount(taxResult.childDependentCareCredit);
    }
    
    // Schedule 3: Additional credits (refundable)
    const schedule3Credits: any = {};
    
    if (taxResult.eitc > 0) {
      schedule3Credits.EarnedIncomeCreditAmt = this.formatAmount(taxResult.eitc);
    }
    
    if (taxResult.additionalChildTaxCredit > 0) {
      schedule3Credits.AdditionalChildTaxCreditAmt = this.formatAmount(taxResult.additionalChildTaxCredit);
    }
    
    if (taxResult.premiumTaxCredit > 0) {
      schedule3Credits.PremiumTaxCreditAmt = this.formatAmount(taxResult.premiumTaxCredit);
    }
    
    if (Object.keys(schedule3Credits).length > 0) {
      form1040.Schedule3 = schedule3Credits;
    }
    
    // Total credits and tax after credits
    form1040.TotalCreditsAmt = this.formatAmount(taxResult.totalCredits);
    form1040.TotalTaxAmt = this.formatAmount(taxResult.totalTax);
    
    // Payments (Lines 25-33)
    if (taxInput.w2Income?.federalWithholding) {
      form1040.WithholdingTaxAmt = this.formatAmount(taxInput.w2Income.federalWithholding);
    }
    
    if (taxResult.estimatedTaxPayments > 0) {
      form1040.EstimatedTaxPaymentsAmt = this.formatAmount(taxResult.estimatedTaxPayments);
    }
    
    // EITC is included in refundable credits (Schedule 3)
    
    // Total payments
    const totalPayments = taxResult.federalWithholding + 
                         taxResult.estimatedTaxPayments + 
                         taxResult.creditBreakdown.refundableCredits;
    form1040.TotalPaymentsAmt = this.formatAmount(totalPayments);
    
    // Refund or Amount Owed (Lines 34-37)
    if (taxResult.refund > 0) {
      form1040.RefundAmt = this.formatAmount(taxResult.refund);
      
      // Direct deposit information (placeholder - would be collected separately)
      form1040.RefundDirectDeposit = {
        RefundDirectDepositRtngNbr: '000000000',
        RefundDirectDepositAcctNbr: '0000000000',
        RefundDirectDepositCd: '1'
      };
    } else if (taxResult.refund < 0) {
      form1040.AmountOwedAmt = this.formatAmount(Math.abs(taxResult.refund));
    }
    
    // Tax calculation metadata
    form1040.MarginalTaxRate = taxResult.marginalTaxRate.toFixed(4);
    form1040.EffectiveTaxRate = taxResult.effectiveTaxRate.toFixed(4);
    
    return form1040;
  }
  
  /**
   * Map filing status to IRS MeF enum format
   * 1 = Single
   * 2 = Married Filing Jointly
   * 3 = Married Filing Separately
   * 4 = Head of Household
   * 5 = Qualifying Widow(er)
   */
  private mapFilingStatusToXML(status: TaxHouseholdInput['filingStatus']): string {
    const mapping: Record<string, string> = {
      'single': '1',
      'married_joint': '2',
      'married_separate': '3',
      'head_of_household': '4',
      'qualifying_widow': '5'
    };
    
    return mapping[status] || '1';
  }
  
  /**
   * Generate unique submission ID
   */
  private generateSubmissionId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = nanoid(10).toUpperCase();
    return `SUB${timestamp}${random}`;
  }
  
  /**
   * Format SSN for XML (remove dashes)
   */
  private formatSSNForXML(ssn: string): string {
    return ssn.replace(/[-\s]/g, '');
  }
  
  /**
   * Format monetary amount (2 decimal places)
   */
  private formatAmount(amount: number): number {
    return Math.round(amount * 100) / 100;
  }
  
  /**
   * Validate SSN format
   */
  private isValidSSN(ssn: string | undefined): boolean {
    if (!ssn) return false;
    const ssnPattern = /^\d{3}-?\d{2}-?\d{4}$/;
    return ssnPattern.test(ssn);
  }
  
  /**
   * Validate ZIP code format
   */
  private isValidZipCode(zip: string | undefined): boolean {
    if (!zip) return false;
    const zipPattern = /^\d{5}(-\d{4})?$/;
    return zipPattern.test(zip);
  }
}

// Export singleton instance
export const form1040XmlGenerator = new Form1040XmlGenerator();
