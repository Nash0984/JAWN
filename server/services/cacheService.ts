import NodeCache from 'node-cache';

const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  useClones: false,
});

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
