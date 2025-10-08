# Overview

This project is the Maryland SNAP Policy Manual System, an AI-powered platform designed to assist users in understanding government benefit policies for Maryland's Food Supplement Program (SNAP). It leverages Retrieval-Augmented Generation (RAG) technology, primarily powered by the Google Gemini API, to process policy documents, extract relevant information, and provide accurate answers to user queries regarding SNAP benefits, eligibility, and program requirements.

The system aims to address the "benefits navigation problem" by reducing information asymmetry and processing costs, thereby improving access to SNAP benefits. Key capabilities include document upload and processing, real-time search, administrative tools for managing policy sources, and AI model training interfaces. It adheres to the Maryland Digital Style Guide and is designed for integration with marylandbenefits.gov.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with React 18 and TypeScript, using Vite, shadcn/ui components (Radix UI primitives), and Tailwind CSS. Client-side routing is handled by Wouter, and server state management uses TanStack Query. The architecture emphasizes modular components, accessibility (WCAG patterns, semantic HTML, ARIA labels, keyboard navigation, skip links), and mobile-first responsive design. Plain language principles are applied for user-centered design.

## Backend Architecture
The backend uses Express.js with TypeScript, providing RESTful API endpoints. Data persistence is managed with PostgreSQL via Drizzle ORM, utilizing Neon Database. A multi-stage document processing pipeline includes OCR (Tesseract + Google Gemini Vision), document classification, quality assessment, semantic chunking, and embedding generation. AI integration is central, with the Google Gemini API (`gemini-2.5-flash` for text generation and `text-embedding-004` for embeddings) handling document analysis, query processing, and RAG-based search responses, including custom services for field extraction and quality assessment.

## Data Storage Solutions
The primary database is PostgreSQL, storing core data (users, documents, chunks), "Rules as Code" (income limits, deductions), citation tracking, navigator workspace data, audit logs, and document integrity information (versions, SHA-256 hashing). Google Cloud Storage is used for document file storage with custom ACLs. Vector embeddings for RAG are stored within the document chunks table. An automated policy source scraping infrastructure ingests documents from nine official federal and Maryland sources, ensuring integrity and version management.

## Authentication and Authorization
A basic user authentication system supports roles (user, admin, super_admin). Object-level security is managed by a custom ACL system for Google Cloud Storage with group-based access control. Session management uses `connect-pg-simple` with PostgreSQL.

## Navigator Workspace & E&E Integration
A Benefits Navigator Workspace tracks client interaction sessions, including details like date, duration, and outcomes. An E&E (Eligibility & Enrollment) export infrastructure generates batch exports in multiple formats (CSV, JSON, XML), designed to provide a data pathway for integration with Maryland DHS E&E systems once specifications are provided.

## Conversational AI Integration
A reusable `PolicyChatWidget` component provides RAG-powered conversational AI across various application contexts (document verification, navigator workspace, eligibility checker, policy manual). A backend API endpoint (`/api/chat/ask`) delivers context-aware responses with policy citations.

## Living Policy Manual (Partial Implementation)
AI-powered text generation service using Google Gemini (`gemini-2.0-flash`) generates human-readable policy text from database rules for income limits, deductions, allotments, categorical eligibility, and document requirements. The UI allows toggling between original and AI-generated text. Current limitation: rules tables lack `manual_section_id`, meaning text generation is program-wide, not section-specific.

## Rules Extraction Pipeline
A Google Gemini AI-powered system (`gemini-2.0-flash`) extracts structured "Rules as Code" from Maryland SNAP policy manual sections. It performs section-type detection and uses specialized extractors for income limits, deductions, allotments, categorical eligibility, and document requirements. The system includes defensive parsing and tracks extraction jobs. An Admin Interface provides a UI for section selection, batch extraction, and job history.

# External Dependencies

-   **AI Services**: Google Gemini API (`@google/genai`) for language models, document analysis, embeddings, and RAG. Models used: `gemini-2.5-flash`, `text-embedding-004`.
-   **Database**: PostgreSQL via Drizzle ORM (`drizzle-orm`) with Neon Database as the provider.
-   **Object Storage**: Google Cloud Storage integrated with Replit sidecar.
-   **Document Processing**: Tesseract OCR engine and Google Gemini Vision API.
-   **UI Components**: Radix UI primitives via shadcn/ui.
-   **File Upload**: Uppy library.