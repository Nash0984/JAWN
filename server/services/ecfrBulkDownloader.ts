import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { documentProcessor } from './documentProcessor';
import type { Document, InsertDocument } from '@shared/schema';
import { db } from '../db';
import { documents, policySources } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * eCFR Bulk Downloader Service
 * 
 * Downloads official SNAP regulations (7 CFR Part 273) from GovInfo bulk XML repository
 * instead of web scraping. Provides authoritative, structured data directly from the
 * Electronic Code of Federal Regulations.
 * 
 * Data Source: https://www.govinfo.gov/bulkdata/ECFR/title-7/
 * Format: Official USLM XML (United States Legislative Markup)
 * Coverage: Complete Title 7 CFR with daily updates
 */

interface ECFRDownloadResult {
  success: boolean;
  documentIds: string[];
  sectionsProcessed: number;
  error?: string;
}

interface ECFRSection {
  number: string;
  subject: string;
  content: string;
  xmlStructure: any;
}

class ECFRBulkDownloader {
  private readonly ECFR_TITLE_7_URL = 'https://www.govinfo.gov/bulkdata/ECFR/title-7/ECFR-title7.xml';
  private readonly SNAP_PART = '273'; // 7 CFR Part 273
  
  /**
   * Download and process 7 CFR Part 273 (SNAP regulations)
   */
  async downloadSNAPRegulations(benefitProgramId?: string): Promise<ECFRDownloadResult> {
    try {
      console.log('📥 Downloading 7 CFR Title 7 from GovInfo...');
      
      // Download XML
      const response = await axios.get(this.ECFR_TITLE_7_URL, {
        timeout: 300000, // 5 minutes for 41MB file
        responseType: 'text',
      });
      
      console.log('✅ Downloaded Title 7 CFR XML, parsing...');
      
      // Parse XML
      const parsed = await parseStringPromise(response.data, {
        trim: true,
        explicitArray: false,
        mergeAttrs: true,
      });
      
      // Extract Part 273 sections
      const sections = this.extractPart273Sections(parsed);
      console.log(`📄 Extracted ${sections.length} sections from Part 273`);
      
      // Process each section through documentProcessor
      const documentIds: string[] = [];
      
      // Get last modified timestamp for update comparison
      const headResponse = await axios.head(this.ECFR_TITLE_7_URL);
      const lastModifiedHeader = headResponse.headers['last-modified'];
      const remoteLastModified = lastModifiedHeader ? new Date(lastModifiedHeader) : new Date();
      
      for (const section of sections) {
        // Check for existing section
        const existingDocs = await db.select()
          .from(documents)
          .where(eq(documents.sectionNumber, section.number))
          .limit(1);
        
        const existingDoc = existingDocs[0];
        
        // Skip if section exists and is current
        if (existingDoc && existingDoc.lastModifiedAt && existingDoc.lastModifiedAt >= remoteLastModified) {
          console.log(`⏭️  Skipping 7 CFR § 273.${section.number} - already current`);
          documentIds.push(existingDoc.id);
          continue;
        }
        
        const filename = `7-CFR-273-${section.number}.txt`;
        const buffer = Buffer.from(section.content, 'utf8');
        
        // Upload content to object storage
        const { ObjectStorageService } = await import('../objectStorage');
        const objectStorageService = new ObjectStorageService();
        const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
        
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: buffer,
          headers: {
            'Content-Type': 'text/plain',
          },
        });
        
        if (!uploadResponse.ok) {
          console.error(`❌ Upload failed for section ${section.number}: ${uploadResponse.statusText}`);
          continue;
        }
        
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
        
        if (existingDoc) {
          // Update existing document
          const [updatedDoc] = await db.update(documents)
            .set({
              objectPath: objectPath,
              fileSize: buffer.length,
              lastModifiedAt: remoteLastModified,
              downloadedAt: new Date(),
              updatedAt: new Date(),
              status: 'uploaded',
              metadata: {
                regulation: '7 CFR § 273.' + section.number,
                subject: section.subject,
                source: 'eCFR GovInfo Bulk XML',
                part: this.SNAP_PART,
                title: '7',
              },
            })
            .where(eq(documents.id, existingDoc.id))
            .returning();
          
          // Re-process through RAG pipeline
          await documentProcessor.processDocument(updatedDoc.id);
          documentIds.push(updatedDoc.id);
          console.log(`🔄 Updated 7 CFR § 273.${section.number} - ${section.subject}`);
        } else {
          // Create new document record
          const docRecord: Partial<InsertDocument> = {
            filename: filename,
            originalName: `7 CFR § 273.${section.number} - ${section.subject}`,
            objectPath: objectPath,
            documentTypeId: await this.getDocumentTypeId('POLICY_MANUAL'),
            benefitProgramId: benefitProgramId,
            fileSize: buffer.length,
            mimeType: 'text/plain',
            status: 'uploaded',
            sourceUrl: this.ECFR_TITLE_7_URL,
            downloadedAt: new Date(),
            isGoldenSource: true,
            sectionNumber: section.number,
            lastModifiedAt: remoteLastModified,
            metadata: {
              regulation: '7 CFR § 273.' + section.number,
              subject: section.subject,
              source: 'eCFR GovInfo Bulk XML',
              part: this.SNAP_PART,
              title: '7',
            },
          };
          
          // Store in database
          const [doc] = await db.insert(documents).values(docRecord as InsertDocument).returning();
          
          // Process through RAG pipeline
          await documentProcessor.processDocument(doc.id);
          
          documentIds.push(doc.id);
          console.log(`✅ Created 7 CFR § 273.${section.number} - ${section.subject}`);
        }
      }
      
