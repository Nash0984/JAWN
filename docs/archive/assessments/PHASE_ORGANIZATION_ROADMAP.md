# Phase Organization Roadmap - Agent Requirements & Implementation Strategy
**Date:** October 20, 2025 (Updated with Phase A Re-Audit Results)  
**Compiled From:** Feature Audit, Phase A Evidence Collection, E-Filing Status, Competitive Gap Analysis  
**Total Phases:** 8 (7 future + 1 completed infrastructure phase)

---

## Overview

This document organizes all JAWN development work into 8 phases. **Phase -1 documents already-complete infrastructure** discovered in the Phase A re-audit (October 20, 2025). Remaining phases (0-6) organize future work grouped by:
- **Technical similarity** (e.g., all Twilio integrations together)
- **Dependency sequencing** (e.g., EBT balance tracking before spending insights)
- **Resource efficiency** (e.g., batch all multi-state work together)

### Phase Timing Summary
| Phase | Name | Status | Duration | Features | Autonomy Level |
|-------|------|--------|----------|----------|----------------|
| **-1** | **Enterprise Infrastructure** | ✅ **COMPLETE** | N/A (Already done) | 16 features | N/A |
| **0** | Foundation Completion | 🔄 Ready to start | 1-2 weeks | 3 tasks | **HIGH** |
| **1** | EBT Ecosystem Entry | ⏳ Pending | 8-12 weeks | 3 features | **MEDIUM** |
| **2** | Multi-Channel Communications | ⏳ Pending | 6-8 weeks | 2 features | **MEDIUM** |
| **3** | Geographic Scaling (50-State) | ⏳ Pending | 12-24 weeks | 1 mega-feature | **LOW** |
| **4** | Marketplace & Revenue | ⏳ Pending | 8-12 weeks | 2 features | **MEDIUM** |
| **5** | Organizational Support & SSI | ⏳ Pending | 12-16 weeks | 2 features | **MEDIUM** |
| **6** | Legislative AI & Analytics | ⏳ Pending | 4-6 weeks | 1 feature | **HIGH** |

**Future Work Timeline:** 51-80 weeks (12-18 months)  
**Current Platform Status:** 109 features complete (108 operational + 1 planned)

---

## Phase -1: Enterprise Infrastructure ✅ COMPLETE
**Status:** ✅ **ALREADY COMPLETE** (Discovered in Phase A Re-Audit - October 20, 2025)  
**Implementation Date:** Pre-October 2025 (exact dates unknown)  
**Total Features:** 16 (10 compliance + 6 infrastructure)

### **Discovery Context**

During the Phase A re-audit on October 20, 2025, a systematic verification of enterprise compliance and infrastructure capabilities revealed **16 fully-implemented features** that were operational but not documented in the original 93-feature inventory. This represents significant production-ready infrastructure that enhances the platform's enterprise readiness.

---

### **Enterprise Compliance Features (10/10 - 100% Complete) ✅**

#### **GDPR Compliance (5 features)**
1. **Consent Management** - Article 6 & 7 compliance with purpose-specific consent tracking
   - Database: `gdprConsents` table (942 lines of service code)
   - API: `/api/gdpr/consent` (POST, DELETE, GET, PUT)
   - Features: Withdraw consent, expiration tracking, IP/user agent logging, audit trails

2. **Data Subject Rights** - 30-day deadline enforcement for access, erasure, portability, rectification
   - Database: `gdprDataSubjectRequests` table
   - API: `/api/gdpr/data-subject-request` (POST, GET, PUT, export)
   - Features: Automated JSON export, cascade deletion, email notifications

3. **Data Processing Activities Register (ROPA)** - Article 30 compliance
   - Database: `gdprDataProcessingActivities` table
   - API: `/api/gdpr/processing-activities` (CRUD)
   - Features: Purpose tracking, retention periods, legal basis documentation

4. **Privacy Impact Assessments (DPIA)** - Article 35 high-risk processing
   - Database: `gdprPrivacyImpactAssessments` table
   - API: `/api/gdpr/privacy-impact-assessments` (CRUD)
   - Features: Risk classification (low/medium/high/critical), mitigation measures

5. **Breach Notification (72-Hour)** - Article 33 compliance
   - Database: `gdprBreachIncidents` table
   - API: `/api/gdpr/breach-incidents` (POST, GET, PUT, notify)
   - Features: Automated deadline alerts (48hr, 60hr), dual notification (supervisory authority + individuals)

#### **HIPAA Compliance (5 features)**
6. **PHI Access Logging** - Comprehensive audit trail with Minimum Necessary enforcement
   - Database: `hipaaPhiAccessLogs` table (501 lines of service code)
   - API: `/api/hipaa/phi-access-logs` (GET, POST, flag, review)
   - Features: Field-level tracking, suspicious access flagging, admin review workflow

7. **Business Associate Agreements Tracking** - BAA lifecycle management
   - Database: `hipaaBusinessAssociateAgreements` table
   - API: `/api/hipaa/business-associate-agreements` (CRUD, audit, expiring)
   - Features: Expiration alerts (30/60/90 days), audit results tracking

8. **Security Risk Assessments (SRA)** - Security Rule § 164.308(a)(1)
   - Database: `hipaaRiskAssessments` table
   - API: `/api/hipaa/risk-assessments` (CRUD, schedule, export)
   - Features: Annual scheduling, JSONB findings storage, HHS OCR export

9. **Security Incident Management** - Breach threshold detection (>500 individuals)
   - Database: `hipaaSecurityIncidents` table
   - API: `/api/hipaa/security-incidents` (CRUD, evaluate, notify HHS, notify media)
   - Features: Automatic breach determination, dual notification workflow

10. **Audit Logs (7-Year Retention)** - Tamper-proof PHI access records
    - Database: `hipaaAuditLogs` table
    - API: `/api/hipaa/audit-logs` (GET, POST, export, cleanup)
    - Features: Automated retention date calculation (timestamp + 7 years), scheduled cleanup

---

### **Production Infrastructure Features (6/6 - 100% Complete) ✅**

11. **Distributed Caching System (Redis/Upstash)** - L2 cache with automatic fallback
    - Service: `server/services/redisCache.ts` (473 lines)
    - Features: Upstash REST API support, pub/sub for cross-instance invalidation, automatic fallback to NodeCache, metrics tracking (hits/misses/errors)
    - Environment: Development (L1 only), Production (L1 + L2 Redis)

12. **Tiered Cache Architecture (L1/L2)** - Hierarchical cache orchestration
    - Service: `server/services/cacheOrchestrator.ts` (632 lines)
    - L1 (NodeCache): Process-local, ultra-fast access
    - L2 (Redis): Cross-instance sharing, persistent storage
    - Features: Multi-layer caching (embeddings 24hr, RAG 15min, PolicyEngine 1hr, sessions 30min), cache health reporting, cost savings tracking (60-80% for embeddings, 50-70% for RAG)

