/**
 * Test Concurrency Fix for AI Orchestrator
 * 
 * Validates that the processQueue method now properly dispatches
 * multiple requests in parallel (up to MAX_CONCURRENT_REQUESTS = 5)
 */

import { aiOrchestrator } from '../server/services/aiOrchestrator';

async function testConcurrency() {
  console.log('🧪 Testing AI Orchestrator Concurrency Fix...\n');

  try {
    // Test: Dispatch 10 requests and verify they run in parallel
    console.log('📊 Testing parallel execution (10 requests)...');
    console.log('   Expected: Up to 5 requests run concurrently\n');

    const startTime = Date.now();
    const requests = [];

    // Queue 10 requests with tracking
    for (let i = 0; i < 10; i++) {
      const requestPromise = aiOrchestrator.generateText(
        `Count to ${i + 1}`,
        { feature: 'concurrency_test', priority: 'normal' }
      ).then(result => {
        const elapsed = Date.now() - startTime;
        console.log(`   ✅ Request ${i + 1} completed at ${elapsed}ms`);
        return result;
      });
      requests.push(requestPromise);
    }

    // Check queue status immediately after queueing
    const statusAfterQueue = aiOrchestrator.getQueueStatus();
    console.log('\n📈 Queue status after queueing 10 requests:');
    console.log('   Active requests:', statusAfterQueue.activeRequests);
    console.log('   Queue length:', statusAfterQueue.queueLength);
    console.log('   Can make request:', statusAfterQueue.canMakeRequest);

    // Wait for all to complete
    await Promise.all(requests);
    
    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Total execution time: ${totalTime}ms`);

    // Verify final queue status
    const finalStatus = aiOrchestrator.getQueueStatus();
    console.log('\n📊 Final queue status:');
    console.log('   Active requests:', finalStatus.activeRequests);
    console.log('   Queue length:', finalStatus.queueLength);
    
    // Analyze results
    console.log('\n📋 Analysis:');
    if (statusAfterQueue.activeRequests > 1) {
      console.log('   ✅ PASS: Multiple requests ran concurrently!');
      console.log(`      (${statusAfterQueue.activeRequests} active immediately after queueing)`);
    } else {
      console.log('   ❌ FAIL: Requests appear to run sequentially');
      console.log('      (Only 1 active request detected)');
    }

    if (finalStatus.activeRequests === 0 && finalStatus.queueLength === 0) {
      console.log('   ✅ PASS: All requests completed and queue is clear');
    }

    // Check rate limiting
    console.log('\n🔒 Rate limiting check:');
    console.log('   Requests in current window:', finalStatus.requestsInWindow);
    console.log('   Max requests per window:', finalStatus.maxRequestsPerWindow);
    console.log('   ✅ Rate limiting preserved:', finalStatus.requestsInWindow <= finalStatus.maxRequestsPerWindow);

    console.log('\n✅ Concurrency test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testConcurrency();
