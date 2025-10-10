# Maryland Multi-Program Benefits Navigator - Operational Readiness Checklist

**Date**: October 10, 2025  
**Version**: 1.0  
**Status**: Pre-Production Assessment

---

## Executive Summary

This checklist assesses production readiness for the Maryland Multi-Program Benefits Navigator System across 7 benefit programs (SNAP, Medicaid, TANF, OHEP, WIC, MCHP, VITA). The system combines RAG (Retrieval-Augmented Generation) with Rules as Code for conversational policy search and deterministic benefit calculations.

### Current Status: ⚠️ **PARTIALLY READY**

**Ready Components**:
- ✅ RAG Infrastructure (4,887 semantic chunks, Gemini embeddings)
- ✅ Navigator Workspace (session tracking, E&E export)
- ✅ Admin Tools (compliance, evaluation, feedback)
- ✅ Public Screener (anonymous eligibility)
- ✅ Scenario Workspace (what-if modeling)

**Blocking Issues**:
- ❌ PolicyEngine calculations unavailable (library + API auth issues)
- ❌ 6/7 programs missing policy documents (only SNAP has 99 docs)
- ⚠️ Database cleanup needed (2 legacy duplicates)

---

## 1. Policy Document Coverage

### Critical Gap: Missing Golden Source Materials

| Program | Documents Loaded | Status | Required Materials |
|---------|-----------------|--------|-------------------|
| **MD_SNAP** | ✅ 99 documents | READY | Complete |
| **MD_MEDICAID** | ❌ 0 documents | BLOCKED | Maryland Medical Assistance Program Manual |
| **MD_TCA** | ❌ 0 documents | BLOCKED | TCA Policy Manual (COMAR 07.03.01-08) |
| **MD_OHEP** | ❌ 0 documents | BLOCKED | OHEP/MEAP/EUSP Guidelines |
| **MD_WIC** | ❌ 0 documents | BLOCKED | MD WIC Policy & Procedures Manual |
| **MD_MCHP** | ❌ 0 documents | BLOCKED | MCHP Provider Manual |
| **VITA** | ❌ 0 documents | BLOCKED | IRS Publication 4012 (Quality Site Requirements) |

**Action Required**: Upload official policy manuals for all 6 programs before production launch.

### Where to Find Golden Sources

**MD_MEDICAID**:
- Source: Maryland Medical Assistance Program (MMAP) Manual
- URL: `health.maryland.gov/mmcp/Pages/Provider-Manuals.aspx`
- Key Sections: Eligibility standards, income limits, MAGI rules

**MD_TCA (TANF)**:
- Source: Code of Maryland Regulations (COMAR) Title 07.03
- URL: `dhr.maryland.gov/documents/Family Investment Administration/TCA/`
- Key Documents: TCA Policy Manual, Work Requirements, Time Limits

**MD_OHEP (Energy Assistance)**:
- Source: Office of Home Energy Programs (OHEP) Manual
- URL: `dhr.maryland.gov/office-of-home-energy-programs/`
- Programs: MEAP (Maryland Energy Assistance Program), EUSP (Electric Universal Service Program)

**MD_WIC**:
- Source: Maryland WIC Policy & Procedures Manual
- URL: `health.maryland.gov/wic/Pages/home.aspx`
- Key Sections: Categorical eligibility, income guidelines, nutrition risk criteria

**MD_MCHP**:
- Source: Maryland Children's Health Program Provider Manual
- URL: `mchp.dhmh.maryland.gov/`
- Key Sections: Child eligibility (ages 0-19), household income limits

**VITA**:
- Source: IRS Publication 4012 (VITA/TCE Volunteer Resource Guide)
- URL: `irs.gov/pub/irs-pdf/p4012.pdf`
- Note: Already partially loaded (100 docs visible in system), verify completeness

---

## 2. Benefit Calculation Engine Status

### Critical Issue: PolicyEngine Unavailable

**Problem**: Both PolicyEngine implementation paths are blocked:

