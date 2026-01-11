# Maryland Multi-Program Benefits Navigator - System Architecture

**Version:** 2.0  
**Last Updated:** October 2025  
**Architecture Style:** Layered Monolith with Service-Oriented Components

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Multi-Program Architecture](#multi-program-architecture)
6. [RAG + Rules as Code Integration](#rag--rules-as-code-integration)
7. [Service Layer](#service-layer)
8. [Frontend Architecture](#frontend-architecture)
9. [Backend Architecture](#backend-architecture)
10. [Database Architecture](#database-architecture)
11. [External Integrations](#external-integrations)
12. [Security Architecture](#security-architecture)
13. [Performance & Scalability](#performance--scalability)
14. [Deployment Architecture](#deployment-architecture)

---

## System Overview

The Maryland Multi-Program Benefits Navigator is an AI-powered platform that combines **Retrieval-Augmented Generation (RAG)** with **Rules as Code** to help Maryland residents navigate 7 major benefit programs:

### Supported Programs
1. **Maryland SNAP** (Food Supplement Program)
2. **Maryland Medicaid** (Medical Assistance)
3. **Maryland TCA** (TANF - Temporary Cash Assistance)
4. **Maryland OHEP** (Energy Assistance)
5. **Maryland WIC** (Women, Infants, Children)
6. **Maryland Children's Health Program** (MCHP)
7. **IRS VITA** (Tax Assistance)

### Core Capabilities
- **Conversational AI Search** - Natural language policy queries with semantic understanding
- **Document Verification** - Gemini Vision analysis of uploaded documents
- **Benefit Calculations** - Deterministic eligibility via PolicyEngine integration
- **Navigator Workspace** - Case management for staff with E&E export
- **Intake Copilot** - AI-powered conversational application assistant
- **Compliance Suite** - Automated validation against WCAG, LEP, federal regulations
- **Policy Change Monitoring** - Automated diff detection with impact analysis

### Design Principles
1. **Maryland Replaceability** - All components swappable with existing DHS systems
2. **Plain Language First** - Grade 6-8 reading level compliance
3. **Mobile-First** - Optimized for Maryland residents on smartphones
4. **Accessibility Mandatory** - WCAG 2.1 AA compliance throughout
5. **Security by Design** - Multi-tier protection, role-based access

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Applicant  │  │   Navigator  │  │  Caseworker  │          │
│  │   Portal     │  │   Workspace  │  │   Review     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                 │
│                            │                                     │
│                    React 18 Frontend                            │
│              (Vite, shadcn/ui, TanStack Query)                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      API GATEWAY LAYER                           │
│                   (Express.js + Middleware)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   Auth   │  │   CSRF   │  │   Rate   │  │  CORS/   │        │
│  │Middleware│  │Protection│  │ Limiting │  │ Security │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      SERVICE LAYER                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   RAG    │  │Document  │  │PolicyEng │  │Navigator │        │
│  │ Service  │  │Processor │  │ Service  │  │ Service  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Intake  │  │Compliance│  │  Email   │  │WebSocket │        │
│  │ Copilot  │  │ Service  │  │ Service  │  │ Service  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                       DATA LAYER                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   PostgreSQL     │  │  Google Cloud    │  │   Google     │  │
│  │   (Neon DB)      │  │    Storage       │  │  Gemini API  │  │
│  │                  │  │                  │  │              │  │
│  │ - Users          │  │ - Documents      │  │ - RAG        │  │
│  │ - Documents      │  │ - Images         │  │ - Vision     │  │
│  │ - Chunks (vec)   │  │ - PDFs           │  │ - Embeddings │  │
│  │ - Rules          │  │                  │  │              │  │
│  │ - Cases          │  │                  │  │              │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                  EXTERNAL INTEGRATIONS                           │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │  PolicyEngine    │  │  Future DHS      │                     │
│  │  REST API        │  │  E&E Systems     │                     │
│  │                  │  │  (via export)    │                     │
│  └──────────────────┘  └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend Components

```
client/src/
├── pages/                    # Route-level page components
│   ├── Home.tsx             # Applicant portal
│   ├── DocumentReviewQueue  # Caseworker document review
│   ├── NavigatorWorkspace   # Navigator case management
│   ├── IntakeCopilot        # AI-powered intake
│   ├── ScenarioWorkspace    # What-if modeling
│   └── Admin.tsx            # System administration
│
├── components/
│   ├── ui/                  # shadcn/ui primitives
│   ├── PolicyChatWidget     # Conversational search
│   ├── DocumentViewer       # Document view/verify
│   ├── FinancialOpportunityRadar  # Real-time eligibility widget
│   ├── NotificationCenter   # Real-time notifications
│   ├── CommandPalette       # Cmd+K navigation
│   └── MDAlert              # Maryland-styled alerts
│
├── hooks/                   # Custom React hooks
│   ├── use-toast            # Toast notifications
│   ├── use-auth             # Authentication state
│   ├── use-eligibility-radar  # Real-time benefit calculations
│   └── use-websocket        # WebSocket connection
│
└── lib/
    ├── queryClient          # TanStack Query config
    └── utils                # Utility functions
```

### Backend Services

```
server/
├── routes.ts                # API endpoint definitions
├── middleware/
│   ├── auth.ts             # Session authentication
│   ├── errorHandler.ts     # Global error handling
│   └── requestLogger.ts    # Audit logging
│
├── services/
│   ├── ragService.ts       # RAG search engine
│   ├── gemini.service.ts   # Gemini API wrapper
│   ├── documentProcessor   # Document pipeline
│   ├── policyEngine        # PolicyEngine client
│   ├── intakeCopilot       # Conversational intake
│   ├── gdpr.service        # GDPR compliance
│   ├── hipaa.service       # HIPAA compliance
│   ├── notification        # Notification system
│   ├── email.service       # Email backup
│   └── websocket.service   # Real-time updates
│
├── db.ts                    # Database connection
├── storage.ts               # Data access layer
└── seedData.ts             # Program initialization
```

---

## Complete Feature Architecture Map

### 46-Feature System Overview

This platform implements 46 distinct features across 6 major categories. Below is the complete architectural mapping:

#### **Public Access Layer** (No Authentication - 5 Features)
| Feature | Component | API Endpoint | Purpose |
|---------|-----------|--------------|---------|
| Quick Screener | `/pages/public/QuickScreener.tsx` | `POST /api/public/quick-screen` | 2-minute eligibility check |
| Benefit Screener | `/pages/public/BenefitScreener.tsx` | `POST /api/screener/check` | Anonymous multi-program screening |
| Document Checklist | `/pages/public/DocumentChecklist.tsx` | `POST /api/public/generate-checklist` | AI checklist generator |
| Notice Explainer | `/pages/public/NoticeExplainer.tsx` | `POST /api/public/explain-notice` | Plain-language notice interpretation |
| Simplified Search | `/pages/public/SimplifiedSearch.tsx` | `POST /api/search` | Public policy search |

#### **Core Eligibility & Calculation Layer** (5 Features)
| Feature | Component | Service | Integration |
|---------|-----------|---------|-------------|
| Financial Opportunity Radar | `/components/FinancialOpportunityRadar.tsx` | `hooks/useEligibilityRadar.ts` | PolicyEngine + Real-time calculations |
| Household Profiler | `/pages/HouseholdProfiler.tsx` | Direct state management | Form → Radar integration |
| PolicyEngine Integration | N/A | `services/policyEngineHttpClient.ts` | Python REST API |
| Scenario Workspace | `/pages/ScenarioWorkspace.tsx` | Database: `scenario_households` | What-if modeling |
| Eligibility Checker | `/pages/EligibilityChecker.tsx` | PolicyEngine service | Detailed determination |

#### **Application & Tax Layer** (3 Features)
| Feature | Component | Service | AI Model |
|---------|-----------|---------|----------|
| Adaptive Intake Copilot | `/pages/IntakeCopilot.tsx` | `services/intakeCopilot.service.ts` | Gemini 1.5-pro |
| VITA Tax Intake | `/pages/VitaIntake.tsx` | `services/taxDocumentExtraction.service.ts` | Gemini Vision |
| Tax Preparation | `/pages/TaxPreparation.tsx` | PolicyEngine Tax + PDF generators | Form 1040 + MD 502 |

#### **Document Management Layer** (3 Features)
| Feature | Component | Storage | Verification |
|---------|-----------|---------|--------------|
| Document Verification | `/pages/DocumentVerificationPage.tsx` | Google Cloud Storage | Gemini Vision API |
| Document Review Queue | `/pages/DocumentReviewQueue.tsx` | `navigator_documents` table | Staff workflow |
| Document Upload | `/pages/Upload.tsx` | Uppy + GCS signed URLs | Direct upload |

#### **Navigator & Staff Layer** (8 Features)
| Feature | Page | Database Tables | Purpose |
|---------|------|-----------------|---------|
| Navigator Workspace | `/pages/NavigatorWorkspace.tsx` | `navigator_cases`, `navigator_sessions` | Case management |
| Navigator Dashboard | `/pages/NavigatorDashboard.tsx` | Dashboard queries | Personal metrics |
| Navigator Performance | `/pages/NavigatorPerformance.tsx` | Analytics aggregations | Performance tracking |
| Client Dashboard | `/pages/ClientDashboard.tsx` | User-specific queries | Applicant portal |
| Caseworker Dashboard | `/pages/CaseworkerDashboard.tsx` | QC integration | Case assignment |
| Consent Management | `/pages/ConsentManagement.tsx` | `consent_forms`, `client_consents` | Digital signatures |
| Training Module | `/pages/Training.tsx` | `training_modules`, `training_progress` | Staff certification |
| Leaderboard | `/pages/Leaderboard.tsx` | `achievements` | Gamification |

#### **Quality Control Layer** (5 Features)
| Feature | Page | Database | Analytics |
|---------|------|----------|-----------|
| Caseworker Cockpit | `/pages/CaseworkerCockpit.tsx` | `qc_error_patterns`, `flagged_cases` | Personal QA dashboard |
| Supervisor Cockpit | `/pages/SupervisorCockpit.tsx` | `training_interventions` | Team oversight |
| ABAWD Verification | `/pages/AbawdVerificationAdmin.tsx` | `abawd_exemptions` | Work requirement tracking |
| Compliance Suite | `/pages/ComplianceAdmin.tsx` | `compliance_rules`, `compliance_violations` | Automated validation |
| Evaluation Framework | `/pages/EvaluationFramework.tsx` | `evaluation_test_cases` | Accuracy testing |

#### **Administration Layer** (12 Features)
| Feature | Page | Purpose | Access Level |
|---------|------|---------|--------------|
| Admin Dashboard | `/pages/Admin.tsx` | Central admin | Admin+ |
| Policy Manual | `/pages/PolicyManual.tsx` | Manual editing | Admin+ |
| Policy Sources | `/pages/PolicySources.tsx` | Source management | Admin+ |
| Policy Changes | `/pages/PolicyChanges.tsx` | Change tracking | Admin+ |
| Rules Extraction | `/pages/RulesExtraction.tsx` | AI rule extraction | Admin+ |
| Security Monitoring | `/pages/SecurityMonitoring.tsx` | Threat detection | Super Admin |
| AI Monitoring | `/pages/AIMonitoring.tsx` | Model performance | Admin+ |
| Feedback Management | `/pages/FeedbackManagement.tsx` | User feedback | Admin+ |
| Audit Logs | `/pages/AuditLogs.tsx` | Audit trail | Admin+ |
| County Management | `/pages/CountyManagement.tsx` | Multi-tenant config | Super Admin |
| County Analytics | `/pages/CountyAnalytics.tsx` | County metrics | Admin+ |
| Cross-Enrollment Admin | `/pages/CrossEnrollmentAdmin.tsx` | Pipeline management | Admin+ |

#### **Developer & Integration Layer** (2 Features)
| Feature | Page | API Endpoints | Purpose |
|---------|------|---------------|---------|
| Developer Portal | `/pages/DeveloperPortal.tsx` | `/api/developer/*` | API key management |
| API Documentation | `/pages/ApiDocs.tsx` | Swagger UI | Interactive docs |

#### **Infrastructure Layer** (6 Features)
| Feature | Component | Technology | Implementation |
|---------|-----------|------------|----------------|
| Notification System | `/pages/NotificationCenter.tsx` | WebSocket | Real-time alerts |
| Notification Settings | `/pages/NotificationSettings.tsx` | Preferences DB | Channel config |
| PWA Support | `/components/InstallPrompt.tsx` | Service Workers | Offline capability |
| Mobile Bottom Nav | `/components/MobileBottomNav.tsx` | Responsive design | Touch navigation |
| Command Palette | `/components/CommandPalette.tsx` | cmdk library | Cmd+K shortcuts |
| VITA Knowledge Base | `/pages/VitaKnowledgeBase.tsx` | RAG search | Tax resources |

### Feature Integration Patterns

**1. Financial Opportunity Radar Integration**
```
Household Profiler (form changes) 
  → useEligibilityRadar (300ms debounce)
  → POST /api/eligibility/radar
  → PolicyEngine calculations
  → Real-time UI updates in sidebar
```

**2. Cross-Enrollment Flow**
```
Tax Preparation (completed return)
  → Cross-Enrollment Intelligence Engine
  → AI analysis of income/household data
  → Recommendations in Radar widget
  → One-click enrollment initiation
```

**3. Quality Control Pipeline**
```
Caseworker submits case
  → Flagged Cases system (AI risk scoring)
  → Caseworker Cockpit (personal view)
  → Supervisor Cockpit (team view)
  → Training interventions (automated)
  → Error rate reduction tracking
```

**4. Document Processing Pipeline**
```
Upload (Uppy) → GCS Storage
  → Gemini Vision analysis
  → Document Verification Interface
  → Navigator Review Queue
  → Approval/Rejection workflow
  → Applicant notification
```

**5. Multi-County Architecture**
```
User login → County detection
  → County-specific branding applied
  → Data isolation (tenant_id filtering)
  → Localized content served
  → County-level analytics tracked
```

### Microservices Candidates (Future)

If scaling beyond monolith:
1. **RAG Service** - Policy search & embeddings (most CPU-intensive)
2. **PolicyEngine Service** - Benefit calculations (Python bridge)
3. **Document Service** - OCR & Vision processing (I/O heavy)
4. **Notification Service** - WebSocket + email delivery
5. **Analytics Service** - Reporting & data warehousing

---

## Data Flow

### 1. Conversational Search Flow

```
User Query → PolicyChatWidget → POST /api/search
                                      │
                                      ▼
                            Query Classifier Service
                                      │
                        ┌─────────────┴─────────────┐
                        │                           │
                        ▼                           ▼
                  RAG Service                Rules Engine
                        │                           │
                  Gemini API                  PostgreSQL
                  (Embeddings)              (Extracted Rules)
                        │                           │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                            Response Generator
                            (gemini-2.5-flash)
                                      │
                                      ▼
                              Reading Level Check
                                      │
                                      ▼
                            Citation Assembly
                                      │
                                      ▼
                              JSON Response
                                      │
                                      ▼
                            PolicyChatWidget
```

### 2. Document Verification Flow

```
User Upload → DocumentViewer → POST /api/verify-document
                                         │
                                         ▼
                              Google Cloud Storage
                               (Signed URL Upload)
                                         │
                                         ▼
                            Gemini Vision Analysis
                                         │
                                         ▼
                              Requirement Matching
                              (Against program rules)
                                         │
                                         ▼
                              Verification Result
                                         │
                    ┌────────────────────┴────────────────────┐
                    │                                         │
                    ▼                                         ▼
              Verification Stamp                    Database Record
              (APPROVED badge)                     (verification_status)
                    │                                         │
                    └────────────────────┬────────────────────┘
                                         │
                                         ▼
                              Navigator Notification
                                (if staff session)
```

### 3. Benefit Calculation Flow

```
Household Input → ScenarioWorkspace → POST /api/policyengine/calculate
                                               │
                                               ▼
                                    PolicyEngine REST API
                                    (or Python package)
                                               │
                    ┌──────────────────────────┴──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
                SNAP Calc                  Medicaid                    EITC
             (Federal + MD)              (State rules)              (Federal)
                    │                          │                          │
                    └──────────────────────────┴──────────────────────────┘
                                               │
                                               ▼
                                    Multi-Benefit Summary
                                               │
                                               ▼
                                    Store in PostgreSQL
                                 (scenario_calculations table)
                                               │
                                               ▼
                                    Visualization (Recharts)
```

### 3.1. Financial Opportunity Radar - Real-Time Eligibility Flow

```
Form Field Change → useWatch Hook → useEligibilityRadar
                                              │
                                              ▼
                                    300ms Debounce Timer
                                    (Cancel previous requests)
                                              │
                                              ▼
                                    AbortController Created
                                              │
                                              ▼
                                    Fetch CSRF Token
                                    GET /api/csrf-token
                                              │
                                              ▼
                              POST /api/eligibility/radar
                              (with abort signal + CSRF token)
                                              │
                                              ▼
                              ┌───────────────┴───────────────┐
                              │                               │
                              ▼                               ▼
                    Current Household Data          Previous Results Ref
                              │                               │
                              └───────────────┬───────────────┘
                                              │
                                              ▼
                              Parallel PolicyEngine Calculations
                              (SNAP, Medicaid, TANF, EITC, CTC, SSI)
                                              │
                                              ▼
                              Change Detection Algorithm
                              (Compare prev vs current)
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
              0 → Positive              Amount Δ > $5           No Change
              (New Badge)            (↑↓ Arrow + Amount)          (null)
                    │                         │                         │
                    └─────────────────────────┴─────────────────────────┘
                                              │
                                              ▼
                              Smart Alerts Generation
                              (Cross-enrollment opportunities)
                                              │
                                              ▼
                              JSON Response with:
                              - programs[] (eligibility + changes)
                              - alerts[] (recommendations)
                              - summary (totals + metrics)
                                              │
                                              ▼
                              Update React State
                              (programs, alerts, summary)
                                              │
                                              ▼
                              Framer Motion Animations
                              (Highlight changes visually)
                                              │
                                              ▼
                              Render Radar Widget
                              (Cards + Badges + Arrows + Summary)
```

**Key Features:**
- **Request Cancellation**: AbortController cancels outdated requests on rapid field changes
- **Change Detection**: Server compares `prev !== undefined` for 0→positive transitions
- **Security**: CSRF token fetched and included in x-csrf-token header
- **Performance**: 300ms debounce prevents excessive API calls
- **Real-Time**: useWatch tracks 16+ form fields, triggers on any change
- **Visual Feedback**: Green "New" badges, ↑↓ arrows with amounts/percentages

### 4. Policy Change Detection Flow

```
Scheduled Job → Automated Ingestion → Document Download
                                              │
                                              ▼
                                       Hash Comparison
                                       (integrity check)
                                              │
                                  ┌───────────┴───────────┐
                                  │                       │
                             No Change              Change Detected
                                  │                       │
                             Skip Update                  ▼
                                                  Generate Diff
                                                  (old vs new)
                                                       │
                                                       ▼
                                              Gemini Impact Analysis
                                              (severity classification)
                                                       │
                                                       ▼
                                              Create policy_change
                                                       │
                                                       ▼
                                          Notify Affected Staff/Navigators
                                          (WebSocket + Email backup)
                                                       │
                                                       ▼
                                              Admin Review Workflow
```

---

## Multi-Program Architecture

### Program Isolation Pattern

Each benefit program operates with isolated data but shared infrastructure:

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED INFRASTRUCTURE                     │
│  - RAG Service       - Document Processor                   │
│  - Gemini API        - Notification System                  │
│  - Database          - Authentication                       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
┌───────▼──────┐  ┌──────────────┐  ┌──────────────▼────────┐
│   MD_SNAP    │  │  MD_MEDICAID │  │  MD_TCA (+ 4 more)   │
├──────────────┤  ├──────────────┤  ├─────────────────────────┤
│ - Documents  │  │ - Documents  │  │ - Documents            │
│ - Chunks     │  │ - Chunks     │  │ - Chunks               │
│ - Rules      │  │ - Rules      │  │ - Rules                │
│ - Embeddings │  │ - Embeddings │  │ - Embeddings           │
└──────────────┘  └──────────────┘  └────────────────────────┘
```

### Program-Specific Features

| Feature | SNAP | Medicaid | TCA | OHEP | WIC | MCHP | VITA |
|---------|------|----------|-----|------|-----|------|------|
| RAG Search | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rules Extraction | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PolicyEngine | ✓ | ✓ | ✓ | - | - | - | - |
| Document Verification | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| Intake Copilot | ✓ | - | - | - | - | - | - |

---

## RAG + Rules as Code Integration

### Hybrid Architecture

The system uses a **two-tier intelligence system**:

```
┌─────────────────────────────────────────────────────────────┐
│                        USER QUERY                            │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
                     ┌────────────────┐
                     │     Query      │
                     │  Classifier    │
                     └────────┬───────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
    ┌─────────────────┐           ┌─────────────────┐
    │   TIER 1: RAG   │           │ TIER 2: Rules   │
    │  (Conversational│           │   as Code       │
    │   Understanding)│           │ (Deterministic) │
    └─────────────────┘           └─────────────────┘
              │                               │
              │                               │
    ┌─────────▼──────────┐        ┌──────────▼──────────┐
    │ Gemini Embeddings  │        │ PostgreSQL Rules    │
    │ Vector Search      │        │ JSON Logic Engine   │
    │ Semantic Matching  │        │ PolicyEngine API    │
    └─────────┬──────────┘        └──────────┬──────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Response Fusion  │
                    │                  │
                    │ - RAG context    │
                    │ - Calculated     │
                    │   values         │
                    │ - Citations      │
                    └─────────┬────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Plain Language  │
                    │    Response      │
                    │ (Grade 6-8 level)│
                    └──────────────────┘
```

### When to Use Each Tier

**Tier 1 - RAG (Gemini):**
- Policy explanations
- "How do I..." questions
- Document requirements
- Eligibility overview
- Process guidance

**Tier 2 - Rules as Code (PolicyEngine):**
- Exact benefit amounts
- Income limit checks
- Deduction calculations
- Eligibility determination
- What-if scenarios

**Combined (Hybrid):**
- "Am I eligible and how much?" → RAG explains + Rules calculate
- "What if I get a raise?" → Rules recalculate + RAG explains impact

---

## Service Layer

### Core Services Architecture

#### 1. RAG Service (`ragService.ts`)
```typescript
class RAGService {
  // Semantic search with vector embeddings
  async search(query: string, programCode: string): Promise<RAGResponse>
  
  // Generate embeddings for new content
  async generateEmbeddings(text: string): Promise<number[]>
  
  // Hybrid search (semantic + keyword)
  async hybridSearch(query: string, filters: Filters): Promise<Results>
}
```

**Key Dependencies:**
- Google Gemini API (text-embedding-004)
- PostgreSQL (document_chunks with vector storage)
- Cache Service (NodeCache for frequent queries)

#### 2. Document Processor (`documentProcessor.ts`)
```typescript
// Multi-stage pipeline
Stage 1: Upload → Google Cloud Storage
Stage 2: OCR → Tesseract + Gemini Vision
Stage 3: Classify → Document type detection
Stage 4: Quality → Validation checks
Stage 5: Chunk → Semantic segmentation
Stage 6: Embed → Vector generation
Stage 7: Store → PostgreSQL insertion
```

#### 3. PolicyEngine Service (`policyEngine.service.ts`)
```typescript
interface PolicyEngineService {
  // Multi-benefit calculation
  calculateBenefits(household: Household): Promise<BenefitResults>
  
  // Maryland-specific overrides
  applyMarylandRules(input: PolicyInput): Promise<PolicyInput>
  
  // Verification against known values
  verifyCalculation(expected: number, actual: number): VarianceReport
}
```

#### 4. Intake Copilot (`intakeCopilot.service.ts`)
```typescript
class IntakeCopilotService {
  // Multi-turn conversation
  async processMessage(sessionId: number, message: string): Promise<Response>
  
  // Extract structured data from conversation
  extractData(messages: Message[]): Promise<ApplicationData>
  
  // Calculate completeness percentage
  calculateCompleteness(data: ApplicationData): number
}
```

---

## Frontend Architecture

### State Management Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION STATE                         │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
┌───────▼──────────┐                    ┌──────────▼──────────┐
│  SERVER STATE    │                    │   CLIENT STATE      │
│ (TanStack Query) │                    │  (React useState)   │
├──────────────────┤                    ├─────────────────────┤
│ - User data      │                    │ - UI toggles        │
│ - Documents      │                    │ - Form inputs       │
│ - Notifications  │                    │ - Modal state       │
│ - Scenarios      │                    │ - Theme             │
│ - Cases          │                    │ - Language pref     │
└──────────────────┘                    └─────────────────────┘
        │                                           │
        │                    ┌──────────────────────┘
        │                    │
┌───────▼────────────────────▼──────┐
│      PERSISTENT STATE              │
│       (localStorage)               │
├────────────────────────────────────┤
│ - Auth session                     │
│ - Recent searches                  │
│ - Language preference              │
│ - Theme preference                 │
│ - Notification preferences         │
└────────────────────────────────────┘
```

### Routing Architecture

```typescript
// Wouter-based routing with role-based access
<Switch>
  {/* Public Routes */}
  <Route path="/" component={Home} />
  <Route path="/login" component={Login} />
  <Route path="/screener" component={BenefitScreener} />
  
  {/* Authenticated Routes */}
  <Route path="/intake" component={IntakeCopilot} />
  <Route path="/scenarios" component={ScenarioWorkspace} />
  
  {/* Staff Routes (Navigator, Caseworker) */}
  <Route path="/navigator" component={NavigatorWorkspace} />
  <Route path="/document-review" component={DocumentReviewQueue} />
  
  {/* Admin Routes */}
  <Route path="/admin" component={Admin} />
  <Route path="/admin/compliance" component={ComplianceSuite} />
</Switch>
```

### Component Communication Patterns

**1. Props Drilling (Simple)**
```typescript
Parent → Child → Grandchild
```

**2. Context API (Theme, Auth)**
```typescript
<ThemeProvider>
  <AuthProvider>
    <App />
  </AuthProvider>
</ThemeProvider>
```

**3. TanStack Query (Server State)**
```typescript
// Automatic cache invalidation
const { data } = useQuery({ queryKey: ['/api/documents'] })
const mutation = useMutation({
  mutationFn: approveDocument,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/documents'] })
  }
})
```

**4. WebSocket (Real-time)**
```typescript
useEffect(() => {
  const ws = new WebSocket('/ws/notifications')
  ws.onmessage = (event) => {
    const notification = JSON.parse(event.data)
    toast({ title: notification.title })
  }
}, [])
```

---

## Backend Architecture

### Layered Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│                  (routes.ts - API Endpoints)                 │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                      BUSINESS LOGIC LAYER                    │
│                    (services/ - Core Logic)                  │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                     DATA ACCESS LAYER                        │
│                   (storage.ts - Abstraction)                 │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                      PERSISTENCE LAYER                       │
│               (db.ts - Drizzle ORM + PostgreSQL)            │
└─────────────────────────────────────────────────────────────┘
```

### Middleware Pipeline

```typescript
Request
  │
  ▼
[Request Logger] → Audit all requests
  │
  ▼
[Session Auth] → Validate session cookie
  │
  ▼
[CSRF Protection] → Verify CSRF token (POST/PUT/DELETE)
  │
  ▼
[Rate Limiting] → Check request limits
  │
  ▼
[Role Authorization] → Verify permissions
  │
  ▼
[Request Validation] → Zod schema validation
  │
  ▼
Route Handler → Business logic execution
  │
  ▼
[Error Handler] → Catch and format errors
  │
  ▼
Response
```

---

## Database Architecture

### Schema Organization

```
Core Entities
├── users                    # Authentication
├── benefit_programs         # Program definitions
└── document_types           # Document classifications

Document Management
├── documents                # Uploaded files metadata
├── document_chunks          # Semantic chunks with vectors
└── policy_sources           # Official source tracking

Navigator Workspace
├── client_cases             # Case management
├── client_interaction_sessions
├── client_verification_documents
└── ee_export_batches        # DHS integration export

Rules as Code
├── extracted_rules          # AI-extracted policy rules
├── policy_calculations      # Benefit calculation results
└── scenario_calculations    # What-if modeling results

Notifications & Audit
├── notifications            # User notifications
├── notification_preferences # User settings
├── audit_logs              # System audit trail
└── rule_change_logs        # Policy change tracking

Compliance & Quality
├── compliance_rules         # Validation rules
├── compliance_violations    # Identified issues
├── policy_changes          # Version tracking
└── policy_change_impacts   # Impact assessments

Evaluation & Testing
├── evaluation_test_cases    # MD-specific test suite
├── evaluation_runs         # Test execution results
└── evaluation_results      # Individual test outcomes
```

### Indexing Strategy

```sql
-- Performance-critical indexes
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat(embedding);
CREATE INDEX idx_documents_program_id ON documents(program_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_client_cases_navigator ON client_cases(navigator_id);
```

---

## External Integrations

### 1. Google Gemini API

**Models Used:**
- `gemini-2.5-flash` - Text generation, RAG responses
- `text-embedding-004` - Vector embeddings
- `gemini-1.5-pro-vision` - Document analysis

**Integration Pattern:**
```typescript
import { GoogleGenerativeAI } from '@google/genai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

// With caching and retry logic
const response = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: query }] }],
  generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
})
```

### 2. PolicyEngine REST API

**Endpoint:** `https://api.policyengine.org/us/calculate`

**Integration Pattern:**
```typescript
const response = await fetch('https://api.policyengine.org/us/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    household: householdData,
    policy: { state: 'md' }
  })
})
```

**Note:** Currently using unauthenticated endpoint (limited results). Production requires Client ID/Secret.

### 3. Google Cloud Storage

**Integration Pattern:**
```typescript
import { Storage } from '@google-cloud/storage'

const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
})

// Generate signed upload URL
const [url] = await storage
  .bucket(bucketName)
  .file(fileName)
  .getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 3600000 // 1 hour
  })
```

### 4. Future DHS Integration (E&E Export)

**Maryland Replaceability Pattern:**
```typescript
interface DhsExport {
  exportFormat: 'xml' | 'json' | 'csv'
  exportData: {
    clientIdentifier: string
    programEnrollments: Enrollment[]
    verificationDocuments: Document[]
    calculatedBenefits: BenefitAmount[]
  }
}

// Swappable export adapter
class DhsExportAdapter implements ExportAdapter {
  async export(sessions: Session[]): Promise<DhsExport> {
    // Transform internal data → DHS format
  }
}
```

---

## Security Architecture

### Authentication Flow

```
1. User Login (POST /api/auth/login)
   │
   ▼
2. Password Verification (bcryptjs)
   │
   ▼
3. Session Creation (express-session)
   │
   ▼
4. Session Storage (PostgreSQL via connect-pg-simple)
   │
   ▼
5. HTTP-only Cookie Set
   │
   ▼
6. Subsequent Requests Include Cookie
   │
   ▼
7. Session Middleware Validates
```

### Authorization Levels

```
Super Admin (Level 5)
    │
    ├── Full system control
    └── Can modify other admins
    
Admin (Level 4)
    │
    ├── Program management
    ├── Compliance suite
    └── Policy change management
    
Caseworker (Level 3)
    │
    ├── Document review queue
    ├── Bulk approvals
    └── Case access
    
Navigator (Level 2)
    │
    ├── Navigator workspace
    ├── Client case management
    └── E&E export
    
User/Applicant (Level 1)
    │
    ├── Document upload
    ├── Benefit screener
    └── Intake copilot
```

### CSRF Protection

```typescript
import { doubleCsrf } from 'csrf-csrf'

const { doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET,
  cookieName: '__Host-psifi.x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  }
})

// Applied to mutating routes
app.post('/api/*', doubleCsrfProtection, handler)
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit'

// Tier-based limits
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP'
})

const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  keyGenerator: (req) => req.user?.id || req.ip
})

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000
})
```

---

## Performance & Scalability

### Caching Strategy

```typescript
// Server-side cache (NodeCache)
import NodeCache from 'node-cache'

const cache = new NodeCache({
  stdTTL: 600, // 10 minutes default
  checkperiod: 120 // Clean expired every 2 minutes
})

// Cache keys with strategic TTL
cache.set('benefit_programs', programs, 3600) // 1 hour
cache.set(`user_${userId}_notifications`, notifications, 300) // 5 min
cache.set(`search_${queryHash}`, results, 1800) // 30 min
```

### Database Query Optimization

```typescript
// Eager loading with Drizzle
const documentsWithChunks = await db
  .select()
  .from(documents)
  .leftJoin(documentChunks, eq(documents.id, documentChunks.documentId))
  .where(eq(documents.programId, programId))
  .limit(100)

// Index usage
// Uses: idx_documents_program_id
```

### Code Splitting

```typescript
// Dynamic imports for large libraries
const exportToPDF = async () => {
  const jsPDF = (await import('jspdf')).default
  const autoTable = (await import('jspdf-autotable')).default
  
  const doc = new jsPDF()
  // ... generate PDF
}
```

### Lazy Loading Routes

```typescript
// Future optimization (Task 25)
const Admin = lazy(() => import('./pages/Admin'))
const NavigatorWorkspace = lazy(() => import('./pages/NavigatorWorkspace'))

<Suspense fallback={<LoadingSpinner />}>
  <Route path="/admin" component={Admin} />
</Suspense>
```

---

## Deployment Architecture

### Replit Deployment

```
┌─────────────────────────────────────────┐
│          Replit Container               │
│  ┌───────────────────────────────────┐  │
│  │  Node.js 20 Runtime                │  │
│  │                                    │  │
│  │  ┌──────────┐    ┌──────────┐    │  │
│  │  │  Vite    │    │ Express  │    │  │
│  │  │  Dev     │◄───┤  Server  │    │  │
│  │  │  Server  │    │          │    │  │
│  │  └──────────┘    └─────┬────┘    │  │
│  │       │                 │         │  │
│  │       │                 │         │  │
│  │       ▼                 ▼         │  │
│  │  Serves Frontend   API Routes    │  │
│  │  (Port 5000)      (Port 5000)    │  │
│  └───────────────────────────────────┘  │
│                                          │
│  Environment:                            │
│  - DATABASE_URL (Neon PostgreSQL)       │
│  - GEMINI_API_KEY                       │
│  - GOOGLE_APPLICATION_CREDENTIALS       │
│  - SESSION_SECRET                       │
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│       External Services                  │
│  - Neon PostgreSQL (database)           │
│  - Google Cloud Storage (files)         │
│  - Google Gemini API (AI)               │
│  - PolicyEngine API (calculations)      │
└─────────────────────────────────────────┘
```

### Workflow Configuration

```yaml
# .replit workflow
run = "npm run dev"

[env]
NODE_ENV = "development"
PORT = "5000"

[nix]
channel = "stable-23_11"
```

### Health Monitoring

```typescript
// Health check endpoint
GET /api/health
{
  "status": "healthy",
  "services": {
    "database": { "status": "healthy", "latency": "5ms" },
    "geminiApi": { "status": "healthy" },
    "objectStorage": { "status": "healthy" }
  },
  "uptime": 3600
}
```

---

## Design Patterns Used

### 1. Repository Pattern
```typescript
// Data access abstraction
interface IStorage {
  getDocuments(filter: Filter): Promise<Document[]>
  createDocument(data: InsertDocument): Promise<Document>
}
```

### 2. Service Layer Pattern
```typescript
// Business logic isolation
class RAGService {
  constructor(
    private db: Database,
    private gemini: GeminiClient,
    private cache: CacheService
  ) {}
}
```

### 3. Middleware Chain Pattern
```typescript
// Request processing pipeline
app.use(logger)
app.use(auth)
app.use(csrf)
app.use(rateLimit)
```

### 4. Observer Pattern
```typescript
// WebSocket notifications
websocketService.on('notification', (notification) => {
  clients.forEach(client => client.send(notification))
})
```

### 5. Strategy Pattern
```typescript
// PolicyEngine client selection
const calculator = isProductionReady
  ? new PolicyEnginePythonClient()
  : new PolicyEngineHttpClient()
```

### 6. Factory Pattern
```typescript
// Document processor creation
function createProcessor(documentType: string): DocumentProcessor {
  switch(documentType) {
    case 'pdf': return new PdfProcessor()
    case 'image': return new ImageProcessor()
  }
}
```

---

## Technology Stack Summary

### Frontend
- **Framework:** React 18
- **Language:** TypeScript
- **Build Tool:** Vite
- **UI Library:** shadcn/ui (Radix UI)
- **Styling:** Tailwind CSS
- **Routing:** Wouter
- **State Management:** TanStack Query v5
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts

### Backend
- **Runtime:** Node.js 20
- **Framework:** Express.js
- **Language:** TypeScript
- **ORM:** Drizzle
- **Session:** express-session + connect-pg-simple
- **Validation:** Zod
- **Security:** Helmet, csrf-csrf, express-rate-limit

### Database & Storage
- **Primary DB:** PostgreSQL (Neon)
- **File Storage:** Google Cloud Storage
- **Caching:** NodeCache (in-memory)

### AI & Integrations
- **LLM:** Google Gemini 2.5 Flash
- **Embeddings:** Google text-embedding-004
- **Vision:** Gemini 1.5 Pro Vision
- **Benefit Calc:** PolicyEngine REST API

### DevOps & Deployment
- **Platform:** Replit
- **Package Manager:** npm
- **Testing:** Vitest, React Testing Library
- **Linting:** TypeScript ESLint

---

## Future Architecture Considerations

### 1. Microservices Migration Path
```
Current: Monolith
  │
  ▼
Phase 1: Extract AI Services
  │
  ▼
Phase 2: Separate Navigator & Public
  │
  ▼
Phase 3: Full Microservices
```

### 2. Database Scaling
- **Read Replicas** for report generation
- **Connection Pooling** with PgBouncer
- **Partitioning** for audit logs by date

### 3. CDN Integration
- Static assets via CloudFlare
- Document thumbnails via CDN
- API response caching at edge

### 4. Kubernetes Deployment
```yaml
# Future k8s architecture
apiVersion: v1
kind: Service
metadata:
  name: benefits-navigator
spec:
  selector:
    app: benefits-navigator
  ports:
  - port: 80
    targetPort: 5000
```

---

*This architecture documentation is maintained by the Maryland DHS Technology Team. Last updated: October 2025*
