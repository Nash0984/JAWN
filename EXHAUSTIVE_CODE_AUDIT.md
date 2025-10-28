# JAWN Platform - Exhaustive Code Audit
**Audit Date:** October 28, 2025  
**Audit Type:** Complete Line-by-Line Code Review  
**Scope:** All 433 TypeScript files, all configurations, all tests, all TODOs, all comments  
**Purpose:** Comprehensive exhaustive documentation of every code detail

---

## Table of Contents
1. [Configuration Files Audit](#1-configuration-files-audit)
2. [Shared Layer Audit](#2-shared-layer-audit) 
3. [Server Layer Audit](#3-server-layer-audit)
4. [Client Layer Audit](#4-client-layer-audit)
5. [Test Suite Audit](#5-test-suite-audit)
6. [TODO Inventory](#6-todo-inventory)
7. [Comment Audit](#7-comment-audit)

---

## 1. Configuration Files Audit

### 1.1 package.json (270 lines)

**Basic Metadata:**
- `name`: "rest-express"
- `version`: "1.0.0"
- `type`: "module" (ES modules enabled)
- `license`: "MIT"

**Build Scripts (lines 6-11):**
```json
"dev": "NODE_ENV=development tsx server/index.ts"
  → Hot reload development server using tsx (TypeScript executor)
  → Sets NODE_ENV to development
  → Entry point: server/index.ts

"build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
  → Two-stage build process:
    1. Vite builds client → dist/public/
    2. esbuild bundles server → dist/index.js
  → Server config:
    - Platform: node
    - External packages: not bundled
    - Format: ESM modules
    - Output: dist/ directory

"start": "NODE_ENV=production node dist/index.js"
  → Production server from built bundle
  → Requires prior `npm run build`

"check": "tsc"
  → TypeScript type checking without emit
  → Validates all types across project

"db:push": "drizzle-kit push"
  → Drizzle ORM schema push to database
  → No manual migrations - auto-sync
```

**Dependencies Analysis (138 total packages):**

**NOTE:** There's a duplicate dependencies issue - two "Dependencies" sections (line 13) and one "dependencies" section (line 166). The lowercase "dependencies" (line 166-268) contains newer versions and overrides the first.

**AI/ML Dependencies:**
- `@google-cloud/storage` (^7.17.2): Google Cloud Storage SDK
- `@google/genai` (^1.27.0): Google Generative AI SDK (main)
- `@google/generative-ai` (^0.24.1): Alternative Gemini SDK
- `openai` (^6.7.0): OpenAI API client
- `axios` (^1.12.2): HTTP client for API calls

**Database & ORM:**
- `@neondatabase/serverless` (^1.0.2): Neon Postgres serverless driver
- `drizzle-orm` (^0.44.7): TypeScript ORM
- `drizzle-zod` (^0.8.3): Zod integration for Drizzle
- `connect-pg-simple` (^10.0.0): PostgreSQL session store

**React & UI Framework:**
- `react` (^19.2.0): React 19 (latest)
- `react-dom` (^19.2.0): React DOM renderer
- `@tanstack/react-query` (^5.90.5): Data fetching/caching
- `wouter` (^3.7.1): Lightweight routing
- `framer-motion` (^12.23.24): Animation library

**Radix UI Components (22 packages):**
All at latest versions (~1.x to ~2.x):
- `@radix-ui/react-accordion` (^1.2.12)
- `@radix-ui/react-alert-dialog` (^1.1.15)
- `@radix-ui/react-avatar` (^1.1.10)
- `@radix-ui/react-checkbox` (^1.3.3)
- `@radix-ui/react-collapsible` (^1.1.12)
- `@radix-ui/react-context-menu` (^2.2.16)
- `@radix-ui/react-dialog` (^1.1.15)
- `@radix-ui/react-dropdown-menu` (^2.1.16)
- `@radix-ui/react-label` (^2.1.7)
- `@radix-ui/react-popover` (^1.1.15)
- `@radix-ui/react-progress` (^1.1.7)
- `@radix-ui/react-radio-group` (^1.3.8)
- `@radix-ui/react-scroll-area` (^1.2.10)
- `@radix-ui/react-select` (^2.2.6)
- `@radix-ui/react-separator` (^1.1.7)
- `@radix-ui/react-slot` (^1.2.3)
- `@radix-ui/react-switch` (^1.2.6)
- `@radix-ui/react-tabs` (^1.1.13)
- `@radix-ui/react-toast` (^1.2.15)
- `@radix-ui/react-tooltip` (^1.2.8)

**Styling & Design:**
- `tailwindcss` (^3.4.18 in devDependencies): Utility-first CSS
- `class-variance-authority` (^0.7.1): CVA for variant styling
- `tailwind-merge` (^3.3.1): Merge Tailwind classes
- `tailwindcss-animate` (^1.0.7): Animation utilities
- `clsx` (^2.1.1): className utility
- `lucide-react` (^0.548.0): Icon library
- `react-icons` (^5.5.0): Additional icons
- `next-themes` (^0.4.6): Theme switching

**Express & Server:**
- `express` (^4.21.2): Web framework
- `compression` (^1.8.1): Response compression
- `cors` (^2.8.5): CORS middleware
- `helmet` (^8.1.0): Security headers
- `cookie-parser` (^1.4.7): Cookie parsing
- `csrf-csrf` (^4.0.3): CSRF protection
- `express-rate-limit` (^8.1.0): Rate limiting
- `express-session` (^1.18.2): Session management
- `passport` (^0.8.0): Authentication middleware
- `passport-local` (^1.0.0): Local strategy

**Authentication & Security:**
- `bcryptjs` (^2.4.3): Password hashing
- `otplib` (^13.0.0): OTP generation (MFA/2FA)
- `qrcode` (^1.5.4): QR code generation

**Document Processing:**
- `mammoth` (^1.9.1): DOCX to HTML conversion
- `pdf-parse` (^1.1.1): PDF parsing
- `sharp` (^0.34.1): Image processing
- `cheerio` (^1.0.0): HTML parsing
- `xml2js` (^0.6.2): XML parsing

**Data & File Processing:**
- `exceljs` (^4.4.0): Excel file handling
- `papaparse` (^5.4.1): CSV parsing
- `json2csv` (^7.0.3): JSON to CSV conversion
- `jspdf` (^2.6.1): PDF generation
- `jspdf-autotable` (^3.8.5): PDF tables

**File Upload:**
- `multer` (^1.4.5-lts.1): Multipart form data handling
- `@uppy/core` (^4.6.0): File upload core
- `@uppy/aws-s3` (^4.4.0): AWS S3 integration
- `@uppy/dashboard` (^4.4.0): Upload UI
- `@uppy/react` (^4.1.0): React components
- `@uppy/xhr-upload` (^4.3.0): XHR upload

**Monitoring & Error Tracking:**
- `@sentry/node` (^9.1.0): Node.js error tracking
- `@sentry/react` (^9.1.0): React error tracking
- `@sentry/profiling-node` (^9.1.0): Performance profiling

**Utilities:**
- `date-fns` (^4.1.0): Date manipulation
- `nanoid` (^5.0.9): ID generation
- `zod` (^3.24.1): Schema validation
- `zod-validation-error` (^4.1.1): Validation error formatting

**Testing:**
- `@playwright/test` (^1.50.1): E2E testing
- `vitest` (^3.0.7): Unit testing framework
- `@vitest/ui` (^3.0.7): Vitest UI
- `@testing-library/react` (^16.1.0): React testing utilities
- `@testing-library/user-event` (^14.5.2): User event simulation
- `@testing-library/jest-dom` (^6.6.4): DOM matchers
- `happy-dom` (^16.8.1): Lightweight DOM for tests
- `supertest` (^7.0.0): HTTP assertion library

**Development:**
- `typescript` (^5.6.3): TypeScript compiler
- `tsx` (^4.19.2): TypeScript executor
- `vite` (^7.0.7): Build tool
- `@vitejs/plugin-react` (^4.4.1): Vite React plugin
- `esbuild` (^0.24.2): JavaScript bundler
- `postcss` (^8.4.49): CSS processor
- `autoprefixer` (^10.4.20): CSS vendor prefixes

---

### 1.2 tsconfig.json (31 lines)

**TypeScript Compiler Configuration:**

**Compiler Options (lines 3-20):**
```json
"target": "ES2020"           // ECMAScript 2020 features
"useDefineForClassFields": true  // Class field semantics
"lib": ["ES2020", "DOM", "DOM.Iterable"]  // Available libraries
"module": "ESNext"           // Use latest ES module syntax
"skipLibCheck": true         // Skip type checking of declaration files
"resolveJsonModule": true    // Import JSON files

// Bundler mode
"moduleResolution": "bundler"  // Modern module resolution
"allowImportingTsExtensions": true  // Allow .ts/.tsx in imports
"isolatedModules": true      // Each file can be transpiled independently
"moduleDetection": "force"   // Treat all files as modules
"noEmit": true               // Don't emit compiled files (Vite handles this)
"jsx": "react-jsx"           // Automatic JSX runtime (no React import needed)

// Linting
"strict": true               // Enable all strict type checking
"noUnusedLocals": true       // Error on unused locals
"noUnusedParameters": true   // Error on unused parameters
"noFallthroughCasesInSwitch": true  // Error on switch fallthrough
```

**Include (line 22):**
```json
"include": ["client/src", "shared"]
```
- Compiles frontend code (client/src) and shared types
- **Note:** Server code not included - compiled separately by tsx/esbuild

**References (lines 23-25):**
```json
"references": [{ "path": "./tsconfig.node.json" }]
```
- Links to Node.js-specific config for Vite

---

### 1.3 tsconfig.node.json (10 lines)

**Node.js TypeScript Configuration (for Vite config files):**

**Compiler Options (lines 3-6):**
```typescript
target: "ES2022"             // Modern Node.js features
lib: ["ES2023"]              // Latest ECMAScript library
module: "ESNext"             // ES modules
skipLibCheck: true           // Skip declaration file checks
```

**Include (line 8):**
```json
"include": ["vite.config.ts"]
```
- Only for Vite configuration file

---

### 1.4 vite.config.ts (48 lines)

**Vite Build Tool Configuration:**

**Imports (lines 1-4):**
- `defineConfig` from "vite"
- `react` plugin from "@vitejs/plugin-react"
- `resolve` from "path"

**Configuration Object:**

**Plugins (line 6):**
```typescript
plugins: [react()]  // Enable React Fast Refresh and JSX
```

**Resolve Aliases (lines 7-11):**
```typescript
"@": path.resolve(__dirname, "./client/src"),
"@shared": path.resolve(__dirname, "./shared"),
"@assets": path.resolve(__dirname, "./attached_assets"),
```
- `@`: Maps to client/src for component imports
- `@shared`: Shared types/schemas between client & server
- `@assets`: User-attached assets (images, etc.)

**Build Configuration (lines 13-21):**
```typescript
outDir: "./dist/public",     // Output to dist/public
emptyOutDir: true,           // Clean before build
rollupOptions: {
  output: {
    manualChunks: {
      vendor: ["react", "react-dom"],  // Separate vendor bundle
    },
  },
},
```
- Frontend builds to dist/public/
- Vendor code split for better caching

**Server Configuration (lines 23-46):**
```typescript
port: 5000,                  // Development server port
strictPort: true,            // Fail if port unavailable
proxy: {
  "/api": {
    target: "http://localhost:5000",  // Proxy API to Express
    changeOrigin: true,
  },
},
```
- Dev server runs on port 5000
- API requests proxied to Express backend
- Enables full-stack development on single port

---

### 1.5 drizzle.config.ts (11 lines)

**Drizzle ORM Configuration:**

**Config Object (lines 4-10):**
```typescript
schema: "./shared/schema.ts",         // Schema definition location
out: "./drizzle",                     // Migration output (unused - using push)
dialect: "postgresql",                // Database type
dbCredentials: {
  url: process.env.DATABASE_URL!,     // Connection string from env
},
```

**Key Points:**
- Schema: shared/schema.ts contains all table definitions
- Push mode: Using `drizzle-kit push` instead of migrations
- PostgreSQL: Neon serverless database
- Environment-based: DATABASE_URL from .env

---

### 1.6 tailwind.config.ts (232 lines)

**Tailwind CSS Configuration:**

**Content Paths (line 5):**
```typescript
"./client/src/**/*.{ts,tsx}"  // Scan all TypeScript/React files for classes
```

**Dark Mode (line 6):**
```typescript
darkMode: ["class"]  // Toggle dark mode via .dark class on html element
```

**Theme Extensions (lines 7-188):**

**Container (lines 9-16):**
```typescript
container: {
  center: true,
  padding: "2rem",
  screens: {
    "2xl": "1400px",  // Max width for largest screens
  },
}
```

**Colors - Multi-Tenant Theming (lines 18-138):**
```typescript
// Brand colors (tenant-specific)
"brand-primary": "hsl(var(--brand-primary))",
"brand-secondary": "hsl(var(--brand-secondary))",
"brand-accent": "hsl(var(--brand-accent))",

// Semantic colors
background: "hsl(var(--background))",
foreground: "hsl(var(--foreground))",
card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
// ... (full shadcn color system)
```
- All colors use CSS variables from index.css
- Supports multi-tenant branding via --brand-* variables
- Full shadcn color palette included

**Border Radius (lines 140-147):**
```typescript
borderRadius: {
  lg: "var(--radius)",
  md: "calc(var(--radius) - 2px)",
  sm: "calc(var(--radius) - 4px)",
}
```

**Government UI Focus Indicators (lines 149-152):**
```typescript
govFocus: "0 0 0 3px rgba(0, 123, 255, 0.5)",  // WCAG AA compliant
govFocusDark: "0 0 0 3px rgba(255, 255, 255, 0.5)",
```
- WCAG 2.1 AA compliant focus indicators
- Supports government accessibility requirements

**Touch Targets (lines 154-157):**
```typescript
touch: "44px",  // WCAG 2.1 minimum touch target size
```

**Keyframes & Animations (lines 159-186):**
```typescript
keyframes: {
  "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
  "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
  // ... (11 total animations for shadcn components)
}
animation: {
  "accordion-down": "accordion-down 0.2s ease-out",
  "accordion-up": "accordion-up 0.2s ease-out",
  // ... (11 total animation utilities)
}
```
- Custom animations for Radix UI components
- Smooth transitions for accordions, dialogs, toasts, etc.

**Plugins (lines 190-198):**
```typescript
require("tailwindcss-animate"),           // Animation utilities
require("@tailwindcss/typography"),       // Prose styling
require("@tailwindcss/vite"),            // Vite integration
```

**Typography Plugin Config (lines 200-230):**
```typescript
typography: {
  DEFAULT: {
    css: {
      maxWidth: "65ch",  // Optimal reading width
      color: "hsl(var(--foreground))",
      a: { color: "hsl(var(--primary))" },
      strong: { color: "hsl(var(--foreground))" },
      // ... (full prose styling configuration)
    },
  },
}
```
- Configured for policy manual rendering
- Supports dark mode
- Optimized for readability

---

### 1.7 components.json (20 lines)

**shadcn/ui CLI Configuration:**

**Schema Version (line 2):**
```json
"$schema": "https://ui.shadcn.com/schema.json"
```

**Style Config (lines 3-6):**
```json
"style": "new-york",
"rsc": false,
"tsx": true,
```
- Style: New York design variant
- RSC: Not using React Server Components
- TSX: Using TypeScript

**Tailwind Config (lines 7-11):**
```json
{
  "config": "tailwind.config.ts",
  "css": "client/src/index.css",
  "baseColor": "neutral",
  "cssVariables": true,
  "prefix": ""
}
```
- Links to tailwind.config.ts
- Global styles in client/src/index.css
- Base color: neutral gray scale
- CSS variables enabled (for theming)
- No prefix on utility classes

**Path Aliases (lines 13-19):**
```json
"aliases": {
  "components": "@/components",
  "utils": "@/lib/utils",
  "ui": "@/components/ui",
  "lib": "@/lib",
  "hooks": "@/hooks"
}
```
- Used by shadcn CLI to generate components in correct locations

---

### 1.8 playwright.config.ts (27 lines)

**Test Configuration:**

**Test Directory (line 4):**
- `testDir: './tests'`: All tests in /tests directory

**Parallelization (line 5):**
- `fullyParallel: true`: Run all tests in parallel

**CI Settings (lines 6-8):**
```typescript
forbidOnly: !!process.env.CI,     // Disallow .only() in CI
retries: process.env.CI ? 2 : 0,  // 2 retries in CI, 0 locally
workers: process.env.CI ? 1 : undefined,  // 1 worker in CI, auto locally
```

**Reporter (line 9):**
- `reporter: 'html'`: HTML test report

**Use Options (lines 10-14):**
```typescript
baseURL: 'http://localhost:5000',
trace: 'on-first-retry',         // Capture trace on retry
screenshot: 'only-on-failure',   // Screenshot only failures
```

**Projects (lines 15-20):**
```typescript
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  }
]
```
- Single browser: Chromium (Desktop Chrome)
- Could add Firefox, WebKit for cross-browser testing

**Web Server (lines 21-26):**
```typescript
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:5000',
  reuseExistingServer: !process.env.CI,
  timeout: 120000,  // 2 minutes
}
```
- Auto-starts dev server before tests
- Reuses existing server locally (faster iteration)
- 2-minute timeout for server startup

---

### 1.9 vitest.config.ts (34 lines)

**Vitest + React Configuration:**

**Plugins (line 6):**
- `react()`: Enables JSX transformation for React components

**Test Configuration (lines 7-23):**

**Globals (line 8):**
- `globals: true`: describe, it, expect available globally (no imports)

**Environment (line 9):**
- `environment: 'happy-dom'`: Lightweight DOM for Node.js (faster than jsdom)

**Setup Files (line 10):**
- `setupFiles: ['./tests/setup.ts']`: Run before each test file

**Include Pattern (line 11):**
- `include: ['tests/**/*.{test,spec}.{ts,tsx}']`
- Matches: tests/foo.test.ts, tests/bar.spec.tsx, etc.

**Coverage Configuration (lines 12-22):**
```typescript
coverage: {
  provider: 'v8',                    // V8 coverage (built-in)
  reporter: ['text', 'json', 'html'], // Multiple formats
  exclude: [
    'node_modules/',
    'tests/',
    '*.config.ts',
    'dist/',
    '.replit',
  ],
}
```

**Path Aliases (lines 24-29):**
Same as vite.config.ts:
- `@`: client/src
- `@shared`: shared
- `@assets`: attached_assets

**ESBuild Configuration (lines 31-33):**
```typescript
esbuild: {
  jsx: 'automatic',  // Automatic JSX runtime (no import React)
}
```

---

### 1.10 ecosystem.config.js (195 lines)

**PM2 Production Deployment Configuration**

**Already documented in CODE_INVENTORY.md section 5g**

Summary:
- 3 processes: jawn-api (cluster), jawn-worker (2 instances), jawn-scheduler (fork)
- Auto-scaling, health checks, logging
- Production environment: 100 max DB connections, Redis cluster, full security stack
- Deployment automation for production and staging

---

### 1.11 .env.example (Read separately)

Will document environment variables structure.

---

## Configuration Audit Summary

**Total Configuration Files:** 11
**Total Lines Documented:** ~900 lines

**Key Findings:**
1. **Duplicate dependencies** in package.json (Dependencies vs dependencies)
2. **No ESLint/Prettier configs** - code style not enforced
3. **Production-ready** PM2 cluster configuration
4. **Comprehensive accessibility** features in Tailwind (gov-focus, touch-target)
5. **Multi-tenant theming** via CSS variables (brand-primary, brand-secondary)
6. **Modern stack**: React 19, TypeScript 5.6, Vite 7, Drizzle 0.44
7. **Testing**: Playwright (E2E), Vitest (unit), Happy-DOM (lightweight)
8. **Security**: Helmet, CORS, CSRF, rate limiting, password hashing

**Recommendations:**
- Add ESLint + Prettier for consistent code style
- Fix duplicate dependencies in package.json
- Add .env.example documentation
- Consider adding more Playwright browser targets (Firefox, Safari)

---

## 2. Shared Layer Audit

### 2.1 shared/schema.ts (8,678 lines, 188 database tables)

**File Purpose:** Drizzle ORM schema defining all database tables, relations, insert schemas, and TypeScript types for the entire JAWN platform.

**Audit Status:** Lines 1-4,132 read (48% complete), 100+ tables documented
**Remaining:** Lines 4,133-8,678 (52% remaining, ~88 tables)

---

#### 2.1.1 Imports and Setup (lines 1-6)

```typescript
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean, uuid, real, index, uniqueIndex, date, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
```

**Key Imports:**
- **Drizzle ORM core**: pgTable builder, column types, index builders
- **Relations**: Define foreign key relationships
- **Zod integration**: Generate validation schemas from Drizzle tables
- **SQL helper**: Raw SQL expressions (for defaults like gen_random_uuid())

**Column Types Used:**
- `varchar`: Variable-length strings (IDs, short text)
- `text`: Unlimited length text
- `timestamp`: Date/time with timezone
- `jsonb`: JSON binary (structured data, arrays)
- `integer`: 32-bit integers (counts, amounts in cents)
- `boolean`: True/false flags
- `real`: Floating point numbers (scores, percentages)
- `date`: Date only (no time)
- `serial`: Auto-incrementing integers

---

#### 2.1.2 Core User and Authentication Tables

##### **Table: users** (lines 7-43)
**Purpose:** Central user accounts table with multi-tenant isolation, MFA, VITA certification, and data retention.

**Key Fields:**
- `id`: varchar, UUID primary key (gen_random_uuid())
- `username`: text, unique, not null
- `password`: text, bcrypt hashed, not null
- `email`: text, nullable
- `fullName`, `phone`: text, nullable
- `role`: text, not null, default "client"
  - Values: client, navigator, caseworker, admin, super_admin

**Multi-Tenant Isolation:**
- `tenantId`: varchar, references tenant table
- `stateTenantId`: varchar, references state tenant (NIST AC-4 compliance boundary)
  - Nullable during migration, will be required post-migration

**Maryland DHS Staff Fields:**
- `dhsEmployeeId`: DHS employee ID for navigators/caseworkers
- `officeLocation`: Local DHS office location

**IRS VITA Certification Tracking:**
- `vitaCertificationLevel`: basic, advanced, military, none
- `vitaCertificationDate`: When certification was earned
- `vitaCertificationExpiry`: Expiration date (typically Dec 31 annually)
- `vitaCertificationNumber`: IRS-issued certification ID

**TaxSlayer Role Tracking:**
- `taxslayerRole`: Administrator, Superuser, Preparer Current Year, Preparer All Years, Interviewer, Reviewer
- Documentation only - not for permission control

**Multi-Factor Authentication (MFA/2FA):**
- `mfaEnabled`: boolean, default false, NIST 800-53 IA-2(1), IRS Pub 1075 requirement
- `mfaSecret`: text, encrypted TOTP secret (Base32 encoded)
- `mfaBackupCodes`: jsonb, array of encrypted backup codes (one-time use)
- `mfaEnrolledAt`: timestamp, when user enrolled in MFA

**Data Retention Tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation):**
- `retentionCategory`: user_account_90d, reference_data_permanent
- `retentionUntil`: timestamp, calculated expiration date
- `scheduledForDeletion`: boolean, soft delete flag, default false
- `deletionApprovedBy`: varchar, admin who approved deletion
- `deletionApprovedAt`: timestamp, when deletion was approved

**Audit:**
- `isActive`: boolean, default true
- `createdAt`: timestamp, defaultNow, not null
- `updatedAt`: timestamp, defaultNow, not null

**Indexes:** None explicitly defined (primary key on id auto-indexed)

---

##### **Table: benefitPrograms** (lines 45-63)
**Purpose:** Define benefit programs (SNAP, Medicaid, TANF, LIHEAP, etc.) with capability flags.

**Key Fields:**
- `id`: varchar, UUID primary key
- `name`: text, not null (e.g., "SNAP", "Medicaid")
- `code`: text, not null, unique (SNAP, MEDICAID, VITA, etc.)
- `description`: text
- `programType`: text, not null, default "benefit"
  - Values: benefit, tax, hybrid
- `stateAgencyName`: text, state-specific agency name (e.g., "Office of Home Energy Programs" for MD LIHEAP)

**Program Capability Flags:**
- `hasRulesEngine`: boolean, default false - supports deterministic rules extraction
- `hasPolicyEngineValidation`: boolean, default false - can verify with PolicyEngine
- `hasConversationalAI`: boolean, default true - supports RAG chat

**Source Configuration:**
- `primarySourceUrl`: text, main policy manual/document URL
- `sourceType`: text (pdf, web_scraping, api)
- `scrapingConfig`: jsonb, configuration for scraping expandable sections

**Audit:**
- `isActive`: boolean, default true
- `createdAt`, `updatedAt`: timestamps

**Indexes:** None explicitly defined

---

##### **Table: programJargonGlossary** (lines 70-85)
**Purpose:** Maps federal program names to state-specific terminology for cross-state collaboration.

**Example:** LIHEAP (federal) → OHEP (Maryland), LIHEAP (Pennsylvania)

**Key Fields:**
- `id`: varchar, UUID primary key
- `federalProgram`: text, not null (LIHEAP, SNAP, TANF, Medicaid, etc.)
- `stateCode`: text (MD, PA, VA, null for national/common terms)
- `localTerm`: text, not null (OHEP, TCA, Food Stamps, etc.)
- `officialName`: text, not null (Office of Home Energy Programs, Temporary Cash Assistance)
- `commonAbbreviation`: text, additional abbreviations
- `description`: text, explanation of the term and its usage
- `isActive`: boolean, default true
- `createdAt`, `updatedAt`: timestamps

**Indexes (lines 82-84):**
- `federalProgramIdx`: index on federalProgram
- `stateCodeIdx`: index on stateCode
- `federalStateIdx`: composite index on (federalProgram, stateCode)

---

#### 2.1.3 Document Management Tables

##### **Table: documentTypes** (lines 87-93)
**Purpose:** Document type taxonomy (POLICY_MANUAL, GUIDANCE, etc.)

**Key Fields:**
- `id`: varchar, UUID primary key
- `name`: text, not null
- `code`: text, not null, unique (POLICY_MANUAL, GUIDANCE, etc.)
- `description`: text
- `isActive`: boolean, default true

**Indexes:** None explicitly defined

---

##### **Table: dhsForms** (lines 95-121)
**Purpose:** Maryland DHS forms library with multi-language support

**Key Fields:**
- `id`: varchar, UUID primary key
- `formNumber`: text, not null (DHS-FIA-9780, DHS-FIA-9711, etc.)
- `name`: text, not null ("OHEP Application", "Request for Assistance", etc.)
- `language`: text, not null, default "en" (en, es, am, ar, bu, zh)
- `languageName`: text, not null, default "English" (English, Spanish, Amharic, Arabic, Burmese, Chinese)
- `version`: text, not null ("2025", "2024-04-01", etc.)
- `programCode`: text (MD_SNAP, MD_OHEP, MD_TANF, MD_MEDICAID, etc.)
- `formType`: text, not null (application, supplemental, change_report, appeal, verification)
- `description`: text
- `objectPath`: text, GCS path to stored PDF
- `sourceUrl`: text, not null, original DHS URL
- `fileSize`: integer, in bytes
- `documentHash`: text, SHA-256 hash for integrity
- `downloadedAt`: timestamp, defaultNow, not null
- `lastModifiedAt`: timestamp, last modified date from source
- `isLatestVersion`: boolean, default true, marks current version
- `isFillable`: boolean, default false, PDF has form fields
- `metadata`: jsonb, additional form-specific metadata
- `createdAt`, `updatedAt`: timestamps

**Indexes (lines 117-120):**
- `languageIdx`: index on language
- `programCodeIdx`: index on programCode
- `formTypeIdx`: index on formType
- `latestVersionIdx`: index on isLatestVersion

---

##### **Table: documents** (lines 123-159)
**Purpose:** Core document storage table with multi-tenant isolation, audit trails, and data retention.

**Key Fields:**
- `id`: varchar, UUID primary key
- `filename`: text, not null
- `originalName`: text, not null
- `objectPath`: text, path in object storage
- `documentTypeId`: varchar, references documentTypes.id
- `benefitProgramId`: varchar, references benefitPrograms.id
- `fileSize`: integer, in bytes
- `mimeType`: text
- `uploadedBy`: varchar, references users.id
- `tenantId`: varchar, multi-tenant isolation

**Processing Status:**
- `status`: text, not null, default "uploaded" (uploaded, processing, processed, failed)
- `processingStatus`: jsonb, detailed processing info
- `qualityScore`: real, 0-1 quality assessment
- `ocrAccuracy`: real, 0-1 OCR accuracy
- `metadata`: jsonb, extracted metadata

**Audit Trail Fields (for golden source documents):**
- `sourceUrl`: text, original URL where document was downloaded from
- `downloadedAt`: timestamp, when document was ingested from source
- `documentHash`: text, SHA-256 hash of original document for integrity
- `isGoldenSource`: boolean, default false, marks official policy documents
- `sectionNumber`: text (e.g., "100", "200", for SNAP manual sections)
- `lastModifiedAt`: timestamp, last modified date from source
- `auditTrail`: jsonb, detailed provenance information

**Data Retention Tracking (CRIT-002: IRS/HIPAA 7-year retention, GDPR storage limitation):**
- `retentionCategory`: text (tax_7yr, benefit_7yr, audit_log_7yr, phi_7yr, user_account_90d, reference_data_permanent)
- `retentionUntil`: timestamp, calculated expiration date
- `scheduledForDeletion`: boolean, default false, soft delete flag
- `deletionApprovedBy`: varchar, admin who approved deletion
- `deletionApprovedAt`: timestamp, when deletion was approved

**Audit:**
- `createdAt`, `updatedAt`: timestamps

**Indexes (lines 156-158):**
- `benefitProgramIdx`: index on benefitProgramId
- `statusIdx`: index on status
- `sectionNumberIdx`: index on sectionNumber

---

##### **Table: documentChunks** (lines 161-175)
**Purpose:** Semantic chunks of documents for RAG search with embeddings

**Key Fields:**
- `id`: varchar, UUID primary key
- `documentId`: varchar, references documents.id with CASCADE delete, not null
- `chunkIndex`: integer, not null
- `content`: text, not null
- `embeddings`: text, JSON string of vector embeddings
- `vectorId`: text, ID in vector database
- `metadata`: jsonb, chunk-specific metadata
- `pageNumber`: integer
- `startOffset`, `endOffset`: integer
- `createdAt`: timestamp

**Indexes (line 174):**
- `documentIdIdx`: index on documentId

---

##### **Table: documentVersions** (lines 212-227)
**Purpose:** Track multiple versions of golden source documents for change detection

**Key Fields:**
- `id`: varchar, UUID primary key
- `documentId`: varchar, references documents.id with CASCADE delete, not null
- `versionNumber`: integer, not null
- `documentHash`: text, not null, SHA-256 hash of this version
- `sourceUrl`: text, not null
- `downloadedAt`: timestamp, not null
- `lastModifiedAt`: timestamp
- `fileSize`: integer
- `httpHeaders`: jsonb, HTTP headers from download
- `changesSummary`: text, summary of what changed
- `auditTrail`: jsonb, full audit information
- `objectPath`: text, path in object storage for this version
- `isActive`: boolean, default true, current active version
- `createdAt`: timestamp

**Indexes:** None explicitly defined

---

#### 2.1.4 Policy and Compliance Tables

##### **Table: policySources** (lines 177-209)
**Purpose:** Track policy sources (federal regulations, state regulations, memos) with automated sync

**Key Fields:**
- `id`: varchar, UUID primary key
- `name`: text, not null
- `sourceType`: text, not null (federal_regulation, state_regulation, federal_guidance, state_policy, federal_memo)
- `jurisdiction`: text, not null (federal, maryland) - **LEGACY - use jurisdictionLevel instead**

**Multi-Jurisdiction Support (Production-ready for MD, conceptual for PA/VA):**
- `jurisdictionLevel`: text (federal, state, municipal, county)
- `stateCode`: text (MD, PA, VA, etc., null for federal)
- `municipalityCode`: text (PHILADELPHIA, etc., null for non-municipal)
- `countyCode`: text, for county-level regulations
- `sourceEditionYear`: text ("2025", "2024" for legal compliance and version tracking)
- `regulatoryCitation`: text, full citation (e.g., "7 CFR § 273.9(d)(1)", "COMAR 07.03.17.04")
- `complianceNotes`: text, regulatory context, waivers, special provisions
- `description`: text
- `url`: text
- `benefitProgramId`: varchar, references benefitPrograms.id

**Automated Sync Configuration:**
- `syncType`: text, not null (manual, api, web_scraping, bulk_download, direct_download)
- `syncSchedule`: text (off, weekly, bi-weekly, monthly, custom)
- `maxAllowedFrequency`: text, maximum frequency admin can set (weekly, bi-weekly, monthly)
- `syncConfig`: jsonb, configuration for automated sync (cron expression for custom)
- `lastSyncAt`: timestamp
- `lastSuccessfulSyncAt`: timestamp
- `syncStatus`: text, default "idle" (idle, syncing, success, error)
- `syncError`: text
- `documentCount`: integer, default 0
- `priority`: integer, default 0, higher priority sources synced first
- `hasNewData`: boolean, default false, true if new data detected in last sync

**Rules as Code Status:**
- `racStatus`: text (production_ready, in_progress, planned, auto_update, null)
- `racCodeLocation`: text, link to implementing code file

**Audit:**
- `isActive`: boolean, default true
- `createdAt`, `updatedAt`: timestamps

**Indexes:** None explicitly defined

---

##### **Table: policyWaivers** (lines 230-251)
**Purpose:** FNS waivers and state-specific compliance exceptions

**Key Fields:**
- `id`: varchar, UUID primary key
- `waiverCode`: text, not null, unique (FNS_ABAWD_MD_2024, SNAP_BBCE_PA, etc.)
- `waiverName`: text, not null
- `benefitProgramId`: varchar, references benefitPrograms.id
- `policySourceId`: varchar, references policySources.id, link to authorizing regulation

**Jurisdiction:**
- `jurisdictionLevel`: text, not null (federal, state, county)
- `stateCode`: text (MD, PA, VA, null for federal waivers)
- `countyCode`: text, for county-specific waivers

**Waiver Details:**
- `waiverType`: text, not null (abawd_time_limit, work_requirement, income_test, categorical_eligibility)
- `description`: text, not null
- `authorizingCitation`: text (FNS memo, state regulation, etc.)
- `effectiveDate`: timestamp, not null
- `expirationDate`: timestamp, when waiver expires
- `renewalStatus`: text (pending, approved, denied, expired)
- `impactedPopulation`: jsonb, who is affected by this waiver
- `implementationNotes`: text

**Audit:**
- `isActive`: boolean, default true
- `createdBy`: varchar, references users.id
- `createdAt`, `updatedAt`: timestamps

**Indexes:** None explicitly defined

---

##### **Table: utilityAssistancePrograms** (lines 254-279)
**Purpose:** Philadelphia municipal utilities and state programs (PECO CAP, PGW CRP, Philadelphia Water TAP, etc.)

**Key Fields:**
- `id`: varchar, UUID primary key
- `programCode`: text, not null, unique (PECO_CAP, PGW_CRP, PHILA_WATER_TAP, etc.)
- `programName`: text, not null
- `utilityProvider`: text, not null (PECO, PGW, Philadelphia Water Department)
- `utilityType`: text, not null (electric, gas, water, sewer)

**Jurisdiction:**
- `jurisdictionLevel`: text, not null (state, municipal, county)
- `stateCode`: text, not null (PA, MD, VA)
- `municipalityCode`: text (PHILADELPHIA)
- `countyCode`: text, service area county codes (jsonb array might be better)
- `serviceArea`: jsonb, geographic coverage details
- `description`: text

**Benefit Structure:**
- `benefitType`: text, not null (bill_discount, fixed_rate, debt_forgiveness, crisis_assistance)
- `incomeLimitPercent`: integer, % FPL (e.g., 150 for 150% FPL)
- `fixedIncomePercent`: integer, for programs that cap bills at % of income (e.g., 2-4%)
- `minimumBenefit`: integer, minimum monthly benefit in cents
- `maximumBenefit`: integer, maximum benefit amount in cents
- `requiresLIHEAP`: boolean, default false (PGW CRP requires LIHEAP assignment)
- `autoQualificationSources`: jsonb, programs that auto-qualify (SNAP, LIHEAP, etc.)
- `applicationUrl`: text
- `phoneNumber`: text
- `policySourceId`: varchar, references policySources.id, link to municipal code/regulation

**Audit:**
- `isActive`: boolean, default true
- `createdAt`, `updatedAt`: timestamps

**Indexes:** None explicitly defined

---

##### **Table: utilityVerificationRules** (lines 282-298)
**Purpose:** Cross-program auto-qualification logic for utility assistance

**Key Fields:**
- `id`: varchar, UUID primary key
- `utilityProgramId`: varchar, references utilityAssistancePrograms.id, not null
- `sourceProgramId`: varchar, references benefitPrograms.id, not null (SNAP, LIHEAP, TANF)
- `ruleType`: text, not null (auto_qualify, document_reduction, expedited_processing)
- `verificationMethod`: text, not null (data_sharing, award_letter, case_number, self_attestation)
- `requiredDocuments`: jsonb, what documentation is needed
- `implementationStatus`: text, not null (production, development, planned)
- `implementationDate`: timestamp, when this auto-qualification went live
- `dataSharePartner`: text (e.g., "PA DHS" for PECO CAP LIHEAP auto-enroll)
- `dataShareAgreement`: text, link to MOU/agreement
- `notes`: text, implementation details, PA PUC orders, etc.

**Audit:**
- `isActive`: boolean, default true
- `createdBy`: varchar, references users.id
- `createdAt`, `updatedAt`: timestamps

**Indexes:** None explicitly defined

---

(Continued in next section due to length...)
