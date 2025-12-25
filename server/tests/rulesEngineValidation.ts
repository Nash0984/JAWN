import { logger } from "../services/logger.service";
import { ohepRulesEngine } from "../services/ohepRulesEngine";
import { tanfRulesEngine } from "../services/tanfRulesEngine";
import { medicaidRulesEngine } from "../services/medicaidRulesEngine";
// REMOVED - Benefits-only version: vitaTaxRulesEngine import removed
// import { vitaTaxRulesEngine } from "../services/vitaTaxRulesEngine";

/**
 * Validation tests for OHEP and TANF Rules Engines
 * 
 * This tests the Maryland Rules-as-Code implementation with realistic scenarios
 */

logger.info("🧪 Testing OHEP and TANF Rules Engines");
logger.info("=".repeat(70));

async function testOHEPEngine() {
  logger.info("📋 OHEP (Energy Assistance) Rules Engine Tests");

  // Test Case 1: Eligible household with crisis situation
  logger.info("Test 1: Single parent with child, crisis situation (disconnect notice)");
  logger.info("-".repeat(70));
  
  const ohepCase1 = await ohepRulesEngine.calculateEligibility({
    size: 2,
    grossMonthlyIncome: 90000, // $900/month
    grossAnnualIncome: 108000, // $1,080/year
    hasElderlyMember: false,
    hasDisabledMember: false,
    hasChildUnder6: true,
    isCrisisSituation: true,  // Has disconnect notice
    hasArrearage: false,
    heatingFuelType: "gas",
  });

  logger.info(`✅ Result: ${ohepCase1.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    incomeTest: ohepCase1.incomeTest.passed ? "PASS" : "FAIL",
    percentOfFPL: `${ohepCase1.incomeTest.percentOfFPL}%`,
    benefitType: ohepCase1.benefitType,
    benefitAmount: `$${(ohepCase1.benefitAmount / 100).toFixed(2)}`,
    season: ohepCase1.season,
    priorityGroup: ohepCase1.priorityGroup || undefined
  });
  
  logger.info("Calculation Breakdown:", {
    breakdown: ohepCase1.calculationBreakdown
  });

  // Test Case 2: Ineligible due to income
  logger.info("Test 2: Household exceeds income limit");
  logger.info("-".repeat(70));
  
  const ohepCase2 = await ohepRulesEngine.calculateEligibility({
    size: 3,
    grossMonthlyIncome: 300000, // $3,000/month - way over limit
    grossAnnualIncome: 360000,  // $3,600/year
    hasElderlyMember: true,
    hasDisabledMember: false,
    hasChildUnder6: false,
    isCrisisSituation: false,
    hasArrearage: true,
  });

  logger.info(`❌ Result: ${ohepCase2.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    incomeTest: ohepCase2.incomeTest.passed ? "PASS" : "FAIL",
    percentOfFPL: `${ohepCase2.incomeTest.percentOfFPL}%`,
    reason: ohepCase2.reason,
    breakdown: ohepCase2.calculationBreakdown
  });

  // Test Case 3: Regular assistance, elderly household
  logger.info("Test 3: Elderly couple, regular heating assistance");
  logger.info("-".repeat(70));
  
  const ohepCase3 = await ohepRulesEngine.calculateEligibility({
    size: 2,
    grossMonthlyIncome: 95000,  // $950/month
    grossAnnualIncome: 114000,  // $1,140/year
    hasElderlyMember: true,
    hasDisabledMember: false,
    hasChildUnder6: false,
    isCrisisSituation: false,
    hasArrearage: false,
    heatingFuelType: "oil",
  });

  logger.info(`✅ Result: ${ohepCase3.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    incomeTest: ohepCase3.incomeTest.passed ? "PASS" : "FAIL",
    percentOfFPL: `${ohepCase3.incomeTest.percentOfFPL}%`,
    benefitType: ohepCase3.benefitType,
    benefitAmount: `$${(ohepCase3.benefitAmount / 100).toFixed(2)}`,
    priorityGroup: ohepCase3.priorityGroup
  });

  // Test Case 4: Arrearage assistance - REGRESSION TEST for $300 limit
  logger.info("Test 4: Arrearage assistance (REGRESSION TEST - must be $300 max)");
  logger.info("-".repeat(70));
  
  const ohepCase4 = await ohepRulesEngine.calculateEligibility({
    size: 4,
    grossMonthlyIncome: 120000,  // $1,200/month
    grossAnnualIncome: 144000,   // $1,440/year
    hasElderlyMember: false,
    hasDisabledMember: true,
    hasChildUnder6: false,
    isCrisisSituation: false,
    hasArrearage: true,  // Has past-due bills
    heatingFuelType: "electric",
  });

  logger.info(`✅ Result: ${ohepCase4.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    incomeTest: ohepCase4.incomeTest.passed ? "PASS" : "FAIL",
    benefitType: ohepCase4.benefitType,
    benefitAmount: `$${(ohepCase4.benefitAmount / 100).toFixed(2)}`
  });
  
  // CRITICAL ASSERTION: Arrearage benefit must be exactly $300
  if (ohepCase4.benefitAmount !== 30000) {
    throw new Error(
      `❌ ARREARAGE REGRESSION TEST FAILED! ` +
      `Expected $300.00, got $${(ohepCase4.benefitAmount / 100).toFixed(2)}. ` +
      `This is a compliance violation - check seed data and DHS policy!`
    );
  }
  logger.info("✓ REGRESSION TEST PASSED: Arrearage benefit correctly capped at $300");
}

