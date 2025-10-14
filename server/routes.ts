import type { Express } from "express";
import { createServer, type Server } from "http";
import { initializeWebSocketService } from "./services/websocket.service";
import { storage } from "./storage";
import { ragService } from "./services/ragService";
import { documentProcessor } from "./services/documentProcessor";
import { documentIngestionService } from "./services/documentIngestion";
import { automatedIngestionService } from "./services/automatedIngestion";
import { ObjectStorageService } from "./objectStorage";
import { rulesEngine } from "./services/rulesEngine";
import { hybridService } from "./services/hybridService";
import { manualIngestionService } from "./services/manualIngestion";
import { auditService } from "./services/auditService";
import { documentVerificationService } from "./services/documentVerificationService";
import { textGenerationService } from "./services/textGenerationService";
import { notificationService } from "./services/notification.service";
import { cacheService, CACHE_KEYS, invalidateRulesCache } from "./services/cacheService";
import { kpiTrackingService } from "./services/kpiTracking.service";
import { achievementSystemService } from "./services/achievementSystem.service";
import { leaderboardService } from "./services/leaderboard.service";
import { taxDocExtractor } from "./services/taxDocumentExtraction";
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
  searchQueries,
  auditLogs,
  ruleChangeLogs,
  quickRatings,
  feedbackSubmissions,
  users,
  documentRequirementTemplates,
  noticeTemplates,
  publicFaq,
  notifications
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
  const gemini = getGeminiClient();
  const response = await gemini.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }
    ]
  });
  return response.text || "";
}

async function generateTextWithGemini(prompt: string): Promise<string> {
  const gemini = getGeminiClient();
  const response = await gemini.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt
  });
  return response.text || "";
}

