# IRS Consent Flow Testing Documentation

This document provides comprehensive information about the integration and E2E tests for the IRS consent flow in the VITA Intake system.

## Overview

Two test suites have been created to validate the IRS consent functionality:

1. **Integration Tests** (`tests/integration/irsConsent.test.ts`) - API-level tests
2. **E2E Tests** (`tests/e2e/vitaIntakeConsent.e2e.test.ts`) - Full user flow tests

## Test Files Created

### 1. Integration Tests (`tests/integration/irsConsent.test.ts`)

**Status:** ✅ Complete and ready to run

**Tests cover:**
- `GET /api/consent/forms/:code` - Retrieve IRS consent form by code
- `POST /api/consent/client-consents` - Record consent with metadata
- `GET /api/consent/client-consents/vita-session/:sessionId` - Retrieve session consents
- Error handling (404, 400 responses)
- Authentication requirements

**Running the integration tests:**
```bash
# Run all integration tests
npx vitest run tests/integration/irsConsent.test.ts

# Run with watch mode
npx vitest tests/integration/irsConsent.test.ts

# Run with UI
npx vitest --ui tests/integration/irsConsent.test.ts
```

**Prerequisites:**
- Server must be running on `http://localhost:5000`
- Database must be populated with:
  - IRS consent form with code `irs_use_disclosure`
  - Demo user: `demo.supervisor` with password `password123`

### 2. E2E Tests (`tests/e2e/vitaIntakeConsent.e2e.test.ts`)

**Status:** ⚠️ Code complete - requires data-testid attributes and Playwright browsers

**Tests cover:**
- Full VITA intake flow from Steps 1-5
- IRS consent form display and validation
- Benefit program selection (SNAP, Medicaid, TCA, OHEP)
- Electronic signature capture
- Form validation (disabled/enabled button logic)
- Consent submission workflow
- Duplicate prevention

**Running the E2E tests:**
```bash
# Install Playwright browsers (local environment only)
npx playwright install chromium

# Run E2E tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# Run in debug mode
npx playwright test --debug

# Run specific test file
npx playwright test tests/e2e/vitaIntakeConsent.e2e.test.ts
```

**Prerequisites:**
- Playwright browsers installed (not available in Replit environment)
- Server running on `http://localhost:5000`
- All required `data-testid` attributes added to components (see below)

## Required Data-TestId Attributes

The E2E tests require the following `data-testid` attributes to be added to the VITA Intake and IRS Consent components:

### VitaIntake Component (`client/src/pages/VitaIntake.tsx`)

```typescript
// Navigation
data-testid="button-new-session"
data-testid="button-continue-session"
data-testid="button-save-continue"
data-testid="step-5"

// Step 1: Personal Information
data-testid="input-primaryFirstName"
data-testid="input-primaryLastName"
data-testid="input-primaryDateOfBirth"
data-testid="input-primaryTelephone"
data-testid="input-primarySSN"
data-testid="input-mailingAddress"
data-testid="input-city"
data-testid="input-zipCode"

// Step 2: Household
data-testid="select-maritalStatusDec31"
data-testid="option-single"

// Step 3: Income
data-testid="checkbox-hasW2Income"
```

### IRSConsentReview Component (`client/src/components/IRSConsentReview.tsx`)

**Status:** ✅ Already has most required attributes

```typescript
// Benefit programs (already present)
data-testid="checkbox-program-snap"
data-testid="checkbox-program-medicaid"
data-testid="checkbox-program-tca"
data-testid="checkbox-program-ohep"

// Signature and acknowledgments (already present)
data-testid="input-signature"
data-testid="checkbox-read-form"
data-testid="checkbox-agree"
data-testid="button-submit-consent"
```

## Test Coverage

### Integration Tests Coverage

