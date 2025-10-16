import { Helmet } from "react-helmet-async";
import LegalLayout from "@/components/LegalLayout";

export default function BreachNotificationPolicy() {
  return (
    <>
      <Helmet>
        <title>Breach Notification Policy - Maryland Benefits Platform</title>
        <meta 
          name="description" 
          content="Maryland Benefits Platform's breach notification procedures, HIPAA compliance, incident response timeline, and user notification process." 
        />
      </Helmet>
      
      <LegalLayout title="Breach Notification Policy" lastReviewed="October 16, 2025">
        <section data-testid="section-breach-overview">
          <h2>Overview</h2>
          <p>
            Maryland Benefits Platform is committed to protecting your personal and protected health information (PHI). 
            This Breach Notification Policy outlines our procedures for detecting, responding to, and notifying affected 
            parties in the event of a data security breach, in full compliance with the HIPAA Breach Notification Rule 
            (45 CFR §§ 164.400-414) and Maryland's Personal Information Protection Act.
          </p>
        </section>

        <section data-testid="section-breach-definition">
          <h2>What Constitutes a Breach</h2>
          
          <h3>HIPAA Breach Definition</h3>
          <p>
            A breach is defined as the acquisition, access, use, or disclosure of protected health information (PHI) 
            in a manner not permitted under the HIPAA Privacy Rule that compromises the security or privacy of the PHI.
          </p>

          <h3>Breach Examples</h3>
          <ul>
            <li>Unauthorized access to user accounts or databases</li>
            <li>Theft or loss of devices containing unencrypted PHI</li>
            <li>Accidental disclosure of PHI to unauthorized parties</li>
            <li>Ransomware or malware attacks affecting PHI</li>
            <li>Insider threats or malicious employee access</li>
            <li>Successful phishing attacks leading to credential compromise</li>
            <li>Third-party vendor security incidents affecting our data</li>
          </ul>

          <h3>Exceptions (Not Considered a Breach)</h3>
          <ul>
            <li>Unintentional access by authorized workforce members acting in good faith</li>
            <li>Inadvertent disclosure between authorized persons at the same facility</li>
            <li>Access where the recipient could not reasonably retain the information</li>
            <li>Encrypted data where encryption keys were not compromised</li>
          </ul>
        </section>

        <section data-testid="section-incident-detection">
          <h2>Incident Detection and Assessment</h2>
          
          <h3>Detection Methods</h3>
          <ul>
            <li><strong>Automated Monitoring:</strong> 24/7 security information and event management (SIEM) system</li>
            <li><strong>Intrusion Detection:</strong> Real-time alerts for unauthorized access attempts</li>
            <li><strong>Audit Log Analysis:</strong> Daily review of access logs for anomalies</li>
            <li><strong>User Reports:</strong> Employee and user reporting channels</li>
            <li><strong>Vulnerability Scans:</strong> Weekly automated scans for security weaknesses</li>
            <li><strong>Third-Party Alerts:</strong> Notifications from security partners and vendors</li>
          </ul>

          <h3>Initial Assessment (Within 24 Hours)</h3>
          <p>Upon detection of a potential incident, our security team will:</p>
          <ol>
            <li><strong>Confirm the Incident:</strong> Verify that a security event has occurred</li>
            <li><strong>Scope Assessment:</strong> Determine what data was accessed or disclosed</li>
            <li><strong>Impact Analysis:</strong> Assess potential harm to affected individuals</li>
            <li><strong>Risk Determination:</strong> Conduct risk assessment using HIPAA's 4-factor analysis:
              <ul>
                <li>Nature and extent of PHI involved</li>
                <li>Unauthorized person who accessed the PHI</li>
                <li>Whether PHI was actually acquired or viewed</li>
                <li>Extent to which risk has been mitigated</li>
              </ul>
            </li>
          </ol>

          <h3>Breach Classification</h3>
          <ul>
            <li><strong>Critical (P0):</strong> Large-scale breach affecting &gt;500 individuals or sensitive PHI exposure</li>
            <li><strong>High (P1):</strong> Breach affecting &lt;500 individuals with confirmed PHI access</li>
            <li><strong>Medium (P2):</strong> Limited breach with low risk of harm</li>
            <li><strong>Low (P3):</strong> Security incident not meeting breach threshold</li>
          </ul>
        </section>

        <section data-testid="section-notification-timeline">
          <h2>Notification Timeline (HIPAA 72-Hour Requirement)</h2>
          
          <h3>Individual Notification</h3>
          <p>
            <strong>Timeframe:</strong> No later than <span className="font-semibold">60 days after discovery</span> of the breach
          </p>
          <p><strong>Method of Notification:</strong></p>
          <ul>
            <li><strong>Primary:</strong> Written notification via first-class mail to last known address</li>
            <li><strong>Alternate:</strong> Email (if individual previously consented to electronic communication)</li>
            <li><strong>Urgent:</strong> Phone call for imminent risk (followed by written notice)</li>
            <li><strong>Substitute:</strong> If contact information is insufficient for 10+ individuals:
              <ul>
                <li>Conspicuous posting on website homepage for 90 days</li>
                <li>Notice in major print or broadcast media in affected area</li>
              </ul>
            </li>
          </ul>

          <h3>Media Notification</h3>
          <p>
            For breaches affecting <strong>more than 500 individuals in a state or jurisdiction</strong>:
          </p>
          <ul>
            <li><strong>Timeframe:</strong> Same time as individual notification</li>
            <li><strong>Method:</strong> Notice to prominent media outlets serving the affected area</li>
            <li><strong>Content:</strong> Same information as individual notifications</li>
          </ul>

          <h3>HHS Secretary Notification</h3>
          <ul>
            <li><strong>Large Breach (&gt;500 individuals):</strong> Contemporaneous with individual notice (within 60 days)</li>
            <li><strong>Small Breach (&lt;500 individuals):</strong> Annual log submission within 60 days of calendar year end</li>
            <li><strong>Method:</strong> Electronic submission via HHS Breach Portal (https://ocrportal.hhs.gov/ocr/breach)</li>
          </ul>

          <h3>State Agency Notification (Maryland)</h3>
          <p>
            In accordance with Maryland Personal Information Protection Act:
          </p>
          <ul>
            <li><strong>Timeframe:</strong> Without unreasonable delay</li>
            <li><strong>Recipient:</strong> Maryland Attorney General's Office</li>
            <li><strong>Threshold:</strong> Notification required if &gt;1,000 Maryland residents affected</li>
          </ul>
        </section>

        <section data-testid="section-notification-content">
          <h2>Notification Content Requirements</h2>
          <p>All breach notifications will include:</p>
          <ol>
            <li><strong>Description of the Breach:</strong>
              <ul>
                <li>Date of the breach and date of discovery</li>
                <li>Type of breach (unauthorized access, theft, improper disposal, etc.)</li>
              </ul>
            </li>
            <li><strong>Types of Information Involved:</strong>
              <ul>
                <li>Specific data elements compromised (SSN, PHI, financial data, etc.)</li>
                <li>Scope of affected information</li>
              </ul>
            </li>
            <li><strong>Steps Individuals Should Take:</strong>
              <ul>
                <li>Protective measures to mitigate potential harm</li>
                <li>Credit monitoring services offered (if applicable)</li>
                <li>Contact information for credit bureaus and fraud alerts</li>
                <li>How to monitor accounts for suspicious activity</li>
              </ul>
            </li>
            <li><strong>Platform's Response Actions:</strong>
              <ul>
                <li>Steps taken to investigate the breach</li>
                <li>Containment and mitigation measures implemented</li>
                <li>Actions to prevent future incidents</li>
              </ul>
            </li>
            <li><strong>Contact Information:</strong>
              <ul>
                <li>Dedicated breach response hotline: (410) 555-BREACH (273-2242)</li>
                <li>Email: breach-response@marylandbenefits.org</li>
                <li>Security team member assigned to assist</li>
              </ul>
            </li>
          </ol>
        </section>

        <section data-testid="section-affected-party-notification">
          <h2>Affected Party Notification Process</h2>
          
          <h3>User Notification Steps</h3>
          <ol>
            <li><strong>Personalized Letters:</strong> Individual letters detailing specific impact</li>
            <li><strong>In-Platform Alert:</strong> Prominent notification upon login</li>
            <li><strong>Email Notification:</strong> Sent to registered email address</li>
            <li><strong>SMS Alert:</strong> Text message to registered phone number (for urgent breaches)</li>
            <li><strong>Follow-Up Support:</strong> Dedicated support team for breach-related questions</li>
          </ol>

          <h3>Support Services Provided</h3>
          <ul>
            <li><strong>Credit Monitoring:</strong> 2-year complimentary credit monitoring for affected users</li>
            <li><strong>Identity Theft Protection:</strong> Identity restoration services</li>
            <li><strong>Fraud Alert Assistance:</strong> Help placing fraud alerts with credit bureaus</li>
            <li><strong>Dedicated Hotline:</strong> 24/7 breach response helpline</li>
            <li><strong>Legal Guidance:</strong> Access to legal resources for identity theft victims</li>
          </ul>

          <h3>Communication Transparency</h3>
          <p>We commit to:</p>
          <ul>
            <li>Clear, plain-language communication (no technical jargon)</li>
            <li>Honest assessment of risks and potential harm</li>
            <li>Regular updates as investigation progresses</li>
            <li>Accessible communication for users with disabilities</li>
            <li>Translation services for non-English speakers</li>
          </ul>
        </section>

        <section data-testid="section-regulatory-reporting">
          <h2>Regulatory Reporting</h2>
          
          <h3>HHS Office for Civil Rights (OCR)</h3>
          <ul>
            <li><strong>Portal Submission:</strong> Electronic filing via HHS Breach Portal</li>
            <li><strong>Information Provided:</strong> Number of affected individuals, breach details, steps taken</li>
            <li><strong>Annual Report:</strong> Log of breaches &lt;500 individuals submitted by March 1</li>
          </ul>

          <h3>Maryland Attorney General</h3>
          <ul>
            <li><strong>Threshold:</strong> &gt;1,000 Maryland residents affected</li>
            <li><strong>Method:</strong> Written notification to Consumer Protection Division</li>
            <li><strong>Content:</strong> Timing of breach, number affected, actions taken</li>
          </ul>

          <h3>Law Enforcement Coordination</h3>
          <ul>
            <li>Notification to FBI Cyber Division for criminal investigations</li>
            <li>Cooperation with state and local law enforcement</li>
            <li>Delayed notification if law enforcement requests (documented approval required)</li>
          </ul>

          <h3>Industry Notifications</h3>
          <ul>
            <li>US-CERT (United States Computer Emergency Readiness Team)</li>
            <li>FS-ISAC (Financial Services Information Sharing and Analysis Center)</li>
            <li>HIMSS (Healthcare Information and Management Systems Society)</li>
          </ul>
        </section>

        <section data-testid="section-remediation">
          <h2>Remediation and Prevention</h2>
          
          <h3>Immediate Response Actions</h3>
          <ul>
            <li><strong>Containment:</strong> Isolate affected systems to prevent further unauthorized access</li>
            <li><strong>Password Resets:</strong> Force password changes for all affected accounts</li>
            <li><strong>Access Revocation:</strong> Suspend compromised credentials and API keys</li>
            <li><strong>System Hardening:</strong> Apply security patches and configuration updates</li>
            <li><strong>Evidence Preservation:</strong> Secure forensic evidence for investigation</li>
          </ul>

          <h3>Long-Term Corrective Actions</h3>
          <ul>
            <li>Root cause analysis and comprehensive security review</li>
            <li>Implementation of additional security controls</li>
            <li>Enhanced monitoring and detection capabilities</li>
            <li>Staff retraining and security awareness updates</li>
            <li>Third-party security audit and penetration testing</li>
            <li>Policy and procedure updates based on lessons learned</li>
          </ul>

          <h3>Prevention Measures</h3>
          <ul>
            <li>Enhanced encryption for data at rest and in transit</li>
            <li>Multi-factor authentication enforcement</li>
            <li>Improved access controls and least privilege implementation</li>
            <li>Advanced threat detection and response systems</li>
            <li>Regular security training and phishing simulations</li>
            <li>Vendor security assessment program</li>
          </ul>
        </section>

        <section data-testid="section-documentation">
          <h2>Documentation Requirements</h2>
          
          <h3>Incident Documentation</h3>
          <p>All security incidents are documented with:</p>
          <ul>
            <li>Detailed timeline of discovery and response</li>
            <li>Incident classification and risk assessment</li>
            <li>Number of affected individuals and types of data involved</li>
            <li>Notifications sent and recipients</li>
            <li>Remediation actions taken</li>
            <li>Lessons learned and corrective actions</li>
          </ul>

          <h3>Record Retention</h3>
          <ul>
            <li><strong>Breach Documentation:</strong> 6 years (HIPAA requirement)</li>
            <li><strong>Forensic Evidence:</strong> 7 years or until litigation resolved</li>
            <li><strong>Notification Records:</strong> Proof of notification delivery and content</li>
            <li><strong>Regulatory Correspondence:</strong> All communications with HHS, AG, law enforcement</li>
          </ul>

          <h3>Annual Breach Report</h3>
          <p>
            We maintain an internal annual breach summary report for management review, including:
          </p>
          <ul>
            <li>All security incidents and breaches</li>
            <li>Trends and patterns identified</li>
            <li>Effectiveness of response procedures</li>
            <li>Recommendations for security improvements</li>
          </ul>
        </section>

        <section data-testid="section-user-responsibilities">
          <h2>User Responsibilities</h2>
          <p>Users can help prevent and detect breaches by:</p>
          <ul>
            <li>Using strong, unique passwords for their accounts</li>
            <li>Enabling multi-factor authentication</li>
            <li>Not sharing account credentials</li>
            <li>Logging out after each session on shared devices</li>
            <li>Reporting suspicious activity immediately</li>
            <li>Keeping contact information up-to-date</li>
            <li>Reviewing account activity regularly</li>
            <li>Being cautious of phishing attempts</li>
          </ul>
        </section>

        <section data-testid="section-contact-breach">
          <h2>Contact Information - Breach Response Team</h2>
          <p>To report a potential breach or for breach-related assistance:</p>
          <div className="bg-muted p-4 rounded-lg" data-testid="contact-breach">
            <p className="font-semibold">Breach Response Team</p>
            <p>Maryland Benefits Platform</p>
            <p>Hotline: (410) 555-BREACH (273-2242) [24/7]</p>
            <p>Email: breach-response@marylandbenefits.org</p>
            <p>Secure Reporting: https://marylandbenefits.org/report-incident</p>
            <p>Mail: Security Incident Response, 123 Benefits Way, Baltimore, MD 21201</p>
            <p className="mt-2 text-sm text-muted-foreground">Response time: Within 1 hour for critical incidents</p>
          </div>
        </section>

        <section data-testid="section-breach-version">
          <h2>Document Information</h2>
          <p className="font-semibold">
            Current Version: 1.0 | Effective Date: October 16, 2025
          </p>
          <p>
            This policy is reviewed annually and updated as regulations and best practices evolve.
          </p>
        </section>
      </LegalLayout>
    </>
  );
}
