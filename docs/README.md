# JAWN Documentation Hub
**Joint Access Welfare Network** - Production-Ready Multi-State Benefits Platform  
Generated: 2025-10-29

> **📖 Primary Documentation**: See **[../replit.md](../replit.md)** for the authoritative single source of truth on system architecture, features, and preferences.

---

## 📋 Documentation Structure

```
docs/
├── official/               # Current, maintained documentation
│   ├── architecture/       # System design & technical architecture
│   ├── compliance/         # Security & regulatory compliance
│   ├── features/          # Feature specifications & guides
│   ├── ai-systems/        # AI/ML documentation (NIST SP 800-218A)
│   ├── integrations/      # External service integrations
│   ├── deployment/        # Deployment & operations guides
│   └── operations/        # Monitoring & maintenance
│
└── supplemental/          # White-label tenant resources
    ├── tenant-reporting/  # Custom report templates
    ├── legislative/       # Compliance reporting modules
    └── operational/       # Dashboard specifications
```

---

## 🎯 Quick Navigation

### For Developers
- [API Architecture](official/architecture/API_ARCHITECTURE.md) - REST API design & routes
- [Database Schema](official/architecture/DATABASE_SCHEMA.md) - 188-table PostgreSQL schema
- [AI Orchestration](official/ai-systems/AI_ORCHESTRATION.md) - Gemini API integration

### For Compliance Officers
- [NIST Compliance Framework](official/compliance/NIST_COMPLIANCE_FRAMEWORK.md) - SP 800-218 + 800-218A
- [NIST 800-53 Implementation](official/compliance/NIST_800-53_IMPLEMENTATION.md) - Security controls (code-verified)
- [IRS Pub 1075 Implementation](official/compliance/IRS_PUB_1075_IMPLEMENTATION.md) - Tax data protection (code-verified)
- [HIPAA Implementation](official/compliance/HIPAA_IMPLEMENTATION.md) - PHI safeguards (code-verified)

### For Product Managers
- [Benefits Programs](official/features/BENEFITS_PROGRAMS.md) - SNAP, Medicaid, TANF, LIHEAP

### For Government Partners
- [Funder Report Template](supplemental/tenant-reporting/FUNDER_REPORT_TEMPLATE.md) - Grant compliance reporting

---

## 🏗️ System Overview

### What is JAWN?
JAWN (Joint Access Welfare Network) is a production-ready, white-label multi-state platform that optimizes financial well-being by integrating public benefits eligibility with federal and state tax preparation. Currently deployed in Maryland with planned expansion to Pennsylvania and Virginia.

### Key Capabilities
- **6 Benefit Programs**: SNAP, Medicaid, TANF, LIHEAP/OHEP, SSI, Tax Credits
- **AI-Powered**: Google Gemini API for document analysis, RAG, and assistance
- **Multi-State**: State-level data isolation with office routing
- **White-Label**: Custom branding and reporting for government partners
- **Compliance-Ready**: NIST, IRS Pub 1075, HIPAA, GDPR, Section 508

### Business Model
- **Public Applicants**: FREE access to all services
- **Government Tenants**: Subscription for custom reporting and dashboards
- **Revenue Streams**: Funder reports, legislative compliance, operational analytics

---

## 📊 Technical Architecture

### Core Technologies
- **Backend**: Express.js, TypeScript, PostgreSQL (Drizzle ORM)
- **Frontend**: React 18, Vite, shadcn/ui, Tailwind CSS
- **AI/ML**: Google Gemini API (2.0-flash, embeddings)
- **Infrastructure**: Neon Database, Google Cloud Storage, Redis/Upstash
- **Security**: 3-tier KMS, AES-256-GCM encryption, SHA-256 audit chains

### Architectural Patterns
- **Hybrid Naming**: Federal program names in code, state names in UI
- **Multi-Tenant**: State-level isolation with office routing
- **Rules as Code**: Automated policy implementation
- **Immutable Audit**: Blockchain-style hash chains
- **Circuit Breakers**: Resilient external service integration

---

## 🔒 Compliance & Security

