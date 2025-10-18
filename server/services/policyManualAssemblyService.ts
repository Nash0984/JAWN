/**
 * Policy Manual Assembly Service
 * 
 * Transforms 25 golden policy sources into organized, browseable ebook-style manual
 * - Automatic chapter generation by program
 * - Section extraction from policy sources
 * - Citation tracking and cross-referencing
 * - Page numbering for ebook display
 * - Glossary term extraction
 */

import { db } from "../db";
import { 
  policySources,
  benefitPrograms,
  policyManualChapters,
  policyManualSections,
  policyGlossaryTerms,
  type InsertPolicyManualChapter,
  type InsertPolicyManualSection,
  type InsertPolicyGlossaryTerm,
} from "../../shared/schema";
import { eq, and } from "drizzle-orm";

// Chapter structure for Maryland Universal Benefits-Tax Manual
const MANUAL_CHAPTERS = [
  {
    chapterNumber: 1,
    title: "Chapter 1: SNAP (Food Supplement Program)",
    program: "SNAP",
    description: "Supplemental Nutrition Assistance Program eligibility, benefits, and rules including Maryland-specific policies",
    sortOrder: 1,
  },
  {
    chapterNumber: 2,
    title: "Chapter 2: Medicaid Coverage",
    program: "Medicaid",
    description: "Maryland Medical Assistance Program eligibility and coverage requirements",
    sortOrder: 2,
  },
  {
    chapterNumber: 3,
    title: "Chapter 3: TCA/TANF Cash Assistance",
    program: "TANF",
    description: "Temporary Cash Assistance (Maryland's TANF program) eligibility and benefit determination",
    sortOrder: 3,
  },
  {
    chapterNumber: 4,
    title: "Chapter 4: OHEP Energy Assistance",
    program: "OHEP",
    description: "Maryland Office of Home Energy Programs - heating and cooling assistance",
    sortOrder: 4,
  },
  {
    chapterNumber: 5,
    title: "Chapter 5: Tax Credits and Property Tax Relief",
    program: "Tax",
    description: "Maryland state tax credits including EITC, property tax credits, and renter's credits",
    sortOrder: 5,
  },
  {
    chapterNumber: 6,
    title: "Chapter 6: VITA Tax Preparation",
    program: "VITA",
    description: "Volunteer Income Tax Assistance program guidelines and federal tax preparation",
    sortOrder: 6,
  },
];

/**
 * Assemble complete policy manual from golden sources
 */
export async function assembleCompleteManual(): Promise<{
  chapters: number;
  sections: number;
  glossaryTerms: number;
}> {
  console.log("📖 Assembling Maryland Universal Benefits-Tax Policy Manual...");
  
  // Step 1: Create/update chapters
  const chapters = await createChapters();
  console.log(`✓ Created ${chapters} chapters`);
  
  // Step 2: Extract sections from policy sources
  const sections = await extractSectionsFromSources();
  console.log(`✓ Extracted ${sections} sections from policy sources`);
  
  // Step 3: Assign page numbers
  await assignPageNumbers();
  console.log(`✓ Assigned page numbers for ebook display`);
  
  // Step 4: Extract glossary terms
  const glossaryTerms = await extractGlossaryTerms();
  console.log(`✓ Extracted ${glossaryTerms} glossary terms`);
  
  console.log("✅ Policy manual assembly complete");
  
  return {
    chapters,
    sections,
    glossaryTerms,
  };
}

/**
 * Create manual chapters
 */
async function createChapters(): Promise<number> {
  let count = 0;
  
  for (const chapterDef of MANUAL_CHAPTERS) {
    const existing = await db.select()
      .from(policyManualChapters)
      .where(eq(policyManualChapters.chapterNumber, chapterDef.chapterNumber))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(policyManualChapters).values(chapterDef as InsertPolicyManualChapter);
      count++;
    } else {
      // Update existing
      await db.update(policyManualChapters)
        .set({
          title: chapterDef.title,
          description: chapterDef.description,
          updatedAt: new Date(),
        })
        .where(eq(policyManualChapters.id, existing[0].id));
    }
  }
  
  return count;
}

/**
 * Extract sections from policy sources and link to chapters
 */
