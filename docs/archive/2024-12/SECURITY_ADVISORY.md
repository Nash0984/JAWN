# Security Advisory & Vulnerability Management

## Current Security Status

**Last Audit Date**: October 14, 2025  
**Overall Risk Level**: **LOW**

### Resolved Vulnerabilities

#### ✅ happy-dom (Critical RCE) - FIXED
- **Severity**: Critical  
- **CVE**: GHSA-37j7-fg3j-429f  
- **Issue**: VM Context Escape leading to Remote Code Execution  
- **Resolution**: Upgraded to happy-dom@20.0.0  
- **Impact**: Development/testing only (not used in production)

#### ✅ brace-expansion (Low ReDoS) - FIXED
- **Severity**: Low  
- **CVE**: GHSA-v6h2-p8h4-qcjw  
- **Issue**: Regular Expression Denial of Service  
- **Resolution**: Upgraded to secure version  
- **Impact**: Transitive dependency, minimal risk

#### ✅ on-headers (Low) - FIXED
- **Severity**: Low  
- **CVE**: GHSA-76c9-3jph-rj3q  
- **Issue**: HTTP response header manipulation  
- **Resolution**: Upgraded express-session to patched version  
- **Impact**: Mitigated by Express.js security headers middleware

### Active Vulnerabilities (Under Review)

#### ⚠️ xlsx (High - No Fix Available)
- **Severity**: High  
- **CVEs**:  
  - GHSA-4r6h-8v6p-xvw6 (Prototype Pollution)  
  - GHSA-5pgg-2g8v-p4x9 (ReDoS)  
- **Status**: No fix available from maintainer  
- **Current Version**: Latest (vulnerable)  
- **Impact Assessment**:  
  - Used for Maryland tax evaluation framework  
  - **Mitigation**: Input validation, file size limits enforced  
  - Only processes trusted evaluation datasets, not user uploads  
- **Recommended Action**: Monitor for security updates, consider migration to safer alternative (exceljs, xlsx-populate)
- **Priority**: Medium (mitigations in place)

#### ℹ️ esbuild (Moderate - Development Only)
- **Severity**: Moderate  
- **CVE**: GHSA-67mh-4wv8-2f99  
- **Issue**: Development server request/response exposure  
- **Status**: Affects vite dev server and drizzle-kit  
- **Impact**: **Development environment only** (not in production bundle)  
- **Mitigation**: Dev servers firewalled, local access only  
- **Recommended Action**: Upgrade when stable version available  
- **Priority**: Low (dev-only, network isolated)

## Security Hardening Measures (Active)

### Application Security

1. **Authentication & Authorization** ✅
   - Bcrypt password hashing (12 rounds)  
   - Password complexity enforcement (12+ chars, mixed case, numbers, special)  
   - Session-based authentication with secure cookies  
   - Role-based access control (RBAC)  
   - Ownership verification preventing horizontal privilege escalation

2. **Data Protection** ✅
   - Field-level encryption (AES-256-GCM) for SSN and bank account fields  
   - PII masking in logs  
   - Secure session management (httpOnly, secure, sameSite cookies)  
   - 64-char SESSION_SECRET and ENCRYPTION_KEY

3. **Input Validation & Sanitization** ✅
   - XSS protection with iterative entity decoding  
   - SQL injection prevention via Drizzle ORM parameterization  
   - Request size limits (10MB body, 5MB JSON)  
   - Parameter pollution protection  
   - CSRF protection (double-submit cookie pattern)

4. **Network Security** ✅
   - CORS whitelist (environment-specific, no wildcards)  
   - Security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)  
   - Rate limiting (role-based tiers: admin 1000/15min, navigator 500/15min, applicant 100/15min, anonymous 20/15min)  
   - DoS protection (request timeout, URL length limits)

5. **File Upload Security** ✅
   - MIME type validation  
   - Magic number verification  
   - Filename sanitization  
   - Virus scanning hooks ready  
   - Size limits enforced

### Operational Security

6. **Monitoring & Logging** ✅
   - Security monitoring dashboard (`/admin/security-monitoring`)  
   - Real-time metrics: failed auth, XSS attempts, CSRF violations, ownership violations  
   - Security score calculation (0-100)  
   - Top attacking IPs tracking  
   - Comprehensive audit logging

7. **Production Readiness** ✅
   - Environment validation on startup  
   - Health check endpoints for load balancers  
   - Graceful shutdown with connection draining  
   - Production deployment checklist

