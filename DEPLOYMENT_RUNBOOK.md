# JAWN Production Deployment Runbook
## Maryland LDSS Launch Guide

**Version:** 1.0  
**Last Updated:** October 27, 2025  
**Target Environment:** Maryland Local Department of Social Services (LDSS)

---

## Pre-Deployment Checklist

### 1. Infrastructure Requirements

- [ ] **Production Database**: Neon PostgreSQL with pooled connections configured
- [ ] **Environment Secrets**: All required API keys and credentials configured
  - `DATABASE_URL` - Neon production database connection string
  - `GEMINI_API_KEY` - Google Gemini API key for AI features
  - `GCS_PROJECT_ID`, `GCS_BUCKET_NAME`, `GCS_CREDENTIALS` - Google Cloud Storage
  - `SESSION_SECRET` - Cryptographically secure session key (32+ characters)
  - `ENCRYPTION_KEY` - Master encryption key for 3-tier KMS
  - `POLICYENGINE_CLIENT_ID`, `POLICYENGINE_CLIENT_SECRET` - Optional verification
- [ ] **Node.js**: Version 18+ installed
- [ ] **PM2**: Installed globally for process management
- [ ] **Domain/SSL**: Production domain configured with TLS certificate

### 2. Database Setup

```bash
# Step 1: Set production DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# Step 2: Push schema to production database
npm run db:push --force

# Step 3: Verify database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### 3. Environment Configuration

Create `.env.production` file:

```env
# Database
DATABASE_URL=<production_neon_url>

# AI Services
GEMINI_API_KEY=<production_gemini_key>

# Object Storage
GCS_PROJECT_ID=<production_project_id>
GCS_BUCKET_NAME=jawn-production-documents
GCS_CREDENTIALS=<service_account_json>

# Security
SESSION_SECRET=<generate_with_openssl_rand_base64_48>
ENCRYPTION_KEY=<tier_1_root_kek>

# Optional Third-Party Verification
POLICYENGINE_CLIENT_ID=<optional>
POLICYENGINE_CLIENT_SECRET=<optional>

# Email (if configured)
SMTP_HOST=<smtp_host>
SMTP_PORT=587
SMTP_USER=<smtp_user>
SMTP_PASS=<smtp_password>

# Application
NODE_ENV=production
PORT=5000
```

### 4. Security Hardening

- [ ] **Remove Demo Accounts**: Disable or delete demo login functionality
  ```typescript
  // In server/seedMarylandLDSS.ts - comment out demo account creation
  // Or set environment variable: DISABLE_DEMO_ACCOUNTS=true
  ```

- [ ] **Configure Rate Limiting**: Verify production rate limits in `server/middleware/securityHeaders.ts`
  - API endpoints: 100 requests/15min/IP
  - Login: 5 attempts/15min/IP

- [ ] **CORS Configuration**: Update allowed origins in `server/index.ts`
  ```typescript
  cors({
    origin: ['https://jawn.maryland.gov'], // Production domain only
    credentials: true
  })
  ```

- [ ] **Session Configuration**: Verify secure session settings
  - `secure: true` (HTTPS only)
  - `sameSite: 'strict'`
  - `maxAge: 12 hours`

---

## Deployment Steps

### Step 1: Build Application

```bash
# Install production dependencies
npm ci --production

# Build frontend assets
npm run build

# Verify build output exists
ls -lh dist/
```

### Step 2: Database Migration

```bash
# Run database push to sync schema
npm run db:push --force

# Seed Maryland LDSS office structure (if needed)
npx tsx server/seedMarylandLDSS.ts
```

### Step 3: Start Production Server

**Option A: PM2 Cluster Mode (Recommended)**

```bash
# Start with PM2 using ecosystem config
pm2 start ecosystem.config.js --env production

# Verify all instances running
pm2 status

# Save PM2 config for auto-restart on reboot
pm2 save
pm2 startup
```

**Option B: Direct Node Execution**

```bash
# Start server directly
NODE_ENV=production node server/index.js
```

### Step 4: Smoke Tests

Run critical path tests to verify deployment:

```bash
# Test 1: Health check endpoint
curl https://jawn.maryland.gov/api/health

# Test 2: Login endpoint
curl -X POST https://jawn.maryland.gov/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@md.gov","password":"<test_password>"}'

# Test 3: Benefit screener (public endpoint)
curl https://jawn.maryland.gov/api/screener/check \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"householdSize":3,"grossMonthlyIncome":200000,"state":"MD"}'
```

### Step 5: Verify Core Features

- [ ] **Login System**: Test admin, navigator, and caseworker accounts
- [ ] **Benefit Screener**: Calculate benefits for test household
- [ ] **Document Upload**: Upload test document to GCS
- [ ] **Audit Logging**: Verify audit logs are capturing actions
- [ ] **Maryland Rules Engines**: Run SNAP, Medicaid, TANF calculations

---

## Post-Deployment Monitoring

### Monitoring Checklist

- [ ] **Application Logs**: Monitor PM2 logs for errors
  ```bash
  pm2 logs jawn
  ```

- [ ] **Error Tracking**: Verify Sentry integration (if configured)
- [ ] **Database Connections**: Monitor connection pool utilization
- [ ] **API Response Times**: Track P95 latency (<500ms target)
- [ ] **Audit Chain Integrity**: Run integrity verification
  ```bash
  curl https://jawn.maryland.gov/api/audit-logs/verify-integrity
  ```

### Key Metrics to Track

1. **Authentication**
   - Login success rate
   - Failed login attempts
   - Session duration

2. **Benefit Calculations**
   - Maryland rules engine response time
   - Calculation accuracy (spot-check)
   - Error rate

3. **Document Processing**
   - Upload success rate
   - OCR extraction accuracy
   - GCS storage utilization

4. **System Health**
   - Server uptime
   - Database query performance
   - Memory/CPU usage

---

## Rollback Procedures

### Emergency Rollback

If critical issues are detected post-deployment:

```bash
# Step 1: Stop current deployment
pm2 stop jawn

