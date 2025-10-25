import { govInfoClient } from './govInfoClient';
import { parseStringPromise } from 'xml2js';
import { db } from '../db';
import { publicLaws, federalBills, documents, policySources } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { ObjectStorageService } from '../objectStorage';
import { unifiedDocumentService as documentProcessor } from './unified/UnifiedDocumentService';

/**
 * GovInfo Public Laws Downloader
 * 
 * Downloads enacted federal legislation (Public Laws) from GovInfo.gov
 * in USLM XML format with full legislative text and metadata
 * 
 * Data Source: https://api.govinfo.gov/collections/PLAW/
 * Format: USLM XML (United States Legislative Markup)
 * Coverage: All public laws from specified Congress
 */

interface PublicLawsDownloadResult {
  success: boolean;
  lawsProcessed: number;
  lawsUpdated: number;
  lawsSkipped: number;
  documentsCreated: number;
  errors: string[];
}

interface ParsedPublicLaw {
  publicLawNumber: string;
  congress: number;
  lawType: string;
  title: string;
  enactmentDate: Date;
  billNumber?: string;
  fullText?: string;
  affectedPrograms: string[];
  policyChanges?: any;
  usCodeCitations?: any[];
}

export class GovInfoPublicLawsDownloader {
  private readonly POLICY_KEYWORDS = [
    'SNAP',
    'food stamp',
    'food assistance',
    'TANF',
    'temporary assistance',
    'Medicaid',
    'EITC',
    'earned income tax credit',
    'CTC',
    'child tax credit',
    'WIC',
    'women infants children',
    'supplemental nutrition',
    'poverty',
    'low-income',
    'social security',
    'medicare',
  ];