async function extractSectionsFromSources(): Promise<number> {
  // Get all active policy sources
  const sources = await db.select().from(policySources);
  
  let count = 0;
  
  for (const source of sources) {
    try {
      // Use benefitProgramId for reliable program routing
      if (!source.benefitProgramId) {
        console.warn(`⚠️ No benefitProgramId for source: ${source.name || source.id}`);
        continue;
      }

      const programCode = await getProgramCodeFromBenefitId(source.benefitProgramId);
      const chapter = await db.select()
        .from(policyManualChapters)
        .where(eq(policyManualChapters.program, programCode))
        .limit(1);
      
      if (chapter.length === 0) {
        console.warn(`⚠️ No chapter found for benefitProgramId: ${source.benefitProgramId} (source: ${source.name || source.id})`);
        continue;
      }
      
      // Check if section already exists
      const existingSection = await db.select()
        .from(policyManualSections)
        .where(and(
          eq(policyManualSections.policySourceId, source.id),
          eq(policyManualSections.chapterId, chapter[0].id)
        ))
        .limit(1);
      
      if (existingSection.length > 0) {
        continue; // Already exists
      }
      
      // Create section from policy source
      const sectionNumber = await getNextSectionNumber(chapter[0].id);
      
      const section: InsertPolicyManualSection = {
        chapterId: chapter[0].id,
        sectionNumber,
        title: source.name || 'Untitled Policy Source',
        content: generateSectionContent(source),
        policySourceId: source.id,
        legalCitation: null, // No citation field in schema - could derive from description if needed
        effectiveDate: source.lastSyncAt || new Date(),
        sourceUrl: source.url || null,
        keywords: extractKeywords(source),
        rulesAsCodeReference: source.racCodeLocation || null,
        sortOrder: count + 1,
      };
      
      await db.insert(policyManualSections).values(section);
      count++;
    } catch (error) {
      console.error(`❌ Error processing policy source ${source.id}:`, error);
      // Continue processing other sources
    }
  }
  
  return count;
}

/**
 * Assign sequential page numbers for ebook-style display
 */
async function assignPageNumbers(): Promise<void> {
  const chapters = await db.select()
    .from(policyManualChapters)
    .orderBy(policyManualChapters.sortOrder);
  
  let currentPage = 1;
  
  // Table of contents = 2 pages
  currentPage += 2;
  
  for (const chapter of chapters) {
    // Chapter title page
    currentPage += 1;
    
    const sections = await db.select()
      .from(policyManualSections)
      .where(eq(policyManualSections.chapterId, chapter.id))
      .orderBy(policyManualSections.sortOrder);
    
    for (const section of sections) {
      // Estimate pages based on content length (500 words per page)
      const wordCount = section.content.split(/\s+/).length;
      const estimatedPages = Math.ceil(wordCount / 500);
      
      await db.update(policyManualSections)
        .set({
          pageNumber: currentPage,
          pageNumberEnd: currentPage + estimatedPages - 1,
        })
        .where(eq(policyManualSections.id, section.id));
      
      currentPage += estimatedPages;
    }
  }
}

/**
 * Extract glossary terms from policy sources
 */
