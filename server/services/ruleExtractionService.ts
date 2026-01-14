import { db } from "../db";
import { 
  ruleFragments, formalRules, ruleExtractionLogs, statutorySources,
  InsertRuleFragment, InsertFormalRule, InsertRuleExtractionLog,
  RuleFragment, FormalRule
} from "@shared/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { generateTextWithGemini } from "./gemini.service";
import { legalOntologyService } from "./legalOntologyService";

export type PromptStrategy = "vanilla" | "undirected" | "directed_symbolic";
export type RuleType = "requirement" | "exception" | "threshold" | "verification" | "definition";
export type EligibilityDomain = "income" | "residency" | "citizenship" | "resources" | "work_requirement" | "student_status" | "household_composition" | "age" | "disability" | "other";

interface ExtractedRule {
  ruleName: string;
  eligibilityDomain: EligibilityDomain;
  z3Logic: string;
  ontologyTermsUsed: string[];
  statutoryCitation: string;
  confidence: number;
}

interface ExtractionResult {
  success: boolean;
  formalRuleId?: string;
  extractedLogic?: string;
  error?: string;
  validationResult?: "valid" | "syntax_error" | "semantic_error";
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}

const EXTRACTION_MODEL = "gemini-2.0-flash";

const Z3_VALIDATION_PATTERNS = {
  validOperators: ["And", "Or", "Not", "Implies", "ForAll", "Exists", "If", "==", "!=", "<", ">", "<=", ">=", "+", "-", "*", "/"],
  validTypes: ["Bool", "Int", "Real", "String"],
  requiredStructure: /^(Implies|And|Or|If|ForAll|Exists|Not|\()/
};

function validateZ3Syntax(z3Logic: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!z3Logic || z3Logic.trim() === "") {
    errors.push("Empty Z3 logic");
    return { valid: false, errors };
  }

  let parenCount = 0;
  for (const char of z3Logic) {
    if (char === "(") parenCount++;
    if (char === ")") parenCount--;
    if (parenCount < 0) {
      errors.push("Unbalanced parentheses: extra closing parenthesis");
      break;
    }
  }
  if (parenCount !== 0) {
    errors.push(`Unbalanced parentheses: ${parenCount > 0 ? "missing closing" : "extra closing"} parentheses`);
  }

  if (!Z3_VALIDATION_PATTERNS.requiredStructure.test(z3Logic.trim())) {
    errors.push("Z3 logic must start with a valid operator (Implies, And, Or, If, ForAll, Exists, Not) or opening parenthesis");
  }

  const hasOperator = Z3_VALIDATION_PATTERNS.validOperators.some(op => z3Logic.includes(op));
  if (!hasOperator) {
    errors.push("Z3 logic must contain at least one valid operator");
  }

  return { valid: errors.length === 0, errors };
}

function buildVanillaPrompt(clauseText: string, domain: string): string {
  return `You are a legal formalization expert. Convert the following statutory clause into Z3 SMT solver logic.

Statutory Clause:
"${clauseText}"

Domain: ${domain}

Output the Z3 logic expression that captures the eligibility rule. Use standard Z3 operators:
- And(a, b) for conjunction
- Or(a, b) for disjunction  
- Not(a) for negation
- Implies(a, b) for implication
- ForAll(vars, expr) for universal quantification
- Comparison operators: ==, !=, <, >, <=, >=

Use descriptive variable names that match the legal concepts (e.g., GrossIncome, HouseholdSize, IsResident).

Output ONLY the Z3 logic expression, nothing else.`;
}

