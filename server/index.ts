import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { doubleCsrf } from "csrf-csrf";
import helmet from "helmet";
import passport from "./auth";
import { registerRoutes } from "./routes";
import { initializeSystemData } from "./seedData";
import { seedCountiesAndGamification } from "./seedCountiesAndGamification";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler } from "./middleware/errorHandler";
import { requestLoggerMiddleware, timingHeadersMiddleware, performanceMonitoringMiddleware } from "./middleware/requestLogger";
import { db } from "./db";

const app = express();

// Trust proxy - Required for rate limiting and sessions behind reverse proxies/load balancers
app.set('trust proxy', 1);

// Security headers with Helmet - Environment-aware CSP
const isDevelopment = process.env.NODE_ENV === 'development';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Only allow unsafe-inline and unsafe-eval in development for Vite HMR
      scriptSrc: isDevelopment 
        ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
        : ["'self'"],
      styleSrc: isDevelopment
        ? ["'self'", "'unsafe-inline'"]
        : ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: isDevelopment
        ? ["'self'", "https:", "ws:", "wss:"] // WebSocket for Vite HMR + real-time notifications
        : ["'self'", "https:", "wss:"], // WebSocket for real-time notifications
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate limiting configuration
// General API rate limiter - 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for authentication endpoints - 5 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins against the limit
});

// AI endpoint rate limiter - 20 requests per minute
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: "AI service rate limit exceeded. Please wait before making more requests.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiters
app.use("/api/", generalLimiter); // General limit for all API routes
app.use("/api/auth/login", authLimiter); // Strict limit for login
app.use("/api/auth/signup", authLimiter); // Strict limit for signup
app.use("/api/chat/ask", aiLimiter); // AI chat endpoint
app.use("/api/search", aiLimiter); // AI search endpoint

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
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
});

app.use(sessionMiddleware);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// CSRF Protection - using csrf-csrf with double-submit cookie pattern
const csrfProtection = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET || "fallback-secret",
  getSessionIdentifier: (req) => req.session?.id || "",
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

// Endpoint to get CSRF token
app.get("/api/csrf-token", (req, res) => {
  const csrfToken = csrfProtection.generateCsrfToken(req, res);
  res.json({ token: csrfToken });
});

// Apply CSRF protection to all state-changing routes
app.use("/api/", (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  // Apply CSRF protection
  csrfProtection.doubleCsrfProtection(req, res, next);
});

(async () => {
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
  });
})();