async function extractGlossaryTerms(): Promise<number> {
  // Common benefit program terms with definitions
  const commonTerms: Array<Omit<InsertPolicyGlossaryTerm, 'createdAt' | 'updatedAt'>> = [
    {
      term: "Gross Income",
      definition: "Total household income before deductions. For SNAP, includes all countable income from all sources.",
      program: "SNAP",
      legalCitation: "7 CFR § 273.9(b)",
      category: "income",
      acronym: null,
      examples: ["Wages from employment", "Social Security benefits", "Child support received"],
      relatedTerms: ["Net Income", "Countable Income"],
      sortOrder: 1,
    },
    {
      term: "Net Income",
      definition: "Household income after allowable deductions are subtracted from gross income.",
      program: "SNAP",
      legalCitation: "7 CFR § 273.9(d)",
      category: "income",
      acronym: null,
      examples: ["Gross income - standard deduction - earned income deduction - dependent care - medical - excess shelter"],
      relatedTerms: ["Gross Income", "Allowable Deductions"],
      sortOrder: 2,
    },
    {
      term: "Federal Poverty Level",
      definition: "Annual income guidelines published by HHS used to determine eligibility for many benefit programs. Also called Federal Poverty Guidelines (FPG).",
      program: null, // Universal
      legalCitation: "42 USC § 9902",
      category: "eligibility",
      acronym: "FPL",
      examples: ["2025 FPL for household of 4: $31,200", "130% FPL for SNAP gross income limit", "138% FPL for Medicaid expansion"],
      relatedTerms: ["Income Limits", "Eligibility"],
      sortOrder: 3,
    },
    {
      term: "Categorical Eligibility",
      definition: "Automatic eligibility for SNAP based on receipt of other benefits (SSI, TANF) without needing to meet standard income/asset tests.",
      program: "SNAP",
      legalCitation: "7 CFR § 273.2(j)",
      category: "eligibility",
      acronym: null,
      examples: ["SSI recipients", "TANF recipients", "Broad-based categorical eligibility states"],
      relatedTerms: ["SSI", "TANF", "Gross Income"],
      sortOrder: 4,
    },
    {
      term: "Standard Deduction",
      definition: "Fixed deduction amount subtracted from gross income when calculating net income, based on household size.",
      program: "SNAP",
      legalCitation: "7 CFR § 273.9(d)(2)",
      category: "deduction",
      acronym: null,
      examples: ["FY 2025: $198 for households 1-3", "$232 for households 4", "$273 for households 5", "$314 for households 6+"],
      relatedTerms: ["Net Income", "Allowable Deductions"],
      sortOrder: 5,
    },
    {
      term: "Shelter Deduction",
      definition: "Deduction for housing costs (rent/mortgage, utilities) that exceed 50% of household income after other deductions.",
      program: "SNAP",
      legalCitation: "7 CFR § 273.9(d)(6)",
      category: "deduction",
      acronym: null,
      examples: ["Rent or mortgage + utilities - 50% of income after deductions", "Capped for non-elderly/disabled households", "Uncapped for elderly/disabled"],
      relatedTerms: ["Standard Utility Allowance", "Excess Shelter Cost"],
      sortOrder: 6,
    },
    {
      term: "MAGI",
      definition: "Modified Adjusted Gross Income - income calculation method used for Medicaid eligibility based on federal tax definitions.",
      program: "Medicaid",
      legalCitation: "42 CFR § 435.603",
      category: "income",
      acronym: "MAGI",
      examples: ["AGI from tax return + excluded foreign income + tax-exempt interest + nontaxable Social Security"],
      relatedTerms: ["Adjusted Gross Income", "Tax Household"],
      sortOrder: 7,
    },
    {
      term: "EITC",
      definition: "Earned Income Tax Credit - refundable federal tax credit for low to moderate-income workers, especially those with children.",
      program: "Tax",
      legalCitation: "26 USC § 32",
      category: "benefit",
      acronym: "EITC",
      examples: ["2024 max: $7,830 (3+ children)", "$6,960 (2 children)", "$4,213 (1 child)", "$632 (no children)"],
      relatedTerms: ["Refundable Credit", "Child Tax Credit"],
      sortOrder: 8,
    },
    {
      term: "SNAP",
      definition: "Supplemental Nutrition Assistance Program - federal program providing food assistance to low-income individuals and families. Known as Food Supplement Program (FSP) in Maryland.",
      program: null,
      legalCitation: "7 USC § 2011",
      category: "benefit",
      acronym: "SNAP",
      examples: ["Food stamps", "EBT card", "Monthly food benefits"],
      relatedTerms: ["Food Supplement Program", "FSP", "EBT"],
      sortOrder: 9,
    },
    {
      term: "TANF",
      definition: "Temporary Assistance for Needy Families - federal block grant providing cash assistance and services to families with children. Known as Temporary Cash Assistance (TCA) in Maryland.",
      program: null,
      legalCitation: "42 USC § 601",
      category: "benefit",
      acronym: "TANF",
      examples: ["Cash assistance", "Work requirements", "60-month lifetime limit"],
      relatedTerms: ["TCA", "Temporary Cash Assistance"],
      sortOrder: 10,
    },
  ];
  
  let count = 0;
  
  for (const term of commonTerms) {
    // Check if term already exists
    const existing = await db.select()
      .from(policyGlossaryTerms)
      .where(eq(policyGlossaryTerms.term, term.term))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(policyGlossaryTerms).values(term);
      count++;
    }
  }
  
  return count;
}

/**
 * Helper: Map benefitProgramId to program code
 * This uses the actual benefit_programs table relationship instead of fragile sourceType mapping
 */
async function getProgramCodeFromBenefitId(benefitProgramId: string): Promise<string> {
  try {
    const program = await db.select()
      .from(benefitPrograms)
      .where(eq(benefitPrograms.id, benefitProgramId))
      .limit(1);
    
    if (program.length > 0 && program[0].code) {
      return program[0].code;
    }
  } catch (error) {
    console.error(`Error fetching benefit program ${benefitProgramId}:`, error);
  }
  
  return 'SNAP'; // Default fallback
}

/**
 * Helper: Get next section number for chapter
 */
