-- ============================================================
-- RLS Fix: block direct INSERT/UPDATE on point_transactions
--
-- Problem: transactions_insert (restricted to admins in
-- supabase-rls-security-fix.sql) still allowed admins to INSERT
-- directly via the anon key, bypassing add_points_transaction()
-- RPC and desyncing profiles.total_points from the ledger.
-- transactions_update similarly allowed direct updates.
--
-- Fix: drop both policies. The ONLY write path is via the
-- add_points_transaction() SECURITY DEFINER RPC, which bypasses
-- RLS entirely and atomically updates both tables.
--
-- Verified: no app code does direct INSERT/UPDATE on this table.
-- Verified: add_points_transaction() is SECURITY DEFINER
--           (supabase-setup.sql line 69).
--
-- Run AFTER: supabase-rls-security-fix.sql
-- ============================================================

DROP POLICY IF EXISTS "transactions_insert" ON public.point_transactions;
DROP POLICY IF EXISTS "transactions_update" ON public.point_transactions;
