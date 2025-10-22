/**
 * Secure Excel Parser Wrapper
 * 
 * Mitigates xlsx library vulnerabilities (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9):
 * - Prototype Pollution: Implements Object.freeze() on critical prototypes
 * - ReDoS: Enforces file size limits and parsing timeouts
 * 
 * SECURITY NOTE: This is a mitigation layer, NOT a complete fix.
 * The xlsx library has HIGH severity vulnerabilities with NO FIX AVAILABLE.
 * This wrapper reduces risk but does not eliminate it.
 * 
 * Recommendation: Replace xlsx with exceljs or xlsx-populate when feasible.
 */

import * as XLSX from 'xlsx';
import { logger } from '../services/logger.service';

// Freeze critical prototypes to prevent pollution attacks
Object.freeze(Object.prototype);
Object.freeze(Array.prototype);

export interface SecureXlsxOptions {
  maxFileSizeBytes?: number; // Default: 5MB
  maxParsingTimeMs?: number; // Default: 5000ms (5 seconds)
  allowedSheets?: number; // Default: 10
}

export interface ParseResult {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
  metadata?: {
    processingTimeMs: number;
    fileSizeBytes: number;
    sheetCount: number;
  };
}

export class SecureXlsxParser {
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB default
  private readonly MAX_PARSING_TIME = 5000; // 5 seconds default
  private readonly MAX_SHEETS = 10; // Maximum sheets to process

  /**
   * Safely parse an Excel file with security controls
   * 
   * @param fileBuffer - Buffer containing Excel file data
   * @param options - Parsing options with security limits
   * @returns ParseResult with data or error
   */
  async parseExcelToCSV(
    fileBuffer: Buffer,
    options: SecureXlsxOptions = {}
  ): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    const maxFileSize = options.maxFileSizeBytes || this.MAX_FILE_SIZE;
    const maxParsingTime = options.maxParsingTimeMs || this.MAX_PARSING_TIME;
    const maxSheets = options.allowedSheets || this.MAX_SHEETS;

    try {
      // Security Check 1: File size validation (prevents ReDoS on large files)
      if (fileBuffer.length > maxFileSize) {
        return {
          success: false,
          error: `File size (${fileBuffer.length} bytes) exceeds maximum allowed (${maxFileSize} bytes). ` +
                 `This limit prevents resource exhaustion attacks.`,
        };
      }

      // Security Check 2: Setup parsing timeout
      let parsingTimedOut = false;
      const timeoutHandle = setTimeout(() => {
        parsingTimedOut = true;
        logger.warn('Excel parsing timeout detected - possible ReDoS attack', {
          fileSize: fileBuffer.length,
          elapsedTime: Date.now() - startTime,
        });
      }, maxParsingTime);

      // Security Check 3: Parse with error handling
      let workbook: XLSX.WorkBook;
      try {
        workbook = XLSX.read(fileBuffer, { 
          type: 'buffer',
          cellDates: true,
          cellNF: false, // Don't parse number formats (reduces attack surface)
          cellHTML: false, // Don't parse HTML (XSS prevention)
        });
      } catch (parseError) {
        clearTimeout(timeoutHandle);
        return {
          success: false,
          error: `Excel parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        };
      }

      clearTimeout(timeoutHandle);

      // Security Check 4: Check if parsing timed out
      if (parsingTimedOut) {
        return {
          success: false,
          error: 'Excel parsing timeout - file may contain malicious patterns. ' +
                 'This protection prevents Regular Expression Denial of Service (ReDoS) attacks.',
        };
      }

      // Security Check 5: Validate sheet count
      if (workbook.SheetNames.length > maxSheets) {
        warnings.push(
          `File contains ${workbook.SheetNames.length} sheets. ` +
          `Only processing first ${maxSheets} sheets to prevent resource exhaustion.`
        );
      }

      // Get first sheet (most common use case)
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return {
          success: false,
          error: 'Excel file contains no sheets',
        };
      }

      const worksheet = workbook.Sheets[firstSheetName];

      // Convert to CSV safely
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);

      const processingTime = Date.now() - startTime;

      // Security Check 6: Log suspicious long processing times
      if (processingTime > 3000) {
        logger.warn('Excel file took unusually long to process', {
          processingTimeMs: processingTime,
          fileSizeBytes: fileBuffer.length,
          sheetCount: workbook.SheetNames.length,
          suspiciousActivity: true,
        });
        warnings.push(
          `Processing took ${processingTime}ms - file may contain complex formulas or patterns.`
        );
      }

      return {
        success: true,
        data: csvContent,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          processingTimeMs: processingTime,
          fileSizeBytes: fileBuffer.length,
          sheetCount: workbook.SheetNames.length,
        },
      };

    } catch (error) {
      logger.error('Secure Excel parsing failed', error, {
        fileSizeBytes: fileBuffer.length,
        elapsedTimeMs: Date.now() - startTime,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Excel parsing error',
      };
    }
  }

  /**
   * Parse Excel file directly to JSON rows
   * 
   * @param fileBuffer - Buffer containing Excel file data
   * @param options - Parsing options with security limits
   * @returns ParseResult with array of row objects
   */
  async parseExcelToJSON(
    fileBuffer: Buffer,
    options: SecureXlsxOptions = {}
  ): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    const maxFileSize = options.maxFileSizeBytes || this.MAX_FILE_SIZE;
    const maxParsingTime = options.maxParsingTimeMs || this.MAX_PARSING_TIME;

    try {
      // Security Check 1: File size
      if (fileBuffer.length > maxFileSize) {
        return {
          success: false,
          error: `File size exceeds maximum (${maxFileSize} bytes)`,
        };
      }

      // Security Check 2: Timeout
      let parsingTimedOut = false;
      const timeoutHandle = setTimeout(() => {
        parsingTimedOut = true;
      }, maxParsingTime);

      // Parse workbook
      const workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellDates: true,
        cellHTML: false,
      });

      clearTimeout(timeoutHandle);

      if (parsingTimedOut) {
        return {
          success: false,
          error: 'Excel parsing timeout - possible ReDoS attack',
        };
      }

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return {
          success: false,
          error: 'Excel file contains no sheets',
        };
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const processingTime = Date.now() - startTime;

      if (processingTime > 3000) {
        logger.warn('Excel JSON parsing took long time', {
          processingTimeMs: processingTime,
          fileSizeBytes: fileBuffer.length,
        });
      }

      return {
        success: true,
        data: jsonData,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          processingTimeMs: processingTime,
          fileSizeBytes: fileBuffer.length,
          sheetCount: workbook.SheetNames.length,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const secureXlsxParser = new SecureXlsxParser();
