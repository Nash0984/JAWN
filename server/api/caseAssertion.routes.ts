import { Router } from "express";
import { caseAssertionService } from "../services/caseAssertionService";
import { requireAuth, requireRole } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const createAssertionSchema = z.object({
  caseId: z.string().min(1),
  stateCode: z.string().length(2),
  programCode: z.string().min(1),
  householdProfileId: z.string().optional(),
  fact: z.object({
    predicateName: z.string().min(1),
    predicateValue: z.union([z.string(), z.number(), z.boolean()]),
    predicateOperator: z.enum(["=", "<", ">", "<=", ">=", "!=", "in"]).optional(),
    comparisonValue: z.string().optional(),
    sourceField: z.string().min(1),
    assertionType: z.enum(["fact", "claim", "explanation_derived"]).optional(),
    extractionMethod: z.enum(["direct_mapping", "llm_extraction", "calculation", "document_verification"]).optional()
  })
});

const createFromHouseholdSchema = z.object({
  caseId: z.string().min(1),
  stateCode: z.string().length(2),
  programCode: z.string().min(1),
  householdProfileId: z.string().optional(),
  household: z.object({
    grossMonthlyIncome: z.number().optional(),
    netMonthlyIncome: z.number().optional(),
    householdSize: z.number().optional(),
    countableResources: z.number().optional(),
    hasElderlyMember: z.boolean().optional(),
    hasDisabledMember: z.boolean().optional(),
    isResident: z.boolean().optional(),
    stateOfResidence: z.string().optional(),
    citizenshipStatus: z.string().optional(),
    employmentHours: z.number().optional(),
    isABAWD: z.boolean().optional(),
    hasDependent: z.boolean().optional(),
    dependentAge: z.number().optional(),
    isStudent: z.boolean().optional(),
    studentWorkHours: z.number().optional(),
    earnedIncome: z.number().optional(),
    shelterCosts: z.number().optional(),
    dependentCareCosts: z.number().optional(),
    medicalCosts: z.number().optional(),
    childSupportPaid: z.number().optional()
  })
});

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const stats = await caseAssertionService.getAssertionStats();
    res.json(stats);
  } catch (error: any) {
    console.error("Failed to get assertion stats:", error);
    res.status(500).json({ error: "Failed to get assertion stats" });
  }
});

router.get("/case/:caseId", requireAuth, async (req, res) => {
  try {
    const { caseId } = req.params;
    const assertions = await caseAssertionService.getAssertionsForCase(caseId);
    res.json({ assertions, count: assertions.length });
  } catch (error: any) {
    console.error("Failed to get case assertions:", error);
    res.status(500).json({ error: "Failed to get case assertions" });
  }
});

router.get("/case/:caseId/program", requireAuth, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { stateCode, programCode } = req.query;

    if (!stateCode || !programCode) {
      return res.status(400).json({ error: "stateCode and programCode are required" });
    }

    const assertions = await caseAssertionService.getAssertionsForProgram(
      caseId,
      stateCode as string,
      programCode as string
    );
    res.json({ assertions, count: assertions.length });
  } catch (error: any) {
    console.error("Failed to get program assertions:", error);
    res.status(500).json({ error: "Failed to get program assertions" });
  }
});

router.get("/case/:caseId/z3", requireAuth, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { programCode } = req.query;

    if (!programCode) {
      return res.status(400).json({ error: "programCode is required" });
    }

    const z3Block = await caseAssertionService.generateZ3AssertionBlock(
      caseId,
      programCode as string
    );
    res.json({ z3Block, caseId, programCode });
  } catch (error: any) {
    console.error("Failed to generate Z3 block:", error);
    res.status(500).json({ error: "Failed to generate Z3 assertion block" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const validation = createAssertionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    const { caseId, stateCode, programCode, householdProfileId, fact } = validation.data;
    const tenantId = (req.user as any)?.tenantId;

    const assertion = await caseAssertionService.createAssertion(
      caseId,
      stateCode,
      programCode,
      fact,
      householdProfileId,
      tenantId
    );

    res.status(201).json(assertion);
  } catch (error: any) {
    console.error("Failed to create assertion:", error);
    res.status(500).json({ error: "Failed to create assertion" });
  }
});

router.post("/from-household", requireAuth, async (req, res) => {
  try {
    const validation = createFromHouseholdSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    const { caseId, stateCode, programCode, householdProfileId, household } = validation.data;
    const tenantId = (req.user as any)?.tenantId;

    const assertions = await caseAssertionService.createAssertionsFromHousehold(
      caseId,
      stateCode,
      programCode,
      household,
      householdProfileId,
      tenantId
    );

    res.status(201).json({ assertions, count: assertions.length });
  } catch (error: any) {
    console.error("Failed to create assertions from household:", error);
    res.status(500).json({ error: "Failed to create assertions from household" });
  }
});

router.patch("/:assertionId/verify", requireAuth, requireRole(["admin", "supervisor"]), async (req, res) => {
  try {
    const { assertionId } = req.params;
    const { verificationDocumentId } = req.body;

    const assertion = await caseAssertionService.verifyAssertion(
      assertionId,
      verificationDocumentId
    );

    if (!assertion) {
      return res.status(404).json({ error: "Assertion not found" });
    }

    res.json(assertion);
  } catch (error: any) {
    console.error("Failed to verify assertion:", error);
    res.status(500).json({ error: "Failed to verify assertion" });
  }
});

router.delete("/case/:caseId", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { caseId } = req.params;
    const deleted = await caseAssertionService.deleteAssertionsForCase(caseId);
    res.json({ deleted, caseId });
  } catch (error: any) {
    console.error("Failed to delete assertions:", error);
    res.status(500).json({ error: "Failed to delete assertions" });
  }
});

export default router;
