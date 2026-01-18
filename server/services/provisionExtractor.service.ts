import { db } from "../db";
import {
  lawProvisions, publicLaws, InsertLawProvision,
  LawProvision
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { generateTextWithGemini } from "./gemini.service";
import { logger } from "./logger.service";

export type ProvisionType = "amendment" | "repeal" | "new_section" | "modification" | "technical_correction" | "appropriation";

export interface ExtractedProvision {
  sectionNumber: string;
  sectionTitle?: string;
  provisionType: ProvisionType;
  provisionText: string;
  provisionSummary: string;
  usCodeTitle?: string;
  usCodeSection?: string;
  usCodeCitation?: string;
  amendedText?: string;
  affectedPrograms: string[];
  effectiveDate?: string;
  confidence: number;
}

export interface ExtractionResult {
  success: boolean;
  publicLawId: string;
  publicLawNumber: string;
  provisionsExtracted: number;
  provisionIds: string[];
  errors: string[];
  processingTimeMs: number;
}

const EXTRACTION_MODEL = "gemini-2.0-flash";

const PROGRAM_KEYWORDS: Record<string, string[]> = {
  SNAP: [
    "supplemental nutrition assistance", "food stamp", "snap", "food and nutrition act",
    "7 u.s.c. 2011", "7 u.s.c. 2012", "7 u.s.c. 2013", "7 u.s.c. 2014", "7 u.s.c. 2015",
    "7 u.s.c. 2016", "7 u.s.c. 2017", "7 u.s.c. 2018", "7 u.s.c. 2019", "7 u.s.c. 2020",
    "7 u.s.c. 2021", "7 u.s.c. 2022", "7 u.s.c. 2023", "7 u.s.c. 2024", "7 u.s.c. 2025",
    "7 u.s.c. 2026", "7 u.s.c. 2027", "7 u.s.c. 2028", "7 u.s.c. 2029",
    "abawd", "able-bodied adult", "thrifty food plan", "allotment", "ebt"
  ],
  Medicaid: [
    "medicaid", "medical assistance", "42 u.s.c. 1396", "title xix",
    "magi", "chip", "children's health insurance", "42 u.s.c. 1397"
  ],
  Medicare: [
    "medicare", "42 u.s.c. 1395", "title xviii", "part a", "part b", "part d",
    "hospital insurance", "supplementary medical insurance"
  ],
  TANF: [
    "temporary assistance", "tanf", "afdc", "aid to families",
    "42 u.s.c. 601", "42 u.s.c. 602", "42 u.s.c. 603", "42 u.s.c. 604",
    "needy families", "cash assistance"
  ],
  SSI: [
    "supplemental security income", "ssi", "42 u.s.c. 1381", "42 u.s.c. 1382",
    "aged, blind, and disabled", "title xvi"
  ],
  "Social Security": [
    "social security", "oasdi", "old-age", "survivors", "disability insurance",
    "42 u.s.c. 401", "42 u.s.c. 402", "42 u.s.c. 403", "title ii"
  ],
  CTC: [
    "child tax credit", "26 u.s.c. 24", "refundable credit", "qualifying child",
    "additional child tax credit"
  ],
  EITC: [
    "earned income", "eitc", "26 u.s.c. 32", "earned income credit",
    "working families"
  ],
  LIHEAP: [
    "liheap", "home energy", "42 u.s.c. 8621", "42 u.s.c. 8622",
    "heating assistance", "cooling assistance", "energy assistance"
  ]
};

function buildExtractionPrompt(lawText: string, publicLawNumber: string, title: string): string {
  return `You are a legal analyst specializing in federal legislation. Extract all substantive provisions from this public law that create, amend, or affect eligibility rules for federal benefit programs.

PUBLIC LAW: ${publicLawNumber}
TITLE: ${title}

LAW TEXT:
${lawText.substring(0, 30000)}

For each provision that affects benefit program eligibility, extract:
1. Section number (e.g., "Sec. 101", "Section 2(a)")
2. Section title if available
3. Provision type: "amendment" (modifies existing law), "repeal" (removes law), "new_section" (adds new law), "modification" (changes thresholds/dates), "technical_correction" (fixes errors), "appropriation" (funding only)
4. The actual provision text (the operative language)
5. A brief summary (1-2 sentences)
6. U.S. Code citation being amended (e.g., "7 U.S.C. 2012")
7. The original text being amended if available
8. Affected programs (SNAP, Medicaid, Medicare, TANF, SSI, Social Security, CTC, EITC, LIHEAP)
9. Effective date if specified

Focus on provisions that:
- Change income limits, asset tests, or eligibility thresholds
- Modify work requirements or exemptions
- Add or remove categorical eligibility
- Change verification requirements
- Amend benefit calculation formulas
- Affect time limits or durational requirements

Skip provisions that are purely administrative, appropriations-only, or unrelated to individual eligibility.

Respond in JSON format:
{
  "provisions": [
    {
      "sectionNumber": "Sec. 101",
      "sectionTitle": "SNAP Income Limit Adjustment",
      "provisionType": "amendment",
      "provisionText": "Section 5(c) of the Food and Nutrition Act of 2008 is amended by striking '130 percent' and inserting '200 percent'",
      "provisionSummary": "Increases the gross income limit for SNAP eligibility from 130% to 200% of the federal poverty level.",
      "usCodeTitle": "7",
      "usCodeSection": "2014",
      "usCodeCitation": "7 U.S.C. 2014(c)",
      "amendedText": "gross income does not exceed 130 percent of the poverty line",
      "affectedPrograms": ["SNAP"],
      "effectiveDate": "2025-10-01",
      "confidence": 0.95
    }
  ]
}

If no eligibility-affecting provisions are found, return: {"provisions": []}`;
}

function determineAffectedPrograms(text: string): string[] {
  const lowerText = text.toLowerCase();
  const programs: Set<string> = new Set();
  
  for (const [program, keywords] of Object.entries(PROGRAM_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        programs.add(program);
        break;
      }
    }
  }
  
  return Array.from(programs);
}

