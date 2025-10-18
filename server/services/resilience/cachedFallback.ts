/**
 * Cached Fallback Integration
 * 
 * Provides graceful degradation by falling back to cached data when operations fail.
 * Integrates with existing cacheService for consistent caching behavior.
 */

import { cacheService } from '../cacheService';

export interface CachePolicy {
  ttl: number;                // Time-to-live in seconds
  key: string;                // Cache key prefix
  invalidateOn?: string[];    // Events that invalidate cache
}

export interface CachedResult<T> {
  data: T;
  fromCache: boolean;
  cacheAge?: number;  // Age of cached data in seconds (if from cache)
}

/**
 * Execute operation with cached fallback
 * 
 * Strategy:
 * 1. Try operation first (fail-fast)
 * 2. On success: cache result and return { data, fromCache: false }
 * 3. On failure: check cache for stale data
 * 4. If cache hit: return { data, fromCache: true, cacheAge }
 * 5. If no cache: throw original error
 * 
 * @param operation - The async operation to execute
 * @param cachePolicy - Cache policy configuration
 * @param cacheKeyParams - Parameters to append to cache key (for unique cache entries)
 * @returns Promise resolving to result with cache metadata
 */
export async function withCachedFallback<T>(
  operation: () => Promise<T>,
  cachePolicy: CachePolicy,
  cacheKeyParams?: Record<string, any>
): Promise<CachedResult<T>> {
  // Build full cache key
  const fullCacheKey = buildCacheKey(cachePolicy.key, cacheKeyParams);

  try {
    // 1. Try operation first
    const result = await operation();

    // 2. Success - cache the result
    await cacheService.set(fullCacheKey, result, cachePolicy.ttl);

    console.log(`[CachedFallback] Operation succeeded, cached result: ${fullCacheKey}`);

    return {
      data: result,
      fromCache: false
    };

  } catch (operationError) {
    // 3. Operation failed - try cache fallback
    console.warn(`[CachedFallback] Operation failed, checking cache: ${fullCacheKey}`, {
      error: operationError instanceof Error ? operationError.message : String(operationError)
    });

    const cachedData = await cacheService.get<T>(fullCacheKey);

    if (cachedData !== null) {
      // 4. Cache hit - return stale data
      const cacheAge = await getCacheAge(fullCacheKey);
      
      console.warn(`[CachedFallback] Using cached fallback (age: ${cacheAge}s): ${fullCacheKey}`);

      return {
        data: cachedData,
        fromCache: true,
        cacheAge
      };
    }

    // 5. No cache available - throw original error
    console.error(`[CachedFallback] No cached data available: ${fullCacheKey}`);
    throw operationError;
  }
}

/**
 * Proactively cache data (for warmup or manual caching)
 * 
 * @param cacheKey - Cache key prefix
 * @param data - Data to cache
 * @param ttl - Time-to-live in seconds
 * @param cacheKeyParams - Parameters to append to cache key
 */
export async function cacheData<T>(
  cacheKey: string,
  data: T,
  ttl: number,
  cacheKeyParams?: Record<string, any>
): Promise<void> {
  const fullCacheKey = buildCacheKey(cacheKey, cacheKeyParams);
  await cacheService.set(fullCacheKey, data, ttl);
  console.log(`[CachedFallback] Proactively cached data: ${fullCacheKey}`);
}

/**
 * Invalidate cached data by key pattern
 * 
 * @param cacheKeyPattern - Cache key pattern to invalidate
 */
export async function invalidateCache(cacheKeyPattern: string): Promise<void> {
  await cacheService.invalidatePattern(cacheKeyPattern);
  console.log(`[CachedFallback] Invalidated cache: ${cacheKeyPattern}`);
}

/**
 * Build full cache key from prefix and parameters
 * 
 * @param keyPrefix - Cache key prefix
 * @param params - Parameters to append
 * @returns Full cache key
 */
function buildCacheKey(keyPrefix: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return keyPrefix;
  }

  // Sort params for consistent key generation
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');

  return `${keyPrefix}:${sortedParams}`;
}

/**
 * Get age of cached data in seconds
 * Note: This is a best-effort calculation based on TTL
 * 
 * @param cacheKey - Cache key
 * @returns Age in seconds (approximate)
 */
async function getCacheAge(cacheKey: string): number {
  // CacheService doesn't expose metadata, so we can't get exact age
  // Return 0 as placeholder - could be enhanced if cacheService is extended
  return 0;
}
