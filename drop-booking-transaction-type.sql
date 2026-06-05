-- ============================================================
-- Remove dead 'booking' transaction_type from CHECK constraint.
--
-- The 'booking' type was added in booking-system-migration.sql
-- but automatic booking-triggered point logic was removed.
-- No rows exist or will ever be inserted with transaction_type='booking'.
-- The CLAUDE.md explicitly states: "do not re-add automatic
-- booking-triggered point logic."
--
-- Verify first: SELECT COUNT(*) FROM point_transactions WHERE transaction_type='booking';
-- Expected result: 0.
--
-- Run AFTER: booking-system-migration.sql
-- ============================================================

ALTER TABLE point_transactions
  DROP CONSTRAINT IF EXISTS point_transactions_transaction_type_check;

ALTER TABLE point_transactions
  ADD CONSTRAINT point_transactions_transaction_type_check
    CHECK (transaction_type IN ('earn', 'redeem', 'adjustment'));
