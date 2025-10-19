/**
 * Redis Cache Service - L2 Distributed Cache Layer
 * 
 * Provides distributed caching with Redis/Upstash for multi-instance deployments.
 * Automatically falls back to in-memory NodeCache when Redis is unavailable.
 * Supports both standard Redis and Upstash REST API connections.
 */

import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import NodeCache from 'node-cache';
import { cacheService } from './cacheService';

// Cache invalidation event interface
export interface CacheInvalidationEvent {
  trigger: string;
  affectedCaches: string[];
  programCodes?: string[];
  timestamp: Date;
  source?: string;
}

// Redis cache interface
export interface IRedisCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(keys: string | string[]): Promise<number>;
  invalidatePattern(pattern: string): Promise<number>;
  publishInvalidation(event: CacheInvalidationEvent): Promise<void>;
  subscribeToInvalidations(handler: (event: CacheInvalidationEvent) => void): void;
  getStatus(): 'connected' | 'disconnected' | 'connecting' | 'fallback';
  getMetrics(): Promise<CacheMetrics>;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  connectionStatus: string;
  lastError?: string;
}

/**
 * Redis Cache Implementation
 */
class RedisCacheService implements IRedisCache {
  private redis: Redis | UpstashRedis | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private isUpstash = false;
  private status: 'connected' | 'disconnected' | 'connecting' | 'fallback' = 'disconnected';
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    connectionStatus: 'disconnected'
  };
  private invalidationHandlers: Set<(event: CacheInvalidationEvent) => void> = new Set();

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis(): void {
    const redisUrl = process.env.REDIS_URL;
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (upstashUrl && upstashToken) {
      // Use Upstash REST API
      this.isUpstash = true;
      this.status = 'connecting';
      
      try {
        this.redis = new UpstashRedis({
          url: upstashUrl,
          token: upstashToken
        });
        
        this.status = 'connected';
        this.metrics.connectionStatus = 'connected (Upstash)';
        console.log('🎯 Redis L2 Cache: Connected to Upstash');
      } catch (error) {
        this.handleConnectionError(error);
      }
    } else if (redisUrl) {
      // Use standard Redis/ioredis
      this.status = 'connecting';
      
      try {
        // Main Redis client for get/set operations
        this.redis = new Redis(redisUrl, {
          retryStrategy: (times) => {
            if (times > 3) {
              console.error('❌ Redis L2 Cache: Max retries reached, falling back to L1 only');
              this.status = 'fallback';
              return null;
            }
            return Math.min(times * 100, 3000);
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false
        });

        // Pub/Sub clients for cache invalidation
        this.pubClient = new Redis(redisUrl);
        this.subClient = new Redis(redisUrl);

        this.setupRedisEventHandlers();
        this.setupPubSub();
        
      } catch (error) {
        this.handleConnectionError(error);
      }
    } else {
      // No Redis configuration - use fallback mode
      this.status = 'fallback';
      this.metrics.connectionStatus = 'fallback (L1 only)';
      console.log('📦 Redis L2 Cache: No Redis configured, using L1 cache only');
    }
  }

  private setupRedisEventHandlers(): void {
    if (!this.redis || this.isUpstash) return;
    
    const redisClient = this.redis as Redis;
    
    redisClient.on('connect', () => {
      console.log('🎯 Redis L2 Cache: Connecting...');
      this.status = 'connecting';
      this.metrics.connectionStatus = 'connecting';
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis L2 Cache: Connected and ready');
      this.status = 'connected';
      this.metrics.connectionStatus = 'connected';
    });

    redisClient.on('error', (error) => {
      console.error('❌ Redis L2 Cache error:', error.message);
      this.metrics.errors++;
      this.metrics.lastError = error.message;
    });

    redisClient.on('close', () => {
      console.log('🔌 Redis L2 Cache: Connection closed');
      this.status = 'disconnected';
      this.metrics.connectionStatus = 'disconnected';
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis L2 Cache: Reconnecting...');
      this.status = 'connecting';
      this.metrics.connectionStatus = 'reconnecting';
    });
  }

  private setupPubSub(): void {
    if (!this.subClient) return;

    // Subscribe to cache invalidation channel
    this.subClient.subscribe('cache:invalidation', (err) => {
      if (err) {
        console.error('❌ Redis Pub/Sub subscription error:', err);
        this.metrics.errors++;
      } else {
        console.log('📡 Redis Pub/Sub: Subscribed to cache invalidation channel');
      }
    });

    // Handle invalidation messages
    this.subClient.on('message', (channel, message) => {
      if (channel === 'cache:invalidation') {
        try {
          const event: CacheInvalidationEvent = JSON.parse(message);
          this.handleInvalidationEvent(event);
        } catch (error) {
          console.error('❌ Failed to parse invalidation event:', error);
          this.metrics.errors++;
        }
      }
    });
  }

  private handleInvalidationEvent(event: CacheInvalidationEvent): void {
    // Notify all registered handlers
    this.invalidationHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('❌ Invalidation handler error:', error);
        this.metrics.errors++;
      }
    });

    // Invalidate local L1 cache based on event
    if (event.affectedCaches) {
      event.affectedCaches.forEach(pattern => {
        cacheService.invalidatePattern(pattern);
      });
    }
  }

  private handleConnectionError(error: any): void {
    console.error('❌ Redis L2 Cache connection failed:', error?.message || error);
    this.status = 'fallback';
    this.metrics.connectionStatus = 'fallback (connection failed)';
    this.metrics.errors++;
    this.metrics.lastError = error?.message || 'Connection failed';
  }

  /**
   * Get value from Redis cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.status !== 'connected' || !this.redis) {
      return null; // Fallback to L1
    }

    try {
      let value: string | null;
      
      if (this.isUpstash) {
        value = await (this.redis as UpstashRedis).get(key);
      } else {
        value = await (this.redis as Redis).get(key);
      }

      if (value) {
        this.metrics.hits++;
        return JSON.parse(value) as T;
      } else {
        this.metrics.misses++;
        return null;
      }
    } catch (error) {
      console.error(`❌ Redis get error for key ${key}:`, error);
      this.metrics.errors++;
      this.metrics.lastError = `Get failed: ${error}`;
      return null; // Fallback to L1
    }
  }

  /**
   * Set value in Redis cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    if (this.status !== 'connected' || !this.redis) {
      return; // Only cache in L1
    }

    try {
      const serialized = JSON.stringify(value);
      
      if (this.isUpstash) {
        await (this.redis as UpstashRedis).setex(key, ttlSeconds, serialized);
      } else {
        await (this.redis as Redis).setex(key, ttlSeconds, serialized);
      }
      
      this.metrics.sets++;
    } catch (error) {
      console.error(`❌ Redis set error for key ${key}:`, error);
      this.metrics.errors++;
      this.metrics.lastError = `Set failed: ${error}`;
      // Continue without throwing - L1 cache will still work
    }
  }

  /**
   * Delete key(s) from Redis
   */
  async del(keys: string | string[]): Promise<number> {
    if (this.status !== 'connected' || !this.redis) {
      return 0;
    }

    try {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      let deleted: number;
      
      if (this.isUpstash) {
        deleted = await (this.redis as UpstashRedis).del(...keysArray);
      } else {
        deleted = await (this.redis as Redis).del(...keysArray);
      }
      
      this.metrics.deletes += deleted;
      return deleted;
    } catch (error) {
      console.error('❌ Redis del error:', error);
      this.metrics.errors++;
      this.metrics.lastError = `Delete failed: ${error}`;
      return 0;
    }
  }

  /**
   * Pattern-based cache invalidation
   */
  async invalidatePattern(pattern: string): Promise<number> {
    if (this.status !== 'connected' || !this.redis) {
      return 0;
    }

    try {
      let keys: string[] = [];
      
      if (this.isUpstash) {
        // Upstash doesn't support SCAN, use KEYS with caution
        const result = await (this.redis as UpstashRedis).keys(`*${pattern}*`);
        keys = result as string[];
      } else {
        // Use SCAN for better performance with large datasets
        const stream = (this.redis as Redis).scanStream({
          match: `*${pattern}*`,
          count: 100
        });
        
        keys = await new Promise((resolve, reject) => {
          const foundKeys: string[] = [];
          stream.on('data', (batch) => {
            foundKeys.push(...batch);
          });
          stream.on('end', () => resolve(foundKeys));
          stream.on('error', reject);
        });
      }

      if (keys.length > 0) {
        return await this.del(keys);
      }
      return 0;
    } catch (error) {
      console.error('❌ Redis pattern invalidation error:', error);
      this.metrics.errors++;
      this.metrics.lastError = `Pattern invalidation failed: ${error}`;
      return 0;
    }
  }

  /**
   * Publish cache invalidation event
   */
  async publishInvalidation(event: CacheInvalidationEvent): Promise<void> {
    if (!this.pubClient && !this.isUpstash) {
      // No pub/sub available
      return;
    }

    try {
      const message = JSON.stringify(event);
      
      if (this.isUpstash && this.redis) {
        // Upstash supports pub/sub via REST API
        await (this.redis as UpstashRedis).publish('cache:invalidation', message);
      } else if (this.pubClient) {
        await this.pubClient.publish('cache:invalidation', message);
      }
      
      console.log(`📡 Published cache invalidation: ${event.trigger}`);
    } catch (error) {
      console.error('❌ Failed to publish invalidation:', error);
      this.metrics.errors++;
      this.metrics.lastError = `Publish failed: ${error}`;
    }
  }

  /**
   * Subscribe to cache invalidation events
   */
  subscribeToInvalidations(handler: (event: CacheInvalidationEvent) => void): void {
    this.invalidationHandlers.add(handler);
  }

  /**
   * Get Redis connection status
   */
  getStatus(): 'connected' | 'disconnected' | 'connecting' | 'fallback' {
    return this.status;
  }

  /**
   * Get cache metrics
   */
  async getMetrics(): Promise<CacheMetrics> {
    // Calculate hit rate
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    return {
      ...this.metrics,
      connectionStatus: `${this.metrics.connectionStatus} (Hit rate: ${hitRate.toFixed(1)}%)`
    };
  }

  /**
   * Cleanup connections
   */
  async disconnect(): Promise<void> {
    if (this.redis && !this.isUpstash) {
      await (this.redis as Redis).quit();
    }
    if (this.pubClient) {
      await this.pubClient.quit();
    }
    if (this.subClient) {
      await this.subClient.quit();
    }
    this.status = 'disconnected';
    console.log('🔌 Redis L2 Cache: Disconnected');
  }
}

