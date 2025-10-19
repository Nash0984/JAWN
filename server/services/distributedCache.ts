import Redis from 'ioredis';
import { createHash } from 'crypto';

// Configuration from environment
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  enableReadyCheck: true,
  lazyConnect: true,
};

// Cache configuration
const CACHE_PREFIXES = {
  policy: 'policy:',
  benefits: 'benefits:',
  eligibility: 'elig:',
  documents: 'docs:',
  embeddings: 'embed:',
  rag: 'rag:',
  analysis: 'analysis:',
  policyEngine: 'pe:',
  session: 'sess:',
  rateLimit: 'rl:',
} as const;

const TTL_SECONDS = {
  policy: 3600,        // 1 hour
  benefits: 1800,      // 30 minutes
  eligibility: 900,    // 15 minutes
  documents: 3600,     // 1 hour
  embeddings: 300,     // 5 minutes
  rag: 600,           // 10 minutes
  analysis: 900,      // 15 minutes
  policyEngine: 1800, // 30 minutes
  session: 86400,     // 24 hours
  rateLimit: 60,      // 1 minute
} as const;

interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  totalKeys: number;
  memoryUsage: number;
  hitRate: number;
  lastReset: Date;
}

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  version: string;
}

export class DistributedCacheService {
  private static instance: DistributedCacheService;
  private redis: Redis | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private localCache: Map<string, { data: any; expires: number }> = new Map();
  private metrics: Map<keyof typeof CACHE_PREFIXES, CacheMetrics> = new Map();
  private isConnected = false;
  private connectionRetries = 0;
  private maxRetries = 5;

  private constructor() {
    this.initializeMetrics();
  }

  public static getInstance(): DistributedCacheService {
    if (!DistributedCacheService.instance) {
      DistributedCacheService.instance = new DistributedCacheService();
    }
    return DistributedCacheService.instance;
  }

  private initializeMetrics(): void {
    Object.keys(CACHE_PREFIXES).forEach((type) => {
      this.metrics.set(type as keyof typeof CACHE_PREFIXES, {
        hits: 0,
        misses: 0,
        errors: 0,
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
        lastReset: new Date(),
      });
    });
  }

  public async connect(): Promise<boolean> {
    if (this.isConnected) return true;

    try {
      // Check if Redis is available
      if (!process.env.REDIS_HOST && process.env.NODE_ENV === 'production') {
        console.warn('⚠️ Redis not configured in production. Using in-memory fallback.');
        return false;
      }

      // Create main Redis client
      this.redis = new Redis(REDIS_CONFIG);
      
      // Create pub/sub clients for distributed operations
      this.pubClient = new Redis(REDIS_CONFIG);
      this.subClient = new Redis(REDIS_CONFIG);

      // Handle connection events
      this.redis.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
        this.connectionRetries = 0;
      });

