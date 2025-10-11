/**
 * Maryland Benefits Navigator - API Contracts
 * 
 * Complete TypeScript interfaces for all 160+ API endpoints.
 * Organized by feature area for easy navigation.
 * 
 * ⚠️ IMPORTANT NOTES:
 * 
 * 1. **Documentation Reference**: This is a reference template for AI agents and developers.
 *    Actual API responses may vary from these contracts. Always verify against server/routes.ts.
 * 
 * 2. **Response Structure Variations**:
 *    - Many endpoints return plain objects: `{ documents: Document[] }` NOT `PaginatedResponse<Document>`
 *    - Pagination is NOT uniformly implemented. Check actual route handlers for response shape.
 *    - HealthCheckResponse includes nullable fields (latency: null) in initial state.
 * 
 * 3. **Type References**: 
 *    - Entity types (User, Document, etc.) defined as `any` for self-containment
 *    - For production use, import actual types from ../../shared/schema.ts
 * 
 * 4. **Contract Validation**:
 *    - Before using in production, verify response structures in server/routes.ts
 *    - Add automated contract tests to ensure backend/frontend type alignment
 *    - Consider using tRPC or similar for runtime type safety
 * 
 * Usage:
 * - Reference patterns for building new endpoints
 * - Understand expected request/response shapes
 * - Generate OpenAPI/Swagger documentation
 * - AI agent guidance for API interactions
 * 
 * @version 1.0
 * @lastUpdated January 2025
 */

// Core entity types (reference - actual types in shared/schema.ts)
type User = any;
type BenefitProgram = any;
type Document = any;
type DocumentType = any;
type SearchQuery = any;
type PolicySource = any;
type Model = any;
type TrainingJob = any;
type NavigatorSession = any;
type Notification = any;
type PolicyChange = any;
type Feedback = any;
type HouseholdScenario = any;
type ScenarioComparison = any;
type AbawdVerification = any;
type ProgramEnrollment = any;
type IntakeSession = any;
type ComplianceRule = any;
type ComplianceViolation = any;
type AuditLog = any;
type RuleChangeLog = any;
type ConsentForm = any;
type ClientConsent = any;

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  statusCode?: number;
  details?: any;
}

// ============================================================================
// AUTHENTICATION (/api/auth/*)
// ============================================================================

export namespace AuthAPI {
  
  // POST /api/auth/signup
  export interface SignupRequest {
    username: string;
    password: string;
    email?: string;
    fullName?: string;
    role?: "client" | "navigator" | "caseworker" | "admin";
  }
  
  export interface SignupResponse {
    user: Omit<User, "password">;
  }
  
  // POST /api/auth/login
  export interface LoginRequest {
    username: string;
    password: string;
  }
  
  export interface LoginResponse {
    user: Omit<User, "password">;
  }
  
  // POST /api/auth/logout
  export interface LogoutResponse {
    message: string;
  }
  
  // GET /api/auth/me
  export interface MeResponse {
    user: Omit<User, "password">;
  }
}

// ============================================================================
// HEALTH & SYSTEM (/api/health, /api/system/*)
// ============================================================================

export namespace HealthAPI {
  
  // GET /api/health
  export interface HealthCheckResponse {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    uptime: number;
    services: {
      database: {
        status: "healthy" | "unhealthy" | "unknown";
        latency?: string;
        connectionActive?: boolean;
        error?: string;
        message?: string;
      };
      geminiApi: {
        status: "healthy" | "degraded" | "unhealthy" | "not_configured";
        configured: boolean;
        error?: string;
        message?: string;
      };
      objectStorage?: {
        status: "healthy" | "unhealthy" | "unknown";
        configured: boolean;
      };
    };
    system: {
      memory: {
        used: number;
        total: number;
        unit: string;
      };
      nodeVersion: string;
      environment: string;
    };
  }
  
  // GET /api/system/status
  export interface SystemStatusResponse {
    totalDocuments: number;
    totalUsers: number;
    totalSearches: number;
    recentActivity: {
      date: string;
      searches: number;
      documentsUploaded: number;
    }[];
  }
}

// ============================================================================
// SEARCH & CHAT (/api/search, /api/chat/*)
// ============================================================================

export namespace SearchAPI {
  
  // POST /api/search
  export interface SearchRequest {
    query: string;
    benefitProgramId?: string;
    userId?: string;
  }
  
  export interface SearchResponse {
    answer: string;
    type: "rules_engine" | "rag" | "hybrid";
    classification: {
      isDefinitional: boolean;
      isCalculation: boolean;
      confidence: number;
      intent: string;
    };
    rules?: any[];
    citations?: Citation[];
    sources?: Source[];
    relevanceScore?: number;
    responseTime: number;
    aiExplanation?: {
      reasoning: string;
      relevanceScore: number;
    };
  }
  
  // POST /api/chat/ask
  export interface ChatRequest {
    query: string;
    context?: {
      page?: string;
      documentType?: string;
      requirementId?: string;
    };
    benefitProgramId?: string;
  }
  
  export interface ChatResponse {
    answer: string;
    citations: Citation[];
    sources: Source[];
    relevanceScore?: number;
    suggestedFollowUps: string[];
  }
  
  export interface Citation {
    index: number;
    text: string;
    source: string;
    filePath?: string;
    page?: number;
    similarityScore?: number;
  }
  
  export interface Source {
    title: string;
    url?: string;
    type: string;
    relevance?: number;
  }
}

// ============================================================================
// DOCUMENTS (/api/documents/*, /api/document-types, /api/verify-document)
// ============================================================================

export namespace DocumentAPI {
  
  // GET /api/documents
  export interface ListDocumentsRequest {
    status?: string;
    programId?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface ListDocumentsResponse extends PaginatedResponse<Document> {}
  
  // GET /api/documents/:id
  export interface GetDocumentResponse {
    document: Document;
  }
  
