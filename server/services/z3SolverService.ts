import { db } from "../db";
import {
  solverRuns, caseAssertions, formalRules, ruleFragments,
  InsertSolverRun, SolverRun
} from "@shared/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { caseAssertionService } from "./caseAssertionService";
import { init as initZ3 } from "z3-solver";
import { violationTraceService, ViolationTraceResult } from "./violationTraceService";

export type SolverResult = "SAT" | "UNSAT" | "UNKNOWN" | "ERROR";
export type VerificationStatus = "eligible" | "ineligible" | "needs_review" | "error";

let z3Instance: Awaited<ReturnType<typeof initZ3>> | null = null;

async function getZ3(): Promise<Awaited<ReturnType<typeof initZ3>>> {
  if (!z3Instance) {
    z3Instance = await initZ3();
  }
  return z3Instance;
}

interface RuleViolation {
  ruleId: string;
  ruleName: string;
  citation: string;
  predicatesFailed: string[];
  explanation: string;
}

interface SolverRunResult {
  runId: string;
  caseId: string;
  programCode: string;
  result: SolverResult;
  status: VerificationStatus;
  violations: RuleViolation[];
  unsatCore: string[];
  solverOutput: string;
  executionTimeMs: number;
  violationTraces?: ViolationTraceResult[];
}

class Z3SolverService {
  async verifyCaseEligibility(
    caseId: string,
    stateCode: string,
    programCode: string
  ): Promise<SolverRunResult> {
    const startTime = Date.now();

    const assertions = await caseAssertionService.getAssertionsForProgram(
      caseId,
      stateCode,
      programCode
    );

    const rules = await db.select()
      .from(formalRules)
      .where(and(
        eq(formalRules.stateCode, stateCode),
        eq(formalRules.programCode, programCode),
        eq(formalRules.isValid, true),
        eq(formalRules.status, "approved")
      ));

    if (assertions.length === 0) {
      return this.createErrorResult(caseId, programCode, "No assertions found for case", startTime);
    }

    if (rules.length === 0) {
      return this.createErrorResult(caseId, programCode, "No approved rules found for program", startTime);
    }

    const z3Program = this.buildZ3Program(assertions, rules);
    const { result, unsatCore, output, violations } = await this.executeSolverCheck(
      assertions,
      rules,
      z3Program
    );

    const executionTimeMs = Date.now() - startTime;
    const status = this.determineStatus(result, violations);

    const [solverRun] = await db.insert(solverRuns).values({
      caseId,
      stateCode,
      programCode,
      solverResult: result,
      isSatisfied: result === "SAT",
      tboxRuleIds: rules.map(r => r.id),
      aboxAssertionIds: assertions.map(a => a.id),
      unsatCore: unsatCore.length > 0 ? unsatCore : null,
      violatedRuleIds: violations.map(v => v.ruleId),
      violatedCitations: violations.map(v => v.citation),
      solverTimeMs: executionTimeMs,
      constraintCount: assertions.length + rules.length,
      variableCount: assertions.length,
      triggeredBy: "eligibility_calculation",
      solverTrace: { output, violations, status }
    }).returning();

    let violationTraces: ViolationTraceResult[] = [];
    if (result === "UNSAT" && violations.length > 0) {
      try {
        violationTraces = await violationTraceService.generateViolationTraces(solverRun.id);
        console.log(`[Z3Solver] Generated ${violationTraces.length} violation traces for run ${solverRun.id}`);
      } catch (traceError) {
        console.warn("[Z3Solver] Failed to generate violation traces:", traceError);
      }
    }

    return {
      runId: solverRun.id,
      caseId,
      programCode,
      result,
      status,
      violations,
      unsatCore,
      solverOutput: output,
      executionTimeMs,
      violationTraces
    };
  }

