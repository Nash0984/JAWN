import { db } from "../db";
import { consentForms, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../services/logger.service";

// IRS Publication 4299-compliant consent language
export const IRS_CONSENT_TEMPLATE = {
  formName: "IRS Use and Disclosure Consent",
  formCode: "irs_use_disclosure",
  formTitle: "Authorization for Use and Disclosure of Tax Information",
  purpose: "To authorize the use of your federal tax return information to determine eligibility for public benefit programs (SNAP, Medicaid, TCA/TANF, OHEP) as permitted by IRS regulations.",
  formContent: `AUTHORIZATION FOR USE AND DISCLOSURE OF TAX RETURN INFORMATION

I hereby authorize the Maryland Universal Financial Navigator and its associated VITA tax preparation service to:

1. USE MY TAX INFORMATION: Use my federal tax return information (income, filing status, dependents, credits, deductions) to:
   - Calculate eligibility for Maryland public benefit programs (SNAP, Medicaid, TCA/TANF, OHEP)
   - Pre-fill benefit applications with accurate income data
   - Identify unclaimed tax credits and public benefits
   - Provide comprehensive financial optimization recommendations

2. DISCLOSURE TO BENEFIT PROGRAMS: Disclose my tax return information to the following Maryland Department of Human Services programs for eligibility determination:
   □ SNAP (Supplemental Nutrition Assistance Program)
   □ Medicaid (Medical Assistance)
   □ TCA (Temporary Cash Assistance / TANF)
   □ OHEP (Office of Home Energy Programs)

3. SAFEGUARDS: I understand that:
   - My tax information will be protected with AES-256-GCM encryption
   - Only authorized personnel will access my data
   - Information will be used solely for benefit eligibility determination
   - I may revoke this consent at any time by written notice
   - Revocation does not affect prior disclosures made with my authorization

4. DURATION: This authorization expires 12 months from the date of signature or upon revocation, whichever comes first.

5. ACKNOWLEDGMENT: I understand that:
   - This is a voluntary authorization
   - Refusal to authorize does not affect my ability to receive tax preparation assistance
   - The VITA program is free and confidential
   - Maryland Universal Financial Navigator is NOT a government agency

By signing below, I confirm that I have read and understand this authorization and voluntarily consent to the use and disclosure of my tax information as described above.

This consent complies with IRS Publication 4299 and 26 CFR § 301.6103(c)-1 (Consent to Disclose Tax Return Information).`,
  requiresSignature: true,
  expirationDays: 365,
  version: 1,
  isActive: true
};

/**
 * Seed IRS Use & Disclosure consent form
 * Called during application initialization
 */
export async function seedIRSConsentForm() {
  try {
    // Check if form already exists
    const existingForm = await db.query.consentForms.findFirst({
      where: eq(consentForms.formCode, 'irs_use_disclosure')
    });
    
    if (existingForm) {
      logger.info('ℹ️  IRS Use & Disclosure consent form already exists', {
        service: "seedIRSConsentForm",
        action: "skip"
      });
      return;
    }
    
    // Get admin user as creator
    const admin = await db.query.users.findFirst({
      where: eq(users.role, 'admin')
    });
    
    if (!admin) {
      logger.warn('⚠️  No admin user found - skipping IRS consent form seeding', {
        service: "seedIRSConsentForm",
        action: "warning",
        reason: "No admin user found"
      });
      return;
    }
    
    // Insert IRS consent form
    await db.insert(consentForms).values({
      ...IRS_CONSENT_TEMPLATE,
      createdBy: admin.id,
      approvedBy: admin.id,
      approvedAt: new Date(),
      effectiveDate: new Date(),
    });
    
    logger.info('✅ IRS Use & Disclosure consent form seeded successfully', {
      service: "seedIRSConsentForm",
      action: "complete"
    });
  } catch (error) {
    logger.error('❌ Error seeding IRS consent form', {
      service: "seedIRSConsentForm",
      action: "error",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}
