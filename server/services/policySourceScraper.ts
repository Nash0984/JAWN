import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { storage } from '../storage';
import type { InsertPolicySource, InsertDocument } from '../../shared/schema';

// Official Policy Sources Configuration
export const OFFICIAL_SOURCES: Omit<InsertPolicySource, 'benefitProgramId'>[] = [
  // Federal Regulations
  {
    name: '7 CFR Part 273 - SNAP Regulations',
    sourceType: 'federal_regulation',
    jurisdiction: 'federal',
    description: 'Code of Federal Regulations - Supplemental Nutrition Assistance Program',
    url: 'https://www.ecfr.gov/current/title-7/subtitle-B/chapter-II/subchapter-C/part-273',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'ecfr',
      sections: ['273.1', '273.2', '273.7', '273.8', '273.9', '273.10', '273.11', '273.12']
    }
  },
  
  // Federal Guidance
  {
    name: 'FNS Policy Memos',
    sourceType: 'federal_guidance',
    jurisdiction: 'federal',
    description: 'Food and Nutrition Service Policy Memoranda',
    url: 'https://www.fns.usda.gov/resources',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 90,
    isActive: true,
    syncConfig: {
      scrapeType: 'fns_memos',
      filters: ['SNAP', 'policy memo']
    }
  },
  
  {
    name: 'FNS Handbook 310 - SNAP Quality Control',
    sourceType: 'federal_guidance',
    jurisdiction: 'federal',
    description: 'SNAP Quality Control Review Handbook',
    url: 'https://www.fns.usda.gov/snap/qc/handbook310',
    syncType: 'web_scraping',
    syncSchedule: 'monthly',
    priority: 80,
    isActive: true,
    syncConfig: {
      scrapeType: 'fns_handbook',
      handbookId: '310'
    }
  },
  
  {
    name: 'SNAP E&T Operations Handbook',
    sourceType: 'federal_guidance',
    jurisdiction: 'federal',
    description: 'Employment & Training Operations Handbook',
    url: 'https://www.fns.usda.gov/snap-et/policy-guidance',
    syncType: 'web_scraping',
    syncSchedule: 'monthly',
    priority: 70,
    isActive: true,
    syncConfig: {
      scrapeType: 'fns_handbook',
      handbookId: 'et'
    }
  },
  
  {
    name: 'FNS Implementation Memoranda',
    sourceType: 'federal_memo',
    jurisdiction: 'federal',
    description: 'Federal implementation guidance and directives',
    url: 'https://www.fns.usda.gov/snap',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 85,
    isActive: true,
    syncConfig: {
      scrapeType: 'fns_implementation',
      documentTypes: ['memo', 'guidance', 'qa']
    }
  },
  
  // Maryland State Regulations
  {
    name: 'COMAR Title 10 - Maryland SNAP Regulations',
    sourceType: 'state_regulation',
    jurisdiction: 'maryland',
    description: 'Code of Maryland Regulations - Food Supplement Program',
    url: 'https://dsd.maryland.gov/pages/cod.aspx',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 95,
    isActive: true,
    syncConfig: {
      scrapeType: 'comar',
      title: '10',
      subtitles: ['10.01', '10.02']
    }
  },
  
  // Maryland State Policy
  {
    name: 'Maryland SNAP Policy Manual',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'Maryland Department of Human Services SNAP Policy Manual',
    url: 'https://dhs.maryland.gov/supplemental-nutrition-assistance-program/food-supplement-program-manual/',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'md_snap_manual',
      sections: 'all'
    }
  },
  
  {
    name: 'Maryland Action Transmittals (AT)',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'Official Maryland policy change transmittals',
    url: 'https://dhs.maryland.gov/business-center/documents/transmittals/',
    syncType: 'web_scraping',
    syncSchedule: 'daily',
    priority: 98,
    isActive: true,
    syncConfig: {
      scrapeType: 'md_transmittals',
      documentType: 'AT',
      years: [2024, 2023, 2022, 2021, 2020]
    }
  },
  
  {
    name: 'Maryland Information Memos (IM)',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'Maryland operational guidance memos',
    url: 'https://dhs.maryland.gov/business-center/documents/transmittals/',
    syncType: 'web_scraping',
    syncSchedule: 'daily',
    priority: 90,
    isActive: true,
    syncConfig: {
      scrapeType: 'md_transmittals',
      documentType: 'IM',
      years: [2024, 2023, 2022, 2021, 2020]
    }
  },

  // ===== OHEP (Office of Home Energy Programs) =====
  {
    name: 'OHEP Operations Manual',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'Maryland Office of Home Energy Programs Operations Manual',
    url: 'https://dhs.maryland.gov/documents/OHEP/OHEP-Operations-Manual.pdf',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'ohep_manual_pdf',
      isPrimaryManual: true
    }
  },

  {
    name: 'OHEP Forms and Documentation',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'OHEP program forms, guidance materials, and supplementary documentation',
    url: 'https://dhs.maryland.gov/office-of-home-energy-programs/',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 95,
    isActive: true,
    syncConfig: {
      scrapeType: 'ohep_forms_page',
      extractForms: true,
      extractGuidance: true
    }
  }
];

