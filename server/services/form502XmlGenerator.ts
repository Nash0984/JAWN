import { Builder } from 'xml2js';
import { nanoid } from 'nanoid';
import type { Form502PersonalInfo, MarylandSpecificInput, MarylandTaxResult } from './form502Generator';
import type { TaxCalculationResult, TaxHouseholdInput } from './policyEngineTaxCalculation';

/**
 * Maryland Form 502 XML Generator (iFile Format - PROTOTYPE)
 * 
 * Generates Maryland iFile-compatible XML structure for electronic submission of Form 502.
 * 
 * Features:
 * - Maryland iFile XML schema structure
 * - Maps Form 502 line items to XML elements
 * - Personal information, AGI calculations, state/county tax
 * - Maryland credits (EITC, poverty level, property tax, renter's)
 * - Validates required fields (SSN, names, addresses)
 * - Generates unique submission IDs
 * 
 * IMPORTANT NOTES - PROTOTYPE STATUS:
 * - This generates the XML structure only (scaffolding)
 * - Actual Maryland iFile submission requires:
 *   1. Maryland iFile credentials from MD Comptroller
 *   2. Official Maryland XML schema (XSD) for validation
 *   3. Digital signature/authentication
 *   4. MD-approved transmission software
 * - This XML is for testing/development purposes
 * - For production e-filing, obtain official Maryland iFile schema and credentials
 * - XSD validation and digital signatures are deferred until production requirements
 * 
 * Maryland iFile Resources:
 * - MD Comptroller: https://www.marylandtaxes.gov/
 * - iFile Information: Contact MD Comptroller for official schema and credentials
 * 
 * Lesson Learned from Form 1040 XML:
 * - Build as prototype scaffolding without XSD validation
 * - Document production requirements clearly
 * - Focus on correct data mapping to XML structure
 */

export interface Form502XmlOptions {
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

export class Form502XmlGenerator {
  private xmlBuilder: Builder;
  
