import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { initializeSystemData } from "./seedData";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler } from "./middleware/errorHandler";
import { requestLoggerMiddleware, timingHeadersMiddleware, performanceMonitoringMiddleware } from "./middleware/requestLogger";

const app = express();

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add timing headers and performance monitoring
app.use(timingHeadersMiddleware());
app.use(performanceMonitoringMiddleware());

// Add request logging middleware (replaces the basic logging below)
app.use(requestLoggerMiddleware());

(async () => {
  // Initialize system data (benefit programs, etc.)
  await initializeSystemData();
  
  const server = await registerRoutes(app);

  // Use the centralized error handling middleware
  app.use(errorHandler.handle404()); // Handle 404 errors
  app.use(errorHandler.handle()); // Handle all other errors

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

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
