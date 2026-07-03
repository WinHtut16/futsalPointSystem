-- ============================================================
-- RLS Fix: drop point_transactions DELETE anon-key policy
--
-- Problem: transactions_delete in supabase-fix-rls.sql uses
-- is_admin(), allowing admins to DELETE ledger rows directly
-- via the Supabase anon key. rls-transactions-fix.sql dropped
-- INSERT and UPDATE but missed DELETE.
--
-- Fix: drop the policy. The ledger is append-only — corrections
-- go through /api/points/adjust (adjustment transactions), never
-- direct row deletion.
--
-- Run AFTER: rls-transactions-fix.sql
-- ============================================================

DROP POLICY IF EXISTS "transactions_delete" ON public.point_transactions;
