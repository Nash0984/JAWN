# Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Maryland Multi-Program Benefits Navigator System to production. The application is optimized for Replit deployment but can be adapted to other Node.js hosting platforms.

**Target Platform:** Replit (Primary)  
**Alternative Platforms:** Railway, Render, Heroku, AWS, Azure, GCP

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Replit Deployment](#replit-deployment)
4. [Database Setup](#database-setup)
5. [Object Storage Configuration](#object-storage-configuration)
6. [Email Service Configuration](#email-service-configuration)
7. [Build & Deployment Process](#build--deployment-process)
8. [Health Checks & Monitoring](#health-checks--monitoring)
9. [Scaling Considerations](#scaling-considerations)
10. [Rollback Procedures](#rollback-procedures)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Node.js:** v20 or higher
- **npm:** v9 or higher
- **PostgreSQL:** v14 or higher (Neon recommended)
- **Git:** For version control

### Required Services
- **Neon Database:** PostgreSQL database hosting
- **Google Gemini API:** AI/ML services
- **SMTP Server:** Email notifications (optional but recommended)
- **Object Storage:** Replit Object Storage or Google Cloud Storage

### System Requirements
**Minimum:**
- 2 vCPU
- 4GB RAM
- 20GB SSD storage
- 100 Mbps network

**Recommended (Production):**
- 4+ vCPU
- 8GB+ RAM
- 50GB+ SSD storage
- 1 Gbps network

---

## Environment Variables

### Required Variables

These variables are **mandatory** for the application to start:

#### 1. Database Connection
```bash
DATABASE_URL=postgresql://username:password@host:5432/dbname?sslmode=require
```
- **Purpose:** PostgreSQL connection string for Neon database
- **Format:** Standard PostgreSQL URL with SSL enforcement
- **Example:** `postgresql://user:pass@ep-cool-breeze-123456.us-east-2.aws.neon.tech/maryland_benefits?sslmode=require`

#### 2. Session Secret
```bash
SESSION_SECRET=<cryptographically-secure-random-string>
```
- **Purpose:** Secret key for session encryption and CSRF protection
- **Requirements:** 
  - Minimum 32 characters
  - Cryptographically random
  - Never reuse across environments
- **Generate:** `openssl rand -base64 32`
- **Critical:** Application will **exit with error** if not set

#### 3. AI/ML Services
```bash
GEMINI_API_KEY=<your-google-gemini-api-key>
```
- **Purpose:** Google Gemini API access for RAG, document analysis, embeddings
- **Obtain From:** https://aistudio.google.com/app/apikey
- **Required For:**
  - Conversational policy search
  - Document verification (Gemini Vision)
  - Rules extraction
  - Intake copilot
  - VITA tax assistant

### Optional Variables

#### Email Notifications (Recommended)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@maryland.gov
SMTP_PASS=<app-specific-password>
SMTP_FROM_EMAIL=Maryland Benefits <noreply@maryland.gov>
```
- **Purpose:** Email notifications for offline users and alerts
- **Fallback:** Logs to console if not configured
- **Supported Providers:** Gmail, SendGrid, AWS SES, Mailgun

#### Object Storage (Replit Auto-Configured)
```bash
PUBLIC_OBJECT_SEARCH_PATHS=public,assets
PRIVATE_OBJECT_DIR=.private
```
- **Purpose:** File upload storage configuration
- **Default:** Auto-configured on Replit
- **Storage Types:**
  - `public/` - Publicly accessible assets
  - `.private/` - User-uploaded documents (access-controlled)

#### Environment Mode
```bash
NODE_ENV=production
```
- **Purpose:** Enables production optimizations
- **Effects:**
  - Session cookies: `secure: true` (HTTPS only)
  - CSRF cookies: `secure: true` (HTTPS only)
  - Restrictive CSP (no `unsafe-inline`, `unsafe-eval`)
  - Error message sanitization
  - Performance optimizations

### Environment Variable Template

```bash
# .env.production
# Database
DATABASE_URL=postgresql://username:password@host:5432/dbname?sslmode=require

# Security
SESSION_SECRET=<generate-with-openssl-rand-base64-32>
NODE_ENV=production

# AI Services
GEMINI_API_KEY=<your-gemini-api-key>

# Email (Optional but recommended)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@maryland.gov
SMTP_PASS=<app-specific-password>
SMTP_FROM_EMAIL=Maryland Benefits <noreply@maryland.gov>

# Object Storage (Auto-configured on Replit)
PUBLIC_OBJECT_SEARCH_PATHS=public,assets
PRIVATE_OBJECT_DIR=.private
```

---

## Replit Deployment

### Step 1: Initial Setup

1. **Fork the Repository:**
   ```bash
   git clone https://github.com/maryland-dhs/benefits-navigator.git
   cd benefits-navigator
   ```

2. **Import to Replit:**
   - Go to https://replit.com
   - Click "Create Repl" → "Import from GitHub"
   - Paste repository URL
   - Select "Node.js" as language

3. **Configure Secrets:**
   - Click "Secrets" tab (lock icon) in Replit
   - Add environment variables one by one:
     - `DATABASE_URL`
     - `SESSION_SECRET`
     - `GEMINI_API_KEY`
     - SMTP variables (if using email)

### Step 2: Database Configuration

1. **Create Neon Database:**
   ```bash
   # Go to https://neon.tech
   # Create new project: "maryland-benefits-prod"
   # Copy connection string (includes ?sslmode=require)
   ```

2. **Add to Replit Secrets:**
   - Key: `DATABASE_URL`
   - Value: `postgresql://user:pass@host:5432/db?sslmode=require`

3. **Run Migrations:**
   ```bash
   npm run db:push
   ```

### Step 3: Object Storage Setup

**Replit auto-configures object storage** via sidecar endpoint (`http://127.0.0.1:1106`).

1. **Enable Object Storage:**
   - Replit Dashboard → "Storage" tab
   - Enable "Object Storage"
   - Note: Automatically creates bucket

2. **Verify Configuration:**
   ```bash
   # Check object storage health
   curl http://127.0.0.1:1106/health
   ```

### Step 4: Deploy Application

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Build Frontend:**
   ```bash
   npm run build
   ```

3. **Start Server:**
   ```bash
   npm run dev
   ```
   - Replit automatically detects port 5000
   - Provides public URL: `https://your-repl-name.replit.app`

4. **Configure Custom Domain (Optional):**
   - Replit Dashboard → "Domains"
   - Add custom domain: `benefits.maryland.gov`
   - Update DNS CNAME record
   - SSL/TLS auto-provisioned

### Step 5: Verify Deployment

**Health Check Endpoints:**
```bash
# Application health
curl https://your-repl-name.replit.app/api/health

# Database connectivity
curl https://your-repl-name.replit.app/api/health/db

# Object storage
curl https://your-repl-name.replit.app/api/health/storage
```

**Expected Response:**
```json
{
  "status": "healthy",
  "uptime": 12345,
  "database": "connected",
  "storage": "available",
  "timestamp": "2025-01-10T12:00:00Z"
}
```

---

## Database Setup

### Neon PostgreSQL Configuration

**Step 1: Create Neon Project**
```bash
# Via Neon Console (https://neon.tech)
1. Create new project: "maryland-benefits-prod"
2. Select region: US East (Ohio) for Maryland proximity
3. Note connection details
```

**Step 2: Configure Connection String**
```bash
# Format
postgresql://[user]:[password]@[host]/[database]?sslmode=require

# Example
postgresql://maryland_user:SecureP@ss123@ep-cool-breeze-123456.us-east-2.aws.neon.tech/benefits_prod?sslmode=require
```

**Step 3: Run Database Migrations**
```bash
# Push schema to database
npm run db:push

# Force push (if data loss acceptable)
npm run db:push -- --force
```

**Step 4: Seed Initial Data**
```bash
# Create admin user
npm run db:seed:admin

# Load benefit programs
npm run db:seed:programs

# Load demo users (development only)
npm run db:seed:demo
```

### Session Table Auto-Creation

The `session` table is **automatically created** by `connect-pg-simple` on first run:

```sql
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" 
  PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

### Database Backup Strategy

**Neon Auto-Backups:**
- Point-in-time recovery (PITR) enabled
- 7-day retention by default
- Hourly snapshots

**Manual Backup:**
```bash
# Export database
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup-20250110.sql
```

---

## Object Storage Configuration

### Replit Object Storage (Default)

**Auto-Configuration:**
- Sidecar endpoint: `http://127.0.0.1:1106`
- Bucket auto-created: `repl-default-bucket-$REPL_ID`
- Directories:
  - `public/` - Public assets
  - `.private/` - User documents (ACL-protected)

**Environment Variables (Auto-Set):**
```bash
PUBLIC_OBJECT_SEARCH_PATHS=public,assets
PRIVATE_OBJECT_DIR=.private
```

**Upload Configuration:**
```typescript
// server/services/storage.service.ts
const STORAGE_ENDPOINT = "http://127.0.0.1:1106";
const PUBLIC_DIR = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "public";
const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || ".private";
```

### Google Cloud Storage (Alternative)

**Step 1: Create GCS Bucket**
```bash
gsutil mb -l us-east4 -c STANDARD gs://maryland-benefits-prod
```

**Step 2: Configure Service Account**
```bash
# Create service account
gcloud iam service-accounts create maryland-benefits-sa

# Grant permissions
gsutil iam ch serviceAccount:maryland-benefits-sa@project-id.iam.gserviceaccount.com:objectAdmin \
  gs://maryland-benefits-prod

# Download key
gcloud iam service-accounts keys create key.json \
  --iam-account=maryland-benefits-sa@project-id.iam.gserviceaccount.com
```

**Step 3: Set Environment Variables**
```bash
GCS_BUCKET_NAME=maryland-benefits-prod
GCS_PROJECT_ID=your-project-id
GCS_CREDENTIALS=<base64-encoded-service-account-key>
```

---

## Email Service Configuration

### Gmail SMTP (Development/Testing)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=<app-specific-password>
SMTP_FROM_EMAIL=Maryland Benefits <noreply@maryland.gov>
```

**Generate App Password:**
1. Google Account → Security
2. Enable 2-Step Verification
3. App Passwords → Generate
4. Use generated 16-character password

### SendGrid (Production)

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
SMTP_FROM_EMAIL=Maryland Benefits <notifications@maryland.gov>
```

### AWS SES (Production)

```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=<aws-ses-smtp-username>
SMTP_PASS=<aws-ses-smtp-password>
SMTP_FROM_EMAIL=Maryland Benefits <noreply@maryland.gov>
```

**Verify Domain:**
```bash
# Add DNS records for domain verification
# TXT record: amazonses.com verification token
# DKIM records for email authentication
```

### Email Templates

Email templates are **dynamically generated** as inline template literals in `server/services/email.service.ts` (lines 121-172).

**Template Structure:**
- **HTML Version:** Responsive design with Maryland DHS branding (#0D4F8B header)
- **Plain Text Version:** Fallback for email clients that don't support HTML

**Template Features:**
- Maryland Benefits Navigator header
- Notification title and message
- Optional action button/link
- Footer with DHS branding
- Unsubscribe/preference management notice

**Customization:**
To modify email templates, edit `server/services/email.service.ts`:
```typescript
// HTML template (line 121)
const html = `<!DOCTYPE html>...`;

// Plain text template (line 157)
const text = `Maryland Benefits Navigator...`;
```

---

## Build & Deployment Process

### Development Build
```bash
# Install dependencies
npm install

# Start development server (with HMR)
npm run dev
```

### Production Build
```bash
# Install dependencies (production only)
npm ci --production

# Build frontend
npm run build

# Start production server
npm start
```

### Build Artifacts

**Output Directory:** `dist/`
```
dist/
├── client/           # Frontend static files
│   ├── index.html    # Entry HTML
│   ├── assets/       # JS, CSS, images
│   └── ...
└── server/           # Backend (if using TypeScript build)
```

### Deployment Checklist

- [ ] All environment variables configured
- [ ] `NODE_ENV=production` set
- [ ] Database migrations applied (`npm run db:push`)
- [ ] Frontend built (`npm run build`)
- [ ] Object storage configured and accessible
- [ ] Email service configured (or console logging accepted)
- [ ] Health checks passing
- [ ] SSL/TLS certificate valid
- [ ] Domain DNS configured (if custom domain)
- [ ] Monitoring and alerts configured
- [ ] Backup strategy in place

---

## Health Checks & Monitoring

### Health Check Endpoints

**Application Health:**
```bash
GET /api/health
```
Response:
```json
{
  "status": "healthy",
  "uptime": 12345,
  "timestamp": "2025-01-10T12:00:00Z",
  "version": "1.0.0"
}
```

**Database Health:**
```bash
GET /api/health/db
```
Response:
```json
{
  "status": "connected",
  "latency": 23,
  "activeConnections": 5
}
```

**Storage Health:**
```bash
GET /api/health/storage
```
Response:
```json
{
  "status": "available",
  "publicDir": "public",
  "privateDir": ".private"
}
```

### Monitoring Metrics

**Performance Metrics:**
- Request duration (Server-Timing header)
- Database query time
- AI API latency
- Error rate

**Server-Timing Header Example:**
```http
Server-Timing: db;dur=45.3, api;dur=123.8, total;dur=169.1
```

### Logging

**Request Logging:**
- Unique request IDs: `req_1672531200_abc123xyz`
- Performance timings
- Error tracking
- Sensitive data redaction

**Audit Logging:**
- All security events (login, logout, permission changes)
- User actions (case creation, document uploads)
- Admin operations (user management, system config)

**Log Output:**
```
2025-01-10T12:00:00Z [express] ✓ GET /api/cases 200 - 45ms
2025-01-10T12:00:01Z [auth] ℹ User login: john.doe (navigator)
2025-01-10T12:00:02Z [ai] ⚠ Gemini API latency: 2.3s
```

### Error Monitoring

**Recommended Tools:**
- Sentry (error tracking)
- LogRocket (session replay)
- Datadog (APM)
- New Relic (performance monitoring)

**Error Alerts:**
- 5xx error rate > 1%
- Response time p95 > 1s
- Database connection failures
- AI API quota exceeded

---

## Scaling Considerations

### Horizontal Scaling

**Load Balancing:**
```
          ┌─────────────┐
          │Load Balancer│
          └──────┬──────┘
                 │
       ┌─────────┼─────────┐
       │         │         │
       ▼         ▼         ▼
   ┌──────┐  ┌──────┐  ┌──────┐
   │App 1 │  │App 2 │  │App 3 │
   └──┬───┘  └──┬───┘  └──┬───┘
      │         │         │
      └────────┬┴─────────┘
               ▼
         ┌──────────┐
         │PostgreSQL│
         │ (Neon)   │
         └──────────┘
```

**Session Persistence:**
- PostgreSQL session store (shared across instances)
- Sticky sessions (if needed for WebSocket)
- Redis session store (alternative)

**Configuration:**
```typescript
// server/index.ts
app.set('trust proxy', 1); // Required for load balancers
```

### Vertical Scaling

**Resource Allocation:**
| Load Level | vCPU | RAM | Storage |
|------------|------|-----|---------|
| Low (< 100 users) | 2 | 4GB | 20GB |
| Medium (100-1000 users) | 4 | 8GB | 50GB |
| High (1000-10k users) | 8 | 16GB | 100GB |
| Enterprise (> 10k users) | 16+ | 32GB+ | 500GB+ |

### Database Scaling

**Neon Autoscaling:**
- Automatic compute scaling
- Read replicas for analytics
- Connection pooling

**PgBouncer (Connection Pooling):**
```bash
# Install PgBouncer
sudo apt-get install pgbouncer

# Configure pool
[databases]
maryland_benefits = host=neon.tech port=5432 dbname=benefits_prod

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

### Caching Strategy

**In-Memory Caching (NodeCache):**
```typescript
// server/middleware/cache.ts
const cache = new NodeCache({ stdTTL: 600 }); // 10 min TTL

// Cache frequently accessed data
- Benefit program lists
- Document requirement templates
- Public FAQ
```

**Redis (Distributed Caching):**
```bash
# For multi-instance deployments
REDIS_URL=redis://localhost:6379
```

---

## Rollback Procedures

### Replit Deployment Rollback

**Using Replit Checkpoints:**
1. Go to Replit Dashboard
2. Click "Rollback" tab
3. Select checkpoint before deployment
4. Click "Restore to this checkpoint"

**Manual Rollback:**
```bash
# Revert to previous commit
git log --oneline -10  # View recent commits
git revert <commit-hash>
git push origin main

# Replit auto-deploys from main branch
```

### Database Rollback

**Neon Point-in-Time Recovery:**
```bash
# Via Neon Console
1. Go to Database → Branches
2. Click "Create branch from history"
3. Select timestamp before migration
4. Restore to main branch

# OR use CLI
neon branches create --parent main --timestamp "2025-01-10T12:00:00Z"
```

**Manual Rollback:**
```bash
# Restore from backup
psql $DATABASE_URL < backup-pre-deployment.sql

# Re-run old migrations
npm run db:push -- --schema=./schema.backup.ts
```

### Application Rollback Strategy

1. **Verify Issue:** Confirm degraded performance/errors
2. **Notify Users:** Post incident banner
3. **Pause Traffic:** Enable maintenance mode (if available)
4. **Rollback Code:** Revert to last stable commit
5. **Rollback DB:** Restore from backup (if schema changed)
6. **Verify Fix:** Run health checks
7. **Resume Traffic:** Remove maintenance mode
8. **Post-Mortem:** Document incident and prevention

---

## Troubleshooting

### Common Issues

#### Issue 1: Application Won't Start

**Symptoms:**
```
❌ FATAL: SESSION_SECRET environment variable is required for secure session management
```

**Solution:**
```bash
# Generate SESSION_SECRET
openssl rand -base64 32

# Add to Replit Secrets
# Key: SESSION_SECRET
# Value: <generated-string>

# Restart application
```

#### Issue 2: Database Connection Failed

**Symptoms:**
```
Error: connect ECONNREFUSED
Error: password authentication failed
```

**Solution:**
```bash
# Check DATABASE_URL format
echo $DATABASE_URL
# Should include ?sslmode=require

# Verify Neon database is running
# Neon Console → Database → Status

# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Update connection string if needed
DATABASE_URL=postgresql://user:newpass@host:5432/db?sslmode=require
```

#### Issue 3: Object Storage Not Working

**Symptoms:**
```
Error: Failed to upload document
Error: Storage sidecar not responding
```

**Solution:**
```bash
# Check Replit Object Storage status
# Replit Dashboard → Storage → Enable

# Verify sidecar endpoint
curl http://127.0.0.1:1106/health

# Check environment variables
echo $PUBLIC_OBJECT_SEARCH_PATHS
echo $PRIVATE_OBJECT_DIR

# Restart Repl to reinitialize storage
```

#### Issue 4: Email Not Sending

**Symptoms:**
```
⚠️ Email service not configured. Email notifications will be logged to console.
```

**Solution:**
```bash
# Configure SMTP variables
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=<app-specific-password>
SMTP_FROM_EMAIL=Maryland Benefits <noreply@maryland.gov>

# Test email
curl -X POST https://your-app.replit.app/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

#### Issue 5: High Memory Usage

**Symptoms:**
```
Warning: Memory usage above 80%
Application restarting due to OOM
```

**Solution:**
```bash
# Increase Replit memory allocation
# Replit Dashboard → Resources → Upgrade Plan

# Implement caching to reduce DB queries
# Enable query result caching

# Optimize Gemini API usage
# Implement request deduplication
# Cache embedding results

# Profile memory usage
node --inspect server/index.js
# Chrome DevTools → Memory profiler
```

#### Issue 6: Rate Limit Errors

**Symptoms:**
```
429 Too Many Requests
AI service rate limit exceeded
```

**Solution:**
```bash
# Identify source
# Check request logs for high-frequency IPs

# Adjust rate limits (if legitimate)
# server/index.ts
max: 200 // Increase from 100

# Implement user-based limits (instead of IP)
keyGenerator: (req) => req.user?.id || req.ip

# Add rate limit bypass for admin
skip: (req) => req.user?.role === 'super_admin'
```

### Debug Mode

**Enable Verbose Logging:**
```bash
NODE_ENV=development DEBUG=* npm run dev
```

**Database Query Logging:**
```typescript
// drizzle.config.ts
export default {
  logger: true, // Enable SQL query logging
};
```

**Performance Profiling:**
```bash
# Node.js profiler
node --prof server/index.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

---

## Deployment Runbook

### Pre-Deployment Checklist
- [ ] Code reviewed and approved
- [ ] All tests passing (`npm test`)
- [ ] Database migrations tested
- [ ] Environment variables verified
- [ ] Security scan completed (npm audit)
- [ ] Performance benchmarks met
- [ ] Documentation updated

### Deployment Steps
1. **Merge to Main Branch**
   ```bash
   git checkout main
   git merge feature/your-branch
   git push origin main
   ```

2. **Replit Auto-Deploy**
   - Monitors main branch
   - Runs `npm install`
   - Executes `npm run build`
   - Restarts application

3. **Run Migrations**
   ```bash
   npm run db:push
   ```

4. **Verify Health**
   ```bash
   curl https://your-app.replit.app/api/health
   ```

5. **Monitor Logs**
   ```bash
   # Replit Console → Logs tab
   # Watch for errors in first 5 minutes
   ```

### Post-Deployment Checklist
- [ ] Health checks passing
- [ ] No error spikes in logs
- [ ] Performance metrics stable
- [ ] Database queries optimized
- [ ] Cache hit ratio acceptable (> 70%)
- [ ] Email notifications working
- [ ] Object storage accessible
- [ ] User acceptance testing completed

---

## Security Considerations

### Production Security Checklist
- [ ] `NODE_ENV=production` set
- [ ] SESSION_SECRET is cryptographically random (32+ chars)
- [ ] Database uses SSL/TLS (`?sslmode=require`)
- [ ] HTTPS enforced (Replit auto-provides)
- [ ] Security headers configured (Helmet)
- [ ] Rate limiting enabled
- [ ] CSRF protection active
- [ ] Error messages sanitized
- [ ] Audit logging enabled
- [ ] Secrets in environment variables (not code)

### SSL/TLS Configuration

**Replit (Automatic):**
- Free SSL/TLS certificate
- Auto-renewal
- HTTPS redirect enabled
- HSTS header set (`max-age=31536000`)

**Custom Domain:**
```bash
# DNS Configuration
CNAME benefits.maryland.gov → your-app.replit.app

# Replit auto-provisions SSL
# Usually takes 5-15 minutes
```

---

## Monitoring & Alerts

### Recommended Monitoring Stack

**Application Monitoring:**
- Sentry (error tracking)
- LogRocket (session replay)
- Datadog (APM)

**Infrastructure Monitoring:**
- Replit Analytics (built-in)
- Neon Database Metrics
- Custom health check cron

**Alert Configuration:**
```yaml
alerts:
  - name: High Error Rate
    condition: error_rate > 1%
    action: email, slack
    
  - name: Database Latency
    condition: db_latency_p95 > 500ms
    action: email
    
  - name: Memory Usage
    condition: memory_usage > 80%
    action: email, scale_up
    
  - name: API Quota
    condition: gemini_quota_remaining < 10%
    action: email, slack
```

---

**Last Updated:** January 2025  
**Document Version:** 1.0  
**Next Review:** April 2025

For questions or support, contact: devops@maryland.gov
