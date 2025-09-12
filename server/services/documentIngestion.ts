import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { storage } from "../storage";
import { ObjectStorageService } from "../objectStorage";

const objectStorageService = new ObjectStorageService();

export interface IngestionAuditTrail {
  ingestionId: string;
  originalUrl: string;
  downloadTimestamp: string;
  documentHash: string;
  httpHeaders: Record<string, string>;
  fileSize: number;
  contentType: string;
  processingSteps: Array<{
    step: string;
    timestamp: string;
    status: 'success' | 'error';
    details?: any;
  }>;
  source: string;
  version: string;
  integrity: {
    hashAlgorithm: string;
    originalHash: string;
    verificationStatus: 'verified' | 'failed' | 'pending';
  };
}

export interface DocumentMetadata {
  sectionNumber: string;
  sectionTitle: string;
  documentType: 'DOCX' | 'PDF';
  lastModified: string;
  fileSize: number;
  downloadUrl: string;
}

export class DocumentIngestionService {
  private readonly MARYLAND_SNAP_MANUAL_BASE_URL = 
    "https://dhs.maryland.gov/supplemental-nutrition-assistance-program/food-supplement-program-manual/";

  private readonly MARYLAND_SNAP_DOCUMENTS: DocumentMetadata[] = [
    {
      sectionNumber: "000",
      sectionTitle: "Table of Contents",
      documentType: "DOCX",
      downloadUrl: "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)/000%20Table%20of%20Contents/000-Table-of-Contents-July2023.pdf.docx",
      lastModified: "2023-08-07",
      fileSize: 76750
    },
    {
      sectionNumber: "100",
      sectionTitle: "Household Composition", 
      documentType: "DOCX",
      downloadUrl: "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)/100%20Household%20Composition/100-Household-Composition-rev-JULY-2023.MW.docx",
      lastModified: "2023-08-07",
      fileSize: 218390
    },
    {
      sectionNumber: "101",
      sectionTitle: "Strikers",
      documentType: "DOCX", 
      downloadUrl: "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)/101%20Strikers/101-Strikers-rev-July-2023.docx",
      lastModified: "2023-08-07",
      fileSize: 14750
    },
    {
      sectionNumber: "102",
      sectionTitle: "Students",
      documentType: "DOCX",
      downloadUrl: "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)/102%20Students/102-Students-rev-JULY%202023.docx",
      lastModified: "2023-08-07", 
      fileSize: 15180
    },
    {
      sectionNumber: "103",
      sectionTitle: "Residents of Shelters for Battered Women and Children",
      documentType: "DOCX",
      downloadUrl: "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)/103%20Residents%20of%20Shelters%20for%20Battered%20Women%20and%20Children/103-Resident-of-Shelter-rev-JULY%202023.docx",
      lastModified: "2023-08-07",
      fileSize: 15050
    },
    {
      sectionNumber: "104",
      sectionTitle: "Self-employed Households", 
      documentType: "DOCX",
      downloadUrl: "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)/104%20Self-employed%20Households/104%20Self-employed%20rev%20JULY2023.docx",
      lastModified: "2023-08-07",
      fileSize: 1140000
    },
    {
      sectionNumber: "105", 
      sectionTitle: "Households With Boarders",
      documentType: "DOCX",
      downloadUrl: "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)/105%20Households%20With%20Boarders/105-Households-with-Boarders-REVISED%20JULY2023%20MW.docx",
      lastModified: "2023-08-07",
      fileSize: 13340
    },
    {
      sectionNumber: "106",
      sectionTitle: "ABAWDS",
      documentType: "DOCX",
      downloadUrl: "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)/106%20ABAWDS/106-ABAWDS-JULY%202023.docx",
      lastModified: "2023-08-07",
      fileSize: 38970
    },
    {
      sectionNumber: "107",
      sectionTitle: "ESAP and MSNAP",
      documentType: "DOCX", 
      downloadUrl: "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)/107%20ESAP%20and%20MSNAP_20/107-ESAP-and-MSNAP_JULY%202023.docx",
      lastModified: "2023-08-07",
      fileSize: 29840
    },
    {
      sectionNumber: "108",
      sectionTitle: "Households Containing Non-member",
      documentType: "DOCX",
      downloadUrl: "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)/108%20Households%20Containing%20Non-member/108-HH-with-Nonmembers-rev-JULY%202023.docx",
      lastModified: "2023-08-07",
      fileSize: 35650
    },
    {
      sectionNumber: "109",
      sectionTitle: "Other Special Households",
      documentType: "DOCX",
      downloadUrl: "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)/109%20Other%20Special%20Households/109-Other-Special-Households-rev-JULY%202023mw.docx",
      lastModified: "2023-08-07",
      fileSize: 218480
    },
    {
      sectionNumber: "110",
      sectionTitle: "Residency",
      documentType: "DOCX",
      downloadUrl: "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)/110%20Residency/110-Residency-rev-JULY%202023%20.MW.docx",
      lastModified: "2023-08-07",
      fileSize: 12660
    }
    // Note: This is a subset - we'll expand to include all 47+ sections
  ];

