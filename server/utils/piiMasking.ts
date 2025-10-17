/**
 * PII Data Masking Utilities
 * 
 * Redacts sensitive information from logs, error messages, and responses
 * Prevents accidental exposure of SSNs, account numbers, passwords, API keys
 */

const SSN_PATTERN = /\b\d{3}-?\d{2}-?\d{4}\b/g;
const ACCOUNT_NUMBER_PATTERN = /\b\d{4,17}\b/g;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_PATTERN = /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const CREDIT_CARD_PATTERN = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
const API_KEY_PATTERN = /\b[A-Za-z0-9]{32,}\b/g;

// Common sensitive field names
const SENSITIVE_FIELDS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'apikey',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'ssn',
  'socialSecurityNumber',
  'social_security_number',
  'accountNumber',
  'account_number',
  'bankAccount',
  'bank_account',
  'routingNumber',
  'routing_number',
  'creditCard',
  'credit_card',
  'cvv',
  'pin',
  'dob',
  'dateOfBirth',
  'date_of_birth',
];

export class PiiMaskingUtils {
  
  /**
   * Mask SSN (XXX-XX-1234)
   */
  static maskSSN(value: string): string {
    return value.replace(SSN_PATTERN, (match) => {
      const cleaned = match.replace(/[^0-9]/g, '');
      if (cleaned.length === 9) {
        return `XXX-XX-${cleaned.slice(-4)}`;
      }
      return 'XXX-XX-XXXX';
    });
  }
  
  /**
   * Mask account number (****1234)
   */
  static maskAccountNumber(value: string): string {
    if (value.length >= 4) {
      return '*'.repeat(value.length - 4) + value.slice(-4);
    }
    return '****';
  }
  
  /**
   * Mask email (j***@example.com)
   */
  static maskEmail(email: string): string {
    return email.replace(EMAIL_PATTERN, (match) => {
      const [local, domain] = match.split('@');
      if (local.length <= 2) {
        return `${local[0]}***@${domain}`;
      }
      return `${local[0]}***${local[local.length - 1]}@${domain}`;
    });
  }
  
