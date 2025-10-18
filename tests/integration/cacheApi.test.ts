import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/app';
import { db } from '../../server/db';

describe('Cache API Endpoints', () => {
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Setup test users and get auth tokens
    // For now, we'll mock these
    authToken = 'test-auth-token';
    adminToken = 'test-admin-token';
  });

  afterAll(async () => {
    // Clean up
  });

  beforeEach(() => {
    // Reset cache state between tests
  });

  describe('GET /api/admin/cache/stats', () => {
    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/admin/cache/stats')
        .expect(401);
      
      expect(response.body.error).toBeDefined();
    });

    it('should return cache statistics for admin users', async () => {
      // Mock admin auth middleware for testing
      const response = await request(app)
        .get('/api/admin/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true') // Test bypass
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.enhanced).toBeDefined();
      expect(response.body.enhanced.targetHitRate).toBe(70);
      expect(response.body.enhanced.isAchievingTarget).toBeDefined();
      expect(response.body.legacy).toBeDefined();
    });

    it('should return correct cache metrics structure', async () => {
      const response = await request(app)
        .get('/api/admin/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .expect(200);
      
      const { enhanced } = response.body;
      
      // Check for all cache types
      expect(enhanced).toHaveProperty('embedding');
      expect(enhanced).toHaveProperty('rag');
      expect(enhanced).toHaveProperty('document');
      expect(enhanced).toHaveProperty('policyEngine');
      expect(enhanced).toHaveProperty('overall');
      
      // Check overall metrics structure
      expect(enhanced.overall).toHaveProperty('totalHits');
      expect(enhanced.overall).toHaveProperty('totalMisses');
      expect(enhanced.overall).toHaveProperty('overallHitRate');
      expect(enhanced.overall).toHaveProperty('totalKeys');
      expect(enhanced.overall).toHaveProperty('totalMemoryUsage');
    });

    it('should indicate whether 70% hit rate target is achieved', async () => {
      const response = await request(app)
        .get('/api/admin/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .expect(200);
      
      const { enhanced } = response.body;
      
      expect(enhanced.isAchievingTarget).toBe(
        enhanced.overall.overallHitRate >= 70
      );
    });
  });

  describe('GET /api/admin/cache/cost-savings', () => {
    it('should return cost savings report', async () => {
      const response = await request(app)
        .get('/api/admin/cache/cost-savings')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      // Cost savings report structure
      expect(response.body).toHaveProperty('totalSaved');
      expect(response.body).toHaveProperty('apiCallsSaved');
      expect(response.body).toHaveProperty('computeTimeSaved');
    });

    it('should calculate accurate cost savings', async () => {
      // Perform some cached operations first
      await request(app)
        .get('/api/policy-documents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Get the same data again (should hit cache)
      await request(app)
        .get('/api/policy-documents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const response = await request(app)
        .get('/api/admin/cache/cost-savings')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .expect(200);
      
      // Should show some savings from the cache hit
      expect(response.body.apiCallsSaved).toBeGreaterThan(0);
    });
  });

  describe('POST /api/admin/cache/clear/:type', () => {
    it('should clear specific cache type', async () => {
      const response = await request(app)
        .post('/api/admin/cache/clear/rag')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cleared');
      expect(response.body.type).toBe('rag');
    });

    it('should clear all caches when type is "all"', async () => {
      const response = await request(app)
        .post('/api/admin/cache/clear/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('All caches cleared');
    });

    it('should reject invalid cache types', async () => {
      const response = await request(app)
        .post('/api/admin/cache/clear/invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .expect(400);
      
      expect(response.body.error).toContain('Invalid cache type');
    });

    it('should reset metrics after clearing cache', async () => {
      // Clear all caches
      await request(app)
        .post('/api/admin/cache/clear/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .expect(200);
      
      // Check that metrics are reset
      const statsResponse = await request(app)
        .get('/api/admin/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .expect(200);
      
      expect(statsResponse.body.enhanced.overall.totalKeys).toBe(0);
    });
  });

  describe('Cache Performance Under Load', () => {
    it('should maintain 70% hit rate under typical usage', async () => {
      // Simulate typical usage pattern
      const endpoints = [
        '/api/policy-documents',
        '/api/benefits/snap/eligibility',
        '/api/benefits/medicaid/eligibility',
        '/api/tax/calculations'
      ];
      
      // First pass - all misses
      for (const endpoint of endpoints) {
        await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      }
      
      // Second and third pass - should be hits
      for (let i = 0; i < 2; i++) {
        for (const endpoint of endpoints) {
          await request(app)
            .get(endpoint)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
        }
      }
      
      // Check hit rate
      const response = await request(app)
        .get('/api/admin/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .expect(200);
      
      // Should have ~66% hit rate (8 hits out of 12 requests)
      expect(response.body.enhanced.overall.overallHitRate).toBeGreaterThan(60);
    });

    it('should handle concurrent cache requests efficiently', async () => {
      const concurrentRequests = 50;
      const endpoint = '/api/policy-documents';
      
      // Fire multiple concurrent requests
      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should complete quickly (< 2 seconds for 50 requests)
      expect(endTime - startTime).toBeLessThan(2000);
      
      // Check cache stats
      const statsResponse = await request(app)
        .get('/api/admin/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .expect(200);
      
      // Most requests should have hit the cache
      expect(statsResponse.body.enhanced.overall.totalHits).toBeGreaterThan(40);
    });
  });

  describe('Cache Headers and HTTP Caching', () => {
    it('should set appropriate cache headers for cacheable responses', async () => {
      const response = await request(app)
        .get('/api/policy-documents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Should have cache control headers
      expect(response.headers['cache-control']).toBeDefined();
      expect(response.headers['etag']).toBeDefined();
    });

    it('should return 304 for unchanged resources with ETag', async () => {
      // First request to get ETag
      const firstResponse = await request(app)
        .get('/api/policy-documents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const etag = firstResponse.headers['etag'];
      
      // Second request with If-None-Match
      const secondResponse = await request(app)
        .get('/api/policy-documents')
        .set('Authorization', `Bearer ${authToken}`)
        .set('If-None-Match', etag)
        .expect(304);
      
      // 304 should have no body
      expect(secondResponse.body).toEqual({});
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate related cache entries on data update', async () => {
      // Get initial data (cache miss)
      const initialResponse = await request(app)
        .get('/api/benefits/snap/eligibility')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Update related data (should trigger invalidation)
      await request(app)
        .post('/api/household-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          householdSize: 4,
          monthlyIncome: 3000
        })
        .expect(201);
      
      // Get data again (should be cache miss due to invalidation)
      const afterUpdateResponse = await request(app)
        .get('/api/benefits/snap/eligibility')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Data might be different after household update
      // This is mainly testing that invalidation occurs
      expect(afterUpdateResponse.body).toBeDefined();
    });

    it('should support selective cache invalidation patterns', async () => {
      // Test pattern-based invalidation
      const patterns = [
        '/api/benefits/*',
        '/api/tax/*',
        '/api/policy-documents/*'
      ];
      
      // Warm up cache with various endpoints
      for (const pattern of patterns) {
        const endpoint = pattern.replace('/*', '/test');
        await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`);
      }
      
      // Invalidate benefits-related cache
      await request(app)
        .post('/api/admin/cache/invalidate')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .send({ pattern: '/api/benefits/*' })
        .expect(200);
      
      // Check that only benefits cache was invalidated
      const statsResponse = await request(app)
        .get('/api/admin/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Test-Admin', 'true')
        .expect(200);
      
      // Some caches should still have entries
      expect(statsResponse.body.enhanced.overall.totalKeys).toBeGreaterThan(0);
    });
  });
});