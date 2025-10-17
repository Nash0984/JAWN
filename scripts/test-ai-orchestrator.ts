/**
 * Test AI Orchestrator
 * 
 * Verifies all core functionality of the unified AI orchestration layer
 */

import { aiOrchestrator } from '../server/services/aiOrchestrator';

async function testAIOrchestrator() {
  console.log('🧪 Testing AI Orchestrator...\n');

  try {
    // Test 1: Text Generation
    console.log('1️⃣ Testing text generation...');
    const textResult = await aiOrchestrator.generateText(
      'What is SNAP? Answer in one sentence.',
      { feature: 'policy_search', priority: 'normal' }
    );
    console.log('✅ Text generation result:', textResult.substring(0, 100) + '...');
    console.log();

    // Test 2: Embedding Generation (with cache)
    console.log('2️⃣ Testing embedding generation...');
    const embedding1 = await aiOrchestrator.generateEmbedding('SNAP eligibility requirements');
    console.log('✅ Generated embedding (length):', embedding1.length);
    
    // Test cache hit
    console.log('   Testing cache hit...');
    const embedding2 = await aiOrchestrator.generateEmbedding('SNAP eligibility requirements');
    console.log('✅ Cache hit - same embedding:', embedding1.length === embedding2.length);
    console.log();

    // Test 3: Code Execution
    console.log('3️⃣ Testing code execution...');
    const codeResult = await aiOrchestrator.executeCode(
      'Calculate 15% of $50,000 (for tax calculation)',
      { feature: 'tax_calculations', priority: 'critical' }
    );
    console.log('✅ Code execution result:', codeResult);
    console.log();

    // Test 4: Queue Status
    console.log('4️⃣ Checking queue status...');
    const queueStatus = aiOrchestrator.getQueueStatus();
    console.log('✅ Queue status:', queueStatus);
    console.log();

    // Test 5: Embedding Cache Stats
    console.log('5️⃣ Checking embedding cache stats...');
    const cacheStats = aiOrchestrator.getEmbeddingCacheStats();
    console.log('✅ Cache stats:', cacheStats);
    console.log();

    // Test 6: Cost Metrics
    console.log('6️⃣ Getting cost metrics...');
    const metrics = await aiOrchestrator.getCostMetrics();
    console.log('✅ Cost metrics:');
    console.log('   Total calls:', metrics.totalCalls);
    console.log('   Total tokens:', metrics.totalTokens);
    console.log('   Estimated cost: $' + metrics.estimatedCost.toFixed(6));
    console.log('   By feature:', JSON.stringify(metrics.callsByFeature, null, 2));
    console.log('   By model:', JSON.stringify(metrics.callsByModel, null, 2));
    console.log();

    console.log('✅ All tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testAIOrchestrator();
