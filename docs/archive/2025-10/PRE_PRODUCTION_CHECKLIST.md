# Pre-Production Deployment Checklist
**JAWN Maryland Benefits Navigator**  
**Version:** 1.0  
**Last Updated:** October 22, 2025

---

## 🎯 Overview

This checklist ensures all critical systems are configured, tested, and ready for production deployment. Complete each section before going live.

**Deployment Target:** marylandbenefits.gov  
**Architecture:** Single unified instance serving all 24 Maryland LDSS offices

---

## ✅ Phase 1: Critical Security Configuration

### 1.1 Encryption Keys (REQUIRED)
- [ ] **Generate ENCRYPTION_KEY**
  ```bash
  openssl rand -hex 32
  ```
  **Add to Secrets:** `ENCRYPTION_KEY=<generated-key>`
  
  **Verification:**
  ```bash
  # Should return 64 characters (256-bit hex)
  echo $ENCRYPTION_KEY | wc -c
  ```

- [ ] **Generate SESSION_SECRET**
  ```bash
  openssl rand -base64 64
  ```
  **Add to Secrets:** `SESSION_SECRET=<generated-secret>`

- [ ] **Verify Keys Set**
  ```bash
  curl https://your-domain.com/api/health | jq '.encryption'
  # Expected: "healthy" or "configured"
  ```

### 1.2 CORS & Domain Security (REQUIRED)
- [ ] **Set Production Domain**
  ```bash
  ALLOWED_ORIGINS=https://marylandbenefits.gov
  ```
  **⚠️ WARNING:** Use EXACT production domain. No wildcards. No localhost.

- [ ] **Set Cookie Domain (Recommended)**
  ```bash
  COOKIE_DOMAIN=.marylandbenefits.gov
  ```

- [ ] **Verify CORS Configuration**
  ```bash
  curl -H "Origin: https://marylandbenefits.gov" \
       -H "Access-Control-Request-Method: POST" \
       -X OPTIONS https://your-domain.com/api/auth/login -v
  # Should return: Access-Control-Allow-Origin: https://marylandbenefits.gov
  ```

### 1.3 Environment Mode
- [ ] **Set NODE_ENV to production**
  ```bash
  NODE_ENV=production
  ```

---

## ✅ Phase 2: AI & External Services (REQUIRED)

### 2.1 Google Gemini API
- [ ] **Obtain API Key**
  - Visit: https://aistudio.google.com/app/apikey
  - Create new API key
  - Copy key

- [ ] **Set API Key**
  ```bash
  GEMINI_API_KEY=<your-gemini-api-key>
  ```

- [ ] **Verify Gemini Connectivity**
  ```bash
  curl https://your-domain.com/api/health | jq '.services.gemini'
  # Expected: "healthy"
  ```

- [ ] **Test AI Features**
  - Log in as demo account
  - Navigate to `/chat`
  - Ask: "What SNAP benefits am I eligible for?"
  - Confirm response within 5 seconds

### 2.2 PolicyEngine Integration (OPTIONAL - Demo Credentials Active)
- [ ] **Verify PolicyEngine Status**
  ```bash
  curl https://your-domain.com/api/health | jq '.services.policyengine'
  # Expected: "healthy" or "degraded" (both acceptable)
  ```

- [ ] **Optional: Set Custom Credentials**
  ```bash
  POLICYENGINE_CLIENT_ID=<your-client-id>
  POLICYENGINE_CLIENT_SECRET=<your-client-secret>
  ```

---

## ✅ Phase 3: Object Storage (REQUIRED - Choose One)

### Option A: Replit Object Storage (RECOMMENDED)
- [ ] **Enable in Replit Dashboard**
  1. Go to Replit workspace settings
  2. Click "Object Storage"
  3. Click "Enable"
  4. Wait for provisioning (usually 1-2 minutes)

- [ ] **Verify Auto-Configuration**
  ```bash
  curl https://your-domain.com/api/health | jq '.services.objectStorage'
  # Expected: "healthy"
  ```

### Option B: Google Cloud Storage (ADVANCED)
- [ ] **Create GCS Bucket**
  ```bash
  gsutil mb -l us-east1 gs://jawn-prod-documents
  ```

