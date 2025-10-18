import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import { ragService } from "./ragService";
import { ObjectStorageService } from "../objectStorage";

// Lazy Gemini initialization to prevent server crash at import-time
let gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!gemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    gemini = new GoogleGenAI({ apiKey });
  }
  return gemini;
}

export interface DocumentQualityAssessment {
  overall: "excellent" | "good" | "fair" | "poor";
  ocrAccuracy: number; // 0-1
  qualityScore: number; // 0-1
  issues: string[];
  recommendations: string[];
}

export interface ProcessingStatus {
  stage: "uploading" | "quality_check" | "ocr" | "classification" | "chunking" | "embedding" | "indexing" | "completed" | "failed";
  progress: number; // 0-1
  message: string;
  startTime: Date;
  completedSteps: string[];
  errors: string[];
}

class DocumentProcessor {
  private processingJobs = new Map<string, ProcessingStatus>();

  async processDocument(documentId: string): Promise<void> {
    const status: ProcessingStatus = {
      stage: "quality_check",
      progress: 0,
      message: "Starting document processing",
      startTime: new Date(),
      completedSteps: [],
      errors: [],
    };

    this.processingJobs.set(documentId, status);

    try {
      await this.updateProcessingStatus(documentId, {
        stage: "quality_check",
        progress: 0.1,
        message: "Assessing document quality",
      });

      // Step 1: Quality Assessment
      const qualityAssessment = await this.assessDocumentQuality(documentId);
      
      await this.updateProcessingStatus(documentId, {
        stage: "ocr",
        progress: 0.2,
        message: "Extracting text from document",
        completedSteps: ["quality_check"],
      });

      // Step 2: OCR Processing
      const extractedText = await this.performOCR(documentId);
      
      // Step 2.5: Detailed Quality Analysis (after OCR) - run in background
      const { DocumentQualityAnalyzerService } = await import("./documentQualityAnalyzerService");
      const qualityAnalyzer = new DocumentQualityAnalyzerService();
      
      // Don't await - let quality analysis run in background without blocking upload
      qualityAnalyzer.analyzeDocument(documentId).then(async (detailedQualityResult) => {
        // Store quality analysis results
        await storage.updateDocumentQuality(documentId, {
          qualityScore: detailedQualityResult.overallScore,
          qualityMetrics: detailedQualityResult.metrics,
          qualityFlags: detailedQualityResult.issues,
          qualitySuggestions: detailedQualityResult.suggestions,
          analyzedAt: new Date(),
        });
        
        await storage.createDocumentQualityEvent({
          documentId,
          qualityScore: detailedQualityResult.overallScore,
          metrics: detailedQualityResult.metrics,
          issues: detailedQualityResult.issues,
          analyzedAt: new Date(),
        });
        
        console.log(`[Quality Analyzer] Background analysis completed for document ${documentId}`);
      }).catch(err => {
        console.error('[Quality Analyzer] Background analysis failed:', err);
      });
      
      await this.updateProcessingStatus(documentId, {
        stage: "classification",
        progress: 0.4,
        message: "Classifying document type and program",
        completedSteps: ["quality_check", "ocr"],
      });

      // Step 3: Document Classification
      const classification = await this.classifyDocument(extractedText);
      
      await this.updateProcessingStatus(documentId, {
        stage: "chunking",
        progress: 0.6,
        message: "Splitting document into chunks",
        completedSteps: ["quality_check", "ocr", "classification"],
      });

      // Step 4: Text Chunking
      const chunks = await this.chunkDocument(extractedText, documentId);
      
      await this.updateProcessingStatus(documentId, {
        stage: "embedding",
        progress: 0.8,
        message: "Generating embeddings",
        completedSteps: ["quality_check", "ocr", "classification", "chunking"],
      });

      // Step 5: Add to RAG Index
      await ragService.addDocumentToIndex(documentId);
      
      await this.updateProcessingStatus(documentId, {
        stage: "completed",
        progress: 1.0,
        message: "Document processing completed successfully",
        completedSteps: ["quality_check", "ocr", "classification", "chunking", "embedding", "indexing"],
      });

      // Update document status
      await storage.updateDocument(documentId, {
        status: "processed",
        processingStatus: this.processingJobs.get(documentId),
        qualityScore: qualityAssessment.qualityScore,
        ocrAccuracy: qualityAssessment.ocrAccuracy,
        metadata: {
          classification,
          qualityAssessment,
          chunksCount: chunks.length,
        },
      });

      console.log(`Document ${documentId} processed successfully`);
      
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);
      
      await this.updateProcessingStatus(documentId, {
        stage: "failed",
        message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [...(this.processingJobs.get(documentId)?.errors || []), error instanceof Error ? error.message : 'Unknown error'],
      });

      await storage.updateDocument(documentId, {
        status: "failed",
        processingStatus: this.processingJobs.get(documentId),
      });
    }
  }

  private async updateProcessingStatus(documentId: string, updates: Partial<ProcessingStatus>) {
    const current = this.processingJobs.get(documentId);
    if (current) {
      const updated = { ...current, ...updates };
      this.processingJobs.set(documentId, updated);
      
      // Update database
      await storage.updateDocument(documentId, {
        processingStatus: updated,
      });
    }
  }

  async assessDocumentQuality(documentId: string): Promise<DocumentQualityAssessment> {
    try {
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      // For image files, use computer vision for quality assessment
      if (document.mimeType?.startsWith('image/')) {
        return await this.assessImageQuality(document.objectPath);
      }

      // For PDF/text files, basic assessment
      const assessment: DocumentQualityAssessment = {
        overall: "good",
        ocrAccuracy: 0.95,
        qualityScore: 0.9,
        issues: [],
        recommendations: [],
      };

      if (document.fileSize && document.fileSize < 1024 * 10) { // Less than 10KB
        assessment.issues.push("File size is very small");
        assessment.overall = "fair";
        assessment.qualityScore = 0.6;
      }

      return assessment;
    } catch (error) {
      console.error("Quality assessment error:", error);
      return {
        overall: "poor",
        ocrAccuracy: 0.5,
        qualityScore: 0.3,
        issues: ["Failed to assess document quality"],
        recommendations: ["Consider re-uploading with better quality"],
      };
    }
  }

  private async assessImageQuality(objectPath: string | null): Promise<DocumentQualityAssessment> {
    if (!objectPath) {
      throw new Error("No object path for image assessment");
    }

    try {
      // Get image from object storage
      const objectStorageService = new ObjectStorageService();
      
      // In a real implementation, this would:
      // 1. Download the image from object storage
      // 2. Use computer vision APIs (AWS Rekognition, Google Vision, etc.)
      // 3. Analyze blur, contrast, brightness, skew, etc.
      // 4. Detect text regions and quality
      
      // For now, simulate quality assessment
      const mockAssessment: DocumentQualityAssessment = {
        overall: "good",
        ocrAccuracy: Math.random() * 0.3 + 0.7, // 0.7-1.0
        qualityScore: Math.random() * 0.3 + 0.7,
        issues: [],
        recommendations: [],
      };

      // Simulate some quality issues
      if (Math.random() < 0.2) {
        mockAssessment.issues.push("Slight blur detected");
        mockAssessment.qualityScore *= 0.8;
      }
      
      if (Math.random() < 0.15) {
        mockAssessment.issues.push("Low contrast");
        mockAssessment.qualityScore *= 0.9;
      }

      if (mockAssessment.qualityScore < 0.5) {
        mockAssessment.overall = "poor";
        mockAssessment.recommendations.push("Consider retaking photo with better lighting");
      } else if (mockAssessment.qualityScore < 0.7) {
        mockAssessment.overall = "fair";
      }

      return mockAssessment;
    } catch (error) {
      console.error("Image quality assessment error:", error);
      return {
        overall: "poor",
        ocrAccuracy: 0.3,
        qualityScore: 0.3,
        issues: ["Failed to assess image quality"],
        recommendations: ["Please retake photo"],
      };
    }
  }

  private async performOCR(documentId: string): Promise<string> {
    try {
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      // In a real implementation, this would:
      // 1. Download file from object storage
      // 2. Use OCR services (Tesseract, AWS Textract, Google Document AI)
      // 3. Handle different file formats (PDF, images)
      // 4. Apply post-processing and error correction

      // For now, return mock extracted text
      const mockText = `
        SNAP Income Eligibility Standards
        
        Effective October 1, 2025
        
        For households applying for SNAP benefits, the following gross monthly income limits apply:
        
        Household Size | Gross Monthly Income
        1 person      | $1,580
        2 persons     | $2,137
        3 persons     | $2,694
        4 persons     | $3,250
        
        Additional deductions may apply for:
        - Elderly household members (age 60+)
        - Disabled household members
        - Dependent care expenses
        - Medical expenses exceeding $35/month
        
        Net income limits are typically 100% of the Federal Poverty Level.
        
        Asset limits:
        - $2,750 for most households
        - $4,250 for households with elderly or disabled members
        
        For more information, contact your local SNAP office or visit www.fns.usda.gov/snap
      `;

      return mockText;
    } catch (error) {
      console.error("OCR processing error:", error);
      throw new Error("Failed to extract text from document");
    }
  }

  private async classifyDocument(text: string) {
    try {
      const prompt = `You are a document classification expert for government benefit programs. 
      Analyze the provided text and classify it according to:
      
      1. Document Type: POLICY_MANUAL, GUIDANCE, REGULATION, NOTICE, FORM, COURT_DECISION, etc.
      2. Benefit Program: SNAP, MEDICAID, HOUSING, TANF, WIC, SSI, UNEMPLOYMENT, etc.
      3. Topic Categories: ELIGIBILITY, APPLICATION, REQUIREMENTS, APPEALS, RENEWALS, etc.
      4. Jurisdiction Level: FEDERAL, STATE, LOCAL
      5. Confidence Score: 0-1
      
      Respond with JSON in this format:
      {
        "documentType": "string",
        "benefitProgram": "string",
        "topics": ["topic1", "topic2"],
        "jurisdictionLevel": "string",
        "confidence": number,
        "keyEntities": ["entity1", "entity2"],
        "summary": "brief summary"
      }
      
      Document text: ${text}`;
      
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Document classification error:", error);
      return {
        documentType: "UNKNOWN",
        benefitProgram: "UNKNOWN",
        topics: [],
        jurisdictionLevel: "UNKNOWN",
        confidence: 0.5,
        keyEntities: [],
        summary: "Classification failed",
      };
    }
  }

  private async chunkDocument(text: string, documentId: string): Promise<any[]> {
    try {
      // Implement semantic chunking strategy
      const chunks = this.performSemanticChunking(text);
      
      // Store chunks in database
      const savedChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = await storage.createDocumentChunk({
          documentId,
          chunkIndex: i,
          content: chunks[i].content,
          metadata: chunks[i].metadata,
          pageNumber: chunks[i].pageNumber,
          startOffset: chunks[i].startOffset,
          endOffset: chunks[i].endOffset,
        });
        savedChunks.push(chunk);
      }
      
      return savedChunks;
    } catch (error) {
      console.error("Document chunking error:", error);
      throw new Error("Failed to chunk document");
    }
  }

  private performSemanticChunking(text: string) {
    // Implement advanced chunking strategy
    // 1. Preserve document structure (headings, sections)
    // 2. Maintain semantic coherence
    // 3. Optimal chunk size (500-1000 tokens)
    // 4. Overlapping chunks for context continuity

    const lines = text.split('\n').filter(line => line.trim());
    const chunks = [];
    let currentChunk = '';
    let chunkIndex = 0;
    let startOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if adding this line would make chunk too large
      if (currentChunk.length + line.length > 800 && currentChunk.length > 200) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            hasHeading: /^[A-Z\s]+$/.test(currentChunk.split('\n')[0] || ''),
            lineCount: currentChunk.split('\n').length,
          },
          pageNumber: Math.floor(chunkIndex / 3) + 1, // Estimate page number
          startOffset,
          endOffset: startOffset + currentChunk.length,
        });
        
        // Start new chunk with some overlap
        const overlap = currentChunk.split('\n').slice(-2).join('\n');
        startOffset += currentChunk.length - overlap.length;
        currentChunk = overlap + '\n' + line;
        chunkIndex++;
      } else {
        currentChunk += '\n' + line;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          hasHeading: /^[A-Z\s]+$/.test(currentChunk.split('\n')[0] || ''),
          lineCount: currentChunk.split('\n').length,
        },
        pageNumber: Math.floor(chunkIndex / 3) + 1,
        startOffset,
        endOffset: startOffset + currentChunk.length,
      });
    }

    return chunks;
  }

  getProcessingStatus(documentId: string): ProcessingStatus | undefined {
    return this.processingJobs.get(documentId);
  }

  async reprocessDocument(documentId: string): Promise<void> {
    // Remove from index first
    await ragService.removeDocumentFromIndex(documentId);
    
    // Reset document status
    await storage.updateDocument(documentId, {
      status: "uploaded",
      processingStatus: null,
      qualityScore: null,
      ocrAccuracy: null,
    });

    // Clear processing job
    this.processingJobs.delete(documentId);
    
    // Start processing again
    await this.processDocument(documentId);
  }
}

export const documentProcessor = new DocumentProcessor();
