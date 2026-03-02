-- ============================================================
-- QLCN V9 FIXED: Full RBAC - Profiles, Farm Members, Feature Permissions
-- KEY FIX: Uses SECURITY DEFINER helper functions to avoid RLS infinite recursion
-- Run this in the Supabase SQL Editor (safe to re-run)
-- ============================================================

-- STEP 1: Drop everything first for a clean slate
DROP TABLE IF EXISTS public.farm_members CASCADE;
DROP TYPE IF EXISTS farm_role CASCADE;

-- STEP 2: Drop any old policies on farms
DROP POLICY IF EXISTS "Users can view own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can view joined farms" ON public.farms;
DROP POLICY IF EXISTS "Users can insert farms" ON public.farms;
DROP POLICY IF EXISTS "Users can insert own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can update own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can delete own farms" ON public.farms;
DROP POLICY IF EXISTS "Owners can update farms" ON public.farms;
DROP POLICY IF EXISTS "Owners can delete farms" ON public.farms;
DROP POLICY IF EXISTS "farms_select" ON public.farms;
DROP POLICY IF EXISTS "farms_insert" ON public.farms;
DROP POLICY IF EXISTS "farms_update" ON public.farms;
DROP POLICY IF EXISTS "farms_delete" ON public.farms;

-- STEP 3: PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_admin)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN NEW.email = 'betokutin@gmail.com' THEN true ELSE false END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_profile();

INSERT INTO public.profiles (id, email, full_name, is_admin)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', ''),
  CASE WHEN email = 'betokutin@gmail.com' THEN true ELSE false END
FROM auth.users
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET is_admin = true WHERE email = 'betokutin@gmail.com';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE USING (
  (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- STEP 4: FARM MEMBERS TABLE + ENUM
CREATE TYPE farm_role AS ENUM ('OWNER', 'MANAGER', 'WORKER');

CREATE TABLE public.farm_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role farm_role DEFAULT 'WORKER' NOT NULL,
    permissions JSONB DEFAULT '{
      "dashboard": true, "expenses": true, "harvest": true, "capital": true,
      "debts": true, "inventory": true, "labor": true, "diary": true,
      "expense_categories": true, "withdraw": true
    }'::jsonb NOT NULL,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(farm_id, user_id)
);

-- Seed existing farm creators as OWNER
INSERT INTO public.farm_members (farm_id, user_id, role, permissions)
SELECT id, user_id, 'OWNER',
  '{"dashboard":true,"expenses":true,"harvest":true,"capital":true,"debts":true,"inventory":true,"labor":true,"diary":true,"expense_categories":true,"withdraw":true}'::jsonb
FROM public.farms
ON CONFLICT (farm_id, user_id) DO NOTHING;

-- STEP 5: SECURITY DEFINER helper functions (these bypass RLS to avoid recursion)
-- These run with superuser permissions so they don't trigger RLS on farm_members.

