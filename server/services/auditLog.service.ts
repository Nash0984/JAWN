import { storage } from '../storage';
import type { InsertAuditLog, InsertSecurityEvent } from '../../shared/schema';
import type { Request } from 'express';

/**
 * Audit Logging Service
 * 
 * Comprehensive audit trail for compliance, security, and debugging
 * Logs all sensitive operations with full context for HIPAA/PII compliance
 */

interface AuditLogOptions {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  changesBefore?: any;
  changesAfter?: any;
  sensitiveDataAccessed?: boolean;
  piiFields?: string[];
  success?: boolean;
  errorMessage?: string;
  req?: Request;
}

interface SecurityEventOptions {
  eventType: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  username?: string;
  details: any;
  blocked?: boolean;
  actionTaken?: string;
  req?: Request;
}

class AuditLogService {
  
  /**
   * Log an audit event
   */
  async log(options: AuditLogOptions): Promise<void> {
    try {
      const auditLog: InsertAuditLog = {
        userId: options.userId || null,
        username: options.req?.user ? (options.req.user as any).username : null,
        userRole: options.req?.user ? (options.req.user as any).role : null,
        action: options.action,
        resource: options.resource,
        resourceId: options.resourceId || null,
        details: options.details || null,
        changesBefore: options.changesBefore || null,
        changesAfter: options.changesAfter || null,
        ipAddress: this.getIpAddress(options.req),
        userAgent: options.req?.get('user-agent') || null,
        sessionId: options.req?.sessionID || null,
        requestId: (options.req as any)?.id || null,
        sensitiveDataAccessed: options.sensitiveDataAccessed || false,
        piiFields: options.piiFields || null,
        success: options.success !== undefined ? options.success : true,
        errorMessage: options.errorMessage || null,
        countyId: (options.req as any)?.countyContext?.countyId || null,
      };
      
      await storage.createAuditLog(auditLog);
    } catch (error) {
      // Never fail the main operation due to audit logging failure
      console.error('[AUDIT LOG ERROR]', error);
    }
  }
  
  /**
   * Log user login
   */
  async logLogin(userId: string, req: Request, success: boolean): Promise<void> {
    await this.log({
      userId,
      action: 'LOGIN',
      resource: 'user',
      resourceId: userId,
      success,
      req,
    });
  }
  
  /**
   * Log user logout
   */
  async logLogout(userId: string, req: Request): Promise<void> {
    await this.log({
      userId,
      action: 'LOGOUT',
      resource: 'user',
      resourceId: userId,
      req,
    });
  }
  
  /**
   * Log sensitive data access (SSN, bank account, etc.)
   */
  async logSensitiveAccess(
    userId: string,
    resource: string,
    resourceId: string,
    piiFields: string[],
    req: Request
  ): Promise<void> {
    await this.log({
      userId,
      action: 'READ_SENSITIVE',
      resource,
      resourceId,
      sensitiveDataAccessed: true,
      piiFields,
      req,
    });
  }
  
  /**
   * Log data export (E&E, reports, etc.)
   */
  async logExport(
    userId: string,
    resource: string,
    recordCount: number,
    exportType: string,
    req: Request
  ): Promise<void> {
    await this.log({
      userId,
      action: 'EXPORT',
      resource,
      details: {
        exportType,
        recordCount,
      },
      sensitiveDataAccessed: true,
      req,
    });
  }
  
  /**
   * Log data modification
   */
  async logModification(
    userId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    resource: string,
    resourceId: string,
    changesBefore: any,
    changesAfter: any,
    req: Request
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      resourceId,
      changesBefore,
      changesAfter,
      req,
    });
  }
  
  /**
   * Log security event (failed login, suspicious activity, etc.)
   */
  async logSecurityEvent(options: SecurityEventOptions): Promise<void> {
    try {
      const securityEvent: InsertSecurityEvent = {
        eventType: options.eventType,
        severity: options.severity || 'low',
        userId: options.userId || null,
        username: options.username || null,
        ipAddress: this.getIpAddress(options.req) || 'unknown',
        userAgent: options.req?.get('user-agent') || null,
        requestPath: options.req?.path || null,
        requestMethod: options.req?.method || null,
        details: options.details,
        blocked: options.blocked || false,
        actionTaken: options.actionTaken || null,
      };
      
      await storage.createSecurityEvent(securityEvent);
      
      // For high/critical severity, also create audit log
      if (options.severity === 'high' || options.severity === 'critical') {
        await this.log({
          userId: options.userId,
          action: 'SECURITY_EVENT',
          resource: 'security',
          details: {
            eventType: options.eventType,
            severity: options.severity,
            ...options.details,
          },
          req: options.req,
        });
      }
    } catch (error) {
      // Never fail the main operation
      console.error('[SECURITY EVENT LOG ERROR]', error);
    }
  }
  
  /**
   * Log failed login attempt
   */
  async logFailedLogin(username: string, reason: string, req: Request): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'failed_login',
      severity: 'medium',
      username,
      details: {
        reason,
        timestamp: new Date().toISOString(),
      },
      req,
    });
  }
  
  /**
   * Log rate limit exceeded
   */
  async logRateLimitExceeded(
    endpoint: string,
    userId: string | undefined,
    req: Request
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'rate_limit_exceeded',
      severity: 'medium',
      userId,
      details: {
        endpoint,
        timestamp: new Date().toISOString(),
      },
      blocked: true,
      req,
    });
  }
  
  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    description: string,
    userId: string | undefined,
    severity: 'low' | 'medium' | 'high' | 'critical',
    req: Request
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'suspicious_activity',
      severity,
      userId,
      details: {
        description,
        timestamp: new Date().toISOString(),
      },
      req,
    });
  }
  
  /**
   * Extract IP address from request (handles proxies)
   */
  private getIpAddress(req: Request | undefined): string | null {
    if (!req) return null;
    
    // Check X-Forwarded-For header (for proxies/load balancers)
    const forwardedFor = req.get('x-forwarded-for');
    if (forwardedFor) {
      // Take first IP if multiple are present
      return forwardedFor.split(',')[0].trim();
    }
    
    // Fallback to connection remote address
    return req.ip || req.socket.remoteAddress || null;
  }
  
  /**
   * Query audit logs with filters
   */
  async queryAuditLogs(filters: {
    userId?: string;
    resource?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    sensitiveOnly?: boolean;
    limit?: number;
  }) {
    return await storage.getAuditLogs(filters);
  }
  
  /**
   * Query security events with filters
   */
  async querySecurityEvents(filters: {
    userId?: string;
    eventType?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    reviewed?: boolean;
    limit?: number;
  }) {
    return await storage.getSecurityEvents(filters);
  }
}

export const auditLogService = new AuditLogService();
