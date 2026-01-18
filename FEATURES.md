# JAWN Feature Catalog

**Version:** 4.2  
**Total Features:** 104

The JAWN (Joint Access Welfare Network) platform is a multi-state benefits-tax platform integrating 6 benefit programs (SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI) with federal/state tax preparation (VITA). The system includes quality control analytics, multi-county deployment, AI-powered assistance, legislative tracking, accessibility compliance, and enterprise compliance (GDPR/HIPAA).

---

## Table of Contents

1. [Public Access Features](#public-access-features)
2. [Eligibility & Calculation Tools](#eligibility--calculation-tools)
3. [Application Assistance](#application-assistance)
4. [Document Management](#document-management)
5. [Tax Preparation & VITA](#tax-preparation--vita)
6. [Navigator & Staff Tools](#navigator--staff-tools)
7. [Quality Control & Compliance](#quality-control--compliance)
8. [Administration & Configuration](#administration--configuration)
9. [Developer & Integration Tools](#developer--integration-tools)
10. [Multi-Tenant & County Management](#multi-tenant--county-management)
11. [Legislative & Regulatory Tracking](#legislative--regulatory-tracking)
12. [Infrastructure & Platform Operations](#infrastructure--platform-operations)
13. [Communication Systems](#communication-systems)
14. [Notification System](#notification-system)
15. [Caching & Performance](#caching--performance)
16. [Infrastructure & Mobile](#infrastructure--mobile)
17. [Accessibility & Compliance](#accessibility--compliance)
18. [Enterprise Compliance (GDPR/HIPAA)](#enterprise-compliance-gdprhipaa)

---

## Public Access Features

### 1. Anonymous Benefit Screener
**Location:** `/screener`  
**User Type:** Public (no login required)  
**Purpose:** Quick eligibility check for Maryland benefit programs

**Features:**
- No login required - privacy-first design
- 2-minute completion time
- Multi-program screening (SNAP, Medicaid, TANF, OHEP, Tax Credits)
- Option to create account and save results
- Mobile-optimized interface

**Technical Details:**
- Page: `client/src/pages/public/BenefitScreener.tsx`
- API: `POST /api/screener/check`
- Anonymous session management

  
---

### 2. Quick Screener
**Location:** `/public/quick-screener`  
**User Type:** Public  
**Purpose:** Ultra-minimal 5-question eligibility check

**Features:**
- 5 core questions only (household size, income, assets, location, elderly/disabled)
- Indexes toward inclusivity (reduces false negatives)
- 70% approval rate optimization
- No benefit estimates (keeps it simple)
- Clear "You may qualify!" messaging

**Technical Details:**
- Page: `client/src/pages/public/QuickScreener.tsx`
- Based on mRelief best practices
- Progressive disclosure pattern

  
---

### 3. Document Checklist Generator
**Location:** `/public/documents`  
**User Type:** Public  
**Purpose:** Generate personalized document requirement checklists

**Features:**
- Select programs or upload DHS notice
- AI-powered checklist generation
- Program-specific requirements
- Printable PDF output
- Mobile photo upload support

**Technical Details:**
- Page: `client/src/pages/public/DocumentChecklist.tsx`
- Component: `DocumentChecklistGenerator`
- API: `POST /api/public/generate-checklist`

  
---

### 4. Notice Explainer
**Location:** `/public/notices`  
**User Type:** Public  
**Purpose:** Plain-language explanation of DHS notices

**Features:**
- Upload or paste notice text
- AI-powered notice interpretation (Gemini)
- Reading level: Grade 6-8
- Action items extraction
- Deadline highlighting
- Multi-language support (10 languages)

**Technical Details:**
- Page: `client/src/pages/public/NoticeExplainer.tsx`
- API: `POST /api/public/explain-notice`
- Gemini-powered analysis

  
---

### 5. Simplified Policy Search
**Location:** `/public/search`  
**User Type:** Public  
**Purpose:** Search Maryland SNAP policy manual

**Features:**
- Natural language queries
- No login required for public policies
- Reading level optimization
- Official policy citations
- Mobile-responsive interface

**Technical Details:**
- Page: `client/src/pages/public/SimplifiedSearch.tsx`
- RAG-powered search
- Public policy access only

  
---

## Eligibility & Calculation Tools

### 6. Financial Opportunity Radar ⭐
**Location:** Integrated in `/household-profiler`  
**User Type:** All authenticated users  
**Purpose:** Real-time cross-program eligibility tracking

**Features:**
- Real-time eligibility across 6 programs (SNAP, Medicaid, TANF, EITC, CTC, SSI)
- Dynamic change indicators (↑↓ arrows, "New" badges)
- Smart alerts for cross-enrollment opportunities
- Summary dashboard (monthly/annual totals)
- 300ms debounced calculations
- Request cancellation (AbortController)
- CSRF-protected API calls

**Technical Details:**
- Component: `client/src/components/FinancialOpportunityRadar.tsx`
- Hook: `client/src/hooks/useEligibilityRadar.ts`
- API: `POST /api/eligibility/radar`
- Integration: Household Profiler sidebar

**Key Innovation:**
- First-time eligibility detection (0 → positive transitions)
- Benefit change tracking with amounts and percentages
- AI-powered optimization recommendations
- Single household profile drives all calculations

  
---

### 7. Household Profiler
**Location:** `/household-profiler`  
**User Type:** All authenticated users  
**Purpose:** Unified household data collection for benefits and tax

**Features:**
- Single data entry for all programs
- Real-time eligibility updates (via Radar)
- What-if scenario modeling
- Auto-save and session recovery
- Mobile-responsive form design
- Integration with Tax Preparation

**Technical Details:**
- Page: `client/src/pages/HouseholdProfiler.tsx`
- 3-column responsive layout (form | preview | radar)
- useWatch for real-time field tracking
- Form validation via react-hook-form + Zod

  
---

### 8. PolicyEngine Integration
**Location:** Multiple pages  
**User Type:** All authenticated users  
**Purpose:** Accurate multi-benefit calculations

**Features:**
- Federal and Maryland-specific rules
- SNAP, Medicaid, EITC, CTC, SSI, TANF calculations
- Tax liability and refund calculations
- Deduction optimization
- What-if scenario support

**Technical Details:**
- Service: `server/services/policyEngineHttpClient.ts`
- Python package: `policyengine-us`
- API: `POST /api/policyengine/calculate`
- Caching: Server-side with 5-minute TTL

  
---

### 9. Household Scenario Workspace
**Location:** `/scenarios`  
**User Type:** Navigators and staff  
**Purpose:** Compare multiple household configurations

**Features:**
- Create unlimited scenarios
- Side-by-side benefit comparisons
- Visual charts (Recharts)
- PDF export for client counseling
- Optimization recommendations
- What-if modeling tools

**Technical Details:**
- Page: `client/src/pages/ScenarioWorkspace.tsx`
- Database: `scenario_households`, `scenario_calculations`
- PDF generation: jsPDF + jspdf-autotable

  
---

### 10. Eligibility Checker
**Location:** `/eligibility`  
**User Type:** All authenticated users  
**Purpose:** Detailed eligibility determination

**Features:**
- Program-specific eligibility checks
- Categorical eligibility rules
- Income and asset verification
- Deduction calculations
- Household composition analysis

**Technical Details:**
- Page: `client/src/pages/EligibilityChecker.tsx`
- Rules engine integration
- PolicyEngine verification

  
---

## Application Assistance

### 11. Adaptive Intake Copilot
**Location:** `/intake`  
**User Type:** Applicants  
**Purpose:** Conversational AI-guided SNAP application

**Features:**
- Natural language conversation
- Smart data extraction from dialogue
- Progress tracking with visual indicators
- Real-time benefit estimates
- Auto-save and resume
- Integration with PolicyEngine

**Technical Details:**
- Page: `client/src/pages/IntakeCopilot.tsx`
- Component: `IntakeCopilotProgressIndicator`
- Service: `server/services/intakeCopilot.service.ts`
- AI: Gemini-powered conversation
- Database: `intake_sessions`, `intake_messages`

  
---

### 12. VITA Tax Intake
**Location:** `/vita-intake`  
**User Type:** Tax preparers and applicants  
**Purpose:** IRS Form 13614-C digital workflow

**Features:**
- Digital intake form (13614-C equivalent)
- Tax document upload (W-2, 1099, 1095-A)
- AI-powered data extraction (Gemini Vision)
- Auto-population of tax fields
- TaxSlayer integration ready

**Technical Details:**
- Page: `client/src/pages/VitaIntake.tsx`
- Document extraction: Gemini Vision API
- Form generation: IRS-compliant PDF

  
---

### 13. Tax Preparation
**Location:** `/tax`  
**User Type:** All authenticated users  
**Purpose:** Federal and Maryland state tax return preparation

**Features:**
- Form 1040 generation (federal)
- Maryland Form 502 generation (state)
- County tax calculations (24 Maryland counties)
- Maryland-specific credits (EITC supplement)
- Tax document upload and extraction
- PolicyEngine tax calculations
- Cross-enrollment analysis (tax → benefits)

**Technical Details:**
- Page: `client/src/pages/TaxPreparation.tsx`
- Service: `server/services/taxDocumentExtraction.ts`
- PDF: Form 1040 and 502 generators
- Integration: PolicyEngine US tax module

  
---

## Document Management

### 14. Document Verification System
**Location:** `/verify`  
**User Type:** All authenticated users  
**Purpose:** AI-powered document verification

**Features:**
- Upload documents (mobile photos, PDFs)
- Gemini Vision analysis
- Requirement matching against program rules
- Plain English verification results
- Verification stamps (APPROVED, REJECTED, NEEDS_INFO)
- Navigator notifications

**Technical Details:**
- Page: `client/src/pages/DocumentVerificationPage.tsx`
- Component: `DocumentVerificationInterface`
- Service: `server/services/documentProcessor.ts`
- AI: Gemini Vision API
- Storage: Google Cloud Storage

  
---

### 15. Document Review Queue
**Location:** `/navigator/document-review`  
**User Type:** Caseworkers  
**Purpose:** Staff review of uploaded documents

**Features:**
- Queue management with filters
- Document approval/rejection workflow
- Request additional information
- Bulk actions support
- Priority flagging
- SLA tracking

**Technical Details:**
- Page: `client/src/pages/DocumentReviewQueue.tsx`
- Database: `navigator_documents` table
- Status workflow: pending → approved/rejected/needs_info

  
---

### 16. Document Upload (General)
**Location:** `/upload`  
**User Type:** All authenticated users  
**Purpose:** General document upload functionality

**Features:**
- Uppy-based upload with progress
- Direct-to-storage (Google Cloud)
- Multiple file types support
- Mobile camera integration
- Drag-and-drop interface

**Technical Details:**
- Page: `client/src/pages/Upload.tsx`
- Component: `DocumentUpload`, `ObjectUploader`
- Storage: Google Cloud Storage with signed URLs

  
---

### 74. Document Versioning System
**Location:** Integrated in document management  
**User Type:** Administrators  
**Purpose:** Track and manage document versions over time

**Features:**
- Automatic version creation on document updates
- Version history tracking
- Diff visualization between versions
- Rollback to previous versions
- Version metadata (author, timestamp, changes)
- Version comparison tools

**Technical Details:**
- Service: `server/services/documentVersioning.ts`
- Database: `documentVersions`

  
---

### 75. Golden Source Tracking
**Location:** Integrated in policy management  
**User Type:** Administrators  
**Purpose:** Maintain authoritative source document references

**Features:**
- Source URL tracking for all policy documents
- Authoritative source validation
- Last verified timestamp
- Change detection from source
- Manual and automated verification
- Source integrity validation

**Technical Details:**
- Service: `server/services/documentVersioning.ts`
- Database: `policySources`, `documentVersions`

  
---

### 76. Document Hash Verification
**Location:** Integrated in document ingestion  
**User Type:** System (automated)  
**Purpose:** Ensure document integrity and detect tampering

**Features:**
- SHA-256 hash generation for all documents
- Automatic hash verification on retrieval
- Tamper detection alerts
- Hash-based deduplication
- Integrity audit trail
- Mismatch reporting

**Technical Details:**
- Service: `server/services/documentIngestion.ts`
- Database: `documentVersions` (hash column)

  
---

### 77. Automated Document Sync
**Location:** Background service  
**User Type:** System (automated)  
**Purpose:** Automatically sync documents from authoritative sources

**Features:**
- Scheduled document synchronization
- Source change detection
- Automatic version creation on changes
- Sync status tracking
- Error handling and retry logic
- Sync audit trail

**Technical Details:**
- Service: `server/services/automatedIngestion.ts`
- Database: `documentVersions`, `policySources`

  
---

## Tax Preparation & VITA

### 17. VITA Knowledge Base
**Location:** `/vita`  
**User Type:** Tax preparers  
**Purpose:** VITA tax preparation resources

**Features:**
- IRS Publication 17 reference
- VITA certification materials
- Tax law updates
- Common scenarios guide
- Error prevention checklist

**Technical Details:**
- Page: `client/src/pages/VitaKnowledgeBase.tsx`
- RAG-powered search
- IRS publication integration

  
---

### 18. Cross-Enrollment Intelligence Engine
**Location:** Integrated in Tax Preparation  
**User Type:** All authenticated users  
**Purpose:** Identify unclaimed benefits based on tax data

**Features:**
- AI analysis of tax return data
- Cross-program eligibility detection
- Benefit value estimation
- Recommendation generation
- One-click application initiation

**Technical Details:**
- Service: Cross-enrollment analysis
- Integration: Tax Preparation → Benefit Screener
- AI: Pattern recognition via Gemini

  
---

### 83. County Tax Rate Management
**Location:** Integrated in tax preparation  
**User Type:** Tax preparers  
**Purpose:** Manage county-specific tax rates for all 24 Maryland counties

**Features:**
- County tax rate configuration for 24 Maryland counties ✅
- Automatic rate application based on county ✅
- Tax year versioning ❌ (hard-coded, not versioned)
- Rate change history tracking ❌ (no history tracking)
- Bulk rate updates ❌ (no admin UI)
- County tax calculation integration ✅

**Technical Details:**
- Database: County tax rate tables ❌ (rates hard-coded in form502Generator.ts)
- Service: `server/services/form502Generator.ts` ✅
- Integration: Maryland Form 502 generator ✅

  
---

### 84. Maryland Credit Calculations
**Location:** Integrated in tax preparation  
**User Type:** Tax preparers  
**Purpose:** Calculate Maryland-specific tax credits

**Features:**
- Maryland EITC supplement calculation
- State-specific credit eligibility checks
- Credit amount calculation
- Multi-credit optimization
- Integration with PolicyEngine
- Form 502 credit population

**Technical Details:**
- Service: `server/services/policyEngineTaxCalculation.ts`
- Integration: PolicyEngine Maryland module

  
---

### 85. Tax Document Classification
**Location:** Integrated in VITA intake  
**User Type:** Tax preparers  
**Purpose:** AI-powered classification of uploaded tax documents

**Features:**
- Gemini Vision document type detection
- W-2, 1099, 1095-A classification
- Document completeness checking
- Missing document alerts
- Multi-document batch classification
- Classification confidence scoring

**Technical Details:**
- Service: `server/services/taxDocumentExtraction.ts`
- AI: Gemini Vision API
- Database: `taxDocuments`

  
---

### 86. Eligibility Audit Trail
**Location:** Integrated in eligibility system  
**User Type:** Administrators and caseworkers  
**Purpose:** Complete audit trail for eligibility determinations

**Features:**
- Full eligibility calculation history
- Input snapshot at time of calculation
- Rule version tracking
- Determination reasoning logging
- Change attribution
- Compliance audit support

**Technical Details:**
- Database: `eligibilityCalculations`, `crossEnrollmentAuditEvents`
- Service: `server/services/rulesEngine.ts`

  
---

### 87. Rules Snapshot Versioning
**Location:** Integrated in rules engine  
**User Type:** Administrators  
**Purpose:** Version control for eligibility rules over time

**Features:**
- Point-in-time rule snapshots
- Historical rule reconstruction
- Rule change tracking
- Retroactive calculation support
- Version comparison tools
- Regulatory compliance tracking

**Technical Details:**
- Database: `ruleChangeLogs`, `snapIncomeLimits`, `snapDeductions`, `snapAllotments` ✅
- Service: Integrated in `server/services/rulesEngine.ts` (no dedicated rulesAsCodeService)
- API: Rules management endpoints in `server/routes.ts`

  
---

### 110. E-Filing Dashboard
**Location:** `/efile`  
**User Type:** Navigators, Caseworkers, Administrators  
**Purpose:** Comprehensive e-filing management for federal and Maryland tax returns

**Features:**
- Federal Returns tab with submission status tracking
- Maryland Returns tab with linked federal returns
- E-File Queue monitoring with real-time status updates
- Validate tax returns before submission (IRS/Maryland business rules)
- Submit for e-filing (Form 1040 and Form 502)
- Download generated XML files (federal and state)
- Real-time WebSocket status updates with live connection indicator
- Toast notifications for status changes (transmitted, accepted, rejected)
- Auto-refresh data when status updates occur
- Retry functionality for rejected submissions
- Status badges (draft, ready, transmitted, accepted, rejected)
- Transmission ID tracking
- Submission and acceptance date display

**Technical Details:**
- Page: `client/src/pages/EFileDashboard.tsx` (699 lines)
- Backend Routes:
  - `server/api/efile.routes.ts` - Federal e-filing endpoints (7 routes)
  - `server/api/marylandEfile.routes.ts` - Maryland e-filing endpoints (5 routes)
- Service: `server/services/eFileQueueService.ts` (802 lines)
- WebSocket: Real-time updates via `server/services/websocket.service.ts`
- Hook: `client/src/hooks/useWebSocket.ts` for dashboard integration
- API Endpoints:
  - Federal: POST/GET/DELETE /api/efile/submit/:id, /api/efile/validate/:id, /api/efile/status/:id, /api/efile/xml/:id, /api/efile/retry/:id, /api/efile/queue/pending, /api/efile/queue/recent
  - Maryland: POST/GET/DELETE /api/maryland/efile/submit/:id, /api/maryland/efile/validate/:id, /api/maryland/efile/status/:id, /api/maryland/efile/xml/:id, /api/maryland/efile/retry/:id
- Authentication: All routes protected with requireAuth middleware
- Database: Utilizes `federalTaxReturns` and `marylandTaxReturns` tables with efileStatus tracking

  
---

## Navigator & Staff Tools

### 19. Navigator Workspace
**Location:** `/navigator`  
**User Type:** Navigators  
**Purpose:** Client case management

**Features:**
- Client session tracking
- Interaction logging
- Document management per client
- E&E export generation (XML format)
- Case notes and history
- Integration with all tools

**Technical Details:**
- Page: `client/src/pages/NavigatorWorkspace.tsx`
- Database: `navigator_cases`, `navigator_sessions`
- Export: Maryland E&E XML format

  
---

### 20. Navigator Dashboard
**Location:** `/navigator/dashboard`  
**User Type:** Navigators  
**Purpose:** Personal navigator metrics and tasks

**Features:**
- Active cases overview
- Document review tasks
- Performance metrics
- Achievement tracking (gamification)
- Quick actions panel
- Recent activity feed

**Technical Details:**
- Page: `client/src/pages/NavigatorDashboard.tsx`
- Real-time notifications
- WebSocket updates

  
---

### 21. Navigator Performance
**Location:** `/navigator/performance`  
**User Type:** Navigators  
**Purpose:** Individual performance analytics

**Features:**
- Case completion rates
- Client satisfaction scores
- Document processing speed
- Benefit maximization metrics
- Monthly trends and insights
- Goal tracking

**Technical Details:**
- Page: `client/src/pages/NavigatorPerformance.tsx`
- Visualization: Recharts
- Gamification integration

  
---

### 22. Client Dashboard
**Location:** `/client/dashboard`  
**User Type:** Applicants  
**Purpose:** Applicant self-service portal

**Features:**
- Application status tracking
- Document upload
- Benefit status overview
- Appointment scheduling
- Message center
- Notification preferences

**Technical Details:**
- Page: `client/src/pages/ClientDashboard.tsx`
- Real-time status updates
- Document tracking

  
---

### 23. Consent Management
**Location:** `/consent`  
**User Type:** Staff and applicants  
**Purpose:** Digital consent form system

**Features:**
- Consent form creation and templates
- Digital signature capture
- Version control
- Expiration tracking
- Revocation support
- Audit trail

**Technical Details:**
- Page: `client/src/pages/ConsentManagement.tsx`
- Database: `consent_forms`, `client_consents`
- Legal compliance tracking

  
---

## Quality Control & Compliance

### 24. Caseworker Cockpit ⭐
**Location:** `/caseworker/cockpit`  
**User Type:** Caseworkers  
**Purpose:** Personal QA dashboard with error prevention

**Features:**
- Flagged cases panel with AI risk scores
- Error trend analytics (4 quarters)
- AI-recommended training interventions
- Quick job aids library (7 guides)
- Context-aware tips dialog
- Performance tracking

**Technical Details:**
- Page: `client/src/pages/CaseworkerCockpit.tsx`
- Database: `qc_error_patterns`, `flagged_cases`, `job_aids`
- 6 Maryland SNAP error categories
- Synthetic data for training

  
---

### 25. Supervisor Cockpit ⭐
**Location:** `/supervisor/cockpit`  
**User Type:** Supervisors  
**Purpose:** Team QA oversight and predictive analytics

**Features:**
- Team error trend alerts with spike detection
- Diagnostic drill-downs by error category
- Proactive case flagging system
- Training impact analytics
- Payment Error Rate (PER) tracking
- Real-time team metrics

**Technical Details:**
- Page: `client/src/pages/SupervisorCockpit.tsx`
- Database: `training_interventions`
- Predictive analytics engine
- Before/after effectiveness tracking

  
---

### 26. Compliance Assurance Suite
**Location:** `/compliance`  
**User Type:** Administrators  
**Purpose:** Automated compliance validation

**Features:**
- WCAG 2.1 AA compliance checking
- LEP (Limited English Proficiency) validation
- Federal regulation alignment
- Policy change impact analysis
- Gemini-powered validation
- Violation tracking and remediation

**Technical Details:**
- Page: `client/src/pages/ComplianceAdmin.tsx`
- Database: `compliance_rules`, `compliance_violations`
- AI: Gemini compliance analysis

  
---

### 27. Maryland Evaluation Framework
**Location:** `/evaluation`  
**User Type:** Administrators  
**Purpose:** Accuracy testing and validation

**Features:**
- Test case creation and management
- Automated test runs
- Accuracy scoring
- Multi-program validation
- Regression testing
- Performance benchmarks

**Technical Details:**
- Page: `client/src/pages/EvaluationFramework.tsx`
- Database: `evaluation_test_cases`, `evaluation_runs`
- PolicyEngine verification

  
---

### 81. Training Intervention Tracking
**Location:** Integrated in QC Cockpits  
**User Type:** Supervisors  
**Purpose:** Track and measure effectiveness of training interventions

**Features:**
- Training assignment based on error patterns
- Pre/post training performance metrics
- Intervention effectiveness scoring
- Training impact analytics
- Recommended training paths
- Completion tracking

**Technical Details:**
- Database: `trainingInterventions`, `qcErrorPatterns`
- Service: `server/services/qcSyntheticData.ts`

  
---

### 82. Error Pattern Analytics
**Location:** Integrated in QC Cockpits  
**User Type:** Caseworkers and Supervisors  
**Purpose:** Identify and analyze error patterns across cases

**Features:**
- 6 Maryland SNAP error category tracking
- Error frequency analysis
- Pattern detection algorithms
- Risk scoring for cases
- Predictive analytics for future errors
- Trend visualization (4 quarters)

**Technical Details:**
- Database: `qcErrorPatterns`, `flaggedCases`
- Service: QC analytics

  
---

## Administration & Configuration

### 28. Admin Dashboard
**Location:** `/admin`  
**User Type:** Administrators  
**Purpose:** Central system administration

**Features:**
- User management and roles
- System configuration
- Policy source management
- Document ingestion control
- Performance monitoring
- Security settings

**Technical Details:**
- Page: `client/src/pages/Admin.tsx`
- Component: `AdminDashboard`
- Full system control

  
---

### 29. Policy Management
**Location:** Multiple admin pages  
**User Type:** Administrators  
**Purpose:** Policy content and rules management

**Features:**
- Policy source management (`/policy-sources`)
- Policy manual editing (`/manual`)
- Policy change tracking (`/policy-changes`)
- Rules extraction pipeline (`/rules-extraction`)
- Version control and diff viewing
- Impact analysis

**Technical Details:**
- Pages: `PolicySources.tsx`, `PolicyManual.tsx`, `PolicyChanges.tsx`, `RulesExtraction.tsx`
- Service: Rules extraction pipeline
- AI: Gemini-powered rule extraction

  
---

### 78. Policy Source Sync Automation
**Location:** Integrated in policy management  
**User Type:** System (automated)  
**Purpose:** Automated synchronization of policy documents from authoritative sources

**Features:**
- Automated web scraping configuration
- Scheduled policy source checks
- Change detection and alerts
- Multi-source aggregation
- Sync status monitoring
- Error notification and recovery

**Technical Details:**
- Service: `server/services/policySourceScraper.ts`
- Database: `policySources`

  
---

### 79. Web Scraping Configuration
**Location:** `/admin/policy-sources/scraping`  
**User Type:** Administrators  
**Purpose:** Configure web scraping for policy sources

**Features:**
- Scraping rules configuration
- CSS selector management
- Rate limiting configuration
- User agent rotation
- Proxy support
- Scraping schedule management

**Technical Details:**
- Service: `server/services/manualScraper.ts`
- Configuration in policy sources

  
---

### 80. Document Count Tracking
**Location:** Integrated in policy management  
**User Type:** Administrators  
**Purpose:** Track document counts across all policy sources

**Features:**
- Real-time document count by source
- Historical count trending
- Missing document detection
- Count variance alerts
- Source health monitoring
- Anomaly detection

**Technical Details:**
- Database: `policySources` (document count columns)
- API: Policy source endpoints

  
---

### 30. Security Monitoring
**Location:** `/admin/security`  
**User Type:** Super admins  
**Purpose:** Security audit and monitoring

**Features:**
- Failed login tracking
- Suspicious activity detection
- API abuse monitoring
- Rate limit visualization
- Access pattern analysis
- Threat alerts

**Technical Details:**
- Page: `client/src/pages/SecurityMonitoring.tsx`
- Real-time monitoring
- Alert system integration

  
---

### 31. AI Monitoring Dashboard
**Location:** `/admin/ai-monitoring`  
**User Type:** Administrators  
**Purpose:** AI model performance tracking

**Features:**
- Model accuracy metrics
- API usage and costs
- Response time monitoring
- Error rate tracking
- A/B test results
- Model version management

**Technical Details:**
- Page: `client/src/pages/AIMonitoring.tsx`
- Gemini API monitoring
- Performance analytics

  
---

### 32. Feedback Management
**Location:** `/admin/feedback`  
**User Type:** Administrators  
**Purpose:** User feedback collection and review

**Features:**
- Feedback collection widget
- Sentiment analysis
- Category assignment
- Response tracking
- Trend analysis
- Action item generation

**Technical Details:**
- Page: `client/src/pages/FeedbackManagement.tsx`
- Component: `FeedbackButton`
- Database: `user_feedback`

  
---

### 33. Audit Logs
**Location:** `/admin/audit`  
**User Type:** Administrators  
**Purpose:** System audit trail

**Features:**
- Comprehensive action logging
- User activity tracking
- Data change history
- Security event logging
- Export capabilities
- Compliance reporting

**Technical Details:**
- Page: `client/src/pages/AuditLogs.tsx`
- Database: `audit_logs`
- Retention policies

  
---

### 34. Training Module
**Location:** `/training`  
**User Type:** All staff  
**Purpose:** Staff training and certification

**Features:**
- Training material access
- Certification tracking
- Interactive tutorials
- Knowledge assessments
- Progress tracking
- Certificate generation

**Technical Details:**
- Page: `client/src/pages/Training.tsx`
- LMS integration
- Certification tracking

  
---

## Developer & Integration Tools

### 35. Developer Portal
**Location:** `/developer`  
**User Type:** Developers and integrators  
**Purpose:** API integration and testing

**Features:**
- API key generation
- Webhook configuration
- Integration guides
- Testing sandbox
- Code examples
- SDK downloads

**Technical Details:**
- Page: `client/src/pages/DeveloperPortal.tsx`
- API key management
- OAuth integration

  
---

### 36. API Documentation (Swagger)
**Location:** `/api-docs`  
**User Type:** Developers  
**Purpose:** Interactive API documentation

**Features:**
- Swagger UI interface
- Try-it-out functionality
- Request/response examples
- Authentication testing
- Endpoint search
- Export OpenAPI spec

**Technical Details:**
- Page: `client/src/pages/ApiDocs.tsx`
- OpenAPI 3.0 spec
- Interactive testing

  
---

### 72. API Key Management
**Location:** `/developer/api-keys`  
**User Type:** Developers  
**Purpose:** Secure API key generation and management

**Features:**
- API key generation with scoped permissions
- Key rotation and revocation
- Usage analytics per key
- Rate limit configuration per key
- IP allowlist/blocklist
- Expiration date configuration
- Audit trail for key usage

**Technical Details:**
- Database: `apiKeys`, `apiUsageLogs`
- Service: `server/services/apiKeyService.ts`
- API: `POST /api/admin/api-keys`, `GET /api/admin/api-keys/:keyId/stats`
- Middleware: `server/middleware/apiKeyAuth.ts`

  
---

### 73. Webhook Management System
**Location:** `/developer/webhooks`  
**User Type:** Developers  
**Purpose:** Configure webhooks for event notifications

**Features:**
- Webhook endpoint registration (partial - Twilio only)
- Event subscription configuration (partial)
- Signature verification (Twilio)
- Retry logic with exponential backoff (planned)
- Webhook delivery logs (partial)
- Test webhook delivery (planned)
- Event filtering (planned)

**Technical Details:**
- Database: `webhooks` ✅
- Service: `server/services/webhookService.ts` ❌ (not implemented)
- API: Twilio webhooks at `/api/sms` ✅
- Routes: `server/routes/twilioWebhooks.ts` ✅

  
---

## Multi-Tenant & County Management

### 37. County Management
**Location:** `/admin/counties`  
**User Type:** Super admins  
**Purpose:** Multi-county configuration

**Features:**
- County-specific branding
- Contact information management
- Staff assignment by county
- Program availability by county
- Localized content
- Data isolation

**Technical Details:**
- Page: `client/src/pages/CountyManagement.tsx`
- Database: `counties` table
- 24 Maryland counties supported

  
---

### 38. County Analytics
**Location:** `/admin/county-analytics`  
**User Type:** Administrators  
**Purpose:** County-level performance metrics

**Features:**
- Application volume by county
- Approval rates comparison
- Navigator performance by county
- Program utilization metrics
- Demographic insights
- Trend analysis

**Technical Details:**
- Page: `client/src/pages/CountyAnalytics.tsx`
- Visualization: Recharts
- Comparative analytics

  
---

### 39. ABAWD Verification Admin
**Location:** `/admin/abawd`  
**User Type:** Administrators  
**Purpose:** ABAWD work requirement exemption management

**Features:**
- Exemption verification
- Work requirement tracking
- Compliance monitoring
- Exemption documentation
- Reporting tools
- Appeal management

**Technical Details:**
- Page: `client/src/pages/AbawdVerificationAdmin.tsx`
- Database: `abawd_exemptions`
- Federal compliance tracking

  
---

### 40. Cross-Enrollment Admin
**Location:** `/admin/cross-enrollment`  
**User Type:** Administrators  
**Purpose:** Cross-program enrollment management

**Features:**
- Enrollment pipeline configuration
- Success rate tracking
- Barrier identification
- Optimization recommendations
- Performance metrics
- Impact analysis

**Technical Details:**
- Page: `client/src/pages/CrossEnrollmentAdmin.tsx`
- Database: `program_enrollments`
- Analytics dashboard

  
---

### 41. Leaderboard (Gamification)
**Location:** `/leaderboard`  
**User Type:** All staff  
**Purpose:** Performance gamification

**Features:**
- Navigator rankings
- Achievement badges
- Point system
- Weekly/monthly competitions
- Team comparisons
- Reward tracking

**Technical Details:**
- Page: `client/src/pages/Leaderboard.tsx`
- Component: `AchievementNotification`
- Real-time updates

  
---

## Infrastructure & Mobile

### 42. Notification Center
**Location:** `/notifications`  
**User Type:** All authenticated users  
**Purpose:** In-app notification management

**Features:**
- Real-time notifications
- Notification bell with count
- Mark as read/unread
- Notification filtering
- Priority alerts
- Email backup option

**Technical Details:**
- Page: `client/src/pages/NotificationCenter.tsx`
- Component: `NotificationBell`
- WebSocket: Real-time updates
- Database: `notifications`

  
---

### 43. Notification Settings
**Location:** `/notifications/settings`  
**User Type:** All authenticated users  
**Purpose:** Notification preference management

**Features:**
- Channel preferences (in-app, email, SMS)
- Notification type selection
- Quiet hours configuration
- Frequency settings
- Opt-out controls

**Technical Details:**
- Page: `client/src/pages/NotificationSettings.tsx`
- Database: `notification_preferences`

  
---

### 44. PWA Installation
**Location:** Throughout app  
**User Type:** All users  
**Purpose:** Progressive Web App offline support

**Features:**
- Install prompt
- Offline functionality
- Service Workers
- Cached critical data
- Background sync
- Push notifications

**Technical Details:**
- Component: `InstallPrompt`
- Service Worker configuration
- IndexedDB caching
- Offline-first architecture

  
---

### 45. Mobile Bottom Navigation
**Location:** Mobile view  
**User Type:** Mobile users  
**Purpose:** Mobile-optimized navigation

**Features:**
- Bottom tab navigation
- Touch-optimized (44x44pt minimum)
- Role-based menu items
- Badge notifications
- Quick actions
- Swipe gestures

**Technical Details:**
- Component: `MobileBottomNav`
- Responsive breakpoints
- Mobile-first design

  
---

### 46. Command Palette
**Location:** Global (Cmd/Ctrl+K)  
**User Type:** All authenticated users  
**Purpose:** Quick navigation and actions

**Features:**
- Keyboard shortcut (Cmd/Ctrl+K)
- Fuzzy search
- Role-based filtering
- Recent items
- Quick actions
- Keyboard navigation

**Technical Details:**
- Component: `CommandPalette`
- cmdk library
- Global hotkey

  
---

## Legislative & Regulatory Tracking

### 47. Federal Law Tracker
**Location:** `/admin/federal-law-tracker`  
**User Type:** Administrators  
**Purpose:** Real-time tracking of federal SNAP legislation via Congress.gov

**Features:**
- Congress.gov API integration ✅
- Bill status monitoring (introduced, passed, enacted) ✅
- Public law tracking ✅
- Legislative impact analysis (see Feature #52 - not implemented)
- Automated alerts for relevant bills ✅
- Historical tracking of SNAP-related legislation ✅

**Technical Details:**
- Page: `client/src/pages/FederalLawTracker.tsx` ❌ (not implemented)
- Service: `server/services/congressBillTracker.ts` ✅
- API: `POST /api/legislative/congress-search`, `POST /api/legislative/congress-sync` ✅
- Database: `congressionalBills`, `publicLaws` ✅

  
---

### 48. Maryland State Law Tracker
**Location:** `/admin/maryland-law-tracker`  
**User Type:** Administrators  
**Purpose:** Track Maryland state legislation affecting benefits programs

**Features:**
- MGA Legislature website scraping ✅
- Bill tracking for state-level SNAP, Medicaid, TANF changes ✅
- Session tracking (current and historical) ✅
- Committee assignment monitoring ✅
- Sponsor tracking ✅
- Real-time status updates ✅

**Technical Details:**
- Page: `client/src/pages/MarylandStateLawTracker.tsx` ❌ (not implemented)
- Service: `server/services/marylandLegislatureScraper.ts` ✅
- API: `POST /api/legislative/maryland-scrape` ✅
- Database: `marylandBills` ✅

  
---

### 49. GovInfo Bill Status Download
**Location:** Integrated in Federal Law Tracker  
**User Type:** Administrators  
**Purpose:** Bulk download of bill status data in XML format

**Features:**
- GovInfo API integration
- Bulk XML bill status downloads
- Public law document retrieval
- Automated version checking
- Historical data access
- Metadata extraction

**Technical Details:**
- Service: `server/services/govInfoBillStatusDownloader.ts`
- Service: `server/services/govInfoPublicLawsDownloader.ts`
- API: `POST /api/legislative/govinfo-bill-status`, `POST /api/legislative/govinfo-public-laws`
- Database: `congressionalBills`, `publicLaws`

  
---

### 50. GovInfo Version Tracking
**Location:** Integrated in document management  
**User Type:** Administrators  
**Purpose:** Track and compare different versions of federal documents

**Features:**
- Document version detection
- Change tracking and diff viewing
- Historical version archive
- Automated version alerts
- Source verification
- Content comparison tools

**Technical Details:**
- Service: `server/services/govInfoVersionChecker.ts`
- API: `POST /api/govinfo/check-versions`, `GET /api/govinfo/version-history`
- Database: `documentVersions`

  
---

### 51. FNS State Options Parser
**Location:** `/admin/fns-state-options`  
**User Type:** Administrators  
**Purpose:** Parse and track SNAP state option variations across all states

**Features:**
- FNS state option document parsing ✅
- State-specific SNAP rule tracking ✅
- Option change detection ✅
- Status history tracking ✅
- Comparative state analysis ✅
- Policy variance identification ✅

**Technical Details:**
- Page: `client/src/pages/admin/FNSStateOptionsManager.tsx` ✅
- Service: `server/services/fnsStateOptionsParser.ts` ✅
- API: `GET /api/fns-state-options` (list with filters), `POST /api/policy-sources/fns-state-options` (sync) ✅
- Database: `stateOptionsWaivers`, `marylandStateOptionStatus` ✅

  
---

### 52. Legislative Impact Analysis
**Location:** Integrated in law trackers  
**User Type:** Administrators  
**Purpose:** Analyze impact of legislative changes on eligibility and benefits

**Features:**
- AI-powered impact assessment (planned)
- Benefit calculation impact prediction (planned)
- Affected population estimation (planned)
- Policy change recommendations (planned)
- Cross-program impact analysis (planned)
- Compliance requirement updates (planned)

**Technical Details:**
- Service: `server/services/legislativeImpactService.ts` ❌ (not implemented)
- Database: `policyChangeImpacts` (schema may exist but service not implemented)
- AI: Gemini-powered analysis (planned)

  
---

## Infrastructure & Platform Operations

### 53. Tenant Management System
**Location:** `/admin/tenants`  
**User Type:** Super administrators  
**Purpose:** Multi-tenant SaaS configuration and isolation

**Features:**
- Tenant creation and configuration
- Custom branding per tenant
- Data isolation enforcement
- Tenant-specific feature flags
- Usage analytics per tenant
- Billing and subscription management

**Technical Details:**
- Service: `server/services/tenantService.ts`
- API: `GET /api/admin/tenants`, `POST /api/admin/tenants`, `PATCH /api/admin/tenants/:id/branding`
- Database: `tenants`, `tenantBranding`

  
---

### 54. Monitoring Dashboard
**Location:** `/admin/monitoring`  
**User Type:** Administrators  
**Purpose:** Real-time system monitoring and observability

**Features:**
- Sentry error tracking integration
- System metrics visualization
- Performance monitoring
- API response time tracking
- Error rate alerts
- Service health status
- Custom metric recording

**Technical Details:**
- Page: `client/src/pages/admin/Monitoring.tsx`
- Services: `server/services/metricsService.ts`, `server/services/sentryService.ts`
- API: `GET /api/admin/monitoring/metrics`, `POST /api/admin/monitoring/test-error`
- Database: `monitoringMetrics`

  
---

### 55. Alert Management System
**Location:** Integrated in Monitoring Dashboard  
**User Type:** Administrators  
**Purpose:** System alert configuration and response

**Features:**
- Alert threshold configuration
- Multi-channel notifications (email, SMS, in-app)
- Alert history tracking
- Alert resolution workflow
- Escalation policies
- On-call rotation support

**Technical Details:**
- Service: `server/services/alertService.ts`
- API: `GET /api/admin/monitoring/alerts`, `POST /api/admin/monitoring/alerts/:alertId/resolve`
- Database: `alertHistory`

  
---

### 56. Cache Management Dashboard
**Location:** `/admin/cache`  
**User Type:** Administrators  
**Purpose:** Monitor and manage multi-layer caching system

**Features:**
- Cache hit/miss rate visualization
- Cache type breakdown (embeddings, RAG, PolicyEngine, documents)
- Manual cache clearing by type
- Memory usage tracking
- Performance metrics
- Cost savings calculation

**Technical Details:**
- Service: `server/services/cacheMetrics.ts`
- API: `GET /api/admin/cache/stats`, `POST /api/admin/cache/clear/:type`
- In-memory caching with node-cache

  
---

### 57. Cost Savings Reporting
**Location:** Integrated in Cache Dashboard  
**User Type:** Administrators  
**Purpose:** Track cost savings from caching and optimization

**Features:**
- API call cost avoidance calculation
- Gemini API cost savings tracking
- PolicyEngine call reduction metrics
- ROI visualization
- Projected monthly savings
- Historical cost trend analysis

**Technical Details:**
- Service: `server/services/cacheMetrics.ts`
- API: `GET /api/admin/cache/cost-savings`
- Computed metrics (no persistent database)

  
---

### 58. Smart Scheduler
**Location:** `/admin/scheduler`  
**User Type:** Administrators  
**Purpose:** Intelligent scheduling of automated data ingestion

**Features:**
- Adaptive polling frequency ✅
- Document change detection ✅
- Source prioritization ✅
- Failure retry logic with exponential backoff ✅
- Manual trigger capability ✅
- Schedule override controls (partial)
- Performance optimization ✅

**Technical Details:**
- Page: `client/src/pages/SmartScheduler.tsx` ❌ (not implemented)
- Service: `server/services/smartScheduler.ts` ✅
- API: `GET /api/scheduler/status`, `POST /api/scheduler/trigger/:source` ✅
- Database: `documentVersions` ✅

  
---

### 59. Automated Ingestion Service
**Location:** Background service  
**User Type:** System (automated)  
**Purpose:** Automated policy document ingestion and processing

**Features:**
- Scheduled document retrieval
- Multi-source ingestion (Congress.gov, GovInfo, state websites)
- Document validation and verification
- Automatic chunking for RAG
- Error handling and recovery
- Ingestion audit trail

**Technical Details:**
- Service: `server/services/automatedIngestion.ts`
- API: `GET /api/automated-ingestion/schedules`, `POST /api/automated-ingestion/trigger`
- Database: Multiple document tables

  
---

### 60. Golden Source Audit System
**Location:** `/admin` (Documents tab)  
**User Type:** Administrators  
**Purpose:** Verify authoritative source document integrity

**Features:**
- Document hash verification ✅
- Source URL validation ✅
- Version consistency checks ✅
- Integrity audit reports ✅
- Tamper detection ✅
- Document provenance tracking ✅

**Technical Details:**
- UI Component: `DocumentIngestionPanel` in `client/src/pages/Admin.tsx` ✅
- Service: `server/services/documentIngestion.ts` ✅
- API: `GET /api/golden-source/documents`, `POST /api/golden-source/verify/:documentId`, `GET /api/golden-source/audit-trail/:documentId` ✅
- Database: `documentVersions`, `policySources` ✅

  
---

## Communication Systems

### 61. SMS Integration System
**Location:** `/admin/sms` (configuration)  
**User Type:** Administrators and clients  
**Purpose:** Two-way SMS communication for client engagement

**Features:**
- Twilio integration for SMS messaging
- Two-way conversation support
- SMS templates management
- Tenant-specific Twilio configuration
- Message history tracking
- Automated responses
- Conversation threading

**Technical Details:**
- Page: `client/src/pages/admin/SmsConfig.tsx` (configuration only)
- Services: `server/services/smsService.ts`, `server/services/smsConversationEngine.ts`
- API: SMS endpoints in `server/routes.ts`
- Database: `smsConversations`, `smsMessages`, `smsTenantConfig`

  
---

## Notification System

### 62. Real-time In-App Notifications
**Location:** Throughout application  
**User Type:** All authenticated users  
**Purpose:** Real-time notification delivery via WebSocket

**Features:**
- WebSocket-based real-time updates
- Notification bell with live count
- Toast notifications for urgent alerts
- Categorized notification types
- Read/unread tracking
- Notification grouping
- Action buttons in notifications

**Technical Details:**
- Component: `client/src/components/NotificationBell.tsx`
- Hook: `client/src/hooks/useRealtimeNotifications.ts`
- Service: `server/services/websocket.service.ts`
- Database: `notifications`

  
---

### 63. Email Notification Backup
**Location:** Background service  
**User Type:** All users  
**Purpose:** Email fallback for critical notifications

**Features:**
- Automatic email sending for missed in-app notifications
- Configurable email frequency
- HTML email templates
- Batch email digest option
- Delivery tracking
- Bounce handling

**Technical Details:**
- Service: `server/services/email.service.ts`
- Database: `notifications`, `notificationPreferences`

  
---

### 64. Notification Preferences Management
**Location:** `/notifications/settings`  
**User Type:** All authenticated users  
**Purpose:** User control over notification delivery

**Features:**
- Channel selection (in-app, email, SMS)
- Notification type filtering
- Frequency controls (immediate, daily digest, weekly)
- Quiet hours configuration
- Per-category preferences
- Opt-out controls

**Technical Details:**
- Page: `client/src/pages/NotificationSettings.tsx`
- API: `GET /api/notifications/preferences`, `PATCH /api/notifications/preferences`
- Database: `notificationPreferences`

  
---

### 65. Notification Templates System
**Location:** Admin configuration  
**User Type:** Administrators  
**Purpose:** Manage notification content templates

**Features:**
- Template creation and editing
- Variable substitution support
- Multi-channel templates (in-app, email, SMS)
- Version control
- A/B testing support
- Localization support

**Technical Details:**
- Database: `notificationTemplates`
- Service: `server/services/notification.service.ts`

  
---

## Caching & Performance

### 66. Multi-Layer Caching System
**Location:** Server infrastructure  
**User Type:** System (automatic)  
**Purpose:** Comprehensive caching to reduce API costs and improve performance

**Features:**
- Layer 1: Gemini embeddings cache (1 hour TTL)
- Layer 2: RAG query results cache (5 minute TTL)
- Layer 3: Document analysis cache (30 minute TTL)
- Layer 4: PolicyEngine calculations cache (5 minute TTL)
- Automatic cache invalidation
- LRU eviction policy

**Technical Details:**
- Service: `server/services/cacheService.ts`
- In-memory storage with node-cache
- Per-layer TTL configuration

  
---

### 67. Gemini Embeddings Cache
**Location:** Server infrastructure  
**User Type:** System (automatic)  
**Purpose:** Cache Gemini API embedding calls to reduce costs

**Features:**
- Document chunk embedding cache
- 1-hour TTL
- Cost savings: ~$800/month
- Hit rate tracking
- Automatic warming for common queries

**Technical Details:**
- Service: `server/services/embeddingCache.ts`
- Database: In-memory cache
- Integration: RAG service

  
---

### 68. RAG Query Cache
**Location:** Server infrastructure  
**User Type:** System (automatic)  
**Purpose:** Cache RAG search results for repeated queries

**Features:**
- Query result caching
- 5-minute TTL
- Semantic similarity matching
- Cost savings: ~$600/month
- Query normalization

**Technical Details:**
- Service: `server/services/ragCache.ts`
- Integration: Gemini RAG service

  
---

### 69. Document Analysis Cache
**Location:** Server infrastructure  
**User Type:** System (automatic)  
**Purpose:** Cache AI document analysis results

**Features:**
- Gemini Vision analysis caching
- 30-minute TTL
- Document hash-based keying
- Cost savings: ~$400/month
- Supports verification and extraction

**Technical Details:**
- Service: `server/services/documentAnalysisCache.ts`
- Integration: Document verification service

  
---

### 70. PolicyEngine Calculation Cache
**Location:** Server infrastructure  
**User Type:** System (automatic)  
**Purpose:** Cache PolicyEngine benefit calculations

**Features:**
- Household profile-based caching
- 5-minute TTL
- Input hash keying
- Cost savings: ~$600/month (computation time)
- Multi-program support

**Technical Details:**
- Service: `server/services/policyEngineCache.ts`
- Integration: PolicyEngine HTTP client

  
---

### 71. Cache Analytics & Cost Savings
**Location:** `/admin/cache`  
**User Type:** Administrators  
**Purpose:** Analytics on cache performance and cost reduction

**Features:**
- Real-time hit/miss ratios
- Cost avoidance calculation ($2,400/month total)
- Cache type breakdown visualization
- Performance impact metrics
- Trend analysis over time
- Recommendations for optimization

**Technical Details:**
- Service: `server/services/cacheMetrics.ts`
- API: `GET /api/admin/cache/stats`, `GET /api/admin/cache/cost-savings`
- Visualization: Recharts

  
---

## Accessibility & Compliance

### 88. Automated WCAG 2.1 AAA Testing
**Location:** Integrated in testing infrastructure  
**User Type:** Developers and QA teams  
**Purpose:** Comprehensive automated accessibility testing across all user journeys

**Features:**
- Playwright + axe-core integration testing
- 31 pages tested across 8 user journeys
- All WCAG conformance levels (A, AA, AAA, Best Practices)
- Violation categorization by impact (critical, serious, moderate, minor)
- CI/CD pipeline integration
- Automated regression detection

**Technical Details:**
- Test Suite: `tests/accessibility.spec.ts`
- Scripts: `scripts/accessibility-audit.ts`
- Coverage: Public portal, authenticated workflows, admin interfaces
- User Journeys: Benefit screening, tax preparation, navigator workspace, document verification

  
---

### 89. Compliance Reporting Suite
**Location:** Documentation and reporting infrastructure  
**User Type:** Administrators and stakeholders  
**Purpose:** Professional compliance documentation for Maryland DHS review

**Features:**
- 1,578-line comprehensive audit report (THIRD_PARTY_STANDARDS_AUDIT.md)
- 2,527-line detailed technical report (accessibility-audit-report.md)
- Executive summary for non-technical stakeholders
- Machine-readable JSON data export (15,000+ lines)
- Violation tracking and remediation status
- Historical compliance trending

**Technical Details:**
- Reports: `THIRD_PARTY_STANDARDS_AUDIT.md`, `test-results/accessibility-audit-report.md`
- Executive Summary: `test-results/ACCESSIBILITY_AUDIT_EXECUTIVE_SUMMARY.md`
- Data Export: `test-results/accessibility-audit-results.json`
- Format: Markdown for reports, JSON for programmatic access

  
---

### 90. Week 1 Critical Fixes (55 Violations)
**Location:** Platform-wide accessibility improvements  
**User Type:** All users  
**Purpose:** Address critical WCAG Level A violations for baseline compliance

**Features:**
- 55 critical violations fixed (24 button aria-labels + 31 page titles)
- 91.7% WCAG Level A compliance achieved
- Global react-helmet-async configuration for dynamic page titles
- Button accessibility improvements across all pages
- Form input labeling enhancements
- Reduced Level A violations from 60 to 5

**Technical Details:**
- Implementation: React components with aria-label attributes
- Page Titles: react-helmet-async in all page components
- Completion: October 16-17, 2025
- Impact: 91.7% Level A compliance (5 violations remaining)

  
---

### 91. Accessibility Audit Infrastructure
**Location:** Testing and automation infrastructure  
**User Type:** Development and QA teams  
**Purpose:** Reusable testing infrastructure for continuous compliance monitoring

**Features:**
- Automated violation detection via Playwright
- JSON export for programmatic analysis
- CI/CD pipeline integration support
- Playwright-based audit engine with axe-core
- Configurable test execution
- Historical comparison capabilities

**Technical Details:**
- Engine: Playwright + @axe-core/playwright
- Output: JSON, Markdown, HTML reports
- Automation: Scheduled audits and on-demand execution via run_test tool

  
---

### 92. Executive Summaries for Stakeholders
**Location:** Documentation for leadership review  
**User Type:** Maryland DHS stakeholders and leadership  
**Purpose:** Non-technical compliance summaries for decision-makers

**Features:**
- Compliance status overview
- Remediation timeline with milestones
- Priority-based page categorization (P1-P4)
- Resource hour estimates for remaining work
- Risk assessment and mitigation strategies
- Progress tracking against targets

**Technical Details:**
- Document: `test-results/ACCESSIBILITY_AUDIT_EXECUTIVE_SUMMARY.md`
- Format: Non-technical markdown summary
- Audience: Maryland DHS leadership and stakeholders
- Updates: Synchronized with technical audit reports

  
---

### 93. Machine-Readable Compliance Data
**Location:** Structured data export  
**User Type:** Compliance systems and analysts  
**Purpose:** Structured data for programmatic compliance tracking

**Features:**
- 15,000+ line JSON data export
- Violation details with WCAG success criteria mappings
- Remediation guidance and code examples
- Severity and impact classifications
- Programmatic analysis support
- Integration with accessibility management systems

**Technical Details:**
- File: `test-results/accessibility-audit-results.json`
- Format: Structured JSON with nested violation data
- Fields: URL, violation type, impact, WCAG criteria, HTML snippets, remediation guidance
- Size: 15,000+ lines of detailed compliance data

  
---

## Enterprise Compliance (GDPR/HIPAA)

### 94. GDPR Consent Management
**User Type:** All authenticated users  
**Purpose:** Track granular user consent for data processing purposes with GDPR Article 6 & 7 compliance

**Features:**
- Record consent for specific processing purposes
- Withdraw consent with audit trail
- Consent expiration tracking
- IP address and user agent logging
- Consent method tracking (electronic signature, checkbox, etc.)
- Multi-purpose consent management (marketing, analytics, data sharing, etc.)

**Technical Details:**
- Table: `gdprConsents` (shared/schema.ts line 6927)
- Service: `server/services/gdpr.service.ts` (942 lines)
- API Routes:
  - `POST /api/gdpr/consent` - Record new consent
  - `DELETE /api/gdpr/consent/:purpose` - Withdraw consent
  - `GET /api/gdpr/consent` - Get user consents
  - `PUT /api/gdpr/consent/:purpose` - Update consent
- Audit logging for all consent actions
- Email notifications for consent changes

  
---

### 95. GDPR Data Subject Rights Management
**User Type:** All authenticated users + Admin  
**Purpose:** Handle data subject requests (access, erasure, portability, rectification) with mandatory 30-day response deadline

**Features:**
- Submit data access requests (GDPR Article 15 - Right to Access)
- Submit erasure requests (GDPR Article 17 - Right to be Forgotten)
- Submit portability requests (GDPR Article 20 - Right to Data Portability)
- Submit rectification requests (GDPR Article 16 - Right to Rectification)
- Automated 30-day deadline tracking
- Admin workflow for processing requests
- Data export in JSON format
- Secure deletion with cascade handling
- Email notifications for request status updates

**Technical Details:**
- Table: `gdprDataSubjectRequests` (shared/schema.ts line 6950)
- Service: Functions - createDataSubjectRequest(), exportUserData(), deleteUserData()
- API Routes:
  - `POST /api/gdpr/data-subject-request` - Submit request
  - `GET /api/gdpr/data-subject-request/:id` - Get request status
  - `PUT /api/gdpr/data-subject-request/:id/status` - Update status (admin)
  - `GET /api/gdpr/data-subject-request/export/:id` - Download data export
- Automated cascade deletion across all tables (users, documents, household profiles, tax returns)
- Deadline enforcement: Requests must be completed within 30 days of submission

  
---

### 96. GDPR Data Processing Activities Register (ROPA)
**User Type:** Admin + DPO (Data Protection Officer)  
**Purpose:** Maintain Register of Processing Activities as required by GDPR Article 30

**Features:**
- Document all data processing activities
- Track purpose of processing (service delivery, analytics, marketing, legal compliance)
- Record data categories (personal data, sensitive data, financial data, health data)
- List third-party recipients (PolicyEngine, Google Gemini, Twilio, etc.)
- Define retention periods (7 years for HIPAA, 3 years for tax, 1 year for analytics)
- Document security measures (encryption, access controls, backups)
- Specify legal basis (consent, contract, legal obligation, legitimate interest)
- Export ROPA for compliance audits

**Technical Details:**
- Table: `gdprDataProcessingActivities` (shared/schema.ts line 6979)
- Service: Functions - createProcessingActivity(), getProcessingActivities(), exportROPA()
- API Routes:
  - `POST /api/gdpr/processing-activities` - Create activity
  - `GET /api/gdpr/processing-activities` - List activities (ROPA export)
  - `PUT /api/gdpr/processing-activities/:id` - Update activity
  - `DELETE /api/gdpr/processing-activities/:id` - Delete activity
- ROPA documentation meets Article 30 requirements for controllers
- Supports supervisory authority inspections

  
---

### 97. GDPR Privacy Impact Assessments (DPIA)
**User Type:** Admin + DPO  
**Purpose:** Conduct Data Protection Impact Assessments for high-risk processing (GDPR Article 35)

**Features:**
- Create DPIAs for high-risk processing activities
- Document processing description and data flow
- Assess risk level (low, medium, high, critical)
- Define mitigation measures
- Review and approval workflow
- Track assessment dates and reviewers
- Export DPIA reports for supervisory authority

**Technical Details:**
- Table: `gdprPrivacyImpactAssessments` (shared/schema.ts line 7017)
- Service: Functions - createDPIA(), getDPIAs(), updateDPIA(), markForReview()
- API Routes:
  - `POST /api/gdpr/privacy-impact-assessments` - Create DPIA
  - `GET /api/gdpr/privacy-impact-assessments` - List DPIAs
  - `PUT /api/gdpr/privacy-impact-assessments/:id` - Update DPIA
  - `POST /api/gdpr/privacy-impact-assessments/:id/review` - Mark reviewed
- DPIA required for processing likely to result in high risk to individuals
- Examples: large-scale processing, sensitive data, systematic monitoring

  
---

### 98. GDPR Breach Notification (72-Hour)
**User Type:** Admin + DPO + Security Team  
**Purpose:** Track data breaches with mandatory 72-hour notification to supervisory authority (GDPR Article 33)

**Features:**
- Record breach incidents with discovery timestamp
- Automated 72-hour deadline calculation
- Track affected data subjects count
- Classify breach type (unauthorized access, data loss, ransomware, etc.)
- Document containment actions
- Notify supervisory authority (automated alert when 72hr approaching)
- Notify affected individuals (required if high risk to their rights)
- Track notification status (pending, sent, acknowledged)
- Export breach reports for compliance audits

**Technical Details:**
- Table: `gdprBreachIncidents` (shared/schema.ts line 7056)
- Service: Functions - recordBreach(), notifySupervisoryAuthority(), notifyAffectedIndividuals()
- API Routes:
  - `POST /api/gdpr/breach-incidents` - Record breach
  - `GET /api/gdpr/breach-incidents` - List breaches
  - `PUT /api/gdpr/breach-incidents/:id` - Update breach
  - `POST /api/gdpr/breach-incidents/:id/notify` - Send notifications
- Deadline enforcement: Article 33 requires notification within 72 hours of discovery
- Email alerts to DPO when breach recorded
- Email alerts at 48hr and 60hr if notification pending

  
---

### 99. HIPAA PHI Access Logging
**User Type:** All staff + Admin  
**Purpose:** Comprehensive audit trail of all Protected Health Information (PHI) access with Minimum Necessary standard enforcement

**Features:**
- Log every PHI access event (view, edit, export)
- Track accessing user, patient, resource type, and resource ID
- Document access purpose (treatment, payment, operations, research)
- Record data accessed (field-level tracking)
- Minimum Necessary principle enforcement (flag excessive access)
- Flag suspicious access patterns for review
- Admin review workflow for flagged access
- Query logs by user, patient, date range, resource type

**Technical Details:**
- Table: `hipaaPhiAccessLogs` (shared/schema.ts line 7232)
- Service: `server/services/hipaa.service.ts` (501 lines)
- Service Functions: logPhiAccess(), getPhiAccessLogs(), flagPhiAccessForReview(), reviewPhiAccess()
- API Routes:
  - `GET /api/hipaa/phi-access-logs` - Get access logs with filtering
  - `POST /api/hipaa/phi-access-logs` - Log PHI access
  - `POST /api/hipaa/phi-access-logs/:id/flag` - Flag for review
  - `POST /api/hipaa/phi-access-logs/:id/review` - Mark as reviewed
- Automatic flagging for access outside normal patterns
- Minimum Necessary alerts when excessive data accessed

  
---

### 100. HIPAA Business Associate Agreements Tracking
**User Type:** Admin + Compliance Officer  
**Purpose:** Track and manage Business Associate Agreements (BAAs) with third-party vendors processing PHI

**Features:**
- Create BAAs for covered entities and business associates
- Track agreement effective and expiration dates
- Monitor BAA status (active, expired, terminated)
- Expiration alerts (30, 60, 90 days before expiration)
- Audit tracking (record periodic audits of business associates)
- Document audit results and corrective actions
- Export BAA register for compliance audits

**Technical Details:**
- Table: `hipaaBusinessAssociateAgreements` (shared/schema.ts line 7271)
- Service Functions: createBAA(), getBAAs(), updateBAA(), auditBAA(), getExpiringBAAs()
- API Routes:
  - `GET /api/hipaa/business-associate-agreements` - List BAAs
  - `POST /api/hipaa/business-associate-agreements` - Create BAA
  - `PUT /api/hipaa/business-associate-agreements/:id` - Update BAA
  - `POST /api/hipaa/business-associate-agreements/:id/audit` - Record audit
  - `GET /api/hipaa/business-associate-agreements/expiring` - Get expiring BAAs
- Email alerts for expiring BAAs
- Examples: PolicyEngine (benefit calculations), Google Gemini (AI processing), Twilio (SMS notifications)

  
---

### 101. HIPAA Security Risk Assessments (SRA)
**User Type:** Admin + Security Officer  
**Purpose:** Conduct and track Security Risk Assessments as required by HIPAA Security Rule § 164.308(a)(1)

**Features:**
- Create annual security risk assessments
- Document assessment scope (entire organization, specific systems, departments)
- Record findings and vulnerabilities
- Classify risk level (low, medium, high, critical)
- Define mitigation plans with timelines
- Schedule next assessment (annual requirement)
- Export SRA reports for HHS OCR audits

**Technical Details:**
- Table: `hipaaRiskAssessments` (shared/schema.ts line 7320)
- Service Functions: createSRA(), getSRAs(), updateSRA(), scheduleSRA(), exportSRAReport()
- API Routes:
  - `GET /api/hipaa/risk-assessments` - List SRAs
  - `POST /api/hipaa/risk-assessments` - Create SRA
  - `PUT /api/hipaa/risk-assessments/:id` - Update SRA
  - `POST /api/hipaa/risk-assessments/:id/schedule-next` - Schedule next SRA
  - `GET /api/hipaa/risk-assessments/:id/export` - Export SRA report
- Findings stored as JSONB for flexibility (vulnerabilities, threats, safeguards assessment)
- Annual assessment scheduling with automated reminders

  
---

### 102. HIPAA Security Incident Management
**User Type:** Admin + Security Team  
**Purpose:** Track and manage security incidents with breach threshold detection (>500 individuals = breach notification required)

**Features:**
- Record security incidents (unauthorized access, ransomware, data theft, lost devices)
- Track incident discovery date and containment actions
- Count affected individuals
- Automatic breach threshold evaluation (>500 = breach under HIPAA Breach Notification Rule)
- HHS notification workflow (required within 60 days if breach)
- Media notification (required if breach affects >500 individuals)
- Incident resolution tracking
- Export incident reports for compliance audits

**Technical Details:**
- Table: `hipaaSecurityIncidents` (shared/schema.ts line 7367)
- Service Functions: recordIncident(), evaluateBreachThreshold(), notifyHHS(), notifyMedia()
- API Routes:
  - `GET /api/hipaa/security-incidents` - List incidents
  - `POST /api/hipaa/security-incidents` - Record incident
  - `PUT /api/hipaa/security-incidents/:id` - Update incident
  - `POST /api/hipaa/security-incidents/:id/evaluate-breach` - Evaluate breach threshold
  - `POST /api/hipaa/security-incidents/:id/notify-hhs` - Send HHS notification
  - `POST /api/hipaa/security-incidents/:id/notify-media` - Send media notification
- Breach threshold: § 164.408 requires HHS notification + media notification if >500 individuals affected
- Automated breach determination based on harm likelihood assessment

  
---

### 103. HIPAA Audit Logs (7-Year Retention)
**User Type:** Admin + Compliance Officer  
**Purpose:** Comprehensive audit trail with mandatory 7-year retention for HIPAA compliance

**Features:**
- Log all user actions on PHI (create, read, update, delete, export)
- Track resource type and resource ID
- Record timestamp, IP address, user agent
- Field-level data access tracking
- 7-year retention period (HIPAA requires minimum 6 years)
- Automated retention date calculation
- Periodic cleanup of expired logs
- Export audit trail for HHS OCR audits
- Query logs by user, date range, action type

**Technical Details:**
- Table: `hipaaAuditLogs` (shared/schema.ts line 7430+)
- Service Functions: logAuditEvent(), getAuditLogs(), cleanupExpiredLogs(), exportAuditTrail()
- API Routes:
  - `GET /api/hipaa/audit-logs` - Get audit logs (with date filtering)
  - `POST /api/hipaa/audit-logs` - Log audit event
  - `GET /api/hipaa/audit-logs/export` - Export audit trail
  - `DELETE /api/hipaa/audit-logs/cleanup` - Clean up expired logs (admin only)
- Retention calculation: retentionDate = timestamp + 7 years
- Automated cleanup scheduled via Smart Scheduler
- Tamper-proof audit trail (append-only)

  
---

### 104. Human-in-the-Loop Provision Mapping Pipeline
**User Type:** Admin + Policy Analyst  
**Purpose:** Automated legislative change detection with human oversight for mapping law provisions to policy rules

**Features:**
- **Provision Extraction Service**: Gemini 2.0 Flash parses public law text to extract section-level amendments with:
  - U.S. Code citations (e.g., "7 USC 2015(d)(1)")
  - Affected benefit programs (SNAP, TANF, Medicaid, etc.)
  - Provision types: `amends`, `supersedes`, `adds_exception`, `modifies_threshold`, `clarifies`, `removes`, `creates`
- **Ontology Matcher Service**: Three-strategy AI matching system:
  - **Citation Matching** (95% score): Exact U.S. Code citation lookup
  - **Semantic Similarity** (75% threshold): Gemini embedding cosine similarity
  - **AI Inference**: Gemini-powered reasoning for complex mappings
- **Provision Review UI** (`/admin/provision-review`):
  - Side-by-side law text and ontology term comparison
  - Priority filtering (urgent/high/normal/low)
  - Bulk approve/reject actions
  - Public law context display
  - Affected rules badge showing count of formal rules requiring re-verification
- **Human Checkpoint Enforcement**: All AI-proposed mappings require human approval before affecting the rules engine
- **Z3 Re-verification Queue**: When approved mappings affect existing formal rules:
  - `appliedAt` is deferred
  - `processingStatus` set to `pending_rule_verification`
  - Affected rules queued with batch tracking (`verificationBatchId`)
- **GovInfo Integration**: Auto-triggers provision extraction when new public laws are synced via Smart Scheduler

**Technical Details:**
- Tables: `lawProvisions` (shared/schema.ts), `provisionOntologyMappings` (shared/schema.ts)
- Services: 
  - `provisionExtractor.service.ts` - Gemini-powered law parsing
  - `ontologyMatcher.service.ts` - Three-strategy matching with confidence scoring
- API Routes:
  - `GET /api/provision-mappings` - Get all mappings (with priority/status filtering)
  - `POST /api/provision-mappings/:id/approve` - Approve single mapping
  - `POST /api/provision-mappings/:id/reject` - Reject single mapping
  - `POST /api/provision-mappings/bulk-approve` - Bulk approve multiple mappings
  - `GET /api/provision-mappings/stats` - Dashboard statistics
- UI: `client/src/pages/admin/ProvisionReview.tsx`

**Neuro-Symbolic Maintenance Methodology:**
This feature extends the original neuro-symbolic hybrid framework to *maintain the engine itself* when laws change:
1. **Neural (Gemini 2.0 Flash)**: Parses public law text, extracts provisions, proposes ontology mappings
2. **Human-in-the-Loop Checkpoint**: Human reviewers validate AI-proposed mappings before they affect rules
3. **Symbolic (Z3 Re-verification)**: Affected formal rules are automatically queued for Z3 re-verification

  
---

## Summary Statistics

**Total Features:** 104

| Category | Features |
|----------|----------|
| Public Access | 5 |
| Eligibility Tools | 7 |
| Application Assistance | 3 |
| Document Management | 7 |
| Tax & VITA | 6 |
| Navigator Tools | 5 |
| Quality Control | 5 |
| Administration | 17 |
| Developer Tools | 4 |
| Multi-Tenant | 4 |
| Legislative & Regulatory | 7 |
| Infrastructure & Operations | 8 |
| Communication Systems | 1 |
| Notification System | 4 |
| Caching & Performance | 6 |
| Infrastructure & Mobile | 5 |
| Accessibility & Compliance | 6 |
| Enterprise Compliance (GDPR/HIPAA) | 10 |

---

## Feature Categories by User Role

### Public (No Login)
- Anonymous Benefit Screener
- Quick Screener
- Document Checklist Generator
- Notice Explainer
- Simplified Policy Search

### Applicants (Client Role)
- All Public features +
- Household Profiler
- Financial Opportunity Radar
- Adaptive Intake Copilot
- Tax Preparation
- Document Upload & Verification
- Client Dashboard
- Notification Center

### Navigators
- All Applicant features +
- Navigator Workspace
- Navigator Dashboard
- Navigator Performance
- Scenario Workspace
- Consent Management
- Cross-Enrollment Tools
- Leaderboard

### Caseworkers
- All Navigator features +
- Document Review Queue
- Caseworker Cockpit
- Quality Control Tools

### Supervisors
- All Caseworker features +
- Supervisor Cockpit
- Team Analytics
- Training Management

### Administrators
- All Supervisor features +
- Admin Dashboard
- Policy Management
- Security Monitoring
- AI Monitoring
- Feedback Management
- Audit Logs
- County Management
- County Analytics
- ABAWD Admin
- Cross-Enrollment Admin
- Compliance Suite
- Evaluation Framework

### Developers
- Developer Portal
- API Documentation
- API Key Management

---

## Frontend Routes

The platform includes **95 frontend routes** organized by user role and functionality.

### Public Pages (No Authentication Required)
| Route | Purpose |
|-------|---------|
| `/` | Home page |
| `/login` | User login |
| `/signup` | User registration |
| `/screener` | Benefit screener |
| `/public/quick-screener` | 5-question quick screener |
| `/public/documents` | Document checklist generator |
| `/public/notices` | Notice explainer |
| `/public/fsa` | FSA information |
| `/public/search` | Public policy search |
| `/eligibility` | Eligibility calculator |
| `/help` | Help center |
| `/verify` | Document verification |

### Legal & Compliance Pages
| Route | Purpose |
|-------|---------|
| `/legal` | Legal information hub |
| `/legal/privacy` | Privacy policy |
| `/legal/terms` | Terms of service |
| `/legal/accessibility` | Accessibility statement |
| `/legal/disclaimer` | Disclaimer |
| `/legal/security` | Security policy |
| `/legal/license` | License information |
| `/legal/breach-notification` | Breach notification policy |
| `/consent` | Consent management |

### Applicant/Client Pages
| Route | Purpose |
|-------|---------|
| `/intake` | Application intake |
| `/intake-assistant` | AI intake assistant |
| `/household-profiler` | Household profile builder |
| `/scenarios` | Scenario modeling |
| `/search` | Policy search |
| `/manual` | Policy manual |
| `/manual/snap` | SNAP manual |
| `/manual/medicaid` | Medicaid manual |
| `/manual/tanf` | TANF manual |
| `/manual/ohep` | OHEP manual |
| `/manual/ssi` | SSI manual |
| `/manual/tax-credits` | Tax credits manual |
| `/upload` | Document upload |
| `/appointments` | Appointment scheduling |
| `/notifications` | Notification center |
| `/settings/notifications` | Notification settings |
| `/client/report-changes` | Report life changes |
| `/dashboard/client` | Client dashboard |

### Tax Preparation Pages
| Route | Purpose |
|-------|---------|
| `/vita` | VITA intake |
| `/vita-intake` | VITA intake form |
| `/vita-documents/:sessionId` | VITA session documents |
| `/tax` | Tax preparation |
| `/taxpayer` | Taxpayer portal |
| `/taxpayer/documents` | Taxpayer documents |
| `/taxpayer/messages` | Taxpayer messaging |
| `/taxpayer/signature` | E-signature |
| `/efile` | E-file submission |

### Navigator/Staff Pages
| Route | Purpose |
|-------|---------|
| `/navigator` | Navigator workspace |
| `/navigator/document-review` | Document review queue |
| `/dashboard/navigator` | Navigator dashboard |
| `/caseworker-cockpit` | Caseworker cockpit |
| `/caseworker/cockpit` | Caseworker cockpit (alternate) |
| `/dashboard/caseworker` | Caseworker dashboard |

### Supervisor Pages
| Route | Purpose |
|-------|---------|
| `/supervisor/cockpit` | Supervisor cockpit |
| `/supervisor/reviews` | Supervisor review queue |

### Admin Pages
| Route | Purpose |
|-------|---------|
| `/admin` | Admin dashboard hub |
| `/admin/users` | User management |
| `/admin/security` | Security dashboard |
| `/admin/security-monitoring` | Security monitoring |
| `/admin/monitoring` | System monitoring |
| `/admin/analytics` | Analytics dashboard |
| `/admin/audit-logs` | Audit log viewer |
| `/admin/feedback` | Feedback management |
| `/admin/sources` | Policy source management |
| `/admin/scheduler` | Smart scheduler |
| `/admin/rules` | Rules management |
| `/admin/compliance` | Compliance dashboard |
| `/admin/policy-changes` | Policy change tracking |
| `/admin/per` | PER dashboard |
| `/admin/bar` | Benefits Access Review |
| `/admin/cross-enrollment` | Cross-enrollment admin |
| `/admin/counties` | County management |
| `/admin/county-analytics` | County analytics |
| `/admin/county-tax-rates` | County tax rates |
| `/admin/efile-monitoring` | E-file monitoring |
| `/admin/ai-monitoring` | AI service monitoring |
| `/admin/evaluation` | Evaluation dashboard |
| `/admin/maive` | MAIVE testing |
| `/admin/fns-state-options` | FNS state options |
| `/admin/federal-law-tracker` | Federal law tracker |
| `/admin/state-law-tracker` | State law tracker |
| `/admin/provision-review` | Provision mapping review |
| `/admin/abawd-verifications` | ABAWD verifications |
| `/admin/webhooks` | Webhook management |
| `/admin/api-docs` | API documentation |
| `/admin/researchers` | Researcher access |
| `/dashboard/admin` | Admin dashboard |

### Developer Pages
| Route | Purpose |
|-------|---------|
| `/developer` | Developer portal |
| `/developers` | Developer documentation |
| `/api-explorer` | API explorer |

### Gamification & Performance Pages
| Route | Purpose |
|-------|---------|
| `/leaderboard` | Staff leaderboard |
| `/training` | Training center |
| `/performance` | Performance metrics |
| `/analytics` | Analytics viewer |
| `/demo` | Demo mode |

---

**For detailed technical documentation, see:**
- [README.md](README.md) - Quick start and overview
- [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) - Implementation details
- [replit.md](replit.md) - System architecture summary
- [docs/API.md](docs/API.md) - API endpoint reference
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) - UI/UX patterns
