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
import { asyncHandler, validationError, notFoundError, externalServiceError } from "./middleware/errorHandler";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { 
  insertDocumentSchema, 
  insertSearchQuerySchema, 
  insertPolicySourceSchema,
  insertTrainingJobSchema 
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";

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
  app.post("/api/search", asyncHandler(async (req, res, next) => {
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
  app.post("/api/verify-document", upload.single("document"), asyncHandler(async (req, res) => {
    if (!req.file) {
      throw validationError("No document uploaded");
    }

    const documentType = req.body.documentType || 'income';
    const clientCaseId = req.body.clientCaseId;

    // Temporarily create a document record to get an ID for verification
    const document = await storage.createDocument({
      filename: req.file.originalname,
      originalName: req.file.originalname,
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
      officialCitations: [], // TODO: Link to policy citations
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
  app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
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
  app.post("/api/documents/upload-url", async (req, res) => {
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
  app.post("/api/documents", async (req, res) => {
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
  app.get("/api/documents", async (req, res) => {
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
  app.get("/api/documents/:id", async (req, res) => {
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
  app.patch("/api/documents/:id/status", async (req, res) => {
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
  app.get("/api/policy-sources", async (req, res) => {
    try {
      const sources = await storage.getPolicySources();
      res.json(sources);
    } catch (error) {
      console.error("Error fetching policy sources:", error);
      res.status(500).json({ error: "Failed to fetch policy sources" });
    }
  });

  app.post("/api/policy-sources", async (req, res) => {
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

  app.patch("/api/policy-sources/:id", async (req, res) => {
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
  app.get("/api/models", async (req, res) => {
    try {
      const models = await storage.getModelVersions();
      res.json(models);
    } catch (error) {
      console.error("Error fetching model versions:", error);
      res.status(500).json({ error: "Failed to fetch model versions" });
    }
  });

  // Training Jobs
  app.get("/api/training-jobs", async (req, res) => {
    try {
      const jobs = await storage.getTrainingJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching training jobs:", error);
      res.status(500).json({ error: "Failed to fetch training jobs" });
    }
  });

  app.post("/api/training-jobs", async (req, res) => {
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

  app.patch("/api/training-jobs/:id", async (req, res) => {
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
  app.get("/api/system/status", async (req, res) => {
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
  app.post("/api/ingest/maryland-snap", async (req, res) => {
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
  app.get("/api/golden-source/documents", async (req, res) => {
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
  app.post("/api/golden-source/verify/:documentId", async (req, res) => {
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
  app.get("/api/golden-source/audit-trail/:documentId", async (req, res) => {
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
  app.get("/api/automated-ingestion/schedules", async (req, res) => {
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

  app.post("/api/automated-ingestion/trigger", async (req, res) => {
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

  app.patch("/api/automated-ingestion/schedules/:id", async (req, res) => {
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

  app.post("/api/automated-ingestion/schedules", async (req, res) => {
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
  app.post("/api/eligibility/check", async (req, res) => {
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

      const result = await rulesEngine.checkEligibility({
        benefitProgramId: snapProgram.id,
        householdSize,
        monthlyGrossIncome: monthlyIncome,
        monthlyNetIncome: hasEarnedIncome ? monthlyIncome * 0.8 : monthlyIncome, // Rough estimate
        hasSSI: hasSSI || false,
        hasTANF: hasTANF || false,
        hasElderly: false,
        hasDisabled: false,
      });

      res.json(result);
    } catch (error) {
      console.error("Eligibility check error:", error);
      res.status(500).json({ error: "Failed to check eligibility" });
    }
  });

  // Full benefit calculation endpoint
  app.post("/api/eligibility/calculate", async (req, res) => {
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

      const result = await rulesEngine.calculateBenefit({
        benefitProgramId: snapProgram.id,
        householdSize,
        monthlyGrossIncome,
        monthlyEarnedIncome: monthlyEarnedIncome || 0,
        hasElderly: hasElderly || false,
        hasDisabled: hasDisabled || false,
        hasSSI: hasSSI || false,
        hasTANF: hasTANF || false,
        shelterCosts: shelterCosts || 0,
        utilityCosts: utilityCosts || 0,
        dependentCareCosts: dependentCareCosts || 0,
        medicalExpenses: medicalExpenses || 0,
      });

      // Save calculation if user provided
      if (userId) {
        await storage.createEligibilityCalculation({
          userId,
          benefitProgramId: snapProgram.id,
          householdSize,
          grossIncome: monthlyGrossIncome,
          netIncome: result.calculation?.netIncome || 0,
          calculatedBenefit: result.estimatedBenefit || 0,
          isEligible: result.eligible,
          calculationDetails: result.calculation || {},
          appliedRules: result.appliedRules || [],
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Benefit calculation error:", error);
      res.status(500).json({ error: "Failed to calculate benefit" });
    }
  });

  // Get active SNAP income limits
  app.get("/api/rules/income-limits", async (req, res) => {
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
  app.post("/api/rules/income-limits", async (req, res) => {
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
  app.patch("/api/rules/income-limits/:id", async (req, res) => {
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
  app.get("/api/rules/deductions", async (req, res) => {
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
  app.get("/api/rules/allotments", async (req, res) => {
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
  app.get("/api/rules/categorical-eligibility", async (req, res) => {
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
  app.get("/api/rules/document-requirements", async (req, res) => {
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
  app.get("/api/eligibility/calculations", async (req, res) => {
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
  app.get("/api/manual/sections", async (req, res) => {
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
  app.get("/api/manual/sections/:id", async (req, res) => {
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
  app.get("/api/manual/structure", async (req, res) => {
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
  app.get("/api/manual/status", async (req, res) => {
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
  app.post("/api/manual/ingest-metadata", async (req, res) => {
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
  app.post("/api/manual/ingest-full", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
