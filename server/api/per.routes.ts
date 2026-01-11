/**
 * Payment Error Reduction (PER) Module API Routes
 * 
 * SNAP Payment Error Rate Reduction per Arnold Ventures/MD DHS Blueprint
 * Provides endpoints for error prevention, detection, and FNS compliance reporting.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  paymentErrorReductionService,
  incomeVerificationService,
  preSubmissionValidatorService,
  duplicateClaimDetectorService,
  explainableNudgeService,
  permReportingService,
  predictiveRiskScoringService,
  perComplianceAuditService,
  type WageDataRecord
} from '../services/per';
import { logger } from '../services/logger.service';
import { requireStaff, requireAdmin, requireAuth } from '../middleware/auth';

const router = Router();

// Apply requireStaff middleware to all PER routes - staff access required for error prevention
router.use(requireStaff);

// Validation schemas for request bodies
const assessCaseBodySchema = z.object({
  wageData: z.array(z.object({
    employerName: z.string(),
    employerEin: z.string().optional(),
    grossWages: z.number(),
    period: z.string().optional(),
    source: z.string().optional(),
  })).optional(),
  stateCode: z.string().default('MD'),
  tenantId: z.string().optional(),
});

const batchAssessBodySchema = z.object({
  caseIds: z.array(z.string()).min(1),
  stateCode: z.string().default('MD'),
  tenantId: z.string().optional(),
});

const incomeVerificationBodySchema = z.object({
  wageData: z.array(z.object({
    employerName: z.string(),
    employerEin: z.string().optional(),
    grossWages: z.number(),
    period: z.string().optional(),
    source: z.string().optional(),
  })),
  stateCode: z.string().default('MD'),
  tenantId: z.string().optional(),
});

const resolveVerificationBodySchema = z.object({
  resolutionStatus: z.enum(['resolved', 'escalated', 'waived']),
  resolutionAction: z.string(),
  notes: z.string().optional(),
});

const duplicateScanBodySchema = z.object({
  stateCode: z.string().default('MD'),
  tenantId: z.string().optional(),
});

const resolveDuplicateBodySchema = z.object({
  resolutionAction: z.enum(['merged', 'removed_from_primary', 'removed_from_duplicate', 'referred_fraud', 'false_positive']),
  notes: z.string().optional(),
});

const acknowledgeNudgeBodySchema = z.object({
  actionTaken: z.string(),
  feedback: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

const permSampleBodySchema = z.object({
  samplePeriod: z.string(),
  stateCode: z.string().default('MD'),
  countyCode: z.string().optional(),
  tenantId: z.string().optional(),
});

const updateSampleReviewBodySchema = z.object({
  reviewStatus: z.enum(['in_review', 'completed', 'unable_to_review']),
  hasError: z.boolean().optional(),
  errorType: z.enum(['overpayment', 'underpayment', 'none']).optional(),
  errorAmount: z.number().optional(),
  errorCategory: z.enum(['agency_error', 'client_error', 'both']).optional(),
  reviewNotes: z.string().optional(),
});

const validateCaseBodySchema = z.object({
  stateCode: z.string().default('MD'),
  tenantId: z.string().optional(),
});

const addressCheckBodySchema = z.object({
  action: z.string(),
});

const generateNudgesBodySchema = z.object({
  stateCode: z.string().default('MD'),
  tenantId: z.string().optional(),
  caseworkerId: z.string().optional(),
});

const nudgeActionBodySchema = z.object({
  action: z.string(),
  outcome: z.enum(['error_prevented', 'error_found', 'false_positive', 'no_action_needed']).optional(),
  feedback: z.string().optional(),
});

// ============================================================================
// CASE ASSESSMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/per/assess/:caseId
 * Run full PER assessment on a case (predict & prevent)
 */
router.post('/assess/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const parseResult = assessCaseBodySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }
    
    const { wageData, stateCode, tenantId } = parseResult.data;

    const assessment = await paymentErrorReductionService.assessCase(caseId, {
      wageData: wageData as WageDataRecord[],
      stateCode,
      tenantId,
      caseworkerId: req.user?.id
    });

    res.json({
      success: true,
      data: assessment
    });
  } catch (error) {
    logger.error('PER assessment failed', {
      route: 'POST /api/per/assess/:caseId',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Assessment failed'
    });
  }
});

