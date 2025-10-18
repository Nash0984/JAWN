import { storage } from "../storage";
import { ObjectStorageService } from "../objectStorage";
import type { 
  QualityMetrics, 
  EnhancementStep,
  EnhancementMetadata,
  QualityAnalysisResult
} from "@shared/schema";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

// Quality thresholds for determining when to apply enhancements
const ENHANCEMENT_THRESHOLDS = {
  noOp: 0.75, // Skip if overall quality ≥0.75
  blur: {
    mild: 0.6,  // <0.6: apply mild unsharp mask
    strong: 0.4 // <0.4: apply stronger deblur
  },
  contrast: 0.7, // <0.7: apply auto-level and gamma correction
  skewAngle: 2,  // >2°: apply rotation correction
  noise: 0.4     // >0.4: apply median/bilateral smoothing
};

// Timeout for enhancement processing (30 seconds)
const ENHANCEMENT_TIMEOUT_MS = 30000;

// Circuit breaker: track consecutive failures per document
const failureTracker = new Map<string, number>();
const MAX_CONSECUTIVE_FAILURES = 3;

export interface EnhancementResult {
  status: 'completed' | 'skipped' | 'failed';
  reason?: string;
  improvement?: number;
  error?: string;
}

export class AutoEnhancementService {
  private objectStorageService: ObjectStorageService;

  constructor() {
    this.objectStorageService = new ObjectStorageService();
  }