### NIST SP 800-218 + 800-218A Status
- **Prepare (PO)**: 80% Complete
- **Protect (PS)**: 75% Complete
- **Produce (PW)**: 70% Complete
- **Respond (RV)**: 60% Complete
- **AI Extensions**: 50% Complete

### Key Security Features
- Field-level encryption for PII/PHI
- Immutable audit logging with integrity verification
- Role-based access control with MFA support
- Cryptographic shredding for GDPR compliance
- Secure session management with PostgreSQL store

### Compliance Certifications
- **FedRAMP**: 60% Ready (needs formal processes)
- **SOC 2**: 70% Ready (controls implemented)
- **IRS Pub 1075**: 80% Ready (encryption complete)
- **HIPAA**: 85% Ready (technical controls strong)

---

## 📈 Current Status

### Maryland Production (100% Ready)
- 50,000+ users supported
- 6 benefit programs active
- VITA tax preparation integrated
- Express Lane Enrollment operational
- PolicyEngine third-party verification

### Pennsylvania Conceptual (Q1 2026)
- Architecture supports multi-state
- Program jargon glossary ready
- Office routing configured
- Awaiting state requirements

### Virginia Conceptual (Q1 2026)
- Infrastructure prepared
- Tenant isolation tested
- KMS hierarchy designed
- Pending policy integration

---

## 🚀 Getting Started

### For Local Development
```bash
# Install dependencies
npm install

# Sync database schema (188 tables)
npm run db:push

# Start development server
npm run dev
```

### Environment Variables Required
```
DATABASE_URL=          # PostgreSQL connection
GEMINI_API_KEY=        # Google AI API
REDIS_URL=             # Cache service
SESSION_SECRET=        # Cookie signing
GOOGLE_APPLICATION_CREDENTIALS=  # GCS
```

---

## 📚 Documentation Philosophy

### Single Source of Truth
**[replit.md](../replit.md)** is the authoritative documentation for all system architecture, features, and user preferences. All other documentation supplements this core document.

### "Assume Nothing" Approach
All documentation is generated from actual code inspection, not aspirational features. This ensures accuracy and prevents documentation drift.

### Two-Tier Documentation
1. **Official**: Current, maintained, code-verified compliance and architecture docs
2. **Supplemental**: Revenue-generating tenant resources and white-label materials

### NIST Compliance Focus
Documentation structure follows NIST SP 800-218 (SSDF) and SP 800-218A (AI) frameworks for regulatory alignment.

---

## 🔄 Update Schedule

### Weekly Updates
- Feature documentation as implemented
- API changes and additions
- Security patches and fixes

### Monthly Reviews
- Compliance status assessment
- Architecture evolution
- Performance optimization

### Quarterly Audits
- Full documentation verification
- Update compliance frameworks
- Sync with replit.md

---

## 📞 Support & Contact

### For Technical Issues
- Review [Troubleshooting Guide](official/operations/TROUBLESHOOTING.md)
- Check [Known Issues](official/operations/KNOWN_ISSUES.md)
- Contact DevOps team

### For Compliance Questions
- See [Compliance Framework](official/compliance/NIST_COMPLIANCE_FRAMEWORK.md)
- Review [Audit Logs](official/compliance/AUDIT_LOGGING.md)
- Contact Security team

### For Business Inquiries
- Read [White-Label Guide](supplemental/WHITE_LABEL_GUIDE.md)
- Review [Pricing Model](supplemental/PRICING_MODEL.md)
- Contact Partnership team

---

## 🗺️ Roadmap

### Q1 2025
- Complete NIST SP 800-218A compliance
- Launch Pennsylvania pilot
- Enhance AI adversarial testing

### Q2 2025
- Virginia deployment
- Advanced fraud detection
- Multi-language support

### Q3 2025
- Additional state expansions
- Self-hosted AI evaluation
- Mobile app development

### Q4 2025
- National rollout preparation
- Federal integration planning
- Performance optimization

---

**Note**: This is living documentation. For the authoritative single source of truth on system architecture and preferences, see [replit.md](../replit.md). For historical context, consult git history.
