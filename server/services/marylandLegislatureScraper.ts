import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '../db';
import { marylandBills, documents, policySources } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { ObjectStorageService } from '../objectStorage';
import { unifiedDocumentService as documentProcessor } from './unified/UnifiedDocumentService';
import { logger } from './logger.service';

/**
 * Maryland Legislature Scraper
 * 
 * Scrapes mgaleg.maryland.gov for current session bills related to
 * benefit programs (SNAP, TANF, Medicaid, public assistance, etc.)
 * 
 * Data Source: https://mgaleg.maryland.gov
 * Coverage: 2025 Regular Session (2025RS)
 */

interface ScrapeResult {
  success: boolean;
  billsFound: number;
  billsStored: number;
  billsUpdated: number;
  errors: string[];
}

interface BillListItem {
  billNumber: string;
  billType: string;
  title: string;
  sponsor: string;
  crossFiledWith?: string;
  detailUrl: string;
}

interface BillDetails {
  billNumber: string;
  billType: string;
  session: string;
  title: string;
  synopsis?: string;
  sponsors: any[];
  committees: any[];
  status: string;
  fiscalNoteUrl?: string;
  pdfUrl?: string;
  fullTextUrl?: string;
  crossFiledWith?: string;
  introducedDate?: Date;
  firstReadingDate?: Date;
  relatedPrograms: string[];
}

export class MarylandLegislatureScraper {
  private readonly BASE_URL = 'https://mgaleg.maryland.gov';
  private readonly DELAY_MS = 500; // Respectful delay between requests
  private readonly MAX_BILLS_PER_CHAMBER = 5000; // Increased limit to capture all bills
  
  private readonly POLICY_KEYWORDS = [
    'SNAP',
    'food stamp',
    'food assistance',
    'TANF',
    'temporary assistance',
    'public assistance',
    'Medicaid',
    'energy assistance',
    'tax credit',
    'EITC',
    'earned income',
    'child tax credit',
    'low-income',
    'poverty',
    'supplemental nutrition',
  ];

  /**
   * Main scraper method - scrapes bills from Maryland Legislature
   */
  async scrapeBills(session: string = '2025RS'): Promise<ScrapeResult> {
    logger.info('Maryland Legislature Scraper started', { session });
    
    const result: ScrapeResult = {
      success: true,
      billsFound: 0,
      billsStored: 0,
      billsUpdated: 0,
      errors: [],
    };

    try {
      // Scrape bills from both chambers
      const houseBills = await this.scrapeChamber('house', session);
      const senateBills = await this.scrapeChamber('senate', session);
      
      const allBills = [...houseBills, ...senateBills];
      logger.info('Total bills found', { count: allBills.length });

      // Process each bill and filter AFTER fetching details
      // This ensures we check BOTH title AND synopsis for keywords
      logger.info('Fetching details and filtering by keywords');
      
      for (const billItem of allBills) {
        try {
          // Fetch bill details first
          const billDetails = await this.fetchBillDetails(billItem, session);
          
          // NOW check if policy-relevant (checks both title AND synopsis)
          if (this.isPolicyRelevantWithSynopsis(billDetails.title, billDetails.synopsis)) {
            result.billsFound++;
            await this.processBillWithDetails(billItem, billDetails, session, result);
          }
          
          // Respectful delay
          await this.delay(this.DELAY_MS);
        } catch (error) {
          const errorMsg = `Error processing ${billItem.billNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          logger.error('Error fetching bill details', { error: errorMsg });
          result.errors.push(errorMsg);
        }
      }
      
      logger.info('Policy-relevant bills found', { 
        count: result.billsFound,
        note: 'Checked both title and synopsis'
      });

      // Update policy source sync status
      await this.updatePolicySourceStatus(session, result);

      logger.info('Maryland Legislature scrape complete', {
        billsFound: result.billsFound,
        billsStored: result.billsStored,
        billsUpdated: result.billsUpdated,
        errors: result.errors.length
      });

    } catch (error) {
      result.success = false;
      const errorMsg = `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error('Fatal error scraping Maryland legislature', {
        context: 'MarylandLegislatureScraper.scrapeAndStoreBills',
        error: error instanceof Error ? error.message : String(error)
      });
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Scrape bills from a specific chamber (house or senate) with pagination
   * Dynamically detects pagination parameter from Next link on page 1
   */
  private async scrapeChamber(chamber: 'house' | 'senate', session: string): Promise<BillListItem[]> {
    logger.info('Fetching bills with pagination', { chamber });
    
    const allBills: BillListItem[] = [];
    let page = 1;
    let hasMore = true;
    let paginationParam = 'page'; // default fallback
    
    while (hasMore && allBills.length < this.MAX_BILLS_PER_CHAMBER) {
      try {
        let pageBills: BillListItem[] = [];
        let $: cheerio.CheerioAPI | null = null;
        
        // For page 1, fetch and detect pagination parameter from Next link
        if (page === 1) {
          const baseUrl = `${this.BASE_URL}/mgawebsite/Legislation/Index/${chamber}`;
          logger.debug('Fetching page', { page, chamber });
          
          const response = await axios.get(baseUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; MarylandBenefitsBot/1.0)',
            },
          });
          
          $ = cheerio.load(response.data);
          pageBills = this.parseBillTable($, allBills);
          
          // Parse Next link to detect pagination parameter
          const nextLink = $('a.pagination-next, a:contains("Next"), a[rel="next"], a:contains("›")').attr('href');
          if (nextLink) {
            try {
              const url = new URL(nextLink, baseUrl);
              // Extract param name from URL (e.g., ?page=2 or ?pageNumber=2)
              url.searchParams.forEach((value, key) => {
                if (!isNaN(Number(value)) && Number(value) > 1 && paginationParam === 'page') {
                  paginationParam = key;
                  logger.debug('Detected pagination parameter from Next link', { paginationParam });
                }
              });
            } catch (error) {
              logger.warn('Could not parse Next link, using default parameter', { paginationParam });
            }
          } else {
            logger.debug('No Next link found, using default parameter', { paginationParam });
          }
          
          logger.debug('Found bills on page', { page, count: pageBills.length });
        } else {
          // For subsequent pages, use detected pagination parameter
          const url = `${this.BASE_URL}/mgawebsite/Legislation/Index/${chamber}?${paginationParam}=${page}`;
          
          logger.debug('Fetching page', { page, chamber, paginationParam });
          
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; MarylandBenefitsBot/1.0)',
            },
          });
          
          $ = cheerio.load(response.data);
          pageBills = this.parseBillTable($, allBills);
        }
        
