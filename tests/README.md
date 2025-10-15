# Testing Infrastructure

This directory contains the comprehensive testing infrastructure for the Maryland Universal Benefits-Tax Navigator platform.

## Structure

```
tests/
├── setup.ts                        # Global test setup and configuration
├── fixtures/                       # Test data fixtures
│   ├── index.ts                   # Centralized fixture exports
│   ├── households/                # Household test cases
│   │   ├── marylandHouseholds.ts  # Maryland SNAP household fixtures
│   │   └── taxHouseholds.ts       # 2024 tax household fixtures
│   └── documents/                 # Document test data
│       ├── w2Samples.ts           # W-2 form test data
│       └── verificationDocs.ts    # Verification document samples
├── utils/                          # Shared test utilities
│   └── testHelpers.ts             # Mock generators and helper functions
├── unit/                          # Unit tests for components and utilities
│   ├── components/                # Component tests
│   └── utils.test.ts              # Utility function tests
├── integration/                   # Integration tests
│   ├── api.test.ts               # API integration tests
│   ├── snapEligibility.test.ts   # SNAP eligibility tests (example)
│   └── taxCalculations.test.ts   # Tax calculation tests (example)
└── e2e/                           # End-to-end tests (future)
```

## Test Fixtures

### Maryland Household Fixtures

**Location**: `tests/fixtures/households/marylandHouseholds.ts`

Comprehensive Maryland household test cases for SNAP eligibility testing. All monetary values are in **cents** (not dollars).

**Available fixtures**:
- `singleAdultWorking` - Single adult, working poor (eligible)
- `familyWithChildren` - Family with 2 children (eligible)
- `elderlySsi` - Elderly person with SSI (categorically eligible)
- `disabledAdult` - Disabled adult with medical deductions
- `highIncome` - High income (ineligible)
- `zeroIncome` - Zero income household
- `tanfRecipient` - TANF recipient (categorically eligible)
- `largeFamilyEightMembers` - Large family (8 members)
- `elderlyCouple` - Elderly couple with high medical costs
- `mixedIncome` - Mixed earned and unearned income
- `borderlineIneligible` - Just over gross income limit
- `borderlineEligible` - Just under gross income limit
- `highShelterCosts` - High shelter costs (excess shelter deduction)
- `singleParentChildcare` - Single parent with childcare costs
- `bbceEligible` - Broad-Based Categorical Eligibility

**Example usage**:
```typescript
import { marylandHouseholds } from '../fixtures';

it('should calculate benefits for single working adult', () => {
  const household = marylandHouseholds.singleAdultWorking;
  expect(household.size).toBe(1);
  expect(household.grossMonthlyIncome).toBe(150000); // $1,500 in cents
});
```

### Tax Household Fixtures

**Location**: `tests/fixtures/households/taxHouseholds.ts`

Representative 2024 tax scenarios covering EITC, CTC, filing statuses, and various income situations.

**Available fixtures**:
- `singleW2` - Single filer, W-2 wage earner
- `marriedWithKidsEitc` - Married with 2 children (EITC eligible)
- `headOfHouseholdEitc` - Head of household with 1 child
- `lowIncomeSingleParent` - Low income single parent (maximum EITC)
- `highEarnerSingle` - High earner (no EITC/CTC)
- `selfEmployedSingle` - Self-employed single filer
- `retireeSingleWithPension` - Retiree with SS and pension
- `marriedWithEducation` - Married couple with education expenses
- `marriedWithAca` - Married with ACA health insurance
- `singleWithUnemployment` - Single with unemployment compensation
- `marriedFilingSeparately` - Married filing separately
- `qualifyingWidow` - Qualifying widow(er) with dependent
- `marriedItemized` - Married with itemized deductions
- `elderlyCoupleLowIncome` - Elderly couple, low income
- `marriedThreeKids` - Three children (maximum CTC)
- `singleWithDisabledDependent` - Single with disabled dependent

**Example usage**:
```typescript
import { taxHouseholds2024 } from '../fixtures';

it('should calculate EITC for low-income parent', () => {
  const household = taxHouseholds2024.lowIncomeSingleParent;
  expect(household.filingStatus).toBe('head_of_household');
  expect(household.w2Income?.taxpayerWages).toBe(18000);
});
```

### W-2 Document Fixtures

**Location**: `tests/fixtures/documents/w2Samples.ts`

Realistic W-2 test data for tax document extraction testing.