interface ScrapedDocument {
  title: string;
  url: string;
  content?: string;
  pdfUrl?: string;
  effectiveDate?: Date;
  sectionNumber?: string;
  metadata: Record<string, any>;
}

export class PolicySourceScraper {
  
  /**
   * Initialize all official policy sources in the database
   */
  async seedPolicySources(): Promise<void> {
    try {
      console.log('Seeding official policy sources...');
      
      // Get or create SNAP program
      const snapProgram = await storage.getBenefitProgramByCode('MD_SNAP');
      if (!snapProgram) {
        throw new Error('SNAP benefit program not found');
      }
      
      for (const sourceConfig of OFFICIAL_SOURCES) {
        // Check if source already exists
        const allSources = await storage.getPolicySources();
        const existing = allSources.find(s => 
          s.name === sourceConfig.name && s.jurisdiction === sourceConfig.jurisdiction
        );
        
        if (!existing) {
          await storage.createPolicySource({
            ...sourceConfig,
            benefitProgramId: snapProgram.id
          });
          console.log(`✓ Created policy source: ${sourceConfig.name}`);
        } else {
          console.log(`→ Policy source already exists: ${sourceConfig.name}`);
        }
      }
      
      console.log('✓ Policy sources seeded successfully');
    } catch (error) {
      console.error('Error seeding policy sources:', error);
      throw error;
    }
  }
  
  /**
   * Scrape Maryland Action Transmittals and Information Memos
   */
  async scrapeMarylandTransmittals(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    const { documentType, years } = config;
    
    for (const year of years) {
      try {
        const baseUrl = `https://dhs.maryland.gov/documents/?dir=FIA/Action+Transmittals-AT+-+Information+Memo-IM/AT-IM${year}`;
        const response = await axios.get(baseUrl, {
          headers: {
            'User-Agent': 'Maryland SNAP Policy Manual System/1.0'
          },
          timeout: 30000
        });
        
        const $ = cheerio.load(response.data);
        
        // Find PDF links
        $('a[href$=".pdf"]').each((_, element) => {
          const href = $(element).attr('href');
          const text = $(element).text().trim();
          
          // Filter by document type (AT or IM)
          if (href && text.includes(documentType)) {
            const fullUrl = href.startsWith('http') ? href : `https://dhs.maryland.gov${href}`;
            
            // Extract AT/IM number from filename
            const match = text.match(/(\d{2}-\d{2})\s*(AT|IM)/i);
            const number = match ? match[1] : '';
            
            documents.push({
              title: text,
              url: fullUrl,
              pdfUrl: fullUrl,
              sectionNumber: `${documentType}-${number}`,
              metadata: {
                year,
                documentType,
                number,
                source: 'Maryland DHS FIA'
              }
            });
          }
        });
        
        console.log(`✓ Found ${documents.length} ${documentType} documents for ${year}`);
      } catch (error) {
        console.error(`Error scraping ${documentType} for ${year}:`, error);
      }
    }
    
    return documents;
  }
  
  /**
   * Scrape 7 CFR (eCFR) sections
   */
  async scrapeCFR(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    const { sections } = config;
    
    for (const section of sections) {
      try {
        const url = `https://www.ecfr.gov/current/title-7/section-${section}`;
        const response = await axios.get(url, {
          timeout: 30000,
          headers: {
            'User-Agent': 'Maryland SNAP Policy Manual System/1.0'
          }
        });
        
        const $ = cheerio.load(response.data);
        const content = $('#content-body').text().trim();
        const title = $('h1').first().text().trim();
        
        if (content) {
          documents.push({
            title: title || `7 CFR §${section}`,
            url,
            content,
            sectionNumber: section,
            metadata: {
              regulation: '7 CFR',
              section,
              source: 'eCFR'
            }
          });
          
          console.log(`✓ Scraped 7 CFR §${section}`);
        }
      } catch (error) {
        console.error(`Error scraping 7 CFR §${section}:`, error);
      }
    }
    
    return documents;
  }
  
