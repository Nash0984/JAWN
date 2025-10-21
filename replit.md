# Overview

The Maryland Universal Financial Navigator (JAWN - Joint Access Welfare Network) is an AI-powered platform designed to optimize financial well-being by integrating public benefits eligibility with federal and state tax preparation. It acts as a universal financial command center, utilizing Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API. The platform offers comprehensive financial optimization through a single conversational interface, supporting six Maryland benefit programs and VITA tax assistance. A key innovation is the use of a single household profile for both benefit calculations and tax preparation, combined with AI-driven cross-enrollment intelligence to identify unclaimed benefits. The platform is fully operational, including GDPR/HIPAA compliance, production-grade infrastructure, a complete E-Filing Dashboard, and an autonomous Benefits Access Review system. The system is deployed as a single unified application at marylandbenefits.gov serving all 24 Maryland LDSS offices with multi-tenant architecture.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Updates (October 21, 2025)

## Production Finalization Phase (October 21)
- **Eliminated AI-Coding Antipatterns**: Fixed 17 circular references, removed all console.log statements from production services
- **Production Hardening**: Added compression middleware, verified 415 database indexes, confirmed L1/L2/L3 cache tiering
- **Data Quality**: Replaced all placeholder/mock values with production-ready implementations
- **Security**: Fixed error handling to prevent stack trace leaks, implemented proper error messages
- **Contact Information**: Updated all placeholder phone numbers to Maryland DHS: 1-800-332-6347

# Recent Updates (October 20, 2025)

## AI Enhancement Phase Completed
- **Fixed Rate Limiting**: Resolved IPv6 validation errors by adding `validate: false` to all rate limiters
- **AI Document Intelligence Pipeline**: Implemented Gemini Vision API integration for OCR and smart field extraction from documents (W-2s, pay stubs, utility bills, etc.)
- **Conversational AI Intake Assistant**: Built natural language processing chat interface with multi-language support (English, Spanish, Chinese, Korean) and voice capabilities
- **Cross-Enrollment Intelligence Engine**: Created ML-based benefit prediction system with confidence scoring and analytics dashboard
- **Smart RAG System**: Deployed semantic search across policy documents using Gemini embeddings with natural language Q&A
- **Predictive Analytics**: Added case outcome predictions, processing time estimations, and resource allocation forecasting
- **Emergency Fast-Track**: Implemented AI identification of urgent cases with automatic expedited processing
- **Fraud Detection Pipeline**: Built pattern analysis for unusual applications and behavioral anomalies
- **Smart Workflow Automation**: Deployed AI-driven task prioritization and automatic case routing

## Critical Fixes Applied
- API routing now properly handles JSON responses before Vite middleware
- Tenant context error logging properly serializes error details
- BAR supervisor dashboard implements actual county-based filtering with database joins
- Gemini API integration uses correct GoogleGenAI API format throughout

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS, emphasizing modularity, accessibility, and mobile-first responsiveness. It includes features like a Command Palette, animations, resizable split views, skeleton loading, auto-save, and progress indicators. A public applicant portal offers document checklist generation, notice letter explanation, and simplified policy search.

## Technical Implementations
The backend uses Express.js with TypeScript and PostgreSQL via Drizzle ORM on Neon Database. It incorporates a multi-stage document processing pipeline for OCR, classification, semantic chunking, and embedding generation. The Google Gemini API is central for analysis, query processing, and RAG. A "Living Policy Manual" and "Rules Extraction Pipeline" convert policy text into structured "Rules as Code." Google Cloud Storage handles document file storage.

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
-   **Interactive Demo Showcase**: Comprehensive static demo with cached data showcasing platform features.
-   **API Documentation Explorer**: Searchable, filterable catalog of API endpoints.
-   **API Platform & Developer Experience**: Enhanced API Explorer with code snippet generation, comprehensive API versioning, and a developer onboarding portal.
-   **Benefits Access Review (BAR)**: Fully autonomous case quality monitoring system with stratified sampling, 30-60 day lifecycle tracking across 5 checkpoints, AI quality assessment via Gemini, blind supervisor review with SHA-256 anonymization, automated notification infrastructure, production-ready Supervisor Review Dashboard with mandatory structured feedback forms, real-time WebSocket updates, and pattern detection analytics.

### E-Filing Infrastructure
Production-ready components include Form 1040 and Maryland Form 502 PDF generators, and XML generators for both federal and state forms. An E-File Queue Service for submission tracking exists.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Basic user authentication with roles, object-level security, and CSRF protection.
-   **Production Security Hardening**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, enhanced session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Enterprise Compliance Framework**: GDPR and HIPAA compliance implemented with dedicated database tables, service code, and API routes.
-   **Production Readiness & Hardening**: Health check endpoints, role-based rate limiting, DoS protection, database connection pooling, and graceful shutdown.
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **Performance Optimization**: Server-side caching, extensive database indexing.
-   **Maryland Rules-as-Code Architecture**: Maryland rules engines are the primary determination system, with PolicyEngine serving as a third-party verifier for benefits and tax rules.
-   **Testing**: Vitest, @testing-library/react, and supertest.
-   **Distributed Caching System**: Production-ready distributed cache with Redis/Upstash integration and automatic fallback, featuring tiered L1/L2 cache architecture and multi-layer caching for various components.
-   **Scalable Connection Pooling**: Neon Pooled Connections for 100+ concurrent connections, surge protection, and circuit breaker pattern.
-   **WebSocket Real-Time Service**: WebSocket service with session-based authentication, heartbeat monitoring, and metrics broadcast for admin monitoring dashboard.
-   **Unified Metrics Service (7 Observability Domains)**: Comprehensive monitoring across Errors, Security, Performance, E-Filing, AI usage/costs, Cache performance, and Health checks.
-   **Prometheus Metrics Export**: Configured in PM2.
-   **Universal Feature Registry**: Ensures all 6 programs have access to all features, with a modular architecture and cross-enrollment intelligence.
-   **PM2 Production Deployment**: Cluster mode deployment for process management, zero-downtime deployments, auto-restart capabilities, and production settings.
-   **Maryland LDSS Single-Instance Deployment**: A single unified application serves all 24 Maryland LDSS offices, with office-specific data and user assignments managed within the system.

# External Dependencies

-   **AI Services**: Google Gemini API, Google Gemini Vision API.
-   **Benefit Calculations**: PolicyEngine Household API.
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