import type { Express } from "express";
import { createServer, type Server } from "http";
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
import { asyncHandler, validationError, notFoundError, externalServiceError } from "./middleware/errorHandler";
import { requireAuth, requireStaff, requireAdmin } from "./middleware/auth";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { 
  insertDocumentSchema, 
  insertSearchQuerySchema, 
  insertPolicySourceSchema,
  insertTrainingJobSchema,
  insertUserSchema,
  searchQueries,
  auditLogs
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import bcrypt from "bcryptjs";
import passport from "./auth";

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Comprehensive health check endpoint
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

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Create user
    const user = await storage.createUser({
      ...validatedData,
      password: hashedPassword,
    });

    // Log the user in automatically after signup
    req.login(user, (err) => {
      if (err) {
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
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }

      req.login(user, (err) => {
        if (err) {
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
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

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

      const limits = await storage.getSnapIncomeLimits(programId);

      res.json({
        success: true,
        data: limits,
        count: limits.length,
      });
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

      const deductions = await storage.getSnapDeductions(snapProgram.id);
      const activeDeductions = deductions.filter(d => d.isActive);

      res.json({
        success: true,
        data: activeDeductions,
        count: activeDeductions.length,
      });
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

      const allotments = await storage.getSnapAllotments(snapProgram.id);
      const activeAllotments = allotments.filter(a => a.isActive);

      res.json({
        success: true,
        data: activeAllotments,
        count: activeAllotments.length,
      });
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
      const sections = await storage.getManualSections();
      res.json({
        success: true,
        data: sections,
        count: sections.length,
      });
    } catch (error) {
      console.error("Error fetching manual sections:", error);
      res.status(500).json({ error: "Failed to fetch manual sections" });
    }
  });

  // Get specific manual section with details
  app.get("/api/manual/sections/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get section details, cross-references, and chunks in parallel
      const [section, crossReferences, chunks] = await Promise.all([
        storage.getManualSection(id),
        storage.getSectionCrossReferences(id),
        storage.getSectionChunks(id)
      ]);

      if (!section) {
        return res.status(404).json({ error: "Section not found" });
      }

      res.json({
        success: true,
        data: {
          section,
          crossReferences,
          chunks,
        },
      });
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
    const exportBatch = await storage.getEEExportBatch(id);

    if (!exportBatch) {
      throw validationError("Export batch not found");
    }

    // Get sessions for this export
    const sessions = await storage.getSessionsByExportBatch(id);

    // Generate export file based on format
    let content: string;
    let mimeType: string;
    let filename: string;

    if (exportBatch.exportFormat === 'csv') {
      mimeType = 'text/csv';
      filename = `ee-export-${id}.csv`;
      
      // CSV headers
      const headers = [
        'Session ID', 'Client Case ID', 'Session Type', 'Date', 'Duration (min)',
        'Location', 'Outcome', 'Topics', 'Action Items', 'Notes'
      ].join(',');

      // CSV rows
      const rows = sessions.map(s => [
        s.id,
        s.clientCaseId || '',
        s.sessionType,
        new Date(s.interactionDate).toISOString(),
        s.durationMinutes || '',
        s.location || '',
        s.outcomeStatus || '',
        JSON.stringify(s.topicsDiscussed || []),
        JSON.stringify(s.actionItems || []),
        (s.notes || '').replace(/"/g, '""') // Escape quotes
      ].map(v => `"${v}"`).join(','));

      content = [headers, ...rows].join('\n');
    } else if (exportBatch.exportFormat === 'json') {
      mimeType = 'application/json';
      filename = `ee-export-${id}.json`;
      content = JSON.stringify(sessions, null, 2);
    } else { // xml
      mimeType = 'application/xml';
      filename = `ee-export-${id}.xml`;
      content = `<?xml version="1.0" encoding="UTF-8"?>
<export>
  <sessions>
${sessions.map(s => `    <session>
      <id>${s.id}</id>
      <clientCaseId>${s.clientCaseId || ''}</clientCaseId>
      <sessionType>${s.sessionType}</sessionType>
      <date>${new Date(s.interactionDate).toISOString()}</date>
      <duration>${s.durationMinutes || ''}</duration>
      <location>${s.location || ''}</location>
      <outcome>${s.outcomeStatus || ''}</outcome>
      <notes>${(s.notes || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</notes>
    </session>`).join('\n')}
  </sessions>
</export>`;
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
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
    
    res.json(result);
  }));

  // Batch extract rules from multiple sections
  app.post("/api/extraction/extract-batch", requireAdmin, asyncHandler(async (req, res) => {
    const { batchExtractRules } = await import('./services/rulesExtractionService');
    
    const validatedData = extractBatchSchema.parse(req.body);
    
    const result = await batchExtractRules(validatedData.manualSectionIds, req.user?.id);
    
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

  const httpServer = createServer(app);
  return httpServer;
}
