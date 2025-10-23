# Overview

The Maryland Universal Financial Navigator (JAWN) is an AI-powered platform that optimizes financial well-being by integrating public benefits eligibility with federal and state tax preparation. The platform is being transformed into a white-label multi-state system (JAWN - Joint Access Welfare Network) supporting Maryland, Pennsylvania, Virginia, Utah, Indiana, and Michigan. It acts as a universal financial command center, utilizing Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API. The platform provides comprehensive financial optimization through a single conversational interface, supporting six Maryland benefit programs and VITA tax assistance. A key innovation is the use of a single household profile for both benefit calculations and tax preparation, combined with AI-driven cross-enrollment intelligence to identify unclaimed benefits. The system is fully operational, including GDPR/HIPAA compliance, production-grade infrastructure, a complete E-Filing Dashboard, and an autonomous Benefits Access Review system, deployed as a single unified application at marylandbenefits.gov for all 24 Maryland LDSS offices with multi-tenant architecture.

# User Preferences

Preferred communication style: Simple, everyday language.

# White-Labeling Progress (Multi-State Transformation)

## Status: ✅ ALL PHASES COMPLETE (Last Updated: 2025-10-23)

Transform JAWN from Maryland-specific to production-ready white-label multi-state platform supporting 6 states: Maryland (primary), Pennsylvania (priority #2 - Philadelphia Revenue LITA expertise), Virginia, Utah, Indiana, and Michigan.

## White-Labeling Achievement: 29 Files Across 5 Phases

### Phase 1: Critical Components (7 files) ✅
1. **IncomeLimitsManager.tsx** - State SNAP income limits
2. **VITAChatWidget.tsx** - State tax assistance chat
3. **LDSSOfficeInfo.tsx** - State agency office information
4. **ConsentModal.tsx** - State-specific consent forms
5. **InstallPrompt.tsx** - PWA state branding
6. **SystemArchitecture.tsx** - State infrastructure docs
7. **CategoricalEligibilityManager.tsx** - State categorical eligibility rules

### Phase 2: High-Traffic Pages (3 files) ✅
1. **admin/MarylandStateLawTracker.tsx** - State legislature bill tracking (function name white-labeled, file preserved for backward compat)
2. **NavigatorDashboard.tsx** - All UI copy including button text, loading states, empty states, toasts
3. **Home.tsx** - Landing page branding

### Phase 3: Public Portal Pages (4 files) ✅
1. **public/BenefitScreener.tsx** - Multi-benefit screening tool
2. **public/SimplifiedSearch.tsx** - State policy search
3. **public/NoticeExplainer.tsx** - State agency notice parser
4. **public/DocumentChecklist.tsx** - State-specific document requirements

### Phase 4: Legal Compliance Pages (4 files) ✅
1. **legal/PrivacyPolicy.tsx** - State-neutral privacy policy (removed Baltimore addresses)
2. **legal/TermsOfService.tsx** - Multi-state terms
3. **legal/AccessibilityStatement.tsx** - State-agnostic accessibility commitments
4. **legal/BreachNotificationPolicy.tsx** - State-neutral data breach protocols

### Phase 5: Admin & Feature Pages (11 files) ✅
1. **AdminDashboard.tsx** - Helmet title: "{stateName} Benefits Navigator"
2. **VitaIntake.tsx** - VITA intake workflow
3. **SupervisorReviewDashboard.tsx** - BAR supervisor review
4. **AppointmentsCalendar.tsx** - Google Calendar appointments
5. **CaseworkerCockpit.tsx** - Navigator workspace
6. **admin/Monitoring.tsx** - System observability dashboard
7. **TaxPreparation.tsx** - State tax forms (county labels, form buttons, refund toasts)
8. **CrossEnrollmentAdmin.tsx** - Program enrollment recommendations
9. **DocumentReviewQueue.tsx** - Document processing queue
10. **admin/StateLawTracker.tsx** - State-specific law tracker wrapper/router
11. **Analytics.tsx & HouseholdProfiler.tsx** - Verified zero Maryland UI refs

### Key Architectural Pattern
All components use async tenant synchronization:
```typescript
const { stateConfig } = useTenant();
const stateName = stateConfig?.stateName || 'State';
const stateCode = stateConfig?.stateCode || 'MD';
useEffect(() => {
  if (stateCode && selectedState !== stateCode) {
    setSelectedState(stateCode);
  }
}, [stateCode]);
```

### Enterprise Backward Compatibility
**API field names preserved** (e.g., `marylandTax`, `MarylandStatus`, `/api/legislative/maryland-bills`) with clarifying comments. **Only UI text white-labeled** per government software backward compatibility requirements. State-specific data values (e.g., Baltimore City/County in dropdowns) appropriately retained as actual geography data.

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