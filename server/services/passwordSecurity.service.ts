/**
 * Password Security Service
 * 
 * Provides password strength validation and secure hashing
 * based on NIST SP 800-63B and OWASP guidelines.
 * 
 * Requirements:
 * - Minimum 12 characters (NIST recommendation for user-chosen passwords)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * - No common passwords (dictionary check)
 * - No sequential or repeated characters
 * 
 * Bcrypt cost factor: 12 (2025 standard, ~250ms hashing time)
 */

import bcrypt from 'bcryptjs';

/**
 * Bcrypt cost factor (rounds)
 * 
 * Cost factor determines how many iterations bcrypt performs.
 * Higher = more secure but slower.
 * 
 * Recommendations by year:
 * - 2020: 10 (100ms)
 * - 2023: 11 (150ms)
 * - 2025: 12 (250ms)
 * - 2027: 13 (500ms)
 * 
 * Current: 12 rounds
 */
export const BCRYPT_COST_FACTOR = 12;

/**
 * Password strength requirements
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  maxLength: 128, // Prevent DOS attacks with extremely long passwords
};

/**
 * Common weak passwords to reject
 * (This is a small sample - in production, use a comprehensive list like "Have I Been Pwned" API)
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password123', '12345678', '123456789', '1234567890',
  'qwerty', 'abc123', 'monkey', '1234567', '12345678',
  'dragon', 'iloveyou', 'trustno1', 'sunshine', 'princess',
  'admin', 'welcome', 'login', 'passw0rd', 'Password1',
  'Password123', 'Admin123', 'Welcome123', 'Changeme123',
]);

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
  score: number; // 0-100
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;
  
  // Check length
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  } else if (password.length >= PASSWORD_REQUIREMENTS.minLength) {
    score += 20;
    if (password.length >= 16) score += 10; // Bonus for longer passwords
    if (password.length >= 20) score += 10;
  }
  
  // Check maximum length (prevent DOS)
  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  }
  
  // Check for uppercase
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (/[A-Z]/.test(password)) {
    score += 15;
  }
  
  // Check for lowercase
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (/[a-z]/.test(password)) {
    score += 15;
  }
  
  // Check for numbers
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else if (/[0-9]/.test(password)) {
    score += 15;
  }
  
  // Check for special characters
  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&* etc.)');
  } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 15;
  }
  
  // Check for common passwords
  const lowerPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowerPassword)) {
    errors.push('This password is too common. Please choose a more unique password');
    score = Math.max(0, score - 40); // Heavy penalty for common passwords
  }
  
  // Check for sequential characters (123, abc, etc.)
  if (hasSequentialCharacters(password)) {
    errors.push('Password should not contain sequential characters (e.g., 123, abc)');
    score = Math.max(0, score - 10);
  }
  
  // Check for repeated characters (aaa, 111, etc.)
  if (hasRepeatedCharacters(password)) {
    errors.push('Password should not contain excessive repeated characters');
    score = Math.max(0, score - 10);
  }
  
  // Bonus points for variety
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.7) {
    score += 10; // Good character diversity
  }
  
  // Determine strength
  let strength: 'weak' | 'fair' | 'good' | 'strong';
  if (score < 40) strength = 'weak';
  else if (score < 60) strength = 'fair';
  else if (score < 80) strength = 'good';
  else strength = 'strong';
  
  return {
    isValid: errors.length === 0,
    errors,
    strength,
    score: Math.min(100, score),
  };
}

/**
 * Check for sequential characters
 */
function hasSequentialCharacters(password: string): boolean {
  const sequential = [
    '012345', '123456', '234567', '345678', '456789',
    'abcdef', 'bcdefg', 'cdefgh', 'defghi', 'efghij',
    'ABCDEF', 'BCDEFG', 'CDEFGH', 'DEFGHI', 'EFGHIJ',
  ];
  
  return sequential.some(seq => password.includes(seq));
}

/**
 * Check for repeated characters
 */
function hasRepeatedCharacters(password: string): boolean {
  // Check for 3+ consecutive repeated characters
  return /(.)\1{2,}/.test(password);
}

/**
 * Hash password using bcrypt with secure cost factor
 */
export async function hashPassword(password: string): Promise<string> {
  // Validate password strength first
  const validation = validatePasswordStrength(password);
  
  if (!validation.isValid) {
    throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
  }
  
  // Hash with current cost factor
  return await bcrypt.hash(password, BCRYPT_COST_FACTOR);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Check if password hash needs rehashing (cost factor changed)
 */
export function needsRehash(hash: string): boolean {
  try {
    // Extract rounds from bcrypt hash
    // Bcrypt hash format: $2a$ROUNDS$salt+hash
    const rounds = parseInt(hash.split('$')[2]);
    return rounds < BCRYPT_COST_FACTOR;
  } catch {
    return true; // If we can't parse it, rehash it
  }
}

/**
 * Generate password requirements message for users
 */
export function getPasswordRequirementsMessage(): string {
  return `Password must:
- Be at least ${PASSWORD_REQUIREMENTS.minLength} characters long
- Contain at least one uppercase letter (A-Z)
- Contain at least one lowercase letter (a-z)
- Contain at least one number (0-9)
- Contain at least one special character (!@#$%^&* etc.)
- Not be a commonly used password
- Not contain sequential or repeated characters`;
}

/**
 * Password security service
 */
class PasswordSecurityService {
  /**
   * Validate and hash new password
   */
  async createPasswordHash(password: string): Promise<{ hash: string; validation: PasswordValidationResult }> {
    const validation = validatePasswordStrength(password);
    
    if (!validation.isValid) {
      throw new Error(`Password does not meet security requirements:\n${validation.errors.join('\n')}`);
    }
    
    const hash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
    
    return { hash, validation };
  }
  
  /**
   * Verify password and rehash if needed
   */
  async verifyAndRehash(
    password: string,
    currentHash: string
  ): Promise<{ valid: boolean; newHash?: string }> {
    const valid = await bcrypt.compare(password, currentHash);
    
    if (!valid) {
      return { valid: false };
    }
    
    // Check if hash needs updating due to cost factor change
    if (needsRehash(currentHash)) {
      const newHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
      return { valid: true, newHash };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate password strength without hashing
   */
  validateStrength(password: string): PasswordValidationResult {
    return validatePasswordStrength(password);
  }
  
  /**
   * Get password requirements for display
   */
  getRequirements(): typeof PASSWORD_REQUIREMENTS {
    return { ...PASSWORD_REQUIREMENTS };
  }
  
  /**
   * Get current bcrypt cost factor
   */
  getCostFactor(): number {
    return BCRYPT_COST_FACTOR;
  }
}

export const passwordSecurityService = new PasswordSecurityService();
