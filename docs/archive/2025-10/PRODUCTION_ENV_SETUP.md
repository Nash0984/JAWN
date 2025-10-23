# Production Environment Configuration Guide
# Maryland Benefits Navigator (JAWN)

> **Critical**: This guide covers all required and optional environment variables for production deployment. Never commit secrets to version control.

---

## Table of Contents

1. [Quick Setup Checklist](#quick-setup-checklist)
2. [Required Variables](#required-variables)
3. [Optional Variables](#optional-variables)
4. [Service-Specific Setup](#service-specific-setup)
5. [Security Best Practices](#security-best-practices)
6. [Validation & Testing](#validation--testing)

---

## Quick Setup Checklist

**Production-Ready (5 Critical Variables):**

```bash
# 1. ENCRYPTION_KEY (Generate: openssl rand -hex 32)
ENCRYPTION_KEY=<64-character-hex-string>

# 2. SESSION_SECRET (Generate: openssl rand -base64 64)
SESSION_SECRET=<64+-character-string>

# 3. ALLOWED_ORIGINS (Your production domain)
ALLOWED_ORIGINS=https://marylandbenefits.gov

# 4. GEMINI_API_KEY (Google AI Studio)
GEMINI_API_KEY=<your-api-key>

# 5. OBJECT STORAGE (Choose one):
# Option A (Recommended): Enable Replit Object Storage (auto-configured, zero setup)
# Option B (Advanced): GCS with base64-encoded credentials
GCS_BUCKET_NAME=jawn-production-documents
GCS_SERVICE_ACCOUNT_BASE64=<base64-encoded-service-account-json>
# Note: GOOGLE_APPLICATION_CREDENTIALS is set automatically at runtime
```

**Recommended for Production (Optional Variables):**
- Redis/Upstash (distributed caching)
- SMTP (email notifications)
- Sentry (error monitoring)

---

## Required Variables

### 1. Database (Auto-configured on Replit)

```bash
# PostgreSQL connection string (auto-configured on Replit)
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

**Note**: Replit automatically provides `DATABASE_URL` when you create a database. No manual setup needed.

---

### 2. Encryption (CRITICAL - PII Protection)

```bash
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=<64-character-hexadecimal-string>
```

**Purpose**: Encrypts sensitive PII data (SSNs, bank accounts, tax information)
**Algorithm**: AES-256-GCM
**Required**: Production only (auto-generated dev key used in development)

**Setup Instructions**:
```bash
# Generate key
openssl rand -hex 32

# Add to Replit Secrets
# Key: ENCRYPTION_KEY
# Value: <paste-generated-key>
```

**Key Rotation** (Optional):
```bash
# For zero-downtime key rotation
ENCRYPTION_KEY=<new-key>
ENCRYPTION_KEY_PREVIOUS=<old-key>
```

---

### 3. Session Security

```bash
# Generate with: openssl rand -base64 64
SESSION_SECRET=<64+-character-string>
```

**Purpose**: Signs session cookies to prevent tampering
**Required**: All environments (minimum 32 characters, 64+ recommended)
**Note**: Never use default value `dev-secret-change-in-production`

**Setup Instructions**:
```bash
# Generate secret
openssl rand -base64 64

# Add to Replit Secrets
# Key: SESSION_SECRET
# Value: <paste-generated-secret>
```

---

### 4. CORS Configuration

```bash
# Production domains (comma-separated)
ALLOWED_ORIGINS=https://marylandbenefits.gov,https://www.marylandbenefits.gov
```

**Purpose**: Restricts API access to trusted domains
**Required**: Production/Staging only (auto-configured in development)
**Format**: Comma-separated HTTPS URLs (no wildcards)

---

### 5. AI Services (Google Gemini)

```bash
# Preferred: GEMINI_API_KEY
GEMINI_API_KEY=<your-api-key>

# Alternative: GOOGLE_API_KEY (fallback)
GOOGLE_API_KEY=<your-api-key>
```

**Purpose**: Powers RAG, document analysis, and benefit calculations
**Get API Key**: https://aistudio.google.com/app/apikey
**Required**: Yes (application won't start without it)

**Setup Instructions**:
1. Go to https://aistudio.google.com/app/apikey
2. Create new API key (or use existing)
3. Add to Replit Secrets as `GEMINI_API_KEY`

---

### 6. Object Storage

**⚠️ RECOMMENDED: Use Replit's Built-In Object Storage**

Replit provides built-in object storage that is automatically configured and secured. This is the recommended option for Replit deployments.

**Replit Object Storage Setup** (Recommended):
1. Enable Object Storage in Replit workspace
2. Environment variables are automatically configured:
   - `PUBLIC_OBJECT_SEARCH_PATHS` (auto-set)
   - `PRIVATE_OBJECT_DIR` (auto-set)
3. No additional configuration needed
4. Zero credential management required
5. Fully integrated with Replit security model

**When to Use**: All Replit deployments (recommended default)

---

**Alternative: Google Cloud Storage (Advanced)**

⚠️ **Only use GCS if you have specific requirements not met by Replit Object Storage**

```bash
# Bucket name
GCS_BUCKET_NAME=jawn-production-documents

# Service account credentials (Base64-encoded JSON)
GCS_SERVICE_ACCOUNT_BASE64=<base64-encoded-json>
```

**Purpose**: External object storage for deployments outside Replit
**Required**: Only if NOT using Replit Object Storage
**Security**: Uses base64-encoded secrets (never commit raw JSON files)

**Setup Instructions**:

1. **Create GCS Bucket**:
```bash
# Via gcloud CLI
gcloud storage buckets create gs://jawn-production-documents \
  --location=us-east1 \
  --uniform-bucket-level-access

# Or via Google Cloud Console: https://console.cloud.google.com/storage
```

2. **Create Service Account**:
```bash
# Create service account
gcloud iam service-accounts create jawn-storage \
  --display-name="JAWN Object Storage"

# Grant bucket permissions
gcloud storage buckets add-iam-policy-binding gs://jawn-production-documents \
  --member="serviceAccount:jawn-storage@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Generate key file (temporary - will be converted to base64)
gcloud iam service-accounts keys create gcs-credentials.json \
  --iam-account=jawn-storage@PROJECT_ID.iam.gserviceaccount.com
```

3. **⚠️ SECURE CREDENTIAL STORAGE** (Critical - Never skip this step):

```bash
# Option A: Base64 encode and store in Replit Secrets (Recommended)
base64 -i gcs-credentials.json | tr -d '\n' > gcs-credentials-base64.txt

# Copy the contents of gcs-credentials-base64.txt
# Add to Replit Secrets:
# Key: GCS_SERVICE_ACCOUNT_BASE64
# Value: <paste-base64-content>

# IMMEDIATELY delete both JSON files after storing in secrets:
rm gcs-credentials.json gcs-credentials-base64.txt

# Option B: Use a secrets manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault)
# Store the service account JSON in your secrets manager
# Configure runtime secret retrieval
```

4. **Runtime Credential Decoding**:

The application must decode the base64 secret at runtime. Add this to your application startup:

```typescript
// server/objectStorage.ts or server/index.ts
if (process.env.GCS_SERVICE_ACCOUNT_BASE64) {
  // Decode base64 secret and create temporary credential file
  const credentialsJson = Buffer.from(
    process.env.GCS_SERVICE_ACCOUNT_BASE64,
    'base64'
  ).toString('utf-8');
  
  const tempCredPath = '/tmp/gcs-credentials.json';
  fs.writeFileSync(tempCredPath, credentialsJson);
  
  // Set environment variable for Google Cloud SDK
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tempCredPath;
}
```

5. **Add to Replit Secrets**:
```bash
# Key: GCS_BUCKET_NAME
# Value: jawn-production-documents

# Key: GCS_SERVICE_ACCOUNT_BASE64
# Value: <base64-encoded-service-account-json>
```

**🚨 CRITICAL SECURITY RULES FOR GCS**:
- ❌ **NEVER upload raw JSON credentials to Replit Files**
- ❌ **NEVER commit service account JSON to git**
- ❌ **NEVER store credentials in environment files**
- ✅ **ALWAYS use base64-encoded secrets in Replit Secrets**
- ✅ **ALWAYS delete temporary credential files after encoding**
- ✅ **ALWAYS use /tmp/ for runtime credential files (auto-cleaned)**

---

## Optional Variables

### 1. Distributed Caching (Redis/Upstash)

**Option A: Standard Redis**
```bash
# Redis connection URL
REDIS_URL=redis://username:password@host:6379
# Or with TLS
REDIS_URL=rediss://username:password@host:6379
```

**Option B: Upstash (Recommended for Replit)**
```bash
# Upstash REST API
UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-token>
```

**Purpose**: Distributed caching for multi-instance deployments
**Without**: Falls back to in-memory cache (single instance only)
**Cost**: Free tier available at https://upstash.com

**Setup Instructions (Upstash)**:
1. Create account at https://upstash.com
2. Create new Redis database (choose region near your deployment)
3. Copy REST URL and Token
4. Add to Replit Secrets

**When to Use**:
- ✅ Multi-instance deployments (PM2 cluster mode)
- ✅ Multiple Replit deployments
- ❌ Single-instance development (not needed)

---

### 2. Email Notifications (SMTP)

```bash
# SMTP server configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@marylandbenefits.gov
SMTP_PASS=<app-specific-password>
SMTP_FROM_EMAIL=noreply@marylandbenefits.gov
```

**Purpose**: Sends email notifications when users are offline
**Without**: Notifications logged to console only (no emails sent)
**Cost**: Free (Gmail), varies (SendGrid, AWS SES, Mailgun)

**Setup Instructions (Gmail)**:
1. Enable 2FA on Gmail account
2. Generate app-specific password:
   - Google Account → Security → 2-Step Verification → App passwords
3. Add to Replit Secrets

**Setup Instructions (SendGrid)**:
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
SMTP_FROM_EMAIL=noreply@marylandbenefits.gov
```

**Production Recommendation**: Use transactional email service (SendGrid, AWS SES, Mailgun) instead of Gmail

---

### 3. Error Tracking (Sentry)

```bash
# Sentry DSN
SENTRY_DSN=https://<key>@<organization>.ingest.sentry.io/<project>

# Optional configuration
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions
SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10% of transactions
```

**Purpose**: Enterprise error tracking, performance monitoring, stack traces
**Without**: Errors logged locally only (no centralized tracking)
**Cost**: Free tier available at https://sentry.io

**Setup Instructions**:
1. Create account at https://sentry.io
2. Create new project (Node.js/Express)
3. Copy DSN from project settings
4. Add to Replit Secrets

**Features Enabled**:
- Real-time error alerting
- Stack trace analysis
- Performance monitoring
- User impact tracking
- PII scrubbing (SSNs, emails, phone numbers automatically redacted)

---

### 4. Rate Limiting & Performance

```bash
# Rate limiting (default: 100 requests per 15 minutes)
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # Per window

# Request size limits
MAX_REQUEST_SIZE_MB=10  # Default: 10MB

# Database connection pool
DB_POOL_MIN=2
DB_POOL_MAX=10
```

**Purpose**: DoS protection, performance optimization
**Defaults**: Reasonable defaults provided (usually no changes needed)

---

### 5. Operational Settings

```bash
# Environment
NODE_ENV=production  # Required for secure cookies

# Server
PORT=5000  # Default: 5000

# Logging
LOG_LEVEL=info  # Options: debug, info, warn, error

# Feature flags
ENABLE_AI_FALLBACK=true
ENABLE_CACHE=true
CACHE_TTL_SECONDS=3600
```

---

## Service-Specific Setup

### PolicyEngine Integration

```bash
# Optional: PolicyEngine API credentials (if using premium features)
POLICYENGINE_CLIENT_ID=<your-client-id>
POLICYENGINE_CLIENT_SECRET=<your-client-secret>
```

**Note**: Public API works without credentials. Only needed for premium features.

---

### Data.gov API

```bash
# Optional: Data.gov API key (for legislative tracking)
DATA_GOV_API_KEY=<your-api-key>
```

**Get Key**: https://api.data.gov/signup/
**Without**: Falls back to public API (lower rate limits)

---

## Security Best Practices

### ✅ DO:
- ✅ Use Replit Secrets for all sensitive values
- ✅ Rotate encryption keys annually
- ✅ Use strong session secrets (64+ characters)
- ✅ Enable HTTPS/TLS for all connections
- ✅ Restrict CORS to specific domains (no wildcards)
- ✅ Use service accounts with minimal permissions (GCS)
- ✅ Enable Sentry PII scrubbing (automatic)
- ✅ Use app-specific passwords (Gmail SMTP)

### ❌ DON'T:
- ❌ Commit `.env` files to git
- ❌ Share secrets via email/chat
- ❌ Use production secrets in development
- ❌ Use default/example values in production
- ❌ Expose secrets in logs
- ❌ Use wildcard CORS (`*`)
- ❌ Store credentials in code

---

## Validation & Testing

### 1. Check Production Readiness

```bash
# Development environment (shows warnings)
NODE_ENV=development npm run dev

# Production validation (fails on critical issues)
NODE_ENV=production npm start
```

**Development Output**:
```
⚠️  Environment Warnings:
  - ENCRYPTION_KEY not set - using development-only key (DO NOT USE IN PRODUCTION)
  - Redis not configured - using in-memory cache only
  - Email service not configured - notifications will be logged only
✅ Environment validation passed
```

**Production Output (Ready)**:
```
✅ Production readiness validation passed
✅ System is READY for production deployment
```

**Production Output (Not Ready)**:
```
❌ CRITICAL ISSUES (Must fix before production):
  [SECURITY] Encryption Key Set: ENCRYPTION_KEY must be a 64-character hex string
  [SECURITY] CORS Allowed Origins: ALLOWED_ORIGINS must be set to specific domains
  [OPERATIONAL] AI Service API Keys: Set GOOGLE_API_KEY for AI functionality
❌ System is NOT READY for production
```

### 2. Test Individual Services

```bash
# Test encryption
npm run test:encryption

# Test database connection
curl http://localhost:5000/api/health | jq '.services[] | select(.name == "database")'

# Test object storage
curl http://localhost:5000/api/health | jq '.services[] | select(.name == "objectStorage")'

# Test Gemini API
curl http://localhost:5000/api/health | jq '.services[] | select(.name == "gemini")'
```

### 3. Health Check Endpoint

```bash
# Production health check
curl https://marylandbenefits.gov/api/health

# Expected response
{
  "status": "healthy",
  "services": [
    { "name": "database", "status": "healthy" },
    { "name": "redis", "status": "healthy" },
    { "name": "gemini", "status": "healthy" },
    { "name": "objectStorage", "status": "healthy" }
  ]
}
```

---

## Environment Template

**Create `.env` file** (NEVER commit to git):

```bash
# ============================================================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# Maryland Benefits Navigator (JAWN)
# ============================================================================

# ============================================================================
# REQUIRED - DATABASE (Auto-configured on Replit)
# ============================================================================
DATABASE_URL=<auto-configured-by-replit>

# ============================================================================
# REQUIRED - SECURITY
# ============================================================================

# Encryption Key (Generate: openssl rand -hex 32)
ENCRYPTION_KEY=

# Session Secret (Generate: openssl rand -base64 64)
SESSION_SECRET=

# CORS (Comma-separated production domains)
ALLOWED_ORIGINS=https://marylandbenefits.gov

# ============================================================================
# REQUIRED - AI SERVICES
# ============================================================================

# Google Gemini API (https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=

# ============================================================================
# REQUIRED - OBJECT STORAGE
# ============================================================================

# RECOMMENDED: Use Replit's built-in Object Storage (auto-configured)
# If using Replit Object Storage, these are set automatically:
# PUBLIC_OBJECT_SEARCH_PATHS=
# PRIVATE_OBJECT_DIR=

# ALTERNATIVE: Google Cloud Storage (Advanced - only if needed)
# ⚠️ Use base64-encoded secrets in Replit Secrets (never upload raw JSON)
# GCS_BUCKET_NAME=jawn-production-documents
# GCS_SERVICE_ACCOUNT_BASE64=<base64-encoded-service-account-json>

# ============================================================================
# OPTIONAL - DISTRIBUTED CACHING (Recommended for production)
# ============================================================================

# Option A: Standard Redis
# REDIS_URL=rediss://username:password@host:6379

# Option B: Upstash (Recommended for Replit)
# UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io
# UPSTASH_REDIS_REST_TOKEN=

# ============================================================================
# OPTIONAL - EMAIL NOTIFICATIONS
# ============================================================================

# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=notifications@marylandbenefits.gov
# SMTP_PASS=
# SMTP_FROM_EMAIL=noreply@marylandbenefits.gov

# ============================================================================
# OPTIONAL - ERROR TRACKING (Recommended for production)
# ============================================================================

# SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
# SENTRY_ENVIRONMENT=production
# SENTRY_TRACES_SAMPLE_RATE=0.1
# SENTRY_PROFILES_SAMPLE_RATE=0.1

# ============================================================================
# OPERATIONAL
# ============================================================================

NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# ============================================================================
# RATE LIMITING & PERFORMANCE
# ============================================================================

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_REQUEST_SIZE_MB=10
DB_POOL_MIN=2
DB_POOL_MAX=10
```

---

## Quick Start Guide

**Step 1: Generate Secrets**
```bash
# Encryption key
openssl rand -hex 32

# Session secret
openssl rand -base64 64
```

**Step 2: Get API Keys**
- Gemini: https://aistudio.google.com/app/apikey
- Upstash (optional): https://upstash.com
- Sentry (optional): https://sentry.io

**Step 3: Configure Object Storage**
- **Recommended**: Enable Replit's built-in Object Storage (auto-configured)
- **Alternative**: Set up Google Cloud Storage with base64-encoded credentials (see section 6 above)

**Step 4: Configure Replit Secrets**
1. Open Replit Secrets pane
2. Add required variables (5 critical - see checklist at top)
3. Add optional variables (as needed)

**Step 5: Validate Configuration**
```bash
# Development validation (shows warnings for missing optional services)
npm run dev

# Check health endpoint
curl http://localhost:5000/api/health

# Production validation (fails fast on critical issues)
NODE_ENV=production npm start

# Expected output if ready:
# ✅ Production readiness validation passed
# ✅ System is READY for production deployment
```

**Step 6: Deploy to Production**
```bash
# After validation passes
NODE_ENV=production npm start
```

---

## Support & Troubleshooting

### Common Issues

**Issue**: "ENCRYPTION_KEY must be a 64-character hex string"
**Fix**: Use `openssl rand -hex 32` (outputs exactly 64 hex characters)

**Issue**: "GEMINI_API_KEY must be set"
**Fix**: Get API key from https://aistudio.google.com/app/apikey

**Issue**: "Object storage not configured"
**Fix**: Either:
- **Recommended**: Enable Replit's built-in Object Storage (auto-configured, zero setup)
- **Advanced**: Set up Google Cloud Storage with GCS_BUCKET_NAME + GCS_SERVICE_ACCOUNT_BASE64 (base64-encoded credentials - see section 6)

**Issue**: "Redis connection failed"
**Fix**: Non-critical. App works with in-memory cache. Add Redis/Upstash for multi-instance deployments only.

---

## Production Deployment Checklist

**Before Going Live**:
- [ ] All 5 required variables configured (see Quick Setup Checklist)
- [ ] Secrets stored in Replit Secrets (not `.env` file)
- [ ] NODE_ENV=production
- [ ] ALLOWED_ORIGINS set to production domain
- [ ] Health check returns `healthy` status
- [ ] Database connection successful (Replit PostgreSQL)
- [ ] Gemini API working (test a query)
- [ ] Object storage configured (GCS or Replit)
- [ ] Redis/Upstash configured (if multi-instance)
- [ ] Sentry configured (recommended)
- [ ] SMTP configured (recommended)
- [ ] SSL/TLS enabled
- [ ] Rate limiting configured
- [ ] Backups enabled (Replit PostgreSQL automatic)

**Optional but Recommended**:
- [ ] Error monitoring (Sentry)
- [ ] Email notifications (SMTP)
- [ ] Distributed caching (Redis/Upstash)
- [ ] Custom domain configured
- [ ] DNS configured
- [ ] Monitoring dashboard set up

---

**Last Updated**: 2025-10-22  
**Version**: 1.0  
**Maintainer**: Maryland Benefits Navigator Team
