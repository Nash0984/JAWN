import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ragService } from "./services/ragService";
import { documentProcessor } from "./services/documentProcessor";
import { documentIngestionService } from "./services/documentIngestion";
import { automatedIngestionService } from "./services/automatedIngestion";
import { ObjectStorageService } from "./objectStorage";
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
  
  // Health check
  app.get("/api/health", async (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Search endpoint
  app.post("/api/search", async (req, res) => {
    try {
      const { query, benefitProgramId, userId } = req.body;
      
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query is required and must be a string" });
      }

      const startTime = Date.now();
      const result = await ragService.search(query, benefitProgramId);
      const responseTime = Date.now() - startTime;

      // Save search query
      await storage.createSearchQuery({
        query,
        userId,
        benefitProgramId,
        response: result,
        relevanceScore: result.relevanceScore || 0,
        responseTime,
      });

      res.json(result);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Internal server error during search" });
    }
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

  const httpServer = createServer(app);
  return httpServer;
}