- [ ] **Create Service Account**
  1. Go to GCP Console → IAM & Admin → Service Accounts
  2. Create service account: `jawn-object-storage`
  3. Grant role: `Storage Object Admin`
  4. Create JSON key

- [ ] **Encode Credentials**
  ```bash
  cat service-account.json | base64 -w 0
  ```

- [ ] **Set Environment Variables**
  ```bash
  GCS_BUCKET_NAME=jawn-prod-documents
  GCS_SERVICE_ACCOUNT_BASE64=<base64-encoded-json>
  ```

- [ ] **Verify GCS Access**
  ```bash
  curl https://your-domain.com/api/health | jq '.services.objectStorage'
  # Expected: "healthy"
  ```

### Storage Testing
- [ ] **Upload Test Document**
  1. Log in as navigator
  2. Go to `/documents`
  3. Upload a PDF file
  4. Verify upload success

- [ ] **Verify Document Retrieval**
  1. Click on uploaded document
  2. Verify preview loads
  3. Click download
  4. Verify file downloads correctly

---

## ✅ Phase 4: Database & Caching

### 4.1 PostgreSQL Database (AUTO-CONFIGURED)
- [ ] **Verify Database Connection**
  ```bash
  curl https://your-domain.com/api/health | jq '.services.database'
  # Expected: "healthy"
  ```

- [ ] **Check Database Schema**
  ```bash
  # Via Replit Database Console
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  ORDER BY table_name;
  # Should show: users, client_cases, benefits_access_reviews, etc.
  ```

### 4.2 Redis Distributed Cache (RECOMMENDED)

#### Option A: Upstash Redis (Recommended)
- [ ] **Create Upstash Database**
  1. Visit: https://console.upstash.com
  2. Create new database
  3. Copy REST URL and token

- [ ] **Set Environment Variables**
  ```bash
  UPSTASH_REDIS_REST_URL=<your-rest-url>
  UPSTASH_REDIS_REST_TOKEN=<your-rest-token>
  ```

#### Option B: Standard Redis
- [ ] **Set Redis URL**
  ```bash
  REDIS_URL=redis://<host>:6379
  ```

#### Cache Verification
- [ ] **Check Cache Status**
  ```bash
  curl https://your-domain.com/api/health | jq '.services.redis'
  # Expected: "healthy" (with Redis) or "degraded" (L1 only - acceptable)
  ```

- [ ] **Test Cache Performance**
  1. Navigate to `/eligibility-check`
  2. Enter sample household data
  3. Note response time (first request)
  4. Submit identical request again
  5. Verify second request is faster (cache hit)

---

## ✅ Phase 5: Email & Notifications (RECOMMENDED)

### 5.1 SMTP Configuration
- [ ] **Configure SMTP Settings**
  ```bash
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=<your-email@gmail.com>
  SMTP_PASS=<app-specific-password>
  SMTP_FROM_EMAIL=noreply@marylandbenefits.gov
  ```

- [ ] **Generate Gmail App Password (if using Gmail)**
  1. Go to Google Account settings
  2. Security → 2-Step Verification → App passwords
  3. Create new app password for "Mail"
  4. Use generated password as SMTP_PASS

### 5.2 Email Testing
- [ ] **Test Email Sending**
  ```bash
  # Test via application
  # 1. Create demo account with your personal email
  # 2. Trigger password reset
  # 3. Verify email arrives within 1 minute
  ```

- [ ] **Verify Email Templates**
  - [ ] Password reset email renders correctly
  - [ ] BAR checkpoint reminder renders correctly
  - [ ] Document upload notification renders correctly

**Note:** If SMTP not configured, emails will be logged to console only (non-blocking).

---

## ✅ Phase 6: Error Tracking & Monitoring (RECOMMENDED)

### 6.1 Sentry Integration
- [ ] **Create Sentry Project**
  1. Visit: https://sentry.io
  2. Create new project (Node.js/Express)
  3. Copy DSN

- [ ] **Set Sentry DSN**
  ```bash
  SENTRY_DSN=<your-sentry-dsn>
  ```

