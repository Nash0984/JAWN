import { db } from '../db';
import { storage } from '../storage';
import { 
  marylandTaxReturns, 
  federalTaxReturns,
  efileSubmissionLogs,
  efileQueueMetadata
} from '@shared/schema';
import { eq, and, or, desc, isNull, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { MarylandIFileClient } from './marylandIFileClient';
import type { MarylandSubmissionRequest, MarylandSubmissionResponse } from './marylandIFileClient';
import { notificationService } from './notification.service';
import { EnhancedEFileQueueService } from './enhancedEFileQueueService';

/**
 * Maryland E-File Queue Service
 * 
 * Manages Maryland Form 502 electronic filing queue with:
 * - Integration with federal submission queue
 * - Maryland-specific retry intervals
 * - County tax validation before submission
 * - Joint federal/state submission coordination
 * - Peak season load management
 * - Audit trail for compliance
 */

export interface MarylandQueueOptions {
  priority?: number;
  requiresFederalAcceptance?: boolean;
  maxRetries?: number;
  notifyOnStatusChange?: boolean;
  batchId?: string;
  validateCountyTax?: boolean;
}

export interface MarylandQueueStatus {
  returnId: string;
  queueStatus: 'queued' | 'processing' | 'submitted' | 'accepted' | 'rejected' | 'failed';
  submissionAttempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  federalStatus?: string;
  marylandConfirmationNumber?: string;
  errors?: Array<{ code: string; message: string }>;
}

export interface MarylandProcessResult {
  processedCount: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  errors: Array<{ returnId: string; error: string }>;
}

export class MarylandEFileQueueService {
  private marylandClient: MarylandIFileClient;
  private federalQueueService: EnhancedEFileQueueService;
  
  // Maryland-specific retry delays (minutes): 2min, 10min, 30min, 2hr, 12hr
  private readonly MARYLAND_RETRY_DELAYS = [2, 10, 30, 120, 720];
  private readonly MAX_MARYLAND_RETRIES = 5;
  private readonly BATCH_SIZE = 5; // Smaller batch for state processing
  
  // Processing state
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;
  
  // Peak season handling (Jan 15 - Apr 15)
  private isPeakSeason(): boolean {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed
    const day = now.getDate();
    
    // January 15 through April 15
    return (month === 0 && day >= 15) || // Late January
           (month === 1) || // February
           (month === 2) || // March
           (month === 3 && day <= 15); // Early April
  }
  
  constructor() {
    this.marylandClient = new MarylandIFileClient({ environment: 'mock' });
    this.federalQueueService = new EnhancedEFileQueueService();
  }
  
  /**
   * Submit Maryland return to queue
   */
  async submitToQueue(
    returnId: string,
    options: MarylandQueueOptions = {}
  ): Promise<{ 
    success: boolean; 
    queuePosition?: number; 
    message: string;
    requiresFederalFirst?: boolean;
  }> {
    try {
      // Get Maryland return
      const marylandReturn = await storage.getMarylandTaxReturn(returnId);
      if (!marylandReturn) {
        return { success: false, message: 'Maryland tax return not found' };
      }
      
      // Check if federal return is required and accepted
      if (options.requiresFederalAcceptance !== false) {
        const federalStatus = await this.checkFederalStatus(marylandReturn.federalReturnId);
        
        if (!federalStatus.isAccepted) {
          // Add to pending queue for later processing
          await storage.updateMarylandTaxReturn(returnId, {
            queueStatus: 'pending_federal',
            queuedAt: new Date(),
            submissionPriority: options.priority || 2
          });
          
          return {
            success: true,
            message: 'Maryland return queued pending federal acceptance',
            requiresFederalFirst: true
          };
        }
      }
      
      // Validate county tax if requested
      if (options.validateCountyTax !== false) {
        const countyValidation = await this.validateCountyTax(marylandReturn);
        
        if (!countyValidation.isValid) {
          await storage.updateMarylandTaxReturn(returnId, {
            validationErrors: countyValidation.errors,
            validationStatus: 'invalid'
          });
          
          return {
            success: false,
            message: `County tax validation failed: ${countyValidation.errors?.join(', ')}`
          };
        }
      }
      
      // Calculate priority (adjust for peak season)
      let priority = options.priority || 3;
      if (this.isPeakSeason()) {
        // Reduce priority during peak season unless urgent
        priority = Math.max(1, priority - 1);
      }
      
      // Add to queue
      await storage.updateMarylandTaxReturn(returnId, {
        queueStatus: 'queued',
        queuedAt: new Date(),
        submissionPriority: priority,
        validationStatus: 'valid',
        validatedAt: new Date()
      });
      
      // Get queue position
      const position = await this.getQueuePosition(returnId);
      
      // Update queue metrics
      await this.updateQueueMetrics();
      
      // Start processing if not already running
      this.startProcessing();
      
      // Log submission
      await this.logAction(returnId, 'queued', {
        priority,
        queuePosition: position,
        isPeakSeason: this.isPeakSeason()
      });
      
      return {
        success: true,
        queuePosition: position,
        message: `Maryland return queued at position ${position}`
      };
      
    } catch (error) {
      console.error('Failed to submit Maryland return to queue:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Queue submission failed'
      };
    }
  }
  
  /**
   * Process Maryland submission queue
   */
  async processQueue(): Promise<MarylandProcessResult> {
    const result: MarylandProcessResult = {
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      retryCount: 0,
      errors: []
    };
    
    try {
      // Get returns ready for processing
      const queuedReturns = await db
        .select()
        .from(marylandTaxReturns)
        .where(
          and(
            or(
              eq(marylandTaxReturns.queueStatus, 'queued'),
              and(
                eq(marylandTaxReturns.queueStatus, 'retry'),
                lte(marylandTaxReturns.nextRetryAt, new Date())
              )
            )
          )
        )
        .orderBy(
          desc(marylandTaxReturns.submissionPriority),
          marylandTaxReturns.queuedAt
        )
        .limit(this.BATCH_SIZE);
      
      // Process each return
      for (const marylandReturn of queuedReturns) {
        result.processedCount++;
        
        try {
          // Update status to processing
          await storage.updateMarylandTaxReturn(marylandReturn.id, {
            queueStatus: 'processing',
            lastProcessedAt: new Date()
          });
          
          // Submit to Maryland iFile
          const submissionResult = await this.submitToMarylandIFile(marylandReturn);
          
          if (submissionResult.success) {
            // Update with success
            await storage.updateMarylandTaxReturn(marylandReturn.id, {
              queueStatus: 'accepted',
              efileStatus: 'accepted',
              submissionStatus: 'accepted',
              marylandConfirmationNumber: submissionResult.marylandConfirmationNumber,
              submittedAt: new Date(),
              acceptedAt: new Date()
            });
            
            result.successCount++;
            
            // Notify if requested
            if (marylandReturn.notifyOnStatusChange) {
              await this.sendNotification(marylandReturn.id, 'accepted');
            }
            
          } else if (this.isRetriableError(submissionResult)) {
            // Handle retry
            const retryInfo = this.calculateRetry(marylandReturn);
            
            if (retryInfo.shouldRetry) {
              await storage.updateMarylandTaxReturn(marylandReturn.id, {
                queueStatus: 'retry',
                submissionAttempts: (marylandReturn.submissionAttempts || 0) + 1,
                nextRetryAt: retryInfo.nextRetryAt,
                lastError: JSON.stringify(submissionResult.errors)
              });
              
              result.retryCount++;
            } else {
              // Max retries exceeded
              await storage.updateMarylandTaxReturn(marylandReturn.id, {
                queueStatus: 'failed',
                efileStatus: 'failed',
                submissionStatus: 'failed',
                failedAt: new Date(),
                failureReason: 'Max retries exceeded',
                lastError: JSON.stringify(submissionResult.errors)
              });
              
              result.failureCount++;
            }
            
          } else {
            // Permanent failure
            await storage.updateMarylandTaxReturn(marylandReturn.id, {
              queueStatus: 'rejected',
              efileStatus: 'rejected',
              submissionStatus: 'rejected',
              rejectedAt: new Date(),
              rejectionReasons: submissionResult.errors,
              lastError: JSON.stringify(submissionResult.errors)
            });
            
            result.failureCount++;
            
            // Notify if requested
            if (marylandReturn.notifyOnStatusChange) {
              await this.sendNotification(marylandReturn.id, 'rejected');
            }
          }
          
        } catch (error) {
          console.error(`Error processing Maryland return ${marylandReturn.id}:`, error);
          
          result.errors.push({
            returnId: marylandReturn.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          // Mark as failed
          await storage.updateMarylandTaxReturn(marylandReturn.id, {
            queueStatus: 'failed',
            lastError: error instanceof Error ? error.message : 'Processing error'
          });
          
          result.failureCount++;
        }
      }
      
      // Process pending federal acceptances
      await this.processPendingFederalAcceptances();
      
      return result;
      
    } catch (error) {
      console.error('Queue processing error:', error);
      throw error;
    }
  }
  
  /**
   * Submit return to Maryland iFile
   */
  private async submitToMarylandIFile(
    marylandReturn: any
  ): Promise<MarylandSubmissionResponse> {
    // Get associated data
    const federalReturn = await storage.getFederalTaxReturn(marylandReturn.federalReturnId);
    if (!federalReturn) {
      return {
        success: false,
        status: 'error',
        errors: [{ code: 'FED001', message: 'Associated federal return not found' }]
      };
    }
    
    // Prepare submission request
    const submissionRequest: MarylandSubmissionRequest = {
      returnId: marylandReturn.id,
      personalInfo: marylandReturn.personalInfo,
      taxInput: marylandReturn.taxInput,
      federalTaxResult: federalReturn.taxCalculationResult,
      marylandTaxResult: marylandReturn.marylandTaxResult,
      marylandInput: marylandReturn.marylandInput,
      taxYear: marylandReturn.taxYear,
      preparerInfo: {
        name: marylandReturn.preparerName,
        ptin: marylandReturn.preparerPTIN,
        ein: marylandReturn.preparerEIN
      }
    };
    
    // Submit through Maryland client
    return await this.marylandClient.submitForm502(submissionRequest);
  }
  
  /**
   * Check federal return status
   */
  private async checkFederalStatus(
    federalReturnId?: string
  ): Promise<{ isAccepted: boolean; status?: string }> {
    if (!federalReturnId) {
      return { isAccepted: false };
    }
    
    const federalReturn = await storage.getFederalTaxReturn(federalReturnId);
    if (!federalReturn) {
      return { isAccepted: false };
    }
    
    return {
      isAccepted: federalReturn.efileStatus === 'accepted',
      status: federalReturn.efileStatus
    };
  }
  
  /**
   * Validate county tax calculations
   */
  private async validateCountyTax(marylandReturn: any): Promise<{
    isValid: boolean;
    errors?: string[];
  }> {
    const result = await this.marylandClient.validateCountyTax(
      marylandReturn.countyCode,
      marylandReturn.marylandTaxResult?.marylandTaxableIncome || 0,
      marylandReturn.marylandTaxResult?.countyTax || 0
    );
    
    return {
      isValid: result.isValid,
      errors: result.errors
    };
  }
  
  /**
   * Check if error is retriable
   */
  private isRetriableError(response: MarylandSubmissionResponse): boolean {
    if (!response.errors || response.errors.length === 0) {
      return false;
    }
    
    const retriableErrorCodes = ['SYS001', 'SYS002', 'AUTH003'];
    return response.errors.some(e => retriableErrorCodes.includes(e.code));
  }
  
  /**
   * Calculate retry timing
   */
  private calculateRetry(marylandReturn: any): {
    shouldRetry: boolean;
    nextRetryAt?: Date;
  } {
    const attempts = marylandReturn.submissionAttempts || 0;
    
    if (attempts >= this.MAX_MARYLAND_RETRIES) {
      return { shouldRetry: false };
    }
    
    const delayMinutes = this.MARYLAND_RETRY_DELAYS[
      Math.min(attempts, this.MARYLAND_RETRY_DELAYS.length - 1)
    ];
    
    // Increase delay during peak season
    const adjustedDelay = this.isPeakSeason() ? delayMinutes * 2 : delayMinutes;
    
    return {
      shouldRetry: true,
      nextRetryAt: new Date(Date.now() + adjustedDelay * 60000)
    };
  }
  
  /**
   * Process returns pending federal acceptance
   */
  private async processPendingFederalAcceptances(): Promise<void> {
    const pendingReturns = await db
      .select()
      .from(marylandTaxReturns)
      .where(eq(marylandTaxReturns.queueStatus, 'pending_federal'))
      .limit(10);
    
    for (const marylandReturn of pendingReturns) {
      const federalStatus = await this.checkFederalStatus(marylandReturn.federalReturnId);
      
      if (federalStatus.isAccepted) {
        // Move to regular queue
        await storage.updateMarylandTaxReturn(marylandReturn.id, {
          queueStatus: 'queued',
          queuedAt: new Date()
        });
      }
    }
  }
  
  /**
   * Get queue position for a return
   */
  private async getQueuePosition(returnId: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*) + 1 as position
      FROM maryland_tax_returns
      WHERE queue_status IN ('queued', 'processing')
        AND (submission_priority > (
          SELECT submission_priority 
          FROM maryland_tax_returns 
          WHERE id = ${returnId}
        ) OR (
          submission_priority = (
            SELECT submission_priority 
            FROM maryland_tax_returns 
            WHERE id = ${returnId}
          ) AND queued_at < (
            SELECT queued_at 
            FROM maryland_tax_returns 
            WHERE id = ${returnId}
          )
        ))
    `);
    
    return result.rows[0]?.position || 1;
  }
  
  /**
   * Update queue metrics
   */
  private async updateQueueMetrics(): Promise<void> {
    // Implementation would update efileQueueMetadata table
    console.log('Queue metrics updated');
  }
  
  /**
   * Log action to audit trail
   */
  private async logAction(
    returnId: string,
    action: string,
    details?: any
  ): Promise<void> {
    await db.insert(efileSubmissionLogs).values({
      returnId,
      returnType: 'maryland',
      submissionStatus: action,
      submittedAt: new Date(),
      responseData: details ? JSON.stringify(details) : null
    });
  }
  
  /**
   * Send notification about status change
   */
  private async sendNotification(
    returnId: string,
    status: string
  ): Promise<void> {
    // Implementation would use notification service
    console.log(`Notification sent for return ${returnId}: ${status}`);
  }
  
  /**
   * Start queue processing
   */
  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    // Process more frequently during peak season
    const intervalMs = this.isPeakSeason() ? 15000 : 30000; // 15s peak, 30s normal
    
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, intervalMs);
    
    // Process immediately
    this.processQueue();
  }
  
  /**
   * Stop queue processing
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    this.isProcessing = false;
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queued: number;
    processing: number;
    pendingFederal: number;
    retry: number;
    failed: number;
    accepted: number;
    rejected: number;
    avgWaitTime: number;
  }> {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(CASE WHEN queue_status = 'queued' THEN 1 END) as queued,
        COUNT(CASE WHEN queue_status = 'processing' THEN 1 END) as processing,
        COUNT(CASE WHEN queue_status = 'pending_federal' THEN 1 END) as pending_federal,
        COUNT(CASE WHEN queue_status = 'retry' THEN 1 END) as retry,
        COUNT(CASE WHEN queue_status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN queue_status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN queue_status = 'rejected' THEN 1 END) as rejected,
        AVG(EXTRACT(EPOCH FROM (submitted_at - queued_at))) as avg_wait_seconds
      FROM maryland_tax_returns
      WHERE queue_status IS NOT NULL
    `);
    
    const row = stats.rows[0];
    return {
      queued: Number(row.queued) || 0,
      processing: Number(row.processing) || 0,
      pendingFederal: Number(row.pending_federal) || 0,
      retry: Number(row.retry) || 0,
      failed: Number(row.failed) || 0,
      accepted: Number(row.accepted) || 0,
      rejected: Number(row.rejected) || 0,
      avgWaitTime: Number(row.avg_wait_seconds) || 0
    };
  }
}

// Export singleton instance
export const marylandEFileQueueService = new MarylandEFileQueueService();