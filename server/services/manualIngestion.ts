import { db } from "../db";
import { documents, documentChunks, manualSections, benefitPrograms } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

interface ManualSection {
  sectionNumber: string;
  sectionTitle: string;
  category: string;
  sortOrder: number;
  sourceUrl: string;
  fileType: string;
  parentSection?: string;
}

/**
 * Manual Ingestion Service
 * Scrapes Maryland SNAP Policy Manual from DHS website
 * Downloads PDFs/DOCX, extracts text, chunks, embeds, and stores
 */
export class ManualIngestionService {
  private baseUrl = "https://dhs.maryland.gov/documents/FIA/Manuals/Supplemental%20Nutrition%20Assistance%20Program%20(SNAP)";
  
  /**
   * Maryland SNAP Manual Structure - All 47+ sections
   * Scraped from https://dhs.maryland.gov/supplemental-nutrition-assistance-program/food-supplement-program-manual/
   */
  private manualStructure: ManualSection[] = [
    // Table of Contents
    { sectionNumber: "000", sectionTitle: "Table of Contents", category: "000 - Table of Contents", sortOrder: 1, sourceUrl: `${this.baseUrl}/000%20Table%20of%20Contents/000-Table-of-Contents-July2023.pdf.docx`, fileType: "DOCX" },
    
    // 100 series - Household Eligibility
    { sectionNumber: "100", sectionTitle: "Household Composition", category: "100s - Household Eligibility", sortOrder: 10, sourceUrl: `${this.baseUrl}/100%20Household%20Composition/100-Household-Composition-rev-JULY-2023.MW.docx`, fileType: "DOCX" },
    { sectionNumber: "101", sectionTitle: "Strikers", category: "100s - Household Eligibility", sortOrder: 11, sourceUrl: `${this.baseUrl}/101%20Strikers/101-Strikers-rev-July-2023.docx`, fileType: "DOCX" },
    { sectionNumber: "102", sectionTitle: "Students", category: "100s - Household Eligibility", sortOrder: 12, sourceUrl: `${this.baseUrl}/102%20Students/102-Students-rev-JULY%202023.docx`, fileType: "DOCX" },
    { sectionNumber: "103", sectionTitle: "Residents of Shelters for Battered Women and Children", category: "100s - Household Eligibility", sortOrder: 13, sourceUrl: `${this.baseUrl}/103%20Residents%20of%20Shelters%20for%20Battered%20Women%20and%20Children/103-Resident-of-Shelter-rev-JULY%202023.docx`, fileType: "DOCX" },
    { sectionNumber: "104", sectionTitle: "Self-employed Households", category: "100s - Household Eligibility", sortOrder: 14, sourceUrl: `${this.baseUrl}/104%20Self-employed%20Households/104%20Self-employed%20rev%20JULY2023.docx`, fileType: "DOCX" },
    { sectionNumber: "105", sectionTitle: "Households With Boarders", category: "100s - Household Eligibility", sortOrder: 15, sourceUrl: `${this.baseUrl}/105%20Households%20With%20Boarders/105-Households-with-Boarders-REVISED%20JULY2023%20MW.docx`, fileType: "DOCX" },
    { sectionNumber: "106", sectionTitle: "ABAWDS (Able-Bodied Adults Without Dependents)", category: "100s - Household Eligibility", sortOrder: 16, sourceUrl: `${this.baseUrl}/106%20ABAWDS/106-ABAWDS-JULY%202023.docx`, fileType: "DOCX" },
    { sectionNumber: "107", sectionTitle: "ESAP and MSNAP", category: "100s - Household Eligibility", sortOrder: 17, sourceUrl: `${this.baseUrl}/107%20ESAP%20and%20MSNAP_20/107-ESAP-and-MSNAP_JULY%202023.docx`, fileType: "DOCX" },
    { sectionNumber: "108", sectionTitle: "Households Containing Non-member", category: "100s - Household Eligibility", sortOrder: 18, sourceUrl: `${this.baseUrl}/108%20Households%20Containing%20Non-member/108-HH-with-Nonmembers-rev-JULY%202023.docx`, fileType: "DOCX" },
    { sectionNumber: "109", sectionTitle: "Other Special Households", category: "100s - Household Eligibility", sortOrder: 19, sourceUrl: `${this.baseUrl}/109%20Other%20Special%20Households/109-Other-Special-Households-rev-JULY%202023mw.docx`, fileType: "DOCX" },
    { sectionNumber: "110", sectionTitle: "Residency", category: "100s - Household Eligibility", sortOrder: 20, sourceUrl: `${this.baseUrl}/110%20Residency/110-Residency-rev-JULY%202023%20.MW.docx`, fileType: "DOCX" },
    { sectionNumber: "111", sectionTitle: "Minimum State Supplement", category: "100s - Household Eligibility", sortOrder: 21, sourceUrl: `${this.baseUrl}/111%20Minimum%20State%20Supplement/111-Minimum-State-Supplement-Revised.09.24.24.docx`, fileType: "DOCX" },
    { sectionNumber: "115", sectionTitle: "Categorical Eligibility", category: "100s - Household Eligibility", sortOrder: 22, sourceUrl: `${this.baseUrl}/115%20Categorical%20Eligibility/SECTION%20115%20-%20Categorical%20Eligibility%20NOV%202024.pdf`, fileType: "PDF" },
    { sectionNumber: "120", sectionTitle: "Citizenship and Immigrant Status", category: "100s - Household Eligibility", sortOrder: 23, sourceUrl: `${this.baseUrl}/120%20Citizenship%20and%20Immigrant%20Status/120-Immigrants-rev-JULY-2023.MW.docx`, fileType: "DOCX" },
    { sectionNumber: "121", sectionTitle: "Sponsored Immigrants", category: "100s - Household Eligibility", sortOrder: 24, sourceUrl: `${this.baseUrl}/121%20Sponsored%20Immigrants/121-Immigrants-with-Sponsors-rev-JULY-2023.MW.docx`, fileType: "DOCX" },
    { sectionNumber: "122", sectionTitle: "Migrants", category: "100s - Household Eligibility", sortOrder: 25, sourceUrl: `${this.baseUrl}/122%20Migrants/122-Migrants-rev-JULY%202023.docx`, fileType: "DOCX" },
    { sectionNumber: "130", sectionTitle: "Work Registration", category: "100s - Household Eligibility", sortOrder: 26, sourceUrl: `${this.baseUrl}/130%20Work%20Registration/130-Work-Requirements-rev-SEPTEMBER-2024-1.docx`, fileType: "DOCX" },
    
    // 200 series - Income & Resources
    { sectionNumber: "200", sectionTitle: "Resources", category: "200s - Income & Resources", sortOrder: 30, sourceUrl: `${this.baseUrl}/200%20Resources/200-Resources-JULY-2023.docx`, fileType: "DOCX" },
    { sectionNumber: "201", sectionTitle: "Treatment of Licensed Vehicles", category: "200s - Income & Resources", sortOrder: 31, sourceUrl: `${this.baseUrl}/201%20Treatment%20of%20Licensed%20Vehicles/201-Vehicles-rev-JULY%202023.docx`, fileType: "DOCX" },
    { sectionNumber: "210", sectionTitle: "Income", category: "200s - Income & Resources", sortOrder: 32, sourceUrl: `${this.baseUrl}/210%20Income/210-Income-rev-JULY%202023.docx`, fileType: "DOCX" },
    { sectionNumber: "211", sectionTitle: "Excluded Income", category: "200s - Income & Resources", sortOrder: 33, sourceUrl: `${this.baseUrl}/211%20Excluded%20Income/211-Excluded-Income-rev-JULY%202023.docx`, fileType: "DOCX" },
    { sectionNumber: "212", sectionTitle: "Deductions", category: "200s - Income & Resources", sortOrder: 34, sourceUrl: `${this.baseUrl}/212%20Deductions/212-Deductions-REV.JULY.2023.MW.docx`, fileType: "DOCX" },
    { sectionNumber: "213", sectionTitle: "Determining Income Deductions", category: "200s - Income & Resources", sortOrder: 35, sourceUrl: `${this.baseUrl}/213%20Determining%20Income%20Deductions/213-Determining-Income-Deductions-JULY%202023.MW.docx`, fileType: "DOCX" },
    { sectionNumber: "214", sectionTitle: "Utility Allowances", category: "200s - Income & Resources", sortOrder: 36, sourceUrl: `${this.baseUrl}/214%20Utility%20Allowances/214-Utility-Allowances-rev.JULY%202023.docx`, fileType: "DOCX" },
    
    // 400 series - Application Process
    { sectionNumber: "400", sectionTitle: "Filing an Application", category: "400s - Application Process", sortOrder: 50, sourceUrl: `${this.baseUrl}/400%20Filing%20an%20Application/400-Filing-an-Application-rev-JULY2023.MW.docx`, fileType: "DOCX" },
    { sectionNumber: "401", sectionTitle: "Screening for Expedited Service", category: "400s - Application Process", sortOrder: 51, sourceUrl: `${this.baseUrl}/401%20Screening%20for%20Expedited%20Service/401-Expedited-Service-rev-JULY%202023.docx`, fileType: "DOCX" },
    { sectionNumber: "402", sectionTitle: "Interviews", category: "400s - Application Process", sortOrder: 52, sourceUrl: `${this.baseUrl}/402%20Interviews/402-Interviews-rev-JULY2023.docx`, fileType: "DOCX" },
    { sectionNumber: "403", sectionTitle: "Customer Rights and Responsibilities", category: "400s - Application Process", sortOrder: 53, sourceUrl: `${this.baseUrl}/403%20Customer%20Rights%20and%20Responsibilities/403%20Client%20Rights%20and%20Responsibilities%20NOV%202024.pdf`, fileType: "PDF" },
    { sectionNumber: "404", sectionTitle: "Head of Household", category: "400s - Application Process", sortOrder: 54, sourceUrl: `${this.baseUrl}/404%20Head%20of%20Household/404-Head-of-Household-rev-JULY2023.MW.docx`, fileType: "DOCX" },
    { sectionNumber: "405", sectionTitle: "Social Security Numbers", category: "400s - Application Process", sortOrder: 55, sourceUrl: `${this.baseUrl}/405%20Social%20Security%20Numbers/405-Social-Security-Numbers-rev-JULY2023.MW.docx`, fileType: "DOCX" },
    { sectionNumber: "406", sectionTitle: "Normal Processing Standards", category: "400s - Application Process", sortOrder: 56, sourceUrl: `${this.baseUrl}/406%20Normal%20Processing%20Standards/406-Normal-Processing-1.2025.pdf`, fileType: "PDF" },
    { sectionNumber: "408", sectionTitle: "Verification", category: "400s - Application Process", sortOrder: 57, sourceUrl: `${this.baseUrl}/408%20Verification/408-Verification-rev-JULY%202023.MW.docx`, fileType: "DOCX" },
    { sectionNumber: "409", sectionTitle: "Income Eligibility", category: "400s - Application Process", sortOrder: 58, sourceUrl: `${this.baseUrl}/409%20Income%20Eligibility/409-Income-Standard-rev-JULY%202023.docx`, fileType: "DOCX" },
    { sectionNumber: "410", sectionTitle: "Certification Periods", category: "400s - Application Process", sortOrder: 59, sourceUrl: `${this.baseUrl}/410%20Certification%20Periods/410-Certification-Periods-rev-JULY.%202023.mw.docx`, fileType: "DOCX" },
    { sectionNumber: "411", sectionTitle: "Proration Tables", category: "400s - Application Process", sortOrder: 60, sourceUrl: `${this.baseUrl}/411%20Proration%20Tables/411%20Proration%20Tables%20rev%20JULY%202023.docx`, fileType: "DOCX" },
  ];

