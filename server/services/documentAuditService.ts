/**
 * Document Audit Service
 * Track all access and modifications to VITA tax documents
 */

import { db } from "../db";
import { vitaDocumentAudit, type InsertVitaDocumentAudit } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface AuditLogParams {
  documentRequestId: string;
  vitaSessionId: string;
  action: 'uploaded' | 'downloaded' | 'viewed' | 'replaced' | 'approved' | 'rejected' | 'deleted' | 'modified';
  userId: string;
  userRole: string;
  userName: string;
  actionDetails?: any;
  ipAddress?: string;
  userAgent?: string;
  objectPath?: string;
  signedUrlGenerated?: boolean;
  signedUrlExpiry?: Date;
  previousStatus?: string;
  newStatus?: string;
  changeReason?: string;
}

class DocumentAuditService {
  /**
   * Log a document action to the audit trail
   */
  async logAction(params: AuditLogParams): Promise<void> {
    try {
      await db.insert(vitaDocumentAudit).values({
        documentRequestId: params.documentRequestId,
        vitaSessionId: params.vitaSessionId,
        action: params.action,
        actionDetails: params.actionDetails || null,
        userId: params.userId,
        userRole: params.userRole,
        userName: params.userName,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        objectPath: params.objectPath || null,
        signedUrlGenerated: params.signedUrlGenerated || false,
        signedUrlExpiry: params.signedUrlExpiry || null,
        previousStatus: params.previousStatus || null,
        newStatus: params.newStatus || null,
        changeReason: params.changeReason || null,
      });
    } catch (error) {
      console.error('Failed to log document audit action:', error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Get audit trail for a specific document
   */
  async getDocumentAuditTrail(documentRequestId: string) {
    try {
      return await db
        .select()
        .from(vitaDocumentAudit)
        .where(eq(vitaDocumentAudit.documentRequestId, documentRequestId))
        .orderBy(desc(vitaDocumentAudit.createdAt));
    } catch (error) {
      console.error('Failed to retrieve document audit trail:', error);
      return [];
    }
  }

  /**
   * Get audit trail for an entire session
   */
  async getSessionAuditTrail(vitaSessionId: string) {
    try {
      return await db
        .select()
        .from(vitaDocumentAudit)
        .where(eq(vitaDocumentAudit.vitaSessionId, vitaSessionId))
        .orderBy(desc(vitaDocumentAudit.createdAt));
    } catch (error) {
      console.error('Failed to retrieve session audit trail:', error);
      return [];
    }
  }

  /**
   * Get all downloads for a document (security audit)
   */
  async getDocumentDownloads(documentRequestId: string) {
    try {
      return await db
        .select()
        .from(vitaDocumentAudit)
        .where(
          and(
            eq(vitaDocumentAudit.documentRequestId, documentRequestId),
            eq(vitaDocumentAudit.action, 'downloaded')
          )
        )
        .orderBy(desc(vitaDocumentAudit.createdAt));
    } catch (error) {
      console.error('Failed to retrieve document downloads:', error);
      return [];
    }
  }

  /**
   * Check if a user has accessed a document recently
   */
  async hasRecentAccess(
    documentRequestId: string,
    userId: string,
    withinMinutes: number = 60
  ): Promise<boolean> {
    try {
      const recentDate = new Date(Date.now() - withinMinutes * 60 * 1000);
      
      const results = await db
        .select()
        .from(vitaDocumentAudit)
        .where(
          and(
            eq(vitaDocumentAudit.documentRequestId, documentRequestId),
            eq(vitaDocumentAudit.userId, userId)
          )
        )
        .orderBy(desc(vitaDocumentAudit.createdAt))
        .limit(1);

      return results.length > 0 && results[0].createdAt >= recentDate;
    } catch (error) {
      console.error('Failed to check recent access:', error);
      return false;
    }
  }

  /**
   * Get summary statistics for a document
   */
  async getDocumentStats(documentRequestId: string) {
    try {
      const trail = await this.getDocumentAuditTrail(documentRequestId);
      
      return {
        totalActions: trail.length,
        downloadCount: trail.filter(entry => entry.action === 'downloaded').length,
        viewCount: trail.filter(entry => entry.action === 'viewed').length,
        modificationCount: trail.filter(entry => entry.action === 'modified' || entry.action === 'replaced').length,
        uniqueUsers: new Set(trail.map(entry => entry.userId)).size,
        firstAccessed: trail.length > 0 ? trail[trail.length - 1].createdAt : null,
        lastAccessed: trail.length > 0 ? trail[0].createdAt : null,
      };
    } catch (error) {
      console.error('Failed to get document stats:', error);
      return {
        totalActions: 0,
        downloadCount: 0,
        viewCount: 0,
        modificationCount: 0,
        uniqueUsers: 0,
        firstAccessed: null,
        lastAccessed: null,
      };
    }
  }
}

export const documentAuditService = new DocumentAuditService();
