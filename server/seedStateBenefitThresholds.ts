import { db } from "./db";
import { storage } from "./storage";
import { stateConfigurations, stateBenefitPrograms, benefitPrograms } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "./services/logger.service";

// Key benefit thresholds for all 19 states based on research
const stateBenefitData = [
  // Mid-Atlantic Priority States
  {
    stateCode: "MD",
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: false,
      workRequirementAges: "18-54",
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 748,
      timeLimitMonths: 60,
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 322,
      pregnantIncomeLimit: 264
    }
  },
  {
    stateCode: "PA",
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: false,
      workRequirementAges: "18-54",
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 473, // Average of 403-543
      timeLimitMonths: 60,
      workHoursRequired: 25 // Average of 20-30
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 319,
      pregnantIncomeLimit: 220
    }
  },
  {
    stateCode: "NJ",
    snap: {
      incomeLimitPercent: 185,
      hasAssetTest: false,
      workRequirementAges: "18-54",
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 424,
      timeLimitMonths: 60,
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 355,
      pregnantIncomeLimit: 200
    }
  },
  {
    stateCode: "DE",
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: false,
      workRequirementAges: "18-64", // Expanding Nov 2025
      hasBBCE: true,
      notes: "Work requirements expanding to ages 50-54 in Nov 2025, 55-64 by 2030"
    },
    tanf: {
      maxBenefitFamily3: 338,
      timeLimitMonths: 36, // More restrictive than federal
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 217,
      pregnantIncomeLimit: 217
    }
  },
  {
    stateCode: "VA",
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: true,
      assetLimit: 2750,
      workRequirementAges: "18-54",
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 389,
      timeLimitMonths: 24, // Consecutive
      timeLimitLifetime: 60,
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: true,
      expansionYear: 2019,
      adultIncomeLimit: 138,
      childIncomeLimit: 148,
      pregnantIncomeLimit: 148
    }
  },
  {
    stateCode: "NY",
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: false,
      workRequirementAges: "18-54",
      hasBBCE: true,
      hasRestaurantMeals: true
    },
    tanf: {
      maxBenefitFamily3: 789,
      timeLimitMonths: 60,
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 405, // Highest nationally
      pregnantIncomeLimit: 223,
      hasEssentialPlan: true
    }
  },
  {
    stateCode: "NYC", // Separate NYC configuration
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: false,
      workRequirementAges: "Waived",
      hasBBCE: true,
      hasRestaurantMeals: true
    },
    tanf: {
      maxBenefitFamily3: 850, // Higher in NYC
      timeLimitMonths: 60,
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 405,
      pregnantIncomeLimit: 223
    }
  },
  {
    stateCode: "DC",
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: false,
      workRequirementAges: "Waived",
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 900, // Average of 712-1093
      timeLimitMonths: 60,
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 215, // Higher than standard
      childIncomeLimit: 324,
      pregnantIncomeLimit: 324
    }
  },
  // National Expansion States
  {
    stateCode: "CA",
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: false,
      workRequirementAges: "18-54",
      hasBBCE: true,
      hasRestaurantMeals: true,
      ssiEligible: true // Exception to federal rule
    },
    tanf: {
      maxBenefitFamily3: 925, // Highest in continental US
      timeLimitMonths: 48,
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 266,
      pregnantIncomeLimit: 213,
      coversUndocumented: true
    }
  },
  {
    stateCode: "TX",
    snap: {
      incomeLimitPercent: 165, // No BBCE
      hasAssetTest: true,
      assetLimit: 5000,
      workRequirementAges: "18-54",
      hasBBCE: false
    },
    tanf: {
      maxBenefitFamily3: 308,
      timeLimitMonths: 60,
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: false,
      adultIncomeLimit: 17, // Parents only, extremely restrictive
      childIncomeLimit: 201,
      pregnantIncomeLimit: 202,
      coverageGap: "18-138% FPL"
    }
  },
  {
    stateCode: "FL",
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: false, // Waived via BBCE
      workRequirementAges: "18-54",
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 303,
      timeLimitMonths: 48, // More restrictive than federal
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: false,
      adultIncomeLimit: 32, // Parents only
      childIncomeLimit: 215,
      pregnantIncomeLimit: 196,
      coverageGap: "33-138% FPL"
    }
  },
  // Additional Expansion States
  {
    stateCode: "OH",
    snap: {
      incomeLimitPercent: 130, // Standard, no BBCE expansion
      hasAssetTest: false, // Waived via BBCE
      workRequirementAges: "18-64", // Expanding by 2026
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 505,
      timeLimitMonths: 60,
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 206,
      pregnantIncomeLimit: 200
    }
  },
  {
    stateCode: "GA",
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: false, // Conditional for elderly/disabled
      workRequirementAges: "18-64",
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 280, // Among lowest nationally
      timeLimitMonths: 48,
      workHoursRequired: 30,
      assetLimit: 1000
    },
    medicaid: {
      isExpanded: false,
      adultIncomeLimit: 38, // Parents only, very low
      childIncomeLimit: 318,
      pregnantIncomeLimit: 218,
      coverageGap: "39-138% FPL"
    }
  },
  {
    stateCode: "NC",
    snap: {
      incomeLimitPercent: 130, // Standard
      hasAssetTest: false,
      workRequirementAges: "18-51",
      hasBBCE: false
    },
    tanf: {
      maxBenefitFamily3: 450, // Approximate
      timeLimitMonths: 60,
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: true,
      expansionYear: 2023,
      adultIncomeLimit: 138,
      childIncomeLimit: 200,
      pregnantIncomeLimit: 195
    }
  },
  {
    stateCode: "MI",
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: false, // Conditional for elderly/disabled
      workRequirementAges: "18-54",
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 492,
      timeLimitMonths: 60, // Increased from 48 in 2025
      workHoursRequired: 30
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 200,
      pregnantIncomeLimit: 185
    }
  },
  {
    stateCode: "IL",
    snap: {
      incomeLimitPercent: 165,
      hasAssetTest: false,
      workRequirementAges: "18-54",
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 753, // Set at 35% FPL
      timeLimitMonths: 60,
      workHoursRequired: 30,
      hasAssetTest: false
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 317, // Varies by age
      pregnantIncomeLimit: 213
    }
  },
  {
    stateCode: "MA",
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: false, // Conditional for elderly/disabled
      workRequirementAges: "18-54",
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 675, // Average 650-700
      timeLimitMonths: 24, // Within 60-month period
      workHoursRequired: 30,
      hasClothingAllowance: true
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 300,
      pregnantIncomeLimit: 200
    }
  },
  {
    stateCode: "WA",
    snap: {
      incomeLimitPercent: 200, // One of most generous
      hasAssetTest: false,
      workRequirementAges: "18-64",
      workHoursRequired: 80, // Per month
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 654,
      timeLimitMonths: 60,
      workHoursRequired: 30,
      assetLimit: 6000
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 250, // Average 200-300
      pregnantIncomeLimit: 200
    }
  },
  {
    stateCode: "CO",
    snap: {
      incomeLimitPercent: 200,
      hasAssetTest: false, // Conditional for elderly/disabled
      workRequirementAges: "18-54",
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 559,
      timeLimitMonths: 60,
      workHoursRequired: 30,
      hasAssetTest: false // Eliminated
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 133,
      childIncomeLimit: 260,
      pregnantIncomeLimit: 195
    }
  },
  {
    stateCode: "AZ",
    snap: {
      incomeLimitPercent: 185,
      hasAssetTest: false,
      workRequirementAges: "18-49",
      hasBBCE: true
    },
    tanf: {
      maxBenefitFamily3: 347,
      timeLimitMonths: 60, // Federal limit
      timeLimitConsecutive: 12, // State consecutive limit
      workHoursRequired: 30,
      assetLimit: 2000
    },
    medicaid: {
      isExpanded: true,
      adultIncomeLimit: 138,
      childIncomeLimit: 200,
      pregnantIncomeLimit: 156
    }
  }
];

