# Living Policy Manual & Dynamic Notification System

**Version:** 1.0  
**Last Updated:** October 18, 2025  
**Status:** Production Ready

---

## Overview

The Living Policy Manual & Dynamic Notification System transforms Maryland's 25 golden policy sources into a browseable ebook-style manual and enables official communications that auto-update when Rules as Code (RaC) changes. This eliminates static messages, version control chaos, and manual content updates across SNAP, Medicaid, TANF, OHEP, Tax Credits, and VITA programs.

## Core Value Proposition

**Before:** Policy changes require manual updates to:
- Policy manuals (scattered PDFs)
- Official notices (static templates)
- Glossary definitions (inconsistent across programs)
- Training materials
- FAQ content

**After:** Policy changes automatically propagate to:
- ✅ Unified digital policy manual with citations
- ✅ Official notices (SNAP approval, TANF denial, tax reminders)
- ✅ Shared glossary across all programs
- ✅ Training content
- ✅ Complete audit trail with RaC version tracking

**Example:** When SNAP gross income limit changes from $1,580 to $1,650:
1. Rules Engine updates automatically
2. Policy Manual section updates with new limit
3. SNAP approval notices regenerate with $1,650 threshold
4. Glossary definition updates
5. All future communications use correct value
6. **Zero manual updates. Zero version control.**

---

## Architecture

### Database Schema (8 New Tables)

#### Living Policy Manual Tables (4)

**1. `policy_manual_chapters`**
- Top-level organization by program (SNAP, Medicaid, TANF, OHEP, Tax, VITA)
- 6 chapters total
- Sortable with chapter numbers

**2. `policy_manual_sections`**
- Sections within chapters derived from 25 policy sources
- **Ebook features:**
  - Page numbering (`pageNumber`, `pageNumberEnd`)
  - Legal citations (`legalCitation`)
  - Source URLs (`sourceUrl`)
  - RaC code references (`rulesAsCodeReference`)
- Cross-referencing via `relatedSectionIds`
- Full-text searchable via `keywords`
- Markdown/HTML content rendering

**3. `policy_glossary_terms`**
- Centralized definitions across all programs
- Program-specific or universal terms
- Related terms for navigation
- Acronym support (SNAP, TANF, EITC, etc.)
- Usage examples
- Legal citation for each term

**4. `policy_manual_versions`**
- Complete version history with diffs
- Change tracking (content updates, citation corrections)
- Effective date management
- Audit trail for all manual changes

#### Dynamic Notification System Tables (4)

**5. `dynamic_notification_templates`**
- Policy-driven templates pulling from RaC
- Content rules mapping `{{variables}}` to RaC sources
- Multi-channel delivery (email, SMS, portal, mail)
- Legal compliance (required disclosures, appeal rights)
- Version tracking with effective dates
- Example content rules:
  ```json
  {
    "benefitAmount": {
      "source": "rulesEngine.calculateSNAPBenefit",
      "params": ["householdProfile"]
    },
    "grossIncome": {
      "source": "household.totalGrossIncome",
      "format": "currency"
    }
  }
  ```

**6. `form_components`**
- Modular building blocks for official documents
- Reusable across programs (headers, calculations, signatures)
- Content rules for dynamic data
- Print formatting metadata
- Usage tracking

**7. `content_rules_mapping`**
- Links RaC tables/fields to affected content
- Auto-regeneration triggers when rules change
- Configurable: auto-update vs. requires approval
- Sync status tracking
- Example:
  ```typescript
  {
    rulesEngineTable: "snap_income_limits",
    rulesEngineField: "grossIncomeLimit",
    affectedContentType: "notification_template",
    affectedContentId: "SNAP_APPROVAL",
    mappingPath: "contentRules.incomeLimit",
    autoRegenerate: true
  }
  ```

**8. `generated_notifications`**
- Complete audit trail of all generated notices
- RaC version tracking (`racVersion`)
- Policy source versions (`policySourceVersions`)
- Delivery tracking (pending, sent, delivered, failed)
- Context data for reproducibility
- Approval workflow support

---

## Services

### Policy Manual Assembly Service

**File:** `server/services/policyManualAssemblyService.ts`

