#!/usr/bin/env tsx
/**
 * Manual script to trigger policy source scraping
 * Usage: tsx scripts/trigger-policy-scraping.ts
 */

import { policySourceScraper } from '../server/services/policySourceScraper.js';
import { storage } from '../server/storage.js';

async function main() {
  console.log('🚀 Starting policy source scraping...\n');
  
  try {
    // Get all Maryland policy sources that need scraping
    const sources = await storage.getPolicySources();
    console.log(`Found ${sources.length} policy sources total\n`);
    
    // Filter for Maryland sources that haven't been synced
    const marylandSources = sources.filter((s: any) => 
      s.isActive && 
      s.jurisdiction === 'maryland' && 
      (!s.lastSyncAt || s.syncStatus === 'idle')
    );
    
    console.log(`Found ${marylandSources.length} Maryland sources that need initial sync:`);
    marylandSources.forEach((s: any) => {
      console.log(`  - ${s.name} (${s.sourceType})`);
    });
    console.log('');
    
    // Scrape each source
    for (const source of marylandSources) {
      try {
        console.log(`\n📥 Scraping: ${source.name}...`);
        const documentCount = await policySourceScraper.scrapeSource(source.id);
        console.log(`✅ Successfully scraped ${documentCount} documents from ${source.name}`);
      } catch (error: any) {
        console.error(`❌ Failed to scrape ${source.name}:`, error.message);
      }
    }
    
    console.log('\n✨ Policy scraping complete!');
  } catch (error: any) {
    console.error('❌ Error during policy scraping:', error);
    process.exit(1);
  }
}

main();
