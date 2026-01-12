/**
 * Payment Error Reduction (PER) Module API Routes
 * 
 * SNAP Payment Error Rate Reduction per Arnold Ventures/MD DHS Blueprint
 * Provides endpoints for error prevention, detection, and FNS compliance reporting.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import {
  counties,
  perIncomeVerifications,
  perConsistencyChecks,
  perCaseworkerNudges,
  perDuplicateClaims,
  perPermSamples
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
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

// ============================================================================
// STATE ADMIN ENDPOINTS (Benefits Access Director)
// Executive-level dashboards for central state administrative staff
// ============================================================================

/**
 * GET /api/per/admin/ldss-comparison
 * Compare PER metrics across all LDSS offices for state-level oversight
 * Returns error rates, risk scores, and nudge effectiveness by office
 */
router.get('/admin/ldss-comparison', requireAdmin, async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const days = parseInt(req.query.days as string) || 30;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all counties/LDSS offices for the state
    const countiesResult = await db.select({
      id: counties.id,
      name: counties.name,
      code: counties.code,
      region: counties.region
    })
    .from(counties)
    .where(eq(counties.countyType, 'ldss'));

    // Build comparison metrics for each LDSS
    const ldssMetrics = await Promise.all(
      countiesResult.map(async (county) => {
        // Get income verification stats for this county/tenant
        const verificationStats = await db.select({
          totalVerifications: sql<number>`count(*)`,
          errorCount: sql<number>`count(*) filter (where ${perIncomeVerifications.isPaymentError} = true)`,
          avgDiscrepancy: sql<number>`avg(abs(${perIncomeVerifications.discrepancyAmount}))`,
          resolvedCount: sql<number>`count(*) filter (where ${perIncomeVerifications.resolutionStatus} = 'resolved')`
        })
        .from(perIncomeVerifications)
        .where(and(
          eq(perIncomeVerifications.tenantId, county.id),
          gte(perIncomeVerifications.createdAt, startDate),
          lte(perIncomeVerifications.createdAt, endDate)
        ));

        // Get consistency check stats
        const checkStats = await db.select({
          totalChecks: sql<number>`count(*)`,
          failedChecks: sql<number>`count(*) filter (where ${perConsistencyChecks.passed} = false)`,
          warningCount: sql<number>`count(*) filter (where ${perConsistencyChecks.severity} = 'warning')`,
          criticalCount: sql<number>`count(*) filter (where ${perConsistencyChecks.severity} = 'critical')`
        })
        .from(perConsistencyChecks)
        .where(and(
          eq(perConsistencyChecks.tenantId, county.id),
          gte(perConsistencyChecks.createdAt, startDate),
          lte(perConsistencyChecks.createdAt, endDate)
        ));

        // Get nudge stats
        const nudgeStats = await db.select({
          totalNudges: sql<number>`count(*)`,
          acknowledgedNudges: sql<number>`count(*) filter (where ${perCaseworkerNudges.acknowledgedAt} is not null)`,
          errorsPreventedCount: sql<number>`count(*) filter (where ${perCaseworkerNudges.outcome} = 'error_prevented')`,
          avgRating: sql<number>`avg(${perCaseworkerNudges.rating})`
        })
        .from(perCaseworkerNudges)
        .where(and(
          eq(perCaseworkerNudges.tenantId, county.id),
          gte(perCaseworkerNudges.createdAt, startDate),
          lte(perCaseworkerNudges.createdAt, endDate)
        ));

        // Get duplicate claim stats
        const duplicateStats = await db.select({
          totalDuplicates: sql<number>`count(*)`,
          confirmedDuplicates: sql<number>`count(*) filter (where ${perDuplicateClaims.isConfirmedDuplicate} = true)`,
          resolvedDuplicates: sql<number>`count(*) filter (where ${perDuplicateClaims.resolutionStatus} = 'resolved')`
        })
        .from(perDuplicateClaims)
        .where(and(
          eq(perDuplicateClaims.tenantId, county.id),
          gte(perDuplicateClaims.createdAt, startDate),
          lte(perDuplicateClaims.createdAt, endDate)
        ));

        // Calculate derived metrics
        const totalVer = Number(verificationStats[0]?.totalVerifications) || 0;
        const errorCount = Number(verificationStats[0]?.errorCount) || 0;
        const totalNudges = Number(nudgeStats[0]?.totalNudges) || 0;
        const acknowledgedNudges = Number(nudgeStats[0]?.acknowledgedNudges) || 0;
        const errorsPreventedCount = Number(nudgeStats[0]?.errorsPreventedCount) || 0;

        return {
          ldssId: county.id,
          ldssName: county.name,
          ldssCode: county.code,
          region: county.region,
          metrics: {
            incomeVerification: {
              total: totalVer,
              errorCount,
              errorRate: totalVer > 0 ? (errorCount / totalVer) * 100 : 0,
              avgDiscrepancy: Number(verificationStats[0]?.avgDiscrepancy) || 0,
              resolvedCount: Number(verificationStats[0]?.resolvedCount) || 0
            },
            consistencyChecks: {
              total: Number(checkStats[0]?.totalChecks) || 0,
              failedCount: Number(checkStats[0]?.failedChecks) || 0,
              warningCount: Number(checkStats[0]?.warningCount) || 0,
              criticalCount: Number(checkStats[0]?.criticalCount) || 0
            },
            caseworkerNudges: {
              total: totalNudges,
              acknowledgedCount: acknowledgedNudges,
              acknowledgeRate: totalNudges > 0 ? (acknowledgedNudges / totalNudges) * 100 : 0,
              errorsPreventedCount,
              avgRating: Number(nudgeStats[0]?.avgRating) || 0
            },
            duplicateClaims: {
              total: Number(duplicateStats[0]?.totalDuplicates) || 0,
              confirmedCount: Number(duplicateStats[0]?.confirmedDuplicates) || 0,
              resolvedCount: Number(duplicateStats[0]?.resolvedDuplicates) || 0
            }
          }
        };
      })
    );

    // Calculate statewide aggregates
    const statewideTotals = ldssMetrics.reduce((acc, ldss) => {
      acc.totalVerifications += ldss.metrics.incomeVerification.total;
      acc.totalErrors += ldss.metrics.incomeVerification.errorCount;
      acc.totalNudges += ldss.metrics.caseworkerNudges.total;
      acc.totalErrorsPrevented += ldss.metrics.caseworkerNudges.errorsPreventedCount;
      acc.totalDuplicates += ldss.metrics.duplicateClaims.confirmedCount;
      return acc;
    }, {
      totalVerifications: 0,
      totalErrors: 0,
      totalNudges: 0,
      totalErrorsPrevented: 0,
      totalDuplicates: 0
    });

    // Sort LDSS by error rate (highest first) for prioritization
    const sortedLdss = ldssMetrics.sort((a, b) => 
      b.metrics.incomeVerification.errorRate - a.metrics.incomeVerification.errorRate
    );

    res.json({
      success: true,
      data: {
        stateCode,
        reportPeriod: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          days
        },
        statewideKPIs: {
          overallErrorRate: statewideTotals.totalVerifications > 0 
            ? (statewideTotals.totalErrors / statewideTotals.totalVerifications) * 100 
            : 0,
          totalVerifications: statewideTotals.totalVerifications,
          totalErrors: statewideTotals.totalErrors,
          totalNudgesGenerated: statewideTotals.totalNudges,
          errorsPreventedByNudges: statewideTotals.totalErrorsPrevented,
          confirmedDuplicates: statewideTotals.totalDuplicates,
          ldssCount: ldssMetrics.length
        },
        ldssComparison: sortedLdss,
        highestRiskOffices: sortedLdss.slice(0, 5).map(l => ({
          name: l.ldssName,
          errorRate: l.metrics.incomeVerification.errorRate.toFixed(1) + '%',
          region: l.region
        })),
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('LDSS comparison failed', {
      route: 'GET /api/per/admin/ldss-comparison',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate LDSS comparison'
    });
  }
});