1. **Python Library** (`policyengine-us`)
   - Status: ❌ BLOCKED
   - Error: `libstdc++.so.6` missing (numpy C-extension dependency)
   - Root Cause: NixOS environment missing shared libraries
   - Attempts: Installed gcc, libstdcxx5 - issue persists

2. **PolicyEngine REST API** 
   - Unauthenticated endpoint: `api.policyengine.org/us/calculate` (returns empty results)
   - Authenticated endpoint: `household.api.policyengine.org/us/calculate` (requires credentials)
   - Status: ❌ BLOCKED - Free endpoint non-functional, paid endpoint requires Client ID & Secret
   - Cost: Contact PolicyEngine at hello@policyengine.org for pricing
   - Current Implementation: HTTP client calls unauthenticated endpoint, gets empty response `{"result": {}, "status": "ok"}`

### Impact on Features

**Affected Capabilities** (currently degraded):
- ❌ Anonymous Benefit Screener (`/screener`) - Shows $0 for all benefits
- ❌ Scenario Workspace (`/scenarios`) - Cannot calculate benefit amounts
- ❌ Intake Copilot (`/intake`) - No real-time benefit estimates
- ❌ Evaluation Framework - Cannot validate PolicyEngine calculations (2% variance tests)

**Still Functional** (RAG-only mode):
- ✅ Conversational Policy Search - Full semantic search with citations
- ✅ Navigator Workspace - Session tracking, client notes, E&E export
- ✅ Document Upload - OCR, classification, chunking, embeddings
- ✅ Compliance Validation - Gemini-powered regulatory checks
- ✅ Policy Diff Monitor - Version tracking and change notifications

### Alternative Solutions

**Option 1: Acquire PolicyEngine API Credentials** (Recommended)
- Contact: hello@policyengine.org
- Provides: SNAP, Medicaid, TANF, EITC, CTC, SSI calculations
- Accuracy: Research-backed, actively maintained
- Timeline: Immediate (if approved)

**Option 2: Build Custom SNAP Calculator** (Short-term fallback)
- Source: USDA FY 2026 SNAP tables (`fns.usda.gov/snap/recipient/eligibility`)
- Covers: SNAP only (1/7 programs)
- Accuracy: High for SNAP, manual updates needed annually
- Timeline: 1-2 weeks development

**Option 3: Implement mRelief Open-Source Logic** (Medium-term)
- Source: `github.com/mRelief/mrelief_scaffold`
- Covers: SNAP, Medicaid, WIC, TANF
- Accuracy: Good, requires Maryland customization
- Timeline: 3-4 weeks development
- **Integration Effort**:
  - Week 1: Port Illinois/generic rules to Maryland-specific logic
  - Week 2: Map mRelief data structures to existing schema (household_scenarios, intake_sessions)
  - Week 3: Implement calculation endpoints, replace PolicyEngine service calls
  - Week 4: Testing, validation against known cases
- **Data Requirements**:
  - Maryland FPL thresholds (health.maryland.gov)
  - MD SNAP deductions/shelter caps (COMAR 07.03.05)
  - MD Medicaid MAGI rules (health.maryland.gov/mmcp)
  - WIC income limits (185% FPL), categorical eligibility
- **Maintenance**:
  - Annual updates for FPL changes (January each year)
  - Quarterly monitoring for COMAR regulation updates
  - Ongoing testing as federal policy changes

**Option 4: OpenFisca Custom Engine** (Long-term, complex)
- Source: `openfisca.org`
- Covers: All programs, full customization
- Accuracy: Perfect (if rules correct)
- Timeline: 2-3 months development
- **Integration Effort**:
  - Month 1: 
    - Install OpenFisca-US core package
    - Define Maryland extension module (MD-specific parameters)
    - Create benefit formulas for 7 programs
  - Month 2:
    - Map household input to OpenFisca entities (persons, families, tax_units)
    - Implement API wrapper service (replace policyEngineService)
    - Build test suite with Maryland edge cases
  - Month 3:
    - Performance optimization (caching, parallel calculations)
    - Documentation, deployment configuration
    - Validation against PolicyEngine (if credentials available)
