# Overview

The Maryland Multi-Program Benefits Navigator System is an AI-powered platform designed to help users understand government benefit policies across seven major Maryland programs. It leverages Retrieval-Augmented Generation (RAG) and Rules as Code, primarily powered by the Google Gemini API, to process policy documents, extract information, and provide accurate answers regarding benefits, eligibility, and program requirements. The system aims to mitigate the "benefits navigation problem" by reducing information asymmetry and processing costs, thereby improving access to public benefits. Key capabilities include document upload, real-time semantic search, deterministic eligibility calculations via PolicyEngine, administrative tools, and AI model training interfaces. The project adheres to the Maryland Digital Style Guide and is intended for integration with marylandbenefits.gov.

Supported programs include Maryland SNAP, Medicaid, TCA (TANF), OHEP (Energy Assistance), WIC, Children's Health Program (MCHP), and IRS VITA Tax Assistance.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The frontend is built with React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS. It uses Wouter for routing and TanStack Query for server state management. The design emphasizes modularity, accessibility (WCAG, semantic HTML, ARIA), and mobile-first responsiveness. Key features include a `PolicyChatWidget`, a Command Palette, Framer Motion animations, resizable split views, and skeleton loading states. A public applicant portal offers document checklist generation, notice letter explanation, and simplified policy search, supporting both AI-powered ("smart") and manual ("simple") modes.

## Backend
The backend utilizes Express.js with TypeScript, providing RESTful API endpoints. Data is stored in PostgreSQL via Drizzle ORM on Neon Database. A multi-stage document processing pipeline handles OCR, classification, quality assessment, semantic chunking, and embedding generation. The Google Gemini API (`gemini-2.5-flash` for text, `text-embedding-004` for embeddings) is central for analysis, query processing, and RAG. The system also features a "Living Policy Manual" for generating human-readable policy text and a "Rules Extraction Pipeline" to derive structured "Rules as Code" from policy documents using Gemini.

## Data Management
PostgreSQL stores core data such as users, documents, chunks, "Rules as Code," citation tracking, navigator workspace data, audit logs, and document integrity information. Google Cloud Storage is used for document file storage with custom ACLs. Vector embeddings are stored within document chunks. An automated scraping infrastructure ensures integrity and version management of documents from official sources.

## Authentication and Authorization
A basic user authentication system supports roles (user, admin, super_admin). Object-level security is enforced using custom ACLs for Google Cloud Storage. Session management uses `connect-pg-simple` with PostgreSQL.

## Core Features
-   **Navigator Workspace**: Tracks client interaction sessions and supports E&E (Eligibility & Enrollment) export.
-   **Feedback Collection System**: Allows users to report issues with AI responses, with an admin interface for management.
-   **Admin Enhancement Tools**: Includes an Audit Log Viewer, API Documentation, and Feedback Management.
-   **Notification System**: Provides in-app notifications for policy updates, feedback, system alerts, and workflow events.
-   **Policy Change Diff Monitor**: Tracks policy document versions, detects changes, performs impact analysis, and sends role-based notifications.
-   **Compliance Assurance Suite**: A Gemini-powered system to validate policy documents against regulatory requirements (WCAG, LEP, federal regulations), managed via an admin UI.
-   **Adaptive Intake Copilot**: A Gemini-powered conversational assistant guiding applicants through processes like SNAP applications, extracting structured data, and generating forms. Integrates with PolicyEngine for real-time benefit calculations.
-   **PolicyEngine Integration**: Provides accurate multi-benefit calculations (SNAP, Medicaid, EITC, CTC, SSI, TANF) based on household data, integrated throughout the platform.
-   **Anonymous Benefit Screener**: A public-facing tool for anonymous eligibility checks using PolicyEngine, with session management and data migration features.
-   **Household Scenario Workspace**: A modeling tool for navigators to create and compare household scenarios with PolicyEngine-powered benefit calculations and visualizations.
-   **VITA Tax Assistant**: A federal tax assistance knowledge base using IRS Publication 4012, featuring RAG semantic search, extracted tax rules, and citations.
-   **Maryland Evaluation Framework**: An accuracy testing system for policy rules and calculations, adapted from Propel's snap-eval, tracking test cases, evaluation runs, and results with variance tolerance.

