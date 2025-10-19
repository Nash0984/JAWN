/**
 * Seed MAIVE Test Cases for Maryland Benefits
 * 
 * These test cases validate AI accuracy for Maryland-specific policies
 * including SNAP, Medicaid, TANF, OHEP, and tax calculations.
 */

import { db } from "./db";
import { maiveTestCases } from "@shared/schema";
import { nanoid } from "nanoid";

const marylandTestCases = [
  // ============================================================================
  // SNAP Benefit Calculation Tests
  // ============================================================================
  {
    id: nanoid(),
    name: "MD SNAP: Single person household with standard deduction",
    category: "benefit_calculation",
    scenario: "Calculate SNAP benefits for a single person in Maryland with $1,200 monthly income from work",
    inputs: {
      state: "MD",
      householdSize: 1,
      monthlyIncome: 1200,
      incomeType: "earned",
      shelterCosts: 800,
      utilityAllowance: "SUA_HEATING",
      elderly: false,
      disabled: false,
    },
    expectedOutput: {
      eligibleForSNAP: true,
      monthlyBenefit: 155,
      calculations: {
        grossIncome: 1200,
        netIncome: 960, // After 20% earned income deduction
        shelterDeduction: 412, // Maryland SUA for heating/cooling
        excessShelterDeduction: 292, // Capped at $672
        adjustedIncome: 668,
        benefitAmount: 155,
      }
    },
    accuracyThreshold: 0.95,
    stateSpecific: "MD",
    tags: ["snap", "benefit_calculation", "maryland", "shelter_utility"],
  },
  {
    id: nanoid(),
    name: "MD SNAP: Family of 4 with mixed income and childcare",
    category: "benefit_calculation",
    scenario: "Calculate SNAP for Maryland family with earned and unearned income plus childcare expenses",
    inputs: {
      state: "MD",
      householdSize: 4,
      monthlyEarnedIncome: 2000,
      monthlyUnearnedIncome: 500,
      childcareExpenses: 600,
      shelterCosts: 1200,
      utilityAllowance: "SUA_HEATING",
      hasChildUnder6: true,
    },
    expectedOutput: {
      eligibleForSNAP: true,
      monthlyBenefit: 432,
      calculations: {
        grossIncome: 2500,
        earnedIncomeDeduction: 400, // 20% of $2000
        childcareDeduction: 600,
        netIncome: 1500,
        shelterDeduction: 1612, // $1200 + $412 SUA
        excessShelterDeduction: 562, // Exceeds 50% of net income
        adjustedIncome: 938,
        benefitAmount: 432,
      }
    },
    accuracyThreshold: 0.95,
    stateSpecific: "MD",
    tags: ["snap", "benefit_calculation", "maryland", "childcare", "mixed_income"],
  },
  {
    id: nanoid(),
    name: "MD SNAP: Elderly household with medical expenses",
    category: "benefit_calculation",
    scenario: "Calculate SNAP for elderly Maryland resident with medical expenses exceeding $35",
    inputs: {
      state: "MD",
      householdSize: 1,
      monthlyIncome: 1100,
      incomeType: "unearned",
      medicalExpenses: 150,
      shelterCosts: 650,
      utilityAllowance: "SUA_HEATING",
      elderly: true,
      age: 68,
    },
    expectedOutput: {
      eligibleForSNAP: true,
      monthlyBenefit: 189,
      calculations: {
        grossIncome: 1100,
        medicalDeduction: 115, // $150 - $35 threshold
        netIncome: 985,
        shelterDeduction: 1062, // $650 + $412 SUA
        excessShelterDeduction: 569, // No cap for elderly
        adjustedIncome: 416,
        benefitAmount: 189,
      }
    },
    accuracyThreshold: 0.95,
    stateSpecific: "MD",
    tags: ["snap", "benefit_calculation", "maryland", "elderly", "medical_expenses"],
  },

  // ============================================================================
  // Work Requirements & ABAWD Tests
  // ============================================================================
  {
    id: nanoid(),
    name: "MD ABAWD: Homeless exemption determination",
    category: "work_requirements",
    scenario: "Determine ABAWD exemption for homeless individual in Baltimore City",
    inputs: {
      state: "MD",
      county: "Baltimore City",
      age: 35,
      housingStatus: "homeless",
      workHoursPerWeek: 0,
      enrolledInTraining: false,
      hasDisability: false,
    },
    expectedOutput: {
      subjectToABAWD: false,
      exemptionReason: "homeless",
      exemptionDuration: "ongoing_while_homeless",
      verificationRequired: "self_attestation",
      policyReference: "7 CFR 273.24(c)(3)",
    },
    accuracyThreshold: 0.95,
    stateSpecific: "MD",
    tags: ["abawd", "work_requirements", "maryland", "homeless", "exemption"],
  },
  {
    id: nanoid(),
    name: "MD ABAWD: Student exemption with half-time enrollment",
    category: "work_requirements",
    scenario: "Determine ABAWD exemption for college student working part-time",
    inputs: {
      state: "MD",
      age: 22,
      studentStatus: "half_time",
      workHoursPerWeek: 15,
      enrolledInWorkStudy: true,
      hasChildDependent: false,
    },
    expectedOutput: {
      subjectToABAWD: false,
      exemptionReason: "student_work_study",
      exemptionDuration: "while_enrolled",
      verificationRequired: "enrollment_verification",
      policyReference: "7 CFR 273.5(b)(5)",
    },
    accuracyThreshold: 0.95,
    stateSpecific: "MD",
    tags: ["abawd", "work_requirements", "maryland", "student", "exemption"],
  },

  // ============================================================================
  // Policy Interpretation Tests
  // ============================================================================
  {
    id: nanoid(),
    name: "MD Policy: Broad-Based Categorical Eligibility (BBCE)",
    category: "policy_interpretation",
    scenario: "Interpret Maryland's BBCE policy for household with assets exceeding federal limits",
    inputs: {
      state: "MD",
      question: "Is a household with $5,000 in savings eligible for SNAP under Maryland BBCE?",
      householdAssets: 5000,
      householdSize: 2,
      receivingTANF: false,
      grossIncome: 2500,
    },
    expectedOutput: {
      interpretation: "eligible_under_bbce",
      explanation: "Maryland uses Broad-Based Categorical Eligibility. Households with gross income under 200% FPL are categorically eligible regardless of assets.",
      assetLimit: "no_asset_limit_under_bbce",
      incomeLimit: "200_percent_fpl",
      policyReference: "COMAR 07.03.17.04",
    },
    accuracyThreshold: 0.95,
    stateSpecific: "MD",
    tags: ["policy", "bbce", "maryland", "categorical_eligibility"],
  },
  {
    id: nanoid(),
    name: "MD Policy: Summer Cooling SUA Application",
    category: "policy_interpretation",
    scenario: "Determine correct Standard Utility Allowance for Maryland household in July",
    inputs: {
      state: "MD",
      month: "July",
      utilitiesIncluded: ["electricity", "cooling"],
      separateUtilityBills: true,
    },
    expectedOutput: {
      suaType: "heating_cooling_sua",
      amount: 412,
      reasoning: "Maryland applies heating/cooling SUA during summer months (June-September) for households with cooling costs",
      policyReference: "Maryland SNAP Manual Section 416",
      seasonalAdjustment: true,
    },
    accuracyThreshold: 0.95,
    stateSpecific: "MD",
    tags: ["policy", "sua", "maryland", "utility_allowance"],
  },

  // ============================================================================
  // Document Extraction Tests
  // ============================================================================
  {
    id: nanoid(),
    name: "MD Document: DHS FIA/CW 4 Change Report Form",
    category: "document_extraction",
    scenario: "Extract information from Maryland DHS change report form",
    inputs: {
      documentType: "change_report",
      formNumber: "DHS/FIA/CW 4",
      ocrText: "Client Name: Jane Smith\nCase Number: 12345678\nChange Type: Employment\nEmployer: Johns Hopkins Hospital\nStart Date: 10/15/2024\nWages: $2,400/month",
    },
    expectedOutput: {
      extractedData: {
        clientName: "Jane Smith",
        caseNumber: "12345678",
        changeType: "employment",
        employer: "Johns Hopkins Hospital",
        employmentStartDate: "2024-10-15",
        monthlyWages: 2400,
      },
      documentValid: true,
      requiredActions: ["verify_employment", "recalculate_benefits"],
    },
    accuracyThreshold: 0.95,
    stateSpecific: "MD",
    tags: ["document", "extraction", "maryland", "change_report"],
  },

  // ============================================================================
  // Eligibility Determination Tests
  // ============================================================================
  {
    id: nanoid(),
    name: "MD Eligibility: SNAP Emergency Supplement (COVID-19 allotment end)",
    category: "eligibility_determination",
    scenario: "Determine eligibility after Maryland emergency allotments ended in March 2023",
    inputs: {
      state: "MD",
      applicationDate: "2024-10-15",
      householdSize: 3,
      monthlyIncome: 2800,
      requestingEmergencyAllotment: true,
    },
    expectedOutput: {
      eligibleForSNAP: true,
      eligibleForEmergencyAllotment: false,
      reason: "Emergency allotments ended March 2023",
      regularBenefitAmount: 287,
      policyUpdate: "P.L. 117-328 ended emergency allotments",
    },
    accuracyThreshold: 0.95,
    stateSpecific: "MD",
    tags: ["eligibility", "emergency_allotment", "maryland", "covid"],
  },
  {
    id: nanoid(),
    name: "MD Eligibility: Cross-enrollment SNAP to Medicaid",
    category: "eligibility_determination",
    scenario: "Determine Medicaid eligibility for SNAP recipient in Maryland",
    inputs: {
      state: "MD",
      currentlyReceivingSNAP: true,
      householdSize: 2,
      monthlyIncome: 1800,
      hasChildren: true,
      childAge: 5,
    },
    expectedOutput: {
      likelyEligibleForMedicaid: true,
      medicaidCategory: "magi_parent_caretaker",
      incomeLimit: "138_percent_fpl",
      enrollmentPath: "presumptive_eligibility",
      crossEnrollmentRecommended: true,
    },
    accuracyThreshold: 0.95,
    stateSpecific: "MD",
    tags: ["eligibility", "cross_enrollment", "maryland", "medicaid"],
  },

  // ============================================================================
  // Tax Credit Calculations (Maryland-specific)
  // ============================================================================
  {
    id: nanoid(),
    name: "MD Tax: Earned Income Tax Credit with state supplement",
    category: "benefit_calculation",
    scenario: "Calculate federal and Maryland EITC for family of 3",
    inputs: {
      state: "MD",
      taxYear: 2024,
      filingStatus: "married_filing_jointly",
      earnedIncome: 35000,
      numberOfChildren: 1,
      childAge: 8,
    },
    expectedOutput: {
      federalEITC: 3733,
      marylandEITC: 1006, // 28% of federal for 1 child (2023 rate)
      totalEITC: 4739,
      marylandEITCRate: 0.28,
      policyNote: "Maryland matches 28% of federal EITC for 1 child",
    },
    accuracyThreshold: 0.95,
    stateSpecific: "MD",
    tags: ["tax", "eitc", "maryland", "tax_credit"],
  },
];

async function seedMAIVETestCases() {
  console.log("🧪 Seeding MAIVE test cases for Maryland...");

  try {
    for (const testCase of marylandTestCases) {
      await db.insert(maiveTestCases)
        .values({
          ...testCase,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
      
      console.log(`✅ Created test case: ${testCase.name}`);
    }

    console.log(`\n✅ Successfully seeded ${marylandTestCases.length} MAIVE test cases`);
    console.log("\n📊 Test Coverage:");
    console.log("   • Benefit Calculations: 4 tests");
    console.log("   • Work Requirements: 2 tests");
    console.log("   • Policy Interpretation: 2 tests");
    console.log("   • Document Extraction: 1 test");
    console.log("   • Eligibility Determination: 2 tests");
    console.log("   • Tax Credits: 1 test");
    
  } catch (error) {
    console.error("❌ Error seeding MAIVE test cases:", error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMAIVETestCases()
    .then(() => {
      console.log("✅ MAIVE test cases seeding complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to seed:", error);
      process.exit(1);
    });
}

export { seedMAIVETestCases };