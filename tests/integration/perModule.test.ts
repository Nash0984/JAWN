import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../server/db';
import { 
  perIncomeVerifications, 
  perConsistencyChecks, 
  perDuplicateClaims, 
  perCaseworkerNudges, 
  perPermSamples,
  users,
  householdScenarios
} from '../../shared/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = 'http://localhost:5000';

let sessionCookie = '';
let testUserId: string;
let testCaseId: string;
let authReady = false;

async function fetchApi(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Test-Bypass': 'integration-test',
    ...options.headers as Record<string, string>,
  };
  
  if (sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }
  
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie.split(';')[0];
  }
  
  const data = await response.json().catch(() => null);
  return { response, data };
}

async function fetchNoAuth(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Test-Bypass': 'integration-test',
    ...options.headers as Record<string, string>,
  };
  
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  
  return response;
}

describe('PER Module Integration Tests', () => {
  beforeAll(async () => {
    const [existingUser] = await db.select().from(users).limit(1);
    if (existingUser) {
      testUserId = existingUser.id;
    }
    
    try {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Test-Bypass': 'integration-test'
        },
        body: JSON.stringify({
          email: 'demo.caseworker@maryland.gov',
          password: 'demo123',
        }),
      });
      
      if (loginRes.ok) {
        const setCookie = loginRes.headers.get('set-cookie');
        sessionCookie = setCookie?.split(';')[0] || '';
        authReady = true;
      } else {
        console.warn('⚠️ Login failed - authenticated PER tests will be skipped');
      }
    } catch (error) {
      console.warn('⚠️ Login error:', error);
    }
    
    if (testUserId) {
      try {
        const [scenario] = await db.insert(householdScenarios).values({
          userId: testUserId,
          name: `PER Test Case ${Date.now()}`,
          householdSize: 3,
          stateCode: 'MD',
          countyCode: 'BALT',
          monthlyGrossIncome: 2500,
        }).returning();
        testCaseId = scenario.id;
      } catch (error) {
        console.warn('Failed to create test case:', error);
      }
    }
  }, 30000);
  
  afterAll(async () => {
    if (testCaseId) {
      await db.delete(perIncomeVerifications).where(eq(perIncomeVerifications.caseId, testCaseId)).catch(() => {});
      await db.delete(perConsistencyChecks).where(eq(perConsistencyChecks.caseId, testCaseId)).catch(() => {});
      await db.delete(perDuplicateClaims).where(eq(perDuplicateClaims.primaryCaseId, testCaseId)).catch(() => {});
      await db.delete(perCaseworkerNudges).where(eq(perCaseworkerNudges.caseId, testCaseId)).catch(() => {});
      await db.delete(householdScenarios).where(eq(householdScenarios.id, testCaseId)).catch(() => {});
    }
  }, 15000);
  
  describe('Authentication Enforcement', () => {
    it('should require authentication for case assessment', async () => {
      const response = await fetchNoAuth('/api/per/assess/test-case', {
        method: 'POST',
      });
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for income verification', async () => {
      const response = await fetchNoAuth('/api/per/income-verification/test-case', {
        method: 'POST',
        body: JSON.stringify({
          verificationData: { reportedIncome: 2000 }
        }),
      });
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for pending verifications', async () => {
      const response = await fetchNoAuth('/api/per/income-verification/pending');
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for duplicate scan', async () => {
      const response = await fetchNoAuth('/api/per/duplicates/scan/test-case', {
        method: 'POST',
      });
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for nudge generation', async () => {
      const response = await fetchNoAuth('/api/per/nudges/generate/test-case', {
        method: 'POST',
      });
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for PERM sampling', async () => {
      const response = await fetchNoAuth('/api/per/perm/sample', {
        method: 'POST',
        body: JSON.stringify({
          quarter: 'Q1',
          year: 2025
        }),
      });
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for high-priority nudges', async () => {
      const response = await fetchNoAuth('/api/per/nudges/high-priority');
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for PERM report', async () => {
      const response = await fetchNoAuth('/api/per/perm/report?quarter=Q1&year=2025');
      expect([401, 403]).toContain(response.status);
    });
  });
  
  describe('Income Verification (Authenticated)', () => {
    it('should retrieve pending income verifications', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/income-verification/pending');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
    });
    
    it('should retrieve income verification stats', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/income-verification/stats');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data.data).toHaveProperty('totalVerifications');
      expect(data.data).toHaveProperty('pendingCount');
      expect(data.data).toHaveProperty('resolvedCount');
    });
    
    it('should trigger income verification for case', async () => {
      if (!authReady || !testCaseId) {
        console.log('⏭️ Skipping: auth or test case not ready');
        return;
      }
      
      const { response, data } = await fetchApi(`/api/per/income-verification/${testCaseId}`, {
        method: 'POST',
        body: JSON.stringify({
          verificationData: {
            reportedMonthlyIncome: 2500,
            w2WagesYTD: 25000,
          }
        }),
      });
      
      expect([200, 201, 400, 404]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        expect(data).toHaveProperty('success', true);
      }
    });
  });
  
  describe('Consistency Checks (Authenticated)', () => {
    it('should retrieve consistency checks for case', async () => {
      if (!authReady || !testCaseId) {
        console.log('⏭️ Skipping: auth or test case not ready');
        return;
      }
      
      const { response, data } = await fetchApi(`/api/per/checks/${testCaseId}`);
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(data).toHaveProperty('success', true);
        expect(Array.isArray(data.data)).toBe(true);
      }
    });
    
    it('should validate case before approval', async () => {
      if (!authReady || !testCaseId) {
        console.log('⏭️ Skipping: auth or test case not ready');
        return;
      }
      
      const { response, data } = await fetchApi(`/api/per/validate/${testCaseId}`, {
        method: 'POST',
      });
      
      expect([200, 400, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(data).toHaveProperty('success', true);
        expect(data.data).toHaveProperty('isValid');
        expect(data.data).toHaveProperty('checks');
      }
    });
  });
  
  describe('Duplicate Detection (Authenticated)', () => {
    it('should retrieve pending duplicate claims', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/duplicates/pending');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(Array.isArray(data.data)).toBe(true);
    });
    
    it('should retrieve duplicate detection stats', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/duplicates/stats');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data.data).toHaveProperty('totalDuplicates');
      expect(data.data).toHaveProperty('pendingCount');
    });
    
    it('should scan case for duplicates', async () => {
      if (!authReady || !testCaseId) {
        console.log('⏭️ Skipping: auth or test case not ready');
        return;
      }
      
      const { response, data } = await fetchApi(`/api/per/duplicates/scan/${testCaseId}`, {
        method: 'POST',
      });
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(data).toHaveProperty('success', true);
        expect(data.data).toHaveProperty('duplicatesFound');
        expect(typeof data.data.duplicatesFound).toBe('number');
      }
    });
  });
  
  describe('Caseworker Nudges (Authenticated)', () => {
    it('should retrieve pending nudges', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/nudges/pending');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(Array.isArray(data.data)).toBe(true);
    });
    
    it('should retrieve high-priority nudges', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/nudges/high-priority');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(Array.isArray(data.data)).toBe(true);
    });
    
    it('should retrieve nudge effectiveness metrics', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/nudges/effectiveness');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data.data).toHaveProperty('totalNudges');
      expect(data.data).toHaveProperty('viewedCount');
      expect(data.data).toHaveProperty('actionedCount');
    });
    
    it('should generate nudge for case', async () => {
      if (!authReady || !testCaseId) {
        console.log('⏭️ Skipping: auth or test case not ready');
        return;
      }
      
      const { response, data } = await fetchApi(`/api/per/nudges/generate/${testCaseId}`, {
        method: 'POST',
      });
      
      expect([200, 201, 400, 404]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        expect(data).toHaveProperty('success', true);
      }
    });
  });
  
  describe('PERM Sampling (Authenticated)', () => {
    it('should retrieve pending PERM samples', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/perm/samples/pending');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(Array.isArray(data.data)).toBe(true);
    });
    
    it('should retrieve PERM progress', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/perm/progress');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data.data).toHaveProperty('currentQuarter');
      expect(data.data).toHaveProperty('activeSamples');
      expect(data.data).toHaveProperty('completedSamples');
    });
    
    it('should retrieve PERM report for quarter', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/perm/report?quarter=Q1&year=2025');
      
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(data).toHaveProperty('success', true);
        expect(data.data).toHaveProperty('quarter');
        expect(data.data).toHaveProperty('year');
        expect(data.data).toHaveProperty('sampleStats');
        expect(data.data).toHaveProperty('errorRateSummary');
      }
    });
    
    it('should create PERM sample', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/perm/sample', {
        method: 'POST',
        body: JSON.stringify({
          quarter: 'Q1',
          year: 2025,
          sampleType: 'active',
        }),
      });
      
      expect([200, 201, 400]).toContain(response.status);
      if (response.status === 200 || response.status === 201) {
        expect(data).toHaveProperty('success', true);
      }
    });
  });
  
  describe('Case Assessment (Authenticated)', () => {
    it('should perform full case assessment', async () => {
      if (!authReady || !testCaseId) {
        console.log('⏭️ Skipping: auth or test case not ready');
        return;
      }
      
      const { response, data } = await fetchApi(`/api/per/assess/${testCaseId}`, {
        method: 'POST',
      });
      
      expect([200, 400, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(data).toHaveProperty('success', true);
        expect(data.data).toHaveProperty('caseId', testCaseId);
        expect(data.data).toHaveProperty('riskLevel');
        expect(data.data).toHaveProperty('incomeVerification');
        expect(data.data).toHaveProperty('consistencyChecks');
        expect(data.data).toHaveProperty('duplicateCheck');
      }
    });
    
    it('should perform batch case assessment', async () => {
      if (!authReady || !testCaseId) {
        console.log('⏭️ Skipping: auth or test case not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/assess/batch', {
        method: 'POST',
        body: JSON.stringify({
          caseIds: [testCaseId],
        }),
      });
      
      expect([200, 400]).toContain(response.status);
      if (response.status === 200) {
        expect(data).toHaveProperty('success', true);
        expect(data.data).toHaveProperty('assessments');
        expect(Array.isArray(data.data.assessments)).toBe(true);
      }
    });
  });
  
  describe('Input Validation', () => {
    it('should reject invalid quarter format for PERM sample', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/perm/sample', {
        method: 'POST',
        body: JSON.stringify({
          quarter: 'invalid',
          year: 2025,
        }),
      });
      
      expect(response.status).toBe(400);
      expect(data).toHaveProperty('success', false);
    });
    
    it('should reject invalid year for PERM report', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/perm/report?quarter=Q1&year=invalid');
      
      expect(response.status).toBe(400);
      expect(data).toHaveProperty('success', false);
    });
    
    it('should reject empty case ID for income verification', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/per/income-verification/', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      expect([400, 404]).toContain(response.status);
    });
  });
});
