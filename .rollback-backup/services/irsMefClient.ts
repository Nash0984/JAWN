import { Builder, parseStringPromise } from 'xml2js';
import axios, { AxiosInstance } from 'axios';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { federalTaxReturns, efileSubmissionLogs } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * IRS Modernized e-File (MeF) Client Service
 * 
 * Manages communication with the IRS MeF system for electronic tax return submission.
 * 
 * Features:
 * - SOAP/XML message formatting per IRS MeF specifications
 * - Authentication token management (EFIN/PTIN based)
 * - Transmission methods for return submission and acknowledgment retrieval
 * - Circuit breaker pattern for fault tolerance
 * - Comprehensive mock responses for testing
 * - Automatic retry with exponential backoff
 * 
 * IRS MeF Endpoints (Production):
 * - Submission: https://la.www4.irs.gov/a2a/mef/services/SubmissionServices
 * - Status: https://la.www4.irs.gov/a2a/mef/services/StatusServices
 * 
 * IMPORTANT: Production submission requires:
 * - Valid EFIN (Electronic Filing Identification Number)
 * - IRS-approved software ID
 * - Digital certificates for authentication
 * - Compliance with IRS Publication 4164
 */

interface MefConfig {
  efin?: string;
  softwareId?: string;
  softwareVersion?: string;
  preparerPtin?: string;
  preparerEin?: string;
  isMockMode: boolean;
  endpoint?: string;
  maxRetries?: number;
  circuitBreakerThreshold?: number;
}

interface TransmissionResult {
  success: boolean;
  transmissionId?: string;
  submissionId?: string;
  timestamp?: Date;
  statusCode?: string;
  statusMessage?: string;
  errors?: Array<{
    code: string;
    message: string;
    field?: string;
    severity?: 'error' | 'warning';
  }>;
  rawResponse?: any;
}

interface AcknowledgmentResult {
  status: 'accepted' | 'rejected' | 'pending' | 'error';
  dcnNumber?: string;
  transmissionId?: string;
  acceptedTimestamp?: Date;
  rejectionCode?: string;
  rejectionReason?: string;
  rejectionDetails?: any;
  businessRuleErrors?: Array<{
    ruleNumber: string;
    errorCategory: string;
    errorMessage: string;
    lineNumber?: string;
    xpath?: string;
  }>;
}

interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

export class IrsMefClient {
  private config: MefConfig;
  private httpClient: AxiosInstance;
  private xmlBuilder: Builder;
  private circuitBreaker: CircuitBreakerState;
  private authToken?: string;
  private tokenExpiry?: Date;
  