- [ ] **Verify Sentry Connection**
  ```bash
  curl https://your-domain.com/api/health | jq '.services.sentry'
  # Expected: "healthy" or "configured"
  ```

- [ ] **Test Error Reporting**
  1. Trigger test error in application
  2. Check Sentry dashboard
  3. Verify error appears within 30 seconds

---

## ✅ Phase 7: Authentication & Authorization

### 7.1 Login Flow
- [ ] **Test User Registration**
  1. Navigate to `/signup`
  2. Create test account
  3. Verify email validation works
  4. Verify password strength requirements (8+ chars, uppercase, number, special)

- [ ] **Test Login**
  1. Navigate to `/login`
  2. Enter credentials
  3. Verify successful redirect to dashboard
  4. Check browser cookies (should see session cookie with `httpOnly`, `secure`, `sameSite=strict`)

- [ ] **Test Logout**
  1. Click logout
  2. Verify redirect to login page
  3. Attempt to access `/dashboard` directly
  4. Verify redirect back to login

### 7.2 CSRF Protection
- [ ] **Verify CSRF Token**
  ```bash
  # Check cookie
  curl -c cookies.txt https://your-domain.com/login
  cat cookies.txt | grep csrf-token
  # Should show csrf-token cookie with sameSite=strict
  ```

### 7.3 Role-Based Access Control
- [ ] **Test Navigator Role**
  1. Log in as navigator
  2. Verify access to `/navigator` workspace
  3. Verify cannot access `/admin` dashboard

- [ ] **Test Admin Role**
  1. Log in as admin
  2. Verify access to `/admin` dashboard
  3. Verify can access all navigator features

- [ ] **Test Supervisor Role**
  1. Log in as supervisor
  2. Verify access to BAR review dashboard
  3. Verify can view cases but not edit

---

## ✅ Phase 8: Core Feature Testing

### 8.1 Document Upload & Verification
- [ ] **Upload Image Document**
  1. Navigate to `/verify`
  2. Upload PNG/JPEG image of income document
  3. Click "Verify Document"
  4. Wait for Gemini Vision analysis (10-40 seconds)
  5. Verify results display with:
     - Document type identified
     - Requirements check (met/not met)
     - Confidence score
     - Official citations

- [ ] **Test Error Handling**
  1. Upload very small/low-quality image
  2. Verify graceful 400 error message
  3. Verify user-friendly guidance displayed

### 8.2 Benefits Eligibility Check
- [ ] **SNAP Eligibility**
  1. Navigate to `/eligibility-check`
  2. Select "SNAP"
  3. Enter household data:
     - Household size: 3
     - Monthly income: $2,000
     - State: Maryland
  4. Click "Calculate"
  5. Verify eligibility result displays
  6. Verify monthly benefit amount shown

- [ ] **Multi-Program Check**
  1. Select "All Programs"
  2. Enter same household data
  3. Verify results for all 6 programs:
     - SNAP
     - Medicaid
     - TANF
     - OHEP
     - Tax Credits
     - SSI

### 8.3 AI Chat Assistant
- [ ] **Test Conversational Intake**
  1. Navigate to `/chat`
  2. Ask: "I need help applying for food stamps"
  3. Verify AI responds within 5 seconds
  4. Verify response is helpful and context-aware

- [ ] **Test Policy Search**
  1. Ask: "What are the income limits for SNAP in Maryland?"
  2. Verify AI cites specific regulations
  3. Verify citations include section numbers

### 8.4 Tax Preparation
- [ ] **Upload Tax Documents**
  1. Navigate to `/tax/upload`
  2. Upload W-2 form (PDF or image)
  3. Verify Gemini Vision extraction
  4. Verify extracted fields populate form

- [ ] **Generate Tax Forms**
  1. Complete tax return data
  2. Click "Generate Form 1040"
  3. Verify PDF generates successfully
  4. Click "Generate Maryland Form 502"
  5. Verify PDF generates successfully

### 8.5 BAR (Benefits Access Review)
- [ ] **Verify Checkpoint Monitoring**
  ```bash
  # Check scheduler is running
  curl https://your-domain.com/api/health | jq '.services.scheduler'
  # Expected: "healthy"
  ```

