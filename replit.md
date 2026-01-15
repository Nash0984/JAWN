# Overview

The Maryland Universal Financial Navigator (JAWN) is an AI-powered platform that optimizes financial well-being by integrating public benefits eligibility with federal and state tax preparation. It has evolved into a white-label multi-state system (Joint Access Welfare Network - JAWN) supporting Maryland, Pennsylvania, Virginia, Utah, Indiana, and Michigan. The platform functions as a universal financial command center, utilizing Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API to provide comprehensive financial optimization through a single conversational interface. A core innovation is the use of a unified household profile for both benefit calculations and tax preparation, coupled with AI-driven cross-enrollment intelligence. The system is fully operational, featuring GDPR/HIPAA compliance, production-grade infrastructure, an E-Filing Dashboard, and an autonomous Benefits Access Review system, deployed as a single unified application with multi-tenant architecture.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend is developed using React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS, focusing on modularity, accessibility, and mobile-first responsiveness. It includes features like a Command Palette, animations, resizable views, skeleton loading, and auto-save. A public applicant portal facilitates document checklist generation, notice letter explanation, and simplified policy search.

## Technical Implementations
The backend is built with Express.js and TypeScript, utilizing PostgreSQL via Drizzle ORM on Neon Database. It incorporates a multi-stage document processing pipeline (OCR, classification, semantic chunking, embedding generation). The Google Gemini API is central for AI analysis, query processing, and RAG. A "Living Policy Manual" and "Rules Extraction Pipeline" transform policy text into structured "Rules as Code." Google Cloud Storage is used for document storage. AI orchestration employs a strategy pattern, centralized rate limiting, cost tracking, exponential backoff, and Gemini context caching.

## Feature Specifications
### Core Platform Features
-   **Navigator Workspace**: Client management.
-   **Financial Opportunity Radar**: Real-time cross-program eligibility and dynamic benefit calculations.
-   **Adaptive Intake Copilot**: Conversational AI assistant for application guidance.
-   **PolicyEngine Integration**: Accurate multi-benefit calculations.
-   **Tax Preparation System**: Integrates federal/state tax preparation with public benefits eligibility, including Gemini Vision for tax document extraction, VITA document upload, PolicyEngine tax calculation, Form 1040/Maryland Form 502 PDF generation, and prior year support.
-   **E-Filing Dashboard**: Production-ready e-filing management with real-time WebSocket status updates, validation, XML generation, and submission tracking.
-   **Cross-Enrollment Intelligence Engine**: AI-powered recommendations for unclaimed benefits.
-   **IRS Use & Disclosure Consent Form**: IRS Publication 4299 compliant consent form with electronic signature.
-   **Unified Monitoring & Analytics Platform**: 7 observability domains and an admin dashboard.
-   **Benefits Access Review (BAR)**: Autonomous case quality monitoring with AI assessment, blind supervisor review, and automated notifications. Accessible at `/admin/bar` with review queue, completed reviews, and analytics tabs.
-   **Admin Dashboard Suite**: Comprehensive administrative interfaces including:
    -   `/admin/monitoring` - System health, performance metrics, cache status, e-filing tracking
    -   `/admin/security` - Security events monitoring, login attempts, threat detection, security score
    -   `/admin/users` - User management with role assignment, status filtering, activity tracking
    -   `/admin/analytics` - Platform usage metrics, feature adoption, session analytics
    -   `/admin/ai-monitoring` - AI service health, Gemini API usage, cost tracking
-   **AI Document Intelligence Pipeline**: Gemini Vision API for OCR and smart field extraction.
-   **Conversational AI Intake Assistant**: Natural language chat with multi-language and voice support.
-   **Smart RAG System**: Semantic search across policy documents using Gemini embeddings.
-   **Fraud Detection Pipeline**: Pattern analysis for unusual applications.
-   **Smart Workflow Automation**: AI-driven task prioritization and automated case routing.
-   **Payment Error Reduction (PER) Module**: Comprehensive SNAP payment error prevention system with a "predict and prevent" strategy, including:
    -   Income Verification Service
    -   Pre-Submission Validator
    -   Duplicate Claim Detector
    -   Explainable Nudge Service (XAI)
    -   PERM Reporting Service
