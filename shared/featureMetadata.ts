export interface FeatureMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  aiPowered: boolean;
  route: string;
  status: 'production-ready' | 'planned';
  tags: string[];
  icon?: string;
}

export const FEATURE_CATALOG: FeatureMetadata[] = [
  // PUBLIC ACCESS FEATURES (6)
  {
    id: 'public-01',
    name: 'Anonymous Benefit Screener',
    description: 'Quick eligibility check for Maryland benefit programs. No login required, 2-minute completion time.',
    category: 'Public Access',
    aiPowered: false,
    route: '/screener',
    status: 'production-ready',
    tags: ['public', 'screening', 'no-login', 'snap', 'medicaid', 'tanf'],
    icon: 'CheckCircle2'
  },
  {
    id: 'public-02',
    name: 'Quick Screener',
    description: 'Ultra-minimal 5-question eligibility check with 70% approval rate optimization.',
    category: 'Public Access',
    aiPowered: false,
    route: '/public/quick-screener',
    status: 'production-ready',
    tags: ['public', 'screening', 'no-login', 'inclusive'],
    icon: 'Zap'
  },
  {
    id: 'public-03',
    name: 'Document Checklist Generator',
    description: 'AI-powered generation of personalized document requirement checklists with program-specific requirements.',
    category: 'Public Access',
    aiPowered: true,
    route: '/public/documents',
    status: 'production-ready',
    tags: ['public', 'documents', 'ai', 'checklist'],
    icon: 'FileText'
  },
  {
    id: 'public-04',
    name: 'Notice Explainer',
    description: 'Plain-language explanation of DHS notices using Gemini AI. Reading level: Grade 6-8. Supports 10 languages.',
    category: 'Public Access',
    aiPowered: true,
    route: '/public/notices',
    status: 'production-ready',
    tags: ['public', 'ai', 'notices', 'multilingual', 'plain-language'],
    icon: 'MessageSquare'
  },
  {
    id: 'public-05',
    name: 'Simplified Policy Search',
    description: 'RAG-powered natural language search of Maryland SNAP policy manual for public access.',
    category: 'Public Access',
    aiPowered: true,
    route: '/public/search',
    status: 'production-ready',
    tags: ['public', 'search', 'rag', 'policy'],
    icon: 'Search'
  },
  {
    id: 'public-06',
    name: 'FSA Landing Page',
    description: 'Free SNAP Application landing page with resources and support information.',
    category: 'Public Access',
    aiPowered: false,
    route: '/public/fsa',
    status: 'production-ready',
    tags: ['public', 'fsa', 'snap', 'resources'],
    icon: 'Home'
  },

  // ELIGIBILITY & CALCULATION TOOLS (7)
  {
    id: 'eligibility-01',
    name: 'Financial Opportunity Radar',
    description: 'Real-time cross-program eligibility tracking across 6 programs with dynamic change indicators and smart alerts.',
    category: 'Eligibility & Calculation',
    aiPowered: true,
    route: '/household-profiler',
    status: 'production-ready',
    tags: ['eligibility', 'cross-enrollment', 'real-time', 'ai', 'flagship'],
    icon: 'Radar'
  },
  {
    id: 'eligibility-02',
    name: 'Household Profiler',
    description: 'Unified household data collection for benefits and tax with single data entry and real-time eligibility updates.',
    category: 'Eligibility & Calculation',
    aiPowered: false,
    route: '/household-profiler',
    status: 'production-ready',
    tags: ['household', 'data-entry', 'benefits', 'tax'],
    icon: 'Users'
  },
  {
    id: 'eligibility-03',
    name: 'PolicyEngine Integration',
    description: 'Accurate multi-benefit calculations using federal and Maryland-specific rules for SNAP, Medicaid, EITC, CTC, SSI, TANF.',
    category: 'Eligibility & Calculation',
    aiPowered: false,
    route: '/eligibility',
    status: 'production-ready',
    tags: ['policyengine', 'calculation', 'benefits', 'tax'],
    icon: 'Calculator'
  },
  {
    id: 'eligibility-04',
    name: 'Household Scenario Workspace',
    description: 'Compare multiple household configurations with side-by-side benefit comparisons, visual charts, and PDF export.',
    category: 'Eligibility & Calculation',
    aiPowered: false,
    route: '/scenarios',
    status: 'production-ready',
    tags: ['scenarios', 'what-if', 'comparison', 'pdf'],
    icon: 'GitCompare'
  },
  {
    id: 'eligibility-05',
    name: 'Eligibility Checker',
    description: 'Detailed eligibility determination with program-specific checks, income/asset verification, and deduction calculations.',
    category: 'Eligibility & Calculation',
    aiPowered: false,
    route: '/eligibility',
    status: 'production-ready',
    tags: ['eligibility', 'verification', 'benefits'],
    icon: 'CheckSquare'
  },
  {
    id: 'eligibility-06',
    name: 'Rules Engine',
    description: 'Complex eligibility rules engine for SNAP, Medicaid, TANF, and OHEP with categorical eligibility support.',
    category: 'Eligibility & Calculation',
    aiPowered: false,
    route: '/admin/rules',
    status: 'production-ready',
    tags: ['rules-engine', 'benefits', 'eligibility'],
    icon: 'GitBranch'
  },
  {
    id: 'eligibility-07',
    name: 'PolicyEngine Verification Badge',
    description: 'Visual verification badge showing PolicyEngine calculation accuracy and verification status.',
    category: 'Eligibility & Calculation',
    aiPowered: false,
    route: '/eligibility',
    status: 'production-ready',
    tags: ['policyengine', 'verification', 'trust'],
    icon: 'BadgeCheck'
  },

  // APPLICATION ASSISTANCE (3)
  {
    id: 'application-01',
    name: 'Adaptive Intake Copilot',
    description: 'Conversational AI-guided SNAP application with natural language conversation, smart data extraction, and real-time benefit estimates.',
    category: 'Application Assistance',
    aiPowered: true,
    route: '/intake',
    status: 'production-ready',
    tags: ['ai', 'intake', 'snap', 'conversation', 'gemini'],
    icon: 'Bot'
  },
  {
    id: 'application-02',
    name: 'VITA Tax Intake',
    description: 'Digital IRS Form 13614-C workflow with AI-powered data extraction from tax documents via Gemini Vision.',
    category: 'Application Assistance',
    aiPowered: true,
    route: '/vita-intake',
    status: 'production-ready',
    tags: ['vita', 'tax', 'intake', 'ai', 'gemini-vision'],
    icon: 'FileCheck'
  },
  {
    id: 'application-03',
    name: 'Tax Preparation',
    description: 'Federal and Maryland state tax return preparation with Form 1040/502 generation and 24 county tax calculations.',
    category: 'Application Assistance',
    aiPowered: false,
    route: '/tax',
    status: 'production-ready',
    tags: ['tax', 'vita', 'irs', 'maryland'],
    icon: 'Receipt'
  },

  // DOCUMENT MANAGEMENT (8)
  {
    id: 'document-01',
    name: 'Document Verification System',
    description: 'AI-powered document verification with Gemini Vision analysis, requirement matching, and verification stamps.',
    category: 'Document Management',
    aiPowered: true,
    route: '/verify',
    status: 'production-ready',
    tags: ['documents', 'verification', 'ai', 'gemini-vision'],
    icon: 'FileCheck2'
  },
  {
    id: 'document-02',
    name: 'Document Review Queue',
    description: 'Staff review workflow for uploaded documents with queue management, approval/rejection, and SLA tracking.',
    category: 'Document Management',
    aiPowered: false,
    route: '/navigator/document-review',
    status: 'production-ready',
    tags: ['documents', 'queue', 'staff', 'workflow'],
    icon: 'Inbox'
  },
  {
    id: 'document-03',
    name: 'Document Upload',
    description: 'Uppy-based upload with Google Cloud Storage integration, mobile camera support, and drag-and-drop interface.',
    category: 'Document Management',
    aiPowered: false,
    route: '/upload',
    status: 'production-ready',
    tags: ['documents', 'upload', 'storage', 'mobile'],
    icon: 'Upload'
  },
  {
    id: 'document-04',
    name: 'Document Versioning System',
    description: 'Automatic version creation on updates with version history tracking, diff visualization, and rollback capability.',
    category: 'Document Management',
    aiPowered: false,
    route: '/admin',
    status: 'production-ready',
    tags: ['documents', 'versioning', 'audit'],
    icon: 'History'
  },
  {
    id: 'document-05',
    name: 'Golden Source Tracking',
    description: 'Maintain authoritative source document references with change detection and integrity validation.',
    category: 'Document Management',
    aiPowered: false,
    route: '/admin/sources',
    status: 'production-ready',
    tags: ['documents', 'sources', 'integrity'],
    icon: 'Link'
  },
  {
    id: 'document-06',
    name: 'Document Hash Verification',
    description: 'SHA-256 hash generation and verification for document integrity and tamper detection.',
    category: 'Document Management',
    aiPowered: false,
    route: '/admin',
    status: 'production-ready',
    tags: ['documents', 'security', 'integrity'],
    icon: 'Shield'
  },
  {
    id: 'document-07',
    name: 'Automated Document Sync',
    description: 'Scheduled document synchronization from authoritative sources with change detection and retry logic.',
    category: 'Document Management',
    aiPowered: false,
    route: '/admin',
    status: 'production-ready',
    tags: ['documents', 'sync', 'automation'],
    icon: 'RefreshCw'
  },
  {
    id: 'document-08',
    name: 'Tax Document Classification',
    description: 'AI-powered classification of tax documents (W-2, 1099, 1095-A) using Gemini Vision with confidence scoring.',
    category: 'Document Management',
    aiPowered: true,
    route: '/vita-intake',
    status: 'production-ready',
    tags: ['documents', 'tax', 'ai', 'classification'],
    icon: 'Tags'
  },

  // TAX PREPARATION & VITA (7)
  {
    id: 'tax-01',
    name: 'VITA Knowledge Base',
    description: 'RAG-powered search of IRS Publication 17, VITA certification materials, and tax law updates.',
    category: 'Tax Preparation & VITA',
    aiPowered: true,
    route: '/vita',
    status: 'production-ready',
    tags: ['vita', 'tax', 'knowledge-base', 'rag'],
    icon: 'Book'
  },
  {
    id: 'tax-02',
    name: 'Cross-Enrollment Intelligence Engine',
    description: 'AI analysis of tax return data to identify unclaimed benefits with benefit value estimation.',
    category: 'Tax Preparation & VITA',
    aiPowered: true,
    route: '/tax',
    status: 'production-ready',
    tags: ['tax', 'cross-enrollment', 'ai', 'benefits'],
    icon: 'Brain'
  },
  {
    id: 'tax-03',
    name: 'County Tax Rate Management',
    description: 'Database-backed county tax rates for all 24 Maryland counties with tax year versioning and admin UI.',
    category: 'Tax Preparation & VITA',
    aiPowered: false,
    route: '/admin/county-tax-rates',
    status: 'production-ready',
    tags: ['tax', 'maryland', 'counties', 'admin'],
    icon: 'MapPin'
  },
  {
    id: 'tax-04',
    name: 'Maryland Credit Calculations',
    description: 'Maryland EITC supplement and state-specific tax credit calculations with PolicyEngine integration.',
    category: 'Tax Preparation & VITA',
    aiPowered: false,
    route: '/tax',
    status: 'production-ready',
    tags: ['tax', 'maryland', 'credits', 'eitc'],
    icon: 'DollarSign'
  },
  {
    id: 'tax-05',
    name: 'Form 1040 Generator',
    description: 'IRS Form 1040 PDF generation with federal tax calculations and e-file XML export.',
    category: 'Tax Preparation & VITA',
    aiPowered: false,
    route: '/tax',
    status: 'production-ready',
    tags: ['tax', 'irs', 'form-1040', 'pdf'],
    icon: 'FileOutput'
  },
  {
    id: 'tax-06',
    name: 'Form 502 Generator',
    description: 'Maryland Form 502 PDF generation with county tax calculations and state credits.',
    category: 'Tax Preparation & VITA',
    aiPowered: false,
    route: '/tax',
    status: 'production-ready',
    tags: ['tax', 'maryland', 'form-502', 'pdf'],
    icon: 'FileType'
  },
  {
    id: 'tax-07',
    name: 'TaxSlayer Integration',
    description: 'Export tax preparation data to TaxSlayer Pro for e-filing with field mapping and validation.',
    category: 'Tax Preparation & VITA',
    aiPowered: false,
    route: '/tax',
    status: 'production-ready',
    tags: ['tax', 'taxslayer', 'integration', 'efile'],
    icon: 'ExternalLink'
  },

  // NAVIGATOR & STAFF TOOLS (5)
  {
    id: 'navigator-01',
    name: 'Navigator Workspace',
    description: 'Comprehensive workspace for navigators with client management, case notes, and task tracking.',
    category: 'Navigator & Staff Tools',
    aiPowered: false,
    route: '/navigator',
    status: 'production-ready',
    tags: ['navigator', 'staff', 'workspace', 'case-management'],
    icon: 'Briefcase'
  },
  {
    id: 'navigator-02',
    name: 'Caseworker Cockpit',
    description: 'Unified dashboard for caseworkers with client queue, pending tasks, and performance metrics.',
    category: 'Navigator & Staff Tools',
    aiPowered: false,
    route: '/caseworker/cockpit',
    status: 'production-ready',
    tags: ['caseworker', 'staff', 'dashboard', 'queue'],
    icon: 'LayoutDashboard'
  },
  {
    id: 'navigator-03',
    name: 'Supervisor Cockpit',
    description: 'Supervisor oversight dashboard with team performance, quality metrics, and audit capabilities.',
    category: 'Navigator & Staff Tools',
    aiPowered: false,
    route: '/supervisor/cockpit',
    status: 'production-ready',
    tags: ['supervisor', 'staff', 'oversight', 'metrics'],
    icon: 'Eye'
  },
  {
    id: 'navigator-04',
    name: 'Appointments Calendar',
    description: 'Google Calendar integration for VITA appointment scheduling with automated reminders.',
    category: 'Navigator & Staff Tools',
    aiPowered: false,
    route: '/appointments',
    status: 'production-ready',
    tags: ['appointments', 'calendar', 'vita', 'google'],
    icon: 'Calendar'
  },
  {
    id: 'navigator-05',
    name: 'Policy Chat Widget',
    description: 'RAG-powered policy Q&A chat widget for staff with policy citations and context.',
    category: 'Navigator & Staff Tools',
    aiPowered: true,
    route: '/manual',
    status: 'production-ready',
    tags: ['policy', 'chat', 'rag', 'staff'],
    icon: 'MessageCircle'
  },

  // QUALITY CONTROL & COMPLIANCE (6)
  {
    id: 'qc-01',
    name: 'Data Quality Dashboard',
    description: 'Comprehensive data quality monitoring with completeness checks and validation rules.',
    category: 'Quality Control & Compliance',
    aiPowered: false,
    route: '/admin',
    status: 'production-ready',
    tags: ['quality', 'data', 'monitoring'],
    icon: 'BarChart3'
  },
  {
    id: 'qc-02',
    name: 'ABAWD Verification Admin',
    description: 'ABAWD (Able-Bodied Adults Without Dependents) work requirement tracking and verification.',
    category: 'Quality Control & Compliance',
    aiPowered: false,
    route: '/admin/abawd-verifications',
    status: 'production-ready',
    tags: ['snap', 'abawd', 'compliance', 'verification'],
    icon: 'UserCheck'
  },
  {
    id: 'qc-03',
    name: 'Compliance Admin',
    description: 'Program compliance monitoring with policy adherence tracking and audit trails.',
    category: 'Quality Control & Compliance',
    aiPowered: false,
    route: '/admin/compliance',
    status: 'production-ready',
    tags: ['compliance', 'audit', 'monitoring'],
    icon: 'ShieldCheck'
  },
  {
    id: 'qc-04',
    name: 'Audit Logs',
    description: 'Comprehensive audit logging of all system actions with search and export capabilities.',
    category: 'Quality Control & Compliance',
    aiPowered: false,
    route: '/admin/audit-logs',
    status: 'production-ready',
    tags: ['audit', 'logs', 'security'],
    icon: 'ScrollText'
  },
  {
    id: 'qc-05',
    name: 'IRS Consent Management',
    description: 'IRS tax return authorization (Form 8879) tracking and consent workflow management.',
    category: 'Quality Control & Compliance',
    aiPowered: false,
    route: '/consent',
    status: 'production-ready',
    tags: ['irs', 'consent', 'compliance', 'vita'],
    icon: 'FileSignature'
  },
  {
    id: 'qc-06',
    name: 'E-File Monitoring',
    description: 'Monitor IRS e-file status, track submissions, and handle rejections with automated workflows.',
    category: 'Quality Control & Compliance',
    aiPowered: false,
    route: '/admin/efile-monitoring',
    status: 'production-ready',
    tags: ['efile', 'irs', 'monitoring', 'vita'],
    icon: 'Send'
  },

  // ADMINISTRATION & CONFIGURATION (7)
  {
    id: 'admin-01',
    name: 'Admin Dashboard',
    description: 'Centralized administration dashboard with system configuration and user management.',
    category: 'Administration',
    aiPowered: false,
    route: '/admin',
    status: 'production-ready',
    tags: ['admin', 'configuration', 'management'],
    icon: 'Settings'
  },
  {
    id: 'admin-02',
    name: 'User Management',
    description: 'User account creation, role assignment, and permission management.',
    category: 'Administration',
    aiPowered: false,
    route: '/admin',
    status: 'production-ready',
    tags: ['admin', 'users', 'roles', 'permissions'],
    icon: 'Users2'
  },
  {
    id: 'admin-03',
    name: 'County Management',
    description: 'Multi-county deployment management with county-specific configuration.',
    category: 'Administration',
    aiPowered: false,
    route: '/admin/counties',
    status: 'production-ready',
    tags: ['admin', 'counties', 'multi-tenant'],
    icon: 'Building2'
  },
  {
    id: 'admin-04',
    name: 'Feedback Management',
    description: 'User feedback collection and management with sentiment analysis and response tracking.',
    category: 'Administration',
    aiPowered: false,
    route: '/admin/feedback',
    status: 'production-ready',
    tags: ['admin', 'feedback', 'support'],
    icon: 'MessageSquareText'
  },
  {
    id: 'admin-05',
    name: 'SMS Configuration',
    description: 'Twilio SMS integration configuration with template management and delivery tracking.',
    category: 'Administration',
    aiPowered: false,
    route: '/admin/sms-config',
    status: 'production-ready',
    tags: ['admin', 'sms', 'twilio', 'communication'],
    icon: 'Smartphone'
  },
  {
    id: 'admin-06',
    name: 'Webhook Management',
    description: 'Configure and manage webhooks for external system integrations with retry logic.',
    category: 'Administration',
    aiPowered: false,
    route: '/admin/webhooks',
    status: 'production-ready',
    tags: ['admin', 'webhooks', 'integration'],
    icon: 'Webhook'
  },
  {
    id: 'admin-07',
    name: 'Training Module',
    description: 'Staff training materials and certification tracking for VITA and benefit programs.',
    category: 'Administration',
    aiPowered: false,
    route: '/training',
    status: 'production-ready',
    tags: ['admin', 'training', 'staff', 'vita'],
    icon: 'GraduationCap'
  },

  // DEVELOPER & INTEGRATION TOOLS (4)
  {
    id: 'dev-01',
    name: 'API Documentation',
    description: 'OpenAPI/Swagger documentation for all 367 API endpoints with interactive testing.',
    category: 'Developer & Integration',
    aiPowered: false,
    route: '/admin/api-docs',
    status: 'production-ready',
    tags: ['api', 'documentation', 'developer', 'swagger'],
    icon: 'Code2'
  },
  {
    id: 'dev-02',
    name: 'Developer Portal',
    description: 'Developer resources including API keys, rate limits, and integration guides.',
    category: 'Developer & Integration',
    aiPowered: false,
    route: '/developer',
    status: 'production-ready',
    tags: ['developer', 'api', 'integration'],
    icon: 'Terminal'
  },
  {
    id: 'dev-03',
    name: 'System Architecture',
    description: 'Visual system architecture documentation with component relationships and data flows.',
    category: 'Developer & Integration',
    aiPowered: false,
    route: '/admin',
    status: 'production-ready',
    tags: ['architecture', 'documentation', 'developer'],
    icon: 'Network'
  },
  {
    id: 'dev-04',
    name: 'Evaluation Framework',
    description: 'Program evaluation framework with KPI tracking and outcome measurement.',
    category: 'Developer & Integration',
    aiPowered: false,
    route: '/admin/evaluation',
    status: 'production-ready',
    tags: ['evaluation', 'kpi', 'metrics'],
    icon: 'TrendingUp'
  },

  // MULTI-TENANT & COUNTY MANAGEMENT (4)
  {
    id: 'tenant-01',
    name: 'Multi-County Deployment',
    description: 'Support for all 24 Maryland counties with county-specific branding and configuration.',
    category: 'Multi-Tenant & County',
    aiPowered: false,
    route: '/admin/counties',
    status: 'production-ready',
    tags: ['multi-tenant', 'counties', 'branding'],
    icon: 'Globe'
  },
  {
    id: 'tenant-02',
    name: 'County Analytics',
    description: 'County-level analytics dashboard with performance metrics and program impact tracking.',
    category: 'Multi-Tenant & County',
    aiPowered: false,
    route: '/admin/county-analytics',
    status: 'production-ready',
    tags: ['analytics', 'counties', 'metrics'],
    icon: 'PieChart'
  },
  {
    id: 'tenant-03',
    name: 'County Header Branding',
    description: 'Dynamic county branding with logo, colors, and contact information.',
    category: 'Multi-Tenant & County',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['branding', 'counties', 'ui'],
    icon: 'Palette'
  },
  {
    id: 'tenant-04',
    name: 'Tenant Context Management',
    description: 'Automatic tenant context detection and switching based on county assignment.',
    category: 'Multi-Tenant & County',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['multi-tenant', 'context', 'infrastructure'],
    icon: 'Building'
  },

  // LEGISLATIVE & REGULATORY TRACKING (6)
  {
    id: 'legislative-01',
    name: 'Federal Law Tracker',
    description: 'Automated tracking of federal bills from Congress.gov with relevance filtering for benefit programs.',
    category: 'Legislative & Regulatory Tracking',
    aiPowered: true,
    route: '/admin/federal-law-tracker',
    status: 'production-ready',
    tags: ['legislative', 'federal', 'tracking', 'automation'],
    icon: 'Scale'
  },
  {
    id: 'legislative-02',
    name: 'Maryland State Law Tracker',
    description: 'Maryland General Assembly bill tracking with session-aware scheduling.',
    category: 'Legislative & Regulatory Tracking',
    aiPowered: false,
    route: '/admin/maryland-law-tracker',
    status: 'production-ready',
    tags: ['legislative', 'maryland', 'tracking'],
    icon: 'Building2'
  },
  {
    id: 'legislative-03',
    name: 'FNS State Options Manager',
    description: 'Track and manage SNAP State Options Report updates from USDA FNS.',
    category: 'Legislative & Regulatory Tracking',
    aiPowered: false,
    route: '/admin/fns-state-options',
    status: 'production-ready',
    tags: ['snap', 'fns', 'usda', 'policy'],
    icon: 'FileSpreadsheet'
  },
  {
    id: 'legislative-04',
    name: 'Policy Change Notifications',
    description: 'Automated notifications for policy changes with impact analysis and staff alerts.',
    category: 'Legislative & Regulatory Tracking',
    aiPowered: true,
    route: '/admin/policy-changes',
    status: 'production-ready',
    tags: ['policy', 'notifications', 'automation'],
    icon: 'Bell'
  },
  {
    id: 'legislative-05',
    name: 'Smart Scheduler',
    description: 'Intelligent scheduling of policy scraping tasks based on legislative session calendars.',
    category: 'Legislative & Regulatory Tracking',
    aiPowered: false,
    route: '/admin/scheduler',
    status: 'production-ready',
    tags: ['scheduler', 'automation', 'efficiency'],
    icon: 'Clock'
  },
  {
    id: 'legislative-06',
    name: 'Policy Sources Dashboard',
    description: 'Comprehensive view of all policy sources with status tracking and update history.',
    category: 'Legislative & Regulatory Tracking',
    aiPowered: false,
    route: '/admin/sources',
    status: 'production-ready',
    tags: ['policy', 'sources', 'tracking'],
    icon: 'Database'
  },

  // PLATFORM OPERATIONS (8)
  {
    id: 'ops-01',
    name: 'Platform Monitoring',
    description: 'Real-time platform health monitoring with uptime tracking, error rates, and performance metrics.',
    category: 'Platform Operations',
    aiPowered: false,
    route: '/admin/monitoring',
    status: 'production-ready',
    tags: ['monitoring', 'infrastructure', 'operations'],
    icon: 'Activity'
  },
  {
    id: 'ops-02',
    name: 'AI Monitoring',
    description: 'Monitor AI service performance, token usage, and model response quality.',
    category: 'Platform Operations',
    aiPowered: false,
    route: '/admin/ai-monitoring',
    status: 'production-ready',
    tags: ['ai', 'monitoring', 'gemini'],
    icon: 'Cpu'
  },
  {
    id: 'ops-03',
    name: 'Security Monitoring',
    description: 'Security event monitoring with threat detection and incident response tracking.',
    category: 'Platform Operations',
    aiPowered: false,
    route: '/admin/security-monitoring',
    status: 'production-ready',
    tags: ['security', 'monitoring', 'threats'],
    icon: 'ShieldAlert'
  },
  {
    id: 'ops-04',
    name: 'Error Tracking',
    description: 'Sentry integration for error tracking, performance monitoring, and debugging.',
    category: 'Platform Operations',
    aiPowered: false,
    route: '/admin/monitoring',
    status: 'production-ready',
    tags: ['errors', 'sentry', 'debugging'],
    icon: 'AlertTriangle'
  },
  {
    id: 'ops-05',
    name: 'Rate Limiting',
    description: 'API rate limiting with tiered limits and automatic throttling.',
    category: 'Platform Operations',
    aiPowered: false,
    route: '/developer',
    status: 'production-ready',
    tags: ['api', 'rate-limiting', 'security'],
    icon: 'Gauge'
  },
  {
    id: 'ops-06',
    name: 'Session Management',
    description: 'Secure session management with expiry handling and automatic logout.',
    category: 'Platform Operations',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['security', 'sessions', 'authentication'],
    icon: 'Timer'
  },
  {
    id: 'ops-07',
    name: 'Health Check',
    description: 'Automated health checks for database, cache, and external service connectivity.',
    category: 'Platform Operations',
    aiPowered: false,
    route: '/admin/monitoring',
    status: 'production-ready',
    tags: ['monitoring', 'health', 'infrastructure'],
    icon: 'HeartPulse'
  },
  {
    id: 'ops-08',
    name: 'Graceful Shutdown',
    description: 'Graceful application shutdown with connection draining and request completion.',
    category: 'Platform Operations',
    aiPowered: false,
    route: '/admin',
    status: 'production-ready',
    tags: ['infrastructure', 'operations', 'reliability'],
    icon: 'PowerOff'
  },

  // COMMUNICATION SYSTEMS (1)
  {
    id: 'comm-01',
    name: 'SMS Conversation Engine',
    description: 'Two-way SMS communication with Twilio integration and conversation threading.',
    category: 'Communication Systems',
    aiPowered: false,
    route: '/admin/sms-config',
    status: 'production-ready',
    tags: ['sms', 'communication', 'twilio'],
    icon: 'MessageSquare'
  },

  // NOTIFICATION SYSTEM (4)
  {
    id: 'notif-01',
    name: 'Notification Center',
    description: 'Centralized notification management with real-time updates and read/unread tracking.',
    category: 'Notification System',
    aiPowered: false,
    route: '/notifications',
    status: 'production-ready',
    tags: ['notifications', 'real-time', 'alerts'],
    icon: 'BellRing'
  },
  {
    id: 'notif-02',
    name: 'WebSocket Notifications',
    description: 'Real-time WebSocket notifications for instant updates across the platform.',
    category: 'Notification System',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['websocket', 'real-time', 'notifications'],
    icon: 'Radio'
  },
  {
    id: 'notif-03',
    name: 'Notification Settings',
    description: 'User-configurable notification preferences with channel selection (email, SMS, push).',
    category: 'Notification System',
    aiPowered: false,
    route: '/settings/notifications',
    status: 'production-ready',
    tags: ['notifications', 'settings', 'preferences'],
    icon: 'Settings2'
  },
  {
    id: 'notif-04',
    name: 'Alert Service',
    description: 'Database-driven alert system with configurable rules and automatic triggering.',
    category: 'Notification System',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['alerts', 'automation', 'notifications'],
    icon: 'AlertCircle'
  },

  // CACHING & PERFORMANCE (6)
  {
    id: 'cache-01',
    name: 'Cache Orchestrator',
    description: 'Intelligent multi-layer caching with automatic invalidation and cache warming.',
    category: 'Caching & Performance',
    aiPowered: false,
    route: '/admin/monitoring',
    status: 'production-ready',
    tags: ['cache', 'performance', 'optimization'],
    icon: 'Layers'
  },
  {
    id: 'cache-02',
    name: 'Rules Engine Cache',
    description: 'High-performance caching for eligibility rules with 94% hit rate.',
    category: 'Caching & Performance',
    aiPowered: false,
    route: '/admin/monitoring',
    status: 'production-ready',
    tags: ['cache', 'rules-engine', 'performance'],
    icon: 'Zap'
  },
  {
    id: 'cache-03',
    name: 'PolicyEngine Cache',
    description: 'PolicyEngine calculation result caching with 87% hit rate and 5-minute TTL.',
    category: 'Caching & Performance',
    aiPowered: false,
    route: '/admin/monitoring',
    status: 'production-ready',
    tags: ['cache', 'policyengine', 'performance'],
    icon: 'Database'
  },
  {
    id: 'cache-04',
    name: 'RAG Search Cache',
    description: 'Vector search result caching for policy RAG queries with embedding cache.',
    category: 'Caching & Performance',
    aiPowered: false,
    route: '/admin/monitoring',
    status: 'production-ready',
    tags: ['cache', 'rag', 'ai', 'performance'],
    icon: 'Search'
  },
  {
    id: 'cache-05',
    name: 'Document Analysis Cache',
    description: 'Cache Gemini Vision document analysis results to reduce API costs.',
    category: 'Caching & Performance',
    aiPowered: false,
    route: '/admin/monitoring',
    status: 'production-ready',
    tags: ['cache', 'ai', 'gemini', 'cost-optimization'],
    icon: 'FileSearch'
  },
  {
    id: 'cache-06',
    name: 'Cache Metrics',
    description: 'Real-time cache performance metrics with hit rates, latency, and invalidation tracking.',
    category: 'Caching & Performance',
    aiPowered: false,
    route: '/admin/monitoring',
    status: 'production-ready',
    tags: ['cache', 'metrics', 'monitoring'],
    icon: 'BarChart'
  },

  // POLICY MANAGEMENT AUTOMATION (3)
  {
    id: 'policy-01',
    name: 'Rules Extraction Service',
    description: 'AI-powered extraction of eligibility rules from policy documents using Gemini.',
    category: 'Policy Management Automation',
    aiPowered: true,
    route: '/admin/rules',
    status: 'production-ready',
    tags: ['policy', 'ai', 'automation', 'rules'],
    icon: 'FileCode'
  },
  {
    id: 'policy-02',
    name: 'Policy Source Scraper',
    description: 'Automated scraping of policy sources (CFR, Maryland regulations) with change detection.',
    category: 'Policy Management Automation',
    aiPowered: false,
    route: '/admin/sources',
    status: 'production-ready',
    tags: ['policy', 'scraping', 'automation'],
    icon: 'Globe2'
  },
  {
    id: 'policy-03',
    name: 'Manual Ingestion Service',
    description: 'Manual policy document upload and ingestion with PDF parsing and embedding generation.',
    category: 'Policy Management Automation',
    aiPowered: false,
    route: '/upload',
    status: 'production-ready',
    tags: ['policy', 'ingestion', 'documents'],
    icon: 'Upload'
  },

  // GAMIFICATION (1)
  {
    id: 'gamify-01',
    name: 'Achievement System',
    description: 'Gamification with achievements, badges, and leaderboard for navigator performance.',
    category: 'Gamification',
    aiPowered: false,
    route: '/leaderboard',
    status: 'production-ready',
    tags: ['gamification', 'achievements', 'engagement'],
    icon: 'Trophy'
  },

  // CROSS-ENROLLMENT INTELLIGENCE (1)
  {
    id: 'cross-01',
    name: 'Cross-Enrollment Admin',
    description: 'Administrative dashboard for cross-enrollment opportunities with AI-powered recommendations.',
    category: 'Cross-Enrollment Intelligence',
    aiPowered: true,
    route: '/admin/cross-enrollment',
    status: 'production-ready',
    tags: ['cross-enrollment', 'ai', 'benefits', 'admin'],
    icon: 'GitMerge'
  },

  // ACCESSIBILITY & COMPLIANCE (6)
  {
    id: 'access-01',
    name: 'WCAG Compliance',
    description: 'WCAG 2.1 Level A compliance with 91.7% pass rate across automated accessibility tests.',
    category: 'Accessibility & Compliance',
    aiPowered: false,
    route: '/legal/accessibility',
    status: 'production-ready',
    tags: ['accessibility', 'wcag', 'compliance'],
    icon: 'Accessibility'
  },
  {
    id: 'access-02',
    name: 'Plain Language Validator',
    description: 'Automated plain language validation with reading level scoring and suggestions.',
    category: 'Accessibility & Compliance',
    aiPowered: true,
    route: '/',
    status: 'production-ready',
    tags: ['accessibility', 'plain-language', 'readability'],
    icon: 'Type'
  },
  {
    id: 'access-03',
    name: 'Multi-Language Support',
    description: 'Support for 10 languages including English, Spanish, and Asian languages.',
    category: 'Accessibility & Compliance',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['accessibility', 'i18n', 'multilingual'],
    icon: 'Languages'
  },
  {
    id: 'access-04',
    name: 'Mobile Responsive Design',
    description: 'Fully responsive mobile-first design with bottom navigation and touch-optimized controls.',
    category: 'Accessibility & Compliance',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['accessibility', 'mobile', 'responsive'],
    icon: 'Smartphone'
  },
  {
    id: 'access-05',
    name: 'Keyboard Navigation',
    description: 'Complete keyboard navigation support with focus indicators and skip links.',
    category: 'Accessibility & Compliance',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['accessibility', 'keyboard', 'navigation'],
    icon: 'Keyboard'
  },
  {
    id: 'access-06',
    name: 'Screen Reader Support',
    description: 'ARIA labels, semantic HTML, and screen reader optimization throughout the platform.',
    category: 'Accessibility & Compliance',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['accessibility', 'screen-reader', 'aria'],
    icon: 'Volume2'
  },
  
  // INFRASTRUCTURE & MOBILE (6)
  {
    id: 'infra-01',
    name: 'Progressive Web App (PWA)',
    description: 'Full PWA support with offline capabilities, installability, and service worker caching.',
    category: 'Infrastructure & Mobile',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['pwa', 'mobile', 'offline'],
    icon: 'Download'
  },
  {
    id: 'infra-02',
    name: 'Offline Storage',
    description: 'IndexedDB-based offline storage for form data and documents with sync on reconnect.',
    category: 'Infrastructure & Mobile',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['offline', 'storage', 'pwa'],
    icon: 'HardDrive'
  },
  {
    id: 'infra-03',
    name: 'Service Worker',
    description: 'Advanced service worker with caching strategies and background sync.',
    category: 'Infrastructure & Mobile',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['service-worker', 'pwa', 'caching'],
    icon: 'Cog'
  },
  {
    id: 'infra-04',
    name: 'Mobile Bottom Navigation',
    description: 'Touch-optimized bottom navigation for mobile devices with swipe gestures.',
    category: 'Infrastructure & Mobile',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['mobile', 'navigation', 'ux'],
    icon: 'Navigation'
  },
  {
    id: 'infra-05',
    name: 'Install Prompt',
    description: 'Smart PWA install prompt with usage-based triggering and dismissal tracking.',
    category: 'Infrastructure & Mobile',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['pwa', 'mobile', 'install'],
    icon: 'Plus'
  },
  {
    id: 'infra-06',
    name: 'Command Palette',
    description: 'Cmd+K command palette for rapid navigation and action execution across the platform.',
    category: 'Infrastructure & Mobile',
    aiPowered: false,
    route: '/',
    status: 'production-ready',
    tags: ['navigation', 'productivity', 'ux'],
    icon: 'Command'
  }
];

