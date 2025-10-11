# Vibe Code Prompts for Maryland Multi-Program Benefits Navigator

These prompts can be used with AI coding assistants to recreate the entire Maryland Multi-Program Benefits Navigator System functionality from scratch.

**Last Updated:** October 2025  
**System Version:** 2.0 - Multi-Program RAG + Rules as Code

---

## 🎯 Master System Prompt

```
Create a comprehensive Maryland Multi-Program Benefits Navigator System - an AI-powered platform combining Retrieval-Augmented Generation (RAG) with Rules as Code to help Maryland residents understand eligibility, navigate applications, and verify documents across 7 major benefit programs.

SUPPORTED PROGRAMS:
1. Maryland SNAP (Food Supplement Program)
2. Maryland Medicaid (Medical Assistance)
3. Maryland TCA (TANF - Temporary Cash Assistance)
4. Maryland OHEP (Energy Assistance - MEAP/EUSP)
5. Maryland WIC (Women, Infants, Children)
6. Maryland Children's Health Program (MCHP)
7. IRS VITA Tax Assistance

KEY REQUIREMENTS:
- RAG-powered conversational search with semantic understanding
- Rules as Code for deterministic eligibility calculations (PolicyEngine)
- Document verification using Gemini Vision API
- Multi-role access: Applicant, Navigator, Caseworker, Admin
- Navigator Workspace with client case management
- Maryland Digital Style Guide branding (DHS Blue #0D4F8B)
- Mobile-first responsive design with WCAG 2.1 AA compliance
- Real-time notifications via WebSocket with email backup
- Export capabilities (PDF/CSV reports)
- Bulk document processing and review workflows

ARCHITECTURE:
- Frontend: React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS
- Backend: Express.js + TypeScript + PostgreSQL (Neon) + Google Gemini API
- AI: Google Gemini 2.5 Flash for text, text-embedding-004 for RAG
- Storage: Google Cloud Storage for documents
- Integrations: PolicyEngine API for benefit calculations
```

---

## 🏗️ Frontend Development Prompts

### Core Application Structure
```
Build a React 18 + TypeScript frontend for Maryland Multi-Program Benefits Navigator with role-based experiences:

1. NAVIGATION SYSTEM:
   - Maryland DHS header with official blue (#0D4F8B) and gold stripe (#FFB81C)
   - State of Maryland branding with flag integration
   - Mobile bottom navigation: Home, Search, Updates, Resources
   - Command palette (Cmd+K) for power users
   - Role-based menu items (Applicant, Navigator, Caseworker, Admin)

2. SEARCH INTERFACE:
   - Program-specific conversational search (7 programs)
   - PolicyChatWidget with streaming responses
   - Recent searches with localStorage persistence
   - "Suggested for You" contextual prompts
   - Citation tracking with source documents
   - Multi-turn conversation memory

3. DOCUMENT VERIFICATION:
   - Document upload with Gemini Vision analysis
   - Verification stamps (APPROVED, VERIFIED badges)
   - Document viewer with zoom, rotate, fit controls
   - Bulk document review queue for caseworkers
   - Thumbnail previews in review interface
   - Select all / bulk approve-reject actions

4. NAVIGATOR WORKSPACE:
   - Client case management dashboard
   - Interaction session tracking
   - Scenario modeling with PolicyEngine
   - E&E export for DHS integration
   - What-if analysis with benefit calculations

5. NOTIFICATION CENTER:
   - Real-time WebSocket notifications
   - Bell icon with unread count badge
   - Notification preferences management
   - Email backup for offline users
   - Policy change alerts with diff viewer

Use shadcn/ui components, Tailwind CSS with Maryland DHS colors, Wouter for routing, TanStack Query v5 for state management. Include data-testid attributes on all interactive elements.
```

