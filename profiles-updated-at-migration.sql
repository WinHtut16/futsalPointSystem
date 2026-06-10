-- Add updated_at to profiles and maintain it via trigger.
-- Safe to run on a live database: ADD COLUMN IF NOT EXISTS with a DEFAULT
-- is metadata-only in PostgreSQL 11+ (no table rewrite, no lock held).
-- If the column already exists this is a no-op.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Maintain updated_at on every row write.
CREATE OR REPLACE FUNCTION public.set_profile_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_updated_at();
