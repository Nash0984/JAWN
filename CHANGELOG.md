# Changelog

All notable changes to the JAWN (Joint Access Welfare Network) platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.2.1] - 2026-01-19 🔍 **MULTI-PROGRAM SEARCH & WHITE-LABEL COMPLIANCE**

### 🚀 Feature Enhancement: SimplifiedSearch Multi-Program Support

#### **Public Portal Search Transformation**
Complete refactor of SimplifiedSearch from SNAP-only to full multi-program support:

- **Multi-Program Support**
  - Search across all 6 programs: SNAP, Medicaid, TANF, OHEP, SSI, VITA/Tax Credits
  - Program filter with visual groupings (Benefits vs Tax)
  - Context-aware placeholder text and descriptions

- **Dynamic State Selection**
  - States fetched from `/api/states/selector` API (white-label compliant)
  - Removed all hardcoded state names
  - State selection enforcement before search with toast prompts

- **Context-Aware Categories**
  - Benefits categories: Eligibility, Income Rules, Resources, Application
  - Tax categories: Filing Help, Tax Credits, Documents, Deadlines
  - Dynamic switching based on program filter selection

- **Backend API Enhancements**
  - `/api/public/faq` now accepts `state` and `program` query parameters
  - Inclusive NULL filtering (returns state-specific + federal/general content)
  - `/api/public/search-faq` accepts state/program in request body

### 🔧 White-Label Fixes

- **NoticeExplainer.tsx**: Replaced hardcoded "DHS" with `agencyAcronym` from tenant config
- **SimplifiedSearch.tsx**: Complete multi-program refactor with API-driven state list (removed hardcoded state names)

### 📖 Documentation Updates
- Updated UI_UX_REVIEW_SUMMARY.md with completed fixes
- Updated FEATURES.md Feature #5 with new capabilities
- Updated docs/API.md with state/program parameters
- Updated replit.md public portal description

---

## [2.2.0] - 2026-01-18 🎯 **HUMAN-IN-THE-LOOP PROVISION MAPPING PIPELINE**

### 🚀 Major Feature: Legislative Change Integration

#### **Human-in-the-Loop Provision Mapping Pipeline** (Feature 104)
Complete automated legislative change detection with mandatory human oversight:

- **Provision Extraction Service** (`provisionExtractor.service.ts`)
  - Gemini 2.0 Flash parses public law text
  - Extracts section-level amendments with U.S. Code citations
  - Identifies affected benefit programs (SNAP, TANF, Medicaid, etc.)
  - Provision types: `amends`, `supersedes`, `adds_exception`, `modifies_threshold`, `clarifies`, `removes`, `creates`

- **Ontology Matcher Service** (`ontologyMatcher.service.ts`)
  - **Citation Matching** (95% confidence): Exact U.S. Code citation lookup
  - **Semantic Similarity** (75% threshold): Gemini embedding cosine similarity against 176+ ontology terms
  - **AI Inference**: Gemini-powered reasoning for complex multi-term mappings

- **Provision Review UI** (`/admin/provision-review`)
  - Side-by-side law text and ontology term comparison
  - Priority filtering (urgent/high/normal/low)
  - Bulk approve/reject actions for efficiency
  - Affected rules badge showing Z3 re-verification queue depth
  - Real-time cache invalidation across all dashboard views

- **Z3 Re-verification Queue**
  - Approved mappings with affected formal rules trigger re-verification
  - `processingStatus` set to `pending_rule_verification` until Z3 confirms validity
  - Batch tracking via `verificationBatchId`
  - `appliedAt` deferred until re-verification completes

#### **Neuro-Symbolic Maintenance Methodology**
Key innovation extending the original academic framework:
1. **Neural Layer**: Gemini 2.0 Flash for extraction and matching
2. **Human Checkpoint**: Mandatory review before rules engine affected
3. **Symbolic Layer**: Z3 re-verification ensures continued formal validity

Result: No law changes automatically affect eligibility engine until human review AND Z3 re-verification complete.

### 📊 Database Updates
- Added `law_provisions` table for extracted legislative provisions
- Added `provision_ontology_mappings` table for AI-proposed and human-reviewed mappings
- Added indexes for status, priority, and term lookups

### 🔧 API Endpoints
- `GET /api/provision-mappings` - List mappings with filtering
- `GET /api/provision-mappings/stats` - Dashboard statistics
- `POST /api/provision-mappings/:id/approve` - Approve single mapping
- `POST /api/provision-mappings/:id/reject` - Reject single mapping
- `POST /api/provision-mappings/bulk-approve` - Bulk approve mappings