### Maryland Design System Implementation
```
Implement Maryland Digital Style Guide (2025) with DHS-specific branding:

1. COLOR PALETTE:
   - Primary: DHS Blue (#0D4F8B)
   - Alert: DHS Red (#C5203A)
   - Accent: Maryland Gold (#FFB81C)
   - Success: Green for approved states
   - Maryland flag colors integrated in branding

2. COMPONENTS:
   - MDAlert component with 5 variants (info, warning, error, success, restricted)
   - Verification stamps with Maryland styling
   - Status badges (Significant=red, Accepted=green, Pending=yellow)
   - Mobile bottom navigation with fixed 4-column grid
   - Document viewer controls matching MD screenshots

3. TYPOGRAPHY:
   - Primary font system with fallback stack
   - Accessible sizing ratios
   - Plain language compliance (Grade 6-8 reading level)

4. ACCESSIBILITY:
   - WCAG 2.1 AA compliance mandatory
   - Proper ARIA labels and role attributes
   - Keyboard navigation support
   - Focus management and skip links
   - Color contrast ratios verified
   - Screen reader optimization

5. MOBILE-FIRST:
   - Touch targets minimum 44px
   - Responsive breakpoints (sm, md, lg, xl)
   - Progressive enhancement
   - Bottom navigation for mobile users
   - Optimized for government benefit applicants
```

### Advanced UI Features
```
Implement production-ready UI features for Maryland Benefits Navigator:

1. BULK ACTIONS:
   - Checkbox selection for multi-document operations
   - "Select All" with proper state management
   - Bulk approve/reject buttons with count display
   - Per-document notifications after bulk updates
   - Maryland-styled action bar (bg-md-blue/5)

2. EXPORT CAPABILITIES:
   - PDF export with Maryland DHS header branding
   - CSV export with formatted columns
   - Document review history reports
   - Timestamped filenames
   - Dynamic imports for code splitting

3. THUMBNAIL PREVIEWS:
   - Image previews with error handling fallback
   - PDF icon indicators
   - Generic document icons
   - 20x24 sizing with muted backgrounds
   - Left-aligned in document cards

4. REAL-TIME FEATURES:
   - WebSocket connection for live notifications
   - Connection status indicators
   - Automatic reconnection logic
   - Optimistic UI updates
   - Toast confirmations

5. COMMAND PALETTE:
   - Cmd+K / Ctrl+K activation
   - Fuzzy search across all routes
   - Recent searches history
   - Keyboard shortcuts display
   - Action execution from palette
```

---

## 🚀 Backend Development Prompts

### Core API and Multi-Program Architecture
```
Create a comprehensive Express.js + TypeScript backend for Maryland Multi-Program Benefits Navigator:

1. GOOGLE GEMINI INTEGRATION:
   - gemini-2.5-flash for text generation and analysis
   - text-embedding-004 for RAG vector embeddings
   - Gemini Vision for document verification
   - Cost optimization with caching and batching
   - Error handling and fallback strategies

2. RAG SERVICE (7 Programs):
   - Program-specific semantic search (SNAP, Medicaid, TCA, OHEP, WIC, MCHP, VITA)
   - Vector embeddings with cosine similarity
   - Context-aware response generation
   - Citation tracking with regulation references
   - Confidence scoring per response
   - Multi-turn conversation memory

3. RULES AS CODE:
   - PolicyEngine integration for benefit calculations
   - Support for SNAP, Medicaid, EITC, CTC, SSI, TANF
   - Maryland-specific rule overrides
   - Household composition modeling
   - What-if scenario analysis
   - Variance tracking (2% tolerance)

4. DOCUMENT PROCESSING PIPELINE:
   - Multi-stage: OCR → Classification → Quality → Chunking → Embedding
   - Gemini Vision for verification
   - Document type classification
   - Semantic chunking with overlap
   - Metadata extraction
   - Version management

5. NOTIFICATION SYSTEM:
   - WebSocket real-time delivery
   - Email backup for offline users
   - User preference management
   - Template-based notifications
   - Bulk notification support
   - Priority levels (low, normal, high, urgent)

API ENDPOINTS:
- /api/search (RAG search across programs)
- /api/documents/verify (Gemini Vision verification)
- /api/document-review/queue (Staff review queue)
- /api/document-review/bulk-update (Bulk actions)
- /api/policyengine/calculate (Benefit estimates)
- /api/notifications (WebSocket + REST)
- /api/export/pdf, /api/export/csv (Report generation)
```

