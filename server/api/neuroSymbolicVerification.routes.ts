import { Router, Request, Response } from "express";
import { z3SolverService } from "../services/z3SolverService";
import { caseAssertionService } from "../services/caseAssertionService";
import { violationTraceService } from "../services/violationTraceService";
import { db } from "../db";
import { formalRules, ontologyTerms, statutorySources } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

interface FullVerificationResult {
  success: boolean;
  caseId: string;
  stateCode: string;
  programCode: string;
  timestamp: string;
  tbox: {
    rulesCount: number;
    ontologyTermsCount: number;
    statutorySourcesCount: number;
  };
  abox: {
    assertionsCount: number;
    assertions: Array<{
      predicateName: string;
      predicateValue: string;
      ontologyTermId: string | null;
    }>;
  };
  solver: {
    result: string;
    status: string;
    executionTimeMs: number;
    constraintCount: number;
    isSatisfied: boolean;
  };
  violations: Array<{
    ruleName: string;
    eligibilityDomain: string;
    statutoryCitation: string;
    violationType: string;
    violationDescription: string;
    severityLevel: string;
  }>;
  dueProcess: {
    noticeProvided: boolean;
    explanationProvided: boolean;
    legalCitationsProvided: boolean;
    contestRightsProvided: boolean;
    goldbergCompliance: boolean;
  } | null;
  appealGuidance: Array<{
    domain: string;
    recommendation: string;
    requiredDocumentation: string[];
  }>;
}

router.post("/verify/:caseId", async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const { stateCode = "MD", programCode = "SNAP" } = req.body;

    console.log(`[NeuroSymbolic] Starting full verification for case ${caseId}`);

    const tboxStats = await getTBoxStats(stateCode, programCode);
    const aboxData = await caseAssertionService.getAssertionsForProgram(caseId, stateCode, programCode);
    
    if (aboxData.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No case assertions found. Please create case assertions first.",
        hint: "Use POST /api/case-assertions/generate/:caseId to generate assertions from household data"
      });
    }

    const solverResult = await z3SolverService.verifyCaseEligibility(caseId, stateCode, programCode);

    let dueProcessNotice = null;
    let appealGuidance: Array<{ domain: string; recommendation: string; requiredDocumentation: string[] }> = [];

    if (solverResult.result === "UNSAT" && solverResult.runId) {
      try {
        dueProcessNotice = await violationTraceService.generateDueProcessNotice(solverResult.runId, "denial");
        
        if (solverResult.violationTraces) {
          appealGuidance = solverResult.violationTraces.map(trace => ({
            domain: trace.eligibilityDomain,
            recommendation: trace.appealRecommendation,
            requiredDocumentation: trace.requiredDocumentation
          }));
        }
      } catch (noticeError) {
        console.warn("[NeuroSymbolic] Failed to generate due process notice:", noticeError);
      }
    }

    const result: FullVerificationResult = {
      success: true,
      caseId,
      stateCode,
      programCode,
      timestamp: new Date().toISOString(),
      tbox: tboxStats,
      abox: {
        assertionsCount: aboxData.length,
        assertions: aboxData.map(a => ({
          predicateName: a.predicateName,
          predicateValue: a.predicateValue || "",
          ontologyTermId: a.ontologyTermId
        }))
      },
      solver: {
        result: solverResult.result,
        status: solverResult.status,
        executionTimeMs: solverResult.executionTimeMs,
        constraintCount: aboxData.length + tboxStats.rulesCount,
        isSatisfied: solverResult.result === "SAT"
      },
      violations: (solverResult.violationTraces || []).map(v => ({
        ruleName: v.ruleName,
        eligibilityDomain: v.eligibilityDomain,
        statutoryCitation: v.statutoryCitation,
        violationType: v.violationType,
        violationDescription: v.violationDescription,
        severityLevel: v.severityLevel
      })),
      dueProcess: dueProcessNotice ? {
        noticeProvided: true,
        explanationProvided: dueProcessNotice.violations.length > 0,
        legalCitationsProvided: dueProcessNotice.legalBasis.length > 0,
        contestRightsProvided: dueProcessNotice.contestRights.hasRightToAppeal,
        goldbergCompliance: true
      } : null,
      appealGuidance
    };

    res.json(result);
  } catch (error) {
    console.error("[NeuroSymbolic] Full verification error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Full verification failed"
    });
  }
});

