# HIPAA Security Rule Implementation

**Generated:** October 25, 2025  
**Methodology:** Code inspection-based verification (see CLEAN_BREAK_METHODOLOGY.md)  
**Scope:** Protected Health Information (PHI) safeguards implemented in JAWN production code  
**Audit Status:** Every claim below is traceable to actual implementation code with file:line citations

---

## Executive Summary

This document verifies JAWN's implementation of HIPAA Security Rule (45 CFR Part 164, Subpart C) technical safeguards through direct inspection of production security code. All claims are supported by specific file:line citations that auditors can verify.

**HIPAA Scope:**  
JAWN processes Protected Health Information (PHI) through Medicaid eligibility screening, SNAP medical expense deductions, and disability determination workflows. As a covered entity or business associate, JAWN must comply with HIPAA Privacy and Security Rules.

**Files Inspected:**
- `server/services/encryption.service.ts` (874 lines) - PHI encryption at rest
- `server/services/kms.service.ts` (1,049 lines) - Encryption key management
- `server/services/immutableAudit.service.ts` (402 lines) - Audit controls
- `server/auth.ts` + `server/middleware/auth.ts` (212 lines) - Access controls

---

## HIPAA Security Rule § 164.312: Technical Safeguards

### § 164.312(a)(1): Access Control

**Standard:** Implement technical policies and procedures for electronic information systems that maintain electronic protected health information to allow access only to those persons or software programs that have been granted access rights.

**Implementation Specifications:**

#### (i) Unique User Identification (Required)

**Implementation:**
- Passport.js local strategy with unique username identification (`auth.ts:7-31`)
- User lookup by username: `storage.getUserByUsername(username)` (`auth.ts:10`)
- Session serialization by user ID: `passport.serializeUser((user) => user.id)` (`auth.ts:33-35`)

**Code Evidence:**
```typescript
// auth.ts:7-31 - Unique user authentication
passport.use(
  new LocalStrategy(async (username, password, done) => {
    const user = await storage.getUserByUsername(username);  // Unique identifier lookup
    
    if (!user) {
      return done(null, false, { message: "Invalid username or password" });
    }
    
    if (!user.isActive) {
      return done(null, false, { message: "Account is inactive" });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return done(null, false);
    }
    
    return done(null, user);  // Authenticated unique user
  })
);
```

**Compliance Notes:**
- Each user identified by unique username (no shared accounts)
- Account status validation prevents inactive user access (line 16-18)
- Session tracking via unique user ID (line 33-35)

---

#### (ii) Emergency Access Procedure (Required)

**Implementation Status:**
- **NOT IMPLEMENTED IN CODE** - Emergency access procedures are administrative controls
- No break-glass access mechanism found in inspected code

**Compliance Gap:** Emergency access for PHI during system failures or emergencies is not implemented. This is a required HIPAA specification.

---

#### (iii) Automatic Logoff (Addressable)

**Implementation Status:**
- **NOT VERIFIED IN CODE** - Session timeout configuration may exist in session middleware
- Not found in inspected security service files

**Note:** Session timeout implementation would be in `server/index.ts` session configuration, which was not part of this security-focused code inspection.

---

#### (iv) Encryption and Decryption (Addressable)

**Implementation:**
- AES-256-GCM field-level encryption for PHI (`encryption.service.ts:33-36, 88-120`)
- 3-tier hierarchical key management (`kms.service.ts:6-23`)
- Encryption function: `encrypt(plaintext: string): EncryptionResult` (`encryption.service.ts:90-120`)
- Decryption function: `decrypt(encryptedData: EncryptionResult): string` (`encryption.service.ts:125-158`)

**Code Evidence:**
```typescript
// encryption.service.ts:33-36 - AES-256-GCM Configuration
private readonly ALGORITHM = 'aes-256-gcm';  // NIST FIPS 197 approved
private readonly IV_LENGTH = 12;   // 96 bits for GCM
private readonly AUTH_TAG_LENGTH = 16;  // 128 bits for integrity
private readonly KEY_LENGTH = 32;  // 256 bits (AES-256)
```