## Security & Performance
CSRF protection, multi-tier rate limiting, and security headers (Helmet, CSP, HSTS) are implemented for security. Server-side caching (NodeCache) and strategic database indexing are used for performance optimization.

## Testing
Vitest, @testing-library/react, and supertest are used for unit, component, and API integration tests respectively.

## Developer Documentation

The `ai-context/` directory contains comprehensive technical documentation for developers and AI agents working on the system:

-   **system-architecture.json**: JSON schema defining the complete system architecture including technology stack (Node.js, React, TypeScript), database structure (PostgreSQL/Drizzle ORM), AI services (Google Gemini models), external dependencies, security configuration, deployment model, and all 7 benefit programs. Serves as single source of truth for architectural decisions and system capabilities.

-   **code-patterns.md**: Reusable code examples and best practices from the codebase covering React component patterns, API routes, data fetching with TanStack Query, form validation with react-hook-form and Zod, authentication with Passport.js, database patterns with Drizzle ORM, AI integration with Gemini API, error handling, TypeScript patterns, and testing patterns.

-   **api-contracts.ts**: TypeScript interface definitions for 160+ API endpoints organized by domain (authentication, documents, RAG, PolicyEngine, admin, etc.). Provides type safety and API reference. Note: Reference template only - production should use tRPC or automated contract tests.

-   **task-templates.md**: Reusable workflow templates for common development tasks including document upload/processing, RAG search implementation, rules extraction, PolicyEngine integration, navigator workspace operations, compliance validation, admin dashboard features, testing workflows, document version management, and security audits.

-   **performance-optimization.md**: Performance tuning strategies covering database query optimization (indexing, Drizzle best practices), caching strategies (NodeCache with TTLs), frontend optimization (code splitting, lazy loading), API performance (pagination, rate limiting), and RAG search optimization.

-   **testing-guide.md**: Comprehensive testing patterns including unit testing (storage, utilities), integration testing (API routes, RAG service), component testing (React, forms), E2E testing (Playwright), AI/Gemini testing (mocking, embeddings), test setup (vitest.config.ts), and CI/CD integration.

-   **deployment-checklist.md**: Production deployment guide including pre-deployment validation, environment configuration (all required env vars), database migration (Drizzle commands), security hardening (CSP, rate limiting), performance optimization (accurate schema indexes, caching), monitoring/logging (winston, health checks, Sentry), post-deployment verification (all 7 Maryland programs), and rollback procedures.

-   **troubleshooting-guide.md**: Common issues and debugging solutions for application startup, database problems, authentication (session persistence with connect-pg-simple, CSRF), AI/Gemini integration, PolicyEngine issues, document upload/processing (GCS, OCR), RAG search debugging, performance optimization, frontend issues, and API errors.

All documentation aligns with actual codebase implementation (schema.ts, server modules, service files) and provides executable examples where applicable.

# External Dependencies

-   **AI Services**: Google Gemini API (`@google/genai`) for language models, document analysis, embeddings, and RAG. Models used: `gemini-2.5-flash`, `text-embedding-004`.
-   **Benefit Calculations**: PolicyEngine (`policyengine-us`) Python package for multi-benefit eligibility and amount calculations.
-   **Database**: PostgreSQL via Drizzle ORM (`drizzle-orm`) with Neon Database.
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine and Google Gemini Vision API.
-   **UI Components**: Radix UI primitives via shadcn/ui.
-   **Data Visualization**: Recharts for benefit comparison charts and analytics dashboards.
-   **PDF Generation**: jsPDF and jspdf-autotable for client counseling reports and scenario exports.