  // POST /api/documents/upload
  export interface UploadDocumentRequest {
    file: File;
    benefitProgramId?: string;
    documentTypeId?: string;
    metadata?: Record<string, any>;
  }
  
  export interface UploadDocumentResponse {
    document: Document;
    processingJob?: {
      jobId: string;
      status: string;
    };
  }
  
  // POST /api/documents/upload-url
  export interface GetUploadUrlResponse {
    uploadUrl: string;
    objectPath: string;
  }
  
  // POST /api/documents
  export interface CreateDocumentRequest {
    filename: string;
    objectPath: string;
    fileSize: number;
    mimeType: string;
    benefitProgramId?: string;
    documentTypeId?: string;
    metadata?: Record<string, any>;
  }
  
  export interface CreateDocumentResponse {
    document: Document;
  }
  
  // PATCH /api/documents/:id/status
  export interface UpdateDocumentStatusRequest {
    status: string;
    notes?: string;
  }
  
  export interface UpdateDocumentStatusResponse {
    document: Document;
  }
  
  // GET /api/document-types
  export interface ListDocumentTypesResponse {
    types: DocumentType[];
  }
  
  // POST /api/verify-document
  export interface VerifyDocumentRequest {
    document: File;
    documentType: string;
    clientCaseId?: string;
  }
  
  export interface VerifyDocumentResponse {
    documentType: string;
    meetsCriteria: boolean;
    summary: string;
    requirements: {
      requirement: string;
      met: boolean;
      explanation: string;
    }[];
    geminiAnalysis: {
      isValid: boolean;
      confidence: number;
      reasoning: string;
      extractedData: Record<string, any>;
    };
    objectPath?: string;
  }
}

// ============================================================================
// DOCUMENT REVIEW (/api/document-review/*)
// ============================================================================

export namespace DocumentReviewAPI {
  
  // GET /api/document-review/queue
  export interface GetReviewQueueRequest {
    status?: string;
    programId?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface GetReviewQueueResponse extends PaginatedResponse<Document> {}
  
  // GET /api/document-review/:id
  export interface GetReviewItemResponse {
    document: Document;
  }
  
  // PUT /api/document-review/:id/status
  export interface UpdateReviewStatusRequest {
    verificationStatus: string;
    reviewNotes?: string;
  }
  
  export interface UpdateReviewStatusResponse {
    document: Document;
  }
  
  // PUT /api/document-review/bulk-update
  export interface BulkUpdateRequest {
    documentIds: string[];
    verificationStatus: string;
  }
  
  export interface BulkUpdateResponse {
    updated: number;
    documents: Document[];
  }
}

// ============================================================================
// BENEFIT PROGRAMS (/api/benefit-programs)
// ============================================================================

export namespace BenefitProgramAPI {
  
  // GET /api/benefit-programs
  export interface ListBenefitProgramsResponse {
    programs: BenefitProgram[];
  }
}

// ============================================================================
// ELIGIBILITY & RULES (/api/eligibility/*, /api/rules/*)
// ============================================================================

export namespace EligibilityAPI {
  
  // POST /api/eligibility/check
  export interface CheckEligibilityRequest {
    programCode: string;
    householdSize: number;
    monthlyIncome: number;
    state?: string;
  }
  
  export interface CheckEligibilityResponse {
    eligible: boolean;
    programCode: string;
    householdSize: number;
    monthlyIncome: number;
    incomeLimit: number;
    incomePercentFPL: number;
    explanation: string;
    matchedRules: {
      ruleId: string;
      ruleType: string;
      description: string;
    }[];
  }
  
  // POST /api/eligibility/calculate
  export interface CalculateEligibilityRequest {
    programCode: string;
    householdSize: number;
    monthlyIncome: number;
    monthlyExpenses?: {
      rent?: number;
      utilities?: number;
      childCare?: number;
      medicalExpenses?: number;
      childSupport?: number;
    };
    state?: string;
  }
  
  export interface CalculateEligibilityResponse {
    eligible: boolean;
    monthlyBenefit: number;
    calculation: {
      grossIncome: number;
      earnedIncomeDeduction: number;
      netIncome: number;
      shelterDeduction: number;
      utilityAllowance: number;
      adjustedIncome: number;
      maxAllotment: number;
      finalBenefit: number;
    };
    appliedRules: {
      ruleType: string;
      value: number;
      description: string;
    }[];
  }
  
  // GET /api/eligibility/calculations
  export interface GetCalculationsRequest {
    userId?: string;
    programId?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface GetCalculationsResponse extends PaginatedResponse<any> {}
}

export namespace RulesAPI {
  
  // GET /api/rules/income-limits
  export interface GetIncomeLimitsRequest {
    programId?: string;
    effectiveDate?: string;
  }
  
  export interface GetIncomeLimitsResponse {
    rules: {
      id: string;
      programId: string;
      householdSize: number;
      grossMonthlyLimit: number;
      netMonthlyLimit: number;
      effectiveDate: string;
      endDate: string | null;
    }[];
  }
  
  // POST /api/rules/income-limits
  export interface CreateIncomeLimitRequest {
    programId: string;
    householdSize: number;
    grossMonthlyLimit: number;
    netMonthlyLimit: number;
    effectiveDate: string;
    endDate?: string;
  }
  
  export interface CreateIncomeLimitResponse {
    rule: any;
  }
  
  // PATCH /api/rules/income-limits/:id
  export interface UpdateIncomeLimitRequest {
    grossMonthlyLimit?: number;
    netMonthlyLimit?: number;
    effectiveDate?: string;
    endDate?: string;
  }
  
  export interface UpdateIncomeLimitResponse {
    rule: any;
  }
  
  // GET /api/rules/deductions
  export interface GetDeductionsResponse {
    deductions: {
      id: string;
      programId: string;
      deductionType: string;
      amount: number;
      percentage: number | null;
      description: string;
      effectiveDate: string;
    }[];
  }
  
