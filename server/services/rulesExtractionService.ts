import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db";
import { 
  manualSections, 
  documentChunks, 
  documents,
  extractionJobs,
  snapIncomeLimits,
  snapDeductions,
  snapAllotments,
  categoricalEligibilityRules,
  documentRequirementRules,
  benefitPrograms
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

const geminiApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.warn("Warning: No Gemini API key found for rules extraction");
}

const genAI = new GoogleGenerativeAI(geminiApiKey || "");

/**
 * Safely parse Gemini JSON response with error handling
 */
function parseGeminiResponse<T>(responseText: string, arrayKey: string, functionName: string): T[] {
  try {
    // Handle markdown code blocks
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```')) {
      const match = jsonText.match(/```(?:json)?\n([\s\S]*?)\n```/);
      if (match) {
        jsonText = match[1].trim();
      }
    }
    
    const parsed = JSON.parse(jsonText);
    
    // Validate response structure
    if (!parsed || typeof parsed !== 'object') {
      console.error(`[${functionName}] Invalid Gemini response structure (not object):`, responseText);
      return [];
    }
    
    const data = parsed[arrayKey];
    
    // Ensure we got an array
    if (!Array.isArray(data)) {
      console.error(`[${functionName}] Invalid Gemini response - expected array for key '${arrayKey}', got:`, typeof data);
      return [];
    }
    
    return data as T[];
  } catch (error) {
    console.error(`[${functionName}] Error parsing Gemini response:`, error);
    if (responseText) console.error(`[${functionName}] Response text:`, responseText);
    return [];
  }
}

interface ExtractedIncomeLimit {
  householdSize: number;
  grossMonthlyLimit: number; // in cents
  netMonthlyLimit: number; // in cents
  percentOfPoverty: number;
  effectiveDate: string;
  notes?: string;
}

interface ExtractedDeduction {
  deductionType: string; // standard, earned_income, dependent_care, shelter, medical
  deductionName: string;
  calculationType: string; // fixed, percentage, tiered, capped
  amount?: number; // in cents
  percentage?: number;
  minAmount?: number;
  maxAmount?: number;
  conditions?: any;
  effectiveDate: string;
  notes?: string;
}

interface ExtractedAllotment {
  householdSize: number;
  maxMonthlyBenefit: number; // in cents
  minMonthlyBenefit?: number;
  effectiveDate: string;
  notes?: string;
}

interface ExtractedCategoricalRule {
  ruleName: string;
  ruleCode: string; // SSI, TANF, GA, BBCE
  description: string;
  bypassGrossIncomeTest: boolean;
  bypassAssetTest: boolean;
  bypassNetIncomeTest: boolean;
  conditions?: any;
  effectiveDate: string;
  notes?: string;
}

interface ExtractedDocumentRequirement {
  requirementName: string;
  documentType: string; // income, identity, residency, expenses
  requiredWhen: any;
  acceptableDocuments: any[];
  validityPeriod?: number; // days
  isRequired: boolean;
  canBeWaived: boolean;
  waiverConditions?: any;
  effectiveDate: string;
  notes?: string;
}

/**
 * Determine extraction type based on section number and content
 */
function detectExtractionType(sectionNumber: string, sectionTitle: string): string {
  const num = parseInt(sectionNumber);
  
  // Income-related sections (200s)
  if (num >= 200 && num < 300) {
    if (sectionTitle.toLowerCase().includes('income') && 
        (sectionTitle.toLowerCase().includes('limit') || sectionTitle.toLowerCase().includes('eligibility'))) {
      return 'income_limits';
    }
  }
  
  // Deduction sections (300s)
  if (num >= 300 && num < 400) {
    return 'deductions';
  }
  
  // Allotment sections (400s)
  if (num >= 400 && num < 500) {
    if (sectionTitle.toLowerCase().includes('allotment') || sectionTitle.toLowerCase().includes('benefit')) {
      return 'allotments';
    }
  }
  
  // Categorical eligibility (100s)
  if (num >= 100 && num < 200) {
    if (sectionTitle.toLowerCase().includes('categorical') || 
        sectionTitle.toLowerCase().includes('ssi') || 
        sectionTitle.toLowerCase().includes('tanf')) {
      return 'categorical_eligibility';
    }
  }
  
  // Document requirements (500s, 600s, or verification sections)
  if ((num >= 500 && num < 700) || 
      sectionTitle.toLowerCase().includes('verification') ||
      sectionTitle.toLowerCase().includes('document')) {
    return 'document_requirements';
  }
  
  // Default: auto-detect based on content analysis
  return 'full_auto';
}

/**
 * Extract income limits from section text using Gemini
 */
async function extractIncomeLimits(sectionText: string, sectionNumber: string): Promise<ExtractedIncomeLimit[]> {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      temperature: 0.1, // Low temperature for accuracy
      responseMimeType: "application/json",
    }
  });

  const prompt = `You are an expert at extracting structured policy rules from government documents.

Analyze this SNAP policy manual section about income limits and extract all income limit rules as structured data.

Section ${sectionNumber} Text:
${sectionText}

Extract ALL income limits mentioned in the text. For each income limit, provide:
1. householdSize: The household size (1, 2, 3, etc.)
2. grossMonthlyLimit: Gross monthly income limit in CENTS (multiply dollars by 100)
3. netMonthlyLimit: Net monthly income limit in CENTS (multiply dollars by 100)
4. percentOfPoverty: Percentage of Federal Poverty Level (e.g., 200 for 200% FPL)
5. effectiveDate: Effective date in ISO format (YYYY-MM-DD), or use current date if not specified
6. notes: Any additional context or conditions

Return a JSON object with this structure:
{
  "incomeLimits": [
    {
      "householdSize": 1,
      "grossMonthlyLimit": 200000,
      "netMonthlyLimit": 154000,
      "percentOfPoverty": 200,
      "effectiveDate": "2023-10-01",
      "notes": "Additional context here"
    }
  ]
}

If no income limits are found, return: {"incomeLimits": []}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  return parseGeminiResponse<ExtractedIncomeLimit>(responseText, 'incomeLimits', 'extractIncomeLimits');
}

/**
 * Extract deduction rules from section text using Gemini
 */
async function extractDeductions(sectionText: string, sectionNumber: string): Promise<ExtractedDeduction[]> {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    }
  });

  const prompt = `You are an expert at extracting structured policy rules from government documents.

Analyze this SNAP policy manual section about deductions and extract all deduction rules as structured data.

Section ${sectionNumber} Text:
${sectionText}

Extract ALL deductions mentioned. For each deduction, provide:
1. deductionType: One of: "standard", "earned_income", "dependent_care", "shelter", "medical"
2. deductionName: Human-readable name
3. calculationType: One of: "fixed", "percentage", "tiered", "capped"
4. amount: Fixed amount in CENTS if applicable (multiply dollars by 100)
5. percentage: Percentage if applicable (e.g., 20 for 20%)
6. minAmount: Minimum amount in CENTS if applicable
7. maxAmount: Maximum amount/cap in CENTS if applicable
8. conditions: Object describing when this deduction applies
9. effectiveDate: Effective date in ISO format
10. notes: Additional context

Return JSON: {"deductions": [{deductionType, deductionName, ...}]}
If none found: {"deductions": []}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  return parseGeminiResponse<ExtractedDeduction>(responseText, 'deductions', 'extractDeductions');
}

/**
 * Extract allotment amounts from section text using Gemini
 */
async function extractAllotments(sectionText: string, sectionNumber: string): Promise<ExtractedAllotment[]> {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    }
  });

  const prompt = `You are an expert at extracting structured policy rules from government documents.