async function getNextSectionNumber(chapterId: string): Promise<string> {
  const sections = await db.select()
    .from(policyManualSections)
    .where(eq(policyManualSections.chapterId, chapterId));
  
  const chapter = await db.select()
    .from(policyManualChapters)
    .where(eq(policyManualChapters.id, chapterId))
    .limit(1);
  
  if (chapter.length === 0) return "1.1";
  
  const chapterNum = chapter[0].chapterNumber;
  const nextSection = sections.length + 1;
  
  return `${chapterNum}.${nextSection}`;
}

/**
 * Helper: Generate section content from policy source
 */
function generateSectionContent(source: any): string {
  let content = `# ${source.name || 'Untitled Policy Source'}\n\n`;
  
  if (source.description) {
    content += `${source.description}\n\n`;
  }
  
  if (source.lastSyncAt) {
    content += `**Last Updated:** ${new Date(source.lastSyncAt).toLocaleDateString()}\n\n`;
  }
  
  if (source.url) {
    content += `**Source:** [${source.url}](${source.url})\n\n`;
  }
  
  if (source.jurisdiction) {
    content += `**Jurisdiction:** ${source.jurisdiction}\n\n`;
  }
  
  if (source.sourceType) {
    content += `**Source Type:** ${source.sourceType}\n\n`;
  }
  
  content += `---\n\n`;
  content += `This section is derived from the authoritative policy source listed above. `;
  content += `For the most current version, refer to the official source document.\n\n`;
  
  if (source.syncSchedule && source.syncSchedule !== 'off') {
    content += `**Auto-Update:** This policy source is monitored ${source.syncSchedule} for updates.\n\n`;
  }
  
  if (source.racStatus) {
    content += `**Rules as Code Status:** ${source.racStatus}\n\n`;
  }
  
  return content;
}

/**
 * Helper: Extract keywords from policy source
 */
function extractKeywords(source: any): string[] {
  const keywords: string[] = [];
  
  // Extract from source name - add null safety
  if (source.name) {
    const nameWords = source.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 3);
    
    keywords.push(...nameWords);
  }
  
  // Extract from description
  if (source.description) {
    const descWords = source.description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 4)
      .slice(0, 10); // Limit to first 10 meaningful words
    
    keywords.push(...descWords);
  }
  
  // Add program-specific keywords based on sourceType
  if (source.sourceType?.toLowerCase().includes('snap')) {
    keywords.push('food', 'nutrition', 'eligibility', 'benefits', 'ebt');
  }
  if (source.sourceType?.toLowerCase().includes('medicaid')) {
    keywords.push('healthcare', 'medical', 'coverage', 'magi');
  }
  if (source.sourceType?.toLowerCase().includes('tanf')) {
    keywords.push('cash', 'assistance', 'work', 'requirements');
  }
  if (source.sourceType?.toLowerCase().includes('vita') || source.sourceType?.toLowerCase().includes('tax')) {
    keywords.push('tax', 'eitc', 'credit', 'refund', 'volunteer');
  }
  
  // Add jurisdiction
  if (source.jurisdiction) {
    keywords.push(source.jurisdiction.toLowerCase());
  }
  
  return [...new Set(keywords)]; // Deduplicate
}


/**
 * Rebuild specific chapter
 */
export async function rebuildChapter(chapterNumber: number): Promise<void> {
  console.log(`🔄 Rebuilding Chapter ${chapterNumber}...`);
  
  const chapter = await db.select()
    .from(policyManualChapters)
    .where(eq(policyManualChapters.chapterNumber, chapterNumber))
    .limit(1);
  
  if (chapter.length === 0) {
    throw new Error(`Chapter ${chapterNumber} not found`);
  }
  
  // Re-extract sections for this chapter's program
  const sources = await db.select()
    .from(policySources);
  
  for (const source of sources) {
    try {
      if (!source.benefitProgramId) {
        continue;
      }

      const programCode = await getProgramCodeFromBenefitId(source.benefitProgramId);
      
      if (programCode === chapter[0].program) {
        // Update or create section
        const existingSection = await db.select()
          .from(policyManualSections)
          .where(and(
            eq(policyManualSections.policySourceId, source.id),
            eq(policyManualSections.chapterId, chapter[0].id)
          ))
          .limit(1);
        
        const content = generateSectionContent(source);
        
        if (existingSection.length > 0) {
          await db.update(policyManualSections)
            .set({
              content,
              updatedAt: new Date(),
            })
            .where(eq(policyManualSections.id, existingSection[0].id));
        }
      }
    } catch (error) {
      console.error(`Error rebuilding section for source ${source.id}:`, error);
      // Continue with other sources
    }
  }
  
  console.log(`✅ Chapter ${chapterNumber} rebuilt`);
}
