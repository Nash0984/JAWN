# Overview

The Maryland Universal Financial Navigator (JAWN) is an AI-powered, white-label platform designed to optimize financial well-being by integrating public benefits eligibility with federal and state tax preparation. Expanding to a multi-state system (Maryland, Pennsylvania, Virginia, Utah, Indiana, and Michigan), it serves as a universal financial command center. The platform leverages Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API to offer comprehensive financial optimization through a single conversational interface. A core innovation is using a unified household profile for both benefit calculations and tax preparation, combined with AI-driven cross-enrollment intelligence to identify unclaimed benefits. It supports six Maryland benefit programs and VITA tax assistance, with full GDPR/HIPAA compliance, production-grade infrastructure, an E-Filing Dashboard, and an autonomous Benefits Access Review system, deployed as a single unified application for all 24 Maryland LDSS offices with multi-tenant architecture.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS, emphasizing modularity, accessibility, and mobile-first responsiveness. It includes features like a Command Palette, animations, resizable split views, skeleton loading, auto-save, and progress indicators. A public applicant portal provides document checklist generation, notice letter explanation, and simplified policy search.

## Technical Implementations
The backend uses Express.js with TypeScript and PostgreSQL via Drizzle ORM on Neon Database. It features a multi-stage document processing pipeline for OCR, classification, semantic chunking, and embedding generation. The Google Gemini API is central for AI analysis, query processing, and RAG. A "Living Policy Manual" and "Rules Extraction Pipeline" convert policy text into structured "Rules as Code." Google Cloud Storage handles document file storage. AI orchestration is unified in `aiOrchestrator.ts` using a strategy pattern, with centralized rate limiting, cost tracking, exponential backoff, and Gemini context caching for cost reduction.

## Feature Specifications
### Core Platform Features
-   **Navigator Workspace**: Client management and export.
-   **Financial Opportunity Radar**: Real-time cross-program eligibility and dynamic benefit calculations.
-   **Adaptive Intake Copilot**: Conversational AI assistant for application guidance.
-   **PolicyEngine Integration**: Accurate multi-benefit calculations.
-   **Tax Preparation System**: Integrates federal/state tax preparation with public benefits eligibility, including tax document extraction (Gemini Vision), VITA tax document upload, PolicyEngine tax calculation, Form 1040/Maryland Form 502 PDF generation, and prior year tax support.
-   **E-Filing Dashboard**: Production-ready e-filing management for federal (Form 1040) and Maryland (Form 502) tax returns with real-time WebSocket status updates.
-   **Cross-Enrollment Intelligence Engine**: AI-powered recommendations for unclaimed benefits.
-   **Google Calendar Appointments**: OAuth2-integrated scheduling.
-   **Smart Scheduler**: Automated policy document monitoring.
-   **IRS Use & Disclosure Consent Form**: IRS Publication 4299 compliant consent form with electronic signature.
-   **Unified Monitoring & Analytics Platform**: 7 observability domains, real-time WebSocket updates, and admin dashboard.
-   **Benefits Access Review (BAR)**: Autonomous case quality monitoring system with stratified sampling, AI quality assessment via Gemini, and a Supervisor Review Dashboard.
-   **AI Document Intelligence Pipeline**: Gemini Vision API integration for OCR and smart field extraction.
-   **Conversational AI Intake Assistant**: Natural language processing chat interface with multi-language support and voice capabilities.
-   **Smart RAG System**: Semantic search across policy documents using Gemini embeddings.
-   **Fraud Detection Pipeline**: Pattern analysis for unusual applications and behavioral anomalies.
-   **Smart Workflow Automation**: AI-driven task prioritization and automatic case routing.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Basic user authentication with roles, object-level security, and CSRF protection.
-   **Production Security Hardening**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, enhanced session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Enterprise Compliance Framework**: GDPR and HIPAA compliance.
-   **Production Readiness & Hardening**: Health check endpoints, role-based rate limiting, DoS protection, database connection pooling, and graceful shutdown.
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **Performance Optimization**: Server-side caching, extensive database indexing, and non-blocking initialization for the Smart Scheduler.
-   **Maryland Rules-as-Code Architecture**: Maryland rules engines are the primary determination system, with PolicyEngine serving as a third-party verifier.
-   **Testing**: Vitest, @testing-library/react, and supertest.
-   **Distributed Caching System**: Production-ready distributed cache with Redis/Upstash.
-   **Scalable Connection Pooling**: Neon Pooled Connections for high concurrency.
-   **WebSocket Real-Time Service**: WebSocket service with session-based authentication.
-   **Unified Metrics Service**: Comprehensive monitoring across various domains.
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