  /**
   * Scrape FNS resources and memos
   */
  async scrapeFNSMemos(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const response = await axios.get('https://www.fns.usda.gov/resources', {
        timeout: 30000,
        headers: {
          'User-Agent': 'Maryland SNAP Policy Manual System/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Find SNAP policy memo links
      $('a[href*="snap"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && (text.toLowerCase().includes('memo') || text.toLowerCase().includes('policy'))) {
          const fullUrl = href.startsWith('http') ? href : `https://www.fns.usda.gov${href}`;
          
          documents.push({
            title: text,
            url: fullUrl,
            pdfUrl: href.endsWith('.pdf') ? fullUrl : undefined,
            metadata: {
              source: 'FNS',
              documentType: 'policy_memo'
            }
          });
        }
      });
      
      console.log(`✓ Found ${documents.length} FNS memos`);
    } catch (error) {
      console.error('Error scraping FNS memos:', error);
    }
    
    return documents;
  }
  
  /**
   * Scrape OHEP Operations Manual PDF
   */
  async scrapeOHEPManualPDF(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const url = 'https://dhs.maryland.gov/documents/OHEP/OHEP-Operations-Manual.pdf';
      
      // Fetch PDF to get metadata
      const response = await axios.head(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0'
        }
      });
      
      const lastModified = response.headers['last-modified'] 
        ? new Date(response.headers['last-modified']) 
        : new Date();
      
      documents.push({
        title: 'OHEP Operations Manual',
        url,
        pdfUrl: url,
        effectiveDate: lastModified,
        sectionNumber: 'OHEP-MANUAL',
        metadata: {
          program: 'OHEP',
          documentType: 'operations_manual',
          source: 'Maryland DHS OHEP',
          isPrimaryManual: true
        }
      });
      
      console.log('✓ Found OHEP Operations Manual PDF');
    } catch (error) {
      console.error('Error scraping OHEP manual PDF:', error);
    }
    
    return documents;
  }

  /**
   * Scrape OHEP Forms and Documentation page
   */
  async scrapeOHEPFormsPage(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const url = 'https://dhs.maryland.gov/office-of-home-energy-programs/';
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract all PDF links (forms, guidance documents, etc.)
      $('a[href$=".pdf"], a[href*="/documents/OHEP/"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && text && !href.includes('OHEP-Operations-Manual.pdf')) {
          const fullUrl = href.startsWith('http') ? href : `https://dhs.maryland.gov${href}`;
          
          // Determine document type from text/URL
          let documentType = 'guidance';
          if (text.toLowerCase().includes('form') || text.toLowerCase().includes('application')) {
            documentType = 'form';
          } else if (text.toLowerCase().includes('fact sheet') || text.toLowerCase().includes('information')) {
            documentType = 'information';
          }
          
          documents.push({
            title: text || `OHEP Document - ${href.split('/').pop()}`,
            url: fullUrl,
            pdfUrl: fullUrl,
            sectionNumber: `OHEP-${documentType.toUpperCase()}-${Date.now()}`,
            metadata: {
              program: 'OHEP',
              documentType,
              source: 'Maryland DHS OHEP Website',
              extractedFrom: url
            }
          });
        }
      });
      
      // Also extract any downloadable Word/Excel documents
      $('a[href$=".doc"], a[href$=".docx"], a[href$=".xls"], a[href$=".xlsx"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && text) {
          const fullUrl = href.startsWith('http') ? href : `https://dhs.maryland.gov${href}`;
          const extension = href.split('.').pop()?.toLowerCase();
          
          documents.push({
            title: text,
            url: fullUrl,
            pdfUrl: fullUrl,
            sectionNumber: `OHEP-DOC-${Date.now()}`,
            metadata: {
              program: 'OHEP',
              documentType: 'form',
              fileType: extension,
              source: 'Maryland DHS OHEP Website'
            }
          });
        }
      });
      
      console.log(`✓ Found ${documents.length} OHEP forms and documents`);
    } catch (error) {
      console.error('Error scraping OHEP forms page:', error);
    }
    
    return documents;
  }

  /**
   * Download and process a document from a scraped source
   */
  async downloadAndProcessDocument(
    scrapedDoc: ScrapedDocument,
    policySourceId: string,
    benefitProgramId: string,
    userId: string
  ): Promise<{ documentId: string; document: any } | null> {
    try {
      let content: Buffer | null = null;
      let filename: string;
      let mimeType: string;
      
      // Download PDF if available
      if (scrapedDoc.pdfUrl) {
        const response = await axios.get(scrapedDoc.pdfUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: {
            'User-Agent': 'Maryland SNAP Policy Manual System/1.0'
          }
        });
        
        content = Buffer.from(response.data);
        filename = scrapedDoc.pdfUrl.split('/').pop() || `document-${Date.now()}.pdf`;
        mimeType = 'application/pdf';
      } else if (scrapedDoc.content) {
        // Store text content as HTML
        content = Buffer.from(scrapedDoc.content, 'utf-8');
        filename = `${scrapedDoc.sectionNumber || 'content'}.html`;
        mimeType = 'text/html';
      } else {
        console.log(`⚠ No content available for: ${scrapedDoc.title}`);
        return null;
      }
      
      // Calculate document hash for integrity tracking
      const documentHash = crypto.createHash('sha256').update(content).digest('hex');
      
      // Create document record
      const document: InsertDocument = {
        filename,
        originalName: scrapedDoc.title,
        documentTypeId: null, // Will be set based on metadata
        benefitProgramId,
        fileSize: content.length,
        mimeType,
        uploadedBy: userId,
        status: 'uploaded',
        sourceUrl: scrapedDoc.url,
        downloadedAt: new Date(),
        documentHash,
        isGoldenSource: true,
        sectionNumber: scrapedDoc.sectionNumber,
        lastModifiedAt: scrapedDoc.effectiveDate,
        metadata: scrapedDoc.metadata,
        auditTrail: {
          source: 'policy_source_scraper',
          policySourceId,
          scrapedAt: new Date(),
          url: scrapedDoc.url
        }
      };
      
      const createdDocument = await storage.createDocument(document);
      console.log(`✓ Downloaded and stored: ${scrapedDoc.title}`);
      
      // TODO: Queue document for processing (OCR, chunking, embedding generation)
      
      return { documentId: createdDocument.id, document: createdDocument };
    } catch (error) {
      console.error(`Error downloading document ${scrapedDoc.title}:`, error);
      return null;
    }
  }
  
  /**
   * Execute scraping for a specific policy source
   */
  async scrapeSource(policySourceId: string): Promise<number> {
    try {
      const source = await storage.getPolicySourceById(policySourceId);
      if (!source) {
        throw new Error(`Policy source ${policySourceId} not found`);
      }
      
      console.log(`Starting scrape for: ${source.name}`);
      
      // Update sync status
      await storage.updatePolicySource(policySourceId, {
        syncStatus: 'syncing',
        lastSyncAt: new Date()
      });
      
      let documents: ScrapedDocument[] = [];
      const config = source.syncConfig as any;
      
      // Route to appropriate scraper based on scrapeType
      if (config?.scrapeType === 'md_transmittals') {
        documents = await this.scrapeMarylandTransmittals(policySourceId, config);
      } else if (config?.scrapeType === 'ecfr') {
        documents = await this.scrapeCFR(policySourceId, config);
      } else if (config?.scrapeType === 'fns_memos') {
        documents = await this.scrapeFNSMemos(policySourceId, config);
      } else if (config?.scrapeType === 'ohep_manual_pdf') {
        documents = await this.scrapeOHEPManualPDF(policySourceId, config);
      } else if (config?.scrapeType === 'ohep_forms_page') {
        documents = await this.scrapeOHEPFormsPage(policySourceId, config);
      } else {
        console.log(`⚠ Scraper not yet implemented for: ${config?.scrapeType}`);
      }
      
      console.log(`✓ Scraped ${documents.length} documents from ${source.name}`);
      
      // Update sync status
      await storage.updatePolicySource(policySourceId, {
        syncStatus: 'success',
        lastSuccessfulSyncAt: new Date(),
        documentCount: documents.length,
        syncError: null
      });
      
      return documents.length;
    } catch (error: any) {
      console.error(`Error scraping source ${policySourceId}:`, error);
      
      await storage.updatePolicySource(policySourceId, {
        syncStatus: 'error',
        syncError: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Scrape all active policy sources
   */
  async scrapeAllSources(): Promise<void> {
    try {
      const sources = await storage.getPolicySources();
      const activeSources = sources
        .filter((s: any) => s.isActive)
        .sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
      
      console.log(`Scraping ${activeSources.length} active policy sources...`);
      
      for (const source of activeSources) {
        try {
          await this.scrapeSource(source.id);
        } catch (error) {
          console.error(`Failed to scrape ${source.name}:`, error);
          // Continue with other sources
        }
      }
      
      console.log('✓ Completed scraping all sources');
    } catch (error) {
      console.error('Error scraping all sources:', error);
      throw error;
    }
  }
}

export const policySourceScraper = new PolicySourceScraper();