        // Count new bills (not duplicates)
        const newBillsCount = pageBills.length;
        const beforeCount = allBills.length;
        
        // Add bills to collection (duplicates already filtered in parseBillTable)
        allBills.push(...pageBills);
        const actualNewBills = allBills.length - beforeCount;
        
        if (page > 1) {
          logger.debug('Found bills on page', { 
            page, 
            total: newBillsCount, 
            new: actualNewBills, 
            duplicates: newBillsCount - actualNewBills 
          });
        }
        
        // END DETECTION: Stop if no bills found OR all were duplicates
        if (pageBills.length === 0 || actualNewBills === 0) {
          logger.debug('End of pagination detected', { 
            reason: pageBills.length === 0 ? 'no bills found' : 'all duplicates' 
          });
          hasMore = false;
          break;
        }
        
        // Additional end detection: Check DOM for pagination indicators
        if ($ !== null) {
          const hasNextButton = $('a:contains("Next")').length > 0 || 
                               $('a:contains("›")').length > 0 ||
                               $('a[rel="next"]').length > 0;
          
          const hasPageLinks = $(`a:contains("${page + 1}")`).length > 0;
          
          // If we got fewer bills than typical page size AND no next indicators, we're at the end
          const isLikelyLastPage = pageBills.length < 25;
          
          if (!hasNextButton && !hasPageLinks && isLikelyLastPage) {
            logger.debug('End of pagination detected', { 
              reason: 'small page with no next indicators', 
              billsOnPage: pageBills.length 
            });
            hasMore = false;
            break;
          }
        }
        
