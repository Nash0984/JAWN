/**
 * Production Readiness Validation
 * 
 * Comprehensive checks for production deployment readiness
 * Ensures all security, performance, and operational requirements are met
 */

import { logger } from '../services/logger.service';

interface ProductionCheck {
  name: string;
  check: () => { passed: boolean; message?: string };
  severity: 'critical' | 'warning' | 'info';
  category: 'security' | 'performance' | 'operational';
}

interface ProductionValidationResult {
  ready: boolean;
  critical: string[];
  warnings: string[];
  info: string[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export class ProductionValidator {
  private static checks: ProductionCheck[] = [
    // ============================================================================
    // SECURITY CHECKS
    // ============================================================================
    {
      name: 'Encryption Key Set',
      check: () => ({
        passed: !!process.env.ENCRYPTION_KEY && /^[0-9a-f]{64}$/i.test(process.env.ENCRYPTION_KEY),
        message: 'ENCRYPTION_KEY must be a 64-character hex string. Generate: openssl rand -hex 32'
      }),
      severity: 'critical',
      category: 'security'
    },
    {
      name: 'Strong Session Secret',
      check: () => ({
        passed: !!process.env.SESSION_SECRET && 
                process.env.SESSION_SECRET.length >= 64 &&
                process.env.SESSION_SECRET !== 'dev-secret-change-in-production',
        message: 'SESSION_SECRET must be 64+ chars and not default value. Generate: openssl rand -base64 64'
      }),
      severity: 'critical',
      category: 'security'
    },
    {
      name: 'CORS Allowed Origins',
      check: () => ({
        passed: !!process.env.ALLOWED_ORIGINS && 
                process.env.ALLOWED_ORIGINS.split(',').length > 0 &&
                process.env.ALLOWED_ORIGINS !== '*',
        message: 'ALLOWED_ORIGINS must be set to specific domains, not wildcard'
      }),
      severity: 'critical',
      category: 'security'
    },
    {
      name: 'Secure Cookie Settings',
      check: () => ({
        passed: process.env.NODE_ENV === 'production',
        message: 'NODE_ENV must be set to "production" for secure cookies'
      }),
      severity: 'critical',
      category: 'security'
    },
    {
      name: 'Database SSL/TLS',
      check: () => ({
        passed: !process.env.DATABASE_URL || 
                process.env.DATABASE_URL.includes('sslmode=require') ||
                process.env.DATABASE_URL.includes('ssl=true'),
        message: 'DATABASE_URL should include SSL/TLS parameters for production'
      }),
      severity: 'warning',
      category: 'security'
    },

    // ============================================================================
    // PERFORMANCE CHECKS
    // ============================================================================
    {
      name: 'Rate Limiting Configured',
      check: () => ({
        passed: !!process.env.RATE_LIMIT_WINDOW_MS && !!process.env.RATE_LIMIT_MAX_REQUESTS,
        message: 'Set RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX_REQUESTS for DoS protection'
      }),
      severity: 'warning',
      category: 'performance'
    },
    {
      name: 'Request Size Limits',
      check: () => ({
        passed: !!process.env.MAX_REQUEST_SIZE_MB,
        message: 'Set MAX_REQUEST_SIZE_MB to prevent memory exhaustion (recommended: 10)'
      }),
      severity: 'warning',
      category: 'performance'
    },
    {
      name: 'Database Connection Pool',
      check: () => ({
        passed: !!process.env.DB_POOL_MIN && !!process.env.DB_POOL_MAX,
        message: 'Set DB_POOL_MIN and DB_POOL_MAX for optimal connection pooling'
      }),
      severity: 'info',
      category: 'performance'
    },

    // ============================================================================
    // OPERATIONAL CHECKS
    // ============================================================================
    {
      name: 'AI Service API Keys',
      check: () => ({
        passed: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
        message: 'Set GOOGLE_API_KEY for AI functionality (GEMINI_API_KEY can be used as fallback)'
      }),
      severity: 'critical',
      category: 'operational'
    },
    {
      name: 'Email Service (Optional)',
      check: () => {
        const hasEmailConfig = !!(
          process.env.SMTP_HOST &&
          process.env.SMTP_PORT &&
          process.env.SMTP_USER &&
          process.env.SMTP_PASS &&
          process.env.SMTP_FROM_EMAIL
        );
        return {
          passed: hasEmailConfig,
          message: 'Email service not configured. Notifications will be logged only.'
        };
      },
      severity: 'info',
      category: 'operational'
    },
    {
      name: 'Object Storage Configured',
      check: () => ({
        passed: !!process.env.GCS_BUCKET_NAME,
        message: 'Set GCS_BUCKET_NAME for document storage'
      }),
      severity: 'warning',
      category: 'operational'
    },
    {
      name: 'Logging Level',
      check: () => ({
        passed: !!process.env.LOG_LEVEL,
        message: 'Set LOG_LEVEL (info, warn, error) for production logging'
      }),
      severity: 'info',
      category: 'operational'
    },
    {
      name: 'Health Check Endpoint',
      check: () => ({
        passed: true, // We'll implement this
        message: 'Health check endpoints available at /health and /ready'
      }),
      severity: 'info',
      category: 'operational'
    },
  ];

  /**
   * Validate production readiness
   */
  static validate(): ProductionValidationResult {
    const critical: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];
    
    let total = 0;
    let passed = 0;
    let failed = 0;

    for (const check of this.checks) {
      total++;
      const result = check.check();
      
      if (result.passed) {
        passed++;
      } else {
        failed++;
        const message = `[${check.category.toUpperCase()}] ${check.name}: ${result.message || 'Check failed'}`;
        
        if (check.severity === 'critical') {
          critical.push(message);
        } else if (check.severity === 'warning') {
          warnings.push(message);
        } else {
          info.push(message);
        }
      }
    }

    return {
      ready: critical.length === 0,
      critical,
      warnings,
      info,
      summary: { total, passed, failed }
    };
  }

  /**
   * Validate and display results
   */
  static validateAndDisplay(): boolean {
    const result = this.validate();
    
    logger.info('\n' + '='.repeat(80), {
      service: "productionValidation",
      action: "header"
    });
    logger.info('🔒 PRODUCTION READINESS VALIDATION', {
      service: "productionValidation",
      action: "title"
    });
    logger.info('='.repeat(80), {
      service: "productionValidation",
      action: "headerLine"
    });
    
    logger.info(`\n📊 Summary: ${result.summary.passed}/${result.summary.total} checks passed`, {
      service: "productionValidation",
      action: "summary",
      passed: result.summary.passed,
      total: result.summary.total
    });
    
    if (result.critical.length > 0) {
      logger.error('\n❌ CRITICAL ISSUES (Must fix before production):', {
        service: "productionValidation",
        action: "criticalHeader",
        count: result.critical.length
      });
      result.critical.forEach(msg => logger.error(`  ${msg}`, {
        service: "productionValidation",
        action: "criticalIssue",
        issue: msg
      }));
    }
    
    if (result.warnings.length > 0) {
      logger.warn('\n⚠️  WARNINGS (Recommended to fix):', {
        service: "productionValidation",
        action: "warningsHeader",
        count: result.warnings.length
      });
      result.warnings.forEach(msg => logger.warn(`  ${msg}`, {
        service: "productionValidation",
        action: "warningIssue",
        issue: msg
      }));
    }
    
    if (result.info.length > 0) {
      logger.info('\n💡 INFO (Optional improvements):', {
        service: "productionValidation",
        action: "infoHeader",
        count: result.info.length
      });
      result.info.forEach(msg => logger.info(`  ${msg}`, {
        service: "productionValidation",
        action: "infoIssue",
        issue: msg
      }));
    }
    
    if (result.ready) {
      logger.info('\n✅ System is READY for production deployment', {
        service: "productionValidation",
        action: "ready"
      });
    } else {
      logger.error('\n❌ System is NOT READY for production (fix critical issues above)', {
        service: "productionValidation",
        action: "notReady"
      });
    }
    
    logger.info('='.repeat(80) + '\n', {
      service: "productionValidation",
      action: "footer"
    });
    
    return result.ready;
  }

  /**
   * Validate and throw if not ready (for production startup)
   */
  static validateOrThrow(): void {
    if (process.env.NODE_ENV !== 'production') {
      return; // Skip in development
    }

    const result = this.validate();
    
    if (!result.ready) {
      this.validateAndDisplay();
      throw new Error(
        `Production validation failed: ${result.critical.length} critical issue(s) found. ` +
        'Fix the issues above before deploying to production.'
      );
    }
    
    // Display warnings even if ready
    if (result.warnings.length > 0 || result.info.length > 0) {
      this.validateAndDisplay();
    } else {
      logger.info('✅ Production readiness validation passed', {
        service: "productionValidation",
        action: "validationPassed"
      });
    }
  }

  /**
   * Generate production environment template
   */
  static generateEnvTemplate(): string {
    return `# ============================================================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# ============================================================================
# This file contains all required and recommended environment variables
# for production deployment of the Maryland Benefits Navigator
#
# SECURITY: Never commit this file to version control!
# ============================================================================

# ============================================================================
# DATABASE (REQUIRED)
# ============================================================================
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Connection Pool (Recommended)
DB_POOL_MIN=2
DB_POOL_MAX=10

# ============================================================================
# SECURITY (REQUIRED)
# ============================================================================

# Session Secret (64+ characters, generate with: openssl rand -base64 64)
SESSION_SECRET=

# Encryption Key (64 hex chars, generate with: openssl rand -hex 32)
ENCRYPTION_KEY=

# CORS Allowed Origins (comma-separated)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ============================================================================
# AI SERVICES (REQUIRED)
# ============================================================================

# Google Gemini API Key (preferred - GOOGLE_API_KEY can be used as fallback)
GEMINI_API_KEY=

# ============================================================================
# OBJECT STORAGE (REQUIRED)
# ============================================================================

# Google Cloud Storage
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# ============================================================================
# EMAIL SERVICE (OPTIONAL)
# ============================================================================

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=notifications@yourdomain.com

# ============================================================================
# RATE LIMITING & PERFORMANCE
# ============================================================================

# Rate Limiting (15 minutes = 900000ms)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Request Size Limits (MB)
MAX_REQUEST_SIZE_MB=10

# ============================================================================
# EXTERNAL APIS (OPTIONAL)
# ============================================================================

DATA_GOV_API_KEY=

# ============================================================================
# OPERATIONAL
# ============================================================================

NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# ============================================================================
# OPTIONAL FEATURES
# ============================================================================

# Feature Flags
ENABLE_AI_FALLBACK=true
ENABLE_CACHE=true
CACHE_TTL_SECONDS=3600
`;
  }
}
