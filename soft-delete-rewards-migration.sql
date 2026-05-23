-- Soft-delete support for rewards
-- Run in Supabase SQL editor after race-condition-fixes.sql

ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Tighten customer RLS to also exclude soft-deleted rows (defense-in-depth;
-- the DELETE API also sets is_active=false, but belt-and-suspenders here).
DROP POLICY IF EXISTS "authenticated: read active rewards" ON public.rewards;
CREATE POLICY "authenticated: read active rewards"
  ON public.rewards FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true AND is_deleted = false);
