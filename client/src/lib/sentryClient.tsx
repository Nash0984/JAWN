/**
 * Sentry Client Configuration
 * 
 * Simple, robust error boundary that works without any startup dependencies.
 * Sentry is only loaded lazily when an error occurs AND DSN is configured.
 */

import * as React from "react";
import { ReactNode } from "react";

// Sentry state - starts null, loaded lazily only when needed
let Sentry: any = null;
let sentryInitialized = false;

// Check if DSN is configured (can be checked synchronously)
const SENTRY_DSN = typeof window !== 'undefined' 
  ? (import.meta.env.VITE_SENTRY_DSN || '') 
  : '';

/**
 * Lazily initialize Sentry - only called when an error actually occurs
 * This avoids all timing issues with React initialization
 */
async function initializeSentryLazily(): Promise<boolean> {
  // Already initialized
  if (sentryInitialized) return true;
  
  // No DSN configured
  if (!SENTRY_DSN) {
    return false;
  }
  
  try {
    const sentryModule = await import("@sentry/react");
    Sentry = sentryModule;
    
    const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || "development";
    const tracesSampleRate = parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || "0.1");
    
    Sentry.init({
      dsn: SENTRY_DSN,
      environment,
      tracesSampleRate,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      beforeSend(event: any) {
        // Scrub PII from error messages
        if (event.exception?.values) {
          event.exception.values.forEach((exception: any) => {
            if (exception.value) {
              exception.value = exception.value
                .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN REDACTED]")
                .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL REDACTED]")
                .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE REDACTED]");
            }
          });
        }
        return event;
      },
    });
    
    sentryInitialized = true;
    console.log(`✅ Sentry initialized (${environment}) on frontend`);
    return true;
  } catch (error) {
    console.warn("⚠️  Failed to load Sentry:", error);
    return false;
  }
}

// Log once at startup if DSN is not configured
if (typeof window !== 'undefined' && !SENTRY_DSN) {
  console.warn("⚠️  Sentry DSN not configured (VITE_SENTRY_DSN). Frontend error tracking disabled.");
}

/**
 * Simple Error Boundary Component
 * 
 * This is a pure React class component with zero external dependencies at startup.
 * Sentry is only loaded lazily when an error is caught.
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SentryErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    
    // Lazily load and report to Sentry only when an error actually occurs
    if (SENTRY_DSN) {
      initializeSentryLazily().then((initialized) => {
        if (initialized && Sentry?.captureException) {
          Sentry.captureException(error, { 
            extra: { componentStack: errorInfo.componentStack } 
          });
        }
      });
    }
  }

  render() {
    const { children, fallback } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      if (fallback) {
        return <>{fallback}</>;
      }
      
      return (
        <div style={{ 
          padding: '40px 20px', 
          textAlign: 'center', 
          fontFamily: 'system-ui, -apple-system, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ maxWidth: '400px' }}>
            <h2 style={{ color: '#dc2626', marginBottom: '16px', fontSize: '24px' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#64748b', marginBottom: '24px', lineHeight: '1.6' }}>
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            <button 
              onClick={() => window.location.reload()}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              Refresh Page
            </button>
            {import.meta.env.DEV && error && (
              <pre style={{ 
                marginTop: '24px', 
                padding: '16px', 
                backgroundColor: '#1e293b', 
                color: '#f1f5f9',
                borderRadius: '8px',
                textAlign: 'left',
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return <>{children}</>;
  }
}

/**
 * Set user context - only works if Sentry has been initialized
 */
export function setUserContext(user: { id: string; username?: string; email?: string; role?: string } | null) {
  if (!sentryInitialized || !Sentry) return;
  
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
    // Silently fail
  }
}

/**
 * Capture an exception - lazily initializes Sentry if needed
 */
export async function captureException(error: Error, context?: Record<string, any>): Promise<string | null> {
  // Always log to console
  console.error("[Frontend Error]", error, context);
  
  if (!SENTRY_DSN) return null;
  
  const initialized = await initializeSentryLazily();
  if (!initialized || !Sentry) return null;
  
  try {
    return Sentry.captureException(error, { extra: context });
  } catch (err) {
    return null;
  }
}

/**
 * Capture a message - lazily initializes Sentry if needed
 */
export async function captureMessage(
  message: string, 
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): Promise<string | null> {
  // Always log to console
  const logLevel = level === 'fatal' || level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';
  console[logLevel](`[${level.toUpperCase()}]`, message);
  
  if (!SENTRY_DSN) return null;
  
  const initialized = await initializeSentryLazily();
  if (!initialized || !Sentry) return null;
  
  try {
    return Sentry.captureMessage(message, level);
  } catch (error) {
    return null;
  }
}

/**
 * Add a breadcrumb - only works if Sentry is already initialized
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  if (!sentryInitialized || !Sentry) return;
  
  try {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  } catch (error) {
    // Silently fail
  }
}

/**
 * Check if Sentry is enabled (DSN configured)
 */
export function isSentryEnabled(): boolean {
  return Boolean(SENTRY_DSN);
}

/**
 * Check if Sentry has been initialized
 */
export function isSentryInitialized(): boolean {
  return sentryInitialized;
}

// Deprecated - kept for backward compatibility
export function getSentryErrorBoundary() {
  return SentryErrorBoundary;
}

export default {
  SentryErrorBoundary,
  getSentryErrorBoundary,
  setUserContext,
  captureException,
  captureMessage,
  addBreadcrumb,
  isSentryEnabled,
  isSentryInitialized,
};
