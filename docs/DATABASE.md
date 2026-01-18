# Maryland Multi-Program Benefits Navigator - Database Schema Documentation

**Version:** 2.2  
**Database:** PostgreSQL (Neon)  
**ORM:** Drizzle  
**Last Updated:** January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Core Tables](#core-tables)
4. [Document Management](#document-management)
5. [Navigator Workspace](#navigator-workspace)
6. [Rules as Code](#rules-as-code)
7. [Notifications & Audit](#notifications--audit)
8. [Compliance & Quality](#compliance--quality)
9. [Intake & Screening](#intake--screening)
10. [Public Portal](#public-portal)
11. [Scenario Modeling](#scenario-modeling)
12. [Evaluation Framework](#evaluation-framework)
13. [Indexes & Performance](#indexes--performance)
14. [Migration Guide](#migration-guide)
15. [Data Integrity](#data-integrity)

---

## Overview

The database consists of **57 tables** organized into logical domains:

- **Core:** Users, programs, document types (3 tables)
- **Document Management:** Documents, chunks, versions, sources (7 tables)
- **Navigator Workspace:** Cases, sessions, exports, documents (6 tables)
- **Rules as Code:** Income limits, deductions, allotments, extracted rules (13 tables)
- **Notifications:** Notifications, preferences, templates (3 tables)
- **Compliance:** Rules, violations, policy changes (6 tables)
- **Intake:** Sessions, messages, forms, screening (6 tables)
- **Public Portal:** Templates, FAQs, notices (3 tables)
- **Scenario Modeling:** Scenarios, calculations, comparisons (5 tables)
- **Plus:** Search, ML models, audit logs, ABAWD, enrollment, VITA

---

## Entity Relationship Diagram

**Note:** This simplified ERD shows the primary entity groups and their verified foreign key relationships. See individual table sections below for complete FK details. All 57 tables are documented.

### High-Level Entity Relationship Overview

```
                    ┌─────────────────────────────────┐
                    │          USERS (Core)           │
                    │  - Authentication & Authorization│
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────┼──────────────────┐
                    │              │                  │
                    ▼              ▼                  ▼
      ┌──────────────────┐  ┌─────────────┐   ┌─────────────────┐
      │    DOCUMENTS      │  │   CASES     │   │  NOTIFICATIONS  │
      │  - RAG Pipeline   │  │ - Navigator │   │  - Alerts       │
      │  - Versioning     │  │ - Sessions  │   │  - Preferences  │
      └──────────────────┘  └─────────────┘   └─────────────────┘
               │                    │
               │                    │
               ▼                    ▼
      ┌──────────────────┐  ┌──────────────────────┐
      │  CHUNKS & SEARCH  │  │ VERIFICATIONS &      │
      │  - Embeddings     │  │ EXPORTS              │
      │  - Queries        │  │ - Documents          │
      └──────────────────┘  │ - E&E Batches        │
                             └──────────────────────┘


      ┌─────────────────────────────────────────────────────┐
      │        RULES AS CODE (Multi-Program)                │
      │                                                     │
      │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐│
      │  │SNAP Rules   │  │ Categorical  │  │Eligibility ││
      │  │- Income     │  │ Eligibility  │  │Calculations││
      │  │- Deductions │  │ - Rules      │  └────────────┘│
      │  │- Allotments │  └──────────────┘                 │
      │  └─────────────┘                                   │
      └─────────────────────────────────────────────────────┘


      ┌──────────────────┐      ┌──────────────────────────┐
      │  POLICY MGMT     │      │   INTAKE & SCREENING     │
      │  - Changes       │      │   - Sessions             │
      │  - Impacts       │      │   - Messages             │
      │  - Manual        │      │   - Application Forms    │
      │  - Citations     │      │   - Anonymous Sessions   │
      └──────────────────┘      └──────────────────────────┘


      ┌──────────────────┐      ┌──────────────────────────┐
      │  COMPLIANCE      │      │   SCENARIO MODELING      │
      │  - Rules         │      │   - Households           │
      │  - Violations    │      │   - Calculations         │
      │  - PE Verify     │      │   - Comparisons          │
      └──────────────────┘      └──────────────────────────┘


      ┌──────────────────┐      ┌──────────────────────────┐
      │  EVALUATION      │      │   PUBLIC PORTAL          │
      │  - Test Cases    │      │   - Doc Templates        │
      │  - Runs          │      │   - Notice Templates     │
      │  - Results       │      │   - FAQ                  │
      └──────────────────┘      └──────────────────────────┘


      ┌──────────────────┐      ┌──────────────────────────┐
      │  AUDIT & ML      │      │   ENROLLMENT             │
      │  - Audit Logs    │      │   - ABAWD Exemptions     │
      │  - Feedback      │      │   - Program Enrollments  │
      │  - Training Jobs │      └──────────────────────────┘
      │  - Model Versions│
      └──────────────────┘
```

**Foreign Key Relationships:** See individual table sections below for complete foreign key definitions and constraints.

---

## Core Tables

### users
**Purpose:** Authentication and user management

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY, DEFAULT uuid | User identifier |
| username | text | NOT NULL, UNIQUE | Login username |
| password | text | NOT NULL | Hashed password (bcrypt) |
| email | text | | Email address |
| full_name | text | | User's full name |
| phone | text | | Contact phone |
| role | text | NOT NULL, DEFAULT 'client' | client, navigator, caseworker, admin |
| dhs_employee_id | text | | Maryland DHS staff ID |
| office_location | text | | DHS office location |
| is_active | boolean | NOT NULL, DEFAULT true | Account active status |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | timestamp | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Has many: documents, client_cases, notifications, search_queries
- Owns: intake_sessions, household_scenarios

### benefit_programs
**Purpose:** Multi-program configuration

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY, DEFAULT uuid | Program identifier |
| name | text | NOT NULL | Program display name |
| code | text | NOT NULL, UNIQUE | MD_SNAP, MD_MEDICAID, etc. |
| description | text | | Program description |
| program_type | text | NOT NULL, DEFAULT 'benefit' | benefit, tax, hybrid |
| has_rules_engine | boolean | NOT NULL, DEFAULT false | Supports rules extraction |
| has_policy_engine_validation | boolean | NOT NULL, DEFAULT false | PolicyEngine integration |
| has_conversational_ai | boolean | NOT NULL, DEFAULT true | RAG chat support |
| primary_source_url | text | | Main policy manual URL |
| source_type | text | | pdf, web_scraping, api |
| scraping_config | jsonb | | Scraping configuration |
| is_active | boolean | NOT NULL, DEFAULT true | Program active status |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | timestamp | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Supported Programs:**
- MD_SNAP (Food Supplement Program)
- MD_MEDICAID (Medical Assistance)
- MD_TCA (TANF)
- MD_OHEP (Energy Assistance)
- MD_WIC (Women, Infants, Children)
- MD_MCHP (Children's Health Program)
- VITA (Tax Assistance)

### document_types
**Purpose:** Document classification

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY, DEFAULT uuid | Type identifier |
| name | text | NOT NULL | Type display name |
| code | text | NOT NULL, UNIQUE | POLICY_MANUAL, GUIDANCE, etc. |
| description | text | | Type description |
| is_active | boolean | NOT NULL, DEFAULT true | Type active status |

---

## Document Management

### documents
**Purpose:** File metadata and tracking

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Document identifier |
| filename | text | NOT NULL | Current filename |
| original_name | text | NOT NULL | Original upload name |
| object_path | text | | Google Cloud Storage path |
| document_type_id | varchar | FOREIGN KEY → document_types | Document classification |
| benefit_program_id | varchar | FOREIGN KEY → benefit_programs | Associated program |
| file_size | integer | | File size in bytes |
| mime_type | text | | MIME type |
| uploaded_by | varchar | FOREIGN KEY → users | Uploader |
| status | text | NOT NULL, DEFAULT 'uploaded' | Processing status |
| processing_status | jsonb | | Detailed processing info |
| quality_score | real | | 0-1 quality assessment |
| ocr_accuracy | real | | 0-1 OCR accuracy |
| metadata | jsonb | | Extracted metadata |
| source_url | text | | Original download URL |
| downloaded_at | timestamp | | Ingestion timestamp |
| document_hash | text | | SHA-256 integrity hash |
| is_golden_source | boolean | NOT NULL, DEFAULT false | Official policy doc |
| section_number | text | | Manual section (e.g., "100") |
| last_modified_at | timestamp | | Source last modified |
| audit_trail | jsonb | | Provenance info |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | timestamp | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `documents_benefit_program_idx` ON (benefit_program_id)
- `documents_status_idx` ON (status)
- `documents_section_number_idx` ON (section_number)

### document_chunks
**Purpose:** Semantic chunks with vector embeddings

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Chunk identifier |
| document_id | varchar | FOREIGN KEY → documents (ON DELETE CASCADE) | Parent document |
| chunk_index | integer | NOT NULL | Chunk sequence number |
| content | text | NOT NULL | Chunk text content |
| embeddings | text | | JSON vector embeddings |
| vector_id | text | | Vector DB identifier |
| metadata | jsonb | | Chunk-specific metadata |
| page_number | integer | | Source page number |
| start_offset | integer | | Character start offset |
| end_offset | integer | | Character end offset |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `chunks_document_id_idx` ON (document_id)

**Vector Search:**
```sql
-- Cosine similarity search (requires pgvector extension)
SELECT * FROM document_chunks
WHERE embeddings <=> embedding_vector < 0.5
ORDER BY embeddings <=> embedding_vector
LIMIT 10;
```

### document_versions
**Purpose:** Policy document version tracking

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Version identifier |
| document_id | varchar | FOREIGN KEY → documents (ON DELETE CASCADE) | Parent document |
| version_number | integer | NOT NULL | Version sequence |
| document_hash | text | NOT NULL | SHA-256 hash |
| source_url | text | NOT NULL | Download URL |
| downloaded_at | timestamp | NOT NULL | Download timestamp |
| last_modified_at | timestamp | | Source modification date |
| file_size | integer | | Version file size |
| http_headers | jsonb | | Download HTTP headers |
| changes_summary | text | | Change description |
| audit_trail | jsonb | | Full audit info |
| object_path | text | | Storage path |
| is_active | boolean | NOT NULL, DEFAULT true | Active version flag |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### policy_sources
**Purpose:** External policy source configuration

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Source identifier |
| name | text | NOT NULL | Source name |
| source_type | text | NOT NULL | federal_regulation, state_policy, etc. |
| jurisdiction | text | NOT NULL | federal, maryland |
| description | text | | Source description |
| url | text | | Source URL |
| benefit_program_id | varchar | FOREIGN KEY → benefit_programs | Associated program |
| sync_type | text | NOT NULL | manual, api, web_scraping |
| sync_schedule | text | | daily, weekly, monthly |
| sync_config | jsonb | | Sync configuration |
| last_sync_at | timestamp | | Last sync attempt |
| last_successful_sync_at | timestamp | | Last successful sync |
| sync_status | text | DEFAULT 'idle' | idle, syncing, success, error |
| sync_error | text | | Last error message |
| document_count | integer | DEFAULT 0 | Documents from source |
| priority | integer | DEFAULT 0 | Sync priority |
| is_active | boolean | NOT NULL, DEFAULT true | Active status |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | timestamp | NOT NULL, DEFAULT NOW() | Last update timestamp |

---

## Navigator Workspace

### client_cases
**Purpose:** Client case management for Navigator workspace

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Case identifier |
| client_name | text | NOT NULL | Client name |
| client_identifier | text | | Last 4 SSN or case number |
| benefit_program_id | varchar | FOREIGN KEY → benefit_programs, NOT NULL | Associated benefit program |
| assigned_navigator | varchar | FOREIGN KEY → users | Assigned navigator |
| status | text | NOT NULL, DEFAULT 'screening' | screening, documents_pending, submitted, approved, denied |
| household_size | integer | | Number in household |
| estimated_income | integer | | Estimated income in cents |
| eligibility_calculation_id | varchar | FOREIGN KEY → eligibility_calculations | Linked eligibility calc |
| application_submitted_at | timestamp | | When application submitted |
| application_approved_at | timestamp | | When application approved |
| notes | text | | Case notes |
| tags | jsonb | | Categorization/filtering tags |
| created_by | varchar | FOREIGN KEY → users, NOT NULL | Who created the case |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation time |
| updated_at | timestamp | NOT NULL, DEFAULT NOW() | Last update time |

### client_interaction_sessions
**Purpose:** Session tracking for navigator interactions with pathway tracking

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Session identifier |
| client_case_id | varchar | FOREIGN KEY → client_cases | Parent case |
| navigator_id | varchar | FOREIGN KEY → users, NOT NULL | Navigator conducting session |
| session_type | text | NOT NULL | screening, application_assist, recert_assist, documentation, follow_up |
| interaction_date | timestamp | NOT NULL, DEFAULT NOW() | When session occurred |
| duration_minutes | integer | | Session duration |
| location | text | | office, phone, field_visit, video |
| topics_discussed | jsonb | | Array of topics covered |
| documents_received | jsonb | | Documents submitted during session |
| documents_verified | jsonb | | Verification results |
| action_items | jsonb | | Follow-up tasks |
| notes | text | | Navigator notes |
| outcome_status | text | | completed, needs_follow_up, referred, application_submitted |
| pathway_stage | text | | Client's accountability pathway stage |
| previous_pathway_stage | text | | Previous pathway stage |
| pathway_transitioned_at | timestamp | | When stage last changed |
| pathway_notes | text | | Navigator notes about pathway progress |
| exported_to_ee | boolean | NOT NULL, DEFAULT false | Exported to E&E system |
| exported_at | timestamp | | When exported |
| export_batch_id | varchar | | Export batch reference |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | timestamp | NOT NULL, DEFAULT NOW() | Last update |

### client_verification_documents
**Purpose:** Document verification with Gemini Vision analysis

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Document identifier |
| session_id | varchar | FOREIGN KEY → client_interaction_sessions, NOT NULL, CASCADE | Parent session |
| client_case_id | varchar | FOREIGN KEY → client_cases, NOT NULL | Associated case |
| document_type | text | NOT NULL | rent_receipt, utility_bill, pay_stub, etc. |
| file_name | text | NOT NULL | Original filename |
| file_path | text | NOT NULL | Path in object storage |
| file_size | integer | | Size in bytes |
| mime_type | text | NOT NULL | File MIME type |
| uploaded_by | varchar | FOREIGN KEY → users, NOT NULL | User who uploaded |
| vision_analysis_status | text | NOT NULL, DEFAULT 'pending' | pending, processing, completed, failed |
| vision_analysis_error | text | | Error message if failed |
| extracted_data | jsonb | | Structured data: {amount, date, address, payee} |
| raw_vision_response | jsonb | | Full Gemini Vision API response |
| confidence_score | real | | 0-1 confidence in extraction accuracy |
| verification_status | text | NOT NULL, DEFAULT 'pending_review' | pending_review, approved, rejected, needs_more_info |
| validation_warnings | jsonb | | Array of warning messages |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | timestamp | NOT NULL, DEFAULT NOW() | Last update |

**Indexes:**
- `client_verification_documents_session_id_idx` ON (session_id)
- `client_verification_documents_status_idx` ON (verification_status)

### ee_export_batches
**Purpose:** E&E (Eligibility & Enrollment) export for DHS integration

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Batch identifier |
| batch_name | text | NOT NULL | Batch name |
| session_ids | text().array() | | Included session IDs |
| export_format | text | NOT NULL, DEFAULT 'xml' | xml, json, csv |
| export_data | jsonb | | Exported data |
| file_path | text | | Export file path |
| exported_by | varchar | FOREIGN KEY → users | Exporter |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Export timestamp |

### consent_forms
**Purpose:** Consent form templates

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Form identifier |
| form_type | text | NOT NULL | information_sharing, etc. |
| title | text | NOT NULL | Form title |
| description | text | | Form description |
| required_for_programs | text().array() | | Required program codes |
| form_content | jsonb | NOT NULL | Form structure |
| version | text | NOT NULL | Form version |
| effective_date | timestamp | NOT NULL | Effective from |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### client_consents
**Purpose:** Client consent tracking and digital signatures

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Consent identifier |
| client_case_id | varchar | FOREIGN KEY → client_cases, NOT NULL | Associated client case |
| consent_form_id | varchar | FOREIGN KEY → consent_forms, NOT NULL | Form template used |
| session_id | varchar | FOREIGN KEY → client_interaction_sessions | Session where consent given |
| signature_data | text | | Base64 encoded signature image |
| signature_method | text | | digital, wet_signature, verbal, electronic |
| witnessed_by | varchar | FOREIGN KEY → users | Staff witness |
| ip_address | text | | IP address where consent given |
| revoked_reason | text | | Reason if revoked |
| notes | text | | Additional notes |

---

## Rules as Code

### snap_income_limits
**Purpose:** SNAP income eligibility rules

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Rule identifier |
| household_size | integer | NOT NULL | Household size |
| gross_income_limit | integer | NOT NULL | Gross monthly limit |
| net_income_limit | integer | NOT NULL | Net monthly limit |
| effective_date | timestamp | NOT NULL | Effective from |
| end_date | timestamp | | Effective until |
| is_active | boolean | NOT NULL, DEFAULT true | Active status |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### snap_deductions
**Purpose:** SNAP allowable deductions

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Deduction identifier |
| deduction_type | text | NOT NULL | standard, shelter, medical, etc. |
| deduction_name | text | NOT NULL | Deduction display name |
| calculation_method | text | NOT NULL | fixed, percentage, max_of |
| amount | integer | | Fixed amount (cents) |
| percentage | real | | Percentage value |
| max_amount | integer | | Maximum deduction (cents) |
| min_amount | integer | | Minimum deduction (cents) |
| conditions | jsonb | | Eligibility conditions |
| effective_date | timestamp | NOT NULL | Effective from |
| end_date | timestamp | | Effective until |
| is_active | boolean | NOT NULL, DEFAULT true | Active status |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### snap_allotments
**Purpose:** SNAP benefit amounts

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Allotment identifier |
| household_size | integer | NOT NULL | Household size |
| max_allotment | integer | NOT NULL | Maximum benefit (cents) |
| min_allotment | integer | NOT NULL, DEFAULT 0 | Minimum benefit (cents) |
| effective_date | timestamp | NOT NULL | Effective from |
| end_date | timestamp | | Effective until |
| is_active | boolean | NOT NULL, DEFAULT true | Active status |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### extracted_rules
**Purpose:** AI-extracted policy rules

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Rule identifier |
| benefit_program_id | varchar | FOREIGN KEY → benefit_programs | Program |
| rule_type | text | NOT NULL | eligibility, calculation, etc. |
| rule_code | text | NOT NULL | Machine-readable rule |
| natural_language | text | NOT NULL | Human-readable text |
| regulation_reference | text | | Official citation |
| confidence_score | real | | 0-1 extraction confidence |
| effective_date | timestamp | | Effective from |
| end_date | timestamp | | Effective until |
| is_active | boolean | NOT NULL, DEFAULT true | Active status |
| created_by | varchar | FOREIGN KEY → users | Extractor |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### eligibility_calculations
**Purpose:** Benefit calculation results

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Calculation identifier |
| user_id | varchar | FOREIGN KEY → users | User |
| household_size | integer | NOT NULL | Household size |
| gross_income | integer | NOT NULL | Gross monthly income |
| net_income | integer | NOT NULL | Net monthly income |
| deductions | jsonb | NOT NULL | Applied deductions |
| calculated_benefit | integer | NOT NULL | Benefit amount (cents) |
| is_eligible | boolean | NOT NULL | Eligibility result |
| calculation_method | text | NOT NULL | Method used |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Calculation timestamp |

### law_provisions
**Purpose:** Extracted provisions from public laws for ontology mapping

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Provision identifier |
| public_law_id | varchar | FOREIGN KEY → public_laws | Source law |
| section_number | text | NOT NULL | Section within law |
| provision_type | text | NOT NULL | amends, supersedes, adds_exception, modifies_threshold, clarifies, removes, creates |
| us_code_citation | text | | U.S. Code citation (e.g., "7 USC 2015(d)(1)") |
| provision_text | text | NOT NULL | Full provision text |
| plain_language_summary | text | | AI-generated plain language summary |
| affected_programs | text().array() | | Affected benefit programs |
| effective_date | timestamp | | When provision takes effect |
| extraction_confidence | real | | 0-1 AI extraction confidence |
| extracted_by | varchar | | AI model used |
| processing_status | text | NOT NULL, DEFAULT 'pending' | pending, mapped, applied |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### provision_ontology_mappings
**Purpose:** AI-proposed and human-reviewed mappings between provisions and ontology terms

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Mapping identifier |
| provision_id | varchar | FOREIGN KEY → law_provisions, NOT NULL | Source provision |
| ontology_term_id | varchar | FOREIGN KEY → ontology_terms, NOT NULL | Target ontology term |
| match_score | real | NOT NULL | 0-1 confidence score |
| match_strategy | text | NOT NULL | citation_match, semantic_similarity, ai_inference |
| status | text | NOT NULL, DEFAULT 'pending' | pending, approved, rejected |
| priority | text | NOT NULL, DEFAULT 'normal' | urgent, high, normal, low |
| reviewed_by | varchar | FOREIGN KEY → users | Reviewer user |
| reviewed_at | timestamp | | Review timestamp |
| review_notes | text | | Reviewer notes |
| rejection_reason | text | | Reason if rejected |
| processing_status | text | DEFAULT 'pending' | pending, pending_rule_verification, applied |
| verification_batch_id | varchar | | Z3 batch verification tracking |
| applied_at | timestamp | | When mapping applied to rules |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_provision_mappings_status` on (status)
- `idx_provision_mappings_priority` on (priority)
- `idx_provision_mappings_provision` on (provision_id)
- `idx_provision_mappings_term` on (ontology_term_id)

---

## Notifications & Audit

### notifications
**Purpose:** User notifications

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Notification identifier |
| user_id | varchar | FOREIGN KEY → users | Recipient |
| type | text | NOT NULL | policy_change, feedback, etc. |
| title | text | NOT NULL | Notification title |
| message | text | NOT NULL | Notification content |
| priority | text | NOT NULL, DEFAULT 'normal' | low, normal, high, urgent |
| is_read | boolean | NOT NULL, DEFAULT false | Read status |
| action_url | text | | Action link |
| metadata | jsonb | | Additional data |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `notifications_user_id_is_read_idx` ON (user_id, is_read)

### notification_preferences
**Purpose:** User notification settings

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| user_id | varchar | PRIMARY KEY, FOREIGN KEY → users | User |
| email_enabled | boolean | NOT NULL, DEFAULT true | Email notifications |
| in_app_enabled | boolean | NOT NULL, DEFAULT true | In-app notifications |
| policy_changes | boolean | NOT NULL, DEFAULT true | Policy change alerts |
| feedback_alerts | boolean | NOT NULL, DEFAULT true | Feedback notifications |
| system_alerts | boolean | NOT NULL, DEFAULT true | System notifications |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | timestamp | NOT NULL, DEFAULT NOW() | Last update |

### audit_logs
**Purpose:** System audit trail for all actions

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Log identifier |
| action | text | NOT NULL | Action performed (e.g., API_REQUEST, AUTH_LOGIN) |
| entity_type | text | | Type of affected entity (USER, RULE, DOCUMENT) |
| entity_id | varchar | | ID of affected entity |
| user_id | varchar | FOREIGN KEY → users, NULLABLE | User who performed action |
| metadata | jsonb | NOT NULL, DEFAULT {} | Additional context and details |
| ip_address | text | | IP address of request |
| user_agent | text | | User agent string |
| timestamp | timestamp | NOT NULL, DEFAULT NOW() | When action occurred |
| indexed | boolean | NOT NULL, DEFAULT false | For archival/indexing status |

**Indexes:**
- `audit_logs_timestamp_idx` ON (timestamp DESC)
- `audit_logs_user_id_idx` ON (user_id)

---

## Compliance & Quality

### compliance_rules
**Purpose:** Compliance validation rules

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Rule identifier |
| rule_type | text | NOT NULL | accessibility, language_access, etc. |
| regulation_reference | text | NOT NULL | WCAG 2.1 AA, LEP, etc. |
| validation_criteria | jsonb | NOT NULL | Validation logic |
| severity | text | NOT NULL, DEFAULT 'medium' | low, medium, high, critical |
| description | text | NOT NULL | Rule description |
| remediation_guidance | text | | How to fix |
| is_active | boolean | NOT NULL, DEFAULT true | Active status |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### compliance_violations
**Purpose:** Identified compliance issues

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Violation identifier |
| compliance_rule_id | varchar | FOREIGN KEY → compliance_rules | Rule violated |
| entity_type | text | NOT NULL | document, page, component |
| entity_id | varchar | NOT NULL | Entity identifier |
| violation_details | jsonb | NOT NULL | Violation specifics |
| gemini_analysis | jsonb | | AI analysis |
| status | text | NOT NULL, DEFAULT 'open' | open, acknowledged, resolved |
| acknowledged_by | varchar | FOREIGN KEY → users | Acknowledger |
| acknowledged_at | timestamp | | Acknowledgment time |
| resolved_by | varchar | FOREIGN KEY → users | Resolver |
| resolved_at | timestamp | | Resolution time |
| resolution_notes | text | | Resolution details |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Detection timestamp |

### policy_changes
**Purpose:** Policy document change tracking

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Change identifier |
| benefit_program_id | varchar | FOREIGN KEY → benefit_programs | Program |
| change_type | text | NOT NULL | rule_update, new_section, etc. |
| severity | text | NOT NULL, DEFAULT 'minor' | minor, moderate, significant |
| old_content | text | | Previous content |
| new_content | text | NOT NULL | Updated content |
| diff_summary | text | | Change summary |
| impact_analysis | jsonb | | Gemini impact analysis |
| effective_date | timestamp | NOT NULL | Effective from |
| detected_at | timestamp | NOT NULL, DEFAULT NOW() | Detection timestamp |
| review_status | text | NOT NULL, DEFAULT 'pending' | pending, reviewed, published |
| reviewed_by | varchar | FOREIGN KEY → users | Reviewer |
| reviewed_at | timestamp | | Review timestamp |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### policy_change_impacts
**Purpose:** Policy change impact tracking

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Impact identifier |
| policy_change_id | varchar | FOREIGN KEY → policy_changes | Parent change |
| affected_user_id | varchar | FOREIGN KEY → users | Affected user |
| impact_type | text | NOT NULL | eligibility_change, benefit_change |
| impact_description | text | NOT NULL | Impact details |
| resolution_status | text | NOT NULL, DEFAULT 'pending' | pending, acknowledged, resolved |
| acknowledged_at | timestamp | | Acknowledgment time |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

---

## Intake & Screening

### intake_sessions
**Purpose:** Conversational intake sessions

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Session identifier |
| user_id | varchar | FOREIGN KEY → users | User |
| program_code | text | NOT NULL | MD_SNAP, etc. |
| session_status | text | NOT NULL, DEFAULT 'active' | active, completed, abandoned |
| extracted_data | jsonb | DEFAULT {} | Extracted application data |
| completeness | real | DEFAULT 0 | 0-1 completeness score |
| started_at | timestamp | NOT NULL, DEFAULT NOW() | Session start |
| completed_at | timestamp | | Session completion |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### intake_messages
**Purpose:** Intake conversation messages

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Message identifier |
| session_id | varchar | FOREIGN KEY → intake_sessions | Parent session |
| role | text | NOT NULL | user, assistant |
| content | text | NOT NULL | Message text |
| extracted_data | jsonb | | Data extracted from message |
| confidence | real | | Extraction confidence |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Message timestamp |

### application_forms
**Purpose:** Generated application forms

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Form identifier |
| intake_session_id | varchar | FOREIGN KEY → intake_sessions | Source session |
| user_id | varchar | FOREIGN KEY → users | Applicant |
| program_code | text | NOT NULL | MD_SNAP, etc. |
| form_data | jsonb | NOT NULL | Complete form data |
| completeness | real | NOT NULL | 0-1 completeness |
| missing_fields | text().array() | | Incomplete fields |
| generated_at | timestamp | NOT NULL, DEFAULT NOW() | Generation timestamp |
| submitted_at | timestamp | | Submission timestamp |

### anonymous_screening_sessions
**Purpose:** Anonymous benefit screening

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Session identifier |
| session_token | text | NOT NULL, UNIQUE | Anonymous session token |
| household_data | jsonb | NOT NULL | Household input |
| calculation_results | jsonb | NOT NULL | Benefit calculations |
| claimed_by | varchar | FOREIGN KEY → users | User who claimed |
| claimed_at | timestamp | | Claim timestamp |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Screening timestamp |

---

## Public Portal

### document_requirement_templates
**Purpose:** Public document requirement checklists

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Template identifier |
| program_code | text | NOT NULL | MD_SNAP, etc. |
| requirement_category | text | NOT NULL | income, identity, residency |
| requirement_name | text | NOT NULL | Requirement name |
| description | text | NOT NULL | Requirement description |
| accepted_documents | text().array() | | Valid document types |
| is_mandatory | boolean | NOT NULL, DEFAULT true | Required vs optional |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### notice_templates
**Purpose:** Public notice letter templates

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Template identifier |
| notice_type | text | NOT NULL | approval, denial, recertification |
| program_code | text | NOT NULL | MD_SNAP, etc. |
| template_name | text | NOT NULL | Template name |
| description | text | NOT NULL | Template description |
| key_sections | text().array() | | Important sections |
| action_required | text | | Required action |
| deadline_info | text | | Deadline information |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### public_faq
**Purpose:** Public FAQ entries

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | FAQ identifier |
| program_code | text | NOT NULL | MD_SNAP, etc. |
| category | text | NOT NULL | eligibility, application, etc. |
| question | text | NOT NULL | FAQ question |
| answer | text | NOT NULL | FAQ answer |
| keywords | text().array() | | Search keywords |
| view_count | integer | DEFAULT 0 | View counter |
| helpful_count | integer | DEFAULT 0 | Helpful votes |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

---

## Scenario Modeling

### household_scenarios
**Purpose:** What-if scenario modeling

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Scenario identifier |
| user_id | varchar | FOREIGN KEY → users | Creator |
| name | text | NOT NULL | Scenario name |
| description | text | | Scenario description |
| household_data | jsonb | NOT NULL | Household configuration |
| is_baseline | boolean | DEFAULT false | Baseline scenario flag |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | timestamp | NOT NULL, DEFAULT NOW() | Last update |

### scenario_calculations
**Purpose:** PolicyEngine calculation results

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Calculation identifier |
| scenario_id | varchar | FOREIGN KEY → household_scenarios | Parent scenario |
| calculation_date | timestamp | NOT NULL, DEFAULT NOW() | Calculation timestamp |
| policy_engine_input | jsonb | NOT NULL | PE request payload |
| policy_engine_output | jsonb | NOT NULL | PE response data |
| snap_amount | integer | | SNAP benefit (cents) |
| medicaid_eligible | boolean | | Medicaid eligibility |
| eitc_amount | integer | | EITC amount (cents) |
| ctc_amount | integer | | CTC amount (cents) |
| total_benefits | integer | | Total benefit value |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### scenario_comparisons
**Purpose:** Side-by-side scenario comparison

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Comparison identifier |
| user_id | varchar | FOREIGN KEY → users | Creator |
| name | text | NOT NULL | Comparison name |
| scenario_ids | text().array() | NOT NULL | Compared scenario IDs |
| comparison_data | jsonb | | Structured comparison |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

---

## Evaluation Framework

### evaluation_test_cases
**Purpose:** Maryland-specific test cases

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Test case identifier |
| program_code | text | NOT NULL | MD_SNAP, etc. |
| test_type | text | NOT NULL | eligibility, calculation, edge |
| case_name | text | NOT NULL | Test case name |
| input_data | jsonb | NOT NULL | Test input |
| expected_output | jsonb | NOT NULL | Expected result |
| tags | text().array() | | MD tags (md_asset_limit, etc.) |
| variance_tolerance | real | DEFAULT 0.02 | 2% tolerance |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### evaluation_runs
**Purpose:** Test execution runs

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Run identifier |
| test_suite_name | text | NOT NULL | Suite name |
| program_code | text | NOT NULL | MD_SNAP, etc. |
| total_cases | integer | NOT NULL | Total test cases |
| passed_cases | integer | NOT NULL | Passed count |
| failed_cases | integer | NOT NULL | Failed count |
| pass_at_1_score | real | NOT NULL | Pass@1 percentage |
| run_metadata | jsonb | | Run configuration |
| started_at | timestamp | NOT NULL | Run start |
| completed_at | timestamp | | Run completion |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

### evaluation_results
**Purpose:** Individual test results

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | varchar | PRIMARY KEY | Result identifier |
| run_id | varchar | FOREIGN KEY → evaluation_runs | Parent run |
| test_case_id | varchar | FOREIGN KEY → evaluation_test_cases | Test case |
| passed | boolean | NOT NULL | Pass/fail status |
| actual_output | jsonb | NOT NULL | Actual result |
| variance_percentage | real | | Variance % |
| execution_time_ms | integer | | Execution time |
| error_message | text | | Error details |
| created_at | timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |

---

## Indexes & Performance

### Critical Indexes

```sql
-- Document Management
CREATE INDEX documents_benefit_program_idx ON documents(benefit_program_id);
CREATE INDEX documents_status_idx ON documents(status);
CREATE INDEX documents_section_number_idx ON documents(section_number);
CREATE INDEX chunks_document_id_idx ON document_chunks(document_id);

-- Search & RAG
CREATE INDEX search_queries_user_id_idx ON search_queries(user_id);
CREATE INDEX search_queries_benefit_program_idx ON search_queries(benefit_program_id);

-- Navigator Workspace
CREATE INDEX client_cases_navigator_idx ON client_cases(navigator_id);
CREATE INDEX client_cases_applicant_idx ON client_cases(applicant_id);
CREATE INDEX client_verification_documents_session_id_idx ON client_verification_documents(session_id);
CREATE INDEX client_verification_documents_status_idx ON client_verification_documents(verification_status);

-- Notifications
CREATE INDEX notifications_user_id_is_read_idx ON notifications(user_id, is_read);

-- Audit
CREATE INDEX audit_logs_timestamp_idx ON audit_logs(timestamp DESC);
CREATE INDEX audit_logs_user_id_idx ON audit_logs(user_id);

-- Vector Search (requires pgvector extension)
CREATE INDEX document_chunks_embedding_idx ON document_chunks 
  USING ivfflat(embedding) WITH (lists = 100);
```

### Query Optimization

**Common Query Patterns:**

```sql
-- Get user's unread notifications (uses composite index)
SELECT * FROM notifications 
WHERE user_id = $1 AND is_read = false
ORDER BY created_at DESC;

-- Get case documents with Gemini analysis (uses FK index)
SELECT d.*, s.session_type, c.client_name
FROM client_verification_documents d
JOIN client_interaction_sessions s ON d.session_id = s.id
JOIN client_cases c ON s.client_case_id = c.id
WHERE d.verification_status = 'pending'
ORDER BY d.created_at ASC;

-- RAG semantic search (uses vector index)
SELECT c.*, d.filename, d.section_number
FROM document_chunks c
JOIN documents d ON c.document_id = d.id
WHERE d.benefit_program_id = $1
  AND c.embeddings <=> $2 < 0.5
ORDER BY c.embeddings <=> $2
LIMIT 10;
```

---

## Migration Guide

### Using Drizzle ORM

**Generate Migration:**
```bash
npm run db:generate
```

**Push Schema Changes:**
```bash
npm run db:push
```

**Force Push (data loss warning):**
```bash
npm run db:push --force
```

### Migration Best Practices

1. **Never manually write SQL migrations**
   - Always use Drizzle schema-first approach
   - Modify `shared/schema.ts`
   - Run `npm run db:push`

2. **Testing Migrations**
   ```typescript
   // Test in development first
   NODE_ENV=development npm run db:push
   
   // Verify with schema inspection
   npm run db:studio
   ```

3. **Production Migrations**
   ```bash
   # Backup database first
   pg_dump $DATABASE_URL > backup.sql
   
   # Run migration
   npm run db:push
   
   # Verify
   npm run db:check
   ```

4. **Rollback Strategy**
   - Use Neon database branching
   - Create branch before migration
   - Restore from branch if needed

### Adding New Tables

```typescript
// 1. Define table in shared/schema.ts
export const newTable = pgTable("new_table", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull()
})

// 2. Add to storage interface (server/storage.ts)
interface IStorage {
  getNewTableRecords(): Promise<NewTable[]>
  createNewTableRecord(data: InsertNewTable): Promise<NewTable>
}

// 3. Run migration
npm run db:push
```

---

## Data Integrity

### Constraints

**Foreign Key Cascades:**
```sql
-- Chunks deleted when document deleted
document_chunks.document_id → documents.id (ON DELETE CASCADE)

-- Versions deleted when document deleted
document_versions.document_id → documents.id (ON DELETE CASCADE)

-- Search results deleted when query deleted
search_results.query_id → search_queries.id (ON DELETE CASCADE)
```

**Unique Constraints:**
- `users.username` - Unique login names
- `benefit_programs.code` - Unique program codes
- `client_cases.client_identifier` - Unique case numbers
- `anonymous_screening_sessions.session_token` - Unique tokens

**Check Constraints:**
```sql
-- Completeness between 0 and 1
CHECK (completeness >= 0 AND completeness <= 1)

-- Confidence between 0 and 1
CHECK (confidence >= 0 AND confidence <= 1)

-- Valid status values
CHECK (status IN ('pending', 'approved', 'rejected'))
```

### Data Validation

**Application-Level Validation (Zod):**
```typescript
import { createInsertSchema } from 'drizzle-zod'

const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})

// Validate before insert
const validatedData = insertUserSchema.parse(requestBody)
```

**Database-Level Validation:**
- NOT NULL constraints on required fields
- DEFAULT values for optional fields
- UNIQUE constraints for identifiers
- FOREIGN KEY constraints for relationships

---

## Backup & Recovery

### Automated Backups (Neon)

Neon PostgreSQL provides:
- **Point-in-time recovery** (PITR)
- **Automated daily backups**
- **7-day retention** (free tier)
- **30-day retention** (paid tier)

### Manual Backup

```bash
# Dump full database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup_20251011.sql

# Dump specific tables
pg_dump $DATABASE_URL \
  -t users -t documents -t document_chunks \
  > critical_tables.sql
```

### Data Export for DHS Integration

```sql
-- Export E&E data
COPY (
  SELECT 
    c.client_identifier,
    c.client_name,
    c.household_size,
    s.session_date,
    d.requirement_type,
    d.verification_status
  FROM client_cases c
  JOIN client_interaction_sessions s ON c.id = s.client_case_id
  JOIN client_verification_documents d ON s.id = d.session_id
  WHERE s.created_at >= '2025-10-01'
) TO '/tmp/ee_export.csv' WITH CSV HEADER;
```

---

## Performance Monitoring

### Query Performance

```sql
-- Enable query logging
ALTER DATABASE benefits_navigator SET log_min_duration_statement = 1000;

-- Find slow queries
SELECT 
  query,
  calls,
  total_time / calls AS avg_time,
  min_time,
  max_time
FROM pg_stat_statements
WHERE calls > 100
ORDER BY total_time DESC
LIMIT 20;

-- Index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey';
```

### Connection Pooling

```typescript
// Drizzle + Neon with pooling
import { drizzle } from 'drizzle-orm/neon-http'
import { neon, neonConfig } from '@neondatabase/serverless'

neonConfig.fetchConnectionCache = true

const sql = neon(process.env.DATABASE_URL)
export const db = drizzle(sql)
```

---

*This database documentation is maintained by the Maryland DHS Technology Team. Last updated: October 2025*
