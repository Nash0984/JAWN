# Testing Infrastructure

This directory contains the testing infrastructure for the Maryland SNAP Policy Manual System.

## Structure

```
tests/
├── setup.ts              # Global test setup and configuration
├── unit/                 # Unit tests for individual components and utilities
│   ├── components/       # Component tests
│   └── utils.test.ts     # Utility function tests
├── integration/          # Integration tests for API endpoints
│   └── api.test.ts       # API integration tests
└── e2e/                  # End-to-end tests (future)
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
npx vitest tests/unit/utils.test.ts
```

## Writing Tests

### Unit Tests
Unit tests should test individual functions, components, or utilities in isolation:

```typescript
import { describe, it, expect } from 'vitest';

describe('MyComponent', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Component Tests
Use React Testing Library for component tests:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('should handle user interaction', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);
  
  const button = screen.getByText('Click me');
  await user.click(button);
  
  expect(screen.getByText('Clicked!')).toBeInTheDocument();
});
```

### Integration Tests
Use Supertest for API integration tests:

```typescript
import request from 'supertest';

it('should return data from API', async () => {
  const response = await request(app)
    .get('/api/endpoint')
    .expect(200);
    
  expect(response.body).toEqual({ data: 'value' });
});
```

## Test Configuration

- **Framework**: Vitest
- **Environment**: happy-dom
- **Coverage Provider**: v8
- **Globals**: Enabled (describe, it, expect available globally)

## Best Practices

1. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
2. **Test Isolation**: Each test should be independent
3. **Descriptive Names**: Use clear, descriptive test names
4. **Mock External Dependencies**: Mock API calls, databases, and external services
5. **Test Edge Cases**: Include tests for error conditions and edge cases

## Coverage Goals

- **Unit Tests**: Aim for 80%+ coverage
- **Integration Tests**: Cover all API endpoints
- **E2E Tests**: Cover critical user workflows

## Adding Test Scripts to package.json

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest watch",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui"
  }
}
```
