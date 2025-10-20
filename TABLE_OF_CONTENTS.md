# Maryland Benefits Navigator (JAWN) - Master Table of Contents
## System Audit Report & Complete Documentation Index

### 📊 EXECUTIVE SUMMARY
- **System Name**: Joint Access Welfare Network (JAWN) 
- **Deployment**: Single instance at marylandbenefits.gov serving all 24 Maryland LDSS offices
- **Architecture**: Multi-tenant SaaS with county-based tenant isolation
- **Status**: Production-ready with critical AI features requiring validation
- **Audit Date**: October 20, 2025

---

## 🚨 CRITICAL FINDINGS FROM AUDIT

### ✅ Successfully Implemented Features
1. **Core Infrastructure**
   - PostgreSQL database with complete schema for all features
   - Multi-tenant architecture with 24 LDSS offices configured
   - Rate limiting fixed (IPv6 validation errors resolved)
   - WebSocket real-time updates working
   - CSRF protection and security headers in place

2. **Benefits & Tax Platform**
   - 6 benefit programs integrated (SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI)
   - PolicyEngine integration for calculations
   - Form 1040 and Maryland Form 502 generators
   - E-Filing dashboard with XML generation
   - Benefits Access Review (BAR) system with supervisor dashboard

3. **AI Services (Partially Implemented)**
   - Gemini API integration configured correctly
   - AI Intake Assistant service exists but has frontend connectivity issues
   - Cross-enrollment engine service implemented
   - RAG service with semantic search capabilities
   - Document intelligence with OCR (UnifiedDocumentService)
   - Predictive analytics service with basic implementation

### ⚠️ Issues Requiring Immediate Attention
1. **AI Intake Assistant** - Frontend fails to send messages (401 auth error)
2. **Voice Assistant** - Contains placeholder implementations
3. **Multiple TODO/STUB comments** found in 21 service files
4. **Documentation chaos** - 30+ scattered documentation files in root
5. **Missing database tables** for some AI features (crossEnrollmentPredictions, fraudDetection)

---

## 📁 PROJECT STRUCTURE

### Root Directory Files (To Be Consolidated)
```
/ (Root)
├── README.md (Main project documentation)
├── replit.md (Replit-specific configuration)
├── TABLE_OF_CONTENTS.md (This file - Master index)
├── LICENSE (MIT License)
├── package.json (Node dependencies)
├── drizzle.config.ts (Database configuration)
├── vite.config.ts (Build configuration)
├── ecosystem.config.js (PM2 deployment config)
└── [30+ documentation files to be archived]
```

### Core Directories
```
/client (Frontend - React/TypeScript/Vite)
├── /src
│   ├── /components (70+ React components)
│   │   ├── AIIntakeChat.tsx
│   │   ├── CrossEnrollmentWizard.tsx
│   │   ├── DocumentUpload.tsx
│   │   ├── FinancialOpportunityRadar.tsx
│   │   └── [66 other components]
│   ├── /pages (50+ page components)
│   │   ├── IntakeAssistant.tsx
│   │   ├── AIMonitoring.tsx
│   │   ├── CrossEnrollmentAdmin.tsx
│   │   └── [47 other pages]
│   ├── /lib (Utilities and helpers)
│   └── /hooks (Custom React hooks)

/server (Backend - Express/TypeScript)
├── /services (90+ service modules)
│   ├── aiIntakeAssistant.service.ts
│   ├── crossEnrollmentEngine.service.ts
│   ├── gemini.service.ts
│   ├── ragService.ts
│   ├── predictiveAnalytics.service.ts
│   └── [85+ other services]
├── /routes.ts (Main API router - 4500+ lines)
├── /db.ts (Database connection)
└── /middleware (Auth, CSRF, rate limiting)

/shared (Shared types and schemas)
├── schema.ts (Database schema - 8000+ lines)
└── types.ts (TypeScript type definitions)

/docs (Documentation - needs consolidation)
├── [Various API and feature documentation]

/tests (Test suites)
├── [Unit and integration tests]
```

