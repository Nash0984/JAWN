# Database Schema Audit Report
Generated: 2025-01-01
Status: CRITICAL - Schema Drift Detected

## Executive Summary
The JAWN platform has a significant schema drift issue where 188 tables are declared in `shared/schema.ts` but only approximately 50-60 tables exist in the actual database. This discrepancy has been causing recurring migration prompts for 150+ tables over the past month, blocking production readiness.

## Schema Statistics
- **Tables Declared in Code**: 188 (verified via grep count)
- **Tables in Database**: ~50-60 (based on migration history)
- **Schema Drift**: ~130-140 tables
- **Migration Files**: 2 (December 2024, January 2025)

## Table Categories Found in Schema

### Core User & Authentication (6 tables)
- users - User accounts with MFA, retention tracking
- sessions - User sessions management
- mfaVerifications - MFA verification records
- passwordResets - Password reset tokens
- loginAttempts - Failed login tracking
- userPermissions - Permission assignments

### Multi-State Architecture (5 tables)
- stateTenants - State-level tenant isolation (MD, PA, VA, etc.)
- offices - State office locations for case routing
- officeRoles - User roles within offices
- routingRules - Intelligent case routing rules
- tenants - Legacy county-based tenants (deprecated)

### Benefits Programs (15+ tables)
- benefitPrograms - Master program registry (SNAP, Medicaid, TANF, LIHEAP, SSI, Tax)
- programJargonGlossary - Federal→State terminology mapping (LIHEAP→OHEP)
- snapRulesEngineData - SNAP eligibility rules
- medicaidRulesEngineData - Medicaid eligibility rules
- tanfRulesEngineData - TANF eligibility rules
- liheap_income_limits - LIHEAP/OHEP income thresholds
- liheap_benefit_tiers - Benefit calculation tiers
- liheap_seasonal_factors - Seasonal adjustments
- ssiCalculations - SSI benefit calculations
- vitaIntakeSessions - VITA tax preparation sessions

### Document Management (10+ tables)
- documents - Document storage records
- documentTypes - Document categorization
- dhsForms - Maryland DHS forms registry
- documentChunks - Chunked documents for RAG
- documentEmbeddings - Vector embeddings for search
- taxDocuments - Tax-specific documents
- documentRequirements - Required document templates
- documentVersions - Document version control
- documentIngestion - Ingestion pipeline tracking

### Household & Client Data (15+ tables)
- householdProfiles - Unified household data
- clientCases - Benefits case management
- intakeSessions - AI-powered intake sessions
- appointments - Appointment scheduling
- clientConsents - Consent tracking (IRS, HIPAA)
- consentForms - Consent form templates
- householdBenefitEstimations - Calculated benefits
- benefitsAccessReviews - Quality review records
- caseLifecycleEvents - Case history tracking
- crossEnrollmentOpportunities - Express Lane Enrollment

### Tax Preparation (20+ tables)
- taxslayerReturns - TaxSlayer integration
- taxslayerWorksheets - Tax calculation worksheets
- form1040Data - Federal tax form data
- form502Data - Maryland tax form data
- taxslayerAccountNumbers - Generated account numbers
- w2Forms - W-2 wage statements
- form1099Data - 1099 income forms
- scheduleCData - Business income
- scheduleEICData - Earned Income Credit
- childTaxCreditData - Child Tax Credit calculations

### Policy & Legislative Tracking (15+ tables)
- policySources - Policy manual sources
- federalBills - Federal legislation tracking
- marylandBills - State legislation tracking
- publicLaws - Enacted laws
- stateOptionsWaivers - CMS waivers
- marylandStateOptionStatus - MD waiver status
- ecfrEntries - Federal regulations
- congressApiCache - Congress.gov cache
- govInfoApiCache - GovInfo.gov cache
- legislativeAlerts - Policy change alerts

