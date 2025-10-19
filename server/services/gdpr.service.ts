import { db } from "../db";
import { eq, and, or, lte, gte, desc, sql } from "drizzle-orm";
import {
  gdprConsents,
  gdprDataSubjectRequests,
  gdprDataProcessingActivities,
  gdprPrivacyImpactAssessments,
  gdprBreachIncidents,
  users,
  documents,
  clientCases,
  householdProfiles,
  vitaIntakeSessions,
  federalTaxReturns,
  marylandTaxReturns,
  taxDocuments,
  auditLogs,
  userConsents,
  type GdprConsent,
  type InsertGdprConsent,
  type GdprDataSubjectRequest,
  type InsertGdprDataSubjectRequest,
  type GdprDataProcessingActivity,
  type InsertGdprDataProcessingActivity,
  type GdprPrivacyImpactAssessment,
  type InsertGdprPrivacyImpactAssessment,
  type GdprBreachIncident,
  type InsertGdprBreachIncident,
} from "@shared/schema";
import { emailService } from "./email.service";
import { auditService } from "./auditService";
import { nanoid } from "nanoid";

export class GdprService {
  // ============================================================================
  // CONSENT MANAGEMENT
  // ============================================================================

  async recordConsent(data: {
    userId: string;
    purpose: string;
    consentGiven: boolean;
    ipAddress?: string;
    userAgent?: string;
    consentMethod: string;
    consentText?: string;
    expiresAt?: Date;
  }): Promise<GdprConsent> {
    const consent: InsertGdprConsent = {
      userId: data.userId,
      purpose: data.purpose,
      consentGiven: data.consentGiven,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      consentMethod: data.consentMethod,
      consentText: data.consentText,
      expiresAt: data.expiresAt,
    };

    const [created] = await db.insert(gdprConsents).values(consent).returning();

    await auditService.logAction({
      userId: data.userId,
      action: data.consentGiven ? "consent_granted" : "consent_denied",
      resource: "gdpr_consent",
      resourceId: created.id,
      details: { purpose: data.purpose },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      sensitiveDataAccessed: false,
    });

    return created;
  }

