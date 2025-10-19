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
-   **Feedback Collection System**: Gathers user feedback on AI responses.
-   **Adaptive Intake Copilot**: Conversational AI assistant for application guidance.
-   **PolicyEngine Integration**: Accurate multi-benefit calculations.
-   **Anonymous Benefit Screener**: Public eligibility check tool.
-   **Tax Preparation System**: Integrates federal/state tax preparation with public benefits eligibility, including tax document extraction (Gemini Vision), VITA tax document upload with quality validation and audit logging, PolicyEngine tax calculation, Form 1040/Maryland Form 502 PDF generation, and prior year tax support (2020-2024 with historical brackets and credits).
-   **Cross-Enrollment Intelligence Engine**: AI-powered recommendations for unclaimed benefits.
-   **Google Calendar Appointments**: OAuth2-integrated scheduling with conflict checking, availability verification, recurring events, and multi-view calendar interface (month/week/day) for VITA site appointments.
-   **Smart Scheduler**: Automated policy document monitoring with admin controls for frequency, toggle on/off, verified source uploads, and DB-backed persistence.
-   **IRS Use & Disclosure Consent Form**: IRS Publication 4299 compliant consent form with electronic signature.
-   **Unified Monitoring & Analytics Platform**: 7 observability domains, real-time WebSocket updates, alert management, and admin dashboard.
-   **TaxSlayer Document Management**: Enhanced VITA document workflow with quality validation, audit logging, and secure downloads.
-   **Interactive Demo Showcase**: Comprehensive static demo with cached data showcasing all 99 features across 20 categories, including Gen AI conversation transcripts, sample households, benefit calculations, tax returns, policy citations, performance metrics, and architecture visualization. Accessible at /demo (no login required).
-   **API Documentation Explorer**: Searchable, filterable catalog of all 218 API endpoints across 17 categories with HTTP method badges, authentication requirements, request/response examples, query parameters, and sample data. Accessible at /api-explorer (no login required).

### E-Filing Infrastructure
Production-ready components include Form 1040 and Maryland Form 502 PDF generators. XML generators for both federal and state forms are prototyped. An E-File Queue Service for submission tracking and an Admin Dashboard for monitoring are in place, pending IRS EFIN and Maryland iFile credentials for full production.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Basic user authentication with roles, object-level security, and CSRF protection.
-   **Production Security Hardening**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, enhanced session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Enterprise Compliance Framework**: 
    -   **GDPR Compliance**: Complete data subject rights management (access, erasure, portability, rectification), consent tracking with granular purposes, 72-hour breach notification system, privacy impact assessments (DPIA), data processing activities register, and automated 30-day deadline tracking for data subject requests.
    -   **HIPAA Compliance**: PHI access logging with minimum necessary standard, Business Associate Agreement (BAA) tracking, Security Risk Assessments (SRA), security incident management with breach threshold detection (>500 individuals), comprehensive audit trails with 7-year retention, and HHS/media notification workflows.
-   **Production Readiness & Hardening**: Health check endpoints, role-based rate limiting, DoS protection, database connection pooling, and graceful shutdown.
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **Performance Optimization**: Server-side caching (Rules Engine, PolicyEngine API responses), extensive database indexing (145+ indexes including compliance tables).
-   **Maryland Rules-as-Code Architecture**: Maryland rules engines are the primary determination system, with PolicyEngine serving as a third-party verifier. This includes SNAP, OHEP, TANF, Medicaid, and VITA Tax rules engines, integrated via a hybrid service layer and rules engine adapter.
-   **Testing**: Vitest, @testing-library/react, and supertest.

## Production Infrastructure (New)
### Distributed Caching System
-   **Redis/Upstash Integration**: Distributed cache with automatic fallback to in-memory cache for development
-   **Multi-layer caching**: Session (30min), Documents (24hr), Calculations (1hr), Metrics (1min)
-   **Cache hit rate tracking**: Real-time monitoring across all cache layers

### Scalable Connection Pooling
-   **Neon Pooled Connections**: Production-grade connection pool supporting 100+ concurrent connections
-   **Surge Protection**: Queue management for 1000+ waiting requests with backoff retry logic
-   **Circuit Breaker Pattern**: Automatic failure detection and recovery
-   **Connection Metrics**: P95/P99 response times, pool utilization, query performance tracking

### WebSocket Scaling with Redis Pub/Sub
-   **Multi-instance Support**: Redis Pub/Sub for cross-instance message broadcasting
-   **Room Management**: Dynamic room creation/deletion with presence tracking
-   **Event Types**: 15+ event types for real-time updates (benefits, documents, notifications)
-   **Heartbeat & Monitoring**: Automatic client health checks and metrics reporting

### Prometheus Metrics Export
-   **System Metrics**: CPU, memory, uptime, load averages
-   **HTTP Metrics**: Request rates, latencies (with histograms), status codes
-   **Database Metrics**: Connection pool stats, query performance, failure rates
-   **Cache Metrics**: Hit rates, memory usage, key counts by category
-   **WebSocket Metrics**: Connected clients, rooms, message throughput
-   **Application Metrics**: Benefit calculations, document processing, AI requests
-   **Endpoint**: `/metrics` for Prometheus scraping

### Universal Feature Registry
-   **Feature Parity**: Ensures all 6 programs (SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI) have access to all features
-   **Modular Architecture**: 5 core feature categories with rollback support
-   **Cross-Enrollment Intelligence**: AI-powered detection of unclaimed benefits
-   **Feature Matrix**: Real-time tracking of feature availability per program

### PM2 Production Deployment
-   **Cluster Mode**: Automatic scaling across all CPU cores
-   **Process Management**: Main API, background workers, scheduler processes
-   **Zero-downtime Deployments**: Rolling updates with health checks
-   **Auto-restart**: Memory limits, error recovery, daily scheduler restarts
-   **Environment Configs**: Separate production, staging, development settings

### Load Testing Infrastructure
-   **k6 Load Tests**: Comprehensive user journey testing with 5000+ virtual users
-   **Artillery Tests**: API endpoint stress testing with realistic scenarios
-   **Test Data**: CSV-driven test data for realistic household scenarios
-   **Performance Baselines**: P95 < 500ms, P99 < 1000ms for critical paths

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
-   **Caching**: Redis/Upstash (distributed), In-memory fallback for development.
-   **IRS Integration (Planned)**: IRS Bulk Data API, MeF FIRE API.
-   **Maryland E-Filing (Planned)**: MDTAX iFile system API.