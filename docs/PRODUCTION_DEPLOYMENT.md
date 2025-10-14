# Production Deployment Checklist

## Pre-Deployment Validation

### 1. Environment Configuration

**Required Environment Variables:**

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
DB_POOL_MIN=2
DB_POOL_MAX=10

# Security (CRITICAL)
SESSION_SECRET= # 64+ characters (openssl rand -base64 64)
ENCRYPTION_KEY= # 64 hex chars (openssl rand -hex 32)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# AI Services (REQUIRED)
GEMINI_API_KEY= # or GOOGLE_API_KEY

# Object Storage (REQUIRED)
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Email Service (Optional but recommended)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=notifications@yourdomain.com

# Rate Limiting & Performance
RATE_LIMIT_WINDOW_MS=900000 # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
MAX_REQUEST_SIZE_MB=10
MAX_JSON_SIZE_MB=5

# External APIs (Optional)
DATA_GOV_API_KEY=

# Operational
NODE_ENV=production
PORT=5000
LOG_LEVEL=info
```

### 2. Generate Production Secrets

```bash
# Session Secret (64+ characters)
openssl rand -base64 64

# Encryption Key (64 hex characters)
openssl rand -hex 32

# Verify secrets are set correctly
node -p "process.env.ENCRYPTION_KEY.length === 64"  # Should output: true
node -p "process.env.SESSION_SECRET.length >= 64"   # Should output: true
```

### 3. Production Validation

```bash
# Run production validation
NODE_ENV=production npm run validate

# Expected output:
# ✅ Production readiness validation passed
```

### 4. Database Setup

```bash
# Push schema to production database
npm run db:push

# Verify database connection
npm run db:check
```

### 5. Security Hardening Checklist

- [ ] **CORS**: Whitelist specific domains only (no wildcards)
- [ ] **HTTPS**: Ensure SSL/TLS certificates are valid
- [ ] **Secrets**: All secrets rotated from development values
- [ ] **Database**: SSL/TLS connection enabled
- [ ] **Session**: Secure cookies enabled (`NODE_ENV=production`)
- [ ] **Rate Limiting**: Enabled and configured per role
- [ ] **XSS Protection**: Sanitization middleware active
- [ ] **CSRF Protection**: Double-submit cookie pattern active
- [ ] **Headers**: Security headers (HSTS, CSP, X-Frame-Options) configured
- [ ] **Encryption**: PII field-level encryption enabled
- [ ] **Ownership**: Horizontal privilege escalation protection active
- [ ] **SQL Injection**: Drizzle ORM parameterization verified
- [ ] **File Uploads**: MIME validation and size limits active
- [ ] **Passwords**: 12+ char complexity requirements enforced

### 6. Performance Optimization

- [ ] **Connection Pooling**: DB_POOL_MIN and DB_POOL_MAX configured
- [ ] **Caching**: Intelligent caching enabled for AI/PolicyEngine
- [ ] **Request Limits**: Size limits (10MB body, 5MB JSON) enforced
- [ ] **Compression**: Gzip/Brotli enabled via reverse proxy
- [ ] **CDN**: Static assets served via CDN
- [ ] **Database Indexes**: Verified on high-traffic queries

### 7. Monitoring & Observability

```bash
# Health Check Endpoints
curl https://yourdomain.com/health        # Liveness
curl https://yourdomain.com/ready         # Readiness
curl https://yourdomain.com/startup       # Startup probe
curl https://yourdomain.com/api/health    # Detailed health
```

**Expected Response (Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-14T00:00:00.000Z",
  "uptime": 12345,
  "checks": {
    "process": { "status": "pass" },
    "database": { "status": "pass", "responseTime": 15 },
    "memory": { "status": "pass", "message": "Memory usage: 45.2%" },
    "ai_service": { "status": "pass" },
    "object_storage": { "status": "pass" }
  }
}
```

### 8. Load Balancer Configuration

**Health Check Settings:**
- Liveness: `GET /health` (interval: 30s, timeout: 5s)
- Readiness: `GET /ready` (interval: 10s, timeout: 3s)
- Startup: `GET /startup` (interval: 5s, timeout: 3s, failure threshold: 30)

**Connection Settings:**
- Keep-Alive: Enabled
- Connection Timeout: 60s
- Request Timeout: 30s

### 9. Graceful Shutdown

The application handles `SIGTERM`, `SIGINT`, and error signals gracefully:

```bash
# Test graceful shutdown (development)
kill -SIGTERM <PID>

# Expected log output:
# 🛑 SIGTERM received. Starting graceful shutdown...
# ✅ Server closed (no longer accepting connections)
# ✅ WebSocket connections closed
# ✅ Smart Scheduler stopped
# ✅ Graceful shutdown completed in 250ms
```

### 10. Security Monitoring

Access security dashboard at: `https://yourdomain.com/admin/security-monitoring`

**Metrics Tracked:**
- Failed authentication attempts
- XSS sanitizations
- Authorization failures
- Rate limit violations
- CSRF validation failures
- Session events
- Top attacking IPs
- Security score (0-100)

**Alert Thresholds:**
- Security Score < 80: Warning
- Security Score < 60: Critical
- Failed Auth > 50/hour: Investigate
- XSS Attempts > 10/hour: Review

## Deployment Steps

### Kubernetes/Docker Deployment

