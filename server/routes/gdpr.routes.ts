import { Router, Request, Response } from "express";
import { gdprService } from "../services/gdpr.service";
import { requireAuth, requireAdmin, requireStaff } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { z } from "zod";
import { insertGdprConsentSchema, insertGdprDataSubjectRequestSchema, insertGdprPrivacyImpactAssessmentSchema, insertGdprBreachIncidentSchema } from "@shared/schema";

const router = Router();

// ============================================================================
// CONSENT MANAGEMENT ENDPOINTS
// ============================================================================

router.post(
  "/consent",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const consentSchema = z.object({
      purpose: z.string(),
      consentGiven: z.boolean(),
      consentMethod: z.string(),
      consentText: z.string().optional(),
      expiresAt: z.string().optional().transform(val => val ? new Date(val) : undefined),
    });

    const validated = consentSchema.parse(req.body);

    const consent = await gdprService.recordConsent({
      userId: req.user!.id,
      purpose: validated.purpose,
      consentGiven: validated.consentGiven,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      consentMethod: validated.consentMethod,
      consentText: validated.consentText,
      expiresAt: validated.expiresAt,
    });

    res.status(201).json({
      success: true,
      data: consent,
    });
  })
);

router.delete(
  "/consent/:purpose",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { purpose } = req.params;
    const { reason } = req.body;

    const consent = await gdprService.withdrawConsent(
      req.user!.id,
      purpose,
      reason,
      {
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      }
    );

    res.json({
      success: true,
      data: consent,
      message: `Consent for ${purpose} has been withdrawn`,
    });
  })
);

router.get(
  "/consent",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { purpose } = req.query;

    if (purpose) {
      const status = await gdprService.checkConsentStatus(req.user!.id, purpose as string);
      res.json({
        success: true,
        data: status,
      });
    } else {
      const consents = await gdprService.getConsentHistory(req.user!.id);
      res.json({
        success: true,
        data: consents,
      });
    }
  })
);

// ============================================================================
// DATA SUBJECT RIGHTS ENDPOINTS
// ============================================================================

router.post(
  "/data-subject-request",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const requestSchema = z.object({
      requestType: z.enum(["access", "erasure", "portability", "rectification", "restriction", "objection"]),
      details: z.record(z.any()).optional(),
      corrections: z.record(z.any()).optional(),
    });

    const validated = requestSchema.parse(req.body);

    let request;

    switch (validated.requestType) {
      case "access":
        request = await gdprService.requestDataAccess(req.user!.id, req.user!.id);
        break;
      case "erasure":
        request = await gdprService.requestDataErasure(req.user!.id, req.user!.id, validated.details);
        break;
      case "portability":
        request = await gdprService.requestDataPortability(req.user!.id, req.user!.id);
        break;
      case "rectification":
        if (!validated.corrections) {
          return res.status(400).json({
            success: false,
            error: "Corrections are required for rectification requests",
          });
        }
        request = await gdprService.requestDataRectification(req.user!.id, validated.corrections, req.user!.id);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Request type ${validated.requestType} not yet implemented`,
        });
    }

    res.status(201).json({
      success: true,
      data: request,
      message: `Your ${validated.requestType} request has been submitted. We will respond within 30 days.`,
    });
  })
);

router.get(
  "/data-subject-request/:id",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const request = await gdprService.processDataSubjectRequest(id, req.user!.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: "Request not found",
      });
    }

    if (request.userId !== req.user!.id && req.user!.role !== "admin" && req.user!.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to view this request",
      });
    }

    res.json({
      success: true,
      data: request,
    });
  })
);

router.get(
  "/export-data",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const exportData = await gdprService.generateDataExport(req.user!.id);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="personal-data-export-${new Date().toISOString()}.json"`);
    
    res.json(exportData);
  })
);

// ============================================================================
// ADMIN ENDPOINTS - PROCESSING DATA SUBJECT REQUESTS
// ============================================================================

router.get(
  "/admin/data-subject-requests",
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const { status, requestType, dueBefore } = req.query;

    const requests = await gdprService.getOverdueRequests();

    res.json({
      success: true,
      data: requests,
    });
  })
);

