import crypto from 'crypto';
import { createLogger } from './logger.service';

const logger = createLogger('Encryption');

/**
 * Field-Level Encryption Service
 * 
 * Provides AES-256-GCM encryption for sensitive PII data (SSNs, bank accounts, tax data)
 * Supports key rotation and secure key management via environment variables
 * 
 * PRODUCTION REQUIREMENTS:
 * - Set ENCRYPTION_KEY as a 64-character hex string (32 bytes) in environment
 * - Rotate keys periodically using ENCRYPTION_KEY_PREVIOUS for seamless migration
 * - Never log encrypted or decrypted values
 * - Use FIPS-compliant crypto module in production environments
 */

interface EncryptionResult {
  ciphertext: string; // Base64-encoded encrypted data
  iv: string; // Base64-encoded initialization vector
  authTag: string; // Base64-encoded authentication tag
  keyVersion: number; // Key version used for encryption (supports rotation)
}

interface EncryptedField {
  encrypted: EncryptionResult;
}

class EncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 12; // 96 bits for GCM
  private readonly AUTH_TAG_LENGTH = 16; // 128 bits
  private readonly KEY_LENGTH = 32; // 256 bits
  
  // Key version tracking for rotation support
  private currentKeyVersion = 1;
  
  /**
   * Get encryption key from environment with validation
   */
  private getEncryptionKey(keyVersion: number = this.currentKeyVersion): Buffer {
    const keyEnvVar = keyVersion === 1 ? 'ENCRYPTION_KEY' : `ENCRYPTION_KEY_V${keyVersion}`;
    const keyHex = process.env[keyEnvVar];
    
    if (!keyHex) {
      // In development, generate a warning key (NOT FOR PRODUCTION)
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`⚠️  ${keyEnvVar} not set. Using development-only key. DO NOT USE IN PRODUCTION.`, {
          keyEnvVar,
          service: 'Encryption'
        });
        // Generate deterministic dev key from env name
        return crypto.createHash('sha256').update(keyEnvVar + 'dev-only').digest();
      }
      
      throw new Error(`${keyEnvVar} environment variable is required for encryption in production`);
    }
    
    // Validate key format
    if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
      throw new Error(`${keyEnvVar} must be a 64-character hexadecimal string (32 bytes)`);
    }
    
    return Buffer.from(keyHex, 'hex');
  }
  
  /**
   * Get previous encryption key for decryption during key rotation
   */
  private getPreviousKey(): Buffer | null {
    const prevKeyHex = process.env.ENCRYPTION_KEY_PREVIOUS;
    if (!prevKeyHex) return null;
    
    if (!/^[0-9a-f]{64}$/i.test(prevKeyHex)) {
      logger.error('ENCRYPTION_KEY_PREVIOUS has invalid format, ignoring', {
        service: 'Encryption'
      });
      return null;
    }
    
    return Buffer.from(prevKeyHex, 'hex');
  }
  
  /**
   * Encrypt a string value using AES-256-GCM
   */
  encrypt(plaintext: string | null | undefined): EncryptionResult | null {
    if (plaintext === null || plaintext === undefined || plaintext === '') {
      return null;
    }
    
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
      ciphertext += cipher.final('base64');
      
      const authTag = cipher.getAuthTag();
      
      return {
        ciphertext,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        keyVersion: this.currentKeyVersion,
      };
    } catch (error) {
      logger.error('Encryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
        service: 'Encryption'
      });
      throw new Error('Failed to encrypt sensitive data');
    }
  }
  
  /**
   * Decrypt a value encrypted with AES-256-GCM
   */
  decrypt(encryptedData: EncryptionResult | null | undefined): string | null {
    if (!encryptedData) {
      return null;
    }
    
    try {
      const { ciphertext, iv, authTag, keyVersion } = encryptedData;
      
      // Try current key first, then previous key for rotation support
      let key = this.getEncryptionKey(keyVersion || this.currentKeyVersion);
      
      try {
        return this.decryptWithKey(ciphertext, iv, authTag, key);
      } catch (error) {
        // If decryption fails and previous key exists, try previous key
        const previousKey = this.getPreviousKey();
        if (previousKey) {
          logger.warn('Attempting decryption with previous key (key rotation in progress)', {
            keyVersion: keyVersion || this.currentKeyVersion,
            service: 'Encryption'
          });
          return this.decryptWithKey(ciphertext, iv, authTag, previousKey);
        }
        throw error;
      }
    } catch (error) {
      logger.error('Decryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error,
        service: 'Encryption'
      });
      throw new Error('Failed to decrypt sensitive data');
    }
  }
  
  /**
   * Decrypt using a specific key
   */
  private decryptWithKey(ciphertext: string, iv: string, authTag: string, key: Buffer): string {
    const decipher = crypto.createDecipheriv(
      this.ALGORITHM,
      key,
      Buffer.from(iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    
    return plaintext;
  }
  
  /**
   * Encrypt SSN with formatting (XXX-XX-XXXX)
   */
  encryptSSN(ssn: string | null | undefined): EncryptionResult | null {
    if (!ssn) return null;
    
    // Remove formatting before encryption
    const cleanSSN = ssn.replace(/[^0-9]/g, '');
    
    // Validate SSN format (9 digits)
    if (!/^\d{9}$/.test(cleanSSN)) {
      throw new Error('Invalid SSN format - must be 9 digits');
    }
    
    return this.encrypt(cleanSSN);
  }
  
  /**
   * Decrypt SSN and return formatted version
   */
  decryptSSN(encryptedSSN: EncryptionResult | null | undefined, formatted: boolean = true): string | null {
    const decrypted = this.decrypt(encryptedSSN);
    if (!decrypted) return null;
    
    if (formatted && decrypted.length === 9) {
      return `${decrypted.slice(0, 3)}-${decrypted.slice(3, 5)}-${decrypted.slice(5)}`;
    }
    
    return decrypted;
  }
  
  /**
   * Mask SSN for display (shows last 4 digits only)
   */
  maskSSN(ssn: string | EncryptionResult | null | undefined): string {
    if (!ssn) return 'XXX-XX-XXXX';
    
    let plainSSN: string | null;
    
    if (typeof ssn === 'string') {
      plainSSN = ssn;
    } else {
      plainSSN = this.decryptSSN(ssn, false);
    }
    
    if (!plainSSN || plainSSN.length < 4) {
      return 'XXX-XX-XXXX';
    }
    
    const last4 = plainSSN.slice(-4);
    return `XXX-XX-${last4}`;
  }
  
  /**
   * Encrypt bank account number
   */
  encryptBankAccount(accountNumber: string | null | undefined): EncryptionResult | null {
    if (!accountNumber) return null;
    
    // Remove formatting
    const cleanAccount = accountNumber.replace(/[^0-9]/g, '');
    
    // Validate account number (4-17 digits typical range)
    if (!/^\d{4,17}$/.test(cleanAccount)) {
      throw new Error('Invalid bank account number format');
    }
    
    return this.encrypt(cleanAccount);
  }
  
  /**
   * Decrypt bank account number
   */
  decryptBankAccount(encryptedAccount: EncryptionResult | null | undefined): string | null {
    return this.decrypt(encryptedAccount);
  }
  
  /**
   * Mask bank account for display (shows last 4 digits only)
   */
  maskBankAccount(account: string | EncryptionResult | null | undefined): string {
    if (!account) return '****';
    
    let plainAccount: string | null;
    
    if (typeof account === 'string') {
      plainAccount = account;
    } else {
      plainAccount = this.decryptBankAccount(account);
    }
    
    if (!plainAccount || plainAccount.length < 4) {
      return '****';
    }
    
    const last4 = plainAccount.slice(-4);
    return `****${last4}`;
  }
  
  /**
   * Re-encrypt data with new key (for key rotation)
   */
  async rotateEncryption(encryptedData: EncryptionResult): Promise<EncryptionResult> {
    const plaintext = this.decrypt(encryptedData);
    if (!plaintext) {
      throw new Error('Cannot rotate null data');
    }
    
    const reEncrypted = this.encrypt(plaintext);
    if (!reEncrypted) {
      throw new Error('Re-encryption failed');
    }
    
    return reEncrypted;
  }
  
  /**
   * Generate a new encryption key (for setup/rotation)
   * Returns 64-character hex string suitable for ENCRYPTION_KEY env var
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

export const encryptionService = new EncryptionService();

// Export types
export type { EncryptionResult, EncryptedField };