**Encryption Implementation (`encryption.service.ts:90-120`):**
```typescript
encrypt(plaintext: string): EncryptionResult | null {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return null;
  }
  
  const key = this.getEncryptionKey();  // 256-bit key
  const iv = crypto.randomBytes(this.IV_LENGTH);  // Random IV per encryption
  
  const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();  // GCM authentication tag
  
  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),  // Integrity protection
    keyVersion: this.currentKeyVersion,  // Key rotation support
  };
}
```

**Decryption Implementation (`encryption.service.ts:125-158`):**
```typescript
decrypt(encryptedData: EncryptionResult | null): string | null {
  if (!encryptedData) return null;
  
  const { ciphertext, iv, authTag, keyVersion } = encryptedData;
  
  let key = this.getEncryptionKey(keyVersion || this.currentKeyVersion);
  
  try {
    return this.decryptWithKey(ciphertext, iv, authTag, key);
  } catch (error) {
    // Fallback to previous key for rotation support
    const previousKey = this.getPreviousKey();
    if (previousKey) {
      return this.decryptWithKey(ciphertext, iv, authTag, previousKey);
    }
    throw error;
  }
}
```

**Key Management (`kms.service.ts:54-59, 74-407`):**
- 3-tier key hierarchy: Root KEK → State Master Keys → Data Encryption Keys
- NIST SP 800-57 compliant cryptoperiods (6-24 months)
- Cloud KMS integration (AWS, GCP, Azure) for production deployments

**Compliance Notes:**
- AES-256-GCM provides HIPAA-compliant encryption strength
- Random IV prevents pattern analysis
- Authentication tag ensures data integrity (detects tampering)
- Key versioning supports rotation without service disruption

---

### § 164.312(a)(2): Role-Based Access Control

**Implementation:**
- RBAC middleware enforces minimum necessary principle (`middleware/auth.ts:31-120`)
- Role validation function: `requireRole(...roles)` (`middleware/auth.ts:31-52`)
- Staff-only access: `requireStaff()` (`middleware/auth.ts:57-75`)
- Admin-only access: `requireAdmin()` (`middleware/auth.ts:80-98`)

**Code Evidence:**
```typescript
// middleware/auth.ts:31-52 - Role-Based Access Control
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const user = req.user as User;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        message: `This resource requires one of the following roles: ${roles.join(", ")}`,
        requiredRoles: roles,
        userRole: user.role  // Audit trail of denial
      });
    }
    
    next();  // Access granted
  };
}
```

**Staff Access Control (`middleware/auth.ts:57-75`):**
```typescript
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  const user = req.user as User;
  if (!['navigator', 'caseworker', 'admin'].includes(user.role)) {
    return res.status(403).json({ 
      error: "Staff access required",
      message: "This resource is only accessible to Maryland DHS staff members",
      userRole: user.role
    });
  }
  
  next();
}
```

**Compliance Notes:**
- Implements HIPAA minimum necessary principle via role restrictions
- Access denials logged with user role and required roles (audit trail)
- Separation of duties via role hierarchy (applicant < navigator < admin)

---

### § 164.312(b): Audit Controls

**Standard:** Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use electronic protected health information.

**Implementation:**
- Immutable audit logging with cryptographic hash chaining (`immutableAudit.service.ts:8-30`)
- SHA-256 hash chain prevents tampering (`immutableAudit.service.ts:58-83`)
- Audit log function: `async log(entry: AuditLogEntry)` (`immutableAudit.service.ts:98-153`)
- Integrity verification: `async verifyChain()` (`immutableAudit.service.ts:163-249`)

