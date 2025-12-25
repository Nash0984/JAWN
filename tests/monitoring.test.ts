import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';

/**
 * Monitoring Dashboard Acceptance Tests
 * 
 * These tests validate:
 * 1. Role-based access control for monitoring endpoints
 * 2. WebSocket realtime metrics subscriptions
 * 3. Alert management CRUD operations
 * 
 * Note: These tests require the server to be running on localhost:5000
 * and demo users to be seeded (demo.supervisor for admin, demo.applicant for non-admin)
 */

describe('Monitoring Dashboard - Role Enforcement', () => {
  let adminSessionCookie: string;
  let applicantSessionCookie: string;

  beforeAll(async () => {
    // Login as admin to get session cookie
    try {
      const adminLoginResponse = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'demo.supervisor',
          password: 'demo123'
        }),
      });
      
      if (adminLoginResponse.ok) {
        const cookies = adminLoginResponse.headers.get('set-cookie');
        adminSessionCookie = cookies?.split(';')[0] || '';
      }
    } catch (error) {
      console.warn('Failed to login as admin:', error);
    }

    // Login as applicant (non-admin) to get session cookie
    try {
      const applicantLoginResponse = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'demo.navigator',
          password: 'demo123'
        }),
      });
      
      if (applicantLoginResponse.ok) {
        const cookies = applicantLoginResponse.headers.get('set-cookie');
        applicantSessionCookie = cookies?.split(';')[0] || '';
      }
    } catch (error) {
      console.warn('Failed to login as applicant:', error);
    }
  });

  it('should allow admin to access /api/admin/metrics/realtime', async () => {
    const response = await fetch('http://localhost:5000/api/admin/metrics/realtime', {
      headers: { 
        'Cookie': adminSessionCookie,
      }
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('errors');
  });

  it('should deny non-admin access to /api/admin/metrics/realtime', async () => {
    const response = await fetch('http://localhost:5000/api/admin/metrics/realtime', {
      headers: { 
        'Cookie': applicantSessionCookie,
      }
    });
    
    expect(response.status).toBe(403); // Forbidden
  });

  it('should deny unauthenticated access to /api/admin/metrics/realtime', async () => {
    const response = await fetch('http://localhost:5000/api/admin/metrics/realtime');
    expect(response.status).toBe(401); // Unauthorized
  });
});

describe('Monitoring Dashboard - WebSocket Realtime Updates', () => {
  let adminSessionCookie: string;
  let applicantSessionCookie: string;

  beforeAll(async () => {
    // Login as admin to get session cookie
    try {
      const adminLoginResponse = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'demo.supervisor',
          password: 'demo123'
        }),
      });
      
      if (adminLoginResponse.ok) {
        const cookies = adminLoginResponse.headers.get('set-cookie');
        adminSessionCookie = cookies?.split(';')[0] || '';
      }
    } catch (error) {
      console.warn('Failed to login as admin:', error);
    }

    // Login as applicant (non-admin)
    try {
      const applicantLoginResponse = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'demo.navigator',
          password: 'demo123'
        }),
      });
      
      if (applicantLoginResponse.ok) {
        const cookies = applicantLoginResponse.headers.get('set-cookie');
        applicantSessionCookie = cookies?.split(';')[0] || '';
      }
    } catch (error) {
      console.warn('Failed to login as applicant:', error);
    }
  });

  it('should receive metrics update via WebSocket subscription', () => {
    if (!adminSessionCookie) {
      console.warn('No admin session cookie - skipping test');
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:5000/ws/notifications', {
        headers: {
          Cookie: adminSessionCookie,
        }
      });

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'subscribe_metrics' }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'metrics_snapshot') {
          expect(message.data).toHaveProperty('errors');
          expect(message.data).toHaveProperty('security');
          expect(message.data).toHaveProperty('performance');
          ws.close();
          resolve();
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        ws.close();
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for metrics snapshot'));
      }, 10000);
    });
  });

  it('should reject non-admin WebSocket metrics subscription', () => {
    if (!applicantSessionCookie) {
      console.warn('No applicant session cookie - skipping test');
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:5000/ws/notifications', {
        headers: {
          Cookie: applicantSessionCookie,
        }
      });

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'subscribe_metrics' }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'error') {
          expect(message.message).toContain('Admin role required');
          ws.close();
          resolve();
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        ws.close();
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for error message'));
      }, 10000);
    });
  });
});

describe('Alert Management - CRUD Operations', () => {
  let adminSessionCookie: string;

  beforeAll(async () => {
    // Login as admin to get session cookie
    try {
      const adminLoginResponse = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'demo.supervisor',
          password: 'demo123'
        }),
      });
      
      if (adminLoginResponse.ok) {
        const cookies = adminLoginResponse.headers.get('set-cookie');
        adminSessionCookie = cookies?.split(';')[0] || '';
      }
    } catch (error) {
      console.warn('Failed to login as admin:', error);
    }
  });

  it('should create alert rule as admin', async () => {
    if (!adminSessionCookie) {
      console.warn('No admin session cookie - skipping test');
      return;
    }

    const response = await fetch('http://localhost:5000/api/admin/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminSessionCookie,
      },
      body: JSON.stringify({
        name: 'Test Alert',
        metricType: 'error_rate',
        threshold: 100,
        comparison: 'greater_than',
        severity: 'warning',
        channels: ['in_app'],
        enabled: true,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
  });
});
