-- Migration: add channel_id to external_db_configs for per-channel isolation
-- Each channel now has its own independent External DB configuration.

-- 1. Add channel_id column (nullable first so existing rows don't fail)
ALTER TABLE external_db_configs ADD COLUMN IF NOT EXISTS channel_id VARCHAR(191);

-- 2. Backfill: assign the first channel the user owns/admins (no created_at needed)
UPDATE external_db_configs edc
SET channel_id = (
    SELECT cm.channel_id
    FROM channel_members cm
    WHERE cm.user_id = edc.user_id
      AND cm.role IN ('OWNER', 'ADMIN')
    LIMIT 1
)
WHERE edc.channel_id IS NULL;

-- 2b. Fallback: if still NULL, use ANY channel the user is a member of
UPDATE external_db_configs edc
SET channel_id = (
    SELECT cm.channel_id
    FROM channel_members cm
    WHERE cm.user_id = edc.user_id
    LIMIT 1
)
WHERE edc.channel_id IS NULL;

-- 3. Delete rows that still have no channel (orphaned configs)
DELETE FROM external_db_configs WHERE channel_id IS NULL;

-- 4. Make column NOT NULL now that it's backfilled
ALTER TABLE external_db_configs ALTER COLUMN channel_id SET NOT NULL;

-- 5. Add foreign key to channels table
ALTER TABLE external_db_configs
    ADD CONSTRAINT IF NOT EXISTS fk_external_db_configs_channel
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

-- 6. Add unique constraint: one config per (user, channel)
ALTER TABLE external_db_configs
    ADD CONSTRAINT IF NOT EXISTS uq_external_db_config_user_channel
    UNIQUE (user_id, channel_id);

-- 7. Add index on channel_id
CREATE INDEX IF NOT EXISTS idx_external_db_configs_channel_id ON external_db_configs(channel_id);
