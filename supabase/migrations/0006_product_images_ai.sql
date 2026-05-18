-- ============================================================================
-- Migration 0006: AI suggestions on product images
-- Adds two columns to product_images for storing Claude vision output.
-- ============================================================================

-- 1. Columns -----------------------------------------------------------------
-- ai_suggestions stores the full Claude response payload as JSON. Shape:
--   {
--     "alt": "string",
--     "tags": ["string", ...],
--     "category_ids": ["uuid", ...],
--     "condition_observations": ["string", ...],
--     "model": "claude-sonnet-4-6",
--     "suggested_at": "2026-05-18T12:34:56Z"
--   }
-- The applied values live on the parent product (tags, categories) and on
-- the image row itself (alt_text). This column is purely the "what Claude
-- thought" record — useful for re-running, comparing, or auditing.

alter table product_images
  add column ai_suggestions   jsonb,
  add column ai_suggested_at  timestamptz;

-- 2. Index --------------------------------------------------------------------
-- We don't search inside the JSON, but we do filter by whether a row has
-- suggestions yet (for "needs review" lists). Partial index is cheap.

create index idx_product_images_ai_pending
  on product_images(product_id)
  where ai_suggestions is not null;

-- 3. Grants -------------------------------------------------------------------
-- product_images already had grants from migration 0002, but the new
-- columns inherit those — no extra grants needed. Just leave a note.

-- (no grants required: existing column-level inheritance covers the new columns)
