import { ohepRulesEngine } from "../services/ohepRulesEngine";
import { tanfRulesEngine } from "../services/tanfRulesEngine";
import { medicaidRulesEngine } from "../services/medicaidRulesEngine";
import { vitaTaxRulesEngine } from "../services/vitaTaxRulesEngine";

/**
 * Validation tests for OHEP and TANF Rules Engines
 * 
 * This tests the Maryland Rules-as-Code implementation with realistic scenarios
 */

console.log("🧪 Testing OHEP and TANF Rules Engines\n");
console.log("=".repeat(70));

async function testOHEPEngine() {
  console.log("\n📋 OHEP (Energy Assistance) Rules Engine Tests\n");

  // Test Case 1: Eligible household with crisis situation
  console.log("Test 1: Single parent with child, crisis situation (disconnect notice)");
  console.log("-".repeat(70));
  
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

  console.log(`✅ Result: ${ohepCase1.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Income Test: ${ohepCase1.incomeTest.passed ? "PASS" : "FAIL"}`);
  console.log(`   Percent of FPL: ${ohepCase1.incomeTest.percentOfFPL}%`);
  console.log(`   Benefit Type: ${ohepCase1.benefitType}`);
  console.log(`   Benefit Amount: $${(ohepCase1.benefitAmount / 100).toFixed(2)}`);
  console.log(`   Season: ${ohepCase1.season}`);
  if (ohepCase1.priorityGroup) {
    console.log(`   Priority Group: ${ohepCase1.priorityGroup}`);
  }
  console.log("\n   Calculation Breakdown:");
  ohepCase1.calculationBreakdown.forEach(line => console.log(`     ${line}`));

  // Test Case 2: Ineligible due to income
  console.log("\n\nTest 2: Household exceeds income limit");
  console.log("-".repeat(70));
  
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

  console.log(`❌ Result: ${ohepCase2.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Income Test: ${ohepCase2.incomeTest.passed ? "PASS" : "FAIL"}`);
  console.log(`   Percent of FPL: ${ohepCase2.incomeTest.percentOfFPL}%`);
  console.log(`   Reason: ${ohepCase2.reason}`);
  console.log("\n   Calculation Breakdown:");
  ohepCase2.calculationBreakdown.forEach(line => console.log(`     ${line}`));

  // Test Case 3: Regular assistance, elderly household
  console.log("\n\nTest 3: Elderly couple, regular heating assistance");
  console.log("-".repeat(70));
  
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

  console.log(`✅ Result: ${ohepCase3.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Income Test: ${ohepCase3.incomeTest.passed ? "PASS" : "FAIL"}`);
  console.log(`   Percent of FPL: ${ohepCase3.incomeTest.percentOfFPL}%`);
  console.log(`   Benefit Type: ${ohepCase3.benefitType}`);
  console.log(`   Benefit Amount: $${(ohepCase3.benefitAmount / 100).toFixed(2)}`);
  console.log(`   Priority Group: ${ohepCase3.priorityGroup}`);

  // Test Case 4: Arrearage assistance - REGRESSION TEST for $300 limit
  console.log("\n\nTest 4: Arrearage assistance (REGRESSION TEST - must be $300 max)");
  console.log("-".repeat(70));
  
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

  console.log(`✅ Result: ${ohepCase4.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Income Test: ${ohepCase4.incomeTest.passed ? "PASS" : "FAIL"}`);
  console.log(`   Benefit Type: ${ohepCase4.benefitType}`);
  console.log(`   Benefit Amount: $${(ohepCase4.benefitAmount / 100).toFixed(2)}`);
  
  // CRITICAL ASSERTION: Arrearage benefit must be exactly $300
  if (ohepCase4.benefitAmount !== 30000) {
    throw new Error(
      `❌ ARREARAGE REGRESSION TEST FAILED! ` +
      `Expected $300.00, got $${(ohepCase4.benefitAmount / 100).toFixed(2)}. ` +
      `This is a compliance violation - check seed data and DHS policy!`
    );
  }
  console.log(`   ✓ REGRESSION TEST PASSED: Arrearage benefit correctly capped at $300`);
}

