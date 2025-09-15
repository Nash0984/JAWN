# Vibe Code Prompts for Maryland SNAP Policy Manual System

These prompts can be used with AI coding assistants to recreate the entire Maryland SNAP Policy Manual System functionality from scratch.

## 🎯 Master System Prompt

```
Create a comprehensive Maryland SNAP Policy Manual System - an AI-powered platform that helps Maryland residents verify documents against SNAP eligibility requirements and search official policies using natural language. 

Key Requirements:
- Document verification using mobile photos/PDFs with AI analysis
- Conversational search interface for SNAP policy questions  
- Multi-language support (10 languages including Spanish, Chinese, Arabic)
- Grade 6-8 reading level compliance for all responses
- Maryland Digital Style Guide branding with official state seal
- Mobile-first responsive design with accessibility (WCAG 2.1 AA)
- Google Gemini API integration for all AI operations
- Full-stack TypeScript with React frontend and Express backend
- PostgreSQL database with Drizzle ORM
- Google Cloud Storage for document files

Architecture:
- Frontend: React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS
- Backend: Express.js + TypeScript + PostgreSQL + Google Gemini API
- Key Services: RAG search, document processing, reading level validation
- Deployment: Replit-compatible with hot reloading
```

## 🏗️ Frontend Development Prompts

### Core Application Structure
```
Build a React 18 + TypeScript frontend for a Maryland SNAP benefits system with these requirements:

1. HOME PAGE: Prioritize conversational search as main feature, with document upload as secondary collapsible section
2. NAVIGATION: Maryland state seal integration, multi-language selector, mobile-responsive with slide-out menu
3. SEARCH INTERFACE: Natural language input with common example questions, real-time search with loading states
4. DOCUMENT VERIFICATION: Uppy-based file upload with progress tracking, direct-to-storage uploads, AI analysis results
5. LANGUAGE ACCESS: 10-language translation system with localStorage persistence, automatic browser language detection

Use shadcn/ui components, Tailwind CSS with Maryland colors (red #c8122c, gold #ffc838), Wouter for routing, TanStack Query for state management. Include comprehensive accessibility features (ARIA labels, skip links, keyboard navigation).

Maryland branding: Official seal, Montserrat typography, semantic HTML structure, mobile-first responsive design.
```

### Language and Accessibility Features
```
Implement comprehensive language access features for a SNAP benefits system:

1. LANGUAGE SELECTOR: 10-language dropdown (English, Spanish, French, Portuguese, Chinese, Korean, Vietnamese, Arabic, Somali, Amharic) with native names
2. TRANSLATION SYSTEM: useLanguage hook with localStorage persistence, browser language detection, translation key management
3. READING LEVEL SERVICE: Flesch-Kincaid grade level calculation, automatic text simplification, Grade 6-8 compliance validation
4. ACCESSIBILITY: WCAG 2.1 AA compliance, screen reader optimization, keyboard navigation, semantic HTML, ARIA labels

Include translation keys for all UI text, form validation messages, error states, and system feedback. Support right-to-left languages, cultural competency in translations.
```

## 🚀 Backend Development Prompts

### Core API and Services
```
Create a comprehensive Express.js + TypeScript backend for Maryland SNAP policy system:

1. GOOGLE GEMINI INTEGRATION: Complete migration from OpenAI, using gemini-1.5-pro for text generation, text-embedding-004 for embeddings, gemini-1.5-pro-vision for document analysis
2. RAG SERVICE: Semantic search with vector embeddings, context-aware response generation, confidence scoring, official policy citations
3. DOCUMENT PROCESSING: OCR with Tesseract + Gemini Vision, document classification, quality assessment, semantic chunking
4. READING LEVEL VALIDATION: Flesch-Kincaid assessment, automatic text improvement for Grade 6-8 level
5. GOOGLE CLOUD STORAGE: Signed URL generation, direct uploads, ACL management, public/private file organization

API Endpoints: /api/search (RAG), /api/documents/verify (AI analysis), /api/documents/upload-url (storage), /api/benefit-programs, /api/system/status

Database: PostgreSQL with Drizzle ORM, tables for users, documents, chunks, search queries, training jobs. Include proper indexing and relationships.
```