-   **PER Supervisor Dashboard**: Three-tier hierarchy for proactive quality assurance monitoring:
    -   **Tier 1 (State Admin)**: Executive oversight with statewide metrics, trend analysis, and LDSS comparisons
    -   **Tier 2 (LDSS Supervisor)**: Office-filtered views with coaching queue, nudge compliance tracking, and diagnostic drill-down
    -   **Tier 3 (Caseworker)**: Real-time AI nudges, risk scoring, and decision support
    -   LDSS office selector for tier switching (Maryland-only; multi-state filtering requires counties.stateCode column migration)
    -   99.9% accuracy is an aspirational documentation goal, not a system requirement
-   **E&E Synthetic Database**: Sidecar testing database implementing complete Maryland E&E Data Dictionary (172+ fields):
    -   **14 Core Tables**: eeSyntheticIndividuals, eeSyntheticContacts (48 fields), eeSyntheticAddresses (42 fields), eeSyntheticIdentification, eeSyntheticCases, eeSyntheticProgramEnrollments, eeSyntheticProviders, eeSyntheticCaseClosures, eeSyntheticCaseMembers, eeSyntheticIncome, eeSyntheticResources, eeSyntheticExpenses, eeSyntheticVerifications, eeSyntheticAbawd
    -   **Expanded Contacts Fields**: Employer info (FEIN validation, address, phone), emergency contacts, authorized representatives with relationship types, communication preferences (email/SMS opt-in), fax numbers
    -   **Expanded Addresses Fields**: Homeless indicators (5% rate), shelter tracking (name/phone/contact), address verification status, LDSS service area codes, congressional/legislative districts, census tract/block group, lat/long, primary residence flags
    -   **New Income Table**: Employment/self-employment/unearned income with NDNH/SWICA wage verification flags, employer FEIN tracking, pay frequency codes, variable/seasonal income indicators
    -   **New Resources Table**: Countable assets (checking/savings/vehicles/property), fair market value, encumbrance, exemption tracking, vehicle details (VIN, use code), ownership percentages
    -   **New Expenses Table**: Shelter/medical/childcare/utility deductions, Standard Utility Allowance (SUA) codes (HUA/LUA/TEL), heating fuel types, utility indicators (electric/gas/water/phone)
    -   **New Verifications Table**: Document tracking with verification status, pending reasons, due dates, electronic verification sources (SSA/DHS/IRS), SSN/identity/citizenship/income/residency verification tracking
    -   **New ABAWD Table**: Work requirement tracking with 3-in-36 month counting, exemption reasons (disability/pregnancy/caregiving/student/work), work program enrollment (SNAP E&T/WIOA), sanction tracking, waiver county indicators
    -   **Synthetic Data Generator**: Creates 500+ realistic client records with configurable parameters: churnRate (20%), crossEnrollmentOpportunityRate (35%), averageHouseholdSize (2.5), activeEnrollmentRate (75%), homelessRate (5%), abawdRate (15%)
    -   **LDSS Distribution**: Cases distributed across 24 Maryland LDSS offices with regional codes (WMD/SMD/BALT/EMD/CMD/MMD)
    -   **API Endpoints**: GET /api/ee-synthetic/health (shows 14-table stats), GET /api/ee-synthetic/stats (detailed distributions), POST /api/ee-synthetic/generate (with new params), DELETE /api/ee-synthetic/clear

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Role-based authentication, object-level security, CSRF protection.
-   **Production Security Hardening**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, enhanced session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Enterprise Compliance Framework**: GDPR and HIPAA compliance.
-   **Production Readiness**: Health check endpoints, role-based rate limiting, DoS protection, database connection pooling, graceful shutdown.
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **Performance Optimization**: Server-side caching, extensive database indexing, non-blocking initialization.
-   **Rules-as-Code Architecture**: Maryland/tenant rules engines are the sole decision-makers, with PolicyEngine used for verification/validation only.
-   **Neuro-Symbolic Hybrid Gateway**: A production-grade implementation for accountability in public-sector AI, requiring all eligibility decisions to route through a three-layer architecture (per "A Neuro-Symbolic Framework for Accountability in Public-Sector AI" - Allen Sunny, University of Maryland):
    1.  **Neural Layer (Gemini)**: Exclusively for extraction and translation of unstructured data (e.g., OCR, document classification), never for eligibility decisions.
    2.  **Rules-as-Code (RaC) Layer**: Legal knowledge base transforming statutes into machine-verifiable SMT-LIB artifacts, maintaining provenance to legal citations.
    3.  **Symbolic/Z3 Solver Layer**: Proof engine that ingests case assertions and RaC-produced constraints to run satisfiability checks, generating UNSAT cores with statutory citations when rules are violated.
    
    **Dual Verification Modes (Implemented January 2026)**:
    -   **Mode 1 (Explanation Verification)**: Tests if AI responses/NOA explanations are legally consistent with statute. Returns SAT (legally valid) or UNSAT (violation with statutory citations). Used for: Chat interface AI response verification, NOA review, appeal support.
    -   **Mode 2 (Case Eligibility Verification)**: Tests if case data satisfies eligibility rules. The authoritative eligibility decision-maker.
    -   **Dual Verification**: Runs both modes in parallel with cross-validation to detect inconsistencies between explanations and case data.
    
    **Key Services**:
    -   `explanationClauseParser.ts`: Extracts ABox assertions from free-text explanations using ontology vocabulary matching, normalizes variants to canonical predicates, converts to Implies() syntax
    -   `z3SolverService.ts`: Vocabulary-filtered TBox rule retrieval, Mode 1 explanation verification, Mode 2 case verification
    -   `neuroSymbolicHybridGateway.ts`: Unified verification gateway with verifyExplanation(), verifyEligibility(), and dualVerification() methods
    
    **Gateway Integration Points**: Public API eligibility routes, Adaptive Intake Copilot, Cross-Enrollment Engine, Benefits Access Review (BAR), PER Module pre-submission validator, Cross-Enrollment Intelligence/Financial Opportunity Radar
    
    This gateway ensures that RaC feeds Z3, forming the "symbolic side" of the hybrid gateway, and all core services integrate through it for verification. The architecture enables legal accountability for all AI-generated eligibility statements.