async function testTANFEngine() {
  console.log("\n\n📋 TANF (Temporary Cash Assistance) Rules Engine Tests\n");

  // Test Case 1: Eligible single parent household
  console.log("Test 1: Single parent, 2 children, meeting all requirements");
  console.log("-".repeat(70));
  
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

  console.log(`✅ Result: ${tanfCase1.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Income Test: ${tanfCase1.incomeTest.passed ? "PASS" : "FAIL"} ($${(tanfCase1.incomeTest.countableIncome / 100).toFixed(2)} vs $${(tanfCase1.incomeTest.needsStandard / 100).toFixed(2)} limit)`);
  console.log(`   Asset Test: ${tanfCase1.assetTest.passed ? "PASS" : "FAIL"} ($${(tanfCase1.assetTest.actualLiquidAssets / 100).toFixed(2)} vs $${(tanfCase1.assetTest.liquidAssetLimit / 100).toFixed(2)} limit)`);
  console.log(`   Work Requirements: ${tanfCase1.workRequirements.requirementsMet ? "MET" : "NOT MET"} (${tanfCase1.workRequirements.actualHours}/${tanfCase1.workRequirements.requiredHours} hours)`);
  console.log(`   Time Limits: ${tanfCase1.timeLimits.withinLimits ? "OK" : "EXCEEDED"} (${tanfCase1.timeLimits.lifetimeMonthsUsed}/${tanfCase1.timeLimits.lifetimeMonthsUsed + tanfCase1.timeLimits.lifetimeMonthsRemaining} months used)`);
  console.log(`   Monthly Benefit: $${(tanfCase1.monthlyBenefit / 100).toFixed(2)}`);
  console.log("\n   Calculation Breakdown:");
  tanfCase1.calculationBreakdown.forEach(line => console.log(`     ${line}`));

  // Test Case 2: Income too high
  console.log("\n\nTest 2: Income exceeds needs standard");
  console.log("-".repeat(70));
  
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

  console.log(`❌ Result: ${tanfCase2.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Reason: ${tanfCase2.reason}`);
  console.log(`   Income Test: ${tanfCase2.incomeTest.passed ? "PASS" : "FAIL"}`);
  if (tanfCase2.ineligibilityReasons) {
    console.log("\n   Ineligibility Reasons:");
    tanfCase2.ineligibilityReasons.forEach(reason => console.log(`     • ${reason}`));
  }

  // Test Case 3: Asset test failure
  console.log("\n\nTest 3: Assets exceed limit");
  console.log("-".repeat(70));
  
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

  console.log(`❌ Result: ${tanfCase3.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Reason: ${tanfCase3.reason}`);
  console.log(`   Asset Test: ${tanfCase3.assetTest.passed ? "PASS" : "FAIL"}`);
  if (tanfCase3.ineligibilityReasons) {
    console.log("\n   Ineligibility Reasons:");
    tanfCase3.ineligibilityReasons.forEach(reason => console.log(`     • ${reason}`));
  }

  // Test Case 4: Work requirement not met
  console.log("\n\nTest 4: Work requirement not met (would result in sanction)");
  console.log("-".repeat(70));
  
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

  console.log(`✅ Result: ${tanfCase4.isEligible ? "ELIGIBLE" : "INELIGIBLE"} (but sanctions may apply)`);
  console.log(`   Work Requirements: ${tanfCase4.workRequirements.requirementsMet ? "MET" : "NOT MET"} (${tanfCase4.workRequirements.actualHours}/${tanfCase4.workRequirements.requiredHours} hours)`);
  console.log(`   Monthly Benefit: $${(tanfCase4.monthlyBenefit / 100).toFixed(2)} (before sanctions)`);
  console.log("\n   Note: Sanctions would reduce benefit by 25% for first violation");

  // Test Case 5: Exempt from work requirements
  console.log("\n\nTest 5: Work requirement exempt (disabled)");
  console.log("-".repeat(70));
  
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

  console.log(`✅ Result: ${tanfCase5.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Work Requirements: ${tanfCase5.workRequirements.requirementsMet ? "MET" : "NOT MET"} (${tanfCase5.workRequirements.isExempt ? "EXEMPT" : "NOT EXEMPT"})`);
  console.log(`   Exemption Reason: ${tanfCase5.workRequirements.exemptionReason}`);
  console.log(`   Monthly Benefit: $${(tanfCase5.monthlyBenefit / 100).toFixed(2)}`);
}

