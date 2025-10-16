import NodeCache from 'node-cache';
import crypto from 'crypto';

const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60,
  useClones: false,
});

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
  get<T>(key: string): T | undefined {
    return cache.get<T>(key);
  },

  set<T>(key: string, value: T, ttl?: number): boolean {
    return cache.set(key, value, ttl || 300);
  },

  del(keys: string | string[]): number {
    return cache.del(keys);
  },

  flush(): void {
    cache.flushAll();
  },

  keys(): string[] {
    return cache.keys();
  },

  invalidatePattern(pattern: string): number {
    const keys = cache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    return cache.del(matchingKeys);
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

export const invalidateRulesCache = (programId: number) => {
  cacheService.del([
    CACHE_KEYS.INCOME_LIMITS(programId),
    CACHE_KEYS.DEDUCTIONS(programId),
    CACHE_KEYS.ALLOTMENTS(programId),
    CACHE_KEYS.CATEGORICAL_ELIGIBILITY(programId),
    CACHE_KEYS.DOCUMENT_REQUIREMENTS(programId),
  ]);
  cacheService.invalidatePattern(`manual_section`);
  cacheService.invalidatePattern(`manual_sections:${programId}`);
};
