/**
 * Multi-State Office Architecture Routes
 * 
 * API endpoints for managing:
 * - State Tenants (compliance boundary)
 * - Offices (operational units within states)
 * - Routing Rules (case assignment logic)
 * - Office Roles (user-office assignments)
 * - KMS Key Management (encryption key rotation)
 * 
 * Compliance: NIST AC-4 (tenant isolation), IRS Pub 1075, HIPAA, FedRAMP
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { stateTenants, offices, routingRules, officeRoles } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";
import { detectStateTenantContext, enforceStateTenantIsolation } from "../middleware/tenantMiddleware";
import { KMSService } from "../services/kms.service";
import { OfficeRoutingService } from "../services/officeRouting.service";
import { logger } from "../services/logger.service";

const router = Router();

// Apply auth and state tenant detection to all routes
router.use(requireAuth);
router.use(detectStateTenantContext);

// ============================================================================
// STATE TENANT ENDPOINTS
// ============================================================================

/**
 * GET /api/multi-state/tenants
 * List state tenants (super_admin sees all, admin sees only their assigned state)
 * COMPLIANCE: NIST AC-4 - Enforces state-level tenant isolation boundary
 */
router.get("/tenants", requireRole("admin", "super_admin"), async (req: Request, res: Response) => {
  try {
    let allStateTenants;
    
    // Super admins can see all state tenants
    if (req.user?.role === "super_admin") {
      allStateTenants = await db.select().from(stateTenants).orderBy(desc(stateTenants.createdAt));
    } else {
      // Regular admins can only see their assigned state tenant
      if (!req.user?.stateTenantId) {
        return res.status(403).json({ 
          error: "Access denied",
          message: "User not assigned to a state tenant",
        });
      }
      
      allStateTenants = await db
        .select()
        .from(stateTenants)
        .where(eq(stateTenants.id, req.user.stateTenantId))
        .orderBy(desc(stateTenants.createdAt));
    }
    
    res.json({
      stateTenants: allStateTenants,
      total: allStateTenants.length,
    });
  } catch (error) {
    logger.error("Error fetching state tenants", {
      service: "multiStateOfficeRoutes",
      action: "listStateTenants",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to fetch state tenants",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/multi-state/tenants/:id
 * Get state tenant by ID
 */
router.get("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [stateTenant] = await db
      .select()
      .from(stateTenants)
      .where(eq(stateTenants.id, id))
      .limit(1);
    
    if (!stateTenant) {
      return res.status(404).json({ error: "State tenant not found" });
    }
    
    // Ensure user has access to this state (unless super_admin)
    if (req.user?.role !== "super_admin" && req.user?.stateTenantId !== id) {
      return res.status(403).json({ error: "Access denied to this state tenant" });
    }
    
    res.json(stateTenant);
  } catch (error) {
    logger.error("Error fetching state tenant", {
      service: "multiStateOfficeRoutes",
      action: "getStateTenant",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to fetch state tenant",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/multi-state/tenants
 * Create new state tenant (super_admin only)
 */
const createStateTenantSchema = z.object({
  stateCode: z.string().length(2), // MD, PA, VA, etc.
  stateName: z.string(),
  status: z.enum(["active", "inactive", "pending_activation", "decommissioned"]).default("pending_activation"),
  deploymentModel: z.enum(["centralized_hub", "decentralized_on_site", "hybrid"]),
  enabledPrograms: z.array(z.string()),
  complianceCertifications: z.array(z.string()).optional(),
  dataResidency: z.string().optional(),
  timezone: z.string().default("America/New_York"),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  adminNotes: z.string().optional(),
});

router.post("/tenants", requireRole("super_admin"), async (req: Request, res: Response) => {
  try {
    const data = createStateTenantSchema.parse(req.body);
    
    // Check if state tenant already exists
    const [existing] = await db
      .select()
      .from(stateTenants)
      .where(eq(stateTenants.stateCode, data.stateCode))
      .limit(1);
    
    if (existing) {
      return res.status(409).json({ 
        error: "State tenant already exists",
        message: `A tenant for state ${data.stateCode} already exists`,
      });
    }
    
    // Create state tenant
    const [newStateTenant] = await db
      .insert(stateTenants)
      .values({
        ...data,
        kmsKeyId: null, // Will be populated by KMS service
      })
      .returning();
    
    // Initialize KMS for this state tenant
    const kmsService = new KMSService();
    await kmsService.initializeStateTenant(newStateTenant.id);
    
    logger.info("Created new state tenant", {
      service: "multiStateOfficeRoutes",
      action: "createStateTenant",
      stateTenantId: newStateTenant.id,
      stateCode: data.stateCode,
      createdBy: req.user?.id,
    });
    
    res.status(201).json(newStateTenant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: error.errors,
      });
    }
    
    logger.error("Error creating state tenant", {
      service: "multiStateOfficeRoutes",
      action: "createStateTenant",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to create state tenant",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PATCH /api/multi-state/tenants/:id
 * Update state tenant (admin only)
 */
const updateStateTenantSchema = z.object({
  stateName: z.string().optional(),
  status: z.enum(["active", "inactive", "pending_activation", "decommissioned"]).optional(),
  deploymentModel: z.enum(["centralized_hub", "decentralized_on_site", "hybrid"]).optional(),
  enabledPrograms: z.array(z.string()).optional(),
  complianceCertifications: z.array(z.string()).optional(),
  dataResidency: z.string().optional(),
  timezone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  adminNotes: z.string().optional(),
});

router.patch("/tenants/:id", requireRole("admin", "super_admin"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = updateStateTenantSchema.parse(req.body);
    
    // Ensure user has access to this state (unless super_admin)
    if (req.user?.role !== "super_admin" && req.user?.stateTenantId !== id) {
      return res.status(403).json({ error: "Access denied to this state tenant" });
    }
    
    const [updated] = await db
      .update(stateTenants)
      .set(updates)
      .where(eq(stateTenants.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "State tenant not found" });
    }
    
    logger.info("Updated state tenant", {
      service: "multiStateOfficeRoutes",
      action: "updateStateTenant",
      stateTenantId: id,
      updatedBy: req.user?.id,
    });
    
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: error.errors,
      });
    }
    
    logger.error("Error updating state tenant", {
      service: "multiStateOfficeRoutes",
      action: "updateStateTenant",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to update state tenant",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================================
// OFFICE ENDPOINTS
// ============================================================================

/**
 * GET /api/multi-state/offices
 * List offices for the current state tenant
 */
router.get("/offices", enforceStateTenantIsolation, async (req: Request, res: Response) => {
  try {
    if (!req.stateTenant) {
      return res.status(400).json({ error: "No state tenant context" });
    }
    
    const allOffices = await db
      .select()
      .from(offices)
      .where(eq(offices.stateTenantId, req.stateTenant.id))
      .orderBy(offices.name);
    
    res.json({
      offices: allOffices,
      total: allOffices.length,
      stateTenant: {
        id: req.stateTenant.id,
        stateCode: req.stateTenant.stateCode,
        stateName: req.stateTenant.stateName,
      },
    });
  } catch (error) {
    logger.error("Error fetching offices", {
      service: "multiStateOfficeRoutes",
      action: "listOffices",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to fetch offices",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/multi-state/offices/:id
 * Get office by ID
 */
router.get("/offices/:id", enforceStateTenantIsolation, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [office] = await db
      .select()
      .from(offices)
      .where(eq(offices.id, id))
      .limit(1);
    
    if (!office) {
      return res.status(404).json({ error: "Office not found" });
    }
    
    // Ensure office belongs to user's state tenant
    if (req.stateTenant && office.stateTenantId !== req.stateTenant.id) {
      return res.status(403).json({ error: "Access denied to this office" });
    }
    
    res.json(office);
  } catch (error) {
    logger.error("Error fetching office", {
      service: "multiStateOfficeRoutes",
      action: "getOffice",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to fetch office",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/multi-state/offices
 * Create new office (admin only)
 */
const createOfficeSchema = z.object({
  code: z.string(),
  name: z.string(),
  officeType: z.enum(["hub", "on_site", "virtual", "mobile"]),
  status: z.enum(["active", "inactive", "pending_setup"]).default("pending_setup"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  region: z.string().optional(),
  coverage: z.array(z.string()).optional(),
  specialties: z.array(z.string()).optional(),
  enabledPrograms: z.array(z.string()).optional(),
  features: z.record(z.boolean()).optional(),
  capacity: z.object({
    maxActiveCases: z.number(),
    currentActiveCases: z.number().default(0),
  }).optional(),
});

router.post("/offices", requireRole("admin", "super_admin"), enforceStateTenantIsolation, async (req: Request, res: Response) => {
  try {
    if (!req.stateTenant) {
      return res.status(400).json({ error: "No state tenant context" });
    }
    
    const data = createOfficeSchema.parse(req.body);
    
    // Check if office with same code already exists in this state
    const [existing] = await db
      .select()
      .from(offices)
      .where(
        and(
          eq(offices.stateTenantId, req.stateTenant.id),
          eq(offices.code, data.code)
        )
      )
      .limit(1);
    
    if (existing) {
      return res.status(409).json({ 
        error: "Office code already exists",
        message: `An office with code ${data.code} already exists in this state`,
      });
    }
    
    // Create office
    const [newOffice] = await db
      .insert(offices)
      .values({
        ...data,
        stateTenantId: req.stateTenant.id,
      })
      .returning();
    
    logger.info("Created new office", {
      service: "multiStateOfficeRoutes",
      action: "createOffice",
      officeId: newOffice.id,
      officeCode: data.code,
      stateTenantId: req.stateTenant.id,
      createdBy: req.user?.id,
    });
    
    res.status(201).json(newOffice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: error.errors,
      });
    }
    
    logger.error("Error creating office", {
      service: "multiStateOfficeRoutes",
      action: "createOffice",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to create office",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PATCH /api/multi-state/offices/:id
 * Update office (admin only)
 */
const updateOfficeSchema = z.object({
  name: z.string().optional(),
  officeType: z.enum(["hub", "on_site", "virtual", "mobile"]).optional(),
  status: z.enum(["active", "inactive", "pending_setup"]).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  region: z.string().optional(),
  coverage: z.array(z.string()).optional(),
  specialties: z.array(z.string()).optional(),
  enabledPrograms: z.array(z.string()).optional(),
  features: z.record(z.boolean()).optional(),
  capacity: z.object({
    maxActiveCases: z.number().optional(),
    currentActiveCases: z.number().optional(),
  }).optional(),
});

router.patch("/offices/:id", requireRole("admin", "super_admin"), enforceStateTenantIsolation, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = updateOfficeSchema.parse(req.body);
    
    // Verify office exists and belongs to user's state tenant
    const [existing] = await db
      .select()
      .from(offices)
      .where(eq(offices.id, id))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({ error: "Office not found" });
    }
    
    if (req.stateTenant && existing.stateTenantId !== req.stateTenant.id) {
      return res.status(403).json({ error: "Access denied to this office" });
    }
    
    const [updated] = await db
      .update(offices)
      .set(updates)
      .where(eq(offices.id, id))
      .returning();
    
    logger.info("Updated office", {
      service: "multiStateOfficeRoutes",
      action: "updateOffice",
      officeId: id,
      updatedBy: req.user?.id,
    });
    
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: error.errors,
      });
    }
    
    logger.error("Error updating office", {
      service: "multiStateOfficeRoutes",
      action: "updateOffice",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to update office",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/multi-state/offices/:id
 * Deactivate office (admin only) - soft delete
 */
router.delete("/offices/:id", requireRole("admin", "super_admin"), enforceStateTenantIsolation, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verify office exists and belongs to user's state tenant
    const [existing] = await db
      .select()
      .from(offices)
      .where(eq(offices.id, id))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({ error: "Office not found" });
    }
    
    if (req.stateTenant && existing.stateTenantId !== req.stateTenant.id) {
      return res.status(403).json({ error: "Access denied to this office" });
    }
    
    // Soft delete by setting status to inactive
    await db
      .update(offices)
      .set({ status: "inactive" })
      .where(eq(offices.id, id));
    
    logger.info("Deactivated office", {
      service: "multiStateOfficeRoutes",
      action: "deleteOffice",
      officeId: id,
      deletedBy: req.user?.id,
    });
    
    res.json({ message: "Office deactivated successfully" });
  } catch (error) {
    logger.error("Error deleting office", {
      service: "multiStateOfficeRoutes",
      action: "deleteOffice",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to delete office",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================================
// ROUTING RULES ENDPOINTS
// ============================================================================

/**
 * GET /api/multi-state/routing-rules
 * List routing rules for the current state tenant
 */
router.get("/routing-rules", enforceStateTenantIsolation, async (req: Request, res: Response) => {
  try {
    if (!req.stateTenant) {
      return res.status(400).json({ error: "No state tenant context" });
    }
    
    const rules = await db
      .select()
      .from(routingRules)
      .where(eq(routingRules.stateTenantId, req.stateTenant.id))
      .orderBy(desc(routingRules.priority));
    
    res.json({
      routingRules: rules,
      total: rules.length,
    });
  } catch (error) {
    logger.error("Error fetching routing rules", {
      service: "multiStateOfficeRoutes",
      action: "listRoutingRules",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to fetch routing rules",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/multi-state/routing-rules
 * Create new routing rule (admin only)
 */
const createRoutingRuleSchema = z.object({
  strategy: z.enum(["hub", "geographic", "workload_balanced", "specialty", "language_matching"]),
  priority: z.number().int().min(0).max(1000),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
  criteria: z.record(z.any()).optional(),
  targetOfficeId: z.string().optional(),
});

router.post("/routing-rules", requireRole("admin", "super_admin"), enforceStateTenantIsolation, async (req: Request, res: Response) => {
  try {
    if (!req.stateTenant) {
      return res.status(400).json({ error: "No state tenant context" });
    }
    
    const data = createRoutingRuleSchema.parse(req.body);
    
    // If targetOfficeId is specified, verify it exists and belongs to this state
    if (data.targetOfficeId) {
      const [office] = await db
        .select()
        .from(offices)
        .where(
          and(
            eq(offices.id, data.targetOfficeId),
            eq(offices.stateTenantId, req.stateTenant.id)
          )
        )
        .limit(1);
      
      if (!office) {
        return res.status(400).json({ 
          error: "Invalid target office",
          message: "Target office does not exist or does not belong to this state",
        });
      }
    }
    
    // Create routing rule
    const [newRule] = await db
      .insert(routingRules)
      .values({
        ...data,
        stateTenantId: req.stateTenant.id,
      })
      .returning();
    
    logger.info("Created new routing rule", {
      service: "multiStateOfficeRoutes",
      action: "createRoutingRule",
      ruleId: newRule.id,
      strategy: data.strategy,
      stateTenantId: req.stateTenant.id,
      createdBy: req.user?.id,
    });
    
    res.status(201).json(newRule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: error.errors,
      });
    }
    
    logger.error("Error creating routing rule", {
      service: "multiStateOfficeRoutes",
      action: "createRoutingRule",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to create routing rule",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PATCH /api/multi-state/routing-rules/:id
 * Update routing rule (admin only)
 */
const updateRoutingRuleSchema = z.object({
  strategy: z.enum(["hub", "geographic", "workload_balanced", "specialty", "language_matching"]).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
  criteria: z.record(z.any()).optional(),
  targetOfficeId: z.string().optional(),
});

router.patch("/routing-rules/:id", requireRole("admin", "super_admin"), enforceStateTenantIsolation, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = updateRoutingRuleSchema.parse(req.body);
    
    // Verify rule exists and belongs to user's state tenant
    const [existing] = await db
      .select()
      .from(routingRules)
      .where(eq(routingRules.id, id))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({ error: "Routing rule not found" });
    }
    
    if (req.stateTenant && existing.stateTenantId !== req.stateTenant.id) {
      return res.status(403).json({ error: "Access denied to this routing rule" });
    }
    
    const [updated] = await db
      .update(routingRules)
      .set(updates)
      .where(eq(routingRules.id, id))
      .returning();
    
    logger.info("Updated routing rule", {
      service: "multiStateOfficeRoutes",
      action: "updateRoutingRule",
      ruleId: id,
      updatedBy: req.user?.id,
    });
    
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: error.errors,
      });
    }
    
    logger.error("Error updating routing rule", {
      service: "multiStateOfficeRoutes",
      action: "updateRoutingRule",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to update routing rule",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/multi-state/routing-rules/:id
 * Delete routing rule (admin only)
 */
router.delete("/routing-rules/:id", requireRole("admin", "super_admin"), enforceStateTenantIsolation, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verify rule exists and belongs to user's state tenant
    const [existing] = await db
      .select()
      .from(routingRules)
      .where(eq(routingRules.id, id))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({ error: "Routing rule not found" });
    }
    
    if (req.stateTenant && existing.stateTenantId !== req.stateTenant.id) {
      return res.status(403).json({ error: "Access denied to this routing rule" });
    }
    
    await db
      .delete(routingRules)
      .where(eq(routingRules.id, id));
    
    logger.info("Deleted routing rule", {
      service: "multiStateOfficeRoutes",
      action: "deleteRoutingRule",
      ruleId: id,
      deletedBy: req.user?.id,
    });
    
    res.json({ message: "Routing rule deleted successfully" });
  } catch (error) {
    logger.error("Error deleting routing rule", {
      service: "multiStateOfficeRoutes",
      action: "deleteRoutingRule",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to delete routing rule",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/multi-state/route-case
 * Calculate routing decision for a case
 */
const routeCaseSchema = z.object({
  clientCaseId: z.string().optional(),
  clientData: z.object({
    zipCode: z.string().optional(),
    primaryLanguage: z.string().optional(),
    programType: z.string(),
    complexity: z.enum(["low", "medium", "high"]).optional(),
  }),
});

router.post("/route-case", enforceStateTenantIsolation, async (req: Request, res: Response) => {
  try {
    if (!req.stateTenant) {
      return res.status(400).json({ error: "No state tenant context" });
    }
    
    const data = routeCaseSchema.parse(req.body);
    
    const routingService = new OfficeRoutingService();
    const routing = await routingService.routeCase({
      stateTenantId: req.stateTenant.id,
      zipCode: data.clientData.zipCode,
      primaryLanguage: data.clientData.primaryLanguage,
      programType: data.clientData.programType,
      complexity: data.clientData.complexity,
    });
    
    res.json(routing);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: error.errors,
      });
    }
    
    logger.error("Error routing case", {
      service: "multiStateOfficeRoutes",
      action: "routeCase",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to route case",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================================
// KMS KEY MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/multi-state/kms/rotate/:stateTenantId
 * Rotate KMS keys for a state tenant (super_admin only)
 */
router.post("/kms/rotate/:stateTenantId", requireRole("super_admin"), async (req: Request, res: Response) => {
  try {
    const { stateTenantId } = req.params;
    
    // Verify state tenant exists
    const [stateTenant] = await db
      .select()
      .from(stateTenants)
      .where(eq(stateTenants.id, stateTenantId))
      .limit(1);
    
    if (!stateTenant) {
      return res.status(404).json({ error: "State tenant not found" });
    }
    
    const kmsService = new KMSService();
    await kmsService.rotateStateTenantKeys(stateTenantId);
    
    logger.info("Rotated KMS keys for state tenant", {
      service: "multiStateOfficeRoutes",
      action: "rotateKMSKeys",
      stateTenantId,
      rotatedBy: req.user?.id,
    });
    
    res.json({ 
      message: "KMS keys rotated successfully",
      stateTenantId,
    });
  } catch (error) {
    logger.error("Error rotating KMS keys", {
      service: "multiStateOfficeRoutes",
      action: "rotateKMSKeys",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to rotate KMS keys",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/multi-state/kms/status/:stateTenantId
 * Get KMS key status for a state tenant (admin only)
 */
router.get("/kms/status/:stateTenantId", requireRole("admin", "super_admin"), async (req: Request, res: Response) => {
  try {
    const { stateTenantId } = req.params;
    
    // Verify state tenant exists and user has access
    const [stateTenant] = await db
      .select()
      .from(stateTenants)
      .where(eq(stateTenants.id, stateTenantId))
      .limit(1);
    
    if (!stateTenant) {
      return res.status(404).json({ error: "State tenant not found" });
    }
    
    if (req.user?.role !== "super_admin" && req.user?.stateTenantId !== stateTenantId) {
      return res.status(403).json({ error: "Access denied to this state tenant" });
    }
    
    const kmsService = new KMSService();
    const status = await kmsService.getKeyStatus(stateTenantId);
    
    res.json(status);
  } catch (error) {
    logger.error("Error getting KMS status", {
      service: "multiStateOfficeRoutes",
      action: "getKMSStatus",
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: "Failed to get KMS status",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
