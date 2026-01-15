import { Router, Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { 
  generateSyntheticData, 
  clearSyntheticData, 
  getSyntheticDataStats 
} from "../services/eeSyntheticDataGenerator";

const router = Router();

router.get("/stats", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const stats = await getSyntheticDataStats();
  res.json({
    success: true,
    data: stats,
    message: "E&E synthetic database statistics retrieved successfully"
  });
}));

router.post("/generate", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const inputSchema = z.object({
    targetIndividuals: z.number().min(10).max(5000).default(500),
    churnRate: z.number().min(0).max(1).default(0.20),
    crossEnrollmentOpportunityRate: z.number().min(0).max(1).default(0.35),
    averageHouseholdSize: z.number().min(1).max(10).default(2.5),
    activeEnrollmentRate: z.number().min(0).max(1).default(0.75),
    homelessRate: z.number().min(0).max(1).default(0.05),
    abawdRate: z.number().min(0).max(1).default(0.15),
  });

  const validated = inputSchema.parse(req.body);

  const generationStats = await generateSyntheticData(validated.targetIndividuals, {
    churnRate: validated.churnRate,
    crossEnrollmentOpportunityRate: validated.crossEnrollmentOpportunityRate,
    averageHouseholdSize: validated.averageHouseholdSize,
    activeEnrollmentRate: validated.activeEnrollmentRate,
    homelessRate: validated.homelessRate,
    abawdRate: validated.abawdRate,
  });

  res.json({
    success: true,
    data: generationStats,
    message: `Generated ${generationStats.individuals} individuals across ${generationStats.cases} cases with ${generationStats.incomeRecords} income records, ${generationStats.abawdRecords} ABAWD records`
  });
}));

router.delete("/clear", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await clearSyntheticData();
  res.json({
    success: true,
    message: "E&E synthetic data cleared successfully"
  });
}));

router.get("/health", asyncHandler(async (req: Request, res: Response) => {
  const stats = await getSyntheticDataStats();
  res.json({
    status: "healthy",
    syntheticDataAvailable: stats.totalIndividuals > 0,
    totalRecords: stats.totalIndividuals,
    totalCases: stats.totalCases,
    activeCases: stats.activeCases,
    closedCases: stats.closedCases,
    churnCases: stats.churnCases,
    incomeRecords: stats.incomeRecords,
    resourceRecords: stats.resourceRecords,
    expenseRecords: stats.expenseRecords,
    verificationRecords: stats.verificationRecords,
    abawdRecords: stats.abawdRecords,
    homelessIndividuals: stats.homelessIndividuals,
    tableCount: 14,
    fieldCompliance: "172 E&E Data Dictionary fields implemented",
    description: "E&E Synthetic Database for sidecar testing - Maryland E&E Data Dictionary compliant"
  });
}));

export default router;
