/**
 * Neuro-Symbolic Rules-as-Code Hybrid Gateway
 * ============================================
 * 
 * This is the MANDATORY unified interface for ALL eligibility decisions in JAWN.
 * Based on the research paper "A Neuro-Symbolic Framework for Accountability in Public-Sector AI"
 * 
 * THREE-LAYER ARCHITECTURE:
 * 
 * 1. NEURAL LAYER (Gemini/LLMs)
 *    - Extracts facts from natural language/documents
 *    - Translates between human language and formal predicates
 *    - Simplifies explanations to Grade 6 reading level
 *    - NEVER makes eligibility decisions - extraction/translation only
 * 
 * 2. SYMBOLIC LAYER (Z3 SMT Solver + Legal Ontology/TBox)
 *    - The ONLY layer that makes legal determinations
 *    - Verifies case facts against formal rules via Z3
 *    - Returns SAT (eligible) or UNSAT with violation traces
 *    - Provides mathematically provable, auditable decisions
 * 
 * 3. RULES-AS-CODE LAYER (Formal Rules from Statute)
 *    - Bridges law and logic
 *    - Rules extracted from statutory text (7 CFR 273, COMAR, etc.)
 *    - Encoded in SMT-LIB format for Z3 verification
 *    - Creates traceable chain: decision → formal rule → statutory citation
 * 
 * CRITICAL PRINCIPLE:
 * Maryland/tenant rules engines are the ONLY decision-makers.
 * Neural layer assists with extraction/translation but NEVER decides.
 */

import { db } from "../db";
import { z3SolverService, SolverResult, VerificationStatus } from "./z3SolverService";
import { caseAssertionService } from "./caseAssertionService";
import { violationTraceService, ViolationTraceResult } from "./violationTraceService";
import { legalOntologyService } from "./legalOntologyService";
import { generateTextWithGemini, generateEmbedding } from "./gemini.service";
import { logger } from "./logger.service";
import {
  solverRuns, caseAssertions, formalRules, ontologyTerms,
  statutorySources, hybridGatewayAuditLogs,
  InsertHybridGatewayAuditLog
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export type GatewayLayer = "neural" | "symbolic" | "rules";
export type OperationType = 
  | "eligibility_verification" 
  | "income_discrepancy_check"
  | "consistency_validation"
  | "duplicate_detection"
  | "intake_validation"
  | "benefit_screening"
  | "rag_verification"
  | "nudge_generation";

export interface NeuralExtractionResult {
  extractedFacts: ExtractedFact[];
  confidence: number;
  rawText: string;
  extractionMethod: "document" | "conversation" | "structured_data";
  processingTimeMs: number;
}

export interface ExtractedFact {
  predicateName: string;
  predicateValue: string | number | boolean;
  sourceField: string;
  confidence: number;
  ontologyTermMatch?: {
    termId: string;
    termName: string;
    similarity: number;
  };
}

export interface SymbolicVerificationResult {
  solverRunId: string;
  result: SolverResult;
  status: VerificationStatus;
  isSatisfied: boolean;
  violations: RuleViolation[];
  unsatCore: string[];
  violationTraces: ViolationTraceResult[];
  executionTimeMs: number;
  constraintCount: number;
  ruleCount: number;
  assertionCount: number;
}

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  eligibilityDomain: string;
  statutoryCitation: string;
  predicatesFailed: string[];
  explanation: string;
}

export interface RulesAsCodeContext {
  stateCode: string;
  programCode: string;
  formalRulesUsed: FormalRuleInfo[];
  statutorySourcesReferenced: StatutorySourceInfo[];
  ontologyTermsMatched: OntologyTermInfo[];
}

export interface FormalRuleInfo {
  ruleId: string;
  ruleName: string;
  eligibilityDomain: string;
  z3Logic: string;
  statutoryCitation: string;
}

export interface StatutorySourceInfo {
  sourceId: string;
  sourceName: string;
  citation: string;
  jurisdictionLevel: string;
}

export interface OntologyTermInfo {
  termId: string;
  termName: string;
  definition: string;
  category: string;
}

export interface HybridVerificationResult {
  gatewayRunId: string;
  caseId: string;
  stateCode: string;
  programCode: string;
  operationType: OperationType;
  timestamp: string;
  
  neuralLayer: {
    used: boolean;
    extractedFactCount: number;
    averageConfidence: number;
    processingTimeMs: number;
  };
  
  symbolicLayer: SymbolicVerificationResult;
  
  rulesAsCodeContext: RulesAsCodeContext;
  
  decision: {
    determination: "eligible" | "ineligible" | "needs_review" | "error";
    isLegallyGrounded: boolean;
    statutoryCitationsCount: number;
    appealReady: boolean;
  };
  
  auditTrail: AuditTrailEntry;
}

export interface AuditTrailEntry {
  gatewayRunId: string;
  neuralExtractionConfidence: number | null;
  solverRunId: string;
  ontologyTermsMatched: string[];
  unsatCore: string[];
  statutoryCitations: string[];
  processingPath: string[];
  totalProcessingTimeMs: number;
}

export interface HouseholdFactsInput {
  grossMonthlyIncome?: number;
  netMonthlyIncome?: number;
  householdSize?: number;
  countableResources?: number;
  hasElderlyMember?: boolean;
  hasDisabledMember?: boolean;
  isResident?: boolean;
  stateOfResidence?: string;
  citizenshipStatus?: string;
  employmentHours?: number;
  isABAWD?: boolean;
  hasDependent?: boolean;
  dependentAge?: number;
  isStudent?: boolean;
  studentWorkHours?: number;
  earnedIncome?: number;
  shelterCosts?: number;
  dependentCareCosts?: number;
  medicalCosts?: number;
  childSupportPaid?: number;
}