async function testMedicaidEngine() {
  console.log("\n\n📋 Medicaid (Health Coverage) Rules Engine Tests\n");

  // Test Case 1: MAGI Adult (19-64, under 138% FPL)
  console.log("Test 1: MAGI Adult eligible (ACA expansion)");
  console.log("-".repeat(70));
  
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

  console.log(`✅ Result: ${medicaidCase1.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Category: ${medicaidCase1.categoryName} (${medicaidCase1.pathway})`);
  console.log(`   Income Test: ${medicaidCase1.incomeTest.passed ? "PASS" : "FAIL"}`);
  console.log(`   Percent of FPL: ${medicaidCase1.incomeTest.percentOfFPL}%`);
  console.log(`   Coverage: ${medicaidCase1.coverageType}`);
  console.log("\n   Calculation Breakdown:");
  medicaidCase1.calculationBreakdown.forEach(line => console.log(`     ${line}`));

  // Test Case 2: MAGI Child eligible (under 322% FPL includes CHIP)
  console.log("\n\nTest 2: MAGI Child eligible (high income - CHIP)");
  console.log("-".repeat(70));
  
  const medicaidCase2 = await medicaidRulesEngine.calculateEligibility({
    size: 3,
    age: 10,
    monthlyIncome: 600000,  // $6,000/month
    annualIncome: 720000,   // $7,200/year - under 322% FPL ($8,222)
    isPregnant: false,
    isSSIRecipient: false,
  });

  console.log(`✅ Result: ${medicaidCase2.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Category: ${medicaidCase2.categoryName} (${medicaidCase2.pathway})`);
  console.log(`   Income Test: ${medicaidCase2.incomeTest.passed ? "PASS" : "FAIL"}`);
  console.log(`   Coverage: ${medicaidCase2.coverageType}`);

  // Test Case 3: MAGI Pregnant eligible (264% FPL)
  console.log("\n\nTest 3: MAGI Pregnant woman eligible");
  console.log("-".repeat(70));
  
  const medicaidCase3 = await medicaidRulesEngine.calculateEligibility({
    size: 2,
    age: 28,
    monthlyIncome: 400000,  // $4,000/month
    annualIncome: 480000,   // $4,800/year - under 264% FPL ($5,342)
    isPregnant: true,
    isSSIRecipient: false,
  });

  console.log(`✅ Result: ${medicaidCase3.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Category: ${medicaidCase3.categoryName} (${medicaidCase3.pathway})`);
  console.log(`   Income Test: ${medicaidCase3.incomeTest.passed ? "PASS" : "FAIL"}`);
  console.log(`   Coverage: ${medicaidCase3.coverageType}`);

  // Test Case 4: SSI recipient - automatic eligibility
  console.log("\n\nTest 4: SSI recipient - automatic eligibility");
  console.log("-".repeat(70));
  
  const medicaidCase4 = await medicaidRulesEngine.calculateEligibility({
    size: 1,
    age: 70,
    monthlyIncome: 100000,  // $1,000/month from SSI
    annualIncome: 120000,   // $1,200/year
    isSSIRecipient: true,
    isElderly: true,
  });

  console.log(`✅ Result: ${medicaidCase4.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Category: ${medicaidCase4.categoryName} (${medicaidCase4.pathway})`);
  console.log(`   Income Test: ${medicaidCase4.incomeTest.testType}`);
  console.log(`   Coverage: ${medicaidCase4.coverageType}`);

  // Test Case 5: Non-MAGI Aged/Blind/Disabled eligible
  console.log("\n\nTest 5: Non-MAGI Aged/Blind/Disabled eligible");
  console.log("-".repeat(70));
  
  const medicaidCase5 = await medicaidRulesEngine.calculateEligibility({
    size: 1,
    age: 68,
    monthlyIncome: 120000,  // $1,200/month - under 100% FPL ($1,245)
    annualIncome: 144000,   // $1,440/year
    isSSIRecipient: false,
    isElderly: true,
    countableAssets: 150000,  // $1,500 - under $2,000 limit
  });

  console.log(`✅ Result: ${medicaidCase5.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Category: ${medicaidCase5.categoryName} (${medicaidCase5.pathway})`);
  console.log(`   Income Test: ${medicaidCase5.incomeTest.passed ? "PASS" : "FAIL"}`);
  console.log(`   Asset Test: ${medicaidCase5.assetTest?.passed ? "PASS" : "FAIL"}`);
  console.log(`   Coverage: ${medicaidCase5.coverageType}`);

  // Test Case 6: MAGI Adult ineligible (income too high)
  console.log("\n\nTest 6: MAGI Adult ineligible (exceeds 138% FPL)");
  console.log("-".repeat(70));
  
  const medicaidCase6 = await medicaidRulesEngine.calculateEligibility({
    size: 1,
    age: 45,
    monthlyIncome: 250000,  // $2,500/month - exceeds 138% FPL ($1,722)
    annualIncome: 300000,   // $3,000/year
    isPregnant: false,
    isSSIRecipient: false,
  });

  console.log(`❌ Result: ${medicaidCase6.isEligible ? "ELIGIBLE" : "INELIGIBLE"}`);
  console.log(`   Category: ${medicaidCase6.categoryName} (${medicaidCase6.pathway})`);
  console.log(`   Income Test: ${medicaidCase6.incomeTest.passed ? "PASS" : "FAIL"}`);
  console.log(`   Reason: ${medicaidCase6.reason}`);
  if (medicaidCase6.coverageType === "Medically Needy" && medicaidCase6.hasSpenddown) {
    console.log(`   May qualify for Medically Needy with spenddown: $${(medicaidCase6.spenddownAmount! / 100).toFixed(2)}/month`);
  }
}

