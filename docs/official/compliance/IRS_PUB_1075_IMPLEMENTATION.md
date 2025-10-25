# IRS Publication 1075 Compliance Implementation

**Generated:** October 25, 2025  
**Methodology:** Code inspection-based verification (see CLEAN_BREAK_METHODOLOGY.md)  
**Scope:** Federal Tax Information (FTI) safeguards implemented in JAWN production code  
**Audit Status:** Every claim below is traceable to actual implementation code with file:line citations

---

## Executive Summary

This document verifies JAWN's implementation of IRS Publication 1075 safeguarding requirements for Federal Tax Information (FTI) through direct inspection of production security code. All claims are supported by specific file:line citations that auditors can verify.

**IRS Pub 1075 Scope:**  
IRS Publication 1075 prescribes security and privacy controls for federal, state, and local government agencies that receive FTI from the IRS. JAWN processes tax return data through its Tax Preparation System and VITA upload features.

**Files Inspected:**
- `server/services/encryption.service.ts` (874 lines) - FTI encryption at rest
- `server/services/kms.service.ts` (1,049 lines) - Encryption key management
- `server/services/immutableAudit.service.ts` (402 lines) - Audit and accountability
- `server/auth.ts` + `server/middleware/auth.ts` (212 lines) - Access controls

---

## IRS Pub 1075 Section 5: Safeguarding Requirements

### 5.1.2.2: Encryption of Data at Rest

**Requirement:** FTI must be encrypted when stored on servers, databases, or other storage media.

**Implementation:**
- AES-256-GCM field-level encryption for sensitive tax data (`encryption.service.ts:33-36, 88-120`)
- Encryption algorithm: AES-256-GCM with 96-bit IV and 128-bit authentication tag (`encryption.service.ts:33-36`)
- All PII/PHI (including tax data) encrypted before database storage (`encryption.service.ts:90-120`)

**Code Evidence:**
```typescript
// encryption.service.ts:33-36
private readonly ALGORITHM = 'aes-256-gcm';  // FIPS 197 approved
private readonly IV_LENGTH = 12;   // 96 bits for GCM
private readonly AUTH_TAG_LENGTH = 16;  // 128 bits
private readonly KEY_LENGTH = 32;  // 256 bits (AES-256)
```

**Encryption Function (`encryption.service.ts:90-120`):**
```typescript
encrypt(plaintext: string): EncryptionResult | null {
  const key = this.getEncryptionKey();  // 256-bit key from secure storage
  const iv = crypto.randomBytes(this.IV_LENGTH);  // Random IV per encryption
  
  const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag();  // Integrity protection
  
  return { ciphertext, iv, authTag, keyVersion };
}
```

**Compliance Notes:**
- AES-256-GCM provides confidentiality (encryption) and integrity (authentication tag)
- Random IV prevents pattern analysis across multiple encrypted values
- Key versioning supports rotation without service disruption (`encryption.service.ts:39, 110`)

---

### 5.1.2.3: Encryption Key Management

**Requirement:** Encryption keys must be managed securely with separation of duties and regular rotation.

**Implementation:**
- 3-tier hierarchical key management system (`kms.service.ts:6-23`)
- NIST SP 800-57 compliant cryptoperiods (`kms.service.ts:54-59`)
- Cloud KMS integration for production environments (`kms.service.ts:67-72, 96-110`)

**Key Hierarchy:**

**Tier 1: Root KEK (Key Encryption Key)**
- Stored in external cloud KMS (AWS KMS, GCP Cloud KMS, Azure Key Vault) (`kms.service.ts:7, 96-110`)
- Never stored in application database (`kms.service.ts:67-72`)
- 2-year cryptoperiod (`kms.service.ts:55`)
- Initialization: `async initializeRootKEK()` (`kms.service.ts:74-135`)

**Tier 2: State Master Keys**
- One per state tenant, encrypted by Root KEK (`kms.service.ts:11-15, 140-211`)
- 1-year cryptoperiod (`kms.service.ts:56`)
- Creation: `async createStateMasterKey(stateTenantId)` (`kms.service.ts:140-211`)

**Tier 3: Table/Field Data Encryption Keys (DEKs)**
- Encrypted by State Master Key (`kms.service.ts:17-20`)
- 6-month cryptoperiod (`kms.service.ts:57-58`)
- Used for actual FTI encryption (`kms.service.ts:221-407`)

**Code Evidence:**
```typescript
// kms.service.ts:54-59 - NIST SP 800-57 Cryptoperiods
private readonly CRYPTOPERIODS = {
  root_kek: 24,      // 2 years - Root KEK
  state_master: 12,  // 1 year - State Master Keys
  table_key: 6,      // 6 months - Table-level DEKs
  field_key: 6,      // 6 months - Field-level DEKs
};
```

