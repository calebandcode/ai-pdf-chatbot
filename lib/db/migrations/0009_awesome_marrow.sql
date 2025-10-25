DO $$ BEGIN
 ALTER TABLE "document_summaries" ADD COLUMN "main_topics" jsonb;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;