| Test Case | Coverage |
|-----------|----------|
| Form retrieval by code | ✅ |
| Form retrieval - 404 error | ✅ |
| Authentication required | ✅ |
| Consent recording with metadata | ✅ |
| Missing required fields - 400 error | ✅ |
| Invalid form ID - 404 error | ✅ |
| Session consent retrieval | ✅ |
| Empty session consent list | ✅ |

### E2E Tests Coverage

| Test Case | Coverage |
|-----------|----------|
| Full VITA intake flow | ✅ Code ready |
| IRS consent form display | ✅ Code ready |
| Benefit program selection | ✅ Code ready |
| Form validation logic | ✅ Code ready |
| Consent submission | ✅ Code ready |
| Duplicate prevention | ✅ Code ready |
| All benefit programs visible | ✅ Code ready |

## Running Tests in Different Environments

### Replit Environment
```bash
# Integration tests only (E2E requires local environment)
npx vitest run tests/integration/irsConsent.test.ts
```

### Local Development
```bash
# Install Playwright browsers first
npx playwright install chromium

# Run all tests
npm test                    # Integration tests
npx playwright test        # E2E tests

# Run both together
npm run test:all
```

### CI/CD Pipeline
```yaml
# Example GitHub Actions workflow
- name: Run Integration Tests
  run: npx vitest run

- name: Install Playwright Browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E Tests
  run: npx playwright test
```

## Configuration Files

### Playwright Config (`playwright.config.ts`)
- Test directory: `./tests/e2e`
- Base URL: `http://localhost:5000`
- Browser: Chromium
- Auto-start dev server: Yes

### Vitest Config (`vitest.config.ts`)
- Test environment: happy-dom
- Setup file: `./tests/setup.ts`
- Test pattern: `tests/**/*.{test,spec}.{ts,tsx}`

## Known Limitations

1. **Replit Environment**: Playwright browsers cannot be installed in Replit due to system dependency restrictions. E2E tests will only work in local or CI/CD environments with browser support.

2. **Data-TestId Attributes**: Most form inputs in VitaIntake.tsx need `data-testid` attributes added for E2E tests to work properly.

3. **Test Data**: Integration tests create test data during execution and clean up after. Ensure database has required seed data.

## Success Criteria Checklist

- ✅ Integration tests created with full API coverage
- ✅ E2E tests created with complete user flow
- ✅ GET /api/consent/forms/:code tested
- ✅ POST /api/consent/client-consents tested with metadata
- ✅ GET /api/consent/client-consents/vita-session/:sessionId tested
- ✅ Error handling (404, 400) tested
- ✅ No TypeScript/LSP errors
- ✅ Playwright configuration complete
- ⚠️ data-testid attributes need to be added to VitaIntake component
- ⚠️ E2E tests require Playwright browsers (local environment only)

## Next Steps

1. **Add Data-TestId Attributes**: Add the required `data-testid` attributes to the VitaIntake component form inputs
2. **Install Playwright Browsers**: Run `npx playwright install chromium` in a local environment
3. **Run Tests**: Execute integration tests with `npx vitest run` and E2E tests with `npx playwright test`
4. **Verify Coverage**: Ensure all test cases pass and provide expected coverage

## Troubleshooting

### Integration Tests Fail
- Ensure server is running on port 5000
- Verify database has IRS consent form seeded
- Check demo.supervisor user exists with correct credentials

### E2E Tests Fail
- Verify Playwright browsers are installed
- Ensure all data-testid attributes are present
- Check server is accessible at http://localhost:5000
- Review Playwright trace files for debugging

### TypeScript Errors
- Run `npm run check` to verify TypeScript compilation
- Ensure all imports use relative paths for shared schema
- Check vitest.config.ts has correct path aliases

## Support

For issues or questions about these tests, please refer to:
- Test helper utilities: `tests/utils/testHelpers.ts`
- Test setup file: `tests/setup.ts`
- Playwright documentation: https://playwright.dev
- Vitest documentation: https://vitest.dev
