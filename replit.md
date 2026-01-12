# Overview

The Maryland Universal Financial Navigator (JAWN) is an AI-powered platform designed to optimize financial well-being by integrating public benefits eligibility with federal and state tax preparation. Transformed into a white-label multi-state system (Joint Access Welfare Network - JAWN), it supports Maryland, Pennsylvania, Virginia, Utah, Indiana, and Michigan. The platform acts as a universal financial command center, leveraging Retrieval-Augmented Generation (RAG), Rules as Code, and the Google Gemini API to provide comprehensive financial optimization through a single conversational interface. A key innovation is the use of a single household profile for both benefit calculations and tax preparation, combined with AI-driven cross-enrollment intelligence. It is fully operational, including GDPR/HIPAA compliance, production-grade infrastructure, an E-Filing Dashboard, and an autonomous Benefits Access Review system, deployed as a single unified application for Maryland LDSS offices with multi-tenant architecture.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
The frontend is built with React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS. It emphasizes modularity, accessibility, and mobile-first responsiveness, incorporating a Command Palette, animations, resizable views, skeleton loading, and auto-save. A public applicant portal offers document checklist generation, notice letter explanation, and simplified policy search.

## Technical Implementations
The backend uses Express.js with TypeScript and PostgreSQL via Drizzle ORM on Neon Database. It features a multi-stage document processing pipeline (OCR, classification, semantic chunking, embedding generation). The Google Gemini API is central for AI analysis, query processing, and RAG. A "Living Policy Manual" and "Rules Extraction Pipeline" convert policy text into structured "Rules as Code." Google Cloud Storage handles document storage. AI orchestration is unified with a strategy pattern, centralized rate limiting, cost tracking, exponential backoff, and Gemini context caching.

## Feature Specifications
### Core Platform Features
-   **Navigator Workspace**: Client management.
-   **Financial Opportunity Radar**: Real-time cross-program eligibility and dynamic benefit calculations.
-   **Adaptive Intake Copilot**: Conversational AI assistant for application guidance.
-   **PolicyEngine Integration**: Accurate multi-benefit calculations.
-   **Tax Preparation System**: Integrates federal/state tax preparation with public benefits eligibility, including Gemini Vision for tax document extraction, VITA document upload, PolicyEngine tax calculation, Form 1040/Maryland Form 502 PDF generation, and prior year support.
-   **E-Filing Dashboard**: Production-ready e-filing management with real-time WebSocket status updates, validation, XML generation, and submission tracking.
-   **Cross-Enrollment Intelligence Engine**: AI-powered recommendations for unclaimed benefits.
-   **Google Calendar Appointments**: OAuth2-integrated scheduling.
-   **IRS Use & Disclosure Consent Form**: IRS Publication 4299 compliant consent form with electronic signature.
-   **Unified Monitoring & Analytics Platform**: 7 observability domains and an admin dashboard.
-   **Benefits Access Review (BAR)**: Autonomous case quality monitoring with AI assessment, blind supervisor review, and automated notifications.
-   **AI Document Intelligence Pipeline**: Gemini Vision API for OCR and smart field extraction.
-   **Conversational AI Intake Assistant**: Natural language chat with multi-language and voice support.
-   **Smart RAG System**: Semantic search across policy documents using Gemini embeddings.
-   **Fraud Detection Pipeline**: Pattern analysis for unusual applications.
-   **Smart Workflow Automation**: AI-driven task prioritization and automated case routing.
-   **Payment Error Reduction (PER) Module**: Comprehensive SNAP payment error prevention system per Arnold Ventures/MD DHS Blueprint with "predict and prevent" strategy. Includes:
    - **Income Verification Service**: Quarterly W-2/wage data matching against reported income with discrepancy detection and severity scoring
    - **Pre-Submission Validator**: 7 consistency check types (income totals, household composition, documentation, resource limits, work requirements) before case approval
    - **Duplicate Claim Detector**: SSN/name/DOB matching to identify individuals claimed on multiple SNAP applications
    - **Explainable Nudge Service (XAI)**: AI-powered caseworker guidance with plain-language (Grade 6) explanations of risk factors using Gemini
    - **PERM Reporting Service**: FNS-compliant sampling (180 active/80 negative cases per quarter) and federal payment error rate reporting
    - **5 Database Tables**: `per_income_verifications`, `per_consistency_checks`, `per_duplicate_claims`, `per_caseworker_nudges`, `per_perm_samples`
    - **25+ API Endpoints**: Full REST API at `/api/per/*` for assessment, verification, validation, nudges, and PERM compliance
    - **PER Dashboard**: Real-time error prevention metrics at `/admin/per` with two distinct UX modes:
      - *State Admin View (Executive Overview tab)*: Default tab for Benefits Access Directors with statewide KPIs, LDSS office comparison table, highest-risk office alerts, 4 trend charts (error rates, nudge effectiveness, verification volume, PERM compliance), and PDF/Excel export for leadership briefings
      - *Caseworker View (Risk Queue/High Priority Nudges tabs)*: ML-based case prioritization, individual nudge management, and case-level error prevention tools
      - API: `/api/per/admin/ldss-comparison`, `/api/per/admin/trends`, `/api/per/admin/executive-summary` (admin-only endpoints)