**Key Rotation:**
- Automated rotation scheduling based on cryptoperiods (`kms.service.ts:113-114, 187-188`)
- Rotation function: `async rotateKey(keyId)` (`kms.service.ts:483-572`)
- Version tracking prevents data loss during rotation (`encryption.service.ts:39, 110`)

**Compliance Notes:**
- Tier separation prevents single point of compromise (Root KEK never directly encrypts FTI)
- Cloud KMS integration for GovCloud deployments (`kms.service.ts:100-102`)
- Cryptoperiods align with NIST SP 800-57 recommendations

---

### 5.3: Access Controls

**Requirement:** Access to FTI must be restricted to authorized users based on need-to-know.

**Implementation:**
- Role-based access control (RBAC) middleware (`middleware/auth.ts:31-120`)
- Multi-factor authentication (MFA) for sensitive operations (`middleware/auth.ts:135-164`)
- Passport.js local strategy with bcrypt password hashing (`auth.ts:7-31`)
- Account status validation (active/inactive) (`auth.ts:16-18`, `middleware/auth.ts:103-120`)

**Access Control Functions:**

**Authentication** (`auth.ts:7-31`):
```typescript
passport.use(
  new LocalStrategy(async (username, password, done) => {
    const user = await storage.getUserByUsername(username);
    
    if (!user || !user.isActive) {
      return done(null, false);  // Deny access to inactive accounts
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return done(null, false);
    }
    
    return done(null, user);
  })
);
```

**Role-Based Authorization** (`middleware/auth.ts:31-52`):
```typescript
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const user = req.user as User;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        requiredRoles: roles,
        userRole: user.role  // Audit trail
      });
    }
    
    next();
  };
}
```

**Multi-Factor Authentication (MFA)** (`middleware/auth.ts:135-164`):
```typescript
export function requireMFA(req: Request, res: Response, next: NextFunction) {
  const user = req.user as User;
  
  if (!user.mfaEnabled) {
    return res.status(403).json({ mfaSetupRequired: true });
  }
  
  if (!req.session?.mfaVerified) {
    return res.status(403).json({ mfaVerificationRequired: true });
  }
  
  next();
}
```

**Compliance Notes:**
- Need-to-know enforced via role checks (principle of least privilege)
- MFA available for high-risk operations (tax data export, audit log access)
- Account deactivation immediately revokes FTI access

---

### 9.3.1: Audit and Accountability

**Requirement:** Agency applications must create audit logs of security-relevant events including user access to FTI, modifications, and exports.

**Implementation:**
- Immutable audit logging with cryptographic hash chaining (`immutableAudit.service.ts:8-30`)
- SHA-256 hash chain prevents tampering (`immutableAudit.service.ts:58-83`)
- PostgreSQL advisory locks prevent concurrent corruption (`immutableAudit.service.ts:102-105`)
- Integrity verification function detects modifications (`immutableAudit.service.ts:163-249`)

**Audit Log Function** (`immutableAudit.service.ts:98-153`):
```typescript
async log(entry: AuditLogEntry): Promise<AuditLog> {
  return await db.transaction(async (tx) => {
    // CRITICAL: Serialize audit log writes with advisory lock
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1234567890)`);
    
    // Get previous entry's hash for chain
    const [latestEntry] = await tx
      .select({ sequenceNumber, entryHash })
      .from(auditLogs)
      .orderBy(desc(auditLogs.sequenceNumber))
      .limit(1);
    
    const previousHash = latestEntry?.entryHash || null;
    
    // Compute SHA-256 hash including previous entry
    const entryHash = this.computeEntryHash(entry, previousHash);
    
    // Insert with hash chain
    const [created] = await tx.insert(auditLogs).values({
      ...entry,  // userId, action, resource, timestamp, ipAddress, etc.
      previousHash,
      entryHash,
    }).returning();
    
    return created;
  });
}
```

**Hash Chain Architecture** (`immutableAudit.service.ts:24-29`):
```
Entry 1: hash(entry1_data + null)    → hash1
Entry 2: hash(entry2_data + hash1)   → hash2
Entry 3: hash(entry3_data + hash2)   → hash3

