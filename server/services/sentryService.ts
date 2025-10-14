/**
 * Sentry Service - Enterprise Error Tracking & Performance Monitoring
 * 
 * Initializes and configures Sentry for:
 * - Error tracking and stack traces
 * - Performance monitoring and tracing
 * - User and tenant context
 * - Graceful degradation when Sentry is not configured
 */

import type { Express, Request, Response, NextFunction } from "express";

let Sentry: any = null;
let sentryEnabled = false;
let sentryConfigured = false;

// Try to import Sentry packages - gracefully handle if not installed
try {
  Sentry = require("@sentry/node");
  const ProfilingIntegration = require("@sentry/profiling-node").ProfilingIntegration;
  
  // Check if DSN is configured
  const dsn = process.env.SENTRY_DSN;
  
  if (dsn) {
    const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
    const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1");
    const profilesSampleRate = parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0.1");
    
    // Get release version from package.json
    let release = "unknown";
    try {
      const packageJson = require("../../package.json");
      release = packageJson.version || "unknown";
    } catch (e) {
      console.warn("⚠️  Could not read package.json for Sentry release version");
    }
    
    Sentry.init({
      dsn,
      environment,
      release,
      
      // Performance monitoring
      tracesSampleRate, // Capture 10% of transactions by default
      profilesSampleRate, // Profile 10% of transactions
      
      // Integrations
      integrations: [
        // Enable HTTP instrumentation
        new Sentry.Integrations.Http({ tracing: true }),
        // Enable Express.js middleware instrumentation
        new Sentry.Integrations.Express({ app: undefined as any }),
        // Enable profiling
        new ProfilingIntegration(),
      ],
      
      // PII filtering - never send sensitive data
      beforeSend(event, hint) {
        // Remove PII from error messages and stack traces
        if (event.exception?.values) {
          event.exception.values.forEach(exception => {
            if (exception.value) {
              // Scrub SSN patterns
              exception.value = exception.value.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN REDACTED]");
              // Scrub email addresses
              exception.value = exception.value.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL REDACTED]");
              // Scrub phone numbers
              exception.value = exception.value.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE REDACTED]");
            }
          });
        }
        
        // Remove sensitive request data
        if (event.request) {
          // Remove cookies that might contain session tokens
          delete event.request.cookies;
          // Remove authorization headers
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
          // Remove query params that might contain sensitive data
          if (event.request.query_string) {
            const sensitiveParams = ['ssn', 'password', 'token', 'api_key'];
            sensitiveParams.forEach(param => {
              if (event.request?.query_string) {
                event.request.query_string = event.request.query_string.replace(
                  new RegExp(`${param}=[^&]*`, 'gi'),
                  `${param}=[REDACTED]`
                );
              }
            });
          }
        }
        
        return event;
      },
      
      // Don't report errors from certain paths
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        // Random plugins/extensions
        'originalCreateNotification',
        'canvas.contentDocument',
        'MyApp_RemoveAllHighlights',
        // Facebook borked
        'fb_xd_fragment',
        // ISP "optimizing" proxy - `Cache-Control: no-transform` seems to reduce this. (thanks @acdha)
        'bmi_SafeAddOnload',
        'EBCallBackMessageReceived',
        // See http://toolbar.conduit.com/Developer/HtmlAndGadget/Methods/JSInjection.aspx
        'conduitPage',
      ],
    });
    
    sentryEnabled = true;
    sentryConfigured = true;
    console.log(`✅ Sentry initialized (${environment}) - Release: ${release}`);
    console.log(`   Traces sample rate: ${tracesSampleRate * 100}%`);
    console.log(`   Profiles sample rate: ${profilesSampleRate * 100}%`);
  } else {
    console.warn("⚠️  Sentry DSN not configured (SENTRY_DSN). Error tracking disabled.");
    console.warn("   Add SENTRY_DSN to environment variables to enable Sentry monitoring.");
  }
} catch (error) {
  console.warn("⚠️  Sentry packages not installed. Error tracking disabled.");
  console.warn("   Run: npm install @sentry/node @sentry/react @sentry/profiling-node");
  sentryEnabled = false;
}

/**
 * Get Sentry request handler middleware
 * Must be used before any other request handlers
 */
