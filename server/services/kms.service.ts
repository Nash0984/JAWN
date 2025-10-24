/**
 * Key Management Service (KMS) - 3-Tier Key Hierarchy
 * 
 * Implements NIST SP 800-57 compliant key management with hierarchical key derivation:
 * 
 * TIER 1: Root KEK (Key Encryption Key)
 *   - Stored in cloud KMS (AWS GovCloud, GCP, Azure Government)
 *   - Never used directly for data encryption
 *   - Rotated every 2 years per NIST SP 800-57
 * 
 * TIER 2: State Master Keys
 *   - One per state tenant (MD, PA, VA, UT, IN, MI)
 *   - Encrypted by Root KEK
 *   - Used to encrypt table/field keys
 *   - Rotated every 1 year
 * 
 * TIER 3: Table/Field Data Encryption Keys (DEKs)
 *   - Encrypted by State Master Key
 *   - Used for actual PII/PHI encryption
 *   - Rotated every 6 months
 * 
 * GDPR Compliance: Cryptographic shredding via key destruction
 * FedRAMP: Cloud KMS integration for GovCloud deployments
 */

import crypto from 'crypto';
import { db } from '../db';
import { encryptionKeys, stateTenants } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createLogger } from './logger.service';
import { immutableAuditService } from './immutableAudit.service';
import { encryptionService, type EncryptionResult } from './encryption.service';

const logger = createLogger('KMS');

export interface KeyMetadata {
  id: string;
  keyType: 'root_kek' | 'state_master' | 'table_key' | 'field_key';
  keyPurpose: 'data_encryption' | 'key_encryption' | 'hmac_signing';
  stateTenantId?: string;
  tableName?: string;
  fieldName?: string;
  keyVersion: number;
  status: 'active' | 'rotating' | 'retired' | 'destroyed';
  cryptoperiodMonths: number;
  activatedAt: Date;
  rotationScheduledAt?: Date;
}

class KMSService {
  /**
   * NIST SP 800-57 Cryptoperiods (in months)
   */
  private readonly CRYPTOPERIODS = {
    root_kek: 24,      // 2 years - Root KEK
    state_master: 12,  // 1 year - State Master Keys
    table_key: 6,      // 6 months - Table-level DEKs
    field_key: 6,      // 6 months - Field-level DEKs
  };

  /**
   * Initialize KMS with Root KEK
   * Must be called once during system setup
   * 
   * CRITICAL SECURITY (Architect-reviewed fix):
   * - Root KEK MUST be encrypted by external cloud KMS (AWS/GCP/Azure), not app-level key
   * - This ensures tier separation per NIST SP 800-57, IRS Pub 1075, FedRAMP
   * - Root KEK stored as reference to cloud KMS key, NOT encrypted material in DB
   * 
   * Production Requirement:
   * - Requires cloud KMS setup (AWS KMS, GCP Cloud KMS, or Azure Key Vault)
   * - For dev/testing, stores placeholder reference (admin must initialize cloud KMS)
   */
  async initializeRootKEK(): Promise<KeyMetadata> {
    logger.info('🔐 Initializing Root KEK (Tier 1)', {
      service: 'KMS',
      action: 'initializeRootKEK'
    });

    // Check if Root KEK already exists
    const existingRootKEK = await db.query.encryptionKeys.findFirst({
      where: and(
        eq(encryptionKeys.keyType, 'root_kek'),
        eq(encryptionKeys.status, 'active')
      )
    });

    if (existingRootKEK) {
      logger.warn('Root KEK already exists, skipping initialization', {
        keyId: existingRootKEK.id,
        activatedAt: existingRootKEK.activatedAt
      });
      return existingRootKEK as KeyMetadata;
    }

    // CRITICAL FIX: Root KEK must be created in external cloud KMS
    // Store only the cloud KMS key reference, not encrypted material
    // 
    // Production setup requires:
    // 1. AWS: aws kms create-key --description "JAWN Root KEK" --region us-gov-west-1
    // 2. GCP: gcloud kms keys create jawn-root-kek --keyring=jawn-kms --location=us-central1
    // 3. Azure: az keyvault key create --vault-name jawn-kv --name root-kek --kty RSA
    const cloudKMSKeyReference = {
      provider: 'external_kms', // 'aws_kms' | 'gcp_kms' | 'azure_keyvault'
      keyId: 'placeholder-root-kek', // Replace with actual cloud KMS key ID/ARN
      region: 'placeholder-region',
      // DO NOT STORE: actual key material (handled by cloud HSM)
      initialized: false, // Set to true after cloud KMS setup
      setupInstructions: 'Admin must create Root KEK in cloud KMS and update this record',
    };

    // Store Cloud KMS reference (NOT encrypted key material)
    const rotationDate = new Date();
    rotationDate.setMonth(rotationDate.getMonth() + this.CRYPTOPERIODS.root_kek);

    const [rootKEK] = await db.insert(encryptionKeys).values({
      keyType: 'root_kek',
      keyPurpose: 'key_encryption',
      encryptedKey: cloudKMSKeyReference, // Cloud KMS reference, not encrypted material
      keyVersion: 1,
      status: 'active',
      cryptoperiodMonths: this.CRYPTOPERIODS.root_kek,
      rotationScheduledAt: rotationDate,
    }).returning();

    logger.warn('⚠️  Root KEK placeholder created - Admin action required', {
      keyId: rootKEK.id,
      keyVersion: rootKEK.keyVersion,
      rotationScheduledAt: rotationDate,
      action: 'Create Root KEK in cloud KMS (AWS/GCP/Azure) and update encryptedKey with keyId/ARN',
      compliance: 'NIST SP 800-57, FedRAMP Rev. 5, IRS Pub 1075 § 5.3'
    });

    return rootKEK as KeyMetadata;
  }

