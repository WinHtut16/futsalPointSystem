-- ============================================================
-- superadmin-cleanup.sql
-- Step 1 of tidying the superadmin list: DEMOTE ONLY. Deletes nothing.
--
-- Production had six global superadmins. Global superadmin is not a label - it
-- gates rewards CRUD, staff management, customer data export, and booking
-- hard-delete and purge, and since app-access-migration.sql it also grants every
-- future business (billiards, game) automatically.
--
-- Kept as superadmin (3):
--   winhtutnaing344@gmail.com            developer
--   ceo.neb@gmail.com                    client
--   greentown.managementfirm@gmail.com   client
--
-- Demoted here (3) - all developer test accounts left over from working on the
-- forgot-password flow:
--   winhtutcentury@gmail.com
--   09777219771@akoatp.com
--   thinyadanaroo43@gmail.com
--
-- Demotion is deliberately separate from deletion. It removes every dangerous
-- capability immediately and is fully reversible, whereas deletion is neither.
-- Run superadmin-audit.sql first to see what each account is attached to; some
-- of them cannot be deleted at all without destroying attributable history.
-- ============================================================

BEGIN;

-- Refuse to run if the intended survivors are not actually there, rather than
-- demoting everyone and locking the business out of its own admin panel.
DO $$
DECLARE keep_count INT;
BEGIN
  SELECT count(*) INTO keep_count
  FROM profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'superadmin'
    AND u.email IN ('winhtutnaing344@gmail.com',
                    'ceo.neb@gmail.com',
                    'greentown.managementfirm@gmail.com');

  IF keep_count < 3 THEN
    RAISE EXCEPTION
      'Expected 3 superadmins to survive, found %. Nothing changed - check the email list first.',
      keep_count;
  END IF;
END $$;

-- Demote to customer: these are not staff accounts, so 'admin' would be wrong
-- and would leave them with point-adjustment and customer-management powers.
UPDATE profiles p
SET role = 'customer'
FROM auth.users u
WHERE u.id = p.id
  AND p.role = 'superadmin'
  AND u.email IN ('winhtutcentury@gmail.com',
                  '09777219771@akoatp.com',
                  'thinyadanaroo43@gmail.com');

-- Global superadmins hold no app_access rows, but strip any that exist so the
-- demotion cannot be quietly undone by a leftover per-business grant.
DELETE FROM app_access a
USING auth.users u
WHERE u.id = a.user_id
  AND u.email IN ('winhtutcentury@gmail.com',
                  '09777219771@akoatp.com',
                  'thinyadanaroo43@gmail.com');

-- Review this before COMMIT. Expect exactly the three survivors.
SELECT u.email, p.username, p.role
FROM profiles p JOIN auth.users u ON u.id = p.id
WHERE p.role IN ('superadmin', 'admin')
ORDER BY p.role DESC, u.email;

COMMIT;
