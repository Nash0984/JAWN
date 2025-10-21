/**
 * Unified Document Service
 * 
 * Consolidates all document-related functionality into a single, cohesive service
 * using composition and strategy patterns to maintain all existing features while
 * eliminating code duplication.
 * 
 * Combines functionality from:
 * - documentVerificationService.ts
 * - documentVerification.service.ts
 * - documentProcessor.ts
 * - documentExtraction.ts
 * - documentQualityValidator.ts
 * - documentAuditService.ts
 * - documentAnalysisCache.ts
 * - taxDocumentExtraction.ts
 */

import { GoogleGenAI } from '@google/genai';
import { Storage } from '@google-cloud/storage';
import NodeCache from 'node-cache';
import { createHash } from 'crypto';
import sharp from 'sharp';
import * as pdf from 'pdf-parse';
import { db } from '../../db';
import { storage } from '../../storage';
import { ObjectStorageService } from '../../objectStorage';
import { ragService } from '../ragService';
import { logger } from '../logger.service';
import { 
  documents,
  documentChunks,
  vitaDocumentAudit,
  type Document,
  type DocumentRequirementRule,
  type InsertVitaDocumentAudit,
  type InsertTaxDocument
} from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

// ============================================================================
// CONFIGURATION & INITIALIZATION
// ============================================================================

// Lazy Gemini initialization to prevent server crash at import-time
let gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!gemini) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('Google API key not found - document analysis will be limited', {
        context: 'UnifiedDocumentService.getGemini'
      });
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required');
    }
    gemini = new GoogleGenAI({ apiKey });
  }
  return gemini;
}

const gcs = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || "";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DocumentAnalysis {
  documentType: string;
  confidence: number;
  extractedData: {
    dates?: string[];
    amounts?: string[];
    names?: string[];
    addresses?: string[];
    identifiers?: string[];
    issuer?: string;
    recipientName?: string;
    documentDate?: string;
    expirationDate?: string;
    [key: string]: any;
  };
  quality: {
    readability: 'high' | 'medium' | 'low';
    completeness: 'complete' | 'partial' | 'incomplete';
    authenticity: 'likely_authentic' | 'uncertain' | 'concerns';
    issues: string[];
  };
  rawText?: string;
}

export interface VerificationResult {
  isValid: boolean;
  satisfiesRequirements: string[];
  rejectionReasons: string[];
  warnings: string[];
  validUntil?: Date;
  extractedInfo: Record<string, any>;
  confidenceScore: number;
  analysis: DocumentAnalysis;
  policyCitations: Array<{
    section: string;
    regulation: string;
    text: string;
    sourceUrl?: string;
  }>;
}

export interface QualityValidationResult {
  isAcceptable: boolean;
  qualityScore: number;
  issues: QualityIssue[];
  validation: {
    imageResolution?: { width: number; height: number; dpi?: number };
    fileSize: number;
    pageCount?: number;
    orientation?: 'portrait' | 'landscape' | 'unknown';
    readability?: 'excellent' | 'good' | 'fair' | 'poor';
  };
}

export interface QualityIssue {
  type: 'resolution' | 'fileSize' | 'orientation' | 'readability' | 'pageCount' | 'format';
  severity: 'error' | 'warning' | 'info';
  description: string;
  recommendation?: string;
}

export interface ProcessingStatus {
  stage: "uploading" | "quality_check" | "ocr" | "classification" | "chunking" | "embedding" | "indexing" | "completed" | "failed";
  progress: number;
  message: string;
  startTime: Date;
  completedSteps: string[];
  errors: string[];
}

export interface AuditLogParams {
  documentRequestId: string;
  vitaSessionId: string;
  action: 'uploaded' | 'downloaded' | 'viewed' | 'replaced' | 'approved' | 'rejected' | 'deleted' | 'modified';
  userId: string;
  userRole: string;
  userName: string;
  actionDetails?: any;
  ipAddress?: string;
  userAgent?: string;
  objectPath?: string;
  signedUrlGenerated?: boolean;
  signedUrlExpiry?: Date;
  previousStatus?: string;
  newStatus?: string;
  changeReason?: string;
}

