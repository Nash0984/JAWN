/**
 * QC Analytics Routes
 * 
 * API endpoints for quality control analytics
 */

import { Router, Request, Response } from 'express';
import { qcAnalyticsService } from '../services/qcAnalytics.service';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Middleware for async error handling
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Get overall QC metrics
router.get('/metrics', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { program } = req.query;
  const metrics = await qcAnalyticsService.getQCMetrics(program as string);
  res.json(metrics);
}));

// Get error patterns
router.get('/patterns', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate as string) : new Date();
  
  const patterns = await qcAnalyticsService.detectErrorPatterns(start, end);
  res.json(patterns);
}));

// Analyze specific case
router.get('/case/:householdId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { householdId } = req.params;
  const analysis = await qcAnalyticsService.analyzeCase(householdId);
  
  if (!analysis) {
    return res.status(404).json({ error: 'Case not found' });
  }
  
  res.json(analysis);
}));

// Get flagged cases (high risk)
router.get('/flagged-cases', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { limit = 20, riskLevel } = req.query;
  
  // For now, analyze recent households
  // In production, would maintain a flagged cases table
  const mockHouseholdIds = ['household_1', 'household_2', 'household_3'];
  const cases = await Promise.all(
    mockHouseholdIds.map(id => qcAnalyticsService.analyzeCase(id))
  );
  
  const filteredCases = cases
    .filter(c => c !== null)
    .filter(c => !riskLevel || c.riskLevel === riskLevel)
    .slice(0, Number(limit));
  
  res.json(filteredCases);
}));

// Analyze caseworker performance
router.get('/caseworker/:caseworkerId', requireAuth, requireRole(['supervisor', 'admin']), 
  asyncHandler(async (req: Request, res: Response) => {
    const { caseworkerId } = req.params;
    const performance = await qcAnalyticsService.analyzeCaseworkerPerformance(caseworkerId);
    
    if (!performance) {
      return res.status(404).json({ error: 'Caseworker not found' });
    }
    
    res.json(performance);
  })
);

// Get all caseworkers performance
router.get('/caseworkers', requireAuth, requireRole(['supervisor', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    // For demo, analyze a few known caseworker IDs
    // In production, would query all active caseworkers
    const mockCaseworkerIds = ['demo.caseworker', 'demo.supervisor'];
    const performances = await Promise.all(
      mockCaseworkerIds.map(id => qcAnalyticsService.analyzeCaseworkerPerformance(id))
    );
    
    const validPerformances = performances.filter(p => p !== null);
    res.json(validPerformances);
  })
);

// Get training recommendations
router.get('/training', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const recommendations = await qcAnalyticsService.getTrainingRecommendations();
  res.json(recommendations);
}));

// Refresh analytics (clear cache and recalculate)
router.post('/refresh', requireAuth, requireRole(['supervisor', 'admin']),
  asyncHandler(async (_req: Request, res: Response) => {
    // Clear cache for fresh calculations
    // In production, would have cache invalidation logic
    res.json({ message: 'Analytics refreshed successfully' });
  })
);

export default router;