**Functions:**
- `assembleCompleteManual()` - Transforms 25 policy sources into organized manual
- `createChapters()` - Creates 6 program-based chapters
- `extractSectionsFromSources()` - Converts policy sources to sections
- `assignPageNumbers()` - Ebook-style pagination (500 words/page)
- `extractGlossaryTerms()` - Populates shared glossary
- `rebuildChapter(chapterNumber)` - Rebuilds specific chapter

**Key Features:**
- Automatic chapter generation
- Page numbering for citations
- Cross-referencing
- RaC code linking
- Glossary extraction

**Integration:**
- Reads from `policy_sources` table (25 sources)
- Joins with `benefit_programs` for routing
- Links to RaC via `racCodeLocation` field

### Dynamic Notification Service

**File:** `server/services/dynamicNotificationService.ts`

**Functions:**
- `generateNotification()` - Generates official notice from template
- `resolveContentRules()` - Pulls data from RaC sources
- `renderTemplate()` - Substitutes `{{variables}}` with resolved data
- `saveGeneratedNotification()` - Persists with audit trail
- `previewNotification()` - Preview without saving

**RaC Integration:**
```typescript
// Example: SNAP benefit amount
const benefitAmount = await rulesEngine.calculateSNAPBenefit({
  householdSize: household.size,
  grossIncome: household.totalGrossIncome,
  netIncome: household.totalNetIncome,
  state: 'MD',
  fiscalYear: 2025
});

// Example: Current income limit
const incomeLimits = await db.select()
  .from(snapIncomeLimits)
  .where(eq(snapIncomeLimits.fiscalYear, currentFY));
```

**Audit Trail:**
Every generated notification includes:
- Template used
- RaC version
- Policy source versions
- Input context data
- Generation timestamp
- Approver (if applicable)

---

## Frontend Components

### Policy Manual Browser

**File:** `client/src/pages/PolicyManualBrowser.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Maryland Benefits-Tax Policy Manual      🔍 Search  Print  │
├────────────┬────────────────────────────────┬───────────────┤
│ Navigation │ Current Section: 1.2           │ Quick Ref     │
│            │ SNAP Income Limits FY 2025     │               │
│ Ch 1: SNAP │                                │ TOC:          │
│  ├ 1.1     │ [Content here with citations]  │  1.1 Overview │
│  ├ 1.2 ●   │                                │  1.2 Limits   │
│  └ 1.3     │ Page 12-14                     │  1.3 Deduct.  │
│ Ch 2: Med  │                                │               │
│ Ch 3: TANF │ Legal: 7 CFR § 273.9           │ Related:      │
│ Ch 4: OHEP │ RaC: [View Code →]             │  • Net Income │
│ Ch 5: Tax  │                                │  • FPL        │
│ Ch 6: VITA │                                │               │
└────────────┴────────────────────────────────┴───────────────┘
```

**Features:**
- **Left Sidebar:** Expandable chapter/section tree with page numbers
- **Main Content:** Markdown rendering with customizable font size
- **Right Sidebar:** Quick reference, citations, related sections
- **Top Toolbar:** Search, zoom, print, export, bookmark
- **Search:** Full-text search with result highlighting
- **Responsive:** Mobile drawer for small screens
- **Dark Mode:** Full theme support
- **Accessibility:** data-testid on all interactive elements

**Navigation:**
- URL: `/policy-manual`
- Route protected (requires authentication)
- Accessible to all roles (client, navigator, caseworker, admin)

---

## API Routes

### Policy Manual Routes

```typescript
GET /api/policy-manual/chapters
// Returns: List of all chapters with section counts
// Response: Array<PolicyManualChapter & { sectionCount: number }>

GET /api/policy-manual/chapters/:id/sections
// Returns: All sections for a specific chapter
// Response: Array<PolicyManualSection>

GET /api/policy-manual/sections/:id
// Returns: Full section content with metadata
// Response: PolicyManualSection & { chapter, policySource }

GET /api/policy-manual/search?q=term
// Returns: Search results across all content
// Response: Array<PolicyManualSection> (filtered)

GET /api/policy-manual/glossary?program=SNAP
// Returns: Glossary terms (optionally filtered by program)
// Response: Array<PolicyGlossaryTerm>

GET /api/policy-manual/glossary/:term
// Returns: Specific term definition
// Response: PolicyGlossaryTerm
```

