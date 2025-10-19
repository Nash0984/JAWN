/**
 * Benefits Navigation API Routes
 * 
 * Routes for discovering hidden benefit pathways and multi-program enrollment strategies
 */

import { Router, Request, Response } from 'express';
import { benefitsNavigationService } from '../services/benefitsNavigation.service';
import { requireAuth } from '../middleware/auth';
import type { HouseholdSituation } from '../services/benefitsNavigation.service';

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Analyze household and discover benefit pathways
router.post('/analyze', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const situation: HouseholdSituation = {
    householdSize: req.body.householdSize || 1,
    monthlyIncome: req.body.monthlyIncome || 0,
    hasChildren: req.body.hasChildren || false,
    hasElderly: req.body.hasElderly || false,
    hasDisabled: req.body.hasDisabled || false,
    currentBenefits: req.body.currentBenefits || [],
    county: req.body.county || 'Baltimore',
    housingStatus: req.body.housingStatus || 'rented',
    employmentStatus: req.body.employmentStatus || ['unknown'],
    barriers: req.body.barriers
  };
  
  const analysis = await benefitsNavigationService.analyzeHousehold(situation);
  res.json({
    success: true,
    analysis
  });
}));

// Get pathway recommendations for a specific case
router.get('/case/:caseId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { caseId } = req.params;
  const recommendations = await benefitsNavigationService.getRecommendationsForCase(caseId);
  
  res.json({
    success: true,
    caseId,
    pathways: recommendations
  });
}));

// Get quick wins for a household
router.post('/quick-wins', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const situation: HouseholdSituation = req.body;
  const analysis = await benefitsNavigationService.analyzeHousehold(situation);
  
  res.json({
    success: true,
    quickWins: analysis.quickWins,
    estimatedValue: analysis.estimatedNewBenefits
  });
}));

// Get strategic pathways (complex but valuable)
router.post('/strategic', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const situation: HouseholdSituation = req.body;
  const analysis = await benefitsNavigationService.analyzeHousehold(situation);
  
  res.json({
    success: true,
    strategicOptions: analysis.strategicOptions,
    totalPotentialValue: analysis.strategicOptions.reduce((sum, p) => sum + p.estimatedTotalValue, 0)
  });
}));

export default router;