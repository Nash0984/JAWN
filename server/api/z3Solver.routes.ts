import { Router } from "express";
import { z3SolverService } from "../services/z3SolverService";
import { requireAuth, requireRole } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const verifyEligibilitySchema = z.object({
  caseId: z.string().min(1),
  stateCode: z.string().length(2),
  programCode: z.string().min(1)
});

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const stats = await z3SolverService.getSolverStats();
    res.json(stats);
  } catch (error: any) {
    console.error("Failed to get solver stats:", error);
    res.status(500).json({ error: "Failed to get solver stats" });
  }
});

router.get("/run/:runId", requireAuth, async (req, res) => {
  try {
    const { runId } = req.params;
    const run = await z3SolverService.getSolverRun(runId);
    
    if (!run) {
      return res.status(404).json({ error: "Solver run not found" });
    }
    
    res.json(run);
  } catch (error: any) {
    console.error("Failed to get solver run:", error);
    res.status(500).json({ error: "Failed to get solver run" });
  }
});

router.get("/case/:caseId/runs", requireAuth, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { limit } = req.query;
    
    const runs = await z3SolverService.getSolverRunsForCase(
      caseId,
      limit ? parseInt(limit as string, 10) : 10
    );
    
    res.json({ runs, count: runs.length });
  } catch (error: any) {
    console.error("Failed to get solver runs for case:", error);
    res.status(500).json({ error: "Failed to get solver runs" });
  }
});

router.post("/verify", requireAuth, async (req, res) => {
  try {
    const validation = verifyEligibilitySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    const { caseId, stateCode, programCode } = validation.data;

    console.log(`[Z3Solver] Starting verification for case ${caseId}, program ${programCode}`);
    
    const result = await z3SolverService.verifyCaseEligibility(
      caseId,
      stateCode,
      programCode
    );

    console.log(`[Z3Solver] Verification complete: ${result.result}, violations: ${result.violations.length}`);

    res.json(result);
  } catch (error: any) {
    console.error("Failed to verify eligibility:", error);
    res.status(500).json({ error: "Failed to verify eligibility", message: error.message });
  }
});

export default router;