### Dynamic Notification Routes

```typescript
POST /api/notifications/generate
// Body: { templateCode, recipientId, householdId, contextData }
// Returns: GeneratedNotification (saved to database)

POST /api/notifications/preview
// Body: { templateCode, contextData }
// Returns: { content, resolvedData } (not saved)

GET /api/notifications/templates?program=SNAP
// Returns: Available templates (optionally filtered)
// Response: Array<DynamicNotificationTemplate>

GET /api/notifications/generated?userId=xxx
// Returns: User's generated notifications
// Response: Array<GeneratedNotification>

GET /api/notifications/generated/:id
// Returns: Specific notification details
// Response: GeneratedNotification & { template }
```

---

## Templates

### Production Templates

**1. SNAP Benefit Approval Notice** (`SNAP_APPROVAL`)

Template Code:
```
Dear {{recipientName}},

Your application for SNAP benefits has been APPROVED.

Benefit Amount: ${{benefitAmount}} per month
Certification Period: {{certificationStart}} to {{certificationEnd}}

This amount is based on:
- Household Size: {{householdSize}}
- Gross Monthly Income: ${{grossIncome}}
- Net Monthly Income: ${{netIncome}}

Your benefits will be available on your EBT card on {{benefitDate}}.

[Legal disclosures and appeal rights]
```

Content Rules:
- `benefitAmount` → `rulesEngine.calculateSNAPBenefit()`
- `grossIncome` → `household.totalGrossIncome`
- `netIncome` → `household.totalNetIncome`
- All amounts auto-update when rules change

**2. SNAP Benefit Denial Notice** (`SNAP_DENIAL`)

Template Code:
```
Dear {{recipientName}},

Your application for SNAP benefits has been DENIED.

Reason: {{denialReason}}

Income Comparison:
- Your Gross Income: ${{grossIncome}}
- Maximum Allowed: ${{incomeLimit}} ({{householdSize}} people)

[Appeal rights and next steps]
```

Content Rules:
- `incomeLimit` → Query `snap_income_limits` table
- `denialReason` → Eligibility determination logic
- Current FY limits pulled dynamically

---

## Glossary Terms

### Sample Terms (10 Core Terms Seeded)

1. **Gross Income** - Total household income before deductions (7 CFR § 273.9(b))
2. **Net Income** - Income after allowable deductions (7 CFR § 273.9(d))
3. **Federal Poverty Level (FPL)** - Annual income guidelines by HHS (42 USC § 9902)
4. **Categorical Eligibility** - Automatic SNAP eligibility via SSI/TANF (7 CFR § 273.2(j))
5. **Standard Deduction** - Fixed deduction by household size (7 CFR § 273.9(d)(2))
6. **Shelter Deduction** - Housing costs exceeding 50% of income (7 CFR § 273.9(d)(6))
7. **MAGI** - Modified Adjusted Gross Income for Medicaid (42 CFR § 435.603)
8. **EITC** - Earned Income Tax Credit (26 USC § 32)
9. **SNAP** - Supplemental Nutrition Assistance Program (7 USC § 2011)
10. **TANF** - Temporary Assistance for Needy Families (42 USC § 601)

Each term includes:
- Definition
- Legal citation
- Related terms
- Usage examples
- Program association (if applicable)

---

## Workflow Examples

### Example 1: Policy Change Propagation

**Scenario:** SNAP standard deduction increases from $198 to $210 for FY 2026

**Automatic Updates:**

1. **Rules Engine**
   ```typescript
   // server/services/rulesEngine.ts
   const standardDeduction = fiscalYear === 2026 ? 210 : 198;
   ```

2. **Policy Manual Section** (Auto-updates on next assembly)
   - Section 1.3: "Standard Deduction"
   - Content: "FY 2026: $210 for households 1-3"
   - Citation: Updated effective date

3. **Glossary Term**
   - "Standard Deduction" definition updated
   - Examples: "FY 2026: $210"

