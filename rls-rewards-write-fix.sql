-- ============================================================
-- RLS Fix: drop rewards INSERT/UPDATE/DELETE anon-key policies
--
-- Problem: rewards_insert, rewards_update, rewards_delete in
-- supabase-fix-rls.sql use is_admin(), allowing any regular
-- admin to mutate rewards directly via the Supabase anon key.
-- This bypasses the API contract where full reward CRUD is
-- superadmin-only and admins can only toggle is_active.
--
-- Fix: drop all three policies. All reward mutations go through
-- service-role API routes (/api/rewards, /api/rewards/[id])
-- which bypass RLS entirely and enforce role checks at the
-- application layer (requireSuperAdmin / requireAnyAdmin).
--
-- Verified: no app code does direct INSERT/UPDATE/DELETE on
-- the rewards table via the anon key.
--
-- Run AFTER: security-rls-rewards-fix.sql
-- ============================================================

DROP POLICY IF EXISTS "rewards_insert" ON public.rewards;
DROP POLICY IF EXISTS "rewards_update" ON public.rewards;
DROP POLICY IF EXISTS "rewards_delete" ON public.rewards;
