/**
 * Production Logging Service
 * 
 * Centralized logging with structured output, environment-aware levels,
 * and integration with monitoring services like Sentry.
 * 
 * This replaces all console.log/error/warn statements for production readiness.
 */

import * as Sentry from '@sentry/node';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
type LogContext = Record<string, any>;

interface LogMessage {
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  timestamp: string;
  service?: string;
  userId?: string;
  requestId?: string;
  tenantId?: string;
}

class LoggerService {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isTest = process.env.NODE_ENV === 'test';
  private logLevel: LogLevel = this.getLogLevel();
  private serviceName: string = 'jawn-api';

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    fatal: 50
  };

  private readonly levelColors = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
    fatal: '\x1b[35m', // magenta
    reset: '\x1b[0m'
  };

  // PII Patterns for regex-based redaction
  private readonly PII_PATTERNS = {
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  };

  // PII Field names to redact
  private readonly PII_FIELDS = [
    'password', 'ssn', 'socialSecurity', 'creditCard', 
    'token', 'apiKey', 'encryptionKey', 'secret', 'privateKey',
    'sessionId', 'csrf', 'authorization'
  ];

  constructor() {
    // Initialize Sentry if DSN is provided
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: this.isDevelopment ? 1.0 : 0.1,
        beforeSend(event, hint) {
          // Filter out sensitive data from error reports
          if (event.request?.cookies) {
            delete event.request.cookies;
          }
          if (event.extra) {
            // Remove any fields that might contain PII
            const fieldsToRemove = ['ssn', 'password', 'token', 'apiKey', 'creditCard'];
            fieldsToRemove.forEach(field => {
              Object.keys(event.extra).forEach(key => {
                if (key.toLowerCase().includes(field.toLowerCase())) {
                  delete event.extra![key];
                }
              });
            });
          }
          return event;
        }
      });
    }
  }

  private getLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    
    if (envLevel && validLevels.includes(envLevel as LogLevel)) {
      return envLevel as LogLevel;
    }
    
    // Default levels by environment
    if (this.isTest) return 'error';
    if (this.isDevelopment) return 'debug';
    return 'info'; // production default
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel];
  }

  /**
   * Sanitize context object to remove PII before logging
   * Protects against PII leakage in console logs, Docker logs, and log aggregation
   */
  private sanitizeContext(context: LogContext): LogContext {
    if (!context) return context;
    
    const sanitized = { ...context };
    
    // Remove sensitive field names
    this.PII_FIELDS.forEach(field => {
      Object.keys(sanitized).forEach(key => {
        if (key.toLowerCase().includes(field.toLowerCase())) {
          sanitized[key] = '[REDACTED]';
        }
      });
    });
    
    // Redact patterns and recursively sanitize nested structures
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string') {
        // Redact PII patterns in strings
        let value = sanitized[key];
        Object.entries(this.PII_PATTERNS).forEach(([type, pattern]) => {
          value = value.replace(pattern, `[REDACTED_${type.toUpperCase()}]`);
        });
        sanitized[key] = value;
      } 
      else if (Array.isArray(sanitized[key])) {
        // Recursively sanitize arrays
        sanitized[key] = (sanitized[key] as any[]).map(item => {
          if (typeof item === 'string') {
            // Redact PII patterns in array strings
            let value = item;
            Object.entries(this.PII_PATTERNS).forEach(([type, pattern]) => {
              value = value.replace(pattern, `[REDACTED_${type.toUpperCase()}]`);
            });
            return value;
          } else if (typeof item === 'object' && item !== null) {
            // Recursively sanitize objects in arrays
            return this.sanitizeContext(item as LogContext);
          }
          return item;
        });
      }
      else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeContext(sanitized[key] as LogContext);
      }
    });
    
    return sanitized;
  }

  private formatMessage(log: LogMessage): string {
    if (this.isTest) {
      // Minimal output for tests
      return `[${log.level.toUpperCase()}] ${log.message}`;
    }

    if (this.isDevelopment) {
      // Colored, human-readable output for development
      const color = this.levelColors[log.level];
      const reset = this.levelColors.reset;
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      const service = log.service ? ` [${log.service}]` : '';
      
      let output = `${color}${timestamp} [${log.level.toUpperCase()}]${service}${reset} ${log.message}`;
      
      if (log.context && Object.keys(log.context).length > 0) {
        // Pretty print context in development
        const contextStr = Object.entries(log.context)
          .map(([key, value]) => {
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
            return `  ${key}: ${valueStr}`;
          })
          .join('\n');
        output += `\n${contextStr}`;
      }
      
      if (log.error) {
        output += `\n${color}Stack: ${log.error.stack}${reset}`;
      }
      
      return output;
    }

    // Production: Structured JSON output for log aggregation
    return JSON.stringify({
      ...log,
      error: log.error ? {
        message: log.error.message,
        stack: log.error.stack,
        name: log.error.name
      } : undefined
    });
  }

  private log(level: LogLevel, message: string, context?: LogContext | Error): void {
    if (!this.shouldLog(level)) return;

    let logContext: LogContext | undefined;
    let error: Error | undefined;

    // Handle both Error objects and context objects
    if (context instanceof Error) {
      error = context;
      logContext = { errorName: error.name, errorMessage: error.message };
    } else {
      logContext = context;
    }

    // Sanitize context to remove PII before logging
    if (logContext) {
      logContext = this.sanitizeContext(logContext);
    }

    const logMessage: LogMessage = {
      level,
      message,
      context: logContext,
      error,
      timestamp: new Date().toISOString(),
      service: this.serviceName
    };

    const formattedMessage = this.formatMessage(logMessage);

    // Output to console
    if (level === 'error' || level === 'fatal') {
      console.error(formattedMessage);
    } else if (level === 'warn') {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }

    // Send to Sentry for errors and fatals
    if (process.env.SENTRY_DSN && (level === 'error' || level === 'fatal')) {
      if (error) {
        Sentry.captureException(error, {
          level: level === 'fatal' ? 'fatal' : 'error',
          extra: logContext
        });
      } else {
        Sentry.captureMessage(message, level === 'fatal' ? 'fatal' : 'error');
      }
    }

    // Fatal errors should exit the process
    if (level === 'fatal') {
      process.exit(1);
    }
  }

  // Public logging methods
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, contextOrError?: LogContext | Error): void {
    this.log('error', message, contextOrError);
  }

  fatal(message: string, contextOrError?: LogContext | Error): void {
    this.log('fatal', message, contextOrError);
  }

  // Specialized logging methods
  http(req: any, res: any, responseTime: number): void {
    if (!this.shouldLog('info')) return;

    const context = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip
    };

    const level = res.statusCode >= 500 ? 'error' : 
                  res.statusCode >= 400 ? 'warn' : 'info';
    
    this.log(level as LogLevel, `${req.method} ${req.url} ${res.statusCode}`, context);
  }

  database(operation: string, details: any): void {
    this.debug(`Database: ${operation}`, details);
  }

  ai(service: string, operation: string, details: any): void {
    this.info(`AI Service: ${service} - ${operation}`, details);
  }

  security(event: string, details: any): void {
    this.warn(`Security: ${event}`, details);
  }

  performance(metric: string, value: number, details?: any): void {
    this.info(`Performance: ${metric}`, { value, ...details });
  }

  // Create child logger with additional context
  child(context: { service?: string; [key: string]: any }): LoggerService {
    const childLogger = Object.create(this);
    if (context.service) {
      childLogger.serviceName = `${this.serviceName}:${context.service}`;
    }
    // Additional context could be stored and added to all logs
    return childLogger;
  }

  // Utility to suppress logs in specific scenarios
  silent(): LoggerService {
    const silentLogger = Object.create(this);
    silentLogger.shouldLog = () => false;
    return silentLogger;
  }
}

// Export singleton instance
export const logger = new LoggerService();

// Export for service-specific loggers
export const createLogger = (serviceName: string) => {
  return logger.child({ service: serviceName });
};

// Convenience exports for common use cases
export default logger;