# Overview

This project is the Maryland Multi-Program Benefits Navigator System, an AI-powered platform assisting users in understanding government benefit policies across 7 major Maryland programs. It uses Retrieval-Augmented Generation (RAG) technology combined with Rules as Code, primarily powered by the Google Gemini API, to process policy documents, extract information, and provide accurate answers regarding benefits, eligibility, and program requirements. The system aims to address the "benefits navigation problem" by reducing information asymmetry and processing costs, thereby improving access to public benefits. Key capabilities include document upload, real-time semantic search, deterministic eligibility calculations via PolicyEngine, administrative tools, and AI model training interfaces. It adheres to the Maryland Digital Style Guide and is designed for integration with marylandbenefits.gov.

## Active Benefit Programs

The system currently supports 7 Maryland benefit programs with full RAG + Rules as Code capabilities:

1. **Maryland SNAP (Food Supplement Program)** - Supplemental nutrition assistance with PolicyEngine validation
2. **Maryland Medicaid** - Health coverage through Maryland Medical Assistance Program  
3. **Maryland TCA (TANF)** - Temporary Cash Assistance with PolicyEngine integration
4. **Maryland OHEP (Energy Assistance)** - Home energy programs (MEAP, EUSP)
5. **Maryland WIC** - Special nutrition for Women, Infants, and Children
6. **Maryland Children's Health Program (MCHP)** - Health insurance for children under 19
7. **IRS VITA Tax Assistance** - Federal tax help with EITC/CTC verification

All programs feature conversational AI search, automated document processing, and integration with the Navigator Workspace for client assistance.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The frontend uses React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS. Wouter handles client-side routing, and TanStack Query manages server state. It emphasizes modularity, accessibility (WCAG, semantic HTML, ARIA), and mobile-first responsive design. Features include a `PolicyChatWidget` for conversational AI, a Command Palette for navigation, Framer Motion for animations, resizable split views, and skeleton loading states. A public applicant portal offers document checklist generation, notice letter explanation, and simplified policy search, all with dual "smart" (AI-powered) and "simple" (manual) modes.

## Backend
The backend uses Express.js with TypeScript, providing RESTful API endpoints. Data is persisted using PostgreSQL via Drizzle ORM on Neon Database. A multi-stage document processing pipeline includes OCR, classification, quality assessment, semantic chunking, and embedding generation. Google Gemini API (`gemini-2.5-flash` for text, `text-embedding-004` for embeddings) is central for analysis, query processing, and RAG. A "Living Policy Manual" generates human-readable policy text from database rules, and a "Rules Extraction Pipeline" uses Gemini to extract structured "Rules as Code" from policy documents.

## Data Management
PostgreSQL stores core data (users, documents, chunks), "Rules as Code," citation tracking, navigator workspace data, audit logs, and document integrity information. Google Cloud Storage handles document file storage with custom ACLs. Vector embeddings are stored within document chunks. An automated scraping infrastructure ingests documents from official sources, ensuring integrity and version management.

## Authentication and Authorization
A basic user authentication system supports roles (user, admin, super_admin). Object-level security uses custom ACLs for Google Cloud Storage. Session management employs `connect-pg-simple` with PostgreSQL.

