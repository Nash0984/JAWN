import { db } from '../db';
import { storage } from '../storage';
import { federalTaxReturns, marylandTaxReturns } from '@shared/schema';
import type { FederalTaxReturn, MarylandTaxReturn } from '@shared/schema';
import { Form1040XmlGenerator, Form1040XmlOptions } from './form1040XmlGenerator';
import { Form502XmlGenerator, Form502XmlOptions } from './form502XmlGenerator';
import { eq, desc, and, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * E-File Queue Service for IRS/Maryland Tax Return Submission Management
 * 
 * Manages the electronic filing workflow for federal (Form 1040) and state (Form 502) tax returns.
 * 
 * Features:
 * - Queue management for tax return e-file submissions
 * - Validation of tax return data before submission
 * - XML generation for IRS MeF and Maryland iFile formats
 * - Status tracking and retry logic
 * - Integration points for IRS/Maryland APIs (placeholder)
 * 
 * E-File Status Flow:
 * 1. draft → ready (after validation + XML generation)
 * 2. ready → transmitted (after submission to IRS/MD)
 * 3. transmitted → accepted OR rejected (based on acknowledgment)
 * 4. rejected → ready (after retry)
 * 
 * Note: Actual IRS/Maryland transmission requires production credentials.
 * This service provides the queue management foundation.
 */

interface ValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }>;
}

interface SubmissionResult {
  success: boolean;
  federalReturnId: string;
  efileStatus: string;
  transmissionId?: string;
  errors?: string[];
  xmlGenerated?: boolean;
}

interface StatusUpdateData {
  status: 'transmitted' | 'accepted' | 'rejected';
  transmissionId?: string;
  rejectionReason?: string;
  rejectionDetails?: any;
}

export class EFileQueueService {
  private form1040Generator: Form1040XmlGenerator;
  private form502Generator: Form502XmlGenerator;
  private readonly MAX_RETRY_ATTEMPTS = 3;

  constructor() {
    this.form1040Generator = new Form1040XmlGenerator();
    this.form502Generator = new Form502XmlGenerator();
  }

