-- Migration: Add product_catalog table
-- Run: psql $DATABASE_URL -f this_file.sql

CREATE TABLE IF NOT EXISTS "product_catalog" (
    "id"          TEXT NOT NULL,
    "channel_id"  TEXT NOT NULL,
    "product_id"  TEXT,
    "name"        TEXT NOT NULL,
    "category"    TEXT,
    "price"       DOUBLE PRECISION,
    "sale_price"  DOUBLE PRECISION,
    "description" TEXT,
    "features"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "images"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "tags"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "in_stock"    BOOLEAN NOT NULL DEFAULT true,
    "sync_source" TEXT DEFAULT 'manual',
    "external_id" TEXT,
    "sheet_url"   TEXT,
    "synced_at"   TIMESTAMP(3),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_catalog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_catalog_channel_id_fkey"
        FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "product_catalog_channel_id_idx" ON "product_catalog"("channel_id");
CREATE INDEX IF NOT EXISTS "product_catalog_channel_id_in_stock_idx" ON "product_catalog"("channel_id", "in_stock");
