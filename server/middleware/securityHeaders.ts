/**
 * Security Headers Configuration Module
 * 
 * Implements comprehensive HTTP security headers using Helmet.js:
 * - Content Security Policy (CSP) with environment-aware directives
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - Referrer-Policy
 * - Permissions-Policy
 * 
 * @security Production uses strict CSP without unsafe-inline/unsafe-eval
 */

import helmet from "helmet";
import { logger } from "../services/logger.service";

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Helmet security headers configuration
 * 
 * CSP Strategy:
 * - Development: Relaxed to support Vite HMR (unsafe-inline, unsafe-eval for hot reloading)
 * - Production: Strict CSP (no unsafe directives)
 * 
 * Note: Production CSP requires that all inline scripts/styles be refactored
 * to use external files or implement nonce-based CSP. Currently configured
 * for external-only scripts/styles.
 * 
 * Additional Headers:
 * - HSTS: 1 year max-age with includeSubDomains and preload
 * - X-Frame-Options: DENY (prevent clickjacking)
 * - X-Content-Type-Options: nosniff (prevent MIME sniffing)
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: Restrictive feature policy
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Script sources - unsafe-inline/unsafe-eval only in development for Vite HMR
      scriptSrc: isDevelopment 
        ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
        : ["'self'"],
      // Style sources - unsafe-inline only in development for Vite HMR
      // Google Fonts stylesheets allowed in all environments
      styleSrc: isDevelopment
        ? ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]
        : ["'self'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      // Connect sources - WebSocket support for Vite HMR (dev) and real-time notifications (prod)
      connectSrc: isDevelopment
        ? ["'self'", "https:", "ws:", "wss:"] 
        : ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"], // Prevent embedding in iframes
      // Force HTTPS in production by including upgrade-insecure-requests directive
      ...(isDevelopment ? {} : { 'upgrade-insecure-requests': [] }),
    },
  },
  
  // HTTP Strict Transport Security - Force HTTPS for 1 year
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },
  
  // Prevent embedding in iframes (clickjacking protection)
  frameguard: {
    action: 'deny',
  },
  
  // Prevent MIME type sniffing
  noSniff: true,
  
  // XSS Protection (legacy header, but still useful for older browsers)
  xssFilter: true,
  
  // Disable X-Powered-By header (don't leak server info)
  hidePoweredBy: true,
  
  // Referrer Policy - Strict in production to prevent information leakage
  referrerPolicy: {
    policy: isDevelopment ? 'strict-origin-when-cross-origin' : 'same-origin',
  },
  
  // Permissions Policy - Restrict browser features
  // This replaces the deprecated Feature-Policy header
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },
  
  // Don't enforce COEP in development to allow external resources
  crossOriginEmbedderPolicy: false,
  
  // Allow cross-origin resource loading (for Google Cloud Storage, etc.)
  crossOriginResourcePolicy: {
    policy: 'cross-origin',
  },
});

/**
 * Additional custom security headers middleware
 * 
 * Adds headers not covered by Helmet:
 * - Permissions-Policy (browser feature restrictions)
 * - X-Permitted-Cross-Domain-Policies (Adobe Flash/PDF restrictions)
 */
export function additionalSecurityHeaders(req: any, res: any, next: any) {
  // Permissions Policy - Restrict access to sensitive browser features
  res.setHeader(
    'Permissions-Policy',
    [
      'geolocation=()',           // No geolocation
      'microphone=()',            // No microphone
      'camera=()',                // No camera
      'payment=()',               // No payment API
      'usb=()',                   // No USB
      'magnetometer=()',          // No magnetometer
      'accelerometer=()',         // No accelerometer
      'gyroscope=()',             // No gyroscope
      'interest-cohort=()',       // No FLoC tracking
    ].join(', ')
  );
  
  next();
}

/**
 * Production HTTPS Enforcement Middleware (CRIT-001)
 * 
 * Enforces HTTPS transport encryption in production environments:
 * - Checks X-Forwarded-Proto header from reverse proxy (AWS ALB/GCP LB/Azure Gateway/nginx)
 * - Returns 426 Upgrade Required for HTTP requests in production
 * - Logs security events for compliance auditing (IRS Pub 1075, FedRAMP SC-8)
 * - Skips enforcement in development for local testing
 * 
 * Deployment-agnostic: Works with any reverse proxy that sets X-Forwarded-Proto
 * 
 * @see /api/health/tls for TLS configuration verification
 */