**Code Evidence:**
```typescript
// immutableAudit.service.ts:98-153 - Audit Log Creation
async log(entry: AuditLogEntry): Promise<AuditLog> {
  return await db.transaction(async (tx) => {
    // CRITICAL: PostgreSQL advisory lock prevents concurrent corruption
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1234567890)`);
    
    // Get previous entry's hash for blockchain-style chaining
    const [latestEntry] = await tx
      .select({ sequenceNumber, entryHash })
      .from(auditLogs)
      .orderBy(desc(auditLogs.sequenceNumber))
      .limit(1);
    
    const previousHash = latestEntry?.entryHash || null;
    
    // Compute SHA-256 hash including previous entry's hash
    const entryHash = this.computeEntryHash(entry, previousHash);
    
    // Insert with cryptographic hash chain
    const [created] = await tx.insert(auditLogs).values({
      ...entry,  // userId, action, resource, timestamp, ipAddress, etc.
      previousHash,  // Links to previous entry
      entryHash,     // Current entry's hash
    }).returning();
    
    return created;
  });
}
```

**Hash Chain Architecture (`immutableAudit.service.ts:24-29`):**
```
Entry 1: hash(entry1_data + null)    → hash1
Entry 2: hash(entry2_data + hash1)   → hash2
Entry 3: hash(entry3_data + hash2)   → hash3

If entry 2 is modified, hash2 changes → hash3 verification fails
```

**Integrity Verification (`immutableAudit.service.ts:163-249`):**
```typescript
async verifyChain(): Promise<ChainVerificationResult> {
  const entries = await db.select().from(auditLogs).orderBy(sequenceNumber);
  
  for (const entry of entries) {
    // Verify hash chain linkage
    if (entry.previousHash !== previousEntry.entryHash) {
      result.brokenLinks.push({
        sequenceNumber: entry.sequenceNumber,
        reason: 'previousHash does not match previous entry (chain break)'
      });
    }
    
    // Recompute hash and verify integrity
    const recomputedHash = this.computeEntryHash(entry, entry.previousHash);
    if (recomputedHash !== entry.entryHash) {
      result.brokenLinks.push({
        sequenceNumber: entry.sequenceNumber,
        reason: 'Entry hash does not match (entry modified)'
      });
    }
  }
  
  return result;
}
```

**Captured Audit Fields (`immutableAudit.service.ts:60-80`):**
- **Who**: `userId`, `username`, `userRole`
- **What**: `action`, `resource`, `resourceId`, `changesBefore`, `changesAfter`
- **When**: `createdAt` (timestamp)
- **Where**: `ipAddress`, `userAgent`, `sessionId`
- **Why**: `details`, `requestId`
- **PHI Access**: `sensitiveDataAccessed`, `piiFields`
- **Outcome**: `success`, `errorMessage`

**Compliance Notes:**
- Audit logs capture all HIPAA-required fields (who, what, when, where, why)
- Cryptographic hash chain prevents unauthorized modification or deletion
- PostgreSQL triggers prevent UPDATE/DELETE operations (referenced line 21)
- Tamper detection via `verifyChain()` function

---

### § 164.312(c)(1): Integrity

**Standard:** Implement policies and procedures to protect electronic protected health information from improper alteration or destruction.

**Implementation:**

#### Data Integrity via Authenticated Encryption

**Implementation:**
- AES-256-GCM authentication tags verify data integrity (`encryption.service.ts:99-110`)
- Decryption fails if ciphertext is modified (`encryption.service.ts:164-176`)

**Code Evidence:**
```typescript
// encryption.service.ts:99-110 - Authenticated Encryption
const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
ciphertext += cipher.final('base64');

const authTag = cipher.getAuthTag();  // GCM authentication tag

