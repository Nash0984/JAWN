# Documentation Archive Status

**Last Updated:** October 27, 2025  
**Purpose:** Clarify status of archived documentation

---

## Archive Structure

The `/docs/archive/` directory contains **83 archived documents** from previous development phases. These documents are preserved for historical reference but are **NOT authoritative** for production deployment.

### Archive Periods

- **`2024-12/`** (13 files) - October 2024 architecture and design docs
- **`2025-01/`** (23 files) - January 2025 (actually Oct 2025) implementation docs
- **`2025-10/`** (9 files) - October 2025 production readiness assessments
- **`assessments/`** (8 files) - Various compliance and feature audits
- **`pre-clean-break-20251025_092824/`** (10 files) - Pre-clean-break compliance docs

---

## Authoritative Documentation

For production deployment, refer to these **official** sources ONLY:

### Root-Level Documentation (PRIMARY)

1. **`README.md`** - System architecture, quick start, feature overview
   - **Key Update (Oct 27, 2025)**: Now correctly emphasizes Maryland rules engines as PRIMARY calculation system
   - PolicyEngine relegated to optional third-party verification

2. **`FEATURES.md`** - Complete feature catalog (110 features)
3. **`replit.md`** - Project overview, technical architecture, user preferences
4. **`DEPLOYMENT_RUNBOOK.md`** - Production deployment checklist for Maryland LDSS
5. **`SECURITY.md`** - Security policies and vulnerability reporting

### Official Documentation (`/docs/official/`)

- **Architecture**:
  - `DATABASE_SCHEMA.md` - Database schema reference
  - `API_ARCHITECTURE.md` - REST API design
  - `PWA_ARCHITECTURE.md` - Progressive Web App implementation

- **Compliance**:
  - `HIPAA_IMPLEMENTATION.md`
  - `IRS_PUB_1075_IMPLEMENTATION.md`
  - `NIST_800-53_IMPLEMENTATION.md`
  - `NIST_COMPLIANCE_FRAMEWORK.md`

- **Features**:
  - `BENEFITS_PROGRAMS.md` - 6 benefit programs (SNAP, Medicaid, TANF, LIHEAP, Tax, SSI)

- **AI Systems**:
  - `AI_ORCHESTRATION.md` - Gemini AI integration, RAG, caching

---

## Archive Contents Summary

### What's Archived (Historical Reference Only)

**Architecture Evolution**:
- Early microservices assessments
- Cache migration analyses
- Multi-state implementation planning
- E-filing infrastructure status reports

**Compliance Assessments**:
- Initial GDPR/HIPAA audits
- NIST 800-53 gap analyses
- Section 508 accessibility reviews
- SOC 2 readiness assessments

**Technical Documentation**:
- API design iterations
- Database schema evolution
- Integration guides (PolicyEngine, TaxSlayer, phone systems)
- Deployment checklists (early versions)

**Operational Guides**:
- Code patterns and standards
- Testing guides
- Troubleshooting procedures
- Performance optimization notes

---

## Key Architectural Clarifications

### Maryland Rules Engines vs. PolicyEngine

**Historical Confusion**: Early documentation (2024-12, 2025-01) sometimes portrayed PolicyEngine as the primary benefit calculation engine.

**Current Reality** (Oct 2025):
- **Maryland Rules Engines** are PRIMARY for all benefit calculations
  - `server/services/snapRulesEngine.ts`
  - `server/services/medicaidRulesEngine.ts`
  - `server/services/tanfRulesEngine.ts`
  - `server/services/liheapRulesEngine.ts`
  - `server/services/rulesEngineAdapter.ts` (358-line orchestrator)

- **PolicyEngine** is OPTIONAL for third-party verification only
  - Used for cross-validation when needed
  - Not required for production deployment
  - Credentials optional in environment setup

This distinction is now correctly reflected in `README.md` (updated Oct 27, 2025).

---

## Archive Retention Policy

### Keep Archived

Documents remain in `/docs/archive/` for:
- Historical reference
- Understanding system evolution
- Compliance audit trails
- Learning from past decisions

### Never Reference for Production

Archived documents should **NOT** be used for:
- Production deployment decisions
- Architecture understanding
- Feature implementation guides
- Compliance verification

Always refer to **official documentation** (root-level and `/docs/official/`) for authoritative guidance.

---

## Documentation Update Process

When making significant system changes:

1. **Update Root Docs First**: `README.md`, `FEATURES.md`, `replit.md`
2. **Update Official Docs**: `/docs/official/` subdirectories
3. **Create Archive Snapshot**: Move outdated docs to `/docs/archive/YYYY-MM/`
4. **Update This File**: Document what was archived and why

---

## Questions?

If you find conflicting information between archived and official documentation, always trust:
1. **Root-level docs** (README.md, FEATURES.md, replit.md)
2. **`/docs/official/`** subdirectories
3. Code implementation (source of truth)
4. **NOT** `/docs/archive/`

---

**Document Status**: Official  
**Authoritative**: Yes  
**Last Review**: October 27, 2025
