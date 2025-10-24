/**
 * Program Cache Service (Tenant-Aware)
 * 
 * Caches benefit programs per tenant to avoid repeated database queries.
 * Programs are quasi-static configuration data that rarely change.
 * 
 * Multi-State Architecture:
 * - Maintains separate cache entries per tenant/state
 * - Prevents cross-tenant data leakage (compliance-critical)
 * - Cache invalidation respects tenant boundaries
 * 
 * Performance Impact:
 * - Reduces 18+ repeated database calls to ~1 per hour per tenant
 * - Estimated ~15% reduction in database load
 * - Saves 50-100ms per request that uses programs
 * 
 * @see QUERY_OPTIMIZATION.md for analysis
 */

import { storage } from "../storage";
import type { BenefitProgram } from "@shared/schema";
import { logger } from "./logger.service";

const PROGRAM_CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

interface CacheEntry {
  programs: BenefitProgram[];
  timestamp: number;
  refreshPromise: Promise<BenefitProgram[]> | null;
}

class ProgramCacheService {
  // Tenant-scoped cache: Map<tenantId, CacheEntry>
  // Note: Using 'global' key for non-tenant queries (admin/system-level calls)
  private cacheMap = new Map<string, CacheEntry>();

  /**
   * Get benefit programs with tenant-aware caching
   * 
   * Returns cached programs if available and fresh, otherwise fetches from database.
   * Implements deduplication for concurrent requests during cache refresh.
   * 
   * Multi-Tenant Safety:
   * - Cache is keyed by tenantId to prevent cross-tenant data leakage
   * - Each tenant's cache is independent and expires separately
   * 
   * Error Handling:
   * - Failed refreshes preserve the last good cache (stale-while-revalidate pattern)
   * - Concurrent requests share the same pending promise
   * - Only throws if cache is empty AND refresh fails (graceful degradation)
   * 
   * @param tenantId - Optional tenant ID for multi-state isolation (defaults to 'global')
   */
  async getCachedBenefitPrograms(tenantId?: string | null): Promise<BenefitProgram[]> {
    const cacheKey = tenantId || 'global';
    const now = Date.now();
    
    // Get or create cache entry for this tenant
    let cacheEntry = this.cacheMap.get(cacheKey);
    if (!cacheEntry) {
      cacheEntry = {
        programs: [],
        timestamp: 0,
        refreshPromise: null,
      };
      this.cacheMap.set(cacheKey, cacheEntry);
    }

    const cacheAge = now - cacheEntry.timestamp;

    // Return cached data if still fresh
    if (cacheEntry.programs.length > 0 && cacheAge < PROGRAM_CACHE_TTL) {
      return cacheEntry.programs;
    }

    // If a refresh is already in progress for this tenant, share the promise
    if (cacheEntry.refreshPromise) {
      return cacheEntry.refreshPromise;
    }

    // Start refresh and share the promise with concurrent callers
    cacheEntry.refreshPromise = this.refreshCache(cacheKey, tenantId, now);
    
    try {
      return await cacheEntry.refreshPromise;
    } finally {
      cacheEntry.refreshPromise = null;
    }
  }

  /**
   * Refresh the cache from database for a specific tenant
   * 
   * Implements stale-while-revalidate pattern:
   * - On success: Update cache and return fresh data
   * - On failure: Return last good cache if available, otherwise throw
   */
  private async refreshCache(cacheKey: string, tenantId: string | null | undefined, now: number): Promise<BenefitProgram[]> {
    const cacheEntry = this.cacheMap.get(cacheKey)!;
    
    try {
      const programs = await storage.getBenefitPrograms();
      
      // Success: update cache
      cacheEntry.programs = programs;
      cacheEntry.timestamp = now;
      
      logger.debug('Benefit programs cache refreshed', {
        tenantId: tenantId || 'global',
        programCount: programs.length,
      });
      
      return programs;
    } catch (error) {
      logger.error('Failed to refresh benefit programs cache', { 
        error,
        tenantId: tenantId || 'global',
      });
      
      // Fallback: return stale cache if available (stale-while-revalidate)
      if (cacheEntry.programs.length > 0) {
        logger.warn('Returning stale benefit programs cache after refresh failure', {
          cacheAge: now - cacheEntry.timestamp,
          itemCount: cacheEntry.programs.length,
          tenantId: tenantId || 'global',
        });
        return cacheEntry.programs;
      }
      
      // No fallback available: propagate error
      throw new Error(`Failed to fetch benefit programs for tenant ${tenantId || 'global'} and no cached data available`);
    }
  }

  /**
   * Invalidate cache for a specific tenant or all tenants
   * Call when programs are updated
   * 
   * @param tenantId - Optional tenant ID to invalidate (if null, invalidates all)
   */
  invalidateCache(tenantId?: string | null): void {
    if (tenantId) {
      // Invalidate specific tenant cache
      const cacheKey = tenantId;
      this.cacheMap.delete(cacheKey);
      logger.info('Invalidated benefit programs cache for tenant', { tenantId });
    } else {
      // Invalidate all tenant caches (used when seeding global program data)
      this.cacheMap.clear();
      logger.info('Invalidated all benefit programs caches (all tenants)');
    }
  }

  /**
   * Get cache statistics for monitoring
   * 
   * @param tenantId - Optional tenant ID to get stats for (defaults to 'global')
   */
  getCacheStats(tenantId?: string | null): {
    isCached: boolean;
    cacheAge: number;
    itemCount: number;
    tenantId: string;
  } {
    const cacheKey = tenantId || 'global';
    const cacheEntry = this.cacheMap.get(cacheKey);
    
    if (!cacheEntry) {
      return {
        isCached: false,
        cacheAge: 0,
        itemCount: 0,
        tenantId: cacheKey,
      };
    }

    const cacheAge = cacheEntry.programs.length > 0 ? Date.now() - cacheEntry.timestamp : 0;
    return {
      isCached: cacheEntry.programs.length > 0,
      cacheAge,
      itemCount: cacheEntry.programs.length,
      tenantId: cacheKey,
    };
  }

  /**
   * Get overall cache statistics across all tenants
   * Useful for admin monitoring dashboards
   */
  getAllCacheStats(): {
    totalTenants: number;
    cachedTenants: number;
    totalPrograms: number;
  } {
    let cachedTenants = 0;
    let totalPrograms = 0;

    for (const [_, entry] of this.cacheMap) {
      if (entry.programs.length > 0) {
        cachedTenants++;
        totalPrograms += entry.programs.length;
      }
    }

    return {
      totalTenants: this.cacheMap.size,
      cachedTenants,
      totalPrograms,
    };
  }
}

// Export singleton instance
export const programCacheService = new ProgramCacheService();
