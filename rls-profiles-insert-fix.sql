-- ============================================================
-- RLS Fix: profiles INSERT policy WITH role='customer' check
--
-- Problem: profiles_insert (supabase-fix-rls.sql line 34) only
-- checks auth.uid() = id, allowing any authenticated user to
-- re-insert their own profile row with role='superadmin' via
-- the anon-key REST API.
--
-- Fix: add AND role = 'customer' to WITH CHECK so self-inserts
-- can only create customer-role profiles.
--
-- Notes:
-- • handle_new_user() trigger is SECURITY DEFINER — bypasses RLS,
--   so it continues to work after this change (verified in
--   handle-new-user-trigger-fix.sql line 12).
-- • setup-admin.mjs uses the service role client — bypasses RLS,
--   so superadmin seeding is unaffected.
-- • All other admin profile mutations go through createServiceClient()
--   (service role), so no legitimate app path is broken.
--
-- Run AFTER: security-rls-profiles-fix.sql
-- ============================================================

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND role = 'customer'
  );
