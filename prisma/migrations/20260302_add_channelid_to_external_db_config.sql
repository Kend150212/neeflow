-- Migration: add channel_id to external_db_configs for per-channel isolation

-- 1. Add column (safe, idempotent)
ALTER TABLE external_db_configs ADD COLUMN IF NOT EXISTS channel_id VARCHAR(191);

-- 2. Backfill: assign first OWNER/ADMIN channel
UPDATE external_db_configs edc
SET channel_id = (
    SELECT cm.channel_id
    FROM channel_members cm
    WHERE cm.user_id = edc.user_id
      AND cm.role IN ('OWNER', 'ADMIN')
    LIMIT 1
)
WHERE edc.channel_id IS NULL;

-- 2b. Fallback: any channel the user belongs to
UPDATE external_db_configs edc
SET channel_id = (
    SELECT cm.channel_id
    FROM channel_members cm
    WHERE cm.user_id = edc.user_id
    LIMIT 1
)
WHERE edc.channel_id IS NULL;

-- 3. Remove orphaned rows
DELETE FROM external_db_configs WHERE channel_id IS NULL;

-- 4. Make NOT NULL
ALTER TABLE external_db_configs ALTER COLUMN channel_id SET NOT NULL;

-- 5. Foreign key (skip if already exists)
DO $$ BEGIN
    ALTER TABLE external_db_configs
        ADD CONSTRAINT fk_external_db_configs_channel
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Unique constraint (skip if already exists)
DO $$ BEGIN
    ALTER TABLE external_db_configs
        ADD CONSTRAINT uq_external_db_config_user_channel
        UNIQUE (user_id, channel_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Index
CREATE INDEX IF NOT EXISTS idx_external_db_configs_channel_id ON external_db_configs(channel_id);
