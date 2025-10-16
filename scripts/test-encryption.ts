import { encryptionService } from '../server/services/encryption.service';

// Set development mode for testing (uses dev-only key if ENCRYPTION_KEY not set)
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

console.log('🔐 Testing Encryption Service...\n');

if (!process.env.ENCRYPTION_KEY) {
  console.log('⚠️  Using development-only key (ENCRYPTION_KEY not set)');
  console.log('   For production testing, set ENCRYPTION_KEY first\n');
}

// Test SSN encryption
const testSSN = '123-45-6789';
console.log('Test SSN:', testSSN);

const encrypted = encryptionService.encryptSSN(testSSN);
console.log('✅ Encrypted:', JSON.stringify(encrypted, null, 2));

const decrypted = encryptionService.decryptSSN(encrypted);
console.log('✅ Decrypted:', decrypted);

console.log('\n✅ Encryption service working correctly!');
