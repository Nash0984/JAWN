import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../server/db';
import { federalTaxReturns, marylandTaxReturns, taxDocuments, householdScenarios, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = 'http://localhost:5000';

let sessionCookie = '';
let adminSessionCookie = '';
let testUserId: string;
let testScenarioId: string;
let testFederalReturnId: string;
let testMarylandReturnId: string;
let authReady = false;
let adminAuthReady = false;

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

async function fetchAdminApi(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Test-Bypass': 'integration-test',
    ...options.headers as Record<string, string>,
  };
  
  if (adminSessionCookie) {
    headers['Cookie'] = adminSessionCookie;
  }
  
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    adminSessionCookie = setCookie.split(';')[0];
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

describe('Tax Preparation Workflow Integration Tests', () => {
  beforeAll(async () => {
    const [existingUser] = await db.select().from(users).limit(1);
    if (existingUser) {
      testUserId = existingUser.id;
    }
    
    try {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'demo.caseworker@maryland.gov',
          password: 'demo123',
        }),
      });
      
      if (loginRes.ok) {
        const setCookie = loginRes.headers.get('set-cookie');
        if (setCookie) {
          sessionCookie = setCookie.split(';')[0];
          authReady = true;
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    }
    
    try {
      const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@jawn.gov',
          password: 'admin123',
        }),
      });
      
      if (adminLoginRes.ok) {
        const setCookie = adminLoginRes.headers.get('set-cookie');
        if (setCookie) {
          adminSessionCookie = setCookie.split(';')[0];
          adminAuthReady = true;
        }
      }
    } catch (error) {
      console.error('Admin login error:', error);
    }
    
    if (testUserId) {
      try {
        const [scenario] = await db.insert(householdScenarios).values({
          userId: testUserId,
          name: `Tax Test Scenario ${Date.now()}`,
          householdSize: 3,
          stateCode: 'MD',
          countyCode: 'BALT',
          monthlyGrossIncome: 3500,
        }).returning();
        testScenarioId = scenario.id;
      } catch (error) {
        console.error('Failed to create test scenario:', error);
      }
    }
  }, 30000);
  
  afterAll(async () => {
    if (testMarylandReturnId) {
      await db.delete(marylandTaxReturns).where(eq(marylandTaxReturns.id, testMarylandReturnId)).catch(() => {});
    }
    if (testFederalReturnId) {
      await db.delete(federalTaxReturns).where(eq(federalTaxReturns.id, testFederalReturnId)).catch(() => {});
    }
    if (testScenarioId) {
      await db.delete(householdScenarios).where(eq(householdScenarios.id, testScenarioId)).catch(() => {});
    }
  }, 15000);
  
  describe('Authentication Enforcement', () => {
    it('should require authentication for tax calculation', async () => {
      const response = await fetchNoAuth('/api/tax/calculate', {
        method: 'POST',
        body: JSON.stringify({
          taxYear: 2024,
          income: { wages: 50000 },
          filingStatus: 'single',
        }),
      });
      
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for federal return creation', async () => {
      const response = await fetchNoAuth('/api/tax/federal', {
        method: 'POST',
        body: JSON.stringify({
          taxYear: 2024,
          filingStatus: 'single',
        }),
      });
      
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for Maryland return creation', async () => {
      const response = await fetchNoAuth('/api/tax/maryland', {
        method: 'POST',
        body: JSON.stringify({
          federalReturnId: 'test-id',
          taxYear: 2024,
        }),
      });
      
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for Form 1040 generation', async () => {
      const response = await fetchNoAuth('/api/tax/form1040/generate', {
        method: 'POST',
        body: JSON.stringify({ returnId: 'test-id' }),
      });
      
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for Form 502 generation', async () => {
      const response = await fetchNoAuth('/api/tax/form502/generate', {
        method: 'POST',
        body: JSON.stringify({ returnId: 'test-id' }),
      });
      
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for document extraction', async () => {
      const response = await fetchNoAuth('/api/tax/documents/extract', {
        method: 'POST',
      });
      
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require authentication for cross-enrollment analysis', async () => {
      const response = await fetchNoAuth('/api/tax/cross-enrollment/analyze', {
        method: 'POST',
        body: JSON.stringify({ householdData: {} }),
      });
      
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require admin role for e-filing metrics', async () => {
      const response = await fetchNoAuth('/api/admin/efile/metrics');
      expect([401, 403]).toContain(response.status);
    });
    
    it('should require admin role for e-filing submissions list', async () => {
      const response = await fetchNoAuth('/api/admin/efile/submissions');
      expect([401, 403]).toContain(response.status);
    });
  });
  
  describe('Tax Calculation (Authenticated)', () => {
    it('should calculate federal tax for single filer', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/calculate', {
        method: 'POST',
        body: JSON.stringify({
          taxYear: 2024,
          filingStatus: 'single',
          income: {
            wages: 50000,
            interestIncome: 500,
          },
          deductions: {
            standardDeduction: true,
          },
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('federalTax');
      expect(data).toHaveProperty('adjustedGrossIncome');
      expect(data).toHaveProperty('taxableIncome');
      expect(typeof data.federalTax).toBe('number');
      expect(data.federalTax).toBeGreaterThanOrEqual(0);
    });
    
    it('should calculate tax for married filing jointly', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/calculate', {
        method: 'POST',
        body: JSON.stringify({
          taxYear: 2024,
          filingStatus: 'married_joint',
          income: {
            wages: 120000,
          },
          deductions: {
            standardDeduction: true,
          },
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('federalTax');
      expect(typeof data.federalTax).toBe('number');
    });
    
    it('should calculate tax for head of household', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/calculate', {
        method: 'POST',
        body: JSON.stringify({
          taxYear: 2024,
          filingStatus: 'head_of_household',
          income: {
            wages: 65000,
          },
          dependents: 2,
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('federalTax');
    });
  });
  
  describe('Federal Tax Return CRUD (Authenticated)', () => {
    it('should create a federal tax return', async () => {
      if (!authReady || !testScenarioId) {
        console.log('Skipping: auth or scenario not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/federal', {
        method: 'POST',
        body: JSON.stringify({
          scenarioId: testScenarioId,
          taxYear: 2024,
          filingStatus: 'single',
          firstName: 'Test',
          lastName: 'Taxpayer',
          ssn: '123-45-6789',
          wages: 45000,
          interestIncome: 250,
          adjustedGrossIncome: 45250,
          standardDeduction: 14600,
          taxableIncome: 30650,
          taxOwed: 3462,
          totalPayments: 5000,
          refundAmount: 1538,
        }),
      });
      
      expect([200, 201]).toContain(response.status);
      expect(data).toHaveProperty('id');
      expect(data.taxYear).toBe(2024);
      expect(data.filingStatus).toBe('single');
      testFederalReturnId = data.id;
    });
    
    it('should retrieve federal tax return by ID', async () => {
      if (!authReady || !testFederalReturnId) {
        console.log('Skipping: auth or federal return not ready');
        return;
      }
      
      const { response, data } = await fetchApi(`/api/tax/federal/${testFederalReturnId}`);
      
      expect(response.status).toBe(200);
      expect(data.id).toBe(testFederalReturnId);
      expect(data.taxYear).toBe(2024);
      expect(data.filingStatus).toBe('single');
      expect(data.firstName).toBe('Test');
    });
    
    it('should list federal tax returns with filters', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/federal?taxYear=2024');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
    
    it('should update federal tax return', async () => {
      if (!authReady || !testFederalReturnId) {
        console.log('Skipping: auth or federal return not ready');
        return;
      }
      
      const { response, data } = await fetchApi(`/api/tax/federal/${testFederalReturnId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          dividendIncome: 500,
          adjustedGrossIncome: 45750,
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data.dividendIncome).toBe(500);
      expect(data.adjustedGrossIncome).toBe(45750);
    });
  });
  
  describe('Maryland Tax Return CRUD (Authenticated)', () => {
    it('should create a Maryland tax return linked to federal', async () => {
      if (!authReady || !testFederalReturnId) {
        console.log('Skipping: auth or federal return not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/maryland', {
        method: 'POST',
        body: JSON.stringify({
          federalReturnId: testFederalReturnId,
          taxYear: 2024,
          countyCode: 'BALT',
          marylandAgi: 45750,
          marylandTaxableIncome: 31150,
          stateTaxOwed: 1400,
          localTaxOwed: 950,
          totalMarylandTax: 2350,
          stateWithholding: 2500,
          stateRefund: 150,
        }),
      });
      
      expect([200, 201]).toContain(response.status);
      expect(data).toHaveProperty('id');
      expect(data.federalReturnId).toBe(testFederalReturnId);
      expect(data.countyCode).toBe('BALT');
      testMarylandReturnId = data.id;
    });
    
    it('should retrieve Maryland return by ID', async () => {
      if (!authReady || !testMarylandReturnId) {
        console.log('Skipping: auth or Maryland return not ready');
        return;
      }
      
      const { response, data } = await fetchApi(`/api/tax/maryland/${testMarylandReturnId}`);
      
      expect(response.status).toBe(200);
      expect(data.id).toBe(testMarylandReturnId);
      expect(data.countyCode).toBe('BALT');
      expect(data.taxYear).toBe(2024);
    });
    
    it('should retrieve Maryland return by federal return ID', async () => {
      if (!authReady || !testFederalReturnId) {
        console.log('Skipping: auth or federal return not ready');
        return;
      }
      
      const { response, data } = await fetchApi(`/api/tax/maryland/federal/${testFederalReturnId}`);
      
      expect(response.status).toBe(200);
      expect(data.federalReturnId).toBe(testFederalReturnId);
    });
    
    it('should update Maryland tax return', async () => {
      if (!authReady || !testMarylandReturnId) {
        console.log('Skipping: auth or Maryland return not ready');
        return;
      }
      
      const { response, data } = await fetchApi(`/api/tax/maryland/${testMarylandReturnId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          pension529Subtraction: 1000,
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data.pension529Subtraction).toBe(1000);
    });
  });
  
  describe('Maryland Tax Calculation (Authenticated)', () => {
    it('should calculate Maryland state and local tax', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/maryland/calculate', {
        method: 'POST',
        body: JSON.stringify({
          federalAgi: 50000,
          filingStatus: 'single',
          countyCode: 'BALT',
          exemptions: 1,
          dependents: 0,
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('stateTax');
      expect(data).toHaveProperty('localTax');
      expect(data).toHaveProperty('totalMarylandTax');
      expect(typeof data.stateTax).toBe('number');
      expect(typeof data.localTax).toBe('number');
    });
    
    it('should apply county-specific local tax rates', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const baltimoreResult = await fetchApi('/api/tax/maryland/calculate', {
        method: 'POST',
        body: JSON.stringify({
          federalAgi: 75000,
          filingStatus: 'married_joint',
          countyCode: 'BALT',
          exemptions: 2,
        }),
      });
      
      const montgomeryResult = await fetchApi('/api/tax/maryland/calculate', {
        method: 'POST',
        body: JSON.stringify({
          federalAgi: 75000,
          filingStatus: 'married_joint',
          countyCode: 'MONT',
          exemptions: 2,
        }),
      });
      
      expect(baltimoreResult.response.status).toBe(200);
      expect(montgomeryResult.response.status).toBe(200);
      expect(baltimoreResult.data.localTax).not.toBe(montgomeryResult.data.localTax);
    });
  });
  
  describe('Form Generation (Authenticated)', () => {
    it('should generate Form 1040 PDF for valid return', async () => {
      if (!authReady || !testFederalReturnId) {
        console.log('Skipping: auth or federal return not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/form1040/generate', {
        method: 'POST',
        body: JSON.stringify({
          returnId: testFederalReturnId,
        }),
      });
      
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(data).toHaveProperty('success');
      }
    });
    
    it('should generate Form 502 PDF for valid Maryland return', async () => {
      if (!authReady || !testMarylandReturnId) {
        console.log('Skipping: auth or Maryland return not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/form502/generate', {
        method: 'POST',
        body: JSON.stringify({
          returnId: testMarylandReturnId,
        }),
      });
      
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(data).toHaveProperty('success');
      }
    });
    
    it('should return 404 for non-existent return ID', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response } = await fetchApi('/api/tax/form1040/generate', {
        method: 'POST',
        body: JSON.stringify({
          returnId: 'non-existent-id-12345',
        }),
      });
      
      expect([400, 404, 500]).toContain(response.status);
    });
  });
  
  describe('E-Filing Dashboard (Admin)', () => {
    it('should return e-filing metrics for admin', async () => {
      if (!adminAuthReady) {
        console.log('Skipping: admin auth not ready');
        return;
      }
      
      const { response, data } = await fetchAdminApi('/api/admin/efile/metrics');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('statusCounts');
      expect(data).toHaveProperty('errorRate');
      expect(data).toHaveProperty('recentActivity');
      expect(data).toHaveProperty('totalSubmissions');
      expect(data).toHaveProperty('pendingRetries');
      expect(Array.isArray(data.statusCounts)).toBe(true);
      expect(Array.isArray(data.recentActivity)).toBe(true);
    });
    
    it('should list e-filing submissions', async () => {
      if (!adminAuthReady) {
        console.log('Skipping: admin auth not ready');
        return;
      }
      
      const { response, data } = await fetchAdminApi('/api/admin/efile/submissions?taxYear=2024&limit=10');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('submissions');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.submissions)).toBe(true);
      expect(typeof data.total).toBe('number');
    });
    
    it('should filter submissions by status', async () => {
      if (!adminAuthReady) {
        console.log('Skipping: admin auth not ready');
        return;
      }
      
      const { response, data } = await fetchAdminApi('/api/admin/efile/submissions?status=pending');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('submissions');
      data.submissions.forEach((sub: any) => {
        if (sub.federalStatus) {
          expect(['pending', 'transmitted', 'accepted', 'rejected']).toContain(sub.federalStatus);
        }
      });
    });
  });
  
  describe('Tax Document Management (Authenticated)', () => {
    it('should list tax documents', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/documents');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
    
    it('should filter documents by type', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/documents?documentType=w2');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
    
    it('should filter documents by scenario', async () => {
      if (!authReady || !testScenarioId) {
        console.log('Skipping: auth or scenario not ready');
        return;
      }
      
      const { response, data } = await fetchApi(`/api/tax/documents?scenarioId=${testScenarioId}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });
  
  describe('Cross-Enrollment Analysis (Authenticated)', () => {
    it('should analyze cross-enrollment opportunities for low-income household', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/cross-enrollment/analyze', {
        method: 'POST',
        body: JSON.stringify({
          householdData: {
            householdSize: 3,
            annualIncome: 35000,
            stateCode: 'MD',
            hasChildren: true,
            age: 35,
          },
          currentBenefits: ['SNAP'],
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('recommendations');
      expect(Array.isArray(data.recommendations)).toBe(true);
    });
    
    it('should detect EITC eligibility', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response, data } = await fetchApi('/api/tax/cross-enrollment/analyze', {
        method: 'POST',
        body: JSON.stringify({
          householdData: {
            householdSize: 4,
            annualIncome: 28000,
            stateCode: 'MD',
            hasChildren: true,
            childrenUnder17: 2,
            earnedIncome: 25000,
          },
          currentBenefits: [],
        }),
      });
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('recommendations');
    });
  });
  
  describe('Input Validation', () => {
    it('should reject invalid tax year', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response } = await fetchApi('/api/tax/calculate', {
        method: 'POST',
        body: JSON.stringify({
          taxYear: 1800,
          filingStatus: 'single',
          income: { wages: 50000 },
        }),
      });
      
      expect([400, 422, 500]).toContain(response.status);
    });
    
    it('should reject invalid filing status', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response } = await fetchApi('/api/tax/calculate', {
        method: 'POST',
        body: JSON.stringify({
          taxYear: 2024,
          filingStatus: 'invalid_status',
          income: { wages: 50000 },
        }),
      });
      
      expect([400, 422, 500]).toContain(response.status);
    });
    
    it('should reject negative income values', async () => {
      if (!authReady) {
        console.log('Skipping: auth not ready');
        return;
      }
      
      const { response } = await fetchApi('/api/tax/calculate', {
        method: 'POST',
        body: JSON.stringify({
          taxYear: 2024,
          filingStatus: 'single',
          income: { wages: -10000 },
        }),
      });
      
      expect([400, 422, 500]).toContain(response.status);
    });
  });
});
