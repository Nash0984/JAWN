CREATE TABLE "case_assertions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"household_profile_id" varchar,
	"state_code" text NOT NULL,
	"program_code" text NOT NULL,
	"assertion_type" text NOT NULL,
	"ontology_term_id" varchar,
	"predicate_name" text NOT NULL,
	"predicate_value" text,
	"predicate_operator" text,
	"comparison_value" text,
	"z3_assertion" text,
	"source_field" text,
	"source_value" text,
	"extraction_method" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verification_document_id" varchar,
	"tenant_id" varchar,
	"retention_category" text,
	"retention_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "explanation_clauses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"eligibility_calculation_id" varchar,
	"clause_number" integer NOT NULL,
	"clause_text" text NOT NULL,
	"normalized_clause" text,
	"mapped_ontology_terms" text[],
	"mapped_predicates" text[],
	"z3_assertion" text,
	"mapping_confidence" real,
	"mapping_model" text,
	"verification_result" text,
	"violated_rule_ids" text[],
	"explanation_type" text NOT NULL,
	"source_system" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formal_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_fragment_id" varchar,
	"state_code" text NOT NULL,
	"program_code" text NOT NULL,
	"rule_name" text NOT NULL,
	"eligibility_domain" text NOT NULL,
	"z3_logic" text NOT NULL,
	"ontology_terms_used" text[],
	"statutory_citation" text NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"previous_version_id" varchar,
	"is_valid" boolean DEFAULT true NOT NULL,
	"validation_errors" text[],
	"extraction_prompt" text,
	"extraction_model" text,
	"prompt_strategy" text,
	"extraction_confidence" real,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"deprecated_at" timestamp,
	"deprecation_reason" text,
	"created_by" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ontology_relationships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_term_id" varchar NOT NULL,
	"to_term_id" varchar NOT NULL,
	"relationship_type" text NOT NULL,
	"statutory_citation" text,
	"description" text,
	"weight" real DEFAULT 1,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ontology_terms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_code" text NOT NULL,
	"program_code" text NOT NULL,
	"term_name" text NOT NULL,
	"canonical_name" text NOT NULL,
	"domain" text NOT NULL,
	"definition" text,
	"statutory_citation" text,
	"statutory_source_id" varchar,
	"parent_term_id" varchar,
	"synonyms" text[],
	"embedding" real[],
	"embedding_model" text DEFAULT 'e5-large-v2',
	"version" text DEFAULT '1.0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_extraction_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_fragment_id" varchar,
	"formal_rule_id" varchar,
	"extraction_model" text NOT NULL,
	"prompt_strategy" text NOT NULL,
	"prompt" text NOT NULL,
	"response" text NOT NULL,
	"extracted_logic" text,
	"is_success" boolean NOT NULL,
	"error_message" text,
	"z3_validation_result" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_fragments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statutory_source_id" varchar NOT NULL,
	"clause_text" text NOT NULL,
	"clause_number" integer,
	"extracted_concepts" text[],
	"eligibility_domain" text NOT NULL,
	"rule_type" text NOT NULL,
	"extraction_method" text NOT NULL,
	"extraction_model" text,
	"confidence_score" real,
	"needs_review" boolean DEFAULT true NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solver_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"state_code" text NOT NULL,
	"program_code" text NOT NULL,
	"tbox_rule_ids" text[],
	"abox_assertion_ids" text[],
	"explanation_clause_ids" text[],
	"solver_result" text NOT NULL,
	"is_satisfied" boolean,
	"unsat_core" text[],
	"violated_rule_ids" text[],
	"violated_citations" text[],
	"satisfied_rule_ids" text[],
	"solver_version" text,
	"solver_time_ms" integer,
	"constraint_count" integer,
	"variable_count" integer,
	"triggered_by" text NOT NULL,
	"user_id" varchar,
	"tenant_id" varchar,
	"solver_trace" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statutory_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_code" text NOT NULL,
	"program_code" text NOT NULL,
	"source_type" text NOT NULL,
	"citation" text NOT NULL,
	"title" text NOT NULL,
	"full_text" text NOT NULL,
	"effective_date" date,
	"expiration_date" date,
	"parent_citation" text,
	"cross_references" text[],
	"source_url" text,
	"document_hash" text,
	"version" text DEFAULT '1.0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_scraped_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "violation_traces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solver_run_id" varchar NOT NULL,
	"case_id" varchar NOT NULL,
	"formal_rule_id" varchar NOT NULL,
	"rule_name" text NOT NULL,
	"eligibility_domain" text NOT NULL,
	"statutory_citation" text NOT NULL,
	"statutory_source_id" varchar,
	"statutory_text" text,
	"violation_type" text NOT NULL,
	"violation_description" text NOT NULL,
	"conflicting_assertion_ids" text[],
	"conflicting_predicates" jsonb,
	"appeal_recommendation" text,
	"required_documentation" text[],
	"severity_level" text DEFAULT 'high' NOT NULL,
	"display_order" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_assertions" ADD CONSTRAINT "case_assertions_case_id_client_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assertions" ADD CONSTRAINT "case_assertions_ontology_term_id_ontology_terms_id_fk" FOREIGN KEY ("ontology_term_id") REFERENCES "public"."ontology_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanation_clauses" ADD CONSTRAINT "explanation_clauses_case_id_client_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanation_clauses" ADD CONSTRAINT "explanation_clauses_eligibility_calculation_id_eligibility_calculations_id_fk" FOREIGN KEY ("eligibility_calculation_id") REFERENCES "public"."eligibility_calculations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formal_rules" ADD CONSTRAINT "formal_rules_rule_fragment_id_rule_fragments_id_fk" FOREIGN KEY ("rule_fragment_id") REFERENCES "public"."rule_fragments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formal_rules" ADD CONSTRAINT "formal_rules_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_relationships" ADD CONSTRAINT "ontology_relationships_from_term_id_ontology_terms_id_fk" FOREIGN KEY ("from_term_id") REFERENCES "public"."ontology_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_relationships" ADD CONSTRAINT "ontology_relationships_to_term_id_ontology_terms_id_fk" FOREIGN KEY ("to_term_id") REFERENCES "public"."ontology_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_terms" ADD CONSTRAINT "ontology_terms_statutory_source_id_statutory_sources_id_fk" FOREIGN KEY ("statutory_source_id") REFERENCES "public"."statutory_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_terms" ADD CONSTRAINT "ontology_terms_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_extraction_logs" ADD CONSTRAINT "rule_extraction_logs_rule_fragment_id_rule_fragments_id_fk" FOREIGN KEY ("rule_fragment_id") REFERENCES "public"."rule_fragments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_extraction_logs" ADD CONSTRAINT "rule_extraction_logs_formal_rule_id_formal_rules_id_fk" FOREIGN KEY ("formal_rule_id") REFERENCES "public"."formal_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_fragments" ADD CONSTRAINT "rule_fragments_statutory_source_id_statutory_sources_id_fk" FOREIGN KEY ("statutory_source_id") REFERENCES "public"."statutory_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_fragments" ADD CONSTRAINT "rule_fragments_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solver_runs" ADD CONSTRAINT "solver_runs_case_id_client_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solver_runs" ADD CONSTRAINT "solver_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "violation_traces" ADD CONSTRAINT "violation_traces_solver_run_id_solver_runs_id_fk" FOREIGN KEY ("solver_run_id") REFERENCES "public"."solver_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "violation_traces" ADD CONSTRAINT "violation_traces_case_id_client_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."client_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "violation_traces" ADD CONSTRAINT "violation_traces_formal_rule_id_formal_rules_id_fk" FOREIGN KEY ("formal_rule_id") REFERENCES "public"."formal_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "violation_traces" ADD CONSTRAINT "violation_traces_statutory_source_id_statutory_sources_id_fk" FOREIGN KEY ("statutory_source_id") REFERENCES "public"."statutory_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_assertions_case_id_idx" ON "case_assertions" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "case_assertions_state_code_idx" ON "case_assertions" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "case_assertions_program_code_idx" ON "case_assertions" USING btree ("program_code");--> statement-breakpoint