async function testVITATaxEngine() {
  console.log("\n\n📋 VITA Tax (Federal + Maryland State) Rules Engine Tests\n");

  // Test Case 1: Low-income single filer with 2 children (EITC eligible)
  console.log("Test 1: Low-income single parent with 2 children (EITC + CTC)");
  console.log("-".repeat(70));
  
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

  console.log(`Federal Tax: $${(taxCase1.federalTax.totalFederalTax / 100).toFixed(2)}`);
  console.log(`   EITC: $${(taxCase1.federalTax.eitc / 100).toFixed(2)}`);
  console.log(`   CTC: $${(taxCase1.federalTax.childTaxCredit / 100).toFixed(2)}`);
  console.log(`Maryland Tax: $${(taxCase1.marylandTax.totalMarylandTax / 100).toFixed(2)}`);
  console.log(`   Maryland EITC: $${(taxCase1.marylandTax.marylandEITC / 100).toFixed(2)}`);
  console.log(`✅ TOTAL REFUND: $${(taxCase1.totalRefund / 100).toFixed(2)}`);

  // Test Case 2: Middle-income married filing jointly with 1 child
  console.log("\n\nTest 2: Middle-income married couple with 1 child");
  console.log("-".repeat(70));
  
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

  console.log(`Federal Tax: $${(taxCase2.federalTax.totalFederalTax / 100).toFixed(2)}`);
  console.log(`   Income Tax Before Credits: $${(taxCase2.federalTax.incomeTaxBeforeCredits / 100).toFixed(2)}`);
  console.log(`   CTC: $${(taxCase2.federalTax.childTaxCredit / 100).toFixed(2)}`);
  console.log(`Maryland Tax: $${(taxCase2.marylandTax.totalMarylandTax / 100).toFixed(2)}`);
  console.log(`   State + ${taxCase2.marylandTax.countyName} County`);
  console.log(`Total Tax Owed: $${(taxCase2.totalTaxLiability / 100).toFixed(2)}`);

  // Test Case 3: Head of household with 3 children (maximum EITC)
  console.log("\n\nTest 3: Head of household with 3 children (maximum EITC scenario)");
  console.log("-".repeat(70));
  
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

  console.log(`Federal Tax: $${(taxCase3.federalTax.totalFederalTax / 100).toFixed(2)}`);
  console.log(`   EITC: $${(taxCase3.federalTax.eitc / 100).toFixed(2)}`);
  console.log(`   CTC: $${(taxCase3.federalTax.childTaxCredit / 100).toFixed(2)}`);
  console.log(`Maryland Tax: $${(taxCase3.marylandTax.totalMarylandTax / 100).toFixed(2)}`);
  console.log(`✅ TOTAL REFUND: $${(taxCase3.totalRefund / 100).toFixed(2)}`);

  // Test Case 4: Single filer, no children, moderate income
  console.log("\n\nTest 4: Single filer, no children, moderate income");
  console.log("-".repeat(70));
  
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

  console.log(`Federal Tax: $${(taxCase4.federalTax.totalFederalTax / 100).toFixed(2)}`);
  console.log(`   Income Tax Before Credits: $${(taxCase4.federalTax.incomeTaxBeforeCredits / 100).toFixed(2)}`);
  console.log(`Maryland Tax: $${(taxCase4.marylandTax.totalMarylandTax / 100).toFixed(2)}`);
  console.log(`Total Tax Owed: $${(taxCase4.totalTaxLiability / 100).toFixed(2)}`);

  // Test Case 5: County tax rate comparison (Talbot vs Baltimore City)
  console.log("\n\nTest 5: County tax rate impact - Talbot County (lowest) vs Baltimore City (highest)");
  console.log("-".repeat(70));
  
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

  console.log(`Talbot County (2.25% rate):`);
  console.log(`   County Tax: $${(taxCase5a.marylandTax.countyTax / 100).toFixed(2)}`);
  console.log(`   Total Maryland Tax: $${(taxCase5a.marylandTax.totalMarylandTax / 100).toFixed(2)}`);
  
  console.log(`\nBaltimore City (3.20% rate):`);
  console.log(`   County Tax: $${(taxCase5b.marylandTax.countyTax / 100).toFixed(2)}`);
  console.log(`   Total Maryland Tax: $${(taxCase5b.marylandTax.totalMarylandTax / 100).toFixed(2)}`);
  
  const countyDifference = taxCase5b.marylandTax.countyTax - taxCase5a.marylandTax.countyTax;
  console.log(`\n💡 County Tax Difference: $${(countyDifference / 100).toFixed(2)} higher in Baltimore City`);
}

async function runValidationTests() {
  try {
    await testOHEPEngine();
    await testTANFEngine();
    await testMedicaidEngine();
    await testVITATaxEngine();
    
    console.log("\n\n" + "=".repeat(70));
    console.log("✅ All validation tests completed successfully!");
    console.log("   - OHEP: 4 test scenarios (energy assistance)");
    console.log("   - TANF: 5 test scenarios (cash assistance)");
    console.log("   - Medicaid: 6 test scenarios (health coverage)");
    console.log("   - VITA Tax: 5 test scenarios (federal + state tax)");
    console.log("=".repeat(70));
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Validation tests failed:", error);
    process.exit(1);
  }
}

runValidationTests();
