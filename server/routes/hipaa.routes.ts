import { Router } from "express";
import { hipaaService } from "../services/hipaa.service";
import { 
  insertHipaaPhiAccessLogSchema,
  insertHipaaBusinessAssociateAgreementSchema,
  insertHipaaRiskAssessmentSchema,
  insertHipaaSecurityIncidentSchema,
  insertHipaaAuditLogSchema 
} from "@shared/schema";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireStaff, requireAdmin } from "../middleware/auth";

const router = Router();

// All HIPAA routes require authentication at minimum
router.use(requireAuth);

// ============================================================================
// PHI ACCESS LOGS
// ============================================================================

router.get("/phi-access-logs", requireStaff, asyncHandler(async (req, res) => {
  const params = {
    userId: req.query.userId as string | undefined,
    patientId: req.query.patientId as string | undefined,
    resourceType: req.query.resourceType as string | undefined,
    resourceId: req.query.resourceId as string | undefined,
    flaggedOnly: req.query.flaggedOnly === 'true',
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
  };

  const logs = await hipaaService.getPhiAccessLogs(params);
  res.json({ success: true, data: logs });
}));

router.post("/phi-access-logs", requireStaff, asyncHandler(async (req, res) => {
  const validatedData = insertHipaaPhiAccessLogSchema.parse(req.body);
  const log = await hipaaService.logPhiAccess(validatedData);
  res.status(201).json({ success: true, data: log });
}));

router.post("/phi-access-logs/:id/flag", requireStaff, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  if (!reason) {
    return res.status(400).json({ success: false, error: "Reason is required" });
  }

  const log = await hipaaService.flagPhiAccessForReview(id, reason);
  res.json({ success: true, data: log });
}));

router.post("/phi-access-logs/:id/review", requireStaff, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const reviewedBy = req.user?.id;

  if (!reviewedBy) {
    return res.status(401).json({ success: false, error: "User not authenticated" });
  }

  const log = await hipaaService.reviewPhiAccess(id, reviewedBy);
  res.json({ success: true, data: log });
}));

// ============================================================================
// BUSINESS ASSOCIATE AGREEMENTS
// ============================================================================

router.get("/business-associate-agreements", requireStaff, asyncHandler(async (req, res) => {
  const params = {
    status: req.query.status as string | undefined,
    expiringWithinDays: req.query.expiringWithinDays ? parseInt(req.query.expiringWithinDays as string) : undefined,
    auditDueWithinDays: req.query.auditDueWithinDays ? parseInt(req.query.auditDueWithinDays as string) : undefined,
  };

  const agreements = await hipaaService.getBusinessAssociateAgreements(params);
  res.json({ success: true, data: agreements });
}));

router.get("/business-associate-agreements/:id", requireStaff, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agreement = await hipaaService.getBusinessAssociateAgreementById(id);
  
  if (!agreement) {
    return res.status(404).json({ success: false, error: "Business Associate Agreement not found" });
  }
  
  res.json({ success: true, data: agreement });
}));

router.post("/business-associate-agreements", requireAdmin, asyncHandler(async (req, res) => {
  const validatedData = insertHipaaBusinessAssociateAgreementSchema.parse({
    ...req.body,
    createdBy: req.user?.id
  });
  const agreement = await hipaaService.createBusinessAssociateAgreement(validatedData);
  res.status(201).json({ success: true, data: agreement });
}));

router.patch("/business-associate-agreements/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const validatedData = insertHipaaBusinessAssociateAgreementSchema.partial().parse({
    ...req.body,
    updatedBy: req.user?.id
  });
  const agreement = await hipaaService.updateBusinessAssociateAgreement(id, validatedData);
  res.json({ success: true, data: agreement });
}));

router.post("/business-associate-agreements/:id/terminate", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const updatedBy = req.user?.id;

  if (!reason) {
    return res.status(400).json({ success: false, error: "Termination reason is required" });
  }

  if (!updatedBy) {
    return res.status(401).json({ success: false, error: "User not authenticated" });
  }

  const agreement = await hipaaService.terminateBusinessAssociateAgreement(id, reason, updatedBy);
  res.json({ success: true, data: agreement });
}));

// ============================================================================
// RISK ASSESSMENTS
// ============================================================================

router.get("/risk-assessments", requireStaff, asyncHandler(async (req, res) => {
  const params = {
    assessmentType: req.query.assessmentType as string | undefined,
    riskLevel: req.query.riskLevel as string | undefined,
    status: req.query.status as string | undefined,
    reviewDueSoon: req.query.reviewDueSoon === 'true',
  };

  const assessments = await hipaaService.getRiskAssessments(params);
  res.json({ success: true, data: assessments });
}));

