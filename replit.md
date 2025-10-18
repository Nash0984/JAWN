# Overview

The Maryland Universal Financial Navigator is an AI-powered platform designed to optimize financial well-being by integrating public benefits eligibility with federal and state tax preparation. It acts as a universal financial command center, utilizing Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API. The platform offers comprehensive financial optimization through a single conversational interface, supporting six Maryland benefit programs (SNAP, Medicaid, TCA/TANF, OHEP, Tax Credits, and VITA tax assistance). A key innovation is the use of a single household profile for both benefit calculations and tax preparation, combined with AI-driven cross-enrollment intelligence to identify unclaimed benefits. Future plans include full federal and state e-filing capabilities, SSI benefit integration, and Voice IVR communication channels.

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
-   **General Feedback System**: Comprehensive platform-wide feedback collection with AI-powered FAQ generation (Gemini API), suggestion voting with role-weighted tallies, sentiment analysis, admin dashboards, and automatic FAQ updates from high-value suggestions.
-   **Adaptive Intake Copilot**: Conversational AI assistant for application guidance.
-   **PolicyEngine Integration**: Accurate multi-benefit calculations.
-   **Anonymous Benefit Screener**: Public eligibility check tool.
-   **Tax Preparation System**: Integrates federal/state tax preparation with public benefits eligibility, including tax document extraction (Gemini Vision), VITA tax document upload with quality validation and audit logging, PolicyEngine tax calculation, Form 1040/Maryland Form 502 PDF generation, and prior year tax support (2020-2024 with historical brackets and credits).
-   **Cross-Enrollment Intelligence Engine**: AI-powered recommendations for unclaimed benefits.
-   **Google Calendar Appointments**: OAuth2-integrated scheduling with conflict checking, availability verification, recurring events, and multi-view calendar interface for VITA site appointments.
-   **Smart Scheduler**: Automated policy document monitoring with admin controls for frequency, toggle on/off, verified source uploads, and DB-backed persistence.
-   **IRS Use & Disclosure Consent Form**: IRS Publication 4299 compliant consent form with electronic signature.
-   **Unified Monitoring & Analytics Platform**: 7 observability domains, real-time WebSocket updates, alert management, and admin dashboard.
-   **TaxSlayer Document Management**: Enhanced VITA document workflow with quality validation, audit logging, and secure downloads.
-   **Interactive Demo Showcase**: Comprehensive static demo with cached data showcasing all 105 features across 21 categories, including Gen AI conversation transcripts, sample households, benefit calculations, tax returns, policy citations, performance metrics, and architecture visualization. Accessible at /demo (no login required).
-   **API Documentation Explorer**: Searchable, filterable catalog of all 469 API endpoints across 18 categories with HTTP method badges, authentication requirements, request/response examples, query parameters, and sample data. Accessible at /api-explorer (no login required).
-   **Spanish Translation System**: Full bilingual support (English/Spanish) using i18next with 7 translation namespaces covering UI, benefits, tax, navigation, forms, errors, and demo content. Includes language switcher component, automatic detection, and localStorage persistence for Maryland's Latino population.
-   **Statistics Verification System**: Automated verification script (`verify-stats.ts`) dynamically validates platform metrics (105 features, 173 tables, 469 endpoints, 94 services) across Demo, API Explorer, and documentation to ensure accuracy. Includes pre-commit hook template.
-   **Caseworker Productivity Dashboard**: Comprehensive analytics tracking applications completed, benefits secured, success rates, response times, document quality, and cross-enrollment discoveries with exportable CSV reports and visual charts.
-   **Translation Management System**: Professional 3-role translation workflow (translators, reviewers, admins) with side-by-side comparison interface, quality scoring, approval/rejection workflow, locale-specific filtering, version history tracking, and progress analytics.
-   **Living Policy Manual**: Ebook-style browser transforming 25 golden policy sources into organized chapters with page numbering, legal citations, glossary extraction, and direct links to Rules as Code implementations. Features 3-column interface with chapter/section tree navigation, full-text search, and responsive design.
-   **Dynamic Notification Engine**: Auto-generates official notices (SNAP approval/denial, tax reminders) pulling real-time data from Rules as Code, eliminating static templates and version control issues. Features content rules mapping variables to RaC sources, full audit trail with RaC version tracking, multi-channel delivery, and policy-driven regeneration when rules change.
-   **Shared Glossary API Service**: Centralized glossary terms across all 6 programs with autocomplete search and tooltip integration. Provides consistent definitions with legal citations, usage examples, and cross-program term relationships.
-   **Modular Form Builder**: Drag-and-drop UI for assembling official notices and documents from reusable components using @dnd-kit/sortable. Enables non-technical content editors to create policy-driven templates. Features component library with headers, footers, calculations, and signatures.
-   **Rules-to-Content Pipeline**: Automated detection of Rules as Code changes with content sync job generation. Runs hourly cron job monitoring RaC tables to identify content requiring updates. Features content_rules_mapping table linking RaC fields to affected templates, configurable auto-regeneration policies, and complete audit trail.
-   **Admin Content Dashboard**: Comprehensive 4-tab admin interface for reviewing sync jobs, managing templates, viewing analytics, and configuring automation settings. Sync Jobs tab shows pending RaC change reviews with approve/reject workflow. Templates tab displays searchable card grid with usage statistics. Analytics tab shows 10+ metrics with Recharts visualizations. Settings tab controls auto-regeneration policies and notification channels.
-   **Advanced Policy Search**: Enhanced search with 3 modes (keyword, citation, semantic) and filters by program, date range, and Rules as Code availability. Citation mode searches specifically in legalCitation and sourceUrl fields. Semantic mode includes synonym expansion. Integrated into PolicyManualBrowser.tsx as slide-in Sheet panel.
-   **Version Comparison UI**: Side-by-side diff view for policy evolution tracking with version history timeline, synchronized scrolling, and color-coded change highlighting. Tracks changes to manual sections and notification templates with complete audit trail. Features line-by-line diff algorithm with word-level highlighting.

