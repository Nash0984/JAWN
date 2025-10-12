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
  },

  // ===== MEDICAID =====
  {
    name: 'Maryland Medicaid Manual',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'Maryland Medicaid Eligibility Manual - All Sections',
    url: 'https://health.maryland.gov/mmcp/pages/medicaidmanual.aspx',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'md_medicaid_manual',
      extractSections: true,
      extractMCHP: true,
      extractSupplements: true,
      extractResources: true
    }
  },

  {
    name: 'COMAR 10.09.24 - Medicaid Eligibility Regulations',
    sourceType: 'state_regulation',
    jurisdiction: 'maryland',
    description: 'Code of Maryland Regulations - Medicaid Eligibility',
    url: 'https://bit.ly/3QYOR2L',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 95,
    isActive: true,
    syncConfig: {
      scrapeType: 'comar_medicaid',
      regulation: '10.09.24'
    }
  },

  // ===== TCA (Temporary Cash Assistance / TANF) =====
  {
    name: 'TCA Main Page - Forms and Resources',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'TCA/TANF program information, forms, fact sheets, and guidance materials',
    url: 'https://dhs.maryland.gov/weathering-tough-times/temporary-cash-assistance/',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'tca_main_page',
      extractForms: true,
      extractFactSheets: true,
      extractGuidance: true,
      extractWorkProgram: true
    }
  },

  {
    name: 'TCA Policy Manual',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'Temporary Cash Assistance Policy Manual - Complete sections and guidance',
    url: 'https://dhs.maryland.gov/documents/?dir=FIA/Manuals/Temporary-Cash-Assistance-Manual',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'tca_manual_directory',
      extractAllSections: true,
      extractSupplements: true
    }
  },

  // Maryland Tax Credits - SDAT Property Tax Programs
  {
    name: 'SDAT Tax Credit Programs Portal',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'Maryland Department of Assessments and Taxation - Property tax credit programs overview',
    url: 'https://dat.maryland.gov/pages/tax-credit-programs.aspx',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'sdat_tax_credits_portal',
      extractOverviews: true,
      extractLinkedPdfs: true
    }
  },

  {
    name: 'Renters\' Tax Credit Program',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'Maryland Renters\' Tax Credit - Eligibility rules, income limits, application process',
    url: 'https://dat.maryland.gov/realproperty/pages/renters\'-tax-credits.aspx',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'renters_tax_credit',
      extractEligibilityRules: true,
      extractIncomeLimits: true,
      extractApplicationForms: true
    }
  },

  {
    name: 'Homeowners\' Property Tax Credit Program',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'Maryland Homeowners\' Property Tax Credit (Circuit Breaker) - Rules and calculators',
    url: 'https://dat.maryland.gov/realproperty/pages/homeowners\'-property-tax-credit-program.aspx',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'homeowners_tax_credit',
      extractCircuitBreakerRules: true,
      extractCalculators: true,
      extractApplicationForms: true
    }
  },

  {
    name: 'Maryland Comptroller Tax Credits',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'Maryland Comptroller - Income tax credits, deductions, and subtractions',
    url: 'https://www.marylandtaxes.gov/tax-credits.php',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'comptroller_tax_credits',
      extractIncomeTaxCredits: true,
      extractDeductions: true,
      extractGuidance: true
    }
  },

  {
    name: 'OneStop Tax Credit Forms Portal',
    sourceType: 'state_policy',
    jurisdiction: 'maryland',
    description: 'Maryland OneStop - All SDAT tax credit application forms (RTC, HTC, HST)',
    url: 'https://onestop.md.gov/tags/5d28c76eb7039400faf44adb',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'onestop_tax_forms',
      extractRentersForms: true,
      extractHomeownersForms: true,
      extractHomesteadForms: true
    }
  },

  // ===== VITA (Volunteer Income Tax Assistance) - 2025 Materials Only =====
  {
    name: 'IRS Pub 4012 - VITA/TCE Volunteer Resource Guide',
    sourceType: 'federal_guidance',
    jurisdiction: 'federal',
    description: 'Primary VITA reference guide for volunteer tax preparation (2025 tax year)',
    url: 'https://www.irs.gov/pub/irs-pdf/p4012.pdf',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'irs_vita_pdf',
      publicationNumber: '4012',
      minRevisionYear: 2025,
      extractTaxLaw: true,
      extractEligibilityRules: true
    }
  },

  {
    name: 'IRS Pub 4491 - VITA/TCE Training Guide',
    sourceType: 'federal_guidance',
    jurisdiction: 'federal',
    description: 'Core VITA training guide with lessons for all certification levels (2025 tax year)',
    url: 'https://www.irs.gov/pub/irs-pdf/p4491.pdf',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 95,
    isActive: true,
    syncConfig: {
      scrapeType: 'irs_vita_pdf',
      publicationNumber: '4491',
      minRevisionYear: 2025,
      extractTrainingContent: true,
      extractScenarios: true
    }
  },

  {
    name: 'IRS Pub 4491-X - VITA/TCE Training Supplement',
    sourceType: 'federal_guidance',
    jurisdiction: 'federal',
    description: 'Updates to VITA training materials after initial printing (Rev. 1-2025)',
    url: 'https://www.irs.gov/pub/irs-pdf/p4491x.pdf',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 98,
    isActive: true,
    syncConfig: {
      scrapeType: 'irs_vita_pdf',
      publicationNumber: '4491-X',
      minRevisionYear: 2025,
      revisionMonth: 1,
      extractUpdates: true,
      extractCorrections: true
    }
  },

  {
    name: 'IRS Pub 4961 - VITA/TCE Volunteer Standards of Conduct',
    sourceType: 'federal_guidance',
    jurisdiction: 'federal',
    description: 'Required ethics training for all VITA volunteers (Rev. 5-2025)',
    url: 'https://www.irs.gov/pub/irs-pdf/p4961.pdf',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 100,
    isActive: true,
    syncConfig: {
      scrapeType: 'irs_vita_pdf',
      publicationNumber: '4961',
      minRevisionYear: 2025,
      revisionMonth: 5,
      extractEthicsRules: true,
      extractConduct: true
    }
  },

  {
    name: 'IRS Form 6744 - VITA/TCE Volunteer Assistor Test/Retest',
    sourceType: 'federal_guidance',
    jurisdiction: 'federal',
    description: 'Practice scenarios and certification test questions (2025 tax returns)',
    url: 'https://www.irs.gov/pub/irs-pdf/f6744.pdf',
    syncType: 'web_scraping',
    syncSchedule: 'weekly',
    priority: 90,
    isActive: true,
    syncConfig: {
      scrapeType: 'irs_vita_pdf',
      formNumber: '6744',
      taxYear: 2025,
      extractTestQuestions: true,
      extractScenarios: true,
      extractAnswerKey: true
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
      
      // Get all necessary programs first
      const snapProgram = await storage.getBenefitProgramByCode('MD_SNAP');
      if (!snapProgram) {
        throw new Error('SNAP benefit program not found');
      }
      
      const taxCreditsProgram = await storage.getBenefitProgramByCode('MD_TAX_CREDITS');
      const medicaidProgram = await storage.getBenefitProgramByCode('MD_MEDICAID');
      const tcaProgram = await storage.getBenefitProgramByCode('MD_TANF');
      const ohepProgram = await storage.getBenefitProgramByCode('MD_OHEP');
      const vitaProgram = await storage.getBenefitProgramByCode('VITA');
      
      for (const sourceConfig of OFFICIAL_SOURCES) {
        // Check if source already exists
        const allSources = await storage.getPolicySources();
        const existing = allSources.find(s => 
          s.name === sourceConfig.name && s.jurisdiction === sourceConfig.jurisdiction
        );
        
        // Determine which program this source belongs to
        let programId = snapProgram.id;
        
        // VITA sources
        const isVITASource = sourceConfig.name.toLowerCase().includes('vita') ||
                            sourceConfig.name.toLowerCase().includes('pub 4012') ||
                            sourceConfig.name.toLowerCase().includes('pub 4491') ||
                            sourceConfig.name.toLowerCase().includes('pub 4961') ||
                            sourceConfig.name.toLowerCase().includes('form 6744');
        
        // Tax Credit sources
        const isTaxCreditSource = sourceConfig.name.toLowerCase().includes('tax credit') || 
                                  sourceConfig.name.toLowerCase().includes('sdat') ||
                                  sourceConfig.name.toLowerCase().includes('comptroller') ||
                                  sourceConfig.name.toLowerCase().includes('onestop');
        
        // OHEP sources
        const isOHEPSource = sourceConfig.name.toLowerCase().includes('ohep') ||
                            sourceConfig.name.toLowerCase().includes('energy');
        
        // Medicaid sources
        const isMedicaidSource = sourceConfig.name.toLowerCase().includes('medicaid') ||
                                sourceConfig.name.toLowerCase().includes('mchp');
        
        // TCA sources
        const isTCASource = sourceConfig.name.toLowerCase().includes('tca') ||
                           sourceConfig.name.toLowerCase().includes('temporary cash');
        
        // Assign appropriate program ID
        if (isVITASource && vitaProgram) {
          programId = vitaProgram.id;
        } else if (isTaxCreditSource && taxCreditsProgram) {
          programId = taxCreditsProgram.id;
        } else if (isOHEPSource && ohepProgram) {
          programId = ohepProgram.id;
        } else if (isMedicaidSource && medicaidProgram) {
          programId = medicaidProgram.id;
        } else if (isTCASource && tcaProgram) {
          programId = tcaProgram.id;
        }
        
        const programName = isVITASource ? 'VITA' : 
                           isTaxCreditSource ? 'Tax Credits' : 
                           isOHEPSource ? 'OHEP' : 
                           isMedicaidSource ? 'Medicaid' : 
                           isTCASource ? 'TCA' : 'SNAP';
        
        if (!existing) {
          await storage.createPolicySource({
            ...sourceConfig,
            benefitProgramId: programId
          });
          console.log(`✓ Created policy source: ${sourceConfig.name} → ${programName}`);
        } else {
          // Update existing source to ensure correct program association
          await storage.updatePolicySource(existing.id, {
            benefitProgramId: programId
          });
          console.log(`✓ Updated policy source: ${sourceConfig.name} → ${programName}`);
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
   * Scrape Maryland Medicaid Manual and supplements
   */
  async scrapeMedicaidManual(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const url = 'https://health.maryland.gov/mmcp/pages/medicaidmanual.aspx';
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract all Medicaid Manual section PDFs
      $('a[href*="/mmcp/Medicaid%20Manual/"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && text && href.endsWith('.pdf')) {
          const fullUrl = href.startsWith('http') ? href : `https://health.maryland.gov${href}`;
          
          // Extract section number from text
          const sectionMatch = text.match(/Section (\d+)/i) || text.match(/(\d+)/);
          const sectionNumber = sectionMatch ? `MED-${sectionMatch[1]}` : 'MED-INTRO';
          
          documents.push({
            title: text,
            url: fullUrl,
            pdfUrl: fullUrl,
            sectionNumber,
            metadata: {
              program: 'Medicaid',
              documentType: 'manual_section',
              source: 'Maryland Department of Health',
              category: 'eligibility_manual'
            }
          });
        }
      });
      
      // Extract MCHP Manual
      $('a[href*="MCHP%20Manual"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `https://health.maryland.gov${href}`;
          
          documents.push({
            title: text || 'Maryland Children\'s Health Program (MCHP) Manual',
            url: fullUrl,
            pdfUrl: fullUrl,
            sectionNumber: 'MCHP-MANUAL',
            metadata: {
              program: 'MCHP',
              documentType: 'policy_manual',
              source: 'Maryland Department of Health',
              category: 'childrens_health'
            }
          });
        }
      });
      
      // Extract Action Transmittals from supplements table
      $('a[href*="/mmcp/ManualSupplements/AT"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `https://health.maryland.gov${href}`;
          
          // Extract AT number
          const atMatch = text.match(/AT\s*(\d{2}-\d{2})/i);
          const atNumber = atMatch ? atMatch[1] : text;
          
          documents.push({
            title: `Action Transmittal ${atNumber}`,
            url: fullUrl,
            pdfUrl: fullUrl,
            sectionNumber: `MED-AT-${atNumber}`,
            metadata: {
              program: 'Medicaid',
              documentType: 'action_transmittal',
              source: 'Maryland Department of Health',
              transmittalNumber: atNumber
            }
          });
        }
      });
      
      // Extract additional resource PDFs
      $('a[href*="coverage-group"], a[href*="Coverage%20Groups"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && href.endsWith('.pdf')) {
          const fullUrl = href.startsWith('http') ? href : `https://health.maryland.gov${href}`;
          
          documents.push({
            title: text,
            url: fullUrl,
            pdfUrl: fullUrl,
            sectionNumber: 'MED-RESOURCE',
            metadata: {
              program: 'Medicaid',
              documentType: 'reference_guide',
              source: 'Maryland Department of Health'
            }
          });
        }
      });
      
      console.log(`✓ Found ${documents.length} Medicaid manual documents`);
    } catch (error) {
      console.error('Error scraping Medicaid manual:', error);
    }
    
    return documents;
  }

  /**
   * Scrape TCA Main Page for all forms, fact sheets, and resources
   */
  async scrapeTCAMainPage(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const url = 'https://dhs.maryland.gov/weathering-tough-times/temporary-cash-assistance/';
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract all PDF documents
      $('a[href$=".pdf"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && text) {
          const fullUrl = href.startsWith('http') ? href : `https://dhs.maryland.gov${href}`;
          
          // Categorize document type based on text
          let documentType = 'guidance';
          if (text.toLowerCase().includes('application') || text.toLowerCase().includes('form')) {
            documentType = 'form';
          } else if (text.toLowerCase().includes('fact sheet') || text.toLowerCase().includes('information')) {
            documentType = 'fact_sheet';
          } else if (text.toLowerCase().includes('work') || text.toLowerCase().includes('earn')) {
            documentType = 'work_program';
          }
          
          documents.push({
            title: text,
            url: fullUrl,
            pdfUrl: fullUrl,
            sectionNumber: `TCA-${documentType.toUpperCase()}-${Date.now()}`,
            metadata: {
              program: 'TCA',
              documentType,
              source: 'Maryland DHS TCA Program',
              extractedFrom: url
            }
          });
        }
      });
      
      // Extract Word/Excel documents
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
            sectionNumber: `TCA-FORM-${Date.now()}`,
            metadata: {
              program: 'TCA',
              documentType: 'form',
              fileType: extension,
              source: 'Maryland DHS TCA Program'
            }
          });
        }
      });
      
      console.log(`✓ Found ${documents.length} TCA forms and resources`);
    } catch (error) {
      console.error('Error scraping TCA main page:', error);
    }
    
    return documents;
  }

  /**
   * Scrape TCA Manual Directory for all policy sections
   */
  async scrapeTCAManualDirectory(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const url = 'https://dhs.maryland.gov/documents/?dir=FIA/Manuals/Temporary-Cash-Assistance-Manual';
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract all document links from the directory
      $('a[href*="Temporary-Cash-Assistance-Manual"], a[href*="/FIA/Manuals/"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && text && (href.endsWith('.pdf') || href.endsWith('.doc') || href.endsWith('.docx'))) {
          const fullUrl = href.startsWith('http') ? href : `https://dhs.maryland.gov${href}`;
          
          // Extract section/chapter number if available
          const sectionMatch = text.match(/(?:Section|Chapter|Part)\s*(\d+)/i) || text.match(/^(\d+)/);
          const sectionNumber = sectionMatch ? `TCA-${sectionMatch[1]}` : `TCA-MANUAL-${Date.now()}`;
          
          // Determine document type
          let documentType = 'manual_section';
          if (text.toLowerCase().includes('appendix')) {
            documentType = 'appendix';
          } else if (text.toLowerCase().includes('table of contents') || text.toLowerCase().includes('toc')) {
            documentType = 'table_of_contents';
          } else if (text.toLowerCase().includes('supplement') || text.toLowerCase().includes('transmittal')) {
            documentType = 'supplement';
          }
          
          documents.push({
            title: text,
            url: fullUrl,
            pdfUrl: fullUrl,
            sectionNumber,
            metadata: {
              program: 'TCA',
              documentType,
              source: 'Maryland DHS TCA Manual',
              category: 'policy_manual'
            }
          });
        }
      });
      
      // Also capture any standalone PDFs in the directory
      $('a[href$=".pdf"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && text && href.includes('FIA') && !documents.find(doc => doc.url === href)) {
          const fullUrl = href.startsWith('http') ? href : `https://dhs.maryland.gov${href}`;
          
          documents.push({
            title: text || `TCA Document - ${href.split('/').pop()}`,
            url: fullUrl,
            pdfUrl: fullUrl,
            sectionNumber: `TCA-DOC-${Date.now()}`,
            metadata: {
              program: 'TCA',
              documentType: 'reference',
              source: 'Maryland DHS TCA Manual Directory'
            }
          });
        }
      });
      
      console.log(`✓ Found ${documents.length} TCA manual documents`);
    } catch (error) {
      console.error('Error scraping TCA manual directory:', error);
    }
    
    return documents;
  }

  /**
   * Scrape SDAT Tax Credit Programs Portal
   */
  async scrapeSDATTaxCreditsPortal(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const url = 'https://dat.maryland.gov/pages/tax-credit-programs.aspx';
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract all PDF links and program overview pages
      $('a[href*=".pdf"], a[href*="tax-credit"], a[href*="property-tax"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && text) {
          const fullUrl = href.startsWith('http') ? href : `https://dat.maryland.gov${href}`;
          const isPdf = href.toLowerCase().endsWith('.pdf');
          
          documents.push({
            title: text,
            url: fullUrl,
            pdfUrl: isPdf ? fullUrl : undefined,
            metadata: {
              program: 'Tax Credits',
              documentType: isPdf ? 'guidance' : 'program_overview',
              source: 'SDAT Tax Credit Programs Portal',
              category: 'property_tax'
            }
          });
        }
      });
      
      console.log(`✓ Found ${documents.length} SDAT tax credit documents`);
    } catch (error) {
      console.error('Error scraping SDAT tax credits portal:', error);
    }
    
    return documents;
  }

  /**
   * Scrape Renters' Tax Credit Program page
   */
  async scrapeRentersTaxCredit(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const url = 'https://dat.maryland.gov/realproperty/pages/renters\'-tax-credits.aspx';
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract eligibility information as structured content
      const eligibilityContent = $('.eligibility, .requirements, .how-to-apply').text().trim();
      if (eligibilityContent) {
        documents.push({
          title: 'Renters\' Tax Credit - Eligibility Requirements',
          url,
          content: eligibilityContent,
          metadata: {
            program: 'Tax Credits',
            documentType: 'eligibility_rules',
            source: 'SDAT Renters\' Tax Credit',
            category: 'property_tax',
            creditType: 'renters'
          }
        });
      }
      
      // Extract all PDF forms and guidance
      $('a[href*=".pdf"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && text) {
          const fullUrl = href.startsWith('http') ? href : `https://dat.maryland.gov${href}`;
          
          documents.push({
            title: text,
            url: fullUrl,
            pdfUrl: fullUrl,
            metadata: {
              program: 'Tax Credits',
              documentType: text.toLowerCase().includes('application') ? 'application_form' : 'guidance',
              source: 'SDAT Renters\' Tax Credit',
              category: 'property_tax',
              creditType: 'renters'
            }
          });
        }
      });
      
      console.log(`✓ Found ${documents.length} Renters' Tax Credit documents`);
    } catch (error) {
      console.error('Error scraping Renters\' Tax Credit:', error);
    }
    
    return documents;
  }

  /**
   * Scrape Homeowners' Property Tax Credit Program page
   */
  async scrapeHomeownersTaxCredit(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const url = 'https://dat.maryland.gov/realproperty/pages/homeowners\'-property-tax-credit-program.aspx';
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract circuit breaker rules as structured content
      const rulesContent = $('.circuit-breaker, .credit-calculation, .eligibility').text().trim();
      if (rulesContent) {
        documents.push({
          title: 'Homeowners\' Property Tax Credit - Circuit Breaker Rules',
          url,
          content: rulesContent,
          metadata: {
            program: 'Tax Credits',
            documentType: 'eligibility_rules',
            source: 'SDAT Homeowners\' Tax Credit',
            category: 'property_tax',
            creditType: 'homeowners'
          }
        });
      }
      
      // Extract all PDF forms, calculators, and guidance
      $('a[href*=".pdf"], a[href*="calculator"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && text) {
          const fullUrl = href.startsWith('http') ? href : `https://dat.maryland.gov${href}`;
          const isPdf = href.toLowerCase().endsWith('.pdf');
          
          let docType = 'guidance';
          if (text.toLowerCase().includes('application')) docType = 'application_form';
          else if (text.toLowerCase().includes('calculator')) docType = 'calculator';
          
          documents.push({
            title: text,
            url: fullUrl,
            pdfUrl: isPdf ? fullUrl : undefined,
            metadata: {
              program: 'Tax Credits',
              documentType: docType,
              source: 'SDAT Homeowners\' Tax Credit',
              category: 'property_tax',
              creditType: 'homeowners'
            }
          });
        }
      });
      
      console.log(`✓ Found ${documents.length} Homeowners' Tax Credit documents`);
    } catch (error) {
      console.error('Error scraping Homeowners\' Tax Credit:', error);
    }
    
    return documents;
  }

  /**
   * Scrape Maryland Comptroller Tax Credits page
   */
  async scrapeComptrollerTaxCredits(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const url = 'https://www.marylandtaxes.gov/tax-credits.php';
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract all income tax credit links and PDFs
      $('a[href*="credit"], a[href*=".pdf"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && text && !href.includes('javascript')) {
          const fullUrl = href.startsWith('http') ? href : `https://www.marylandtaxes.gov${href}`;
          const isPdf = href.toLowerCase().endsWith('.pdf');
          
          let docType = 'guidance';
          if (text.toLowerCase().includes('form')) docType = 'form';
          else if (text.toLowerCase().includes('instruction')) docType = 'instructions';
          else if (text.toLowerCase().includes('deduction')) docType = 'deduction_rules';
          
          documents.push({
            title: text,
            url: fullUrl,
            pdfUrl: isPdf ? fullUrl : undefined,
            metadata: {
              program: 'Tax Credits',
              documentType: docType,
              source: 'Maryland Comptroller',
              category: 'income_tax'
            }
          });
        }
      });
      
      console.log(`✓ Found ${documents.length} Comptroller tax credit documents`);
    } catch (error) {
      console.error('Error scraping Comptroller tax credits:', error);
    }
    
    return documents;
  }

  /**
   * Scrape OneStop Tax Credit Forms Portal
   */
  async scrapeOneStopTaxForms(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    
    try {
      const url = 'https://onestop.md.gov/tags/5d28c76eb7039400faf44adb';
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract all form links (RTC, HTC, HST)
      $('a[href*="form"], a[href*="application"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && text) {
          const fullUrl = href.startsWith('http') ? href : `https://onestop.md.gov${href}`;
          
          // Determine form type
          let formType = 'other';
          if (text.toLowerCase().includes('renter') || href.includes('rtc')) {
            formType = 'renters';
          } else if (text.toLowerCase().includes('homeowner') || href.includes('htc')) {
            formType = 'homeowners';
          } else if (text.toLowerCase().includes('homestead') || href.includes('hst')) {
            formType = 'homestead';
          }
          
          documents.push({
            title: text,
            url: fullUrl,
            metadata: {
              program: 'Tax Credits',
              documentType: 'application_form',
              source: 'Maryland OneStop Portal',
              category: 'property_tax',
              formType
            }
          });
        }
      });
      
      console.log(`✓ Found ${documents.length} OneStop tax credit forms`);
    } catch (error) {
      console.error('Error scraping OneStop tax forms:', error);
    }
    
    return documents;
  }

  /**
   * Scrape IRS VITA PDF Publications with 2025+ filtering
   * Downloads PDF, extracts revision info, and filters by year
   */
  async scrapeIRSVITAPDF(sourceId: string, config: any): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    
    try {
      const sources = await storage.getPolicySources();
      const source = sources.find(s => s.id === sourceId);
      if (!source?.url) {
        throw new Error('Source URL not found');
      }

      const url = source.url;
      const { publicationNumber, formNumber, minRevisionYear, taxYear } = config;
      
      // Download PDF
      console.log(`Downloading IRS VITA PDF from: ${url}`);
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Maryland Benefits Navigator System/1.0'
        }
      });
      
      const pdfBuffer = Buffer.from(response.data);
      
      // Parse PDF to extract text
      const pdfData = await pdfParse(pdfBuffer);
      const pdfText = pdfData.text;
      
      // Extract revision information from PDF text
      // Look for patterns like "Rev. 1-2025", "Revision 5-2025", "(2025 tax returns)", etc.
      const revisionPatterns = [
        /Rev(?:ision)?\.?\s+(\d+)-(\d{4})/i,  // Rev. 1-2025
        /Rev(?:ision)?\.?\s+(\d{4})/i,        // Rev. 2025
        /\((\d{4})\s+tax\s+returns?\)/i,      // (2025 tax returns)
        /Tax\s+Year\s+(\d{4})/i,              // Tax Year 2025
        /For\s+(\d{4})/i                      // For 2025
      ];
      
      let extractedYear: number | null = null;
      let extractedRevision: string | null = null;
      
      // Try each pattern
      for (const pattern of revisionPatterns) {
        const match = pdfText.match(pattern);
        if (match) {
          // Extract year from match groups
          const yearMatch = match[0].match(/\d{4}/);
          if (yearMatch) {
            extractedYear = parseInt(yearMatch[0]);
            extractedRevision = match[0].trim();
            break;
          }
        }
      }
      
      // Also check PDF metadata for creation/modification date as fallback
      if (!extractedYear && pdfData.metadata) {
        const modDate = pdfData.metadata.ModDate || pdfData.metadata.CreationDate;
        if (modDate) {
          // PDF dates are in format: D:20250115...
          const dateMatch = modDate.match(/D:(\d{4})/);
          if (dateMatch) {
            extractedYear = parseInt(dateMatch[1]);
          }
        }
      }
      
      // Apply filters
      let passesFilter = true;
      let filterReason = '';
      
      if (minRevisionYear && extractedYear) {
        passesFilter = extractedYear >= minRevisionYear;
        filterReason = passesFilter ? 
          `Revision year ${extractedYear} meets minRevisionYear ${minRevisionYear}` :
          `Revision year ${extractedYear} does not meet minRevisionYear ${minRevisionYear} - skipping`;
      } else if (taxYear && extractedYear) {
        passesFilter = extractedYear >= taxYear;
        filterReason = passesFilter ?
          `Tax year ${extractedYear} meets required taxYear ${taxYear}` :
          `Tax year ${extractedYear} does not meet required taxYear ${taxYear} - skipping`;
      } else if (minRevisionYear || taxYear) {
        // Filter specified but couldn't extract year - skip to be safe
        passesFilter = false;
        filterReason = `Could not extract year from PDF (required: ${minRevisionYear || taxYear})  - skipping for safety`;
      }
      
      if (passesFilter) {
        const docTitle = publicationNumber ? 
          `IRS Publication ${publicationNumber}${extractedRevision ? ` (${extractedRevision})` : ''}` :
          `IRS Form ${formNumber}${extractedRevision ? ` (${extractedRevision})` : ''}`;
        
        documents.push({
          title: docTitle,
          url,
          pdfUrl: url,
          effectiveDate: new Date(),
          sectionNumber: publicationNumber || formNumber,
          metadata: {
            program: 'VITA',
            documentType: publicationNumber ? 'publication' : 'form',
            source: 'IRS',
            publicationNumber,
            formNumber,
            revisionInfo: extractedRevision,
            extractedYear,
            taxYear: extractedYear,
            pdfPageCount: pdfData.numpages
          }
        });
        
        console.log(`✓ ${docTitle} - ${filterReason}`);
      } else {
        console.log(`⊗ Skipping ${publicationNumber || formNumber} - ${filterReason}`);
      }
      
    } catch (error: any) {
      console.error(`Error scraping IRS VITA PDF:`, error.message);
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
      } else if (config?.scrapeType === 'md_medicaid_manual') {
        documents = await this.scrapeMedicaidManual(policySourceId, config);
      } else if (config?.scrapeType === 'tca_main_page') {
        documents = await this.scrapeTCAMainPage(policySourceId, config);
      } else if (config?.scrapeType === 'tca_manual_directory') {
        documents = await this.scrapeTCAManualDirectory(policySourceId, config);
      } else if (config?.scrapeType === 'sdat_tax_credits_portal') {
        documents = await this.scrapeSDATTaxCreditsPortal(policySourceId, config);
      } else if (config?.scrapeType === 'renters_tax_credit') {
        documents = await this.scrapeRentersTaxCredit(policySourceId, config);
      } else if (config?.scrapeType === 'homeowners_tax_credit') {
        documents = await this.scrapeHomeownersTaxCredit(policySourceId, config);
      } else if (config?.scrapeType === 'comptroller_tax_credits') {
        documents = await this.scrapeComptrollerTaxCredits(policySourceId, config);
      } else if (config?.scrapeType === 'onestop_tax_forms') {
        documents = await this.scrapeOneStopTaxForms(policySourceId, config);
      } else if (config?.scrapeType === 'irs_vita_pdf') {
        documents = await this.scrapeIRSVITAPDF(policySourceId, config);
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
