import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../server/db';
import { apiKeys } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:5000';

async function fetchApi(path: string, apiKey?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  
  const response = await fetch(`${BASE_URL}${path}`, { headers });
  const data = await response.json().catch(() => null);
  return { response, data };
}

describe('Research API Integration Tests', () => {
  let testApiKey: string;
  let testApiKeyId: string;
  let limitedScopeApiKey: string;
  let limitedScopeApiKeyId: string;
  let noResearchScopeApiKey: string;
  let noResearchScopeApiKeyId: string;
  let expiredApiKey: string;
  let expiredApiKeyId: string;
  
  beforeAll(async () => {
    const keyPrefix = `test_research_${Date.now()}`;
    
    const fullScopeKey = `md_${crypto.randomBytes(32).toString('hex')}`;
    testApiKey = fullScopeKey;
    const fullScopeHash = await bcrypt.hash(fullScopeKey, 10);
    
    const [fullScopeRecord] = await db.insert(apiKeys).values({
      key: fullScopeHash,
      name: `${keyPrefix}_full_scope`,
      tenantId: 'test-tenant',
      scopes: ['research:eligibility', 'research:outcomes', 'research:demographics', 'research:perm', 'research:all'],
      rateLimit: 1000,
      status: 'active',
    }).returning();
    testApiKeyId = fullScopeRecord.id;
    
    const limitedKey = `md_${crypto.randomBytes(32).toString('hex')}`;
    limitedScopeApiKey = limitedKey;
    const limitedHash = await bcrypt.hash(limitedKey, 10);
    
    const [limitedRecord] = await db.insert(apiKeys).values({
      key: limitedHash,
      name: `${keyPrefix}_limited_scope`,
      tenantId: 'test-tenant',
      scopes: ['research:eligibility'],
      rateLimit: 1000,
      status: 'active',
    }).returning();
    limitedScopeApiKeyId = limitedRecord.id;
    
    const noResearchKey = `md_${crypto.randomBytes(32).toString('hex')}`;
    noResearchScopeApiKey = noResearchKey;
    const noResearchHash = await bcrypt.hash(noResearchKey, 10);
    
    const [noResearchRecord] = await db.insert(apiKeys).values({
      key: noResearchHash,
      name: `${keyPrefix}_no_research`,
      tenantId: 'test-tenant',
      scopes: ['eligibility:read'],
      rateLimit: 1000,
      status: 'active',
    }).returning();
    noResearchScopeApiKeyId = noResearchRecord.id;
    
    const expKey = `md_${crypto.randomBytes(32).toString('hex')}`;
    expiredApiKey = expKey;
    const expHash = await bcrypt.hash(expKey, 10);
    
    const [expRecord] = await db.insert(apiKeys).values({
      key: expHash,
      name: `${keyPrefix}_expired`,
      tenantId: 'test-tenant',
      scopes: ['research:all'],
      rateLimit: 1000,
      status: 'active',
      expiresAt: new Date(Date.now() - 86400000),
    }).returning();
    expiredApiKeyId = expRecord.id;
  }, 30000);
  
  afterAll(async () => {
    const keysToDelete = [testApiKeyId, limitedScopeApiKeyId, noResearchScopeApiKeyId, expiredApiKeyId].filter(Boolean);
    for (const keyId of keysToDelete) {
      await db.delete(apiKeys).where(eq(apiKeys.id, keyId)).catch(() => {});
    }
  });
  
  describe('Authentication', () => {
    it('should return 401 when no API key is provided', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility');
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('MISSING_API_KEY');
    });
    
    it('should return 401 for invalid API key', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility', 'invalid_key_12345');
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('INVALID_API_KEY');
    });
    
    it('should return 401 for expired API key', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility', expiredApiKey);
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('INVALID_API_KEY');
    });
    
    it('should accept valid API key and return response', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
    });
    
    it('should include rate limit headers in response', async () => {
      const { response } = await fetchApi('/api/research/eligibility', testApiKey);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('x-ratelimit-limit')).toBeTruthy();
      expect(response.headers.get('x-ratelimit-remaining')).toBeTruthy();
      expect(response.headers.get('x-ratelimit-reset')).toBeTruthy();
    });
  });
  
  describe('Scope Enforcement', () => {
    it('should return 403 when accessing eligibility without research:eligibility scope', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility', noResearchScopeApiKey);
      
      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
      expect(data.code).toBe('INSUFFICIENT_SCOPE');
      expect(data.requiredScope).toBe('research:eligibility');
    });
    
    it('should return 403 when accessing outcomes without research:outcomes scope', async () => {
      const { response, data } = await fetchApi('/api/research/outcomes', limitedScopeApiKey);
      
      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
      expect(data.code).toBe('INSUFFICIENT_SCOPE');
      expect(data.requiredScope).toBe('research:outcomes');
    });
    
    it('should return 403 when accessing demographics without research:demographics scope', async () => {
      const { response, data } = await fetchApi('/api/research/demographics', limitedScopeApiKey);
      
      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
      expect(data.code).toBe('INSUFFICIENT_SCOPE');
    });
    
    it('should return 403 when accessing perm without research:perm scope', async () => {
      const { response, data } = await fetchApi('/api/research/perm', limitedScopeApiKey);
      
      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
      expect(data.code).toBe('INSUFFICIENT_SCOPE');
    });
    
    it('should allow access with correct scope', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility', limitedScopeApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
    });
    
    it('/all endpoint should return 403 when API key has no research scopes', async () => {
      const { response, data } = await fetchApi('/api/research/all', noResearchScopeApiKey);
      
      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
      expect(data.code).toBe('INSUFFICIENT_SCOPE');
    });
    
    it('/all endpoint should return only authorized datasets', async () => {
      const { response, data } = await fetchApi('/api/research/all', limitedScopeApiKey);
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('eligibility');
      expect(data.data).not.toHaveProperty('outcomes');
      expect(data.data).not.toHaveProperty('demographics');
      expect(data.data).not.toHaveProperty('perm');
      expect(data.metadata.includedScopes).toContain('eligibility');
      expect(data.metadata.note).toContain('Some datasets excluded');
    });
    
    it('/all endpoint should return all datasets with full research:all scope', async () => {
      const { response, data } = await fetchApi('/api/research/all', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('eligibility');
      expect(data.data).toHaveProperty('outcomes');
      expect(data.data).toHaveProperty('demographics');
      expect(data.data).toHaveProperty('perm');
      expect(data.data).toHaveProperty('perMetrics');
    });
  });
  
  describe('Date Validation', () => {
    it('should accept valid ISO date format for startDate', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility?startDate=2024-01-01', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
    });
    
    it('should accept valid ISO datetime format for startDate', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility?startDate=2024-01-01T00:00:00.000Z', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
    });
    
    it('should reject invalid startDate format', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility?startDate=not-a-date', testApiKey);
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid query parameters');
    });
    
    it('should reject invalid endDate format', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility?endDate=13/45/2024', testApiKey);
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid query parameters');
    });
    
    it('should accept date range query', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility?startDate=2024-01-01&endDate=2024-12-31', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
    });
  });
  
  describe('Query Parameters', () => {
    it('should filter by stateCode', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility?stateCode=MD', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
    });
    
    it('should filter by programType', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility?programType=SNAP', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
    });
    
    it('should accept combined filters', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility?stateCode=MD&programType=SNAP&startDate=2024-01-01&endDate=2024-12-31', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
    });
  });
  
  describe('Privacy Filtering (K-Anonymity)', () => {
    it('should include suppressedFields in metadata when groups are suppressed', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('metadata');
      if (data.metadata) {
        expect(data.metadata).toHaveProperty('suppressedFields');
        expect(Array.isArray(data.metadata.suppressedFields)).toBe(true);
      }
    });
    
    it('should include warning when groups are suppressed', async () => {
      const { response, data } = await fetchApi('/api/research/outcomes', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('metadata');
      if (data.metadata && data.metadata.suppressedFields?.length > 0) {
        expect(data.metadata.warning).toContain('suppressed');
      }
    });
    
    it('should return aggregated data without PII', async () => {
      const { response, data } = await fetchApi('/api/research/demographics', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      
      if (data.success && data.data) {
        const stringifiedData = JSON.stringify(data.data);
        expect(stringifiedData).not.toMatch(/\d{3}-\d{2}-\d{4}/);
        expect(stringifiedData).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      }
    });
    
    it('should include aggregation level in metadata', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('metadata');
      if (data.metadata) {
        expect(data.metadata).toHaveProperty('aggregationLevel');
        expect(typeof data.metadata.aggregationLevel).toBe('string');
      }
    });
  });
  
  describe('Response Structure', () => {
    it('eligibility endpoint should return correct structure', async () => {
      const { response, data } = await fetchApi('/api/research/eligibility', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
      if (data.success) {
        expect(data).toHaveProperty('data');
        expect(data.metadata).toHaveProperty('queryTime');
        expect(data.metadata).toHaveProperty('recordCount');
        expect(data.metadata).toHaveProperty('dataFreshness');
      }
    });
    
    it('outcomes endpoint should return correct structure', async () => {
      const { response, data } = await fetchApi('/api/research/outcomes', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
      if (data.success) {
        expect(data.metadata.aggregationLevel).toBe('program_state_status');
      }
    });
    
    it('demographics endpoint should return household and income distributions', async () => {
      const { response, data } = await fetchApi('/api/research/demographics', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
      if (data.success) {
        expect(data.data).toHaveProperty('householdSizeDistribution');
        expect(data.data).toHaveProperty('incomeDistribution');
      }
    });
    
    it('perm endpoint should return sample stats and error rate summary', async () => {
      const { response, data } = await fetchApi('/api/research/perm', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
      if (data.success) {
        expect(data.data).toHaveProperty('permSampleStats');
        expect(data.data).toHaveProperty('errorRateSummary');
      }
    });
    
    it('per-metrics endpoint should return verification and nudge stats', async () => {
      const { response, data } = await fetchApi('/api/research/per-metrics', testApiKey);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('metadata');
      if (data.success) {
        expect(data.data).toHaveProperty('incomeVerification');
        expect(data.data).toHaveProperty('consistencyChecks');
        expect(data.data).toHaveProperty('caseworkerNudges');
      }
    });
  });
  
  describe('Public Endpoints (No Auth Required)', () => {
    it('/docs endpoint should not require authentication', async () => {
      const { response, data } = await fetchApi('/api/research/docs');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('version');
      expect(data.data).toHaveProperty('baseUrl');
      expect(data.data).toHaveProperty('authentication');
      expect(data.data).toHaveProperty('endpoints');
    });
    
    it('/scopes endpoint should not require authentication', async () => {
      const { response, data } = await fetchApi('/api/research/scopes');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('research:eligibility');
      expect(data.data).toHaveProperty('research:outcomes');
      expect(data.data).toHaveProperty('research:demographics');
      expect(data.data).toHaveProperty('research:perm');
      expect(data.data).toHaveProperty('research:all');
    });
  });
});
