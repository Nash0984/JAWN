import Papa from 'papaparse';
import { nanoid } from 'nanoid';
import type { InsertEeDataset, InsertEeDatasetFile, InsertEeClient } from '@shared/schema';
import { ObjectStorageService } from '../objectStorage';
import { storage } from '../storage';
import { secureXlsxParser } from '../utils/secureXlsxParser';
import { logger } from './logger.service';

const objectStorage = new ObjectStorageService();

interface ParsedEeClient {
  clientId: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  ssn4?: string;
  enrolledProgramId: string;
  enrolledProgramName?: string;
  enrollmentDate?: string;
  householdSize?: number;
  householdIncome?: number;
  address?: string;
  city?: string;
  zipCode?: string;
  phoneNumber?: string;
  email?: string;
}

interface FileUploadResult {
  dataset: any;
  datasetFile: any;
  clientsImported: number;
  errors: string[];
  warnings: string[];
}

export class EeFileUploadService {
  private readonly REQUIRED_COLUMNS = [
    'clientId',
    'enrolledProgramId'
  ];

  private readonly OPTIONAL_COLUMNS = [
    'firstName',
    'lastName',
    'dateOfBirth',
    'ssn4',
    'enrolledProgramName',
    'enrollmentDate',
    'householdSize',
    'householdIncome',
    'address',
    'city',
    'zipCode',
    'phoneNumber',
    'email'
  ];