- **Data Requirements**:
  - Complete policy rules codified in Python (COMAR, CFR, state statutes)
  - Historical parameter values (benefit amounts, thresholds by year)
  - Testing datasets with known correct outcomes
- **Maintenance**:
  - Dedicated engineer for policy updates (10-15 hrs/month)
  - Version control for policy changes (git-based)
  - Continuous integration testing on every rule change
- **Advantages Over Alternatives**:
  - Rules-as-code approach matches project philosophy
  - Version control for policy changes (audit trail)
  - Can model "what-if" policy reforms (scenario analysis)
  - Open-source, no vendor lock-in

---

## 3. Database Health & Cleanup

### Issue: Legacy Program Duplicates

**Current State**: 9 programs exist in database (7 unique + 2 duplicates)

**Duplicates Identified**:
1. `MD_ENERGY` (legacy) → Replaced by `MD_OHEP` ✅
2. `MD_VITA` (legacy) → Replaced by `VITA` ✅

**Cleanup SQL** (run in development DB):
```sql
-- Check for documents/rules tied to legacy programs before deleting
SELECT COUNT(*) FROM documents WHERE program_id = (SELECT id FROM benefit_programs WHERE code = 'MD_ENERGY');
SELECT COUNT(*) FROM documents WHERE program_id = (SELECT id FROM benefit_programs WHERE code = 'MD_VITA');

-- If counts are 0, safe to delete:
DELETE FROM benefit_programs WHERE code IN ('MD_ENERGY', 'MD_VITA');
```

**Action**: Execute cleanup before production deployment to avoid confusion.

---

## 4. Navigator Workspace Readiness

### Status: ✅ **INFRASTRUCTURE READY**

**Database Tables** (verified):
- ✅ `client_interaction_sessions` - Tracks navigator-client meetings
- ✅ `intake_sessions` - Adaptive intake copilot conversations
- ✅ `anonymous_screening_sessions` - Public screener history
- ✅ `household_scenarios` - What-if modeling workspace

**Current Usage**: 0 sessions (awaiting first user interactions)

**E&E Export Infrastructure**:
- ✅ Session data capture ready
- ✅ JSON export format defined
- ⚠️ DHS integration endpoint placeholder (future work)

**Testing Needed**:
1. Create demo navigator session with test client
2. Verify session persistence across browser refresh
3. Test E&E export format compliance
4. Validate scenario comparison visualizations

---

## 5. Evaluation & Testing Framework

### Status: ✅ **CONFIGURED, AWAITING POLICYENGINE**

**Test Case Coverage**:
- ✅ 40 evaluation test cases created
- ✅ Maryland-specific tags implemented:
  - `md_asset_limit` (8 cases)
  - `md_drug_felony` (3 cases)
  - `bbce` (Broad-Based Categorical Eligibility - 6 cases)
  - `md_recertification` (4 cases)
- ✅ 2% variance tolerance configured

**Test Structure** (Propel snap-eval adapted):
- Eligibility Rules: 8 test cases
- Benefit Calculations: 12 test cases
- Edge Cases: 5 test cases
- Maryland-Specific: 15 test cases

**Benchmark Baseline** (Column Tax comparison):
- GPT-5 Strict Mode: 41% accuracy
- GPT-5 Lenient Mode: 61% accuracy
- Target: ≥80% with PolicyEngine validation

**Blocker**: Cannot run evaluation until PolicyEngine calculations are available.

---

## 6. User Access & Demo Environment

### Status: ✅ **FULLY OPERATIONAL**

**Demo Accounts** (pre-seeded):
- ✅ `demo.applicant` (Password: Demo2024!) - Public applicant view
- ✅ `demo.navigator` (Password: Demo2024!) - Navigator workspace access
- ✅ `demo.caseworker` (Password: Demo2024!) - Caseworker tools
- ✅ `demo.admin` (Password: Demo2024!) - Full admin access

