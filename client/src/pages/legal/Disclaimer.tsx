import LegalLayout from "@/components/LegalLayout";
import { useTenant } from "@/contexts/TenantContext";

export default function Disclaimer() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const agencyAcronym = stateConfig?.agencyAcronym || 'DHS';
  
  return (
    <>
      
      <LegalLayout title="Disclaimer" lastReviewed="October 16, 2025">
        <section data-testid="section-disclaimer-overview">
          <h2>Important Notice</h2>
          <p className="text-lg font-semibold text-destructive">
            PLEASE READ THIS DISCLAIMER CAREFULLY BEFORE USING THE {stateName.toUpperCase()} BENEFITS PLATFORM.
          </p>
          <p className="mt-4">
            The {stateName} Benefits Platform ("Platform") provides benefit screening, application assistance, and tax 
            preparation services. This disclaimer outlines important limitations and clarifications about our services.
          </p>
        </section>

        <section data-testid="section-no-government-affiliation">
          <h2>NOT Officially Affiliated with State of {stateName}</h2>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 my-4">
            <p className="font-semibold text-yellow-800 dark:text-yellow-200">
              ⚠️ CRITICAL NOTICE: This Platform is NOT a government website.
            </p>
          </div>
          <ul>
            <li>We are <strong>NOT</strong> operated by the State of {stateName} government</li>
            <li>We are <strong>NOT</strong> affiliated with the {stateName} Department of Human Services ({agencyAcronym})</li>
            <li>We are <strong>NOT</strong> part of any federal agency (Social Security Administration, IRS, USDA)</li>
            <li>We are <strong>NOT</strong> authorized to make official eligibility determinations</li>
            <li>We are <strong>NOT</strong> a government contractor or official partner</li>
          </ul>
          <p className="mt-4">
            <strong>What We Are:</strong> An independent platform designed to assist {stateName} residents with navigating 
            benefit programs and preparing tax returns. We work with the same public information and application systems 
            available to all {stateName} residents.
          </p>
        </section>

        <section data-testid="section-informational-purposes">
          <h2>Informational Purposes Only</h2>
          <p>
            The information provided on this Platform is for <strong>informational and educational purposes only</strong>. 
            It should not be considered:
          </p>
          <ul>
            <li><strong>Legal Advice:</strong> We are not a law firm and do not provide legal counsel</li>
            <li><strong>Financial Advice:</strong> We are not financial advisors or investment professionals</li>
            <li><strong>Medical Advice:</strong> Health information is for eligibility purposes only</li>
            <li><strong>Tax Advice:</strong> Tax preparation follows IRS guidelines but is not personalized tax strategy</li>
            <li><strong>Official Guidance:</strong> Policy interpretations may differ from official agency positions</li>
          </ul>
          <p className="mt-4 font-semibold">
            For specific legal, financial, medical, or tax advice, please consult with licensed professionals in those fields.
          </p>
        </section>

        <section data-testid="section-no-guarantee-eligibility">
          <h2>No Guarantee of Eligibility or Benefits</h2>
          
          <h3>Eligibility Screening Limitations</h3>
          <ul>
            <li>Our eligibility screening tools provide <strong>estimates only</strong></li>
            <li>Actual eligibility is determined by government agencies (DHS, SSA, IRS)</li>
            <li>Screening results do not guarantee benefit approval</li>
            <li>Agency determinations may differ from our calculations</li>
            <li>Policy changes may affect eligibility after screening</li>
          </ul>

          <h3>Application Outcomes</h3>
          <ul>
            <li>We assist with application preparation but <strong>cannot guarantee approval</strong></li>
            <li>Applications are reviewed by government caseworkers who make final decisions</li>
            <li>Additional documentation may be requested by agencies</li>
            <li>Processing times vary and are beyond our control</li>
            <li>Appeals and reconsiderations are handled by government agencies</li>
          </ul>

          <h3>Benefit Amount Estimates</h3>
          <ul>
            <li>Benefit calculations are based on current rules and available information</li>
            <li>Actual benefit amounts may differ due to:
              <ul>
                <li>Agency verification of income and expenses</li>
                <li>Application of state-specific rules and exceptions</li>
                <li>Changes in household circumstances</li>
                <li>Policy updates or cost-of-living adjustments</li>
              </ul>
            </li>
          </ul>
        </section>

        <section data-testid="section-user-responsibility">
          <h2>User Responsibility for Accuracy</h2>
          
          <h3>Information You Provide</h3>
          <p><strong>YOU are responsible for:</strong></p>
          <ul>
            <li>Providing accurate, truthful, and complete information</li>
            <li>Reviewing all applications and forms before submission</li>
            <li>Verifying that uploaded documents are correct and legible</li>
            <li>Updating your information when circumstances change</li>
            <li>Reporting any errors or inaccuracies to government agencies</li>
          </ul>

          <h3>Consequences of Inaccurate Information</h3>
          <p className="text-destructive font-semibold">
            Providing false information to government agencies may result in:
          </p>
          <ul className="text-destructive">
            <li>Denial of benefits</li>
            <li>Termination of existing benefits</li>
            <li>Requirement to repay benefits received</li>
            <li>Criminal prosecution for fraud</li>
            <li>Civil penalties and fines</li>
          </ul>

          <h3>Tax Return Accuracy</h3>
          <p>For tax preparation services:</p>
          <ul>
            <li>You must review your tax return thoroughly before signing</li>
            <li>You are ultimately responsible for the accuracy of your tax return</li>
            <li>Our VITA-certified volunteers follow IRS guidelines but errors may occur</li>
            <li>You are liable for any taxes, penalties, or interest owed</li>
            <li>Discrepancies should be addressed through IRS amendment procedures</li>
          </ul>
        </section>

        <section data-testid="section-platform-limitations">
          <h2>Platform Limitations</h2>
          
          <h3>Technical Limitations</h3>
          <ul>
            <li><strong>Service Availability:</strong> Platform may experience downtime or technical issues</li>
            <li><strong>Data Loss:</strong> While we maintain backups, technical failures could result in data loss</li>
            <li><strong>System Errors:</strong> Bugs or glitches may affect calculations or functionality</li>
            <li><strong>Integration Issues:</strong> Third-party system failures (e.g., IRS e-file) may occur</li>
            <li><strong>AI Limitations:</strong> AI-generated guidance may contain errors or inaccuracies</li>
          </ul>

          <h3>Service Limitations</h3>
          <ul>
            <li><strong>Complex Cases:</strong> Some complex eligibility scenarios may require professional assistance</li>
            <li><strong>State Variations:</strong> Information is specific to {stateName}; may not apply elsewhere</li>
            <li><strong>Policy Changes:</strong> Recent policy updates may not yet be reflected in our system</li>
            <li><strong>Language Support:</strong> Full translation services may not be available for all materials</li>
            <li><strong>Document Processing:</strong> OCR and document extraction may have accuracy limitations</li>
          </ul>

          <h3>What We Cannot Do</h3>
          <ul>
            <li>Make official eligibility determinations</li>
            <li>Approve or deny benefit applications</li>
            <li>Override agency decisions or requirements</li>
            <li>Expedite application processing</li>
            <li>Guarantee specific outcomes or timelines</li>
            <li>Represent you in appeals or hearings</li>
            <li>File applications on behalf of deceased individuals</li>
          </ul>
        </section>

        <section data-testid="section-external-links">
          <h2>Third-Party Websites and Content</h2>
          <ul>
            <li>Our Platform may contain links to external websites (government agencies, resources, partners)</li>
            <li>We are <strong>not responsible</strong> for the content, accuracy, or availability of external sites</li>
            <li>External sites have their own terms of use and privacy policies</li>
            <li>Inclusion of a link does not constitute endorsement</li>
            <li>We do not control or monitor third-party content</li>
          </ul>
        </section>

        <section data-testid="section-no-emergency-services">
          <h2>Not for Emergency Situations</h2>
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 my-4">
            <p className="font-semibold text-red-800 dark:text-red-200">
              🚨 EMERGENCY NOTICE
            </p>
            <p className="mt-2 text-red-700 dark:text-red-300">
              This Platform is NOT designed for emergency situations. If you are experiencing a crisis:
            </p>
          </div>
          <ul>
            <li><strong>Food Emergency:</strong> Contact your local food bank or call 211 for assistance</li>
            <li><strong>Housing Emergency:</strong> Call 211 for local housing resources</li>
            <li><strong>Medical Emergency:</strong> Call 911 or go to nearest emergency room</li>
            <li><strong>Mental Health Crisis:</strong> Call 988 (Suicide & Crisis Lifeline)</li>
            <li><strong>Domestic Violence:</strong> Call National Domestic Violence Hotline at 1-800-799-7233</li>
          </ul>
        </section>

        <section data-testid="section-changes-disclaimer">
          <h2>Changes to Services and Disclaimer</h2>
          <ul>
            <li>We reserve the right to modify, suspend, or discontinue services at any time</li>
            <li>This disclaimer may be updated periodically</li>
            <li>Continued use after changes constitutes acceptance</li>
            <li>Material changes will be communicated via email or in-platform notification</li>
          </ul>
        </section>

        <section data-testid="section-use-at-own-risk">
          <h2>Use at Your Own Risk</h2>
          <p className="text-lg font-semibold">
            BY USING THIS PLATFORM, YOU ACKNOWLEDGE AND AGREE THAT:
          </p>
          <ul>
            <li>You use the Platform entirely at your own risk</li>
            <li>You understand the limitations and disclaimers outlined in this document</li>
            <li>You are responsible for verifying all information and outcomes</li>
            <li>We provide tools and assistance but make no guarantees</li>
            <li>Final responsibility for applications, accuracy, and compliance rests with you</li>
          </ul>
          
          <p className="mt-4 font-semibold">
            THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. TO THE FULLEST EXTENT PERMITTED BY LAW, 
            WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
            PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
        </section>

        <section data-testid="section-liability-limitation">
          <h2>Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, {stateName.toUpperCase()} BENEFITS PLATFORM AND ITS OPERATORS SHALL NOT BE LIABLE FOR:
          </p>
          <ul>
            <li>Denial or reduction of government benefits</li>
            <li>Tax liabilities, penalties, or interest</li>
            <li>Delays in application processing</li>
            <li>Errors in calculations or information</li>
            <li>Technical issues or service interruptions</li>
            <li>Decisions made based on Platform-provided information</li>
            <li>Any indirect, incidental, consequential, or punitive damages</li>
          </ul>
          <p className="mt-4 font-semibold">
            See our <a href="/legal/terms" className="text-primary hover:underline">Terms of Service</a> for complete 
            liability limitations.
          </p>
        </section>

        <section data-testid="section-official-resources">
          <h2>Official Government Resources</h2>
          <p>
            For official information and authoritative guidance, please consult:
          </p>
          <ul>
            <li><strong>{stateName} Department of Human Services:</strong> Contact your local {agencyAcronym} office</li>
            <li><strong>{stateName} SNAP Hotline:</strong> Call 211 for local SNAP information</li>
            <li><strong>{stateName} Medicaid:</strong> Contact your local Medicaid office</li>
            <li><strong>Social Security Administration:</strong> https://www.ssa.gov | 1-800-772-1213</li>
            <li><strong>IRS (Tax Questions):</strong> https://www.irs.gov | 1-800-829-1040</li>
            <li><strong>211:</strong> Call 211 for comprehensive social services information</li>
          </ul>
        </section>

        <section data-testid="section-acknowledgment">
          <h2>Acknowledgment of Understanding</h2>
          <p>
            By using the {stateName} Benefits Platform, you acknowledge that you have read, understood, and agree to 
            this disclaimer. If you do not agree with any part of this disclaimer, you should not use the Platform.
          </p>
        </section>

        <section data-testid="section-contact-questions">
          <h2>Questions or Concerns</h2>
          <p>If you have questions about this disclaimer or need clarification:</p>
          <div className="bg-muted p-4 rounded-lg" data-testid="contact-general">
            <p className="font-semibold">Support Team</p>
            <p>{stateName} Benefits Platform</p>
            <p>Email: support@benefitsplatform.org</p>
            <p>Phone: (410) 555-HELP (4357)</p>
            <p>Hours: Monday-Friday, 8:00 AM - 6:00 PM EST</p>
          </div>
        </section>

        <section data-testid="section-disclaimer-version">
          <h2>Document Information</h2>
          <p className="font-semibold">
            Current Version: 1.0 | Effective Date: October 16, 2025
          </p>
          <p>
            This disclaimer is reviewed periodically and updated as necessary to reflect changes in services or legal requirements.
          </p>
        </section>
      </LegalLayout>
    </>
  );
}