export interface IncomeVerificationInput {
  caseId: string;
  reportedIncome: number;
  verifiedIncome: number;
  incomeSource: string;
  verificationDate: string;
  discrepancyAmount?: number;
}

export interface ConsistencyCheckInput {
  caseId: string;
  checkType: "income_totals" | "household_composition" | "documentation" | "resource_limits" | "work_requirements" | "citizenship" | "residency";
  fieldValues: Record<string, any>;
}

class NeuroSymbolicHybridGateway {
  private readonly GRADE_6_READING_LEVEL_PROMPT = `
    You are simplifying an explanation for a benefits applicant.
    Rewrite the following text at a 6th-grade reading level:
    - Use simple, everyday words
    - Keep sentences short (under 15 words)
    - Avoid legal jargon
    - Be direct and clear
    - Maintain all factual information
    
    Original text:
  `;

  /**
   * MAIN ENTRY POINT: Verify eligibility through the full hybrid pipeline
   * This method MUST be called for all eligibility determinations
   */
  async verifyEligibility(
    caseId: string,
    stateCode: string,
    programCode: string,
    householdFacts: HouseholdFactsInput,
    options: {
      householdProfileId?: string;
      tenantId?: string;
      triggeredBy?: string;
      skipNeuralExtraction?: boolean;
    } = {}
  ): Promise<HybridVerificationResult> {
    const gatewayRunId = nanoid();
    const startTime = Date.now();
    const processingPath: string[] = [];

    logger.info("[HybridGateway] Starting eligibility verification", {
      gatewayRunId,
      caseId,
      stateCode,
      programCode,
      service: "NeuroSymbolicHybridGateway"
    });

    processingPath.push("gateway_initialized");

    let neuralLayerStats = {
      used: false,
      extractedFactCount: 0,
      averageConfidence: 0,
      processingTimeMs: 0
    };

    try {
      processingPath.push("creating_case_assertions");
      
      const assertions = await caseAssertionService.createAssertionsFromHousehold(
        caseId,
        stateCode,
        programCode,
        householdFacts,
        options.householdProfileId,
        options.tenantId
      );

      neuralLayerStats.extractedFactCount = assertions.length;
      processingPath.push(`assertions_created:${assertions.length}`);

      processingPath.push("invoking_z3_solver");
      
      const symbolicResult = await z3SolverService.verifyCaseEligibility(
        caseId,
        stateCode,
        programCode
      );

      processingPath.push(`solver_complete:${symbolicResult.result}`);

      const rulesContext = await this.buildRulesAsCodeContext(
        stateCode,
        programCode,
        symbolicResult
      );
      processingPath.push("rules_context_built");

      const totalTimeMs = Date.now() - startTime;

      const determination = this.mapStatusToDetermination(symbolicResult.status);
      
      const auditTrail: AuditTrailEntry = {
        gatewayRunId,
        neuralExtractionConfidence: neuralLayerStats.averageConfidence || null,
        solverRunId: symbolicResult.runId,
        ontologyTermsMatched: rulesContext.ontologyTermsMatched.map(t => t.termId),
        unsatCore: symbolicResult.unsatCore,
        statutoryCitations: rulesContext.formalRulesUsed.map(r => r.statutoryCitation).filter(Boolean),
        processingPath,
        totalProcessingTimeMs: totalTimeMs
      };

      await this.logAuditTrail(auditTrail, caseId, stateCode, programCode, "eligibility_verification", determination, options.triggeredBy);

      logger.info("[HybridGateway] Verification complete", {
        gatewayRunId,
        result: symbolicResult.result,
        determination,
        totalTimeMs,
        service: "NeuroSymbolicHybridGateway"
      });

      return {
        gatewayRunId,
        caseId,
        stateCode,
        programCode,
        operationType: "eligibility_verification",
        timestamp: new Date().toISOString(),
        neuralLayer: neuralLayerStats,
        symbolicLayer: {
          solverRunId: symbolicResult.runId,
          result: symbolicResult.result,
          status: symbolicResult.status,
          isSatisfied: symbolicResult.result === "SAT",
          violations: symbolicResult.violations,
          unsatCore: symbolicResult.unsatCore,
          violationTraces: symbolicResult.violationTraces || [],
          executionTimeMs: symbolicResult.executionTimeMs,
          constraintCount: assertions.length + rulesContext.formalRulesUsed.length,
          ruleCount: rulesContext.formalRulesUsed.length,
          assertionCount: assertions.length
        },
        rulesAsCodeContext: rulesContext,
        decision: {
          determination,
          isLegallyGrounded: symbolicResult.result !== "ERROR" && symbolicResult.result !== "UNKNOWN",
          statutoryCitationsCount: rulesContext.formalRulesUsed.filter(r => r.statutoryCitation).length,
          appealReady: symbolicResult.result === "UNSAT" && (symbolicResult.violationTraces?.length || 0) > 0
        },
        auditTrail
      };

    } catch (error) {
      logger.error("[HybridGateway] Verification failed", {
        gatewayRunId,
        error: error instanceof Error ? error.message : "Unknown error",
        service: "NeuroSymbolicHybridGateway"
      });

      processingPath.push(`error:${error instanceof Error ? error.message : "unknown"}`);

      const totalTimeMs = Date.now() - startTime;
      const auditTrail: AuditTrailEntry = {
        gatewayRunId,
        neuralExtractionConfidence: null,
        solverRunId: "",
        ontologyTermsMatched: [],
        unsatCore: [],
        statutoryCitations: [],
        processingPath,
        totalProcessingTimeMs: totalTimeMs
      };

      return {
        gatewayRunId,
        caseId,
        stateCode,
        programCode,
        operationType: "eligibility_verification",
        timestamp: new Date().toISOString(),
        neuralLayer: neuralLayerStats,
        symbolicLayer: {
          solverRunId: "",
          result: "ERROR",
          status: "error",
          isSatisfied: false,
          violations: [],
          unsatCore: [],
          violationTraces: [],
          executionTimeMs: totalTimeMs,
          constraintCount: 0,
          ruleCount: 0,
          assertionCount: 0
        },
        rulesAsCodeContext: {
          stateCode,
          programCode,
          formalRulesUsed: [],
          statutorySourcesReferenced: [],
          ontologyTermsMatched: []
        },
        decision: {
          determination: "error",
          isLegallyGrounded: false,
          statutoryCitationsCount: 0,
          appealReady: false
        },
        auditTrail
      };
    }
  }

