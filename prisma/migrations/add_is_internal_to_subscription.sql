-- Migration: add is_internal to subscriptions table
-- Run on server: psql -U postgres -d asocial -f this_file.sql

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN subscriptions.is_internal IS 'Mark as internal/test account — excluded from MRR and revenue reports';
