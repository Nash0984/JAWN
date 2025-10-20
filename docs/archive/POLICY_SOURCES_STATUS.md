# JAWN Policy Sources Status Tracker

**Joint Access Welfare Network (JAWN)** - Maryland Universal Benefits-Tax Service Delivery Platform

Last Updated: October 17, 2025

---

## 📊 Executive Summary

- **Total Authoritative Sources**: 25
- **Programs Covered**: 6 (SNAP, Medicaid, TCA/TANF, OHEP, Tax Credits, VITA)
- **Syncing Status**: All sources default to **OFF** (admin-controlled)
- **Rules as Code Implemented**: 4 major systems
- **Test Coverage**: 199 tests passing across all implementations

---

## 🎯 Policy Source Management Philosophy

**JAWN operates on admin-controlled policy syncing to prevent unnecessary API costs and ensure data integrity:**

1. **Default Sync: OFF** - All sources start disabled
2. **Max Frequency: Monthly** - Admin cannot set more aggressive than monthly sync
3. **Manual Sync Available** - "Sync Now" button for immediate updates when needed
4. **Active Monitoring** - Sources flagged as `isActive: true` appear in admin dashboard

---

## 📚 Policy Sources by Program

### 🍎 SNAP (Supplemental Nutrition Assistance Program) - 9 Sources

#### Federal SNAP Sources (5)

| Source Name | Sync Method | Sync Status | Last Sync | New Data | Rules as Code | Code Location |
|-------------|-------------|-------------|-----------|----------|---------------|---------------|
| **7 CFR Part 273 - SNAP Regulations** | Bulk Download (eCFR API) | ⏸️ OFF (Monthly Max) | Not synced | N/A | ✅ **Yes - Maryland SNAP Rules Engine** | [`server/services/rulesEngine.ts`](server/services/rulesEngine.ts) |
| **FNS Policy Memos** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | ⏳ Planned | *Policy memos feed RAG system, not yet RaC* |
| **FNS Handbook 310 - SNAP Quality Control** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | ⏳ Planned | *QC handbook for reference, not computational rules* |
| **SNAP E&T Operations Handbook** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | ⏳ Planned | *Employment & Training guidance, not yet RaC* |
| **FNS Implementation Memoranda** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | 🔄 **Auto-update mechanism** | Updates feed into rules engine when synced |

#### Maryland SNAP Sources (4)

| Source Name | Sync Method | Sync Status | Last Sync | New Data | Rules as Code | Code Location |
|-------------|-------------|-------------|-----------|----------|---------------|---------------|
| **COMAR 07.03.17 - Maryland SNAP Regulations** | Web Scraping (COMAR) | ⏸️ OFF (Monthly Max) | Not synced | N/A | ✅ **Yes - Maryland SNAP Rules Engine** | [`server/services/rulesEngine.ts`](server/services/rulesEngine.ts) |
| **Maryland SNAP Policy Manual** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | ✅ **Yes - Embedded in Rules Engine** | [`server/services/rulesEngine.ts`](server/services/rulesEngine.ts) |
| **Maryland Action Transmittals (AT)** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | 🔄 **Auto-update mechanism** | Updates feed into rules engine when synced |
| **Maryland Information Memos (IM)** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | 🔄 **Auto-update mechanism** | Operational guidance feeds into system |

**Maryland SNAP Rules as Code Status**: ✅ **PRODUCTION READY**
- **49 passing tests** covering income limits, deductions, categorical eligibility, benefit calculations
- Test file: [`tests/services/rulesEngine.test.ts`](tests/services/rulesEngine.test.ts)
- Implements: FY 2025 Maryland SNAP eligibility rules with full calculation breakdown
- Policy citations included for audit trail

---

### 🏥 Medicaid - 2 Sources

| Source Name | Sync Method | Sync Status | Last Sync | New Data | Rules as Code | Code Location |
|-------------|-------------|-------------|-----------|----------|---------------|---------------|
| **Maryland Medicaid Manual** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | 🚧 **In Progress - PolicyEngine Integration** | [`server/services/policyEngine.service.ts`](server/services/policyEngine.service.ts) |
| **COMAR 10.09.24 - Medicaid Eligibility Regulations** | Web Scraping (COMAR) | ⏸️ OFF (Monthly Max) | Not synced | N/A | 🚧 **In Progress - PolicyEngine Integration** | [`server/services/policyEngine.service.ts`](server/services/policyEngine.service.ts) |