/**
 * GET /api/per/admin/trends
 * Get statewide PER trends over time for executive dashboards
 * Returns time-series data for error rates, verifications, and PERM compliance
 */
router.get('/admin/trends', requireAdmin, async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    const months = parseInt(req.query.months as string) || 6;
    const granularity = (req.query.granularity as string) || 'weekly'; // daily, weekly, monthly
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Determine date truncation based on granularity
    const dateTrunc = granularity === 'daily' ? 'day' : 
                      granularity === 'monthly' ? 'month' : 'week';

    // Get verification trends over time
    const verificationTrends = await db.select({
      period: sql<string>`date_trunc(${dateTrunc}, ${perIncomeVerifications.createdAt})::text`,
      totalVerifications: sql<number>`count(*)`,
      errorCount: sql<number>`count(*) filter (where ${perIncomeVerifications.isPaymentError} = true)`,
      avgDiscrepancy: sql<number>`avg(abs(${perIncomeVerifications.discrepancyAmount}))`
    })
    .from(perIncomeVerifications)
    .where(and(
      eq(perIncomeVerifications.stateCode, stateCode),
      gte(perIncomeVerifications.createdAt, startDate),
      lte(perIncomeVerifications.createdAt, endDate)
    ))
    .groupBy(sql`date_trunc(${dateTrunc}, ${perIncomeVerifications.createdAt})`)
    .orderBy(sql`date_trunc(${dateTrunc}, ${perIncomeVerifications.createdAt})`);

    // Get nudge trends over time
    const nudgeTrends = await db.select({
      period: sql<string>`date_trunc(${dateTrunc}, ${perCaseworkerNudges.createdAt})::text`,
      totalNudges: sql<number>`count(*)`,
      acknowledgedNudges: sql<number>`count(*) filter (where ${perCaseworkerNudges.acknowledgedAt} is not null)`,
      errorsPrevented: sql<number>`count(*) filter (where ${perCaseworkerNudges.outcome} = 'error_prevented')`
    })
    .from(perCaseworkerNudges)
    .where(and(
      eq(perCaseworkerNudges.stateCode, stateCode),
      gte(perCaseworkerNudges.createdAt, startDate),
      lte(perCaseworkerNudges.createdAt, endDate)
    ))
    .groupBy(sql`date_trunc(${dateTrunc}, ${perCaseworkerNudges.createdAt})`)
    .orderBy(sql`date_trunc(${dateTrunc}, ${perCaseworkerNudges.createdAt})`);

    // Get PERM sample trends by quarter
    const permTrends = await db.select({
      samplePeriod: perPermSamples.samplePeriod,
      totalSamples: sql<number>`count(*)`,
      completedReviews: sql<number>`count(*) filter (where ${perPermSamples.reviewStatus} = 'completed')`,
      errorsFound: sql<number>`count(*) filter (where ${perPermSamples.hasError} = true)`,
      overpaymentAmount: sql<number>`sum(${perPermSamples.errorAmount}) filter (where ${perPermSamples.errorType} = 'overpayment')`,
      underpaymentAmount: sql<number>`sum(${perPermSamples.errorAmount}) filter (where ${perPermSamples.errorType} = 'underpayment')`
    })
    .from(perPermSamples)
    .where(and(
      eq(perPermSamples.stateCode, stateCode),
      gte(perPermSamples.selectionDate, startDate)
    ))
    .groupBy(perPermSamples.samplePeriod)
    .orderBy(perPermSamples.samplePeriod);

    // Get consistency check trends
    const checkTrends = await db.select({
      period: sql<string>`date_trunc(${dateTrunc}, ${perConsistencyChecks.createdAt})::text`,
      totalChecks: sql<number>`count(*)`,
      failedChecks: sql<number>`count(*) filter (where ${perConsistencyChecks.passed} = false)`,
      criticalIssues: sql<number>`count(*) filter (where ${perConsistencyChecks.severity} = 'critical')`
    })
    .from(perConsistencyChecks)
    .where(and(
      eq(perConsistencyChecks.stateCode, stateCode),
      gte(perConsistencyChecks.createdAt, startDate),
      lte(perConsistencyChecks.createdAt, endDate)
    ))
    .groupBy(sql`date_trunc(${dateTrunc}, ${perConsistencyChecks.createdAt})`)
    .orderBy(sql`date_trunc(${dateTrunc}, ${perConsistencyChecks.createdAt})`);

    // Format trends for charting
    const formattedVerificationTrends = verificationTrends.map(t => ({
      period: t.period,
      totalVerifications: Number(t.totalVerifications) || 0,
      errorCount: Number(t.errorCount) || 0,
      errorRate: Number(t.totalVerifications) > 0 
        ? (Number(t.errorCount) / Number(t.totalVerifications)) * 100 
        : 0,
      avgDiscrepancy: Number(t.avgDiscrepancy) || 0
    }));

    const formattedNudgeTrends = nudgeTrends.map(t => ({
      period: t.period,
      totalNudges: Number(t.totalNudges) || 0,
      acknowledgedNudges: Number(t.acknowledgedNudges) || 0,
      acknowledgeRate: Number(t.totalNudges) > 0 
        ? (Number(t.acknowledgedNudges) / Number(t.totalNudges)) * 100 
        : 0,
      errorsPrevented: Number(t.errorsPrevented) || 0
    }));

    const formattedPermTrends = permTrends.map(t => ({
      samplePeriod: t.samplePeriod,
      totalSamples: Number(t.totalSamples) || 0,
      completedReviews: Number(t.completedReviews) || 0,
      errorsFound: Number(t.errorsFound) || 0,
      errorRate: Number(t.completedReviews) > 0 
        ? (Number(t.errorsFound) / Number(t.completedReviews)) * 100 
        : 0,
      overpaymentAmount: Number(t.overpaymentAmount) || 0,
      underpaymentAmount: Number(t.underpaymentAmount) || 0
    }));

    const formattedCheckTrends = checkTrends.map(t => ({
      period: t.period,
      totalChecks: Number(t.totalChecks) || 0,
      failedChecks: Number(t.failedChecks) || 0,
      failureRate: Number(t.totalChecks) > 0 
        ? (Number(t.failedChecks) / Number(t.totalChecks)) * 100 
        : 0,
      criticalIssues: Number(t.criticalIssues) || 0
    }));

    res.json({
      success: true,
      data: {
        stateCode,
        reportPeriod: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          months,
          granularity
        },
        trends: {
          incomeVerification: formattedVerificationTrends,
          caseworkerNudges: formattedNudgeTrends,
          permCompliance: formattedPermTrends,
          consistencyChecks: formattedCheckTrends
        },
        summary: {
          latestErrorRate: formattedVerificationTrends.length > 0 
            ? formattedVerificationTrends[formattedVerificationTrends.length - 1].errorRate 
            : 0,
          errorRateTrend: formattedVerificationTrends.length >= 2
            ? formattedVerificationTrends[formattedVerificationTrends.length - 1].errorRate - 
              formattedVerificationTrends[formattedVerificationTrends.length - 2].errorRate
            : 0,
          totalErrorsPrevented: formattedNudgeTrends.reduce((sum, t) => sum + t.errorsPrevented, 0),
          currentPermErrorRate: formattedPermTrends.length > 0
            ? formattedPermTrends[formattedPermTrends.length - 1].errorRate
            : 0
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Trends generation failed', {
      route: 'GET /api/per/admin/trends',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate trends data'
    });
  }
});

