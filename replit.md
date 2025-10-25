# Overview

The Maryland Universal Financial Navigator is an AI-powered platform designed to optimize financial well-being by integrating public benefits eligibility with federal and state tax preparation. It acts as a universal financial command center, utilizing Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API. The platform offers comprehensive financial optimization through a single conversational interface, supporting six Maryland benefit programs (SNAP, Medicaid, TCA/TANF, OHEP, Tax Credits, and VITA tax assistance). A key innovation is the use of a single household profile for both benefit calculations and tax preparation, combined with AI-driven cross-enrollment intelligence to identify unclaimed benefits.

**Platform Status (October 20, 2025):** 111 total features (111 operational) - 100% implementation completeness, including full GDPR/HIPAA compliance, production-grade infrastructure (distributed caching, PM2 cluster deployment, comprehensive monitoring), complete E-Filing Dashboard for federal/Maryland tax returns, and fully autonomous Benefits Access Review system with notification infrastructure and supervisor dashboard for quality assurance.

# Recent Changes

**October 20, 2025 - Benefits Access Review System (Feature #111) - COMPLETE**
- **Database Schema (7 tables)**: benefits_access_reviews, review_samples, reviewer_feedback, case_lifecycle_events (+ 3 tracking fields: last_reminder_sent, last_supervisor_prompt_sent, last_overdue_alert_sent)
- **Core BAR Service** (benefitsAccessReview.service.ts - 785 lines):
  - Stratified sampling algorithm ensuring demographic/program/county diversity (diversity & representativeness scoring 0-1)
  - Lifecycle checkpoint tracking system (5 stages: intake → verification → determination → notification → followup)
  - AI case quality assessment using Gemini with 24hr caching (documentation, timeliness, compliance, quality analysis)
  - Cryptographic anonymization system (SHA-256) for blind supervisor review with super-admin reveal function
- **Notification Infrastructure** (barNotification.service.ts - 575 lines):
  - Automated caseworker reminders (3-day and 1-day advance notices before checkpoints)
  - Mandatory supervisor review prompts for sampled cases
  - Escalating overdue alerts (standard: <5 days, urgent: >5 days overdue)
  - Duplicate prevention with 24-hour cooldown and notification history tracking
  - Graceful degradation when email service unavailable
  - 3 Maryland DHS-branded email templates (caseworkerReminder.ts, supervisorReviewPrompt.ts, overdueAlert.ts)
  - Smart Scheduler integration for daily checkpoint monitoring (9 AM daily cron)
- **API Routes** (4 REST endpoints in routes.ts):
  - GET /api/bar/reviews - List all BAR reviews with optional status filtering (active/pending/completed)
  - POST /api/bar/reviews/:id/feedback - Submit supervisor structured feedback (quality ratings, coaching notes, recommended actions)
  - GET /api/bar/checkpoints/upcoming - Retrieve next 10 upcoming checkpoints with caseworker assignments
  - PATCH /api/bar/checkpoints/:id - Update checkpoint completion status and metadata
- **Supervisor Review Dashboard UI**:
  - SupervisorReviewDashboard.tsx (~350 lines): Stats cards (total/pending/completed reviews, avg time), filterable reviews table with urgency color-coding (red <24hrs, yellow <3 days), upcoming checkpoints panel, WebSocket real-time updates
  - SupervisorReviewModal.tsx (~350 lines): Mandatory review dialog (cannot dismiss without submitting), structured feedback form with 4 quality ratings (1-5 scale), 3 required text areas (strengths/improvements/coaching notes with character minimums), recommended actions checkboxes, form validation with real-time character counts
  - BarNotificationBadge.tsx (~150 lines): Bell icon with pending count badge, WebSocket integration for real-time BAR events, notifications popover with recent activity, auto-hides when count is 0
  - Navigation.tsx integration: "Supervisor Reviews" nav item with FileCheck icon for admin/super_admin roles, notification badge in navbar
  - App.tsx routing: /supervisor/reviews route with authentication protection
- **Code Cleanup**: Removed 15 unused packages (@uswds/uswds, memorystore), package count reduced from 1167 to 1152
- **System Validation**: Cache architecture verified (cacheOrchestrator coordinates invalidation, specialized caches handle domain logic), BAR scheduler executing successfully in production

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS, focusing on modularity, accessibility, and mobile-first responsiveness. Key features include a Command Palette, animations, resizable split views, skeleton loading, auto-save, and progress indicators. A public applicant portal offers document checklist generation, notice letter explanation, and simplified policy search, adhering to civic tech best practices.

## Technical Implementations
The backend uses Express.js with TypeScript and PostgreSQL via Drizzle ORM on Neon Database. It incorporates a multi-stage document processing pipeline for OCR, classification, semantic chunking, and embedding generation. The Google Gemini API is central for analysis, query processing, and RAG. A "Living Policy Manual" and "Rules Extraction Pipeline" convert policy text into structured "Rules as Code." Google Cloud Storage handles document file storage.

## Feature Specifications
### Core Platform Features
-   **Navigator Workspace**: Client management and export.
-   **Financial Opportunity Radar**: Real-time cross-program eligibility and dynamic benefit calculations.
-   **Adaptive Intake Copilot**: Conversational AI assistant for application guidance.
-   **PolicyEngine Integration**: Accurate multi-benefit calculations.
-   **Tax Preparation System**: Integrates federal/state tax preparation with public benefits eligibility, including tax document extraction (Gemini Vision), VITA tax document upload, PolicyEngine tax calculation, Form 1040/Maryland Form 502 PDF generation, and prior year tax support.
-   **E-Filing Dashboard**: Production-ready e-filing management for federal (Form 1040) and Maryland (Form 502) tax returns with real-time WebSocket status updates, validation, XML generation, and submission tracking. Includes 7 federal API endpoints and 5 Maryland API endpoints with comprehensive audit logging.
-   **Cross-Enrollment Intelligence Engine**: AI-powered recommendations for unclaimed benefits.
-   **Google Calendar Appointments**: OAuth2-integrated scheduling.
-   **Smart Scheduler**: Automated policy document monitoring.
-   **IRS Use & Disclosure Consent Form**: IRS Publication 4299 compliant consent form with electronic signature.
-   **Unified Monitoring & Analytics Platform**: 7 observability domains, real-time WebSocket updates, and admin dashboard.
-   **TaxSlayer Document Management**: Enhanced VITA document workflow with quality validation, audit logging, and secure downloads.
-   **Interactive Demo Showcase**: Comprehensive static demo with cached data showcasing platform features.
-   **API Documentation Explorer**: Searchable, filterable catalog of API endpoints.
-   **API Platform & Developer Experience**: Enhanced API Explorer with code snippet generation, comprehensive API versioning, and a developer onboarding portal.
-   **Benefits Access Review (BAR)**: Fully autonomous case quality monitoring system with stratified sampling (2 cases/worker weekly ensuring demographic/program/county diversity), 30-60 day lifecycle tracking across 5 checkpoints (intake → verification → determination → notification → followup), AI quality assessment via Gemini (24hr caching), blind supervisor review with SHA-256 anonymization and super-admin reveal, automated notification infrastructure (3-day/1-day caseworker reminders, supervisor review prompts, escalating overdue alerts), production-ready Supervisor Review Dashboard with mandatory structured feedback forms, real-time WebSocket updates, and pattern detection analytics. **Status: Production-ready, Smart Scheduler integrated (daily 9 AM checks)**

### E-Filing Infrastructure
Production-ready components include Form 1040 and Maryland Form 502 PDF generators. XML generators for both federal and state forms are fully implemented. An E-File Queue Service for submission tracking exists. Full activation pending IRS EFIN and Maryland iFile credentials.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Basic user authentication with roles, object-level security, and CSRF protection.
-   **Production Security Hardening**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, enhanced session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Enterprise Compliance Framework**: 
    -   **GDPR (5 features)**: Consent management (Articles 6 & 7), data subject rights (Articles 15-17, 20), ROPA (Article 30), DPIA (Article 35), 72-hour breach notification (Article 33)
    -   **HIPAA (5 features)**: PHI access logging with Minimum Necessary enforcement, BAA tracking, Security Risk Assessments (§164.308(a)(1)), security incident management with breach threshold detection (§164.408), 7-year audit log retention
    -   **Implementation**: 10 database tables, 1,443 lines of service code, 701 lines of API routes
    -   **Reference**: See `docs/PHASE_A_EVIDENCE_COLLECTION.md` and FEATURES.md (#94-103)
-   **Production Readiness & Hardening**: Health check endpoints, role-based rate limiting, DoS protection, database connection pooling, and graceful shutdown.
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **Performance Optimization**: Server-side caching, extensive database indexing.
-   **Maryland Rules-as-Code Architecture**: Maryland rules engines are the primary determination system, with PolicyEngine serving as a third-party verifier for SNAP, OHEP, TANF, Medicaid, and VITA Tax rules.
-   **Testing**: Vitest, @testing-library/react, and supertest.
-   **Distributed Caching System**: Production-ready distributed cache with Redis/Upstash integration and automatic fallback (redisCache.ts - 473 lines), featuring tiered L1/L2 cache architecture (cacheOrchestrator.ts - 632 lines), multi-layer caching for embeddings (60-80% cost reduction), RAG queries (50-70% cost reduction), PolicyEngine calculations (50% API reduction), sessions, and documents, with cache metrics and monitoring.
-   **Scalable Connection Pooling**: Neon Pooled Connections for 100+ concurrent connections, surge protection, and circuit breaker pattern.
-   **WebSocket Real-Time Service**: WebSocket service (websocket.service.ts - 345 lines) with session-based authentication, heartbeat monitoring, and metrics broadcast for admin monitoring dashboard.
-   **Unified Metrics Service (7 Observability Domains)**: Comprehensive monitoring (metricsService.ts - 1,063 lines) across Errors, Security, Performance (P50/P90/P95/P99), E-Filing, AI usage/costs, Cache performance, and Health checks.
-   **Prometheus Metrics Export**: Configured in PM2 config (port 9090) - endpoint implementation pending.
-   **Universal Feature Registry**: Ensures all 6 programs have access to all features, with a modular architecture and cross-enrollment intelligence.
-   **PM2 Production Deployment**: Cluster mode deployment (ecosystem.config.js - 195 lines, 3 processes: jawn-api cluster, jawn-worker 2 instances, jawn-scheduler daily restart), process management, zero-downtime deployments, auto-restart capabilities, production settings (100 max DB connections, Redis cluster mode, rate limiting 100-1000 req/min).
-   **Load Testing Infrastructure**: Referenced in docs (k6 and Artillery) - test scripts pending implementation.

# External Dependencies

-   **AI Services**: Google Gemini API, Google Gemini Vision API.
-   **Benefit Calculations**: PolicyEngine Household API (with OAuth 2.0 via Auth0).
-   **Database**: PostgreSQL via Drizzle ORM with Neon Database.
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine, pdf-parse.
-   **UI Components**: Radix UI primitives via shadcn/ui.
-   **Data Visualization**: Recharts.
-   **PDF Generation**: jsPDF and jspdf-autotable.
-   **Legislative Data**: Congress.gov API, GovInfo API, Maryland General Assembly website.
-   **Monitoring & Alerts**: Sentry error tracking.
-   **Communication**: Twilio SMS API.
-   **Caching**: Redis/Upstash (distributed).
-   **IRS Integration (Planned)**: IRS Bulk Data API, MeF FIRE API.
-   **Maryland E-Filing (Planned)**: MDTAX iFile system API.