// Export singleton instance
export const redisCache = new RedisCacheService();

// Helper function for L1→L2→Source cache lookup chain
export async function tieredCacheGet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  // Check L1 (NodeCache)
  const l1Value = cacheService.get<T>(key);
  if (l1Value !== undefined) {
    return l1Value;
  }

  // Check L2 (Redis)
  const l2Value = await redisCache.get<T>(key);
  if (l2Value !== null) {
    // Write-through to L1
    cacheService.set(key, l2Value, ttlSeconds);
    return l2Value;
  }

  // Fetch from source
  const sourceValue = await fetchFn();
  
  // Write-through to both L2 and L1
  await redisCache.set(key, sourceValue, ttlSeconds);
  cacheService.set(key, sourceValue, ttlSeconds);
  
  return sourceValue;
}

// Helper function for cache invalidation across all layers
export async function tieredCacheInvalidate(patterns: string[]): Promise<void> {
  // Invalidate L1
  patterns.forEach(pattern => {
    cacheService.invalidatePattern(pattern);
  });

  // Invalidate L2
  for (const pattern of patterns) {
    await redisCache.invalidatePattern(pattern);
  }

  // Publish invalidation event for other instances
  await redisCache.publishInvalidation({
    trigger: 'manual',
    affectedCaches: patterns,
    timestamp: new Date(),
    source: process.env.INSTANCE_ID || 'unknown'
  });
}