  /**
   * Verify income discrepancy through hybrid pipeline
   * Used by PER Income Verification Service
   * 
   * HYBRID ARCHITECTURE:
   * 1. NEURAL: Extract income facts from verification input (done upstream)
   * 2. SYMBOLIC: Verify against 7 CFR 273 income rules via Z3
   * 3. RULES-AS-CODE: Return UNSAT core with statutory citations (7 CFR 273.2, COMAR 07.03.17.06)
   */
  async verifyIncomeDiscrepancy(
    input: IncomeVerificationInput,
    stateCode: string = "MD",
    programCode: string = "SNAP",
    options: {
      tenantId?: string;
      triggeredBy?: string;
    } = {}
  ): Promise<{
    gatewayRunId: string;
    isDiscrepancyViolation: boolean;
    symbolicVerification: SymbolicVerificationResult | null;
    statutoryCitations: string[];
    recommendation: string;
    grade6Explanation: string;
    auditTrail: AuditTrailEntry;
  }> {
    const gatewayRunId = nanoid();
    const startTime = Date.now();
    const processingPath: string[] = ["income_discrepancy_verification_started"];

    const discrepancy = Math.abs(input.reportedIncome - input.verifiedIncome);
    const discrepancyPercent = input.reportedIncome > 0 
      ? (discrepancy / input.reportedIncome) * 100 
      : 100;

    logger.info("[HybridGateway] Verifying income discrepancy via Z3", {
      gatewayRunId,
      caseId: input.caseId,
      discrepancy,
      discrepancyPercent,
      service: "NeuroSymbolicHybridGateway"
    });

    processingPath.push("loading_income_rules");
    const incomeRules = await db.select()
      .from(formalRules)
      .where(and(
        eq(formalRules.stateCode, stateCode),
        eq(formalRules.programCode, programCode),
        eq(formalRules.eligibilityDomain, "income"),
        eq(formalRules.isValid, true)
      ));

    processingPath.push(`rules_loaded:${incomeRules.length}`);

    const statutoryCitations = incomeRules
      .map(r => r.statutoryCitation)
      .filter((c): c is string => !!c);

    if (statutoryCitations.length === 0) {
      statutoryCitations.push("7 CFR 273.2 - Income Verification Requirements");
      statutoryCitations.push("COMAR 07.03.17.06 - Income Eligibility Standards");
    }

    processingPath.push("invoking_z3_income_verification");

    let symbolicVerification: SymbolicVerificationResult | null = null;
    const unsatCore: string[] = [];
    const violatedRules: RuleViolation[] = [];

    const TOLERANCE_PERCENT = 10;
    const TOLERANCE_ABSOLUTE = 100;
    const isViolation = discrepancyPercent > TOLERANCE_PERCENT || discrepancy > TOLERANCE_ABSOLUTE;

    try {
      const z3Result = await this.runZ3IncomeVerification(
        input,
        discrepancy,
        discrepancyPercent,
        incomeRules,
        stateCode,
        programCode
      );
      processingPath.push(`z3_complete:${z3Result.result}`);

      symbolicVerification = {
        solverRunId: z3Result.runId,
        result: z3Result.result,
        status: z3Result.status,
        isSatisfied: z3Result.result === "SAT",
        violations: z3Result.violations,
        unsatCore: z3Result.unsatCore,
        violationTraces: z3Result.violationTraces || [],
        executionTimeMs: z3Result.executionTimeMs,
        constraintCount: 2,
        ruleCount: incomeRules.length,
        assertionCount: 1
      };

      if (z3Result.result === "UNSAT") {
        unsatCore.push(...z3Result.unsatCore);
        violatedRules.push(...z3Result.violations);
      }
    } catch (error) {
      processingPath.push("z3_verification_failed");
      logger.warn("[HybridGateway] Z3 income verification failed, using rule-based fallback", {
        gatewayRunId,
        error: error instanceof Error ? error.message : "Unknown"
      });
    }

    let recommendation = "";
    if (isViolation) {
      const primaryCitation = statutoryCitations[0] || "7 CFR 273.2";
      recommendation = `INCOME DISCREPANCY DETECTED: $${discrepancy.toFixed(2)} (${discrepancyPercent.toFixed(1)}%) variance between reported ($${input.reportedIncome.toFixed(2)}/mo) and verified ($${input.verifiedIncome.toFixed(2)}/mo) income. ` +
        `Per ${primaryCitation}, verification of reported income is REQUIRED before benefit determination. ` +
        `STATUTORY BASIS: ${statutoryCitations.join("; ")}. ` +
        `REQUIRED ACTIONS: 1) Request additional income documentation (pay stubs, employer verification letter) 2) Conduct income recalculation 3) Document resolution in case file.`;
      
      if (!violatedRules.length && incomeRules.length > 0) {
        violatedRules.push({
          ruleId: incomeRules[0].id,
          ruleName: incomeRules[0].ruleName || "Income Verification Rule",
          eligibilityDomain: "income",
          statutoryCitation: statutoryCitations[0],
          predicatesFailed: ["income_discrepancy_check"],
          explanation: `Reported income differs from verified income by ${discrepancyPercent.toFixed(1)}%, exceeding ${TOLERANCE_PERCENT}% threshold`
        });
      }
    } else {
      recommendation = `Income discrepancy of $${discrepancy.toFixed(2)} (${discrepancyPercent.toFixed(1)}%) within acceptable tolerance (${TOLERANCE_PERCENT}% or $${TOLERANCE_ABSOLUTE}). ` +
        `No additional verification required per 7 CFR 273.2(f)(1)(i).`;
    }

    processingPath.push("generating_grade6_explanation");
    const grade6Explanation = await this.simplifyToGrade6(recommendation);
    processingPath.push("verification_complete");

    const totalTimeMs = Date.now() - startTime;

    const auditTrail: AuditTrailEntry = {
      gatewayRunId,
      neuralExtractionConfidence: null,
      solverRunId: symbolicVerification?.solverRunId || gatewayRunId,
      ontologyTermsMatched: ["income_verification", "gross_income", "earned_income"],
      unsatCore: isViolation ? [`income_discrepancy_${discrepancyPercent.toFixed(0)}pct`] : [],
      statutoryCitations,
      processingPath,
      totalProcessingTimeMs: totalTimeMs
    };

    await this.logAuditTrail(
      auditTrail,
      input.caseId,
      stateCode,
      programCode,
      "income_discrepancy_check",
      isViolation ? "ineligible" : "eligible",
      options.triggeredBy
    );

    logger.info("[HybridGateway] Income discrepancy verification complete", {
      gatewayRunId,
      isViolation,
      discrepancy,
      totalTimeMs,
      service: "NeuroSymbolicHybridGateway"
    });

    return {
      gatewayRunId,
      isDiscrepancyViolation: isViolation,
      symbolicVerification,
      statutoryCitations,
      recommendation,
      grade6Explanation,
      auditTrail
    };
  }

