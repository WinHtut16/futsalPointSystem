-- ============================================================
-- Multi-business points: one wallet per customer per business.
--
-- Futsal already has points (profiles.total_points). ACJ Gaming and
-- CueX Billiards get their own, kept SEPARATE: a reward's value in
-- points differs per business, so balances must never mix.
--
-- What this adds:
--   1. point_wallets(user_id, app, balance) - the balance per business.
--      Futsal is backfilled from profiles.total_points.
--   2. point_transactions.app (+ source_kind / source_session_id, used
--      later by the game and billiards session triggers).
--   3. rewards.app and redemption_requests.app (the request's app is
--      always copied from its reward and cannot be changed by anyone).
--   4. add_points_transaction(..., p_app) and approve_redemption read and
--      write the wallet of the right business.
--
-- Futsal behaves exactly as before:
--   * every existing column and default is kept; new columns default to
--     'futsal', so existing inserts that do not name an app stay futsal.
--   * profiles.total_points stays as a MIRROR of the futsal wallet, written
--     in the same transaction, so the account page, admin pages and the
--     realtime hook keep working without code changes. It will be dropped
--     once nothing reads it.
--   * the app's existing named-argument RPC calls still resolve, because
--     p_app is a trailing parameter with a default.
--
-- Also closes a gap: the original 7-argument add_points_transaction()
-- (supabase-setup.sql / race-condition-fixes.sql) was never dropped when
-- the 8-argument version was added, and URGENT-fix-anon-rpc-exposure.sql
-- only revoked the 8-argument one. If it is still live, any signed-in
-- customer can call it. Both old versions are dropped here.
--
-- Run AFTER: app-access-migration.sql, approve-use-snapshot-fix.sql,
--            points-adjust-atomic-fix.sql, redemption-cost-snapshot-migration.sql
-- Safe to re-run.
-- ============================================================

DO $$
BEGIN
  IF to_regprocedure('public.has_app_access(text)') IS NULL THEN
    RAISE EXCEPTION 'Run app-access-migration.sql first (public.has_app_access is missing).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'redemption_requests'
                   AND column_name = 'points_cost_snapshot') THEN
    RAISE EXCEPTION 'Run redemption-cost-snapshot-migration.sql first.';
  END IF;
END $$;

BEGIN;

-- ------------------------------------------------------------
-- 1. Wallets
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.point_wallets (
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  app        TEXT        NOT NULL CHECK (app IN ('futsal', 'game', 'billiards')),
  balance    INTEGER     NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app)
);

ALTER TABLE public.point_wallets ENABLE ROW LEVEL SECURITY;

-- Read only. Every write goes through the SECURITY DEFINER functions below.
REVOKE ALL ON public.point_wallets FROM anon, authenticated;
GRANT SELECT ON public.point_wallets TO authenticated;
GRANT ALL ON public.point_wallets TO service_role;

DROP POLICY IF EXISTS pw_select ON public.point_wallets;
CREATE POLICY pw_select ON public.point_wallets
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.has_app_access(app));