// Tax document specific types
export interface W2Data {
  taxYear: number;
  employerName: string;
  employerEIN: string;
  employerAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  employeeName: string;
  employeeSSN: string;
  employeeAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  box1_wages: number;
  box2_federalTaxWithheld: number;
  box3_socialSecurityWages: number;
  box4_socialSecurityTaxWithheld: number;
  box5_medicareWages: number;
  box6_medicareTaxWithheld: number;
  box7_socialSecurityTips: number;
  box8_allocatedTips: number;
  box10_dependentCareBenefits: number;
  box11_nonqualifiedPlans: number;
  box12_codes: Array<{ code: string; amount: number }>;
  box13_statutoryEmployee: boolean;
  box13_retirementPlan: boolean;
  box13_thirdPartySickPay: boolean;
  box14_other: Array<{ description: string; amount: number }>;
  box15_stateEmployerNumber: string;
  box16_stateWages: number;
  box17_stateIncomeTax: number;
  box18_localWages: number;
  box19_localIncomeTax: number;
  box20_localityName: string;
}

// ============================================================================
// DOCUMENT EXTRACTION STRATEGIES
// ============================================================================

interface ExtractionStrategy<T = any> {
  extract(base64Image: string, mimeType?: string): Promise<{ data: T; confidence: number }>;
  validate(data: T): { warnings: string[]; errors: string[]; confidence: number };
}

class W2ExtractionStrategy implements ExtractionStrategy<W2Data> {
  async extract(base64Image: string, mimeType: string = 'image/jpeg'): Promise<{ data: W2Data; confidence: number }> {
    const prompt = `You are a tax document extraction expert. Extract all data from this IRS Form W-2.
Return a JSON object with all W-2 fields including employer info, employee info, and all numbered boxes.
Extract all fields precisely as they appear. For empty boxes, use 0 for numbers, empty string for text, false for booleans.
Include a "confidence" field (0-1) for extraction accuracy.`;

    const ai = getGemini();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }]
    });

    const responseText = result.text || "";
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    }

    const extracted = JSON.parse(jsonText);
    const confidence = extracted.confidence || 0.8;
    delete extracted.confidence;

    return { data: extracted as W2Data, confidence };
  }

  validate(data: W2Data): { warnings: string[]; errors: string[]; confidence: number } {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!data.employerName || !data.employerEIN) {
      errors.push('Missing employer information');
    }
    if (!data.employeeName || !data.employeeSSN) {
      errors.push('Missing employee information');
    }
    if (!data.box1_wages || data.box1_wages <= 0) {
      warnings.push('No wages reported in Box 1');
    }

    const confidence = errors.length === 0 ? (warnings.length === 0 ? 1.0 : 0.8) : 0.5;
    return { warnings, errors, confidence };
  }
}

class PayStubExtractionStrategy implements ExtractionStrategy {
  async extract(base64Image: string, mimeType: string = 'image/jpeg'): Promise<{ data: any; confidence: number }> {
    const prompt = `Extract pay stub information including:
- Employer name and address
- Employee name and ID
- Pay period dates and pay date
- Gross pay, net pay, YTD amounts
- All deductions and withholdings
Return as JSON with a confidence score.`;

    const ai = getGemini();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }]
    });

    const responseText = result.text || "";
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    }

    const extracted = JSON.parse(jsonText);
    const confidence = extracted.confidence || 0.8;
    delete extracted.confidence;

    return { data: extracted, confidence };
  }

  validate(data: any): { warnings: string[]; errors: string[]; confidence: number } {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!data.employerName) errors.push('Missing employer name');
    if (!data.grossPay || data.grossPay <= 0) errors.push('Invalid gross pay amount');
    if (!data.netPay || data.netPay <= 0) errors.push('Invalid net pay amount');
    if (data.netPay > data.grossPay) errors.push('Net pay cannot exceed gross pay');

    const confidence = errors.length === 0 ? (warnings.length === 0 ? 1.0 : 0.8) : 0.5;
    return { warnings, errors, confidence };
  }
}

// ============================================================================
// CACHE SERVICE
// ============================================================================