### AI & RAG System (10+ tables)
- searchQueries - User search history
- ragDocuments - RAG document store
- ragContext - Contextual embeddings
- chatSessions - AI chat sessions
- chatMessages - Chat message history
- aiModelUsage - Gemini API usage tracking
- monitoringMetrics - AI cost tracking
- contextCaches - Gemini context caching
- promptTemplates - System prompts

### Audit & Compliance (10+ tables)
- auditLogs - Immutable audit chain (SHA-256)
- auditChainVerification - Chain integrity checks
- complianceRules - Compliance requirements
- complianceViolations - Violation tracking
- dataRetentionSchedule - GDPR/IRS retention
- encryptionKeys - 3-tier KMS hierarchy
- securityAlerts - Security incident tracking
- systemHealthChecks - System monitoring

### Notifications & Communications (8+ tables)
- notifications - User notifications
- alertRules - Alert configuration
- alertHistory - Alert audit trail
- emailTemplates - Email templates
- smsMessages - SMS communications
- barNotifications - Benefits Access Review alerts
- taxpayerMessages - VITA messaging
- taxpayerMessageAttachments - Message attachments

### Training & Support (10+ tables)
- trainingJobs - ML model training
- trainingDocuments - Training datasets
- publicFaq - Public FAQ entries
- navigatorResources - Staff resources
- decisionPoints - Decision tree nodes
- noticeTemplates - Notice generation
- achievementBadges - Gamification badges
- userAchievements - User achievements
- leaderboardEntries - Performance tracking

### Analytics & Reporting (15+ tables)
- kpiMetrics - Key performance indicators
- systemMetrics - System performance
- officeMetrics - Office performance
- navigatorProductivity - Staff productivity
- crossEnrollmentAnalytics - Express Lane metrics
- benefitsCliffAnalysis - Cliff calculator results
- qcAnalytics - Quality control metrics
- usageAnalytics - Platform usage
- exportJobs - Report generation jobs

### Infrastructure (10+ tables)
- migrations - Database migrations
- cacheEntries - Redis cache mirror
- queueJobs - Background job queue
- webhookEndpoints - External webhooks
- apiKeys - API key management
- featureFlags - Feature toggles
- systemConfiguration - Platform config
- maintenanceWindows - Scheduled maintenance

## Critical Issues

### 1. Schema Drift Root Causes
- **Rapid feature development**: Features added to schema.ts without corresponding db:push
- **Migration hesitancy**: Developer avoiding 150+ CREATE/RENAME prompts
- **Missing CI/CD validation**: No automated schema consistency checks
- **Documentation lag**: Schema changes not documented

### 2. Production Impact
- **Developer velocity**: 5-10 minutes lost per db:push attempt
- **Deployment risk**: Unknown which tables are actually needed
- **Audit compliance**: Unclear data retention for non-existent tables
- **Performance**: Indexes defined for tables that don't exist

## Hybrid Naming Pattern
The schema implements a strategic hybrid naming pattern:
- **Infrastructure**: Federal program names (LIHEAP, SNAP, TANF)
- **Display**: State-specific names via `stateAgencyName` field
- **Translation**: `programJargonGlossary` table maps federal→state terms

Example:
```typescript
// Code uses federal name
liheap_income_limits table
liheapRulesEngine.ts service

// UI displays state name
"Office of Home Energy Programs (OHEP)" for Maryland
"LIHEAP" for Pennsylvania
```

## Recommendations

### Immediate Actions
1. **DO NOT attempt manual migration** - Will break existing data
2. **Use npm run db:push --force** after user completes pending prompts
3. **Document which tables are actually required for MVP**

### Long-term Solutions
1. **Schema pruning**: Remove unused table declarations
2. **Migration strategy**: Batch table creation by feature
3. **CI/CD validation**: Add schema drift detection
4. **Documentation**: Maintain table lifecycle documentation

## Next Steps
User should complete the manual migration prompts (5-10 minutes of pressing Enter) to sync all 188 tables, then the application can proceed with production readiness tasks.