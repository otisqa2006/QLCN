-- =====================================================
-- V13: Account Lock Feature
-- =====================================================

-- Add is_locked column to profiles
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

-- (Optional) Index for fast lookup on auth checks
CREATE INDEX IF NOT EXISTS idx_profiles_locked ON profiles(is_locked) WHERE is_locked = true;
