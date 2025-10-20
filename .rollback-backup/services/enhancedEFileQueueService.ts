import { db } from '../db';
import { storage } from '../storage';
import { 
  federalTaxReturns, 
  marylandTaxReturns, 
  efileSubmissionLogs, 
  efileQueueMetadata,
  type FederalTaxReturn, 
  type MarylandTaxReturn 
} from '@shared/schema';
import type { Form1040PersonalInfo } from './form1040Generator';
import type { TaxCalculationResult, TaxHouseholdInput } from './policyEngineTaxCalculation';
import { Form1040XmlGenerator } from './form1040XmlGenerator';
import { Form502XmlGenerator } from './form502XmlGenerator';
import { IrsMefClient } from './irsMefClient';
import { eq, desc, and, or, lte, gte, isNull, gt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { notificationService } from './notification.service';

/**
 * Enhanced E-File Queue Service
 * 
 * Comprehensive queue management for IRS e-filing with:
 * - Priority queuing for amended vs original returns
 * - Exponential backoff retry logic
 * - Dead letter queue for failed submissions
 * - Circuit breaker pattern integration
 * - Batch submission handling
 * - Real-time acknowledgment processing
 * 
 * Queue Priority Levels:
 * 5 - Urgent/Manual retry
 * 4 - Amended returns
 * 3 - Standard returns (near deadline)
 * 2 - Standard returns (normal)
 * 1 - Low priority/Test submissions
 */

interface QueueOptions {
  priority?: number;
  isAmended?: boolean;
  maxRetries?: number;
  notifyOnStatusChange?: boolean;
  batchId?: string;
}

interface ProcessResult {
  processedCount: number;
  successCount: number;
  failureCount: number;
  deadLetteredCount: number;
  errors: Array<{ returnId: string; error: string }>;
}

interface RetrySchedule {
  attempt: number;
  delayMinutes: number;
  nextRetryTime: Date;
}

interface QueueMetrics {
  queueName: string;
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  deadLetteredCount: number;
  averageWaitTime: number;
  successRate: number;
}

export class EnhancedEFileQueueService {
  private form1040Generator: Form1040XmlGenerator;
  private form502Generator: Form502XmlGenerator;
  private mefClient: IrsMefClient;
  
  // Retry delays in minutes: 1min, 5min, 15min, 1hr, 6hr
  private readonly RETRY_DELAYS = [1, 5, 15, 60, 360];
  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly BATCH_SIZE = 10;
  private readonly DEAD_LETTER_THRESHOLD = 10; // Max attempts before dead lettering
  
  // Processing state
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;
  
  constructor() {
    this.form1040Generator = new Form1040XmlGenerator();
    this.form502Generator = new Form502XmlGenerator();
    this.mefClient = new IrsMefClient();
  }
  
  // ============================================================================
  // QUEUE SUBMISSION
  // ============================================================================
  
  /**
   * Submit a federal tax return to the e-file queue
   */
  async submitToQueue(
    federalReturnId: string,
    options: QueueOptions = {}
  ): Promise<{ success: boolean; queuePosition?: number; message: string }> {
    try {
      // Fetch the return
      const federalReturn = await storage.getFederalTaxReturn(federalReturnId);
      if (!federalReturn) {
        return { success: false, message: 'Federal tax return not found' };
      }
      
      // Validate the return
      const validationResult = await this.validateReturn(federalReturn);
      if (!validationResult.isValid) {
        await storage.updateFederalTaxReturn(federalReturnId, {
          validationErrors: validationResult.errors,
          validationStatus: 'invalid',
          validatedAt: new Date()
        });
        
        return {
          success: false,
          message: `Validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`
        };
      }
      
      // Generate XML if not already generated
      if (!federalReturn.xmlGenerated) {
        const xmlResult = await this.generateAndStoreXml(federalReturn);
        if (!xmlResult.success) {
          return { success: false, message: xmlResult.error || 'XML generation failed' };
        }
      }
      
      // Calculate priority
      const priority = this.calculatePriority(federalReturn, options);
      
      // Add to queue
      const queuedReturn = await storage.updateFederalTaxReturn(federalReturnId, {
        efileStatus: 'ready',
        queueStatus: 'queued',
        queuedAt: new Date(),
        submissionPriority: priority,
        isAmendedReturn: options.isAmended || false,
        validationStatus: 'valid',
        validatedAt: new Date()
      });
      
      // Get queue position
      const position = await this.getQueuePosition(federalReturnId);
      
      // Update queue metadata
      await this.updateQueueMetrics('federal_primary');
      
      // Start processing if not already running
      this.startProcessing();
      
      // Log submission
      await this.logAction(federalReturnId, 'submitted', {
        priority,
        queuePosition: position,
        batchId: options.batchId
      });
      
      return {
        success: true,
        queuePosition: position,
        message: `Return queued successfully at position ${position}`
      };
      
    } catch (error) {
      console.error('Failed to submit to queue:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to submit to queue'
      };
    }
  }
  
  /**
   * Submit a batch of returns
   */
  async submitBatch(
    returnIds: string[],
    options: QueueOptions = {}
  ): Promise<{ 
    success: boolean; 
    submitted: string[]; 
    failed: Array<{ returnId: string; error: string }> 
  }> {
    const batchId = nanoid();
    const submitted: string[] = [];
    const failed: Array<{ returnId: string; error: string }> = [];
    
    // Process returns in parallel with concurrency limit
    const concurrencyLimit = 5;
    for (let i = 0; i < returnIds.length; i += concurrencyLimit) {
      const batch = returnIds.slice(i, i + concurrencyLimit);
      const results = await Promise.all(
        batch.map(async (returnId) => {
          const result = await this.submitToQueue(returnId, { ...options, batchId });
          if (result.success) {
            submitted.push(returnId);
          } else {
            failed.push({ returnId, error: result.message });
          }
          return result;
        })
      );
    }
    
    return {
      success: failed.length === 0,
      submitted,
      failed
    };
  }
  
  // ============================================================================
  // QUEUE PROCESSING
  // ============================================================================
  
  /**
   * Start queue processing
   */
  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    // Process queue every 30 seconds
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 30000);
    
    // Process immediately
    this.processQueue();
  }
  
  /**
   * Stop queue processing
   */
  stopProcessing(): void {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }
  
  /**
   * Process the queue
   */
  private async processQueue(): Promise<ProcessResult> {
    const result: ProcessResult = {
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      deadLetteredCount: 0,
      errors: []
    };
    
    try {
      // Check circuit breaker
      const circuitStatus = this.mefClient.getCircuitBreakerStatus();
      if (circuitStatus.isOpen) {
        console.log('Circuit breaker is open, skipping queue processing');
        return result;
      }
      
      // Get returns ready for processing (ordered by priority and queue time)
      const readyReturns = await db
        .select()
        .from(federalTaxReturns)
        .where(
          and(
            eq(federalTaxReturns.queueStatus, 'queued'),
            or(
              isNull(federalTaxReturns.nextRetryAt),
              lte(federalTaxReturns.nextRetryAt, new Date())
            ),
            eq(federalTaxReturns.deadLettered, false)
          )
        )
        .orderBy(
          desc(federalTaxReturns.submissionPriority),
          federalTaxReturns.queuedAt
        )
        .limit(this.BATCH_SIZE);
      
      // Process each return
      for (const federalReturn of readyReturns) {
        try {
          // Update status to processing
          await storage.updateFederalTaxReturn(federalReturn.id, {
            queueStatus: 'processing'
          });
          
          // Process the submission
          const submitResult = await this.processSubmission(federalReturn);
          
          if (submitResult.success) {
            result.successCount++;
            
            // Update status
            await storage.updateFederalTaxReturn(federalReturn.id, {
              queueStatus: 'completed',
              efileStatus: 'transmitted',
              transmittedAt: new Date(),
              mefTransmissionId: submitResult.transmissionId,
              mefSubmissionId: submitResult.submissionId,
              lastSubmissionAt: new Date(),
              submissionAttempts: (federalReturn.submissionAttempts || 0) + 1
            });
            
            // Send notification
            if (federalReturn.userId) {
              await notificationService.sendNotification(federalReturn.userId, {
                title: 'Tax Return Transmitted',
                message: 'Your federal tax return has been successfully transmitted to the IRS.',
                type: 'success',
                metadata: { returnId: federalReturn.id }
              });
            }
          } else {
            result.failureCount++;
            result.errors.push({
              returnId: federalReturn.id,
              error: submitResult.error || 'Unknown error'
            });
            
            // Handle failure with retry logic
            await this.handleSubmissionFailure(federalReturn, submitResult);
          }
          
          result.processedCount++;
          
        } catch (error) {
          console.error(`Failed to process return ${federalReturn.id}:`, error);
          result.failureCount++;
          result.errors.push({
            returnId: federalReturn.id,
            error: error instanceof Error ? error.message : 'Processing error'
          });
          
          // Requeue for retry
          await storage.updateFederalTaxReturn(federalReturn.id, {
            queueStatus: 'queued'
          });
        }
      }
      
      // Update queue metrics
      await this.updateQueueMetrics('federal_primary');
      
    } catch (error) {
      console.error('Queue processing error:', error);
    }
    
    return result;
  }
  
  /**
   * Process a single submission
   */
  private async processSubmission(federalReturn: FederalTaxReturn): Promise<{
    success: boolean;
    transmissionId?: string;
    submissionId?: string;
    error?: string;
    errorType?: string;
  }> {
    try {
      // Get XML content
      const xmlContent = await this.getXmlContent(federalReturn);
      if (!xmlContent) {
        return { success: false, error: 'XML content not found' };
      }
      
      // Submit to IRS
      const transmissionResult = await this.mefClient.transmitReturn(
        federalReturn.id,
        xmlContent
      );
      
      if (transmissionResult.success) {
        return {
          success: true,
          transmissionId: transmissionResult.transmissionId,
          submissionId: transmissionResult.submissionId
        };
      } else {
        return {
          success: false,
          error: transmissionResult.statusMessage,
          errorType: transmissionResult.statusCode
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Submission failed',
        errorType: 'network'
      };
    }
  }
  
  // ============================================================================
  // RETRY LOGIC & ERROR HANDLING
  // ============================================================================
  
  /**
   * Handle submission failure with retry logic
   */
  private async handleSubmissionFailure(
    federalReturn: FederalTaxReturn,
    result: any
  ): Promise<void> {
    const attempts = (federalReturn.submissionAttempts || 0) + 1;
    
    // Check if should be dead lettered
    if (attempts >= this.DEAD_LETTER_THRESHOLD) {
      await this.moveToDeadLetterQueue(federalReturn, result.error);
      return;
    }
    
    // Calculate next retry time
    const retrySchedule = this.calculateRetrySchedule(attempts);
    
    // Update return with retry information
    await storage.updateFederalTaxReturn(federalReturn.id, {
      queueStatus: 'queued',
      efileStatus: 'ready',
      submissionAttempts: attempts,
      lastSubmissionAt: new Date(),
      nextRetryAt: retrySchedule.nextRetryTime,
      lastErrorType: result.errorType,
      lastErrorMessage: result.error,
      lastErrorAt: new Date()
    });
    
    // Log retry
    await this.logAction(federalReturn.id, 'retried', {
      attempt: attempts,
      nextRetryAt: retrySchedule.nextRetryTime,
      error: result.error
    });
  }
  
  /**
   * Calculate retry schedule with exponential backoff
   */
  private calculateRetrySchedule(attemptNumber: number): RetrySchedule {
    const delayIndex = Math.min(attemptNumber - 1, this.RETRY_DELAYS.length - 1);
    const delayMinutes = this.RETRY_DELAYS[delayIndex];
    const nextRetryTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    return {
      attempt: attemptNumber,
      delayMinutes,
      nextRetryTime
    };
  }
  
  /**
   * Move return to dead letter queue
   */
  private async moveToDeadLetterQueue(
    federalReturn: FederalTaxReturn,
    reason: string
  ): Promise<void> {
    await storage.updateFederalTaxReturn(federalReturn.id, {
      queueStatus: 'failed',
      deadLettered: true,
      deadLetterReason: reason,
      efileStatus: 'rejected'
    });
    
    // Log dead letter
    await this.logAction(federalReturn.id, 'dead_lettered', {
      reason,
      attempts: federalReturn.submissionAttempts
    });
    
    // Send notification
    if (federalReturn.userId) {
      await notificationService.sendNotification(federalReturn.userId, {
        title: 'Tax Return Submission Failed',
        message: 'Your tax return could not be submitted after multiple attempts. Please contact support.',
        type: 'error',
        metadata: { returnId: federalReturn.id }
      });
    }
  }
  
  /**
   * Manual retry for a specific return
   */
  async retrySubmission(
    federalReturnId: string,
    options: { priority?: number } = {}
  ): Promise<{ success: boolean; message: string }> {
    try {
      const federalReturn = await storage.getFederalTaxReturn(federalReturnId);
      if (!federalReturn) {
        return { success: false, message: 'Return not found' };
      }
      
      // Reset error state and requeue with high priority
      await storage.updateFederalTaxReturn(federalReturnId, {
        queueStatus: 'queued',
        efileStatus: 'ready',
        nextRetryAt: null,
        submissionPriority: options.priority || 5, // High priority for manual retry
        deadLettered: false,
        deadLetterReason: null
      });
      
      // Log manual retry
      await this.logAction(federalReturnId, 'manual_retry', {
        previousStatus: federalReturn.queueStatus,
        previousAttempts: federalReturn.submissionAttempts
      });
      
      // Start processing
      this.startProcessing();
      
      return { success: true, message: 'Return requeued for submission' };
      
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retry submission'
      };
    }
  }
  
  // ============================================================================
  // ACKNOWLEDGMENT PROCESSING
  // ============================================================================
  
  /**
   * Process acknowledgments for transmitted returns
   */
  async processAcknowledgments(): Promise<void> {
    try {
      // Get returns awaiting acknowledgment
      const transmittedReturns = await db
        .select()
        .from(federalTaxReturns)
        .where(
          and(
            eq(federalTaxReturns.efileStatus, 'transmitted'),
            isNull(federalTaxReturns.acknowledgmentReceivedAt)
          )
        )
        .limit(20);
      
      for (const federalReturn of transmittedReturns) {
        if (!federalReturn.mefTransmissionId) continue;
        
        try {
          // Get acknowledgment from IRS
          const acknowledgment = await this.mefClient.getAcknowledgment(
            federalReturn.mefTransmissionId,
            federalReturn.mefSubmissionId || undefined
          );
          
          // Process based on status
          await this.processAcknowledgmentStatus(federalReturn, acknowledgment);
          
        } catch (error) {
          console.error(`Failed to get acknowledgment for ${federalReturn.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to process acknowledgments:', error);
    }
  }
  
  /**
   * Process acknowledgment status
   */
  private async processAcknowledgmentStatus(
    federalReturn: FederalTaxReturn,
    acknowledgment: any
  ): Promise<void> {
    const updateData: any = {
      acknowledgmentData: acknowledgment,
      acknowledgmentReceivedAt: new Date()
    };
    
    switch (acknowledgment.status) {
      case 'accepted':
        updateData.efileStatus = 'accepted';
        updateData.acceptedAt = acknowledgment.acceptedTimestamp;
        updateData.dcnNumber = acknowledgment.dcnNumber;
        
        // Send success notification
        if (federalReturn.userId) {
          await notificationService.sendNotification(federalReturn.userId, {
            title: 'Tax Return Accepted',
            message: `Your federal tax return has been accepted by the IRS. DCN: ${acknowledgment.dcnNumber}`,
            type: 'success',
            metadata: { 
              returnId: federalReturn.id,
              dcnNumber: acknowledgment.dcnNumber
            }
          });
        }
        break;
        
      case 'rejected':
        updateData.efileStatus = 'rejected';
        updateData.rejectedAt = new Date();
        updateData.rejectionCode = acknowledgment.rejectionCode;
        updateData.rejectionReason = acknowledgment.rejectionReason;
        updateData.rejectionDetails = acknowledgment.businessRuleErrors;
        
        // Send rejection notification
        if (federalReturn.userId) {
          await notificationService.sendNotification(federalReturn.userId, {
            title: 'Tax Return Rejected',
            message: `Your tax return was rejected: ${acknowledgment.rejectionReason}`,
            type: 'error',
            metadata: { 
              returnId: federalReturn.id,
              rejectionCode: acknowledgment.rejectionCode
            }
          });
        }
        break;
        
      case 'pending':
        // No update needed, will check again later
        return;
        
      default:
        console.error('Unknown acknowledgment status:', acknowledgment.status);
        return;
    }
    
    // Update the return
    await storage.updateFederalTaxReturn(federalReturn.id, updateData);
    
    // Log acknowledgment
    await this.logAction(federalReturn.id, acknowledgment.status, acknowledgment);
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  /**
   * Validate a tax return
   */
  private async validateReturn(federalReturn: FederalTaxReturn): Promise<{
    isValid: boolean;
    errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }>;
  }> {
    const errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }> = [];
    
    // Basic validation
    if (!federalReturn.taxYear || federalReturn.taxYear < 2020) {
      errors.push({ field: 'taxYear', message: 'Invalid tax year', severity: 'error' });
    }
    
    if (!federalReturn.filingStatus) {
      errors.push({ field: 'filingStatus', message: 'Filing status is required', severity: 'error' });
    }
    
    if (!federalReturn.form1040Data) {
      errors.push({ field: 'form1040Data', message: 'Form 1040 data is missing', severity: 'error' });
    }
    
    // Add more validation as needed
    
    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors
    };
  }
  
  /**
   * Generate and store XML for a return
   */
  private async generateAndStoreXml(federalReturn: FederalTaxReturn): Promise<{
    success: boolean;
    xmlPath?: string;
    error?: string;
  }> {
    try {
      const form1040Data = federalReturn.form1040Data as any;
      
      // Extract data for XML generation
      const personalInfo: Form1040PersonalInfo = {
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
        virtualCurrency: form1040Data?.virtualCurrency || false
      };
      
      const taxInput: TaxHouseholdInput = {
        taxYear: federalReturn.taxYear,
        filingStatus: federalReturn.filingStatus as any,
        stateCode: 'MD',
        taxpayer: {
          age: form1040Data?.taxpayerInfo?.age || 40,
          isBlind: form1040Data?.taxpayerInfo?.isBlind,
          isDisabled: form1040Data?.taxpayerInfo?.isDisabled
        }
      };
      
      const taxResult: TaxCalculationResult = {
        totalIncome: form1040Data?.calculations?.totalIncome || federalReturn.adjustedGrossIncome || 0,
        adjustedGrossIncome: federalReturn.adjustedGrossIncome || 0,
        taxableIncome: federalReturn.taxableIncome || 0,
        totalTax: federalReturn.totalTax || 0,
        taxableSocialSecurity: form1040Data?.calculations?.taxableSocialSecurity || 0,
        deductionBreakdown: form1040Data?.deductions || {},
        credits: form1040Data?.credits || {},
        refundAmount: federalReturn.refundAmount || 0,
        amountOwed: federalReturn.amountOwed || 0,
        withholding: federalReturn.federalWithholding || 0,
        calculationDetails: {}
      };
      
      // Generate XML
      const xmlContent = await this.form1040Generator.generateForm1040XML(
        personalInfo,
        taxInput,
        taxResult,
        {
          taxYear: federalReturn.taxYear,
          softwareId: 'MDTAXNAV',
          softwareVersion: '1.0.0'
        }
      );
      
      // Store XML (in production, this would save to secure storage)
      const xmlPath = `efile/${federalReturn.taxYear}/${federalReturn.id}.xml`;
      // await storage.saveXml(xmlPath, xmlContent);
      
      // Update return
      await storage.updateFederalTaxReturn(federalReturn.id, {
        xmlGenerated: true,
        xmlGeneratedAt: new Date(),
        xmlStoragePath: xmlPath,
        xmlHash: this.hashXml(xmlContent)
      });
      
      return { success: true, xmlPath };
      
    } catch (error) {
      console.error('XML generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'XML generation failed'
      };
    }
  }
  
  /**
   * Get XML content for a return
   */
  private async getXmlContent(federalReturn: FederalTaxReturn): Promise<string | null> {
    // In production, this would retrieve from secure storage
    // For now, regenerate if needed
    if (!federalReturn.xmlGenerated) {
      const result = await this.generateAndStoreXml(federalReturn);
      if (!result.success) return null;
    }
    
    // Mock XML content for testing
    return `<?xml version="1.0" encoding="UTF-8"?><Return>...</Return>`;
  }
  
  /**
   * Calculate priority for a return
   */
  private calculatePriority(
    federalReturn: FederalTaxReturn,
    options: QueueOptions
  ): number {
    if (options.priority !== undefined) return options.priority;
    
    let priority = 2; // Default priority
    
    // Amended returns get higher priority
    if (options.isAmended || federalReturn.isAmendedReturn) {
      priority = 4;
    }
    
    // Near deadline (within 7 days of April 15)
    const deadline = new Date(`${federalReturn.taxYear + 1}-04-15`);
    const daysUntilDeadline = Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilDeadline <= 7 && daysUntilDeadline >= 0) {
      priority = Math.max(priority, 3);
    }
    
    return priority;
  }
  
  /**
   * Get queue position for a return
   */
  private async getQueuePosition(federalReturnId: string): Promise<number> {
    const result = await db
      .select()
      .from(federalTaxReturns)
      .where(
        and(
          eq(federalTaxReturns.queueStatus, 'queued'),
          eq(federalTaxReturns.deadLettered, false)
        )
      );
    
    const position = result.findIndex(r => r.id === federalReturnId);
    return position >= 0 ? position + 1 : 0;
  }
  
  /**
   * Update queue metrics
   */
  private async updateQueueMetrics(queueName: string): Promise<void> {
    try {
      const metrics = await this.calculateQueueMetrics(queueName);
      
      const existing = await db
        .select()
        .from(efileQueueMetadata)
        .where(eq(efileQueueMetadata.queueName, queueName))
        .limit(1);
      
      if (existing.length > 0) {
        await db
          .update(efileQueueMetadata)
          .set({
            activeItems: metrics.processingCount,
            pendingItems: metrics.pendingCount,
            failedItems: metrics.failedCount,
            deadLetteredItems: metrics.deadLetteredCount,
            successRate: metrics.successRate,
            averageProcessingTime: Math.round(metrics.averageWaitTime),
            lastHealthCheck: new Date(),
            updatedAt: new Date()
          })
          .where(eq(efileQueueMetadata.id, existing[0].id));
      } else {
        await db.insert(efileQueueMetadata).values({
          queueName,
          activeItems: metrics.processingCount,
          pendingItems: metrics.pendingCount,
          failedItems: metrics.failedCount,
          deadLetteredItems: metrics.deadLetteredCount,
          successRate: metrics.successRate,
          averageProcessingTime: Math.round(metrics.averageWaitTime)
        });
      }
    } catch (error) {
      console.error('Failed to update queue metrics:', error);
    }
  }
  
  /**
   * Calculate queue metrics
   */
  private async calculateQueueMetrics(queueName: string): Promise<QueueMetrics> {
    const [pending, processing, failed, deadLettered, completed] = await Promise.all([
      db.select().from(federalTaxReturns).where(eq(federalTaxReturns.queueStatus, 'queued')),
      db.select().from(federalTaxReturns).where(eq(federalTaxReturns.queueStatus, 'processing')),
      db.select().from(federalTaxReturns).where(eq(federalTaxReturns.queueStatus, 'failed')),
      db.select().from(federalTaxReturns).where(eq(federalTaxReturns.deadLettered, true)),
      db.select().from(federalTaxReturns).where(eq(federalTaxReturns.queueStatus, 'completed'))
    ]);
    
    const total = pending.length + processing.length + failed.length + completed.length;
    const successRate = total > 0 ? completed.length / total : 0;
    
    return {
      queueName,
      pendingCount: pending.length,
      processingCount: processing.length,
      failedCount: failed.length,
      deadLetteredCount: deadLettered.length,
      averageWaitTime: 0, // Would calculate from timestamps
      successRate
    };
  }
  
  /**
   * Log action to submission logs
   */
  private async logAction(
    federalReturnId: string,
    action: string,
    details: any
  ): Promise<void> {
    try {
      await db.insert(efileSubmissionLogs).values({
        federalReturnId,
        returnType: 'federal',
        action,
        actionDetails: details,
        isMockSubmission: true,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }
  
  /**
   * Hash XML content
   */
  private hashXml(xmlContent: string): string {
    // In production, use crypto.createHash('sha256')
    return `hash_${nanoid(10)}`;
  }
  
  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<{
    metrics: QueueMetrics;
    circuitBreakerStatus: any;
    isProcessing: boolean;
  }> {
    const metrics = await this.calculateQueueMetrics('federal_primary');
    const circuitBreakerStatus = this.mefClient.getCircuitBreakerStatus();
    
    return {
      metrics,
      circuitBreakerStatus,
      isProcessing: this.isProcessing
    };
  }
  
  /**
   * Get submission status for a return
   */
  async getSubmissionStatus(federalReturnId: string): Promise<any> {
    const federalReturn = await storage.getFederalTaxReturn(federalReturnId);
    if (!federalReturn) {
      return null;
    }
    
    const logs = await db
      .select()
      .from(efileSubmissionLogs)
      .where(eq(efileSubmissionLogs.federalReturnId, federalReturnId))
      .orderBy(desc(efileSubmissionLogs.createdAt))
      .limit(10);
    
    return {
      returnId: federalReturn.id,
      efileStatus: federalReturn.efileStatus,
      queueStatus: federalReturn.queueStatus,
      submissionAttempts: federalReturn.submissionAttempts,
      lastSubmissionAt: federalReturn.lastSubmissionAt,
      nextRetryAt: federalReturn.nextRetryAt,
      dcnNumber: federalReturn.dcnNumber,
      transmissionId: federalReturn.mefTransmissionId,
      acknowledgmentData: federalReturn.acknowledgmentData,
      rejectionReason: federalReturn.rejectionReason,
      deadLettered: federalReturn.deadLettered,
      history: logs
    };
  }
}

// Export singleton instance
export const enhancedEFileQueueService = new EnhancedEFileQueueService();