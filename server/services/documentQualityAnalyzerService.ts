import { storage } from "../storage";
import { ObjectStorageService } from "../objectStorage";
import type { QualityMetrics, QualityIssue, QualityAnalysisResult } from "@shared/schema";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

// Quality thresholds for determining issue severity
const QUALITY_THRESHOLDS = {
  blur: { error: 0.4, warning: 0.6 },
  ocrConfidence: { error: 0.6, warning: 0.75 },
  completeness: { error: false }, // boolean: missing = error
  format: { error: false }, // boolean: unreadable = error
};

// Weights for aggregating overall quality score
const QUALITY_WEIGHTS = {
  blur: 0.3, // 30%
  ocrConfidence: 0.4, // 40%
  completeness: 0.2, // 20%
  format: 0.1, // 10%
};

// Document type specific page requirements
const DOCUMENT_PAGE_REQUIREMENTS: Record<string, number> = {
  "W-2": 2,
  "1099-MISC": 1,
  "1099-NEC": 1,
  "1099-INT": 1,
  "1099-DIV": 1,
  "1040": 2, // Base form, schedules checked separately
  "8863": 1,
  "Schedule C": 2,
  "Schedule E": 2,
};

class DocumentQualityAnalyzerService {
  private objectStorageService: ObjectStorageService;

  constructor() {
    this.objectStorageService = new ObjectStorageService();
  }