```yaml
# Deployment Configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: md-benefits-navigator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: md-benefits-navigator
  template:
    metadata:
      labels:
        app: md-benefits-navigator
    spec:
      containers:
      - name: app
        image: md-benefits-navigator:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          value: "production"
        # Add all required environment variables from secrets
        
        # Health Probes
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 5
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 3
        
        startupProbe:
          httpGet:
            path: /startup
            port: 5000
          initialDelaySeconds: 0
          periodSeconds: 5
          failureThreshold: 30
        
        # Resource Limits
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
```

### Traditional Server Deployment

```bash
# 1. Clone repository
git clone <repo-url>
cd md-benefits-navigator

# 2. Install dependencies
npm ci --production

# 3. Set environment variables
cp .env.example .env.production
# Edit .env.production with production values

# 4. Build application (if needed)
npm run build

# 5. Run database migrations
npm run db:push

# 6. Start application with PM2
pm2 start npm --name "md-navigator" -- start
pm2 save
pm2 startup

# 7. Configure nginx reverse proxy
# See nginx.conf.example
```

## Post-Deployment Verification

### 1. Smoke Tests

```bash
# Test authentication
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"***"}'

# Test health endpoints
curl https://yourdomain.com/health
curl https://yourdomain.com/ready

# Test rate limiting
for i in {1..10}; do curl https://yourdomain.com/api/health; done
```

### 2. Security Audit

```bash
# Run security dashboard checks
curl https://yourdomain.com/api/security/metrics \
  -H "Cookie: session=***"

# Expected: Security score > 80
```

### 3. Performance Baseline

```bash
# Test response times
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/

# Monitor logs for slow requests
tail -f /var/log/md-navigator/app.log | grep "Slow request"
```

### 4. Load Testing (Optional)

```bash
# Using Apache Bench
ab -n 1000 -c 10 https://yourdomain.com/api/health

# Using k6
k6 run loadtest.js
```

## Rollback Procedure

If issues are detected post-deployment:

```bash
# 1. Revert to previous version
kubectl rollout undo deployment/md-benefits-navigator

# Or with PM2
pm2 stop md-navigator
pm2 delete md-navigator
# Deploy previous version
pm2 start previous-version

# 2. Verify health
curl https://yourdomain.com/health

# 3. Check security metrics
curl https://yourdomain.com/api/security/metrics
```

## Monitoring & Alerts

### Recommended Monitoring Stack

- **APM**: New Relic, DataDog, or Application Insights
- **Logs**: ELK Stack or CloudWatch
- **Metrics**: Prometheus + Grafana
- **Uptime**: Pingdom or StatusCake
- **Security**: SIEM integration for audit logs

### Key Metrics to Monitor

1. **Application Health**
   - Response time (p50, p95, p99)
   - Error rate
   - Request throughput

2. **Security Events**
   - Failed login attempts
   - XSS sanitizations
   - CSRF violations
   - Ownership violations

3. **Database Performance**
   - Connection pool usage
   - Query latency
   - Deadlocks

4. **AI Service Usage**
   - API quota consumption
   - Response latency
   - Cost tracking

## Disaster Recovery

### Backup Strategy

```bash
# Database backups (daily)
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Object storage backups
gsutil -m cp -r gs://bucket-name gs://backup-bucket-name

# Configuration backups
tar -czf config-backup-$(date +%Y%m%d).tar.gz .env* *.json
```

### Recovery Procedure

```bash
# 1. Restore database
psql $DATABASE_URL < backup-20251014.sql

# 2. Restore object storage
gsutil -m cp -r gs://backup-bucket-name/* gs://bucket-name/

# 3. Verify integrity
npm run db:check
npm run storage:verify
```

## Support & Troubleshooting

### Common Issues

**Issue: High memory usage**
- Check: `curl /ready` - Look at memory.status
- Action: Increase DB_POOL_MAX or add more replicas

**Issue: Slow AI responses**
- Check: Gemini API quota and rate limits
- Action: Enable caching, review CACHE_TTL_SECONDS

**Issue: Security score dropping**
- Check: `/admin/security-monitoring` dashboard
- Action: Review top attacking IPs, increase rate limits

**Issue: Database connection errors**
- Check: SSL/TLS settings in DATABASE_URL
- Action: Verify `sslmode=require` parameter

### Log Locations

- Application: `/var/log/md-navigator/app.log`
- Error: `/var/log/md-navigator/error.log`
- Access: `/var/log/nginx/access.log`
- Security: Query audit_logs table

## Compliance & Auditing

### PII Data Handling

- All SSN and bank account fields encrypted at rest (AES-256-GCM)
- PII automatically masked in logs
- Audit trail for all PII access in `audit_logs` table

### HIPAA Compliance (if applicable)

- [ ] Database encrypted at rest
- [ ] Transmissions encrypted with TLS 1.2+
- [ ] Access logs retention (6 years minimum)
- [ ] Business Associate Agreements in place
- [ ] Disaster recovery plan documented

### Regular Security Audits

```bash
# Dependency vulnerability scan
npm audit --production

# Security headers check
curl -I https://yourdomain.com | grep -i 'x-frame-options\|strict-transport-security\|content-security-policy'

# OWASP ZAP scan (recommended quarterly)
zap-cli quick-scan https://yourdomain.com
```

## Contact & Escalation

For production issues:
1. Check health endpoints and security dashboard
2. Review application logs and audit trail
3. Consult this deployment guide
4. Escalate to DevOps/SRE team if unresolved

---

**Last Updated**: October 2025  
**Version**: 1.0  
**Maintained By**: Maryland Benefits Navigator Development Team
