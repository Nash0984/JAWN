import { vi } from 'vitest';

/**
 * Test Helper Utilities
 * 
 * Shared test utilities for mocking services, converting values,
 * and generating test data for the Maryland Benefits-Tax Navigator
 */

// ============================================================================
// Mock Response Generators
// ============================================================================

/**
 * Mock Gemini API response for document extraction
 */
export function mockGeminiResponse(data: any, confidence = 0.95) {
  return {
    data,
    confidence,
    extractedFields: Object.keys(data),
    processingTime: 1200,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Mock database document response
 */
export function mockDbDocument(overrides = {}) {
  return {
    id: 'test-doc-123',
    filename: 'test-document.pdf',
    mimeType: 'application/pdf',
    objectPath: 'test-documents/test-doc-123.pdf',
    uploadedAt: new Date(),
    fileSize: 1024000, // 1MB
    status: 'processed',
    ...overrides,
  };
}

/**
 * Mock PolicyEngine API response for benefits calculation
 */
export function mockPolicyEngineResponse(overrides = {}) {
  return {
    status: 'success',
    result: {
      households: {
        your_household: {
          snap: { 2024: 250 },
          medicaid: { 2024: 1 },
          eitc: { 2024: 3200 },
          ctc: { 2024: 2000 },
          tanf: { 2024: 0 },
          ssi: { 2024: 0 },
          ...overrides,
        },
      },
    },
  };
}

/**
 * Mock PolicyEngine tax calculation response
 */
export function mockPolicyEngineTaxResponse(overrides = {}) {
  return {
    status: 'success',
    result: {
      tax_units: {
        tax_unit: {
          adjusted_gross_income: { 2024: 45000 },
          taxable_income: { 2024: 31000 },
          income_tax: { 2024: 3500 },
          eitc: { 2024: 0 },
          ctc: { 2024: 0 },
          ...overrides,
        },
      },
    },
  };
}

/**
 * Mock eligibility calculation result
 */
export function mockEligibilityResult(overrides = {}) {
  return {
    isEligible: true,
    reason: 'Household meets income and resource requirements',
    grossIncomeTest: {
      passed: true,
      limit: 220000, // $2,200 in cents
      actual: 150000, // $1,500 in cents
    },
    netIncomeTest: {
      passed: true,
      limit: 110000, // $1,100 in cents
      actual: 85000, // $850 in cents
    },
    deductions: {
      standardDeduction: 19300, // $193
      earnedIncomeDeduction: 30000, // $300
      dependentCareDeduction: 0,
      medicalExpenseDeduction: 0,
      shelterDeduction: 35700, // $357
      total: 85000, // $850
    },
    monthlyBenefit: 29100, // $291 in cents
    maxAllotment: 29100,
    calculationBreakdown: [
      'Household size: 1',
      'Gross monthly income: $1,500.00',
      'Net monthly income: $850.00',
      'Monthly SNAP benefit: $291.00',
    ],
    rulesSnapshot: {
      incomeLimitId: 'snap-income-limit-1',
      deductionIds: ['snap-deduction-1', 'snap-deduction-2'],
      allotmentId: 'snap-allotment-1',
    },
    policyCitations: [],
    ...overrides,
  };
}

// ============================================================================
// Value Conversion Helpers
// ============================================================================

/**
 * Convert dollars to cents (for monetary values)
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars
 */
export function toDollars(cents: number): number {
  return cents / 100;
}

/**
 * Format currency for display
 */
export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Parse currency string to cents
 */
export function parseCurrency(currencyString: string): number {
  const cleaned = currencyString.replace(/[$,]/g, '');
  return Math.round(parseFloat(cleaned) * 100);
}

// ============================================================================
// Date Helpers
// ============================================================================

/**
 * Create a date string in YYYY-MM-DD format
 */
export function createDateString(year: number, month: number, day: number): string {
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');
  return `${year}-${monthStr}-${dayStr}`;
}

/**
 * Get first day of month
 */
export function getFirstDayOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get last day of month
 */
export function getLastDayOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate random SSN for testing (format: XXX-XX-XXXX)
 */
export function generateTestSSN(): string {
  const area = Math.floor(Math.random() * 899) + 100; // 100-999
  const group = Math.floor(Math.random() * 99) + 1; // 01-99
  const serial = Math.floor(Math.random() * 9999) + 1; // 0001-9999
  return `${area}-${group.toString().padStart(2, '0')}-${serial.toString().padStart(4, '0')}`;
}

/**
 * Generate random EIN for testing (format: XX-XXXXXXX)
 */
export function generateTestEIN(): string {
  const prefix = Math.floor(Math.random() * 90) + 10; // 10-99
  const suffix = Math.floor(Math.random() * 9999999); // 0-9999999
  return `${prefix}-${suffix.toString().padStart(7, '0')}`;
}

/**
 * Generate test address
 */
export function generateTestAddress(overrides = {}) {
  return {
    street: `${Math.floor(Math.random() * 9999) + 1} Main Street`,
    city: 'Baltimore',
    state: 'MD',
    zip: '21201',
    ...overrides,
  };
}

/**
 * Generate test household member
 */
export function generateTestHouseholdMember(age: number, overrides = {}) {
  return {
    age,
    name: `Test Person ${age}`,
    ssn: generateTestSSN(),
    relationship: age < 18 ? 'child' : 'adult',
    ...overrides,
  };
}

// ============================================================================
// Mock Service Functions
// ============================================================================

/**
 * Create a mock file upload
 */
export function createMockFile(
  filename: string,
  mimeType: string,
  content: string = 'test content'
): File {
  const blob = new Blob([content], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

/**
 * Create mock FormData with file
 */
export function createMockFormData(file: File, additionalFields: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.append('file', file);
  
  Object.entries(additionalFields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  
  return formData;
}

/**
 * Wait for a specified number of milliseconds (for async testing)
 */
export async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock API fetch response
 */
export function mockFetchResponse(data: any, status = 200, ok = true) {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob([JSON.stringify(data)]),
  } as Response;
}

/**
 * Mock API error response
 */
export function mockFetchError(message: string, status = 500) {
  return {
    ok: false,
    status,
    statusText: message,
    json: async () => ({ error: message }),
    text: async () => JSON.stringify({ error: message }),
  } as Response;
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a value is within a range (useful for monetary calculations)
 */
export function assertWithinRange(actual: number, expected: number, tolerance: number = 1) {
  const min = expected - tolerance;
  const max = expected + tolerance;
  if (actual < min || actual > max) {
    throw new Error(
      `Expected ${actual} to be within ${tolerance} of ${expected} (range: ${min}-${max})`
    );
  }
}

/**
 * Assert that an object has all required properties
 */
export function assertHasProperties<T extends object>(
  obj: any,
  properties: (keyof T)[]
): asserts obj is T {
  properties.forEach(prop => {
    if (!(prop in obj)) {
      throw new Error(`Expected object to have property '${String(prop)}'`);
    }
  });
}

// ============================================================================
// Vitest Mock Helpers
// ============================================================================

/**
 * Create a spy function with default return value
 */
export function createMockFn<T = any>(returnValue?: T) {
  return vi.fn().mockResolvedValue(returnValue);
}

/**
 * Create a spy function that rejects
 */
export function createMockErrorFn(error: Error | string) {
  const errorObj = typeof error === 'string' ? new Error(error) : error;
  return vi.fn().mockRejectedValue(errorObj);
}

/**
 * Reset all mocks
 */
export function resetAllMocks() {
  vi.clearAllMocks();
  vi.resetAllMocks();
  vi.restoreAllMocks();
}

// ============================================================================
// Test Data Validators
// ============================================================================

/**
 * Validate SSN format
 */
export function isValidSSN(ssn: string): boolean {
  return /^\d{3}-\d{2}-\d{4}$/.test(ssn);
}

/**
 * Validate EIN format
 */
export function isValidEIN(ein: string): boolean {
  return /^\d{2}-\d{7}$/.test(ein);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate phone format
 */
export function isValidPhone(phone: string): boolean {
  return /^\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$/.test(phone);
}

/**
 * Validate ZIP code format
 */
export function isValidZipCode(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip);
}
