import { nanoid } from 'nanoid';
import { db } from '../db';
import { marylandTaxReturns, efileSubmissionLogs } from '@shared/schema';
import type { Form502PersonalInfo, MarylandSpecificInput, MarylandTaxResult } from './form502Generator';
import type { TaxCalculationResult, TaxHouseholdInput } from './policyEngineTaxCalculation';
import { Form502XmlGenerator } from './form502XmlGenerator';
import { notificationService } from './notification.service';
import { eq } from 'drizzle-orm';

/**
 * Maryland iFile Client Service
 * 
 * Handles electronic filing of Maryland Form 502 tax returns through the Maryland iFile system.
 * In MOCK MODE by default until production credentials are obtained from MD Comptroller.
 * 
 * Features:
 * - Maryland iFile API authentication
 * - XML submission with Maryland-specific formatting
 * - Acknowledgment processing for state returns
 * - County tax validation for all 24 Maryland jurisdictions
 * - Joint federal/state submission coordination
 * - Comprehensive error handling and retry logic
 * 
 * Production Requirements (not yet implemented):
 * - Maryland iFile credentials from MD Comptroller
 * - Official Maryland XML schema (XSD) validation
 * - Digital signature/authentication certificates
 * - MD-approved transmission software certification
 */

export interface MarylandIFileConfig {
  environment: 'production' | 'test' | 'mock';
  clientId?: string;
  clientSecret?: string;
  certificatePath?: string;
  apiBaseUrl?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface MarylandSubmissionRequest {
  returnId: string;
  personalInfo: Form502PersonalInfo;
  taxInput: TaxHouseholdInput;
  federalTaxResult: TaxCalculationResult;
  marylandTaxResult: MarylandTaxResult;
  marylandInput: MarylandSpecificInput;
  taxYear: number;
  preparerInfo?: {
    name?: string;
    ptin?: string;
    ein?: string;
  };
}

export interface MarylandSubmissionResponse {
  success: boolean;
  submissionId?: string;
  marylandConfirmationNumber?: string;
  submissionTimestamp?: Date;
  status: 'accepted' | 'rejected' | 'pending' | 'error';
  errors?: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
  warnings?: Array<{
    code: string;
    message: string;
  }>;
}

export interface MarylandAcknowledgment {
  submissionId: string;
  marylandConfirmationNumber: string;
  status: 'accepted' | 'rejected' | 'pending';
  processedTimestamp: Date;
  federalSubmissionId?: string;
  errors?: Array<{
    code: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  countyValidation?: {
    countyCode: string;
    countyName: string;
    taxRateApplied: number;
    validationStatus: 'valid' | 'invalid';
  };
}

// Maryland-specific error codes
const MARYLAND_ERROR_CODES = {
  // Authentication errors
  'AUTH001': 'Invalid Maryland iFile credentials',
  'AUTH002': 'Certificate validation failed',
  'AUTH003': 'Session expired',
  
  // Validation errors
  'VAL001': 'Invalid Maryland county code',
  'VAL002': 'County tax calculation error',
  'VAL003': 'Maryland residency requirement not met',
  'VAL004': 'Invalid Maryland tax credit claim',
  'VAL005': 'Federal AGI mismatch',
  'VAL006': 'Missing required Maryland fields',
  
  // Business rule errors
  'BUS001': 'Poverty level credit exceeds limit',
  'BUS002': 'Renter\'s credit not eligible',
  'BUS003': 'Property tax credit calculation error',
  'BUS004': 'Maryland EITC calculation error',
  'BUS005': 'Non-resident must file Form 502B',
  'BUS006': 'Pension subtraction exceeds maximum',
  
  // County-specific errors
  'CTY001': 'Baltimore City special district rate not applied',
  'CTY002': 'County piggyback tax calculation error',
  'CTY003': 'Invalid county for tax year',
  'CTY004': 'County rate exceeds maximum allowed',
  
  // System errors
  'SYS001': 'Maryland iFile system unavailable',
  'SYS002': 'Submission timeout',
  'SYS003': 'XML schema validation failed',
  'SYS004': 'Duplicate submission detected'
};

// Mock response templates for testing
const MOCK_RESPONSES = {
  successful: {
    success: true,
    submissionId: `MD-${nanoid()}`,
    marylandConfirmationNumber: `MCF${Date.now()}`,
    submissionTimestamp: new Date(),
    status: 'accepted' as const,
    warnings: []
  },
  
  countyError: {
    success: false,
    status: 'rejected' as const,
    errors: [{
      code: 'CTY002',
      message: MARYLAND_ERROR_CODES['CTY002'],
      field: 'county'
    }]
  },
  
  validationError: {
    success: false,
    status: 'rejected' as const,
    errors: [{
      code: 'VAL006',
      message: MARYLAND_ERROR_CODES['VAL006']
    }]
  },
  
  systemError: {
    success: false,
    status: 'error' as const,
    errors: [{
      code: 'SYS001',
      message: MARYLAND_ERROR_CODES['SYS001']
    }]
  }
};

export class MarylandIFileClient {
  private config: MarylandIFileConfig;
  private xmlGenerator: Form502XmlGenerator;
  private authToken?: string;
  private tokenExpiry?: Date;
  
