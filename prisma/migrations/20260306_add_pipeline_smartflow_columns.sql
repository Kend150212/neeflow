-- Migration: Add SmartFlow pipeline columns to the channel table
-- Date: 2026-03-06
-- These columns support the SmartFlow auto-publishing pipeline feature.

ALTER TABLE "Channel"
    ADD COLUMN IF NOT EXISTS pipeline_enabled       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS pipeline_frequency     TEXT    NOT NULL DEFAULT '1_per_day',
    ADD COLUMN IF NOT EXISTS pipeline_approval_mode TEXT    NOT NULL DEFAULT 'admin',
    ADD COLUMN IF NOT EXISTS pipeline_posting_times JSONB            DEFAULT '["19:00"]',
    ADD COLUMN IF NOT EXISTS smartflow_sources      JSONB            DEFAULT '{}';