router.post(
  "/admin/data-subject-request/:id/process",
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const processed = await gdprService.processDataSubjectRequest(id, req.user!.id);

    res.json({
      success: true,
      data: processed,
      message: `Data subject request ${processed.requestType} has been processed`,
    });
  })
);

router.get(
  "/admin/overdue-requests",
  requireStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const overdueRequests = await gdprService.getOverdueRequests();

    res.json({
      success: true,
      data: overdueRequests,
      count: overdueRequests.length,
    });
  })
);

// ============================================================================
// PRIVACY IMPACT ASSESSMENT ENDPOINTS (ADMIN ONLY)
// ============================================================================

router.post(
  "/admin/privacy-impact-assessment",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const piaSchema = z.object({
      assessmentName: z.string(),
      assessmentCode: z.string(),
      processingActivity: z.string(),
      description: z.string(),
      necessity: z.string(),
      proportionality: z.string(),
      riskLevel: z.enum(["low", "medium", "high", "critical"]),
      riskDescription: z.string(),
      risksIdentified: z.array(z.any()),
      impactOnRights: z.string(),
      mitigations: z.array(z.any()),
    });

    const validated = piaSchema.parse(req.body);

    const pia = await gdprService.createPIA({
      ...validated,
      assessorId: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: pia,
    });
  })
);

router.post(
  "/admin/privacy-impact-assessment/:id/review",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { approved, comments } = req.body;

    const reviewed = await gdprService.reviewPIA(id, req.user!.id, approved, comments);

    res.json({
      success: true,
      data: reviewed,
      message: `PIA ${approved ? "approved" : "rejected"}`,
    });
  })
);

// ============================================================================
// DATA BREACH MANAGEMENT ENDPOINTS (ADMIN ONLY)
// ============================================================================

router.post(
  "/admin/breach",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const breachSchema = z.object({
      incidentDate: z.string().transform(val => new Date(val)),
      discoveryDate: z.string().transform(val => new Date(val)),
      description: z.string(),
      natureOfBreach: z.string(),
      causeOfBreach: z.string().optional(),
      affectedUserIds: z.array(z.string()).optional(),
      dataTypes: z.array(z.string()),
      severity: z.enum(["low", "medium", "high", "critical"]),
      riskAssessment: z.string(),
      likelyConsequences: z.string().optional(),
      containmentActions: z.array(z.any()),
    });

    const validated = breachSchema.parse(req.body);

    const breach = await gdprService.reportBreach({
      ...validated,
      incidentOwner: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: breach,
      message: `Breach incident ${breach.incidentNumber} reported`,
    });
  })
);

router.post(
  "/admin/breach/:id/notify-users",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const notificationsSent = await gdprService.notifyAffectedUsers(id);

    res.json({
      success: true,
      data: { notificationsSent },
      message: `Notified ${notificationsSent} affected users`,
    });
  })
);

router.get(
  "/admin/breach/:id/report",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const report = await gdprService.generateBreachReport(id);

    res.json({
      success: true,
      data: report,
    });
  })
);

router.get(
  "/admin/unreported-breaches",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const unreported = await gdprService.checkUnreportedBreaches();

    res.json({
      success: true,
      data: unreported,
      count: unreported.length,
      warning: unreported.length > 0 ? "Some breaches require authority notification within 72 hours" : null,
    });
  })
);

// ============================================================================
// DATA PROCESSING ACTIVITIES REGISTER (PUBLIC/STAFF)
// ============================================================================

router.get(
  "/processing-activities",
  asyncHandler(async (req: Request, res: Response) => {
    const activities = await gdprService.getProcessingActivities({
      isActive: true,
    });

    res.json({
      success: true,
      data: activities,
    });
  })
);

router.post(
  "/admin/processing-activity",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const activitySchema = z.object({
      activityName: z.string(),
      activityCode: z.string(),
      purpose: z.string(),
      dataCategories: z.array(z.string()),
      legalBasis: z.string(),
      retentionPeriod: z.string(),
    });

    const validated = activitySchema.parse(req.body);

    const activity = await gdprService.createProcessingActivity({
      ...validated,
      responsiblePerson: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: activity,
    });
  })
);

export default router;