function parseProvisionType(type: string): ProvisionType {
  const normalized = type.toLowerCase().trim();
  const typeMap: Record<string, ProvisionType> = {
    "amendment": "amendment",
    "repeal": "repeal",
    "new_section": "new_section",
    "new section": "new_section",
    "modification": "modification",
    "technical_correction": "technical_correction",
    "technical correction": "technical_correction",
    "appropriation": "appropriation"
  };
  return typeMap[normalized] || "amendment";
}

class ProvisionExtractorService {
  async extractProvisionsFromLaw(publicLawId: string): Promise<ExtractionResult> {
    const startTime = Date.now();
    const result: ExtractionResult = {
      success: false,
      publicLawId,
      publicLawNumber: "",
      provisionsExtracted: 0,
      provisionIds: [],
      errors: [],
      processingTimeMs: 0
    };

    try {
      const [law] = await db.select().from(publicLaws).where(eq(publicLaws.id, publicLawId));
      
      if (!law) {
        result.errors.push(`Public law not found: ${publicLawId}`);
        return result;
      }

      result.publicLawNumber = law.publicLawNumber;

      if (!law.fullText || law.fullText.length < 100) {
        result.errors.push("Public law has insufficient text content for extraction");
        return result;
      }

      logger.info("Extracting provisions from public law", {
        publicLawId,
        publicLawNumber: law.publicLawNumber,
        textLength: law.fullText.length
      });

      const prompt = buildExtractionPrompt(law.fullText, law.publicLawNumber, law.title);
      
      const response = await generateTextWithGemini(prompt, {
        model: EXTRACTION_MODEL,
        temperature: 0.1,
        maxTokens: 8000
      });

      let extracted: { provisions: ExtractedProvision[] };
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }
        extracted = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        logger.warn("Failed to parse Gemini response as JSON, attempting recovery", {
          error: parseError instanceof Error ? parseError.message : String(parseError)
        });
        extracted = { provisions: [] };
      }

      if (!extracted.provisions || !Array.isArray(extracted.provisions)) {
        extracted.provisions = [];
      }

