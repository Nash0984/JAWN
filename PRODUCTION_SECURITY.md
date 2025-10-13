# Production Security & Deployment Checklist

## Maryland Benefits Navigator - Production Hardening Guide

This document provides a comprehensive security checklist and deployment guide for the Maryland Benefits Navigator system.

---

## 🔒 Security Features Implemented

### 1. Field-Level Encryption (AES-256-GCM)
**Location:** `server/services/encryption.service.ts`, `server/utils/encryptedFields.ts`

- ✅ Encrypts sensitive PII fields (SSN, bank accounts, tax data)
- ✅ Uses AES-256-GCM with authentication tags
- ✅ Separate encryption for each field with unique IVs
- ✅ Automatic key rotation support
- ✅ **APPLIED TO DATABASE:** All SSN and bank account fields now stored as encrypted JSONB
- ✅ **Tables encrypted:** household_profiles, vita_intake_sessions, ee_clients
- ✅ **Utilities created:** encryptSensitiveFields(), decryptSensitiveFields(), maskSensitiveFields()

**Required Environment Variables:**
```bash
ENCRYPTION_KEY=<64-character-hex-string>  # REQUIRED in production
```

**Generate encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Audit Logging & Compliance
**Location:** `server/services/auditLog.service.ts`

- ✅ Tracks all sensitive operations (CREATE, UPDATE, DELETE, EXPORT)
- ✅ Records PII field access with field-level tracking
- ✅ Captures user context (IP, user agent, session ID)
- ✅ Stores change history (before/after states)
- ✅ Compliance-ready for HIPAA/IRS regulations

**Audit Log Schema:**
- User ID, username, role
- Action type and resource
- IP address and user agent
- Sensitive data access flags
- PII fields accessed
- Change history (before/after)

### 3. PII Masking & Log Redaction
**Location:** `server/utils/piiMasking.ts`

- ✅ Global console override prevents accidental PII logging
- ✅ Automatically redacts SSNs, bank accounts, tax IDs
- ✅ Pattern-based detection and masking
- ✅ Imported early in `server/index.ts` to protect all logs

**Protected Patterns:**
- SSN: `XXX-XX-XXXX`
- Bank accounts: `****1234`
- Tax IDs: `XX-XXXXXXX`
- Custom PII fields configurable

### 4. VITA Certification Validation
**Location:** `server/services/vitaCertificationValidation.service.ts`

- ✅ Three-tier certification validation (Basic, Advanced, Military)
- ✅ Tax return complexity analysis
- ✅ Automatic certification requirement determination
- ✅ Expiration date enforcement

**Middleware:** `requireVitaCertification()` in `server/routes.ts`

**Certification Levels:**
- **Basic:** Simple tax returns (W-2, standard deduction)
- **Advanced:** Itemized deductions, business income, capital gains
- **Military:** Military-specific credits and combat pay

### 5. Environment Validation
**Location:** `server/utils/envValidation.ts`

- ✅ Validates required environment variables on startup
- ✅ Fails fast with clear error messages
- ✅ Production-specific validation rules
- ✅ Default values for development

**Validated Variables:**
- DATABASE_URL (required)
- SESSION_SECRET (required, 32+ chars)
- GEMINI_API_KEY or GOOGLE_API_KEY (required)
- ENCRYPTION_KEY (required in production)

### 6. Security Headers (Helmet.js)
**Location:** `server/index.ts`

- ✅ Content Security Policy (CSP)
- ✅ HTTP Strict Transport Security (HSTS)
- ✅ X-Content-Type-Options: nosniff
- ✅ X-Frame-Options: DENY
- ✅ Cross-Origin policies

**CSP Configuration:**
- Development: Allows unsafe-inline/eval for Vite HMR
- Production: Strict CSP with no unsafe directives

### 7. Rate Limiting (Tiered)
**Location:** `server/index.ts`

- ✅ **Authentication endpoints:** 5 requests per 15 minutes
- ✅ **General API:** 100 requests per 15 minutes
- ✅ **AI services:** 20 requests per minute
- ✅ Skip successful login attempts