async function seedStateBenefitThresholds() {
  logger.info("🌱 Seeding state benefit thresholds...", {
    service: "seedStateBenefitThresholds",
    action: "start"
  });

  try {
    // Get all benefit programs
    const snapProgram = await db.query.benefitPrograms.findFirst({
      where: eq(benefitPrograms.code, "SNAP")
    });
    
    const tanfProgram = await db.query.benefitPrograms.findFirst({
      where: eq(benefitPrograms.code, "TANF")
    });
    
    const medicaidProgram = await db.query.benefitPrograms.findFirst({
      where: eq(benefitPrograms.code, "MEDICAID")
    });

    if (!snapProgram || !tanfProgram || !medicaidProgram) {
      logger.error("❌ Required benefit programs not found. Run seedBenefitPrograms first.", {
        service: "seedStateBenefitThresholds",
        action: "validatePrograms",
        programs: {
          snap: !!snapProgram,
          tanf: !!tanfProgram,
          medicaid: !!medicaidProgram
        }
      });
      return;
    }

    // Process each state
    for (const stateData of stateBenefitData) {
      logger.info(`  📍 Processing ${stateData.stateCode}...`, {
        service: "seedStateBenefitThresholds",
        action: "processState",
        stateCode: stateData.stateCode
      });

      // Find the state configuration
      const stateConfig = await db.query.stateConfigurations.findFirst({
        where: eq(stateConfigurations.stateCode, stateData.stateCode)
      });

      if (!stateConfig) {
        logger.warn(`    ⚠️  State configuration not found for ${stateData.stateCode}`, {
          service: "seedStateBenefitThresholds",
          action: "checkStateConfig",
          stateCode: stateData.stateCode
        });
        continue;
      }

      // Update or create SNAP configuration
      if (stateData.snap) {
        const snapConfig = {
          stateConfigId: stateConfig.id,
          benefitProgramId: snapProgram.id,
          stateProgramName: stateData.stateCode === "CA" ? "CalFresh" : 
                           stateData.stateCode === "WA" ? "Basic Food" :
                           stateData.stateCode === "NC" ? "Food & Nutrition Services" :
                           stateData.stateCode === "MD" ? "Food Supplement Program" : "SNAP",
          stateProgramCode: `${stateData.stateCode}_SNAP`,
          eligibilityRules: {
            incomeLimitPercentFPL: stateData.snap.incomeLimitPercent,
            hasAssetTest: stateData.snap.hasAssetTest,
            assetLimit: stateData.snap.assetLimit || null,
            workRequirementAges: stateData.snap.workRequirementAges,
            workHoursRequired: stateData.snap.workHoursRequired || null,
            hasBBCE: stateData.snap.hasBBCE,
            hasRestaurantMeals: stateData.snap.hasRestaurantMeals || false,
            ssiEligible: stateData.snap.ssiEligible || false,
            notes: stateData.snap.notes || null
          },
          benefitCalculation: {
            calculationType: "federal_standard",
            usesThriftyFoodPlan: true
          },
          applicationUrl: null,
          phoneNumber: null,
          onlinePortal: null,
          processingTime: "30 days standard, 7 days expedited",
          requiredDocuments: ["identity", "income", "residency"],
          isActive: true
        };

        const existingSnap = await storage.getStateBenefitProgramByCode(
          stateConfig.id,
          `${stateData.stateCode}_SNAP`
        );

        if (existingSnap) {
          await storage.updateStateBenefitProgram(existingSnap.id, snapConfig);
          logger.info(`    ✅ Updated SNAP configuration`, {
            service: "seedStateBenefitThresholds",
            action: "updateSNAP",
            stateCode: stateData.stateCode,
            programCode: `${stateData.stateCode}_SNAP`
          });
        } else {
          await storage.createStateBenefitProgram(snapConfig);
          logger.info(`    ✅ Created SNAP configuration`, {
            service: "seedStateBenefitThresholds",
            action: "createSNAP",
            stateCode: stateData.stateCode,
            programCode: `${stateData.stateCode}_SNAP`
          });
        }
      }

      // Update or create TANF configuration
      if (stateData.tanf) {
        const tanfConfig = {
          stateConfigId: stateConfig.id,
          benefitProgramId: tanfProgram.id,
          stateProgramName: stateData.stateCode === "CA" ? "CalWORKs" :
                           stateData.stateCode === "NJ" ? "WorkFirst NJ" :
                           stateData.stateCode === "CO" ? "Colorado Works" :
                           stateData.stateCode === "MI" ? "Family Independence Program" :
                           stateData.stateCode === "MA" ? "TAFDC" :
                           stateData.stateCode === "NC" ? "Work First" : "TANF",
          stateProgramCode: `${stateData.stateCode}_TANF`,
          eligibilityRules: {
            maxBenefitFamily3: stateData.tanf.maxBenefitFamily3,
            timeLimitMonths: stateData.tanf.timeLimitMonths,
            timeLimitLifetime: stateData.tanf.timeLimitLifetime || null,
            timeLimitConsecutive: stateData.tanf.timeLimitConsecutive || null,
            workHoursRequired: stateData.tanf.workHoursRequired,
            assetLimit: stateData.tanf.assetLimit || null,
            hasAssetTest: stateData.tanf.hasAssetTest || (stateData.tanf.assetLimit ? true : false),
            hasClothingAllowance: stateData.tanf.hasClothingAllowance || false
          },
          benefitCalculation: {
            calculationType: "state_specific",
            paymentStandard: stateData.tanf.maxBenefitFamily3
          },
          applicationUrl: null,
          phoneNumber: null,
          onlinePortal: null,
          processingTime: "30-45 days",
          requiredDocuments: ["identity", "income", "children", "residency"],
          isActive: true
        };

        const existingTanf = await storage.getStateBenefitProgramByCode(
          stateConfig.id,
          `${stateData.stateCode}_TANF`
        );

        if (existingTanf) {
          await storage.updateStateBenefitProgram(existingTanf.id, tanfConfig);
          logger.info(`    ✅ Updated TANF configuration`, {
            service: "seedStateBenefitThresholds",
            action: "updateTANF",
            stateCode: stateData.stateCode,
            programCode: `${stateData.stateCode}_TANF`
          });
        } else {
          await storage.createStateBenefitProgram(tanfConfig);
          logger.info(`    ✅ Created TANF configuration`, {
            service: "seedStateBenefitThresholds",
            action: "createTANF",
            stateCode: stateData.stateCode,
            programCode: `${stateData.stateCode}_TANF`
          });
        }
      }

      // Update or create Medicaid configuration
      if (stateData.medicaid) {
        const medicaidConfig = {
          stateConfigId: stateConfig.id,
          benefitProgramId: medicaidProgram.id,
          stateProgramName: stateData.stateCode === "CA" ? "Medi-Cal" :
                           stateData.stateCode === "MA" ? "MassHealth" :
                           stateData.stateCode === "NJ" ? "NJ FamilyCare" :
                           stateData.stateCode === "WA" ? "Apple Health" :
                           stateData.stateCode === "MI" ? "Healthy Michigan" :
                           stateData.stateCode === "AZ" ? "AHCCCS" :
                           stateData.stateCode === "CO" ? "Health First Colorado" : "Medicaid",
          stateProgramCode: `${stateData.stateCode}_MEDICAID`,
          eligibilityRules: {
            isExpanded: stateData.medicaid.isExpanded,
            expansionYear: stateData.medicaid.expansionYear || null,
            adultIncomeLimit: stateData.medicaid.adultIncomeLimit,
            childIncomeLimit: stateData.medicaid.childIncomeLimit,
            pregnantIncomeLimit: stateData.medicaid.pregnantIncomeLimit,
            coverageGap: stateData.medicaid.coverageGap || null,
            hasEssentialPlan: stateData.medicaid.hasEssentialPlan || false,
            coversUndocumented: stateData.medicaid.coversUndocumented || false
          },
          benefitCalculation: {
            calculationType: "magi",
            usesModifiedAGI: true
          },
          applicationUrl: null,
          phoneNumber: null,
          onlinePortal: null,
          processingTime: "45-90 days",
          requiredDocuments: ["identity", "income", "citizenship", "residency"],
          isActive: true
        };

        const existingMedicaid = await storage.getStateBenefitProgramByCode(
          stateConfig.id,
          `${stateData.stateCode}_MEDICAID`
        );

        if (existingMedicaid) {
          await storage.updateStateBenefitProgram(existingMedicaid.id, medicaidConfig);
          logger.info(`    ✅ Updated Medicaid configuration`, {
            service: "seedStateBenefitThresholds",
            action: "updateMedicaid",
            stateCode: stateData.stateCode,
            programCode: `${stateData.stateCode}_MEDICAID`
          });
        } else {
          await storage.createStateBenefitProgram(medicaidConfig);
          logger.info(`    ✅ Created Medicaid configuration`, {
            service: "seedStateBenefitThresholds",
            action: "createMedicaid",
            stateCode: stateData.stateCode,
            programCode: `${stateData.stateCode}_MEDICAID`
          });
        }
      }
    }

    logger.info("✅ State benefit thresholds seeding completed!", {
      service: "seedStateBenefitThresholds",
      action: "complete",
      statesProcessed: stateBenefitData.length
    });
  } catch (error) {
    logger.error("❌ Error seeding state benefit thresholds", {
      service: "seedStateBenefitThresholds",
      action: "error",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Run if executed directly
seedStateBenefitThresholds()
  .then(() => {
    logger.info("✨ Done!", {
      service: "seedStateBenefitThresholds",
      action: "finalize"
    });
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Failed to seed state benefit thresholds", {
      service: "seedStateBenefitThresholds",
      action: "fatal",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  });

export { seedStateBenefitThresholds };