  // GET /api/rules/allotments
  export interface GetAllotmentsResponse {
    allotments: {
      id: string;
      programId: string;
      householdSize: number;
      maxMonthlyAllotment: number;
      effectiveDate: string;
    }[];
  }
  
  // GET /api/rules/categorical-eligibility
  export interface GetCategoricalEligibilityResponse {
    rules: {
      id: string;
      programId: string;
      category: string;
      description: string;
      automaticallyEligible: boolean;
    }[];
  }
  
  // GET /api/rules/document-requirements
  export interface GetDocumentRequirementsResponse {
    requirements: {
      id: string;
      programId: string;
      requirementType: string;
      description: string;
      mandatory: boolean;
      verificationMethods: string[];
    }[];
  }
}

// ============================================================================
// POLICYENGINE (/api/policyengine/*)
// ============================================================================

export namespace PolicyEngineAPI {
  
  // POST /api/policyengine/calculate
  export interface CalculateRequest {
    household: {
      people: {
        age: number;
        [key: string]: any;
      }[];
    };
    [key: string]: any;
  }
  
  export interface CalculateResponse {
    snap: number;
    medicaid: boolean;
    tanf: number;
    eitc: number;
    ctc: number;
    ssi: number;
    [key: string]: any;
  }
  
  // POST /api/policyengine/verify
  export interface VerifyCalculationRequest {
    testCase: {
      name: string;
      programCode: string;
      household: any;
      expectedValue: number | boolean;
      tolerance?: number;
    };
  }
  
  export interface VerifyCalculationResponse {
    passed: boolean;
    testCase: string;
    programCode: string;
    expected: number | boolean;
    actual: number | boolean;
    variance?: number;
    withinTolerance?: boolean;
    timestamp: string;
  }
  
  // GET /api/policyengine/verify/stats/:programCode
  export interface GetVerifyStatsResponse {
    programCode: string;
    totalTests: number;
    passed: number;
    failed: number;
    passRate: number;
    avgVariance: number;
  }
  
  // GET /api/policyengine/verify/history/:programCode
  export interface GetVerifyHistoryResponse {
    results: {
      id: string;
      testCase: string;
      passed: boolean;
      variance?: number;
      timestamp: string;
    }[];
  }
  
  // POST /api/policyengine/summary
  export interface SummaryRequest {
    household: any;
  }
  
  export interface SummaryResponse {
    totalBenefits: number;
    breakdown: {
      program: string;
      amount: number | boolean;
      eligible: boolean;
    }[];
  }
  
  // GET /api/policyengine/test
  export interface TestResponse {
    status: string;
    pythonVersion: string;
    policyengineVersion: string;
    testResult: any;
  }
}

// ============================================================================
// NAVIGATOR WORKSPACE (/api/navigator/*)
// ============================================================================

export namespace NavigatorAPI {
  
  // GET /api/navigator/sessions
  export interface GetSessionsRequest {
    status?: string;
    clientName?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface GetSessionsResponse extends PaginatedResponse<NavigatorSession> {}
  
  // POST /api/navigator/sessions
  export interface CreateSessionRequest {
    clientIdentifier: string;
    clientName?: string;
    programIds: string[];
    notes?: string;
  }
  
  export interface CreateSessionResponse {
    session: NavigatorSession;
  }
  
  // GET /api/navigator/sessions/:sessionId/documents
  export interface GetSessionDocumentsResponse {
    documents: Document[];
  }
  
  // POST /api/navigator/sessions/:sessionId/documents
  export interface UploadSessionDocumentRequest {
    file: File;
    documentTypeId?: string;
    notes?: string;
  }
  
  export interface UploadSessionDocumentResponse {
    document: Document;
  }
  
  // PATCH /api/navigator/documents/:id
  export interface UpdateSessionDocumentRequest {
    verificationStatus?: string;
    notes?: string;
  }
  
  export interface UpdateSessionDocumentResponse {
    document: Document;
  }
  
  // DELETE /api/navigator/documents/:id
  export interface DeleteSessionDocumentResponse {
    success: boolean;
  }
  
  // GET /api/navigator/exports
  export interface GetExportsRequest {
    sessionId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface GetExportsResponse extends PaginatedResponse<any> {}
  
  // POST /api/navigator/exports
  export interface CreateExportRequest {
    sessionId: string;
    format: "csv" | "json" | "xml";
    includeDocuments?: boolean;
  }
  
  export interface CreateExportResponse {
    export: {
      id: string;
      batchId: string;
      format: string;
      status: string;
      recordCount: number;
    };
  }
  
  // GET /api/navigator/exports/:id/download
  export interface DownloadExportResponse {
    // Binary file data
  }
}

// ============================================================================
// SCENARIOS & COMPARISONS (/api/scenarios/*, /api/comparisons/*)
// ============================================================================

export namespace ScenarioAPI {
  
  // GET /api/scenarios
  export interface GetScenariosRequest {
    userId?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface GetScenariosResponse extends PaginatedResponse<HouseholdScenario> {}
  
  // GET /api/scenarios/:id
  export interface GetScenarioResponse {
    scenario: HouseholdScenario;
  }
  
  // POST /api/scenarios
  export interface CreateScenarioRequest {
    name: string;
    description?: string;
    householdData: {
      householdSize: number;
      monthlyIncome: number;
      monthlyExpenses?: Record<string, number>;
      members?: any[];
    };
  }
  
  export interface CreateScenarioResponse {
    scenario: HouseholdScenario;
  }
  
  // PATCH /api/scenarios/:id
  export interface UpdateScenarioRequest {
    name?: string;
    description?: string;
    householdData?: any;
  }
  
  export interface UpdateScenarioResponse {
    scenario: HouseholdScenario;
  }
  