### 📖 Documentation
- Updated README.md with Strategic Positioning and Neuro-Symbolic Maintenance Methodology
- Added Feature 104 to FEATURES.md
- Updated docs/ARCHITECTURE.md with Neuro-Symbolic Hybrid Gateway section
- Updated docs/API.md with provision mapping endpoints
- Updated docs/DATABASE.md with new tables
- Feature count updated from 103 to 104

---

## [2.1.0] - 2026-01-11 🎯 **TECHNICAL DEBT CLEANUP & COMPLIANCE UPDATE**

### 🧹 Technical Debt Cleanup

#### **Removed Unused Code**
- **compliance.service.ts** - Removed (never imported)
- **manualDocumentExtractor.ts** - Removed (self-references only, superseded by UnifiedDocumentService)
- **puppeteer package** - Removed (replaced by Playwright for testing)
- **openai package** - Removed (unused, using Gemini API)
- **.rollback-backup/ directory** - Removed (14 orphaned schema rollback files)

#### **Documentation Updates**
- Updated all documentation dates to January 2026
- Replaced Twilio SMS references with Email (Nodemailer)
- Replaced Puppeteer references with Playwright for accessibility testing
- Updated compliance scores: NIST 88%, IRS Pub 1075 85%, GDPR 90%, HIPAA 88%
- Corrected integration test command in CONTRIBUTING.md

### 📊 Regression Testing
- **192 Integration Tests** - All passing
  - Research API: 32 tests
  - Benefit Screening: 24 tests
  - Tax Workflow: 36 tests
  - PER Module: 29 tests
  - Tax Calculations: 26 tests
  - IRS Consent: 18 tests
  - State Rules Engine: 23 tests

### 🔧 Technical Improvements
- Added regression gate documentation requiring 192+ tests for PRs
- State Rules Engine endpoints added to CSRF bypass list for read-only calculations
- Confirmed unified monolithic architecture (not sidecar)
- Verified 97.7% neuro-symbolic AI accuracy maintained

---

## [2.0.0] - 2025-10-23 🎯 **MULTI-STATE WHITE-LABELING MILESTONE**

### 🚀 Major Features - White-Label Multi-State Platform

#### **Breaking Changes**
- **JAWN Platform Transformation**: Evolved from Maryland-specific to multi-state white-label benefits-tax platform
- **Multi-Tenant Architecture**: Single unified application serves all states with tenant-aware branding
- **State Configuration System**: Dynamic state-specific rules engines, tax forms, and benefit calculations

