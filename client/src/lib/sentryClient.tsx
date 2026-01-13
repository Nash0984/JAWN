/**
 * Sentry Client Configuration
 * 
 * Initializes Sentry for frontend error tracking and performance monitoring
 * with graceful degradation when packages are not available
 */

import * as React from "react";
import { ComponentType, ReactNode } from "react";

let Sentry: any = null;
let sentryEnabled = false;
let initializationPromise: Promise<void> | null = null;

// Try to import Sentry packages - gracefully handle if not installed
async function initializeSentry() {
  // Early return if DSN is not configured - prevents unnecessary module loading
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn("⚠️  Sentry DSN not configured (VITE_SENTRY_DSN). Frontend error tracking disabled.");
    return;
  }
  
  try {
    const sentryModule = await import("@sentry/react");
    Sentry = sentryModule.default || sentryModule;
    
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
        beforeSend(event: any, hint: any) {
          // Remove PII from error messages
          if (event.exception?.values) {
            event.exception.values.forEach((exception: any) => {
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
      // Keep: Sentry initialization confirmation - important for production monitoring
      console.log(`✅ Sentry initialized (${environment}) on frontend`);
    }
  } catch (error) {
    // Keep: Sentry package warning - important for setup diagnostics
    console.warn("⚠️  Sentry packages not installed. Frontend error tracking disabled.");
    sentryEnabled = false;
  }
}

// Initialize Sentry and store the promise
if (typeof window !== 'undefined') {
  initializationPromise = initializeSentry();
}

/**
 * Sentry Error Boundary Component
 * Simple passthrough error boundary - Sentry integration disabled to avoid hook conflicts
 * Uses a class component for React error boundary compatibility
 */
interface SentryErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SentryErrorBoundary extends React.Component<
  { children: ReactNode },
  SentryErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SentryErrorBoundary] Caught error:', error, errorInfo);
    if (sentryEnabled && Sentry?.captureException) {
      try {
        Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
      } catch (e) {
        // Silently fail if Sentry is not available
      }
    }
  }

  render() {
    const { children } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ color: '#e53e3e', marginBottom: '16px' }}>Something went wrong</h2>
          <p style={{ color: '#4a5568', marginBottom: '16px' }}>
            We're sorry, but something unexpected happened.
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#3182ce', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
          {import.meta.env.DEV && error && (
            <pre style={{ 
              marginTop: '20px', 
              padding: '12px', 
              backgroundColor: '#f7fafc', 
              borderRadius: '4px',
              textAlign: 'left',
              fontSize: '12px',
              overflow: 'auto'
            }}>
              {error.message}
            </pre>
          )}
        </div>
      );
    }

    return <>{children}</>;
  }
}

/**
 * Get Sentry Error Boundary component (deprecated - use SentryErrorBoundary component instead)
 * @deprecated Use SentryErrorBoundary component for proper async handling
 */
export function getSentryErrorBoundary() {
  if (sentryEnabled && Sentry?.ErrorBoundary) {
    return Sentry.ErrorBoundary;
  }
  // Return a fallback error boundary
  return ({ children }: { children: ReactNode }) => <>{children}</>;
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
    // console.error("Failed to set Sentry user context:", error);
  }
}

/**
 * Capture an exception
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (!sentryEnabled) {
    // Keep: Fallback error logging when Sentry is disabled - important for debugging
    console.error("[Frontend Error]", error, context);
    return null;
  }
  
  try {
    return Sentry.captureException(error, {
      extra: context,
    });
  } catch (err) {
    // console.error("Failed to capture exception in Sentry:", err);
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
    // console.error("Failed to capture message in Sentry:", error);
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
    // console.error("Failed to add Sentry breadcrumb:", error);
  }
}

/**
 * Check if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

// Also export as default for backward compatibility
export default {
  SentryErrorBoundary,
  getSentryErrorBoundary,
  setUserContext,
  captureException,
  captureMessage,
  addBreadcrumb,
  isSentryEnabled,
};
