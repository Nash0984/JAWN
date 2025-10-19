import { distributedCache } from './distributedCache';
import crypto from 'crypto';

// Generate deterministic hash for household data to use as cache key
// Uses deep serialization to handle nested objects correctly
export function generateHouseholdHash(householdData: any): string {
  // Recursively sort all object keys at every nesting level
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
  
  const normalized = JSON.stringify(deepSort(householdData));
  return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
}

export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    return await distributedCache.get('general', key);
  },

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    await distributedCache.set('general', key, value, ttl || 300);
    return true;
  },

  async del(keys: string | string[]): Promise<number> {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    let deleted = 0;
    for (const key of keysArray) {
      const result = await distributedCache.delete('general', key);
      if (result) deleted++;
    }
    return deleted;
  },

  async flush(): Promise<void> {
    await distributedCache.clear('general');
  },

  async keys(): Promise<string[]> {
    return await distributedCache.keys('general');
  },

  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await distributedCache.keys('general');
    const matchingKeys = keys.filter(key => key.includes(pattern));
    let deleted = 0;
    for (const key of matchingKeys) {
      const result = await distributedCache.delete('general', key);
      if (result) deleted++;
    }
    return deleted;
  },
};

export const CACHE_KEYS = {
  INCOME_LIMITS: (programId: number) => `income_limits:${programId}`,
  DEDUCTIONS: (programId: number) => `deductions:${programId}`,
  ALLOTMENTS: (programId: number) => `allotments:${programId}`,
  CATEGORICAL_ELIGIBILITY: (programId: number) => `categorical:${programId}`,
  MANUAL_SECTION: (sectionId: number) => `manual_section:${sectionId}`,
  MANUAL_SECTIONS: (programId: number) => `manual_sections:${programId}`,
  DOCUMENT_REQUIREMENTS: (programId: number) => `doc_requirements:${programId}`,
  
  // Rules Engine Calculation Caching
  RULES_ENGINE_CALC: (programCode: string, householdHash: string) => `rules:${programCode}:${householdHash}`,
  POLICYENGINE_CALC: (householdHash: string) => `pe:calc:${householdHash}`,
  POLICYENGINE_SUMMARY: (householdHash: string) => `pe:summary:${householdHash}`,
  HYBRID_CALC: (programCode: string, householdHash: string) => `hybrid:${programCode}:${householdHash}`,
  HYBRID_SUMMARY: (householdHash: string) => `hybrid:summary:${householdHash}`,
};

export const invalidateRulesCache = async (programId: number) => {
  await cacheService.del([
    CACHE_KEYS.INCOME_LIMITS(programId),
    CACHE_KEYS.DEDUCTIONS(programId),
    CACHE_KEYS.ALLOTMENTS(programId),
    CACHE_KEYS.CATEGORICAL_ELIGIBILITY(programId),
    CACHE_KEYS.DOCUMENT_REQUIREMENTS(programId),
  ]);
  await cacheService.invalidatePattern(`manual_section`);
  await cacheService.invalidatePattern(`manual_sections:${programId}`);
};
