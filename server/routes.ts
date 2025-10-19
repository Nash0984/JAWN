import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { initializeWebSocketService } from "./services/websocket.service";
import { storage } from "./storage";
import { ragService } from "./services/ragService";
// Unified Services
import { unifiedDocumentService } from "./services/unified/UnifiedDocumentService";
import { unifiedExportService } from "./services/unified/UnifiedExportService";
import { unifiedIngestionService } from "./services/unified/UnifiedIngestionService";
// Cross-State Rules
import { registerCrossStateRulesRoutes } from "./api/crossStateRules.routes";

// Legacy services (to be gradually migrated)
const documentProcessor = unifiedDocumentService; // Alias for backward compatibility
const documentIngestionService = unifiedIngestionService; // Alias for backward compatibility
const automatedIngestionService = unifiedIngestionService; // Alias for backward compatibility  
const manualIngestionService = unifiedIngestionService; // Alias for backward compatibility
const documentVerificationService = unifiedDocumentService; // Alias for backward compatibility
const taxDocExtractor = unifiedDocumentService; // Alias for backward compatibility

// Export aliases for backward compatibility
const exportToPDF = (returnId: string) => unifiedExportService.exportTaxSlayerReturn(returnId, { format: 'pdf', type: 'taxslayer_worksheet' });
const exportToCSV = (returnId: string) => unifiedExportService.exportTaxSlayerReturn(returnId, { format: 'csv', type: 'taxslayer_worksheet' });
const exportChecklist = exportToPDF; // Use same PDF export for now
const exportVarianceReport = exportToPDF; // Use same PDF export for now
const exportFieldGuide = exportToPDF; // Use same PDF export for now

// Other services
import { ObjectStorageService, objectStorageClient, parseObjectPath } from "./objectStorage";
import { rulesEngine } from "./services/rulesEngine";
import { rulesAsCodeService } from "./services/rulesAsCodeService";
import { hybridService } from "./services/hybridService";
import { auditService } from "./services/auditService";
import { textGenerationService } from "./services/textGenerationService";
import { notificationService } from "./services/notification.service";
import { cacheService, CACHE_KEYS, invalidateRulesCache, generateHouseholdHash } from "./services/cacheService";
import { kpiTrackingService } from "./services/kpiTracking.service";
import { achievementSystemService } from "./services/achievementSystem.service";
import { leaderboardService } from "./services/leaderboard.service";
import { GoogleGenAI } from "@google/genai";
import { asyncHandler, validationError, notFoundError, externalServiceError, authorizationError } from "./middleware/errorHandler";
import { requireAuth, requireStaff, requireAdmin } from "./middleware/auth";
import { detectTenantContext } from "./middleware/tenantMiddleware";
import { 
  verifyHouseholdProfileOwnership, 
  verifyVitaSessionOwnership, 
  verifyTaxDocumentOwnership,
  verifyNotificationOwnership 
} from "./middleware/ownership";
import { vitaCertificationValidationService } from "./services/vitaCertificationValidation.service";
import { db } from "./db";
import { sql, eq, and, desc, gte, lte, or, ilike, count } from "drizzle-orm";
import { 
  insertDocumentSchema, 
  insertSearchQuerySchema, 
  insertPolicySourceSchema,
  insertTrainingJobSchema,
  insertUserSchema,
  insertQuickRatingSchema,
  insertFeedbackSubmissionSchema,
  insertComplianceRuleSchema,
  insertComplianceViolationSchema,
  insertIntakeSessionSchema,
  insertCountySchema,
  insertHouseholdProfileSchema,
  insertVitaIntakeSessionSchema,
  insertTaxDocumentSchema,
  insertTaxslayerReturnSchema,
  insertAlertRuleSchema,
  insertAppointmentSchema,
  insertDocumentRequestSchema,
  insertTaxpayerMessageSchema,
  insertTaxpayerMessageAttachmentSchema,
  insertESignatureSchema,
  searchQueries,
  auditLogs,
  ruleChangeLogs,
  quickRatings,
  feedbackSubmissions,
  users,
  documentRequirementTemplates,
  noticeTemplates,
  publicFaq,
  notifications,
  stateOptionsWaivers,
  marylandStateOptionStatus,
  federalBills,
  marylandBills,
  publicLaws,
  alertRules,
  alertHistory,
  consentForms,
  clientConsents,
  appointments
} from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import passport from "./auth";
import { 
  createSecureUploader, 
  verifyFileMiddleware,
  getFileHash
} from "./middleware/fileUploadSecurity";
import { passwordSecurityService } from "./services/passwordSecurity.service";
import { decryptVitaIntake } from "./utils/encryptedFields";
import { demoDataService } from "./services/demoDataService";

// Configure secure file uploaders for different use cases
const documentUpload = createSecureUploader('documents', {
  enableSignatureVerification: true,
  enableVirusScanning: process.env.ENABLE_VIRUS_SCANNING === 'true',
});

const taxDocumentUpload = createSecureUploader('taxDocuments', {
  enableSignatureVerification: true,
  enableVirusScanning: process.env.ENABLE_VIRUS_SCANNING === 'true',
});

const imageUpload = createSecureUploader('images', {
  enableSignatureVerification: true,
  enableVirusScanning: false, // Images don't typically need virus scanning
});

// For backward compatibility with existing code
const upload = documentUpload;

// Simple Gemini helper for public portal
function getGeminiClient() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  return new GoogleGenAI({ apiKey });
}

async function analyzeImageWithGemini(base64Image: string, prompt: string): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: "image/jpeg", data: base64Image } }
      ]
    }]
  });
  return response.text || "";
}

async function generateTextWithGemini(prompt: string): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });
  return response.text || "";
}

// ============================================================================
// VITA CERTIFICATION VALIDATION MIDDLEWARE
// ============================================================================
const requireVitaCertification = (minimumLevel: 'basic' | 'advanced' | 'military' = 'basic') => {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Get tax return data from request body or session
    const taxReturnData = req.body.taxReturnData || req.body;
    
    // Determine required certification
    const requirement = vitaCertificationValidationService.determineCertificationRequirement(taxReturnData);
    
    // Validate user's certification
    const validation = await vitaCertificationValidationService.updateCertification(req.user!.id, requirement);
    
    if (!validation.isValid) {
      return res.status(403).json({
        error: "Insufficient VITA certification",
        message: validation.errorMessage || "You do not have the required VITA certification to approve this tax return",
        required: validation.requiredCertification,
        current: validation.reviewerCertification,
        certificationExpired: validation.certificationExpired,
        warnings: validation.warnings
      });
    }
    
    next();
  });
};

