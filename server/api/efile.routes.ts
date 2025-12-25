import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { EFileQueueService } from '../services/eFileQueueService';
import { storage } from '../storage';
import { asyncHandler } from '../middleware/errorHandler';
import { auditService } from '../services/auditService';
import { requireAuth, requireAdmin } from '../middleware/auth';

const efileService = new EFileQueueService();

/**
 * Federal E-Filing API Routes
 * 
 * Provides RESTful endpoints for IRS Form 1040 electronic filing workflow:
 * - Submit tax returns for e-filing
 * - Check submission status
 * - Validate returns before submission
 * - Retrieve generated XML
 * - Retry failed submissions
 * - View e-file queue
 * - Update submission status (admin only)
 */

// Validation schemas
const statusUpdateSchema = z.object({
  status: z.enum(['transmitted', 'accepted', 'rejected']),
  transmissionId: z.string().optional(),
  rejectionReason: z.string().optional(),
  rejectionDetails: z.any().optional(),
});

/**
 * Register Federal E-Filing routes
 * All routes require authentication, admin routes require admin role
 */
export function registerEFileRoutes(app: any) {

  // ============================================================================
  // POST /api/efile/submit/:id - Submit federal tax return for e-filing
  // ============================================================================
  app.post('/api/efile/submit/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify user owns this tax return
    const taxReturn = await storage.getFederalTaxReturn(id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found',
      });
    }

    if (taxReturn.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to submit this tax return',
      });
    }

    // Check if already submitted
    if (taxReturn.efileStatus && ['transmitted', 'accepted'].includes(taxReturn.efileStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Tax return already submitted',
        efileStatus: taxReturn.efileStatus,
      });
    }

    // Submit for e-filing
    const result = await efileService.submitForEFile(id);

    // Log audit event
    await auditService.logAction({
      userId,
      action: 'efile_submit',
      resource: 'federal_tax_return',
      resourceId: id,
      details: {
        success: result.success,
        efileStatus: result.efileStatus,
        errors: result.errors,
      },
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: result.errors,
        efileStatus: result.efileStatus,
      });
    }

    res.json({
      success: true,
      message: 'Tax return submitted for e-filing',
      federalReturnId: result.federalReturnId,
      efileStatus: result.efileStatus,
      xmlGenerated: result.xmlGenerated,
    });
  }));

  // ============================================================================
  // GET /api/efile/status/:id - Get e-file submission status
  // ============================================================================
  app.get('/api/efile/status/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify user owns this tax return
    const taxReturn = await storage.getFederalTaxReturn(id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found',
      });
    }

    if (taxReturn.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this tax return',
      });
    }

    // Get status from service
    const status = await efileService.checkStatus(id);

    res.json({
      success: true,
      ...status,
    });
  }));

  // ============================================================================
  // POST /api/efile/validate/:id - Validate tax return before submission
  // ============================================================================
  app.post('/api/efile/validate/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify user owns this tax return
    const taxReturn = await storage.getFederalTaxReturn(id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found',
      });
    }

    if (taxReturn.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to validate this tax return',
      });
    }

    // Use submitForEFile to validate (it won't actually submit, just validates and generates XML)
    // The service validates and generates XML, updating status to "ready"
    const result = await efileService.submitForEFile(id);

    res.json({
      success: result.success,
      isValid: result.success,
      errors: result.errors || [],
      efileStatus: result.efileStatus,
      xmlGenerated: result.xmlGenerated,
    });
  }));

  // ============================================================================
  // GET /api/efile/xml/:id - Get generated Form 1040 XML
  // ============================================================================
  app.get('/api/efile/xml/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify user owns this tax return
    const taxReturn = await storage.getFederalTaxReturn(id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found',
      });
    }

    if (taxReturn.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this tax return',
      });
    }

    // Check if XML exists
    if (!taxReturn.form1040Xml) {
      return res.status(404).json({
        success: false,
        error: 'XML not generated yet',
        message: 'Please submit or validate the tax return first to generate XML',
      });
    }

    // Return XML as downloadable file
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="Form1040_${id}_${taxReturn.taxYear}.xml"`);
    res.send(taxReturn.form1040Xml);
  }));

  // ============================================================================
  // POST /api/efile/retry/:id - Retry failed e-file submission
  // ============================================================================
  app.post('/api/efile/retry/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify user owns this tax return
    const taxReturn = await storage.getFederalTaxReturn(id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found',
      });
    }

    if (taxReturn.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to retry this tax return',
      });
    }

    // Check if it's in a retryable state
    if (taxReturn.efileStatus !== 'rejected') {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: 'Only rejected submissions can be retried',
        currentStatus: taxReturn.efileStatus,
      });
    }

    // Retry submission
    const result = await efileService.retryFailedSubmission(id);

    // Log audit event
    await auditService.logAction({
      userId,
      action: 'efile_retry',
      resource: 'federal_tax_return',
      resourceId: id,
      details: {
        previousStatus: taxReturn.efileStatus,
        success: result.success,
        newStatus: result.efileStatus,
      },
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Retry failed',
        errors: result.errors,
      });
    }

    res.json({
      success: true,
      message: 'Tax return resubmitted for e-filing',
      federalReturnId: result.federalReturnId,
      efileStatus: result.efileStatus,
    });
  }));

  // ============================================================================
  // GET /api/efile/queue - Get e-file submission queue
  // ============================================================================
  app.get('/api/efile/queue', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const isAdmin = req.user?.role === 'admin';
    const { status, limit = '50' } = req.query;

    let submissions;

    if (status === 'pending') {
      submissions = await efileService.getPendingSubmissions();
    } else if (status === 'failed') {
      submissions = await efileService.getFailedSubmissions();
    } else {
      submissions = await efileService.getRecentSubmissions(parseInt(limit as string));
    }

    // Filter to user's own submissions unless admin
    if (!isAdmin) {
      submissions = submissions.filter(sub => sub.userId === userId);
    }

    res.json({
      success: true,
      count: submissions.length,
      submissions,
    });
  }));

  // ============================================================================
  // POST /api/efile/update-status/:id - Update e-file submission status (ADMIN ONLY)
  // ============================================================================
  app.post('/api/efile/update-status/:id', requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Validate request body
    const validationResult = statusUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        errors: validationResult.error.errors,
      });
    }

    const statusUpdate = validationResult.data;

    // Verify tax return exists
    const taxReturn = await storage.getFederalTaxReturn(id);
    if (!taxReturn) {
      return res.status(404).json({
        success: false,
        error: 'Tax return not found',
      });
    }

    // Update status
    await efileService.updateSubmissionStatus(id, statusUpdate);

    // Log audit event
    await auditService.logAction({
      userId,
      action: 'efile_status_update',
      resource: 'federal_tax_return',
      resourceId: id,
      details: {
        previousStatus: taxReturn.efileStatus,
        newStatus: statusUpdate.status,
        transmissionId: statusUpdate.transmissionId,
        rejectionReason: statusUpdate.rejectionReason,
      },
    });

    res.json({
      success: true,
      message: 'E-file status updated successfully',
      newStatus: statusUpdate.status,
    });
  }));
}