4. **Notification Templates**
   - SNAP_APPROVAL: Deduction calculation auto-updates
   - Next generated notice uses $210

5. **Audit Trail**
   - All notices track RaC version showing which rules were used
   - Policy source versions logged

**Result:** Zero manual updates, complete transparency

### Example 2: Generate SNAP Approval Notice

**Request:**
```typescript
POST /api/notifications/generate
{
  "templateCode": "SNAP_APPROVAL",
  "recipientId": "user_123",
  "householdId": "household_456",
  "contextData": {
    "recipientName": "Maria Rodriguez",
    "certificationStart": "2025-11-01",
    "certificationEnd": "2026-04-30"
  }
}
```

**Processing:**
1. Load `SNAP_APPROVAL` template
2. Resolve content rules:
   - Call `rulesEngine.calculateSNAPBenefit(household_456)` → $512
   - Query household → size: 3, gross: $1,200, net: $800
   - Calculate benefit date → "November 10, 2025"
3. Render template with substituted values
4. Save to `generated_notifications` with:
   - RaC version: "snap-rules-fy2025-v3"
   - Policy sources: ["7 CFR § 273.9", "COMAR 07.03.17"]
   - Context data: Full household profile
5. Return generated notice

**Output:**
```
Dear Maria Rodriguez,

Your application for SNAP benefits has been APPROVED.

Benefit Amount: $512 per month
Certification Period: November 1, 2025 to April 30, 2026

This amount is based on:
- Household Size: 3
- Gross Monthly Income: $1,200
- Net Monthly Income: $800

Your benefits will be available on your EBT card on November 10, 2025.

[Legal disclosures...]
```

**Audit Trail:**
- Template: SNAP_APPROVAL
- Generated: 2025-10-18 18:00:00
- RaC Version: snap-rules-fy2025-v3
- Household: household_456
- Calculation: $512/month (retrievable from context)

---

## Seeding & Initialization

### Automatic Seeding (On Server Start)

**File:** `server/seedData.ts`

**Sequence:**
1. Seed demo users
2. Seed benefit programs
3. Seed policy sources (25 sources)
4. **Seed notification templates** (2 templates)
5. **Seed policy manual** (6 chapters, sections, 10 glossary terms)

**Functions:**
- `seedNotificationTemplates()` - Creates SNAP approval/denial templates
- `seedPolicyManual()` - Calls `assembleCompleteManual()`

### Manual Operations

**Rebuild Entire Manual:**
```typescript
import { assembleCompleteManual } from './server/services/policyManualAssemblyService';
await assembleCompleteManual();
```

**Rebuild Specific Chapter:**
```typescript
import { rebuildChapter } from './server/services/policyManualAssemblyService';
await rebuildChapter(1); // Rebuild SNAP chapter
```

**Generate Notification:**
```typescript
import { generateNotification } from './server/services/dynamicNotificationService';
await generateNotification('SNAP_APPROVAL', userId, householdId, contextData);
```

---

## Testing

### Manual Browser Testing

1. Navigate to `/policy-manual`
2. Verify chapter navigation tree
3. Click sections to view content
4. Test full-text search
5. Verify page numbers display
6. Click "View in RaC" links
7. Test responsive mobile view

### Notification Generation Testing

1. Create test household with known income
2. Call `POST /api/notifications/generate` with SNAP_APPROVAL
3. Verify benefit amount matches rulesEngine calculation
4. Check `generated_notifications` table for audit trail
5. Verify RaC version tracking

### Content Update Testing

1. Update SNAP income limit in rules
2. Rebuild policy manual
3. Verify manual section shows new limit
4. Generate new SNAP notice
5. Verify notice uses updated limit
6. Check old notices still reference old version (audit trail intact)

---

## Production Deployment

### Required Steps

1. **Database Migration:**
   ```bash
   npm run db:push --force
   # Select "create table" for all 8 new tables
   ```

2. **Verify Tables Created:**
   - policy_manual_chapters
   - policy_manual_sections
   - policy_glossary_terms
   - policy_manual_versions
   - dynamic_notification_templates
   - form_components
   - content_rules_mapping
   - generated_notifications

