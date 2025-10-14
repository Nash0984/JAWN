# Overview

The Maryland Universal Financial Navigator is an AI-powered platform integrating public benefits eligibility with federal and state tax preparation, designed as a universal financial command center. It leverages Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API to offer comprehensive financial optimization through a single conversational interface. The system supports six Maryland benefit programs (SNAP, Medicaid, TCA/TANF, OHEP, Tax Credits) and IRS VITA tax assistance, with future plans for full federal/state e-filing. A core innovation is its use of a single household profile to drive both benefit calculations (via PolicyEngine) and tax preparation (Form 1040 generation), coupled with AI-driven cross-enrollment intelligence to identify unclaimed benefits.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS, emphasizing modularity, accessibility (WCAG, semantic HTML, ARIA), and mobile-first responsiveness. It features a `PolicyChatWidget`, Command Palette, Framer Motion animations, resizable split views, and skeleton loading states. A public applicant portal offers document checklist generation, notice letter explanation, and simplified policy search in both AI-powered and manual modes.

## Technical Implementations
The backend uses Express.js with TypeScript and PostgreSQL via Drizzle ORM on Neon Database. It includes a multi-stage document processing pipeline for OCR, classification, semantic chunking, and embedding generation. The Google Gemini API is central for analysis, query processing, and RAG. Key features include a "Living Policy Manual" for human-readable policy text and a "Rules Extraction Pipeline" to derive structured "Rules as Code." Google Cloud Storage is used for document file storage with custom ACLs.

## Feature Specifications
### Core Platform Features
-   **Navigator Workspace**: Manages client interactions and E&E export.
-   **Feedback Collection System**: User feedback on AI responses.
-   **Admin Enhancement Tools**: Audit Log Viewer, Security Monitoring Dashboard, API Documentation, Feedback Management.
-   **Notification System**: In-app notifications for updates and alerts.
-   **Policy Change Diff Monitor**: Tracks policy document versions and impact.
-   **Compliance Assurance Suite**: Gemini-powered validation of policy documents.
-   **Adaptive Intake Copilot**: Gemini-powered conversational assistant for application guidance.
-   **PolicyEngine Integration**: Provides accurate multi-benefit calculations.
-   **Anonymous Benefit Screener**: Public-facing eligibility check tool.
-   **Household Scenario Workspace**: Modeling tool for navigators.
-   **VITA Tax Assistant**: Knowledge base for federal tax assistance.
-   **Maryland Evaluation Framework**: Comprehensive accuracy testing system with test case management, evaluation run execution, KPI dashboard showing pass rates and variance metrics, benchmark visualization against Column Tax baseline (41% strict, 61% lenient), and detailed test results with JSON diff comparison.

### Tax Preparation System
Integrates federal/state tax preparation with public benefits eligibility.
-   **Tax Document Extraction Service**: Gemini Vision-powered extraction from tax forms (W-2, 1099-MISC, 1099-NEC, 1099-INT, 1099-DIV, SSA-1099, 1099-R, 1095-A, 1098 forms). Uses Gemini 2.5 Flash model with confidence scoring (threshold 0.85 for auto-approval) and quality flags for invalid EIN/SSN data.
-   **VITA Tax Document Upload**: Integrated uploader in VITA Step 3 (Income) with auto-population of intake fields. Supports 12 document types, real-time extraction progress, document list with confidence scores, manual review badges, and delete functionality. Auto-increments W-2 job count, toggles income type flags (1099, interest, dividends, Social Security, retirement, health insurance marketplace). **VITA Step 3 Bugs Fixed (Oct 2025)**: (1) Added missing `count` import from drizzle-orm to fix ReferenceError in notifications API, (2) Fixed `storage.getCountyById()` to `storage.getCounty()` in county context middleware, (3) Fixed undefined `sessionId` variable to `selectedSessionId` in TaxDocumentUploader component, (4) Corrected invalid form schema fields for proper auto-population. VITA intake now loads all 5 steps without crashes.
-   **PolicyEngine Tax Calculation Service**: Federal tax calculations using PolicyEngine US.
-   **Form 1040 PDF Generator**: IRS-compliant Form 1040 PDF generation.
-   **Maryland Form 502 Generator**: State tax PDF generation with progressive tax brackets (2%-5.75%), all 24 county tax calculations, MD EITC (50% of federal), property tax credit, and renter's credit.
-   **Cross-Enrollment Intelligence Engine**: AI-powered analysis to identify missed benefits. Displays AI-powered recommendations for unclaimed benefits in the tax preparation interface.

### Multi-County Deployment System
Supports 24 Maryland counties with county-specific branding, data isolation, and localized experiences. Includes a `counties` table for metadata and branding, `county_users` for role assignments, and data filtering by county context. Pilot deployment includes Baltimore City, Baltimore County, Montgomery County, and Prince George's County.

