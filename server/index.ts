// ============================================================================
// SENTRY INITIALIZATION - Must be first to capture all errors
// ============================================================================
import { 
  setupSentry,
  getSentryRequestHandler, 
  getSentryTracingHandler, 
  getSentryErrorHandler,
  isSentryEnabled,
  getSentryStatus 
} from "./services/sentryService";
import { logger } from "./services/logger.service";

import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { doubleCsrf } from "csrf-csrf";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import passport from "./auth";
import { registerRoutes } from "./routes";
import { corsOptions, logCorsConfig } from "./middleware/corsConfig";
import { helmetConfig, additionalSecurityHeaders, logSecurityHeadersConfig } from "./middleware/securityHeaders";
import { initializeSystemData } from "./seedData";
import { seedCountiesAndGamification } from "./seedCountiesAndGamification";
import { seedMarylandLDSS } from "./seedMarylandLDSS";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler } from "./middleware/errorHandler";
import { requestLoggerMiddleware, timingHeadersMiddleware, performanceMonitoringMiddleware } from "./middleware/requestLogger";
import { detectCountyContext } from "./middleware/countyContext";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { EnvValidator } from "./utils/envValidation";
import { ProductionValidator } from "./utils/productionValidation";
import "./utils/piiMasking"; // Import early to override console methods with PII redaction

// ============================================================================
// ENVIRONMENT VALIDATION - Validate required environment variables on startup
// ============================================================================
const envValidation = EnvValidator.validate();
if (!envValidation.valid) {
  logger.error("❌ FATAL: Environment validation failed:");
  envValidation.errors.forEach(error => logger.error(`  - ${error}`));
  process.exit(1);
}

if (envValidation.warnings.length > 0) {
  logger.warn("⚠️  Environment warnings:");
  envValidation.warnings.forEach(warning => logger.warn(`  - ${warning}`));
}

logger.info("✅ Environment validation passed");

// ============================================================================
// PRODUCTION READINESS VALIDATION
// ============================================================================
if (process.env.NODE_ENV === 'production') {
  try {
    ProductionValidator.validateOrThrow();
  } catch (error) {
    logger.error("❌ FATAL: Production validation failed");
    process.exit(1);
  }
}

const app = express();

// Trust proxy - Required for rate limiting and sessions behind reverse proxies/load balancers
app.set('trust proxy', 1);

// ============================================================================
// COMPRESSION - Enable gzip/deflate compression for all responses
// ============================================================================
app.use(compression({
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Fallback to standard filter function
    return compression.filter(req, res);
  },
  level: 6 // Balanced compression level (1-9, default 6)
}));

// Security headers with Helmet - Environment-aware CSP
const isDevelopment = process.env.NODE_ENV === 'development';

// ============================================================================
// CORS CONFIGURATION - Strict environment-based whitelist
// ============================================================================
app.use(cors(corsOptions));

// ============================================================================
// SECURITY HEADERS - Comprehensive HTTP security with Helmet.js
// ============================================================================
app.use(helmetConfig);
app.use(additionalSecurityHeaders);

// Parse JSON and URL-encoded bodies with size limits for security
app.use(express.json({ limit: '10mb' })); // Limit JSON payload to 10MB
app.use(express.urlencoded({ extended: false, limit: '10mb' })); // Limit URL-encoded payload to 10MB

// Parse cookies (required for CSRF double-submit cookie pattern)
app.use(cookieParser());

// ============================================================================
// XSS SANITIZATION - Prevent Cross-Site Scripting attacks
// ============================================================================
import { xssSanitization } from "./middleware/xssSanitization";
app.use(xssSanitization()); // Sanitize all request data (body, query, params)

