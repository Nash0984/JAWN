import { db } from "../db";
import { 
  hipaaPhiAccessLogs,
  hipaaBusinessAssociateAgreements,
  hipaaRiskAssessments,
  hipaaSecurityIncidents,
  hipaaAuditLogs,
  type InsertHipaaPhiAccessLog,
  type InsertHipaaBusinessAssociateAgreement,
  type InsertHipaaRiskAssessment,
  type InsertHipaaSecurityIncident,
  type InsertHipaaAuditLog,
} from "@shared/schema";
import { eq, and, desc, gte, lte, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * HIPAA Compliance Service
 * 
 * Provides comprehensive HIPAA compliance management including:
 * - PHI Access Logging & Monitoring
 * - Business Associate Agreement (BAA) Tracking
 * - Security Risk Assessments (SRA)
 * - Security Incident Management
 * - Audit Trail & Compliance Reporting
 */
export class HipaaComplianceService {
  
  // ============================================================================
  // PHI ACCESS LOGGING
  // ============================================================================
  
  /**
   * Log PHI access - Required for HIPAA audit trail
   */
  async logPhiAccess(data: InsertHipaaPhiAccessLog) {
    const [log] = await db.insert(hipaaPhiAccessLogs).values(data).returning();
    return log;
  }

  /**
   * Get PHI access logs with filtering
   */
  async getPhiAccessLogs(params?: {
    userId?: string;
    patientId?: string;
    resourceType?: string;
    resourceId?: string;
    flaggedOnly?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    let query = db.select().from(hipaaPhiAccessLogs);

    const conditions = [];
    if (params?.userId) conditions.push(eq(hipaaPhiAccessLogs.userId, params.userId));
    if (params?.patientId) conditions.push(eq(hipaaPhiAccessLogs.patientId, params.patientId));
    if (params?.resourceType) conditions.push(eq(hipaaPhiAccessLogs.resourceType, params.resourceType));
    if (params?.resourceId) conditions.push(eq(hipaaPhiAccessLogs.resourceId, params.resourceId));
    if (params?.flaggedOnly) conditions.push(eq(hipaaPhiAccessLogs.flaggedForReview, true));
    if (params?.startDate) conditions.push(gte(hipaaPhiAccessLogs.accessedAt, params.startDate));
    if (params?.endDate) conditions.push(lte(hipaaPhiAccessLogs.accessedAt, params.endDate));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const logs = await query.orderBy(desc(hipaaPhiAccessLogs.accessedAt)).limit(params?.limit || 100);
    return logs;
  }

  /**
   * Flag PHI access for review
   */
  async flagPhiAccessForReview(logId: string, reason: string) {
    const [log] = await db
      .update(hipaaPhiAccessLogs)
      .set({ 
        flaggedForReview: true, 
        flagReason: reason 
      })
      .where(eq(hipaaPhiAccessLogs.id, logId))
      .returning();
    return log;
  }

  /**
   * Review flagged PHI access
   */
  async reviewPhiAccess(logId: string, reviewedBy: string) {
    const [log] = await db
      .update(hipaaPhiAccessLogs)
      .set({ 
        auditReviewed: true, 
        reviewedBy,
        reviewedAt: new Date()
      })
      .where(eq(hipaaPhiAccessLogs.id, logId))
      .returning();
    return log;
  }

  // ============================================================================
  // BUSINESS ASSOCIATE AGREEMENTS
  // ============================================================================
  
  /**
   * Create Business Associate Agreement
   */
  async createBusinessAssociateAgreement(data: Omit<InsertHipaaBusinessAssociateAgreement, 'agreementNumber'> & { agreementNumber?: string }) {
    const agreementNumber = data.agreementNumber || `BAA-${nanoid(10)}`;
    const [agreement] = await db
      .insert(hipaaBusinessAssociateAgreements)
      .values({ ...data, agreementNumber })
      .returning();
    return agreement;
  }

  /**
   * Get all Business Associate Agreements
   */
  async getBusinessAssociateAgreements(params?: {
    status?: string;
    expiringWithinDays?: number;
    auditDueWithinDays?: number;
  }) {
    let query = db.select().from(hipaaBusinessAssociateAgreements);

    const conditions = [];
    if (params?.status) {
      conditions.push(eq(hipaaBusinessAssociateAgreements.status, params.status));
    }
    if (params?.expiringWithinDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + params.expiringWithinDays);
      conditions.push(
        and(
          lte(hipaaBusinessAssociateAgreements.expirationDate, futureDate),
          gte(hipaaBusinessAssociateAgreements.expirationDate, new Date())
        )
      );
    }
    if (params?.auditDueWithinDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + params.auditDueWithinDays);
      conditions.push(
        and(
          lte(hipaaBusinessAssociateAgreements.nextAuditDue, futureDate),
          gte(hipaaBusinessAssociateAgreements.nextAuditDue, new Date())
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const agreements = await query.orderBy(desc(hipaaBusinessAssociateAgreements.createdAt));
    return agreements;
  }

  /**
   * Get Business Associate Agreement by ID
   */
  async getBusinessAssociateAgreementById(id: string) {
    const [agreement] = await db
      .select()
      .from(hipaaBusinessAssociateAgreements)
      .where(eq(hipaaBusinessAssociateAgreements.id, id));
    return agreement;
  }

  /**
   * Update Business Associate Agreement
   */
  async updateBusinessAssociateAgreement(id: string, data: Partial<InsertHipaaBusinessAssociateAgreement>) {
    const [agreement] = await db
      .update(hipaaBusinessAssociateAgreements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(hipaaBusinessAssociateAgreements.id, id))
      .returning();
    return agreement;
  }

  /**
   * Terminate Business Associate Agreement
   */
  async terminateBusinessAssociateAgreement(id: string, reason: string, updatedBy: string) {
    const [agreement] = await db
      .update(hipaaBusinessAssociateAgreements)
      .set({ 
        status: 'terminated',
        terminationDate: new Date(),
        terminationReason: reason,
        updatedBy,
        updatedAt: new Date()
      })
      .where(eq(hipaaBusinessAssociateAgreements.id, id))
      .returning();
    return agreement;
  }

  // ============================================================================
  // RISK ASSESSMENTS
  // ============================================================================
  
  /**
   * Create HIPAA Security Risk Assessment
   */
  async createRiskAssessment(data: Omit<InsertHipaaRiskAssessment, 'assessmentNumber'> & { assessmentNumber?: string }) {
    const assessmentNumber = data.assessmentNumber || `SRA-${nanoid(10)}`;
    const [assessment] = await db
      .insert(hipaaRiskAssessments)
      .values({ ...data, assessmentNumber })
      .returning();
    return assessment;
  }

  /**
   * Get all Risk Assessments
   */
  async getRiskAssessments(params?: {
    assessmentType?: string;
    riskLevel?: string;
    status?: string;
    reviewDueSoon?: boolean;
  }) {
    let query = db.select().from(hipaaRiskAssessments);

    const conditions = [];
    if (params?.assessmentType) {
      conditions.push(eq(hipaaRiskAssessments.assessmentType, params.assessmentType));
    }
    if (params?.riskLevel) {
      conditions.push(eq(hipaaRiskAssessments.riskLevel, params.riskLevel));
    }
    if (params?.status) {
      conditions.push(eq(hipaaRiskAssessments.status, params.status));
    }
    if (params?.reviewDueSoon) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      conditions.push(lte(hipaaRiskAssessments.nextReviewDue, futureDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const assessments = await query.orderBy(desc(hipaaRiskAssessments.assessmentDate));
    return assessments;
  }

  /**
   * Get Risk Assessment by ID
   */
  async getRiskAssessmentById(id: string) {
    const [assessment] = await db
      .select()
      .from(hipaaRiskAssessments)
      .where(eq(hipaaRiskAssessments.id, id));
    return assessment;
  }

  /**
   * Update Risk Assessment
   */
  async updateRiskAssessment(id: string, data: Partial<InsertHipaaRiskAssessment>) {
    const [assessment] = await db
      .update(hipaaRiskAssessments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(hipaaRiskAssessments.id, id))
      .returning();
    return assessment;
  }

  /**
   * Approve Risk Assessment
   */
  async approveRiskAssessment(id: string, approvedBy: string) {
    const [assessment] = await db
      .update(hipaaRiskAssessments)
      .set({ 
        status: 'approved',
        approvedBy,
        approvalDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(hipaaRiskAssessments.id, id))
      .returning();
    return assessment;
  }

  // ============================================================================
  // SECURITY INCIDENTS
  // ============================================================================
  
  /**
   * Create Security Incident
   */
  async createSecurityIncident(data: Omit<InsertHipaaSecurityIncident, 'incidentNumber'> & { incidentNumber?: string }) {
    const incidentNumber = data.incidentNumber || `INC-${nanoid(10)}`;
    const [incident] = await db
      .insert(hipaaSecurityIncidents)
      .values({ ...data, incidentNumber })
      .returning();
    return incident;
  }

  /**
   * Get all Security Incidents
   */
  async getSecurityIncidents(params?: {
    incidentType?: string;
    severity?: string;
    status?: string;
    breachThresholdMet?: boolean;
    phiInvolved?: boolean;
    startDate?: Date;
    endDate?: Date;
  }) {
    let query = db.select().from(hipaaSecurityIncidents);

    const conditions = [];
    if (params?.incidentType) {
      conditions.push(eq(hipaaSecurityIncidents.incidentType, params.incidentType));
    }
    if (params?.severity) {
      conditions.push(eq(hipaaSecurityIncidents.severity, params.severity));
    }
    if (params?.status) {
      conditions.push(eq(hipaaSecurityIncidents.status, params.status));
    }
    if (params?.breachThresholdMet !== undefined) {
      conditions.push(eq(hipaaSecurityIncidents.breachThresholdMet, params.breachThresholdMet));
    }
    if (params?.phiInvolved !== undefined) {
      conditions.push(eq(hipaaSecurityIncidents.phiInvolved, params.phiInvolved));
    }
    if (params?.startDate) {
      conditions.push(gte(hipaaSecurityIncidents.incidentDate, params.startDate));
    }
    if (params?.endDate) {
      conditions.push(lte(hipaaSecurityIncidents.incidentDate, params.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const incidents = await query.orderBy(desc(hipaaSecurityIncidents.discoveryDate));
    return incidents;
  }

  /**
   * Get Security Incident by ID
   */
  async getSecurityIncidentById(id: string) {
    const [incident] = await db
      .select()
      .from(hipaaSecurityIncidents)
      .where(eq(hipaaSecurityIncidents.id, id));
    return incident;
  }

  /**
   * Update Security Incident
   */
  async updateSecurityIncident(id: string, data: Partial<InsertHipaaSecurityIncident>) {
    const [incident] = await db
      .update(hipaaSecurityIncidents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(hipaaSecurityIncidents.id, id))
      .returning();
    return incident;
  }

  /**
   * Close Security Incident
   */
  async closeSecurityIncident(id: string, closedBy: string, lessonsLearned?: string) {
    const [incident] = await db
      .update(hipaaSecurityIncidents)
      .set({ 
        status: 'closed',
        closedBy,
        closedDate: new Date(),
        lessonsLearned,
        updatedAt: new Date()
      })
      .where(eq(hipaaSecurityIncidents.id, id))
      .returning();
    return incident;
  }

  // ============================================================================
  // AUDIT LOGS
  // ============================================================================
  
  /**
   * Create audit log entry
   */
  async createAuditLog(data: InsertHipaaAuditLog) {
    const [log] = await db.insert(hipaaAuditLogs).values(data).returning();
    return log;
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(params?: {
    userId?: string;
    action?: string;
    actionCategory?: string;
    resourceType?: string;
    resourceId?: string;
    phiAccessed?: boolean;
    securityRelevant?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    let query = db.select().from(hipaaAuditLogs);

    const conditions = [];
    if (params?.userId) conditions.push(eq(hipaaAuditLogs.userId, params.userId));
    if (params?.action) conditions.push(eq(hipaaAuditLogs.action, params.action));
    if (params?.actionCategory) conditions.push(eq(hipaaAuditLogs.actionCategory, params.actionCategory));
    if (params?.resourceType) conditions.push(eq(hipaaAuditLogs.resourceType, params.resourceType));
    if (params?.resourceId) conditions.push(eq(hipaaAuditLogs.resourceId, params.resourceId));
    if (params?.phiAccessed !== undefined) conditions.push(eq(hipaaAuditLogs.phiAccessed, params.phiAccessed));
    if (params?.securityRelevant !== undefined) conditions.push(eq(hipaaAuditLogs.securityRelevant, params.securityRelevant));
    if (params?.startDate) conditions.push(gte(hipaaAuditLogs.timestamp, params.startDate));
    if (params?.endDate) conditions.push(lte(hipaaAuditLogs.timestamp, params.endDate));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const logs = await query.orderBy(desc(hipaaAuditLogs.timestamp)).limit(params?.limit || 500);
    return logs;
  }

  // ============================================================================
  // COMPLIANCE REPORTING
  // ============================================================================
  
  /**
   * Get HIPAA compliance dashboard metrics
   */
  async getComplianceDashboard() {
    const [phiAccessCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(hipaaPhiAccessLogs);

    const [flaggedAccessCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(hipaaPhiAccessLogs)
      .where(eq(hipaaPhiAccessLogs.flaggedForReview, true));

    const [activeBAAs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(hipaaBusinessAssociateAgreements)
      .where(eq(hipaaBusinessAssociateAgreements.status, 'active'));

    const [openIncidents] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(hipaaSecurityIncidents)
      .where(eq(hipaaSecurityIncidents.status, 'open'));

    const [breachIncidents] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(hipaaSecurityIncidents)
      .where(eq(hipaaSecurityIncidents.breachThresholdMet, true));

    const [riskAssessments] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(hipaaRiskAssessments);

    return {
      phiAccessLogs: {
        total: phiAccessCount.count,
        flagged: flaggedAccessCount.count
      },
      businessAssociates: {
        active: activeBAAs.count
      },
      securityIncidents: {
        open: openIncidents.count,
        breaches: breachIncidents.count
      },
      riskAssessments: {
        total: riskAssessments.count
      }
    };
  }
}

export const hipaaService = new HipaaComplianceService();
