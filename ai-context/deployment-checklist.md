# Deployment Checklist

Comprehensive pre-deployment validation, environment setup, security hardening, and production monitoring for the JAWN (Joint Access Welfare Network) multi-state benefits-tax platform.

## Table of Contents

1. [Pre-Deployment Validation](#pre-deployment-validation)
2. [Environment Configuration](#environment-configuration)
3. [Database Migration](#database-migration)
4. [Security Hardening](#security-hardening)
5. [Performance Optimization](#performance-optimization)
6. [Monitoring & Logging](#monitoring--logging)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Rollback Procedures](#rollback-procedures)

---

## Pre-Deployment Validation

### Code Quality Checks

- [ ] All tests passing (`npm test`)
- [ ] No TypeScript errors (`npm run typecheck` or `tsc --noEmit`)
- [ ] ESLint warnings resolved (`npm run lint`)
- [ ] Code coverage meets minimum threshold (80%+)
- [ ] No console.log/console.error in production code
- [ ] All TODO/FIXME comments addressed or documented

### Functional Testing

- [ ] All critical user flows tested end-to-end
- [ ] RAG search returns accurate citations
- [ ] PolicyEngine calculations verified (if available)
- [ ] Document upload/processing pipeline tested
- [ ] Navigator workspace session tracking validated
- [ ] Admin tools (audit logs, feedback management) functional
- [ ] Notification system delivers alerts correctly
- [ ] Policy change diff detection working
- [ ] Compliance validation rules tested
- [ ] VITA tax assistant integration verified

### Security Audit

- [ ] All API endpoints require authentication where appropriate
- [ ] CSRF protection enabled and tested
- [ ] Rate limiting configured and tested
- [ ] SQL injection vectors tested (use parameterized queries)
- [ ] XSS vulnerabilities addressed (input sanitization)
- [ ] Secrets not committed to repository
- [ ] Environment variables validated
- [ ] CORS configured for production domain
- [ ] Security headers (Helmet.js) verified

### Performance Benchmarks

- [ ] Page load times < 3 seconds
- [ ] API response times < 500ms for 95th percentile
- [ ] Database queries optimized (check EXPLAIN ANALYZE)
- [ ] Proper indexing on frequently queried columns
- [ ] Bundle size analyzed and optimized
- [ ] Image assets optimized (compression, lazy loading)
- [ ] Caching strategy implemented (NodeCache, browser cache)

---

## Environment Configuration

### Required Environment Variables

**Core Application:**
```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:password@host:port/dbname
SESSION_SECRET=<strong-random-secret>
```

**AI Services:**
```bash
GEMINI_API_KEY=<google-gemini-api-key>
```

**Object Storage:**
```bash
GCS_PROJECT_ID=<google-cloud-project-id>
GCS_BUCKET_NAME=<bucket-name>
GCS_SERVICE_ACCOUNT_KEY=<base64-encoded-service-account-json>
PUBLIC_OBJECT_SEARCH_PATHS=public
PRIVATE_OBJECT_DIR=.private
```

**Optional Services:**
```bash
# PolicyEngine (if using REST API instead of Python library)
POLICYENGINE_API_URL=https://api.policyengine.org
POLICYENGINE_CLIENT_ID=<client-id>
POLICYENGINE_CLIENT_SECRET=<client-secret>

# Email notifications (future)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=<smtp-username>
SMTP_PASSWORD=<smtp-password>
```

### Environment Validation Script

```typescript
// scripts/validate-env.ts
const requiredEnvVars = [
  'NODE_ENV',
  'DATABASE_URL',
  'SESSION_SECRET',
  'GEMINI_API_KEY',
  'GCS_PROJECT_ID',
  'GCS_BUCKET_NAME',
];

const missing = requiredEnvVars.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('Missing required environment variables:');
  missing.forEach(key => console.error(`  - ${key}`));
  process.exit(1);
}

console.log('✅ All required environment variables present');
```

Run before deployment:
```bash
tsx scripts/validate-env.ts
```

---

## Database Migration

### Pre-Migration Checks

- [ ] Backup production database
- [ ] Test migration on staging environment
- [ ] Review migration SQL for data loss warnings
- [ ] Verify rollback procedure
- [ ] Check database disk space (migrations may require temp space)

### Drizzle Migration Commands

**Generate migration from schema changes:**
```bash
npm run db:generate
```

**Review generated SQL:**
```bash
cat drizzle/migrations/<timestamp>_migration.sql
```

**Apply migration to production:**
```bash
# Use db:push for direct schema push (no migrations)
npm run db:push

# Or apply migrations manually (if using migration files)
# npm run db:migrate
```

**Force migration (if data loss acceptable):**
```bash
npm run db:push --force
```

### Post-Migration Validation

- [ ] Verify all tables created/updated
- [ ] Check indexes applied correctly
- [ ] Validate foreign key constraints
- [ ] Test critical queries for performance
- [ ] Verify data integrity (no data loss)

---

## Security Hardening

### Content Security Policy (CSP)

Update CSP headers in `server/index.ts`:

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### Rate Limiting

Configure production rate limits:

```typescript
import rateLimit from 'express-rate-limit';

// Global rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many requests from this IP',
}));

// Strict limit for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true,
});

app.use('/api/login', authLimiter);
```

### Secrets Management

- [ ] Rotate all secrets before production deployment
- [ ] Use strong SESSION_SECRET (min 32 chars, random)
- [ ] Store GCS service account key as base64 in env var
- [ ] Never log secrets or API keys
- [ ] Use environment-specific secrets (dev vs prod)

---

## Performance Optimization

### Database Indexing

**Note:** Indexes are defined in `shared/schema.ts` and automatically created by Drizzle. Verify these indexes exist after migration:

```sql
-- Documents table (already defined in schema.ts)
-- documents_benefit_program_idx on benefit_program_id
-- documents_status_idx on status
-- documents_section_number_idx on section_number

-- Document chunks (already defined in schema.ts)
-- chunks_document_id_idx on document_id

-- Search queries (already defined in schema.ts)
-- search_queries_user_id_idx on user_id
-- search_queries_benefit_program_idx on benefit_program_id

-- Feedback (already defined in schema.ts)
-- feedback_status_idx on status
-- feedback_user_id_idx on user_id
-- feedback_assigned_to_idx on assigned_to

-- Notifications (already defined in schema.ts)
-- notifications_user_read_idx on (user_id, is_read)
-- notifications_created_at_idx on created_at

-- Client verification documents (already defined in schema.ts)
-- client_verif_docs_session_idx on session_id
-- client_verif_docs_case_idx on client_case_id
-- client_verif_docs_status_idx on verification_status
```

**Verify indexes after deployment:**
```sql
-- Check all indexes in database
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Caching Strategy

The application uses server-side caching via `server/services/cacheService.ts`. Verify cache configuration:

```typescript
// server/services/cacheService.ts (already implemented)
import NodeCache from 'node-cache';

// Cache instance with production TTLs
const cache = new NodeCache({
  stdTTL: 3600, // 1 hour default
  checkperiod: 600, // Check for expired keys every 10 minutes
  useClones: false,
});

// Recommended cache keys and TTLs:
// - benefit-programs: 86400 (24 hours - rarely changes)
// - policy-documents: 3600 (1 hour)
// - user-profile: 300 (5 minutes)
// - search-results: 1800 (30 minutes)
// - gemini-embeddings: 86400 (24 hours - deterministic)
```

**Verify caching is working:**
- Check cache hit rates in application logs
- Monitor response time improvements on cached endpoints
- Test cache invalidation on data updates

### Bundle Optimization

- [ ] Enable gzip/brotli compression
- [ ] Implement code splitting (React.lazy, dynamic imports)
- [ ] Tree-shake unused dependencies
- [ ] Optimize bundle with Vite production build
- [ ] Lazy load non-critical components
- [ ] Use CDN for static assets

```bash
# Analyze bundle size
npm run build
npx vite-bundle-visualizer
```

---

## Monitoring & Logging

### Application Logging

Configure structured logging:

```typescript
// server/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'md-benefits-navigator' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

### Health Check Endpoint

```typescript
// server/routes.ts
app.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'OK',
    checks: {
      database: 'unknown',
      gemini: 'unknown',
      storage: 'unknown',
    },
  };

  try {
    // Database check
    await db.execute(sql`SELECT 1`);
    health.checks.database = 'OK';
  } catch (error) {
    health.checks.database = 'ERROR';
    health.status = 'DEGRADED';
  }

  // Add Gemini API check, storage check, etc.

  res.status(health.status === 'OK' ? 200 : 503).json(health);
});
```

### Metrics to Track

- [ ] Request rate (requests/second)
- [ ] Response times (p50, p95, p99)
- [ ] Error rate (4xx, 5xx responses)
- [ ] Database connection pool usage
- [ ] Cache hit/miss ratio
- [ ] Gemini API latency and token usage
- [ ] Active user sessions
- [ ] Document processing queue length

### Error Tracking

Integrate error tracking service (e.g., Sentry):

```typescript
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
  });

  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.errorHandler());
}
```

---

## Post-Deployment Verification

### Smoke Tests

Run immediately after deployment:

- [ ] Homepage loads correctly
- [ ] User can log in with demo credentials
- [ ] Policy search returns results
- [ ] Document upload works
- [ ] Navigator workspace accessible
- [ ] Admin dashboard loads
- [ ] Notification center functional
- [ ] API health check returns 200

### Functional Validation

**All 7 Maryland Benefit Programs:**
- [ ] **SNAP (Food Supplement)**: Policy search, RAG citations, PolicyEngine calculations
- [ ] **Medicaid (Medical Assistance)**: Document search, eligibility rules extraction
- [ ] **TANF (TCA)**: Policy search, benefit calculations
- [ ] **OHEP (Energy Assistance)**: MEAP/EUSP program rules, seasonal updates
- [ ] **WIC (Women, Infants, Children)**: Nutrition program rules, income limits
- [ ] **MCHP (Children's Health)**: Age-based eligibility, premium calculations
- [ ] **VITA (Tax Assistance)**: IRS Pub 4012 search, EITC/CTC rules

**Core Functionality:**
- [ ] Policy search returns accurate results for all programs
- [ ] RAG citations link to correct document sections
- [ ] Document upload to Google Cloud Storage works
- [ ] Navigator workspace session tracking functional
- [ ] Admin tools accessible (audit logs, feedback management, compliance)
- [ ] Notification system delivers alerts
- [ ] Policy change diff detection working
- [ ] Role-based access control (applicant, navigator, caseworker, admin)

### Performance Validation

- [ ] Run load test (e.g., Apache Bench, Artillery)
- [ ] Monitor response times for 10 minutes
- [ ] Check database query performance
- [ ] Verify cache hit rates
- [ ] Monitor memory usage (should be stable)
- [ ] Check for memory leaks

### Security Validation

- [ ] SSL certificate valid and up-to-date
- [ ] HTTPS redirect working
- [ ] Security headers present (check securityheaders.com)
- [ ] Rate limiting functional
- [ ] CSRF protection working
- [ ] Authentication working correctly

---

## Rollback Procedures

### Database Rollback

```bash
# If using migration files (manual migrations)
# Revert last migration
npm run db:rollback

# If using db:push (no migration files)
# Restore from backup
psql $DATABASE_URL < backups/pre_deployment_backup.sql
```

### Application Rollback

**Replit Deployment:**
1. Go to Replit Deployments tab
2. Select previous stable deployment
3. Click "Promote to production"

**Manual Deployment:**
```bash
# Git revert to previous commit
git revert HEAD
git push origin main

# Or reset to previous tag
git reset --hard <previous-tag>
git push --force origin main

# Restart application
pm2 restart md-benefits-navigator
```

### Rollback Checklist

- [ ] Notify team of rollback
- [ ] Stop incoming traffic (maintenance mode)
- [ ] Restore database from backup
- [ ] Revert application code
- [ ] Restart application services
- [ ] Verify rollback successful (smoke tests)
- [ ] Resume traffic
- [ ] Post-mortem: document what went wrong

---

## Additional Resources

- [Replit Deployment Docs](https://docs.replit.com/hosting/deployments/about-deployments)
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)
- [Express.js Production Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Node.js Production Checklist](https://github.com/goldbergyoni/nodebestpractices)

---

## Deployment Sign-Off

- [ ] **Developer:** Code reviewed and tested
- [ ] **QA:** All test cases passed
- [ ] **DevOps:** Infrastructure configured
- [ ] **Security:** Security audit completed
- [ ] **Product Owner:** Feature approval
- [ ] **Deployment Lead:** Final approval to deploy

**Deployment Date:** _________________  
**Deployed By:** _________________  
**Deployment Notes:** _________________