class DocumentAnalysisCacheService {
  private cache: NodeCache;
  private metrics = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    estimatedCostSavings: 0
  };
  
  private readonly COST_PER_ANALYSIS = 0.0001;
  
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 60 * 60, // 1 hour
      checkperiod: 5 * 60,
      useClones: false,
      maxKeys: 1000
    });
  }
  
  private generateKey(imageData: string): string {
    const sample = imageData.substring(0, 10000);
    return createHash('sha256').update(sample).digest('hex');
  }
  
  get(imageData: string, minConfidence: number = 0.7): DocumentAnalysis | null {
    this.metrics.totalRequests++;
    const key = this.generateKey(imageData);
    const cached = this.cache.get<DocumentAnalysis>(key);
    
    if (cached && cached.confidence >= minConfidence) {
      this.metrics.hits++;
      this.metrics.estimatedCostSavings += this.COST_PER_ANALYSIS;
      return cached;
    }
    
    this.metrics.misses++;
    return null;
  }
  
  set(imageData: string, result: DocumentAnalysis): void {
    const key = this.generateKey(imageData);
    this.cache.set(key, result);
  }
  
  getStats() {
    const hitRate = this.metrics.totalRequests > 0 
      ? (this.metrics.hits / this.metrics.totalRequests) * 100 
      : 0;
    
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      totalRequests: this.metrics.totalRequests,
      hitRate: hitRate.toFixed(2) + '%',
      estimatedCostSavings: `$${this.metrics.estimatedCostSavings.toFixed(4)}`,
      cacheSize: this.cache.keys().length,
      maxKeys: 1000,
      ttl: '1 hour'
    };
  }
  
  clear(): void {
    this.cache.flushAll();
    logger.info('Document analysis cache cleared', {
      service: 'UnifiedDocumentService',
      cache: 'DocumentAnalysisCache'
    });
  }
}

// ============================================================================
// UNIFIED DOCUMENT SERVICE
// ============================================================================

export class UnifiedDocumentService {
  private objectStorageService: ObjectStorageService;
  private analysisCache: DocumentAnalysisCacheService;
  private processingJobs = new Map<string, ProcessingStatus>();
  private extractionStrategies = new Map<string, ExtractionStrategy>();
  
  // Quality validation constants
  private readonly MIN_IMAGE_WIDTH = 1200;
  private readonly MIN_IMAGE_HEIGHT = 1500;
  private readonly MIN_FILE_SIZE = 50 * 1024;
  private readonly MAX_FILE_SIZE = 20 * 1024 * 1024;
  private readonly MAX_PDF_PAGES = 50;
  private readonly MIN_QUALITY_SCORE = 0.6;

  constructor() {
    this.objectStorageService = new ObjectStorageService();
    this.analysisCache = new DocumentAnalysisCacheService();
    
    // Register extraction strategies
    this.extractionStrategies.set('W2', new W2ExtractionStrategy());
    this.extractionStrategies.set('PayStub', new PayStubExtractionStrategy());
    // Add more strategies as needed
  }

  // ============================================================================
  // DOCUMENT ANALYSIS & VERIFICATION
  // ============================================================================

