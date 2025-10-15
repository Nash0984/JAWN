# Overview

The Maryland Universal Financial Navigator is an AI-powered platform designed to optimize financial well-being by integrating public benefits eligibility with federal and state tax preparation. It acts as a universal financial command center, leveraging Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API. The platform offers comprehensive financial optimization through a single conversational interface, supporting six Maryland benefit programs (SNAP, Medicaid, TCA/TANF, OHEP, Tax Credits) and IRS VITA tax assistance. A core innovation is its use of a single household profile to drive both benefit calculations and tax preparation, coupled with AI-driven cross-enrollment intelligence to identify unclaimed benefits. Future plans include full federal and state e-filing.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS. It emphasizes modularity, accessibility, and mobile-first responsiveness. Key features include Command Palette (Cmd+K global navigation), animations, resizable split views, skeleton loading states, auto-save, progress indicators, and a 2-minute quick screener. The platform also offers a public applicant portal for document checklist generation, notice letter explanation, and simplified policy search, adhering to civic tech best practices.

## Technical Implementations
The backend uses Express.js with TypeScript and PostgreSQL via Drizzle ORM on Neon Database. It incorporates a multi-stage document processing pipeline for OCR, classification, semantic chunking, and embedding generation. The Google Gemini API is central for analysis, query processing, and RAG. A "Living Policy Manual" and "Rules Extraction Pipeline" convert human-readable policy text into structured "Rules as Code." Google Cloud Storage handles document file storage.

## Feature Specifications
### Core Platform Features
-   **Navigator Workspace**: Client management and E&E export.
-   **Financial Opportunity Radar**: Real-time cross-program eligibility tracking with dynamic benefit calculations, change detection, and smart alerts across all 6 Maryland programs.
-   **Feedback Collection System**: Gathers user feedback on AI responses.
-   **Admin Enhancement Tools**: Audit logging, security monitoring, API documentation, feedback management.
-   **Notification System**: In-app alerts, WebSocket support, preferences management, and email backup.
-   **Policy Change Diff Monitor**: Tracks policy document versions.
-   **Compliance Assurance Suite**: Gemini-powered policy validation.
-   **Adaptive Intake Copilot**: Conversational AI assistant for application guidance.
-   **PolicyEngine Integration**: Accurate multi-benefit calculations.
-   **Anonymous Benefit Screener**: Public eligibility check tool.
-   **Household Scenario Workspace**: Modeling tool for navigators.
-   **Maryland Evaluation Framework**: Comprehensive accuracy testing system.

### Public Access Portal (No Login Required)
-   **Quick Screener**: Ultra-minimal 5-question eligibility check.
-   **Document Checklist Generator**: AI-powered personalized document requirement lists with PDF export.
-   **Notice Explainer**: Plain-language DHS notice interpretation with action items and deadline extraction.
-   **Simplified Policy Search**: Public access to Maryland SNAP policy manual with natural language queries.
-   **Benefit Screener**: Multi-program anonymous pre-screening tool.

### Staff Dashboards & Workspaces
-   **Navigator Dashboard**: Personal metrics, active cases, document tasks.
-   **Navigator Performance**: Individual analytics with completion rates and satisfaction scores.
-   **Client Dashboard**: Applicant self-service portal with application status, document upload.
-   **Caseworker Dashboard**: Case management tools with quality control integration.

### Quality Assurance & Work Verification
-   **ABAWD Verification Admin**: Work requirement exemption management and compliance tracking.
-   **Cross-Enrollment Admin**: Cross-program enrollment pipeline management.
-   **Enterprise Quality Control Dashboards**: For Maryland SNAP operations with predictive analytics.
-   **Caseworker Cockpit**: Personal flagged cases, error trend analytics, AI-recommended training, quick job aids.
-   **Supervisor Cockpit**: Team error trend alerts, diagnostic drill-downs, proactive case flagging, training impact analytics.

### Developer & Integration Tools
-   **Developer Portal**: API key generation, webhook configuration, SDK downloads.
-   **API Documentation (Swagger)**: Interactive API explorer.
-   **AI Monitoring Dashboard**: Model performance tracking, cost analysis.

### Infrastructure & Mobile Features
-   **PWA Installation**: Progressive Web App with offline functionality.
-   **Mobile Bottom Navigation**: Touch-optimized bottom tab navigation.
-   **Command Palette**: Global keyboard shortcut for quick navigation.
-   **Training Module**: Staff training materials, certification tracking.
-   **Consent Management**: Digital consent form system with signature capture.

### Tax Preparation System
Integrates federal/state tax preparation with public benefits eligibility.
-   **Tax Document Extraction Service**: Gemini Vision-powered extraction from various tax forms.
-   **VITA Tax Document Upload**: Integrated uploader with auto-population of intake fields.
-   **PolicyEngine Tax Calculation Service**: Federal tax calculations using PolicyEngine US.
-   **Form 1040 PDF Generator**: IRS-compliant PDF generation.
-   **Maryland Form 502 Generator**: State tax PDF generation including county tax calculations and Maryland-specific credits.
-   **Cross-Enrollment Intelligence Engine**: AI-powered recommendations for unclaimed benefits.

### Multi-County Deployment System
Supports 24 Maryland counties with county-specific branding, data isolation, and localized experiences.

### Gamification System
Tracks navigator performance and awards achievements based on operational KPIs.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Basic user authentication with roles, object-level security, and robust CSRF protection.
-   **Production Security Hardening**: Field-level encryption, secure file uploads, strong password enforcement, enhanced session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Production Readiness & Hardening**: Production environment validation, health check endpoints, role-based rate limiting, DoS protection, database connection pooling, and graceful shutdown.
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **E-Filing Roadmap**: Phased approach for federal/Maryland e-filing.
-   **Security & Performance**: CSRF protection, rate limiting, security headers, server-side caching, database indexing.
-   **Testing**: Vitest, @testing-library/react, and supertest.
-   **Performance Optimization Philosophy**: Focuses on cost reduction through smart scheduling and intelligent caching of deterministic, expensive operations with source-specific TTLs.

# External Dependencies

-   **AI Services**: Google Gemini API (`@google/genai`).
-   **Benefit Calculations**: PolicyEngine (`policyengine-us`) Python package.
-   **Database**: PostgreSQL via Drizzle ORM (`drizzle-orm`) with Neon Database.
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine, Google Gemini Vision API, pdf-parse.
-   **UI Components**: Radix UI primitives via shadcn/ui.
-   **Data Visualization**: Recharts.
-   **PDF Generation**: jsPDF and jspdf-autotable.
-   **Legislative Data**: Congress.gov API, GovInfo API, Maryland General Assembly website.
-   **Monitoring & Alerts**: Sentry error tracking, custom metrics dashboard.
-   **Communication**: Twilio SMS API (backend integration).
-   **Caching**: Node-cache with multi-layer TTL strategy.
-   **IRS Integration (Planned)**: IRS Bulk Data API, MeF FIRE API.
-   **Maryland E-Filing (Planned)**: MDTAX iFile system API.