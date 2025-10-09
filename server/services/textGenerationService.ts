import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { 
  snapIncomeLimits,
  snapDeductions,
  snapAllotments,
  categoricalEligibilityRules,
  documentRequirementRules,
  manualSections,
  benefitPrograms,
  type SnapIncomeLimit,
  type SnapDeduction,
  type SnapAllotment,
  type CategoricalEligibilityRule,
  type DocumentRequirementRule
} from "@shared/schema";
import { eq, and, or, isNull, lte, gte } from "drizzle-orm";

let genAI: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI | null {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("Warning: No Gemini API key found for text generation");
      return null;
    }
    try {
      genAI = new GoogleGenAI({ apiKey });
    } catch (error) {
      console.error('Failed to initialize Gemini API:', error);
      return null;
    }
  }
  return genAI;
}

interface GeneratedText {
  content: string;
  ruleCount: number;
  generatedAt: Date;
  sourceRules: string[];
}

/**
 * Text Generation Service
 * Generates human-readable policy text from Rules as Code database
 */
export class TextGenerationService {
  /**
   * Generate income limits section text from database rules
   */
  async generateIncomeLimitsText(
    benefitProgramId: string,
    sectionId?: string
  ): Promise<GeneratedText> {
    const whereConditions = [
      eq(snapIncomeLimits.benefitProgramId, benefitProgramId),
      eq(snapIncomeLimits.isActive, true)
    ];
    
    if (sectionId) {
      whereConditions.push(eq(snapIncomeLimits.manualSectionId, sectionId));
    }
    
    const limits = await db
      .select()
      .from(snapIncomeLimits)
      .where(and(...whereConditions))
      .orderBy(snapIncomeLimits.householdSize);

    if (limits.length === 0) {
      return {
        content: "No income limit rules found in database.",
        ruleCount: 0,
        generatedAt: new Date(),
        sourceRules: []
      };
    }

    const prompt = `You are writing the Maryland SNAP Policy Manual income limits section in plain language (8th grade reading level).

Given these income limit rules from the database:
${JSON.stringify(limits, null, 2)}

Generate clear, accessible policy text that:
1. Explains income limits for SNAP eligibility
2. Lists limits by household size in a table format
3. Explains gross vs net income tests
4. Uses everyday language (avoid jargon)
5. Includes the effective date
6. Follows Maryland Digital Style Guide tone (helpful, direct, human)

Format the response as markdown with headers, tables, and clear paragraphs. DO NOT include code blocks - just return the markdown text directly.`;

    try {
      const ai = getGemini();
      if (!ai) {
        console.error("Gemini API not available for text generation");
        return {
          content: "⚠️ AI text generation is temporarily unavailable. Please view the original policy manual section or try again later.",
          ruleCount: limits.length,
          generatedAt: new Date(),
          sourceRules: limits.map(l => `income_limit_${l.id}`)
        };
      }

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt
      });
      const text = result.text || "";

