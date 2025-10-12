# Overview

The Maryland Universal Financial Navigator is an AI-powered platform that integrates public benefits eligibility with federal and state tax preparation, aiming to be a universal financial command center. It leverages Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API to provide comprehensive financial optimization through a single conversational interface. The system supports six Maryland benefit programs (SNAP, Medicaid, TCA/TANF, OHEP, Tax Credits) and IRS VITA tax assistance, with planned expansion to full federal/state e-filing capabilities. Its core innovation lies in using a single household profile to power both benefit calculations (via PolicyEngine) and tax preparation (Form 1040 generation), with AI-driven cross-enrollment intelligence to identify unclaimed benefits.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS, focusing on modularity, accessibility (WCAG, semantic HTML, ARIA), and mobile-first responsiveness. It includes a `PolicyChatWidget`, Command Palette, Framer Motion animations, resizable split views, and skeleton loading states. A public applicant portal supports document checklist generation, notice letter explanation, and simplified policy search in both AI-powered and manual modes.

## Technical Implementations
The backend uses Express.js with TypeScript and PostgreSQL via Drizzle ORM on Neon Database. A multi-stage document processing pipeline handles OCR, classification, semantic chunking, and embedding generation. The Google Gemini API is central for analysis, query processing, and RAG. Key features include a "Living Policy Manual" for generating human-readable policy text and a "Rules Extraction Pipeline" to derive structured "Rules as Code" from policy documents. Google Cloud Storage is used for document file storage with custom ACLs.

## Feature Specifications
### Core Platform Features
-   **Navigator Workspace**: Manages client interaction sessions and E&E export.
-   **Feedback Collection System**: User feedback on AI responses with admin management.
-   **Admin Enhancement Tools**: Audit Log Viewer, API Documentation, Feedback Management.
-   **Notification System**: In-app notifications for policy updates, feedback, and system alerts.
-   **Policy Change Diff Monitor**: Tracks policy document versions and performs impact analysis.
-   **Compliance Assurance Suite**: Gemini-powered validation of policy documents against regulatory requirements.
-   **Adaptive Intake Copilot**: Gemini-powered conversational assistant for application guidance and structured data extraction.
-   **PolicyEngine Integration**: Provides accurate multi-benefit calculations (SNAP, Medicaid, EITC, CTC, SSI, TANF).
-   **Anonymous Benefit Screener**: Public-facing tool for anonymous eligibility checks.
-   **Household Scenario Workspace**: Modeling tool for navigators using PolicyEngine.
-   **VITA Tax Assistant**: Knowledge base for federal tax assistance using IRS Publication 4012.
-   **Maryland Evaluation Framework**: Accuracy testing system for policy rules and calculations.

### Tax Preparation System
This system integrates federal/state tax preparation with public benefits eligibility.
-   **Tax Document Extraction Service**: Gemini Vision-powered extraction from W-2, 1099, 1095-A with confidence scoring.
-   **PolicyEngine Tax Calculation Service**: Federal tax calculations (EITC, CTC, taxable income) using PolicyEngine US, bridging tax data to benefit screening.
-   **Form 1040 PDF Generator**: IRS-compliant Form 1040 PDF generation, including virtual currency disclosure and accurate calculations.
-   **Cross-Enrollment Intelligence Engine**: AI-powered analysis identifying missed benefits from tax data (e.g., high EITC leading to SNAP screening) and vice-versa.

## System Design Choices
-   **Data Management**: PostgreSQL stores core data (users, documents, "Rules as Code", audit logs). Google Cloud Storage for file storage.
-   **Authentication & Authorization**: Basic user authentication with roles, object-level security via Google Cloud Storage ACLs, and session management using `connect-pg-simple`.
-   **Unified Household Profiler**: A single profile drives both benefits and tax workflows, enabling pre-population and cross-screening.
-   **E-Filing Roadmap**: Phased approach including federal/Maryland e-filing via IRS MeF FIRE API and MDTAX iFile API integration.
-   **Security & Performance**: CSRF protection, multi-tier rate limiting, security headers (Helmet, CSP, HSTS), server-side caching (NodeCache), and strategic database indexing.
-   **Testing**: Vitest, @testing-library/react, and supertest for unit, component, and API integration tests.

# External Dependencies

-   **AI Services**: Google Gemini API (`@google/genai`) for language models, document analysis, embeddings, and RAG. Models used: `gemini-2.5-flash`, `text-embedding-004`.
-   **Benefit Calculations**: PolicyEngine (`policyengine-us`) Python package.
-   **Database**: PostgreSQL via Drizzle ORM (`drizzle-orm`) with Neon Database.
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine, Google Gemini Vision API, pdf-parse.
-   **UI Components**: Radix UI primitives via shadcn/ui.
-   **Data Visualization**: Recharts.
-   **PDF Generation**: jsPDF and jspdf-autotable.
-   **IRS Integration (Planned)**: IRS Bulk Data API, MeF FIRE API.
-   **Maryland E-Filing (Planned)**: MDTAX iFile system API.