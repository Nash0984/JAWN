# Overview

**JAWN (Joint Access Welfare Network)** is a production-ready, multi-state AI-powered platform designed to optimize financial well-being by integrating public benefits eligibility with federal and state tax preparation. It serves as a white-label financial command center, currently deployed in Maryland with planned expansion to Pennsylvania and Virginia. The platform utilizes Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API to provide comprehensive financial optimization through a unified conversational interface. Key innovations include a single household profile for benefits and tax, AI-driven cross-enrollment for unclaimed benefits, and GDPR-compliant cryptographic shredding for data deletion.

JAWN supports six benefit programs (SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI) and VITA tax assistance, ensuring compliance with NIST 800-53, IRS Pub 1075, HIPAA, GDPR, Section 508, SOC 2, and FedRAMP standards. It features a multi-state architecture with state→office hierarchy, intelligent case routing, 3-tier encryption key management, immutable audit logging, an E-Filing Dashboard, and an autonomous Benefits Access Review system. The platform is deployment-agnostic, supporting major government cloud providers.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui, and Tailwind CSS, focusing on modularity, accessibility, and mobile-first responsiveness. It includes a Command Palette, animations, resizable split views, skeleton loading, auto-save, progress indicators, and a public applicant portal for document checklist generation, notice explanation, and policy search.

## Technical Implementations
The backend uses Express.js with TypeScript and PostgreSQL via Drizzle ORM on Neon Database. It incorporates a multi-stage document processing pipeline for OCR, classification, semantic chunking, and embedding generation. The Google Gemini API is used for AI analysis and RAG. A "Living Policy Manual" and "Rules Extraction Pipeline" convert policy text into structured "Rules as Code." Google Cloud Storage is used for document storage. AI orchestration is centralized in `aiOrchestrator.ts` using a strategy pattern, including rate limiting, cost tracking, exponential backoff, and Gemini context caching.

## Multi-State Architecture
JAWN employs a production-grade multi-tenant architecture supporting multiple states with flexible office routing. This includes a state→office hierarchy defined by new and enhanced database tables. The system supports Centralized Hub-and-Spoke, Decentralized On-Site, and Hybrid processing models via configurable routing rules. An Intelligent Office Routing Service (`server/services/officeRouting.service.ts`) implements priority-based routing strategies like Hub, Geographic, Workload Balanced, Specialty, and Language Matching, with all decisions captured in an immutable audit log.

## 3-Tier Encryption Key Management (KMS)
A NIST SP 800-57 compliant 3-tier KMS (`server/services/kms.service.ts`) is implemented:
-   **Tier 1: Root KEK** (24-month cryptoperiod) stored in cloud KMS, encrypts State Master Keys.
-   **Tier 2: State Master Keys** (12-month cryptoperiod) per state tenant, encrypted by Root KEK, encrypts Data Encryption Keys.
-   **Tier 3: Table/Field Data Encryption Keys (DEKs)** (6-month cryptoperiod) encrypted by State Master Key, used for AES-256-GCM field-level encryption of PII/PHI.
This system supports cryptographic shredding for GDPR Art. 17 compliance by destroying field-level encryption keys, making data irrecoverable. Key rotation is automated based on NIST cryptoperiods.

## Data Retention & Deletion
Data retention policies are 7 years for tax returns (IRS Pub 1075) and benefit records (HIPAA). Audit logs are retained permanently. Automated deletion schedules `scheduledDeletionDate` using cryptographic shredding via KMS. GDPR Right to Erasure is supported with immediate shredding upon request, subject to a 30-day grace period for legitimate retention.

## Compliance Certification Readiness
The platform is designed for compliance with FedRAMP Rev. 5, NIST 800-53, IRS Pub 1075, and HIPAA, specifically addressing data retention, encryption at rest, cryptographic protection, and audit capabilities.

## Feature Specifications
Core features include a Navigator Workspace, Financial Opportunity Radar, Adaptive Intake Copilot, and PolicyEngine Integration for accurate benefit calculations. A comprehensive Tax Preparation System (integrating Gemini Vision, VITA upload, PolicyEngine tax calculation, and PDF generation) and an E-Filing Dashboard are provided. The system features a Cross-Enrollment Intelligence Engine, Google Calendar integration, Smart Scheduler, IRS Use & Disclosure Consent Form, and a Unified Monitoring & Analytics Platform.
A production-ready Immutable Audit Log System uses blockchain-style cryptographic hash chaining (SHA-256) with automated integrity verification and tamper detection. Benefits Access Review (BAR) provides autonomous case quality monitoring. AI Document Intelligence Pipeline (Gemini Vision), Conversational AI Intake Assistant, Smart RAG System, Fraud Detection Pipeline, and Smart Workflow Automation enhance operational efficiency.

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Security**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Compliance**: GDPR and HIPAA framework.
-   **Production Readiness**: Health checks, role-based rate limiting, DoS protection, connection pooling, graceful shutdown, and immutable audit logging with integrity verification.
-   **Audit Chain Architecture**: SHA-256 hash chaining, PostgreSQL triggers, advisory locks, automated verification, and a rebuild script.
-   **Unified Household Profiler**: Single profile for all workflows.
-   **Performance**: Server-side caching, extensive database indexing, non-blocking initialization.
-   **Rules-as-Code**: Maryland rules engines are primary, PolicyEngine for verification.
-   **Testing**: Vitest, @testing-library/react, supertest.
-   **Caching**: Distributed caching with Redis/Upstash.
-   **Scalability**: Neon Pooled Connections.
-   **Real-Time**: WebSocket service with session-based authentication.
-   **Monitoring**: Unified Metrics Service.
-   **Feature Management**: Universal Feature Registry for program access.
-   **Deployment**: PM2 cluster mode, Maryland LDSS single-instance deployment.

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