  /**
   * Submit a federal tax return for e-filing
   * Validates data, generates XML, and updates status to "ready"
   */
  async submitForEFile(federalReturnId: string): Promise<SubmissionResult> {
    try {
      // 1. Fetch the federal tax return
      const federalReturn = await storage.getFederalTaxReturn(federalReturnId);
      if (!federalReturn) {
        return {
          success: false,
          federalReturnId,
          efileStatus: 'draft',
          errors: ['Federal tax return not found']
        };
      }

      // 2. Validate the tax return data
      const validationResult = await this.validateTaxReturn(federalReturn);
      if (!validationResult.isValid) {
        // Store validation errors in the database
        await storage.updateFederalTaxReturn(federalReturnId, {
          validationErrors: validationResult.errors,
          efileStatus: 'draft'
        });

        return {
          success: false,
          federalReturnId,
          efileStatus: 'draft',
          errors: validationResult.errors.map(e => `${e.field}: ${e.message}`)
        };
      }

      // 3. Actually generate Form 1040 XML
      let form1040Xml: string | null = null;
      let xmlGenerationError: string | null = null;
      
      try {
        const form1040Data = federalReturn.form1040Data as any;
        
        // Extract personal info for XML generator
        const personalInfo = {
          taxpayerFirstName: form1040Data?.taxpayerInfo?.firstName || '',
          taxpayerLastName: form1040Data?.taxpayerInfo?.lastName || '',
          taxpayerSSN: form1040Data?.taxpayerInfo?.ssn || '',
          spouseFirstName: form1040Data?.spouseInfo?.firstName,
          spouseLastName: form1040Data?.spouseInfo?.lastName,
          spouseSSN: form1040Data?.spouseInfo?.ssn,
          streetAddress: form1040Data?.address?.street || '',
          aptNumber: form1040Data?.address?.apt,
          city: form1040Data?.address?.city || '',
          state: form1040Data?.address?.state || '',
          zipCode: form1040Data?.address?.zipCode || '',
          dependents: form1040Data?.dependents || [],
          virtualCurrency: form1040Data?.virtualCurrency || false,
          taxpayerPresidentialFund: form1040Data?.taxpayerPresidentialFund,
          spousePresidentialFund: form1040Data?.spousePresidentialFund
        };

        // Extract tax input
        const taxInput = {
          taxYear: federalReturn.taxYear,
          filingStatus: (federalReturn.filingStatus || 'single') as 'single' | 'married_joint' | 'married_separate' | 'head_of_household' | 'qualifying_widow',
          stateCode: 'MD',
          taxpayer: {
            age: form1040Data?.taxpayerInfo?.age || 40,
            isBlind: form1040Data?.taxpayerInfo?.isBlind,
            isDisabled: form1040Data?.taxpayerInfo?.isDisabled
          },
          spouse: form1040Data?.spouseInfo ? {
            age: form1040Data.spouseInfo.age || 40,
            isBlind: form1040Data.spouseInfo.isBlind,
            isDisabled: form1040Data.spouseInfo.isDisabled
          } : undefined,
          w2Income: form1040Data?.income?.w2Income,
          interestIncome: form1040Data?.income?.interest,
          dividendIncome: form1040Data?.income?.dividends,
          iraDistributions: form1040Data?.income?.iraDistributions,
          pensionDistributions: form1040Data?.income?.pensionDistributions,
          socialSecurityBenefits: form1040Data?.income?.socialSecurityBenefits,
          capitalGains: form1040Data?.income?.capitalGains,
          unemploymentCompensation: form1040Data?.income?.unemploymentCompensation,
          selfEmploymentIncome: form1040Data?.income?.selfEmploymentIncome,
          standardDeduction: form1040Data?.deductions?.standardDeduction,
          itemizedDeductions: form1040Data?.deductions?.itemizedDeductions
        };

        // Extract tax result (calculate totalIncome from AGI or form data)
        const totalIncome = form1040Data?.calculations?.totalIncome || federalReturn.adjustedGrossIncome || 0;
        const refundAmount = federalReturn.refundAmount || 0;
        
        // Fix amount owed calculation
        const amountOwed = refundAmount < 0 ? Math.abs(refundAmount) : 0;
        const refund = refundAmount > 0 ? refundAmount : 0;
        
        const taxResult = {
          totalIncome,
          adjustedGrossIncome: federalReturn.adjustedGrossIncome || 0,
          taxableIncome: federalReturn.taxableIncome || 0,
          totalTax: federalReturn.totalTax || 0,
          taxableSocialSecurity: form1040Data?.calculations?.taxableSocialSecurity || 0,
          deductionBreakdown: {
            usedStandardDeduction: form1040Data?.deductions?.usedStandardDeduction || true,
            standardDeductionAmount: form1040Data?.deductions?.standardDeductionAmount || 0,
            itemizedDeductions: form1040Data?.deductions?.itemizedDeductions || {}
          },
          credits: form1040Data?.credits || {},
          refundAmount: refund,
          amountOwed: amountOwed,
          effectiveTaxRate: form1040Data?.calculations?.effectiveTaxRate || 0,
          // Add payment details
          federalWithholding: form1040Data?.payments?.federalWithholding || federalReturn.wageWithholding || 0,
          estimatedTaxPayments: form1040Data?.payments?.estimatedTaxPayments || federalReturn.estimatedTaxPayments || 0
        };

        // Generate XML with preparer information
        const preparerInfo = form1040Data?.preparerInfo || {};
        form1040Xml = await this.form1040Generator.generateForm1040XML(
          personalInfo,
          taxInput,
          taxResult,
          {
            taxYear: federalReturn.taxYear,
            preparerName: preparerInfo.name,
            preparerPTIN: preparerInfo.ptin,
            preparerEIN: preparerInfo.ein,
            softwareId: 'MD-BENEFITS-PLATFORM',
            softwareVersion: '1.0'
          }
        );
      } catch (error) {
        console.error('Form 1040 XML generation error:', error);
        xmlGenerationError = error instanceof Error ? error.message : 'Unknown XML generation error';
      }
      
      // 4. Check if Maryland return exists and generate Form 502 XML
      const marylandReturn = await storage.getMarylandTaxReturnByFederalId(federalReturnId);
      let form502Xml: string | null = null;
      
      if (marylandReturn) {
        try {
          const form1040Data = federalReturn.form1040Data as any;
          const form502Data = marylandReturn.form502Data as any;

          // Extract personal info for Maryland
          const personalInfo = {
            taxpayerFirstName: form1040Data?.taxpayerInfo?.firstName || '',
            taxpayerLastName: form1040Data?.taxpayerInfo?.lastName || '',
            taxpayerSSN: form1040Data?.taxpayerInfo?.ssn || '',
            spouseFirstName: form1040Data?.spouseInfo?.firstName,
            spouseLastName: form1040Data?.spouseInfo?.lastName,
            spouseSSN: form1040Data?.spouseInfo?.ssn,
            streetAddress: form1040Data?.address?.street || '',
            aptNumber: form1040Data?.address?.apt,
            city: form1040Data?.address?.city || '',
            state: form1040Data?.address?.state || '',
            zipCode: form1040Data?.address?.zipCode || '',
            county: form502Data?.countyName || marylandReturn.countyCode || '',
            countyCode: marylandReturn.countyCode || '',
            cityCode: form502Data?.cityCode || '',
            marylandResident: form502Data?.marylandResident ?? true,
            fullYearResident: form502Data?.fullYearResident ?? true,
            partYearResident: form502Data?.partYearResident ?? false,
            dependents: form1040Data?.dependents || []
          };

          const taxInput = {
            taxYear: federalReturn.taxYear,
            filingStatus: (federalReturn.filingStatus || 'single') as 'single' | 'married_joint' | 'married_separate' | 'head_of_household' | 'qualifying_widow',
            stateCode: 'MD',
            taxpayer: {
              age: form1040Data?.taxpayerInfo?.age || 40,
              isBlind: form1040Data?.taxpayerInfo?.isBlind,
              isDisabled: form1040Data?.taxpayerInfo?.isDisabled
            },
            spouse: form1040Data?.spouseInfo ? {
              age: form1040Data.spouseInfo.age || 40,
              isBlind: form1040Data.spouseInfo.isBlind,
              isDisabled: form1040Data.spouseInfo.isDisabled
            } : undefined,
            w2Income: form1040Data?.income?.w2Income,
            interestIncome: form1040Data?.income?.interest,
            dividendIncome: form1040Data?.income?.dividends
          };

          const totalIncome = form1040Data?.calculations?.totalIncome || federalReturn.adjustedGrossIncome || 0;
          const federalRefundAmount = federalReturn.refundAmount || 0;
          
          // Fix amount owed calculation for federal
          const federalAmountOwed = federalRefundAmount < 0 ? Math.abs(federalRefundAmount) : 0;
          const federalRefund = federalRefundAmount > 0 ? federalRefundAmount : 0;
          
          const federalTaxResult = {
            totalIncome,
            adjustedGrossIncome: federalReturn.adjustedGrossIncome || 0,
            taxableIncome: federalReturn.taxableIncome || 0,
            totalTax: federalReturn.totalTax || 0,
            taxableSocialSecurity: form1040Data?.calculations?.taxableSocialSecurity || 0,
            deductionBreakdown: {
              usedStandardDeduction: form1040Data?.deductions?.usedStandardDeduction || true,
              standardDeductionAmount: form1040Data?.deductions?.standardDeductionAmount || 0,
              itemizedDeductions: form1040Data?.deductions?.itemizedDeductions || {}
            },
            credits: form1040Data?.credits || {},
            refundAmount: federalRefund,
            amountOwed: federalAmountOwed,
            effectiveTaxRate: form1040Data?.calculations?.effectiveTaxRate || 0,
            // Add payment details
            federalWithholding: form1040Data?.payments?.federalWithholding || federalReturn.wageWithholding || 0,
            estimatedTaxPayments: form1040Data?.payments?.estimatedTaxPayments || federalReturn.estimatedTaxPayments || 0
          };

          // Extract Maryland tax result with all credits
          const stateRefundAmount = marylandReturn.stateRefund || 0;
          const stateAmountOwed = stateRefundAmount < 0 ? Math.abs(stateRefundAmount) : 0;
          const stateRefund = stateRefundAmount > 0 ? stateRefundAmount : 0;
          
          const marylandTaxResult = {
            marylandAGI: marylandReturn.marylandAGI || 0,
            marylandTaxableIncome: marylandReturn.marylandTaxableIncome || form502Data?.taxableIncome || 0,
            stateTax: marylandReturn.marylandTax || 0,
            countyTax: marylandReturn.countyTax || 0,
            totalMarylandTax: (marylandReturn.marylandTax || 0) + (marylandReturn.countyTax || 0),
            // Add Maryland-specific credit schedules
            marylandEITC: form502Data?.credits?.eitc || marylandReturn.marylandEITC || 0,
            povertyLevelCredit: form502Data?.credits?.povertyLevel || marylandReturn.povertyLevelCredit || 0,
            propertyTaxCredit: form502Data?.credits?.propertyTax || 0,
            rentersCredit: form502Data?.credits?.renters || 0,
            stateRefund: stateRefund,
            stateAmountOwed: stateAmountOwed,
            effectiveStateRate: form502Data?.effectiveStateRate || 0,
            effectiveCountyRate: form502Data?.effectiveCountyRate || 0
          };

          // Extract Maryland-specific input with actual values
          const marylandInput = {
            countyCode: marylandReturn.countyCode || '',
            cityCode: form502Data?.cityCode || '',
            localTaxRate: form502Data?.localTaxRate || 0,
            childcareExpenses: form502Data?.childcareExpenses || 0,
            studentLoanInterest: form502Data?.studentLoanInterest || 0,
            // Add withholding lines
            marylandWithholding: form502Data?.marylandWithholding || marylandReturn.marylandWithholding || 0,
            // Maryland additions/subtractions
            stateTaxRefund: form502Data?.stateTaxRefund || 0,
            socialSecurityBenefits: form1040Data?.income?.socialSecurityBenefits || 0,
            railroadRetirement: form502Data?.railroadRetirement || 0,
            pensionIncome: form502Data?.pensionIncome || 0,
            // Credits
            propertyTaxPaid: form502Data?.propertyTaxPaid || 0,
            rentPaid: form502Data?.rentPaid || 0
          };

          // Add preparer information to Form 502
          const preparerInfo = form1040Data?.preparerInfo || {};
          form502Xml = await this.form502Generator.generateForm502XML(
            personalInfo,
            taxInput,
            federalTaxResult,
            marylandTaxResult,
            marylandInput,
            {
              taxYear: federalReturn.taxYear,
              preparerName: preparerInfo.name,
              preparerPTIN: preparerInfo.ptin,
              preparerEIN: preparerInfo.ein,
              softwareId: 'MD-BENEFITS-PLATFORM',
              softwareVersion: '1.0'
            }
          );
        } catch (error) {
          console.error('Form 502 XML generation error:', error);
          const mdXmlError = error instanceof Error ? error.message : 'Unknown XML generation error';
          form502Xml = `<!-- Form 502 XML generation failed: ${mdXmlError} -->`;
        }
      }

      // 5. Check if XML generation succeeded
      if (xmlGenerationError) {
        // XML generation failed - keep in draft status
        await storage.updateFederalTaxReturn(federalReturnId, {
          efileStatus: 'draft',
          validationErrors: {
            xmlGenerationFailed: true,
            error: xmlGenerationError
          }
        });
        
        return {
          success: false,
          federalReturnId,
          efileStatus: 'draft',
          errors: [`XML generation failed: ${xmlGenerationError}`]
        };
      }

      // 6. Only generate transmission ID if XML succeeded
      const transmissionId = `TX-${Date.now()}-${nanoid(10)}`;

      // 7. Merge quality review data (preserve existing data)
      const existingReview = (federalReturn.qualityReview as Record<string, any>) || {};
      const mergedReview = {
        ...existingReview,
        xmlGenerated: true,
        form1040XmlLength: form1040Xml?.length || 0,
        form502XmlLength: form502Xml?.length || 0,
        generatedXml: {
          form1040: form1040Xml,
          form502: form502Xml
        },
        validatedAt: new Date().toISOString(),
        transmissionId
      };

      // 8. Update status to "ready" with transmission ID
      await storage.updateFederalTaxReturn(federalReturnId, {
        efileStatus: 'ready',
        efileTransmissionId: transmissionId,
        efileSubmittedAt: new Date(),
        validationErrors: null,
        qualityReview: mergedReview
      });

      // 9. TODO: Transmit to IRS/Maryland (placeholder)
      // const irsResult = await this.transmitToIRS(form1040Xml, federalReturn);
      // const mdResult = form502Xml ? await this.transmitToMaryland(form502Xml, marylandReturn) : null;

      return {
        success: true,
        federalReturnId,
        efileStatus: 'ready',
        transmissionId,
        xmlGenerated: true
      };

    } catch (error) {
      console.error('E-file submission error:', error);
      
      // Store error in database
      await storage.updateFederalTaxReturn(federalReturnId, {
        efileStatus: 'draft',
        efileRejectionReason: error instanceof Error ? error.message : 'Unknown error during submission'
      });

      return {
        success: false,
        federalReturnId,
        efileStatus: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Check the e-file status of a tax return
   */
  async checkStatus(federalReturnId: string): Promise<{
    federalReturn: FederalTaxReturn;
    marylandReturn?: MarylandTaxReturn;
  }> {
    const federalReturn = await storage.getFederalTaxReturn(federalReturnId);
    if (!federalReturn) {
      throw new Error('Federal tax return not found');
    }

    const marylandReturn = await storage.getMarylandTaxReturnByFederalId(federalReturnId);

    return {
      federalReturn,
      marylandReturn: marylandReturn || undefined
    };
  }

  /**
   * Retry a failed e-file submission
   * Resets status and increments retry counter
   */
  async retryFailedSubmission(federalReturnId: string): Promise<SubmissionResult> {
    const federalReturn = await storage.getFederalTaxReturn(federalReturnId);
    if (!federalReturn) {
      return {
        success: false,
        federalReturnId,
        efileStatus: 'draft',
        errors: ['Federal tax return not found']
      };
    }

    // Check retry attempts (preserve existing quality review data)
    const existingReview = (federalReturn.qualityReview as Record<string, any>) || {};
    const retryAttempts = existingReview.retryAttempts || 0;

    if (retryAttempts >= this.MAX_RETRY_ATTEMPTS) {
      return {
        success: false,
        federalReturnId,
        efileStatus: federalReturn.efileStatus || 'rejected',
        errors: [`Maximum retry attempts (${this.MAX_RETRY_ATTEMPTS}) exceeded`]
      };
    }

    // Reset status and increment retry counter (merge with existing data)
    const mergedReview = {
      ...existingReview,
      retryAttempts: retryAttempts + 1,
      lastRetryAt: new Date().toISOString()
    };

    await storage.updateFederalTaxReturn(federalReturnId, {
      efileStatus: 'draft',
      qualityReview: mergedReview
    });

    // Re-submit
    return await this.submitForEFile(federalReturnId);
  }

  /**
   * Get pending submissions (ready for transmission)
   */
  async getPendingSubmissions(): Promise<FederalTaxReturn[]> {
    return await storage.getFederalTaxReturns({ efileStatus: 'ready' });
  }

  /**
   * Get failed submissions (rejected)
   */
  async getFailedSubmissions(): Promise<FederalTaxReturn[]> {
    return await storage.getFederalTaxReturns({ efileStatus: 'rejected' });
  }

  /**
   * Get recent submissions (any status)
   */
  async getRecentSubmissions(limit: number = 50): Promise<FederalTaxReturn[]> {
    const returns = await db
      .select()
      .from(federalTaxReturns)
      .where(
        or(
          eq(federalTaxReturns.efileStatus, 'ready'),
          eq(federalTaxReturns.efileStatus, 'transmitted'),
          eq(federalTaxReturns.efileStatus, 'accepted'),
          eq(federalTaxReturns.efileStatus, 'rejected')
        )
      )
      .orderBy(desc(federalTaxReturns.updatedAt))
      .limit(limit);
    
    return returns;
  }

  /**
   * Update submission status (for webhook/polling integration)
   * This would be called when receiving acknowledgment from IRS/Maryland
   */
  async updateSubmissionStatus(
    transmissionId: string,
    statusData: StatusUpdateData
  ): Promise<void> {
    // Find the return by transmission ID
    const returns = await db
      .select()
      .from(federalTaxReturns)
      .where(eq(federalTaxReturns.efileTransmissionId, transmissionId));

    if (returns.length === 0) {
      throw new Error(`No tax return found with transmission ID: ${transmissionId}`);
    }

    const federalReturn = returns[0];
    const updates: Partial<FederalTaxReturn> = {
      efileStatus: statusData.status,
      updatedAt: new Date()
    };

    // Update based on status
    switch (statusData.status) {
      case 'transmitted':
        updates.efileSubmittedAt = new Date();
        break;
      
      case 'accepted':
        updates.efileAcceptedAt = new Date();
        updates.efileRejectionReason = null;
        break;
      
      case 'rejected':
        updates.efileRejectionReason = statusData.rejectionReason || 'Rejected by IRS';
        // Merge quality review data (preserve existing audit fields)
        const existingReview = (federalReturn.qualityReview as Record<string, any>) || {};
        updates.qualityReview = {
          ...existingReview,
          rejectionDetails: statusData.rejectionDetails,
          rejectedAt: new Date().toISOString()
        };
        break;
    }

    await storage.updateFederalTaxReturn(federalReturn.id, updates);

    // Update Maryland return if exists
    const marylandReturn = await storage.getMarylandTaxReturnByFederalId(federalReturn.id);
    if (marylandReturn) {
      await storage.updateMarylandTaxReturn(marylandReturn.id, {
        efileStatus: statusData.status,
        ...(statusData.status === 'transmitted' && { efileSubmittedAt: new Date() }),
        ...(statusData.status === 'accepted' && { efileAcceptedAt: new Date() })
      });
    }
  }

  /**
   * Validate tax return data before e-filing
   */
  private async validateTaxReturn(federalReturn: FederalTaxReturn): Promise<ValidationResult> {
    const errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }> = [];
    const form1040Data = federalReturn.form1040Data as any;

    // 1. Required personal information
    if (!form1040Data?.taxpayerInfo?.firstName) {
      errors.push({ field: 'taxpayerInfo.firstName', message: 'Taxpayer first name is required', severity: 'error' });
    }
    if (!form1040Data?.taxpayerInfo?.lastName) {
      errors.push({ field: 'taxpayerInfo.lastName', message: 'Taxpayer last name is required', severity: 'error' });
    }
    if (!form1040Data?.taxpayerInfo?.ssn) {
      errors.push({ field: 'taxpayerInfo.ssn', message: 'Taxpayer SSN is required', severity: 'error' });
    } else if (!this.isValidSSN(form1040Data.taxpayerInfo.ssn)) {
      errors.push({ field: 'taxpayerInfo.ssn', message: 'Invalid SSN format', severity: 'error' });
    }

    // 2. Filing status validation
    if (!federalReturn.filingStatus) {
      errors.push({ field: 'filingStatus', message: 'Filing status is required', severity: 'error' });
    }

    // 3. Spouse information (if married filing jointly)
    if (federalReturn.filingStatus === 'married_joint') {
      if (!form1040Data?.spouseInfo?.firstName) {
        errors.push({ field: 'spouseInfo.firstName', message: 'Spouse first name required for joint filing', severity: 'error' });
      }
      if (!form1040Data?.spouseInfo?.lastName) {
        errors.push({ field: 'spouseInfo.lastName', message: 'Spouse last name required for joint filing', severity: 'error' });
      }
      if (!form1040Data?.spouseInfo?.ssn) {
        errors.push({ field: 'spouseInfo.ssn', message: 'Spouse SSN required for joint filing', severity: 'error' });
      } else if (!this.isValidSSN(form1040Data.spouseInfo.ssn)) {
        errors.push({ field: 'spouseInfo.ssn', message: 'Invalid spouse SSN format', severity: 'error' });
      }
    }

    // 4. Address validation
    if (!form1040Data?.address?.street) {
      errors.push({ field: 'address.street', message: 'Street address is required', severity: 'error' });
    }
    if (!form1040Data?.address?.city) {
      errors.push({ field: 'address.city', message: 'City is required', severity: 'error' });
    }
    if (!form1040Data?.address?.state) {
      errors.push({ field: 'address.state', message: 'State is required', severity: 'error' });
    }
    if (!form1040Data?.address?.zipCode) {
      errors.push({ field: 'address.zipCode', message: 'ZIP code is required', severity: 'error' });
    } else if (!this.isValidZipCode(form1040Data.address.zipCode)) {
      errors.push({ field: 'address.zipCode', message: 'Invalid ZIP code format (must be XXXXX or XXXXX-XXXX)', severity: 'error' });
    }

    // 5. Income validation (at least some income should be reported)
    const agi = federalReturn.adjustedGrossIncome ?? 0;
    const hasIncome = 
      agi > 0 || 
      (form1040Data?.income?.wages && form1040Data.income.wages > 0) ||
      (form1040Data?.income?.interest && form1040Data.income.interest > 0) ||
      (form1040Data?.income?.dividends && form1040Data.income.dividends > 0);
    
    if (!hasIncome) {
      errors.push({ 
        field: 'income', 
        message: 'No income reported - verify this is correct', 
        severity: 'warning' 
      });
    }

    // 6. Business rule: AGI consistency check
    if (agi < 0 && !form1040Data?.hasBusinessLoss) {
      errors.push({ 
        field: 'adjustedGrossIncome', 
        message: 'Negative AGI without business loss indication', 
        severity: 'warning' 
      });
    }

    // 7. Dependent validation
    if (form1040Data?.dependents && Array.isArray(form1040Data.dependents)) {
      form1040Data.dependents.forEach((dep: any, index: number) => {
        if (!dep.firstName) {
          errors.push({ 
            field: `dependents[${index}].firstName`, 
            message: 'Dependent first name is required', 
            severity: 'error' 
          });
        }
        if (!dep.ssn) {
          errors.push({ 
            field: `dependents[${index}].ssn`, 
            message: 'Dependent SSN is required', 
            severity: 'error' 
          });
        } else if (!this.isValidSSN(dep.ssn)) {
          errors.push({ 
            field: `dependents[${index}].ssn`, 
            message: 'Invalid dependent SSN format', 
            severity: 'error' 
          });
        }
      });
    }

    // 8. Check if return was already transmitted
    if (federalReturn.efileStatus === 'transmitted' || federalReturn.efileStatus === 'accepted') {
      errors.push({ 
        field: 'efileStatus', 
        message: `Return already ${federalReturn.efileStatus} - cannot resubmit`, 
        severity: 'error' 
      });
    }

    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors
    };
  }

  /**
   * Generate Form 1040 XML for IRS e-filing using Form1040XmlGenerator
   * 
   * Extracts data from FederalTaxReturn and generates IRS MeF-compliant XML
   */
  private async generateForm1040XML(federalReturn: FederalTaxReturn): Promise<string> {
    const form1040Data = federalReturn.form1040Data as any;
    
    if (!form1040Data) {
      throw new Error('Form 1040 data is missing from federal tax return');
    }
    
    // Extract personal info for XML generator
    const personalInfo = {
      taxpayerFirstName: form1040Data?.taxpayerInfo?.firstName || '',
      taxpayerLastName: form1040Data?.taxpayerInfo?.lastName || '',
      taxpayerSSN: form1040Data?.taxpayerInfo?.ssn || '',
      spouseFirstName: form1040Data?.spouseInfo?.firstName,
      spouseLastName: form1040Data?.spouseInfo?.lastName,
      spouseSSN: form1040Data?.spouseInfo?.ssn,
      streetAddress: form1040Data?.address?.street || '',
      aptNumber: form1040Data?.address?.apt,
      city: form1040Data?.address?.city || '',
      state: form1040Data?.address?.state || '',
      zipCode: form1040Data?.address?.zipCode || '',
      dependents: form1040Data?.dependents || [],
      virtualCurrency: form1040Data?.virtualCurrency || false,
      taxpayerPresidentialFund: form1040Data?.taxpayerPresidentialFund,
      spousePresidentialFund: form1040Data?.spousePresidentialFund
    };

    // Extract tax input
    const taxInput = {
      taxYear: federalReturn.taxYear,
      filingStatus: (federalReturn.filingStatus || 'single') as 'single' | 'married_joint' | 'married_separate' | 'head_of_household' | 'qualifying_widow',
      stateCode: 'MD',
      taxpayer: {
        age: form1040Data?.taxpayerInfo?.age || 40,
        isBlind: form1040Data?.taxpayerInfo?.isBlind,
        isDisabled: form1040Data?.taxpayerInfo?.isDisabled
      },
      spouse: form1040Data?.spouseInfo ? {
        age: form1040Data.spouseInfo.age || 40,
        isBlind: form1040Data.spouseInfo.isBlind,
        isDisabled: form1040Data.spouseInfo.isDisabled
      } : undefined,
      w2Income: form1040Data?.income?.w2Income,
      interestIncome: form1040Data?.income?.interest,
      dividendIncome: form1040Data?.income?.dividends,
      iraDistributions: form1040Data?.income?.iraDistributions,
      pensionDistributions: form1040Data?.income?.pensionDistributions,
      socialSecurityBenefits: form1040Data?.income?.socialSecurityBenefits,
      capitalGains: form1040Data?.income?.capitalGains,
      unemploymentCompensation: form1040Data?.income?.unemploymentCompensation,
      selfEmploymentIncome: form1040Data?.income?.selfEmploymentIncome,
      standardDeduction: form1040Data?.deductions?.standardDeduction,
      itemizedDeductions: form1040Data?.deductions?.itemizedDeductions
    };

    // Extract tax result with proper amount owed calculation
    const totalIncome = form1040Data?.calculations?.totalIncome || federalReturn.adjustedGrossIncome || 0;
    const refundAmount = federalReturn.refundAmount || 0;
    
    // Fix amount owed calculation
    const amountOwed = refundAmount < 0 ? Math.abs(refundAmount) : 0;
    const refund = refundAmount > 0 ? refundAmount : 0;
    
    const taxResult = {
      totalIncome,
      adjustedGrossIncome: federalReturn.adjustedGrossIncome || 0,
      taxableIncome: federalReturn.taxableIncome || 0,
      totalTax: federalReturn.totalTax || 0,
      taxableSocialSecurity: form1040Data?.calculations?.taxableSocialSecurity || 0,
      deductionBreakdown: {
        usedStandardDeduction: form1040Data?.deductions?.usedStandardDeduction || true,
        standardDeductionAmount: form1040Data?.deductions?.standardDeductionAmount || 0,
        itemizedDeductions: form1040Data?.deductions?.itemizedDeductions || {}
      },
      credits: form1040Data?.credits || {},
      refundAmount: refund,
      amountOwed: amountOwed,
      effectiveTaxRate: form1040Data?.calculations?.effectiveTaxRate || 0,
      // Add payment details
      federalWithholding: form1040Data?.payments?.federalWithholding || federalReturn.wageWithholding || 0,
      estimatedTaxPayments: form1040Data?.payments?.estimatedTaxPayments || federalReturn.estimatedTaxPayments || 0
    };

    // Generate XML using Form1040XmlGenerator with preparer info
    const preparerInfo = form1040Data?.preparerInfo || {};
    const options: Form1040XmlOptions = {
      taxYear: federalReturn.taxYear,
      preparerName: preparerInfo.name,
      preparerPTIN: preparerInfo.ptin,
      preparerEIN: preparerInfo.ein,
      softwareId: 'MD-BENEFITS-PLATFORM',
      softwareVersion: '1.0'
    };

    return await this.form1040Generator.generateForm1040XML(
      personalInfo,
      taxInput,
      taxResult,
      options
    );
  }

  /**
   * Generate Maryland Form 502 XML for state e-filing using Form502XmlGenerator
   * 
   * Extracts data from FederalTaxReturn and MarylandTaxReturn and generates Maryland iFile-compliant XML
   */
  private async generateForm502XML(
    federalReturn: FederalTaxReturn,
    marylandReturn: MarylandTaxReturn
  ): Promise<string> {
    const form1040Data = federalReturn.form1040Data as any;
    const form502Data = marylandReturn.form502Data as any;

    if (!form1040Data) {
      throw new Error('Form 1040 data is missing from federal tax return');
    }
    if (!form502Data) {
      throw new Error('Form 502 data is missing from Maryland tax return');
    }

    // Extract personal info for Maryland with complete residency info
    const personalInfo = {
      taxpayerFirstName: form1040Data?.taxpayerInfo?.firstName || '',
      taxpayerLastName: form1040Data?.taxpayerInfo?.lastName || '',
      taxpayerSSN: form1040Data?.taxpayerInfo?.ssn || '',
      spouseFirstName: form1040Data?.spouseInfo?.firstName,
      spouseLastName: form1040Data?.spouseInfo?.lastName,
      spouseSSN: form1040Data?.spouseInfo?.ssn,
      streetAddress: form1040Data?.address?.street || '',
      aptNumber: form1040Data?.address?.apt,
      city: form1040Data?.address?.city || '',
      state: form1040Data?.address?.state || '',
      zipCode: form1040Data?.address?.zipCode || '',
      county: form502Data?.countyName || marylandReturn.countyCode || '',
      countyCode: marylandReturn.countyCode || '',
      cityCode: form502Data?.cityCode || '',
      marylandResident: form502Data?.marylandResident ?? true,
      fullYearResident: form502Data?.fullYearResident ?? true,
      partYearResident: form502Data?.partYearResident ?? false,
      dependents: form1040Data?.dependents || []
    };

    // Extract tax input
    const taxInput = {
      taxYear: federalReturn.taxYear,
      filingStatus: (federalReturn.filingStatus || 'single') as 'single' | 'married_joint' | 'married_separate' | 'head_of_household' | 'qualifying_widow',
      stateCode: 'MD',
      taxpayer: {
        age: form1040Data?.taxpayerInfo?.age || 40,
        isBlind: form1040Data?.taxpayerInfo?.isBlind,
        isDisabled: form1040Data?.taxpayerInfo?.isDisabled
      },
      spouse: form1040Data?.spouseInfo ? {
        age: form1040Data.spouseInfo.age || 40,
        isBlind: form1040Data.spouseInfo.isBlind,
        isDisabled: form1040Data.spouseInfo.isDisabled
      } : undefined,
      w2Income: form1040Data?.income?.w2Income,
      interestIncome: form1040Data?.income?.interest,
      dividendIncome: form1040Data?.income?.dividends
    };

    // Extract federal tax result with proper amount owed calculation
    const totalIncome = form1040Data?.calculations?.totalIncome || federalReturn.adjustedGrossIncome || 0;
    const federalRefundAmount = federalReturn.refundAmount || 0;
    
    // Fix amount owed calculation for federal
    const federalAmountOwed = federalRefundAmount < 0 ? Math.abs(federalRefundAmount) : 0;
    const federalRefund = federalRefundAmount > 0 ? federalRefundAmount : 0;
    
    const federalTaxResult = {
      totalIncome,
      adjustedGrossIncome: federalReturn.adjustedGrossIncome || 0,
      taxableIncome: federalReturn.taxableIncome || 0,
      totalTax: federalReturn.totalTax || 0,
      taxableSocialSecurity: form1040Data?.calculations?.taxableSocialSecurity || 0,
      deductionBreakdown: {
        usedStandardDeduction: form1040Data?.deductions?.usedStandardDeduction || true,
        standardDeductionAmount: form1040Data?.deductions?.standardDeductionAmount || 0,
        itemizedDeductions: form1040Data?.deductions?.itemizedDeductions || {}
      },
      credits: form1040Data?.credits || {},
      refundAmount: federalRefund,
      amountOwed: federalAmountOwed,
      effectiveTaxRate: form1040Data?.calculations?.effectiveTaxRate || 0,
      // Add payment details
      federalWithholding: form1040Data?.payments?.federalWithholding || federalReturn.wageWithholding || 0,
      estimatedTaxPayments: form1040Data?.payments?.estimatedTaxPayments || federalReturn.estimatedTaxPayments || 0
    };

    // Extract Maryland tax result with all credits and proper amount owed calculation
    const stateRefundAmount = marylandReturn.stateRefund || 0;
    const stateAmountOwed = stateRefundAmount < 0 ? Math.abs(stateRefundAmount) : 0;
    const stateRefund = stateRefundAmount > 0 ? stateRefundAmount : 0;
    
    const marylandTaxResult = {
      marylandAGI: marylandReturn.marylandAGI || 0,
      marylandTaxableIncome: marylandReturn.marylandTaxableIncome || form502Data?.taxableIncome || 0,
      stateTax: marylandReturn.marylandTax || 0,
      countyTax: marylandReturn.countyTax || 0,
      totalMarylandTax: (marylandReturn.marylandTax || 0) + (marylandReturn.countyTax || 0),
      // Add Maryland-specific credit schedules
      marylandEITC: form502Data?.credits?.eitc || marylandReturn.marylandEITC || 0,
      povertyLevelCredit: form502Data?.credits?.povertyLevel || marylandReturn.povertyLevelCredit || 0,
      propertyTaxCredit: form502Data?.credits?.propertyTax || 0,
      rentersCredit: form502Data?.credits?.renters || 0,
      stateRefund: stateRefund,
      stateAmountOwed: stateAmountOwed,
      effectiveStateRate: form502Data?.effectiveStateRate || 0,
      effectiveCountyRate: form502Data?.effectiveCountyRate || 0
    };

    // Extract Maryland-specific input with actual values
    const marylandInput = {
      countyCode: marylandReturn.countyCode || '',
      cityCode: form502Data?.cityCode || '',
      localTaxRate: form502Data?.localTaxRate || 0,
      childcareExpenses: form502Data?.childcareExpenses || 0,
      studentLoanInterest: form502Data?.studentLoanInterest || 0,
      // Add withholding lines
      marylandWithholding: form502Data?.marylandWithholding || marylandReturn.marylandWithholding || 0,
      // Maryland additions/subtractions
      stateTaxRefund: form502Data?.stateTaxRefund || 0,
      socialSecurityBenefits: form1040Data?.income?.socialSecurityBenefits || 0,
      railroadRetirement: form502Data?.railroadRetirement || 0,
      pensionIncome: form502Data?.pensionIncome || 0,
      // Credits
      propertyTaxPaid: form502Data?.propertyTaxPaid || 0,
      rentPaid: form502Data?.rentPaid || 0
    };

    // Generate XML using Form502XmlGenerator with preparer info
    const preparerInfo = form1040Data?.preparerInfo || {};
    const options: Form502XmlOptions = {
      taxYear: federalReturn.taxYear,
      preparerName: preparerInfo.name,
      preparerPTIN: preparerInfo.ptin,
      preparerEIN: preparerInfo.ein,
      softwareId: 'MD-BENEFITS-PLATFORM',
      softwareVersion: '1.0'
    };

    return await this.form502Generator.generateForm502XML(
      personalInfo,
      taxInput,
      federalTaxResult,
      marylandTaxResult,
      marylandInput,
      options
    );
  }

  /**
   * TODO: Transmit to IRS MeF API
   * This is a placeholder for actual IRS MeF transmission
   * 
   * Requirements:
   * - EFIN (Electronic Filing Identification Number)
   * - IRS MeF production credentials
   * - Digital signature/authentication
   * - IRS-approved transmission software
   */
  private async transmitToIRS(
    xmlData: string,
    federalReturn: FederalTaxReturn
  ): Promise<{ transmissionId: string; status: string }> {
    // Placeholder implementation
    // In production, this would:
    // 1. Authenticate with IRS MeF API
    // 2. Submit XML data
    // 3. Receive acknowledgment
    // 4. Return transmission ID and status
    
    console.log('[PLACEHOLDER] Would transmit to IRS MeF:', {
      returnId: federalReturn.id,
      xmlLength: xmlData.length,
      taxYear: federalReturn.taxYear
    });

    const mockTransmissionId = `IRS-${nanoid(16)}`;
    
    // Update database with transmission ID
    await storage.updateFederalTaxReturn(federalReturn.id, {
      efileTransmissionId: mockTransmissionId,
      efileStatus: 'transmitted',
      efileSubmittedAt: new Date()
    });

    return {
      transmissionId: mockTransmissionId,
      status: 'transmitted'
    };
  }

  /**
   * TODO: Transmit to Maryland iFile API
   * This is a placeholder for actual Maryland iFile transmission
   * 
   * Requirements:
   * - Maryland iFile credentials from MD Comptroller
   * - Official Maryland XML schema (XSD)
   * - Digital signature/authentication
   * - MD-approved transmission software
   */
  private async transmitToMaryland(
    xmlData: string,
    marylandReturn: MarylandTaxReturn
  ): Promise<{ transmissionId: string; status: string }> {
    // Placeholder implementation
    // In production, this would:
    // 1. Authenticate with Maryland iFile API
    // 2. Submit XML data
    // 3. Receive acknowledgment
    // 4. Return transmission ID and status
    
    console.log('[PLACEHOLDER] Would transmit to Maryland iFile:', {
      returnId: marylandReturn.id,
      xmlLength: xmlData.length,
      countyCode: marylandReturn.countyCode
    });

    const mockTransmissionId = `MD-${nanoid(16)}`;
    
    // Update database with transmission ID
    await storage.updateMarylandTaxReturn(marylandReturn.id, {
      efileTransmissionId: mockTransmissionId,
      efileStatus: 'transmitted',
      efileSubmittedAt: new Date()
    });

    return {
      transmissionId: mockTransmissionId,
      status: 'transmitted'
    };
  }

  /**
   * Validate SSN format (XXX-XX-XXXX)
   */
  private isValidSSN(ssn: string): boolean {
    if (!ssn) return false;
    const ssnPattern = /^\d{3}-\d{2}-\d{4}$/;
    return ssnPattern.test(ssn);
  }

  /**
   * Validate and format ZIP code (XXXXX or XXXXX-XXXX)
   */
  private isValidZipCode(zipCode: string): boolean {
    if (!zipCode) return false;
    const zipPattern = /^\d{5}(-\d{4})?$/;
    return zipPattern.test(zipCode);
  }
}

// Export singleton instance
export const eFileQueueService = new EFileQueueService();
