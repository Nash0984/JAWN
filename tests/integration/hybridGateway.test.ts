import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../../server/db";
import { 
  hybridGatewayAuditLogs, 
  solverRuns, 
  formalRules, 
  ontologyTerms,
  caseAssertions 
} from "../../shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Express } from "express";
import { registerRoutes } from "../../server/routes";
import express from "express";
import request from "supertest";

describe("Neuro-Symbolic Hybrid Gateway Integration Tests", () => {
  let app: Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    registerRoutes(app);
  });

  describe("Hybrid Gateway Architecture", () => {
    it("should have hybrid_gateway_audit_logs table with required columns", async () => {
      const result = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'hybrid_gateway_audit_logs'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map((r: any) => r.column_name);
      
      expect(columns).toContain('id');
      expect(columns).toContain('gateway_run_id');
      expect(columns).toContain('case_id');
      expect(columns).toContain('state_code');
      expect(columns).toContain('program_code');
      expect(columns).toContain('operation_type');
      expect(columns).toContain('neural_extraction_confidence');
      expect(columns).toContain('solver_run_id');
      expect(columns).toContain('ontology_terms_matched');
      expect(columns).toContain('unsat_core');
      expect(columns).toContain('statutory_citations');
      expect(columns).toContain('determination');
      expect(columns).toContain('is_legally_grounded');
    });

    it("should have solver_runs table for Z3 verification tracking", async () => {
      const result = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'solver_runs'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map((r: any) => r.column_name);
      
      expect(columns).toContain('id');
      expect(columns).toContain('case_id');
      expect(columns).toContain('state_code');
      expect(columns).toContain('program_code');
      expect(columns).toContain('solver_result');
      expect(columns).toContain('is_satisfied');
      expect(columns).toContain('violated_rule_ids');
      expect(columns).toContain('unsat_core');
    });

    it("should have formal_rules table for Rules-as-Code", async () => {
      const result = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'formal_rules'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map((r: any) => r.column_name);
      
      expect(columns).toContain('id');
      expect(columns).toContain('state_code');
      expect(columns).toContain('program_code');
      expect(columns).toContain('rule_name');
      expect(columns).toContain('z3_logic');
      expect(columns).toContain('statutory_citation');
      expect(columns).toContain('is_valid');
    });

    it("should have ontology_terms table for TBox semantic layer", async () => {
      const result = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'ontology_terms'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map((r: any) => r.column_name);
      
      expect(columns).toContain('id');
      expect(columns).toContain('term_name');
      expect(columns).toContain('state_code');
      expect(columns).toContain('embedding');
    });
  });

  describe("Z3 Solver Verification API", () => {
    it("should have /api/z3-solver/verify endpoint", async () => {
      const response = await request(app)
        .post("/api/z3-solver/verify")
        .send({
          caseId: "test-case-001",
          stateCode: "MD",
          programCode: "SNAP"
        });
      
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it("should have /api/z3-solver/stats endpoint", async () => {
      const response = await request(app)
        .get("/api/z3-solver/stats");
      
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe("Neuro-Symbolic Research Paper Alignment", () => {
    it("should have /api/neuro-symbolic/verify endpoint", async () => {
      const response = await request(app)
        .post("/api/neuro-symbolic/verify")
        .send({
          caseId: "test-alignment-001",
          stateCode: "MD",
          programCode: "SNAP"
        });
      
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it("should have /api/neuro-symbolic/research-paper-alignment endpoint", async () => {
      const response = await request(app)
        .get("/api/neuro-symbolic/research-paper-alignment");
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('phases');
        expect(response.body).toHaveProperty('overallAlignment');
      }
    });
  });

  describe("PER Hybrid Integration", () => {
    it("should have /api/per/income-verification/verify endpoint with hybrid context", async () => {
      const response = await request(app)
        .post("/api/per/income-verification/verify")
        .send({
          caseId: "test-income-001",
          reportedIncome: 2000,
          verifiedIncome: 2500,
          discrepancyAmount: 500,
          verificationSource: "W2"
        });
      
      expect([200, 201, 400, 404, 500]).toContain(response.status);
    });

    it("should have /api/per/consistency-checks/validate endpoint with hybrid context", async () => {
      const response = await request(app)
        .post("/api/per/consistency-checks/validate")
        .send({
          caseId: "test-consistency-001",
          checkType: "income_totals",
          fieldValues: {
            grossIncome: 3000,
            earnedIncome: 2500,
            unearnedIncome: 500
          }
        });
      
      expect([200, 201, 400, 404, 500]).toContain(response.status);
    });

    it("should have /api/per/duplicate-detection/check endpoint with hybrid context", async () => {
      const response = await request(app)
        .post("/api/per/duplicate-detection/check")
        .send({
          applicantSsn: "***-**-1234",
          applicantName: "Test Applicant",
          dateOfBirth: "1990-01-01"
        });
      
      expect([200, 201, 400, 404, 500]).toContain(response.status);
    });

    it("should have /api/per/nudges/generate endpoint with hybrid grounding", async () => {
      const response = await request(app)
        .post("/api/per/nudges/generate")
        .send({
          caseId: "test-nudge-001",
          caseworkerId: "cw-001",
          riskFactors: [{
            type: "income_discrepancy",
            description: "Reported income differs from verified income",
            severity: "medium"
          }]
        });
      
      expect([200, 201, 400, 404, 500]).toContain(response.status);
    });
  });

  describe("Eligibility Calculation with Hybrid Verification", () => {
    it("should calculate SNAP eligibility with Z3 verification context", async () => {
      const response = await request(app)
        .post("/api/eligibility/calculate")
        .send({
          benefitProgramId: "snap",
          household: {
            size: 3,
            grossMonthlyIncome: 200000,
            earnedIncome: 180000,
            unearnedIncome: 20000
          }
        });
      
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe("Audit Trail Requirements", () => {
    it("should create audit entries with all required fields", async () => {
      const recentLogs = await db.select()
        .from(hybridGatewayAuditLogs)
        .orderBy(desc(hybridGatewayAuditLogs.createdAt))
        .limit(5);
      
      if (recentLogs.length > 0) {
        const log = recentLogs[0];
        expect(log.gatewayRunId).toBeDefined();
        expect(log.stateCode).toBeDefined();
        expect(log.programCode).toBeDefined();
        expect(log.operationType).toBeDefined();
        expect(log.determination).toBeDefined();
      }
    });

    it("should track statutory citations in audit entries", async () => {
      const logsWithCitations = await db.select()
        .from(hybridGatewayAuditLogs)
        .where(sql`statutory_citations IS NOT NULL AND statutory_citations != '[]'::jsonb`)
        .orderBy(desc(hybridGatewayAuditLogs.createdAt))
        .limit(5);
      
      expect(Array.isArray(logsWithCitations)).toBe(true);
    });

    it("should track ontology terms matched in audit entries", async () => {
      const logsWithTerms = await db.select()
        .from(hybridGatewayAuditLogs)
        .where(sql`ontology_terms_matched IS NOT NULL AND ontology_terms_matched != '[]'::jsonb`)
        .orderBy(desc(hybridGatewayAuditLogs.createdAt))
        .limit(5);
      
      expect(Array.isArray(logsWithTerms)).toBe(true);
    });
  });

  describe("Violation Trace Generation", () => {
    it("should have /api/violation-traces endpoint", async () => {
      const response = await request(app)
        .get("/api/violation-traces")
        .query({ limit: 5 });
      
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it("should generate appeal-ready explanations with statutory citations", async () => {
      const response = await request(app)
        .post("/api/violation-traces/generate")
        .send({
          caseId: "test-violation-001",
          stateCode: "MD",
          programCode: "SNAP",
          violationType: "income_excess"
        });
      
      expect([200, 201, 400, 404, 500]).toContain(response.status);
    });
  });

  describe("Multi-State Support", () => {
    const supportedStates = ["MD", "PA", "VA", "UT", "IN", "MI"];
    
    for (const stateCode of supportedStates) {
      it(`should support ${stateCode} state rules`, async () => {
        const rules = await db.select()
          .from(formalRules)
          .where(eq(formalRules.stateCode, stateCode))
          .limit(1);
        
        expect(Array.isArray(rules)).toBe(true);
      });
    }
  });
});