**Medicaid Rules as Code Status**: 🚧 **IN PROGRESS**
- Uses **PolicyEngine US** for Medicaid eligibility calculations
- Not yet converted to standalone Rules as Code engine
- **Recommendation**: Extract Medicaid-specific rules similar to SNAP engine

---

### 💵 TCA/TANF (Temporary Cash Assistance) - 2 Sources

| Source Name | Sync Method | Sync Status | Last Sync | New Data | Rules as Code | Code Location |
|-------------|-------------|-------------|-----------|----------|---------------|---------------|
| **TCA Main Page - Forms and Resources** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | 🚧 **In Progress - PolicyEngine Integration** | [`server/services/policyEngine.service.ts`](server/services/policyEngine.service.ts) |
| **TCA Policy Manual** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | 🚧 **In Progress - PolicyEngine Integration** | [`server/services/policyEngine.service.ts`](server/services/policyEngine.service.ts) |

**TCA/TANF Rules as Code Status**: 🚧 **IN PROGRESS**
- Uses **PolicyEngine US** for TANF benefit calculations
- Not yet converted to standalone Rules as Code engine
- **Recommendation**: Extract TANF-specific rules similar to SNAP engine

---

### ⚡ OHEP (Office of Home Energy Programs) - 2 Sources

| Source Name | Sync Method | Sync Status | Last Sync | New Data | Rules as Code | Code Location |
|-------------|-------------|-------------|-----------|----------|---------------|---------------|
| **OHEP Operations Manual** | Direct Download (PDF) | ⏸️ OFF (Monthly Max) | Not synced | N/A | ⏳ Planned | *Energy assistance rules not yet converted to RaC* |
| **OHEP Forms and Documentation** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | ⏳ Planned | *Forms library, not computational rules* |

**OHEP Rules as Code Status**: ⏳ **PLANNED**
- Energy assistance rules are complex seasonal calculations
- **Recommendation**: Create OHEP Rules Engine similar to SNAP after Medicaid/TANF

---

### 🏠 Maryland Tax Credits - 5 Sources

