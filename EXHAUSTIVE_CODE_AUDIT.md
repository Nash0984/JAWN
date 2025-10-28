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

**Authentication & Security:**
- `passport` (^0.7.0): Authentication middleware
- `passport-local` (^1.0.0): Local strategy
- `bcryptjs` (^3.0.2): Password hashing
- `otplib` (^12.0.1): OTP generation/validation
- `qrcode` (^1.5.4): QR code generation

**Document Processing:**
- `pdf-parse` (^2.4.5): PDF parsing
- `mammoth` (^1.11.0): DOCX to HTML
- `cheerio` (^1.1.2): HTML parsing
- `xml2js` (^0.6.2): XML parsing
- `exceljs` (^4.4.0): Excel manipulation
- `papaparse` (^5.5.3): CSV parsing
- `jspdf` (^3.0.3): PDF generation
- `jspdf-autotable` (^5.0.2): PDF tables
- `sharp` (^0.34.4): Image processing

**File Upload:**
- `multer` (^2.0.2): Multipart form handling
- `@uppy/core` (^5.1.1): File uploader core
- `@uppy/react` (^5.1.0): React integration
- `@uppy/aws-s3` (^5.0.2): S3 uploads

**Forms & Validation:**
- `react-hook-form` (^7.65.0): Form management
- `@hookform/resolvers` (^5.2.2): Validation resolvers
- `zod` (^4.1.12): Schema validation
- `zod-validation-error` (^4.0.2): Error formatting

**Data Visualization:**
- `recharts` (^3.3.0): Chart library
- `react-day-picker` (^9.11.1): Date picker

**Utilities:**
- `date-fns` (^4.1.0): Date manipulation
- `nanoid` (^5.1.6): ID generation
- `json2csv` (^6.0.0-alpha.2): JSON to CSV

**Communication:**
- `nodemailer` (^7.0.10): Email sending
- `googleapis` (^164.1.0): Google APIs

**Caching & Performance:**
- `@upstash/redis` (^1.35.6): Redis client
- `ioredis` (^5.8.2): Alternative Redis client
- `node-cache` (^5.1.2): In-memory cache

**Testing:**
- `@playwright/test` (^1.56.1): E2E testing
- `playwright` (^1.56.1): Browser automation
- `@axe-core/playwright` (^4.10.2): Accessibility testing
- `vitest` (^3.2.4): Unit test runner
- `@vitest/ui` (^3.2.4): Vitest UI
- `happy-dom` (^20.0.7): DOM environment
- `@testing-library/react` (^16.3.0): React testing
- `@testing-library/jest-dom` (^6.9.1): Jest matchers
- `@testing-library/user-event` (^14.6.1): User interactions
- `supertest` (^7.1.4): HTTP assertion

**Monitoring & Error Tracking:**
- `@sentry/node` (^10.22.0): Node.js error tracking
- `@sentry/react` (^10.22.0): React error tracking
- `@sentry/profiling-node` (^10.22.0): Performance profiling

**WebSocket:**
- `ws` (^8.18.3): WebSocket library

**Misc:**
- `cmdk` (^1.1.1): Command palette
- `input-otp` (^1.4.2): OTP input component
- `react-markdown` (^10.1.0): Markdown renderer
- `react-resizable-panels` (^3.0.6): Resizable panels
- `react-helmet-async` (^2.0.5): Document head management
- `embla-carousel-react` (^8.6.0): Carousel component
- `vaul` (^1.1.2): Drawer component

