import { ragService } from '../server/services/ragService';

async function testRAGSearch() {
  console.log('🔍 Testing RAG Search...\n');
  
  const testQueries = [
    'What are the income limits for SNAP eligibility in Maryland?',
    'What deductions are allowed for SNAP?',
    'Who is eligible for VITA tax assistance?'
  ];
  
  for (const query of testQueries) {
    console.log(`\nQuery: ${query}`);
    
    try {
      const result = await ragService.search(query);
      
      console.log(`✅ Answer: ${result.answer?.substring(0, 200)}...`);
      console.log(`📚 Sources: ${result.sources?.length || 0}`);
      console.log(`📝 Citations: ${JSON.stringify(result.citations?.slice(0, 2) || [])}`);
      console.log(`🎯 Relevance Score: ${result.relevanceScore}`);
    } catch (error) {
      console.error(`❌ Error:`, error.message);
    }
    
    console.log('\n' + '='.repeat(80));
  }
}

testRAGSearch().catch(console.error);
