# DHS System Integration Guide

## Overview

This guide documents the Maryland Multi-Program Benefits Navigator System's integration strategy with existing Maryland Department of Human Services (DHS) infrastructure. The system architecture follows the **Maryland Replaceability Principle**, ensuring all components can be seamlessly swapped with DHS systems without vendor lock-in.

**Integration Philosophy:** Prove value in pilot, then integrate into DHS infrastructure with component-by-component replacement.

---

## Table of Contents

1. [Maryland Replaceability Principle](#maryland-replaceability-principle)
2. [Integration Architecture](#integration-architecture)
3. [E&E Export Infrastructure](#ee-export-infrastructure)
4. [Data Exchange Formats](#data-exchange-formats)
5. [Component Replacement Strategy](#component-replacement-strategy)
6. [API Integration Points](#api-integration-points)
7. [Data Migration](#data-migration)
8. [Security & Compliance](#security--compliance)
9. [Testing & Validation](#testing--validation)
10. [Rollout Strategy](#rollout-strategy)

---

## Maryland Replaceability Principle

### Core Design Philosophy

**Definition:** All system components are designed to be **swappable with existing DHS systems**, ensuring seamless integration and preventing vendor lock-in.

### Key Principles

1. **Standards-Based Integration**
   - RESTful API architecture
   - Industry-standard data formats (CSV, JSON, XML)
   - Open protocols and specifications
   - Well-documented interfaces

2. **Modular Component Design**
   - Loosely coupled services
   - Clear separation of concerns
   - Replaceable building blocks
   - Minimal dependencies

3. **Data Portability**
   - Export in multiple formats
   - No proprietary data structures
   - Schema documentation
   - Migration tools

4. **Vendor Neutrality**
   - No lock-in to specific vendors
   - Open-source where possible
   - Configurable service providers
   - Swappable AI/ML models

### Replacement Roadmap

```
┌─────────────────────────────────────────────────────────────┐
│                    PILOT PHASE                              │
│          Maryland Benefits Navigator (Standalone)           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Gemini Vision│  │ PolicyEngine │  │   E&E Export │     │
│  │    (RAG)     │  │  (Benefits)  │  │  (Navigator) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               INTEGRATION PHASE                             │
│         Component-by-Component Replacement                  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  DHS Vision  │  │  DHS Benefit │  │  DHS E&E     │     │
│  │   AI Model   │  │  Calculator  │  │   System     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Architecture

### System Overview

```
┌────────────────────────────────────────────────────┐
│         Maryland Benefits Navigator                │
│                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │  Navigator   │  │   Document   │  │   RAG   │ │
│  │  Workspace   │  │ Verification │  │ Search  │ │
│  └──────┬───────┘  └──────┬───────┘  └────┬────┘ │
│         │                  │               │      │
└─────────┼──────────────────┼───────────────┼──────┘
          │                  │               │
          │                  │               │
          ▼                  ▼               ▼
┌─────────────────────────────────────────────────────┐
│            DHS Integration Layer                    │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  E&E Export  │  │   Document   │  │  Policy  │ │
│  │  (CSV/JSON)  │  │  Management  │  │  Engine  │ │
│  └──────┬───────┘  └──────┬───────┘  └────┬─────┘ │
└─────────┼──────────────────┼───────────────┼───────┘
          │                  │               │
          ▼                  ▼               ▼
┌─────────────────────────────────────────────────────┐
│         Existing DHS Infrastructure                 │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  Eligibility │  │  Document    │  │  Benefit │ │
│  │  & Enrollment│  │   Storage    │  │   Calc   │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────┘
```

### Integration Points

| Component | Navigator System | DHS System | Integration Method |
|-----------|-----------------|------------|-------------------|
| **Case Management** | Navigator Workspace | E&E System | CSV/JSON/XML Export |
| **Document Verification** | Gemini Vision | DHS Document Mgmt | API Upload |
| **Benefit Calculation** | PolicyEngine | DHS Calculator | API Proxy |
| **Policy Search** | RAG + Gemini | DHS Knowledge Base | Data Sync |
| **User Authentication** | Passport.js | DHS SSO | SAML/OAuth2 |
| **Audit Logging** | PostgreSQL | DHS Audit System | Log Forwarding |

---

## E&E Export Infrastructure

### Overview

The **Eligibility & Enrollment (E&E) Export** infrastructure enables seamless data transfer from the Navigator Workspace to existing DHS E&E systems.

### Database Schema

**Export Batch Tracking:**
```sql
CREATE TABLE ee_export_batches (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type TEXT NOT NULL,         -- 'daily', 'weekly', 'manual'
  session_count INTEGER NOT NULL,
  export_format TEXT NOT NULL,        -- 'csv', 'json', 'xml'
  file_path TEXT,
  file_size INTEGER,
  exported_by VARCHAR REFERENCES users(id) NOT NULL,
  exported_at TIMESTAMP DEFAULT NOW() NOT NULL,  -- Batch creation time
  uploaded_to_ee BOOLEAN DEFAULT false NOT NULL,
  uploaded_at TIMESTAMP,              -- E&E upload timestamp
  upload_confirmation TEXT,
  notes TEXT
);
-- Note: ID columns use VARCHAR with gen_random_uuid() for UUID values
```

**Session Export Tracking:**
```sql
-- Fields in client_interaction_sessions table
exported_to_ee BOOLEAN DEFAULT false NOT NULL,
exported_at TIMESTAMP,
export_batch_id VARCHAR;
-- Note: export_batch_id does not have a foreign key constraint
```

### API Endpoints

**1. List Export Batches**
```http
GET /api/navigator/exports
Authorization: Bearer <staff-token>
```

**Response:**
```json
[
  {
    "id": "batch-123",
    "exportType": "manual",
    "sessionCount": 42,
    "exportFormat": "csv",
    "filePath": "/exports/ee-export-batch-123.csv",
    "fileSize": 15360,
    "exportedBy": "user-456",
    "exportedAt": "2025-01-10T14:00:00Z",
    "uploadedToEE": true,
    "uploadedAt": "2025-01-10T15:30:00Z",
    "uploadConfirmation": "E&E-CONF-789",
    "notes": null
  }
]
```

**2. Create Export Batch**
```http
POST /api/navigator/exports
Authorization: Bearer <staff-token>
Content-Type: application/json

{
  "exportType": "manual",
  "exportFormat": "csv"
}
```

**Response:**
```json
{
  "id": "batch-124",
  "exportType": "manual",
  "sessionCount": 15,
  "exportFormat": "csv",
  "filePath": null,
  "fileSize": null,
  "exportedBy": "current-user-id",
  "exportedAt": "2025-01-10T16:00:00Z",
  "uploadedToEE": false,
  "uploadedAt": null,
  "uploadConfirmation": null,
  "notes": null
}
```

**3. Download Export File**
```http
GET /api/navigator/exports/:id/download
Authorization: Bearer <staff-token>
```

**Response Headers:**
```http
Content-Type: text/csv
Content-Disposition: attachment; filename="ee-export-batch-124.csv"
```

### Export Formats

#### CSV Format (Recommended for E&E Systems)

**Headers:**
```csv
Session ID,Client Case ID,Session Type,Date,Duration (min),Location,Outcome,Topics,Action Items,Notes
```

**Sample Row:**
```csv
"sess-123","case-456","In-Person","2025-01-10T10:00:00Z","45","Downtown Office","Application Submitted","[""SNAP"",""Medicaid""]","[""Follow up on income docs""]","Client needs help with recertification"
```

**Field Specifications:**
- **Session ID:** UUID, unique identifier
- **Client Case ID:** Case number from E&E system (if linked)
- **Session Type:** `In-Person`, `Phone`, `Video`, `Email`, `Walk-In`
- **Date:** ISO 8601 timestamp
- **Duration:** Integer (minutes)
- **Location:** Office name or virtual platform
- **Outcome:** `Application Submitted`, `Info Provided`, `Referred`, `Incomplete`
- **Topics:** JSON array of benefit programs discussed
- **Action Items:** JSON array of follow-up tasks
- **Notes:** Free text, quotes escaped

#### JSON Format (Structured Data)

```json
{
  "exportBatch": {
    "id": "batch-124",
    "exportDate": "2025-01-10T16:00:00Z",
    "sessionCount": 15
  },
  "sessions": [
    {
      "id": "sess-123",
      "clientCaseId": "case-456",
      "sessionType": "In-Person",
      "interactionDate": "2025-01-10T10:00:00Z",
      "durationMinutes": 45,
      "location": "Downtown Office",
      "outcomeStatus": "Application Submitted",
      "topicsDiscussed": ["SNAP", "Medicaid"],
      "actionItems": ["Follow up on income docs"],
      "notes": "Client needs help with recertification",
      "navigator": {
        "id": "user-789",
        "name": "Jane Smith",
        "email": "jsmith@maryland.gov"
      }
    }
  ]
}
```

#### XML Format (Legacy System Compatibility)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<EEExport>
  <ExportBatch id="batch-124" exportDate="2025-01-10T16:00:00Z" sessionCount="15" />
  <Sessions>
    <Session id="sess-123">
      <ClientCaseId>case-456</ClientCaseId>
      <SessionType>In-Person</SessionType>
      <InteractionDate>2025-01-10T10:00:00Z</InteractionDate>
      <DurationMinutes>45</DurationMinutes>
      <Location>Downtown Office</Location>
      <OutcomeStatus>Application Submitted</OutcomeStatus>
      <TopicsDiscussed>
        <Topic>SNAP</Topic>
        <Topic>Medicaid</Topic>
      </TopicsDiscussed>
      <ActionItems>
        <Item>Follow up on income docs</Item>
      </ActionItems>
      <Notes>Client needs help with recertification</Notes>
      <Navigator id="user-789" name="Jane Smith" email="jsmith@maryland.gov" />
    </Session>
  </Sessions>
</EEExport>
```

### Export Workflow

**Step 1: Navigator Completes Session**
```typescript
// Navigator logs client interaction
POST /api/navigator/sessions
{
  "clientCaseId": "case-456",
  "sessionType": "In-Person",
  "topicsDiscussed": ["SNAP", "Medicaid"],
  // ... session details
}
```

**Step 2: System Tracks Unexported Sessions**
```sql
SELECT * FROM client_interaction_sessions
WHERE exported_to_ee = false
ORDER BY interaction_date DESC;
```

**Step 3: Create Export Batch (Manual or Scheduled)**
```typescript
// Manual export by staff
POST /api/navigator/exports
{
  "exportType": "manual",
  "exportFormat": "csv"
}

// OR scheduled export (daily cron)
0 2 * * * curl -X POST http://localhost:5000/api/navigator/exports \
  -H "Authorization: Bearer $SYSTEM_TOKEN" \
  -d '{"exportType":"daily","exportFormat":"csv"}'
```

**Step 4: Download Export File**
```bash
# Staff downloads export
curl -H "Authorization: Bearer $STAFF_TOKEN" \
  https://benefits.maryland.gov/api/navigator/exports/batch-124/download \
  -o ee-export-batch-124.csv
```

**Step 5: Upload to E&E System**
```bash
# Staff uploads to DHS E&E system (manual or automated)
# Example: SFTP upload to E&E server
sftp dhs-ee-server
put ee-export-batch-124.csv /incoming/navigator-exports/

# OR automated integration
curl -X POST https://ee.dhs.maryland.gov/api/import \
  -F "file=@ee-export-batch-124.csv" \
  -H "Authorization: Bearer $EE_API_KEY"
```

**Step 6: Confirm Upload**
```http
PATCH /api/navigator/exports/batch-124
{
  "uploadedToEE": true,
  "uploadConfirmation": "E&E-CONF-789"
}
```

### Automated Export Configuration

**Daily Export (Recommended):**
```yaml
# .replit or cron job
schedule:
  - name: Daily E&E Export
    cron: "0 2 * * *"  # 2 AM daily
    command: |
      curl -X POST http://localhost:5000/api/navigator/exports \
        -H "Authorization: Bearer $SYSTEM_TOKEN" \
        -d '{"exportType":"daily","exportFormat":"csv"}' \
        -o /tmp/daily-export.csv
      
      # Upload to E&E SFTP server
      sftp -b - dhs-ee-server <<EOF
      put /tmp/daily-export.csv /incoming/navigator-exports/daily-$(date +%Y%m%d).csv
      EOF
```

**Weekly Batch Export:**
```yaml
schedule:
  - name: Weekly E&E Export
    cron: "0 3 * * 0"  # 3 AM Sunday
    command: |
      curl -X POST http://localhost:5000/api/navigator/exports \
        -H "Authorization: Bearer $SYSTEM_TOKEN" \
        -d '{"exportType":"weekly","exportFormat":"json"}'
```

---

## Data Exchange Formats

### Supported Formats

| Format | Use Case | Advantages | Limitations |
|--------|----------|------------|-------------|
| **CSV** | Bulk data import/export | Universal compatibility, Excel support | Limited nesting, encoding issues |
| **JSON** | API integration, web apps | Rich structure, easy parsing | Larger file size |
| **XML** | Legacy system compatibility | SOAP integration, validation | Verbose, harder to read |

### Format Selection Guidelines

**Use CSV when:**
- Importing into Excel or Access
- Legacy E&E system expects flat files
- Simple tabular data
- Maximum compatibility required

**Use JSON when:**
- Modern API integration
- Complex nested data structures
- Web application consumption
- Real-time data exchange

**Use XML when:**
- Legacy SOAP services
- XML Schema validation required
- Government standard compliance (e.g., NIEM)
- Document-centric data

### Data Mapping Specifications

**Navigator → E&E Field Mapping:**

| Navigator Field | E&E System Field | Data Type | Required | Transform |
|----------------|------------------|-----------|----------|-----------|
| `id` | `SESSION_ID` | UUID → VARCHAR(36) | Yes | None |
| `clientCaseId` | `CASE_NUMBER` | VARCHAR(20) | No | None |
| `sessionType` | `INTERACTION_TYPE` | ENUM → VARCHAR(20) | Yes | Map to E&E codes |
| `interactionDate` | `CONTACT_DATE` | TIMESTAMP → DATE | Yes | Extract date only |
| `durationMinutes` | `DURATION_MIN` | INTEGER | No | None |
| `outcomeStatus` | `OUTCOME_CODE` | ENUM → CHAR(2) | Yes | Map to outcome codes |
| `topicsDiscussed` | `PROGRAMS_DISCUSSED` | JSON → VARCHAR(255) | No | Join array with `;` |

**Outcome Code Mapping:**
```typescript
const outcomeCodeMap = {
  'Application Submitted': 'AS',
  'Info Provided': 'IP',
  'Referred to Services': 'RF',
  'Incomplete - Follow Up Needed': 'IN',
  'No Action Required': 'NA'
};
```

---

## Component Replacement Strategy

### Swappable Components

#### 1. Document Verification (Gemini Vision → DHS Vision AI)

**Current Implementation:**
```typescript
// server/services/ai.service.ts
async analyzeDocumentWithVision(imageData: Buffer): Promise<AnalysisResult> {
  const response = await geminiClient.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ parts: [{ inlineData: { mimeType: "image/jpeg", data: imageData }}]}]
  });
  return parseAnalysis(response);
}
```

**Replacement with DHS Vision API:**
```typescript
// server/services/dhs-vision.service.ts
async analyzeDocumentWithVision(imageData: Buffer): Promise<AnalysisResult> {
  const response = await dhsVisionClient.post('/analyze', {
    image: imageData.toString('base64'),
    documentType: 'PROOF_OF_INCOME'
  });
  return parseDHSAnalysis(response.data);
}
```

**Migration Steps:**
1. Update environment variable: `DHS_VISION_API_URL`
2. Implement DHS API adapter in `server/services/dhs-vision.service.ts`
3. Update `server/services/ai.service.ts` to use DHS adapter
4. Test with sample documents
5. Gradual rollout with A/B testing

#### 2. Benefit Calculation (PolicyEngine → DHS Calculator)

**Current Implementation:**
```typescript
// server/services/policyengine.service.ts
async calculateBenefits(household: HouseholdData): Promise<BenefitEstimate> {
  const response = await fetch('https://api.policyengine.org/us/calculate', {
    method: 'POST',
    body: JSON.stringify({ household })
  });
  return response.json();
}
```

**Replacement with DHS Calculator:**
```typescript
// server/services/dhs-calculator.service.ts
async calculateBenefits(household: HouseholdData): Promise<BenefitEstimate> {
  const dhsPayload = transformToDHSFormat(household);
  const response = await dhsCalculatorClient.post('/calculate', dhsPayload);
  return transformFromDHSFormat(response.data);
}
```

**Migration Steps:**
1. Map PolicyEngine household format to DHS calculator format
2. Create transformation utilities (`transformToDHSFormat`, `transformFromDHSFormat`)
3. Implement DHS calculator service
4. Update calculation routes to use DHS calculator
5. Validate with test cases from Evaluation Framework

#### 3. Policy Search (RAG + Gemini → DHS Knowledge Base)

**Current Implementation:**
```typescript
// server/services/rag.service.ts
async searchPolicy(query: string): Promise<SearchResult[]> {
  const embedding = await geminiClient.embed(query);
  const chunks = await vectorSearch(embedding);
  const context = chunks.map(c => c.content).join('\n');
  const answer = await geminiClient.generateAnswer(query, context);
  return { answer, citations: chunks };
}
```

**Replacement with DHS Knowledge Base:**
```typescript
// server/services/dhs-knowledge.service.ts
async searchPolicy(query: string): Promise<SearchResult[]> {
  const response = await dhsKBClient.get('/search', {
    params: { q: query, programs: 'SNAP,Medicaid' }
  });
  return transformDHSResults(response.data);
}
```

**Migration Steps:**
1. Index existing policy documents in DHS knowledge base
2. Implement DHS KB API adapter
3. Create result transformation utilities
4. Add fallback to RAG for uncovered topics
5. Monitor search quality metrics

#### 4. Authentication (Passport.js → DHS SSO)

**Current Implementation:**
```typescript
// server/index.ts (Passport.js LocalStrategy)
passport.use(new LocalStrategy(
  async (username, password, done) => {
    const user = await storage.getUserByUsername(username);
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return done(null, false);
    }
    return done(null, user);
  }
));
```

**Replacement with DHS SSO (SAML 2.0):**
```typescript
// server/index.ts (Passport.js SAMLStrategy)
import { Strategy as SamlStrategy } from 'passport-saml';

passport.use(new SamlStrategy({
  entryPoint: process.env.DHS_SSO_ENTRY_POINT,
  issuer: 'maryland-benefits-navigator',
  cert: fs.readFileSync(process.env.DHS_SSO_CERT_PATH, 'utf-8')
}, async (profile, done) => {
  // Map DHS SSO profile to local user
  const user = await storage.getUserByEmail(profile.email);
  if (!user) {
    // Auto-provision user from SSO
    const newUser = await storage.createUser({
      email: profile.email,
      name: profile.displayName,
      role: mapDHSRoleToLocalRole(profile.role),
      dhsSSOId: profile.nameID
    });
    return done(null, newUser);
  }
  return done(null, user);
}));
```

**Migration Steps:**
1. Configure DHS SSO metadata exchange
2. Install `passport-saml` package
3. Implement SAML strategy with DHS IdP
4. Create user provisioning logic from SSO profile
5. Update login UI to redirect to DHS SSO
6. Test with DHS SSO sandbox environment
7. Gradual rollout to staff users

---

## API Integration Points

### RESTful API Standards

**Base URL:**
```
Production: https://benefits.maryland.gov/api
Staging: https://staging-benefits.maryland.gov/api
Development: http://localhost:5000/api
```

**Authentication:**
```http
Authorization: Bearer <jwt-token>
X-API-Key: <api-key>  # For system-to-system integration
```

**Standard Response Format:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-10T16:00:00Z",
    "requestId": "req_abc123xyz",
    "version": "1.0"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid session type",
    "details": { "field": "sessionType", "value": "Unknown" }
  },
  "meta": {
    "timestamp": "2025-01-10T16:00:00Z",
    "requestId": "req_abc123xyz"
  }
}
```

### Key Endpoints for DHS Integration

**1. Navigator Export API**
```
GET    /api/navigator/exports           # List export batches
POST   /api/navigator/exports           # Create export batch
GET    /api/navigator/exports/:id       # Get export batch details
GET    /api/navigator/exports/:id/download  # Download export file
PATCH  /api/navigator/exports/:id       # Update upload status
```

**2. Document Verification API**
```
POST   /api/documents/upload             # Upload document for verification
GET    /api/documents/:id/verification   # Get verification result
PATCH  /api/documents/:id/verify         # Manual verification override
```

**3. Benefit Calculation API**
```
POST   /api/benefits/calculate           # Calculate benefit eligibility
POST   /api/benefits/scenarios           # Create scenario comparison
GET    /api/benefits/programs            # List benefit programs
```

**4. Audit Logging API**
```
GET    /api/audit/logs                   # Query audit logs
POST   /api/audit/export                 # Export audit logs
```

### Webhook Support (Future)

**E&E Upload Confirmation Webhook:**
```http
POST https://benefits.maryland.gov/api/webhooks/ee-upload-confirmation
Content-Type: application/json
X-DHS-Signature: <hmac-sha256-signature>

{
  "exportBatchId": "batch-124",
  "uploadStatus": "success",
  "confirmationNumber": "E&E-CONF-789",
  "importedRecords": 15,
  "timestamp": "2025-01-10T16:30:00Z"
}
```

**Document Processing Callback:**
```http
POST https://benefits.maryland.gov/api/webhooks/document-processed
Content-Type: application/json

{
  "documentId": "doc-456",
  "status": "verified",
  "processingResult": {
    "documentType": "PROOF_OF_INCOME",
    "extractedData": { "monthlyIncome": 2500 }
  }
}
```

---

## Data Migration

### Migration Phases

#### Phase 1: Parallel Operation (Weeks 1-4)
- Navigator system runs alongside existing E&E system
- Daily exports from Navigator → E&E
- Staff use both systems
- Data reconciliation reports

#### Phase 2: Primary Navigator (Weeks 5-8)
- Navigator becomes primary data entry point
- E&E system receives data via exports
- Fallback to E&E for legacy cases
- Performance monitoring

#### Phase 3: Full Integration (Weeks 9-12)
- Direct API integration (no exports)
- Real-time data sync
- Deprecate legacy workflows
- Staff training completion

### Data Mapping

**User Migration:**
```sql
-- Export users from legacy E&E system
SELECT 
  employee_id AS dhs_employee_id,
  email,
  first_name || ' ' || last_name AS name,
  CASE role_code
    WHEN 'NAV' THEN 'navigator'
    WHEN 'CW' THEN 'caseworker'
    WHEN 'ADM' THEN 'admin'
  END AS role
FROM ee_employees
WHERE active = true;

-- Import into Navigator system
INSERT INTO users (id, email, name, role, dhs_employee_id)
SELECT 
  gen_random_uuid(),
  email,
  name,
  role,
  dhs_employee_id
FROM ee_export_users;
```

**Case Migration:**
```sql
-- Link Navigator sessions to E&E cases
UPDATE client_interaction_sessions
SET client_case_id = ee_cases.case_number
FROM ee_cases
WHERE client_interaction_sessions.client_name = ee_cases.client_name
  AND DATE(client_interaction_sessions.interaction_date) = ee_cases.application_date;
```

### Validation & Reconciliation

**Daily Reconciliation Report:**
```sql
-- Compare session counts
SELECT 
  DATE(interaction_date) AS session_date,
  COUNT(*) AS navigator_sessions,
  (SELECT COUNT(*) FROM ee_interactions 
   WHERE DATE(contact_date) = DATE(interaction_date)) AS ee_sessions,
  COUNT(*) - (SELECT COUNT(*) FROM ee_interactions 
              WHERE DATE(contact_date) = DATE(interaction_date)) AS variance
FROM client_interaction_sessions
WHERE interaction_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(interaction_date);
```

**Data Quality Checks:**
```typescript
// server/services/data-quality.service.ts
async validateExport(exportBatchId: string): Promise<ValidationReport> {
  const sessions = await storage.getSessionsByExportBatch(exportBatchId);
  
  const issues = [];
  
  for (const session of sessions) {
    // Check required fields
    if (!session.sessionType) {
      issues.push({ sessionId: session.id, error: 'Missing session type' });
    }
    
    // Validate outcome status
    if (session.outcomeStatus && !validOutcomes.includes(session.outcomeStatus)) {
      issues.push({ sessionId: session.id, error: 'Invalid outcome status' });
    }
    
    // Check data completeness
    if (session.outcomeStatus === 'Application Submitted' && !session.clientCaseId) {
      issues.push({ sessionId: session.id, error: 'Case ID required for submitted apps' });
    }
  }
  
  return {
    totalSessions: sessions.length,
    validSessions: sessions.length - issues.length,
    issues,
    passRate: ((sessions.length - issues.length) / sessions.length * 100).toFixed(2)
  };
}
```

---

## Security & Compliance

### Integration Security Requirements

**1. Authentication & Authorization**
- **API Keys:** System-to-system integration
- **OAuth 2.0:** Third-party service access
- **SAML 2.0:** DHS SSO integration
- **JWT Tokens:** User session management

**2. Data Encryption**
- **In Transit:** TLS 1.3 for all API calls
- **At Rest:** AES-256 encryption for export files
- **PII Handling:** Tokenization for sensitive data

**3. Audit Requirements**
```typescript
// Log all E&E exports
await auditLog.create({
  action: 'EE_EXPORT_CREATED',
  userId: req.user.id,
  resourceType: 'EEExportBatch',
  resourceId: exportBatch.id,
  metadata: {
    sessionCount: exportBatch.sessionCount,
    exportFormat: exportBatch.exportFormat,
    ipAddress: req.ip
  }
});
```

**4. Compliance Standards**
- **HIPAA:** PHI protection for health-related data
- **NIST 800-53:** Federal security controls
- **Maryland DHS Security Policy:** State-specific requirements
- **WCAG 2.1 AA:** Accessibility compliance

### Data Privacy

**PII Minimization:**
```typescript
// Export only necessary fields
const sanitizedSession = {
  id: session.id,
  caseId: session.clientCaseId,
  sessionType: session.sessionType,
  date: session.interactionDate,
  // Exclude: client name, SSN, detailed notes
};
```

**Data Retention:**
```sql
-- Auto-delete export files after 30 days
DELETE FROM ee_export_batches
WHERE created_at < NOW() - INTERVAL '30 days'
  AND uploaded_to_ee = true;
```

---

## Testing & Validation

### Integration Testing Strategy

**1. Unit Tests (Component Level)**
```typescript
// tests/integration/ee-export.test.ts
describe('E&E Export', () => {
  test('should generate CSV with correct headers', async () => {
    const exportBatch = await createEEExportBatch({ format: 'csv' });
    const csvContent = await downloadExport(exportBatch.id);
    
    expect(csvContent).toContain('Session ID,Client Case ID');
    expect(csvContent.split('\n')).toHaveLength(exportBatch.sessionCount + 1);
  });
  
  test('should map outcome codes correctly', () => {
    expect(mapOutcomeCode('Application Submitted')).toBe('AS');
    expect(mapOutcomeCode('Info Provided')).toBe('IP');
  });
});
```

**2. Integration Tests (API Level)**
```typescript
// tests/integration/dhs-api.test.ts
describe('DHS API Integration', () => {
  test('should upload export to E&E system', async () => {
    const exportFile = await generateExport('csv');
    const response = await uploadToEE(exportFile);
    
    expect(response.status).toBe(200);
    expect(response.data.confirmationNumber).toMatch(/E&E-CONF-\d+/);
  });
});
```

**3. End-to-End Tests (Workflow)**
```typescript
// tests/e2e/navigator-to-ee.test.ts
describe('Navigator to E&E Workflow', () => {
  test('complete workflow from session to E&E upload', async () => {
    // 1. Navigator creates session
    const session = await createSession({ ... });
    
    // 2. System creates export batch
    const batch = await createExportBatch({ format: 'csv' });
    
    // 3. Download export
    const exportFile = await downloadExport(batch.id);
    
    // 4. Upload to E&E (mock)
    const uploadResult = await mockEEUpload(exportFile);
    
    // 5. Confirm upload
    await confirmUpload(batch.id, uploadResult.confirmationNumber);
    
    // Verify session marked as exported
    const updatedSession = await getSession(session.id);
    expect(updatedSession.exportedToEE).toBe(true);
  });
});
```

### Validation Checklist

**Pre-Integration:**
- [ ] API endpoints documented (OpenAPI/Swagger)
- [ ] Data mapping specifications complete
- [ ] Security requirements met (encryption, auth)
- [ ] Test environment configured
- [ ] Sample data prepared

**Integration Phase:**
- [ ] API connectivity verified
- [ ] Authentication working
- [ ] Data format validation passing
- [ ] Error handling tested
- [ ] Performance benchmarks met (< 2s response time)

**Post-Integration:**
- [ ] Data reconciliation reports clean (< 1% variance)
- [ ] Audit logs complete
- [ ] User acceptance testing passed
- [ ] Documentation updated
- [ ] Rollback plan tested

---

## Rollout Strategy

### Pilot Program (Weeks 1-4)

**Phase 1: Single Office Pilot**
- **Location:** Baltimore City Office
- **Participants:** 5 navigators, 50 clients
- **Success Metrics:**
  - 100% session data captured
  - 95%+ E&E export success rate
  - < 5% data reconciliation variance
  - Positive staff feedback (4/5 average rating)

**Phase 2: Regional Rollout (Weeks 5-8)**
- **Locations:** 3 additional offices (Annapolis, Silver Spring, Cumberland)
- **Participants:** 20 navigators, 200 clients
- **Monitoring:** Daily data quality reports, weekly staff check-ins

**Phase 3: Statewide Deployment (Weeks 9-12)**
- **Coverage:** All 24 DHS offices
- **Training:** Online modules + in-person sessions
- **Support:** Dedicated help desk (8 AM - 6 PM)

### Cutover Plan

**Pre-Cutover (Week 11)**
- Freeze E&E system for new navigator sessions
- Final data migration from legacy system
- Validation of all migrated data

**Cutover Weekend (Week 12)**
```
Friday 6 PM:    Legacy system read-only mode
Friday 8 PM:    Final data export from legacy
Friday 10 PM:   Data validation complete
Saturday 8 AM:  Navigator system goes live
Saturday 10 AM: Staff training webinar
Monday 8 AM:    First business day on new system
```

**Post-Cutover (Weeks 13-14)**
- Daily monitoring of system performance
- Staff support hotline available
- Issue tracking and resolution
- Stakeholder status updates

### Success Criteria

**Technical Metrics:**
- 99.5% uptime during business hours
- < 2s average API response time
- 100% E&E export delivery
- < 1% data reconciliation variance

**User Adoption:**
- 90%+ navigator daily active users
- 80%+ staff satisfaction score
- < 5% support ticket rate
- < 10% rollback requests

**Business Impact:**
- 30% reduction in manual data entry
- 25% faster client session processing
- 15% improvement in data accuracy
- Positive client feedback (client surveys)

---

## Troubleshooting Integration Issues

### Common Issues

**Issue 1: E&E Export Upload Fails**

**Symptoms:**
```
Error: SFTP connection timeout
Error: E&E API returns 401 Unauthorized
```

**Solution:**
```bash
# Check network connectivity
ping ee.dhs.maryland.gov

# Verify SFTP credentials
sftp -v dhs-ee-server

# Check API key expiration
curl -H "Authorization: Bearer $EE_API_KEY" \
  https://ee.dhs.maryland.gov/api/status

# Rotate API key if expired
export EE_API_KEY=<new-key>
```

**Issue 2: Data Format Mismatch**

**Symptoms:**
```
E&E Import Error: Invalid field 'OUTCOME_STATUS'
E&E Import Error: Date format must be MM/DD/YYYY
```

**Solution:**
```typescript
// Update date format in export generator
const formattedDate = new Date(session.interactionDate)
  .toLocaleDateString('en-US'); // MM/DD/YYYY

// Map outcome codes correctly
const outcomeCode = outcomeCodeMap[session.outcomeStatus] || 'NA';
```

**Issue 3: Duplicate Session Records**

**Symptoms:**
```
E&E Import Warning: Duplicate session ID detected
```

**Solution:**
```sql
-- Check for duplicate exports
SELECT session_id, COUNT(*) 
FROM ee_imports
GROUP BY session_id
HAVING COUNT(*) > 1;

-- Prevent duplicates with unique constraint
ALTER TABLE client_interaction_sessions
ADD CONSTRAINT unique_ee_export 
  CHECK (exported_to_ee = false OR export_batch_id IS NOT NULL);
```

---

## Appendix

### A. DHS Integration Contacts

| Role | Name | Email | Phone |
|------|------|-------|-------|
| E&E System Admin | [TBD] | ee-admin@dhs.maryland.gov | (410) xxx-xxxx |
| Integration Lead | [TBD] | integration@dhs.maryland.gov | (410) xxx-xxxx |
| Security Officer | [TBD] | security@dhs.maryland.gov | (410) xxx-xxxx |

### B. Reference Documents

- [DHS E&E System API Documentation](https://docs.dhs.maryland.gov/ee-api)
- [Maryland Data Exchange Standards](https://dhs.maryland.gov/data-standards)
- [DHS Security Policy v3.2](https://dhs.maryland.gov/security-policy)
- [NIEM 5.2 Specification](https://niem.gov)

### C. Migration Timeline

```
Week 1-4:   Pilot Program (Baltimore City)
Week 5-8:   Regional Rollout (3 offices)
Week 9-12:  Statewide Deployment (24 offices)
Week 13-14: Post-Cutover Stabilization
Week 15-16: Component Replacement (Vision AI)
Week 17-18: Component Replacement (Calculator)
Week 19-20: Component Replacement (Auth SSO)
```

### D. API Client Examples

**Python Client:**
```python
import requests

# E&E Export API
def create_export_batch(api_key, format='csv'):
    response = requests.post(
        'https://benefits.maryland.gov/api/navigator/exports',
        headers={'Authorization': f'Bearer {api_key}'},
        json={'exportType': 'manual', 'exportFormat': format}
    )
    return response.json()

# Upload to E&E
def upload_to_ee(export_file, ee_api_key):
    response = requests.post(
        'https://ee.dhs.maryland.gov/api/import',
        files={'file': open(export_file, 'rb')},
        headers={'Authorization': f'Bearer {ee_api_key}'}
    )
    return response.json()
```

**cURL Examples:**
```bash
# Create export
curl -X POST https://benefits.maryland.gov/api/navigator/exports \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"exportType":"manual","exportFormat":"csv"}'

# Download export
curl -H "Authorization: Bearer $API_KEY" \
  https://benefits.maryland.gov/api/navigator/exports/batch-123/download \
  -o export.csv

# Upload to E&E
curl -X POST https://ee.dhs.maryland.gov/api/import \
  -F "file=@export.csv" \
  -H "Authorization: Bearer $EE_API_KEY"
```

---

**Last Updated:** January 2025  
**Document Version:** 1.0  
**Next Review:** April 2025

For integration support, contact: integration@maryland.gov
