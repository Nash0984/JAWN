# Overview

The Maryland Universal Financial Navigator is an AI-powered platform designed to optimize financial well-being by integrating public benefits eligibility with federal and state tax preparation. It acts as a universal financial command center, leveraging Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API. The platform offers comprehensive financial optimization through a single conversational interface, supporting six Maryland benefit programs (SNAP, Medicaid, TCA/TANF, OHEP, Tax Credits) and IRS VITA tax assistance. A core innovation is its use of a single household profile to drive both benefit calculations and tax preparation, coupled with AI-driven cross-enrollment intelligence to identify unclaimed benefits. Future plans include full federal and state e-filing.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS. It emphasizes modularity, accessibility (WCAG, semantic HTML, ARIA), and mobile-first responsiveness. Key features include a `PolicyChatWidget`, Command Palette, Framer Motion animations, resizable split views, skeleton loading states, auto-save and session recovery, progress indicators for multi-step forms, and a 2-minute quick screener. The platform also offers a public applicant portal for document checklist generation, notice letter explanation, and simplified policy search. Design adheres to civic tech best practices for benefit delivery platforms.

## Technical Implementations
The backend uses Express.js with TypeScript and PostgreSQL via Drizzle ORM on Neon Database. It incorporates a multi-stage document processing pipeline for OCR, classification, semantic chunking, and embedding generation. The Google Gemini API is central for analysis, query processing, and RAG. A "Living Policy Manual" and "Rules Extraction Pipeline" convert human-readable policy text into structured "Rules as Code." Google Cloud Storage handles document file storage with custom ACLs.

## Feature Specifications
### Core Platform Features
-   **Navigator Workspace**: Client management and E&E export.
-   **Financial Opportunity Radar**: Real-time cross-program eligibility tracking widget with dynamic benefit calculations, change detection, and smart alerts. Displays instant eligibility updates across all 6 Maryland programs (SNAP, Medicaid, TANF, EITC, CTC, SSI) as household data changes, featuring visual change indicators (↑↓ arrows, "New" badges), summary dashboard (total monthly/annual benefits, program count), and AI-powered cross-enrollment recommendations. Integrated into Household Profiler with 300ms debounced calculations, abort controller for request cancellation, and CSRF-protected API calls.
-   **Feedback Collection System**: Gathers user feedback on AI responses.
-   **Admin Enhancement Tools**: Audit logging, security monitoring, API documentation, feedback management.
-   **Notification System**: In-app alerts and updates.
-   **Policy Change Diff Monitor**: Tracks policy document versions.
-   **Compliance Assurance Suite**: Gemini-powered policy validation.
-   **Adaptive Intake Copilot**: Conversational AI assistant for application guidance.
-   **PolicyEngine Integration**: Accurate multi-benefit calculations.
-   **Anonymous Benefit Screener**: Public eligibility check tool.
-   **Household Scenario Workspace**: Modeling tool for navigators.
-   **Maryland Evaluation Framework**: Comprehensive accuracy testing system.

### Tax Preparation System
Integrates federal/state tax preparation with public benefits eligibility.
-   **Tax Document Extraction Service**: Gemini Vision-powered extraction from various tax forms with confidence scoring.
-   **VITA Tax Document Upload**: Integrated uploader with auto-population of intake fields.
-   **PolicyEngine Tax Calculation Service**: Federal tax calculations using PolicyEngine US.
-   **Form 1040 PDF Generator**: IRS-compliant PDF generation.
-   **Maryland Form 502 Generator**: State tax PDF generation including county tax calculations and Maryland-specific credits.
-   **Cross-Enrollment Intelligence Engine**: AI-powered recommendations for unclaimed benefits.

### Multi-County Deployment System
Supports 24 Maryland counties with county-specific branding, data isolation, and localized experiences, including pilot deployments in Baltimore City, Baltimore County, Montgomery County, and Prince George's County.

### Gamification System
Tracks navigator performance and awards achievements based on operational KPIs, featuring leaderboards.

### QC Analytics & Work Verification System
**Enterprise Quality Control Dashboards** for Maryland SNAP operations with predictive analytics and proactive error prevention.

**Caseworker Cockpit** (/caseworker/cockpit):
- Personal flagged cases panel with AI-powered risk scores
- Error trend analytics tracking performance over 4 quarters
- AI-recommended training interventions based on error patterns
- Quick job aids library (7 comprehensive guides)
- Context-aware tips dialog for proactive quality improvement

**Supervisor Cockpit** (/supervisor/cockpit):
- Team error trend alerts with spike detection (e.g., 500% increases)
- Diagnostic drill-downs by error category with subtype analysis
- Proactive case flagging system for high-risk applications
- Training impact analytics showing before/after error rate improvements
- Real-time team performance metrics and Payment Error Rate (PER) tracking

**Quality Control Standards**:
System implements the 6 Maryland SNAP error categories:
1. shelter_utility - Shelter & Utility Errors
2. income_verification - Income Verification Errors
3. asset_verification - Asset Verification Errors
4. categorical_eligibility - Categorical Eligibility Errors
5. earned_income - Earned Income Errors
6. unearned_income - Unearned Income Errors

**Synthetic Data System**:
- 4 dedicated tables: qc_error_patterns, flagged_cases, job_aids, training_interventions
- Generates realistic Maryland SNAP error patterns with proper tenant isolation
- All data uses synthetic format (Case #XXXXX) with no real PII
- Seeded automatically during system initialization

**Key Features**:
- Predictive analytics for proactive quality assurance
- Multi-quarter trend analysis and visualization
- Error pattern recognition across all 6 quality control categories
- Training effectiveness tracking with measurable outcomes
- Job aids covering all regulatory compliance areas

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Basic user authentication with roles, object-level security, and robust CSRF protection.
-   **Production Security Hardening**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, enhanced session security, ownership verification middleware, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Production Readiness & Hardening**: Production environment validation, health check endpoints, role-based rate limiting, DoS protection, database connection pooling, security audit completion, comprehensive deployment documentation, and graceful shutdown.
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **E-Filing Roadmap**: Phased approach for federal/Maryland e-filing.
-   **Security & Performance**: CSRF protection, rate limiting, security headers, server-side caching, database indexing.
-   **Testing**: Vitest, @testing-library/react, and supertest.

## Performance Optimization Philosophy
Focuses on achieving significant cost reduction through smart scheduling and intelligent caching of deterministic, expensive operations with source-specific TTLs. This includes caches for Gemini Embeddings, RAG Queries, Document Analysis, and PolicyEngine Calculations, along with database query optimization.

# External Dependencies

-   **AI Services**: Google Gemini API (`@google/genai`).
-   **Benefit Calculations**: PolicyEngine (`policyengine-us`) Python package.
-   **Database**: PostgreSQL via Drizzle ORM (`drizzle-orm`) with Neon Database.
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine, Google Gemini Vision API, pdf-parse.
-   **UI Components**: Radix UI primitives via shadcn/ui.
-   **Data Visualization**: Recharts.
-   **PDF Generation**: jsPDF and jspdf-autotable.
-   **IRS Integration (Planned)**: IRS Bulk Data API, MeF FIRE API.
-   **Maryland E-Filing (Planned)**: MDTAX iFile system API.