/**
 * POST /api/per/assess/batch
 * Batch assess multiple cases
 */
router.post('/assess/batch', async (req: Request, res: Response) => {
  try {
    const parseResult = batchAssessBodySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }

    const { caseIds, stateCode, tenantId } = parseResult.data;

    const results = await paymentErrorReductionService.batchAssessCases(caseIds, {
      stateCode,
      tenantId
    });

    res.json({
      success: true,
      data: {
        casesAssessed: results.size,
        results: Object.fromEntries(results)
      }
    });
  } catch (error) {
    logger.error('Batch PER assessment failed', {
      route: 'POST /api/per/assess/batch',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Batch assessment failed'
    });
  }
});

// ============================================================================
// INCOME VERIFICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/per/income-verification/:caseId
 * Verify case income against wage data
 */
router.post('/income-verification/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const parseResult = incomeVerificationBodySchema.safeParse(req.body);
    const userId = (req.user as any)?.id;
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }
    
    const { wageData, stateCode, tenantId } = parseResult.data;

    await perComplianceAuditService.logWageDataAccess(
      caseId,
      userId,
      'SNAP income eligibility verification',
      wageData.length,
      req
    );

    const result = await incomeVerificationService.verifyCaseIncome(caseId, wageData, {
      stateCode,
      tenantId,
      createdBy: req.user?.id
    });

    await perComplianceAuditService.logIncomeVerification(
      { operationType: 'income_verification', caseId, userId, stateCode, tenantId, req },
      {
        discrepancyFound: result.hasDiscrepancy,
        discrepancyAmount: result.discrepancy?.amount,
        verificationSource: 'w2_wage_data',
        success: true
      }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Income verification failed', {
      route: 'POST /api/per/income-verification/:caseId',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed'
    });
  }
});

/**
 * GET /api/per/income-verification/pending
 * Get pending income verifications
 */
router.get('/income-verification/pending', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const limit = parseInt(req.query.limit as string) || 50;

    const verifications = await incomeVerificationService.getPendingVerifications(stateCode, limit);

    res.json({
      success: true,
      data: verifications
    });
  } catch (error) {
    logger.error('Get pending verifications failed', {
      route: 'GET /api/per/income-verification/pending',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get pending verifications'
    });
  }
});

/**
 * POST /api/per/income-verification/:id/resolve
 * Resolve an income verification finding
 */
router.post('/income-verification/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = resolveVerificationBodySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }
    
    const { resolutionStatus, resolutionAction, notes } = parseResult.data;

    const result = await incomeVerificationService.resolveVerification(id, {
      action: resolutionAction,
      resolvedBy: req.user?.id || 'system',
      notes
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Resolve verification failed', {
      route: 'POST /api/per/income-verification/:id/resolve',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to resolve verification'
    });
  }
});

/**
 * GET /api/per/income-verification/stats
 * Get income verification statistics
 */
router.get('/income-verification/stats', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const stats = await incomeVerificationService.getVerificationStats(stateCode, startDate, endDate);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get verification stats failed', {
      route: 'GET /api/per/income-verification/stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

// ============================================================================
// PRE-SUBMISSION VALIDATION ENDPOINTS
// ============================================================================

/**
 * POST /api/per/validate/:caseId
 * Run pre-submission validation on a case
 */
router.post('/validate/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const parseResult = validateCaseBodySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }
    
    const { stateCode, tenantId } = parseResult.data;

    const result = await preSubmissionValidatorService.validateCase(caseId, {
      stateCode,
      tenantId,
      triggeredBy: 'api_request'
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Pre-submission validation failed', {
      route: 'POST /api/per/validate/:caseId',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    });
  }
});

/**
 * GET /api/per/checks/:caseId
 * Get unaddressed consistency checks for a case
 */
router.get('/checks/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;

    const checks = await preSubmissionValidatorService.getUnaddressedChecks(caseId);

    res.json({
      success: true,
      data: checks
    });
  } catch (error) {
    logger.error('Get checks failed', {
      route: 'GET /api/per/checks/:caseId',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get checks'
    });
  }
});