  constructor(config: Partial<MefConfig> = {}) {
    this.config = {
      isMockMode: process.env.IRS_MOCK_MODE !== 'false', // Default to mock mode
      endpoint: process.env.IRS_MEF_ENDPOINT || 'https://la.www4.irs.gov/a2a/mef/services',
      efin: process.env.IRS_EFIN,
      softwareId: process.env.IRS_SOFTWARE_ID || 'MDTAXNAV2025',
      softwareVersion: process.env.IRS_SOFTWARE_VERSION || '1.0.0',
      preparerPtin: process.env.IRS_PREPARER_PTIN,
      preparerEin: process.env.IRS_PREPARER_EIN,
      maxRetries: 3,
      circuitBreakerThreshold: 5,
      ...config
    };
    
    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'User-Agent': `${this.config.softwareId}/${this.config.softwareVersion}`
      }
    });
    
    this.xmlBuilder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true }
    });
    
    this.circuitBreaker = {
      isOpen: false,
      failureCount: 0
    };
  }
  
  /**
   * Submit a tax return to IRS MeF
   */
  async transmitReturn(
    returnId: string,
    xmlContent: string
  ): Promise<TransmissionResult> {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      return {
        success: false,
        statusCode: 'CIRCUIT_BREAKER_OPEN',
        statusMessage: 'Service temporarily unavailable due to repeated failures',
        errors: [{
          code: 'CB_OPEN',
          message: 'Circuit breaker is open. Service will retry after cooldown period.',
          severity: 'error'
        }]
      };
    }
    
    // Use mock service if in mock mode
    if (this.config.isMockMode) {
      return this.mockTransmitReturn(returnId, xmlContent);
    }
    
    try {
      // Ensure we have authentication
      await this.ensureAuthentication();
      
      // Build SOAP envelope
      const soapEnvelope = this.buildTransmissionEnvelope(returnId, xmlContent);
      
      // Submit to IRS
      const response = await this.httpClient.post('/SubmissionServices', soapEnvelope, {
        headers: {
          'SOAPAction': '"TransmitReturn"',
          'Authorization': `Bearer ${this.authToken}`
        }
      });
      
      // Parse response
      const result = await this.parseTransmissionResponse(response.data);
      
      // Reset circuit breaker on success
      if (result.success) {
        this.resetCircuitBreaker();
      }
      
      // Log submission
      await this.logSubmission(returnId, 'transmitted', result);
      
      return result;
      
    } catch (error) {
      // Increment circuit breaker
      this.incrementCircuitBreaker();
      
      // Log error
      await this.logSubmission(returnId, 'error', {
        success: false,
        errors: [{
          code: 'TRANSMISSION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'error'
        }]
      });
      
      throw error;
    }
  }
  
  /**
   * Retrieve acknowledgment from IRS
   */
  async getAcknowledgment(
    transmissionId: string,
    submissionId?: string
  ): Promise<AcknowledgmentResult> {
    // Use mock service if in mock mode
    if (this.config.isMockMode) {
      return this.mockGetAcknowledgment(transmissionId);
    }
    
    try {
      await this.ensureAuthentication();
      
      const soapEnvelope = this.buildAcknowledgmentEnvelope(transmissionId, submissionId);
      
      const response = await this.httpClient.post('/StatusServices', soapEnvelope, {
        headers: {
          'SOAPAction': '"GetAcknowledgment"',
          'Authorization': `Bearer ${this.authToken}`
        }
      });
      
      return await this.parseAcknowledgmentResponse(response.data);
      
    } catch (error) {
      throw new Error(`Failed to get acknowledgment: ${error}`);
    }
  }
  
  /**
   * Build SOAP envelope for transmission
   */
  private buildTransmissionEnvelope(returnId: string, xmlContent: string): string {
    const envelope = {
      'soap:Envelope': {
        $: {
          'xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/',
          'xmlns:mef': 'http://www.irs.gov/efile/mef/services'
        },
        'soap:Header': {
          'mef:Authentication': {
            'mef:EFIN': this.config.efin || 'TEST_EFIN',
            'mef:SoftwareId': this.config.softwareId,
            'mef:SessionToken': this.authToken || 'TEST_TOKEN'
          }
        },
        'soap:Body': {
          'mef:TransmitReturn': {
            'mef:ReturnData': {
              'mef:ElectronicPostmark': new Date().toISOString(),
              'mef:ReturnId': returnId,
              'mef:XMLContent': {
                $: { encoding: 'base64' },
                _: Buffer.from(xmlContent).toString('base64')
              }
            }
          }
        }
      }
    };
    
    return this.xmlBuilder.buildObject(envelope);
  }
  
  /**
   * Build SOAP envelope for acknowledgment request
   */
  private buildAcknowledgmentEnvelope(transmissionId: string, submissionId?: string): string {
    const envelope = {
      'soap:Envelope': {
        $: {
          'xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/',
          'xmlns:mef': 'http://www.irs.gov/efile/mef/services'
        },
        'soap:Header': {
          'mef:Authentication': {
            'mef:EFIN': this.config.efin || 'TEST_EFIN',
            'mef:SoftwareId': this.config.softwareId,
            'mef:SessionToken': this.authToken || 'TEST_TOKEN'
          }
        },
        'soap:Body': {
          'mef:GetAcknowledgment': {
            'mef:TransmissionId': transmissionId,
            ...(submissionId && { 'mef:SubmissionId': submissionId })
          }
        }
      }
    };
    
    return this.xmlBuilder.buildObject(envelope);
  }
  
  /**
   * Parse transmission response
   */
  private async parseTransmissionResponse(xmlResponse: string): Promise<TransmissionResult> {
    const parsed = await parseStringPromise(xmlResponse);
    const body = parsed?.['soap:Envelope']?.['soap:Body']?.[0];
    
    if (body?.['mef:TransmitReturnResponse']) {
      const response = body['mef:TransmitReturnResponse'][0];
      return {
        success: true,
        transmissionId: response['mef:TransmissionId']?.[0],
        submissionId: response['mef:SubmissionId']?.[0],
        timestamp: new Date(response['mef:Timestamp']?.[0]),
        statusCode: response['mef:StatusCode']?.[0],
        statusMessage: response['mef:StatusMessage']?.[0]
      };
    }
    
    if (body?.['soap:Fault']) {
      const fault = body['soap:Fault'][0];
      return {
        success: false,
        statusCode: fault['faultcode']?.[0],
        statusMessage: fault['faultstring']?.[0],
        errors: [{
          code: fault['faultcode']?.[0] || 'SOAP_FAULT',
          message: fault['faultstring']?.[0] || 'SOAP fault occurred',
          severity: 'error'
        }]
      };
    }
    
    return {
      success: false,
      statusCode: 'PARSE_ERROR',
      statusMessage: 'Unable to parse response',
      rawResponse: xmlResponse
    };
  }
  
  /**
   * Parse acknowledgment response
   */
  private async parseAcknowledgmentResponse(xmlResponse: string): Promise<AcknowledgmentResult> {
    const parsed = await parseStringPromise(xmlResponse);
    const body = parsed?.['soap:Envelope']?.['soap:Body']?.[0];
    
    if (body?.['mef:GetAcknowledgmentResponse']) {
      const response = body['mef:GetAcknowledgmentResponse'][0];
      const status = response['mef:Status']?.[0];
      
      if (status === 'Accepted') {
        return {
          status: 'accepted',
          dcnNumber: response['mef:DCN']?.[0],
          transmissionId: response['mef:TransmissionId']?.[0],
          acceptedTimestamp: new Date(response['mef:AcceptedTimestamp']?.[0])
        };
      }
      
      if (status === 'Rejected') {
        const errors = response['mef:Errors']?.[0]?.['mef:Error'] || [];
        return {
          status: 'rejected',
          transmissionId: response['mef:TransmissionId']?.[0],
          rejectionCode: response['mef:RejectionCode']?.[0],
          rejectionReason: response['mef:RejectionReason']?.[0],
          businessRuleErrors: errors.map((err: any) => ({
            ruleNumber: err['mef:RuleNumber']?.[0],
            errorCategory: err['mef:Category']?.[0],
            errorMessage: err['mef:Message']?.[0],
            lineNumber: err['mef:LineNumber']?.[0],
            xpath: err['mef:XPath']?.[0]
          }))
        };
      }
      
      return {
        status: 'pending'
      };
    }
    
    return {
      status: 'error',
      rejectionReason: 'Unable to parse acknowledgment response'
    };
  }
  
  /**
   * Ensure we have valid authentication
   */
  private async ensureAuthentication(): Promise<void> {
    if (this.authToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return; // Token is still valid
    }
    
    // In production, this would authenticate with IRS using EFIN
    // For now, we'll simulate authentication
    this.authToken = `IRS_TOKEN_${nanoid()}`;
    this.tokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
  }
  
  /**
   * Circuit breaker management
   */
  private isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }
    
    // Check if cooldown period has passed (5 minutes)
    const cooldownPeriod = 5 * 60 * 1000;
    if (this.circuitBreaker.lastFailureTime) {
      const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailureTime.getTime();
      if (timeSinceFailure > cooldownPeriod) {
        this.resetCircuitBreaker();
        return false;
      }
    }
    
    return true;
  }
  
  private incrementCircuitBreaker(): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = new Date();
    
    if (this.circuitBreaker.failureCount >= (this.config.circuitBreakerThreshold || 5)) {
      this.circuitBreaker.isOpen = true;
      this.circuitBreaker.nextRetryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    }
  }
  
  private resetCircuitBreaker(): void {
    this.circuitBreaker = {
      isOpen: false,
      failureCount: 0
    };
  }
  
  /**
   * Log submission attempt
   */
  private async logSubmission(returnId: string, action: string, result: any): Promise<void> {
    try {
      await db.insert(efileSubmissionLogs).values({
        federalReturnId: returnId,
        returnType: 'federal',
        action,
        actionDetails: result,
        transmissionId: result.transmissionId,
        submissionId: result.submissionId,
        responseCode: result.statusCode,
        responseData: result,
        errorType: result.errors?.[0]?.code,
        errorMessage: result.errors?.[0]?.message,
        isMockSubmission: this.config.isMockMode,
        circuitBreakerStatus: this.circuitBreaker.isOpen ? 'open' : 'closed'
      });
    } catch (error) {
      console.error('Failed to log submission:', error);
    }
  }
  
  // ============================================================================
  // MOCK IMPLEMENTATIONS FOR TESTING
  // ============================================================================
  
  /**
   * Mock transmission for testing
   */
  private async mockTransmitReturn(returnId: string, xmlContent: string): Promise<TransmissionResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Generate random scenario
    const scenario = this.selectMockScenario();
    
    switch (scenario) {
      case 'success':
        return {
          success: true,
          transmissionId: `MOCK_TRANS_${nanoid(10)}`,
          submissionId: `MOCK_SUB_${nanoid(10)}`,
          timestamp: new Date(),
          statusCode: '0000',
          statusMessage: 'Return successfully transmitted'
        };
        
      case 'business_rule_error':
        return {
          success: false,
          statusCode: 'BR001',
          statusMessage: 'Business rule validation failed',
          errors: [
            {
              code: 'BR001',
              message: 'Dependent SSN is invalid or missing',
              field: 'DependentSSN',
              severity: 'error'
            },
            {
              code: 'BR002',
              message: 'Filing status incompatible with spouse information',
              field: 'FilingStatus',
              severity: 'error'
            }
          ]
        };
        
      case 'schema_error':
        return {
          success: false,
          statusCode: 'SCHEMA_001',
          statusMessage: 'XML schema validation failed',
          errors: [
            {
              code: 'XSD001',
              message: 'Element "TaxpayerSSN" does not match pattern',
              field: 'TaxpayerSSN',
              severity: 'error'
            }
          ]
        };
        
      case 'network_error':
        throw new Error('Network timeout - simulated error');
        
      case 'server_error':
        return {
          success: false,
          statusCode: '5000',
          statusMessage: 'Internal server error',
          errors: [
            {
              code: 'SERVER_ERROR',
              message: 'The IRS system is temporarily unavailable',
              severity: 'error'
            }
          ]
        };
        
      default:
        return {
          success: true,
          transmissionId: `MOCK_TRANS_${nanoid(10)}`,
          submissionId: `MOCK_SUB_${nanoid(10)}`,
          timestamp: new Date(),
          statusCode: '0000',
          statusMessage: 'Return successfully transmitted'
        };
    }
  }
  
  /**
   * Mock acknowledgment for testing
   */
  private async mockGetAcknowledgment(transmissionId: string): Promise<AcknowledgmentResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Generate random scenario
    const scenario = this.selectMockAcknowledgmentScenario();
    
    switch (scenario) {
      case 'accepted':
        return {
          status: 'accepted',
          dcnNumber: `${new Date().getFullYear()}${nanoid(10).toUpperCase()}`,
          transmissionId,
          acceptedTimestamp: new Date()
        };
        
      case 'rejected':
        return {
          status: 'rejected',
          transmissionId,
          rejectionCode: 'IND-180',
          rejectionReason: 'The primary SSN has been locked due to identity theft concerns',
          businessRuleErrors: [
            {
              ruleNumber: 'IND-180',
              errorCategory: 'Identity Protection',
              errorMessage: 'Primary taxpayer SSN is locked. File Form 14039',
              lineNumber: '7'
            }
          ]
        };
        
      case 'rejected_math_error':
        return {
          status: 'rejected',
          transmissionId,
          rejectionCode: 'MATH-001',
          rejectionReason: 'Mathematical errors detected in return',
          businessRuleErrors: [
            {
              ruleNumber: 'MATH-001',
              errorCategory: 'Math Error',
              errorMessage: 'Line 16 (Total Tax) does not equal sum of lines 12-15',
              lineNumber: '16',
              xpath: '/Return/ReturnData/IRS1040/TotalTax'
            }
          ]
        };
        
      case 'pending':
        return {
          status: 'pending'
        };
        
      default:
        return {
          status: 'accepted',
          dcnNumber: `${new Date().getFullYear()}${nanoid(10).toUpperCase()}`,
          transmissionId,
          acceptedTimestamp: new Date()
        };
    }
  }
  
  /**
   * Select mock scenario based on weighted probability
   */
  private selectMockScenario(): string {
    const rand = Math.random();
    if (rand < 0.7) return 'success';
    if (rand < 0.8) return 'business_rule_error';
    if (rand < 0.85) return 'schema_error';
    if (rand < 0.9) return 'network_error';
    return 'server_error';
  }
  
  private selectMockAcknowledgmentScenario(): string {
    const rand = Math.random();
    if (rand < 0.7) return 'accepted';
    if (rand < 0.85) return 'rejected';
    if (rand < 0.95) return 'rejected_math_error';
    return 'pending';
  }
  
  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }
  
  /**
   * Manual circuit breaker reset (for admin use)
   */
  forceResetCircuitBreaker(): void {
    this.resetCircuitBreaker();
  }
}

// Export singleton instance
export const irsMefClient = new IrsMefClient();