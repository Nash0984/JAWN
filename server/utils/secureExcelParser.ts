/**
 * Secure Excel Parser using ExcelJS
 * 
 * Replaces vulnerable xlsx library with ExcelJS - a secure alternative with:
 * - No known prototype pollution vulnerabilities
 * - No ReDoS vulnerabilities
 * - Better TypeScript support
 * - More comprehensive Excel feature support
 * 
 * Migration from xlsx to ExcelJS for security compliance.
 */

import ExcelJS from 'exceljs';
import { logger } from '../services/logger.service';

export interface SecureExcelOptions {
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

export class SecureExcelParser {
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB default
  private readonly MAX_PARSING_TIME = 5000; // 5 seconds default
  private readonly MAX_SHEETS = 10; // Maximum sheets to process

  /**
   * Safely parse an Excel file to CSV with security controls
   * 
   * @param fileBuffer - Buffer containing Excel file data
   * @param options - Parsing options with security limits
   * @returns ParseResult with CSV data or error
   */
  async parseExcelToCSV(
    fileBuffer: Buffer,
    options: SecureExcelOptions = {}
  ): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    const maxFileSize = options.maxFileSizeBytes || this.MAX_FILE_SIZE;
    const maxParsingTime = options.maxParsingTimeMs || this.MAX_PARSING_TIME;
    const maxSheets = options.allowedSheets || this.MAX_SHEETS;

    try {
      // Security Check 1: File size validation
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
        logger.warn('Excel parsing timeout detected - possible attack', {
          fileSize: fileBuffer.length,
          elapsedTime: Date.now() - startTime,
        });
      }, maxParsingTime);

      // Security Check 3: Parse with ExcelJS
      const workbook = new ExcelJS.Workbook();
      let parsedWorkbook: ExcelJS.Workbook;
      
      try {
        parsedWorkbook = await workbook.xlsx.load(fileBuffer);
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
          error: 'Excel parsing timeout - file may contain malicious patterns.',
        };
      }

      // Security Check 5: Validate sheet count
      const sheetCount = parsedWorkbook.worksheets.length;
      if (sheetCount > maxSheets) {
        warnings.push(
          `File contains ${sheetCount} sheets. ` +
          `Only processing first ${maxSheets} sheets to prevent resource exhaustion.`
        );
      }

      // Get first sheet
      const firstSheet = parsedWorkbook.worksheets[0];
      if (!firstSheet) {
        return {
          success: false,
          error: 'Excel file contains no sheets',
        };
      }

      // Convert to CSV
      const csvRows: string[] = [];
      firstSheet.eachRow((row, rowNumber) => {
        const values = row.values as any[];
        // Skip the first undefined element from ExcelJS
        const cleanValues = values.slice(1).map(val => {
          if (val === null || val === undefined) return '';
          if (typeof val === 'object' && 'text' in val) return val.text;
          if (typeof val === 'object' && 'result' in val) return val.result;
          return String(val);
        });
        csvRows.push(cleanValues.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      });

      const csvContent = csvRows.join('\n');
      const processingTime = Date.now() - startTime;

      // Security Check 6: Log suspicious long processing times
      if (processingTime > 3000) {
        logger.warn('Excel file took unusually long to process', {
          processingTimeMs: processingTime,
          fileSizeBytes: fileBuffer.length,
          sheetCount: sheetCount,
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
          sheetCount: sheetCount,
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
    options: SecureExcelOptions = {}
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

      // Parse workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      const parsedWorkbook = await workbook.xlsx.load(fileBuffer);

      clearTimeout(timeoutHandle);

      if (parsingTimedOut) {
        return {
          success: false,
          error: 'Excel parsing timeout - possible attack',
        };
      }

      const firstSheet = parsedWorkbook.worksheets[0];
      if (!firstSheet) {
        return {
          success: false,
          error: 'Excel file contains no sheets',
        };
      }

      // Convert to JSON
      const jsonData: any[] = [];
      let headers: string[] = [];
      
      firstSheet.eachRow((row, rowNumber) => {
        const values = row.values as any[];
        const cleanValues = values.slice(1).map(val => {
          if (val === null || val === undefined) return '';
          if (typeof val === 'object' && 'text' in val) return val.text;
          if (typeof val === 'object' && 'result' in val) return val.result;
          return val;
        });

        if (rowNumber === 1) {
          // First row is headers
          headers = cleanValues.map(String);
        } else {
          // Create object from row data
          const rowObj: any = {};
          cleanValues.forEach((value, index) => {
            const header = headers[index] || `Column${index + 1}`;
            rowObj[header] = value;
          });
          jsonData.push(rowObj);
        }
      });

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
          sheetCount: parsedWorkbook.worksheets.length,
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
export const secureExcelParser = new SecureExcelParser();
