# Maryland Universal Benefits-Tax Navigator - Complete Technical Documentation

## System Overview

The Maryland Universal Benefits-Tax Navigator is a comprehensive AI-powered service delivery platform integrating **6 Maryland benefit programs** (SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI) with **federal/state tax preparation (VITA)**. This production-ready platform serves navigators, caseworkers, applicants, and administrators across 24 Maryland counties with 46 core features including real-time eligibility tracking, cross-enrollment intelligence, quality control analytics, document verification, and conversational AI assistance—all through a unified household profile.

### Core Architecture

**Technology Stack:**
- **Frontend:** React 18 with TypeScript, Vite build system, shadcn/ui components, Tailwind CSS
- **Backend:** Express.js with TypeScript, PostgreSQL database via Drizzle ORM on Neon
- **AI Integration:** Google Gemini API for RAG, document analysis, tax extraction, compliance validation
- **Benefit Calculations:** PolicyEngine US (Python REST API) for accurate multi-program eligibility
- **Storage:** Google Cloud Storage for document files, PostgreSQL for structured data
- **Real-time:** WebSocket notifications, 300ms debounced calculations
- **Multi-tenant:** County-level data isolation and branding

### Key Features (46 Total)
1. **Real-Time Eligibility Tracking:** Financial Opportunity Radar widget with instant updates across all 6 programs
2. **Tax Integration:** VITA intake, Form 1040/MD 502 generation, cross-enrollment intelligence
3. **Document Verification:** AI-powered analysis with Gemini Vision, navigator review queue
4. **Quality Control:** Caseworker/Supervisor Cockpits with predictive analytics and error prevention
5. **Public Portal:** Anonymous screeners, document checklist generator, notice explainer (no login required)
6. **Navigator Tools:** Case management, performance tracking, training modules, gamification
7. **Multi-County Deployment:** 24 Maryland counties with isolated data and localized experiences
8. **Admin Suite:** Policy management, AI monitoring, security dashboard, compliance validation
9. **Mobile-First:** PWA support, bottom navigation, offline capabilities, responsive design
10. **Developer Portal:** API key management, webhook configuration, Swagger documentation

---

## Frontend Architecture (client/)

### Core Application Components

#### client/src/App.tsx
**Purpose:** Root application component with routing and global providers
**Key Features:**
- Wouter-based client-side routing
- TanStack Query provider for server state management
- Tooltip provider for accessibility
- Route definitions for Home, Search, Upload, Admin, Training, and Help pages

**Dependencies:**
- `@tanstack/react-query` for data fetching and caching
- `wouter` for lightweight routing
- `@radix-ui/react-tooltip` for accessible tooltips

#### client/src/pages/Home.tsx
**Purpose:** Main landing page prioritizing conversational search over document upload
**Key Features:**
- Hero section with conversational search interface
- Secondary document verification section with toggle visibility
- Internationalization support via useLanguage hook
- Maryland branding and accessibility compliance

**Components Used:**
- SearchInterface (primary feature)
- DocumentUploadToggle (secondary feature)
- Language translation via t() function

#### client/src/components/Navigation.tsx
**Purpose:** Main navigation component with Maryland state branding
**Key Features:**
- Maryland State Seal integration with error handling
- Multi-language navigation labels
- Mobile-responsive design with slide-out sheet menu
- Accessibility features (ARIA labels, semantic HTML)
- Language selector integration

**Components:**
- MarylandSeal: Official Maryland state seal display with translation support
- NavItems: Dynamic navigation menu generation
- LanguageSelector: Multi-language selection dropdown

### Search and Query Components

#### client/src/components/SearchInterface.tsx
**Purpose:** Main conversational search interface for SNAP policy queries
**Key Features:**
- Real-time search with debouncing
- Common question examples for user guidance
- Error handling with user-friendly messages
- Loading states with accessibility announcements
- Integration with RAG service for intelligent responses

**State Management:**
- Form handling via react-hook-form
- Query state via TanStack Query
- Real-time validation and submission

#### client/src/components/DocumentVerificationInterface.tsx
**Purpose:** Document upload and verification system
**Key Features:**
- Uppy-based file upload with progress tracking
- Direct-to-storage uploads via signed URLs
- Real-time document analysis using Gemini Vision API
- Plain English verification results
- Support for mobile photos and PDF documents