## Core Features
-   **Navigator Workspace**: Tracks client interaction sessions and provides an E&E (Eligibility & Enrollment) export infrastructure for future DHS integration.
-   **Feedback Collection System**: Allows users to report issues with AI responses and content, with an admin interface for management.
-   **Admin Enhancement Tools**: Includes an Audit Log Viewer, API Documentation, and Feedback Management for system operations and DHS integration readiness.
-   **Notification System**: Provides in-app notifications for policy updates, feedback, system alerts, and workflow events with user-configurable preferences and a dedicated notification center.
-   **Policy Change Diff Monitor**: Tracks policy document versions with automated change detection, impact analysis, and role-based notifications. Staff can review diffs, assign impact assessments, and mark changes as resolved. Integrated with notification system for real-time alerts.
-   **Compliance Assurance Suite**: Gemini-powered validation system that checks policy documents and rules against regulatory requirements. Admin UI at `/admin/compliance` allows creating compliance rules (WCAG, LEP, federal regulations), validating documents with AI analysis, and managing violations with severity-based prioritization.
-   **Adaptive Intake Copilot**: Gemini-powered conversational intake assistant at `/intake` that guides applicants through SNAP application process using multi-turn dialogue. Tracks session progress, extracts structured data from conversations, visualizes extracted fields, and generates application forms when data completeness threshold is reached. Features dual-pane UI with session management sidebar and chat interface with progress indicators. Integrated with PolicyEngine for real-time benefit calculations during intake.
-   **PolicyEngine Integration**: Python-based PolicyEngine API integration for multi-benefit calculations (SNAP, Medicaid, EITC, CTC, SSI, TANF). Provides accurate federal and state-specific benefit estimates based on household composition, income, and expenses. Integrated throughout the platform for eligibility screening, intake copilot, and scenario modeling.
-   **Anonymous Benefit Screener**: Public-facing eligibility screener at `/screener` requiring no login. Allows Maryland residents to check benefit eligibility anonymously using PolicyEngine calculations. Features session management for tracking anonymous screening history and "Save Results" functionality to migrate data when user creates an account.
-   **Household Scenario Workspace**: Advanced what-if modeling tool at `/scenarios` for navigators and caseworkers. Allows creation of multiple household scenarios with varying income, expenses, and composition. Features PolicyEngine-powered benefit calculations per scenario, Recharts-based comparison visualizations showing side-by-side benefit outcomes, and PDF export for client counseling reports. Supports data-driven benefit counseling and optimization strategies.
-   **Demo Environment**: Four pre-seeded demo users (applicant, navigator, caseworker, admin) with credentials displayed on login page via collapsible "Use Demo Account" helper. Enables instant preview and testing of role-based features without manual account creation. Credentials: demo.applicant, demo.navigator, demo.caseworker, demo.admin (all use password: Demo2024!).
-   **VITA Tax Assistant**: Federal tax assistance knowledge base using IRS Publication 4012. Hybrid three-layer architecture: (1) RAG semantic search using Gemini embeddings with cosine similarity, (2) Extracted federal tax rules displayed in formatted blocks by type (eligibility, calculation, requirement, exception, procedure), (3) IRS Pub 4012 citations with relevance scores. Accessible via VITAChatWidget in Admin → VITA tab. Federal program applies to all Maryland residents.
-   **Maryland Evaluation Framework**: Accuracy testing system adapted from Propel's snap-eval structure. Database tables track test cases (evaluation_test_cases), evaluation runs (evaluation_runs with pass@1 scoring), and individual results (evaluation_results with variance tracking). Supports MD-specific test case tags (md_asset_limit, md_drug_felony, bbce, md_recertification). 2% variance tolerance for PolicyEngine validation. Designed for 25-case test structure: 8 eligibility rules, 12 benefit calculations, 5 edge cases. Benchmark insights panel documents Column Tax accuracy baseline (41% GPT-5 strict, 61% lenient) and industry research-backed design decisions.

## Security & Performance
-   **Security**: CSRF protection (double-submit cookie), multi-tier rate limiting, and security headers (Helmet, environment-aware CSP, HSTS) are implemented.
-   **Performance**: Server-side caching (NodeCache with TTL and invalidation) for frequently accessed data and strategic database indexing optimize query performance.

## Testing
Vitest, @testing-library/react, and supertest are used for unit, component, and API integration tests respectively.

# External Dependencies

-   **AI Services**: Google Gemini API (`@google/genai`) for language models, document analysis, embeddings, and RAG. Models used: `gemini-2.5-flash`, `text-embedding-004`.
-   **Benefit Calculations**: PolicyEngine (`policyengine-us`) Python package for accurate multi-benefit eligibility and amount calculations (SNAP, Medicaid, EITC, CTC, SSI, TANF).
-   **Database**: PostgreSQL via Drizzle ORM (`drizzle-orm`) with Neon Database.
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine and Google Gemini Vision API.
-   **UI Components**: Radix UI primitives via shadcn/ui.
-   **Data Visualization**: Recharts for benefit comparison charts and analytics dashboards.
-   **PDF Generation**: jsPDF and jspdf-autotable for client counseling reports and scenario exports.