### 8. Request Size Limits & File Upload Security
**Location:** `server/index.ts`, `server/middleware/fileUploadSecurity.ts`

- ✅ JSON payload: 10MB max
- ✅ URL-encoded payload: 10MB max
- ✅ **File Upload Security (NEW):**
  - MIME type validation against whitelist
  - File extension validation
  - Magic number/file signature verification (prevents file spoofing)
  - Filename sanitization (prevents directory traversal)
  - Virus scanning hooks (ready for ClamAV integration)
  - Type-specific size limits: Documents (50MB), Tax Docs (25MB), Images (10MB)
  - SHA-256 file hash generation for integrity verification

### 9. Password Security & Strength Enforcement
**Location:** `server/services/passwordSecurity.service.ts`

- ✅ **Strong password requirements enforced:**
  - Minimum 12 characters (NIST SP 800-63B compliant)
  - Uppercase, lowercase, number, and special character required
  - No common passwords (dictionary check)
  - No sequential or repeated characters (123, abc, aaa)
- ✅ **Bcrypt cost factor: 12 rounds** (~250ms hashing time, 2025 standard)
  - Automatic rehashing when cost factor is updated
  - Password hash format verification
- ✅ **Password strength scoring (0-100)**
  - weak < 40, fair < 60, good < 80, strong ≥ 80
- ✅ **API endpoints:**
  - `GET /api/auth/password-requirements` - Get requirements
  - `POST /api/auth/change-password` - Change password (requires auth)
- ✅ **Audit logging:** Password changes logged with strength score

### 10. Session Security
**Location:** `server/index.ts`

