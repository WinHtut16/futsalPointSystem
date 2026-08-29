-- ============================================================
-- app-access-migration.sql
-- Phase 1 of the unified admin portal (futsal + billiards + game).
--
-- Run in the Supabase SQL Editor AFTER all previous migrations.
--
-- PURELY ADDITIVE. Nothing in the app reads any of these objects yet, so
-- this can be applied to production ahead of any code change and rolled
-- back by dropping the three objects it creates. No existing table,
-- policy, function or row is modified.
--
-- What it establishes: one Supabase project holds identity for all three
-- businesses. `profiles.role = 'superadmin'` stays the global owner role
-- (the owner and his manager) and implies access to everything. Everyone
-- else is granted one business at a time in `app_access`.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Who can enter which business
-- ------------------------------------------------------------
-- Superadmins deliberately do NOT need rows here — has_app_access() and
-- my_apps() below treat the global role as access to all three apps. A row
-- for a superadmin is harmless but redundant.

CREATE TABLE IF NOT EXISTS public.app_access (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app         TEXT        NOT NULL CHECK (app  IN ('futsal', 'billiards', 'game')),
  role        TEXT        NOT NULL CHECK (role IN ('admin', 'superadmin')),
  granted_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app)
);

-- Supports the superadmin's "who works at this venue?" list.
CREATE INDEX IF NOT EXISTS app_access_app_idx ON public.app_access (app);

COMMENT ON TABLE public.app_access IS
  'Per-business admin grants. profiles.role = superadmin overrides this and grants every app.';

-- ------------------------------------------------------------
-- 2. Helper functions
-- ------------------------------------------------------------
-- SECURITY DEFINER so RLS policies on app_access itself cannot recurse.
-- SET search_path is pinned on every one of these: a SECURITY DEFINER
-- function without it can be hijacked via a caller-controlled search_path.
-- (Note for later: the existing is_admin() from supabase-superadmin-migration.sql
-- does not pin its search_path. Worth fixing in a separate migration — it is a
-- pre-existing issue, deliberately not changed here to keep this one additive.)

-- Global owner role. Distinct from is_admin(), which passes for admins too.
-- Phase 3 note: billiards ships its own is_superadmin() reading its `admins`
-- table. When billiards moves into this project that copy gets dropped and
-- its policies repointed at has_app_access('billiards').
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'superadmin'
  );
$$;

-- The single authorization check every app and every RLS policy calls.
CREATE OR REPLACE FUNCTION public.has_app_access(p_app TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'superadmin'
  ) OR EXISTS (
    SELECT 1 FROM app_access
    WHERE user_id = auth.uid()
      AND app     = p_app
  );
$$;

-- Which role the caller holds *within* one business.
-- Global superadmins outrank any per-app row. Returns NULL when the caller has
-- no access to that app at all, so a null check is also an access check.
--
-- This is what lets one person be superadmin of billiards and ordinary staff at
-- futsal. Phase 2 repoints futsal's requireSuperAdmin() at app_role('futsal')
-- so its ~15 superadmin-gated screens and routes respect per-app roles instead
-- of the single global flag.
CREATE OR REPLACE FUNCTION public.app_role(p_app TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'superadmin'
    ) THEN 'superadmin'
    ELSE (
      SELECT role FROM app_access
      WHERE user_id = auth.uid()
        AND app     = p_app
    )
  END;
$$;

-- Everything the portal needs to render its tiles, in one round trip.
-- Returns exactly one row per business the caller may enter.
CREATE OR REPLACE FUNCTION public.my_apps()
RETURNS TABLE (app TEXT, role TEXT)
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT candidate.app, public.app_role(candidate.app)
  FROM unnest(ARRAY['futsal', 'billiards', 'game']) AS candidate(app)
  WHERE public.app_role(candidate.app) IS NOT NULL
  ORDER BY 1;
$$;

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
-- Read: your own grants, so the portal can render without service role.
-- Write: superadmin only. Granting access to a business is an owner action.

ALTER TABLE public.app_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_access_select_own   ON public.app_access;
DROP POLICY IF EXISTS app_access_select_super ON public.app_access;
DROP POLICY IF EXISTS app_access_write_super  ON public.app_access;

CREATE POLICY app_access_select_own ON public.app_access
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY app_access_select_super ON public.app_access
  FOR SELECT
  USING (public.is_superadmin());

CREATE POLICY app_access_write_super ON public.app_access
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ------------------------------------------------------------
-- 4. Backfill
-- ------------------------------------------------------------
-- Every existing futsal staff admin keeps exactly the access they have
-- today. Superadmins are skipped on purpose — the global role already
-- covers them, and giving them rows would imply the grant can be revoked
-- per app, which it cannot.

INSERT INTO public.app_access (user_id, app, role)
SELECT id, 'futsal', 'admin'
FROM public.profiles
WHERE role = 'admin'
ON CONFLICT (user_id, app) DO NOTHING;

-- ============================================================
-- Verification — run these after applying, they change nothing.
-- ============================================================
--
-- Every existing admin now has a futsal grant, and the counts match:
--   SELECT (SELECT count(*) FROM profiles   WHERE role = 'admin')        AS admins,
--          (SELECT count(*) FROM app_access WHERE app  = 'futsal')       AS futsal_grants,
--          (SELECT count(*) FROM profiles   WHERE role = 'superadmin')   AS superadmins;
--
-- As a superadmin, all three apps come back:
--   SELECT * FROM my_apps();
--
-- As a futsal staff admin, only futsal comes back and billiards is refused:
--   SELECT * FROM my_apps();
--   SELECT has_app_access('futsal') AS futsal, has_app_access('billiards') AS billiards;
--
-- Nothing regressed for customers — this should still be false for them:
--   SELECT has_app_access('futsal');