## System Design Choices
-   **Data Management**: PostgreSQL for core data, Google Cloud Storage for files.
-   **Authentication & Authorization**: Role-based authentication, object-level security, CSRF protection.
-   **Production Security Hardening**: Field-level encryption (AES-256-GCM), secure file uploads, strong password enforcement, enhanced session security, CORS hardening, security headers, XSS sanitization, SQL injection protection, and a Security Monitoring Dashboard.
-   **Enterprise Compliance Framework**: GDPR and HIPAA compliance.
-   **Production Readiness**: Health check endpoints, role-based rate limiting, DoS protection, database connection pooling, graceful shutdown.
-   **Unified Household Profiler**: Single profile for benefits and tax workflows.
-   **Performance Optimization**: Server-side caching, extensive database indexing, non-blocking initialization.
-   **Rules-as-Code Architecture**: Maryland/tenant rules engines are the ONLY decision-makers. PolicyEngine is used for verification/validation only, NOT as a co-decision maker.
-   **Neuro-Symbolic Hybrid Gateway (CRITICAL FOUNDATION)**: Production-grade implementation based on research paper "A Neuro-Symbolic Framework for Accountability in Public-Sector AI" (97.7% accuracy matching judicial determinations). ALL eligibility decisions MUST route through this gateway.
    
    **Three-Layer Architecture** (distinct layers, not interchangeable):
    
    1. **Neural Layer (Gemini)** - *Extraction Only*
       - Used ONLY for extraction and translation of unstructured data
       - NEVER makes eligibility decisions
       - Provides confidence scores for audit trail
       - Examples: OCR text extraction, document classification, natural language parsing
    
    2. **Rules-as-Code (RaC) Layer** - *Legal Knowledge Base* ("What the law says")
       - Transforms statutes into machine-verifiable SMT-LIB artifacts
       - Sources: 7 CFR 273, COMAR, state-specific regulations
       - Maintains provenance to legal citations and ontology terms
       - Authoritative source of encoded law - versioned, validated, traceable
       - Modifications to eligibility logic MUST enter via RaC pipelines
    
    3. **Symbolic/Z3 Solver Layer** - *Proof Engine* ("How to verify")
       - Ingests case assertions + RaC-produced constraints
       - Runs satisfiability checks (SAT/UNSAT)
       - Generates UNSAT cores with statutory citations when rules are violated
       - Never invents law - only evaluates RaC logic against case data
    
    **Layer Relationship**: RaC feeds Z3. RaC is the rulebook; Z3 is the referee applying those rules to a specific case. Together they form the "symbolic side" of the hybrid gateway.
    - **Service Integrations**: All core services route through hybrid gateway:
      - `rulesEngine.calculateEligibilityWithHybridVerification()` - SNAP eligibility with Z3 verification
      - PER Income Verification - Income discrepancies verified against formal income rules
      - PER Consistency Checks - 7 check types mapped to ontology predicates
      - PER Duplicate Detection - Household composition verified via TBox lookup
      - PER Explainable Nudges - ALL nudges grounded in Z3 UNSAT core analysis, then simplified to Grade 6
      - Intake Copilot - Real-time validation against formal rules during intake
      - RAG Service - LLM answers cross-checked against TBox ontology before returning
    - **Audit Trail**: Every decision logs: neural extraction confidence, Z3 solver run ID, ontology terms matched, UNSAT core, statutory citations. Stored in `hybrid_gateway_audit_logs` table.