**Login Page Helper**: Collapsible "Use Demo Account" panel displays credentials for instant testing.

**Role-Based Features**:
- Applicants: Screener, intake copilot, document upload
- Navigators: Client sessions, scenario workspace, policy search
- Caseworkers: Program management, compliance tools
- Admins: All features + audit logs, evaluation framework

---

## 7. Compliance & Regulatory Readiness

### Status: ✅ **VALIDATION SYSTEM READY**

**Gemini-Powered Compliance Suite**:
- ✅ WCAG 2.1 AA validation
- ✅ Limited English Proficiency (LEP) standards
- ✅ Federal Plain Language guidelines
- ✅ Custom regulatory rules (COMAR, CFR)

**Admin Interface**: `/admin/compliance`
- ✅ Create compliance rules
- ✅ Validate documents with AI analysis
- ✅ Severity-based violation tracking
- ✅ Remediation workflow

**Pending**: Run initial compliance scan on all 99 SNAP documents as baseline.

---

## 8. Production Deployment Blockers

### Critical Path to Launch

**BLOCKER 1: PolicyEngine Calculations** ⏱️ **Priority: URGENT**
- Issue: No benefit calculation engine available
- Impact: 5/7 core features degraded
- Options:
  1. Acquire PolicyEngine API credentials (fastest)
  2. Build custom SNAP calculator (1-2 weeks)
  3. RAG-only launch (calculations via external tools)

**BLOCKER 2: Policy Documents** ⏱️ **Priority: HIGH**
- Issue: 6/7 programs have 0 documents loaded
- Impact: No conversational AI for Medicaid, TANF, OHEP, WIC, MCHP, VITA
- Action: Upload official manuals from state agencies

**BLOCKER 3: Database Cleanup** ⏱️ **Priority: MEDIUM**
- Issue: 2 legacy duplicate programs exist
- Impact: Potential user confusion, data integrity
- Action: Execute SQL cleanup (5 minutes)

### Non-Blocking Items (Post-Launch)

**Enhancement 1: PolicyEngine Validation** (requires BLOCKER 1 fix)
- Run 40-case evaluation framework
- Document accuracy baseline vs. Column Tax
- Tune variance tolerance if needed

**Enhancement 2: DHS Integration Endpoint**
- Connect E&E export to Maryland DHS systems
- Requires DHS partnership agreement
- Timeline: 3-6 months post-launch

**Enhancement 3: Multi-Language Support**
- Spanish translations for LEP compliance
- Gemini multilingual RAG
- Timeline: 1-2 months

---

## 9. Production Infrastructure & Security

### Monitoring & Alerting

**Status**: ⚠️ **NEEDS IMPLEMENTATION**

**Required Monitoring**:
- [ ] Application Performance Monitoring (APM)
  - Recommendation: Sentry for error tracking, New Relic/DataDog for performance
  - Track: API response times, RAG query latency, PolicyEngine calculation duration
  - Alerts: >5s query response, >10% error rate, memory/CPU thresholds

- [ ] Database Monitoring
  - PostgreSQL slow query log (>1s queries)
  - Connection pool utilization
  - Database disk space alerts (<20% free)

- [ ] External Service Health
  - Google Gemini API availability checks
  - PolicyEngine API uptime monitoring (if enabled)
  - Google Cloud Storage connectivity

**Alerting Channels**:
- [ ] PagerDuty / OpsGenie for critical incidents
- [ ] Slack integration for warnings
- [ ] Email notifications for system alerts

### Logging & Audit

**Status**: ✅ **PARTIALLY IMPLEMENTED**

**Current Logging**:
- ✅ Request/Response logging middleware (requestLogger.ts)
- ✅ Audit log database table for user actions
- ✅ Document processing pipeline logs
- ✅ Gemini API call tracking

**Missing Requirements**:
- [ ] **Log Retention Policy**: Define storage duration (recommend 90 days active, 1 year archive)
- [ ] **Log Aggregation**: Centralized logging (Loggly, Papertrail, CloudWatch)
- [ ] **Sensitive Data Redaction**: Ensure PII/PHI not logged in plaintext
- [ ] **Query Performance Logs**: Track slow RAG searches, optimization opportunities

