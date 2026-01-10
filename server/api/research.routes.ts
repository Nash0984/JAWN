/**
 * Research API Routes
 * 
 * Public-facing API for external researchers with properly secured access.
 * All endpoints require API key authentication with research-specific scopes.
 * 
 * Privacy protections:
 * - All data is aggregated and PII-stripped
 * - Minimum sample thresholds enforced (k-anonymity)
 * - Full audit logging of all data access
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireApiKey, trackApiUsage, availableScopes } from '../middleware/apiKeyAuth';
import { researchAggregationService } from '../services/researchAggregation.service';
import { createCustomRateLimiter } from '../middleware/enhancedRateLimiting';
import { logger } from '../services/logger.service';

const router = Router();

const researchRateLimiter = createCustomRateLimiter(
  60 * 60 * 1000,
  100,
  'Research API rate limit exceeded. Please wait before retrying.'
);

router.use(researchRateLimiter);
router.use(trackApiUsage());

const researchQuerySchema = z.object({
  stateCode: z.string().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  programType: z.string().optional(),
});

/**
 * GET /api/research/docs
 * API documentation endpoint (no auth required)
 */
router.get('/docs', (req: Request, res: Response) => {
  const docs = researchAggregationService.getApiDocumentation();
  
  res.json({
    success: true,
    data: docs
  });
});

/**
 * GET /api/research/scopes
 * List available research scopes (no auth required)
 */
router.get('/scopes', (req: Request, res: Response) => {
  const researchScopes = Object.entries(availableScopes)
    .filter(([key]) => key.startsWith('research:'))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
  
  res.json({
    success: true,
    data: researchScopes
  });
});

/**
 * GET /api/research/eligibility
 * Aggregated eligibility statistics
 */
router.get('/eligibility', requireApiKey('research:eligibility'), async (req: Request, res: Response) => {
  try {
    const parseResult = researchQuerySchema.safeParse(req.query);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parseResult.error.errors
      });
    }
    
    const result = await researchAggregationService.getEligibilityStats({
      ...parseResult.data,
      apiKeyId: req.apiKey!.id
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Research eligibility endpoint failed', {
      route: 'GET /api/research/eligibility',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve eligibility data'
    });
  }
});

/**
 * GET /api/research/outcomes
 * Case outcome statistics
 */
router.get('/outcomes', requireApiKey('research:outcomes'), async (req: Request, res: Response) => {
  try {
    const parseResult = researchQuerySchema.safeParse(req.query);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parseResult.error.errors
      });
    }
    
    const result = await researchAggregationService.getOutcomeStats({
      ...parseResult.data,
      apiKeyId: req.apiKey!.id
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Research outcomes endpoint failed', {
      route: 'GET /api/research/outcomes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve outcomes data'
    });
  }
});

/**
 * GET /api/research/demographics
 * Aggregated demographic distributions
 */
router.get('/demographics', requireApiKey('research:demographics'), async (req: Request, res: Response) => {
  try {
    const parseResult = researchQuerySchema.safeParse(req.query);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parseResult.error.errors
      });
    }
    
    const result = await researchAggregationService.getDemographicDistribution({
      ...parseResult.data,
      apiKeyId: req.apiKey!.id
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Research demographics endpoint failed', {
      route: 'GET /api/research/demographics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve demographics data'
    });
  }
});

/**
 * GET /api/research/perm
 * PERM sampling and error rate data
 */
router.get('/perm', requireApiKey('research:perm'), async (req: Request, res: Response) => {
  try {
    const parseResult = researchQuerySchema.safeParse(req.query);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parseResult.error.errors
      });
    }
    
    const result = await researchAggregationService.getPermResearchData({
      ...parseResult.data,
      apiKeyId: req.apiKey!.id
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Research PERM endpoint failed', {
      route: 'GET /api/research/perm',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve PERM data'
    });
  }
});

/**
 * GET /api/research/per-metrics
 * Payment Error Reduction effectiveness metrics
 */
router.get('/per-metrics', requireApiKey('research:perm'), async (req: Request, res: Response) => {
  try {
    const parseResult = researchQuerySchema.safeParse(req.query);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parseResult.error.errors
      });
    }
    
    const result = await researchAggregationService.getPerResearchMetrics({
      ...parseResult.data,
      apiKeyId: req.apiKey!.id
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Research PER metrics endpoint failed', {
      route: 'GET /api/research/per-metrics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve PER metrics'
    });
  }
});

/**
 * GET /api/research/all
 * Comprehensive research data export (all metrics combined)
 * Requires research:all scope
 */
router.get('/all', requireApiKey('research:all'), async (req: Request, res: Response) => {
  try {
    const parseResult = researchQuerySchema.safeParse(req.query);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parseResult.error.errors
      });
    }
    
    const params = {
      ...parseResult.data,
      apiKeyId: req.apiKey!.id
    };
    
    const [eligibility, outcomes, demographics, perm, perMetrics] = await Promise.all([
      researchAggregationService.getEligibilityStats(params),
      researchAggregationService.getOutcomeStats(params),
      researchAggregationService.getDemographicDistribution(params),
      researchAggregationService.getPermResearchData(params),
      researchAggregationService.getPerResearchMetrics(params)
    ]);
    
    res.json({
      success: true,
      data: {
        eligibility: eligibility.data,
        outcomes: outcomes.data,
        demographics: demographics.data,
        perm: perm.data,
        perMetrics: perMetrics.data
      },
      metadata: {
        queryTime: Math.max(
          eligibility.metadata.queryTime,
          outcomes.metadata.queryTime,
          demographics.metadata.queryTime,
          perm.metadata.queryTime,
          perMetrics.metadata.queryTime
        ),
        dataFreshness: new Date().toISOString(),
        aggregationLevel: 'comprehensive'
      }
    });
    
  } catch (error) {
    logger.error('Research all endpoint failed', {
      route: 'GET /api/research/all',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve comprehensive research data'
    });
  }
});

export default router;
