CREATE TABLE IF NOT EXISTS "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"document_id" uuid,
	"title" text NOT NULL,
	"source_type" varchar DEFAULT 'pdf' NOT NULL,
	"source_url" text,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"type" varchar NOT NULL,
	"content" jsonb NOT NULL,
	"citation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"is_unlocked" boolean DEFAULT false NOT NULL,
	"slide_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_progress" (
	"user_id" text PRIMARY KEY NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"hearts" integer DEFAULT 5 NOT NULL,
	"streak_current" integer DEFAULT 0 NOT NULL,
	"streak_best" integer DEFAULT 0 NOT NULL,
	"last_played_date" timestamp with time zone,
	"unlocked_units" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "memory_stability" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "memory_difficulty" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "elapsed_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "scheduled_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "last_review" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "reps" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "state" integer DEFAULT 0;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "courses" ADD CONSTRAINT "courses_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_slides" ADD CONSTRAINT "unit_slides_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "units" ADD CONSTRAINT "units_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