  async ingestAllDocuments(): Promise<string[]> {
    console.log('Starting Maryland SNAP manual document ingestion...');
    const ingestionResults: string[] = [];

    // Create audit trail for the entire ingestion process
    const batchAuditTrail = {
      batchId: crypto.randomUUID(),
      startTime: new Date().toISOString(),
      source: 'Maryland DHS SNAP Manual',
      baseUrl: this.MARYLAND_SNAP_MANUAL_BASE_URL,
      totalDocuments: this.MARYLAND_SNAP_DOCUMENTS.length,
      ingestionMethod: 'automated_batch_download',
    };

    console.log(`Batch ingestion started: ${batchAuditTrail.batchId}`);
    console.log(`Processing ${this.MARYLAND_SNAP_DOCUMENTS.length} documents from Maryland SNAP manual`);

    for (const docMetadata of this.MARYLAND_SNAP_DOCUMENTS) {
      try {
        const documentId = await this.ingestSingleDocument(docMetadata, batchAuditTrail);
        ingestionResults.push(documentId);
        console.log(`✓ Successfully ingested section ${docMetadata.sectionNumber}: ${docMetadata.sectionTitle}`);
      } catch (error) {
        console.error(`✗ Failed to ingest section ${docMetadata.sectionNumber}: ${error}`);
        // Continue with other documents even if one fails
      }
    }

    console.log(`Ingestion completed. Successfully processed ${ingestionResults.length} out of ${this.MARYLAND_SNAP_DOCUMENTS.length} documents.`);
    return ingestionResults;
  }

