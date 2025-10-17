# Overview

The Maryland Universal Financial Navigator is an AI-powered platform designed to optimize financial well-being by integrating public benefits eligibility with federal and state tax preparation. It acts as a universal financial command center, utilizing Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API. The platform offers comprehensive financial optimization through a single conversational interface, supporting six Maryland benefit programs (SNAP, Medicaid, TCA/TANF, OHEP, Tax Credits) and IRS VITA tax assistance. A key innovation is the use of a single household profile for both benefit calculations and tax preparation, combined with AI-driven cross-enrollment intelligence to identify unclaimed benefits. Future plans include full federal and state e-filing capabilities.

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
-   **Tax Preparation System**: Integrates federal/state tax preparation with public benefits eligibility, including tax document extraction (Gemini Vision), VITA tax document upload, PolicyEngine tax calculation, and Form 1040/Maryland Form 502 PDF generation.
-   **Cross-Enrollment Intelligence Engine**: AI-powered recommendations for unclaimed benefits.

### Multilingual Support (Paused for Production)
The infrastructure for multilingual support is built with database schema and seed data supporting 6 languages for Maryland DHS forms. Implementation is paused to validate the English version first.

### E-Filing Infrastructure
Production-ready components include Form 1040 and Maryland Form 502 PDF generators. XML generators for both federal and state forms are prototyped. An E-File Queue Service for submission tracking and an Admin Dashboard for monitoring are in place, pending IRS EFIN and Maryland iFile credentials for full production.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Basic user authentication with roles, object-level security, and CSRF protection.
-   **Production Security Hardening**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, enhanced session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Production Readiness & Hardening**: Health check endpoints, role-based rate limiting, DoS protection, database connection pooling, and graceful shutdown.
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