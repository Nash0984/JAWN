/**
 * Explanation Parser API Routes
 * 
 * PAPER ALIGNMENT: Exposes the NOA/explanation parsing functionality
 * for extracting ABox assertions from explanation text.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { explanationClauseParser } from "../services/explanationClauseParser";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

const parseExplanationSchema = z.object({
  explanationText: z.string().min(20, "Explanation text must be at least 20 characters"),
  stateCode: z.string().length(2).default("MD"),
  programCode: z.string().min(2).max(20).default("SNAP")
});

const createAssertionsSchema = z.object({
  caseId: z.string().min(1),
  explanationText: z.string().min(20),
  stateCode: z.string().length(2).default("MD"),
  programCode: z.string().min(2).max(20).default("SNAP")
});

const batchParseSchema = z.object({
  explanations: z.array(z.object({
    text: z.string().min(20),
    stateCode: z.string().length(2).optional(),
    programCode: z.string().min(2).max(20).optional()
  })).min(1).max(20),
  defaultStateCode: z.string().length(2).default("MD"),
  defaultProgramCode: z.string().min(2).max(20).default("SNAP")
});

router.post(
  "/parse",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const data = parseExplanationSchema.parse(req.body);
      
      const result = await explanationClauseParser.parseExplanation(
        data.explanationText,
        data.stateCode,
        data.programCode
      );

      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error parsing explanation:", error);
      res.status(500).json({ error: "Failed to parse explanation text" });
    }
  }
);

router.post(
  "/parse/create-assertions",
  requireAuth,
  requireRole("admin", "supervisor", "navigator"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = createAssertionsSchema.parse(req.body);
      
      const result = await explanationClauseParser.createAssertionsFromExplanation(
        data.caseId,
        data.explanationText,
        data.stateCode,
        data.programCode,
        req.user?.id
      );

      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating assertions from explanation:", error);
      res.status(500).json({ error: "Failed to create assertions from explanation" });
    }
  }
);

router.post(
  "/parse/batch",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const data = batchParseSchema.parse(req.body);
      
      const result = await explanationClauseParser.batchParseExplanations(
        data.explanations,
        data.defaultStateCode,
        data.defaultProgramCode
      );

      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error batch parsing explanations:", error);
      res.status(500).json({ error: "Failed to batch parse explanations" });
    }
  }
);

router.get(
  "/stats",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const stats = await explanationClauseParser.getParsingStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching parsing stats:", error);
      res.status(500).json({ error: "Failed to fetch parsing stats" });
    }
  }
);

export default router;