/**
 * GET /api/per/admin/executive-summary
 * Generate executive summary for leadership briefings
 */
router.get('/admin/executive-summary', requireAdmin, async (req: Request, res: Response) => {
  try {
    const stateCode = (req.query.stateCode as string) || 'MD';
    
    // Get current month and previous month for comparison
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Current month stats
    const currentStats = await db.select({
      totalVerifications: sql<number>`count(*)`,
      errorCount: sql<number>`count(*) filter (where ${perIncomeVerifications.isPaymentError} = true)`,
      totalErrorAmount: sql<number>`sum(abs(${perIncomeVerifications.discrepancyAmount})) filter (where ${perIncomeVerifications.isPaymentError} = true)`
    })
    .from(perIncomeVerifications)
    .where(and(
      eq(perIncomeVerifications.stateCode, stateCode),
      gte(perIncomeVerifications.createdAt, currentMonthStart)
    ));

    // Previous month stats for comparison
    const previousStats = await db.select({
      totalVerifications: sql<number>`count(*)`,
      errorCount: sql<number>`count(*) filter (where ${perIncomeVerifications.isPaymentError} = true)`
    })
    .from(perIncomeVerifications)
    .where(and(
      eq(perIncomeVerifications.stateCode, stateCode),
      gte(perIncomeVerifications.createdAt, previousMonthStart),
      lte(perIncomeVerifications.createdAt, previousMonthEnd)
    ));

    // Current nudge effectiveness
    const nudgeEffectiveness = await db.select({
      totalNudges: sql<number>`count(*)`,
      errorsPrevented: sql<number>`count(*) filter (where ${perCaseworkerNudges.outcome} = 'error_prevented')`,
      estimatedSavings: sql<number>`sum(${perCaseworkerNudges.estimatedImpactAmount}) filter (where ${perCaseworkerNudges.outcome} = 'error_prevented')`
    })
    .from(perCaseworkerNudges)
    .where(and(
      eq(perCaseworkerNudges.stateCode, stateCode),
      gte(perCaseworkerNudges.createdAt, currentMonthStart)
    ));

    // PERM compliance status (latest quarter)
    const latestPermStatus = await db.select({
      samplePeriod: perPermSamples.samplePeriod,
      totalSamples: sql<number>`count(*)`,
      completedReviews: sql<number>`count(*) filter (where ${perPermSamples.reviewStatus} = 'completed')`,
      errorsFound: sql<number>`count(*) filter (where ${perPermSamples.hasError} = true)`
    })
    .from(perPermSamples)
    .where(eq(perPermSamples.stateCode, stateCode))
    .groupBy(perPermSamples.samplePeriod)
    .orderBy(desc(perPermSamples.samplePeriod))
    .limit(1);

    // Calculate metrics
    const currentErrorRate = Number(currentStats[0]?.totalVerifications) > 0
      ? (Number(currentStats[0]?.errorCount) / Number(currentStats[0]?.totalVerifications)) * 100
      : 0;
    const previousErrorRate = Number(previousStats[0]?.totalVerifications) > 0
      ? (Number(previousStats[0]?.errorCount) / Number(previousStats[0]?.totalVerifications)) * 100
      : 0;
    const errorRateChange = currentErrorRate - previousErrorRate;

    res.json({
      success: true,
      data: {
        stateCode,
        reportMonth: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
        keyMetrics: {
          currentErrorRate: currentErrorRate.toFixed(2) + '%',
          errorRateChange: (errorRateChange >= 0 ? '+' : '') + errorRateChange.toFixed(2) + '%',
          errorRateTrend: errorRateChange < 0 ? 'improving' : errorRateChange > 0 ? 'worsening' : 'stable',
          totalVerificationsThisMonth: Number(currentStats[0]?.totalVerifications) || 0,
          errorsDetectedThisMonth: Number(currentStats[0]?.errorCount) || 0,
          estimatedErrorAmount: Number(currentStats[0]?.totalErrorAmount) || 0
        },
        nudgeImpact: {
          nudgesGeneratedThisMonth: Number(nudgeEffectiveness[0]?.totalNudges) || 0,
          errorsPreventedThisMonth: Number(nudgeEffectiveness[0]?.errorsPrevented) || 0,
          estimatedSavings: Number(nudgeEffectiveness[0]?.estimatedSavings) || 0
        },
        permCompliance: latestPermStatus.length > 0 ? {
          currentPeriod: latestPermStatus[0].samplePeriod,
          totalSamples: Number(latestPermStatus[0].totalSamples) || 0,
          completedReviews: Number(latestPermStatus[0].completedReviews) || 0,
          completionRate: Number(latestPermStatus[0].totalSamples) > 0
            ? ((Number(latestPermStatus[0].completedReviews) / Number(latestPermStatus[0].totalSamples)) * 100).toFixed(1) + '%'
            : '0%',
          errorsFound: Number(latestPermStatus[0].errorsFound) || 0,
          errorRate: Number(latestPermStatus[0].completedReviews) > 0
            ? ((Number(latestPermStatus[0].errorsFound) / Number(latestPermStatus[0].completedReviews)) * 100).toFixed(2) + '%'
            : '0%'
        } : null,
        generatedAt: new Date().toISOString(),
        nextUpdate: 'Auto-refreshes daily at 6:00 AM EST'
      }
    });
  } catch (error) {
    logger.error('Executive summary generation failed', {
      route: 'GET /api/per/admin/executive-summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate executive summary'
    });
  }
});

export default router;
