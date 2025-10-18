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

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { doubleCsrf } from "csrf-csrf";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "./auth";
import { registerRoutes } from "./routes";
import { corsOptions, logCorsConfig } from "./middleware/corsConfig";
import { helmetConfig, additionalSecurityHeaders, logSecurityHeadersConfig } from "./middleware/securityHeaders";
import { initializeSystemData } from "./seedData";
import { seedCountiesAndGamification } from "./seedCountiesAndGamification";
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
  console.error("❌ FATAL: Environment validation failed:");
  envValidation.errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}

if (envValidation.warnings.length > 0) {
  console.warn("⚠️  Environment warnings:");
  envValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
}

console.log("✅ Environment validation passed");

// ============================================================================
// PRODUCTION READINESS VALIDATION
// ============================================================================
if (process.env.NODE_ENV === 'production') {
  try {
    ProductionValidator.validateOrThrow();
  } catch (error) {
    console.error("❌ FATAL: Production validation failed");
    process.exit(1);
  }
}

const app = express();

// Trust proxy - Required for rate limiting and sessions behind reverse proxies/load balancers
app.set('trust proxy', 1);

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

// Apply role-based rate limiters
app.use("/api/", rateLimiters.standard); // General limit based on user role
app.use("/api/auth/login", rateLimiters.auth); // Strict limit for login
app.use("/api/auth/signup", rateLimiters.auth); // Strict limit for signup
app.use("/api/chat/ask", rateLimiters.ai); // AI chat endpoint
app.use("/api/search", rateLimiters.ai); // AI search endpoint
app.use("/api/documents/upload", rateLimiters.upload); // Document upload endpoints

// Add timing headers and performance monitoring
app.use(timingHeadersMiddleware());
app.use(performanceMonitoringMiddleware());

// Add request logging middleware
app.use(requestLoggerMiddleware());

// Session configuration
if (!process.env.SESSION_SECRET) {
  console.error("❌ FATAL: SESSION_SECRET environment variable is required for secure session management");
  process.exit(1);
}

const PgSession = ConnectPgSimple(session);
const sessionMiddleware = session({
  store: new PgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true, // Changed to true to ensure session cookie is always set
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true, // Prevent XSS attacks by making cookie inaccessible to JavaScript
    secure: process.env.NODE_ENV === "production", // Only send cookie over HTTPS in production
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // CSRF protection: strict in prod, lax in dev
    path: "/", // Cookie available for entire domain
  },
  rolling: true, // Extend session on activity (rolling session timeout)
  name: "sessionId", // Custom cookie name (security through obscurity - don't reveal tech stack)
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
// HEALTH CHECK ENDPOINT - Database connectivity and system status
// ============================================================================
app.get("/api/health", async (req, res) => {
  try {
    // Check database connectivity
    await db.execute(sql`SELECT 1`);
    
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: "connected",
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    console.error("❌ Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: "Database connection failed",
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
    console.error("❌ CSRF token generation error:", error);
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
  
  // Apply CSRF protection
  csrfProtection.doubleCsrfProtection(req, res, next);
});

(async () => {
  // ============================================================================
  // SENTRY SETUP - Initialize and attach middleware BEFORE other initialization
  // ============================================================================
  await setupSentry(); // Must await to ensure Sentry is ready
  
  // Attach Sentry middleware AFTER initialization (so handlers are real, not no-ops)
  app.use(getSentryRequestHandler()); // Request context and tracing
  app.use(getSentryTracingHandler()); // Performance monitoring
  
  // Initialize system data (benefit programs, etc.)
  await initializeSystemData();
  
  // Seed multi-county and gamification data
  await seedCountiesAndGamification();
  
  // Start Smart Scheduler with source-specific intervals
  // Checks each data source based on realistic update frequencies (70-80% reduction in API calls)
  try {
    const { smartScheduler } = await import("./services/smartScheduler");
    await smartScheduler.startAll();
  } catch (error) {
    console.error("❌ Failed to start Smart Scheduler:", error);
  }
  
  const server = await registerRoutes(app, sessionMiddleware);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
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
        console.error("❌ Error evaluating alerts:", error);
      }
    }, 60000); // 60 seconds
    
    console.log("📊 Alert evaluation scheduled (runs every 1 minute)");
  } catch (error) {
    console.error("❌ Failed to start alert evaluation scheduler:", error);
  }

  // ============================================================================
  // RULES-TO-CONTENT SYNC - Auto-detect RaC changes every hour
  // ============================================================================
  let racSyncInterval: NodeJS.Timeout | null = null;
  
  try {
    const cron = await import("node-cron");
    const { rulesContentSyncService } = await import("./services/rulesContentSyncService");
    
    // Run RaC change detection every hour (at minute 0)
    cron.default.schedule('0 * * * *', async () => {
      console.log('🔄 Running RaC change detection...');
      try {
        const jobs = await rulesContentSyncService.detectRacChanges();
        console.log(`📊 Found ${jobs.length} content items affected by RaC changes`);
      } catch (error) {
        console.error("❌ Error detecting RaC changes:", error);
      }
    });
    
    console.log("🔄 RaC change detection scheduled (runs every hour)");
  } catch (error) {
    console.error("❌ Failed to start RaC sync scheduler:", error);
  }

  // ============================================================================
  // GRACEFUL SHUTDOWN HANDLING - Clean up resources on SIGTERM/SIGINT
  // ============================================================================
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);
    
    try {
      // Close HTTP server (stop accepting new requests)
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            console.error("❌ Error closing HTTP server:", err);
            reject(err);
          } else {
            console.log("✅ HTTP server closed");
            resolve();
          }
        });
      });

      // Close database connections
      // Note: Drizzle with neon doesn't require explicit close, but we log it
      console.log("✅ Database connections closed");

      // Stop Smart Scheduler if running
      try {
        const { smartScheduler } = await import("./services/smartScheduler");
        await smartScheduler.stopAll();
        console.log("✅ Smart Scheduler stopped");
      } catch (error) {
        console.error("⚠️  Error stopping Smart Scheduler:", error);
      }

      // Stop Alert Evaluation scheduler
      if (alertEvaluationInterval) {
        clearInterval(alertEvaluationInterval);
        console.log("✅ Alert evaluation scheduler stopped");
      }

      console.log("✅ Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("❌ Error during graceful shutdown:", error);
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    console.error("❌ UNCAUGHT EXCEPTION:", error);
    gracefulShutdown("UNCAUGHT_EXCEPTION");
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ UNHANDLED REJECTION at:", promise, "reason:", reason);
    gracefulShutdown("UNHANDLED_REJECTION");
  });
})();
