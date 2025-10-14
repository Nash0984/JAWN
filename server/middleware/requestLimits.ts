/**
 * Request Size and DoS Protection Middleware
 * 
 * Prevents memory exhaustion and DoS attacks through:
 * - Request body size limits
 * - JSON payload limits
 * - URL length limits
 * - Request timeout
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Request size limit configuration
 */
interface RequestLimitConfig {
  maxBodySize?: number; // MB
  maxJsonSize?: number; // MB
  maxUrlLength?: number; // characters
  requestTimeout?: number; // ms
}

const DEFAULT_CONFIG: Required<RequestLimitConfig> = {
  maxBodySize: parseInt(process.env.MAX_REQUEST_SIZE_MB || '10'),
  maxJsonSize: parseInt(process.env.MAX_JSON_SIZE_MB || '5'),
  maxUrlLength: 2048,
  requestTimeout: 30000, // 30 seconds
};

/**
 * Enforce request size limits
 */
export function requestSizeLimits(config: RequestLimitConfig = {}) {
  const limits = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Check URL length
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    if (fullUrl.length > limits.maxUrlLength) {
      return res.status(414).json({
        error: 'URI Too Long',
        message: `URL must be less than ${limits.maxUrlLength} characters`
      });
    }

    // 2. Check Content-Length header
    const contentLength = parseInt(req.get('content-length') || '0');
    const maxBytes = limits.maxBodySize * 1024 * 1024;
    
    if (contentLength > maxBytes) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request body must be less than ${limits.maxBodySize}MB`
      });
    }

    // 3. Set request timeout
    req.setTimeout(limits.requestTimeout, () => {
      res.status(408).json({
        error: 'Request Timeout',
        message: `Request must complete within ${limits.requestTimeout}ms`
      });
    });

    next();
  };
}

/**
 * JSON-specific size limits
 */
export function jsonSizeLimits(config: RequestLimitConfig = {}) {
  const limits = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.is('application/json')) {
      const contentLength = parseInt(req.get('content-length') || '0');
      const maxBytes = limits.maxJsonSize * 1024 * 1024;
      
      if (contentLength > maxBytes) {
        return res.status(413).json({
          error: 'JSON Payload Too Large',
          message: `JSON requests must be less than ${limits.maxJsonSize}MB`
        });
      }
    }
    next();
  };
}

/**
 * Parameter pollution protection
 * 
 * Note: Express.js safely handles duplicate query parameters by creating arrays.
 * Application-level validation (Zod schemas) should enforce single vs array values.
 * This middleware is intentionally minimal to avoid breaking legitimate multi-value parameters.
 */
export function parameterPollutionProtection(req: Request, res: Response, next: NextFunction) {
  // Express handles parameter parsing safely (duplicates become arrays)
  // Input validation via Zod schemas provides type safety
  // No additional parameter pollution protection needed at middleware level
  next();
}

/**
 * Slow request detection and logging
 */
export function slowRequestMonitoring(thresholdMs: number = 3000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      if (duration > thresholdMs) {
        console.warn(`⚠️ Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
        
        // Optionally log to audit system
        // auditLog.create({
        //   action: 'SLOW_REQUEST',
        //   metadata: { method: req.method, path: req.path, duration }
        // });
      }
    });
    
    next();
  };
}

/**
 * Comprehensive DoS protection bundle
 */
export function dosProtection(config: RequestLimitConfig = {}) {
  return [
    requestSizeLimits(config),
    jsonSizeLimits(config),
    slowRequestMonitoring()
  ];
}
