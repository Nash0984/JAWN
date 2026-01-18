# Overview

The Joint Access Welfare Network (JAWN) is an AI-powered, white-label, multi-state platform (supporting Maryland, Pennsylvania, Virginia, Utah, Indiana, and Michigan) designed to optimize financial well-being. It integrates public benefits eligibility with federal and state tax preparation through a single conversational interface. The platform leverages Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API to provide comprehensive financial optimization. A key innovation is the use of a unified household profile for both benefit calculations and tax preparation, combined with AI-driven cross-enrollment intelligence. JAWN is a fully operational, production-grade system with GDPR/HIPAA compliance, featuring an E-Filing Dashboard and an autonomous Benefits Access Review system, deployed as a single unified application with multi-tenant architecture.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS, emphasizing modularity, accessibility, and mobile-first responsiveness. It includes a Command Palette, animations, resizable views, skeleton loading, and auto-save. A public applicant portal supports document checklist generation, notice letter explanation, and policy search.

## Technical Implementations
The backend uses Express.js and TypeScript, with PostgreSQL via Drizzle ORM on Neon Database. It incorporates a multi-stage document processing pipeline (OCR, classification, semantic chunking, embedding generation). The Google Gemini API is central for AI analysis, query processing, and RAG. Policy text is transformed into "Rules as Code" via a "Living Policy Manual" and "Rules Extraction Pipeline." Google Cloud Storage handles document storage. AI orchestration includes a strategy pattern, centralized rate limiting, cost tracking, exponential backoff, and Gemini context caching.

## Feature Specifications
### Core Platform Features
-   **Navigator Workspace**: Client management.
-   **Financial Opportunity Radar**: Real-time cross-program eligibility and dynamic benefit calculations.
-   **Adaptive Intake Copilot**: Conversational AI for application guidance.
-   **PolicyEngine Integration**: Multi-benefit calculations.
-   **Tax Preparation System**: Integrates federal/state tax preparation with benefits, including Gemini Vision for tax document extraction, VITA document upload, PolicyEngine tax calculation, and PDF generation for Form 1040/Maryland Form 502.
-   **E-Filing Dashboard**: Production-ready e-filing management with real-time WebSocket status updates, validation, XML generation, and submission tracking.
-   **Cross-Enrollment Intelligence Engine**: AI-powered recommendations for unclaimed benefits.
-   **IRS Use & Disclosure Consent Form**: IRS Publication 4299 compliant consent form with electronic signature.
-   **Unified Monitoring & Analytics Platform**: 7 observability domains and an admin dashboard.
-   **Benefits Access Review (BAR)**: Autonomous case quality monitoring with AI assessment, blind supervisor review, and automated notifications.
-   **Admin Dashboard Suite**: Comprehensive interfaces for monitoring, security, user management, analytics, and AI service monitoring.
-   **AI Document Intelligence Pipeline**: Gemini Vision API for OCR and smart field extraction.
-   **Conversational AI Intake Assistant**: Natural language chat with multi-language and voice support.
-   **Smart RAG System**: Semantic search across policy documents using Gemini embeddings.
-   **Fraud Detection Pipeline**: Pattern analysis for unusual applications.
-   **Smart Workflow Automation**: AI-driven task prioritization and automated case routing.
-   **Payment Error Reduction (PER) Module**: Comprehensive SNAP payment error prevention, including Income Verification, Pre-Submission Validator, Duplicate Claim Detector, Explainable Nudge Service (XAI), and Reporting.
-   **PER Supervisor Dashboard**: Three-tier hierarchy for quality assurance monitoring with statewide, office-filtered, and caseworker views.
-   **E&E Synthetic Database**: Sidecar testing database implementing the Maryland E&E Data Dictionary with 14 core tables, expanded fields for contacts, addresses, income, resources, expenses, verifications, and ABAWD tracking. Includes a Synthetic Data Generator to create realistic client records.
-   **External Data Source Abstraction Layer**: Digital twin architecture for external system integration with swappable adapters and a registry pattern. Registers 6 data sources (wage records, vital statistics, MVA, commercial verification, SSA, beacon). Includes a Life Event Monitor Service to detect and process life events.
-   **PolicyEngine Guardrail Service**: Cross-validates Rules as Code decisions against PolicyEngine as a verification layer.
-   **Human-in-the-Loop Provision Mapping Pipeline**: Automated legislative change detection and integration system:
    -   **Provision Extraction Service**: Gemini 2.0 Flash parses public law text to extract section-level amendments with U.S. Code citations, affected programs, and provision types (amends, supersedes, adds_exception, modifies_threshold, clarifies, removes, creates).
    -   **Ontology Matcher Service**: Three-strategy AI matching system proposing links between extracted provisions and 176+ ontology terms via citation matching (95% score), semantic similarity (75% threshold), and AI inference (Gemini).
    -   **Provision Review UI** (`/admin/provision-review`): Side-by-side law text and ontology term comparison, priority filtering (urgent/high/normal/low), bulk approve/reject, public law context, and display of affected rules requiring re-verification.
    -   **Human Checkpoint Enforcement**: All AI-proposed mappings require human approval before affecting the rules engine. When approved mappings affect existing formal rules, `appliedAt` is deferred and `processingStatus` set to `pending_rule_verification` until Z3 re-verification completes.
    -   **Z3 Re-verification Queue**: Affected formal rules are automatically queued with batch tracking (`verificationBatchId`) to ensure continued validity under updated law.
    -   **GovInfo Integration**: Auto-triggers provision extraction when new public laws are synced via the Smart Scheduler.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Role-based authentication, object-level security, CSRF protection.
