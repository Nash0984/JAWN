# JAWN Production Readiness Roadmap
**Maryland Universal Benefits-Tax Service**  
**Created:** October 22, 2025  
**Status:** Active Living Document  
**Governance:** Evidence-Based Planning with Quarterly Reviews  
**Reference:** "production roadmap" or "readiness roadmap"

---

## 📋 Executive Summary

This roadmap consolidates verified production-readiness tasks for the Joint Access Welfare Network (JAWN), Maryland's unified benefits-tax platform serving all 24 Maryland LDSS offices. Unlike traditional roadmaps, this document is **evidence-based** - all tasks are derived from actual system telemetry, error logs, and verification testing rather than speculative optimization.

**Total Pre-Launch Time:** 30-35 hours (down from 60-85 hours via verification-first approach)  
**Critical Path:** Fix BAR SQL bug → Production config → Database completeness → Testing & hardening  
**Post-Launch:** Quarterly reviews with real traffic profiling guide optimization priorities

---

## 🎯 Roadmap Principles

### 1. Evidence-Based Planning
- ✅ All tasks verified against actual logs, health checks, and profiling data
- ✅ Removed 90+ tasks for non-existent issues (tenant errors, slow requests, speculative optimizations)
- ✅ Deferred technical debt and feature enhancements to post-launch quarterly reviews

### 2. Government-Grade Standards
- ✅ WCAG 2.1 AA accessibility compliance
- ✅ GDPR/HIPAA compliance frameworks implemented
- ✅ Production security hardening (encryption, rate limiting, sanitization)
- ✅ 99.9% uptime SLA capability with monitoring and backup systems

### 3. Minimal Surface Area for Launch
- ✅ Launch with verified working features only
- ✅ Profile performance under real traffic before optimization
- ✅ Defer non-critical enhancements (voice UI, SMS preferences, admin analytics charts)

---

## 📊 Current System Health (October 22, 2025)

### ✅ Verified Working Systems
- **Smart Scheduler:** Non-blocking initialization, 5 active schedules, 97% performance improvement
- **Database:** Healthy (24ms latency), connection pooling active
- **Redis:** Fallback mode (L1 cache only - acceptable in dev, needs Upstash for production)
- **WebSocket:** Healthy real-time monitoring service
- **Gemini API:** Configured and operational
- **Performance:** Subsequent requests ~200ms (excellent)

### ⚠️ Known Issues
1. **BAR SQL Error** (P0 Critical): Line 515 `barNotification.service.ts` - invalid join on non-existent `clientCases.userId`
2. **Production Config** (P1 Required): 6 environment variables need production values

### 🎉 Recent Completions
- **Phase 3A Complete** (October 21-22, 2025): Smart Scheduler optimization - 97% improvement (10s → 208ms)
- **Health Check System** (October 22, 2025): Multi-service monitoring with degradation states

---

## 🗂️ Roadmap Structure

This roadmap organizes work across **4 Phases** and **8 Workstreams**, with phase-gated exit criteria:

### Phases
- **Phase 0:** Foundational Platform Stability (Critical bugs, infrastructure)
- **Phase 1:** Performance & Reliability (Profiling-based optimization)
- **Phase 2:** Operational Excellence (Testing, security, compliance)
- **Phase 3:** Innovation & Continuous Improvement (Post-launch)

### Workstreams
1. **Platform Core** - Critical functionality, database integrity
2. **Performance Engineering** - Evidence-based optimization
3. **QA & Testing** - E2E coverage, accessibility
4. **Security & Compliance** - Hardening, WCAG, GDPR/HIPAA
5. **Data & AI Validation** - Gemini Vision, cross-enrollment, RAG
6. **User Experience** - Accessibility, internationalization
7. **Operations & Resilience** - Monitoring, backup, recovery
8. **Innovation Enablement** - Post-launch features, technical debt

---

## 📅 Phase 0: Foundational Platform Stability
**Timeline:** Week 1 (October 23-29, 2025)  
**Total Effort:** 8-10 hours  
**Priority:** P0 Critical  
**Exit Criteria:** Zero blocking bugs, production environment configured

### Workstream 1: Platform Core

