# Overview

This is the Maryland SNAP Policy Manual System - an AI-powered platform specifically designed for Maryland's Food Supplement Program (SNAP) that helps users find and understand government benefit policies through intelligent document processing and search capabilities. The system uses RAG (Retrieval-Augmented Generation) technology powered primarily by Google Gemini API (with migration from OpenAI 95% complete) to process policy documents, extract relevant information, and provide accurate answers to user queries about Maryland SNAP benefits, eligibility, and program requirements.

The platform features document upload and processing capabilities, real-time search functionality, administrative tools for managing policy sources, and AI model training interfaces. It's designed to solve the "benefits navigation problem" by reducing information asymmetries and processing costs that prevent people from accessing the SNAP benefits they're entitled to. The system is fully compliant with Maryland Digital Style Guide standards and designed for integration with marylandbenefits.gov.

# User Preferences

Preferred communication style: Simple, everyday language.

# Maryland Digital Style Guide Compliance

The system implements Maryland Digital Style Guide (2023) branding elements:

**Brand Colors**: Official Maryland red (#c8122c), gold (#ffc838), black (#231f20), and white (#ffffff) defined in `client/src/index.css` as CSS custom properties (`--maryland-red`, `--maryland-gold`, etc.) and used throughout the interface.

**Typography**: Montserrat font family imported via Google Fonts and applied to headings (Semi Bold 600) and body text (Regular 400) in the CSS layer.

**Logo Integration**: Custom Maryland logo SVG component in `client/src/components/Navigation.tsx` using official colors and Montserrat typography.

**Current Implementation Status**: 
- ✅ Brand colors and typography fully implemented
- ✅ Basic accessibility features (ARIA labels, skip links, semantic HTML)
- ✅ Mobile-responsive design with touch target optimization
- 🔄 marylandbenefits.gov integration patterns planned but not yet implemented

# System Architecture

## Frontend Architecture
**Technology Stack**: React 18 with TypeScript, using Vite for build tooling and development server. The UI is built with shadcn/ui components (Radix UI primitives) and Tailwind CSS for styling, customized with Maryland Digital Style Guide theming.

**Routing**: Client-side routing implemented with Wouter, providing navigation between Search, Upload, Admin, and Training pages with ARIA-compliant navigation landmarks.

**State Management**: Uses TanStack Query (React Query) for server state management, API caching, and data synchronization. No global client state management library needed due to the document-centric nature of the application.

**Component Architecture**: Modular component structure with reusable UI components, feature-specific components for each major function (search, upload, admin, training), and custom hooks for common functionality.

**Accessibility Features**: Implemented WCAG accessibility patterns including semantic HTML, ARIA labels (`aria-labelledby`, `aria-describedby`), keyboard navigation support, skip links (`client/src/App.tsx`, `client/src/components/SearchInterface.tsx`), screen reader optimization with `sr-only` classes, and CSS support for high contrast and reduced motion preferences in `client/src/index.css`.

**Mobile Optimization**: Mobile-first responsive design with touch target optimization (44px minimum), progressive typography scaling, and optimized user experience across all device sizes.

**Plain Language Implementation**: User-centered language design for non-technical audiences, with simplified error messaging, conversational search examples, and everyday language throughout the interface.

## Backend Architecture
**Server Framework**: Express.js with TypeScript, providing RESTful API endpoints for document management, search functionality, and administrative operations.

**Database Layer**: PostgreSQL database accessed through Drizzle ORM, providing type-safe database operations and schema management. Uses Neon Database as the PostgreSQL provider.

**Document Processing Pipeline**: Multi-stage processing including OCR (Tesseract + Google Gemini Vision), document classification (partially OpenAI), quality assessment, semantic chunking, and embedding generation optimized for Maryland SNAP policy documents.

**AI Integration**: Google Gemini API integration for document analysis, query processing, and RAG-based search responses (95% migrated from OpenAI). Primary implementation in `server/services/aiService.ts`, `server/services/ragService.ts`, and `server/services/documentProcessor.ts` using `@google/genai` library. Includes custom AI services for document field extraction, quality assessment, and training job management. Migration provides cost optimization and improved performance for Maryland SNAP-specific queries.

**Migration Status**: ✅ **Complete** - All OpenAI calls have been successfully migrated to Google Gemini API.

## Data Storage Solutions
**Primary Database**: PostgreSQL with comprehensive schema including:
- Core tables: users, documents, document chunks, benefit programs, policy sources
- Rules as Code: income limits, deductions, allotments, categorical eligibility, document requirements
- Citation tracking: policy_citations, policy_variances (federal vs state mapping)
- Navigator workspace: client_interaction_sessions, ee_export_batches, consent_forms, client_consents
- Audit & governance: audit_logs, rule_change_logs, eligibility_calculations
- Document integrity: document_versions with SHA-256 hashing for golden source tracking

**Object Storage**: Google Cloud Storage integration for document file storage with custom ACL (Access Control List) policies for security. Includes upload URL generation and direct-to-storage uploads.

**Vector Storage**: Embedded within the document chunks table to store semantic embeddings for RAG search functionality.

**Policy Source Scraping**: Automated document ingestion infrastructure (`server/services/policySourceScraper.ts`) configured with 9 official sources:
- Federal: 7 CFR Part 273, FNS Policy Memos, Handbook 310, E&T Operations Handbook, Implementation Memoranda
- Maryland: COMAR Title 10, SNAP Policy Manual, Action Transmittals (AT), Information Memos (IM)
- Priority-based sync scheduling, integrity tracking via document hashing, and version management for golden source documents

## Authentication and Authorization
**User Management**: Basic user authentication system with username/password, supporting user roles (user, admin, super_admin).

**Object-Level Security**: Custom ACL system for object storage with group-based access control supporting different access types and permissions (read/write).

**Session Management**: Uses connect-pg-simple for PostgreSQL-backed session storage.

## Navigator Workspace & E&E Integration

**Benefits Navigator Workspace**: Fully implemented client session tracking system (`client/src/pages/NavigatorWorkspace.tsx`) enabling navigators to:
- Log client interaction sessions (screening, application assistance, recertification, documentation, follow-up)
- Track session details (date, duration, location, topics, outcomes, action items)
- Monitor export status for each session

**E&E Export Infrastructure**: Export batch generation system providing the foundation for Maryland DHS Eligibility & Enrollment (E&E) system integration:
- Multi-format export generation (CSV, JSON, XML) via `server/routes.ts` endpoints
- Session batch management with export tracking (`ee_export_batches` table)
- Automatic marking of sessions as exported to prevent duplicates
- Download functionality for manual or automated transfer to E&E system

**Integration Status**: 
- ✅ **Export Pathway Built**: File generation, batch tracking, and session management complete
- 🔄 **Maryland DHS E&E Integration**: Awaiting specific integration requirements from Maryland DHS IT team
- The current implementation provides the data export foundation that can be connected to Maryland's E&E system once integration specifications are provided

**Note**: The E&E export functionality is designed as a pathway - it generates properly formatted exports ready for Maryland DHS systems, but does not include automated upload/integration pending receipt of official Maryland DHS system specifications and API endpoints.

## Conversational AI Integration

**PolicyChatWidget**: Reusable conversational AI component (`client/src/components/PolicyChatWidget.tsx`) integrated across all major pages:
- Document Verification (`context="document-verification"`) - help with verification requirements
- Navigator Workspace (`context="navigator-workspace"`) - guidance on session tracking and exports
- Eligibility Checker (`context="eligibility"`) - answers about SNAP eligibility rules
- Policy Manual (`context="policy-manual"`) - explanations of policy sections

**Chat API**: Backend endpoint (`/api/chat/ask`) providing RAG-powered responses with policy citations, audit logging, and context-aware query enhancement.

## External Dependencies

### Current Implementation
**AI Services**: Google Gemini API (`@google/genai`) for language model access, document analysis, embedding generation, and RAG response synthesis. Models used: `gemini-1.5-pro`, `text-embedding-004`. One remaining OpenAI dependency for document classification.

**Database**: PostgreSQL database via Drizzle ORM (`drizzle-orm`) with Neon Database provider. Schema defined in `shared/schema.ts`. Connection pooling and SNAP-specific data modeling implemented.

**Object Storage**: Google Cloud Storage integration with Replit sidecar for document file storage and authentication.

**Document Processing**: Tesseract OCR engine combined with Google Gemini Vision API for text extraction from Maryland SNAP policy documents.

**UI Components**: Radix UI primitives via shadcn/ui for accessible components, customized with Maryland brand colors and Montserrat typography.

**File Upload**: Uppy library for robust file upload with progress tracking and direct-to-storage uploads.

### Implementation Status
- ✅ **Google Gemini API**: 95% migrated (primary AI operations)
- ✅ **Maryland Branding**: Colors, typography, logo component implemented  
- ✅ **Database**: PostgreSQL with Drizzle ORM fully implemented
- ✅ **Basic Accessibility**: ARIA labels, skip links, semantic HTML
- ✅ **Mobile Responsive**: Touch targets, responsive breakpoints
- ✅ **Google Gemini API**: 100% migration complete
- 🔄 **marylandbenefits.gov Integration**: Planned for future implementation