### AI and Processing Pipeline
```
Build intelligent document processing and RAG search system:

1. DOCUMENT ANALYSIS PIPELINE: 
   - Upload handling with validation
   - OCR text extraction using Tesseract + Gemini Vision
   - Document type classification (paystubs, bank statements, benefits letters)
   - SNAP requirements verification with plain English explanations
   - Confidence scoring and official policy citations

2. RAG SEARCH ENGINE:
   - Query embedding generation using text-embedding-004
   - Semantic similarity search across Maryland SNAP policy documents
   - Context compilation with relevant policy sections
   - Response generation using gemini-1.5-pro with reading level constraints
   - Citation tracking with official regulation references

3. READING LEVEL SERVICE:
   - Flesch-Kincaid grade level calculation
   - Automatic text simplification for Grade 6-8 compliance
   - Complex word replacement with simpler alternatives
   - Sentence structure optimization

Include error handling, logging, performance optimization, and cost management for AI API calls.
```

## 🗄️ Database and Schema Design

```
Design PostgreSQL database schema for Maryland SNAP system using Drizzle ORM:

CORE ENTITIES:
- users: id, email, role (user/admin/super_admin), created_at
- documents: id, user_id, filename, file_path, document_type, processing_status, analysis_result, created_at
- document_chunks: id, document_id, chunk_text, embedding (vector), chunk_index, created_at
- benefit_programs: id, name, description, eligibility_rules, active
- policy_sources: id, title, source_url, document_type, last_updated

SEARCH & TRAINING:
- search_queries: id, user_id, query_text, response_text, confidence_score, created_at
- model_versions: id, version_name, model_config, performance_metrics, created_at
- training_jobs: id, job_type, status, input_data, output_results, created_at

SYSTEM:
- document_types: id, type_name, validation_rules, required_fields
- ingestion_schedules: id, schedule_name, cron_pattern, source_config, next_run
- system_configs: key, value, description, updated_at

Include proper foreign key relationships, indexes for search performance, and migration support.
```

## 🎨 Styling and Branding Prompts

```
Implement Maryland Digital Style Guide (2023) compliant design system:

1. COLOR PALETTE:
   - Primary: Maryland Red (#c8122c)
   - Secondary: Maryland Gold (#ffc838)  
   - Neutral: Black (#231f20), White (#ffffff)
   - Semantic: Success, Warning, Error states

2. TYPOGRAPHY:
   - Font: Montserrat (Google Fonts)
   - Headings: Semi Bold (600)
   - Body: Regular (400)
   - Accessible sizing and line-height ratios

3. MARYLAND STATE SEAL:
   - Official SVG integration in navigation
   - Error handling for failed loads
   - Responsive sizing for mobile/desktop

4. MOBILE-FIRST DESIGN:
   - Touch target minimum 44px
   - Progressive enhancement
   - Responsive breakpoints
   - Optimized for government benefit users

5. ACCESSIBILITY:
   - WCAG 2.1 AA compliance
   - High contrast ratios
   - Focus management
   - Screen reader optimization
   - Keyboard navigation support

Use Tailwind CSS with custom Maryland theme, CSS custom properties, dark mode support preparation.
```

## 🔧 Configuration and Deployment

```
Set up development and production environment for Maryland SNAP system:

1. DEVELOPMENT SETUP:
   - Vite build system with TypeScript
   - Express server with hot reloading
   - PostgreSQL database with development data
   - Google Gemini API integration
   - Google Cloud Storage configuration

2. ENVIRONMENT VARIABLES:
   - GEMINI_API_KEY (required)
   - DATABASE_URL (PostgreSQL connection)
   - GOOGLE_APPLICATION_CREDENTIALS (service account)
   - SESSION_SECRET (secure random string)
   - NODE_ENV (development/production)

3. REPLIT DEPLOYMENT:
   - Package.json scripts for dev and build
   - Workflow configuration for auto-restart
   - Environment secrets management
   - Static asset serving
   - SSL/TLS configuration

4. DATABASE MIGRATIONS:
   - Drizzle schema management
   - Automated migration running
   - Data seeding for benefit programs
   - Development vs production data

Include comprehensive error handling, logging, health checks, and monitoring setup.
```

