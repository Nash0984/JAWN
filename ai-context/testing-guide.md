# Testing Guide

Comprehensive testing strategies for the Maryland Benefits Navigator system.

## Table of Contents

1. [Testing Stack](#testing-stack)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [Component Testing](#component-testing)
5. [E2E Testing](#e2e-testing)
6. [Testing AI/Gemini Services](#testing-aigemini-services)
7. [Database Testing](#database-testing)
8. [Test Coverage](#test-coverage)
9. [CI/CD Integration](#cicd-integration)

---

## Testing Stack

**Core Libraries:**
- **Vitest** - Test runner and assertion library
- **@testing-library/react** - Component testing utilities
- **@testing-library/user-event** - User interaction simulation
- **supertest** - API integration testing
- **happy-dom** - Lightweight DOM for component tests

**Test Directory Structure:**
```
tests/
├── setup.ts              # Test setup and global config
├── unit/                 # Unit tests (components, utilities, services)
│   ├── Button.test.tsx
│   ├── storage.test.ts
│   └── validation.test.ts
├── integration/          # Integration tests (API routes, RAG, database)
│   ├── auth.test.ts
│   ├── documents.test.ts
│   └── ragService.test.ts
└── e2e/                  # End-to-end tests (Playwright)
    └── auth.spec.ts
```

**Commands:**
```bash
npm run test              # Run all tests
npm run test:ui           # Run tests with UI
npm run test:coverage     # Generate coverage report
npm run test:watch        # Watch mode
```

---

## Unit Testing

### Service Layer Testing

**Pattern: Testing Storage Methods**

```typescript
// tests/unit/storage.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "../../server/db";
import { DbStorage } from "../../server/storage";
import { users, benefitPrograms } from "@shared/schema";
import { eq } from "drizzle-orm";

describe("DbStorage", () => {
  let storage: DbStorage;
  
  beforeEach(async () => {
    storage = new DbStorage();
    // Clean test data
    await db.delete(users);
  });
  
  afterEach(async () => {
    // Cleanup
    await db.delete(users);
  });
  
  it("should create a user", async () => {
    const userData = {
      username: "testuser",
      password: "hashedpassword",
      email: "test@example.com",
      role: "client" as const,
    };
    
    const user = await storage.createUser(userData);
    
    expect(user).toBeDefined();
    expect(user.username).toBe("testuser");
    expect(user.email).toBe("test@example.com");
    expect(user.password).toBeUndefined(); // Password should not be returned
  });
  
  it("should get user by id", async () => {
    const [created] = await db.insert(users).values({
      username: "testuser",
      password: "hashedpassword",
      role: "client",
    }).returning();
    
    const user = await storage.getUser(created.id);
    
    expect(user).toBeDefined();
    expect(user?.id).toBe(created.id);
  });
  
  it("should return null for non-existent user", async () => {
    const user = await storage.getUser("non-existent-id");
    expect(user).toBeNull();
  });
});
```

**Pattern: Testing Utility Functions**

```typescript
// tests/unit/validation.test.ts
import { describe, it, expect } from "vitest";
import { validateEmail, validatePhoneNumber } from "../../server/utils/validation";

describe("Validation Utilities", () => {
  describe("validateEmail", () => {
    it("should validate correct emails", () => {
      expect(validateEmail("user@example.com")).toBe(true);
      expect(validateEmail("test.user@domain.co.uk")).toBe(true);
    });
    
    it("should reject invalid emails", () => {
      expect(validateEmail("invalid")).toBe(false);
      expect(validateEmail("@example.com")).toBe(false);
      expect(validateEmail("user@")).toBe(false);
    });
  });
  
  describe("validatePhoneNumber", () => {
    it("should validate Maryland phone numbers", () => {
      expect(validatePhoneNumber("410-555-1234")).toBe(true);
      expect(validatePhoneNumber("(410) 555-1234")).toBe(true);
      expect(validatePhoneNumber("4105551234")).toBe(true);
    });
    
    it("should reject invalid phone numbers", () => {
      expect(validatePhoneNumber("123")).toBe(false);
      expect(validatePhoneNumber("abc-def-ghij")).toBe(false);
    });
  });
});
```

---

## Integration Testing

### API Endpoint Testing

**Pattern: Testing Express Routes**

```typescript
// tests/integration/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../server/index";
import { db } from "../../server/db";
import { users } from "@shared/schema";

describe("Authentication Routes", () => {
  beforeAll(async () => {
    // Setup test database
    await db.delete(users);
  });
  
  afterAll(async () => {
    // Cleanup
    await db.delete(users);
  });
  
  describe("POST /api/auth/signup", () => {
    it("should create a new user", async () => {
      const response = await request(app)
        .post("/api/auth/signup")
        .send({
          username: "newuser",
          password: "SecurePassword123!",
          email: "newuser@example.com",
        })
        .expect(201);
      
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe("newuser");
      expect(response.body.user.password).toBeUndefined();
    });
    
    it("should reject duplicate username", async () => {
      // Create first user
      await request(app)
        .post("/api/auth/signup")
        .send({
          username: "duplicate",
          password: "Password123!",
        });
      
      // Try to create duplicate
      const response = await request(app)
        .post("/api/auth/signup")
        .send({
          username: "duplicate",
          password: "AnotherPassword123!",
        })
        .expect(400);
      
      expect(response.body.error).toContain("already exists");
    });
    
    it("should validate password requirements", async () => {
      const response = await request(app)
        .post("/api/auth/signup")
        .send({
          username: "weakpass",
          password: "123", // Too weak
        })
        .expect(400);
      
      expect(response.body.error).toBeDefined();
    });
  });
  
  describe("POST /api/auth/login", () => {
    beforeAll(async () => {
      // Create test user
      await request(app)
        .post("/api/auth/signup")
        .send({
          username: "logintest",
          password: "TestPassword123!",
        });
    });
    
    it("should login with correct credentials", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "logintest",
          password: "TestPassword123!",
        })
        .expect(200);
      
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe("logintest");
    });
    
    it("should reject incorrect password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "logintest",
          password: "WrongPassword",
        })
        .expect(401);
      
      expect(response.body.error).toContain("Invalid");
    });
    
    it("should reject non-existent user", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "nonexistent",
          password: "AnyPassword",
        })
        .expect(401);
      
      expect(response.body.error).toBeDefined();
    });
  });
  
  describe("GET /api/auth/me", () => {
    it("should return current user when authenticated", async () => {
      // Login first
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          username: "logintest",
          password: "TestPassword123!",
        });
      
      const cookies = loginResponse.headers['set-cookie'];
      
      // Get current user
      const response = await request(app)
        .get("/api/auth/me")
        .set("Cookie", cookies)
        .expect(200);
      
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe("logintest");
    });
    
    it("should return 401 when not authenticated", async () => {
      await request(app)
        .get("/api/auth/me")
        .expect(401);
    });
  });
});
```

**Pattern: Testing Protected Routes**

```typescript
// tests/integration/documents.test.ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../server/index";

describe("Document Routes", () => {
  let authCookie: string[];
  let adminCookie: string[];
  
  beforeAll(async () => {
    // Create and login test user
    await request(app).post("/api/auth/signup").send({
      username: "docuser",
      password: "Password123!",
      role: "client",
    });
    
    const userLogin = await request(app).post("/api/auth/login").send({
      username: "docuser",
      password: "Password123!",
    });
    authCookie = userLogin.headers['set-cookie'];
    
    // Create and login admin
    await request(app).post("/api/auth/signup").send({
      username: "docadmin",
      password: "AdminPass123!",
      role: "admin",
    });
    
    const adminLogin = await request(app).post("/api/auth/login").send({
      username: "docadmin",
      password: "AdminPass123!",
    });
    adminCookie = adminLogin.headers['set-cookie'];
  });
  
  describe("GET /api/documents", () => {
    it("should require authentication", async () => {
      await request(app)
        .get("/api/documents")
        .expect(401);
    });
    
    it("should return user's documents", async () => {
      const response = await request(app)
        .get("/api/documents")
        .set("Cookie", authCookie)
        .expect(200);
      
      expect(response.body.documents).toBeDefined();
      expect(Array.isArray(response.body.documents)).toBe(true);
    });
  });
  
  describe("POST /api/documents", () => {
    it("should create document with valid data", async () => {
      const response = await request(app)
        .post("/api/documents")
        .set("Cookie", authCookie)
        .send({
          filename: "test.pdf",
          objectPath: "documents/test.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
        })
        .expect(201);
      
      expect(response.body.document).toBeDefined();
      expect(response.body.document.filename).toBe("test.pdf");
    });
  });
});
```

---

## Component Testing

### React Component Testing

**Pattern: Testing UI Components**

```typescript
// tests/unit/Button.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button Component", () => {
  it("should render button text", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText("Click Me")).toBeInTheDocument();
  });
  
  it("should call onClick handler", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click Me</Button>);
    
    await user.click(screen.getByText("Click Me"));
    
    expect(handleClick).toHaveBeenCalledOnce();
  });
  
  it("should be disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled Button</Button>);
    
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });
  
  it("should apply variant classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    
    const button = screen.getByRole("button");
    expect(button).toHaveClass("destructive");
  });
});
```

**Pattern: Testing Forms**

```typescript
// tests/unit/FormComponent.test.tsx
// Generic form testing pattern - adapt imports to your actual components
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
// Example import: import YourFormComponent from "@/pages/YourPage";

// Mock form component for testing pattern
const LoginForm = ({ onSuccess }: { onSuccess?: () => void }) => (
  <form onSubmit={(e) => { e.preventDefault(); onSuccess?.(); }}>
    <label htmlFor="username">Username</label>
    <input id="username" name="username" required />
    <label htmlFor="password">Password</label>
    <input id="password" name="password" type="password" required />
    <button type="submit">Login</button>
  </form>
);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe("Form Component Testing Pattern", () => {
  it("should render form fields", () => {
    render(<LoginForm />, { wrapper });
    
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });
  
  it("should handle form submission", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    
    render(<LoginForm onSuccess={onSuccess} />, { wrapper });
    
    await user.type(screen.getByLabelText(/username/i), "testuser");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
  
  // For validation testing, use react-hook-form with zodResolver
  // See actual form components in @/pages/* for real validation examples
});
```

**Pattern: Testing Data Fetching Components**

```typescript
// tests/unit/DocumentList.test.tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import DocumentList from "@/components/DocumentList";

describe("DocumentList", () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });
  
  it("should show loading state", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DocumentList />
      </QueryClientProvider>
    );
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
  
  it("should display documents", async () => {
    // Mock API response
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          documents: [
            { id: "1", filename: "doc1.pdf", status: "ready" },
            { id: "2", filename: "doc2.pdf", status: "processing" },
          ],
        }),
      })
    ) as any;
    
    render(
      <QueryClientProvider client={queryClient}>
        <DocumentList />
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText("doc1.pdf")).toBeInTheDocument();
      expect(screen.getByText("doc2.pdf")).toBeInTheDocument();
    });
  });
  
  it("should show error state", async () => {
    // Mock API error
    global.fetch = vi.fn(() =>
      Promise.reject(new Error("Network error"))
    ) as any;
    
    render(
      <QueryClientProvider client={queryClient}>
        <DocumentList />
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

---

## E2E Testing

### Playwright Setup (Optional)

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should complete signup and login flow", async ({ page }) => {
    // Navigate to signup
    await page.goto("http://localhost:5000/signup");
    
    // Fill signup form
    await page.fill('[data-testid="input-username"]', 'e2euser');
    await page.fill('[data-testid="input-password"]', 'SecurePass123!');
    await page.fill('[data-testid="input-email"]', 'e2e@example.com');
    await page.click('[data-testid="button-signup"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Should see welcome message
    await expect(page.locator('text=Welcome, e2euser')).toBeVisible();
    
    // Logout
    await page.click('[data-testid="button-logout"]');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
    
    // Login again
    await page.fill('[data-testid="input-username"]', 'e2euser');
    await page.fill('[data-testid="input-password"]', 'SecurePass123!');
    await page.click('[data-testid="button-login"]');
    
    // Should be back on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("Document Upload Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("http://localhost:5000/login");
    await page.fill('[data-testid="input-username"]', 'e2euser');
    await page.fill('[data-testid="input-password"]', 'SecurePass123!');
    await page.click('[data-testid="button-login"]');
  });
  
  test("should upload and process document", async ({ page }) => {
    await page.goto("http://localhost:5000/documents");
    
    // Upload file
    const fileInput = page.locator('[data-testid="input-file"]');
    await fileInput.setInputFiles('./fixtures/test-document.pdf');
    
    await page.click('[data-testid="button-upload"]');
    
    // Should show processing status
    await expect(page.locator('[data-testid="status-processing"]')).toBeVisible();
    
    // Wait for processing to complete (with timeout)
    await expect(page.locator('[data-testid="status-ready"]')).toBeVisible({
      timeout: 30000,
    });
    
    // Should be able to view document
    await page.click('[data-testid="button-view"]');
    await expect(page.locator('[data-testid="document-viewer"]')).toBeVisible();
  });
});
```

---

## Testing AI/Gemini Services

### Mocking Gemini API

```typescript
// tests/unit/geminiService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeminiService } from "../../server/services/geminiService";

// Mock GoogleGenerativeAI
vi.mock("@google/genai", () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent: vi.fn(async (prompt: string) => ({
        response: {
          text: () => "Mocked AI response",
        },
      })),
      batchEmbedContents: vi.fn(async () => ({
        embeddings: [
          { values: [0.1, 0.2, 0.3] },
          { values: [0.4, 0.5, 0.6] },
        ],
      })),
    })),
  })),
}));

describe("GeminiService", () => {
  let geminiService: GeminiService;
  
  beforeEach(() => {
    geminiService = new GeminiService();
  });
  
  it("should generate text response", async () => {
    const response = await geminiService.generateText("Test prompt");
    expect(response).toBe("Mocked AI response");
  });
  
  it("should create embeddings", async () => {
    const embeddings = await geminiService.createEmbeddings(["text1", "text2"]);
    
    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toEqual([0.1, 0.2, 0.3]);
    expect(embeddings[1]).toEqual([0.4, 0.5, 0.6]);
  });
  
  it("should handle API errors", async () => {
    // Override mock to throw error
    geminiService.model.generateContent = vi.fn(() =>
      Promise.reject(new Error("API Error"))
    );
    
    await expect(
      geminiService.generateText("Test")
    ).rejects.toThrow("API Error");
  });
});
```

### Testing RAG Service

```typescript
// tests/integration/ragService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ragService } from "../../server/services/ragService";
import { db } from "../../server/db";
import { documents, documentChunks } from "@shared/schema";

vi.mock("../../server/services/geminiService", () => ({
  geminiService: {
    createEmbedding: vi.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
    generateAnswer: vi.fn(() => Promise.resolve("AI generated answer")),
  },
}));

describe("RAG Service", () => {
  beforeEach(async () => {
    // Clean test data
    await db.delete(documentChunks);
    await db.delete(documents);
  });
  
  it("should perform semantic search", async () => {
    // Create test document and chunks
    const [doc] = await db.insert(documents).values({
      filename: "test.pdf",
      status: "ready",
      benefitProgramId: "snap",
    }).returning();
    
    await db.insert(documentChunks).values([
      {
        documentId: doc.id,
        chunkIndex: 0,
        content: "SNAP eligibility rules",
        embeddings: JSON.stringify([0.1, 0.2, 0.3]),
      },
      {
        documentId: doc.id,
        chunkIndex: 1,
        content: "Income limits for SNAP",
        embeddings: JSON.stringify([0.15, 0.25, 0.35]),
      },
    ]);
    
    const result = await ragService.query("What are SNAP income limits?", "snap");
    
    expect(result.answer).toBe("AI generated answer");
    expect(result.citations).toBeDefined();
    expect(result.citations.length).toBeGreaterThan(0);
  });
  
  it("should filter by program", async () => {
    // Create documents for different programs
    const [snapDoc] = await db.insert(documents).values({
      filename: "snap.pdf",
      status: "ready",
      benefitProgramId: "snap",
    }).returning();
    
    const [medicaidDoc] = await db.insert(documents).values({
      filename: "medicaid.pdf",
      status: "ready",
      benefitProgramId: "medicaid",
    }).returning();
    
    // Query for SNAP only
    const result = await ragService.query("Eligibility", "snap");
    
    // Should only return SNAP documents
    expect(result.citations.every(c => c.programId === "snap")).toBe(true);
  });
});
```

---

## Database Testing

### Test Database Setup

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "tests/", "*.config.ts", "dist/", ".replit"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
});
```

```typescript
// tests/setup.ts
import { beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

// Set test environment
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

beforeAll(async () => {
  // Run migrations
  await db.execute(sql`SELECT 1`);
  console.log("Test database connected");
});

afterAll(async () => {
  // Close connections
  await db.$client.end();
});

beforeEach(async () => {
  // Clean all tables before each test
  const tables = [
    "document_chunks",
    "documents",
    "search_queries",
    "notifications",
    "audit_logs",
    "users",
  ];
  
  for (const table of tables) {
    await db.execute(sql.raw(`TRUNCATE TABLE ${table} CASCADE`));
  }
});
```

### Transaction Testing

```typescript
// tests/integration/transactions.test.ts
import { describe, it, expect } from "vitest";
import { db } from "../../server/db";
import { documents, auditLogs } from "@shared/schema";

describe("Database Transactions", () => {
  it("should rollback on error", async () => {
    await expect(async () => {
      await db.transaction(async (tx) => {
        // Create document
        await tx.insert(documents).values({
          filename: "test.pdf",
          status: "processing",
        });
        
        // Create audit log
        await tx.insert(auditLogs).values({
          action: "create_document",
          entityType: "document",
        });
        
        // Intentional error
        throw new Error("Transaction failed");
      });
    }).rejects.toThrow("Transaction failed");
    
    // Verify rollback - no documents created
    const docs = await db.select().from(documents);
    expect(docs).toHaveLength(0);
    
    const logs = await db.select().from(auditLogs);
    expect(logs).toHaveLength(0);
  });
  
  it("should commit on success", async () => {
    await db.transaction(async (tx) => {
      await tx.insert(documents).values({
        filename: "test.pdf",
        status: "processing",
      });
      
      await tx.insert(auditLogs).values({
        action: "create_document",
        entityType: "document",
      });
    });
    
    // Verify commit - documents created
    const docs = await db.select().from(documents);
    expect(docs).toHaveLength(1);
    
    const logs = await db.select().from(auditLogs);
    expect(logs).toHaveLength(1);
  });
});
```

---

## Test Coverage

### Coverage Configuration

```json
// package.json
{
  "scripts": {
    "test:coverage": "vitest run --coverage",
    "test:coverage:ui": "vitest --coverage --ui"
  },
  "vitest": {
    "coverage": {
      "thresholds": {
        "lines": 80,
        "functions": 80,
        "branches": 75,
        "statements": 80
      }
    }
  }
}
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html

# CI/CD integration
npm run test:coverage -- --reporter=json --outputFile=coverage.json
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run database migrations
        run: npm run db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      
      - name: Run tests
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
      
      - name: Run linter
        run: npm run lint
      
      - name: Type check
        run: npm run typecheck
```

---

## Testing Best Practices

### Do's

✅ **Test behavior, not implementation**
- Focus on what the code does, not how it does it
- Test user-facing functionality
- Avoid testing internal state

✅ **Write descriptive test names**
- Use "should" statements: `should return user when credentials are valid`
- Be specific about the scenario being tested

✅ **Use data-testid for stable selectors**
- Add `data-testid` to all interactive elements
- Prefer testids over class names or text content

✅ **Mock external dependencies**
- Mock Gemini API calls
- Mock database in unit tests
- Use test database for integration tests

✅ **Test edge cases**
- Empty states
- Error conditions
- Boundary values
- Invalid inputs

✅ **Keep tests isolated**
- Each test should be independent
- Clean up after each test
- Don't rely on test execution order

### Don'ts

❌ **Don't test third-party libraries**
- Trust that React, Drizzle, etc. work
- Focus on your own logic

❌ **Don't use real API keys in tests**
- Always mock external services
- Use test credentials only

❌ **Don't test implementation details**
- Avoid testing private methods
- Don't assert on internal state

❌ **Don't write brittle tests**
- Avoid hardcoded IDs or timestamps
- Use flexible matchers (toContain, toMatch)

❌ **Don't skip cleanup**
- Always clean test data
- Close connections properly
- Reset mocks between tests

---

## Quick Reference

### Common Assertions

```typescript
// Equality
expect(value).toBe(5);
expect(obj).toEqual({ key: "value" });

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeNull();

// Numbers
expect(num).toBeGreaterThan(5);
expect(num).toBeLessThan(10);
expect(num).toBeCloseTo(0.3);

// Strings
expect(str).toContain("substring");
expect(str).toMatch(/pattern/);

// Arrays
expect(arr).toHaveLength(3);
expect(arr).toContain(item);

// Objects
expect(obj).toHaveProperty("key");
expect(obj).toMatchObject({ key: "value" });

// Functions
expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledWith(arg);
expect(fn).toHaveBeenCalledTimes(2);

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow(error);
```

### Testing Utilities

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

// Render component
render(<Component />);

// Query elements
screen.getByText("text");
screen.getByRole("button");
screen.getByTestId("test-id");
screen.queryByText("text"); // Returns null if not found
screen.findByText("text"); // Async, waits for element

// User interactions
const user = userEvent.setup();
await user.click(button);
await user.type(input, "text");
await user.clear(input);

// Mocking
vi.fn(); // Mock function
vi.mock("module"); // Mock module
vi.spyOn(obj, "method"); // Spy on method

// Wait for assertions
await waitFor(() => {
  expect(element).toBeInTheDocument();
});
```

---

*Last Updated: January 2025*
