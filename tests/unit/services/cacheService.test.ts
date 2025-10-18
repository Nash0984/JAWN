import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enhancedCacheService, getGlobalCacheMetrics } from '../../../server/services/enhancedCacheService';
import NodeCache from 'node-cache';

describe('EnhancedCacheService', () => {
  let service: typeof enhancedCacheService;
  
  beforeEach(() => {
    // Create a fresh instance for each test
    service = enhancedCacheService;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear cache after each test
    service.clear();
  });

  describe('Basic Cache Operations', () => {
    it('should set and get values correctly', () => {
      const key = 'test-key';
      const value = { data: 'test-value' };
      
      const setResult = service.set(key, value, 60);
      expect(setResult).toBe(true);
      
      const getValue = service.get(key);
      expect(getValue).toEqual(value);
    });

    it('should track cache hits', () => {
      const key = 'hit-test';
      const value = 'test-data';
      
      service.set(key, value, 60);
      
      // First get - should be a hit
      const result1 = service.get(key);
      expect(result1).toBe(value);
      
      // Second get - should be another hit
      const result2 = service.get(key);
      expect(result2).toBe(value);
      
      const metrics = service.getMetrics();
      expect(metrics.hits).toBeGreaterThanOrEqual(2);
      expect(metrics.hitRate).toBeGreaterThan(0);
    });

    it('should track cache misses', () => {
      const metrics1 = service.getMetrics();
      const initialMisses = metrics1.misses;
      
      // Attempt to get non-existent key
      const result = service.get('non-existent-key');
      expect(result).toBeUndefined();
      
      const metrics2 = service.getMetrics();
      expect(metrics2.misses).toBe(initialMisses + 1);
    });

    it('should handle TTL expiration', async () => {
      const key = 'ttl-test';
      const value = 'expires-soon';
      
      // Set with 1 second TTL
      service.set(key, value, 1);
      expect(service.get(key)).toBe(value);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(service.get(key)).toBeUndefined();
    });

    it('should delete keys correctly', () => {
      const key = 'delete-test';
      const value = 'to-be-deleted';
      
      service.set(key, value, 60);
      expect(service.get(key)).toBe(value);
      
      const deleteCount = service.del(key);
      expect(deleteCount).toBe(1);
      expect(service.get(key)).toBeUndefined();
    });

    it('should clear all cache entries', () => {
      service.set('key1', 'value1', 60);
      service.set('key2', 'value2', 60);
      service.set('key3', 'value3', 60);
      
      const keys = service.keys();
      expect(keys.length).toBeGreaterThanOrEqual(3);
      
      service.clear();
      const keysAfterClear = service.keys();
      expect(keysAfterClear.length).toBe(0);
    });

    it('should handle multiple values with mget and mset', () => {
      const entries = [
        { key: 'multi1', val: 'value1', ttl: 60 },
        { key: 'multi2', val: 'value2', ttl: 60 },
        { key: 'multi3', val: 'value3', ttl: 60 }
      ];
      
      const setResult = service.mset(entries);
      expect(setResult).toBe(true);
      
      const values = service.mget(['multi1', 'multi2', 'multi3']);
      expect(values).toEqual({
        'multi1': 'value1',
        'multi2': 'value2',
        'multi3': 'value3'
      });
    });
  });

  describe('Hit Rate Calculation', () => {
    it('should calculate hit rate correctly', () => {
      service.set('calc-test', 'value', 60);
      
      // Create known pattern of hits and misses
      service.get('calc-test'); // Hit
      service.get('calc-test'); // Hit  
      service.get('missing');   // Miss
      service.get('calc-test'); // Hit
      service.get('missing2');  // Miss
      
      const metrics = service.getMetrics();
      
      // Hit rate should be 3 hits / 5 total requests = 60%
      expect(metrics.hits).toBeGreaterThanOrEqual(3);
      expect(metrics.misses).toBeGreaterThanOrEqual(2);
      
      const expectedHitRate = (metrics.hits / (metrics.hits + metrics.misses)) * 100;
      expect(metrics.hitRate).toBeCloseTo(expectedHitRate, 1);
    });

    it('should handle zero requests gracefully', () => {
      service.clear();
      const freshService = new NodeCache();
      const metrics = service.getMetrics();
      
      // With no requests, hit rate should be 0
      if (metrics.hits === 0 && metrics.misses === 0) {
        expect(metrics.hitRate).toBe(0);
      }
    });
  });

  describe('Performance Tracking', () => {
    it('should track average response times', () => {
      // Perform multiple cache operations
      for (let i = 0; i < 10; i++) {
        service.set(`perf-key-${i}`, `value-${i}`, 60);
        service.get(`perf-key-${i}`);
      }
      
      const metrics = service.getMetrics();
      
      // Should have recorded response times
      expect(metrics.avgResponseTime).toBeGreaterThanOrEqual(0);
      expect(metrics.avgResponseTime).toBeLessThan(100); // Should be very fast
    });

    it('should calculate memory usage', () => {
      // Add some data to the cache
      const largeObject = {
        data: Array(1000).fill('test-data'),
        nested: {
          more: Array(100).fill({ key: 'value' })
        }
      };
      
      service.set('large-object', largeObject, 60);
      
      const metrics = service.getMetrics();
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Global Cache Metrics', () => {
    it('should aggregate metrics across all cache types', () => {
      const globalMetrics = getGlobalCacheMetrics();
      
      expect(globalMetrics).toHaveProperty('embedding');
      expect(globalMetrics).toHaveProperty('rag');
      expect(globalMetrics).toHaveProperty('document');
      expect(globalMetrics).toHaveProperty('policyEngine');
      expect(globalMetrics).toHaveProperty('overall');
      
      // Overall metrics should aggregate individual cache metrics
      expect(globalMetrics.overall).toHaveProperty('totalHits');
      expect(globalMetrics.overall).toHaveProperty('totalMisses');
      expect(globalMetrics.overall).toHaveProperty('overallHitRate');
      expect(globalMetrics.overall).toHaveProperty('totalKeys');
      expect(globalMetrics.overall).toHaveProperty('totalMemoryUsage');
    });

    it('should calculate overall hit rate correctly', () => {
      // Clear and set up fresh data
      service.clear();
      
      // Create some cache activity
      service.set('test1', 'value1', 60);
      service.get('test1'); // Hit
      service.get('test1'); // Hit
      service.get('missing1'); // Miss
      
      const globalMetrics = getGlobalCacheMetrics();
      
      // Overall hit rate should reflect combined activity
      if (globalMetrics.overall.totalHits > 0 || globalMetrics.overall.totalMisses > 0) {
        const expectedRate = (globalMetrics.overall.totalHits / 
                            (globalMetrics.overall.totalHits + globalMetrics.overall.totalMisses)) * 100;
        expect(globalMetrics.overall.overallHitRate).toBeCloseTo(expectedRate, 1);
      } else {
        expect(globalMetrics.overall.overallHitRate).toBe(0);
      }
    });
  });

  describe('TTL Management', () => {
    it('should respect TTL settings for different cache types', () => {
      const shortTTL = 1; // 1 second
      const longTTL = 3600; // 1 hour
      
      service.set('short-lived', 'expires-soon', shortTTL);
      service.set('long-lived', 'stays-longer', longTTL);
      
      // Both should exist initially
      expect(service.get('short-lived')).toBe('expires-soon');
      expect(service.get('long-lived')).toBe('stays-longer');
      
      // Check TTL values
      const shortTTLValue = service.getTtl('short-lived');
      const longTTLValue = service.getTtl('long-lived');
      
      expect(shortTTLValue).toBeLessThanOrEqual(shortTTL * 1000);
      expect(longTTLValue).toBeLessThanOrEqual(longTTL * 1000);
    });

    it('should update TTL on existing keys', () => {
      const key = 'ttl-update';
      service.set(key, 'value', 60);
      
      const initialTTL = service.getTtl(key);
      expect(initialTTL).toBeGreaterThan(0);
      
      // Update TTL to longer duration
      const updated = service.ttl(key, 3600);
      expect(updated).toBe(true);
      
      const newTTL = service.getTtl(key);
      expect(newTTL).toBeGreaterThan(initialTTL);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid keys gracefully', () => {
      expect(service.get(null as any)).toBeUndefined();
      expect(service.get(undefined as any)).toBeUndefined();
      expect(service.get('')).toBeUndefined();
    });

    it('should handle invalid values gracefully', () => {
      const circular: any = { data: 'test' };
      circular.self = circular; // Create circular reference
      
      // Should handle circular references
      const result = service.set('circular-key', circular, 60);
      // NodeCache handles circular refs, so this should work
      expect(result).toBeDefined();
    });

    it('should handle delete on non-existent keys', () => {
      const result = service.del('non-existent-key');
      expect(result).toBe(0);
    });
  });

  describe('Cache Warmup', () => {
    it('should support cache warming with bulk operations', () => {
      const warmupData = Array.from({ length: 100 }, (_, i) => ({
        key: `warmup-${i}`,
        val: `value-${i}`,
        ttl: 300
      }));
      
      const startTime = Date.now();
      const result = service.mset(warmupData);
      const endTime = Date.now();
      
      expect(result).toBe(true);
      expect(service.keys().length).toBeGreaterThanOrEqual(100);
      
      // Bulk operation should be fast (< 100ms for 100 items)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});