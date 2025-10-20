# Maryland Universal Benefits-Tax Navigator - Documentation Index

**Last Updated:** October 17, 2025  
**Total Documentation:** 11,489 lines (root) + 360KB (docs/)  
**Platform Status:** ✅ Production Ready (92/100 readiness score)

This master index provides a complete map of all documentation across the Maryland Universal Benefits-Tax Service Delivery Platform. Use this guide to quickly locate information about any feature, system component, or deployment process.

---

## 📋 Quick Navigation

### For New Users
1. Start with [README.md](#readmemd) - Project overview
2. Review [replit.md](#replitmd) - Platform architecture & preferences  
3. Check [FEATURES.md](#featuresmd) - Complete feature catalog (87 features)

### For Developers
1. [docs/ARCHITECTURE.md](#docsarchitecturemd) - System architecture
2. [docs/API.md](#docsapimd) - Complete API reference
3. [docs/DATABASE.md](#docsdatabasemd) - Database schema

### For Deployment
1. [PRODUCTION_DEPLOYMENT_READINESS.md](#production_deployment_readinessmd) - **PRIMARY** production guide
2. [docs/DEPLOYMENT.md](#docsdeploymentmd) - Deployment instructions
3. [docs/SECURITY.md](#docssecuritymd) - Security configuration

### For Contributors
1. [CONTRIBUTING.md](#contributingmd) - Contribution guidelines
2. [docs/DESIGN-SYSTEM.md](#docsdesign-systemmd) - UI/UX design system

---

## 📚 Root-Level Documentation

### Production Readiness & Deployment

#### PRODUCTION_DEPLOYMENT_READINESS.md
**Status:** ✅ CURRENT (Oct 17, 2025) - **PRIMARY PRODUCTION GUIDE**  
**Lines:** 528  
**Purpose:** Comprehensive production deployment readiness report

**Contents:**
- Complete deployment checklist (security, database, monitoring, performance)
- E-filing infrastructure status (PDF ready, XML pending credentials)
- Production validation results (all 13 core tasks complete)
- Critical bug fixes documented
- Performance optimization details (50-70% cost reduction)
- Health check endpoints and monitoring setup

**When to Use:** Primary reference for production deployment. Start here for deployment planning.

---

#### PRODUCTION_READINESS_AUDIT.md
**Status:** ✅ CURRENT (Oct 15, 2025)  
**Lines:** 1,326  
**Purpose:** Comprehensive production readiness audit report

**Contents:**
- Feature inventory (87 total features: 46 documented + 41 discovered)
- Production readiness score: 92/100 (A-)
- Database tables: 99, API endpoints: 200+, Page components: 47
- System architecture assessment
- Security evaluation (96/100 - Excellent)
- Test coverage analysis (65/100 - Needs improvement)
- Complete feature-by-feature readiness assessment

**When to Use:** Detailed technical audit and gap analysis. Reference for understanding system capabilities.

---

#### PRODUCTION_SECURITY.md
**Status:** ✅ CURRENT  
**Lines:** 546  
**Purpose:** Production security hardening guide

**Contents:**
- Field-level encryption (AES-256-GCM) implementation
- Audit logging & compliance (HIPAA/IRS ready)
- PII masking & log redaction
- VITA certification validation
- Environment validation
- CORS security policy
- Session security hardening
- Rate limiting & DoS protection
- Security headers (Helmet configuration)

**When to Use:** Security configuration and hardening. Reference for compliance requirements.

---

#### SQL_INJECTION_AUDIT.md
**Status:** ✅ CURRENT (Oct 14, 2025)  
**Lines:** 174  
**Purpose:** SQL injection security audit

**Contents:**
- ✅ PASSED - No SQL injection vulnerabilities detected
- Drizzle ORM safety patterns
- Safe vs unsafe query patterns
- Code review methodology
- Mitigation strategies

**When to Use:** Security audit verification and safe coding patterns.

---

### Feature Documentation

#### FEATURES.md
**Status:** ✅ CURRENT (Oct 15, 2025)  
**Lines:** 2,230  
**Purpose:** Master feature catalog

**Contents:**
- **87 complete features** organized into 16 categories:
  1. Public Access Features (6)
  2. Eligibility & Calculation Tools (7)
  3. Application Assistance (3)
  4. Document Management (8)
  5. Tax Preparation & VITA (7)
  6. Navigator & Staff Tools (5)
  7. Quality Control & Compliance (6)
  8. Administration & Configuration (7)
  9. Developer & Integration Tools (4)
  10. Multi-Tenant & County Management (4)
  11. Legislative & Regulatory Tracking (6)
  12. Infrastructure & Platform Operations (8)
  13. Communication Systems (1)
  14. Notification System (4)
  15. Caching & Performance (6)
  16. Infrastructure & Mobile (6)

**Each Feature Includes:**
- Location/route
- User type & access level
- Purpose & description
- Feature list
- Technical details (files, APIs, components)
- Production status
- Completion notes

**When to Use:** Primary reference for understanding all platform capabilities. Use for feature discovery and technical implementation details.

---

#### TECHNICAL_DOCUMENTATION.md
**Status:** ✅ CURRENT (Oct 2025)  
**Lines:** 1,179  
**Purpose:** Complete technical implementation guide

**Contents:**
- System overview (6 benefit programs + tax preparation)
- Core architecture (React + Express + PostgreSQL + Gemini)
- Infrastructure & operations
- 87 features organized by category
- Previously undocumented features (41 discovered)
- Legislative tracking infrastructure
- Platform operations details
- Communication & notification architecture
- Caching & performance system
- Enhanced document management
- Quality control analytics

**When to Use:** Technical deep dive into system architecture and implementation details.

---

### Platform Reference

#### replit.md
**Status:** ✅ CURRENT (Updated Oct 17, 2025)  
**Purpose:** Primary platform reference & agent memory

**Contents:**
- Overview (platform purpose & capabilities)
- **Recent Changes** (Oct 17, 2025 updates)
- User Preferences (communication style)
- System Architecture (UI/UX, technical implementations, features)
- **Performance Optimizations Implemented** (caching, indexing)
- **E-Filing Infrastructure** (expanded section)
- **Production Deployment Checklist** (security, database, monitoring)
- External Dependencies

**When to Use:** Primary reference for platform state, architecture decisions, and user preferences. Updated continuously.

---

#### README.md
**Purpose:** Project introduction and quick start guide

**Contents:**
- Platform overview
- Key features summary
- Technology stack
- Quick start instructions
- Documentation links

**When to Use:** First-time orientation and project introduction.

---

### Outdated/Historical Documentation

#### DOCUMENTATION_COMPLETE.md
**Status:** ⚠️ OUTDATED (Oct 14, 2025)  
**Lines:** 212  
**Issue:** Claims "46 features complete" but production audit found 87 total features

**Contents:**
- Documentation coverage summary (outdated count)
- Master feature catalog reference
- Core documentation files updated
- Feature categories (incomplete list)

**Recommendation:** Archive or update to reflect 87-feature reality.

---

#### OPERATIONAL_READINESS.md
**Status:** ⚠️ OUTDATED (Oct 10, 2025)  
**Lines:** 677  
**Issue:** Pre-production assessment, mentions blocking issues that have been resolved

**Contents:**
- Pre-production status (now outdated)
- Policy document coverage (outdated)
- PolicyEngine blocking issues (RESOLVED)
- Alternative solutions (no longer needed)

**Recommendation:** Archive as historical record. Use PRODUCTION_DEPLOYMENT_READINESS.md instead.

---

#### STRATEGIC_ROADMAP.md
**Status:** ℹ️ HISTORICAL  
**Lines:** 821  
**Purpose:** Strategic roadmap and implementation plan

**Contents:**
- Phase 1: VITA Enhancement (✅ Complete)
- Phase 2: Tax Preparation Foundation
- Phase 3+: Future enhancements
- Integration plans

**When to Use:** Long-term planning and strategic direction. May need update to reflect current state.

---

#### CONTRIBUTING.md
**Status:** ✅ CURRENT  
**Lines:** 298  
**Purpose:** Contribution guidelines

**Contents:**
- Code of conduct
- Development setup
- How to contribute
- Coding standards
- License agreement

**When to Use:** Onboarding new contributors.

---

## 📁 docs/ Folder Documentation (360KB Total)

### Core Technical Documentation

#### docs/ARCHITECTURE.md
**Status:** ✅ CURRENT (Oct 2025)  
**Size:** 59KB (1,409 lines)  
**Purpose:** Complete system architecture guide

**Contents:**
- System overview (7 benefit programs)
- High-level architecture diagrams
- Component architecture
- Data flow patterns
- Multi-program architecture
- RAG + Rules as Code integration
- Service layer design
- Frontend architecture (React 18)
- Backend architecture (Express.js)
- Database architecture (PostgreSQL)
- External integrations
- Security architecture
- Performance & scalability
- Deployment architecture

**When to Use:** Understanding system design, architectural decisions, and technical patterns.

---

#### docs/API.md
**Status:** ✅ CURRENT (Oct 2025)  
**Size:** 46KB (2,553 lines)  
**Purpose:** Complete API reference documentation

**Contents:**
- Authentication & authorization
- Common response codes
- 23 endpoint categories:
  1. Core Endpoints
  2. Search & RAG
  3. Document Management
  4. Benefit Programs
  5. Rules as Code
  6. PolicyEngine Integration
  7. Navigator Workspace
  8. Manual & Policy Content
  9. Consent Management
  10. Rules Extraction
  11. Intake Copilot
  12. Notifications
  13. Policy Management
  14. Compliance
  15. Public Portal
  16. Scenario Modeling
  17. ABAWD & Enrollment
  18. Document Review Queue
  19. VITA Tax Assistance
  20. Audit & Monitoring
  21. Plus more...

**Each Endpoint Includes:**
- HTTP method & path
- Request parameters
- Request body schema
- Response format
- Error codes
- Example requests/responses

**When to Use:** API integration, frontend development, third-party integrations.

---

#### docs/DATABASE.md
**Status:** ✅ CURRENT  
**Size:** 47KB  
**Purpose:** Database schema and data model documentation

**Contents:**
- 99 database tables
- Table relationships & foreign keys
- Index strategies
- Data types & constraints
- Migration patterns
- Query optimization

**When to Use:** Database development, schema updates, performance optimization.

---

### Deployment & Operations

#### docs/DEPLOYMENT.md
**Status:** ✅ CURRENT  
**Size:** 24KB (1,058 lines)  
**Purpose:** Deployment guide

**Contents:**
- Prerequisites (Node.js, PostgreSQL, services)
- Environment variables (required & optional)
- Replit deployment
- Database setup
- Object storage configuration
- Email service configuration
- Build & deployment process
- Health checks & monitoring
- Scaling considerations
- Rollback procedures
- Troubleshooting

**When to Use:** Step-by-step deployment instructions for Replit and alternative platforms.

---

#### docs/PRODUCTION_DEPLOYMENT.md
**Status:** ✅ CURRENT  
**Size:** 11KB  
**Purpose:** Production deployment checklist

**Contents:**
- Pre-deployment checklist
- Environment setup
- Database migration
- Security configuration
- Monitoring setup
- Post-deployment verification

**When to Use:** Production deployment verification and checklist.

---

#### docs/E-FILING_INTEGRATION.md
**Status:** ✅ CURRENT  
**Size:** 22KB  
**Purpose:** E-filing integration guide

**Contents:**
- E-filing infrastructure overview
- IRS EFIN requirements
- Maryland iFile credentials
- Form 1040 XML generator (prototype)
- Maryland Form 502 XML generator (prototype)
- Digital signature configuration
- Test scenarios (10 IRS + 15 Maryland)
- Transmission requirements

**When to Use:** E-filing setup and credential acquisition. Reference for XML generation.

---

### Security Documentation

#### docs/SECURITY.md
**Status:** ✅ CURRENT  
**Size:** 24KB  
**Purpose:** Security implementation guide

**Contents:**
- Authentication & authorization
- Session management
- CSRF protection
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection
- Security headers
- Encryption standards
- Audit logging

**When to Use:** Security implementation and compliance verification.

---

#### docs/SECURITY_ADVISORY.md
**Status:** ✅ CURRENT  
**Size:** 8KB  
**Purpose:** Security advisory and best practices

**Contents:**
- Known security considerations
- Best practices
- Vulnerability reporting
- Security updates

**When to Use:** Security awareness and vulnerability management.

---

#### docs/ENCRYPTION_KEY_MANAGEMENT.md
**Status:** ✅ CURRENT  
**Size:** 1KB  
**Purpose:** Encryption key management guide

**Contents:**
- Key generation
- Key rotation
- Key storage
- Environment configuration

**When to Use:** Setting up field-level encryption (AES-256-GCM).

---

### UI/UX & Design

#### docs/DESIGN-SYSTEM.md
**Status:** ✅ CURRENT  
**Size:** 38KB  
**Purpose:** UI/UX design system

**Contents:**
- Maryland DHS design standards
- Component library (46+ features)
- Color palette (Maryland branding)
- Typography system
- Accessibility guidelines (WCAG 2.1 AA)
- Mobile-first patterns
- Responsive design
- Animation & transitions

**When to Use:** Frontend development, UI consistency, accessibility compliance.

---

#### docs/UX_OPTIMIZATION_ROADMAP.md
**Status:** ✅ CURRENT  
**Size:** 28KB  
**Purpose:** UX roadmap and enhancements

**Contents:**
- Implementation status (46+ features)
- Mobile optimization roadmap
- Accessibility enhancements
- Screening improvements
- Navigator tools UX
- Quality control UX
- Tax preparation UX
- Admin dashboard UX

**When to Use:** UX planning and future enhancements.

---

### Integration & Services

#### docs/INTEGRATION.md
**Status:** ✅ CURRENT  
**Size:** 37KB  
**Purpose:** External integration documentation

**Contents:**
- Google Gemini API integration
- PolicyEngine API integration
- Twilio SMS integration
- Email service integration
- Object storage integration
- Third-party services

**When to Use:** Setting up external service integrations.

---

#### docs/EMAIL-SETUP.md
**Status:** ✅ CURRENT  
**Size:** 8KB  
**Purpose:** Email service configuration

**Contents:**
- SMTP configuration
- Email templates
- Notification setup
- Transactional email

**When to Use:** Email notification setup.

---

#### docs/PER_Innovation_Alignment.md
**Status:** ✅ CURRENT  
**Size:** 10KB  
**Purpose:** Performance Excellence & Results (PER) innovation alignment

**Contents:**
- Innovation framework alignment
- Performance metrics
- Excellence standards
- Results tracking

**When to Use:** Performance evaluation and innovation tracking.

---

### IRS VITA Publications

#### Knowledge Base Sources
**Status:** ✅ CURRENT (Updated Oct 17, 2025)  
**Location:** `server/services/irsDirectDownloader.ts`  
**Purpose:** IRS tax guidance publications for VITA program

**IRS Publications Ingested (8 total):**

1. **IRS Pub 4012** - VITA/TCE Volunteer Resource Guide
   - Primary VITA reference guide for volunteer tax preparation
   - Tax Year: 2025

2. **IRS Pub 4491** - VITA/TCE Training Guide
   - Core VITA training guide with lessons for all certification levels
   - Tax Year: 2025

3. **IRS Pub 4491-X** - VITA/TCE Training Supplement
   - Updates to VITA training materials after initial printing
   - Revision: 1-2025

4. **IRS Pub 4961** - VITA/TCE Volunteer Standards of Conduct
   - Required ethics training for all VITA volunteers
   - Revision: 5-2025

5. **IRS Form 6744** - VITA/TCE Volunteer Assistor Test/Retest
   - Practice scenarios and certification test questions
   - Tax Year: 2025 tax returns

6. **IRS Pub 17** - Your Federal Income Tax ✨ NEW
   - Comprehensive individual tax guide (300+ pages)
   - Covers: Filing requirements, income types, deductions, credits
   - Tax Year: 2024

7. **IRS Pub 596** - Earned Income Credit (EIC) ✨ NEW
   - Comprehensive EITC guide with eligibility rules and examples
   - Covers: EITC eligibility, calculation tables, qualifying child requirements
   - Tax Year: 2024

8. **IRS Pub 972** - Child Tax Credit and Credit for Other Dependents ✨ NEW
   - CTC and ODC comprehensive guide
   - Covers: CTC/ODC eligibility, calculation, phase-out thresholds, Additional Child Tax Credit
   - Tax Year: 2024

**RAG Pipeline:**
- PDF download from IRS.gov (predictable URL pattern: `/pub/irs-pdf/p{number}.pdf`)
- Text extraction using pdf-parse library
- Semantic chunking (500-1000 character chunks with context preservation)
- Embedding generation via Google Gemini API
- Automatic weekly updates via Smart Scheduler

**When to Use:** Understanding VITA knowledge base sources, RAG system content, tax guidance capabilities.

---

## 🎯 Documentation by Use Case

### Use Case 1: "I'm deploying to production"
**Follow this path:**
1. [PRODUCTION_DEPLOYMENT_READINESS.md](#production_deployment_readinessmd) - Primary guide
2. [docs/DEPLOYMENT.md](#docsdeploymentmd) - Step-by-step instructions
3. [docs/SECURITY.md](#docssecuritymd) - Security configuration
4. [docs/PRODUCTION_DEPLOYMENT.md](#docsproduction_deploymentmd) - Final checklist
5. [PRODUCTION_SECURITY.md](#production_securitymd) - Security hardening

### Use Case 2: "I need to understand a specific feature"
**Follow this path:**
1. [FEATURES.md](#featuresmd) - Find feature in catalog (87 features)
2. [docs/API.md](#docsapimd) - API endpoints for that feature
3. [docs/ARCHITECTURE.md](#docsarchitecturemd) - Architecture context
4. [TECHNICAL_DOCUMENTATION.md](#technical_documentationmd) - Implementation details

### Use Case 3: "I'm setting up e-filing"
**Follow this path:**
1. [docs/E-FILING_INTEGRATION.md](#docse-filing_integrationmd) - E-filing setup guide
2. [PRODUCTION_DEPLOYMENT_READINESS.md](#production_deployment_readinessmd) - E-filing status section
3. [FEATURES.md](#featuresmd) - Tax Preparation & VITA features (#5)

### Use Case 4: "I'm debugging a security issue"
**Follow this path:**
1. [PRODUCTION_SECURITY.md](#production_securitymd) - Security features
2. [SQL_INJECTION_AUDIT.md](#sql_injection_auditmd) - SQL safety audit
3. [docs/SECURITY.md](#docssecuritymd) - Security implementation
4. [docs/SECURITY_ADVISORY.md](#docssecurity_advisorymd) - Known issues

### Use Case 5: "I'm building a new feature"
**Follow this path:**
1. [docs/ARCHITECTURE.md](#docsarchitecturemd) - System architecture
2. [docs/DATABASE.md](#docsdatabasemd) - Database schema
3. [docs/API.md](#docsapimd) - API patterns
4. [docs/DESIGN-SYSTEM.md](#docsdesign-systemmd) - UI components
5. [CONTRIBUTING.md](#contributingmd) - Development standards

### Use Case 6: "I need to integrate an external service"
**Follow this path:**
1. [docs/INTEGRATION.md](#docsintegrationmd) - Integration patterns
2. [docs/API.md](#docsapimd) - API reference
3. [replit.md](#replitmd) - External dependencies section

---

## 📊 Documentation Health Status

### ✅ Current & Production-Ready (Primary References)
- ✅ PRODUCTION_DEPLOYMENT_READINESS.md (Oct 17, 2025) - **PRIMARY GUIDE**
- ✅ FEATURES.md (Oct 15, 2025) - 87 features
- ✅ TECHNICAL_DOCUMENTATION.md (Oct 2025)
- ✅ PRODUCTION_READINESS_AUDIT.md (Oct 15, 2025)
- ✅ PRODUCTION_SECURITY.md
- ✅ SQL_INJECTION_AUDIT.md (Oct 14, 2025)
- ✅ replit.md (Updated Oct 17, 2025)
- ✅ All 14 docs/ folder files

### ⚠️ Outdated (Needs Update or Archive)
- ⚠️ DOCUMENTATION_COMPLETE.md (Oct 14, 2025) - Says 46 features, we have 87
- ⚠️ OPERATIONAL_READINESS.md (Oct 10, 2025) - Pre-production, blocking issues resolved

### ℹ️ Historical/Strategic (May Need Update)
- ℹ️ STRATEGIC_ROADMAP.md - Strategic planning document

### ✅ Standard (Evergreen)
- ✅ CONTRIBUTING.md - Contribution guidelines
- ✅ README.md - Project introduction

---

## 🔍 Quick Reference: Find Documentation for...

### Features & Capabilities
- **Complete feature list:** [FEATURES.md](#featuresmd) (87 features)
- **Feature implementation:** [TECHNICAL_DOCUMENTATION.md](#technical_documentationmd)
- **Feature architecture:** [docs/ARCHITECTURE.md](#docsarchitecturemd)

### Deployment & Operations
- **Production deployment:** [PRODUCTION_DEPLOYMENT_READINESS.md](#production_deployment_readinessmd)
- **Deployment steps:** [docs/DEPLOYMENT.md](#docsdeploymentmd)
- **Security hardening:** [PRODUCTION_SECURITY.md](#production_securitymd)

### Development
- **API reference:** [docs/API.md](#docsapimd)
- **Database schema:** [docs/DATABASE.md](#docsdatabasemd)
- **System architecture:** [docs/ARCHITECTURE.md](#docsarchitecturemd)
- **Design system:** [docs/DESIGN-SYSTEM.md](#docsdesign-systemmd)

### Security & Compliance
- **Security features:** [PRODUCTION_SECURITY.md](#production_securitymd)
- **SQL injection audit:** [SQL_INJECTION_AUDIT.md](#sql_injection_auditmd)
- **Security guide:** [docs/SECURITY.md](#docssecuritymd)
- **Encryption:** [docs/ENCRYPTION_KEY_MANAGEMENT.md](#docsencryption_key_managementmd)

### Special Features
- **E-filing:** [docs/E-FILING_INTEGRATION.md](#docse-filing_integrationmd)
- **Email setup:** [docs/EMAIL-SETUP.md](#docsemail-setupmd)
- **Integrations:** [docs/INTEGRATION.md](#docsintegrationmd)
- **UX roadmap:** [docs/UX_OPTIMIZATION_ROADMAP.md](#docsux_optimization_roadmapmd)

---

## 📝 Documentation Maintenance

### Last Audit: October 17, 2025

**Findings:**
- Total root docs: 11,489 lines across 11 files
- Total docs/ folder: ~360KB across 14 files
- Current production-ready docs: 9 files
- Outdated docs needing update: 2 files
- Historical/strategic docs: 1 file

**Recommendations:**
1. ✅ Update DOCUMENTATION_COMPLETE.md to reflect 87 features (not 46)
2. ✅ Archive OPERATIONAL_READINESS.md as historical (pre-production issues resolved)
3. ✅ Review and update STRATEGIC_ROADMAP.md to reflect current state
4. ✅ Continue using PRODUCTION_DEPLOYMENT_READINESS.md as primary deployment guide

### Next Audit: Recommended every major release or monthly

---

## 🆘 Support & Questions

### Getting Help
1. **Check this index** for the right documentation file
2. **Search FEATURES.md** for feature-specific information
3. **Review replit.md** for platform architecture and recent changes
4. **Consult PRODUCTION_DEPLOYMENT_READINESS.md** for deployment issues

### Contributing to Documentation
See [CONTRIBUTING.md](#contributingmd) for guidelines on improving documentation.

---

**Document Version:** 1.0  
**Last Updated:** October 17, 2025  
**Maintained by:** Development Team  
**Next Review:** November 2025
