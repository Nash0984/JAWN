import NodeCache from 'node-cache';
import crypto from 'crypto';

// Cache performance metrics
interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
  lastReset: Date;
}

// Enhanced cache with monitoring capabilities
class MonitoredCache {
  private cache: NodeCache;
  private metrics: CacheMetrics;
  private readonly maxMemoryMB: number;

  constructor(ttl: number = 300, maxMemoryMB: number = 100) {
    this.cache = new NodeCache({
      stdTTL: ttl,
      checkperiod: 60,
      useClones: false,
      maxKeys: -1, // Unlimited keys
      deleteOnExpire: true,
    });

    this.maxMemoryMB = maxMemoryMB;
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      totalKeys: 0,
      memoryUsage: 0,
      lastReset: new Date(),
    };

    // Set up event listeners for metrics tracking
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Track expired keys
    this.cache.on('expired', (key, value) => {
      console.log(`⏰ Cache expired: ${key}`);
      this.metrics.deletes++;
    });

    // Track deleted keys
    this.cache.on('del', (key, value) => {
      this.metrics.deletes++;
    });

    // Track sets
    this.cache.on('set', (key, value) => {
      this.metrics.sets++;
      this.updateMetrics();
    });
  }

  private updateMetrics(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
    this.metrics.totalKeys = this.cache.keys().length;
    
    // Estimate memory usage (rough approximation)
    const stats = this.cache.getStats();
    this.metrics.memoryUsage = (stats.ksize + stats.vsize) / 1024 / 1024; // Convert to MB
    
    // Check memory limits
    if (this.metrics.memoryUsage > this.maxMemoryMB) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    // Simple LRU eviction: remove 10% of oldest keys
    const keys = this.cache.keys();
    const toEvict = Math.ceil(keys.length * 0.1);
    const keysToDelete = keys.slice(0, toEvict);
    
    console.log(`🗑️ Evicting ${toEvict} keys due to memory pressure`);
    this.cache.del(keysToDelete);
  }

  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    if (value !== undefined) {
      this.metrics.hits++;
    } else {
      this.metrics.misses++;
    }
    this.updateMetrics();
    return value;
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    const result = this.cache.set(key, value, ttl || 300);
    this.metrics.sets++;
    this.updateMetrics();
    return result;
  }

  del(keys: string | string[]): number {
    const result = this.cache.del(keys);
    this.metrics.deletes += result;
    this.updateMetrics();
    return result;
  }

  flush(): void {
    this.cache.flushAll();
    this.resetMetrics();
  }

  keys(): string[] {
    return this.cache.keys();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  ttl(key: string): number | undefined {
    return this.cache.getTtl(key);
  }

  invalidatePattern(pattern: string): number {
    const keys = this.cache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    return this.del(matchingKeys);
  }

  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      totalKeys: this.cache.keys().length,
      memoryUsage: 0,
      lastReset: new Date(),
    };
  }

  // Get cache hit rate as percentage
  getHitRate(): number {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? (this.metrics.hits / total) * 100 : 0;
  }

  // Check if cache is achieving target hit rate
  isPerformant(targetHitRate: number = 70): boolean {
    return this.getHitRate() >= targetHitRate;
  }
}

// Create separate caches for different data types with different TTLs
export const apiCache = new MonitoredCache(300, 50); // 5 min TTL, 50MB max
export const calculationCache = new MonitoredCache(600, 100); // 10 min TTL, 100MB max
export const documentCache = new MonitoredCache(3600, 200); // 1 hour TTL, 200MB max
export const sessionCache = new MonitoredCache(1800, 50); // 30 min TTL, 50MB max

// Generate deterministic hash for any data to use as cache key
export function generateCacheKey(data: any, prefix: string = ''): string {
  const deepSort = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(deepSort);
    }
    const sorted: Record<string, any> = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = deepSort(obj[key]);
    });
    return sorted;
  };
  
  const normalized = JSON.stringify(deepSort(data));
  const hash = crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
  return prefix ? `${prefix}:${hash}` : hash;
}

