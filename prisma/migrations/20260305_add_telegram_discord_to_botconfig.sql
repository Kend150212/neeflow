-- Migration: Add Telegram & Discord notification fields to bot_configs
-- Created: 2026-03-05

ALTER TABLE "bot_configs"
  ADD COLUMN IF NOT EXISTS "telegram_enabled"   BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "telegram_bot_token" TEXT,
  ADD COLUMN IF NOT EXISTS "telegram_chat_id"   TEXT,
  ADD COLUMN IF NOT EXISTS "telegram_events"    JSONB     DEFAULT '["escalation","stale"]',
  ADD COLUMN IF NOT EXISTS "discord_enabled"    BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "discord_webhook_url" TEXT,
  ADD COLUMN IF NOT EXISTS "discord_events"     JSONB     DEFAULT '["escalation","stale"]';
