import LegalLayout from "@/components/LegalLayout";
import { useTenant } from "@/contexts/TenantContext";

export default function PrivacyPolicy() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const agencyAcronym = stateConfig?.agencyAcronym || 'DHS';
  
  return (
    <>
      
      <LegalLayout title="Privacy Policy" lastReviewed="October 16, 2025">
        <section data-testid="section-privacy-overview">
          <h2>Overview</h2>
          <p>
            {stateName} Benefits Platform ("Platform," "we," "us," or "our") is committed to protecting your privacy 
            and maintaining the security of your personal and protected health information (PHI). This Privacy Policy 
            describes how we collect, use, disclose, and safeguard your information when you use our platform.
          </p>
        </section>

        <section data-testid="section-hipaa-compliance">
          <h2>HIPAA Privacy Rule Compliance</h2>
          <p>
            As a platform handling protected health information, we comply with the Health Insurance Portability 
            and Accountability Act (HIPAA) Privacy Rule (45 CFR Part 160 and Part 164, Subparts A and E). We:
          </p>
          <ul>
            <li>Use and disclose PHI only as permitted by law</li>
            <li>Maintain administrative, physical, and technical safeguards</li>
            <li>Provide you with access to your health information</li>
            <li>Track disclosures of your PHI as required by law</li>
            <li>Allow you to request restrictions on uses and disclosures</li>
          </ul>
        </section>

        <section data-testid="section-data-collection">
          <h2>Information We Collect</h2>
          
          <h3>Personal Information (PII)</h3>
          <ul>
            <li><strong>Identity Information:</strong> Name, Social Security Number, date of birth</li>
            <li><strong>Contact Information:</strong> Address, phone number, email address</li>
            <li><strong>Account Credentials:</strong> Username, encrypted password</li>
            <li><strong>Demographic Information:</strong> Age, household size, county of residence</li>
          </ul>

          <h3>Protected Health Information (PHI)</h3>
          <ul>
            <li>Medical conditions and disability status</li>
            <li>Health insurance information</li>
            <li>Medical documentation for benefit eligibility</li>
            <li>Prescription and treatment information</li>
          </ul>

          <h3>Financial Information</h3>
          <ul>
            <li>Income documentation (W-2s, 1099s, pay stubs)</li>
            <li>Bank account information (for benefit disbursement verification only)</li>
            <li>Asset information for eligibility determination</li>
            <li>Tax return data (via IRS VITA certification)</li>
          </ul>

          <h3>Technical Information</h3>
          <ul>
            <li>IP address and device information</li>
            <li>Browser type and version</li>
            <li>Access logs and usage patterns</li>
            <li>Session timestamps for audit purposes</li>
          </ul>
        </section>

        <section data-testid="section-encryption">
          <h2>Field-Level Encryption</h2>
          <p>
            We protect your most sensitive data using <strong>AES-256-GCM (Advanced Encryption Standard, 
            256-bit key, Galois/Counter Mode)</strong> field-level encryption for:
          </p>
          <ul>
            <li>Social Security Numbers</li>
            <li>Date of birth</li>
            <li>Health information</li>
            <li>Financial account numbers</li>
            <li>Tax return data</li>
          </ul>
          <p>
            Encryption keys are stored separately from encrypted data in secure key management systems 
            with role-based access controls. Only authorized system components can decrypt this information 
            when necessary for legitimate business purposes.
          </p>
        </section>

        <section data-testid="section-data-use">
          <h2>How We Use Your Information</h2>
          <p>We use your information only for:</p>
          <ul>
            <li><strong>Eligibility Determination:</strong> Assess qualification for SNAP, Medicaid, TANF, and other benefit programs</li>
            <li><strong>Application Processing:</strong> Complete and submit benefit applications on your behalf</li>
            <li><strong>Document Verification:</strong> Validate identity and eligibility documentation</li>
            <li><strong>Tax Preparation:</strong> Prepare and file federal and {stateName} state tax returns (VITA program)</li>
            <li><strong>Program Administration:</strong> Manage user accounts and provide technical support</li>
            <li><strong>Legal Compliance:</strong> Meet regulatory requirements and respond to lawful requests</li>
            <li><strong>System Security:</strong> Monitor for fraud, abuse, and security threats</li>
          </ul>
        </section>

        <section data-testid="section-third-party-sharing">
          <h2>Third-Party Sharing</h2>
          <p className="font-semibold">
            We DO NOT share your information with third-party vendors, marketers, or advertisers.
          </p>
          <p>
            Information disclosure is limited to:
          </p>
          <ul>
            <li><strong>Government Agencies:</strong> {stateName} Department of Human Services ({agencyAcronym}), IRS, Social Security Administration (only as required for benefit application processing)</li>
            <li><strong>Authorized Representatives:</strong> Individuals you designate in writing to act on your behalf</li>
            <li><strong>Law Enforcement:</strong> When required by valid legal process (subpoena, court order)</li>
            <li><strong>Emergency Situations:</strong> To prevent harm to you or others as permitted by law</li>
          </ul>
          <p>
            All internal platform operations (data storage, processing, security monitoring) are conducted 
            within our secure infrastructure without external third-party access.
          </p>
        </section>

        <section data-testid="section-user-rights">
          <h2>Your Privacy Rights</h2>
          
          <h3>Right to Access</h3>
          <p>You have the right to access and obtain a copy of your personal information. Contact us to request access.</p>

          <h3>Right to Correction</h3>
          <p>You may request correction of inaccurate or incomplete information. We will review and update records as appropriate.</p>

          <h3>Right to Deletion</h3>
          <p>
            You may request deletion of your account and personal information, subject to legal retention requirements 
            (e.g., IRS requires 7-year retention of tax records). We will anonymize or delete data when legally permissible.
          </p>

          <h3>Right to Restrict Processing</h3>
          <p>You may request restrictions on how we use your information, though this may limit platform functionality.</p>

          <h3>Right to Data Portability</h3>
          <p>You may request a copy of your information in a structured, machine-readable format.</p>

          <h3>Right to Object</h3>
          <p>You may object to certain uses of your information, subject to legal obligations.</p>
        </section>

        <section data-testid="section-state-privacy-laws">
          <h2>State Privacy Laws</h2>
          
          <h3>State Data Protection Laws</h3>
          <p>
            We comply with {stateName}'s data breach notification requirements and consumer protection statutes.
          </p>

          <h3>CCPA Alignment (California Residents)</h3>
          <p>
            While primarily serving {stateName} residents, we extend certain California Consumer Privacy Act (CCPA) 
            rights to all users, including the right to know what information is collected and the right to deletion.
          </p>
        </section>

        <section data-testid="section-data-retention">
          <h2>Data Retention</h2>
          <ul>
            <li><strong>Active Accounts:</strong> Information retained while account is active</li>
            <li><strong>Tax Records:</strong> 7 years (IRS requirement)</li>
            <li><strong>Benefit Applications:</strong> 6 years ({stateName} {agencyAcronym} requirement)</li>
            <li><strong>Audit Logs:</strong> 3 years minimum for security monitoring</li>
            <li><strong>Deleted Accounts:</strong> Personal data anonymized after retention period expires</li>
          </ul>
        </section>

        <section data-testid="section-minors">
          <h2>Children's Privacy</h2>
          <p>
            Our platform is not intended for children under 18 without parental/guardian supervision. We collect 
            information about minors only as part of household benefit applications with guardian consent.
          </p>
        </section>

        <section data-testid="section-contact-privacy">
          <h2>Contact Information - Privacy Officer</h2>
          <p>For privacy-related questions, concerns, or to exercise your rights, contact:</p>
          <div className="bg-muted p-4 rounded-lg" data-testid="contact-privacy-officer">
            <p className="font-semibold">Privacy Officer</p>
            <p>{stateName} Benefits Platform</p>
            <p>Email: privacy@marylandbenefits.org</p>
            <p>Phone: (410) 555-PRIVACY (774-8229)</p>
            <p>Mail: Privacy Office, {stateName} Benefits Platform (Address TBD - Contact via phone or email)</p>
          </div>
        </section>

        <section data-testid="section-policy-updates">
          <h2>Policy Updates</h2>
          <p>
            We may update this Privacy Policy to reflect changes in legal requirements or platform functionality. 
            Material changes will be communicated via email and require your consent before continued use.
          </p>
          <p className="font-semibold">
            Current Version: 1.0 | Effective Date: October 16, 2025
          </p>
        </section>
      </LegalLayout>
    </>
  );
}