  /**
   * Analyze a document using Gemini Vision API with caching
   */
  async analyzeDocument(
    imageData: Buffer | string,
    mimeType: string,
    analysisPrompt?: string
  ): Promise<DocumentAnalysis> {
    let base64Image: string;
    if (Buffer.isBuffer(imageData)) {
      base64Image = imageData.toString('base64');
    } else {
      base64Image = imageData;
    }

    // Check cache first
    const cached = this.analysisCache.get(base64Image);
    if (cached) {
      logger.debug('Using cached document analysis', {
        service: 'UnifiedDocumentService',
        method: 'analyzeDocument'
      });
      return cached;
    }

    const prompt = analysisPrompt || `Analyze this document and extract:
1. Document type (e.g., W-2, pay stub, utility bill, bank statement)
2. Key information (dates, amounts, names, addresses)
3. Quality assessment (readability, completeness, authenticity)
4. Any potential issues or concerns

Return as JSON with documentType, extractedData, quality, and confidence fields.`;

    try {
      const ai = getGemini();
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Image } }
          ]
        }]
      });

      const responseText = result.text || "";
      let jsonText = responseText;
      if (responseText.includes('```json')) {
        jsonText = responseText.split('```json')[1].split('```')[0].trim();
      }

      const analysis = JSON.parse(jsonText) as DocumentAnalysis;
      
      // Cache the result
      this.analysisCache.set(base64Image, analysis);
      
      return analysis;
    } catch (error) {
      logger.error('Document analysis failed', {
        service: 'UnifiedDocumentService',
        method: 'analyzeDocument',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to analyze document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify a document against requirements
   */
  async verifyDocument(
    documentId: string,
    requirementType: string,
    contextInfo?: Record<string, any>
  ): Promise<VerificationResult> {
    const document = await storage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Download from storage
    const file = gcs.bucket(bucketName).file(document.objectPath!);
    const [buffer] = await file.download();
    const base64Image = buffer.toString('base64');
    const mimeType = document.mimeType || 'image/jpeg';

    // Analyze the document
    const analysis = await this.analyzeDocument(base64Image, mimeType);

    // Get applicable rules from RAG
    const policyCitations = await ragService.searchPolicyRules(
      `Document verification requirements for ${requirementType}`,
      5
    );

    // Apply verification logic based on requirement type
    const verificationResult = await this.applyVerificationRules(
      analysis,
      requirementType,
      policyCitations,
      contextInfo
    );

    return verificationResult;
  }

  private async applyVerificationRules(
    analysis: DocumentAnalysis,
    requirementType: string,
    policyCitations: any[],
    contextInfo?: Record<string, any>
  ): Promise<VerificationResult> {
    const warnings: string[] = [];
    const rejectionReasons: string[] = [];
    const satisfiesRequirements: string[] = [];

    // Basic quality checks
    if (analysis.quality.readability === 'low') {
      rejectionReasons.push('Document is not clearly readable');
    }
    if (analysis.quality.completeness === 'incomplete') {
      warnings.push('Document appears to be incomplete');
    }
    if (analysis.quality.authenticity === 'concerns') {
      warnings.push('Document authenticity could not be verified');
    }

    // Type-specific verification
    switch (requirementType) {
      case 'income':
        if (analysis.documentType === 'pay_stub' || analysis.documentType === 'W2') {
          satisfiesRequirements.push('income_verification');
          if (!analysis.extractedData.amounts?.length) {
            warnings.push('No income amounts found');
          }
        } else {
          rejectionReasons.push('Document does not appear to be valid income verification');
        }
        break;

      case 'identity':
        if (analysis.extractedData.names?.length && analysis.extractedData.identifiers?.length) {
          satisfiesRequirements.push('identity_verification');
        } else {
          rejectionReasons.push('Document does not contain sufficient identity information');
        }
        break;

      case 'residency':
        if (analysis.extractedData.addresses?.length && analysis.extractedData.dates?.length) {
          satisfiesRequirements.push('residency_verification');
        } else {
          rejectionReasons.push('Document does not verify current residency');
        }
        break;
    }

    return {
      isValid: rejectionReasons.length === 0,
      satisfiesRequirements,
      rejectionReasons,
      warnings,
      extractedInfo: analysis.extractedData,
      confidenceScore: analysis.confidence,
      analysis,
      policyCitations: policyCitations.map(p => ({
        section: p.section || '',
        regulation: p.regulation || '',
        text: p.text || '',
        sourceUrl: p.sourceUrl
      }))
    };
  }

  // ============================================================================
  // DOCUMENT QUALITY VALIDATION
  // ============================================================================

  async validateDocumentQuality(
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<QualityValidationResult> {
    const issues: QualityIssue[] = [];
    const validation: QualityValidationResult['validation'] = {
      fileSize: buffer.length,
    };

    // Check file size
    if (buffer.length < this.MIN_FILE_SIZE) {
      issues.push({
        type: 'fileSize',
        severity: 'error',
        description: `File is too small (${Math.round(buffer.length / 1024)}KB)`,
        recommendation: 'Ensure document is properly scanned at adequate quality.',
      });
    } else if (buffer.length > this.MAX_FILE_SIZE) {
      issues.push({
        type: 'fileSize',
        severity: 'error',
        description: `File is too large (${Math.round(buffer.length / 1024 / 1024)}MB)`,
        recommendation: 'Compress the file or reduce scan quality slightly.',
      });
    }

    // Validate based on file type
    if (mimeType.startsWith('image/')) {
      await this.validateImage(buffer, mimeType, issues, validation);
    } else if (mimeType === 'application/pdf') {
      await this.validatePDF(buffer, issues, validation);
    } else {
      issues.push({
        type: 'format',
        severity: 'error',
        description: `Unsupported file type: ${mimeType}`,
        recommendation: 'Please upload a PDF or image file (JPG, PNG).',
      });
    }

    const qualityScore = this.calculateQualityScore(issues);
    const isAcceptable = qualityScore >= this.MIN_QUALITY_SCORE;

    return { isAcceptable, qualityScore, issues, validation };
  }

  private async validateImage(
    buffer: Buffer,
    mimeType: string,
    issues: QualityIssue[],
    validation: QualityValidationResult['validation']
  ): Promise<void> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      validation.imageResolution = {
        width: metadata.width || 0,
        height: metadata.height || 0,
        dpi: metadata.density,
      };

      if (metadata.width! < this.MIN_IMAGE_WIDTH || metadata.height! < this.MIN_IMAGE_HEIGHT) {
        issues.push({
          type: 'resolution',
          severity: 'error',
          description: `Image resolution too low: ${metadata.width}x${metadata.height}`,
          recommendation: `Scan at minimum ${this.MIN_IMAGE_WIDTH}x${this.MIN_IMAGE_HEIGHT} pixels.`,
        });
      }

      // Determine orientation
      if (metadata.width! > metadata.height!) {
        validation.orientation = 'landscape';
      } else {
        validation.orientation = 'portrait';
      }

      validation.readability = this.assessImageReadability(metadata);
    } catch (error) {
      issues.push({
        type: 'format',
        severity: 'error',
        description: 'Failed to process image',
        recommendation: 'Ensure the image file is not corrupted.',
      });
    }
  }

  private async validatePDF(
    buffer: Buffer,
    issues: QualityIssue[],
    validation: QualityValidationResult['validation']
  ): Promise<void> {
    try {
      const data = await pdf(buffer);
      validation.pageCount = data.numpages;

      if (data.numpages > this.MAX_PDF_PAGES) {
        issues.push({
          type: 'pageCount',
          severity: 'error',
          description: `Too many pages: ${data.numpages}`,
          recommendation: `Submit documents with ${this.MAX_PDF_PAGES} pages or fewer.`,
        });
      }

      if (!data.text || data.text.trim().length < 100) {
        issues.push({
          type: 'readability',
          severity: 'error',
          description: 'PDF contains little or no extractable text',
          recommendation: 'Ensure PDF is not image-only. Use OCR if needed.',
        });
        validation.readability = 'poor';
      } else {
        validation.readability = 'good';
      }
    } catch (error) {
      issues.push({
        type: 'format',
        severity: 'error',
        description: 'Failed to process PDF',
        recommendation: 'Ensure the PDF file is not corrupted or password-protected.',
      });
    }
  }

  private assessImageReadability(metadata: any): 'excellent' | 'good' | 'fair' | 'poor' {
    if (!metadata.width || !metadata.height) return 'poor';
    if (metadata.width >= 2400 && metadata.height >= 3000) return 'excellent';
    if (metadata.width >= 1800 && metadata.height >= 2200) return 'good';
    if (metadata.width >= this.MIN_IMAGE_WIDTH && metadata.height >= this.MIN_IMAGE_HEIGHT) return 'fair';
    return 'poor';
  }

  private calculateQualityScore(issues: QualityIssue[]): number {
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    let score = 1.0;
    score -= errorCount * 0.3;
    score -= warningCount * 0.1;

    return Math.max(0, Math.min(1, score));
  }

  // ============================================================================
  // DOCUMENT PROCESSING
  // ============================================================================

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
      // Quality Assessment
      await this.updateProcessingStatus(documentId, {
        stage: "quality_check",
        progress: 0.1,
        message: "Assessing document quality",
      });

      const document = await storage.getDocument(documentId);
      if (!document || !document.objectPath) {
        throw new Error('Document not found or missing file path');
      }

      const file = gcs.bucket(bucketName).file(document.objectPath);
      const [buffer] = await file.download();
      
      const qualityResult = await this.validateDocumentQuality(
        buffer,
        document.mimeType || 'application/octet-stream',
        document.filename
      );

      if (!qualityResult.isAcceptable) {
        throw new Error(`Document quality insufficient: ${qualityResult.issues.map(i => i.description).join('; ')}`);
      }

      // OCR Processing
      await this.updateProcessingStatus(documentId, {
        stage: "ocr",
        progress: 0.3,
        message: "Extracting text from document",
        completedSteps: ["quality_check"],
      });

      const analysis = await this.analyzeDocument(
        buffer,
        document.mimeType || 'image/jpeg'
      );

      // Classification
      await this.updateProcessingStatus(documentId, {
        stage: "classification",
        progress: 0.5,
        message: "Classifying document type",
        completedSteps: ["quality_check", "ocr"],
      });

      // Update document with analysis results
      await storage.updateDocument(documentId, {
        status: 'processed',
        metadata: {
          ...document.metadata,
          analysis: analysis,
          qualityScore: qualityResult.qualityScore,
          processedAt: new Date().toISOString()
        }
      });

      await this.updateProcessingStatus(documentId, {
        stage: "completed",
        progress: 1.0,
        message: "Document processing complete",
        completedSteps: ["quality_check", "ocr", "classification"],
      });

    } catch (error) {
      await this.updateProcessingStatus(documentId, {
        stage: "failed",
        progress: 0,
        message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
      throw error;
    }
  }

  private async updateProcessingStatus(
    documentId: string,
    updates: Partial<ProcessingStatus>
  ): Promise<void> {
    const current = this.processingJobs.get(documentId);
    if (current) {
      this.processingJobs.set(documentId, { ...current, ...updates });
    }
  }

  getProcessingStatus(documentId: string): ProcessingStatus | null {
    return this.processingJobs.get(documentId) || null;
  }

  // ============================================================================
  // DOCUMENT EXTRACTION
  // ============================================================================

  async extractDocument(
    documentId: string,
    documentType: string
  ): Promise<{ data: any; confidence: number }> {
    const strategy = this.extractionStrategies.get(documentType);
    if (!strategy) {
      throw new Error(`No extraction strategy for document type: ${documentType}`);
    }

    const document = await storage.getDocument(documentId);
    if (!document || !document.objectPath) {
      throw new Error('Document not found');
    }

    const file = gcs.bucket(bucketName).file(document.objectPath);
    const [buffer] = await file.download();
    const base64Image = buffer.toString('base64');
    const mimeType = document.mimeType || 'image/jpeg';

    const result = await strategy.extract(base64Image, mimeType);
    const validation = strategy.validate(result.data);

    return {
      data: result.data,
      confidence: Math.min(result.confidence, validation.confidence)
    };
  }

  // ============================================================================
  // AUDIT LOGGING
  // ============================================================================

  async logDocumentAction(params: AuditLogParams): Promise<void> {
    try {
      await db.insert(vitaDocumentAudit).values({
        documentRequestId: params.documentRequestId,
        vitaSessionId: params.vitaSessionId,
        action: params.action,
        actionDetails: params.actionDetails || null,
        userId: params.userId,
        userRole: params.userRole,
        userName: params.userName,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        objectPath: params.objectPath || null,
        signedUrlGenerated: params.signedUrlGenerated || false,
        signedUrlExpiry: params.signedUrlExpiry || null,
        previousStatus: params.previousStatus || null,
        newStatus: params.newStatus || null,
        changeReason: params.changeReason || null,
      });
    } catch (error) {
      console.error('Failed to log document audit action:', error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  async getDocumentAuditTrail(documentRequestId: string) {
    try {
      return await db
        .select()
        .from(vitaDocumentAudit)
        .where(eq(vitaDocumentAudit.documentRequestId, documentRequestId))
        .orderBy(desc(vitaDocumentAudit.createdAt));
    } catch (error) {
      console.error('Failed to retrieve document audit trail:', error);
      return [];
    }
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  getCacheStats() {
    return this.analysisCache.getStats();
  }

  clearCache() {
    this.analysisCache.clear();
  }
}

// Export singleton instance
export const unifiedDocumentService = new UnifiedDocumentService();