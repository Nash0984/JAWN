/**
 * Enhanced Rate Limiting with Role-Based Tiers
 * 
 * Provides sophisticated rate limiting with:
 * - Role-based limits (admin, navigator, applicant)
 * - Endpoint-specific limits
 * - Distributed rate limiting ready (Redis compatible)
 * - Detailed limit headers
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request } from 'express';
import crypto from 'crypto';
import { logger } from '../services/logger.service';

/**
 * Create a safe key from IP address using hash
 * This prevents IPv6 validation warnings by converting any IP to a fixed-length hash
 */
function createSafeIpKey(ip: string | undefined): string {
  if (!ip) return 'unknown';
  
  // Create a short hash of the IP address (no colons, no special characters)
  return crypto.createHash('md5').update(ip).digest('hex').substring(0, 16);
}

/**
 * Rate limit tiers by user role
 */
const RATE_LIMIT_TIERS = {
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Higher limits for admins
    message: 'Too many requests from admin account'
  },
  navigator: {
    windowMs: 15 * 60 * 1000,
    max: 500, // Medium limits for navigators
    message: 'Too many requests from navigator account'
  },
  caseworker: {
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: 'Too many requests from caseworker account'
  },
  applicant: {
    windowMs: 15 * 60 * 1000,
    max: 100, // Lower limits for applicants
    message: 'Too many requests from your account'
  },
  anonymous: {
    windowMs: 15 * 60 * 1000,
    max: 100, // Increased limit for anonymous users to use AI features
    message: 'Too many requests. Please log in for higher limits.'
  }
};

/**
 * Get rate limit config based on user role
 */
function getRateLimitForUser(req: Request): { windowMs: number; max: number; message: string } {
  const user = (req as any).user;
  
  if (!user) {
    return RATE_LIMIT_TIERS.anonymous;
  }

  const role = user.role as keyof typeof RATE_LIMIT_TIERS;
  return RATE_LIMIT_TIERS[role] || RATE_LIMIT_TIERS.applicant;
}

/**
 * Standard rate limiter with role-based limits
 */
export const standardRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // Default 15 minutes
  max: (req: Request) => {
    return getRateLimitForUser(req).max;
  },
  message: (req: Request) => {
    const limit = getRateLimitForUser(req);
    return {
      error: 'Too Many Requests',
      message: limit.message,
      retryAfter: Math.ceil(limit.windowMs / 1000),
      limit: limit.max
    };
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  validate: false, // Disable IP validation to handle IPv6 properly
  // Use user ID or IP hash for rate limiting
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    return user ? `user:${user.id}` : `ip:${createSafeIpKey(req.ip)}`;
  },
  // Skip successful requests from counting (optional)
  skip: (req: Request) => {
    // Don't count health checks
    return req.path === '/health' || req.path === '/ready';
  },
  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    const limit = getRateLimitForUser(req);
    
    // Log rate limit hit
    logger.warn(`⚠️  Rate limit exceeded: ${req.method} ${req.path} from ${req.ip}`, {
      service: "rateLimiting",
      action: "standardLimitExceeded",
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: limit.message,
      retryAfter: Math.ceil(limit.windowMs / 1000),
      limit: limit.max
    });
  }
});

/**
 * Strict rate limiter for auth endpoints
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful login attempts
  validate: false, // Disable IP validation to handle IPv6 properly
  message: {
    error: 'Too Many Login Attempts',
    message: 'Too many login attempts. Please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  keyGenerator: (req: Request) => `auth:${createSafeIpKey(req.ip)}`,
  handler: (req, res) => {
    logger.warn(`⚠️  Auth rate limit exceeded from IP: ${req.ip}`, {
      service: "rateLimiting",
      action: "authLimitExceeded",
      ip: req.ip
    });
    
    res.status(429).json({
      error: 'Too Many Login Attempts',
      message: 'Too many login attempts. Please try again in 15 minutes.',
      retryAfter: 900
    });
  }
});

/**
 * Strict rate limiter for AI/API-heavy endpoints
 */
export const aiRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req: Request) => {
    const user = (req as any).user;
    if (!user) return 30; // Increased limit for anonymous AI usage
    if (user.role === 'admin') return 30;
    if (user.role === 'navigator' || user.role === 'caseworker') return 20;
    return 10; // applicants
  },
  validate: false, // Disable IP validation to handle IPv6 properly
  message: {
    error: 'Too Many AI Requests',
    message: 'AI request limit exceeded. Please wait before trying again.',
    retryAfter: 60
  },
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    return user ? `ai:user:${user.id}` : `ai:ip:${createSafeIpKey(req.ip)}`;
  }
});