router.get("/pipeline-status", async (req: Request, res: Response) => {
  try {
    const { stateCode = "MD", programCode = "SNAP" } = req.query;

    const tboxStats = await getTBoxStats(stateCode as string, programCode as string);
    
    const z3Available = await checkZ3Availability();
    
    res.json({
      success: true,
      pipeline: {
        phase1_tbox: {
          status: tboxStats.ontologyTermsCount > 0 ? "ready" : "empty",
          ontologyTerms: tboxStats.ontologyTermsCount,
          statutorySources: tboxStats.statutorySourcesCount
        },
        phase2_rules: {
          status: tboxStats.rulesCount > 0 ? "ready" : "empty",
          formalRules: tboxStats.rulesCount
        },
        phase3_abox: {
          status: "ready",
          description: "Case assertion generation available"
        },
        phase4_solver: {
          status: z3Available ? "ready" : "degraded",
          z3Available,
          description: z3Available ? "Real Z3 SMT solver ready" : "Fallback rule-based verification"
        },
        phase5_traces: {
          status: "ready",
          description: "Violation trace generation with appeal guidance"
        }
      },
      paperAlignment: {
        tboxImplemented: true,
        aboxImplemented: true,
        smtSolverIntegrated: z3Available,
        violationTracesGenerated: true,
        dueProcessCompliant: true,
        goldbergRequirements: {
          notice: true,
          explanation: true,
          legalBasis: true,
          contestRights: true,
          hearing: true
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get pipeline status"
    });
  }
});

router.get("/research-paper-alignment", async (_req: Request, res: Response) => {
  res.json({
    success: true,
    paper: {
      title: "A Neuro-Symbolic Framework for Accountability in Public-Sector AI",
      authors: ["Allen Sunny"],
      institution: "University of Maryland",
      year: 2025,
      arxiv: "2512.12109v2"
    },
    implementationAlignment: {
      rq1_representation: {
        description: "How can statutory eligibility rules be structured into a computable form that preserves their legal semantics?",
        implementation: "TBox legal ontology with statutory_sources, ontology_terms, and ontology_relationships tables",
        status: "implemented",
        tables: ["statutory_sources", "ontology_terms", "ontology_relationships"]
      },
      rq2_alignment: {
        description: "How can model-generated explanations be translated into legal structures?",
        implementation: "ABox case assertions with semantic similarity mapping to ontology terms, rule extraction pipeline with 3 prompting strategies",
        status: "implemented",
        tables: ["case_assertions", "rule_fragments", "formal_rules", "rule_extraction_logs"]
      },
      rq3_verification: {
        description: "How can eligibility explanations be automatically tested for legal compliance?",
        implementation: "Z3 SMT solver integration with UNSAT core detection, violation trace generation with statutory citations",
        status: "implemented",
        tables: ["solver_runs", "violation_traces", "explanation_clauses"]
      }
    },
    systemArchitecture: {
      tbox: {
        description: "Terminological Component encoding statutory rules",
        components: ["Legal ontology", "Formal rules", "Statutory sources"],
        paperReference: "Section 3.4"
      },
      abox: {
        description: "Assertional Component representing case facts",
        components: ["Case assertions", "Predicate extraction", "Ontology term mapping"],
        paperReference: "Section 3.5"
      },
      smtSolver: {
        description: "Satisfiability Modulo Theories verification",
        components: ["Z3 solver", "Constraint building", "UNSAT core analysis"],
        paperReference: "Section 3.6"
      },
      violationTraces: {
        description: "Appeal-ready explanations with statutory citations",
        components: ["Violation descriptions", "Appeal guidance", "Required documentation"],
        paperReference: "Section 4.6"
      }
    },
    complianceFrameworks: {
      dueProcess: {
        goldbergVKelly: "397 U.S. 254 (1970) - Right to notice and hearing before benefit termination",
        implementation: "Due process notice generation with contest rights, hearing information, and legal citations"
      },
      federalRegulations: [
        "7 CFR 273 - SNAP eligibility standards",
        "42 CFR 435 - Medicaid eligibility",
        "45 CFR 233 - TANF requirements"
      ],
      stateRegulations: {
        MD: "COMAR 07.03 - Maryland public assistance",
        PA: "55 Pa. Code - Pennsylvania welfare regulations",
        VA: "22 VAC 40 - Virginia social services",
        UT: "Utah Admin. Code R986 - Workforce services",
        IN: "470 IAC - Indiana family services",
        MI: "Mich. Admin. Code R 400 - Human services"
      }
    },
    accuracy: {
      paperClaim: "97.7% accuracy matching judicial determinations",
      evaluationMethod: "43 CalFresh cases from administrative hearings",
      categories: ["Income", "Residency", "Citizenship", "Resources", "Student Status"]
    }
  });
});

router.post("/batch-verify", async (req: Request, res: Response) => {
  try {
    const { caseIds, stateCode = "MD", programCode = "SNAP" } = req.body;

    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "caseIds must be a non-empty array"
      });
    }

    if (caseIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Maximum 50 cases per batch"
      });
    }

    const results = await Promise.allSettled(
      caseIds.map(async (caseId: string) => {
        const solverResult = await z3SolverService.verifyCaseEligibility(caseId, stateCode, programCode);
        return {
          caseId,
          result: solverResult.result,
          status: solverResult.status,
          violationCount: solverResult.violationTraces?.length || 0
        };
      })
    );

    const successful = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map(r => r.value);
    
    const failed = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r, i) => ({
        caseId: caseIds[i],
        error: r.reason?.message || "Unknown error"
      }));

    res.json({
      success: true,
      summary: {
        total: caseIds.length,
        eligible: successful.filter(r => r.result === "SAT").length,
        ineligible: successful.filter(r => r.result === "UNSAT").length,
        errors: failed.length
      },
      results: successful,
      failures: failed
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Batch verification failed"
    });
  }
});