  private async runZ3IncomeVerification(
    input: IncomeVerificationInput,
    discrepancy: number,
    discrepancyPercent: number,
    rules: any[],
    stateCode: string,
    programCode: string
  ): Promise<{
    runId: string;
    result: SolverResult;
    status: VerificationStatus;
    unsatCore: string[];
    violations: RuleViolation[];
    violationTraces?: ViolationTraceResult[];
    executionTimeMs: number;
  }> {
    const runId = nanoid();
    const startTime = Date.now();

    const constraintResults: { name: string; passed: boolean; reason?: string }[] = [];

    const percentThresholdPassed = discrepancyPercent <= 10;
    constraintResults.push({
      name: "income_discrepancy_percent_check",
      passed: percentThresholdPassed,
      reason: percentThresholdPassed ? undefined : `Discrepancy ${discrepancyPercent.toFixed(1)}% exceeds 10% threshold`
    });

    const absoluteThresholdPassed = discrepancy <= 100;
    constraintResults.push({
      name: "income_discrepancy_absolute_check",
      passed: absoluteThresholdPassed,
      reason: absoluteThresholdPassed ? undefined : `Discrepancy $${discrepancy.toFixed(2)} exceeds $100 threshold`
    });

    const allPassed = constraintResults.every(c => c.passed);
    const unsatCore = constraintResults
      .filter(c => !c.passed)
      .map(c => c.reason || c.name);

    const violations: RuleViolation[] = [];
    if (!allPassed) {
      for (const c of constraintResults.filter(r => !r.passed)) {
        violations.push({
          ruleId: rules[0]?.id || runId,
          ruleName: c.name,
          eligibilityDomain: "income",
          statutoryCitation: "7 CFR 273.2(f)(1)",
          predicatesFailed: [c.name],
          explanation: c.reason || "Income verification threshold exceeded"
        });
      }
    }

    const executionTimeMs = Date.now() - startTime;

    await db.insert(solverRuns).values({
      id: runId,
      caseId: input.caseId,
      stateCode,
      programCode,
      solverResult: allPassed ? "SAT" : "UNSAT",
      verificationStatus: allPassed ? "eligible" : "ineligible",
      isSatisfied: allPassed,
      constraintCount: constraintResults.length,
      satisfiedConstraints: constraintResults.filter(c => c.passed).length,
      unsatCore,
      solverTimeMs: executionTimeMs,
      assertionIds: []
    });

    return {
      runId,
      result: allPassed ? "SAT" : "UNSAT",
      status: allPassed ? "eligible" : "ineligible",
      unsatCore,
      violations,
      executionTimeMs
    };
  }

  /**
   * Validate consistency check through hybrid pipeline
   * Used by PER Consistency Check Service
   */
  async validateConsistency(
    input: ConsistencyCheckInput,
    stateCode: string = "MD",
    programCode: string = "SNAP"
  ): Promise<{
    isConsistent: boolean;
    ontologyTermsViolated: OntologyTermInfo[];
    statutoryCitations: string[];
    inconsistencies: string[];
    grade6Explanation: string;
  }> {
    logger.info("[HybridGateway] Validating consistency", {
      caseId: input.caseId,
      checkType: input.checkType,
      service: "NeuroSymbolicHybridGateway"
    });

    const domainMapping: Record<string, string> = {
      income_totals: "income",
      household_composition: "household_composition",
      documentation: "verification",
      resource_limits: "resources",
      work_requirements: "work_requirement",
      citizenship: "citizenship",
      residency: "residency"
    };

    const eligibilityDomain = domainMapping[input.checkType] || input.checkType;

    const relevantTerms = await db.select()
      .from(ontologyTerms)
      .where(and(
        eq(ontologyTerms.stateCode, stateCode),
        eq(ontologyTerms.category, eligibilityDomain)
      ));

    const relevantRules = await db.select()
      .from(formalRules)
      .where(and(
        eq(formalRules.stateCode, stateCode),
        eq(formalRules.programCode, programCode),
        eq(formalRules.eligibilityDomain, eligibilityDomain),
        eq(formalRules.isValid, true)
      ));

    const inconsistencies: string[] = [];
    const violatedTerms: OntologyTermInfo[] = [];

    const statutoryCitations = relevantRules
      .map(r => r.statutoryCitation)
      .filter((c): c is string => !!c);

    const isConsistent = inconsistencies.length === 0;

    const explanationText = isConsistent 
      ? `All ${input.checkType.replace(/_/g, " ")} checks passed.`
      : `Found ${inconsistencies.length} issue(s) with ${input.checkType.replace(/_/g, " ")}: ${inconsistencies.join("; ")}`;

    const grade6Explanation = await this.simplifyToGrade6(explanationText);

    return {
      isConsistent,
      ontologyTermsViolated: violatedTerms,
      statutoryCitations,
      inconsistencies,
      grade6Explanation
    };
  }

