import { ohepRulesEngine } from "../services/ohepRulesEngine";
import { tanfRulesEngine } from "../services/tanfRulesEngine";

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

async function runValidationTests() {
  try {
    await testOHEPEngine();
    await testTANFEngine();
    
    console.log("\n\n" + "=".repeat(70));
    console.log("✅ All validation tests completed successfully!");
    console.log("=".repeat(70));
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Validation tests failed:", error);
    process.exit(1);
  }
}

runValidationTests();
