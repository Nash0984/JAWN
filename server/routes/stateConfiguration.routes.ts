import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { stateConfigurationService } from "../services/stateConfigurationService";
import { 
  insertStateConfigurationSchema,
  insertStateBenefitProgramSchema,
  insertStateFormSchema,
  insertStatePolicyRuleSchema
} from "@shared/schema";
import { asyncHandler, notFoundError, validationError } from "../middleware/errorHandler";
import { requireAuth, requireAdmin } from "../middleware/auth";

export function registerStateConfigurationRoutes(app: Express) {
  // ============================================================================
  // STATE CONFIGURATION ENDPOINTS - Multi-State White-Labeling
  // ============================================================================
  
  // Get all state configurations
  app.get("/api/state-configurations", asyncHandler(async (req: Request, res: Response) => {
    const { isActive, region } = req.query;
    
    const filters: any = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (region) filters.region = region as string;
    
    const configs = await storage.getStateConfigurations(filters);
    res.json(configs);
  }));

  // Get states for selector (public endpoint)
  app.get("/api/states/selector", asyncHandler(async (req: Request, res: Response) => {
    const states = await stateConfigurationService.getStatesForSelector();
    res.json(states);
  }));

  // Get state configuration by ID
  app.get("/api/state-configurations/:id", asyncHandler(async (req: Request, res: Response) => {
    const config = await storage.getStateConfiguration(req.params.id);
    if (!config) {
      throw notFoundError("State configuration not found");
    }
    res.json(config);
  }));

  // Get state configuration by state code
  app.get("/api/state-configurations/code/:stateCode", asyncHandler(async (req: Request, res: Response) => {
    const config = await storage.getStateConfigurationByCode(req.params.stateCode);
    if (!config) {
      throw notFoundError(`State configuration not found for state code: ${req.params.stateCode}`);
    }
    res.json(config);
  }));

  // Get state configuration by tenant
  app.get("/api/state-configurations/tenant/:tenantId", asyncHandler(async (req: Request, res: Response) => {
    const config = await stateConfigurationService.getStateConfigByTenant(req.params.tenantId);
    if (!config) {
      throw notFoundError(`State configuration not found for tenant: ${req.params.tenantId}`);
    }
    res.json(config);
  }));

  // Create state configuration (admin only)
  app.post("/api/state-configurations", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertStateConfigurationSchema.parse(req.body.stateConfig);
    const config = await stateConfigurationService.createStateConfiguration({
      tenant: req.body.tenant,
      stateConfig: validated,
      branding: req.body.branding,
      programs: req.body.programs
    });
    
    res.status(201).json(config);
  }));

  // Update state configuration (admin only)
  app.patch("/api/state-configurations/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertStateConfigurationSchema.partial().parse(req.body);
    const config = await storage.updateStateConfiguration(req.params.id, validated);
    res.json(config);
  }));

  // Delete state configuration (admin only)
  app.delete("/api/state-configurations/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    await storage.deleteStateConfiguration(req.params.id);
    res.json({ message: "State configuration deleted successfully" });
  }));

  // Get state benefit programs
  app.get("/api/state-configurations/:stateConfigId/programs", asyncHandler(async (req: Request, res: Response) => {
    const programs = await storage.getStateBenefitPrograms(req.params.stateConfigId);
    res.json(programs);
  }));

  // Configure benefit program for state (admin only)
  app.post("/api/state-configurations/:stateConfigId/programs", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertStateBenefitProgramSchema.parse({
      ...req.body,
      stateConfigId: req.params.stateConfigId
    });
    
    const program = await stateConfigurationService.configureStateBenefitProgram(
      req.params.stateConfigId,
      validated.benefitProgramId,
      validated
    );
    
    res.status(201).json(program);
  }));

  // Update state benefit program (admin only)
  app.patch("/api/state-benefit-programs/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertStateBenefitProgramSchema.partial().parse(req.body);
    const program = await storage.updateStateBenefitProgram(req.params.id, validated);
    res.json(program);
  }));

  // Get state forms
  app.get("/api/state-configurations/:stateConfigId/forms", asyncHandler(async (req: Request, res: Response) => {
    const { formType, language, isActive } = req.query;
    
    const filters: any = {};
    if (formType) filters.formType = formType as string;
    if (language) filters.language = language as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const forms = await storage.getStateForms(req.params.stateConfigId, filters);
    res.json(forms);
  }));

  // Create state form (admin only)
  app.post("/api/state-configurations/:stateConfigId/forms", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertStateFormSchema.parse({
      ...req.body,
      stateConfigId: req.params.stateConfigId
    });
    
    const form = await storage.createStateForm(validated);
    res.status(201).json(form);
  }));

  // Get state policy rules
  app.get("/api/state-configurations/:stateConfigId/rules", asyncHandler(async (req: Request, res: Response) => {
    const { ruleCategory, benefitProgramId, isActive } = req.query;
    
    const filters: any = {};
    if (ruleCategory) filters.ruleCategory = ruleCategory as string;
    if (benefitProgramId) filters.benefitProgramId = benefitProgramId as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const rules = await storage.getStatePolicyRules(req.params.stateConfigId, filters);
    res.json(rules);
  }));

  // Create state policy rule (admin only)
  app.post("/api/state-configurations/:stateConfigId/rules", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertStatePolicyRuleSchema.parse({
      ...req.body,
      stateConfigId: req.params.stateConfigId
    });
    
    const rule = await storage.createStatePolicyRule(validated);
    res.status(201).json(rule);
  }));

  // Validate state configuration completeness
  app.get("/api/state-configurations/:stateConfigId/validate", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const validation = await stateConfigurationService.validateStateConfiguration(req.params.stateConfigId);
    res.json(validation);
  }));

  // Clone state configuration (admin only)
  app.post("/api/state-configurations/clone", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { sourceStateCode, targetStateCode, tenant, stateConfig } = req.body;
    
    if (!sourceStateCode || !targetStateCode || !tenant || !stateConfig) {
      throw validationError("sourceStateCode, targetStateCode, tenant, and stateConfig are required");
    }
    
    const cloned = await stateConfigurationService.cloneStateConfiguration(
      sourceStateCode,
      targetStateCode,
      { tenant, stateConfig }
    );
    
    if (!cloned) {
      throw notFoundError(`Source state configuration not found for state code: ${sourceStateCode}`);
    }
    
    res.status(201).json(cloned);
  }));

  // Get state routing info for frontend
  app.get("/api/states/:stateCode/routing", asyncHandler(async (req: Request, res: Response) => {
    const routingInfo = await stateConfigurationService.getStateRoutingInfo(req.params.stateCode);
    if (!routingInfo) {
      throw notFoundError(`State routing info not found for state code: ${req.params.stateCode}`);
    }
    res.json(routingInfo);
  }));

  // Apply state eligibility overrides (used internally by eligibility calculation)
  app.post("/api/state-configurations/:stateCode/apply-eligibility", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { benefitProgramId, baseEligibility } = req.body;
    
    if (!benefitProgramId || !baseEligibility) {
      throw validationError("benefitProgramId and baseEligibility are required");
    }
    
    const modified = await stateConfigurationService.applyStateEligibilityRules(
      req.params.stateCode,
      benefitProgramId,
      baseEligibility
    );
    
    res.json(modified);
  }));
}