async function testTANFEngine() {
  logger.info("📋 TANF (Temporary Cash Assistance) Rules Engine Tests");

  // Test Case 1: Eligible single parent household
  logger.info("Test 1: Single parent, 2 children, meeting all requirements");
  logger.info("-".repeat(70));
  
  const tanfCase1 = await tanfRulesEngine.calculateEligibility({
    size: 3,
    countableMonthlyIncome: 30000, // $300/month - below needs standard
    liquidAssets: 50000,            // $500 - below $1,000 limit
    vehicleValue: 300000,           // $3,000 - below $4,500 limit
    hasEarnedIncome: true,
    householdType: "single_parent",
    isWorkExempt: false,
    currentWorkHours: 35,           // Exceeds 30 hour requirement
    monthsReceived: 12,              // 12 months so far
    continuousMonthsReceived: 6,
    hasHardshipExemption: false,
  });

  logger.info(`✅ Result: ${tanfCase1.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    incomeTest: `${tanfCase1.incomeTest.passed ? "PASS" : "FAIL"} ($${(tanfCase1.incomeTest.countableIncome / 100).toFixed(2)} vs $${(tanfCase1.incomeTest.needsStandard / 100).toFixed(2)} limit)`,
    assetTest: `${tanfCase1.assetTest.passed ? "PASS" : "FAIL"} ($${(tanfCase1.assetTest.actualLiquidAssets / 100).toFixed(2)} vs $${(tanfCase1.assetTest.liquidAssetLimit / 100).toFixed(2)} limit)`,
    workRequirements: `${tanfCase1.workRequirements.requirementsMet ? "MET" : "NOT MET"} (${tanfCase1.workRequirements.actualHours}/${tanfCase1.workRequirements.requiredHours} hours)`,
    timeLimits: `${tanfCase1.timeLimits.withinLimits ? "OK" : "EXCEEDED"} (${tanfCase1.timeLimits.lifetimeMonthsUsed}/${tanfCase1.timeLimits.lifetimeMonthsUsed + tanfCase1.timeLimits.lifetimeMonthsRemaining} months used)`,
    monthlyBenefit: `$${(tanfCase1.monthlyBenefit / 100).toFixed(2)}`,
    breakdown: tanfCase1.calculationBreakdown
  });

  // Test Case 2: Income too high
  logger.info("Test 2: Income exceeds needs standard");
  logger.info("-".repeat(70));
  
  const tanfCase2 = await tanfRulesEngine.calculateEligibility({
    size: 4,
    countableMonthlyIncome: 60000,  // $600/month - exceeds $478 needs standard
    liquidAssets: 20000,
    hasEarnedIncome: true,
    householdType: "two_parent",
    isWorkExempt: false,
    currentWorkHours: 40,
    monthsReceived: 24,
    continuousMonthsReceived: 12,
    hasHardshipExemption: false,
  });

  logger.info(`❌ Result: ${tanfCase2.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    reason: tanfCase2.reason,
    incomeTest: tanfCase2.incomeTest.passed ? "PASS" : "FAIL",
    ineligibilityReasons: tanfCase2.ineligibilityReasons || []
  });

  // Test Case 3: Asset test failure
  logger.info("Test 3: Assets exceed limit");
  logger.info("-".repeat(70));
  
  const tanfCase3 = await tanfRulesEngine.calculateEligibility({
    size: 2,
    countableMonthlyIncome: 20000,  // $200/month - within limit
    liquidAssets: 150000,           // $1,500 - EXCEEDS $1,000 limit
    vehicleValue: 200000,
    hasEarnedIncome: true,
    householdType: "single_parent",
    isWorkExempt: false,
    currentWorkHours: 30,
    monthsReceived: 6,
    continuousMonthsReceived: 6,
    hasHardshipExemption: false,
  });

  logger.info(`❌ Result: ${tanfCase3.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    reason: tanfCase3.reason,
    assetTest: tanfCase3.assetTest.passed ? "PASS" : "FAIL",
    ineligibilityReasons: tanfCase3.ineligibilityReasons || []
  });

  // Test Case 4: Work requirement not met
  logger.info("Test 4: Work requirement not met (would result in sanction)");
  logger.info("-".repeat(70));
  
  const tanfCase4 = await tanfRulesEngine.calculateEligibility({
    size: 3,
    countableMonthlyIncome: 25000,
    liquidAssets: 30000,
    hasEarnedIncome: true,
    householdType: "single_parent",
    isWorkExempt: false,
    currentWorkHours: 15,  // Only 15 hours - needs 30
    monthsReceived: 18,
    continuousMonthsReceived: 10,
    hasHardshipExemption: false,
  });

  logger.info(`✅ Result: ${tanfCase4.isEligible ? "ELIGIBLE" : "INELIGIBLE"} (but sanctions may apply)`, {
    workRequirements: `${tanfCase4.workRequirements.requirementsMet ? "MET" : "NOT MET"} (${tanfCase4.workRequirements.actualHours}/${tanfCase4.workRequirements.requiredHours} hours)`,
    monthlyBenefit: `$${(tanfCase4.monthlyBenefit / 100).toFixed(2)} (before sanctions)`,
    note: "Sanctions would reduce benefit by 25% for first violation"
  });

  // Test Case 5: Exempt from work requirements
  logger.info("Test 5: Work requirement exempt (disabled)");
  logger.info("-".repeat(70));
  
  const tanfCase5 = await tanfRulesEngine.calculateEligibility({
    size: 2,
    countableMonthlyIncome: 15000,
    liquidAssets: 40000,
    hasEarnedIncome: false,
    householdType: "single_parent",
    isWorkExempt: true,
    exemptionReason: "disabled",
    currentWorkHours: 0,
    monthsReceived: 30,
    continuousMonthsReceived: 15,
    hasHardshipExemption: false,
  });

  logger.info(`✅ Result: ${tanfCase5.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    workRequirements: `${tanfCase5.workRequirements.requirementsMet ? "MET" : "NOT MET"} (${tanfCase5.workRequirements.isExempt ? "EXEMPT" : "NOT EXEMPT"})`,
    exemptionReason: tanfCase5.workRequirements.exemptionReason,
    monthlyBenefit: `$${(tanfCase5.monthlyBenefit / 100).toFixed(2)}`
  });
}

