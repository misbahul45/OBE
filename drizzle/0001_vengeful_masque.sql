CREATE TABLE "career_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_fields_code_unique" UNIQUE("code"),
	CONSTRAINT "career_fields_code_format" CHECK ("career_fields"."code" ~ '^BK[0-9]+$')
);
--> statement-breakpoint
CREATE TABLE "cpl_profile_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cpl_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cpl_profile_links_pair" UNIQUE("cpl_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "graduate_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"credit_estimate" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graduate_profiles_code_unique" UNIQUE("code"),
	CONSTRAINT "graduate_profiles_code_format" CHECK ("graduate_profiles"."code" ~ '^PL[0-9]+$')
);
--> statement-breakpoint
CREATE TABLE "profile_career_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"career_field_id" uuid NOT NULL,
	"relevance" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_career_links_pair" UNIQUE("profile_id","career_field_id"),
	CONSTRAINT "profile_career_links_relevance_range" CHECK ("profile_career_links"."relevance" between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "cpl_definitions" ADD COLUMN "graduate_attributes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "cpl_definitions" ADD COLUMN "knowledge_profiles" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "cpl_profile_links" ADD CONSTRAINT "cpl_profile_links_cpl_id_cpl_definitions_id_fk" FOREIGN KEY ("cpl_id") REFERENCES "public"."cpl_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpl_profile_links" ADD CONSTRAINT "cpl_profile_links_profile_id_graduate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."graduate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_career_links" ADD CONSTRAINT "profile_career_links_profile_id_graduate_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."graduate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_career_links" ADD CONSTRAINT "profile_career_links_career_field_id_career_fields_id_fk" FOREIGN KEY ("career_field_id") REFERENCES "public"."career_fields"("id") ON DELETE cascade ON UPDATE no action;