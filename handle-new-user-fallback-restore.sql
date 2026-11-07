-- ============================================================
-- Restore the username fallback in handle_new_user().
--
-- handle-new-user-trigger-fix.sql added
--   COALESCE(username, split_part(email, '@', 1))
-- so creating a user with no metadata (e.g. from the Supabase Auth
-- dashboard) does not fail on the NOT NULL profiles.username column.
-- search-path-hardening-migration.sql later redefined the function to pin
-- search_path but copied the ORIGINAL body, dropping that fallback.
-- Confirmed on production 2026-11-07 (Phase 0 check).
--
-- The app is not affected today: /api/auth/register and /api/admin/staff
-- both pass a username. This keeps BOTH fixes: pinned search_path and the
-- fallback. Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, username, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'phone',
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'customer'
  );
  RETURN new;
END;
$$;

-- Verify: should return true.
-- SELECT position('split_part' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0;
