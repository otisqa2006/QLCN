-- ==========================================
-- QLCN Sprint 6: Schema Update V3 (Patch)
-- ==========================================
-- This patch adds the `notes` column to the `expenses` table
-- requested by the user for capturing transaction details.

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS notes TEXT;
