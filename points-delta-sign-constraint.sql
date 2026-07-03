-- ============================================================
-- DB-level sign constraint on point_transactions.points_delta.
--
-- Business rule:
--   earn        → delta > 0  (always positive)
--   redeem      → delta < 0  (always negative)
--   adjustment  → delta != 0 (non-zero; sign depends on correction direction)
--
-- Verify first: SELECT transaction_type, MIN(points_delta), MAX(points_delta)
--               FROM point_transactions GROUP BY transaction_type;
-- Expected: earn > 0, redeem < 0, adjustment != 0 for all rows.
--
-- Run AFTER: point-adjustment-migration.sql
-- ============================================================

ALTER TABLE point_transactions
  ADD CONSTRAINT chk_points_delta_sign CHECK (
    (transaction_type = 'earn'       AND points_delta > 0) OR
    (transaction_type = 'redeem'     AND points_delta < 0) OR
    (transaction_type = 'adjustment' AND points_delta != 0)
  );
