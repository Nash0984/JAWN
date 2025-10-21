import { govInfoClient } from './govInfoClient';
import { parseStringPromise } from 'xml2js';
import { db } from '../db';
import { federalBills, documents, policySources, benefitPrograms } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { ObjectStorageService } from '../objectStorage';
import { unifiedDocumentService as documentProcessor } from './unified/UnifiedDocumentService';
import { logger } from './logger.service';

/**
 * GovInfo Bill Status Downloader
 * 
 * Downloads federal bill status XML from GovInfo.gov for bills related to
 * benefit programs (SNAP, TANF, Medicaid, EITC, CTC, WIC)
 * 
 * Data Source: https://api.govinfo.gov/collections/BILLSTATUS/
 * Format: Bill Status XML (structured legislative data)
 * Coverage: All bills from specified Congress with policy relevance filtering
 */

interface BillStatusDownloadResult {
  success: boolean;
  billsProcessed: number;
  billsUpdated: number;
  billsSkipped: number;
  documentsCreated: number;
  errors: string[];
}

interface ParsedBillData {
  billNumber: string;
  billType: string;
  congress: number;
  title: string;
  summary?: string;
  introducedDate?: Date;
  latestActionDate?: Date;
  latestActionText?: string;
  status: string;
  sponsors?: any[];
  cosponsors?: any[];
  committees?: any[];
  relatedPrograms: string[];
  policyChanges?: any;
}

export class GovInfoBillStatusDownloader {
  private readonly POLICY_KEYWORDS = [
    'SNAP',
    'food stamp',
    'food assistance',
    'TANF',
    'temporary assistance for needy families',
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
  ];