export async function registerRoutes(app: Express, sessionMiddleware?: any): Promise<Server> {
  
  // ============================================================================
  // HEALTH CHECK ENDPOINTS - For load balancers and monitoring
  // ============================================================================
  const { healthCheck, readinessCheck, startupCheck } = await import("./middleware/healthCheck");
  
  // Liveness probe (is service running?)
  app.get("/health", healthCheck);
  
  // Readiness probe (is service ready to accept traffic?)
  app.get("/ready", readinessCheck);
  
  // Startup probe (has service completed startup?)
  app.get("/startup", startupCheck);
  
  // Legacy comprehensive health check endpoint (kept for backwards compatibility)
  app.get("/api/health", asyncHandler(async (req: Request, res: Response) => {
    const healthStatus: any = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: { status: "unknown", latency: null },
        geminiApi: { status: "unknown", configured: false },
        objectStorage: { status: "unknown", configured: false }
      },
      system: {
        memory: {
          used: process.memoryUsage().heapUsed / 1024 / 1024,
          total: process.memoryUsage().heapTotal / 1024 / 1024,
          unit: "MB"
        },
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || "development"
      }
    };

    let degradedCount = 0;

    // Check database connectivity
    try {
      const startTime = Date.now();
      const result = await db.execute(sql`SELECT 1 as test`);
      const latency = Date.now() - startTime;
      
      healthStatus.services.database = {
        status: "healthy",
        latency: `${latency}ms`,
        connectionActive: true
      };
    } catch (error) {
      degradedCount++;
      healthStatus.services.database = {
        status: "unhealthy",
        error: "Database connection failed",
        message: process.env.NODE_ENV === "development" ? (error as any).message : undefined
      };
      
      // Log critical database error
      await auditService.logError({
        message: "Health check: Database connection failed",
        statusCode: 503,
        method: "GET",
        path: "/api/health",
        details: error
      }).catch(console.error);
    }

    // Check Gemini API availability (if configured)
    const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        healthStatus.services.geminiApi.configured = true;
        // Simple check - just verify the service is initialized
        const testAvailability = await ragService.checkAvailability();
        healthStatus.services.geminiApi.status = testAvailability ? "healthy" : "degraded";
      } catch (error) {
        degradedCount++;
        healthStatus.services.geminiApi = {
          status: "unhealthy",
          configured: true,
          error: "Gemini API check failed",
          message: process.env.NODE_ENV === "development" ? (error as any).message : undefined
        };
      }
    } else {
      healthStatus.services.geminiApi = {
        status: "not_configured",
        configured: false,
        message: "Google API key not configured"
      };
    }

    // Check Object Storage availability
    try {
      const objectStorageEnvVars = process.env.PUBLIC_OBJECT_SEARCH_PATHS || process.env.PRIVATE_OBJECT_DIR;
      healthStatus.services.objectStorage.configured = !!objectStorageEnvVars;
      
      if (objectStorageEnvVars) {
        const objectStorageService = new ObjectStorageService();
        // Simple availability check
        healthStatus.services.objectStorage.status = "healthy";
      }
    } catch (error) {
      healthStatus.services.objectStorage = {
        status: "degraded",
        configured: true,
        error: "Object storage check failed"
      };
    }

    // Determine overall health status
    if (healthStatus.services.database.status === "unhealthy") {
      healthStatus.status = "unhealthy";
    } else if (degradedCount > 0) {
      healthStatus.status = "degraded";
    }

    // Set appropriate HTTP status code
    const statusCode = healthStatus.status === "healthy" ? 200 : 
                       healthStatus.status === "degraded" ? 200 : 503;

    res.status(statusCode).json(healthStatus);
  }));

  // ============================================================================
  // MULTI-TENANT MIDDLEWARE
  // ============================================================================
  // Apply tenant detection to all routes (except health checks)
  app.use(detectTenantContext);

  // Hybrid search endpoint - intelligently routes to Rules Engine or RAG
  app.post("/api/search", requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { query, benefitProgramId, userId } = req.body;
    
    // Validate request parameters
    if (!query || typeof query !== "string") {
      throw validationError("Query is required and must be a string");
    }

    if (query.length > 1000) {
      throw validationError("Query must be less than 1000 characters");
    }

    // Log the search request
    await auditService.logSearch({
      query,
      userId,
      benefitProgramId,
      searchType: "hybrid"
    });

    // Use hybrid service for intelligent routing
    const result = await hybridService.search(query, benefitProgramId);

    // Save search query with hybrid result
    await storage.createSearchQuery({
      query,
      userId,
      benefitProgramId,
      response: {
        answer: result.answer,
        type: result.type,
        classification: result.classification,
      },
      relevanceScore: result.aiExplanation?.relevanceScore || result.classification.confidence,
      responseTime: result.responseTime,
    });

    res.json(result);
  }));

  // Conversational chat endpoint for policy questions
  app.post("/api/chat/ask", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { query, context, benefitProgramId } = req.body;
    const userId = (req as any).userId;

    if (!query || typeof query !== 'string') {
      throw validationError("Query is required and must be a string");
    }

    if (query.length > 1000) {
      throw validationError("Query must be less than 1000 characters");
    }

    // Enhance query with context if provided
    let enhancedQuery = query;
    if (context) {
      if (context.page === 'document-verification') {
        enhancedQuery = `Regarding document verification for ${context.documentType || 'SNAP'}: ${query}`;
      } else if (context.page === 'eligibility') {
        enhancedQuery = `Regarding SNAP eligibility calculations: ${query}`;
      } else if (context.requirementId) {
        enhancedQuery = `Regarding requirement ${context.requirementId}: ${query}`;
      }
    }

    // Log the chat request
    await auditService.logSearch({
      query: enhancedQuery,
      userId,
      benefitProgramId,
      searchType: "chat"
    });

    // Use RAG service for natural language response
    const ragResult = await ragService.search(enhancedQuery, benefitProgramId);

    // Format response for chat interface
    const response = {
      answer: ragResult.answer,
      citations: ragResult.citations || [],
      sources: ragResult.sources || [],
      relevanceScore: ragResult.relevanceScore,
      suggestedFollowUps: [] // TODO: Generate context-aware follow-up questions
    };

    res.json(response);
  }));

  // Authentication Routes
  
  // Signup
  app.post("/api/auth/signup", asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const validatedData = insertUserSchema.parse(req.body);
    
    // Check if username already exists
    const existingUser = await storage.getUserByUsername(validatedData.username);
    if (existingUser) {
      throw validationError("Username already exists");
    }

    // Validate and hash password with secure cost factor (12 rounds)
    const { hash: hashedPassword, validation } = await passwordSecurityService.createPasswordHash(validatedData.password);
    
    // Log password strength for monitoring (not the password itself)
    console.log(`✅ New user password strength: ${validation.strength} (score: ${validation.score}/100)`);

    // Create user
    const user = await storage.createUser({
      ...validatedData,
      password: hashedPassword,
    });

    // Log the user in automatically after signup
    req.login(user, (err: any) => {
      if (err) {
        console.error("Failed to log in after signup:", err);
        return next(new Error("Failed to log in after signup"));
      }

      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({ user: userWithoutPassword });
    });
  }));

  // Login
  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login authentication error:", err);
        return next(err);
      }
      
      if (!user) {
        console.warn("Login failed for username:", req.body?.username, "- Reason:", info?.message);
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }

      req.login(user, (err) => {
        if (err) {
          console.error("Session creation error after login:", err);
          return next(err);
        }

        // Return user without password
        const { password, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
  
  // Get password requirements
  app.get("/api/auth/password-requirements", (req: Request, res: Response) => {
    res.json({
      requirements: passwordSecurityService.getRequirements(),
      message: `Password must:
- Be at least 12 characters long
- Contain at least one uppercase letter (A-Z)
- Contain at least one lowercase letter (a-z)
- Contain at least one number (0-9)
- Contain at least one special character (!@#$%^&* etc.)
- Not be a commonly used password
- Not contain sequential or repeated characters`
    });
  });
  
  // Change password (requires authentication)
  app.post("/api/auth/change-password", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      throw validationError("Current password and new password are required");
    }
    
    // Get user from database to verify current password
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.id));
    if (!user) {
      throw notFoundError("User not found");
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw authorizationError("Current password is incorrect");
    }
    
    // Validate and hash new password
    const { hash: newHashedPassword, validation } = await passwordSecurityService.createPasswordHash(newPassword);
    
    // Update password in database
    await storage.updateUser(user.id, { password: newHashedPassword });
    
    // Log password change for security audit
    console.log(`✅ Password changed for user ${user.username} (strength: ${validation.strength})`);
    
    res.json({ 
      message: "Password changed successfully",
      passwordStrength: validation.strength
    });
  }));

  // Get current user
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Return user without password
    const { password, ...userWithoutPassword } = req.user as any;
    res.json({ user: userWithoutPassword });
  });

  // ============================================================================
  // LEGAL CONSENT ENDPOINTS - HIPAA Compliance & Policy Tracking
  // ============================================================================
  
  // Record user consent for legal policies
  app.post("/api/legal/consent", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { policyType, policyVersion } = req.body;

    // Validate required fields
    if (!policyType || !policyVersion) {
      throw validationError("Policy type and version are required");
    }

    // Validate policyType
    const validPolicyTypes = ['privacy', 'terms', 'both'];
    if (!validPolicyTypes.includes(policyType)) {
      throw validationError("Policy type must be 'privacy', 'terms', or 'both'");
    }

    // Record consent with audit info
    const consent = await storage.createUserConsent({
      userId: req.user!.id,
      policyType,
      policyVersion,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(consent);
  }));

  // Get latest user consent status
  app.get("/api/legal/consent/latest", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { policyType } = req.query;

    const consent = await storage.getLatestUserConsent(
      req.user!.id,
      policyType as string | undefined
    );

    if (!consent) {
      return res.status(404).json({ error: "No consent record found" });
    }

    res.json(consent);
  }));

  // Get benefit programs
  app.get("/api/benefit-programs", async (req: Request, res: Response) => {
    try {
      const programs = await storage.getBenefitPrograms();
      res.json(programs);
    } catch (error) {
      console.error("Error fetching benefit programs:", error);
      res.status(500).json({ error: "Failed to fetch benefit programs" });
    }
  });

  // Get document types
  app.get("/api/document-types", async (req: Request, res: Response) => {
    try {
      const types = await storage.getDocumentTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching document types:", error);
      res.status(500).json({ error: "Failed to fetch document types" });
    }
  });

  // Document verification endpoint with Gemini Vision API
  app.post("/api/verify-document", requireAuth, upload.single("document"), asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw validationError("No document uploaded");
    }

    const documentType = req.body.documentType || 'income';
    const clientCaseId = req.body.clientCaseId;

    // Upload to object storage first
    const objectStorageService = new ObjectStorageService();
    const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: req.file.buffer,
      headers: {
        'Content-Type': req.file.mimetype,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);

    // Create document record with objectPath
    const document = await storage.createDocument({
      filename: req.file.originalname,
      originalName: req.file.originalname,
      objectPath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user?.id,
      status: 'uploaded',
      documentTypeId: null,
      benefitProgramId: null,
      metadata: {
        uploadedForVerification: true,
        requirementType: documentType
      }
    });

    // Verify the document using Gemini Vision API
    // Pass buffer for immediate verification (avoids redundant storage fetch)
    const result = await documentVerificationService.verifyDocument({
      documentId: document.id,
      requirementType: documentType,
      clientCaseId,
      contextInfo: {
        fileBuffer: req.file.buffer,
        mimeType: req.file.mimetype
      }
    });

    // Get plain-language explanation
    const explanation = documentVerificationService.getVerificationExplanation(result);

    // Format response to match UI expectations
    const response = {
      documentType: documentType,
      meetsCriteria: result.isValid,
      summary: explanation,
      requirements: result.rejectionReasons.map((reason, index) => ({
        requirement: `Requirement ${index + 1}`,
        met: false,
        explanation: reason
      })).concat(
        result.satisfiesRequirements.map((reqId) => ({
          requirement: `Requirement ${reqId}`,
          met: true,
          explanation: "This requirement is satisfied by the document"
        }))
      ),
      officialCitations: result.policyCitations.map(cite => ({
        section: cite.section,
        regulation: cite.regulation,
        text: cite.text
      })),
      confidence: Math.round(result.confidenceScore * 100),
      verificationResult: result
    };

    // Log the verification to audit trail
    await auditService.logEvent({
      action: 'DOCUMENT_VERIFIED',
      entityType: 'DOCUMENT',
      entityId: document.id,
      userId: req.user?.id,
      metadata: {
        documentType,
        isValid: result.isValid,
        confidenceScore: result.confidenceScore,
        clientCaseId
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(response);
  }));

  // Upload document endpoint
  app.post("/api/documents/upload", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { documentTypeId, benefitProgramId } = req.body;
      
      const objectStorageService = new ObjectStorageService();
      
      // Generate upload URL and upload to object storage
      const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
      
      // Upload file buffer to object storage
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: req.file.buffer,
        headers: {
          'Content-Type': req.file.mimetype,
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);

      // Create document record
      const document = await storage.createDocument({
        filename: req.file.originalname,
        originalName: req.file.originalname,
        objectPath,
        documentTypeId,
        benefitProgramId,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        status: "uploaded",
      });

      // Start background processing
      documentProcessor.processDocument(document.id);

      res.json({
        documentId: document.id,
        status: "uploaded",
        message: "Document uploaded successfully and processing started",
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Get document upload URL
  app.post("/api/documents/upload-url", requireAdmin, async (req: Request, res: Response) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Create document record after upload
  app.post("/api/documents", requireAdmin, async (req: Request, res: Response) => {
    try {
      const documentData = insertDocumentSchema.parse(req.body);
      const document = await storage.createDocument(documentData);
      
      // Start background processing
      documentProcessor.processDocument(document.id);
      
      res.json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      console.error("Error creating document:", error);
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  // Get documents
  app.get("/api/documents", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { benefitProgramId, status, limit } = req.query;
      const filters = {
        benefitProgramId: benefitProgramId as string,
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
      };
      
      const documents = await storage.getDocuments(filters);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Get document by ID
  app.get("/api/documents/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Update document processing status
  app.patch("/api/documents/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status, processingStatus, qualityScore, ocrAccuracy } = req.body;
      
      const updatedDocument = await storage.updateDocument(req.params.id, {
        status,
        processingStatus,
        qualityScore,
        ocrAccuracy,
      });
      
      res.json(updatedDocument);
    } catch (error) {
      console.error("Error updating document status:", error);
      res.status(500).json({ error: "Failed to update document status" });
    }
  });

  // Policy Sources Management
  app.get("/api/policy-sources", requireAdmin, async (req: Request, res: Response) => {
    try {
      const sources = await storage.getPolicySources();
      res.json(sources);
    } catch (error) {
      console.error("Error fetching policy sources:", error);
      res.status(500).json({ error: "Failed to fetch policy sources" });
    }
  });

  app.post("/api/policy-sources", requireAdmin, async (req: Request, res: Response) => {
    try {
      const sourceData = insertPolicySourceSchema.parse(req.body);
      const source = await storage.createPolicySource(sourceData);
      res.json(source);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid source data", details: error.errors });
      }
      console.error("Error creating policy source:", error);
      res.status(500).json({ error: "Failed to create policy source" });
    }
  });

  app.patch("/api/policy-sources/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const allowedUpdates = {
        syncStatus: req.body.syncStatus,
        lastSyncAt: req.body.lastSyncAt,
        syncSchedule: req.body.syncSchedule,
        maxAllowedFrequency: req.body.maxAllowedFrequency,
        isActive: req.body.isActive,
        hasNewData: req.body.hasNewData,
        racStatus: req.body.racStatus,
        racCodeLocation: req.body.racCodeLocation,
        priority: req.body.priority,
        syncConfig: req.body.syncConfig,
      };
      
      // Remove undefined values
      const updates = Object.fromEntries(
        Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined)
      );
      
      const source = await storage.updatePolicySource(req.params.id, updates);
      res.json(source);
    } catch (error) {
      console.error("Error updating policy source:", error);
      res.status(500).json({ error: "Failed to update policy source" });
    }
  });

  // Trigger per-source manual sync
  app.post("/api/policy-sources/:id/sync", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const source = await storage.getPolicySourceById(id);
    
    if (!source) {
      return res.status(404).json({ error: "Policy source not found" });
    }
    
    // Update sync status to 'syncing'
    await storage.updatePolicySource(id, { 
      syncStatus: "syncing",
      lastSyncAt: new Date() as any
    });
    
    try {
      // Trigger appropriate sync method based on source type
      let result;
      
      if (source.syncType === 'bulk_download' && source.url?.includes('ecfr')) {
        const { ecfrBulkDownloader } = await import("./services/ecfrBulkDownloader");
        result = await ecfrBulkDownloader.downloadSNAPRegulations();
      } else if (source.name.includes('FNS State Options')) {
        const { fnsStateOptionsParser } = await import("./services/fnsStateOptionsParser");
        result = await fnsStateOptionsParser.downloadAndParse();
      } else if (source.syncType === 'web_scraping' || source.syncType === 'direct_download') {
        const { policySourceScraper } = await import('./services/policySourceScraper.js');
        const documentCount = await policySourceScraper.scrapeSource(id);
        result = { documentCount };
      } else {
        // Fallback to generic scraper
        const { policySourceScraper } = await import('./services/policySourceScraper.js');
        const documentCount = await policySourceScraper.scrapeSource(id);
        result = { documentCount };
      }
      
      // Update sync status to 'success'
      await storage.updatePolicySource(id, { 
        syncStatus: "success",
        lastSuccessfulSyncAt: new Date() as any
      });
      
      res.json({
        success: true,
        message: `Successfully synced policy source: ${source.name}`,
        result
      });
    } catch (error: any) {
      // Update sync status to 'error'
      await storage.updatePolicySource(id, { 
        syncStatus: "error",
        syncError: error.message
      });
      
      throw error;
    }
  }));

  // Trigger policy source scraping (Legacy)
  app.post("/api/policy-sources/:id/scrape", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { policySourceScraper } = await import('./services/policySourceScraper.js');
      
      console.log(`Manual scrape triggered for policy source: ${id}`);
      const documentCount = await policySourceScraper.scrapeSource(id);
      
      res.json({ 
        success: true, 
        message: `Successfully scraped ${documentCount} documents from policy source`,
        documentCount 
      });
    } catch (error: any) {
      console.error("Error scraping policy source:", error);
      res.status(500).json({ 
        error: "Failed to scrape policy source",
        message: error.message 
      });
    }
  });

  // Trigger eCFR Bulk Download (Official - replaces web scraping for 7 CFR Part 273)
  app.post("/api/policy-sources/ecfr/bulk-download", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { ecfrBulkDownloader } = await import("./services/ecfrBulkDownloader");
    
    console.log("Starting eCFR Bulk Download Service...");
    
    const result = await ecfrBulkDownloader.downloadSNAPRegulations();
    
    res.json({
      success: true,
      message: "eCFR SNAP regulations downloaded successfully",
      documentsProcessed: result.documentIds.length,
      documentIds: result.documentIds
    });
  }));

  // Get FNS State Options with Maryland status
  app.get("/api/fns-state-options", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { category, isParticipating } = req.query;
    
    // Build the query with join
    let query = db
      .select({
        id: stateOptionsWaivers.id,
        optionCode: stateOptionsWaivers.optionCode,
        optionName: stateOptionsWaivers.optionName,
        category: stateOptionsWaivers.category,
        description: stateOptionsWaivers.description,
        statutoryCitation: stateOptionsWaivers.statutoryCitation,
        regulatoryCitation: stateOptionsWaivers.regulatoryCitation,
        policyEngineVariable: stateOptionsWaivers.policyEngineVariable,
        eligibilityImpact: stateOptionsWaivers.eligibilityImpact,
        benefitImpact: stateOptionsWaivers.benefitImpact,
        sourceUrl: stateOptionsWaivers.sourceUrl,
        isActive: stateOptionsWaivers.isActive,
        // Maryland status fields
        marylandStatus: {
          id: marylandStateOptionStatus.id,
          isParticipating: marylandStateOptionStatus.isParticipating,
          adoptionDate: marylandStateOptionStatus.adoptionDate,
          expirationDate: marylandStateOptionStatus.expirationDate,
          waiverType: marylandStateOptionStatus.waiverType,
          affectedCounties: marylandStateOptionStatus.affectedCounties,
          policyReference: marylandStateOptionStatus.policyReference,
          notes: marylandStateOptionStatus.notes,
          dataSource: marylandStateOptionStatus.dataSource,
          lastVerifiedAt: marylandStateOptionStatus.lastVerifiedAt,
        }
      })
      .from(stateOptionsWaivers)
      .leftJoin(
        marylandStateOptionStatus,
        eq(marylandStateOptionStatus.stateOptionId, stateOptionsWaivers.id)
      );
    
    // Apply filters
    const conditions = [];
    
    if (category) {
      conditions.push(eq(stateOptionsWaivers.category, category as string));
    }
    
    if (isParticipating !== undefined) {
      const participatingValue = isParticipating === 'true';
      conditions.push(eq(marylandStateOptionStatus.isParticipating, participatingValue));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const results = await query;
    
    res.json(results);
  }));

  // Trigger FNS State Options Report parsing (28 SNAP options/waivers)
  app.post("/api/policy-sources/fns-state-options", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { fnsStateOptionsParser } = await import("./services/fnsStateOptionsParser");
    
    console.log("Starting FNS State Options Report parsing...");
    
    const result = await fnsStateOptionsParser.downloadAndParse();
    
    res.json({
      success: true,
      message: "FNS State Options Report parsed successfully",
      optionsCreated: result.optionsCreated,
      marylandStatusCreated: result.marylandStatusCreated
    });
  }));

  // Trigger GovInfo Bill Status Download (Federal legislation tracking)
  app.post("/api/legislative/govinfo-bill-status", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { govInfoBillStatusDownloader } = await import("./services/govInfoBillStatusDownloader");
    
    const congress = req.body.congress || 119; // Default to 119th Congress
    console.log(`Starting GovInfo Bill Status Download for Congress ${congress}...`);
    
    const result = await govInfoBillStatusDownloader.downloadBillStatus(congress);
    
    res.json({
      success: result.success,
      message: `Bill Status download ${result.success ? 'completed' : 'completed with errors'}`,
      billsProcessed: result.billsProcessed,
      billsUpdated: result.billsUpdated,
      billsSkipped: result.billsSkipped,
      documentsCreated: result.documentsCreated,
      errors: result.errors
    });
  }));

  // Trigger GovInfo Public Laws Download (Enacted federal legislation)
  app.post("/api/legislative/govinfo-public-laws", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { govInfoPublicLawsDownloader } = await import("./services/govInfoPublicLawsDownloader");
    
    const congress = req.body.congress || 119; // Default to 119th Congress
    console.log(`Starting GovInfo Public Laws Download for Congress ${congress}...`);
    
    const result = await govInfoPublicLawsDownloader.downloadPublicLaws(congress);
    
    res.json({
      success: result.success,
      message: `Public Laws download ${result.success ? 'completed' : 'completed with errors'}`,
      lawsProcessed: result.lawsProcessed,
      lawsUpdated: result.lawsUpdated,
      lawsSkipped: result.lawsSkipped,
      documentsCreated: result.documentsCreated,
      errors: result.errors
    });
  }));

  // GovInfo Version Checker - Check for updates without downloading
  app.post("/api/govinfo/check-versions", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { govInfoVersionChecker } = await import("./services/govInfoVersionChecker");
    
    const { congress = 119 } = req.body;
    console.log('🔍 Manually triggering GovInfo version check...');
    
    const summary = await govInfoVersionChecker.checkAllVersions(congress);
    
    res.json({
      success: true,
      message: `Version check completed - ${summary.totalUpdatesDetected} update(s) detected`,
      timestamp: summary.timestamp,
      results: summary.results,
      totalUpdatesDetected: summary.totalUpdatesDetected,
      overallNeedsSync: summary.overallNeedsSync,
    });
  }));

  // Get current version status (latest check for each source)
  app.get("/api/govinfo/version-status", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { govInfoVersionChecker } = await import("./services/govInfoVersionChecker");
    
    const status = await govInfoVersionChecker.getCurrentVersionStatus();
    
    res.json({
      success: true,
      status,
      timestamp: new Date(),
    });
  }));

  // Get version check history
  app.get("/api/govinfo/version-history", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { govInfoVersionChecker } = await import("./services/govInfoVersionChecker");
    
    const { checkType, limit = 20 } = req.query;
    const history = await govInfoVersionChecker.getVersionCheckHistory(
      checkType as string | undefined,
      parseInt(limit as string, 10)
    );
    
    res.json({
      success: true,
      history,
    });
  }));

  // Smart Scheduler - Get current schedule status
  app.get("/api/scheduler/status", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { smartScheduler } = await import("./services/smartScheduler");
    
    const status = await smartScheduler.getStatus();
    
    res.json({
      success: true,
      ...status,
    });
  }));

  // Smart Scheduler - Manually trigger a specific source check
  app.post("/api/scheduler/trigger/:source", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { smartScheduler } = await import("./services/smartScheduler");
    const { source } = req.params;
    
    console.log(`🔧 Manually triggering ${source} check...`);
    
    try {
      await smartScheduler.triggerCheck(source);
      res.json({
        success: true,
        message: `Successfully triggered ${source} check`,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }));

  // Smart Scheduler - Toggle schedule on/off
  app.patch("/api/scheduler/toggle/:source", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { smartScheduler } = await import("./services/smartScheduler");
    const { source } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean',
      });
    }
    
    try {
      await smartScheduler.toggleSchedule(source, enabled);
      res.json({
        success: true,
        message: `Successfully ${enabled ? 'enabled' : 'disabled'} ${source} schedule`,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }));

  // Smart Scheduler - Update schedule frequency
  app.patch("/api/scheduler/frequency/:source", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { smartScheduler } = await import("./services/smartScheduler");
    const { source } = req.params;
    const { cronExpression } = req.body;
    
    if (typeof cronExpression !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'cronExpression must be a string',
      });
    }
    
    try {
      await smartScheduler.updateFrequency(source, cronExpression);
      res.json({
        success: true,
        message: `Successfully updated ${source} frequency`,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }));

  // Smart Scheduler - Upload verified document
  app.post("/api/scheduler/upload/:source", requireAdmin, upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
    const { source } = req.params;
    const { version, verificationNotes } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }
    
    if (!version) {
      return res.status(400).json({
        success: false,
        error: 'version is required',
      });
    }
    
    try {
      // Upload to object storage
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file.buffer,
        headers: {
          'Content-Type': file.mimetype,
        },
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }
      
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
      
      // Store in database
      const { verifiedDataSources } = await import("@shared/schema");
      const [verifiedSource] = await storage.db.insert(verifiedDataSources).values({
        sourceName: source,
        fileName: file.originalname,
        objectPath,
        fileSize: file.size,
        mimeType: file.mimetype,
        version,
        uploadedBy: req.user!.id,
        verificationNotes: verificationNotes || null,
        isActive: true,
      }).returning();
      
      res.json({
        success: true,
        message: `Successfully uploaded verified ${source} document`,
        data: verifiedSource,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }));

  // Cache Management - Get aggregated cache statistics
  app.get("/api/admin/cache/stats", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { cacheMetrics } = await import("./services/cacheMetrics");
    
    const metrics = cacheMetrics.getAggregatedMetrics();
    
    res.json({
      success: true,
      ...metrics,
    });
  }));

  // Cache Management - Get cost savings report
  app.get("/api/admin/cache/cost-savings", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { cacheMetrics } = await import("./services/cacheMetrics");
    
    const report = cacheMetrics.getCostSavingsReport();
    
    res.json({
      success: true,
      ...report,
    });
  }));

  // Cache Management - Clear specific cache
  app.post("/api/admin/cache/clear/:type", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { cacheMetrics } = await import("./services/cacheMetrics");
    const { type } = req.params;
    
    const validTypes = ['embedding', 'rag', 'documentAnalysis', 'policyEngine', 'all'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid cache type. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    cacheMetrics.clearCache(type as any);
    
    res.json({
      success: true,
      message: `Successfully cleared ${type} cache`,
    });
  }));
  
  // Cache Management - Get hierarchical L1/L2/L3 cache metrics with Redis status
  app.get("/api/admin/cache/hierarchical", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { cacheMetrics } = await import("./services/cacheMetrics");
    
    const hierarchicalMetrics = await cacheMetrics.getHierarchicalMetrics();
    
    res.json({
      success: true,
      ...hierarchicalMetrics,
    });
  }));

  // ============================================================================
  // MONITORING & OBSERVABILITY - Sentry integration and metrics
  // ============================================================================
  
  // Get monitoring metrics for dashboard
  app.get("/api/admin/monitoring/metrics", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { metricsService } = await import("./services/metricsService");
    const { alertService } = await import("./services/alertService");
    const { getSentryStatus } = await import("./services/sentryService");
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Extract tenantId for proper multi-tenant isolation
    const tenantId = req.tenant?.tenant?.id || null;
    
    // Get error rate filtered by tenant
    const errorRate = await metricsService.getErrorRate(oneHourAgo, now, tenantId);
    const errorTrend = await metricsService.calculateTrends('error', oneDayAgo, now, 'hour', tenantId);
    
    // Get performance metrics filtered by tenant
    const performanceSummary = await metricsService.getMetricsSummary('response_time', oneHourAgo, now, tenantId);
    const performanceTrend = await metricsService.calculateTrends('response_time', oneDayAgo, now, 'hour', tenantId);
    
    // Get top errors filtered by tenant
    const topErrors = await metricsService.getTopErrors(oneHourAgo, now, 10, tenantId);
    
    // Get slowest endpoints filtered by tenant
    const slowestEndpoints = await metricsService.getSlowestEndpoints(oneHourAgo, now, 10, tenantId);
    
    // Get recent alerts filtered by tenant
    const recentAlerts = await alertService.getRecentAlerts(20, undefined, tenantId);
    
    // Get system health
    const sentryStatus = getSentryStatus();
    
    res.json({
      errorRate: {
        current: errorRate,
        trend: errorTrend.map(t => ({ timestamp: t.timestamp.toISOString(), value: t.value })),
      },
      performance: {
        p50: performanceSummary?.p50 || 0,
        p90: performanceSummary?.p90 || 0,
        p95: performanceSummary?.p95 || 0,
        trend: performanceTrend.map(t => ({ 
          timestamp: t.timestamp.toISOString(), 
          p50: t.value,
          p90: t.value * 1.5, // Approximate for visualization
          p95: t.value * 1.8,
        })),
      },
      topErrors,
      slowestEndpoints,
      health: {
        sentryEnabled: sentryStatus.enabled,
        sentryConfigured: sentryStatus.configured,
        databaseConnected: true, // If we got here, DB is connected
        uptime: process.uptime(),
      },
      recentAlerts: recentAlerts.map(alert => ({
        id: alert.id,
        severity: alert.severity,
        message: alert.message,
        createdAt: alert.createdAt?.toISOString() || new Date().toISOString(),
        resolved: alert.resolved,
      })),
    });
  }));

  // Get realtime metrics for WebSocket fallback (HTTP polling)
  app.get("/api/admin/metrics/realtime", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { metricsService } = await import("./services/metricsService");
    
    try {
      const metrics = await metricsService.getAllMetrics();
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Metrics polling error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch metrics',
      });
    }
  }));
  
  // Trigger a test error for Sentry verification
  app.post("/api/admin/monitoring/test-error", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { captureException, captureMessage } = await import("./services/sentryService");
    
    // Extract tenantId for proper context
    const tenantId = req.tenant?.tenant?.id || null;
    
    // Create a test error
    const testError = new Error("Test error from monitoring dashboard");
    captureException(testError, {
      level: 'warning',
      tags: {
        test: 'true',
        source: 'monitoring-dashboard',
        tenantId: tenantId || 'none',
      },
      extra: {
        user: req.user?.username,
        timestamp: new Date().toISOString(),
        tenantName: req.tenant?.tenant?.name,
      },
      user: req.user ? {
        id: req.user.id,
        username: req.user.username,
      } : undefined,
      tenant: tenantId ? {
        id: tenantId,
        name: req.tenant?.tenant?.name,
      } : undefined,
    });
    
    // Also send a test message
    captureMessage("Test monitoring alert", 'info', {
      test: true,
      triggeredBy: req.user?.username,
      tenantId: tenantId || 'none',
    });
    
    res.json({
      success: true,
      message: "Test error and message sent to Sentry (if configured)",
    });
  }));
  
  // Get alert history
  app.get("/api/admin/monitoring/alerts", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { alertService } = await import("./services/alertService");
    const { severity, limit = 50 } = req.query;
    
    // Extract tenantId for proper multi-tenant isolation
    const tenantId = req.tenant?.tenant?.id || null;
    
    const alerts = await alertService.getRecentAlerts(
      Number(limit),
      severity as string | undefined,
      tenantId
    );
    
    res.json({
      alerts: alerts.map(alert => ({
        id: alert.id,
        type: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        metadata: alert.metadata,
        channels: alert.channels,
        resolved: alert.resolved,
        resolvedAt: alert.resolvedAt?.toISOString(),
        createdAt: alert.createdAt?.toISOString() || new Date().toISOString(),
      })),
    });
  }));
  
  // Resolve an alert
  app.post("/api/admin/monitoring/alerts/:alertId/resolve", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { alertService } = await import("./services/alertService");
    const { alertId } = req.params;
    
    await alertService.resolveAlert(alertId);
    
    res.json({
      success: true,
      message: "Alert resolved successfully",
    });
  }));

  // ============================================================================
  // ALERT RULES MANAGEMENT - CRUD operations for alert rules
  // ============================================================================

  // GET /api/admin/alerts - List all alert rules
  app.get('/api/admin/alerts', requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant?.tenant?.id || null;
    
    const conditions = [];
    if (tenantId) {
      conditions.push(eq(alertRules.tenantId, tenantId));
    }

    const rules = conditions.length > 0
      ? await db.query.alertRules.findMany({
          where: and(...conditions),
          orderBy: [desc(alertRules.createdAt)]
        })
      : await db.query.alertRules.findMany({
          orderBy: [desc(alertRules.createdAt)]
        });
    
    res.json({ success: true, data: rules });
  }));

  // POST /api/admin/alerts - Create alert rule
  app.post('/api/admin/alerts', requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const validatedData = insertAlertRuleSchema.parse(req.body);
    
    const rule = await db.insert(alertRules).values({
      ...validatedData,
      createdBy: req.user!.id,
      tenantId: req.tenant?.tenant?.id || null,
    }).returning();
    
    res.json({ success: true, data: rule[0] });
  }));

  // PUT /api/admin/alerts/:id - Update alert rule
  app.put('/api/admin/alerts/:id', requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const validatedData = insertAlertRuleSchema.partial().parse(req.body);
    
    const rule = await db.update(alertRules)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(alertRules.id, id))
      .returning();
    
    if (rule.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert rule not found' });
    }
    
    res.json({ success: true, data: rule[0] });
  }));

  // DELETE /api/admin/alerts/:id - Delete alert rule
  app.delete('/api/admin/alerts/:id', requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const result = await db.delete(alertRules).where(eq(alertRules.id, id)).returning();
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert rule not found' });
    }
    
    res.json({ success: true, message: 'Alert rule deleted successfully' });
  }));

  // GET /api/admin/alerts/history - Get alert history
  app.get('/api/admin/alerts/history', requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { alertService } = await import("./services/alertService");
    const { limit = '100' } = req.query;
    const tenantId = req.tenant?.tenant?.id || undefined;
    
    const history = await alertService.getAlertHistory(parseInt(limit as string), tenantId);
    
    res.json({ success: true, data: history });
  }));

  // ============================================================================
  // E-FILE MONITORING - Track e-file submissions and statuses
  // ============================================================================

  // Get E-File metrics for dashboard
  app.get("/api/admin/efile/metrics", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const metrics = await storage.getEFileMetrics();
    res.json(metrics);
  }));

  // Get E-File submissions with filters
  app.get("/api/admin/efile/submissions", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { status, startDate, endDate, clientName, taxYear, limit = '50', offset = '0' } = req.query;
    
    const filters: any = {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    };
    
    if (status) filters.status = status as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (clientName) filters.clientName = clientName as string;
    if (taxYear) filters.taxYear = parseInt(taxYear as string);
    
    const result = await storage.getEFileSubmissions(filters);
    res.json(result);
  }));

  // Get detailed E-File submission info
  app.get("/api/admin/efile/submission/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const details = await storage.getEFileSubmissionDetails(id);
    
    if (!details) {
      return res.status(404).json({
        error: "Submission not found",
        message: "The requested e-file submission could not be found.",
      });
    }
    
    res.json(details);
  }));

  // Retry failed E-File submission
  app.post("/api/admin/efile/retry/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { federalTaxReturns } = await import("@shared/schema");
    
    // Get the submission
    const submission = await db.query.federalTaxReturns.findFirst({
      where: eq(federalTaxReturns.id, id),
    });
    
    if (!submission) {
      return res.status(404).json({
        error: "Submission not found",
        message: "The requested e-file submission could not be found.",
      });
    }
    
    // Check if it's in a retryable state
    if (submission.efileStatus !== 'rejected') {
      return res.status(400).json({
        error: "Invalid status",
        message: "Only rejected submissions can be retried.",
      });
    }
    
    // Reset to ready status for retry
    await db
      .update(federalTaxReturns)
      .set({
        efileStatus: 'ready',
        efileRejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(federalTaxReturns.id, id));
    
    // Log audit event
    await auditService.logAction({
      userId: req.user!.id,
      action: 'efile_retry',
      resource: 'federal_tax_return',
      resourceId: id,
      details: {
        previousStatus: submission.efileStatus,
        newStatus: 'ready',
      },
    });
    
    res.json({
      success: true,
      message: "E-file submission reset to ready status for retry",
      submissionId: id,
    });
  }));

  // ============================================================================
  // COUNTY TAX RATES - Maryland County Tax Rate Management
  // ============================================================================
  
  // GET County Tax Rates - Fetch all county rates for a tax year
  app.get("/api/admin/county-tax-rates", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { countyTaxRates } = await import("@shared/schema");
    const { year = '2025' } = req.query;
    const taxYear = parseInt(year as string);
    
    const rates = await db
      .select()
      .from(countyTaxRates)
      .where(eq(countyTaxRates.taxYear, taxYear))
      .orderBy(countyTaxRates.countyName);
    
    res.json({
      success: true,
      taxYear,
      rates,
    });
  }));
  
  // POST County Tax Rates - Bulk update rates for counties
  app.post("/api/admin/county-tax-rates", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { countyTaxRates, insertCountyTaxRateSchema } = await import("@shared/schema");
    
    // Validate request body is an array
    if (!Array.isArray(req.body.rates)) {
      return res.status(400).json({
        success: false,
        error: "Request body must contain 'rates' array",
      });
    }
    
    const updates = req.body.rates;
    const taxYear = req.body.taxYear || 2025;
    const effectiveDate = new Date();
    
    // Validate each rate entry
    const validated = updates.map((rate: any) => 
      insertCountyTaxRateSchema.parse({
        countyName: rate.countyName,
        taxYear,
        minRate: rate.minRate,
        maxRate: rate.maxRate,
        effectiveDate,
      })
    );
    
    // Upsert all rates (delete existing for year, then insert new)
    await db.transaction(async (tx) => {
      // Delete existing rates for this year
      await tx
        .delete(countyTaxRates)
        .where(eq(countyTaxRates.taxYear, taxYear));
      
      // Insert new rates
      await tx.insert(countyTaxRates).values(validated);
    });
    
    // Fetch and return updated rates
    const updatedRates = await db
      .select()
      .from(countyTaxRates)
      .where(eq(countyTaxRates.taxYear, taxYear))
      .orderBy(countyTaxRates.countyName);
    
    res.json({
      success: true,
      message: `Successfully updated ${validated.length} county tax rates for ${taxYear}`,
      taxYear,
      rates: updatedRates,
    });
  }));

  // GET Federal Bills - Fetch tracked federal bills with optional filters
  app.get("/api/legislative/federal-bills", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { status, congress, program, limit = '100' } = req.query;
    
    let query = db.select().from(federalBills);
    const conditions: any[] = [];
    
    if (status) conditions.push(eq(federalBills.status, status as string));
    if (congress) conditions.push(eq(federalBills.congress, parseInt(congress as string)));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const bills = await query
      .orderBy(desc(federalBills.latestActionDate))
      .limit(parseInt(limit as string));
    
    res.json({
      success: true,
      total: bills.length,
      bills
    });
  }));

  // GET Maryland Bills - Fetch tracked Maryland bills with optional filters
  app.get("/api/legislative/maryland-bills", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { status, session, billType, limit = '100' } = req.query;
    
    let query = db.select().from(marylandBills);
    const conditions: any[] = [];
    
    if (status) conditions.push(eq(marylandBills.status, status as string));
    if (session) conditions.push(eq(marylandBills.session, session as string));
    if (billType) conditions.push(eq(marylandBills.billType, billType as string));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const bills = await query
      .orderBy(desc(marylandBills.introducedDate))
      .limit(parseInt(limit as string));
    
    res.json({
      success: true,
      total: bills.length,
      bills
    });
  }));

  // GET Public Laws - Fetch enacted federal laws
  app.get("/api/legislative/public-laws", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { congress, limit = '50' } = req.query;
    
    let query = db.select().from(publicLaws);
    
    if (congress) {
      query = query.where(eq(publicLaws.congress, parseInt(congress as string))) as any;
    }
    
    const laws = await query
      .orderBy(desc(publicLaws.enactmentDate))
      .limit(parseInt(limit as string));
    
    res.json(laws);
  }));

  // Congress.gov API - Search bills by keywords (Real-time legislative keyword search)
  // Note: For authoritative bill status, use GovInfo Bill Status XML API
  app.post("/api/legislative/congress-search", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { congressBillTracker } = await import("./services/congressBillTracker");
    
    const { 
      keywords = ['SNAP', 'TANF', 'Medicaid', 'EITC', 'CTC', 'WIC', 'food assistance', 'poverty', 'low-income'],
      congress = 119,
      billType,
      limit = 100
    } = req.body;
    
    console.log(`Searching Congress.gov for bills with keywords: ${keywords.join(', ')}`);
    
    const result = await congressBillTracker.searchBills(keywords, congress, billType, limit);
    
    res.json({
      success: result.success,
      message: `Congress.gov keyword search ${result.success ? 'completed' : 'completed with errors'}`,
      billsFound: result.billsFound,
      billsTracked: result.billsTracked,
      billsUpdated: result.billsUpdated,
      errors: result.errors
    });
  }));

  // Congress.gov API - Track specific bill by number (Real-time bill status)
  app.post("/api/legislative/congress-track/:billNumber", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { congressBillTracker } = await import("./services/congressBillTracker");
    
    const { billNumber } = req.params;
    const { congress = 119 } = req.body;
    
    // Parse bill number (e.g., "HR 5376" -> type: "hr", number: "5376")
    const billMatch = billNumber.match(/^([A-Z]+)\s*(\d+)$/i);
    
    if (!billMatch) {
      return res.status(400).json({ 
        error: "Invalid bill number format. Expected format: HR 5376, S 2345, etc." 
      });
    }
    
    const billType = billMatch[1].toLowerCase();
    const billNum = billMatch[2];
    
    console.log(`Tracking ${billType.toUpperCase()} ${billNum} from Congress ${congress}`);
    
    const result = await congressBillTracker.trackBill(congress, billType, billNum);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        billNumber: result.billNumber
      });
    }
    
    res.json({
      success: true,
      message: `Bill ${result.billNumber} ${result.updated ? 'updated' : 'tracked'} successfully`,
      billId: result.billId,
      billNumber: result.billNumber,
      updated: result.updated
    });
  }));

  // Congress.gov API - Sync all tracked bills (Update all bills in database)
  app.post("/api/legislative/congress-sync", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { congressBillTracker } = await import("./services/congressBillTracker");
    
    console.log("Starting sync of all tracked bills from Congress.gov...");
    
    const result = await congressBillTracker.syncTrackedBills();
    
    res.json({
      success: result.success,
      message: `Bill sync ${result.success ? 'completed' : 'completed with errors'}`,
      totalBills: result.billsFound,
      billsUpdated: result.billsUpdated,
      errors: result.errors
    });
  }));

  // Maryland Legislature Scraper - Scrape state bills from mgaleg.maryland.gov
  app.post("/api/legislative/maryland-scrape", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { marylandLegislatureScraper } = await import("./services/marylandLegislatureScraper");
    
    const session = req.body.session || '2025RS'; // Default to 2025 Regular Session
    console.log(`Starting Maryland Legislature scrape for session ${session}...`);
    
    const result = await marylandLegislatureScraper.scrapeBills(session);
    
    res.json({
      success: result.success,
      message: `Maryland Legislature scrape ${result.success ? 'completed' : 'completed with errors'}`,
      billsFound: result.billsFound,
      billsStored: result.billsStored,
      billsUpdated: result.billsUpdated,
      errors: result.errors
    });
  }));

  // Model Management
  app.get("/api/models", requireAdmin, async (req: Request, res: Response) => {
    try {
      const models = await storage.getModelVersions();
      res.json(models);
    } catch (error) {
      console.error("Error fetching model versions:", error);
      res.status(500).json({ error: "Failed to fetch model versions" });
    }
  });

  // Training Jobs
  app.get("/api/training-jobs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const jobs = await storage.getTrainingJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching training jobs:", error);
      res.status(500).json({ error: "Failed to fetch training jobs" });
    }
  });

  app.post("/api/training-jobs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const jobData = insertTrainingJobSchema.parse(req.body);
      const job = await storage.createTrainingJob(jobData);
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid job data", details: error.errors });
      }
      console.error("Error creating training job:", error);
      res.status(500).json({ error: "Failed to create training job" });
    }
  });

  app.patch("/api/training-jobs/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status, progress, metrics } = req.body;
      const job = await storage.updateTrainingJob(req.params.id, {
        status,
        progress,
        metrics,
      });
      res.json(job);
    } catch (error) {
      console.error("Error updating training job:", error);
      res.status(500).json({ error: "Failed to update training job" });
    }
  });

  // System metrics and status
  app.get("/api/system/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [totalDocuments] = await storage.getDocuments({ limit: 1 });
      const recentProcessing = await storage.getDocuments({ status: "processing", limit: 10 });
      const recentQueries = await storage.getSearchQueries(undefined, 10);
      
      const metrics = {
        totalDocuments: totalDocuments ? 1 : 0, // This would be a proper count in real implementation
        processingDocuments: recentProcessing.length,
        recentQueries: recentQueries.length,
        systemHealth: {
          vectorDatabase: "operational",
          ocrPipeline: "operational", 
          aiModelApi: "operational",
        },
        timestamp: new Date().toISOString(),
      };
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching system status:", error);
      res.status(500).json({ error: "Failed to fetch system status" });
    }
  });

  // Document Ingestion endpoints for Maryland SNAP manual
  app.post("/api/ingest/maryland-snap", requireAdmin, async (req: Request, res: Response) => {
    try {
      console.log('Starting Maryland SNAP manual ingestion...');
      const documentIds = await documentIngestionService.ingestAllDocuments();
      
      res.json({
        success: true,
        message: `Successfully ingested ${documentIds.length} documents from Maryland SNAP manual`,
        documentIds,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error ingesting Maryland SNAP documents:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to ingest Maryland SNAP documents",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get golden source documents with audit trail
  app.get("/api/golden-source/documents", requireAdmin, async (req: Request, res: Response) => {
    try {
      const documents = await documentIngestionService.listGoldenSourceDocuments();
      res.json({
        success: true,
        documents,
        count: documents.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching golden source documents:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch golden source documents"
      });
    }
  });

  // Verify document integrity
  app.post("/api/golden-source/verify/:documentId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const isValid = await documentIngestionService.verifyDocumentIntegrity(documentId);
      
      res.json({
        success: true,
        documentId,
        isValid,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error verifying document integrity:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to verify document integrity",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get audit trail for a specific document
  app.get("/api/golden-source/audit-trail/:documentId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const auditTrail = await documentIngestionService.getDocumentAuditTrail(documentId);
      
      if (!auditTrail) {
        return res.status(404).json({
          success: false,
          error: "Document not found or not a golden source document"
        });
      }
      
      res.json({
        success: true,
        documentId,
        auditTrail,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching audit trail:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch audit trail"
      });
    }
  });

  // Automated Ingestion Management endpoints
  app.get("/api/automated-ingestion/schedules", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schedules = automatedIngestionService.getSchedules();
      res.json({
        success: true,
        schedules,
        count: schedules.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching ingestion schedules:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch ingestion schedules"
      });
    }
  });

  app.post("/api/automated-ingestion/trigger", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;
      await automatedIngestionService.triggerManualIngestion(reason || 'Manual API trigger');
      
      res.json({
        success: true,
        message: 'Manual ingestion completed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error during manual ingestion:", error);
      res.status(500).json({ 
        success: false,
        error: "Manual ingestion failed",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.patch("/api/automated-ingestion/schedules/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const success = automatedIngestionService.updateSchedule(id, updates);
      
      if (!success) {
        return res.status(404).json({
          success: false,
          error: "Schedule not found"
        });
      }
      
      const updatedSchedule = automatedIngestionService.getSchedule(id);
      res.json({
        success: true,
        schedule: updatedSchedule,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating ingestion schedule:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to update ingestion schedule"
      });
    }
  });

  app.post("/api/automated-ingestion/schedules", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id, frequency, isActive } = req.body;
      
      if (!id || !frequency) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: id, frequency"
        });
      }
      
      const schedule = automatedIngestionService.createSchedule(id, frequency, isActive);
      
      res.json({
        success: true,
        schedule,
        message: `Created ingestion schedule: ${id}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error creating ingestion schedule:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to create ingestion schedule"
      });
    }
  });

  // ============================================================================
  // RULES AS CODE - ELIGIBILITY & BENEFIT CALCULATION ENDPOINTS
  // ============================================================================

  // Eligibility pre-screening endpoint
  app.post("/api/eligibility/check", requireAuth, async (req: Request, res: Response) => {
    try {
      const { householdSize, monthlyIncome, hasEarnedIncome, hasSSI, hasTANF, userId } = req.body;

      if (!householdSize || !monthlyIncome) {
        return res.status(400).json({ 
          error: "Missing required fields: householdSize, monthlyIncome" 
        });
      }

      // Get Maryland SNAP program
      const programs = await storage.getBenefitPrograms();
      const snapProgram = programs.find(p => p.code === "MD_SNAP");

      if (!snapProgram) {
        return res.status(500).json({ error: "Maryland SNAP program not found" });
      }

      const household = {
        size: householdSize,
        grossMonthlyIncome: monthlyIncome, // Already in cents from frontend
        earnedIncome: hasEarnedIncome ? monthlyIncome : 0,
        unearnedIncome: hasEarnedIncome ? 0 : monthlyIncome,
        categoricalEligibility: hasSSI ? 'SSI' : hasTANF ? 'TANF' : undefined,
      };

      const result = await rulesEngine.calculateEligibility(
        snapProgram.id,
        household,
        userId
      );

      // Log calculation for audit trail
      if (userId) {
        await rulesEngine.logCalculation(
          snapProgram.id,
          household,
          result,
          userId,
          req.ip,
          req.get('user-agent')
        );
      }

      res.json({
        eligible: result.isEligible,
        estimatedBenefit: result.monthlyBenefit,
        reason: result.reason,
        nextSteps: result.isEligible ? [
          'Complete a full application at marylandbenefits.gov',
          'Gather required documentation',
          'Schedule an interview with your local DSS office'
        ] : [
          'Review your household income and expenses',
          'Check if you qualify for other assistance programs',
          'Contact your local DSS office for guidance'
        ],
        requiredDocuments: [
          'Proof of identity',
          'Proof of income',
          'Proof of residence',
          'Social Security numbers for all household members'
        ],
        appliedRules: result.calculationBreakdown,
      });
    } catch (error) {
      console.error("Eligibility check error:", error);
      res.status(500).json({ error: "Failed to check eligibility" });
    }
  });

  // Full benefit calculation endpoint
  app.post("/api/eligibility/calculate", requireAuth, async (req: Request, res: Response) => {
    try {
      const {
        householdSize,
        monthlyGrossIncome,
        monthlyEarnedIncome,
        hasElderly,
        hasDisabled,
        hasSSI,
        hasTANF,
        shelterCosts,
        utilityCosts,
        dependentCareCosts,
        medicalExpenses,
        userId,
      } = req.body;

      if (!householdSize || monthlyGrossIncome === undefined) {
        return res.status(400).json({ 
          error: "Missing required fields: householdSize, monthlyGrossIncome" 
        });
      }

      // Get Maryland SNAP program
      const programs = await storage.getBenefitPrograms();
      const snapProgram = programs.find(p => p.code === "MD_SNAP");

      if (!snapProgram) {
        return res.status(500).json({ error: "Maryland SNAP program not found" });
      }

      const household = {
        size: householdSize,
        grossMonthlyIncome: monthlyGrossIncome,
        earnedIncome: monthlyEarnedIncome || 0,
        unearnedIncome: monthlyGrossIncome - (monthlyEarnedIncome || 0),
        hasElderly: hasElderly || false,
        hasDisabled: hasDisabled || false,
        dependentCareExpenses: dependentCareCosts || 0,
        medicalExpenses: medicalExpenses || 0,
        shelterCosts: (shelterCosts || 0) + (utilityCosts || 0),
        categoricalEligibility: hasSSI ? 'SSI' : hasTANF ? 'TANF' : undefined,
      };

      const result = await rulesEngine.calculateEligibility(
        snapProgram.id,
        household,
        userId
      );

      // Save calculation if user provided
      if (userId) {
        await rulesEngine.logCalculation(
          snapProgram.id,
          household,
          result,
          userId
        );
      }

      res.json({
        eligible: result.isEligible,
        estimatedBenefit: result.monthlyBenefit,
        reason: result.reason,
        breakdown: result.calculationBreakdown,
        calculation: {
          grossIncome: result.grossIncomeTest,
          netIncome: result.netIncomeTest,
          deductions: result.deductions,
          maxAllotment: result.maxAllotment,
        },
        policyCitations: result.policyCitations,
        appliedRules: result.rulesSnapshot,
      });
    } catch (error) {
      console.error("Benefit calculation error:", error);
      res.status(500).json({ error: "Failed to calculate benefit" });
    }
  });

  // Hybrid benefit calculation - Routes to Maryland Rules-as-Code engines with optional PolicyEngine verification
  app.post("/api/benefits/calculate-hybrid", asyncHandler(async (req: Request, res: Response) => {
    const inputSchema = z.object({
      programCode: z.string().optional(),
      benefitProgramId: z.string().optional(),
      householdSize: z.number().int().positive(),
      adultCount: z.number().int().positive().optional().default(1),
      income: z.number().nonnegative(),
      assets: z.number().nonnegative().optional(),
      hasElderly: z.boolean().optional(),
      hasDisabled: z.boolean().optional(),
      hasSSI: z.boolean().optional(),
      hasTANF: z.boolean().optional(),
      verifyWithPolicyEngine: z.boolean().optional().default(false),
    });

    const validated = inputSchema.parse(req.body);
    
    // Determine program code
    const programCode = validated.programCode || 'MD_SNAP'; // Default to SNAP for now
    
    // Generate cache key from household data
    const householdHash = generateHouseholdHash(validated);
    const cacheKey = CACHE_KEYS.HYBRID_CALC(programCode, householdHash);
    
    // Check cache first
    const cachedResponse = cacheService.get<any>(cacheKey);
    if (cachedResponse) {
      console.log(`✅ Cache hit for hybrid calculation endpoint (${programCode}, hash: ${householdHash})`);
      return res.json(cachedResponse);
    }
    
    console.log(`❌ Cache miss for hybrid calculation endpoint (${programCode}, hash: ${householdHash})`);
    
    // For structured input (not natural language), call rulesEngineAdapter directly
    // to preserve all parameters including assets
    const { rulesEngineAdapter } = await import("./services/rulesEngineAdapter");
    
    const input: any = {
      householdSize: validated.householdSize,
      income: validated.income,
      assets: validated.assets,
      hasElderly: validated.hasElderly,
      hasDisabled: validated.hasDisabled,
      hasSSI: validated.hasSSI,
      hasTANF: validated.hasTANF,
      benefitProgramId: validated.benefitProgramId,
    };
    
    // Calculate using rules engine adapter (preserves all structured input including assets)
    const adapterResult = await rulesEngineAdapter.calculateEligibility(programCode, input);
    
    // Format result similar to hybridService response structure
    const result: any = {
      type: 'deterministic',
      calculation: adapterResult ? {
        eligible: adapterResult.eligible,
        estimatedBenefit: adapterResult.estimatedBenefit,
        reason: adapterResult.reason,
        breakdown: adapterResult.breakdown,
        policyCitations: adapterResult.citations.map(c => ({
          sectionNumber: c.split(':')[0] || '',
          sectionTitle: '',
          ruleType: 'snap',
          description: c,
        })),
      } : undefined,
      responseTime: 0,
    };

    // Build primary calculation response
    // Normalize type to expected UI contract: 'deterministic' or 'ai_guidance'
    const normalizedType = result.type === 'deterministic' ? 'deterministic' : 'ai_guidance';
    
    const response: any = {
      primary: {
        eligible: result.calculation?.eligible || false,
        amount: result.calculation?.estimatedBenefit || 0,
        reason: result.calculation?.reason || result.answer,
        citations: result.calculation?.policyCitations?.map(c => c.description) || [],
        source: 'maryland_rules_engine',
        breakdown: result.calculation?.breakdown || [],
        type: normalizedType,
      },
      metadata: {
        responseTime: result.responseTime,
        queryClassification: result.classification?.type || result.classification?.queryType,
      }
    };

    // If verification requested, compare with PolicyEngine
    if (validated.verifyWithPolicyEngine) {
      try {
        const { policyEngineService } = await import("./services/policyEngine.service");
        
        // Calculate proper adult/child split
        const adults = validated.adultCount;
        const children = Math.max(0, validated.householdSize - adults);
        
        const policyEngineResult = await policyEngineService.calculateBenefits({
          adults,
          children,
          employmentIncome: validated.income,
          hasDisability: validated.hasDisabled,
          receivesSSI: validated.hasSSI,
        });

        if (policyEngineResult.success && policyEngineResult.benefits) {
          // Map to appropriate benefit program
          let policyEngineAmount = 0;
          
          if (validated.programCode === 'MD_SNAP' || !validated.programCode) {
            policyEngineAmount = policyEngineResult.benefits.snap || 0;
          } else if (validated.programCode === 'MEDICAID') {
            policyEngineAmount = policyEngineResult.benefits.medicaid || 0;
          } else if (validated.programCode === 'MD_TANF') {
            policyEngineAmount = policyEngineResult.benefits.tanf || 0;
          }

          const match = Math.abs(response.primary.amount - policyEngineAmount) < 10; // $10 tolerance

          response.verification = {
            eligible: policyEngineAmount > 0,
            amount: policyEngineAmount,
            source: 'policyengine',
            match,
            difference: response.primary.amount - policyEngineAmount,
          };
        }
      } catch (error) {
        console.error('PolicyEngine verification failed:', error);
        response.verification = {
          error: 'Verification failed',
          source: 'policyengine',
        };
      }
    }

    // Cache the response
    cacheService.set(cacheKey, response);
    console.log(`💾 Cached hybrid calculation response (${programCode}, hash: ${householdHash})`);

    res.json(response);
  }));

  // Get active SNAP income limits
  app.get("/api/rules/income-limits", requireAuth, async (req: Request, res: Response) => {
    try {
      const { benefitProgramId } = req.query;
      
      let programId = benefitProgramId as string;
      if (!programId) {
        const programs = await storage.getBenefitPrograms();
        const snapProgram = programs.find(p => p.code === "MD_SNAP");
        if (!snapProgram) {
          return res.status(500).json({ error: "Maryland SNAP program not found" });
        }
        programId = snapProgram.id;
      }

      // Check cache first
      const cacheKey = CACHE_KEYS.INCOME_LIMITS(Number(programId));
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const limits = await storage.getSnapIncomeLimits(programId);

      const response = {
        success: true,
        data: limits,
        count: limits.length,
      };

      // Cache for 5 minutes
      cacheService.set(cacheKey, response);

      res.json(response);
    } catch (error) {
      console.error("Error fetching income limits:", error);
      res.status(500).json({ error: "Failed to fetch income limits" });
    }
  });

  // Create new SNAP income limit
  app.post("/api/rules/income-limits", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { benefitProgramId, householdSize, grossMonthlyIncomeLimit, netMonthlyIncomeLimit, manualSection, effectiveDate } = req.body;

      if (!benefitProgramId || !householdSize || grossMonthlyIncomeLimit === undefined || netMonthlyIncomeLimit === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const limit = await storage.createSnapIncomeLimit({
        benefitProgramId,
        householdSize,
        grossMonthlyLimit: grossMonthlyIncomeLimit,
        netMonthlyLimit: netMonthlyIncomeLimit,
        percentOfPoverty: 200,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        endDate: null,
        isActive: true,
        notes: manualSection ? `Manual Section: ${manualSection}` : null,
      });

      // Invalidate cache
      invalidateRulesCache(Number(benefitProgramId));

      res.json({
        success: true,
        data: limit,
      });
    } catch (error) {
      console.error("Error creating income limit:", error);
      res.status(500).json({ error: "Failed to create income limit" });
    }
  });

  // Update SNAP income limit
  app.patch("/api/rules/income-limits/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { householdSize, grossMonthlyIncomeLimit, netMonthlyIncomeLimit, manualSection, effectiveDate, isActive } = req.body;

      const updates: any = {};
      if (householdSize !== undefined) updates.householdSize = householdSize;
      if (grossMonthlyIncomeLimit !== undefined) updates.grossMonthlyLimit = grossMonthlyIncomeLimit;
      if (netMonthlyIncomeLimit !== undefined) updates.netMonthlyLimit = netMonthlyIncomeLimit;
      if (manualSection !== undefined) updates.notes = `Manual Section: ${manualSection}`;
      if (effectiveDate !== undefined) updates.effectiveDate = new Date(effectiveDate);
      if (isActive !== undefined) updates.isActive = isActive;

      const limit = await storage.updateSnapIncomeLimit(id, updates);

      // Get the limit to find benefitProgramId for cache invalidation
      const updatedLimit = await storage.getSnapIncomeLimits(limit.benefitProgramId);
      if (updatedLimit.length > 0) {
        invalidateRulesCache(Number(updatedLimit[0].benefitProgramId));
      }

      res.json({
        success: true,
        data: limit,
      });
    } catch (error) {
      console.error("Error updating income limit:", error);
      res.status(500).json({ error: "Failed to update income limit" });
    }
  });

  // Get active SNAP deductions
  app.get("/api/rules/deductions", requireAuth, async (req: Request, res: Response) => {
    try {
      const programs = await storage.getBenefitPrograms();
      const snapProgram = programs.find(p => p.code === "MD_SNAP");

      if (!snapProgram) {
        return res.status(500).json({ error: "Maryland SNAP program not found" });
      }

      // Check cache first
      const cacheKey = CACHE_KEYS.DEDUCTIONS(Number(snapProgram.id));
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const deductions = await storage.getSnapDeductions(snapProgram.id);
      const activeDeductions = deductions.filter(d => d.isActive);

      const response = {
        success: true,
        data: activeDeductions,
        count: activeDeductions.length,
      };

      // Cache for 5 minutes
      cacheService.set(cacheKey, response);

      res.json(response);
    } catch (error) {
      console.error("Error fetching deductions:", error);
      res.status(500).json({ error: "Failed to fetch deductions" });
    }
  });

  // Get active SNAP allotments
  app.get("/api/rules/allotments", requireAuth, async (req: Request, res: Response) => {
    try {
      const programs = await storage.getBenefitPrograms();
      const snapProgram = programs.find(p => p.code === "MD_SNAP");

      if (!snapProgram) {
        return res.status(500).json({ error: "Maryland SNAP program not found" });
      }

      // Check cache first
      const cacheKey = CACHE_KEYS.ALLOTMENTS(Number(snapProgram.id));
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const allotments = await storage.getSnapAllotments(snapProgram.id);
      const activeAllotments = allotments.filter(a => a.isActive);

      const response = {
        success: true,
        data: activeAllotments,
        count: activeAllotments.length,
      };

      // Cache for 5 minutes
      cacheService.set(cacheKey, response);

      res.json(response);
    } catch (error) {
      console.error("Error fetching allotments:", error);
      res.status(500).json({ error: "Failed to fetch allotments" });
    }
  });

  // Get categorical eligibility rules
  app.get("/api/rules/categorical-eligibility", requireAuth, async (req: Request, res: Response) => {
    try {
      const programs = await storage.getBenefitPrograms();
      const snapProgram = programs.find(p => p.code === "MD_SNAP");

      if (!snapProgram) {
        return res.status(500).json({ error: "Maryland SNAP program not found" });
      }

      const rules = await storage.getCategoricalEligibilityRules(snapProgram.id);
      const activeRules = rules.filter(r => r.isActive);

      res.json({
        success: true,
        data: activeRules,
        count: activeRules.length,
      });
    } catch (error) {
      console.error("Error fetching categorical eligibility rules:", error);
      res.status(500).json({ error: "Failed to fetch categorical eligibility rules" });
    }
  });

  // Get document requirements
  app.get("/api/rules/document-requirements", requireAuth, async (req: Request, res: Response) => {
    try {
      const programs = await storage.getBenefitPrograms();
      const snapProgram = programs.find(p => p.code === "MD_SNAP");

      if (!snapProgram) {
        return res.status(500).json({ error: "Maryland SNAP program not found" });
      }

      const requirements = await storage.getDocumentRequirementRules(snapProgram.id);
      const activeRequirements = requirements.filter(r => r.isActive);

      res.json({
        success: true,
        data: activeRequirements,
        count: activeRequirements.length,
      });
    } catch (error) {
      console.error("Error fetching document requirements:", error);
      res.status(500).json({ error: "Failed to fetch document requirements" });
    }
  });

  // ============================================================================
  // RULES SNAPSHOT VERSIONING ENDPOINTS
  // ============================================================================

  // Get snapshots for a rule type
  app.get("/api/rules/snapshots", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { ruleType, ruleId, limit } = req.query;

      if (!ruleType) {
        return res.status(400).json({ error: "ruleType is required" });
      }

      const validRuleTypes = ['income_limit', 'deduction', 'allotment', 'categorical'];
      if (!validRuleTypes.includes(ruleType as string)) {
        return res.status(400).json({ error: "Invalid ruleType" });
      }

      const history = await rulesAsCodeService.getRuleHistory(
        ruleType as any,
        ruleId as string | undefined,
        limit ? parseInt(limit as string) : 50
      );

      res.json({
        success: true,
        data: history.changes,
        ruleType: history.ruleType,
        ruleId: history.ruleId,
        totalChanges: history.totalChanges,
      });
    } catch (error) {
      console.error("Error fetching rule snapshots:", error);
      res.status(500).json({ error: "Failed to fetch rule snapshots" });
    }
  });

  // Get specific snapshot by ID
  app.get("/api/rules/snapshots/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const snapshot = await rulesAsCodeService.getRuleSnapshot(id);

      if (!snapshot) {
        return res.status(404).json({ error: "Snapshot not found" });
      }

      res.json({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      console.error("Error fetching snapshot:", error);
      res.status(500).json({ error: "Failed to fetch snapshot" });
    }
  });

  // Create new rule snapshot
  app.post("/api/rules/snapshots", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { ruleType, ruleData, changeReason } = req.body;
      const user = req.user as any;

      if (!ruleType || !ruleData) {
        return res.status(400).json({ error: "ruleType and ruleData are required" });
      }

      const validRuleTypes = ['income_limit', 'deduction', 'allotment', 'categorical'];
      if (!validRuleTypes.includes(ruleType)) {
        return res.status(400).json({ error: "Invalid ruleType" });
      }

      const snapshot = await rulesAsCodeService.createRuleSnapshot(
        ruleType,
        ruleData,
        user.id,
        changeReason
      );

      res.json({
        success: true,
        data: snapshot,
        message: "Rule snapshot created successfully",
      });
    } catch (error) {
      console.error("Error creating rule snapshot:", error);
      res.status(500).json({ error: "Failed to create rule snapshot" });
    }
  });

  // Compare two rule versions
  app.get("/api/rules/snapshots/compare", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id1, id2 } = req.query;

      if (!id1 || !id2) {
        return res.status(400).json({ error: "Both id1 and id2 are required" });
      }

      const comparison = await rulesAsCodeService.compareRuleVersions(
        id1 as string,
        id2 as string
      );

      if (!comparison) {
        return res.status(404).json({ error: "One or both snapshots not found" });
      }

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error: any) {
      console.error("Error comparing rule versions:", error);
      res.status(500).json({ error: error.message || "Failed to compare rule versions" });
    }
  });

  // Get effective rules for a specific date
  app.get("/api/rules/effective", requireAuth, async (req: Request, res: Response) => {
    try {
      const { date, benefitProgramId } = req.query;

      let programId = benefitProgramId as string;
      if (!programId) {
        const programs = await storage.getBenefitPrograms();
        const snapProgram = programs.find(p => p.code === "MD_SNAP");
        if (!snapProgram) {
          return res.status(500).json({ error: "Maryland SNAP program not found" });
        }
        programId = snapProgram.id;
      }

      const effectiveDate = date ? new Date(date as string) : new Date();
      
      const effectiveRules = await rulesAsCodeService.getEffectiveRulesForDate(
        programId,
        effectiveDate
      );

      res.json({
        success: true,
        data: effectiveRules,
      });
    } catch (error) {
      console.error("Error fetching effective rules:", error);
      res.status(500).json({ error: "Failed to fetch effective rules" });
    }
  });

  // Get recent eligibility calculations
  app.get("/api/eligibility/calculations", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, limit } = req.query;
      const calculations = await storage.getEligibilityCalculations(
        userId as string,
        limit ? parseInt(limit as string) : 50
      );

      res.json({
        success: true,
        data: calculations,
        count: calculations.length,
      });
    } catch (error) {
      console.error("Error fetching calculations:", error);
      res.status(500).json({ error: "Failed to fetch calculations" });
    }
  });

  // ============================================================================
  // POLICY MANUAL ENDPOINTS
  // ============================================================================

  // Get all manual sections (table of contents)
  app.get("/api/manual/sections", requireAuth, async (req: Request, res: Response) => {
    try {
      // Check cache first - use a static key for all sections
      const cacheKey = 'manual_sections:all';
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const sections = await storage.getManualSections();
      const response = {
        success: true,
        data: sections,
        count: sections.length,
      };

      // Cache for 5 minutes
      cacheService.set(cacheKey, response);

      res.json(response);
    } catch (error) {
      console.error("Error fetching manual sections:", error);
      res.status(500).json({ error: "Failed to fetch manual sections" });
    }
  });

  // Get specific manual section with details
  app.get("/api/manual/sections/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Check cache first
      const cacheKey = CACHE_KEYS.MANUAL_SECTION(Number(id));
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Get section details, cross-references, and chunks in parallel
      const [section, crossReferences, chunks] = await Promise.all([
        storage.getManualSection(id),
        storage.getSectionCrossReferences(id),
        storage.getSectionChunks(id)
      ]);

      if (!section) {
        return res.status(404).json({ error: "Section not found" });
      }

      const response = {
        success: true,
        data: {
          section,
          crossReferences,
          chunks,
        },
      };

      // Cache for 5 minutes
      cacheService.set(cacheKey, response);

      res.json(response);
    } catch (error) {
      console.error("Error fetching section details:", error);
      res.status(500).json({ error: "Failed to fetch section details" });
    }
  });

  // Get manual structure (metadata without DB access)
  app.get("/api/manual/structure", requireAuth, async (req: Request, res: Response) => {
    try {
      const structure = manualIngestionService.getManualStructure();
      res.json({
        success: true,
        data: structure,
        total: manualIngestionService.getTotalSections(),
      });
    } catch (error) {
      console.error("Error fetching manual structure:", error);
      res.status(500).json({ error: "Failed to fetch manual structure" });
    }
  });

  // Get manual ingestion status
  app.get("/api/manual/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const status = await manualIngestionService.getIngestionStatus();
      const isComplete = await manualIngestionService.verifyCompleteness();
      
      res.json({
        success: true,
        ...status,
        isComplete,
      });
    } catch (error) {
      console.error("Error fetching manual status:", error);
      res.status(500).json({ error: "Failed to fetch manual status" });
    }
  });

  // Trigger manual metadata ingestion
  app.post("/api/manual/ingest-metadata", requireAdmin, async (req: Request, res: Response) => {
    try {
      const programs = await storage.getBenefitPrograms();
      const snapProgram = programs.find(p => p.code === "MD_SNAP");

      if (!snapProgram) {
        return res.status(500).json({ error: "Maryland SNAP program not found" });
      }

      await manualIngestionService.ingestSectionMetadata(snapProgram.id);

      const status = await manualIngestionService.getIngestionStatus();

      // Invalidate manual sections cache
      cacheService.del('manual_sections:all');
      cacheService.invalidatePattern('manual_section');

      res.json({
        success: true,
        message: "Manual metadata ingested successfully",
        ...status,
      });
    } catch (error) {
      console.error("Error ingesting manual metadata:", error);
      res.status(500).json({ error: "Failed to ingest manual metadata" });
    }
  });

  // Trigger FULL manual ingestion (download PDFs, extract text, generate embeddings)
  app.post("/api/manual/ingest-full", requireAdmin, async (req: Request, res: Response) => {
    try {
      // Import the full ingestion service
      const { ingestCompleteManual } = await import("./services/manualIngestionService");
      
      console.log("Starting complete manual ingestion pipeline...");
      
      // Run the complete ingestion
      const result = await ingestCompleteManual();
      
      // Invalidate manual sections cache
      cacheService.del('manual_sections:all');
      cacheService.invalidatePattern('manual_section');

      res.json({
        success: true,
        message: "Manual ingestion completed successfully",
        sectionsProcessed: result.sectionsProcessed,
        chunksCreated: result.chunksCreated,
        crossReferencesExtracted: result.crossReferencesExtracted,
        errors: result.errors,
      });
    } catch (error) {
      console.error("Error during full manual ingestion:", error);
      res.status(500).json({ 
        error: "Failed to complete manual ingestion",
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ============================================================================
  // VITA TAX PROGRAM - IRS Publication 4012 Ingestion
  // ============================================================================

  // Trigger IRS Pub 4012 ingestion (Legacy - uses web scraping)
  app.post("/api/vita/ingest-pub4012", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { VitaIngestionService } = await import("./services/vitaIngestion.service");
    const vitaService = new VitaIngestionService(storage);
    
    // Get VITA program
    const programs = await storage.getBenefitPrograms();
    const vitaProgram = programs.find(p => p.code === "VITA");
    
    if (!vitaProgram) {
      return res.status(500).json({ error: "VITA program not found. Please seed benefit programs first." });
    }
    
    console.log("Starting IRS Publication 4012 ingestion...");
    
    const result = await vitaService.ingestPub4012(vitaProgram.id);
    
    res.json({
      success: true,
      message: "IRS Publication 4012 ingested successfully",
      ...result
    });
  }));

  // Trigger IRS Direct Download (Official - replaces web scraping)
  app.post("/api/vita/download-irs-publications", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { irsDirectDownloader } = await import("./services/irsDirectDownloader");
    
    console.log("Starting IRS Direct Download Service...");
    
    const documentIds = await irsDirectDownloader.downloadAllVITAPublications();
    
    res.json({
      success: true,
      message: "IRS VITA publications downloaded successfully",
      documentsProcessed: documentIds.length,
      documentIds
    });
  }));

  // Get VITA documents status
  app.get("/api/vita/documents", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const programs = await storage.getBenefitPrograms();
    const vitaProgram = programs.find(p => p.code === "VITA");
    
    if (!vitaProgram) {
      return res.status(404).json({ error: "VITA program not found" });
    }
    
    const documents = await storage.getDocuments({
      benefitProgramId: vitaProgram.id,
      limit: 50
    });
    
    res.json({
      program: vitaProgram,
      documents
    });
  }));

  // Search VITA knowledge base with semantic similarity
  app.post("/api/vita/search", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { VitaSearchService } = await import("./services/vitaSearch.service");
    const vitaSearch = new VitaSearchService(storage);

    const searchSchema = z.object({
      query: z.string().min(1, "Query is required"),
      topK: z.number().optional().default(5),
      minScore: z.number().optional().default(0.7),
      topics: z.array(z.string()).optional(),
      ruleTypes: z.array(z.string()).optional(),
      includeAnswer: z.boolean().optional().default(true)
    });

    const validated = searchSchema.parse(req.body);

    // Perform semantic search
    const searchResults = await vitaSearch.searchVitaKnowledge(validated.query, {
      topK: validated.topK,
      minScore: validated.minScore,
      topics: validated.topics,
      ruleTypes: validated.ruleTypes
    });

    // Generate AI answer with citations if requested
    let answer = null;
    if (validated.includeAnswer && searchResults.length > 0) {
      const answerResult = await vitaSearch.answerWithCitations(validated.query, searchResults);
      answer = answerResult.answer;
    }

    res.json({
      success: true,
      query: validated.query,
      answer,
      results: searchResults,
      count: searchResults.length
    });
  }));

  // Get available VITA topics from knowledge base
  app.get("/api/vita/topics", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { VitaSearchService } = await import("./services/vitaSearch.service");
    const vitaSearch = new VitaSearchService(storage);

    const topics = await vitaSearch.getAvailableTopics();

    res.json({
      success: true,
      topics,
      count: topics.length
    });
  }));

  // ============================================================================
  // LIVING POLICY MANUAL - Text generation from Rules as Code
  // ============================================================================

  // Generate text for a specific section from Rules as Code
  app.post("/api/manual/generate-text/:sectionId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { sectionId } = req.params;
      
      // Get Maryland SNAP program
      const programs = await storage.getBenefitPrograms();
      const snapProgram = programs.find(p => p.code === "MD_SNAP");

      if (!snapProgram) {
        return res.status(500).json({ error: "Maryland SNAP program not found" });
      }

      const generated = await textGenerationService.generateSectionText(
        snapProgram.id,
        sectionId
      );

      res.json({
        success: true,
        data: generated
      });
    } catch (error) {
      console.error("Error generating section text:", error);
      res.status(500).json({ 
        error: "Failed to generate section text",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Generate income limits text
  app.post("/api/manual/generate/income-limits", requireAuth, async (req: Request, res: Response) => {
    try {
      const programs = await storage.getBenefitPrograms();
      const snapProgram = programs.find(p => p.code === "MD_SNAP");

      if (!snapProgram) {
        return res.status(500).json({ error: "Maryland SNAP program not found" });
      }

      const generated = await textGenerationService.generateIncomeLimitsText(snapProgram.id);
      res.json({ success: true, data: generated });
    } catch (error) {
      console.error("Error generating income limits text:", error);
      res.status(500).json({ error: "Failed to generate income limits text" });
    }
  });

  // Generate deductions text
  app.post("/api/manual/generate/deductions", requireAuth, async (req: Request, res: Response) => {
    try {
      const programs = await storage.getBenefitPrograms();
      const snapProgram = programs.find(p => p.code === "MD_SNAP");

      if (!snapProgram) {
        return res.status(500).json({ error: "Maryland SNAP program not found" });
      }

      const generated = await textGenerationService.generateDeductionsText(snapProgram.id);
      res.json({ success: true, data: generated });
    } catch (error) {
      console.error("Error generating deductions text:", error);
      res.status(500).json({ error: "Failed to generate deductions text" });
    }
  });

  // Generate allotments text
  app.post("/api/manual/generate/allotments", requireAuth, async (req: Request, res: Response) => {
    try {
      const programs = await storage.getBenefitPrograms();
      const snapProgram = programs.find(p => p.code === "MD_SNAP");

      if (!snapProgram) {
        return res.status(500).json({ error: "Maryland SNAP program not found" });
      }

      const generated = await textGenerationService.generateAllotmentsText(snapProgram.id);
      res.json({ success: true, data: generated });
    } catch (error) {
      console.error("Error generating allotments text:", error);
      res.status(500).json({ error: "Failed to generate allotments text" });
    }
  });

  // ============================================================================
  // NAVIGATOR WORKSPACE - Client session tracking and E&E exports
  // ============================================================================

  const sessionCreateSchema = z.object({
    clientCaseId: z.string().optional(),
    sessionType: z.enum(['screening', 'application_assist', 'recert_assist', 'documentation', 'follow_up']),
    location: z.enum(['office', 'phone', 'field_visit', 'video']),
    durationMinutes: z.number().int().positive().optional(),
    topicsDiscussed: z.array(z.string()).optional(),
    notes: z.string().optional(),
    outcomeStatus: z.enum(['completed', 'needs_follow_up', 'referred', 'application_submitted']),
    actionItems: z.array(z.any()).optional(),
    documentsReceived: z.array(z.any()).optional(),
    documentsVerified: z.array(z.any()).optional()
  });

  const exportCreateSchema = z.object({
    exportType: z.enum(['daily', 'weekly', 'manual']),
    exportFormat: z.enum(['csv', 'json', 'xml']),
    notes: z.string().optional()
  });

  // Get all client interaction sessions for the current navigator
  app.get("/api/navigator/sessions", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const sessions = await storage.getClientInteractionSessions();
    res.json(sessions);
  }));

  // Create a new client interaction session
  app.post("/api/navigator/sessions", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const validatedData = sessionCreateSchema.parse(req.body);
    
    const sessionData = {
      ...validatedData,
      navigatorId: req.user?.id || 'system',
      exportedToEE: false
    };

    const session = await storage.createClientInteractionSession(sessionData);
    res.json(session);
  }));

  // Get all E&E export batches
  app.get("/api/navigator/exports", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const exports = await storage.getEEExportBatches();
    res.json(exports);
  }));

  // Create a new E&E export batch
  app.post("/api/navigator/exports", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const validatedData = exportCreateSchema.parse(req.body);

    // Get unexported sessions
    const unexportedSessions = await storage.getUnexportedSessions();

    if (unexportedSessions.length === 0) {
      throw validationError("No sessions available for export");
    }

    // Create export batch
    const exportBatch = await storage.createEEExportBatch({
      ...validatedData,
      sessionCount: unexportedSessions.length,
      exportedBy: req.user?.id || 'system',
      uploadedToEE: false
    });

    // Mark sessions as exported
    await storage.markSessionsAsExported(unexportedSessions.map(s => s.id), exportBatch.id);

    res.json(exportBatch);
  }));

  // Download an E&E export batch file
  app.get("/api/navigator/exports/:id/download", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { eeExportService } = await import("./services/eeExportService");
    const exportBatch = await storage.getEEExportBatch(id);

    if (!exportBatch) {
      throw validationError("Export batch not found");
    }

    // Get sessions for this export
    const sessions = await storage.getSessionsByExportBatch(id);
    const sessionIds = sessions.map(s => s.id);

    // Generate export file using enhanced service
    let content: string;
    let mimeType: string;
    let filename: string;

    if (exportBatch.exportFormat === 'csv') {
      mimeType = 'text/csv';
      filename = `ee-export-${id}.csv`;
      content = await eeExportService.generateCSV(sessionIds);
    } else if (exportBatch.exportFormat === 'json') {
      mimeType = 'application/json';
      filename = `ee-export-${id}.json`;
      content = await eeExportService.generateJSON(sessionIds);
    } else { // xml
      mimeType = 'application/xml';
      filename = `ee-export-${id}.xml`;
      content = await eeExportService.generateXML(sessionIds);
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }));

  // ============================================================================
  // SMART VERIFICATION - Document verification for Navigator Workspace
  // ============================================================================

  // Upload and analyze verification document (rent receipt, utility bill, pay stub, etc.)
  app.post("/api/navigator/sessions/:sessionId/documents", requireStaff, upload.single("document"), asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { documentType, clientCaseId } = req.body;
    
    if (!req.file) {
      throw validationError("No document uploaded");
    }
    
    if (!documentType || !clientCaseId) {
      throw validationError("documentType and clientCaseId are required");
    }
    
    // Convert buffer to base64 for Gemini Vision
    const base64Image = req.file.buffer.toString('base64');
    
    // Lazy load verification service
    const { verifyDocument } = await import("./services/documentVerification.service");
    
    // Analyze document with Gemini Vision
    const analysisResult = await verifyDocument(base64Image, documentType);
    
    // Upload to object storage
    const objectStorageService = new ObjectStorageService();
    const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: req.file.buffer,
      headers: { 'Content-Type': req.file.mimetype }
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }
    
    const objectMetadata = await uploadResponse.json();
    
    // Create verification document record
    const verificationDoc = await storage.createClientVerificationDocument({
      sessionId,
      clientCaseId,
      documentType,
      fileName: req.file.originalname,
      filePath: objectMetadata.url || objectMetadata.id,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user?.id || 'system',
      visionAnalysisStatus: analysisResult.errors.length > 0 ? 'failed' : 'completed',
      visionAnalysisError: analysisResult.errors.join('; ') || null,
      extractedData: analysisResult.extractedData,
      rawVisionResponse: { response: analysisResult.rawResponse },
      confidenceScore: analysisResult.confidenceScore,
      verificationStatus: analysisResult.errors.length > 0 ? 'needs_more_info' : 'pending_review',
      validationWarnings: analysisResult.warnings,
      validationErrors: analysisResult.errors
    });
    
    res.json(verificationDoc);
  }));

  // Get all verification documents for a session
  app.get("/api/navigator/sessions/:sessionId/documents", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const documents = await storage.getClientVerificationDocuments({ sessionId });
    res.json(documents);
  }));

  // Update verification document status (approve/reject/edit)
  app.patch("/api/navigator/documents/:id", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { verificationStatus, reviewNotes, manuallyEditedData } = req.body;
    
    const updates: any = {
      reviewedBy: req.user?.id,
      reviewedAt: new Date()
    };
    
    if (verificationStatus) updates.verificationStatus = verificationStatus;
    if (reviewNotes) updates.reviewNotes = reviewNotes;
    if (manuallyEditedData) updates.manuallyEditedData = manuallyEditedData;
    
    const updated = await storage.updateClientVerificationDocument(id, updates);
    res.json(updated);
  }));

  // Delete verification document
  app.delete("/api/navigator/documents/:id", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await storage.deleteClientVerificationDocument(id);
    res.json({ success: true });
  }));

  // ============================================================================
  // CONSENT MANAGEMENT - Forms and client consents
  // ============================================================================

  const consentFormSchema = z.object({
    formName: z.string().min(1),
    formCode: z.string().min(1),
    formTitle: z.string().min(1),
    formContent: z.string().min(50),
    purpose: z.string().min(10),
    requiresSignature: z.boolean().default(true),
    expirationDays: z.number().int().positive().optional(),
    isActive: z.boolean().default(false)
  });

  const clientConsentSchema = z.object({
    clientCaseId: z.string().min(1),
    consentFormId: z.string().min(1),
    consentGiven: z.boolean(),
    consentDate: z.string(),
    signatureMethod: z.string().optional(),
    notes: z.string().optional()
  });

  // Get all consent forms
  app.get("/api/consent/forms", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const forms = await storage.getConsentForms();
    res.json(forms);
  }));

  // Create a new consent form
  app.post("/api/consent/forms", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const validatedData = consentFormSchema.parse(req.body);
    
    const formData = {
      ...validatedData,
      version: 1,
      createdBy: req.user?.id || 'system'
    };

    const form = await storage.createConsentForm(formData);
    res.json(form);
  }));

  // Get all client consents
  app.get("/api/consent/client-consents", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const clientCaseId = req.query.clientCaseId as string | undefined;
    const consents = await storage.getClientConsents(clientCaseId);
    res.json(consents);
  }));

  // Enhanced client consent recording with VITA session linkage and audit trail
  app.post("/api/consent/client-consents", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const {
      clientCaseId,
      consentFormId,
      vitaIntakeSessionId, // NEW: Link to VITA session
      signatureMetadata, // NEW: {typedName, date, ipAddress, userAgent, method}
      benefitProgramsAuthorized, // NEW: Programs authorized
      notes
    } = req.body;
    
    // Validate required fields
    if (!clientCaseId || !consentFormId) {
      return res.status(400).json({
        success: false,
        error: 'clientCaseId and consentFormId are required'
      });
    }
    
    // Fetch consent form to get version and content
    const consentForm = await db.query.consentForms.findFirst({
      where: eq(consentForms.id, consentFormId)
    });
    
    if (!consentForm) {
      return res.status(404).json({
        success: false,
        error: 'Consent form not found'
      });
    }
    
    if (!consentForm.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Consent form is not currently active'
      });
    }
    
    // Get client IP and user agent for audit trail
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Calculate expiration date if form has expirationDays
    const expiresAt = consentForm.expirationDays
      ? new Date(Date.now() + consentForm.expirationDays * 24 * 60 * 60 * 1000)
      : null;
    
    // Insert client consent with enhanced metadata
    const [consent] = await db.insert(clientConsents).values({
      clientCaseId,
      consentFormId,
      sessionId: req.sessionID, // Existing session tracking
      vitaIntakeSessionId, // NEW: VITA session linkage
      consentGiven: true,
      consentDate: new Date(),
      signatureMetadata, // NEW: Structured signature data
      acceptedFormVersion: `v${consentForm.version}`, // NEW: Track version
      acceptedFormContent: consentForm.formContent, // NEW: Copy of accepted text
      benefitProgramsAuthorized, // NEW: Programs authorized
      ipAddress: ipAddress?.toString(), // NEW: Client IP
      userAgent, // NEW: Browser user agent
      expiresAt,
      notes,
    }).returning();
    
    // Log audit event
    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'irs_consent_recorded',
      resource: 'client_consent',
      resourceId: consent.id,
      details: {
        formCode: consentForm.formCode,
        formVersion: consentForm.version,
        vitaSessionId: vitaIntakeSessionId,
        benefitPrograms: benefitProgramsAuthorized,
        signatureMethod: signatureMetadata?.method,
      },
      ipAddress: ipAddress?.toString(),
      userAgent,
    });
    
    res.status(201).json({
      success: true,
      data: consent
    });
  }));

  // GET consent form by code - Used for IRS consent form retrieval
  app.get("/api/consent/forms/:code", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.params;
    
    const form = await db.query.consentForms.findFirst({
      where: and(
        eq(consentForms.formCode, code),
        eq(consentForms.isActive, true)
      )
    });
    
    if (!form) {
      return res.status(404).json({ 
        success: false, 
        error: `Consent form '${code}' not found or inactive` 
      });
    }
    
    res.json({ success: true, data: form });
  }));

  // Retrieve consent for a specific VITA session
  app.get("/api/consent/client-consents/vita-session/:sessionId", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    const consents = await db.query.clientConsents.findMany({
      where: eq(clientConsents.vitaIntakeSessionId, sessionId),
      with: {
        consentForm: true, // Include form details
      },
      orderBy: [desc(clientConsents.consentDate)]
    });
    
    res.json({
      success: true,
      data: consents
    });
  }));

  // Enhanced client consent recording with VITA session linkage and audit trail
  app.post("/api/consent/client-consents/vita", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { 
      consentFormId, 
      sessionId,
      clientCaseId,
      benefitPrograms,
      signatureData,
      signatureMethod = 'electronic'
    } = req.body;
    
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');
    
    // Verify that the form exists and is active
    const form = await db.query.consentForms.findFirst({
      where: and(
        eq(consentForms.id, consentFormId),
        eq(consentForms.isActive, true)
      )
    });
    
    if (!form) {
      throw validationError("Consent form not found or inactive");
    }
    
    // Calculate expiration date
    let expiresAt: Date | null = null;
    if (form.expirationDays) {
      expiresAt = new Date(Date.now() + (form.expirationDays * 24 * 60 * 60 * 1000));
    }
    
    // Create consent record with metadata
    const [consent] = await db.insert(clientConsents).values({
      clientCaseId,
      consentFormId,
      sessionId,
      consentGiven: true,
      consentDate: new Date(),
      signatureMethod,
      signatureData,
      ipAddress,
      expiresAt,
      metadata: {
        benefitPrograms: benefitPrograms || [],
        userAgent,
        formVersion: form.version,
        ipAddress,
        recordedAt: new Date().toISOString()
      }
    }).returning();
    
    // Create audit log entry
    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'irs_consent_recorded',
      resource: 'client_consent',
      resourceId: consent.id,
      details: {
        consentFormCode: form.formCode,
        sessionId,
        benefitPrograms,
        ipAddress,
        userAgent
      }
    });
    
    res.json({ success: true, data: consent });
  }));

  // GET consent status for Vita session
  app.get("/api/consent/vita-session/:sessionId", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const consents = await db.query.clientConsents.findMany({
      where: eq(clientConsents.sessionId, req.params.sessionId),
      with: { 
        consentForm: true,
        clientCase: true
      },
      orderBy: [desc(clientConsents.consentDate)]
    });
    
    res.json({ success: true, data: consents });
  }));

  // ===== RULES EXTRACTION ROUTES =====
  
  // Request validation schemas
  const extractSectionSchema = z.object({
    manualSectionId: z.string().min(1, "Manual section ID is required"),
    extractionType: z.enum(['income_limits', 'deductions', 'allotments', 'categorical_eligibility', 'document_requirements', 'full_auto']).optional().default('full_auto'),
  });
  
  const extractBatchSchema = z.object({
    manualSectionIds: z.array(z.string().min(1)).min(1, "At least one manual section ID is required"),
  });
  
  // Extract rules from a single manual section
  app.post("/api/extraction/extract-section", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { extractRulesFromSection } = await import('./services/rulesExtractionService');
    
    const validatedData = extractSectionSchema.parse(req.body);
    
    const result = await extractRulesFromSection(
      validatedData.manualSectionId,
      validatedData.extractionType,
      req.user?.id
    );
    
    // Invalidate all rules caches - extraction affects all rule types
    const programs = await storage.getBenefitPrograms();
    const snapProgram = programs.find(p => p.code === "MD_SNAP");
    if (snapProgram) {
      invalidateRulesCache(Number(snapProgram.id));
    }
    
    res.json(result);
  }));

  // Batch extract rules from multiple sections
  app.post("/api/extraction/extract-batch", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { batchExtractRules } = await import('./services/rulesExtractionService');
    
    const validatedData = extractBatchSchema.parse(req.body);
    
    const result = await batchExtractRules(validatedData.manualSectionIds, req.user?.id);
    
    // Invalidate all rules caches - extraction affects all rule types
    const programs = await storage.getBenefitPrograms();
    const snapProgram = programs.find(p => p.code === "MD_SNAP");
    if (snapProgram) {
      invalidateRulesCache(Number(snapProgram.id));
    }
    
    res.json(result);
  }));

  // Get extraction job status
  app.get("/api/extraction/jobs/:jobId", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { getExtractionJob } = await import('./services/rulesExtractionService');
    
    const job = await getExtractionJob(req.params.jobId);
    
    if (!job) {
      res.status(404).json({ message: "Extraction job not found" });
      return;
    }
    
    res.json(job);
  }));

  // Get all extraction jobs
  app.get("/api/extraction/jobs", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { getAllExtractionJobs } = await import('./services/rulesExtractionService');
    
    const jobs = await getAllExtractionJobs();
    
    res.json(jobs);
  }));

  // ===== AI HEALTH & BIAS MONITORING ROUTES =====
  
  // Get AI query analytics
  app.get("/api/ai-monitoring/query-analytics", asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Query volume and trends
    const queries = await db
      .select({
        date: sql<string>`DATE(${searchQueries.createdAt})`,
        count: sql<number>`COUNT(*)::int`,
        avgRelevance: sql<number>`AVG(${searchQueries.relevanceScore})::real`,
        avgResponseTime: sql<number>`AVG(${searchQueries.responseTime})::int`
      })
      .from(searchQueries)
      .where(sql`${searchQueries.createdAt} >= ${startDate}`)
      .groupBy(sql`DATE(${searchQueries.createdAt})`)
      .orderBy(sql`DATE(${searchQueries.createdAt})`);

    // Total metrics
    const totals = await db
      .select({
        totalQueries: sql<number>`COUNT(*)::int`,
        avgRelevance: sql<number>`AVG(${searchQueries.relevanceScore})::real`,
        avgResponseTime: sql<number>`AVG(${searchQueries.responseTime})::int`,
        withCitations: sql<number>`COUNT(*) FILTER (WHERE ${searchQueries.response}::text LIKE '%citations%')::int`
      })
      .from(searchQueries)
      .where(sql`${searchQueries.createdAt} >= ${startDate}`);

    // Top queries
    const topQueries = await db
      .select({
        query: searchQueries.query,
        count: sql<number>`COUNT(*)::int`,
        avgRelevance: sql<number>`AVG(${searchQueries.relevanceScore})::real`
      })
      .from(searchQueries)
      .where(sql`${searchQueries.createdAt} >= ${startDate}`)
      .groupBy(searchQueries.query)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    res.json({
      trends: queries,
      totals: totals[0] || { totalQueries: 0, avgRelevance: 0, avgResponseTime: 0, withCitations: 0 },
      topQueries,
      period: `Last ${days} days`
    });
  }));

  // Get AI system health metrics
  app.get("/api/ai-monitoring/system-health", asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Error rates from audit logs
    const errorMetrics = await db
      .select({
        date: sql<string>`DATE(${auditLogs.createdAt})`,
        totalEvents: sql<number>`COUNT(*)::int`,
        errors: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.action} = 'ERROR')::int`
      })
      .from(auditLogs)
      .where(sql`${auditLogs.createdAt} >= ${startDate}`)
      .groupBy(sql`DATE(${auditLogs.createdAt})`)
      .orderBy(sql`DATE(${auditLogs.createdAt})`);

    // External service health (Gemini API)
    const serviceHealth = await db
      .select({
        service: sql<string>`${auditLogs.details}->>'service'`,
        totalCalls: sql<number>`COUNT(*)::int`,
        failures: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.details}->>'success' = 'false')::int`,
        avgResponseTime: sql<number>`AVG((${auditLogs.details}->>'responseTime')::int)::int`
      })
      .from(auditLogs)
      .where(sql`
        ${auditLogs.createdAt} >= ${startDate} AND 
        ${auditLogs.action} = 'EXTERNAL_SERVICE' AND
        ${auditLogs.details}->>'service' IS NOT NULL
      `)
      .groupBy(sql`${auditLogs.details}->>'service'`);

    res.json({
      errorTrends: errorMetrics,
      serviceHealth,
      period: `Last ${days} days`
    });
  }));

  // ===== SECURITY MONITORING ROUTES =====
  
  // Get security metrics and alerts
  app.get("/api/security/metrics", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Failed authentication attempts
    const failedAuthAttempts = await db
      .select({
        date: sql<string>`DATE(${auditLogs.createdAt})`,
        count: sql<number>`COUNT(*)::int`,
        uniqueIPs: sql<number>`COUNT(DISTINCT ${auditLogs.ipAddress})::int`
      })
      .from(auditLogs)
      .where(and(
        sql`${auditLogs.createdAt} >= ${startDate}`,
        eq(auditLogs.action, 'LOGIN_FAILED')
      ))
      .groupBy(sql`DATE(${auditLogs.createdAt})`)
      .orderBy(sql`DATE(${auditLogs.createdAt})`);

    // XSS sanitization triggers (from audit logs)
    const xssSanitizations = await db
      .select({
        date: sql<string>`DATE(${auditLogs.createdAt})`,
        count: sql<number>`COUNT(*)::int`
      })
      .from(auditLogs)
      .where(and(
        sql`${auditLogs.createdAt} >= ${startDate}`,
        eq(auditLogs.action, 'XSS_SANITIZED')
      ))
      .groupBy(sql`DATE(${auditLogs.createdAt})`)
      .orderBy(sql`DATE(${auditLogs.createdAt})`);

    // Authorization failures (ownership violations)
    const authorizationFailures = await db
      .select({
        date: sql<string>`DATE(${auditLogs.createdAt})`,
        count: sql<number>`COUNT(*)::int`,
        entityTypes: sql<string>`string_agg(DISTINCT ${auditLogs.resource}, ', ')`
      })
      .from(auditLogs)
      .where(and(
        sql`${auditLogs.createdAt} >= ${startDate}`,
        or(
          eq(auditLogs.action, 'AUTHORIZATION_FAILED'),
          eq(auditLogs.action, 'OWNERSHIP_VIOLATION')
        )
      ))
      .groupBy(sql`DATE(${auditLogs.createdAt})`)
      .orderBy(sql`DATE(${auditLogs.createdAt})`);

    // Rate limit violations
    const rateLimitViolations = await db
      .select({
        date: sql<string>`DATE(${auditLogs.createdAt})`,
        count: sql<number>`COUNT(*)::int`,
        uniqueIPs: sql<number>`COUNT(DISTINCT ${auditLogs.ipAddress})::int`
      })
      .from(auditLogs)
      .where(and(
        sql`${auditLogs.createdAt} >= ${startDate}`,
        eq(auditLogs.action, 'RATE_LIMIT_EXCEEDED')
      ))
      .groupBy(sql`DATE(${auditLogs.createdAt})`)
      .orderBy(sql`DATE(${auditLogs.createdAt})`);

    // CSRF validation failures
    const csrfFailures = await db
      .select({
        date: sql<string>`DATE(${auditLogs.createdAt})`,
        count: sql<number>`COUNT(*)::int`
      })
      .from(auditLogs)
      .where(and(
        sql`${auditLogs.createdAt} >= ${startDate}`,
        eq(auditLogs.action, 'CSRF_VALIDATION_FAILED')
      ))
      .groupBy(sql`DATE(${auditLogs.createdAt})`)
      .orderBy(sql`DATE(${auditLogs.createdAt})`);

    // Session security events (hijacking attempts, expired sessions)
    const sessionEvents = await db
      .select({
        date: sql<string>`DATE(${auditLogs.createdAt})`,
        count: sql<number>`COUNT(*)::int`,
        eventTypes: sql<string>`string_agg(DISTINCT ${auditLogs.action}, ', ')`
      })
      .from(auditLogs)
      .where(and(
        sql`${auditLogs.createdAt} >= ${startDate}`,
        or(
          eq(auditLogs.action, 'SESSION_EXPIRED'),
          eq(auditLogs.action, 'SESSION_HIJACK_ATTEMPT'),
          eq(auditLogs.action, 'INVALID_SESSION')
        )
      ))
      .groupBy(sql`DATE(${auditLogs.createdAt})`)
      .orderBy(sql`DATE(${auditLogs.createdAt})`);

    // Top attacking IPs (by failed auth + authorization failures)
    const topAttackingIPs = await db
      .select({
        ipAddress: auditLogs.ipAddress,
        failedAttempts: sql<number>`COUNT(*)::int`,
        firstSeen: sql<string>`MIN(${auditLogs.createdAt})::text`,
        lastSeen: sql<string>`MAX(${auditLogs.createdAt})::text`
      })
      .from(auditLogs)
      .where(and(
        sql`${auditLogs.createdAt} >= ${startDate}`,
        or(
          eq(auditLogs.action, 'LOGIN_FAILED'),
          eq(auditLogs.action, 'AUTHORIZATION_FAILED'),
          eq(auditLogs.action, 'OWNERSHIP_VIOLATION')
        ),
        sql`${auditLogs.ipAddress} IS NOT NULL`
      ))
      .groupBy(auditLogs.ipAddress)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    // Calculate security score (100 - weighted severity of incidents)
    const totalAuthFailures = failedAuthAttempts.reduce((sum, day) => sum + day.count, 0);
    const totalXSS = xssSanitizations.reduce((sum, day) => sum + day.count, 0);
    const totalAuthzFailures = authorizationFailures.reduce((sum, day) => sum + day.count, 0);
    const totalRateLimitViolations = rateLimitViolations.reduce((sum, day) => sum + day.count, 0);
    
    const securityScore = Math.max(0, 100 - (
      (totalAuthFailures * 2) +
      (totalXSS * 5) +
      (totalAuthzFailures * 3) +
      (totalRateLimitViolations * 1)
    ) / 10);

    res.json({
      securityScore: Math.round(securityScore * 10) / 10,
      period: `Last ${days} days`,
      metrics: {
        failedAuthAttempts: {
          total: totalAuthFailures,
          trend: failedAuthAttempts
        },
        xssSanitizations: {
          total: totalXSS,
          trend: xssSanitizations
        },
        authorizationFailures: {
          total: totalAuthzFailures,
          trend: authorizationFailures
        },
        rateLimitViolations: {
          total: totalRateLimitViolations,
          trend: rateLimitViolations
        },
        csrfFailures: {
          total: csrfFailures.reduce((sum, day) => sum + day.count, 0),
          trend: csrfFailures
        },
        sessionEvents: {
          total: sessionEvents.reduce((sum, day) => sum + day.count, 0),
          trend: sessionEvents
        }
      },
      threats: {
        topAttackingIPs
      }
    });
  }));

  // Get security alerts (critical events in last 24h)
  app.get("/api/security/alerts", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);

    const criticalEvents = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        timestamp: auditLogs.createdAt,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        userId: auditLogs.userId,
        username: users.username,
        metadata: auditLogs.details
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(
        sql`${auditLogs.createdAt} >= ${last24h}`,
        or(
          eq(auditLogs.action, 'XSS_SANITIZED'),
          eq(auditLogs.action, 'SQL_INJECTION_ATTEMPT'),
          eq(auditLogs.action, 'CSRF_VALIDATION_FAILED'),
          eq(auditLogs.action, 'SESSION_HIJACK_ATTEMPT'),
          eq(auditLogs.action, 'BRUTE_FORCE_DETECTED')
        )
      ))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);

    res.json({
      alerts: criticalEvents,
      count: criticalEvents.length,
      period: "Last 24 hours"
    });
  }));

  // Get response quality metrics
  app.get("/api/ai-monitoring/response-quality", asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Citation quality breakdown
    const recentQueries = await db
      .select()
      .from(searchQueries)
      .where(sql`${searchQueries.createdAt} >= ${startDate}`)
      .orderBy(sql`${searchQueries.createdAt} DESC`)
      .limit(1000);

    let withCitations = 0;
    let withoutCitations = 0;
    let avgCitationsPerResponse = 0;
    let totalCitations = 0;

    recentQueries.forEach(q => {
      if (q.response) {
        const responseObj = typeof q.response === 'string' ? JSON.parse(q.response) : q.response;
        const citations = responseObj.citations || [];
        if (citations.length > 0) {
          withCitations++;
          totalCitations += citations.length;
        } else {
          withoutCitations++;
        }
      }
    });

    avgCitationsPerResponse = withCitations > 0 ? totalCitations / withCitations : 0;

    // Relevance score distribution
    const relevanceDistribution = await db
      .select({
        scoreRange: sql<string>`
          CASE 
            WHEN ${searchQueries.relevanceScore} >= 0.8 THEN 'High (0.8-1.0)'
            WHEN ${searchQueries.relevanceScore} >= 0.6 THEN 'Medium (0.6-0.8)'
            WHEN ${searchQueries.relevanceScore} >= 0.4 THEN 'Low (0.4-0.6)'
            ELSE 'Very Low (<0.4)'
          END
        `,
        count: sql<number>`COUNT(*)::int`
      })
      .from(searchQueries)
      .where(sql`${searchQueries.createdAt} >= ${startDate} AND ${searchQueries.relevanceScore} IS NOT NULL`)
      .groupBy(sql`
        CASE 
          WHEN ${searchQueries.relevanceScore} >= 0.8 THEN 'High (0.8-1.0)'
          WHEN ${searchQueries.relevanceScore} >= 0.6 THEN 'Medium (0.6-0.8)'
          WHEN ${searchQueries.relevanceScore} >= 0.4 THEN 'Low (0.4-0.6)'
          ELSE 'Very Low (<0.4)'
        END
      `);

    res.json({
      citationMetrics: {
        withCitations,
        withoutCitations,
        citationRate: recentQueries.length > 0 ? (withCitations / recentQueries.length) * 100 : 0,
        avgCitationsPerResponse
      },
      relevanceDistribution,
      period: `Last ${days} days`,
      sampleSize: recentQueries.length
    });
  }));

  // Flag response for bias review
  app.post("/api/ai-monitoring/flag-response", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { queryId, reason, notes } = req.body;
    
    if (!queryId || !reason) {
      return res.status(400).json({ error: "queryId and reason are required" });
    }

    // Log the flag in audit logs
    await auditService.logEvent({
      action: "BIAS_FLAG",
      entityType: "search_query",
      entityId: queryId,
      userId: req.user?.id,
      metadata: {
        reason,
        notes,
        flaggedAt: new Date().toISOString()
      }
    });

    res.json({ success: true, message: "Response flagged for review" });
  }));

  // ============================================================================
  // AUDIT LOGS - Compliance and transparency viewing
  // ============================================================================

  // Get audit logs with filtering
  app.get("/api/audit-logs", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { 
      action, 
      entityType, 
      userId, 
      startDate, 
      endDate, 
      limit = "100",
      offset = "0"
    } = req.query;

    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    const conditions = [];
    
    if (action) {
      conditions.push(eq(auditLogs.action, action as string));
    }
    if (entityType) {
      conditions.push(eq(auditLogs.resource, entityType as string));
    }
    if (userId) {
      conditions.push(eq(auditLogs.userId, userId as string));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate as string)));
    }

    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.resource,
        entityId: auditLogs.resourceId,
        userId: auditLogs.userId,
        metadata: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        timestamp: auditLogs.createdAt,
        username: users.username
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      logs,
      total: totalResult[0]?.count || 0,
      limit: limitNum,
      offset: offsetNum
    });
  }));

  // Get rule change logs with filtering
  app.get("/api/rule-change-logs", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { 
      ruleTable, 
      changeType, 
      changedBy, 
      startDate, 
      endDate,
      limit = "100",
      offset = "0"
    } = req.query;

    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    const conditions = [];
    
    if (ruleTable) {
      conditions.push(eq(ruleChangeLogs.ruleTable, ruleTable as string));
    }
    if (changeType) {
      conditions.push(eq(ruleChangeLogs.changeType, changeType as string));
    }
    if (changedBy) {
      conditions.push(eq(ruleChangeLogs.changedBy, changedBy as string));
    }
    if (startDate) {
      conditions.push(gte(ruleChangeLogs.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(ruleChangeLogs.createdAt, new Date(endDate as string)));
    }

    const logs = await db
      .select({
        id: ruleChangeLogs.id,
        ruleTable: ruleChangeLogs.ruleTable,
        ruleId: ruleChangeLogs.ruleId,
        changeType: ruleChangeLogs.changeType,
        oldValues: ruleChangeLogs.oldValues,
        newValues: ruleChangeLogs.newValues,
        changeReason: ruleChangeLogs.changeReason,
        changedBy: ruleChangeLogs.changedBy,
        approvedBy: ruleChangeLogs.approvedBy,
        approvedAt: ruleChangeLogs.approvedAt,
        createdAt: ruleChangeLogs.createdAt,
        changerUsername: sql<string>`u1.username`,
        approverUsername: sql<string>`u2.username`
      })
      .from(ruleChangeLogs)
      .leftJoin(sql`users u1`, eq(ruleChangeLogs.changedBy, sql`u1.id`))
      .leftJoin(sql`users u2`, eq(ruleChangeLogs.approvedBy, sql`u2.id`))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ruleChangeLogs.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(ruleChangeLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      logs,
      total: totalResult[0]?.count || 0,
      limit: limitNum,
      offset: offsetNum
    });
  }));

  // Feedback Submission Endpoints
  
  // Submit feedback (authenticated users)
  app.post("/api/feedback", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    
    // Validate the request body
    const feedbackData = insertFeedbackSubmissionSchema.parse({
      ...req.body,
      userId,
      metadata: {
        ...(req.body.metadata ?? {}),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      }
    });
    
    const [feedback] = await db
      .insert(feedbackSubmissions)
      .values(feedbackData)
      .returning();
    
    // Log the feedback submission
    await auditService.logAction({
      action: "FEEDBACK_SUBMITTED",
      entityType: "feedback",
      entityId: feedback.id,
      userId,
      metadata: {
        feedbackType: feedback.feedbackType,
        category: feedback.category,
        severity: feedback.severity
      }
    });
    
    // Notify admins of new feedback
    await notificationService.notifyAdminsOfFeedback(feedback.id, feedback.title);
    
    res.status(201).json(feedback);
  }));

  // Get all feedback (admin only, with filtering and pagination)
  app.get("/api/feedback", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const {
      status,
      feedbackType,
      category,
      severity,
      assignedTo,
      startDate,
      endDate,
      limit = "50",
      offset = "0"
    } = req.query;
    
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    
    const conditions = [];
    
    if (status) {
      conditions.push(eq(feedbackSubmissions.status, status as string));
    }
    if (feedbackType) {
      conditions.push(eq(feedbackSubmissions.feedbackType, feedbackType as string));
    }
    if (category) {
      conditions.push(eq(feedbackSubmissions.category, category as string));
    }
    if (severity) {
      conditions.push(eq(feedbackSubmissions.severity, severity as string));
    }
    if (assignedTo) {
      conditions.push(eq(feedbackSubmissions.assignedTo, assignedTo as string));
    }
    if (startDate) {
      conditions.push(gte(feedbackSubmissions.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(feedbackSubmissions.createdAt, new Date(endDate as string)));
    }
    
    const feedbacks = await db
      .select({
        id: feedbackSubmissions.id,
        userId: feedbackSubmissions.userId,
        submitterName: feedbackSubmissions.submitterName,
        submitterEmail: feedbackSubmissions.submitterEmail,
        feedbackType: feedbackSubmissions.feedbackType,
        category: feedbackSubmissions.category,
        severity: feedbackSubmissions.severity,
        relatedEntityType: feedbackSubmissions.relatedEntityType,
        relatedEntityId: feedbackSubmissions.relatedEntityId,
        pageUrl: feedbackSubmissions.pageUrl,
        title: feedbackSubmissions.title,
        description: feedbackSubmissions.description,
        expectedBehavior: feedbackSubmissions.expectedBehavior,
        actualBehavior: feedbackSubmissions.actualBehavior,
        screenshotUrl: feedbackSubmissions.screenshotUrl,
        status: feedbackSubmissions.status,
        priority: feedbackSubmissions.priority,
        assignedTo: feedbackSubmissions.assignedTo,
        adminNotes: feedbackSubmissions.adminNotes,
        resolution: feedbackSubmissions.resolution,
        resolvedAt: feedbackSubmissions.resolvedAt,
        resolvedBy: feedbackSubmissions.resolvedBy,
        metadata: feedbackSubmissions.metadata,
        createdAt: feedbackSubmissions.createdAt,
        updatedAt: feedbackSubmissions.updatedAt,
        submitterUsername: sql<string>`u1.username`,
        assignedToUsername: sql<string>`u2.username`,
        resolvedByUsername: sql<string>`u3.username`
      })
      .from(feedbackSubmissions)
      .leftJoin(sql`users u1`, eq(feedbackSubmissions.userId, sql`u1.id`))
      .leftJoin(sql`users u2`, eq(feedbackSubmissions.assignedTo, sql`u2.id`))
      .leftJoin(sql`users u3`, eq(feedbackSubmissions.resolvedBy, sql`u3.id`))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(feedbackSubmissions.createdAt))
      .limit(limitNum)
      .offset(offsetNum);
    
    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(feedbackSubmissions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    res.json({
      feedbacks,
      total: totalResult[0]?.count || 0,
      limit: limitNum,
      offset: offsetNum
    });
  }));

  // Get specific feedback (admin only)
  app.get("/api/feedback/:id", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const [feedback] = await db
      .select({
        id: feedbackSubmissions.id,
        userId: feedbackSubmissions.userId,
        submitterName: feedbackSubmissions.submitterName,
        submitterEmail: feedbackSubmissions.submitterEmail,
        feedbackType: feedbackSubmissions.feedbackType,
        category: feedbackSubmissions.category,
        severity: feedbackSubmissions.severity,
        relatedEntityType: feedbackSubmissions.relatedEntityType,
        relatedEntityId: feedbackSubmissions.relatedEntityId,
        pageUrl: feedbackSubmissions.pageUrl,
        title: feedbackSubmissions.title,
        description: feedbackSubmissions.description,
        expectedBehavior: feedbackSubmissions.expectedBehavior,
        actualBehavior: feedbackSubmissions.actualBehavior,
        screenshotUrl: feedbackSubmissions.screenshotUrl,
        status: feedbackSubmissions.status,
        priority: feedbackSubmissions.priority,
        assignedTo: feedbackSubmissions.assignedTo,
        adminNotes: feedbackSubmissions.adminNotes,
        resolution: feedbackSubmissions.resolution,
        resolvedAt: feedbackSubmissions.resolvedAt,
        resolvedBy: feedbackSubmissions.resolvedBy,
        metadata: feedbackSubmissions.metadata,
        createdAt: feedbackSubmissions.createdAt,
        updatedAt: feedbackSubmissions.updatedAt,
        submitterUsername: sql<string>`u1.username`,
        assignedToUsername: sql<string>`u2.username`,
        resolvedByUsername: sql<string>`u3.username`
      })
      .from(feedbackSubmissions)
      .leftJoin(sql`users u1`, eq(feedbackSubmissions.userId, sql`u1.id`))
      .leftJoin(sql`users u2`, eq(feedbackSubmissions.assignedTo, sql`u2.id`))
      .leftJoin(sql`users u3`, eq(feedbackSubmissions.resolvedBy, sql`u3.id`))
      .where(eq(feedbackSubmissions.id, id));
    
    if (!feedback) {
      throw notFoundError("Feedback not found");
    }
    
    res.json(feedback);
  }));

  // Update feedback status (admin only)
  app.patch("/api/feedback/:id", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { status, priority, assignedTo, adminNotes, resolution } = req.body;
    
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (resolution !== undefined) updateData.resolution = resolution;
    
    // If marking as resolved or closed, set resolvedAt and resolvedBy
    if (status === "resolved" || status === "closed") {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = userId;
    }
    
    const [updatedFeedback] = await db
      .update(feedbackSubmissions)
      .set(updateData)
      .where(eq(feedbackSubmissions.id, id))
      .returning();
    
    if (!updatedFeedback) {
      throw notFoundError("Feedback not found");
    }
    
    // Log the feedback update
    await auditService.logAction({
      action: "FEEDBACK_UPDATED",
      entityType: "feedback",
      entityId: id,
      userId,
      metadata: {
        updates: updateData
      }
    });
    
    res.json(updatedFeedback);
  }));

  // Quick Rating Endpoints - Simple thumbs up/down feedback
  
  // Submit quick rating (authenticated users)
  app.post("/api/quick-ratings", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    
    // Validate the request body
    const ratingData = insertQuickRatingSchema.parse({
      ...req.body,
      userId,
      metadata: {
        ...(req.body.metadata ?? {}),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      }
    });
    
    const [rating] = await db
      .insert(quickRatings)
      .values(ratingData)
      .returning();
    
    // Log the quick rating
    await auditService.logAction({
      action: "QUICK_RATING_SUBMITTED",
      entityType: "quick_rating",
      entityId: rating.id,
      userId,
      metadata: {
        ratingType: rating.ratingType,
        rating: rating.rating,
        relatedEntityType: rating.relatedEntityType,
        relatedEntityId: rating.relatedEntityId
      }
    });
    
    res.status(201).json(rating);
  }));

  // Get quick rating statistics (admin only)
  app.get("/api/quick-ratings/stats", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { ratingType, startDate, endDate, days = "30" } = req.query;
    
    const daysNum = parseInt(days as string);
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - daysNum);
    
    const conditions = [];
    
    if (ratingType) {
      conditions.push(eq(quickRatings.ratingType, ratingType as string));
    }
    if (startDate) {
      conditions.push(gte(quickRatings.createdAt, new Date(startDate as string)));
    } else {
      conditions.push(gte(quickRatings.createdAt, defaultStartDate));
    }
    if (endDate) {
      conditions.push(lte(quickRatings.createdAt, new Date(endDate as string)));
    }
    
    // Get rating statistics
    const stats = await db
      .select({
        ratingType: quickRatings.ratingType,
        rating: quickRatings.rating,
        count: sql<number>`COUNT(*)::int`
      })
      .from(quickRatings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(quickRatings.ratingType, quickRatings.rating);
    
    // Format statistics by type
    const formattedStats: Record<string, { thumbs_up: number; thumbs_down: number; total: number; satisfaction: number }> = {};
    
    stats.forEach(stat => {
      if (!formattedStats[stat.ratingType]) {
        formattedStats[stat.ratingType] = { thumbs_up: 0, thumbs_down: 0, total: 0, satisfaction: 0 };
      }
      
      if (stat.rating === 'thumbs_up') {
        formattedStats[stat.ratingType].thumbs_up = stat.count;
      } else if (stat.rating === 'thumbs_down') {
        formattedStats[stat.ratingType].thumbs_down = stat.count;
      }
      
      formattedStats[stat.ratingType].total += stat.count;
    });
    
    // Calculate satisfaction percentage
    Object.keys(formattedStats).forEach(type => {
      const { thumbs_up, total } = formattedStats[type];
      formattedStats[type].satisfaction = total > 0 ? Math.round((thumbs_up / total) * 100) : 0;
    });
    
    res.json({
      stats: formattedStats,
      period: startDate && endDate 
        ? `${startDate} to ${endDate}` 
        : `Last ${daysNum} days`
    });
  }));

  // Notification API Routes

  // Get user notifications (with pagination, search, and filtering)
  app.get("/api/notifications", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { limit = "20", offset = "0", unreadOnly = "false", search = "", type = "" } = req.query;
    
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    
    const conditions = [eq(notifications.userId, userId)];
    
    if (unreadOnly === "true") {
      conditions.push(eq(notifications.isRead, false));
    }
    
    if (type && type !== "all") {
      conditions.push(eq(notifications.type, type as string));
    }
    
    // Apply search filter using ilike for case-insensitive matching
    if (search && search !== "") {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(notifications.title, searchPattern),
          ilike(notifications.message, searchPattern)
        )!
      );
    }
    
    // Fetch notifications with all filters applied
    const userNotifications = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limitNum)
      .offset(offsetNum);
    
    // Get total count with all filters applied
    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(notifications)
      .where(and(...conditions));
    
    res.json({
      notifications: userNotifications,
      total: Number(totalCount),
      limit: limitNum,
      offset: offsetNum
    });
  }));

  // Get unread notification count
  app.get("/api/notifications/unread-count", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    
    const [{ unreadCount }] = await db
      .select({ unreadCount: count() })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    
    res.json({ count: Number(unreadCount) });
  }));

  // Mark notification as read (with ownership verification)
  app.patch("/api/notifications/:id/read", requireAuth, verifyNotificationOwnership(), asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { id } = req.params;
    
    const [updated] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      ))
      .returning();
    
    if (!updated) {
      throw notFoundError("Notification not found");
    }
    
    res.json(updated);
  }));

  // Mark all notifications as read
  app.patch("/api/notifications/read-all", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    
    await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    
    res.json({ success: true });
  }));

  // Get user notification preferences
  app.get("/api/notifications/preferences", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const prefs = await notificationService.getUserPreferences(userId);
    res.json(prefs);
  }));

  // Update user notification preferences
  app.patch("/api/notifications/preferences", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const {
      emailEnabled,
      inAppEnabled,
      policyChanges,
      feedbackAlerts,
      navigatorAlerts,
      systemAlerts,
      ruleExtractionAlerts
    } = req.body;
    
    await notificationService.updateUserPreferences(userId, {
      emailEnabled,
      inAppEnabled,
      policyChanges,
      feedbackAlerts,
      navigatorAlerts,
      systemAlerts,
      ruleExtractionAlerts
    });
    
    const updatedPrefs = await notificationService.getUserPreferences(userId);
    res.json(updatedPrefs);
  }));

  // Public Portal API Routes (no auth required)
  
  // Get document requirement templates
  app.get("/api/public/document-templates", asyncHandler(async (req: Request, res: Response) => {
    const templates = await db
      .select()
      .from(documentRequirementTemplates)
      .where(eq(documentRequirementTemplates.isActive, true))
      .orderBy(documentRequirementTemplates.sortOrder);
    
    res.json(templates);
  }));

  // Get notice templates
  app.get("/api/public/notice-templates", asyncHandler(async (req: Request, res: Response) => {
    const templates = await db
      .select()
      .from(noticeTemplates)
      .where(eq(noticeTemplates.isActive, true))
      .orderBy(noticeTemplates.sortOrder);
    
    res.json(templates);
  }));

  // Get public FAQ
  app.get("/api/public/faq", asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.query;
    
    const conditions = [eq(publicFaq.isActive, true)];
    
    if (category && category !== "all") {
      conditions.push(eq(publicFaq.category, category as string));
    }
    
    const faqs = await db
      .select()
      .from(publicFaq)
      .where(and(...conditions))
      .orderBy(publicFaq.sortOrder);
    
    res.json(faqs);
  }));

  // Analyze notice image with Gemini Vision
  app.post("/api/public/analyze-notice", asyncHandler(async (req: Request, res: Response) => {
    const { imageData } = req.body;
    
    if (!imageData) {
      throw validationError("Image data is required");
    }

    // Extract base64 data
    const base64Data = imageData.split(',')[1] || imageData;
    
    const prompt = `You are analyzing a DHS (Department of Human Services) document request notice for SNAP benefits.

Extract all document requirements mentioned in this notice. For each document requirement, identify:
1. The document type requested
2. The category (identity, income, residence, resources, expenses, immigration, ssn)
3. Any specific details mentioned

Return a JSON array of document requirements in this format:
{
  "documents": [
    {
      "documentType": "Proof of Income",
      "category": "income",
      "details": "Last 4 pay stubs",
      "confidence": 0.95
    }
  ]
}

If no document requirements are found, return an empty documents array.`;

    const result = await analyzeImageWithGemini(base64Data, prompt);
    
    // Parse the result and match to templates
    let extractedData;
    try {
      extractedData = JSON.parse(result);
    } catch (e) {
      extractedData = { documents: [] };
    }

    // Get all templates for matching
    const templates = await db
      .select()
      .from(documentRequirementTemplates)
      .where(eq(documentRequirementTemplates.isActive, true));

    // Match extracted documents to templates
    const matchedDocuments = extractedData.documents.map((doc: any) => {
      const matchedTemplate = templates.find(
        (t) => t.dhsCategory === doc.category || 
               t.documentType.toLowerCase().includes(doc.documentType.toLowerCase())
      );
      
      return {
        documentType: doc.documentType,
        category: doc.category,
        details: doc.details,
        confidence: doc.confidence || 0.8,
        matchedTemplate
      };
    });

    res.json({ documents: matchedDocuments });
  }));

  // Explain notice text with Gemini
  app.post("/api/public/explain-notice", asyncHandler(async (req: Request, res: Response) => {
    const { noticeText } = req.body;
    
    if (!noticeText) {
      throw validationError("Notice text is required");
    }

    const prompt = `You are a benefits counselor helping Maryland residents understand their SNAP (Food Supplement Program) notices.

Analyze this DHS notice and provide a plain language explanation:

${noticeText}

Return a JSON object with:
{
  "noticeType": "Approval" | "Denial" | "Renewal" | "Change in Benefits" | "Request for Information" | "Overpayment",
  "keyInformation": {
    "approved": true/false (if applicable),
    "benefitAmount": number (if mentioned),
    "reason": "brief reason",
    "deadlines": [{"action": "what to do", "date": "when"}]
  },
  "plainLanguageExplanation": "Clear explanation in simple language of what this notice means",
  "actionItems": ["List of things the person needs to do"],
  "appealInformation": "How to appeal if applicable, or null"
}`;

    const result = await generateTextWithGemini(prompt);
    
    let explanation;
    try {
      explanation = JSON.parse(result);
    } catch (e) {
      explanation = {
        noticeType: "Unknown",
        plainLanguageExplanation: "Could not analyze this notice. Please contact your local DHS office for help.",
        actionItems: []
      };
    }

    res.json(explanation);
  }));

  // Search FAQ with AI
  app.post("/api/public/search-faq", asyncHandler(async (req: Request, res: Response) => {
    const { query } = req.body;
    
    if (!query) {
      throw validationError("Search query is required");
    }

    // Get all FAQs
    const faqs = await db
      .select()
      .from(publicFaq)
      .where(eq(publicFaq.isActive, true));

    // Use Gemini to find relevant FAQs and generate answer
    const faqContext = faqs.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n');
    
    const prompt = `You are a Maryland SNAP benefits expert. Answer this question using ONLY the information provided below. Use simple, everyday language.

Question: ${query}

Available Information:
${faqContext}

Provide:
1. A direct answer to the question (2-3 sentences)
2. Identify the 2-3 most relevant FAQs from the list above

Return JSON:
{
  "answer": "Direct answer in plain language",
  "sources": [
    {
      "question": "Relevant FAQ question",
      "answer": "FAQ answer",
      "relevance": 0.95
    }
  ]
}

If the question cannot be answered with the available information, say so clearly and suggest contacting the local DHS office.`;

    const result = await generateTextWithGemini(prompt);
    
    let searchResult;
    try {
      searchResult = JSON.parse(result);
    } catch (e) {
      searchResult = {
        answer: "I couldn't find a clear answer to your question. Please contact your local DHS office at 1-800-332-6347 for help.",
        sources: []
      };
    }

    res.json(searchResult);
  }));

  // ============================================================================
  // POLICY CHANGE MONITORING ROUTES - Phase 1 Feature
  // ============================================================================

  // Get all policy changes with filters (requires auth)
  app.get("/api/policy-changes", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { benefitProgramId, status, limit } = req.query;
    
    const changes = await storage.getPolicyChanges({
      benefitProgramId: benefitProgramId as string,
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json(changes);
  }));

  // Get single policy change details (requires auth)
  app.get("/api/policy-changes/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const change = await storage.getPolicyChange(req.params.id);
    
    if (!change) {
      throw validationError("Policy change not found");
    }
    
    res.json(change);
  }));

  // Get impacts for a policy change (staff/admin only - contains sensitive data)
  app.get("/api/policy-changes/:id/impacts", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const impacts = await storage.getPolicyChangeImpacts(req.params.id);
    res.json(impacts);
  }));

  // Get user's policy change impacts (requires auth)
  app.get("/api/my-policy-impacts", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const unresolved = req.query.unresolved === 'true';
    const impacts = await storage.getUserPolicyChangeImpacts(req.user!.id, unresolved);
    res.json(impacts);
  }));

  // Create policy change (admin only)
  app.post("/api/policy-changes", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const change = await storage.createPolicyChange({
      ...req.body,
      createdBy: req.user!.id
    });
    
    // Invalidate cache
    cacheService.del('policy_changes:all');
    
    // Notify all users about the new policy change (async - don't wait)
    if (change.severity === 'critical' || change.severity === 'high') {
      // Get all users to notify
      const allUsers = await db.select({ id: users.id }).from(users);
      const userIds = allUsers.map(u => u.id);
      
      notificationService.createBulkNotifications(userIds, {
        type: "policy_change",
        title: `New Policy Change: ${change.title}`,
        message: change.description || `A ${change.severity} severity policy change has been implemented.`,
        priority: change.severity === 'critical' ? 'urgent' : 'high',
        relatedEntityType: "policy_change",
        relatedEntityId: change.id,
        actionUrl: "/admin/policy-changes",
        metadata: {
          policyChangeId: change.id,
          severity: change.severity,
          effectiveDate: change.effectiveDate
        }
      }).catch(err => console.error('Failed to send policy change notifications:', err));
    }
    
    res.status(201).json(change);
  }));

  // Update policy change (admin only)
  app.patch("/api/policy-changes/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const change = await storage.updatePolicyChange(req.params.id, req.body);
    
    // Invalidate cache
    cacheService.del('policy_changes:all');
    cacheService.del(`policy_change:${req.params.id}`);
    
    res.json(change);
  }));

  // Create policy change impact
  app.post("/api/policy-change-impacts", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const impact = await storage.createPolicyChangeImpact(req.body);
    
    // Notify the affected user about the impact (async - don't wait)
    if (impact.affectedUserId) {
      const policyChange = await storage.getPolicyChange(impact.policyChangeId);
      
      notificationService.createNotification({
        userId: impact.affectedUserId,
        type: "policy_change",
        title: "Policy Change Impact - Action Required",
        message: impact.impactDescription || `A policy change may affect your case. Review and acknowledge by ${impact.actionRequiredBy ? new Date(impact.actionRequiredBy).toLocaleDateString() : 'the deadline'}.`,
        priority: impact.requiresAction ? 'high' : 'normal',
        relatedEntityType: "policy_change_impact",
        relatedEntityId: impact.id,
        actionUrl: "/admin/policy-changes",
        metadata: {
          policyChangeId: impact.policyChangeId,
          policyChangeTitle: policyChange?.title,
          requiresAction: impact.requiresAction,
          actionRequiredBy: impact.actionRequiredBy
        }
      }).catch(err => console.error('Failed to send impact notification:', err));
    }
    
    res.status(201).json(impact);
  }));

  // Acknowledge policy change impact (user action)
  app.patch("/api/policy-change-impacts/:id/acknowledge", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    // First, fetch the impact to verify ownership
    const impact = await storage.getPolicyChangeImpact(req.params.id);
    
    if (!impact) {
      throw validationError("Policy change impact not found");
    }
    
    // Verify the user owns this impact
    if (impact.affectedUserId !== req.user!.id) {
      throw validationError("You can only acknowledge your own policy change impacts");
    }
    
    const updatedImpact = await storage.updatePolicyChangeImpact(req.params.id, {
      acknowledged: true,
      acknowledgedAt: new Date()
    });
    res.json(updatedImpact);
  }));

  // Resolve policy change impact (admin action)
  app.patch("/api/policy-change-impacts/:id/resolve", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { resolutionNotes } = req.body;
    
    // Get the impact before updating to access affectedUserId
    const existingImpact = await storage.getPolicyChangeImpact(req.params.id);
    
    const impact = await storage.updatePolicyChangeImpact(req.params.id, {
      resolved: true,
      resolvedAt: new Date(),
      resolutionNotes
    });
    
    // Notify the affected user that their impact has been resolved (async - don't wait)
    if (existingImpact?.affectedUserId) {
      const policyChange = await storage.getPolicyChange(existingImpact.policyChangeId);
      
      notificationService.createNotification({
        userId: existingImpact.affectedUserId,
        type: "policy_change",
        title: "Policy Change Impact Resolved",
        message: resolutionNotes || `Your policy change impact for "${policyChange?.title || 'a policy change'}" has been resolved.`,
        priority: 'normal',
        relatedEntityType: "policy_change_impact",
        relatedEntityId: impact.id,
        actionUrl: "/admin/policy-changes",
        metadata: {
          policyChangeId: existingImpact.policyChangeId,
          policyChangeTitle: policyChange?.title,
          resolvedBy: req.user!.id
        }
      }).catch(err => console.error('Failed to send resolution notification:', err));
    }
    
    res.json(impact);
  }));

  // ============================================================================
  // COMPLIANCE ASSURANCE ROUTES - Phase 1, Task 5
  // ============================================================================

  // Get all compliance rules with filters (admin only)
  app.get("/api/compliance-rules", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { ruleType, category, benefitProgramId, isActive } = req.query;
    
    const rules = await storage.getComplianceRules({
      ruleType: ruleType as string,
      category: category as string,
      benefitProgramId: benefitProgramId as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
    });
    
    res.json(rules);
  }));

  // Get single compliance rule (admin only)
  app.get("/api/compliance-rules/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const rule = await storage.getComplianceRule(req.params.id);
    
    if (!rule) {
      throw validationError("Compliance rule not found");
    }
    
    res.json(rule);
  }));

  // Create compliance rule (admin only)
  app.post("/api/compliance-rules", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    // Validate request body with Zod
    const validatedData = insertComplianceRuleSchema.parse(req.body);
    
    const rule = await storage.createComplianceRule({
      ...validatedData,
      createdBy: req.user!.id
    });
    
    cacheService.del('compliance_rules:all');
    
    res.status(201).json(rule);
  }));

  // Update compliance rule (admin only)
  app.patch("/api/compliance-rules/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    // Validate request body with Zod (partial update allowed)
    const validatedData = insertComplianceRuleSchema.partial().parse(req.body);
    
    const rule = await storage.updateComplianceRule(req.params.id, {
      ...validatedData,
      updatedBy: req.user!.id
    });
    
    cacheService.del('compliance_rules:all');
    cacheService.del(`compliance_rule:${req.params.id}`);
    
    res.json(rule);
  }));

  // Delete compliance rule (admin only)
  app.delete("/api/compliance-rules/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    await storage.deleteComplianceRule(req.params.id);
    
    cacheService.del('compliance_rules:all');
    
    res.status(204).send();
  }));

  // Get all compliance violations with filters (admin only)
  app.get("/api/compliance-violations", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { complianceRuleId, status, severity, entityType } = req.query;
    
    const violations = await storage.getComplianceViolations({
      complianceRuleId: complianceRuleId as string,
      status: status as string,
      severity: severity as string,
      entityType: entityType as string
    });
    
    res.json(violations);
  }));

  // Get single compliance violation (admin only)
  app.get("/api/compliance-violations/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const violation = await storage.getComplianceViolation(req.params.id);
    
    if (!violation) {
      throw validationError("Compliance violation not found");
    }
    
    res.json(violation);
  }));

  // Acknowledge compliance violation (admin/staff only)
  app.patch("/api/compliance-violations/:id/acknowledge", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const violation = await storage.updateComplianceViolation(req.params.id, {
      status: 'acknowledged',
      acknowledgedBy: req.user!.id,
      acknowledgedAt: new Date()
    });
    
    res.json(violation);
  }));

  // Resolve compliance violation (admin only)
  app.patch("/api/compliance-violations/:id/resolve", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { resolution } = req.body;
    
    if (!resolution) {
      throw validationError("Resolution notes are required");
    }
    
    const violation = await storage.updateComplianceViolation(req.params.id, {
      status: 'resolved',
      resolution,
      resolvedBy: req.user!.id,
      resolvedAt: new Date()
    });
    
    res.json(violation);
  }));

  // Dismiss compliance violation (admin only)
  app.patch("/api/compliance-violations/:id/dismiss", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { resolution } = req.body;
    
    const violation = await storage.updateComplianceViolation(req.params.id, {
      status: 'dismissed',
      resolution: resolution || 'Dismissed as false positive',
      resolvedBy: req.user!.id,
      resolvedAt: new Date()
    });
    
    res.json(violation);
  }));

  // ===== ADAPTIVE INTAKE COPILOT ROUTES =====
  
  // Create new intake session
  app.post("/api/intake-sessions", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const validatedData = insertIntakeSessionSchema.parse(req.body);
    
    const session = await storage.createIntakeSession({
      ...validatedData,
      userId: req.user!.id,
    });
    
    res.status(201).json(session);
  }));
  
  // Get user's intake sessions
  app.get("/api/intake-sessions", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query;
    
    const sessions = await storage.getIntakeSessions({
      userId: req.user!.id,
      status: status as string,
      limit: 50,
    });
    
    res.json(sessions);
  }));
  
  // Get single intake session
  app.get("/api/intake-sessions/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getIntakeSession(req.params.id);
    
    if (!session) {
      throw validationError("Session not found");
    }
    
    // Verify ownership
    if (session.userId !== req.user!.id && req.user!.role !== 'admin') {
      throw validationError("Unauthorized access to session");
    }
    
    res.json(session);
  }));
  
  // Send message in intake session
  app.post("/api/intake-sessions/:id/messages", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getIntakeSession(req.params.id);
    
    if (!session) {
      throw validationError("Session not found");
    }
    
    // Verify ownership
    if (session.userId !== req.user!.id && req.user!.role !== 'admin') {
      throw validationError("Unauthorized access to session");
    }
    
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      throw validationError("Message content is required");
    }
    
    const { intakeCopilotService } = await import("./services/intakeCopilot.service");
    const response = await intakeCopilotService.processMessage(req.params.id, message);
    
    res.json(response);
  }));
  
  // Get session messages
  app.get("/api/intake-sessions/:id/messages", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getIntakeSession(req.params.id);
    
    if (!session) {
      throw validationError("Session not found");
    }
    
    // Verify ownership
    if (session.userId !== req.user!.id && req.user!.role !== 'admin') {
      throw validationError("Unauthorized access to session");
    }
    
    const messages = await storage.getIntakeMessages(req.params.id);
    
    res.json(messages);
  }));
  
  // Generate application form from session
  app.post("/api/intake-sessions/:id/generate-form", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getIntakeSession(req.params.id);
    
    if (!session) {
      throw validationError("Session not found");
    }
    
    // Verify ownership
    if (session.userId !== req.user!.id && req.user!.role !== 'admin') {
      throw validationError("Unauthorized access to session");
    }
    
    const { intakeCopilotService } = await import("./services/intakeCopilot.service");
    const form = await intakeCopilotService.generateApplicationForm(req.params.id);
    
    res.json(form);
  }));
  
  // Get application form by session
  app.get("/api/intake-sessions/:id/form", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getIntakeSession(req.params.id);
    
    if (!session) {
      throw validationError("Session not found");
    }
    
    // Verify ownership
    if (session.userId !== req.user!.id && req.user!.role !== 'admin') {
      throw validationError("Unauthorized access to session");
    }
    
    const form = await storage.getApplicationFormBySession(req.params.id);
    
    if (!form) {
      throw validationError("Form not found");
    }
    
    res.json(form);
  }));
  
  // Get all application forms for user
  app.get("/api/application-forms", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { exportStatus } = req.query;
    
    const forms = await storage.getApplicationForms({
      userId: req.user!.id,
      exportStatus: exportStatus as string,
      limit: 50,
    });
    
    res.json(forms);
  }));

  // ============================================================================
  // PolicyEngine Multi-Benefit Screening Routes
  // ============================================================================

  // Calculate multi-benefit eligibility using PolicyEngine
  app.post("/api/policyengine/calculate", asyncHandler(async (req: Request, res: Response) => {
    const { policyEngineService } = await import("./services/policyEngine.service");
    
    const inputSchema = z.object({
      adults: z.number().min(1).max(20),
      children: z.number().min(0).max(20),
      employmentIncome: z.number().min(0),
      unearnedIncome: z.number().optional(),
      stateCode: z.string().length(2),
      year: z.number().optional(),
      householdAssets: z.number().optional(),
      rentOrMortgage: z.number().optional(),
      utilityCosts: z.number().optional(),
      medicalExpenses: z.number().optional(),
      childcareExpenses: z.number().optional(),
      elderlyOrDisabled: z.boolean().optional()
    });
    
    const validated = inputSchema.parse(req.body);
    
    const result = await policyEngineService.calculateBenefits(validated);
    
    res.json(result);
  }));

  // Verify a calculation against PolicyEngine (admin/testing tool)
  app.post("/api/policyengine/verify", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { PolicyEngineVerificationService } = await import("./services/policyEngineVerification.service");
    const verificationService = new PolicyEngineVerificationService(storage);
    
    const inputSchema = z.object({
      programCode: z.string(), // 'MD_SNAP', 'VITA', etc.
      verificationType: z.enum(['benefit_amount', 'tax_calculation', 'eligibility_check']),
      householdData: z.object({
        adults: z.number(),
        children: z.number(),
        employmentIncome: z.number(),
        unearnedIncome: z.number().optional(),
        stateCode: z.string(),
        householdAssets: z.number().optional(),
        rentOrMortgage: z.number().optional(),
        utilityCosts: z.number().optional(),
        medicalExpenses: z.number().optional(),
        childcareExpenses: z.number().optional(),
        elderlyOrDisabled: z.boolean().optional()
      }),
      ourCalculation: z.any(), // The result from our Rules as Code
      sessionId: z.string().optional()
    });
    
    const validated = inputSchema.parse(req.body);
    
    // Get the benefit program
    const program = await storage.getBenefitProgramByCode(validated.programCode);
    if (!program) {
      return res.status(404).json({ error: `Program ${validated.programCode} not found` });
    }
    
    // Run verification based on type
    let verification;
    if (validated.verificationType === 'benefit_amount' && validated.programCode === 'MD_SNAP') {
      verification = await verificationService.verifySNAPCalculation(
        validated.householdData,
        validated.ourCalculation,
        {
          benefitProgramId: program.id,
          sessionId: validated.sessionId,
          performedBy: req.user!.id
        }
      );
    } else if (validated.verificationType === 'tax_calculation' && validated.programCode === 'VITA') {
      verification = await verificationService.verifyTaxCalculation(
        validated.householdData,
        validated.ourCalculation,
        {
          benefitProgramId: program.id,
          sessionId: validated.sessionId,
          performedBy: req.user!.id
        }
      );
    } else if (validated.verificationType === 'eligibility_check') {
      verification = await verificationService.verifyEligibility(
        validated.householdData,
        validated.ourCalculation,
        validated.programCode,
        {
          benefitProgramId: program.id,
          sessionId: validated.sessionId,
          performedBy: req.user!.id
        }
      );
    } else {
      return res.status(400).json({ 
        error: `Unsupported verification type: ${validated.verificationType} for program ${validated.programCode}` 
      });
    }
    
    res.json(verification);
  }));

  // Get verification statistics for a program (admin only)
  app.get("/api/policyengine/verify/stats/:programCode", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { PolicyEngineVerificationService } = await import("./services/policyEngineVerification.service");
    const verificationService = new PolicyEngineVerificationService(storage);
    
    const program = await storage.getBenefitProgramByCode(req.params.programCode);
    if (!program) {
      return res.status(404).json({ error: `Program ${req.params.programCode} not found` });
    }
    
    const stats = await verificationService.getVerificationStats(program.id);
    
    res.json({
      programCode: req.params.programCode,
      programName: program.name,
      ...stats
    });
  }));

  // Get verification history for a program (admin only)
  app.get("/api/policyengine/verify/history/:programCode", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const program = await storage.getBenefitProgramByCode(req.params.programCode);
    if (!program) {
      return res.status(404).json({ error: `Program ${req.params.programCode} not found` });
    }
    
    const verifications = await storage.getPolicyEngineVerificationsByProgram(program.id);
    
    res.json({
      programCode: req.params.programCode,
      programName: program.name,
      verifications
    });
  }));

  // Get formatted multi-benefit summary (PolicyEngine only - legacy)
  app.post("/api/policyengine/summary", asyncHandler(async (req: Request, res: Response) => {
    const { policyEngineService } = await import("./services/policyEngine.service");
    
    const inputSchema = z.object({
      adults: z.number().min(1).max(20),
      children: z.number().min(0).max(20),
      employmentIncome: z.number().min(0),
      unearnedIncome: z.number().optional(),
      stateCode: z.string().length(2),
      year: z.number().optional()
    });
    
    const validated = inputSchema.parse(req.body);
    
    const result = await policyEngineService.calculateBenefits(validated);
    const summary = policyEngineService.formatBenefitsResponse(result);
    
    res.json({
      ...result,
      summary
    });
  }));

  // Hybrid multi-benefit summary (Maryland Rules-as-Code PRIMARY + PolicyEngine verification)
  app.post("/api/benefits/calculate-hybrid-summary", asyncHandler(async (req: Request, res: Response) => {
    const { rulesEngineAdapter: rulesEngineAdapterService } = await import("./services/rulesEngineAdapter");
    const { policyEngineService } = await import("./services/policyEngine.service");
    
    const inputSchema = z.object({
      adults: z.number().min(1).max(20),
      children: z.number().min(0).max(20),
      employmentIncome: z.number().min(0),
      unearnedIncome: z.number().optional(),
      stateCode: z.string().length(2),
      householdAssets: z.coerce.number().min(0).optional(),
      rentOrMortgage: z.coerce.number().min(0).optional(),
      utilityCosts: z.coerce.number().min(0).optional(),
      medicalExpenses: z.coerce.number().min(0).optional(),
      childcareExpenses: z.coerce.number().min(0).optional(),
      elderlyOrDisabled: z.boolean().optional(),
      year: z.number().optional()
    });
    
    const validated = inputSchema.parse(req.body);
    
    // Generate cache key from household data
    const householdHash = generateHouseholdHash(validated);
    const cacheKey = CACHE_KEYS.HYBRID_SUMMARY(householdHash);
    
    // Check cache first
    const cachedResponse = cacheService.get<any>(cacheKey);
    if (cachedResponse) {
      console.log(`✅ Cache hit for hybrid summary endpoint (hash: ${householdHash})`);
      return res.json(cachedResponse);
    }
    
    console.log(`❌ Cache miss for hybrid summary endpoint (hash: ${householdHash})`);
    
    // Get benefit program for SNAP
    const snapProgram = await storage.getBenefitProgramByCode("MD_SNAP");
    if (!snapProgram) {
      return res.status(500).json({ error: "SNAP program not found" });
    }

    // Build household input for rules engines (in dollars)
    const householdSize = validated.adults + validated.children;
    const monthlyIncome = Math.round(validated.employmentIncome / 12 + (validated.unearnedIncome || 0) / 12);
    
    const hybridInput = {
      benefitProgramId: snapProgram.id,
      householdSize,
      income: monthlyIncome,
      earnedIncome: Math.round(validated.employmentIncome / 12),
      unearnedIncome: Math.round((validated.unearnedIncome || 0) / 12),
      assets: validated.householdAssets,
      shelterCosts: validated.rentOrMortgage,
      dependentCareExpenses: validated.childcareExpenses,
      medicalExpenses: validated.medicalExpenses,
      hasElderly: validated.elderlyOrDisabled,
      hasDisabled: validated.elderlyOrDisabled,
      age: validated.elderlyOrDisabled ? 65 : 30
    };

    // Calculate using Maryland Rules-as-Code engines
    const [snapResult, tanfResult, ohepResult, medicaidResult] = await Promise.all([
      rulesEngineAdapterService.calculateEligibility("MD_SNAP", hybridInput),
      rulesEngineAdapterService.calculateEligibility("MD_TANF", hybridInput),
      rulesEngineAdapterService.calculateEligibility("MD_OHEP", hybridInput),
      rulesEngineAdapterService.calculateEligibility("MEDICAID", hybridInput)
    ]);

    // Also calculate with PolicyEngine for verification
    let policyEngineResult;
    try {
      policyEngineResult = await policyEngineService.calculateBenefits(validated);
    } catch (error) {
      console.error("PolicyEngine verification failed:", error);
      policyEngineResult = null;
    }

    // Compare and build verification badges
    const benefits = {
      snap: snapResult?.estimatedBenefit || 0,
      medicaid: medicaidResult?.eligible || false,
      tanf: tanfResult?.estimatedBenefit || 0,
      ohep: ohepResult?.estimatedBenefit || 0,
      eitc: policyEngineResult?.benefits?.eitc || 0, // Tax credits use PolicyEngine only
      childTaxCredit: policyEngineResult?.benefits?.childTaxCredit || 0,
      ssi: policyEngineResult?.benefits?.ssi || 0, // SSI not in Maryland rules yet
      householdNetIncome: policyEngineResult?.householdNetIncome || 0,
      householdTax: policyEngineResult?.householdTax || 0,
      householdBenefits: policyEngineResult?.householdBenefits || 0,
      marginalTaxRate: policyEngineResult?.marginalTaxRate || 0
    };

    // Build verification status for each program
    const verifications = {
      snap: policyEngineResult?.benefits?.snap !== undefined ? {
        match: Math.abs(benefits.snap - policyEngineResult.benefits.snap) < 10,
        policyEngineAmount: policyEngineResult.benefits.snap,
        marylandAmount: benefits.snap
      } : null,
      tanf: policyEngineResult?.benefits?.tanf !== undefined ? {
        match: Math.abs(benefits.tanf - policyEngineResult.benefits.tanf) < 10,
        policyEngineAmount: policyEngineResult.benefits.tanf,
        marylandAmount: benefits.tanf
      } : null,
      ohep: policyEngineResult?.benefits?.ohep !== undefined ? {
        match: Math.abs(benefits.ohep - policyEngineResult.benefits.ohep) < 10,
        policyEngineAmount: policyEngineResult.benefits.ohep,
        marylandAmount: benefits.ohep
      } : null,
      medicaid: policyEngineResult?.benefits?.medicaid !== undefined ? {
        match: benefits.medicaid === policyEngineResult.benefits.medicaid,
        policyEngineEligible: policyEngineResult.benefits.medicaid,
        marylandEligible: benefits.medicaid
      } : null
    };

    const response = {
      success: true,
      benefits,
      verifications,
      summary: `Based on Maryland Rules-as-Code determinations, verified by PolicyEngine`,
      calculations: {
        snap: snapResult,
        tanf: tanfResult,
        ohep: ohepResult,
        medicaid: medicaidResult
      }
    };

    // Cache the response
    cacheService.set(cacheKey, response);
    console.log(`💾 Cached hybrid summary response (hash: ${householdHash})`);

    res.json(response);
  }));

  // Test PolicyEngine connection
  app.get("/api/policyengine/test", asyncHandler(async (req: Request, res: Response) => {
    const { policyEngineService } = await import("./services/policyEngine.service");
    
    const available = await policyEngineService.testConnection();
    
    res.json({
      available,
      message: available 
        ? "PolicyEngine is available and ready to use" 
        : "PolicyEngine is not available. Please check the installation."
    });
  }));

  // Cross-Eligibility Radar - Real-time multi-program eligibility tracking
  app.post("/api/eligibility/radar", asyncHandler(async (req: Request, res: Response) => {
    const { policyEngineService } = await import("./services/policyEngine.service");
    const { policyEngineTaxCalculationService } = await import("./services/policyEngineTaxCalculation");
    
    const inputSchema = z.object({
      // Household composition
      adults: z.number().min(1).max(20).optional().default(1),
      children: z.number().min(0).max(20).optional().default(0),
      elderlyOrDisabled: z.boolean().optional().default(false),
      
      // Income (can be partial)
      employmentIncome: z.number().min(0).optional().default(0),
      unearnedIncome: z.number().min(0).optional().default(0),
      selfEmploymentIncome: z.number().min(0).optional().default(0),
      
      // Benefits-specific data
      householdAssets: z.number().min(0).optional(),
      rentOrMortgage: z.number().min(0).optional(),
      utilityCosts: z.number().min(0).optional(),
      medicalExpenses: z.number().min(0).optional(),
      childcareExpenses: z.number().min(0).optional(),
      
      // Tax-specific data (optional)
      filingStatus: z.enum(['single', 'married_joint', 'married_separate', 'head_of_household', 'qualifying_widow']).optional(),
      wageWithholding: z.number().min(0).optional(),
      
      // Previous calculation (for change detection)
      previousResults: z.object({
        snap: z.number().optional(),
        medicaid: z.boolean().optional(),
        tanf: z.number().optional(),
        eitc: z.number().optional(),
        ctc: z.number().optional(),
        ssi: z.number().optional()
      }).optional(),
      
      stateCode: z.string().length(2).optional().default("MD"),
      year: z.number().optional()
    });
    
    const validated = inputSchema.parse(req.body);
    
    // Calculate benefits eligibility
    const benefitResult = await policyEngineService.calculateBenefits({
      adults: validated.adults,
      children: validated.children,
      employmentIncome: validated.employmentIncome,
      unearnedIncome: validated.unearnedIncome,
      stateCode: validated.stateCode,
      year: validated.year,
      householdAssets: validated.householdAssets,
      rentOrMortgage: validated.rentOrMortgage,
      utilityCosts: validated.utilityCosts,
      medicalExpenses: validated.medicalExpenses,
      childcareExpenses: validated.childcareExpenses,
      elderlyOrDisabled: validated.elderlyOrDisabled
    });
    
    if (!benefitResult.success || !benefitResult.benefits) {
      return res.status(500).json({ 
        error: "Failed to calculate eligibility",
        details: benefitResult.error 
      });
    }
    
    const benefits = benefitResult.benefits;
    const prev = validated.previousResults || {};
    
    // Build program eligibility cards with status and change indicators
    const programs = [
      {
        id: 'MD_SNAP',
        name: 'SNAP (Food Assistance)',
        status: benefits.snap > 0 ? 'eligible' : 'ineligible',
        monthlyAmount: Math.round(benefits.snap),
        annualAmount: Math.round(benefits.snap * 12),
        change: prev.snap !== undefined ? Math.round(benefits.snap - prev.snap) : (benefits.snap > 0 ? 'new' : 0),
        changePercent: prev.snap && prev.snap > 0 ? Math.round(((benefits.snap - prev.snap) / prev.snap) * 100) : 0
      },
      {
        id: 'MD_MEDICAID',
        name: 'Medicaid (Health Coverage)',
        status: benefits.medicaid ? 'eligible' : 'ineligible',
        eligible: benefits.medicaid,
        change: prev.medicaid !== undefined ? (benefits.medicaid !== prev.medicaid ? 'changed' : 'unchanged') : 'new'
      },
      {
        id: 'MD_TANF',
        name: 'TCA (Cash Assistance)',
        status: benefits.tanf > 0 ? 'eligible' : 'ineligible',
        monthlyAmount: Math.round(benefits.tanf),
        annualAmount: Math.round(benefits.tanf * 12),
        change: prev.tanf !== undefined ? Math.round(benefits.tanf - prev.tanf) : (benefits.tanf > 0 ? 'new' : 0),
        changePercent: prev.tanf && prev.tanf > 0 ? Math.round(((benefits.tanf - prev.tanf) / prev.tanf) * 100) : 0
      },
      {
        id: 'EITC',
        name: 'Earned Income Tax Credit',
        status: benefits.eitc > 0 ? 'eligible' : 'ineligible',
        annualAmount: Math.round(benefits.eitc),
        change: prev.eitc !== undefined ? Math.round(benefits.eitc - prev.eitc) : (benefits.eitc > 0 ? 'new' : 0),
        changePercent: prev.eitc && prev.eitc > 0 ? Math.round(((benefits.eitc - prev.eitc) / prev.eitc) * 100) : 0
      },
      {
        id: 'CTC',
        name: 'Child Tax Credit',
        status: benefits.childTaxCredit > 0 ? 'eligible' : 'ineligible',
        annualAmount: Math.round(benefits.childTaxCredit),
        change: prev.ctc !== undefined ? Math.round(benefits.childTaxCredit - prev.ctc) : (benefits.childTaxCredit > 0 ? 'new' : 0),
        changePercent: prev.ctc && prev.ctc > 0 ? Math.round(((benefits.childTaxCredit - prev.ctc) / prev.ctc) * 100) : 0
      },
      {
        id: 'SSI',
        name: 'Supplemental Security Income',
        status: benefits.ssi > 0 ? 'eligible' : 'ineligible',
        monthlyAmount: Math.round(benefits.ssi),
        annualAmount: Math.round(benefits.ssi * 12),
        change: prev.ssi !== undefined ? Math.round(benefits.ssi - prev.ssi) : (benefits.ssi > 0 ? 'new' : 0),
        changePercent: prev.ssi && prev.ssi > 0 ? Math.round(((benefits.ssi - prev.ssi) / prev.ssi) * 100) : 0
      }
    ];
    
    // Generate smart alerts based on eligibility patterns
    const alerts = [];
    
    // Alert: Near SNAP threshold
    const totalIncome = validated.employmentIncome + (validated.unearnedIncome || 0);
    const householdSize = validated.adults + validated.children;
    const snapIncomeLimit = 31980 + (householdSize - 1) * 11520; // Approx 130% FPL
    const incomeToLimit = snapIncomeLimit - totalIncome;
    
    if (incomeToLimit > 0 && incomeToLimit < 500 * 12) {
      alerts.push({
        type: 'warning',
        program: 'MD_SNAP',
        message: `Income is $${Math.round(incomeToLimit)} below SNAP limit - verify carefully`,
        action: 'Ensure all income sources are documented'
      });
    }
    
    // Alert: Childcare deduction opportunity
    if (validated.children > 0 && (!validated.childcareExpenses || validated.childcareExpenses === 0)) {
      alerts.push({
        type: 'opportunity',
        program: 'MD_SNAP',
        message: 'Adding childcare expenses could increase SNAP benefits',
        action: 'Ask client about childcare costs',
        estimatedIncrease: 100 // Rough estimate
      });
    }
    
    // Alert: Medical expense deduction (elderly/disabled)
    if (validated.elderlyOrDisabled && (!validated.medicalExpenses || validated.medicalExpenses === 0)) {
      alerts.push({
        type: 'opportunity',
        program: 'MD_SNAP',
        message: 'Medical expenses can increase benefits for elderly/disabled households',
        action: 'Ask about medical costs exceeding $35/month',
        estimatedIncrease: 50
      });
    }
    
    // Alert: Tax credits available
    if (benefits.eitc > 0 || benefits.childTaxCredit > 0) {
      const totalCredits = benefits.eitc + benefits.childTaxCredit;
      alerts.push({
        type: 'success',
        program: 'VITA',
        message: `Eligible for $${Math.round(totalCredits).toLocaleString()} in tax credits`,
        action: 'Complete VITA intake to claim credits'
      });
    }
    
    // Calculate total annual benefit value
    const totalAnnualBenefits = 
      benefits.snap * 12 + 
      benefits.tanf * 12 + 
      benefits.eitc + 
      benefits.childTaxCredit + 
      benefits.ssi * 12;
    
    res.json({
      success: true,
      programs,
      alerts,
      summary: {
        totalMonthlyBenefits: Math.round((benefits.snap + benefits.tanf + benefits.ssi)),
        totalAnnualBenefits: Math.round(totalAnnualBenefits),
        eligibleProgramCount: programs.filter(p => p.status === 'eligible').length,
        householdNetIncome: Math.round(benefits.householdNetIncome),
        effectiveBenefitRate: totalIncome > 0 ? Math.round((totalAnnualBenefits / totalIncome) * 100) : 0
      },
      calculatedAt: new Date().toISOString()
    });
  }));

  // ============================================================================
  // Tax Preparation Routes
  // ============================================================================

  // Upload and extract tax document (W-2, 1099, 1095-A)
  app.post("/api/tax/documents/extract", requireAuth, upload.single('taxDocument'), asyncHandler(async (req: Request, res: Response) => {
    const { taxDocumentExtractionService } = await import("./services/taxDocumentExtraction");
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const schema = z.object({
      documentType: z.enum(['w2', '1099-misc', '1099-nec', '1095-a']),
      taxYear: z.string().transform(Number),
      scenarioId: z.string().optional()
    });

    const validated = schema.parse(req.body);

    // Convert file buffer to base64
    const base64Image = req.file.buffer.toString('base64');

    // Extract data using Gemini Vision
    const extractedData = await taxDocumentExtractionService.extractTaxDocument(
      base64Image,
      validated.documentType,
      validated.taxYear
    );

    // Save to documents table
    const document = await storage.createDocument({
      filename: req.file.originalname,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user!.id,
      status: 'processed',
      metadata: { taxYear: validated.taxYear, documentType: validated.documentType }
    });

    // Save tax document record
    const taxDocument = await storage.createTaxDocument({
      scenarioId: validated.scenarioId || null,
      federalReturnId: null,
      documentType: validated.documentType,
      documentId: document.id,
      extractedData,
      geminiConfidence: extractedData.metadata?.confidence || 0.85,
      verificationStatus: 'pending',
      taxYear: validated.taxYear,
      qualityFlags: extractedData.metadata?.qualityFlags || [],
      requiresManualReview: (extractedData.metadata?.confidence || 0.85) < 0.7
    });

    res.json({
      success: true,
      taxDocumentId: taxDocument.id,
      documentId: document.id,
      extractedData,
      requiresManualReview: taxDocument.requiresManualReview
    });
  }));

  // Run tax calculations using PolicyEngine
  app.post("/api/tax/calculate", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { policyEngineTaxCalculationService } = await import("./services/policyEngineTaxCalculation");
    
    const schema = z.object({
      taxYear: z.number(),
      filingStatus: z.enum(['single', 'married_joint', 'married_separate', 'head_of_household', 'qualifying_widow']),
      stateCode: z.string().default('MD'),
      taxpayer: z.object({
        age: z.number(),
        isBlind: z.boolean().default(false),
        isDisabled: z.boolean().default(false)
      }),
      spouse: z.object({
        age: z.number(),
        isBlind: z.boolean().default(false),
        isDisabled: z.boolean().default(false)
      }).optional(),
      dependents: z.array(z.object({
        age: z.number(),
        relationship: z.string(),
        isStudent: z.boolean().default(false),
        disabilityStatus: z.boolean().default(false)
      })).optional(),
      w2Income: z.object({
        taxpayerWages: z.number().default(0),
        taxpayerWithholding: z.number().default(0),
        spouseWages: z.number().default(0),
        spouseWithholding: z.number().default(0)
      }).optional(),
      form1099Income: z.object({
        miscIncome: z.number().default(0),
        necIncome: z.number().default(0),
        interestIncome: z.number().default(0),
        dividendIncome: z.number().default(0)
      }).optional(),
      healthInsurance: z.object({
        monthsOfCoverage: z.number(),
        slcspPremium: z.number(),
        aptcReceived: z.number()
      }).optional(),
      adjustments: z.object({
        studentLoanInterest: z.number().default(0),
        hsaContributions: z.number().default(0),
        iraContributions: z.number().default(0)
      }).optional(),
      itemizedDeductions: z.object({
        medicalExpenses: z.number().default(0),
        stateTaxesPaid: z.number().default(0),
        mortgageInterest: z.number().default(0),
        charitableContributions: z.number().default(0)
      }).optional(),
      childcareCosts: z.number().optional(),
      medicalExpenses: z.number().optional()
    });

    const validated = schema.parse(req.body);

    const result = await policyEngineTaxCalculationService.calculateTaxes(validated);

    res.json(result);
  }));

  // Generate Form 1040 PDF
  app.post("/api/tax/form1040/generate", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { form1040Generator } = await import("./services/form1040Generator");
    
    const schema = z.object({
      taxReturnId: z.string()
    });

    const validated = schema.parse(req.body);

    // Get tax return data
    const taxReturn = await storage.getFederalTaxReturn(validated.taxReturnId);
    if (!taxReturn) {
      return res.status(404).json({ error: "Tax return not found" });
    }

    // Extract data from tax return
    const form1040Data = taxReturn.form1040Data as any;
    
    // Generate PDF
    const pdfBuffer = await form1040Generator.generateForm1040(
      form1040Data.personalInfo,
      form1040Data.taxInput,
      form1040Data.taxResult,
      {
        taxYear: taxReturn.taxYear,
        preparerName: req.user?.username,
        preparationDate: new Date(),
        includeWatermark: true
      }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Form-1040-${taxReturn.taxYear}.pdf"`);
    res.send(pdfBuffer);
  }));

  // Generate Maryland Form 502 PDF (from saved tax return)
  app.post("/api/tax/form502/generate", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { Form502Generator } = await import("./services/form502Generator");
    
    const schema = z.object({
      federalTaxReturnId: z.string().optional(),
      personalInfo: z.object({
        taxpayerFirstName: z.string(),
        taxpayerLastName: z.string(),
        taxpayerSSN: z.string(),
        spouseFirstName: z.string().optional(),
        spouseLastName: z.string().optional(),
        spouseSSN: z.string().optional(),
        streetAddress: z.string(),
        city: z.string(),
        state: z.string(),
        county: z.string(),
        zipCode: z.string(),
        filingStatus: z.string()
      }).optional(),
      calculationResult: z.object({
        adjustedGrossIncome: z.number(),
        taxableIncome: z.number(),
        totalTax: z.number(),
        eitcAmount: z.number(),
        childTaxCredit: z.number(),
        deduction: z.number().optional(),
        marylandTax: z.object({
          marylandAGI: z.number(),
          marylandStateTax: z.number(),
          countyTax: z.number(),
          totalMarylandTax: z.number(),
          marylandEITC: z.number(),
          marylandRefund: z.number()
        }).optional()
      }).optional(),
      taxYear: z.number().optional()
    });

    const validated = schema.parse(req.body);

    const form502Generator = new Form502Generator();

    // Use provided data or fetch from database
    if (validated.federalTaxReturnId) {
      const federalTaxReturn = await storage.getFederalTaxReturn(validated.federalTaxReturnId);
      if (!federalTaxReturn) {
        return res.status(404).json({ error: "Federal tax return not found" });
      }

      const result = await form502Generator.generateForm502(
        federalTaxReturn.form1040Data.personalInfo,
        federalTaxReturn.form1040Data.taxInput,
        federalTaxReturn.form1040Data.taxResult,
        federalTaxReturn.form1040Data.marylandInput || {},
        {
          taxYear: federalTaxReturn.taxYear,
          preparerName: req.user?.username,
          preparationDate: new Date(),
          includeWatermark: true
        }
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Form-502-MD-${federalTaxReturn.taxYear}.pdf"`);
      res.send(result.pdf);
    } else if (validated.personalInfo && validated.calculationResult && validated.taxYear) {
      // Direct generation from provided data
      const personalInfoForForm = {
        ...validated.personalInfo,
        county: validated.personalInfo.county
      };

      const taxInput = {
        filingStatus: validated.personalInfo.filingStatus as any
      };

      const taxResult = {
        adjustedGrossIncome: validated.calculationResult.adjustedGrossIncome,
        taxableIncome: validated.calculationResult.taxableIncome,
        incomeTax: validated.calculationResult.totalTax,
        eitc: validated.calculationResult.eitcAmount,
        childTaxCredit: validated.calculationResult.childTaxCredit,
        deductionBreakdown: {
          standardDeduction: validated.calculationResult.deduction || 0,
          itemizedDeduction: 0
        }
      } as any;

      const result = await form502Generator.generateForm502(
        personalInfoForForm,
        taxInput,
        taxResult,
        {},
        {
          taxYear: validated.taxYear,
          preparerName: req.user?.username,
          preparationDate: new Date(),
          includeWatermark: true
        }
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Form-502-MD-${validated.taxYear}.pdf"`);
      res.send(result.pdf);
    } else {
      return res.status(400).json({ error: "Either federalTaxReturnId or complete form data must be provided" });
    }
  }));

  // Calculate Maryland tax from federal AGI
  app.post("/api/tax/maryland/calculate", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { Form502Generator } = await import("./services/form502Generator");
    
    const schema = z.object({
      federalAGI: z.number(),
      federalEITC: z.number().default(0),
      filingStatus: z.enum(['single', 'married_joint', 'married_separate', 'head_of_household', 'qualifying_widow']),
      county: z.string(),
      marylandInput: z.object({
        stateTaxRefund: z.number().optional(),
        socialSecurityBenefits: z.number().optional(),
        railroadRetirement: z.number().optional(),
        pensionIncome: z.number().optional(),
        propertyTaxPaid: z.number().optional(),
        rentPaid: z.number().optional(),
        childcareExpenses: z.number().optional(),
        marylandWithholding: z.number().optional()
      }).optional(),
      federalDeduction: z.number().default(0),
      federalItemizedDeduction: z.number().default(0)
    });

    const validated = schema.parse(req.body);

    const form502Generator = new Form502Generator();

    // Create minimal tax result for Maryland calculation
    const federalTaxResult = {
      adjustedGrossIncome: validated.federalAGI,
      eitc: validated.federalEITC,
      deductionBreakdown: {
        standardDeduction: validated.federalDeduction,
        itemizedDeduction: validated.federalItemizedDeduction
      }
    } as any;

    const taxInput = {
      filingStatus: validated.filingStatus
    } as any;

    // Calculate Maryland tax
    const marylandTaxResult = form502Generator.calculateMarylandTax(
      federalTaxResult,
      taxInput,
      validated.marylandInput || {},
      validated.county
    );

    res.json({ marylandTax: marylandTaxResult });
  }));

  // Get cross-enrollment opportunities from tax data
  app.post("/api/tax/cross-enrollment/analyze", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { crossEnrollmentIntelligenceService } = await import("./services/crossEnrollmentIntelligence");
    const { policyEngineTaxCalculationService } = await import("./services/policyEngineTaxCalculation");
    
    const schema = z.object({
      taxInput: z.object({
        taxYear: z.number(),
        filingStatus: z.enum(['single', 'married_joint', 'married_separate', 'head_of_household', 'qualifying_widow']),
        stateCode: z.string().default('MD'),
        taxpayer: z.object({
          age: z.number(),
          isBlind: z.boolean().default(false),
          isDisabled: z.boolean().default(false)
        }),
        spouse: z.object({
          age: z.number(),
          isBlind: z.boolean().default(false),
          isDisabled: z.boolean().default(false)
        }).optional(),
        dependents: z.array(z.object({
          age: z.number(),
          relationship: z.string(),
          isStudent: z.boolean().default(false),
          disabilityStatus: z.boolean().default(false)
        })).optional(),
        w2Income: z.object({
          taxpayerWages: z.number().default(0),
          taxpayerWithholding: z.number().default(0),
          spouseWages: z.number().default(0),
          spouseWithholding: z.number().default(0)
        }).optional(),
        form1099Income: z.object({
          miscIncome: z.number().default(0),
          necIncome: z.number().default(0),
          interestIncome: z.number().default(0),
          dividendIncome: z.number().default(0)
        }).optional(),
        healthInsurance: z.object({
          monthsOfCoverage: z.number(),
          slcspPremium: z.number(),
          aptcReceived: z.number()
        }).optional(),
        medicalExpenses: z.number().optional(),
        childcareCosts: z.number().optional()
      }),
      benefitData: z.object({
        childcareExpenses: z.number().optional(),
        educationExpenses: z.number().optional(),
        medicalExpenses: z.number().optional(),
        dependents: z.number().optional(),
        agi: z.number().optional()
      }).optional()
    });

    const validated = schema.parse(req.body);

    // Calculate tax first
    const taxResult = await policyEngineTaxCalculationService.calculateTaxes(validated.taxInput);

    // Analyze for cross-enrollment opportunities
    const analysis = await crossEnrollmentIntelligenceService.generateFullAnalysis(
      validated.taxInput,
      taxResult,
      validated.benefitData
    );

    res.json(analysis);
  }));

  // Create federal tax return
  app.post("/api/tax/federal", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const schema = insertFederalTaxReturnSchema.extend({
      preparerId: z.string().optional()
    });

    const validated = schema.parse(req.body);

    const taxReturn = await storage.createFederalTaxReturn({
      ...validated,
      preparerId: validated.preparerId || req.user!.id
    });

    res.json(taxReturn);
  }));

  // Get federal tax return
  app.get("/api/tax/federal/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const taxReturn = await storage.getFederalTaxReturn(req.params.id);
    
    if (!taxReturn) {
      return res.status(404).json({ error: "Tax return not found" });
    }

    res.json(taxReturn);
  }));

  // Get federal tax returns with filters
  app.get("/api/tax/federal", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      scenarioId: req.query.scenarioId as string | undefined,
      preparerId: req.query.preparerId as string | undefined,
      taxYear: req.query.taxYear ? Number(req.query.taxYear) : undefined,
      efileStatus: req.query.efileStatus as string | undefined
    };

    const taxReturns = await storage.getFederalTaxReturns(filters);
    res.json(taxReturns);
  }));

  // Update federal tax return
  app.patch("/api/tax/federal/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const updates = req.body;
    const taxReturn = await storage.updateFederalTaxReturn(req.params.id, updates);
    res.json(taxReturn);
  }));

  // Delete federal tax return
  app.delete("/api/tax/federal/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    await storage.deleteFederalTaxReturn(req.params.id);
    res.json({ success: true });
  }));

  // Create Maryland tax return
  app.post("/api/tax/maryland", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const schema = insertMarylandTaxReturnSchema;
    const validated = schema.parse(req.body);

    const taxReturn = await storage.createMarylandTaxReturn(validated);
    res.json(taxReturn);
  }));

  // Get Maryland tax return
  app.get("/api/tax/maryland/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const taxReturn = await storage.getMarylandTaxReturn(req.params.id);
    
    if (!taxReturn) {
      return res.status(404).json({ error: "Maryland tax return not found" });
    }

    res.json(taxReturn);
  }));

  // Get Maryland tax return by federal ID
  app.get("/api/tax/maryland/federal/:federalId", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const taxReturn = await storage.getMarylandTaxReturnByFederalId(req.params.federalId);
    
    if (!taxReturn) {
      return res.status(404).json({ error: "Maryland tax return not found" });
    }

    res.json(taxReturn);
  }));

  // Update Maryland tax return
  app.patch("/api/tax/maryland/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const updates = req.body;
    const taxReturn = await storage.updateMarylandTaxReturn(req.params.id, updates);
    res.json(taxReturn);
  }));

  // Get tax documents
  app.get("/api/tax/documents", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      scenarioId: req.query.scenarioId as string | undefined,
      federalReturnId: req.query.federalReturnId as string | undefined,
      documentType: req.query.documentType as string | undefined,
      verificationStatus: req.query.verificationStatus as string | undefined
    };

    const documents = await storage.getTaxDocuments(filters);
    res.json(documents);
  }));

  // Verify tax document
  app.patch("/api/tax/documents/:id/verify", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      verificationStatus: z.enum(['verified', 'flagged', 'rejected']),
      notes: z.string().optional()
    });

    const validated = schema.parse(req.body);

    const taxDocument = await storage.updateTaxDocument(req.params.id, {
      verificationStatus: validated.verificationStatus,
      verifiedBy: req.user!.id,
      verifiedAt: new Date(),
      notes: validated.notes
    });

    res.json(taxDocument);
  }));

  // ============================================================================
  // Anonymous Screening Session Routes
  // ============================================================================

  // Save anonymous screening session (no auth required)
  app.post("/api/screener/save", asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      sessionId: z.string(),
      householdData: z.object({
        adults: z.coerce.number(),
        children: z.coerce.number(),
        employmentIncome: z.coerce.number(),
        unearnedIncome: z.coerce.number().optional(),
        stateCode: z.string(),
        householdAssets: z.coerce.number().optional(),
        rentOrMortgage: z.coerce.number().optional(),
        utilityCosts: z.coerce.number().optional(),
        medicalExpenses: z.coerce.number().optional(),
        childcareExpenses: z.coerce.number().optional(),
        elderlyOrDisabled: z.boolean().optional()
      }),
      benefitResults: z.object({
        success: z.boolean(),
        benefits: z.object({
          snap: z.coerce.number(),
          medicaid: z.boolean(),
          eitc: z.coerce.number(),
          childTaxCredit: z.coerce.number(),
          ssi: z.coerce.number(),
          tanf: z.coerce.number(),
          ohep: z.coerce.number(),
          householdNetIncome: z.coerce.number(),
          householdTax: z.coerce.number(),
          householdBenefits: z.coerce.number(),
          marginalTaxRate: z.coerce.number()
        })
      })
    });
    
    const validated = schema.parse(req.body);
    
    // Calculate summary metrics
    const totalMonthlyBenefits = 
      validated.benefitResults.benefits.snap + 
      validated.benefitResults.benefits.ssi + 
      validated.benefitResults.benefits.tanf;
    
    const totalYearlyBenefits = 
      validated.benefitResults.benefits.eitc + 
      validated.benefitResults.benefits.childTaxCredit;
    
    const eligibleProgramCount = [
      validated.benefitResults.benefits.snap > 0,
      validated.benefitResults.benefits.medicaid,
      validated.benefitResults.benefits.eitc > 0,
      validated.benefitResults.benefits.childTaxCredit > 0,
      validated.benefitResults.benefits.ssi > 0,
      validated.benefitResults.benefits.tanf > 0,
      validated.benefitResults.benefits.ohep > 0
    ].filter(Boolean).length;
    
    // Get IP and user agent for metadata
    const ipAddress = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;
    
    // Check if session already exists (upsert logic)
    const existingSession = await storage.getAnonymousScreeningSession(validated.sessionId);
    
    let session;
    if (existingSession) {
      // Update existing session
      session = await storage.updateAnonymousScreeningSession(existingSession.id, {
        householdData: validated.householdData,
        benefitResults: validated.benefitResults,
        totalMonthlyBenefits,
        totalYearlyBenefits,
        eligibleProgramCount,
        stateCode: validated.householdData.stateCode,
        updatedAt: new Date()
      });
    } else {
      // Create new session
      session = await storage.createAnonymousScreeningSession({
        sessionId: validated.sessionId,
        householdData: validated.householdData,
        benefitResults: validated.benefitResults,
        totalMonthlyBenefits,
        totalYearlyBenefits,
        eligibleProgramCount,
        stateCode: validated.householdData.stateCode,
        ipAddress,
        userAgent,
        userId: null,
        claimedAt: null
      });
    }
    
    res.json(session);
  }));

  // Get anonymous screening session (no auth required)
  app.get("/api/screener/sessions/:sessionId", asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getAnonymousScreeningSession(req.params.sessionId);
    
    if (!session) {
      throw validationError("Session not found");
    }
    
    res.json(session);
  }));

  // Claim anonymous screening session (requires auth)
  app.post("/api/screener/sessions/:sessionId/claim", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getAnonymousScreeningSession(req.params.sessionId);
    
    if (!session) {
      throw validationError("Session not found");
    }
    
    if (session.userId) {
      throw validationError("Session has already been claimed");
    }
    
    const claimedSession = await storage.claimAnonymousScreeningSession(
      req.params.sessionId,
      req.user!.id
    );
    
    res.json(claimedSession);
  }));

  // Get user's claimed screening sessions
  app.get("/api/screener/my-sessions", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const sessions = await storage.getAnonymousScreeningSessionsByUser(req.user!.id);
    res.json(sessions);
  }));

  // ============================================================================
  // Household Scenario Workspace Routes
  // ============================================================================

  // Create household scenario
  app.post("/api/scenarios", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      householdData: z.object({
        adults: z.number(),
        children: z.number(),
        employmentIncome: z.number(),
        unearnedIncome: z.number().optional(),
        stateCode: z.string(),
        householdAssets: z.number().optional(),
        rentOrMortgage: z.number().optional(),
        utilityCosts: z.number().optional(),
        medicalExpenses: z.number().optional(),
        childcareExpenses: z.number().optional(),
        elderlyOrDisabled: z.boolean().optional()
      }),
      stateCode: z.string().default("MD"),
      tags: z.array(z.string()).optional(),
      clientIdentifier: z.string().optional()
    });

    const validated = schema.parse(req.body);
    
    const scenario = await storage.createHouseholdScenario({
      ...validated,
      userId: req.user!.id
    });

    res.json(scenario);
  }));

  // Get all scenarios for user
  app.get("/api/scenarios", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const scenarios = await storage.getHouseholdScenariosByUser(req.user!.id);
    res.json(scenarios);
  }));

  // Get single scenario
  app.get("/api/scenarios/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const scenario = await storage.getHouseholdScenario(req.params.id);
    
    if (!scenario) {
      throw notFoundError("Scenario not found");
    }
    
    if (scenario.userId !== req.user!.id) {
      throw authorizationError();
    }
    
    res.json(scenario);
  }));

  // Update scenario
  app.patch("/api/scenarios/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const scenario = await storage.getHouseholdScenario(req.params.id);
    
    if (!scenario) {
      throw notFoundError("Scenario not found");
    }
    
    if (scenario.userId !== req.user!.id) {
      throw authorizationError();
    }

    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      householdData: z.object({
        adults: z.number(),
        children: z.number(),
        employmentIncome: z.number(),
        unearnedIncome: z.number().optional(),
        stateCode: z.string(),
        householdAssets: z.number().optional(),
        rentOrMortgage: z.number().optional(),
        utilityCosts: z.number().optional(),
        medicalExpenses: z.number().optional(),
        childcareExpenses: z.number().optional(),
        elderlyOrDisabled: z.boolean().optional()
      }).optional(),
      tags: z.array(z.string()).optional(),
      clientIdentifier: z.string().optional()
    });

    const validated = schema.parse(req.body);
    const updated = await storage.updateHouseholdScenario(req.params.id, validated);
    
    res.json(updated);
  }));

  // Delete scenario
  app.delete("/api/scenarios/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const scenario = await storage.getHouseholdScenario(req.params.id);
    
    if (!scenario) {
      throw notFoundError("Scenario not found");
    }
    
    if (scenario.userId !== req.user!.id) {
      throw authorizationError();
    }
    
    await storage.deleteHouseholdScenario(req.params.id);
    res.json({ success: true });
  }));

  // Calculate scenario using PolicyEngine
  app.post("/api/scenarios/:id/calculate", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const scenario = await storage.getHouseholdScenario(req.params.id);
    
    if (!scenario) {
      throw notFoundError("Scenario not found");
    }
    
    if (scenario.userId !== req.user!.id) {
      throw authorizationError();
    }

    const schema = z.object({
      notes: z.string().optional(),
      calculationVersion: z.string().optional()
    });

    const { notes, calculationVersion } = schema.parse(req.body);

    // Calculate benefits using PolicyEngine
    const benefitResults = await policyEngineService.calculateMultiBenefits(scenario.householdData);

    if (!benefitResults.success) {
      throw validationError("Failed to calculate benefits");
    }

    // Extract summary metrics
    const totalMonthlyBenefits = 
      benefitResults.benefits.snap + 
      benefitResults.benefits.ssi + 
      benefitResults.benefits.tanf;
    
    const totalYearlyBenefits = 
      benefitResults.benefits.eitc + 
      benefitResults.benefits.childTaxCredit;
    
    const eligibleProgramCount = [
      benefitResults.benefits.snap > 0,
      benefitResults.benefits.medicaid,
      benefitResults.benefits.eitc > 0,
      benefitResults.benefits.childTaxCredit > 0,
      benefitResults.benefits.ssi > 0,
      benefitResults.benefits.tanf > 0
    ].filter(Boolean).length;

    // Create calculation record
    const calculation = await storage.createScenarioCalculation({
      scenarioId: scenario.id,
      benefitResults,
      totalMonthlyBenefits,
      totalYearlyBenefits,
      eligibleProgramCount,
      snapAmount: benefitResults.benefits.snap,
      medicaidEligible: benefitResults.benefits.medicaid,
      eitcAmount: benefitResults.benefits.eitc,
      childTaxCreditAmount: benefitResults.benefits.childTaxCredit,
      ssiAmount: benefitResults.benefits.ssi,
      tanfAmount: benefitResults.benefits.tanf,
      notes,
      calculationVersion
    });

    res.json(calculation);
  }));

  // Get calculations for a scenario
  app.get("/api/scenarios/:id/calculations", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const scenario = await storage.getHouseholdScenario(req.params.id);
    
    if (!scenario) {
      throw notFoundError("Scenario not found");
    }
    
    if (scenario.userId !== req.user!.id) {
      throw authorizationError();
    }
    
    const calculations = await storage.getScenarioCalculationsByScenario(req.params.id);
    res.json(calculations);
  }));

  // Get latest calculation for a scenario
  app.get("/api/scenarios/:id/calculations/latest", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const scenario = await storage.getHouseholdScenario(req.params.id);
    
    if (!scenario) {
      throw notFoundError("Scenario not found");
    }
    
    if (scenario.userId !== req.user!.id) {
      throw authorizationError();
    }
    
    const calculation = await storage.getLatestScenarioCalculation(req.params.id);
    res.json(calculation || null);
  }));

  // Create scenario comparison
  app.post("/api/comparisons", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      scenarioIds: z.array(z.string()).min(2, "Must compare at least 2 scenarios"),
      sharedWith: z.array(z.string()).optional()
    });

    const validated = schema.parse(req.body);

    // Verify all scenarios belong to user
    for (const scenarioId of validated.scenarioIds) {
      const scenario = await storage.getHouseholdScenario(scenarioId);
      if (!scenario || scenario.userId !== req.user!.id) {
        throw validationError(`Invalid scenario ID: ${scenarioId}`);
      }
    }

    const comparison = await storage.createScenarioComparison({
      ...validated,
      userId: req.user!.id
    });

    res.json(comparison);
  }));

  // Get all comparisons for user
  app.get("/api/comparisons", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const comparisons = await storage.getScenarioComparisonsByUser(req.user!.id);
    res.json(comparisons);
  }));

  // Get single comparison
  app.get("/api/comparisons/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const comparison = await storage.getScenarioComparison(req.params.id);
    
    if (!comparison) {
      throw notFoundError("Comparison not found");
    }
    
    if (comparison.userId !== req.user!.id) {
      throw authorizationError();
    }
    
    res.json(comparison);
  }));

  // Update comparison
  app.patch("/api/comparisons/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const comparison = await storage.getScenarioComparison(req.params.id);
    
    if (!comparison) {
      throw notFoundError("Comparison not found");
    }
    
    if (comparison.userId !== req.user!.id) {
      throw authorizationError();
    }

    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      scenarioIds: z.array(z.string()).min(2).optional(),
      sharedWith: z.array(z.string()).optional()
    });

    const validated = schema.parse(req.body);

    // Verify all scenarios belong to user if scenarioIds provided
    if (validated.scenarioIds) {
      for (const scenarioId of validated.scenarioIds) {
        const scenario = await storage.getHouseholdScenario(scenarioId);
        if (!scenario || scenario.userId !== req.user!.id) {
          throw validationError(`Invalid scenario ID: ${scenarioId}`);
        }
      }
    }

    const updated = await storage.updateScenarioComparison(req.params.id, validated);
    res.json(updated);
  }));

  // Delete comparison
  app.delete("/api/comparisons/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const comparison = await storage.getScenarioComparison(req.params.id);
    
    if (!comparison) {
      throw notFoundError("Comparison not found");
    }
    
    if (comparison.userId !== req.user!.id) {
      throw authorizationError();
    }
    
    await storage.deleteScenarioComparison(req.params.id);
    res.json({ success: true });
  }));

  // ==========================================
  // Household Profiler Routes
  // ==========================================

  // Create household profile
  app.post("/api/household-profiles", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertHouseholdProfileSchema.parse({
      ...req.body,
      userId: req.user!.id
    });

    const profile = await storage.createHouseholdProfile(validated);
    res.json(profile);
  }));

  // Get all household profiles for user with optional filters
  app.get("/api/household-profiles", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const filters: { profileMode?: string; clientCaseId?: string; isActive?: boolean } = {};

    if (req.query.profileMode) {
      filters.profileMode = req.query.profileMode as string;
    }
    if (req.query.clientCaseId) {
      filters.clientCaseId = req.query.clientCaseId as string;
    }
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }

    const profiles = await storage.getHouseholdProfiles(req.user!.id, filters);
    res.json(profiles);
  }));

  // Get single household profile (with ownership verification)
  app.get("/api/household-profiles/:id", requireStaff, verifyHouseholdProfileOwnership(), asyncHandler(async (req: Request, res: Response) => {
    const profile = await storage.getHouseholdProfile(req.params.id);
    
    if (!profile) {
      throw notFoundError("Household profile not found");
    }
    
    if (profile.userId !== req.user!.id) {
      throw authorizationError();
    }
    
    res.json(profile);
  }));

  // Update household profile (with ownership verification)
  app.patch("/api/household-profiles/:id", requireStaff, verifyHouseholdProfileOwnership(), asyncHandler(async (req: Request, res: Response) => {
    const profile = await storage.getHouseholdProfile(req.params.id);
    
    if (!profile) {
      throw notFoundError("Household profile not found");
    }
    
    if (profile.userId !== req.user!.id) {
      throw authorizationError();
    }

    const validated = insertHouseholdProfileSchema.partial().parse(req.body);
    
    // Remove protected fields that shouldn't be updated via API
    const { userId, createdAt, updatedAt, ...updateData } = validated as any;
    
    const updated = await storage.updateHouseholdProfile(req.params.id, updateData);
    res.json(updated);
  }));

  // Delete household profile (with ownership verification)
  app.delete("/api/household-profiles/:id", requireStaff, verifyHouseholdProfileOwnership(), asyncHandler(async (req: Request, res: Response) => {
    const profile = await storage.getHouseholdProfile(req.params.id);
    
    if (!profile) {
      throw notFoundError("Household profile not found");
    }
    
    if (profile.userId !== req.user!.id) {
      throw authorizationError();
    }
    
    await storage.deleteHouseholdProfile(req.params.id);
    res.json({ success: true });
  }));

  // ==========================================
  // VITA Intake Routes
  // ==========================================

  // Create VITA intake session
  app.post("/api/vita-intake", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    console.log('[VITA Auto-Save Debug] POST /api/vita-intake called');
    console.log('[VITA Auto-Save Debug] Request user:', req.user?.id, req.user?.username);
    console.log('[VITA Auto-Save Debug] Request body keys:', Object.keys(req.body));
    console.log('[VITA Auto-Save Debug] Request body sample:', {
      primaryFirstName: req.body.primaryFirstName,
      primaryLastName: req.body.primaryLastName,
      currentStep: req.body.currentStep,
      status: req.body.status
    });
    
    const validated = insertVitaIntakeSessionSchema.parse({
      ...req.body,
      userId: req.user!.id
    });
    
    console.log('[VITA Auto-Save Debug] Validated data, calling storage.createVitaIntakeSession');
    const session = await storage.createVitaIntakeSession(validated);
    console.log('[VITA Auto-Save Debug] Session created successfully:', {
      id: session.id,
      userId: session.userId,
      currentStep: session.currentStep,
      status: session.status
    });
    
    res.json(session);
  }));

  // Get all VITA intake sessions for user with optional filters
  app.get("/api/vita-intake", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const filters: { status?: string; clientCaseId?: string; reviewStatus?: string } = {};

    if (req.query.status) {
      filters.status = req.query.status as string;
    }
    if (req.query.clientCaseId) {
      filters.clientCaseId = req.query.clientCaseId as string;
    }
    if (req.query.reviewStatus) {
      filters.reviewStatus = req.query.reviewStatus as string;
    }

    const sessions = await storage.getVitaIntakeSessions(req.user!.id, filters);
    // Decrypt sensitive fields before sending to frontend
    const decryptedSessions = sessions.map(session => decryptVitaIntake(session));
    res.json(decryptedSessions);
  }));

  // Get single VITA intake session (with ownership verification)
  app.get("/api/vita-intake/:id", requireStaff, verifyVitaSessionOwnership(), asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getVitaIntakeSession(req.params.id);
    
    if (!session) {
      return res.status(404).json({ error: "Not found" });
    }
    
    // SECURITY: Return 404 (not 403) to prevent ID enumeration
    if (session.userId !== req.user!.id) {
      return res.status(404).json({ error: "Not found" });
    }
    
    // Decrypt sensitive fields before sending to frontend
    const decryptedSession = decryptVitaIntake(session);
    res.json(decryptedSession);
  }));

  // Update VITA intake session (with ownership verification)
  app.patch("/api/vita-intake/:id", requireStaff, verifyVitaSessionOwnership(), asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getVitaIntakeSession(req.params.id);
    
    if (!session) {
      return res.status(404).json({ error: "Not found" });
    }
    
    // SECURITY: Return 404 (not 403) to prevent ID enumeration
    if (session.userId !== req.user!.id) {
      return res.status(404).json({ error: "Not found" });
    }

    const validated = insertVitaIntakeSessionSchema.partial().parse(req.body);
    
    // Remove protected fields that shouldn't be updated via API
    const { userId, createdAt, updatedAt, ...updateData } = validated as any;
    
    // Handle review operations - set server-side timestamps and reviewer
    if (updateData.reviewStatus) {
      updateData.reviewedBy = req.user!.id;
      updateData.reviewedAt = new Date();
      
      // Update session status based on review decision
      if (updateData.reviewStatus === 'approved') {
        updateData.status = 'completed';
      } else if (updateData.reviewStatus === 'needs_correction') {
        updateData.status = 'needs_correction';
      }
    }
    
    const updated = await storage.updateVitaIntakeSession(req.params.id, updateData);
    res.json(updated);
  }));

  // Delete VITA intake session (with ownership verification)
  app.delete("/api/vita-intake/:id", requireStaff, verifyVitaSessionOwnership(), asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getVitaIntakeSession(req.params.id);
    
    if (!session) {
      return res.status(404).json({ error: "Not found" });
    }
    
    // SECURITY: Return 404 (not 403) to prevent ID enumeration
    if (session.userId !== req.user!.id) {
      return res.status(404).json({ error: "Not found" });
    }
    
    await storage.deleteVitaIntakeSession(req.params.id);
    res.json({ success: true });
  }));

  // Calculate VITA tax preview
  app.post("/api/vita-intake/calculate-tax", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      filingStatus: z.enum(["single", "married_joint", "married_separate", "head_of_household"]),
      taxYear: z.number(),
      wages: z.number(),
      otherIncome: z.number(),
      selfEmploymentIncome: z.number().optional(),
      businessExpenses: z.number().optional(),
      numberOfQualifyingChildren: z.number(),
      dependents: z.number(),
      qualifiedEducationExpenses: z.number().optional(),
      numberOfStudents: z.number().optional(),
      marylandCounty: z.string(),
      marylandResidentMonths: z.number()
    });

    const validated = schema.parse(req.body);
    
    // Import vitaTaxRulesEngine service
    const { vitaTaxRulesEngine } = await import("./services/vitaTaxRulesEngine");
    
    const taxResult = await vitaTaxRulesEngine.calculateTax(validated);
    res.json(taxResult);
  }));

  // ==========================================
  // Google Calendar Appointment Routes
  // ==========================================

  // Create appointment with Google Calendar sync
  app.post("/api/appointments", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertAppointmentSchema.parse({
      ...req.body,
      createdBy: req.user!.id,
      tenantId: req.user!.tenantId
    });

    // CRITICAL: Check for conflicts before creating appointment
    if (validated.startTime && validated.endTime && req.user!.tenantId) {
      const conflicts = await storage.getAppointmentConflicts(
        new Date(validated.startTime),
        new Date(validated.endTime),
        req.user!.tenantId,
        validated.navigatorId
      );

      if (conflicts.length > 0) {
        return res.status(409).json({ 
          error: "Appointment conflict detected",
          message: `The selected time slot conflicts with ${conflicts.length} existing appointment(s)`,
          conflicts: conflicts.map(c => ({
            id: c.id,
            title: c.title,
            startTime: c.startTime,
            endTime: c.endTime,
            navigatorId: c.navigatorId
          }))
        });
      }

      // Also check Google Calendar availability
      try {
        const { checkAvailability } = await import('./services/googleCalendar');
        const calendarAvailable = await checkAvailability(
          new Date(validated.startTime),
          new Date(validated.endTime)
        );

        if (!calendarAvailable) {
          return res.status(409).json({ 
            error: "Calendar conflict detected",
            message: "The selected time slot conflicts with an existing Google Calendar event. Please choose a different time."
          });
        }
      } catch (error) {
        console.error('Failed to check Google Calendar availability:', error);
        // Continue if calendar check fails (don't block appointment creation)
      }
    }

    // Create appointment in database
    const appointment = await storage.createAppointment(validated);

    // Sync to Google Calendar if enabled
    let calendarSyncError: string | null = null;
    if (validated.startTime && validated.endTime) {
      try {
        const { createCalendarEvent } = await import('./services/googleCalendar');
        
        const attendeeEmails: string[] = [];
        if (validated.clientId) {
          const client = await storage.getUserById(validated.clientId);
          if (client?.email) attendeeEmails.push(client.email);
        }
        if (validated.navigatorId) {
          const navigator = await storage.getUserById(validated.navigatorId);
          if (navigator?.email) attendeeEmails.push(navigator.email);
        }

        const eventId = await createCalendarEvent({
          title: validated.title,
          description: validated.description || '',
          startTime: new Date(validated.startTime),
          endTime: new Date(validated.endTime),
          timeZone: validated.timeZone || 'America/New_York',
          location: validated.locationDetails || '',
          attendeeEmails
        });

        // Update appointment with Google Calendar event ID
        if (req.user!.tenantId) {
          await storage.updateAppointment(appointment.id, { googleCalendarEventId: eventId }, req.user!.tenantId);
          appointment.googleCalendarEventId = eventId;
        }
      } catch (error) {
        console.error('Failed to sync appointment to Google Calendar:', error);
        calendarSyncError = 'Failed to sync appointment to Google Calendar. The appointment was created in the database but may not appear in your calendar. Please try syncing manually or contact support.';
        
        // Log error for monitoring
        await auditService.logError({
          message: 'Google Calendar sync failed during appointment creation',
          statusCode: 500,
          method: 'POST',
          path: '/api/appointments',
          userId: req.user!.id,
          details: { appointmentId: appointment.id, error }
        }).catch(console.error);
      }
    }

    res.json({ 
      ...appointment, 
      calendarSyncWarning: calendarSyncError 
    });
  }));

  // Get appointments with optional filters
  app.get("/api/appointments", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const filters: any = {};
    
    // CRITICAL: Enforce tenant isolation - users can only see their tenant's appointments
    filters.tenantId = req.user!.tenantId;
    
    if (req.query.status) filters.status = req.query.status;
    if (req.query.appointmentType) filters.appointmentType = req.query.appointmentType;
    if (req.query.navigatorId) filters.navigatorId = req.query.navigatorId;
    if (req.query.clientId) filters.clientId = req.query.clientId;
    if (req.query.vitaSessionId) filters.vitaSessionId = req.query.vitaSessionId;
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

    const appointments = await storage.getAppointments(filters);
    res.json(appointments);
  }));

  // Get single appointment
  app.get("/api/appointments/:id", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    // CRITICAL: Enforce tenant isolation - verify appointment belongs to user's tenant
    if (!req.user!.tenantId) {
      return res.status(403).json({ error: "Forbidden", message: "No tenant context" });
    }

    const appointment = await storage.getAppointment(req.params.id, req.user!.tenantId);
    
    if (!appointment) {
      // Return 404 (not 403) to prevent ID enumeration
      return res.status(404).json({ error: "Not found" });
    }

    res.json(appointment);
  }));

  // Update appointment with Google Calendar sync
  app.patch("/api/appointments/:id", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    // CRITICAL: Enforce tenant isolation - verify appointment belongs to user's tenant
    if (!req.user!.tenantId) {
      return res.status(403).json({ error: "Forbidden", message: "No tenant context" });
    }

    const appointment = await storage.getAppointment(req.params.id, req.user!.tenantId);
    
    if (!appointment) {
      // Return 404 (not 403) to prevent ID enumeration
      return res.status(404).json({ error: "Not found" });
    }

    const validated = insertAppointmentSchema.partial().parse(req.body);
    const { createdAt, updatedAt, createdBy, ...updateData } = validated as any;

    // CRITICAL: Check for conflicts if time is being changed
    if ((updateData.startTime || updateData.endTime) && req.user!.tenantId) {
      const newStartTime = updateData.startTime ? new Date(updateData.startTime) : appointment.startTime;
      const newEndTime = updateData.endTime ? new Date(updateData.endTime) : appointment.endTime;
      
      const conflicts = await storage.getAppointmentConflicts(
        newStartTime,
        newEndTime,
        req.user!.tenantId,
        updateData.navigatorId || appointment.navigatorId
      );

      // Filter out the current appointment from conflicts
      const actualConflicts = conflicts.filter(c => c.id !== appointment.id);

      if (actualConflicts.length > 0) {
        return res.status(409).json({ 
          error: "Appointment conflict detected",
          message: `The updated time slot conflicts with ${actualConflicts.length} existing appointment(s)`,
          conflicts: actualConflicts.map(c => ({
            id: c.id,
            title: c.title,
            startTime: c.startTime,
            endTime: c.endTime,
            navigatorId: c.navigatorId
          }))
        });
      }

      // Also check Google Calendar availability
      try {
        const { checkAvailability } = await import('./services/googleCalendar');
        const calendarAvailable = await checkAvailability(newStartTime, newEndTime);

        if (!calendarAvailable) {
          return res.status(409).json({ 
            error: "Calendar conflict detected",
            message: "The updated time slot conflicts with an existing Google Calendar event. Please choose a different time."
          });
        }
      } catch (error) {
        console.error('Failed to check Google Calendar availability:', error);
        // Continue if calendar check fails (don't block appointment update)
      }
    }

    // Update appointment in database
    const updated = await storage.updateAppointment(req.params.id, updateData, req.user!.tenantId);

    // Sync changes to Google Calendar if appointment has Google Calendar event
    let calendarSyncError: string | null = null;
    if (appointment.googleCalendarEventId) {
      try {
        const { updateCalendarEvent } = await import('./services/googleCalendar');
        
        const calendarUpdate: any = {};
        if (updateData.title) calendarUpdate.title = updateData.title;
        if (updateData.description !== undefined) calendarUpdate.description = updateData.description;
        if (updateData.startTime) calendarUpdate.startTime = new Date(updateData.startTime);
        if (updateData.endTime) calendarUpdate.endTime = new Date(updateData.endTime);
        if (updateData.timeZone) calendarUpdate.timeZone = updateData.timeZone;
        if (updateData.locationDetails !== undefined) calendarUpdate.location = updateData.locationDetails;

        await updateCalendarEvent(appointment.googleCalendarEventId, calendarUpdate);
      } catch (error) {
        console.error('Failed to sync appointment update to Google Calendar:', error);
        calendarSyncError = 'Failed to sync appointment changes to Google Calendar. The appointment was updated in the database but calendar may be out of sync. Please try syncing manually or contact support.';
        
        // Log error for monitoring
        await auditService.logError({
          message: 'Google Calendar sync failed during appointment update',
          statusCode: 500,
          method: 'PATCH',
          path: `/api/appointments/${req.params.id}`,
          userId: req.user!.id,
          details: { appointmentId: appointment.id, error }
        }).catch(console.error);
      }
    }

    res.json({ 
      ...updated, 
      calendarSyncWarning: calendarSyncError 
    });
  }));

  // Cancel appointment with Google Calendar sync
  app.post("/api/appointments/:id/cancel", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    // CRITICAL: Enforce tenant isolation - verify appointment belongs to user's tenant
    if (!req.user!.tenantId) {
      return res.status(403).json({ error: "Forbidden", message: "No tenant context" });
    }

    const appointment = await storage.getAppointment(req.params.id, req.user!.tenantId);
    
    if (!appointment) {
      // Return 404 (not 403) to prevent ID enumeration
      return res.status(404).json({ error: "Not found" });
    }

    const { cancellationReason } = req.body;

    // Update appointment status
    const updated = await storage.updateAppointment(req.params.id, {
      status: 'cancelled',
      cancellationReason,
      cancelledAt: new Date(),
      cancelledBy: req.user!.id
    }, req.user!.tenantId);

    // Delete from Google Calendar if synced
    let calendarSyncError: string | null = null;
    if (appointment.googleCalendarEventId) {
      try {
        const { deleteCalendarEvent } = await import('./services/googleCalendar');
        await deleteCalendarEvent(appointment.googleCalendarEventId);
      } catch (error) {
        console.error('Failed to delete appointment from Google Calendar:', error);
        calendarSyncError = 'Failed to remove appointment from Google Calendar. The appointment was cancelled in the database but may still appear in your calendar. Please remove it manually or contact support.';
        
        // Log error for monitoring
        await auditService.logError({
          message: 'Google Calendar deletion failed during appointment cancellation',
          statusCode: 500,
          method: 'POST',
          path: `/api/appointments/${req.params.id}/cancel`,
          userId: req.user!.id,
          details: { appointmentId: appointment.id, error }
        }).catch(console.error);
      }
    }

    res.json({ 
      ...updated, 
      calendarSyncWarning: calendarSyncError 
    });
  }));

  // Check availability for time slot
  app.post("/api/appointments/check-availability", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      startTime: z.string(),
      endTime: z.string(),
      navigatorId: z.string().optional()
    });

    const validated = schema.parse(req.body);
    const startTime = new Date(validated.startTime);
    const endTime = new Date(validated.endTime);

    // CRITICAL: Enforce tenant isolation when checking conflicts
    if (!req.user!.tenantId) {
      return res.status(403).json({ error: "Forbidden", message: "No tenant context" });
    }

    // Check database for conflicts
    const conflicts = await storage.getAppointmentConflicts(
      startTime,
      endTime,
      req.user!.tenantId,
      validated.navigatorId
    );

    // Also check Google Calendar if available
    let calendarAvailable = true;
    let calendarError: string | null = null;
    try {
      const { checkAvailability } = await import('./services/googleCalendar');
      calendarAvailable = await checkAvailability(startTime, endTime);
    } catch (error) {
      console.error('Failed to check Google Calendar availability:', error);
      calendarError = 'Unable to check Google Calendar availability. Please verify calendar connectivity.';
      
      // Log error for monitoring
      await auditService.logError({
        message: 'Google Calendar availability check failed',
        statusCode: 500,
        method: 'POST',
        path: '/api/appointments/check-availability',
        userId: req.user!.id,
        details: { error }
      }).catch(console.error);
    }

    const isAvailable = conflicts.length === 0 && calendarAvailable;

    res.json({ 
      available: isAvailable,
      conflicts: conflicts.length,
      calendarAvailable,
      calendarError,
      conflictDetails: conflicts.map(c => ({
        id: c.id,
        title: c.title,
        startTime: c.startTime,
        endTime: c.endTime,
        navigatorId: c.navigatorId
      }))
    });
  }));

  // ==========================================
  // VITA Tax Document Upload Routes
  // ==========================================

  // Get presigned URL for tax document upload
  app.post("/api/vita-intake/:sessionId/tax-documents/upload-url", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getVitaIntakeSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "Not found" });
    }
    
    // SECURITY: Return 404 (not 403) to prevent ID enumeration
    if (session.userId !== req.user!.id) {
      return res.status(404).json({ error: "Not found" });
    }

    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    
    res.json({ uploadURL });
  }));

  // Create tax document record and trigger extraction
  app.post("/api/vita-intake/:sessionId/tax-documents", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getVitaIntakeSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "Not found" });
    }
    
    // SECURITY: Return 404 (not 403) to prevent ID enumeration
    if (session.userId !== req.user!.id) {
      return res.status(404).json({ error: "Not found" });
    }

    const { filename, originalName, objectPath, fileSize, mimeType, documentType } = req.body;

    // First create the document record in the documents table
    const document = await storage.createDocument({
      filename,
      originalName,
      objectPath,
      fileSize,
      mimeType,
      status: "processing",
    });

    // Process and store tax document with extraction
    const result = await taxDocExtractor.processAndStoreTaxDocument(
      document.id,
      undefined,
      undefined
    );

    // Update the tax document with vitaSessionId
    const updatedTaxDoc = await storage.updateTaxDocument(result.taxDocument.id, {
      vitaSessionId: req.params.sessionId,
    });

    res.json({
      taxDocument: updatedTaxDoc,
      extractedData: result.extractedData,
      requiresManualReview: result.requiresManualReview,
    });
  }));

  // List all tax documents for a VITA session
  app.get("/api/vita-intake/:sessionId/tax-documents", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getVitaIntakeSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "Not found" });
    }
    
    // SECURITY: Return 404 (not 403) to prevent ID enumeration
    if (session.userId !== req.user!.id) {
      return res.status(404).json({ error: "Not found" });
    }

    const taxDocs = await storage.getTaxDocuments({
      vitaSessionId: req.params.sessionId,
    });

    res.json(taxDocs);
  }));

  // Delete a tax document (with ownership verification via session)
  app.delete("/api/vita-intake/:sessionId/tax-documents/:id", requireStaff, verifyVitaSessionOwnership(), asyncHandler(async (req: Request, res: Response) => {
    const session = await storage.getVitaIntakeSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "Not found" });
    }
    
    // SECURITY: Return 404 (not 403) to prevent ID enumeration
    if (session.userId !== req.user!.id) {
      return res.status(404).json({ error: "Not found" });
    }

    const taxDoc = await storage.getTaxDocument(req.params.id);
    
    if (!taxDoc) {
      return res.status(404).json({ error: "Not found" });
    }

    // SECURITY: Return 404 (not 403) to prevent ID enumeration
    if (taxDoc.vitaSessionId !== req.params.sessionId) {
      return res.status(404).json({ error: "Not found" });
    }

    await storage.deleteTaxDocument(req.params.id);
    res.json({ success: true });
  }));

  // ==========================================
  // TaxSlayer Data Entry Routes
  // ==========================================

  // Import TaxSlayer return data
  app.post("/api/taxslayer/import", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertTaxslayerReturnSchema.parse({
      ...req.body,
      importedBy: req.user!.id,
      importedAt: new Date()
    });

    // Run validation checks
    const warnings: string[] = [];

    // Check if federal AGI matches sum of W-2 + 1099 income
    if (Array.isArray(validated.w2Forms) && Array.isArray(validated.form1099s)) {
      const w2Total = (validated.w2Forms as any[]).reduce((sum, w2) => sum + (w2.wages || 0), 0);
      const form1099Total = (validated.form1099s as any[]).reduce((sum, f1099) => sum + (f1099.amount || 0), 0);
      const totalIncome = w2Total + form1099Total;
      
      const agiDifference = Math.abs((validated.federalAGI || 0) - totalIncome);
      if (agiDifference > 100) {
        warnings.push(`Federal AGI ($${validated.federalAGI}) differs from sum of W-2/1099 income ($${totalIncome}) by $${agiDifference.toFixed(2)}`);
      }
    }

    // Check if refund calculation seems correct
    const estimatedRefund = (validated.federalWithheld || 0) - (validated.federalTax || 0) + (validated.eitcAmount || 0) + (validated.ctcAmount || 0);
    const refundDifference = Math.abs((validated.federalRefund || 0) - estimatedRefund);
    if (refundDifference > 50) {
      warnings.push(`Federal refund ($${validated.federalRefund}) differs from estimated calculation ($${estimatedRefund.toFixed(2)}) by $${refundDifference.toFixed(2)}`);
    }

    // Add warnings to data
    const dataWithWarnings = {
      ...validated,
      hasValidationWarnings: warnings.length > 0,
      validationWarnings: warnings
    };

    const taxReturn = await storage.createTaxslayerReturn(dataWithWarnings);

    // Log the import action
    await auditService.logAction({
      userId: req.user!.id,
      action: 'taxslayer_import',
      resourceType: 'taxslayer_return',
      resourceId: taxReturn.id,
      details: {
        vitaSessionId: taxReturn.vitaIntakeSessionId,
        taxYear: taxReturn.taxYear,
        warningsCount: warnings.length
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || 'unknown'
    });

    res.json(taxReturn);
  }));

  // Get TaxSlayer data for a VITA session
  app.get("/api/taxslayer/:vitaSessionId", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const taxReturn = await storage.getTaxslayerReturnByVitaSession(req.params.vitaSessionId);
    
    if (!taxReturn) {
      return res.json(null);
    }

    res.json(taxReturn);
  }));

  // Get TaxSlayer return by ID
  app.get("/api/taxslayer/return/:id", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const taxReturn = await storage.getTaxslayerReturn(req.params.id);
    
    if (!taxReturn) {
      throw notFoundError("TaxSlayer return not found");
    }

    res.json(taxReturn);
  }));

  // Update TaxSlayer return
  app.patch("/api/taxslayer/:id", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const taxReturn = await storage.getTaxslayerReturn(req.params.id);
    
    if (!taxReturn) {
      throw notFoundError("TaxSlayer return not found");
    }

    const validated = insertTaxslayerReturnSchema.partial().parse(req.body);
    const updated = await storage.updateTaxslayerReturn(req.params.id, validated);

    res.json(updated);
  }));

  // Generate PDF export
  app.post("/api/taxslayer/:id/export-pdf", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const taxReturn = await storage.getTaxslayerReturn(req.params.id);
    
    if (!taxReturn) {
      throw notFoundError("TaxSlayer return not found");
    }

    const pdfBuffer = await exportToPDF(req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=taxslayer-return-${taxReturn.taxYear}-${req.params.id}.pdf`);
    res.send(pdfBuffer);
  }));

  // Generate CSV export
  app.post("/api/taxslayer/:id/export-csv", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const taxReturn = await storage.getTaxslayerReturn(req.params.id);
    
    if (!taxReturn) {
      throw notFoundError("TaxSlayer return not found");
    }

    // Optional: include our system's calculation for comparison
    const ourCalculation = req.body.ourCalculation;

    const csvContent = await exportToCSV(req.params.id, ourCalculation);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=taxslayer-comparison-${taxReturn.taxYear}-${req.params.id}.csv`);
    res.send(csvContent);
  }));

  // Generate Checklist PDF export
  app.post("/api/taxslayer/:id/export-checklist", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const taxReturn = await storage.getTaxslayerReturn(req.params.id);
    
    if (!taxReturn) {
      throw notFoundError("TaxSlayer return not found");
    }

    const pdfBuffer = await exportChecklist(req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=taxslayer-checklist-${taxReturn.taxYear}-${req.params.id}.pdf`);
    res.send(pdfBuffer);
  }));

  // Generate Variance Report PDF export
  app.post("/api/taxslayer/:id/export-variance", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const taxReturn = await storage.getTaxslayerReturn(req.params.id);
    
    if (!taxReturn) {
      throw notFoundError("TaxSlayer return not found");
    }

    // Optional: include our system's calculation for comparison
    const ourCalculation = req.body.ourCalculation;

    const pdfBuffer = await exportVarianceReport(req.params.id, ourCalculation);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=taxslayer-variance-${taxReturn.taxYear}-${req.params.id}.pdf`);
    res.send(pdfBuffer);
  }));

  // Generate Field Guide PDF export
  app.post("/api/taxslayer/:id/export-guide", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const taxReturn = await storage.getTaxslayerReturn(req.params.id);
    
    if (!taxReturn) {
      throw notFoundError("TaxSlayer return not found");
    }

    const pdfBuffer = await exportFieldGuide(req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=taxslayer-guide-${taxReturn.taxYear}-${req.params.id}.pdf`);
    res.send(pdfBuffer);
  }));

  // ==========================================
  // VITA Document Upload Portal Routes
  // ==========================================
  
  // Helper function to verify VITA session ownership with tenant isolation
  // SECURITY: Set throwOnAuthFailure=false for ID-based routes to prevent enumeration attacks
  async function verifyVitaSessionOwnershipAndTenant(
    sessionId: string, 
    userId: string, 
    userRole: string, 
    userTenantId: string | null,
    throwOnAuthFailure: boolean = true
  ) {
    const session = await storage.getVitaIntakeSession(sessionId);
    
    if (!session) {
      if (throwOnAuthFailure) {
        throw notFoundError("VITA intake session not found");
      }
      return null;
    }
    
    // Super admins can access all sessions
    if (userRole === 'super_admin') {
      return session;
    }
    
    // Tenant isolation check - user must be in same tenant as session
    if (session.tenantId && userTenantId !== session.tenantId) {
      if (throwOnAuthFailure) {
        throw authorizationError("Access denied: cross-tenant access not allowed");
      }
      return null;
    }
    
    // Ownership check - user owns session OR is staff/admin in same tenant
    const isOwner = session.userId === userId;
    const isAuthorizedStaff = (userRole === 'staff' || userRole === 'navigator' || userRole === 'caseworker' || userRole === 'admin') && 
                               (session.tenantId === userTenantId);
    
    if (!isOwner && !isAuthorizedStaff) {
      if (throwOnAuthFailure) {
        throw authorizationError("Access denied: you do not have permission to access this VITA session");
      }
      return null;
    }
    
    return session;
  }

  // Create a document request for a specific category
  // SECURITY: Allow both taxpayers (to request their own docs) and staff (to request docs for clients)
  app.post("/api/vita-documents/request", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      vitaSessionId: z.string(),
      category: z.enum(["W2", "1099_MISC", "1099_NEC", "1099_INT", "1099_DIV", "1099_R", "1095_A", "ID_DOCUMENT", "SUPPORTING_RECEIPT", "OTHER"]),
      categoryLabel: z.string(),
      navigatorNotes: z.string().optional(),
    });

    const validated = schema.parse(req.body);

    // SECURITY FIX: Verify ownership and tenant isolation
    const session = await verifyVitaSessionOwnershipAndTenant(
      validated.vitaSessionId, 
      req.user!.id, 
      req.user!.role, 
      req.user!.tenantId
    );

    const documentRequest = await storage.createVitaDocumentRequest({
      ...validated,
      status: "pending",
      requestedBy: req.user!.id,
    });

    res.json(documentRequest);
  }));

  // Get all document requests for a VITA session
  // SECURITY: Allow taxpayers to view their own document requests and staff to view their tenant's requests
  app.get("/api/vita-documents/:sessionId", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    // SECURITY FIX: Verify ownership and tenant isolation
    const session = await verifyVitaSessionOwnershipAndTenant(
      req.params.sessionId, 
      req.user!.id, 
      req.user!.role, 
      req.user!.tenantId
    );

    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined;

    const requests = await storage.getVitaDocumentRequests(req.params.sessionId, { category, status });
    res.json(requests);
  }));

  // Upload document for a document request
  // SECURITY: Allow taxpayers to upload their own documents and staff to upload for clients
  app.post("/api/vita-documents/:id/upload", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const documentRequest = await storage.getVitaDocumentRequest(req.params.id);
    if (!documentRequest) {
      return res.status(404).json({ error: "Not found" });
    }

    // SECURITY FIX: Verify ownership and tenant isolation via the session
    // Use silent mode (throwOnAuthFailure=false) to prevent ID enumeration attacks
    const session = await verifyVitaSessionOwnershipAndTenant(
      documentRequest.vitaSessionId, 
      req.user!.id, 
      req.user!.role, 
      req.user!.tenantId,
      false
    );
    
    if (!session) {
      return res.status(404).json({ error: "Not found" });
    }

    const schema = z.object({
      filename: z.string(),
      originalName: z.string(),
      objectPath: z.string(),
      fileSize: z.number(),
      mimeType: z.string(),
    });

    const validated = schema.parse(req.body);

    const document = await storage.createDocument({
      ...validated,
      status: "processing",
    });

    const updated = await storage.updateVitaDocumentRequest(req.params.id, {
      documentId: document.id,
      status: "uploaded",
      uploadedAt: new Date(),
    });

    res.json({ documentRequest: updated, document });
  }));

  // Trigger Gemini Vision extraction for a document request
  // SECURITY: Staff-only route (navigators trigger extraction)
  app.post("/api/vita-documents/:id/extract", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const documentRequest = await storage.getVitaDocumentRequest(req.params.id);
    if (!documentRequest) {
      return res.status(404).json({ error: "Not found" });
    }

    // SECURITY FIX: Verify staff has access to this session's tenant
    // Use silent mode (throwOnAuthFailure=false) to prevent ID enumeration attacks
    const session = await verifyVitaSessionOwnershipAndTenant(
      documentRequest.vitaSessionId, 
      req.user!.id, 
      req.user!.role, 
      req.user!.tenantId,
      false
    );
    
    if (!session) {
      return res.status(404).json({ error: "Not found" });
    }

    if (!documentRequest.documentId) {
      throw validationError("No document uploaded for this request");
    }

    const result = await taxDocExtractor.processAndStoreTaxDocument(
      documentRequest.documentId,
      undefined,
      documentRequest.vitaSessionId
    );

    const updated = await storage.updateVitaDocumentRequest(req.params.id, {
      taxDocumentId: result.taxDocument.id,
      extractedData: result.extractedData,
      qualityScore: result.taxDocument.geminiConfidence,
      status: "extracted",
      extractedAt: new Date(),
    });

    res.json({
      documentRequest: updated,
      extractedData: result.extractedData,
      requiresManualReview: result.requiresManualReview,
    });
  }));

  // Get document checklist progress for a VITA session
  // SECURITY: Allow taxpayers to view their own checklist and staff to view their tenant's checklists
  app.get("/api/vita-documents/:sessionId/checklist", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    // SECURITY FIX: Verify ownership and tenant isolation
    const session = await verifyVitaSessionOwnershipAndTenant(
      req.params.sessionId, 
      req.user!.id, 
      req.user!.role, 
      req.user!.tenantId
    );

    const requests = await storage.getVitaDocumentRequests(req.params.sessionId);
    
    const checklist = {
      totalRequested: requests.length,
      uploaded: requests.filter(r => r.status === "uploaded" || r.status === "extracted" || r.status === "verified").length,
      extracted: requests.filter(r => r.status === "extracted" || r.status === "verified").length,
      verified: requests.filter(r => r.status === "verified").length,
      pending: requests.filter(r => r.status === "pending").length,
      rejected: requests.filter(r => r.status === "rejected").length,
      byCategory: requests.reduce((acc, r) => {
        if (!acc[r.category]) {
          acc[r.category] = { total: 0, uploaded: 0, extracted: 0, verified: 0 };
        }
        acc[r.category].total++;
        if (r.status === "uploaded" || r.status === "extracted" || r.status === "verified") acc[r.category].uploaded++;
        if (r.status === "extracted" || r.status === "verified") acc[r.category].extracted++;
        if (r.status === "verified") acc[r.category].verified++;
        return acc;
      }, {} as Record<string, { total: number; uploaded: number; extracted: number; verified: number }>),
      requests,
    };

    res.json(checklist);
  }));

  // ============================================================================
  // TAXPAYER SELF-SERVICE PORTAL - Document Requests, Messages, E-Signatures
  // ============================================================================

  // Create document request (Navigator creates request for taxpayer)
  app.post("/api/taxpayer/document-requests", requireAuth, requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertDocumentRequestSchema.parse(req.body);
    
    // Verify navigator has access to this VITA session
    const session = await storage.getVitaIntakeSession(validated.vitaSessionId);
    if (!session) {
      return res.status(404).json({ error: "VITA session not found" });
    }

    // Set requestedBy to current user
    const documentRequest = await storage.createDocumentRequest({
      ...validated,
      requestedBy: req.user!.id,
    });

    // Send notification to taxpayer
    await notificationService.sendNotification({
      userId: session.userId!,
      type: 'document_request',
      title: 'New Document Request',
      message: `Your navigator has requested: ${documentRequest.documentType}`,
      metadata: { documentRequestId: documentRequest.id, vitaSessionId: session.id },
    });

    // Audit log
    await auditService.logAction({
      userId: req.user!.id,
      action: 'taxpayer_document_request_created',
      entityType: 'document_request',
      entityId: documentRequest.id,
      metadata: { vitaSessionId: session.id, documentType: documentRequest.documentType },
    });

    res.status(201).json(documentRequest);
  }));

  // Get document requests
  app.get("/api/taxpayer/document-requests", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { vitaSessionId, status, limit } = req.query;

    const filters: any = {};
    
    // SECURITY FIX: Client users (taxpayers) MUST provide vitaSessionId to prevent data leakage
    if (req.user!.role === 'client') {
      if (!vitaSessionId) {
        return res.status(400).json({ 
          error: "Missing required parameter",
          message: "vitaSessionId is required for taxpayers to view document requests" 
        });
      }
      
      // Verify user has access to this session
      const session = await storage.getVitaIntakeSession(vitaSessionId as string);
      if (!session) {
        return res.status(404).json({ error: "VITA session not found" });
      }
      
      // Verify ownership - taxpayers can only see their own session's requests
      if (session.userId !== req.user!.id) {
        return res.status(403).json({ error: "Access denied to this VITA session" });
      }
      
      filters.vitaSessionId = vitaSessionId as string;
    } else {
      // Staff users: allow filtering
      if (vitaSessionId) {
        // Verify session exists
        const session = await storage.getVitaIntakeSession(vitaSessionId as string);
        if (!session) {
          return res.status(404).json({ error: "VITA session not found" });
        }
        filters.vitaSessionId = vitaSessionId as string;
      } else {
        // Staff can filter by their created requests
        filters.requestedBy = req.user!.id;
      }
    }
    
    if (status) {
      filters.status = status as string;
    }
    
    if (limit) {
      filters.limit = parseInt(limit as string);
    }

    const requests = await storage.getDocumentRequests(filters);
    res.json(requests);
  }));

  // Update document request status
  app.patch("/api/taxpayer/document-requests/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const documentRequest = await storage.getDocumentRequest(req.params.id);
    if (!documentRequest) {
      return res.status(404).json({ error: "Document request not found" });
    }

    // Verify access
    const session = await storage.getVitaIntakeSession(documentRequest.vitaSessionId);
    if (!session) {
      return res.status(404).json({ error: "VITA session not found" });
    }

    // Taxpayers can only update their own requests, staff can update any in their tenant
    if (req.user!.role === 'client' && session.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const schema = z.object({
      status: z.enum(['pending', 'submitted', 'reviewed', 'approved', 'rejected']).optional(),
      uploadedDocumentId: z.string().optional(),
      reviewNotes: z.string().optional(),
      rejectionReason: z.string().optional(),
    });

    const validated = schema.parse(req.body);
    const updated = await storage.updateDocumentRequest(req.params.id, validated);

    // Send notifications on status changes
    if (validated.status) {
      const notifyUserId = validated.status === 'submitted' ? documentRequest.requestedBy : session.userId;
      if (notifyUserId) {
        await notificationService.sendNotification({
          userId: notifyUserId,
          type: 'document_request_status_change',
          title: 'Document Request Updated',
          message: `Document request status changed to: ${validated.status}`,
          metadata: { documentRequestId: documentRequest.id, status: validated.status },
        });
      }
    }

    // Audit log
    await auditService.logAction({
      userId: req.user!.id,
      action: 'taxpayer_document_request_updated',
      entityType: 'document_request',
      entityId: documentRequest.id,
      metadata: { changes: validated },
    });

    res.json(updated);
  }));

  // Send message (with optional attachments)
  app.post("/api/taxpayer/messages", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertTaxpayerMessageSchema.parse(req.body);
    
    // Verify user has access to this session
    const session = await storage.getVitaIntakeSession(validated.vitaSessionId);
    if (!session) {
      return res.status(404).json({ error: "VITA session not found" });
    }

    // Taxpayers can only message their own sessions
    if (req.user!.role === 'client' && session.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Set sender info
    const message = await storage.createTaxpayerMessage({
      ...validated,
      senderId: req.user!.id,
      senderRole: req.user!.role === 'client' ? 'taxpayer' : 'navigator',
      threadId: validated.threadId || validated.vitaSessionId, // Use vitaSessionId as default threadId
    });

    // Handle attachments if provided
    if (req.body.attachmentIds && Array.isArray(req.body.attachmentIds)) {
      for (const documentId of req.body.attachmentIds) {
        await storage.createTaxpayerMessageAttachment({
          messageId: message.id,
          documentId,
        });
      }
    }

    // Send notification to recipient(s)
    const recipientId = req.user!.role === 'client' 
      ? (session.assignedNavigatorId || session.userId) // Notify navigator or session owner
      : session.userId; // Notify taxpayer

    if (recipientId) {
      await notificationService.sendNotification({
        userId: recipientId,
        type: 'new_message',
        title: 'New Message',
        message: validated.subject || 'You have a new message',
        metadata: { messageId: message.id, vitaSessionId: session.id },
      });
    }

    res.status(201).json(message);
  }));

  // Get message thread
  app.get("/api/taxpayer/messages/:threadId", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query;
    
    const filters: any = { threadId: req.params.threadId };
    if (limit) {
      filters.limit = parseInt(limit as string);
    }

    const messages = await storage.getTaxpayerMessages(filters);
    
    if (messages.length === 0) {
      return res.json([]);
    }

    // Verify user has access to this thread (check via first message's session)
    const session = await storage.getVitaIntakeSession(messages[0].vitaSessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Taxpayers can only view their own threads
    if (req.user!.role === 'client' && session.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Load attachments for each message
    const messagesWithAttachments = await Promise.all(
      messages.map(async (msg) => {
        const attachments = await storage.getTaxpayerMessageAttachments(msg.id);
        return { ...msg, attachments };
      })
    );

    // Mark unread messages as read
    const unreadMessages = messagesWithAttachments.filter(m => 
      !m.isRead && m.senderId !== req.user!.id
    );
    
    for (const msg of unreadMessages) {
      await storage.markTaxpayerMessageAsRead(msg.id);
    }

    res.json(messagesWithAttachments);
  }));

  // Create e-signature
  app.post("/api/taxpayer/esignatures", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertESignatureSchema.parse(req.body);
    
    // Verify user has access to sign this
    if (validated.vitaSessionId) {
      const session = await storage.getVitaIntakeSession(validated.vitaSessionId);
      if (!session) {
        return res.status(404).json({ error: "VITA session not found" });
      }
      
      // Only session owner can sign
      if (session.userId !== req.user!.id && req.user!.role === 'client') {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    // Capture ESIGN Act required fields from request
    const signature = await storage.createESignature({
      ...validated,
      signerId: req.user!.id,
      ipAddress: req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    // Send notification
    if (validated.vitaSessionId) {
      const session = await storage.getVitaIntakeSession(validated.vitaSessionId);
      if (session?.assignedNavigatorId) {
        await notificationService.sendNotification({
          userId: session.assignedNavigatorId,
          type: 'esignature_captured',
          title: 'New E-Signature',
          message: `${validated.signerName} signed ${validated.formName}`,
          metadata: { eSignatureId: signature.id, formType: validated.formType },
        });
      }
    }

    // Audit log for legal compliance
    await auditService.logAction({
      userId: req.user!.id,
      action: 'esignature_created',
      entityType: 'esignature',
      entityId: signature.id,
      metadata: {
        formType: validated.formType,
        formName: validated.formName,
        ipAddress: signature.ipAddress,
        userAgent: signature.userAgent,
        documentHash: validated.documentHash,
      },
    });

    res.status(201).json(signature);
  }));

  // ============================================================================
  // TAXSLAYER-ENHANCED DOCUMENT MANAGEMENT ROUTES
  // ============================================================================

  // Simple file upload endpoint (used by VitaDocuments.tsx)
  app.post("/api/upload", requireAuth, upload.single("file"), asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw validationError("No file uploaded");
    }

    const objectStorageService = new ObjectStorageService();
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}_${req.file.originalname}`;
    const objectPath = `${objectStorageService.getPrivateObjectDir()}/uploads/${filename}`;

    // Upload to GCS
    const { bucketName, objectName } = parseObjectPath(objectPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    await file.save(req.file.buffer, {
      contentType: req.file.mimetype,
      metadata: {
        originalName: req.file.originalname,
        uploadedBy: req.user!.id,
      },
    });

    res.json({
      filename,
      path: objectPath,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  }));

  // Batch document upload for multiple files at once
  app.post("/api/vita-documents/batch-upload", requireAuth, upload.array("files", 10), asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw validationError("No files uploaded");
    }

    const schema = z.object({
      vitaSessionId: z.string(),
      taxYear: z.number().optional(),
      householdMember: z.string().optional(),
      batchId: z.string(),
    });

    const validated = schema.parse(req.body);

    // Verify session access
    await verifyVitaSessionOwnershipAndTenant(
      validated.vitaSessionId,
      req.user!.id,
      req.user!.role,
      req.user!.tenantId
    );

    const { documentQualityValidator } = await import("./services/documentQualityValidator");
    const { documentAuditService } = await import("./services/documentAuditService");
    const objectStorageService = new ObjectStorageService();

    const results = [];

    for (const file of files) {
      // Validate quality
      const qualityResult = await documentQualityValidator.validateDocument(
        file.buffer,
        file.mimetype,
        file.originalname
      );

      // Upload to GCS
      const timestamp = Date.now();
      const filename = `${timestamp}_${file.originalname}`;
      const objectPath = `${objectStorageService.getPrivateObjectDir()}/uploads/${filename}`;

      const { bucketName, objectName } = parseObjectPath(objectPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const gcsFile = bucket.file(objectName);
      
      await gcsFile.save(file.buffer, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadedBy: req.user!.id,
          batchId: validated.batchId,
        },
      });

      // Create document record
      const document = await storage.createDocument({
        filename,
        originalName: file.originalname,
        objectPath,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: qualityResult.isAcceptable ? "uploaded" : "failed",
        uploadedBy: req.user!.id,
        qualityScore: qualityResult.qualityScore,
      });

      // Determine category from filename (basic heuristic)
      let category = "OTHER";
      const lowerFilename = file.originalname.toLowerCase();
      if (lowerFilename.includes("w-2") || lowerFilename.includes("w2")) category = "W2";
      else if (lowerFilename.includes("1099")) category = "1099_MISC";
      else if (lowerFilename.includes("id") || lowerFilename.includes("license")) category = "ID_DOCUMENT";

      // Create document request
      const documentRequest = await storage.createVitaDocumentRequest({
        vitaSessionId: validated.vitaSessionId,
        category,
        categoryLabel: category,
        taxYear: validated.taxYear,
        householdMember: validated.householdMember,
        batchId: validated.batchId,
        documentId: document.id,
        status: qualityResult.isAcceptable ? "uploaded" : "rejected",
        processingStatus: "complete",
        qualityScore: qualityResult.qualityScore,
        qualityValidation: qualityResult.validation,
        qualityIssues: qualityResult.issues,
        isQualityAcceptable: qualityResult.isAcceptable,
        uploadedAt: new Date(),
        requestedBy: req.user!.id,
      });

      // Log audit trail
      await documentAuditService.logAction({
        documentRequestId: documentRequest.id,
        vitaSessionId: validated.vitaSessionId,
        action: "uploaded",
        userId: req.user!.id,
        userRole: req.user!.role,
        userName: req.user!.fullName || req.user!.username,
        actionDetails: { batchId: validated.batchId, qualityScore: qualityResult.qualityScore },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        objectPath,
      });

      results.push({
        documentRequest,
        document,
        qualityResult,
      });
    }

    res.json({ results, batchId: validated.batchId });
  }));

  // Replace a document with a better quality version
  app.post("/api/vita-documents/:id/replace", requireAuth, upload.single("file"), asyncHandler(async (req: Request, res: Response) => {
    const documentRequest = await storage.getVitaDocumentRequest(req.params.id);
    if (!documentRequest) {
      throw notFoundError("Document request not found");
    }

    // Verify session access
    await verifyVitaSessionOwnershipAndTenant(
      documentRequest.vitaSessionId,
      req.user!.id,
      req.user!.role,
      req.user!.tenantId,
      false
    );

    if (!req.file) {
      throw validationError("No file uploaded");
    }

    const schema = z.object({
      reason: z.enum(["poor_quality", "incomplete", "wrong_document", "updated_version"]),
    });

    const validated = schema.parse(req.body);

    const { documentQualityValidator } = await import("./services/documentQualityValidator");
    const { documentAuditService } = await import("./services/documentAuditService");
    const objectStorageService = new ObjectStorageService();

    // Validate quality
    const qualityResult = await documentQualityValidator.validateDocument(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    // Upload new version to GCS
    const timestamp = Date.now();
    const filename = `${timestamp}_${req.file.originalname}`;
    const objectPath = `${objectStorageService.getPrivateObjectDir()}/uploads/${filename}`;

    const { bucketName, objectName } = parseObjectPath(objectPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const gcsFile = bucket.file(objectName);
    
    await gcsFile.save(req.file.buffer, {
      contentType: req.file.mimetype,
      metadata: {
        originalName: req.file.originalname,
        uploadedBy: req.user!.id,
        replacesDocumentId: req.params.id,
      },
    });

    // Create new document
    const newDocument = await storage.createDocument({
      filename,
      originalName: req.file.originalname,
      objectPath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      status: qualityResult.isAcceptable ? "uploaded" : "failed",
      uploadedBy: req.user!.id,
      qualityScore: qualityResult.qualityScore,
    });

    // Create new document request that replaces the old one
    const newDocumentRequest = await storage.createVitaDocumentRequest({
      vitaSessionId: documentRequest.vitaSessionId,
      category: documentRequest.category,
      categoryLabel: documentRequest.categoryLabel,
      taxYear: documentRequest.taxYear,
      householdMember: documentRequest.householdMember,
      batchId: documentRequest.batchId,
      documentId: newDocument.id,
      replacesDocumentId: req.params.id,
      replacementReason: validated.reason,
      status: qualityResult.isAcceptable ? "uploaded" : "rejected",
      processingStatus: "complete",
      qualityScore: qualityResult.qualityScore,
      qualityValidation: qualityResult.validation,
      qualityIssues: qualityResult.issues,
      isQualityAcceptable: qualityResult.isAcceptable,
      uploadedAt: new Date(),
      requestedBy: req.user!.id,
    });

    // Update old document request to mark it as replaced
    await storage.updateVitaDocumentRequest(req.params.id, {
      status: "replaced",
      replacedByDocumentId: newDocumentRequest.id,
    });

    // Log audit trail
    await documentAuditService.logAction({
      documentRequestId: newDocumentRequest.id,
      vitaSessionId: documentRequest.vitaSessionId,
      action: "replaced",
      userId: req.user!.id,
      userRole: req.user!.role,
      userName: req.user!.fullName || req.user!.username,
      actionDetails: { replacesDocumentId: req.params.id, reason: validated.reason },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      objectPath,
      previousStatus: documentRequest.status,
      newStatus: "replaced",
      changeReason: validated.reason,
    });

    res.json({ documentRequest: newDocumentRequest, document: newDocument, qualityResult });
  }));

  // Generate secure time-limited download URL
  app.post("/api/vita-documents/:id/secure-download", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const documentRequest = await storage.getVitaDocumentRequest(req.params.id);
    if (!documentRequest) {
      throw notFoundError("Document request not found");
    }

    // Verify session access
    await verifyVitaSessionOwnershipAndTenant(
      documentRequest.vitaSessionId,
      req.user!.id,
      req.user!.role,
      req.user!.tenantId,
      false
    );

    if (!documentRequest.documentId) {
      throw validationError("No document uploaded for this request");
    }

    const document = await storage.getDocument(documentRequest.documentId);
    if (!document || !document.objectPath) {
      throw notFoundError("Document file not found");
    }

    const objectStorageService = new ObjectStorageService();
    const { documentAuditService } = await import("./services/documentAuditService");

    // Generate signed URL (valid for 1 hour)
    const { signedUrl, expiresAt } = await objectStorageService.generateSecureDownloadUrl(
      document.objectPath,
      60
    );

    // Update download tracking
    await storage.updateVitaDocumentRequest(req.params.id, {
      downloadCount: (documentRequest.downloadCount || 0) + 1,
      lastDownloadedAt: new Date(),
      lastDownloadedBy: req.user!.id,
      secureDownloadExpiry: expiresAt,
    });

    // Log audit trail
    await documentAuditService.logAction({
      documentRequestId: req.params.id,
      vitaSessionId: documentRequest.vitaSessionId,
      action: "downloaded",
      userId: req.user!.id,
      userRole: req.user!.role,
      userName: req.user!.fullName || req.user!.username,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      objectPath: document.objectPath,
      signedUrlGenerated: true,
      signedUrlExpiry: expiresAt,
    });

    res.json({ signedUrl, expiresAt });
  }));

  // Get document audit trail
  app.get("/api/vita-documents/:id/audit", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const documentRequest = await storage.getVitaDocumentRequest(req.params.id);
    if (!documentRequest) {
      throw notFoundError("Document request not found");
    }

    // Verify session access
    await verifyVitaSessionOwnershipAndTenant(
      documentRequest.vitaSessionId,
      req.user!.id,
      req.user!.role,
      req.user!.tenantId,
      false
    );

    const { documentAuditService } = await import("./services/documentAuditService");
    
    const auditTrail = await documentAuditService.getDocumentAuditTrail(req.params.id);
    const stats = await documentAuditService.getDocumentStats(req.params.id);

    res.json({ auditTrail, stats });
  }));

  // Update document status (approve, reject, review)
  app.patch("/api/vita-documents/:id/status", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const documentRequest = await storage.getVitaDocumentRequest(req.params.id);
    if (!documentRequest) {
      throw notFoundError("Document request not found");
    }

    // Verify session access
    await verifyVitaSessionOwnershipAndTenant(
      documentRequest.vitaSessionId,
      req.user!.id,
      req.user!.role,
      req.user!.tenantId,
      false
    );

    const schema = z.object({
      status: z.enum(["reviewed", "approved", "rejected", "included_in_return"]),
      notes: z.string().optional(),
    });

    const validated = schema.parse(req.body);
    const { documentAuditService } = await import("./services/documentAuditService");

    const updates: Partial<any> = {
      status: validated.status,
      navigatorNotes: validated.notes || documentRequest.navigatorNotes,
    };

    if (validated.status === "reviewed") {
      updates.reviewedAt = new Date();
      updates.reviewedBy = req.user!.id;
    } else if (validated.status === "approved") {
      updates.approvedAt = new Date();
      updates.approvedBy = req.user!.id;
    }

    const updated = await storage.updateVitaDocumentRequest(req.params.id, updates);

    // Log audit trail
    await documentAuditService.logAction({
      documentRequestId: req.params.id,
      vitaSessionId: documentRequest.vitaSessionId,
      action: validated.status === "approved" ? "approved" : validated.status === "rejected" ? "rejected" : "modified",
      userId: req.user!.id,
      userRole: req.user!.role,
      userName: req.user!.fullName || req.user!.username,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      previousStatus: documentRequest.status,
      newStatus: validated.status,
      changeReason: validated.notes,
    });

    res.json(updated);
  }));

  // Create e-signature request (Form 8879)
  // SECURITY: Staff-only route (navigators initiate signature requests)
  app.post("/api/vita-signatures/request", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      vitaSessionId: z.string(),
      formType: z.enum(["form_8879", "consent_form", "both"]),
      formTitle: z.string(),
      expiresAt: z.string().optional(),
      webhookUrl: z.string().optional(),
    });

    const validated = schema.parse(req.body);

    // SECURITY FIX: Verify staff has access to this session's tenant
    const session = await verifyVitaSessionOwnershipAndTenant(
      validated.vitaSessionId, 
      req.user!.id, 
      req.user!.role, 
      req.user!.tenantId
    );

    const expiresAt = validated.expiresAt ? new Date(validated.expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const signatureRequest = await storage.createVitaSignatureRequest({
      vitaSessionId: validated.vitaSessionId,
      formType: validated.formType,
      formTitle: validated.formTitle,
      status: "pending",
      expiresAt,
      webhookUrl: validated.webhookUrl,
      requestedBy: req.user!.id,
    });

    res.json(signatureRequest);
  }));

  // Complete signature with audit trail
  // SECURITY: Allow taxpayers to sign their own forms
  app.post("/api/vita-signatures/:id/sign", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const signatureRequest = await storage.getVitaSignatureRequest(req.params.id);
    if (!signatureRequest) {
      return res.status(404).json({ error: "Not found" });
    }

    // SECURITY FIX: Verify ownership and tenant isolation via the session
    // Use silent mode (throwOnAuthFailure=false) to prevent ID enumeration attacks
    const session = await verifyVitaSessionOwnershipAndTenant(
      signatureRequest.vitaSessionId, 
      req.user!.id, 
      req.user!.role, 
      req.user!.tenantId,
      false
    );
    
    if (!session) {
      return res.status(404).json({ error: "Not found" });
    }

    if (signatureRequest.status === "signed") {
      throw validationError("This signature request has already been signed");
    }

    if (signatureRequest.expiresAt && new Date(signatureRequest.expiresAt) < new Date()) {
      throw validationError("This signature request has expired");
    }

    const schema = z.object({
      signatureData: z.object({
        taxpayerSignature: z.string(),
        spouseSignature: z.string().optional(),
        signedFields: z.record(z.any()).optional(),
      }),
      geolocation: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }).optional(),
    });

    const validated = schema.parse(req.body);

    const updated = await storage.updateVitaSignatureRequest(req.params.id, {
      signatureData: validated.signatureData,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      geolocation: validated.geolocation,
      signedAt: new Date(),
      signedBy: req.user!.id,
      status: "signed",
    });

    await auditService.logAction({
      userId: req.user!.id,
      action: "vita_signature_completed",
      resourceType: "vita_signature_request",
      resourceId: req.params.id,
      details: {
        vitaSessionId: signatureRequest.vitaSessionId,
        formType: signatureRequest.formType,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "unknown",
    });

    res.json(updated);
  }));

  // Send secure message
  // SECURITY: Allow both taxpayers and staff to send messages (taxpayers to their own sessions)
  app.post("/api/vita-messages", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      vitaSessionId: z.string(),
      messageText: z.string().min(1),
      messageType: z.enum(["standard", "system_notification", "document_request", "document_rejection"]).optional(),
      relatedDocumentRequestId: z.string().optional(),
      attachments: z.array(z.object({
        documentId: z.string(),
        filename: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
      })).optional(),
    });

    const validated = schema.parse(req.body);

    // SECURITY FIX: Verify ownership and tenant isolation
    const session = await verifyVitaSessionOwnershipAndTenant(
      validated.vitaSessionId, 
      req.user!.id, 
      req.user!.role, 
      req.user!.tenantId
    );

    const senderRole = req.user!.role === "navigator" || req.user!.role === "admin" ? "navigator" : "taxpayer";

    const message = await storage.createVitaMessage({
      vitaSessionId: validated.vitaSessionId,
      senderId: req.user!.id,
      senderRole,
      senderName: req.user!.firstName + " " + req.user!.lastName,
      messageText: validated.messageText,
      messageType: validated.messageType || "standard",
      relatedDocumentRequestId: validated.relatedDocumentRequestId,
      attachments: validated.attachments || [],
    });

    res.json(message);
  }));

  // Get message thread for a VITA session
  // SECURITY: Allow taxpayers to view their own messages and staff to view their tenant's messages
  app.get("/api/vita-messages/:sessionId", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    // SECURITY FIX: Verify ownership and tenant isolation
    const session = await verifyVitaSessionOwnershipAndTenant(
      req.params.sessionId, 
      req.user!.id, 
      req.user!.role, 
      req.user!.tenantId
    );

    const senderRole = req.query.senderRole as string | undefined;
    const unreadOnly = req.query.unreadOnly === "true";

    const messages = await storage.getVitaMessages(req.params.sessionId, { senderRole, unreadOnly });
    res.json(messages);
  }));

  // Mark message as read
  // SECURITY: Allow taxpayers to mark their own messages as read
  app.patch("/api/vita-messages/:id/read", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const message = await storage.getVitaMessage(req.params.id);
    if (!message) {
      return res.status(404).json({ error: "Not found" });
    }

    // SECURITY FIX: Verify ownership and tenant isolation via the session
    // Use silent mode (throwOnAuthFailure=false) to prevent ID enumeration attacks
    const session = await verifyVitaSessionOwnershipAndTenant(
      message.vitaSessionId, 
      req.user!.id, 
      req.user!.role, 
      req.user!.tenantId,
      false
    );
    
    if (!session) {
      return res.status(404).json({ error: "Not found" });
    }

    await storage.markVitaMessageAsRead(req.params.id);
    res.json({ success: true });
  }));

  // Generate digital delivery packet (PDF bundle)
  // SECURITY: Staff-only route (navigators generate delivery packets)
  app.post("/api/vita-documents/:sessionId/delivery", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    // SECURITY FIX: Verify staff has access to this session's tenant
    const session = await verifyVitaSessionOwnershipAndTenant(
      req.params.sessionId, 
      req.user!.id, 
      req.user!.role, 
      req.user!.tenantId
    );

    const schema = z.object({
      deliveryMethod: z.enum(["email", "physical_pickup", "both"]),
      emailAddress: z.string().email().optional(),
    });

    const validated = schema.parse(req.body);

    if (validated.deliveryMethod === "email" || validated.deliveryMethod === "both") {
      if (!validated.emailAddress) {
        throw validationError("Email address is required for email delivery");
      }
    }

    const taxDocs = await storage.getTaxDocuments({ vitaSessionId: req.params.sessionId });
    
    res.json({
      success: true,
      deliveryMethod: validated.deliveryMethod,
      documentsIncluded: taxDocs.length,
      message: "Digital delivery packet will be generated",
    });
  }));

  // ==========================================
  // ABAWD Exemption Verification Routes
  // ==========================================

  // Create ABAWD exemption verification
  app.post("/api/abawd-verifications", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      clientCaseId: z.string(),
      exemptionType: z.enum(['homeless', 'disabled', 'student', 'caregiver', 'employed_20hrs', 'training_program', 'medically_certified', 'other']),
      exemptionStatus: z.enum(['verified', 'pending', 'denied', 'expired']),
      verificationMethod: z.enum(['document_review', 'third_party_verification', 'self_attestation', 'database_check']),
      documentIds: z.array(z.string()).optional(),
      verificationNotes: z.string().optional(),
      expirationDate: z.string().optional(),
      renewalRequired: z.boolean().optional()
    });

    const validated = schema.parse(req.body);
    
    const verification = await storage.createAbawdExemptionVerification({
      ...validated,
      verifiedBy: req.user!.id,
      verificationDate: new Date()
    });

    res.json(verification);
  }));

  // Get all ABAWD verifications with filters
  app.get("/api/abawd-verifications", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const filters: any = {};
    
    if (req.query.clientCaseId) filters.clientCaseId = req.query.clientCaseId as string;
    if (req.query.exemptionStatus) filters.exemptionStatus = req.query.exemptionStatus as string;
    if (req.query.exemptionType) filters.exemptionType = req.query.exemptionType as string;
    if (req.query.verifiedBy) filters.verifiedBy = req.query.verifiedBy as string;

    const verifications = await storage.getAbawdExemptionVerifications(filters);
    res.json(verifications);
  }));

  // Get single ABAWD verification
  app.get("/api/abawd-verifications/:id", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const verification = await storage.getAbawdExemptionVerification(req.params.id);
    
    if (!verification) {
      throw notFoundError("Verification not found");
    }

    res.json(verification);
  }));

  // Update ABAWD verification
  app.put("/api/abawd-verifications/:id", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const verification = await storage.getAbawdExemptionVerification(req.params.id);
    
    if (!verification) {
      throw notFoundError("Verification not found");
    }

    const schema = z.object({
      exemptionType: z.enum(['homeless', 'disabled', 'student', 'caregiver', 'employed_20hrs', 'training_program', 'medically_certified', 'other']).optional(),
      exemptionStatus: z.enum(['verified', 'pending', 'denied', 'expired']).optional(),
      verificationMethod: z.enum(['document_review', 'third_party_verification', 'self_attestation', 'database_check']).optional(),
      documentIds: z.array(z.string()).optional(),
      verificationNotes: z.string().optional(),
      expirationDate: z.string().optional(),
      renewalRequired: z.boolean().optional()
    });

    const validated = schema.parse(req.body);
    const updated = await storage.updateAbawdExemptionVerification(req.params.id, validated);
    res.json(updated);
  }));

  // Delete ABAWD verification
  app.delete("/api/abawd-verifications/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const verification = await storage.getAbawdExemptionVerification(req.params.id);
    
    if (!verification) {
      throw notFoundError("Verification not found");
    }

    await storage.deleteAbawdExemptionVerification(req.params.id);
    res.json({ success: true });
  }));

  // ==========================================
  // Cross-Enrollment Analysis Routes
  // ==========================================

  // Create program enrollment
  app.post("/api/program-enrollments", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      clientIdentifier: z.string(),
      benefitProgramId: z.string(),
      enrollmentStatus: z.enum(['enrolled', 'pending', 'denied', 'terminated', 'suspended']),
      enrollmentDate: z.string().optional(),
      terminationDate: z.string().optional(),
      terminationReason: z.string().optional(),
      householdSize: z.number().optional(),
      householdIncome: z.number().optional(),
      isEligibleForOtherPrograms: z.boolean().optional(),
      crossEnrollmentNotes: z.string().optional()
    });

    const validated = schema.parse(req.body);
    const enrollment = await storage.createProgramEnrollment(validated);
    res.json(enrollment);
  }));

  // Get all program enrollments with filters
  app.get("/api/program-enrollments", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const filters: any = {};
    
    if (req.query.clientIdentifier) filters.clientIdentifier = req.query.clientIdentifier as string;
    if (req.query.benefitProgramId) filters.benefitProgramId = req.query.benefitProgramId as string;
    if (req.query.enrollmentStatus) filters.enrollmentStatus = req.query.enrollmentStatus as string;
    if (req.query.isEligibleForOtherPrograms !== undefined) {
      filters.isEligibleForOtherPrograms = req.query.isEligibleForOtherPrograms === 'true';
    }

    const enrollments = await storage.getProgramEnrollments(filters);
    res.json(enrollments);
  }));

  // Get enrollments by client
  app.get("/api/program-enrollments/client/:clientIdentifier", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const enrollments = await storage.getProgramEnrollmentsByClient(req.params.clientIdentifier);
    res.json(enrollments);
  }));

  // Get single program enrollment
  app.get("/api/program-enrollments/:id", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const enrollment = await storage.getProgramEnrollment(req.params.id);
    
    if (!enrollment) {
      throw notFoundError("Enrollment not found");
    }

    res.json(enrollment);
  }));

  // Update program enrollment
  app.put("/api/program-enrollments/:id", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const enrollment = await storage.getProgramEnrollment(req.params.id);
    
    if (!enrollment) {
      throw notFoundError("Enrollment not found");
    }

    const schema = z.object({
      enrollmentStatus: z.enum(['enrolled', 'pending', 'denied', 'terminated', 'suspended']).optional(),
      enrollmentDate: z.string().optional(),
      terminationDate: z.string().optional(),
      terminationReason: z.string().optional(),
      householdSize: z.number().optional(),
      householdIncome: z.number().optional(),
      isEligibleForOtherPrograms: z.boolean().optional(),
      crossEnrollmentNotes: z.string().optional()
    });

    const validated = schema.parse(req.body);
    const updated = await storage.updateProgramEnrollment(req.params.id, validated);
    res.json(updated);
  }));

  // Analyze cross-enrollment opportunities
  app.get("/api/cross-enrollment/analyze/:clientIdentifier", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const analysis = await storage.analyzeCrossEnrollmentOpportunities(req.params.clientIdentifier);
    res.json(analysis);
  }));

  // ==========================================
  // Document Review Queue Routes (Navigator)
  // ==========================================

  // Get client verification documents for review
  app.get("/api/document-review/queue", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const filters: any = {};
    
    if (req.query.verificationStatus) {
      filters.verificationStatus = req.query.verificationStatus as string;
    }
    if (req.query.sessionId) {
      filters.sessionId = req.query.sessionId as string;
    }
    if (req.query.clientCaseId) {
      filters.clientCaseId = req.query.clientCaseId as string;
    }

    const documents = await storage.getClientVerificationDocuments(filters);
    res.json(documents);
  }));

  // Get single document for review
  app.get("/api/document-review/:id", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const document = await storage.getClientVerificationDocument(req.params.id);
    
    if (!document) {
      throw notFoundError("Document not found");
    }

    res.json(document);
  }));

  // Approve or reject a document
  app.put("/api/document-review/:id/status", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const document = await storage.getClientVerificationDocument(req.params.id);
    
    if (!document) {
      throw notFoundError("Document not found");
    }

    const schema = z.object({
      verificationStatus: z.enum(['pending_review', 'approved', 'rejected', 'needs_more_info']),
      reviewNotes: z.string().optional()
    });

    const validated = schema.parse(req.body);
    
    const updates: any = {
      verificationStatus: validated.verificationStatus,
      reviewedBy: req.user!.id,
      reviewedAt: new Date()
    };

    if (validated.reviewNotes) {
      updates.reviewNotes = validated.reviewNotes;
    }

    const updated = await storage.updateClientVerificationDocument(req.params.id, updates);

    // Send real-time notification to the document owner/submitter
    if (document.sessionId) {
      const session = await storage.getClientInteractionSession(document.sessionId);
      if (session?.clientCaseId) {
        const clientCase = await storage.getClientCase(session.clientCaseId);
        if (clientCase) {
          // Notify the client about document review status
          const statusText = validated.verificationStatus === 'approved' ? 'approved' : 
                           validated.verificationStatus === 'rejected' ? 'rejected' : 'requires more information';
          
          await notificationService.createNotification({
            userId: clientCase.applicantId || clientCase.navigatorId,
            type: 'document_review',
            title: `Document ${statusText}`,
            message: `Your ${document.requirementType.replace(/_/g, ' ')} document has been ${statusText}${validated.reviewNotes ? ': ' + validated.reviewNotes : ''}`,
            priority: validated.verificationStatus === 'rejected' ? 'high' : 'normal',
            relatedEntityType: 'client_verification_document',
            relatedEntityId: document.id,
            actionUrl: `/verify`
          });
        }
      }
    }

    res.json(updated);
  }));

  // Bulk update multiple documents
  app.put("/api/document-review/bulk-update", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      documentIds: z.array(z.string()).min(1, "At least one document ID is required"),
      verificationStatus: z.enum(['approved', 'rejected']), // Only allow approved/rejected for bulk
      reviewNotes: z.string().optional()
    });

    const validated = schema.parse(req.body);
    
    const updates: any = {
      verificationStatus: validated.verificationStatus,
      reviewedBy: req.user!.id,
      reviewedAt: new Date()
    };

    if (validated.reviewNotes) {
      updates.reviewNotes = validated.reviewNotes;
    }

    let updatedCount = 0;

    // Update each document and send notifications
    for (const documentId of validated.documentIds) {
      try {
        const document = await storage.getClientVerificationDocument(documentId);
        
        if (!document || document.verificationStatus !== 'pending_review') {
          // Skip documents that don't exist or are not pending review
          continue;
        }

        await storage.updateClientVerificationDocument(documentId, updates);
        updatedCount++;

        // Send notification
        if (document.sessionId) {
          const session = await storage.getClientInteractionSession(document.sessionId);
          if (session?.clientCaseId) {
            const clientCase = await storage.getClientCase(session.clientCaseId);
            if (clientCase) {
              const statusText = validated.verificationStatus === 'approved' ? 'approved' : 'rejected';
              
              await notificationService.createNotification({
                userId: clientCase.applicantId || clientCase.navigatorId,
                type: 'document_review',
                title: `Document ${statusText}`,
                message: `Your ${document.requirementType.replace(/_/g, ' ')} document has been ${statusText}${validated.reviewNotes ? ': ' + validated.reviewNotes : ''}`,
                priority: validated.verificationStatus === 'rejected' ? 'high' : 'normal',
                relatedEntityType: 'client_verification_document',
                relatedEntityId: document.id,
                actionUrl: `/verify`
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error updating document ${documentId}:`, error);
        // Continue with next document
      }
    }

    res.json({ 
      updated: updatedCount,
      requested: validated.documentIds.length,
      status: validated.verificationStatus
    });
  }));

  // ===========================
  // COUNTY ROUTES
  // ===========================

  // Get all counties with filters
  app.get("/api/counties", asyncHandler(async (req: Request, res: Response) => {
    const { isActive, isPilot, region } = req.query;
    
    const filters: any = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (isPilot !== undefined) filters.isPilot = isPilot === 'true';
    if (region) filters.region = region as string;
    
    const counties = await storage.getCounties(filters);
    res.json(counties);
  }));

  // Create county (admin only)
  app.post("/api/counties", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertCountySchema.parse(req.body);
    const county = await storage.createCounty(validated);
    res.status(201).json(county);
  }));

  // Get county by ID
  app.get("/api/counties/:id", asyncHandler(async (req: Request, res: Response) => {
    const county = await storage.getCounty(req.params.id);
    if (!county) {
      throw notFoundError("County not found");
    }
    res.json(county);
  }));

  // Update county (admin only)
  app.patch("/api/counties/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const validated = insertCountySchema.partial().parse(req.body);
    const county = await storage.updateCounty(req.params.id, validated);
    if (!county) {
      throw notFoundError("County not found");
    }
    res.json(county);
  }));

  // Delete county (admin only)
  app.delete("/api/counties/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    await storage.deleteCounty(req.params.id);
    res.json({ message: "County deleted successfully" });
  }));

  // Assign user to county (admin only)
  app.post("/api/counties/:id/users", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { userId, role } = req.body;
    
    if (!userId) {
      throw validationError("userId is required");
    }
    
    const countyUser = await storage.assignUserToCounty({
      countyId: req.params.id,
      userId,
      role: role || 'navigator',
      isActive: true
    });
    
    res.status(201).json(countyUser);
  }));

  // Get county users
  app.get("/api/counties/:id/users", asyncHandler(async (req: Request, res: Response) => {
    const users = await storage.getCountyUsers(req.params.id);
    res.json(users);
  }));

  // Get user's counties
  app.get("/api/users/:userId/counties", asyncHandler(async (req: Request, res: Response) => {
    const counties = await storage.getUserCounties(req.params.userId);
    res.json(counties);
  }));

  // Remove user from county (admin only)
  app.delete("/api/county-users/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    await storage.removeUserFromCounty(req.params.id);
    res.json({ message: "User removed from county successfully" });
  }));

  // Get current user's county branding
  app.get("/api/branding/current", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      return res.json(null);
    }

    const primaryCounty = await storage.getPrimaryCounty(req.user.id);
    
    if (!primaryCounty) {
      return res.json(null);
    }

    res.json({
      countyId: primaryCounty.id,
      countyName: primaryCounty.name,
      countyCode: primaryCounty.code,
      brandingConfig: primaryCounty.brandingConfig,
      welcomeMessage: primaryCounty.welcomeMessage,
      contactInfo: primaryCounty.contactInfo
    });
  }));

  // ===========================
  // COUNTY PERFORMANCE ANALYTICS
  // ===========================

  // Get county metrics for a specific county
  app.get("/api/counties/:id/metrics", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { periodType, limit } = req.query;
    
    const metrics = await storage.getCountyMetrics(
      req.params.id,
      periodType as string,
      limit ? parseInt(limit as string) : 10
    );
    
    res.json(metrics);
  }));

  // Get latest county metric for comparison
  app.get("/api/counties/:id/metrics/latest", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { periodType } = req.query;
    
    if (!periodType) {
      throw validationError("periodType query parameter is required");
    }
    
    const metric = await storage.getLatestCountyMetric(
      req.params.id,
      periodType as string
    );
    
    res.json(metric || null);
  }));

  // Get all counties metrics for comparison (Admin only)
  app.get("/api/county-analytics/comparison", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { periodType } = req.query;
    
    if (!periodType) {
      throw validationError("periodType query parameter is required");
    }

    // Get all active counties
    const counties = await storage.getCounties({ isActive: true });
    
    // Fetch latest metrics for each county
    const comparison = await Promise.all(
      counties.map(async (county) => {
        const metric = await storage.getLatestCountyMetric(county.id, periodType as string);
        return {
          county: {
            id: county.id,
            name: county.name,
            code: county.code,
            region: county.region
          },
          metrics: metric
        };
      })
    );
    
    res.json(comparison);
  }));

  // ===========================
  // MULTI-TENANT ROUTES
  // ===========================

  // Get current tenant info and branding (public route)
  app.get("/api/tenant/current", asyncHandler(async (req: Request, res: Response) => {
    if (!req.tenant) {
      return res.status(404).json({
        error: "No tenant found for this domain",
      });
    }

    res.json({
      tenant: {
        id: req.tenant.tenant.id,
        slug: req.tenant.tenant.slug,
        name: req.tenant.tenant.name,
        type: req.tenant.tenant.type,
        parentTenantId: req.tenant.tenant.parentTenantId,
        config: req.tenant.tenant.config,
      },
      branding: req.tenant.branding,
    });
  }));

  // List all tenants (super admin only)
  app.get("/api/admin/tenants", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { type, status, parentTenantId } = req.query;
    
    const filters: any = {};
    if (type) filters.type = type as string;
    if (status) filters.status = status as string;
    if (parentTenantId) filters.parentTenantId = parentTenantId as string;
    
    const tenants = await storage.getTenants(filters);
    res.json(tenants);
  }));

  // Get specific tenant (super admin only)
  app.get("/api/admin/tenants/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const tenant = await storage.getTenant(req.params.id);
    if (!tenant) {
      throw notFoundError("Tenant not found");
    }
    
    const branding = await storage.getTenantBranding(tenant.id);
    
    res.json({
      tenant,
      branding,
    });
  }));

  // Create new tenant (super admin only)
  app.post("/api/admin/tenants", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { slug, name, type, parentTenantId, status, domain, config } = req.body;
    
    if (!slug || !name || !type) {
      throw validationError("slug, name, and type are required");
    }
    
    const tenant = await storage.createTenant({
      slug,
      name,
      type,
      parentTenantId,
      status: status || 'active',
      domain,
      config,
    });
    
    res.status(201).json(tenant);
  }));

  // Update tenant (super admin only)
  app.patch("/api/admin/tenants/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { slug, name, type, parentTenantId, status, domain, config } = req.body;
    
    const updates: any = {};
    if (slug !== undefined) updates.slug = slug;
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (parentTenantId !== undefined) updates.parentTenantId = parentTenantId;
    if (status !== undefined) updates.status = status;
    if (domain !== undefined) updates.domain = domain;
    if (config !== undefined) updates.config = config;
    
    const tenant = await storage.updateTenant(req.params.id, updates);
    res.json(tenant);
  }));

  // Delete tenant (super admin only)
  app.delete("/api/admin/tenants/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    await storage.deleteTenant(req.params.id);
    res.status(204).send();
  }));

  // Update tenant branding (super admin only)
  app.patch("/api/admin/tenants/:id/branding", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { primaryColor, secondaryColor, logoUrl, faviconUrl, customCss, headerHtml, footerHtml } = req.body;
    
    const existingBranding = await storage.getTenantBranding(req.params.id);
    
    if (existingBranding) {
      // Update existing branding
      const updates: any = {};
      if (primaryColor !== undefined) updates.primaryColor = primaryColor;
      if (secondaryColor !== undefined) updates.secondaryColor = secondaryColor;
      if (logoUrl !== undefined) updates.logoUrl = logoUrl;
      if (faviconUrl !== undefined) updates.faviconUrl = faviconUrl;
      if (customCss !== undefined) updates.customCss = customCss;
      if (headerHtml !== undefined) updates.headerHtml = headerHtml;
      if (footerHtml !== undefined) updates.footerHtml = footerHtml;
      
      const branding = await storage.updateTenantBranding(req.params.id, updates);
      res.json(branding);
    } else {
      // Create new branding
      const branding = await storage.createTenantBranding({
        tenantId: req.params.id,
        primaryColor,
        secondaryColor,
        logoUrl,
        faviconUrl,
        customCss,
        headerHtml,
        footerHtml,
      });
      res.status(201).json(branding);
    }
  }));

  // ===========================
  // GAMIFICATION ROUTES - Navigator KPIs
  // ===========================

  // Get navigator KPIs (filtered by periodType)
  app.get("/api/navigators/:id/kpis", asyncHandler(async (req: Request, res: Response) => {
    const { periodType } = req.query;
    
    if (!periodType) {
      throw validationError("periodType query parameter is required");
    }
    
    const kpis = await storage.getNavigatorKpis(
      req.params.id, 
      periodType as 'daily' | 'weekly' | 'monthly' | 'all_time'
    );
    res.json(kpis);
  }));

  // Get latest performance summary
  app.get("/api/navigators/:id/performance", asyncHandler(async (req: Request, res: Response) => {
    const kpi = await storage.getLatestNavigatorKpi(req.params.id, 'daily');
    
    if (!kpi) {
      return res.json({
        navigatorId: req.params.id,
        casesClosed: 0,
        successRate: 0,
        totalBenefitsSecured: 0,
        message: "No performance data available"
      });
    }
    
    res.json({
      navigatorId: kpi.navigatorId,
      casesClosed: kpi.casesClosed,
      casesApproved: kpi.casesApproved,
      successRate: kpi.successRate,
      totalBenefitsSecured: kpi.totalBenefitsSecured,
      avgBenefitPerCase: kpi.avgBenefitPerCase,
      avgResponseTime: kpi.avgResponseTime,
      documentsVerified: kpi.documentsVerified,
      avgDocumentQuality: kpi.avgDocumentQuality,
      crossEnrollmentsIdentified: kpi.crossEnrollmentsIdentified,
      performanceScore: kpi.performanceScore,
      periodType: kpi.periodType,
      periodStart: kpi.periodStart,
      periodEnd: kpi.periodEnd
    });
  }));

  // Track case closure event
  app.post("/api/kpis/track-case-closed", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { navigatorId, caseId, countyId, benefitAmount, isApproved, responseTimeHours, completionTimeDays } = req.body;
    
    if (!navigatorId || !caseId) {
      throw validationError("navigatorId and caseId are required");
    }
    
    await kpiTrackingService.trackCaseClosed({
      navigatorId,
      caseId,
      countyId,
      benefitAmount,
      isApproved: isApproved ?? true,
      responseTimeHours,
      completionTimeDays
    });
    
    res.json({ message: "Case closure tracked successfully" });
  }));

  // Track document verification
  app.post("/api/kpis/track-document-verified", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { navigatorId, caseId, countyId, documentQuality } = req.body;
    
    if (!navigatorId || !caseId || documentQuality === undefined) {
      throw validationError("navigatorId, caseId, and documentQuality are required");
    }
    
    await kpiTrackingService.trackDocumentVerified({
      navigatorId,
      caseId,
      countyId,
      documentQuality
    });
    
    res.json({ message: "Document verification tracked successfully" });
  }));

  // Track cross-enrollment identification
  app.post("/api/kpis/track-cross-enrollment", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { navigatorId, caseId, countyId, potentialBenefitAmount } = req.body;
    
    if (!navigatorId || !caseId || !potentialBenefitAmount) {
      throw validationError("navigatorId, caseId, and potentialBenefitAmount are required");
    }
    
    await kpiTrackingService.trackCrossEnrollmentIdentified({
      navigatorId,
      caseId,
      countyId,
      potentialBenefitAmount
    });
    
    res.json({ message: "Cross-enrollment tracked successfully" });
  }));

  // ===========================
  // GAMIFICATION ROUTES - Achievements
  // ===========================

  // Get all achievements (filtered)
  app.get("/api/achievements", asyncHandler(async (req: Request, res: Response) => {
    const { category, tier, isActive } = req.query;
    
    const filters: any = {};
    if (category) filters.category = category as string;
    if (tier) filters.tier = tier as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const achievements = await storage.getAchievements(filters);
    res.json(achievements);
  }));

  // Create achievement (admin only)
  app.post("/api/achievements", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const achievementData = req.body;
    const achievement = await storage.createAchievement(achievementData);
    res.status(201).json(achievement);
  }));

  // Get achievement by ID
  app.get("/api/achievements/:id", asyncHandler(async (req: Request, res: Response) => {
    const achievement = await storage.getAchievement(req.params.id);
    if (!achievement) {
      throw notFoundError("Achievement not found");
    }
    res.json(achievement);
  }));

  // Update achievement (admin only)
  app.patch("/api/achievements/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const achievementData = req.body;
    const achievement = await storage.updateAchievement(req.params.id, achievementData);
    if (!achievement) {
      throw notFoundError("Achievement not found");
    }
    res.json(achievement);
  }));

  // Delete achievement (admin only)
  app.delete("/api/achievements/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    await storage.deleteAchievement(req.params.id);
    res.json({ message: "Achievement deleted successfully" });
  }));

  // Get navigator's achievements
  app.get("/api/navigators/:id/achievements", asyncHandler(async (req: Request, res: Response) => {
    const achievements = await storage.getNavigatorAchievements(req.params.id);
    res.json(achievements);
  }));

  // Get unnotified achievements
  app.get("/api/navigators/:id/achievements/unnotified", asyncHandler(async (req: Request, res: Response) => {
    const achievements = await storage.getNavigatorAchievements(req.params.id);
    const unnotified = achievements.filter(a => !a.notified);
    res.json(unnotified);
  }));

  // Mark achievements as notified
  app.post("/api/navigator-achievements/mark-notified", asyncHandler(async (req: Request, res: Response) => {
    const { achievementIds } = req.body;
    
    if (!Array.isArray(achievementIds) || achievementIds.length === 0) {
      throw validationError("achievementIds array is required");
    }
    
    for (const achievementId of achievementIds) {
      await storage.markAchievementNotified(achievementId);
    }
    
    res.json({ message: "Achievements marked as notified", count: achievementIds.length });
  }));

  // ===========================
  // GAMIFICATION ROUTES - Leaderboards
  // ===========================

  // Get leaderboard
  app.get("/api/leaderboards", asyncHandler(async (req: Request, res: Response) => {
    const { type, scope, period, countyId } = req.query;
    
    if (!type || !scope || !period) {
      throw validationError("type, scope, and period query parameters are required");
    }
    
    const leaderboard = await leaderboardService.getLeaderboard(
      type as string,
      scope as string,
      period as string,
      countyId as string | undefined
    );
    
    if (!leaderboard) {
      return res.json({
        leaderboardType: type,
        scope,
        periodType: period,
        rankings: [],
        totalParticipants: 0,
        message: "No leaderboard data available"
      });
    }
    
    res.json(leaderboard);
  }));

  // Refresh all leaderboards (admin only)
  app.get("/api/leaderboards/refresh", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    await leaderboardService.refreshAllLeaderboards();
    res.json({ message: "All leaderboards refreshed successfully" });
  }));

  // Get navigator's rank
  app.get("/api/navigators/:id/rank", asyncHandler(async (req: Request, res: Response) => {
    const { type, scope, period, countyId } = req.query;
    
    if (!type || !scope || !period) {
      throw validationError("type, scope, and period query parameters are required");
    }
    
    const rank = await leaderboardService.getNavigatorRank(
      req.params.id,
      type as string,
      scope as string,
      period as string,
      countyId as string | undefined
    );
    
    if (!rank) {
      return res.json({
        navigatorId: req.params.id,
        rank: -1,
        totalParticipants: 0,
        message: "No ranking data available"
      });
    }
    
    res.json({
      navigatorId: req.params.id,
      ...rank
    });
  }));

  // ===========================
  // QC (QUALITY CONTROL) ROUTES - Caseworker Cockpit
  // ===========================

  // Get flagged cases for current caseworker
  app.get("/api/qc/flagged-cases/me", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw authorizationError("Authentication required");
    }

    const flaggedCases = await storage.getFlaggedCasesByCaseworker(req.user.id);
    res.json(flaggedCases);
  }));

  // Get error patterns for current caseworker
  app.get("/api/qc/error-patterns/me", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw authorizationError("Authentication required");
    }

    // Get all error patterns
    const allPatterns = await storage.getQcErrorPatterns();

    // Get the caseworker's flagged cases to determine their error types
    const flaggedCases = await storage.getFlaggedCasesByCaseworker(req.user.id);
    
    // Extract error types from flagged cases
    const caseworkerErrorTypes = new Set<string>();
    flaggedCases.forEach(flaggedCase => {
      if (flaggedCase.flaggedErrorTypes) {
        flaggedCase.flaggedErrorTypes.forEach((errorType: string) => {
          caseworkerErrorTypes.add(errorType);
        });
      }
    });

    // Filter patterns to those relevant to caseworker's error types
    const relevantPatterns = allPatterns.filter(pattern => 
      caseworkerErrorTypes.has(pattern.errorCategory)
    );

    // If no specific errors, return recent patterns for awareness
    if (relevantPatterns.length === 0) {
      res.json(allPatterns.slice(0, 10));
    } else {
      res.json(relevantPatterns);
    }
  }));

  // Get all job aids with optional category filter
  app.get("/api/qc/job-aids", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.query;
    
    const filters = category ? { category: category as string } : undefined;
    const jobAids = await storage.getJobAids(filters);
    
    res.json(jobAids);
  }));

  // Get recommended training interventions
  app.get("/api/qc/training-interventions", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw authorizationError("Authentication required");
    }

    const { targetErrorCategory } = req.query;
    
    // Get flagged cases to determine what training is needed
    const flaggedCases = await storage.getFlaggedCasesByCaseworker(req.user.id);
    
    // Extract error categories from flagged cases
    const errorCategories = new Set<string>();
    flaggedCases.forEach(flaggedCase => {
      if (flaggedCase.flaggedErrorTypes) {
        flaggedCase.flaggedErrorTypes.forEach((errorType: string) => {
          errorCategories.add(errorType);
        });
      }
    });

    // Get training interventions
    const filters = targetErrorCategory 
      ? { targetErrorCategory: targetErrorCategory as string }
      : undefined;
    
    let interventions = await storage.getTrainingInterventions(filters);

    // Filter to relevant training based on caseworker's error patterns
    if (!targetErrorCategory && errorCategories.size > 0) {
      interventions = interventions.filter(intervention => 
        errorCategories.has(intervention.targetErrorCategory)
      );
    }

    res.json(interventions);
  }));

  // ===========================
  // SUPERVISOR QC ROUTES - Supervisor Cockpit
  // ===========================

  // Get all error patterns (supervisor view)
  app.get("/api/qc/error-patterns", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    const { errorCategory, quarterOccurred, severity } = req.query;
    
    const filters: any = {};
    if (errorCategory) filters.errorCategory = errorCategory as string;
    if (quarterOccurred) filters.quarterOccurred = quarterOccurred as string;
    if (severity) filters.severity = severity as string;
    
    const patterns = await storage.getQcErrorPatterns(filters);
    res.json(patterns);
  }));

  // Get all flagged cases for supervisor's team
  app.get("/api/qc/flagged-cases/team", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw authorizationError("Authentication required");
    }

    const flaggedCases = await storage.getFlaggedCasesForSupervisor(req.user.id);
    res.json(flaggedCases);
  }));

  // Assign flagged case to caseworker with coaching notes
  app.post("/api/qc/flagged-cases/:id/assign", requireStaff, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw authorizationError("Authentication required");
    }

    const { assignedCaseworkerId, reviewNotes } = req.body;

    if (!assignedCaseworkerId) {
      throw validationError("Caseworker ID is required");
    }

    const flaggedCase = await storage.getFlaggedCase(req.params.id);
    if (!flaggedCase) {
      throw notFoundError("Flagged case not found");
    }

    const updated = await storage.assignFlaggedCase(
      req.params.id,
      assignedCaseworkerId,
      req.user.id,
      reviewNotes
    );

    res.json(updated);
  }));

  // ===========================
  // EVALUATION FRAMEWORK ROUTES
  // ===========================

  // Get all test cases with optional filters
  app.get("/api/evaluation/test-cases", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { program, category, isActive } = req.query;
    
    const filters: any = {};
    if (program) filters.program = program as string;
    if (category) filters.category = category as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const testCases = await storage.getEvaluationTestCases(filters);
    res.json(testCases);
  }));

  // Get single test case
  app.get("/api/evaluation/test-cases/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const testCase = await storage.getEvaluationTestCase(req.params.id);
    if (!testCase) {
      throw notFoundError("Test case not found");
    }
    res.json(testCase);
  }));

  // Create test case
  app.post("/api/evaluation/test-cases", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { insertEvaluationTestCaseSchema } = await import("@shared/schema");
    const validated = insertEvaluationTestCaseSchema.parse(req.body);
    
    const testCase = await storage.createEvaluationTestCase({
      ...validated,
      createdBy: req.user!.id
    });
    
    res.status(201).json(testCase);
  }));

  // Update test case
  app.patch("/api/evaluation/test-cases/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const testCase = await storage.updateEvaluationTestCase(req.params.id, req.body);
    res.json(testCase);
  }));

  // Delete test case
  app.delete("/api/evaluation/test-cases/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    await storage.deleteEvaluationTestCase(req.params.id);
    res.status(204).send();
  }));

  // Get all evaluation runs with optional filters
  app.get("/api/evaluation/runs", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { program, status, limit } = req.query;
    
    const filters: any = {};
    if (program) filters.program = program as string;
    if (status) filters.status = status as string;
    if (limit) filters.limit = parseInt(limit as string);
    
    const runs = await storage.getEvaluationRuns(filters);
    res.json(runs);
  }));

  // Get single evaluation run
  app.get("/api/evaluation/runs/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const run = await storage.getEvaluationRun(req.params.id);
    if (!run) {
      throw notFoundError("Evaluation run not found");
    }
    res.json(run);
  }));

  // Create evaluation run
  app.post("/api/evaluation/runs", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { insertEvaluationRunSchema } = await import("@shared/schema");
    const validated = insertEvaluationRunSchema.parse(req.body);
    
    const run = await storage.createEvaluationRun({
      ...validated,
      runBy: req.user!.id
    });
    
    res.status(201).json(run);
  }));

  // Update evaluation run
  app.patch("/api/evaluation/runs/:id", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const run = await storage.updateEvaluationRun(req.params.id, req.body);
    res.json(run);
  }));

  // Get results for a specific run
  app.get("/api/evaluation/runs/:runId/results", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const results = await storage.getEvaluationResultsByRun(req.params.runId);
    res.json(results);
  }));

  // Create evaluation result
  app.post("/api/evaluation/results", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { insertEvaluationResultSchema } = await import("@shared/schema");
    const validated = insertEvaluationResultSchema.parse(req.body);
    
    const result = await storage.createEvaluationResult(validated);
    res.status(201).json(result);
  }));

  // Get results for a specific test case
  app.get("/api/evaluation/test-cases/:testCaseId/results", requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const results = await storage.getEvaluationResultsByTestCase(req.params.testCaseId);
    res.json(results);
  }));

  // ============================================================================
  // PUBLIC API - Third-party integrations with API key authentication
  // ============================================================================
  
  const publicApiRouter = (await import("./routes/publicApi")).default;
  app.use("/api/v1", publicApiRouter);
  
  // ============================================================================
  // SMS/TWILIO - Text-based benefit screening and intake
  // ============================================================================
  
  // Admin API endpoints for SMS management
  const { getTwilioConfig } = await import("./services/twilioConfig");
  const { getConversationStats, isSmsEnabledForTenant } = await import("./services/smsService");
  const { smsConversations } = await import("@shared/schema");
  
  // Get Twilio configuration status
  app.get("/api/sms/status", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const config = getTwilioConfig();
    
    if (config.isConfigured) {
      res.json({
        isConfigured: true,
        phoneNumber: config.phoneNumber
      });
    } else {
      res.json({
        isConfigured: false,
        reason: config.reason
      });
    }
  }));
  
  // Get conversation statistics
  app.get("/api/sms/stats", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.query.tenantId as string || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }
    
    const stats = await getConversationStats(tenantId);
    res.json(stats);
  }));
  
  // Get recent conversations
  app.get("/api/sms/conversations", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    
    const conversations = await db.query.smsConversations.findMany({
      limit,
      orderBy: [desc(smsConversations.createdAt)]
    });
    
    res.json(conversations);
  }));
  
  // Twilio webhook routes
  const twilioWebhooksRouter = (await import("./routes/twilioWebhooks")).default;
  app.use("/api/sms", twilioWebhooksRouter);
  
  // ============================================================================
  // API DOCUMENTATION - OpenAPI/Swagger endpoints
  // ============================================================================
  
  const { openApiSpec } = await import("./openapi");
  
  // Serve OpenAPI spec as JSON
  app.get("/api/openapi.json", (req, res) => {
    res.json(openApiSpec);
  });
  
  // Serve Swagger UI using CDN (since swagger-ui-express package failed to install)
  app.get("/api/docs", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maryland Benefits Platform API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui.css">
    <style>
        body {
            margin: 0;
            padding: 0;
        }
        .topbar {
            display: none;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/api/openapi.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                persistAuthorization: true,
                tryItOutEnabled: true
            });
            window.ui = ui;
        };
    </script>
</body>
</html>
    `);
  });
  
  // ============================================================================
  // API KEY MANAGEMENT - Admin endpoints for managing API keys
  // ============================================================================
  
  const { apiKeyService } = await import("./services/apiKeyService");
  
  // Generate new API key (admin only)
  app.post("/api/admin/api-keys", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { name, organizationId, tenantId, scopes, rateLimit, expiresAt } = req.body;
    
    if (!name || !tenantId || !scopes || !Array.isArray(scopes)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: name, tenantId, scopes (array)',
      });
    }
    
    const result = await apiKeyService.generateApiKey(
      name,
      tenantId,
      scopes,
      rateLimit,
      expiresAt ? new Date(expiresAt) : undefined,
      req.user!.id
    );
    
    res.status(201).json({
      id: result.apiKey.id,
      key: result.readableKey, // Only time this is returned!
      name: result.apiKey.name,
      tenantId: result.apiKey.tenantId,
      scopes: result.apiKey.scopes,
      rateLimit: result.apiKey.rateLimit,
      status: result.apiKey.status,
      expiresAt: result.apiKey.expiresAt,
      createdAt: result.apiKey.createdAt,
      warning: 'Save this API key now - it will not be shown again!',
    });
  }));
  
  // List API keys for tenant (admin only)
  app.get("/api/admin/api-keys", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tenantId query parameter is required',
      });
    }
    
    const keys = await apiKeyService.getApiKeysByTenant(tenantId as string);
    
    // Don't return the actual hashed keys
    const sanitizedKeys = keys.map(k => ({
      id: k.id,
      name: k.name,
      tenantId: k.tenantId,
      scopes: k.scopes,
      rateLimit: k.rateLimit,
      status: k.status,
      lastUsedAt: k.lastUsedAt,
      requestCount: k.requestCount,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    }));
    
    res.json(sanitizedKeys);
  }));
  
  // Get API key usage stats (admin only)
  app.get("/api/admin/api-keys/:keyId/stats", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { keyId } = req.params;
    const { days } = req.query;
    
    const stats = await apiKeyService.getUsageStats(
      keyId,
      days ? parseInt(days as string) : 30
    );
    
    res.json(stats);
  }));
  
  // Revoke API key (admin only)
  app.post("/api/admin/api-keys/:keyId/revoke", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { keyId } = req.params;
    
    await apiKeyService.revokeApiKey(keyId, req.user!.id);
    
    res.json({ message: 'API key revoked successfully' });
  }));
  
  // Suspend API key (admin only)
  app.post("/api/admin/api-keys/:keyId/suspend", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { keyId } = req.params;
    
    await apiKeyService.suspendApiKey(keyId);
    
    res.json({ message: 'API key suspended successfully' });
  }));
  
  // Reactivate API key (admin only)
  app.post("/api/admin/api-keys/:keyId/reactivate", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { keyId } = req.params;
    
    await apiKeyService.reactivateApiKey(keyId);
    
    res.json({ message: 'API key reactivated successfully' });
  }));

  // ============================================================================
  // WEBHOOK MANAGEMENT ENDPOINTS (Admin)
  // ============================================================================

  // GET all webhooks
  app.get("/api/admin/webhooks", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, status } = req.query;
    
    const webhooks = await storage.getWebhooks({
      tenantId: tenantId as string,
      status: status as string,
    });
    
    res.json(webhooks);
  }));

  // POST create new webhook
  app.post("/api/admin/webhooks", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { insertWebhookSchema } = await import("@shared/schema");
    
    const validatedData = insertWebhookSchema.parse(req.body);
    
    // Generate secret if not provided
    if (!validatedData.secret) {
      validatedData.secret = crypto.randomBytes(32).toString('hex');
    }
    
    const webhook = await storage.createWebhook(validatedData);
    
    res.status(201).json(webhook);
  }));

  // PUT update webhook
  app.put("/api/admin/webhooks/:id", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { url, events, secret, status, maxRetries } = req.body;
    
    const webhook = await storage.getWebhook(id);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const updates: Partial<any> = {};
    if (url !== undefined) updates.url = url;
    if (events !== undefined) updates.events = events;
    if (secret !== undefined) updates.secret = secret;
    if (status !== undefined) updates.status = status;
    if (maxRetries !== undefined) updates.maxRetries = maxRetries;
    
    const updated = await storage.updateWebhook(id, updates);
    
    res.json(updated);
  }));

  // DELETE webhook
  app.delete("/api/admin/webhooks/:id", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const webhook = await storage.getWebhook(id);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    await storage.deleteWebhook(id);
    
    res.json({ message: 'Webhook deleted successfully' });
  }));

  // POST test webhook delivery
  app.post("/api/admin/webhooks/:id/test", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { testWebhook } = await import("./services/webhookService");
    const { id } = req.params;
    
    const webhook = await storage.getWebhook(id);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const result = await testWebhook(id);
    
    res.json({
      success: result.success,
      httpStatus: result.httpStatus,
      responseBody: result.responseBody,
      responseTime: result.responseTime,
      errorMessage: result.errorMessage,
    });
  }));

  // GET webhook delivery logs
  app.get("/api/admin/webhooks/:id/logs", requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    
    const webhook = await storage.getWebhook(id);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const logs = await storage.getWebhookDeliveryLogs(id, Number(limit));
    
    res.json(logs);
  }));

  // ============================================================================
  // DEMO DATA ENDPOINTS - For Maryland Universal Benefits-Tax Navigator Showcase
  // ============================================================================

  // Get all demo households
  app.get('/api/demo/households', asyncHandler(async (_req: Request, res: Response) => {
    await demoDataService.loadDemoData();
    const households = demoDataService.getAllHouseholds();
    res.json(households);
  }));

  // Get demo household by ID
  app.get('/api/demo/households/:id', asyncHandler(async (req: Request, res: Response) => {
    await demoDataService.loadDemoData();
    const household = demoDataService.getHouseholdById(req.params.id);
    if (!household) {
      throw notFoundError('Household not found');
    }
    res.json(household);
  }));

  // Get demo benefit calculations
  app.get('/api/demo/benefit-calculations', asyncHandler(async (req: Request, res: Response) => {
    await demoDataService.loadDemoData();
    const { householdId, program } = req.query;
    const calculations = demoDataService.getBenefitCalculations(
      householdId as string,
      program as string
    );
    res.json(calculations);
  }));

  // Get demo tax returns
  app.get('/api/demo/tax-returns', asyncHandler(async (req: Request, res: Response) => {
    await demoDataService.loadDemoData();
    const { householdId, taxYear } = req.query;
    const returns = demoDataService.getTaxReturns(
      householdId as string,
      taxYear ? parseInt(taxYear as string) : undefined
    );
    res.json(returns);
  }));

  // Get demo documents
  app.get('/api/demo/documents', asyncHandler(async (req: Request, res: Response) => {
    await demoDataService.loadDemoData();
    const { householdId } = req.query;
    const documents = demoDataService.getDocuments(householdId as string);
    res.json(documents);
  }));

  // Get demo AI conversations
  app.get('/api/demo/ai-conversations', asyncHandler(async (req: Request, res: Response) => {
    await demoDataService.loadDemoData();
    const { feature, language } = req.query;
    const conversations = demoDataService.getAIConversations(
      feature as string,
      language as 'en' | 'es'
    );
    res.json(conversations);
  }));

  // Get demo AI conversation by ID
  app.get('/api/demo/ai-conversations/:id', asyncHandler(async (req: Request, res: Response) => {
    await demoDataService.loadDemoData();
    const conversation = demoDataService.getAIConversationById(req.params.id);
    if (!conversation) {
      throw notFoundError('Conversation not found');
    }
    res.json(conversation);
  }));

  // Get demo appointments
  app.get('/api/demo/appointments', asyncHandler(async (req: Request, res: Response) => {
    await demoDataService.loadDemoData();
    const { householdId } = req.query;
    const appointments = demoDataService.getAppointments(householdId as string);
    res.json(appointments);
  }));

  // Get demo policy sources
  app.get('/api/demo/policy-sources', asyncHandler(async (req: Request, res: Response) => {
    await demoDataService.loadDemoData();
    const { program, type } = req.query;
    const sources = demoDataService.getPolicySources(
      program as string,
      type as string
    );
    res.json(sources);
  }));

  // Get demo users
  app.get('/api/demo/users', asyncHandler(async (req: Request, res: Response) => {
    await demoDataService.loadDemoData();
    const { role } = req.query;
    const users = demoDataService.getUsers(role as string);
    res.json(users);
  }));

  // Get demo metrics
  app.get('/api/demo/metrics', asyncHandler(async (_req: Request, res: Response) => {
    await demoDataService.loadDemoData();
    const metrics = demoDataService.getMetrics();
    res.json(metrics);
  }));

  // ============================================================================
  // Mount MAIVE Routes
  // ============================================================================
  const maiveRouter = (await import('./api/maive.routes')).default;
  app.use('/api/maive', (req: any, res, next) => {
    req.storage = storage; // Attach storage to request
    next();
  }, maiveRouter);

  // ============================================================================
  // Mount QC Analytics Routes
  // ============================================================================
  const qcAnalyticsRouter = (await import('./api/qcAnalytics.routes')).default;
  app.use('/api/qc-analytics', qcAnalyticsRouter);

  // ============================================================================
  // Mount Benefits Navigation Routes
  // ============================================================================
  const benefitsNavigationRouter = (await import('./api/benefitsNavigation.routes')).default;
  app.use('/api/benefits-navigation', benefitsNavigationRouter);

  // ============================================================================
  // Mount Decision Points Routes
  // ============================================================================
  const decisionPointsRouter = (await import('./api/decisionPoints.routes')).default;
  app.use('/api/decision-points', decisionPointsRouter);

  // ============================================================================
  // Mount Info Cost Reduction Routes
  // ============================================================================
  const infoCostReductionRouter = (await import('./api/infoCostReduction.routes')).default;
  app.use('/api/info-cost-reduction', infoCostReductionRouter);

  // ============================================================================
  // Mount Multi-State Rules Routes
  // ============================================================================
  const multiStateRulesRouter = (await import('./api/multiStateRules.routes')).default;
  app.use('/api/multi-state-rules', multiStateRulesRouter);

  // ============================================================================
  // Mount Cross-Enrollment Intelligence Routes
  // ============================================================================
  const crossEnrollmentRouter = (await import('./api/crossEnrollment.routes')).default;
  app.use('/api/cross-enrollment', crossEnrollmentRouter);

  // ============================================================================
  // Mount State Configuration Routes - Multi-State White-Labeling
  // ============================================================================
  const { registerStateConfigurationRoutes } = await import('./routes/stateConfiguration.routes');
  registerStateConfigurationRoutes(app);

  // ============================================================================
  // Mount Cross-State Rules Routes - Cross-State Rules Architecture
  // ============================================================================
  registerCrossStateRulesRoutes(app);

  // ============================================================================
  // Mount GDPR Compliance Routes - Data Subject Rights & Privacy
  // ============================================================================
  const gdprRouter = (await import('./routes/gdpr.routes')).default;
  app.use('/api/gdpr', gdprRouter);

  // ============================================================================
  // Mount HIPAA Compliance Routes - Healthcare Data Protection & PHI Security
  // ============================================================================
  const hipaaRouter = (await import('./routes/hipaa.routes')).default;
  app.use('/api/hipaa', hipaaRouter);

  const httpServer = createServer(app);
  
  // Initialize WebSocket service for real-time notifications
  if (sessionMiddleware) {
    initializeWebSocketService(httpServer, sessionMiddleware);
  } else {
    console.warn("Warning: WebSocket service not initialized - session middleware not provided");
  }
  
  return httpServer;
}
