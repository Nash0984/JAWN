# Overview

**JAWN (Joint Access Welfare Network)** is a production-ready, multi-state AI-powered platform optimizing financial well-being by integrating public benefits eligibility with federal and state tax preparation. It acts as a white-label financial command center, currently deployed in Maryland with planned expansion to Pennsylvania and Virginia. JAWN utilizes RAG, Rules as Code, and the Google Gemini API to offer comprehensive financial optimization through a unified conversational interface. Key innovations include a single household profile for benefits and tax, AI-driven cross-enrollment for unclaimed benefits, and GDPR-compliant cryptographic shredding for data deletion.

The platform supports six benefit programs (SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI) and VITA tax assistance, adhering to NIST 800-53, IRS Pub 1075, HIPAA, GDPR, Section 508, SOC 2, and FedRAMP standards. It features a multi-state architecture with state→office hierarchy, intelligent case routing, 3-tier encryption key management, immutable audit logging, an E-Filing Dashboard, and an autonomous Benefits Access Review system. JAWN is deployment-agnostic and supports major government cloud providers.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui, and Tailwind CSS, emphasizing modularity, accessibility, and mobile-first responsiveness. Features include a Command Palette, animations, resizable split views, skeleton loading, auto-save, progress indicators, and a public applicant portal for document checklist generation, notice explanation, and policy search.

## Technical Implementations
The backend uses Express.js with TypeScript and PostgreSQL via Drizzle ORM on Neon Database. It incorporates a multi-stage document processing pipeline for OCR, classification, semantic chunking, and embedding generation. The Google Gemini API is used for AI analysis and RAG. A "Living Policy Manual" and "Rules Extraction Pipeline" convert policy text into structured "Rules as Code." Google Cloud Storage is used for document storage. AI orchestration is centralized in `aiOrchestrator.ts` using a strategy pattern, including rate limiting, cost tracking, exponential backoff, and Gemini context caching.

## Multi-State Architecture
JAWN employs a production-grade multi-tenant architecture supporting multiple states with flexible office routing, including a state→office hierarchy. It supports Centralized Hub-and-Spoke, Decentralized On-Site, and Hybrid processing models via configurable routing rules, managed by an Intelligent Office Routing Service (`server/services/officeRouting.service.ts`). All routing decisions are captured in an immutable audit log.

## 3-Tier Encryption Key Management (KMS)
A NIST SP 800-57 compliant 3-tier KMS (`server/services/kms.service.ts`) ensures data security:
-   **Tier 1: Root KEK** stored in cloud KMS, encrypts State Master Keys.
-   **Tier 2: State Master Keys** encrypt Data Encryption Keys.
-   **Tier 3: Table/Field Data Encryption Keys (DEKs)** used for AES-256-GCM field-level encryption of PII/PHI.
This system supports cryptographic shredding for GDPR Art. 17 compliance and automated key rotation based on NIST cryptoperiods.

## Data Retention & Deletion
Data retention policies are 7 years for tax returns and benefit records, with permanent retention for audit logs. Automated deletion schedules use cryptographic shredding via KMS. GDPR Right to Erasure is supported with immediate shredding upon request after a 30-day grace period.

## Compliance Certification Readiness
The platform is designed for compliance with FedRAMP Rev. 5, NIST 800-53, IRS Pub 1075, and HIPAA, addressing data retention, encryption at rest, cryptographic protection, and audit capabilities.

## Feature Specifications
Core features include a Navigator Workspace, Financial Opportunity Radar, Adaptive Intake Copilot, and PolicyEngine Integration for accurate benefit calculations. A comprehensive Tax Preparation System (integrating Gemini Vision, VITA upload, PolicyEngine tax calculation, and PDF generation) and an E-Filing Dashboard are provided. The system features a Cross-Enrollment Intelligence Engine, Google Calendar integration, Smart Scheduler, IRS Use & Disclosure Consent Form, and a Unified Monitoring & Analytics Platform.

**Express Lane Enrollment**: Production-ready SNAP→Medicaid auto-enrollment, creating pre-filled Medicaid applications for eligible households. Features include user consent validation, duplicate prevention, full audit trails, navigator notifications, and compliance with federal Express Lane Eligibility requirements.

**Benefits Cliff Calculator**: An interactive tool comparing current vs. proposed income scenarios to detect benefit cliffs, displaying side-by-side comparisons of various benefits and net income, with visual warnings and recommendations.

A production-ready Immutable Audit Log System uses blockchain-style cryptographic hash chaining (SHA-256) with automated integrity verification and tamper detection. Benefits Access Review (BAR) provides autonomous case quality monitoring. AI Document Intelligence Pipeline (Gemini Vision), Conversational AI Intake Assistant, Smart RAG System, Fraud Detection Pipeline, and Smart Workflow Automation enhance operational efficiency.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Security**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Compliance**: GDPR and HIPAA framework.
-   **Production Readiness**: Health checks, role-based rate limiting, DoS protection, connection pooling, graceful shutdown, and immutable audit logging with integrity verification.
-   **Audit Chain Architecture**: SHA-256 hash chaining, PostgreSQL triggers, advisory locks, automated verification, and a rebuild script.
-   **Unified Household Profiler**: Single profile for all workflows.
-   **Performance**: Server-side caching, extensive database indexing, non-blocking initialization, tenant-aware program cache, route-based code splitting, parallelized monitoring queries.
-   **Rules-as-Code**: Maryland rules engines are primary, PolicyEngine for verification.
-   **Testing**: Vitest, @testing-library/react, supertest.
-   **Caching**: Distributed caching with Redis/Upstash, including a tenant-aware program cache (1-hour TTL, stale-while-revalidate).
-   **Scalability**: Neon Pooled Connections.
-   **Real-Time**: WebSocket service with session-based authentication.
-   **Monitoring**: Unified Metrics Service with parallelized metric queries.
-   **Feature Management**: Universal Feature Registry for program access.
-   **Deployment**: PM2 cluster mode, Maryland LDSS single-instance deployment.
-   **Bloat Reduction**: Removed deprecated county-based tenant isolation and 87% of unused fonts, improving performance and maintainability.

# External Dependencies

-   **AI Services**: Google Gemini API, Google Gemini Vision API.
-   **Benefit Calculations**: PolicyEngine Household API.
-   **Database**: PostgreSQL (via Drizzle ORM) on Neon Database.
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine, pdf-parse, ExcelJS.
-   **UI Components**: Radix UI (via shadcn/ui).
-   **Data Visualization**: Recharts.
-   **PDF Generation**: jsPDF and jspdf-autotable.
-   **Legislative Data**: Congress.gov API, GovInfo API, Maryland General Assembly website.
-   **Monitoring & Alerts**: Sentry.
-   **Communication**: Twilio SMS API.
-   **Caching**: Redis/Upstash.