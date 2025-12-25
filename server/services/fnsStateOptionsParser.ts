import axios from 'axios';
import { db } from '../db';
import { stateOptionsWaivers, marylandStateOptionStatus } from '@shared/schema';
import type { InsertStateOptionWaiver, InsertMarylandStateOptionStatus } from '@shared/schema';
import { GoogleGenAI } from '@google/genai';
import { eq } from 'drizzle-orm';
import { logger } from './logger.service';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';

/**
 * FNS State Options Report Parser
 * Downloads the official FNS State Options Report and uses Gemini to extract all 28 SNAP options/waivers
 */
export class FNSStateOptionsParser {
  private readonly FNS_REPORT_URL = 'https://www.fns.usda.gov/sites/default/files/resource-files/snap-stateOptionsReport-17edition.pdf';
  private readonly REPORT_EDITION = '17';
  private readonly REPORT_DATE = 'August 2025';
  private genAI: GoogleGenAI;

  constructor() {
    if (!GEMINI_API_KEY) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }

  /**
   * Download and parse the FNS State Options Report
   */
  async downloadAndParse(): Promise<{ optionsCreated: number; marylandStatusCreated: number }> {
    // Check if we already have data for this edition
    const existingData = await db.query.stateOptionsWaivers.findFirst({
      where: eq(stateOptionsWaivers.fnsReportEdition, this.REPORT_EDITION),
    });
    
    if (existingData) {
      logger.info('FNS State Options Report already in database - skipping download', {
        edition: this.REPORT_EDITION,
        service: 'FNSStateOptionsParser'
      });
      return { optionsCreated: 0, marylandStatusCreated: 0 };
    }
    
    logger.info('Downloading FNS State Options Report', {
      edition: this.REPORT_EDITION,
      date: this.REPORT_DATE,
      url: this.FNS_REPORT_URL,
      service: 'FNSStateOptionsParser'
    });
    
    // Download PDF
    const response = await axios.get(this.FNS_REPORT_URL, {
      responseType: 'arraybuffer',
      timeout: 120000,
      headers: {
        'User-Agent': 'Maryland Benefits Navigator System/1.0',
      },
    });
    
    const pdfBuffer = Buffer.from(response.data);
    logger.info('Downloaded PDF successfully', {
      sizeMB: Math.round(pdfBuffer.length / 1024 / 1024 * 10) / 10,
      service: 'FNSStateOptionsParser'
    });
    
    // Extract text from PDF
    // Use createRequire to load CommonJS pdf-parse in ESM
    const { createRequire } = (await import('module')) as any;
    const require = createRequire(import.meta.url);
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;
    
    logger.info('Extracted text from PDF', {
      characterCount: pdfText.length,
      service: 'FNSStateOptionsParser'
    });
    
    // Use Gemini to extract the 28 SNAP options
    const options = await this.extractOptionsWithGemini(pdfText);
    logger.info('Gemini extracted SNAP options', {
      optionCount: options.length,
      service: 'FNSStateOptionsParser'
    });
    
    // Use Gemini to identify Maryland's participation
    const marylandStatus = await this.extractMarylandStatusWithGemini(pdfText, options);
    logger.info('Identified Maryland participation status', {
      optionCount: marylandStatus.length,
      service: 'FNSStateOptionsParser'
    });
    
    // Store in database
    const optionsCreated = await this.storeOptions(options);
    const statusCreated = await this.storeMarylandStatus(marylandStatus);
    
    return { optionsCreated, marylandStatusCreated: statusCreated };
  }

