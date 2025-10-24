/**
 * Program Cache Service
 * 
 * Caches benefit programs to avoid repeated database queries.
 * Programs are quasi-static configuration data that rarely change.
 * 
 * Performance Impact:
 * - Reduces 18+ repeated database calls to ~1 per hour
 * - Estimated ~15% reduction in database load
 * - Saves 50-100ms per request that uses programs
 * 
 * @see QUERY_OPTIMIZATION.md for analysis
 */

import { storage } from "../storage";
import type { BenefitProgram } from "@shared/schema";
import { logger } from "./logger.service";

const PROGRAM_CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

class ProgramCacheService {
  private cachedPrograms: BenefitProgram[] | null = null;
  private cacheTimestamp = 0;
  private refreshPromise: Promise<BenefitProgram[]> | null = null;

  /**
   * Get benefit programs with caching
   * 
   * Returns cached programs if available and fresh, otherwise fetches from database.
   * Implements deduplication for concurrent requests during cache refresh.
   * 
   * Error Handling (Architect-reviewed fix):
   * - Failed refreshes preserve the last good cache (stale-while-revalidate pattern)
   * - Concurrent requests share the same pending promise
   * - Only throws if cache is empty AND refresh fails (graceful degradation)
   */
  async getCachedBenefitPrograms(): Promise<BenefitProgram[]> {
    const now = Date.now();
    const cacheAge = now - this.cacheTimestamp;

    // Return cached data if still fresh
    if (this.cachedPrograms && cacheAge < PROGRAM_CACHE_TTL) {
      return this.cachedPrograms;
    }

    // If a refresh is already in progress, share the promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start refresh and share the promise with concurrent callers
    this.refreshPromise = this.refreshCache(now);
    
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Refresh the cache from database
   * 
   * Implements stale-while-revalidate pattern:
   * - On success: Update cache and return fresh data
   * - On failure: Return last good cache if available, otherwise throw
   */
  private async refreshCache(now: number): Promise<BenefitProgram[]> {
    try {
      const programs = await storage.getBenefitPrograms();
      
      // Success: update cache
      this.cachedPrograms = programs;
      this.cacheTimestamp = now;
      
      return programs;
    } catch (error) {
      logger.error('Failed to refresh benefit programs cache', { error });
      
      // Fallback: return stale cache if available (stale-while-revalidate)
      if (this.cachedPrograms) {
        logger.warn('Returning stale benefit programs cache after refresh failure', {
          cacheAge: now - this.cacheTimestamp,
          itemCount: this.cachedPrograms.length,
        });
        return this.cachedPrograms;
      }
      
      // No fallback available: propagate error
      throw new Error('Failed to fetch benefit programs and no cached data available');
    }
  }

  /**
   * Invalidate cache (call when programs are updated)
   */
  invalidateCache(): void {
    this.cachedPrograms = null;
    this.cacheTimestamp = 0;
    this.refreshPromise = null;
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    isCached: boolean;
    cacheAge: number;
    itemCount: number;
  } {
    const cacheAge = this.cachedPrograms ? Date.now() - this.cacheTimestamp : 0;
    return {
      isCached: this.cachedPrograms !== null,
      cacheAge,
      itemCount: this.cachedPrograms?.length || 0,
    };
  }
}

// Export singleton instance
export const programCacheService = new ProgramCacheService();