### E-Filing Infrastructure
Production-ready components include Form 1040 and Maryland Form 502 PDF generators. XML generators for both federal and state forms are prototyped. An E-File Queue Service for submission tracking and an Admin Dashboard for monitoring are in place, pending IRS EFIN and Maryland iFile credentials for full production.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Basic user authentication with roles, object-level security, and CSRF protection.
-   **Production Security Hardening**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, enhanced session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Production Readiness & Hardening**: Health check endpoints, role-based rate limiting with IPv6 normalization, DoS protection, database connection pooling, graceful shutdown, and self-healing document resilience (exponential backoff, circuit breaker, smart retry with jitter, timeout management, comprehensive error tracking).
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **Performance Optimization**: Server-side caching (Rules Engine, PolicyEngine API responses), extensive database indexing.
-   **Maryland Rules-as-Code Architecture**: Maryland rules engines are the primary determination system, with PolicyEngine serving as a third-party verifier. This includes SNAP, OHEP, TANF, Medicaid, and VITA Tax rules engines, integrated via a hybrid service layer and rules engine adapter.
-   **Testing**: Vitest, @testing-library/react, and supertest.

# External Dependencies

-   **AI Services**: Google Gemini API (`@google/genai`), Google Gemini Vision API.
-   **Benefit Calculations**: PolicyEngine Household API (with OAuth 2.0 via Auth0).
-   **Database**: PostgreSQL via Drizzle ORM (`drizzle-orm`) with Neon Database.
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine, pdf-parse.
-   **UI Components**: Radix UI primitives via shadcn/ui.
-   **Data Visualization**: Recharts.
-   **PDF Generation**: jsPDF and jspdf-autotable.
-   **Legislative Data**: Congress.gov API, GovInfo API, Maryland General Assembly website.
-   **Monitoring & Alerts**: Sentry error tracking.
-   **Communication**: Twilio SMS API.
-   **Caching**: Node-cache.
-   **IRS Integration (Planned)**: IRS Bulk Data API, MeF FIRE API.
-   **Maryland E-Filing (Planned)**: MDTAX iFile system API.