13. **PM2 Cluster Mode Deployment** - Production auto-scaling across all CPU cores
    - Config: `ecosystem.config.js` (195 lines, 3 processes)
    - Processes:
      - `jawn-api` (cluster mode, max CPU cores, 2GB max memory)
      - `jawn-worker` (2 instances, 1GB max memory, background jobs)
      - `jawn-scheduler` (1 instance, 500MB max memory, daily midnight restart)
    - Features: Auto-restart (max 10 restarts, min 10s uptime), graceful shutdown (5s kill timeout), zero-downtime deployments (`pm2 reload`), environment-specific configs (production/staging/development)
    - Production Settings: DB pooling (100 max, 10 min), Redis cluster mode, rate limiting (100 req/min standard, 1000 req/min admin), UV_THREADPOOL_SIZE=128

14. **Specialized Cache Services** - Domain-specific caches with optimized TTLs
    - Embedding Cache: `server/services/embeddingCache.ts` (24hr TTL, 60-80% cost reduction)
    - RAG Cache: `server/services/ragCache.ts` (15min TTL, 50-70% cost reduction)
    - PolicyEngine Cache: `server/services/policyEngineCache.ts` (1hr TTL, 50% API call reduction)
    - Document Analysis Cache: `server/services/documentAnalysisCache.ts` (24hr TTL, avoids re-processing)

15. **WebSocket Real-Time Service** - Real-time monitoring dashboard updates
    - Service: `server/services/websocket.service.ts` (345 lines)
    - Features: Session-based authentication (Passport.js), client connection management (userId → Set<WebSocket>), heartbeat monitoring (ping/pong), metrics broadcast (every 2 seconds), user-specific message routing
    - Integration: Admin monitoring dashboard for live metrics

16. **Unified Metrics Service (7 Observability Domains)** - Comprehensive platform monitoring
    - Service: `server/services/metricsService.ts` (1,063 lines)
    - Domains: Errors (tracking/rate trends), Security (events/threat detection), Performance (API/DB response times, P50/P90/P95/P99 percentiles), E-Filing (tax submission status), AI (API usage/costs), Cache (hit rates/performance), Health (system health checks)
    - API Endpoints: `/api/admin/monitoring/metrics`, `/api/admin/metrics/realtime`, `/api/admin/efile/metrics`, `/api/security/metrics`
    - Features: Parallel metric fetching, tenant filtering, time range queries (24hr default), trend analysis

---

### **Implementation Summary**

| Metric | Count | Details |
|--------|-------|---------|
| **Total Features** | 16 | 10 compliance + 6 infrastructure |
| **Database Tables** | 10 | 5 GDPR + 5 HIPAA |
| **Service Code** | 4,061 lines | gdpr.service.ts (942) + hipaa.service.ts (501) + redisCache.ts (473) + cacheOrchestrator.ts (632) + websocket.service.ts (345) + metricsService.ts (1,063) + specialized caches (105+) |
| **API Routes** | 701 lines | gdpr.routes.ts (418) + hipaa.routes.ts (283) |
| **PM2 Config** | 195 lines | 3 processes, production deployment config |
| **Production Status** | 100% operational | All features verified with complete database/API/services/monitoring |

---

### **Compliance Standards Met**

**GDPR (EU Data Protection):**
- ✅ Article 6 & 7 (Consent)
- ✅ Article 15 (Right to Access)
- ✅ Article 16 (Right to Rectification)
- ✅ Article 17 (Right to be Forgotten)
- ✅ Article 20 (Right to Data Portability)
- ✅ Article 30 (Register of Processing Activities)
- ✅ Article 33 (Breach Notification - 72 hours)
- ✅ Article 35 (Data Protection Impact Assessment)

**HIPAA (US Healthcare):**
- ✅ Security Rule § 164.308(a)(1) (Security Risk Assessments)
- ✅ Breach Notification Rule § 164.408 (>500 individuals = breach notification)
- ✅ Minimum Necessary Standard (excessive PHI access flagging)
- ✅ 7-Year Audit Log Retention (HIPAA requires minimum 6 years)
- ✅ Business Associate Agreement Management (third-party vendor tracking)

---

### **Production Readiness Impact**

This infrastructure enables:
- ✅ **European Market Entry** - GDPR compliance allows EU user acquisition
- ✅ **Healthcare Partnerships** - HIPAA compliance enables hospital/clinic integrations
- ✅ **Enterprise Sales** - Compliance infrastructure required for B2B contracts
- ✅ **Multi-Instance Scaling** - Distributed caching + PM2 cluster supports 5,000+ concurrent users
- ✅ **Cost Optimization** - 50-80% reduction in AI API costs through strategic caching
- ✅ **Regulatory Audits** - Complete audit trails + automated deadline tracking for supervisory authority inspections
- ✅ **Production Monitoring** - 7-domain metrics service + real-time WebSocket updates for operations team