-- Backfill futsal from the old single balance. Customers only: staff
-- profiles have no points. ON CONFLICT keeps a re-run from overwriting a
-- wallet that has moved on since.
INSERT INTO public.point_wallets (user_id, app, balance)
SELECT id, 'futsal', total_points
FROM public.profiles
WHERE role = 'customer'
ON CONFLICT (user_id, app) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Ledger: which business, and (later) which session earned it
-- ------------------------------------------------------------
ALTER TABLE public.point_transactions
  ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'futsal',
  ADD COLUMN IF NOT EXISTS source_kind TEXT,
  ADD COLUMN IF NOT EXISTS source_session_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_point_transactions_app') THEN
    ALTER TABLE public.point_transactions
      ADD CONSTRAINT chk_point_transactions_app
      CHECK (app IN ('futsal', 'game', 'billiards'));
  END IF;
  -- Both set or both empty, and the kind must match the business.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_point_transactions_source') THEN
    ALTER TABLE public.point_transactions
      ADD CONSTRAINT chk_point_transactions_source CHECK (
        (source_kind IS NULL AND source_session_id IS NULL) OR
        (source_kind = 'game_session'      AND app = 'game'      AND source_session_id IS NOT NULL) OR
        (source_kind = 'billiards_session' AND app = 'billiards' AND source_session_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_point_transactions_customer_app
  ON public.point_transactions (customer_id, app, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_source
  ON public.point_transactions (app, source_session_id)
  WHERE source_session_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3. Rewards and redemption requests belong to one business
-- ------------------------------------------------------------
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'futsal';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rewards_app') THEN
    ALTER TABLE public.rewards
      ADD CONSTRAINT chk_rewards_app CHECK (app IN ('futsal', 'game', 'billiards'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rewards_app ON public.rewards (app);

ALTER TABLE public.redemption_requests
  ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'futsal';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_redemption_requests_app') THEN
    ALTER TABLE public.redemption_requests
      ADD CONSTRAINT chk_redemption_requests_app CHECK (app IN ('futsal', 'game', 'billiards'));
  END IF;
END $$;

-- Existing requests take their reward's business (all futsal today).
UPDATE public.redemption_requests rr
   SET app = r.app
  FROM public.rewards r
 WHERE r.id = rr.reward_id AND rr.app IS DISTINCT FROM r.app;

CREATE INDEX IF NOT EXISTS idx_redemption_requests_app_status
  ON public.redemption_requests (app, status);

-- The request's business is ALWAYS its reward's business, on insert and on
-- every update - so a customer cancelling their own request (the one UPDATE
-- they are allowed) cannot move it to another business either.
CREATE OR REPLACE FUNCTION public.redemption_request_set_app()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT app INTO NEW.app FROM rewards WHERE id = NEW.reward_id;
  IF NEW.app IS NULL THEN
    NEW.app := COALESCE(OLD.app, 'futsal');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.redemption_request_set_app() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_redemption_request_set_app ON public.redemption_requests;
CREATE TRIGGER trg_redemption_request_set_app
  BEFORE INSERT OR UPDATE ON public.redemption_requests
  FOR EACH ROW EXECUTE FUNCTION public.redemption_request_set_app();

-- ------------------------------------------------------------
-- 4. Wallet helper (internal)
-- ------------------------------------------------------------
-- Returns the locked balance of one wallet, creating it at 0 if this
-- customer has never had points at that business. A futsal wallet that is
-- missing (customer registered after the backfill) is seeded from
-- profiles.total_points, which is still the mirror.
CREATE OR REPLACE FUNCTION public.lock_point_wallet(p_user_id UUID, p_app TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF p_app IS NULL OR p_app NOT IN ('futsal', 'game', 'billiards') THEN
    RAISE EXCEPTION 'invalid_app';
  END IF;

  INSERT INTO point_wallets (user_id, app, balance)
  SELECT p.id, p_app, CASE WHEN p_app = 'futsal' THEN p.total_points ELSE 0 END
    FROM profiles p
   WHERE p.id = p_user_id
  ON CONFLICT (user_id, app) DO NOTHING;

  SELECT balance INTO v_balance
    FROM point_wallets
   WHERE user_id = p_user_id AND app = p_app
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found';
  END IF;

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_point_wallet(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_point_wallet(UUID, TEXT) TO service_role;

-- ------------------------------------------------------------
-- 5. add_points_transaction: one version only, wallet-aware
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_points_transaction(UUID, INTEGER, TEXT, NUMERIC, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.add_points_transaction(UUID, INTEGER, TEXT, NUMERIC, UUID, TEXT, UUID, INTEGER);

-- p_min_balance: the balance may not end below this. Pass 0 for normal
-- earn/adjust (as the app does today). NULL means no floor - used only by
-- automatic reversals (a voided session whose points were already spent),
-- which must always be recorded.
CREATE OR REPLACE FUNCTION public.add_points_transaction(
  p_customer_id      UUID,
  p_points_delta     INTEGER,
  p_transaction_type TEXT,
  p_hours_played     NUMERIC,
  p_reward_id        UUID,
  p_note             TEXT,
  p_created_by       UUID,
  p_min_balance      INTEGER DEFAULT 0,
  p_app              TEXT    DEFAULT 'futsal'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Lock order everywhere: wallet, then profile.
  v_balance := lock_point_wallet(p_customer_id, p_app);

  IF v_balance + p_points_delta < p_min_balance THEN
    RAISE EXCEPTION 'insufficient_balance'
      USING HINT = 'Adjustment would drive balance below minimum';
  END IF;

  UPDATE point_wallets
     SET balance = balance + p_points_delta, updated_at = now()
   WHERE user_id = p_customer_id AND app = p_app
  RETURNING balance INTO v_balance;

  IF p_app = 'futsal' THEN
    UPDATE profiles SET total_points = v_balance WHERE id = p_customer_id;
  END IF;

  INSERT INTO point_transactions (
    customer_id, points_delta, transaction_type,
    hours_played, reward_id, note, created_by, app
  ) VALUES (
    p_customer_id, p_points_delta, p_transaction_type,
    p_hours_played, p_reward_id, p_note, p_created_by, p_app
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_points_transaction(UUID, INTEGER, TEXT, NUMERIC, UUID, TEXT, UUID, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_points_transaction(UUID, INTEGER, TEXT, NUMERIC, UUID, TEXT, UUID, INTEGER, TEXT)
  TO service_role;

-- ------------------------------------------------------------
-- 6. approve_redemption: deduct from the reward's business
-- ------------------------------------------------------------
-- Same signature, same exception names as approve-use-snapshot-fix.sql, so
-- app/api/redemptions/[id]/route.ts needs no change.
-- Lock order: redemption_requests -> rewards -> wallet -> profile.
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
  v_app                  TEXT;
  v_balance              INTEGER;
BEGIN
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

  SELECT stock, is_active, is_deleted, app
    INTO v_stock, v_is_active, v_is_deleted, v_app
    FROM rewards
   WHERE id = v_reward_id
   FOR UPDATE;

  IF NOT FOUND OR NOT v_is_active OR v_is_deleted THEN
    RAISE EXCEPTION 'reward_unavailable';
  END IF;

  IF v_stock IS NOT NULL AND v_stock <= 0 THEN
    RAISE EXCEPTION 'out_of_stock';
  END IF;

  v_balance := lock_point_wallet(v_customer_id, v_app);

  -- A wallet pushed below zero by a reversal blocks redemption here too.
  IF v_balance < v_points_cost_snapshot THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  UPDATE point_wallets
     SET balance = balance - v_points_cost_snapshot, updated_at = now()
   WHERE user_id = v_customer_id AND app = v_app
  RETURNING balance INTO v_balance;

  IF v_app = 'futsal' THEN
    UPDATE profiles SET total_points = v_balance WHERE id = v_customer_id;
  END IF;

  INSERT INTO point_transactions (
    customer_id, points_delta, transaction_type, reward_id, note, created_by, app
  ) VALUES (
    v_customer_id, -v_points_cost_snapshot, 'redeem', v_reward_id, p_notes, p_approved_by, v_app
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

REVOKE ALL ON FUNCTION public.approve_redemption(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_redemption(UUID, UUID, TEXT) TO service_role;

COMMIT;

-- ------------------------------------------------------------
-- Verify after running (all three should return 0 rows / true):
-- ------------------------------------------------------------
-- 1. Futsal wallets match the old balance for every customer:
--    SELECT p.id FROM profiles p
--      LEFT JOIN point_wallets w ON w.user_id = p.id AND w.app = 'futsal'
--     WHERE p.role = 'customer' AND COALESCE(w.balance, 0) <> p.total_points;
-- 2. Only one add_points_transaction exists:
--    SELECT count(*) = 1 FROM pg_proc WHERE proname = 'add_points_transaction';
-- 3. Neither points function is callable by a signed-in session:
--    SELECT has_function_privilege('authenticated',
--      'public.add_points_transaction(uuid,integer,text,numeric,uuid,text,uuid,integer,text)', 'execute'),
--      has_function_privilege('authenticated', 'public.approve_redemption(uuid,uuid,text)', 'execute');
--    -- expect: false, false