-   **Testing**: Comprehensive testing with Vitest, @testing-library/react, and supertest, including a regression gate requiring 216+ integration tests across various modules.
-   **Distributed Caching System**: Production-ready cache with Redis/Upstash.
-   **Scalable Connection Pooling**: Neon Pooled Connections.
-   **WebSocket Real-Time Service**: Session-based authenticated WebSocket service.
-   **Unified Metrics Service**: Comprehensive monitoring across multiple domains with Prometheus Export.
-   **Universal Feature Registry**: Ensures all programs access all features, with modular architecture and cross-enrollment intelligence.
-   **PM2 Production Deployment**: Cluster mode deployment.
-   **Multi-tenant Architecture**: Single unified application for all 24 Maryland LDSS offices.
-   **Error Tracking & Monitoring**: Sentry integration with lazy initialization pattern - error boundary uses pure React class component to avoid hook timing issues at module load, and Sentry SDK is only imported when an error actually occurs. Service Worker caching disabled in development (replit.dev, localhost) to prevent stale code issues.

# External Dependencies

-   **AI Services**: Google Gemini API, Google Gemini Vision API.
-   **Benefit Calculations**: PolicyEngine Household API.
-   **Database**: PostgreSQL (Drizzle ORM, Neon Database).
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine, pdf-parse, ExcelJS.
-   **UI Components**: Radix UI primitives (shadcn/ui).
-   **Data Visualization**: Recharts.
-   **PDF Generation**: jsPDF and jspdf-autotable.
-   **Legislative Data**: Congress.gov API, GovInfo API, Maryland General Assembly website.
-   **Monitoring & Alerts**: Sentry error tracking.
-   **Communication**: Email service (Nodemailer).
-   **Caching**: Redis/Upstash.