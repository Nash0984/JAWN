import axios from 'axios';
import { db } from '../db';
import { documents, benefitPrograms, documentTypes } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { InsertDocument } from '@shared/schema';
import { ObjectStorageService } from '../objectStorage';
import { logger } from './logger.service';

interface IRSPublication {
  number: string;
  name: string;
  url: string;
  type: 'publication' | 'form';
  minRevisionYear?: number;
  revisionMonth?: number;
  description: string;
}

/**
 * IRS Direct Download Service
 * Downloads IRS VITA publications directly from irs.gov using predictable URL patterns
 * Replaces web scraping with official PDF downloads
 */
export class IRSDirectDownloader {
  private readonly IRS_PDF_BASE_URL = 'https://www.irs.gov/pub/irs-pdf';
  
  // IRS VITA publications with predictable URL patterns
  private readonly VITA_PUBLICATIONS: IRSPublication[] = [
    {
      number: 'p4012',
      name: 'IRS Pub 4012 - VITA/TCE Volunteer Resource Guide',
      url: `${this.IRS_PDF_BASE_URL}/p4012.pdf`,
      type: 'publication',
      minRevisionYear: 2025,
      description: 'Primary VITA reference guide for volunteer tax preparation (2025 tax year)',
    },
    {
      number: 'p4491',
      name: 'IRS Pub 4491 - VITA/TCE Training Guide',
      url: `${this.IRS_PDF_BASE_URL}/p4491.pdf`,
      type: 'publication',
      minRevisionYear: 2025,
      description: 'Core VITA training guide with lessons for all certification levels (2025 tax year)',
    },
    {
      number: 'p4491x',
      name: 'IRS Pub 4491-X - VITA/TCE Training Supplement',
      url: `${this.IRS_PDF_BASE_URL}/p4491x.pdf`,
      type: 'publication',
      minRevisionYear: 2025,
      revisionMonth: 1,
      description: 'Updates to VITA training materials after initial printing (Rev. 1-2025)',
    },
    {
      number: 'p4961',
      name: 'IRS Pub 4961 - VITA/TCE Volunteer Standards of Conduct',
      url: `${this.IRS_PDF_BASE_URL}/p4961.pdf`,
      type: 'publication',
      minRevisionYear: 2025,
      revisionMonth: 5,
      description: 'Required ethics training for all VITA volunteers (Rev. 5-2025)',
    },
    {
      number: 'f6744',
      name: 'IRS Form 6744 - VITA/TCE Volunteer Assistor Test/Retest',
      url: `${this.IRS_PDF_BASE_URL}/f6744.pdf`,
      type: 'form',
      minRevisionYear: 2025,
      description: 'Practice scenarios and certification test questions (2025 tax returns)',
    },
    {
      number: 'p17',
      name: 'IRS Pub 17 - Your Federal Income Tax',
      url: `${this.IRS_PDF_BASE_URL}/p17.pdf`,
      type: 'publication',
      minRevisionYear: 2024,
      description: 'Comprehensive individual tax guide covering filing requirements, income types, deductions, and credits (2024 tax year)',
    },
    {
      number: 'p596',
      name: 'IRS Pub 596 - Earned Income Credit (EIC)',
      url: `${this.IRS_PDF_BASE_URL}/p596.pdf`,
      type: 'publication',
      minRevisionYear: 2024,
      description: 'Comprehensive EITC guide with eligibility rules, calculation tables, qualifying child requirements, and examples (2024 tax year)',
    },
    {
      number: 'p972',
      name: 'IRS Pub 972 - Child Tax Credit and Credit for Other Dependents',
      url: `${this.IRS_PDF_BASE_URL}/p972.pdf`,
      type: 'publication',
      minRevisionYear: 2024,
      description: 'CTC and ODC guide covering eligibility, calculation, phase-out thresholds, and Additional Child Tax Credit (2024 tax year)',
    },
  ];