**DevDependencies (22 packages):**
- `@replit/vite-plugin-cartographer` (^0.3.2): Replit integration
- `@replit/vite-plugin-runtime-error-modal` (^0.0.3): Error overlay
- `@tailwindcss/typography` (^0.5.19): Typography plugin
- `@tailwindcss/vite` (^4.1.16): Tailwind Vite plugin
- `@types/*` (12 type definition packages): TypeScript types
- `@vitejs/plugin-react` (^4.7.0): Vite React plugin
- `autoprefixer` (^10.4.21): CSS autoprefixer
- `drizzle-kit` (^0.31.5): Drizzle migrations
- `esbuild` (^0.25.11): JavaScript bundler
- `postcss` (^8.5.6): CSS processor
- `tailwindcss` (^3.4.18): CSS framework
- `tsx` (^4.20.6): TypeScript executor
- `typescript` (5.6.3): TypeScript compiler (exact version)
- `vite` (^7.1.12): Build tool

**Optional Dependencies:**
- `bufferutil` (^4.0.8): WebSocket performance

**Key Version Notes:**
- React 19 (latest major version)
- Zod 4.x (latest major version)
- Drizzle ORM 0.44.x (actively maintained)
- TypeScript 5.6.3 (latest stable)
- Vite 7.x (latest major version)

---

### 1.2 tsconfig.json (23 lines)

**File Inclusion (line 2):**
```json
"include": ["client/src/**/*", "shared/**/*", "server/**/*"]
```
- Compiles all TypeScript in client, shared, and server directories
- Recursive wildcard (**/*) includes all subdirectories

**File Exclusion (line 3):**
```json
"exclude": ["node_modules", "build", "dist", "**/*.test.ts"]
```
- Excludes node_modules (dependencies)
- Excludes build and dist (output directories)
- Excludes all test files ending in .test.ts

**Compiler Options Analysis:**

**Build Configuration:**
- `incremental: true` (line 5): Enable incremental compilation for faster rebuilds
- `tsBuildInfoFile: "./node_modules/typescript/tsbuildinfo"` (line 6): Cache build info
- `noEmit: true` (line 7): Don't emit JavaScript (Vite/esbuild handle compilation)

**Module System:**
- `module: "ESNext"` (line 8): Use latest ES module syntax
- `esModuleInterop: true` (line 12): CommonJS/ESM interop
- `moduleResolution: "bundler"` (line 15): Use bundler resolution strategy

**Type Checking:**
- `strict: true` (line 9): Enable all strict type checking options
  - Includes: strictNullChecks, strictFunctionTypes, strictBindCallApply, etc.
- `skipLibCheck: true` (line 13): Skip type checking of declaration files (.d.ts)

**Library Support:**
- `lib: ["esnext", "dom", "dom.iterable"]` (line 10): 
  - ESNext: Latest JavaScript features
  - dom: Browser DOM APIs
  - dom.iterable: Iterable DOM collections

**JSX Configuration:**
- `jsx: "preserve"` (line 11): Preserve JSX for Vite to transform
  - Vite handles JSX → JS transformation

**Module Resolution:**
- `allowImportingTsExtensions: true` (line 14): Allow .ts/.tsx in imports
- `baseUrl: "."` (line 16): Resolve from project root
- `types: ["node", "vite/client"]` (line 17): Include Node.js and Vite types

**Path Aliases (lines 18-21):**
```json
"paths": {
  "@/*": ["./client/src/*"],    // Frontend code
  "@shared/*": ["./shared/*"]   // Shared types/schemas
}
```
- `@/` maps to client/src for frontend imports
- `@shared/` maps to shared for cross-layer imports

**No Emitting:** Since `noEmit: true`, TypeScript only type-checks. Actual compilation done by:
- Client: Vite (transforms JSX, bundles)
- Server: esbuild (bundles to dist/index.js)

---

### 1.3 vite.config.ts (37 lines)

**Imports (lines 1-4):**
- `defineConfig` from vite: Type-safe config
- `react` plugin from @vitejs/plugin-react: JSX transform, Fast Refresh
- `path`: Node.js path utilities
- `runtimeErrorOverlay` from @replit/vite-plugin-runtime-error-modal: Development error overlay

**Plugins Configuration (lines 7-17):**
```typescript
plugins: [
  react(),  // JSX transformation + Fast Refresh
  runtimeErrorOverlay(),  // Dev error modal
  ...(condition ? [cartographer()] : [])  // Conditional Replit plugin
]
```

**Conditional Cartographer Plugin:**
- Only loads in development + Replit environment
- Conditions: `process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined`
- Dynamic import: `await import("@replit/vite-plugin-cartographer")`
- Purpose: Replit-specific development tooling

**Path Aliases (lines 19-24):**
```typescript
resolve: {
  alias: {
    "@": path.resolve(import.meta.dirname, "client", "src"),
    "@shared": path.resolve(import.meta.dirname, "shared"),
    "@assets": path.resolve(import.meta.dirname, "attached_assets"),
  }
}
```
- `@`: client/src (frontend code)
- `@shared`: shared (cross-layer types/schemas)
- `@assets`: attached_assets (user-uploaded/static assets)

**Root Directory (line 26):**
```typescript
root: path.resolve(import.meta.dirname, "client")
```
- Sets client/ as Vite's root for index.html resolution

**Build Configuration (lines 27-30):**
```typescript
build: {
  outDir: path.resolve(import.meta.dirname, "dist/public"),
  emptyOutDir: true,
}
```
- Output: dist/public/ (served as static files by Express)
- `emptyOutDir: true`: Clear before each build

**Server Configuration (lines 31-36):**
```typescript
server: {
  fs: {
    strict: true,       // Strict file serving
    deny: ["**/.*"]     // Deny serving dotfiles
  }
}
```
- Security: Prevents serving hidden files (.env, .git, etc.)

---

### 1.4 drizzle.config.ts (14 lines)

**Environment Variable Validation (lines 3-5):**
```typescript
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}
```
- Requires DATABASE_URL environment variable
- Early failure if database not provisioned

**Configuration (lines 7-14):**
```typescript
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