#### Task 0.1.1: Fix BAR SQL Syntax Error ⚠️ CRITICAL
- **ID:** `JAWN-2025-001`
- **Priority:** P0 (Blocking)
- **Effort:** 30 minutes
- **Status:** Open
- **Evidence:** Log error "syntax error at or near =" in checkpoint notification query
- **Root Cause:** Invalid join on non-existent column `clientCases.userId` (should be `createdBy` or `assignedNavigator`)
- **File:** `server/services/barNotification.service.ts` Line 515
- **Fix Required:**
  ```typescript
  // BEFORE (Line 515 - BROKEN):
  .innerJoin(users, eq(clientCases.userId, users.id))
  
  // AFTER (FIXED):
  .innerJoin(users, eq(clientCases.createdBy, users.id))
  // OR, if notifications should go to assigned navigator:
  .innerJoin(users, eq(clientCases.assignedNavigator, users.id))
  ```
- **Validation:** Test BAR notification workflow end-to-end, verify no SQL errors in logs
- **Dependencies:** None
- **Owner:** Build Agent
- **Impact:** BAR checkpoint notifications currently failing silently

#### Task 0.1.2: Production Environment Configuration
- **ID:** `JAWN-2025-002`
- **Priority:** P1 (Required for launch)
- **Effort:** 2 hours
- **Status:** Open
- **Variables to Configure:**
  ```bash
  # Encryption
  ENCRYPTION_KEY=<production-256-bit-key>  # Replace dev key
  
  # Redis Distributed Cache
  REDIS_URL=<upstash-redis-url>  # Enable L2 cache
  # OR
  UPSTASH_REDIS_REST_URL=<url>
  UPSTASH_REDIS_REST_TOKEN=<token>
  
  # Email Notifications
  SMTP_HOST=<smtp-server>
  SMTP_PORT=<port>
  SMTP_USER=<username>
  SMTP_PASS=<password>
  SMTP_FROM_EMAIL=noreply@marylandbenefits.gov
  
  # Error Tracking
  SENTRY_DSN=<sentry-project-dsn>
  
  # Object Storage
  GCP_SERVICE_ACCOUNT_KEY=<base64-json-key>
  GCS_BUCKET_NAME=<production-bucket>
  ```
- **Validation:** Health endpoint returns "healthy" for all services
- **Dependencies:** Task 0.1.1
- **Owner:** User + Build Agent
- **Impact:** Production deployment blocked without these

#### Task 0.1.3: Database Schema Completeness
- **ID:** `JAWN-2025-003`
- **Priority:** P1 (Required for AI features)
- **Effort:** 2 hours
- **Status:** Open
- **Tables to Create:**
  - `crossEnrollmentPredictions` - ML-based benefit predictions
  - `fraudDetectionAlerts` - Pattern analysis alerts
  - `aiUsageLogs` - AI cost tracking metrics
- **Evidence:** Code references these tables but they don't exist in schema
- **Implementation:**
  1. Add table definitions to `shared/schema.ts`
  2. Add Zod validation schemas (insert/select)
  3. Update `server/storage.ts` interface if needed
  4. Run `npm run db:push --force` to sync
- **Validation:** Query tables successfully, no relation errors
- **Dependencies:** Task 0.1.2
- **Owner:** Build Agent

#### Task 0.1.4: Update Browserslist Data
- **ID:** `JAWN-2025-004`
- **Priority:** P2 (Nice to have)
- **Effort:** 5 minutes
- **Status:** Open
- **Command:** `npx update-browserslist-db@latest`
- **Evidence:** Browserslist data 12 months outdated
- **Impact:** Ensures optimal browser compatibility transpilation
- **Dependencies:** None
- **Owner:** Build Agent

### Phase 0 Exit Criteria
- ✅ Zero blocking bugs in error logs
- ✅ All production environment variables configured
- ✅ Health endpoint returns "healthy" status
- ✅ Database schema complete for AI features
- ✅ BAR notification workflow tested end-to-end

---

## 📅 Phase 1: Performance & Reliability
**Timeline:** Post-Launch (Quarterly Reviews)  
**Total Effort:** 4-6 hours (after profiling with real traffic)  
**Priority:** P2 (Deferred)  
**Entry Criteria:** Phase 0 complete, production traffic for 30 days

### Workstream 2: Performance Engineering