#### **State Support Added**
- ✅ **Maryland** (Primary) - Complete implementation with 24 LDSS county offices
- 🔄 **Pennsylvania** (Priority #2) - Infrastructure ready, forms pending
- 🔄 **Virginia** - Infrastructure ready, forms pending  
- 🔄 **Utah** - Infrastructure ready, forms pending
- 🔄 **Indiana** - Infrastructure ready, forms pending
- 🔄 **Michigan** - Infrastructure ready, forms pending

#### **White-Labeling Implementation** (30 Files Transformed)

##### Phase 1: Critical Components (7 files)
- **IncomeLimitsManager.tsx** - State-specific SNAP income limits
- **VITAChatWidget.tsx** - State tax assistance chat
- **LDSSOfficeInfo.tsx** - State agency office information  
- **ConsentModal.tsx** - State-specific consent forms
- **InstallPrompt.tsx** - PWA state branding
- **SystemArchitecture.tsx** - State infrastructure documentation
- **CategoricalEligibilityManager.tsx** - State categorical eligibility rules

##### Phase 2: High-Traffic Pages (3 files)
- **admin/MarylandStateLawTracker.tsx** - State legislature bill tracking
- **NavigatorDashboard.tsx** - All UI copy (buttons, loading states, empty states, toasts)
- **Home.tsx** - Landing page branding

##### Phase 3: Public Portal Pages (4 files)  
- **public/BenefitScreener.tsx** - Multi-benefit screening tool
- **public/SimplifiedSearch.tsx** - State policy search
- **public/NoticeExplainer.tsx** - State agency notice parser
- **public/DocumentChecklist.tsx** - State-specific document requirements

##### Phase 4: Legal Compliance Pages (4 files)
- **legal/PrivacyPolicy.tsx** - State-neutral privacy policy
- **legal/TermsOfService.tsx** - Multi-state terms
- **legal/AccessibilityStatement.tsx** - State-agnostic accessibility
- **legal/BreachNotificationPolicy.tsx** - State-neutral data breach protocols

##### Phase 5: Admin & Feature Pages (11 files)
- **AdminDashboard.tsx** - Helmet title: "{stateName} Benefits Navigator"
- **VitaIntake.tsx** - VITA intake workflow
- **SupervisorReviewDashboard.tsx** - BAR supervisor review
- **AppointmentsCalendar.tsx** - Google Calendar appointments
- **CaseworkerCockpit.tsx** - Navigator workspace
- **admin/Monitoring.tsx** - System observability dashboard
- **TaxPreparation.tsx** - State tax forms (county labels, form buttons)
- **CrossEnrollmentAdmin.tsx** - Program enrollment recommendations
- **DocumentReviewQueue.tsx** - Document processing queue
- **admin/StateLawTracker.tsx** - State-specific law tracker wrapper
- **Analytics.tsx & HouseholdProfiler.tsx** - Verified zero Maryland UI references

##### Post-Testing Discovery: Branding Component (1 file)
- **CountyHeader.tsx** - Intelligent state-level tenant detection
  - Detects county-specific branding data (contains "city"/"county"/"baltimore")
  - Overrides with state-level branding when appropriate
  - Shows "{stateName} Department of Human Services" for state tenants
  - Preserves custom county branding when configured

### 🔧 Technical Improvements

#### **Tenant Context System**
- Async tenant synchronization pattern across all components
- State configuration loading from `/api/state-configurations/code/{stateCode}`
- Automatic state detection from URL path patterns
- 5-minute cache for state configuration queries

#### **Branding Override Logic**
- Smart detection: county keywords in data trigger state-level branding
- Priority order: state-level override > custom branding > county name
- Async race condition handling (wait for both branding + stateConfig)
- Runtime compensation for Baltimore City database defaults

#### **Backward Compatibility** 
- API field names preserved (e.g., `marylandTax`, `MarylandStatus`)
- Only UI text white-labeled per government software standards
- State-specific geography data appropriately retained
- Clarifying comments added for enterprise understanding

### 📊 Database Changes
- **Total Tables**: 179 (comprehensive schema for all features)
- **stateConfigurations** table - Multi-state configuration storage
- **tenantBranding** table - State/county-specific branding
- County-level tenant data preserved for Maryland's 24 LDSS offices
- Benefit program tables for all 6 states (SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI)

### 🐛 Bug Fixes
- **CountyHeader Branding Override** - Fixed async loading race condition
- **State Detection Logic** - Corrected priority order for branding display
- **County Keyword Detection** - Now checks both countyName and headerText fields

### 📝 Documentation Updates
- **MULTI_STATE_IMPLEMENTATION_PLAN.md** - Phase 1 completion documented
- **replit.md** - White-labeling achievement summary added
- **Component Comments** - All 30 files include white-labeling annotations

### 🔒 Security & Compliance
- Maintained GDPR/HIPAA compliance across all states
- State-neutral privacy policies and terms of service
- Multi-state data residency considerations documented

---

## [1.5.0] - 2025-10-17 🎯 **PRODUCTION READINESS MILESTONE**

### 🚀 Major Features

#### **Benefits Access Review (BAR) System** ✅
- Fully autonomous case quality monitoring with stratified sampling
- AI quality assessment via Google Gemini API
- Blind supervisor review dashboard with WebSocket real-time updates
- Automated notification infrastructure (email/SMS via Twilio)
- Orphaned checkpoint handling and edge case management

#### **E-Filing Dashboard** ✅
- Production-ready federal (Form 1040) and state (Maryland Form 502) e-filing
- Real-time WebSocket status updates for filing progress
- XML generation and validation for IRS/state submission
- Submission tracking with audit trail
- Error handling and retry mechanisms

#### **Tax Preparation System Enhancements** ✅
- Tax document extraction via Google Gemini Vision API
- VITA tax document upload workflow
- PolicyEngine integration for accurate tax calculations
- PDF generation for Form 1040 and Maryland Form 502
- Prior year tax return support

#### **TaxSlayer Document Management** ✅
- Enhanced VITA document workflow with quality validation
- Audit logging for all document operations
- Secure download functionality with access controls
- Document version tracking

### 🔧 Technical Improvements

#### **Unified Monitoring & Analytics Platform** ✅
- 7 observability domains (Errors, Security, Performance, E-Filing, AI, Cache, Health)
- Real-time WebSocket updates on admin dashboard
- Prometheus metrics export for production monitoring
- Comprehensive KPI tracking across all system components

#### **AI Orchestration Enhancements** ✅
- Strategy pattern for routing AI requests
- Centralized rate limiting (60 RPM for Gemini)
- Cost tracking and budget management
- Exponential backoff retry logic
- Gemini context caching for cost reduction

#### **Production Infrastructure** ✅
- PM2 cluster mode deployment for process management
- Scalable connection pooling with Neon Pooled Connections
- Distributed caching with Redis/Upstash integration
- Health check endpoints for load balancer integration
- Graceful shutdown handling

#### **Security Hardening** ✅
- Field-level encryption (AES-256-GCM)
- Enhanced session security with secure cookie settings
- CORS hardening with strict origin validation
- XSS sanitization and SQL injection protection
- Security monitoring dashboard
- Vulnerable dependencies eliminated (xlsx → ExcelJS)

### 📊 Database Schema Updates
- 131 tables with comprehensive relations
- Indexes optimized for query performance
- Server-side caching for frequently accessed data
- Connection pooling for high concurrency

### 🐛 Bug Fixes
- Rate limiting IPv6 validation errors resolved
- Concurrency issues in AI service calls fixed
- Database connection pool exhaustion prevented
- WebSocket connection stability improved

### 📝 Documentation
- Production deployment checklist created
- Security audit documentation completed
- API documentation with 367 endpoints
- Compliance matrix (GDPR/HIPAA) established

---

## [1.0.0] - 2025-09-15 🎉 **INITIAL PRODUCTION RELEASE**

### 🚀 Core Platform Features

#### **6-Program Benefits Integration**
- SNAP (Supplemental Nutrition Assistance Program)
- Medicaid (Medical Assistance)
- TANF (Temporary Assistance for Needy Families)
- OHEP (Office of Home Energy Programs)
- Tax Credits (EITC, CTC, ACTC)
- SSI (Supplemental Security Income)

#### **PolicyEngine Integration**
- Real-time benefit calculations for all 6 programs
- Household modeling with what-if scenarios
- Federal and Maryland state-specific rules
- Accurate eligibility determination

#### **Financial Opportunity Radar**
- Real-time eligibility tracking across all programs
- Dynamic change detection with visual indicators
- Cross-enrollment intelligence recommendations
- Summary dashboard with total benefits view

#### **Adaptive Intake Copilot**
- Conversational AI assistant for application guidance
- Natural language processing for data extraction
- Progress tracking with visual completion indicators
- Multi-language support (10 languages)

#### **Navigator Workspace**
- Client management and session tracking
- Export capabilities for E&E data
- Document verification queue
- Integrated benefit calculations

#### **Tax Preparation Foundation**
- Federal Form 1040 generation
- Maryland Form 502 generation
- Integration with PolicyEngine for tax calculations
- VITA intake workflow

#### **Public Portal**
- Anonymous benefit screener (no login required)
- Document checklist generator
- Notice letter explanation tool
- Simplified policy search

### 🔧 Technical Foundation

#### **Frontend Architecture**
- React 18 with TypeScript
- Vite build system
- shadcn/ui component library (Radix UI)
- Tailwind CSS for styling
- Command Palette for navigation
- Responsive mobile-first design

#### **Backend Architecture**
- Express.js with TypeScript
- PostgreSQL database via Drizzle ORM
- Google Gemini API integration
- Google Cloud Storage for documents
- Multi-stage document processing pipeline

#### **Authentication & Authorization**
- Role-based access control (RBAC)
- Session-based authentication
- CSRF protection
- Object-level security

#### **AI & Document Intelligence**
- OCR with Tesseract engine
- Document classification
- Semantic chunking and embedding generation
- RAG (Retrieval-Augmented Generation) system
- Rules as Code extraction pipeline

### 📊 Initial Database Schema
- 179 total tables (complete schema)
- Core tables: User authentication and sessions
- Benefits programs: SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI
- Tax preparation: Federal and state tax forms
- Document management: OCR, classification, storage
- AI & ML: RAG, embeddings, intake assistant
- Compliance: GDPR, HIPAA, audit logging

### 🔒 Security & Compliance
- GDPR compliance framework
- HIPAA compliance implementation
- Audit logging for all operations
- Encrypted field storage
- Secure file upload handling

### 📝 Documentation
- Comprehensive README with quick start guide
- API documentation
- Database schema documentation
- Deployment guide
- Contributing guidelines

---

## Version History Summary

```
v2.0.0 (2025-10-23) - Multi-State White-Labeling
v1.5.0 (2025-10-17) - Production Readiness & E-Filing
v1.0.0 (2025-09-15) - Initial Production Release
```

---

## Upcoming Releases

### [2.1.0] - Planned (Q4 2025)
- **Pennsylvania Implementation** - PA-40 tax form, state benefit rules
- **Philadelphia Municipal Benefits** - City-level program integration
- **Flat Tax Coalition** - Indiana (IN-40), Michigan (MI-1040) forms

### [2.2.0] - Planned (Q1 2026)
- **Virginia Implementation** - Progressive tax system, state forms
- **Utah Implementation** - Non-expansion Medicaid state support

---

**Maintained by**: JAWN Development Team  
**Last Updated**: 2025-10-23  
**Platform**: Joint Access Welfare Network (JAWN)  
**Repository**: Maryland Universal Benefits-Tax Navigator
