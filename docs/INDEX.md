# JAWN Maryland Universal Benefits-Tax Navigator - Master Documentation Index

**LAST_UPDATED:** 2025-10-18T21:15:00Z  
**Platform Version:** 2.0  
**Documentation Status:** ✅ Fully Consolidated & Current  
**Production Readiness:** 92/100 (A Grade)

This master index provides complete navigation for all documentation across the Maryland Universal Benefits-Tax Service Delivery Platform (JAWN - Joint Access Welfare Network).

---

## 📊 Platform Statistics (Verified 2025-10-18)

| Metric | Count | Verification Method |
|--------|-------|-------------------|
| **Features** | 105 | `featureMetadata.ts` |
| **API Endpoints** | 469 | `grep -E "app\.(get\|post\|put\|patch\|delete)" routes.ts` |
| **Database Tables** | 173 | `grep "pgTable(" schema.ts` |
| **Frontend Pages** | 73 | Component count in `/client/src/pages` |
| **Backend Services** | 94 | Service file count in `/server/services` |
| **Test Coverage** | 65% | Vitest + Playwright tests |
| **WCAG Compliance** | 91.7% | axe-core automated testing |

---

## 🚀 Quick Start Guides

### For New Users
1. [README.md](/README.md) - Project overview and setup
2. [replit.md](/replit.md) - Living platform architecture
3. [SETUP_INSTRUCTIONS.md](/SETUP_INSTRUCTIONS.md) - Installation guide

### For Developers
1. [docs/official/platform/PLATFORM_DOCUMENTATION.md](/docs/official/platform/PLATFORM_DOCUMENTATION.md) - **PRIMARY** technical reference
2. [docs/API.md](/docs/API.md) - Complete API reference (469 endpoints)
3. [docs/DATABASE.md](/docs/DATABASE.md) - Database schema (173 tables)
4. [docs/ARCHITECTURE.md](/docs/ARCHITECTURE.md) - System architecture

### For Deployment
1. [docs/official/deployment/PRODUCTION_READINESS.md](/docs/official/deployment/PRODUCTION_READINESS.md) - **PRIMARY** production guide
2. [docs/DEPLOYMENT.md](/docs/DEPLOYMENT.md) - Deployment procedures
3. [docs/SECURITY.md](/docs/SECURITY.md) - Security configuration
4. [docs/official/deployment/WHITE_LABEL_FEASIBILITY_REPORT.md](/docs/official/deployment/WHITE_LABEL_FEASIBILITY_REPORT.md) - Multi-state deployment

---

## 📁 Official Documentation Structure

### /docs/official/platform/
| Document | Lines | Purpose | Last Updated |
|----------|-------|---------|--------------|
| [PLATFORM_DOCUMENTATION.md](official/platform/PLATFORM_DOCUMENTATION.md) | 1,200+ | Master technical reference | 2025-10-18T20:45:00Z |
| [UNFINISHED_ASSETS.md](official/platform/UNFINISHED_ASSETS.md) | 250+ | Incomplete features tracking | 2025-10-18T20:45:00Z |
| [PLATFORM_STATISTICS.md](official/platform/PLATFORM_STATISTICS.md) | 150+ | Verified platform metrics | 2025-10-18T21:00:00Z |

### /docs/official/deployment/
| Document | Lines | Purpose | Last Updated |
|----------|-------|---------|--------------|
| [PRODUCTION_READINESS.md](official/deployment/PRODUCTION_READINESS.md) | 800+ | Comprehensive deployment guide | 2025-10-18T20:45:00Z |
| [WHITE_LABEL_FEASIBILITY_REPORT.md](official/deployment/WHITE_LABEL_FEASIBILITY_REPORT.md) | 1,500+ | Multi-state deployment analysis | 2025-10-18T21:00:00Z |

### /docs/official/audits/
| Document | Lines | Purpose | Last Updated |
|----------|-------|---------|--------------|
| [UX_ANALYSIS.md](official/audits/UX_ANALYSIS.md) | 600+ | User experience analysis | 2025-10-18T21:00:00Z |
| [UI_ANALYSIS.md](official/audits/UI_ANALYSIS.md) | 500+ | Visual design consistency | 2025-10-18T21:00:00Z |
| [PERFORMANCE_ANALYSIS.md](official/audits/PERFORMANCE_ANALYSIS.md) | 700+ | Performance metrics & optimization | 2025-10-18T21:00:00Z |
| [SCALABILITY_ANALYSIS.md](official/audits/SCALABILITY_ANALYSIS.md) | 600+ | Scaling architecture review | 2025-10-18T21:00:00Z |
| [OPTIMIZATION_OPPORTUNITIES.md](official/audits/OPTIMIZATION_OPPORTUNITIES.md) | 800+ | Improvement roadmap | 2025-10-18T21:00:00Z |

