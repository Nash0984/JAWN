import type { Request, Response, NextFunction } from "express";
import { AuditService } from "../services/auditService";

interface RequestLog {
  timestamp: Date;
  method: string;
  path: string;
  query?: any;
  statusCode?: number;
  responseTime?: number;
  ip?: string;
  userAgent?: string;
  userId?: string;
  requestId: string;
  error?: string;
}

class RequestLogger {
  private auditService: AuditService;
  private excludedPaths: Set<string>;
  private sensitiveFields: Set<string>;

  constructor() {
    this.auditService = new AuditService();
    
    // Paths to exclude from logging (e.g., health checks, static files)
    this.excludedPaths = new Set([
      "/health",
      "/api/health",
      "/favicon.ico",
      "/robots.txt",
    ]);
    
    // Fields to redact from logs
    this.sensitiveFields = new Set([
      "password",
      "token",
      "apiKey",
      "api_key",
      "secret",
      "authorization",
      "cookie",
      "ssn",
      "socialSecurityNumber",
      "creditCard",
      "cardNumber",
      "cvv",
    ]);
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if path should be logged
   */
  private shouldLogPath(path: string): boolean {
    // Skip excluded paths
    if (this.excludedPaths.has(path)) {
      return false;
    }
    
    // Skip static assets
    if (path.match(/\.(js|css|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|map)$/i)) {
      return false;
    }
    
    return true;
  }

  /**
   * Redact sensitive data from objects
   */
  private redactSensitiveData(data: any): any {
    if (!data || typeof data !== "object") {
      return data;
    }

    const redacted = Array.isArray(data) ? [...data] : { ...data };
    
    for (const key in redacted) {
      // Check if field name contains sensitive keywords
      const lowerKey = key.toLowerCase();
      if (this.sensitiveFields.has(lowerKey) || 
          Array.from(this.sensitiveFields).some(field => lowerKey.includes(field))) {
        redacted[key] = "[REDACTED]";
      } else if (typeof redacted[key] === "object") {
        // Recursively redact nested objects
        redacted[key] = this.redactSensitiveData(redacted[key]);
      }
    }
    
    return redacted;
  }

  /**
   * Extract relevant headers for logging
   */
  private extractHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Only include specific headers
    const relevantHeaders = ["content-type", "accept", "origin", "referer"];
    
    for (const header of relevantHeaders) {
      if (req.headers[header]) {
        headers[header] = req.headers[header] as string;
      }
    }
    
    return headers;
  }

  /**
   * Format log message for console output
   */
  private formatLogMessage(log: RequestLog): string {
    const status = log.statusCode || 0;
    const statusEmoji = status < 400 ? "✓" : status < 500 ? "⚠" : "✗";
    const responseTime = log.responseTime ? `${log.responseTime}ms` : "N/A";
    
    return `${statusEmoji} ${log.method} ${log.path} ${status} - ${responseTime}`;
  }

  /**
   * Main logging middleware
   */
  public middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip if path should not be logged
      if (!this.shouldLogPath(req.path)) {
        return next();
      }

      const startTime = Date.now();
      const requestId = this.generateRequestId();
      
      // Attach request ID to request and response
      (req as any).requestId = requestId;
      res.setHeader("X-Request-Id", requestId);

      // Create initial log entry
      const log: RequestLog = {
        timestamp: new Date(),
        method: req.method,
        path: req.path,
        query: this.redactSensitiveData(req.query),
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get("user-agent"),
        userId: (req as any).userId,
        requestId,
      };

      // Log request body for non-GET requests (in development only)
      if (process.env.NODE_ENV === "development" && req.method !== "GET") {
        (log as any).body = this.redactSensitiveData(req.body);
      }

      // Capture the original end method
      const originalEnd = res.end;
      let responseBody: any;

      // Override res.json to capture response body (for debugging in development)
      if (process.env.NODE_ENV === "development") {
        const originalJson = res.json.bind(res);
        res.json = function (body: any) {
          responseBody = body;
          return originalJson(body);
        };
      }

      // Override res.end to log after response is sent
      res.end = function (...args: any[]) {
        // Restore original end method
        res.end = originalEnd;

        // Calculate response time
        log.responseTime = Date.now() - startTime;
        log.statusCode = res.statusCode;

        // Add error if status code indicates an error
        if (res.statusCode >= 400) {
          log.error = responseBody?.message || responseBody?.error || "Unknown error";
        }

        // Log to console in a readable format
        if (process.env.NODE_ENV === "development" || log.statusCode >= 400) {
          console.log(requestLogger.formatLogMessage(log));
        }

        // Async log to audit service (don't block response)
        requestLogger.logToAuditService(log, req, res);

        // Call the original end method
        return originalEnd.apply(res, args);
      } as any;

      next();
    };
  }

  /**
   * Log to audit service asynchronously
   */
  private async logToAuditService(
    log: RequestLog,
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      // Only log to database for API calls or errors
      if (!req.path.startsWith("/api") && log.statusCode! < 400) {
        return;
      }

      await this.auditService.logRequest({
        requestId: log.requestId,
        timestamp: log.timestamp,
        method: log.method,
        path: log.path,
        query: log.query,
        statusCode: log.statusCode!,
        responseTime: log.responseTime!,
        ip: log.ip,
        userAgent: log.userAgent,
        userId: log.userId,
        headers: this.extractHeaders(req),
        error: log.error,
      });
    } catch (error) {
      // Don't crash the app if logging fails
      console.error("Failed to log request to audit service:", error);
    }
  }

  /**
   * Middleware to add request timing headers
   */
  public timingHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = process.hrtime.bigint();

      // Capture the original end method
      const originalEnd = res.end;
      res.end = function (...args: any[]) {
        // Add timing header before ending response
        const end = process.hrtime.bigint();
        const responseTime = Number(end - start) / 1000000; // Convert to milliseconds
        
        // Only set header if headers haven't been sent yet
        if (!res.headersSent) {
          res.setHeader("X-Response-Time", `${responseTime.toFixed(2)}ms`);
        }
        
        // Restore and call original end method
        res.end = originalEnd;
        return originalEnd.apply(res, args);
      } as any;

      next();
    };
  }

  /**
   * Performance monitoring middleware
   */
  public performanceMonitoring() {
    const slowRequestThreshold = parseInt(process.env.SLOW_REQUEST_THRESHOLD || "1000", 10);
    
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on("finish", () => {
        const duration = Date.now() - start;
        
        // Log slow requests
        if (duration > slowRequestThreshold) {
          console.warn(`⚠️ Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
          
          // Log to audit service
          this.auditService.logPerformance({
            type: "slow_request",
            path: req.path,
            method: req.method,
            duration,
            threshold: slowRequestThreshold,
            userId: (req as any).userId,
          }).catch(err => console.error("Failed to log performance issue:", err));
        }
      });
      
      next();
    };
  }
}

// Export singleton instance
export const requestLogger = new RequestLogger();

// Export middleware functions
export const requestLoggerMiddleware = () => requestLogger.middleware();
export const timingHeadersMiddleware = () => requestLogger.timingHeaders();
export const performanceMonitoringMiddleware = () => requestLogger.performanceMonitoring();