  constructor() {
    this.xmlBuilder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true, indent: '  ' }
    });
  }
  
  /**
   * Generate Form 502 XML in Maryland iFile format (PROTOTYPE)
   */
  async generateForm502XML(
    personalInfo: Form502PersonalInfo,
    taxInput: TaxHouseholdInput,
    federalTaxResult: TaxCalculationResult,
    marylandTaxResult: MarylandTaxResult,
    marylandInput: MarylandSpecificInput,
    options: Form502XmlOptions
  ): Promise<string> {
    // Validate required fields
    const errors = this.validateRequiredFields(personalInfo, taxInput);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
    }
    
    // Generate unique submission ID
    const submissionId = this.generateSubmissionId();
    
    // Build Maryland iFile XML structure
    const returnData = {
      MarylandReturn: {
        $: {
          xmlns: 'http://www.marylandtaxes.gov/ifile',
          'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          returnVersion: `${options.taxYear}v1.0`
        },
        Header: this.buildHeader(personalInfo, taxInput, options, submissionId),
        Form502: this.buildForm502(
          personalInfo,
          taxInput,
          federalTaxResult,
          marylandTaxResult,
          marylandInput,
          options
        )
      }
    };
    
    return this.xmlBuilder.buildObject(returnData);
  }
  
  /**
   * Validate required fields for Maryland iFile
   */
  private validateRequiredFields(
    personalInfo: Form502PersonalInfo,
    taxInput: TaxHouseholdInput
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
    
    // Maryland-specific validation
    if (!personalInfo.county?.trim()) {
      errors.push({ field: 'county', message: 'Maryland county is required' });
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
   * Build Header section with filer information
   */
  private buildHeader(
    personalInfo: Form502PersonalInfo,
    taxInput: TaxHouseholdInput,
    options: Form502XmlOptions,
    submissionId: string
  ): any {
    const header: any = {
      TaxYear: options.taxYear,
      FormType: '502',
      SubmissionId: submissionId,
      SubmissionTimestamp: new Date().toISOString(),
      Filer: {
        PrimaryTaxpayer: {
          FirstName: personalInfo.taxpayerFirstName,
          LastName: personalInfo.taxpayerLastName,
          SSN: this.formatSSNForXML(personalInfo.taxpayerSSN)
        },
        Address: {
          StreetAddress: personalInfo.streetAddress,
          ...(personalInfo.aptNumber && { ApartmentNumber: personalInfo.aptNumber }),
          City: personalInfo.city,
          State: personalInfo.state,
          ZipCode: personalInfo.zipCode
        },
        County: personalInfo.county.toUpperCase(),
        MarylandResident: personalInfo.marylandResident ? 'true' : 'false',
        ...(personalInfo.yearsInMaryland && { YearsInMaryland: personalInfo.yearsInMaryland })
      },
      FilingStatus: this.mapFilingStatusToXML(taxInput.filingStatus)
    };
    
    // Add spouse if married filing jointly
    if (taxInput.filingStatus === 'married_joint' && personalInfo.spouseSSN) {
      header.Filer.Spouse = {
        FirstName: personalInfo.spouseFirstName,
        LastName: personalInfo.spouseLastName,
        SSN: this.formatSSNForXML(personalInfo.spouseSSN)
      };
    }
    
    // Add dependents
    if (personalInfo.dependents && personalInfo.dependents.length > 0) {
      header.Filer.Dependents = {
        Dependent: personalInfo.dependents.map(dep => ({
          FirstName: dep.firstName,
          LastName: dep.lastName,
          SSN: this.formatSSNForXML(dep.ssn),
          Relationship: dep.relationship
        }))
      };
    }
    
    // Add preparer information if available
    if (options.preparerName) {
      header.Preparer = {
        Name: options.preparerName,
        ...(options.preparerPTIN && { PTIN: options.preparerPTIN }),
        ...(options.preparerEIN && { EIN: options.preparerEIN })
      };
    }
    
    // Add software information
    if (options.softwareId) {
      header.Software = {
        SoftwareId: options.softwareId,
        Version: options.softwareVersion || '1.0'
      };
    }
    
    return header;
  }
  
  /**
   * Build Form502 section with all Maryland tax fields
   */
  private buildForm502(
    personalInfo: Form502PersonalInfo,
    taxInput: TaxHouseholdInput,
    federalTaxResult: TaxCalculationResult,
    marylandTaxResult: MarylandTaxResult,
    marylandInput: MarylandSpecificInput,
    options: Form502XmlOptions
  ): any {
    const form502: any = {
      // Income Section
      Income: {
        FederalAGI: this.formatAmount(marylandTaxResult.federalAGI),
        MarylandAdditions: this.formatAmount(marylandTaxResult.marylandAdditions),
        ...(marylandInput.stateTaxRefund && {
          StateTaxRefund: this.formatAmount(marylandInput.stateTaxRefund)
        }),
        MarylandSubtractions: this.formatAmount(marylandTaxResult.marylandSubtractions),
        ...(marylandInput.socialSecurityBenefits && {
          SocialSecurityBenefits: this.formatAmount(marylandInput.socialSecurityBenefits)
        }),
        ...(marylandInput.railroadRetirement && {
          RailroadRetirement: this.formatAmount(marylandInput.railroadRetirement)
        }),
        ...(marylandInput.pensionIncome && {
          PensionIncome: this.formatAmount(marylandInput.pensionIncome)
        }),
        MarylandAGI: this.formatAmount(marylandTaxResult.marylandAGI)
      },
      
      // Deductions Section
      Deductions: {
        StandardDeduction: this.formatAmount(marylandTaxResult.marylandStandardDeduction),
        ItemizedDeduction: this.formatAmount(marylandTaxResult.marylandItemizedDeduction),
        DeductionUsed: this.formatAmount(marylandTaxResult.marylandDeduction),
        DeductionType: marylandTaxResult.marylandDeduction === marylandTaxResult.marylandStandardDeduction 
          ? 'Standard' 
          : 'Itemized'
      },
      
      // Taxable Income
      TaxableIncome: this.formatAmount(marylandTaxResult.marylandTaxableIncome),
      
      // Tax Calculation
      Tax: {
        StateTax: this.formatAmount(marylandTaxResult.marylandStateTax),
        CountyTax: this.formatAmount(marylandTaxResult.countyTax),
        CountyRate: (marylandTaxResult.countyRate * 100).toFixed(4),
        TotalTax: this.formatAmount(marylandTaxResult.totalMarylandTax)
      },
      
      // Credits Section
      Credits: {
        MarylandEITC: this.formatAmount(marylandTaxResult.marylandEITC),
        ...(federalTaxResult.eitc && {
          FederalEITC: this.formatAmount(federalTaxResult.eitc),
          EITCPercentage: '50'
        }),
        PovertyLevelCredit: this.formatAmount(marylandTaxResult.povertyLevelCredit),
        PropertyTaxCredit: this.formatAmount(marylandTaxResult.propertyTaxCredit),
        ...(marylandInput.propertyTaxPaid && {
          PropertyTaxPaid: this.formatAmount(marylandInput.propertyTaxPaid)
        }),
        RentersTaxCredit: this.formatAmount(marylandTaxResult.rentersTaxCredit),
        ...(marylandInput.rentPaid && {
          RentPaid: this.formatAmount(marylandInput.rentPaid)
        }),
        TotalCredits: this.formatAmount(marylandTaxResult.totalMarylandCredits)
      },
      
      // Tax After Credits
      TaxAfterCredits: this.formatAmount(marylandTaxResult.taxAfterCredits),
      
      // Payments and Withholding
      Payments: {
        MarylandWithholding: this.formatAmount(marylandTaxResult.marylandWithholding),
        TotalPayments: this.formatAmount(marylandTaxResult.marylandWithholding)
      },
      
      // Refund or Amount Owed
      RefundOrOwed: {
        Amount: this.formatAmount(Math.abs(marylandTaxResult.marylandRefund)),
        Type: marylandTaxResult.marylandRefund >= 0 ? 'Refund' : 'Owed'
      },
      
      // Additional Information
      AdditionalInfo: {
        EffectiveTaxRate: marylandTaxResult.effectiveMarylandRate.toFixed(2),
        ...(marylandInput.childcareExpenses && {
          ChildcareExpenses: this.formatAmount(marylandInput.childcareExpenses)
        })
      }
    };
    
    return form502;
  }
  
  /**
   * Generate unique submission ID for Maryland iFile
   */
  private generateSubmissionId(): string {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 14);
    const random = nanoid(10).toUpperCase();
    return `MD502-${timestamp}-${random}`;
  }
  
  /**
   * Validate SSN format
   */
  private isValidSSN(ssn: string | undefined): boolean {
    if (!ssn) return false;
    const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
    return ssnRegex.test(ssn);
  }
  
  /**
   * Validate ZIP code format
   */
  private isValidZipCode(zip: string | undefined): boolean {
    if (!zip) return false;
    const zipRegex = /^\d{5}(-\d{4})?$/;
    return zipRegex.test(zip);
  }
  
  /**
   * Format SSN for XML (remove dashes)
   */
  private formatSSNForXML(ssn: string): string {
    return ssn.replace(/-/g, '');
  }
  
  /**
   * Format amount for XML (2 decimal places)
   */
  private formatAmount(amount: number): string {
    return amount.toFixed(2);
  }
  
  /**
   * Map filing status to Maryland XML format
   */
  private mapFilingStatusToXML(status: string): string {
    const statusMap: Record<string, string> = {
      'single': 'Single',
      'married_joint': 'MarriedFilingJointly',
      'married_separate': 'MarriedFilingSeparately',
      'head_of_household': 'HeadOfHousehold',
      'qualifying_widow': 'QualifyingWidow'
    };
    
    return statusMap[status] || 'Single';
  }
  
  /**
   * Validate generated XML structure (basic validation)
   */
  validateXML(xml: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic XML structure validation
    if (!xml.includes('<MarylandReturn')) {
      errors.push('Missing MarylandReturn root element');
    }
    if (!xml.includes('<Header>')) {
      errors.push('Missing Header section');
    }
    if (!xml.includes('<Form502>')) {
      errors.push('Missing Form502 section');
    }
    if (!xml.includes('</MarylandReturn>')) {
      errors.push('XML not properly closed');
    }
    
    // Check for required fields
    const requiredFields = [
      'TaxYear',
      'FormType',
      'SubmissionId',
      'Filer',
      'FederalAGI',
      'MarylandAGI',
      'TaxableIncome'
    ];
    
    for (const field of requiredFields) {
      if (!xml.includes(`<${field}>`)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const form502XmlGenerator = new Form502XmlGenerator();