- [ ] **Test Orphaned Checkpoint Cleanup**
  1. Review logs for BAR checkpoint check
  2. Verify orphaned checkpoints auto-cancelled
  3. Verify no errors in logs

---

## ✅ Phase 9: Performance & Load Testing

### 9.1 Response Time Benchmarks
- [ ] **Health Check Endpoint**
  ```bash
  time curl https://your-domain.com/api/health
  # Expected: < 500ms
  ```

- [ ] **API Response Times**
  ```bash
  # Login
  time curl -X POST https://your-domain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"demo","password":"demo"}'
  # Expected: < 1s
  
  # Eligibility Check
  # Expected: < 2s (first request)
  # Expected: < 500ms (cached request)
  ```

### 9.2 Concurrent User Load
- [ ] **Simulate 10 Concurrent Users**
  ```bash
  # Using Apache Bench (ab) or similar tool
  ab -n 100 -c 10 https://your-domain.com/api/health
  # Verify: 0% failed requests
  # Verify: Average response < 1s
  ```

### 9.3 Database Performance
- [ ] **Query Execution Times**
  ```sql
  -- Check slow queries (> 1s)
  SELECT query, mean_exec_time 
  FROM pg_stat_statements 
  WHERE mean_exec_time > 1000 
  ORDER BY mean_exec_time DESC;
  -- Expected: 0 rows (no slow queries)
  ```

---

## ✅ Phase 10: Security Hardening Verification

### 10.1 Security Headers
- [ ] **Verify Security Headers**
  ```bash
  curl -I https://your-domain.com | grep -E "(Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options|Referrer-Policy)"
  ```
  **Expected Headers:**
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### 10.2 Rate Limiting
- [ ] **Test Login Rate Limit**
  ```bash
  # Attempt 10 failed logins rapidly
  for i in {1..10}; do
    curl -X POST https://your-domain.com/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username":"wrong","password":"wrong"}'
  done
  # Expected: HTTP 429 (Too Many Requests) after 5 attempts
  ```

- [ ] **Test API Rate Limit**
  ```bash
  # Test general API rate limit
  for i in {1..100}; do
    curl https://your-domain.com/api/health
  done
  # Expected: No 429 errors for health check (higher limit)
  ```

### 10.3 File Upload Security
- [ ] **Test File Size Limit**
  1. Attempt to upload 30MB file
  2. Verify rejection with clear error message
  3. Max size: 25MB

- [ ] **Test File Type Validation**
  1. Attempt to upload .exe file
  2. Verify rejection
  3. Allowed: PDF, PNG, JPEG, TIFF only

### 10.4 SQL Injection Protection
- [ ] **Test SQL Injection**
  ```bash
  curl -X POST https://your-domain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin'\'' OR 1=1--","password":"anything"}'
  # Expected: Login fails (not SQL error)
  ```

### 10.5 XSS Protection
- [ ] **Test XSS Attack**
  ```bash
  # Test script injection in form fields
  curl -X POST https://your-domain.com/api/chat/ask \
    -H "Content-Type: application/json" \
    -d '{"message":"<script>alert(1)</script>"}'
  # Expected: Input sanitized (no script execution)
  ```

---

## ✅ Phase 11: Compliance Verification

### 11.1 PII Encryption
- [ ] **Verify Field-Level Encryption**
  ```sql
  -- Check encrypted fields in database
  SELECT ssn FROM users LIMIT 1;
  -- Expected: Encrypted string (not plaintext SSN)
  ```

- [ ] **Test Encryption/Decryption**
  1. Create user with SSN
  2. Verify SSN stored encrypted
  3. Retrieve user profile
  4. Verify SSN displayed correctly (masked: XXX-XX-1234)

### 11.2 Audit Logging
- [ ] **Verify Audit Trail**
  ```sql
  -- Check audit logs exist
  SELECT COUNT(*) FROM audit_logs 
  WHERE created_at > NOW() - INTERVAL '1 hour';
  -- Expected: > 0 (recent activity logged)
  ```

