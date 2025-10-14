# Maryland Multi-Program Benefits Navigator API Documentation

**Version:** 2.0  
**Last Updated:** October 2025  
**Base URL:** `https://your-domain.replit.app/api`

This document provides comprehensive documentation for all API endpoints in the Maryland Multi-Program Benefits Navigator System.

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
  "query": "What are the income limits for SNAP in Maryland?",
  "programCode": "MD_SNAP",
  "searchMode": "hybrid",
  "topK": 5
}
```

**Response:**
```json
{
  "query": "What are the income limits for SNAP in Maryland?",
  "response": "For Maryland SNAP (Food Supplement Program), income limits vary by household size...",
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
    "documentType": "Maryland Driver's License",
    "expirationDate": "2028-03-15",
    "name": "John Doe"
  },
  "explanation": "This is a valid Maryland driver's license that can be used for identity verification.",
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
    "name": "Maryland SNAP (Food Supplement Program)",
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
  "batchName": "October 2025 Enrollments",
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
  "generatedText": "Maryland SNAP Income Limits (FY 2026)\n\nIncome limits determine who qualifies for SNAP benefits. These limits are based on household size and gross monthly income...",
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
    "title": "Maryland SNAP Information Sharing Consent",
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
  "title": "Maryland SNAP Information Sharing Consent",
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
  "title": "Maryland SNAP Information Sharing Consent",
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
  "query": "How do I renew my SNAP benefits?"
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

*This API documentation is maintained by the Maryland Department of Human Services Technology Team.*