  /**
   * Download public laws for a specific Congress
   */
  async downloadPublicLaws(congress: number = 119): Promise<PublicLawsDownloadResult> {
    console.log(`\n🏛️  GovInfo Public Laws Downloader - Congress ${congress}\n`);
    
    const result: PublicLawsDownloadResult = {
      success: true,
      lawsProcessed: 0,
      lawsUpdated: 0,
      lawsSkipped: 0,
      documentsCreated: 0,
      errors: [],
    };

    try {
      // Fetch all packages from PLAW collection for the entire Congress
      console.log(`📥 Fetching public laws from GovInfo API...`);
      const packages = await govInfoClient.getAllPackages(
        'PLAW',
        undefined,
        undefined,
        { congress: congress.toString() }
      );
      console.log(`✅ Found ${packages.length} public laws in Congress ${congress}\n`);

      // Filter laws by policy keywords
      const relevantLaws = packages.filter(pkg => 
        this.isPolicyRelevant(pkg.title)
      );
      
      console.log(`🎯 Filtered to ${relevantLaws.length} policy-relevant laws\n`);

      // Process each relevant law
      for (const pkg of relevantLaws) {
        try {
          await this.processPublicLaw(pkg.packageId, congress, result);
        } catch (error) {
          const errorMsg = `Error processing ${pkg.packageId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          result.errors.push(errorMsg);
          result.success = false;
        }
      }

      // Update policy source sync status
      await this.updatePolicySourceStatus(congress, result);

      console.log(`\n✅ Public Laws Download Complete:`);
      console.log(`   Processed: ${result.lawsProcessed}`);
      console.log(`   Updated: ${result.lawsUpdated}`);
      console.log(`   Skipped: ${result.lawsSkipped}`);
      console.log(`   Documents: ${result.documentsCreated}`);
      console.log(`   Errors: ${result.errors.length}`);

    } catch (error) {
      result.success = false;
      const errorMsg = `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Check if law title contains policy-relevant keywords
   */
  private isPolicyRelevant(title: string): boolean {
    const lowerTitle = title.toLowerCase();
    return this.POLICY_KEYWORDS.some(keyword => 
      lowerTitle.includes(keyword.toLowerCase())
    );
  }

  /**
   * Process a single public law
   */
  private async processPublicLaw(
    packageId: string,
    congress: number,
    result: PublicLawsDownloadResult
  ): Promise<void> {
    result.lawsProcessed++;

    // Fetch package metadata to get XML URL and last modified date
    const metadata = await govInfoClient.getPackageMetadata(packageId);
    
    if (!metadata.download.xmlLink) {
      console.log(`⏭️  Skipping ${packageId} - no XML available`);
      result.lawsSkipped++;
      return;
    }

    const lastModified = new Date(metadata.lastModified);

    // Extract public law number from packageId (e.g., "PLAW-119publ4" -> "119-4")
    const publicLawNumber = this.extractPublicLawNumber(packageId);
    
    // Check if law exists and is up-to-date
    const existingLaws = await db.select()
      .from(publicLaws)
      .where(
        and(
          eq(publicLaws.publicLawNumber, publicLawNumber),
          eq(publicLaws.congress, congress)
        )
      )
      .limit(1);

    const existingLaw = existingLaws[0];

    // Skip if law exists and hasn't been modified
    if (existingLaw?.downloadedAt && existingLaw.downloadedAt >= lastModified) {
      console.log(`⏭️  Skipping Public Law ${publicLawNumber} - already up-to-date`);
      result.lawsSkipped++;
      return;
    }

    console.log(`📥 Downloading Public Law ${publicLawNumber}...`);

    // Download USLM XML
    const xmlContent = await govInfoClient.downloadXML(metadata.download.xmlLink);
    
    // Parse XML to extract law data
    const lawData = await this.parsePublicLawXML(xmlContent, packageId, congress);

    // Upload XML to object storage
    const objectStorageService = new ObjectStorageService();
    const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
    
    const buffer = Buffer.from(xmlContent, 'utf-8');
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: buffer,
      headers: {
        'Content-Type': 'application/xml',
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload XML: ${uploadResponse.statusText}`);
    }

    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);

    // Link back to originating bill if available
    if (lawData.billNumber) {
      await this.linkToOriginatingBill(lawData.billNumber, congress, publicLawNumber);
    }

    // Upsert law into database
    if (existingLaw) {
      await db.update(publicLaws)
        .set({
          ...lawData,
          uslmXml: xmlContent,
          govInfoPackageId: packageId,
          sourceUrl: metadata.download.xmlLink,
          downloadedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(publicLaws.id, existingLaw.id));
      
      console.log(`🔄 Updated Public Law ${publicLawNumber}`);
    } else {
      await db.insert(publicLaws).values({
        ...lawData,
        uslmXml: xmlContent,
        govInfoPackageId: packageId,
        sourceUrl: metadata.download.xmlLink,
        downloadedAt: new Date(),
      });
      
      console.log(`✨ Created Public Law ${publicLawNumber}`);
    }

    result.lawsUpdated++;

    // Create document record for RAG pipeline
    const documentId = await this.createDocumentRecord(
      lawData,
      packageId,
      objectPath,
      buffer.length,
      metadata.download.xmlLink
    );

    if (documentId) {
      result.documentsCreated++;
      
      // Process document through RAG pipeline
      await documentProcessor.processDocument(documentId);
    }
  }

  /**
   * Extract public law number from package ID
   * Example: "PLAW-119publ4" -> "119-4"
   */
  private extractPublicLawNumber(packageId: string): string {
    const match = packageId.match(/PLAW-(\d+)publ(\d+)/i);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
    return packageId;
  }

  /**
   * Parse Public Law USLM XML into structured data
   */
  private async parsePublicLawXML(
    xml: string,
    packageId: string,
    congress: number
  ): Promise<ParsedPublicLaw> {
    const parsed = await parseStringPromise(xml, {
      trim: true,
      explicitArray: false,
      mergeAttrs: true,
    });

    // USLM XML structure varies, try multiple paths
    const law = parsed.law || parsed['public-law'] || parsed.document;
    
    if (!law) {
      throw new Error('Invalid Public Law XML - missing law element');
    }

    // Extract public law number
    const publicLawNumber = this.extractPublicLawNumber(packageId);

    // Extract title - try multiple paths
    const title = 
      law.shortTitle || 
      law.longTitle || 
      law.officialTitle || 
      law.title ||
      law.meta?.title ||
      `Public Law ${publicLawNumber}`;

    // Extract enactment date
    const enactmentDateStr = 
      law.enactmentDate || 
      law.approvalDate || 
      law.meta?.approvalDate ||
      law.dateIssued;
    
    const enactmentDate = enactmentDateStr ? new Date(enactmentDateStr) : new Date();

    // Extract bill number (originating bill)
    const billNumber = law.billNumber || this.extractBillNumberFromLaw(law);

    // Extract full text
    const fullText = this.extractFullText(law);

    // Extract US Code citations
    const usCodeCitations = this.extractUSCodeCitations(law);

    // Determine affected programs
    const affectedPrograms = this.determineAffectedPrograms(title, fullText);

    // Extract policy changes (simplified - could use AI here)
    const policyChanges = this.extractPolicyChanges(law, affectedPrograms);

    return {
      publicLawNumber,
      congress,
      lawType: 'public',
      title: String(title),
      enactmentDate,
      billNumber,
      fullText,
      affectedPrograms,
      policyChanges,
      usCodeCitations,
    };
  }

  /**
   * Extract bill number from law metadata
   */
  private extractBillNumberFromLaw(law: any): string | undefined {
    // Try to find bill number in various fields
    if (law.meta?.billNum) {
      return law.meta.billNum;
    }
    
    if (law.congress && law.billType && law.billNum) {
      const type = law.billType.toUpperCase();
      return `${type} ${law.billNum}`;
    }

    // Try to extract from heading or notes
    const headingText = JSON.stringify(law.heading || '');
    const match = headingText.match(/(H\.?R\.?|S\.?)\s*(\d+)/i);
    if (match) {
      const type = match[1].replace(/\./g, '').toUpperCase();
      return `${type} ${match[2]}`;
    }

    return undefined;
  }

  /**
   * Extract full text from USLM XML
   */
  private extractFullText(law: any): string {
    // Extract text from all text nodes
    const textParts: string[] = [];
    
    const extractText = (obj: any) => {
      if (typeof obj === 'string') {
        textParts.push(obj);
      } else if (Array.isArray(obj)) {
        obj.forEach(extractText);
      } else if (typeof obj === 'object' && obj !== null) {
        // Handle text content
        if (obj._) {
          textParts.push(obj._);
        }
        // Recursively extract from children
        Object.values(obj).forEach(extractText);
      }
    };

    extractText(law);
    
    return textParts.join(' ').trim().substring(0, 50000); // Limit to 50k chars
  }

  /**
   * Extract US Code citations from law
   */
  private extractUSCodeCitations(law: any): any[] {
    const citations: any[] = [];
    
    // Look for USC references in various fields
    const findCitations = (obj: any, path = '') => {
      if (typeof obj === 'string') {
        // Match patterns like "42 U.S.C. 1396" or "7 USC 2011"
        const regex = /(\d+)\s+U\.?S\.?C\.?\s+(\d+)/gi;
        let match;
        while ((match = regex.exec(obj)) !== null) {
          citations.push({
            title: match[1],
            section: match[2],
            text: match[0],
          });
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, i) => findCitations(item, `${path}[${i}]`));
      } else if (typeof obj === 'object' && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => 
          findCitations(value, path ? `${path}.${key}` : key)
        );
      }
    };

    findCitations(law);
    
    return citations;
  }

  /**
   * Determine which benefit programs this law affects
   */
  private determineAffectedPrograms(title: string, fullText?: string): string[] {
    const text = `${title} ${fullText || ''}`.toLowerCase();
    const programs: string[] = [];

    if (text.includes('snap') || text.includes('food stamp') || text.includes('supplemental nutrition')) {
      programs.push('SNAP');
    }
    if (text.includes('tanf') || text.includes('temporary assistance')) {
      programs.push('TANF');
    }
    if (text.includes('medicaid')) {
      programs.push('Medicaid');
    }
    if (text.includes('medicare')) {
      programs.push('Medicare');
    }
    if (text.includes('eitc') || text.includes('earned income tax credit')) {
      programs.push('EITC');
    }
    if (text.includes('ctc') || text.includes('child tax credit')) {
      programs.push('CTC');
    }
    if (text.includes('wic')) {
      programs.push('WIC');
    }
    if (text.includes('social security')) {
      programs.push('Social Security');
    }

    return programs;
  }

  /**
   * Extract policy changes (simplified - in production could use AI)
   */
  private extractPolicyChanges(law: any, affectedPrograms: string[]): any {
    return {
      affectedPrograms,
      summary: 'Policy changes extracted from USLM XML',
      sections: [],
    };
  }

  /**
   * Link public law back to its originating bill
   */
  private async linkToOriginatingBill(
    billNumber: string,
    congress: number,
    publicLawNumber: string
  ): Promise<void> {
    try {
      const bills = await db.select()
        .from(federalBills)
        .where(
          and(
            eq(federalBills.billNumber, billNumber),
            eq(federalBills.congress, congress)
          )
        )
        .limit(1);

      if (bills[0]) {
        await db.update(federalBills)
          .set({
            status: 'enacted',
            updatedAt: new Date(),
          })
          .where(eq(federalBills.id, bills[0].id));
        
        console.log(`🔗 Linked to originating bill ${billNumber}`);
      }
    } catch (error) {
      console.error(`Error linking to bill ${billNumber}:`, error);
    }
  }

  /**
   * Create document record for RAG pipeline
   */
  private async createDocumentRecord(
    lawData: ParsedPublicLaw,
    packageId: string,
    objectPath: string,
    fileSize: number,
    sourceUrl: string
  ): Promise<string | null> {
    try {
      const [document] = await db.insert(documents).values({
        filename: `${packageId}.xml`,
        originalName: `Public Law ${lawData.publicLawNumber} - ${lawData.title}`,
        objectPath,
        fileSize,
        mimeType: 'application/xml',
        status: 'uploaded',
        sourceUrl,
        downloadedAt: new Date(),
        isGoldenSource: true,
        metadata: {
          source: 'govinfo_public_law',
          packageId,
          publicLawNumber: lawData.publicLawNumber,
          congress: lawData.congress,
          title: lawData.title,
          enactmentDate: lawData.enactmentDate,
          billNumber: lawData.billNumber,
          affectedPrograms: lawData.affectedPrograms,
        },
      }).returning();

      return document.id;
    } catch (error) {
      console.error(`Error creating document record: ${error}`);
      return null;
    }
  }

  /**
   * Update policy source sync status
   */
  private async updatePolicySourceStatus(
    congress: number,
    result: PublicLawsDownloadResult
  ): Promise<void> {
    try {
      const sourceName = `GovInfo Public Laws - Congress ${congress}`;
      
      const existingSources = await db.select()
        .from(policySources)
        .where(eq(policySources.name, sourceName))
        .limit(1);

      const sourceData = {
        name: sourceName,
        sourceType: 'federal_legislation' as const,
        jurisdiction: 'federal' as const,
        description: `Enacted federal legislation (Public Laws) for Congress ${congress} via GovInfo.gov`,
        url: `https://api.govinfo.gov/collections/PLAW/${congress}`,
        syncType: 'api' as const,
        syncSchedule: 'weekly' as const,
        lastSyncAt: new Date(),
        lastSuccessfulSyncAt: result.success ? new Date() : undefined,
        syncStatus: result.success ? 'success' : 'error',
        syncError: result.errors.length > 0 ? result.errors.join('; ') : null,
        documentCount: result.lawsUpdated,
        isActive: true,
      };

      if (existingSources[0]) {
        await db.update(policySources)
          .set(sourceData)
          .where(eq(policySources.id, existingSources[0].id));
      } else {
        await db.insert(policySources).values(sourceData);
      }
    } catch (error) {
      console.error(`Error updating policy source status: ${error}`);
    }
  }
}

// Export singleton instance
export const govInfoPublicLawsDownloader = new GovInfoPublicLawsDownloader();