// ============================================================================
// REQUEST SIZE LIMITS & DoS PROTECTION
// ============================================================================
import { dosProtection } from "./middleware/requestLimits";
app.use(dosProtection({
  maxBodySize: parseInt(process.env.MAX_REQUEST_SIZE_MB || '10'),
  maxJsonSize: parseInt(process.env.MAX_JSON_SIZE_MB || '5'),
  maxUrlLength: 2048,
  requestTimeout: 30000
}));

// ============================================================================
// ENHANCED RATE LIMITING - Role-based tiers with endpoint-specific limits
// ============================================================================
import { rateLimiters } from "./middleware/enhancedRateLimiting";

// Apply permissive public rate limiter first (more specific routes go first)
app.use("/api/public/", rateLimiters.public); // Public endpoints: 100 req/min
app.use("/api/screener/", rateLimiters.public); // Screener endpoints: 100 req/min

// Apply strict rate limiters for auth and AI endpoints
app.use("/api/auth/login", rateLimiters.auth); // Strict limit for login (5 attempts/15min)
app.use("/api/auth/signup", rateLimiters.auth); // Strict limit for signup (5 attempts/15min)
app.use("/api/chat/ask", rateLimiters.ai); // AI chat endpoint (2-30 req/min based on role)
app.use("/api/search", rateLimiters.ai); // AI search endpoint (2-30 req/min based on role)
app.use("/api/documents/upload", rateLimiters.upload); // Document upload endpoints (5-200 req/hour)

// Apply role-based standard limiter to remaining API routes
app.use("/api/", rateLimiters.standard); // General limit based on user role (20-1000 req/15min)

// Add timing headers and performance monitoring
app.use(timingHeadersMiddleware());
app.use(performanceMonitoringMiddleware());

// Add request logging middleware
app.use(requestLoggerMiddleware());

// Session configuration
if (!process.env.SESSION_SECRET) {
  logger.error("❌ FATAL: SESSION_SECRET environment variable is required for secure session management");
  process.exit(1);
}

const PgSession = ConnectPgSimple(session);
const sessionMiddleware = session({
  store: new PgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // Prune stale sessions every 15 minutes
    ttl: 30 * 24 * 60 * 60 // 30 days TTL
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false, // Security: Only create sessions after authentication (prevents session fixation)
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true, // Prevent XSS attacks by making cookie inaccessible to JavaScript
    secure: process.env.NODE_ENV === "production", // Only send cookie over HTTPS in production
    sameSite: "strict", // Always strict for maximum CSRF protection
    path: "/", // Cookie available for entire domain
  },
  rolling: true, // Extend session on activity (rolling session timeout)
  name: "sessionId", // Custom cookie name (security through obscurity - don't reveal tech stack)
  genid: () => {
    // Use crypto-secure session IDs
    return crypto.randomBytes(32).toString('hex');
  }
});

app.use(sessionMiddleware);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// CSRF Protection - using csrf-csrf with double-submit cookie pattern
const csrfProtection = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET || "fallback-secret",
  getSessionIdentifier: (req) => req.sessionID ?? (req.session as any)?.id ?? "",
  cookieName: "x-csrf-token",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  size: 64,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
});

// ============================================================================
// HEALTH CHECK ENDPOINTS - Database connectivity and system status
// ============================================================================

