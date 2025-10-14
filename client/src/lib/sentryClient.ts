/**
 * Sentry Client Configuration
 * 
 * Initializes Sentry for frontend error tracking and performance monitoring
 * with graceful degradation when packages are not available
 */

let Sentry: any = null;
let sentryEnabled = false;

// Try to import Sentry packages - gracefully handle if not installed
try {
  Sentry = require("@sentry/react");
  
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (dsn) {
    const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || "development";
    const tracesSampleRate = parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || "0.1");
    
    Sentry.init({
      dsn,
      environment,
      
      // Performance monitoring
      tracesSampleRate,
      
      // Integrations
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true, // Mask all text to protect PII
          blockAllMedia: true, // Block all media
        }),
      ],
      
      // Session replay sample rate
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0, // Always capture replay on error
      
      // PII filtering
      beforeSend(event, hint) {
        // Remove PII from error messages
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
        
        return event;
      },
    });
    
    sentryEnabled = true;
    console.log(`✅ Sentry initialized (${environment}) on frontend`);
  } else {
    console.warn("⚠️  Sentry DSN not configured (VITE_SENTRY_DSN). Frontend error tracking disabled.");
  }
} catch (error) {
  console.warn("⚠️  Sentry packages not installed. Frontend error tracking disabled.");
  sentryEnabled = false;
}

/**
 * Get Sentry Error Boundary component
 */
export function getSentryErrorBoundary() {
  if (sentryEnabled && Sentry?.ErrorBoundary) {
    return Sentry.ErrorBoundary;
  }
  // Return a fallback error boundary
  return ({ children }: { children: React.ReactNode }) => <>{children}</>;
}

/**
 * Set user context
 */
export function setUserContext(user: { id: string; username?: string; email?: string; role?: string } | null) {
  if (!sentryEnabled) return;
  
  try {
    if (user) {
      Sentry.setUser({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      });
    } else {
      Sentry.setUser(null);
    }
  } catch (error) {
    console.error("Failed to set Sentry user context:", error);
  }
}

/**
 * Capture an exception
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (!sentryEnabled) {
    console.error("[Frontend Error]", error, context);
    return null;
  }
  
  try {
    return Sentry.captureException(error, {
      extra: context,
    });
  } catch (err) {
    console.error("Failed to capture exception in Sentry:", err);
    return null;
  }
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info') {
  if (!sentryEnabled) {
    const logLevel = level === 'fatal' || level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';
    console[logLevel](`[${level.toUpperCase()}]`, message);
    return null;
  }
  
  try {
    return Sentry.captureMessage(message, level);
  } catch (error) {
    console.error("Failed to capture message in Sentry:", error);
    return null;
  }
}

/**
 * Add a breadcrumb
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  if (!sentryEnabled) return;
  
  try {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  } catch (error) {
    console.error("Failed to add Sentry breadcrumb:", error);
  }
}

/**
 * Check if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

export default {
  getSentryErrorBoundary,
  setUserContext,
  captureException,
  captureMessage,
  addBreadcrumb,
  isSentryEnabled,
};