## Vulnerability Response Process

### 1. Detection
- **Automated Scanning**: npm audit on every dependency update  
- **Manual Review**: Quarterly security audits  
- **Monitoring**: GitHub Security Advisories, Snyk, OWASP feeds  
- **Runtime Detection**: Security monitoring dashboard alerts

### 2. Assessment
- **Severity Classification**: Critical > High > Medium > Low  
- **Impact Analysis**: Production vs Development, Attack Surface  
- **Exploitability**: Public exploits available? Authentication required?  
- **Data Exposure**: PII, credentials, or sensitive data at risk?

### 3. Response Timeline
- **Critical** (RCE, Data Breach): Immediate (< 4 hours)  
- **High** (XSS, Auth Bypass): Same day (< 24 hours)  
- **Medium** (DoS, Info Disclosure): Within 1 week  
- **Low** (Minor issues): Next release cycle

### 4. Mitigation Priority
1. Apply available patches immediately  
2. Implement workarounds if no patch available  
3. Add compensating controls (rate limiting, input validation)  
4. Document risk acceptance for low-impact issues  
5. Plan migration for unmaintained dependencies

## Dependency Security Policy

### Approved Libraries
- **Database**: Drizzle ORM (PostgreSQL)  
- **Authentication**: Passport.js with local strategy  
- **Password Hashing**: bcryptjs  
- **Sessions**: express-session with connect-pg-simple  
- **Security**: Helmet.js, express-rate-limit, csrf-csrf  
- **Encryption**: Node.js crypto (AES-256-GCM)

### Restricted/Deprecated
- ❌ **xlsx**: High severity vulnerabilities, consider alternatives  
  - Recommended: exceljs, xlsx-populate, or SheetJS Pro (paid, patched)  
- ✅ **happy-dom**: Upgraded to secure version (20.0.0+)

### Dependency Update Policy
1. **Security Updates**: Apply immediately (within 24 hours)  
2. **Major Versions**: Test in staging first, rollback plan required  
3. **Dev Dependencies**: Update monthly unless security issues  
4. **Production Dependencies**: Update quarterly with full regression testing

## Security Contacts

### Internal
- **Security Team**: security@mdbenefits.gov  
- **DevOps/SRE**: devops@mdbenefits.gov  
- **Compliance**: compliance@mdbenefits.gov

### External
- **Maryland DHS IT Security**: dhsitsecurity@maryland.gov  
- **Replit Security**: security@replit.com (hosting platform)  
- **Google Cloud Security**: For GCS/Gemini API issues

## Compliance & Audit

### Regular Security Tasks
- [ ] **Weekly**: Review security monitoring dashboard  
- [ ] **Monthly**: npm audit and dependency updates  
- [ ] **Quarterly**: Full penetration testing  
- [ ] **Annually**: HIPAA/SOC2 compliance audit  

### Audit Log Retention
- **Security Events**: 7 years (HIPAA requirement)  
- **Authentication**: 2 years  
- **Application Logs**: 90 days  
- **Access Logs**: 1 year

### Penetration Testing
- **Scope**: OWASP Top 10, authentication, authorization, data protection  
- **Frequency**: Quarterly (internal), Annually (3rd party)  
- **Tools**: OWASP ZAP, Burp Suite, Nmap, SQLMap  
- **Reports**: Stored securely, shared with security team only

## Incident Response Plan

### Security Incident Classification

**P0 - Critical (Data Breach, Active Attack)**
- Response Time: Immediate (< 1 hour)  
- Notification: Security team, management, legal  
- Actions: Isolate affected systems, collect evidence, patch immediately

**P1 - High (Vulnerability Exploited, Auth Bypass)**
- Response Time: Same day (< 4 hours)  
- Notification: Security team, DevOps  
- Actions: Apply mitigations, monitor for exploitation

**P2 - Medium (Potential Vulnerability, DoS)**
- Response Time: Next business day  
- Notification: DevOps, security team (FYI)  
- Actions: Schedule patch, implement workarounds

**P3 - Low (Information Disclosure, Minor Issues)**
- Response Time: Next sprint  
- Notification: Development team  
- Actions: Fix in next release

### Post-Incident Review
- Root cause analysis within 5 business days  
- Lessons learned documentation  
- Process improvement recommendations  
- Update runbooks and security policies

---

**Next Security Review**: January 2026  
**Document Version**: 1.0  
**Last Updated**: October 14, 2025