  /**
   * Download all VITA publications
   */
  async downloadAllVITAPublications(): Promise<string[]> {
    logger.info('Starting IRS VITA Direct Download Service', {
      service: 'IRSDirectDownloader'
    });
    
    const vitaProgramId = await this.getVITAProgramId();
    const allDocumentIds: string[] = [];
    
    for (const publication of this.VITA_PUBLICATIONS) {
      try {
        const documentIds = await this.downloadPublication(publication, vitaProgramId);
        allDocumentIds.push(...documentIds);
      } catch (error) {
        logger.error('Error downloading publication', {
          service: 'IRSDirectDownloader',
          publicationName: publication.name,
          publicationNumber: publication.number,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    logger.info('IRS VITA download complete', {
      service: 'IRSDirectDownloader',
      documentsProcessed: allDocumentIds.length
    });
    return allDocumentIds;
  }

  /**
   * Download a specific IRS publication
   */
  async downloadPublication(publication: IRSPublication, vitaProgramId: string): Promise<string[]> {
    logger.info('Downloading publication', {
      service: 'IRSDirectDownloader',
      publicationName: publication.name,
      publicationNumber: publication.number
    });
    
    try {
      // Download PDF
      const response = await axios.get(publication.url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0',
        },
      });
      
      const pdfBuffer = Buffer.from(response.data);
      const lastModifiedHeader = response.headers['last-modified'];
      const remoteLastModified = lastModifiedHeader ? new Date(lastModifiedHeader) : new Date();
      
      // Extract revision information
      const revisionInfo = await this.extractRevisionInfo(pdfBuffer);
      
      // Check if we need to download/update
      const existingDocs = await db.select()
        .from(documents)
        .where(
          and(
            eq(documents.benefitProgramId, vitaProgramId),
            eq(documents.filename, `${publication.number}.pdf`)
          )
        )
        .limit(1);
      
      const existingDoc = existingDocs[0];
      
      // Skip if document exists and is current
      if (existingDoc && existingDoc.lastModifiedAt && existingDoc.lastModifiedAt >= remoteLastModified) {
        logger.info('Skipping publication - already current', {
          service: 'IRSDirectDownloader',
          publicationName: publication.name
        });
        return [existingDoc.id];
      }
      
      // Upload PDF to object storage
      const objectStorageService = new ObjectStorageService();
      const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: pdfBuffer,
        headers: {
          'Content-Type': 'application/pdf',
        },
      });
      
      if (!uploadResponse.ok) {
        logger.error('Upload failed for publication', {
          service: 'IRSDirectDownloader',
          publicationName: publication.name,
          statusText: uploadResponse.statusText
        });
        return [];
      }
      
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
      
      // Extract text for RAG processing
      // Use createRequire to load CommonJS pdf-parse in ESM
      const { createRequire } = (await import('module')) as any;
      const require = createRequire(import.meta.url);
      const pdfParseModule = require('pdf-parse');
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const pdfData = await pdfParse(pdfBuffer);
      const pdfText = pdfData.text;
      
      if (existingDoc) {
        // Update existing document
        const [updatedDoc] = await db.update(documents)
          .set({
            objectPath: objectPath,
            fileSize: pdfBuffer.length,
            lastModifiedAt: remoteLastModified,
            downloadedAt: new Date(),
            updatedAt: new Date(),
            status: 'uploaded',
            metadata: {
              publicationNumber: publication.number,
              publicationType: publication.type,
              revisionInfo: revisionInfo,
              source: 'IRS Direct Download',
              url: publication.url,
            },
          })
          .where(eq(documents.id, existingDoc.id))
          .returning();
        
        // Re-process through RAG pipeline
        const { documentProcessor } = await import('./documentProcessor');
        await documentProcessor.processDocument(updatedDoc.id);
        
        logger.info('Updated publication', {
          service: 'IRSDirectDownloader',
          publicationName: publication.name,
          revisionInfo: revisionInfo || 'Latest version'
        });
        return [updatedDoc.id];
      } else {
        // Create new document record
        const docRecord: Partial<InsertDocument> = {
          filename: `${publication.number}.pdf`,
          originalName: publication.name,
          objectPath: objectPath,
          documentTypeId: await this.getDocumentTypeId('POLICY_MANUAL'),
          benefitProgramId: vitaProgramId,
          fileSize: pdfBuffer.length,
          mimeType: 'application/pdf',
          status: 'uploaded',
          sourceUrl: publication.url,
          downloadedAt: new Date(),
          isGoldenSource: true,
          lastModifiedAt: remoteLastModified,
          metadata: {
            publicationNumber: publication.number,
            publicationType: publication.type,
            revisionInfo: revisionInfo,
            source: 'IRS Direct Download',
            url: publication.url,
            description: publication.description,
          },
        };
        
        // Store in database
        const [doc] = await db.insert(documents).values(docRecord as InsertDocument).returning();
        
        // Process through RAG pipeline
        const { documentProcessor } = await import('./documentProcessor');
        await documentProcessor.processDocument(doc.id);
        
        logger.info('Created publication', {
          service: 'IRSDirectDownloader',
          publicationName: publication.name,
          revisionInfo: revisionInfo || 'Latest version'
        });
        return [doc.id];
      }
    } catch (error) {
      logger.error('Error downloading publication', {
        service: 'IRSDirectDownloader',
        publicationName: publication.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Extract revision information from PDF
   */
  private async extractRevisionInfo(pdfBuffer: Buffer): Promise<string | null> {
    try {
      // Use createRequire to load CommonJS pdf-parse in ESM
      const { createRequire } = (await import('module')) as any;
      const require = createRequire(import.meta.url);
      const pdfParseModule = require('pdf-parse');
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const pdfData = await pdfParse(pdfBuffer);
      const pdfText = pdfData.text;
      
      // Look for revision patterns
      const revisionPatterns = [
        /Rev(?:ision)?\.?\s+(\d+)-(\d{4})/i,  // Rev. 1-2025
        /Rev(?:ision)?\.?\s+(\d{4})/i,        // Rev. 2025
        /\((\d{4})\s+tax\s+returns?\)/i,      // (2025 tax returns)
        /Tax\s+Year\s+(\d{4})/i,              // Tax Year 2025
        /For\s+(\d{4})/i,                     // For 2025
      ];
      
      for (const pattern of revisionPatterns) {
        const match = pdfText.match(pattern);
        if (match) {
          return match[0].trim();
        }
      }
      
      // Fallback to PDF metadata
      if (pdfData.metadata) {
        const modDate = pdfData.metadata.ModDate || pdfData.metadata.CreationDate;
        if (modDate) {
          const dateMatch = modDate.match(/D:(\d{4})(\d{2})/);
          if (dateMatch) {
            return `${dateMatch[1]}-${dateMatch[2]}`;
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error extracting revision info', {
        service: 'IRSDirectDownloader',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Get VITA program ID
   */
  private async getVITAProgramId(): Promise<string> {
    const programs = await db.select().from(benefitPrograms);
    const vitaProgram = programs.find(
      (p: typeof benefitPrograms.$inferSelect) => p.code === 'VITA' || 
           p.code === 'MD_VITA' || 
           p.name?.toLowerCase().includes('vita')
    );
    
    if (!vitaProgram) {
      throw new Error('VITA benefit program not found. Please seed benefit programs first.');
    }
    
    return vitaProgram.id;
  }

  /**
   * Get document type ID
   */
  private async getDocumentTypeId(code: string): Promise<string> {
    const types = await db.select().from(documentTypes);
    const docType = types.find((t: typeof documentTypes.$inferSelect) => t.code === code);
    
    if (!docType) {
      throw new Error(`Document type ${code} not found. Please seed document types first.`);
    }
    
    return docType.id;
  }
}

// Export singleton instance
export const irsDirectDownloader = new IRSDirectDownloader();
