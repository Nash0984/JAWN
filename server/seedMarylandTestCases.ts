import { db } from "./db";
import { evaluationTestCases } from "@shared/schema";
import { logger } from "./services/logger.service";

/**
 * Seed Maryland-specific evaluation test cases
 * Based on Work Requirements exemptions table
 */
export async function seedMarylandTestCases() {
  logger.info("Seeding Maryland evaluation test cases...", {
    service: "seedMarylandTestCases",
    action: "start"
  });

  const testCases = [
    // Test Case 1: Dependent Care Exemption (MD_SNAP work requirement)
    {
      program: "MD_SNAP",
      category: "work_requirements",
      name: "MD_SNAP_DEP_CARE_001",
      description: "MD_SNAP: Dependent care exemption for caretaker of child under 14",
      tags: ["exemption", "dependent_care", "md_specific"],
      inputData: {
        householdSize: 2,
        hasChildUnder14: true,
        responsibleForCareOfChild: true,
        childAge: 5,
        needsCareServices: true
      },
      expectedResult: {
        workRequirementExempt: true,
        exemptionType: "dependent_care",
        exemptionReason: "Responsible for care of a child < 14 or a person who needs help caring for themselves",
        dataSourceType: "Medicaid/SNAP application",
        verificationRequired: true,
        notes: "Check whether SNAP and Medicaid language are parallel"
      },
      tolerance: 0.0 // Boolean result, no variance
    },

    // Test Case 2: Education Exemption (MD_SNAP work requirement)
    {
      program: "MD_SNAP",
      category: "work_requirements",
      name: "MD_SNAP_EDUCATION_001",
      description: "MD_SNAP: Education exemption for half-time student enrollment",
      tags: ["exemption", "education", "md_specific", "bbce"],
      inputData: {
        householdSize: 1,
        inSchoolHalfTime: true,
        educationLevel: "college",
        enrollmentStatus: "half_time_or_more",
        age: 20,
        studentType: "undergraduate"
      },
      expectedResult: {
        workRequirementExempt: true,
        exemptionType: "education",
        exemptionReason: "In school at least half time (exemption)",
        dataSourceType: "State department of education; College financial aid offices; Student clearinghouse (potentially)",
        verificationRequired: true,
        complianceType: "exemption",
        topic: "Education",
        notes: "MD SNAP E&E System; WIOA reporting (if available on an individual level)"
      },
      tolerance: 0.0 // Boolean result, no variance
    }
  ];

  for (const testCase of testCases) {
    try {
      await db.insert(evaluationTestCases).values(testCase);
      logger.info(`  ✓ Created test case: ${testCase.description}`, {
        service: "seedMarylandTestCases",
        action: "createTestCase",
        testCase: testCase.name,
        description: testCase.description
      });
    } catch (error: any) {
      if (error.code === '23505') { // Duplicate key error
        logger.info(`  - Test case already exists: ${testCase.description}`, {
          service: "seedMarylandTestCases",
          action: "skip",
          testCase: testCase.name,
          description: testCase.description
        });
      } else {
        logger.error(`  ✗ Error creating test case: ${testCase.description}`, {
          service: "seedMarylandTestCases",
          action: "error",
          testCase: testCase.name,
          error: error.message,
          stack: error.stack
        });
      }
    }
  }

  logger.info("✓ Maryland test cases seeding complete", {
    service: "seedMarylandTestCases",
    action: "complete",
    testCasesCount: testCases.length
  });
}
