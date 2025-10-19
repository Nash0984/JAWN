import type { Express, Request, Response } from "express";
import { crossStateRulesEngine } from "../services/CrossStateRulesEngine";
import { storage } from "../storage";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireStaff } from "../middleware/auth";
import { z } from "zod";
import { 
  insertCrossStateRuleSchema,
  insertJurisdictionHierarchySchema,
  insertStateReciprocityAgreementSchema,
} from "@shared/schema";

/**
 * Cross-State Rules API Endpoints
 * Handles jurisdiction-specific rule resolution and benefit coordination
 */

// Request validation schemas
const analyzeHouseholdSchema = z.object({
  householdId: z.string(),
  forceReanalysis: z.boolean().optional(),
});

const resolveConflictSchema = z.object({
  householdId: z.string(),
  strategy: z.enum([
    "primary_residence",
    "work_state", 
    "most_favorable",
    "federal_override",
    "reciprocity",
    "manual_review"
  ]),
  notes: z.string().optional(),
});

const checkPortabilitySchema = z.object({
  fromState: z.string().length(2),
  toState: z.string().length(2),
  programId: z.string(),
});

const borderWorkerBenefitsSchema = z.object({
  householdId: z.string(),
  residenceState: z.string().length(2),
  workState: z.string().length(2),
});

