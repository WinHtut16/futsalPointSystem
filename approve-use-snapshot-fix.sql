-- ============================================================
-- Recreate approve_redemption to use points_cost_snapshot.
--
-- Changes from race-condition-fixes.sql version:
--   1. Reads cost from redemption_requests.points_cost_snapshot
--      instead of live rewards.points_cost — snapshot was captured
--      at request creation time so price changes don't affect
--      in-flight requests.
--   2. Re-checks reward is_active + is_deleted at approval time
--      (PTS-8): raises reward_unavailable if admin deactivated or
--      deleted the reward after the customer submitted.
--   3. SET search_path = public hardening (PTS-6).
--
-- Lock order: redemption_requests → rewards → profiles (unchanged,
-- prevents deadlocks).
--
-- Run AFTER: redemption-cost-snapshot-migration.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_redemption(
  p_request_id  UUID,
  p_approved_by UUID,
  p_notes       TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id          UUID;
  v_reward_id            UUID;
  v_points_cost_snapshot INTEGER;
  v_stock                INTEGER;
  v_is_active            BOOLEAN;
  v_is_deleted           BOOLEAN;
BEGIN
  -- Lock the request row; prevents two concurrent approvals from both proceeding.
  SELECT customer_id, reward_id, points_cost_snapshot
    INTO v_customer_id, v_reward_id, v_points_cost_snapshot
    FROM redemption_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE;

  IF NOT FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM redemption_requests WHERE id = p_request_id) THEN
      RAISE EXCEPTION 'request_not_found';
    ELSE
      RAISE EXCEPTION 'not_pending';
    END IF;
  END IF;

  -- Lock reward row for stock check; also verify reward is still available (PTS-8).
  SELECT stock, is_active, is_deleted
    INTO v_stock, v_is_active, v_is_deleted
    FROM rewards
    WHERE id = v_reward_id
    FOR UPDATE;

  IF NOT FOUND OR NOT v_is_active OR v_is_deleted THEN
    RAISE EXCEPTION 'reward_unavailable';
  END IF;

  IF v_stock IS NOT NULL AND v_stock <= 0 THEN
    RAISE EXCEPTION 'out_of_stock';
  END IF;

  -- Deduct snapshotted cost, not live reward cost.
  UPDATE profiles
    SET total_points = total_points - v_points_cost_snapshot
    WHERE id = v_customer_id
      AND total_points >= v_points_cost_snapshot;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  INSERT INTO point_transactions (
    customer_id, points_delta, transaction_type, reward_id, note, created_by
  ) VALUES (
    v_customer_id, -v_points_cost_snapshot, 'redeem', v_reward_id, p_notes, p_approved_by
  );

  IF v_stock IS NOT NULL THEN
    UPDATE rewards SET stock = stock - 1 WHERE id = v_reward_id;
  END IF;

  UPDATE redemption_requests
    SET status      = 'approved',
        resolved_at = now(),
        resolved_by = p_approved_by,
        notes       = p_notes
    WHERE id = p_request_id;
END;
$$;
