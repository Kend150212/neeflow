-- Add avatar_url column to Channel table
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