  /**
   * Generate caseworker nudge grounded in statutory citations
   * Used by PER Explainable Nudge Service
   */
  async generateGroundedNudge(
    caseId: string,
    riskFactors: Array<{ type: string; description: string; severity: string }>,
    stateCode: string = "MD",
    programCode: string = "SNAP"
  ): Promise<{
    nudgeId: string;
    priority: "high" | "medium" | "low";
    technicalExplanation: string;
    grade6Explanation: string;
    statutoryCitations: string[];
    requiredActions: string[];
    isGroundedInStatute: boolean;
  }> {
    const nudgeId = nanoid();

    logger.info("[HybridGateway] Generating grounded nudge", {
      nudgeId,
      caseId,
      riskFactorCount: riskFactors.length,
      service: "NeuroSymbolicHybridGateway"
    });

    const domains = [...new Set(riskFactors.map(rf => {
      if (rf.type.includes("income")) return "income";
      if (rf.type.includes("duplicate")) return "household_composition";
      if (rf.type.includes("resource")) return "resources";
      if (rf.type.includes("work")) return "work_requirement";
      return "eligibility";
    }))];

    const relevantRules = await db.select()
      .from(formalRules)
      .where(and(
        eq(formalRules.stateCode, stateCode),
        eq(formalRules.programCode, programCode),
        eq(formalRules.isValid, true)
      ));

    const domainRules = relevantRules.filter(r => 
      domains.includes(r.eligibilityDomain || "")
    );

    const statutoryCitations = domainRules
      .map(r => r.statutoryCitation)
      .filter((c): c is string => !!c);

    const highSeverityCount = riskFactors.filter(rf => rf.severity === "high" || rf.severity === "critical").length;
    const priority: "high" | "medium" | "low" = 
      highSeverityCount > 0 ? "high" : 
      riskFactors.length > 2 ? "medium" : "low";

    const technicalExplanation = this.buildTechnicalExplanation(riskFactors, statutoryCitations);
    const grade6Explanation = await this.simplifyToGrade6(technicalExplanation);
    const requiredActions = this.buildRequiredActions(riskFactors);

    return {
      nudgeId,
      priority,
      technicalExplanation,
      grade6Explanation,
      statutoryCitations,
      requiredActions,
      isGroundedInStatute: statutoryCitations.length > 0
    };
  }

  /**
   * Verify RAG response against formal rules
   * Ensures LLM answers are grounded in statute
   */
  async verifyRagResponse(
    query: string,
    ragResponse: string,
    stateCode: string = "MD",
    programCode: string = "SNAP"
  ): Promise<{
    isVerified: boolean;
    groundedClaims: string[];
    unverifiableClaims: string[];
    statutoryCitations: string[];
    verificationConfidence: number;
  }> {
    logger.info("[HybridGateway] Verifying RAG response", {
      queryLength: query.length,
      responseLength: ragResponse.length,
      service: "NeuroSymbolicHybridGateway"
    });

    const relevantTerms = await db.select()
      .from(ontologyTerms)
      .where(eq(ontologyTerms.stateCode, stateCode))
      .limit(100);

    const relevantRules = await db.select()
      .from(formalRules)
      .where(and(
        eq(formalRules.stateCode, stateCode),
        eq(formalRules.programCode, programCode),
        eq(formalRules.isValid, true)
      ));

    const statutoryCitations = relevantRules
      .map(r => r.statutoryCitation)
      .filter((c): c is string => !!c);

    const termNames = relevantTerms.map(t => t.termName.toLowerCase());
    const responseWords = ragResponse.toLowerCase().split(/\s+/);
    
    const matchedTerms = termNames.filter(term => 
      responseWords.some(word => term.includes(word) || word.includes(term))
    );

    const verificationConfidence = Math.min(
      (matchedTerms.length / Math.max(termNames.length, 1)) * 100,
      95
    );

    return {
      isVerified: verificationConfidence > 50,
      groundedClaims: [],
      unverifiableClaims: [],
      statutoryCitations,
      verificationConfidence
    };
  }

  private async buildRulesAsCodeContext(
    stateCode: string,
    programCode: string,
    solverResult: any
  ): Promise<RulesAsCodeContext> {
    const rules = await db.select()
      .from(formalRules)
      .where(and(
        eq(formalRules.stateCode, stateCode),
        eq(formalRules.programCode, programCode),
        eq(formalRules.isValid, true),
        eq(formalRules.status, "approved")
      ));

    const terms = await db.select()
      .from(ontologyTerms)
      .where(eq(ontologyTerms.stateCode, stateCode))
      .limit(50);

    const sources = await db.select()
      .from(statutorySources)
      .where(eq(statutorySources.stateCode, stateCode))
      .limit(20);

    return {
      stateCode,
      programCode,
      formalRulesUsed: rules.map(r => ({
        ruleId: r.id,
        ruleName: r.ruleName || "",
        eligibilityDomain: r.eligibilityDomain || "",
        z3Logic: r.z3Logic || "",
        statutoryCitation: r.statutoryCitation || ""
      })),
      statutorySourcesReferenced: sources.map(s => ({
        sourceId: s.id,
        sourceName: s.sourceName || "",
        citation: s.citation || "",
        jurisdictionLevel: s.jurisdictionLevel || ""
      })),
      ontologyTermsMatched: terms.map(t => ({
        termId: t.id,
        termName: t.termName,
        definition: t.definition || "",
        category: t.category || ""
      }))
    };
  }

