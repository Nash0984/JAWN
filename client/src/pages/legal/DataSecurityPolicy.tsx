import { Helmet } from "react-helmet-async";
import LegalLayout from "@/components/LegalLayout";
import { useTenant } from "@/contexts/TenantContext";

export default function DataSecurityPolicy() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  
  return (
    <>
      <Helmet>
        <title>Data Security Policy - {stateName} Benefits Platform</title>
        <meta 
          name="description" 
          content={`Learn about ${stateName} Benefits Platform's comprehensive data security measures including AES-256-GCM encryption, audit logging, and HIPAA-compliant security controls.`} 
        />
      </Helmet>
      
      <LegalLayout title="Data Security Policy" lastReviewed="October 16, 2025">
        <section data-testid="section-security-overview">
          <h2>Security Overview</h2>
          <p>
            {stateName} Benefits Platform implements defense-in-depth security controls to protect your personal 
            and protected health information (PHI). This policy describes our technical, administrative, and 
            physical safeguards in accordance with HIPAA Security Rule requirements.
          </p>
        </section>

        <section data-testid="section-encryption">
          <h2>Field-Level Encryption (AES-256-GCM)</h2>
          
          <h3>Encryption Standards</h3>
          <p>
            We use <strong>AES-256-GCM (Advanced Encryption Standard with 256-bit keys and Galois/Counter Mode)</strong> 
            for field-level encryption of highly sensitive data:
          </p>
          <ul>
            <li><strong>Social Security Numbers</strong></li>
            <li><strong>Date of Birth</strong></li>
            <li><strong>Protected Health Information (PHI)</strong></li>
            <li><strong>Financial Account Numbers</strong></li>
            <li><strong>Tax Return Data</strong></li>
            <li><strong>Authentication Credentials</strong></li>
          </ul>

          <h3>Encryption Architecture</h3>
          <ul>
            <li><strong>Algorithm:</strong> AES-256-GCM (NIST-approved, FIPS 140-2 compliant)</li>
            <li><strong>Key Management:</strong> Separate key management system with role-based access</li>
            <li><strong>Key Rotation:</strong> Automatic 90-day rotation for encryption keys</li>
            <li><strong>Key Storage:</strong> Hardware Security Module (HSM) protected storage</li>
            <li><strong>Transport Encryption:</strong> TLS 1.3 for all data in transit</li>
            <li><strong>Database Encryption:</strong> Transparent Data Encryption (TDE) at rest</li>
          </ul>

          <h3>Encryption Scope</h3>
          <ul>
            <li><strong>At Rest:</strong> All sensitive data encrypted in database storage</li>
            <li><strong>In Transit:</strong> TLS 1.3 with perfect forward secrecy</li>
            <li><strong>In Memory:</strong> Decrypted only when needed, cleared after use</li>
            <li><strong>In Backups:</strong> Encrypted backups with separate backup encryption keys</li>
          </ul>
        </section>

        <section data-testid="section-access-controls">
          <h2>Access Controls</h2>
          
          <h3>Authentication</h3>
          <ul>
            <li><strong>Password Requirements:</strong> Minimum 12 characters, complexity requirements enforced</li>
            <li><strong>Password Hashing:</strong> bcrypt with 12-round cost factor (adaptive hashing)</li>
            <li><strong>Multi-Factor Authentication (MFA):</strong> Available for all users, required for staff</li>
            <li><strong>Session Management:</strong> 30-minute idle timeout, secure session tokens</li>
            <li><strong>Account Lockout:</strong> 5 failed attempts trigger temporary account lockout</li>
          </ul>

          <h3>Role-Based Access Control (RBAC)</h3>
          <ul>
            <li><strong>Client:</strong> Access to own data and applications only</li>
            <li><strong>Navigator:</strong> Limited access to assigned client cases</li>
            <li><strong>Caseworker:</strong> Access to cases within assigned jurisdiction</li>
            <li><strong>Supervisor:</strong> Oversight access for quality assurance</li>
            <li><strong>Admin:</strong> System administration with audit trail</li>
          </ul>

          <h3>Principle of Least Privilege</h3>
          <p>
            Users are granted only the minimum access necessary to perform their job functions. 
            Access rights are reviewed quarterly and automatically revoked upon role changes or termination.
          </p>
        </section>

        <section data-testid="section-audit-logging">
          <h2>Audit Logging and Monitoring</h2>
          
          <h3>Comprehensive Audit Trail</h3>
          <p>All system activities are logged with the following information:</p>
          <ul>
            <li><strong>User Actions:</strong> Login attempts, data access, modifications, deletions</li>
            <li><strong>Timestamps:</strong> Precise UTC timestamps for all events</li>
            <li><strong>IP Addresses:</strong> Source IP for security analysis</li>
            <li><strong>User Identifiers:</strong> User ID and role at time of action</li>
            <li><strong>Data Changes:</strong> Before/after values for audit trail</li>
            <li><strong>System Events:</strong> Configuration changes, security events</li>
          </ul>

          <h3>Log Retention</h3>
          <ul>
            <li><strong>Active Logs:</strong> 90 days in hot storage for immediate analysis</li>
            <li><strong>Archive Logs:</strong> 7 years in compliance with HIPAA requirements</li>
            <li><strong>Security Logs:</strong> Immutable, tamper-proof storage</li>
            <li><strong>Backup Logs:</strong> Encrypted offsite backup with 30-day retention</li>
          </ul>

          <h3>Real-Time Monitoring</h3>
          <ul>
            <li>Automated alerts for suspicious activity patterns</li>
            <li>Failed login attempt monitoring and blocking</li>
            <li>Unusual data access pattern detection</li>
            <li>Privilege escalation attempt detection</li>
            <li>Data exfiltration prevention monitoring</li>
          </ul>
        </section>

        <section data-testid="section-security-headers">
          <h2>Security Headers and CSRF Protection</h2>
          
          <h3>HTTP Security Headers</h3>
          <ul>
            <li><strong>Content-Security-Policy (CSP):</strong> Prevents XSS attacks by controlling resource sources</li>
            <li><strong>X-Frame-Options:</strong> DENY - Prevents clickjacking attacks</li>
            <li><strong>X-Content-Type-Options:</strong> nosniff - Prevents MIME sniffing</li>
            <li><strong>Strict-Transport-Security (HSTS):</strong> Forces HTTPS connections (max-age: 1 year)</li>
            <li><strong>Referrer-Policy:</strong> strict-origin-when-cross-origin</li>
            <li><strong>Permissions-Policy:</strong> Restricts browser feature access</li>
          </ul>

          <h3>CSRF Protection</h3>
          <ul>
            <li>Double-submit cookie pattern for all state-changing requests</li>
            <li>Synchronized token pattern for form submissions</li>
            <li>SameSite cookie attribute set to 'Lax'</li>
            <li>Origin and Referer header validation</li>
          </ul>

          <h3>XSS Prevention</h3>
          <ul>
            <li>Input sanitization on all user inputs</li>
            <li>Output encoding for all dynamic content</li>
            <li>Content Security Policy enforcement</li>
            <li>HTML/JavaScript escaping in templates</li>
          </ul>
        </section>

        <section data-testid="section-rate-limiting">
          <h2>Rate Limiting and DoS Protection</h2>
          
          <h3>API Rate Limiting</h3>
          <ul>
            <li><strong>Authentication Endpoints:</strong> 5 requests per 15 minutes per IP</li>
            <li><strong>Data Access Endpoints:</strong> 100 requests per minute per user</li>
            <li><strong>File Upload Endpoints:</strong> 10 uploads per hour per user</li>
            <li><strong>Search Endpoints:</strong> 30 requests per minute per user</li>
          </ul>

          <h3>DDoS Mitigation</h3>
          <ul>
            <li>Cloudflare DDoS protection with automatic mitigation</li>
            <li>Geographic request filtering for suspicious traffic</li>
            <li>IP reputation-based blocking</li>
            <li>Progressive backoff for repeated failures</li>
            <li>Automatic scaling for legitimate traffic spikes</li>
          </ul>

          <h3>Resource Protection</h3>
          <ul>
            <li>Request size limits (10MB max payload)</li>
            <li>Query timeout enforcement (30 seconds max)</li>
            <li>Connection pooling limits</li>
            <li>Memory usage monitoring and throttling</li>
          </ul>
        </section>

        <section data-testid="section-database-security">
          <h2>Database Security and Connection Pooling</h2>
          
          <h3>Database Access Controls</h3>
          <ul>
            <li><strong>Network Isolation:</strong> Database accessible only from application servers (no public access)</li>
            <li><strong>Credential Management:</strong> Encrypted connection strings, rotated credentials</li>
            <li><strong>Query Parameterization:</strong> All queries use parameterized statements (no SQL injection)</li>
            <li><strong>Stored Procedures:</strong> Limited use with strict input validation</li>
            <li><strong>Database Auditing:</strong> All DDL/DML operations logged</li>
          </ul>

          <h3>Connection Pooling</h3>
          <ul>
            <li><strong>Pool Size:</strong> Dynamic sizing (10-100 connections) based on load</li>
            <li><strong>Connection Lifetime:</strong> 30-minute maximum lifetime</li>
            <li><strong>Idle Timeout:</strong> 10 minutes for idle connections</li>
            <li><strong>Connection Validation:</strong> Health checks before each use</li>
            <li><strong>SSL/TLS:</strong> All database connections encrypted with TLS 1.3</li>
          </ul>

          <h3>Data Integrity</h3>
          <ul>
            <li>Database constraints for data validation</li>
            <li>Transaction isolation levels enforced</li>
            <li>Automated backup verification</li>
            <li>Point-in-time recovery capability</li>
            <li>Checksum verification for data integrity</li>
          </ul>
        </section>

        <section data-testid="section-incident-response">
          <h2>Security Incident Response</h2>
          
          <h3>Incident Detection</h3>
          <ul>
            <li>24/7 Security Operations Center (SOC) monitoring</li>
            <li>Automated intrusion detection systems (IDS)</li>
            <li>Behavioral analytics for anomaly detection</li>
            <li>Threat intelligence integration</li>
            <li>User-reported security incident channel</li>
          </ul>

          <h3>Response Procedures</h3>
          <ol>
            <li><strong>Detection and Triage:</strong> Incident classified by severity (P0-P4)</li>
            <li><strong>Containment:</strong> Immediate action to limit damage and prevent spread</li>
            <li><strong>Investigation:</strong> Root cause analysis and scope assessment</li>
            <li><strong>Eradication:</strong> Remove threat and patch vulnerabilities</li>
            <li><strong>Recovery:</strong> Restore systems and verify integrity</li>
            <li><strong>Post-Incident Review:</strong> Document lessons learned and improve defenses</li>
          </ol>

          <h3>Escalation</h3>
          <ul>
            <li><strong>P0 (Critical):</strong> CISO notified immediately, executive team within 1 hour</li>
            <li><strong>P1 (High):</strong> Security team lead notified within 15 minutes</li>
            <li><strong>P2 (Medium):</strong> Security analyst assigned within 1 hour</li>
            <li><strong>P3-P4 (Low):</strong> Handled during business hours</li>
          </ul>
        </section>

        <section data-testid="section-security-monitoring">
          <h2>Security Monitoring Dashboard</h2>
          <p>
            Authorized administrators have access to a real-time security monitoring dashboard displaying:
          </p>
          <ul>
            <li>Active user sessions and geographic distribution</li>
            <li>Failed authentication attempts and blocked IPs</li>
            <li>API rate limit violations and throttled requests</li>
            <li>System resource utilization and performance metrics</li>
            <li>Recent security events and alerts</li>
            <li>Compliance status indicators (HIPAA, encryption coverage)</li>
            <li>Vulnerability scan results and patch status</li>
          </ul>
        </section>

        <section data-testid="section-vulnerability-management">
          <h2>Vulnerability Management</h2>
          
          <h3>Scanning and Assessment</h3>
          <ul>
            <li><strong>Automated Scans:</strong> Weekly vulnerability scans of all systems</li>
            <li><strong>Penetration Testing:</strong> Quarterly third-party penetration tests</li>
            <li><strong>Code Analysis:</strong> Static and dynamic code analysis on every deployment</li>
            <li><strong>Dependency Scanning:</strong> Automated checks for vulnerable dependencies</li>
            <li><strong>Configuration Audits:</strong> Monthly security configuration reviews</li>
          </ul>

          <h3>Patch Management</h3>
          <ul>
            <li><strong>Critical Patches:</strong> Applied within 24 hours of availability</li>
            <li><strong>High-Priority Patches:</strong> Applied within 7 days</li>
            <li><strong>Standard Patches:</strong> Applied within 30 days</li>
            <li><strong>Testing:</strong> All patches tested in staging before production deployment</li>
            <li><strong>Rollback Plan:</strong> Documented rollback procedures for all patches</li>
          </ul>
        </section>

        <section data-testid="section-physical-security">
          <h2>Physical Security</h2>
          <ul>
            <li><strong>Data Centers:</strong> SOC 2 Type II certified facilities with 24/7 security</li>
            <li><strong>Access Control:</strong> Biometric access controls and visitor logs</li>
            <li><strong>Surveillance:</strong> CCTV monitoring with 90-day retention</li>
            <li><strong>Environmental Controls:</strong> Fire suppression, temperature monitoring, redundant power</li>
            <li><strong>Equipment Disposal:</strong> DoD 5220.22-M certified data destruction</li>
          </ul>
        </section>

        <section data-testid="section-employee-security">
          <h2>Employee Security Awareness</h2>
          <ul>
            <li><strong>Security Training:</strong> Annual HIPAA and security awareness training required</li>
            <li><strong>Background Checks:</strong> All staff undergo background screening</li>
            <li><strong>Confidentiality Agreements:</strong> Signed by all employees and contractors</li>
            <li><strong>Access Revocation:</strong> Immediate access termination upon employee departure</li>
            <li><strong>Phishing Tests:</strong> Quarterly simulated phishing campaigns</li>
          </ul>
        </section>

        <section data-testid="section-compliance-certifications">
          <h2>Compliance and Certifications</h2>
          <ul>
            <li><strong>HIPAA Compliance:</strong> Security Rule and Breach Notification Rule</li>
            <li><strong>SOC 2 Type II:</strong> Annual audit of security controls</li>
            <li><strong>PCI DSS:</strong> Level 1 compliance (if processing payments)</li>
            <li><strong>NIST CSF:</strong> Aligned with NIST Cybersecurity Framework</li>
            <li><strong>FedRAMP Moderate:</strong> Working toward authorization</li>
          </ul>
        </section>

        <section data-testid="section-contact-security">
          <h2>Contact Information - Security Team</h2>
          <p>To report security vulnerabilities or incidents:</p>
          <div className="bg-muted p-4 rounded-lg" data-testid="contact-security">
            <p className="font-semibold">Chief Information Security Officer (CISO)</p>
            <p>{stateName} Benefits Platform</p>
            <p>Email: security@marylandbenefits.org</p>
            <p>Incident Hotline: (410) 555-SECURE (732-873) [24/7]</p>
            <p>Bug Bounty: https://bugcrowd.com/marylandbenefits</p>
            <p>PGP Key: Available at https://marylandbenefits.org/pgp</p>
          </div>
        </section>

        <section data-testid="section-security-version">
          <h2>Document Information</h2>
          <p className="font-semibold">
            Current Version: 1.0 | Last Updated: October 16, 2025
          </p>
          <p>
            This policy is reviewed annually and updated as security requirements evolve.
          </p>
        </section>
      </LegalLayout>
    </>
  );
}