  /**
   * Mask phone number (XXX-XXX-1234)
   */
  static maskPhone(phone: string): string {
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) {
      return `XXX-XXX-${cleaned.slice(-4)}`;
    }
    if (cleaned.length === 11) {
      return `X-XXX-XXX-${cleaned.slice(-4)}`;
    }
    return 'XXX-XXX-XXXX';
  }
  
  /**
   * Mask credit card (****-****-****-1234)
   */
  static maskCreditCard(card: string): string {
    const cleaned = card.replace(/[^0-9]/g, '');
    if (cleaned.length === 16) {
      return `****-****-****-${cleaned.slice(-4)}`;
    }
    return '****-****-****-****';
  }
  
  /**
   * Mask a string value (generic redaction)
   */
  static maskString(value: string, visibleChars: number = 4): string {
    if (value.length <= visibleChars) {
      return '*'.repeat(value.length);
    }
    return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
  }
  
  /**
   * Redact PII from a string (log messages, error messages, etc.)
   */
  static redactPII(text: string): string {
    if (!text) return text;
    
    let redacted = text;
    
    // Redact SSNs
    redacted = redacted.replace(SSN_PATTERN, 'XXX-XX-XXXX');
    
    // Redact credit cards
    redacted = redacted.replace(CREDIT_CARD_PATTERN, '****-****-****-****');
    
    // Redact emails (partial)
    redacted = redacted.replace(EMAIL_PATTERN, (match) => this.maskEmail(match));
    
    // Redact phone numbers
    redacted = redacted.replace(PHONE_PATTERN, 'XXX-XXX-XXXX');
    
    // Redact long alphanumeric strings that look like API keys
    redacted = redacted.replace(API_KEY_PATTERN, (match) => {
      if (match.length >= 32) {
        return `${match.slice(0, 8)}...${match.slice(-4)}`;
      }
      return match;
    });
    
    return redacted;
  }
  
  /**
   * Redact sensitive fields from an object (for logging)
   * Protected against circular references
   */
  static redactObject<T extends Record<string, any>>(obj: T, visited: WeakSet<any> = new WeakSet()): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    // Prevent circular reference infinite loop
    if (visited.has(obj)) {
      return '[CIRCULAR]' as any;
    }
    
    visited.add(obj);
    
    const redacted = { ...obj };
    
    for (const key in redacted) {
      const lowerKey = key.toLowerCase();
      
      // Check if field name is sensitive
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
        (redacted as any)[key] = '[REDACTED]';
        continue;
      }
      
      // Recursively redact nested objects
      if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        if (Array.isArray(redacted[key])) {
          redacted[key] = redacted[key].map((item: any) =>
            typeof item === 'object' ? this.redactObject(item, visited) : item
          );
        } else {
          redacted[key] = this.redactObject(redacted[key], visited);
        }
      }
      
      // Redact string values that look like PII
      if (typeof redacted[key] === 'string') {
        // Check for SSN pattern
        if (SSN_PATTERN.test(redacted[key])) {
          (redacted as any)[key] = this.maskSSN(redacted[key]);
        }
        // Check for credit card pattern
        else if (CREDIT_CARD_PATTERN.test(redacted[key])) {
          (redacted as any)[key] = this.maskCreditCard(redacted[key]);
        }
      }
    }
    
    return redacted;
  }
  
  /**
   * Create a safe version of an object for logging
   */
  static sanitizeForLog<T extends Record<string, any>>(obj: T): T {
    const redacted = this.redactObject(obj);
    
    // Also redact PII in string values
    for (const key in redacted) {
      if (typeof redacted[key] === 'string') {
        (redacted as any)[key] = this.redactPII(redacted[key]);
      }
    }
    
    return redacted;
  }
  
  /**
   * Check if a string contains PII
   */
  static containsPII(text: string): boolean {
    if (!text) return false;
    
    return (
      SSN_PATTERN.test(text) ||
      CREDIT_CARD_PATTERN.test(text) ||
      EMAIL_PATTERN.test(text) ||
      PHONE_PATTERN.test(text)
    );
  }
  
  /**
   * Get list of PII field names found in an object
   * Protected against circular references
   */
  static getPIIFields(obj: Record<string, any>, visited: WeakSet<any> = new WeakSet()): string[] {
    const piiFields: string[] = [];
    
    // Prevent circular reference infinite loop
    if (visited.has(obj)) {
      return piiFields;
    }
    
    visited.add(obj);
    
    for (const key in obj) {
      const lowerKey = key.toLowerCase();
      
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
        piiFields.push(key);
      }
      
      if (typeof obj[key] === 'string' && this.containsPII(obj[key])) {
        piiFields.push(key);
      }
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const nestedFields = this.getPIIFields(obj[key], visited);
        piiFields.push(...nestedFields.map(f => `${key}.${f}`));
      }
    }
    
    return piiFields;
  }
}

// Override console.log, console.error, etc. to auto-redact PII
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args: any[]) => {
  const redacted = args.map(arg =>
    typeof arg === 'string' ? PiiMaskingUtils.redactPII(arg) :
    typeof arg === 'object' ? PiiMaskingUtils.redactObject(arg) :
    arg
  );
  originalConsoleLog(...redacted);
};

console.error = (...args: any[]) => {
  const redacted = args.map(arg =>
    typeof arg === 'string' ? PiiMaskingUtils.redactPII(arg) :
    typeof arg === 'object' ? PiiMaskingUtils.redactObject(arg) :
    arg
  );
  originalConsoleError(...redacted);
};

console.warn = (...args: any[]) => {
  const redacted = args.map(arg =>
    typeof arg === 'string' ? PiiMaskingUtils.redactPII(arg) :
    typeof arg === 'object' ? PiiMaskingUtils.redactObject(arg) :
    arg
  );
  originalConsoleWarn(...redacted);
};