### Security Posture Validation

**Status**: ⚠️ **PARTIAL - NEEDS HARDENING**

**Implemented Security**:
- ✅ CSRF protection (double-submit cookie)
- ✅ Rate limiting (multi-tier: global, auth, API)
- ✅ Security headers (Helmet, CSP, HSTS)
- ✅ Session management (PostgreSQL-backed, secure cookies)
- ✅ Password hashing (bcrypt)
- ✅ SQL injection prevention (Drizzle ORM parameterized queries)

**Missing Security Validations**:
- [ ] **Penetration Testing**: Third-party security audit before production
- [ ] **Secrets Management Audit**:
  - [ ] Verify GEMINI_API_KEY never logged or exposed
  - [ ] Check DATABASE_URL not in client-side bundles
  - [ ] Confirm Google Cloud Storage credentials properly scoped
- [ ] **Input Validation Review**: Comprehensive XSS/injection testing
- [ ] **Authentication Hardening**:
  - [ ] Implement account lockout (5 failed attempts, 15-min cooldown)
  - [ ] Add password complexity requirements (min 8 chars, mixed case, numbers)
  - [ ] Enable MFA for admin/super_admin roles
- [ ] **HTTPS Enforcement**: Verify all traffic uses TLS 1.2+ in production
- [ ] **API Key Rotation**: Implement 90-day rotation policy for Gemini API key

### Incident Response Procedures

**Status**: ❌ **NOT DOCUMENTED**

**Required Runbooks**:
- [ ] **Database Failure**:
  - Detection: Connection pool exhaustion, query timeouts
  - Response: Restart Neon DB, check connection limits, review slow queries
  - Escalation: Contact Neon support if unresolved in 15 minutes

- [ ] **Gemini API Outage**:
  - Detection: 503 errors, timeout spikes in RAG queries
  - Response: Enable "degraded mode" message, queue failed queries for retry
  - Fallback: Switch to cached responses for common questions

- [ ] **PolicyEngine Unavailability** (if enabled):
  - Detection: 500 errors from calculation endpoints
  - Response: Display "calculations temporarily unavailable" notice
  - Fallback: RAG-only mode, direct users to manual calculators

- [ ] **Data Breach Response**:
  - Immediate: Isolate affected systems, disable compromised accounts
  - Notification: Maryland DHS within 24 hours, users within 72 hours
  - Recovery: Rotate all secrets, audit access logs, patch vulnerability

**On-Call Rotation**:
- [ ] Define primary/secondary on-call engineers
- [ ] Establish SLA: Critical (<15 min response), High (<1 hour), Medium (<4 hours)
- [ ] Weekly rotation schedule with handoff procedures

### Disaster Recovery & Backups

**Status**: ⚠️ **PARTIAL - NEEDS VALIDATION**

**Database Backups**:
- ✅ Neon PostgreSQL automated daily backups (check Neon dashboard)
- [ ] **Verify backup retention**: Confirm 30-day point-in-time recovery enabled
- [ ] **Test restore procedure**: Simulate database failure, restore from backup

**Document Storage Backups**:
- ⚠️ Google Cloud Storage (verify versioning enabled)
- [ ] **Test object recovery**: Delete test document, restore from GCS versioning
- [ ] **Cross-region replication**: Enable for disaster recovery (GCS multi-region)

**Code Repository**:
- ✅ Git version control (Replit + external backup)
- [ ] **Verify off-site backup**: Confirm GitHub/GitLab mirror exists

**Recovery Time Objectives (RTO)**:
- Critical services: <1 hour (database, API)
- Document processing: <4 hours (can rebuild pipeline)
- Historical data: <24 hours (backup restoration)

**Recovery Point Objectives (RPO)**:
- Database transactions: <1 hour (Neon backup frequency)
- Uploaded documents: <24 hours (GCS versioning)

---

## 10. Success Metrics & Monitoring

