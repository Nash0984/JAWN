import NodeCache from 'node-cache';
import type { PolicyEngineHousehold, BenefitResult } from './policyEngine.service';
import { generateHouseholdHash } from './cacheService';
import { redisCache, tieredCacheGet } from './redisCache';
import { logger } from './logger.service';

/**
 * PolicyEngine Calculation Cache Service
 * 
 * Caches benefit calculation results to reduce expensive PolicyEngine API calls.
 * Particularly effective for scenario modeling and comparison features.
 * 
 * Now supports L1 (NodeCache) + L2 (Redis) tiered caching:
 * - L1: Process-local for rapid comparisons
 * - L2: Distributed for shared calculations across navigators
 * 
 * Cost Savings: 50-70% reduction for repeated household scenarios
 * TTL: 1 hour
 * Invalidation: On household data mutations
 */

interface CachedCalculation {
  benefits: BenefitResult;
  householdHash: string;
  timestamp: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  totalRequests: number;
  estimatedTimeSavings: number; // in milliseconds
}

class PolicyEngineCacheService {
  private cache: NodeCache;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    estimatedTimeSavings: 0
  };
  
  // PolicyEngine HTTP calls take ~500ms average
  private readonly AVG_CALCULATION_TIME_MS = 500;
  
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 60 * 60, // 1 hour
      checkperiod: 5 * 60, // Check every 5 minutes
      useClones: false,
      maxKeys: 2000 // Limit to 2k scenarios
    });
  }
  
  /**
   * Generate deterministic hash from household parameters
   * Uses deep serialization to handle nested objects correctly and prevent cache collisions
   */
  private generateKey(household: PolicyEngineHousehold): string {
    // Create stable key from household characteristics
    const keyData = {
      adults: household.adults,
      children: household.children,
      employmentIncome: household.employmentIncome,
      unearnedIncome: household.unearnedIncome,
      stateCode: household.stateCode,
      year: household.year,
      householdAssets: household.householdAssets || 0,
      rentOrMortgage: household.rentOrMortgage || 0,
      utilityCosts: household.utilityCosts || 0,
      medicalExpenses: household.medicalExpenses || 0,
      childcareExpenses: household.childcareExpenses || 0,
      elderlyOrDisabled: household.elderlyOrDisabled || false
    };
    
    // Use shared generateHouseholdHash for consistent deep serialization
    return generateHouseholdHash(keyData);
  }
  
  /**
   * Get cached calculation or return null
   * Now checks L1 → L2 → null
   */
  async get(household: PolicyEngineHousehold): Promise<BenefitResult | null> {
    this.metrics.totalRequests++;
    
    const baseKey = this.generateKey(household);
    const key = `pe:calc:${baseKey}`;
    
    // Check L1 (NodeCache)
    const l1Cached = this.cache.get<CachedCalculation>(key);
    if (l1Cached) {
      this.metrics.hits++;
      this.metrics.estimatedTimeSavings += this.AVG_CALCULATION_TIME_MS;
      return l1Cached.benefits;
    }
    
    // Check L2 (Redis)
    const l2Cached = await redisCache.get<CachedCalculation>(key);
    if (l2Cached) {
      this.metrics.hits++;
      this.metrics.estimatedTimeSavings += this.AVG_CALCULATION_TIME_MS;
      // Write-through to L1
      this.cache.set(key, l2Cached);
      return l2Cached.benefits;
    }
    
    this.metrics.misses++;
    return null;
  }
  
  /**
   * Store calculation result in cache
   * Now writes to both L1 and L2
   */
  async set(household: PolicyEngineHousehold, benefits: BenefitResult): Promise<void> {
    const baseKey = this.generateKey(household);
    const key = `pe:calc:${baseKey}`;
    const ttl = 60 * 60; // 1 hour
    
    const entry: CachedCalculation = {
      benefits,
      householdHash: baseKey,
      timestamp: Date.now()
    };
    
    // Write to L1 (NodeCache)
    this.cache.set(key, entry, ttl);
    
    // Write to L2 (Redis)
    await redisCache.set(key, entry, ttl);
  }
  
  /**
   * Get cached calculation with automatic generation if not found
   * Uses tiered cache with automatic population
   */
  async getOrCalculate(
    household: PolicyEngineHousehold,
    calculateFn: () => Promise<BenefitResult>
  ): Promise<BenefitResult> {
    const baseKey = this.generateKey(household);
    const key = `pe:calc:${baseKey}`;
    const ttl = 60 * 60; // 1 hour
    
    const result = await tieredCacheGet(key, async () => {
      const benefits = await calculateFn();
      return { benefits, householdHash: baseKey, timestamp: Date.now() };
    }, ttl);
    
    return result.benefits;
  }
  
  /**
   * Invalidate cache for specific scenario (on mutation)
   */
  invalidateScenario(household: PolicyEngineHousehold): void {
    const key = this.generateKey(household);
    this.cache.del(key);
    logger.info('📦 Invalidated PolicyEngine cache for scenario', { 
      scenarioId: key.substring(0, 8),
      service: 'PolicyEngineCache'
    });
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
      estimatedTimeSavings: `${(this.metrics.estimatedTimeSavings / 1000).toFixed(2)}s`,
      cacheSize: this.cache.keys().length,
      maxKeys: 2000,
      ttl: '1 hour'
    };
  }
  
  /**
   * Clear all cached calculations
   */
  clear(): void {
    this.cache.flushAll();
    logger.info('📦 PolicyEngine cache cleared', { service: 'PolicyEngineCache' });
  }
  
  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      estimatedTimeSavings: 0
    };
  }
}

export const policyEngineCache = new PolicyEngineCacheService();
