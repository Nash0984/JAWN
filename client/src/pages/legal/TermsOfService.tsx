import LegalLayout from "@/components/LegalLayout";
import { useTenant } from "@/contexts/TenantContext";

export default function TermsOfService() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const agencyAcronym = stateConfig?.agencyAcronym || 'DHS';
  
  return (
    <>
      
      <LegalLayout title="Terms of Service" lastReviewed="October 16, 2025">
        <section data-testid="section-terms-acceptance">
          <h2>Acceptance of Terms</h2>
          <p>
            By accessing or using the {stateName} Benefits Platform ("Platform"), you agree to be bound by these 
            Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Platform.
          </p>
        </section>

        <section data-testid="section-platform-purpose">
          <h2>Platform Purpose and Scope</h2>
          <p>
            The {stateName} Benefits Platform is designed to assist {stateName} residents in:
          </p>
          <ul>
            <li>Determining eligibility for government benefit programs (SNAP, Medicaid, TANF, etc.)</li>
            <li>Completing and submitting benefit applications</li>
            <li>Preparing federal and {stateName} state tax returns through the IRS VITA program</li>
            <li>Accessing policy information and navigational assistance</li>
            <li>Tracking benefit application status and documentation</li>
          </ul>
          <p className="font-semibold mt-4">
            This Platform is NOT a government website and is NOT officially affiliated with the State of {stateName}, 
            {stateName} Department of Human Services, or any federal agency.
          </p>
        </section>

        <section data-testid="section-user-eligibility">
          <h2>User Eligibility</h2>
          <p>To use this Platform, you must:</p>
          <ul>
            <li>Be at least 18 years old or have guardian consent</li>
            <li>Be a {stateName} resident seeking benefits assistance</li>
            <li>Provide accurate and truthful information</li>
            <li>Have legal authority to apply for benefits on your own behalf or as an authorized representative</li>
          </ul>
        </section>

        <section data-testid="section-user-responsibilities">
          <h2>User Responsibilities and Acceptable Use</h2>
          
          <h3>You Agree To:</h3>
          <ul>
            <li><strong>Provide Accurate Information:</strong> Submit truthful, complete, and current information for all applications and forms</li>
            <li><strong>Maintain Account Security:</strong> Keep your password confidential and notify us immediately of unauthorized access</li>
            <li><strong>Verify Application Data:</strong> Review all applications before submission to ensure accuracy</li>
            <li><strong>Comply with Laws:</strong> Use the Platform only for lawful purposes and in accordance with federal and state regulations</li>
            <li><strong>Update Information:</strong> Promptly update your account information when circumstances change</li>
            <li><strong>Report Fraud:</strong> Notify us if you suspect fraudulent activity or security vulnerabilities</li>
          </ul>

          <h3>Prohibited Activities:</h3>
          <ul>
            <li>Submitting false or fraudulent information</li>
            <li>Accessing another user's account without authorization</li>
            <li>Attempting to circumvent security measures</li>
            <li>Using automated systems (bots, scrapers) to access the Platform</li>
            <li>Interfering with Platform operations or infrastructure</li>
            <li>Uploading malicious code or harmful content</li>
            <li>Using the Platform for unauthorized commercial purposes</li>
            <li>Violating any applicable laws or regulations</li>
          </ul>
        </section>

        <section data-testid="section-platform-services">
          <h2>Platform Services</h2>
          
          <h3>Benefit Screening and Application Assistance</h3>
          <p>
            We provide tools to screen for benefit eligibility and assist with application preparation. 
            Final eligibility determinations are made by government agencies, not by this Platform.
          </p>

          <h3>Tax Preparation (VITA Program)</h3>
          <p>
            Tax preparation services are provided by IRS-certified VITA volunteers. We follow IRS guidelines 
            and quality standards. You are responsible for reviewing your tax return before e-filing or signature.
          </p>

          <h3>Document Upload and Verification</h3>
          <p>
            We provide secure document upload capabilities with AI-assisted verification. You remain responsible 
            for ensuring documents are accurate, complete, and represent your actual circumstances.
          </p>

          <h3>AI-Powered Assistance</h3>
          <p>
            Our Platform uses AI to provide policy guidance, document analysis, and application assistance. 
            AI-generated information should be verified and does not constitute legal or financial advice.
          </p>
        </section>

        <section data-testid="section-account-termination">
          <h2>Account Termination</h2>
          
          <h3>Termination by You</h3>
          <p>
            You may terminate your account at any time through account settings or by contacting support. 
            Upon termination, we will retain data as required by law (see Privacy Policy for retention periods).
          </p>

          <h3>Termination by Us</h3>
          <p>We reserve the right to suspend or terminate your account if you:</p>
          <ul>
            <li>Violate these Terms of Service</li>
            <li>Provide false or fraudulent information</li>
            <li>Engage in prohibited activities</li>
            <li>Pose a security risk to the Platform or other users</li>
            <li>Use the Platform in a manner that causes harm or liability</li>
          </ul>
          <p>
            We will provide notice before termination except where immediate action is required for security or legal reasons.
          </p>
        </section>

        <section data-testid="section-limitation-liability">
          <h2>Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE {stateName.toUpperCase()} BENEFITS PLATFORM AND ITS OPERATORS, VOLUNTEERS, 
            AND AFFILIATES SHALL NOT BE LIABLE FOR:
          </p>
          <ul>
            <li>Denial or reduction of benefits by government agencies</li>
            <li>Delays in application processing</li>
            <li>Errors or omissions in information provided</li>
            <li>Service interruptions or technical failures</li>
            <li>Loss of data due to technical issues (though we maintain backups)</li>
            <li>Decisions made based on Platform-provided information</li>
            <li>Tax liabilities or penalties (you are responsible for reviewing tax returns)</li>
            <li>Indirect, incidental, consequential, or punitive damages</li>
          </ul>
          <p className="font-semibold mt-4">
            TOTAL LIABILITY SHALL NOT EXCEED $100 OR THE AMOUNT YOU PAID TO USE THE PLATFORM (CURRENTLY $0), 
            WHICHEVER IS GREATER.
          </p>
        </section>

        <section data-testid="section-disclaimer-warranties">
          <h2>Disclaimer of Warranties</h2>
          <p>
            THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS 
            OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul>
            <li>Warranties of merchantability or fitness for a particular purpose</li>
            <li>Warranties that the Platform will be error-free or uninterrupted</li>
            <li>Warranties regarding accuracy of AI-generated information</li>
            <li>Warranties that use of the Platform will result in benefit approval</li>
            <li>Warranties regarding third-party services or content</li>
          </ul>
          <p className="font-semibold mt-4">
            YOU UNDERSTAND AND AGREE THAT YOUR USE OF THE PLATFORM IS AT YOUR OWN RISK.
          </p>
        </section>

        <section data-testid="section-indemnification">
          <h2>Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless the {stateName} Benefits Platform, its operators, 
            volunteers, and affiliates from any claims, damages, losses, or expenses (including attorney fees) 
            arising from:
          </p>
          <ul>
            <li>Your use of the Platform</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any laws or regulations</li>
            <li>Information you submit through the Platform</li>
            <li>Your infringement of third-party rights</li>
          </ul>
        </section>

        <section data-testid="section-governing-law">
          <h2>Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the 
            <strong> State of {stateName}</strong>, without regard to its conflict of law provisions.
          </p>
          <p>
            Any legal action or proceeding arising under these Terms shall be brought exclusively in the 
            state or federal courts located in {stateName}.
          </p>
        </section>

        <section data-testid="section-dispute-resolution">
          <h2>Dispute Resolution</h2>
          
          <h3>Informal Resolution</h3>
          <p>
            Before initiating formal legal action, you agree to attempt to resolve disputes informally by 
            contacting us at support@marylandbenefits.org. We will work in good faith to resolve your concerns.
          </p>

          <h3>Arbitration (Optional)</h3>
          <p>
            For disputes not resolved informally, you may opt for binding arbitration under the American 
            Arbitration Association rules. Arbitration shall take place in {stateName}.
          </p>

          <h3>Class Action Waiver</h3>
          <p>
            You agree to bring claims only in your individual capacity and not as part of any class or 
            representative action.
          </p>
        </section>

        <section data-testid="section-intellectual-property">
          <h2>Intellectual Property</h2>
          <p>
            All content on the Platform, including text, graphics, logos, software, and documentation, is 
            the property of {stateName} Benefits Platform or its licensors and is protected by copyright and 
            trademark laws.
          </p>
          <p>
            You may not copy, modify, distribute, or create derivative works without explicit written permission.
          </p>
        </section>

        <section data-testid="section-modifications">
          <h2>Modifications to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. Material changes will be communicated via 
            email and in-platform notifications. Continued use after changes constitutes acceptance of modified Terms.
          </p>
        </section>

        <section data-testid="section-severability">
          <h2>Severability</h2>
          <p>
            If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions 
            shall remain in full force and effect.
          </p>
        </section>

        <section data-testid="section-contact-terms">
          <h2>Contact Information</h2>
          <p>For questions about these Terms of Service, contact:</p>
          <div className="bg-muted p-4 rounded-lg" data-testid="contact-legal">
            <p className="font-semibold">Legal Department</p>
            <p>{stateName} Benefits Platform</p>
            <p>Email: legal@marylandbenefits.org</p>
            <p>Phone: (410) 555-LEGAL (534-2583)</p>
            <p>Mail: Legal Office, {stateName} Benefits Platform (Address TBD - Contact via phone or email)</p>
          </div>
        </section>

        <section data-testid="section-terms-version">
          <h2>Effective Date and Version</h2>
          <p className="font-semibold">
            Current Version: 1.0 | Effective Date: October 16, 2025
          </p>
          <p>
            By using the {stateName} Benefits Platform, you acknowledge that you have read, understood, and agree 
            to be bound by these Terms of Service.
          </p>
        </section>
      </LegalLayout>
    </>
  );
}
