/**
 * Document Quality Validator Service
 * Validates scanned tax documents for readability, completeness, and proper orientation
 */

import sharp from 'sharp';
import pdf from 'pdf-parse';
import { File } from '@google-cloud/storage';

export interface QualityValidationResult {
  isAcceptable: boolean;
  qualityScore: number; // 0-1
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

class DocumentQualityValidator {
  // Minimum requirements for tax documents
  private readonly MIN_IMAGE_WIDTH = 1200; // pixels (approx 150 DPI at 8 inches)
  private readonly MIN_IMAGE_HEIGHT = 1500; // pixels
  private readonly MIN_FILE_SIZE = 50 * 1024; // 50 KB
  private readonly MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
  private readonly MAX_PDF_PAGES = 50; // Prevent abuse
  private readonly MIN_QUALITY_SCORE = 0.6; // 60% minimum

  /**
   * Validate an uploaded document file
   */
  async validateDocument(
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
        description: `File is too small (${Math.round(buffer.length / 1024)}KB). Minimum is ${Math.round(this.MIN_FILE_SIZE / 1024)}KB.`,
        recommendation: 'Ensure document is properly scanned at adequate quality.',
      });
    } else if (buffer.length > this.MAX_FILE_SIZE) {
      issues.push({
        type: 'fileSize',
        severity: 'error',
        description: `File is too large (${Math.round(buffer.length / 1024 / 1024)}MB). Maximum is ${this.MAX_FILE_SIZE / 1024 / 1024}MB.`,
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
        description: `Unsupported file format: ${mimeType}`,
        recommendation: 'Upload as PDF, JPEG, or PNG format.',
      });
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(issues, validation);

    // Determine if acceptable
    const hasErrors = issues.some(issue => issue.severity === 'error');
    const isAcceptable = !hasErrors && qualityScore >= this.MIN_QUALITY_SCORE;

    return {
      isAcceptable,
      qualityScore,
      issues,
      validation,
    };
  }

  /**
   * Validate image quality (JPEG, PNG, etc.)
   */
  private async validateImage(
    buffer: Buffer,
    mimeType: string,
    issues: QualityIssue[],
    validation: QualityValidationResult['validation']
  ): Promise<void> {
    try {
      const metadata = await sharp(buffer).metadata();

      validation.imageResolution = {
        width: metadata.width || 0,
        height: metadata.height || 0,
        dpi: metadata.density,
      };

      // Check resolution
      if (metadata.width && metadata.width < this.MIN_IMAGE_WIDTH) {
        issues.push({
          type: 'resolution',
          severity: 'warning',
          description: `Image width (${metadata.width}px) is below recommended minimum (${this.MIN_IMAGE_WIDTH}px).`,
          recommendation: 'Rescan at higher resolution for better OCR accuracy.',
        });
      }

      if (metadata.height && metadata.height < this.MIN_IMAGE_HEIGHT) {
        issues.push({
          type: 'resolution',
          severity: 'warning',
          description: `Image height (${metadata.height}px) is below recommended minimum (${this.MIN_IMAGE_HEIGHT}px).`,
          recommendation: 'Rescan at higher resolution for better OCR accuracy.',
        });
      }

      // Determine orientation
      if (metadata.width && metadata.height) {
        validation.orientation = metadata.width > metadata.height ? 'landscape' : 'portrait';

        // Most tax documents should be portrait
        if (validation.orientation === 'landscape') {
          issues.push({
            type: 'orientation',
            severity: 'info',
            description: 'Document appears to be in landscape orientation.',
            recommendation: 'Verify document is correctly oriented. Most tax documents are portrait.',
          });
        }
      }

      // Assess readability based on DPI (if available)
      if (metadata.density) {
        if (metadata.density >= 300) {
          validation.readability = 'excellent';
        } else if (metadata.density >= 200) {
          validation.readability = 'good';
        } else if (metadata.density >= 150) {
          validation.readability = 'fair';
          issues.push({
            type: 'readability',
            severity: 'warning',
            description: `Image DPI (${metadata.density}) is below recommended (200+).`,
            recommendation: 'Rescan at 200-300 DPI for optimal readability.',
          });
        } else {
          validation.readability = 'poor';
          issues.push({
            type: 'readability',
            severity: 'error',
            description: `Image DPI (${metadata.density}) is too low for reliable OCR.`,
            recommendation: 'Rescan at 200-300 DPI minimum.',
          });
        }
      }

      validation.pageCount = 1; // Images are single page
    } catch (error) {
      issues.push({
        type: 'format',
        severity: 'error',
        description: `Unable to process image: ${(error as Error).message}`,
        recommendation: 'Ensure file is a valid image format.',
      });
    }
  }

  /**
   * Validate PDF quality
   */
  private async validatePDF(
    buffer: Buffer,
    issues: QualityIssue[],
    validation: QualityValidationResult['validation']
  ): Promise<void> {
    try {
      const pdfData = await pdf(buffer);

      validation.pageCount = pdfData.numpages;

      // Check page count
      if (pdfData.numpages === 0) {
        issues.push({
          type: 'pageCount',
          severity: 'error',
          description: 'PDF has no pages.',
          recommendation: 'Ensure PDF was created correctly.',
        });
      } else if (pdfData.numpages > this.MAX_PDF_PAGES) {
        issues.push({
          type: 'pageCount',
          severity: 'error',
          description: `PDF has too many pages (${pdfData.numpages}). Maximum is ${this.MAX_PDF_PAGES}.`,
          recommendation: 'Split large PDFs or upload only relevant pages.',
        });
      } else if (pdfData.numpages > 10) {
        issues.push({
          type: 'pageCount',
          severity: 'warning',
          description: `PDF has many pages (${pdfData.numpages}). Ensure all pages are necessary.`,
          recommendation: 'Tax documents are typically 1-3 pages.',
        });
      }

      // Check if PDF has text (searchable) vs. images only
      const textLength = pdfData.text?.trim().length || 0;
      if (textLength < 50 && pdfData.numpages > 0) {
        validation.readability = 'poor';
        issues.push({
          type: 'readability',
          severity: 'warning',
          description: 'PDF appears to be scanned images without OCR text layer.',
          recommendation: 'This will require OCR processing which may be less accurate.',
        });
      } else if (textLength > 100) {
        validation.readability = 'excellent';
      } else {
        validation.readability = 'fair';
      }
    } catch (error) {
      issues.push({
        type: 'format',
        severity: 'error',
        description: `Unable to process PDF: ${(error as Error).message}`,
        recommendation: 'Ensure file is a valid PDF.',
      });
    }
  }

  /**
   * Calculate overall quality score based on validation results
   */
  private calculateQualityScore(
    issues: QualityIssue[],
    validation: QualityValidationResult['validation']
  ): number {
    let score = 1.0;

    // Deduct points for issues
    for (const issue of issues) {
      if (issue.severity === 'error') {
        score -= 0.3;
      } else if (issue.severity === 'warning') {
        score -= 0.1;
      } else if (issue.severity === 'info') {
        score -= 0.05;
      }
    }

    // Bonus for good resolution
    if (validation.imageResolution) {
      const { width, height } = validation.imageResolution;
      if (width && width >= 2000 && height && height >= 2500) {
        score += 0.1;
      }
    }

    // Bonus for excellent readability
    if (validation.readability === 'excellent') {
      score += 0.1;
    }

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Validate a document from GCS
   */
  async validateGCSDocument(file: File): Promise<QualityValidationResult> {
    try {
      const [metadata] = await file.getMetadata();
      const [buffer] = await file.download();

      return await this.validateDocument(
        buffer,
        metadata.contentType || 'application/octet-stream',
        metadata.name || 'unknown'
      );
    } catch (error) {
      return {
        isAcceptable: false,
        qualityScore: 0,
        issues: [
          {
            type: 'format',
            severity: 'error',
            description: `Failed to download or validate document: ${(error as Error).message}`,
          },
        ],
        validation: {
          fileSize: 0,
        },
      };
    }
  }
}

export const documentQualityValidator = new DocumentQualityValidator();