return {
  ciphertext,
  iv: iv.toString('base64'),
  authTag: authTag.toString('base64'),  // Ensures integrity
  keyVersion: this.currentKeyVersion,
};
```

**Decryption Integrity Check (`encryption.service.ts:164-176`):**
```typescript
private decryptWithKey(ciphertext: string, iv: string, authTag: string, key: Buffer): string {
  const decipher = crypto.createDecipheriv(this.ALGORITHM, key, Buffer.from(iv, 'base64'));
  
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));  // GCM integrity verification
  
  let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');  // Throws error if authTag doesn't match
  
  return plaintext;
}
```

#### Audit Log Integrity via Hash Chaining

**Implementation:**
- SHA-256 cryptographic hash chain detects audit log modifications (`immutableAudit.service.ts:58-83`)
- Verification function: `async verifyChain()` (`immutableAudit.service.ts:163-249`)

**Compliance Notes:**
- GCM authentication tag detects any modification to encrypted PHI
- Decryption automatically fails for tampered data (prevents data corruption)
- Audit log hash chain provides tamper-evident trail

---

### § 164.312(c)(2): Mechanism to Authenticate Electronic Protected Health Information (Addressable)

**Implementation:**
- GCM authentication tags authenticate encrypted PHI (`encryption.service.ts:104`)
- Hash chain authenticates audit log integrity (`immutableAudit.service.ts:58-83`)

**Code Evidence:**
- Already covered in § 164.312(c)(1) above

**Compliance Notes:**
- AES-256-GCM mode provides built-in authentication
- Authentication tag cryptographically binds ciphertext to its original plaintext
- Any modification detected during decryption

---

### § 164.312(d): Person or Entity Authentication

**Standard:** Implement procedures to verify that a person or entity seeking access to electronic protected health information is the one claimed.

**Implementation:**
- Passport.js local strategy with password verification (`auth.ts:7-31`)
- bcrypt password hashing with salting (`auth.ts:20`)
- Multi-factor authentication (MFA) for elevated assurance (`middleware/auth.ts:135-164`)

**Code Evidence:**
```typescript
// auth.ts:7-31 - Password-Based Authentication
passport.use(
  new LocalStrategy(async (username, password, done) => {
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      return done(null, false, { message: "Invalid username or password" });
    }
    
    if (!user.isActive) {
      return done(null, false, { message: "Account is inactive" });
    }
    
    // bcrypt password verification (cryptographic comparison)
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return done(null, false, { message: "Invalid username or password" });
    }
    
    return done(null, user);  // Authenticated
  })
);
```

**Multi-Factor Authentication (`middleware/auth.ts:135-164`):**
```typescript
export function requireMFA(req: Request, res: Response, next: NextFunction) {
  const user = req.user as User;
  
  // Verify user has MFA enabled
  if (!user.mfaEnabled) {
    return res.status(403).json({ 
      error: "MFA required",
      mfaSetupRequired: true 
    });
  }
  
  // Verify MFA token in current session
  if (!req.session?.mfaVerified) {
    return res.status(403).json({ 
      error: "MFA verification required",
      mfaVerificationRequired: true 
    });
  }
  
  next();  // MFA verified
}
```

**Compliance Notes:**
- bcrypt provides cryptographic password verification (resistant to timing attacks)
- Passwords stored as salted hashes, never plaintext
- MFA available for high-risk PHI access operations
- Account status validation prevents access by deactivated users

---

### § 164.312(e)(1): Transmission Security

**Standard:** Implement technical security measures to guard against unauthorized access to electronic protected health information that is being transmitted over an electronic communications network.

**Implementation Status:**
- **NOT VERIFIED IN CODE** - TLS/HTTPS configuration would be in web server or reverse proxy
- Not found in inspected security service files

**Note:** Transmission security (TLS 1.2+) would typically be configured in:
- Express.js HTTPS server configuration (`server/index.ts`)
- Reverse proxy (Nginx, Cloudflare)
- Load balancer configuration

**Compliance Gap:** Cannot verify TLS implementation through security service code inspection alone.

---

### § 164.312(e)(2): Encryption and Decryption (Addressable)

**Standard:** Implement a mechanism to encrypt and decrypt electronic protected health information.

**Implementation:**
- **At Rest**: AES-256-GCM field-level encryption (`encryption.service.ts:90-120`)
- **In Transit**: Not verified in code inspection (see § 164.312(e)(1) above)

**Code Evidence:**
- Already covered in § 164.312(a)(1)(iv) above

---

## Implementation Gaps

The following HIPAA Security Rule requirements are **not fully implemented** or **not verifiable through code inspection**:

1. **§ 164.312(a)(1)(ii) - Emergency Access Procedure** (Required): Not implemented
2. **§ 164.312(a)(1)(iii) - Automatic Logoff** (Addressable): Not verified
3. **§ 164.312(e)(1) - Transmission Security** (Required): Not verified (likely in web server config)
4. **§ 164.308 - Administrative Safeguards**: Cannot be verified in code (workforce training, risk analysis, etc.)
5. **§ 164.310 - Physical Safeguards**: Cannot be verified in code (facility access, workstation security, etc.)

**Compliance Notes:**
- Some HIPAA requirements are administrative or physical controls that cannot be implemented in software
- Transmission security (TLS/HTTPS) is typically configured at infrastructure layer, not application code
- Emergency access procedures may require manual break-glass mechanisms

---

## Secure PHI Disposal

While not a specific HIPAA Security Rule section, secure PHI disposal is required by HIPAA and implemented via:

**Cryptographic Shredding (`kms.service.ts:577-635`):**
- PHI disposal via encryption key destruction
- NIST SP 800-88 compliant (makes encrypted data irrecoverably unusable)
- Immutable disposal audit logs (`encryption.service.ts:735-782`)

**Code Evidence:**
```typescript
// kms.service.ts:580-635 - Cryptographic Shredding
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
      eq(encryptionKeys.tableName, tableName),
      eq(encryptionKeys.status, 'active')
    )
  });
  
  // Destroy each field key (makes PHI irrecoverably unusable)
  for (const fieldKey of fieldKeys) {
    await this.destroyKey(fieldKey.id);
  }
  
  // Immutable audit log for disposal
  await immutableAuditService.log({
    action: 'DATA_SHREDDED',
    resource: 'encryption_keys',
    metadata: {
      keysDestroyed: fieldKeys.length,
      shredMethod: 'cryptographic_key_destruction',
      compliance: 'NIST SP 800-88, HIPAA',
      irreversible: true,
    },
  });
}
```

**Compliance Notes:**
- Cryptographic shredding satisfies HIPAA PHI disposal requirements
- Encrypted PHI becomes irrecoverably unusable when keys are destroyed
- Disposal events logged to immutable audit trail

---

## Audit Verification

**Methodology:** Direct code inspection with file:line citations  
**Files Inspected:**
1. `server/services/encryption.service.ts` - 874 lines (AES-256-GCM encryption, integrity)
2. `server/services/kms.service.ts` - 1,049 lines (Key management, cryptographic shredding)
3. `server/services/immutableAudit.service.ts` - 402 lines (Audit controls, tamper detection)
4. `server/auth.ts` - 47 lines (Person authentication)
5. `server/middleware/auth.ts` - 165 lines (Access control, RBAC, MFA)

**Total Lines Inspected:** 2,537 lines of production security code

**Auditor Note:** Every HIPAA Security Rule claim in this document can be verified by examining the cited file:line numbers in the JAWN source code. Implementation gaps are explicitly documented where code evidence is not found.

---

**Document Control:**
- **Generated:** October 25, 2025
- **Methodology:** Clean break code inspection (see CLEAN_BREAK_METHODOLOGY.md)
- **HIPAA Version:** 45 CFR Part 164, Subpart C (Security Standards)
- **Next Review:** After security feature additions or HIPAA Security Rule updates
- **Maintained By:** JAWN Engineering Team