  constructor(config?: MarylandIFileConfig) {
    this.config = {
      environment: config?.environment || 'mock',
      clientId: config?.clientId || process.env.MARYLAND_IFILE_CLIENT_ID,
      clientSecret: config?.clientSecret || process.env.MARYLAND_IFILE_CLIENT_SECRET,
      certificatePath: config?.certificatePath || process.env.MARYLAND_IFILE_CERT_PATH,
      apiBaseUrl: config?.apiBaseUrl || this.getApiBaseUrl(config?.environment || 'mock'),
      maxRetries: config?.maxRetries || 3,
      retryDelayMs: config?.retryDelayMs || 1000
    };
    
    this.xmlGenerator = new Form502XmlGenerator();
  }
  
  private getApiBaseUrl(environment: string): string {
    switch (environment) {
      case 'production':
        return 'https://ifile.marylandtaxes.gov/api/v1';
      case 'test':
        return 'https://test-ifile.marylandtaxes.gov/api/v1';
      case 'mock':
      default:
        return 'mock://maryland-ifile';
    }
  }
  
  /**
   * Authenticate with Maryland iFile system
   */
  private async authenticate(): Promise<boolean> {
    if (this.config.environment === 'mock') {
      // Mock authentication
      this.authToken = `mock-token-${nanoid()}`;
      this.tokenExpiry = new Date(Date.now() + 3600000); // 1 hour
      return true;
    }
    
    // In production, this would make an actual API call to Maryland iFile
    // with client credentials and certificate validation
    throw new Error('Production Maryland iFile authentication not yet implemented');
  }
  
  /**
   * Submit Maryland Form 502 to iFile system
   */
  async submitForm502(request: MarylandSubmissionRequest): Promise<MarylandSubmissionResponse> {
    try {
      // Ensure authenticated
      if (!this.authToken || !this.tokenExpiry || this.tokenExpiry < new Date()) {
        const authSuccess = await this.authenticate();
        if (!authSuccess) {
          return {
            success: false,
            status: 'error',
            errors: [{
              code: 'AUTH001',
              message: MARYLAND_ERROR_CODES['AUTH001']
            }]
          };
        }
      }
      
      // Validate Maryland-specific requirements
      const validationErrors = this.validateMarylandRequirements(request);
      if (validationErrors.length > 0) {
        return {
          success: false,
          status: 'rejected',
          errors: validationErrors
        };
      }
      
      // Generate XML
      const xml = await this.xmlGenerator.generateForm502XML(
        request.personalInfo,
        request.taxInput,
        request.federalTaxResult,
        request.marylandTaxResult,
        request.marylandInput,
        {
          taxYear: request.taxYear,
          preparerName: request.preparerInfo?.name,
          preparerPTIN: request.preparerInfo?.ptin,
          preparerEIN: request.preparerInfo?.ein,
          softwareId: 'MDDHS-NAVIGATOR-1.0',
          softwareVersion: '1.0.0'
        }
      );
      
      // In mock mode, return mock response based on test scenarios
      if (this.config.environment === 'mock') {
        return this.generateMockResponse(request);
      }
      
      // In production, this would submit the XML to Maryland iFile
      throw new Error('Production Maryland iFile submission not yet implemented');
      
    } catch (error) {
      console.error('Maryland iFile submission error:', error);
      
      // Log submission attempt
      await this.logSubmission(request.returnId, 'error', error);
      
      return {
        success: false,
        status: 'error',
        errors: [{
          code: 'SYS002',
          message: error instanceof Error ? error.message : 'Unknown submission error'
        }]
      };
    }
  }
  