#### Task 1.2.1: Production Performance Profiling
- **ID:** `JAWN-2025-010`
- **Priority:** P2 (Post-launch only)
- **Effort:** 2 hours
- **Status:** Deferred
- **Deferred Reason:** Current performance excellent (~200ms). Profile with real traffic first.
- **Actions:**
  1. Enable APM monitoring (Sentry Performance)
  2. Collect 30 days of production traffic metrics
  3. Identify actual slow endpoints (>500ms p95)
  4. Profile database query patterns
  5. Measure PolicyEngine API latency distribution
- **Success Metrics:**
  - Identify top 10 slowest endpoints
  - Database slow query log (>100ms)
  - PolicyEngine API p95 latency
- **Dependencies:** Phase 0 complete, production deployment
- **Owner:** Operations Team

#### Task 1.2.2: Database Index Optimization
- **ID:** `JAWN-2025-011`
- **Priority:** P2 (Evidence-dependent)
- **Effort:** 1-2 hours
- **Status:** Deferred
- **Trigger:** Slow query log identifies missing indexes
- **Evidence Required:** Actual slow queries from production profiling
- **Implementation:** Add indexes to identified slow queries only
- **Dependencies:** Task 1.2.1
- **Owner:** Build Agent

#### Task 1.2.3: Redis Distributed Caching Optimization
- **ID:** `JAWN-2025-012`
- **Priority:** P2 (Evidence-dependent)
- **Effort:** 1-2 hours
- **Status:** Deferred
- **Current State:** L1 cache (NodeCache) works well
- **Trigger:** Cache hit rate <70% or high cache latency
- **Actions:**
  1. Analyze cache hit/miss rates from metrics
  2. Optimize cache key strategies
  3. Tune TTL values based on data staleness tolerance
- **Dependencies:** Task 0.1.2 (Redis configured), Task 1.2.1 (profiling)
- **Owner:** Build Agent

#### Task 1.2.4: PolicyEngine API Optimization
- **ID:** `JAWN-2025-013`
- **Priority:** P2 (Evidence-dependent)
- **Effort:** 1-2 hours
- **Status:** Deferred
- **Trigger:** PolicyEngine API latency >1000ms p95
- **Actions:**
  1. Implement request batching (10 households in 1 call)
  2. Add response caching with intelligent invalidation
  3. Add circuit breaker for API failures
- **Dependencies:** Task 1.2.1
- **Owner:** Build Agent

### Phase 1 Exit Criteria
- ✅ Production profiling data collected (30 days)
- ✅ <500ms p95 API response time
- ✅ <100ms database query p95
- ✅ >90% cache hit rate (if cache optimization needed)
- ✅ PolicyEngine API p95 <1000ms

---

## 📅 Phase 2: Operational Excellence & Compliance
**Timeline:** Week 2 (October 30 - November 5, 2025)  
**Total Effort:** 20-25 hours  
**Priority:** P1 (Required for launch)  
**Exit Criteria:** WCAG compliance, critical flows tested, production hardened

### Workstream 3: QA & Testing

#### Task 2.3.1: E2E Test Coverage - Critical Flows
- **ID:** `JAWN-2025-020`
- **Priority:** P1 (Required)
- **Effort:** 10-12 hours
- **Status:** Open
- **Test Flows (Playwright):**
  1. **SNAP Application Submission** - Full applicant workflow from intake to submission
  2. **Tax Preparation + E-Filing** - Federal 1040 + Maryland 502 PDF generation and submission
  3. **BAR Supervisor Review** - Case sampling, AI quality assessment, supervisor review dashboard
  4. **Cross-Enrollment Predictions** - ML recommendations for unclaimed benefits
  5. **Document Upload + AI Extraction** - W-2/pay stub upload with Gemini Vision OCR validation
- **Success Criteria:**
  - All 5 flows complete without errors
  - Screenshots captured for each critical step
  - Test database data cleanup after each run
- **Dependencies:** Phase 0 complete
- **Owner:** Build Agent

#### Task 2.3.2: Accessibility Audit & Remediation
- **ID:** `JAWN-2025-021`
- **Priority:** P1 (WCAG 2.1 AA compliance required)
- **Effort:** 4-6 hours
- **Status:** Open
- **Actions:**
  1. Run `npm run test:accessibility` (scripts/accessibility-audit-puppeteer.ts)
  2. Fix all **CRITICAL** severity violations (blocking issues)
  3. Fix all **SERIOUS** severity violations
  4. Fix **MODERATE** violations on public-facing pages (applicant portal, policy search)
  5. Add ARIA labels to interactive elements missing them
  6. Test keyboard navigation (Tab, Enter, Escape) across major workflows
  7. Verify form field labeling and error announcements
