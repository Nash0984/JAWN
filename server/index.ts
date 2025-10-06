import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import passport from "./auth";
import { registerRoutes } from "./routes";
import { initializeSystemData } from "./seedData";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler } from "./middleware/errorHandler";
import { requestLoggerMiddleware, timingHeadersMiddleware, performanceMonitoringMiddleware } from "./middleware/requestLogger";
import { db } from "./db";

const app = express();

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
app.use(
  session({
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
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

(async () => {
  // Initialize system data (benefit programs, etc.)
  await initializeSystemData();
  
  const server = await registerRoutes(app);

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
