import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Test-Bypass': 'integration-test',
      ...options.headers
    }
  });
  return response;
}

describe('State Rules Engine Integration Tests', () => {
  describe('Supported States Endpoint', () => {
    it('should return list of supported states', async () => {
      const response = await fetchApi('/api/state-rules/supported-states');
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.states).toHaveLength(3);
      expect(data.data.states.map((s: any) => s.code)).toContain('UT');
      expect(data.data.states.map((s: any) => s.code)).toContain('IN');
      expect(data.data.states.map((s: any) => s.code)).toContain('MI');
    });

    it('should list supported programs', async () => {
      const response = await fetchApi('/api/state-rules/supported-states');
      const data = await response.json();
      
      expect(data.data.programs).toHaveLength(3);
      expect(data.data.programs.map((p: any) => p.code)).toEqual(['SNAP', 'TANF', 'MEDICAID']);
    });
  });

  describe('Utah SNAP Eligibility', () => {
    it('should calculate eligibility for low-income household', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'UT',
          program: 'SNAP',
          householdSize: 3,
          grossMonthlyIncome: 150000,
          earnedIncome: 150000,
          unearnedIncome: 0
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.stateCode).toBe('UT');
      expect(data.data.program).toBe('SNAP');
      expect(data.data.isEligible).toBe(true);
      expect(data.data.monthlyBenefit).toBeGreaterThan(0);
    });

    it('should reject high-income household', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'UT',
          program: 'SNAP',
          householdSize: 2,
          grossMonthlyIncome: 500000,
          earnedIncome: 500000,
          unearnedIncome: 0
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.isEligible).toBe(false);
      expect(data.data.ineligibilityReasons).toBeDefined();
    });

    it('should enforce asset test for Utah SNAP', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'UT',
          program: 'SNAP',
          householdSize: 2,
          grossMonthlyIncome: 100000,
          earnedIncome: 100000,
          unearnedIncome: 0,
          assets: 500000
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.isEligible).toBe(false);
      expect(data.data.assetTest?.passed).toBe(false);
    });
  });

  describe('Utah TANF Eligibility', () => {
    it('should calculate FEP eligibility with children', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'UT',
          program: 'TANF',
          householdSize: 3,
          grossMonthlyIncome: 50000,
          earnedIncome: 50000,
          unearnedIncome: 0,
          childrenUnder18: 2
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.stateProgramName).toContain('Family Employment Program');
      expect(data.data.isEligible).toBe(true);
    });

    it('should reject TANF without children', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'UT',
          program: 'TANF',
          householdSize: 1,
          grossMonthlyIncome: 30000,
          earnedIncome: 30000,
          unearnedIncome: 0,
          childrenUnder18: 0,
          isPregnant: false
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.isEligible).toBe(false);
      expect(data.data.ineligibilityReasons).toContain('TANF requires dependent children');
    });
  });

  describe('Utah Medicaid Eligibility', () => {
    it('should calculate adult expansion eligibility', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'UT',
          program: 'MEDICAID',
          householdSize: 1,
          grossMonthlyIncome: 100000,
          earnedIncome: 100000,
          unearnedIncome: 0
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.stateCode).toBe('UT');
      expect(data.data.program).toBe('MEDICAID');
    });

    it('should use higher limit for pregnant women', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'UT',
          program: 'MEDICAID',
          householdSize: 2,
          grossMonthlyIncome: 200000,
          earnedIncome: 0,
          unearnedIncome: 200000,
          isPregnant: true
        })
      });
      
      const data = await response.json();
      expect(data.data.calculationBreakdown).toContain('Category: Pregnant Women');
    });
  });

  describe('Indiana SNAP Eligibility', () => {
    it('should calculate eligibility without BBCE', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'IN',
          program: 'SNAP',
          householdSize: 4,
          grossMonthlyIncome: 200000,
          earnedIncome: 200000,
          unearnedIncome: 0
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.stateCode).toBe('IN');
      expect(data.data.stateProgramName).toBe('Indiana SNAP');
    });

    it('should enforce strict asset test', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'IN',
          program: 'SNAP',
          householdSize: 2,
          grossMonthlyIncome: 100000,
          earnedIncome: 100000,
          unearnedIncome: 0,
          assets: 300000
        })
      });
      
      const data = await response.json();
      expect(data.data.assetTest).toBeDefined();
    });
  });

  describe('Indiana TANF Eligibility', () => {
    it('should calculate TANF Assistance Grant eligibility', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'IN',
          program: 'TANF',
          householdSize: 3,
          grossMonthlyIncome: 30000,
          earnedIncome: 30000,
          unearnedIncome: 0,
          childrenUnder18: 2
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.stateProgramName).toContain('Indiana TANF');
      expect(data.data.isEligible).toBe(true);
    });
  });

  describe('Indiana Medicaid Eligibility', () => {
    it('should calculate HIP 2.0 eligibility', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'IN',
          program: 'MEDICAID',
          householdSize: 1,
          grossMonthlyIncome: 100000,
          earnedIncome: 100000,
          unearnedIncome: 0
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.stateProgramName).toContain('Healthy Indiana Plan');
    });
  });

  describe('Michigan SNAP Eligibility', () => {
    it('should use BBCE with 200% FPL limit', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'MI',
          program: 'SNAP',
          householdSize: 3,
          grossMonthlyIncome: 350000,
          earnedIncome: 350000,
          unearnedIncome: 0
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.stateProgramName).toContain('Food Assistance Program');
      expect(data.data.incomeTest.grossLimit).toBeGreaterThan(300000);
    });

    it('should not enforce asset test (BBCE)', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'MI',
          program: 'SNAP',
          householdSize: 2,
          grossMonthlyIncome: 200000,
          earnedIncome: 200000,
          unearnedIncome: 0,
          assets: 1000000
        })
      });
      
      const data = await response.json();
      expect(data.data.assetTest).toBeUndefined();
    });
  });

  describe('Michigan TANF Eligibility', () => {
    it('should calculate FIP eligibility', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'MI',
          program: 'TANF',
          householdSize: 4,
          grossMonthlyIncome: 50000,
          earnedIncome: 50000,
          unearnedIncome: 0,
          childrenUnder18: 2
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.stateProgramName).toContain('Family Independence Program');
    });
  });

  describe('Michigan Medicaid Eligibility', () => {
    it('should calculate Healthy Michigan Plan eligibility', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'MI',
          program: 'MEDICAID',
          householdSize: 1,
          grossMonthlyIncome: 140000,
          earnedIncome: 140000,
          unearnedIncome: 0
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.stateProgramName).toContain('Healthy Michigan');
    });
  });

  describe('Batch Calculation', () => {
    it('should calculate eligibility for multiple households', async () => {
      const response = await fetchApi('/api/state-rules/batch-calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'UT',
          programs: ['SNAP', 'MEDICAID'],
          households: [
            {
              id: 'hh1',
              householdSize: 2,
              grossMonthlyIncome: 100000,
              earnedIncome: 100000
            },
            {
              id: 'hh2',
              householdSize: 4,
              grossMonthlyIncome: 200000,
              earnedIncome: 150000,
              unearnedIncome: 50000
            }
          ]
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.totalHouseholds).toBe(2);
      expect(data.data.results[0].eligibility.SNAP).toBeDefined();
      expect(data.data.results[0].eligibility.MEDICAID).toBeDefined();
    });

    it('should reject more than 50 households', async () => {
      const households = Array.from({ length: 51 }, (_, i) => ({
        id: `hh${i}`,
        householdSize: 2,
        grossMonthlyIncome: 100000,
        earnedIncome: 100000
      }));
      
      const response = await fetchApi('/api/state-rules/batch-calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'IN',
          households
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Maximum 50');
    });
  });

  describe('Validation', () => {
    it('should reject unsupported state codes', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'XX',
          program: 'SNAP',
          householdSize: 2,
          grossMonthlyIncome: 100000,
          earnedIncome: 100000,
          unearnedIncome: 0
        })
      });
      
      expect(response.status).toBe(400);
    });

    it('should reject invalid program types', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'UT',
          program: 'INVALID',
          householdSize: 2,
          grossMonthlyIncome: 100000,
          earnedIncome: 100000,
          unearnedIncome: 0
        })
      });
      
      expect(response.status).toBe(400);
    });

    it('should reject negative income values', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'UT',
          program: 'SNAP',
          householdSize: 2,
          grossMonthlyIncome: -100,
          earnedIncome: 0,
          unearnedIncome: 0
        })
      });
      
      expect(response.status).toBe(400);
    });

    it('should reject household size of 0', async () => {
      const response = await fetchApi('/api/state-rules/calculate', {
        method: 'POST',
        body: JSON.stringify({
          stateCode: 'MI',
          program: 'SNAP',
          householdSize: 0,
          grossMonthlyIncome: 100000,
          earnedIncome: 100000,
          unearnedIncome: 0
        })
      });
      
      expect(response.status).toBe(400);
    });
  });
});
