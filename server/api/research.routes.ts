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

router.use(trackApiUsage());

const researchQuerySchema = z.object({
  stateCode: z.string().min(2).max(2).optional(),
  startDate: z.string().optional().transform((val, ctx) => {
    if (!val) return undefined;
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Invalid date format for startDate' });
      return z.NEVER;
    }
    return date;
  }),
  endDate: z.string().optional().transform((val, ctx) => {
    if (!val) return undefined;
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Invalid date format for endDate' });
      return z.NEVER;
    }
    return date;
  }),
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
 * Comprehensive research data export - returns data only for scopes the API key has
 * Uses requireApiKey() without scope param to just authenticate, then checks scopes in handler
 */
router.get('/all', requireApiKey(), async (req: Request, res: Response) => {
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
    
    const apiKeyScopes = req.apiKey!.scopes || [];
    const hasAllScope = apiKeyScopes.includes('research:all');
    
    const hasEligibility = hasAllScope || apiKeyScopes.includes('research:eligibility');
    const hasOutcomes = hasAllScope || apiKeyScopes.includes('research:outcomes');
    const hasDemographics = hasAllScope || apiKeyScopes.includes('research:demographics');
    const hasPerm = hasAllScope || apiKeyScopes.includes('research:perm');
    
    if (!hasEligibility && !hasOutcomes && !hasDemographics && !hasPerm) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'At least one research scope required (research:eligibility, research:outcomes, research:demographics, research:perm, or research:all)',
        code: 'INSUFFICIENT_SCOPE',
        availableScopes: apiKeyScopes
      });
    }
    
    const results: {
      eligibility?: any;
      outcomes?: any;
      demographics?: any;
      perm?: any;
      perMetrics?: any;
    } = {};
    const queryTimes: number[] = [];
    const includedScopes: string[] = [];
    
    const promises: Promise<void>[] = [];
    
    if (hasEligibility) {
      promises.push(
        researchAggregationService.getEligibilityStats(params).then(r => {
          results.eligibility = r.data;
          queryTimes.push(r.metadata.queryTime);
          includedScopes.push('eligibility');
        })
      );
    }
    
    if (hasOutcomes) {
      promises.push(
        researchAggregationService.getOutcomeStats(params).then(r => {
          results.outcomes = r.data;
          queryTimes.push(r.metadata.queryTime);
          includedScopes.push('outcomes');
        })
      );
    }
    
    if (hasDemographics) {
      promises.push(
        researchAggregationService.getDemographicDistribution(params).then(r => {
          results.demographics = r.data;
          queryTimes.push(r.metadata.queryTime);
          includedScopes.push('demographics');
        })
      );
    }
    
    if (hasPerm) {
      promises.push(
        researchAggregationService.getPermResearchData(params).then(r => {
          results.perm = r.data;
          queryTimes.push(r.metadata.queryTime);
          includedScopes.push('perm');
        }),
        researchAggregationService.getPerResearchMetrics(params).then(r => {
          results.perMetrics = r.data;
          queryTimes.push(r.metadata.queryTime);
        })
      );
    }
    
    await Promise.all(promises);
    
    res.json({
      success: true,
      data: results,
      metadata: {
        queryTime: Math.max(...queryTimes, 0),
        dataFreshness: new Date().toISOString(),
        aggregationLevel: 'comprehensive',
        includedScopes,
        note: includedScopes.length < 4 
          ? 'Some datasets excluded due to API key scope restrictions' 
          : undefined
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
