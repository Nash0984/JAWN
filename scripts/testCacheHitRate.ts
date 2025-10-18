#!/usr/bin/env tsx
import axios, { AxiosInstance } from 'axios';

// Configuration
const BASE_URL = 'http://localhost:5000';
const ADMIN_USER = 'demo.admin';
const ADMIN_PASS = 'Demo2024!';
const APPLICANT_USER = 'demo.applicant';
const APPLICANT_PASS = 'Demo2024!';

interface CacheMetrics {
  enhanced: {
    overall: {
      totalHits: number;
      totalMisses: number;
      overallHitRate: number;
      totalKeys: number;
      totalMemoryUsage: number;
    };
    targetHitRate: number;
    isAchievingTarget: boolean;
  };
}

class CacheHitRateTester {
  private adminClient: AxiosInstance;
  private applicantClient: AxiosInstance;
  private adminToken: string = '';
  private applicantToken: string = '';

  constructor() {
    this.adminClient = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
    });

    this.applicantClient = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
    });
  }

  async login() {
    try {
      // Login as admin
      const adminResponse = await this.adminClient.post('/api/auth/login', {
        username: ADMIN_USER,
        password: ADMIN_PASS,
      });
      this.adminToken = adminResponse.data.token || '';
      this.adminClient.defaults.headers.common['Authorization'] = `Bearer ${this.adminToken}`;

      // Login as applicant
      const applicantResponse = await this.applicantClient.post('/api/auth/login', {
        username: APPLICANT_USER,
        password: APPLICANT_PASS,
      });
      this.applicantToken = applicantResponse.data.token || '';
      this.applicantClient.defaults.headers.common['Authorization'] = `Bearer ${this.applicantToken}`;

      console.log('✅ Successfully logged in as admin and applicant');
      return true;
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      return false;
    }
  }

  async clearCache() {
    try {
      await this.adminClient.post('/api/admin/cache/clear/all');
      console.log('🧹 Cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error.message);
    }
  }

  async getCacheMetrics(): Promise<CacheMetrics | null> {
    try {
      const response = await this.adminClient.get('/api/admin/cache/stats');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get cache metrics:', error.message);
      return null;
    }
  }

  async simulateCacheableRequests() {
    const endpoints = [
      { url: '/api/policy-documents', client: this.applicantClient, name: 'Policy Documents' },
      { url: '/api/benefits/snap/eligibility', client: this.applicantClient, name: 'SNAP Eligibility' },
      { url: '/api/benefits/medicaid/eligibility', client: this.applicantClient, name: 'Medicaid Eligibility' },
      { url: '/api/benefits/ohep/eligibility', client: this.applicantClient, name: 'OHEP Eligibility' },
      { url: '/api/programs', client: this.applicantClient, name: 'Programs List' },
      { url: '/api/policy-sources', client: this.applicantClient, name: 'Policy Sources' },
    ];

    console.log('\n📊 Simulating cache usage pattern...');
    console.log('─'.repeat(60));

    // Phase 1: Initial requests (all cache misses)
    console.log('\n🔵 Phase 1: Initial requests (expecting cache misses)');
    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        await endpoint.client.get(endpoint.url);
        const duration = Date.now() - start;
        console.log(`  ✓ ${endpoint.name}: ${duration}ms`);
      } catch (error) {
        console.log(`  ✗ ${endpoint.name}: Failed`);
      }
    }

    // Phase 2: Repeat same requests (expecting cache hits)
    console.log('\n🟢 Phase 2: Repeat requests (expecting cache hits)');
    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        await endpoint.client.get(endpoint.url);
        const duration = Date.now() - start;
        console.log(`  ✓ ${endpoint.name}: ${duration}ms ${duration < 50 ? '⚡ (cached)' : ''}`);
      } catch (error) {
        console.log(`  ✗ ${endpoint.name}: Failed`);
      }
    }

    // Phase 3: More repeated requests to improve hit rate
    console.log('\n🟢 Phase 3: Additional requests to improve hit rate');
    for (let i = 0; i < 3; i++) {
      console.log(`  Round ${i + 1}:`);
      for (const endpoint of endpoints) {
        try {
          const start = Date.now();
          await endpoint.client.get(endpoint.url);
          const duration = Date.now() - start;
          if (duration < 50) {
            console.log(`    ✓ ${endpoint.name}: ${duration}ms ⚡`);
          }
        } catch (error) {
          // Silent fail for this phase
        }
      }
    }

    // Phase 4: Mixed pattern (some new queries)
    console.log('\n🔷 Phase 4: Mixed pattern (some cache hits, some misses)');
    const mixedRequests = [
      ...endpoints, // These should hit cache
      { url: '/api/counties', client: this.applicantClient, name: 'Counties (new)' },
      { url: '/api/glossary', client: this.applicantClient, name: 'Glossary (new)' },
    ];

    for (const endpoint of mixedRequests) {
      try {
        const start = Date.now();
        await endpoint.client.get(endpoint.url);
        const duration = Date.now() - start;
        const cached = duration < 50;
        console.log(`  ✓ ${endpoint.name}: ${duration}ms ${cached ? '⚡' : '🔄'}`);
      } catch (error) {
        console.log(`  ✗ ${endpoint.name}: Failed`);
      }
    }
  }

  async runTest() {
    console.log('🚀 Starting Cache Hit Rate Test');
    console.log('═'.repeat(60));

    // Step 1: Login
    if (!await this.login()) {
      console.log('❌ Test aborted: Login failed');
      return;
    }

    // Step 2: Clear cache for clean test
    await this.clearCache();

    // Step 3: Get initial metrics
    const initialMetrics = await this.getCacheMetrics();
    if (initialMetrics) {
      console.log('\n📊 Initial Cache Metrics:');
      console.log(`  Total Keys: ${initialMetrics.enhanced.overall.totalKeys}`);
      console.log(`  Hit Rate: ${initialMetrics.enhanced.overall.overallHitRate.toFixed(2)}%`);
    }

    // Step 4: Simulate cache usage
    await this.simulateCacheableRequests();

    // Step 5: Get final metrics
    console.log('\n' + '═'.repeat(60));
    const finalMetrics = await this.getCacheMetrics();
    if (finalMetrics) {
      const { enhanced } = finalMetrics;
      const { overall } = enhanced;
      
      console.log('📊 Final Cache Metrics:');
      console.log(`  Total Hits: ${overall.totalHits}`);
      console.log(`  Total Misses: ${overall.totalMisses}`);
      console.log(`  Total Keys: ${overall.totalKeys}`);
      console.log(`  Memory Usage: ${(overall.totalMemoryUsage / 1024).toFixed(2)} KB`);
      console.log(`  Hit Rate: ${overall.overallHitRate.toFixed(2)}%`);
      console.log(`  Target Hit Rate: ${enhanced.targetHitRate}%`);
      
      console.log('\n' + '═'.repeat(60));
      if (enhanced.isAchievingTarget) {
        console.log('✅ SUCCESS: Cache hit rate target achieved!');
        console.log(`   Hit rate ${overall.overallHitRate.toFixed(2)}% exceeds target of ${enhanced.targetHitRate}%`);
      } else {
        console.log('⚠️  WARNING: Cache hit rate below target');
        console.log(`   Current: ${overall.overallHitRate.toFixed(2)}%, Target: ${enhanced.targetHitRate}%`);
        console.log(`   Deficit: ${(enhanced.targetHitRate - overall.overallHitRate).toFixed(2)}%`);
      }
    }

    console.log('═'.repeat(60));
    console.log('✅ Test Complete');
  }
}

// Run the test
const tester = new CacheHitRateTester();
tester.runTest().catch(console.error);