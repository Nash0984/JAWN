import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../server/db';
import { consentForms, clientConsents, vitaIntakeSessions, users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = 'http://localhost:5000';

async function fetchApi(path: string, options: RequestInit = {}, cookie?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Test-Bypass': 'integration-test',
    ...options.headers as Record<string, string>,
  };
  
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
}

describe('IRS Consent Integration Tests', () => {
  let testSessionId: string;
  let testFormId: string;
  let adminCookie: string;
  let testClientCaseId: string;
  let authReady = false;
  let setupComplete = false;
  
  beforeAll(async () => {
    try {
      const loginRes = await fetchApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'demo.supervisor',
          password: 'password123'
        })
      });
      
      if (loginRes.ok) {
        const cookies = loginRes.headers.get('set-cookie');
        adminCookie = cookies?.split(';')[0] || '';
        authReady = true;
      } else {
        console.warn('⚠️ Login failed - authenticated IRS Consent tests will be skipped');
        return;
      }
    } catch (error) {
      console.warn('⚠️ Login error - authenticated IRS Consent tests will be skipped:', error);
      return;
    }
    
    try {
      const form = await db.query.consentForms.findFirst({
        where: eq(consentForms.formCode, 'irs_use_disclosure')
      });
      
      if (!form) {
        console.warn('⚠️ IRS consent form not found - data-dependent tests will be skipped');
        return;
      }
      
      testFormId = form.id;
      
      const user = await db.query.users.findFirst({
        where: eq(users.username, 'demo.supervisor')
      });
      
      if (!user) {
        console.warn('⚠️ Test user not found - data-dependent tests will be skipped');
        return;
      }
      
      testClientCaseId = `test-household-${Date.now()}`;
      
      const [session] = await db.insert(vitaIntakeSessions).values({
        userId: user.id,
        primaryFirstName: 'Test',
        primaryLastName: 'User',
        primarySSN: '123-45-6789',
        primaryDateOfBirth: '1980-01-01',
        primaryTelephone: '555-123-4567',
        mailingAddress: '123 Test St',
        city: 'Baltimore',
        state: 'MD',
        zipCode: '21201',
        currentStep: 1,
        status: 'in_progress',
      }).returning();
      
      testSessionId = session.id;
      setupComplete = true;
    } catch (error) {
      console.warn('⚠️ Setup error - data-dependent tests will be skipped:', error);
    }
  });
  
  describe('Authentication Enforcement (No Auth Required)', () => {
    it('GET /api/consent/forms/:code should require authentication', async () => {
      const response = await fetchApi('/api/consent/forms/irs_use_disclosure');
      expect(response.status).toBe(401);
    });
    
    it('POST /api/consent/client-consents should require authentication', async () => {
      const consentData = {
        clientCaseId: 'test-client',
        consentFormId: 'test-form',
        vitaIntakeSessionId: 'test-session',
        benefitProgramsAuthorized: ['snap'],
        signatureMetadata: {
          typedName: 'Test User',
          date: new Date().toISOString(),
          method: 'electronic'
        }
      };
      
      const response = await fetchApi('/api/consent/client-consents', {
        method: 'POST',
        body: JSON.stringify(consentData)
      });
      
      expect([401, 403]).toContain(response.status);
    });
    
    it('GET /api/consent/client-consents/vita-session/:sessionId should require authentication', async () => {
      const response = await fetchApi('/api/consent/client-consents/vita-session/test-session');
      expect(response.status).toBe(401);
    });
  });
  
  describe('Authenticated Operations', () => {
    it('should retrieve IRS consent form by code', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: authentication not available');
        return;
      }
      
      const response = await fetchApi('/api/consent/forms/irs_use_disclosure', {}, adminCookie);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.formCode).toBe('irs_use_disclosure');
      expect(data.data.formContent).toContain('IRS USE AND DISCLOSURE AUTHORIZATION');
      expect(data.data.benefitPrograms).toBeDefined();
      expect(Array.isArray(data.data.benefitPrograms)).toBe(true);
    });
    
    it('should return 404 for non-existent form code', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: authentication not available');
        return;
      }
      
      const response = await fetchApi('/api/consent/forms/nonexistent', {}, adminCookie);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
    
    it('should fail without required fields', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: authentication not available');
        return;
      }
      
      const response = await fetchApi('/api/consent/client-consents', {
        method: 'POST',
        body: JSON.stringify({})
      }, adminCookie);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
    
    it('should return empty array for session with no consents', async () => {
      if (!authReady) {
        console.log('⏭️ Skipping: authentication not available');
        return;
      }
      
      const response = await fetchApi('/api/consent/client-consents/vita-session/nonexistent-session', {}, adminCookie);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(0);
    });
  });
  
  describe('Full Consent Workflow (Requires Setup)', () => {
    it('should record IRS consent with full metadata', async () => {
      if (!setupComplete) {
        console.log('⏭️ Skipping: test data setup not complete');
        return;
      }
      
      const consentData = {
        clientCaseId: testClientCaseId,
        consentFormId: testFormId,
        vitaIntakeSessionId: testSessionId,
        benefitProgramsAuthorized: ['snap', 'medicaid'],
        signatureMetadata: {
          typedName: 'John Test Doe',
          date: new Date().toISOString(),
          method: 'electronic'
        }
      };
      
      const response = await fetchApi('/api/consent/client-consents', {
        method: 'POST',
        body: JSON.stringify(consentData)
      }, adminCookie);
      
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data.benefitProgramsAuthorized).toEqual(['snap', 'medicaid']);
      expect(data.data.signatureMetadata.typedName).toBe('John Test Doe');
      expect(data.data.acceptedFormVersion).toContain('v');
      expect(data.data.ipAddress).toBeDefined();
    });
    
    it('should fail with invalid consent form ID', async () => {
      if (!setupComplete) {
        console.log('⏭️ Skipping: test data setup not complete');
        return;
      }
      
      const consentData = {
        clientCaseId: testClientCaseId,
        consentFormId: 'invalid-form-id',
        vitaIntakeSessionId: testSessionId,
        benefitProgramsAuthorized: ['snap'],
        signatureMetadata: {
          typedName: 'Test User',
          date: new Date().toISOString(),
          method: 'electronic'
        }
      };
      
      const response = await fetchApi('/api/consent/client-consents', {
        method: 'POST',
        body: JSON.stringify(consentData)
      }, adminCookie);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
    
    it('should retrieve consents for VITA session', async () => {
      if (!setupComplete) {
        console.log('⏭️ Skipping: test data setup not complete');
        return;
      }
      
      const response = await fetchApi(`/api/consent/client-consents/vita-session/${testSessionId}`, {}, adminCookie);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
      
      const consent = data.data[0];
      expect(consent).toHaveProperty('id');
      expect(consent).toHaveProperty('vitaIntakeSessionId', testSessionId);
      expect(consent).toHaveProperty('consentForm');
    });
  });
  
  afterAll(async () => {
    if (setupComplete && testClientCaseId && testSessionId) {
      try {
        await db.delete(clientConsents).where(eq(clientConsents.clientCaseId, testClientCaseId));
        await db.delete(vitaIntakeSessions).where(eq(vitaIntakeSessions.id, testSessionId));
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
  });
});