  private buildZ3Program(
    assertions: typeof caseAssertions.$inferSelect[],
    rules: typeof formalRules.$inferSelect[]
  ): string {
    const lines: string[] = [
      "; Z3 SMT-LIB Program for Eligibility Verification",
      `; Generated: ${new Date().toISOString()}`,
      "; ================================================",
      "",
      "; Variable Declarations",
    ];

    const declaredVars = new Map<string, string>();

    for (const assertion of assertions) {
      const varName = assertion.predicateName.charAt(0).toLowerCase() + assertion.predicateName.slice(1);
      if (!declaredVars.has(varName)) {
        const type = this.inferZ3Type(assertion.predicateValue);
        lines.push(`(declare-const ${varName} ${type})`);
        declaredVars.set(varName, type);
      }
    }

    lines.push("");
    lines.push("; Case Facts (ABox Assertions)");
    
    for (const assertion of assertions) {
      if (assertion.z3Assertion) {
        lines.push(`(assert ${assertion.z3Assertion}) ; ${assertion.predicateName}`);
      }
    }

    lines.push("");
    lines.push("; Eligibility Rules (Formal Logic)");
    
    for (const rule of rules) {
      if (rule.z3Logic) {
        const fragmentInfo = rule.ruleFragmentId ? ` (fragment: ${rule.ruleFragmentId})` : "";
        lines.push(`; Rule: ${rule.id}${fragmentInfo}`);
        lines.push(`; Domain: ${rule.eligibilityDomain}, Type: ${rule.ruleType}`);
        lines.push(`(assert ${rule.z3Logic})`);
        lines.push("");
      }
    }

    lines.push("");
    lines.push("; Check satisfiability");
    lines.push("(check-sat)");
    lines.push("(get-model)");

    return lines.join("\n");
  }

  private async executeSolverCheck(
    assertions: typeof caseAssertions.$inferSelect[],
    rules: typeof formalRules.$inferSelect[],
    z3Program: string
  ): Promise<{
    result: SolverResult;
    unsatCore: string[];
    output: string;
    violations: RuleViolation[];
  }> {
    try {
      const z3Result = await this.runRealZ3Solver(assertions, rules);
      return z3Result;
    } catch (error) {
      console.error("[Z3Solver] Real solver failed, using rule-based verification:", error);
      return this.runRuleBasedVerification(assertions, rules);
    }
  }

