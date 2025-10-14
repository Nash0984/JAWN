/**
 * Shared Sentry Utilities for Frontend and Backend
 * 
 * Provides consistent error tracking and performance monitoring
 * across both client and server with graceful degradation
 */

export interface SentryUser {
  id: string;
  username?: string;
  email?: string;
  role?: string;
}

export interface SentryTenant {
  id: string;
  name?: string;
}

export interface SentryContext {
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: SentryUser;
  tenant?: SentryTenant;
  request?: any;
}

/**
 * Capture an exception with context (includes tenant isolation)
 */
export function captureException(error: Error, context?: SentryContext): string | null {
  // This is a placeholder that will be implemented differently on client and server
  const tenantInfo = context?.tenant ? ` [Tenant: ${context.tenant.id}]` : '';
  console.error(`[Sentry Utils] Exception${tenantInfo}:`, error, context);
  return null;
}

/**
 * Capture a message with level
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
): string | null {
  const logLevel = level === 'fatal' || level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';
  console[logLevel](`[Sentry Utils] ${level.toUpperCase()}:`, message, context || '');
  return null;
}

/**
 * Set user context for subsequent error reports
 */
export function setUserContext(user: SentryUser | null): void {
  console.log("[Sentry Utils] User context set:", user?.id);
}

/**
 * Set tenant context for multi-tenant applications
 * Accepts either a full tenant object or just the ID with optional name
 */
export function setTenantContext(tenant: SentryTenant | string | null, name?: string): void {
  if (typeof tenant === 'string') {
    console.log("[Sentry Utils] Tenant context set:", tenant, name || '');
  } else {
    console.log("[Sentry Utils] Tenant context set:", tenant?.id, tenant?.name || '');
  }
}

/**
 * Add a breadcrumb to track user actions
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>,
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
): void {
  console.log(`[Sentry Utils] Breadcrumb [${category}]:`, message, data);
}

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string, data?: Record<string, any>): any {
  console.log(`[Sentry Utils] Transaction started: ${name} (${op})`, data);
  return {
    finish: () => console.log(`[Sentry Utils] Transaction finished: ${name}`),
    setStatus: (status: string) => console.log(`[Sentry Utils] Transaction status: ${status}`),
    setTag: (key: string, value: string) => console.log(`[Sentry Utils] Transaction tag: ${key}=${value}`),
    setData: (key: string, value: any) => console.log(`[Sentry Utils] Transaction data: ${key}`, value),
  };
}

/**
 * Check if Sentry is available and configured
 */
export function isSentryEnabled(): boolean {
  return false; // Overridden in actual implementations
}

export default {
  captureException,
  captureMessage,
  setUserContext,
  setTenantContext,
  addBreadcrumb,
  startTransaction,
  isSentryEnabled,
};
