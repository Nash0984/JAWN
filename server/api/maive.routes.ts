/**
 * MAIVE API Routes - AI Validation Engine
 * 
 * Routes for managing test cases, running validation suites,
 * and tracking accuracy trends.
 */

import { Router } from 'express';
import { db } from '../db';
import { maiveTestCases } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middleware/auth';

// Async handler wrapper
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const router = Router();

// Create a new test case
router.post("/test-cases", requireAuth, requireRole(["admin"]), asyncHandler(async (req, res) => {
  const { MAIVEService } = await import("../services/maive.service");
  const maiveService = new MAIVEService(req.storage);
  
  const testCase = await maiveService.createTestCase(req.body);
  res.json({ success: true, testCase });
}));

// Get all test cases
router.get("/test-cases", requireAuth, asyncHandler(async (req, res) => {
  const state = req.query.state as string | undefined;
  const category = req.query.category as string | undefined;
  
  const conditions: any[] = [eq(maiveTestCases.isActive, true)];
  if (state) conditions.push(eq(maiveTestCases.stateSpecific, state));
  if (category) conditions.push(eq(maiveTestCases.category, category));
  
  const testCases = await db.query.maiveTestCases.findMany({
    where: conditions.length > 1 ? and(...conditions) : conditions[0],
    orderBy: [desc(maiveTestCases.createdAt)]
  });
  
  res.json({ success: true, testCases });
}));

// Run a test suite
router.post("/run-suite", requireAuth, requireRole(["admin"]), asyncHandler(async (req, res) => {
  const { suiteName, testCaseIds, systemType, state } = req.body;
  
  const { MAIVEService } = await import("../services/maive.service");
  const maiveService = new MAIVEService(req.storage);
  
  // Create system under test based on systemType
  let systemUnderTest: (inputs: Record<string, any>) => Promise<Record<string, any>>;
  
  if (systemType === "policy_engine") {
    // Test PolicyEngine calculations - simplified for demo
    systemUnderTest = async (inputs) => {
      return {
        eligibleForSNAP: true,
        monthlyBenefit: Math.floor(Math.random() * 500),
        calculations: { 
          grossIncome: inputs.monthlyIncome || 0,
          netIncome: (inputs.monthlyIncome || 0) * 0.8,
          shelterDeduction: inputs.shelterCosts || 0,
          adjustedIncome: Math.max(0, (inputs.monthlyIncome || 0) - 500)
        },
      };
    };
  } else if (systemType === "gemini_extraction") {
    // Test Gemini document extraction - simplified for demo
    systemUnderTest = async (inputs) => {
      // Parse mock extraction from inputs
      if (inputs.ocrText) {
        const lines = inputs.ocrText.split('\n');
        const extractedData: Record<string, any> = {};
        
        lines.forEach((line: string) => {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value) {
            // Simple extraction logic
            if (key.toLowerCase().includes('name')) {
              extractedData.clientName = value;
            } else if (key.toLowerCase().includes('case')) {
              extractedData.caseNumber = value;
            } else if (key.toLowerCase().includes('employer')) {
              extractedData.employer = value;
            } else if (key.toLowerCase().includes('wage')) {
              extractedData.monthlyWages = parseInt(value.replace(/[^0-9]/g, ''));
            }
          }
        });
        
        return {
          extractedData,
          documentValid: Object.keys(extractedData).length > 0,
          requiredActions: ["verify_employment", "recalculate_benefits"],
        };
      }
      
      return {
        extractedData: inputs,
        documentValid: true,
        requiredActions: ["review"],
      };
    };
  } else {
    // Default test system (echo inputs)
    systemUnderTest = async (inputs) => inputs;
  }
  
  const testRun = await maiveService.runTestSuite(
    suiteName,
    testCaseIds,
    systemUnderTest,
    state
  );
  
  res.json({ success: true, testRun });
}));

// Get test run results
router.get("/test-runs/:runId", requireAuth, asyncHandler(async (req, res) => {
  const { MAIVEService } = await import("../services/maive.service");
  const maiveService = new MAIVEService(req.storage);
  
  const results = await maiveService.getTestRunResults(req.params.runId);
  res.json({ success: true, ...results });
}));

// Get recent test runs
router.get("/test-runs", requireAuth, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const state = req.query.state as string | undefined;
  
  const { MAIVEService } = await import("../services/maive.service");
  const maiveService = new MAIVEService(req.storage);
  
  const runs = await maiveService.getRecentTestRuns(limit, state);
  res.json({ success: true, runs });
}));

// Get accuracy trends
router.get("/trends", requireAuth, asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days as string) || 30;
  const state = req.query.state as string | undefined;
  
  const { MAIVEService } = await import("../services/maive.service");
  const maiveService = new MAIVEService(req.storage);
  
  const trends = await maiveService.getAccuracyTrends(days, state);
  res.json({ success: true, trends });
}));

export default router;