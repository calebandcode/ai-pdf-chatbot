-- Create topic_embeddings table for vector similarity search
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
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_chat_topic" ON "topic_embeddings" ("chat_id","topic_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "topic_embeddings" ADD CONSTRAINT "topic_embeddings_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Create vector index for fast similarity search
CREATE INDEX IF NOT EXISTS topic_embeddings_embedding_idx ON topic_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);










