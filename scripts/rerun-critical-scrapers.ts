#!/usr/bin/env tsx
/**
 * Re-run the three critical SNAP/COMAR scrapers that were previously stubbed
 * Usage: tsx scripts/rerun-critical-scrapers.ts
 */

import { policySourceScraper } from '../server/services/policySourceScraper.js';
import { storage } from '../server/storage.js';

async function main() {
  console.log('🚀 Re-running critical Maryland SNAP/COMAR scrapers...\n');
  
  try {
    // Get all policy sources
    const sources = await storage.getPolicySources();
    
    // Find the three critical sources
    const criticalSourceNames = [
      'Maryland SNAP Policy Manual',
      'COMAR Title 10 - Maryland SNAP Regulations',
      'COMAR 10.09.24 - Medicaid Eligibility Regulations'
    ];
    
    const criticalSources = sources.filter((s: any) => 
      criticalSourceNames.includes(s.name)
    );
    
    if (criticalSources.length === 0) {
      console.log('⚠️ No critical sources found');
      return;
    }
    
    console.log(`Found ${criticalSources.length} critical sources to re-scrape:`);
    criticalSources.forEach((s: any) => {
      console.log(`  - ${s.name}`);
    });
    console.log('');
    
    // Reset sync status for these sources
    for (const source of criticalSources) {
      await storage.updatePolicySource(source.id, {
        syncStatus: 'idle',
        lastSyncAt: null
      });
    }
    
    // Scrape each source
    for (const source of criticalSources) {
      try {
        console.log(`\n📥 Scraping: ${source.name}...`);
        const documentCount = await policySourceScraper.scrapeSource(source.id);
        console.log(`✅ Successfully scraped ${documentCount} documents from ${source.name}`);
      } catch (error: any) {
        console.error(`❌ Failed to scrape ${source.name}:`, error.message);
      }
    }
    
    console.log('\n✨ Critical scraper re-run complete!');
  } catch (error: any) {
    console.error('❌ Error during scraping:', error);
    process.exit(1);
  }
}

main();
