-- Create notebook_blocks table for BlockNote block persistence
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
CREATE INDEX IF NOT EXISTS "notebook_blocks_chat_id_idx" ON "notebook_blocks" ("chat_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notebook_blocks_block_order_idx" ON "notebook_blocks" ("chat_id","block_order");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notebook_blocks" ADD CONSTRAINT "notebook_blocks_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;