| Source Name | Sync Method | Sync Status | Last Sync | New Data | Rules as Code | Code Location |
|-------------|-------------|-------------|-----------|----------|---------------|---------------|
| **SDAT Tax Credit Programs Portal** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | ✅ **Yes - Maryland Form 502 Generator** | [`server/services/form502Generator.ts`](server/services/form502Generator.ts) |
| **Renters' Tax Credit Program** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | ✅ **Yes - Renter's Credit in Form 502** | [`server/services/form502Generator.ts`](server/services/form502Generator.ts#L480) |
| **Homeowners' Property Tax Credit Program** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | ✅ **Yes - Property Credit in Form 502** | [`server/services/form502Generator.ts`](server/services/form502Generator.ts#L450) |
| **Maryland Comptroller Tax Credits** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | ✅ **Yes - MD EITC in Form 502** | [`server/services/form502Generator.ts`](server/services/form502Generator.ts#L420) |
| **OneStop Tax Credit Forms Portal** | Web Scraping | ⏸️ OFF (Monthly Max) | Not synced | N/A | ⏳ Planned | *Forms library, computational rules in Form 502* |

**Maryland Tax Credits Rules as Code Status**: ✅ **PRODUCTION READY**
- **22 passing tests** covering Maryland state tax, county tax, EITC, poverty level credit
- Test file: [`tests/services/marylandForm502Calculations.test.ts`](tests/services/marylandForm502Calculations.test.ts)
- Implements: Maryland progressive tax brackets (2%-5.75%), all 24 county rates, MD-specific credits
- Integrated with Federal Form 1040 calculations

---

### 📋 VITA (Volunteer Income Tax Assistance) - 5 Sources

| Source Name | Sync Method | Sync Status | Last Sync | New Data | Rules as Code | Code Location |
|-------------|-------------|-------------|-----------|----------|---------------|---------------|
| **IRS Pub 4012 - VITA/TCE Volunteer Resource Guide** | Direct Download (PDF) | ⏸️ OFF (Monthly Max) | Not synced | N/A | ✅ **Yes - Federal Form 1040 Generator** | [`server/services/form1040Generator.ts`](server/services/form1040Generator.ts) |
| **IRS Pub 4491 - VITA/TCE Training Guide** | Direct Download (PDF) | ⏸️ OFF (Monthly Max) | Not synced | N/A | ✅ **Yes - Embedded in Form 1040** | [`server/services/form1040Generator.ts`](server/services/form1040Generator.ts) |
| **IRS Pub 4491-X - VITA/TCE Training Supplement** | Direct Download (PDF) | ⏸️ OFF (Monthly Max) | Not synced | N/A | 🔄 **Auto-update mechanism** | Updates feed into Form 1040 generator |
| **IRS Pub 4961 - VITA/TCE Volunteer Standards of Conduct** | Direct Download (PDF) | ⏸️ OFF (Monthly Max) | Not synced | N/A | ⏳ Planned | *Ethics/conduct rules, not computational* |
| **IRS Form 6744 - VITA/TCE Volunteer Assistor Test/Retest** | Direct Download (PDF) | ⏸️ OFF (Monthly Max) | Not synced | N/A | ⏳ Planned | *Training scenarios, not computational rules* |

**Federal Tax (VITA) Rules as Code Status**: ✅ **PRODUCTION READY**
- **29 passing tests** covering federal tax calculations, standard deductions, tax credits (EITC, CTC, ACTC)
- Test file: [`tests/services/form1040Calculations.test.ts`](tests/services/form1040Calculations.test.ts)
- Implements: IRS 2024 tax tables, filing statuses, federal deductions and credits
- Integrates with **PolicyEngine US** for complex tax scenarios

---

## 🔧 Rules as Code Implementation Summary

### ✅ Production-Ready Implementations (4)

1. **Maryland SNAP Rules Engine** ([`rulesEngine.ts`](server/services/rulesEngine.ts))
   - 49 tests passing | 100% Maryland-specific rules coverage
   - Income limits, deductions, categorical eligibility, benefit calculations
   - Policy citations and audit trail built-in

2. **Federal Form 1040 Tax Calculations** ([`form1040Generator.ts`](server/services/form1040Generator.ts))
   - 29 tests passing | IRS 2024 tax year compliance
   - Standard deductions, tax brackets, EITC, Child Tax Credit, Additional Child Tax Credit
   - PDF generation with professional IRS layout

3. **Maryland Form 502 State Tax** ([`form502Generator.ts`](server/services/form502Generator.ts))
   - 22 tests passing | All 24 Maryland counties supported
   - Progressive state tax (2%-5.75%), county tax, MD EITC (50% of federal)
   - Property tax credit, renter's tax credit, poverty level credit

4. **Document Extraction Rules** ([`documentExtraction.ts`](server/services/documentExtraction.ts))
   - 99 tests passing (30 income + 69 all verification types)
   - Dual-purpose extraction (tax + benefits workflows)
   - AI-powered with Gemini Vision for OCR and classification

### 🚧 In Progress (2)

5. **Medicaid Eligibility (via PolicyEngine)** ([`policyEngine.service.ts`](server/services/policyEngine.service.ts))
   - Uses external PolicyEngine API
   - Not yet standalone RaC engine
   - **Next Step**: Extract Maryland Medicaid rules similar to SNAP

6. **TANF Eligibility (via PolicyEngine)** ([`policyEngine.service.ts`](server/services/policyEngine.service.ts))
   - Uses external PolicyEngine API
   - Not yet standalone RaC engine
   - **Next Step**: Extract Maryland TANF rules similar to SNAP

### ⏳ Planned (3)

7. **OHEP (Energy Assistance) Rules Engine**
   - Complex seasonal calculations
   - Waiting for Medicaid/TANF completion

8. **SSI Integration Rules**
   - Federal SSI eligibility and categorical rules
   - Feeds into SNAP categorical eligibility

9. **Cross-Program Enrollment Logic**
   - AI-driven recommendations engine
   - Uses all above RaC systems for eligibility checks

---

## 📋 Document Processing Pipeline

**All 25 policy sources feed into a multi-stage document processing system:**

1. **Ingestion** → Scraping/downloading from authoritative sources
2. **OCR** → Tesseract + Gemini Vision for text extraction
3. **Classification** → AI categorization (federal/state, program type, policy section)
4. **Semantic Chunking** → Intelligent document splitting for RAG
5. **Embedding Generation** → Vector embeddings for similarity search
6. **Rules Extraction** → Convert natural language policy → executable code
7. **Validation** → Test against known scenarios and edge cases

**Rules Extraction Service**: [`server/services/rulesExtractionService.ts`](server/services/rulesExtractionService.ts)
- Converts human-readable policy text → structured Rules as Code
- Outputs: Income limits, deduction tables, eligibility criteria, calculation formulas
- Integration: Feeds into rulesEngine for benefit calculations

---

## 🎯 Admin Dashboard Features (In Progress)

**Policy Sources Dashboard** will provide:

- ✅ **Visual Status Cards** - All 25 sources with sync status, last update, data freshness
- ✅ **On/Off Toggles** - Per-source sync control (respecting maxAllowedFrequency)
- ✅ **Schedule Presets** - Weekly, Bi-weekly, Monthly, Custom frequency
- ✅ **Manual Sync Button** - "Sync Now" for immediate updates
- ✅ **Rules as Code Status** - Visual indicators for RaC conversion status
- ✅ **Direct Code Links** - One-click access to implementing code for manual inspection
- ✅ **Change Detection** - Highlights when new policy data is detected
- ✅ **Sync History** - Audit trail of all sync operations

**Location**: `client/src/pages/admin/PolicySourcesDashboard.tsx` (To be implemented in Task 3)

---

## 🚀 Next Steps

### Immediate Priorities

1. **Build Admin Policy Sources Dashboard** (Task 3)
   - Visual management interface for all 25 sources
   - Sync controls, status monitoring, direct code access

2. **Complete Medicaid Rules Engine** (Post-MVP)
   - Extract from PolicyEngine to standalone Maryland Medicaid RaC
   - Follow SNAP engine pattern

3. **Complete TANF Rules Engine** (Post-MVP)
   - Extract from PolicyEngine to standalone Maryland TANF RaC
   - Follow SNAP engine pattern

### Future Enhancements

4. **OHEP Rules Engine** - Energy assistance seasonal calculations
5. **SSI Integration** - Federal SSI categorical eligibility rules
6. **Cross-Program Intelligence** - AI-powered unclaimed benefits detection
7. **Automated Policy Versioning** - Diff detection and change alerts
8. **Rules Governance Workflow** - Legal review → Approval → Deployment pipeline

---

## 📊 Compliance & Audit Trail

**Every Rules as Code implementation includes:**

- ✅ **Policy Citations** - Direct references to source regulations (CFR, COMAR)
- ✅ **Effective Dates** - Rules versioned by effective date for historical accuracy
- ✅ **Calculation Breakdown** - Step-by-step audit trail of every calculation
- ✅ **Test Coverage** - Comprehensive scenarios covering edge cases
- ✅ **Change Logs** - All rule updates logged in `ruleChangeLogs` table

**Regulatory Compliance**: All calculations traceable to authoritative source via policy citations

---

## 📝 Glossary

- **RaC (Rules as Code)**: Converting human-readable policy text into executable, testable code
- **Categorical Eligibility**: Automatic SNAP eligibility for recipients of certain programs (SSI, TANF)
- **PolicyEngine**: External API service providing multi-benefit calculations
- **RAG (Retrieval-Augmented Generation)**: AI technique using vector search over policy documents
- **Sync Schedule**: Frequency at which policy sources are checked for updates (daily/weekly/monthly/off)
- **Max Allowed Frequency**: Admin-set limit preventing overly aggressive sync schedules

---

## 📋 Maintenance Methodology

**This document is derived from the authoritative source list in the codebase:**
- **Source of Truth**: [`server/services/policySourceScraper.ts`](server/services/policySourceScraper.ts) - `OFFICIAL_SOURCES` array (lines 11-483)
- **Source Count**: 25 sources verified across 6 programs (SNAP, Medicaid, TCA/TANF, OHEP, Tax Credits, VITA)
- **Update Process**:
  1. All source changes must be made in `OFFICIAL_SOURCES` array first
  2. This document updated to reflect code changes (never the reverse)
  3. Sync status tracked via database `policy_sources` table
  4. Rules as Code status tracked via test files and implementation files
  
**Validation Checklist** (run before publishing updates):
- [ ] Source names match `OFFICIAL_SOURCES` exactly
- [ ] All 25 sources accounted for
- [ ] RaC status matches actual test files
- [ ] Code links point to correct implementation files
- [ ] Test counts verified via `npm run test` output

**Sync Status Legend**:
- ⏸️ **OFF** - Default state, admin-controlled activation
- 🔄 **Auto-update** - Feeds into existing systems when synced
- ✅ **Yes** - Fully converted to executable Rules as Code
- 🚧 **In Progress** - Partial implementation or external API integration
- ⏳ **Planned** - Scheduled for future conversion

---

**Document Maintained By**: JAWN Development Team  
**Last Review**: October 17, 2025  
**Next Review**: Monthly or upon major policy changes  
**Version**: 1.0.0
