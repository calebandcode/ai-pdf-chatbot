ALTER TABLE "Document"
ADD COLUMN IF NOT EXISTS metadata jsonb;
