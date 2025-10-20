import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { EFileQueueService } from '../services/eFileQueueService';
import { storage } from '../storage';
import { asyncHandler } from '../middleware/errorHandler';
import { auditService } from '../services/auditService';
import { requireAuth } from '../middleware/auth';

const router = Router();
const efileService = new EFileQueueService();

// Apply auth middleware to all Maryland e-file routes
router.use(requireAuth);

/**
 * Maryland E-Filing API Routes
 * 
 * Provides RESTful endpoints for Maryland Form 502 electronic filing workflow:
 * - Submit state tax returns for e-filing
 * - Check submission status
 * - Validate returns before submission
 * - Retrieve generated XML
 * - Retry failed submissions
 * 
 * All routes mounted at /api/maryland/efile
 */

// Validation schemas
const statusUpdateSchema = z.object({
  status: z.enum(['transmitted', 'accepted', 'rejected']),
  transmissionId: z.string().optional(),
  rejectionReason: z.string().optional(),
});

// Note: Authentication middleware will be applied at mount point in routes.ts

// ============================================================================
// POST /submit/:id - Submit Maryland tax return for e-filing
// ============================================================================
router.post('/submit/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // Verify user owns this tax return
  const taxReturn = await storage.getMarylandTaxReturn(id);
  if (!taxReturn) {
    return res.status(404).json({
      success: false,
      error: 'Maryland tax return not found',
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

  // Submit for e-filing (Maryland version)
  const result = await efileService.submitMarylandForEFile(id);

  // Log audit event
  await auditService.logAction({
    userId,
    action: 'maryland_efile_submit',
    resource: 'maryland_tax_return',
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
    message: 'Maryland tax return submitted for e-filing',
    marylandReturnId: result.marylandReturnId,
    efileStatus: result.efileStatus,
    xmlGenerated: result.xmlGenerated,
  });
}));

// ============================================================================
// GET /status/:id - Get Maryland e-file submission status
// ============================================================================
router.get('/status/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // Verify user owns this tax return
  const taxReturn = await storage.getMarylandTaxReturn(id);
  if (!taxReturn) {
    return res.status(404).json({
      success: false,
      error: 'Maryland tax return not found',
    });
  }

  if (taxReturn.userId !== userId && req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to view this tax return',
    });
  }

  // Get status
  const status = await efileService.checkMarylandStatus(id);

  res.json({
    success: true,
    ...status,
  });
}));

// ============================================================================
// POST /validate/:id - Validate Maryland tax return before submission
// ============================================================================
router.post('/validate/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // Verify user owns this tax return
  const taxReturn = await storage.getMarylandTaxReturn(id);
  if (!taxReturn) {
    return res.status(404).json({
      success: false,
      error: 'Maryland tax return not found',
    });
  }

  if (taxReturn.userId !== userId && req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to validate this tax return',
    });
  }

  // Use submitMarylandForEFile to validate
  const result = await efileService.submitMarylandForEFile(id);

  res.json({
    success: result.success,
    isValid: result.success,
    errors: result.errors || [],
    efileStatus: result.efileStatus,
    xmlGenerated: result.xmlGenerated,
  });
}));

// ============================================================================
// GET /xml/:id - Get generated Form 502 XML
// ============================================================================
router.get('/xml/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // Verify user owns this tax return
  const taxReturn = await storage.getMarylandTaxReturn(id);
  if (!taxReturn) {
    return res.status(404).json({
      success: false,
      error: 'Maryland tax return not found',
    });
  }

  if (taxReturn.userId !== userId && req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to view this tax return',
    });
  }

  // Check if XML exists
  if (!taxReturn.form502Xml) {
    return res.status(404).json({
      success: false,
      error: 'XML not generated yet',
      message: 'Please submit or validate the tax return first to generate XML',
    });
  }

  // Return XML as downloadable file
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="Form502_${id}_${taxReturn.taxYear}.xml"`);
  res.send(taxReturn.form502Xml);
}));

// ============================================================================
// POST /retry/:id - Retry failed Maryland e-file submission
// ============================================================================
router.post('/retry/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // Verify user owns this tax return
  const taxReturn = await storage.getMarylandTaxReturn(id);
  if (!taxReturn) {
    return res.status(404).json({
      success: false,
      error: 'Maryland tax return not found',
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
  const result = await efileService.retryMarylandSubmission(id);

  // Log audit event
  await auditService.logAction({
    userId,
    action: 'maryland_efile_retry',
    resource: 'maryland_tax_return',
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
    message: 'Maryland tax return resubmitted for e-filing',
    marylandReturnId: result.marylandReturnId,
    efileStatus: result.efileStatus,
  });
}));

export default router;
