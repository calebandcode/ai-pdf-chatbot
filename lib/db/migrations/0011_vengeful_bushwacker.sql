CREATE TABLE IF NOT EXISTS "chat_contexts" (
	"chat_id" uuid PRIMARY KEY NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"global_summary" text DEFAULT '' NOT NULL,
	"global_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_contexts" ADD CONSTRAINT "chat_contexts_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
