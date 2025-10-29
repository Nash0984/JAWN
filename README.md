# JAWN - Joint Access Welfare Network
**Production-Ready Multi-State Benefits & Tax Platform**

> **📖 Full Documentation**: See **[replit.md](./replit.md)** for comprehensive system architecture, features, and technical details.

---

## What is JAWN?

JAWN is a white-label AI-powered platform that integrates public benefits eligibility (SNAP, Medicaid, TANF, LIHEAP, Tax Credits, SSI) with federal and state tax preparation (VITA). Currently deployed in Maryland with planned expansion to Pennsylvania and Virginia.

**Key Capabilities:**
- 🎯 Single household profile for benefits and tax
- 🤖 AI-powered document analysis (Google Gemini)
- 📊 State-controlled rules engines for eligibility
- 🔒 Enterprise-grade security (NIST, HIPAA, GDPR)
- 🌐 Multi-state architecture with tenant isolation

**Version:** 2.0.0 | **Status:** Production-Ready | **States:** Maryland (Live), PA/VA (Ready)

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon recommended)
- Google Gemini API key
- Google Cloud Storage access

### Installation

```bash
# Clone and install
npm install

# Configure environment (see .env.example)
cp .env.example .env
# Edit .env with your credentials

# Initialize database (188 tables)
npm run db:push

# Start development server
npm run dev
```

**Access:** http://localhost:5000

### Demo Accounts

Click **"Use Demo Account"** on login to see all available credentials:
- **Applicant**: `demo.applicant` / `Demo2024!`
- **Navigator**: `demo.navigator` / `Demo2024!`
- **Caseworker**: `demo.caseworker` / `Demo2024!`
- **Admin**: `demo.admin` / `Demo2024!`

---

## Core Documentation

| Document | Purpose |
|----------|---------|
| **[replit.md](./replit.md)** | **Single source of truth** - Complete system architecture, features, preferences |
| [CHANGELOG.md](./CHANGELOG.md) | Version history and release notes |
| [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) | Production deployment guide |
| [SECURITY.md](./SECURITY.md) | Security policy and vulnerability disclosure |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development guidelines |
| [docs/README.md](./docs/README.md) | Official compliance and architecture documentation |

---

## Technology Stack

- **Backend**: Express.js, TypeScript, PostgreSQL (Drizzle ORM)
- **Frontend**: React 18, Vite, shadcn/ui, Tailwind CSS
- **AI**: Google Gemini API (document analysis, RAG)
- **Infrastructure**: Neon Database, Google Cloud Storage, Redis/Upstash
- **Security**: 3-tier KMS, AES-256-GCM encryption, SHA-256 audit chains

---

## Compliance & Security

- ✅ NIST 800-53 controls implemented
- ✅ IRS Pub 1075 tax data protection
- ✅ HIPAA PHI safeguards
- ✅ GDPR data subject rights
- ✅ Section 508 accessibility
- ✅ Immutable audit logging with hash chaining

See [SECURITY.md](./SECURITY.md) for detailed security policy.

---

## Production Deployment

```bash
# Build for production
npm run build

# Start with PM2 cluster mode
npm run prod

# Or using ecosystem config
pm2 start ecosystem.config.js --env production
```

See [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) for complete deployment procedures.

---

## Support

- **Documentation**: [replit.md](./replit.md) | [docs/](./docs/)
- **Issues**: Report via GitHub Issues
- **Email**: security@jawn-platform.gov (security vulnerabilities only)

---

## License

MIT License - See [LICENSE](./LICENSE) for details.

---

**Built for human services agencies nationwide**  
*Last Updated: October 29, 2025 | v2.0.0*
