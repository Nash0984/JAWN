# Overview

The Maryland Universal Financial Navigator is an AI-powered platform that optimizes financial well-being by integrating public benefits eligibility with federal and state tax preparation. It serves as a universal financial command center, utilizing Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API. The platform offers comprehensive financial optimization through a single conversational interface, supporting six Maryland benefit programs (SNAP, Medicaid, TCA/TANF, OHEP, Tax Credits) and IRS VITA tax assistance. A key innovation is its use of a single household profile for both benefit calculations and tax preparation, combined with AI-driven cross-enrollment intelligence to identify unclaimed benefits. Future plans include full federal and state e-filing capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS, focusing on modularity, accessibility, and mobile-first responsiveness. Features include a Command Palette, animations, resizable split views, skeleton loading, auto-save, and progress indicators. A public applicant portal offers document checklist generation, notice letter explanation, and simplified policy search, adhering to civic tech best practices.

## Technical Implementations
The backend uses Express.js with TypeScript and PostgreSQL via Drizzle ORM on Neon Database. It includes a multi-stage document processing pipeline for OCR, classification, semantic chunking, and embedding generation. The Google Gemini API is central for analysis, query processing, and RAG. A "Living Policy Manual" and "Rules Extraction Pipeline" convert policy text into structured "Rules as Code." Google Cloud Storage handles document file storage.

## Feature Specifications
### Core Platform Features
-   **Navigator Workspace**: Client management and export.
-   **Financial Opportunity Radar**: Real-time cross-program eligibility and dynamic benefit calculations.
-   **Feedback Collection System**: Gathers user feedback on AI responses.
-   **Admin Enhancement Tools**: Audit logging, security monitoring, API documentation.
-   **Notification System**: In-app alerts, WebSocket support, email backup.
-   **Policy Change Diff Monitor**: Tracks policy document versions.
-   **Compliance Assurance Suite**: Gemini-powered policy validation.
-   **Adaptive Intake Copilot**: Conversational AI assistant for application guidance.
-   **PolicyEngine Integration**: Accurate multi-benefit calculations.
-   **Anonymous Benefit Screener**: Public eligibility check tool.
-   **Household Scenario Workspace**: Modeling tool for navigators.
-   **Maryland Evaluation Framework**: Comprehensive accuracy testing system.

### Public Access Portal (No Login Required)
-   **Quick Screener**: Ultra-minimal 5-question eligibility check.
-   **Document Checklist Generator**: AI-powered personalized document requirement lists.
-   **Notice Explainer**: Plain-language DHS notice interpretation.
-   **Simplified Policy Search**: Public access to Maryland SNAP policy manual.
-   **Benefit Screener**: Multi-program anonymous pre-screening tool.

### Staff Dashboards & Workspaces
-   **Navigator Dashboard**: Personal metrics, active cases, document tasks.
-   **Client Dashboard**: Applicant self-service portal.
-   **Caseworker Dashboard**: Case management tools with quality control integration.

### Quality Assurance & Work Verification
-   **ABAWD Verification Admin**: Work requirement exemption management.
-   **Cross-Enrollment Admin**: Cross-program enrollment pipeline management.
-   **Enterprise Quality Control Dashboards**: For Maryland SNAP operations.
-   **Caseworker/Supervisor Cockpits**: Tools for managing cases, error trends, and training.

### Developer & Integration Tools
-   **Developer Portal**: API key generation, webhook configuration.
-   **API Documentation (Swagger)**: Interactive API explorer.
-   **AI Monitoring Dashboard**: Model performance tracking, cost analysis.

### Infrastructure & Mobile Features
-   **PWA Installation**: Progressive Web App with offline functionality.
-   **Mobile Bottom Navigation**: Touch-optimized bottom tab navigation.
-   **Command Palette**: Global keyboard shortcut for quick navigation.
-   **Training Module**: Staff training materials, certification tracking.
-   **Consent Management**: Digital consent form system.

### Tax Preparation System
Integrates federal/state tax preparation with public benefits eligibility.
-   **Tax Document Extraction Service**: Gemini Vision-powered extraction from various tax forms.
-   **VITA Tax Document Upload**: Integrated uploader with auto-population.
-   **PolicyEngine Tax Calculation Service**: Federal tax calculations using PolicyEngine US.
-   **Form 1040/Maryland Form 502 Generator**: IRS-compliant PDF generation.
-   **Cross-Enrollment Intelligence Engine**: AI-powered recommendations for unclaimed benefits.

