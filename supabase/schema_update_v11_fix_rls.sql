-- ============================================================
-- QLCN V11: Comprehensive RLS Security Patch
-- Fixes: New users should NOT see farms/seasons they have no access to.
-- Also fixes: Invited members CAN see seasons they didn't create.
-- ============================================================
-- Run this in Supabase SQL Editor (single time).
-- ============================================================


-- ============================================================
-- PART 1: Re-apply FARMS RLS (membership-based, V9 style)
-- ============================================================

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

-- Drop ALL possible policy names (old and new)
DROP POLICY IF EXISTS "Users can view own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can insert own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can update own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can delete own farms" ON public.farms;
DROP POLICY IF EXISTS "farms_select" ON public.farms;
DROP POLICY IF EXISTS "farms_insert" ON public.farms;
DROP POLICY IF EXISTS "farms_update" ON public.farms;
DROP POLICY IF EXISTS "farms_delete" ON public.farms;

-- Re-create with correct membership-based rules
-- SELECT: only if you are a farm member OR system admin
CREATE POLICY "farms_select" ON public.farms FOR SELECT USING (
    public.auth_is_farm_member(id) OR public.auth_is_system_admin()
);
-- INSERT: anyone (just authenticated) — trigger adds them as OWNER
CREATE POLICY "farms_insert" ON public.farms FOR INSERT WITH CHECK (auth.uid() = user_id);
-- UPDATE/DELETE: only farm owner OR system admin
CREATE POLICY "farms_update" ON public.farms FOR UPDATE USING (
    public.auth_is_farm_owner(id) OR public.auth_is_system_admin()
);
CREATE POLICY "farms_delete" ON public.farms FOR DELETE USING (
    public.auth_is_farm_owner(id) OR public.auth_is_system_admin()
);


-- ============================================================
-- PART 2: Fix HARVEST_SEASONS RLS
-- Old policy only checked user_id, so invited members couldn't see seasons.
-- New policy: visible to anyone who is a member of the farm.
-- ============================================================

ALTER TABLE public.harvest_seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "Users can insert own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "Users can update own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "Users can delete own harvest_seasons" ON public.harvest_seasons;
DROP POLICY IF EXISTS "harvest_seasons_select" ON public.harvest_seasons;
DROP POLICY IF EXISTS "harvest_seasons_insert" ON public.harvest_seasons;
DROP POLICY IF EXISTS "harvest_seasons_update" ON public.harvest_seasons;
DROP POLICY IF EXISTS "harvest_seasons_delete" ON public.harvest_seasons;

-- SELECT: farm member can see all seasons in their farm
--         Fallback: if farm_id is NULL (legacy data), fall back to user_id check
CREATE POLICY "harvest_seasons_select" ON public.harvest_seasons FOR SELECT USING (
    public.auth_is_system_admin()
    OR (farm_id IS NOT NULL AND public.auth_is_farm_member(farm_id))
    OR (farm_id IS NULL AND auth.uid() = user_id)
);

-- INSERT: must be a farm member to add a season; user_id must match the inserter
CREATE POLICY "harvest_seasons_insert" ON public.harvest_seasons FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
        farm_id IS NULL
        OR public.auth_is_farm_member(farm_id)
        OR public.auth_is_system_admin()
    )
);

-- UPDATE: only farm member (owner/manager) or system admin
CREATE POLICY "harvest_seasons_update" ON public.harvest_seasons FOR UPDATE USING (
    public.auth_is_system_admin()
    OR (farm_id IS NOT NULL AND public.auth_is_farm_member(farm_id))
    OR (farm_id IS NULL AND auth.uid() = user_id)
);

-- DELETE: only farm owner or system admin
CREATE POLICY "harvest_seasons_delete" ON public.harvest_seasons FOR DELETE USING (
    public.auth_is_system_admin()
    OR (farm_id IS NOT NULL AND public.auth_is_farm_owner(farm_id))
    OR (farm_id IS NULL AND auth.uid() = user_id)
);


-- ============================================================
-- PART 3: Clean up any stray farm_members rows
-- Remove bogus entries where a user was accidentally added as a member
-- of a farm they don't own and weren't explicitly invited to.
-- (Optional safety check — review before running in production)
-- ============================================================
-- DELETE FROM public.farm_members
-- WHERE invited_by IS NULL AND role != 'OWNER';
-- ⚠ Commented out for safety. Uncomment only if you know there's bad seed data.


-- ============================================================
-- ✅ Done. New users will now see ONLY farms they are members of.
--    Invited members can see all seasons within their farm.
-- ============================================================