        page++;
        await this.delay(this.DELAY_MS);
        
      } catch (error) {
        logger.error('Error fetching page', { page, error });
        hasMore = false;
      }
    }
    
    logger.info('Chamber scrape complete', { 
      chamber, 
      totalBills: allBills.length, 
      pages: page - 1, 
      paginationParam 
    });
    
    if (allBills.length >= this.MAX_BILLS_PER_CHAMBER) {
      logger.warn('Max bills per chamber limit reached', { 
        limit: this.MAX_BILLS_PER_CHAMBER, 
        message: 'There may be more bills' 
      });
    }
    
    return allBills;
  }
  
  /**
   * Parse bill table from HTML and extract bills
   * Filters out duplicates based on existing bills in allBills array
   */
  private parseBillTable($: cheerio.CheerioAPI, allBills: BillListItem[]): BillListItem[] {
    const pageBills: BillListItem[] = [];
    
    $('table tbody tr').each((index, row) => {
      try {
        const $row = $(row);
        const billLinkEl = $row.find('a[href*="/Legislation/Details/"]').first();
        
        if (!billLinkEl.length) return;

        const billNumber = billLinkEl.text().trim();
        const detailUrl = this.BASE_URL + billLinkEl.attr('href');
        
        // Extract bill type from bill number (e.g., "HB0001" -> "HB")
        const billType = billNumber.match(/^([A-Z]+)/)?.[1] || '';
        
        // Extract title - it's usually after the bill number
        const titleText = $row.find('td').eq(0).text();
        const title = titleText.replace(billNumber, '').replace(/Title\s*/i, '').trim();
        
        // Extract sponsor - look for delegate/senator link
        const sponsorEl = $row.find('a[href*="/Members/Details/"]').first();
        const sponsor = sponsorEl.text().trim();
        
        // Extract cross-filed bill if present
        const crossFiledMatch = titleText.match(/\(\s*([HS][BJ]\d+)\s*\)/);
        const crossFiledWith = crossFiledMatch ? crossFiledMatch[1] : undefined;

        if (billNumber && title) {
          // Check for duplicates before adding
          if (!allBills.find(b => b.billNumber === billNumber)) {
            pageBills.push({
              billNumber,
              billType,
              title,
              sponsor,
              crossFiledWith,
              detailUrl,
            });
          }
        }
      } catch (error) {
        logger.error('Error parsing bill row', { error });
      }
    });
    
    return pageBills;
  }

  /**
   * Check if bill is policy-relevant based on keywords (OLD - checks title only)
   */
  private isPolicyRelevant(title: string): boolean {
    const lowerTitle = title.toLowerCase();
    return this.POLICY_KEYWORDS.some(keyword => 
      lowerTitle.includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if bill is policy-relevant based on keywords in BOTH title AND synopsis
   * This is the correct method that prevents missing relevant bills
   */
  private isPolicyRelevantWithSynopsis(title: string, synopsis?: string): boolean {
    const text = `${title} ${synopsis || ''}`.toLowerCase();
    return this.POLICY_KEYWORDS.some(keyword => 
      text.includes(keyword.toLowerCase())
    );
  }

  /**
   * Process a single bill - fetch details, download PDF, store in database
   * @deprecated Use processBillWithDetails instead to avoid fetching details twice
   */
  private async processBill(
    billItem: BillListItem,
    session: string,
    result: ScrapeResult
  ): Promise<void> {
    logger.debug('Processing bill', { billNumber: billItem.billNumber });

    // Fetch bill details
    const billDetails = await this.fetchBillDetails(billItem, session);
    
    // Use the new method
    await this.processBillWithDetails(billItem, billDetails, session, result);
  }

  /**
   * Process a single bill with already-fetched details, download PDF, store in database
   * This avoids re-fetching details when we already have them
   */
  private async processBillWithDetails(
    billItem: BillListItem,
    billDetails: BillDetails,
    session: string,
    result: ScrapeResult
  ): Promise<void> {
    logger.debug('Storing bill', { billNumber: billDetails.billNumber });

    // Check if bill exists in database
    const existingBills = await db.select()
      .from(marylandBills)
      .where(
        and(
          eq(marylandBills.billNumber, billDetails.billNumber),
          eq(marylandBills.session, session)
        )
      )
      .limit(1);

    const existingBill = existingBills[0];

    // Download PDF if available
    let pdfObjectPath: string | undefined;
    if (billDetails.pdfUrl) {
      try {
        pdfObjectPath = await this.downloadAndUploadPDF(
          billDetails.pdfUrl,
          billDetails.billNumber,
          session
        );
      } catch (error) {
        logger.error('Failed to download PDF', { billNumber: billDetails.billNumber, error });
      }
    }

    // Prepare bill data for database
    const billData = {
      billNumber: billDetails.billNumber,
      session: billDetails.session,
      billType: billDetails.billType,
      title: billDetails.title,
      synopsis: billDetails.synopsis,
      fiscalNote: billDetails.fiscalNoteUrl,
      fullTextUrl: billDetails.fullTextUrl,
      pdfUrl: pdfObjectPath || billDetails.pdfUrl,
      introducedDate: billDetails.introducedDate,
      firstReadingDate: billDetails.firstReadingDate,
      crossFiledWith: billDetails.crossFiledWith,
      status: billDetails.status,
      sponsors: billDetails.sponsors,
      committees: billDetails.committees,
      relatedPrograms: billDetails.relatedPrograms,
      sourceUrl: billItem.detailUrl,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    };

    // Upsert bill into database
    if (existingBill) {
      await db.update(marylandBills)
        .set(billData)
        .where(eq(marylandBills.id, existingBill.id));
      
      result.billsUpdated++;
      logger.info('Bill updated', { billNumber: billDetails.billNumber });
    } else {
      const [insertedBill] = await db.insert(marylandBills)
        .values({
          ...billData,
          createdAt: new Date(),
        })
        .returning();
      
      result.billsStored++;
      logger.info('Bill created', { billNumber: billDetails.billNumber });

      // Create document record for RAG pipeline
      if (pdfObjectPath) {
        await this.createDocumentRecord(billDetails, pdfObjectPath, insertedBill.id);
      }
    }
  }

  /**
   * Fetch detailed bill information from bill detail page
   */
  private async fetchBillDetails(
    billItem: BillListItem,
    session: string
  ): Promise<BillDetails> {
    const response = await axios.get(billItem.detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarylandBenefitsBot/1.0)',
      },
    });

    const $ = cheerio.load(response.data);

    // Extract synopsis
    const synopsis = $('#details-dropdown-content0').text().trim() || 
                     $('div:contains("Synopsis")').next().text().trim();

    // Extract sponsors
    const sponsors: any[] = [];
    $('a[href*="/Members/Details/"]').each((i, el) => {
      const name = $(el).text().trim();
      if (name && !sponsors.find(s => s.name === name)) {
        sponsors.push({ name });
      }
    });

    // Extract committees
    const committees: any[] = [];
    $('a[href*="/Committees/Details/"]').each((i, el) => {
      const name = $(el).text().trim();
      if (name && !committees.find(c => c.name === name)) {
        committees.push({ name });
      }
    });

    // Extract status from progress tracker
    const status = this.extractStatus($);

    // Extract fiscal note URL
    const fiscalNoteEl = $('a[href*="/fnotes/"]').first();
    const fiscalNoteUrl = fiscalNoteEl.length 
      ? this.BASE_URL + fiscalNoteEl.attr('href') 
      : undefined;

    // Construct PDF URLs
    const billNumLower = billItem.billNumber.toLowerCase();
    const chamber = billItem.billType.startsWith('H') ? 'hb' : 'sb';
    const pdfUrl = `${this.BASE_URL}/${session}/bills/${chamber}/${billNumLower}F.pdf`;
    const fullTextUrl = `${this.BASE_URL}/${session}/bills/${chamber}/${billNumLower}T.pdf`;

    // Extract dates from history
    const introducedDate = this.extractDateFromHistory($, 'First Reading');
    const firstReadingDate = introducedDate;

    // Determine related programs
    const relatedPrograms = this.determineRelatedPrograms(
      billItem.title,
      synopsis
    );

    return {
      billNumber: billItem.billNumber,
      billType: billItem.billType,
      session,
      title: billItem.title,
      synopsis,
      sponsors,
      committees,
      status,
      fiscalNoteUrl,
      pdfUrl,
      fullTextUrl,
      crossFiledWith: billItem.crossFiledWith,
      introducedDate,
      firstReadingDate,
      relatedPrograms,
    };
  }

  /**
   * Extract bill status from progress tracker or history
   */
  private extractStatus($: cheerio.CheerioAPI): string {
    // Check history for latest status
    const latestAction = $('table.table-striped tbody tr').first().find('td').eq(3).text().toLowerCase();
    
    if (latestAction.includes('enacted') || latestAction.includes('signed')) {
      return 'enacted';
    }
    if (latestAction.includes('third reading passed')) {
      return 'passed_second';
    }
    if (latestAction.includes('second reading passed')) {
      return 'passed_first';
    }
    if (latestAction.includes('committee')) {
      return 'committee';
    }
    if (latestAction.includes('first reading')) {
      return 'introduced';
    }
    if (latestAction.includes('prefiled')) {
      return 'prefiled';
    }
    
    return 'introduced';
  }

  /**
   * Extract date from bill history
   */
  private extractDateFromHistory($: cheerio.CheerioAPI, actionText: string): Date | undefined {
    let foundDate: Date | undefined;
    
    $('table.table-striped tbody tr').each((i, row) => {
      const action = $(row).find('td').eq(3).text();
      if (action.toLowerCase().includes(actionText.toLowerCase())) {
        const dateStr = $(row).find('td').eq(1).text().trim();
        if (dateStr) {
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            foundDate = parsed;
            return false; // break
          }
        }
      }
    });
    
    return foundDate;
  }

  /**
   * Determine which benefit programs this bill relates to
   */
  private determineRelatedPrograms(title: string, synopsis?: string): string[] {
    const text = `${title} ${synopsis || ''}`.toLowerCase();
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
    if (text.includes('tax credit') || text.includes('eitc') || text.includes('earned income')) {
      programs.push('EITC');
    }
    if (text.includes('energy assistance')) {
      programs.push('Energy Assistance');
    }

    return programs;
  }

  /**
   * Download PDF and upload to object storage
   */
  private async downloadAndUploadPDF(
    pdfUrl: string,
    billNumber: string,
    session: string
  ): Promise<string> {
    logger.debug('Downloading PDF', { billNumber });

    // Download PDF
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarylandBenefitsBot/1.0)',
      },
      timeout: 30000,
    });

    const buffer = Buffer.from(response.data);

    // Upload to object storage
    const objectStorageService = new ObjectStorageService();
    const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: buffer,
      headers: {
        'Content-Type': 'application/pdf',
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload PDF: ${uploadResponse.statusText}`);
    }

    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
    logger.debug('Uploaded PDF', { objectPath });
    
    return objectPath;
  }

  /**
   * Create document record for RAG pipeline
   */
  private async createDocumentRecord(
    billDetails: BillDetails,
    objectPath: string,
    billId: string
  ): Promise<void> {
    try {
      const [document] = await db.insert(documents).values({
        filename: `${billDetails.billNumber}_${billDetails.session}.pdf`,
        originalName: `${billDetails.billNumber} - ${billDetails.title}`,
        objectPath,
        fileSize: 0, // Will be updated by document processor
        mimeType: 'application/pdf',
        status: 'uploaded',
        sourceUrl: billDetails.fullTextUrl,
        downloadedAt: new Date(),
        isGoldenSource: true,
        metadata: {
          source: 'maryland_legislature',
          billNumber: billDetails.billNumber,
          session: billDetails.session,
          title: billDetails.title,
          relatedPrograms: billDetails.relatedPrograms,
          billId,
        },
      }).returning();

      // Process document through RAG pipeline
      await documentProcessor.processDocument(document.id);
      
      logger.debug('Created document record for RAG pipeline');
    } catch (error) {
      logger.error('Error creating document record', { error });
    }
  }

  /**
   * Update policy source sync status
   */
  private async updatePolicySourceStatus(
    session: string,
    result: ScrapeResult
  ): Promise<void> {
    try {
      const sourceName = `Maryland Legislature - ${session}`;
      
      const existingSources = await db.select()
        .from(policySources)
        .where(eq(policySources.name, sourceName))
        .limit(1);

      const sourceData = {
        name: sourceName,
        sourceType: 'state_legislation' as const,
        jurisdiction: 'maryland' as const,
        description: `Maryland General Assembly legislation tracking for ${session}`,
        url: `https://mgaleg.maryland.gov/mgawebsite/Legislation/Index/house`,
        syncType: 'web_scraping' as const,
        syncSchedule: 'weekly' as const,
        lastSyncAt: new Date(),
        lastSuccessfulSyncAt: result.success ? new Date() : undefined,
        syncStatus: result.success ? 'success' : 'error',
        syncError: result.errors.length > 0 ? result.errors.join('; ') : null,
        documentCount: result.billsStored + result.billsUpdated,
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

  /**
   * Delay helper for respectful scraping
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const marylandLegislatureScraper = new MarylandLegislatureScraper();