# Step 2: Restore previous version
git checkout <previous_stable_tag>
npm ci
npm run build

# Step 3: Restart with previous version
pm2 restart jawn

# Step 4: Verify rollback success
curl https://jawn.maryland.gov/api/health
```

### Database Rollback

**IMPORTANT**: Database rollbacks are destructive. Only use if absolutely necessary.

```bash
# Option 1: Replit database rollback (recommended)
# Use Replit UI to rollback database to previous checkpoint

# Option 2: Manual database restore (if Replit unavailable)
# Restore from Neon database backup
neon db restore --backup-id <backup_id>
```

---

## Common Issues & Troubleshooting

### Issue 1: Database Connection Failures

**Symptoms**: "ECONNREFUSED" or "connection timeout" errors

**Solution**:
```bash
# Verify DATABASE_URL is correct
echo $DATABASE_URL

# Test direct connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Neon pooler status
# Ensure using pooled connection string (not direct)
```

### Issue 2: Gemini API Rate Limits

**Symptoms**: "429 Too Many Requests" errors in logs

**Solution**:
- Verify GEMINI_API_KEY has sufficient quota
- Enable request caching in `server/services/aiOrchestrator.ts`
- Implement exponential backoff (already configured)

### Issue 3: Audit Chain Integrity Warnings

**Symptoms**: "Chain integrity break detected" warnings

**Solution**:
- These are **monitoring alerts**, not critical errors
- Common causes: HMR during development, database migrations
- Production deployments start with clean audit chain
- Run verification endpoint to assess severity

### Issue 4: Session/Login Issues

**Symptoms**: Users logged out frequently, session errors

**Solution**:
```bash
# Verify SESSION_SECRET is set and persistent
echo $SESSION_SECRET

# Check session store configuration
# Ensure connect-pg-simple is using production database

# Verify cookie settings for HTTPS
# secure: true, sameSite: 'strict'
```

---

## Security Incident Response

### Suspected Data Breach

1. **Immediate Actions**:
   - Rotate all API keys and encryption keys
   - Force logout all active sessions
   - Enable enhanced audit logging

2. **Investigation**:
   - Review audit logs for unauthorized access
   - Check document access logs in GCS
   - Analyze failed login attempts

3. **Notification**:
   - Notify Maryland LDSS security team
   - Document incident timeline
   - Prepare user notifications (if PII exposed)

### Compliance Violations

1. **HIPAA Violations**: Contact privacy officer immediately
2. **IRS Pub 1075 Violations**: Secure Federal Tax Information (FTI), notify IRS
3. **GDPR Violations**: Initiate Right to Erasure via cryptographic shredding

---

## Maintenance Windows

### Scheduled Maintenance

**Recommended Schedule**: First Sunday of each month, 2:00 AM - 4:00 AM EST

**Maintenance Checklist**:
- [ ] Update dependencies (`npm update`)
- [ ] Rotate encryption keys (quarterly)
- [ ] Database vacuum and analyze
- [ ] Archive old audit logs (>7 years)
- [ ] Review and update Maryland benefit rules
- [ ] Test backup restoration

### Zero-Downtime Deployments

For updates without downtime:

```bash
# Start new version on different port
PORT=5001 pm2 start ecosystem.config.js --name jawn-v2

# Verify new version works
curl http://localhost:5001/api/health

# Reload PM2 to switch traffic
pm2 reload jawn

# Stop old version after traffic drains
pm2 delete jawn-v2
```

---

## Support Contacts

### Technical Support

- **Platform Issues**: Replit Support
- **Database Issues**: Neon Database Support
- **AI/Gemini Issues**: Google Cloud Support

### Maryland LDSS Contacts

- **System Administrator**: <admin_email>
- **Security Officer**: <security_email>
- **Project Manager**: <pm_email>

---

## Appendix: Environment Variables Reference

### Required Variables

| Variable | Purpose | Example | Notes |
|----------|---------|---------|-------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` | Use pooled connection for production |
| `GEMINI_API_KEY` | Google Gemini API | `AIza...` | Required for AI features |
| `SESSION_SECRET` | Session encryption | `<48-char random>` | Generate with `openssl rand -base64 48` |
| `ENCRYPTION_KEY` | Master KMS key | `<64-char hex>` | Tier 1 Root KEK for 3-tier KMS |

### Optional Variables

| Variable | Purpose | Default | Notes |
|----------|---------|---------|-------|
| `POLICYENGINE_CLIENT_ID` | PolicyEngine verification | - | Optional third-party validation |
| `POLICYENGINE_CLIENT_SECRET` | PolicyEngine auth | - | Optional third-party validation |
| `SENTRY_DSN` | Error tracking | - | Recommended for production |
| `SMTP_HOST` | Email notifications | - | Required for email features |

---

## Success Criteria

Deployment is considered successful when:

✅ All smoke tests pass  
✅ Demo accounts disabled (or clearly marked)  
✅ Maryland rules engines calculating correctly  
✅ Audit logging operational with integrity verification  
✅ Document uploads working to GCS  
✅ API P95 latency < 500ms  
✅ No critical errors in logs for 1 hour  
✅ Authentication working for all user roles  
✅ Database connection pool stable  
✅ Monitoring dashboards active  

---

**Document Version**: 1.0  
**Last Reviewed**: October 27, 2025  
**Next Review**: Before production deployment