async function testMedicaidEngine() {
  logger.info("📋 Medicaid (Health Coverage) Rules Engine Tests");

  // Test Case 1: MAGI Adult (19-64, under 138% FPL)
  logger.info("Test 1: MAGI Adult eligible (ACA expansion)");
  logger.info("-".repeat(70));
  
  const medicaidCase1 = await medicaidRulesEngine.calculateEligibility({
    size: 2,
    age: 35,
    monthlyIncome: 180000,  // $1,800/month
    annualIncome: 216000,   // $2,160/year - under 138% FPL ($2,328)
    isPregnant: false,
    isSSIRecipient: false,
    isDisabled: false,
    isBlind: false,
    isElderly: false,
  });

  logger.info(`✅ Result: ${medicaidCase1.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    category: `${medicaidCase1.categoryName} (${medicaidCase1.pathway})`,
    incomeTest: medicaidCase1.incomeTest.passed ? "PASS" : "FAIL",
    percentOfFPL: `${medicaidCase1.incomeTest.percentOfFPL}%`,
    coverageType: medicaidCase1.coverageType,
    breakdown: medicaidCase1.calculationBreakdown
  });

  // Test Case 2: MAGI Child eligible (under 322% FPL includes CHIP)
  logger.info("Test 2: MAGI Child eligible (high income - CHIP)");
  logger.info("-".repeat(70));
  
  const medicaidCase2 = await medicaidRulesEngine.calculateEligibility({
    size: 3,
    age: 10,
    monthlyIncome: 600000,  // $6,000/month
    annualIncome: 720000,   // $7,200/year - under 322% FPL ($8,222)
    isPregnant: false,
    isSSIRecipient: false,
  });

  logger.info(`✅ Result: ${medicaidCase2.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    category: `${medicaidCase2.categoryName} (${medicaidCase2.pathway})`,
    incomeTest: medicaidCase2.incomeTest.passed ? "PASS" : "FAIL",
    coverageType: medicaidCase2.coverageType
  });

  // Test Case 3: MAGI Pregnant eligible (264% FPL)
  logger.info("Test 3: MAGI Pregnant woman eligible");
  logger.info("-".repeat(70));
  
  const medicaidCase3 = await medicaidRulesEngine.calculateEligibility({
    size: 2,
    age: 28,
    monthlyIncome: 400000,  // $4,000/month
    annualIncome: 480000,   // $4,800/year - under 264% FPL ($5,342)
    isPregnant: true,
    isSSIRecipient: false,
  });

  logger.info(`✅ Result: ${medicaidCase3.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    category: `${medicaidCase3.categoryName} (${medicaidCase3.pathway})`,
    incomeTest: medicaidCase3.incomeTest.passed ? "PASS" : "FAIL",
    coverageType: medicaidCase3.coverageType
  });

  // Test Case 4: SSI recipient - automatic eligibility
  logger.info("Test 4: SSI recipient - automatic eligibility");
  logger.info("-".repeat(70));
  
  const medicaidCase4 = await medicaidRulesEngine.calculateEligibility({
    size: 1,
    age: 70,
    monthlyIncome: 100000,  // $1,000/month from SSI
    annualIncome: 120000,   // $1,200/year
    isSSIRecipient: true,
    isElderly: true,
  });

  logger.info(`✅ Result: ${medicaidCase4.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    category: `${medicaidCase4.categoryName} (${medicaidCase4.pathway})`,
    incomeTest: medicaidCase4.incomeTest.testType,
    coverageType: medicaidCase4.coverageType
  });

  // Test Case 5: Non-MAGI Aged/Blind/Disabled eligible
  logger.info("Test 5: Non-MAGI Aged/Blind/Disabled eligible");
  logger.info("-".repeat(70));
  
  const medicaidCase5 = await medicaidRulesEngine.calculateEligibility({
    size: 1,
    age: 68,
    monthlyIncome: 120000,  // $1,200/month - under 100% FPL ($1,245)
    annualIncome: 144000,   // $1,440/year
    isSSIRecipient: false,
    isElderly: true,
    countableAssets: 150000,  // $1,500 - under $2,000 limit
  });

  logger.info(`✅ Result: ${medicaidCase5.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    category: `${medicaidCase5.categoryName} (${medicaidCase5.pathway})`,
    incomeTest: medicaidCase5.incomeTest.passed ? "PASS" : "FAIL",
    assetTest: medicaidCase5.assetTest?.passed ? "PASS" : "FAIL",
    coverageType: medicaidCase5.coverageType
  });

  // Test Case 6: MAGI Adult ineligible (income too high)
  logger.info("Test 6: MAGI Adult ineligible (exceeds 138% FPL)");
  logger.info("-".repeat(70));
  
  const medicaidCase6 = await medicaidRulesEngine.calculateEligibility({
    size: 1,
    age: 45,
    monthlyIncome: 250000,  // $2,500/month - exceeds 138% FPL ($1,722)
    annualIncome: 300000,   // $3,000/year
    isPregnant: false,
    isSSIRecipient: false,
  });

  logger.info(`❌ Result: ${medicaidCase6.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`, {
    category: `${medicaidCase6.categoryName} (${medicaidCase6.pathway})`,
    incomeTest: medicaidCase6.incomeTest.passed ? "PASS" : "FAIL",
    reason: medicaidCase6.reason,
    spenddown: medicaidCase6.coverageType === "Medically Needy" && medicaidCase6.hasSpenddown 
      ? `May qualify with spenddown: $${(medicaidCase6.spenddownAmount! / 100).toFixed(2)}/month` 
      : undefined
  });
}

async function testVITATaxEngine() {
  logger.info("📋 VITA Tax (Federal + Maryland State) Rules Engine Tests");

  // Test Case 1: Low-income single filer with 2 children (EITC eligible)
  logger.info("Test 1: Low-income single parent with 2 children (EITC + CTC)");
  logger.info("-".repeat(70));
  
  const taxCase1 = await vitaTaxRulesEngine.calculateTax({
    filingStatus: "single",
    taxYear: 2024,
    wages: 2500000,  // $25,000/year
    otherIncome: 0,
    numberOfQualifyingChildren: 2,
    dependents: 2,
    marylandCounty: "baltimore_city",
    marylandResidentMonths: 12,
  });

  logger.info("Tax calculation results", {
    federalTax: `$${(taxCase1.federalTax.totalFederalTax / 100).toFixed(2)}`,
    eitc: `$${(taxCase1.federalTax.eitc / 100).toFixed(2)}`,
    ctc: `$${(taxCase1.federalTax.childTaxCredit / 100).toFixed(2)}`,
    marylandTax: `$${(taxCase1.marylandTax.totalMarylandTax / 100).toFixed(2)}`,
    marylandEITC: `$${(taxCase1.marylandTax.marylandEITC / 100).toFixed(2)}`,
    totalRefund: `✅ $${(taxCase1.totalRefund / 100).toFixed(2)}`
  });

  // Test Case 2: Middle-income married filing jointly with 1 child
  logger.info("Test 2: Middle-income married couple with 1 child");
  logger.info("-".repeat(70));
  
  const taxCase2 = await vitaTaxRulesEngine.calculateTax({
    filingStatus: "married_joint",
    taxYear: 2024,
    wages: 7500000,  // $75,000/year
    otherIncome: 500000, // $5,000 interest/dividends
    numberOfQualifyingChildren: 1,
    dependents: 1,
    marylandCounty: "montgomery",
    marylandResidentMonths: 12,
  });

  logger.info("Tax calculation results", {
    federalTax: `$${(taxCase2.federalTax.totalFederalTax / 100).toFixed(2)}`,
    incomeTaxBeforeCredits: `$${(taxCase2.federalTax.incomeTaxBeforeCredits / 100).toFixed(2)}`,
    ctc: `$${(taxCase2.federalTax.childTaxCredit / 100).toFixed(2)}`,
    marylandTax: `$${(taxCase2.marylandTax.totalMarylandTax / 100).toFixed(2)}`,
    jurisdiction: `State + ${taxCase2.marylandTax.countyName} County`,
    totalTaxOwed: `$${(taxCase2.totalTaxLiability / 100).toFixed(2)}`
  });

  // Test Case 3: Head of household with 3 children (maximum EITC)
  logger.info("Test 3: Head of household with 3 children (maximum EITC scenario)");
  logger.info("-".repeat(70));
  
  const taxCase3 = await vitaTaxRulesEngine.calculateTax({
    filingStatus: "head_of_household",
    taxYear: 2024,
    wages: 1500000,  // $15,000/year - low income
    otherIncome: 0,
    numberOfQualifyingChildren: 3,
    dependents: 3,
    marylandCounty: "prince_georges",
    marylandResidentMonths: 12,
  });

  logger.info("Tax calculation results", {
    federalTax: `$${(taxCase3.federalTax.totalFederalTax / 100).toFixed(2)}`,
    eitc: `$${(taxCase3.federalTax.eitc / 100).toFixed(2)}`,
    ctc: `$${(taxCase3.federalTax.childTaxCredit / 100).toFixed(2)}`,
    marylandTax: `$${(taxCase3.marylandTax.totalMarylandTax / 100).toFixed(2)}`,
    totalRefund: `✅ $${(taxCase3.totalRefund / 100).toFixed(2)}`
  });

  // Test Case 4: Single filer, no children, moderate income
  logger.info("Test 4: Single filer, no children, moderate income");
  logger.info("-".repeat(70));
  
  const taxCase4 = await vitaTaxRulesEngine.calculateTax({
    filingStatus: "single",
    taxYear: 2024,
    wages: 5000000,  // $50,000/year
    otherIncome: 0,
    numberOfQualifyingChildren: 0,
    dependents: 0,
    marylandCounty: "howard",
    marylandResidentMonths: 12,
  });

  logger.info("Tax calculation results", {
    federalTax: `$${(taxCase4.federalTax.totalFederalTax / 100).toFixed(2)}`,
    incomeTaxBeforeCredits: `$${(taxCase4.federalTax.incomeTaxBeforeCredits / 100).toFixed(2)}`,
    marylandTax: `$${(taxCase4.marylandTax.totalMarylandTax / 100).toFixed(2)}`,
    totalTaxOwed: `$${(taxCase4.totalTaxLiability / 100).toFixed(2)}`
  });

  // Test Case 5: County tax rate comparison (Talbot vs Baltimore City)
  logger.info("Test 5: County tax rate impact - Talbot County (lowest) vs Baltimore City (highest)");
  logger.info("-".repeat(70));
  
  const taxCase5a = await vitaTaxRulesEngine.calculateTax({
    filingStatus: "married_joint",
    taxYear: 2024,
    wages: 10000000,  // $100,000/year
    otherIncome: 0,
    numberOfQualifyingChildren: 0,
    dependents: 0,
    marylandCounty: "talbot", // 2.25% - lowest
    marylandResidentMonths: 12,
  });

  const taxCase5b = await vitaTaxRulesEngine.calculateTax({
    filingStatus: "married_joint",
    taxYear: 2024,
    wages: 10000000,  // $100,000/year - same income
    otherIncome: 0,
    numberOfQualifyingChildren: 0,
    dependents: 0,
    marylandCounty: "baltimore_city", // 3.20% - highest
    marylandResidentMonths: 12,
  });

  const countyDifference = taxCase5b.marylandTax.countyTax - taxCase5a.marylandTax.countyTax;
  
  logger.info("County tax comparison", {
    talbotCounty: {
      rate: "2.25%",
      countyTax: `$${(taxCase5a.marylandTax.countyTax / 100).toFixed(2)}`,
      totalMarylandTax: `$${(taxCase5a.marylandTax.totalMarylandTax / 100).toFixed(2)}`
    },
    baltimoreCity: {
      rate: "3.20%",
      countyTax: `$${(taxCase5b.marylandTax.countyTax / 100).toFixed(2)}`,
      totalMarylandTax: `$${(taxCase5b.marylandTax.totalMarylandTax / 100).toFixed(2)}`
    },
    difference: `💡 County Tax Difference: $${(countyDifference / 100).toFixed(2)} higher in Baltimore City`
  });
}

async function runValidationTests() {
  try {
    await testOHEPEngine();
    await testTANFEngine();
    await testMedicaidEngine();
    await testVITATaxEngine();
    
    logger.info("=".repeat(70));
    logger.info("✅ All validation tests completed successfully!", {
      testsCompleted: {
        ohep: "4 test scenarios (energy assistance)",
        tanf: "5 test scenarios (cash assistance)",
        medicaid: "6 test scenarios (health coverage)",
        vitaTax: "5 test scenarios (federal + state tax)"
      }
    });
    logger.info("=".repeat(70));
    
    process.exit(0);
  } catch (error) {
    logger.error("❌ Validation tests failed:", error);
    process.exit(1);
  }
}

runValidationTests();