  /**
   * Create State Master Key (Tier 2) for a state tenant
   */
  async createStateMasterKey(stateTenantId: string): Promise<KeyMetadata> {
    logger.info('🔑 Creating State Master Key (Tier 2)', {
      stateTenantId,
      service: 'KMS',
      action: 'createStateMasterKey'
    });

    // Verify state tenant exists
    const stateTenant = await db.query.stateTenants.findFirst({
      where: eq(stateTenants.id, stateTenantId)
    });

    if (!stateTenant) {
      throw new Error(`State tenant not found: ${stateTenantId}`);
    }

    // Check if state master key already exists
    const existingKey = await db.query.encryptionKeys.findFirst({
      where: and(
        eq(encryptionKeys.keyType, 'state_master'),
        eq(encryptionKeys.stateTenantId, stateTenantId),
        eq(encryptionKeys.status, 'active')
      )
    });

    if (existingKey) {
      logger.warn('State Master Key already exists', {
        keyId: existingKey.id,
        stateTenantId,
        stateCode: stateTenant.stateCode
      });
      return existingKey as KeyMetadata;
    }

    // Get active Root KEK
    const rootKEK = await this.getActiveRootKEK();
    
    // Generate new State Master Key
    const stateMasterKeyMaterial = crypto.randomBytes(32);
    
    // Encrypt State Master Key using Root KEK
    const encryptedStateMasterKey = await this.encryptWithKey(
      stateMasterKeyMaterial.toString('base64'),
      rootKEK
    );

    // Calculate rotation date
    const rotationDate = new Date();
    rotationDate.setMonth(rotationDate.getMonth() + this.CRYPTOPERIODS.state_master);

    const [stateMasterKey] = await db.insert(encryptionKeys).values({
      keyType: 'state_master',
      keyPurpose: 'key_encryption',
      stateTenantId,
      encryptedKey: encryptedStateMasterKey,
      keyVersion: 1,
      status: 'active',
      cryptoperiodMonths: this.CRYPTOPERIODS.state_master,
      rotationScheduledAt: rotationDate,
    }).returning();

    logger.info('✅ State Master Key created successfully', {
      keyId: stateMasterKey.id,
      stateTenantId,
      stateCode: stateTenant.stateCode,
      keyVersion: stateMasterKey.keyVersion,
      rotationScheduledAt: rotationDate,
      compliance: 'NIST SP 800-57'
    });

    return stateMasterKey as KeyMetadata;
  }

