-- ============================================================
-- Security fix: drop unused anon-key profile update/delete RLS
--
-- Problem — profiles_update and profiles_delete policies
--   Both policies use USING (is_admin()), which lets any
--   authenticated admin update or delete ANY profile row via
--   the public anon key + their session token — including:
--     • Escalating their own role to 'superadmin'
--     • Downgrading the superadmin's role to 'customer'
--     • Deleting the superadmin's profile row
--
-- Root cause: the USING clause checks the caller's role, not
--   the target row's values, so no WITH CHECK expression can
--   prevent writing arbitrary role values.
--
-- Fix: drop both policies.
--   All profile mutations in the app go through
--   createServiceClient() (service role), which bypasses RLS
--   entirely. No legitimate code path needs anon-key UPDATE
--   or DELETE access on the profiles table.
-- ============================================================

DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