      // Update policy source sync status
      await this.updatePolicySourceStatus(benefitProgramId, documentIds.length);
      
      return {
        success: true,
        documentIds,
        sectionsProcessed: sections.length,
      };
      
    } catch (error) {
      console.error('❌ Error downloading eCFR:', error);
      return {
        success: false,
        documentIds: [],
        sectionsProcessed: 0,
        error: (error as Error).message,
      };
    }
  }
  
  /**
   * Extract Part 273 (SNAP) sections from parsed XML
   */
  private extractPart273Sections(parsed: any): ECFRSection[] {
    const sections: ECFRSection[] = [];
    
    try {
      // Navigate XML structure to find Part 273
      // XML structure: ECFR > TITLE > SUBTITLE > CHAPTER > SUBCHAPTER > PART > SECTION
      const title = parsed?.ECFR?.TITLE;
      if (!title) {
        console.warn('⚠️ Could not find TITLE in XML structure');
        return sections;
      }
      
      // Find Part 273 within the structure
      const parts = this.findParts(title);
      const part273 = parts.find((p: any) => this.getPartNumber(p) === this.SNAP_PART);
      
      if (!part273) {
        console.warn('⚠️ Could not find Part 273 in XML');
        return sections;
      }
      
      // Extract all sections from Part 273
      const sectionElements = this.findSections(part273);
      
      for (const sectionEl of sectionElements) {
        const section = this.parseSection(sectionEl);
        if (section) {
          sections.push(section);
        }
      }
      
    } catch (error) {
      console.error('❌ Error extracting Part 273 sections:', error);
    }
    
    return sections;
  }
  
  /**
   * Recursively find all PART elements in XML
   */
  private findParts(obj: any): any[] {
    const parts: any[] = [];
    
    if (obj?.PART) {
      if (Array.isArray(obj.PART)) {
        parts.push(...obj.PART);
      } else {
        parts.push(obj.PART);
      }
    }
    
    // Recurse into child elements
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        parts.push(...this.findParts(obj[key]));
      }
    }
    
    return parts;
  }
  
  /**
   * Extract part number from PART element
   */
  private getPartNumber(part: any): string {
    return part?.N || part?.number || part?.NUM || '';
  }
  
  /**
   * Find all SECTION elements within a PART
   */
  private findSections(part: any): any[] {
    const sections: any[] = [];
    
    if (part?.SECTION) {
      if (Array.isArray(part.SECTION)) {
        sections.push(...part.SECTION);
      } else {
        sections.push(part.SECTION);
      }
    }
    
    // Some XML structures nest sections differently
    for (const key in part) {
      if (key.includes('SUBPART') && part[key]?.SECTION) {
        const subpartSections = Array.isArray(part[key].SECTION) 
          ? part[key].SECTION 
          : [part[key].SECTION];
        sections.push(...subpartSections);
      }
    }
    
    return sections;
  }
  
  /**
   * Parse individual SECTION element to extract content
   */
  private parseSection(sectionEl: any): ECFRSection | null {
    try {
      const sectionNumber = sectionEl?.N || sectionEl?.number || sectionEl?.NUM || '';
      const subject = sectionEl?.SUBJECT || sectionEl?.HEAD || '';
      
      // Extract text content recursively
      const content = this.extractTextContent(sectionEl);
      
      if (!sectionNumber || !content) {
        return null;
      }
      
      return {
        number: sectionNumber,
        subject: subject?._ || subject || '',
        content,
        xmlStructure: sectionEl,
      };
    } catch (error) {
      console.error('❌ Error parsing section:', error);
      return null;
    }
  }
  
  /**
   * Recursively extract all text content from XML element
   */
  private extractTextContent(obj: any, depth = 0): string {
    if (typeof obj === 'string') {
      return obj.trim();
    }
    
    if (typeof obj !== 'object' || obj === null) {
      return '';
    }
    
    let text = '';
    
    // Handle text content
    if (obj._ && typeof obj._ === 'string') {
      text += obj._.trim() + ' ';
    }
    
    // Handle P (paragraph), EXTRACT, and other text elements
    const textElements = ['P', 'EXTRACT', 'FP', 'NOTE', 'HD', 'SUBJECT'];
    for (const elem of textElements) {
      if (obj[elem]) {
        const content = Array.isArray(obj[elem]) 
          ? obj[elem].map((e: any) => this.extractTextContent(e, depth + 1)).join('\n')
          : this.extractTextContent(obj[elem], depth + 1);
        text += content + '\n';
      }
    }
    
    // Recurse into other elements (avoid infinite loops)
    if (depth < 10) {
      for (const key in obj) {
        if (!textElements.includes(key) && key !== '_' && typeof obj[key] === 'object') {
          text += this.extractTextContent(obj[key], depth + 1);
        }
      }
    }
    
    return text.trim();
  }
  
  /**
   * Get or create document type ID
   */
  private async getDocumentTypeId(code: string): Promise<string | undefined> {
    const { documentTypes } = await import('@shared/schema');
    const [docType] = await db.select().from(documentTypes).where(eq(documentTypes.code, code)).limit(1);
    return docType?.id;
  }
  
  /**
   * Update policy source sync status
   */
  private async updatePolicySourceStatus(benefitProgramId: string | undefined, count: number): Promise<void> {
    if (!benefitProgramId) return;
    
    try {
      const [source] = await db.select()
        .from(policySources)
        .where(eq(policySources.benefitProgramId, benefitProgramId))
        .limit(1);
      
      if (source) {
        await db.update(policySources)
          .set({
            lastSyncAt: new Date(),
            lastSuccessfulSyncAt: new Date(),
            syncStatus: 'success',
            documentCount: count,
            updatedAt: new Date(),
          })
          .where(eq(policySources.id, source.id));
      }
    } catch (error) {
      console.error('❌ Error updating policy source status:', error);
    }
  }
  
  /**
   * Check for updates to eCFR Title 7
   */
  async checkForUpdates(benefitProgramId?: string): Promise<{ hasUpdate: boolean; lastModified: Date | null }> {
    try {
      // Get current Last-Modified from GovInfo
      const response = await axios.head(this.ECFR_TITLE_7_URL);
      const lastModifiedHeader = response.headers['last-modified'];
      const remoteLastModified = lastModifiedHeader ? new Date(lastModifiedHeader) : null;
      
      if (!remoteLastModified) {
        return { hasUpdate: false, lastModified: null };
      }
      
      // Get last sync time from policy sources
      let localLastSync: Date | null = null;
      if (benefitProgramId) {
        const [source] = await db.select()
          .from(policySources)
          .where(eq(policySources.benefitProgramId, benefitProgramId))
          .limit(1);
        
        localLastSync = source?.lastSuccessfulSyncAt || null;
      }
      
      // Compare timestamps
      const hasUpdate = !localLastSync || remoteLastModified > localLastSync;
      
      return {
        hasUpdate,
        lastModified: remoteLastModified,
      };
    } catch (error) {
      console.error('❌ Error checking for updates:', error);
      return {
        hasUpdate: false,
        lastModified: null,
      };
    }
  }
}

export const ecfrBulkDownloader = new ECFRBulkDownloader();
