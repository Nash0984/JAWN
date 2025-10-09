import { db } from "./db";
import { evaluationTestCases } from "@shared/schema";

/**
 * Seed Maryland-specific evaluation test cases
 * Based on Work Requirements exemptions table
 */
export async function seedMarylandTestCases() {
  console.log("Seeding Maryland evaluation test cases...");

  const testCases = [
    // Test Case 1: Dependent Care Exemption (MD_SNAP work requirement)
    {
      program: "MD_SNAP",
      category: "work_requirements",
      tags: ["exemption", "dependent_care", "md_specific"],
      input: {
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
      tolerance: 0.0, // Boolean result, no variance
      description: "MD_SNAP: Dependent care exemption for caretaker of child under 14",
      createdBy: "system"
    },

    // Test Case 2: Education Exemption (MD_SNAP work requirement)
    {
      program: "MD_SNAP",
      category: "work_requirements",
      tags: ["exemption", "education", "md_specific", "bbce"],
      input: {
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
      tolerance: 0.0, // Boolean result, no variance
      description: "MD_SNAP: Education exemption for half-time student enrollment",
      createdBy: "system"
    }
  ];

  for (const testCase of testCases) {
    try {
      await db.insert(evaluationTestCases).values(testCase);
      console.log(`  ✓ Created test case: ${testCase.description}`);
    } catch (error: any) {
      if (error.code === '23505') { // Duplicate key error
        console.log(`  - Test case already exists: ${testCase.description}`);
      } else {
        console.error(`  ✗ Error creating test case: ${testCase.description}`, error);
      }
    }
  }

  console.log("✓ Maryland test cases seeding complete\n");
}
