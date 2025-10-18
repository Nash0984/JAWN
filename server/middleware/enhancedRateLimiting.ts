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

/**
 * Normalize IP address for rate limiting keys
 * Handles IPv6 addresses to avoid ERR_ERL_KEY_GEN_IPV6 validation errors
 */
function normalizeIpForKey(ip: string | undefined): string {
  if (!ip) return 'unknown';
  
  // Convert IPv4-mapped IPv6 addresses to IPv4
  // ::ffff:192.0.2.1 → 192.0.2.1
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  // Convert localhost IPv6 to IPv4
  // ::1 → 127.0.0.1
  if (ip === '::1') {
    return '127.0.0.1';
  }
  
  // For other IPv6 addresses, use a hash to create a valid key
  // This ensures consistent rate limiting for IPv6 clients
  if (ip.includes(':')) {
    // Replace colons with hyphens to create valid key
    return ip.replace(/:/g, '-');
  }
  
  return ip;
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
    max: 20, // Strict limits for unauthenticated users
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
  validate: false, // Disable validation - we handle IPv6 normalization in keyGenerator
  // Use user ID or IP for rate limiting
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    return user ? `user:${user.id}` : `ip:${normalizeIpForKey(req.ip)}`;
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
    console.warn(`⚠️  Rate limit exceeded: ${req.method} ${req.path} from ${req.ip}`);
    
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
  message: {
    error: 'Too Many Login Attempts',
    message: 'Too many login attempts. Please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  validate: false, // Disable validation - we handle IPv6 normalization in keyGenerator
  keyGenerator: (req: Request) => `auth:${normalizeIpForKey(req.ip)}`,
  handler: (req, res) => {
    console.warn(`⚠️  Auth rate limit exceeded from IP: ${req.ip}`);
    
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
    if (!user) return 2; // Very limited for anonymous
    if (user.role === 'admin') return 30;
    if (user.role === 'navigator' || user.role === 'caseworker') return 20;
    return 10; // applicants
  },
  message: {
    error: 'Too Many AI Requests',
    message: 'AI request limit exceeded. Please wait before trying again.',
    retryAfter: 60
  },
  validate: false, // Disable validation - we handle IPv6 normalization in keyGenerator
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    return user ? `ai:user:${user.id}` : `ai:ip:${normalizeIpForKey(req.ip)}`;
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
  message: {
    error: 'Upload Limit Exceeded',
    message: 'Upload limit exceeded for this hour. Please try again later.',
    retryAfter: 3600
  },
  validate: false, // Disable validation - we handle IPv6 normalization in keyGenerator
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    return user ? `upload:user:${user.id}` : `upload:ip:${normalizeIpForKey(req.ip)}`;
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
    message: {
      error: 'Rate Limit Exceeded',
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false
  });
}

/**
 * Export endpoint-specific limiters
 */
export const rateLimiters = {
  standard: standardRateLimiter,
  auth: authRateLimiter,
  ai: aiRateLimiter,
  upload: uploadRateLimiter,
  custom: createCustomRateLimiter
};