/**
 * POST /api/per/checks/:id/address
 * Mark a consistency check as addressed
 */
router.post('/checks/:id/address', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = addressCheckBodySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }
    
    const { action } = parseResult.data;

    const result = await preSubmissionValidatorService.addressCheck(
      id,
      req.user?.id || 'system',
      action
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Address check failed', {
      route: 'POST /api/per/checks/:id/address',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to address check'
    });
  }
});

// ============================================================================
// DUPLICATE CLAIM DETECTION ENDPOINTS
// ============================================================================

/**
 * POST /api/per/duplicates/scan/:caseId
 * Scan a case for duplicate claims
 */
router.post('/duplicates/scan/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const parseResult = duplicateScanBodySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }
    
    const { stateCode, tenantId } = parseResult.data;

    const result = await duplicateClaimDetectorService.scanCaseForDuplicates(caseId, {
      stateCode,
      tenantId
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Duplicate scan failed', {
      route: 'POST /api/per/duplicates/scan/:caseId',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Scan failed'
    });
  }
});

/**
 * GET /api/per/duplicates/pending
 * Get pending duplicate claims
 */
router.get('/duplicates/pending', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const limit = parseInt(req.query.limit as string) || 50;

    const duplicates = await duplicateClaimDetectorService.getPendingDuplicates(stateCode, limit);

    res.json({
      success: true,
      data: duplicates
    });
  } catch (error) {
    logger.error('Get pending duplicates failed', {
      route: 'GET /api/per/duplicates/pending',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get pending duplicates'
    });
  }
});

/**
 * POST /api/per/duplicates/:id/resolve
 * Resolve a duplicate claim finding
 */
router.post('/duplicates/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = resolveDuplicateBodySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }
    
    const { resolutionAction, notes } = parseResult.data;

    const result = await duplicateClaimDetectorService.resolveDuplicateClaim(id, {
      status: 'resolved',
      action: resolutionAction,
      resolvedBy: req.user?.id || 'system',
      notes
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Resolve duplicate failed', {
      route: 'POST /api/per/duplicates/:id/resolve',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to resolve duplicate'
    });
  }
});

/**
 * GET /api/per/duplicates/stats
 * Get duplicate claim statistics
 */
router.get('/duplicates/stats', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';

    const stats = await duplicateClaimDetectorService.getDuplicateStats(stateCode);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get duplicate stats failed', {
      route: 'GET /api/per/duplicates/stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

// ============================================================================
// CASEWORKER NUDGE ENDPOINTS
// ============================================================================

/**
 * POST /api/per/nudges/generate/:caseId
 * Generate nudges for a case
 */
router.post('/nudges/generate/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const parseResult = generateNudgesBodySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }
    
    const { stateCode, tenantId, caseworkerId } = parseResult.data;

    const result = await explainableNudgeService.generateNudgesForCase(caseId, {
      stateCode,
      tenantId,
      caseworkerId: caseworkerId || req.user?.id
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Generate nudges failed', {
      route: 'POST /api/per/nudges/generate/:caseId',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed'
    });
  }
});

/**
 * GET /api/per/nudges/pending
 * Get pending nudges for caseworker
 */
router.get('/nudges/pending', async (req: Request, res: Response) => {
  try {
    const caseworkerId = req.query.caseworkerId as string;
    const stateCode = (req.query.stateCode as string) || 'MD';
    const limit = parseInt(req.query.limit as string) || 20;

    const nudges = await explainableNudgeService.getPendingNudges(caseworkerId, stateCode, limit);

    res.json({
      success: true,
      data: nudges
    });
  } catch (error) {
    logger.error('Get pending nudges failed', {
      route: 'GET /api/per/nudges/pending',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get nudges'
    });
  }
});

/**
 * GET /api/per/nudges/high-priority
 * Get high priority nudges for dashboard
 */
router.get('/nudges/high-priority', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const limit = parseInt(req.query.limit as string) || 10;

    const nudges = await explainableNudgeService.getHighPriorityNudges(stateCode, limit);

    res.json({
      success: true,
      data: nudges
    });
  } catch (error) {
    logger.error('Get high priority nudges failed', {
      route: 'GET /api/per/nudges/high-priority',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get nudges'
    });
  }
});