## 🧪 Testing and Quality Assurance

```
Implement comprehensive testing strategy for SNAP benefits system:

1. FRONTEND TESTING:
   - Component testing with React Testing Library
   - Accessibility testing with axe-core
   - Multi-language UI testing
   - Mobile responsiveness validation
   - User journey testing

2. BACKEND TESTING:
   - API endpoint testing with supertest
   - Database integration testing
   - AI service mocking and validation
   - Error handling and edge cases
   - Performance and load testing

3. AI/ML TESTING:
   - Document analysis accuracy validation
   - Reading level compliance testing
   - Search relevance evaluation
   - Response quality assessment
   - Cost optimization verification

4. ACCESSIBILITY AUDITING:
   - WCAG 2.1 AA compliance verification
   - Screen reader testing
   - Keyboard navigation validation
   - Color contrast analysis
   - Plain language assessment

Include automated testing in CI/CD pipeline, test data management, and quality metrics tracking.
```

## 🚀 Advanced Features and Optimizations

```
Implement advanced features for production-ready Maryland SNAP system:

1. PERFORMANCE OPTIMIZATION:
   - Code splitting and lazy loading
   - API response caching
   - Database query optimization
   - Image optimization and CDN
   - Bundle size monitoring

2. SECURITY IMPLEMENTATION:
   - Input validation and sanitization
   - SQL injection prevention
   - XSS protection
   - CSRF tokens
   - Rate limiting and DDoS protection

3. MONITORING AND ANALYTICS:
   - API performance tracking
   - User behavior analytics
   - AI service usage monitoring
   - Error tracking and alerting
   - Cost analysis and optimization

4. ADVANCED AI FEATURES:
   - Conversation memory and context
   - Multi-modal document analysis
   - Personalized recommendations
   - Continuous learning integration
   - A/B testing for AI responses

5. INTEGRATION CAPABILITIES:
   - marylandbenefits.gov integration
   - Third-party benefit calculators
   - Document verification APIs
   - Multi-language translation services
   - Government data feeds

Include scalability planning, disaster recovery, data backup strategies, and compliance requirements.
```

---

## 🎯 Complete System Recreation Prompt

**Use this single comprehensive prompt to recreate the entire system:**

```
Create a complete Maryland SNAP Policy Manual System - an AI-powered platform for Maryland residents to verify documents against SNAP eligibility requirements and search official policies through natural language.

SYSTEM ARCHITECTURE:
- Frontend: React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS + Wouter routing
- Backend: Express.js + TypeScript + PostgreSQL + Drizzle ORM + Google Gemini API
- Storage: Google Cloud Storage with signed URLs and ACL management
- AI: Google Gemini (gemini-1.5-pro, text-embedding-004, gemini-1.5-pro-vision)

CORE FEATURES:
1. Document Verification: Upload mobile photos/PDFs, AI analysis with plain English results
2. Conversational Search: Natural language SNAP policy queries with RAG-powered responses
3. Multi-Language: 10-language support with Grade 6-8 reading level compliance
4. Maryland Branding: Official state seal, Digital Style Guide colors, Montserrat typography
5. Accessibility: WCAG 2.1 AA compliance, mobile-first responsive design

KEY COMPONENTS:
- Home page with prioritized search interface and collapsible document upload
- Navigation with Maryland seal, language selector, responsive mobile menu
- RAG service with semantic search, embedding generation, context-aware responses
- Document processor with OCR, classification, SNAP requirements verification
- Reading level service with Flesch-Kincaid assessment and text simplification
- Multi-language translation system with localStorage persistence

DATABASE SCHEMA:
users, documents, document_chunks (with vector embeddings), benefit_programs, policy_sources, search_queries, model_versions, training_jobs, document_types, system_configs

DEPLOYMENT:
Replit-compatible with environment secrets, automated workflows, hot reloading, health checks

Include comprehensive error handling, logging, security measures, performance optimization, and extensive accessibility features for government benefit users.
```

---

These prompts provide complete guidance for recreating the Maryland SNAP Policy Manual System with full functionality, proper architecture, and production-ready features.