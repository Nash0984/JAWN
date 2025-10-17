/**
 * WCAG 2.1 AAA Automated Accessibility Audit
 * 
 * Tests all pages with axe-core for automated WCAG violations.
 * Priority tiers:
 * - P1: Public-facing pages (highest risk)
 * - P2: Taxpayer Self-Service Portal
 * - P3: Staff workflows
 * - P4: Admin tools
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Helper function to run axe and assert no violations
async function checkAccessibility(page: any, url: string, pageName: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'])
    .analyze();

  // Log violations for debugging
  if (accessibilityScanResults.violations.length > 0) {
    console.log(`\n❌ Accessibility violations found on ${pageName} (${url}):`);
    accessibilityScanResults.violations.forEach((violation: any) => {
      console.log(`\n  [${violation.impact?.toUpperCase()}] ${violation.id}: ${violation.description}`);
      console.log(`    Help: ${violation.helpUrl}`);
      console.log(`    Elements affected: ${violation.nodes.length}`);
      violation.nodes.forEach((node: any, idx: number) => {
        console.log(`      ${idx + 1}. ${node.html}`);
        console.log(`         ${node.failureSummary}`);
      });
    });
  }

  expect(accessibilityScanResults.violations).toEqual([]);
}

// =============================================================================
// PRIORITY 1: Public-facing pages (6 pages)
// =============================================================================

test.describe('P1: Public Portal Accessibility', () => {
  test('Home page (/) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/', 'Home');
  });

  test('Document Checklist (/public/documents) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/public/documents', 'Document Checklist');
  });

  test('Notice Explainer (/public/notices) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/public/notices', 'Notice Explainer');
  });

  test('Simplified Search (/public/search) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/public/search', 'Simplified Search');
  });

  test('Quick Screener (/public/quick-screener) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/public/quick-screener', 'Quick Screener');
  });

  test('FSA Landing (/public/fsa) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/public/fsa', 'FSA Landing');
  });
});

test.describe('P1: Authentication Pages', () => {
  test('Login page (/login) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/login', 'Login');
  });

  test('Signup page (/signup) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/signup', 'Signup');
  });
});

test.describe('P1: Legal Pages (8 pages)', () => {
  test('Legal Hub (/legal) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/legal', 'Legal Hub');
  });

  test('Privacy Policy (/legal/privacy) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/legal/privacy', 'Privacy Policy');
  });

  test('Terms of Service (/legal/terms) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/legal/terms', 'Terms of Service');
  });

  test('License (/legal/license) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/legal/license', 'License');
  });

  test('Accessibility Statement (/legal/accessibility) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/legal/accessibility', 'Accessibility Statement');
  });

  test('Data Security Policy (/legal/security) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/legal/security', 'Data Security Policy');
  });

  test('Breach Notification Policy (/legal/breach-notification) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/legal/breach-notification', 'Breach Notification Policy');
  });

  test('Disclaimer (/legal/disclaimer) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/legal/disclaimer', 'Disclaimer');
  });
});

// =============================================================================
// PRIORITY 2: Taxpayer Self-Service Portal (4 pages) - REQUIRES AUTH
// =============================================================================

test.describe('P2: Taxpayer Portal Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a client/taxpayer user
    await page.goto('/login');
    await page.fill('[data-testid="input-username"]', 'demo.applicant');
    await page.fill('[data-testid="input-password"]', 'Demo2024!');
    await page.click('[data-testid="button-login"]');
    await page.waitForURL('/dashboard/client');
  });

  test('Taxpayer Dashboard (/taxpayer) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/taxpayer', 'Taxpayer Dashboard');
  });

  test('Taxpayer Documents (/taxpayer/documents) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/taxpayer/documents', 'Taxpayer Documents');
  });

  test('Taxpayer Messages (/taxpayer/messages) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/taxpayer/messages', 'Taxpayer Messages');
  });

  test('Taxpayer E-Signature (/taxpayer/signature) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/taxpayer/signature', 'Taxpayer E-Signature');
  });
});

// =============================================================================
// PRIORITY 3: Staff Workflows - REQUIRES STAFF AUTH
// =============================================================================

test.describe('P3: Staff Workflows Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Login as staff user (navigator/caseworker)
    await page.goto('/login');
    await page.fill('[data-testid="input-username"]', 'demo.navigator');
    await page.fill('[data-testid="input-password"]', 'Demo2024!');
    await page.click('[data-testid="button-login"]');
    await page.waitForURL('/dashboard/navigator');
  });

  test('Navigator Dashboard (/dashboard/navigator) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/dashboard/navigator', 'Navigator Dashboard');
  });

  test('Caseworker Cockpit (/caseworker/cockpit) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/caseworker/cockpit', 'Caseworker Cockpit');
  });

  test('VITA Intake (/vita-intake) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/vita-intake', 'VITA Intake');
  });

  test('Appointments (/appointments) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/appointments', 'Appointments');
  });

  test('Document Review Queue (/navigator/document-review) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/navigator/document-review', 'Document Review Queue');
  });
});

// =============================================================================
// PRIORITY 4: Admin Tools - REQUIRES ADMIN AUTH
// =============================================================================

test.describe('P4: Admin Tools Accessibility (Sample)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.fill('[data-testid="input-username"]', 'demo.admin');
    await page.fill('[data-testid="input-password"]', 'Demo2024!');
    await page.click('[data-testid="button-login"]');
    await page.waitForURL('/dashboard/admin');
  });

  test('Admin Dashboard (/dashboard/admin) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/dashboard/admin', 'Admin Dashboard');
  });

  test('Admin Monitoring (/admin/monitoring) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/admin/monitoring', 'Admin Monitoring');
  });

  test('Security Monitoring (/admin/security-monitoring) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/admin/security-monitoring', 'Security Monitoring');
  });

  test('Audit Logs (/admin/audit-logs) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/admin/audit-logs', 'Audit Logs');
  });

  test('API Documentation (/admin/api-docs) - WCAG AAA compliance', async ({ page }) => {
    await checkAccessibility(page, '/admin/api-docs', 'API Documentation');
  });
});