      this.redis.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
        this.handleConnectionError();
      });

      this.redis.on('close', () => {
        console.warn('⚠️ Redis connection closed');
        this.isConnected = false;
      });

      // Wait for connection
      await this.redis.connect();
      
      // Set up cache invalidation pub/sub
      await this.setupCacheInvalidation();

      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      return false;
    }
  }

  private async setupCacheInvalidation(): Promise<void> {
    if (!this.subClient || !this.pubClient) return;

    // Subscribe to invalidation events
    await this.subClient.subscribe('cache:invalidate');
    
    this.subClient.on('message', async (channel, message) => {
      if (channel === 'cache:invalidate') {
        try {
          const { pattern } = JSON.parse(message);
          await this.invalidatePattern(pattern, false); // Don't broadcast again
        } catch (error) {
          console.error('Error processing cache invalidation:', error);
        }
      }
    });
  }

  private handleConnectionError(): void {
    this.connectionRetries++;
    if (this.connectionRetries >= this.maxRetries) {
      console.error('❌ Max Redis connection retries reached. Falling back to in-memory cache.');
      this.isConnected = false;
      this.redis = null;
    }
  }

  private getCacheKey(type: keyof typeof CACHE_PREFIXES, key: string): string {
    return `${CACHE_PREFIXES[type]}${key}`;
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex').substring(0, 16);
  }

  public async get<T = any>(
    type: keyof typeof CACHE_PREFIXES,
    key: string
  ): Promise<T | null> {
    const fullKey = this.getCacheKey(type, this.hashKey(key));
    const metrics = this.metrics.get(type)!;

    try {
      // Try Redis first if connected
      if (this.isConnected && this.redis) {
        const cached = await this.redis.get(fullKey);
        if (cached) {
          metrics.hits++;
          const entry: CacheEntry<T> = JSON.parse(cached);
          return entry.data;
        }
      }

      // Fallback to local cache
      const local = this.localCache.get(fullKey);
      if (local && local.expires > Date.now()) {
        metrics.hits++;
        return local.data;
      }

      metrics.misses++;
      return null;
    } catch (error) {
      metrics.errors++;
      console.error(`Cache get error for ${fullKey}:`, error);
      return null;
    } finally {
      this.updateHitRate(type);
    }
  }

  public async set<T = any>(
    type: keyof typeof CACHE_PREFIXES,
    key: string,
    value: T,
    customTTL?: number
  ): Promise<boolean> {
    const fullKey = this.getCacheKey(type, this.hashKey(key));
    const ttl = customTTL || TTL_SECONDS[type];
    const metrics = this.metrics.get(type)!;

    try {
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl,
        version: '1.0',
      };

      // Store in Redis if connected
      if (this.isConnected && this.redis) {
        await this.redis.setex(fullKey, ttl, JSON.stringify(entry));
      }

      // Always store in local cache as backup
      this.localCache.set(fullKey, {
        data: value,
        expires: Date.now() + ttl * 1000,
      });

      metrics.totalKeys++;
      return true;
    } catch (error) {
      metrics.errors++;
      console.error(`Cache set error for ${fullKey}:`, error);
      return false;
    }
  }

  public async delete(type: keyof typeof CACHE_PREFIXES, key: string): Promise<boolean> {
    const fullKey = this.getCacheKey(type, this.hashKey(key));

    try {
      if (this.isConnected && this.redis) {
        await this.redis.del(fullKey);
      }
      this.localCache.delete(fullKey);
      return true;
    } catch (error) {
      console.error(`Cache delete error for ${fullKey}:`, error);
      return false;
    }
  }

  public async invalidatePattern(
    pattern: string,
    broadcast: boolean = true
  ): Promise<number> {
    let count = 0;

    try {
      // Invalidate in Redis
      if (this.isConnected && this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          count = await this.redis.del(...keys);
        }

        // Broadcast invalidation to other instances
        if (broadcast && this.pubClient) {
          await this.pubClient.publish(
            'cache:invalidate',
            JSON.stringify({ pattern })
          );
        }
      }

      // Invalidate in local cache
      for (const key of this.localCache.keys()) {
        if (key.match(pattern)) {
          this.localCache.delete(key);
          count++;
        }
      }

      return count;
    } catch (error) {
      console.error(`Cache invalidation error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  public async clear(type?: keyof typeof CACHE_PREFIXES): Promise<void> {
    try {
      if (type) {
        const pattern = `${CACHE_PREFIXES[type]}*`;
        await this.invalidatePattern(pattern);
        this.metrics.get(type)!.totalKeys = 0;
      } else {
        if (this.isConnected && this.redis) {
          await this.redis.flushdb();
        }
        this.localCache.clear();
        this.initializeMetrics();
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  private updateHitRate(type: keyof typeof CACHE_PREFIXES): void {
    const metrics = this.metrics.get(type)!;
    const total = metrics.hits + metrics.misses;
    metrics.hitRate = total > 0 ? (metrics.hits / total) * 100 : 0;
  }

  public async getMetrics(): Promise<{
    overall: CacheMetrics;
    byType: Record<string, CacheMetrics>;
    redis: {
      connected: boolean;
      retries: number;
      info?: Record<string, any>;
    };
  }> {
    const overall: CacheMetrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalKeys: 0,
      memoryUsage: 0,
      hitRate: 0,
      lastReset: new Date(),
    };

    const byType: Record<string, CacheMetrics> = {};

    // Aggregate metrics
    for (const [type, metrics] of this.metrics.entries()) {
      overall.hits += metrics.hits;
      overall.misses += metrics.misses;
      overall.errors += metrics.errors;
      overall.totalKeys += metrics.totalKeys;
      byType[type] = { ...metrics };
    }

    // Calculate overall hit rate
    const totalRequests = overall.hits + overall.misses;
    overall.hitRate = totalRequests > 0 ? (overall.hits / totalRequests) * 100 : 0;

    // Get Redis info if connected
    let redisInfo = {};
    if (this.isConnected && this.redis) {
      try {
        const info = await this.redis.info('memory');
        const lines = info.split('\r\n');
        for (const line of lines) {
          const [key, value] = line.split(':');
          if (key && value) {
            redisInfo[key] = value;
          }
        }
        overall.memoryUsage = parseInt(redisInfo['used_memory'] || '0');
      } catch (error) {
        console.error('Failed to get Redis info:', error);
      }
    }

    return {
      overall,
      byType,
      redis: {
        connected: this.isConnected,
        retries: this.connectionRetries,
        info: redisInfo,
      },
    };
  }

  // Rate limiting support
  public async checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const key = `${CACHE_PREFIXES.rateLimit}${identifier}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    try {
      if (!this.isConnected || !this.redis) {
        // Fallback to simple in-memory rate limiting
        const localKey = `rl:${identifier}`;
        const data = this.localCache.get(localKey);
        
        if (!data || data.expires < now) {
          this.localCache.set(localKey, {
            data: { count: 1, resetAt: now + windowSeconds * 1000 },
            expires: now + windowSeconds * 1000,
          });
          return { allowed: true, remaining: limit - 1, resetAt: new Date(now + windowSeconds * 1000) };
        }

        const count = data.data.count;
        if (count >= limit) {
          return { allowed: false, remaining: 0, resetAt: new Date(data.data.resetAt) };
        }

        data.data.count++;
        return { allowed: true, remaining: limit - count - 1, resetAt: new Date(data.data.resetAt) };
      }

      // Use Redis sorted sets for sliding window rate limiting
      const multi = this.redis.multi();
      
      // Remove old entries
      multi.zremrangebyscore(key, 0, windowStart);
      
      // Add current request
      multi.zadd(key, now, `${now}-${Math.random()}`);
      
      // Count requests in window
      multi.zcard(key);
      
      // Set expiry
      multi.expire(key, windowSeconds + 1);
      
      const results = await multi.exec();
      const count = results?.[2]?.[1] as number || 0;

      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);
      const resetAt = new Date(now + windowSeconds * 1000);

      return { allowed, remaining, resetAt };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail open in case of errors
      return { allowed: true, remaining: limit, resetAt: new Date(now + windowSeconds * 1000) };
    }
  }

  // Session management
  public async getSession(sessionId: string): Promise<any | null> {
    return this.get('session', sessionId);
  }

  public async setSession(sessionId: string, data: any, ttl?: number): Promise<boolean> {
    return this.set('session', sessionId, data, ttl || TTL_SECONDS.session);
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    return this.delete('session', sessionId);
  }

  // Graceful shutdown
  public async disconnect(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      if (this.pubClient) {
        await this.pubClient.quit();
      }
      if (this.subClient) {
        await this.subClient.quit();
      }
      this.isConnected = false;
      console.log('✅ Redis disconnected gracefully');
    } catch (error) {
      console.error('Error during Redis disconnect:', error);
    }
  }
}

// Export singleton instance
export const distributedCache = DistributedCacheService.getInstance();