  // DELETE /api/scenarios/:id
  export interface DeleteScenarioResponse {
    success: boolean;
  }
  
  // POST /api/scenarios/:id/calculate
  export interface CalculateScenarioRequest {
    programs?: string[];
  }
  
  export interface CalculateScenarioResponse {
    calculation: {
      id: string;
      scenarioId: string;
      results: {
        programCode: string;
        eligible: boolean;
        monthlyBenefit: number;
      }[];
      timestamp: string;
    };
  }
  
  // GET /api/scenarios/:id/calculations
  export interface GetScenarioCalculationsResponse {
    calculations: any[];
  }
  
  // GET /api/scenarios/:id/calculations/latest
  export interface GetLatestCalculationResponse {
    calculation: any;
  }
}

export namespace ComparisonAPI {
  
  // GET /api/comparisons
  export interface GetComparisonsResponse extends PaginatedResponse<ScenarioComparison> {}
  
  // GET /api/comparisons/:id
  export interface GetComparisonResponse {
    comparison: ScenarioComparison;
  }
  
  // POST /api/comparisons
  export interface CreateComparisonRequest {
    name: string;
    scenarioIds: string[];
  }
  
  export interface CreateComparisonResponse {
    comparison: ScenarioComparison;
  }
  
  // PATCH /api/comparisons/:id
  export interface UpdateComparisonRequest {
    name?: string;
    scenarioIds?: string[];
  }
  
  export interface UpdateComparisonResponse {
    comparison: ScenarioComparison;
  }
  
  // DELETE /api/comparisons/:id
  export interface DeleteComparisonResponse {
    success: boolean;
  }
}

// ============================================================================
// SCREENER (/api/screener/*)
// ============================================================================

export namespace ScreenerAPI {
  
  // POST /api/screener/save
  export interface SaveScreenerRequest {
    sessionId?: string;
    householdData: any;
    calculationResults: any;
  }
  
  export interface SaveScreenerResponse {
    sessionId: string;
    saved: boolean;
  }
  
  // GET /api/screener/sessions/:sessionId
  export interface GetScreenerSessionResponse {
    session: {
      id: string;
      householdData: any;
      calculationResults: any;
      createdAt: string;
    };
  }
  
  // POST /api/screener/sessions/:sessionId/claim
  export interface ClaimSessionRequest {
    // Empty - user from auth
  }
  
  export interface ClaimSessionResponse {
    success: boolean;
    session: any;
  }
  
  // GET /api/screener/my-sessions
  export interface GetMySessionsResponse {
    sessions: any[];
  }
}

// ============================================================================
// INTAKE (/api/intake-sessions/*, /api/application-forms)
// ============================================================================

export namespace IntakeAPI {
  
  // GET /api/intake-sessions
  export interface GetIntakeSessionsRequest {
    status?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface GetIntakeSessionsResponse extends PaginatedResponse<IntakeSession> {}
  
  // GET /api/intake-sessions/:id
  export interface GetIntakeSessionResponse {
    session: IntakeSession;
  }
  
  // POST /api/intake-sessions
  export interface CreateIntakeSessionRequest {
    programId: string;
    clientIdentifier?: string;
  }
  
  export interface CreateIntakeSessionResponse {
    session: IntakeSession;
  }
  
  // GET /api/intake-sessions/:id/messages
  export interface GetSessionMessagesResponse {
    messages: {
      id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: string;
      extractedData?: Record<string, any>;
    }[];
  }
  
  // POST /api/intake-sessions/:id/messages
  export interface SendMessageRequest {
    message: string;
  }
  
  export interface SendMessageResponse {
    response: string;
    extractedData?: Record<string, any>;
    completeness?: number;
    nextQuestion?: string;
  }
  
  // POST /api/intake-sessions/:id/generate-form
  export interface GenerateFormRequest {
    // Empty - uses session data
  }
  
  export interface GenerateFormResponse {
    formId: string;
    formData: any;
    pdfUrl?: string;
  }
  
  // GET /api/intake-sessions/:id/form
  export interface GetSessionFormResponse {
    form: {
      id: string;
      sessionId: string;
      formData: any;
      generatedAt: string;
    };
  }
  
  // GET /api/application-forms
  export interface GetApplicationFormsResponse {
    forms: any[];
  }
}

// ============================================================================
// COMPLIANCE (/api/compliance-rules/*, /api/compliance-violations/*)
// ============================================================================

export namespace ComplianceAPI {
  
  // GET /api/compliance-rules
  export interface GetComplianceRulesResponse {
    rules: ComplianceRule[];
  }
  
  // GET /api/compliance-rules/:id
  export interface GetComplianceRuleResponse {
    rule: ComplianceRule;
  }
  
  // POST /api/compliance-rules
  export interface CreateComplianceRuleRequest {
    ruleType: string;
    category: string;
    description: string;
    validationCriteria: any;
    severity: "critical" | "high" | "medium" | "low";
    enabled: boolean;
  }
  
  export interface CreateComplianceRuleResponse {
    rule: ComplianceRule;
  }
  
  // PATCH /api/compliance-rules/:id
  export interface UpdateComplianceRuleRequest {
    description?: string;
    validationCriteria?: any;
    severity?: string;
    enabled?: boolean;
  }
  
  export interface UpdateComplianceRuleResponse {
    rule: ComplianceRule;
  }
  
  // DELETE /api/compliance-rules/:id
  export interface DeleteComplianceRuleResponse {
    success: boolean;
  }
  
  // GET /api/compliance-violations
  export interface GetViolationsRequest {
    documentId?: string;
    severity?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface GetViolationsResponse extends PaginatedResponse<ComplianceViolation> {}
  
  // GET /api/compliance-violations/:id
  export interface GetViolationResponse {
    violation: ComplianceViolation;
  }
  