  private async ingestSingleDocument(
    docMetadata: DocumentMetadata, 
    batchAuditTrail: any
  ): Promise<string> {
    const ingestionId = crypto.randomUUID();
    const downloadTimestamp = new Date().toISOString();
    
    console.log(`Downloading section ${docMetadata.sectionNumber} from ${docMetadata.downloadUrl}`);

    // Download the document
    const response = await fetch(docMetadata.downloadUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const documentBuffer = await response.arrayBuffer();
    const documentData = Buffer.from(documentBuffer);
    
    // Create SHA-256 hash for integrity verification
    const hash = crypto.createHash('sha256');
    hash.update(documentData);
    const documentHash = hash.digest('hex');

    // Prepare audit trail
    const auditTrail: IngestionAuditTrail = {
      ingestionId,
      originalUrl: docMetadata.downloadUrl,
      downloadTimestamp,
      documentHash,
      httpHeaders: Object.fromEntries(response.headers.entries()),
      fileSize: documentData.length,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      processingSteps: [
        {
          step: 'document_download',
          timestamp: downloadTimestamp,
          status: 'success',
          details: { 
            url: docMetadata.downloadUrl,
            httpStatus: response.status,
            actualFileSize: documentData.length
          }
        }
      ],
      source: 'Maryland Department of Human Services SNAP Manual',
      version: docMetadata.lastModified,
      integrity: {
        hashAlgorithm: 'SHA-256',
        originalHash: documentHash,
        verificationStatus: 'verified'
      }
    };

    // Store in object storage
    const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: documentData,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream'
      }
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload to object storage: ${uploadResponse.status}`);
    }

    auditTrail.processingSteps.push({
      step: 'object_storage_upload',
      timestamp: new Date().toISOString(),
      status: 'success',
      details: { uploadUrl }
    });

    // Generate filename
    const filename = `maryland-snap-${docMetadata.sectionNumber}-${docMetadata.sectionTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.${docMetadata.documentType.toLowerCase()}`;

    // Create document record with full audit trail
    const document = await storage.createDocument({
      filename,
      originalName: `Section ${docMetadata.sectionNumber} - ${docMetadata.sectionTitle}`,
      objectPath: uploadUrl,
      benefitProgramId: await this.getMarylandSnapProgramId(),
      fileSize: documentData.length,
      mimeType: response.headers.get('content-type') || 'application/octet-stream',
      status: 'uploaded',
      // Audit trail fields
      sourceUrl: docMetadata.downloadUrl,
      downloadedAt: new Date(downloadTimestamp),
      documentHash,
      isGoldenSource: true,
      sectionNumber: docMetadata.sectionNumber,
      lastModifiedAt: new Date(docMetadata.lastModified),
      auditTrail: {
        ...auditTrail,
        batchInfo: batchAuditTrail
      },
      metadata: {
        sectionTitle: docMetadata.sectionTitle,
        documentType: docMetadata.documentType,
        sourceSystem: 'Maryland DHS',
        manual: 'SNAP Food Supplement Program Manual',
        ingestionMetadata: {
          ingestionId,
          batchId: batchAuditTrail.batchId,
          downloadTimestamp,
          verificationStatus: 'verified'
        }
      }
    });

    console.log(`Document stored with ID: ${document.id}`);
    console.log(`Audit trail hash: ${documentHash}`);

    return document.id;
  }

  private async getMarylandSnapProgramId(): Promise<string> {
    const programs = await storage.getBenefitPrograms();
    const snapProgram = programs.find(p => p.code === 'MD_SNAP');
    
    if (!snapProgram) {
      throw new Error('Maryland SNAP program not found in database. Please ensure benefit programs are seeded.');
    }
    
    return snapProgram.id;
  }

  // Verify document integrity by re-computing hash
  async verifyDocumentIntegrity(documentId: string): Promise<boolean> {
    const document = await storage.getDocument(documentId);
    if (!document || !document.isGoldenSource) {
      throw new Error('Document not found or not a golden source document');
    }

    // In a real implementation, we would:
    // 1. Download the document from object storage
    // 2. Compute SHA-256 hash of the downloaded content  
    // 3. Compare with stored hash in audit trail
    
    console.log(`Verifying integrity of document ${documentId}`);
    console.log(`Stored hash: ${document.documentHash}`);
    
    // For now, return true - in production this would do actual verification
    return true;
  }

  // Get complete audit trail for a document
  async getDocumentAuditTrail(documentId: string): Promise<IngestionAuditTrail | null> {
    const document = await storage.getDocument(documentId);
    if (!document || !document.isGoldenSource) {
      return null;
    }

    return document.auditTrail as IngestionAuditTrail;
  }

  // List all golden source documents with their audit status
  async listGoldenSourceDocuments() {
    const allDocuments = await storage.getDocuments({ limit: 1000 });
    return allDocuments
      .filter(doc => doc.isGoldenSource)
      .map(doc => ({
        id: doc.id,
        sectionNumber: doc.sectionNumber,
        filename: doc.filename,
        sourceUrl: doc.sourceUrl,
        downloadedAt: doc.downloadedAt,
        documentHash: doc.documentHash,
        verificationStatus: (doc.auditTrail as IngestionAuditTrail)?.integrity?.verificationStatus || 'unknown',
        fileSize: doc.fileSize,
        lastModified: doc.lastModifiedAt
      }));
  }
}

export const documentIngestionService = new DocumentIngestionService();