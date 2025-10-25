# Encryption Key Management

## Current Setup
- Algorithm: AES-256-GCM
- Key Length: 256 bits (32 bytes, 64 hex characters)
- Encrypted Fields: SSNs, bank account numbers, tax data
- Key Rotation: Supported via ENCRYPTION_KEY_PREVIOUS

## Setting Production Key

### First-Time Setup
1. Generate key: `npx tsx scripts/generate-encryption-key.ts`
2. Copy the generated 64-character hex string
3. In Replit Dashboard: Tools → Secrets
4. Add new secret:
   - Name: `ENCRYPTION_KEY`
   - Value: <paste generated key>
5. Restart application

### Key Rotation (Zero-Downtime)
1. Generate new key: `npx tsx scripts/generate-encryption-key.ts`
2. Set ENCRYPTION_KEY_PREVIOUS = current ENCRYPTION_KEY
3. Set ENCRYPTION_KEY = new key
4. Restart application
5. Service auto-decrypts old data with previous key
6. Service encrypts new data with new key
7. After migration complete (monitor logs), remove ENCRYPTION_KEY_PREVIOUS

## Verification
Test encryption works:
```
npx tsx scripts/test-encryption.ts
```

## Security Best Practices
- Rotate keys every 90 days
- Never log encrypted or decrypted values
- Store backup keys in secure vault (1Password, AWS Secrets Manager)
- Use different keys for dev/staging/production
- Monitor encryption service logs for errors