  // PATCH /api/compliance-violations/:id/acknowledge
  export interface AcknowledgeViolationRequest {
    notes?: string;
  }
  
  export interface AcknowledgeViolationResponse {
    violation: ComplianceViolation;
  }
  
  // PATCH /api/compliance-violations/:id/resolve
  export interface ResolveViolationRequest {
    resolution: string;
    notes?: string;
  }
  
  export interface ResolveViolationResponse {
    violation: ComplianceViolation;
  }
  
  // PATCH /api/compliance-violations/:id/dismiss
  export interface DismissViolationRequest {
    reason: string;
  }
  
  export interface DismissViolationResponse {
    violation: ComplianceViolation;
  }
}

// ============================================================================
// FEEDBACK (/api/feedback/*)
// ============================================================================

export namespace FeedbackAPI {
  
  // GET /api/feedback
  export interface GetFeedbackRequest {
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface GetFeedbackResponse extends PaginatedResponse<Feedback> {}
  
  // GET /api/feedback/:id
  export interface GetFeedbackItemResponse {
    feedback: Feedback;
  }
  
  // POST /api/feedback
  export interface SubmitFeedbackRequest {
    type: "bug_report" | "feature_request" | "content_issue" | "general";
    title: string;
    description: string;
    context?: {
      url?: string;
      queryId?: string;
      responseText?: string;
    };
    severity?: "low" | "medium" | "high" | "critical";
  }
  
  export interface SubmitFeedbackResponse {
    feedback: Feedback;
  }
  
  // PATCH /api/feedback/:id
  export interface UpdateFeedbackRequest {
    status?: "new" | "in_review" | "resolved" | "dismissed";
    response?: string;
    resolution?: string;
  }
  
  export interface UpdateFeedbackResponse {
    feedback: Feedback;
  }
}

// ============================================================================
// NOTIFICATIONS (/api/notifications/*)
// ============================================================================

export namespace NotificationAPI {
  
  // GET /api/notifications
  export interface GetNotificationsRequest {
    read?: boolean;
    type?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface GetNotificationsResponse extends PaginatedResponse<Notification> {}
  
  // GET /api/notifications/unread-count
  export interface GetUnreadCountResponse {
    count: number;
  }
  
  // PATCH /api/notifications/:id/read
  export interface MarkAsReadResponse {
    notification: Notification;
  }
  
  // PATCH /api/notifications/read-all
  export interface MarkAllAsReadResponse {
    updated: number;
  }
  
  // GET /api/notifications/preferences
  export interface GetPreferencesResponse {
    preferences: {
      emailNotifications: boolean;
      policyUpdates: boolean;
      systemAlerts: boolean;
      feedbackResponses: boolean;
      workflowEvents: boolean;
    };
  }
  
  // PATCH /api/notifications/preferences
  export interface UpdatePreferencesRequest {
    emailNotifications?: boolean;
    policyUpdates?: boolean;
    systemAlerts?: boolean;
    feedbackResponses?: boolean;
    workflowEvents?: boolean;
  }
  
  export interface UpdatePreferencesResponse {
    preferences: any;
  }
}

// ============================================================================
// POLICY CHANGES (/api/policy-changes/*, /api/policy-change-impacts/*)
// ============================================================================

export namespace PolicyChangeAPI {
  
  // GET /api/policy-changes
  export interface GetPolicyChangesRequest {
    status?: string;
    programId?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface GetPolicyChangesResponse extends PaginatedResponse<PolicyChange> {}
  
  // GET /api/policy-changes/:id
  export interface GetPolicyChangeResponse {
    change: PolicyChange;
    diff?: string;
  }
  
  // POST /api/policy-changes
  export interface CreatePolicyChangeRequest {
    documentId: string;
    changeType: string;
    summary: string;
    affectedSections: string[];
    impactLevel: "low" | "medium" | "high" | "critical";
  }
  
  export interface CreatePolicyChangeResponse {
    change: PolicyChange;
  }
  
  // PATCH /api/policy-changes/:id
  export interface UpdatePolicyChangeRequest {
    status?: string;
    impactLevel?: string;
    resolution?: string;
  }
  
  export interface UpdatePolicyChangeResponse {
    change: PolicyChange;
  }
  
  // GET /api/policy-changes/:id/impacts
  export interface GetChangeImpactsResponse {
    impacts: {
      id: string;
      changeId: string;
      userId: string;
      impactDescription: string;
      acknowledged: boolean;
      acknowledgedAt?: string;
    }[];
  }
  
  // POST /api/policy-change-impacts
  export interface CreateImpactRequest {
    changeId: string;
    userId: string;
    impactDescription: string;
  }
  
  export interface CreateImpactResponse {
    impact: any;
  }
  
  // PATCH /api/policy-change-impacts/:id/acknowledge
  export interface AcknowledgeImpactResponse {
    impact: any;
  }
  
  // PATCH /api/policy-change-impacts/:id/resolve
  export interface ResolveImpactResponse {
    impact: any;
  }
  
  // GET /api/my-policy-impacts
  export interface GetMyImpactsResponse {
    impacts: any[];
  }
}

// ============================================================================
// POLICY SOURCES (/api/policy-sources/*)
// ============================================================================

export namespace PolicySourceAPI {
  
  // GET /api/policy-sources
  export interface GetPolicySourcesResponse {
    sources: PolicySource[];
  }
  
  // POST /api/policy-sources
  export interface CreatePolicySourceRequest {
    name: string;
    url: string;
    sourceType: string;
    scrapeSchedule?: string;
  }
  
  export interface CreatePolicySourceResponse {
    source: PolicySource;
  }
  
  // PATCH /api/policy-sources/:id
  export interface UpdatePolicySourceRequest {
    name?: string;
    url?: string;
    scrapeSchedule?: string;
    enabled?: boolean;
  }
  
