# Overview

The Maryland Universal Financial Navigator (JAWN) is an AI-powered platform that optimizes financial well-being by integrating public benefits eligibility with federal and state tax preparation. The platform is being transformed into a white-label multi-state system (JAWN - Joint Access Welfare Network) supporting Maryland, Pennsylvania, Virginia, Utah, Indiana, and Michigan. It acts as a universal financial command center, utilizing Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API. The platform provides comprehensive financial optimization through a single conversational interface, supporting six Maryland benefit programs and VITA tax assistance. A key innovation is the use of a single household profile for both benefit calculations and tax preparation, combined with AI-driven cross-enrollment intelligence to identify unclaimed benefits. The system is fully operational, including GDPR/HIPAA compliance, production-grade infrastructure, a complete E-Filing Dashboard, and an autonomous Benefits Access Review system, deployed as a single unified application at marylandbenefits.gov for all 24 Maryland LDSS offices with multi-tenant architecture.

# User Preferences

Preferred communication style: Simple, everyday language.

# White-Labeling Progress (Multi-State Transformation)

## Goal
Transform JAWN into a white-label multi-state platform supporting 6 states: Maryland (primary), Pennsylvania (priority #2), Virginia, Utah, Indiana, and Michigan.

## Component White-Labeling Status (Last Updated: 2025-10-22)

### Completed Components (9 total)
1. **VitaTaxPreviewSidebar.tsx** (6 refs) - State tax preview with dynamic stateCode
2. **BenchmarkInsightsPanel.tsx** (6 refs) - State-neutral test case descriptions
3. **PolicyChatWidget.tsx** (4 refs) - State-agnostic SNAP policy chat
4. **ExportButton.tsx** (4 refs) - Dynamic tenant branding colors for PDF exports
5. **DocumentIngestionPanel.tsx** (3 refs) - State SNAP policy manual ingestion
6. **TaxSlayerDataEntry.tsx** (2 refs) - State tax return form entry
7. **SearchInterface.tsx** (2 refs) - State SNAP information search
8. **PolicyEngineVerificationBadge.tsx** (2 refs) - State-neutral calculation verification
9. **AIIntakeChat.tsx** (2 refs) - Multi-language welcome messages with stateName

### Remaining Components (13 active + 2 legacy)
- **High Priority**: BenefitsEligibilityCard, BenefitCalculationBreakdown
- **Medium Priority**: BenefitsTable, NotificationCenter, DataTable, HouseholdMembersList, EnrollmentRecommendations, FraudAlertPanel
- **Low Priority**: DisqualificationPolicyInfo, NavigatorWorkspacePanel, MultiProgramCalculatorCard
- **Legacy (to deprecate)**: BenefitsCalculator, BenefitProgramsTable

### Key Architectural Pattern
Components use async tenant synchronization:
```typescript
const { stateConfig } = useTenant();
const stateName = stateConfig?.stateName || 'State';
useEffect(() => {
  if (stateCode && selectedState !== stateCode) {
    setSelectedState(stateCode);
  }
}, [stateCode]);
```

### Backend Field Preservation
API field names remain unchanged (e.g., `marylandTax`, `MarylandStatus`) with clarifying comments for backward compatibility. Only UI text is white-labeled.

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS, focusing on modularity, accessibility, and mobile-first responsiveness. Features include a Command Palette, animations, resizable split views, skeleton loading, auto-save, and progress indicators. A public applicant portal offers document checklist generation, notice letter explanation, and simplified policy search.

## Technical Implementations
The backend uses Express.js with TypeScript and PostgreSQL via Drizzle ORM on Neon Database. It incorporates a multi-stage document processing pipeline for OCR, classification, semantic chunking, and embedding generation. The Google Gemini API is central for analysis, query processing, and RAG. A "Living Policy Manual" and "Rules Extraction Pipeline" convert policy text into structured "Rules as Code." Google Cloud Storage handles document file storage. The AI orchestration is unified in `aiOrchestrator.ts` with a strategy pattern for routing, centralized rate limiting, cost tracking, and exponential backoff retry logic. Gemini context caching is implemented for cost reduction.

## Feature Specifications
### Core Platform Features
-   **Navigator Workspace**: Client management and export.
-   **Financial Opportunity Radar**: Real-time cross-program eligibility and dynamic benefit calculations.
-   **Adaptive Intake Copilot**: Conversational AI assistant for application guidance.
-   **PolicyEngine Integration**: Accurate multi-benefit calculations.
-   **Tax Preparation System**: Integrates federal/state tax preparation with public benefits eligibility, including tax document extraction (Gemini Vision), VITA tax document upload, PolicyEngine tax calculation, Form 1040/Maryland Form 502 PDF generation, and prior year tax support.
-   **E-Filing Dashboard**: Production-ready e-filing management for federal (Form 1040) and Maryland (Form 502) tax returns with real-time WebSocket status updates, validation, XML generation, and submission tracking.
-   **Cross-Enrollment Intelligence Engine**: AI-powered recommendations for unclaimed benefits.
-   **Google Calendar Appointments**: OAuth2-integrated scheduling.
-   **Smart Scheduler**: Automated policy document monitoring.
-   **IRS Use & Disclosure Consent Form**: IRS Publication 4299 compliant consent form with electronic signature.
-   **Unified Monitoring & Analytics Platform**: 7 observability domains, real-time WebSocket updates, and admin dashboard.
-   **TaxSlayer Document Management**: Enhanced VITA document workflow with quality validation, audit logging, and secure downloads.
-   **Benefits Access Review (BAR)**: Fully autonomous case quality monitoring system with stratified sampling, AI quality assessment via Gemini, blind supervisor review, automated notification infrastructure, and a production-ready Supervisor Review Dashboard, including orphaned checkpoint handling.
-   **AI Document Intelligence Pipeline**: Gemini Vision API integration for OCR and smart field extraction.
-   **Conversational AI Intake Assistant**: Natural language processing chat interface with multi-language support and voice capabilities.
-   **Smart RAG System**: Semantic search across policy documents using Gemini embeddings.
-   **Fraud Detection Pipeline**: Pattern analysis for unusual applications and behavioral anomalies.
-   **Smart Workflow Automation**: AI-driven task prioritization and automatic case routing.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Basic user authentication with roles, object-level security, and CSRF protection.
-   **Production Security Hardening**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, enhanced session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard. Vulnerable dependencies eliminated (xlsx replaced with ExcelJS).
-   **Enterprise Compliance Framework**: GDPR and HIPAA compliance implemented.
-   **Production Readiness & Hardening**: Health check endpoints, role-based rate limiting, DoS protection, database connection pooling, and graceful shutdown.
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **Performance Optimization**: Server-side caching, extensive database indexing, and non-blocking initialization for the Smart Scheduler.
-   **Maryland Rules-as-Code Architecture**: Maryland rules engines are the primary determination system, with PolicyEngine serving as a third-party verifier.
-   **Testing**: Vitest, @testing-library/react, and supertest.
-   **Distributed Caching System**: Production-ready distributed cache with Redis/Upstash integration.
-   **Scalable Connection Pooling**: Neon Pooled Connections for high concurrency.
-   **WebSocket Real-Time Service**: WebSocket service with session-based authentication.
-   **Unified Metrics Service**: Comprehensive monitoring across Errors, Security, Performance, E-Filing, AI usage/costs, Cache performance, and Health checks, with Prometheus Metrics Export.
-   **Universal Feature Registry**: Ensures all 6 programs have access to all features, with a modular architecture and cross-enrollment intelligence.
-   **PM2 Production Deployment**: Cluster mode deployment for process management.
-   **Maryland LDSS Single-Instance Deployment**: A single unified application serves all 24 Maryland LDSS offices with multi-tenant architecture.

# External Dependencies

-   **AI Services**: Google Gemini API, Google Gemini Vision API.
-   **Benefit Calculations**: PolicyEngine Household API.
-   **Database**: PostgreSQL via Drizzle ORM with Neon Database.
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine, pdf-parse, ExcelJS.
-   **UI Components**: Radix UI primitives via shadcn/ui.
-   **Data Visualization**: Recharts.
-   **PDF Generation**: jsPDF and jspdf-autotable.
-   **Legislative Data**: Congress.gov API, GovInfo API, Maryland General Assembly website.
-   **Monitoring & Alerts**: Sentry error tracking.
-   **Communication**: Twilio SMS API.
-   **Caching**: Redis/Upstash (distributed).