function buildUndirectedPrompt(clauseText: string, domain: string, context: string): string {
  return `You are a legal formalization expert specializing in public benefits eligibility rules.

CONTEXT:
${context}

STATUTORY CLAUSE TO FORMALIZE:
"${clauseText}"

DOMAIN: ${domain}

TASK: Convert this statutory clause into a formal Z3 SMT solver logic expression that can be used for automated eligibility verification.

REQUIREMENTS:
1. Capture ALL conditions mentioned in the clause
2. Use meaningful variable names that reflect legal concepts
3. Handle exceptions and edge cases explicitly
4. Preserve the logical structure of the legal text

Z3 OPERATORS:
- And(a, b, ...) - all conditions must be true
- Or(a, b, ...) - at least one condition must be true
- Not(a) - negation
- Implies(condition, consequence) - if-then relationship
- ForAll([x], expr) - universal quantification
- Exists([x], expr) - existential quantification
- Arithmetic: +, -, *, /, %, <, >, <=, >=, ==, !=

Output ONLY the Z3 logic expression. Do not include explanations or markdown.`;
}

function buildDirectedSymbolicPrompt(
  clauseText: string, 
  domain: string, 
  ontologyTerms: Array<{ termName: string; canonicalName: string; definition: string | null }>
): string {
  const termList = ontologyTerms
    .map(t => `- ${t.canonicalName}: ${t.definition || t.termName}`)
    .join("\n");

  return `You are a legal formalization expert. Convert the statutory clause into Z3 SMT solver logic using ONLY the provided ontology terms.

ONTOLOGY TERMS (use these exact names as variables):
${termList}

STATUTORY CLAUSE:
"${clauseText}"

DOMAIN: ${domain}

FORMALIZATION RULES:
1. Use ONLY the ontology term canonical names as variables
2. Map legal concepts to the closest matching ontology term
3. Preserve all conditions, thresholds, and exceptions
4. Use standard Z3 operators: And, Or, Not, Implies, ForAll, Exists
5. For numeric comparisons, use the appropriate term (e.g., GrossIncome <= IncomeThreshold)

EXAMPLE:
Input: "Gross income must not exceed 200% of the federal poverty level"
Output: Implies(And(HasGrossIncome, GrossIncome_Amount <= FPL_Threshold_200), MeetsIncomeRequirement)

Output ONLY the Z3 logic expression. No explanations or markdown.`;
}

async function extractRuleWithStrategy(
  clauseText: string,
  domain: EligibilityDomain,
  strategy: PromptStrategy,
  stateCode: string,
  programCode: string
): Promise<{ logic: string; prompt: string; ontologyTerms: string[] }> {
  let prompt: string;
  let ontologyTerms: string[] = [];

  switch (strategy) {
    case "vanilla":
      prompt = buildVanillaPrompt(clauseText, domain);
      break;
    
    case "undirected": {
      const context = `This clause is from the ${stateCode} ${programCode} eligibility regulations. ` +
        `The ${domain} domain covers requirements related to ${domain.replace(/_/g, " ")}.`;
      prompt = buildUndirectedPrompt(clauseText, domain, context);
      break;
    }
    
    case "directed_symbolic": {
      const terms = await legalOntologyService.getTermsByProgram(stateCode, programCode);
      const relevantTerms = terms
        .filter(t => t.domain === domain || t.domain === "other")
        .slice(0, 20)
        .map(t => ({
          termName: t.termName,
          canonicalName: t.canonicalName,
          definition: t.definition
        }));
      
      if (relevantTerms.length === 0) {
        const allTerms = terms.slice(0, 15).map(t => ({
          termName: t.termName,
          canonicalName: t.canonicalName,
          definition: t.definition
        }));
        prompt = buildDirectedSymbolicPrompt(clauseText, domain, allTerms);
        ontologyTerms = allTerms.map(t => t.canonicalName);
      } else {
        prompt = buildDirectedSymbolicPrompt(clauseText, domain, relevantTerms);
        ontologyTerms = relevantTerms.map(t => t.canonicalName);
      }
      break;
    }
    
    default:
      throw new Error(`Unknown prompt strategy: ${strategy}`);
  }

  const startTime = Date.now();
  const response = await generateTextWithGemini(prompt);
  const latency = Date.now() - startTime;

  let extractedLogic = response.trim();
  if (extractedLogic.startsWith("```")) {
    extractedLogic = extractedLogic.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
  }

  return { logic: extractedLogic, prompt, ontologyTerms };
}

