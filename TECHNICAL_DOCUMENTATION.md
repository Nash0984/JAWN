# Maryland SNAP Policy Manual System - Complete Technical Documentation

## System Overview

The Maryland SNAP Policy Manual System is a comprehensive AI-powered platform designed specifically for Maryland's Food Supplement Program (SNAP). It serves as an intelligent document verification and policy navigation system that helps users find and understand government benefit policies through advanced Retrieval-Augmented Generation (RAG) technology.

### Core Architecture

**Technology Stack:**
- **Frontend:** React 18 with TypeScript, Vite build system, shadcn/ui components, Tailwind CSS
- **Backend:** Express.js with TypeScript, PostgreSQL database via Drizzle ORM
- **AI Integration:** Google Gemini API (100% migrated from OpenAI)
- **Storage:** Google Cloud Storage for document files, PostgreSQL for structured data
- **Language Access:** Multi-language support with reading level validation (Grade 6-8)

### Key Features
1. **Document Verification:** Upload and analyze documents against SNAP requirements
2. **Conversational Search:** Natural language queries about SNAP policies
3. **Language Access:** 10-language support with plain English responses
4. **Mobile-First Design:** Responsive interface optimized for touch devices
5. **Maryland Branding:** Full compliance with Maryland Digital Style Guide

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