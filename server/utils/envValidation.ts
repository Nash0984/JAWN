/**
 * Environment Variable Validation
 * 
 * Validates required environment variables on startup
 * Fails fast with clear error messages if configuration is invalid
 */

interface EnvConfig {
  name: string;
  required: boolean;
  validator?: (value: string) => boolean;
  errorMessage?: string;
  defaultValue?: string;
}

const ENV_CONFIGS: EnvConfig[] = [
  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    validator: (val) => val.startsWith('postgres://') || val.startsWith('postgresql://'),
    errorMessage: 'DATABASE_URL must be a valid PostgreSQL connection string',
  },
  
  // Session Management
  {
    name: 'SESSION_SECRET',
    required: true,
    validator: (val) => val.length >= 32,
    errorMessage: 'SESSION_SECRET must be at least 32 characters for security',
  },
  
  // AI/ML Services
  {
    name: 'GEMINI_API_KEY',
    required: false, // Can also use GOOGLE_API_KEY
    validator: (val) => val.length > 20,
    errorMessage: 'GEMINI_API_KEY appears to be invalid',
  },
  {
    name: 'GOOGLE_API_KEY',
    required: false, // Can also use GEMINI_API_KEY
    validator: (val) => val.length > 20,
    errorMessage: 'GOOGLE_API_KEY appears to be invalid',
  },
  
  // Encryption (production only)
  {
    name: 'ENCRYPTION_KEY',
    required: process.env.NODE_ENV === 'production',
    validator: (val) => /^[0-9a-f]{64}$/i.test(val),
    errorMessage: 'ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes)',
  },
  
  // CORS Configuration (required for all non-dev/test environments)
  {
    name: 'ALLOWED_ORIGINS',
    required: process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test',
    validator: (val) => val.split(',').every(origin => origin.trim().startsWith('http://') || origin.trim().startsWith('https://')),
    errorMessage: 'ALLOWED_ORIGINS must be a comma-separated list of valid HTTP/HTTPS URLs (required for production/staging environments)',
  },
  
  // Google Cloud Storage
  {
    name: 'GOOGLE_APPLICATION_CREDENTIALS',
    required: false, // Optional, falls back to default credentials
  },
  
  // Object Storage Configuration
  {
    name: 'GCS_BUCKET_NAME',
    required: false,
  },
  
  // External APIs
  {
    name: 'DATA_GOV_API_KEY',
    required: false,
  },
  
  // Email Service (optional)
  {
    name: 'SMTP_HOST',
    required: false,
  },
  {
    name: 'SMTP_PORT',
    required: false,
    validator: (val) => {
      const port = parseInt(val, 10);
      return !isNaN(port) && port > 0 && port <= 65535;
    },
    errorMessage: 'SMTP_PORT must be a valid port number',
  },
  {
    name: 'SMTP_USER',
    required: false,
  },
  {
    name: 'SMTP_PASS',
    required: false,
  },
  {
    name: 'SMTP_FROM_EMAIL',
    required: false,
    validator: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    errorMessage: 'SMTP_FROM_EMAIL must be a valid email address',
  },
  
  // Rate Limiting
  {
    name: 'RATE_LIMIT_WINDOW_MS',
    required: false,
    defaultValue: '900000', // 15 minutes
    validator: (val) => !isNaN(parseInt(val, 10)),
  },
  {
    name: 'RATE_LIMIT_MAX_REQUESTS',
    required: false,
    defaultValue: '100',
    validator: (val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
  },
  
  // Node Environment
  {
    name: 'NODE_ENV',
    required: false,
    defaultValue: 'development',
    validator: (val) => ['development', 'production', 'test'].includes(val),
    errorMessage: 'NODE_ENV must be one of: development, production, test',
  },
  
  // Port
  {
    name: 'PORT',
    required: false,
    defaultValue: '5000',
    validator: (val) => {
      const port = parseInt(val, 10);
      return !isNaN(port) && port > 0 && port <= 65535;
    },
    errorMessage: 'PORT must be a valid port number',
  },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class EnvValidator {
  
  /**
   * Validate all environment variables
   */
  static validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if at least one AI API key is present
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasGoogle = !!process.env.GOOGLE_API_KEY;
    
    if (!hasGemini && !hasGoogle) {
      errors.push('Either GEMINI_API_KEY or GOOGLE_API_KEY must be set for AI functionality');
    }
    
    // Validate each config
    for (const config of ENV_CONFIGS) {
      const value = process.env[config.name];
      
      // Check required variables
      if (config.required && !value) {
        errors.push(`${config.name} is required but not set`);
        continue;
      }
      
      // Set default if missing
      if (!value && config.defaultValue) {
        process.env[config.name] = config.defaultValue;
        continue;
      }
      
      // Skip validation if not set and not required
      if (!value) {
        continue;
      }
      
      // Run custom validator
      if (config.validator && !config.validator(value)) {
        errors.push(config.errorMessage || `${config.name} has invalid value`);
      }
    }
    
    // Production-specific checks
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.ENCRYPTION_KEY) {
        errors.push('ENCRYPTION_KEY is required in production for PII encryption');
      }
      
      if (process.env.SESSION_SECRET === 'dev-secret-change-in-production') {
        errors.push('SESSION_SECRET must be changed from default value in production');
      }
    }
    
    // Development warnings
    if (process.env.NODE_ENV === 'development') {
      if (!process.env.ENCRYPTION_KEY) {
        warnings.push('ENCRYPTION_KEY not set - using development-only key (DO NOT USE IN PRODUCTION)');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  /**
   * Validate and throw on failure (for startup)
   */
  static validateOrThrow(): void {
    const result = this.validate();
    
    // Print warnings
    if (result.warnings.length > 0) {
      console.warn('\n⚠️  Environment Warnings:');
      result.warnings.forEach(warning => console.warn(`  - ${warning}`));
      console.warn('');
    }
    
    // Throw on errors
    if (!result.valid) {
      console.error('\n❌ Environment Validation Failed:');
      result.errors.forEach(error => console.error(`  - ${error}`));
      console.error('\nPlease check your .env file and set all required environment variables.\n');
      throw new Error('Environment validation failed');
    }
    
    console.log('✅ Environment validation passed\n');
  }
  
  /**
   * Get environment configuration summary (safe for logging)
   */
  static getSummary(): Record<string, string> {
    const summary: Record<string, string> = {};
    
    for (const config of ENV_CONFIGS) {
      const value = process.env[config.name];
      
      if (!value) {
        summary[config.name] = 'not set';
        continue;
      }
      
      // Mask sensitive values
      const isSensitive = config.name.includes('KEY') ||
                         config.name.includes('SECRET') ||
                         config.name.includes('PASS') ||
                         config.name.includes('TOKEN');
      
      if (isSensitive) {
        summary[config.name] = value.length > 8 
          ? `${value.slice(0, 4)}...${value.slice(-4)}` 
          : '***';
      } else {
        summary[config.name] = value;
      }
    }
    
    return summary;
  }
}
