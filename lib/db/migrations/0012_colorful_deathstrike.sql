-- Add new fields to chat_contexts table for intelligent merging
-- Use DO blocks to safely add columns only if they don't exist
DO $$ 
BEGIN
  -- Add relationships column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chat_contexts' AND column_name = 'relationships'
  ) THEN
    ALTER TABLE "chat_contexts" ADD COLUMN "relationships" jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add source_count column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chat_contexts' AND column_name = 'source_count'
  ) THEN
    ALTER TABLE "chat_contexts" ADD COLUMN "source_count" integer DEFAULT 0;
  END IF;

  -- Add last_summary_regeneration column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chat_contexts' AND column_name = 'last_summary_regeneration'
  ) THEN
    ALTER TABLE "chat_contexts" ADD COLUMN "last_summary_regeneration" timestamp with time zone;
  END IF;

  -- Add delta_summaries column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chat_contexts' AND column_name = 'delta_summaries'
  ) THEN
    ALTER TABLE "chat_contexts" ADD COLUMN "delta_summaries" jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;--> statement-breakpoint

-- Update source_count for existing records based on sources array length
-- This is a one-time data migration for existing chats
UPDATE "chat_contexts" 
SET "source_count" = jsonb_array_length("sources")
WHERE "source_count" = 0 AND jsonb_array_length("sources") > 0;