### Gamification System
Tracks performance and awards achievements to motivate navigators using operational KPIs such as cases closed, benefits secured, and cross-enrollments identified. Features a leaderboard system with county-specific and statewide scopes.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Basic user authentication with roles, object-level security via Google Cloud Storage ACLs. **CSRF Protection Fixed (Oct 2025)**: Three-part fix implemented: (1) Added cookie-parser middleware for double-submit cookie pattern, (2) Updated getSessionIdentifier to use req.sessionID for consistent session tracking, (3) Changed saveUninitialized to true to ensure session persistence across requests. Session cookies now persist correctly and CSRF validation works system-wide.
-   **Production Security Hardening (Oct 2025)**: Comprehensive security enhancements implemented: (1) Field-level encryption for SSN and bank account fields using AES-256-GCM with JSONB storage, (2) File upload security with MIME type validation, magic number verification, filename sanitization, and virus scanning hooks, (3) Password strength enforcement with 12-round bcrypt cost factor, complexity requirements (12+ chars, uppercase/lowercase/number/special), common password blocking, and strength scoring (0-100), (4) Enhanced session security with httpOnly, secure (prod), sameSite (strict in prod), rolling timeout, and custom cookie naming, (5) Ownership verification middleware preventing horizontal privilege escalation - staff members can only access their own data by default (allowStaff=false), admins retain override capability for auditing, (6) CORS hardening with environment-based whitelisting, (7) Security headers with CSP and HSTS, (8) XSS sanitization middleware with iterative entity decoding, (9) SQL injection protection via Drizzle ORM parameterization, (10) Security Monitoring Dashboard with real-time metrics for failed authentication, XSS blocks, authorization failures, rate limiting, CSRF violations, session events, threat detection with top attacking IPs, and security score calculation.
-   **Production Readiness & Hardening (Oct 2025)**: Enterprise-grade production infrastructure: (1) Production environment validation with 14 comprehensive checks run on startup (critical env vars, database connectivity, API key validation, encryption keys), (2) Health check endpoints for Kubernetes/load balancers (/health for basic status, /ready for readiness probe, /startup for initialization probe), (3) Enhanced role-based rate limiting with tier-specific limits (admin 1000/15min, navigator/caseworker 500/15min, applicant 100/15min, anonymous 20/15min, auth endpoints 5/15min, AI endpoints 20/min), (4) DoS protection middleware with request size limits (10MB body, 5MB JSON), URL length limits, timeout enforcement, and slow request monitoring, (5) Database connection pooling configuration (DB_POOL_MIN, DB_POOL_MAX env vars), (6) Security audit completed with critical happy-dom RCE vulnerability fixed, remaining issues documented with mitigation strategies in SECURITY_ADVISORY.md, (7) Comprehensive production deployment documentation (PRODUCTION_DEPLOYMENT.md) with environment setup, database migration, monitoring configuration, and rollback procedures, (8) Graceful shutdown with connection draining for zero-downtime deployments.
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **E-Filing Roadmap**: Phased approach for federal/Maryland e-filing.
-   **Security & Performance**: CSRF protection, rate limiting, security headers, server-side caching, database indexing.
-   **Testing**: Vitest, @testing-library/react, and supertest for various test types.

## Performance Optimization Philosophy
The system targets ~70% total cost reduction through smart scheduling and intelligent caching, focusing on caching deterministic, expensive operations with source-specific TTLs.
-   **Smart Scheduler**: Reduces API calls by 70-80% for legislative source version checks.
-   **Intelligent Caching System**: Achieves 40-80% reduction in API calls across various services:
    -   **Gemini Embedding Cache**: 24-hour TTL, ~60-80% reduction.
    -   **RAG Query Cache**: 15-minute TTL, ~50-70% reduction.
    -   **Document Analysis Cache**: 1-hour TTL, ~40-60% reduction.
    -   **PolicyEngine Calculation Cache**: 1-hour TTL, ~50-70% reduction.
-   **Database Query Optimization**: Fixes N+1 patterns and uses query pushdown.
-   **Cache Management**: Admin endpoints for stats, cost savings, and manual invalidation.

# External Dependencies

-   **AI Services**: Google Gemini API (`@google/genai`) for language models, document analysis, and embeddings.
-   **Benefit Calculations**: PolicyEngine (`policyengine-us`) Python package.
-   **Database**: PostgreSQL via Drizzle ORM (`drizzle-orm`) with Neon Database.
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine, Google Gemini Vision API, pdf-parse.
-   **UI Components**: Radix UI primitives via shadcn/ui.
-   **Data Visualization**: Recharts.
-   **PDF Generation**: jsPDF and jspdf-autotable.
-   **IRS Integration (Planned)**: IRS Bulk Data API, MeF FIRE API.
-   **Maryland E-Filing (Planned)**: MDTAX iFile system API.