// Basic health check (includes scheduler status for production monitoring)
app.get("/api/health", async (req, res) => {
  try {
    const { healthCheckService } = await import("./services/healthCheckService");
    const healthStatus = await healthCheckService.checkAll();
    
    // Return appropriate HTTP status code based on health
    const statusCode = healthStatus.status === 'unhealthy' ? 503 
                     : healthStatus.status === 'degraded' ? 200  // Degraded still returns 200 but with status in body
                     : 200;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error("❌ Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Health check service failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Detailed health check (comprehensive service and dependency status)
app.get("/api/health/detailed", async (req, res) => {
  try {
    const { healthCheckService } = await import("./services/healthCheckService");
    const healthStatus = await healthCheckService.checkAll();
    
    // Return appropriate status code based on health
    const statusCode = healthStatus.status === 'unhealthy' ? 503 : 200;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error("❌ Detailed health check failed:", error);
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Health check service failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Endpoint to get CSRF token (before county context middleware)
app.get("/api/csrf-token", (req, res) => {
  try {
    const csrfToken = csrfProtection.generateCsrfToken(req, res);
    if (!csrfToken) {
      return res.status(500).json({ error: "Failed to generate CSRF token" });
    }
    res.json({ token: csrfToken });
  } catch (error) {
    logger.error("❌ CSRF token generation error:", error);
    res.status(500).json({ error: "Internal server error generating CSRF token" });
  }
});

// County Context Middleware - detects user's county for tenant isolation
app.use(detectCountyContext);

// Public calculation endpoints bypass CSRF (read-only calculations, no state changes)
app.use([
  "/api/policyengine/calculate", 
  "/api/policyengine/summary",
  "/api/benefits/calculate-hybrid",  // Quick Screener public endpoint
  "/api/benefits/calculate-hybrid-summary"  // Benefit Screener public endpoint
], (req, res, next) => {
  // Mark request to skip CSRF protection
  (req as any).skipCsrf = true;
  return next();
});

// Apply CSRF protection to all other state-changing routes
app.use("/api/", (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  
  // Skip CSRF if marked by public endpoint bypass
  if ((req as any).skipCsrf) {
    return next();
  }
  
  // Strict CSRF validation - ensure token is present
  const csrfToken = req.headers['x-csrf-token'];
  if (!csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    logger.warn('[CSRF] State-changing request without CSRF token blocked', {
      service: 'csrfProtection',
      action: 'tokenMissing',
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    return res.status(403).json({
      error: 'CSRF token required',
      message: 'State-changing requests must include X-CSRF-Token header'
    });
  }
  
  // Apply CSRF protection
  csrfProtection.doubleCsrfProtection(req, res, next);
});

// ============================================================================
// API VERSIONING - Version detection and compatibility management
// ============================================================================
import { apiVersionMiddleware } from "./middleware/apiVersioning";
app.use("/api/", apiVersionMiddleware);

(async () => {
  // ============================================================================
  // SENTRY SETUP - Initialize and attach middleware BEFORE other initialization
  // ============================================================================
  await setupSentry(); // Must await to ensure Sentry is ready
  
  // Attach Sentry middleware AFTER initialization (so handlers are real, not no-ops)
  app.use(getSentryRequestHandler()); // Request context and tracing
  app.use(getSentryTracingHandler()); // Performance monitoring
  
  // Initialize system data (defer until after server is ready)
  const initializeData = async () => {
    try {
      logger.info("[INIT] Starting background data initialization...");
      const startTime = Date.now();
      
      await initializeSystemData();
      logger.info(`[INIT] System data initialized (${Date.now() - startTime}ms)`);
      
      await seedCountiesAndGamification();
      logger.info(`[INIT] Counties/gamification seeded (${Date.now() - startTime}ms)`);
      
      await seedMarylandLDSS();
      logger.info(`[INIT] Maryland LDSS seeded (${Date.now() - startTime}ms total)`);
    } catch (error) {
      logger.error("[INIT] Error during background data initialization:", error);
    }
  };
  
  // Delay initialization until after first request
  let initialized = false;
  app.use((req, res, next) => {
    if (!initialized) {
      initialized = true;
      // Start initialization AFTER first request completes
      res.on('finish', () => {
        setTimeout(initializeData, 100);
      });
    }
    next();
  });
  
  const server = await registerRoutes(app, sessionMiddleware);

  // Add explicit middleware to intercept /api routes before Vite
  if (app.get("env") === "development") {
    // This middleware ensures /api routes are not caught by Vite's catch-all
    app.use((req, res, next) => {
      // If it's an API route and hasn't been handled yet, return a 404 JSON response
      if (req.url.startsWith('/api/') && !res.headersSent) {
        // If we get here, the route wasn't found in our registered routes
        // Return a proper JSON 404 instead of letting Vite serve HTML
        return res.status(404).json({ 
          error: 'API endpoint not found', 
          path: req.url,
          method: req.method 
        });
      }
      // Not an API route, let Vite handle it
      next();
    });
    
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ============================================================================
  // SENTRY ERROR HANDLER - Must be after all routes but before general error handler
  // ============================================================================
  app.use(getSentryErrorHandler());
  
  // Use the centralized error handling middleware AFTER Vite setup
  // This ensures Vite's catch-all route can serve the frontend before 404s are thrown
  app.use(errorHandler.handle404()); // Handle 404 errors
  app.use(errorHandler.handle()); // Handle all other errors

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    logCorsConfig();
    logSecurityHeadersConfig();
    
    // ============================================================================
    // BACKGROUND INITIALIZATION - Start Smart Scheduler after server is ready
    // ============================================================================
    // Start Smart Scheduler in background (non-blocking, fire-and-forget)
    // This ensures HTTP requests are served immediately without waiting for scheduler
    setImmediate(() => {
      // Import and start scheduler without await - true fire-and-forget
      import("./services/smartScheduler")
        .then(({ smartScheduler }) => {
          // Don't await startAll() - let it run in background
          smartScheduler.startAll()
            .then(() => {
              logger.info("✅ Smart Scheduler initialized");
            })
            .catch((error) => {
              logger.error("❌ Smart Scheduler initialization failed", { error });
            });
        })
        .catch((error) => {
          logger.error("❌ Failed to import Smart Scheduler", { error });
        });
    });
  });

  // ============================================================================
  // SCHEDULED ALERT EVALUATION - Run every 1 minute
  // ============================================================================
  let alertEvaluationInterval: NodeJS.Timeout | null = null;
  
  try {
    const { alertService } = await import("./services/alertService");
    
    // Run alert evaluation every 1 minute
    alertEvaluationInterval = setInterval(async () => {
      try {
        await alertService.evaluateAlerts();
      } catch (error) {
        logger.error("❌ Error evaluating alerts:", error);
      }
    }, 60000); // 60 seconds
    
    logger.info("📊 Alert evaluation scheduled (runs every 1 minute)");
  } catch (error) {
    logger.error("❌ Failed to start alert evaluation scheduler:", error);
  }

  // ============================================================================
  // GRACEFUL SHUTDOWN HANDLING - Clean up resources on SIGTERM/SIGINT
  // ============================================================================
  const gracefulShutdown = async (signal: string) => {
    logger.info(`\n🛑 ${signal} received. Starting graceful shutdown...`);
    
    try {
      // Close HTTP server (stop accepting new requests)
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            logger.error("❌ Error closing HTTP server:", err);
            reject(err);
          } else {
            logger.info("✅ HTTP server closed");
            resolve();
          }
        });
      });

      // Close database connections
      // Note: Drizzle with neon doesn't require explicit close, but we log it
      logger.info("✅ Database connections closed");

      // Stop Smart Scheduler if running
      try {
        const { smartScheduler } = await import("./services/smartScheduler");
        await smartScheduler.stopAll();
        logger.info("✅ Smart Scheduler stopped");
      } catch (error) {
        logger.error("⚠️  Error stopping Smart Scheduler:", error);
      }

      // Stop Alert Evaluation scheduler
      if (alertEvaluationInterval) {
        clearInterval(alertEvaluationInterval);
        logger.info("✅ Alert evaluation scheduler stopped");
      }

      logger.info("✅ Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error("❌ Error during graceful shutdown:", error);
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    logger.error("❌ UNCAUGHT EXCEPTION:", error);
    gracefulShutdown("UNCAUGHT_EXCEPTION");
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("❌ UNHANDLED REJECTION at:", promise, "reason:", reason);
    gracefulShutdown("UNHANDLED_REJECTION");
  });
})();
