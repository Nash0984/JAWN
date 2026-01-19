# JAWN API Documentation

**Base URL:** `/api`

This document provides comprehensive documentation for all API endpoints in the JAWN (Joint Access Welfare Network) platform.

> **Note:** Examples throughout this documentation use Maryland as the reference implementation. The platform supports multiple jurisdictions; replace `MD_` prefixes and Maryland-specific values with your jurisdiction's configuration.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Authorization Levels](#authorization-levels)
3. [Common Response Codes](#common-response-codes)
4. [Core Endpoints](#core-endpoints)
5. [Search & RAG](#search--rag)
6. [Document Management](#document-management)
7. [Benefit Programs](#benefit-programs)
8. [Rules as Code](#rules-as-code)
9. [PolicyEngine Integration](#policyengine-integration)
10. [Navigator Workspace](#navigator-workspace)
11. [Manual & Policy Content](#manual--policy-content)
12. [Consent Management](#consent-management)
13. [Rules Extraction](#rules-extraction)
14. [Intake Copilot](#intake-copilot)
15. [Notifications](#notifications)
16. [Policy Management](#policy-management)
17. [Compliance](#compliance)
18. [Public Portal](#public-portal)
19. [Scenario Modeling](#scenario-modeling)
20. [ABAWD & Enrollment](#abawd--enrollment)
21. [Document Review Queue](#document-review-queue)
22. [VITA Tax Assistance](#vita-tax-assistance)
23. [Audit & Monitoring](#audit--monitoring)

---

## Authentication

The system uses session-based authentication with HTTP-only cookies.

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "user",
  "createdAt": "2025-10-01T00:00:00.000Z"
}
```

### Signup
```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securePassword123"
}
```

### Logout
```http
POST /api/auth/logout
```

### Get Current User
```http
GET /api/auth/me
```

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "navigator"
}
```

---

## Authorization Levels

| Role | Access Level |
|------|-------------|
| `user` | Basic user access (applicant) |
| `navigator` | Staff privileges for client case management |
| `caseworker` | Staff privileges plus document review |
| `admin` | Full system administration |
| `super_admin` | Ultimate system control |

**Middleware:**
- `requireAuth`: Requires any authenticated user
- `requireAdmin`: Requires admin or super_admin role
- `requireStaff`: Requires navigator, caseworker, admin, or super_admin

---

## Common Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

## Core Endpoints

### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-11T23:45:00.000Z",
  "uptime": 3600,
  "services": {
    "database": { "status": "healthy", "latency": "5ms" },
    "geminiApi": { "status": "healthy", "configured": true },
    "objectStorage": { "status": "healthy", "configured": true }
  },
  "system": {
    "memory": { "used": 150, "total": 512, "unit": "MB" },
    "nodeVersion": "v20.11.0",
    "environment": "production"
  }
}
```

### System Status (Admin)
```http
GET /api/system/status
Authorization: Required (Admin)
```

**Response:**
```json
{
  "totalDocuments": 1250,
  "totalChunks": 15000,
  "totalUsers": 350,
  "storageUsed": "2.5GB",
  "activePrograms": 7,
  "recentSearches": 125
}
```

---

## Search & RAG

### Hybrid Search
```http
POST /api/search
Authorization: Required
Content-Type: application/json

{
  "query": "What are the income limits for SNAP?",
  "programCode": "STATE_SNAP",
  "searchMode": "hybrid",
  "topK": 5
}
```

**Response:**
```json
{
  "query": "What are the income limits for SNAP?",
  "response": "For SNAP (Food Supplement Program), income limits vary by household size...",
  "confidence": 0.92,
  "sources": [
    {
      "documentId": 42,
      "chunkId": 156,
      "relevanceScore": 0.88,
      "citation": "SNAP Policy Manual, Section 3.2.1",
      "excerpt": "Gross income limits for household of 4: $3,250/month"
    }
  ],
  "readingLevel": 7.2,
  "mode": "hybrid",
  "timestamp": "2025-10-11T23:45:00.000Z"
}
```

### Conversational Chat
```http
POST /api/chat/ask
Authorization: Required
Content-Type: application/json

{
  "question": "Can I get SNAP if I'm a college student?",
  "programCode": "MD_SNAP",
  "conversationHistory": []
}
```

---

## Document Management

### Upload URL Generation
```http
POST /api/documents/upload-url
Authorization: Required (Admin)
Content-Type: application/json

{
  "filename": "paystub-2025-10.pdf",
  "documentType": "income_verification",
  "contentType": "application/pdf"
}
```

**Response:**
```json
{
  "uploadUrl": "https://storage.googleapis.com/...",
  "filePath": "public/documents/uuid.pdf",
  "expiresIn": 3600
}
```

### Create Document Record
```http
POST /api/documents
Authorization: Required (Admin)
Content-Type: application/json

{
  "filename": "paystub-2025-10.pdf",
  "filePath": "public/documents/uuid.pdf",
  "documentType": "income_verification",
  "programId": 1
}
```

### List Documents
```http
GET /api/documents
Authorization: Required (Admin)
```

### Get Document by ID
```http
GET /api/documents/:id
Authorization: Required (Admin)
```

### Update Document Status
```http
PATCH /api/documents/:id/status
Authorization: Required (Admin)
Content-Type: application/json

{
  "processingStatus": "completed"
}
```

### Document Verification (Gemini Vision)
```http
POST /api/verify-document
Authorization: Required
Content-Type: multipart/form-data

file: [binary data]
documentType: "drivers_license"
requirementType: "identity"
```

**Response:**
```json
{
  "isValid": true,
  "confidence": 0.95,
  "extractedData": {
    "documentType": "State Driver's License",
    "expirationDate": "2028-03-15",
    "name": "John Doe"
  },
  "explanation": "This is a valid state driver's license that can be used for identity verification.",
  "requirements": {
    "identity": "met",
    "residency": "met"
  }
}
```

---

## Benefit Programs

### List Programs
```http
GET /api/benefit-programs
```

**Response:**
```json
[
  {
    "id": 1,
    "code": "MD_SNAP",
    "name": "SNAP (Food Supplement Program)",
    "description": "Supplemental nutrition assistance...",
    "active": true,
    "eligibilityRules": {...}
  }
]
```

### Document Types
```http
GET /api/document-types
```

---

## Rules as Code

### Income Limits
```http
GET /api/rules/income-limits
Authorization: Required
```

```http
POST /api/rules/income-limits
Authorization: Required (Admin)
Content-Type: application/json

{
  "householdSize": 4,
  "grossIncomeLimit": 3250,
  "netIncomeLimit": 2500,
  "effectiveDate": "2025-10-01"
}
```

### Deductions
```http
GET /api/rules/deductions
Authorization: Required
```

### Allotments
```http
GET /api/rules/allotments
Authorization: Required
```

### Categorical Eligibility
```http
GET /api/rules/categorical-eligibility
Authorization: Required
```

### Document Requirements
```http
GET /api/rules/document-requirements
Authorization: Required
```

### Recent Calculations
```http
GET /api/eligibility/calculations
Authorization: Required
```

### Provision Mappings (Human-in-the-Loop Pipeline)

#### Get All Mappings
```http
GET /api/provision-mappings
Authorization: Required (Admin)
Query Parameters:
  - status: pending | approved | rejected (optional)
  - priority: urgent | high | normal | low (optional)
```

**Response:**
```json
{
  "mappings": [
    {
      "id": "pm_123abc",
      "provisionId": "prov_456def",
      "ontologyTermId": "term_789ghi",
      "matchScore": 0.87,
      "matchStrategy": "semantic_similarity",
      "status": "pending",
      "priority": "high",
      "affectedRulesCount": 3,
      "provision": {
        "sectionNumber": "2",
        "provisionType": "amends",
        "affectedPrograms": ["SNAP"],
        "effectiveDate": "2026-03-01",
        "provisionText": "Section 5(d)(1) of the Food and Nutrition Act..."
      },
      "ontologyTerm": {
        "canonicalName": "snap_income_deduction_standard",
        "plainLanguage": "Standard deduction from gross income",
        "usCitation": "7 USC 2014(e)(1)"
      }
    }
  ],
  "total": 42
}
```

#### Get Mapping Statistics
```http
GET /api/provision-mappings/stats
Authorization: Required (Admin)
```

**Response:**
```json
{
  "pending": 12,
  "approved": 156,
  "rejected": 8,
  "byPriority": {
    "urgent": 2,
    "high": 5,
    "normal": 4,
    "low": 1
  }
}
```

#### Approve Single Mapping
```http
POST /api/provision-mappings/:id/approve
Authorization: Required (Admin)
Content-Type: application/json

{
  "notes": "Verified citation matches current law"
}
```

**Response:**
```json
{
  "success": true,
  "mapping": {
    "id": "pm_123abc",
    "status": "approved",
    "reviewedBy": "user_789",
    "reviewedAt": "2026-01-18T14:30:00.000Z",
    "processingStatus": "pending_rule_verification",
    "affectedRulesQueued": 3
  }
}
```

#### Reject Single Mapping
```http
POST /api/provision-mappings/:id/reject
Authorization: Required (Admin)
Content-Type: application/json

{
  "reason": "Incorrect ontology term match - provision modifies threshold, not definition"
}
```

#### Bulk Approve Mappings
```http
POST /api/provision-mappings/bulk-approve
Authorization: Required (Admin)
Content-Type: application/json

{
  "mappingIds": ["pm_123abc", "pm_456def", "pm_789ghi"]
}
```

**Response:**
```json
{
  "success": true,
  "approved": 3,
  "affectedRulesQueued": 8
}
```

---

## PolicyEngine Integration

### Calculate Benefits
```http
POST /api/policyengine/calculate
Content-Type: application/json

{
  "household": {
    "people": {
      "you": { "age": 35 },
      "child1": { "age": 8 }
    }
  },
  "income": {
    "employment_income": { "2025": 30000 }
  },
  "state": "md"
}
```

**Response:**
```json
{
  "snap": {
    "value": 450,
    "eligible": true
  },
  "medicaid": {
    "value": 0,
    "eligible": true
  },
  "eitc": {
    "value": 3200,
    "eligible": true
  }
}
```

### Multi-Benefit Summary
```http
POST /api/policyengine/summary
Content-Type: application/json

{
  "calculations": {...}
}
```

### Verify Calculation
```http
POST /api/policyengine/verify
Authorization: Required
Content-Type: application/json

{
  "programCode": "MD_SNAP",
  "input": {...},
  "expectedOutput": {...}
}
```

### Test Connection
```http
GET /api/policyengine/test
```

### Financial Opportunity Radar - Real-Time Eligibility Tracking

#### Calculate Cross-Program Eligibility
```http
POST /api/eligibility/radar
Content-Type: application/json

{
  "adults": 2,
  "children": 1,
  "annualIncome": 35000,
  "monthlyRent": 1200,
  "monthlyUtilities": 150,
  "hasUtilitySeparately": true,
  "childcareExpenses": 800,
  "childSupportPaid": 0,
  "medicalExpenses": 0,
  "state": "MD",
  "previousResults": {
    "SNAP": { "eligible": true, "monthlyBenefit": 450 },
    "Medicaid": { "eligible": true, "monthlyBenefit": 0 }
  }
}
```

**Request Parameters:**
- `adults` (number): Number of adults in household
- `children` (number): Number of children in household
- `annualIncome` (number): Total annual household income
- `monthlyRent` (number, optional): Monthly rent/mortgage payment
- `monthlyUtilities` (number, optional): Monthly utility costs
- `hasUtilitySeparately` (boolean, optional): Whether utilities are billed separately
- `childcareExpenses` (number, optional): Monthly childcare costs
- `childSupportPaid` (number, optional): Monthly child support paid
- `medicalExpenses` (number, optional): Monthly medical expenses
- `state` (string): State code (default: "MD")
- `previousResults` (object, optional): Previous calculation results for change detection

**Response:**
```json
{
  "success": true,
  "programs": [
    {
      "programCode": "SNAP",
      "programName": "Food Supplement Program",
      "eligible": true,
      "monthlyBenefit": 450,
      "annualBenefit": 5400,
      "status": "eligible",
      "changeIndicator": "new",
      "changeAmount": 450,
      "changePercent": 0,
      "message": "You qualify for monthly food assistance"
    },
    {
      "programCode": "Medicaid",
      "programName": "Medical Assistance",
      "eligible": true,
      "monthlyBenefit": 0,
      "annualBenefit": 0,
      "status": "eligible",
      "changeIndicator": null,
      "changeAmount": 0,
      "changePercent": 0,
      "message": "Healthcare coverage available"
    },
    {
      "programCode": "EITC",
      "programName": "Earned Income Tax Credit",
      "eligible": true,
      "monthlyBenefit": 0,
      "annualBenefit": 3200,
      "status": "eligible",
      "changeIndicator": "increased",
      "changeAmount": 500,
      "changePercent": 18.5,
      "message": "Tax credit at year-end"
    },
    {
      "programCode": "CTC",
      "programName": "Child Tax Credit",
      "eligible": true,
      "monthlyBenefit": 0,
      "annualBenefit": 2000,
      "status": "eligible",
      "changeIndicator": null,
      "changeAmount": 0,
      "changePercent": 0,
      "message": "Child tax benefit available"
    },
    {
      "programCode": "TANF",
      "programName": "Temporary Cash Assistance",
      "eligible": false,
      "monthlyBenefit": 0,
      "annualBenefit": 0,
      "status": "ineligible",
      "changeIndicator": null,
      "changeAmount": 0,
      "changePercent": 0,
      "message": "Income exceeds limit"
    },
    {
      "programCode": "SSI",
      "programName": "Supplemental Security Income",
      "eligible": false,
      "monthlyBenefit": 0,
      "annualBenefit": 0,
      "status": "ineligible",
      "changeIndicator": null,
      "changeAmount": 0,
      "changePercent": 0,
      "message": "Does not meet disability criteria"
    }
  ],
  "alerts": [
    {
      "type": "opportunity",
      "title": "Apply for SNAP Benefits",
      "message": "You're newly eligible for $450/month in food assistance. Apply today to start receiving benefits.",
      "action": "Start SNAP Application",
      "programCode": "SNAP"
    },
    {
      "type": "success",
      "title": "Tax Credits Increased",
      "message": "Your EITC increased by $500 (18.5%) based on your current household information.",
      "action": "Review Tax Benefits",
      "programCode": "EITC"
    }
  ],
  "summary": {
    "totalMonthly": 450,
    "totalAnnual": 10600,
    "eligibleProgramsCount": 4,
    "effectiveBenefitRate": 30.3
  }
}
```

**Change Indicators:**
- `"new"`: First-time eligibility (transition from 0 or undefined to eligible)
- `"increased"`: Benefit amount increased
- `"decreased"`: Benefit amount decreased
- `null`: No change or not applicable

**Alert Types:**
- `"opportunity"`: New benefit available or unclaimed benefits
- `"success"`: Positive change or achievement
- `"warning"`: Action needed or potential issue

**Features:**
- **Real-Time Updates**: Calculations triggered instantly on household data changes (300ms debounce)
- **Change Detection**: Compares current vs. previous results to highlight new eligibility and benefit changes
- **Cross-Enrollment Intelligence**: AI-powered recommendations for unclaimed benefits
- **Request Cancellation**: Supports AbortController for canceling outdated requests
- **CSRF Protection**: Requires x-csrf-token header for security

**Error Responses:**
```json
{
  "error": "Invalid household data",
  "details": "annualIncome must be a positive number"
}
```

**Rate Limiting:** 20 requests per minute per user

---

## Navigator Workspace

### Client Sessions

#### Create Session
```http
POST /api/navigator/sessions
Authorization: Required (Staff)
Content-Type: application/json

{
  "clientName": "Jane Smith",
  "clientIdentifier": "JS-2025-001",
  "sessionType": "initial_screening",
  "householdSize": 3,
  "householdComposition": {...}
}
```

#### List Sessions
```http
GET /api/navigator/sessions
Authorization: Required (Staff)
```

### Document Verification

#### Upload Verification Document
```http
POST /api/navigator/sessions/:sessionId/documents
Authorization: Required (Staff)
Content-Type: multipart/form-data

file: [binary data]
requirementType: "income_verification"
```

#### List Session Documents
```http
GET /api/navigator/sessions/:sessionId/documents
Authorization: Required (Staff)
```

#### Update Document Status
```http
PATCH /api/navigator/documents/:id
Authorization: Required (Staff)
Content-Type: application/json

{
  "verificationStatus": "approved"
}
```

### E&E Export

#### Create Export Batch
```http
POST /api/navigator/exports
Authorization: Required (Staff)
Content-Type: application/json

{
  "batchName": "Q4 Enrollments",
  "sessionIds": [1, 2, 3, 4],
  "format": "xml"
}
```

#### Download Export
```http
GET /api/navigator/exports/:id/download
Authorization: Required (Staff)
```

---

## Manual & Policy Content

### Manual Structure

#### Get Manual Sections (TOC)
```http
GET /api/manual/sections
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "sectionNumber": "100",
    "title": "SNAP Eligibility",
    "subsections": [...]
  }
]
```

#### Get Section Details
```http
GET /api/manual/sections/:id
Authorization: Required
```

**Response:**
```json
{
  "id": 1,
  "sectionNumber": "100",
  "title": "SNAP Eligibility",
  "content": "Full section text...",
  "extractedRules": [...],
  "effectiveDate": "2025-10-01"
}
```

#### Get Manual Structure
```http
GET /api/manual/structure
Authorization: Required
```

**Response:**
```json
{
  "totalSections": 42,
  "lastUpdated": "2025-10-01T00:00:00.000Z",
  "version": "FY2026",
  "structure": [...]
}
```

### Manual Ingestion

#### Get Ingestion Status
```http
GET /api/manual/status
Authorization: Required
```

**Response:**
```json
{
  "metadataIngested": true,
  "fullIngestionComplete": true,
  "lastIngestedAt": "2025-10-01T10:00:00.000Z",
  "totalSections": 42,
  "sectionsProcessed": 42,
  "embeddingsGenerated": 1250
}
```

#### Ingest Metadata
```http
POST /api/manual/ingest-metadata
Authorization: Required (Admin)
Content-Type: application/json

{
  "sourceUrl": "https://dhs.maryland.gov/snap-policy-manual",
  "forceRefresh": false
}
```

**Response:**
```json
{
  "status": "completed",
  "sectionsFound": 42,
  "message": "Metadata ingestion complete. Use /api/manual/ingest-full to download PDFs and generate embeddings."
}
```

#### Ingest Full Manual
```http
POST /api/manual/ingest-full
Authorization: Required (Admin)
Content-Type: application/json

{
  "sectionIds": [1, 2, 3],
  "generateEmbeddings": true
}
```

**Response (Async Job):**
```json
{
  "status": "processing",
  "jobId": "ing_abc123",
  "estimatedTime": "15 minutes",
  "sectionsToProcess": 42,
  "message": "Full ingestion started. Check /api/manual/status for progress."
}
```

### Living Policy Manual Generation

#### Generate Section Text
```http
POST /api/manual/generate-text/:sectionId
Authorization: Required
Content-Type: application/json

{
  "includeExamples": true,
  "readingLevel": 8
}
```

**Response:**
```json
{
  "sectionId": 1,
  "generatedText": "SNAP Eligibility Requirements\n\nTo qualify for SNAP benefits...",
  "readingLevel": 7.5,
  "wordCount": 850,
  "includesExamples": true
}
```

#### Generate Income Limits Text
```http
POST /api/manual/generate/income-limits
Authorization: Required
```

**Response:**
```json
{
  "topic": "income_limits",
  "generatedText": "SNAP Income Limits\n\nIncome limits determine who qualifies for SNAP benefits. These limits are based on household size and gross monthly income...",
  "readingLevel": 7.8,
  "wordCount": 425,
  "rulesIncluded": 8
}
```

#### Generate Deductions Text
```http
POST /api/manual/generate/deductions
Authorization: Required
```

**Response:**
```json
{
  "topic": "deductions",
  "generatedText": "SNAP Allowable Deductions\n\nWhen calculating your SNAP benefits, Maryland allows certain deductions from your income...",
  "readingLevel": 7.5,
  "wordCount": 380,
  "rulesIncluded": 6
}
```

#### Generate Allotments Text
```http
POST /api/manual/generate/allotments
Authorization: Required
```

**Response:**
```json
{
  "topic": "allotments",
  "generatedText": "SNAP Benefit Amounts (Monthly Allotments)\n\nThe amount of SNAP benefits you receive depends on your household size and net income...",
  "readingLevel": 7.2,
  "wordCount": 350,
  "rulesIncluded": 12
}
```

---

## Consent Management

### Consent Forms

#### List Consent Forms
```http
GET /api/consent/forms
Authorization: Required (Staff)
```

**Response:**
```json
[
  {
    "id": 1,
    "formType": "information_sharing",
    "title": "SNAP Information Sharing Consent",
    "description": "Allows sharing of SNAP application data with partner agencies",
    "requiredForPrograms": ["MD_SNAP"],
    "version": "2.0",
    "effectiveDate": "2025-10-01"
  }
]
```

#### Create Consent Form
```http
POST /api/consent/forms
Authorization: Required (Staff)
Content-Type: application/json

{
  "formType": "information_sharing",
  "title": "SNAP Information Sharing Consent",
  "description": "Allows sharing of SNAP application data with partner agencies",
  "requiredForPrograms": ["MD_SNAP"],
  "version": "2.0",
  "effectiveDate": "2025-10-01",
  "formContent": {
    "sections": [...],
    "signature_required": true
  }
}
```

**Response:**
```json
{
  "id": 1,
  "formType": "information_sharing",
  "title": "SNAP Information Sharing Consent",
  "description": "Allows sharing of SNAP application data with partner agencies",
  "requiredForPrograms": ["MD_SNAP"],
  "version": "2.0",
  "effectiveDate": "2025-10-01",
  "createdAt": "2025-10-11T10:00:00.000Z",
  "createdBy": 5
}
```

### Client Consents

#### List Client Consents
```http
GET /api/consent/client-consents
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 42,
    "consentFormId": 1,
    "granted": true,
    "grantedAt": "2025-10-11T10:00:00.000Z",
    "expiresAt": "2026-10-11T10:00:00.000Z",
    "revokedAt": null,
    "formType": "information_sharing"
  }
]
```

#### Create Client Consent
```http
POST /api/consent/client-consents
Authorization: Required
Content-Type: application/json

{
  "consentFormId": 1,
  "granted": true,
  "signature": "John Doe",
  "signedAt": "2025-10-11T10:00:00.000Z"
}
```

**Response:**
```json
{
  "id": 42,
  "userId": 1,
  "consentFormId": 1,
  "granted": true,
  "grantedAt": "2025-10-11T10:00:00.000Z",
  "expiresAt": "2026-10-11T10:00:00.000Z"
}
```

---

## Rules Extraction

### Extract Rules

#### Extract from Single Section
```http
POST /api/extraction/extract-section
Authorization: Required (Admin)
Content-Type: application/json

{
  "sectionId": 1,
  "extractionConfig": {
    "includeExceptions": true,
    "includeExamples": true
  }
}
```

**Response:**
```json
{
  "jobId": "ext_abc123",
  "status": "processing",
  "sectionId": 1,
  "estimatedTime": "2 minutes"
}
```

#### Batch Extract
```http
POST /api/extraction/extract-batch
Authorization: Required (Admin)
Content-Type: application/json

{
  "sectionIds": [1, 2, 3, 4, 5],
  "extractionConfig": {
    "includeExceptions": true,
    "includeExamples": true
  }
}
```

**Response:**
```json
{
  "jobId": "ext_batch_xyz789",
  "status": "processing",
  "sectionsCount": 5,
  "sectionIds": [1, 2, 3, 4, 5],
  "estimatedTime": "10 minutes",
  "message": "Batch extraction started. Check /api/extraction/jobs/:jobId for progress."
}
```

#### Get Extraction Job Status
```http
GET /api/extraction/jobs/:jobId
Authorization: Required (Admin)
```

**Response:**
```json
{
  "id": "ext_abc123",
  "status": "completed",
  "sectionId": 1,
  "extractedRules": 15,
  "startedAt": "2025-10-11T10:00:00.000Z",
  "completedAt": "2025-10-11T10:02:30.000Z",
  "results": {
    "incomeRules": 5,
    "deductionRules": 3,
    "eligibilityRules": 7
  }
}
```

#### List All Extraction Jobs
```http
GET /api/extraction/jobs
Authorization: Required (Admin)
```

**Response:**
```json
[
  {
    "id": "ext_abc123",
    "status": "completed",
    "sectionId": 1,
    "extractedRules": 15,
    "startedAt": "2025-10-11T10:00:00.000Z",
    "completedAt": "2025-10-11T10:02:30.000Z"
  },
  {
    "id": "ext_batch_xyz789",
    "status": "processing",
    "sectionsCount": 5,
    "extractedRules": 32,
    "startedAt": "2025-10-11T11:00:00.000Z",
    "completedAt": null
  }
]
```

---

## Intake Copilot

### Create Intake Session
```http
POST /api/intake-sessions
Authorization: Required
Content-Type: application/json

{
  "programCode": "MD_SNAP"
}
```

### Send Message
```http
POST /api/intake-sessions/:id/messages
Authorization: Required
Content-Type: application/json

{
  "content": "I live with my spouse and 2 children",
  "role": "user"
}
```

**Response:**
```json
{
  "id": 42,
  "sessionId": 1,
  "role": "assistant",
  "content": "Thank you. I've noted that your household has 4 people total. Can you tell me about your monthly income?",
  "extractedData": {
    "householdSize": 4,
    "householdMembers": [
      { "relationship": "self" },
      { "relationship": "spouse" },
      { "relationship": "child" },
      { "relationship": "child" }
    ]
  },
  "completeness": 0.35
}
```

### Generate Application Form
```http
POST /api/intake-sessions/:id/generate-form
Authorization: Required
```

**Response:**
```json
{
  "formId": "ABC123",
  "formData": {...},
  "completeness": 0.85,
  "missingFields": ["phone_number"]
}
```

---

## Notifications

### List Notifications
```http
GET /api/notifications
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "type": "policy_change",
    "title": "SNAP Policy Update",
    "message": "Income limits have been updated for FY 2026",
    "priority": "high",
    "isRead": false,
    "actionUrl": "/policy-changes/42",
    "createdAt": "2025-10-11T10:00:00.000Z"
  }
]
```

### Unread Count
```http
GET /api/notifications/unread-count
Authorization: Required
```

### Mark as Read
```http
PATCH /api/notifications/:id/read
Authorization: Required
```

### Mark All as Read
```http
PATCH /api/notifications/read-all
Authorization: Required
```

### Notification Preferences
```http
GET /api/notifications/preferences
Authorization: Required
```

```http
PATCH /api/notifications/preferences
Authorization: Required
Content-Type: application/json

{
  "emailEnabled": true,
  "policyChanges": true,
  "feedbackAlerts": false
}
```

---

## Policy Management

### Policy Changes

#### List Changes
```http
GET /api/policy-changes
Authorization: Required
```

#### Get Single Change
```http
GET /api/policy-changes/:id
Authorization: Required
```

#### Create Change
```http
POST /api/policy-changes
Authorization: Required (Admin)
Content-Type: application/json

{
  "programId": 1,
  "changeType": "rule_update",
  "severity": "significant",
  "oldContent": "Previous policy text...",
  "newContent": "Updated policy text...",
  "effectiveDate": "2025-11-01"
}
```

#### Get Impacts
```http
GET /api/policy-changes/:id/impacts
Authorization: Required (Staff)
```

#### Acknowledge Impact
```http
PATCH /api/policy-change-impacts/:id/acknowledge
Authorization: Required
```

---

## Compliance

### Compliance Rules

#### List Rules
```http
GET /api/compliance-rules
Authorization: Required (Admin)
```

#### Create Rule
```http
POST /api/compliance-rules
Authorization: Required (Admin)
Content-Type: application/json

{
  "ruleType": "accessibility",
  "regulationReference": "WCAG 2.1 AA",
  "validationCriteria": {...},
  "severity": "high"
}
```

### Compliance Violations

#### List Violations
```http
GET /api/compliance-violations
Authorization: Required (Admin)
```

#### Acknowledge Violation
```http
PATCH /api/compliance-violations/:id/acknowledge
Authorization: Required (Admin)
```

#### Resolve Violation
```http
PATCH /api/compliance-violations/:id/resolve
Authorization: Required (Admin)
Content-Type: application/json

{
  "resolutionNotes": "Updated alt text for all images"
}
```

---

## Public Portal

### Document Templates
```http
GET /api/public/document-templates
```

### Notice Templates
```http
GET /api/public/notice-templates
```

### FAQ
```http
GET /api/public/faq
GET /api/public/faq?state=MD
GET /api/public/faq?state=MD&program=snap
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | string | Optional. State code (e.g., `MD`, `PA`, `VA`). Returns state-specific FAQs plus federal/general content (NULL stateCode). |
| `program` | string | Optional. Program filter: `snap`, `medicaid`, `tanf`, `ohep`, `ssi`, `vita`. Returns program-specific FAQs plus general content (NULL program). |
| `category` | string | Optional. Category filter for browsing by topic. |

**Response:**
```json
[
  {
    "id": "uuid",
    "category": "eligibility",
    "question": "What are the income limits for SNAP?",
    "answer": "Income limits vary by household size...",
    "relatedQuestions": ["How do I apply?"],
    "viewCount": 150,
    "stateCode": "MD",
    "program": "snap"
  }
]
```

### Analyze Notice (Gemini Vision)
```http
POST /api/public/analyze-notice
Content-Type: multipart/form-data

image: [binary data]
```

### Explain Notice
```http
POST /api/public/explain-notice
Content-Type: application/json

{
  "noticeText": "Your SNAP benefits will be recertified..."
}
```

### Search FAQ
```http
POST /api/public/search-faq
Content-Type: application/json

{
  "query": "How do I renew my SNAP benefits?",
  "state": "MD",
  "program": "snap"
}
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Natural language question |
| `state` | string | No | State code for state-specific results |
| `program` | string | No | Program filter for targeted results |

**Response:**
```json
{
  "answer": "AI-generated answer based on matched FAQs...",
  "sources": [
    {
      "question": "How do I recertify for SNAP?",
      "answer": "You can recertify online or by mail...",
      "relevance": 0.95
    }
  ]
}
```

---

## Scenario Modeling

### Scenarios

#### Create Scenario
```http
POST /api/scenarios
Authorization: Required
Content-Type: application/json

{
  "name": "Current Situation",
  "householdData": {...}
}
```

#### List Scenarios
```http
GET /api/scenarios
Authorization: Required
```

#### Calculate Scenario
```http
POST /api/scenarios/:id/calculate
Authorization: Required
```

### Comparisons

#### Create Comparison
```http
POST /api/comparisons
Authorization: Required
Content-Type: application/json

{
  "name": "Job Change Analysis",
  "scenarioIds": [1, 2]
}
```

#### List Comparisons
```http
GET /api/comparisons
Authorization: Required
```

---

## ABAWD & Enrollment

### ABAWD Verifications

#### Create Verification
```http
POST /api/abawd-verifications
Authorization: Required (Staff)
Content-Type: application/json

{
  "clientIdentifier": "JS-2025-001",
  "exemptionType": "disability",
  "verificationMethod": "medical_documentation",
  "verificationDate": "2025-10-11"
}
```

#### List Verifications
```http
GET /api/abawd-verifications
Authorization: Required (Staff)
```

### Program Enrollments

#### Create Enrollment
```http
POST /api/program-enrollments
Authorization: Required (Staff)
Content-Type: application/json

{
  "clientIdentifier": "JS-2025-001",
  "programCode": "MD_SNAP",
  "enrollmentDate": "2025-10-11",
  "benefitAmount": 450
}
```

#### Analyze Cross-Enrollment
```http
GET /api/cross-enrollment/analyze/:clientIdentifier
Authorization: Required (Staff)
```

---

## Document Review Queue

### Get Review Queue
```http
GET /api/document-review/queue
Authorization: Required (Staff)
```

**Response:**
```json
[
  {
    "id": 1,
    "requirementType": "income_verification",
    "verificationStatus": "pending",
    "isValid": null,
    "confidence": null,
    "createdAt": "2025-10-11T10:00:00.000Z",
    "caseId": "JS-2025-001"
  }
]
```

### Get Single Document
```http
GET /api/document-review/:id
Authorization: Required (Staff)
```

### Update Status
```http
PUT /api/document-review/:id/status
Authorization: Required (Staff)
Content-Type: application/json

{
  "verificationStatus": "approved",
  "reviewNotes": "Paystub verified for October 2025"
}
```

### Bulk Update
```http
PUT /api/document-review/bulk-update
Authorization: Required (Staff)
Content-Type: application/json

{
  "documentIds": [1, 2, 3],
  "verificationStatus": "approved"
}
```

**Response:**
```json
{
  "updated": 3,
  "results": [
    { "id": 1, "success": true },
    { "id": 2, "success": true },
    { "id": 3, "success": true }
  ]
}
```

---

## VITA Tax Assistance

### Ingest Publication
```http
POST /api/vita/ingest-pub4012
Authorization: Required (Admin)
```

### List Documents
```http
GET /api/vita/documents
Authorization: Required
```

### Search VITA
```http
POST /api/vita/search
Authorization: Required
Content-Type: application/json

{
  "query": "What is the EITC eligibility for 2025?",
  "topK": 5
}
```

**Response:**
```json
{
  "answer": "For tax year 2025, EITC eligibility requires...",
  "sources": [...],
  "extractedRules": [...],
  "confidence": 0.89
}
```

### Get Topics
```http
GET /api/vita/topics
Authorization: Required
```

---

## Audit & Monitoring

### Audit Logs
```http
GET /api/audit-logs
Authorization: Required (Admin)
Query Parameters: ?action=document_approved&startDate=2025-10-01
```

### Rule Change Logs
```http
GET /api/rule-change-logs
Authorization: Required (Admin)
```

### AI Monitoring

#### Query Analytics
```http
GET /api/ai-monitoring/query-analytics
```

#### System Health
```http
GET /api/ai-monitoring/system-health
```

#### Response Quality
```http
GET /api/ai-monitoring/response-quality
```

#### Flag Response
```http
POST /api/ai-monitoring/flag-response
Authorization: Required
Content-Type: application/json

{
  "queryId": 123,
  "flagType": "bias_concern",
  "comments": "Response may contain regional bias"
}
```

### Feedback

#### Submit Feedback
```http
POST /api/feedback
Authorization: Required
Content-Type: application/json

{
  "type": "bug",
  "category": "document_verification",
  "message": "Verification failed for valid paystub",
  "context": {...}
}
```

#### List Feedback (Admin)
```http
GET /api/feedback
Authorization: Required (Admin)
```

#### Update Feedback
```http
PATCH /api/feedback/:id
Authorization: Required (Admin)
Content-Type: application/json

{
  "status": "resolved",
  "adminNotes": "Fixed in v2.1"
}
```

---

## Automated Ingestion

### Schedules

#### List Schedules
```http
GET /api/automated-ingestion/schedules
Authorization: Required (Admin)
```

#### Create Schedule
```http
POST /api/automated-ingestion/schedules
Authorization: Required (Admin)
Content-Type: application/json

{
  "scheduleName": "weekly-snap-updates",
  "cronPattern": "0 3 * * 0",
  "sourceConfig": {...}
}
```

#### Trigger Manual
```http
POST /api/automated-ingestion/trigger
Authorization: Required (Admin)
Content-Type: application/json

{
  "scheduleId": 1
}
```

---

## Quality Control & Cockpits

### Caseworker Cockpit - Get Flagged Cases
```http
GET /api/qc/caseworker/flagged-cases
Authorization: Required (Caseworker+)
```

**Response:**
```json
{
  "cases": [
    {
      "caseId": "Case #12345",
      "riskScore": 85,
      "flagReason": "income_verification",
      "predictedErrors": ["Missing paystub verification", "Unverified self-employment"],
      "recommendations": ["Review income documentation", "Request additional verification"]
    }
  ]
}
```

### Caseworker Error Trends
```http
GET /api/qc/caseworker/error-trends?quarters=4
Authorization: Required (Caseworker+)
```

### Get Job Aids
```http
GET /api/qc/job-aids
Authorization: Required (Caseworker+)
```

**Response:**
```json
{
  "jobAids": [
    {
      "id": 1,
      "title": "Income Verification Best Practices",
      "category": "income_verification",
      "content": "...",
      "lastUpdated": "2025-10-01"
    }
  ]
}
```

### Supervisor Cockpit - Team Error Alerts
```http
GET /api/qc/supervisor/team-errors
Authorization: Required (Supervisor+)
```

**Response:**
```json
{
  "alerts": [
    {
      "errorCategory": "shelter_utility",
      "currentRate": 12.5,
      "previousRate": 2.1,
      "percentageChange": 500,
      "severity": "critical",
      "affectedCaseworkers": 8
    }
  ]
}
```

### Proactive Case Flagging
```http
POST /api/qc/flag-case
Authorization: Required (Supervisor+)
Content-Type: application/json

{
  "caseId": "Case #12345",
  "flagReason": "high_risk_pattern",
  "assignedCaseworker": "caseworker@maryland.gov",
  "notes": "Multiple income sources require extra verification"
}
```

### Training Impact Analytics
```http
GET /api/qc/supervisor/training-impact
Authorization: Required (Supervisor+)
```

**Response:**
```json
{
  "interventions": [
    {
      "trainingType": "income_verification_workshop",
      "errorRateBefore": 8.5,
      "errorRateAfter": 2.1,
      "improvement": 75.3,
      "completedBy": 12,
      "completionDate": "2025-09-15"
    }
  ]
}
```

---

## County Management

### List All Counties
```http
GET /api/counties
Authorization: Required (Admin+)
```

**Response:**
```json
{
  "counties": [
    {
      "id": 1,
      "name": "Baltimore City",
      "code": "BALTIMORE_CITY",
      "contactEmail": "benefits@baltimorecity.gov",
      "contactPhone": "(410) 555-1234",
      "branding": {
        "primaryColor": "#003087",
        "logoUrl": "https://..."
      },
      "isPilot": true
    }
  ]
}
```

### Get County Configuration
```http
GET /api/counties/:countyId
Authorization: Required (Admin+)
```

### Update County Settings
```http
PATCH /api/counties/:countyId
Authorization: Required (Super Admin)
Content-Type: application/json

{
  "contactEmail": "newcontact@county.gov",
  "branding": {
    "primaryColor": "#003087",
    "logoUrl": "https://storage.example.com/logo.png"
  }
}
```

### County Analytics
```http
GET /api/counties/:countyId/analytics?startDate=2025-01-01&endDate=2025-10-01
Authorization: Required (Admin+)
```

**Response:**
```json
{
  "applicationVolume": 1250,
  "approvalRate": 78.5,
  "averageProcessingTime": 12.3,
  "programUtilization": {
    "SNAP": 850,
    "Medicaid": 650,
    "TANF": 120
  }
}
```

### Assign Staff to County
```http
POST /api/counties/:countyId/staff
Authorization: Required (Admin+)
Content-Type: application/json

{
  "userId": 42,
  "role": "navigator"
}
```

---

## AI Monitoring & Performance

### Get AI Model Metrics
```http
GET /api/ai-monitoring/metrics?model=gemini-1.5-pro&days=30
Authorization: Required (Admin+)
```

**Response:**
```json
{
  "model": "gemini-1.5-pro",
  "accuracy": {
    "rag": 92.5,
    "extraction": 88.3,
    "classification": 94.1
  },
  "performance": {
    "avgResponseTime": 850,
    "p95ResponseTime": 1200,
    "errorRate": 0.8
  },
  "costs": {
    "totalCost": 485.23,
    "requestCount": 12450,
    "avgCostPerRequest": 0.039
  }
}
```

### List Model Versions
```http
GET /api/ai-monitoring/versions
Authorization: Required (Admin+)
```

### A/B Test Results
```http
GET /api/ai-monitoring/ab-tests/:testId
Authorization: Required (Admin+)
```

**Response:**
```json
{
  "testId": "rag-temperature-test",
  "variantA": {
    "config": {"temperature": 0.7},
    "accuracy": 91.2,
    "userSatisfaction": 4.3
  },
  "variantB": {
    "config": {"temperature": 0.3},
    "accuracy": 94.1,
    "userSatisfaction": 4.7
  },
  "winner": "variantB"
}
```

### Track API Costs
```http
POST /api/ai-monitoring/log-usage
Authorization: Required (System)
Content-Type: application/json

{
  "model": "gemini-1.5-pro",
  "operation": "rag_search",
  "inputTokens": 1500,
  "outputTokens": 800,
  "cost": 0.042
}
```

---

## Developer Portal & API Keys

### Generate API Key
```http
POST /api/developer/keys
Authorization: Required (Developer+)
Content-Type: application/json

{
  "name": "Production Integration",
  "scopes": ["benefits:read", "documents:write"],
  "expiresAt": "2026-01-01T00:00:00Z"
}
```

**Response:**
```json
{
  "apiKey": "md_live_1234567890abcdef",
  "id": 42,
  "name": "Production Integration",
  "scopes": ["benefits:read", "documents:write"],
  "createdAt": "2025-10-14T00:00:00Z",
  "expiresAt": "2026-01-01T00:00:00Z"
}
```

### List API Keys
```http
GET /api/developer/keys
Authorization: Required (Developer+)
```

### Revoke API Key
```http
DELETE /api/developer/keys/:keyId
Authorization: Required (Developer+)
```

### Configure Webhook
```http
POST /api/developer/webhooks
Authorization: Required (Developer+)
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/benefits",
  "events": ["application.approved", "document.verified"],
  "secret": "webhook_secret_123"
}
```

### Test Webhook
```http
POST /api/developer/webhooks/:webhookId/test
Authorization: Required (Developer+)
```

### Get Integration Examples
```http
GET /api/developer/examples?language=javascript
```

**Response:**
```json
{
  "language": "javascript",
  "examples": [
    {
      "title": "Check Eligibility",
      "code": "const response = await fetch('/api/policyengine/calculate', {...})"
    }
  ]
}
```

---

## Training & Certification

### List Training Modules
```http
GET /api/training/modules
Authorization: Required (Staff+)
```

**Response:**
```json
{
  "modules": [
    {
      "id": 1,
      "title": "SNAP Eligibility Fundamentals",
      "description": "Core concepts of SNAP eligibility determination",
      "duration": 45,
      "required": true,
      "certification": "SNAP Specialist"
    }
  ]
}
```

### Get User Training Progress
```http
GET /api/training/progress/:userId
Authorization: Required (Staff+)
```

**Response:**
```json
{
  "userId": 42,
  "completedModules": [1, 3, 5],
  "inProgressModules": [7],
  "certifications": [
    {
      "name": "SNAP Specialist",
      "earnedDate": "2025-08-15",
      "expiresDate": "2026-08-15"
    }
  ]
}
```

### Complete Training Module
```http
POST /api/training/modules/:moduleId/complete
Authorization: Required (Staff+)
Content-Type: application/json

{
  "quizScore": 95,
  "timeSpent": 42
}
```

### Generate Certificate
```http
POST /api/training/certificates
Authorization: Required (Staff+)
Content-Type: application/json

{
  "userId": 42,
  "certificationType": "SNAP_SPECIALIST",
  "completionDate": "2025-10-14"
}
```

**Response:**
```json
{
  "certificateId": 123,
  "downloadUrl": "/api/training/certificates/123/download",
  "expiresAt": "2026-10-14"
}
```

---

## Notifications & Alerts

### Get User Notifications
```http
GET /api/notifications?limit=20&offset=0&unreadOnly=true
Authorization: Required
```

**Response:**
```json
{
  "notifications": [
    {
      "id": 1,
      "type": "document_verified",
      "title": "Document Verified",
      "message": "Your paystub has been verified and approved",
      "isRead": false,
      "priority": "normal",
      "createdAt": "2025-10-14T10:30:00Z",
      "link": "/documents/123"
    }
  ],
  "total": 15,
  "unreadCount": 8
}
```

### Mark Notification as Read
```http
PATCH /api/notifications/:id/read
Authorization: Required
```

### Mark All as Read
```http
POST /api/notifications/mark-all-read
Authorization: Required
```

### Get Notification Preferences
```http
GET /api/notifications/preferences
Authorization: Required
```

**Response:**
```json
{
  "channels": {
    "inApp": true,
    "email": true,
    "sms": false
  },
  "types": {
    "documentUpdates": true,
    "applicationStatus": true,
    "systemAlerts": false
  },
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00"
  }
}
```

### Update Notification Preferences
```http
PATCH /api/notifications/preferences
Authorization: Required
Content-Type: application/json

{
  "channels": {
    "email": false
  },
  "quietHours": {
    "enabled": true,
    "start": "23:00",
    "end": "07:00"
  }
}
```

### WebSocket Connection for Real-Time Notifications
```
WSS /api/notifications/stream
Authorization: Required (via session cookie)
```

**Message Format:**
```json
{
  "type": "notification",
  "data": {
    "id": 42,
    "type": "application_approved",
    "title": "Application Approved!",
    "message": "Your SNAP application has been approved",
    "priority": "high"
  }
}
```

---

## Cross-Enrollment Management

### Get Cross-Enrollment Opportunities
```http
GET /api/cross-enrollment/opportunities/:userId
Authorization: Required (Navigator+)
```

**Response:**
```json
{
  "opportunities": [
    {
      "program": "Medicaid",
      "estimatedBenefit": "Full coverage",
      "eligibilityScore": 95,
      "reasoning": "Income qualifies based on SNAP approval",
      "requiredDocuments": ["Proof of income", "ID"],
      "applicationLink": "/apply/medicaid"
    }
  ]
}
```

### Track Enrollment Success
```http
POST /api/cross-enrollment/track
Authorization: Required (Navigator+)
Content-Type: application/json

{
  "userId": 42,
  "sourceProgram": "SNAP",
  "targetProgram": "Medicaid",
  "outcome": "enrolled",
  "enrollmentDate": "2025-10-14"
}
```

### Get Enrollment Analytics
```http
GET /api/cross-enrollment/analytics?startDate=2025-01-01&endDate=2025-10-14
Authorization: Required (Admin+)
```

**Response:**
```json
{
  "successRate": 68.5,
  "programPairs": [
    {
      "from": "SNAP",
      "to": "Medicaid",
      "successRate": 72.3,
      "totalAttempts": 450,
      "successfulEnrollments": 325
    }
  ],
  "commonBarriers": [
    {"barrier": "missing_documentation", "count": 85},
    {"barrier": "eligibility_gap", "count": 42}
  ],
  "totalBenefitValue": 2850000
}
```

### Configure Enrollment Pipeline
```http
POST /api/cross-enrollment/pipelines
Authorization: Required (Admin+)
Content-Type: application/json

{
  "sourceProgram": "SNAP",
  "targetProgram": "Medicaid",
  "autoRecommend": true,
  "requiredDocuments": ["proof_of_income", "id"],
  "eligibilityThreshold": 80
}
```

---

## Public Portal Additional Endpoints

### Generate Document Checklist
```http
POST /api/public/generate-checklist
Content-Type: application/json

{
  "programs": ["SNAP", "Medicaid"],
  "householdSize": 3,
  "hasChildren": true,
  "hasElderly": false
}
```

**Response:**
```json
{
  "checklist": [
    {
      "category": "Identity Verification",
      "documents": [
        {"name": "Driver's License or State ID", "required": true, "alternatives": ["Passport", "Birth Certificate"]},
        {"name": "Social Security Cards for all members", "required": true}
      ]
    },
    {
      "category": "Income Verification",
      "documents": [
        {"name": "Last 30 days of paystubs", "required": true},
        {"name": "Self-employment records (if applicable)", "required": false}
      ]
    }
  ],
  "pdfDownloadUrl": "/api/public/checklist/download/abc123"
}
```

### Quick Screener (No Auth)
```http
POST /api/public/quick-screen
Content-Type: application/json

{
  "householdSize": 3,
  "monthlyIncome": 2500,
  "hasAssets": false,
  "location": "Baltimore City",
  "hasElderlyOrDisabled": false
}
```

**Response:**
```json
{
  "mayQualify": true,
  "suggestedPrograms": ["SNAP", "Medicaid"],
  "nextSteps": "Create an account to start your full application",
  "createAccountUrl": "/signup"
}
```

---

## Rate Limiting

All endpoints are rate-limited to prevent abuse:

| Tier | Limit | Window |
|------|-------|--------|
| Public | 100 requests | 15 minutes |
| Authenticated | 1000 requests | 15 minutes |
| Admin | 5000 requests | 15 minutes |

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 850
X-RateLimit-Reset: 1698789600
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Validation Error",
  "message": "Invalid household size",
  "details": {
    "field": "householdSize",
    "constraint": "Must be between 1 and 20"
  },
  "statusCode": 400
}
```

---

## WebSocket Notifications

Real-time notifications are delivered via WebSocket at `/ws/notifications`.

### Connection
```javascript
const ws = new WebSocket('wss://your-domain.replit.app/ws/notifications');

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('Received:', notification);
};
```

### Message Format
```json
{
  "type": "notification",
  "data": {
    "id": 42,
    "type": "policy_change",
    "title": "New SNAP Policy",
    "message": "Income limits updated",
    "priority": "high"
  }
}
```

---

## Security

### CSRF Protection
All POST, PUT, PATCH, DELETE requests require CSRF tokens:

```http
POST /api/documents
X-CSRF-Token: abc123...
```

### Authentication
Session cookies are HTTP-only and secure in production:

```
Set-Cookie: sessionId=xyz; HttpOnly; Secure; SameSite=Strict
```

### Headers
All responses include security headers:

```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000
```

---

## Testing

### Demo Accounts

For testing, use the pre-seeded demo accounts:

| Username | Password | Role |
|----------|----------|------|
| demo.applicant | Demo2024! | user |
| demo.navigator | Demo2024! | navigator |
| demo.caseworker | Demo2024! | caseworker |
| demo.admin | Demo2024! | admin |

---

## Changelog

### Version 2.0 (October 2025)
- Added multi-program support (7 programs)
- PolicyEngine integration
- Bulk document actions
- Email notifications
- Export reports (PDF/CSV)
- Intake copilot
- Scenario workspace
- Compliance suite

### Version 1.0 (Initial Release)
- Basic RAG search
- Document verification
- Navigator workspace
- Authentication system

---

## Support

For API support, contact:
- **Technical Issues:** dev-team@maryland.gov
- **Access Requests:** admin@marylandbenefits.gov
- **Documentation:** https://docs.marylandbenefits.gov

---

*This API documentation is maintained by the JAWN development team.*

---

## Additional API Endpoints (Previously Undocumented)

The following sections document API endpoints discovered during the January 2026 comprehensive audit.

---

## Benefits Navigation API

Cross-enrollment analysis and strategic recommendations.

### Analyze Benefits
```http
POST /api/benefits-navigation/analyze
Authorization: Required
Content-Type: application/json
```

### Get Case Analysis
```http
GET /api/benefits-navigation/case/:caseId
Authorization: Required
```

### Quick Wins Recommendations
```http
POST /api/benefits-navigation/quick-wins
Authorization: Required
```

### Strategic Analysis
```http
POST /api/benefits-navigation/strategic
Authorization: Required
```

---

## Cross-Enrollment Intelligence API

AI-powered cross-program enrollment recommendations.

### Analyze Tax for Benefits
```http
POST /api/cross-enrollment/analyze-tax
Authorization: Required
```

### Analyze Benefits Cross-Enrollment
```http
POST /api/cross-enrollment/analyze-benefits
Authorization: Required
```

### Full Analysis
```http
POST /api/cross-enrollment/full-analysis
Authorization: Required
```

### High Priority Recommendations
```http
POST /api/cross-enrollment/high-priority
Authorization: Required
```

### Auto-Eligible Programs
```http
POST /api/cross-enrollment/auto-eligible
Authorization: Required
```

### By Category
```http
POST /api/cross-enrollment/by-category/:category
Authorization: Required
```

### Navigator Notes
```http
POST /api/cross-enrollment/navigator-notes
Authorization: Required
```

---

## Decision Points API

Track renewal deadlines, cliff effects, and intervention opportunities.

### Scan Decision Points
```http
GET /api/decision-points/scan
Authorization: Required (caseworker, supervisor, admin)
```

### Get Case Decision Points
```http
GET /api/decision-points/case/:caseId
Authorization: Required
```

### Get Critical Decision Points
```http
GET /api/decision-points/critical
Authorization: Required
```

### Get Renewals
```http
GET /api/decision-points/renewals
Authorization: Required
```

### Get Cliff Effects
```http
GET /api/decision-points/cliff-effects
Authorization: Required
```

### Intervene
```http
POST /api/decision-points/intervene/:pointId
Authorization: Required (caseworker, supervisor)
```

### Get Interventions
```http
GET /api/decision-points/interventions
Authorization: Required
```

---

## Info Cost Reduction API

Policy simplification and translation services.

### Simplify Text
```http
POST /api/info-cost-reduction/simplify
Authorization: Required
```

### Explain Policy
```http
POST /api/info-cost-reduction/explain
Authorization: Required
```

### Generate Decision Tree
```http
POST /api/info-cost-reduction/decision-tree
Authorization: Required
```

### Translate
```http
POST /api/info-cost-reduction/translate
Authorization: Required
```

### Get Metrics
```http
GET /api/info-cost-reduction/metrics
Authorization: Required
```

### Batch Simplify
```http
POST /api/info-cost-reduction/batch-simplify
Authorization: Required
```

### Get Confusing Terms
```http
GET /api/info-cost-reduction/confusing-terms
Authorization: Required
```

---

## MAIVE Testing API

Model AI Validation and Evaluation test suite.

### Create Test Cases
```http
POST /api/maive/test-cases
Authorization: Required (admin)
```

### Get Test Cases
```http
GET /api/maive/test-cases
Authorization: Required
```

### Run Test Suite
```http
POST /api/maive/run-suite
Authorization: Required (admin)
```

### Get Test Run
```http
GET /api/maive/test-runs/:runId
Authorization: Required
```

### Get All Test Runs
```http
GET /api/maive/test-runs
Authorization: Required
```

### Get Trends
```http
GET /api/maive/trends
Authorization: Required
```

---

## QC Analytics API

Quality control metrics and caseworker performance analytics.

### Get QC Metrics
```http
GET /api/qc-analytics/metrics
Authorization: Required
```

### Get Error Patterns
```http
GET /api/qc-analytics/patterns
Authorization: Required
```

### Get Case QC Data
```http
GET /api/qc-analytics/case/:caseId
Authorization: Required
```

### Get Flagged Cases
```http
GET /api/qc-analytics/flagged-cases
Authorization: Required
```

### Get Caseworker Analytics
```http
GET /api/qc-analytics/caseworker/:caseworkerId
Authorization: Required (supervisor, admin)
```

### Get All Caseworkers
```http
GET /api/qc-analytics/caseworkers
Authorization: Required (supervisor, admin)
```

### Get Training Recommendations
```http
GET /api/qc-analytics/training
Authorization: Required
```

### Refresh Analytics
```http
POST /api/qc-analytics/refresh
Authorization: Required (supervisor, admin)
```

---

## Maryland E-File API

State-specific electronic filing for Maryland Form 502.

### Submit E-File
```http
POST /api/maryland-efile/submit/:id
```

### Get E-File Status
```http
GET /api/maryland-efile/status/:id
```

### Validate E-File
```http
POST /api/maryland-efile/validate/:id
```

### Get XML
```http
GET /api/maryland-efile/xml/:id
```

### Retry E-File
```http
POST /api/maryland-efile/retry/:id
```

---

## Legal Ontology API

Manage legal ontology terms and relationships.

### List Terms
```http
GET /api/legal-ontology/terms
Authorization: Required
```

### Get Term
```http
GET /api/legal-ontology/terms/:id
Authorization: Required
```

### Create Term
```http
POST /api/legal-ontology/terms
Authorization: Required (admin)
```

### Update Term
```http
PATCH /api/legal-ontology/terms/:id
Authorization: Required (admin)
```

### Delete Term
```http
DELETE /api/legal-ontology/terms/:id
Authorization: Required (admin)
```

### Find Similar Terms
```http
POST /api/legal-ontology/terms/similar
Authorization: Required
```

### Get Relationships
```http
GET /api/legal-ontology/relationships
Authorization: Required
```

### Create Relationship
```http
POST /api/legal-ontology/relationships
Authorization: Required (admin)
```

### Traverse Graph
```http
GET /api/legal-ontology/graph/traverse
Authorization: Required
```

### Get Stats
```http
GET /api/legal-ontology/stats
Authorization: Required
```

### Seed Ontology
```http
POST /api/legal-ontology/seed
Authorization: Required (admin)
```

---

## Case Assertion API

Z3 solver integration for case eligibility proofs.

### Get Assertion Stats
```http
GET /api/case-assertion/stats
Authorization: Required
```

### Get Case Assertions
```http
GET /api/case-assertion/case/:caseId
Authorization: Required
```

### Get Program Assertions
```http
GET /api/case-assertion/case/:caseId/program
Authorization: Required
```

### Get Z3 Results
```http
GET /api/case-assertion/case/:caseId/z3
Authorization: Required
```

### Create Assertion
```http
POST /api/case-assertion
Authorization: Required
```

### Create from Household
```http
POST /api/case-assertion/from-household
Authorization: Required
```

### Verify Assertion
```http
PATCH /api/case-assertion/:assertionId/verify
Authorization: Required (admin, supervisor)
```

### Delete Case Assertions
```http
DELETE /api/case-assertion/case/:caseId
Authorization: Required (admin)
```

---

## Z3 Solver API

Formal verification solver endpoints.

### Get Solver Stats
```http
GET /api/z3-solver/stats
Authorization: Required
```

### Run Solver
```http
GET /api/z3-solver/run/:solverRunId
Authorization: Required
```

### Get Visualization
```http
GET /api/z3-solver/visualization/:solverRunId
Authorization: Required
```

### Generate Narrative
```http
POST /api/z3-solver/narrative
Authorization: Required
```

### Generate Due Process Notice
```http
POST /api/z3-solver/due-process-notice/:solverRunId
Authorization: Required
```

### Generate Report
```http
POST /api/z3-solver/generate/:solverRunId
Authorization: Required
```

---

## Phone System API

Twilio integration for voice calls and IVR.

### Initiate Call
```http
POST /api/phone-system/call/initiate
Authorization: Required
```

### Get Call Status
```http
GET /api/phone-system/call/status/:callId
Authorization: Required
```

### End Call
```http
POST /api/phone-system/call/end
Authorization: Required
```

### Hold Call
```http
POST /api/phone-system/call/hold
Authorization: Required
```

### Resume Call
```http
POST /api/phone-system/call/resume
Authorization: Required
```

### Transfer Call
```http
POST /api/phone-system/call/transfer
Authorization: Required
```

### Configure IVR
```http
POST /api/phone-system/ivr/configure
Authorization: Required
```

### Get IVR Menus
```http
GET /api/phone-system/ivr/menus
Authorization: Required
```

### Recording Consent
```http
POST /api/phone-system/recording/consent
Authorization: Required
```

### Start Recording
```http
POST /api/phone-system/recording/start
Authorization: Required
```

### Twilio Webhooks
```http
POST /api/phone-system/twilio/voice-webhook
POST /api/phone-system/twilio/status-webhook
```

---

## Provision Mapping API

Human-in-the-loop legislative change integration.

### Extract Provisions
```http
POST /api/provisions/extract/:publicLawId
Authorization: Required
```

### Get Provisions
```http
GET /api/provisions/:publicLawId
Authorization: Required
```

### Match Provision to Ontology
```http
POST /api/provisions/match/:provisionId
Authorization: Required
```

### Process Law
```http
POST /api/provisions/process-law/:publicLawId
Authorization: Required
```

---

## PER (Payment Error Reduction) API

SNAP payment error prevention and monitoring.

### Get PER Metrics
```http
GET /api/per/per-metrics
Authorization: Required
```

### Get Income Verification Stats
```http
GET /api/per/income-verification/stats
Authorization: Required
```

### Get Pending Verifications
```http
GET /api/per/income-verification/pending
Authorization: Required
```

### Verify Income
```http
POST /api/per/income-verification/:caseId
Authorization: Required
```

### Resolve Verification
```http
POST /api/per/income-verification/:id/resolve
Authorization: Required
```

### Get Duplicate Stats
```http
GET /api/per/duplicates/stats
Authorization: Required
```

### Get Pending Duplicates
```http
GET /api/per/duplicates/pending
Authorization: Required
```

### Scan for Duplicates
```http
POST /api/per/duplicates/scan/:caseId
Authorization: Required
```

### Resolve Duplicate
```http
POST /api/per/duplicates/:id/resolve
Authorization: Required
```

### Get Nudge Effectiveness
```http
GET /api/per/nudges/effectiveness
Authorization: Required
```

### Get High Priority Nudges
```http
GET /api/per/nudges/high-priority
Authorization: Required
```

### Get Pending Nudges
```http
GET /api/per/nudges/pending
Authorization: Required
```

### Generate Nudges
```http
POST /api/per/nudges/generate/:caseId
Authorization: Required
```

### Record Nudge Action
```http
POST /api/per/nudges/:id/action
Authorization: Required
```

### Record Nudge View
```http
POST /api/per/nudges/:id/view
Authorization: Required
```

### Get PERM Progress
```http
GET /api/per/perm/progress
Authorization: Required
```

### Get PERM Report
```http
GET /api/per/perm/report
Authorization: Required
```

### Get Pending PERM Samples
```http
GET /api/per/perm/samples/pending
Authorization: Required
```

### Create PERM Sample
```http
POST /api/per/perm/sample
Authorization: Required
```

### Submit PERM Findings
```http
POST /api/per/perm/samples/:id/findings
Authorization: Required
```

---

## External Data Integration API

External system data verification and mapping.

### Verify Wages
```http
POST /api/external-data/verify-wages
Authorization: Required
```

### Employment Lookup
```http
POST /api/external-data/employment-lookup
Authorization: Required
```

### Cross-Reference
```http
POST /api/external-data/cross-reference
Authorization: Required
```

### Batch Verify
```http
POST /api/external-data/batch-verify
Authorization: Required
```

### Map to E&E
```http
POST /api/external-data/map-to-ee
Authorization: Required
```

### Get E&E Mapping
```http
GET /api/external-data/ee-mapping
Authorization: Required
```

---

## Multi-State Portability API

Interstate benefits coordination.

### Check Portability
```http
POST /api/portability/portability
Authorization: Required
```

### Move Timing Analysis
```http
POST /api/portability/move-timing
Authorization: Required
```

### Pre-Move Checklist
```http
POST /api/portability/pre-move-checklist
Authorization: Required
```

### Post-Move Checklist
```http
POST /api/portability/post-move-checklist
Authorization: Required
```

### Get Neighbors
```http
GET /api/portability/neighbors/:state/:program
Authorization: Required
```

### Check Reciprocity
```http
GET /api/portability/reciprocity/:program
Authorization: Required
```

### Get Border Counties
```http
GET /api/portability/border-county/:county
Authorization: Required
```

---

## Supervisor Dashboard API

Quality assurance and caseworker oversight.

### Get Supervisor Dashboard
```http
GET /api/supervisor/dashboard
Authorization: Required (supervisor, admin)
```

### Get Coaching Queue
```http
GET /api/supervisor/coaching-queue
Authorization: Required (supervisor, admin)
```

### Get Nudge Compliance
```http
GET /api/supervisor/nudge-compliance
Authorization: Required (supervisor, admin)
```

### Get Error Drill-Down
```http
GET /api/supervisor/error-drill-down/:checkType
Authorization: Required (supervisor, admin)
```

### Get Training Impact
```http
GET /api/supervisor/training-impact
Authorization: Required (supervisor, admin)
```

### Get Z3 Reviews
```http
GET /api/supervisor/z3-reviews
Authorization: Required (supervisor, admin)
```

### Get Solutions Hub
```http
GET /api/supervisor/solutions-hub
Authorization: Required (supervisor, admin)
```

### Coaching Action
```http
POST /api/supervisor/coaching-action/:nudgeId
Authorization: Required (supervisor, admin)
```

---

## Proactive Messaging API

Automated client outreach.

### Get Templates
```http
GET /api/proactive-messaging/templates
Authorization: Required
```

### Send Message
```http
POST /api/proactive-messaging/send
Authorization: Required
```

### Batch Send
```http
POST /api/proactive-messaging/batch
Authorization: Required
```

---

## Training Interventions API

Staff training recommendations and tracking.

### Get Training Interventions
```http
GET /api/training/training-interventions
Authorization: Required
```

### Create Training Intervention
```http
POST /api/training/training-interventions
Authorization: Required
```

---

*For version history, see [CHANGELOG.md](../CHANGELOG.md)*
