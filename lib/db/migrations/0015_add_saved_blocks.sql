-- Create saved_blocks table for user-curated notebook content
CREATE TABLE IF NOT EXISTS "saved_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"block_type" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"question" text,
	"answer" text,
	"topic_name" text,
	"subtopic_name" text,
	"source_message_id" uuid,
	"document_ids" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_blocks_chat_id_idx" ON "saved_blocks" ("chat_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_blocks_topic_idx" ON "saved_blocks" ("chat_id","topic_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_blocks_message_id_idx" ON "saved_blocks" ("source_message_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_blocks" ADD CONSTRAINT "saved_blocks_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_blocks" ADD CONSTRAINT "saved_blocks_source_message_id_Message_v2_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."Message_v2"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;




