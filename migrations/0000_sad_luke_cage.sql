CREATE TABLE "abawd_exemption_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_case_id" varchar,
	"client_name" text NOT NULL,
	"client_identifier" text,
	"exemption_type" text NOT NULL,
	"exemption_status" text DEFAULT 'pending' NOT NULL,
	"verification_method" text,
	"supporting_documents" jsonb,
	"verification_notes" text,
	"exemption_start_date" timestamp,
	"exemption_end_date" timestamp,
	"verification_date" timestamp,
	"next_review_date" timestamp,
	"verified_by" varchar,
	"reviewed_by" varchar,
	"policy_reference" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"tier" text DEFAULT 'bronze' NOT NULL,
	"icon_name" text,
	"icon_color" text,
	"badge_url" text,
	"criteria_type" text NOT NULL,
	"criteria_config" jsonb NOT NULL,
	"points_awarded" integer DEFAULT 0,
	"is_visible" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "anonymous_screening_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar,
	"claimed_at" timestamp,
	"household_data" jsonb NOT NULL,
	"benefit_results" jsonb NOT NULL,
	"total_monthly_benefits" real DEFAULT 0,
	"total_yearly_benefits" real DEFAULT 0,
	"eligible_program_count" integer DEFAULT 0,
	"state_code" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "anonymous_screening_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "application_forms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar,
	"benefit_program_id" varchar,
	"applicant_info" jsonb NOT NULL,
	"household_members" jsonb NOT NULL,
	"household_size" integer NOT NULL,
	"income_info" jsonb NOT NULL,
	"total_monthly_income" real,
	"expense_info" jsonb,
	"total_monthly_expenses" real,
	"asset_info" jsonb,
	"categorical_eligibility" boolean DEFAULT false,
	"expedited_service" boolean DEFAULT false,
	"special_circumstances" jsonb,
	"eligibility_result" jsonb,
	"estimated_benefit" real,
	"ee_export_data" jsonb,
	"export_status" text DEFAULT 'draft',
	"exported_at" timestamp,
	"verification_status" text DEFAULT 'pending',
	"required_documents" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"username" text,
	"user_role" text,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" varchar,
	"details" jsonb,
	"changes_before" jsonb,
	"changes_after" jsonb,
	"ip_address" text,
	"user_agent" text,
	"session_id" text,
	"request_id" text,
	"sensitive_data_accessed" boolean DEFAULT false,
	"pii_fields" text[],
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"county_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benefit_programs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"program_type" text DEFAULT 'benefit' NOT NULL,
	"has_rules_engine" boolean DEFAULT false NOT NULL,
	"has_policy_engine_validation" boolean DEFAULT false NOT NULL,
	"has_conversational_ai" boolean DEFAULT true NOT NULL,
	"primary_source_url" text,
	"source_type" text,
	"scraping_config" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "benefit_programs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "case_activity_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"navigator_id" varchar NOT NULL,
	"case_id" varchar,
	"county_id" varchar,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"benefit_amount" real,
	"response_time" real,
	"document_quality" real,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorical_eligibility_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benefit_program_id" varchar NOT NULL,
	"manual_section_id" varchar,
	"rule_name" text NOT NULL,
	"rule_code" text NOT NULL,
	"description" text,
	"bypass_gross_income_test" boolean DEFAULT false NOT NULL,
	"bypass_asset_test" boolean DEFAULT false NOT NULL,
	"bypass_net_income_test" boolean DEFAULT false NOT NULL,
	"conditions" jsonb,
	"effective_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categorical_eligibility_rules_rule_code_unique" UNIQUE("rule_code")
);
--> statement-breakpoint
CREATE TABLE "client_cases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_name" text NOT NULL,
	"client_identifier" text,
	"benefit_program_id" varchar NOT NULL,
	"assigned_navigator" varchar,
	"status" text DEFAULT 'screening' NOT NULL,
	"household_size" integer,
	"estimated_income" integer,
	"eligibility_calculation_id" varchar,
	"application_submitted_at" timestamp,
	"application_approved_at" timestamp,
	"notes" text,
	"tags" jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_consents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_case_id" varchar NOT NULL,
	"consent_form_id" varchar NOT NULL,
	"session_id" varchar,
	"consent_given" boolean NOT NULL,
	"consent_date" timestamp DEFAULT now() NOT NULL,
	"signature_data" text,
	"signature_method" text,
	"witnessed_by" varchar,
	"ip_address" text,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_interaction_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_case_id" varchar,
	"navigator_id" varchar NOT NULL,
	"session_type" text NOT NULL,
	"interaction_date" timestamp DEFAULT now() NOT NULL,
	"duration_minutes" integer,
	"location" text,
	"topics_discussed" jsonb,
	"documents_received" jsonb,
	"documents_verified" jsonb,
	"action_items" jsonb,
	"notes" text,
	"outcome_status" text,
	"pathway_stage" text,
	"previous_pathway_stage" text,
	"pathway_transitioned_at" timestamp,
	"pathway_notes" text,
	"exported_to_ee" boolean DEFAULT false NOT NULL,
	"exported_at" timestamp,
	"export_batch_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_verification_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"client_case_id" varchar NOT NULL,
	"document_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"vision_analysis_status" text DEFAULT 'pending' NOT NULL,
	"vision_analysis_error" text,
	"extracted_data" jsonb,
	"raw_vision_response" jsonb,
	"confidence_score" real,
	"verification_status" text DEFAULT 'pending_review' NOT NULL,
	"validation_warnings" jsonb,
	"validation_errors" jsonb,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"manually_edited_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"rule_type" text NOT NULL,
	"category" text NOT NULL,
	"benefit_program_id" varchar,
	"source_regulation" text,
	"source_section" text,
	"source_url" text,
	"validation_prompt" text NOT NULL,
	"validation_criteria" jsonb,
	"severity_level" text DEFAULT 'medium' NOT NULL,
	"related_rule_ids" text[],
	"affected_sections" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"requires_manual_review" boolean DEFAULT false NOT NULL,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_rules_rule_code_unique" UNIQUE("rule_code")
);
--> statement-breakpoint
CREATE TABLE "compliance_violations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compliance_rule_id" varchar NOT NULL,
	"violation_type" text NOT NULL,
	"severity" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar,
	"violation_context" jsonb NOT NULL,
	"detected_value" text,
	"expected_value" text,
	"ai_analysis" text,
	"confidence_score" real,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"detected_by" varchar,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_by" varchar,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_forms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_name" text NOT NULL,
	"form_code" text NOT NULL,
	"form_title" text NOT NULL,
	"form_content" text NOT NULL,
	"purpose" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"requires_signature" boolean DEFAULT true NOT NULL,
	"expiration_days" integer,
	"benefit_program_id" varchar,
	"created_by" varchar NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"effective_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "consent_forms_form_code_unique" UNIQUE("form_code")
);
--> statement-breakpoint
CREATE TABLE "counties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"county_type" text DEFAULT 'ldss' NOT NULL,
	"branding_config" jsonb,
	"contact_info" jsonb,
	"welcome_message" text,
	"region" text,
	"population" integer,
	"coverage" text[],
	"enabled_programs" text[],
	"custom_policies" jsonb,
	"features" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_pilot" boolean DEFAULT false NOT NULL,
	"launch_date" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "counties_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "county_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"county_id" varchar NOT NULL,
	"period_type" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_cases" integer DEFAULT 0,
	"cases_opened" integer DEFAULT 0,
	"cases_closed" integer DEFAULT 0,
	"cases_approved" integer DEFAULT 0,
	"cases_denied" integer DEFAULT 0,
	"total_benefits_secured" real DEFAULT 0,
	"avg_benefit_per_case" real DEFAULT 0,
	"avg_response_time" real DEFAULT 0,
	"avg_case_completion_time" real DEFAULT 0,
	"success_rate" real DEFAULT 0,
	"active_navigators" integer DEFAULT 0,
	"active_caseworkers" integer DEFAULT 0,
	"avg_cases_per_navigator" real DEFAULT 0,
	"documents_processed" integer DEFAULT 0,
	"avg_document_quality" real DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "county_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"county_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"access_level" text DEFAULT 'full',
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" varchar,
	"deactivated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cross_enrollment_audit_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"event_category" text NOT NULL,
	"dataset_id" varchar,
	"opportunity_id" varchar,
	"action_taken" text NOT NULL,
	"action_result" text,
	"metadata" jsonb,
	"user_id" varchar NOT NULL,
	"user_role" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cross_enrollment_opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ee_client_id" varchar,
	"client_case_id" varchar,
	"current_program_id" varchar NOT NULL,
	"target_program_id" varchar NOT NULL,
	"eligibility_score" real,
	"eligibility_reason" text,
	"policy_engine_result" jsonb,
	"estimated_benefit_amount" integer,
	"priority" text DEFAULT 'medium',
	"potential_impact" text,
	"outreach_status" text DEFAULT 'identified',
	"contact_attempts" integer DEFAULT 0,
	"last_contacted_at" timestamp,
	"contacted_by" varchar,
	"outcome_status" text,
	"outcome_notes" text,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"identified_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embeddings" text,
	"vector_id" text,
	"metadata" jsonb,
	"page_number" integer,
	"start_offset" integer,
	"end_offset" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_requirement_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benefit_program_id" varchar NOT NULL,
	"manual_section_id" varchar,
	"requirement_name" text NOT NULL,
	"document_type" text NOT NULL,
	"required_when" jsonb NOT NULL,
	"acceptable_documents" jsonb NOT NULL,
	"validity_period" integer,
	"is_required" boolean DEFAULT true NOT NULL,
	"can_be_waived" boolean DEFAULT false NOT NULL,
	"waiver_conditions" jsonb,
	"effective_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_requirement_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" text NOT NULL,
	"dhs_category" text NOT NULL,
	"plain_language_title" text NOT NULL,
	"explanation" text NOT NULL,
	"examples" text[] NOT NULL,
	"where_to_get" text,
	"common_mistakes" text[],
	"keywords" text[],
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "document_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "document_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"client_case_id" varchar,
	"session_id" varchar,
	"requirement_type" text NOT NULL,
	"verification_status" text NOT NULL,
	"is_valid" boolean NOT NULL,
	"confidence_score" real,
	"satisfies_requirements" jsonb,
	"rejection_reasons" jsonb,
	"warnings" jsonb,
	"extracted_data" jsonb,
	"analysis_result" jsonb,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp,
	"verified_by" varchar,
	"verified_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"document_hash" text NOT NULL,
	"source_url" text NOT NULL,
	"downloaded_at" timestamp NOT NULL,
	"last_modified_at" timestamp,
	"file_size" integer,
	"http_headers" jsonb,
	"changes_summary" text,
	"audit_trail" jsonb,
	"object_path" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"object_path" text,
	"document_type_id" varchar,
	"benefit_program_id" varchar,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by" varchar,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"processing_status" jsonb,
	"quality_score" real,
	"ocr_accuracy" real,
	"metadata" jsonb,
	"source_url" text,
	"downloaded_at" timestamp,
	"document_hash" text,
	"is_golden_source" boolean DEFAULT false NOT NULL,
	"section_number" text,
	"last_modified_at" timestamp,
	"audit_trail" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ee_clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" varchar NOT NULL,
	"client_name" text NOT NULL,
	"ssn_last_4" text NOT NULL,
	"date_of_birth" timestamp,
	"client_name_hash" text,
	"client_identifier_hash" text,
	"enrolled_program_id" varchar,
	"enrollment_status" text,
	"case_number" text,
	"household_size" integer,
	"household_income" integer,
	"household_assets" integer,
	"household_composition" jsonb,
	"match_status" text DEFAULT 'pending',
	"matched_client_case_id" varchar,
	"match_confidence_score" real,
	"match_method" text,
	"raw_data_row" jsonb,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ee_dataset_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"object_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"file_hash" text,
	"uploaded_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ee_datasets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"data_source" text NOT NULL,
	"report_period_start" timestamp,
	"report_period_end" timestamp,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"total_records" integer DEFAULT 0,
	"valid_records" integer DEFAULT 0,
	"invalid_records" integer DEFAULT 0,
	"duplicate_records" integer DEFAULT 0,
	"processing_status" text DEFAULT 'pending',
	"processing_error" text,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"retention_policy_days" integer DEFAULT 90,
	"purge_scheduled_at" timestamp,
	"uploaded_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ee_export_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"export_type" text NOT NULL,
	"session_count" integer NOT NULL,
	"export_format" text NOT NULL,
	"file_path" text,
	"file_size" integer,
	"exported_by" varchar NOT NULL,
	"exported_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_to_ee" boolean DEFAULT false NOT NULL,
	"uploaded_at" timestamp,
	"upload_confirmation" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "eligibility_calculations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"benefit_program_id" varchar NOT NULL,
	"household_size" integer NOT NULL,
	"gross_monthly_income" integer NOT NULL,
	"net_monthly_income" integer NOT NULL,
	"deductions" jsonb NOT NULL,
	"categorical_eligibility" text,
	"is_eligible" boolean NOT NULL,
	"monthly_benefit" integer,
	"ineligibility_reasons" jsonb,
	"rules_snapshot" jsonb NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"calculated_by" varchar,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "evaluation_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" varchar NOT NULL,
	"test_case_id" varchar NOT NULL,
	"passed" boolean NOT NULL,
	"actual_result" jsonb,
	"variance" real,
	"execution_time_ms" integer,
	"error_message" text,
	"ai_response" text,
	"citations" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_name" varchar(255) NOT NULL,
	"program" varchar(50),
	"total_cases" integer NOT NULL,
	"passed_cases" integer DEFAULT 0 NOT NULL,
	"failed_cases" integer DEFAULT 0 NOT NULL,
	"pass_rate" real,
	"average_variance" real,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"run_by" varchar,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "evaluation_test_cases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program" varchar(50) NOT NULL,
	"category" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"input_data" jsonb NOT NULL,
	"expected_result" jsonb NOT NULL,
	"tolerance" real DEFAULT 2,
	"tags" text[],
	"source" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manual_section_id" varchar NOT NULL,
	"section_number" text NOT NULL,
	"section_title" text NOT NULL,
	"extraction_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rules_extracted" integer DEFAULT 0 NOT NULL,
	"extracted_rules" jsonb,
	"error_message" text,
	"extracted_by" varchar,
	"reviewed_by" varchar,
	"approved_by" varchar,
	"started_at" timestamp,
	"completed_at" timestamp,
	"reviewed_at" timestamp,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "federal_bills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_number" text NOT NULL,
	"congress" integer NOT NULL,
	"bill_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"full_text" text,
	"introduced_date" timestamp,
	"latest_action_date" timestamp,
	"latest_action_text" text,
	"status" text DEFAULT 'introduced' NOT NULL,
	"sponsors" jsonb,
	"cosponsors" jsonb,
	"committees" jsonb,
	"related_programs" text[],
	"policy_changes" jsonb,
	"source_url" text,
	"govinfo_package_id" text,
	"bill_status_xml" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "federal_tax_returns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" varchar,
	"preparer_id" varchar NOT NULL,
	"tax_year" integer NOT NULL,
	"filing_status" text NOT NULL,
	"form_1040_data" jsonb NOT NULL,
	"schedules" jsonb,
	"w2_forms" jsonb[],
	"form_1099s" jsonb[],
	"adjusted_gross_income" real DEFAULT 0,
	"taxable_income" real DEFAULT 0,
	"total_tax" real DEFAULT 0,
	"total_credits" real DEFAULT 0,
	"eitc_amount" real DEFAULT 0,
	"child_tax_credit" real DEFAULT 0,
	"additional_child_tax_credit" real DEFAULT 0,
	"refund_amount" real DEFAULT 0,
	"efile_status" text DEFAULT 'draft',
	"efile_transmission_id" text,
	"efile_submitted_at" timestamp,
	"efile_accepted_at" timestamp,
	"efile_rejection_reason" text,
	"validation_errors" jsonb,
	"quality_review" jsonb,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"vita_due_diligence" jsonb,
	"vita_cert_level" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"submitter_name" text,
	"submitter_email" text,
	"feedback_type" text NOT NULL,
	"category" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"related_entity_type" text,
	"related_entity_id" varchar,
	"page_url" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"expected_behavior" text,
	"actual_behavior" text,
	"screenshot_url" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"priority" text,
	"assigned_to" varchar,
	"admin_notes" text,
	"resolution" text,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"profile_mode" text NOT NULL,
	"household_size" integer NOT NULL,
	"state_code" text DEFAULT 'MD' NOT NULL,
	"county" text,
	"employment_income" real DEFAULT 0,
	"unearned_income" real DEFAULT 0,
	"self_employment_income" real DEFAULT 0,
	"household_assets" real DEFAULT 0,
	"rent_or_mortgage" real DEFAULT 0,
	"utility_costs" real DEFAULT 0,
	"medical_expenses" real DEFAULT 0,
	"childcare_expenses" real DEFAULT 0,
	"elderly_or_disabled" boolean DEFAULT false,
	"filing_status" text,
	"taxpayer_first_name" text,
	"taxpayer_last_name" text,
	"taxpayer_ssn" text,
	"taxpayer_date_of_birth" date,
	"taxpayer_blind" boolean DEFAULT false,
	"taxpayer_disabled" boolean DEFAULT false,
	"spouse_first_name" text,
	"spouse_last_name" text,
	"spouse_ssn" text,
	"spouse_date_of_birth" date,
	"spouse_blind" boolean DEFAULT false,
	"spouse_disabled" boolean DEFAULT false,
	"street_address" text,
	"apt_number" text,
	"city" text,
	"zip_code" text,
	"dependents" jsonb DEFAULT '[]'::jsonb,
	"wage_withholding" real DEFAULT 0,
	"estimated_tax_payments" real DEFAULT 0,
	"client_case_id" varchar,
	"client_identifier" text,
	"notes" text,
	"tags" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_scenarios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"household_data" jsonb NOT NULL,
	"state_code" text DEFAULT 'MD' NOT NULL,
	"tags" text[],
	"client_identifier" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"model" text,
	"extracted_fields" jsonb,
	"confidence_scores" jsonb,
	"suggested_questions" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_type" text DEFAULT 'snap_application' NOT NULL,
	"benefit_program_id" varchar,
	"status" text DEFAULT 'active' NOT NULL,
	"current_step" text,
	"progress" integer DEFAULT 0,
	"message_count" integer DEFAULT 0,
	"last_message_at" timestamp,
	"extracted_data" jsonb,
	"data_completeness" real DEFAULT 0,
	"missing_fields" text[],
	"exported_to_ee" boolean DEFAULT false,
	"exported_at" timestamp,
	"ee_application_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leaderboard_type" text NOT NULL,
	"scope" text NOT NULL,
	"county_id" varchar,
	"period_type" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"rankings" jsonb NOT NULL,
	"total_participants" integer DEFAULT 0,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legislative_impacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" varchar NOT NULL,
	"baseline_scenario_id" varchar,
	"bill_type" text,
	"bill_id" varchar,
	"affected_program" text NOT NULL,
	"impact_type" text NOT NULL,
	"policy_engine_input_baseline" jsonb,
	"policy_engine_input_proposed" jsonb,
	"policy_engine_output_baseline" jsonb,
	"policy_engine_output_proposed" jsonb,
	"enrollment_impact" jsonb,
	"budget_impact" jsonb,
	"demographic_impact" jsonb,
	"confidence" text DEFAULT 'medium' NOT NULL,
	"analysis_method" text NOT NULL,
	"calculated_by" varchar,
	"calculated_at" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_number" text NOT NULL,
	"section_title" text NOT NULL,
	"category" text NOT NULL,
	"parent_section" text,
	"sort_order" integer NOT NULL,
	"document_id" varchar,
	"source_url" text,
	"file_type" text,
	"file_size" integer,
	"last_modified" timestamp,
	"effective_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"has_content" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "manual_sections_section_number_unique" UNIQUE("section_number")
);
--> statement-breakpoint
CREATE TABLE "maryland_bills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_number" text NOT NULL,
	"session" text NOT NULL,
	"bill_type" text NOT NULL,
	"title" text NOT NULL,
	"synopsis" text,
	"fiscal_note" text,
	"full_text_url" text,
	"pdf_url" text,
	"introduced_date" timestamp,
	"first_reading_date" timestamp,
	"cross_filed_with" text,
	"status" text DEFAULT 'prefiled' NOT NULL,
	"sponsors" jsonb,
	"committees" jsonb,
	"related_programs" text[],
	"policy_changes" jsonb,
	"source_url" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maryland_state_option_status" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_option_id" varchar NOT NULL,
	"is_participating" boolean NOT NULL,
	"adoption_date" timestamp,
	"expiration_date" timestamp,
	"waiver_type" text,
	"affected_counties" text[],
	"policy_reference" text,
	"notes" text,
	"data_source" text NOT NULL,
	"extracted_by" varchar,
	"last_verified_at" timestamp,
	"last_verified_by" varchar,
	"override_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maryland_tax_returns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federal_return_id" varchar NOT NULL,
	"form_502_data" jsonb NOT NULL,
	"maryland_agi" real DEFAULT 0,
	"maryland_taxable_income" real DEFAULT 0,
	"maryland_tax" real DEFAULT 0,
	"county_code" text NOT NULL,
	"county_tax" real DEFAULT 0,
	"local_tax_rate" real,
	"maryland_eitc" real DEFAULT 0,
	"child_tax_credit_md" real DEFAULT 0,
	"state_refund" real DEFAULT 0,
	"efile_status" text DEFAULT 'draft',
	"efile_transmission_id" text,
	"efile_submitted_at" timestamp,
	"efile_accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"model_type" text NOT NULL,
	"status" text NOT NULL,
	"config" jsonb,
	"performance" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deployed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "navigator_achievements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"navigator_id" varchar NOT NULL,
	"achievement_id" varchar NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL,
	"trigger_metric" text,
	"trigger_value" real,
	"county_id" varchar,
	"related_case_id" varchar,
	"notified" boolean DEFAULT false,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigator_kpis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"navigator_id" varchar NOT NULL,
	"county_id" varchar,
	"period_type" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"cases_closed" integer DEFAULT 0,
	"cases_approved" integer DEFAULT 0,
	"cases_denied" integer DEFAULT 0,
	"success_rate" real DEFAULT 0,
	"total_benefits_secured" real DEFAULT 0,
	"avg_benefit_per_case" real DEFAULT 0,
	"high_value_cases" integer DEFAULT 0,
	"avg_response_time" real DEFAULT 0,
	"avg_case_completion_time" real DEFAULT 0,
	"documents_processed" integer DEFAULT 0,
	"documents_verified" integer DEFAULT 0,
	"avg_document_quality" real DEFAULT 0,
	"cross_enrollments_identified" integer DEFAULT 0,
	"ai_recommendations_accepted" integer DEFAULT 0,
	"performance_score" real DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_type" text NOT NULL,
	"notice_code" text,
	"plain_language_title" text NOT NULL,
	"what_it_means" text NOT NULL,
	"what_to_do_next" text,
	"important_deadlines" jsonb,
	"appeal_rights" text,
	"keywords" text[],
	"example_text" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"policy_changes" boolean DEFAULT true NOT NULL,
	"feedback_alerts" boolean DEFAULT true NOT NULL,
	"navigator_alerts" boolean DEFAULT true NOT NULL,
	"system_alerts" boolean DEFAULT true NOT NULL,
	"rule_extraction_alerts" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message_template" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" varchar,
	"priority" text DEFAULT 'normal' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"action_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_change_impacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_change_id" varchar NOT NULL,
	"impact_type" text NOT NULL,
	"impact_severity" text NOT NULL,
	"affected_entity_type" text,
	"affected_entity_id" varchar,
	"affected_user_id" varchar,
	"impact_description" text NOT NULL,
	"action_required" boolean DEFAULT false NOT NULL,
	"action_description" text,
	"action_deadline" timestamp,
	"notified" boolean DEFAULT false NOT NULL,
	"notified_at" timestamp,
	"notification_id" varchar,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_changes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benefit_program_id" varchar NOT NULL,
	"change_title" text NOT NULL,
	"change_type" text NOT NULL,
	"change_category" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"summary" text NOT NULL,
	"technical_description" text,
	"impact_analysis" text,
	"effective_date" timestamp NOT NULL,
	"affected_rule_tables" text[],
	"rule_change_ids" text[],
	"document_version_id" varchar,
	"changes_diff" jsonb,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"published_at" timestamp,
	"notifications_sent" boolean DEFAULT false NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_citations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_table" text NOT NULL,
	"rule_id" varchar NOT NULL,
	"citation_type" text NOT NULL,
	"authority" text NOT NULL,
	"source_document_id" varchar,
	"section_reference" text,
	"effective_date" timestamp,
	"citation_text" text,
	"url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_engine_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benefit_program_id" varchar NOT NULL,
	"verification_type" text NOT NULL,
	"input_data" jsonb NOT NULL,
	"our_result" jsonb,
	"our_calculation_method" text,
	"policy_engine_result" jsonb,
	"policy_engine_version" text,
	"variance" real,
	"variance_percentage" real,
	"is_match" boolean,
	"confidence_score" real,
	"session_id" text,
	"performed_by" varchar,
	"error_details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source_type" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"description" text,
	"url" text,
	"benefit_program_id" varchar,
	"sync_type" text NOT NULL,
	"sync_schedule" text,
	"sync_config" jsonb,
	"last_sync_at" timestamp,
	"last_successful_sync_at" timestamp,
	"sync_status" text DEFAULT 'idle',
	"sync_error" text,
	"document_count" integer DEFAULT 0,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_variances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_table" text NOT NULL,
	"rule_id" varchar NOT NULL,
	"federal_citation_id" varchar,
	"state_citation_id" varchar,
	"variance_type" text NOT NULL,
	"explanation" text NOT NULL,
	"federal_authority" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poverty_levels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"household_size" integer NOT NULL,
	"monthly_income" integer NOT NULL,
	"annual_income" integer NOT NULL,
	"effective_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_identifier" text NOT NULL,
	"client_name" text NOT NULL,
	"date_of_birth" timestamp,
	"benefit_program_id" varchar NOT NULL,
	"client_case_id" varchar,
	"enrollment_status" text DEFAULT 'screening' NOT NULL,
	"enrollment_date" timestamp,
	"termination_date" timestamp,
	"termination_reason" text,
	"household_size" integer,
	"household_income" integer,
	"household_assets" integer,
	"is_eligible_for_other_programs" boolean DEFAULT false,
	"suggested_programs" jsonb,
	"cross_enrollment_reviewed_at" timestamp,
	"cross_enrollment_reviewed_by" varchar,
	"notes" text,
	"assigned_navigator" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_faq" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"related_questions" text[],
	"keywords" text[],
	"sort_order" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_laws" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_law_number" text NOT NULL,
	"congress" integer NOT NULL,
	"law_type" text DEFAULT 'public' NOT NULL,
	"title" text NOT NULL,
	"enactment_date" timestamp NOT NULL,
	"bill_number" text,
	"full_text" text,
	"uslm_xml" text,
	"affected_programs" text[],
	"policy_changes" jsonb,
	"govinfo_package_id" text,
	"source_url" text,
	"us_code_citations" jsonb,
	"downloaded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quick_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"rating_type" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" varchar,
	"rating" text NOT NULL,
	"follow_up_comment" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_change_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_table" text NOT NULL,
	"rule_id" varchar NOT NULL,
	"change_type" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb NOT NULL,
	"change_reason" text,
	"changed_by" varchar NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_calculations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" varchar NOT NULL,
	"benefit_results" jsonb NOT NULL,
	"total_monthly_benefits" real DEFAULT 0,
	"total_yearly_benefits" real DEFAULT 0,
	"eligible_program_count" integer DEFAULT 0,
	"snap_amount" real DEFAULT 0,
	"medicaid_eligible" boolean DEFAULT false,
	"eitc_amount" real DEFAULT 0,
	"child_tax_credit_amount" real DEFAULT 0,
	"ssi_amount" real DEFAULT 0,
	"tanf_amount" real DEFAULT 0,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"calculation_version" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_comparisons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"scenario_ids" text[] NOT NULL,
	"exported_at" timestamp,
	"export_format" text,
	"shared_with" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_state_options" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" varchar NOT NULL,
	"state_option_id" varchar NOT NULL,
	"is_enabled" boolean NOT NULL,
	"configuration_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"user_id" varchar,
	"benefit_program_id" varchar,
	"response" jsonb,
	"relevance_score" real,
	"response_time" integer,
	"search_type" text DEFAULT 'semantic' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_id" varchar NOT NULL,
	"chunk_id" varchar NOT NULL,
	"relevance_score" real NOT NULL,
	"rank_position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_cross_references" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_section_id" varchar NOT NULL,
	"to_section_number" text NOT NULL,
	"reference_type" text NOT NULL,
	"context" text,
	"chunk_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'low' NOT NULL,
	"user_id" varchar,
	"username" text,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"request_path" text,
	"request_method" text,
	"details" jsonb NOT NULL,
	"blocked" boolean DEFAULT false,
	"action_taken" text,
	"reviewed" boolean DEFAULT false,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"false_positive" boolean DEFAULT false,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snap_allotments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benefit_program_id" varchar NOT NULL,
	"manual_section_id" varchar,
	"household_size" integer NOT NULL,
	"max_monthly_benefit" integer NOT NULL,
	"min_monthly_benefit" integer,
	"effective_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snap_deductions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benefit_program_id" varchar NOT NULL,
	"manual_section_id" varchar,
	"deduction_type" text NOT NULL,
	"deduction_name" text NOT NULL,
	"calculation_type" text NOT NULL,
	"amount" integer,
	"percentage" integer,
	"min_amount" integer,
	"max_amount" integer,
	"conditions" jsonb,
	"effective_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snap_income_limits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benefit_program_id" varchar NOT NULL,
	"manual_section_id" varchar,
	"household_size" integer NOT NULL,
	"gross_monthly_limit" integer NOT NULL,
	"net_monthly_limit" integer NOT NULL,
	"percent_of_poverty" integer NOT NULL,
	"effective_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_option_status_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_option_status_id" varchar NOT NULL,
	"state_option_id" varchar NOT NULL,
	"change_type" text NOT NULL,
	"previous_value" boolean,
	"new_value" boolean NOT NULL,
	"data_source" text NOT NULL,
	"changed_by" varchar NOT NULL,
	"change_reason" text,
	"evidence_url" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_options_waivers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_code" text NOT NULL,
	"option_name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"statutory_citation" text,
	"regulatory_citation" text,
	"policy_engine_variable" text,
	"eligibility_impact" text,
	"benefit_impact" text,
	"administrative_impact" text,
	"states_using" jsonb,
	"fns_report_edition" text NOT NULL,
	"fns_report_section" text,
	"source_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "state_options_waivers_option_code_unique" UNIQUE("option_code")
);
--> statement-breakpoint
CREATE TABLE "tax_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" varchar,
	"federal_return_id" varchar,
	"vita_session_id" varchar,
	"document_type" text NOT NULL,
	"document_id" varchar,
	"extracted_data" jsonb NOT NULL,
	"gemini_confidence" real,
	"verification_status" text DEFAULT 'pending',
	"verified_by" varchar,
	"verified_at" timestamp,
	"quality_flags" jsonb,
	"requires_manual_review" boolean DEFAULT false,
	"tax_year" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_version_id" varchar,
	"status" text NOT NULL,
	"progress" real DEFAULT 0,
	"config" jsonb,
	"metrics" jsonb,
	"logs" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text,
	"full_name" text,
	"phone" text,
	"role" text DEFAULT 'client' NOT NULL,
	"dhs_employee_id" text,
	"office_location" text,
	"vita_certification_level" text,
	"vita_certification_date" timestamp,
	"vita_certification_expiry" timestamp,
	"vita_certification_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification_requirements_met" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_id" varchar NOT NULL,
	"requirement_id" varchar NOT NULL,
	"client_case_id" varchar NOT NULL,
	"met_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "version_check_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_type" text NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"current_version" timestamp,
	"latest_version" timestamp,
	"update_detected" boolean DEFAULT false NOT NULL,
	"checksum_current" text,
	"checksum_latest" text,
	"metadata" jsonb,
	"error_message" text,
	"triggered_by" varchar,
	"auto_sync_triggered" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vita_intake_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_case_id" varchar,
	"household_profile_id" varchar,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"current_step" integer DEFAULT 1,
	"primary_first_name" text,
	"primary_middle_initial" text,
	"primary_last_name" text,
	"primary_date_of_birth" date,
	"primary_job_title" text,
	"primary_telephone" text,
	"primary_ssn" text,
	"spouse_first_name" text,
	"spouse_middle_initial" text,
	"spouse_last_name" text,
	"spouse_date_of_birth" date,
	"spouse_job_title" text,
	"spouse_telephone" text,
	"spouse_ssn" text,
	"mailing_address" text,
	"apt_number" text,
	"city" text,
	"state" text DEFAULT 'MD',
	"zip_code" text,
	"email" text,
	"lived_or_worked_in_multiple_states" boolean DEFAULT false,
	"can_anyone_claim_you" boolean DEFAULT false,
	"primary_legally_blind" boolean DEFAULT false,
	"spouse_legally_blind" boolean DEFAULT false,
	"primary_us_citizen" boolean DEFAULT true,
	"spouse_us_citizen" boolean DEFAULT true,
	"primary_on_visa" boolean DEFAULT false,
	"spouse_on_visa" boolean DEFAULT false,
	"primary_full_time_student" boolean DEFAULT false,
	"spouse_full_time_student" boolean DEFAULT false,
	"primary_totally_permanently_disabled" boolean DEFAULT false,
	"spouse_totally_permanently_disabled" boolean DEFAULT false,
	"primary_issued_ippin" boolean DEFAULT false,
	"spouse_issued_ippin" boolean DEFAULT false,
	"primary_owner_digital_assets" boolean DEFAULT false,
	"spouse_owner_digital_assets" boolean DEFAULT false,
	"refund_method" text,
	"bank_account_number" text,
	"bank_routing_number" text,
	"preferred_irs_language" text,
	"primary_presidential_campaign_fund" boolean DEFAULT false,
	"spouse_presidential_campaign_fund" boolean DEFAULT false,
	"marital_status_dec_31" text,
	"married_on_last_day" boolean,
	"lived_apart_last_6_months" boolean DEFAULT false,
	"separation_date" date,
	"divorce_date" date,
	"dependents" jsonb DEFAULT '[]'::jsonb,
	"has_w2_income" boolean DEFAULT false,
	"w2_job_count" integer DEFAULT 0,
	"has_tips" boolean DEFAULT false,
	"has_retirement_income" boolean DEFAULT false,
	"has_qualified_charitable_distribution" boolean DEFAULT false,
	"qcd_amount" real DEFAULT 0,
	"has_disability_income" boolean DEFAULT false,
	"has_social_security_income" boolean DEFAULT false,
	"has_unemployment_income" boolean DEFAULT false,
	"has_state_local_refund" boolean DEFAULT false,
	"state_local_refund_amount" real DEFAULT 0,
	"itemized_last_year" boolean DEFAULT false,
	"has_interest_income" boolean DEFAULT false,
	"has_dividend_income" boolean DEFAULT false,
	"has_capital_gains" boolean DEFAULT false,
	"reported_loss_last_year" boolean DEFAULT false,
	"has_capital_loss_carryover" boolean DEFAULT false,
	"has_alimony_income" boolean DEFAULT false,
	"alimony_amount" real DEFAULT 0,
	"has_rental_income" boolean DEFAULT false,
	"rented_dwelling_as_residence" boolean DEFAULT false,
	"rented_fewer_than_15_days" boolean DEFAULT false,
	"rental_expense_amount" real DEFAULT 0,
	"has_personal_property_rental" boolean DEFAULT false,
	"has_gambling_income" boolean DEFAULT false,
	"has_self_employment_income" boolean DEFAULT false,
	"reported_self_employment_loss_last_year" boolean DEFAULT false,
	"schedule_c_expenses" real DEFAULT 0,
	"has_other_income" boolean DEFAULT false,
	"other_income_description" text,
	"has_student_loan_interest" boolean DEFAULT false,
	"has_tuition_expenses" boolean DEFAULT false,
	"has_childcare_expenses" boolean DEFAULT false,
	"has_adoption_expenses" boolean DEFAULT false,
	"has_energy_improvements" boolean DEFAULT false,
	"has_health_coverage" boolean DEFAULT false,
	"purchased_marketplace_insurance" boolean DEFAULT false,
	"has_form_1095a" boolean DEFAULT false,
	"has_charitable_contributions" boolean DEFAULT false,
	"has_mortgage_interest" boolean DEFAULT false,
	"sold_home" boolean DEFAULT false,
	"has_medical_expenses" boolean DEFAULT false,
	"has_estimated_tax_payments" boolean DEFAULT false,
	"has_retirement_contributions" boolean DEFAULT false,
	"received_advanced_child_tax_credit" boolean DEFAULT false,
	"received_economic_impact_payment" boolean DEFAULT false,
	"had_debt_forgiven" boolean DEFAULT false,
	"received_state_local_stimulus" boolean DEFAULT false,
	"received_disaster_relief" boolean DEFAULT false,
	"uploaded_documents" jsonb DEFAULT '[]'::jsonb,
	"missing_documents" text[],
	"review_status" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"certification_level" text,
	"global_carry_forward_consent" boolean DEFAULT false,
	"primary_taxpayer_signature" text,
	"primary_taxpayer_signed_at" timestamp,
	"spouse_taxpayer_signature" text,
	"spouse_taxpayer_signed_at" timestamp,
	"english_conversation_level" text,
	"english_reading_level" text,
	"has_disability_in_household" boolean,
	"is_veteran" boolean,
	"primary_race_ethnicity" text[],
	"spouse_race_ethnicity" text[],
	"additional_notes" text,
	"internal_notes" text,
	"completed_at" timestamp,
	"filed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "war_gaming_scenarios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"scenario_type" text NOT NULL,
	"bill_id" varchar,
	"bill_type" text,
	"created_by" varchar NOT NULL,
	"is_baseline" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "abawd_exemption_verifications" ADD CONSTRAINT "abawd_exemption_verifications_client_case_id_client_cases_id_fk" FOREIGN KEY ("client_case_id") REFERENCES "public"."client_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abawd_exemption_verifications" ADD CONSTRAINT "abawd_exemption_verifications_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abawd_exemption_verifications" ADD CONSTRAINT "abawd_exemption_verifications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abawd_exemption_verifications" ADD CONSTRAINT "abawd_exemption_verifications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anonymous_screening_sessions" ADD CONSTRAINT "anonymous_screening_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_forms" ADD CONSTRAINT "application_forms_session_id_intake_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_forms" ADD CONSTRAINT "application_forms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_forms" ADD CONSTRAINT "application_forms_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_county_id_counties_id_fk" FOREIGN KEY ("county_id") REFERENCES "public"."counties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_activity_events" ADD CONSTRAINT "case_activity_events_navigator_id_users_id_fk" FOREIGN KEY ("navigator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_activity_events" ADD CONSTRAINT "case_activity_events_case_id_client_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."client_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_activity_events" ADD CONSTRAINT "case_activity_events_county_id_counties_id_fk" FOREIGN KEY ("county_id") REFERENCES "public"."counties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorical_eligibility_rules" ADD CONSTRAINT "categorical_eligibility_rules_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorical_eligibility_rules" ADD CONSTRAINT "categorical_eligibility_rules_manual_section_id_manual_sections_id_fk" FOREIGN KEY ("manual_section_id") REFERENCES "public"."manual_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorical_eligibility_rules" ADD CONSTRAINT "categorical_eligibility_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorical_eligibility_rules" ADD CONSTRAINT "categorical_eligibility_rules_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_cases" ADD CONSTRAINT "client_cases_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_cases" ADD CONSTRAINT "client_cases_assigned_navigator_users_id_fk" FOREIGN KEY ("assigned_navigator") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_cases" ADD CONSTRAINT "client_cases_eligibility_calculation_id_eligibility_calculations_id_fk" FOREIGN KEY ("eligibility_calculation_id") REFERENCES "public"."eligibility_calculations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_cases" ADD CONSTRAINT "client_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_client_case_id_client_cases_id_fk" FOREIGN KEY ("client_case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_consent_form_id_consent_forms_id_fk" FOREIGN KEY ("consent_form_id") REFERENCES "public"."consent_forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_session_id_client_interaction_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."client_interaction_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_witnessed_by_users_id_fk" FOREIGN KEY ("witnessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_interaction_sessions" ADD CONSTRAINT "client_interaction_sessions_client_case_id_client_cases_id_fk" FOREIGN KEY ("client_case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_interaction_sessions" ADD CONSTRAINT "client_interaction_sessions_navigator_id_users_id_fk" FOREIGN KEY ("navigator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_verification_documents" ADD CONSTRAINT "client_verification_documents_session_id_client_interaction_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."client_interaction_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_verification_documents" ADD CONSTRAINT "client_verification_documents_client_case_id_client_cases_id_fk" FOREIGN KEY ("client_case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_verification_documents" ADD CONSTRAINT "client_verification_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_verification_documents" ADD CONSTRAINT "client_verification_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_rules" ADD CONSTRAINT "compliance_rules_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_rules" ADD CONSTRAINT "compliance_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_rules" ADD CONSTRAINT "compliance_rules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_violations" ADD CONSTRAINT "compliance_violations_compliance_rule_id_compliance_rules_id_fk" FOREIGN KEY ("compliance_rule_id") REFERENCES "public"."compliance_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_violations" ADD CONSTRAINT "compliance_violations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_violations" ADD CONSTRAINT "compliance_violations_detected_by_users_id_fk" FOREIGN KEY ("detected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_violations" ADD CONSTRAINT "compliance_violations_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_forms" ADD CONSTRAINT "consent_forms_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_forms" ADD CONSTRAINT "consent_forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_forms" ADD CONSTRAINT "consent_forms_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counties" ADD CONSTRAINT "counties_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "county_metrics" ADD CONSTRAINT "county_metrics_county_id_counties_id_fk" FOREIGN KEY ("county_id") REFERENCES "public"."counties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "county_users" ADD CONSTRAINT "county_users_county_id_counties_id_fk" FOREIGN KEY ("county_id") REFERENCES "public"."counties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "county_users" ADD CONSTRAINT "county_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "county_users" ADD CONSTRAINT "county_users_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_enrollment_audit_events" ADD CONSTRAINT "cross_enrollment_audit_events_dataset_id_ee_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."ee_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_enrollment_audit_events" ADD CONSTRAINT "cross_enrollment_audit_events_opportunity_id_cross_enrollment_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."cross_enrollment_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_enrollment_audit_events" ADD CONSTRAINT "cross_enrollment_audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_enrollment_opportunities" ADD CONSTRAINT "cross_enrollment_opportunities_ee_client_id_ee_clients_id_fk" FOREIGN KEY ("ee_client_id") REFERENCES "public"."ee_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_enrollment_opportunities" ADD CONSTRAINT "cross_enrollment_opportunities_client_case_id_client_cases_id_fk" FOREIGN KEY ("client_case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_enrollment_opportunities" ADD CONSTRAINT "cross_enrollment_opportunities_current_program_id_benefit_programs_id_fk" FOREIGN KEY ("current_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_enrollment_opportunities" ADD CONSTRAINT "cross_enrollment_opportunities_target_program_id_benefit_programs_id_fk" FOREIGN KEY ("target_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_enrollment_opportunities" ADD CONSTRAINT "cross_enrollment_opportunities_contacted_by_users_id_fk" FOREIGN KEY ("contacted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_enrollment_opportunities" ADD CONSTRAINT "cross_enrollment_opportunities_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_enrollment_opportunities" ADD CONSTRAINT "cross_enrollment_opportunities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirement_rules" ADD CONSTRAINT "document_requirement_rules_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirement_rules" ADD CONSTRAINT "document_requirement_rules_manual_section_id_manual_sections_id_fk" FOREIGN KEY ("manual_section_id") REFERENCES "public"."manual_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirement_rules" ADD CONSTRAINT "document_requirement_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirement_rules" ADD CONSTRAINT "document_requirement_rules_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_verifications" ADD CONSTRAINT "document_verifications_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_verifications" ADD CONSTRAINT "document_verifications_client_case_id_client_cases_id_fk" FOREIGN KEY ("client_case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_verifications" ADD CONSTRAINT "document_verifications_session_id_client_interaction_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."client_interaction_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_verifications" ADD CONSTRAINT "document_verifications_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ee_clients" ADD CONSTRAINT "ee_clients_dataset_id_ee_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."ee_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ee_clients" ADD CONSTRAINT "ee_clients_enrolled_program_id_benefit_programs_id_fk" FOREIGN KEY ("enrolled_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ee_clients" ADD CONSTRAINT "ee_clients_matched_client_case_id_client_cases_id_fk" FOREIGN KEY ("matched_client_case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ee_clients" ADD CONSTRAINT "ee_clients_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ee_dataset_files" ADD CONSTRAINT "ee_dataset_files_dataset_id_ee_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."ee_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ee_dataset_files" ADD CONSTRAINT "ee_dataset_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ee_datasets" ADD CONSTRAINT "ee_datasets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ee_export_batches" ADD CONSTRAINT "ee_export_batches_exported_by_users_id_fk" FOREIGN KEY ("exported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_calculations" ADD CONSTRAINT "eligibility_calculations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_calculations" ADD CONSTRAINT "eligibility_calculations_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_calculations" ADD CONSTRAINT "eligibility_calculations_calculated_by_users_id_fk" FOREIGN KEY ("calculated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_run_id_evaluation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."evaluation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_test_case_id_evaluation_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."evaluation_test_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_run_by_users_id_fk" FOREIGN KEY ("run_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_test_cases" ADD CONSTRAINT "evaluation_test_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_manual_section_id_manual_sections_id_fk" FOREIGN KEY ("manual_section_id") REFERENCES "public"."manual_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_extracted_by_users_id_fk" FOREIGN KEY ("extracted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federal_tax_returns" ADD CONSTRAINT "federal_tax_returns_scenario_id_household_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."household_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federal_tax_returns" ADD CONSTRAINT "federal_tax_returns_preparer_id_users_id_fk" FOREIGN KEY ("preparer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federal_tax_returns" ADD CONSTRAINT "federal_tax_returns_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_profiles" ADD CONSTRAINT "household_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_profiles" ADD CONSTRAINT "household_profiles_client_case_id_client_cases_id_fk" FOREIGN KEY ("client_case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_scenarios" ADD CONSTRAINT "household_scenarios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_messages" ADD CONSTRAINT "intake_messages_session_id_intake_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."intake_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_sessions" ADD CONSTRAINT "intake_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_sessions" ADD CONSTRAINT "intake_sessions_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboards" ADD CONSTRAINT "leaderboards_county_id_counties_id_fk" FOREIGN KEY ("county_id") REFERENCES "public"."counties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislative_impacts" ADD CONSTRAINT "legislative_impacts_scenario_id_war_gaming_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."war_gaming_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislative_impacts" ADD CONSTRAINT "legislative_impacts_baseline_scenario_id_war_gaming_scenarios_id_fk" FOREIGN KEY ("baseline_scenario_id") REFERENCES "public"."war_gaming_scenarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislative_impacts" ADD CONSTRAINT "legislative_impacts_calculated_by_users_id_fk" FOREIGN KEY ("calculated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_sections" ADD CONSTRAINT "manual_sections_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maryland_state_option_status" ADD CONSTRAINT "maryland_state_option_status_state_option_id_state_options_waivers_id_fk" FOREIGN KEY ("state_option_id") REFERENCES "public"."state_options_waivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maryland_state_option_status" ADD CONSTRAINT "maryland_state_option_status_extracted_by_users_id_fk" FOREIGN KEY ("extracted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maryland_state_option_status" ADD CONSTRAINT "maryland_state_option_status_last_verified_by_users_id_fk" FOREIGN KEY ("last_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maryland_tax_returns" ADD CONSTRAINT "maryland_tax_returns_federal_return_id_federal_tax_returns_id_fk" FOREIGN KEY ("federal_return_id") REFERENCES "public"."federal_tax_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_achievements" ADD CONSTRAINT "navigator_achievements_navigator_id_users_id_fk" FOREIGN KEY ("navigator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_achievements" ADD CONSTRAINT "navigator_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_achievements" ADD CONSTRAINT "navigator_achievements_county_id_counties_id_fk" FOREIGN KEY ("county_id") REFERENCES "public"."counties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_achievements" ADD CONSTRAINT "navigator_achievements_related_case_id_client_cases_id_fk" FOREIGN KEY ("related_case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_kpis" ADD CONSTRAINT "navigator_kpis_navigator_id_users_id_fk" FOREIGN KEY ("navigator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_kpis" ADD CONSTRAINT "navigator_kpis_county_id_counties_id_fk" FOREIGN KEY ("county_id") REFERENCES "public"."counties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_change_impacts" ADD CONSTRAINT "policy_change_impacts_policy_change_id_policy_changes_id_fk" FOREIGN KEY ("policy_change_id") REFERENCES "public"."policy_changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_change_impacts" ADD CONSTRAINT "policy_change_impacts_affected_user_id_users_id_fk" FOREIGN KEY ("affected_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_change_impacts" ADD CONSTRAINT "policy_change_impacts_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_changes" ADD CONSTRAINT "policy_changes_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_changes" ADD CONSTRAINT "policy_changes_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_changes" ADD CONSTRAINT "policy_changes_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_changes" ADD CONSTRAINT "policy_changes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_citations" ADD CONSTRAINT "policy_citations_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_engine_verifications" ADD CONSTRAINT "policy_engine_verifications_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_engine_verifications" ADD CONSTRAINT "policy_engine_verifications_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_sources" ADD CONSTRAINT "policy_sources_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_variances" ADD CONSTRAINT "policy_variances_federal_citation_id_policy_citations_id_fk" FOREIGN KEY ("federal_citation_id") REFERENCES "public"."policy_citations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_variances" ADD CONSTRAINT "policy_variances_state_citation_id_policy_citations_id_fk" FOREIGN KEY ("state_citation_id") REFERENCES "public"."policy_citations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poverty_levels" ADD CONSTRAINT "poverty_levels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_client_case_id_client_cases_id_fk" FOREIGN KEY ("client_case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_cross_enrollment_reviewed_by_users_id_fk" FOREIGN KEY ("cross_enrollment_reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_assigned_navigator_users_id_fk" FOREIGN KEY ("assigned_navigator") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_ratings" ADD CONSTRAINT "quick_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_change_logs" ADD CONSTRAINT "rule_change_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_change_logs" ADD CONSTRAINT "rule_change_logs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_calculations" ADD CONSTRAINT "scenario_calculations_scenario_id_household_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."household_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_comparisons" ADD CONSTRAINT "scenario_comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_state_options" ADD CONSTRAINT "scenario_state_options_scenario_id_war_gaming_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."war_gaming_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_state_options" ADD CONSTRAINT "scenario_state_options_state_option_id_state_options_waivers_id_fk" FOREIGN KEY ("state_option_id") REFERENCES "public"."state_options_waivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_query_id_search_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."search_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_chunk_id_document_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_cross_references" ADD CONSTRAINT "section_cross_references_from_section_id_manual_sections_id_fk" FOREIGN KEY ("from_section_id") REFERENCES "public"."manual_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_cross_references" ADD CONSTRAINT "section_cross_references_chunk_id_document_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_allotments" ADD CONSTRAINT "snap_allotments_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_allotments" ADD CONSTRAINT "snap_allotments_manual_section_id_manual_sections_id_fk" FOREIGN KEY ("manual_section_id") REFERENCES "public"."manual_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_allotments" ADD CONSTRAINT "snap_allotments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_allotments" ADD CONSTRAINT "snap_allotments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_deductions" ADD CONSTRAINT "snap_deductions_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_deductions" ADD CONSTRAINT "snap_deductions_manual_section_id_manual_sections_id_fk" FOREIGN KEY ("manual_section_id") REFERENCES "public"."manual_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_deductions" ADD CONSTRAINT "snap_deductions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_deductions" ADD CONSTRAINT "snap_deductions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_income_limits" ADD CONSTRAINT "snap_income_limits_benefit_program_id_benefit_programs_id_fk" FOREIGN KEY ("benefit_program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_income_limits" ADD CONSTRAINT "snap_income_limits_manual_section_id_manual_sections_id_fk" FOREIGN KEY ("manual_section_id") REFERENCES "public"."manual_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_income_limits" ADD CONSTRAINT "snap_income_limits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snap_income_limits" ADD CONSTRAINT "snap_income_limits_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_option_status_history" ADD CONSTRAINT "state_option_status_history_state_option_status_id_maryland_state_option_status_id_fk" FOREIGN KEY ("state_option_status_id") REFERENCES "public"."maryland_state_option_status"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_option_status_history" ADD CONSTRAINT "state_option_status_history_state_option_id_state_options_waivers_id_fk" FOREIGN KEY ("state_option_id") REFERENCES "public"."state_options_waivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_option_status_history" ADD CONSTRAINT "state_option_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_scenario_id_household_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."household_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_federal_return_id_federal_tax_returns_id_fk" FOREIGN KEY ("federal_return_id") REFERENCES "public"."federal_tax_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_vita_session_id_vita_intake_sessions_id_fk" FOREIGN KEY ("vita_session_id") REFERENCES "public"."vita_intake_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_jobs" ADD CONSTRAINT "training_jobs_model_version_id_model_versions_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."model_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requirements_met" ADD CONSTRAINT "verification_requirements_met_verification_id_document_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."document_verifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requirements_met" ADD CONSTRAINT "verification_requirements_met_requirement_id_document_requirement_rules_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."document_requirement_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requirements_met" ADD CONSTRAINT "verification_requirements_met_client_case_id_client_cases_id_fk" FOREIGN KEY ("client_case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_check_logs" ADD CONSTRAINT "version_check_logs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vita_intake_sessions" ADD CONSTRAINT "vita_intake_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vita_intake_sessions" ADD CONSTRAINT "vita_intake_sessions_client_case_id_client_cases_id_fk" FOREIGN KEY ("client_case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vita_intake_sessions" ADD CONSTRAINT "vita_intake_sessions_household_profile_id_household_profiles_id_fk" FOREIGN KEY ("household_profile_id") REFERENCES "public"."household_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vita_intake_sessions" ADD CONSTRAINT "vita_intake_sessions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "war_gaming_scenarios" ADD CONSTRAINT "war_gaming_scenarios_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abawd_client_case_idx" ON "abawd_exemption_verifications" USING btree ("client_case_id");--> statement-breakpoint
CREATE INDEX "abawd_status_idx" ON "abawd_exemption_verifications" USING btree ("exemption_status");--> statement-breakpoint
CREATE INDEX "abawd_exemption_type_idx" ON "abawd_exemption_verifications" USING btree ("exemption_type");--> statement-breakpoint
CREATE INDEX "anonymous_screening_session_idx" ON "anonymous_screening_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "anonymous_screening_user_idx" ON "anonymous_screening_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "anonymous_screening_created_idx" ON "anonymous_screening_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "application_forms_session_idx" ON "application_forms" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "application_forms_user_idx" ON "application_forms" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "application_forms_export_status_idx" ON "application_forms" USING btree ("export_status");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_sensitive_idx" ON "audit_logs" USING btree ("sensitive_data_accessed","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "case_events_navigator_idx" ON "case_activity_events" USING btree ("navigator_id","occurred_at");--> statement-breakpoint
CREATE INDEX "case_events_case_idx" ON "case_activity_events" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "case_events_type_idx" ON "case_activity_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "client_verif_docs_session_idx" ON "client_verification_documents" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "client_verif_docs_case_idx" ON "client_verification_documents" USING btree ("client_case_id");--> statement-breakpoint
CREATE INDEX "client_verif_docs_status_idx" ON "client_verification_documents" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "compliance_rules_type_idx" ON "compliance_rules" USING btree ("rule_type");--> statement-breakpoint
CREATE INDEX "compliance_rules_category_idx" ON "compliance_rules" USING btree ("category");--> statement-breakpoint
CREATE INDEX "compliance_rules_benefit_program_idx" ON "compliance_rules" USING btree ("benefit_program_id");--> statement-breakpoint
CREATE INDEX "compliance_violations_rule_idx" ON "compliance_violations" USING btree ("compliance_rule_id");--> statement-breakpoint
CREATE INDEX "compliance_violations_status_idx" ON "compliance_violations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "compliance_violations_severity_idx" ON "compliance_violations" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "compliance_violations_entity_idx" ON "compliance_violations" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "counties_code_idx" ON "counties" USING btree ("code");--> statement-breakpoint
CREATE INDEX "counties_region_idx" ON "counties" USING btree ("region");--> statement-breakpoint
CREATE INDEX "county_metrics_county_period_idx" ON "county_metrics" USING btree ("county_id","period_type","period_start");--> statement-breakpoint
CREATE INDEX "county_users_county_user_idx" ON "county_users" USING btree ("county_id","user_id");--> statement-breakpoint
CREATE INDEX "county_users_user_idx" ON "county_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "county_users_primary_idx" ON "county_users" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "cross_audit_event_type_idx" ON "cross_enrollment_audit_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "cross_audit_dataset_id_idx" ON "cross_enrollment_audit_events" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "cross_audit_user_id_idx" ON "cross_enrollment_audit_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cross_audit_created_at_idx" ON "cross_enrollment_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cross_opportunities_ee_client_idx" ON "cross_enrollment_opportunities" USING btree ("ee_client_id");--> statement-breakpoint
CREATE INDEX "cross_opportunities_client_case_idx" ON "cross_enrollment_opportunities" USING btree ("client_case_id");--> statement-breakpoint
CREATE INDEX "cross_opportunities_outreach_status_idx" ON "cross_enrollment_opportunities" USING btree ("outreach_status");--> statement-breakpoint
CREATE INDEX "cross_opportunities_priority_idx" ON "cross_enrollment_opportunities" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "cross_opportunities_target_program_idx" ON "cross_enrollment_opportunities" USING btree ("target_program_id");--> statement-breakpoint
CREATE INDEX "chunks_document_id_idx" ON "document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "documents_benefit_program_idx" ON "documents" USING btree ("benefit_program_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "documents_section_number_idx" ON "documents" USING btree ("section_number");--> statement-breakpoint
CREATE INDEX "ee_clients_dataset_id_idx" ON "ee_clients" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "ee_clients_match_status_idx" ON "ee_clients" USING btree ("match_status");--> statement-breakpoint
CREATE INDEX "ee_clients_identifier_hash_idx" ON "ee_clients" USING btree ("client_identifier_hash");--> statement-breakpoint
CREATE INDEX "ee_clients_name_hash_idx" ON "ee_clients" USING btree ("client_name_hash");--> statement-breakpoint
CREATE INDEX "ee_clients_enrolled_program_idx" ON "ee_clients" USING btree ("enrolled_program_id");--> statement-breakpoint
CREATE INDEX "ee_dataset_files_dataset_id_idx" ON "ee_dataset_files" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "ee_datasets_data_source_idx" ON "ee_datasets" USING btree ("data_source");--> statement-breakpoint
CREATE INDEX "ee_datasets_is_active_idx" ON "ee_datasets" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ee_datasets_processing_status_idx" ON "ee_datasets" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "federal_bills_bill_number_idx" ON "federal_bills" USING btree ("bill_number");--> statement-breakpoint
CREATE INDEX "federal_bills_congress_idx" ON "federal_bills" USING btree ("congress");--> statement-breakpoint
CREATE INDEX "federal_bills_status_idx" ON "federal_bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "federal_tax_returns_scenario_idx" ON "federal_tax_returns" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "federal_tax_returns_preparer_idx" ON "federal_tax_returns" USING btree ("preparer_id");--> statement-breakpoint
CREATE INDEX "federal_tax_returns_tax_year_idx" ON "federal_tax_returns" USING btree ("tax_year");--> statement-breakpoint
CREATE INDEX "federal_tax_returns_efile_status_idx" ON "federal_tax_returns" USING btree ("efile_status");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_user_id_idx" ON "feedback_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_assigned_to_idx" ON "feedback_submissions" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "household_profiles_user_idx" ON "household_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "household_profiles_case_idx" ON "household_profiles" USING btree ("client_case_id");--> statement-breakpoint
CREATE INDEX "household_profiles_mode_idx" ON "household_profiles" USING btree ("profile_mode");--> statement-breakpoint
CREATE INDEX "household_profiles_active_idx" ON "household_profiles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "household_scenarios_user_idx" ON "household_scenarios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "household_scenarios_client_idx" ON "household_scenarios" USING btree ("client_identifier");--> statement-breakpoint
CREATE INDEX "household_scenarios_created_idx" ON "household_scenarios" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "intake_messages_session_idx" ON "intake_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "intake_sessions_user_idx" ON "intake_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "intake_sessions_status_idx" ON "intake_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leaderboards_type_scope_period_idx" ON "leaderboards" USING btree ("leaderboard_type","scope","period_type");--> statement-breakpoint
CREATE INDEX "leaderboards_county_idx" ON "leaderboards" USING btree ("county_id");--> statement-breakpoint
CREATE INDEX "legislative_impacts_scenario_idx" ON "legislative_impacts" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "legislative_impacts_bill_id_idx" ON "legislative_impacts" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "legislative_impacts_program_idx" ON "legislative_impacts" USING btree ("affected_program");--> statement-breakpoint
CREATE INDEX "maryland_bills_bill_number_idx" ON "maryland_bills" USING btree ("bill_number");--> statement-breakpoint
CREATE INDEX "maryland_bills_session_idx" ON "maryland_bills" USING btree ("session");--> statement-breakpoint
CREATE INDEX "maryland_bills_status_idx" ON "maryland_bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "md_state_option_status_option_idx" ON "maryland_state_option_status" USING btree ("state_option_id");--> statement-breakpoint
CREATE INDEX "md_state_option_participating_idx" ON "maryland_state_option_status" USING btree ("is_participating");--> statement-breakpoint
CREATE INDEX "maryland_tax_returns_federal_idx" ON "maryland_tax_returns" USING btree ("federal_return_id");--> statement-breakpoint
CREATE INDEX "maryland_tax_returns_county_idx" ON "maryland_tax_returns" USING btree ("county_code");--> statement-breakpoint
CREATE INDEX "nav_achievements_nav_achievement_idx" ON "navigator_achievements" USING btree ("navigator_id","achievement_id");--> statement-breakpoint
CREATE INDEX "nav_achievements_earned_at_idx" ON "navigator_achievements" USING btree ("earned_at");--> statement-breakpoint
CREATE INDEX "navigator_kpis_nav_period_idx" ON "navigator_kpis" USING btree ("navigator_id","period_type","period_start");--> statement-breakpoint
CREATE INDEX "navigator_kpis_county_idx" ON "navigator_kpis" USING btree ("county_id");--> statement-breakpoint
CREATE INDEX "navigator_kpis_score_idx" ON "navigator_kpis" USING btree ("performance_score");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "policy_change_impacts_policy_change_idx" ON "policy_change_impacts" USING btree ("policy_change_id");--> statement-breakpoint
CREATE INDEX "policy_change_impacts_user_idx" ON "policy_change_impacts" USING btree ("affected_user_id");--> statement-breakpoint
CREATE INDEX "policy_change_impacts_notified_idx" ON "policy_change_impacts" USING btree ("notified");--> statement-breakpoint
CREATE INDEX "policy_changes_benefit_program_idx" ON "policy_changes" USING btree ("benefit_program_id");--> statement-breakpoint
CREATE INDEX "policy_changes_effective_date_idx" ON "policy_changes" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "policy_changes_status_idx" ON "policy_changes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pe_verifications_program_idx" ON "policy_engine_verifications" USING btree ("benefit_program_id");--> statement-breakpoint
CREATE INDEX "pe_verifications_match_idx" ON "policy_engine_verifications" USING btree ("is_match");--> statement-breakpoint
CREATE INDEX "pe_verifications_created_idx" ON "policy_engine_verifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "enrollments_client_identifier_idx" ON "program_enrollments" USING btree ("client_identifier");--> statement-breakpoint
CREATE INDEX "enrollments_program_idx" ON "program_enrollments" USING btree ("benefit_program_id");--> statement-breakpoint
CREATE INDEX "enrollments_status_idx" ON "program_enrollments" USING btree ("enrollment_status");--> statement-breakpoint
CREATE INDEX "enrollments_eligibility_flag_idx" ON "program_enrollments" USING btree ("is_eligible_for_other_programs");--> statement-breakpoint
CREATE INDEX "public_laws_number_idx" ON "public_laws" USING btree ("public_law_number");--> statement-breakpoint
CREATE INDEX "public_laws_congress_idx" ON "public_laws" USING btree ("congress");--> statement-breakpoint
CREATE INDEX "quick_ratings_user_id_idx" ON "quick_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quick_ratings_type_idx" ON "quick_ratings" USING btree ("rating_type");--> statement-breakpoint
CREATE INDEX "quick_ratings_entity_idx" ON "quick_ratings" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "scenario_calculations_scenario_idx" ON "scenario_calculations" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "scenario_calculations_calculated_idx" ON "scenario_calculations" USING btree ("calculated_at");--> statement-breakpoint
CREATE INDEX "scenario_comparisons_user_idx" ON "scenario_comparisons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scenario_comparisons_created_idx" ON "scenario_comparisons" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scenario_state_options_scenario_idx" ON "scenario_state_options" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "scenario_state_options_option_idx" ON "scenario_state_options" USING btree ("state_option_id");--> statement-breakpoint
CREATE INDEX "search_queries_user_id_idx" ON "search_queries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_queries_benefit_program_idx" ON "search_queries" USING btree ("benefit_program_id");--> statement-breakpoint
CREATE INDEX "security_events_type_idx" ON "security_events" USING btree ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "security_events_ip_idx" ON "security_events" USING btree ("ip_address","occurred_at");--> statement-breakpoint
CREATE INDEX "security_events_user_idx" ON "security_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "security_events_severity_idx" ON "security_events" USING btree ("severity","occurred_at");--> statement-breakpoint
CREATE INDEX "security_events_reviewed_idx" ON "security_events" USING btree ("reviewed");--> statement-breakpoint
CREATE INDEX "state_option_history_status_idx" ON "state_option_status_history" USING btree ("state_option_status_id");--> statement-breakpoint
CREATE INDEX "state_option_history_changed_by_idx" ON "state_option_status_history" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "state_option_history_changed_at_idx" ON "state_option_status_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "state_options_code_idx" ON "state_options_waivers" USING btree ("option_code");--> statement-breakpoint
CREATE INDEX "state_options_category_idx" ON "state_options_waivers" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tax_documents_scenario_idx" ON "tax_documents" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "tax_documents_federal_return_idx" ON "tax_documents" USING btree ("federal_return_id");--> statement-breakpoint
CREATE INDEX "tax_documents_vita_session_idx" ON "tax_documents" USING btree ("vita_session_id");--> statement-breakpoint
CREATE INDEX "tax_documents_type_idx" ON "tax_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "tax_documents_verification_idx" ON "tax_documents" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "version_check_logs_type_idx" ON "version_check_logs" USING btree ("check_type");--> statement-breakpoint
CREATE INDEX "version_check_logs_checked_at_idx" ON "version_check_logs" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "version_check_logs_update_detected_idx" ON "version_check_logs" USING btree ("update_detected");--> statement-breakpoint
CREATE INDEX "vita_intake_user_idx" ON "vita_intake_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vita_intake_case_idx" ON "vita_intake_sessions" USING btree ("client_case_id");--> statement-breakpoint
CREATE INDEX "vita_intake_status_idx" ON "vita_intake_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vita_intake_review_idx" ON "vita_intake_sessions" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "vita_intake_created_idx" ON "vita_intake_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "war_gaming_scenarios_created_by_idx" ON "war_gaming_scenarios" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "war_gaming_scenarios_bill_id_idx" ON "war_gaming_scenarios" USING btree ("bill_id");