  /**
   * Download bill status data for a specific Congress
   */
  async downloadBillStatus(congress: number = 119): Promise<BillStatusDownloadResult> {
    logger.info('GovInfo Bill Status Downloader started', { congress });
    
    const result: BillStatusDownloadResult = {
      success: true,
      billsProcessed: 0,
      billsUpdated: 0,
      billsSkipped: 0,
      documentsCreated: 0,
      errors: [],
    };

    try {
      // Fetch all packages from BILLSTATUS collection for the entire Congress
      logger.info('Fetching bill list from GovInfo API');
      const packages = await govInfoClient.getAllPackages(
        'BILLSTATUS',
        undefined,
        undefined,
        { congress: congress.toString() }
      );
      logger.info('Bills found in Congress', { count: packages.length, congress });

      // Filter bills by policy keywords
      const relevantBills = packages.filter(pkg => 
        this.isPolicyRelevant(pkg.title)
      );
      
      logger.info('Policy-relevant bills filtered', { count: relevantBills.length });

      // Process each relevant bill
      for (const pkg of relevantBills) {
        try {
          await this.processBill(pkg.packageId, congress, result);
        } catch (error) {
          const errorMsg = `Error processing ${pkg.packageId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error('Error processing bill', { error: errorMsg });
          result.errors.push(errorMsg);
          result.success = false;
        }
      }

      // Update policy source sync status
      await this.updatePolicySourceStatus(congress, result);

      logger.info('Bill Status Download Complete', {
        processed: result.billsProcessed,
        updated: result.billsUpdated,
        skipped: result.billsSkipped,
        documents: result.documentsCreated,
        errors: result.errors.length
      });

    } catch (error) {
      result.success = false;
      const errorMsg = `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error('Bill Status Download failed', { error: errorMsg });
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Check if bill title/summary contains policy-relevant keywords
   */
  private isPolicyRelevant(title: string): boolean {
    const lowerTitle = title.toLowerCase();
    return this.POLICY_KEYWORDS.some(keyword => 
      lowerTitle.includes(keyword.toLowerCase())
    );
  }

  /**
   * Process a single bill
   */
  private async processBill(
    packageId: string,
    congress: number,
    result: BillStatusDownloadResult
  ): Promise<void> {
    result.billsProcessed++;

    // Fetch package metadata to get XML URL and last modified date
    const metadata = await govInfoClient.getPackageMetadata(packageId);
    
    if (!metadata.download.xmlLink) {
      logger.debug('Skipping bill - no XML available', { packageId });
      result.billsSkipped++;
      return;
    }

    const lastModified = new Date(metadata.lastModified);

    // Extract bill number from packageId (e.g., "BILLS-119hr5376ih" -> "HR 5376")
    const billNumber = this.extractBillNumber(packageId);
    
    // Check if bill exists and is up-to-date
    const existingBills = await db.select()
      .from(federalBills)
      .where(
        and(
          eq(federalBills.billNumber, billNumber),
          eq(federalBills.congress, congress)
        )
      )
      .limit(1);

    const existingBill = existingBills[0];

    // Skip if bill exists and hasn't been modified
    if (existingBill?.lastSyncedAt && existingBill.lastSyncedAt >= lastModified) {
      logger.debug('Skipping bill - already up-to-date', { billNumber });
      result.billsSkipped++;
      return;
    }

    logger.info('Downloading bill', { billNumber });

    // Download XML
    const xmlContent = await govInfoClient.downloadXML(metadata.download.xmlLink);
    
    // Parse XML to extract bill data
    const billData = await this.parseBillStatusXML(xmlContent, packageId, congress);

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

    // Upsert bill into database
    if (existingBill) {
      await db.update(federalBills)
        .set({
          ...billData,
          billStatusXml: xmlContent,
          govInfoPackageId: packageId,
          sourceUrl: metadata.download.xmlLink,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(federalBills.id, existingBill.id));
      
      logger.info('Bill updated', { billNumber });
    } else {
      await db.insert(federalBills).values({
        ...billData,
        billStatusXml: xmlContent,
        govInfoPackageId: packageId,
        sourceUrl: metadata.download.xmlLink,
        lastSyncedAt: new Date(),
      });
      
      logger.info('Bill created', { billNumber });
    }

    result.billsUpdated++;

    // Create document record for RAG pipeline
    const documentId = await this.createDocumentRecord(
      billData,
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
   * Extract bill number from package ID
   * Example: "BILLS-119hr5376ih" -> "HR 5376"
   */
  private extractBillNumber(packageId: string): string {
    const match = packageId.match(/BILLS-\d+([a-z]+)(\d+)/i);
    if (match) {
      const billType = match[1].toUpperCase();
      const billNum = match[2];
      return `${billType} ${billNum}`;
    }
    return packageId;
  }

  /**
   * Parse Bill Status XML into structured data
   */
  private async parseBillStatusXML(
    xml: string,
    packageId: string,
    congress: number
  ): Promise<ParsedBillData> {
    const parsed = await parseStringPromise(xml, {
      trim: true,
      explicitArray: false,
      mergeAttrs: true,
    });

    const bill = parsed.billStatus?.bill;
    
    if (!bill) {
      throw new Error('Invalid Bill Status XML - missing bill element');
    }

    // Extract bill type and number
    const billType = bill.billType || this.extractBillType(packageId);
    const billNumber = bill.billNumber || this.extractBillNumber(packageId);

    // Extract title
    const title = bill.title?.officialTitle || bill.title || 'Unknown Title';

    // Extract summary
    const summaries = Array.isArray(bill.summaries?.summary) 
      ? bill.summaries.summary 
      : bill.summaries?.summary 
        ? [bill.summaries.summary]
        : [];
    
    const latestSummary = summaries[summaries.length - 1];
    const summary = latestSummary?.text || latestSummary?.updateDate;

    // Extract dates
    const introducedDate = bill.introducedDate ? new Date(bill.introducedDate) : undefined;
    
    // Extract latest action
    const actions = Array.isArray(bill.actions?.item)
      ? bill.actions.item
      : bill.actions?.item
        ? [bill.actions.item]
        : [];
    
    const latestAction = actions[actions.length - 1];
    const latestActionDate = latestAction?.actionDate ? new Date(latestAction.actionDate) : undefined;
    const latestActionText = latestAction?.text || '';

    // Extract status
    const status = this.determineBillStatus(bill);

    // Extract sponsors
    const sponsors = this.extractSponsors(bill.sponsors);
    const cosponsors = this.extractCosponsors(bill.cosponsors);

    // Extract committees
    const committees = this.extractCommittees(bill.committees);

    // Determine related programs
    const relatedPrograms = this.determineRelatedPrograms(title, summary);

    return {
      billNumber,
      billType,
      congress,
      title,
      summary,
      introducedDate,
      latestActionDate,
      latestActionText,
      status,
      sponsors,
      cosponsors,
      committees,
      relatedPrograms,
    };
  }

  /**
   * Extract bill type from package ID
   */
  private extractBillType(packageId: string): string {
    const match = packageId.match(/BILLS-\d+([a-z]+)\d+/i);
    return match ? match[1].toLowerCase() : 'unknown';
  }

  /**
   * Determine bill status from bill data
   */
  private determineBillStatus(bill: any): string {
    const latestAction = bill.latestAction?.text?.toLowerCase() || '';
    
    if (latestAction.includes('became public law') || latestAction.includes('signed by president')) {
      return 'enacted';
    }
    if (latestAction.includes('vetoed')) {
      return 'vetoed';
    }
    if (latestAction.includes('passed senate')) {
      return 'passed_senate';
    }
    if (latestAction.includes('passed house')) {
      return 'passed_house';
    }
    
    return 'introduced';
  }

  /**
   * Extract sponsor information
   */
  private extractSponsors(sponsorsData: any): any[] {
    if (!sponsorsData?.item) return [];
    
    const items = Array.isArray(sponsorsData.item) ? sponsorsData.item : [sponsorsData.item];
    
    return items.map((sponsor: any) => ({
      name: sponsor.fullName || sponsor.lastName,
      party: sponsor.party,
      state: sponsor.state,
      bioguideId: sponsor.bioguideId,
    }));
  }

  /**
   * Extract cosponsor information
   */
  private extractCosponsors(cosponsorsData: any): any[] {
    if (!cosponsorsData?.item) return [];
    
    const items = Array.isArray(cosponsorsData.item) ? cosponsorsData.item : [cosponsorsData.item];
    
    return items.map((cosponsor: any) => ({
      name: cosponsor.fullName || cosponsor.lastName,
      party: cosponsor.party,
      state: cosponsor.state,
      bioguideId: cosponsor.bioguideId,
      sponsorshipDate: cosponsor.sponsorshipDate,
    }));
  }

  /**
   * Extract committee information
   */
  private extractCommittees(committeesData: any): any[] {
    if (!committeesData?.item) return [];
    
    const items = Array.isArray(committeesData.item) ? committeesData.item : [committeesData.item];
    
    return items.map((committee: any) => ({
      name: committee.name,
      systemCode: committee.systemCode,
      chamber: committee.chamber,
    }));
  }

  /**
   * Determine which benefit programs this bill relates to
   */
  private determineRelatedPrograms(title: string, summary?: string): string[] {
    const text = `${title} ${summary || ''}`.toLowerCase();
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
    if (text.includes('eitc') || text.includes('earned income tax credit')) {
      programs.push('EITC');
    }
    if (text.includes('ctc') || text.includes('child tax credit')) {
      programs.push('CTC');
    }
    if (text.includes('wic') || text.includes('women, infants')) {
      programs.push('WIC');
    }

    return programs;
  }

  /**
   * Create document record for RAG pipeline
   */
  private async createDocumentRecord(
    billData: ParsedBillData,
    packageId: string,
    objectPath: string,
    fileSize: number,
    sourceUrl: string
  ): Promise<string | null> {
    try {
      const [document] = await db.insert(documents).values({
        filename: `${packageId}.xml`,
        originalName: `${billData.billNumber} - Bill Status XML`,
        objectPath,
        fileSize,
        mimeType: 'application/xml',
        status: 'uploaded',
        sourceUrl,
        downloadedAt: new Date(),
        isGoldenSource: true,
        metadata: {
          source: 'govinfo_bill_status',
          packageId,
          billNumber: billData.billNumber,
          congress: billData.congress,
          title: billData.title,
          relatedPrograms: billData.relatedPrograms,
        },
      }).returning();

      return document.id;
    } catch (error) {
      logger.error('Error creating document record', { error });
      return null;
    }
  }

  /**
   * Update policy source sync status
   */
  private async updatePolicySourceStatus(
    congress: number,
    result: BillStatusDownloadResult
  ): Promise<void> {
    try {
      const sourceName = `GovInfo Bill Status - Congress ${congress}`;
      
      const existingSources = await db.select()
        .from(policySources)
        .where(eq(policySources.name, sourceName))
        .limit(1);

      const sourceData = {
        name: sourceName,
        sourceType: 'federal_legislation' as const,
        jurisdiction: 'federal' as const,
        description: `Federal bill status tracking for Congress ${congress} via GovInfo.gov`,
        url: `https://api.govinfo.gov/collections/BILLSTATUS/${congress}`,
        syncType: 'api' as const,
        syncSchedule: 'weekly' as const,
        lastSyncAt: new Date(),
        lastSuccessfulSyncAt: result.success ? new Date() : undefined,
        syncStatus: result.success ? 'success' : 'error',
        syncError: result.errors.length > 0 ? result.errors.join('; ') : null,
        documentCount: result.billsUpdated,
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
      logger.error('Error updating policy source status', { error });
    }
  }
}

// Export singleton instance
export const govInfoBillStatusDownloader = new GovInfoBillStatusDownloader();