**Reference Documentation:**
- Phase A Evidence Collection: `docs/PHASE_A_EVIDENCE_COLLECTION.md`
- Feature Catalog: `FEATURES.md` (Features #94-103, updated October 20, 2025)
- Audit Report: `docs/FEATURE_AUDIT_REPORT.md` (109 features verified)

---

## Phase 0: Foundation Completion (IMMEDIATE) 🏗️
**Priority:** CRITICAL  
**Duration:** 1-2 weeks  
**Status:** Ready to start immediately

### **Objectives**
Complete infrastructure that's 75-90% done but not exposed/connected:
1. E-filing API routes (code exists, routes commented out)
2. E-filing frontend UI (service layer ready)
3. Legislative Impact Analysis AI component (infrastructure exists)

---

### **Tasks**

#### **Task 0.1: Create E-Filing API Routes**
**Description:** Uncomment and implement server/api/efile.routes.ts to expose existing e-filing services

**Code Changes Required:**
- Create `server/api/efile.routes.ts` file
- Create `server/api/maryland-efile.routes.ts` file
- Uncomment route registration in `server/routes.ts` (lines 10875-10876)
- Implement 15 API endpoints:
  - `POST /api/efile/submit/:federalReturnId`
  - `GET /api/efile/status/:federalReturnId`
  - `POST /api/efile/retry/:federalReturnId`
  - `GET /api/efile/queue`
  - `POST /api/efile/validate/:federalReturnId`
  - `GET /api/efile/xml/:federalReturnId`
  - (+ 9 more from docs/EFILE_INFRASTRUCTURE_STATUS.md)

**Dependencies:**
- ✅ Database schema ready (efile columns in federal_tax_returns, maryland_tax_returns)
- ✅ Service layer ready (EFileQueueService, Form1040XmlGenerator, Form502XmlGenerator)
- ❌ API routes missing (this task)

**Testing Required:**
- Unit tests for each endpoint
- Integration tests with eFileQueueService
- XML generation tests

**Agent Requirements:**
- **Autonomy Level:** **HIGH** - Clear specifications in EFILE_INFRASTRUCTURE_STATUS.md
- **Power Mode:** No (straightforward API route implementation)
- **Web Search:** No (all specs documented)
- **Image Generation:** No

**Estimated Time:** 2-3 days  
**Files Modified:** 2-3 files (server/routes.ts, server/api/efile.routes.ts, server/api/maryland-efile.routes.ts)

---

#### **Task 0.2: Build E-Filing Frontend UI**
**Description:** Create React pages for e-file submission, status tracking, and admin dashboard

**Code Changes Required:**
- Create `client/src/pages/EFileSubmission.tsx`
- Create `client/src/pages/EFileStatus.tsx`
- Create `client/src/pages/admin/EFileAdminDashboard.tsx`
- Add routes to `client/src/App.tsx`
- Create UI components:
  - EFileSubmitButton
  - EFileStatusTracker
  - ValidationErrorDisplay
  - EFileQueueTable (admin)

**Dependencies:**
- ✅ API routes (Task 0.1 must complete first)
- ✅ shadcn/ui components available
- ✅ TanStack Query for data fetching

**Testing Required:**
- E2E tests with Playwright (submit flow, status updates)
- Accessibility tests (WCAG 2.1 AA minimum)

**Agent Requirements:**
- **Autonomy Level:** **HIGH** - Standard CRUD UI patterns
- **Power Mode:** No
- **Web Search:** No
- **Image Generation:** No

**Estimated Time:** 3-4 days  
**Files Modified:** 5-7 files (pages, components, routes)

---

#### **Task 0.3: Complete Legislative Impact Analysis AI**
**Description:** Implement AI analysis component for Feature #52 (infrastructure exists, AI logic missing)

**Code Changes Required:**
- Implement `server/services/legislativeImpactAnalysis.ts`
- Add Gemini AI prompts for bill impact analysis
- Connect to existing `federalBills` and `marylandBills` tables
- Create frontend component for displaying analysis results

**Dependencies:**
- ✅ Database tables exist (federalBills, marylandBills, policyDocuments)
- ✅ Gemini API configured
- ✅ Bill tracking service operational
- ❌ AI analysis logic missing (this task)

**Testing Required:**
- Test with sample bills (SNAP policy changes)
- Verify AI output quality (accuracy, readability)

**Agent Requirements:**
- **Autonomy Level:** **MEDIUM** - Requires AI prompt engineering
- **Power Mode:** **Yes** (AI model testing and iteration)
- **Web Search:** **Yes** (research legislative analysis best practices)
- **Image Generation:** No

**Estimated Time:** 4-5 days  
**Files Modified:** 3-4 files (service, frontend component, routes)

---

### **Phase 0 Summary**
| Metric | Value |
|--------|-------|
| **Total Tasks** | 3 |
| **Total Time** | 9-12 days (1.5-2 weeks) |
| **Total Files Modified** | 10-14 files |
| **Autonomy Level** | **HIGH** (2 tasks) + MEDIUM (1 task) |
| **Power Mode** | 1/3 tasks (Task 0.3 only) |
| **Web Search** | 1/3 tasks (Task 0.3 only) |
| **Image Generation** | 0/3 tasks |

**Outcome:** JAWN 95/95 features complete (100%), all existing infrastructure fully operational

---

## Phase 1: EBT Ecosystem Entry (COMPETITIVE PRIORITY) 💳
**Priority:** HIGH  
**Duration:** 8-12 weeks  
**Market Impact:** VERY HIGH (5M+ addressable users from Propel)

### **Objectives**
Build Propel-competitive features to capture post-approval EBT cardholders:
1. Real-time EBT balance checking
2. 12-month transaction history tracking
3. Spending insights & budget analytics
4. EBT security features (card locking, fraud alerts)

---

### **Feature 1.1: EBT Balance Tracking & Transaction History**
**Market Leader:** Propel (5M users)  
**Priority Rank:** #1 (from Competitive Gap Analysis)

**Description:** Integrate with state EBT portals (Quest, ebtEDGE, ConnectEBT, etc.) to provide real-time balance checking and transaction history for SNAP, WIC, TANF EBT cards.

**Code Changes Required:**
- Database schema:
  - Create `ebtAccounts` table (userId, cardNumber encrypted, state, ebtSystem, lastSynced)
  - Create `ebtTransactions` table (accountId, date, merchant, amount, balance, category)
  - Create `ebtBalances` table (accountId, snapBalance, wicBalance, tanfBalance, lastUpdated)
- Backend services:
  - `server/services/ebtPortalIntegration.ts` - State portal API connectors
  - `server/services/ebtTransactionParser.ts` - Parse state-specific transaction formats
  - `server/services/ebtBalanceSync.ts` - Scheduled sync service (every 4 hours)
  - `server/services/ebtEncryption.ts` - Encrypt card numbers, credentials
- API routes:
  - `POST /api/ebt/link-card` - Link EBT account (state, login, no PIN)
  - `GET /api/ebt/balance` - Get current balances
  - `GET /api/ebt/transactions` - Get transaction history (query params: startDate, endDate, limit)
  - `DELETE /api/ebt/unlink` - Remove linked account
- Frontend:
  - `client/src/pages/EBTManager.tsx` - Main EBT dashboard
  - `client/src/components/EBTBalanceCard.tsx` - Balance display widget
  - `client/src/components/EBTTransactionList.tsx` - Transaction history table
  - `client/src/components/EBTLinkForm.tsx` - Account linking wizard

**Dependencies:**
- **State EBT portal access** (BLOCKING) - Contact Maryland DHS for API access
- **OAuth/credential management** - Securely store state portal logins
- **Field-level encryption** - Already implemented in JAWN (AES-256-GCM)

**Testing Required:**
- Security testing (credential encryption, HTTPS only)
- Multi-state testing (Maryland, then expand to CA, NY, TX)
- Error handling (portal downtime, invalid credentials)
- E2E testing with Playwright (link card, view balance, check transactions)

**Agent Requirements:**
- **Autonomy Level:** **LOW** - Requires external API access negotiations, multiple state integrations
- **Power Mode:** **Yes** (iterative API integration testing)
- **Web Search:** **Yes** (research each state's EBT portal system: Quest, ebtEDGE, ConnectEBT, etc.)
- **Image Generation:** No

**Estimated Time:** 8-10 weeks (start with Maryland, add 1-2 weeks per additional state)  
**Files Modified:** 15-20 files (schema, services, routes, pages, components)

**Phased Rollout:**
1. **Week 1-2:** Database schema + encryption service
2. **Week 3-5:** Maryland EBT portal integration (Quest system)
3. **Week 6-7:** Frontend UI (balance display, transaction list)
4. **Week 8:** Testing, security audit, launch Maryland-only
5. **Weeks 9-10:** Add California, New York (if time permits)

---

### **Feature 1.2: Spending Insights & Budget Analytics**
**Market Leader:** Propel  
**Priority Rank:** #4 (from Competitive Gap Analysis)

**Description:** AI-powered spending pattern analysis, budget forecasting, and savings recommendations based on EBT transaction data.

**Code Changes Required:**
- Database schema:
  - Create `spendingInsights` table (userId, month, totalSpent, categoryBreakdown jsonb, forecast, recommendations jsonb)
  - Create `budgetAlerts` table (userId, alertType, threshold, isActive)
- Backend services:
  - `server/services/spendingAnalytics.ts` - Calculate spending patterns
  - `server/services/budgetForecaster.ts` - Predict benefit exhaustion date
  - `server/services/savingsRecommendations.ts` - AI-generated savings tips (Gemini)
  - `server/services/merchantCategorization.ts` - Classify transactions (grocery, convenience, pharmacy)
- API routes:
  - `GET /api/ebt/insights` - Get spending insights for current month
  - `GET /api/ebt/forecast` - Get benefit exhaustion prediction
  - `POST /api/ebt/alerts` - Set budget alerts (e.g., notify when 75% spent)
- Frontend:
  - `client/src/pages/SpendingInsights.tsx` - Analytics dashboard
  - `client/src/components/SpendingChart.tsx` - Monthly spending trends (Recharts)
  - `client/src/components/BudgetForecast.tsx` - Benefit exhaustion date widget
  - `client/src/components/SavingsRecommendations.tsx` - AI tips display

**Dependencies:**
- **EBT transaction data** (Feature 1.1 must be complete)
- **Gemini API** (already configured)
- **Merchant database** (for categorization - may need third-party API)

**Testing Required:**
- AI output quality (are recommendations helpful?)
- Forecast accuracy (test against historical data)
- Privacy compliance (no PII in AI prompts)

**Agent Requirements:**
- **Autonomy Level:** **MEDIUM** - AI prompt engineering + analytics logic
- **Power Mode:** **Yes** (AI iteration, chart design)
- **Web Search:** **Yes** (research spending analytics best practices, merchant categorization APIs)
- **Image Generation:** No

**Estimated Time:** 4-6 weeks (after Feature 1.1 complete)  
**Files Modified:** 12-15 files

---

### **Feature 1.3: EBT Security Features (Card Locking, Fraud Alerts)**
**Market Leader:** Propel (31+ states support card locking)  
**Priority Rank:** #5 (from Competitive Gap Analysis)

**Description:** Real-time fraud detection, card locking/unlocking, out-of-state transaction blocking, suspicious activity alerts.

**Code Changes Required:**
- Database schema:
  - Add columns to `ebtAccounts`: `isLocked boolean`, `outOfStateBlocked boolean`, `fraudAlerts jsonb[]`
  - Create `fraudDetectionLog` table (accountId, transactionId, alertType, severity, acknowledged)
- Backend services:
  - `server/services/fraudDetection.ts` - Anomaly detection (unusual amount, location, frequency)
  - `server/services/ebtCardControl.ts` - Lock/unlock card via state portal API
  - `server/services/geolocation.ts` - Detect out-of-state transactions
- API routes:
  - `POST /api/ebt/lock` - Lock EBT card
  - `POST /api/ebt/unlock` - Unlock EBT card
  - `POST /api/ebt/block-out-of-state` - Enable/disable out-of-state blocking
  - `GET /api/ebt/fraud-alerts` - Get fraud alert history
  - `POST /api/ebt/acknowledge-alert/:id` - Mark fraud alert as reviewed
- Frontend:
  - `client/src/components/EBTSecuritySettings.tsx` - Card controls
  - `client/src/components/FraudAlerts.tsx` - Alert notifications
  - Push notifications for fraud alerts (WebSocket or Firebase)

**Dependencies:**
- **State EBT portal card control API** (NOT all states support this)
- **Feature 1.1** (transaction data needed for fraud detection)

**Testing Required:**
- Security testing (ensure lock/unlock is authenticated)
- Fraud detection accuracy (minimize false positives)
- Test with Maryland first (verify card control API availability)

**Agent Requirements:**
- **Autonomy Level:** **LOW** - State API availability varies, requires external validation
- **Power Mode:** No
- **Web Search:** **Yes** (research which states support card controls: Propel lists 31+ states)
- **Image Generation:** No

**Estimated Time:** 6-8 weeks (parallel with Feature 1.2)  
**Files Modified:** 10-12 files

**State Availability Note:** Start with Maryland, verify card control API exists. If not available in Maryland, pilot with California or New York (confirmed support).

---

### **Phase 1 Summary**
| Metric | Value |
|--------|-------|
| **Total Features** | 3 (EBT Balance + Spending Insights + Security) |
| **Total Time** | 8-12 weeks (can parallelize Features 1.2 + 1.3 after 1.1 data layer) |
| **Total Files Modified** | 37-47 files |
| **Database Tables Added** | 6 tables (ebtAccounts, ebtTransactions, ebtBalances, spendingInsights, budgetAlerts, fraudDetectionLog) |
| **API Endpoints Added** | 13 endpoints |
| **Autonomy Level** | **LOW** (Feature 1.1, 1.3) + MEDIUM (Feature 1.2) |
| **Power Mode** | 2/3 features (1.1, 1.2) |
| **Web Search** | 3/3 features (state EBT systems, analytics best practices, card control APIs) |
| **Image Generation** | 0/3 features |

**Outcome:** JAWN competes directly with Propel (5M users), owns full user lifecycle from eligibility → benefit management

---

## Phase 2: Multi-Channel Communications (ACCESSIBILITY) 📞
**Priority:** HIGH  
**Duration:** 6-8 weeks  
**Market Impact:** HIGH (reaches non-smartphone, low-literacy, elderly users)

### **Objectives**
Match mRelief's omnichannel accessibility:
1. Voice/Phone IVR system (automated phone screening + VITA appointment booking)
2. Kiosk Mode (public terminal access for libraries, DHS offices)

---

### **Feature 2.1: Voice/Phone IVR System**
**Market Leader:** mRelief  
**Priority Rank:** #2 (from Competitive Gap Analysis)

**Description:** Toll-free 1-800 number with Interactive Voice Response menu for benefit screening, application status, VITA appointment booking, and human navigator transfer.

**Code Changes Required:**
- Database schema:
  - ✅ `phoneSystemCalls` table already exists (verified in schema.ts)
  - ✅ `callQueues` table already exists
  - ✅ `ivrMenus` table already exists
  - May need: `ivrTranscripts` table for speech-to-text logs
- Backend services:
  - `server/services/twilioVoiceService.ts` - Voice call handling
  - `server/services/ivrMenuBuilder.ts` - Dynamic IVR menu generation
  - `server/services/speechToText.ts` - Gemini Speech API or Twilio STT
  - `server/services/callRouter.ts` - Route to navigator queue
- API routes:
  - `POST /api/voice/incoming` - Twilio webhook for incoming calls
  - `POST /api/voice/gather` - Process IVR menu selections
  - `POST /api/voice/screening` - Voice-based benefit screening flow
  - `POST /api/voice/appointments` - Book VITA appointments via phone
  - `GET /api/voice/call-logs` - Call history for admin

**Dependencies:**
- **Twilio Voice API** (already configured for SMS)
- **1-800 toll-free number** (need to acquire from Twilio - $1/month + usage)
- **Call queue system** (tables exist, need route implementation)

**Testing Required:**
- Call flow testing (dial 1-800 number, navigate IVR menus)
- Accessibility testing (elderly users, low-literacy scenarios)
- Load testing (handle 100+ concurrent calls)
- E2E testing with Twilio test credentials

**Agent Requirements:**
- **Autonomy Level:** **MEDIUM** - IVR menu design requires user research, but implementation is straightforward
- **Power Mode:** No
- **Web Search:** **Yes** (research IVR best practices for government services, accessibility standards)
- **Image Generation:** No

**Estimated Time:** 6-7 weeks  
**Files Modified:** 12-15 files

**IVR Menu Structure (Draft):**
```
"Thank you for calling the Maryland Benefits Navigator. 
 Press 1 to check your eligibility for food assistance.
 Press 2 to check the status of your application.
 Press 3 to book a free tax preparation appointment.
 Press 4 to speak with a navigator.
 Press 9 to repeat this menu."
```

---

### **Feature 2.2: Kiosk Mode (Public Terminal Access)**
**Market Leader:** mRelief (mentioned, limited details)  
**Priority Rank:** #9 (from Competitive Gap Analysis)

**Description:** Fullscreen, simplified UI mode for public terminals (libraries, DHS offices, community centers) with auto-logout, print receipts, and no-login anonymous screening.

**Code Changes Required:**
- Frontend:
  - `client/src/pages/public/KioskMode.tsx` - Fullscreen kiosk interface
  - `client/src/components/KioskScreener.tsx` - Simplified screening form (large buttons, high contrast)
  - `client/src/components/PrintReceipt.tsx` - Print screening results
  - Add query param: `/screener?kiosk=true` to enable kiosk mode
- Backend:
  - `server/services/kioskSessionManager.ts` - Auto-logout after 5 min inactivity
  - API route: `POST /api/kiosk/print` - Generate printable PDF of screening results
- Infrastructure:
  - Browser fullscreen API
  - Print.js library for receipt printing
  - Session timeout modal (countdown timer)

**Dependencies:**
- ✅ Anonymous screener already exists (Feature #1 in FEATURES.md)
- ✅ PDF generation service (jsPDF already used for tax forms)

**Testing Required:**
- Accessibility testing (WCAG 2.1 AAA for touch screens)
- Browser compatibility (Chrome, Firefox kiosk mode)
- Print testing (thermal printers vs. standard printers)

**Agent Requirements:**
- **Autonomy Level:** **HIGH** - Straightforward UI modifications
- **Power Mode:** No
- **Web Search:** No
- **Image Generation:** No

**Estimated Time:** 2-3 weeks  
**Files Modified:** 5-7 files

---

### **Phase 2 Summary**
| Metric | Value |
|--------|-------|
| **Total Features** | 2 (Voice IVR + Kiosk Mode) |
| **Total Time** | 6-8 weeks (can parallelize features) |
| **Total Files Modified** | 17-22 files |
| **API Endpoints Added** | 6 endpoints (5 voice + 1 kiosk) |
| **Autonomy Level** | MEDIUM (Feature 2.1) + HIGH (Feature 2.2) |
| **Power Mode** | 0/2 features |
| **Web Search** | 1/2 features (IVR best practices) |
| **Image Generation** | 0/2 features |

**Outcome:** Omnichannel access (web, mobile, SMS, voice, kiosk) matching mRelief's inclusivity

---

## Phase 3: Geographic Scaling (50-State Expansion) 🇺🇸
**Priority:** VERY HIGH (for national contracts)  
**Duration:** 12-24 weeks  
**Market Impact:** VERY HIGH (42M SNAP recipients nationally vs. 780K in Maryland)

### **Objectives**
Expand from Maryland-only to 50-state coverage, starting with high-population states (CA, TX, FL, NY, IL).

**Note:** This is the most complex phase due to policy variation across states. Requires significant research and testing.

---

### **Feature 3.1: Multi-State Rules Engine & Program Mapping**
**Market Leader:** mRelief (50 states + territories)  
**Priority Rank:** #3 (from Competitive Gap Analysis)

**Description:** Build state-specific rules engines for SNAP, Medicaid, TANF, and energy assistance programs across all 50 states. Each state names programs differently and has different eligibility rules.

**Code Changes Required:**
- Database schema:
  - Create `stateProgramMappings` table (stateCode, programType, stateProgramName, stateAgency, applicationUrl)
  - Create `stateRulesEngines` table (stateCode, programType, rulesVersion, rulesData jsonb)
  - Create `statePolicySources` table (stateCode, programType, policyManualUrl, lastUpdated)
- Backend services:
  - `server/services/multiStateRulesEngine.ts` - State selector + rule loader
  - `server/services/stateProgramMapper.ts` - Map generic "SNAP" to state-specific names (CalFresh in CA, Link in IL, etc.)
  - `server/services/statePolicyTracker.ts` - Monitor 50 state policy manuals (extend Smart Scheduler)
  - State-specific rule files (50 files):
    - `server/rules/states/california.ts`
    - `server/rules/states/texas.ts`
    - `server/rules/states/new-york.ts`
    - ... (47 more)
- API routes:
  - `GET /api/states` - List supported states with program coverage
  - `POST /api/eligibility/multi-state` - Calculate eligibility for any state
  - `GET /api/states/:stateCode/programs` - Get state-specific program list
- Frontend:
  - `client/src/components/StateSelectorWidget.tsx` - Dropdown or map for state selection
  - Update `HouseholdProfiler` to include state field
  - Update all eligibility displays to show state-specific program names

**Dependencies:**
- **PolicyEngine** (already supports 50 states - verify coverage)
- **State program research** (50 states × 4 programs = 200 program mappings)
- **State policy manual access** (some states require public records requests)

**Testing Required:**
- Accuracy testing (compare against state calculators)
- PolicyEngine validation (ensure JAWN rules match PolicyEngine for each state)
- Multi-state user testing (recruit testers from CA, TX, FL, NY)

**Agent Requirements:**
- **Autonomy Level:** **LOW** - Requires extensive research, user testing, accuracy validation
- **Power Mode:** **Yes** (iterative rule development + testing)
- **Web Search:** **Yes** (research each state's benefit programs, income limits, asset limits, categorical eligibility rules)
- **Image Generation:** No

**Estimated Time:** 12-24 weeks (phased rollout)  
**Files Modified:** 60-80 files (50 state rule files + core services)

**Phased Rollout Strategy:**
1. **Phase 3A (Weeks 1-8):** Pilot with 5 high-population states (CA, TX, FL, NY, IL) - 40% of US population
2. **Phase 3B (Weeks 9-16):** Add 15 medium-population states (PA, OH, GA, NC, MI, etc.) - 75% of US population
3. **Phase 3C (Weeks 17-24):** Add remaining 30 states (low-population + territories) - 100% coverage

**Research Required Per State:**
| Program | State-Specific Research |
|---------|------------------------|
| **SNAP** | Income limits (% FPL), asset limits, categorical eligibility, deductions (shelter, dependent care), work requirements |
| **Medicaid** | Expansion status (31 states expanded, 19 didn't), income limits, MAGI vs. non-MAGI, pregnant women coverage |
| **TANF** | State name (TANF in most states, CalWORKs in CA, TAFDC in MA), time limits, work requirements, benefit amounts |
| **Energy** | Program name (LIHEAP in most states, HEAP in NY, OHEP in MD), seasonal eligibility, crisis vs. regular assistance |

**Example State Program Names:**
- **SNAP:** CalFresh (CA), Link (IL), Lone Star (TX), ACCESS (FL), FRESH (PA)
- **Medicaid:** Medi-Cal (CA), Medicaid (most), Medical Assistance (PA)
- **TANF:** CalWORKs (CA), TANF (most), TAFDC (MA), FIP (DE)
- **Energy:** LIHEAP (most), HEAP (NY), OHEP (MD), ERAP (some states)

---

### **Phase 3 Summary**
| Metric | Value |
|--------|-------|
| **Total Features** | 1 mega-feature (50-state expansion) |
| **Total Time** | 12-24 weeks (phased rollout) |
| **Total Files Modified** | 60-80 files |
| **Database Tables Added** | 3 tables (stateProgramMappings, stateRulesEngines, statePolicySources) |
| **API Endpoints Added** | 3 endpoints |
| **Autonomy Level** | **LOW** (requires extensive research + validation) |
| **Power Mode** | **Yes** (iterative rule development across 50 states) |
| **Web Search** | **Yes** (research all 50 states × 4 programs = 200+ searches) |
| **Image Generation** | No |

**Outcome:** National addressable market (42M SNAP recipients), government contract eligibility (national RFPs), 10-50x revenue potential

---

## Phase 4: Marketplace & Revenue Diversification 🛒
**Priority:** MEDIUM  
**Duration:** 8-12 weeks  
**Market Impact:** MEDIUM (revenue generation, user engagement)

### **Objectives**
Create non-government revenue streams:
1. Discount marketplace (exclusive EBT deals)
2. Job board integration (employment pathways)

---

### **Feature 4.1: Discount Marketplace (EBT-Exclusive Deals)**
**Market Leader:** Propel (Instacart, Amazon, Walmart partners)  
**Priority Rank:** #6 (from Competitive Gap Analysis)

**Description:** Partner with retailers to offer exclusive discounts for JAWN users. Revenue via affiliate commissions and sponsored placements.

**Code Changes Required:**
- Database schema:
  - Create `marketplaceDeals` table (dealId, partnerId, title, description, discountAmount, expiresAt, affiliateUrl, category, isActive)
  - Create `marketplacePartners` table (partnerId, companyName, logoUrl, commissionRate, apiKey)
  - Create `dealClicks` table (userId, dealId, clickedAt, converted boolean, commissionEarned)
  - Create `userFavoriteDeals` table (userId, dealId)
- Backend services:
  - `server/services/marketplaceService.ts` - Fetch active deals, track clicks
  - `server/services/affiliateTracker.ts` - Track conversions and commissions
  - `server/services/dealAggregator.ts` - Fetch deals from partner APIs (if available)
- API routes:
  - `GET /api/marketplace/deals` - Get active deals (query params: category, location)
  - `POST /api/marketplace/click/:dealId` - Track click (generate affiliate link)
  - `POST /api/marketplace/favorite/:dealId` - Save deal to favorites
  - `GET /api/admin/marketplace/analytics` - Admin dashboard (clicks, conversions, revenue)
- Frontend:
  - `client/src/pages/Marketplace.tsx` - Deal browsing page
  - `client/src/components/DealCard.tsx` - Individual deal display
  - `client/src/components/DealCategoryFilter.tsx` - Filter by category (groceries, phone, utilities)

**Dependencies:**
- **Partnership agreements** (BLOCKING) - Contact Instacart, Amazon Fresh, Walmart, Lifeline phone providers
- **Affiliate tracking** (use existing analytics infrastructure)

**Testing Required:**
- Affiliate link tracking accuracy (verify click-to-conversion attribution)
- Revenue reconciliation (match JAWN tracking to partner reports)
- User testing (do users engage with deals?)

**Agent Requirements:**
- **Autonomy Level:** **LOW** - Requires external partnership negotiations
- **Power Mode:** No
- **Web Search:** **Yes** (research affiliate program terms for Instacart, Amazon, Walmart, Lifeline providers)
- **Image Generation:** No

**Estimated Time:** 8-10 weeks (4 weeks partnership negotiations + 4 weeks implementation)  
**Files Modified:** 12-15 files

**Revenue Potential:** $500K-$2M/year (based on Propel's scale with 5M users)

**Initial Partner Targets:**
1. **Groceries:** Instacart (EBT accepted), Amazon Fresh, Walmart Grocery
2. **Phone Plans:** Lifeline/ACP providers (free government phones)
3. **Utilities:** Energy assistance programs (OHEP in MD), low-income internet (Comcast Internet Essentials)

---

### **Feature 4.2: Job Board Integration**
**Market Leader:** Propel  
**Priority Rank:** #7 (from Competitive Gap Analysis)

**Description:** Integrate with job board APIs (Indeed, ZipRecruiter, Snagajob) to show local employment opportunities. JAWN differentiation: show real-time benefits impact (what-if new income reduces SNAP?).

**Code Changes Required:**
- Database schema:
  - Create `jobListings` table (jobId, externalId, title, company, location, salary, postedDate, applyUrl, source)
  - Create `jobApplications` table (userId, jobId, appliedAt, status)
- Backend services:
  - `server/services/jobBoardIntegration.ts` - Fetch jobs from Indeed, ZipRecruiter APIs
  - `server/services/benefitsImpactCalculator.ts` - Calculate benefits change if user gets job
- API routes:
  - `GET /api/jobs` - Get local job listings (query params: location, radius, keywords)
  - `POST /api/jobs/apply/:jobId` - Track application
  - `POST /api/jobs/impact` - Calculate benefits impact of job (POST body: salary)
- Frontend:
  - `client/src/pages/JobBoard.tsx` - Job search page
  - `client/src/components/JobCard.tsx` - Individual job listing
  - `client/src/components/BenefitsImpactWidget.tsx` - "If you take this job, your SNAP will change to..."

**Dependencies:**
- **Job board API access** (Indeed API, ZipRecruiter API - free tier may suffice)
- **Financial Opportunity Radar** (already exists - reuse for benefits impact calculation)

**Testing Required:**
- Job listing accuracy (verify external APIs return relevant jobs)
- Benefits impact accuracy (compare JAWN calculation to manual calculation)

**Agent Requirements:**
- **Autonomy Level:** **MEDIUM** - API integrations + UI work
- **Power Mode:** No
- **Web Search:** **Yes** (research Indeed API, ZipRecruiter API, job board best practices)
- **Image Generation:** No

**Estimated Time:** 4-6 weeks (can parallelize with Feature 4.1)  
**Files Modified:** 10-12 files

**Revenue Potential:** $200K-$500K/year (job listing fees or placement commissions)

**JAWN Differentiation:** Unlike Propel, JAWN shows "If you take this $15/hour job, your SNAP will decrease to $120/month (from $200), but your net income increases by $800/month." This is unique value.

---

### **Phase 4 Summary**
| Metric | Value |
|--------|-------|
| **Total Features** | 2 (Marketplace + Job Board) |
| **Total Time** | 8-12 weeks (can parallelize features) |
| **Total Files Modified** | 22-27 files |
| **Database Tables Added** | 6 tables |
| **API Endpoints Added** | 7 endpoints |
| **Autonomy Level** | LOW (Feature 4.1) + MEDIUM (Feature 4.2) |
| **Power Mode** | 0/2 features |
| **Web Search** | 2/2 features (affiliate programs, job board APIs) |
| **Image Generation** | 0/2 features |

**Outcome:** Diversified revenue ($700K-$2.5M/year potential), reduced dependency on government contracts

---

## Phase 5: Organizational Support & SSI (SOCIAL SERVICES) 🏥
**Priority:** MEDIUM  
**Duration:** 12-16 weeks  
**Market Impact:** MEDIUM-HIGH (CBO partnerships, disability community)

### **Objectives**
1. Enhanced CBO portal (mRelief "Johnnie" CRM competitor)
2. SSI (Supplemental Security Income) program integration

---

### **Feature 5.1: Enhanced CBO Portal (CRM "Johnnie" Style)**
**Market Leader:** mRelief ("Johnnie" CRM)  
**Priority Rank:** #8 (from Competitive Gap Analysis)

**Description:** Comprehensive client relationship management system for community-based organizations (CBOs) and VITA sites. Case management, communication tools, document tracking, volunteer coordination.

**Code Changes Required:**
- Database schema:
  - Create `cboClients` table (cboId, clientId, assignedStaffId, caseNotes jsonb[], lastContact, nextFollowUp)
  - Create `cboStaffRoles` table (userId, cboId, role, permissions jsonb)
  - Create `cboTasks` table (taskId, cboId, clientId, assignedTo, taskType, dueDate, status)
  - Create `cboReports` table (reportId, cboId, reportType, generatedDate, dataSnapshot jsonb)
- Backend services:
  - `server/services/cboClientManager.ts` - Client assignment, case notes
  - `server/services/cboTaskManager.ts` - Task creation, reminders, completion
  - `server/services/cboReportGenerator.ts` - Monthly reports (clients served, conversion rates, program enrollment)
  - `server/services/cboVolunteerScheduler.ts` - VITA volunteer shift management
- API routes:
  - `GET /api/cbo/clients` - List CBO's clients
  - `POST /api/cbo/clients/:id/notes` - Add case note
  - `POST /api/cbo/tasks` - Create follow-up task
  - `GET /api/cbo/reports` - Generate reports
  - `POST /api/cbo/staff` - Manage CBO staff roles
- Frontend:
  - `client/src/pages/cbo/CBODashboard.tsx` - CBO home page
  - `client/src/pages/cbo/ClientManager.tsx` - Client list with filters
  - `client/src/pages/cbo/ClientDetail.tsx` - Individual client view (case notes, documents, tasks)
  - `client/src/pages/cbo/Reports.tsx` - Report generation and download
  - `client/src/components/TaskReminder.tsx` - Follow-up task notifications

**Dependencies:**
- ✅ Multi-tenant system (already exists in JAWN - `tenants` table)
- ✅ User roles (already exists - `users.role` field)

**Testing Required:**
- CBO user testing (recruit 3-5 community organizations in Maryland)
- Volunteer testing (VITA site coordinators)
- Permission testing (ensure staff can only see their assigned clients)

**Agent Requirements:**
- **Autonomy Level:** **MEDIUM** - Requires CBO user research, but CRUD patterns are standard
- **Power Mode:** No
- **Web Search:** **Yes** (research CBO CRM best practices, VITA site management tools)
- **Image Generation:** No

**Estimated Time:** 8-10 weeks  
**Files Modified:** 18-22 files

**CBO Feature Highlights:**
- Client assignment (assign clients to specific staff members)
- Case notes (timestamped notes on client interactions)
- Task management (follow-up reminders: "Call client on 10/25 about missing docs")
- Document tracking (see which clients uploaded documents, which are missing)
- Bulk SMS/email (send reminders to all clients)
- Monthly reports (clients served, conversion rates, program-specific enrollment)

---

### **Feature 5.2: SSI (Supplemental Security Income) Program Integration**
**Market Leader:** None (gap in market)  
**Priority Rank:** #10 (from Competitive Gap Analysis)

**Description:** Add SSI eligibility screening and benefits calculation to JAWN's 6-program coverage. SSI serves 7.4M disabled and elderly Americans with cash assistance.

**Code Changes Required:**
- Database schema:
  - Add SSI to `benefitPrograms` table (if not already present)
  - Create `ssiApplications` table (userId, disabilityType, onsetDate, workHistory, medicalDocuments jsonb)
  - Create `ssiAppeals` table (applicationId, appealDate, hearingDate, decision, notes)
- Backend services:
  - `server/services/ssiRulesEngine.ts` - Federal SSI eligibility rules (income < $943/month for individual, asset < $2,000)
  - `server/services/ssiCalculator.ts` - Calculate SSI benefit amount (max $943/month minus countable income)
  - `server/services/ssiDisabilityGuide.ts` - Document requirements for disability determination
- API routes:
  - `POST /api/ssi/screen` - SSI eligibility screening
  - `POST /api/ssi/calculate` - SSI benefit calculation
  - `GET /api/ssi/requirements` - Get SSI documentation requirements
  - `POST /api/ssi/appeal` - Track SSI appeal (if denied)
- Frontend:
  - Update `HouseholdProfiler` to include disability status field
  - Update `FinancialOpportunityRadar` to include SSI
  - `client/src/pages/SSIGuide.tsx` - SSI application guide (explain disability determination process)
  - `client/src/components/SSICalculator.tsx` - SSI benefit estimator

**Dependencies:**
- **PolicyEngine SSI module** (verify if PolicyEngine supports SSI - may need to build from scratch)
- **SSA (Social Security Administration) policy manual** (research federal SSI rules)
- **Disability law expertise** (consult with disability rights attorney or advocacy org)

**Testing Required:**
- Accuracy testing (compare JAWN SSI calculations to SSA.gov calculators)
- Legal review (ensure guidance doesn't constitute legal advice)
- User testing with disability community

**Agent Requirements:**
- **Autonomy Level:** **LOW** - Disability law is complex, requires legal/advocacy expertise
- **Power Mode:** No
- **Web Search:** **Yes** (research SSI income limits, asset limits, countable income rules, state supplements, disability determination process)
- **Image Generation:** No

**Estimated Time:** 12-14 weeks (legal research + implementation)  
**Files Modified:** 15-18 files

**SSI Complexity Notes:**
- **Disability determination** is handled by SSA Disability Determination Services (DDS), not JAWN
- JAWN can screen for **financial eligibility** (income, assets) but NOT **medical eligibility** (disability)
- Many SSI recipients are automatically eligible for SNAP, Medicaid (categorical eligibility)
- SSI has **state supplements** (some states add extra cash on top of federal SSI)

---

### **Phase 5 Summary**
| Metric | Value |
|--------|-------|
| **Total Features** | 2 (CBO Portal + SSI) |
| **Total Time** | 12-16 weeks (can parallelize features) |
| **Total Files Modified** | 33-40 files |
| **Database Tables Added** | 7 tables (4 CBO + 3 SSI) |
| **API Endpoints Added** | 11 endpoints (6 CBO + 5 SSI) |
| **Autonomy Level** | MEDIUM (Feature 5.1) + LOW (Feature 5.2) |
| **Power Mode** | 0/2 features |
| **Web Search** | 2/2 features (CBO best practices, SSI federal rules) |
| **Image Generation** | 0/2 features |

**Outcome:** Government contract readiness (national RFPs require CBO tools), full 7-program coverage (SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI, VITA)

---

## Phase 6: Legislative AI & Analytics (INNOVATION) 🤖
**Priority:** LOW (nice-to-have)  
**Duration:** 4-6 weeks  
**Market Impact:** LOW (advocacy/policy stakeholders, not end users)

### **Objectives**
Complete Feature #52 from Feature Audit: Legislative Impact Analysis AI component.

---

### **Feature 6.1: Legislative Impact Analysis AI**
**Priority Rank:** N/A (completion of partially-built feature)

**Description:** AI-powered analysis of federal/state bills to predict impact on benefit programs. Example: "This bill increases SNAP work requirements for able-bodied adults ages 50-54, affecting an estimated 750,000 recipients."

**Code Changes Required:**
- Backend services:
  - `server/services/legislativeImpactAnalysis.ts` - Gemini AI prompts for bill analysis
  - `server/services/affectedPopulationEstimator.ts` - Calculate number of people affected
- API routes:
  - `POST /api/legislation/analyze/:billId` - Analyze bill impact
  - `GET /api/legislation/impacts` - List bills with significant impacts
- Frontend:
  - `client/src/pages/LegislativeImpacts.tsx` - Bill impact dashboard
  - `client/src/components/BillImpactCard.tsx` - Individual bill analysis display

**Dependencies:**
- ✅ Database tables exist (`federalBills`, `marylandBills`)
- ✅ Bill tracking service operational (Smart Scheduler)
- ✅ Gemini API configured
- ❌ AI analysis logic missing (this feature)

**Testing Required:**
- AI output quality (is analysis accurate?)
- Expert review (policy analysts validate AI findings)

**Agent Requirements:**
- **Autonomy Level:** **MEDIUM** - AI prompt engineering
- **Power Mode:** **Yes** (AI iteration)
- **Web Search:** **Yes** (research legislative analysis methodologies)
- **Image Generation:** No

**Estimated Time:** 4-5 weeks  
**Files Modified:** 5-7 files

---

### **Phase 6 Summary**
| Metric | Value |
|--------|-------|
| **Total Features** | 1 (Legislative Impact Analysis) |
| **Total Time** | 4-6 weeks |
| **Total Files Modified** | 5-7 files |
| **API Endpoints Added** | 2 endpoints |
| **Autonomy Level** | **MEDIUM** |
| **Power Mode** | **Yes** |
| **Web Search** | **Yes** |
| **Image Generation** | No |

**Outcome:** Feature #52 complete, JAWN reaches 100% feature completeness (95/95 → 95/95, since #52 was already counted as planned)

---

## Overall Roadmap Summary

| Phase | Name | Duration | Features | Autonomy | Power Mode | Web Search | Priority |
|-------|------|----------|----------|----------|-----------|-----------|----------|
| **0** | Foundation Completion | 1-2 weeks | 3 | HIGH | 1/3 | 1/3 | CRITICAL |
| **1** | EBT Ecosystem Entry | 8-12 weeks | 3 | LOW-MEDIUM | 2/3 | 3/3 | HIGH |
| **2** | Multi-Channel Communications | 6-8 weeks | 2 | MEDIUM-HIGH | 0/2 | 1/2 | HIGH |
| **3** | Geographic Scaling (50-State) | 12-24 weeks | 1 | LOW | Yes | Yes | VERY HIGH |
| **4** | Marketplace & Revenue | 8-12 weeks | 2 | LOW-MEDIUM | 0/2 | 2/2 | MEDIUM |
| **5** | Organizational Support & SSI | 12-16 weeks | 2 | MEDIUM-LOW | 0/2 | 2/2 | MEDIUM |
| **6** | Legislative AI & Analytics | 4-6 weeks | 1 | MEDIUM | Yes | Yes | LOW |

**Total Timeline:** 51-80 weeks (12-18 months)  
**Total Features:** 14 features  
**Total Files Modified:** 200-300 files

---

## Agent Mode Recommendations by Phase

### **When to Use Power Mode:**
- **Phase 0, Task 0.3** (Legislative AI) - AI prompt iteration
- **Phase 1** (EBT integration) - Multi-state API testing
- **Phase 3** (50-state expansion) - Iterative rule development
- **Phase 6** (Legislative AI) - AI model testing

**Power Mode Usage:** 4 out of 7 phases (57%)

### **When Web Search is Required:**
- **Phase 0** - 1/3 tasks (legislative analysis best practices)
- **Phase 1** - 3/3 features (EBT portal systems, spending analytics, card control APIs)
- **Phase 2** - 1/2 features (IVR best practices)
- **Phase 3** - Required (50 states × 4 programs research)
- **Phase 4** - 2/2 features (affiliate programs, job board APIs)
- **Phase 5** - 2/2 features (CBO best practices, SSI federal rules)
- **Phase 6** - Required (legislative analysis methodologies)

**Web Search Usage:** 6 out of 7 phases (86%)

### **Image Generation:**
**NEVER REQUIRED** - None of the features need image generation. All UI work uses icons from lucide-react or logos from react-icons/si.

---

## Dependency Chain

```
Phase 0 (Foundation)
  └─> Enables e-filing frontend testing
      └─> Unlocks IRS/Maryland e-file production (after EFIN obtained)

Phase 1 (EBT Ecosystem)
  ├─> Feature 1.1 (EBT Balance Tracking)
  │     └─> BLOCKS Feature 1.2 (Spending Insights) - needs transaction data
  │     └─> BLOCKS Feature 1.3 (Security) - needs transaction data for fraud detection
  └─> All features can parallelize after 1.1 data layer complete

Phase 2 (Multi-Channel)
  ├─> Feature 2.1 (Voice IVR) - Independent
  └─> Feature 2.2 (Kiosk Mode) - Independent
  └─> Can fully parallelize

Phase 3 (50-State)
  └─> Feature 3.1 (Multi-State Rules) - Blocks revenue growth, national contracts
      └─> RECOMMENDED: Complete Phase 1 (EBT) first to have competitive product before scaling

Phase 4 (Marketplace)
  ├─> Feature 4.1 (Discount Marketplace) - Independent
  └─> Feature 4.2 (Job Board) - Independent
  └─> Can fully parallelize

Phase 5 (Organizational)
  ├─> Feature 5.1 (CBO Portal) - Independent
  └─> Feature 5.2 (SSI Program) - Independent
  └─> Can fully parallelize

Phase 6 (Legislative AI)
  └─> Feature 6.1 - Independent, can be done anytime
```

---

## Risk Mitigation Strategies

| Risk | Phase | Mitigation |
|------|-------|-----------|
| **EBT API access denied** | Phase 1 | Start with Maryland (existing DHS relationship), build state-by-state |
| **State expansion costs exceed budget** | Phase 3 | Phased rollout (5 states/phase), prioritize high-population states |
| **Partnership negotiations stall** | Phase 4 | Build marketplace in-house first, add partners iteratively |
| **CBO user adoption low** | Phase 5 | User research before build, pilot with 3-5 CBOs in Maryland |
| **SSI legal complexity** | Phase 5 | Consult disability rights attorney, limit to financial screening only |
| **50-state policy changes break rules** | Phase 3 | Already mitigated (Smart Scheduler monitors policy updates) |

---

## Success Metrics by Phase

| Phase | Key Metrics |
|-------|-------------|
| **Phase 0** | E-filing API response times < 500ms, Zero LSP errors, 100% test coverage |
| **Phase 1** | EBT users > 1,000 (MD only), Daily active users +50%, Transaction sync uptime > 99% |
| **Phase 2** | Voice calls > 500/month, Kiosk sessions > 100/month, Accessibility score WCAG 2.1 AAA |
| **Phase 3** | States live: 5 (pilot) → 20 (mid) → 50 (complete), Addressable market: 42M SNAP recipients |
| **Phase 4** | Marketplace revenue > $50K/year, Deal clicks > 10K/month, Job applications > 500/month |
| **Phase 5** | CBO partners > 20, SSI screenings > 500/month, CBO user satisfaction > 4.0/5.0 |
| **Phase 6** | Bill analyses > 100, Policy stakeholder engagement > 10 organizations |

---

**Report Prepared:** October 20, 2025  
**Next Review:** After Phase 0 completion (2-week checkpoint)  
**Maintained By:** JAWN Development Team