export function enforceHttpsProduction(req: any, res: any, next: any) {
  const isProd = process.env.NODE_ENV === 'production';
  
  // Skip HTTPS enforcement in development
  if (!isProd) {
    return next();
  }
  
  // Check if connection is HTTPS (via reverse proxy headers)
  // All major cloud providers set X-Forwarded-Proto
  const protocol = req.headers['x-forwarded-proto'] as string || 
                   req.headers['x-forwarded-protocol'] as string ||
                   req.protocol;
  
  const isHttps = protocol === 'https' || 
                  req.secure || 
                  req.headers['x-forwarded-ssl'] === 'on';
  
  if (!isHttps) {
    // Log security event for compliance auditing
    logger.warn('🚨 HTTP request blocked in production - HTTPS required', {
      service: 'securityHeaders',
      action: 'httpsEnforcement',
      method: req.method,
      path: req.path,
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      protocol: protocol || 'http',
      secure: req.secure,
      headers: {
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        'x-forwarded-ssl': req.headers['x-forwarded-ssl'],
        'x-forwarded-protocol': req.headers['x-forwarded-protocol']
      },
      compliance: {
        standard: 'IRS Pub 1075 + FedRAMP SC-8',
        requirement: 'HTTPS transport encryption mandatory in production',
        action: 'HTTP request rejected with 426 Upgrade Required'
      }
    });
    
    // Return 426 Upgrade Required
    return res.status(426).json({
      error: 'HTTPS Required',
      message: 'This service requires HTTPS transport encryption for FedRAMP/IRS compliance. Please access via HTTPS.',
      compliance: {
        standard: 'IRS Publication 1075 + FedRAMP SC-8',
        requirement: 'All connections must use TLS 1.2+ for FTI/PHI protection',
        action: 'Configure reverse proxy to terminate TLS and set X-Forwarded-Proto: https'
      },
      deployment: {
        'AWS GovCloud': 'Configure ALB with HTTPS listener and target group',
        'GCP': 'Configure Cloud Load Balancer with HTTPS frontend',
        'Azure Government': 'Configure Application Gateway with HTTPS listener',
        'On-premises': 'Configure nginx/Apache with TLS termination'
      },
      documentation: '/api/health/tls'
    });
  }
  
  // HTTPS verified, continue
  next();
}

/**
 * Log security headers configuration on startup
 */
export function logSecurityHeadersConfig() {
  logger.info('🛡️  Security Headers Configuration:', {
    service: "securityHeaders",
    action: "initialize"
  });
  logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`, {
    service: "securityHeaders",
    action: "environment",
    env: process.env.NODE_ENV || 'development'
  });
  logger.info(`   CSP: ${isDevelopment ? 'Relaxed (Dev - Vite HMR)' : 'Strict (Prod)'}`, {
    service: "securityHeaders",
    action: "csp",
    mode: isDevelopment ? 'relaxed' : 'strict'
  });
  logger.info(`   HSTS: Enabled (1 year, includeSubDomains, preload)`, {
    service: "securityHeaders",
    action: "hsts"
  });
  logger.info(`   X-Frame-Options: DENY`, {
    service: "securityHeaders",
    action: "frameOptions"
  });
  logger.info(`   X-Content-Type-Options: nosniff`, {
    service: "securityHeaders",
    action: "contentTypeOptions"
  });
  logger.info(`   Referrer-Policy: strict-origin-when-cross-origin`, {
    service: "securityHeaders",
    action: "referrerPolicy"
  });
  logger.info(`   Permissions-Policy: Restrictive`, {
    service: "securityHeaders",
    action: "permissionsPolicy"
  });
  logger.info(`   HTTPS Enforcement: ${isDevelopment ? 'Disabled (Dev)' : 'Enabled (Production only)'}`, {
    service: "securityHeaders",
    action: "httpsEnforcement",
    enabled: !isDevelopment
  });
}
