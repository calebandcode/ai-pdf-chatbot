DO $$ BEGIN
 ALTER TABLE "Chat" ADD COLUMN "lastContext" jsonb;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;