  /**
   * Main orchestration method - Enhances document based on quality metrics
   * @param documentId - The document to enhance
   * @param qualityAssessment - Optional quality assessment result. If provided, uses these metrics directly.
   *                            If not provided, attempts to fetch from database (for re-enhancement scenarios).
   */
  async enhanceDocument(documentId: string, qualityAssessment?: QualityAnalysisResult): Promise<EnhancementResult> {
    console.log(`[Auto-Enhancement] Starting enhancement for document ${documentId}`);

    try {
      // Idempotent check: Skip if already processed
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      if (document.enhancementStatus === 'completed' || document.enhancementStatus === 'skipped') {
        console.log(`[Auto-Enhancement] Document ${documentId} already processed, status: ${document.enhancementStatus}`);
        return { status: 'skipped', reason: 'Already processed' };
      }

      // Circuit breaker: Skip if too many consecutive failures
      const failures = failureTracker.get(documentId) || 0;
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn(`[Auto-Enhancement] Skipping document ${documentId} due to ${failures} consecutive failures`);
        await storage.updateDocument(documentId, {
          enhancementStatus: 'failed',
          enhancementMetadata: { 
            errors: ['Circuit breaker triggered - too many consecutive failures']
          }
        });
        return { status: 'failed', error: 'Circuit breaker triggered' };
      }

      // Only enhance images
      if (!document.mimeType?.startsWith('image/')) {
        console.log(`[Auto-Enhancement] Skipping non-image document ${documentId}`);
        await storage.updateDocument(documentId, {
          enhancementStatus: 'skipped',
          enhancementMetadata: { reason: 'Not an image document' }
        });
        return { status: 'skipped', reason: 'Not an image document' };
      }

      // Set timeout for enhancement
      const enhancementPromise = this.performEnhancement(documentId, document, qualityAssessment);
      const timeoutPromise = new Promise<EnhancementResult>((_, reject) => 
        setTimeout(() => reject(new Error('Enhancement timeout exceeded')), ENHANCEMENT_TIMEOUT_MS)
      );

      const result = await Promise.race([enhancementPromise, timeoutPromise]);

      // Reset failure counter on success
      if (result.status === 'completed') {
        failureTracker.delete(documentId);
      }

      return result;
    } catch (error) {
      console.error(`[Auto-Enhancement] Enhancement failed for document ${documentId}:`, error);
      
      // Increment failure counter
      const failures = (failureTracker.get(documentId) || 0) + 1;
      failureTracker.set(documentId, failures);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await storage.updateDocument(documentId, {
        enhancementStatus: 'failed',
        enhancementMetadata: { errors: [errorMessage] }
      });

      return { status: 'failed', error: errorMessage };
    }
  }

  /**
   * Performs the actual enhancement process
   * @param documentId - The document ID
   * @param document - The document object
   * @param qualityAssessment - Optional quality assessment (passed directly from processor)
   */
  private async performEnhancement(documentId: string, document: any, qualityAssessment?: QualityAnalysisResult): Promise<EnhancementResult> {
    // 1. Fetch document and original quality metrics
    // Use passed assessment if available (for fresh uploads), otherwise try database lookup (for re-enhancement)
    let originalQuality: any;
    
    if (qualityAssessment) {
      // Use passed quality assessment directly (Option 1 - preferred)
      console.log(`[Auto-Enhancement] Using passed quality assessment for document ${documentId}`);
      originalQuality = {
        qualityScore: qualityAssessment.qualityScore,
        metrics: qualityAssessment.metrics
      };
    } else {
      // Fall back to database lookup for re-enhancement scenarios
      const qualityHistory = await storage.getDocumentQualityHistory(documentId);
      
      if (qualityHistory && qualityHistory.length > 0) {
        originalQuality = qualityHistory[0]; // Most recent
      } else if (document.qualityMetrics && document.qualityScore !== null) {
        // Use inline quality metrics if no history
        originalQuality = {
          qualityScore: document.qualityScore,
          metrics: document.qualityMetrics as QualityMetrics
        };
      } else {
        console.log(`[Auto-Enhancement] No quality metrics available for document ${documentId}, skipping enhancement`);
        await storage.updateDocument(documentId, {
          enhancementStatus: 'skipped',
          enhancementMetadata: { reason: 'No quality metrics available' }
        });
        return { status: 'skipped', reason: 'No quality metrics available' };
      }
    }

    // 2. Build enhancement plan based on quality metrics
    const plan = this.buildEnhancementPlan(originalQuality.metrics);

    if (plan.length === 0) {
      // No enhancement needed
      console.log(`[Auto-Enhancement] No enhancement needed for document ${documentId}`);
      await storage.updateDocument(documentId, {
        enhancementStatus: 'skipped',
        enhancementMetadata: { reason: 'Quality already good' }
      });
      return { status: 'skipped', reason: 'Quality already good' };
    }

    console.log(`[Auto-Enhancement] Enhancement plan for document ${documentId}: ${plan.length} steps`);

    // 3. Download original document
    if (!document.objectPath) {
      throw new Error('Document has no object path');
    }

    const originalBuffer = await this.objectStorageService.downloadFile(document.objectPath);

    // 4. Apply enhancement steps in order
    let enhancedBuffer = originalBuffer;
    const appliedSteps: EnhancementStep[] = [];

    for (const step of plan) {
      console.log(`[Auto-Enhancement] Applying step: ${step.type}`);
      enhancedBuffer = await this.applyEnhancementStep(enhancedBuffer, step);
      appliedSteps.push(step);
    }

    // 5. Store enhanced version in object storage
    const enhancedPath = `/enhanced/${documentId}.tiff`;
    await this.objectStorageService.uploadBuffer(enhancedPath, enhancedBuffer, 'image/tiff');
    console.log(`[Auto-Enhancement] Stored enhanced version at ${enhancedPath}`);

    // 6. Re-run quality analyzer on enhanced version
    const tempDir = '/tmp/auto-enhancement';
    await fs.mkdir(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `enhanced-${documentId}.tiff`);
    await fs.writeFile(tempPath, enhancedBuffer);

    const { DocumentQualityAnalyzerService } = await import("./documentQualityAnalyzerService");
    const qualityAnalyzer = new DocumentQualityAnalyzerService();
    
    // Create a temporary document record for analysis
    const tempDocId = `temp-${documentId}`;
    await storage.createDocument({
      id: tempDocId,
      filename: `enhanced-${document.filename}`,
      originalName: `enhanced-${document.originalName}`,
      objectPath: enhancedPath,
      mimeType: 'image/tiff',
      status: 'uploaded'
    });

    let enhancedQuality: QualityAnalysisResult;
    try {
      enhancedQuality = await qualityAnalyzer.analyzeDocument(tempDocId);
    } finally {
      // Clean up temp document
      await storage.deleteDocument(tempDocId);
      await fs.unlink(tempPath).catch(() => {});
    }

    // 7. Quality gate: promote only if improvement
    const shouldPromote = await this.shouldPromoteEnhancement(
      originalQuality.qualityScore,
      enhancedQuality.qualityScore,
      originalQuality.metrics,
      enhancedQuality.metrics
    );

    if (shouldPromote) {
      const improvement = enhancedQuality.qualityScore - originalQuality.qualityScore;
      console.log(`[Auto-Enhancement] Promoting enhanced version (improvement: +${improvement.toFixed(3)})`);
      
      // Update document to use enhanced version
      await storage.updateDocument(documentId, {
        enhancementStatus: 'completed',
        enhancedObjectPath: enhancedPath,
        enhancementMetadata: { 
          appliedSteps, 
          params: plan,
          originalScore: originalQuality.qualityScore,
          enhancedScore: enhancedQuality.qualityScore,
          qualityDelta: improvement,
          timestamp: new Date()
        },
        qualityImprovement: improvement
      });

      return { status: 'completed', improvement };
    } else {
      console.log(`[Auto-Enhancement] Discarding enhanced version (no quality improvement)`);
      
      // Discard enhanced version, keep original
      await this.objectStorageService.deleteObject(enhancedPath);
      await storage.updateDocument(documentId, {
        enhancementStatus: 'skipped',
        enhancementMetadata: { 
          appliedSteps, 
          reason: 'No quality improvement', 
          originalScore: originalQuality.qualityScore, 
          enhancedScore: enhancedQuality.qualityScore 
        }
      });

      return { status: 'skipped', reason: 'No quality improvement' };
    }
  }

  /**
   * Build enhancement plan based on quality metrics
   */
  private buildEnhancementPlan(qualityMetrics: QualityMetrics): EnhancementStep[] {
    const steps: EnhancementStep[] = [];

    // Use overallScore if available, otherwise fall back to qualityScore-like calculation
    const overallScore = qualityMetrics.overallScore ?? 
                        qualityMetrics.blur ?? 
                        qualityMetrics.blurScore ?? 
                        0.5;

    // Skip if quality already good
    if (overallScore >= ENHANCEMENT_THRESHOLDS.noOp) {
      return steps; // No enhancement needed
    }

    // Rotation correction (if skewed)
    if (qualityMetrics.skewAngle && qualityMetrics.skewAngle > ENHANCEMENT_THRESHOLDS.skewAngle) {
      steps.push({ 
        type: 'rotation', 
        params: { angle: -qualityMetrics.skewAngle } 
      });
    }

    // Noise reduction (if noisy)
    if (qualityMetrics.noiseScore && qualityMetrics.noiseScore > ENHANCEMENT_THRESHOLDS.noise) {
      steps.push({ 
        type: 'noise_reduction', 
        params: { method: 'median' } 
      });
    }

    // Contrast adjustment (if poor contrast)
    if (qualityMetrics.contrastScore && qualityMetrics.contrastScore < ENHANCEMENT_THRESHOLDS.contrast) {
      steps.push({ 
        type: 'contrast', 
        params: { autoLevel: true, gamma: 1.2 } 
      });
    }

    // Sharpening (if blurry)
    const blurScore = qualityMetrics.blurScore ?? qualityMetrics.blur ?? 1.0;
    if (blurScore < ENHANCEMENT_THRESHOLDS.blur.mild) {
      const intensity = blurScore < ENHANCEMENT_THRESHOLDS.blur.strong ? 'strong' : 'mild';
      steps.push({ 
        type: 'sharpen', 
        params: { intensity } 
      });
    }

    // Always finish with binarization for OCR
    steps.push({ 
      type: 'binarization', 
      params: { adaptive: true } 
    });

    return steps;
  }

  /**
   * Apply a single enhancement step to an image buffer
   */
  private async applyEnhancementStep(imageBuffer: Buffer, step: EnhancementStep): Promise<Buffer> {
    // Use Sharp's limitInputPixels to prevent memory issues
    const sharpOptions = { limitInputPixels: 268402689 }; // ~500 megapixels

    switch (step.type) {
      case 'rotation':
        return this.applyRotationCorrection(imageBuffer, step.params.angle as number, sharpOptions);
      
      case 'noise_reduction':
        return this.applyNoiseReduction(imageBuffer, sharpOptions);
      
      case 'contrast':
        return this.applyContrastAdjustment(imageBuffer, sharpOptions);
      
      case 'sharpen':
        return this.applySharpening(imageBuffer, step.params.intensity as 'mild' | 'strong', sharpOptions);
      
      case 'binarization':
        return this.applyBinarization(imageBuffer, sharpOptions);
      
      default:
        console.warn(`[Auto-Enhancement] Unknown enhancement step type: ${step.type}`);
        return imageBuffer;
    }
  }

  /**
   * Apply sharpening using unsharp mask
   */
  private async applySharpening(
    imageBuffer: Buffer, 
    intensity: 'mild' | 'strong',
    options: any
  ): Promise<Buffer> {
    const sigma = intensity === 'strong' ? 1.5 : 0.8;
    return sharp(imageBuffer, options)
      .sharpen({ sigma })
      .toBuffer();
  }

  /**
   * Apply contrast adjustment with auto-level and gamma correction
   */
  private async applyContrastAdjustment(imageBuffer: Buffer, options: any): Promise<Buffer> {
    return sharp(imageBuffer, options)
      .normalize() // Auto-level
      .gamma(1.2)  // Gamma correction
      .toBuffer();
  }

  /**
   * Apply rotation correction
   */
  private async applyRotationCorrection(
    imageBuffer: Buffer, 
    angle: number,
    options: any
  ): Promise<Buffer> {
    return sharp(imageBuffer, options)
      .rotate(angle, { background: '#ffffff' })
      .toBuffer();
  }

  /**
   * Apply noise reduction using median filter
   */
  private async applyNoiseReduction(imageBuffer: Buffer, options: any): Promise<Buffer> {
    return sharp(imageBuffer, options)
      .median(3) // Median filter for noise
      .toBuffer();
  }

  /**
   * Apply binarization for optimal OCR
   */
  private async applyBinarization(imageBuffer: Buffer, options: any): Promise<Buffer> {
    return sharp(imageBuffer, options)
      .greyscale()
      .normalise()
      .threshold(128) // Adaptive threshold
      .toBuffer();
  }

  /**
   * Determine if enhanced version should be promoted based on quality improvement
   */
  private async shouldPromoteEnhancement(
    originalScore: number,
    enhancedScore: number,
    originalMetrics: QualityMetrics,
    enhancedMetrics: QualityMetrics
  ): Promise<boolean> {
    // Promote if overall score improves by ≥0.05
    if (enhancedScore >= originalScore + 0.05) {
      return true;
    }

    // Promote if any critical metric crosses error→warning or warning→ok
    const origBlur = originalMetrics.blurScore ?? originalMetrics.blur ?? 1.0;
    const enhBlur = enhancedMetrics.blurScore ?? enhancedMetrics.blur ?? 1.0;
    
    if (origBlur < 0.4 && enhBlur >= 0.4) return true;
    if (origBlur < 0.6 && enhBlur >= 0.6) return true;

    const origOcr = originalMetrics.ocrConfidence ?? 1.0;
    const enhOcr = enhancedMetrics.ocrConfidence ?? 1.0;
    
    if (origOcr < 0.6 && enhOcr >= 0.6) return true;
    if (origOcr < 0.75 && enhOcr >= 0.75) return true;

    // Otherwise, discard enhanced version
    return false;
  }
}

export const autoEnhancementService = new AutoEnhancementService();
