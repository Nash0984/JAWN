import { policySourceScraper } from './server/services/policySourceScraper';
import { storage } from './server/storage';

async function testVITAScraping() {
  console.log('🧪 Testing VITA PDF Scraping with 2025+ Filter\n');

  try {
    // Get all VITA policy sources
    const allSources = await storage.getPolicySources();
    const vitaSources = allSources.filter(s => 
      s.name?.includes('IRS') || s.name?.includes('VITA')
    );

    if (vitaSources.length === 0) {
      console.error('❌ No VITA sources found');
      process.exit(1);
    }

    console.log(`Found ${vitaSources.length} VITA sources:\n`);
    vitaSources.forEach((s, i) => {
      console.log(`${i + 1}. ${s.name}`);
      console.log(`   URL: ${s.url}`);
      console.log(`   Scrape Type: ${(s.syncConfig as any)?.scrapeType}`);
      console.log(`   Min Revision Year: ${(s.syncConfig as any)?.minRevisionYear || 'N/A'}`);
      console.log(`   Tax Year: ${(s.syncConfig as any)?.taxYear || 'N/A'}`);
      console.log('');
    });

    // Test scraping the first VITA source (Pub 4012)
    const testSource = vitaSources[0];
    console.log(`\n🎯 Testing scrape for: ${testSource.name}`);
    console.log(`   This will download the PDF, extract revision info, and apply 2025+ filter\n`);

    const documentCount = await policySourceScraper.scrapeSource(testSource.id);
    
    console.log(`\n✅ Scrape completed successfully!`);
    console.log(`   Documents scraped: ${documentCount}`);
    
    if (documentCount === 0) {
      console.log(`   ⚠️  No documents were scraped - this could mean:`);
      console.log(`      - PDF revision year < 2025 (filtered out)`);
      console.log(`      - Could not extract revision year from PDF`);
      console.log(`      - PDF download failed`);
    } else {
      console.log(`   ✓ Document passed 2025+ filter and was ingested`);
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

testVITAScraping();
