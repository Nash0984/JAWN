/**
 * SMS Rate Limiting Middleware
 * Protects against abuse by limiting screening link generation
 */

import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import NodeCache from "node-cache";

// In-memory cache for rate limiting (consider using Redis in production)
const rateLimitCache = new NodeCache({ 
  stdTTL: 86400, // 24 hours
  checkperiod: 600 // Check expired keys every 10 minutes
});

interface RateLimitData {
  count: number;
  firstRequest: Date;
  lastRequest: Date;
}

/**
 * Hash phone number for privacy-preserving rate limiting
 */
export function hashPhoneForRateLimit(phoneNumber: string): string {
  return createHash('sha256')
    .update(`${phoneNumber}-ratelimit`)
    .digest('hex');
}

/**
 * Rate limiting middleware for SMS screening link generation
 * Limits: 3 links per phone number per 24 hours
 */
export const smsScreeningRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const phoneNumber = req.body.phoneNumber || req.query.phoneNumber;
    
    if (!phoneNumber) {
      return res.status(400).json({
        error: "Phone number required for rate limiting"
      });
    }

    const phoneHash = hashPhoneForRateLimit(phoneNumber);
    const rateLimitKey = `sms_screening:${phoneHash}`;
    
    // Get current rate limit data
    let rateLimitData = rateLimitCache.get<RateLimitData>(rateLimitKey);
    
    if (!rateLimitData) {
      // First request
      rateLimitData = {
        count: 1,
        firstRequest: new Date(),
        lastRequest: new Date()
      };
      rateLimitCache.set(rateLimitKey, rateLimitData);
      return next();
    }
    
    // Check if 24 hours have passed since first request
    const now = new Date();
    const hoursSinceFirst = (now.getTime() - rateLimitData.firstRequest.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceFirst >= 24) {
      // Reset rate limit
      rateLimitData = {
        count: 1,
        firstRequest: now,
        lastRequest: now
      };
      rateLimitCache.set(rateLimitKey, rateLimitData);
      return next();
    }
    
    // Check if limit reached
    if (rateLimitData.count >= 3) {
      const hoursUntilReset = Math.ceil(24 - hoursSinceFirst);
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: `You have reached the maximum of 3 screening links per 24 hours. Please try again in ${hoursUntilReset} hour${hoursUntilReset > 1 ? 's' : ''}.`,
        retryAfter: hoursUntilReset * 3600
      });
    }
    
    // Increment count
    rateLimitData.count++;
    rateLimitData.lastRequest = now;
    rateLimitCache.set(rateLimitKey, rateLimitData);
    
    next();
  } catch (error) {
    console.error("Rate limiting error:", error);
    // Don't block request if rate limiting fails
    next();
  }
};

/**
 * General SMS rate limiting for all SMS operations
 * Limits: 10 messages per phone number per hour
 */
export const smsGeneralRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const phoneNumber = req.body.From || req.body.phoneNumber;
    
    if (!phoneNumber) {
      return next(); // Skip rate limiting if no phone number
    }

    const phoneHash = hashPhoneForRateLimit(phoneNumber);
    const rateLimitKey = `sms_general:${phoneHash}`;
    
    // Get current rate limit data
    let rateLimitData = rateLimitCache.get<RateLimitData>(rateLimitKey);
    
    if (!rateLimitData) {
      // First request
      rateLimitData = {
        count: 1,
        firstRequest: new Date(),
        lastRequest: new Date()
      };
      rateLimitCache.set(rateLimitKey, rateLimitData, 3600); // 1 hour TTL
      return next();
    }
    
    // Check if 1 hour has passed since first request
    const now = new Date();
    const minutesSinceFirst = (now.getTime() - rateLimitData.firstRequest.getTime()) / (1000 * 60);
    
    if (minutesSinceFirst >= 60) {
      // Reset rate limit
      rateLimitData = {
        count: 1,
        firstRequest: now,
        lastRequest: now
      };
      rateLimitCache.set(rateLimitKey, rateLimitData, 3600);
      return next();
    }
    
    // Check if limit reached
    if (rateLimitData.count >= 10) {
      const minutesUntilReset = Math.ceil(60 - minutesSinceFirst);
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: `Too many SMS requests. Please try again in ${minutesUntilReset} minute${minutesUntilReset > 1 ? 's' : ''}.`,
        retryAfter: minutesUntilReset * 60
      });
    }
    
    // Increment count
    rateLimitData.count++;
    rateLimitData.lastRequest = now;
    rateLimitCache.set(rateLimitKey, rateLimitData, 3600);
    
    next();
  } catch (error) {
    console.error("SMS rate limiting error:", error);
    // Don't block request if rate limiting fails
    next();
  }
};