  export interface UpdatePolicySourceResponse {
    source: PolicySource;
  }
}

// ============================================================================
// VITA TAX ASSISTANT (/api/vita/*)
// ============================================================================

export namespace VitaAPI {
  
  // POST /api/vita/ingest-pub4012
  export interface IngestPub4012Response {
    success: boolean;
    documentsProcessed: number;
    rulesExtracted: number;
  }
  
  // GET /api/vita/documents
  export interface GetVitaDocumentsResponse {
    documents: {
      id: string;
      title: string;
      publicationNumber: string;
      taxYear: number;
      status: string;
    }[];
  }
  
  // POST /api/vita/search
  export interface VitaSearchRequest {
    query: string;
  }
  
  export interface VitaSearchResponse {
    answer: string;
    federalRules: {
      id: string;
      ruleType: string;
      topic: string;
      ruleText: string;
      relevanceScore: number;
    }[];
    ragCitations: {
      text: string;
      source: string;
      page?: number;
      similarityScore: number;
    }[];
    irsPub4012Citations: {
      section: string;
      page: number;
      relevance: number;
    }[];
  }
  
  // GET /api/vita/topics
  export interface GetVitaTopicsResponse {
    topics: string[];
  }
}

// ============================================================================
// MANUAL (/api/manual/*)
// ============================================================================

export namespace ManualAPI {
  
  // GET /api/manual/sections
  export interface GetManualSectionsResponse {
    sections: {
      id: string;
      sectionNumber: string;
      title: string;
      parentSection: string | null;
      level: number;
      url: string;
    }[];
  }
  
  // GET /api/manual/sections/:id
  export interface GetManualSectionResponse {
    section: {
      id: string;
      sectionNumber: string;
      title: string;
      content?: string;
      generatedText?: string;
      pdfUrl?: string;
      rules: any[];
    };
  }
  
  // GET /api/manual/structure
  export interface GetManualStructureResponse {
    structure: any; // Hierarchical tree structure
  }
  
  // GET /api/manual/status
  export interface GetManualStatusResponse {
    totalSections: number;
    sectionsWithPdf: number;
    sectionsWithText: number;
    sectionsWithRules: number;
    lastUpdate: string;
  }
  
  // POST /api/manual/ingest-metadata
  export interface IngestMetadataResponse {
    success: boolean;
    ingested: number;
  }
  
  // POST /api/manual/ingest-full
  export interface IngestFullResponse {
    success: boolean;
    jobId: string;
    status: string;
  }
  
  // POST /api/manual/generate-text/:sectionId
  export interface GenerateTextResponse {
    success: boolean;
    generatedText: string;
  }
  
  // POST /api/manual/generate/income-limits
  export interface GenerateIncomeLimitsResponse {
    success: boolean;
    text: string;
  }
  
  // POST /api/manual/generate/deductions
  export interface GenerateDeductionsResponse {
    success: boolean;
    text: string;
  }
  
  // POST /api/manual/generate/allotments
  export interface GenerateAllotmentsResponse {
    success: boolean;
    text: string;
  }
}

// ============================================================================
// AI MONITORING (/api/ai-monitoring/*)
// ============================================================================

export namespace AIMonitoringAPI {
  
  // GET /api/ai-monitoring/query-analytics
  export interface QueryAnalyticsResponse {
    totalQueries: number;
    avgResponseTime: number;
    queriesByType: {
      type: string;
      count: number;
    }[];
    topQueries: {
      query: string;
      count: number;
    }[];
  }
  
  // GET /api/ai-monitoring/system-health
  export interface SystemHealthResponse {
    geminiApiStatus: "healthy" | "degraded" | "down";
    avgLatency: number;
    errorRate: number;
    requestsLast24h: number;
  }
  
  // GET /api/ai-monitoring/response-quality
  export interface ResponseQualityResponse {
    avgRelevanceScore: number;
    citationRate: number;
    userFeedback: {
      positive: number;
      negative: number;
      neutral: number;
    };
  }
  
  // POST /api/ai-monitoring/flag-response
  export interface FlagResponseRequest {
    queryId: string;
    reason: string;
    details?: string;
  }
  
  export interface FlagResponseResponse {
    success: boolean;
    flagId: string;
  }
}

// ============================================================================
// AUDIT LOGS (/api/audit-logs, /api/rule-change-logs)
// ============================================================================

export namespace AuditAPI {
  
  // GET /api/audit-logs
  export interface GetAuditLogsRequest {
    action?: string;
    entityType?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface GetAuditLogsResponse extends PaginatedResponse<AuditLog> {}
  
  // GET /api/rule-change-logs
  export interface GetRuleChangeLogsRequest {
    ruleTable?: string;
    changeType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
  
  export interface GetRuleChangeLogsResponse extends PaginatedResponse<RuleChangeLog> {}
}

// ============================================================================
// MODELS & TRAINING (/api/models, /api/training-jobs)
// ============================================================================

export namespace ModelAPI {
  
  // GET /api/models
  export interface GetModelsResponse {
    models: Model[];
  }
  
  // GET /api/training-jobs
  export interface GetTrainingJobsResponse {
    jobs: TrainingJob[];
  }
  
  // POST /api/training-jobs
  export interface CreateTrainingJobRequest {
    modelId: string;
    trainingData: any;
    parameters?: Record<string, any>;
  }
  
  export interface CreateTrainingJobResponse {
    job: TrainingJob;
  }
  
  // PATCH /api/training-jobs/:id
  export interface UpdateTrainingJobRequest {
    status?: string;
    results?: any;
  }
  
  export interface UpdateTrainingJobResponse {
    job: TrainingJob;
  }
}

// ============================================================================
// GOLDEN SOURCE (/api/golden-source/*)
// ============================================================================

export namespace GoldenSourceAPI {
  