### Advanced Services and Features
```
Build production-ready services for Maryland Benefits Navigator:

1. EMAIL SERVICE:
   - SMTP configuration support (SendGrid, AWS SES, Mailgun)
   - HTML templates with Maryland branding
   - Plain text fallback generation
   - Offline user detection via WebSocket
   - Preference-based delivery
   - Production-ready with nodemailer

2. POLICY CHANGE MONITORING:
   - Automated document version tracking
   - Diff generation and impact analysis
   - Role-based notifications (Staff, Navigators)
   - Review workflow with resolution tracking
   - Change severity classification

3. COMPLIANCE SUITE:
   - Gemini-powered validation engine
   - WCAG, LEP, federal regulation checks
   - Admin UI for compliance rules
   - Violation tracking with severity levels
   - Remediation workflows

4. INTAKE COPILOT:
   - Gemini-powered conversational intake
   - Multi-turn dialogue for SNAP applications
   - Structured data extraction
   - Progress tracking and visualization
   - Form generation at completeness threshold
   - PolicyEngine integration for estimates

5. AUDIT AND SECURITY:
   - Comprehensive audit logging
   - CSRF protection (double-submit cookie)
   - Multi-tier rate limiting
   - Security headers (Helmet, CSP, HSTS)
   - Session management with PostgreSQL
   - Role-based access control

6. CACHING STRATEGY:
   - Server-side NodeCache with TTL
   - Strategic invalidation on mutations
   - Frequently accessed data caching
   - Database query optimization
   - API response caching
```

---

## 🗄️ Database Schema Design

```
Design PostgreSQL database schema using Drizzle ORM for multi-program system:

CORE ENTITIES:
- users: id, email, password_hash, role (user/navigator/caseworker/admin/super_admin), created_at
- benefit_programs: id, code (MD_SNAP, MD_MEDICAID, etc), name, description, eligibility_rules
- documents: id, user_id, program_id, filename, file_path, document_type, processing_status, gemini_analysis
- document_chunks: id, document_id, chunk_text, embedding (vector), metadata, chunk_index

NAVIGATOR WORKSPACE:
- client_cases: id, applicant_id, navigator_id, case_number, status, household_composition
- client_interaction_sessions: id, client_case_id, session_type, notes, created_at
- client_verification_documents: id, session_id, requirement_type, verification_status, gemini_response

RULES AS CODE:
- extracted_rules: id, program_id, rule_type, rule_code, regulation_reference, effective_date
- policy_calculations: id, household_data, benefit_amounts, calculation_method, created_at

NOTIFICATIONS:
- notifications: id, user_id, type, title, message, priority, is_read, action_url, created_at
- notification_preferences: user_id, email_enabled, in_app_enabled, policy_changes, feedback_alerts

POLICY MANAGEMENT:
- policy_changes: id, program_id, change_type, severity, old_content, new_content, effective_date
- policy_change_impacts: id, policy_change_id, impact_type, affected_entity, resolution_status

COMPLIANCE:
- compliance_rules: id, rule_type, regulation_reference, validation_criteria, severity
- compliance_violations: id, rule_id, entity_type, entity_id, violation_details, status

EVALUATION:
- evaluation_test_cases: id, program, test_type, input_data, expected_output, tags
- evaluation_runs: id, test_suite, pass_at_1_score, variance_tolerance, results_summary

Include proper foreign keys, indexes for performance, vector extension for embeddings, and migration support.
```

---

## 🎨 Maryland DHS Design System

```
Implement Maryland Department of Human Services Digital Style Guide (2025):

1. COLOR SYSTEM:
   - MD Blue: #0D4F8B (primary navigation, headers, buttons)
   - MD Red: #C5203A (alerts, critical actions, error states)  
   - MD Gold: #FFB81C (accents, gold stripe, highlights)
   - Success: Green for approved documents
   - Muted: Gray tones for backgrounds

2. BRANDING ELEMENTS:
   - Maryland state flag integration
   - "State of Maryland" official text
   - DHS blue header with gold stripe
   - Maryland seal in navigation
   - Responsive sizing for mobile/desktop

3. COMPONENT LIBRARY:
   - MDAlert: 5 variants (info, warning, error, success, restricted)
   - Verification stamps: APPROVED (green), VERIFIED (blue)
   - Status badges: Program-specific color coding
   - Document viewer: Zoom, rotate, fit controls
   - Mobile nav: 4-column fixed grid

4. TYPOGRAPHY:
   - System font stack with fallbacks
   - Accessible sizing and spacing
   - Plain language compliance
   - Reading level indicators

5. ACCESSIBILITY REQUIREMENTS:
   - WCAG 2.1 AA compliance mandatory
   - 4.5:1 contrast ratio minimum
   - Touch targets 44px minimum
   - Keyboard navigation complete
   - Screen reader optimization
   - Focus visible on all interactive elements
   - ARIA labels and semantic HTML

6. MOBILE-FIRST:
   - Bottom navigation for touch devices
   - Progressive enhancement
   - Responsive images and media
   - Optimized for low-bandwidth users
```