-   **Production Security Hardening**: Field-level encryption, secure file uploads, strong password enforcement, enhanced session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Enterprise Compliance Framework**: GDPR and HIPAA compliance.
-   **Production Readiness**: Health check endpoints, role-based rate limiting, DoS protection, database connection pooling, graceful shutdown.
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **Performance Optimization**: Server-side caching, extensive database indexing, non-blocking initialization.
-   **Rules-as-Code Architecture**: Maryland/tenant rules engines are the sole decision-makers; PolicyEngine is for verification only.
-   **Neuro-Symbolic Hybrid Gateway**: A production-grade framework ensuring accountability in public-sector AI, routing all eligibility decisions through a three-layer architecture:
    1.  **Neural Layer (Gemini)**: For extraction and translation of unstructured data only.
    2.  **Rules-as-Code (RaC) Layer**: Legal knowledge base transforming statutes into machine-verifiable SMT-LIB artifacts.
    3.  **Symbolic/Z3 Solver Layer**: Proof engine for satisfiability checks, generating UNSAT cores with statutory citations.
    Includes Dual Verification Modes for explanation and case eligibility, run in parallel with cross-validation.
-   **Neuro-Symbolic Maintenance Methodology**: A key methodological innovation applying the same hybrid principles used for eligibility decisions to *maintain the engine itself* when laws change. This extends the original paper's framework beyond decision-time accountability:
    1.  **Neural (Gemini 2.0 Flash)**: Parses public law text, extracts provisions, proposes ontology mappings via semantic similarity and AI inference.
    2.  **Human-in-the-Loop Checkpoint**: Acts as the verification/proof layer - reviewers validate AI-proposed mappings before they can affect the rules engine (replacing blind trust with human oversight).
    3.  **Z3 Re-verification Queue**: Affected formal rules are automatically queued for symbolic re-verification, ensuring they remain valid under updated law.
    This ensures no law changes automatically affect the eligibility engine until a human reviews the mapping AND the affected formal rules are re-verified, maintaining accountability throughout the system lifecycle.
-   **Testing**: Comprehensive testing with Vitest, @testing-library/react, and supertest, including a regression gate with 216+ integration tests.
-   **Distributed Caching System**: Redis/Upstash.
-   **Scalable Connection Pooling**: Neon Pooled Connections.
-   **WebSocket Real-Time Service**: Session-based authenticated WebSocket service.
-   **Unified Metrics Service**: Comprehensive monitoring with Prometheus Export.
-   **Universal Feature Registry**: Ensures all programs access all features through a modular architecture.
-   **PM2 Production Deployment**: Cluster mode deployment.
-   **Multi-tenant Architecture**: Single unified application for all 24 Maryland LDSS offices.
-   **Error Tracking & Monitoring**: Sentry integration with lazy initialization and error boundary.

# External Dependencies

-   **AI Services**: Google Gemini API, Google Gemini Vision API.
-   **Benefit Calculations**: PolicyEngine Household API.
-   **Database**: PostgreSQL (Drizzle ORM, Neon Database).
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine, pdf-parse, ExcelJS.
-   **UI Components**: Radix UI primitives (shadcn/ui).
-   **Data Visualization**: Recharts.
-   **PDF Generation**: jsPDF and jspdf-autotable.
-   **Legislative Data**: Congress.gov API, GovInfo API.
-   **Monitoring & Alerts**: Sentry error tracking.
-   **Communication**: Email service (Nodemailer).
-   **Caching**: Redis/Upstash.