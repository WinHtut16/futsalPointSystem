-- ============================================================
-- Snapshot reward cost at redemption-request creation time.
--
-- Problem: approve_redemption reads points_cost from the live
-- rewards row. If a superadmin edits the reward price after the
-- customer submits, the customer is charged the new price.
--
-- Fix: capture points_cost at INSERT time; approve_redemption
-- reads points_cost_snapshot instead of rewards.points_cost.
--
-- Run AFTER: race-condition-fixes.sql
-- ============================================================

ALTER TABLE redemption_requests
  ADD COLUMN IF NOT EXISTS points_cost_snapshot INTEGER;

-- Backfill existing rows from the current (best-available) reward price.
UPDATE redemption_requests rr
SET points_cost_snapshot = r.points_cost
FROM rewards r
WHERE rr.reward_id = r.id
  AND rr.points_cost_snapshot IS NULL;

-- Enforce NOT NULL once backfill is complete.
ALTER TABLE redemption_requests
  ALTER COLUMN points_cost_snapshot SET NOT NULL;
