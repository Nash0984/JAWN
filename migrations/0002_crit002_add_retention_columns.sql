-- CRIT-002 Data Retention Compliance Migration
-- Adds retention tracking columns to critical tables for IRS 7-year retention, HIPAA 7-year retention, and GDPR storage limitation
-- Safe: All columns are nullable, non-breaking change

-- Add retention columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to household_profiles (benefit data - 7 year retention)
ALTER TABLE household_profiles ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE household_profiles ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE household_profiles ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE household_profiles ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE household_profiles ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to federal_tax_returns (IRS 7-year retention required)
ALTER TABLE federal_tax_returns ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE federal_tax_returns ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE federal_tax_returns ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE federal_tax_returns ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE federal_tax_returns ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to maryland_tax_returns (state tax - 7 year retention)
ALTER TABLE maryland_tax_returns ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE maryland_tax_returns ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE maryland_tax_returns ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE maryland_tax_returns ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE maryland_tax_returns ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to tax_documents (tax document - 7 year retention)
ALTER TABLE tax_documents ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE tax_documents ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE tax_documents ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE tax_documents ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE tax_documents ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to vita_intake_sessions (tax intake - 7 year retention)
ALTER TABLE vita_intake_sessions ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE vita_intake_sessions ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE vita_intake_sessions ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE vita_intake_sessions ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE vita_intake_sessions ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to client_cases (benefit cases - 7 year retention)
ALTER TABLE client_cases ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE client_cases ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE client_cases ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE client_cases ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE client_cases ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to documents (user-uploaded documents - 7 year retention)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to audit_logs (audit trail - 7 year retention)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to security_events (security audit - 7 year retention)
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to gdpr_consents (consent records - 7 year retention)
ALTER TABLE gdpr_consents ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE gdpr_consents ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE gdpr_consents ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE gdpr_consents ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE gdpr_consents ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to gdpr_data_subject_requests (GDPR requests - 7 year retention)
ALTER TABLE gdpr_data_subject_requests ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE gdpr_data_subject_requests ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE gdpr_data_subject_requests ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE gdpr_data_subject_requests ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE gdpr_data_subject_requests ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to gdpr_breach_incidents (breach records - 7 year retention)
ALTER TABLE gdpr_breach_incidents ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE gdpr_breach_incidents ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE gdpr_breach_incidents ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE gdpr_breach_incidents ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE gdpr_breach_incidents ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to hipaa_phi_access_logs (PHI access logs - 7 year HIPAA retention)
ALTER TABLE hipaa_phi_access_logs ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE hipaa_phi_access_logs ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE hipaa_phi_access_logs ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE hipaa_phi_access_logs ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE hipaa_phi_access_logs ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to hipaa_business_associate_agreements (BAA - 7 year HIPAA retention)
ALTER TABLE hipaa_business_associate_agreements ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE hipaa_business_associate_agreements ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE hipaa_business_associate_agreements ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE hipaa_business_associate_agreements ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE hipaa_business_associate_agreements ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to hipaa_risk_assessments (risk assessments - 7 year HIPAA retention)
ALTER TABLE hipaa_risk_assessments ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE hipaa_risk_assessments ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE hipaa_risk_assessments ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE hipaa_risk_assessments ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE hipaa_risk_assessments ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Add retention columns to hipaa_security_incidents (security incidents - 7 year HIPAA retention)
ALTER TABLE hipaa_security_incidents ADD COLUMN IF NOT EXISTS retention_category text;
ALTER TABLE hipaa_security_incidents ADD COLUMN IF NOT EXISTS retention_until timestamp;
ALTER TABLE hipaa_security_incidents ADD COLUMN IF NOT EXISTS scheduled_for_deletion boolean DEFAULT false NOT NULL;
ALTER TABLE hipaa_security_incidents ADD COLUMN IF NOT EXISTS deletion_approved_by varchar;
ALTER TABLE hipaa_security_incidents ADD COLUMN IF NOT EXISTS deletion_approved_at timestamp;

-- Create data_disposal_logs table for immutable audit trail
CREATE TABLE IF NOT EXISTS data_disposal_logs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id varchar NOT NULL,
  deletion_reason text NOT NULL,
  deleted_by varchar NOT NULL REFERENCES users(id),
  deletion_method text NOT NULL,
  record_snapshot jsonb,
  legal_hold_status text,
  approval_chain jsonb,
  deleted_at timestamp DEFAULT now() NOT NULL,
  audit_trail jsonb
);

CREATE INDEX IF NOT EXISTS data_disposal_logs_table_name_idx ON data_disposal_logs(table_name);
CREATE INDEX IF NOT EXISTS data_disposal_logs_record_id_idx ON data_disposal_logs(record_id);
CREATE INDEX IF NOT EXISTS data_disposal_logs_deleted_at_idx ON data_disposal_logs(deleted_at);