export function getSentryRequestHandler() {
  if (sentryEnabled && Sentry?.Handlers?.requestHandler) {
    return Sentry.Handlers.requestHandler();
  }
  return (req: Request, res: Response, next: NextFunction) => next();
}

/**
 * Get Sentry tracing middleware
 * Enables performance monitoring for requests
 */
export function getSentryTracingHandler() {
  if (sentryEnabled && Sentry?.Handlers?.tracingHandler) {
    return Sentry.Handlers.tracingHandler();
  }
  return (req: Request, res: Response, next: NextFunction) => next();
}

/**
 * Get Sentry error handler middleware
 * Must be used after all other request handlers but before error handlers
 */
export function getSentryErrorHandler() {
  if (sentryEnabled && Sentry?.Handlers?.errorHandler) {
    return Sentry.Handlers.errorHandler();
  }
  return (req: Request, res: Response, next: NextFunction) => next();
}

/**
 * Start a new transaction for performance tracking
 */
export function startTransaction(name: string, op: string, data?: Record<string, any>) {
  if (!sentryEnabled) return null;
  
  try {
    return Sentry.startTransaction({
      name,
      op,
      data,
    });
  } catch (error) {
    console.error("Failed to start Sentry transaction:", error);
    return null;
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user: { id: string; username?: string; email?: string; role?: string }) {
  if (!sentryEnabled) return;
  
  try {
    Sentry.setUser({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("Failed to set Sentry user context:", error);
  }
}

/**
 * Set tenant context for multi-tenant error tracking
 */
export function setTenantContext(tenantId: string, tenantName?: string) {
  if (!sentryEnabled) return;
  
  try {
    Sentry.setContext("tenant", {
      id: tenantId,
      name: tenantName,
    });
  } catch (error) {
    console.error("Failed to set Sentry tenant context:", error);
  }
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  if (!sentryEnabled) return;
  
  try {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
      timestamp: Date.now() / 1000,
    });
  } catch (error) {
    console.error("Failed to add Sentry breadcrumb:", error);
  }
}

/**
 * Capture an exception with additional context
 */
export function captureException(error: Error, context?: {
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: { id: string; username?: string };
  tenant?: { id: string; name?: string };
  request?: any;
}) {
  if (!sentryEnabled) {
    // Fallback to console logging
    console.error("[ERROR]", error);
    if (context?.extra) {
      console.error("[CONTEXT]", JSON.stringify(context.extra, null, 2));
    }
    return null;
  }
  
  try {
    // Build contexts object with tenant info if provided
    const contexts: any = {};
    if (context?.request) {
      contexts.request = context.request;
    }
    if (context?.tenant) {
      contexts.tenant = {
        id: context.tenant.id,
        name: context.tenant.name,
      };
    }
    
    return Sentry.captureException(error, {
      level: context?.level || 'error',
      tags: context?.tags,
      extra: context?.extra,
      user: context?.user,
      contexts: Object.keys(contexts).length > 0 ? contexts : undefined,
    });
  } catch (err) {
    console.error("Failed to capture exception in Sentry:", err);
    return null;
  }
}

/**
 * Capture a message with context
 */
export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info', context?: Record<string, any>) {
  if (!sentryEnabled) {
    const logLevel = level === 'fatal' || level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';
    console[logLevel](`[${level.toUpperCase()}]`, message, context || '');
    return null;
  }
  
  try {
    return Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  } catch (error) {
    console.error("Failed to capture message in Sentry:", error);
    return null;
  }
}

/**
 * Check if Sentry is enabled and configured
 */
export function isSentryEnabled(): boolean {
  return sentryEnabled && sentryConfigured;
}

/**
 * Get Sentry status for health checks
 */
export function getSentryStatus() {
  return {
    enabled: sentryEnabled,
    configured: sentryConfigured,
    dsn_set: !!process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
  };
}

export default {
  isSentryEnabled,
  getSentryStatus,
  getSentryRequestHandler,
  getSentryTracingHandler,
  getSentryErrorHandler,
  startTransaction,
  setUserContext,
  setTenantContext,
  addBreadcrumb,
  captureException,
  captureMessage,
};