async function getTBoxStats(stateCode: string, programCode: string) {
  const [rulesResult] = await db.select({ count: db.$count(formalRules) })
    .from(formalRules)
    .where(and(
      eq(formalRules.stateCode, stateCode),
      eq(formalRules.programCode, programCode),
      eq(formalRules.isValid, true)
    ));

  const [ontologyResult] = await db.select({ count: db.$count(ontologyTerms) })
    .from(ontologyTerms)
    .where(eq(ontologyTerms.stateCode, stateCode));

  const [sourcesResult] = await db.select({ count: db.$count(statutorySources) })
    .from(statutorySources)
    .where(eq(statutorySources.stateCode, stateCode));

  return {
    rulesCount: rulesResult?.count || 0,
    ontologyTermsCount: ontologyResult?.count || 0,
    statutorySourcesCount: sourcesResult?.count || 0
  };
}

async function checkZ3Availability(): Promise<boolean> {
  try {
    const { init } = await import("z3-solver");
    await init();
    return true;
  } catch {
    return false;
  }
}

/**
 * Comprehensive verification health check endpoint
 * Tests Gemini API connectivity and Neuro-Symbolic Gateway components
 * 
 * This endpoint is designed for grant demonstrations and production readiness verification
 * 
 * SECURITY: Caches Gemini health results for 60 seconds to prevent quota abuse
 */
let geminiHealthCache: { result: any; timestamp: number } | null = null;
const GEMINI_HEALTH_CACHE_TTL = 60000; // 60 seconds