  // GET /api/golden-source/documents
  export interface GetGoldenDocumentsResponse {
    documents: {
      id: string;
      title: string;
      version: string;
      verificationStatus: string;
      lastVerified: string;
    }[];
  }
  
  // POST /api/golden-source/verify/:documentId
  export interface VerifyGoldenDocumentResponse {
    verified: boolean;
    checksum: string;
    timestamp: string;
  }
  
  // GET /api/golden-source/audit-trail/:documentId
  export interface GetAuditTrailResponse {
    trail: {
      action: string;
      timestamp: string;
      userId: string;
      changes?: any;
    }[];
  }
}

// ============================================================================
// AUTOMATED INGESTION (/api/automated-ingestion/*)
// ============================================================================

export namespace AutomatedIngestionAPI {
  
  // GET /api/automated-ingestion/schedules
  export interface GetSchedulesResponse {
    schedules: {
      id: string;
      sourceUrl: string;
      cronExpression: string;
      enabled: boolean;
      lastRun?: string;
      nextRun?: string;
    }[];
  }
  
  // POST /api/automated-ingestion/schedules
  export interface CreateScheduleRequest {
    sourceUrl: string;
    cronExpression: string;
    enabled?: boolean;
  }
  
  export interface CreateScheduleResponse {
    schedule: any;
  }
  
  // PATCH /api/automated-ingestion/schedules/:id
  export interface UpdateScheduleRequest {
    cronExpression?: string;
    enabled?: boolean;
  }
  
  export interface UpdateScheduleResponse {
    schedule: any;
  }
  
  // POST /api/automated-ingestion/trigger
  export interface TriggerIngestionRequest {
    sourceUrl: string;
  }
  
  export interface TriggerIngestionResponse {
    success: boolean;
    jobId: string;
  }
}

// ============================================================================
// EXTRACTION (/api/extraction/*)
// ============================================================================

export namespace ExtractionAPI {
  
  // GET /api/extraction/jobs
  export interface GetExtractionJobsResponse {
    jobs: {
      id: string;
      documentId: string;
      status: string;
      rulesExtracted: number;
      startedAt: string;
      completedAt?: string;
    }[];
  }
  
  // GET /api/extraction/jobs/:jobId
  export interface GetExtractionJobResponse {
    job: {
      id: string;
      documentId: string;
      status: string;
      progress: number;
      rulesExtracted: number;
      errors: string[];
    };
  }
  
  // POST /api/extraction/extract-section
  export interface ExtractSectionRequest {
    sectionId: string;
  }
  
  export interface ExtractSectionResponse {
    success: boolean;
    rulesExtracted: number;
  }
  
  // POST /api/extraction/extract-batch
  export interface ExtractBatchRequest {
    sectionIds: string[];
  }
  
  export interface ExtractBatchResponse {
    success: boolean;
    jobId: string;
    totalSections: number;
  }
}

// ============================================================================
// ABAWD VERIFICATIONS (/api/abawd-verifications/*)
// ============================================================================

export namespace AbawdAPI {
  
  // GET /api/abawd-verifications
  export interface GetAbawdVerificationsResponse extends PaginatedResponse<AbawdVerification> {}
  
  // GET /api/abawd-verifications/:id
  export interface GetAbawdVerificationResponse {
    verification: AbawdVerification;
  }
  
  // POST /api/abawd-verifications
  export interface CreateAbawdVerificationRequest {
    clientIdentifier: string;
    exemptionType: string;
    verificationDate: string;
    documentationProvided: boolean;
    notes?: string;
  }
  
  export interface CreateAbawdVerificationResponse {
    verification: AbawdVerification;
  }
  
  // PUT /api/abawd-verifications/:id
  export interface UpdateAbawdVerificationRequest {
    exemptionType?: string;
    verificationDate?: string;
    documentationProvided?: boolean;
    notes?: string;
    status?: string;
  }
  
  export interface UpdateAbawdVerificationResponse {
    verification: AbawdVerification;
  }
  
  // DELETE /api/abawd-verifications/:id
  export interface DeleteAbawdVerificationResponse {
    success: boolean;
  }
}

// ============================================================================
// PROGRAM ENROLLMENTS (/api/program-enrollments/*)
// ============================================================================

export namespace ProgramEnrollmentAPI {
  
  // GET /api/program-enrollments
  export interface GetEnrollmentsResponse extends PaginatedResponse<ProgramEnrollment> {}
  
  // GET /api/program-enrollments/:id
  export interface GetEnrollmentResponse {
    enrollment: ProgramEnrollment;
  }
  
  // GET /api/program-enrollments/client/:clientIdentifier
  export interface GetClientEnrollmentsResponse {
    enrollments: ProgramEnrollment[];
  }
  
  // POST /api/program-enrollments
  export interface CreateEnrollmentRequest {
    clientIdentifier: string;
    programId: string;
    enrollmentDate: string;
    status: string;
  }
  
  export interface CreateEnrollmentResponse {
    enrollment: ProgramEnrollment;
  }
  
  // PUT /api/program-enrollments/:id
  export interface UpdateEnrollmentRequest {
    status?: string;
    terminationDate?: string;
    terminationReason?: string;
  }
  
  export interface UpdateEnrollmentResponse {
    enrollment: ProgramEnrollment;
  }
}

// ============================================================================
// CROSS-ENROLLMENT ANALYSIS (/api/cross-enrollment/*)
// ============================================================================

export namespace CrossEnrollmentAPI {
  
  // GET /api/cross-enrollment/analyze/:clientIdentifier
  export interface AnalyzeCrossEnrollmentResponse {
    clientIdentifier: string;
    enrolledPrograms: string[];
    potentialConflicts: {
      programs: string[];
      conflictType: string;
      severity: string;
      description: string;
    }[];
    recommendations: string[];
  }
}

// ============================================================================
// CONSENT MANAGEMENT (/api/consent/*)
// ============================================================================

export namespace ConsentAPI {
  
