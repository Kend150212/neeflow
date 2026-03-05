-- Drop and recreate all Studio tables cleanly
DROP TABLE IF EXISTS "studio_outputs"       CASCADE;
DROP TABLE IF EXISTS "studio_jobs"          CASCADE;
DROP TABLE IF EXISTS "studio_workflows"     CASCADE;
DROP TABLE IF EXISTS "studio_projects"      CASCADE;
DROP TABLE IF EXISTS "studio_avatar_shares" CASCADE;
DROP TABLE IF EXISTS "studio_avatars"       CASCADE;

CREATE TABLE "studio_avatars" (
    "id"               TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id"          TEXT NOT NULL,
    "channel_id"       TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "description"      TEXT,
    "prompt"           TEXT NOT NULL DEFAULT '',
    "style"            TEXT NOT NULL DEFAULT 'realistic',
    "reference_images" JSONB NOT NULL DEFAULT '[]',
    "cover_image"      TEXT,
    "fal_job_id"       TEXT,
    "status"           TEXT NOT NULL DEFAULT 'idle',
    "is_active"        BOOLEAN NOT NULL DEFAULT true,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "studio_avatars_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "studio_avatars_user_id_idx"    ON "studio_avatars"("user_id");
CREATE INDEX "studio_avatars_channel_id_idx" ON "studio_avatars"("channel_id");

CREATE TABLE "studio_avatar_shares" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
    "avatar_id"  TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "studio_avatar_shares_pkey"                        PRIMARY KEY ("id"),
    CONSTRAINT "studio_avatar_shares_avatar_id_channel_id_key"    UNIQUE ("avatar_id", "channel_id")
);
CREATE INDEX "studio_avatar_shares_channel_id_idx" ON "studio_avatar_shares"("channel_id");

CREATE TABLE "studio_projects" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id"     TEXT NOT NULL,
    "channel_id"  TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "cover_image" TEXT,
    "status"      TEXT NOT NULL DEFAULT 'active',
    "last_run_at" TIMESTAMP(3),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "studio_projects_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "studio_projects_channel_id_idx" ON "studio_projects"("channel_id");
CREATE INDEX "studio_projects_user_id_idx"    ON "studio_projects"("user_id");

CREATE TABLE "studio_workflows" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
    "project_id" TEXT NOT NULL,
    "nodes_json" JSONB NOT NULL DEFAULT '[]',
    "edges_json" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "studio_workflows_pkey"           PRIMARY KEY ("id"),
    CONSTRAINT "studio_workflows_project_id_key" UNIQUE ("project_id")
);

CREATE TABLE "studio_jobs" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "project_id"  TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "provider"    TEXT NOT NULL DEFAULT 'fal_ai',
    "cost_usd"    DOUBLE PRECISION,
    "error"       TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "finished_at" TIMESTAMP(3),
    CONSTRAINT "studio_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "studio_jobs_project_id_idx" ON "studio_jobs"("project_id");

CREATE TABLE "studio_outputs" (
    "id"             TEXT NOT NULL DEFAULT gen_random_uuid(),
    "project_id"     TEXT NOT NULL,
    "job_id"         TEXT NOT NULL,
    "type"           TEXT NOT NULL DEFAULT 'image',
    "url"            TEXT NOT NULL,
    "thumbnail_url"  TEXT,
    "prompt"         TEXT,
    "metadata"       JSONB DEFAULT '{}',
    "pushed_to_post" BOOLEAN NOT NULL DEFAULT false,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "studio_outputs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "studio_outputs_project_id_idx" ON "studio_outputs"("project_id");
