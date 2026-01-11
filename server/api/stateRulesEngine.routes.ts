import express from "express";
import { z } from "zod";
import { calculateStateEligibility, type StateEligibilityInput } from "../services/stateRulesEngines";
import { logger } from "../services/logger.service";

const router = express.Router();

const stateEligibilitySchema = z.object({
  stateCode: z.enum(["UT", "IN", "MI"]),
  program: z.enum(["SNAP", "TANF", "MEDICAID"]),
  householdSize: z.number().int().min(1).max(20),
  grossMonthlyIncome: z.number().int().min(0),
  earnedIncome: z.number().int().min(0),
  unearnedIncome: z.number().int().min(0),
  assets: z.number().int().min(0).optional(),
  hasElderly: z.boolean().optional(),
  hasDisabled: z.boolean().optional(),
  shelterCosts: z.number().int().min(0).optional(),
  dependentCareExpenses: z.number().int().min(0).optional(),
  medicalExpenses: z.number().int().min(0).optional(),
  childrenUnder18: z.number().int().min(0).optional(),
  isPregnant: z.boolean().optional()
});

router.post("/calculate", async (req, res) => {
  try {
    const validatedInput = stateEligibilitySchema.parse(req.body);
    
    const result = await calculateStateEligibility(validatedInput as StateEligibilityInput);
    
    logger.info(`State eligibility calculated`, {
      service: "StateRulesEngineAPI",
      action: "calculate",
      stateCode: validatedInput.stateCode,
      program: validatedInput.program,
      isEligible: result.isEligible
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        details: error.errors
      });
    }
    
    logger.error(`State eligibility calculation failed`, {
      service: "StateRulesEngineAPI",
      action: "calculate",
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/supported-states", (req, res) => {
  res.json({
    success: true,
    data: {
      states: [
        {
          code: "UT",
          name: "Utah",
          programs: ["SNAP", "TANF", "MEDICAID"],
          notes: {
            SNAP: "Uses federal limits (130% FPL gross, 100% net), no BBCE",
            TANF: "Family Employment Program with 36-month lifetime limit",
            MEDICAID: "Expanded in 2020 via ballot initiative"
          }
        },
        {
          code: "IN",
          name: "Indiana",
          programs: ["SNAP", "TANF", "MEDICAID"],
          notes: {
            SNAP: "Uses federal limits (130% FPL), no BBCE",
            TANF: "24-month consecutive limit, 60-month lifetime",
            MEDICAID: "Healthy Indiana Plan (HIP) 2.0 since 2015"
          }
        },
        {
          code: "MI",
          name: "Michigan",
          programs: ["SNAP", "TANF", "MEDICAID"],
          notes: {
            SNAP: "Food Assistance Program (FAP) with BBCE (200% FPL gross)",
            TANF: "Family Independence Program with 60-month lifetime limit",
            MEDICAID: "Healthy Michigan Plan expansion"
          }
        }
      ],
      programs: [
        { code: "SNAP", name: "Supplemental Nutrition Assistance Program" },
        { code: "TANF", name: "Temporary Assistance for Needy Families" },
        { code: "MEDICAID", name: "Medicaid Health Coverage" }
      ]
    }
  });
});

router.post("/batch-calculate", async (req, res) => {
  try {
    const { households, stateCode, programs } = req.body;
    
    if (!Array.isArray(households) || households.length === 0) {
      return res.status(400).json({
        success: false,
        error: "households must be a non-empty array"
      });
    }
    
    if (households.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Maximum 50 households per batch request"
      });
    }
    
    const programsToCheck = programs || ["SNAP", "TANF", "MEDICAID"];
    const results = [];
    
    for (const household of households) {
      const householdResults: Record<string, any> = {
        householdId: household.id || `household_${results.length + 1}`,
        stateCode,
        eligibility: {}
      };
      
      for (const program of programsToCheck) {
        try {
          const input: StateEligibilityInput = {
            stateCode,
            program,
            householdSize: household.householdSize,
            grossMonthlyIncome: household.grossMonthlyIncome,
            earnedIncome: household.earnedIncome || 0,
            unearnedIncome: household.unearnedIncome || 0,
            assets: household.assets,
            hasElderly: household.hasElderly,
            hasDisabled: household.hasDisabled,
            shelterCosts: household.shelterCosts,
            dependentCareExpenses: household.dependentCareExpenses,
            medicalExpenses: household.medicalExpenses,
            childrenUnder18: household.childrenUnder18,
            isPregnant: household.isPregnant
          };
          
          const result = await calculateStateEligibility(input);
          householdResults.eligibility[program] = {
            isEligible: result.isEligible,
            monthlyBenefit: result.monthlyBenefit,
            reason: result.reason
          };
        } catch (err: any) {
          householdResults.eligibility[program] = {
            isEligible: false,
            error: err.message
          };
        }
      }
      
      results.push(householdResults);
    }
    
    res.json({
      success: true,
      data: {
        totalHouseholds: results.length,
        stateCode,
        programs: programsToCheck,
        results
      }
    });
  } catch (error: any) {
    logger.error(`Batch calculation failed`, {
      service: "StateRulesEngineAPI",
      action: "batchCalculate",
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