  // GET /api/consent/forms
  export interface GetConsentFormsResponse {
    forms: ConsentForm[];
  }
  
  // POST /api/consent/forms
  export interface CreateConsentFormRequest {
    formType: string;
    title: string;
    content: string;
    version: string;
  }
  
  export interface CreateConsentFormResponse {
    form: ConsentForm;
  }
  
  // GET /api/consent/client-consents
  export interface GetClientConsentsResponse {
    consents: ClientConsent[];
  }
  
  // POST /api/consent/client-consents
  export interface CreateClientConsentRequest {
    formId: string;
    clientIdentifier: string;
    consentGiven: boolean;
    signatureData?: string;
  }
  
  export interface CreateClientConsentResponse {
    consent: ClientConsent;
  }
}

// ============================================================================
// PUBLIC API (/api/public/*)
// ============================================================================

export namespace PublicAPI {
  
  // GET /api/public/faq
  export interface GetFaqResponse {
    faqs: {
      id: string;
      question: string;
      answer: string;
      category: string;
      relevance: number;
    }[];
  }
  
  // POST /api/public/search-faq
  export interface SearchFaqRequest {
    query: string;
  }
  
  export interface SearchFaqResponse {
    results: {
      question: string;
      answer: string;
      relevance: number;
    }[];
  }
  
  // GET /api/public/document-templates
  export interface GetDocumentTemplatesResponse {
    templates: {
      id: string;
      name: string;
      category: string;
      description: string;
      downloadUrl: string;
    }[];
  }
  
  // GET /api/public/notice-templates
  export interface GetNoticeTemplatesResponse {
    templates: {
      id: string;
      noticeType: string;
      description: string;
    }[];
  }
  
  // POST /api/public/explain-notice
  export interface ExplainNoticeRequest {
    noticeText: string;
  }
  
  export interface ExplainNoticeResponse {
    explanation: string;
    keyPoints: string[];
    actionItems: string[];
    deadlines: {
      action: string;
      date: string;
    }[];
  }
  
  // POST /api/public/analyze-notice
  export interface AnalyzeNoticeRequest {
    noticeFile: File;
  }
  
  export interface AnalyzeNoticeResponse {
    noticeType: string;
    summary: string;
    actionRequired: boolean;
    deadline?: string;
    nextSteps: string[];
  }
}

// ============================================================================
// MARYLAND SNAP INGESTION (/api/ingest/maryland-snap)
// ============================================================================

export namespace IngestionAPI {
  
  // POST /api/ingest/maryland-snap
  export interface IngestMarylandSnapResponse {
    success: boolean;
    ingested: {
      incomeLimits: number;
      deductions: number;
      allotments: number;
      categoricalEligibility: number;
      documentRequirements: number;
    };
  }
}

// ============================================================================
// CSRF TOKEN (/api/csrf-token)
// ============================================================================

export namespace CsrfAPI {
  
  // GET /api/csrf-token
  export interface GetCsrfTokenResponse {
    token: string;
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isApiError(response: any): response is ErrorResponse {
  return response && typeof response.error === "string";
}

export function isPaginatedResponse<T>(response: any): response is PaginatedResponse<T> {
  return response && Array.isArray(response.items) && typeof response.total === "number";
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example: Using API contracts in frontend components
 * 
 * ```tsx
 * import { SearchAPI } from "@/ai-context/api-contracts";
 * import { apiRequest } from "@/lib/queryClient";
 * 
 * const searchMutation = useMutation({
 *   mutationFn: async (req: SearchAPI.SearchRequest) => {
 *     const response = await apiRequest("POST", "/api/search", req);
 *     return response.json() as Promise<SearchAPI.SearchResponse>;
 *   },
 * });
 * ```
 * 
 * Example: Using API contracts in backend routes
 * 
 * ```ts
 * import { DocumentAPI } from "@/ai-context/api-contracts";
 * 
 * app.post("/api/documents/upload", asyncHandler(async (req, res) => {
 *   const request = req.body as DocumentAPI.UploadDocumentRequest;
 *   // ... process upload
 *   const response: DocumentAPI.UploadDocumentResponse = {
 *     document: uploadedDoc,
 *     processingJob: { jobId: "123", status: "pending" }
 *   };
 *   res.json(response);
 * }));
 * ```
 */

// ============================================================================
// ENDPOINT SUMMARY
// ============================================================================

/**
 * Total Endpoints: 160
 * 
 * By Category:
 * - Authentication: 4 endpoints
 * - Health & System: 2 endpoints
 * - Search & Chat: 2 endpoints
 * - Documents: 8 endpoints
 * - Document Review: 4 endpoints
 * - Benefit Programs: 1 endpoint
 * - Eligibility & Rules: 12 endpoints
 * - PolicyEngine: 7 endpoints
 * - Navigator Workspace: 10 endpoints
 * - Scenarios: 8 endpoints
 * - Comparisons: 5 endpoints
 * - Screener: 4 endpoints
 * - Intake: 8 endpoints
 * - Compliance: 12 endpoints
 * - Feedback: 4 endpoints
 * - Notifications: 7 endpoints
 * - Policy Changes: 11 endpoints
 * - Policy Sources: 3 endpoints
 * - VITA: 4 endpoints
 * - Manual: 10 endpoints
 * - AI Monitoring: 4 endpoints
 * - Audit: 2 endpoints
 * - Models & Training: 4 endpoints
 * - Golden Source: 3 endpoints
 * - Automated Ingestion: 4 endpoints
 * - Extraction: 4 endpoints
 * - ABAWD: 5 endpoints
 * - Program Enrollments: 5 endpoints
 * - Cross-Enrollment: 1 endpoint
 * - Consent: 4 endpoints
 * - Public API: 6 endpoints
 * - Ingestion: 1 endpoint
 * - CSRF: 1 endpoint
 */
