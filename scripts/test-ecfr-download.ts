#!/usr/bin/env tsx

/**
 * Test script for eCFR Bulk Downloader
 * Tests XML parsing and section extraction
 */

import { ecfrBulkDownloader } from './server/services/ecfrBulkDownloader';

async function testECFRDownload() {
  console.log('🧪 Testing eCFR Bulk Downloader...\n');
  
  try {
    const result = await ecfrBulkDownloader.downloadSNAPRegulations();
    
    console.log('\n📊 Test Results:');
    console.log('  Success:', result.success);
    console.log('  Sections Processed:', result.sectionsProcessed);
    console.log('  Documents Created:', result.documentIds.length);
    
    if (result.error) {
      console.log('  Error:', result.error);
    }
    
    if (result.sectionsProcessed === 0) {
      console.log('\n❌ TEST FAILED: No sections extracted');
      process.exit(1);
    } else if (result.sectionsProcessed < 20) {
      console.log('\n⚠️  WARNING: Expected 25-35 sections, got', result.sectionsProcessed);
    } else {
      console.log('\n✅ TEST PASSED: Successfully extracted', result.sectionsProcessed, 'sections from Part 273');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

testECFRDownload();
