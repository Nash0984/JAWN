import { db } from "../db";
import { eq } from "drizzle-orm";
import { 
  benefitPrograms,
  povertyLevels,
  ohepIncomeLimits,
  ohepBenefitTiers,
  ohepSeasonalFactors,
  tanfIncomeLimits,
  tanfAssetLimits,
  tanfWorkRequirements,
  tanfTimeLimits,
  medicaidIncomeLimits,
} from "../../shared/schema";

/**
 * Seed test data for OHEP and TANF Rules Engines
 * 
 * This populates the database with realistic Maryland rules data
 * for testing the Rules-as-Code engines.
 */
export async function seedRulesEngineData() {
  console.log("🌱 Seeding Rules Engine test data...");

  // Step 1: Get or create OHEP and TANF benefit programs
  const programs = await db.select().from(benefitPrograms);
  
  let ohepProgram = programs.find(p => p.code === "OHEP");
  let tanfProgram = programs.find(p => p.code === "TANF");

  if (!ohepProgram) {
    const [created] = await db.insert(benefitPrograms).values({
      name: "Office of Home Energy Programs",
      code: "OHEP",
      description: "Maryland energy assistance program (MEAP)",
      programType: "benefit",
      hasRulesEngine: true,
      hasPolicyEngineValidation: false,
      hasConversationalAI: true,
      isActive: true,
    }).returning();
    ohepProgram = created;
    console.log("✓ Created OHEP program");
  }

  if (!tanfProgram) {
    const [created] = await db.insert(benefitPrograms).values({
      name: "Temporary Cash Assistance (TCA)",
      code: "TANF",
      description: "Maryland TANF cash assistance program",
      programType: "benefit",
      hasRulesEngine: true,
      hasPolicyEngineValidation: true,
      hasConversationalAI: true,
      isActive: true,
    }).returning();
    tanfProgram = created;
    console.log("✓ Created TANF program");
  }

  // Step 2: Seed Federal Poverty Levels (2025 data)
  const existingFPL = await db.select().from(povertyLevels);
  if (existingFPL.length === 0) {
    const fplData = [
      { size: 1, monthly: 124500, annual: 149400 },  // $1,245/mo, $14,940/yr
      { size: 2, monthly: 168300, annual: 201960 },  // $1,683/mo, $20,196/yr
      { size: 3, monthly: 212100, annual: 254520 },  // $2,121/mo, $25,452/yr
      { size: 4, monthly: 255900, annual: 307080 },  // $2,559/mo, $30,708/yr
      { size: 5, monthly: 299700, annual: 359640 },  // $2,997/mo, $35,964/yr
      { size: 6, monthly: 343500, annual: 412200 },  // $3,435/mo, $41,220/yr
      { size: 7, monthly: 387300, annual: 464760 },  // $3,873/mo, $46,476/yr
      { size: 8, monthly: 431100, annual: 517320 },  // $4,311/mo, $51,732/yr
    ];

    for (const fpl of fplData) {
      await db.insert(povertyLevels).values({
        year: 2025,
        householdSize: fpl.size,
        monthlyIncome: fpl.monthly,
        annualIncome: fpl.annual,
        effectiveDate: new Date("2025-01-01"),
        isActive: true,
      });
    }
    console.log("✓ Seeded 2025 Federal Poverty Levels");
  }

  // Step 3: Seed OHEP Income Limits (60% FPL for regular assistance)
  const existingOhepLimits = await db.select().from(ohepIncomeLimits);
  if (existingOhepLimits.length === 0) {
    const ohepLimitsData = [
      { size: 1, monthly: 74700, annual: 89640 },    // 60% of FPL
      { size: 2, monthly: 100980, annual: 121176 },
      { size: 3, monthly: 127260, annual: 152712 },
      { size: 4, monthly: 153540, annual: 184248 },
      { size: 5, monthly: 179820, annual: 215784 },
      { size: 6, monthly: 206100, annual: 247320 },
      { size: 7, monthly: 232380, annual: 278856 },
      { size: 8, monthly: 258660, annual: 310392 },
    ];

    for (const limit of ohepLimitsData) {
      await db.insert(ohepIncomeLimits).values({
        benefitProgramId: ohepProgram!.id,
        householdSize: limit.size,
        percentOfFPL: 60,
        monthlyIncomeLimit: limit.monthly,
        annualIncomeLimit: limit.annual,
        effectiveDate: new Date("2024-10-01"),
        isActive: true,
        notes: "OHEP income limits at 60% FPL for FY2025",
      });
    }
    console.log("✓ Seeded OHEP income limits");
  }

  // Step 4: Seed OHEP Benefit Tiers
  const existingOhepTiers = await db.select().from(ohepBenefitTiers);
  if (existingOhepTiers.length === 0) {
    await db.insert(ohepBenefitTiers).values([
      {
        benefitProgramId: ohepProgram!.id,
        tierType: "crisis",
        benefitName: "Crisis Assistance",
        maxBenefitAmount: 60000, // $600 max
        eligibilityConditions: { hasDisconnectNotice: true, requiresImmediateHelp: true },
        vendorPaymentOnly: true,
        effectiveDate: new Date("2024-10-01"),
        isActive: true,
        notes: "Emergency assistance for households facing disconnect or no heat",
      },
      {
        benefitProgramId: ohepProgram!.id,
        tierType: "regular",
        benefitName: "Regular Assistance",
        maxBenefitAmount: 100000, // $1,000 max
        eligibilityConditions: { isHeatingSeasonOrCoolingSeason: true },
        vendorPaymentOnly: true,
        effectiveDate: new Date("2024-10-01"),
        isActive: true,
        notes: "Standard seasonal energy assistance",
      },
      {
        benefitProgramId: ohepProgram!.id,
        tierType: "arrearage",
        benefitName: "Arrearage Assistance",
        maxBenefitAmount: 30000, // $300 max (CORRECTED per MD DHS policy)
        eligibilityConditions: { hasPastDueBills: true, amountPastDue: ">$0" },
        vendorPaymentOnly: true,
        effectiveDate: new Date("2024-10-01"),
        isActive: true,
        notes: "Assistance with past due utility bills - $300 maximum per Maryland DHS policy",
      },
    ]);
    console.log("✓ Seeded OHEP benefit tiers");
  }

  // Step 5: Seed OHEP Seasonal Factors
  const existingSeasons = await db.select().from(ohepSeasonalFactors);
  if (existingSeasons.length === 0) {
    await db.insert(ohepSeasonalFactors).values([
      {
        benefitProgramId: ohepProgram!.id,
        season: "heating",
        startMonth: 10, // October
        endMonth: 4,    // April
        priorityGroups: ["elderly", "disabled", "children_under_6"],
        effectiveYear: 2024,
        isActive: true,
        notes: "Heating season October through April",
      },
      {
        benefitProgramId: ohepProgram!.id,
        season: "cooling",
        startMonth: 5,  // May
        endMonth: 9,    // September
        priorityGroups: ["elderly", "disabled"],
        effectiveYear: 2025,
        isActive: true,
        notes: "Cooling season May through September",
      },
    ]);
    console.log("✓ Seeded OHEP seasonal factors");
  }

  // Step 6: Seed TANF Income Limits (Needs Standard + Payment Standard)
  const existingTanfLimits = await db.select().from(tanfIncomeLimits);
  if (existingTanfLimits.length === 0) {
    // Maryland TCA Standards (simplified - actual standards are more complex)
    const tanfLimitsData = [
      { size: 1, needs: 24400, payment: 24400 },  // $244/month
      { size: 2, needs: 32200, payment: 32200 },  // $322/month
      { size: 3, needs: 40100, payment: 40100 },  // $401/month
      { size: 4, needs: 47800, payment: 47800 },  // $478/month
      { size: 5, needs: 55700, payment: 55700 },  // $557/month
      { size: 6, needs: 63400, payment: 63400 },  // $634/month
      { size: 7, needs: 71300, payment: 71300 },  // $713/month
      { size: 8, needs: 79000, payment: 79000 },  // $790/month
    ];

    for (const limit of tanfLimitsData) {
      await db.insert(tanfIncomeLimits).values({
        benefitProgramId: tanfProgram!.id,
        householdSize: limit.size,
        needsStandard: limit.needs,
        paymentStandard: limit.payment,
        effectiveDate: new Date("2024-07-01"),
        isActive: true,
        notes: "Maryland TCA needs and payment standards FY2025",
      });
    }
    console.log("✓ Seeded TANF income limits");
  }

  // Step 7: Seed TANF Asset Limits
  const existingTanfAssets = await db.select().from(tanfAssetLimits);
  if (existingTanfAssets.length === 0) {
    await db.insert(tanfAssetLimits).values([
      {
        benefitProgramId: tanfProgram!.id,
        assetType: "liquid",
        maxAssetValue: 100000, // $1,000 liquid asset limit
        exclusions: { excludes: ["one vehicle", "primary residence", "household goods"] },
        effectiveDate: new Date("2024-07-01"),
        isActive: true,
        notes: "Liquid assets include cash, checking, savings",
      },
      {
        benefitProgramId: tanfProgram!.id,
        assetType: "vehicle",
        maxAssetValue: 450000, // $4,500 vehicle equity limit
        exclusions: { excludes: ["one vehicle per working adult"] },
        effectiveDate: new Date("2024-07-01"),
        isActive: true,
        notes: "Vehicle equity = market value - loans",
      },
    ]);
    console.log("✓ Seeded TANF asset limits");
  }

  // Step 8: Seed TANF Work Requirements
  const existingTanfWork = await db.select().from(tanfWorkRequirements);
  if (existingTanfWork.length === 0) {
    await db.insert(tanfWorkRequirements).values([
      {
        benefitProgramId: tanfProgram!.id,
        householdType: "single_parent",
        requiredHoursPerWeek: 30,
        exemptionCategories: ["disabled", "caring_for_child_under_1", "pregnant_third_trimester"],
        sanctionPolicy: { firstViolation: "benefit_reduction_25_percent", secondViolation: "benefit_reduction_50_percent" },
        effectiveDate: new Date("2024-07-01"),
        isActive: true,
        notes: "Single parent work requirements - 30 hours/week minimum",
      },
      {
        benefitProgramId: tanfProgram!.id,
        householdType: "two_parent",
        requiredHoursPerWeek: 35,
        exemptionCategories: ["disabled", "caring_for_child_under_1"],
        sanctionPolicy: { firstViolation: "benefit_reduction_25_percent", secondViolation: "benefit_reduction_50_percent" },
        effectiveDate: new Date("2024-07-01"),
        isActive: true,
        notes: "Two parent work requirements - combined 35 hours/week minimum",
      },
    ]);
    console.log("✓ Seeded TANF work requirements");
  }

  // Step 9: Seed TANF Time Limits
  const existingTanfTime = await db.select().from(tanfTimeLimits);
  if (existingTanfTime.length === 0) {
    await db.insert(tanfTimeLimits).values([
      {
        benefitProgramId: tanfProgram!.id,
        limitType: "lifetime",
        maxMonths: 60,
        hardshipExemptions: ["victim_of_domestic_violence", "child_with_disability", "caring_for_disabled_family_member"],
        effectiveDate: new Date("2024-07-01"),
        isActive: true,
        notes: "Federal 60-month lifetime limit for TANF",
      },
      {
        benefitProgramId: tanfProgram!.id,
        limitType: "continuous",
        maxMonths: 24,
        hardshipExemptions: ["hardship_waiver_approved"],
        effectiveDate: new Date("2024-07-01"),
        isActive: true,
        notes: "24-month continuous assistance before review",
      },
    ]);
    console.log("✓ Seeded TANF time limits");
  }

  // ============================================================================
  // MEDICAID RULES ENGINE DATA
  // ============================================================================

  // Get or create Medicaid program
  let medicaidProgram = await db.query.benefitPrograms.findFirst({
    where: eq(benefitPrograms.code, "MEDICAID"),
  });

  if (!medicaidProgram) {
    [medicaidProgram] = await db.insert(benefitPrograms).values({
      name: "Maryland Medicaid",
      code: "MEDICAID",
      description: "Maryland's Medicaid health coverage program with MAGI and Non-MAGI pathways",
      programType: "benefit",
      hasRulesEngine: true,
      hasPolicyEngineValidation: true,
      hasConversationalAI: true,
      primarySourceUrl: "https://mmcp.health.maryland.gov/Pages/Medicaid-Manual.aspx",
      sourceType: "web_scraping",
      isActive: true,
    }).returning();
    console.log("✓ Created Medicaid program");
  }

  // Step 10: Seed Medicaid Income Limits (MAGI pathways)
  const existingMedicaidLimits = await db.select().from(medicaidIncomeLimits);
  if (existingMedicaidLimits.length === 0) {
    // MAGI Adults (138% FPL - ACA expansion)
    const adultLimits = [
      { size: 1, monthly: 172200, annual: 206640 },  // 138% FPL
      { size: 2, monthly: 232800, annual: 279360 },
      { size: 3, monthly: 293400, annual: 352080 },
      { size: 4, monthly: 354000, annual: 424800 },
    ];

    for (const limit of adultLimits) {
      await db.insert(medicaidIncomeLimits).values({
        benefitProgramId: medicaidProgram!.id,
        category: "adult",
        householdSize: limit.size,
        percentOfFPL: 138,
        monthlyIncomeLimit: limit.monthly,
        annualIncomeLimit: limit.annual,
        effectiveDate: new Date("2024-01-01"),
        isActive: true,
        notes: "MAGI Adults - Maryland Medicaid expansion (138% FPL)",
      });
    }

    // MAGI Children (322% FPL - includes CHIP)
    const childLimits = [
      { size: 2, monthly: 543600, annual: 652320 },  // 322% FPL
      { size: 3, monthly: 685200, annual: 822240 },
      { size: 4, monthly: 826800, annual: 992160 },
    ];

    for (const limit of childLimits) {
      await db.insert(medicaidIncomeLimits).values({
        benefitProgramId: medicaidProgram!.id,
        category: "child",
        householdSize: limit.size,
        percentOfFPL: 322,
        monthlyIncomeLimit: limit.monthly,
        annualIncomeLimit: limit.annual,
        effectiveDate: new Date("2024-01-01"),
        isActive: true,
        notes: "MAGI Children - Maryland includes CHIP (322% FPL)",
      });
    }

    // MAGI Pregnant (264% FPL)
    const pregnantLimits = [
      { size: 1, monthly: 329400, annual: 395280 },  // 264% FPL
      { size: 2, monthly: 445200, annual: 534240 },
      { size: 3, monthly: 561000, annual: 673200 },
    ];

    for (const limit of pregnantLimits) {
      await db.insert(medicaidIncomeLimits).values({
        benefitProgramId: medicaidProgram!.id,
        category: "pregnant",
        householdSize: limit.size,
        percentOfFPL: 264,
        monthlyIncomeLimit: limit.monthly,
        annualIncomeLimit: limit.annual,
        effectiveDate: new Date("2024-01-01"),
        isActive: true,
        notes: "MAGI Pregnant Women - Maryland (264% FPL)",
      });
    }

    // Non-MAGI Aged/Blind/Disabled (100% FPL)
    const abdLimits = [
      { size: 1, monthly: 124500, annual: 149400 },  // 100% FPL
      { size: 2, monthly: 168500, annual: 202200 },
      { size: 3, monthly: 212500, annual: 255000 },
    ];

    for (const limit of abdLimits) {
      await db.insert(medicaidIncomeLimits).values({
        benefitProgramId: medicaidProgram!.id,
        category: "elderly_disabled",
        householdSize: limit.size,
        percentOfFPL: 100,
        monthlyIncomeLimit: limit.monthly,
        annualIncomeLimit: limit.annual,
        effectiveDate: new Date("2024-01-01"),
        isActive: true,
        notes: "Non-MAGI Aged/Blind/Disabled - Maryland (100% FPL)",
      });
    }

    console.log("✓ Seeded Medicaid income limits");
  }

  console.log("✅ Rules Engine seed data complete!");
}

// Run if called directly
seedRulesEngineData()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error seeding data:", error);
    process.exit(1);
  });
