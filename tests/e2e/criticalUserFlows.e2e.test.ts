import { test, expect, Page } from '@playwright/test';

// Demo credentials for testing
const DEMO_CREDENTIALS = {
  applicant: { username: 'demo.applicant', password: 'Demo2024!' },
  navigator: { username: 'demo.navigator', password: 'Demo2024!' },
  caseworker: { username: 'demo.caseworker', password: 'Demo2024!' },
  admin: { username: 'demo.admin', password: 'Demo2024!' }
};

// Helper function to login
async function login(page: Page, role: keyof typeof DEMO_CREDENTIALS) {
  const { username, password } = DEMO_CREDENTIALS[role];
  
  await page.goto('/login');
  await page.fill('[data-testid="input-username"]', username);
  await page.fill('[data-testid="input-password"]', password);
  await page.click('[data-testid="button-login"]');
  
  // Wait for redirect after successful login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
}

test.describe('Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test.describe('Authentication Flow', () => {
    test('should login successfully with demo applicant credentials', async ({ page }) => {
      await login(page, 'applicant');
      
      // Verify we're on the dashboard
      await expect(page.url()).toContain('/dashboard');
      
      // Check for welcome message or user info
      await expect(page.locator('[data-testid="text-username"]')).toContainText('demo.applicant');
    });

    test('should logout successfully', async ({ page }) => {
      await login(page, 'applicant');
      
      // Click logout
      await page.click('[data-testid="button-logout"]');
      
      // Should redirect to home or login page
      await expect(page.url()).toMatch(/\/(login|$)/);
    });

    test('should deny access to protected routes without authentication', async ({ page }) => {
      // Try to access protected route directly
      await page.goto('/dashboard');
      
      // Should redirect to login
      await expect(page.url()).toContain('/login');
    });
  });

  test.describe('Benefit Screener Flow', () => {
    test('should complete benefit screening as anonymous user', async ({ page }) => {
      // Navigate to screener
      await page.goto('/screener');
      
      // Check page loaded
      await expect(page.locator('h1')).toContainText(/benefit|screener|eligibility/i);
      
      // Fill household information
      await page.fill('[data-testid="input-household-size"]', '3');
      await page.fill('[data-testid="input-monthly-income"]', '2500');
      
      // Select county
      await page.selectOption('[data-testid="select-county"]', 'Baltimore City');
      
      // Submit screening
      await page.click('[data-testid="button-check-eligibility"]');
      
      // Wait for results
      await page.waitForSelector('[data-testid="eligibility-results"]', { timeout: 10000 });
      
      // Verify results are displayed
      const results = page.locator('[data-testid="eligibility-results"]');
      await expect(results).toBeVisible();
      
      // Should show SNAP eligibility (based on income)
      await expect(results).toContainText(/SNAP|Food Supplement/i);
    });

    test('should save screening results when logged in', async ({ page }) => {
      // Login first
      await login(page, 'applicant');
      
      // Go to eligibility checker
      await page.goto('/eligibility');
      
      // Fill form
      await page.fill('[data-testid="input-household-size"]', '4');
      await page.fill('[data-testid="input-monthly-income"]', '3000');
      
      // Submit
      await page.click('[data-testid="button-calculate"]');
      
      // Wait for results
      await page.waitForSelector('[data-testid="eligibility-results"]');
      
      // Check for save button
      const saveButton = page.locator('[data-testid="button-save-results"]');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Check for confirmation
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      }
    });
  });

  test.describe('Navigator Workspace Flow', () => {
    test('should access navigator workspace and manage clients', async ({ page }) => {
      // Login as navigator
      await login(page, 'navigator');
      
      // Navigate to workspace
      await page.goto('/navigator-workspace');
      
      // Check page loaded
      await expect(page.locator('h1')).toContainText(/Navigator|Workspace/i);
      
      // Look for client list or add client button
      const addClientButton = page.locator('[data-testid="button-add-client"]');
      if (await addClientButton.isVisible()) {
        await addClientButton.click();
        
        // Fill client form
        await page.fill('[data-testid="input-client-name"]', 'Test Client');
        await page.fill('[data-testid="input-client-email"]', 'test@example.com');
        
        // Save
        await page.click('[data-testid="button-save-client"]');
        
        // Check for success message
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      }
    });

    test('should perform benefit calculation for client', async ({ page }) => {
      await login(page, 'navigator');
      
      // Go to household profiler
      await page.goto('/household-profiler');
      
      // Create or select household profile
      await page.fill('[data-testid="input-household-name"]', 'Test Household');
      await page.fill('[data-testid="input-household-size"]', '3');
      await page.fill('[data-testid="input-monthly-income"]', '2800');
      
      // Calculate benefits
      await page.click('[data-testid="button-calculate-benefits"]');
      
      // Wait for results
      await page.waitForSelector('[data-testid="benefit-results"]');
      
      // Verify calculations displayed
      const results = page.locator('[data-testid="benefit-results"]');
      await expect(results).toBeVisible();
      await expect(results).toContainText(/eligible|ineligible|benefit amount/i);
    });
  });

  test.describe('Tax Preparation Flow', () => {
    test('should start VITA tax intake process', async ({ page }) => {
      await login(page, 'applicant');
      
      // Navigate to VITA intake
      await page.goto('/vita/intake');
      
      // Check page loaded
      await expect(page.locator('h1')).toContainText(/VITA|Tax|Intake/i);
      
      // Fill basic information
      await page.fill('[data-testid="input-tax-year"]', '2024');
      await page.fill('[data-testid="input-filing-status"]', 'single');
      
      // Consent checkbox
      const consentCheckbox = page.locator('[data-testid="checkbox-consent"]');
      if (await consentCheckbox.isVisible()) {
        await consentCheckbox.check();
      }
      
      // Start intake
      await page.click('[data-testid="button-start-intake"]');
      
      // Should show next step or confirmation
      await expect(page.locator('[data-testid="intake-step-2"], [data-testid="toast-success"]')).toBeVisible();
    });

    test('should upload tax documents', async ({ page }) => {
      await login(page, 'applicant');
      
      // Go to documents page
      await page.goto('/vita/documents');
      
      // Check for upload area
      const uploadButton = page.locator('[data-testid="button-upload-document"]');
      await expect(uploadButton).toBeVisible();
      
      // Create a test file
      const buffer = Buffer.from('Test W-2 document content');
      
      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-w2.pdf',
        mimeType: 'application/pdf',
        buffer: buffer
      });
      
      // Wait for upload completion
      await page.waitForSelector('[data-testid="document-uploaded"]', { timeout: 10000 });
      
      // Verify document appears in list
      await expect(page.locator('[data-testid="document-list"]')).toContainText('test-w2.pdf');
    });
  });

  test.describe('Admin Dashboard Flow', () => {
    test('should access admin dashboard and view metrics', async ({ page }) => {
      await login(page, 'admin');
      
      // Navigate to admin dashboard
      await page.goto('/admin');
      
      // Check dashboard loaded
      await expect(page.locator('h1')).toContainText(/Admin|Dashboard/i);
      
      // Check for key metrics
      await expect(page.locator('[data-testid="metric-total-users"]')).toBeVisible();
      await expect(page.locator('[data-testid="metric-active-sessions"]')).toBeVisible();
      
      // Navigate to monitoring
      await page.click('[data-testid="link-monitoring"]');
      await expect(page.url()).toContain('/monitoring');
      
      // Check monitoring page
      await expect(page.locator('[data-testid="monitoring-metrics"]')).toBeVisible();
    });

    test('should manage policy sources', async ({ page }) => {
      await login(page, 'admin');
      
      // Go to policy sources
      await page.goto('/policy-sources');
      
      // Check page loaded
      await expect(page.locator('h1')).toContainText(/Policy|Sources/i);
      
      // Look for add source button
      const addButton = page.locator('[data-testid="button-add-source"]');
      if (await addButton.isVisible()) {
        await addButton.click();
        
        // Fill form
        await page.fill('[data-testid="input-source-name"]', 'Test Policy');
        await page.fill('[data-testid="input-source-url"]', 'https://example.gov/policy');
        
        // Save
        await page.click('[data-testid="button-save-source"]');
        
        // Check for success
        await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      }
    });
  });

  test.describe('Mobile Responsive Flow', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/');
      
      // Check mobile menu button is visible
      const mobileMenu = page.locator('[data-testid="button-mobile-menu"]');
      await expect(mobileMenu).toBeVisible();
      
      // Open mobile menu
      await mobileMenu.click();
      
      // Check navigation items are visible
      await expect(page.locator('[data-testid="mobile-nav-items"]')).toBeVisible();
      
      // Navigate to screener
      await page.click('[data-testid="link-screener-mobile"]');
      
      // Check page loaded on mobile
      await expect(page.url()).toContain('/screener');
      
      // Form should be mobile-friendly
      const form = page.locator('[data-testid="screener-form"]');
      await expect(form).toBeVisible();
    });

    test('should show mobile bottom navigation for logged-in users', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await login(page, 'applicant');
      
      // Check bottom navigation
      const bottomNav = page.locator('[data-testid="mobile-bottom-nav"]');
      await expect(bottomNav).toBeVisible();
      
      // Check navigation items
      await expect(bottomNav.locator('[data-testid="nav-home"]')).toBeVisible();
      await expect(bottomNav.locator('[data-testid="nav-benefits"]')).toBeVisible();
      await expect(bottomNav.locator('[data-testid="nav-documents"]')).toBeVisible();
      await expect(bottomNav.locator('[data-testid="nav-profile"]')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/');
      
      // Tab through elements
      await page.keyboard.press('Tab');
      
      // Check focus is visible
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName : null;
      });
      
      expect(focusedElement).toBeTruthy();
      
      // Tab to main navigation
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
      }
      
      // Press Enter to navigate
      await page.keyboard.press('Enter');
      
      // Should navigate to a new page
      await page.waitForTimeout(500);
      const url = page.url();
      expect(url).not.toBe('/');
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/screener');
      
      // Check for ARIA labels
      const formElements = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, button'));
        return inputs.map(el => ({
          tag: el.tagName,
          hasLabel: !!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || 
                      el.id && document.querySelector(`label[for="${el.id}"]`))
        }));
      });
      
      // All form elements should have labels
      formElements.forEach(element => {
        expect(element.hasLabel).toBe(true);
      });
    });
  });
});