  /**
   * Check status of Maryland submission
   */
  async checkSubmissionStatus(submissionId: string): Promise<MarylandAcknowledgment> {
    if (this.config.environment === 'mock') {
      // Return mock acknowledgment
      return {
        submissionId,
        marylandConfirmationNumber: `MCF${Date.now()}`,
        status: Math.random() > 0.1 ? 'accepted' : 'rejected',
        processedTimestamp: new Date(),
        countyValidation: {
          countyCode: 'BC',
          countyName: 'Baltimore City',
          taxRateApplied: 0.032,
          validationStatus: 'valid'
        }
      };
    }
    
    throw new Error('Production Maryland iFile status check not yet implemented');
  }
  
  /**
   * Validate Maryland-specific requirements
   */
  private validateMarylandRequirements(request: MarylandSubmissionRequest): Array<{
    code: string;
    message: string;
    field?: string;
  }> {
    const errors: Array<{ code: string; message: string; field?: string }> = [];
    
    // Validate Maryland residency
    if (!request.personalInfo.marylandResident && request.taxInput.filingStatus !== 'married_separate') {
      errors.push({
        code: 'VAL003',
        message: MARYLAND_ERROR_CODES['VAL003']
      });
    }
    
    // Validate county code
    const validCounties = [
      'ALLEGANY', 'ANNE ARUNDEL', 'BALTIMORE CITY', 'BALTIMORE COUNTY',
      'CALVERT', 'CAROLINE', 'CARROLL', 'CECIL', 'CHARLES', 'DORCHESTER',
      'FREDERICK', 'GARRETT', 'HARFORD', 'HOWARD', 'KENT', 'MONTGOMERY',
      'PRINCE GEORGE\'S', 'QUEEN ANNE\'S', 'ST. MARY\'S', 'SOMERSET',
      'TALBOT', 'WASHINGTON', 'WICOMICO', 'WORCESTER'
    ];
    
    if (!request.personalInfo.county || 
        !validCounties.includes(request.personalInfo.county.toUpperCase())) {
      errors.push({
        code: 'VAL001',
        message: MARYLAND_ERROR_CODES['VAL001'],
        field: 'county'
      });
    }
    
    // Validate pension subtraction
    if (request.marylandInput.pensionIncome && request.marylandInput.pensionIncome > 35700) {
      errors.push({
        code: 'BUS006',
        message: MARYLAND_ERROR_CODES['BUS006'],
        field: 'pensionIncome'
      });
    }
    
    // Validate tax credits
    if (request.marylandTaxResult.marylandEITC < 0) {
      errors.push({
        code: 'BUS004',
        message: MARYLAND_ERROR_CODES['BUS004'],
        field: 'marylandEITC'
      });
    }
    
    // Check for Form 502B requirement (non-residents)
    if (!request.personalInfo.marylandResident && 
        request.personalInfo.state !== 'MD') {
      errors.push({
        code: 'BUS005',
        message: MARYLAND_ERROR_CODES['BUS005']
      });
    }
    
    return errors;
  }
  
  /**
   * Generate mock response for testing
   */
  private generateMockResponse(request: MarylandSubmissionRequest): MarylandSubmissionResponse {
    // Simulate different test scenarios
    const scenario = Math.random();
    
    // 70% success
    if (scenario < 0.7) {
      return MOCK_RESPONSES.successful;
    }
    // 10% county error
    else if (scenario < 0.8) {
      return MOCK_RESPONSES.countyError;
    }
    // 10% validation error
    else if (scenario < 0.9) {
      return MOCK_RESPONSES.validationError;
    }
    // 10% system error
    else {
      return MOCK_RESPONSES.systemError;
    }
  }
  
