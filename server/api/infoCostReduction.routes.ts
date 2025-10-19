/**
 * Info Cost Reduction API Routes
 * 
 * Routes for simplifying complex policy documents and reducing cognitive burden
 */

import { Router, Request, Response } from 'express';
import { infoCostReductionService } from '../services/infoCostReduction.service';
import { requireAuth } from '../middleware/auth';
import type { SimplificationRequest } from '../services/infoCostReduction.service';

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Simplify complex text
router.post('/simplify', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const request: SimplificationRequest = {
    text: req.body.text,
    targetReadingLevel: req.body.targetReadingLevel || 6,
    targetLanguage: req.body.targetLanguage,
    context: req.body.context,
    includeExamples: req.body.includeExamples || false,
    includeVisuals: req.body.includeVisuals || false
  };
  
  const simplified = await infoCostReductionService.simplifyText(request);
  
  res.json({
    success: true,
    simplified
  });
}));

// Explain a policy section
router.post('/explain', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { policyText, userContext } = req.body;
  
  const explanation = await infoCostReductionService.explainPolicy(policyText, userContext);
  
  res.json({
    success: true,
    explanation
  });
}));

// Create decision tree from rules
router.post('/decision-tree', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { rules } = req.body;
  
  const decisionTree = await infoCostReductionService.createDecisionTree(rules);
  
  res.json({
    success: true,
    decisionTree
  });
}));

// Translate and simplify in one step
router.post('/translate', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { text, targetLanguage, targetReadingLevel } = req.body;
  
  const translated = await infoCostReductionService.translateAndSimplify(
    text,
    targetLanguage,
    targetReadingLevel || 6
  );
  
  res.json({
    success: true,
    translated
  });
}));

// Get service metrics
router.get('/metrics', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const metrics = await infoCostReductionService.getMetrics();
  
  res.json({
    success: true,
    metrics
  });
}));

// Batch simplify multiple texts
router.post('/batch-simplify', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { texts, targetReadingLevel, targetLanguage } = req.body;
  
  const results = await Promise.all(
    texts.map((text: string) => 
      infoCostReductionService.simplifyText({
        text,
        targetReadingLevel: targetReadingLevel || 6,
        targetLanguage
      })
    )
  );
  
  res.json({
    success: true,
    results,
    totalTimeSaved: results.reduce((sum, r) => sum + r.estimatedTimeSaved, 0)
  });
}));

// Get most confusing terms
router.get('/confusing-terms', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const metrics = await infoCostReductionService.getMetrics();
  
  res.json({
    success: true,
    terms: metrics.mostConfusingTerms
  });
}));

export default router;