### Key Performance Indicators (KPIs)

**System Health**:
- [ ] 99.9% uptime (API + database)
- [ ] <2s average RAG query response time
- [ ] <5s PolicyEngine calculation time (when restored)

**User Engagement**:
- [ ] Track navigator session creation rate
- [ ] Monitor screener completion rate
- [ ] Measure scenario workspace usage

**Accuracy**:
- [ ] ≥80% PolicyEngine validation pass@1 (vs. Column Tax 41%)
- [ ] <2% variance in benefit calculations
- [ ] 0 critical compliance violations

**Document Coverage**:
- [ ] 100% of active programs have ≥1 policy manual loaded
- [ ] 95% semantic chunk quality score (Gemini assessment)

---

## 10. Production Launch Checklist

### Pre-Launch (Required)

- [ ] **Upload Policy Documents** (6 programs missing):
  - [ ] MD_MEDICAID - Maryland Medical Assistance Program Manual
  - [ ] MD_TCA - TCA Policy Manual (COMAR 07.03.01-08)
  - [ ] MD_OHEP - OHEP/MEAP/EUSP Guidelines
  - [ ] MD_WIC - MD WIC Policy & Procedures Manual
  - [ ] MD_MCHP - MCHP Provider Manual
  - [ ] VITA - Verify IRS Pub 4012 completeness

- [ ] **Resolve PolicyEngine Issue**:
  - [ ] Option A: Acquire API credentials from PolicyEngine
  - [ ] Option B: Implement custom SNAP calculator (USDA tables)
  - [ ] Option C: Launch RAG-only, defer calculations

- [ ] **Database Cleanup**:
  - [ ] Delete legacy `MD_ENERGY` program
  - [ ] Delete legacy `MD_VITA` program

- [ ] **Testing**:
  - [ ] Run compliance validation on SNAP documents (baseline)
  - [ ] Create demo navigator session (verify persistence)
  - [ ] Test screener with PolicyEngine fix (if available)
  - [ ] Verify scenario workspace calculations (if available)

### Post-Launch (Nice-to-Have)

- [ ] Run 40-case evaluation framework (requires PolicyEngine)
- [ ] Set up DHS integration endpoint (E&E export)
- [ ] Add Spanish translations for LEP compliance
- [ ] Configure production monitoring (Sentry, LogRocket)

---

## 11. Risk Assessment

### High Risk (Immediate Attention)

1. **PolicyEngine Dependency** 🔴
   - Probability: 100% (already occurred)
   - Impact: 5/7 features degraded
   - Mitigation: Acquire API credentials OR build fallback calculator

2. **Missing Policy Documents** 🔴
   - Probability: 100% (confirmed gap)
   - Impact: Cannot answer questions for 6/7 programs
   - Mitigation: Upload golden source materials from state agencies

### Medium Risk (Monitor)

3. **Calculation Accuracy** 🟡
   - Probability: Medium (if using fallback calculator)
   - Impact: Incorrect benefit estimates harm users
   - Mitigation: Validate against PolicyEngine when available, add disclaimers

4. **DHS Integration Delay** 🟡
   - Probability: Medium (external dependency)
   - Impact: Manual E&E export vs. automated handoff
   - Mitigation: Document export format, enable manual download

### Low Risk (Acceptable)

5. **Database Duplicates** 🟢
   - Probability: Low (cosmetic issue)
   - Impact: Minor user confusion
   - Mitigation: 5-minute SQL cleanup before launch

---

## 12. Decision Points

### Decision 1: PolicyEngine Strategy

**Question**: How to handle benefit calculations?

**Options**:
- A) **Wait for API credentials** (1-2 weeks, full accuracy) ← Recommended if timeline flexible
- B) **Build custom SNAP calculator** (1-2 weeks, SNAP-only) ← Quick partial solution
- C) **Launch RAG-only** (immediate, no calculations) ← Fastest launch, degraded UX

**Recommendation**: **Option A** if PolicyEngine responds within 2 weeks, otherwise **Option B + C hybrid** (RAG for all programs, custom calculator for SNAP).