export function registerCrossStateRulesRoutes(app: Express) {
  // ============================================================================
  // Household Analysis Endpoints
  // ============================================================================

  /**
   * POST /api/cross-state-rules/analyze
   * Analyze household for cross-state issues and conflicts
   */
  app.post("/api/cross-state-rules/analyze", 
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const data = analyzeHouseholdSchema.parse(req.body);
      
      const analysis = await crossStateRulesEngine.analyzeHousehold(data.householdId);
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "ANALYZE_CROSS_STATE",
        resource: "household",
        resourceId: data.householdId,
        details: {
          scenario: analysis.scenario,
          conflictsFound: analysis.conflicts.length,
          requiresReview: analysis.requiresReview
        },
        success: true,
        ipAddress: req.ip || "unknown",
        userAgent: req.get("user-agent") || "unknown",
      });

      res.json({
        success: true,
        data: analysis
      });
    })
  );

  /**
   * GET /api/cross-state-rules/conflicts/:householdId
   * Get rule conflicts for a specific household
   */
  app.get("/api/cross-state-rules/conflicts/:householdId",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { householdId } = req.params;
      
      const conflicts = await crossStateRulesEngine.getConflicts(householdId);
      
      res.json({
        success: true,
        data: {
          householdId,
          conflicts,
          totalConflicts: conflicts.length,
          criticalConflicts: conflicts.filter(c => c.severity === "critical").length
        }
      });
    })
  );

  /**
   * POST /api/cross-state-rules/resolve
   * Resolve conflicts with a specific strategy
   */
  app.post("/api/cross-state-rules/resolve",
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const data = resolveConflictSchema.parse(req.body);
      
      const resolution = await crossStateRulesEngine.resolveWithStrategy(
        data.householdId,
        data.strategy as any,
        req.user!.id
      );

      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "RESOLVE_CROSS_STATE_CONFLICT",
        resource: "household",
        resourceId: data.householdId,
        details: {
          strategy: data.strategy,
          notes: data.notes,
          resolution
        },
        success: true,
        ipAddress: req.ip || "unknown",
        userAgent: req.get("user-agent") || "unknown",
      });
      
      res.json({
        success: true,
        data: resolution
      });
    })
  );

  // ============================================================================
  // Portability and Border Worker Endpoints
  // ============================================================================

  /**
   * GET /api/cross-state-rules/portability/:fromState/:toState
   * Check benefit portability between states
   */
  app.get("/api/cross-state-rules/portability/:fromState/:toState",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { fromState, toState } = req.params;
      const { programId } = req.query;
      
      if (!programId || typeof programId !== 'string') {
        return res.status(400).json({
          success: false,
          error: "programId query parameter is required"
        });
      }
      
      const analysis = await crossStateRulesEngine.checkPortability(
        fromState.toUpperCase(),
        toState.toUpperCase(),
        programId
      );
      
      res.json({
        success: true,
        data: analysis
      });
    })
  );

  /**
   * POST /api/cross-state-rules/border-worker
   * Calculate benefits for cross-border workers
   */
  app.post("/api/cross-state-rules/border-worker",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const data = borderWorkerBenefitsSchema.parse(req.body);
      
      const benefits = await crossStateRulesEngine.calculateBorderWorkerBenefits(
        data.householdId,
        data.residenceState.toUpperCase(),
        data.workState.toUpperCase()
      );
      
      res.json({
        success: true,
        data: benefits
      });
    })
  );

  // ============================================================================
  // Rule Management Endpoints (Admin Only)
  // ============================================================================

  /**
   * GET /api/cross-state-rules/rules
   * Get all cross-state rules
   */
  app.get("/api/cross-state-rules/rules",
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const { primaryState, ruleType, resolutionStrategy, isActive } = req.query;
      
      const rules = await storage.getCrossStateRules({
        primaryState: primaryState as string,
        ruleType: ruleType as string,
        resolutionStrategy: resolutionStrategy as string,
        isActive: isActive === 'true'
      });
      
      res.json({
        success: true,
        data: rules
      });
    })
  );

  /**
   * POST /api/cross-state-rules/rules
   * Create a new cross-state rule
   */
  app.post("/api/cross-state-rules/rules",
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const data = insertCrossStateRuleSchema.parse(req.body);
      
      const rule = await storage.createCrossStateRule(data);
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "CREATE_CROSS_STATE_RULE",
        resource: "cross_state_rule",
        resourceId: rule.id,
        details: { ruleCode: rule.ruleCode, ruleType: rule.ruleType },
        success: true,
        ipAddress: req.ip || "unknown",
        userAgent: req.get("user-agent") || "unknown",
      });
      
      res.json({
        success: true,
        data: rule
      });
    })
  );

  /**
   * PUT /api/cross-state-rules/rules/:id
   * Update a cross-state rule
   */
  app.put("/api/cross-state-rules/rules/:id",
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      
      const rule = await storage.updateCrossStateRule(id, req.body);
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "UPDATE_CROSS_STATE_RULE",
        resource: "cross_state_rule",
        resourceId: id,
        details: { updates: req.body },
        success: true,
        ipAddress: req.ip || "unknown",
        userAgent: req.get("user-agent") || "unknown",
      });
      
      res.json({
        success: true,
        data: rule
      });
    })
  );

  /**
   * DELETE /api/cross-state-rules/rules/:id
   * Delete a cross-state rule
   */
  app.delete("/api/cross-state-rules/rules/:id",
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      
      await storage.deleteCrossStateRule(id);
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "DELETE_CROSS_STATE_RULE",
        resource: "cross_state_rule",
        resourceId: id,
        details: {},
        success: true,
        ipAddress: req.ip || "unknown",
        userAgent: req.get("user-agent") || "unknown",
      });
      
      res.json({
        success: true,
        message: "Rule deleted successfully"
      });
    })
  );

  // ============================================================================
  // Jurisdiction Hierarchy Endpoints
  // ============================================================================

  /**
   * GET /api/cross-state-rules/jurisdictions
   * Get jurisdiction hierarchy
   */
  app.get("/api/cross-state-rules/jurisdictions",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { state, county, city } = req.query;
      
      if (state) {
        const hierarchy = await crossStateRulesEngine.getJurisdictionHierarchy(
          state as string,
          county as string,
          city as string
        );
        
        res.json({
          success: true,
          data: hierarchy
        });
      } else {
        // Get all jurisdictions
        const jurisdictions = await storage.getJurisdictionHierarchies({
          isActive: true
        });
        
        res.json({
          success: true,
          data: jurisdictions
        });
      }
    })
  );

  /**
   * POST /api/cross-state-rules/jurisdictions
   * Create a new jurisdiction
   */
  app.post("/api/cross-state-rules/jurisdictions",
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const data = insertJurisdictionHierarchySchema.parse(req.body);
      
      const jurisdiction = await storage.createJurisdictionHierarchy(data);
      
      res.json({
        success: true,
        data: jurisdiction
      });
    })
  );

  // ============================================================================
  // Reciprocity Agreement Endpoints
  // ============================================================================

  /**
   * GET /api/cross-state-rules/reciprocity
   * Get reciprocity agreements
   */
  app.get("/api/cross-state-rules/reciprocity",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { stateA, stateB, state, agreementType } = req.query;
      
      if (stateA && stateB) {
        // Check specific agreement between two states
        const agreement = await crossStateRulesEngine.checkReciprocityAgreement(
          stateA as string,
          stateB as string
        );
        
        res.json({
          success: true,
          data: agreement
        });
      } else {
        // Get all agreements matching filters
        const agreements = await storage.getReciprocityAgreements({
          state: state as string,
          agreementType: agreementType as string,
          isActive: true
        });
        
        res.json({
          success: true,
          data: agreements
        });
      }
    })
  );

  /**
   * POST /api/cross-state-rules/reciprocity
   * Create a new reciprocity agreement
   */
  app.post("/api/cross-state-rules/reciprocity",
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const data = insertStateReciprocityAgreementSchema.parse(req.body);
      
      const agreement = await storage.createReciprocityAgreement(data);
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "CREATE_RECIPROCITY_AGREEMENT",
        resource: "reciprocity_agreement",
        resourceId: agreement.id,
        details: {
          stateA: agreement.stateA,
          stateB: agreement.stateB,
          agreementType: agreement.agreementType
        },
        success: true,
        ipAddress: req.ip || "unknown",
        userAgent: req.get("user-agent") || "unknown",
      });
      
      res.json({
        success: true,
        data: agreement
      });
    })
  );

  // ============================================================================
  // Multi-State Household Endpoints
  // ============================================================================

  /**
   * GET /api/cross-state-rules/multi-state-households
   * Get multi-state households
   */
  app.get("/api/cross-state-rules/multi-state-households",
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const { scenario, status, reviewRequired } = req.query;
      
      const households = await storage.getMultiStateHouseholds({
        scenario: scenario as string,
        status: status as string,
        reviewRequired: reviewRequired === 'true'
      });
      
      res.json({
        success: true,
        data: {
          households,
          totalCount: households.length,
          pendingReview: households.filter(h => h.reviewRequired).length,
          byScenario: households.reduce((acc, h) => {
            acc[h.scenario] = (acc[h.scenario] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      });
    })
  );

  /**
   * GET /api/cross-state-rules/multi-state-households/:householdId
   * Get specific multi-state household details
   */
  app.get("/api/cross-state-rules/multi-state-households/:householdId",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { householdId } = req.params;
      
      const multiStateHousehold = await storage.getMultiStateHouseholdByHouseholdId(householdId);
      
      if (!multiStateHousehold) {
        return res.status(404).json({
          success: false,
          error: "Multi-state household record not found"
        });
      }
      
      // Get associated rule applications
      const ruleApplications = await storage.getCrossStateRuleApplications({
        householdId
      });
      
      res.json({
        success: true,
        data: {
          household: multiStateHousehold,
          ruleApplications
        }
      });
    })
  );

  /**
   * PUT /api/cross-state-rules/multi-state-households/:id/review
   * Mark multi-state household as reviewed
   */
  app.put("/api/cross-state-rules/multi-state-households/:id/review",
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { notes } = req.body;
      
      const household = await storage.updateMultiStateHousehold(id, {
        reviewRequired: false,
        lastReviewedBy: req.user!.id,
        lastReviewedAt: new Date(),
        resolutionNotes: notes
      });
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "REVIEW_MULTI_STATE_HOUSEHOLD",
        resource: "multi_state_household",
        resourceId: id,
        details: { notes },
        success: true,
        ipAddress: req.ip || "unknown",
        userAgent: req.get("user-agent") || "unknown",
      });
      
      res.json({
        success: true,
        data: household
      });
    })
  );

  // ============================================================================
  // Special Scenario Endpoints
  // ============================================================================

  /**
   * POST /api/cross-state-rules/special/nyc-ny
   * Handle NYC vs NY State distinction
   */
  app.post("/api/cross-state-rules/special/nyc-ny",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { householdId } = req.body;
      
      const resolution = await crossStateRulesEngine.resolveNYCvsNYState(householdId);
      
      res.json({
        success: true,
        data: resolution
      });
    })
  );

  /**
   * POST /api/cross-state-rules/special/dc-federal
   * Handle DC federal employee special rules
   */
  app.post("/api/cross-state-rules/special/dc-federal",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const { householdId, employeeDetails } = req.body;
      
      const resolution = await crossStateRulesEngine.resolveDCFederalEmployee(
        householdId,
        employeeDetails
      );
      
      res.json({
        success: true,
        data: resolution
      });
    })
  );

  // ============================================================================
  // Statistics and Analytics
  // ============================================================================

  /**
   * GET /api/cross-state-rules/statistics
   * Get cross-state rules statistics
   */
  app.get("/api/cross-state-rules/statistics",
    requireStaff,
    asyncHandler(async (req: Request, res: Response) => {
      // Get all multi-state households
      const households = await storage.getMultiStateHouseholds();
      
      // Get all rule applications
      const applications = await storage.getCrossStateRuleApplications();
      
      // Calculate statistics
      const statistics = {
        totalMultiStateHouseholds: households.length,
        byScenario: households.reduce((acc, h) => {
          acc[h.scenario] = (acc[h.scenario] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byStatus: households.reduce((acc, h) => {
          acc[h.status] = (acc[h.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        pendingReview: households.filter(h => h.reviewRequired).length,
        totalRuleApplications: applications.length,
        byOutcome: applications.reduce((acc, a) => {
          acc[a.outcome] = (acc[a.outcome] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        topStates: households.reduce((acc, h) => {
          acc[h.primaryResidenceState] = (acc[h.primaryResidenceState] || 0) + 1;
          if (h.workState) {
            acc[h.workState] = (acc[h.workState] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>)
      };
      
      res.json({
        success: true,
        data: statistics
      });
    })
  );
}