-   **Neuro-Symbolic Database Tables (12 tables)**:
    - **Phase 1 - TBox (Legal Ontology)**: `statutory_sources`, `ontology_terms` (with e5-large-v2 embeddings), `ontology_relationships` (knowledge graph edges)
    - **Phase 2 - Rule Extraction Pipeline**: `rule_fragments` (clause-level rule text), `formal_rules` (Z3 SMT logic), `rule_extraction_logs` (LLM audit trail). Three prompting strategies: vanilla, undirected, directed_symbolic.
    - **Phase 3 - ABox (Case Assertions)**: `case_assertions` linked to ontology terms via embedding-based semantic similarity (0.70+ threshold). Maps household data to Z3 SMT-LIB assertions.
    - **Phase 4 - Z3 Solver Integration**: `solver_runs` stores verification results with UNSAT core analysis. Rule constraint building, SAT/UNSAT detection, statutory citation tracking. API endpoints: `/api/z3-solver/verify`, `/api/z3-solver/stats`.
    - **Phase 5 - Violation Trace Generator**: `violation_traces` stores detailed violation records with legal citations, due process notices, and appeal guidance for all 6 states. `explanation_clauses` maps NOA clauses to formal predicates. API endpoints: `/api/violation-traces/*`, `/api/neuro-symbolic/verify`, `/api/neuro-symbolic/research-paper-alignment`. Goldberg v. Kelly (397 U.S. 254) compliance with notice, explanation, legal basis, contest rights, and hearing availability.
    - **Gateway Audit**: `hybrid_gateway_audit_logs` tracks every hybrid verification with full trace.
-   **Testing**: Vitest, @testing-library/react, and supertest. **Regression Gate: 216+ integration tests required** covering Research API (32), Benefit Screening (24), Tax Workflow (36), PER Module (29), Tax Calculations (26), IRS Consent (18), State Rules Engine (23+), Hybrid Gateway (24+).
-   **Distributed Caching System**: Production-ready cache with Redis/Upstash.
-   **Scalable Connection Pooling**: Neon Pooled Connections.
-   **WebSocket Real-Time Service**: Session-based authenticated WebSocket service.
-   **Unified Metrics Service**: Comprehensive monitoring across multiple domains with Prometheus Export.
-   **Universal Feature Registry**: Ensures all programs access all features, with modular architecture and cross-enrollment intelligence.
-   **PM2 Production Deployment**: Cluster mode deployment.
-   **Multi-tenant Architecture**: Single unified application for all 24 Maryland LDSS offices.

## Compliance Status (January 2026) - PRODUCTION READY

### Critical Gaps CLOSED
- **CRIT-001 (TLS Verification)**: `/api/health/tls` endpoint validates HTTPS/HSTS/CSP; `/api/health/tls/attestation` accepts load balancer TLS attestation with API key authentication; `enforceHttpsProduction` middleware blocks HTTP (426 Upgrade Required).
- **CRIT-002 (Data Retention)**: 35-table retention coverage; `executeFullRetentionWorkflow()` runs nightly via smartScheduler with backfill + legal-hold-aware disposal; multi-cloud KMS SDKs installed (@aws-sdk/client-kms, @google-cloud/kms, @azure/keyvault-keys).

### Compliance Scores (January 2026)
| Framework | Score | Status |
|-----------|-------|--------|
| NIST 800-53 | 88% | STRONG |
| IRS Pub 1075 | 85% | STRONG |
| GDPR | 90% | STRONG |
| HIPAA | 88% | STRONG |
| SOC 2 Type II | 75% | DEVELOPING |

### Pennsylvania Q1 2026 Readiness
- All critical compliance gaps closed
- Cloud KMS SDKs installed for cryptographic shredding
- Automated retention workflow with legal hold checks
- TLS attestation endpoint secured for production deployment

# External Dependencies

-   **AI Services**: Google Gemini API, Google Gemini Vision API.
-   **Benefit Calculations**: PolicyEngine Household API.
-   **Database**: PostgreSQL (Drizzle ORM, Neon Database).
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine, pdf-parse, ExcelJS.
-   **UI Components**: Radix UI primitives (shadcn/ui).
-   **Data Visualization**: Recharts.
-   **PDF Generation**: jsPDF and jspdf-autotable.
-   **Legislative Data**: Congress.gov API, GovInfo API, Maryland General Assembly website.
-   **Monitoring & Alerts**: Sentry error tracking.
-   **Communication**: Email service (Nodemailer).
-   **Caching**: Redis/Upstash.