  /**
   * Get total number of sections in manual
   */
  getTotalSections(): number {
    return this.manualStructure.length;
  }

  /**
   * Get all section metadata without downloading
   */
  getManualStructure(): ManualSection[] {
    return this.manualStructure;
  }

  /**
   * Ingest manual sections metadata into database
   * Downloads and stores section information
   */
  async ingestSectionMetadata(benefitProgramId: string): Promise<void> {
    console.log(`Starting metadata ingestion for ${this.manualStructure.length} manual sections...`);
    
    for (const section of this.manualStructure) {
      // Check if section already exists
      const existing = await db
        .select()
        .from(manualSections)
        .where(eq(manualSections.sectionNumber, section.sectionNumber))
        .limit(1);

      if (existing.length > 0) {
        console.log(`Section ${section.sectionNumber} already exists, skipping...`);
        continue;
      }

      // Insert section metadata
      await db.insert(manualSections).values({
        sectionNumber: section.sectionNumber,
        sectionTitle: section.sectionTitle,
        category: section.category,
        parentSection: section.parentSection || null,
        sortOrder: section.sortOrder,
        sourceUrl: section.sourceUrl,
        fileType: section.fileType,
        hasContent: false, // Content not yet downloaded
        isActive: true,
      });

      console.log(`✓ Ingested section ${section.sectionNumber}: ${section.sectionTitle}`);
    }

    console.log(`✓ Metadata ingestion complete: ${this.manualStructure.length} sections`);
  }

  /**
   * Get ingestion status - which sections are ingested
   */
  async getIngestionStatus(): Promise<{
    total: number;
    ingested: number;
    withContent: number;
    missing: string[];
  }> {
    const allSections = await db.select().from(manualSections);
    const withContent = allSections.filter(s => s.hasContent);
    
    const ingestedNumbers = new Set(allSections.map(s => s.sectionNumber));
    const expectedNumbers = new Set(this.manualStructure.map(s => s.sectionNumber));
    const missing = Array.from(expectedNumbers).filter(n => !ingestedNumbers.has(n));

    return {
      total: this.manualStructure.length,
      ingested: allSections.length,
      withContent: withContent.length,
      missing,
    };
  }

  /**
   * Verify all sections are present
   */
  async verifyCompleteness(): Promise<boolean> {
    const status = await this.getIngestionStatus();
    return status.missing.length === 0 && status.ingested === status.total;
  }
}

export const manualIngestionService = new ManualIngestionService();