---

## 🔧 Configuration and Deployment

```
Set up production-ready environment for Maryland Benefits Navigator:

1. ENVIRONMENT VARIABLES:
   - GEMINI_API_KEY (Google AI Studio or Vertex)
   - DATABASE_URL (Neon PostgreSQL connection)
   - GOOGLE_APPLICATION_CREDENTIALS (GCS service account)
   - SESSION_SECRET (cryptographically secure)
   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (email service)
   - NODE_ENV (development/production)

2. REPLIT DEPLOYMENT:
   - Workflow: "Start application" runs `npm run dev`
   - Auto-restart on package changes
   - Environment secrets in Replit Secrets
   - Port 5000 for frontend (0.0.0.0 binding)
   - Static asset serving via Vite

3. DATABASE SETUP:
   - Neon PostgreSQL with connection pooling
   - Drizzle ORM for type-safe queries
   - Migration: `npm run db:push` (no manual SQL)
   - Seed data for 7 benefit programs
   - Development vs production data separation

4. GOOGLE CLOUD INTEGRATION:
   - Service account with Storage Admin role
   - Bucket: repl-default-bucket-$REPL_ID
   - ACL: public/ and .private/ directories
   - Signed URLs for secure uploads
   - Environment variable: PUBLIC_OBJECT_SEARCH_PATHS

5. SECURITY SETUP:
   - CSRF protection with csrf-csrf
   - Rate limiting with express-rate-limit
   - Helmet for security headers
   - Content Security Policy (environment-aware)
   - HTTPS-only cookies in production
   - Password hashing with bcryptjs

Include health checks, error monitoring, logging configuration, and graceful shutdown handling.
```

---

## 🧪 Testing and Quality Assurance

```
Implement comprehensive testing strategy for multi-program benefits system:

1. FRONTEND TESTING:
   - Component: React Testing Library + Vitest
   - Integration: User journey testing
   - Accessibility: axe-core for WCAG compliance
   - Visual regression: Screenshot comparison
   - Mobile: Touch interaction testing
   - data-testid attributes on all interactive elements

2. BACKEND TESTING:
   - API: supertest for endpoint validation
   - Database: Integration tests with test DB
   - Services: Mock Gemini API responses
   - Error handling: Edge case coverage
   - Performance: Load testing for scale

3. AI/ML TESTING:
   - RAG accuracy: Relevance evaluation
   - Document analysis: Gemini Vision validation
   - Reading level: Flesch-Kincaid compliance
   - PolicyEngine: Benefit calculation accuracy
   - Citation tracking: Source verification

4. MARYLAND EVALUATION FRAMEWORK:
   - 25-case test structure (8 eligibility, 12 calculations, 5 edge cases)
   - MD-specific tags: md_asset_limit, md_drug_felony, bbce
   - 2% variance tolerance for PolicyEngine
   - pass@1 scoring methodology
   - Benchmark against Column Tax (41% strict, 61% lenient)

5. ACCESSIBILITY AUDITING:
   - Automated: Lighthouse CI, axe-core
   - Manual: Screen reader testing (NVDA, VoiceOver)
   - Keyboard: Tab order and focus management
   - Color: Contrast ratio verification
   - Plain language: Grade level assessment

Include automated CI/CD testing, test data management, coverage reporting, and quality gates.
```

---

## 🚀 Advanced Features and Integrations

