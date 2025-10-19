export interface APIEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  category: string;
  description: string;
  requiresAuth: boolean;
  requiredRole?: string[];
  requestBody?: object;
  responseExample?: object;
  queryParams?: Array<{ name: string; type: string; required: boolean; description: string }>;
}

export const API_CATEGORIES = [
  'Health & Monitoring',
  'Authentication',
  'Search & AI',
  'Benefits & Eligibility',
  'Tax Preparation',
  'Documents',
  'PolicyEngine Integration',
  'Legislative Tracking',
  'Calendar & Appointments',
  'Notifications',
  'Household & VITA',
  'Caseworker & Navigator',
  'Administration',
  'Gamification & Leaderboards',
  'Compliance & Audit',
  'Demo Data',
  'Webhooks & API Keys'
];

export const API_ENDPOINTS: APIEndpoint[] = [
  // ============================================================================
  // HEALTH & MONITORING (8 endpoints)
  // ============================================================================
  {
    id: 'health-1',
    method: 'GET',
    path: '/health',
    category: 'Health & Monitoring',
    description: 'Liveness probe - checks if service is running',
    requiresAuth: false,
    responseExample: { status: 'ok' }
  },
  {
    id: 'health-2',
    method: 'GET',
    path: '/ready',
    category: 'Health & Monitoring',
    description: 'Readiness probe - checks if service is ready to accept traffic',
    requiresAuth: false,
    responseExample: { ready: true }
  },
  {
    id: 'health-3',
    method: 'GET',
    path: '/startup',
    category: 'Health & Monitoring',
    description: 'Startup probe - checks if service has completed startup',
    requiresAuth: false,
    responseExample: { started: true }
  },
  {
    id: 'health-4',
    method: 'GET',
    path: '/api/health',
    category: 'Health & Monitoring',
    description: 'Comprehensive health check with database, Gemini API, and object storage status',
    requiresAuth: false,
    responseExample: {
      status: 'healthy',
      timestamp: '2025-10-18T01:36:31.000Z',
      uptime: 3600,
      services: {
        database: { status: 'healthy', latency: '15ms' },
        geminiApi: { status: 'healthy', configured: true },
        objectStorage: { status: 'healthy', configured: true }
      }
    }
  },
  {
    id: 'metrics-1',
    method: 'GET',
    path: '/api/metrics/performance',
    category: 'Health & Monitoring',
    description: 'Get system performance metrics',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      requestsPerMinute: 120,
      avgResponseTime: 250,
      errorRate: 0.02
    }
  },
  {
    id: 'metrics-2',
    method: 'GET',
    path: '/api/metrics/cache',
    category: 'Health & Monitoring',
    description: 'Get cache performance metrics',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      hitRate: 0.85,
      missRate: 0.15,
      totalKeys: 450
    }
  },
  {
    id: 'metrics-3',
    method: 'GET',
    path: '/api/metrics/ai',
    category: 'Health & Monitoring',
    description: 'Get AI service usage metrics',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      totalRequests: 5000,
      avgConfidenceScore: 0.87,
      totalTokensUsed: 1500000
    }
  },
  {
    id: 'metrics-4',
    method: 'GET',
    path: '/api/metrics/eligibility',
    category: 'Health & Monitoring',
    description: 'Get eligibility check metrics',
    requiresAuth: true,
    requiredRole: ['admin', 'staff'],
    responseExample: {
      totalChecks: 1250,
      approvedRate: 0.65,
      avgProcessingTime: 3.5
    }
  },

  // ============================================================================
  // AUTHENTICATION (7 endpoints)
  // ============================================================================
  {
    id: 'auth-1',
    method: 'POST',
    path: '/api/auth/signup',
    category: 'Authentication',
    description: 'Create new user account with secure password hashing',
    requiresAuth: false,
    requestBody: {
      username: 'john_doe',
      password: 'SecureP@ssw0rd123!',
      email: 'john@example.com',
      fullName: 'John Doe',
      role: 'client'
    },
    responseExample: {
      user: {
        id: 1,
        username: 'john_doe',
        email: 'john@example.com',
        role: 'client'
      }
    }
  },
  {
    id: 'auth-2',
    method: 'POST',
    path: '/api/auth/login',
    category: 'Authentication',
    description: 'Authenticate user and create session',
    requiresAuth: false,
    requestBody: {
      username: 'john_doe',
      password: 'SecureP@ssw0rd123!'
    },
    responseExample: {
      user: {
        id: 1,
        username: 'john_doe',
        email: 'john@example.com',
        role: 'client'
      }
    }
  },
  {
    id: 'auth-3',
    method: 'POST',
    path: '/api/auth/logout',
    category: 'Authentication',
    description: 'End user session and logout',
    requiresAuth: false,
    responseExample: {
      message: 'Logged out successfully'
    }
  },
  {
    id: 'auth-4',
    method: 'GET',
    path: '/api/auth/me',
    category: 'Authentication',
    description: 'Get current authenticated user information',
    requiresAuth: true,
    responseExample: {
      user: {
        id: 1,
        username: 'john_doe',
        email: 'john@example.com',
        role: 'client'
      }
    }
  },
  {
    id: 'auth-5',
    method: 'GET',
    path: '/api/auth/password-requirements',
    category: 'Authentication',
    description: 'Get password complexity requirements',
    requiresAuth: false,
    responseExample: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    }
  },
  {
    id: 'auth-6',
    method: 'POST',
    path: '/api/auth/change-password',
    category: 'Authentication',
    description: 'Change authenticated user password',
    requiresAuth: true,
    requestBody: {
      currentPassword: 'OldP@ssw0rd123!',
      newPassword: 'NewP@ssw0rd456!'
    },
    responseExample: {
      message: 'Password changed successfully',
      passwordStrength: 'strong'
    }
  },
  {
    id: 'auth-7',
    method: 'POST',
    path: '/api/legal/consent',
    category: 'Authentication',
    description: 'Record user consent for legal policies (HIPAA compliance)',
    requiresAuth: true,
    requestBody: {
      policyType: 'privacy',
      policyVersion: '1.0'
    },
    responseExample: {
      id: 1,
      userId: 1,
      policyType: 'privacy',
      consentedAt: '2025-10-18T01:36:31.000Z'
    }
  },

  // ============================================================================
  // SEARCH & AI (12 endpoints)
  // ============================================================================
  {
    id: 'search-1',
    method: 'POST',
    path: '/api/search',
    category: 'Search & AI',
    description: 'Hybrid search - intelligently routes to Rules Engine or RAG based on query classification',
    requiresAuth: true,
    requestBody: {
      query: 'What are SNAP income limits for Maryland?',
      benefitProgramId: 1,
      userId: 1
    },
    responseExample: {
      answer: 'SNAP income limits in Maryland are 130% of federal poverty level for gross income...',
      type: 'rules_engine',
      classification: { category: 'eligibility', confidence: 0.95 },
      responseTime: 245
    }
  },
  {
    id: 'search-2',
    method: 'POST',
    path: '/api/chat/ask',
    category: 'Search & AI',
    description: 'Conversational chat for policy questions using RAG',
    requiresAuth: true,
    requestBody: {
      query: 'How do I verify employment for SNAP?',
      context: { page: 'document-verification', documentType: 'income' },
      benefitProgramId: 1
    },
    responseExample: {
      answer: 'To verify employment for SNAP, you need recent pay stubs...',
      citations: ['7 CFR § 273.2(f)(1)(vii)'],
      sources: ['SNAP regulations'],
      relevanceScore: 0.92
    }
  },
  {
    id: 'ai-1',
    method: 'POST',
    path: '/api/ai/intake-copilot',
    category: 'Search & AI',
    description: 'AI-powered intake assistance copilot',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    requestBody: {
      householdData: { size: 3, income: 35000 },
      question: 'What benefits might this household qualify for?'
    },
    responseExample: {
      suggestions: ['SNAP', 'EITC', 'Maryland EITC'],
      estimatedBenefits: { SNAP: 450, EITC: 3500 },
      confidence: 0.88
    }
  },
  {
    id: 'ai-2',
    method: 'POST',
    path: '/api/ai/policy-rag',
    category: 'Search & AI',
    description: 'RAG-based policy question answering',
    requiresAuth: true,
    requestBody: {
      query: 'What are categorical eligibility rules?',
      benefitProgramId: 1
    },
    responseExample: {
      answer: 'Categorical eligibility allows households receiving certain benefits...',
      sources: ['7 CFR § 273.2(j)'],
      confidence: 0.91
    }
  },
  {
    id: 'ai-3',
    method: 'POST',
    path: '/api/ai/cross-enrollment',
    category: 'Search & AI',
    description: 'AI-powered cross-enrollment opportunity detection',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    requestBody: {
      householdId: 'HH-001'
    },
    responseExample: {
      opportunities: [
        { program: 'Medicaid', likelihood: 0.85, reason: 'Income qualifies' },
        { program: 'LIHEAP', likelihood: 0.72, reason: 'Utility expenses' }
      ]
    }
  },
  {
    id: 'ai-4',
    method: 'POST',
    path: '/api/ai/document-analysis',
    category: 'Search & AI',
    description: 'AI document analysis and extraction',
    requiresAuth: true,
    requestBody: {
      documentId: 1,
      analysisType: 'income_verification'
    },
    responseExample: {
      extractedData: { employer: 'ABC Corp', monthlyIncome: 3500 },
      confidence: 0.94,
      requiresReview: false
    }
  },
  {
    id: 'ai-5',
    method: 'POST',
    path: '/api/ai/notice-explainer',
    category: 'Search & AI',
    description: 'AI-powered plain language explanation of government notices',
    requiresAuth: false,
    requestBody: {
      noticeText: 'Your SNAP benefits have been reduced due to income changes...'
    },
    responseExample: {
      explanation: 'Your food assistance amount went down because your income increased...',
      readingLevel: 'grade-6',
      actionItems: ['Check your income report', 'Call if you disagree']
    }
  },
  {
    id: 'ai-6',
    method: 'POST',
    path: '/api/public/analyze-document',
    category: 'Search & AI',
    description: 'Public document analysis using Gemini Vision API',
    requiresAuth: false,
    requestBody: {
      image: 'base64_encoded_image',
      prompt: 'Extract key information from this document'
    },
    responseExample: {
      extractedText: 'Income: $3,500, Employer: ABC Corp',
      analysis: 'This appears to be a pay stub showing...'
    }
  },
  {
    id: 'ai-7',
    method: 'POST',
    path: '/api/public/chat',
    category: 'Search & AI',
    description: 'Public chat assistant for benefits questions',
    requiresAuth: false,
    requestBody: {
      message: 'How do I apply for SNAP?',
      conversationId: 'conv-123'
    },
    responseExample: {
      response: 'To apply for SNAP in Maryland, you can...',
      sources: ['Maryland DHS website'],
      followUpQuestions: ['What documents do I need?', 'How long does it take?']
    }
  },
  {
    id: 'ai-8',
    method: 'POST',
    path: '/api/ai/vita-chat',
    category: 'Search & AI',
    description: 'VITA tax preparation chat assistant',
    requiresAuth: true,
    requestBody: {
      sessionId: 1,
      question: 'What deductions can this taxpayer claim?'
    },
    responseExample: {
      answer: 'Based on the intake, this taxpayer may qualify for...',
      suggestedForms: ['Schedule A', 'Form 1040'],
      confidence: 0.89
    }
  },
  {
    id: 'ai-9',
    method: 'POST',
    path: '/api/ai/classification',
    category: 'Search & AI',
    description: 'Classify query to determine if it needs Rules Engine or RAG',
    requiresAuth: true,
    requestBody: {
      query: 'What are SNAP asset limits?'
    },
    responseExample: {
      category: 'eligibility',
      routeTo: 'rules_engine',
      confidence: 0.92
    }
  },
  {
    id: 'ai-10',
    method: 'GET',
    path: '/api/ai/training-jobs',
    category: 'Search & AI',
    description: 'Get all AI model training jobs',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        modelName: 'eligibility_classifier',
        status: 'completed',
        accuracy: 0.94,
        completedAt: '2025-10-18T01:00:00.000Z'
      }
    ]
  },

  // ============================================================================
  // BENEFITS & ELIGIBILITY (18 endpoints)
  // ============================================================================
  {
    id: 'benefits-1',
    method: 'GET',
    path: '/api/benefit-programs',
    category: 'Benefits & Eligibility',
    description: 'Get all benefit programs',
    requiresAuth: false,
    responseExample: [
      { id: 1, name: 'SNAP', code: 'SNAP', description: 'Supplemental Nutrition Assistance Program' },
      { id: 2, name: 'TANF', code: 'TANF', description: 'Temporary Assistance for Needy Families' },
      { id: 3, name: 'Medicaid', code: 'MEDICAID', description: 'Medical assistance program' }
    ]
  },
  {
    id: 'benefits-2',
    method: 'POST',
    path: '/api/eligibility/check',
    category: 'Benefits & Eligibility',
    description: 'Check household eligibility for benefits using PolicyEngine',
    requiresAuth: true,
    requestBody: {
      householdSize: 3,
      income: 35000,
      state: 'MD',
      program: 'SNAP'
    },
    responseExample: {
      eligible: true,
      estimatedBenefit: 450,
      details: { incomeTest: 'pass', assetTest: 'pass' }
    }
  },
  {
    id: 'benefits-3',
    method: 'POST',
    path: '/api/eligibility/calculate',
    category: 'Benefits & Eligibility',
    description: 'Calculate benefit amount using Rules Engine',
    requiresAuth: true,
    requestBody: {
      householdData: {
        size: 3,
        grossIncome: 2500,
        earnedIncome: 2500,
        unearnedIncome: 0,
        shelter: 900,
        utilities: 150
      },
      program: 'SNAP'
    },
    responseExample: {
      monthlyBenefit: 450,
      calculation: {
        grossIncome: 2500,
        standardDeduction: 198,
        earnedIncomeDeduction: 500,
        netIncome: 1802,
        maxAllotment: 740
      }
    }
  },
  {
    id: 'benefits-4',
    method: 'GET',
    path: '/api/benefit-calculations',
    category: 'Benefits & Eligibility',
    description: 'Get all benefit calculations for authenticated user',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        householdId: 'HH-001',
        program: 'SNAP',
        monthlyBenefit: 450,
        calculatedAt: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'benefits-5',
    method: 'POST',
    path: '/api/public/quick-screen',
    category: 'Benefits & Eligibility',
    description: 'Public quick eligibility screener (no auth required)',
    requiresAuth: false,
    requestBody: {
      householdSize: 3,
      monthlyIncome: 2500,
      zipCode: '21201'
    },
    responseExample: {
      potentialPrograms: ['SNAP', 'EITC', 'Medicaid'],
      estimatedBenefits: { SNAP: 450, EITC: 3500 },
      nextSteps: ['Create account', 'Complete full application']
    }
  },
  {
    id: 'benefits-6',
    method: 'POST',
    path: '/api/rules/snap/eligibility',
    category: 'Benefits & Eligibility',
    description: 'SNAP eligibility check using Rules Engine',
    requiresAuth: true,
    requestBody: {
      household: { size: 3, grossIncome: 2500 }
    },
    responseExample: {
      eligible: true,
      reason: 'Gross income below 130% FPL',
      fpl: 2500,
      incomeLimit: 3250
    }
  },
  {
    id: 'benefits-7',
    method: 'POST',
    path: '/api/rules/tanf/eligibility',
    category: 'Benefits & Eligibility',
    description: 'TANF eligibility check using Rules Engine',
    requiresAuth: true,
    requestBody: {
      household: { size: 3, hasChildren: true, income: 1500 }
    },
    responseExample: {
      eligible: true,
      monthlyBenefit: 692,
      timeLimit: '60 months lifetime'
    }
  },
  {
    id: 'benefits-8',
    method: 'POST',
    path: '/api/rules/medicaid/eligibility',
    category: 'Benefits & Eligibility',
    description: 'Medicaid eligibility check using Rules Engine',
    requiresAuth: true,
    requestBody: {
      household: { size: 3, income: 30000 }
    },
    responseExample: {
      eligible: true,
      category: 'Expansion Adult',
      incomeLimit: 35000
    }
  },
  {
    id: 'benefits-9',
    method: 'POST',
    path: '/api/rules/ohep/eligibility',
    category: 'Benefits & Eligibility',
    description: 'OHEP (energy assistance) eligibility check',
    requiresAuth: true,
    requestBody: {
      household: { size: 3, income: 2500 }
    },
    responseExample: {
      eligible: true,
      benefit: 500,
      category: 'Standard'
    }
  },
  {
    id: 'benefits-10',
    method: 'GET',
    path: '/api/rules/snap/income-limits',
    category: 'Benefits & Eligibility',
    description: 'Get SNAP income limits by household size',
    requiresAuth: false,
    queryParams: [
      { name: 'householdSize', type: 'number', required: true, description: 'Number of people in household' }
    ],
    responseExample: {
      householdSize: 3,
      grossIncomeLimit: 3250,
      netIncomeLimit: 2500,
      fpl: 2500
    }
  },
  {
    id: 'benefits-11',
    method: 'GET',
    path: '/api/rules/snap/deductions',
    category: 'Benefits & Eligibility',
    description: 'Get SNAP standard deductions',
    requiresAuth: false,
    responseExample: {
      standardDeduction: 198,
      earnedIncomeDeduction: 0.20,
      excessShelterCap: 624
    }
  },
  {
    id: 'benefits-12',
    method: 'POST',
    path: '/api/policyengine/calculate',
    category: 'Benefits & Eligibility',
    description: 'Full PolicyEngine calculation for all benefits and tax credits',
    requiresAuth: true,
    requestBody: {
      household: {
        people: [
          { age: 35, employment_income: 30000 },
          { age: 33, employment_income: 0 },
          { age: 5 }
        ],
        state: 'MD'
      }
    },
    responseExample: {
      snap: 450,
      eitc: 3500,
      ctc: 2000,
      totalBenefits: 5950
    }
  },
  {
    id: 'benefits-13',
    method: 'POST',
    path: '/api/cross-enrollment/analyze',
    category: 'Benefits & Eligibility',
    description: 'Analyze household for cross-enrollment opportunities',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    requestBody: {
      householdId: 'HH-001'
    },
    responseExample: {
      currentPrograms: ['SNAP'],
      opportunities: [
        { program: 'Medicaid', likelihood: 0.85 },
        { program: 'LIHEAP', likelihood: 0.72 }
      ]
    }
  },
  {
    id: 'benefits-14',
    method: 'GET',
    path: '/api/fns-state-options',
    category: 'Benefits & Eligibility',
    description: 'Get FNS SNAP state options and waivers for Maryland',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        option: 'Broad-Based Categorical Eligibility',
        status: 'active',
        effectiveDate: '2023-01-01'
      }
    ]
  },
  {
    id: 'benefits-15',
    method: 'GET',
    path: '/api/abawd-verification',
    category: 'Benefits & Eligibility',
    description: 'Get ABAWD work requirement verification data',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    responseExample: [
      {
        clientId: 1,
        workHours: 20,
        verified: true,
        monthlyCompliance: 'met'
      }
    ]
  },
  {
    id: 'benefits-16',
    method: 'POST',
    path: '/api/categorical-eligibility/check',
    category: 'Benefits & Eligibility',
    description: 'Check for categorical eligibility (e.g., receiving TANF makes you SNAP eligible)',
    requiresAuth: true,
    requestBody: {
      householdId: 'HH-001',
      currentPrograms: ['TANF']
    },
    responseExample: {
      categoricallyEligible: true,
      reason: 'Receiving TANF',
      skipTests: ['income', 'asset']
    }
  },
  {
    id: 'benefits-17',
    method: 'POST',
    path: '/api/public/faq/search',
    category: 'Benefits & Eligibility',
    description: 'Search public FAQ for benefits questions',
    requiresAuth: false,
    requestBody: {
      query: 'How do I apply for SNAP?'
    },
    responseExample: [
      {
        question: 'How do I apply for SNAP in Maryland?',
        answer: 'You can apply online at...',
        category: 'application'
      }
    ]
  },

  // ============================================================================
  // TAX PREPARATION (25 endpoints)
  // ============================================================================
  {
    id: 'tax-1',
    method: 'POST',
    path: '/api/policyengine/tax/calculate',
    category: 'Tax Preparation',
    description: 'Calculate federal and state taxes using PolicyEngine',
    requiresAuth: true,
    requestBody: {
      filingStatus: 'married_filing_jointly',
      income: 65000,
      children: 2,
      state: 'MD'
    },
    responseExample: {
      federalTax: 4500,
      stateTax: 2800,
      eitc: 3500,
      ctc: 4000,
      refund: 3000
    }
  },
  {
    id: 'tax-2',
    method: 'POST',
    path: '/api/vita/intake/sessions',
    category: 'Tax Preparation',
    description: 'Create new VITA intake session',
    requiresAuth: true,
    requestBody: {
      taxpayerName: 'John Doe',
      year: 2024,
      filingStatus: 'single'
    },
    responseExample: {
      id: 1,
      sessionId: 'VITA-2024-001',
      status: 'in_progress',
      createdAt: '2025-10-18T01:00:00.000Z'
    }
  },
  {
    id: 'tax-3',
    method: 'GET',
    path: '/api/vita/intake/sessions',
    category: 'Tax Preparation',
    description: 'Get all VITA intake sessions for current user',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        taxpayerName: 'John Doe',
        year: 2024,
        status: 'in_progress'
      }
    ]
  },
  {
    id: 'tax-4',
    method: 'GET',
    path: '/api/vita/intake/sessions/:id',
    category: 'Tax Preparation',
    description: 'Get specific VITA intake session with decrypted data',
    requiresAuth: true,
    responseExample: {
      id: 1,
      taxpayerName: 'John Doe',
      ssn: '***-**-1234',
      income: { w2: 45000, interest: 200 },
      deductions: { standard: true }
    }
  },
  {
    id: 'tax-5',
    method: 'PATCH',
    path: '/api/vita/intake/sessions/:id',
    category: 'Tax Preparation',
    description: 'Update VITA intake session data',
    requiresAuth: true,
    requestBody: {
      filingStatus: 'married_filing_jointly',
      income: { w2: 65000 }
    },
    responseExample: {
      id: 1,
      updated: true
    }
  },
  {
    id: 'tax-6',
    method: 'POST',
    path: '/api/vita/forms/1040',
    category: 'Tax Preparation',
    description: 'Generate Form 1040 PDF from VITA session',
    requiresAuth: true,
    requestBody: {
      sessionId: 1
    },
    responseExample: {
      pdfUrl: '/api/vita/forms/1040/download/1',
      formData: { totalIncome: 65000, taxOwed: 4500 }
    }
  },
  {
    id: 'tax-7',
    method: 'POST',
    path: '/api/vita/forms/502',
    category: 'Tax Preparation',
    description: 'Generate Maryland Form 502 PDF',
    requiresAuth: true,
    requestBody: {
      sessionId: 1
    },
    responseExample: {
      pdfUrl: '/api/vita/forms/502/download/1',
      formData: { marylandTax: 2800 }
    }
  },
  {
    id: 'tax-8',
    method: 'GET',
    path: '/api/vita/forms/1040/download/:sessionId',
    category: 'Tax Preparation',
    description: 'Download Form 1040 PDF file',
    requiresAuth: true,
    responseExample: 'Binary PDF file'
  },
  {
    id: 'tax-9',
    method: 'GET',
    path: '/api/vita/forms/502/download/:sessionId',
    category: 'Tax Preparation',
    description: 'Download Maryland Form 502 PDF file',
    requiresAuth: true,
    responseExample: 'Binary PDF file'
  },
  {
    id: 'tax-10',
    method: 'POST',
    path: '/api/vita/forms/1040/xml',
    category: 'Tax Preparation',
    description: 'Generate Form 1040 e-file XML',
    requiresAuth: true,
    requestBody: {
      sessionId: 1
    },
    responseExample: {
      xml: '<?xml version="1.0"?>...',
      valid: true
    }
  },
  {
    id: 'tax-11',
    method: 'POST',
    path: '/api/taxslayer/export/pdf',
    category: 'Tax Preparation',
    description: 'Export TaxSlayer-formatted PDF',
    requiresAuth: true,
    requestBody: {
      sessionId: 1
    },
    responseExample: {
      pdfUrl: '/api/taxslayer/download/1.pdf'
    }
  },
  {
    id: 'tax-12',
    method: 'POST',
    path: '/api/taxslayer/export/csv',
    category: 'Tax Preparation',
    description: 'Export TaxSlayer-formatted CSV data',
    requiresAuth: true,
    requestBody: {
      sessionId: 1
    },
    responseExample: {
      csvUrl: '/api/taxslayer/download/1.csv',
      rows: 45
    }
  },
  {
    id: 'tax-13',
    method: 'GET',
    path: '/api/tax-documents',
    category: 'Tax Preparation',
    description: 'Get all tax documents for current user',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        documentType: 'W-2',
        taxYear: 2024,
        uploadedAt: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'tax-14',
    method: 'POST',
    path: '/api/tax-documents/upload',
    category: 'Tax Preparation',
    description: 'Upload tax document (W-2, 1099, etc.)',
    requiresAuth: true,
    requestBody: 'multipart/form-data with file',
    responseExample: {
      id: 1,
      documentType: 'W-2',
      extractedData: { employer: 'ABC Corp', wages: 45000 }
    }
  },
  {
    id: 'tax-15',
    method: 'POST',
    path: '/api/tax-documents/analyze',
    category: 'Tax Preparation',
    description: 'AI analysis of uploaded tax document',
    requiresAuth: true,
    requestBody: {
      documentId: 1
    },
    responseExample: {
      documentType: 'W-2',
      extractedData: { employer: 'ABC Corp', wages: 45000 },
      confidence: 0.96
    }
  },
  {
    id: 'tax-16',
    method: 'GET',
    path: '/api/irs-consent-forms',
    category: 'Tax Preparation',
    description: 'Get IRS consent form templates',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        formName: 'Form 8879 - IRS e-file Signature Authorization',
        version: '2024'
      }
    ]
  },
  {
    id: 'tax-17',
    method: 'POST',
    path: '/api/client-consents',
    category: 'Tax Preparation',
    description: 'Record client consent for e-filing',
    requiresAuth: true,
    requestBody: {
      sessionId: 1,
      consentFormId: 1,
      signatureData: 'base64_signature'
    },
    responseExample: {
      id: 1,
      consentedAt: '2025-10-18T01:00:00.000Z',
      valid: true
    }
  },
  {
    id: 'tax-18',
    method: 'POST',
    path: '/api/vita/e-file/submit',
    category: 'Tax Preparation',
    description: 'Submit tax return for e-filing',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    requestBody: {
      sessionId: 1
    },
    responseExample: {
      submissionId: 'EFILE-2024-001',
      status: 'pending',
      submittedAt: '2025-10-18T01:00:00.000Z'
    }
  },
  {
    id: 'tax-19',
    method: 'GET',
    path: '/api/vita/e-file/status/:submissionId',
    category: 'Tax Preparation',
    description: 'Check e-file submission status',
    requiresAuth: true,
    responseExample: {
      submissionId: 'EFILE-2024-001',
      status: 'accepted',
      irsAcknowledgment: 'ACK123456'
    }
  },
  {
    id: 'tax-20',
    method: 'GET',
    path: '/api/county-tax-rates',
    category: 'Tax Preparation',
    description: 'Get Maryland county tax rates',
    requiresAuth: false,
    responseExample: [
      {
        county: 'Baltimore City',
        rate: 0.032,
        localTax: 0.005
      }
    ]
  },
  {
    id: 'tax-21',
    method: 'POST',
    path: '/api/taxpayer/messages',
    category: 'Tax Preparation',
    description: 'Send message to taxpayer (staff to client)',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    requestBody: {
      taxpayerId: 1,
      subject: 'Additional documents needed',
      body: 'Please upload your W-2...'
    },
    responseExample: {
      id: 1,
      sentAt: '2025-10-18T01:00:00.000Z'
    }
  },
  {
    id: 'tax-22',
    method: 'GET',
    path: '/api/taxpayer/messages',
    category: 'Tax Preparation',
    description: 'Get messages for current taxpayer',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        from: 'Tax Preparer',
        subject: 'Documents needed',
        sentAt: '2025-10-18T01:00:00.000Z',
        read: false
      }
    ]
  },
  {
    id: 'tax-23',
    method: 'POST',
    path: '/api/taxpayer/document-requests',
    category: 'Tax Preparation',
    description: 'Create document request for taxpayer',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    requestBody: {
      taxpayerId: 1,
      documentType: 'W-2',
      dueDate: '2025-11-01',
      instructions: 'Please upload all W-2 forms'
    },
    responseExample: {
      id: 1,
      status: 'pending',
      createdAt: '2025-10-18T01:00:00.000Z'
    }
  },
  {
    id: 'tax-24',
    method: 'GET',
    path: '/api/taxpayer/document-requests',
    category: 'Tax Preparation',
    description: 'Get document requests for current taxpayer',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        documentType: 'W-2',
        dueDate: '2025-11-01',
        status: 'pending'
      }
    ]
  },
  {
    id: 'tax-25',
    method: 'POST',
    path: '/api/taxpayer/e-signature',
    category: 'Tax Preparation',
    description: 'Record taxpayer e-signature for tax return',
    requiresAuth: true,
    requestBody: {
      sessionId: 1,
      signatureData: 'base64_signature',
      ipAddress: '127.0.0.1'
    },
    responseExample: {
      id: 1,
      signedAt: '2025-10-18T01:00:00.000Z',
      valid: true
    }
  },

  // ============================================================================
  // DOCUMENTS (15 endpoints)
  // ============================================================================
  {
    id: 'doc-1',
    method: 'GET',
    path: '/api/document-types',
    category: 'Documents',
    description: 'Get all document types',
    requiresAuth: false,
    responseExample: [
      { id: 1, name: 'Pay Stub', category: 'income' },
      { id: 2, name: 'Bank Statement', category: 'assets' },
      { id: 3, name: 'Utility Bill', category: 'expenses' }
    ]
  },
  {
    id: 'doc-2',
    method: 'POST',
    path: '/api/verify-document',
    category: 'Documents',
    description: 'Upload and verify document using Gemini Vision API',
    requiresAuth: true,
    requestBody: 'multipart/form-data with file',
    responseExample: {
      documentId: 1,
      extracted: { employer: 'ABC Corp', income: 3500 },
      confidence: 0.92,
      requiresReview: false
    }
  },
  {
    id: 'doc-3',
    method: 'GET',
    path: '/api/documents',
    category: 'Documents',
    description: 'Get all documents (admin only)',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        filename: 'paystub.pdf',
        status: 'verified',
        uploadedAt: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'doc-4',
    method: 'POST',
    path: '/api/documents/upload',
    category: 'Documents',
    description: 'Upload document to object storage',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: 'multipart/form-data with file',
    responseExample: {
      id: 1,
      filename: 'document.pdf',
      objectPath: '/private/docs/123.pdf'
    }
  },
  {
    id: 'doc-5',
    method: 'GET',
    path: '/api/documents/:id',
    category: 'Documents',
    description: 'Get document by ID',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      id: 1,
      filename: 'paystub.pdf',
      downloadUrl: '/api/documents/download/1'
    }
  },
  {
    id: 'doc-6',
    method: 'PATCH',
    path: '/api/documents/:id/status',
    category: 'Documents',
    description: 'Update document verification status',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      status: 'verified'
    },
    responseExample: {
      id: 1,
      status: 'verified',
      updatedAt: '2025-10-18T01:00:00.000Z'
    }
  },
  {
    id: 'doc-7',
    method: 'GET',
    path: '/api/document-requirements',
    category: 'Documents',
    description: 'Get document requirements for benefit program',
    requiresAuth: false,
    queryParams: [
      { name: 'programId', type: 'number', required: true, description: 'Benefit program ID' }
    ],
    responseExample: [
      {
        documentType: 'Income Verification',
        required: true,
        examples: ['Pay stubs', 'Award letters']
      }
    ]
  },
  {
    id: 'doc-8',
    method: 'POST',
    path: '/api/documents/extract',
    category: 'Documents',
    description: 'Extract data from document using AI',
    requiresAuth: true,
    requestBody: {
      documentId: 1
    },
    responseExample: {
      extractedData: {
        employer: 'ABC Corp',
        payPeriod: '2025-10-01 to 2025-10-15',
        grossPay: 1750
      },
      confidence: 0.94
    }
  },
  {
    id: 'doc-9',
    method: 'GET',
    path: '/api/document-verification-queue',
    category: 'Documents',
    description: 'Get documents pending verification',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    responseExample: [
      {
        id: 1,
        filename: 'paystub.pdf',
        uploadedBy: 'John Doe',
        uploadedAt: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'doc-10',
    method: 'POST',
    path: '/api/documents/verify/:id',
    category: 'Documents',
    description: 'Manually verify document',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    requestBody: {
      verified: true,
      notes: 'Income verified from pay stub'
    },
    responseExample: {
      id: 1,
      status: 'verified',
      verifiedBy: 'Jane Smith',
      verifiedAt: '2025-10-18T01:00:00.000Z'
    }
  },
  {
    id: 'doc-11',
    method: 'GET',
    path: '/api/notice-templates',
    category: 'Documents',
    description: 'Get government notice templates for AI explainer',
    requiresAuth: false,
    responseExample: [
      {
        id: 1,
        noticeType: 'SNAP Reduction',
        template: 'Your SNAP benefits have been reduced...'
      }
    ]
  },
  {
    id: 'doc-12',
    method: 'POST',
    path: '/api/public/notice-explain',
    category: 'Documents',
    description: 'AI-powered plain language notice explanation',
    requiresAuth: false,
    requestBody: {
      noticeImage: 'base64_image'
    },
    responseExample: {
      explanation: 'Your food stamps went down because...',
      actionItems: ['Call 1-800-xxx-xxxx if you disagree'],
      readingLevel: 'grade-6'
    }
  },
  {
    id: 'doc-13',
    method: 'GET',
    path: '/api/public/document-checklist',
    category: 'Documents',
    description: 'Get document checklist for benefit application',
    requiresAuth: false,
    queryParams: [
      { name: 'program', type: 'string', required: true, description: 'Program code (SNAP, TANF, etc.)' }
    ],
    responseExample: {
      program: 'SNAP',
      required: ['Proof of identity', 'Proof of income', 'Proof of residence'],
      optional: ['Utility bills', 'Medical expenses']
    }
  },
  {
    id: 'doc-14',
    method: 'POST',
    path: '/api/documents/batch-upload',
    category: 'Documents',
    description: 'Upload multiple documents at once',
    requiresAuth: true,
    requestBody: 'multipart/form-data with multiple files',
    responseExample: {
      uploaded: 5,
      failed: 0,
      documents: [1, 2, 3, 4, 5]
    }
  },
  {
    id: 'doc-15',
    method: 'DELETE',
    path: '/api/documents/:id',
    category: 'Documents',
    description: 'Delete document',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      deleted: true
    }
  },

  // ============================================================================
  // POLICYENGINE INTEGRATION (8 endpoints)
  // ============================================================================
  {
    id: 'pe-1',
    method: 'POST',
    path: '/api/policyengine/calculate',
    category: 'PolicyEngine Integration',
    description: 'Full PolicyEngine calculation for household',
    requiresAuth: true,
    requestBody: {
      household: {
        people: [
          { age: 35, employment_income: 30000 },
          { age: 5 }
        ],
        state: 'MD'
      }
    },
    responseExample: {
      snap: 450,
      eitc: 3500,
      ctc: 2000,
      medicaid: 'eligible'
    }
  },
  {
    id: 'pe-2',
    method: 'POST',
    path: '/api/policyengine/verify',
    category: 'PolicyEngine Integration',
    description: 'Verify benefit calculation against PolicyEngine',
    requiresAuth: true,
    requestBody: {
      calculationId: 1
    },
    responseExample: {
      verified: true,
      policyEngineResult: 450,
      rulesEngineResult: 450,
      variance: 0
    }
  },
  {
    id: 'pe-3',
    method: 'GET',
    path: '/api/policyengine/status',
    category: 'PolicyEngine Integration',
    description: 'Check PolicyEngine API status',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      available: true,
      latency: 250,
      lastCheck: '2025-10-18T01:36:31.000Z'
    }
  },
  {
    id: 'pe-4',
    method: 'POST',
    path: '/api/policyengine/tax/calculate',
    category: 'PolicyEngine Integration',
    description: 'Calculate taxes using PolicyEngine',
    requiresAuth: true,
    requestBody: {
      filingStatus: 'single',
      income: 45000,
      state: 'MD'
    },
    responseExample: {
      federalTax: 3500,
      stateTax: 1800,
      totalTax: 5300
    }
  },
  {
    id: 'pe-5',
    method: 'GET',
    path: '/api/policyengine/verification-logs',
    category: 'PolicyEngine Integration',
    description: 'Get PolicyEngine verification logs',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        calculationId: 1,
        verified: true,
        variance: 0,
        timestamp: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'pe-6',
    method: 'POST',
    path: '/api/policyengine/batch-calculate',
    category: 'PolicyEngine Integration',
    description: 'Batch calculate multiple households',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      households: [
        { people: [{ age: 35, income: 30000 }] },
        { people: [{ age: 45, income: 50000 }] }
      ]
    },
    responseExample: {
      results: [
        { snap: 450, eitc: 3500 },
        { snap: 250, eitc: 1500 }
      ]
    }
  },
  {
    id: 'pe-7',
    method: 'GET',
    path: '/api/policyengine/cache-stats',
    category: 'PolicyEngine Integration',
    description: 'Get PolicyEngine cache statistics',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      hitRate: 0.78,
      totalRequests: 5000,
      cacheHits: 3900
    }
  },
  {
    id: 'pe-8',
    method: 'POST',
    path: '/api/policyengine/cache/invalidate',
    category: 'PolicyEngine Integration',
    description: 'Invalidate PolicyEngine cache',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      invalidated: 150,
      message: 'Cache cleared successfully'
    }
  },

  // ============================================================================
  // LEGISLATIVE TRACKING (12 endpoints)
  // ============================================================================
  {
    id: 'leg-1',
    method: 'GET',
    path: '/api/federal-bills',
    category: 'Legislative Tracking',
    description: 'Get tracked federal bills from Congress.gov',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        billNumber: 'H.R. 1234',
        title: 'SNAP Improvement Act',
        status: 'Introduced',
        lastUpdate: '2025-10-15'
      }
    ]
  },
  {
    id: 'leg-2',
    method: 'GET',
    path: '/api/maryland-bills',
    category: 'Legislative Tracking',
    description: 'Get tracked Maryland state bills',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        billNumber: 'HB 500',
        title: 'Maryland EITC Expansion',
        status: 'In Committee',
        lastUpdate: '2025-10-15'
      }
    ]
  },
  {
    id: 'leg-3',
    method: 'GET',
    path: '/api/public-laws',
    category: 'Legislative Tracking',
    description: 'Get recently enacted public laws',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        lawNumber: 'Public Law 118-15',
        title: 'Farm Bill 2024',
        enactedDate: '2024-12-20',
        policyRelevant: true
      }
    ]
  },
  {
    id: 'leg-4',
    method: 'POST',
    path: '/api/legislative/govinfo-bill-status',
    category: 'Legislative Tracking',
    description: 'Download bill status from GovInfo API',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      congress: 118,
      billType: 'hr'
    },
    responseExample: {
      downloaded: 25,
      policyRelevant: 5
    }
  },
  {
    id: 'leg-5',
    method: 'POST',
    path: '/api/legislative/govinfo-public-laws',
    category: 'Legislative Tracking',
    description: 'Download public laws from GovInfo API',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      congress: 118
    },
    responseExample: {
      downloaded: 15,
      policyRelevant: 3
    }
  },
  {
    id: 'leg-6',
    method: 'POST',
    path: '/api/govinfo/check-versions',
    category: 'Legislative Tracking',
    description: 'Check for new versions of tracked legislation',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      checked: 50,
      newVersions: 3
    }
  },
  {
    id: 'leg-7',
    method: 'GET',
    path: '/api/govinfo/version-status',
    category: 'Legislative Tracking',
    description: 'Get version status for legislation',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        billNumber: 'H.R. 1234',
        latestVersion: 'Engrossed House',
        versionDate: '2025-10-15'
      }
    ]
  },
  {
    id: 'leg-8',
    method: 'GET',
    path: '/api/govinfo/version-history',
    category: 'Legislative Tracking',
    description: 'Get version history for specific bill',
    requiresAuth: true,
    requiredRole: ['admin'],
    queryParams: [
      { name: 'billId', type: 'number', required: true, description: 'Bill database ID' }
    ],
    responseExample: [
      {
        version: 'Introduced in House',
        date: '2025-01-15'
      },
      {
        version: 'Engrossed in House',
        date: '2025-10-15'
      }
    ]
  },
  {
    id: 'leg-9',
    method: 'GET',
    path: '/api/scheduler/status',
    category: 'Legislative Tracking',
    description: 'Get smart scheduler status for all data sources',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        source: 'congress_bills',
        enabled: true,
        lastRun: '2025-10-18T00:00:00.000Z',
        nextRun: '2025-10-19T00:00:00.000Z'
      }
    ]
  },
  {
    id: 'leg-10',
    method: 'POST',
    path: '/api/scheduler/trigger/:source',
    category: 'Legislative Tracking',
    description: 'Manually trigger scheduler for data source',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      triggered: true,
      source: 'congress_bills'
    }
  },
  {
    id: 'leg-11',
    method: 'PATCH',
    path: '/api/scheduler/toggle/:source',
    category: 'Legislative Tracking',
    description: 'Enable/disable scheduler for data source',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      enabled: false
    },
    responseExample: {
      source: 'maryland_legislature',
      enabled: false
    }
  },
  {
    id: 'leg-12',
    method: 'PATCH',
    path: '/api/scheduler/frequency/:source',
    category: 'Legislative Tracking',
    description: 'Update scheduler frequency for data source',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      frequency: 'daily'
    },
    responseExample: {
      source: 'congress_bills',
      frequency: 'daily'
    }
  },

  // ============================================================================
  // CALENDAR & APPOINTMENTS (6 endpoints)
  // ============================================================================
  {
    id: 'cal-1',
    method: 'GET',
    path: '/api/appointments',
    category: 'Calendar & Appointments',
    description: 'Get appointments for current user',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        title: 'SNAP Interview',
        start: '2025-10-20T10:00:00.000Z',
        end: '2025-10-20T11:00:00.000Z',
        status: 'scheduled'
      }
    ]
  },
  {
    id: 'cal-2',
    method: 'POST',
    path: '/api/appointments',
    category: 'Calendar & Appointments',
    description: 'Create new appointment',
    requiresAuth: true,
    requestBody: {
      title: 'Tax Preparation',
      start: '2025-10-25T14:00:00.000Z',
      end: '2025-10-25T15:00:00.000Z',
      clientId: 1
    },
    responseExample: {
      id: 2,
      title: 'Tax Preparation',
      status: 'scheduled',
      createdAt: '2025-10-18T01:00:00.000Z'
    }
  },
  {
    id: 'cal-3',
    method: 'PATCH',
    path: '/api/appointments/:id',
    category: 'Calendar & Appointments',
    description: 'Update appointment',
    requiresAuth: true,
    requestBody: {
      start: '2025-10-25T15:00:00.000Z',
      status: 'rescheduled'
    },
    responseExample: {
      id: 2,
      updated: true
    }
  },
  {
    id: 'cal-4',
    method: 'DELETE',
    path: '/api/appointments/:id',
    category: 'Calendar & Appointments',
    description: 'Cancel appointment',
    requiresAuth: true,
    responseExample: {
      deleted: true
    }
  },
  {
    id: 'cal-5',
    method: 'GET',
    path: '/api/google-calendar/availability',
    category: 'Calendar & Appointments',
    description: 'Get available time slots from Google Calendar',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    responseExample: [
      {
        start: '2025-10-20T10:00:00.000Z',
        end: '2025-10-20T11:00:00.000Z'
      },
      {
        start: '2025-10-20T14:00:00.000Z',
        end: '2025-10-20T15:00:00.000Z'
      }
    ]
  },
  {
    id: 'cal-6',
    method: 'POST',
    path: '/api/google-calendar/sync',
    category: 'Calendar & Appointments',
    description: 'Sync appointment to Google Calendar',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    requestBody: {
      appointmentId: 1
    },
    responseExample: {
      synced: true,
      googleEventId: 'evt_123456'
    }
  },

  // ============================================================================
  // NOTIFICATIONS (8 endpoints)
  // ============================================================================
  {
    id: 'notif-1',
    method: 'GET',
    path: '/api/notifications',
    category: 'Notifications',
    description: 'Get notifications for current user',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        title: 'Document verified',
        message: 'Your pay stub has been verified',
        read: false,
        createdAt: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'notif-2',
    method: 'PATCH',
    path: '/api/notifications/:id/read',
    category: 'Notifications',
    description: 'Mark notification as read',
    requiresAuth: true,
    responseExample: {
      id: 1,
      read: true
    }
  },
  {
    id: 'notif-3',
    method: 'POST',
    path: '/api/notifications/mark-all-read',
    category: 'Notifications',
    description: 'Mark all notifications as read',
    requiresAuth: true,
    responseExample: {
      updated: 5
    }
  },
  {
    id: 'notif-4',
    method: 'GET',
    path: '/api/alert-rules',
    category: 'Notifications',
    description: 'Get alert rules for database monitoring',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        name: 'SNAP Denial Alert',
        condition: 'status = denied',
        enabled: true
      }
    ]
  },
  {
    id: 'notif-5',
    method: 'POST',
    path: '/api/alert-rules',
    category: 'Notifications',
    description: 'Create new alert rule',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      name: 'High Income Alert',
      table: 'households',
      condition: 'income > 50000',
      action: 'notify_staff'
    },
    responseExample: {
      id: 2,
      created: true
    }
  },
  {
    id: 'notif-6',
    method: 'GET',
    path: '/api/alert-history',
    category: 'Notifications',
    description: 'Get alert history',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        alertRule: 'SNAP Denial Alert',
        triggered: '2025-10-18T01:00:00.000Z',
        resolved: false
      }
    ]
  },
  {
    id: 'notif-7',
    method: 'GET',
    path: '/api/sms/status',
    category: 'Notifications',
    description: 'Get SMS service configuration status',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      enabled: true,
      provider: 'Twilio',
      phoneNumber: '+1234567890'
    }
  },
  {
    id: 'notif-8',
    method: 'GET',
    path: '/api/sms/conversations',
    category: 'Notifications',
    description: 'Get SMS conversations',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        phoneNumber: '+1234567890',
        lastMessage: 'Thanks for the update',
        timestamp: '2025-10-18T01:00:00.000Z'
      }
    ]
  },

  // ============================================================================
  // HOUSEHOLD & VITA (20 endpoints)
  // ============================================================================
  {
    id: 'hh-1',
    method: 'GET',
    path: '/api/household-profiles',
    category: 'Household & VITA',
    description: 'Get household profiles for current user',
    requiresAuth: true,
    responseExample: [
      {
        id: 'HH-001',
        householdSize: 3,
        totalIncome: 35000,
        status: 'active'
      }
    ]
  },
  {
    id: 'hh-2',
    method: 'POST',
    path: '/api/household-profiles',
    category: 'Household & VITA',
    description: 'Create new household profile',
    requiresAuth: true,
    requestBody: {
      householdSize: 4,
      members: [
        { age: 35, relation: 'head' },
        { age: 33, relation: 'spouse' },
        { age: 8, relation: 'child' },
        { age: 5, relation: 'child' }
      ],
      income: 45000
    },
    responseExample: {
      id: 'HH-002',
      created: true
    }
  },
  {
    id: 'hh-3',
    method: 'GET',
    path: '/api/household-profiles/:id',
    category: 'Household & VITA',
    description: 'Get specific household profile',
    requiresAuth: true,
    responseExample: {
      id: 'HH-001',
      householdSize: 3,
      members: [
        { age: 35, relation: 'head', employed: true }
      ],
      totalIncome: 35000
    }
  },
  {
    id: 'hh-4',
    method: 'PATCH',
    path: '/api/household-profiles/:id',
    category: 'Household & VITA',
    description: 'Update household profile',
    requiresAuth: true,
    requestBody: {
      totalIncome: 36000
    },
    responseExample: {
      id: 'HH-001',
      updated: true
    }
  },
  {
    id: 'hh-5',
    method: 'DELETE',
    path: '/api/household-profiles/:id',
    category: 'Household & VITA',
    description: 'Delete household profile',
    requiresAuth: true,
    responseExample: {
      deleted: true
    }
  },
  {
    id: 'hh-6',
    method: 'POST',
    path: '/api/household-profiles/:id/calculate-eligibility',
    category: 'Household & VITA',
    description: 'Calculate all benefit eligibility for household',
    requiresAuth: true,
    responseExample: {
      snap: { eligible: true, benefit: 450 },
      tanf: { eligible: false, reason: 'No qualifying children' },
      medicaid: { eligible: true }
    }
  },
  {
    id: 'hh-7',
    method: 'POST',
    path: '/api/intake-sessions',
    category: 'Household & VITA',
    description: 'Create new intake session',
    requiresAuth: true,
    requestBody: {
      householdId: 'HH-001',
      navigator: 'Jane Smith'
    },
    responseExample: {
      id: 1,
      sessionId: 'INTAKE-001',
      status: 'in_progress'
    }
  },
  {
    id: 'hh-8',
    method: 'GET',
    path: '/api/intake-sessions',
    category: 'Household & VITA',
    description: 'Get intake sessions',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        householdId: 'HH-001',
        status: 'in_progress',
        createdAt: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'hh-9',
    method: 'PATCH',
    path: '/api/intake-sessions/:id',
    category: 'Household & VITA',
    description: 'Update intake session',
    requiresAuth: true,
    requestBody: {
      status: 'completed',
      notes: 'All documents verified'
    },
    responseExample: {
      id: 1,
      updated: true
    }
  },
  {
    id: 'hh-10',
    method: 'GET',
    path: '/api/vita/knowledge-base/search',
    category: 'Household & VITA',
    description: 'Search VITA knowledge base',
    requiresAuth: true,
    queryParams: [
      { name: 'query', type: 'string', required: true, description: 'Search query' }
    ],
    responseExample: [
      {
        title: 'How to claim EITC',
        content: 'To claim the Earned Income Tax Credit...',
        source: 'IRS Publication 596'
      }
    ]
  },
  {
    id: 'hh-11',
    method: 'GET',
    path: '/api/vita/certification/status',
    category: 'Household & VITA',
    description: 'Get VITA certification status for current user',
    requiresAuth: true,
    responseExample: {
      certified: true,
      level: 'advanced',
      expiresAt: '2025-12-31'
    }
  },
  {
    id: 'hh-12',
    method: 'POST',
    path: '/api/vita/certification/validate',
    category: 'Household & VITA',
    description: 'Validate VITA certification for tax return approval',
    requiresAuth: true,
    requestBody: {
      sessionId: 1,
      returnComplexity: 'advanced'
    },
    responseExample: {
      valid: true,
      certificationLevel: 'advanced',
      canApprove: true
    }
  },
  {
    id: 'hh-13',
    method: 'GET',
    path: '/api/counties',
    category: 'Household & VITA',
    description: 'Get Maryland counties',
    requiresAuth: false,
    responseExample: [
      {
        id: 1,
        name: 'Baltimore City',
        code: 'BAL',
        population: 585708
      }
    ]
  },
  {
    id: 'hh-14',
    method: 'GET',
    path: '/api/counties/:id/analytics',
    category: 'Household & VITA',
    description: 'Get analytics for specific county',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    responseExample: {
      totalCases: 1250,
      approvalRate: 0.68,
      avgProcessingTime: 5.2,
      topPrograms: ['SNAP', 'EITC']
    }
  },
  {
    id: 'hh-15',
    method: 'GET',
    path: '/api/household-profiles/:id/financial-radar',
    category: 'Household & VITA',
    description: 'Get financial opportunity radar for household',
    requiresAuth: true,
    responseExample: {
      opportunities: [
        { program: 'EITC', value: 3500, likelihood: 0.95 },
        { program: 'SNAP', value: 450, likelihood: 0.88 }
      ],
      totalPotentialValue: 3950
    }
  },
  {
    id: 'hh-16',
    method: 'GET',
    path: '/api/evaluation/test-cases',
    category: 'Household & VITA',
    description: 'Get evaluation test cases for Maryland households',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        name: 'Baltimore Family of 3',
        household: { size: 3, income: 35000 },
        expectedSnap: 450
      }
    ]
  },
  {
    id: 'hh-17',
    method: 'POST',
    path: '/api/evaluation/test-cases',
    category: 'Household & VITA',
    description: 'Create new evaluation test case',
    requiresAuth: true,
    requestBody: {
      name: 'Test Case 1',
      household: { size: 4, income: 40000 },
      expectedResults: { snap: 600 }
    },
    responseExample: {
      id: 2,
      created: true
    }
  },
  {
    id: 'hh-18',
    method: 'GET',
    path: '/api/evaluation/runs',
    category: 'Household & VITA',
    description: 'Get evaluation runs',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        testCases: 25,
        passed: 23,
        failed: 2,
        runAt: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'hh-19',
    method: 'POST',
    path: '/api/evaluation/runs',
    category: 'Household & VITA',
    description: 'Run evaluation suite',
    requiresAuth: true,
    requestBody: {
      testCaseIds: [1, 2, 3]
    },
    responseExample: {
      id: 2,
      started: true,
      status: 'running'
    }
  },
  {
    id: 'hh-20',
    method: 'GET',
    path: '/api/evaluation/runs/:id/results',
    category: 'Household & VITA',
    description: 'Get results for evaluation run',
    requiresAuth: true,
    responseExample: {
      runId: 1,
      totalTests: 25,
      passed: 23,
      failed: 2,
      results: [
        { testCase: 1, passed: true, actualSnap: 450, expectedSnap: 450 }
      ]
    }
  },

  // ============================================================================
  // CASEWORKER & NAVIGATOR (15 endpoints)
  // ============================================================================
  {
    id: 'case-1',
    method: 'GET',
    path: '/api/caseworker/dashboard',
    category: 'Caseworker & Navigator',
    description: 'Get caseworker dashboard data',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    responseExample: {
      activeCases: 45,
      pendingVerifications: 12,
      upcomingAppointments: 8,
      todayTasks: 15
    }
  },
  {
    id: 'case-2',
    method: 'GET',
    path: '/api/navigator/performance',
    category: 'Caseworker & Navigator',
    description: 'Get navigator performance metrics',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    responseExample: {
      casesCompleted: 125,
      avgCompletionTime: 4.5,
      clientSatisfaction: 4.7,
      badgesEarned: 12
    }
  },
  {
    id: 'case-3',
    method: 'GET',
    path: '/api/navigator/achievements',
    category: 'Caseworker & Navigator',
    description: 'Get navigator achievements and badges',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        name: 'First 10 Cases',
        description: 'Complete 10 cases',
        earned: true,
        earnedAt: '2025-09-15'
      }
    ]
  },
  {
    id: 'case-4',
    method: 'GET',
    path: '/api/leaderboard',
    category: 'Caseworker & Navigator',
    description: 'Get navigator leaderboard',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    responseExample: [
      {
        rank: 1,
        navigator: 'Jane Smith',
        points: 1250,
        casesCompleted: 125
      },
      {
        rank: 2,
        navigator: 'John Doe',
        points: 1100,
        casesCompleted: 110
      }
    ]
  },
  {
    id: 'case-5',
    method: 'GET',
    path: '/api/leaderboard/county/:countyId',
    category: 'Caseworker & Navigator',
    description: 'Get leaderboard for specific county',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    responseExample: [
      {
        rank: 1,
        navigator: 'Jane Smith',
        points: 850,
        county: 'Baltimore City'
      }
    ]
  },
  {
    id: 'case-6',
    method: 'POST',
    path: '/api/achievements/check',
    category: 'Caseworker & Navigator',
    description: 'Check for new achievements',
    requiresAuth: true,
    responseExample: {
      newAchievements: [
        {
          id: 5,
          name: 'Speed Demon',
          description: 'Complete case in under 2 days'
        }
      ]
    }
  },
  {
    id: 'case-7',
    method: 'GET',
    path: '/api/kpis/navigator',
    category: 'Caseworker & Navigator',
    description: 'Get KPI metrics for navigator',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    responseExample: {
      avgResponseTime: 2.5,
      firstContactResolution: 0.72,
      clientRetention: 0.88
    }
  },
  {
    id: 'case-8',
    method: 'GET',
    path: '/api/kpis/county/:countyId',
    category: 'Caseworker & Navigator',
    description: 'Get KPI metrics for county',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    responseExample: {
      totalNavigators: 25,
      avgCaseLoad: 45,
      completionRate: 0.82
    }
  },
  {
    id: 'case-9',
    method: 'POST',
    path: '/api/kpis/track',
    category: 'Caseworker & Navigator',
    description: 'Track KPI event',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    requestBody: {
      event: 'case_completed',
      metadata: { caseId: 1, duration: 3.5 }
    },
    responseExample: {
      tracked: true
    }
  },
  {
    id: 'case-10',
    method: 'GET',
    path: '/api/caseworker/queue',
    category: 'Caseworker & Navigator',
    description: 'Get work queue for caseworker',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    responseExample: [
      {
        id: 1,
        type: 'document_verification',
        priority: 'high',
        client: 'John Doe',
        dueDate: '2025-10-20'
      }
    ]
  },
  {
    id: 'case-11',
    method: 'GET',
    path: '/api/supervisor/team-performance',
    category: 'Caseworker & Navigator',
    description: 'Get team performance metrics for supervisor',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      teamSize: 15,
      avgCasesPerNavigator: 42,
      teamCompletionRate: 0.85,
      topPerformer: 'Jane Smith'
    }
  },
  {
    id: 'case-12',
    method: 'GET',
    path: '/api/navigator/workload',
    category: 'Caseworker & Navigator',
    description: 'Get current workload for navigator',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    responseExample: {
      activeCases: 45,
      pendingTasks: 18,
      upcomingDeadlines: 5,
      capacity: 0.75
    }
  },
  {
    id: 'case-13',
    method: 'POST',
    path: '/api/cases/assign',
    category: 'Caseworker & Navigator',
    description: 'Assign case to navigator',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      caseId: 1,
      navigatorId: 5
    },
    responseExample: {
      assigned: true,
      navigator: 'Jane Smith'
    }
  },
  {
    id: 'case-14',
    method: 'POST',
    path: '/api/cases/transfer',
    category: 'Caseworker & Navigator',
    description: 'Transfer case to another navigator',
    requiresAuth: true,
    requiredRole: ['staff', 'admin'],
    requestBody: {
      caseId: 1,
      fromNavigatorId: 5,
      toNavigatorId: 8,
      reason: 'Workload balancing'
    },
    responseExample: {
      transferred: true
    }
  },
  {
    id: 'case-15',
    method: 'GET',
    path: '/api/navigator/training-progress',
    category: 'Caseworker & Navigator',
    description: 'Get training progress for navigator',
    requiresAuth: true,
    responseExample: {
      completedModules: 12,
      totalModules: 15,
      certifications: ['SNAP Basic', 'TANF Fundamentals'],
      nextCertification: 'VITA Advanced'
    }
  },

  // ============================================================================
  // ADMINISTRATION (25 endpoints)
  // ============================================================================
  {
    id: 'admin-1',
    method: 'GET',
    path: '/api/users',
    category: 'Administration',
    description: 'Get all users (admin only)',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        username: 'john_doe',
        role: 'client',
        createdAt: '2025-10-01'
      }
    ]
  },
  {
    id: 'admin-2',
    method: 'PATCH',
    path: '/api/users/:id/role',
    category: 'Administration',
    description: 'Update user role',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      role: 'staff'
    },
    responseExample: {
      id: 1,
      role: 'staff',
      updated: true
    }
  },
  {
    id: 'admin-3',
    method: 'GET',
    path: '/api/audit-logs',
    category: 'Administration',
    description: 'Get audit logs',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        action: 'user_login',
        userId: 1,
        timestamp: '2025-10-18T01:00:00.000Z',
        ipAddress: '127.0.0.1'
      }
    ]
  },
  {
    id: 'admin-4',
    method: 'GET',
    path: '/api/audit-logs/search',
    category: 'Administration',
    description: 'Search audit logs',
    requiresAuth: true,
    requiredRole: ['admin'],
    queryParams: [
      { name: 'action', type: 'string', required: false, description: 'Action type filter' },
      { name: 'userId', type: 'number', required: false, description: 'User ID filter' }
    ],
    responseExample: [
      {
        id: 1,
        action: 'document_verified',
        userId: 5,
        timestamp: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'admin-5',
    method: 'GET',
    path: '/api/rule-change-logs',
    category: 'Administration',
    description: 'Get rule change logs',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        ruleName: 'SNAP Income Limit',
        oldValue: 2400,
        newValue: 2500,
        changedAt: '2025-10-01',
        changedBy: 'Admin'
      }
    ]
  },
  {
    id: 'admin-6',
    method: 'GET',
    path: '/api/compliance/rules',
    category: 'Administration',
    description: 'Get compliance rules',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        name: 'HIPAA PHI Protection',
        description: 'All PHI must be encrypted',
        severity: 'critical'
      }
    ]
  },
  {
    id: 'admin-7',
    method: 'GET',
    path: '/api/compliance/violations',
    category: 'Administration',
    description: 'Get compliance violations',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        rule: 'HIPAA PHI Protection',
        severity: 'high',
        detectedAt: '2025-10-18T01:00:00.000Z',
        resolved: false
      }
    ]
  },
  {
    id: 'admin-8',
    method: 'POST',
    path: '/api/compliance/violations/:id/resolve',
    category: 'Administration',
    description: 'Resolve compliance violation',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      resolution: 'Updated encryption settings',
      resolvedBy: 'Admin'
    },
    responseExample: {
      id: 1,
      resolved: true,
      resolvedAt: '2025-10-18T02:00:00.000Z'
    }
  },
  {
    id: 'admin-9',
    method: 'GET',
    path: '/api/security/monitoring',
    category: 'Administration',
    description: 'Get security monitoring dashboard',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      failedLogins: 5,
      suspiciousActivity: 2,
      activeUsers: 125,
      securityScore: 95
    }
  },
  {
    id: 'admin-10',
    method: 'GET',
    path: '/api/feedback',
    category: 'Administration',
    description: 'Get user feedback submissions',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        rating: 5,
        comment: 'Great service!',
        submittedBy: 'John Doe',
        submittedAt: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'admin-11',
    method: 'POST',
    path: '/api/feedback',
    category: 'Administration',
    description: 'Submit user feedback',
    requiresAuth: true,
    requestBody: {
      rating: 5,
      category: 'navigation',
      comment: 'Easy to use'
    },
    responseExample: {
      id: 2,
      submitted: true
    }
  },
  {
    id: 'admin-12',
    method: 'GET',
    path: '/api/search-queries',
    category: 'Administration',
    description: 'Get search query analytics',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        query: 'SNAP income limits',
        count: 125,
        avgRelevanceScore: 0.92
      }
    ]
  },
  {
    id: 'admin-13',
    method: 'POST',
    path: '/api/quick-rating',
    category: 'Administration',
    description: 'Submit quick rating for search result',
    requiresAuth: true,
    requestBody: {
      searchQueryId: 1,
      helpful: true
    },
    responseExample: {
      id: 1,
      recorded: true
    }
  },
  {
    id: 'admin-14',
    method: 'GET',
    path: '/api/policy-sources',
    category: 'Administration',
    description: 'Get policy sources',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        name: '7 CFR Part 273',
        url: 'https://ecfr.gov/...',
        lastSynced: '2025-10-15'
      }
    ]
  },
  {
    id: 'admin-15',
    method: 'POST',
    path: '/api/policy-sources',
    category: 'Administration',
    description: 'Add new policy source',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      name: 'Maryland DHS Manual',
      url: 'https://dhs.maryland.gov/...',
      sourceType: 'state_manual'
    },
    responseExample: {
      id: 2,
      created: true
    }
  },
  {
    id: 'admin-16',
    method: 'POST',
    path: '/api/policy-sources/:id/sync',
    category: 'Administration',
    description: 'Sync policy source (download and process)',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      synced: true,
      pagesProcessed: 150,
      duration: 45
    }
  },
  {
    id: 'admin-17',
    method: 'POST',
    path: '/api/policy-sources/:id/scrape',
    category: 'Administration',
    description: 'Scrape policy source',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      scraped: true,
      documentsFound: 25
    }
  },
  {
    id: 'admin-18',
    method: 'POST',
    path: '/api/policy-sources/ecfr/bulk-download',
    category: 'Administration',
    description: 'Bulk download from eCFR',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      title: '7',
      part: '273'
    },
    responseExample: {
      downloaded: true,
      sections: 45
    }
  },
  {
    id: 'admin-19',
    method: 'POST',
    path: '/api/policy-sources/fns-state-options',
    category: 'Administration',
    description: 'Parse FNS state options PDF',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      parsed: true,
      optionsFound: 15
    }
  },
  {
    id: 'admin-20',
    method: 'GET',
    path: '/api/training/jobs',
    category: 'Administration',
    description: 'Get AI training jobs',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        modelName: 'classifier',
        status: 'completed',
        accuracy: 0.94
      }
    ]
  },
  {
    id: 'admin-21',
    method: 'POST',
    path: '/api/training/jobs',
    category: 'Administration',
    description: 'Start new AI training job',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      modelName: 'document_classifier',
      trainingData: 'training_set_v2'
    },
    responseExample: {
      id: 2,
      started: true,
      estimatedTime: 120
    }
  },
  {
    id: 'admin-22',
    method: 'POST',
    path: '/api/cache/clear',
    category: 'Administration',
    description: 'Clear application cache',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      cacheType: 'all'
    },
    responseExample: {
      cleared: true,
      keysRemoved: 450
    }
  },
  {
    id: 'admin-23',
    method: 'GET',
    path: '/api/cache/stats',
    category: 'Administration',
    description: 'Get cache statistics',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      totalKeys: 450,
      hitRate: 0.85,
      memoryUsage: '125 MB'
    }
  },
  {
    id: 'admin-24',
    method: 'POST',
    path: '/api/admin/seed-demo-data',
    category: 'Administration',
    description: 'Seed demo data for testing',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      seeded: true,
      households: 10,
      documents: 50,
      users: 15
    }
  },
  {
    id: 'admin-25',
    method: 'GET',
    path: '/api/system/diagnostics',
    category: 'Administration',
    description: 'Get system diagnostics',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      databaseStatus: 'healthy',
      cacheStatus: 'healthy',
      aiServicesStatus: 'healthy',
      diskUsage: '45%',
      memoryUsage: '62%'
    }
  },

  // ============================================================================
  // GAMIFICATION & LEADERBOARDS (8 endpoints)
  // ============================================================================
  {
    id: 'game-1',
    method: 'GET',
    path: '/api/achievements',
    category: 'Gamification & Leaderboards',
    description: 'Get all available achievements',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        name: 'First Case',
        description: 'Complete your first case',
        points: 10,
        icon: 'trophy'
      }
    ]
  },
  {
    id: 'game-2',
    method: 'GET',
    path: '/api/achievements/user',
    category: 'Gamification & Leaderboards',
    description: 'Get user achievements',
    requiresAuth: true,
    responseExample: [
      {
        achievementId: 1,
        earnedAt: '2025-10-15',
        progress: 100
      }
    ]
  },
  {
    id: 'game-3',
    method: 'GET',
    path: '/api/leaderboard/global',
    category: 'Gamification & Leaderboards',
    description: 'Get global leaderboard',
    requiresAuth: true,
    responseExample: [
      {
        rank: 1,
        user: 'Jane Smith',
        points: 1250,
        achievements: 15
      }
    ]
  },
  {
    id: 'game-4',
    method: 'GET',
    path: '/api/leaderboard/weekly',
    category: 'Gamification & Leaderboards',
    description: 'Get weekly leaderboard',
    requiresAuth: true,
    responseExample: [
      {
        rank: 1,
        user: 'John Doe',
        points: 150,
        thisWeek: true
      }
    ]
  },
  {
    id: 'game-5',
    method: 'GET',
    path: '/api/badges',
    category: 'Gamification & Leaderboards',
    description: 'Get all badges',
    requiresAuth: true,
    responseExample: [
      {
        id: 1,
        name: 'Gold Star',
        description: '100 cases completed',
        rarity: 'rare'
      }
    ]
  },
  {
    id: 'game-6',
    method: 'GET',
    path: '/api/badges/user',
    category: 'Gamification & Leaderboards',
    description: 'Get user badges',
    requiresAuth: true,
    responseExample: [
      {
        badgeId: 1,
        earnedAt: '2025-10-10',
        displayed: true
      }
    ]
  },
  {
    id: 'game-7',
    method: 'POST',
    path: '/api/achievements/claim',
    category: 'Gamification & Leaderboards',
    description: 'Claim achievement reward',
    requiresAuth: true,
    requestBody: {
      achievementId: 1
    },
    responseExample: {
      claimed: true,
      pointsAwarded: 10
    }
  },
  {
    id: 'game-8',
    method: 'GET',
    path: '/api/user/points',
    category: 'Gamification & Leaderboards',
    description: 'Get user points and level',
    requiresAuth: true,
    responseExample: {
      totalPoints: 850,
      level: 12,
      nextLevelPoints: 1000
    }
  },

  // ============================================================================
  // COMPLIANCE & AUDIT (10 endpoints)
  // ============================================================================
  {
    id: 'comp-1',
    method: 'GET',
    path: '/api/compliance/dashboard',
    category: 'Compliance & Audit',
    description: 'Get compliance dashboard',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      overallScore: 95,
      criticalViolations: 0,
      highViolations: 2,
      mediumViolations: 5
    }
  },
  {
    id: 'comp-2',
    method: 'POST',
    path: '/api/compliance/rules',
    category: 'Compliance & Audit',
    description: 'Create compliance rule',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      name: 'Data Retention Policy',
      description: 'All records must be retained for 7 years',
      severity: 'high'
    },
    responseExample: {
      id: 2,
      created: true
    }
  },
  {
    id: 'comp-3',
    method: 'POST',
    path: '/api/compliance/scan',
    category: 'Compliance & Audit',
    description: 'Run compliance scan',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      scanId: 1,
      started: true,
      estimatedTime: 60
    }
  },
  {
    id: 'comp-4',
    method: 'GET',
    path: '/api/compliance/scan/:id/results',
    category: 'Compliance & Audit',
    description: 'Get compliance scan results',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      scanId: 1,
      violationsFound: 7,
      criticalIssues: 0,
      recommendations: ['Update encryption', 'Review access controls']
    }
  },
  {
    id: 'comp-5',
    method: 'GET',
    path: '/api/audit/user-actions',
    category: 'Compliance & Audit',
    description: 'Get user action audit trail',
    requiresAuth: true,
    requiredRole: ['admin'],
    queryParams: [
      { name: 'userId', type: 'number', required: false, description: 'Filter by user ID' },
      { name: 'startDate', type: 'string', required: false, description: 'Start date filter' }
    ],
    responseExample: [
      {
        userId: 1,
        action: 'document_viewed',
        resource: 'document-123',
        timestamp: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'comp-6',
    method: 'GET',
    path: '/api/audit/data-access',
    category: 'Compliance & Audit',
    description: 'Get data access audit logs (HIPAA compliance)',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        userId: 5,
        dataType: 'PHI',
        action: 'view',
        reason: 'case_review',
        timestamp: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'comp-7',
    method: 'POST',
    path: '/api/audit/export',
    category: 'Compliance & Audit',
    description: 'Export audit logs for compliance reporting',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      startDate: '2025-10-01',
      endDate: '2025-10-18',
      format: 'csv'
    },
    responseExample: {
      exportId: 1,
      downloadUrl: '/api/audit/download/1',
      recordsIncluded: 5000
    }
  },
  {
    id: 'comp-8',
    method: 'GET',
    path: '/api/compliance/hipaa-status',
    category: 'Compliance & Audit',
    description: 'Get HIPAA compliance status',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      compliant: true,
      lastAudit: '2025-10-01',
      encryptionEnabled: true,
      accessControlsActive: true
    }
  },
  {
    id: 'comp-9',
    method: 'GET',
    path: '/api/compliance/encryption-status',
    category: 'Compliance & Audit',
    description: 'Get encryption status for sensitive data',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      totalRecords: 5000,
      encryptedRecords: 5000,
      encryptionRate: 1.0,
      algorithm: 'AES-256-GCM'
    }
  },
  {
    id: 'comp-10',
    method: 'POST',
    path: '/api/compliance/breach-notification',
    category: 'Compliance & Audit',
    description: 'Record data breach notification',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      incidentDate: '2025-10-18',
      affectedRecords: 5,
      description: 'Unauthorized access attempt',
      mitigationSteps: 'Credentials revoked, accounts secured'
    },
    responseExample: {
      id: 1,
      reported: true,
      notificationSent: true
    }
  },

  // ============================================================================
  // DEMO DATA (10 endpoints)
  // ============================================================================
  {
    id: 'demo-1',
    method: 'GET',
    path: '/api/demo/households',
    category: 'Demo Data',
    description: 'Get demo household data (public access)',
    requiresAuth: false,
    responseExample: [
      {
        id: 'HH-001',
        name: 'Baltimore Family of 3',
        size: 3,
        income: 35000,
        programs: ['SNAP']
      }
    ]
  },
  {
    id: 'demo-2',
    method: 'GET',
    path: '/api/demo/benefit-calculations',
    category: 'Demo Data',
    description: 'Get demo benefit calculations',
    requiresAuth: false,
    responseExample: [
      {
        id: 1,
        household: 'HH-001',
        snap: 450,
        eitc: 3500
      }
    ]
  },
  {
    id: 'demo-3',
    method: 'GET',
    path: '/api/demo/documents',
    category: 'Demo Data',
    description: 'Get demo documents',
    requiresAuth: false,
    responseExample: [
      {
        id: 1,
        type: 'Pay Stub',
        status: 'verified',
        household: 'HH-001'
      }
    ]
  },
  {
    id: 'demo-4',
    method: 'GET',
    path: '/api/demo/tax-returns',
    category: 'Demo Data',
    description: 'Get demo tax returns',
    requiresAuth: false,
    responseExample: [
      {
        id: 1,
        taxpayer: 'John Doe',
        year: 2024,
        federalRefund: 3500
      }
    ]
  },
  {
    id: 'demo-5',
    method: 'GET',
    path: '/api/demo/ai-conversations',
    category: 'Demo Data',
    description: 'Get demo AI conversation examples',
    requiresAuth: false,
    responseExample: [
      {
        id: 'CONV-IC-001',
        type: 'intake_copilot',
        messages: [
          { role: 'user', content: 'What benefits am I eligible for?' },
          { role: 'assistant', content: 'Based on your household info...' }
        ]
      }
    ]
  },
  {
    id: 'demo-6',
    method: 'GET',
    path: '/api/demo/policy-sources',
    category: 'Demo Data',
    description: 'Get demo policy sources',
    requiresAuth: false,
    responseExample: [
      {
        id: 1,
        name: '7 CFR § 273.2',
        category: 'Federal Regulations',
        lastUpdated: '2025-10-01'
      }
    ]
  },
  {
    id: 'demo-7',
    method: 'GET',
    path: '/api/demo/users',
    category: 'Demo Data',
    description: 'Get demo user profiles',
    requiresAuth: false,
    responseExample: [
      {
        id: 1,
        name: 'Jane Smith',
        role: 'navigator',
        cases: 125
      }
    ]
  },
  {
    id: 'demo-8',
    method: 'GET',
    path: '/api/demo/metrics',
    category: 'Demo Data',
    description: 'Get demo platform metrics',
    requiresAuth: false,
    responseExample: {
      totalHouseholds: 1250,
      benefitsDistributed: 5600000,
      averageProcessingTime: 4.5,
      satisfactionScore: 4.7
    }
  },
  {
    id: 'demo-9',
    method: 'GET',
    path: '/api/demo/appointments',
    category: 'Demo Data',
    description: 'Get demo appointments',
    requiresAuth: false,
    responseExample: [
      {
        id: 1,
        client: 'John Doe',
        navigator: 'Jane Smith',
        date: '2025-10-20T10:00:00.000Z',
        type: 'SNAP Interview'
      }
    ]
  },
  {
    id: 'demo-10',
    method: 'GET',
    path: '/api/demo/households/:id',
    category: 'Demo Data',
    description: 'Get specific demo household details',
    requiresAuth: false,
    responseExample: {
      id: 'HH-001',
      name: 'Baltimore Family of 3',
      members: [
        { age: 35, relation: 'head', employed: true },
        { age: 33, relation: 'spouse', employed: false },
        { age: 5, relation: 'child' }
      ],
      totalIncome: 35000,
      benefits: { snap: 450, medicaid: 'eligible' }
    }
  },

  // ============================================================================
  // WEBHOOKS & API KEYS (12 endpoints)
  // ============================================================================
  {
    id: 'webhook-1',
    method: 'GET',
    path: '/api/admin/webhooks',
    category: 'Webhooks & API Keys',
    description: 'Get all webhooks',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        name: 'Case Status Updates',
        url: 'https://example.com/webhook',
        events: ['case_completed', 'case_denied'],
        active: true
      }
    ]
  },
  {
    id: 'webhook-2',
    method: 'POST',
    path: '/api/admin/webhooks',
    category: 'Webhooks & API Keys',
    description: 'Create new webhook',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      name: 'Document Verified Hook',
      url: 'https://example.com/webhook/docs',
      events: ['document_verified'],
      secret: 'webhook_secret_123'
    },
    responseExample: {
      id: 2,
      created: true,
      webhookId: 'whk_abc123'
    }
  },
  {
    id: 'webhook-3',
    method: 'PUT',
    path: '/api/admin/webhooks/:id',
    category: 'Webhooks & API Keys',
    description: 'Update webhook',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      active: false
    },
    responseExample: {
      id: 1,
      updated: true
    }
  },
  {
    id: 'webhook-4',
    method: 'DELETE',
    path: '/api/admin/webhooks/:id',
    category: 'Webhooks & API Keys',
    description: 'Delete webhook',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      deleted: true
    }
  },
  {
    id: 'webhook-5',
    method: 'POST',
    path: '/api/admin/webhooks/:id/test',
    category: 'Webhooks & API Keys',
    description: 'Test webhook',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      tested: true,
      status: 200,
      responseTime: 150
    }
  },
  {
    id: 'webhook-6',
    method: 'GET',
    path: '/api/admin/webhooks/:id/logs',
    category: 'Webhooks & API Keys',
    description: 'Get webhook delivery logs',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 1,
        event: 'case_completed',
        status: 200,
        deliveredAt: '2025-10-18T01:00:00.000Z'
      }
    ]
  },
  {
    id: 'apikey-1',
    method: 'POST',
    path: '/api/admin/api-keys',
    category: 'Webhooks & API Keys',
    description: 'Create new API key',
    requiresAuth: true,
    requiredRole: ['admin'],
    requestBody: {
      name: 'Integration API Key',
      scopes: ['read:households', 'write:documents'],
      expiresAt: '2026-10-18'
    },
    responseExample: {
      id: 'key_abc123',
      apiKey: 'sk_live_xxx_yyy_zzz',
      created: true
    }
  },
  {
    id: 'apikey-2',
    method: 'GET',
    path: '/api/admin/api-keys',
    category: 'Webhooks & API Keys',
    description: 'Get all API keys',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: [
      {
        id: 'key_abc123',
        name: 'Integration API Key',
        lastUsed: '2025-10-18T01:00:00.000Z',
        status: 'active'
      }
    ]
  },
  {
    id: 'apikey-3',
    method: 'GET',
    path: '/api/admin/api-keys/:keyId/stats',
    category: 'Webhooks & API Keys',
    description: 'Get API key usage statistics',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      totalRequests: 5000,
      requestsThisMonth: 450,
      avgResponseTime: 120,
      errorRate: 0.02
    }
  },
  {
    id: 'apikey-4',
    method: 'POST',
    path: '/api/admin/api-keys/:keyId/revoke',
    category: 'Webhooks & API Keys',
    description: 'Revoke API key',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      revoked: true,
      revokedAt: '2025-10-18T02:00:00.000Z'
    }
  },
  {
    id: 'apikey-5',
    method: 'POST',
    path: '/api/admin/api-keys/:keyId/suspend',
    category: 'Webhooks & API Keys',
    description: 'Suspend API key temporarily',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      suspended: true
    }
  },
  {
    id: 'apikey-6',
    method: 'POST',
    path: '/api/admin/api-keys/:keyId/reactivate',
    category: 'Webhooks & API Keys',
    description: 'Reactivate suspended API key',
    requiresAuth: true,
    requiredRole: ['admin'],
    responseExample: {
      reactivated: true,
      status: 'active'
    }
  }
];
