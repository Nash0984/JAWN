#!/usr/bin/env tsx
/**
 * Standalone script to seed IRS consent form
 * Run with: tsx scripts/seed-irs-consent.ts
 */

import { seedIRSConsentForm } from '../server/seeds/irsConsentForm';

async function main() {
  console.log('🏛️  Seeding IRS Use & Disclosure Consent Form...\n');
  
  try {
    await seedIRSConsentForm();
    console.log('\n✅ IRS consent form seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to seed IRS consent form:', error);
    process.exit(1);
  }
}

main();
