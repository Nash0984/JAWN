/**
 * Decision Points API Routes
 * 
 * Routes for identifying critical intervention moments in benefits lifecycle
 */

import { Router, Request, Response } from 'express';
import { decisionPointsService } from '../services/decisionPoints.service';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Scan all cases for decision points
router.get('/scan', requireAuth, requireRole(['caseworker', 'supervisor', 'admin']), 
  asyncHandler(async (_req: Request, res: Response) => {
    const analysis = await decisionPointsService.scanForDecisionPoints();
    
    res.json({
      success: true,
      analysis
    });
  })
);

// Get decision points for a specific case
router.get('/case/:caseId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { caseId } = req.params;
  const points = await decisionPointsService.getDecisionPointsForCase(caseId);
  
  res.json({
    success: true,
    caseId,
    decisionPoints: points
  });
}));

// Get critical points requiring immediate attention
router.get('/critical', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const analysis = await decisionPointsService.scanForDecisionPoints();
  
  res.json({
    success: true,
    criticalPoints: analysis.criticalPoints,
    totalAtRisk: analysis.summary.totalBenefitsAtRisk
  });
}));

// Get upcoming renewals
router.get('/renewals', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const analysis = await decisionPointsService.scanForDecisionPoints();
  
  const upcomingRenewals = analysis.upcomingRenewals.filter(
    r => r.daysUntilAction <= days
  );
  
  res.json({
    success: true,
    renewals: upcomingRenewals,
    count: upcomingRenewals.length
  });
}));

// Get cliff effect warnings
router.get('/cliff-effects', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const analysis = await decisionPointsService.scanForDecisionPoints();
  
  res.json({
    success: true,
    cliffWarnings: analysis.cliffEffectWarnings,
    totalAtRisk: analysis.cliffEffectWarnings.reduce((sum, w) => sum + w.potentialLoss, 0)
  });
}));

// Schedule an intervention for a decision point
router.post('/intervene/:pointId', requireAuth, requireRole(['caseworker', 'supervisor']),
  asyncHandler(async (req: Request, res: Response) => {
    const { pointId } = req.params;
    const { intervention } = req.body;
    
    const scheduled = await decisionPointsService.scheduleIntervention(pointId, intervention);
    
    res.json({
      success: scheduled,
      message: scheduled ? 'Intervention scheduled' : 'Failed to schedule intervention'
    });
  })
);

// Get intervention recommendations
router.get('/interventions', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const analysis = await decisionPointsService.scanForDecisionPoints();
  
  res.json({
    success: true,
    interventions: analysis.interventions,
    automationOpportunities: analysis.summary.automationOpportunities
  });
}));

export default router;