### Decision 2: Document Upload Priority

**Question**: Which programs to prioritize for golden source upload?

**Priority Order** (by user demand):
1. **MD_SNAP** (already complete ✅)
2. **MD_MEDICAID** (largest coverage, complex rules)
3. **MD_TCA** (TANF - high need population)
4. **MD_OHEP** (seasonal urgency - winter heating)
5. **MD_WIC** (nutrition - pregnant women, infants)
6. **MD_MCHP** (children's health)
7. **VITA** (tax season - Feb-April peak)

**Recommendation**: Upload Medicaid and TCA manuals first (highest impact).

### Decision 3: Launch Timeline

**Question**: When to launch?

**Scenarios**:
- **Optimistic** (2 weeks): PolicyEngine credentials + all docs uploaded → Full launch ✅
- **Realistic** (4 weeks): Custom SNAP calc + 3 program docs → Phased launch 🟡
- **Conservative** (8 weeks): OpenFisca custom engine + all docs → Complete system ✅

**Recommendation**: **Phased launch** at 4 weeks with RAG + SNAP calculations, add programs as documents arrive.

---

## 13. Next Steps (Immediate Actions)

### This Week

1. **Contact PolicyEngine** (Day 1)
   - Email: hello@policyengine.org
   - Request: Client ID/Secret for Maryland DHS project
   - Include: Use case, timeline, budget constraints

2. **Upload Priority Documents** (Day 1-3)
   - MD_MEDICAID: Download from health.maryland.gov
   - MD_TCA: Download from dhr.maryland.gov
   - Process through document pipeline (OCR, chunking, embeddings)

3. **Database Cleanup** (Day 2)
   - Run SQL to delete MD_ENERGY and MD_VITA duplicates
   - Verify no orphaned documents

4. **Test Baseline** (Day 3-5)
   - Run compliance validation on SNAP documents
   - Create demo navigator session
   - Document current RAG accuracy (without PolicyEngine)

### Next Week

5. **Build Fallback Calculator** (if PolicyEngine unavailable)
   - Implement USDA FY 2026 SNAP tables
   - Test against known scenarios
   - Add disclaimers for estimate accuracy

6. **Load Remaining Documents** (as available)
   - MD_OHEP, MD_WIC, MD_MCHP, VITA
   - Monitor processing quality scores

7. **Stakeholder Demo** (end of week)
   - Show RAG search capabilities
   - Demonstrate navigator workspace
   - Present PolicyEngine resolution plan

---

## 14. Contact & Escalation

**Technical Issues**:
- PolicyEngine Support: hello@policyengine.org
- Replit Environment: support@replit.com (NixOS library issues)

**Policy Documents**:
- MD DHS Family Investment: dhr.maryland.gov/contact
- MD Health Dept (Medicaid/MCHP): health.maryland.gov/mmcp
- IRS VITA Program: irs.gov/individuals/irs-tax-volunteers

**Project Escalation**:
- System Architecture: (Review replit.md for technical details)
- Benefit Calculation Alternatives: (See Alternative Solutions section)

---

## Summary

**Current State**: System infrastructure is 90% complete. RAG search, navigator workspace, and admin tools are fully operational. Main blockers are PolicyEngine calculations (affects 5 features) and missing policy documents (6/7 programs).

**Launch Options**:
1. **Full Launch** (4-8 weeks): Resolve PolicyEngine + upload all docs → Complete system
2. **Phased Launch** (2 weeks): RAG-only for all programs, add calculations as available
3. **SNAP-Only Launch** (1 week): Custom calculator + existing 99 SNAP docs → Limited scope

**Recommended Path**: Contact PolicyEngine immediately for API credentials. Meanwhile, upload Medicaid and TCA manuals (highest impact). If PolicyEngine unavailable in 2 weeks, build custom SNAP calculator and launch phased rollout.

---

**Last Updated**: October 10, 2025  
**Next Review**: After PolicyEngine response (target: October 17, 2025)
