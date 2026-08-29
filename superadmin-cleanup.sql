-- ============================================================
-- superadmin-cleanup.sql
-- DEMOTE ONLY. Deletes nothing. Safe to re-run.
--
-- Production had six global superadmins against three ordinary admins - fallout
-- from supabase-superadmin-migration.sql running
-- UPDATE profiles SET role='superadmin' WHERE role='admin' under a comment that
-- assumed exactly one admin existed.
--
-- Global superadmin is not a label. It gates rewards CRUD, staff management,
-- customer data export, and booking hard-delete and purge - and since
-- app-access-migration.sql it also grants every future business (billiards,
-- game) automatically.
--
-- This demotes three developer test accounts left over from working on the
-- forgot-password flow. Everyone else keeps what they have.
--
-- Demotion is deliberately not deletion: it removes every dangerous capability
-- at once and is fully reversible, whereas deletion is neither. Run
-- superadmin-audit.sql before deleting anything - some of these accounts cannot
-- be deleted at all without destroying attributable history.
-- ============================================================

BEGIN;

-- ── 1. The targets must actually exist ───────────────────────────────────────
-- Without this, one mistyped address means the script reports success while
-- silently changing nothing.
DO $$
DECLARE missing TEXT;
BEGIN
  SELECT string_agg(t.email, ', ' ORDER BY t.email) INTO missing
  FROM unnest(ARRAY['winhtutcentury@gmail.com',
                    '09777219771@akoatp.com',
                    'thinyadanaroo43@gmail.com']) AS t(email)
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(t.email)
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Nothing changed. No account found for: %', missing;
  END IF;
END $$;

-- ── 2. Demote ────────────────────────────────────────────────────────────────
-- To 'customer', not 'admin': these are not staff, and 'admin' would leave them
-- with point adjustment and customer management.
UPDATE profiles p
SET role = 'customer'
FROM auth.users u
WHERE u.id = p.id
  AND p.role = 'superadmin'
  AND lower(u.email) IN ('winhtutcentury@gmail.com',
                         '09777219771@akoatp.com',
                         'thinyadanaroo43@gmail.com');

-- Global superadmins hold no app_access rows, but strip any that exist so the
-- demotion cannot be quietly undone by a leftover per-business grant.
DELETE FROM app_access a
USING auth.users u
WHERE u.id = a.user_id
  AND lower(u.email) IN ('winhtutcentury@gmail.com',
                         '09777219771@akoatp.com',
                         'thinyadanaroo43@gmail.com');

-- ── 3. Don't lock the business out ───────────────────────────────────────────
-- Checked AFTER the update and inside the transaction, so a bad outcome rolls
-- back. Counting survivors rather than naming them is deliberate: naming them
-- means the script breaks whenever an address is mistyped or an account is
-- later renamed, which is exactly what happened on the first attempt.
DO $$
DECLARE remaining INT;
BEGIN
  SELECT count(*) INTO remaining FROM profiles WHERE role = 'superadmin';
  IF remaining < 2 THEN
    RAISE EXCEPTION
      'Rolled back: only % superadmin(s) would remain. The business must keep at least two.',
      remaining;
  END IF;
  RAISE NOTICE 'OK - % superadmin(s) remain.', remaining;
END $$;

-- ── 4. Review before COMMIT ──────────────────────────────────────────────────
SELECT u.email, p.username, p.role
FROM profiles p JOIN auth.users u ON u.id = p.id
WHERE p.role IN ('superadmin', 'admin')
ORDER BY p.role DESC, u.email;

COMMIT;
