import { Request, Response, NextFunction } from "express";
import { apiKeyService } from "../services/apiKeyService";
import { ApiKey } from "@shared/schema";
import { asyncHandler } from "./errorHandler";
import { logger } from "../services/logger.service";

// Extend Express Request to include apiKey and tenant info
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      apiTenantId?: string;
    }
  }
}

/**
 * API Key Authentication Middleware
 * 
 * Validates API key from X-API-Key header and enforces:
 * - Key exists and is active
 * - Key is not expired
 * - Rate limits are not exceeded
 * - Scope permissions for requested endpoint
 */
export const requireApiKey = (requiredScope?: string) => {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Get API key from header
    const apiKeyHeader = req.header('X-API-Key') || req.header('x-api-key');
    
    if (!apiKeyHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required. Please provide X-API-Key header.',
        code: 'MISSING_API_KEY'
      });
    }
    
    // Validate API key
    const apiKey = await apiKeyService.validateApiKey(apiKeyHeader);
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired API key.',
        code: 'INVALID_API_KEY'
      });
    }
    
    // Check rate limit
    const rateLimitStatus = await apiKeyService.checkRateLimit(apiKey.id);
    
    if (!rateLimitStatus.allowed) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Limit: ${rateLimitStatus.limit} requests per hour.`,
        code: 'RATE_LIMIT_EXCEEDED',
        rateLimit: {
          limit: rateLimitStatus.limit,
          current: rateLimitStatus.current,
          resetAt: rateLimitStatus.resetAt,
        }
      });
    }
    
    // Check scope if required
    if (requiredScope && !apiKeyService.hasScope(apiKey, requiredScope)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required scope: ${requiredScope}`,
        code: 'INSUFFICIENT_SCOPE',
        requiredScope,
        availableScopes: apiKey.scopes,
      });
    }
    
    // Attach API key and tenant to request
    req.apiKey = apiKey;
    req.apiTenantId = apiKey.tenantId;
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimitStatus.limit);
    res.setHeader('X-RateLimit-Remaining', rateLimitStatus.limit - rateLimitStatus.current);
    res.setHeader('X-RateLimit-Reset', rateLimitStatus.resetAt.toISOString());
    
    next();
  });
};

/**
 * Middleware to track API usage after request completes
 * Must be used AFTER requireApiKey middleware
 */
export const trackApiUsage = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Capture original res.json to track after response
    const originalJson = res.json.bind(res);
    
    res.json = function (body: any) {
      const responseTime = Date.now() - startTime;
      
      // Track usage asynchronously (don't block response)
      if (req.apiKey) {
        apiKeyService.trackUsage(
          req.apiKey.id,
          req.originalUrl || req.url,
          req.method,
          res.statusCode,
          responseTime,
          req.ip,
          req.get('user-agent'),
          res.statusCode >= 400 ? body?.error || body?.message : undefined,
          {
            requestSize: req.get('content-length'),
            responseSize: JSON.stringify(body).length,
          }
        ).catch(err => {
          logger.error('Failed to track API usage', {
            service: "apiKeyAuth",
            action: "trackUsage",
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined
          });
        });
      }
      
      return originalJson(body);
    };
    
    next();
  };
};

/**
 * Helper function to get available scopes documentation
 */
export const availableScopes = {
  // Eligibility scopes
  'eligibility:read': 'Check eligibility for benefit programs',
  'eligibility:write': 'Create eligibility records',
  
  // Document scopes
  'documents:read': 'Read document verification results',
  'documents:write': 'Upload and verify documents',
  
  // Screener scopes
  'screener:read': 'Run benefit screeners',
  
  // Program scopes
  'programs:read': 'List available benefit programs',
  
  // Webhook scopes
  'webhooks:write': 'Register and manage webhooks',
  'webhooks:read': 'View webhook configurations',
  
  // Tax scopes
  'tax:read': 'Access tax calculation results',
  'tax:write': 'Create tax calculations',
  
  // Research API scopes (read-only, aggregated, PII-stripped)
  'research:eligibility': 'Access aggregated eligibility statistics (PII-stripped)',
  'research:outcomes': 'Access program outcome data (PII-stripped)',
  'research:demographics': 'Access aggregated demographic distributions',
  'research:perm': 'Access PERM sampling and error rate data',
  'research:all': 'Access all research endpoints',
  
  // Limited write access for research submissions
  'research:submit': 'Submit research findings and data exports',
  
  // Wildcard
  '*': 'Full access to all API endpoints',
};