class RuleExtractionService {
  /**
   * PAPER ALIGNMENT: Direct text-to-Z3 extraction with embedding-based concept retrieval
   * This implements the "directed symbolic" prompting strategy from the paper:
   * 1. Extract concepts from input text using embeddings
   * 2. Retrieve semantically similar ontology terms
   * 3. Build directed prompt with retrieved concepts
   * 4. Generate Z3 logic via Gemini
   */
  async extractRuleFromText(
    statutoryText: string,
    stateCode: string,
    programCode: string,
    domain?: EligibilityDomain,
    statutoryCitation?: string
  ): Promise<{
    success: boolean;
    z3Logic?: string;
    ontologyTermsUsed?: string[];
    validation?: { valid: boolean; errors: string[] };
    formalRuleId?: string;
    error?: string;
  }> {
    try {
      // Step 1: Find semantically similar ontology terms using embeddings
      const similarTerms = await legalOntologyService.findSimilarTerms(
        statutoryText,
        stateCode,
        programCode,
        0.6, // Lower threshold to capture more relevant terms
        25   // Get top 25 similar terms
      );

      // Step 2: Also get domain-specific terms if domain provided
      let domainTerms: typeof similarTerms = [];
      if (domain) {
        const allTerms = await legalOntologyService.getTermsByProgram(stateCode, programCode);
        domainTerms = allTerms
          .filter(t => t.domain === domain)
          .slice(0, 15)
          .map(t => ({ term: t, similarity: 0.8 }));
      }

      // Combine and deduplicate terms
      const termMap = new Map<string, { termName: string; canonicalName: string; definition: string | null }>();
      for (const { term } of [...similarTerms, ...domainTerms]) {
        if (!termMap.has(term.canonicalName)) {
          termMap.set(term.canonicalName, {
            termName: term.termName,
            canonicalName: term.canonicalName,
            definition: term.definition
          });
        }
      }
      const ontologyTermsForPrompt = Array.from(termMap.values()).slice(0, 30);
      
      // Step 3: Determine domain if not provided
      const detectedDomain = domain || this.detectDomain(statutoryText);

      // Step 4: Build directed symbolic prompt with retrieved concepts
      const prompt = buildDirectedSymbolicPrompt(
        statutoryText,
        detectedDomain,
        ontologyTermsForPrompt
      );

      // Step 5: Generate Z3 logic using Gemini
      const startTime = Date.now();
      const response = await generateTextWithGemini(prompt);
      const latencyMs = Date.now() - startTime;

      let extractedLogic = response.trim();
      if (extractedLogic.startsWith("```")) {
        extractedLogic = extractedLogic.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
      }

      // Step 6: Validate Z3 syntax
      const validation = validateZ3Syntax(extractedLogic);
      const ontologyTermsUsed = ontologyTermsForPrompt.map(t => t.canonicalName);

      // Step 7: Store the formal rule if valid
      let formalRuleId: string | undefined;
      if (validation.valid) {
        const [formalRule] = await db.insert(formalRules).values({
          stateCode,
          programCode,
          ruleName: `${programCode}_${detectedDomain}_${Date.now()}`,
          eligibilityDomain: detectedDomain,
          z3Logic: extractedLogic,
          ontologyTermsUsed,
          statutoryCitation: statutoryCitation || `${stateCode} ${programCode} regulations`,
          isValid: true,
          extractionPrompt: prompt,
          extractionModel: EXTRACTION_MODEL,
          promptStrategy: "directed_symbolic",
          extractionConfidence: 0.85,
          status: "pending_review"
        }).returning();
        formalRuleId = formalRule.id;
      }

      // Step 8: Log extraction attempt
      await db.insert(ruleExtractionLogs).values({
        extractionModel: EXTRACTION_MODEL,
        promptStrategy: "directed_symbolic",
        prompt,
        response: extractedLogic,
        extractedLogic,
        isSuccess: validation.valid,
        errorMessage: validation.errors.length > 0 ? validation.errors.join("; ") : null,
        z3ValidationResult: validation.valid ? "valid" : "syntax_error",
        inputTokens: Math.ceil(prompt.length / 4),
        outputTokens: Math.ceil(extractedLogic.length / 4),
        latencyMs
      });

      return {
        success: validation.valid,
        z3Logic: extractedLogic,
        ontologyTermsUsed,
        validation,
        formalRuleId,
        error: validation.errors.length > 0 ? validation.errors.join("; ") : undefined
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Detect eligibility domain from statutory text
   */
  private detectDomain(text: string): EligibilityDomain {
    const textLower = text.toLowerCase();
    
    const domainKeywords: Record<EligibilityDomain, string[]> = {
      income: ["income", "earnings", "salary", "wages", "poverty", "fpl", "gross", "net", "deduction"],
      residency: ["resident", "reside", "living", "domicile", "state of"],
      citizenship: ["citizen", "national", "alien", "immigrant", "immigration", "lawful"],
      resources: ["resource", "asset", "property", "savings", "bank account", "countable"],
      work_requirement: ["work", "employment", "employed", "abawd", "job", "hours per"],
      student_status: ["student", "enrolled", "school", "university", "college", "education"],
      household_composition: ["household", "family", "dependent", "member", "spouse", "child"],
      age: ["age", "years old", "elderly", "minor", "under 18", "over 60"],
      disability: ["disabled", "disability", "incapacitated", "unable to work"],
      other: []
    };

    let bestDomain: EligibilityDomain = "other";
    let maxMatches = 0;

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      const matches = keywords.filter(kw => textLower.includes(kw)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestDomain = domain as EligibilityDomain;
      }
    }

    return bestDomain;
  }

  /**
   * Batch extract rules from multiple statutory clauses
   */
  async batchExtractFromText(
    clauses: Array<{
      text: string;
      citation?: string;
      domain?: EligibilityDomain;
    }>,
    stateCode: string,
    programCode: string
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{
      text: string;
      success: boolean;
      z3Logic?: string;
      error?: string;
    }>;
  }> {
    const results: Array<{
      text: string;
      success: boolean;
      z3Logic?: string;
      error?: string;
    }> = [];

    for (const clause of clauses) {
      const result = await this.extractRuleFromText(
        clause.text,
        stateCode,
        programCode,
        clause.domain,
        clause.citation
      );

      results.push({
        text: clause.text.substring(0, 100) + "...",
        success: result.success,
        z3Logic: result.z3Logic,
        error: result.error
      });

      // Rate limiting between extractions
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      total: clauses.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  async createRuleFragment(
    statutorySourceId: string,
    clauseText: string,
    domain: EligibilityDomain,
    ruleType: RuleType,
    clauseNumber?: number,
    extractedConcepts?: string[]
  ): Promise<RuleFragment> {
    const [fragment] = await db.insert(ruleFragments).values({
      statutorySourceId,
      clauseText,
      clauseNumber,
      extractedConcepts,
      eligibilityDomain: domain,
      ruleType,
      extractionMethod: "manual",
      needsReview: true
    }).returning();

    return fragment;
  }

  async extractAndFormalizeRule(
    ruleFragmentId: string,
    stateCode: string,
    programCode: string,
    strategy: PromptStrategy = "directed_symbolic"
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    const [fragment] = await db.select()
      .from(ruleFragments)
      .where(eq(ruleFragments.id, ruleFragmentId));

    if (!fragment) {
      return { success: false, error: "Rule fragment not found" };
    }

    try {
      const { logic, prompt, ontologyTerms } = await extractRuleWithStrategy(
        fragment.clauseText,
        fragment.eligibilityDomain as EligibilityDomain,
        strategy,
        stateCode,
        programCode
      );

      const validation = validateZ3Syntax(logic);
      const latencyMs = Date.now() - startTime;

      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(logic.length / 4);

      const [formalRule] = await db.insert(formalRules).values({
        ruleFragmentId,
        stateCode,
        programCode,
        ruleName: `${programCode}_${fragment.eligibilityDomain}_${Date.now()}`,
        eligibilityDomain: fragment.eligibilityDomain,
        z3Logic: logic,
        ontologyTermsUsed: ontologyTerms,
        statutoryCitation: `${stateCode} ${programCode} regulations`,
        isValid: validation.valid,
        validationErrors: validation.errors.length > 0 ? validation.errors : null,
        extractionPrompt: prompt,
        extractionModel: EXTRACTION_MODEL,
        promptStrategy: strategy,
        extractionConfidence: validation.valid ? 0.85 : 0.4,
        status: validation.valid ? "pending_review" : "draft"
      }).returning();

      await db.insert(ruleExtractionLogs).values({
        ruleFragmentId,
        formalRuleId: formalRule.id,
        extractionModel: EXTRACTION_MODEL,
        promptStrategy: strategy,
        prompt,
        response: logic,
        extractedLogic: logic,
        isSuccess: validation.valid,
        errorMessage: validation.errors.length > 0 ? validation.errors.join("; ") : null,
        z3ValidationResult: validation.valid ? "valid" : "syntax_error",
        inputTokens,
        outputTokens,
        latencyMs
      });

      if (validation.valid) {
        await db.update(ruleFragments)
          .set({ needsReview: false })
          .where(eq(ruleFragments.id, ruleFragmentId));
      }

      return {
        success: validation.valid,
        formalRuleId: formalRule.id,
        extractedLogic: logic,
        validationResult: validation.valid ? "valid" : "syntax_error",
        inputTokens,
        outputTokens,
        latencyMs,
        error: validation.errors.length > 0 ? validation.errors.join("; ") : undefined
      };

    } catch (error: any) {
      const latencyMs = Date.now() - startTime;

      await db.insert(ruleExtractionLogs).values({
        ruleFragmentId,
        extractionModel: EXTRACTION_MODEL,
        promptStrategy: strategy,
        prompt: `Failed before prompt generation: ${error.message}`,
        response: "",
        isSuccess: false,
        errorMessage: error.message,
        latencyMs
      });

      return {
        success: false,
        error: error.message,
        latencyMs
      };
    }
  }

  async batchExtractRules(
    stateCode: string,
    programCode: string,
    strategy: PromptStrategy = "directed_symbolic",
    limit: number = 10
  ): Promise<{ extracted: number; failed: number; results: ExtractionResult[] }> {
    const fragments = await db.select()
      .from(ruleFragments)
      .innerJoin(statutorySources, eq(ruleFragments.statutorySourceId, statutorySources.id))
      .where(and(
        eq(ruleFragments.needsReview, true),
        isNull(ruleFragments.reviewedBy)
      ))
      .limit(limit);

    const results: ExtractionResult[] = [];
    let extracted = 0;
    let failed = 0;

    for (const { rule_fragments } of fragments) {
      const result = await this.extractAndFormalizeRule(
        rule_fragments.id,
        stateCode,
        programCode,
        strategy
      );
      
      results.push(result);
      if (result.success) {
        extracted++;
      } else {
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { extracted, failed, results };
  }

  async getFormalRule(ruleId: string): Promise<FormalRule | null> {
    const [rule] = await db.select()
      .from(formalRules)
      .where(eq(formalRules.id, ruleId));
    return rule || null;
  }

  async getRulesByProgram(stateCode: string, programCode: string): Promise<FormalRule[]> {
    return db.select()
      .from(formalRules)
      .where(and(
        eq(formalRules.stateCode, stateCode),
        eq(formalRules.programCode, programCode),
        eq(formalRules.isValid, true)
      ))
      .orderBy(desc(formalRules.createdAt));
  }

  async getRulesByDomain(
    stateCode: string, 
    programCode: string, 
    domain: EligibilityDomain
  ): Promise<FormalRule[]> {
    return db.select()
      .from(formalRules)
      .where(and(
        eq(formalRules.stateCode, stateCode),
        eq(formalRules.programCode, programCode),
        eq(formalRules.eligibilityDomain, domain),
        eq(formalRules.isValid, true)
      ))
      .orderBy(desc(formalRules.createdAt));
  }

  async approveRule(ruleId: string, approvedBy: string): Promise<FormalRule | null> {
    const [updated] = await db.update(formalRules)
      .set({
        status: "approved",
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(formalRules.id, ruleId))
      .returning();
    
    return updated || null;
  }

  async deprecateRule(ruleId: string): Promise<FormalRule | null> {
    const [updated] = await db.update(formalRules)
      .set({
        status: "deprecated",
        isValid: false,
        updatedAt: new Date()
      })
      .where(eq(formalRules.id, ruleId))
      .returning();
    
    return updated || null;
  }

  async getExtractionLogs(ruleFragmentId?: string, limit: number = 50): Promise<any[]> {
    let query = db.select().from(ruleExtractionLogs);
    
    if (ruleFragmentId) {
      query = query.where(eq(ruleExtractionLogs.ruleFragmentId, ruleFragmentId)) as any;
    }
    
    return (query as any).orderBy(desc(ruleExtractionLogs.createdAt)).limit(limit);
  }

  async getExtractionStats(): Promise<{
    totalFragments: number;
    totalRules: number;
    validRules: number;
    approvedRules: number;
    byStrategy: Record<string, { total: number; success: number }>;
    byDomain: Record<string, number>;
  }> {
    const [fragmentCount] = await db.select({ count: sql<number>`count(*)` })
      .from(ruleFragments);
    
    const [ruleCount] = await db.select({ count: sql<number>`count(*)` })
      .from(formalRules);
    
    const [validCount] = await db.select({ count: sql<number>`count(*)` })
      .from(formalRules)
      .where(eq(formalRules.isValid, true));
    
    const [approvedCount] = await db.select({ count: sql<number>`count(*)` })
      .from(formalRules)
      .where(eq(formalRules.status, "approved"));

    const strategyStats = await db.select({
      strategy: ruleExtractionLogs.promptStrategy,
      total: sql<number>`count(*)`,
      success: sql<number>`sum(case when is_success then 1 else 0 end)`
    })
      .from(ruleExtractionLogs)
      .groupBy(ruleExtractionLogs.promptStrategy);

    const domainStats = await db.select({
      domain: formalRules.eligibilityDomain,
      count: sql<number>`count(*)`
    })
      .from(formalRules)
      .groupBy(formalRules.eligibilityDomain);

    const byStrategy: Record<string, { total: number; success: number }> = {};
    for (const s of strategyStats) {
      byStrategy[s.strategy] = { total: Number(s.total), success: Number(s.success) };
    }

    const byDomain: Record<string, number> = {};
    for (const d of domainStats) {
      byDomain[d.domain] = Number(d.count);
    }

    return {
      totalFragments: Number(fragmentCount.count),
      totalRules: Number(ruleCount.count),
      validRules: Number(validCount.count),
      approvedRules: Number(approvedCount.count),
      byStrategy,
      byDomain
    };
  }

  async seedMarylandSNAPRules(): Promise<{ fragmentsCreated: number; rulesExtracted: number }> {
    const marylandSNAPRules = [
      {
        clauseText: "A household's gross monthly income must not exceed 200 percent of the Federal Poverty Level (FPL) for the household size.",
        domain: "income" as EligibilityDomain,
        ruleType: "threshold" as RuleType,
        citation: "COMAR 07.03.17.03"
      },
      {
        clauseText: "Net monthly income, after allowable deductions, must not exceed 100 percent of the FPL for the household size.",
        domain: "income" as EligibilityDomain,
        ruleType: "threshold" as RuleType,
        citation: "COMAR 07.03.17.03"
      },
      {
        clauseText: "Countable resources must not exceed $2,750 for most households, or $4,250 for households with a member who is elderly (age 60 or older) or disabled.",
        domain: "resources" as EligibilityDomain,
        ruleType: "threshold" as RuleType,
        citation: "COMAR 07.03.17.04"
      },
      {
        clauseText: "The applicant must be a resident of Maryland at the time of application and intend to continue residing in the state.",
        domain: "residency" as EligibilityDomain,
        ruleType: "requirement" as RuleType,
        citation: "COMAR 07.03.17.02"
      },
      {
        clauseText: "The applicant must be a U.S. citizen, U.S. national, or qualified alien as defined by federal law.",
        domain: "citizenship" as EligibilityDomain,
        ruleType: "requirement" as RuleType,
        citation: "COMAR 07.03.17.02"
      },
      {
        clauseText: "Able-bodied adults without dependents (ABAWDs) aged 18-49 must meet work requirements unless exempt, including working or participating in qualifying activities for at least 80 hours per month.",
        domain: "work_requirement" as EligibilityDomain,
        ruleType: "requirement" as RuleType,
        citation: "COMAR 07.03.17.08"
      },
      {
        clauseText: "Students enrolled at least half-time in an institution of higher education are generally ineligible unless they meet an exemption, such as working at least 20 hours per week or participating in a work-study program.",
        domain: "student_status" as EligibilityDomain,
        ruleType: "exception" as RuleType,
        citation: "COMAR 07.03.17.05"
      },
      {
        clauseText: "An individual caring for a dependent child under age 6 is exempt from ABAWD work requirements.",
        domain: "work_requirement" as EligibilityDomain,
        ruleType: "exception" as RuleType,
        citation: "COMAR 07.03.17.08"
      },
      {
        clauseText: "Earned income deduction: 20 percent of gross earned income is deducted when calculating net income for SNAP eligibility.",
        domain: "income" as EligibilityDomain,
        ruleType: "definition" as RuleType,
        citation: "COMAR 07.03.17.06"
      },
      {
        clauseText: "Shelter deduction: Shelter costs exceeding 50 percent of the household's income after other deductions may be deducted, up to a maximum cap unless an elderly or disabled member is present.",
        domain: "income" as EligibilityDomain,
        ruleType: "definition" as RuleType,
        citation: "COMAR 07.03.17.06"
      }
    ];

    let [source] = await db.select()
      .from(statutorySources)
      .where(eq(statutorySources.title, "COMAR 07.03.17 - Maryland SNAP Regulations"))
      .limit(1);

    if (!source) {
      [source] = await db.insert(statutorySources).values({
        title: "COMAR 07.03.17 - Maryland SNAP Regulations",
        stateCode: "MD",
        sourceType: "regulation",
        programCode: "SNAP",
        citation: "COMAR 07.03.17",
        fullText: "Maryland SNAP (Food Supplement Program) eligibility regulations as codified in the Code of Maryland Regulations (COMAR) Title 07, Subtitle 03, Chapter 17. These regulations govern income limits, resource limits, residency requirements, citizenship requirements, work requirements, student eligibility, and deduction calculations for SNAP benefits in the State of Maryland.",
        sourceUrl: "https://dsd.maryland.gov/regulations/pages/07.03.17.00.aspx",
        effectiveDate: new Date("2024-01-01"),
        isActive: true
      }).returning();
    }

    let fragmentsCreated = 0;
    let rulesExtracted = 0;

    for (let i = 0; i < marylandSNAPRules.length; i++) {
      const rule = marylandSNAPRules[i];
      
      const existing = await db.select()
        .from(ruleFragments)
        .where(and(
          eq(ruleFragments.statutorySourceId, source.id),
          eq(ruleFragments.clauseText, rule.clauseText)
        ))
        .limit(1);

      if (existing.length > 0) continue;

      const fragment = await this.createRuleFragment(
        source.id,
        rule.clauseText,
        rule.domain,
        rule.ruleType,
        i + 1
      );
      fragmentsCreated++;

      const result = await this.extractAndFormalizeRule(
        fragment.id,
        "MD",
        "SNAP",
        "directed_symbolic"
      );

      if (result.success) {
        rulesExtracted++;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { fragmentsCreated, rulesExtracted };
  }
}

export const ruleExtractionService = new RuleExtractionService();
