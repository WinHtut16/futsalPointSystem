-- booking-archive-migration.sql
-- Adds soft-archive support to bookings.
-- Admin can archive (soft delete); superadmin can hard delete or purge.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Index so non-history queries filtering is_archived=false stay fast.
CREATE INDEX IF NOT EXISTS idx_bookings_is_archived ON bookings (is_archived)
  WHERE is_archived = FALSE;
