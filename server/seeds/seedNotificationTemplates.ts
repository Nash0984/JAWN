import { db } from "../db";
import { dynamicNotificationTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Seed Dynamic Notification Templates
 * 
 * Creates production-ready notification templates that auto-generate official notices
 * by pulling content from Rules as Code. When policy rules change, notification content
 * automatically updates.
 */

export async function seedNotificationTemplates() {
  console.log("Seeding dynamic notification templates...");

  const templates = [
    // SNAP APPROVAL NOTICE
    {
      templateCode: "SNAP_APPROVAL",
      templateName: "SNAP Benefit Approval Notice",
      program: "MD_SNAP",
      noticeType: "approval",
      
      headerContent: "Maryland Department of Human Services\nFamily Investment Administration\nSUPPLEMENTAL NUTRITION ASSISTANCE PROGRAM (SNAP)\nNOTICE OF APPROVAL",
      
      bodyTemplate: "Dear {{recipientName}},\n\nYour application for SNAP (Food Supplement Program) benefits has been APPROVED.\n\n" +
        "═══════════════════════════════════════════════════════════\n" +
        "BENEFIT AMOUNT: ${{benefitAmount}} per month\n" +
        "═══════════════════════════════════════════════════════════\n\n" +
        "Certification Period: {{certificationStart}} to {{certificationEnd}}\n\n" +
        "This benefit amount is based on the following information:\n\n" +
        "HOUSEHOLD INFORMATION:\n" +
        "  • Household Size: {{householdSize}} people\n" +
        "  • County: {{county}}\n\n" +
        "INCOME:\n" +
        "  • Gross Monthly Income: ${{grossIncome}}\n" +
        "  • Net Monthly Income: ${{netIncome}}\n\n" +
        "DEDUCTIONS APPLIED:\n" +
        "  • Standard Deduction: ${{standardDeduction}}\n" +
        "  • Earned Income Deduction (20%): ${{earnedIncomeDeduction}}\n" +
        "  • Total Deductions: ${{totalDeductions}}\n\n" +
        "Your benefits will be available on your Maryland EBT card on the {{benefitDate}} of each month.",

      footerContent: "For questions about your benefits, please contact:\nMaryland DHS Customer Service: 1-800-332-6347\nTTY for Deaf/Hard of Hearing: 1-800-925-4434",

      contentRules: {
        benefitAmount: {
          source: "rulesEngine.calculateSNAPBenefit",
          params: ["householdProfile"],
          format: "currency"
        },
        householdSize: {
          source: "household.household.household_size",
          fallback: "1"
        },
        county: {
          source: "household.household.county",
          fallback: "Maryland"
        },
        grossIncome: {
          source: "context.calculationResult.grossIncome",
          format: "currency",
          fallback: "0.00"
        },
        netIncome: {
          source: "context.calculationResult.netIncome",
          format: "currency",
          fallback: "0.00"
        },
        standardDeduction: {
          source: "context.calculationResult.deductions.standardDeduction",
          format: "currency",
          fallback: "0.00"
        },
        earnedIncomeDeduction: {
          source: "context.calculationResult.deductions.earnedIncomeDeduction",
          format: "currency",
          fallback: "0.00"
        },
        totalDeductions: {
          source: "context.calculationResult.deductions.total",
          format: "currency",
          fallback: "0.00"
        },
        certificationStart: {
          source: "context.certificationStartDate",
          format: "date",
          fallback: "Today"
        },
        certificationEnd: {
          source: "context.certificationEndDate",
          format: "date",
          fallback: "6 months from today"
        },
        benefitDate: {
          source: "context.benefitIssuanceDay",
          fallback: "1st"
        }
      },

      requiredDisclosures: [
        "You must report any changes in income, household size, or address within 10 days.",
        "Benefits are subject to recertification every 6-12 months.",
        "This benefit is calculated based on current Maryland SNAP rules effective as of the date of this notice."
      ],

      appealRightsTemplate: "If you disagree with this decision, you have the right to request a fair hearing.\n\n" +
        "To request a hearing:\n" +
        "  • Call: 1-800-332-6347\n" +
        "  • Online: https://mydhrbenefits.dhr.state.md.us/\n\n" +
        "You have 90 days from the date of this notice to request a hearing.",

      legalCitations: [
        "7 CFR § 273.9 - Income and deductions",
        "7 CFR § 273.10 - Determining household eligibility and benefit levels",
        "COMAR 07.03.17 - Food Supplement Program"
      ],

      deliveryChannels: ["email", "portal", "mail"],
      version: 1,
      effectiveDate: new Date(),
      isActive: true,
    },

    // SNAP DENIAL NOTICE
    {
      templateCode: "SNAP_DENIAL",
      templateName: "SNAP Benefit Denial Notice",
      program: "MD_SNAP",
      noticeType: "denial",
      
      headerContent: "Maryland Department of Human Services\nFamily Investment Administration\nSUPPLEMENTAL NUTRITION ASSISTANCE PROGRAM (SNAP)\nNOTICE OF DENIAL",
      
      bodyTemplate: "Dear {{recipientName}},\n\nYour application for SNAP (Food Supplement Program) benefits has been DENIED.\n\n" +
        "═══════════════════════════════════════════════════════════\n" +
        "REASON FOR DENIAL\n" +
        "═══════════════════════════════════════════════════════════\n\n" +
        "{{denialReason}}\n\n" +
        "ELIGIBILITY INFORMATION:\n\n" +
        "Based on the information provided:\n" +
        "  • Household Size: {{householdSize}} people\n" +
        "  • Gross Monthly Income: ${{grossIncome}}\n\n" +
        "SNAP ELIGIBILITY LIMITS:\n" +
        "  • Maximum Gross Income: ${{incomeLimit}} per month\n\n" +
        "{{eligibilityExplanation}}",

      footerContent: "If your circumstances change, you may reapply for benefits at any time.\n\nFor questions or assistance:\nMaryland DHS Customer Service: 1-800-332-6347",

      contentRules: {
        denialReason: {
          source: "context.denialReason",
          fallback: "Your household does not meet SNAP eligibility requirements."
        },
        householdSize: {
          source: "household.household.household_size",
          fallback: "1"
        },
        grossIncome: {
          source: "household.income.employment_income",
          format: "currency",
          fallback: "0.00"
        },
        incomeLimit: {
          source: "rulesEngine.getSNAPIncomeLimit",
          format: "currency",
          fallback: "Contact DHS"
        },
        eligibilityExplanation: {
          source: "context.eligibilityExplanation",
          fallback: "Please contact our office if you believe this decision is incorrect."
        }
      },

      requiredDisclosures: [
        "This denial is based on current SNAP eligibility rules.",
        "You may reapply for benefits at any time if your circumstances change."
      ],

      appealRightsTemplate: "If you disagree with this decision, you have the right to request a fair hearing.\n\n" +
        "Contact: 1-800-332-6347\nYou have 90 days from the date of this notice to request a hearing.",

      legalCitations: [
        "7 CFR § 273.9 - Income eligibility standards",
        "COMAR 07.03.17 - Food Supplement Program"
      ],

      deliveryChannels: ["email", "portal", "mail"],
      version: 1,
      effectiveDate: new Date(),
      isActive: true,
    },
  ];

  // Insert templates
  let createdCount = 0;
  let updatedCount = 0;

  for (const template of templates) {
    try {
      const existing = await db.query.dynamicNotificationTemplates.findFirst({
        where: eq(dynamicNotificationTemplates.templateCode, template.templateCode),
      });

      if (!existing) {
        await db.insert(dynamicNotificationTemplates).values(template);
        createdCount++;
        console.log("  ✓ Created template: " + template.templateName + " (" + template.templateCode + ")");
      } else {
        await db.update(dynamicNotificationTemplates)
          .set({
            templateName: template.templateName,
            program: template.program,
            noticeType: template.noticeType,
            headerContent: template.headerContent,
            bodyTemplate: template.bodyTemplate,
            footerContent: template.footerContent,
            contentRules: template.contentRules,
            requiredDisclosures: template.requiredDisclosures,
            appealRightsTemplate: template.appealRightsTemplate,
            legalCitations: template.legalCitations,
            deliveryChannels: template.deliveryChannels,
            updatedAt: new Date(),
          })
          .where(eq(dynamicNotificationTemplates.id, existing.id));
        updatedCount++;
        console.log("  ✓ Updated template: " + template.templateName + " (" + template.templateCode + ")");
      }
    } catch (error) {
      console.error("  ✗ Error seeding template " + template.templateCode + ":", error);
    }
  }

  if (createdCount > 0) {
    console.log("✓ Created " + createdCount + " notification templates");
  }
  if (updatedCount > 0) {
    console.log("✓ Updated " + updatedCount + " notification templates");
  }

  console.log("\n📋 Dynamic Notification Engine ready!");
  console.log("  • SNAP_APPROVAL - Benefit approval with auto-calculated amounts");
  console.log("  • SNAP_DENIAL - Denial notice with eligibility explanation\n");
}