```
Implement production-ready features for Maryland Benefits Navigator:

1. NAVIGATOR WORKSPACE:
   - Client case dashboard with household composition
   - Interaction session tracking with notes
   - Document verification workflow
   - E&E export for DHS integration
   - Scenario modeling with PolicyEngine
   - What-if analysis with benefit comparisons

2. POLICYENGINE INTEGRATION:
   - Multi-benefit calculations (SNAP, Medicaid, EITC, CTC, SSI, TANF)
   - Maryland-specific rule overrides
   - Household scenario modeling
   - Income and deduction inputs
   - Benefit comparison charts (Recharts)
   - PDF export for client counseling

3. INTAKE COPILOT:
   - Gemini-powered conversational assistant
   - Multi-turn dialogue for SNAP applications
   - Structured data extraction from chat
   - Progress visualization (completeness %)
   - Form generation at threshold
   - PolicyEngine real-time estimates

4. ANONYMOUS BENEFIT SCREENER:
   - No login required for public access
   - Session-based screening history
   - PolicyEngine eligibility checks
   - "Save Results" with account creation
   - Data migration on signup

5. COMPLIANCE SUITE:
   - Admin UI at /admin/compliance
   - Gemini validation engine
   - WCAG, LEP, federal regulation checks
   - Violation tracking and remediation
   - Severity-based prioritization

6. EXPORT AND REPORTING:
   - PDF: Maryland-branded with jsPDF
   - CSV: Formatted with papaparse
   - Document review history exports
   - Benefit comparison reports
   - Timestamped file naming

7. POLICY CHANGE MONITORING:
   - Automated version tracking
   - Diff generation with impact analysis
   - Admin review workflow
   - Staff notifications by role
   - Resolution tracking

8. DEMO ENVIRONMENT:
   - 4 pre-seeded users: applicant, navigator, caseworker, admin
   - Credentials displayed on login page
   - "Use Demo Account" collapsible helper
   - Password: Demo2024! for all demo users

Include scalability planning, disaster recovery, data backup, and compliance documentation.
```

---

## 🎯 Complete System Recreation Prompt

**Use this single comprehensive prompt to recreate the entire system:**

```
Create a complete Maryland Multi-Program Benefits Navigator System - an AI-powered platform combining Retrieval-Augmented Generation (RAG) with Rules as Code for 7 Maryland benefit programs: SNAP, Medicaid, TCA, OHEP, WIC, MCHP, and VITA.

SYSTEM ARCHITECTURE:
- Frontend: React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS + Wouter
- Backend: Express.js + TypeScript + PostgreSQL (Neon) + Drizzle ORM
- AI: Google Gemini 2.5 Flash, text-embedding-004, Gemini Vision
- Storage: Google Cloud Storage with ACL management
- Integrations: PolicyEngine for benefit calculations

CORE FEATURES:
1. Multi-Program RAG Search: Conversational AI across 7 programs with citations
2. Document Verification: Gemini Vision analysis with verification stamps
3. Navigator Workspace: Client case management, E&E export, scenario modeling
4. PolicyEngine Integration: Deterministic eligibility and benefit calculations
5. Real-Time Notifications: WebSocket with email backup for offline users
6. Bulk Document Actions: Checkbox selection, select all, bulk approve/reject
7. Export Reports: PDF/CSV with Maryland DHS branding
8. Intake Copilot: Gemini-powered conversational SNAP application assistant
9. Compliance Suite: AI validation against WCAG, LEP, federal regulations
10. Policy Change Monitoring: Automated diff detection with staff alerts

MARYLAND DHS DESIGN SYSTEM:
- Colors: DHS Blue #0D4F8B, DHS Red #C5203A, Gold #FFB81C
- Branding: Maryland flag, state seal, official header with gold stripe
- Components: MDAlert (5 variants), verification stamps, status badges
- Mobile: Bottom navigation (4-column grid), responsive breakpoints
- Accessibility: WCAG 2.1 AA mandatory, plain language (Grade 6-8)

MULTI-ROLE ARCHITECTURE:
- Applicant: Document upload, benefit screening, intake copilot
- Navigator: Workspace, client cases, scenario modeling, E&E export
- Caseworker: Document review queue, bulk actions, compliance tools
- Admin: Policy management, compliance suite, audit logs, API docs

DATABASE SCHEMA:
users, benefit_programs, documents, document_chunks (vectors), client_cases, client_interaction_sessions, client_verification_documents, extracted_rules, policy_calculations, notifications, notification_preferences, policy_changes, compliance_rules, evaluation_test_cases

KEY SERVICES:
- RAG: Semantic search with Gemini embeddings and cosine similarity
- Document Processing: OCR → Classification → Gemini Vision → Verification
- PolicyEngine: Multi-benefit calculations with Maryland overrides
- Notification: WebSocket real-time + email backup for offline
- Email: SMTP-ready with HTML templates and Maryland branding
- Compliance: Gemini validation engine for regulatory checks
- Intake Copilot: Multi-turn conversational assistant with data extraction

DEPLOYMENT:
- Replit-compatible with workflows and environment secrets
- PostgreSQL migrations via Drizzle (`npm run db:push`)
- Google Cloud Storage integration with service account
- WebSocket server on /ws/notifications
- Health checks and graceful shutdown

SECURITY & COMPLIANCE:
- CSRF protection, rate limiting, security headers
- Role-based access control (5 levels)
- Audit logging for all mutations
- WCAG 2.1 AA compliance throughout
- Maryland replaceability principle (swappable components)

TESTING:
- Frontend: React Testing Library, axe-core, data-testid attributes
- Backend: supertest, mock Gemini, integration tests
- AI: RAG accuracy, PolicyEngine validation, citation tracking
- Maryland Evaluation Framework: 25-case suite with 2% tolerance

Include comprehensive error handling, logging, caching, performance optimization, and extensive documentation for DHS integration readiness.
```