**Available fixtures**:
- `standard2024` - Standard W-2 with 401k contribution
- `highEarner2024` - High earner with multiple box 12 codes
- `partTimeWorker2024` - Part-time worker
- `restaurantWorkerWithTips2024` - Restaurant worker with tips
- `dualJobs2024_First` - First job of dual employment
- `dualJobs2024_Second` - Second job of dual employment
- `stateFederalWorker2024` - State government employee
- `lowIncomeEitcEligible2024` - Low income, EITC eligible

**Example usage**:
```typescript
import { w2Samples } from '../fixtures';

it('should extract W-2 data correctly', () => {
  const w2 = w2Samples.standard2024;
  expect(w2.box1_wages).toBe(45000);
  expect(w2.box2_federalTaxWithheld).toBe(5400);
});
```

### Verification Document Fixtures

**Location**: `tests/fixtures/documents/verificationDocs.ts`

Sample data for all document types used in benefits verification.

**Available fixtures**:
- `bankStatement` - Asset verification
- `rentReceipt` - Rent expense verification
- `birthCertificate` - Identity verification
- `electricBill` - Utility bill for residency
- `payStub` - Income verification
- `ssaAwardLetter` - SSA benefit award letter
- `driversLicense` - Driver's license for identity
- `leaseAgreement` - Housing verification
- `medicalBill` - Medical expense verification
- `childcareBill` - Childcare expense verification
- And more...

**Example usage**:
```typescript
import { verificationDocuments } from '../fixtures';

it('should extract bank statement data', () => {
  const doc = verificationDocuments.bankStatement;
  expect(doc.accountBalance).toBe(2500.00);
  expect(doc.accountType).toBe('checking');
});
```

## Test Utilities

**Location**: `tests/utils/testHelpers.ts`

### Mock Response Generators

```typescript
import { 
  mockGeminiResponse, 
  mockDbDocument,
  mockPolicyEngineResponse,
  mockPolicyEngineTaxResponse,
  mockEligibilityResult
} from '../utils/testHelpers';

// Mock Gemini extraction
const geminiMock = mockGeminiResponse({ field: 'value' }, 0.95);

// Mock database document
const docMock = mockDbDocument({ id: 'custom-id' });

// Mock PolicyEngine benefits response
const policyMock = mockPolicyEngineResponse({ snap: { 2024: 300 } });
```

### Value Conversion Helpers

```typescript
import { toCents, toDollars, formatCurrency, parseCurrency } from '../utils/testHelpers';

expect(toCents(15.50)).toBe(1550);
expect(toDollars(150000)).toBe(1500);
expect(formatCurrency(150000)).toBe('$1,500.00');
expect(parseCurrency('$1,500.00')).toBe(150000);
```

### Test Data Generators

```typescript
import {
  generateTestSSN,
  generateTestEIN,
  generateTestAddress,
  generateTestHouseholdMember
} from '../utils/testHelpers';

const ssn = generateTestSSN(); // "123-45-6789"
const ein = generateTestEIN(); // "52-1234567"
const address = generateTestAddress({ city: 'Annapolis' });
const member = generateTestHouseholdMember(25);
```

### Mock Service Functions

```typescript
import {
  createMockFile,
  createMockFormData,
  mockFetchResponse,
  mockFetchError
} from '../utils/testHelpers';

const file = createMockFile('test.pdf', 'application/pdf');
const formData = createMockFormData(file, { userId: '123' });
const response = mockFetchResponse({ data: 'value' }, 200);
const error = mockFetchError('Not found', 404);
```

### Assertion Helpers

```typescript
import {
  assertWithinRange,
  assertHasProperties
} from '../utils/testHelpers';

assertWithinRange(100, 102, 5); // Passes
assertHasProperties<MyType>(obj, ['id', 'name']); // Type-safe assertion
```

### Validators

```typescript
import {
  isValidSSN,
  isValidEIN,
  isValidEmail,
  isValidPhone,
  isValidZipCode
} from '../utils/testHelpers';

expect(isValidSSN('123-45-6789')).toBe(true);
expect(isValidEIN('52-1234567')).toBe(true);
```

## Running Tests

### Run all tests
```bash
npx vitest
```

### Run tests in watch mode
```bash
npx vitest watch
```

### Run tests with coverage
```bash
npx vitest --coverage
```

### Run tests with UI
```bash
npx vitest --ui
```

