-- Add allowed_image_models column to plans table
-- JSON array of { provider, models[] } for per-plan image model whitelisting
-- null = all models allowed
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "allowed_image_models" JSONB;