3. **Restart Application:**
   - Auto-seeds 6 chapters
   - Auto-seeds sections from 25 policy sources
   - Auto-seeds 10 glossary terms
   - Auto-seeds 2 notification templates

4. **Verify Manual:**
   - Navigate to `/policy-manual`
   - Verify 6 chapters display
   - Verify sections load
   - Test search functionality

5. **Verify Notifications:**
   - Call preview API
   - Generate test notice
   - Verify audit trail

### Monitoring

**Key Metrics:**
- Number of manual sections
- Glossary term count
- Templates active
- Notifications generated daily
- Content sync status
- RaC version coverage

**Logs to Monitor:**
- Policy manual assembly errors
- Notification generation failures
- Content rule resolution errors
- RaC integration failures

---

## Future Enhancements

### Planned Features

1. **Rules-to-Content Pipeline**
   - Automatic detection of RaC changes
   - Queue regeneration jobs
   - Admin review workflow
   - Batch content updates

2. **Modular Form Builder UI**
   - Drag-and-drop form assembly
   - Component library browser
   - Real-time preview
   - PDF export

3. **Shared Glossary API Service**
   - REST API for term definitions
   - Tooltips in UI
   - Autocomplete suggestions
   - Term usage analytics

4. **Admin Content Dashboard**
   - Review auto-generated notices
   - Approve glossary updates
   - Manage template versions
   - Monitor sync status
   - Content quality metrics

5. **Advanced Search**
   - Citation search
   - Cross-program search
   - Semantic search via embeddings
   - Search filters (program, date, RaC status)

6. **Version Comparison**
   - Side-by-side diff view
   - Track policy evolution
   - Highlight changes
   - Export change reports

---

## Technical Details

### Page Number Calculation

**Algorithm:**
```typescript
const wordCount = section.content.split(/\s+/).length;
const estimatedPages = Math.ceil(wordCount / 500);
const pageNumber = currentPage;
const pageNumberEnd = currentPage + estimatedPages - 1;
```

**Rationale:**
- Standard legal document: 500 words per page
- Accounts for citations, formatting, whitespace
- Provides consistent page references for citations

### Content Rules Resolution

**Process:**
1. Parse `contentRules` JSON from template
2. For each variable:
   - Identify source (rulesEngine, database, household)
   - Extract required parameters
   - Call source function/query
   - Apply formatting (currency, date, etc.)
3. Return resolved data object
4. Substitute into template

**Example:**
```typescript
// Template contentRules
{
  "benefitAmount": {
    "source": "rulesEngine.calculateSNAPBenefit",
    "params": ["householdProfile"],
    "format": "currency"
  }
}

// Resolution
const household = await getHousehold(contextData.householdId);
const benefitAmount = await rulesEngine.calculateSNAPBenefit({
  householdSize: household.size,
  grossIncome: household.totalGrossIncome,
  // ...
});
const formatted = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(benefitAmount);
// Returns: "$512.00"
```

### RaC Version Tracking

**Version Format:** `{program}-rules-{fiscalYear}-v{increment}`

**Examples:**
- `snap-rules-fy2025-v3`
- `tax-rules-2024-v12`
- `medicaid-rules-2025-v1`

**Tracking:**
- Every generated notification stores current RaC version
- Policy source versions stored as JSON
- Enables full reproducibility
- Supports historical analysis

---

## Support

**Documentation:**
- Schema: `shared/schema.ts`
- Services: `server/services/policyManualAssemblyService.ts`, `dynamicNotificationService.ts`
- Frontend: `client/src/pages/PolicyManualBrowser.tsx`
- API Routes: `server/routes.ts` (search for `/api/policy-manual` and `/api/notifications`)

**Troubleshooting:**
- Tables not found: Run `npm run db:push --force`
- No sections: Call `assembleCompleteManual()`
- Empty glossary: Run seeding scripts
- Notification errors: Check RaC integration, verify template content rules

**Contact:**
- GitHub Issues: [Repository URL]
- Technical Documentation: `/docs`
- API Explorer: `/api-explorer`

---

**Maryland Universal Financial Navigator** - Living Policy Manual System  
**Version 1.0** | October 2025 | Production Ready