CREATE INDEX "case_assertions_assertion_type_idx" ON "case_assertions" USING btree ("assertion_type");--> statement-breakpoint
CREATE INDEX "case_assertions_predicate_name_idx" ON "case_assertions" USING btree ("predicate_name");--> statement-breakpoint
CREATE INDEX "case_assertions_tenant_id_idx" ON "case_assertions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "explanation_clauses_case_id_idx" ON "explanation_clauses" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "explanation_clauses_eligibility_calc_idx" ON "explanation_clauses" USING btree ("eligibility_calculation_id");--> statement-breakpoint
CREATE INDEX "explanation_clauses_verification_result_idx" ON "explanation_clauses" USING btree ("verification_result");--> statement-breakpoint
CREATE INDEX "explanation_clauses_explanation_type_idx" ON "explanation_clauses" USING btree ("explanation_type");--> statement-breakpoint
CREATE INDEX "formal_rules_state_code_idx" ON "formal_rules" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "formal_rules_program_code_idx" ON "formal_rules" USING btree ("program_code");--> statement-breakpoint
CREATE INDEX "formal_rules_eligibility_domain_idx" ON "formal_rules" USING btree ("eligibility_domain");--> statement-breakpoint
CREATE INDEX "formal_rules_status_idx" ON "formal_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "formal_rules_is_valid_idx" ON "formal_rules" USING btree ("is_valid");--> statement-breakpoint
CREATE INDEX "formal_rules_state_program_idx" ON "formal_rules" USING btree ("state_code","program_code");--> statement-breakpoint
CREATE INDEX "ontology_relationships_from_term_idx" ON "ontology_relationships" USING btree ("from_term_id");--> statement-breakpoint
CREATE INDEX "ontology_relationships_to_term_idx" ON "ontology_relationships" USING btree ("to_term_id");--> statement-breakpoint
CREATE INDEX "ontology_relationships_type_idx" ON "ontology_relationships" USING btree ("relationship_type");--> statement-breakpoint
CREATE INDEX "ontology_terms_state_code_idx" ON "ontology_terms" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "ontology_terms_program_code_idx" ON "ontology_terms" USING btree ("program_code");--> statement-breakpoint
CREATE INDEX "ontology_terms_domain_idx" ON "ontology_terms" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "ontology_terms_canonical_name_idx" ON "ontology_terms" USING btree ("canonical_name");--> statement-breakpoint
CREATE INDEX "ontology_terms_parent_term_idx" ON "ontology_terms" USING btree ("parent_term_id");--> statement-breakpoint
CREATE INDEX "ontology_terms_is_active_idx" ON "ontology_terms" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ontology_terms_state_program_idx" ON "ontology_terms" USING btree ("state_code","program_code");--> statement-breakpoint
CREATE INDEX "rule_extraction_logs_rule_fragment_idx" ON "rule_extraction_logs" USING btree ("rule_fragment_id");--> statement-breakpoint
CREATE INDEX "rule_extraction_logs_model_idx" ON "rule_extraction_logs" USING btree ("extraction_model");--> statement-breakpoint
CREATE INDEX "rule_extraction_logs_strategy_idx" ON "rule_extraction_logs" USING btree ("prompt_strategy");--> statement-breakpoint
CREATE INDEX "rule_extraction_logs_success_idx" ON "rule_extraction_logs" USING btree ("is_success");--> statement-breakpoint
CREATE INDEX "rule_fragments_statutory_source_idx" ON "rule_fragments" USING btree ("statutory_source_id");--> statement-breakpoint
CREATE INDEX "rule_fragments_eligibility_domain_idx" ON "rule_fragments" USING btree ("eligibility_domain");--> statement-breakpoint
CREATE INDEX "rule_fragments_rule_type_idx" ON "rule_fragments" USING btree ("rule_type");--> statement-breakpoint
CREATE INDEX "rule_fragments_needs_review_idx" ON "rule_fragments" USING btree ("needs_review");--> statement-breakpoint
CREATE INDEX "solver_runs_case_id_idx" ON "solver_runs" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "solver_runs_state_code_idx" ON "solver_runs" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "solver_runs_program_code_idx" ON "solver_runs" USING btree ("program_code");--> statement-breakpoint
CREATE INDEX "solver_runs_solver_result_idx" ON "solver_runs" USING btree ("solver_result");--> statement-breakpoint
CREATE INDEX "solver_runs_is_satisfied_idx" ON "solver_runs" USING btree ("is_satisfied");--> statement-breakpoint
CREATE INDEX "solver_runs_triggered_by_idx" ON "solver_runs" USING btree ("triggered_by");--> statement-breakpoint
CREATE INDEX "solver_runs_tenant_id_idx" ON "solver_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "solver_runs_created_at_idx" ON "solver_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "statutory_sources_state_code_idx" ON "statutory_sources" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "statutory_sources_program_code_idx" ON "statutory_sources" USING btree ("program_code");--> statement-breakpoint
CREATE INDEX "statutory_sources_citation_idx" ON "statutory_sources" USING btree ("citation");--> statement-breakpoint
CREATE INDEX "statutory_sources_effective_date_idx" ON "statutory_sources" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "statutory_sources_is_active_idx" ON "statutory_sources" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "violation_traces_solver_run_idx" ON "violation_traces" USING btree ("solver_run_id");--> statement-breakpoint
CREATE INDEX "violation_traces_case_id_idx" ON "violation_traces" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "violation_traces_formal_rule_idx" ON "violation_traces" USING btree ("formal_rule_id");--> statement-breakpoint
CREATE INDEX "violation_traces_eligibility_domain_idx" ON "violation_traces" USING btree ("eligibility_domain");--> statement-breakpoint
CREATE INDEX "violation_traces_violation_type_idx" ON "violation_traces" USING btree ("violation_type");--> statement-breakpoint
CREATE INDEX "violation_traces_severity_level_idx" ON "violation_traces" USING btree ("severity_level");