  async withdrawConsent(
    userId: string,
    purpose: string,
    reason?: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<GdprConsent> {
    const activeConsents = await db
      .select()
      .from(gdprConsents)
      .where(
        and(
          eq(gdprConsents.userId, userId),
          eq(gdprConsents.purpose, purpose),
          eq(gdprConsents.consentGiven, true),
          sql`${gdprConsents.withdrawnAt} IS NULL`
        )
      )
      .orderBy(desc(gdprConsents.consentDate))
      .limit(1);

    if (activeConsents.length === 0) {
      throw new Error(`No active consent found for purpose: ${purpose}`);
    }

    const [withdrawn] = await db
      .update(gdprConsents)
      .set({
        withdrawnAt: new Date(),
        withdrawalReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(gdprConsents.id, activeConsents[0].id))
      .returning();

    await auditService.logAction({
      userId,
      action: "consent_withdrawn",
      resource: "gdpr_consent",
      resourceId: withdrawn.id,
      details: { purpose, reason },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      sensitiveDataAccessed: false,
    });

    return withdrawn;
  }

  async checkConsentStatus(userId: string, purpose: string): Promise<{
    hasConsent: boolean;
    consent?: GdprConsent;
    expired: boolean;
  }> {
    const consents = await db
      .select()
      .from(gdprConsents)
      .where(
        and(
          eq(gdprConsents.userId, userId),
          eq(gdprConsents.purpose, purpose),
          eq(gdprConsents.consentGiven, true),
          sql`${gdprConsents.withdrawnAt} IS NULL`
        )
      )
      .orderBy(desc(gdprConsents.consentDate))
      .limit(1);

    if (consents.length === 0) {
      return { hasConsent: false, expired: false };
    }

    const consent = consents[0];
    const expired = consent.expiresAt ? new Date() > consent.expiresAt : false;

    return {
      hasConsent: !expired,
      consent,
      expired,
    };
  }

  async getConsentHistory(userId: string): Promise<GdprConsent[]> {
    return await db
      .select()
      .from(gdprConsents)
      .where(eq(gdprConsents.userId, userId))
      .orderBy(desc(gdprConsents.consentDate));
  }

  // ============================================================================
  // DATA SUBJECT RIGHTS HANDLERS
  // ============================================================================

  async requestDataAccess(userId: string, requestedBy?: string): Promise<GdprDataSubjectRequest> {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const verificationToken = nanoid(32);

    const request: InsertGdprDataSubjectRequest = {
      userId,
      requestedBy: requestedBy || userId,
      requestType: "access",
      status: "pending",
      dueDate,
      verificationToken,
      requestDetails: { requestedAt: new Date().toISOString() },
    };

    const [created] = await db.insert(gdprDataSubjectRequests).values(request).returning();

    await auditService.logAction({
      userId,
      action: "data_access_requested",
      resource: "gdpr_data_subject_request",
      resourceId: created.id,
      details: { requestType: "access" },
      sensitiveDataAccessed: false,
    });

    return created;
  }

  async requestDataErasure(
    userId: string,
    requestedBy?: string,
    details?: Record<string, any>
  ): Promise<GdprDataSubjectRequest> {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const verificationToken = nanoid(32);

    const request: InsertGdprDataSubjectRequest = {
      userId,
      requestedBy: requestedBy || userId,
      requestType: "erasure",
      status: "pending",
      dueDate,
      verificationToken,
      requestDetails: { ...details, requestedAt: new Date().toISOString() },
    };

    const [created] = await db.insert(gdprDataSubjectRequests).values(request).returning();

    await auditService.logAction({
      userId,
      action: "data_erasure_requested",
      resource: "gdpr_data_subject_request",
      resourceId: created.id,
      details: { requestType: "erasure" },
      sensitiveDataAccessed: false,
    });

    return created;
  }

  async requestDataPortability(userId: string, requestedBy?: string): Promise<GdprDataSubjectRequest> {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const verificationToken = nanoid(32);

    const request: InsertGdprDataSubjectRequest = {
      userId,
      requestedBy: requestedBy || userId,
      requestType: "portability",
      status: "pending",
      dueDate,
      verificationToken,
      requestDetails: { requestedAt: new Date().toISOString() },
    };

    const [created] = await db.insert(gdprDataSubjectRequests).values(request).returning();

    await auditService.logAction({
      userId,
      action: "data_portability_requested",
      resource: "gdpr_data_subject_request",
      resourceId: created.id,
      details: { requestType: "portability" },
      sensitiveDataAccessed: false,
    });

    return created;
  }

  async requestDataRectification(
    userId: string,
    corrections: Record<string, any>,
    requestedBy?: string
  ): Promise<GdprDataSubjectRequest> {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const verificationToken = nanoid(32);

    const request: InsertGdprDataSubjectRequest = {
      userId,
      requestedBy: requestedBy || userId,
      requestType: "rectification",
      status: "pending",
      dueDate,
      verificationToken,
      requestDetails: { corrections, requestedAt: new Date().toISOString() },
    };

    const [created] = await db.insert(gdprDataSubjectRequests).values(request).returning();

    await auditService.logAction({
      userId,
      action: "data_rectification_requested",
      resource: "gdpr_data_subject_request",
      resourceId: created.id,
      details: { requestType: "rectification", corrections },
      sensitiveDataAccessed: false,
    });

    return created;
  }

  async generateDataExport(userId: string): Promise<Record<string, any>> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error("User not found");
    }

    const userDocuments = await db.select().from(documents).where(eq(documents.uploadedBy, userId));
    const userCases = await db.select().from(clientCases).where(eq(clientCases.userId, userId));
    const userHouseholds = await db.select().from(householdProfiles).where(eq(householdProfiles.userId, userId));
    const userVitaSessions = await db.select().from(vitaIntakeSessions).where(eq(vitaIntakeSessions.userId, userId));
    const userFederalReturns = await db.select().from(federalTaxReturns).where(eq(federalTaxReturns.preparerId, userId));
    const userMarylandReturns = await db.select().from(marylandTaxReturns);
    const userTaxDocuments = await db.select().from(taxDocuments);
    const userAuditLogs = await db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).limit(1000);
    const userConsentHistory = await this.getConsentHistory(userId);

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportFormat: "JSON",
      userId: user.id,
      personalInformation: {
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      documents: userDocuments.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        uploadedAt: doc.createdAt,
        status: doc.status,
      })),
      cases: userCases,
      households: userHouseholds,
      vitaSessions: userVitaSessions,
      taxReturns: {
        federal: userFederalReturns,
        maryland: userMarylandReturns,
      },
      taxDocuments: userTaxDocuments,
      consents: userConsentHistory,
      activityLog: userAuditLogs.map(log => ({
        action: log.action,
        resource: log.resource,
        timestamp: log.timestamp,
        ipAddress: log.ipAddress,
      })),
      dataExportMetadata: {
        totalRecords: {
          documents: userDocuments.length,
          cases: userCases.length,
          households: userHouseholds.length,
          vitaSessions: userVitaSessions.length,
          taxReturns: userFederalReturns.length + userMarylandReturns.length,
          auditLogs: userAuditLogs.length,
        },
      },
    };

    await auditService.logAction({
      userId,
      action: "data_export_generated",
      resource: "user_data",
      resourceId: userId,
      details: { recordCount: Object.keys(exportData).length },
      sensitiveDataAccessed: true,
    });

    return exportData;
  }

  async processDataSubjectRequest(requestId: string, handledBy: string): Promise<GdprDataSubjectRequest> {
    const [request] = await db
      .select()
      .from(gdprDataSubjectRequests)
      .where(eq(gdprDataSubjectRequests.id, requestId));

    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status === "completed") {
      throw new Error("Request already completed");
    }

    const [updated] = await db
      .update(gdprDataSubjectRequests)
      .set({
        status: "in_progress",
        handledBy,
        updatedAt: new Date(),
      })
      .where(eq(gdprDataSubjectRequests.id, requestId))
      .returning();

    let responseData: any = null;

    switch (request.requestType) {
      case "access":
      case "portability":
        responseData = await this.generateDataExport(request.userId);
        break;

      case "erasure":
        const legalHolds = await this.checkLegalHolds(request.userId);
        if (legalHolds.length > 0) {
          throw new Error(`Cannot delete data: ${legalHolds.length} legal hold(s) active`);
        }
        await this.anonymizeUserData(request.userId);
        responseData = { anonymized: true, timestamp: new Date().toISOString() };
        break;

      case "rectification":
        const corrections = request.requestDetails?.corrections;
        if (corrections) {
          await db.update(users).set({ ...corrections, updatedAt: new Date() }).where(eq(users.id, request.userId));
          responseData = { corrected: true, fields: Object.keys(corrections) };
        }
        break;
    }

    const [completed] = await db
      .update(gdprDataSubjectRequests)
      .set({
        status: "completed",
        completedDate: new Date(),
        responseData,
        updatedAt: new Date(),
      })
      .where(eq(gdprDataSubjectRequests.id, requestId))
      .returning();

    await auditService.logAction({
      userId: handledBy,
      action: "data_subject_request_processed",
      resource: "gdpr_data_subject_request",
      resourceId: requestId,
      details: { requestType: request.requestType, subjectUserId: request.userId },
      sensitiveDataAccessed: true,
    });

    const [user] = await db.select().from(users).where(eq(users.id, request.userId));
    if (user?.email) {
      await emailService.sendEmail({
        to: user.email,
        subject: `Your Data ${request.requestType} Request Has Been Processed`,
        template: "gdpr_request_completed",
        data: {
          requestType: request.requestType,
          completedDate: completed.completedDate,
          requestId: completed.id,
        },
      });
    }

    return completed;
  }

  private async checkLegalHolds(userId: string): Promise<string[]> {
    const holds: string[] = [];

    const activeCases = await db
      .select()
      .from(clientCases)
      .where(
        and(
          eq(clientCases.userId, userId),
          or(eq(clientCases.status, "active"), eq(clientCases.status, "pending"))
        )
      );

    if (activeCases.length > 0) {
      holds.push("Active benefit cases require data retention");
    }

    const recentTaxReturns = await db
      .select()
      .from(federalTaxReturns)
      .where(eq(federalTaxReturns.preparerId, userId));

    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    const recentReturns = recentTaxReturns.filter(
      ret => ret.createdAt && ret.createdAt > sevenYearsAgo
    );

    if (recentReturns.length > 0) {
      holds.push("Tax records must be retained for 7 years (IRS requirement)");
    }

    return holds;
  }

  private async anonymizeUserData(userId: string): Promise<void> {
    const anonymizedEmail = `deleted_${nanoid(10)}@anonymized.local`;
    const anonymizedName = `Deleted User ${nanoid(6)}`;

    await db
      .update(users)
      .set({
        email: anonymizedEmail,
        fullName: anonymizedName,
        phone: null,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await auditService.logAction({
      userId: "system",
      action: "user_data_anonymized",
      resource: "user",
      resourceId: userId,
      details: { reason: "GDPR erasure request" },
      sensitiveDataAccessed: true,
    });
  }

  async getOverdueRequests(): Promise<GdprDataSubjectRequest[]> {
    const now = new Date();
    return await db
      .select()
      .from(gdprDataSubjectRequests)
      .where(
        and(
          lte(gdprDataSubjectRequests.dueDate, now),
          or(
            eq(gdprDataSubjectRequests.status, "pending"),
            eq(gdprDataSubjectRequests.status, "in_progress")
          )
        )
      )
      .orderBy(gdprDataSubjectRequests.dueDate);
  }

  async sendRequestReminder(requestId: string): Promise<void> {
    const [request] = await db
      .select()
      .from(gdprDataSubjectRequests)
      .where(eq(gdprDataSubjectRequests.id, requestId));

    if (!request || request.status === "completed") {
      return;
    }

    const remindersSent = request.remindersSent || 0;

    await db
      .update(gdprDataSubjectRequests)
      .set({
        remindersSent: remindersSent + 1,
        lastReminderAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(gdprDataSubjectRequests.id, requestId));

    if (request.handledBy) {
      const [handler] = await db.select().from(users).where(eq(users.id, request.handledBy));
      if (handler?.email) {
        await emailService.sendEmail({
          to: handler.email,
          subject: `Reminder: GDPR Request Due Soon`,
          template: "gdpr_request_reminder",
          data: {
            requestId: request.id,
            requestType: request.requestType,
            dueDate: request.dueDate,
            daysRemaining: Math.ceil((request.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          },
        });
      }
    }
  }

  // ============================================================================
  // PRIVACY IMPACT ASSESSMENTS (PIA)
  // ============================================================================

  async createPIA(data: {
    assessmentName: string;
    assessmentCode: string;
    processingActivity: string;
    description: string;
    necessity: string;
    proportionality: string;
    riskLevel: string;
    riskDescription: string;
    risksIdentified: any[];
    impactOnRights: string;
    mitigations: any[];
    assessorId: string;
  }): Promise<GdprPrivacyImpactAssessment> {
    const pia: InsertGdprPrivacyImpactAssessment = {
      ...data,
      assessmentDate: new Date(),
      status: "draft",
    };

    const [created] = await db.insert(gdprPrivacyImpactAssessments).values(pia).returning();

    await auditService.logAction({
      userId: data.assessorId,
      action: "pia_created",
      resource: "gdpr_privacy_impact_assessment",
      resourceId: created.id,
      details: { assessmentName: data.assessmentName, riskLevel: data.riskLevel },
      sensitiveDataAccessed: false,
    });

    return created;
  }

  async reviewPIA(piaId: string, reviewedBy: string, approved: boolean, comments?: string): Promise<GdprPrivacyImpactAssessment> {
    const [pia] = await db
      .select()
      .from(gdprPrivacyImpactAssessments)
      .where(eq(gdprPrivacyImpactAssessments.id, piaId));

    if (!pia) {
      throw new Error("PIA not found");
    }

    const nextReviewDue = new Date();
    nextReviewDue.setFullYear(nextReviewDue.getFullYear() + 1);

    const [updated] = await db
      .update(gdprPrivacyImpactAssessments)
      .set({
        status: approved ? "approved" : "rejected",
        approvedBy: reviewedBy,
        approvalDate: new Date(),
        reviewDate: new Date(),
        nextReviewDue: approved ? nextReviewDue : undefined,
        dpoReviewed: true,
        dpoComments: comments,
        updatedAt: new Date(),
      })
      .where(eq(gdprPrivacyImpactAssessments.id, piaId))
      .returning();

    await auditService.logAction({
      userId: reviewedBy,
      action: approved ? "pia_approved" : "pia_rejected",
      resource: "gdpr_privacy_impact_assessment",
      resourceId: piaId,
      details: { assessmentName: pia.assessmentName, comments },
      sensitiveDataAccessed: false,
    });

    return updated;
  }

  // ============================================================================
  // DATA BREACH MANAGEMENT
  // ============================================================================

  async reportBreach(data: {
    incidentDate: Date;
    discoveryDate: Date;
    description: string;
    natureOfBreach: string;
    causeOfBreach?: string;
    affectedUserIds?: string[];
    dataTypes: string[];
    severity: string;
    riskAssessment: string;
    likelyConsequences?: string;
    containmentActions: any[];
    incidentOwner: string;
  }): Promise<GdprBreachIncident> {
    const incidentNumber = `BREACH-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;

    const breach: InsertGdprBreachIncident = {
      ...data,
      incidentNumber,
      affectedUsers: data.affectedUserIds?.length || 0,
      status: "open",
    };

    const [created] = await db.insert(gdprBreachIncidents).values(breach).returning();

    await auditService.logAction({
      userId: data.incidentOwner,
      action: "data_breach_reported",
      resource: "gdpr_breach_incident",
      resourceId: created.id,
      details: {
        incidentNumber,
        severity: data.severity,
        affectedUsers: data.affectedUserIds?.length || 0,
      },
      sensitiveDataAccessed: true,
    });

    if (data.severity === "high" || data.severity === "critical") {
      await this.notifyBreachIncidentOwner(created.id);
    }

    return created;
  }

  async notifyAffectedUsers(breachId: string): Promise<number> {
    const [breach] = await db
      .select()
      .from(gdprBreachIncidents)
      .where(eq(gdprBreachIncidents.id, breachId));

    if (!breach) {
      throw new Error("Breach incident not found");
    }

    if (!breach.affectedUserIds || breach.affectedUserIds.length === 0) {
      throw new Error("No affected users identified");
    }

    const affectedUsers = await db
      .select()
      .from(users)
      .where(sql`${users.id} = ANY(${breach.affectedUserIds})`);

    let notificationsSent = 0;

    for (const user of affectedUsers) {
      if (user.email) {
        try {
          await emailService.sendEmail({
            to: user.email,
            subject: "Important: Data Security Incident Notification",
            template: "data_breach_notification",
            data: {
              incidentNumber: breach.incidentNumber,
              incidentDate: breach.incidentDate,
              description: breach.description,
              dataTypes: breach.dataTypes,
              mitigationMeasures: breach.mitigationMeasures,
              contactInfo: "privacy@mdbenefits.gov",
            },
          });
          notificationsSent++;
        } catch (error) {
          console.error(`Failed to notify user ${user.id}:`, error);
        }
      }
    }

    await db
      .update(gdprBreachIncidents)
      .set({
        notificationsSent: true,
        userNotificationDate: new Date(),
        userNotificationMethod: "email",
        updatedAt: new Date(),
      })
      .where(eq(gdprBreachIncidents.id, breachId));

    await auditService.logAction({
      userId: "system",
      action: "breach_users_notified",
      resource: "gdpr_breach_incident",
      resourceId: breachId,
      details: { notificationsSent, totalAffected: affectedUsers.length },
      sensitiveDataAccessed: false,
    });

    return notificationsSent;
  }

  async generateBreachReport(breachId: string): Promise<Record<string, any>> {
    const [breach] = await db
      .select()
      .from(gdprBreachIncidents)
      .where(eq(gdprBreachIncidents.id, breachId));

    if (!breach) {
      throw new Error("Breach incident not found");
    }

    const [incidentOwner] = await db.select().from(users).where(eq(users.id, breach.incidentOwner));

    const timeTo72Hours = breach.reportedToAuthorityDate
      ? (breach.reportedToAuthorityDate.getTime() - breach.discoveryDate.getTime()) / (1000 * 60 * 60)
      : null;

    const report = {
      incidentNumber: breach.incidentNumber,
      reportGeneratedAt: new Date().toISOString(),
      incidentSummary: {
        incidentDate: breach.incidentDate,
        discoveryDate: breach.discoveryDate,
        reportedDate: breach.reportedDate,
        description: breach.description,
        natureOfBreach: breach.natureOfBreach,
        causeOfBreach: breach.causeOfBreach,
      },
      impactAssessment: {
        affectedUsers: breach.affectedUsers,
        dataTypes: breach.dataTypes,
        dataVolume: breach.dataVolume,
        severity: breach.severity,
        riskAssessment: breach.riskAssessment,
        likelyConsequences: breach.likelyConsequences,
      },
      responseActions: {
        containmentActions: breach.containmentActions,
        containmentDate: breach.containmentDate,
        mitigationMeasures: breach.mitigationMeasures,
      },
      notifications: {
        usersNotified: breach.notificationsSent,
        userNotificationDate: breach.userNotificationDate,
        userNotificationMethod: breach.userNotificationMethod,
        reportedToAuthority: breach.reportedToAuthority,
        authorityName: breach.authorityName,
        authorityReferenceNumber: breach.authorityReferenceNumber,
        reportedToAuthorityDate: breach.reportedToAuthorityDate,
        reportWithin72Hours: breach.reportWithin72Hours,
        actualTimeToReport: timeTo72Hours ? `${timeTo72Hours.toFixed(1)} hours` : "N/A",
        delayJustification: breach.delayJustification,
      },
      responsibleParties: {
        incidentOwner: incidentOwner?.fullName || "Unknown",
        investigatedBy: breach.investigatedBy,
      },
      status: breach.status,
      lessonsLearned: breach.lessonsLearned,
      preventiveMeasures: breach.preventiveMeasures,
    };

    await auditService.logAction({
      userId: "system",
      action: "breach_report_generated",
      resource: "gdpr_breach_incident",
      resourceId: breachId,
      details: { incidentNumber: breach.incidentNumber },
      sensitiveDataAccessed: true,
    });

    return report;
  }

  async checkUnreportedBreaches(): Promise<GdprBreachIncident[]> {
    const seventyTwoHoursAgo = new Date();
    seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);

    return await db
      .select()
      .from(gdprBreachIncidents)
      .where(
        and(
          eq(gdprBreachIncidents.reportedToAuthority, false),
          lte(gdprBreachIncidents.discoveryDate, seventyTwoHoursAgo),
          or(
            eq(gdprBreachIncidents.severity, "high"),
            eq(gdprBreachIncidents.severity, "critical")
          )
        )
      );
  }

  private async notifyBreachIncidentOwner(breachId: string): Promise<void> {
    const [breach] = await db
      .select()
      .from(gdprBreachIncidents)
      .where(eq(gdprBreachIncidents.id, breachId));

    if (!breach) return;

    const [owner] = await db.select().from(users).where(eq(users.id, breach.incidentOwner));

    if (owner?.email) {
      await emailService.sendEmail({
        to: owner.email,
        subject: `URGENT: Data Breach Incident ${breach.incidentNumber}`,
        template: "breach_owner_notification",
        data: {
          incidentNumber: breach.incidentNumber,
          severity: breach.severity,
          discoveryDate: breach.discoveryDate,
          affectedUsers: breach.affectedUsers,
          requiresAuthorityNotification: breach.severity === "high" || breach.severity === "critical",
        },
      });
    }
  }

  // ============================================================================
  // DATA PROCESSING ACTIVITIES REGISTER
  // ============================================================================

  async createProcessingActivity(data: {
    activityName: string;
    activityCode: string;
    purpose: string;
    dataCategories: string[];
    legalBasis: string;
    retentionPeriod: string;
    responsiblePerson: string;
  }): Promise<GdprDataProcessingActivity> {
    const activity: InsertGdprDataProcessingActivity = {
      ...data,
    };

    const [created] = await db.insert(gdprDataProcessingActivities).values(activity).returning();

    await auditService.logAction({
      userId: data.responsiblePerson,
      action: "processing_activity_created",
      resource: "gdpr_data_processing_activity",
      resourceId: created.id,
      details: { activityName: data.activityName, legalBasis: data.legalBasis },
      sensitiveDataAccessed: false,
    });

    return created;
  }

  async getProcessingActivities(filters?: {
    isActive?: boolean;
    crossBorderTransfer?: boolean;
  }): Promise<GdprDataProcessingActivity[]> {
    let query = db.select().from(gdprDataProcessingActivities);

    const conditions = [];
    if (filters?.isActive !== undefined) {
      conditions.push(eq(gdprDataProcessingActivities.isActive, filters.isActive));
    }
    if (filters?.crossBorderTransfer !== undefined) {
      conditions.push(eq(gdprDataProcessingActivities.crossBorderTransfer, filters.crossBorderTransfer));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(gdprDataProcessingActivities.activityName);
  }
}

export const gdprService = new GdprService();
