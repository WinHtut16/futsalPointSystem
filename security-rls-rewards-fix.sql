-- ============================================================
-- Security fix: rewards SELECT RLS
--
-- Problem 1 — Missing authentication check
--   The "rewards_select" policy (supabase-fix-rls.sql) used:
--     using (is_active = true or is_admin())
--   No auth.role() guard means unauthenticated anon callers
--   can read the full active rewards catalog via the Supabase
--   anon key, bypassing the API auth layer.
--
-- Problem 2 — Duplicate conflicting SELECT policies
--   soft-delete-rewards-migration.sql added a second SELECT
--   policy ("authenticated: read active rewards") without
--   dropping the first. PostgreSQL ORs permissive policies,
--   so the weaker (no-auth) policy always wins.
--
-- Fix: drop both existing policies, replace with one unified
--   policy that:
--     • Requires the caller to be authenticated (auth.role())
--     • Hides inactive rewards from non-admins
--     • Hides soft-deleted rewards from non-admins
--     • Lets admins see everything (for management UIs)
-- ============================================================

-- Drop both existing rewards SELECT policies
DROP POLICY IF EXISTS "rewards_select"                    ON public.rewards;
DROP POLICY IF EXISTS "authenticated: read active rewards" ON public.rewards;

-- Single unified policy
CREATE POLICY "rewards_select"
  ON public.rewards FOR SELECT
  USING (
    (
      auth.role() = 'authenticated'
      AND is_active   = true
      AND is_deleted  = false
    )
    OR is_admin()
  );