---

## 🔧 SERVICES INVENTORY

### AI & Machine Learning Services (11 files)
- `aiIntakeAssistant.service.ts` - Conversational AI chat (needs frontend fix)
- `aiOrchestrator.ts` - Central AI coordination
- `aiService.ts` - Base AI functionality
- `crossEnrollmentEngine.service.ts` - Benefit prediction system
- `crossEnrollmentIntelligence.ts` - ML-based recommendations
- `gemini.service.ts` - Google Gemini API integration
- `predictiveAnalytics.service.ts` - Case outcome predictions
- `ragService.ts` - Semantic search and Q&A
- `textGenerationService.ts` - Content generation
- `voiceAssistant.service.ts` - Voice input/output (has stubs)
- `maive.service.ts` - Maryland AI Virtual Employee

### Document Processing Services (8 files)
- `unified/UnifiedDocumentService.ts` - Main document intelligence
- `documentAnalysisCache.ts` - Document analysis caching
- `documentVersioning.ts` - Version control for documents
- `manualDocumentExtractor.ts` - Manual extraction fallback
- `embeddingCache.ts` - Vector embedding storage
- `queryClassifier.ts` - Query intent classification
- `readingLevelService.ts` - Reading level analysis
- `programDetection.ts` - Auto-detect benefit programs

### Rules Engines (7 files)
- `rulesEngine.ts` - Main rules processor
- `rulesEngineAdapter.ts` - Rules system adapter
- `rulesExtractionService.ts` - Extract rules from text
- `medicaidRulesEngine.ts` - Medicaid-specific rules
- `ohepRulesEngine.ts` - OHEP energy assistance rules
- `tanfRulesEngine.ts` - TANF cash assistance rules
- `vitaTaxRulesEngine.ts` - VITA tax preparation rules

### Caching & Performance (8 files)
- `cacheOrchestrator.ts` - Central cache management
- `cacheService.ts` - Base caching functionality
- `redisCache.ts` - Redis/Upstash integration
- `ragCache.ts` - RAG query caching
- `policyEngineCache.ts` - PolicyEngine results cache
- `documentAnalysisCache.ts` - Document analysis cache
- `embeddingCache.ts` - Embedding vector cache
- `cacheMetrics.ts` - Cache performance metrics

### Integration Services (15 files)
- `policyEngine.service.ts` - PolicyEngine API client
- `policyEngineOAuth.ts` - OAuth for PolicyEngine
- `googleCalendar.ts` - Calendar integration
- `twilioConfig.ts` - SMS configuration
- `congressGovClient.ts` - Congress.gov API
- `govInfoClient.ts` - GovInfo API
- Various scraper services for policy sources

### Monitoring & Analytics (10 files)
- `metricsService.ts` - System metrics collection
- `healthCheckService.ts` - Health check endpoints
- `auditService.ts` - Audit logging
- `kpiTracking.service.ts` - KPI monitoring
- `qcAnalytics.service.ts` - Quality control analytics
- `leaderboard.service.ts` - Performance leaderboards
- `achievementSystem.service.ts` - Gamification
- `sentryService.ts` - Error tracking
- `alertService.ts` - Alert notifications
- `websocket.service.ts` - Real-time updates

### Security & Compliance (6 files)
- `encryption.service.ts` - Field-level encryption
- `passwordSecurity.service.ts` - Password hashing
- `gdpr.service.ts` - GDPR compliance
- `hipaa.service.ts` - HIPAA compliance
- `compliance.service.ts` - General compliance
- `auditLog.service.ts` - Security audit trail

---

## 📊 DATABASE SCHEMA SUMMARY