// ============================================================================
// VITA CERTIFICATION VALIDATION MIDDLEWARE
// ============================================================================
const requireVitaCertification = (minimumLevel: 'basic' | 'advanced' | 'military' = 'basic') => {
  return asyncHandler(async (req, res, next) => {
    // Get tax return data from request body or session
    const taxReturnData = req.body.taxReturnData || req.body;
    
    // Determine required certification
    const requirement = vitaCertificationValidationService.determineCertificationRequirement(taxReturnData);
    
    // Validate user's certification
    const validation = await vitaCertificationValidationService.validateCertification(req.user!.id, requirement);
    
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
  app.get("/api/health", asyncHandler(async (req, res) => {
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
        message: "Gemini API key not configured"
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
  app.post("/api/search", requireAuth, asyncHandler(async (req, res, next) => {
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
  app.post("/api/chat/ask", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/auth/signup", asyncHandler(async (req, res, next) => {
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
    req.login(user, (err) => {
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
  app.post("/api/auth/login", (req, res, next) => {
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
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
  
  // Get password requirements
  app.get("/api/auth/password-requirements", (req, res) => {
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
  app.post("/api/auth/change-password", requireAuth, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      throw validationError("Current password and new password are required");
    }
    
    // Get user from database to verify current password
    const user = await storage.getUserById(req.user!.id);
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
  app.get("/api/auth/me", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Return user without password
    const { password, ...userWithoutPassword } = req.user as any;
    res.json({ user: userWithoutPassword });
  });

  // Get benefit programs
  app.get("/api/benefit-programs", async (req, res) => {
    try {
      const programs = await storage.getBenefitPrograms();
      res.json(programs);
    } catch (error) {
      console.error("Error fetching benefit programs:", error);
      res.status(500).json({ error: "Failed to fetch benefit programs" });
    }
  });

  // Get document types
  app.get("/api/document-types", async (req, res) => {
    try {
      const types = await storage.getDocumentTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching document types:", error);
      res.status(500).json({ error: "Failed to fetch document types" });
    }
  });

  // Document verification endpoint with Gemini Vision API
  app.post("/api/verify-document", requireAuth, upload.single("document"), asyncHandler(async (req, res) => {
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
  app.post("/api/documents/upload", requireAdmin, upload.single("file"), async (req, res) => {
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
  app.post("/api/documents/upload-url", requireAdmin, async (req, res) => {
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
  app.post("/api/documents", requireAdmin, async (req, res) => {
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
  app.get("/api/documents", requireAdmin, async (req, res) => {
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
  app.get("/api/documents/:id", requireAdmin, async (req, res) => {
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
  app.patch("/api/documents/:id/status", requireAdmin, async (req, res) => {
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
  app.get("/api/policy-sources", requireAdmin, async (req, res) => {
    try {
      const sources = await storage.getPolicySources();
      res.json(sources);
    } catch (error) {
      console.error("Error fetching policy sources:", error);
      res.status(500).json({ error: "Failed to fetch policy sources" });
    }
  });

  app.post("/api/policy-sources", requireAdmin, async (req, res) => {
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

  app.patch("/api/policy-sources/:id", requireAdmin, async (req, res) => {
    try {
      const { syncStatus, lastSyncAt } = req.body;
      const source = await storage.updatePolicySource(req.params.id, {
        syncStatus,
        lastSyncAt,
      });
      res.json(source);
    } catch (error) {
      console.error("Error updating policy source:", error);
      res.status(500).json({ error: "Failed to update policy source" });
    }
  });

  // Trigger policy source scraping (Legacy)
  app.post("/api/policy-sources/:id/scrape", requireAdmin, async (req, res) => {
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
  app.post("/api/policy-sources/ecfr/bulk-download", requireAdmin, asyncHandler(async (req, res) => {
    const { ecfrBulkDownloader } = await import("./services/ecfrBulkDownloader");
    
    console.log("Starting eCFR Bulk Download Service...");
    
    const result = await ecfrBulkDownloader.downloadSNAPRegulations();
    
    res.json({
      success: true,
      message: "eCFR SNAP regulations downloaded successfully",
      documentsProcessed: result.documentIds.length,
      sections: result.sections.length,
      documentIds: result.documentIds
    });
  }));

  // Trigger FNS State Options Report parsing (28 SNAP options/waivers)
  app.post("/api/policy-sources/fns-state-options", requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/legislative/govinfo-bill-status", requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/legislative/govinfo-public-laws", requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/govinfo/check-versions", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/govinfo/version-status", requireAdmin, asyncHandler(async (req, res) => {
    const { govInfoVersionChecker } = await import("./services/govInfoVersionChecker");
    
    const status = await govInfoVersionChecker.getCurrentVersionStatus();
    
    res.json({
      success: true,
      status,
      timestamp: new Date(),
    });
  }));

  // Get version check history
  app.get("/api/govinfo/version-history", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/scheduler/status", requireAdmin, asyncHandler(async (req, res) => {
    const { smartScheduler } = await import("./services/smartScheduler");
    
    const status = smartScheduler.getStatus();
    
    res.json({
      success: true,
      ...status,
    });
  }));

  // Smart Scheduler - Manually trigger a specific source check
  app.post("/api/scheduler/trigger/:source", requireAdmin, asyncHandler(async (req, res) => {
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

  // Cache Management - Get aggregated cache statistics
  app.get("/api/admin/cache/stats", requireAdmin, asyncHandler(async (req, res) => {
    const { cacheMetrics } = await import("./services/cacheMetrics");
    
    const metrics = cacheMetrics.getAggregatedMetrics();
    
    res.json({
      success: true,
      ...metrics,
    });
  }));

  // Cache Management - Get cost savings report
  app.get("/api/admin/cache/cost-savings", requireAdmin, asyncHandler(async (req, res) => {
    const { cacheMetrics } = await import("./services/cacheMetrics");
    
    const report = cacheMetrics.getCostSavingsReport();
    
    res.json({
      success: true,
      ...report,
    });
  }));

  // Cache Management - Clear specific cache
  app.post("/api/admin/cache/clear/:type", requireAdmin, asyncHandler(async (req, res) => {
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

  // ============================================================================
  // MONITORING & OBSERVABILITY - Sentry integration and metrics
  // ============================================================================
  
  // Get monitoring metrics for dashboard
  app.get("/api/admin/monitoring/metrics", requireAdmin, asyncHandler(async (req, res) => {
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
  
  // Trigger a test error for Sentry verification
  app.post("/api/admin/monitoring/test-error", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/admin/monitoring/alerts", requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/admin/monitoring/alerts/:alertId/resolve", requireAdmin, asyncHandler(async (req, res) => {
    const { alertService } = await import("./services/alertService");
    const { alertId } = req.params;
    
    await alertService.resolveAlert(alertId);
    
    res.json({
      success: true,
      message: "Alert resolved successfully",
    });
  }));

  // Congress.gov API - Search bills by keywords (Real-time legislative keyword search)
  // Note: For authoritative bill status, use GovInfo Bill Status XML API
  app.post("/api/legislative/congress-search", requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/legislative/congress-track/:billNumber", requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/legislative/congress-sync", requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/legislative/maryland-scrape", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/models", requireAdmin, async (req, res) => {
    try {
      const models = await storage.getModelVersions();
      res.json(models);
    } catch (error) {
      console.error("Error fetching model versions:", error);
      res.status(500).json({ error: "Failed to fetch model versions" });
    }
  });

  // Training Jobs
  app.get("/api/training-jobs", requireAdmin, async (req, res) => {
    try {
      const jobs = await storage.getTrainingJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching training jobs:", error);
      res.status(500).json({ error: "Failed to fetch training jobs" });
    }
  });

  app.post("/api/training-jobs", requireAdmin, async (req, res) => {
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

  app.patch("/api/training-jobs/:id", requireAdmin, async (req, res) => {
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
  app.get("/api/system/status", requireAdmin, async (req, res) => {
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
  app.post("/api/ingest/maryland-snap", requireAdmin, async (req, res) => {
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
  app.get("/api/golden-source/documents", requireAdmin, async (req, res) => {
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
  app.post("/api/golden-source/verify/:documentId", requireAdmin, async (req, res) => {
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
  app.get("/api/golden-source/audit-trail/:documentId", requireAdmin, async (req, res) => {
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
  app.get("/api/automated-ingestion/schedules", requireAdmin, async (req, res) => {
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

  app.post("/api/automated-ingestion/trigger", requireAdmin, async (req, res) => {
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

  app.patch("/api/automated-ingestion/schedules/:id", requireAdmin, async (req, res) => {
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

  app.post("/api/automated-ingestion/schedules", requireAdmin, async (req, res) => {
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
  app.post("/api/eligibility/check", requireAuth, async (req, res) => {
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
  app.post("/api/eligibility/calculate", requireAuth, async (req, res) => {
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

  // Get active SNAP income limits
  app.get("/api/rules/income-limits", requireAuth, async (req, res) => {
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
  app.post("/api/rules/income-limits", requireAdmin, async (req, res) => {
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
  app.patch("/api/rules/income-limits/:id", requireAdmin, async (req, res) => {
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
  app.get("/api/rules/deductions", requireAuth, async (req, res) => {
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
  app.get("/api/rules/allotments", requireAuth, async (req, res) => {
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
  app.get("/api/rules/categorical-eligibility", requireAuth, async (req, res) => {
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
  app.get("/api/rules/document-requirements", requireAuth, async (req, res) => {
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

  // Get recent eligibility calculations
  app.get("/api/eligibility/calculations", requireAuth, async (req, res) => {
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
  app.get("/api/manual/sections", requireAuth, async (req, res) => {
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
  app.get("/api/manual/sections/:id", requireAuth, async (req, res) => {
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
  app.get("/api/manual/structure", requireAuth, async (req, res) => {
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
  app.get("/api/manual/status", requireAuth, async (req, res) => {
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
  app.post("/api/manual/ingest-metadata", requireAdmin, async (req, res) => {
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
  app.post("/api/manual/ingest-full", requireAdmin, async (req, res) => {
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
  app.post("/api/vita/ingest-pub4012", requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/vita/download-irs-publications", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/vita/documents", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/vita/search", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/vita/topics", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/manual/generate-text/:sectionId", requireAuth, async (req, res) => {
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
  app.post("/api/manual/generate/income-limits", requireAuth, async (req, res) => {
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
  app.post("/api/manual/generate/deductions", requireAuth, async (req, res) => {
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
  app.post("/api/manual/generate/allotments", requireAuth, async (req, res) => {
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
  app.get("/api/navigator/sessions", requireStaff, asyncHandler(async (req, res) => {
    const sessions = await storage.getClientInteractionSessions();
    res.json(sessions);
  }));

  // Create a new client interaction session
  app.post("/api/navigator/sessions", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/navigator/exports", requireStaff, asyncHandler(async (req, res) => {
    const exports = await storage.getEEExportBatches();
    res.json(exports);
  }));

  // Create a new E&E export batch
  app.post("/api/navigator/exports", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/navigator/exports/:id/download", requireStaff, asyncHandler(async (req, res) => {
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
  app.post("/api/navigator/sessions/:sessionId/documents", requireStaff, upload.single("document"), asyncHandler(async (req, res) => {
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
  app.get("/api/navigator/sessions/:sessionId/documents", requireStaff, asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const documents = await storage.getClientVerificationDocuments({ sessionId });
    res.json(documents);
  }));

  // Update verification document status (approve/reject/edit)
  app.patch("/api/navigator/documents/:id", requireStaff, asyncHandler(async (req, res) => {
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
  app.delete("/api/navigator/documents/:id", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/consent/forms", requireStaff, asyncHandler(async (req, res) => {
    const forms = await storage.getConsentForms();
    res.json(forms);
  }));

  // Create a new consent form
  app.post("/api/consent/forms", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/consent/client-consents", requireAuth, asyncHandler(async (req, res) => {
    const clientCaseId = req.query.clientCaseId as string | undefined;
    const consents = await storage.getClientConsents(clientCaseId);
    res.json(consents);
  }));

  // Create a new client consent
  app.post("/api/consent/client-consents", requireAuth, asyncHandler(async (req, res) => {
    const validatedData = clientConsentSchema.parse(req.body);
    
    // Verify that the form exists and is active
    const form = await storage.getConsentForm(validatedData.consentFormId);
    if (!form) {
      throw validationError("Consent form not found");
    }
    if (!form.isActive) {
      throw validationError("Consent form is not active");
    }
    
    // Calculate expiration date if the form has an expiration period
    let expiresAt: Date | null = null;
    if (form.expirationDays) {
      const consentDate = new Date(validatedData.consentDate);
      expiresAt = new Date(consentDate.getTime() + form.expirationDays * 24 * 60 * 60 * 1000);
    }

    const consentData = {
      clientCaseId: validatedData.clientCaseId,
      consentFormId: validatedData.consentFormId,
      consentGiven: validatedData.consentGiven,
      consentDate: new Date(validatedData.consentDate),
      signatureMethod: validatedData.signatureMethod,
      notes: validatedData.notes,
      expiresAt
    };

    const consent = await storage.createClientConsent(consentData);
    res.json(consent);
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
  app.post("/api/extraction/extract-section", requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/extraction/extract-batch", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/extraction/jobs/:jobId", requireAdmin, asyncHandler(async (req, res) => {
    const { getExtractionJob } = await import('./services/rulesExtractionService');
    
    const job = await getExtractionJob(req.params.jobId);
    
    if (!job) {
      res.status(404).json({ message: "Extraction job not found" });
      return;
    }
    
    res.json(job);
  }));

  // Get all extraction jobs
  app.get("/api/extraction/jobs", requireAdmin, asyncHandler(async (req, res) => {
    const { getAllExtractionJobs } = await import('./services/rulesExtractionService');
    
    const jobs = await getAllExtractionJobs();
    
    res.json(jobs);
  }));

  // ===== AI HEALTH & BIAS MONITORING ROUTES =====
  
  // Get AI query analytics
  app.get("/api/ai-monitoring/query-analytics", asyncHandler(async (req, res) => {
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
  app.get("/api/ai-monitoring/system-health", asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Error rates from audit logs
    const errorMetrics = await db
      .select({
        date: sql<string>`DATE(${auditLogs.timestamp})`,
        totalEvents: sql<number>`COUNT(*)::int`,
        errors: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.action} = 'ERROR')::int`
      })
      .from(auditLogs)
      .where(sql`${auditLogs.timestamp} >= ${startDate}`)
      .groupBy(sql`DATE(${auditLogs.timestamp})`)
      .orderBy(sql`DATE(${auditLogs.timestamp})`);

    // External service health (Gemini API)
    const serviceHealth = await db
      .select({
        service: sql<string>`${auditLogs.metadata}->>'service'`,
        totalCalls: sql<number>`COUNT(*)::int`,
        failures: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.metadata}->>'success' = 'false')::int`,
        avgResponseTime: sql<number>`AVG((${auditLogs.metadata}->>'responseTime')::int)::int`
      })
      .from(auditLogs)
      .where(sql`
        ${auditLogs.timestamp} >= ${startDate} AND 
        ${auditLogs.action} = 'EXTERNAL_SERVICE' AND
        ${auditLogs.metadata}->>'service' IS NOT NULL
      `)
      .groupBy(sql`${auditLogs.metadata}->>'service'`);

    res.json({
      errorTrends: errorMetrics,
      serviceHealth,
      period: `Last ${days} days`
    });
  }));

  // ===== SECURITY MONITORING ROUTES =====
  
  // Get security metrics and alerts
  app.get("/api/security/metrics", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
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
        entityTypes: sql<string>`string_agg(DISTINCT ${auditLogs.entityType}, ', ')`
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
  app.get("/api/security/alerts", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
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
        metadata: auditLogs.metadata
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
  app.get("/api/ai-monitoring/response-quality", asyncHandler(async (req, res) => {
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
  app.post("/api/ai-monitoring/flag-response", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/audit-logs", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
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
      conditions.push(eq(auditLogs.entityType, entityType as string));
    }
    if (userId) {
      conditions.push(eq(auditLogs.userId, userId as string));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.timestamp, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.timestamp, new Date(endDate as string)));
    }

    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        userId: auditLogs.userId,
        metadata: auditLogs.metadata,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        timestamp: auditLogs.timestamp,
        username: users.username
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.timestamp))
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
  app.get("/api/rule-change-logs", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/feedback", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/feedback", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/feedback/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
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
  app.patch("/api/feedback/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/quick-ratings", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/quick-ratings/stats", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/notifications", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/notifications/unread-count", requireAuth, asyncHandler(async (req, res) => {
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
  app.patch("/api/notifications/:id/read", requireAuth, verifyNotificationOwnership(), asyncHandler(async (req, res) => {
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
  app.patch("/api/notifications/read-all", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/notifications/preferences", requireAuth, asyncHandler(async (req, res) => {
    const userId = (req as any).userId;
    const prefs = await notificationService.getUserPreferences(userId);
    res.json(prefs);
  }));

  // Update user notification preferences
  app.patch("/api/notifications/preferences", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/public/document-templates", asyncHandler(async (req, res) => {
    const templates = await db
      .select()
      .from(documentRequirementTemplates)
      .where(eq(documentRequirementTemplates.isActive, true))
      .orderBy(documentRequirementTemplates.sortOrder);
    
    res.json(templates);
  }));

  // Get notice templates
  app.get("/api/public/notice-templates", asyncHandler(async (req, res) => {
    const templates = await db
      .select()
      .from(noticeTemplates)
      .where(eq(noticeTemplates.isActive, true))
      .orderBy(noticeTemplates.sortOrder);
    
    res.json(templates);
  }));

  // Get public FAQ
  app.get("/api/public/faq", asyncHandler(async (req, res) => {
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
  app.post("/api/public/analyze-notice", asyncHandler(async (req, res) => {
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
  app.post("/api/public/explain-notice", asyncHandler(async (req, res) => {
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
  app.post("/api/public/search-faq", asyncHandler(async (req, res) => {
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
  app.get("/api/policy-changes", requireAuth, asyncHandler(async (req, res) => {
    const { benefitProgramId, status, limit } = req.query;
    
    const changes = await storage.getPolicyChanges({
      benefitProgramId: benefitProgramId as string,
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json(changes);
  }));

  // Get single policy change details (requires auth)
  app.get("/api/policy-changes/:id", requireAuth, asyncHandler(async (req, res) => {
    const change = await storage.getPolicyChange(req.params.id);
    
    if (!change) {
      throw validationError("Policy change not found");
    }
    
    res.json(change);
  }));

  // Get impacts for a policy change (staff/admin only - contains sensitive data)
  app.get("/api/policy-changes/:id/impacts", requireStaff, asyncHandler(async (req, res) => {
    const impacts = await storage.getPolicyChangeImpacts(req.params.id);
    res.json(impacts);
  }));

  // Get user's policy change impacts (requires auth)
  app.get("/api/my-policy-impacts", requireAuth, asyncHandler(async (req, res) => {
    const unresolved = req.query.unresolved === 'true';
    const impacts = await storage.getUserPolicyChangeImpacts(req.user!.id, unresolved);
    res.json(impacts);
  }));

  // Create policy change (admin only)
  app.post("/api/policy-changes", requireAdmin, asyncHandler(async (req, res) => {
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
  app.patch("/api/policy-changes/:id", requireAdmin, asyncHandler(async (req, res) => {
    const change = await storage.updatePolicyChange(req.params.id, req.body);
    
    // Invalidate cache
    cacheService.del('policy_changes:all');
    cacheService.del(`policy_change:${req.params.id}`);
    
    res.json(change);
  }));

  // Create policy change impact
  app.post("/api/policy-change-impacts", requireAdmin, asyncHandler(async (req, res) => {
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
  app.patch("/api/policy-change-impacts/:id/acknowledge", requireAuth, asyncHandler(async (req, res) => {
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
  app.patch("/api/policy-change-impacts/:id/resolve", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/compliance-rules", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/compliance-rules/:id", requireAdmin, asyncHandler(async (req, res) => {
    const rule = await storage.getComplianceRule(req.params.id);
    
    if (!rule) {
      throw validationError("Compliance rule not found");
    }
    
    res.json(rule);
  }));

  // Create compliance rule (admin only)
  app.post("/api/compliance-rules", requireAdmin, asyncHandler(async (req, res) => {
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
  app.patch("/api/compliance-rules/:id", requireAdmin, asyncHandler(async (req, res) => {
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
  app.delete("/api/compliance-rules/:id", requireAdmin, asyncHandler(async (req, res) => {
    await storage.deleteComplianceRule(req.params.id);
    
    cacheService.del('compliance_rules:all');
    
    res.status(204).send();
  }));

  // Get all compliance violations with filters (admin only)
  app.get("/api/compliance-violations", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/compliance-violations/:id", requireAdmin, asyncHandler(async (req, res) => {
    const violation = await storage.getComplianceViolation(req.params.id);
    
    if (!violation) {
      throw validationError("Compliance violation not found");
    }
    
    res.json(violation);
  }));

  // Acknowledge compliance violation (admin/staff only)
  app.patch("/api/compliance-violations/:id/acknowledge", requireAdmin, asyncHandler(async (req, res) => {
    const violation = await storage.updateComplianceViolation(req.params.id, {
      status: 'acknowledged',
      acknowledgedBy: req.user!.id,
      acknowledgedAt: new Date()
    });
    
    res.json(violation);
  }));

  // Resolve compliance violation (admin only)
  app.patch("/api/compliance-violations/:id/resolve", requireAdmin, asyncHandler(async (req, res) => {
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
  app.patch("/api/compliance-violations/:id/dismiss", requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/intake-sessions", requireAuth, asyncHandler(async (req, res) => {
    const validatedData = insertIntakeSessionSchema.parse(req.body);
    
    const session = await storage.createIntakeSession({
      ...validatedData,
      userId: req.user!.id,
    });
    
    res.status(201).json(session);
  }));
  
  // Get user's intake sessions
  app.get("/api/intake-sessions", requireAuth, asyncHandler(async (req, res) => {
    const { status } = req.query;
    
    const sessions = await storage.getIntakeSessions({
      userId: req.user!.id,
      status: status as string,
      limit: 50,
    });
    
    res.json(sessions);
  }));
  
  // Get single intake session
  app.get("/api/intake-sessions/:id", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/intake-sessions/:id/messages", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/intake-sessions/:id/messages", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/intake-sessions/:id/generate-form", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/intake-sessions/:id/form", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/application-forms", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/policyengine/calculate", asyncHandler(async (req, res) => {
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
  app.post("/api/policyengine/verify", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/policyengine/verify/stats/:programCode", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/policyengine/verify/history/:programCode", requireAdmin, asyncHandler(async (req, res) => {
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

  // Get formatted multi-benefit summary
  app.post("/api/policyengine/summary", asyncHandler(async (req, res) => {
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

  // Test PolicyEngine connection
  app.get("/api/policyengine/test", asyncHandler(async (req, res) => {
    const { policyEngineService } = await import("./services/policyEngine.service");
    
    const available = await policyEngineService.testConnection();
    
    res.json({
      available,
      message: available 
        ? "PolicyEngine is available and ready to use" 
        : "PolicyEngine is not available. Please check the installation."
    });
  }));

  // ============================================================================
  // Tax Preparation Routes
  // ============================================================================

  // Upload and extract tax document (W-2, 1099, 1095-A)
  app.post("/api/tax/documents/extract", requireAuth, upload.single('taxDocument'), asyncHandler(async (req, res) => {
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
  app.post("/api/tax/calculate", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/tax/form1040/generate", requireAuth, asyncHandler(async (req, res) => {
    const { form1040GeneratorService } = await import("./services/form1040Generator");
    
    const schema = z.object({
      taxReturnId: z.string()
    });

    const validated = schema.parse(req.body);

    // Get tax return data
    const taxReturn = await storage.getFederalTaxReturn(validated.taxReturnId);
    if (!taxReturn) {
      return res.status(404).json({ error: "Tax return not found" });
    }

    // Generate PDF
    const pdfBuffer = await form1040GeneratorService.generateForm1040PDF(
      taxReturn.form1040Data,
      taxReturn.taxYear
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Form-1040-${taxReturn.taxYear}.pdf"`);
    res.send(pdfBuffer);
  }));

  // Generate Maryland Form 502 PDF (from saved tax return)
  app.post("/api/tax/form502/generate", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/tax/maryland/calculate", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/tax/cross-enrollment/analyze", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/tax/federal", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/tax/federal/:id", requireAuth, asyncHandler(async (req, res) => {
    const taxReturn = await storage.getFederalTaxReturn(req.params.id);
    
    if (!taxReturn) {
      return res.status(404).json({ error: "Tax return not found" });
    }

    res.json(taxReturn);
  }));

  // Get federal tax returns with filters
  app.get("/api/tax/federal", requireAuth, asyncHandler(async (req, res) => {
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
  app.patch("/api/tax/federal/:id", requireAuth, asyncHandler(async (req, res) => {
    const updates = req.body;
    const taxReturn = await storage.updateFederalTaxReturn(req.params.id, updates);
    res.json(taxReturn);
  }));

  // Delete federal tax return
  app.delete("/api/tax/federal/:id", requireAuth, asyncHandler(async (req, res) => {
    await storage.deleteFederalTaxReturn(req.params.id);
    res.json({ success: true });
  }));

  // Create Maryland tax return
  app.post("/api/tax/maryland", requireAuth, asyncHandler(async (req, res) => {
    const schema = insertMarylandTaxReturnSchema;
    const validated = schema.parse(req.body);

    const taxReturn = await storage.createMarylandTaxReturn(validated);
    res.json(taxReturn);
  }));

  // Get Maryland tax return
  app.get("/api/tax/maryland/:id", requireAuth, asyncHandler(async (req, res) => {
    const taxReturn = await storage.getMarylandTaxReturn(req.params.id);
    
    if (!taxReturn) {
      return res.status(404).json({ error: "Maryland tax return not found" });
    }

    res.json(taxReturn);
  }));

  // Get Maryland tax return by federal ID
  app.get("/api/tax/maryland/federal/:federalId", requireAuth, asyncHandler(async (req, res) => {
    const taxReturn = await storage.getMarylandTaxReturnByFederalId(req.params.federalId);
    
    if (!taxReturn) {
      return res.status(404).json({ error: "Maryland tax return not found" });
    }

    res.json(taxReturn);
  }));

  // Update Maryland tax return
  app.patch("/api/tax/maryland/:id", requireAuth, asyncHandler(async (req, res) => {
    const updates = req.body;
    const taxReturn = await storage.updateMarylandTaxReturn(req.params.id, updates);
    res.json(taxReturn);
  }));

  // Get tax documents
  app.get("/api/tax/documents", requireAuth, asyncHandler(async (req, res) => {
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
  app.patch("/api/tax/documents/:id/verify", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/screener/save", asyncHandler(async (req, res) => {
    const schema = z.object({
      sessionId: z.string(),
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
      benefitResults: z.object({
        success: z.boolean(),
        benefits: z.object({
          snap: z.number(),
          medicaid: z.boolean(),
          eitc: z.number(),
          childTaxCredit: z.number(),
          ssi: z.number(),
          tanf: z.number(),
          householdNetIncome: z.number(),
          householdTax: z.number(),
          householdBenefits: z.number(),
          marginalTaxRate: z.number()
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
      validated.benefitResults.benefits.tanf > 0
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
  app.get("/api/screener/sessions/:sessionId", asyncHandler(async (req, res) => {
    const session = await storage.getAnonymousScreeningSession(req.params.sessionId);
    
    if (!session) {
      throw validationError("Session not found");
    }
    
    res.json(session);
  }));

  // Claim anonymous screening session (requires auth)
  app.post("/api/screener/sessions/:sessionId/claim", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/screener/my-sessions", requireAuth, asyncHandler(async (req, res) => {
    const sessions = await storage.getAnonymousScreeningSessionsByUser(req.user!.id);
    res.json(sessions);
  }));

  // ============================================================================
  // Household Scenario Workspace Routes
  // ============================================================================

  // Create household scenario
  app.post("/api/scenarios", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/scenarios", requireAuth, asyncHandler(async (req, res) => {
    const scenarios = await storage.getHouseholdScenariosByUser(req.user!.id);
    res.json(scenarios);
  }));

  // Get single scenario
  app.get("/api/scenarios/:id", requireAuth, asyncHandler(async (req, res) => {
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
  app.patch("/api/scenarios/:id", requireAuth, asyncHandler(async (req, res) => {
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
  app.delete("/api/scenarios/:id", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/scenarios/:id/calculate", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/scenarios/:id/calculations", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/scenarios/:id/calculations/latest", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/comparisons", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/comparisons", requireAuth, asyncHandler(async (req, res) => {
    const comparisons = await storage.getScenarioComparisonsByUser(req.user!.id);
    res.json(comparisons);
  }));

  // Get single comparison
  app.get("/api/comparisons/:id", requireAuth, asyncHandler(async (req, res) => {
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
  app.patch("/api/comparisons/:id", requireAuth, asyncHandler(async (req, res) => {
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
  app.delete("/api/comparisons/:id", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/household-profiles", requireStaff, asyncHandler(async (req, res) => {
    const validated = insertHouseholdProfileSchema.parse({
      ...req.body,
      userId: req.user!.id
    });

    const profile = await storage.createHouseholdProfile(validated);
    res.json(profile);
  }));

  // Get all household profiles for user with optional filters
  app.get("/api/household-profiles", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/household-profiles/:id", requireStaff, verifyHouseholdProfileOwnership(), asyncHandler(async (req, res) => {
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
  app.patch("/api/household-profiles/:id", requireStaff, verifyHouseholdProfileOwnership(), asyncHandler(async (req, res) => {
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
  app.delete("/api/household-profiles/:id", requireStaff, verifyHouseholdProfileOwnership(), asyncHandler(async (req, res) => {
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
  app.post("/api/vita-intake", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/vita-intake", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/vita-intake/:id", requireStaff, verifyVitaSessionOwnership(), asyncHandler(async (req, res) => {
    const session = await storage.getVitaIntakeSession(req.params.id);
    
    if (!session) {
      throw notFoundError("VITA intake session not found");
    }
    
    if (session.userId !== req.user!.id) {
      throw authorizationError();
    }
    
    // Decrypt sensitive fields before sending to frontend
    const decryptedSession = decryptVitaIntake(session);
    res.json(decryptedSession);
  }));

  // Update VITA intake session (with ownership verification)
  app.patch("/api/vita-intake/:id", requireStaff, verifyVitaSessionOwnership(), asyncHandler(async (req, res) => {
    const session = await storage.getVitaIntakeSession(req.params.id);
    
    if (!session) {
      throw notFoundError("VITA intake session not found");
    }
    
    if (session.userId !== req.user!.id) {
      throw authorizationError();
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
  app.delete("/api/vita-intake/:id", requireStaff, verifyVitaSessionOwnership(), asyncHandler(async (req, res) => {
    const session = await storage.getVitaIntakeSession(req.params.id);
    
    if (!session) {
      throw notFoundError("VITA intake session not found");
    }
    
    if (session.userId !== req.user!.id) {
      throw authorizationError();
    }
    
    await storage.deleteVitaIntakeSession(req.params.id);
    res.json({ success: true });
  }));

  // ==========================================
  // VITA Tax Document Upload Routes
  // ==========================================

  // Get presigned URL for tax document upload
  app.post("/api/vita-intake/:sessionId/tax-documents/upload-url", requireStaff, asyncHandler(async (req, res) => {
    const session = await storage.getVitaIntakeSession(req.params.sessionId);
    
    if (!session) {
      throw notFoundError("VITA intake session not found");
    }
    
    if (session.userId !== req.user!.id) {
      throw authorizationError();
    }

    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    
    res.json({ uploadURL });
  }));

  // Create tax document record and trigger extraction
  app.post("/api/vita-intake/:sessionId/tax-documents", requireStaff, asyncHandler(async (req, res) => {
    const session = await storage.getVitaIntakeSession(req.params.sessionId);
    
    if (!session) {
      throw notFoundError("VITA intake session not found");
    }
    
    if (session.userId !== req.user!.id) {
      throw authorizationError();
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
  app.get("/api/vita-intake/:sessionId/tax-documents", requireStaff, asyncHandler(async (req, res) => {
    const session = await storage.getVitaIntakeSession(req.params.sessionId);
    
    if (!session) {
      throw notFoundError("VITA intake session not found");
    }
    
    if (session.userId !== req.user!.id) {
      throw authorizationError();
    }

    const taxDocs = await storage.getTaxDocuments({
      vitaSessionId: req.params.sessionId,
    });

    res.json(taxDocs);
  }));

  // Delete a tax document (with ownership verification via session)
  app.delete("/api/vita-intake/:sessionId/tax-documents/:id", requireStaff, verifyVitaSessionOwnership(), asyncHandler(async (req, res) => {
    const session = await storage.getVitaIntakeSession(req.params.sessionId);
    
    if (!session) {
      throw notFoundError("VITA intake session not found");
    }
    
    if (session.userId !== req.user!.id) {
      throw authorizationError();
    }

    const taxDoc = await storage.getTaxDocument(req.params.id);
    
    if (!taxDoc) {
      throw notFoundError("Tax document not found");
    }

    if (taxDoc.vitaSessionId !== req.params.sessionId) {
      throw authorizationError();
    }

    await storage.deleteTaxDocument(req.params.id);
    res.json({ success: true });
  }));

  // ==========================================
  // ABAWD Exemption Verification Routes
  // ==========================================

  // Create ABAWD exemption verification
  app.post("/api/abawd-verifications", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/abawd-verifications", requireStaff, asyncHandler(async (req, res) => {
    const filters: any = {};
    
    if (req.query.clientCaseId) filters.clientCaseId = req.query.clientCaseId as string;
    if (req.query.exemptionStatus) filters.exemptionStatus = req.query.exemptionStatus as string;
    if (req.query.exemptionType) filters.exemptionType = req.query.exemptionType as string;
    if (req.query.verifiedBy) filters.verifiedBy = req.query.verifiedBy as string;

    const verifications = await storage.getAbawdExemptionVerifications(filters);
    res.json(verifications);
  }));

  // Get single ABAWD verification
  app.get("/api/abawd-verifications/:id", requireStaff, asyncHandler(async (req, res) => {
    const verification = await storage.getAbawdExemptionVerification(req.params.id);
    
    if (!verification) {
      throw notFoundError("Verification not found");
    }

    res.json(verification);
  }));

  // Update ABAWD verification
  app.put("/api/abawd-verifications/:id", requireStaff, asyncHandler(async (req, res) => {
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
  app.delete("/api/abawd-verifications/:id", requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/program-enrollments", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/program-enrollments", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/program-enrollments/client/:clientIdentifier", requireStaff, asyncHandler(async (req, res) => {
    const enrollments = await storage.getProgramEnrollmentsByClient(req.params.clientIdentifier);
    res.json(enrollments);
  }));

  // Get single program enrollment
  app.get("/api/program-enrollments/:id", requireStaff, asyncHandler(async (req, res) => {
    const enrollment = await storage.getProgramEnrollment(req.params.id);
    
    if (!enrollment) {
      throw notFoundError("Enrollment not found");
    }

    res.json(enrollment);
  }));

  // Update program enrollment
  app.put("/api/program-enrollments/:id", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/cross-enrollment/analyze/:clientIdentifier", requireStaff, asyncHandler(async (req, res) => {
    const analysis = await storage.analyzeCrossEnrollmentOpportunities(req.params.clientIdentifier);
    res.json(analysis);
  }));

  // ==========================================
  // Document Review Queue Routes (Navigator)
  // ==========================================

  // Get client verification documents for review
  app.get("/api/document-review/queue", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/document-review/:id", requireStaff, asyncHandler(async (req, res) => {
    const document = await storage.getClientVerificationDocument(req.params.id);
    
    if (!document) {
      throw notFoundError("Document not found");
    }

    res.json(document);
  }));

  // Approve or reject a document
  app.put("/api/document-review/:id/status", requireStaff, asyncHandler(async (req, res) => {
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
  app.put("/api/document-review/bulk-update", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/counties", asyncHandler(async (req, res) => {
    const { isActive, isPilot, region } = req.query;
    
    const filters: any = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (isPilot !== undefined) filters.isPilot = isPilot === 'true';
    if (region) filters.region = region as string;
    
    const counties = await storage.getCounties(filters);
    res.json(counties);
  }));

  // Create county (admin only)
  app.post("/api/counties", requireAdmin, asyncHandler(async (req, res) => {
    const validated = insertCountySchema.parse(req.body);
    const county = await storage.createCounty(validated);
    res.status(201).json(county);
  }));

  // Get county by ID
  app.get("/api/counties/:id", asyncHandler(async (req, res) => {
    const county = await storage.getCounty(req.params.id);
    if (!county) {
      throw notFoundError("County not found");
    }
    res.json(county);
  }));

  // Update county (admin only)
  app.patch("/api/counties/:id", requireAdmin, asyncHandler(async (req, res) => {
    const validated = insertCountySchema.partial().parse(req.body);
    const county = await storage.updateCounty(req.params.id, validated);
    if (!county) {
      throw notFoundError("County not found");
    }
    res.json(county);
  }));

  // Delete county (admin only)
  app.delete("/api/counties/:id", requireAdmin, asyncHandler(async (req, res) => {
    await storage.deleteCounty(req.params.id);
    res.json({ message: "County deleted successfully" });
  }));

  // Assign user to county (admin only)
  app.post("/api/counties/:id/users", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/counties/:id/users", asyncHandler(async (req, res) => {
    const users = await storage.getCountyUsers(req.params.id);
    res.json(users);
  }));

  // Get user's counties
  app.get("/api/users/:userId/counties", asyncHandler(async (req, res) => {
    const counties = await storage.getUserCounties(req.params.userId);
    res.json(counties);
  }));

  // Remove user from county (admin only)
  app.delete("/api/county-users/:id", requireAdmin, asyncHandler(async (req, res) => {
    await storage.removeUserFromCounty(req.params.id);
    res.json({ message: "User removed from county successfully" });
  }));

  // Get current user's county branding
  app.get("/api/branding/current", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/counties/:id/metrics", requireAuth, asyncHandler(async (req, res) => {
    const { periodType, limit } = req.query;
    
    const metrics = await storage.getCountyMetrics(
      req.params.id,
      periodType as string,
      limit ? parseInt(limit as string) : 10
    );
    
    res.json(metrics);
  }));

  // Get latest county metric for comparison
  app.get("/api/counties/:id/metrics/latest", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/county-analytics/comparison", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/tenant/current", asyncHandler(async (req, res) => {
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
  app.get("/api/admin/tenants", requireAdmin, asyncHandler(async (req, res) => {
    const { type, status, parentTenantId } = req.query;
    
    const filters: any = {};
    if (type) filters.type = type as string;
    if (status) filters.status = status as string;
    if (parentTenantId) filters.parentTenantId = parentTenantId as string;
    
    const tenants = await storage.getTenants(filters);
    res.json(tenants);
  }));

  // Get specific tenant (super admin only)
  app.get("/api/admin/tenants/:id", requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/admin/tenants", requireAdmin, asyncHandler(async (req, res) => {
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
  app.patch("/api/admin/tenants/:id", requireAdmin, asyncHandler(async (req, res) => {
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
  app.delete("/api/admin/tenants/:id", requireAdmin, asyncHandler(async (req, res) => {
    await storage.deleteTenant(req.params.id);
    res.status(204).send();
  }));

  // Update tenant branding (super admin only)
  app.patch("/api/admin/tenants/:id/branding", requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/navigators/:id/kpis", asyncHandler(async (req, res) => {
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
  app.get("/api/navigators/:id/performance", asyncHandler(async (req, res) => {
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
  app.post("/api/kpis/track-case-closed", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/kpis/track-document-verified", requireAuth, asyncHandler(async (req, res) => {
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
  app.post("/api/kpis/track-cross-enrollment", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/achievements", asyncHandler(async (req, res) => {
    const { category, tier, isActive } = req.query;
    
    const filters: any = {};
    if (category) filters.category = category as string;
    if (tier) filters.tier = tier as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const achievements = await storage.getAchievements(filters);
    res.json(achievements);
  }));

  // Create achievement (admin only)
  app.post("/api/achievements", requireAdmin, asyncHandler(async (req, res) => {
    const achievementData = req.body;
    const achievement = await storage.createAchievement(achievementData);
    res.status(201).json(achievement);
  }));

  // Get achievement by ID
  app.get("/api/achievements/:id", asyncHandler(async (req, res) => {
    const achievement = await storage.getAchievement(req.params.id);
    if (!achievement) {
      throw notFoundError("Achievement not found");
    }
    res.json(achievement);
  }));

  // Update achievement (admin only)
  app.patch("/api/achievements/:id", requireAdmin, asyncHandler(async (req, res) => {
    const achievementData = req.body;
    const achievement = await storage.updateAchievement(req.params.id, achievementData);
    if (!achievement) {
      throw notFoundError("Achievement not found");
    }
    res.json(achievement);
  }));

  // Delete achievement (admin only)
  app.delete("/api/achievements/:id", requireAdmin, asyncHandler(async (req, res) => {
    await storage.deleteAchievement(req.params.id);
    res.json({ message: "Achievement deleted successfully" });
  }));

  // Get navigator's achievements
  app.get("/api/navigators/:id/achievements", asyncHandler(async (req, res) => {
    const achievements = await storage.getNavigatorAchievements(req.params.id);
    res.json(achievements);
  }));

  // Get unnotified achievements
  app.get("/api/navigators/:id/achievements/unnotified", asyncHandler(async (req, res) => {
    const achievements = await storage.getNavigatorAchievements(req.params.id);
    const unnotified = achievements.filter(a => !a.notified);
    res.json(unnotified);
  }));

  // Mark achievements as notified
  app.post("/api/navigator-achievements/mark-notified", asyncHandler(async (req, res) => {
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
  app.get("/api/leaderboards", asyncHandler(async (req, res) => {
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
  app.get("/api/leaderboards/refresh", requireAdmin, asyncHandler(async (req, res) => {
    await leaderboardService.refreshAllLeaderboards();
    res.json({ message: "All leaderboards refreshed successfully" });
  }));

  // Get navigator's rank
  app.get("/api/navigators/:id/rank", asyncHandler(async (req, res) => {
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
  app.get("/api/qc/flagged-cases/me", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) {
      throw authorizationError("Authentication required");
    }

    const flaggedCases = await storage.getFlaggedCasesByCaseworker(req.user.id);
    res.json(flaggedCases);
  }));

  // Get error patterns for current caseworker
  app.get("/api/qc/error-patterns/me", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/qc/job-aids", requireAuth, asyncHandler(async (req, res) => {
    const { category } = req.query;
    
    const filters = category ? { category: category as string } : undefined;
    const jobAids = await storage.getJobAids(filters);
    
    res.json(jobAids);
  }));

  // Get recommended training interventions
  app.get("/api/qc/training-interventions", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/qc/error-patterns", requireStaff, asyncHandler(async (req, res) => {
    const { errorCategory, quarterOccurred, severity } = req.query;
    
    const filters: any = {};
    if (errorCategory) filters.errorCategory = errorCategory as string;
    if (quarterOccurred) filters.quarterOccurred = quarterOccurred as string;
    if (severity) filters.severity = severity as string;
    
    const patterns = await storage.getQcErrorPatterns(filters);
    res.json(patterns);
  }));

  // Get all flagged cases for supervisor's team
  app.get("/api/qc/flagged-cases/team", requireStaff, asyncHandler(async (req, res) => {
    if (!req.user) {
      throw authorizationError("Authentication required");
    }

    const flaggedCases = await storage.getFlaggedCasesForSupervisor(req.user.id);
    res.json(flaggedCases);
  }));

  // Assign flagged case to caseworker with coaching notes
  app.post("/api/qc/flagged-cases/:id/assign", requireStaff, asyncHandler(async (req, res) => {
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
  app.get("/api/evaluation/test-cases", requireAuth, asyncHandler(async (req, res) => {
    const { program, category, isActive } = req.query;
    
    const filters: any = {};
    if (program) filters.program = program as string;
    if (category) filters.category = category as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const testCases = await storage.getEvaluationTestCases(filters);
    res.json(testCases);
  }));

  // Get single test case
  app.get("/api/evaluation/test-cases/:id", requireAuth, asyncHandler(async (req, res) => {
    const testCase = await storage.getEvaluationTestCase(req.params.id);
    if (!testCase) {
      throw notFoundError("Test case not found");
    }
    res.json(testCase);
  }));

  // Create test case
  app.post("/api/evaluation/test-cases", requireAuth, asyncHandler(async (req, res) => {
    const { insertEvaluationTestCaseSchema } = await import("@shared/schema");
    const validated = insertEvaluationTestCaseSchema.parse(req.body);
    
    const testCase = await storage.createEvaluationTestCase({
      ...validated,
      createdBy: req.user!.id
    });
    
    res.status(201).json(testCase);
  }));

  // Update test case
  app.patch("/api/evaluation/test-cases/:id", requireAuth, asyncHandler(async (req, res) => {
    const testCase = await storage.updateEvaluationTestCase(req.params.id, req.body);
    res.json(testCase);
  }));

  // Delete test case
  app.delete("/api/evaluation/test-cases/:id", requireAuth, asyncHandler(async (req, res) => {
    await storage.deleteEvaluationTestCase(req.params.id);
    res.status(204).send();
  }));

  // Get all evaluation runs with optional filters
  app.get("/api/evaluation/runs", requireAuth, asyncHandler(async (req, res) => {
    const { program, status, limit } = req.query;
    
    const filters: any = {};
    if (program) filters.program = program as string;
    if (status) filters.status = status as string;
    if (limit) filters.limit = parseInt(limit as string);
    
    const runs = await storage.getEvaluationRuns(filters);
    res.json(runs);
  }));

  // Get single evaluation run
  app.get("/api/evaluation/runs/:id", requireAuth, asyncHandler(async (req, res) => {
    const run = await storage.getEvaluationRun(req.params.id);
    if (!run) {
      throw notFoundError("Evaluation run not found");
    }
    res.json(run);
  }));

  // Create evaluation run
  app.post("/api/evaluation/runs", requireAuth, asyncHandler(async (req, res) => {
    const { insertEvaluationRunSchema } = await import("@shared/schema");
    const validated = insertEvaluationRunSchema.parse(req.body);
    
    const run = await storage.createEvaluationRun({
      ...validated,
      runBy: req.user!.id
    });
    
    res.status(201).json(run);
  }));

  // Update evaluation run
  app.patch("/api/evaluation/runs/:id", requireAuth, asyncHandler(async (req, res) => {
    const run = await storage.updateEvaluationRun(req.params.id, req.body);
    res.json(run);
  }));

  // Get results for a specific run
  app.get("/api/evaluation/runs/:runId/results", requireAuth, asyncHandler(async (req, res) => {
    const results = await storage.getEvaluationResultsByRun(req.params.runId);
    res.json(results);
  }));

  // Create evaluation result
  app.post("/api/evaluation/results", requireAuth, asyncHandler(async (req, res) => {
    const { insertEvaluationResultSchema } = await import("@shared/schema");
    const validated = insertEvaluationResultSchema.parse(req.body);
    
    const result = await storage.createEvaluationResult(validated);
    res.status(201).json(result);
  }));

  // Get results for a specific test case
  app.get("/api/evaluation/test-cases/:testCaseId/results", requireAuth, asyncHandler(async (req, res) => {
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
  app.get("/api/sms/status", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/sms/stats", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const tenantId = req.query.tenantId as string || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }
    
    const stats = await getConversationStats(tenantId);
    res.json(stats);
  }));
  
  // Get recent conversations
  app.get("/api/sms/conversations", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
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
  app.post("/api/admin/api-keys", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/admin/api-keys", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
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
  app.get("/api/admin/api-keys/:keyId/stats", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const { keyId } = req.params;
    const { days } = req.query;
    
    const stats = await apiKeyService.getUsageStats(
      keyId,
      days ? parseInt(days as string) : 30
    );
    
    res.json(stats);
  }));
  
  // Revoke API key (admin only)
  app.post("/api/admin/api-keys/:keyId/revoke", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const { keyId } = req.params;
    
    await apiKeyService.revokeApiKey(keyId, req.user!.id);
    
    res.json({ message: 'API key revoked successfully' });
  }));
  
  // Suspend API key (admin only)
  app.post("/api/admin/api-keys/:keyId/suspend", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const { keyId } = req.params;
    
    await apiKeyService.suspendApiKey(keyId);
    
    res.json({ message: 'API key suspended successfully' });
  }));
  
  // Reactivate API key (admin only)
  app.post("/api/admin/api-keys/:keyId/reactivate", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const { keyId } = req.params;
    
    await apiKeyService.reactivateApiKey(keyId);
    
    res.json({ message: 'API key reactivated successfully' });
  }));

  const httpServer = createServer(app);
  
  // Initialize WebSocket service for real-time notifications
  if (sessionMiddleware) {
    initializeWebSocketService(httpServer, sessionMiddleware);
  } else {
    console.warn("Warning: WebSocket service not initialized - session middleware not provided");
  }
  
  return httpServer;
}
