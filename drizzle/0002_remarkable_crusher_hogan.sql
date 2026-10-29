CREATE TYPE "public"."tracer_keeratan" AS ENUM('sangat_erat', 'erat', 'cukup_erat', 'kurang_erat', 'tidak_sama_sekali');--> statement-breakpoint
CREATE TABLE "tracer_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"is_linear" boolean NOT NULL,
	"career_field_id" uuid,
	"keeratan" "tracer_keeratan",
	"note" text,
	"recorded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracer_records_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
ALTER TABLE "tracer_records" ADD CONSTRAINT "tracer_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracer_records" ADD CONSTRAINT "tracer_records_career_field_id_career_fields_id_fk" FOREIGN KEY ("career_field_id") REFERENCES "public"."career_fields"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracer_records" ADD CONSTRAINT "tracer_records_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;