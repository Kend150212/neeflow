-- Add product_url column to product_catalog
-- Migration: add_product_url
ALTER TABLE "product_catalog" ADD COLUMN IF NOT EXISTS "product_url" TEXT;
