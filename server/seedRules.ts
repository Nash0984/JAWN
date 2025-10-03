import { storage } from "./storage";
import { db } from "./db";
import { benefitPrograms } from "../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Seed Maryland SNAP Rules for FY 2025 (October 2024 - September 2025)
 * 
 * Data sources:
 * - Federal Poverty Guidelines 2024
 * - SNAP Income Limits (200% FPL gross, 100% FPL net)
 * - Standard Deduction, Earned Income Deduction (20%), Shelter Cap
 * - Maximum Allotments FY 2025
 */

async function seedMarylandSNAPRules() {
  console.log("🌱 Seeding Maryland SNAP Rules...");

  // Get or create Maryland SNAP program
  const [snapProgram] = await db
    .select()
    .from(benefitPrograms)
    .where(eq(benefitPrograms.code, "MD_SNAP"))
    .limit(1);

  if (!snapProgram) {
    console.error("❌ Maryland SNAP program not found! Please seed benefit programs first.");
    return;
  }

  const benefitProgramId = snapProgram.id;
  const effectiveDate = new Date("2024-10-01");
  const endDate = new Date("2025-09-30");

  console.log(`✓ Found Maryland SNAP program: ${snapProgram.name} (${benefitProgramId})`);

  // ============================================================================
  // 1. FEDERAL POVERTY LEVELS 2024
  // ============================================================================
  console.log("\n📊 Seeding 2024 Federal Poverty Levels...");

  const povertyLevelsData = [
    { size: 1, monthly: 115050, annual: 1380600 },   // $1,150.50/month, $13,806/year
    { size: 2, monthly: 155450, annual: 1865400 },   // $1,554.50/month, $18,654/year
    { size: 3, monthly: 195850, annual: 2350200 },   // $1,958.50/month, $23,502/year
    { size: 4, monthly: 236250, annual: 2835000 },   // $2,362.50/month, $28,350/year
    { size: 5, monthly: 276650, annual: 3319800 },   // $2,766.50/month, $33,198/year
    { size: 6, monthly: 317050, annual: 3804600 },   // $3,170.50/month, $38,046/year
    { size: 7, monthly: 357450, annual: 4289400 },   // $3,574.50/month, $42,894/year
    { size: 8, monthly: 397850, annual: 4774200 },   // $3,978.50/month, $47,742/year
  ];

  for (const level of povertyLevelsData) {
    await storage.createPovertyLevel({
      year: 2024,
      householdSize: level.size,
      monthlyIncome: level.monthly,
      annualIncome: level.annual,
      effectiveDate,
      endDate,
      isActive: true,
      createdBy: null,
    });
  }

  console.log(`✓ Seeded ${povertyLevelsData.length} poverty level records`);

  // ============================================================================
  // 2. SNAP INCOME LIMITS (200% FPL gross, 100% FPL net)
  // ============================================================================
  console.log("\n💰 Seeding SNAP Income Limits...");

  const incomeLimitsData = [
    { size: 1, gross: 230100, net: 115050 },  // $2,301/month gross, $1,150.50 net
    { size: 2, gross: 310900, net: 155450 },  // $3,109/month gross, $1,554.50 net
    { size: 3, gross: 391700, net: 195850 },  // $3,917/month gross, $1,958.50 net
    { size: 4, gross: 472500, net: 236250 },  // $4,725/month gross, $2,362.50 net
    { size: 5, gross: 553300, net: 276650 },  // $5,533/month gross, $2,766.50 net
    { size: 6, gross: 634100, net: 317050 },  // $6,341/month gross, $3,170.50 net
    { size: 7, gross: 714900, net: 357450 },  // $7,149/month gross, $3,574.50 net
    { size: 8, gross: 795700, net: 397850 },  // $7,957/month gross, $3,978.50 net
  ];

  for (const limit of incomeLimitsData) {
    await storage.createSnapIncomeLimit({
      benefitProgramId,
      householdSize: limit.size,
      grossMonthlyLimit: limit.gross,
      netMonthlyLimit: limit.net,
      percentOfPoverty: 200, // 200% FPL for gross
      effectiveDate,
      endDate,
      isActive: true,
      notes: "FY 2025 Maryland SNAP income limits",
      createdBy: null,
      approvedBy: null,
      approvedAt: null,
    });
  }

  console.log(`✓ Seeded ${incomeLimitsData.length} income limit records`);

  // ============================================================================
  // 3. SNAP DEDUCTIONS
  // ============================================================================
  console.log("\n📉 Seeding SNAP Deductions...");

  const deductions = [
    {
      deductionType: "standard",
      deductionName: "Standard Deduction",
      calculationType: "fixed",
      amount: 19300, // $193 for households 1-3, $229 for 4+
      percentage: null,
      minAmount: null,
      maxAmount: null,
      conditions: { note: "$193 for 1-3 persons, $229 for 4+ persons" },
      notes: "Standard deduction applied to all households",
    },
    {
      deductionType: "earned_income",
      deductionName: "Earned Income Deduction",
      calculationType: "percentage",
      amount: null,
      percentage: 20, // 20% of earned income
      minAmount: null,
      maxAmount: null,
      conditions: null,
      notes: "20% of gross earned income",
    },
    {
      deductionType: "dependent_care",
      deductionName: "Dependent Care Deduction",
      calculationType: "capped",
      amount: null,
      percentage: null,
      minAmount: null,
      maxAmount: 20000000, // No standard cap, actual expenses allowed
      conditions: { required: "Care expenses for dependents to allow work, training, or education" },
      notes: "Actual dependent care costs (child care, disabled adult care)",
    },
    {
      deductionType: "medical",
      deductionName: "Medical Expense Deduction",
      calculationType: "tiered",
      amount: null,
      percentage: null,
      minAmount: 3500, // $35 threshold
      maxAmount: null, // No maximum
      conditions: { eligibility: "Only for elderly (60+) or disabled household members" },
      notes: "Medical expenses over $35/month for elderly or disabled",
    },
    {
      deductionType: "shelter",
      deductionName: "Excess Shelter Deduction",
      calculationType: "capped",
      amount: null,
      percentage: null,
      minAmount: null,
      maxAmount: 67700, // $677 cap for non-elderly/disabled FY 2025
      conditions: { formula: "Shelter costs exceeding 50% of income after other deductions" },
      notes: "Excess shelter costs (rent + utilities over 50% of income). No cap for elderly/disabled.",
    },
  ];

  for (const deduction of deductions) {
    await storage.createSnapDeduction({
      benefitProgramId,
      ...deduction,
      effectiveDate,
      endDate,
      isActive: true,
      createdBy: null,
      approvedBy: null,
      approvedAt: null,
    });
  }

  console.log(`✓ Seeded ${deductions.length} deduction rules`);

  // ============================================================================
  // 4. SNAP MAXIMUM ALLOTMENTS (FY 2025)
  // ============================================================================
  console.log("\n🍽️  Seeding SNAP Maximum Allotments...");

  const allotmentsData = [
    { size: 1, max: 29100, min: 2300 },  // $291/month, $23 min
    { size: 2, max: 53500, min: 2300 },  // $535/month, $23 min
    { size: 3, max: 76600, min: null },  // $766/month
    { size: 4, max: 97500, min: null },  // $975/month
    { size: 5, max: 115700, min: null }, // $1,157/month
    { size: 6, max: 138900, min: null }, // $1,389/month
    { size: 7, max: 153500, min: null }, // $1,535/month
    { size: 8, max: 175400, min: null }, // $1,754/month
  ];

  for (const allotment of allotmentsData) {
    await storage.createSnapAllotment({
      benefitProgramId,
      householdSize: allotment.size,
      maxMonthlyBenefit: allotment.max,
      minMonthlyBenefit: allotment.min,
      effectiveDate,
      endDate,
      isActive: true,
      notes: "FY 2025 maximum SNAP allotments",
      createdBy: null,
      approvedBy: null,
      approvedAt: null,
    });
  }

  console.log(`✓ Seeded ${allotmentsData.length} allotment records`);

  // ============================================================================
  // 5. CATEGORICAL ELIGIBILITY RULES
  // ============================================================================
  console.log("\n✅ Seeding Categorical Eligibility Rules...");

  const categoricalRules = [
    {
      ruleName: "SSI Recipients",
      ruleCode: "SSI",
      description: "Supplemental Security Income recipients are categorically eligible",
      bypassGrossIncomeTest: true,
      bypassAssetTest: true,
      bypassNetIncomeTest: false,
      conditions: { receives: "Supplemental Security Income (SSI)" },
    },
    {
      ruleName: "TANF Recipients",
      ruleCode: "TANF",
      description: "Temporary Assistance for Needy Families recipients are categorically eligible",
      bypassGrossIncomeTest: true,
      bypassAssetTest: true,
      bypassNetIncomeTest: false,
      conditions: { receives: "Temporary Assistance for Needy Families (TANF)" },
    },
    {
      ruleName: "General Assistance Recipients",
      ruleCode: "GA",
      description: "General Assistance recipients are categorically eligible",
      bypassGrossIncomeTest: true,
      bypassAssetTest: true,
      bypassNetIncomeTest: false,
      conditions: { receives: "General Assistance (GA)" },
    },
    {
      ruleName: "Broad-Based Categorical Eligibility",
      ruleCode: "BBCE",
      description: "Maryland's Broad-Based Categorical Eligibility - eliminates asset test",
      bypassGrossIncomeTest: false,
      bypassAssetTest: true,
      bypassNetIncomeTest: false,
      conditions: { note: "Households meeting income limits qualify without asset test" },
    },
  ];

  for (const rule of categoricalRules) {
    await storage.createCategoricalEligibilityRule({
      benefitProgramId,
      ...rule,
      effectiveDate,
      endDate,
      isActive: true,
      notes: "Maryland SNAP categorical eligibility rules",
      createdBy: null,
      approvedBy: null,
      approvedAt: null,
    });
  }

  console.log(`✓ Seeded ${categoricalRules.length} categorical eligibility rules`);

  // ============================================================================
  // 6. DOCUMENT REQUIREMENT RULES
  // ============================================================================
  console.log("\n📄 Seeding Document Requirement Rules...");

  const documentRules = [
    {
      requirementName: "Proof of Income",
      documentType: "income",
      requiredWhen: { hasIncome: true },
      acceptableDocuments: [
        "Pay stubs (most recent 4 weeks)",
        "Self-employment records",
        "Employer statement",
        "Award letters (SSI, SSDI, unemployment)",
      ],
      validityPeriod: 60, // 60 days
      isRequired: true,
      canBeWaived: false,
      waiverConditions: null,
      notes: "Required for all households with earned or unearned income",
    },
    {
      requirementName: "Proof of Identity",
      documentType: "identity",
      requiredWhen: { always: true },
      acceptableDocuments: [
        "Driver's license",
        "State ID card",
        "Birth certificate",
        "Passport",
      ],
      validityPeriod: null, // No expiration
      isRequired: true,
      canBeWaived: false,
      waiverConditions: null,
      notes: "Required for at least one household member",
    },
    {
      requirementName: "Proof of Residency",
      documentType: "residency",
      requiredWhen: { always: true },
      acceptableDocuments: [
        "Utility bill",
        "Rent receipt or lease",
        "Mail with current address",
        "Mortgage statement",
      ],
      validityPeriod: 60, // 60 days
      isRequired: true,
      canBeWaived: false,
      waiverConditions: null,
      notes: "Must show Maryland residency",
    },
    {
      requirementName: "Proof of Shelter Costs",
      documentType: "expenses",
      requiredWhen: { hasShelterCosts: true },
      acceptableDocuments: [
        "Rent receipt",
        "Lease agreement",
        "Mortgage statement",
        "Property tax bill",
        "Utility bills",
      ],
      validityPeriod: 60, // 60 days
      isRequired: false,
      canBeWaived: true,
      waiverConditions: { homeless: true },
      notes: "Required to claim shelter deduction",
    },
    {
      requirementName: "Proof of Dependent Care Expenses",
      documentType: "expenses",
      requiredWhen: { hasDependentCare: true },
      acceptableDocuments: [
        "Child care provider receipts",
        "Day care invoice",
        "Adult care facility statement",
      ],
      validityPeriod: 60, // 60 days
      isRequired: false,
      canBeWaived: false,
      waiverConditions: null,
      notes: "Required to claim dependent care deduction",
    },
    {
      requirementName: "Proof of Medical Expenses",
      documentType: "expenses",
      requiredWhen: { hasMedicalExpenses: true },
      acceptableDocuments: [
        "Medical bills",
        "Prescription receipts",
        "Insurance statements",
        "Medicare/Medicaid statements",
      ],
      validityPeriod: 60, // 60 days
      isRequired: false,
      canBeWaived: false,
      waiverConditions: null,
      notes: "Required for elderly (60+) or disabled to claim medical deduction",
    },
  ];

  for (const rule of documentRules) {
    await storage.createDocumentRequirementRule({
      benefitProgramId,
      ...rule,
      effectiveDate,
      endDate,
      isActive: true,
      createdBy: null,
      approvedBy: null,
      approvedAt: null,
    });
  }

  console.log(`✓ Seeded ${documentRules.length} document requirement rules`);

  console.log("\n✨ Maryland SNAP Rules seeding complete!\n");
}

export { seedMarylandSNAPRules };

// Run the seed script if executed directly
seedMarylandSNAPRules()
  .then(() => {
    console.log("✓ Seeding completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });
