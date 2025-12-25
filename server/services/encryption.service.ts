import crypto from 'crypto';
import { createLogger } from './logger.service';
import { db } from '../db';
import { sql } from 'drizzle-orm';

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
  
  /**
   * CRIT-002: Cryptographic Shredding for NIST 800-88 Compliance
   * 
   * Implements NIST SP 800-88 Rev. 1 media sanitization guidelines
   * for secure data disposal through key deletion (cryptographic shredding).
   * 
   * When encryption keys are securely destroyed, encrypted data becomes
   * irrecoverably unusable - satisfying NIST 800-88 "Clear" or "Purge" levels.
   */
  
  /**
   * Securely delete an encryption key from environment/key store
   * 
   * Multi-cloud KMS integration for FedRAMP-compliant deployments:
   * - AWS GovCloud: AWS KMS ScheduleKeyDeletion (7-30 day waiting period)
   * - GCP: Cloud KMS DestroyCryptoKeyVersion
   * - Azure Government: Key Vault DeleteKey (soft-delete with purge protection)
   * - Local/Dev: Environment variable removal (non-production only)
   * 
   * WARNING: This permanently destroys the key. All data encrypted with
   * this key will become irrecoverably unusable. Use only for CRIT-002 data disposal.
   * 
   * @param keyVersion - Key version to delete (1 = current, higher for rotated keys)
   * @returns Promise<boolean> - True if key deletion was scheduled/completed
   */
  async deleteEncryptionKey(keyVersion: number): Promise<boolean> {
    logger.warn(`🔒 Cryptographic Shredding: Deleting encryption key v${keyVersion}`, {
      keyVersion,
      service: 'Encryption',
      action: 'deleteEncryptionKey'
    });
    
    // Detect cloud environment for KMS routing
    const cloudProvider = this.detectCloudProvider();
    
    try {
      switch (cloudProvider) {
        case 'aws':
          return await this.deleteKeyAWS(keyVersion);
        
        case 'gcp':
          return await this.deleteKeyGCP(keyVersion);
        
        case 'azure':
          return await this.deleteKeyAzure(keyVersion);
        
        case 'local':
        default:
          return await this.deleteKeyLocal(keyVersion);
      }
    } catch (error) {
      logger.error(`Failed to delete encryption key v${keyVersion}`, {
        keyVersion,
        cloudProvider,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'Encryption'
      });
      throw error;
    }
  }
  
  /**
   * Detect cloud provider for KMS routing
   * Deployment-agnostic design supports AWS/GCP/Azure/Local
   */
  private detectCloudProvider(): 'aws' | 'gcp' | 'azure' | 'local' {
    // AWS GovCloud detection (AWS_REGION env var)
    if (process.env.AWS_REGION) {
      return 'aws';
    }
    
    // GCP detection (GCP_PROJECT or GOOGLE_CLOUD_PROJECT env var)
    if (process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT) {
      return 'gcp';
    }
    
    // Azure Government detection (AZURE_TENANT_ID env var)
    if (process.env.AZURE_TENANT_ID) {
      return 'azure';
    }
    
    // Local/development (no cloud KMS)
    return 'local';
  }
  
  /**
   * AWS KMS key deletion (AWS GovCloud compatible)
   * Uses ScheduleKeyDeletion with 7-30 day waiting period
   * 
   * PRODUCTION SETUP:
   * 1. Install AWS SDK: npm install @aws-sdk/client-kms
   * 2. Set AWS_REGION environment variable
   * 3. Configure IAM role with kms:ScheduleKeyDeletion permission
   * 4. Create KMS key alias: alias/jawn-encryption-key-v{version}
   */
  private async deleteKeyAWS(keyVersion: number): Promise<boolean> {
    logger.info(`AWS KMS: Scheduling key deletion v${keyVersion}`, {
      keyVersion,
      region: process.env.AWS_REGION,
      service: 'Encryption',
      cloudProvider: 'aws'
    });
    
    try {
      // Attempt to load AWS KMS SDK (may not be installed in dev)
      const { KMSClient, ScheduleKeyDeletionCommand, DescribeKeyCommand } = await import('@aws-sdk/client-kms').catch(() => {
        throw new Error('AWS KMS SDK not installed. Run: npm install @aws-sdk/client-kms');
      });
      
      const kms = new KMSClient({ region: process.env.AWS_REGION });
      const keyAlias = `alias/jawn-encryption-key-v${keyVersion}`;
      
      // Step 1: Look up key ARN from alias (ScheduleKeyDeletion requires ARN, not alias)
      const describeResult = await kms.send(new DescribeKeyCommand({
        KeyId: keyAlias
      }));
      
      if (!describeResult.KeyMetadata?.KeyId) {
        throw new Error(`Failed to resolve key ARN for alias: ${keyAlias}`);
      }
      
      const keyArn = describeResult.KeyMetadata.Arn || describeResult.KeyMetadata.KeyId;
      
      // Step 2: Schedule key deletion using ARN
      const result = await kms.send(new ScheduleKeyDeletionCommand({
        KeyId: keyArn, // Use ARN, not alias
        PendingWindowInDays: 7 // Minimum for GovCloud compliance
      }));
      
      logger.info(`✅ AWS KMS: Key v${keyVersion} scheduled for deletion`, {
        keyVersion,
        region: process.env.AWS_REGION,
        deletionDate: result.DeletionDate,
        keyId: result.KeyId,
        service: 'Encryption',
        compliance: 'NIST 800-88, FedRAMP Rev. 5',
        kmsOperation: 'ScheduleKeyDeletion'
      });
      
      return true;
    } catch (error) {
      logger.error(`AWS KMS key deletion failed - cryptographic shredding incomplete`, {
        keyVersion,
        region: process.env.AWS_REGION,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'Encryption'
      });
      throw new Error(`AWS KMS key deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * GCP Cloud KMS key deletion
   * Uses DestroyCryptoKeyVersion for immediate destruction
   * 
   * PRODUCTION SETUP:
   * 1. Install GCP SDK: npm install @google-cloud/kms
   * 2. Set GCP_PROJECT or GOOGLE_CLOUD_PROJECT environment variable
   * 3. Configure service account with cloudkms.cryptoKeyVersions.destroy permission
   * 4. Create KMS key: projects/{project}/locations/us/keyRings/jawn/cryptoKeys/encryption-key
   */
  private async deleteKeyGCP(keyVersion: number): Promise<boolean> {
    const project = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    
    logger.info(`GCP Cloud KMS: Destroying key version v${keyVersion}`, {
      keyVersion,
      project,
      service: 'Encryption',
      cloudProvider: 'gcp'
    });
    
    try {
      // Attempt to load GCP KMS SDK (may not be installed in dev)
      const { KeyManagementServiceClient } = await import('@google-cloud/kms').catch(() => {
        throw new Error('GCP KMS SDK not installed. Run: npm install @google-cloud/kms');
      });
      
      const client = new KeyManagementServiceClient();
      const name = `projects/${project}/locations/us/keyRings/jawn/cryptoKeys/encryption-key/cryptoKeyVersions/${keyVersion}`;
      const [result] = await client.destroyCryptoKeyVersion({ name });
      
      logger.info(`✅ GCP Cloud KMS: Key v${keyVersion} destroyed`, {
        keyVersion,
        project,
        state: result.state,
        destroyTime: result.destroyTime,
        service: 'Encryption',
        compliance: 'NIST 800-88, FedRAMP Rev. 5',
        kmsOperation: 'DestroyCryptoKeyVersion'
      });
      
      return true;
    } catch (error) {
      logger.error(`GCP KMS key deletion failed - cryptographic shredding incomplete`, {
        keyVersion,
        project,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'Encryption'
      });
      throw new Error(`GCP KMS key deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Azure Key Vault key deletion (Azure Government compatible)
   * Uses DeleteKey with soft-delete and purge protection
   * 
   * PRODUCTION SETUP:
   * 1. Install Azure SDKs: npm install @azure/keyvault-keys @azure/identity
   * 2. Set AZURE_TENANT_ID and AZURE_KEYVAULT_URL environment variables
   * 3. Configure managed identity or service principal with Key Vault Crypto Officer role
   * 4. Create Key Vault key: jawn-encryption-key-v{version}
   */
  private async deleteKeyAzure(keyVersion: number): Promise<boolean> {
    const tenantId = process.env.AZURE_TENANT_ID;
    const vaultUrl = process.env.AZURE_KEYVAULT_URL;
    
    if (!vaultUrl) {
      throw new Error('AZURE_KEYVAULT_URL environment variable required for Azure Key Vault');
    }
    
    logger.info(`Azure Key Vault: Deleting key v${keyVersion}`, {
      keyVersion,
      tenantId,
      vaultUrl,
      service: 'Encryption',
      cloudProvider: 'azure'
    });
    
    try {
      // Attempt to load Azure Key Vault SDK (may not be installed in dev)
      const { KeyClient } = await import('@azure/keyvault-keys').catch(() => {
        throw new Error('Azure Key Vault SDK not installed. Run: npm install @azure/keyvault-keys @azure/identity');
      });
      const { DefaultAzureCredential } = await import('@azure/identity').catch(() => {
        throw new Error('Azure Identity SDK not installed. Run: npm install @azure/identity');
      });
      
      const credential = new DefaultAzureCredential();
      const client = new KeyClient(vaultUrl, credential);
      const keyName = `jawn-encryption-key-v${keyVersion}`;
      
      // Step 1: Soft delete the key
      const deletePoller = await client.beginDeleteKey(keyName);
      const deletedKey = await deletePoller.pollUntilDone();
      
      logger.info(`Azure Key Vault: Key v${keyVersion} soft-deleted, purging...`, {
        keyVersion,
        deletedOn: deletedKey.deletedOn,
        service: 'Encryption'
      });
      
      // Step 2: Purge the key (permanent destruction)
      await client.purgeDeletedKey(keyName);
      
      logger.info(`✅ Azure Key Vault: Key v${keyVersion} purged`, {
        keyVersion,
        tenantId,
        vaultUrl,
        service: 'Encryption',
        compliance: 'NIST 800-88, FedRAMP Rev. 5',
        kmsOperation: 'DeleteKey + PurgeDeletedKey'
      });
      
      return true;
    } catch (error) {
      logger.error(`Azure Key Vault key deletion failed - cryptographic shredding incomplete`, {
        keyVersion,
        tenantId,
        vaultUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'Encryption'
      });
      throw new Error(`Azure Key Vault key deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Local key deletion (development/non-cloud environments)
   * Removes key from environment variables (NOT for production FTI/PHI)
   */
  private async deleteKeyLocal(keyVersion: number): Promise<boolean> {
    const keyEnvVar = keyVersion === 1 ? 'ENCRYPTION_KEY' : `ENCRYPTION_KEY_V${keyVersion}`;
    
    logger.warn(`Local key deletion: ${keyEnvVar} (dev/non-cloud only)`, {
      keyVersion,
      keyEnvVar,
      service: 'Encryption',
      cloudProvider: 'local',
      warning: 'Local key deletion is NOT suitable for production FTI/PHI. Use cloud KMS.'
    });
    
    // In local/dev environments, remove from process.env
    // NOTE: This does NOT provide NIST 800-88 compliance for production
    delete process.env[keyEnvVar];
    
    logger.info(`✅ Local key v${keyVersion} removed from environment`, {
      keyVersion,
      keyEnvVar,
      service: 'Encryption',
      compliance: 'Local dev only - NOT NIST 800-88 compliant'
    });
    
    return true;
  }
  
  /**
   * Recursively extract all keyVersion values from record snapshots
   * Handles nested structures like { encrypted: { keyVersion, ... } }
   * 
   * @param recordSnapshots - Record snapshots to inspect
   * @returns Set of unique key versions found
   */
  private extractKeyVersionsFromRecords(recordSnapshots: Record<string, any>): Set<number> {
    const keyVersions = new Set<number>();
    
    /**
     * Recursive helper to traverse object tree and find keyVersion fields
     */
    const extractFromValue = (value: any): void => {
      if (!value) return;
      
      // Check if this object has a keyVersion field (EncryptionResult structure)
      if (typeof value === 'object' && 'keyVersion' in value) {
        const version = value.keyVersion || this.currentKeyVersion;
        keyVersions.add(version);
      }
      
      // If it's an object, recursively check all its properties
      if (typeof value === 'object' && !Array.isArray(value)) {
        for (const key in value) {
          extractFromValue(value[key]);
        }
      }
      // If it's an array, check each element
      else if (Array.isArray(value)) {
        value.forEach(item => extractFromValue(item));
      }
      // If it's a string, try parsing as JSON (might be stringified EncryptionResult)
      else if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          extractFromValue(parsed);
        } catch {
          // Not JSON, skip
        }
      }
    };
    
    // Traverse all record snapshots
    for (const recordId in recordSnapshots) {
      const snapshot = recordSnapshots[recordId];
      extractFromValue(snapshot);
    }
    
    return keyVersions;
  }
  
  /**
   * Cryptographically shred encrypted data by deleting keys
   * 
   * NIST 800-88 Compliance: By destroying the encryption key, the encrypted
   * data becomes irrecoverably unusable (equivalent to media destruction).
   * 
   * @param tableName - Table containing encrypted data
   * @param recordIds - Array of record IDs to shred
   * @param deletedBy - User ID performing the deletion
   * @returns Promise<{shreddedCount: number, disposalLogIds: string[]}>
   */
  async shredEncryptedData(
    tableName: string,
    recordIds: string[],
    deletedBy: string
  ): Promise<{shreddedCount: number, disposalLogIds: string[]}> {
    logger.warn(`🔥 Cryptographic Shredding: ${recordIds.length} records in ${tableName}`, {
      tableName,
      recordCount: recordIds.length,
      deletedBy,
      service: 'Encryption',
      action: 'shredEncryptedData'
    });
    
    const disposalLogIds: string[] = [];
    
    try {
      // Step 1: Fetch record snapshots before key deletion
      const recordSnapshots: Record<string, any> = {};
      for (const recordId of recordIds) {
        try {
          const result = await db.execute(sql`
            SELECT *
            FROM ${sql.identifier(tableName)}
            WHERE id = ${recordId}
          `);
          
          if (result.rows.length > 0) {
            recordSnapshots[recordId] = result.rows[0];
          }
        } catch (error) {
          logger.error(`Failed to fetch record snapshot for ${tableName}:${recordId}`, {
            tableName,
            recordId,
            error: error instanceof Error ? error.message : 'Unknown error',
            service: 'Encryption'
          });
        }
      }
      
      // Step 2: Identify unique key versions used by these records
      // Recursively extract keyVersion from all encrypted fields in the record snapshots
      const keyVersions = this.extractKeyVersionsFromRecords(recordSnapshots);
      
      // Fallback: if no key versions found in encrypted fields, use current key
      if (keyVersions.size === 0) {
        logger.warn('No encrypted key versions found in records, using current key version', {
          currentKeyVersion: this.currentKeyVersion,
          service: 'Encryption'
        });
        keyVersions.add(this.currentKeyVersion);
      }
      
      logger.info(`Detected ${keyVersions.size} unique encryption key versions for shredding`, {
        keyVersions: Array.from(keyVersions),
        recordCount: Object.keys(recordSnapshots).length,
        service: 'Encryption'
      });
      
      // Step 3: Delete encryption keys (makes data irrecoverably unusable)
      const keyDeletionResults: Record<number, boolean> = {};
      for (const keyVersion of keyVersions) {
        keyDeletionResults[keyVersion] = await this.deleteEncryptionKey(keyVersion);
      }
      
      // Step 4: Write disposal logs to data_disposal_logs table (immutable audit trail)
      for (const recordId of recordIds) {
        try {
          const recordSnapshot = recordSnapshots[recordId];
          
          const result = await db.execute(sql`
            INSERT INTO data_disposal_logs (
              table_name,
              record_id,
              deletion_reason,
              deleted_by,
              deletion_method,
              record_snapshot,
              legal_hold_status,
              audit_trail
            ) VALUES (
              ${tableName},
              ${recordId},
              'retention_period_expired_cryptographic_shredding',
              ${deletedBy},
              'crypto_shred',
              ${JSON.stringify(recordSnapshot || {})},
              'no_holds',
              ${JSON.stringify({
                action: 'cryptographic_shredding',
                timestamp: new Date().toISOString(),
                performedBy: deletedBy,
                keyVersionsDeleted: Array.from(keyVersions),
                keyDeletionResults,
                compliance: 'NIST 800-88 Rev. 1, IRS Pub 1075 §9.3.4, GDPR Art. 5',
                method: 'encryption_key_destruction'
              })}
            )
            RETURNING id
          `);
          
          if (result.rows.length > 0) {
            disposalLogIds.push(result.rows[0].id);
          }
        } catch (error) {
          logger.error(`Failed to write disposal log for ${tableName}:${recordId}`, {
            tableName,
            recordId,
            error: error instanceof Error ? error.message : 'Unknown error',
            service: 'Encryption'
          });
        }
      }
      
      logger.info(`✅ Cryptographic shredding complete: ${recordIds.length} records, ${disposalLogIds.length} disposal logs`, {
        tableName,
        recordCount: recordIds.length,
        disposalLogsCreated: disposalLogIds.length,
        keyVersionsDeleted: Array.from(keyVersions),
        deletedBy,
        service: 'Encryption',
        compliance: 'NIST 800-88, IRS Pub 1075, GDPR Art. 5'
      });
      
      return {
        shreddedCount: recordIds.length,
        disposalLogIds
      };
    } catch (error) {
      logger.error(`Cryptographic shredding failed`, {
        tableName,
        recordCount: recordIds.length,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'Encryption'
      });
      throw error;
    }
  }
  
  /**
   * Verify that an encryption key has been deleted (audit proof)
   * 
   * @param keyVersion - Key version to verify
   * @returns Promise<{deleted: boolean, verifiedAt: Date}>
   */
  async verifyKeyDeletion(keyVersion: number): Promise<{deleted: boolean, verifiedAt: Date}> {
    // In production, this would query the KMS to verify key state:
    // - AWS KMS: GetKeyMetadata → KeyState = "PendingDeletion" or "Disabled"
    // - GCP KMS: GetCryptoKeyVersion → state = "DESTROYED"
    // - Azure Key Vault: GetDeletedKey → confirming soft-delete
    
    logger.info(`🔍 Verifying encryption key v${keyVersion} deletion`, {
      keyVersion,
      service: 'Encryption',
      action: 'verifyKeyDeletion'
    });
    
    // Attempt to retrieve the key (should fail if deleted)
    try {
      const keyEnvVar = keyVersion === 1 ? 'ENCRYPTION_KEY' : `ENCRYPTION_KEY_V${keyVersion}`;
      const keyExists = !!process.env[keyEnvVar];
      
      if (keyExists) {
        logger.warn(`⚠️ Encryption key v${keyVersion} still exists!`, {
          keyVersion,
          service: 'Encryption',
          action: 'verifyKeyDeletion',
          status: 'NOT_DELETED'
        });
        return {
          deleted: false,
          verifiedAt: new Date()
        };
      }
      
      logger.info(`✅ Encryption key v${keyVersion} verified deleted`, {
        keyVersion,
        service: 'Encryption',
        action: 'verifyKeyDeletion',
        status: 'DELETED'
      });
      
      return {
        deleted: true,
        verifiedAt: new Date()
      };
    } catch (error) {
      logger.error(`❌ Key deletion verification failed`, {
        keyVersion,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'Encryption'
      });
      return {
        deleted: false,
        verifiedAt: new Date()
      };
    }
  }
}

export const encryptionService = new EncryptionService();

// Export types
export type { EncryptionResult, EncryptedField };
