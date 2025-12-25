/**
 * Cross-Enrollment Intelligence API Routes
 * 
 * Routes for analyzing tax data to identify unclaimed benefit opportunities
 */

import { Router, Request, Response } from 'express';
import { crossEnrollmentIntelligenceService } from '../services/crossEnrollmentIntelligence';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Analyze tax data for benefit opportunities
router.post('/analyze-tax', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { taxInput, taxResult } = req.body;
  
  const opportunities = await crossEnrollmentIntelligenceService.analyzeTaxForBenefits(
    taxInput,
    taxResult
  );
  
  res.json({
    success: true,
    opportunities,
    totalPotentialValue: opportunities.reduce(
      (sum, o) => sum + (o.recommendation.estimatedValue || 0), 
      0
    )
  });
}));

// Analyze benefits for tax credit opportunities
router.post('/analyze-benefits', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { benefitProfile } = req.body;
  
  const opportunities = await crossEnrollmentIntelligenceService.analyzeBenefitsForTax(
    benefitProfile
  );
  
  res.json({
    success: true,
    opportunities,
    estimatedTaxSavings: opportunities.reduce(
      (sum, o) => sum + (o.recommendation.estimatedValue || 0), 
      0
    )
  });
}));

// Generate full cross-enrollment analysis
router.post('/full-analysis', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { taxInput, benefitProfile } = req.body;
  
  const analysis = await crossEnrollmentIntelligenceService.generateFullAnalysis(
    taxInput,
    benefitProfile
  );
  
  res.json({
    success: true,
    analysis
  });
}));

// Get high-priority opportunities
router.post('/high-priority', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { taxInput, benefitProfile } = req.body;
  
  const analysis = await crossEnrollmentIntelligenceService.generateFullAnalysis(
    taxInput,
    benefitProfile
  );
  
  const highPriority = analysis.opportunities.filter(o => o.priority === 'high');
  
  res.json({
    success: true,
    opportunities: highPriority,
    count: highPriority.length,
    totalValue: highPriority.reduce(
      (sum, o) => sum + (o.recommendation.estimatedValue || 0), 
      0
    )
  });
}));

// Get automation-eligible opportunities
router.post('/auto-eligible', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { taxInput, benefitProfile } = req.body;
  
  const analysis = await crossEnrollmentIntelligenceService.generateFullAnalysis(
    taxInput,
    benefitProfile
  );
  
  const autoEligible = analysis.opportunities.filter(
    o => o.recommendation.automationAvailable
  );
  
  res.json({
    success: true,
    opportunities: autoEligible,
    count: autoEligible.length
  });
}));

// Get opportunities by category
router.post('/by-category/:category', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.params;
  const { taxInput, benefitProfile } = req.body;
  
  const analysis = await crossEnrollmentIntelligenceService.generateFullAnalysis(
    taxInput,
    benefitProfile
  );
  
  const filtered = analysis.opportunities.filter(
    o => o.category.toLowerCase() === category.toLowerCase()
  );
  
  res.json({
    success: true,
    category,
    opportunities: filtered
  });
}));

// Get navigator notes for opportunities
router.post('/navigator-notes', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { taxInput, benefitProfile } = req.body;
  
  const analysis = await crossEnrollmentIntelligenceService.generateFullAnalysis(
    taxInput,
    benefitProfile
  );
  
  const notes = analysis.opportunities.map(o => ({
    program: o.recommendation.program,
    priority: o.priority,
    notes: o.navigatorNotes,
    action: o.recommendation.action
  }));
  
  res.json({
    success: true,
    notes
  });
}));

export default router;