export const FEATURE_CATEGORIES = [
  { name: 'Public Access', count: 6, color: 'blue' },
  { name: 'Eligibility & Calculation', count: 7, color: 'green' },
  { name: 'Application Assistance', count: 3, color: 'purple' },
  { name: 'Document Management', count: 8, color: 'orange' },
  { name: 'Tax Preparation & VITA', count: 7, color: 'red' },
  { name: 'Navigator & Staff Tools', count: 5, color: 'indigo' },
  { name: 'Quality Control & Compliance', count: 6, color: 'pink' },
  { name: 'Administration', count: 7, color: 'yellow' },
  { name: 'Developer & Integration', count: 4, color: 'cyan' },
  { name: 'Multi-Tenant & County', count: 4, color: 'teal' },
  { name: 'Legislative & Regulatory Tracking', count: 6, color: 'violet' },
  { name: 'Platform Operations', count: 8, color: 'gray' },
  { name: 'Communication Systems', count: 1, color: 'lime' },
  { name: 'Notification System', count: 4, color: 'amber' },
  { name: 'Caching & Performance', count: 6, color: 'emerald' },
  { name: 'Policy Management Automation', count: 3, color: 'rose' },
  { name: 'Gamification', count: 1, color: 'fuchsia' },
  { name: 'Cross-Enrollment Intelligence', count: 1, color: 'sky' },
  { name: 'Accessibility & Compliance', count: 6, color: 'slate' },
  { name: 'Infrastructure & Mobile', count: 6, color: 'zinc' }
];

export const AI_POWERED_FEATURES = FEATURE_CATALOG.filter(f => f.aiPowered);

export function getFeaturesByCategory(category: string): FeatureMetadata[] {
  return FEATURE_CATALOG.filter(f => f.category === category);
}

export function getFeatureById(id: string): FeatureMetadata | undefined {
  return FEATURE_CATALOG.find(f => f.id === id);
}

export function searchFeatures(query: string): FeatureMetadata[] {
  const lowercaseQuery = query.toLowerCase();
  return FEATURE_CATALOG.filter(f =>
    f.name.toLowerCase().includes(lowercaseQuery) ||
    f.description.toLowerCase().includes(lowercaseQuery) ||
    f.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  );
}