# Known Issues & Resolution Plans

## PolicyEngine Python Library - System Dependency Issue

**Status**: BLOCKED - Requires environment-level fix  
**Impact**: PolicyEngine benefit calculations unavailable across all programs  
**Root Cause**: Missing `libstdc++.so.6` shared library for numpy C-extensions  

### Technical Details
- **Error**: `ImportError: libstdc++.so.6: cannot open shared object file: No such file or directory`
- **Affected Component**: `policyengine-us` Python package and its numpy dependency
- **Environment**: NixOS/Replit environment with Python 3.11
- **Attempts Made**: Installed gcc, libstdcxx5 system dependencies - issue persists

### Impacted Features
1. **Benefit Calculations**: All PolicyEngine-powered calculations (SNAP, Medicaid, TANF, EITC, CTC, SSI)
2. **Scenario Workspace**: Household modeling and what-if analysis
3. **Benefit Screener**: Anonymous eligibility screening
4. **Intake Copilot**: Real-time benefit estimates during intake
5. **Evaluation Framework**: PolicyEngine validation and accuracy testing

### Alternative Benefit Calculation Services (Research Findings)

**Evaluated Alternatives**:

1. **PolicyEngine REST API** (NOT VIABLE - Free Endpoint Non-Functional)
   - Unauthenticated API: `https://api.policyengine.org/us/calculate` (returns empty results)
   - Authenticated API: `https://household.api.policyengine.org/us/calculate` (requires Client ID/Secret)
   - **LIMITATION**: Free endpoint returns `{"result": {}, "status": "ok"}` with no benefit values
   - Paid endpoint requires Client ID & Client Secret (contact hello@policyengine.org)
   - **Status**: HTTP client implemented calling unauthenticated endpoint, gets no usable data

2. **State-Specific SNAP Calculators** (State-level accuracy)
   - Illinois: `fscalc.dhs.illinois.gov/FSCalc`
   - Oregon: `snapestimate.dhsoha.state.or.us`
   - New York: `benefitsplus.cssny.org`
   - No official APIs but logic can be reverse-engineered
   - **Use case**: Maryland-specific rules validation

3. **mRelief** (Multi-benefit screener)
   - Open-source: `github.com/mRelief`
   - Covers SNAP, Medicaid, WIC, TANF
   - Text/web-based benefit screening
   - **Use case**: Reference implementation for multi-program logic

4. **Custom USDA Tables Implementation**
   - Build calculator using official FY 2026 SNAP tables
   - Source: `fns.usda.gov/snap/recipient/eligibility`
   - State FPL thresholds for Medicaid from KFF data
   - **Use case**: Full control, Maryland customization

5. **OpenFisca Framework** (Advanced)
   - PolicyEngine's underlying rules-as-code engine
   - URL: `openfisca.org`
   - Build custom US benefit engine from scratch
   - **Use case**: Long-term custom policy modeling

**Recommended Next Steps** (Updated October 2025):
1. **Immediate**: ✅ COMPLETED - PolicyEngine REST API wrapper implemented but requires paid auth (Client ID/Secret)
2. **Short-term**: Build Maryland SNAP calculator using USDA FY 2026 tables for basic benefit estimates
3. **Medium-term**: Implement mRelief open-source logic for multi-benefit screening (SNAP, Medicaid, WIC, TANF)
4. **Long-term**: Either (a) acquire PolicyEngine API credentials, or (b) build custom OpenFisca-based engine

### Workaround Options
1. **Use RAG-only Mode**: Conversational AI and document search remain fully functional
2. **Manual Calculations**: Navigators can use external tools for benefit amounts
3. **PolicyEngine REST API**: Switch from Python package to HTTP API calls (bypasses library issue)

### Resolution Path
**Short-term**: Document limitation, enable RAG-only features  
**Medium-term**: Investigate alternative deployment strategies:
- Docker containerization with proper libraries
- Python virtual environment with pre-compiled wheels
- Alternative benefit calculation services
- Cloud function deployment for PolicyEngine

**Long-term**: Work with Replit support to resolve NixOS library dependencies for Python scientific packages