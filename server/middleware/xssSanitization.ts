/**
 * XSS Sanitization Middleware
 * 
 * Prevents Cross-Site Scripting (XSS) attacks by sanitizing user input
 * Removes potentially dangerous HTML/JavaScript from request body, query params, and URL params
 * 
 * @security Applied globally to all routes
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Patterns that indicate potential XSS attacks
 * These are common attack vectors that should be sanitized
 */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,  // Script tags
  /javascript:/gi,                                         // JavaScript protocol
  /on\w+\s*=/gi,                                          // Event handlers (onclick, onerror, etc.)
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, // Iframe tags
  /<embed\b[^>]*>/gi,                                     // Embed tags
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, // Object tags
  /vbscript:/gi,                                          // VBScript protocol
  /expression\s*\(/gi,                                    // CSS expressions
  /<link\b[^>]*>/gi,                                      // Link tags (can load external stylesheets)
];

/**
 * HTML entities that should be escaped to prevent XSS
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * Decode HTML entities to prevent bypass attacks
 * This is critical for detecting encoded XSS payloads like &#x3C;script&#x3E;
 * 
 * SECURITY: Performs iterative decoding to handle double/triple-encoded entities
 * Example: &amp;#x3C; → &#x3C; → < (requires 2 passes)
 */
function decodeHtmlEntities(text: string): string {
  const MAX_DECODE_ITERATIONS = 5; // Prevent infinite loops
  let decoded = text;
  let previousDecoded = '';
  let iterations = 0;
  
  // Named entities map
  const entityMap: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&apos;': "'",
    '&nbsp;': ' ',
  };
  
  // Decode iteratively until string stabilizes or max iterations reached
  while (decoded !== previousDecoded && iterations < MAX_DECODE_ITERATIONS) {
    previousDecoded = decoded;
    
    // Decode named entities first (order matters!)
    for (const [entity, char] of Object.entries(entityMap)) {
      decoded = decoded.replace(new RegExp(entity, 'gi'), char);
    }
    
    // Decode numeric entities (decimal)
    decoded = decoded.replace(/&#(\d+);?/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return (code >= 0 && code <= 1114111) ? String.fromCharCode(code) : _;
    });
    
    // Decode numeric entities (hex)
    decoded = decoded.replace(/&#x([0-9A-Fa-f]+);?/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return (code >= 0 && code <= 1114111) ? String.fromCharCode(code) : _;
    });
    
    iterations++;
  }
  
  // If we hit max iterations without stabilizing, it's suspicious - escape it
  if (iterations >= MAX_DECODE_ITERATIONS && decoded !== previousDecoded) {
    console.warn('[XSS] Suspicious deeply nested entity encoding detected, escaping input');
    return escapeHtml(text);
  }
  
  return decoded;
}

/**
 * Escape HTML entities in a string
 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"'\/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize a string value by removing XSS patterns and escaping HTML
 * 
 * @param value - The value to sanitize
 * @param options - Sanitization options
 * @returns Sanitized value
 */
