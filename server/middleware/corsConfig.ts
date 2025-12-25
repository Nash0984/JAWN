/**
 * CORS Configuration Module
 * 
 * Implements strict Cross-Origin Resource Sharing (CORS) policy with:
 * - Environment-based origin whitelisting
 * - Credentials support for authenticated requests
 * - Preflight caching
 * - Comprehensive logging of blocked origins
 * 
 * @security Production deployments require ALLOWED_ORIGINS environment variable
 */

import { CorsOptions } from 'cors';
import { logger } from '../services/logger.service';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Allowed origins based on environment
 * 
 * Development/Test: Localhost variations + Replit dev domain (safe defaults)
 * Production: Explicit whitelist from ALLOWED_ORIGINS env var (required)
 * 
 * @security ALLOWED_ORIGINS is required for production (enforced by env validation)
 */
const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';

const baseAllowedOrigins = (isDevelopment || isTest)
  ? [
      // Backend server
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://0.0.0.0:5000',
      // Vite dev server (default port 5173)
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      // Common test/dev ports
      'http://localhost:3000',
      'http://localhost:4173', // Vite preview
      'http://127.0.0.1:3000',
      'http://127.0.0.1:4173',
      // HTTPS variants for local testing
      'https://localhost:5000',
      'https://localhost:5173',
      'https://localhost:3000',
      // Add Replit dev URLs if present
      ...(process.env.REPLIT_DEV_DOMAIN ? [`https://${process.env.REPLIT_DEV_DOMAIN}`] : []),
    ]
  : [
      // Production/Staging: Explicit whitelist from ALLOWED_ORIGINS env var
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : []),
      // Replit deployment domain
      ...(process.env.REPL_SLUG && process.env.REPL_OWNER 
        ? [`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`] 
        : []),
    ];

// Security check: Production/Staging MUST have at least one origin configured
if (!isDevelopment && !isTest && baseAllowedOrigins.length === 0) {
  logger.error('❌ FATAL: No CORS origins configured. Set ALLOWED_ORIGINS environment variable.', {
    service: "corsConfig",
    action: "missingOrigins"
  });
  logger.error('   Example: ALLOWED_ORIGINS=https://myapp.com,https://www.myapp.com', {
    service: "corsConfig",
    action: "configExample"
  });
  logger.error(`   Current NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`, {
    service: "corsConfig",
    action: "currentEnv",
    nodeEnv: process.env.NODE_ENV || 'undefined'
  });
  process.exit(1);
}

export const allowedOrigins = baseAllowedOrigins;

/**
 * CORS configuration object
 * 
 * Security features:
 * - Dynamic origin validation with logging
 * - Credentials support for cookie-based auth
 * - Restricted HTTP methods
 * - Explicit header allowlist
 * - Preflight caching (10 minutes)
 */
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      logger.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`, {
        service: "corsConfig",
        action: "blockedOrigin",
        origin: origin
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'Accept',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'], // Custom headers exposed to frontend
  maxAge: 600, // Cache preflight requests for 10 minutes
};

/**
 * Log current CORS configuration on startup
 */
export function logCorsConfig() {
  logger.info('🔒 CORS Configuration:', {
    service: "corsConfig",
    action: "initialize"
  });
  logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`, {
    service: "corsConfig",
    action: "environment",
    env: process.env.NODE_ENV || 'development'
  });
  logger.info(`   Allowed Origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'NONE (⚠️ WARNING)'}`, {
    service: "corsConfig",
    action: "allowedOrigins",
    origins: allowedOrigins
  });
  logger.info(`   Credentials: enabled`, {
    service: "corsConfig",
    action: "credentials"
  });
  logger.info(`   Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`, {
    service: "corsConfig",
    action: "methods"
  });
}
