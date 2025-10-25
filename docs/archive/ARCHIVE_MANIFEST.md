# Documentation Archive Manifest
Generated: 2025-01-01  
Purpose: Historical record of documentation evolution

## Archive Organization

### /2024-12/ - December 2024 Documentation
**Status**: Pre-production development phase  
**Key Context**: Initial system architecture, before multi-state refactor

- **API.md** - Original API architecture (superseded by multi-state routing)
- **ARCHITECTURE.md** - Initial monolithic architecture (replaced by microservices)
- **DATABASE.md** - Pre-migration schema (188 table drift issue)
- **DEPLOYMENT.md** - Early deployment strategy
- **PRODUCTION_DEPLOYMENT.md** - Production plans before white-label pivot
- **EMAIL-SETUP.md** - Email configuration (moved to notification service)
- **PHONE_SYSTEM_INTEGRATION.md** - SMS integration plans
- **ENCRYPTION_KEY_MANAGEMENT.md** - Early KMS design (updated to 3-tier)
- **SECURITY.md** - Initial security framework
- **SECURITY_ADVISORY.md** - Early vulnerability assessments
- **STATE_BENEFIT_PROGRAMS_REFERENCE.md** - Before federal/state hybrid naming
- **TECHNICAL_DECISIONS.md** - Architecture decisions log
- **INTEGRATION.md** - Third-party integration plans

### /2025-01/ - January 2025 Documentation
**Status**: LIHEAP refactor and schema drift resolution  
**Key Context**: Transition to federal program names, 188-table schema drift

**October 2024 Documentation**:
- **CACHING_MIGRATION_ANALYSIS.md** - Cache orchestrator implementation
- **COMPLIANCE_STANDARDS_VERIFICATION.md** - Pre-NIST alignment audit
- **CONSOLIDATION_OPPORTUNITIES.md** - Code consolidation analysis
- **FEATURE_CLASSIFICATION_AUDIT.md** - Feature inventory before reorganization
- **MICROSERVICES_ARCHITECTURE_ASSESSMENT.md** - Service decomposition analysis
- **MULTI_STATE_IMPLEMENTATION_PLAN.md** - State expansion strategy
- **POLICY_SOURCES_INVENTORY.md** - Policy scraping infrastructure
- **QUERY_OPTIMIZATION.md** - Database performance analysis
- **RULES_ENGINE_VERIFICATION.md** - Rules engine accuracy audit
- **TABLE_OF_CONTENTS.md** - Old documentation index

**Tax Filing Documentation**:
- **EFILE_INFRASTRUCTURE_STATUS.md** - Tax filing implementation status
- **E-FILING_INTEGRATION.md** - IRS MeF integration plans
- **TAXSLAYER_FSA_GUIDANCE.md** - TaxSlayer FSA integration

**UX/Design Documentation**:
- **DESIGN-SYSTEM.md** - UI component library documentation
- **UX_OPTIMIZATION_ROADMAP.md** - UX improvement plans
- **UX_QUICK_WINS.md** - Immediate UX fixes

**AI Context Files**:
- **AI_ORCHESTRATOR_SUMMARY.md** - AI service overview
- **AI_ORCHESTRATOR_USAGE.md** - AI implementation guide
- **CACHE_ORCHESTRATOR_IMPLEMENTATION_SUMMARY.md** - Caching strategy
- **code-patterns.md** - Development patterns
- **deployment-checklist.md** - Deployment guide

### /2025-10/ - October 2025 Documentation
**Status**: Pre-production finalization phase  
**Key Context**: Maryland production readiness, PA/VA conceptual

- **ARCHIVE_2025_FINALIZATION_ROADMAP.md** - Production timeline
- **ARCHIVE_MANIFEST.md** - October archive index
- **PRE_PRODUCTION_CHECKLIST.md** - Launch requirements
- **PRODUCTION_ENV_SETUP.md** - Environment configuration
- **PRODUCTION_READINESS_ROADMAP.md** - Readiness assessment
- **PRODUCTION_SECURITY.md** - Security hardening
- **PRODUCTION_SETUP_CHECKLIST.md** - Deployment checklist
- **STRATEGIC_ROADMAP.md** - Business strategy
- **TECHNICAL_DOCUMENTATION.md** - Technical overview

### /assessments/ - Point-in-Time Assessments
**Status**: Historical compliance and gap analyses  
**Key Context**: Various audit reports, not maintained

- **AI_ANALYTICS_ENGINES_AUDIT_REPORT.md** - AI system assessment
- **BEST_PRACTICES_COMPLIANCE_AUDIT.md** - Standards compliance
- **COMPETITIVE_GAP_ANALYSIS.md** - Market positioning
- **FEATURE_AUDIT_REPORT.md** - Feature completeness
- **GOVERNMENT_SECURITY_AUDIT_2025.md** - FedRAMP readiness
- **PER_Innovation_Alignment.md** - Innovation framework
- **PHASE_A_EVIDENCE_COLLECTION.md** - Evidence gathering
- **PHASE_ORGANIZATION_ROADMAP.md** - Phased implementation

## Why Documents Were Archived

### Schema Drift Documents
Files documenting the 188-table schema drift issue have been archived after resolution. The current schema audit (docs/official/architecture/DATABASE_SCHEMA_AUDIT.md) provides the accurate state.

### Pre-Refactor Documentation
Documentation created before the LIHEAP→federal naming refactor has been archived. The hybrid naming pattern (federal in code, state in display) is now standard.

### One-Time Audits
Assessment reports that represent point-in-time analyses have been archived. These provide historical context but don't require updates.

### Superseded Architecture
Documentation of earlier architectural decisions that have been replaced by current implementations (multi-state routing, 3-tier KMS, AI orchestration).

## Accessing Archived Documentation

All archived documentation remains accessible for:
- Historical context and decision rationale
- Audit trail for compliance reviews
- Understanding system evolution
- Recovery of institutional knowledge

## Retention Policy

- **Compliance-related**: 7 years per IRS Pub 1075
- **Architecture decisions**: Permanent retention
- **Assessment reports**: 3 years
- **Implementation guides**: Until system deprecation

## Migration Guide

For current documentation, see:
- `/docs/official/` - Maintained, NIST-compliant documentation
- `/docs/supplemental/` - Tenant reporting templates and add-ons
- `/docs/README.md` - Navigation and structure guide