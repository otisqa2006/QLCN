-- ============================================================
-- PATCH v9b: Fix harvest_seasons RLS & ensure farm_id column
-- Run this in Supabase SQL Editor if season creation fails
-- ============================================================

-- 1. Ensure farm_id column exists on harvest_seasons
ALTER TABLE public.harvest_seasons
    ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE;

-- 2. Re-create correct RLS policies for harvest_seasons (safe drop-and-recreate)
DROP POLICY IF EXISTS "Users can view own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "Users can insert own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "Users can update own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "Users can delete own harvest_seasons" ON public.harvest_seasons;

-- Allow any authenticated user to manage their own seasons
CREATE POLICY "harvest_seasons_select" ON public.harvest_seasons
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "harvest_seasons_insert" ON public.harvest_seasons
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "harvest_seasons_update" ON public.harvest_seasons
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "harvest_seasons_delete" ON public.harvest_seasons
    FOR DELETE USING (auth.uid() = user_id);