  async uploadAndProcessFile(params: {
    file: Buffer;
    fileName: string;
    mimeType: string;
    dataSource: string;
    uploadedBy: string;
    retentionDays?: number;
  }): Promise<FileUploadResult> {
    const { file, fileName, mimeType, dataSource, uploadedBy, retentionDays = 90 } = params;
    
    const errors: string[] = [];
    const warnings: string[] = [];

    // Step 1: Parse CSV/Excel file
    const parseResult = await this.parseFile(file, mimeType);
    if (!parseResult.success) {
      throw new Error(`File parsing failed: ${parseResult.error}`);
    }

    const rows = parseResult.data!;

    // Step 2: Validate file structure
    const validationResult = this.validateFileStructure(rows);
    if (!validationResult.isValid) {
      throw new Error(`File validation failed: ${validationResult.errors.join(', ')}`);
    }

    errors.push(...validationResult.errors);
    warnings.push(...validationResult.warnings);

    // Step 3: Upload file to GCS
    const objectPath = await this.uploadToGCS(file, fileName, dataSource);

    // Step 4: Create dataset record
    const dataset = await storage.createEeDataset({
      name: `${dataSource} - ${new Date().toLocaleDateString()}`,
      description: `Uploaded from ${fileName}`,
      dataSource,
      uploadedBy,
      totalRecords: rows.length,
      validRecords: rows.length - errors.length,
      invalidRecords: errors.length,
      processingStatus: 'completed',
      retentionPolicyDays: retentionDays,
      isActive: false, // Admin must manually activate
    } as InsertEeDataset);

    // Step 5: Create dataset file record
    const datasetFile = await storage.createEeDatasetFile({
      datasetId: dataset.id,
      filename: fileName,
      originalName: fileName,
      objectPath,
      fileSize: file.length,
      mimeType,
      uploadedBy,
    } as InsertEeDatasetFile);

    // Step 5b: Create upload audit event
    await storage.createCrossEnrollmentAuditEvent({
      datasetId: dataset.id,
      eventType: 'dataset_uploaded',
      eventCategory: 'admin',
      actionTaken: 'Upload E&E dataset',
      actionResult: 'success',
      userRole: 'admin',
      userId: uploadedBy,
      metadata: {
        fileName,
        fileSize: file.length,
        mimeType,
        dataSource,
        totalRecords: rows.length,
      },
    });

    // Step 6: Import client records
    let clientsImported = 0;
    for (const row of rows) {
      try {
        const eeClient = await this.createEeClientFromRow(row, dataset.id);
        await storage.createEeClient(eeClient);
        clientsImported++;
      } catch (err) {
        errors.push(`Row error for clientId ${row.clientId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Step 7: Update dataset with final counts
    await storage.updateEeDataset(dataset.id, {
      validRecords: clientsImported,
      invalidRecords: rows.length - clientsImported,
      processingError: errors.length > 0 ? errors.join('; ') : undefined,
    });

    return {
      dataset,
      datasetFile,
      clientsImported,
      errors,
      warnings,
    };
  }

  private async parseFile(fileBuffer: Buffer, mimeType: string): Promise<{
    success: boolean;
    data?: ParsedEeClient[];
    error?: string;
  }> {
    try {
      let csvContent: string;

      // Check if file is Excel format
      const isExcel = mimeType.includes('spreadsheet') || 
                      mimeType.includes('excel') || 
                      mimeType.includes('ms-excel') ||
                      mimeType.includes('vnd.openxmlformats');

      if (isExcel) {
        // Parse Excel file using SECURE wrapper (mitigates GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9)
        const parseResult = await secureXlsxParser.parseExcelToCSV(fileBuffer, {
          maxFileSizeBytes: 5 * 1024 * 1024, // 5MB limit
          maxParsingTimeMs: 5000, // 5 second timeout (ReDoS protection)
          allowedSheets: 10,
        });

        if (!parseResult.success) {
          logger.error('Secure Excel parsing failed', {
            error: parseResult.error,
            fileSizeBytes: fileBuffer.length,
          });
          return { success: false, error: parseResult.error };
        }

        // Log warnings if any (e.g., long processing time)
        if (parseResult.warnings && parseResult.warnings.length > 0) {
          logger.warn('Excel parsing warnings', {
            warnings: parseResult.warnings,
            metadata: parseResult.metadata,
          });
        }

        csvContent = parseResult.data as string;
      } else {
        // Assume CSV format
        csvContent = fileBuffer.toString('utf-8');
      }

      // Use Papa Parse for CSV
      const parseResult = Papa.parse<ParsedEeClient>(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim(),
      });

      if (parseResult.errors.length > 0) {
        const errorMessages = parseResult.errors.map(e => `${e.message} (row ${e.row})`).join('; ');
        return { success: false, error: `Parsing errors: ${errorMessages}` };
      }

      return { success: true, data: parseResult.data };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown parsing error' 
      };
    }
  }

  private validateFileStructure(rows: ParsedEeClient[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (rows.length === 0) {
      errors.push('File contains no data rows');
      return { isValid: false, errors, warnings };
    }

    // Check required columns exist
    const firstRow = rows[0];
    const presentColumns = Object.keys(firstRow);
    
    for (const requiredCol of this.REQUIRED_COLUMNS) {
      if (!presentColumns.includes(requiredCol)) {
        errors.push(`Missing required column: ${requiredCol}`);
      }
    }

    // Check for duplicate clientIds
    const clientIds = new Set<string>();
    const duplicates: string[] = [];
    
    rows.forEach((row, idx) => {
      if (!row.clientId) {
        errors.push(`Row ${idx + 1}: Missing clientId`);
      } else if (clientIds.has(row.clientId)) {
        duplicates.push(row.clientId);
      } else {
        clientIds.add(row.clientId);
      }
    });

    if (duplicates.length > 0) {
      errors.push(`Duplicate clientIds found: ${duplicates.slice(0, 5).join(', ')}${duplicates.length > 5 ? '...' : ''}`);
    }

    // Warnings for optional but recommended fields
    const firstRowMissingFields = [];
    if (!firstRow.firstName) firstRowMissingFields.push('firstName');
    if (!firstRow.lastName) firstRowMissingFields.push('lastName');
    if (!firstRow.dateOfBirth && !firstRow.ssn4) {
      warnings.push('No dateOfBirth or ssn4 fields found - matching quality may be limited');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async uploadToGCS(fileBuffer: Buffer, fileName: string, dataSource: string): Promise<string> {
    const privateDir = objectStorage.getPrivateObjectDir();
    const sanitizedSource = dataSource.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileId = nanoid(10);
    
    // Path format: /.private/ee-datasets/{dataSource}/{timestamp}_{fileId}_{fileName}
    const objectPath = `${privateDir}/ee-datasets/${sanitizedSource}/${timestamp}_${fileId}_${fileName}`;
    
    // Note: In production, this file would be uploaded to GCS directly
    // For now, we just return the path where it would be stored
    // The actual GCS upload would happen through the signed URL mechanism
    
    return objectPath;
  }

  private async createEeClientFromRow(row: ParsedEeClient, datasetId: string): Promise<InsertEeClient> {
    // Validate and transform data
    const householdSize = row.householdSize ? parseInt(String(row.householdSize), 10) : undefined;
    const householdIncome = row.householdIncome ? parseFloat(String(row.householdIncome)) : undefined;

    // Parse date if provided
    let dateOfBirth: Date | undefined;
    if (row.dateOfBirth) {
      const parsed = new Date(row.dateOfBirth);
      if (!isNaN(parsed.getTime())) {
        dateOfBirth = parsed;
      }
    }

    // Combine first and last name, or use a default
    const clientName = [row.firstName, row.lastName].filter(Boolean).join(' ') || row.clientId;
    const ssnLast4 = row.ssn4 || '0000'; // Default if not provided

    return {
      datasetId,
      clientName, // Required: combined first + last name
      ssnLast4,   // Required: SSN last 4 digits
      dateOfBirth,
      enrolledProgramId: row.enrolledProgramId,
      householdSize,
      householdIncome,
      matchStatus: 'pending',
      matchConfidenceScore: 0,
      rawDataRow: row, // Store original data for reference
    } as InsertEeClient;
  }

  async activateDataset(datasetId: string, userId: string): Promise<void> {
    // Deactivate all other datasets from the same source first
    const dataset = await storage.getEeDataset(datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    const existingDatasets = await storage.getEeDatasets({ 
      dataSource: dataset.dataSource,
      isActive: true 
    });

    // Deactivate old datasets
    for (const oldDataset of existingDatasets) {
      await storage.updateEeDataset(oldDataset.id, { isActive: false });
      
      // Create audit event
      await storage.createCrossEnrollmentAuditEvent({
        datasetId: oldDataset.id,
        eventType: 'dataset_deactivated',
        eventCategory: 'admin',
        actionTaken: 'Deactivate dataset',
        actionResult: 'success',
        userRole: 'admin',
        userId,
        metadata: {
          reason: 'New dataset activated',
          newDatasetId: datasetId,
        },
      });
    }

    // Activate the new dataset
    await storage.updateEeDataset(datasetId, { isActive: true });

    // Create audit event
    await storage.createCrossEnrollmentAuditEvent({
      datasetId,
      eventType: 'dataset_activated',
      eventCategory: 'admin',
      actionTaken: 'Activate dataset',
      actionResult: 'success',
      userRole: 'admin',
      userId,
      metadata: {
        totalRecords: dataset.totalRecords,
        validRecords: dataset.validRecords,
      },
    });
  }

  async deactivateDataset(datasetId: string, userId: string): Promise<void> {
    await storage.updateEeDataset(datasetId, { isActive: false });

    await storage.createCrossEnrollmentAuditEvent({
      datasetId,
      eventType: 'dataset_deactivated',
      eventCategory: 'admin',
      actionTaken: 'Deactivate dataset',
      actionResult: 'success',
      userRole: 'admin',
      userId,
      metadata: {
        reason: 'Manual deactivation',
      },
    });
  }

  async deleteDataset(datasetId: string, userId: string): Promise<void> {
    const dataset = await storage.getEeDataset(datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    // Create audit event before deletion
    await storage.createCrossEnrollmentAuditEvent({
      datasetId,
      eventType: 'dataset_deleted',
      eventCategory: 'admin',
      actionTaken: 'Delete dataset',
      actionResult: 'success',
      userRole: 'admin',
      userId,
      metadata: {
        dataSource: dataset.dataSource,
        totalRecords: dataset.totalRecords,
        uploadedAt: dataset.createdAt,
      },
    });

    // Delete dataset (cascade will handle related records)
    await storage.deleteEeDataset(datasetId);
  }
}

export const eeFileUploadService = new EeFileUploadService();