/**
 * POST /api/per/nudges/:id/view
 * Mark a nudge as viewed
 */
router.post('/nudges/:id/view', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await explainableNudgeService.markNudgeViewed(id);

    res.json({
      success: true
    });
  } catch (error) {
    logger.error('Mark nudge viewed failed', {
      route: 'POST /api/per/nudges/:id/view',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to mark as viewed'
    });
  }
});

/**
 * POST /api/per/nudges/:id/action
 * Record action taken on a nudge
 */
router.post('/nudges/:id/action', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = nudgeActionBodySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }
    
    const { action, outcome, feedback } = parseResult.data;

    const result = await explainableNudgeService.recordNudgeAction(id, action, outcome, feedback);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Record nudge action failed', {
      route: 'POST /api/per/nudges/:id/action',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to record action'
    });
  }
});

/**
 * GET /api/per/nudges/effectiveness
 * Get nudge effectiveness statistics
 */
router.get('/nudges/effectiveness', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const stats = await explainableNudgeService.getNudgeEffectivenessStats(stateCode, startDate, endDate);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get nudge effectiveness failed', {
      route: 'GET /api/per/nudges/effectiveness',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

// ============================================================================
// PERM SAMPLING & REPORTING ENDPOINTS
// ============================================================================

/**
 * POST /api/per/perm/sample
 * Select sample cases for PERM review
 */
router.post('/perm/sample', requireAdmin, async (req: Request, res: Response) => {
  try {
    const parseResult = permSampleBodySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }
    
    const { samplePeriod, stateCode, countyCode, tenantId } = parseResult.data;

    const result = await permReportingService.selectPermSample(samplePeriod, stateCode, {
      tenantId,
      countyCode
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('PERM sampling failed', {
      route: 'POST /api/per/perm/sample',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sampling failed'
    });
  }
});

/**
 * GET /api/per/perm/samples/pending
 * Get pending PERM samples for review
 */
router.get('/perm/samples/pending', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const samplePeriod = req.query.samplePeriod as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const samples = await permReportingService.getPendingSamples(stateCode, samplePeriod, limit);

    res.json({
      success: true,
      data: samples
    });
  } catch (error) {
    logger.error('Get pending samples failed', {
      route: 'GET /api/per/perm/samples/pending',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get samples'
    });
  }
});

/**
 * POST /api/per/perm/samples/:id/findings
 * Record review findings for a PERM sample
 */
router.post('/perm/samples/:id/findings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = updateSampleReviewBodySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }

    const result = await permReportingService.recordReviewFindings(
      id,
      req.user?.id || 'system',
      parseResult.data
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Record findings failed', {
      route: 'POST /api/per/perm/samples/:id/findings',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to record findings'
    });
  }
});

/**
 * GET /api/per/perm/report
 * Generate PERM rate report
 */
router.get('/perm/report', async (req: Request, res: Response) => {
  try {
    const samplePeriod = req.query.samplePeriod as string;
    const stateCode = (req.query.stateCode as string) || 'MD';

    if (!samplePeriod) {
      return res.status(400).json({
        success: false,
        error: 'samplePeriod is required'
      });
    }

    const report = await permReportingService.generatePermReport(samplePeriod, stateCode);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Generate PERM report failed', {
      route: 'GET /api/per/perm/report',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate report'
    });
  }
});

/**
 * GET /api/per/perm/progress
 * Get sample period review progress
 */
router.get('/perm/progress', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';

    const progress = await permReportingService.getSamplePeriodProgress(stateCode);

    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    logger.error('Get PERM progress failed', {
      route: 'GET /api/per/perm/progress',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get progress'
    });
  }
});

// ============================================================================
// PREDICTIVE RISK SCORING ENDPOINTS
// ============================================================================

/**
 * GET /api/per/risk-scores/:caseId
 * Get predictive risk score for a specific case
 */
