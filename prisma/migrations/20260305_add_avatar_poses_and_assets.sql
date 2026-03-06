-- Add studio_avatar_poses table
CREATE TABLE IF NOT EXISTS "studio_avatar_poses" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "avatar_id"  TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "images"     JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "studio_avatar_poses_avatar_id_fkey"
        FOREIGN KEY ("avatar_id") REFERENCES "studio_avatars"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "studio_avatar_poses_avatar_id_idx" ON "studio_avatar_poses"("avatar_id");

-- Add studio_avatar_assets table (outfit / accessory / prop — multi-image)
CREATE TABLE IF NOT EXISTS "studio_avatar_assets" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "avatar_id"  TEXT NOT NULL,
    "type"       TEXT NOT NULL DEFAULT 'outfit',
    "name"       TEXT NOT NULL,
    "images"     JSONB NOT NULL DEFAULT '[]',
    "prompt"     TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "studio_avatar_assets_avatar_id_fkey"
        FOREIGN KEY ("avatar_id") REFERENCES "studio_avatars"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "studio_avatar_assets_avatar_id_idx" ON "studio_avatar_assets"("avatar_id");
