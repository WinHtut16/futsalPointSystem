-- ============================================================
-- RLS Security Fix
--
-- Run this in the Supabase SQL editor after the existing
-- migration files have been applied.
--
-- Fixes two critical gaps found in the initial audit:
--
--   Gap 1 — profiles_update
--     The original policy allowed a customer to UPDATE their
--     own row with no WITH CHECK clause, so they could set
--     role='superadmin' or inflate total_points via the
--     anon key.  All legitimate profile updates go through
--     createServiceClient() (service role, bypasses RLS), so
--     customer rows never need to be touched by the anon key.
--     Solution: restrict UPDATE to admins only.
--
--   Gap 2 — transactions_insert
--     The original policy allowed auth.uid() = customer_id,
--     meaning a customer could directly INSERT a row into
--     point_transactions and award themselves arbitrary points.
--     All point crediting goes through the add_points_transaction
--     SECURITY DEFINER RPC, so customers have no legitimate
--     reason to INSERT directly.
--     Solution: restrict INSERT to admins only.
-- ============================================================

-- ── Gap 1: profiles UPDATE ───────────────────────────────────
DROP POLICY IF EXISTS "profiles_update" ON profiles;

CREATE POLICY "profiles_update"
  ON profiles
  FOR UPDATE
  USING (is_admin());

-- ── Gap 2: point_transactions INSERT ────────────────────────
DROP POLICY IF EXISTS "transactions_insert" ON point_transactions;

CREATE POLICY "transactions_insert"
  ON point_transactions
  FOR INSERT
  WITH CHECK (is_admin());

-- ── Gap 3: redemption_requests — missing race guard ──────────
-- The API-layer duplicate check has a race window; only a DB
-- unique partial index provides an atomic guarantee.
-- Without this, concurrent requests (or direct Supabase client
-- calls bypassing the API) can insert multiple pending rows for
-- the same customer+reward pair.
-- Note: race-condition-fixes.sql also creates this index under
-- the name uq_one_pending_per_reward; both use IF NOT EXISTS so
-- running either file after the other is safe.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_pending_per_reward
  ON redemption_requests (customer_id, reward_id)
  WHERE status = 'pending';