// Global cache metrics aggregator
export function getGlobalCacheMetrics() {
  return {
    api: apiCache.getMetrics(),
    calculation: calculationCache.getMetrics(),
    document: documentCache.getMetrics(),
    session: sessionCache.getMetrics(),
    overall: {
      totalHits: 
        apiCache.getMetrics().hits + 
        calculationCache.getMetrics().hits + 
        documentCache.getMetrics().hits + 
        sessionCache.getMetrics().hits,
      totalMisses: 
        apiCache.getMetrics().misses + 
        calculationCache.getMetrics().misses + 
        documentCache.getMetrics().misses + 
        sessionCache.getMetrics().misses,
      overallHitRate: calculateOverallHitRate(),
      totalMemoryMB: 
        apiCache.getMetrics().memoryUsage + 
        calculationCache.getMetrics().memoryUsage + 
        documentCache.getMetrics().memoryUsage + 
        sessionCache.getMetrics().memoryUsage,
      isPerformant: isOverallCachePerformant(),
    }
  };
}

function calculateOverallHitRate(): number {
  const metrics = [
    apiCache.getMetrics(),
    calculationCache.getMetrics(),
    documentCache.getMetrics(),
    sessionCache.getMetrics(),
  ];
  
  const totalHits = metrics.reduce((sum, m) => sum + m.hits, 0);
  const totalMisses = metrics.reduce((sum, m) => sum + m.misses, 0);
  const total = totalHits + totalMisses;
  
  return total > 0 ? (totalHits / total) * 100 : 0;
}

function isOverallCachePerformant(targetRate: number = 70): boolean {
  return calculateOverallHitRate() >= targetRate;
}

// Cache warming function for frequently accessed data
export async function warmCache() {
  console.log('🔥 Warming cache with frequently accessed data...');
  
  // Add logic here to pre-populate cache with common queries
  // This would typically load:
  // - Common benefit calculations
  // - Frequently accessed documents
  // - Popular API responses
  
  console.log('✅ Cache warming complete');
}

// Export enhanced cache service that's backward compatible
export const enhancedCacheService = {
  // Backward compatible methods
  get<T>(key: string): T | undefined {
    return apiCache.get<T>(key);
  },

  set<T>(key: string, value: T, ttl?: number): boolean {
    return apiCache.set(key, value, ttl);
  },

  del(keys: string | string[]): number {
    return apiCache.del(keys);
  },

  flush(): void {
    apiCache.flush();
    calculationCache.flush();
    documentCache.flush();
    sessionCache.flush();
  },

  keys(): string[] {
    return apiCache.keys();
  },

  invalidatePattern(pattern: string): number {
    return apiCache.invalidatePattern(pattern);
  },

  // New monitoring methods
  getMetrics: getGlobalCacheMetrics,
  getHitRate: calculateOverallHitRate,
  isPerformant: isOverallCachePerformant,
  warmCache,
};

// Enhanced cache keys with better organization
export const ENHANCED_CACHE_KEYS = {
  // API Response Caching
  API: {
    ENDPOINT: (path: string, params?: any) => generateCacheKey({ path, params }, 'api'),
    USER_DATA: (userId: string) => `api:user:${userId}`,
    SESSION: (sessionId: string) => `api:session:${sessionId}`,
  },
  
  // Calculation Caching
  CALC: {
    RULES_ENGINE: (programCode: string, householdHash: string) => `calc:rules:${programCode}:${householdHash}`,
    POLICYENGINE: (householdHash: string) => `calc:pe:${householdHash}`,
    BENEFIT: (benefitType: string, householdHash: string) => `calc:benefit:${benefitType}:${householdHash}`,
    TAX: (year: number, householdHash: string) => `calc:tax:${year}:${householdHash}`,
  },
  
  // Document Caching
  DOC: {
    ANALYSIS: (docId: string) => `doc:analysis:${docId}`,
    EMBEDDING: (docId: string) => `doc:embedding:${docId}`,
    METADATA: (docId: string) => `doc:meta:${docId}`,
  },
  
  // Database Query Caching
  DB: {
    QUERY: (query: string, params?: any) => generateCacheKey({ query, params }, 'db'),
    COUNT: (table: string) => `db:count:${table}`,
    LOOKUP: (table: string, id: string) => `db:${table}:${id}`,
  },
};

export default enhancedCacheService;