  /**
   * Use Gemini to extract all 28 SNAP options from the report
   */
  private async extractOptionsWithGemini(pdfText: string): Promise<any[]> {
    const prompt = `You are analyzing the FNS SNAP State Options Report (17th Edition, August 2025).

Extract ALL 28 SNAP options, demonstration projects, and waivers mentioned in this report. For each option, provide:

1. optionCode: A short code (e.g., "BBCE", "SIMPLIFIED_REPORTING", "ABAWD_WAIVER")
2. optionName: Full official name
3. category: One of: "eligibility", "reporting", "deductions", "waivers", "administration", "certification"
4. description: Clear explanation of what the option does
5. statutoryCitation: Food and Nutrition Act section (e.g., "Section 5(e)")
6. regulatoryCitation: 7 CFR citation (e.g., "7 CFR 273.2")
7. eligibilityImpact: How it affects eligibility ("expands", "restricts", "neutral", or null)
8. benefitImpact: How it affects benefit amounts ("increases", "decreases", "neutral", or null)
9. administrativeImpact: Administrative effect ("simplifies", "burden", "neutral")
10. statesUsing: Array of 2-letter state codes using this option (e.g., ["MD", "VA", "DC"])

Return a JSON array of all 28 options. Be precise with citations and state codes.

PDF Text (first 50000 chars):
${pdfText.substring(0, 50000)}`;

    const response = await this.genAI.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    const text = response.text || "";
    
    try {
      // Strip markdown code fences if present
      let jsonText = text.trim();
      if (jsonText.startsWith('```')) {
        // Remove opening fence (```json or ```)
        jsonText = jsonText.replace(/^```(?:json|JSON)?\n?/, '');
        // Remove closing fence
        jsonText = jsonText.replace(/\n?```\s*$/, '');
      }
      const parsed = JSON.parse(jsonText.trim());
      const options = Array.isArray(parsed) ? parsed : [];
      
      // Enforce exactly 28 options
      if (options.length !== 28) {
        throw new Error(`Expected exactly 28 SNAP options, but got ${options.length}`);
      }
      
      // Validate required fields for each option
      for (const option of options) {
        if (!option.optionCode || !option.optionName || !option.category) {
          throw new Error(`Invalid option structure: missing required fields (optionCode, optionName, or category)`);
        }
      }
      
      logger.info('Successfully extracted all SNAP options', {
        optionCount: 28,
        service: 'FNSStateOptionsParser'
      });
      return options;
    } catch (error) {
      logger.error('Error parsing Gemini response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
        responsePreview: text.substring(0, 500),
        service: 'FNSStateOptionsParser'
      });
      throw error instanceof Error ? error : new Error('Failed to extract SNAP options from FNS report');
    }
  }

  /**
   * Use Gemini to extract Maryland's participation status
   */
  private async extractMarylandStatusWithGemini(pdfText: string, options: any[]): Promise<any[]> {
    // Find Maryland section in PDF (page 86)
    const marylandSectionStart = pdfText.indexOf('Maryland');
    const marylandSection = pdfText.substring(
      Math.max(0, marylandSectionStart - 1000), 
      marylandSectionStart + 5000
    );

    const prompt = `You are analyzing Maryland's SNAP State Options profile from the FNS report.

Here are the ${options.length} SNAP options identified:
${JSON.stringify(options.map(o => ({ code: o.optionCode, name: o.optionName })), null, 2)}

For each option, determine if Maryland participates. Return a JSON array with:

1. optionCode: Match to one of the codes above
2. isParticipating: true or false
3. adoptionDate: Estimated date if mentioned (YYYY-MM-DD or null)
4. waiverType: "statewide", "county_specific", "time_limited", or null
5. notes: Any relevant details about Maryland's implementation

Maryland Section:
${marylandSection}`;

    const response = await this.genAI.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    const text = response.text || "";
    
    try {
      // Strip markdown code fences if present
      let jsonText = text.trim();
      if (jsonText.startsWith('```')) {
        // Remove opening fence (```json or ```)
        jsonText = jsonText.replace(/^```(?:json|JSON)?\n?/, '');
        // Remove closing fence
        jsonText = jsonText.replace(/\n?```\s*$/, '');
      }
      const parsed = JSON.parse(jsonText.trim());
      const statusData = Array.isArray(parsed) ? parsed : [];
      
      // Validate we have status for all options
      const missingCodes = options
        .map(o => o.optionCode)
        .filter(code => !statusData.find(s => s.optionCode === code));
      
      if (missingCodes.length > 0) {
        throw new Error(`Missing Maryland status for options: ${missingCodes.join(', ')}`);
      }
      
      // Validate required fields
      for (const status of statusData) {
        if (!status.optionCode || status.isParticipating === undefined) {
          throw new Error(`Invalid Maryland status structure: missing required fields`);
        }
      }
      
      logger.info('Successfully extracted Maryland status', {
        statusCount: statusData.length,
        service: 'FNSStateOptionsParser'
      });
      
      return statusData;
    } catch (error) {
      logger.error('Error parsing Maryland status response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
        responsePreview: text.substring(0, 500),
        service: 'FNSStateOptionsParser'
      });
      throw error instanceof Error ? error : new Error('Failed to extract Maryland participation status');
    }
  }

  /**
   * Store options in database
   */
  private async storeOptions(options: any[]): Promise<number> {
    let created = 0;
    
    for (const option of options) {
      try {
        const optionData: Partial<InsertStateOptionWaiver> = {
          optionCode: option.optionCode,
          optionName: option.optionName,
          category: option.category,
          description: option.description,
          statutoryCitation: option.statutoryCitation,
          regulatoryCitation: option.regulatoryCitation,
          eligibilityImpact: option.eligibilityImpact,
          benefitImpact: option.benefitImpact,
          administrativeImpact: option.administrativeImpact,
          statesUsing: option.statesUsing || [],
          fnsReportEdition: this.REPORT_EDITION,
          sourceUrl: this.FNS_REPORT_URL,
          isActive: true,
        };
        
        await db.insert(stateOptionsWaivers)
          .values(optionData as InsertStateOptionWaiver)
          .onConflictDoUpdate({
            target: stateOptionsWaivers.optionCode,
            set: {
              optionName: option.optionName,
              description: option.description,
              statesUsing: option.statesUsing || [],
              updatedAt: new Date(),
            },
          });
        
        created++;
        logger.debug('Stored option', {
          optionCode: option.optionCode,
          optionName: option.optionName,
          service: 'FNSStateOptionsParser'
        });
      } catch (error) {
        logger.error('Error storing option', {
          optionCode: option.optionCode,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorDetails: error,
          service: 'FNSStateOptionsParser'
        });
      }
    }
    
    return created;
  }

  /**
   * Store Maryland status in database
   */
  private async storeMarylandStatus(statusData: any[]): Promise<number> {
    let created = 0;
    
    for (const status of statusData) {
      try {
        // Find the state option by code
        const option = await db.select()
          .from(stateOptionsWaivers)
          .where(eq(stateOptionsWaivers.optionCode, status.optionCode))
          .limit(1);
        
        if (!option || option.length === 0) {
          logger.warn('Skipping status - option not found', {
            optionCode: status.optionCode,
            service: 'FNSStateOptionsParser'
          });
          continue;
        }
        
        const statusRecord: Partial<InsertMarylandStateOptionStatus> = {
          stateOptionId: option[0].id,
          isParticipating: status.isParticipating,
          adoptionDate: status.adoptionDate ? new Date(status.adoptionDate) : null,
          waiverType: status.waiverType,
          notes: status.notes,
          dataSource: 'ai_extracted',
        };
        
        await db.insert(marylandStateOptionStatus)
          .values(statusRecord as InsertMarylandStateOptionStatus)
          .onConflictDoUpdate({
            target: marylandStateOptionStatus.stateOptionId,
            set: {
              isParticipating: status.isParticipating,
              notes: status.notes,
              updatedAt: new Date(),
            },
          });
        
        created++;
        const participationIcon = status.isParticipating ? '✅' : '❌';
        logger.debug('Maryland option participation status', {
          optionCode: status.optionCode,
          participates: status.isParticipating,
          service: 'FNSStateOptionsParser'
        });
      } catch (error) {
        logger.error('Error storing Maryland status', {
          optionCode: status.optionCode,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorDetails: error,
          service: 'FNSStateOptionsParser'
        });
      }
    }
    
    return created;
  }
}

// Export singleton instance
export const fnsStateOptionsParser = new FNSStateOptionsParser();
