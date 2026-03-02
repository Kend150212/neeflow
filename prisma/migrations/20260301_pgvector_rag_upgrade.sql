-- Migration: Enable pgvector extension and migrate embedding columns from JSON to vector type
-- Run this on the PostgreSQL server BEFORE running prisma migrate deploy
-- Prereq: CREATE EXTENSION IF NOT EXISTS vector; (must be done by superuser)

-- Step 1: Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Migrate knowledge_bases embedding column from JSON to vector(1536)
-- Existing JSON arrays like [0.1, -0.2, ...] are cast to native vector type
ALTER TABLE "knowledge_bases"
    ALTER COLUMN "embedding" TYPE vector(1536)
    USING CASE
        WHEN "embedding" IS NULL THEN NULL
        ELSE "embedding"::text::vector(1536)
    END;

-- Step 3: Migrate product_catalogs embedding column from JSON to vector(1536)
ALTER TABLE "product_catalogs"
    ALTER COLUMN "embedding" TYPE vector(1536)
    USING CASE
        WHEN "embedding" IS NULL THEN NULL
        ELSE "embedding"::text::vector(1536)
    END;

-- Step 4: Create HNSW indexes for fast approximate nearest neighbor search
-- HNSW is better than ivfflat for small-medium datasets and doesn't need training
CREATE INDEX IF NOT EXISTS "knowledge_base_embedding_idx"
    ON "knowledge_bases" USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "product_catalog_embedding_idx"
    ON "product_catalogs" USING hnsw ("embedding" vector_cosine_ops);

-- Step 5: Add tsvector columns for full-text search (hybrid search fallback)
ALTER TABLE "knowledge_bases"
    ADD COLUMN IF NOT EXISTS "search_vector" tsvector
    GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
    ) STORED;

ALTER TABLE "product_catalogs"
    ADD COLUMN IF NOT EXISTS "search_vector" tsvector
    GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))
    ) STORED;

CREATE INDEX IF NOT EXISTS "knowledge_base_search_vector_idx"
    ON "knowledge_bases" USING GIN ("search_vector");

CREATE INDEX IF NOT EXISTS "product_catalog_search_vector_idx"
    ON "product_catalogs" USING GIN ("search_vector");