router.get("/risk-assessments/:id", requireStaff, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const assessment = await hipaaService.getRiskAssessmentById(id);
  
  if (!assessment) {
    return res.status(404).json({ success: false, error: "Risk Assessment not found" });
  }
  
  res.json({ success: true, data: assessment });
}));

router.post("/risk-assessments", requireAdmin, asyncHandler(async (req, res) => {
  const validatedData = insertHipaaRiskAssessmentSchema.parse({
    ...req.body,
    assessor: req.user?.id
  });
  const assessment = await hipaaService.createRiskAssessment(validatedData);
  res.status(201).json({ success: true, data: assessment });
}));

router.patch("/risk-assessments/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const validatedData = insertHipaaRiskAssessmentSchema.partial().parse(req.body);
  const assessment = await hipaaService.updateRiskAssessment(id, validatedData);
  res.json({ success: true, data: assessment });
}));

router.post("/risk-assessments/:id/approve", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const approvedBy = req.user?.id;

  if (!approvedBy) {
    return res.status(401).json({ success: false, error: "User not authenticated" });
  }

  const assessment = await hipaaService.approveRiskAssessment(id, approvedBy);
  res.json({ success: true, data: assessment });
}));

// ============================================================================
// SECURITY INCIDENTS
// ============================================================================

router.get("/security-incidents", requireStaff, asyncHandler(async (req, res) => {
  const params = {
    incidentType: req.query.incidentType as string | undefined,
    severity: req.query.severity as string | undefined,
    status: req.query.status as string | undefined,
    breachThresholdMet: req.query.breachThresholdMet === 'true' ? true : req.query.breachThresholdMet === 'false' ? false : undefined,
    phiInvolved: req.query.phiInvolved === 'true' ? true : req.query.phiInvolved === 'false' ? false : undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const incidents = await hipaaService.getSecurityIncidents(params);
  res.json({ success: true, data: incidents });
}));

router.get("/security-incidents/:id", requireStaff, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const incident = await hipaaService.getSecurityIncidentById(id);
  
  if (!incident) {
    return res.status(404).json({ success: false, error: "Security Incident not found" });
  }
  
  res.json({ success: true, data: incident });
}));

router.post("/security-incidents", requireStaff, asyncHandler(async (req, res) => {
  const validatedData = insertHipaaSecurityIncidentSchema.parse({
    ...req.body,
    reportedBy: req.user?.id,
    incidentOwner: req.body.incidentOwner || req.user?.id
  });
  const incident = await hipaaService.createSecurityIncident(validatedData);
  res.status(201).json({ success: true, data: incident });
}));

router.patch("/security-incidents/:id", requireStaff, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const validatedData = insertHipaaSecurityIncidentSchema.partial().parse(req.body);
  const incident = await hipaaService.updateSecurityIncident(id, validatedData);
  res.json({ success: true, data: incident });
}));

router.post("/security-incidents/:id/close", requireStaff, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { lessonsLearned } = req.body;
  const closedBy = req.user?.id;

  if (!closedBy) {
    return res.status(401).json({ success: false, error: "User not authenticated" });
  }

  const incident = await hipaaService.closeSecurityIncident(id, closedBy, lessonsLearned);
  res.json({ success: true, data: incident });
}));

// ============================================================================
// AUDIT LOGS
// ============================================================================

router.get("/audit-logs", requireStaff, asyncHandler(async (req, res) => {
  const params = {
    userId: req.query.userId as string | undefined,
    action: req.query.action as string | undefined,
    actionCategory: req.query.actionCategory as string | undefined,
    resourceType: req.query.resourceType as string | undefined,
    resourceId: req.query.resourceId as string | undefined,
    phiAccessed: req.query.phiAccessed === 'true' ? true : req.query.phiAccessed === 'false' ? false : undefined,
    securityRelevant: req.query.securityRelevant === 'true' ? true : req.query.securityRelevant === 'false' ? false : undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
  };

  const logs = await hipaaService.getAuditLogs(params);
  res.json({ success: true, data: logs });
}));

router.post("/audit-logs", requireStaff, asyncHandler(async (req, res) => {
  const validatedData = insertHipaaAuditLogSchema.parse(req.body);
  const log = await hipaaService.createAuditLog(validatedData);
  res.status(201).json({ success: true, data: log });
}));

// ============================================================================
// COMPLIANCE DASHBOARD
// ============================================================================

router.get("/dashboard", requireStaff, asyncHandler(async (req, res) => {
  const dashboard = await hipaaService.getComplianceDashboard();
  res.json({ success: true, data: dashboard });
}));

export default router;