router.get('/risk-scores/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const stateCode = (req.query.stateCode as string) || 'MD';
    const tenantId = req.query.tenantId as string;
    const userId = (req.user as any)?.id;

    const riskScore = await predictiveRiskScoringService.calculateRiskScore(caseId, {
      stateCode,
      tenantId
    });

    await perComplianceAuditService.logRiskScoreCalculation(
      { operationType: 'risk_score_calculation', caseId, userId, stateCode, tenantId, req },
      {
        riskScore: riskScore.riskScore,
        riskLevel: riskScore.riskLevel,
        factorsAnalyzed: riskScore.factors.length,
        success: true
      }
    );

    res.json({
      success: true,
      data: riskScore
    });
  } catch (error) {
    logger.error('Risk score calculation failed', {
      route: 'GET /api/per/risk-scores/:caseId',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Risk score calculation failed'
    });
  }
});

/**
 * GET /api/per/risk-scores/queue
 * Get prioritized case queue by risk score
 */
router.get('/risk-scores/queue', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const tenantId = req.query.tenantId as string;
    const riskLevelFilter = req.query.riskLevel 
      ? (req.query.riskLevel as string).split(',') as ('low' | 'medium' | 'high' | 'critical')[]
      : undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const sortBy = (req.query.sortBy as 'riskScore' | 'predictedErrorAmount' | 'priority') || 'priority';
    const sortDirection = (req.query.sortDirection as 'asc' | 'desc') || 'desc';

    const result = await predictiveRiskScoringService.getPrioritizedCaseQueue({
      stateCode,
      tenantId,
      riskLevelFilter,
      limit,
      offset,
      sortBy,
      sortDirection
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Risk queue fetch failed', {
      route: 'GET /api/per/risk-scores/queue',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get risk queue'
    });
  }
});

/**
 * GET /api/per/risk-scores/high-risk
 * Get high-risk cases requiring immediate review
 */
router.get('/risk-scores/high-risk', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const limit = parseInt(req.query.limit as string) || 20;

    const cases = await predictiveRiskScoringService.getHighRiskCases(stateCode, limit);

    res.json({
      success: true,
      data: cases
    });
  } catch (error) {
    logger.error('High risk cases fetch failed', {
      route: 'GET /api/per/risk-scores/high-risk',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get high risk cases'
    });
  }
});

/**
 * GET /api/per/risk-scores/stats
 * Get risk score statistics for dashboard
 */
router.get('/risk-scores/stats', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';

    const stats = await predictiveRiskScoringService.getRiskScoreStats(stateCode);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Risk stats fetch failed', {
      route: 'GET /api/per/risk-scores/stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get risk statistics'
    });
  }
});

// ============================================================================
// DASHBOARD & SYSTEM ENDPOINTS
// ============================================================================

/**
 * GET /api/per/dashboard
 * Get PER dashboard metrics
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const days = parseInt(req.query.days as string) || 30;

    const metrics = await paymentErrorReductionService.getDashboardMetrics(stateCode, days);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Get dashboard metrics failed', {
      route: 'GET /api/per/dashboard',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics'
    });
  }
});

/**
 * GET /api/per/health
 * Get PER system health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await paymentErrorReductionService.getSystemHealth();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Get system health failed', {
      route: 'GET /api/per/health',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get health status'
    });
  }
});

/**
 * GET /api/per/report
 * Generate comprehensive PER report
 */
router.get('/report', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const samplePeriod = req.query.samplePeriod as string;

    const report = await paymentErrorReductionService.generateComprehensiveReport(stateCode, samplePeriod);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Generate comprehensive report failed', {
      route: 'GET /api/per/report',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate report'
    });
  }
});

// ============================================================================
// COMPLIANCE AUDIT ENDPOINTS
// ============================================================================

/**
 * GET /api/per/compliance/report
 * Get HIPAA/IRS 1075 compliance audit report for PER operations
 */
router.get('/compliance/report', requireAdmin, async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const days = parseInt(req.query.days as string) || 30;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const report = await perComplianceAuditService.getComplianceReport(
      stateCode,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: {
        ...report,
        reportPeriod: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          days
        },
        stateCode,
        generatedAt: new Date().toISOString(),
        complianceFrameworks: ['HIPAA', 'IRS Publication 1075', 'FNS SNAP QC']
      }
    });
  } catch (error) {
    logger.error('Get compliance report failed', {
      route: 'GET /api/per/compliance/report',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get compliance report'
    });
  }
});

export default router;