- ✅ **Secure session configuration:**
  - PostgreSQL session storage (connect-pg-simple)
  - SESSION_SECRET required (enforced at startup)
  - httpOnly: true (prevents XSS cookie theft)
  - secure: true in production (HTTPS-only)
  - sameSite: 'strict' in production, 'lax' in development (CSRF protection)
  - Custom cookie name: "sessionId" (don't reveal tech stack)
- ✅ **Rolling sessions:** Session timeout extends on activity
- ✅ **Session lifetime:** 30 days with automatic cleanup
- ✅ **Session regeneration:** Login/logout properly handled via Passport.js

### 11. Authorization & Ownership Controls
**Location:** `server/middleware/ownership.ts`

- ✅ **Ownership verification middleware:**
  - `verifyHouseholdProfileOwnership` - Ensures users access only their household profiles
  - `verifyVitaSessionOwnership` - Protects VITA intake session access
  - `verifyTaxDocumentOwnership` - Secures tax document access
  - `verifyNotificationOwnership` - Personal notification protection
  - `verifyOwnership` - Generic ownership verification factory
- ✅ **Role-based access control:**
  - `allowAdmin = true` by default (admins can access all resources for auditing)
  - **`allowStaff = false` by default** (prevents horizontal privilege escalation)
  - Staff must explicitly opt-in for supervisor/review workflows
  - Field-level user ID verification
  - Custom error messages per resource type
- ✅ **Security features:**
  - **Prevents horizontal privilege escalation** (staff cannot access each other's data)
  - Resource existence validation
  - Authentication state verification
  - Applied to: household profiles (GET/PATCH/DELETE), VITA sessions (GET/PATCH/DELETE)
- 🚧 **Remaining work:** Apply to notifications, tax documents, and bulk listing endpoints

### 12. Health Check & Monitoring
**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-13T22:55:46.408Z",
  "uptime": 123.13,
  "database": "connected",
  "environment": "development"
}
```

### 10. Graceful Shutdown
**Location:** `server/index.ts`

- ✅ Handles SIGTERM and SIGINT signals
- ✅ Closes HTTP server gracefully
- ✅ Stops background services (Smart Scheduler)
- ✅ Handles uncaught exceptions and unhandled rejections

### 11. Security Events Monitoring
**Location:** `server/services/auditLog.service.ts`

- ✅ Tracks security events (failed logins, suspicious activity)
- ✅ Severity levels (low, medium, high, critical)
- ✅ Resolution tracking
- ✅ Real-time alerting capability

---

## 📋 Production Deployment Checklist

### Pre-Deployment

- [ ] **Environment Variables Set**
  - [ ] `DATABASE_URL` - PostgreSQL connection string
  - [ ] `SESSION_SECRET` - 32+ character random string
  - [ ] `ENCRYPTION_KEY` - 64-character hex string (32 bytes)
  - [ ] `GEMINI_API_KEY` or `GOOGLE_API_KEY`
  - [ ] `NODE_ENV=production`
  - [ ] `GCS_BUCKET_NAME` - Object storage bucket
  - [ ] `GOOGLE_APPLICATION_CREDENTIALS` - Service account JSON

- [ ] **Database Migration**
  - [ ] Run `npm run db:push` to apply schema changes
  - [ ] Verify VITA certification columns added to users table
  - [ ] Verify audit_logs table created with correct schema
  - [ ] Verify security_events table created

- [ ] **Security Configuration**
  - [ ] Change SESSION_SECRET from development default
  - [ ] Generate production ENCRYPTION_KEY
  - [ ] Configure SMTP for email notifications (optional)
  - [ ] Set up SSL/TLS certificates

- [ ] **Code Review**
  - [ ] No hardcoded secrets or API keys
  - [ ] All PII fields encrypted in database
  - [ ] Audit logging enabled for sensitive operations
  - [ ] VITA certification middleware applied to tax review routes

### Deployment

- [ ] **Build Application**
  ```bash
  npm run build
  NODE_ENV=production npm start
  ```

- [ ] **Database Backup**
  - [ ] Create backup before deployment
  - [ ] Test restore procedure
  - [ ] Set up automated daily backups

- [ ] **Smoke Tests**
  - [ ] Health check endpoint returns 200 OK
  - [ ] User authentication works
  - [ ] Database connectivity confirmed
  - [ ] AI services responding
  - [ ] Object storage accessible

### Post-Deployment

- [ ] **Monitoring Setup**
  - [ ] Configure application monitoring (e.g., Sentry, DataDog)
  - [ ] Set up log aggregation (e.g., CloudWatch, Splunk)
  - [ ] Configure uptime monitoring
  - [ ] Set up alerting for critical errors

- [ ] **Security Verification**
  - [ ] Verify HTTPS enforced (HSTS headers)
  - [ ] Test rate limiting on auth endpoints
  - [ ] Verify PII masking in logs
  - [ ] Test VITA certification enforcement
  - [ ] Verify audit logs created for sensitive operations

- [ ] **Performance Tuning**
  - [ ] Monitor database query performance
  - [ ] Optimize slow queries (>1000ms)
  - [ ] Configure connection pooling
  - [ ] Set up caching strategy

- [ ] **Compliance**
  - [ ] Review audit log retention policy
  - [ ] Configure log rotation
  - [ ] Document data retention policies
  - [ ] Set up compliance reporting

---

## 🛡️ Security Best Practices

### 1. Encryption Key Management
- **NEVER commit encryption keys to version control**
- Rotate encryption keys annually
- Store keys in secure key management service (e.g., AWS KMS, Google Secret Manager)
- Use separate keys for development, staging, and production

### 2. Session Management
- Session cookies are httpOnly and secure in production
- 30-day session expiration
- SameSite=lax for CSRF protection
- Sessions stored in PostgreSQL (not memory)

### 3. CSRF Protection
- Double-submit cookie pattern using csrf-csrf
- CSRF tokens required for all state-changing requests
- Token endpoint: `GET /api/csrf-token`

### 4. Authentication & Authorization
- Bcrypt password hashing (10 rounds)
- Passport.js local strategy
- Role-based access control (Admin, Staff, Navigator, Client)
- Session-based authentication with secure cookies

### 5. Data Privacy
- PII fields encrypted at rest
- Automatic PII masking in logs
- Audit trail for all PII access
- GDPR/CCPA compliance ready

### 6. API Security
- Input validation with Zod schemas
- SQL injection prevention (Drizzle ORM parameterized queries)
- XSS prevention (React auto-escaping + CSP)
- Request size limits to prevent DoS

### 7. Error Handling
- Generic error messages to clients
- Detailed errors logged server-side only
- Stack traces never exposed in production
- Centralized error handling middleware

---

## 🔍 Monitoring & Alerting

### Critical Alerts
Set up alerts for:
- Failed login attempts > 10 per hour
- Database connection failures
- API errors > 5% error rate
- Health check failures
- Slow requests > 5 seconds
- Memory usage > 80%

### Audit Log Monitoring
Review audit logs regularly for:
- PII field access patterns
- Bulk data exports
- Failed authorization attempts
- Unusual access patterns
- Weekend/after-hours access

### Performance Monitoring
Track:
- API response times (p50, p95, p99)
- Database query performance
- AI service latency
- Cache hit rates
- Request throughput

---

## 📞 Incident Response

### Security Incident Checklist
1. **Detect & Contain**
   - Review security_events table for details
   - Identify affected users/data
   - Revoke compromised sessions
   - Block suspicious IPs

2. **Investigate**
   - Review audit logs for timeline
   - Check PII field access logs
   - Analyze change history
   - Document findings

3. **Remediate**
   - Apply security patches
   - Rotate compromised credentials
   - Update firewall rules
   - Notify affected users

4. **Post-Mortem**
   - Document incident timeline
   - Identify root cause
   - Update security procedures
   - Implement preventive measures

---

## 📚 Additional Resources

### Documentation
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Helmet.js Security](https://helmetjs.github.io/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [IRS Pub 4012 - VITA Guidelines](https://www.irs.gov/pub/irs-pdf/p4012.pdf)

### Tools
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - Scan for vulnerabilities
- [Snyk](https://snyk.io/) - Security vulnerability scanning
- [OWASP ZAP](https://www.zaproxy.org/) - Penetration testing
- [SSL Labs](https://www.ssllabs.com/ssltest/) - SSL/TLS configuration test

### Support Contacts
- Security Team: security@example.gov
- DevOps Team: devops@example.gov
- Database Admin: dba@example.gov
- On-Call: oncall@example.gov

---

## ✅ Quick Verification Script

Run this script to verify production readiness:

```bash
#!/bin/bash
# production-check.sh

echo "🔍 Production Security Verification"
echo "===================================="

# Check environment variables
echo "📝 Checking environment variables..."
required_vars=("DATABASE_URL" "SESSION_SECRET" "ENCRYPTION_KEY" "NODE_ENV")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ $var not set"
    exit 1
  else
    echo "✅ $var configured"
  fi
done

# Check encryption key length
if [ ${#ENCRYPTION_KEY} -ne 64 ]; then
  echo "❌ ENCRYPTION_KEY must be 64 characters (32 bytes hex)"
  exit 1
fi

# Test health endpoint
echo "🏥 Testing health endpoint..."
health_response=$(curl -s http://localhost:5000/api/health)
if echo "$health_response" | grep -q "healthy"; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed"
  exit 1
fi

# Test database connection
echo "🗄️  Testing database connection..."
if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
  echo "✅ Database connected"
else
  echo "❌ Database connection failed"
  exit 1
fi

# Check VITA certification columns
echo "📋 Checking VITA certification schema..."
vita_columns=$(psql "$DATABASE_URL" -c "\d users" | grep -c "vita_certification")
if [ "$vita_columns" -ge 4 ]; then
  echo "✅ VITA certification columns exist"
else
  echo "❌ VITA certification columns missing"
  exit 1
fi

# Check audit logs table
echo "📊 Checking audit logs table..."
if psql "$DATABASE_URL" -c "\d audit_logs" > /dev/null 2>&1; then
  echo "✅ Audit logs table exists"
else
  echo "❌ Audit logs table missing"
  exit 1
fi

echo ""
echo "✅ All production checks passed!"
echo "Ready for deployment 🚀"
```

---

**Last Updated:** October 13, 2025  
**Maintained By:** Development Team  
**Review Schedule:** Quarterly security audit