---

## 🗂️ Technical Documentation (/docs/)

### Core Technical Guides
| Document | Purpose | Status |
|----------|---------|--------|
| [API.md](API.md) | REST API endpoints (469 total) | ✅ Current |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design patterns | ✅ Current |
| [DATABASE.md](DATABASE.md) | Schema & relationships (173 tables) | ✅ Current |
| [DATABASE_SETUP_INSTRUCTIONS.md](DATABASE_SETUP_INSTRUCTIONS.md) | PostgreSQL setup | ✅ Current |
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | UI/UX component library | ✅ Current |

### Integration & Deployment
| Document | Purpose | Status |
|----------|---------|--------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Basic deployment guide | ✅ Current |
| [E-FILING_INTEGRATION.md](E-FILING_INTEGRATION.md) | IRS/Maryland e-filing | ⚠️ Pending credentials |
| [INTEGRATION.md](INTEGRATION.md) | External service integration | ✅ Current |
| [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) | Production-specific deployment | ✅ Current |

### Security & Compliance
| Document | Purpose | Status |
|----------|---------|--------|
| [SECURITY.md](SECURITY.md) | Security architecture | ✅ Current |
| [SECURITY_ADVISORY.md](SECURITY_ADVISORY.md) | Known vulnerabilities | ✅ Current |
| [ENCRYPTION_KEY_MANAGEMENT.md](ENCRYPTION_KEY_MANAGEMENT.md) | AES-256-GCM procedures | ✅ Current |

### Feature Documentation
| Document | Purpose | Status |
|----------|---------|--------|
| [LIVING_POLICY_MANUAL.md](LIVING_POLICY_MANUAL.md) | Policy manual system | ✅ Complete |
| [TAXSLAYER_FSA_GUIDANCE.md](TAXSLAYER_FSA_GUIDANCE.md) | TaxSlayer integration | ✅ Current |
| [PER_Innovation_Alignment.md](PER_Innovation_Alignment.md) | Innovation alignment | ✅ Current |

### Configuration
| Document | Purpose | Status |
|----------|---------|--------|
| [EMAIL-SETUP.md](EMAIL-SETUP.md) | Email notification config | ✅ Current |

---

## 📦 Root Documentation

### Active Documentation
| Document | Purpose | Status |
|----------|---------|--------|
| [README.md](../README.md) | Project introduction | ✅ Current |
| [replit.md](../replit.md) | Living architecture reference | ✅ Current |
| [FEATURES.md](../FEATURES.md) | 105 feature catalog | ✅ Current |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution guidelines | ✅ Current |
| [TECHNICAL_DOCUMENTATION.md](../TECHNICAL_DOCUMENTATION.md) | System implementation details | ✅ Current |

### Security & Compliance
| Document | Purpose | Status |
|----------|---------|--------|
| [PRODUCTION_SECURITY.md](../PRODUCTION_SECURITY.md) | Security hardening | ✅ Current |
| [SQL_INJECTION_AUDIT.md](../SQL_INJECTION_AUDIT.md) | SQL security audit | ✅ Current |
| [THIRD_PARTY_STANDARDS_AUDIT.md](../THIRD_PARTY_STANDARDS_AUDIT.md) | WCAG 2.1 AAA compliance | ✅ Current |
| [ACCESSIBILITY_FOUNDATION.md](../ACCESSIBILITY_FOUNDATION.md) | Accessibility implementation | ✅ Current |

### Platform Assessment
| Document | Purpose | Status |
|----------|---------|--------|
| [APPLICATION_COHESION_REPORT.md](../APPLICATION_COHESION_REPORT.md) | Codebase structure analysis | ✅ Current |
| [POLICY_SOURCES_STATUS.md](../POLICY_SOURCES_STATUS.md) | Policy integration status | ✅ Current |
| [STRATEGIC_ROADMAP.md](../STRATEGIC_ROADMAP.md) | Long-term feature roadmap | ✅ Current |
| [VIBE_CODE_PROMPTS.md](../VIBE_CODE_PROMPTS.md) | AI assistant context | ✅ Current |
| [CONCURRENCY_FIX_SUMMARY.md](../CONCURRENCY_FIX_SUMMARY.md) | Race condition fixes | ✅ Historical |

