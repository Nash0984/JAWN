import { Router, Request, Response } from "express";
import { z } from "zod";
import { ruleExtractionService, PromptStrategy, EligibilityDomain, RuleType } from "../services/ruleExtractionService";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

const createFragmentSchema = z.object({
  statutorySourceId: z.string().min(1),
  clauseText: z.string().min(10),
  domain: z.enum(["income", "residency", "citizenship", "resources", "work_requirement", "student_status", "household_composition", "age", "disability", "other"]),
  ruleType: z.enum(["requirement", "exception", "threshold", "verification", "definition"]),
  clauseNumber: z.number().optional(),
  extractedConcepts: z.array(z.string()).optional()
});

const extractRuleSchema = z.object({
  ruleFragmentId: z.string().min(1),
  stateCode: z.string().length(2),
  programCode: z.string().min(2).max(20),
  strategy: z.enum(["vanilla", "undirected", "directed_symbolic"]).default("directed_symbolic")
});

const batchExtractSchema = z.object({
  stateCode: z.string().length(2),
  programCode: z.string().min(2).max(20),
  strategy: z.enum(["vanilla", "undirected", "directed_symbolic"]).default("directed_symbolic"),
  limit: z.number().min(1).max(50).default(10)
});

const seedSchema = z.object({
  stateCode: z.string().length(2),
  programCode: z.string().min(2).max(20)
});

router.post(
  "/fragments",
  requireAuth,
  requireRole("admin", "supervisor"),
  async (req: Request, res: Response) => {
    try {
      const data = createFragmentSchema.parse(req.body);
      
      const fragment = await ruleExtractionService.createRuleFragment(
        data.statutorySourceId,
        data.clauseText,
        data.domain as EligibilityDomain,
        data.ruleType as RuleType,
        data.clauseNumber,
        data.extractedConcepts
      );

      res.status(201).json(fragment);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating rule fragment:", error);
      res.status(500).json({ error: "Failed to create rule fragment" });
    }
  }
);

router.post(
  "/extract",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const data = extractRuleSchema.parse(req.body);
      
      const result = await ruleExtractionService.extractAndFormalizeRule(
        data.ruleFragmentId,
        data.stateCode,
        data.programCode,
        data.strategy as PromptStrategy
      );

      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error extracting rule:", error);
      res.status(500).json({ error: "Failed to extract rule" });
    }
  }
);

router.post(
  "/extract/batch",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const data = batchExtractSchema.parse(req.body);
      
      const result = await ruleExtractionService.batchExtractRules(
        data.stateCode,
        data.programCode,
        data.strategy as PromptStrategy,
        data.limit
      );

      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error batch extracting rules:", error);
      res.status(500).json({ error: "Failed to batch extract rules" });
    }
  }
);

router.post(
  "/seed",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const data = seedSchema.parse(req.body);
      
      if (data.stateCode !== "MD" || data.programCode !== "SNAP") {
        return res.status(400).json({ 
          error: "Currently only Maryland SNAP rules are supported for seeding" 
        });
      }

      const result = await ruleExtractionService.seedMarylandSNAPRules();
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error seeding rules:", error);
      res.status(500).json({ error: "Failed to seed rules" });
    }
  }
);

router.get(
  "/rules",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { stateCode, programCode, domain } = req.query;

      if (!stateCode || !programCode) {
        return res.status(400).json({ error: "stateCode and programCode are required" });
      }

      let rules;
      if (domain) {
        rules = await ruleExtractionService.getRulesByDomain(
          stateCode as string,
          programCode as string,
          domain as EligibilityDomain
        );
      } else {
        rules = await ruleExtractionService.getRulesByProgram(
          stateCode as string,
          programCode as string
        );
      }

      res.json({ rules, count: rules.length });
    } catch (error: any) {
      console.error("Error fetching rules:", error);
      res.status(500).json({ error: "Failed to fetch rules" });
    }
  }
);

router.get(
  "/rules/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const rule = await ruleExtractionService.getFormalRule(req.params.id);
      
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      res.json(rule);
    } catch (error: any) {
      console.error("Error fetching rule:", error);
      res.status(500).json({ error: "Failed to fetch rule" });
    }
  }
);

router.post(
  "/rules/:id/approve",
  requireAuth,
  requireRole("admin", "supervisor"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const rule = await ruleExtractionService.approveRule(req.params.id, userId);
      
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      res.json(rule);
    } catch (error: any) {
      console.error("Error approving rule:", error);
      res.status(500).json({ error: "Failed to approve rule" });
    }
  }
);

router.post(
  "/rules/:id/deprecate",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const rule = await ruleExtractionService.deprecateRule(req.params.id);
      
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      res.json(rule);
    } catch (error: any) {
      console.error("Error deprecating rule:", error);
      res.status(500).json({ error: "Failed to deprecate rule" });
    }
  }
);

router.get(
  "/logs",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { ruleFragmentId, limit } = req.query;
      
      const logs = await ruleExtractionService.getExtractionLogs(
        ruleFragmentId as string | undefined,
        limit ? parseInt(limit as string) : 50
      );

      res.json({ logs, count: logs.length });
    } catch (error: any) {
      console.error("Error fetching extraction logs:", error);
      res.status(500).json({ error: "Failed to fetch extraction logs" });
    }
  }
);

router.get(
  "/stats",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const stats = await ruleExtractionService.getExtractionStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching extraction stats:", error);
      res.status(500).json({ error: "Failed to fetch extraction stats" });
    }
  }
);

const directExtractSchema = z.object({
  statutoryText: z.string().min(20, "Statutory text must be at least 20 characters"),
  stateCode: z.string().length(2),
  programCode: z.string().min(2).max(20),
  domain: z.enum(["income", "residency", "citizenship", "resources", "work_requirement", "student_status", "household_composition", "age", "disability", "other"]).optional(),
  statutoryCitation: z.string().optional()
});

const batchDirectExtractSchema = z.object({
  clauses: z.array(z.object({
    text: z.string().min(20),
    citation: z.string().optional(),
    domain: z.enum(["income", "residency", "citizenship", "resources", "work_requirement", "student_status", "household_composition", "age", "disability", "other"]).optional()
  })).min(1).max(20),
  stateCode: z.string().length(2),
  programCode: z.string().min(2).max(20)
});

router.post(
  "/extract/direct",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const data = directExtractSchema.parse(req.body);
      
      const result = await ruleExtractionService.extractRuleFromText(
        data.statutoryText,
        data.stateCode,
        data.programCode,
        data.domain as EligibilityDomain | undefined,
        data.statutoryCitation
      );

      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error in direct rule extraction:", error);
      res.status(500).json({ error: "Failed to extract rule from text" });
    }
  }
);

router.post(
  "/extract/direct/batch",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const data = batchDirectExtractSchema.parse(req.body);
      
      const result = await ruleExtractionService.batchExtractFromText(
        data.clauses,
        data.stateCode,
        data.programCode
      );

      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error in batch direct rule extraction:", error);
      res.status(500).json({ error: "Failed to batch extract rules from text" });
    }
  }
);

export default router;