### Multi-County Deployment System
Supports 24 Maryland counties with county-specific branding, data isolation, and localized experiences.

### Gamification System
Tracks navigator performance and awards achievements based on operational KPIs.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Basic user authentication with roles, object-level security, and CSRF protection.
-   **Production Security Hardening**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, enhanced session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Production Readiness & Hardening**: Health check endpoints, role-based rate limiting, DoS protection, database connection pooling, and graceful shutdown.
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **E-Filing Roadmap**: Phased approach for federal/Maryland e-filing.
-   **Security & Performance**: CSRF protection, rate limiting, server-side caching, database indexing.
-   **Testing**: Vitest, @testing-library/react, and supertest.
-   **Performance Optimization Philosophy**: Cost reduction through smart scheduling and intelligent caching.

## Maryland Rules-as-Code Architecture
Maryland Rules-as-Code engines serve as the **PRIMARY determination system**, with PolicyEngine as a **third-party verifier**. This ensures Maryland-specific policy accuracy with independent verification.

### Production Rules Engines Implemented
-   **SNAP Rules Engine**: Income tests, asset limits, deductions, categorical eligibility (7 CFR references).
-   **OHEP Rules Engine**: Income limits, benefit tiers, seasonal factors, priority groups.
-   **TANF Rules Engine**: Income test, asset test, work requirements, time limits, exemptions.
-   **Medicaid Rules Engine**: MAGI pathways (Adult, Child/Teen, Pregnant) and Non-MAGI pathways (Elderly, Disabled).
-   **VITA Tax Rules Engine**: Federal tax (2025 brackets, EITC, CTC) and Maryland state/county taxes.

### Integration Architecture
-   **Hybrid Service Layer**: Intelligent program detection and routing to appropriate Maryland rules engine, with fallback to PolicyEngine.
-   **Rules Engine Adapter**: Standardizes unit conversion (dollars to cents), transforms payloads, executes Maryland engine and PolicyEngine simultaneously for verification, and maps program codes.
-   **API Endpoints**: `/api/benefits/calculate-hybrid` (single program) and `/api/benefits/calculate-hybrid-summary` (multi-program) - both CSRF-exempt for public read-only calculations.
-   **Verification System**: `PolicyEngineVerificationBadge` component displays verification status (match/mismatch within tolerance) to build trust.

### Public Screeners with Verification
-   **Quick Screener**: Minimal 5-question SNAP eligibility check using Maryland SNAP engine, displaying PolicyEngine verification.
-   **Benefit Screener**: Comprehensive multi-benefit household assessment, showing verification for 4 Maryland programs.

### Data Flow & Unit Standardization
A consistent Dollar→Cent conversion pattern ensures all calculations are performed in cents by rules engines, preventing double-conversion bugs.

### Implementation Status
All 5 rules engines (SNAP, OHEP, TANF, Medicaid, VITA Tax) are production-ready. Hybrid integration, adapter, endpoints, verification system, updated screeners, and unit testing are complete. CSRF security for public calculation endpoints is implemented.

# External Dependencies

-   **AI Services**: Google Gemini API (`@google/genai`).
-   **Benefit Calculations**: PolicyEngine Household API with OAuth 2.0 (Auth0) for authentication.
-   **Database**: PostgreSQL via Drizzle ORM (`drizzle-orm`) with Neon Database.
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine, Google Gemini Vision API, pdf-parse.
-   **UI Components**: Radix UI primitives via shadcn/ui.
-   **Data Visualization**: Recharts.
-   **PDF Generation**: jsPDF and jspdf-autotable.
-   **Legislative Data**: Congress.gov API, GovInfo API, Maryland General Assembly website.
-   **Monitoring & Alerts**: Sentry error tracking, custom metrics dashboard.
-   **Communication**: Twilio SMS API.
-   **Caching**: Node-cache.
-   **IRS Integration (Planned)**: IRS Bulk Data API, MeF FIRE API.
-   **Maryland E-Filing (Planned)**: MDTAX iFile system API.