- [ ] **Test PII Masking in Logs**
  1. Trigger action with SSN
  2. Check application logs
  3. Verify SSN is masked (XXX-XX-XXXX)

### 11.3 GDPR/HIPAA Compliance
- [ ] **Data Export Feature**
  1. Log in as user
  2. Navigate to `/settings/privacy`
  3. Request data export
  4. Verify export includes all user data

- [ ] **Data Deletion Feature**
  1. Navigate to `/settings/privacy`
  2. Request account deletion
  3. Verify confirmation required
  4. Verify data marked for deletion

---

## ✅ Phase 12: Deployment Validation

### 12.1 Environment Variables Check
- [ ] **Run Environment Validation**
  ```bash
  # Application runs this automatically on startup
  # Check logs for validation results
  curl https://your-domain.com/api/health
  # If any critical variables missing, startup will fail
  ```

- [ ] **Verify Production Mode**
  ```bash
  curl https://your-domain.com/api/health | jq '.environment'
  # Expected: "production"
  ```

### 12.2 Health Check Dashboard
- [ ] **Access Health Check**
  ```bash
  curl https://your-domain.com/api/health | jq '.'
  ```
  **Expected Response:**
  ```json
  {
    "status": "healthy",
    "environment": "production",
    "timestamp": "2025-10-22T...",
    "services": {
      "database": "healthy",
      "redis": "healthy" or "degraded",
      "gemini": "healthy",
      "objectStorage": "healthy",
      "policyengine": "healthy" or "degraded"
    },
    "encryption": "configured",
    "version": "1.0.0"
  }
  ```

### 12.3 Rollback Plan
- [ ] **Document Current State**
  - Git commit hash: `________________`
  - Database backup timestamp: `________________`
  - Current environment variables: `[Documented in secure location]`

- [ ] **Verify Replit Checkpoint**
  1. Go to Replit History
  2. Verify recent checkpoint exists
  3. Test rollback to checkpoint (optional)

### 12.4 Monitoring Setup
- [ ] **Configure Uptime Monitoring**
  - Service: `________________` (UptimeRobot, Pingdom, etc.)
  - Health check URL: `https://marylandbenefits.gov/api/health`
  - Check interval: `5 minutes`
  - Alert channels: `________________`

- [ ] **Configure Error Alerts**
  - Sentry notifications enabled
  - Alert threshold: `10 errors/hour`
  - Notification channels: `________________`

---

## ✅ Phase 13: Final Pre-Launch Checklist

### 13.1 Documentation
- [ ] All environment variables documented
- [ ] Admin credentials stored securely
- [ ] Rollback procedures documented
- [ ] Support contact information updated

### 13.2 Team Readiness
- [ ] Staff trained on platform usage
- [ ] Admin accounts created for all 24 LDSS offices
- [ ] Support ticketing system ready
- [ ] On-call rotation established

### 13.3 Communication
- [ ] Stakeholders notified of launch date
- [ ] User documentation published
- [ ] Help desk prepared for user inquiries

### 13.4 Final Verification
- [ ] All checklist items above completed
- [ ] No critical errors in last 24 hours
- [ ] Performance benchmarks met
- [ ] Security scan passed

---

## 🚀 Launch Authorization

**Pre-Production Sign-Off:**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | | | |
| Security Officer | | | |
| Product Owner | | | |
| DevOps Lead | | | |

**Launch Decision:**
- [ ] ✅ APPROVED - Ready for production deployment
- [ ] ⏸️ CONDITIONAL - Requires minor fixes (list below)
- [ ] ❌ HOLD - Critical issues require resolution

**Notes:**
```
[Space for notes on conditional approval or issues requiring attention]
```

---

## 📞 Support & Escalation

**Production Issues:**
- Health Check: https://marylandbenefits.gov/api/health
- Error Logs: Sentry Dashboard
- Database Issues: Replit Database Console
- Performance: Metrics Dashboard

**Emergency Contacts:**
- Technical Lead: `________________`
- DevOps On-Call: `________________`
- Replit Support: support@replit.com

---

**Document Version:** 1.0  
**Last Review:** October 22, 2025  
**Next Review:** Post-deployment (within 48 hours)