      for (const provision of extracted.provisions) {
        try {
          let affectedPrograms = provision.affectedPrograms || [];
          if (affectedPrograms.length === 0) {
            affectedPrograms = determineAffectedPrograms(provision.provisionText || "");
          }

          const [inserted] = await db.insert(lawProvisions).values({
            publicLawId,
            sectionNumber: provision.sectionNumber || null,
            sectionTitle: provision.sectionTitle || null,
            provisionType: parseProvisionType(provision.provisionType),
            provisionText: provision.provisionText,
            provisionSummary: provision.provisionSummary || null,
            usCodeTitle: provision.usCodeTitle || null,
            usCodeSection: provision.usCodeSection || null,
            usCodeCitation: provision.usCodeCitation || null,
            amendedText: provision.amendedText || null,
            affectedPrograms,
            effectiveDate: provision.effectiveDate || null,
            extractionMethod: "gemini",
            extractionModel: EXTRACTION_MODEL,
            extractionConfidence: provision.confidence || 0.7,
            processingStatus: "extracted"
          }).returning();

          result.provisionIds.push(inserted.id);
          result.provisionsExtracted++;

          logger.info("Extracted provision", {
            provisionId: inserted.id,
            sectionNumber: provision.sectionNumber,
            usCodeCitation: provision.usCodeCitation,
            affectedPrograms
          });
        } catch (insertError) {
          logger.error("Failed to insert provision", {
            error: insertError instanceof Error ? insertError.message : String(insertError),
            sectionNumber: provision.sectionNumber
          });
          result.errors.push(`Failed to insert provision ${provision.sectionNumber}: ${insertError}`);
        }
      }

      result.success = result.provisionsExtracted > 0;
      result.processingTimeMs = Date.now() - startTime;

      logger.info("Provision extraction completed", {
        publicLawId,
        publicLawNumber: law.publicLawNumber,
        provisionsExtracted: result.provisionsExtracted,
        processingTimeMs: result.processingTimeMs
      });

      return result;
    } catch (error) {
      logger.error("Failed to extract provisions", {
        publicLawId,
        error: error instanceof Error ? error.message : String(error)
      });
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.processingTimeMs = Date.now() - startTime;
      return result;
    }
  }

  async getProvisionsForLaw(publicLawId: string): Promise<LawProvision[]> {
    return db.select()
      .from(lawProvisions)
      .where(eq(lawProvisions.publicLawId, publicLawId))
      .orderBy(lawProvisions.sectionNumber);
  }

  async getProvisionsByProgram(program: string): Promise<LawProvision[]> {
    return db.select()
      .from(lawProvisions)
      .where(sql`${program} = ANY(${lawProvisions.affectedPrograms})`)
      .orderBy(desc(lawProvisions.createdAt));
  }

  async getProvisionsByCitation(usCodeCitation: string): Promise<LawProvision[]> {
    return db.select()
      .from(lawProvisions)
      .where(eq(lawProvisions.usCodeCitation, usCodeCitation))
      .orderBy(desc(lawProvisions.createdAt));
  }

  async getUnprocessedProvisions(): Promise<LawProvision[]> {
    return db.select()
      .from(lawProvisions)
      .where(eq(lawProvisions.processingStatus, "extracted"))
      .orderBy(lawProvisions.createdAt);
  }

  async updateProvisionStatus(
    provisionId: string, 
    status: "extracted" | "matched" | "reviewed" | "applied"
  ): Promise<void> {
    await db.update(lawProvisions)
      .set({ 
        processingStatus: status,
        updatedAt: new Date()
      })
      .where(eq(lawProvisions.id, provisionId));
  }

  async extractAllUnprocessedLaws(): Promise<ExtractionResult[]> {
    const unprocessedLaws = await db.select()
      .from(publicLaws)
      .where(sql`NOT EXISTS (
        SELECT 1 FROM law_provisions lp 
        WHERE lp.public_law_id = public_laws.id
      )`)
      .orderBy(desc(publicLaws.enactmentDate));

    const results: ExtractionResult[] = [];
    
    for (const law of unprocessedLaws) {
      const result = await this.extractProvisionsFromLaw(law.id);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }
}

export const provisionExtractorService = new ProvisionExtractorService();
