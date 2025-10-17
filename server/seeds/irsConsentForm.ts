import { db } from '../db';
import { consentForms, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function seedIRSConsentForm() {
  try {
    // Check if already exists
    const existing = await db.query.consentForms.findFirst({
      where: eq(consentForms.formCode, 'irs_use_disclosure')
    });

    if (existing) {
      console.log('✅ IRS Use & Disclosure Consent form already exists (skipping)');
      return;
    }

    // Get admin user for createdBy
    const adminUser = await db.query.users.findFirst({
      where: eq(users.role, 'admin')
    });

    if (!adminUser) {
      console.error('❌ No admin user found - cannot seed IRS consent form');
      return;
    }

    const irsConsentForm = {
      formName: 'IRS Use & Disclosure Authorization',
      formCode: 'irs_use_disclosure',
      formTitle: 'Authorization to Use Tax Information for Benefits Eligibility',
      
      purpose: 'This consent authorizes the use of your federal tax return information to determine eligibility for public benefit programs (SNAP, Medicaid, TCA/TANF, OHEP) in accordance with IRS Publication 4299.',
      
      formContent: `
# IRS USE AND DISCLOSURE AUTHORIZATION

## Purpose of This Form
This authorization allows Maryland Benefits Platform (a VITA partner) to use your federal tax return information to help determine your eligibility for public benefit programs. This consent is required under IRS Publication 4299 guidelines.

## What Information Will Be Used
We will use information from your federal tax return, including:
- Adjusted Gross Income (AGI)
- Filing status (single, married filing jointly, etc.)
- Number of dependents claimed
- Earned Income Tax Credit (EITC) eligibility
- Child Tax Credit (CTC) amounts
- W-2 wage information
- Other income sources reported on your return

## How Your Information Will Be Used
Your tax information will ONLY be used to:
1. **Pre-fill benefit applications** - Reduce paperwork by automatically populating income and household data
2. **Determine benefit eligibility** - Calculate eligibility for SNAP, Medicaid, TCA/TANF, and OHEP programs
3. **Verify income** - Confirm income information already provided to benefit agencies
4. **Identify unclaimed benefits** - Alert you to programs you may qualify for but haven't applied to

## Benefit Programs Authorized
By signing this form, you authorize use of your tax data for the following Maryland benefit programs:
- ☐ SNAP (Supplemental Nutrition Assistance Program)
- ☐ Medicaid (Medical Assistance)
- ☐ TCA/TANF (Temporary Cash Assistance / Temporary Assistance for Needy Families)
- ☐ OHEP (Office of Home Energy Programs)

## Your Rights
- **You may refuse** - Refusing to authorize use of your tax information will NOT affect your ability to receive free tax preparation services
- **Limited disclosure** - Your tax information will NOT be shared with third parties outside the authorized benefit programs
- **Revocation** - You may revoke this authorization at any time by contacting Maryland Benefits Platform
- **Security** - All tax information is protected with AES-256-GCM encryption and stored in compliance with IRS security standards

## Period of Authorization
This authorization remains valid for:
- The current tax year
- One year from the date of signature, OR
- Until you revoke it in writing

Whichever comes first.

## Acknowledgment
I understand that:
1. My tax information will be used ONLY for the benefit programs I have checked above
2. This authorization is voluntary and does not affect my right to free tax preparation
3. I can revoke this authorization at any time
4. Maryland Benefits Platform will protect my tax information in accordance with IRS Publication 4299

## Electronic Signature
By typing my name below, I certify that:
- I have read and understand this authorization
- I voluntarily consent to the use of my tax information as described
- My electronic signature has the same legal effect as a handwritten signature

---

**Legal Reference:** IRS Publication 4299 (Rev. 2024) - Privacy and Confidentiality Requirements for VITA/TCE Volunteers

**Questions?** Contact Maryland Benefits Platform at support@mdbenefits.org or call 1-800-XXX-XXXX
      `.trim(),
      
      version: 1,
      isActive: true,
      requiresSignature: true,
      expirationDays: 365, // 1 year expiration
      
      // IRS-specific fields
      benefitPrograms: ['snap', 'medicaid', 'tca', 'ohep'],
      legalLanguageVersion: 'IRS Pub 4299 Rev. 2024',
      irsPublicationRef: 'Pub 4299 (2024)',
      disclosureScope: {
        agi: true,
        filingStatus: true,
        dependents: true,
        eitc: true,
        ctc: true,
        w2Wages: true,
        otherIncome: true,
        deductions: false, // Not disclosed to benefit programs
        bankInfo: false, // Not disclosed to benefit programs
      },
      
      createdBy: adminUser.id,
      approvedBy: adminUser.id,
      approvedAt: new Date(),
      effectiveDate: new Date(),
    };

    await db.insert(consentForms).values(irsConsentForm);
    console.log('✅ IRS Use & Disclosure Consent form seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding IRS consent form:', error);
    throw error;
  }
}