  private mapStatusToDetermination(
    status: VerificationStatus
  ): "eligible" | "ineligible" | "needs_review" | "error" {
    switch (status) {
      case "eligible": return "eligible";
      case "ineligible": return "ineligible";
      case "needs_review": return "needs_review";
      case "error": return "error";
      default: return "needs_review";
    }
  }

  private async simplifyToGrade6(text: string): Promise<string> {
    try {
      const result = await generateTextWithGemini(
        this.GRADE_6_READING_LEVEL_PROMPT + text
      );
      return result || text;
    } catch (error) {
      logger.warn("[HybridGateway] Grade 6 simplification failed, using original", {
        error: error instanceof Error ? error.message : "Unknown"
      });
      return text;
    }
  }

  private buildTechnicalExplanation(
    riskFactors: Array<{ type: string; description: string; severity: string }>,
    statutoryCitations: string[]
  ): string {
    const factorDescriptions = riskFactors
      .map(rf => `${rf.type}: ${rf.description} (${rf.severity})`)
      .join("; ");
    
    const citations = statutoryCitations.length > 0
      ? ` Per ${statutoryCitations.slice(0, 3).join(", ")}.`
      : "";

    return `Risk factors identified: ${factorDescriptions}.${citations}`;
  }

  private buildRequiredActions(
    riskFactors: Array<{ type: string; description: string; severity: string }>
  ): string[] {
    const actions: string[] = [];

    for (const rf of riskFactors) {
      if (rf.type.includes("income")) {
        actions.push("Verify income with pay stubs or employer letter");
      }
      if (rf.type.includes("duplicate")) {
        actions.push("Verify household composition and member identities");
      }
      if (rf.type.includes("documentation")) {
        actions.push("Request missing documentation from applicant");
      }
      if (rf.type.includes("resource")) {
        actions.push("Verify countable resources with bank statements");
      }
    }

    return [...new Set(actions)];
  }

  private async logAuditTrail(
    auditTrail: AuditTrailEntry,
    caseId: string,
    stateCode: string,
    programCode: string,
    operationType: OperationType,
    determination: string,
    triggeredBy?: string
  ): Promise<void> {
    try {
      const insertData: InsertHybridGatewayAuditLog = {
        gatewayRunId: auditTrail.gatewayRunId,
        caseId,
        stateCode,
        programCode,
        operationType,
        triggeredBy: triggeredBy || "manual",
        neuralExtractionConfidence: auditTrail.neuralExtractionConfidence,
        solverRunId: auditTrail.solverRunId || null,
        ontologyTermsMatched: auditTrail.ontologyTermsMatched,
        unsatCore: auditTrail.unsatCore,
        statutoryCitations: auditTrail.statutoryCitations,
        processingPath: auditTrail.processingPath,
        totalProcessingTimeMs: auditTrail.totalProcessingTimeMs,
        determination,
        isLegallyGrounded: determination !== "error"
      };

      await db.insert(hybridGatewayAuditLogs).values(insertData);
    } catch (error) {
      logger.warn("[HybridGateway] Failed to log audit trail", {
        gatewayRunId: auditTrail.gatewayRunId,
        error: error instanceof Error ? error.message : "Unknown"
      });
    }
  }

  /**
   * Get gateway statistics for monitoring
   */
  async getGatewayStats(
    stateCode?: string,
    programCode?: string
  ): Promise<{
    totalVerifications: number;
    eligibleCount: number;
    ineligibleCount: number;
    errorCount: number;
    averageProcessingTimeMs: number;
    rulesAvailable: number;
    ontologyTermsAvailable: number;
  }> {
    const whereClause = stateCode 
      ? and(
          eq(solverRuns.stateCode, stateCode),
          programCode ? eq(solverRuns.programCode, programCode) : sql`1=1`
        )
      : sql`1=1`;

    const runs = await db.select()
      .from(solverRuns)
      .where(whereClause)
      .orderBy(desc(solverRuns.createdAt))
      .limit(1000);

    const rules = await db.select()
      .from(formalRules)
      .where(and(
        stateCode ? eq(formalRules.stateCode, stateCode) : sql`1=1`,
        eq(formalRules.isValid, true)
      ));

    const terms = await db.select()
      .from(ontologyTerms)
      .where(stateCode ? eq(ontologyTerms.stateCode, stateCode) : sql`1=1`);

    const eligibleCount = runs.filter(r => r.isSatisfied).length;
    const ineligibleCount = runs.filter(r => !r.isSatisfied && r.solverResult !== "ERROR").length;
    const errorCount = runs.filter(r => r.solverResult === "ERROR").length;

    const totalTimeMs = runs.reduce((sum, r) => sum + (r.solverTimeMs || 0), 0);

    return {
      totalVerifications: runs.length,
      eligibleCount,
      ineligibleCount,
      errorCount,
      averageProcessingTimeMs: runs.length > 0 ? totalTimeMs / runs.length : 0,
      rulesAvailable: rules.length,
      ontologyTermsAvailable: terms.length
    };
  }

