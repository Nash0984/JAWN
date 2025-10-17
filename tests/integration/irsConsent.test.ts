import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../server/db';
import { consentForms, clientConsents, vitaIntakeSessions, users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('IRS Consent Integration Tests', () => {
  let testSessionId: string;
  let testFormId: string;
  let adminCookie: string;
  let testClientCaseId: string;
  
  beforeAll(async () => {
    // Login as admin to get session cookie
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'demo.supervisor',
        password: 'password123'
      })
    });
    
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }
    
    const cookies = loginRes.headers.get('set-cookie');
    adminCookie = cookies?.split(';')[0] || '';
    
    // Get IRS consent form
    const form = await db.query.consentForms.findFirst({
      where: eq(consentForms.formCode, 'irs_use_disclosure')
    });
    
    if (!form) {
      throw new Error('IRS consent form not found in database');
    }
    
    testFormId = form.id;
    
    // Create a test VITA session for testing
    const user = await db.query.users.findFirst({
      where: eq(users.username, 'demo.supervisor')
    });
    
    if (!user) {
      throw new Error('Test user not found');
    }
    
    // Create test client case ID
    testClientCaseId = `test-household-${Date.now()}`;
    
    // Create a test VITA session
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
  });
  
  describe('GET /api/consent/forms/:code', () => {
    it('should retrieve IRS consent form by code', async () => {
      const response = await fetch('http://localhost:5000/api/consent/forms/irs_use_disclosure', {
        headers: { Cookie: adminCookie }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.formCode).toBe('irs_use_disclosure');
      expect(data.data.formContent).toContain('IRS USE AND DISCLOSURE AUTHORIZATION');
      
      // Verify it includes benefit programs
      expect(data.data.benefitPrograms).toBeDefined();
      expect(Array.isArray(data.data.benefitPrograms)).toBe(true);
    });
    
    it('should return 404 for non-existent form code', async () => {
      const response = await fetch('http://localhost:5000/api/consent/forms/nonexistent', {
        headers: { Cookie: adminCookie }
      });
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
    
    it('should require authentication', async () => {
      const response = await fetch('http://localhost:5000/api/consent/forms/irs_use_disclosure');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('POST /api/consent/client-consents', () => {
    it('should record IRS consent with full metadata', async () => {
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
      
      const response = await fetch('http://localhost:5000/api/consent/client-consents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie
        },
        body: JSON.stringify(consentData)
      });
      
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data.benefitProgramsAuthorized).toEqual(['snap', 'medicaid']);
      expect(data.data.signatureMetadata.typedName).toBe('John Test Doe');
      expect(data.data.acceptedFormVersion).toContain('v');
      expect(data.data.ipAddress).toBeDefined();
    });
    
    it('should fail without required fields', async () => {
      const response = await fetch('http://localhost:5000/api/consent/client-consents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie
        },
        body: JSON.stringify({})
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
    
    it('should fail with invalid consent form ID', async () => {
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
      
      const response = await fetch('http://localhost:5000/api/consent/client-consents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie
        },
        body: JSON.stringify(consentData)
      });
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
    
    it('should require authentication', async () => {
      const consentData = {
        clientCaseId: testClientCaseId,
        consentFormId: testFormId,
        vitaIntakeSessionId: testSessionId,
        benefitProgramsAuthorized: ['snap'],
        signatureMetadata: {
          typedName: 'Test User',
          date: new Date().toISOString(),
          method: 'electronic'
        }
      };
      
      const response = await fetch('http://localhost:5000/api/consent/client-consents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(consentData)
      });
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('GET /api/consent/client-consents/vita-session/:sessionId', () => {
    it('should retrieve consents for VITA session', async () => {
      const response = await fetch(`http://localhost:5000/api/consent/client-consents/vita-session/${testSessionId}`, {
        headers: { Cookie: adminCookie }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      // Should have at least one consent from previous test
      expect(data.data.length).toBeGreaterThan(0);
      
      // Verify consent structure
      const consent = data.data[0];
      expect(consent).toHaveProperty('id');
      expect(consent).toHaveProperty('vitaIntakeSessionId', testSessionId);
      expect(consent).toHaveProperty('consentForm');
    });
    
    it('should return empty array for session with no consents', async () => {
      const response = await fetch('http://localhost:5000/api/consent/client-consents/vita-session/nonexistent-session', {
        headers: { Cookie: adminCookie }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(0);
    });
    
    it('should require authentication', async () => {
      const response = await fetch(`http://localhost:5000/api/consent/client-consents/vita-session/${testSessionId}`);
      
      expect(response.status).toBe(401);
    });
  });
  
  afterAll(async () => {
    // Clean up test data
    await db.delete(clientConsents).where(eq(clientConsents.clientCaseId, testClientCaseId));
    await db.delete(vitaIntakeSessions).where(eq(vitaIntakeSessions.id, testSessionId));
  });
});