Analyze this SNAP policy manual section about benefit allotments and extract all allotment amounts as structured data.

Section ${sectionNumber} Text:
${sectionText}

Extract ALL allotment/benefit amounts mentioned. For each, provide:
1. householdSize: The household size (1, 2, 3, etc.)
2. maxMonthlyBenefit: Maximum monthly benefit in CENTS (multiply dollars by 100)
3. minMonthlyBenefit: Minimum benefit in CENTS if mentioned
4. effectiveDate: Effective date in ISO format
5. notes: Additional context

Return JSON: {"allotments": [{householdSize, maxMonthlyBenefit, ...}]}
If none found: {"allotments": []}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  return parseGeminiResponse<ExtractedAllotment>(responseText, 'allotments', 'extractAllotments');
}

/**
 * Extract categorical eligibility rules from section text using Gemini
 */
async function extractCategoricalRules(sectionText: string, sectionNumber: string): Promise<ExtractedCategoricalRule[]> {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    }
  });

  const prompt = `You are an expert at extracting structured policy rules from government documents.

Analyze this SNAP policy manual section about categorical eligibility and extract all categorical eligibility rules.

Section ${sectionNumber} Text:
${sectionText}

Extract ALL categorical eligibility rules (SSI, TANF, GA, BBCE, etc.). For each rule, provide:
1. ruleName: Full name of the rule
2. ruleCode: Short code (SSI, TANF, GA, BBCE, etc.)
3. description: Description of who qualifies
4. bypassGrossIncomeTest: true/false
5. bypassAssetTest: true/false
6. bypassNetIncomeTest: true/false
7. conditions: Object describing eligibility conditions
8. effectiveDate: Effective date in ISO format
9. notes: Additional context

Return JSON: {"categoricalRules": [{ruleName, ruleCode, ...}]}
If none found: {"categoricalRules": []}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  return parseGeminiResponse<ExtractedCategoricalRule>(responseText, 'categoricalRules', 'extractCategoricalRules');
}

/**
 * Extract document requirements from section text using Gemini
 */
async function extractDocumentRequirements(sectionText: string, sectionNumber: string): Promise<ExtractedDocumentRequirement[]> {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    }
  });

  const prompt = `You are an expert at extracting structured policy rules from government documents.

