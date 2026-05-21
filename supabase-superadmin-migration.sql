-- ============================================================
-- Superadmin migration — run in Supabase SQL Editor
-- ============================================================

-- 1. Make phone nullable so admin accounts don't need a phone number
ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;

-- 2. Update role check constraint to include 'superadmin'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'admin', 'superadmin'));

-- 3. Update is_admin() so both 'admin' and 'superadmin' pass RLS policies
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  );
$$;

-- 4. Upgrade the existing admin account to superadmin
--    (there should be exactly one admin at this point)
UPDATE profiles SET role = 'superadmin' WHERE role = 'admin';
