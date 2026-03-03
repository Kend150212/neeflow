-- Add avatar_url column to channel_platforms
ALTER TABLE channel_platforms ADD COLUMN IF NOT EXISTS avatar_url TEXT;
