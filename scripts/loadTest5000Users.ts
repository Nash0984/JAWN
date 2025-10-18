#!/usr/bin/env tsx
import axios from 'axios';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:5000';
const TARGET_USERS = 5000;
const RAMP_UP_TIME = 60000; // 60 seconds to ramp up
const TEST_DURATION = 180000; // 3 minutes total test

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  peakConcurrentUsers: number;
}

interface RequestMetric {
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  endpoint: string;
  statusCode?: number;
}

class LoadTester {
  private metrics: RequestMetric[] = [];
  private activeUsers = 0;
  private peakUsers = 0;
  private startTime = 0;
  private stopTest = false;

  private endpoints = [
    { path: '/api/programs', weight: 20 },
    { path: '/api/policy-documents', weight: 15 },
    { path: '/api/benefits/snap/eligibility', weight: 15 },
    { path: '/api/benefits/medicaid/eligibility', weight: 10 },
    { path: '/api/benefits/ohep/eligibility', weight: 10 },
    { path: '/api/counties', weight: 10 },
    { path: '/api/glossary', weight: 5 },
    { path: '/api/policy-sources', weight: 5 },
    { path: '/api/faq', weight: 5 },
    { path: '/api/health', weight: 5 }
  ];

  private getRandomEndpoint(): string {
    const random = Math.random() * 100;
    let sum = 0;
    
    for (const endpoint of this.endpoints) {
      sum += endpoint.weight;
      if (random < sum) {
        return endpoint.path;
      }
    }
    
    return this.endpoints[0].path;
  }

