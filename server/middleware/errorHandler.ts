import type { Request, Response, NextFunction } from "express";
import { AuditService } from "../services/auditService";
import { captureException, setUserContext as setSentryUser, addBreadcrumb } from "../services/sentryService";
import { metricsService } from "../services/metricsService";
import { logger } from "../services/logger.service";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  details?: any;
  code?: string;
}

class ErrorHandler {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  /**
   * Custom error class for operational errors
   */
  static createError(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: any
  ): AppError {
    const error = new Error(message) as AppError;
    error.statusCode = statusCode;
    error.isOperational = isOperational;
    error.details = details;
    return error;
  }

  /**
   * Determine if error is trusted (operational) or not
   */
  private isTrustedError(error: AppError): boolean {
    return error.isOperational || false;
  }

  /**
   * Format error response based on environment
   */
  private formatErrorResponse(error: AppError, isDevelopment: boolean) {
    const statusCode = error.statusCode || 500;
    const message = this.sanitizeErrorMessage(error.message, statusCode);
    
    const response: any = {
      status: "error",
      statusCode,
      message,
      timestamp: new Date().toISOString(),
    };

    // Include stack trace and details in development
    if (isDevelopment) {
      response.stack = error.stack;
      response.details = error.details;
    } else if (error.isOperational) {
      // Only include safe details in production for operational errors
      response.details = this.sanitizeDetails(error.details);
    }

    return response;
  }

  /**
   * Sanitize error message to avoid exposing sensitive information
   */
  private sanitizeErrorMessage(message: string, statusCode: number): string {
    // Don't expose database errors to users
    if (message.includes("duplicate key") || message.includes("foreign key")) {
      return "A database constraint was violated. Please check your input.";
    }
    
    if (message.includes("ECONNREFUSED") || message.includes("ETIMEDOUT")) {
      return "A service is temporarily unavailable. Please try again later.";
    }

    if (message.includes("API key") || message.includes("API_KEY")) {
      return "Authentication with external service failed.";
    }

    // Generic messages for server errors
    if (statusCode >= 500 && !message.includes("temporarily")) {
      return "An internal server error occurred. Please try again later.";
    }

    return message;
  }

  /**
   * Sanitize error details to remove sensitive information
   */
  private sanitizeDetails(details: any): any {
    if (!details) return undefined;
    
    // Remove sensitive fields
    const sanitized = { ...details };
    const sensitiveFields = ['password', 'apiKey', 'token', 'secret', 'key'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    }
    
    return sanitized;
  }

  /**
   * Main error handling middleware
   */
  public handle() {
    return async (err: AppError, req: Request, res: Response, next: NextFunction) => {
      // If response was already sent, delegate to default Express error handler
      if (res.headersSent) {
        return next(err);
      }

      const isDevelopment = process.env.NODE_ENV === "development";
      const statusCode = err.statusCode || 500;

      // Log error to audit service
      try {
        await this.auditService.logError({
          message: err.message,
          statusCode,
          method: req.method,
          path: req.path,
          body: isDevelopment ? req.body : undefined,
          query: req.query,
          ip: req.ip,
          userAgent: req.get("user-agent"),
          userId: (req as any).userId || undefined,
          stack: err.stack,
          details: err.details,
        });
      } catch (auditError) {
        logger.error("Failed to log error to audit service", {
          service: "errorHandler",
          action: "auditLog",
          error: auditError instanceof Error ? auditError.message : String(auditError)
        });
      }

      // Log to console in development
      if (isDevelopment) {
        logger.error("Error occurred", {
          service: "errorHandler",
          action: "handleError",
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined
        });
      }

      // Send error response
      const response = this.formatErrorResponse(err, isDevelopment);
      res.status(statusCode).json(response);

      // If it's not a trusted error, we should potentially restart the process
      if (!this.isTrustedError(err) && statusCode >= 500) {
        logger.error("FATAL ERROR: Untrusted error occurred", {
          service: "errorHandler",
          action: "untrustedError",
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined
        });
        // In production, you might want to gracefully shut down
        // process.exit(1);
      }
    };
  }

  /**
   * Handle 404 errors
   */
  public handle404() {
    return (req: Request, res: Response, next: NextFunction) => {
      const error = ErrorHandler.createError(
        `Cannot ${req.method} ${req.path}`,
        404,
        true,
        { method: req.method, path: req.path }
      );
      next(error);
    };
  }

  /**
   * Handle async route errors with Sentry integration
   */
  public static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch((error) => {
        // Extract tenantId from tenant middleware context
        const tenantId = req.tenant?.tenant?.id || null;
        
        // Capture exception in Sentry with request context including tenant
        captureException(error, {
          level: error.statusCode && error.statusCode < 500 ? 'warning' : 'error',
          tags: {
            method: req.method,
            endpoint: req.path,
            statusCode: error.statusCode?.toString() || '500',
            tenantId: tenantId || 'none',
          },
          extra: {
            url: req.url,
            headers: {
              ...req.headers,
              authorization: undefined, // Don't send auth headers
              cookie: undefined, // Don't send cookies
            },
            query: req.query,
            params: req.params,
            errorDetails: error.details,
            tenantName: req.tenant?.tenant?.name,
          },
          user: req.user ? {
            id: req.user.id,
            username: req.user.username,
          } : undefined,
          tenant: tenantId ? {
            id: tenantId,
            name: req.tenant?.tenant?.name,
          } : undefined,
        });
        
        // Record error metric with proper tenantId
        metricsService.recordMetric(
          'error',
          1,
          {
            errorType: error.name || 'Error',
            endpoint: req.path,
            method: req.method,
            statusCode: error.statusCode || 500,
          },
          tenantId
        ).catch(auditErr => logger.error("Failed to create security incident", {
          service: "errorHandler",
          action: "createIncident",
          error: auditErr instanceof Error ? auditErr.message : String(auditErr)
        }));
        
        next(error);
      });
    };
  }

  /**
   * Validation error handler
   */
  public static validationError(message: string, details?: any): AppError {
    return ErrorHandler.createError(message, 400, true, details);
  }

  /**
   * Authentication error handler
   */
  public static authenticationError(message: string = "Authentication required"): AppError {
    return ErrorHandler.createError(message, 401, true);
  }

  /**
   * Authorization error handler
   */
  public static authorizationError(message: string = "Insufficient permissions"): AppError {
    return ErrorHandler.createError(message, 403, true);
  }

  /**
   * Not found error handler
   */
  public static notFoundError(resource: string): AppError {
    return ErrorHandler.createError(`${resource} not found`, 404, true);
  }

  /**
   * Rate limit error handler
   */
  public static rateLimitError(message: string = "Too many requests"): AppError {
    return ErrorHandler.createError(message, 429, true);
  }

  /**
   * Database error handler
   */
  public static databaseError(originalError: any): AppError {
    const message = "Database operation failed";
    return ErrorHandler.createError(message, 500, false, {
      originalError: originalError.message,
    });
  }

  /**
   * External service error handler
   */
  public static externalServiceError(service: string, originalError?: any): AppError {
    const message = `External service ${service} is unavailable`;
    return ErrorHandler.createError(message, 503, true, {
      service,
      originalError: originalError?.message,
    });
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Export error creation methods
export const {
  createError,
  asyncHandler,
  validationError,
  authenticationError,
  authorizationError,
  notFoundError,
  rateLimitError,
  databaseError,
  externalServiceError,
} = ErrorHandler;