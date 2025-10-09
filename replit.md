# Overview

This project is the Maryland SNAP Policy Manual System, an AI-powered platform assisting users in understanding government benefit policies for Maryland's Food Supplement Program (SNAP). It uses Retrieval-Augmented Generation (RAG) technology, primarily powered by the Google Gemini API, to process policy documents, extract information, and provide accurate answers regarding SNAP benefits, eligibility, and program requirements. The system aims to address the "benefits navigation problem" by reducing information asymmetry and processing costs, thereby improving access to SNAP benefits. Key capabilities include document upload, real-time search, administrative tools, and AI model training interfaces. It adheres to the Maryland Digital Style Guide and is designed for integration with marylandbenefits.gov.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The frontend uses React 18, TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS. Wouter handles client-side routing, and TanStack Query manages server state. It emphasizes modularity, accessibility (WCAG, semantic HTML, ARIA), and mobile-first responsive design. Features include a `PolicyChatWidget` for conversational AI, a Command Palette for navigation, Framer Motion for animations, resizable split views, and skeleton loading states. A public applicant portal offers document checklist generation, notice letter explanation, and simplified policy search, all with dual "smart" (AI-powered) and "simple" (manual) modes.

## Backend
The backend uses Express.js with TypeScript, providing RESTful API endpoints. Data is persisted using PostgreSQL via Drizzle ORM on Neon Database. A multi-stage document processing pipeline includes OCR, classification, quality assessment, semantic chunking, and embedding generation. Google Gemini API (`gemini-2.5-flash` for text, `text-embedding-004` for embeddings) is central for analysis, query processing, and RAG. A "Living Policy Manual" generates human-readable policy text from database rules, and a "Rules Extraction Pipeline" uses Gemini to extract structured "Rules as Code" from policy documents.

## Data Management
PostgreSQL stores core data (users, documents, chunks), "Rules as Code," citation tracking, navigator workspace data, audit logs, and document integrity information. Google Cloud Storage handles document file storage with custom ACLs. Vector embeddings are stored within document chunks. An automated scraping infrastructure ingests documents from official sources, ensuring integrity and version management.

## Authentication and Authorization
A basic user authentication system supports roles (user, admin, super_admin). Object-level security uses custom ACLs for Google Cloud Storage. Session management employs `connect-pg-simple` with PostgreSQL.

## Core Features
-   **Navigator Workspace**: Tracks client interaction sessions and provides an E&E (Eligibility & Enrollment) export infrastructure for future DHS integration.
-   **Feedback Collection System**: Allows users to report issues with AI responses and content, with an admin interface for management.
-   **Admin Enhancement Tools**: Includes an Audit Log Viewer, API Documentation, and Feedback Management for system operations and DHS integration readiness.
-   **Notification System**: Provides in-app notifications for policy updates, feedback, system alerts, and workflow events with user-configurable preferences and a dedicated notification center.

## Security & Performance
-   **Security**: CSRF protection (double-submit cookie), multi-tier rate limiting, and security headers (Helmet, environment-aware CSP, HSTS) are implemented.
-   **Performance**: Server-side caching (NodeCache with TTL and invalidation) for frequently accessed data and strategic database indexing optimize query performance.

## Testing
Vitest, @testing-library/react, and supertest are used for unit, component, and API integration tests respectively.

# External Dependencies

-   **AI Services**: Google Gemini API (`@google/genai`) for language models, document analysis, embeddings, and RAG. Models used: `gemini-2.5-flash`, `text-embedding-004`.
-   **Database**: PostgreSQL via Drizzle ORM (`drizzle-orm`) with Neon Database.
-   **Object Storage**: Google Cloud Storage.
-   **Document Processing**: Tesseract OCR engine and Google Gemini Vision API.
-   **UI Components**: Radix UI primitives via shadcn/ui.