### Core Tables (47 total)
```sql
-- User & Authentication
users, sessions, tenants

-- Benefits & Applications
applications, applicationDocuments, applicationForms
householdProfiles, householdMembers
benefitPrograms, benefitEnrollments

-- AI & Intelligence
intakeSessions, intakeMessages (AI chat)
mlModels (machine learning models)
policyDocuments (with embeddings)

-- Tax Preparation
taxReturns, taxForms, taxDocuments
form1040Data, marylandForm502

-- Quality Control & Review
benefitsAccessReviews, supervisorReviews
qualityControlSamples

-- Compliance & Security
auditLogs, gdprConsents, hipaaDisclosures
encryptedFields

-- System
notifications, webhooks, metrics
cacheEntries, apiKeys
```

---

## 📋 IMMEDIATE ACTION ITEMS

### Priority 1 - Critical Fixes (Today)
1. **Fix AI Intake Assistant** - Resolve 401 auth error preventing message sending
2. **Remove stub implementations** - Replace placeholders in voice assistant and other services
3. **Test all AI features** - Verify document intelligence, cross-enrollment, and RAG actually work

### Priority 2 - Documentation Cleanup (This Week)
1. **Archive duplicate docs** - Move 25+ redundant files to `/docs/archive`
2. **Consolidate documentation** - Create single source of truth
3. **Update README.md** - Focus on deployment and usage

### Priority 3 - Code Optimization (Before Deployment)
1. **Remove unused dependencies** - Clean package.json
2. **Optimize bundle size** - Implement code splitting
3. **Add missing tests** - Cover critical AI features

---

## 🚀 DEPLOYMENT READINESS

### ✅ Ready for Production
- Database infrastructure
- Security & compliance features
- Core benefits calculation
- Tax form generation
- Multi-tenant architecture

### ⚠️ Needs Validation
- AI Intake Assistant functionality
- Document intelligence accuracy
- Cross-enrollment predictions
- Voice assistant features
- Load testing under concurrent AI requests

### 📝 Deployment Checklist
- [ ] Fix AI Intake Assistant auth issue
- [ ] Validate all AI features work end-to-end
- [ ] Run comprehensive test suite
- [ ] Clean up documentation
- [ ] Remove debug code and console.logs
- [ ] Configure production environment variables
- [ ] Set up monitoring and alerting
- [ ] Create deployment runbook

---

## 📚 DOCUMENTATION TO ARCHIVE

The following files should be moved to `/docs/archive`:
- ACCESSIBILITY_FOUNDATION.md
- APPLICATION_COHESION_REPORT.md
- CONCURRENCY_FIX_SUMMARY.md
- DOCUMENTATION_COMPLETE.md
- DOCUMENTATION_INDEX.md
- DOCUMENTATION_INVENTORY.md
- NEW_FEATURES_OCT_16-17.md
- OPERATIONAL_READINESS.md
- PLATFORM_ASSESSMENT_OCT_17_2025.md
- POLICY_SOURCES_STATUS.md
- PRODUCTION_DEPLOYMENT_READINESS.md
- PRODUCTION_READINESS_AUDIT.md
- PRODUCTION_SECURITY.md
- ROLLBACK_NOTES.md
- SQL_INJECTION_AUDIT.md
- STRATEGIC_ROADMAP.md
- TECHNICAL_DOCUMENTATION.md
- THIRD_PARTY_STANDARDS_AUDIT.md
- VIBE_CODE_PROMPTS.md

Keep in root:
- README.md (main documentation)
- replit.md (Replit config)
- TABLE_OF_CONTENTS.md (this file)
- LICENSE
- CONTRIBUTING.md
- FEATURES.md (user-facing features list)

---

## 🎯 CONCLUSION

The Maryland Benefits Navigator (JAWN) is a comprehensive system with strong foundational architecture. However, the claimed AI enhancements are only partially implemented:

**Working**: Core platform, benefits calculations, tax preparation, database, multi-tenant architecture
**Partially Working**: AI services exist but need frontend connectivity fixes and validation
**Needs Work**: Documentation organization, stub removal, comprehensive testing

The system can be deployed to production after addressing the Priority 1 critical fixes, particularly the AI Intake Assistant authentication issue.

---

*Last Updated: October 20, 2025*
*Audit Performed By: System Architecture Review*