  /**
   * Main entry point - Orchestrates all quality checks
   */
  async analyzeDocument(documentId: string): Promise<QualityAnalysisResult> {
    console.log(`[Quality Analyzer] Starting analysis for document ${documentId}`);

    try {
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Initialize metrics
      const metrics: QualityMetrics = {
        pageCount: 0,
        perPageMetrics: [],
      };

      const issues: QualityIssue[] = [];

      // 1. Validate file format (fast-fail synchronous check)
      const formatValid = await this.validateFileFormat(document.objectPath, document.mimeType);
      metrics.format = formatValid;

      if (!formatValid) {
        issues.push({
          severity: 'error',
          type: 'format',
          message: 'File format is unreadable or corrupted',
        });
      }

      // Only proceed with other checks if format is valid
      if (formatValid && document.objectPath) {
        // 2. Compute blur score (for images)
        if (document.mimeType?.startsWith('image/')) {
          const blurScore = await this.computeBlurScore(document.objectPath);
          metrics.blur = blurScore;

          if (blurScore < QUALITY_THRESHOLDS.blur.error) {
            issues.push({
              severity: 'error',
              type: 'blur',
              message: 'Document is significantly blurry',
              details: { score: blurScore },
            });
          } else if (blurScore < QUALITY_THRESHOLDS.blur.warning) {
            issues.push({
              severity: 'warning',
              type: 'blur',
              message: 'Document appears slightly blurry',
              details: { score: blurScore },
            });
          }
        }

        // 3. Evaluate OCR confidence (use existing OCR results from processing)
        if (document.metadata && typeof document.metadata === 'object') {
          const metadata = document.metadata as any;
          
          // Check if we have OCR results from document processing
          if (metadata.ocrResult || document.ocrAccuracy) {
            const ocrConfidence = document.ocrAccuracy || 
                                 (metadata.ocrResult ? await this.evaluateOcrConfidence(metadata.ocrResult) : undefined);
            
            if (ocrConfidence !== undefined) {
              metrics.ocrConfidence = ocrConfidence;

              if (ocrConfidence < QUALITY_THRESHOLDS.ocrConfidence.error) {
                issues.push({
                  severity: 'error',
                  type: 'ocr_confidence',
                  message: 'OCR confidence is very low - text may not be readable',
                  details: { confidence: ocrConfidence },
                });
              } else if (ocrConfidence < QUALITY_THRESHOLDS.ocrConfidence.warning) {
                issues.push({
                  severity: 'warning',
                  type: 'ocr_confidence',
                  message: 'OCR confidence is below optimal',
                  details: { confidence: ocrConfidence },
                });
              }
            }
          }

          // Get page count from metadata
          if (metadata.pageCount) {
            metrics.pageCount = metadata.pageCount;
          }
        }

        // 4. Check completeness (document type specific)
        const documentType = this.extractDocumentType(document);
        if (documentType) {
          const complete = await this.checkCompleteness(documentId, documentType, metrics.pageCount || 0);
          metrics.completeness = complete;

          if (!complete) {
            issues.push({
              severity: 'error',
              type: 'completeness',
              message: `Document appears incomplete - expected ${DOCUMENT_PAGE_REQUIREMENTS[documentType]} pages`,
              details: { 
                expectedPages: DOCUMENT_PAGE_REQUIREMENTS[documentType],
                actualPages: metrics.pageCount 
              },
            });
          }
        } else {
          // If we can't determine document type, mark as complete (can't verify)
          metrics.completeness = true;
        }
      }

      // 5. Aggregate overall quality score
      const qualityScore = this.aggregateQualityScore(metrics);

      // 6. Generate actionable suggestions
      const suggestions = this.generateSuggestions(issues);

      const result: QualityAnalysisResult = {
        documentId,
        qualityScore,
        metrics,
        issues,
        suggestions,
        analyzedAt: new Date(),
      };

      console.log(`[Quality Analyzer] Analysis complete for document ${documentId} - Score: ${qualityScore.toFixed(2)}`);
      return result;
    } catch (error) {
      console.error(`[Quality Analyzer] Error analyzing document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Compute blur score using Laplacian variance algorithm
   * Returns 0-1 score (higher = sharper, lower = more blurry)
   */
  async computeBlurScore(objectPath: string | null): Promise<number> {
    if (!objectPath) {
      console.warn('[Quality Analyzer] No object path provided for blur detection');
      return 0.5; // neutral score
    }

    try {
      // Download image from object storage to temporary file
      const tempDir = '/tmp/quality-analysis';
      await fs.mkdir(tempDir, { recursive: true });
      const tempFilePath = path.join(tempDir, `${Date.now()}-blur-check.jpg`);

      // Get file from object storage
      const fileBuffer = await this.objectStorageService.downloadFile(objectPath);
      await fs.writeFile(tempFilePath, fileBuffer);

      // Use sharp to convert image to grayscale and get pixel data
      const { data, info } = await sharp(tempFilePath)
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Calculate Laplacian variance for blur detection
      const laplacianVariance = this.calculateLaplacianVariance(
        data,
        info.width,
        info.height
      );

      // Clean up temp file
      await fs.unlink(tempFilePath).catch(() => {});

      // Normalize variance to 0-1 score
      // Typical variance ranges: 
      // - Very blurry: < 100
      // - Slightly blurry: 100-500
      // - Sharp: > 500
      const normalizedScore = Math.min(laplacianVariance / 500, 1.0);

      console.log(`[Quality Analyzer] Blur score: ${normalizedScore.toFixed(3)} (variance: ${laplacianVariance.toFixed(1)})`);
      return normalizedScore;
    } catch (error) {
      console.error('[Quality Analyzer] Error computing blur score:', error);
      return 0.5; // Return neutral score on error
    }
  }

  /**
   * Calculate Laplacian variance for blur detection
   * Higher variance = sharper image
   */
  private calculateLaplacianVariance(
    pixels: Buffer,
    width: number,
    height: number
  ): number {
    const laplacianKernel = [
      [0, 1, 0],
      [1, -4, 1],
      [0, 1, 0],
    ];

    let sum = 0;
    let count = 0;

    // Apply Laplacian kernel to image
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let laplacian = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIndex = (y + ky) * width + (x + kx);
            const pixelValue = pixels[pixelIndex];
            laplacian += pixelValue * laplacianKernel[ky + 1][kx + 1];
          }
        }

        sum += laplacian * laplacian;
        count++;
      }
    }

    // Return variance (mean squared Laplacian)
    return count > 0 ? sum / count : 0;
  }

  /**
   * Evaluate OCR confidence from Tesseract or other OCR results
   * Returns 0-1 score (higher = more confident)
   */
  async evaluateOcrConfidence(ocrResult: any): Promise<number> {
    try {
      // Handle different OCR result formats
      if (typeof ocrResult === 'number') {
        // Already a confidence score
        return Math.max(0, Math.min(1, ocrResult));
      }

      if (ocrResult && typeof ocrResult === 'object') {
        // Tesseract format with word-level confidence
        if (ocrResult.words && Array.isArray(ocrResult.words)) {
          const confidences = ocrResult.words
            .map((word: any) => word.confidence)
            .filter((conf: any) => typeof conf === 'number');

          if (confidences.length > 0) {
            const avgConfidence = confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;
            return avgConfidence / 100; // Tesseract returns 0-100, normalize to 0-1
          }
        }

        // Generic confidence field
        if (typeof ocrResult.confidence === 'number') {
          const conf = ocrResult.confidence;
          return conf > 1 ? conf / 100 : conf; // Normalize to 0-1
        }

        // Average confidence field
        if (typeof ocrResult.averageConfidence === 'number') {
          const conf = ocrResult.averageConfidence;
          return conf > 1 ? conf / 100 : conf;
        }
      }

      // Default to moderate confidence if we can't extract
      console.warn('[Quality Analyzer] Could not extract OCR confidence, using default');
      return 0.75;
    } catch (error) {
      console.error('[Quality Analyzer] Error evaluating OCR confidence:', error);
      return 0.75; // Return moderate confidence on error
    }
  }

  /**
   * Check if document has all required pages
   * Document-type specific rules
   */
  async checkCompleteness(
    documentId: string,
    documentType: string,
    actualPageCount: number
  ): Promise<boolean> {
    try {
      const requiredPages = DOCUMENT_PAGE_REQUIREMENTS[documentType];

      if (!requiredPages) {
        // Unknown document type, can't verify completeness
        return true;
      }

      const isComplete = actualPageCount >= requiredPages;
      
      if (!isComplete) {
        console.warn(
          `[Quality Analyzer] Document ${documentId} type ${documentType} incomplete: ` +
          `${actualPageCount}/${requiredPages} pages`
        );
      }

      return isComplete;
    } catch (error) {
      console.error('[Quality Analyzer] Error checking completeness:', error);
      return true; // Assume complete on error
    }
  }

  /**
   * Validate if file format is readable
   * Synchronous fast-fail check
   */
  async validateFileFormat(
    objectPath: string | null,
    mimeType: string | null
  ): Promise<boolean> {
    try {
      if (!objectPath) {
        return false;
      }

      // Check MIME type is supported
      const supportedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/tiff',
        'image/webp',
      ];

      if (mimeType && !supportedTypes.includes(mimeType)) {
        console.warn(`[Quality Analyzer] Unsupported MIME type: ${mimeType}`);
        return false;
      }

      // Try to read file metadata from object storage
      try {
        const fileBuffer = await this.objectStorageService.downloadFile(objectPath);
        
        if (!fileBuffer || fileBuffer.length === 0) {
          console.warn('[Quality Analyzer] File is empty');
          return false;
        }

        // For images, verify with sharp
        if (mimeType?.startsWith('image/')) {
          await sharp(fileBuffer).metadata();
        }

        return true;
      } catch (error) {
        console.error('[Quality Analyzer] Error reading file:', error);
        return false;
      }
    } catch (error) {
      console.error('[Quality Analyzer] Error validating file format:', error);
      return false;
    }
  }

  /**
   * Aggregate quality metrics into single 0-1 score
   * Weighted average: blur 30%, OCR 40%, completeness 20%, format 10%
   */
  aggregateQualityScore(metrics: QualityMetrics): number {
    let totalWeight = 0;
    let weightedSum = 0;

    // Blur score (0-1, higher is better)
    if (metrics.blur !== undefined) {
      weightedSum += metrics.blur * QUALITY_WEIGHTS.blur;
      totalWeight += QUALITY_WEIGHTS.blur;
    }

    // OCR confidence (0-1, higher is better)
    if (metrics.ocrConfidence !== undefined) {
      weightedSum += metrics.ocrConfidence * QUALITY_WEIGHTS.ocrConfidence;
      totalWeight += QUALITY_WEIGHTS.ocrConfidence;
    }

    // Completeness (boolean → 0 or 1)
    if (metrics.completeness !== undefined) {
      const completenessScore = metrics.completeness ? 1.0 : 0.0;
      weightedSum += completenessScore * QUALITY_WEIGHTS.completeness;
      totalWeight += QUALITY_WEIGHTS.completeness;
    }

    // Format validity (boolean → 0 or 1)
    if (metrics.format !== undefined) {
      const formatScore = metrics.format ? 1.0 : 0.0;
      weightedSum += formatScore * QUALITY_WEIGHTS.format;
      totalWeight += QUALITY_WEIGHTS.format;
    }

    // Calculate weighted average
    if (totalWeight === 0) {
      return 0.5; // neutral score if no metrics available
    }

    return weightedSum / totalWeight;
  }

  /**
   * Generate actionable suggestions based on quality issues
   */
  generateSuggestions(issues: QualityIssue[]): string[] {
    const suggestions: string[] = [];
    const suggestionMap: Record<string, string> = {
      blur: 'This page appears blurry. Please retake the photo with better lighting and hold the camera steady.',
      ocr_confidence: 'Text recognition confidence is low. Try scanning the document instead of photographing it, or ensure better lighting.',
      completeness: 'Document appears incomplete. Please upload all required pages.',
      format: 'File format error. Please upload the document as PDF, JPEG, or PNG format.',
    };

    // Group issues by severity
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    // Add error-specific suggestions first
    for (const issue of errors) {
      if (suggestionMap[issue.type]) {
        suggestions.push(suggestionMap[issue.type]);
      }
    }

    // Add warning-specific suggestions
    for (const issue of warnings) {
      if (suggestionMap[issue.type]) {
        const warningSuggestion = `Consider: ${suggestionMap[issue.type]}`;
        suggestions.push(warningSuggestion);
      }
    }

    // Add general suggestion if quality is poor
    if (errors.length > 0) {
      suggestions.push('For best results, scan documents in good lighting or use a document scanning app.');
    }

    // Remove duplicates
    return Array.from(new Set(suggestions));
  }

  /**
   * Extract document type from document metadata or filename
   */
  private extractDocumentType(document: any): string | null {
    try {
      // Check metadata first
      if (document.metadata && typeof document.metadata === 'object') {
        const metadata = document.metadata as any;
        if (metadata.classification && metadata.classification.documentType) {
          return metadata.classification.documentType;
        }
        if (metadata.documentType) {
          return metadata.documentType;
        }
      }

      // Try to extract from filename
      const filename = document.originalName || document.filename || '';
      
      // Common tax forms
      if (filename.match(/w-?2/i)) return 'W-2';
      if (filename.match(/1099-?misc/i)) return '1099-MISC';
      if (filename.match(/1099-?nec/i)) return '1099-NEC';
      if (filename.match(/1099-?int/i)) return '1099-INT';
      if (filename.match(/1099-?div/i)) return '1099-DIV';
      if (filename.match(/1040/i)) return '1040';
      if (filename.match(/8863/i)) return '8863';
      if (filename.match(/schedule-?c/i)) return 'Schedule C';
      if (filename.match(/schedule-?e/i)) return 'Schedule E';

      return null;
    } catch (error) {
      console.error('[Quality Analyzer] Error extracting document type:', error);
      return null;
    }
  }
}

export const documentQualityAnalyzerService = new DocumentQualityAnalyzerService();