### Run specific test file
```bash
npx vitest tests/integration/snapEligibility.test.ts
```

### Run tests matching a pattern
```bash
npx vitest --run --reporter=verbose tests/integration/
```

## Writing Tests

### Using Fixtures - Example 1: SNAP Eligibility

```typescript
import { describe, it, expect } from 'vitest';
import { marylandHouseholds } from '../fixtures';

describe('SNAP Eligibility Tests', () => {
  it('should calculate benefits for eligible household', () => {
    const household = marylandHouseholds.singleAdultWorking;
    
    // Test setup is done - household data is ready to use
    expect(household.grossMonthlyIncome).toBe(150000); // $1,500
    expect(household.size).toBe(1);
  });
});
```

### Using Fixtures - Example 2: Tax Calculations

```typescript
import { describe, it, expect } from 'vitest';
import { taxHouseholds2024, w2Samples } from '../fixtures';

describe('Tax Calculation Tests', () => {
  it('should calculate correct EITC for low-income household', () => {
    const household = taxHouseholds2024.lowIncomeSingleParent;
    
    expect(household.dependents).toHaveLength(2);
    expect(household.w2Income?.taxpayerWages).toBe(18000);
  });

  it('should extract W-2 data correctly', () => {
    const w2 = w2Samples.standard2024;
    
    expect(w2.box1_wages).toBe(45000);
    expect(w2.employerName).toBe('Maryland Tech Solutions Inc');
  });
});
```

### Using Test Helpers

```typescript
import { describe, it, expect } from 'vitest';
import {
  toCents,
  mockGeminiResponse,
  assertWithinRange
} from '../utils/testHelpers';

describe('Test Helpers', () => {
  it('should convert currency correctly', () => {
    const amount = toCents(1500);
    expect(amount).toBe(150000);
  });

  it('should mock Gemini response', () => {
    const mock = mockGeminiResponse({ name: 'John' }, 0.95);
    
    expect(mock.data.name).toBe('John');
    expect(mock.confidence).toBe(0.95);
  });

  it('should assert within tolerance', () => {
    assertWithinRange(100, 102, 5); // Passes - within ±5
  });
});
```

## Test Configuration

- **Framework**: Vitest
- **Environment**: happy-dom (DOM simulation for React components)
- **Coverage Provider**: v8
- **Globals**: Enabled (describe, it, expect available globally)

**Configuration file**: `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  }
});
```

## Best Practices

1. **Use Fixtures**: Import pre-built test data from `tests/fixtures` instead of creating inline test data
2. **Monetary Values in Cents**: Always use cents (not dollars) for consistency with the application
3. **Type Safety**: Leverage TypeScript types exported from fixtures for type-safe tests
4. **Descriptive Names**: Use clear, descriptive test names that explain what is being tested
5. **Test Isolation**: Each test should be independent and not rely on other tests
6. **Mock External Services**: Use test helpers to mock API calls (Gemini, PolicyEngine, etc.)
7. **Test Edge Cases**: Use edge case fixtures like `borderlineEligible`, `zeroIncome`, etc.

## Coverage Goals

Target test coverage for ~250 tests across:
- ✅ Maryland SNAP eligibility rules (15+ household fixtures)
- ✅ Federal tax calculations (15+ tax household fixtures)  
- ✅ Document extraction for all 6 benefit programs (15+ document fixtures)
- ✅ W-2 form processing (8+ W-2 fixtures)
- ✅ Verification documents (15+ document type fixtures)

Current coverage areas:
- **SNAP Rules**: Gross income test, net income test, deductions, categorical eligibility
- **Tax Calculations**: EITC, CTC, filing statuses, income types, credits
- **Documents**: W-2, bank statements, pay stubs, verification documents
- **Edge Cases**: Zero income, borderline eligibility, dual jobs, mixed income

## Adding Test Scripts to package.json

To make running tests easier, add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest watch",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui",
    "test:run": "vitest run"
  }
}
```

## Continuous Integration

For CI/CD pipelines, use:

```bash
# Run all tests once with coverage
npx vitest run --coverage

# Run with JUnit reporter for CI
npx vitest run --reporter=junit --outputFile=test-results.xml
```

## Next Steps

1. Expand test coverage to 250+ tests using the fixtures
2. Add E2E tests for critical user workflows
3. Add performance benchmarks for eligibility calculations
4. Add integration tests for PolicyEngine API
5. Add visual regression tests for UI components
