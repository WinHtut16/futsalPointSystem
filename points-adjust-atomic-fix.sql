-- ============================================================
-- Atomic balance guard for add_points_transaction()
--
-- Problem: app/api/points/adjust/route.ts read total_points with
-- a SELECT, then called the RPC. Two concurrent negative adjustments
-- could both pass the SELECT check simultaneously and both apply,
-- driving total_points below zero.
--
-- Fix: add FOR UPDATE row-lock + balance check inside the RPC so
-- both the check and the update happen atomically under Postgres
-- row-level locking. The application-layer guard in the route is
-- removed (SELECT-then-check pattern is inherently racy).
--
-- New parameter: p_min_balance INTEGER DEFAULT 0
-- - Existing callers that omit this parameter default to 0 (no change).
-- - App RPC callers pass p_min_balance: 0 explicitly to avoid PostgREST
--   overload ambiguity if another signature exists.
--
-- Verified: SECURITY DEFINER is already present on this function
-- (supabase-setup.sql line 69), so removing the INSERT RLS policy
-- (rls-transactions-fix.sql) does not break this function.
--
-- Run AFTER: rls-transactions-fix.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.add_points_transaction(
  p_customer_id      UUID,
  p_points_delta     INTEGER,
  p_transaction_type TEXT,
  p_hours_played     NUMERIC,
  p_reward_id        UUID,
  p_note             TEXT,
  p_created_by       UUID,
  p_min_balance      INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_points INTEGER;
BEGIN
  -- Lock the profile row to prevent concurrent adjustments from both
  -- passing a balance check that was read before either write completes.
  SELECT total_points INTO v_current_points
  FROM profiles
  WHERE id = p_customer_id
  FOR UPDATE;

  IF v_current_points + p_points_delta < p_min_balance THEN
    RAISE EXCEPTION 'insufficient_balance'
      USING HINT = 'Adjustment would drive balance below minimum';
  END IF;

  UPDATE profiles
  SET total_points = total_points + p_points_delta
  WHERE id = p_customer_id;

  INSERT INTO point_transactions (
    customer_id, points_delta, transaction_type,
    hours_played, reward_id, note, created_by
  ) VALUES (
    p_customer_id, p_points_delta, p_transaction_type,
    p_hours_played, p_reward_id, p_note, p_created_by
  );
END;
$$;
