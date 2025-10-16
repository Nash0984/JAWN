import crypto from 'crypto';

console.log('🔐 Generating Production Encryption Key...\n');

// Generate 32 random bytes (256 bits)
const key = crypto.randomBytes(32);
const keyHex = key.toString('hex');

console.log('✅ ENCRYPTION_KEY Generated:');
console.log(keyHex);
console.log('\n📋 Key Details:');
console.log(`  Length: ${keyHex.length} characters (32 bytes)`);
console.log(`  Algorithm: AES-256-GCM`);
console.log(`  Format: Hexadecimal`);

console.log('\n🔒 SECURITY INSTRUCTIONS:');
console.log('1. Copy the key above');
console.log('2. In Replit: Secrets tab → Add Secret');
console.log('   Name: ENCRYPTION_KEY');
console.log('   Value: <paste key>');
console.log('3. NEVER commit this key to git');
console.log('4. Store backup in secure password manager');
console.log('5. Restart application after setting secret');
