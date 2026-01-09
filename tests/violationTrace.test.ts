import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import violationTraceRoutes from "../server/api/violationTrace.routes";
import { violationTraceService } from "../server/services/violationTraceService";

const app = express();
app.use(express.json());
app.use("/api/violation-traces", violationTraceRoutes);

describe("Violation Trace API Endpoints", () => {
  describe("GET /api/violation-traces/appeal-guidance/:violationTraceId", () => {
    it("should return 404 for non-existent trace ID", async () => {
      const fakeId = "non-existent-trace-id";
      const response = await request(app)
        .get(`/api/violation-traces/appeal-guidance/${fakeId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Violation trace not found");
    });

    it("should fetch trace by ID not by solverRunId (regression test)", async () => {
      const result = await violationTraceService.getViolationTraceById("fake-trace-id");
      expect(result).toBeNull();
    });
  });

  describe("GET /api/violation-traces/run/:solverRunId", () => {
    it("should return empty array for non-existent solver run", async () => {
      const response = await request(app)
        .get("/api/violation-traces/run/fake-solver-run-id");
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.traces).toEqual([]);
    });
  });

  describe("GET /api/violation-traces/case/:caseId", () => {
    it("should return empty array for non-existent case", async () => {
      const response = await request(app)
        .get("/api/violation-traces/case/fake-case-id");
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.traces).toEqual([]);
    });
  });

  describe("GET /api/violation-traces/statistics/:stateCode/:programCode", () => {
    it("should return statistics for valid state and program", async () => {
      const response = await request(app)
        .get("/api/violation-traces/statistics/MD/SNAP");
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stateCode).toBe("MD");
      expect(response.body.programCode).toBe("SNAP");
      expect(response.body.statistics).toBeDefined();
    });
  });

  describe("Service Method: getViolationTraceById", () => {
    it("should return null for non-existent trace ID", async () => {
      const result = await violationTraceService.getViolationTraceById("non-existent-id");
      expect(result).toBeNull();
    });

    it("should return null for empty string ID", async () => {
      const result = await violationTraceService.getViolationTraceById("");
      expect(result).toBeNull();
    });
  });
});