/**
 * Upload rate limiter
 */
export const uploadRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req: Request) => {
    const user = (req as any).user;
    if (!user) return 5; // Very limited for anonymous
    if (user.role === 'admin') return 200;
    if (user.role === 'navigator' || user.role === 'caseworker') return 100;
    return 50; // applicants
  },
  validate: false, // Disable IP validation to handle IPv6 properly
  message: {
    error: 'Upload Limit Exceeded',
    message: 'Upload limit exceeded for this hour. Please try again later.',
    retryAfter: 3600
  },
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    return user ? `upload:user:${user.id}` : `upload:ip:${createSafeIpKey(req.ip)}`;
  }
});

/**
 * Create custom rate limiter for specific endpoints
 */
export function createCustomRateLimiter(
  windowMs: number,
  maxRequests: number,
  message: string
): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    max: maxRequests,
    validate: false, // Disable IP validation to handle IPv6 properly
    message: {
      error: 'Rate Limit Exceeded',
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => `custom:${createSafeIpKey(req.ip)}`
  });
}

/**
 * Public endpoint rate limiter - More permissive for accessibility
 * Designed for /screener and /public/* endpoints
 */
export const publicRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  validate: false, // Disable IP validation to handle IPv6 properly
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Too many requests to public endpoints. Please wait a moment before trying again.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `public:${createSafeIpKey(req.ip)}`,
  handler: (req, res) => {
    logger.warn(`⚠️  Public endpoint rate limit exceeded: ${req.method} ${req.path} from ${req.ip}`, {
      service: "rateLimiting",
      action: "publicLimitExceeded",
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    
    res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests. Please wait a moment before trying again.',
      retryAfter: 60
    });
  }
});

/**
 * Aggressive rate limiter for abuse prevention
 * Applied to IPs that exceed limits repeatedly
 */
export const aggressiveRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Only 10 requests per 15 minutes
  skipSuccessfulRequests: false,
  validate: false, // Disable IP validation to handle IPv6 properly
  message: {
    error: 'IP Blocked - Rate Limit Abuse',
    message: 'Your IP has been temporarily blocked due to excessive requests. Please contact support if this is an error.',
    retryAfter: 900
  },
  keyGenerator: (req: Request) => `blocked:${createSafeIpKey(req.ip)}`,
  handler: (req, res) => {
    logger.error(`🚨 IP BLOCKED due to rate limit abuse: ${req.ip} - ${req.method} ${req.path}`, {
      service: "rateLimiting",
      action: "ipBlocked",
      ip: req.ip,
      method: req.method,
      path: req.path
    });
    
    res.status(429).json({
      error: 'IP Temporarily Blocked',
      message: 'Your IP has been temporarily blocked due to excessive requests. This block will expire in 15 minutes.',
      retryAfter: 900
    });
  }
});

/**
 * Bulk operation rate limiter - Prevents resource exhaustion from batch processing
 * Applied to endpoints that process multiple records at once
 */
export const bulkOperationRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 bulk operations per hour
  validate: false,
  message: {
    error: 'Bulk Operation Limit Exceeded',
    message: 'Too many bulk operations. Please wait before retrying batch requests.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    return user ? `bulk:user:${user.id}` : `bulk:ip:${createSafeIpKey(req.ip)}`;
  },
  handler: (req, res) => {
    logger.warn(`⚠️  Bulk operation rate limit exceeded: ${req.method} ${req.path}`, {
      service: "rateLimiting",
      action: "bulkOperationLimitExceeded",
      method: req.method,
      path: req.path,
      userId: (req as any).user?.id,
      ip: req.ip
    });
    
    res.status(429).json({
      error: 'Bulk Operation Limit Exceeded',
      message: 'Too many bulk operations. Maximum 10 batch requests per hour. Please wait before retrying.',
      retryAfter: 3600,
      limit: 10
    });
  }
});

/**
 * Export endpoint-specific limiters
 */
export const rateLimiters = {
  standard: standardRateLimiter,
  auth: authRateLimiter,
  ai: aiRateLimiter,
  upload: uploadRateLimiter,
  public: publicRateLimiter,
  aggressive: aggressiveRateLimiter,
  bulkOperation: bulkOperationRateLimiter,
  custom: createCustomRateLimiter
};