  private async simulateUser(userId: number): Promise<void> {
    this.activeUsers++;
    if (this.activeUsers > this.peakUsers) {
      this.peakUsers = this.activeUsers;
    }

    const client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      validateStatus: () => true // Don't throw on any status
    });

    // Simulate user session
    while (!this.stopTest) {
      const endpoint = this.getRandomEndpoint();
      const startTime = performance.now();
      
      try {
        const response = await client.get(endpoint);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.metrics.push({
          startTime,
          endTime,
          duration,
          success: response.status < 400,
          endpoint,
          statusCode: response.status
        });
        
        // Think time between requests (1-3 seconds)
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.metrics.push({
          startTime,
          endTime,
          duration,
          success: false,
          endpoint,
          statusCode: 0
        });
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    this.activeUsers--;
  }

  async run(): Promise<LoadTestResult> {
    console.log('🚀 Starting Load Test');
    console.log(`   Target: ${TARGET_USERS} concurrent users`);
    console.log(`   Ramp-up: ${RAMP_UP_TIME / 1000} seconds`);
    console.log(`   Duration: ${TEST_DURATION / 1000} seconds`);
    console.log('═'.repeat(60));

    this.startTime = performance.now();
    const userPromises: Promise<void>[] = [];
    
    // Ramp up users gradually
    const usersPerInterval = 50;
    const intervalMs = RAMP_UP_TIME / (TARGET_USERS / usersPerInterval);
    
    console.log('\n📈 Ramping up users...');
    
    for (let i = 0; i < TARGET_USERS; i += usersPerInterval) {
      const batch = Math.min(usersPerInterval, TARGET_USERS - i);
      
      for (let j = 0; j < batch; j++) {
        userPromises.push(this.simulateUser(i + j));
      }
      
      console.log(`   Users: ${i + batch}/${TARGET_USERS} (${this.activeUsers} active)`);
      
      if (i + batch < TARGET_USERS) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    console.log('\n⏱️  Running sustained load test...');
    console.log('   Progress:');
    
    // Run for the remaining duration
    const remainingTime = TEST_DURATION - RAMP_UP_TIME;
    const checkInterval = 10000; // Check every 10 seconds
    const checks = Math.floor(remainingTime / checkInterval);
    
    for (let i = 0; i < checks; i++) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      const elapsed = (performance.now() - this.startTime) / 1000;
      const rps = this.metrics.length / elapsed;
      const successRate = this.metrics.filter(m => m.success).length / this.metrics.length * 100;
      
      console.log(`   [${elapsed.toFixed(0)}s] Active: ${this.activeUsers}, RPS: ${rps.toFixed(1)}, Success: ${successRate.toFixed(1)}%`);
    }

    // Stop test
    console.log('\n🛑 Stopping test...');
    this.stopTest = true;
    
    // Wait for users to finish
    await Promise.race([
      Promise.all(userPromises),
      new Promise(resolve => setTimeout(resolve, 15000)) // Max 15s wait
    ]);

    // Calculate results
    return this.calculateResults();
  }

  private calculateResults(): LoadTestResult {
    const testDuration = (performance.now() - this.startTime) / 1000;
    const successfulRequests = this.metrics.filter(m => m.success).length;
    const failedRequests = this.metrics.filter(m => !m.success).length;
    
    // Response times
    const responseTimes = this.metrics.map(m => m.duration).sort((a, b) => a - b);
    const avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
    const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)];
    
    return {
      totalRequests: this.metrics.length,
      successfulRequests,
      failedRequests,
      avgResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      requestsPerSecond: this.metrics.length / testDuration,
      errorRate: (failedRequests / this.metrics.length) * 100,
      peakConcurrentUsers: this.peakUsers
    };
  }

  printResults(results: LoadTestResult): void {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Load Test Results');
    console.log('═'.repeat(60));
    
    console.log('\n📈 Traffic Statistics:');
    console.log(`   Total Requests: ${results.totalRequests.toLocaleString()}`);
    console.log(`   Successful: ${results.successfulRequests.toLocaleString()} (${(100 - results.errorRate).toFixed(1)}%)`);
    console.log(`   Failed: ${results.failedRequests.toLocaleString()} (${results.errorRate.toFixed(1)}%)`);
    console.log(`   Requests/Second: ${results.requestsPerSecond.toFixed(1)}`);
    console.log(`   Peak Concurrent Users: ${results.peakConcurrentUsers}`);
    
    console.log('\n⏱️  Response Times:');
    console.log(`   Average: ${results.avgResponseTime.toFixed(0)}ms`);
    console.log(`   P95: ${results.p95ResponseTime.toFixed(0)}ms`);
    console.log(`   P99: ${results.p99ResponseTime.toFixed(0)}ms`);
    
    console.log('\n🎯 Performance Goals:');
    const goals = [
      { name: 'Handle 5000 users', passed: results.peakConcurrentUsers >= 5000 },
      { name: 'Error rate < 5%', passed: results.errorRate < 5 },
      { name: 'Avg response < 500ms', passed: results.avgResponseTime < 500 },
      { name: 'P95 response < 1000ms', passed: results.p95ResponseTime < 1000 },
      { name: 'P99 response < 2000ms', passed: results.p99ResponseTime < 2000 },
      { name: 'RPS > 500', passed: results.requestsPerSecond > 500 }
    ];
    
    goals.forEach(goal => {
      console.log(`   ${goal.passed ? '✅' : '❌'} ${goal.name}`);
    });
    
    const passedGoals = goals.filter(g => g.passed).length;
    const score = (passedGoals / goals.length * 100).toFixed(0);
    
    console.log('\n' + '═'.repeat(60));
    console.log(`🏆 Performance Score: ${score}% (${passedGoals}/${goals.length} goals met)`);
    
    if (parseInt(score) >= 80) {
      console.log('✅ PASSED: System can handle 5000+ concurrent users!');
    } else {
      console.log('⚠️  NEEDS IMPROVEMENT: System struggles with 5000 users');
      console.log('   Recommendations:');
      if (results.errorRate > 5) {
        console.log('   • Increase connection pool size');
        console.log('   • Add request queuing');
      }
      if (results.avgResponseTime > 500) {
        console.log('   • Optimize database queries');
        console.log('   • Improve cache hit rate');
      }
      if (results.p99ResponseTime > 2000) {
        console.log('   • Add circuit breakers');
        console.log('   • Implement request timeout');
      }
    }
    console.log('═'.repeat(60));
    
    // Save detailed report
    const detailedReport = {
      timestamp: new Date().toISOString(),
      results,
      goals,
      score: parseInt(score),
      recommendations: goals.filter(g => !g.passed).map(g => g.name)
    };
    
    require('fs').writeFileSync(
      'load-test-report.json',
      JSON.stringify(detailedReport, null, 2)
    );
    
    console.log('\n📄 Detailed report saved to: load-test-report.json');
  }
}

// Check if server is running
async function checkServer(): Promise<boolean> {
  try {
    await axios.get(`${BASE_URL}/api/health`, { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔍 Checking server availability...');
  
  if (!await checkServer()) {
    console.error('❌ Server is not running at ' + BASE_URL);
    console.error('   Please start the server first: npm run dev');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  
  const tester = new LoadTester();
  
  try {
    const results = await tester.run();
    tester.printResults(results);
    
    // Exit with appropriate code
    process.exit(results.errorRate < 10 ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Load test failed:', error);
    process.exit(1);
  }
}

// Handle interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted by user');
  process.exit(1);
});

main().catch(console.error);