function sanitizeValue(
  value: any, 
  options: { allowHtml?: boolean; strict?: boolean } = {}
): any {
  // Skip null, undefined, numbers, and booleans
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  // Handle arrays recursively
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, options));
  }

  // Handle objects recursively
  if (typeof value === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val, options);
    }
    return sanitized;
  }

  // Only sanitize strings
  if (typeof value !== 'string') {
    return value;
  }

  let sanitized = value;

  // CRITICAL: Decode HTML entities FIRST to detect encoded XSS payloads
  // This prevents bypasses like &#x3C;script&#x3E; (which decodes to <script>)
  const decoded = decodeHtmlEntities(sanitized);

  // Check the DECODED version for XSS patterns
  // SECURITY: Create NEW regex instances to avoid lastIndex state issues with global regexes
  for (const pattern of XSS_PATTERNS) {
    // Create a new RegExp instance to avoid lastIndex state pollution
    const freshPattern = new RegExp(pattern.source, pattern.flags);
    if (freshPattern.test(decoded)) {
      // If dangerous pattern found in decoded version, escape the original
      return escapeHtml(sanitized);
    }
  }

  // Also remove patterns from the original string (in case they're not encoded)
  // SECURITY: Create NEW regex instances for replacement to avoid lastIndex issues
  for (const pattern of XSS_PATTERNS) {
    const freshPattern = new RegExp(pattern.source, pattern.flags);
    sanitized = sanitized.replace(freshPattern, '');
  }

  // In strict mode or when HTML is not allowed, escape all HTML entities
  if (options.strict || !options.allowHtml) {
    sanitized = escapeHtml(sanitized);
  } else {
    // For HTML-allowed fields, apply additional sanitization
    // Remove data: URIs, javascript: protocols in attributes
    sanitized = sanitized
      .replace(/(<[^>]+)\s*on\w+\s*=\s*["'][^"']*["']/gi, '$1') // Remove event handlers from tags
      .replace(/(<[^>]+)\s*href\s*=\s*["']?\s*javascript:/gi, '$1 href="') // Remove javascript: URLs
      .replace(/(<[^>]+)\s*src\s*=\s*["']?\s*data:/gi, '$1 src="') // Remove data: URIs
      .replace(/(<[^>]+)\s*style\s*=\s*["'][^"']*expression\s*\(/gi, '$1'); // Remove CSS expressions
  }

  return sanitized;
}

/**
 * Whitelist of fields that should allow HTML content
 * These fields are expected to contain rich text or HTML markup
 */
const HTML_ALLOWED_FIELDS = new Set([
  'content',           // Rich text content
  'description',       // Rich text descriptions
  'notes',            // Rich text notes
  'message',          // Rich text messages
  'body',             // Rich text body
  'policyText',       // Policy document content
  'chunkText',        // Document chunk text
  'htmlContent',      // Explicitly marked HTML content
  'explanation',      // AI-generated explanations (may contain formatting)
]);

/**
 * Check if a field should allow HTML content based on whitelist
 */
function shouldAllowHtml(fieldPath: string): boolean {
  return HTML_ALLOWED_FIELDS.has(fieldPath.split('.').pop() || '');
}

/**
 * Sanitize request data to prevent XSS attacks
 * Applied to body, query params, and URL params
 */
export function xssSanitization(options: { strict?: boolean } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize body (POST/PUT/PATCH requests)
      if (req.body && typeof req.body === 'object') {
        const sanitizeObject = (obj: any, path = ''): any => {
          if (Array.isArray(obj)) {
            return obj.map((item, index) => sanitizeObject(item, `${path}[${index}]`));
          }
          
          if (obj && typeof obj === 'object') {
            const sanitized: Record<string, any> = {};
            for (const [key, value] of Object.entries(obj)) {
              const fieldPath = path ? `${path}.${key}` : key;
              const allowHtml = shouldAllowHtml(fieldPath);
              sanitized[key] = sanitizeValue(value, { allowHtml, strict: options.strict });
            }
            return sanitized;
          }
          
          return sanitizeValue(obj, { strict: options.strict });
        };

        req.body = sanitizeObject(req.body);
      }

      // Sanitize query params (always strict, no HTML allowed in URLs)
      if (req.query && typeof req.query === 'object') {
        const sanitized: Record<string, any> = {};
        for (const [key, value] of Object.entries(req.query)) {
          sanitized[key] = sanitizeValue(value, { strict: true });
        }
        req.query = sanitized;
      }

      // Sanitize URL params (always strict, no HTML allowed in URLs)
      if (req.params && typeof req.params === 'object') {
        const sanitized: Record<string, any> = {};
        for (const [key, value] of Object.entries(req.params)) {
          sanitized[key] = sanitizeValue(value, { strict: true });
        }
        req.params = sanitized;
      }

      next();
    } catch (error) {
      console.error('[XSS Sanitization] Error sanitizing request:', error);
      // Don't block the request on sanitization errors, just log and continue
      next();
    }
  };
}

/**
 * Strict XSS sanitization for authentication endpoints
 * No HTML allowed whatsoever
 */
export const strictXssSanitization = xssSanitization({ strict: true });

/**
 * Export sanitization function for manual use
 */
export { sanitizeValue };