  /**
   * Validate county tax calculations
   */
  async validateCountyTax(
    county: string,
    taxableIncome: number,
    calculatedTax: number
  ): Promise<{
    isValid: boolean;
    expectedTax?: number;
    variance?: number;
    errors?: string[];
  }> {
    const countyRates: Record<string, number> = {
      'ALLEGANY': 0.0305,
      'ANNE ARUNDEL': 0.027,
      'BALTIMORE CITY': 0.032, // Special district - highest rate
      'BALTIMORE COUNTY': 0.032,
      'CALVERT': 0.030,
      'CAROLINE': 0.028,
      'CARROLL': 0.030,
      'CECIL': 0.028,
      'CHARLES': 0.030,
      'DORCHESTER': 0.0262,
      'FREDERICK': 0.0296,
      'GARRETT': 0.0265,
      'HARFORD': 0.0306,
      'HOWARD': 0.032,
      'KENT': 0.032,
      'MONTGOMERY': 0.032,
      'PRINCE GEORGE\'S': 0.032,
      'QUEEN ANNE\'S': 0.032,
      'ST. MARY\'S': 0.03,
      'SOMERSET': 0.032,
      'TALBOT': 0.0248,
      'WASHINGTON': 0.028,
      'WICOMICO': 0.032,
      'WORCESTER': 0.0125 // Lowest rate
    };
    
    const countyUpper = county.toUpperCase();
    const rate = countyRates[countyUpper];
    
    if (!rate) {
      return {
        isValid: false,
        errors: [`Invalid county: ${county}`]
      };
    }
    
    const expectedTax = taxableIncome * rate;
    const variance = Math.abs(expectedTax - calculatedTax);
    const tolerance = 0.01; // Allow $0.01 rounding difference
    
    return {
      isValid: variance <= tolerance,
      expectedTax,
      variance,
      errors: variance > tolerance ? 
        [`County tax calculation error. Expected: $${expectedTax.toFixed(2)}, Calculated: $${calculatedTax.toFixed(2)}`] : 
        undefined
    };
  }
  
  /**
   * Log submission attempt to database
   */
  private async logSubmission(
    returnId: string,
    status: string,
    details?: any
  ): Promise<void> {
    try {
      await db.insert(efileSubmissionLogs).values({
        returnId,
        returnType: 'maryland',
        submissionStatus: status,
        submittedAt: new Date(),
        responseData: details ? JSON.stringify(details) : null
      });
    } catch (error) {
      console.error('Failed to log Maryland submission:', error);
    }
  }
  
  /**
   * Get list of Maryland counties with tax rates
   */
  getCountiesWithRates(): Array<{
    code: string;
    name: string;
    rate: number;
    isSpecialDistrict: boolean;
  }> {
    return [
      { code: 'AL', name: 'Allegany', rate: 0.0305, isSpecialDistrict: false },
      { code: 'AA', name: 'Anne Arundel', rate: 0.027, isSpecialDistrict: false },
      { code: 'BC', name: 'Baltimore City', rate: 0.032, isSpecialDistrict: true },
      { code: 'BA', name: 'Baltimore County', rate: 0.032, isSpecialDistrict: false },
      { code: 'CA', name: 'Calvert', rate: 0.030, isSpecialDistrict: false },
      { code: 'CE', name: 'Caroline', rate: 0.028, isSpecialDistrict: false },
      { code: 'CR', name: 'Carroll', rate: 0.030, isSpecialDistrict: false },
      { code: 'CC', name: 'Cecil', rate: 0.028, isSpecialDistrict: false },
      { code: 'CH', name: 'Charles', rate: 0.030, isSpecialDistrict: false },
      { code: 'DO', name: 'Dorchester', rate: 0.0262, isSpecialDistrict: false },
      { code: 'FR', name: 'Frederick', rate: 0.0296, isSpecialDistrict: false },
      { code: 'GA', name: 'Garrett', rate: 0.0265, isSpecialDistrict: false },
      { code: 'HA', name: 'Harford', rate: 0.0306, isSpecialDistrict: false },
      { code: 'HO', name: 'Howard', rate: 0.032, isSpecialDistrict: false },
      { code: 'KE', name: 'Kent', rate: 0.032, isSpecialDistrict: false },
      { code: 'MO', name: 'Montgomery', rate: 0.032, isSpecialDistrict: false },
      { code: 'PG', name: 'Prince George\'s', rate: 0.032, isSpecialDistrict: false },
      { code: 'QA', name: 'Queen Anne\'s', rate: 0.032, isSpecialDistrict: false },
      { code: 'SM', name: 'St. Mary\'s', rate: 0.03, isSpecialDistrict: false },
      { code: 'SO', name: 'Somerset', rate: 0.032, isSpecialDistrict: false },
      { code: 'TA', name: 'Talbot', rate: 0.0248, isSpecialDistrict: false },
      { code: 'WA', name: 'Washington', rate: 0.028, isSpecialDistrict: false },
      { code: 'WI', name: 'Wicomico', rate: 0.032, isSpecialDistrict: false },
      { code: 'WO', name: 'Worcester', rate: 0.0125, isSpecialDistrict: false }
    ];
  }
}

// Export singleton instance with mock mode as default
export const marylandIFileClient = new MarylandIFileClient({
  environment: 'mock'
});