**Options Explained:**
- `out: "./migrations"`: Migration files output directory
- `schema: "./shared/schema.ts"`: Single-file schema (8,677 lines)
- `dialect: "postgresql"`: PostgreSQL database
- `dbCredentials.url`: Connection string from environment
  - Format: postgres://user:password@host:port/database
  - Likely Neon Postgres serverless

**Usage:**
- `npm run db:push`: Sync schema to database without migrations
- `drizzle-kit generate`: Generate SQL migrations (not used per guidelines)

---

### 1.5 tailwind.config.ts (325 lines)

**Purpose:** Complete design system configuration for multi-tenant government platform

**Basic Configuration (lines 4-5):**
```typescript
darkMode: ["class"],  // Dark mode via class toggle
content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"]
```
- Dark mode triggered by adding "dark" class to html/body
- Scans client/ for Tailwind classes

**Theme Extensions - Border Radius (lines 8-12):**
```typescript
borderRadius: {
  lg: "var(--radius)",
  md: "calc(var(--radius) - 2px)",
  sm: "var(--radius-sm)",
}
```
- Uses CSS variables for dynamic theming
- Calculated sizes for consistency

**Color System (lines 13-128):**

**Multi-Tenant Brand Colors (lines 31-44):**
```typescript
"brand-primary": "hsl(var(--brand-primary))",      // Tenant-specific
"brand-secondary": "hsl(var(--brand-secondary))",  // Tenant-specific
"brand-accent": "hsl(var(--brand-accent))",        // Tenant-specific

// Backward-compatible Maryland aliases (DEPRECATED)
"maryland-red": "hsl(var(--brand-accent))",
"maryland-gold": "hsl(var(--brand-secondary))",
```
- Brand colors driven by CSS variables
- Allows per-tenant customization (MD = red/gold, PA/VA = different)
- Maryland-specific colors aliased to brand colors for migration

**Semantic Colors:**
- `background` + `foreground`: Base page colors
- `card` (DEFAULT, foreground, border): Card components
- `popover`: Overlay elements
- `primary`, `secondary`, `muted`, `accent`: Action colors
- `success`, `warning`, `destructive`, `info`: State colors with subtle variants
- `border`, `input`, `ring`: Form elements

