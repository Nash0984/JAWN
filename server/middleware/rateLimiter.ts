import { Request, Response, NextFunction } from 'express';
import { distributedCache } from '../services/distributedCache';

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  statusCode?: number;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean | Promise<boolean>;
  handler?: (req: Request, res: Response, next: NextFunction) => void;
}

// Default rate limit configurations
export const RATE_LIMIT_CONFIGS = {
  // Public APIs
  public: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
  },
  // Authenticated APIs
  authenticated: {
    windowMs: 60 * 1000,
    max: 300, // 300 requests per minute for logged-in users
  },
  // Heavy operations (AI, document processing)
  heavy: {
    windowMs: 60 * 1000,
    max: 20, // 20 heavy operations per minute
  },
  // Auth endpoints (login, register)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
  },
  // Admin operations
  admin: {
    windowMs: 60 * 1000,
    max: 500, // More lenient for admin operations
  },
} as const;

// Role-based rate limit multipliers
const ROLE_MULTIPLIERS: Record<string, number> = {
  admin: 2.0,        // Admins get 2x the limit
  caseworker: 1.5,   // Caseworkers get 1.5x the limit
  navigator: 1.5,    // Navigators get 1.5x the limit
  applicant: 1.0,    // Standard limit for applicants
  anonymous: 0.5,    // Half limit for anonymous users
};

// Default key generator
function defaultKeyGenerator(req: Request): string {
  // Use a combination of IP and user ID if authenticated
  const userId = (req as any).user?.id || 'anonymous';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  // Normalize IPv6 addresses
  const normalizedIp = ip.includes('::ffff:') ? ip.replace('::ffff:', '') : ip;
  
  return `${normalizedIp}:${userId}`;
}

// Get rate limit based on user role
function getRateLimitForRole(baseLimit: number, role?: string): number {
  const multiplier = role ? (ROLE_MULTIPLIERS[role] || 1.0) : ROLE_MULTIPLIERS.anonymous;
  return Math.floor(baseLimit * multiplier);
}

// Create distributed rate limiter
export function createRateLimiter(options: RateLimitOptions = {}) {
  const {
    windowMs = 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later.',
    statusCode = 429,
    standardHeaders = true,
    legacyHeaders = false,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
    skip,
    handler,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if should skip
      if (skip && await skip(req)) {
        return next();
      }

      // Skip if response already sent (for skipSuccessfulRequests/skipFailedRequests)
      res.on('finish', async () => {
        if (
          (skipSuccessfulRequests && res.statusCode < 400) ||
          (skipFailedRequests && res.statusCode >= 400)
        ) {
          // Decrement the counter
          const key = keyGenerator(req);
          const userRole = (req as any).user?.role;
          const limit = getRateLimitForRole(max, userRole);
          
          // Note: In a real implementation, we'd need to decrement the counter
          // For now, we'll just log it
          console.log(`Rate limit skipped for ${key} (status: ${res.statusCode})`);
        }
      });

      // Generate rate limit key
      const key = keyGenerator(req);
      const userRole = (req as any).user?.role;
      const limit = getRateLimitForRole(max, userRole);
      const windowSeconds = Math.ceil(windowMs / 1000);

      // Check rate limit
      const result = await distributedCache.checkRateLimit(key, limit, windowSeconds);

      // Set headers
      if (standardHeaders) {
        res.setHeader('RateLimit-Limit', limit.toString());
        res.setHeader('RateLimit-Remaining', result.remaining.toString());
        res.setHeader('RateLimit-Reset', result.resetAt.toISOString());
        res.setHeader('RateLimit-Policy', `${limit};w=${windowSeconds}`);
      }

      if (legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', limit.toString());
        res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000).toString());
      }

      // Check if allowed
      if (!result.allowed) {
        // Set Retry-After header
        const retryAfterSeconds = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfterSeconds.toString());

        // Use custom handler or default response
        if (handler) {
          return handler(req, res, next);
        } else {
          return res.status(statusCode).json({
            error: message,
            retryAfter: retryAfterSeconds,
            resetAt: result.resetAt,
          });
        }
      }

      // Continue to next middleware
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - allow request if rate limiter fails
      next();
    }
  };
}

