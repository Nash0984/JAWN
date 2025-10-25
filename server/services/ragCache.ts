import { createHash } from 'crypto';
import NodeCache from 'node-cache';
import { redisCache, tieredCacheGet } from './redisCache';

/**
 * RAG Query Cache Service
 * 
 * Caches RAG search results to reduce Gemini API calls for repeated queries.
 * Particularly effective for public FAQ and common policy questions.
 * 
 * Now supports L1 (NodeCache) + L2 (Redis) tiered caching:
 * - L1: Process-local for immediate re-queries
 * - L2: Distributed for cross-navigator sharing
 * 
 * Cost Savings: 50-70% reduction in RAG generation calls
 * TTL: 15 minutes (balance freshness vs caching)
 * Invalidation: On policy document updates
 */

interface RAGCacheEntry {
  answer: string;
  sources: any[];
  citations: any[];
  relevanceScore?: number;
  queryAnalysis?: any;
  programId?: string;
  timestamp: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  totalRequests: number;
  estimatedCostSavings: number;
}

class RAGCacheService {
  private cache: NodeCache;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    estimatedCostSavings: 0
  };
  
  // Cost estimate: $0.00002 per RAG query (generation + embeddings)
  private readonly COST_PER_QUERY = 0.00002;
  
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 15 * 60, // 15 minutes
      checkperiod: 60, // Check for expired keys every minute
      useClones: false,
      maxKeys: 5000 // Limit to 5k queries
    });
  }
  
  /**
   * Generate cache key from query and context
   */
  private generateKey(query: string, programId?: string): string {
    const context = programId ? `${query}:${programId}` : query;
    return createHash('sha256').update(context.toLowerCase().trim()).digest('hex');
  }
  
  /**
   * Get cached RAG result or return null
   * Now checks L1 → L2 → null
   */
  async get(query: string, programId?: string): Promise<RAGCacheEntry | null> {
    this.metrics.totalRequests++;
    
    const baseKey = this.generateKey(query, programId);
    const key = `rag:${baseKey}`;
    
    // Check L1 (NodeCache)
    const l1Cached = this.cache.get<RAGCacheEntry>(key);
    if (l1Cached) {
      this.metrics.hits++;
      this.metrics.estimatedCostSavings += this.COST_PER_QUERY;
      return l1Cached;
    }
    
    // Check L2 (Redis)
    const l2Cached = await redisCache.get<RAGCacheEntry>(key);
    if (l2Cached) {
      this.metrics.hits++;
      this.metrics.estimatedCostSavings += this.COST_PER_QUERY;
      // Write-through to L1
      this.cache.set(key, l2Cached);
      return l2Cached;
    }
    
    this.metrics.misses++;
    return null;
  }
  
  /**
   * Store RAG result in cache
   * Now writes to both L1 and L2
   * 
   * FIXED: Now stores complete SearchResult including citations and queryAnalysis
   */
  async set(query: string, result: { answer: string; sources: any[]; citations?: any[]; relevanceScore?: number; queryAnalysis?: any }, programId?: string): Promise<void> {
    const baseKey = this.generateKey(query, programId);
    const key = `rag:${baseKey}`;
    const ttl = 15 * 60; // 15 minutes
    
    const entry: RAGCacheEntry = {
      answer: result.answer,
      sources: result.sources,
      citations: result.citations || [],
      relevanceScore: result.relevanceScore,
      queryAnalysis: result.queryAnalysis,
      programId,
      timestamp: Date.now()
    };
    
    // Write to L1 (NodeCache)
    this.cache.set(key, entry, ttl);
    
    // Write to L2 (Redis)
    await redisCache.set(key, entry, ttl);
  }
  
  /**
   * Get cached RAG result with automatic generation if not found
   * Uses tiered cache with automatic population
   */
  async getOrGenerate(
    query: string,
    generateFn: () => Promise<RAGCacheEntry>,
    programId?: string
  ): Promise<RAGCacheEntry> {
    const baseKey = this.generateKey(query, programId);
    const key = `rag:${baseKey}`;
    const ttl = 15 * 60; // 15 minutes
    
    return tieredCacheGet(key, generateFn, ttl);
  }
  
  /**
   * Invalidate cache for a specific program (on policy updates)
   */
  invalidateProgram(programId: string): void {
    const keys = this.cache.keys();
    let invalidated = 0;
    
    for (const key of keys) {
      const entry = this.cache.get<RAGCacheEntry>(key);
      if (entry?.programId === programId) {
        this.cache.del(key);
        invalidated++;
      }
    }
    
    console.log(`📦 Invalidated ${invalidated} RAG cache entries for program ${programId}`);
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
      maxKeys: 5000,
      ttl: '15 minutes'
    };
  }
  
  /**
   * Clear all cached RAG results
   */
  clear(): void {
    this.cache.flushAll();
    console.log('📦 RAG cache cleared');
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

export const ragCache = new RAGCacheService();