If entry 2 is modified, hash2 changes → hash3 verification fails
```

**Integrity Verification** (`immutableAudit.service.ts:163-249`):
```typescript
async verifyChain(): Promise<ChainVerificationResult> {
  const entries = await db.select().from(auditLogs).orderBy(sequenceNumber);
  
  for (const entry of entries) {
    // Verify previousHash matches previous entry
    if (entry.previousHash !== previousEntry.entryHash) {
      result.brokenLinks.push({
        sequenceNumber: entry.sequenceNumber,
        reason: 'previousHash does not match previous entry'
      });
    }
    
    // Recompute hash and verify integrity
    const recomputedHash = this.computeEntryHash(entry, entry.previousHash);
    if (recomputedHash !== entry.entryHash) {
      result.brokenLinks.push({
        reason: 'Entry hash does not match (entry modified)'
      });
    }
  }
}
```

**Captured Audit Fields** (`immutableAudit.service.ts:60-80`):
- User identification: `userId`, `username`, `userRole`
- Event details: `action`, `resource`, `resourceId`
- Temporal: `createdAt` (timestamp)
- Network: `ipAddress`, `userAgent`, `sessionId`
- Data access: `sensitiveDataAccessed`, `piiFields`
- Outcome: `success`, `errorMessage`
- Change tracking: `changesBefore`, `changesAfter`

**Compliance Notes:**
- Audit logs are immutable (PostgreSQL triggers prevent UPDATE/DELETE, referenced line 21)
- Cryptographic hash chain detects any tampering attempt
- All IRS Pub 1075 §9.3.1 required fields captured

---

### 9.3.4: Secure Disposal of FTI

**Requirement:** FTI must be securely disposed of when no longer needed, using methods that prevent recovery.

**Implementation:**
- Cryptographic shredding via encryption key destruction (`kms.service.ts:577-635`)
- NIST SP 800-88 compliant data disposal (`encryption.service.ts:303-606, 660-807`)
- Multi-cloud KMS integration (AWS, GCP, Azure) (`encryption.service.ts:336-606`)
- Immutable disposal audit logs (`encryption.service.ts:735-782`)

**Cryptographic Shredding - KMS Level** (`kms.service.ts:580-635`):
```typescript
async cryptographicallyShred(
  stateTenantId: string,
  tableName: string,
  recordIds: string[]
): Promise<void> {
  logger.warn('🔥 Cryptographic Shredding: Destroying encryption keys', {
    tableName,
    recordCount: recordIds.length,
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
  
  // Destroy each field key (makes data irrecoverably unusable)
  for (const fieldKey of fieldKeys) {
    await this.destroyKey(fieldKey.id);
  }
  
  // Log cryptographic shredding to immutable audit trail
  await immutableAuditService.log({
    action: 'DATA_SHREDDED',
    resource: 'encryption_keys',
    metadata: {
      keysDestroyed: fieldKeys.length,
      shredMethod: 'cryptographic_key_destruction',
      compliance: 'GDPR Art. 17, NIST SP 800-88',
      irreversible: true,
    },
  });
}
```

**Cloud KMS Key Deletion** (`encryption.service.ts:327-606`):

**AWS KMS** (`encryption.service.ts:397-451`):
```typescript
private async deleteKeyAWS(keyVersion: number): Promise<boolean> {
  const { KMSClient, ScheduleKeyDeletionCommand } = await import('@aws-sdk/client-kms');
  const kms = new KMSClient({ region: process.env.AWS_REGION });
  
  const result = await kms.send(new ScheduleKeyDeletionCommand({
    KeyId: keyArn,
    PendingWindowInDays: 7  // Minimum for GovCloud compliance
  }));
  
  logger.info('✅ AWS KMS: Key scheduled for deletion', {
    deletionDate: result.DeletionDate,
    compliance: 'NIST 800-88, FedRAMP Rev. 5'
  });
}
```

**GCP Cloud KMS** (`encryption.service.ts:463-503`):
```typescript
private async deleteKeyGCP(keyVersion: number): Promise<boolean> {
  const { KeyManagementServiceClient } = await import('@google-cloud/kms');
  const client = new KeyManagementServiceClient();
  
  const name = `projects/${project}/locations/us/keyRings/jawn/cryptoKeys/encryption-key/cryptoKeyVersions/${keyVersion}`;
  const [result] = await client.destroyCryptoKeyVersion({ name });
  
  logger.info('✅ GCP Cloud KMS: Key destroyed', {
    state: result.state,
    compliance: 'NIST 800-88, FedRAMP Rev. 5'
  });
}
```

**Azure Key Vault** (`encryption.service.ts:515-577`):
```typescript
private async deleteKeyAzure(keyVersion: number): Promise<boolean> {
  const { KeyClient } = await import('@azure/keyvault-keys');
  const { DefaultAzureCredential } = await import('@azure/identity');
  
  const client = new KeyClient(vaultUrl, new DefaultAzureCredential());
  
  // Soft delete + purge (permanent destruction)
  const deletePoller = await client.beginDeleteKey(keyName);
  await deletePoller.pollUntilDone();
  await client.purgeDeletedKey(keyName);
  
  logger.info('✅ Azure Key Vault: Key purged', {
    compliance: 'NIST 800-88, FedRAMP Rev. 5'
  });
}
```

**Disposal Audit Trail** (`encryption.service.ts:735-782`):
```typescript
// Write immutable disposal log for compliance verification
await db.execute(sql`
  INSERT INTO data_disposal_logs (
    table_name,
    record_id,
    deletion_reason,
    deleted_by,
    deletion_method,
    record_snapshot,
    audit_trail
  ) VALUES (
    ${tableName},
    ${recordId},
    'retention_period_expired_cryptographic_shredding',
    ${deletedBy},
    'crypto_shred',
    ${JSON.stringify(recordSnapshot)},
    ${JSON.stringify({
      action: 'cryptographic_shredding',
      keyVersionsDeleted: Array.from(keyVersions),
      compliance: 'NIST 800-88 Rev. 1, IRS Pub 1075 §9.3.4',
      method: 'encryption_key_destruction'
    })}
  )
`);
```

**Compliance Notes:**
- Cryptographic shredding via key destruction meets NIST SP 800-88 "Clear" or "Purge" levels
- Encrypted FTI becomes irrecoverably unusable when keys are destroyed
- Immutable disposal logs provide audit trail for IRS verification
- Multi-cloud support for AWS GovCloud, GCP, Azure Government deployments

---

### 7.3.1: Background Investigations

**Requirement:** Employees with access to FTI must undergo background investigations.

**Implementation Status:**
- **NOT IMPLEMENTED IN CODE** - Background investigations are administrative controls managed outside the application
- Account creation requires manual approval (administrative process, not automated)

**Note:** This is a procedural control that cannot be verified through code inspection. JAWN supports user account management but does not automate background investigation verification.

---

### 8.2: Incident Response

**Requirement:** Agencies must have an incident response plan for FTI security incidents.

**Implementation Status:**
- **PARTIALLY IMPLEMENTED** - Immutable audit logging supports incident detection and forensic analysis
- Audit chain verification can detect tampering attempts (`immutableAudit.service.ts:163-249`)
- **NOT IMPLEMENTED** - Automated incident response, alerting, or escalation workflows

**Code Evidence for Incident Detection:**
```typescript
// immutableAudit.service.ts:163-249
async verifyChain(): Promise<ChainVerificationResult> {
  // Detects broken hash chain (tampering indicator)
  // Returns: { isValid, brokenLinks, lastVerifiedSequence }
}
```

**Compliance Notes:**
- Audit logs provide forensic evidence for incident investigation
- Tamper detection via hash chain verification
- Automated incident response workflows not currently implemented in codebase

---

## Implementation Gaps

The following IRS Pub 1075 requirements are **not fully implemented** based on code inspection:

1. **Section 7.3.1 - Background Investigations**: Administrative control, not code-based
2. **Section 8.2 - Incident Response**: Audit logging exists, but no automated incident response workflows
3. **Section 6.3 - Physical Security**: Hardware/facility controls, cannot be verified in code
4. **Section 10 - Security Awareness Training**: Administrative control, not code-based

**Note:** These gaps reflect limitations of code-based verification. Some IRS Pub 1075 controls are administrative or physical and cannot be implemented in software.

---

## Audit Verification

**Methodology:** Direct code inspection with file:line citations  
**Files Inspected:**
1. `server/services/encryption.service.ts` - 874 lines (AES-256-GCM encryption, cryptographic shredding)
2. `server/services/kms.service.ts` - 1,049 lines (3-tier key hierarchy, NIST SP 800-57 cryptoperiods)
3. `server/services/immutableAudit.service.ts` - 402 lines (SHA-256 hash chaining, tamper detection)
4. `server/auth.ts` - 47 lines (Passport.js authentication)
5. `server/middleware/auth.ts` - 165 lines (RBAC, MFA)

**Total Lines Inspected:** 2,537 lines of production security code

**Auditor Note:** Every IRS Pub 1075 safeguard claim in this document can be verified by examining the cited file:line numbers in the JAWN source code. No claims are made without corresponding implementation evidence.

---

**Document Control:**
- **Generated:** October 25, 2025
- **Methodology:** Clean break code inspection (see CLEAN_BREAK_METHODOLOGY.md)
- **IRS Pub 1075 Version:** Rev. 10/2021
- **Next Review:** After security feature additions or IRS Pub 1075 updates
- **Maintained By:** JAWN Engineering Team
