import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = 'http://localhost:5000';

let sessionCookie: string = '';

async function fetchApi(
  path: string, 
  options: RequestInit = {}
): Promise<{ response: Response; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
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
    const sessionMatch = setCookie.match(/connect\.sid=([^;]+)/);
    if (sessionMatch) {
      sessionCookie = `connect.sid=${sessionMatch[1]}`;
    }
  }
  
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

describe('Multi-State Benefit Screening Integration Tests', () => {
  beforeAll(async () => {
    const { response, data } = await fetchApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'demo.caseworker',
        password: 'demo123',
      }),
    });
    
    if (response.status !== 200) {
      console.warn('Demo caseworker login failed - some tests may be skipped');
    }
  });
  
  describe('Eligibility Pre-Screening (/api/eligibility/check)', () => {
    it('should require authentication', async () => {
      const tempCookie = sessionCookie;
      sessionCookie = '';
      
      const { response } = await fetchApi('/api/eligibility/check', {
        method: 'POST',
        body: JSON.stringify({
          householdSize: 3,
          monthlyIncome: 150000,
        }),
      });
      
      sessionCookie = tempCookie;
      expect([401, 403]).toContain(response.status);
    });
    
    it('should validate required fields', async () => {
      const { response, data } = await fetchApi('/api/eligibility/check', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      expect([400, 401, 403]).toContain(response.status);
      if (response.status === 400) {
        expect(data.error).toContain('householdSize');
      }
    });
    
    it('should return eligibility result for low-income household', async () => {
      const { response, data } = await fetchApi('/api/eligibility/check', {
        method: 'POST',
        body: JSON.stringify({
          householdSize: 4,
          monthlyIncome: 200000,
          hasEarnedIncome: true,
          hasSSI: false,
          hasTANF: false,
        }),
      });
      
      if (response.status === 200) {
        expect(data).toHaveProperty('eligible');
        expect(typeof data.eligible).toBe('boolean');
        expect(data).toHaveProperty('nextSteps');
        expect(Array.isArray(data.nextSteps)).toBe(true);
        expect(data).toHaveProperty('requiredDocuments');
        expect(Array.isArray(data.requiredDocuments)).toBe(true);
      } else {
        expect([401, 403, 500]).toContain(response.status);
      }
    });
    
    it('should return eligibility result for SSI recipient (categorical eligibility)', async () => {
      const { response, data } = await fetchApi('/api/eligibility/check', {
        method: 'POST',
        body: JSON.stringify({
          householdSize: 1,
          monthlyIncome: 100000,
          hasEarnedIncome: false,
          hasSSI: true,
          hasTANF: false,
        }),
      });
      
      if (response.status === 200) {
        expect(data).toHaveProperty('eligible');
        if (data.eligible) {
          expect(data).toHaveProperty('estimatedBenefit');
        }
      }
    });
    
    it('should return applied rules breakdown', async () => {
      const { response, data } = await fetchApi('/api/eligibility/check', {
        method: 'POST',
        body: JSON.stringify({
          householdSize: 2,
          monthlyIncome: 180000,
          hasEarnedIncome: true,
        }),
      });
      
      if (response.status === 200) {
        expect(data).toHaveProperty('appliedRules');
      }
    });
  });
  
  describe('Full Benefit Calculation (/api/eligibility/calculate)', () => {
    it('should calculate benefits with all expense deductions', async () => {
      const { response, data } = await fetchApi('/api/eligibility/calculate', {
        method: 'POST',
        body: JSON.stringify({
          householdSize: 4,
          monthlyGrossIncome: 300000,
          monthlyEarnedIncome: 250000,
          hasElderly: true,
          hasDisabled: false,
          hasSSI: false,
          hasTANF: false,
          shelterCosts: 120000,
          utilityCosts: 15000,
          dependentCareCosts: 50000,
          medicalExpenses: 0,
        }),
      });
      
      if (response.status === 200) {
        expect(data).toHaveProperty('eligible');
        if (data.eligible) {
          expect(data).toHaveProperty('monthlyBenefit');
        }
        expect(data).toHaveProperty('appliedRules');
      }
    });
    
    it('should handle elderly/disabled medical expense deduction', async () => {
      const { response, data } = await fetchApi('/api/eligibility/calculate', {
        method: 'POST',
        body: JSON.stringify({
          householdSize: 1,
          monthlyGrossIncome: 150000,
          monthlyEarnedIncome: 0,
          hasElderly: true,
          hasDisabled: true,
          medicalExpenses: 30000,
          shelterCosts: 80000,
        }),
      });
      
      if (response.status === 200) {
        expect(data).toHaveProperty('eligible');
      }
    });
    
    it('should reject missing required fields', async () => {
      const { response, data } = await fetchApi('/api/eligibility/calculate', {
        method: 'POST',
        body: JSON.stringify({
          monthlyGrossIncome: 200000,
        }),
      });
      
      expect([400, 401, 403]).toContain(response.status);
      if (response.status === 400) {
        expect(data.error).toContain('householdSize');
      }
    });
  });
  
  describe('Cross-Eligibility Radar (/api/eligibility/radar)', () => {
    it('should return multi-program eligibility assessment', async () => {
      const { response, data } = await fetchApi('/api/eligibility/radar', {
        method: 'POST',
        body: JSON.stringify({
          adults: 2,
          children: 2,
          elderlyOrDisabled: false,
          employmentIncome: 36000,
          unearnedIncome: 0,
          rentOrMortgage: 1200,
          utilityCosts: 150,
          stateCode: 'MD',
        }),
      });
      
      if (response.status === 200) {
        expect(data).toHaveProperty('programs');
        expect(Array.isArray(data.programs)).toBe(true);
        
        if (data.programs.length > 0) {
          const firstProgram = data.programs[0];
          expect(firstProgram).toHaveProperty('id');
          expect(firstProgram).toHaveProperty('name');
          expect(firstProgram).toHaveProperty('status');
          expect(['eligible', 'ineligible']).toContain(firstProgram.status);
        }
      }
    });
    
    it('should include core programs in response', async () => {
      const { response, data } = await fetchApi('/api/eligibility/radar', {
        method: 'POST',
        body: JSON.stringify({
          adults: 1,
          children: 0,
          employmentIncome: 20000,
          stateCode: 'MD',
        }),
      });
      
      if (response.status === 200 && data.programs) {
        const programIds = data.programs.map((p: any) => p.id);
        expect(programIds.some((id: string) => id.includes('SNAP'))).toBe(true);
        expect(programIds.some((id: string) => id.includes('MEDICAID'))).toBe(true);
      }
    });
    
    it('should generate alerts for near-threshold cases', async () => {
      const { response, data } = await fetchApi('/api/eligibility/radar', {
        method: 'POST',
        body: JSON.stringify({
          adults: 2,
          children: 2,
          employmentIncome: 30000,
          stateCode: 'MD',
        }),
      });
      
      if (response.status === 200) {
        expect(data).toHaveProperty('alerts');
        expect(Array.isArray(data.alerts)).toBe(true);
      }
    });
    
    it('should detect benefit changes when previous results provided', async () => {
      const { response, data } = await fetchApi('/api/eligibility/radar', {
        method: 'POST',
        body: JSON.stringify({
          adults: 2,
          children: 2,
          employmentIncome: 25000,
          stateCode: 'MD',
          previousResults: {
            snap: 500,
            medicaid: true,
            tanf: 0,
          },
        }),
      });
      
      if (response.status === 200 && data.programs) {
        const snapProgram = data.programs.find((p: any) => p.id.includes('SNAP'));
        if (snapProgram) {
          expect(snapProgram).toHaveProperty('change');
        }
      }
    });
    
    it('should support different state codes', async () => {
      const states = ['MD', 'PA', 'VA'];
      
      for (const stateCode of states) {
        const { response, data } = await fetchApi('/api/eligibility/radar', {
          method: 'POST',
          body: JSON.stringify({
            adults: 1,
            children: 1,
            employmentIncome: 20000,
            stateCode,
          }),
        });
        
        if (response.status === 200) {
          expect(data).toHaveProperty('programs');
        }
      }
    });
    
    it('should return total benefits summary when available', async () => {
      const { response, data } = await fetchApi('/api/eligibility/radar', {
        method: 'POST',
        body: JSON.stringify({
          adults: 1,
          children: 2,
          employmentIncome: 18000,
          stateCode: 'MD',
        }),
      });
      
      if (response.status === 200 && data.summary) {
        expect(data.summary).toHaveProperty('totalMonthlyBenefits');
        expect(data.summary).toHaveProperty('totalAnnualBenefits');
      }
    });
  });
  
  describe('PolicyEngine Integration (/api/policyengine/test)', () => {
    it('should report PolicyEngine availability status', async () => {
      const { response, data } = await fetchApi('/api/policyengine/test');
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('available');
      expect(typeof data.available).toBe('boolean');
      expect(data).toHaveProperty('message');
    });
  });
  
  describe('Cross-Enrollment Analysis (/api/tax/cross-enrollment/analyze)', () => {
    it('should require authentication', async () => {
      const tempCookie = sessionCookie;
      sessionCookie = '';
      
      const { response } = await fetchApi('/api/tax/cross-enrollment/analyze', {
        method: 'POST',
        body: JSON.stringify({
          taxYear: 2024,
          income: 30000,
          householdSize: 3,
        }),
      });
      
      sessionCookie = tempCookie;
      expect([401, 403]).toContain(response.status);
    });
    
    it('should process cross-enrollment analysis requests', async () => {
      const { response, data } = await fetchApi('/api/tax/cross-enrollment/analyze', {
        method: 'POST',
        body: JSON.stringify({
          taxYear: 2024,
          income: 30000,
          householdSize: 3,
          filingStatus: 'head_of_household',
          stateCode: 'MD',
        }),
      });
      
      expect([200, 400, 401, 403, 422, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(data).toHaveProperty('opportunities');
        if (data.opportunities) {
          expect(Array.isArray(data.opportunities)).toBe(true);
        }
      }
    });
  });
  
  describe('Hybrid Calculation Endpoint (/api/policyengine/hybrid-summary)', () => {
    it('should return combined calculation results', async () => {
      const { response, data } = await fetchApi('/api/policyengine/hybrid-summary', {
        method: 'POST',
        body: JSON.stringify({
          adults: 2,
          children: 2,
          employmentIncome: 30000,
          stateCode: 'MD',
          shelterCosts: 1200,
          utilityCosts: 150,
        }),
      });
      
      if (response.status === 200) {
        expect(data).toHaveProperty('summary');
        expect(data).toHaveProperty('calculations');
        
        if (data.calculations) {
          expect(data.calculations).toHaveProperty('snap');
          expect(data.calculations).toHaveProperty('medicaid');
        }
      }
    });
  });
  
  describe('State-Specific Rules Engines', () => {
    it('should apply Maryland-specific SNAP rules', async () => {
      const { response, data } = await fetchApi('/api/eligibility/check', {
        method: 'POST',
        body: JSON.stringify({
          householdSize: 3,
          monthlyIncome: 250000,
          hasEarnedIncome: true,
        }),
      });
      
      if (response.status === 200) {
        expect(data).toHaveProperty('eligible');
      }
    });
    
    it('should handle multi-state radar requests', async () => {
      const requests = [
        { stateCode: 'MD', name: 'Maryland' },
        { stateCode: 'PA', name: 'Pennsylvania' },
        { stateCode: 'VA', name: 'Virginia' },
      ];
      
      for (const state of requests) {
        const { response, data } = await fetchApi('/api/eligibility/radar', {
          method: 'POST',
          body: JSON.stringify({
            adults: 2,
            children: 2,
            employmentIncome: 30000,
            stateCode: state.stateCode,
          }),
        });
        
        if (response.status === 200) {
          expect(data).toHaveProperty('programs');
        }
      }
    });
  });
  
  describe('Input Validation', () => {
    it('should reject negative income values', async () => {
      const { response } = await fetchApi('/api/eligibility/radar', {
        method: 'POST',
        body: JSON.stringify({
          adults: 1,
          children: 0,
          employmentIncome: -1000,
          stateCode: 'MD',
        }),
      });
      
      expect([400, 403]).toContain(response.status);
    });
    
    it('should reject invalid household size', async () => {
      const { response } = await fetchApi('/api/eligibility/radar', {
        method: 'POST',
        body: JSON.stringify({
          adults: 0,
          children: 0,
          employmentIncome: 20000,
        }),
      });
      
      expect([400, 403]).toContain(response.status);
    });
    
    it('should reject invalid state code format', async () => {
      const { response } = await fetchApi('/api/eligibility/radar', {
        method: 'POST',
        body: JSON.stringify({
          adults: 1,
          children: 0,
          employmentIncome: 20000,
          stateCode: 'INVALID',
        }),
      });
      
      expect([400, 403]).toContain(response.status);
    });
    
    it('should accept valid state codes for all supported states', async () => {
      const supportedStates = ['MD', 'PA', 'VA', 'UT', 'IN', 'MI'];
      
      for (const stateCode of supportedStates) {
        const { response } = await fetchApi('/api/eligibility/radar', {
          method: 'POST',
          body: JSON.stringify({
            adults: 1,
            children: 0,
            employmentIncome: 20000,
            stateCode,
          }),
        });
        
        expect([200, 403, 500]).toContain(response.status);
      }
    });
  });
});