**File Processing Pipeline:**
1. File selection with validation
2. Upload URL generation from backend
3. Direct Google Cloud Storage upload
4. AI-powered document analysis
5. Requirements verification and results display

#### client/src/components/DocumentUploadToggle.tsx
**Purpose:** Collapsible interface for document upload functionality
**Key Features:**
- Toggle visibility for secondary feature positioning
- Smooth animations using Tailwind CSS
- Accessibility-compliant expand/collapse behavior
- Integration with DocumentVerificationInterface

### Language Access Components

#### client/src/components/LanguageSelector.tsx
**Purpose:** Multi-language selection interface
**Supported Languages:**
- English, Spanish, French, Portuguese, Chinese, Korean, Vietnamese, Arabic, Somali, Amharic
**Key Features:**
- Native language names display
- Persistent selection via localStorage
- Accessible dropdown using Radix UI Select
- Integration with translation system

#### client/src/hooks/useLanguage.ts
**Purpose:** Language state management and translation system
**Key Features:**
- Automatic language detection from browser settings
- localStorage persistence for user preferences
- Translation key-value mapping system
- Fallback to English for missing translations

**Translation Keys:** Comprehensive coverage of all UI text including navigation, forms, errors, and accessibility labels

### UI Component Library (client/src/components/ui/)

**shadcn/ui Integration:** The system uses a comprehensive set of accessible UI components:

- **Button:** Accessible button variants with proper ARIA states
- **Input:** Form input components with validation styling
- **Card:** Content container components with consistent styling
- **Dialog/Sheet:** Modal and slide-out interfaces
- **Select:** Accessible dropdown selections
- **Form:** React Hook Form integration with validation
- **Toast:** Notification system for user feedback

**Theming:** All components support Maryland Digital Style Guide theming via CSS custom properties

### Financial Opportunity Radar (Real-Time Eligibility Widget)

#### client/src/components/FinancialOpportunityRadar.tsx
**Purpose:** Persistent sidebar widget for real-time cross-program eligibility tracking
**Key Features:**
- Real-time eligibility display across all 6 Maryland programs (SNAP, Medicaid, TANF, EITC, CTC, SSI)
- Dynamic change indicators with visual feedback (↑↓ arrows, green "New" badges)
- Summary dashboard showing total monthly/annual benefits and program count
- Smart alerts with AI-powered cross-enrollment recommendations
- Framer Motion animations for smooth transitions and change highlights
- Skeleton loading states during calculations
- Error handling with user-friendly messages

**Visual Components:**
- Program eligibility cards with status icons (✅ Eligible, ⚠️ Needs Info, ❌ Ineligible)
- Change indicators showing benefit increases/decreases with amounts and percentages
- Summary metrics panel with total benefit calculations
- Alert system for optimization opportunities and unclaimed benefits

#### client/src/hooks/useEligibilityRadar.ts
**Purpose:** Real-time eligibility calculation engine with smart request management
**Key Features:**
- 300ms debounced calculations for optimal performance
- AbortController integration for request cancellation on rapid field changes
- CSRF token handling for secure state-changing requests
- Change detection with previousResultsRef for delta tracking
- Comprehensive error handling including AbortError management
- Automatic cache invalidation and state updates

**Technical Implementation:**
- useWatch hook tracks 16+ household form fields for instant updates
- Parallel fetch operations: CSRF token → eligibility calculation
- Request flow: Field change → debounce → abort previous → fetch token → calculate → update state
- Change detection: Server compares current vs. previous results, returns 'new'/'changed' indicators
- Security: Includes x-csrf-token header, credentials: 'include', proper error boundaries

**State Management:**
```typescript
interface RadarState {
  programs: ProgramEligibility[];  // Current eligibility for all programs
  alerts: SmartAlert[];            // Cross-enrollment recommendations
  summary: {
    totalMonthly: number;
    totalAnnual: number;
    programCount: number;
  };
  isCalculating: boolean;
  error: string | null;
}
```