**Sidebar System (lines 118-128):**
Dedicated color system for navigation sidebar with 8 variants

**Chart Colors (lines 109-116):**
5 distinct colors for data visualization

**Typography (lines 130-134):**
```typescript
fontFamily: {
  sans: ["var(--font-sans)", "Montserrat", "-apple-system", ...],
  serif: ["var(--font-serif)", "Georgia", "serif"],
  mono: ["var(--font-mono)", "SF Mono", "Monaco", "monospace"],
}
```
- CSS variable driven for tenant customization
- Fallbacks: Montserrat → system fonts

**Spacing System (lines 135-141):**
Custom spacing scale via CSS variables (sm, md, lg, xl)

**Shadow System (lines 142-150):**
7-tier elevation system (xs → 2xl)

**Gradients (lines 151-154):**
Primary and secondary gradient backgrounds

**Animations (lines 155-217):**

**Keyframes Defined:**
1. `accordion-down/up`: Radix Accordion animations
2. `slideUp/slideDown`: 10px vertical motion with fade
3. `fadeIn`: Opacity 0 → 1
4. `pulse`: Breathing effect (1 → 0.5 → 1)

**Animation Classes:**
- `animate-accordion-down/up`: 0.2s ease-out
- `animate-slide-up/down`: 0.3s ease-out
- `animate-fade-in`: 0.3s ease-out
- `animate-pulse`: 2s infinite

**Custom Plugins (lines 219-323):**

**Plugin 1: tailwindcss-animate (line 220)**
- Third-party animation utilities

**Plugin 2: @tailwindcss/typography (line 221)**
- Prose styling for rich text

**Plugin 3: Custom Accessibility & Modern Utilities (lines 224-322)**

**Accessibility Utilities (lines 226-246):**
```typescript
'.gov-focus': {
  '&:focus-visible': {
    outline: '3px solid hsl(var(--ring))',
    'outline-offset': '2px',
  }
}
'.gov-text-contrast': High contrast text/background
'.touch-target': 44px min (WCAG 2.1 Level AAA)
'.touch-target-lg': 56px min
```

**Modern Component Utilities (lines 249-291):**
```typescript
'.card-elevated': Hover elevation effect
'.glass-effect': Backdrop blur + transparency
'.gradient-header': Gradient backgrounds
'.processing-animation': Pulse animation
'.slide-up', '.slide-down', '.fade-in': Animation classes
'.upload-zone': Drag-and-drop styling with hover state
```

**Button Components (lines 294-317):**
```typescript
'.btn': Base button (inline-flex, centered, rounded)
'.btn-sm': Small (0.5rem padding)
'.btn-lg': Large (0.75rem padding)
```

**Compliance Features:**
- WCAG 2.1 Level AAA touch targets (44px minimum)
- High contrast text modes
- 3px focus outlines with offset
- Government-appropriate visual hierarchy

---

### 1.6 postcss.config.js (6 lines)

**Simple Configuration:**
```javascript
export default {
  plugins: {
    tailwindcss: {},      // Process Tailwind directives
    autoprefixer: {},     // Add vendor prefixes
  },
}
```

**Purpose:**
- `tailwindcss`: Transforms @tailwind directives to CSS
- `autoprefixer`: Adds -webkit-, -moz-, etc. for browser compatibility

---

### 1.7 components.json (20 lines)

**Shadcn UI Configuration:**

**Schema (line 2):**
- Follows shadcn/ui schema for CLI tooling

**Style Preset (line 3):**
- `"style": "new-york"`: Modern shadcn style variant

**Framework Settings (lines 4-5):**
- `"rsc": false`: Not using React Server Components
- `"tsx": true`: TypeScript JSX enabled

**Tailwind Configuration (lines 6-12):**
```json
"tailwind": {
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

