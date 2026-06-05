-- ============================================================
-- Drop dead bookings.points_awarded column.
--
-- This column was added in booking-system-migration.sql for
-- automatic booking-triggered point logic that was subsequently
-- removed. It has never been written by the application since
-- that removal and will never be written in future.
--
-- Verify first: SELECT COUNT(*) FROM bookings WHERE points_awarded = true;
-- Expected result: 0.
--
-- Run AFTER: booking-system-migration.sql
-- ============================================================

ALTER TABLE bookings
  DROP COLUMN IF EXISTS points_awarded;
