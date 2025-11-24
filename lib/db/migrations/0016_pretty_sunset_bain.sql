CREATE TABLE IF NOT EXISTS "notebook_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"block_type" varchar(50) NOT NULL,
	"block_order" integer DEFAULT 0 NOT NULL,
	"block_data" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE IF NOT EXISTS "topic_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"topic_id" varchar(255) NOT NULL,
	"topic_title" text NOT NULL,
	"topic_description" text,
	"embedding" vector(1536),
	"topic_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "difficultyLevel" varchar DEFAULT 'university' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notebook_blocks" ADD CONSTRAINT "notebook_blocks_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
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
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "topic_embeddings" ADD CONSTRAINT "topic_embeddings_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notebook_blocks_chat_id_idx" ON "notebook_blocks" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notebook_blocks_block_order_idx" ON "notebook_blocks" USING btree ("chat_id","block_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_blocks_chat_id_idx" ON "saved_blocks" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_blocks_topic_idx" ON "saved_blocks" USING btree ("chat_id","topic_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_blocks_message_id_idx" ON "saved_blocks" USING btree ("source_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_chat_topic" ON "topic_embeddings" USING btree ("chat_id","topic_id");