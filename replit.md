# Overview

This is an AI-powered benefits navigation platform that helps users find and understand government benefit policies through intelligent document processing and search capabilities. The system uses RAG (Retrieval-Augmented Generation) technology powered by OpenAI's GPT-5 to process policy documents, extract relevant information, and provide accurate answers to user queries about benefit programs like SNAP, Medicaid, and other government services.

The platform features document upload and processing capabilities, real-time search functionality, administrative tools for managing policy sources, and AI model training interfaces. It's designed to solve the "benefits navigation problem" by reducing information asymmetries and processing costs that prevent people from accessing the benefits they're entitled to.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
**Technology Stack**: React 18 with TypeScript, using Vite for build tooling and development server. The UI is built with shadcn/ui components (Radix UI primitives) and Tailwind CSS for styling.

**Routing**: Client-side routing implemented with Wouter, providing navigation between Search, Upload, Admin, and Training pages.

**State Management**: Uses TanStack Query (React Query) for server state management, API caching, and data synchronization. No global client state management library needed due to the document-centric nature of the application.

**Component Architecture**: Modular component structure with reusable UI components, feature-specific components for each major function (search, upload, admin, training), and custom hooks for common functionality.

## Backend Architecture
**Server Framework**: Express.js with TypeScript, providing RESTful API endpoints for document management, search functionality, and administrative operations.

**Database Layer**: PostgreSQL database accessed through Drizzle ORM, providing type-safe database operations and schema management. Uses Neon Database as the PostgreSQL provider.

**Document Processing Pipeline**: Multi-stage processing including OCR (Tesseract + OpenAI Vision), document classification, quality assessment, semantic chunking, and embedding generation.

**AI Integration**: OpenAI GPT-5 integration for document analysis, query processing, and RAG-based search responses. Includes custom AI services for document field extraction, quality assessment, and training job management.

## Data Storage Solutions
**Primary Database**: PostgreSQL with tables for users, documents, document chunks, benefit programs, policy sources, search queries, model versions, and training jobs.

**Object Storage**: Google Cloud Storage integration for document file storage with custom ACL (Access Control List) policies for security. Includes upload URL generation and direct-to-storage uploads.

**Vector Storage**: Embedded within the document chunks table to store semantic embeddings for RAG search functionality.

## Authentication and Authorization
**User Management**: Basic user authentication system with username/password, supporting user roles (user, admin, super_admin).

**Object-Level Security**: Custom ACL system for object storage with group-based access control supporting different access types and permissions (read/write).

**Session Management**: Uses connect-pg-simple for PostgreSQL-backed session storage.

## External Dependencies
**AI Services**: OpenAI API for GPT-5 model access, document analysis, embedding generation, and RAG response synthesis.

**Database**: Neon Database (PostgreSQL) for primary data storage with connection pooling.

**Object Storage**: Google Cloud Storage for document file storage with Replit sidecar integration for authentication.

**Document Processing**: Tesseract OCR engine combined with OpenAI Vision API for text extraction from various document formats.

**UI Components**: Extensive use of Radix UI primitives through shadcn/ui for accessible, customizable component library.

**File Upload**: Uppy library for robust file upload handling with progress tracking, preview, and direct-to-storage uploads.