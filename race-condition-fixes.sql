-- ============================================================
-- Race-condition hardening — run AFTER redemption-requests-migration.sql
-- ============================================================

-- ── 1. Harden add_points_transaction ────────────────────────────────────────
--
-- Problem: the balance check lives in application code, so two concurrent
-- calls can both read the same total_points, both pass, and both deduct,
-- leaving the customer with a negative balance.
--
-- Fix: move the balance guard inside the UPDATE itself. PostgreSQL acquires
-- a row-level lock before evaluating the WHERE clause on the target row, so
-- concurrent calls serialize naturally — the second re-reads the committed
-- value and fails the condition if balance is already insufficient.
--
-- Note: UPDATE is issued before INSERT so that a failed balance check raises
-- an exception without leaving an orphaned transaction record.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION add_points_transaction(
  p_customer_id      uuid,
  p_points_delta     integer,
  p_transaction_type text,
  p_hours_played     numeric,
  p_reward_id        uuid,
  p_note             text,
  p_created_by       uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
    SET total_points = total_points + p_points_delta
    WHERE id = p_customer_id
      AND (p_points_delta >= 0 OR total_points + p_points_delta >= 0);

  IF NOT FOUND AND p_points_delta < 0 THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  INSERT INTO point_transactions (
    customer_id, points_delta, transaction_type,
    hours_played, reward_id, note, created_by
  ) VALUES (
    p_customer_id, p_points_delta, p_transaction_type,
    p_hours_played, p_reward_id, p_note, p_created_by
  );
END;
$$;


-- ── 2. redeem_reward_direct ──────────────────────────────────────────────────
--
-- Replaces the split read-check-then-write pattern in POST /api/points/redeem.
-- Lock order: rewards → profiles (consistent across both RPCs, prevents deadlocks).
--
-- All three checks (reward active, stock > 0, sufficient balance) and all three
-- writes (points deduction, transaction record, stock decrement) happen inside
-- the same implicit PL/pgSQL transaction.  An exception on any check rolls back
-- every write that preceded it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION redeem_reward_direct(
  p_customer_id uuid,
  p_reward_id   uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_points_cost integer;
  v_stock       integer;
  v_is_active   boolean;
BEGIN
  SELECT points_cost, stock, is_active
    INTO v_points_cost, v_stock, v_is_active
    FROM rewards
    WHERE id = p_reward_id
    FOR UPDATE;

  IF NOT FOUND OR NOT v_is_active THEN
    RAISE EXCEPTION 'reward_unavailable';
  END IF;

  IF v_stock IS NOT NULL AND v_stock <= 0 THEN
    RAISE EXCEPTION 'out_of_stock';
  END IF;

  UPDATE profiles
    SET total_points = total_points - v_points_cost
    WHERE id = p_customer_id
      AND total_points >= v_points_cost;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  INSERT INTO point_transactions (
    customer_id, points_delta, transaction_type, reward_id, created_by
  ) VALUES (
    p_customer_id, -v_points_cost, 'redeem', p_reward_id, p_customer_id
  );

  IF v_stock IS NOT NULL THEN
    UPDATE rewards SET stock = stock - 1 WHERE id = p_reward_id;
  END IF;
END;
$$;


-- ── 3. approve_redemption ────────────────────────────────────────────────────
--
-- Replaces the multi-step approve logic in PATCH /api/redemptions/[id].
--
-- Double-approval race: SELECT … WHERE status = 'pending' FOR UPDATE locks the
-- request row.  Under PostgreSQL's default READ COMMITTED isolation, the second
-- concurrent call blocks until the first commits, then re-evaluates the WHERE
-- clause and finds status ≠ 'pending' → raises 'not_pending' without applying
-- any writes.
--
-- Lock order: redemption_requests → rewards → profiles (same as
-- redeem_reward_direct for the rewards→profiles segment, preventing deadlocks).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION approve_redemption(
  p_request_id  uuid,
  p_approved_by uuid,
  p_notes       text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_customer_id uuid;
  v_reward_id   uuid;
  v_points_cost integer;
  v_stock       integer;
BEGIN
  -- Lock the request row; prevents two concurrent approvals from both proceeding.
  SELECT customer_id, reward_id
    INTO v_customer_id, v_reward_id
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

  SELECT points_cost, stock
    INTO v_points_cost, v_stock
    FROM rewards
    WHERE id = v_reward_id
    FOR UPDATE;

  IF v_stock IS NOT NULL AND v_stock <= 0 THEN
    RAISE EXCEPTION 'out_of_stock';
  END IF;

  UPDATE profiles
    SET total_points = total_points - v_points_cost
    WHERE id = v_customer_id
      AND total_points >= v_points_cost;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  INSERT INTO point_transactions (
    customer_id, points_delta, transaction_type, reward_id, note, created_by
  ) VALUES (
    v_customer_id, -v_points_cost, 'redeem', v_reward_id, p_notes, p_approved_by
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


-- ── 4. Prevent duplicate pending requests at the DB level ────────────────────
--
-- The application-level duplicate check in POST /api/redemptions is a TOCTOU
-- race: check and insert are separate statements.  This partial unique index
-- makes the database the authoritative enforcer — a concurrent insert for the
-- same (customer_id, reward_id) pair will fail with SQLSTATE 23505.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_pending_per_reward
  ON redemption_requests (customer_id, reward_id)
  WHERE status = 'pending';


-- ── 5. Non-negative balance constraint (last-resort guard) ───────────────────
--
-- This constraint will reject any UPDATE that would take total_points below 0,
-- regardless of which code path triggered it.
--
-- IMPORTANT: only run this if no existing rows have negative total_points.
-- Verify first:  SELECT MIN(total_points) FROM profiles;
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD CONSTRAINT chk_total_points_nonneg CHECK (total_points >= 0);
