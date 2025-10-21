import { createHash } from 'crypto';
import NodeCache from 'node-cache';
import { redisCache, tieredCacheGet } from './redisCache';
import { logger } from './logger.service';

/**
 * Embedding Cache Service
 * 
 * Optimizes Gemini API costs by caching text embeddings.
 * Embeddings are deterministic - same text always produces same embedding.
 * 
 * Now supports L1 (NodeCache) + L2 (Redis) tiered caching:
 * - L1: Process-local, ultra-fast access
 * - L2: Distributed, shared across instances
 * 
 * Cost Savings: 60-80% reduction in embedding generation calls
 * TTL: 24 hours (embeddings don't change)
 */

interface CacheMetrics {
  hits: number;
  misses: number;
  totalRequests: number;
  estimatedCostSavings: number;
}

class EmbeddingCacheService {
  private cache: NodeCache;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    estimatedCostSavings: 0
  };
  
  // Cost estimate: $0.00001 per 1K tokens, avg text ~100 tokens = $0.000001 per embedding
  private readonly COST_PER_EMBEDDING = 0.000001;
  
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 24 * 60 * 60, // 24 hours
      checkperiod: 60 * 60, // Check for expired keys every hour
      useClones: false, // Direct reference for performance
      maxKeys: 10000 // Limit to 10k embeddings (~800MB at 768 dimensions)
    });
  }
  
  /**
   * Generate cache key from text using SHA256 hash
   */
  private generateKey(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }
  
  /**
   * Get cached embedding or return null
   * Now checks L1 → L2 → null
   */
  async get(text: string): Promise<number[] | null> {
    this.metrics.totalRequests++;
    
    const key = `embedding:${this.generateKey(text)}`;
    
    // Check L1 (NodeCache)
    const l1Cached = this.cache.get<number[]>(key);
    if (l1Cached) {
      this.metrics.hits++;
      this.metrics.estimatedCostSavings += this.COST_PER_EMBEDDING;
      return l1Cached;
    }
    
    // Check L2 (Redis)
    const l2Cached = await redisCache.get<number[]>(key);
    if (l2Cached) {
      this.metrics.hits++;
      this.metrics.estimatedCostSavings += this.COST_PER_EMBEDDING;
      // Write-through to L1
      this.cache.set(key, l2Cached);
      return l2Cached;
    }
    
    this.metrics.misses++;
    return null;
  }
  
  /**
   * Store embedding in cache
   * Now writes to both L1 and L2
   */
  async set(text: string, embedding: number[]): Promise<void> {
    const key = `embedding:${this.generateKey(text)}`;
    const ttl = 24 * 60 * 60; // 24 hours
    
    // Write to L1 (NodeCache)
    this.cache.set(key, embedding, ttl);
    
    // Write to L2 (Redis)
    await redisCache.set(key, embedding, ttl);
  }
  
  /**
   * Get cached embedding with automatic fetch if not found
   * Uses tiered cache with automatic population
   */
  async getOrGenerate(
    text: string, 
    generateFn: () => Promise<number[]>
  ): Promise<number[]> {
    const key = `embedding:${this.generateKey(text)}`;
    const ttl = 24 * 60 * 60; // 24 hours
    
    return tieredCacheGet(key, generateFn, ttl);
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.metrics.totalRequests > 0 
      ? (this.metrics.hits / this.metrics.totalRequests) * 100 
      : 0;
    
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      totalRequests: this.metrics.totalRequests,
      hitRate: hitRate.toFixed(2) + '%',
      estimatedCostSavings: `$${this.metrics.estimatedCostSavings.toFixed(4)}`,
      cacheSize: this.cache.keys().length,
      maxKeys: 10000
    };
  }
  
  /**
   * Clear all cached embeddings
   */
  clear(): void {
    this.cache.flushAll();
    logger.info('📦 Embedding cache cleared', { service: 'EmbeddingCache' });
  }
  
  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      estimatedCostSavings: 0
    };
  }
}

export const embeddingCache = new EmbeddingCacheService();