---

## 📋 Integration Checklist

Use this checklist when integrating with existing Maryland DHS systems:

- [ ] **Maryland Replaceability**: All components swappable with DHS systems
- [ ] **E&E Export**: Navigator workspace data export for enrollment systems
- [ ] **PolicyEngine**: Benefit calculations match DHS business rules
- [ ] **Document Standards**: Compatible with existing document management
- [ ] **Audit Compliance**: Full audit trail for regulatory review
- [ ] **Security**: Meets DHS cybersecurity requirements
- [ ] **Accessibility**: WCAG 2.1 AA verified across all features
- [ ] **Plain Language**: Grade 6-8 reading level compliance
- [ ] **Data Privacy**: HIPAA/PII protection in place
- [ ] **Email Notifications**: SMTP configured with approved provider

---

## 🔄 Recent Major Updates (October 2025)

### Design System Enhancements
- ✅ Maryland DHS color palette (#0D4F8B, #C5203A, #FFB81C)
- ✅ MDAlert component with 5 variants
- ✅ Verification stamps for approved documents
- ✅ Mobile bottom navigation (4-column grid)
- ✅ Document viewer controls (zoom, rotate, fit)
- ✅ Recent searches with localStorage

### Feature Additions
- ✅ Bulk document actions (select all, bulk approve/reject)
- ✅ Document thumbnail previews in review queue
- ✅ Email notification backup for offline users
- ✅ Export reports (PDF/CSV) with Maryland branding
- ✅ PolicyEngine integration for benefit calculations
- ✅ Intake copilot with conversational assistant
- ✅ Anonymous benefit screener (no login)
- ✅ Household scenario workspace with what-if analysis
- ✅ Compliance validation suite
- ✅ Policy change diff monitoring
- ✅ Maryland evaluation framework
- ✅ Demo environment with 4 pre-seeded users

### Technical Improvements
- ✅ WebSocket notifications with real-time delivery
- ✅ Server-side caching with NodeCache
- ✅ Database query optimization
- ✅ Security headers and CSRF protection
- ✅ Multi-tier rate limiting
- ✅ Dynamic imports for code splitting
- ✅ Comprehensive data-testid coverage

---

## 📚 Documentation Files

Related documentation in the repository:

- `docs/EMAIL-SETUP.md` - Email notification production setup
- `docs/API.md` - OpenAPI/Swagger specification (to be created)
- `docs/ARCHITECTURE.md` - System diagrams and data flow (to be created)
- `docs/DATABASE.md` - ERD and schema documentation (to be created)
- `docs/SECURITY.md` - Authentication and authorization (to be created)
- `docs/DEPLOYMENT.md` - Production deployment runbook (to be created)
- `docs/INTEGRATION.md` - DHS integration guide (to be created)
- `docs/DESIGN-SYSTEM.md` - Maryland style guide implementation (to be created)
- `replit.md` - Project overview and architecture summary
- `TECHNICAL_DOCUMENTATION.md` - Comprehensive technical reference

---

These prompts provide complete guidance for recreating the Maryland Multi-Program Benefits Navigator System with full functionality, proper Maryland DHS branding, and production-ready features for integration with marylandbenefits.gov.
