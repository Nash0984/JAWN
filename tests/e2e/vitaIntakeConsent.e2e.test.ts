import { test, expect } from '@playwright/test';
import { nanoid } from 'nanoid';

test.describe('VITA Intake IRS Consent E2E Flow', () => {
  let sessionId: string;
  
  test.beforeEach(async ({ page }) => {
    // Navigate to login page and login
    await page.goto('http://localhost:5000/login');
    
    await page.fill('[data-testid="input-username"]', 'demo.supervisor');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.click('[data-testid="button-login"]');
    
    // Wait for navigation after login
    await page.waitForURL('**/');
  });
  
  test('should complete full VITA intake flow with IRS consent', async ({ page }) => {
    // Navigate to VITA Intake page
    await page.goto('http://localhost:5000/vita-intake');
    await page.waitForLoadState('networkidle');
    
    // Check if we're creating a new session or continuing existing
    const newSessionButton = page.locator('[data-testid="button-new-session"]');
    if (await newSessionButton.isVisible()) {
      await newSessionButton.click();
    }
    
    // Step 1: Personal Information
    await expect(page.locator('text=Personal Information')).toBeVisible();
    
    const testSuffix = nanoid(6);
    await page.fill('[data-testid="input-primaryFirstName"]', 'John');
    await page.fill('[data-testid="input-primaryLastName"]', `Doe${testSuffix}`);
    await page.fill('[data-testid="input-primaryDateOfBirth"]', '1980-01-01');
    await page.fill('[data-testid="input-primaryTelephone"]', '555-123-4567');
    await page.fill('[data-testid="input-primarySSN"]', '123-45-6789');
    await page.fill('[data-testid="input-mailingAddress"]', '123 Test St');
    await page.fill('[data-testid="input-city"]', 'Baltimore');
    await page.fill('[data-testid="input-zipCode"]', '21201');
    
    // Save and continue to Step 2
    await page.click('[data-testid="button-save-continue"]');
    await page.waitForTimeout(1000);
    
    // Step 2: Household & Dependents
    await expect(page.locator('text=Household & Dependents')).toBeVisible();
    
    // Select marital status
    await page.click('[data-testid="select-maritalStatusDec31"]');
    await page.click('[data-testid="option-single"]');
    
    // Continue to Step 3 (skip dependents for minimal test)
    await page.click('[data-testid="button-save-continue"]');
    await page.waitForTimeout(1000);
    
    // Step 3: Income
    await expect(page.locator('text=Income')).toBeVisible();
    
    // Check W2 income
    await page.click('[data-testid="checkbox-hasW2Income"]');
    
    // Continue to Step 4
    await page.click('[data-testid="button-save-continue"]');
    await page.waitForTimeout(1000);
    
    // Step 4: Deductions & Credits
    await expect(page.locator('text=Deductions & Credits')).toBeVisible();
    
    // Continue to Step 5 (skip deductions for minimal test)
    await page.click('[data-testid="button-save-continue"]');
    await page.waitForTimeout(1000);
    
    // Step 5: Review & Consent
    await expect(page.locator('text=Review & Consent')).toBeVisible();
    
    // Verify IRS consent form is displayed
    await expect(page.locator('text=Authorization to Use Tax Information for Benefits Eligibility')).toBeVisible({ timeout: 10000 });
    
    // Verify benefit program checkboxes are present
    await expect(page.locator('[data-testid="checkbox-program-snap"]')).toBeVisible();
    await expect(page.locator('[data-testid="checkbox-program-medicaid"]')).toBeVisible();
    await expect(page.locator('[data-testid="checkbox-program-tca"]')).toBeVisible();
    await expect(page.locator('[data-testid="checkbox-program-ohep"]')).toBeVisible();
    
    // Verify electronic signature input field is present
    await expect(page.locator('[data-testid="input-signature"]')).toBeVisible();
    
    // Verify submit button is disabled initially
    const submitButton = page.locator('[data-testid="button-submit-consent"]');
    await expect(submitButton).toBeDisabled();
    
    // Check SNAP benefit program
    await page.click('[data-testid="checkbox-program-snap"]');
    
    // Type signature name
    const signatureName = `Test User ${testSuffix}`;
    await page.fill('[data-testid="input-signature"]', signatureName);
    
    // Check "I have read and understand" checkbox
    await page.click('[data-testid="checkbox-read-form"]');
    
    // Check "I voluntarily consent" checkbox
    await page.click('[data-testid="checkbox-agree"]');
    
    // Verify submit button is now enabled
    await expect(submitButton).toBeEnabled();
    
    // Click submit button
    await submitButton.click();
    
    // Verify success message appears
    await expect(page.locator('text=Consent Recorded')).toBeVisible({ timeout: 5000 });
    
    // Extract session ID from URL or page state for verification
    const currentUrl = page.url();
    const urlParams = new URLSearchParams(currentUrl.split('?')[1]);
    sessionId = urlParams.get('sessionId') || '';
    
    // If we can get session ID, verify consent via API
    if (sessionId) {
      // Make API call to verify consent was recorded
      const response = await page.request.get(`http://localhost:5000/api/consent/client-consents/vita-session/${sessionId}`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    }
  });
  
  test('should prevent duplicate consent submission', async ({ page }) => {
    // Navigate to VITA Intake page
    await page.goto('http://localhost:5000/vita-intake');
    await page.waitForLoadState('networkidle');
    
    // Continue with existing session from previous test
    const continueButton = page.locator('[data-testid="button-continue-session"]');
    if (await continueButton.isVisible()) {
      await continueButton.click();
      
      // Navigate to Step 5
      await page.click('[data-testid="step-5"]');
      await page.waitForTimeout(1000);
      
      // Verify existing consent message is displayed
      await expect(page.locator('text=already provided IRS Use & Disclosure consent')).toBeVisible({ timeout: 5000 });
      
      // Verify consent form is NOT editable again
      await expect(page.locator('[data-testid="input-signature"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="button-submit-consent"]')).not.toBeVisible();
    }
  });
  
  test('should validate all required fields before enabling submit', async ({ page }) => {
    // Navigate to VITA Intake page
    await page.goto('http://localhost:5000/vita-intake');
    await page.waitForLoadState('networkidle');
    
    // Create new session
    const newSessionButton = page.locator('[data-testid="button-new-session"]');
    if (await newSessionButton.isVisible()) {
      await newSessionButton.click();
    }
    
    // Fill minimal Step 1 data
    const testSuffix = nanoid(6);
    await page.fill('[data-testid="input-primaryFirstName"]', 'Jane');
    await page.fill('[data-testid="input-primaryLastName"]', `Smith${testSuffix}`);
    await page.fill('[data-testid="input-primaryDateOfBirth"]', '1985-05-15');
    await page.fill('[data-testid="input-primaryTelephone"]', '555-987-6543');
    await page.fill('[data-testid="input-primarySSN"]', '987-65-4321');
    await page.fill('[data-testid="input-mailingAddress"]', '456 Oak Ave');
    await page.fill('[data-testid="input-city"]', 'Annapolis');
    await page.fill('[data-testid="input-zipCode"]', '21401');
    
    await page.click('[data-testid="button-save-continue"]');
    await page.waitForTimeout(500);
    
    // Skip to Step 5 by filling minimal data
    await page.click('[data-testid="select-maritalStatusDec31"]');
    await page.click('[data-testid="option-single"]');
    await page.click('[data-testid="button-save-continue"]');
    await page.waitForTimeout(500);
    
    await page.click('[data-testid="checkbox-hasW2Income"]');
    await page.click('[data-testid="button-save-continue"]');
    await page.waitForTimeout(500);
    
    await page.click('[data-testid="button-save-continue"]');
    await page.waitForTimeout(500);
    
    // Now at Step 5
    const submitButton = page.locator('[data-testid="button-submit-consent"]');
    
    // Initially disabled
    await expect(submitButton).toBeDisabled();
    
    // Check program only - still disabled
    await page.click('[data-testid="checkbox-program-snap"]');
    await expect(submitButton).toBeDisabled();
    
    // Add signature - still disabled
    await page.fill('[data-testid="input-signature"]', 'Test Signature');
    await expect(submitButton).toBeDisabled();
    
    // Check first acknowledgment - still disabled
    await page.click('[data-testid="checkbox-read-form"]');
    await expect(submitButton).toBeDisabled();
    
    // Check second acknowledgment - NOW enabled
    await page.click('[data-testid="checkbox-agree"]');
    await expect(submitButton).toBeEnabled();
    
    // Uncheck signature acknowledgment - disabled again
    await page.click('[data-testid="checkbox-agree"]');
    await expect(submitButton).toBeDisabled();
  });
  
  test('should display all benefit program options', async ({ page }) => {
    // Navigate to VITA Intake and create minimal session to reach Step 5
    await page.goto('http://localhost:5000/vita-intake');
    await page.waitForLoadState('networkidle');
    
    const newSessionButton = page.locator('[data-testid="button-new-session"]');
    if (await newSessionButton.isVisible()) {
      await newSessionButton.click();
    }
    
    // Quick fill to Step 5
    const testSuffix = nanoid(6);
    await page.fill('[data-testid="input-primaryFirstName"]', 'Test');
    await page.fill('[data-testid="input-primaryLastName"]', `User${testSuffix}`);
    await page.fill('[data-testid="input-primaryDateOfBirth"]', '1990-01-01');
    await page.fill('[data-testid="input-primaryTelephone"]', '555-000-0000');
    await page.fill('[data-testid="input-primarySSN"]', '111-11-1111');
    await page.fill('[data-testid="input-mailingAddress"]', '789 Test Rd');
    await page.fill('[data-testid="input-city"]', 'Baltimore');
    await page.fill('[data-testid="input-zipCode"]', '21202');
    await page.click('[data-testid="button-save-continue"]');
    await page.waitForTimeout(500);
    
    await page.click('[data-testid="select-maritalStatusDec31"]');
    await page.click('[data-testid="option-single"]');
    await page.click('[data-testid="button-save-continue"]');
    await page.waitForTimeout(500);
    
    await page.click('[data-testid="checkbox-hasW2Income"]');
    await page.click('[data-testid="button-save-continue"]');
    await page.waitForTimeout(500);
    
    await page.click('[data-testid="button-save-continue"]');
    await page.waitForTimeout(500);
    
    // Verify all 4 benefit programs are displayed
    const snapCheckbox = page.locator('[data-testid="checkbox-program-snap"]');
    const medicaidCheckbox = page.locator('[data-testid="checkbox-program-medicaid"]');
    const tcaCheckbox = page.locator('[data-testid="checkbox-program-tca"]');
    const ohepCheckbox = page.locator('[data-testid="checkbox-program-ohep"]');
    
    await expect(snapCheckbox).toBeVisible();
    await expect(medicaidCheckbox).toBeVisible();
    await expect(tcaCheckbox).toBeVisible();
    await expect(ohepCheckbox).toBeVisible();
    
    // Verify labels
    await expect(page.locator('text=SNAP (Food Assistance)')).toBeVisible();
    await expect(page.locator('text=Medicaid (Medical Assistance)')).toBeVisible();
    await expect(page.locator('text=TCA/TANF (Cash Assistance)')).toBeVisible();
    await expect(page.locator('text=OHEP (Energy Assistance)')).toBeVisible();
  });
});
