CREATE TYPE "public"."assignment_role" AS ENUM('coordinator', 'member');--> statement-breakpoint
CREATE TYPE "public"."offering_status" AS ENUM('draft', 'open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."term_kind" AS ENUM('ganjil', 'genap', 'pendek');--> statement-breakpoint
CREATE TYPE "public"."term_status" AS ENUM('planned', 'active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."import_batch_status" AS ENUM('uploaded', 'mapped', 'validated', 'committed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."import_issue_severity" AS ENUM('error', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."import_sheet_status" AS ENUM('pending', 'ready', 'excluded', 'committed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."import_strategy" AS ENUM('upsert', 'validate_only', 'insert_missing');--> statement-breakpoint
CREATE TYPE "public"."name_conflict_status" AS ENUM('open', 'kept_master', 'accepted_source');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'dropped', 'completed');--> statement-breakpoint
CREATE TYPE "public"."aggregation_method" AS ENUM('not_configured', 'simple_mean', 'credit_weighted_mean');--> statement-breakpoint
CREATE TYPE "public"."policy_status" AS ENUM('draft', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."component_type" AS ENUM('uts', 'uas', 'tugas', 'kuis', 'proyek', 'praktikum', 'kehadiran', 'softskill', 'lainnya');--> statement-breakpoint
CREATE TYPE "public"."score_change_type" AS ENUM('import_initial', 'import_update', 'manual_correction');--> statement-breakpoint
CREATE TYPE "public"."result_completeness" AS ENUM('complete', 'incomplete', 'not_configured');--> statement-breakpoint
CREATE TYPE "public"."result_source" AS ENUM('calculated', 'imported_reference', 'manual_approved');--> statement-breakpoint
CREATE TYPE "public"."cqi_action_status" AS ENUM('planned', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."cqi_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."cqi_status" AS ENUM('open', 'analysis', 'planned', 'in_progress', 'evaluating', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"must_change_password" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lecturers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"lecturer_code" text,
	"nidn" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lecturers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "lecturers_lecturer_code_unique" UNIQUE("lecturer_code"),
	CONSTRAINT "lecturers_nidn_unique" UNIQUE("nidn")
);
--> statement-breakpoint
CREATE TABLE "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"start_year" integer NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_years_code_unique" UNIQUE("code"),
	CONSTRAINT "academic_years_start_year_range" CHECK ("academic_years"."start_year" between 2000 and 2100)
);
--> statement-breakpoint
CREATE TABLE "course_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"semester_id" uuid NOT NULL,
	"section" text DEFAULT 'A' NOT NULL,
	"status" "offering_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_offerings_course_semester_section_unique" UNIQUE("course_id","semester_id","section"),
	CONSTRAINT "course_offerings_section_normalized" CHECK ("course_offerings"."section" = upper(btrim("course_offerings"."section")) and length("course_offerings"."section") > 0)
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"credits" integer NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_code_unique" UNIQUE("code"),
	CONSTRAINT "courses_code_normalized" CHECK ("courses"."code" = upper(btrim("courses"."code")) and length("courses"."code") > 0),
	CONSTRAINT "courses_credits_range" CHECK ("courses"."credits" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "lecturer_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_id" uuid NOT NULL,
	"lecturer_id" uuid NOT NULL,
	"role" "assignment_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lecturer_assignments_unique" UNIQUE("offering_id","lecturer_id")
);
--> statement-breakpoint
CREATE TABLE "semesters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"term" "term_kind" NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "term_status" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "semesters_year_term_unique" UNIQUE("academic_year_id","term"),
	CONSTRAINT "semesters_date_order" CHECK ("semesters"."end_date" >= "semesters"."start_date")
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_sha256" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_kind" text NOT NULL,
	"status" "import_batch_status" DEFAULT 'uploaded' NOT NULL,
	"strategy" "import_strategy" DEFAULT 'upsert' NOT NULL,
	"duplicate_of_batch_id" uuid,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"warning_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"students_inserted" integer DEFAULT 0 NOT NULL,
	"students_reused" integer DEFAULT 0 NOT NULL,
	"enrollments_inserted" integer DEFAULT 0 NOT NULL,
	"enrollments_existing" integer DEFAULT 0 NOT NULL,
	"scores_inserted" integer DEFAULT 0 NOT NULL,
	"scores_updated" integer DEFAULT 0 NOT NULL,
	"scores_unchanged" integer DEFAULT 0 NOT NULL,
	"references_written" integer DEFAULT 0 NOT NULL,
	"summary" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_mapping_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"name" text NOT NULL,
	"mapping" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_mapping_presets_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "import_row_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"sheet_name" text NOT NULL,
	"row_number" integer,
	"column_ref" text,
	"field" text,
	"severity" "import_issue_severity" NOT NULL,
	"code" text NOT NULL,
	"message" text NOT NULL,
	"action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_sheet_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"sheet_name" text NOT NULL,
	"offering_id" uuid,
	"header_row" integer,
	"fingerprint" text NOT NULL,
	"mapping" jsonb NOT NULL,
	"include" boolean DEFAULT true NOT NULL,
	"status" "import_sheet_status" DEFAULT 'pending' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"acknowledgements" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_sheet_mappings_batch_sheet_unique" UNIQUE("batch_id","sheet_name")
);
--> statement-breakpoint
CREATE TABLE "import_staged_files" (
	"batch_id" uuid PRIMARY KEY NOT NULL,
	"content" "bytea" NOT NULL,
	"content_type" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_name_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"sheet_name" text NOT NULL,
	"row_number" integer NOT NULL,
	"master_name" text NOT NULL,
	"source_name" text NOT NULL,
	"status" "name_conflict_status" DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_name_conflicts_unique" UNIQUE("student_id","batch_id","sheet_name","row_number")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nim" text NOT NULL,
	"name" text NOT NULL,
	"cohort_year" integer,
	"created_by_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_nim_unique" UNIQUE("nim"),
	CONSTRAINT "students_nim_digits" CHECK ("students"."nim" ~ '^[0-9]{6,15}$'),
	CONSTRAINT "students_name_not_blank" CHECK (length(btrim("students"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"offering_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"source_batch_id" uuid,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_student_offering_unique" UNIQUE("student_id","offering_id")
);
--> statement-breakpoint
CREATE TABLE "course_cpl_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"cpl_id" uuid NOT NULL,
	"contribution" numeric(7, 4),
	"approval_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_cpl_mappings_unique" UNIQUE("course_id","cpl_id")
);
--> statement-breakpoint
CREATE TABLE "cpl_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cpl_definitions_code_unique" UNIQUE("code"),
	CONSTRAINT "cpl_definitions_code_format" CHECK ("cpl_definitions"."code" ~ '^CPL-[0-9]+$')
);
--> statement-breakpoint
CREATE TABLE "cpl_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"cpl_id" uuid NOT NULL,
	"target" numeric(7, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cpl_targets_unique" UNIQUE("policy_id","cpl_id"),
	CONSTRAINT "cpl_targets_non_negative" CHECK ("cpl_targets"."target" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cpmk_cpl_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cpmk_id" uuid NOT NULL,
	"cpl_id" uuid NOT NULL,
	"weight" numeric(9, 4) NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cpmk_cpl_mappings_unique" UNIQUE("cpmk_id","cpl_id"),
	CONSTRAINT "cpmk_cpl_mappings_positive" CHECK ("cpmk_cpl_mappings"."weight" > 0)
);
--> statement-breakpoint
CREATE TABLE "cpmk_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"taxonomy_level" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cpmk_definitions_course_code_unique" UNIQUE("course_id","code"),
	CONSTRAINT "cpmk_definitions_code_format" CHECK ("cpmk_definitions"."code" ~ '^CPMK-[0-9]+$')
);
--> statement-breakpoint
CREATE TABLE "outcome_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"status" "policy_status" DEFAULT 'draft' NOT NULL,
	"scale_max" numeric(7, 2) DEFAULT 100 NOT NULL,
	"achievement_threshold" numeric(7, 2),
	"class_achievement_ratio" numeric(5, 2),
	"weight_tolerance" numeric(6, 4) DEFAULT 0.01 NOT NULL,
	"aggregation_method" "aggregation_method" DEFAULT 'not_configured' NOT NULL,
	"formula_version" text DEFAULT 'v1' NOT NULL,
	"notes" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"effective_from" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outcome_policies_version_unique" UNIQUE("version"),
	CONSTRAINT "outcome_policies_ratio_range" CHECK ("outcome_policies"."class_achievement_ratio" is null or "outcome_policies"."class_achievement_ratio" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "assessment_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "component_type" DEFAULT 'lainnya' NOT NULL,
	"weight_percent" numeric(7, 4),
	"max_score" numeric(9, 4) DEFAULT 100 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"source_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_components_offering_code_unique" UNIQUE("offering_id","code"),
	CONSTRAINT "assessment_components_weight_range" CHECK ("assessment_components"."weight_percent" is null or "assessment_components"."weight_percent" between 0 and 100),
	CONSTRAINT "assessment_components_max_positive" CHECK ("assessment_components"."max_score" > 0)
);
--> statement-breakpoint
CREATE TABLE "assessment_cpmk_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"cpmk_id" uuid NOT NULL,
	"coefficient" numeric(9, 4) DEFAULT 1 NOT NULL,
	"approved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_cpmk_mappings_unique" UNIQUE("component_id","cpmk_id"),
	CONSTRAINT "assessment_cpmk_mappings_positive" CHECK ("assessment_cpmk_mappings"."coefficient" > 0)
);
--> statement-breakpoint
CREATE TABLE "assessment_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"old_score" numeric(9, 4),
	"new_score" numeric(9, 4),
	"change_type" "score_change_type" NOT NULL,
	"batch_id" uuid,
	"actor_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"score" numeric(9, 4),
	"source_batch_id" uuid,
	"source_sheet" text,
	"source_row" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_scores_enrollment_component_unique" UNIQUE("enrollment_id","component_id"),
	CONSTRAINT "assessment_scores_non_negative" CHECK ("assessment_scores"."score" is null or "assessment_scores"."score" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cpl_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"cpl_id" uuid NOT NULL,
	"source" "result_source" NOT NULL,
	"value" numeric(9, 4),
	"completeness" "result_completeness" NOT NULL,
	"coverage" numeric(5, 4),
	"formula_version" text,
	"policy_id" uuid,
	"run_id" uuid,
	"batch_id" uuid,
	"inputs" jsonb,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cpl_results_unique" UNIQUE("enrollment_id","cpl_id","source")
);
--> statement-breakpoint
CREATE TABLE "cpmk_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"cpmk_id" uuid NOT NULL,
	"source" "result_source" NOT NULL,
	"value" numeric(9, 4),
	"completeness" "result_completeness" NOT NULL,
	"formula_version" text,
	"policy_id" uuid,
	"run_id" uuid,
	"batch_id" uuid,
	"inputs" jsonb,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cpmk_results_unique" UNIQUE("enrollment_id","cpmk_id","source")
);
--> statement-breakpoint
CREATE TABLE "outcome_calculation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid,
	"offering_id" uuid,
	"trigger" text NOT NULL,
	"formula_version" text NOT NULL,
	"enrollments_processed" integer DEFAULT 0 NOT NULL,
	"summary" jsonb,
	"actor_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"summary" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cqi_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"description" text NOT NULL,
	"pic_user_id" text NOT NULL,
	"due_date" date NOT NULL,
	"status" "cqi_action_status" DEFAULT 'planned' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cqi_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"metric_label" text NOT NULL,
	"value_before" numeric(9, 4),
	"value_after" numeric(9, 4),
	"conclusion" text NOT NULL,
	"evaluated_by" text NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cqi_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"action_id" uuid,
	"title" text NOT NULL,
	"url" text,
	"note" text,
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cqi_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"priority" "cqi_priority" DEFAULT 'medium' NOT NULL,
	"status" "cqi_status" DEFAULT 'open' NOT NULL,
	"semester_id" uuid,
	"offering_id" uuid,
	"cpl_id" uuid,
	"cpmk_id" uuid,
	"root_cause" text,
	"created_by" text NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cqi_findings_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecturers" ADD CONSTRAINT "lecturers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecturer_assignments" ADD CONSTRAINT "lecturer_assignments_offering_id_course_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecturer_assignments" ADD CONSTRAINT "lecturer_assignments_lecturer_id_lecturers_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."lecturers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_mapping_presets" ADD CONSTRAINT "import_mapping_presets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_row_issues" ADD CONSTRAINT "import_row_issues_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_sheet_mappings" ADD CONSTRAINT "import_sheet_mappings_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_sheet_mappings" ADD CONSTRAINT "import_sheet_mappings_offering_id_course_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_staged_files" ADD CONSTRAINT "import_staged_files_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_name_conflicts" ADD CONSTRAINT "student_name_conflicts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_name_conflicts" ADD CONSTRAINT "student_name_conflicts_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_name_conflicts" ADD CONSTRAINT "student_name_conflicts_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_created_by_batch_id_import_batches_id_fk" FOREIGN KEY ("created_by_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_offering_id_course_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_source_batch_id_import_batches_id_fk" FOREIGN KEY ("source_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_cpl_mappings" ADD CONSTRAINT "course_cpl_mappings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_cpl_mappings" ADD CONSTRAINT "course_cpl_mappings_cpl_id_cpl_definitions_id_fk" FOREIGN KEY ("cpl_id") REFERENCES "public"."cpl_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpl_targets" ADD CONSTRAINT "cpl_targets_policy_id_outcome_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."outcome_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpl_targets" ADD CONSTRAINT "cpl_targets_cpl_id_cpl_definitions_id_fk" FOREIGN KEY ("cpl_id") REFERENCES "public"."cpl_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpmk_cpl_mappings" ADD CONSTRAINT "cpmk_cpl_mappings_cpmk_id_cpmk_definitions_id_fk" FOREIGN KEY ("cpmk_id") REFERENCES "public"."cpmk_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpmk_cpl_mappings" ADD CONSTRAINT "cpmk_cpl_mappings_cpl_id_cpl_definitions_id_fk" FOREIGN KEY ("cpl_id") REFERENCES "public"."cpl_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpmk_cpl_mappings" ADD CONSTRAINT "cpmk_cpl_mappings_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpmk_definitions" ADD CONSTRAINT "cpmk_definitions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_policies" ADD CONSTRAINT "outcome_policies_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_components" ADD CONSTRAINT "assessment_components_offering_id_course_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_cpmk_mappings" ADD CONSTRAINT "assessment_cpmk_mappings_cpmk_id_cpmk_definitions_id_fk" FOREIGN KEY ("cpmk_id") REFERENCES "public"."cpmk_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_cpmk_mappings" ADD CONSTRAINT "assessment_cpmk_mappings_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_cpmk_mappings" ADD CONSTRAINT "assessment_cpmk_mappings_component_fk" FOREIGN KEY ("component_id") REFERENCES "public"."assessment_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_revisions" ADD CONSTRAINT "assessment_revisions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_revisions" ADD CONSTRAINT "assessment_revisions_component_id_assessment_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."assessment_components"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_revisions" ADD CONSTRAINT "assessment_revisions_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_revisions" ADD CONSTRAINT "assessment_revisions_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_component_id_assessment_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."assessment_components"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_source_batch_id_import_batches_id_fk" FOREIGN KEY ("source_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpl_results" ADD CONSTRAINT "cpl_results_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpl_results" ADD CONSTRAINT "cpl_results_cpl_id_cpl_definitions_id_fk" FOREIGN KEY ("cpl_id") REFERENCES "public"."cpl_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpl_results" ADD CONSTRAINT "cpl_results_policy_id_outcome_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."outcome_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpl_results" ADD CONSTRAINT "cpl_results_run_id_outcome_calculation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."outcome_calculation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpl_results" ADD CONSTRAINT "cpl_results_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpmk_results" ADD CONSTRAINT "cpmk_results_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpmk_results" ADD CONSTRAINT "cpmk_results_cpmk_id_cpmk_definitions_id_fk" FOREIGN KEY ("cpmk_id") REFERENCES "public"."cpmk_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpmk_results" ADD CONSTRAINT "cpmk_results_policy_id_outcome_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."outcome_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpmk_results" ADD CONSTRAINT "cpmk_results_run_id_outcome_calculation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."outcome_calculation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpmk_results" ADD CONSTRAINT "cpmk_results_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_calculation_runs" ADD CONSTRAINT "outcome_calculation_runs_policy_id_outcome_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."outcome_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_calculation_runs" ADD CONSTRAINT "outcome_calculation_runs_offering_id_course_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_calculation_runs" ADD CONSTRAINT "outcome_calculation_runs_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cqi_actions" ADD CONSTRAINT "cqi_actions_finding_id_cqi_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."cqi_findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cqi_actions" ADD CONSTRAINT "cqi_actions_pic_user_id_user_id_fk" FOREIGN KEY ("pic_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cqi_evaluations" ADD CONSTRAINT "cqi_evaluations_finding_id_cqi_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."cqi_findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cqi_evaluations" ADD CONSTRAINT "cqi_evaluations_evaluated_by_user_id_fk" FOREIGN KEY ("evaluated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cqi_evidence" ADD CONSTRAINT "cqi_evidence_finding_id_cqi_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."cqi_findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cqi_evidence" ADD CONSTRAINT "cqi_evidence_action_id_cqi_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."cqi_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cqi_evidence" ADD CONSTRAINT "cqi_evidence_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cqi_findings" ADD CONSTRAINT "cqi_findings_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cqi_findings" ADD CONSTRAINT "cqi_findings_offering_id_course_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cqi_findings" ADD CONSTRAINT "cqi_findings_cpl_id_cpl_definitions_id_fk" FOREIGN KEY ("cpl_id") REFERENCES "public"."cpl_definitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cqi_findings" ADD CONSTRAINT "cqi_findings_cpmk_id_cpmk_definitions_id_fk" FOREIGN KEY ("cpmk_id") REFERENCES "public"."cpmk_definitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cqi_findings" ADD CONSTRAINT "cqi_findings_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_single_active" ON "academic_years" USING btree ("is_active") WHERE "academic_years"."is_active" = true;--> statement-breakpoint
CREATE INDEX "course_offerings_semester_idx" ON "course_offerings" USING btree ("semester_id");--> statement-breakpoint
CREATE INDEX "lecturer_assignments_lecturer_idx" ON "lecturer_assignments" USING btree ("lecturer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "semesters_single_active" ON "semesters" USING btree ("status") WHERE "semesters"."status" = 'active';--> statement-breakpoint
CREATE INDEX "import_batches_sha_idx" ON "import_batches" USING btree ("file_sha256");--> statement-breakpoint
CREATE INDEX "import_batches_uploader_idx" ON "import_batches" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "import_batches_status_idx" ON "import_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_row_issues_batch_severity_idx" ON "import_row_issues" USING btree ("batch_id","severity");--> statement-breakpoint
CREATE INDEX "import_sheet_mappings_offering_idx" ON "import_sheet_mappings" USING btree ("offering_id");--> statement-breakpoint
CREATE INDEX "student_name_conflicts_status_idx" ON "student_name_conflicts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "students_name_idx" ON "students" USING btree ("name");--> statement-breakpoint
CREATE INDEX "students_cohort_idx" ON "students" USING btree ("cohort_year");--> statement-breakpoint
CREATE INDEX "enrollments_offering_idx" ON "enrollments" USING btree ("offering_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outcome_policies_single_active" ON "outcome_policies" USING btree ("status") WHERE "outcome_policies"."status" = 'active';--> statement-breakpoint
CREATE INDEX "assessment_revisions_lookup_idx" ON "assessment_revisions" USING btree ("enrollment_id","component_id","created_at");--> statement-breakpoint
CREATE INDEX "assessment_revisions_batch_idx" ON "assessment_revisions" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "assessment_scores_component_idx" ON "assessment_scores" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "cpl_results_cpl_idx" ON "cpl_results" USING btree ("cpl_id");--> statement-breakpoint
CREATE INDEX "cpmk_results_cpmk_idx" ON "cpmk_results" USING btree ("cpmk_id");--> statement-breakpoint
CREATE INDEX "outcome_calculation_runs_offering_idx" ON "outcome_calculation_runs" USING btree ("offering_id","started_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cqi_actions_finding_idx" ON "cqi_actions" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "cqi_actions_due_idx" ON "cqi_actions" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "cqi_findings_status_idx" ON "cqi_findings" USING btree ("status","priority");