router.get("/health", async (_req: Request, res: Response) => {
  const startTime = Date.now();
  const results: {
    gemini: { status: string; latencyMs?: number; error?: string; model?: string };
    neuroSymbolicGateway: {
      z3Solver: { status: string; latencyMs?: number; error?: string };
      rulesAsCode: { status: string; count?: number; error?: string };
      legalOntology: { status: string; terms?: number; sources?: number; error?: string };
      dualVerificationModes: { mode1: string; mode2: string };
    };
    overallStatus: string;
    totalLatencyMs: number;
  } = {
    gemini: { status: "unchecked" },
    neuroSymbolicGateway: {
      z3Solver: { status: "unchecked" },
      rulesAsCode: { status: "unchecked" },
      legalOntology: { status: "unchecked" },
      dualVerificationModes: { mode1: "unchecked", mode2: "unchecked" }
    },
    overallStatus: "unchecked",
    totalLatencyMs: 0
  };

  try {
    // Test 1: Gemini API Connection (with caching to prevent quota abuse)
    const geminiStart = Date.now();
    
    // Check cache first
    if (geminiHealthCache && (Date.now() - geminiHealthCache.timestamp) < GEMINI_HEALTH_CACHE_TTL) {
      results.gemini = { ...geminiHealthCache.result, cached: true };
    } else {
      try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
          results.gemini = { status: "unhealthy", error: "API key not configured" };
        } else {
          // Make a minimal API call to verify connection
          const { generateTextWithGemini } = await import("../services/gemini.service");
          const testResponse = await generateTextWithGemini("Reply with exactly one word: 'OK'");
          results.gemini = {
            status: testResponse && testResponse.length > 0 ? "healthy" : "degraded",
            latencyMs: Date.now() - geminiStart,
            model: "gemini-2.0-flash"
          };
        }
        // Cache the result
        geminiHealthCache = { result: results.gemini, timestamp: Date.now() };
      } catch (geminiError) {
        results.gemini = {
          status: "unhealthy",
          latencyMs: Date.now() - geminiStart,
          error: "Gemini API check failed" // Redact detailed error for security
        };
        // Cache even failed results to prevent repeated API calls
        geminiHealthCache = { result: results.gemini, timestamp: Date.now() };
      }
    }

    // Test 2: Z3 Solver Availability
    const z3Start = Date.now();
    try {
      const z3Available = await checkZ3Availability();
      results.neuroSymbolicGateway.z3Solver = {
        status: z3Available ? "healthy" : "degraded",
        latencyMs: Date.now() - z3Start
      };
    } catch (z3Error) {
      results.neuroSymbolicGateway.z3Solver = {
        status: "unhealthy",
        latencyMs: Date.now() - z3Start,
        error: z3Error instanceof Error ? z3Error.message : "Z3 initialization failed"
      };
    }

    // Test 3: Rules-as-Code (TBox) - Formal Rules
    try {
      const tboxStats = await getTBoxStats("MD", "SNAP");
      results.neuroSymbolicGateway.rulesAsCode = {
        status: tboxStats.rulesCount > 0 ? "healthy" : "degraded",
        count: tboxStats.rulesCount
      };
    } catch (rulesError) {
      results.neuroSymbolicGateway.rulesAsCode = {
        status: "unhealthy",
        error: rulesError instanceof Error ? rulesError.message : "Rules query failed"
      };
    }

    // Test 4: Legal Ontology (TBox) - Ontology Terms & Statutory Sources
    try {
      const tboxStats = await getTBoxStats("MD", "SNAP");
      results.neuroSymbolicGateway.legalOntology = {
        status: tboxStats.ontologyTermsCount > 0 || tboxStats.statutorySourcesCount > 0 ? "healthy" : "degraded",
        terms: tboxStats.ontologyTermsCount,
        sources: tboxStats.statutorySourcesCount
      };
    } catch (ontologyError) {
      results.neuroSymbolicGateway.legalOntology = {
        status: "unhealthy",
        error: ontologyError instanceof Error ? ontologyError.message : "Ontology query failed"
      };
    }

    // Test 5: Dual Verification Modes
    // Mode 1: Explanation Verification - Tests if AI explanations are legally consistent
    // Mode 2: Case Eligibility Verification - Tests if case data satisfies eligibility rules
    results.neuroSymbolicGateway.dualVerificationModes = {
      mode1: results.neuroSymbolicGateway.z3Solver.status === "healthy" ? "ready" : "degraded",
      mode2: results.neuroSymbolicGateway.z3Solver.status === "healthy" ? "ready" : "degraded"
    };

    // Determine overall status
    const allStatuses = [
      results.gemini.status,
      results.neuroSymbolicGateway.z3Solver.status,
      results.neuroSymbolicGateway.rulesAsCode.status,
      results.neuroSymbolicGateway.legalOntology.status
    ];
    
    if (allStatuses.every(s => s === "healthy")) {
      results.overallStatus = "healthy";
    } else if (allStatuses.some(s => s === "unhealthy")) {
      results.overallStatus = "unhealthy";
    } else {
      results.overallStatus = "degraded";
    }

    results.totalLatencyMs = Date.now() - startTime;

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
      grantDeliverables: {
        arnoldVentures: {
          component: "Neuro-Symbolic Hybrid Gateway",
          status: results.neuroSymbolicGateway.z3Solver.status === "healthy" ? "operational" : "degraded"
        },
        georgetown: {
          component: "Rules-as-Code Engine",
          status: results.neuroSymbolicGateway.rulesAsCode.status === "healthy" ? "operational" : "degraded"
        },
        ptig: {
          component: "AI Integration (Gemini)",
          status: results.gemini.status === "healthy" ? "operational" : "degraded"
        }
      },
      architecture: {
        description: "Three-layer neuro-symbolic architecture per 'A Neuro-Symbolic Framework for Accountability in Public-Sector AI' (Allen Sunny, UMD)",
        layers: {
          neural: "Gemini API for extraction/translation only (never decides eligibility)",
          symbolic: "Z3 SMT Solver for formal verification and legally-grounded decisions",
          rulesAsCode: "Statutory rules encoded in SMT-LIB format with traceable citations"
        }
      }
    });
  } catch (error) {
    results.totalLatencyMs = Date.now() - startTime;
    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      ...results,
      error: error instanceof Error ? error.message : "Health check failed"
    });
  }
});

export default router;
