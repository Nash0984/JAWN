# Maryland Universal Benefits-Tax Navigator - Complete Feature Catalog

**Version:** 2.0  
**Last Updated:** October 2025  
**Total Features:** 46

This document provides a comprehensive catalog of all 46 features implemented in the Maryland Universal Benefits-Tax Service Delivery Platform. The platform integrates 6 Maryland benefit programs (SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI) with federal/state tax preparation (VITA), quality control analytics, multi-county deployment, and AI-powered assistance.

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
11. [Infrastructure & Mobile](#infrastructure--mobile)

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
**Location:** `/quick-screener`  
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
**Location:** `/tax-prep`  
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
- Service: `server/services/taxDocumentExtraction.service.ts`
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
**Location:** `/documents/review`  
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

## Tax Preparation & VITA

### 17. VITA Knowledge Base
**Location:** `/vita/kb`  
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

## Summary Statistics

**Total Features:** 46  
**Public Access:** 5 features  
**Eligibility Tools:** 5 features  
**Application Assistance:** 3 features  
**Document Management:** 3 features  
**Tax & VITA:** 2 features  
**Navigator Tools:** 5 features  
**Quality Control:** 3 features  
**Administration:** 14 features  
**Developer Tools:** 2 features  
**Multi-Tenant:** 4 features  
**Infrastructure:** 5 features

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

## Recently Added Features (October 2025)

1. ⭐ **Financial Opportunity Radar** - Real-time cross-program eligibility tracking
2. **Caseworker Cockpit** - Enhanced with predictive analytics
3. **Supervisor Cockpit** - Team-wide QA oversight
4. **County Analytics** - Multi-county performance tracking
5. **PWA Support** - Offline-first capabilities
6. **Mobile Bottom Nav** - Mobile-optimized navigation

---

## Upcoming Features (Roadmap)

### Q1 2026
- [ ] SMS notification channel (Twilio integration)
- [ ] Voice interface (IVR) for phone-based screening
- [ ] Scheduled appointment system
- [ ] Historical benefit tracking in Radar
- [ ] Spanish language support for all features

### Q2 2026
- [ ] Federal e-filing (IRS MeF API)
- [ ] Maryland e-filing (MDTAX iFile)
- [ ] Benefit cliffs visualization
- [ ] Mobile app (React Native)
- [ ] Video call integration for remote assistance

### Q3 2026
- [ ] Advanced ML models for eligibility prediction
- [ ] Blockchain-based document verification
- [ ] Multi-state expansion framework
- [ ] Enhanced accessibility (WCAG AAA)

---

**For detailed technical documentation, see:**
- [README.md](README.md) - Quick start and overview
- [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) - Implementation details
- [replit.md](replit.md) - System architecture summary
- [docs/API.md](docs/API.md) - API endpoint reference
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) - UI/UX patterns