CREATE OR REPLACE FUNCTION public.auth_is_farm_member(p_farm_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM farm_members WHERE farm_id = p_farm_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_farm_owner(p_farm_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM farm_members WHERE farm_id = p_farm_id AND user_id = auth.uid() AND role = 'OWNER'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_system_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- STEP 6: RLS for farm_members (using helper functions to prevent recursion)
ALTER TABLE public.farm_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farm_members_select" ON public.farm_members FOR SELECT USING (
  public.auth_is_farm_member(farm_id) OR public.auth_is_system_admin()
);

CREATE POLICY "farm_members_insert" ON public.farm_members FOR INSERT WITH CHECK (
  public.auth_is_farm_owner(farm_id) OR public.auth_is_system_admin()
);

CREATE POLICY "farm_members_update" ON public.farm_members FOR UPDATE USING (
  public.auth_is_farm_owner(farm_id) OR public.auth_is_system_admin()
);

CREATE POLICY "farm_members_delete" ON public.farm_members FOR DELETE USING (
  public.auth_is_farm_owner(farm_id) OR public.auth_is_system_admin()
);

-- STEP 7: FARMS RLS (using helper functions)
CREATE POLICY "farms_select" ON public.farms FOR SELECT USING (
  public.auth_is_farm_member(id) OR public.auth_is_system_admin()
);
CREATE POLICY "farms_insert" ON public.farms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "farms_update" ON public.farms FOR UPDATE USING (
  public.auth_is_farm_owner(id) OR public.auth_is_system_admin()
);
CREATE POLICY "farms_delete" ON public.farms FOR DELETE USING (
  public.auth_is_farm_owner(id) OR public.auth_is_system_admin()
);

-- STEP 8: Trigger — auto-add OWNER when a new farm is created
CREATE OR REPLACE FUNCTION public.handle_new_farm_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.farm_members (farm_id, user_id, role, permissions)
  VALUES (NEW.id, NEW.user_id, 'OWNER',
    '{"dashboard":true,"expenses":true,"harvest":true,"capital":true,"debts":true,"inventory":true,"labor":true,"diary":true,"expense_categories":true,"withdraw":true}'::jsonb
  )
  ON CONFLICT (farm_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_farm_created_add_owner ON public.farms;
CREATE TRIGGER on_farm_created_add_owner
  AFTER INSERT ON public.farms
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_farm_member();

-- STEP 9: RPCs
CREATE OR REPLACE FUNCTION public.get_my_farm_role(p_farm_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_role TEXT;
BEGIN
  IF public.auth_is_system_admin() THEN RETURN 'ADMIN'; END IF;
  SELECT role::text INTO v_role FROM public.farm_members WHERE farm_id = p_farm_id AND user_id = auth.uid();
  RETURN COALESCE(v_role, 'NONE');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_farm_permissions(p_farm_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_permissions JSONB;
  v_all JSONB := '{"dashboard":true,"expenses":true,"harvest":true,"capital":true,"debts":true,"inventory":true,"labor":true,"diary":true,"expense_categories":true,"withdraw":true}'::jsonb;
BEGIN
  IF public.auth_is_system_admin() THEN RETURN v_all; END IF;
  SELECT role::text, permissions INTO v_role, v_permissions
  FROM public.farm_members WHERE farm_id = p_farm_id AND user_id = auth.uid();
  IF v_role = 'OWNER' THEN RETURN v_all; END IF;
  RETURN COALESCE(v_permissions, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_user_to_farm(
  p_farm_id UUID, p_email TEXT,
  p_role farm_role DEFAULT 'WORKER',
  p_permissions JSONB DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_target_user_id UUID;
  v_default_perms JSONB := '{"dashboard":true,"expenses":true,"harvest":false,"capital":false,"debts":false,"inventory":false,"labor":false,"diary":true,"expense_categories":false,"withdraw":false}'::jsonb;
BEGIN
  IF NOT public.auth_is_system_admin() AND NOT public.auth_is_farm_owner(p_farm_id) THEN
    RETURN jsonb_build_object('error', 'Bạn không có quyền mời thành viên vào vườn này');
  END IF;
  SELECT id INTO v_target_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  IF v_target_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Không tìm thấy tài khoản với email: ' || p_email);
  END IF;
  INSERT INTO public.farm_members (farm_id, user_id, role, permissions, invited_by)
  VALUES (p_farm_id, v_target_user_id, p_role, COALESCE(p_permissions, v_default_perms), auth.uid())
  ON CONFLICT (farm_id, user_id) DO UPDATE
    SET role = p_role, permissions = COALESCE(p_permissions, v_default_perms);
  RETURN jsonb_build_object('success', true, 'user_id', v_target_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_farm_member_permissions(
  p_member_id UUID, p_permissions JSONB,
  p_role farm_role DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_farm_id UUID;
BEGIN
  SELECT farm_id INTO v_farm_id FROM public.farm_members WHERE id = p_member_id;
  IF NOT public.auth_is_system_admin() AND NOT public.auth_is_farm_owner(v_farm_id) THEN
    RETURN jsonb_build_object('error', 'Không có quyền');
  END IF;
  UPDATE public.farm_members SET permissions = p_permissions, role = COALESCE(p_role, role)
  WHERE id = p_member_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