- **Success Metrics:**
  - Zero critical/serious violations
  - <5 moderate violations on public pages
  - 100% keyboard navigability for critical flows
- **Dependencies:** Phase 0 complete
- **Owner:** Build Agent
- **Compliance:** Maryland DHS accessibility requirements

#### Task 2.3.3: CI/CD Pipeline Integration
- **ID:** `JAWN-2025-022`
- **Priority:** P2 (Nice to have)
- **Effort:** 2-3 hours
- **Status:** Deferred
- **Actions:**
  1. GitHub Actions workflow for automated E2E tests
  2. Automated accessibility audit on PR
  3. Security scanning (npm audit, Snyk)
  4. Lighthouse performance benchmarking
- **Dependencies:** Task 2.3.1, Task 2.3.2
- **Owner:** Build Agent

### Workstream 4: Security & Compliance

#### Task 2.4.1: Production Hardening Checklist
- **ID:** `JAWN-2025-030`
- **Priority:** P1 (Required)
- **Effort:** 3-4 hours
- **Status:** Open
- **Checklist:**
  - [ ] SSL/TLS certificates configured and valid (verify HTTPS redirect)
  - [ ] CORS settings reviewed (whitelist production domains only)
  - [ ] Rate limiting validated under load (100 req/min per IP)
  - [ ] All logging sanitized (no PII in logs - audit logger.service.ts)
  - [ ] Secret keys stored securely (verify .env not committed)
  - [ ] Database backup schedule verified (Neon PITR enabled)
  - [ ] Monitoring alerts configured (Sentry, health checks)
  - [ ] PM2 cluster mode configured (4 workers)
  - [ ] Graceful shutdown tested (SIGTERM handling)
  - [ ] Health check endpoints return correct status (200/503/207)
  - [ ] WebSocket connections work (test with load balancer if applicable)
- **Success Criteria:** All checklist items verified
- **Dependencies:** Phase 0 complete
- **Owner:** Build Agent + User Review

#### Task 2.4.2: Security Scan
- **ID:** `JAWN-2025-031`
- **Priority:** P1 (Required)
- **Effort:** 30 minutes
- **Status:** Open
- **Commands:**
  ```bash
  npm audit --production
  npm audit fix --production
  # Review and fix high/critical vulnerabilities
  ```
- **Success Criteria:** Zero high/critical vulnerabilities
- **Dependencies:** None
- **Owner:** Build Agent

### Workstream 5: Data & AI Validation

#### Task 2.5.1: AI Services End-to-End Testing
- **ID:** `JAWN-2025-040`
- **Priority:** P1 (Validate AI features work)
- **Effort:** 6-8 hours
- **Status:** Open
- **Test Scenarios:**
  1. **Gemini Vision Document Extraction:**
     - Upload sample W-2 → Verify all fields extracted (employer, wages, withholding)
     - Upload sample pay stub → Verify income, YTD totals extracted
     - Upload sample utility bill → Verify address, amount, due date captured
     - Validate extraction accuracy >90%
  2. **Cross-Enrollment Predictions:**
     - Create test household → Verify ML predictions generate
     - Validate confidence scores (0-100 scale)
     - Test benefit recommendation logic (SNAP + Medicaid)
  3. **Smart RAG Policy Search:**
     - Query "What are SNAP income limits for Maryland?" → Verify relevant results
     - Test multi-language queries (Spanish, Chinese, Korean)
     - Validate citation accuracy and source tracking
  4. **AI Cost Tracking:**
     - Verify usage metrics logged to `aiUsageLogs` table
     - Check cost calculations (tokens × pricing)
  5. **Emergency Fast-Track Detection:**
     - Create urgent case (homeless, no income) → Verify flagged for expedited processing
  6. **Fraud Detection Pipeline:**
     - Create suspicious pattern (duplicate SSN, inconsistent income) → Verify alert triggered
- **Success Criteria:**
  - All AI features tested without errors
  - Document extraction >90% accuracy
  - Cost tracking logs populated