/**
 * IP-based rate limiting for public screening endpoints
 * Limits: 100 requests per IP per hour
 */
export const ipRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const rateLimitKey = `ip:${ip}`;
    
    // Get current rate limit data
    let rateLimitData = rateLimitCache.get<RateLimitData>(rateLimitKey);
    
    if (!rateLimitData) {
      // First request
      rateLimitData = {
        count: 1,
        firstRequest: new Date(),
        lastRequest: new Date()
      };
      rateLimitCache.set(rateLimitKey, rateLimitData, 3600); // 1 hour TTL
      return next();
    }
    
    // Check if 1 hour has passed since first request
    const now = new Date();
    const minutesSinceFirst = (now.getTime() - rateLimitData.firstRequest.getTime()) / (1000 * 60);
    
    if (minutesSinceFirst >= 60) {
      // Reset rate limit
      rateLimitData = {
        count: 1,
        firstRequest: now,
        lastRequest: now
      };
      rateLimitCache.set(rateLimitKey, rateLimitData, 3600);
      return next();
    }
    
    // Check if limit reached
    if (rateLimitData.count >= 100) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many requests from this IP address. Please try again later.",
        retryAfter: Math.ceil((60 - minutesSinceFirst) * 60)
      });
    }
    
    // Increment count
    rateLimitData.count++;
    rateLimitData.lastRequest = now;
    rateLimitCache.set(rateLimitKey, rateLimitData, 3600);
    
    next();
  } catch (error) {
    console.error("IP rate limiting error:", error);
    // Don't block request if rate limiting fails
    next();
  }
};

/**
 * Get rate limit status for a phone number
 */
export function getRateLimitStatus(phoneNumber: string): {
  screeningLinks: { count: number; remaining: number; resetIn: number } | null;
  generalSms: { count: number; remaining: number; resetIn: number } | null;
} {
  const phoneHash = hashPhoneForRateLimit(phoneNumber);
  
  // Check screening link rate limit
  const screeningKey = `sms_screening:${phoneHash}`;
  const screeningData = rateLimitCache.get<RateLimitData>(screeningKey);
  
  let screeningStatus = null;
  if (screeningData) {
    const hoursSinceFirst = (Date.now() - screeningData.firstRequest.getTime()) / (1000 * 60 * 60);
    const hoursUntilReset = Math.max(0, Math.ceil(24 - hoursSinceFirst));
    screeningStatus = {
      count: screeningData.count,
      remaining: Math.max(0, 3 - screeningData.count),
      resetIn: hoursUntilReset * 3600
    };
  }
  
  // Check general SMS rate limit
  const generalKey = `sms_general:${phoneHash}`;
  const generalData = rateLimitCache.get<RateLimitData>(generalKey);
  
  let generalStatus = null;
  if (generalData) {
    const minutesSinceFirst = (Date.now() - generalData.firstRequest.getTime()) / (1000 * 60);
    const minutesUntilReset = Math.max(0, Math.ceil(60 - minutesSinceFirst));
    generalStatus = {
      count: generalData.count,
      remaining: Math.max(0, 10 - generalData.count),
      resetIn: minutesUntilReset * 60
    };
  }
  
  return {
    screeningLinks: screeningStatus,
    generalSms: generalStatus
  };
}

/**
 * Clear rate limit for a phone number (for testing/admin purposes)
 */
export function clearRateLimitForPhone(phoneNumber: string): void {
  const phoneHash = hashPhoneForRateLimit(phoneNumber);
  rateLimitCache.del([
    `sms_screening:${phoneHash}`,
    `sms_general:${phoneHash}`
  ]);
}

/**
 * Get all rate limit statistics (for admin monitoring)
 */
export function getRateLimitStats(): {
  totalKeys: number;
  screeningLimits: number;
  generalLimits: number;
  ipLimits: number;
} {
  const keys = rateLimitCache.keys();
  
  return {
    totalKeys: keys.length,
    screeningLimits: keys.filter(k => k.startsWith("sms_screening:")).length,
    generalLimits: keys.filter(k => k.startsWith("sms_general:")).length,
    ipLimits: keys.filter(k => k.startsWith("ip:")).length
  };
}