Analyze this SNAP policy manual section about document requirements and extract all document requirement rules.

Section ${sectionNumber} Text:
${sectionText}

Extract ALL document requirements. For each requirement, provide:
1. requirementName: Name of the requirement
2. documentType: One of: "income", "identity", "residency", "expenses", "citizenship", "other"
3. requiredWhen: Object describing when this document is required
4. acceptableDocuments: Array of acceptable document types
5. validityPeriod: Number of days document remains valid
6. isRequired: true/false
7. canBeWaived: true/false
8. waiverConditions: Object describing waiver conditions
9. effectiveDate: Effective date in ISO format
10. notes: Additional context

Return JSON: {"documentRequirements": [{requirementName, documentType, ...}]}
If none found: {"documentRequirements": []}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  return parseGeminiResponse<ExtractedDocumentRequirement>(responseText, 'documentRequirements', 'extractDocumentRequirements');
}

/**
 * Main extraction function - analyzes section and extracts appropriate rules
 */
export async function extractRulesFromSection(
  manualSectionId: string,
  extractionType?: string,
  userId?: string
): Promise<{
  jobId: string;
  rulesExtracted: number;
  extractionType: string;
}> {
  // Get manual section
  const [section] = await db
    .select()
    .from(manualSections)
    .where(eq(manualSections.id, manualSectionId));
  
  if (!section) {
    throw new Error(`Manual section not found: ${manualSectionId}`);
  }

  // Get section text from document chunks
  const chunks = await db
    .select()
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .innerJoin(manualSections, eq(manualSections.documentId, documents.id))
    .where(eq(manualSections.id, manualSectionId))
    .orderBy(documentChunks.chunkIndex);

  if (chunks.length === 0) {
    throw new Error(`No content found for section ${section.sectionNumber}`);
  }

  // Combine chunk content
  const sectionText = chunks.map(c => c.document_chunks.content).join('\n\n');

  // Detect extraction type if not provided
  const finalExtractionType = extractionType || detectExtractionType(section.sectionNumber, section.sectionTitle);

  // Create extraction job
  const [job] = await db
    .insert(extractionJobs)
    .values({
      manualSectionId: section.id,
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle,
      extractionType: finalExtractionType,
      status: 'processing',
      extractedBy: userId,
      startedAt: new Date(),
    })
    .returning();

  try {
    let extractedRules: any[] = [];
    let rulesCount = 0;

    // Get Maryland SNAP program ID
    const [snapProgram] = await db
      .select()
      .from(benefitPrograms)
      .where(eq(benefitPrograms.code, 'SNAP'));

    if (!snapProgram) {
      throw new Error('SNAP benefit program not found in database');
    }

    // Extract based on type
    switch (finalExtractionType) {
      case 'income_limits':
        const incomeLimits = await extractIncomeLimits(sectionText, section.sectionNumber);
        extractedRules = incomeLimits;
        
        // Insert into database
        for (const limit of incomeLimits) {
          await db.insert(snapIncomeLimits).values({
            benefitProgramId: snapProgram.id,
            householdSize: limit.householdSize,
            grossMonthlyLimit: limit.grossMonthlyLimit,
            netMonthlyLimit: limit.netMonthlyLimit,
            percentOfPoverty: limit.percentOfPoverty,
            effectiveDate: new Date(limit.effectiveDate),
            isActive: true,
            notes: limit.notes,
            createdBy: userId,
          });
          rulesCount++;
        }
        break;

      case 'deductions':
        const deductions = await extractDeductions(sectionText, section.sectionNumber);
        extractedRules = deductions;
        
        for (const deduction of deductions) {
          await db.insert(snapDeductions).values({
            benefitProgramId: snapProgram.id,
            deductionType: deduction.deductionType,
            deductionName: deduction.deductionName,
            calculationType: deduction.calculationType,
            amount: deduction.amount,
            percentage: deduction.percentage,
            minAmount: deduction.minAmount,
            maxAmount: deduction.maxAmount,
            conditions: deduction.conditions,
            effectiveDate: new Date(deduction.effectiveDate),
            isActive: true,
            notes: deduction.notes,
            createdBy: userId,
          });
          rulesCount++;
        }
        break;

      case 'allotments':
        const allotments = await extractAllotments(sectionText, section.sectionNumber);
        extractedRules = allotments;
        
        for (const allotment of allotments) {
          await db.insert(snapAllotments).values({
            benefitProgramId: snapProgram.id,
            householdSize: allotment.householdSize,
            maxMonthlyBenefit: allotment.maxMonthlyBenefit,
            minMonthlyBenefit: allotment.minMonthlyBenefit,
            effectiveDate: new Date(allotment.effectiveDate),
            isActive: true,
            notes: allotment.notes,
            createdBy: userId,
          });
          rulesCount++;
        }
        break;

      case 'categorical_eligibility':
        const catRules = await extractCategoricalRules(sectionText, section.sectionNumber);
        extractedRules = catRules;
        
        for (const rule of catRules) {
          await db.insert(categoricalEligibilityRules).values({
            benefitProgramId: snapProgram.id,
            ruleName: rule.ruleName,
            ruleCode: rule.ruleCode,
            description: rule.description,
            bypassGrossIncomeTest: rule.bypassGrossIncomeTest,
            bypassAssetTest: rule.bypassAssetTest,
            bypassNetIncomeTest: rule.bypassNetIncomeTest,
            conditions: rule.conditions,
            effectiveDate: new Date(rule.effectiveDate),
            isActive: true,
            notes: rule.notes,
            createdBy: userId,
          });
          rulesCount++;
        }
        break;

      case 'document_requirements':
        const docReqs = await extractDocumentRequirements(sectionText, section.sectionNumber);
        extractedRules = docReqs;
        
        for (const req of docReqs) {
          await db.insert(documentRequirementRules).values({
            benefitProgramId: snapProgram.id,
            requirementName: req.requirementName,
            documentType: req.documentType,
            requiredWhen: req.requiredWhen,
            acceptableDocuments: req.acceptableDocuments,
            validityPeriod: req.validityPeriod,
            isRequired: req.isRequired,
            canBeWaived: req.canBeWaived,
            waiverConditions: req.waiverConditions,
            effectiveDate: new Date(req.effectiveDate),
            isActive: true,
            notes: req.notes,
            createdBy: userId,
          });
          rulesCount++;
        }
        break;

      case 'full_auto':
        // Try each extraction type and combine results
        const autoIncomeLimits = await extractIncomeLimits(sectionText, section.sectionNumber);
        const autoDeductions = await extractDeductions(sectionText, section.sectionNumber);
        const autoAllotments = await extractAllotments(sectionText, section.sectionNumber);
        const autoCatRules = await extractCategoricalRules(sectionText, section.sectionNumber);
        const autoDocReqs = await extractDocumentRequirements(sectionText, section.sectionNumber);
        
        extractedRules = [
          ...autoIncomeLimits,
          ...autoDeductions,
          ...autoAllotments,
          ...autoCatRules,
          ...autoDocReqs
        ];
        
        // Insert all extracted rules
        for (const limit of autoIncomeLimits) {
          await db.insert(snapIncomeLimits).values({
            benefitProgramId: snapProgram.id,
            householdSize: limit.householdSize,
            grossMonthlyLimit: limit.grossMonthlyLimit,
            netMonthlyLimit: limit.netMonthlyLimit,
            percentOfPoverty: limit.percentOfPoverty,
            effectiveDate: new Date(limit.effectiveDate),
            isActive: true,
            notes: limit.notes,
            createdBy: userId,
          });
          rulesCount++;
        }
        
        for (const deduction of autoDeductions) {
          await db.insert(snapDeductions).values({
            benefitProgramId: snapProgram.id,
            deductionType: deduction.deductionType,
            deductionName: deduction.deductionName,
            calculationType: deduction.calculationType,
            amount: deduction.amount,
            percentage: deduction.percentage,
            minAmount: deduction.minAmount,
            maxAmount: deduction.maxAmount,
            conditions: deduction.conditions,
            effectiveDate: new Date(deduction.effectiveDate),
            isActive: true,
            notes: deduction.notes,
            createdBy: userId,
          });
          rulesCount++;
        }
        
        for (const allotment of autoAllotments) {
          await db.insert(snapAllotments).values({
            benefitProgramId: snapProgram.id,
            householdSize: allotment.householdSize,
            maxMonthlyBenefit: allotment.maxMonthlyBenefit,
            minMonthlyBenefit: allotment.minMonthlyBenefit,
            effectiveDate: new Date(allotment.effectiveDate),
            isActive: true,
            notes: allotment.notes,
            createdBy: userId,
          });
          rulesCount++;
        }
        
        for (const rule of autoCatRules) {
          await db.insert(categoricalEligibilityRules).values({
            benefitProgramId: snapProgram.id,
            ruleName: rule.ruleName,
            ruleCode: rule.ruleCode,
            description: rule.description,
            bypassGrossIncomeTest: rule.bypassGrossIncomeTest,
            bypassAssetTest: rule.bypassAssetTest,
            bypassNetIncomeTest: rule.bypassNetIncomeTest,
            conditions: rule.conditions,
            effectiveDate: new Date(rule.effectiveDate),
            isActive: true,
            notes: rule.notes,
            createdBy: userId,
          });
          rulesCount++;
        }
        
        for (const req of autoDocReqs) {
          await db.insert(documentRequirementRules).values({
            benefitProgramId: snapProgram.id,
            requirementName: req.requirementName,
            documentType: req.documentType,
            requiredWhen: req.requiredWhen,
            acceptableDocuments: req.acceptableDocuments,
            validityPeriod: req.validityPeriod,
            isRequired: req.isRequired,
            canBeWaived: req.canBeWaived,
            waiverConditions: req.waiverConditions,
            effectiveDate: new Date(req.effectiveDate),
            isActive: true,
            notes: req.notes,
            createdBy: userId,
          });
          rulesCount++;
        }
        break;
    }

    // Update job as completed
    await db
      .update(extractionJobs)
      .set({
        status: 'completed',
        rulesExtracted: rulesCount,
        extractedRules: extractedRules,
        completedAt: new Date(),
      })
      .where(eq(extractionJobs.id, job.id));

    return {
      jobId: job.id,
      rulesExtracted: rulesCount,
      extractionType: finalExtractionType,
    };

  } catch (error) {
    // Update job as failed
    await db
      .update(extractionJobs)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      })
      .where(eq(extractionJobs.id, job.id));

    throw error;
  }
}

/**
 * Get extraction job status
 */
export async function getExtractionJob(jobId: string) {
  const [job] = await db
    .select()
    .from(extractionJobs)
    .where(eq(extractionJobs.id, jobId));
  
  return job;
}

/**
 * Get all extraction jobs
 */
export async function getAllExtractionJobs() {
  return await db
    .select()
    .from(extractionJobs)
    .orderBy(extractionJobs.createdAt);
}

/**
 * Batch extract rules from multiple sections
 */
export async function batchExtractRules(
  manualSectionIds: string[],
  userId?: string
): Promise<{
  totalSections: number;
  successfulExtractions: number;
  failedExtractions: number;
  totalRulesExtracted: number;
}> {
  let successCount = 0;
  let failCount = 0;
  let totalRules = 0;

  for (const sectionId of manualSectionIds) {
    try {
      const result = await extractRulesFromSection(sectionId, undefined, userId);
      successCount++;
      totalRules += result.rulesExtracted;
    } catch (error) {
      console.error(`Failed to extract rules from section ${sectionId}:`, error);
      failCount++;
    }
  }

  return {
    totalSections: manualSectionIds.length,
    successfulExtractions: successCount,
    failedExtractions: failCount,
    totalRulesExtracted: totalRules,
  };
}
