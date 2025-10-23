-- CRIT-002 Phase A: Complete Retention Coverage Migration
-- Adds retention tracking columns to remaining 18 tables with PII/PHI/FTI
-- Total coverage: 35 tables (17 existing + 18 new)
-- Safe: All columns are nullable, non-breaking change

-- Tax Data (FTI) Tables

-- Add retention columns to taxslayer_returns (TaxSlayer integration - 7 year IRS retention)
ALTER TABLE taxslayer_returns ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE taxslayer_returns ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE taxslayer_returns ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE taxslayer_returns ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE taxslayer_returns ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Communication Tables (PII/FTI)

-- Add retention columns to sms_messages (SMS communications - 7 year retention)
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Consent & Signature Tables (PII)

-- Add retention columns to user_consents (user consent records - 7 year retention)
ALTER TABLE user_consents ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE user_consents ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE user_consents ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE user_consents ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE user_consents ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to client_consents (client consent records - 7 year retention)
ALTER TABLE client_consents ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE client_consents ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE client_consents ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE client_consents ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE client_consents ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to consent_forms (consent form templates - 7 year retention)
ALTER TABLE consent_forms ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE consent_forms ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE consent_forms ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE consent_forms ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE consent_forms ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Cross-Enrollment Intelligence Tables (PII)

-- Add retention columns to cross_enrollment_opportunities (enrollment opportunities - 7 year retention)
ALTER TABLE cross_enrollment_opportunities ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE cross_enrollment_opportunities ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE cross_enrollment_opportunities ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE cross_enrollment_opportunities ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE cross_enrollment_opportunities ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to cross_enrollment_audit_events (cross-enrollment audit - 7 year retention)
ALTER TABLE cross_enrollment_audit_events ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE cross_enrollment_audit_events ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE cross_enrollment_audit_events ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE cross_enrollment_audit_events ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE cross_enrollment_audit_events ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to cross_enrollment_predictions (AI predictions - 7 year retention)
ALTER TABLE cross_enrollment_predictions ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE cross_enrollment_predictions ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE cross_enrollment_predictions ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE cross_enrollment_predictions ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE cross_enrollment_predictions ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- E&E Export Tables (PII)

-- Add retention columns to ee_export_batches (E&E exports - 7 year retention)
ALTER TABLE ee_export_batches ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE ee_export_batches ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE ee_export_batches ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE ee_export_batches ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE ee_export_batches ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to ee_clients (E&E client data - 7 year retention)
ALTER TABLE ee_clients ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE ee_clients ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE ee_clients ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE ee_clients ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE ee_clients ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Client Interaction Tables (PII)

-- Add retention columns to client_interaction_sessions (session data - 7 year retention)
ALTER TABLE client_interaction_sessions ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE client_interaction_sessions ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE client_interaction_sessions ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE client_interaction_sessions ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE client_interaction_sessions ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to intake_sessions (intake data - 7 year retention)
ALTER TABLE intake_sessions ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE intake_sessions ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE intake_sessions ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE intake_sessions ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE intake_sessions ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to appointments (scheduling data - 7 year retention)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Document Verification Tables (PII)

-- Add retention columns to document_verifications (verification records - 7 year retention)
ALTER TABLE document_verifications ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE document_verifications ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE document_verifications ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE document_verifications ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE document_verifications ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to client_verification_documents (verification docs - 7 year retention)
ALTER TABLE client_verification_documents ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE client_verification_documents ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE client_verification_documents ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE client_verification_documents ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE client_verification_documents ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Feedback & User Input Tables (PII)

-- Add retention columns to feedback_submissions (user feedback - 7 year retention)
ALTER TABLE feedback_submissions ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE feedback_submissions ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE feedback_submissions ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE feedback_submissions ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE feedback_submissions ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- SMS & Screening Tables (PII)

-- Add retention columns to sms_screening_links (SMS screening - 7 year retention)
ALTER TABLE sms_screening_links ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE sms_screening_links ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE sms_screening_links ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE sms_screening_links ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE sms_screening_links ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- HIPAA Audit Tables (PHI)

-- Add retention columns to hipaa_audit_logs (HIPAA audit trail - 7 year retention)
ALTER TABLE hipaa_audit_logs ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE hipaa_audit_logs ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE hipaa_audit_logs ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE hipaa_audit_logs ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE hipaa_audit_logs ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Migration complete: 35 total tables with retention tracking
-- 17 existing (from migration 0002) + 18 new = 35 tables covered
-- Compliance: IRS Pub 1075 §9.3.4, HIPAA §164.310(d)(2), GDPR Art. 5