  private async runRealZ3Solver(
    assertions: typeof caseAssertions.$inferSelect[],
    rules: typeof formalRules.$inferSelect[]
  ): Promise<{
    result: SolverResult;
    unsatCore: string[];
    output: string;
    violations: RuleViolation[];
  }> {
    const { Context } = await getZ3();
    const ctx = Context("main");
    const solver = new ctx.Solver();

    const outputLines: string[] = [
      "; Z3 Real Solver Execution (Neuro-Symbolic Verification)",
      `; Timestamp: ${new Date().toISOString()}`,
      `; Rules: ${rules.length}, Assertions: ${assertions.length}`,
      ""
    ];

    const vars = new Map<string, any>();
    const ruleConstraints = new Map<string, { rule: typeof rules[0]; constraint: any }>();

    for (const assertion of assertions) {
      const varName = assertion.predicateName.charAt(0).toLowerCase() + assertion.predicateName.slice(1);
      
      if (!vars.has(varName)) {
        const z3Type = this.inferZ3Type(assertion.predicateValue);
        let z3Var: any;
        
        if (z3Type === "Int") {
          z3Var = ctx.Int.const(varName);
        } else if (z3Type === "Real") {
          z3Var = ctx.Real.const(varName);
        } else if (z3Type === "Bool") {
          z3Var = ctx.Bool.const(varName);
        } else {
          z3Var = ctx.Int.const(varName);
        }
        
        vars.set(varName, z3Var);
        outputLines.push(`(declare-const ${varName} ${z3Type})`);
      }
    }

    outputLines.push("");
    outputLines.push("; Case Facts (ABox Assertions)");

    for (const assertion of assertions) {
      const varName = assertion.predicateName.charAt(0).toLowerCase() + assertion.predicateName.slice(1);
      const z3Var = vars.get(varName);
      
      if (!z3Var || !assertion.predicateValue) continue;

      try {
        const z3Type = this.inferZ3Type(assertion.predicateValue);
        
        if (z3Type === "Bool") {
          const boolVal = assertion.predicateValue === "true";
          solver.add(boolVal ? z3Var : ctx.Not(z3Var));
          outputLines.push(`(assert ${boolVal ? varName : `(not ${varName})`})`);
        } else if (z3Type === "Int" || z3Type === "Real") {
          const numVal = parseFloat(assertion.predicateValue);
          if (!isNaN(numVal)) {
            const z3Val = z3Type === "Int" ? ctx.Int.val(Math.floor(numVal)) : ctx.Real.val(numVal);
            solver.add(z3Var.eq(z3Val));
            outputLines.push(`(assert (= ${varName} ${numVal}))`);
          }
        }
      } catch (e) {
        console.warn(`[Z3Solver] Failed to add assertion for ${varName}:`, e);
      }
    }

    outputLines.push("");
    outputLines.push("; Formal Rules (TBox Eligibility Constraints)");

    for (const rule of rules) {
      if (!rule.z3Logic) continue;
      
      try {
        const ruleConstraint = this.buildRuleConstraint(ctx, vars, rule);
        if (ruleConstraint) {
          solver.add(ruleConstraint);
          ruleConstraints.set(rule.id, { rule, constraint: ruleConstraint });
          outputLines.push(`; Rule: ${rule.ruleName} (${rule.id})`);
          outputLines.push(`(assert ${rule.z3Logic})`);
        }
      } catch (e) {
        console.warn(`[Z3Solver] Failed to add rule constraint for ${rule.ruleName}:`, e);
        outputLines.push(`; SKIPPED Rule: ${rule.ruleName} - parse error`);
      }
    }

    outputLines.push("");
    outputLines.push("; Check Satisfiability");
    
    const checkResult = await solver.check();
    const result: SolverResult = checkResult === "sat" ? "SAT" : 
                                  checkResult === "unsat" ? "UNSAT" : "UNKNOWN";
    
    outputLines.push(`; Result: ${result}`);

    const violations: RuleViolation[] = [];
    const unsatCore: string[] = [];

    if (result === "SAT") {
      outputLines.push("; All constraints satisfiable - case meets eligibility requirements");
    } else if (result === "UNSAT") {
      outputLines.push("; Constraints unsatisfiable - eligibility requirements not met");
      outputLines.push("");
      outputLines.push("; Identifying violated rules...");

      for (const [ruleId, { rule, constraint }] of ruleConstraints.entries()) {
        const testSolver = new ctx.Solver();
        
        for (const assertion of assertions) {
          const varName = assertion.predicateName.charAt(0).toLowerCase() + assertion.predicateName.slice(1);
          const z3Var = vars.get(varName);
          if (!z3Var || !assertion.predicateValue) continue;

          const z3Type = this.inferZ3Type(assertion.predicateValue);
          if (z3Type === "Bool") {
            const boolVal = assertion.predicateValue === "true";
            testSolver.add(boolVal ? z3Var : ctx.Not(z3Var));
          } else if (z3Type === "Int" || z3Type === "Real") {
            const numVal = parseFloat(assertion.predicateValue);
            if (!isNaN(numVal)) {
              const z3Val = z3Type === "Int" ? ctx.Int.val(Math.floor(numVal)) : ctx.Real.val(numVal);
              testSolver.add(z3Var.eq(z3Val));
            }
          }
        }

        testSolver.add(constraint);
        const ruleCheck = await testSolver.check();

        if (ruleCheck === "unsat") {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.ruleName,
            citation: rule.statutoryCitation,
            predicatesFailed: [],
            explanation: `Rule '${rule.ruleName}' not satisfied: ${rule.z3Logic}`
          });
          unsatCore.push(rule.id);
          outputLines.push(`; VIOLATED: ${rule.ruleName} (${rule.statutoryCitation})`);
        }
      }
    }

    return {
      result,
      unsatCore,
      output: outputLines.join("\n"),
      violations
    };
  }

  private buildRuleConstraint(
    ctx: any,
    vars: Map<string, any>,
    rule: typeof formalRules.$inferSelect
  ): any | null {
    if (!rule.z3Logic) return null;

    const z3Logic = rule.z3Logic;
    
    try {
      const lessThanMatch = z3Logic.match(/\(assert\s+\(<=?\s+(\w+)\s+(\d+)\)\)/i);
      if (lessThanMatch) {
        const varName = lessThanMatch[1].charAt(0).toLowerCase() + lessThanMatch[1].slice(1);
        const threshold = parseInt(lessThanMatch[2], 10);
        
        if (vars.has(varName) && !isNaN(threshold)) {
          const z3Var = vars.get(varName);
          return z3Logic.includes("<=") 
            ? z3Var.le(ctx.Int.val(threshold))
            : z3Var.lt(ctx.Int.val(threshold));
        }
        
        const z3Var = ctx.Int.const(varName);
        vars.set(varName, z3Var);
        return z3Logic.includes("<=")
          ? z3Var.le(ctx.Int.val(threshold))
          : z3Var.lt(ctx.Int.val(threshold));
      }

      const equalsBoolMatch = z3Logic.match(/\(assert\s+\(=\s+(\w+)\s+(true|false)\)\)/i);
      if (equalsBoolMatch) {
        const varName = equalsBoolMatch[1].charAt(0).toLowerCase() + equalsBoolMatch[1].slice(1);
        const boolVal = equalsBoolMatch[2].toLowerCase() === "true";
        
        let z3Var = vars.get(varName);
        if (!z3Var) {
          z3Var = ctx.Bool.const(varName);
          vars.set(varName, z3Var);
        }
        
        return boolVal ? z3Var : ctx.Not(z3Var);
      }

      const equalsNumMatch = z3Logic.match(/\(assert\s+\(=\s+(\w+)\s+(\d+)\)\)/i);
      if (equalsNumMatch) {
        const varName = equalsNumMatch[1].charAt(0).toLowerCase() + equalsNumMatch[1].slice(1);
        const numVal = parseInt(equalsNumMatch[2], 10);
        
        let z3Var = vars.get(varName);
        if (!z3Var) {
          z3Var = ctx.Int.const(varName);
          vars.set(varName, z3Var);
        }
        
        return z3Var.eq(ctx.Int.val(numVal));
      }

      const multiplyMatch = z3Logic.match(/\(assert\s+\(<=?\s+(\w+)\s+\(\*\s+([\d.]+)\s+(\w+)\)\)\)/i);
      if (multiplyMatch) {
        const varName = multiplyMatch[1].charAt(0).toLowerCase() + multiplyMatch[1].slice(1);
        const multiplier = parseFloat(multiplyMatch[2]);
        const baseVarName = multiplyMatch[3].charAt(0).toLowerCase() + multiplyMatch[3].slice(1);
        
        let z3Var = vars.get(varName);
        if (!z3Var) {
          z3Var = ctx.Int.const(varName);
          vars.set(varName, z3Var);
        }
        
        let baseVar = vars.get(baseVarName);
        if (!baseVar) {
          baseVar = ctx.Int.const(baseVarName);
          vars.set(baseVarName, baseVar);
        }
        
        const thresholdExpr = ctx.ToInt(ctx.Real.val(multiplier).mul(ctx.ToReal(baseVar)));
        return z3Logic.includes("<=") 
          ? z3Var.le(thresholdExpr) 
          : z3Var.lt(thresholdExpr);
      }

      console.log(`[Z3Solver] Could not parse rule constraint: ${z3Logic}`);
      return null;
    } catch (e) {
      console.warn(`[Z3Solver] Error building constraint for rule ${rule.id}:`, e);
      return null;
    }
  }

  private runRuleBasedVerification(
    assertions: typeof caseAssertions.$inferSelect[],
    rules: typeof formalRules.$inferSelect[]
  ): {
    result: SolverResult;
    unsatCore: string[];
    output: string;
    violations: RuleViolation[];
  } {
    const violations: RuleViolation[] = [];
    const unsatCore: string[] = [];

    for (const rule of rules) {
      if (!rule.z3Logic) continue;

      const violation = this.checkRuleAgainstAssertions(rule, assertions);
      if (violation) {
        violations.push(violation);
        unsatCore.push(rule.id);
      }
    }

    const result: SolverResult = violations.length === 0 ? "SAT" : "UNSAT";
    const output = this.generateSolverOutput(result, violations, assertions.length, rules.length);

    return { result, unsatCore, output, violations };
  }

  private checkRuleAgainstAssertions(
    rule: typeof formalRules.$inferSelect,
    assertions: typeof caseAssertions.$inferSelect[]
  ): RuleViolation | null {
    if (!rule.z3Logic) return null;

    const z3Logic = rule.z3Logic.toLowerCase();
    const predicatesFailed: string[] = [];

    for (const assertion of assertions) {
      const varName = assertion.predicateName.charAt(0).toLowerCase() + assertion.predicateName.slice(1);
      
      if (z3Logic.includes(varName.toLowerCase())) {
        const isViolated = this.evaluateRuleCondition(rule, assertion);
        if (isViolated) {
          predicatesFailed.push(assertion.predicateName);
        }
      }
    }

    if (predicatesFailed.length > 0 || this.isRuleUnsatisfied(rule, assertions)) {
      return {
        ruleId: rule.id,
        ruleName: rule.eligibilityDomain,
        citation: this.extractCitation(rule),
        predicatesFailed,
        explanation: this.generateViolationExplanation(rule, predicatesFailed, assertions)
      };
    }

    return null;
  }

  private evaluateRuleCondition(
    rule: typeof formalRules.$inferSelect,
    assertion: typeof caseAssertions.$inferSelect
  ): boolean {
    if (!rule.z3Logic || !assertion.predicateValue) return false;

    const z3Logic = rule.z3Logic;
    const value = assertion.predicateValue;

    if (rule.eligibilityDomain === "income" && rule.ruleType === "threshold") {
      if (z3Logic.includes("<=") || z3Logic.includes("<")) {
        const thresholdMatch = z3Logic.match(/(<|<=)\s*(\w+)\s+(\d+)/);
        if (thresholdMatch) {
          const threshold = parseInt(thresholdMatch[3], 10);
          const assertedValue = parseFloat(value);
          if (!isNaN(assertedValue) && !isNaN(threshold)) {
            return assertedValue > threshold;
          }
        }
      }
    }

    if (rule.eligibilityDomain === "resources" && rule.ruleType === "threshold") {
      const resourceThresholdMatch = z3Logic.match(/(<|<=)\s*(\w+)\s+(\d+)/);
      if (resourceThresholdMatch) {
        const threshold = parseInt(resourceThresholdMatch[3], 10);
        const assertedValue = parseFloat(value);
        if (!isNaN(assertedValue) && !isNaN(threshold)) {
          return assertedValue > threshold;
        }
      }
    }

    return false;
  }

  private isRuleUnsatisfied(
    rule: typeof formalRules.$inferSelect,
    assertions: typeof caseAssertions.$inferSelect[]
  ): boolean {
    if (!rule.z3Logic) return false;

    const z3Logic = rule.z3Logic.toLowerCase();

    if (rule.eligibilityDomain === "residency" && rule.ruleType === "requirement") {
      const residencyAssertion = assertions.find(a => 
        a.predicateName.toLowerCase().includes("resident") || 
        a.predicateName.toLowerCase().includes("stateofresidence")
      );
      
      if (!residencyAssertion) return true;
      
      if (residencyAssertion.predicateValue === "false") return true;
    }

    if (rule.eligibilityDomain === "citizenship" && rule.ruleType === "requirement") {
      const citizenshipAssertion = assertions.find(a => 
        a.predicateName.toLowerCase().includes("citizenship")
      );
      
      if (!citizenshipAssertion) return true;
      
      const validStatuses = ["us_citizen", "us_national", "qualified_alien", "citizen"];
      if (!validStatuses.includes(citizenshipAssertion.predicateValue?.toLowerCase() || "")) {
        return true;
      }
    }

    return false;
  }

  private extractCitation(rule: typeof formalRules.$inferSelect): string {
    if (rule.ruleFragmentId) {
      return `Rule ${rule.id.substring(0, 8)}...`;
    }
    return `Formal Rule ${rule.eligibilityDomain}`;
  }

  private generateViolationExplanation(
    rule: typeof formalRules.$inferSelect,
    predicatesFailed: string[],
    assertions: typeof caseAssertions.$inferSelect[]
  ): string {
    const domainDescriptions: Record<string, string> = {
      income: "Income threshold requirement not met",
      resources: "Resource limit exceeded",
      residency: "State residency requirement not satisfied",
      citizenship: "Citizenship/immigration status requirement not met",
      work_requirement: "Work requirement not satisfied",
      student_status: "Student eligibility criteria not met",
      household_composition: "Household composition requirements not satisfied"
    };

    const baseExplanation = domainDescriptions[rule.eligibilityDomain] || 
      `${rule.eligibilityDomain} requirement not satisfied`;

    if (predicatesFailed.length > 0) {
      const failedValues = predicatesFailed.map(pred => {
        const assertion = assertions.find(a => a.predicateName === pred);
        return assertion ? `${pred}=${assertion.predicateValue}` : pred;
      }).join(", ");
      
      return `${baseExplanation}. Failed predicates: ${failedValues}`;
    }

    return baseExplanation;
  }

  private generateSolverOutput(
    result: SolverResult,
    violations: RuleViolation[],
    assertionCount: number,
    ruleCount: number
  ): string {
    const lines: string[] = [
      `; Solver Result: ${result}`,
      `; Assertions: ${assertionCount}`,
      `; Rules Checked: ${ruleCount}`,
      `; Violations: ${violations.length}`,
      ""
    ];

    if (result === "SAT") {
      lines.push("; All eligibility rules satisfied");
      lines.push("sat");
    } else if (result === "UNSAT") {
      lines.push("; The following rules were not satisfied:");
      for (const v of violations) {
        lines.push(`; - ${v.ruleName}: ${v.explanation}`);
        lines.push(`;   Citation: ${v.citation}`);
      }
      lines.push("unsat");
      lines.push("");
      lines.push("; UNSAT Core (rule IDs that caused failure):");
      lines.push(`(${violations.map(v => v.ruleId).join(" ")})`);
    }

    return lines.join("\n");
  }

  private determineStatus(result: SolverResult, violations: RuleViolation[]): VerificationStatus {
    if (result === "SAT") return "eligible";
    if (result === "UNSAT") return "ineligible";
    if (result === "ERROR") return "error";
    return "needs_review";
  }

  private createErrorResult(
    caseId: string,
    programCode: string,
    error: string,
    startTime: number
  ): SolverRunResult {
    return {
      runId: "",
      caseId,
      programCode,
      result: "ERROR",
      status: "error",
      violations: [],
      unsatCore: [],
      solverOutput: `; Error: ${error}`,
      executionTimeMs: Date.now() - startTime
    };
  }

  private inferZ3Type(value: string | null): string {
    if (!value) return "Bool";
    if (value === "true" || value === "false") return "Bool";
    if (!isNaN(Number(value))) {
      if (value.includes(".")) return "Real";
      return "Int";
    }
    return "String";
  }

  async getSolverRun(runId: string): Promise<SolverRun | null> {
    const [run] = await db.select()
      .from(solverRuns)
      .where(eq(solverRuns.id, runId));
    return run || null;
  }

  async getSolverRunsForCase(caseId: string, limit: number = 10): Promise<SolverRun[]> {
    return db.select()
      .from(solverRuns)
      .where(eq(solverRuns.caseId, caseId))
      .orderBy(desc(solverRuns.createdAt))
      .limit(limit);
  }

  async getSolverStats(): Promise<{
    totalRuns: number;
    satCount: number;
    unsatCount: number;
    errorCount: number;
    avgExecutionTimeMs: number;
    byProgram: Record<string, { total: number; sat: number; unsat: number }>;
  }> {
    const [total] = await db.select({ count: sql<number>`count(*)` })
      .from(solverRuns);
    
    const [satCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solverRuns)
      .where(eq(solverRuns.solverResult, "SAT"));
    
    const [unsatCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solverRuns)
      .where(eq(solverRuns.solverResult, "UNSAT"));
    
    const [errorCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solverRuns)
      .where(eq(solverRuns.solverResult, "ERROR"));
    
    const [avgTime] = await db.select({ avg: sql<number>`avg(${solverRuns.solverTimeMs})` })
      .from(solverRuns);

    const programStats = await db.select({
      program: solverRuns.programCode,
      total: sql<number>`count(*)`,
      sat: sql<number>`sum(case when ${solverRuns.solverResult} = 'SAT' then 1 else 0 end)`,
      unsat: sql<number>`sum(case when ${solverRuns.solverResult} = 'UNSAT' then 1 else 0 end)`
    })
      .from(solverRuns)
      .groupBy(solverRuns.programCode);

    const byProgram: Record<string, { total: number; sat: number; unsat: number }> = {};
    for (const s of programStats) {
      byProgram[s.program] = {
        total: Number(s.total),
        sat: Number(s.sat),
        unsat: Number(s.unsat)
      };
    }

    return {
      totalRuns: Number(total.count),
      satCount: Number(satCount.count),
      unsatCount: Number(unsatCount.count),
      errorCount: Number(errorCount.count),
      avgExecutionTimeMs: Number(avgTime.avg) || 0,
      byProgram
    };
  }
}

export const z3SolverService = new Z3SolverService();