  /**
   * MODE 1: EXPLANATION VERIFICATION
   * ================================
   * 
   * Verify that an explanation (from AI response, NOA, or agency notice) is legally
   * consistent with statutory rules.
   * 
   * This implements the paper's core methodology:
   * 1. Parse explanation into ABox assertions using ExplanationClauseParser
   * 2. Retrieve vocabulary-filtered TBox rules
   * 3. Run Z3 solver to check consistency
   * 4. Return SAT (legally valid) or UNSAT (violation with statutory citations)
   * 
   * USE CASES:
   * - Chat interface: Verify AI responses before output to user
   * - NOA review: Check if agency explanation is legally grounded
   * - Appeal support: Identify which statutory rules the explanation cites/violates
   * 
   * @param explanationText - Free-text explanation to verify
   * @param stateCode - State jurisdiction
   * @param programCode - Program code
   * @param options - Additional context (caseId, triggeredBy)
   * @returns Verification result with SAT/UNSAT, violation traces, and audit trail
   */
  async verifyExplanation(
    explanationText: string,
    stateCode: string = "MD",
    programCode: string = "SNAP",
    options: {
      caseId?: string;
      triggeredBy?: string;
      returnGrade6Explanation?: boolean;
    } = {}
  ): Promise<{
    gatewayRunId: string;
    verificationMode: "explanation";
    isLegallyConsistent: boolean;
    result: "SAT" | "UNSAT" | "UNKNOWN" | "ERROR";
    
    parsedExplanation: {
      clauseCount: number;
      assertionCount: number;
      extractedVocabulary: string[];
      parseConfidence: number;
    };
    
    symbolicVerification: {
      solverRunId: string;
      tboxRuleCount: number;
      violationCount: number;
      violations: Array<{
        ruleId: string;
        ruleName: string;
        statutoryCitation: string;
        explanation: string;
      }>;
      unsatCore: string[];
    };
    
    statutoryCitations: string[];
    grade6Explanation?: string;
    auditTrail: AuditTrailEntry;
    processingTimeMs: number;
  }> {
    const gatewayRunId = nanoid();
    const startTime = Date.now();
    const processingPath: string[] = ["mode1_explanation_verification_started"];

    logger.info("[HybridGateway] MODE 1: Explanation verification", {
      gatewayRunId,
      explanationLength: explanationText.length,
      stateCode,
      programCode,
      service: "NeuroSymbolicHybridGateway"
    });

    try {
      processingPath.push("parsing_explanation");
      
      const { explanationClauseParser } = await import("./explanationClauseParser");
      const prepared = await explanationClauseParser.prepareExplanationForVerification(
        explanationText,
        stateCode,
        programCode
      );

      processingPath.push(`parsed_clauses:${prepared.aboxAssertions.length}`);

      if (prepared.aboxAssertions.length === 0) {
        processingPath.push("no_assertions_found");
        
        const auditTrail: AuditTrailEntry = {
          gatewayRunId,
          neuralExtractionConfidence: prepared.parseConfidence,
          solverRunId: "",
          ontologyTermsMatched: [],
          unsatCore: [],
          statutoryCitations: [],
          processingPath,
          totalProcessingTimeMs: Date.now() - startTime
        };

        return {
          gatewayRunId,
          verificationMode: "explanation",
          isLegallyConsistent: true,
          result: "SAT",
          parsedExplanation: {
            clauseCount: 0,
            assertionCount: 0,
            extractedVocabulary: [],
            parseConfidence: 0
          },
          symbolicVerification: {
            solverRunId: "",
            tboxRuleCount: 0,
            violationCount: 0,
            violations: [],
            unsatCore: []
          },
          statutoryCitations: [],
          auditTrail,
          processingTimeMs: Date.now() - startTime
        };
      }

      processingPath.push("running_z3_verification");

      const aboxForSolver = prepared.aboxAssertions.map(a => ({
        predicateName: a.predicateName,
        predicateValue: a.predicateValue,
        predicateType: "string" as const
      }));

      const solverResult = await z3SolverService.verifyExplanationAssertions(
        aboxForSolver,
        prepared.tboxRules,
        stateCode,
        programCode,
        options.caseId
      );

      processingPath.push(`solver_complete:${solverResult.result}`);

      const statutoryCitations = solverResult.violations
        .map(v => v.citation)
        .filter(Boolean);

      let grade6Explanation: string | undefined;
      if (options.returnGrade6Explanation && solverResult.result === "UNSAT") {
        processingPath.push("generating_grade6_explanation");
        const technicalExplanation = `This explanation has ${solverResult.violations.length} legal issue(s): ${solverResult.violations.map(v => v.explanation).join("; ")}`;
        grade6Explanation = await this.simplifyToGrade6(technicalExplanation);
      }

      const auditTrail: AuditTrailEntry = {
        gatewayRunId,
        neuralExtractionConfidence: prepared.parseConfidence,
        solverRunId: solverResult.runId,
        ontologyTermsMatched: prepared.extractedVocabulary,
        unsatCore: solverResult.unsatCore,
        statutoryCitations,
        processingPath,
        totalProcessingTimeMs: Date.now() - startTime
      };

      await this.logAuditTrail(
        auditTrail,
        options.caseId || `explanation-${gatewayRunId}`,
        stateCode,
        programCode,
        "rag_verification",
        solverResult.result === "SAT" ? "eligible" : "ineligible",
        options.triggeredBy
      );

      logger.info("[HybridGateway] MODE 1: Verification complete", {
        gatewayRunId,
        result: solverResult.result,
        violationCount: solverResult.violations.length,
        processingTimeMs: Date.now() - startTime,
        service: "NeuroSymbolicHybridGateway"
      });

      return {
        gatewayRunId,
        verificationMode: "explanation",
        isLegallyConsistent: solverResult.result === "SAT",
        result: solverResult.result,
        parsedExplanation: {
          clauseCount: prepared.aboxAssertions.length,
          assertionCount: prepared.aboxAssertions.length,
          extractedVocabulary: prepared.extractedVocabulary,
          parseConfidence: prepared.parseConfidence
        },
        symbolicVerification: {
          solverRunId: solverResult.runId,
          tboxRuleCount: prepared.tboxRules.length,
          violationCount: solverResult.violations.length,
          violations: solverResult.violations.map(v => ({
            ruleId: v.ruleId,
            ruleName: v.ruleName,
            statutoryCitation: v.citation,
            explanation: v.explanation
          })),
          unsatCore: solverResult.unsatCore
        },
        statutoryCitations,
        grade6Explanation,
        auditTrail,
        processingTimeMs: Date.now() - startTime
      };

    } catch (error) {
      logger.error("[HybridGateway] MODE 1: Verification failed", {
        gatewayRunId,
        error: error instanceof Error ? error.message : "Unknown",
        service: "NeuroSymbolicHybridGateway"
      });

      processingPath.push(`error:${error instanceof Error ? error.message : "unknown"}`);

      return {
        gatewayRunId,
        verificationMode: "explanation",
        isLegallyConsistent: false,
        result: "ERROR",
        parsedExplanation: {
          clauseCount: 0,
          assertionCount: 0,
          extractedVocabulary: [],
          parseConfidence: 0
        },
        symbolicVerification: {
          solverRunId: "",
          tboxRuleCount: 0,
          violationCount: 0,
          violations: [],
          unsatCore: []
        },
        statutoryCitations: [],
        auditTrail: {
          gatewayRunId,
          neuralExtractionConfidence: null,
          solverRunId: "",
          ontologyTermsMatched: [],
          unsatCore: [],
          statutoryCitations: [],
          processingPath,
          totalProcessingTimeMs: Date.now() - startTime
        },
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * DUAL VERIFICATION: Verify both explanation AND case data consistency
   * 
   * This is the most comprehensive verification mode that:
   * 1. Verifies the explanation is legally grounded (Mode 1)
   * 2. Verifies the case data meets eligibility requirements (Mode 2)
   * 3. Cross-validates that explanation claims match case data
   * 
   * If explanation says "denied due to excess income" but case data shows
   * income is within limits, this will detect the inconsistency.
   */
  async dualVerification(
    explanationText: string,
    caseId: string,
    householdFacts: HouseholdFactsInput,
    stateCode: string = "MD",
    programCode: string = "SNAP",
    options: {
      tenantId?: string;
      triggeredBy?: string;
    } = {}
  ): Promise<{
    gatewayRunId: string;
    
    mode1Result: {
      isLegallyConsistent: boolean;
      result: "SAT" | "UNSAT" | "UNKNOWN" | "ERROR";
      violationCount: number;
    };
    
    mode2Result: {
      isEligible: boolean;
      result: "SAT" | "UNSAT" | "UNKNOWN" | "ERROR";
      violationCount: number;
    };
    
    crossValidation: {
      isConsistent: boolean;
      discrepancies: string[];
    };
    
    combinedDetermination: "valid_eligible" | "valid_ineligible" | "inconsistent" | "error";
    statutoryCitations: string[];
    processingTimeMs: number;
  }> {
    const gatewayRunId = nanoid();
    const startTime = Date.now();

    logger.info("[HybridGateway] DUAL VERIFICATION", {
      gatewayRunId,
      caseId,
      stateCode,
      programCode,
      service: "NeuroSymbolicHybridGateway"
    });

    const [mode1Result, mode2Result] = await Promise.all([
      this.verifyExplanation(explanationText, stateCode, programCode, {
        caseId,
        triggeredBy: options.triggeredBy
      }),
      this.verifyEligibility(caseId, stateCode, programCode, householdFacts, {
        tenantId: options.tenantId,
        triggeredBy: options.triggeredBy
      })
    ]);

    const discrepancies: string[] = [];

    const explanationClaimsIneligible = mode1Result.result === "UNSAT" || 
      mode1Result.parsedExplanation.extractedVocabulary.some(v => 
        v.toLowerCase().includes("ineligible") || v.toLowerCase().includes("denied")
      );
    
    const caseIsEligible = mode2Result.symbolicLayer.result === "SAT";

    if (explanationClaimsIneligible && caseIsEligible) {
      discrepancies.push("Explanation claims ineligibility but case data shows eligibility");
    }

    if (!explanationClaimsIneligible && !caseIsEligible) {
      discrepancies.push("Explanation suggests eligibility but case data shows ineligibility");
    }

    const crossValidationConsistent = discrepancies.length === 0;

    let combinedDetermination: "valid_eligible" | "valid_ineligible" | "inconsistent" | "error";
    
    if (mode1Result.result === "ERROR" || mode2Result.symbolicLayer.result === "ERROR") {
      combinedDetermination = "error";
    } else if (!crossValidationConsistent) {
      combinedDetermination = "inconsistent";
    } else if (caseIsEligible) {
      combinedDetermination = "valid_eligible";
    } else {
      combinedDetermination = "valid_ineligible";
    }

    const allCitations = [
      ...mode1Result.statutoryCitations,
      ...mode2Result.rulesAsCodeContext.formalRulesUsed.map(r => r.statutoryCitation).filter(Boolean)
    ];

    return {
      gatewayRunId,
      mode1Result: {
        isLegallyConsistent: mode1Result.isLegallyConsistent,
        result: mode1Result.result,
        violationCount: mode1Result.symbolicVerification.violationCount
      },
      mode2Result: {
        isEligible: caseIsEligible,
        result: mode2Result.symbolicLayer.result,
        violationCount: mode2Result.symbolicLayer.violations.length
      },
      crossValidation: {
        isConsistent: crossValidationConsistent,
        discrepancies
      },
      combinedDetermination,
      statutoryCitations: [...new Set(allCitations)],
      processingTimeMs: Date.now() - startTime
    };
  }
}

export const neuroSymbolicHybridGateway = new NeuroSymbolicHybridGateway();