- **Dependencies:** Task 0.1.3 (database tables), Task 0.1.2 (Gemini API configured)
- **Owner:** Build Agent

### Workstream 6: User Experience & Accessibility

#### Task 2.6.1: Multi-Language Validation
- **ID:** `JAWN-2025-050`
- **Priority:** P2 (Nice to have)
- **Effort:** 1-2 hours
- **Status:** Deferred
- **Actions:**
  1. Test language switcher (English → Spanish → Chinese → Korean)
  2. Verify all UI strings localized
  3. Test RTL layout for Arabic (if supported)
- **Dependencies:** None
- **Owner:** Build Agent

### Workstream 7: Operations & Resilience

#### Task 2.7.1: Backup & Recovery Validation
- **ID:** `JAWN-2025-060`
- **Priority:** P1 (Required)
- **Effort:** 1-2 hours
- **Status:** Open
- **Actions:**
  1. Verify Neon Database PITR enabled (30-day retention)
  2. Test point-in-time recovery (restore to 24 hours ago)
  3. Document restore procedure for operations team
  4. Verify object storage backup (GCS versioning enabled)
- **Success Criteria:**
  - Database restore tested successfully
  - Restore procedure documented
  - RTO <1 hour, RPO <1 hour
- **Dependencies:** Task 0.1.2 (production config)
- **Owner:** Build Agent + User Review

#### Task 2.7.2: Monitoring & Alerting Configuration
- **ID:** `JAWN-2025-061`
- **Priority:** P1 (Required)
- **Effort:** 1-2 hours
- **Status:** Open
- **Actions:**
  1. Configure Sentry alerts (error rate >10/min, new error types)
  2. Configure health check monitoring (external uptime service)
  3. Test alert delivery (email, SMS, PagerDuty)
  4. Document on-call runbook
- **Dependencies:** Task 0.1.2 (Sentry DSN configured)
- **Owner:** Build Agent + User Review

### Phase 2 Exit Criteria
- ✅ 5 critical E2E flows tested and passing
- ✅ Zero critical/serious accessibility violations
- ✅ All production hardening checklist items verified
- ✅ Zero high/critical npm vulnerabilities
- ✅ AI services validated end-to-end
- ✅ Backup & recovery tested
- ✅ Monitoring alerts configured and tested

---

## 📅 Phase 3: Innovation & Continuous Improvement
**Timeline:** Post-Launch (Quarterly)  
**Priority:** P3 (Deferred)  
**Entry Criteria:** Production launch complete, 90 days of operational data

### Workstream 8: Innovation Enablement

#### Task 3.8.1: Few-Shot Training UI
- **ID:** `JAWN-2025-070`
- **Priority:** P3 (Post-launch)
- **Effort:** 8-10 hours
- **Status:** Deferred
- **Features:**
  - Admin interface for uploading training examples (W-2s, 1099s, benefit forms)
  - Labeling interface with form validation
  - Version control for training examples
  - Accuracy tracking dashboard (per-use-case metrics)
  - A/B testing for prompt templates
- **Dependencies:** Phase 2 complete, production data available
- **Owner:** Build Agent

#### Task 3.8.2: Technical Debt Review
- **ID:** `JAWN-2025-071`
- **Priority:** P3 (Post-launch)
- **Effort:** 10-15 hours
- **Status:** Deferred
- **Actions:**
  1. Audit 115 TODO/FIXME comments (defer until post-launch)
  2. Consolidate duplicate code (manualDocumentExtractor vs UnifiedDocumentService)
  3. Merge redundant rate limiter logic
  4. Clarify separation between aiIntakeAssistant vs conversationalAI services
- **Dependencies:** Phase 2 complete
- **Owner:** Build Agent

#### Task 3.8.3: Advanced Features Roadmap
- **ID:** `JAWN-2025-072`
- **Priority:** P3 (Post-launch)
- **Effort:** 15-20 hours
- **Status:** Deferred
- **Features:**
  - Voice assistant interface (currently placeholder)
  - SMS notification preferences UI
  - Admin monitoring charts connected to real data
  - User profile settings enhancements
  - Avatar upload functionality
  - Notification history viewer
- **Dependencies:** Phase 2 complete, user feedback
- **Owner:** Build Agent

### Phase 3 Exit Criteria
- ✅ Training UI deployed and in use
- ✅ Technical debt reduced by 50%
- ✅ Advanced features prioritized based on user feedback
- ✅ Quarterly review cadence established

