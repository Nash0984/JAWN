import { Router, Request, Response } from "express";
import { violationTraceService } from "../services/violationTraceService";

const router = Router();

router.post("/generate/:solverRunId", async (req: Request, res: Response) => {
  try {
    const { solverRunId } = req.params;
    
    const traces = await violationTraceService.generateViolationTraces(solverRunId);
    
    res.json({
      success: true,
      solverRunId,
      tracesGenerated: traces.length,
      traces
    });
  } catch (error) {
    console.error("[ViolationTrace] Error generating traces:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate violation traces"
    });
  }
});

router.get("/run/:solverRunId", async (req: Request, res: Response) => {
  try {
    const { solverRunId } = req.params;
    
    const traces = await violationTraceService.getViolationTracesForRun(solverRunId);
    
    res.json({
      success: true,
      solverRunId,
      count: traces.length,
      traces
    });
  } catch (error) {
    console.error("[ViolationTrace] Error fetching traces:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch violation traces"
    });
  }
});

router.get("/case/:caseId", async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    
    const traces = await violationTraceService.getViolationTracesForCase(caseId);
    
    res.json({
      success: true,
      caseId,
      count: traces.length,
      traces
    });
  } catch (error) {
    console.error("[ViolationTrace] Error fetching case traces:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch case violation traces"
    });
  }
});

router.post("/due-process-notice/:solverRunId", async (req: Request, res: Response) => {
  try {
    const { solverRunId } = req.params;
    const { noticeType = "denial" } = req.body;
    
    const validNoticeTypes = ["denial", "reduction", "termination", "suspension"];
    if (!validNoticeTypes.includes(noticeType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid notice type. Must be one of: ${validNoticeTypes.join(", ")}`
      });
    }
    
    const notice = await violationTraceService.generateDueProcessNotice(
      solverRunId,
      noticeType as "denial" | "reduction" | "termination" | "suspension"
    );
    
    res.json({
      success: true,
      notice,
      goldbergCompliance: {
        notice: true,
        explanation: true,
        citationProvided: notice.legalBasis.length > 0,
        contestRightsProvided: notice.contestRights.hasRightToAppeal,
        hearingAvailable: true
      }
    });
  } catch (error) {
    console.error("[ViolationTrace] Error generating due process notice:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate due process notice"
    });
  }
});

router.get("/statistics/:stateCode/:programCode", async (req: Request, res: Response) => {
  try {
    const { stateCode, programCode } = req.params;
    
    const stats = await violationTraceService.getStatisticsForProgram(stateCode, programCode);
    
    res.json({
      success: true,
      stateCode,
      programCode,
      statistics: stats
    });
  } catch (error) {
    console.error("[ViolationTrace] Error fetching statistics:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch statistics"
    });
  }
});

router.get("/appeal-guidance/:violationTraceId", async (req: Request, res: Response) => {
  try {
    const { violationTraceId } = req.params;
    
    const trace = await violationTraceService.getViolationTraceById(violationTraceId);
    
    if (!trace) {
      return res.status(404).json({
        success: false,
        error: "Violation trace not found"
      });
    }
    
    res.json({
      success: true,
      violationTraceId,
      domain: trace.eligibilityDomain,
      appealGuidance: {
        recommendation: trace.appealRecommendation,
        requiredDocumentation: trace.requiredDocumentation,
        violationDescription: trace.violationDescription,
        statutoryCitation: trace.statutoryCitation,
        statutoryText: trace.statutoryText,
        conflictingPredicates: trace.conflictingPredicates
      }
    });
  } catch (error) {
    console.error("[ViolationTrace] Error fetching appeal guidance:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch appeal guidance"
    });
  }
});

router.get("/visualization/:solverRunId", async (req: Request, res: Response) => {
  try {
    const { solverRunId } = req.params;
    
    const traces = await violationTraceService.getViolationTracesForRun(solverRunId);
    
    const nodes: Array<{
      id: string;
      type: "rule" | "assertion" | "violation" | "citation";
      label: string;
      domain?: string;
      severity?: string;
    }> = [];
    
    const edges: Array<{
      source: string;
      target: string;
      label?: string;
      type: "violates" | "cites" | "conflicts_with";
    }> = [];
    
    for (const trace of traces) {
      nodes.push({
        id: `violation-${trace.id}`,
        type: "violation",
        label: trace.violationDescription?.substring(0, 80) || trace.ruleName,
        domain: trace.eligibilityDomain,
        severity: trace.severityLevel
      });
      
      if (trace.formalRuleId) {
        nodes.push({
          id: `rule-${trace.formalRuleId}`,
          type: "rule",
          label: trace.ruleName,
          domain: trace.eligibilityDomain
        });
        
        edges.push({
          source: `violation-${trace.id}`,
          target: `rule-${trace.formalRuleId}`,
          label: "violates",
          type: "violates"
        });
      }
      
      if (trace.statutoryCitation) {
        const citationId = `citation-${trace.statutoryCitation.replace(/[^a-zA-Z0-9]/g, "_")}`;
        if (!nodes.find(n => n.id === citationId)) {
          nodes.push({
            id: citationId,
            type: "citation",
            label: trace.statutoryCitation
          });
        }
        
        edges.push({
          source: trace.formalRuleId ? `rule-${trace.formalRuleId}` : `violation-${trace.id}`,
          target: citationId,
          label: "cites",
          type: "cites"
        });
      }
      
      const conflictingIds = trace.conflictingAssertionIds || [];
      for (const assertionId of conflictingIds) {
        const assertionNodeId = `assertion-${assertionId}`;
        if (!nodes.find(n => n.id === assertionNodeId)) {
          nodes.push({
            id: assertionNodeId,
            type: "assertion",
            label: `Case Fact ${assertionId.substring(0, 8)}...`
          });
        }
        
        edges.push({
          source: `violation-${trace.id}`,
          target: assertionNodeId,
          label: "conflicts with",
          type: "conflicts_with"
        });
      }
    }
    
    res.json({
      success: true,
      solverRunId,
      graph: {
        nodes,
        edges,
        metadata: {
          totalViolations: traces.length,
          domains: [...new Set(traces.map(t => t.eligibilityDomain))],
          severities: traces.map(t => t.severityLevel).filter(Boolean)
        }
      }
    });
  } catch (error) {
    console.error("[ViolationTrace] Error generating visualization:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate visualization"
    });
  }
});

export default router;