---

## 🗄️ Archived Documentation (/docs/archive/)

| Document | Archive Date | Reason | Superseded By |
|----------|-------------|--------|--------------|
| DOCUMENTATION_COMPLETE.md | 2025-10-18 | Merged | PLATFORM_DOCUMENTATION.md |
| DOCUMENTATION_INDEX.md | 2025-10-18 | Merged | PLATFORM_DOCUMENTATION.md |
| DOCUMENTATION_INVENTORY.md | 2025-10-18 | Merged | PLATFORM_DOCUMENTATION.md |
| PRODUCTION_DEPLOYMENT_READINESS.md | 2025-10-18 | Merged | PRODUCTION_READINESS.md |
| PRODUCTION_READINESS_AUDIT.md | 2025-10-18 | Merged | PRODUCTION_READINESS.md |
| OPERATIONAL_READINESS.md | 2025-10-18 | Outdated | PRODUCTION_READINESS.md |
| NEW_FEATURES_OCT_16-17.md | 2025-10-18 | Date-specific | PLATFORM_DOCUMENTATION.md |
| PLATFORM_ASSESSMENT_OCT_17_2025.md | 2025-10-18 | Date-specific | PLATFORM_DOCUMENTATION.md |
| UX_OPTIMIZATION_ROADMAP.md | 2025-10-18 | Outdated | OPTIMIZATION_OPPORTUNITIES.md |
| UX_QUICK_WINS.md | 2025-10-18 | Outdated | UX_ANALYSIS.md |

---

## 🎯 Unfinished Assets Summary

### High Priority (Production Blockers)
- **E-Filing**: Awaiting IRS EFIN and Maryland iFile credentials
- **SMS Integration**: Twilio configuration pending

### Medium Priority (Feature Gaps)
- **PDF Export**: PolicyManualBrowser, FormBuilderPage (stub implementations)
- **Database Source Resolution**: Dynamic notification service incomplete
- **Test Coverage**: Only 65% coverage, missing unit tests

### Low Priority (Enhancements)
- **UI Polish**: 11 TODO/FIXME comments in components
- **Documentation**: Some API endpoints lack examples

See [UNFINISHED_ASSETS.md](official/platform/UNFINISHED_ASSETS.md) for complete tracking.

---

## 📈 Production Readiness Summary

**Overall Score: 92/100 (A Grade)**

| Category | Score | Status |
|----------|-------|--------|
| Database Schema | 98/100 | ✅ Excellent |
| Backend API | 95/100 | ✅ Excellent |
| Frontend UI | 90/100 | ✅ Very Good |
| Service Layer | 94/100 | ✅ Excellent |
| Error Handling | 88/100 | ✅ Good |
| Security | 96/100 | ✅ Excellent |
| Accessibility | 92/100 | ✅ Very Good |
| Test Coverage | 65/100 | ⚠️ Needs Improvement |

---

## 🚀 White-Label Readiness

**Readiness Score: 8.5/10**

- **70% Configuration-driven** customization
- **18-week implementation** timeline
- **Deployment templates** for states, federal agencies, non-profits
- **Multi-tenant architecture** supporting 5000+ concurrent users
- **Cost range**: $15K (small non-profit) to $500K (federal agency)

See [WHITE_LABEL_FEASIBILITY_REPORT.md](official/deployment/WHITE_LABEL_FEASIBILITY_REPORT.md) for complete analysis.

---

## 🔍 Documentation Search Tips

1. **By Feature**: Start with [FEATURES.md](../FEATURES.md)
2. **By API**: Search [API.md](API.md) by endpoint path
3. **By Database**: Check [DATABASE.md](DATABASE.md) by table name
4. **By Role**: Use role-specific sections in [PLATFORM_DOCUMENTATION.md](official/platform/PLATFORM_DOCUMENTATION.md)
5. **By Problem**: Check [UNFINISHED_ASSETS.md](official/platform/UNFINISHED_ASSETS.md) for known issues

---

## 📞 Support & Contact

For documentation updates or corrections, see [CONTRIBUTING.md](../CONTRIBUTING.md).

---

*Generated by JAWN Documentation System v3.0*  
*Maryland Department of Human Services*  
*Universal Benefits-Tax Navigator Platform*