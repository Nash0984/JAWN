import type { Express, Request, Response } from 'express';
import { enhancedEFileQueueService } from '../services/enhancedEFileQueueService';
import { storage } from '../storage';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireStaff } from '../middleware/auth';
import { z } from 'zod';
import { db } from '../db';
import { efileSubmissionLogs, federalTaxReturns } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * E-File API Routes
 * 
 * Provides endpoints for managing electronic tax return submissions to the IRS.
 * All endpoints require authentication and appropriate permissions.
 * 
 * Features:
 * - Submit returns to e-file queue
 * - Check submission status
 * - Manual retry for failed submissions
 * - Get acknowledgment details
 * - Batch submission support
 * - Queue monitoring
 */

// Validation schemas
const submitToQueueSchema = z.object({
  priority: z.number().min(1).max(5).optional(),
  isAmended: z.boolean().optional(),
  notifyOnStatusChange: z.boolean().optional(),
});

const batchSubmitSchema = z.object({
  returnIds: z.array(z.string()).min(1).max(100),
  priority: z.number().min(1).max(5).optional(),
  isAmended: z.boolean().optional(),
});

const retrySubmissionSchema = z.object({
  priority: z.number().min(1).max(5).optional(),
});

export function registerEFileRoutes(app: Express) {
  
  // ============================================================================
  // SUBMISSION ENDPOINTS
  // ============================================================================
  
  /**
   * POST /api/efile/submit/:returnId
   * Submit a federal tax return to the e-file queue
   */
  app.post('/api/efile/submit/:returnId', 
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { returnId } = req.params;
      const userId = req.user?.id;
      
      // Validate request body
      const validationResult = submitToQueueSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors
        });
      }
      
      // Verify ownership or staff permission
      const federalReturn = await storage.getFederalTaxReturn(returnId);
      if (!federalReturn) {
        return res.status(404).json({
          success: false,
          message: 'Federal tax return not found'
        });
      }
      
      const isOwner = federalReturn.userId === userId;
      const isStaff = req.user?.role && ['caseworker', 'admin', 'super_admin'].includes(req.user.role);
      
      if (!isOwner && !isStaff) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to submit this return'
        });
      }
      
      // Submit to queue
      const result = await enhancedEFileQueueService.submitToQueue(
        returnId,
        validationResult.data
      );
      
      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            returnId,
            queuePosition: result.queuePosition,
            status: 'queued'
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    })
  );
  
  /**
   * POST /api/efile/submit/batch
   * Submit multiple returns to the e-file queue
   */
  app.post('/api/efile/submit/batch',
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      // Validate request body
      const validationResult = batchSubmitSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors
        });
      }
      
      const { returnIds, ...options } = validationResult.data;
      
      // Submit batch
      const result = await enhancedEFileQueueService.submitBatch(returnIds, options);
      
      res.status(200).json({
        success: result.success,
        message: result.success 
          ? `Successfully submitted ${result.submitted.length} returns`
          : `Partially submitted: ${result.submitted.length} success, ${result.failed.length} failed`,
        data: {
          submitted: result.submitted,
          failed: result.failed
        }
      });
    })
  );
  
  // ============================================================================
  // STATUS ENDPOINTS
  // ============================================================================
  
  /**
   * GET /api/efile/status/:returnId
   * Check the e-file submission status for a return
   */
  app.get('/api/efile/status/:returnId',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { returnId } = req.params;
      const userId = req.user?.id;
      
      // Verify ownership or staff permission
      const federalReturn = await storage.getFederalTaxReturn(returnId);
      if (!federalReturn) {
        return res.status(404).json({
          success: false,
          message: 'Federal tax return not found'
        });
      }
      
      const isOwner = federalReturn.userId === userId;
      const isStaff = req.user?.role && ['caseworker', 'admin', 'super_admin'].includes(req.user.role);
      
      if (!isOwner && !isStaff) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this return status'
        });
      }
      
      // Get submission status
      const status = await enhancedEFileQueueService.getSubmissionStatus(returnId);
      
      if (!status) {
        return res.status(404).json({
          success: false,
          message: 'Submission status not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: status
      });
    })
  );
  
  /**
   * GET /api/efile/queue/status
   * Get overall queue status and metrics
   */
  app.get('/api/efile/queue/status',
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const queueStatus = await enhancedEFileQueueService.getQueueStatus();
      
      res.status(200).json({
        success: true,
        data: queueStatus
      });
    })
  );
  
  // ============================================================================
  // RETRY ENDPOINTS
  // ============================================================================
  
  /**
   * POST /api/efile/retry/:returnId
   * Manually retry a failed submission
   */
  app.post('/api/efile/retry/:returnId',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { returnId } = req.params;
      const userId = req.user?.id;
      
      // Validate request body
      const validationResult = retrySubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors
        });
      }
      
      // Verify ownership or staff permission
      const federalReturn = await storage.getFederalTaxReturn(returnId);
      if (!federalReturn) {
        return res.status(404).json({
          success: false,
          message: 'Federal tax return not found'
        });
      }
      
      const isOwner = federalReturn.userId === userId;
      const isStaff = req.user?.role && ['caseworker', 'admin', 'super_admin'].includes(req.user.role);
      
      if (!isOwner && !isStaff) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to retry this submission'
        });
      }
      
      // Check if return is in a retryable state
      if (federalReturn.efileStatus === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Cannot retry an already accepted return'
        });
      }
      
      // Retry submission
      const result = await enhancedEFileQueueService.retrySubmission(
        returnId,
        validationResult.data
      );
      
      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            returnId,
            status: 'requeued'
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    })
  );
  
  // ============================================================================
  // ACKNOWLEDGMENT ENDPOINTS
  // ============================================================================
  
  /**
   * GET /api/efile/acknowledgment/:returnId
   * Get IRS acknowledgment details for a return
   */
  app.get('/api/efile/acknowledgment/:returnId',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { returnId } = req.params;
      const userId = req.user?.id;
      
      // Verify ownership or staff permission
      const federalReturn = await storage.getFederalTaxReturn(returnId);
      if (!federalReturn) {
        return res.status(404).json({
          success: false,
          message: 'Federal tax return not found'
        });
      }
      
      const isOwner = federalReturn.userId === userId;
      const isStaff = req.user?.role && ['caseworker', 'admin', 'super_admin'].includes(req.user.role);
      
      if (!isOwner && !isStaff) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view acknowledgment details'
        });
      }
      
      // Check if acknowledgment exists
      if (!federalReturn.acknowledgmentData) {
        return res.status(404).json({
          success: false,
          message: 'No acknowledgment received yet for this return'
        });
      }
      
      res.status(200).json({
        success: true,
        data: {
          returnId,
          efileStatus: federalReturn.efileStatus,
          dcnNumber: federalReturn.dcnNumber,
          transmissionId: federalReturn.mefTransmissionId,
          acknowledgmentReceivedAt: federalReturn.acknowledgmentReceivedAt,
          acknowledgmentData: federalReturn.acknowledgmentData,
          rejectionCode: federalReturn.rejectionCode,
          rejectionReason: federalReturn.rejectionReason,
          rejectionDetails: federalReturn.rejectionDetails
        }
      });
    })
  );
  
  /**
   * POST /api/efile/process-acknowledgments
   * Manually trigger acknowledgment processing
   */
  app.post('/api/efile/process-acknowledgments',
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      // Process acknowledgments
      await enhancedEFileQueueService.processAcknowledgments();
      
      res.status(200).json({
        success: true,
        message: 'Acknowledgment processing initiated'
      });
    })
  );
  
  // ============================================================================
  // AUDIT & LOGGING ENDPOINTS
  // ============================================================================
  
  /**
   * GET /api/efile/logs/:returnId
   * Get submission logs for a return
   */
  app.get('/api/efile/logs/:returnId',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { returnId } = req.params;
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Verify ownership or staff permission
      const federalReturn = await storage.getFederalTaxReturn(returnId);
      if (!federalReturn) {
        return res.status(404).json({
          success: false,
          message: 'Federal tax return not found'
        });
      }
      
      const isOwner = federalReturn.userId === userId;
      const isStaff = req.user?.role && ['caseworker', 'admin', 'super_admin'].includes(req.user.role);
      
      if (!isOwner && !isStaff) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view submission logs'
        });
      }
      
      // Get submission logs
      const logs = await db
        .select()
        .from(efileSubmissionLogs)
        .where(eq(efileSubmissionLogs.federalReturnId, returnId))
        .orderBy(desc(efileSubmissionLogs.createdAt))
        .limit(limit);
      
      res.status(200).json({
        success: true,
        data: logs
      });
    })
  );
  
  /**
   * GET /api/efile/logs
   * Get all submission logs (admin only)
   */
  app.get('/api/efile/logs',
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const action = req.query.action as string;
      const errorType = req.query.errorType as string;
      
      let query = db.select().from(efileSubmissionLogs);
      
      // Apply filters
      const conditions = [];
      if (action) {
        conditions.push(eq(efileSubmissionLogs.action, action));
      }
      if (errorType) {
        conditions.push(eq(efileSubmissionLogs.errorType, errorType));
      }
      
      if (conditions.length > 0) {
        query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions)) as any;
      }
      
      const logs = await query
        .orderBy(desc(efileSubmissionLogs.createdAt))
        .limit(limit)
        .offset(offset);
      
      res.status(200).json({
        success: true,
        data: logs
      });
    })
  );
  
  // ============================================================================
  // ADMIN ENDPOINTS
  // ============================================================================
  
  /**
   * POST /api/efile/admin/reset-circuit-breaker
   * Reset the circuit breaker (admin only)
   */
  app.post('/api/efile/admin/reset-circuit-breaker',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      // Check if user is admin
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }
      
      // Reset circuit breaker
      const { irsMefClient } = await import('../services/irsMefClient');
      irsMefClient.forceResetCircuitBreaker();
      
      res.status(200).json({
        success: true,
        message: 'Circuit breaker reset successfully'
      });
    })
  );
  
  /**
   * POST /api/efile/admin/start-processing
   * Start queue processing (admin only)
   */
  app.post('/api/efile/admin/start-processing',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      // Check if user is admin
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }
      
      // Start processing
      enhancedEFileQueueService.startProcessing();
      
      res.status(200).json({
        success: true,
        message: 'Queue processing started'
      });
    })
  );
  
  /**
   * POST /api/efile/admin/stop-processing
   * Stop queue processing (admin only)
   */
  app.post('/api/efile/admin/stop-processing',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      // Check if user is admin
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }
      
      // Stop processing
      enhancedEFileQueueService.stopProcessing();
      
      res.status(200).json({
        success: true,
        message: 'Queue processing stopped'
      });
    })
  );
}

// Start queue processing on module load
enhancedEFileQueueService.startProcessing();

// Process acknowledgments periodically (every 5 minutes)
setInterval(() => {
  enhancedEFileQueueService.processAcknowledgments();
}, 5 * 60 * 1000);