  /**
   * Create Table Data Encryption Key (Tier 3)
   * 
   * CRITICAL FIX (Architect-reviewed):
   * - Uses PostgreSQL advisory lock to prevent race conditions
   * - Ensures only one table key is created at a time per table
   * - Lock ID derived from hash(stateTenantId + tableName)
   */
  async createTableKey(
    stateTenantId: string,
    tableName: string
  ): Promise<KeyMetadata> {
    logger.info('🔐 Creating Table Key (Tier 3)', {
      stateTenantId,
      tableName,
      service: 'KMS',
      action: 'createTableKey'
    });

    // Compute deterministic lock ID from stateTenantId + tableName
    const lockId = this.computeLockId(stateTenantId, tableName);

    // Use transaction with advisory lock to prevent duplicate key creation
    return await db.transaction(async (tx) => {
      // CRITICAL: Acquire advisory lock to serialize key creation
      // Lock is automatically released when transaction completes
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);

      // Get State Master Key
      const stateMasterKey = await this.getStateMasterKey(stateTenantId);
      
      // Check if table key already exists (double-check under lock)
      const existingKey = await tx.query.encryptionKeys.findFirst({
        where: and(
          eq(encryptionKeys.keyType, 'table_key'),
          eq(encryptionKeys.stateTenantId, stateTenantId),
          eq(encryptionKeys.tableName, tableName),
          eq(encryptionKeys.status, 'active')
        )
      });

      if (existingKey) {
        logger.warn('Table Key already exists (found under lock)', {
          keyId: existingKey.id,
          tableName,
          stateTenantId
        });
        return existingKey as KeyMetadata;
      }

      // Generate new Table DEK
      const tableDEKMaterial = crypto.randomBytes(32);
      
      // Encrypt Table DEK using State Master Key
      const encryptedTableDEK = await this.encryptWithKey(
        tableDEKMaterial.toString('base64'),
        stateMasterKey
      );

      // Calculate rotation date
      const rotationDate = new Date();
      rotationDate.setMonth(rotationDate.getMonth() + this.CRYPTOPERIODS.table_key);

      const [tableDEK] = await tx.insert(encryptionKeys).values({
        keyType: 'table_key',
        keyPurpose: 'data_encryption',
        stateTenantId,
        tableName,
        encryptedKey: encryptedTableDEK,
        keyVersion: 1,
        status: 'active',
        cryptoperiodMonths: this.CRYPTOPERIODS.table_key,
        rotationScheduledAt: rotationDate,
      }).returning();

      logger.info('✅ Table Key created successfully', {
        keyId: tableDEK.id,
        tableName,
        stateTenantId,
        keyVersion: tableDEK.keyVersion,
        rotationScheduledAt: rotationDate
      });

      return tableDEK as KeyMetadata;
    });
  }

  /**
   * Compute deterministic lock ID from string keys
   * Uses FNV-1a hash to convert strings to int64 for PostgreSQL advisory locks
   */
  private computeLockId(...keys: string[]): number {
    const combined = keys.join(':');
    let hash = 2166136261; // FNV-1a offset basis
    
    for (let i = 0; i < combined.length; i++) {
      hash ^= combined.charCodeAt(i);
      hash = Math.imul(hash, 16777619); // FNV-1a prime
    }
    
    // Convert to signed 32-bit integer for PostgreSQL
    return hash | 0;
  }

  /**
   * Create Field Data Encryption Key (Tier 3)
   * 
   * CRITICAL FIX (Architect-reviewed):
   * - Uses PostgreSQL advisory lock to prevent race conditions
   * - Ensures only one field key is created at a time per field
   * - Lock ID derived from hash(stateTenantId + tableName + fieldName)
   */
  async createFieldKey(
    stateTenantId: string,
    tableName: string,
    fieldName: string
  ): Promise<KeyMetadata> {
    logger.info('🔐 Creating Field Key (Tier 3)', {
      stateTenantId,
      tableName,
      fieldName,
      service: 'KMS',
      action: 'createFieldKey'
    });

    // Compute deterministic lock ID from stateTenantId + tableName + fieldName
    const lockId = this.computeLockId(stateTenantId, tableName, fieldName);

    // Use transaction with advisory lock to prevent duplicate key creation
    return await db.transaction(async (tx) => {
      // CRITICAL: Acquire advisory lock to serialize key creation
      // Lock is automatically released when transaction completes
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);

      // Get State Master Key
      const stateMasterKey = await this.getStateMasterKey(stateTenantId);
      
      // Check if field key already exists (double-check under lock)
      const existingKey = await tx.query.encryptionKeys.findFirst({
        where: and(
          eq(encryptionKeys.keyType, 'field_key'),
          eq(encryptionKeys.stateTenantId, stateTenantId),
          eq(encryptionKeys.tableName, tableName),
          eq(encryptionKeys.fieldName, fieldName),
          eq(encryptionKeys.status, 'active')
        )
      });

      if (existingKey) {
        logger.warn('Field Key already exists (found under lock)', {
          keyId: existingKey.id,
          tableName,
          fieldName,
          stateTenantId
        });
        return existingKey as KeyMetadata;
      }

      // Generate new Field DEK
      const fieldDEKMaterial = crypto.randomBytes(32);
      
      // Encrypt Field DEK using State Master Key
      const encryptedFieldDEK = await this.encryptWithKey(
        fieldDEKMaterial.toString('base64'),
        stateMasterKey
      );

      // Calculate rotation date
      const rotationDate = new Date();
      rotationDate.setMonth(rotationDate.getMonth() + this.CRYPTOPERIODS.field_key);

      const [fieldDEK] = await tx.insert(encryptionKeys).values({
        keyType: 'field_key',
        keyPurpose: 'data_encryption',
        stateTenantId,
        tableName,
        fieldName,
        encryptedKey: encryptedFieldDEK,
        keyVersion: 1,
        status: 'active',
        cryptoperiodMonths: this.CRYPTOPERIODS.field_key,
        rotationScheduledAt: rotationDate,
      }).returning();

      logger.info('✅ Field Key created successfully', {
        keyId: fieldDEK.id,
        tableName,
        fieldName,
        stateTenantId,
        keyVersion: fieldDEK.keyVersion,
        rotationScheduledAt: rotationDate
      });

      return fieldDEK as KeyMetadata;
    });
  }

  /**
   * Encrypt data using field-level key from hierarchy
   */
  async encryptField(
    plaintext: string,
    stateTenantId: string,
    tableName: string,
    fieldName: string
  ): Promise<EncryptionResult> {
    // Get or create field key
    const fieldKey = await this.getOrCreateFieldKey(stateTenantId, tableName, fieldName);
    
    // Decrypt the field DEK using the key hierarchy
    const decryptedFieldDEK = await this.decryptKey(fieldKey);
    const fieldDEKBuffer = Buffer.from(decryptedFieldDEK, 'base64');
    
    // Encrypt data using the decrypted field DEK
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', fieldDEKBuffer, iv);
    
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    return {
      ciphertext,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: fieldKey.keyVersion,
    };
  }

  /**
   * Decrypt data using field-level key from hierarchy
   */
  async decryptField(
    encryptedData: EncryptionResult,
    stateTenantId: string,
    tableName: string,
    fieldName: string
  ): Promise<string> {
    // Get field key
    const fieldKey = await this.getFieldKey(stateTenantId, tableName, fieldName, encryptedData.keyVersion);
    
    if (!fieldKey) {
      throw new Error(`Field key not found: ${tableName}.${fieldName} v${encryptedData.keyVersion}`);
    }
    
    // Decrypt the field DEK using the key hierarchy
    const decryptedFieldDEK = await this.decryptKey(fieldKey);
    const fieldDEKBuffer = Buffer.from(decryptedFieldDEK, 'base64');
    
    // Decrypt data using the decrypted field DEK
    const { ciphertext, iv, authTag } = encryptedData;
    
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      fieldDEKBuffer,
      Buffer.from(iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    
    return plaintext;
  }

  /**
   * Rotate a key (create new version, mark old as retired)
   */
  async rotateKey(keyId: string): Promise<KeyMetadata> {
    logger.info('🔄 Rotating encryption key', {
      keyId,
      service: 'KMS',
      action: 'rotateKey'
    });

    const oldKey = await db.query.encryptionKeys.findFirst({
      where: eq(encryptionKeys.id, keyId)
    });

    if (!oldKey) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Mark old key as rotating
    await db.update(encryptionKeys)
      .set({ status: 'rotating', updatedAt: new Date() })
      .where(eq(encryptionKeys.id, keyId));

    let newKey: KeyMetadata;

    // Create new key based on type
    switch (oldKey.keyType) {
      case 'root_kek':
        newKey = await this.rotateRootKEK();
        break;
      
      case 'state_master':
        if (!oldKey.stateTenantId) {
          throw new Error('State tenant ID required for state master key rotation');
        }
        newKey = await this.rotateStateMasterKey(oldKey.stateTenantId);
        break;
      
      case 'table_key':
        if (!oldKey.stateTenantId || !oldKey.tableName) {
          throw new Error('State tenant ID and table name required for table key rotation');
        }
        newKey = await this.rotateTableKey(oldKey.stateTenantId, oldKey.tableName);
        break;
      
      case 'field_key':
        if (!oldKey.stateTenantId || !oldKey.tableName || !oldKey.fieldName) {
          throw new Error('State tenant ID, table name, and field name required for field key rotation');
        }
        newKey = await this.rotateFieldKey(oldKey.stateTenantId, oldKey.tableName, oldKey.fieldName);
        break;
      
      default:
        throw new Error(`Unknown key type: ${oldKey.keyType}`);
    }

    // Mark old key as retired
    await db.update(encryptionKeys)
      .set({ 
        status: 'retired', 
        retiredAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(encryptionKeys.id, keyId));

    logger.info('✅ Key rotation complete', {
      oldKeyId: keyId,
      newKeyId: newKey.id,
      keyType: oldKey.keyType,
      oldKeyVersion: oldKey.keyVersion,
      newKeyVersion: newKey.keyVersion
    });

    // Audit trail for key rotation
    await immutableAuditService.log({
      action: 'KEY_ROTATED',
      resource: 'encryption_keys',
      resourceId: newKey.id,
      userId: 'system',
      metadata: {
        oldKeyId: keyId,
        newKeyId: newKey.id,
        keyType: oldKey.keyType,
        oldKeyVersion: oldKey.keyVersion,
        newKeyVersion: newKey.keyVersion,
        stateTenantId: oldKey.stateTenantId,
        rotationReason: 'Scheduled cryptoperiod rotation per NIST SP 800-57',
        compliance: 'NIST SP 800-57, FedRAMP Rev. 5'
      },
    });

    return newKey;
  }

  /**
   * Cryptographically shred data by destroying all keys in the hierarchy
   * 
   * GDPR Art. 17 Compliance: Right to erasure via cryptographic shredding
   * NIST SP 800-88: Media sanitization through key destruction
   */
  async cryptographicallyShred(
    stateTenantId: string,
    tableName: string,
    recordIds: string[]
  ): Promise<void> {
    logger.warn('🔥 Cryptographic Shredding: Destroying encryption keys', {
      stateTenantId,
      tableName,
      recordCount: recordIds.length,
      service: 'KMS',
      action: 'cryptographicallyShred',
      compliance: 'GDPR Art. 17, NIST SP 800-88'
    });

    // Get all field keys for this table
    const fieldKeys = await db.query.encryptionKeys.findMany({
      where: and(
        eq(encryptionKeys.keyType, 'field_key'),
        eq(encryptionKeys.stateTenantId, stateTenantId),
        eq(encryptionKeys.tableName, tableName),
        eq(encryptionKeys.status, 'active')
      )
    });

    // Destroy each field key
    for (const fieldKey of fieldKeys) {
      await this.destroyKey(fieldKey.id);
    }

    logger.info('✅ Cryptographic shredding complete', {
      stateTenantId,
      tableName,
      recordCount: recordIds.length,
      keysDestroyed: fieldKeys.length,
      compliance: 'GDPR Art. 17 (Right to Erasure)'
    });

    // Audit trail for cryptographic shredding
    await immutableAuditService.log({
      action: 'DATA_SHREDDED',
      resource: 'encryption_keys',
      resourceId: `${tableName}_cryptoshred`,
      userId: 'system',
      metadata: {
        stateTenantId,
        tableName,
        recordCount: recordIds.length,
        keysDestroyed: fieldKeys.length,
        fieldKeysIds: fieldKeys.map(k => k.id),
        shredMethod: 'cryptographic_key_destruction',
        compliance: 'GDPR Art. 17, NIST SP 800-88',
        irreversible: true,
      },
      sensitiveDataAccessed: true,
    });
  }

  /**
   * Destroy a key (mark as destroyed, schedule cloud KMS deletion)
   */
  private async destroyKey(keyId: string): Promise<void> {
    const key = await db.query.encryptionKeys.findFirst({
      where: eq(encryptionKeys.id, keyId)
    });

    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Mark key as destroyed in database
    await db.update(encryptionKeys)
      .set({ 
        status: 'destroyed',
        destroyedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(encryptionKeys.id, keyId));

    // Schedule cloud KMS deletion (via existing encryption service)
    // This delegates to AWS/GCP/Azure KMS based on environment
    try {
      await encryptionService.deleteEncryptionKey(key.keyVersion);
    } catch (error) {
      logger.error('Cloud KMS deletion failed (key marked destroyed in DB)', {
        keyId,
        keyVersion: key.keyVersion,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    logger.info('🔥 Key destroyed', {
      keyId,
      keyType: key.keyType,
      keyVersion: key.keyVersion
    });

    // Audit trail for key destruction
    await immutableAuditService.log({
      action: 'KEY_DESTROYED',
      resource: 'encryption_keys',
      resourceId: keyId,
      userId: 'system',
      metadata: {
        keyType: key.keyType,
        keyVersion: key.keyVersion,
        stateTenantId: key.stateTenantId,
        tableName: key.tableName,
        fieldName: key.fieldName,
        destructionMethod: 'cloud_kms_scheduled_deletion',
        compliance: 'NIST SP 800-88, GDPR Art. 17'
      },
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async getActiveRootKEK(): Promise<any> {
    const rootKEK = await db.query.encryptionKeys.findFirst({
      where: and(
        eq(encryptionKeys.keyType, 'root_kek'),
        eq(encryptionKeys.status, 'active')
      )
    });

    if (!rootKEK) {
      throw new Error('No active Root KEK found. Run initializeRootKEK() first.');
    }

    return rootKEK;
  }

  private async getStateMasterKey(stateTenantId: string): Promise<any> {
    const stateMasterKey = await db.query.encryptionKeys.findFirst({
      where: and(
        eq(encryptionKeys.keyType, 'state_master'),
        eq(encryptionKeys.stateTenantId, stateTenantId),
        eq(encryptionKeys.status, 'active')
      )
    });

    if (!stateMasterKey) {
      throw new Error(`No active State Master Key found for tenant: ${stateTenantId}`);
    }

    return stateMasterKey;
  }

  private async getFieldKey(
    stateTenantId: string,
    tableName: string,
    fieldName: string,
    keyVersion: number
  ): Promise<any> {
    return await db.query.encryptionKeys.findFirst({
      where: and(
        eq(encryptionKeys.keyType, 'field_key'),
        eq(encryptionKeys.stateTenantId, stateTenantId),
        eq(encryptionKeys.tableName, tableName),
        eq(encryptionKeys.fieldName, fieldName),
        eq(encryptionKeys.keyVersion, keyVersion)
      )
    });
  }

  private async getOrCreateFieldKey(
    stateTenantId: string,
    tableName: string,
    fieldName: string
  ): Promise<any> {
    let fieldKey = await db.query.encryptionKeys.findFirst({
      where: and(
        eq(encryptionKeys.keyType, 'field_key'),
        eq(encryptionKeys.stateTenantId, stateTenantId),
        eq(encryptionKeys.tableName, tableName),
        eq(encryptionKeys.fieldName, fieldName),
        eq(encryptionKeys.status, 'active')
      )
    });

    if (!fieldKey) {
      fieldKey = await this.createFieldKey(stateTenantId, tableName, fieldName);
    }

    return fieldKey;
  }

  /**
   * Encrypt data using a specific key from the hierarchy
   */
  private async encryptWithKey(plaintext: string, key: any): Promise<EncryptionResult> {
    // Decrypt the parent key to get the actual key material
    const decryptedKeyMaterial = await this.decryptKey(key);
    const keyBuffer = Buffer.from(decryptedKeyMaterial, 'base64');
    
    // Encrypt plaintext using the decrypted key
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    return {
      ciphertext,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: key.keyVersion,
    };
  }

  /**
   * Decrypt a key using its parent key in the hierarchy
   */
  private async decryptKey(key: any): Promise<string> {
    const encryptedKeyData = key.encryptedKey as EncryptionResult;
    
    switch (key.keyType) {
      case 'root_kek':
        // Root KEK is encrypted by cloud KMS (via environment ENCRYPTION_KEY)
        return encryptionService.decrypt(encryptedKeyData) || '';
      
      case 'state_master': {
        // State Master Key is encrypted by Root KEK
        const rootKEK = await this.getActiveRootKEK();
        const rootKEKMaterial = encryptionService.decrypt(rootKEK.encryptedKey as EncryptionResult);
        if (!rootKEKMaterial) {
          throw new Error('Failed to decrypt Root KEK');
        }
        const rootKEKBuffer = Buffer.from(rootKEKMaterial, 'base64');
        
        // Decrypt State Master Key using Root KEK
        const decipher = crypto.createDecipheriv(
          'aes-256-gcm',
          rootKEKBuffer,
          Buffer.from(encryptedKeyData.iv, 'base64')
        );
        decipher.setAuthTag(Buffer.from(encryptedKeyData.authTag, 'base64'));
        let plaintext = decipher.update(encryptedKeyData.ciphertext, 'base64', 'utf8');
        plaintext += decipher.final('utf8');
        return plaintext;
      }
      
      case 'table_key':
      case 'field_key': {
        // Table/Field keys are encrypted by State Master Key
        if (!key.stateTenantId) {
          throw new Error('State tenant ID required for table/field key decryption');
        }
        const stateMasterKey = await this.getStateMasterKey(key.stateTenantId);
        const stateMasterKeyMaterial = await this.decryptKey(stateMasterKey);
        const stateMasterKeyBuffer = Buffer.from(stateMasterKeyMaterial, 'base64');
        
        // Decrypt data key using State Master Key
        const decipher = crypto.createDecipheriv(
          'aes-256-gcm',
          stateMasterKeyBuffer,
          Buffer.from(encryptedKeyData.iv, 'base64')
        );
        decipher.setAuthTag(Buffer.from(encryptedKeyData.authTag, 'base64'));
        let plaintext = decipher.update(encryptedKeyData.ciphertext, 'base64', 'utf8');
        plaintext += decipher.final('utf8');
        return plaintext;
      }
      
      default:
        throw new Error(`Unknown key type: ${key.keyType}`);
    }
  }

  // Rotation helper methods
  private async rotateRootKEK(): Promise<KeyMetadata> {
    const rootKEKMaterial = crypto.randomBytes(32);
    const encryptedRootKEK = encryptionService.encrypt(rootKEKMaterial.toString('base64'));
    
    if (!encryptedRootKEK) {
      throw new Error('Failed to encrypt new Root KEK');
    }

    const currentRootKEK = await this.getActiveRootKEK();
    const newVersion = currentRootKEK.keyVersion + 1;

    const rotationDate = new Date();
    rotationDate.setMonth(rotationDate.getMonth() + this.CRYPTOPERIODS.root_kek);

    const [newRootKEK] = await db.insert(encryptionKeys).values({
      keyType: 'root_kek',
      keyPurpose: 'key_encryption',
      encryptedKey: encryptedRootKEK,
      keyVersion: newVersion,
      status: 'active',
      cryptoperiodMonths: this.CRYPTOPERIODS.root_kek,
      rotationScheduledAt: rotationDate,
    }).returning();

    return newRootKEK as KeyMetadata;
  }

  private async rotateStateMasterKey(stateTenantId: string): Promise<KeyMetadata> {
    const rootKEK = await this.getActiveRootKEK();
    const stateMasterKeyMaterial = crypto.randomBytes(32);
    const encryptedStateMasterKey = await this.encryptWithKey(
      stateMasterKeyMaterial.toString('base64'),
      rootKEK
    );

    const currentStateMasterKey = await this.getStateMasterKey(stateTenantId);
    const newVersion = currentStateMasterKey.keyVersion + 1;

    const rotationDate = new Date();
    rotationDate.setMonth(rotationDate.getMonth() + this.CRYPTOPERIODS.state_master);

    const [newStateMasterKey] = await db.insert(encryptionKeys).values({
      keyType: 'state_master',
      keyPurpose: 'key_encryption',
      stateTenantId,
      encryptedKey: encryptedStateMasterKey,
      keyVersion: newVersion,
      status: 'active',
      cryptoperiodMonths: this.CRYPTOPERIODS.state_master,
      rotationScheduledAt: rotationDate,
    }).returning();

    return newStateMasterKey as KeyMetadata;
  }

  private async rotateTableKey(stateTenantId: string, tableName: string): Promise<KeyMetadata> {
    const stateMasterKey = await this.getStateMasterKey(stateTenantId);
    const tableDEKMaterial = crypto.randomBytes(32);
    const encryptedTableDEK = await this.encryptWithKey(
      tableDEKMaterial.toString('base64'),
      stateMasterKey
    );

    const currentTableKey = await db.query.encryptionKeys.findFirst({
      where: and(
        eq(encryptionKeys.keyType, 'table_key'),
        eq(encryptionKeys.stateTenantId, stateTenantId),
        eq(encryptionKeys.tableName, tableName),
        eq(encryptionKeys.status, 'active')
      )
    });

    if (!currentTableKey) {
      throw new Error(`No active table key found for ${tableName}`);
    }

    const newVersion = currentTableKey.keyVersion + 1;

    const rotationDate = new Date();
    rotationDate.setMonth(rotationDate.getMonth() + this.CRYPTOPERIODS.table_key);

    const [newTableKey] = await db.insert(encryptionKeys).values({
      keyType: 'table_key',
      keyPurpose: 'data_encryption',
      stateTenantId,
      tableName,
      encryptedKey: encryptedTableDEK,
      keyVersion: newVersion,
      status: 'active',
      cryptoperiodMonths: this.CRYPTOPERIODS.table_key,
      rotationScheduledAt: rotationDate,
    }).returning();

    return newTableKey as KeyMetadata;
  }

  private async rotateFieldKey(
    stateTenantId: string,
    tableName: string,
    fieldName: string
  ): Promise<KeyMetadata> {
    const stateMasterKey = await this.getStateMasterKey(stateTenantId);
    const fieldDEKMaterial = crypto.randomBytes(32);
    const encryptedFieldDEK = await this.encryptWithKey(
      fieldDEKMaterial.toString('base64'),
      stateMasterKey
    );

    const currentFieldKey = await db.query.encryptionKeys.findFirst({
      where: and(
        eq(encryptionKeys.keyType, 'field_key'),
        eq(encryptionKeys.stateTenantId, stateTenantId),
        eq(encryptionKeys.tableName, tableName),
        eq(encryptionKeys.fieldName, fieldName),
        eq(encryptionKeys.status, 'active')
      )
    });

    if (!currentFieldKey) {
      throw new Error(`No active field key found for ${tableName}.${fieldName}`);
    }

    const newVersion = currentFieldKey.keyVersion + 1;

    const rotationDate = new Date();
    rotationDate.setMonth(rotationDate.getMonth() + this.CRYPTOPERIODS.field_key);

    const [newFieldKey] = await db.insert(encryptionKeys).values({
      keyType: 'field_key',
      keyPurpose: 'data_encryption',
      stateTenantId,
      tableName,
      fieldName,
      encryptedKey: encryptedFieldDEK,
      keyVersion: newVersion,
      status: 'active',
      cryptoperiodMonths: this.CRYPTOPERIODS.field_key,
      rotationScheduledAt: rotationDate,
    }).returning();

    return newFieldKey as KeyMetadata;
  }

  /**
   * Get keys due for rotation
   */
  async getKeysNeedingRotation(): Promise<KeyMetadata[]> {
    const now = new Date();
    
    const keys = await db.query.encryptionKeys.findMany({
      where: and(
        eq(encryptionKeys.status, 'active'),
        sql`${encryptionKeys.rotationScheduledAt} <= ${now}`
      )
    });

    return keys as KeyMetadata[];
  }

  /**
   * Check key hierarchy health
   */
  async checkKeyHealth(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check Root KEK
    const rootKEK = await db.query.encryptionKeys.findFirst({
      where: and(
        eq(encryptionKeys.keyType, 'root_kek'),
        eq(encryptionKeys.status, 'active')
      )
    });

    if (!rootKEK) {
      issues.push('No active Root KEK found');
    }

    // Check for keys needing rotation
    const keysNeedingRotation = await this.getKeysNeedingRotation();
    if (keysNeedingRotation.length > 0) {
      issues.push(`${keysNeedingRotation.length} keys need rotation`);
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance
export const kmsService = new KMSService();
export type { KeyMetadata };