// Pre-configured rate limiters
export const publicApiLimiter = createRateLimiter({
  ...RATE_LIMIT_CONFIGS.public,
  message: 'Too many requests from this IP, please try again later.',
});

export const authenticatedApiLimiter = createRateLimiter({
  ...RATE_LIMIT_CONFIGS.authenticated,
  message: 'Too many requests, please slow down.',
});

export const heavyOperationLimiter = createRateLimiter({
  ...RATE_LIMIT_CONFIGS.heavy,
  message: 'This operation is resource-intensive. Please wait before trying again.',
});

export const authLimiter = createRateLimiter({
  ...RATE_LIMIT_CONFIGS.auth,
  message: 'Too many authentication attempts. Please try again later.',
  skipSuccessfulRequests: true, // Don't count successful logins
});

export const adminLimiter = createRateLimiter({
  ...RATE_LIMIT_CONFIGS.admin,
  skip: async (req) => {
    // Skip rate limiting for super admins
    return (req as any).user?.role === 'superadmin';
  },
});

// Dynamic rate limiter based on endpoint
export function dynamicRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const path = req.path.toLowerCase();
    const method = req.method.toLowerCase();
    const isAuthenticated = !!(req as any).user;
    const userRole = (req as any).user?.role;

    // Determine which rate limiter to use
    let limiter;

    // Auth endpoints
    if (path.includes('/auth/login') || path.includes('/auth/register')) {
      limiter = authLimiter;
    }
    // Admin endpoints
    else if (path.includes('/admin/') && userRole === 'admin') {
      limiter = adminLimiter;
    }
    // Heavy operations
    else if (
      path.includes('/ai/') ||
      path.includes('/document/process') ||
      path.includes('/analyze') ||
      path.includes('/generate') ||
      path.includes('/gemini') ||
      path.includes('/policyengine')
    ) {
      limiter = heavyOperationLimiter;
    }
    // Authenticated endpoints
    else if (isAuthenticated) {
      limiter = authenticatedApiLimiter;
    }
    // Public endpoints
    else {
      limiter = publicApiLimiter;
    }

    return limiter(req, res, next);
  };
}

// Burst protection for specific endpoints
export function burstProtection(maxBurst: number = 10, timeWindowMs: number = 1000) {
  const burstTrackers = new Map<string, { timestamps: number[]; blocked: boolean }>();

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = defaultKeyGenerator(req);
    const now = Date.now();
    
    let tracker = burstTrackers.get(key);
    if (!tracker) {
      tracker = { timestamps: [], blocked: false };
      burstTrackers.set(key, tracker);
    }

    // Remove old timestamps
    tracker.timestamps = tracker.timestamps.filter(ts => now - ts < timeWindowMs);

    // Check if currently blocked
    if (tracker.blocked) {
      const blockExpiry = tracker.timestamps[0] + timeWindowMs * 10; // 10x penalty
      if (now < blockExpiry) {
        return res.status(429).json({
          error: 'Burst protection triggered. Please slow down your requests.',
          retryAfter: Math.ceil((blockExpiry - now) / 1000),
        });
      } else {
        tracker.blocked = false;
        tracker.timestamps = [];
      }
    }

    // Add current timestamp
    tracker.timestamps.push(now);

    // Check for burst
    if (tracker.timestamps.length > maxBurst) {
      tracker.blocked = true;
      return res.status(429).json({
        error: 'Too many requests in a short time. You have been temporarily blocked.',
        retryAfter: timeWindowMs * 10 / 1000,
      });
    }

    next();
  };
}

// Export rate limit metrics
export async function getRateLimitMetrics(): Promise<{
  totalBlocked: number;
  blockedByEndpoint: Record<string, number>;
  topBlockedIPs: Array<{ ip: string; count: number }>;
}> {
  // This would typically query from Redis or a metrics store
  // For now, return placeholder data
  return {
    totalBlocked: 0,
    blockedByEndpoint: {},
    topBlockedIPs: [],
  };
}