      return {
        content: text,
        ruleCount: limits.length,
        generatedAt: new Date(),
        sourceRules: limits.map(l => `income_limit_${l.id}`)
      };
    } catch (error) {
      console.error("Error generating income limits text:", error);
      return {
        content: "⚠️ Error generating policy text. Please try again or view the original policy manual section.",
        ruleCount: limits.length,
        generatedAt: new Date(),
        sourceRules: limits.map(l => `income_limit_${l.id}`)
      };
    }
  }

  /**
   * Generate deductions section text from database rules
   */
  async generateDeductionsText(
    benefitProgramId: string,
    sectionId?: string
  ): Promise<GeneratedText> {
    const whereConditions = [
      eq(snapDeductions.benefitProgramId, benefitProgramId),
      eq(snapDeductions.isActive, true)
    ];
    
    if (sectionId) {
      whereConditions.push(eq(snapDeductions.manualSectionId, sectionId));
    }
    
    const deductions = await db
      .select()
      .from(snapDeductions)
      .where(and(...whereConditions))
      .orderBy(snapDeductions.deductionType);

    if (deductions.length === 0) {
      return {
        content: "No deduction rules found in database.",
        ruleCount: 0,
        generatedAt: new Date(),
        sourceRules: []
      };
    }

    const prompt = `You are writing the Maryland SNAP Policy Manual deductions section in plain language (8th grade reading level).

Given these deduction rules from the database:
${JSON.stringify(deductions, null, 2)}

Generate clear, accessible policy text that:
1. Explains what deductions are and why they matter
2. Lists each deduction type with details (amount, percentage, caps)
3. Explains when each deduction applies
4. Uses everyday language and examples
5. Includes effective dates
6. Follows Maryland Digital Style Guide tone

Format as markdown. DO NOT include code blocks - just return the markdown text directly.`;

    try {
      const ai = getGemini();
      if (!ai) {
        console.error("Gemini API not available for text generation");
        return {
          content: "⚠️ AI text generation is temporarily unavailable. Please view the original policy manual section or try again later.",
          ruleCount: deductions.length,
          generatedAt: new Date(),
          sourceRules: deductions.map(d => `deduction_${d.id}`)
        };
      }

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt
      });
      const text = result.text || "";

      return {
        content: text,
        ruleCount: deductions.length,
        generatedAt: new Date(),
        sourceRules: deductions.map(d => `deduction_${d.id}`)
      };
    } catch (error) {
      console.error("Error generating deductions text:", error);
      return {
        content: "⚠️ Error generating policy text. Please try again or view the original policy manual section.",
        ruleCount: deductions.length,
        generatedAt: new Date(),
        sourceRules: deductions.map(d => `deduction_${d.id}`)
      };
    }
  }

  /**
   * Generate allotments section text from database rules
   */
  async generateAllotmentsText(
    benefitProgramId: string,
    sectionId?: string
  ): Promise<GeneratedText> {
    const whereConditions = [
      eq(snapAllotments.benefitProgramId, benefitProgramId),
      eq(snapAllotments.isActive, true)
    ];
    
    if (sectionId) {
      whereConditions.push(eq(snapAllotments.manualSectionId, sectionId));
    }
    
    const allotments = await db
      .select()
      .from(snapAllotments)
      .where(and(...whereConditions))
      .orderBy(snapAllotments.householdSize);

    if (allotments.length === 0) {
      return {
        content: "No allotment rules found in database.",
        ruleCount: 0,
        generatedAt: new Date(),
        sourceRules: []
      };
    }

    const prompt = `You are writing the Maryland SNAP Policy Manual benefit allotments section in plain language (8th grade reading level).

Given these maximum allotment rules from the database:
${JSON.stringify(allotments, null, 2)}

Generate clear, accessible policy text that:
1. Explains what SNAP benefit allotments are
2. Shows maximum benefits by household size in a clear table
3. Explains how actual benefits are calculated
4. Uses everyday language with examples
5. Includes effective dates
6. Follows Maryland Digital Style Guide tone

Format as markdown. DO NOT include code blocks - just return the markdown text directly.`;

    try {
      const ai = getGemini();
      if (!ai) {
        console.error("Gemini API not available for text generation");
        return {
          content: "⚠️ AI text generation is temporarily unavailable. Please view the original policy manual section or try again later.",
          ruleCount: allotments.length,
          generatedAt: new Date(),
          sourceRules: allotments.map(a => `allotment_${a.id}`)
        };
      }

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt
      });
      const text = result.text || "";

      return {
        content: text,
        ruleCount: allotments.length,
        generatedAt: new Date(),
        sourceRules: allotments.map(a => `allotment_${a.id}`)
      };
    } catch (error) {
      console.error("Error generating allotments text:", error);
      return {
        content: "⚠️ Error generating policy text. Please try again or view the original policy manual section.",
        ruleCount: allotments.length,
        generatedAt: new Date(),
        sourceRules: allotments.map(a => `allotment_${a.id}`)
      };
    }
  }

  /**
   * Generate categorical eligibility section text
   */
  async generateCategoricalEligibilityText(
    benefitProgramId: string,
    sectionId?: string
  ): Promise<GeneratedText> {
    const whereConditions = [
      eq(categoricalEligibilityRules.benefitProgramId, benefitProgramId),
      eq(categoricalEligibilityRules.isActive, true)
    ];
    
    if (sectionId) {
      whereConditions.push(eq(categoricalEligibilityRules.manualSectionId, sectionId));
    }
    
    const rules = await db
      .select()
      .from(categoricalEligibilityRules)
      .where(and(...whereConditions));

    if (rules.length === 0) {
      return {
        content: "No categorical eligibility rules found in database.",
        ruleCount: 0,
        generatedAt: new Date(),
        sourceRules: []
      };
    }

    const prompt = `You are writing the Maryland SNAP Policy Manual categorical eligibility section in plain language (8th grade reading level).

Given these categorical eligibility rules from the database:
${JSON.stringify(rules, null, 2)}

Generate clear, accessible policy text that:
1. Explains what categorical eligibility means
2. Lists programs that provide automatic eligibility (SSI, TANF, etc.)
3. Explains which tests are bypassed for each program
4. Uses everyday language with clear examples
5. Includes effective dates
6. Follows Maryland Digital Style Guide tone

Format as markdown. DO NOT include code blocks - just return the markdown text directly.`;

    try {
      const ai = getGemini();
      if (!ai) {
        console.error("Gemini API not available for text generation");
        return {
          content: "⚠️ AI text generation is temporarily unavailable. Please view the original policy manual section or try again later.",
          ruleCount: rules.length,
          generatedAt: new Date(),
          sourceRules: rules.map(r => `categorical_${r.id}`)
        };
      }

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt
      });
      const text = result.text || "";

      return {
        content: text,
        ruleCount: rules.length,
        generatedAt: new Date(),
        sourceRules: rules.map(r => `categorical_${r.id}`)
      };
    } catch (error) {
      console.error("Error generating categorical eligibility text:", error);
      return {
        content: "⚠️ Error generating policy text. Please try again or view the original policy manual section.",
        ruleCount: rules.length,
        generatedAt: new Date(),
        sourceRules: rules.map(r => `categorical_${r.id}`)
      };
    }
  }

  /**
   * Generate document requirements section text
   */
  async generateDocumentRequirementsText(
    benefitProgramId: string,
    sectionId?: string
  ): Promise<GeneratedText> {
    const whereConditions = [
      eq(documentRequirementRules.benefitProgramId, benefitProgramId),
      eq(documentRequirementRules.isActive, true)
    ];
    
    if (sectionId) {
      whereConditions.push(eq(documentRequirementRules.manualSectionId, sectionId));
    }
    
    const rules = await db
      .select()
      .from(documentRequirementRules)
      .where(and(...whereConditions));

    if (rules.length === 0) {
      return {
        content: "No document requirement rules found in database.",
        ruleCount: 0,
        generatedAt: new Date(),
        sourceRules: []
      };
    }

    const prompt = `You are writing the Maryland SNAP Policy Manual document verification section in plain language (8th grade reading level).

Given these document requirement rules from the database:
${JSON.stringify(rules, null, 2)}

Generate clear, accessible policy text that:
1. Explains what documents are needed for SNAP applications
2. Lists required vs optional documents by category (identity, income, expenses, etc.)
3. Shows acceptable document types for each requirement
4. Explains validity periods where applicable
5. Uses everyday language with helpful tips
6. Follows Maryland Digital Style Guide tone

Format as markdown. DO NOT include code blocks - just return the markdown text directly.`;

    try {
      const ai = getGemini();
      if (!ai) {
        console.error("Gemini API not available for text generation");
        return {
          content: "⚠️ AI text generation is temporarily unavailable. Please view the original policy manual section or try again later.",
          ruleCount: rules.length,
          generatedAt: new Date(),
          sourceRules: rules.map(r => `document_req_${r.id}`)
        };
      }

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt
      });
      const text = result.text || "";

      return {
        content: text,
        ruleCount: rules.length,
        generatedAt: new Date(),
        sourceRules: rules.map(r => `document_req_${r.id}`)
      };
    } catch (error) {
      console.error("Error generating document requirements text:", error);
      return {
        content: "⚠️ Error generating policy text. Please try again or view the original policy manual section.",
        ruleCount: rules.length,
        generatedAt: new Date(),
        sourceRules: rules.map(r => `document_req_${r.id}`)
      };
    }
  }

  /**
   * Generate complete section text based on section number
   * Auto-detects which rules to use based on content
   */
  async generateSectionText(
    benefitProgramId: string,
    sectionId: string
  ): Promise<GeneratedText> {
    // Get section metadata
    const [section] = await db
      .select()
      .from(manualSections)
      .where(eq(manualSections.id, sectionId));

    if (!section) {
      throw new Error(`Section ${sectionId} not found`);
    }

    const sectionNumber = section.sectionNumber;

    // Detect section type based on section number
    if (sectionNumber.startsWith('2')) {
      // Section 200s = Income limits
      return this.generateIncomeLimitsText(benefitProgramId, sectionId);
    } else if (sectionNumber.startsWith('3')) {
      // Section 300s = Deductions
      return this.generateDeductionsText(benefitProgramId, sectionId);
    } else if (sectionNumber.startsWith('4')) {
      // Section 400s = Allotments
      return this.generateAllotmentsText(benefitProgramId, sectionId);
    } else if (sectionNumber.includes('categorical') || sectionNumber.includes('SSI') || sectionNumber.includes('TANF')) {
      return this.generateCategoricalEligibilityText(benefitProgramId, sectionId);
    } else if (sectionNumber.includes('verif') || sectionNumber.includes('document')) {
      return this.generateDocumentRequirementsText(benefitProgramId, sectionId);
    } else {
      // For other sections, return a note that text generation is not yet available
      return {
        content: `Text generation for section ${sectionNumber} is not yet available. This section does not have associated Rules as Code.`,
        ruleCount: 0,
        generatedAt: new Date(),
        sourceRules: []
      };
    }
  }
}

export const textGenerationService = new TextGenerationService();