#### Integration in HouseholdProfiler
**Location:** client/src/pages/HouseholdProfiler.tsx
**Layout:** Responsive 3-column grid with radar widget in right sidebar
**Data Flow:**
1. useWatch monitors all form fields (adults, children, income, expenses, etc.)
2. Any field change triggers useEffect with field dependencies
3. useEligibilityRadar calculates eligibility with 300ms debounce
4. Results displayed in persistent sidebar with change indicators
5. Bidirectional updates: Form changes update radar, radar shows impact

**Mobile Responsiveness:**
- Desktop: 3-column layout (form | preview | radar)
- Tablet: 2-column stacked layout
- Mobile: Single column with collapsible radar

---

## Backend Architecture (server/)

### Core Server Components

#### server/index.ts
**Purpose:** Express.js application entry point with comprehensive initialization
**Key Features:**
- PostgreSQL database connection and initialization
- Google Cloud Storage integration
- Session management with PostgreSQL backing
- CORS configuration for cross-origin requests
- Automated system data seeding (benefit programs, document types)
- Scheduled data ingestion workflows[

#### server/routes.ts
**Purpose:** RESTful API endpoint definitions
**Endpoints:**

**Search & Query:**
- `POST /api/search` - RAG-powered policy search
- `GET /api/benefit-programs` - Available SNAP programs

**Document Management:**
- `POST /api/documents/upload-url` - Generate signed upload URLs
- `POST /api/documents/verify` - AI-powered document verification
- `GET /api/documents` - Document listing with pagination
- `DELETE /api/documents/:id` - Document deletion

**Administrative:**
- `GET /api/policy-sources` - Policy document sources
- `POST /api/training/jobs` - AI model training management
- `GET /api/system/status` - System health and metrics

### AI and Processing Services

#### server/services/ragService.ts
**Purpose:** Core RAG (Retrieval-Augmented Generation) implementation
**Key Features:**
- Semantic search using Google Gemini embeddings
- Context-aware response generation
- Reading level validation (Grade 6-8 compliance)
- Maryland SNAP policy specialization
- Confidence scoring and citation provision

**Processing Pipeline:**
1. Query embedding generation using text-embedding-004
2. Semantic similarity search across document chunks
3. Context compilation from relevant policy sections
4. Response generation using Gemini-1.5-pro
5. Reading level assessment and improvement
6. Structured response with citations

#### server/services/aiService.ts
**Purpose:** AI model management and document processing
**Key Features:**
- Google Gemini API integration for all AI operations
- Document classification and quality assessment
- Field extraction from structured documents
- Training data generation and validation
- Model performance tracking

**AI Models Used:**
- `gemini-1.5-pro` - Text generation and analysis
- `text-embedding-004` - Semantic embeddings
- `gemini-1.5-pro-vision` - Image and document analysis

#### server/services/documentProcessor.ts
**Purpose:** Document ingestion and processing pipeline
**Key Features:**
- OCR text extraction using Tesseract + Gemini Vision
- Document classification and metadata extraction
- Semantic chunking for optimal retrieval
- Quality assessment and validation
- Embedding generation and storage

**Processing Stages:**
1. Document upload and validation
2. OCR/text extraction
3. Document type classification
4. Content quality assessment
5. Semantic chunking
6. Embedding generation
7. Database storage with metadata

#### server/services/readingLevelService.ts
**Purpose:** Plain language compliance and readability assessment
**Key Features:**
- Flesch-Kincaid Grade Level calculation
- Flesch Reading Ease scoring
- Automated text simplification
- Plain language recommendations
- Grade 6-8 target compliance

**Readability Metrics:**
- Average words per sentence analysis
- Syllable counting and complexity assessment
- Sentence structure evaluation
- Vocabulary complexity analysis
- Improvement suggestions generation

### Database Layer

#### shared/schema.ts
**Purpose:** Complete database schema definition using Drizzle ORM
**Tables:**

**Core Entities:**
- `users` - User accounts with role-based access
- `documents` - Document metadata and processing status
- `documentChunks` - Semantic text chunks with embeddings
- `benefitPrograms` - SNAP program definitions
- `policySources` - Official policy document sources

**Search and Training:**
- `searchQueries` - Query logging and analytics
- `modelVersions` - AI model version tracking
- `trainingJobs` - Model training job management
- `ingestionSchedules` - Automated data ingestion

**Configuration:**
- `documentTypes` - Supported document classifications
- `systemConfigs` - Application configuration settings

#### server/storage.ts
**Purpose:** Database abstraction layer and connection management
**Key Features:**
- Drizzle ORM integration with type safety
- Connection pooling via Neon Database
- Migration support and schema evolution
- Query optimization and indexing
- Transaction management for data consistency

### External Service Integration

#### server/objectStorage.ts
**Purpose:** Google Cloud Storage integration for document files
**Key Features:**
- Signed URL generation for direct uploads
- Custom ACL (Access Control List) policies
- Automatic file organization (public/private directories)
- Upload progress tracking
- Secure file access with temporary URLs

**Storage Structure:**
- `public/` - Publicly accessible assets (images, documents)
- `.private/` - User-uploaded files with access controls
- Automatic file naming and organization
- Metadata preservation and indexing

---

## Configuration and Environment

### Environment Variables

**Required Secrets:**
- `GEMINI_API_KEY` - Google Gemini API access
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_APPLICATION_CREDENTIALS` - GCS service account
- `SESSION_SECRET` - Session encryption key

**Optional Configuration:**
- `NODE_ENV` - Environment mode (development/production)
- `PUBLIC_OBJECT_SEARCH_PATHS` - Asset search paths
- `PRIVATE_OBJECT_DIR` - Private file directory

### Build and Development

#### package.json
**Key Scripts:**
- `npm run dev` - Development server with hot reloading
- `npm run build` - Production build generation
- `npm run db:push` - Database schema synchronization
- `npm run db:studio` - Drizzle Studio database explorer

#### vite.config.ts
**Purpose:** Vite build configuration with path aliases
**Features:**
- Path aliases (@, @assets, @components, @pages, @lib)
- Development server proxy for API routes
- TypeScript integration
- Asset optimization and bundling

#### tailwind.config.ts
**Purpose:** Tailwind CSS configuration with Maryland branding
**Features:**
- Maryland Digital Style Guide color palette
- Custom CSS variables integration
- Dark mode support configuration
- Typography and spacing customization

---

## Security and Access Control

### Authentication System
- Session-based authentication with PostgreSQL storage
- Role-based access control (user, admin, super_admin)
- Secure session management with httpOnly cookies
- CSRF protection and secure headers

### Object Storage Security
- Custom ACL implementation for file access
- Group-based permissions system
- Signed URL generation with expiration
- Private file access controls

### Data Protection
- Input validation and sanitization
- SQL injection prevention via parameterized queries
- XSS protection through output encoding
- Rate limiting on API endpoints

---

## Accessibility and Language Access

### WCAG Compliance Features
- Semantic HTML structure throughout
- ARIA labels and descriptions
- Keyboard navigation support
- Screen reader optimization
- Color contrast compliance
- Focus management and skip links

### Language Access Implementation
- Multi-language UI support (10 languages)
- Grade 6-8 reading level enforcement
- Plain language response generation
- Cultural competency in translations
- Right-to-left language support preparation

### Mobile Accessibility
- Touch target optimization (44px minimum)
- Voice input support
- Progressive enhancement
- Offline capability planning
- Network condition adaptation

---

## Performance and Scalability

### Frontend Optimization
- Code splitting and lazy loading
- Image optimization and responsive serving
- CSS-in-JS optimization
- Bundle size monitoring
- Progressive web app capabilities

### Backend Performance
- Database query optimization and indexing
- Connection pooling and caching
- API response compression
- Rate limiting and throttling
- Horizontal scaling preparation

### AI Processing Optimization
- Embedding caching and reuse
- Batch processing for efficiency
- Response streaming for large outputs
- Model selection based on complexity
- Cost optimization through intelligent routing

---

## Public Portal Features (No Login Required)

### Quick Screener
**Location:** `client/src/pages/public/QuickScreener.tsx`  
**Purpose:** Ultra-minimal 5-question eligibility pre-screening

**Key Features:**
- 5 core questions optimized for 2-minute completion
- Indexes toward inclusivity (reduces false negatives)
- 70% approval rate optimization based on mRelief best practices
- No benefit estimates (keeps it simple and privacy-focused)
- Clear "You may qualify!" messaging
- Mobile-optimized progressive disclosure pattern

**Technical Implementation:**
- React Hook Form with Zod validation
- Simple decision tree algorithm (household size + income thresholds)
- No API calls - fully client-side for privacy
- Optional account creation to save results

### Document Checklist Generator
**Location:** `client/src/pages/public/DocumentChecklist.tsx`  
**Purpose:** AI-powered personalized document requirement lists

**Key Features:**
- Program selection or DHS notice upload
- Gemini-powered requirement extraction
- Program-specific document requirements
- Printable PDF output with jsPDF
- Mobile photo upload support

**API Integration:**
- `POST /api/public/generate-checklist` - Gemini analysis of requirements
- Returns structured checklist with program mappings
- PDF generation client-side for offline printing

### Notice Explainer
**Location:** `client/src/pages/public/NoticeExplainer.tsx`  
**Purpose:** Plain-language DHS notice interpretation

**Key Features:**
- Upload or paste notice text
- Gemini-powered analysis and simplification
- Reading level: Grade 6-8 (Flesch-Kincaid validated)
- Action items extraction with deadlines
- Multi-language support (10 languages)
- Deadline highlighting and countdown

**Processing Pipeline:**
1. Notice text input (paste or OCR from upload)
2. Gemini 1.5-pro analysis to identify key information
3. Reading level simplification
4. Action item extraction with dates
5. Plain English summary generation
6. Multi-language translation (if requested)

### Simplified Policy Search
**Location:** `client/src/pages/public/SimplifiedSearch.tsx`  
**Purpose:** Public access to Maryland SNAP policy manual

**Key Features:**
- Natural language queries without login
- RAG-powered search (same engine as authenticated search)
- Public policy content only (no sensitive data)
- Official policy citations
- Mobile-responsive interface

**Access Control:**
- Public policies only (filtered by access level)
- No user data or case information accessible
- Rate limiting: 10 requests/minute per IP

---

## Staff Dashboard Features

### Navigator Dashboard
**Location:** `client/src/pages/NavigatorDashboard.tsx`  
**Purpose:** Personal navigator metrics and tasks

**Key Features:**
- Active cases overview with status indicators
- Document review task queue
- Performance metrics (cases completed, satisfaction scores)
- Achievement tracking (gamification)
- Quick actions panel (start screening, upload document)
- Recent activity feed

**Data Sources:**
- `navigator_cases` - Active client cases
- `navigator_sessions` - Interaction logs
- `navigator_documents` - Pending document reviews
- `achievements` - Earned badges and points
- `notifications` - Real-time alerts

### Navigator Performance
**Location:** `client/src/pages/NavigatorPerformance.tsx`  
**Purpose:** Individual performance analytics

**Key Features:**
- Case completion rates (monthly/quarterly trends)
- Client satisfaction scores (NPS tracking)
- Document processing speed (average time to approval)
- Benefit maximization metrics (total $ secured for clients)
- Monthly trends visualization (Recharts)
- Goal tracking and progress indicators

**Analytics Calculations:**
- Average case completion time
- Success rate (approved / total applications)
- Cross-enrollment success rate
- Benefit amount optimization percentage
- Quality score (based on error-free submissions)

### Client Dashboard
**Location:** `client/src/pages/ClientDashboard.tsx`  
**Purpose:** Applicant self-service portal

**Key Features:**
- Application status tracking with timeline
- Document upload with drag-and-drop
- Benefit status overview (current enrollments)
- Appointment scheduling interface
- Message center for navigator communication
- Notification preferences

**Real-Time Updates:**
- WebSocket notifications for status changes
- Document review status updates
- Appointment reminders
- Benefit determination notifications

### Caseworker Dashboard
**Location:** `client/src/pages/CaseworkerDashboard.tsx`  
**Purpose:** Caseworker tools with QC integration

**Key Features:**
- Assigned cases with priority flagging
- Document review workflow
- Quality control checklist
- Quick access to job aids
- Error pattern alerts
- Integration with Caseworker Cockpit

---

## Quality Control & Compliance Features

### Caseworker Cockpit
**Location:** `client/src/pages/CaseworkerCockpit.tsx`  
**Purpose:** Personal QA dashboard with error prevention

**Key Features:**
- Flagged cases panel with AI-powered risk scores
- Error trend analytics tracking performance over 4 quarters
- AI-recommended training interventions based on error patterns
- Quick job aids library (7 comprehensive guides)
- Context-aware tips dialog for proactive quality improvement
- Performance metrics with Payment Error Rate (PER) tracking

**Maryland SNAP Error Categories (6):**
1. Shelter & Utility Errors (`shelter_utility`)
2. Income Verification Errors (`income_verification`)
3. Asset Verification Errors (`asset_verification`)
4. Categorical Eligibility Errors (`categorical_eligibility`)
5. Earned Income Errors (`earned_income`)
6. Unearned Income Errors (`unearned_income`)

**Technical Implementation:**
- Database: `qc_error_patterns`, `flagged_cases`, `job_aids`
- Synthetic data generation for training (no real PII)
- Predictive analytics using historical error patterns
- Case format: `Case #XXXXX` (synthetic IDs)

### Supervisor Cockpit
**Location:** `client/src/pages/SupervisorCockpit.tsx`  
**Purpose:** Team-wide QA oversight and predictive analytics

**Key Features:**
- Team error trend alerts with spike detection (e.g., 500% increases)
- Diagnostic drill-downs by error category with subtype analysis
- Proactive case flagging system for high-risk applications
- Training impact analytics showing before/after error rate improvements
- Real-time team performance metrics
- Payment Error Rate (PER) tracking across team

**Predictive Analytics:**
- Pattern recognition across all 6 error categories
- Early warning system for quality issues
- Training intervention effectiveness tracking
- Team comparison and benchmarking

### ABAWD Verification Admin
**Location:** `client/src/pages/AbawdVerificationAdmin.tsx`  
**Purpose:** ABAWD work requirement exemption management

**Key Features:**
- Exemption verification workflow
- Work requirement tracking (80 hours/month)
- Compliance monitoring dashboard
- Exemption documentation storage
- Federal reporting tools
- Appeal management

**Database:**
- `abawd_exemptions` - Exemption records
- Status tracking: pending, approved, denied, expired
- Automatic expiration alerts (3-month time limits)

### Compliance Assurance Suite
**Location:** `client/src/pages/ComplianceAdmin.tsx`  
**Purpose:** Automated compliance validation

**Key Features:**
- WCAG 2.1 AA compliance checking
- LEP (Limited English Proficiency) validation
- Federal regulation alignment (7 CFR Part 273)
- Policy change impact analysis
- Gemini-powered validation engine
- Violation tracking and remediation workflow

**Compliance Rules Engine:**
- Rule definitions in `compliance_rules` table
- Automated validation triggers
- Violation logging in `compliance_violations`
- Remediation tracking and closure

---

## Administration & Developer Tools

### AI Monitoring Dashboard
**Location:** `client/src/pages/AIMonitoring.tsx`  
**Purpose:** AI model performance tracking and cost analysis

**Key Features:**
- Model accuracy metrics by task type (RAG, extraction, classification)
- API usage and cost tracking (Gemini API)
- Response time monitoring (P50, P95, P99)
- Error rate tracking by model and endpoint
- A/B test results visualization
- Model version management and rollback

**Metrics Tracked:**
- RAG search accuracy (relevance scoring)
- Document extraction accuracy (field-level)
- Classification accuracy (document types)
- Total API cost per day/week/month
- Request volume by model (gemini-1.5-pro, text-embedding-004)

### Developer Portal
**Location:** `client/src/pages/DeveloperPortal.tsx`  
**Purpose:** Third-party API integration management

**Key Features:**
- API key generation and rotation
- Webhook configuration (event subscriptions)
- Integration guides and documentation
- Testing sandbox with sample data
- Code examples (JavaScript, Python, cURL)
- SDK downloads (planned)

**API Key Management:**
- Scoped permissions (read-only, read-write, admin)
- Key expiration and rotation
- Usage limits and throttling
- Request logging and analytics

### API Documentation (Swagger)
**Location:** `client/src/pages/ApiDocs.tsx`  
**Purpose:** Interactive API documentation

**Key Features:**
- Swagger UI interface
- Try-it-out functionality with authentication
- Request/response examples
- Authentication testing (session, API keys)
- Endpoint search and filtering
- Export OpenAPI 3.0 spec

**Integration:**
- Auto-generated from Express routes
- Real-time testing against development API
- Example responses from production data

### Security Monitoring Dashboard
**Location:** `client/src/pages/SecurityMonitoring.tsx`  
**Purpose:** Security audit and threat monitoring

**Key Features:**
- Failed login tracking with IP analysis
- Suspicious activity detection (brute force, unusual patterns)
- API abuse monitoring (rate limit violations)
- Rate limit visualization by endpoint
- Access pattern analysis
- Real-time threat alerts

**Security Events Tracked:**
- Failed logins (threshold: 5 attempts in 15 minutes)
- API key misuse
- Unusual access patterns (geographic, temporal)
- Data export events (audit trail)

### County Management
**Location:** `client/src/pages/CountyManagement.tsx`  
**Purpose:** Multi-county deployment configuration

**Key Features:**
- County-specific branding (logos, colors, names)
- Contact information management
- Staff assignment by county (role-based)
- Program availability by county (not all counties offer all programs)
- Localized content and resources
- Data isolation and tenant separation

**Maryland Counties Supported:** 24 counties
- Baltimore City, Baltimore County, Montgomery County, Prince George's County (pilot deployments)
- All 23 other Maryland counties

**Technical Implementation:**
- `counties` table with branding and config
- Tenant isolation via county_id foreign keys
- Dynamic theming based on county selection
- Separate analytics per county

### County Analytics
**Location:** `client/src/pages/CountyAnalytics.tsx`  
**Purpose:** County-level performance metrics and comparison

**Key Features:**
- Application volume by county (daily/weekly/monthly)
- Approval rates comparison across counties
- Navigator performance by county
- Program utilization metrics (which programs are used most)
- Demographic insights (age, household size distributions)
- Trend analysis and forecasting

**Visualization:**
- Recharts multi-county comparison charts
- Heat maps for geographic patterns
- Time series for trend analysis

### Cross-Enrollment Admin
**Location:** `client/src/pages/CrossEnrollmentAdmin.tsx`  
**Purpose:** Cross-program enrollment pipeline management

**Key Features:**
- Enrollment pipeline configuration (program pairs)
- Success rate tracking (e.g., SNAP → Medicaid conversion rate)
- Barrier identification (why enrollments fail)
- AI-powered optimization recommendations
- Performance metrics dashboard
- Impact analysis ($ value of cross-enrollments)

**Analytics:**
- Cross-enrollment success rates by program pair
- Common barriers (documentation, eligibility gaps)
- Time to enrollment (average days)
- Total benefit value from cross-enrollments

---

## Infrastructure & Mobile Features

### Notification System
**Location:** `client/src/pages/NotificationCenter.tsx`  
**Purpose:** Real-time in-app notification management

**Key Features:**
- Notification bell with unread count badge
- Real-time WebSocket updates
- Mark as read/unread functionality
- Notification filtering (by type, date)
- Priority alerts (urgent/normal)
- Email backup option

**Notification Types:**
- Document review status updates
- Application status changes
- Appointment reminders
- Training assignments
- System alerts
- Achievement unlocks

**Technical Implementation:**
- WebSocket server for real-time delivery
- Database: `notifications` table
- Fallback: polling for older browsers
- Email integration via SendGrid (planned)

### Notification Settings
**Location:** `client/src/pages/NotificationSettings.tsx`  
**Purpose:** Notification preference management

**Key Features:**
- Channel preferences (in-app, email, SMS planned)
- Notification type selection (checkboxes per type)
- Quiet hours configuration (time ranges)
- Frequency settings (instant, digest, daily summary)
- Opt-out controls with granular selection

**Database:**
- `notification_preferences` table
- User-specific preference storage
- Default preferences for new users

### PWA Installation
**Location:** `client/src/components/InstallPrompt.tsx`  
**Purpose:** Progressive Web App offline support

**Key Features:**
- Install prompt with A2HS (Add to Home Screen)
- Offline functionality via Service Workers
- Cached critical data (benefit programs, policy excerpts)
- Background sync for form submissions
- Push notifications (planned)

**Technical Stack:**
- Service Worker registration in `vite.config.ts`
- IndexedDB for offline data caching
- Workbox for caching strategies
- Manifest.json for PWA metadata

**Offline Capabilities:**
- View cached household profiles
- Access recent eligibility calculations
- Draft application forms (sync when online)
- Offline policy search (limited to cached content)

### Mobile Bottom Navigation
**Location:** `client/src/components/MobileBottomNav.tsx`  
**Purpose:** Mobile-optimized touch navigation

**Key Features:**
- Bottom tab navigation (iOS/Android pattern)
- Touch-optimized targets (44x44pt minimum)
- Role-based menu items (different nav for user/navigator/admin)
- Badge notifications on tabs
- Quick actions (FAB - Floating Action Button)
- Swipe gestures for tab switching

**Responsive Breakpoints:**
- Desktop: Hidden (top nav only)
- Tablet (< 1024px): Optional (user preference)
- Mobile (< 768px): Always visible

### Command Palette
**Location:** `client/src/components/CommandPalette.tsx`  
**Purpose:** Keyboard-driven quick navigation and actions

**Key Features:**
- Global keyboard shortcut (Cmd/Ctrl+K)
- Fuzzy search across all pages and actions
- Role-based filtering (only show permitted actions)
- Recent items tracking
- Quick actions (create case, start screening, upload document)
- Full keyboard navigation (↑↓ arrows, Enter to select)

**Technical Implementation:**
- `cmdk` library for command menu
- Global hotkey listener
- Search index of all routes and actions
- Usage analytics for popular commands

### Training Module
**Location:** `client/src/pages/Training.tsx`  
**Purpose:** Staff training and certification tracking

**Key Features:**
- Training material access (videos, PDFs, interactive modules)
- Certification tracking (SNAP certification, VITA certification)
- Interactive tutorials with progress tracking
- Knowledge assessments (quizzes)
- Progress tracking per staff member
- Certificate generation (PDF)

**Database:**
- `training_modules` - Course content
- `training_progress` - User completion tracking
- `certifications` - Earned certifications

### Consent Management
**Location:** `client/src/pages/ConsentManagement.tsx`  
**Purpose:** Digital consent form system

**Key Features:**
- Consent form creation from templates
- Digital signature capture (canvas-based)
- Version control (track consent changes over time)
- Expiration tracking and renewal reminders
- Revocation support (withdraw consent)
- Audit trail (who consented, when, to what version)

**Legal Compliance:**
- Timestamped consent records
- IP address logging
- Version history preservation
- Withdrawal confirmation
- GDPR-ready architecture

**Database:**
- `consent_forms` - Form templates
- `client_consents` - Individual consent records
- Status: active, expired, revoked

### Gamification System
**Location:** `client/src/pages/Leaderboard.tsx`  
**Purpose:** Navigator performance gamification

**Key Features:**
- Navigator rankings (weekly, monthly, all-time)
- Achievement badges (case milestones, quality awards)
- Point system (cases completed, benefits maximized)
- Weekly/monthly competitions
- Team comparisons (county vs county)
- Reward tracking

**Achievement Types:**
- Case Milestones (10 cases, 50 cases, 100 cases)
- Quality Awards (error-free month, 95%+ satisfaction)
- Speed Awards (fastest document review)
- Impact Awards (highest $ benefits secured)

**Technical Implementation:**
- Component: `AchievementNotification` for popups
- Real-time leaderboard updates
- Point calculation algorithms
- Badge SVG assets

---

## Monitoring and Analytics

### System Health Monitoring
- API endpoint response time tracking
- Database performance metrics
- AI service usage and costs
- Error rate monitoring and alerting
- User experience tracking

### Data Analytics
- Search query analysis and optimization
- Document verification success rates
- Language preference tracking
- User journey analysis
- Content effectiveness measurement

---

## Deployment and Infrastructure

### Production Deployment
- Replit deployment with automated builds
- Environment-specific configuration
- Database migrations and rollbacks
- Static asset optimization
- SSL/TLS certificate management

### Backup and Recovery
- Automated database backups
- Document file backup strategies
- Disaster recovery procedures
- Data retention policies
- Point-in-time recovery capabilities

---

This technical documentation provides a comprehensive overview of every component, service, and architectural decision in the Maryland SNAP Policy Manual System. The system is designed for scalability, accessibility, and maintainability while meeting the specific needs of Maryland SNAP benefit recipients and navigators.