/**
 * Multi-State Rules API Routes
 * 
 * Routes for handling cross-jurisdiction benefit rules and interstate coordination
 */

import { Router, Request, Response } from 'express';
import { multiStateRulesService } from '../services/multiStateRules.service';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Compare rules between two states
router.post('/compare', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { program, state1, state2, householdProfile } = req.body;
  
  const comparison = await multiStateRulesService.compareStates(
    program,
    state1,
    state2,
    householdProfile
  );
  
  res.json({
    success: true,
    comparison
  });
}));

// Analyze portability when moving between states
router.post('/portability', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { fromState, toState, currentBenefits, moveDate } = req.body;
  
  const analysis = await multiStateRulesService.analyzePortability(
    fromState,
    toState,
    currentBenefits || [],
    moveDate ? new Date(moveDate) : undefined
  );
  
  res.json({
    success: true,
    analysis
  });
}));

// Analyze border county advantages
router.get('/border-county/:county', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { county } = req.params;
  const { state } = req.query;
  
  const advantages = await multiStateRulesService.analyzeBorderCountyAdvantages(
    county,
    (state as string) || 'MD'
  );
  
  res.json({
    success: true,
    advantages
  });
}));

// Get state comparison for all neighboring states
router.get('/neighbors/:state/:program', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { state, program } = req.params;
  const neighbors = ['DC', 'PA', 'VA', 'WV', 'DE'];
  
  const comparisons = await Promise.all(
    neighbors.map(neighbor => 
      multiStateRulesService.compareStates(program, state, neighbor)
    )
  );
  
  res.json({
    success: true,
    state,
    program,
    comparisons
  });
}));

// Get optimal move timing
router.post('/move-timing', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { fromState, toState, currentBenefits, proposedDate } = req.body;
  
  const analysis = await multiStateRulesService.analyzePortability(
    fromState,
    toState,
    currentBenefits || [],
    proposedDate ? new Date(proposedDate) : undefined
  );
  
  res.json({
    success: true,
    optimalWindow: analysis.optimalMoveWindow,
    monthlyImpact: analysis.monthlyImpact
  });
}));

// Get reciprocity information
router.get('/reciprocity/:program', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { program } = req.params;
  const { state1, state2 } = req.query;
  
  if (state1 && state2) {
    const comparison = await multiStateRulesService.compareStates(
      program,
      state1 as string,
      state2 as string
    );
    
    res.json({
      success: true,
      hasReciprocity: comparison.reciprocityAvailable,
      details: comparison.portabilityRules
    });
  } else {
    // Return general reciprocity info
    res.json({
      success: true,
      message: 'Provide state1 and state2 query parameters for specific reciprocity check'
    });
  }
}));

// Get pre-move checklist
router.post('/pre-move-checklist', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { fromState, toState, currentBenefits } = req.body;
  
  const analysis = await multiStateRulesService.analyzePortability(
    fromState,
    toState,
    currentBenefits || []
  );
  
  res.json({
    success: true,
    checklist: analysis.preMoveChecklist
  });
}));

// Get post-move checklist
router.post('/post-move-checklist', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { fromState, toState, currentBenefits } = req.body;
  
  const analysis = await multiStateRulesService.analyzePortability(
    fromState,
    toState,
    currentBenefits || []
  );
  
  res.json({
    success: true,
    checklist: analysis.postMoveChecklist
  });
}));

export default router;