---

## 📈 Success Metrics & Telemetry

### Pre-Launch KPIs (Phase 0-2)
- ✅ **Zero blocking bugs** in production logs
- ✅ **<500ms p95** API response time
- ✅ **99.9% uptime** demonstrated in staging
- ✅ **WCAG 2.1 AA** compliance (zero critical/serious violations)
- ✅ **100% E2E coverage** for critical flows (5 flows)
- ✅ **Zero high/critical** npm vulnerabilities
- ✅ **All production hardening** checklist items verified

### Post-Launch KPIs (Phase 1 & 3)
- ✅ **<500ms p95** API response time under production load
- ✅ **99.9% uptime** SLA
- ✅ **>90% AI extraction** accuracy (document intelligence)
- ✅ **>80% cache hit rate** (Redis distributed cache)
- ✅ **<1 hour RTO/RPO** (disaster recovery)
- ✅ **<1% error rate** (Sentry monitoring)

### Health Scorecard (Quarterly Review)

| Domain | Metric | Target | Current | Status |
|--------|--------|--------|---------|--------|
| **Performance** | API p95 latency | <500ms | ~200ms | ✅ Healthy |
| **Performance** | Database query p95 | <100ms | 24ms | ✅ Healthy |
| **Reliability** | Uptime SLA | 99.9% | TBD | 🟡 Pending |
| **Security** | Critical vulnerabilities | 0 | TBD | 🟡 Pending |
| **Accessibility** | WCAG violations | 0 critical | TBD | 🟡 Pending |
| **Quality** | E2E test coverage | 100% critical | 0% | 🔴 Open |
| **AI** | Document extraction | >90% | TBD | 🟡 Pending |
| **Operations** | Mean time to recovery | <1 hour | TBD | 🟡 Pending |

---

## 🔄 Governance & Review Process

### Weekly Standups (During Active Development)
- **Cadence:** Every Monday 9 AM ET
- **Attendees:** Build Agent, Product Owner, Technical Lead
- **Agenda:**
  - Review phase progress (% tasks complete)
  - Discuss blockers and dependencies
  - Adjust priorities based on findings
  - Review health scorecard metrics

### Quarterly Roadmap Reviews (Post-Launch)
- **Cadence:** Every 90 days
- **Attendees:** Full team + stakeholders
- **Agenda:**
  1. Review telemetry data (30 days production traffic)
  2. Identify evidence-based optimization opportunities
  3. Prioritize Phase 1 & Phase 3 tasks
  4. Update health scorecard
  5. Adjust success metrics based on real-world usage
- **Deliverables:**
  - Updated roadmap with new priorities
  - Performance profiling report
  - Technical debt assessment
  - Feature backlog prioritization

### Emergency Exception Process
- **Trigger:** Production incident, critical security vulnerability, regulatory requirement
- **Authority:** Technical Lead can fast-track tasks outside normal phase sequence
- **Documentation:** All exceptions logged in roadmap with justification

---

## 📝 Change Log

### October 22, 2025 - Initial Roadmap
- **Created:** Consolidated PRODUCTION_READINESS_ROADMAP.md
- **Completed Phase 3A:** Smart Scheduler optimization (97% improvement, 10s → 208ms)
- **Verified System Health:** 1 critical bug (BAR SQL), 6 production config items
- **Filtered Tasks:** Removed 90+ speculative tasks, reduced scope to 30-35 hours
- **Structure:** 4 phases, 8 workstreams, evidence-based prioritization

### Future Updates
- Track phase completions here
- Document major findings from quarterly reviews
- Log emergency exceptions and rationale

---

## 📚 References

- **System Architecture:** `replit.md`
- **Historical Context:** `ARCHIVE_2025_FINALIZATION_ROADMAP.md` (old roadmap)
- **Verification Report:** `/tmp/verification_findings.md` (verification evidence)
- **Health Endpoint:** `GET /api/health` (real-time system status)
- **Accessibility Audit:** `npm run test:accessibility`
- **E2E Tests:** `npm run test:e2e`

---

**Document Owner:** Build Agent  
**Last Updated:** October 22, 2025  
**Next Review:** After Phase 0 completion  
**Status:** Active - Phase 0 in progress
