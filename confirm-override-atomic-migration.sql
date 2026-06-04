-- ============================================================
-- Atomic override confirmation RPC
--
-- Problem: PATCH /api/bookings/[id] confirmed an override booking
-- in two separate DB calls — cancel conflicting bookings, then
-- confirm the override. A crash between the two steps left
-- conflicting bookings cancelled but the override still pending
-- (orphaned slot state).
--
-- Fix: single SECURITY DEFINER function wraps both operations in
-- one transaction with FOR UPDATE row-lock to prevent concurrent
-- double-confirms.
--
-- Run AFTER: pending-override-migration.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirm_override_booking(
  p_booking_id UUID,
  p_admin_id   UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_slot    booking_slots%ROWTYPE;
BEGIN
  -- Lock the override booking row to prevent concurrent confirms.
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
    AND override_request = true
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found'
      USING HINT = 'Booking does not exist, is not an override, or is not pending';
  END IF;

  -- For each slot in this override booking, cancel all conflicting PENDING bookings
  -- that currently hold the same (date, hour_start) as an active slot.
  FOR v_slot IN
    SELECT * FROM booking_slots WHERE booking_id = p_booking_id
  LOOP
    UPDATE bookings
    SET status = 'cancelled',
        cancelled_at = now()
    WHERE id IN (
      SELECT bs.booking_id
      FROM booking_slots bs
      WHERE bs.booking_date = v_slot.booking_date
        AND bs.hour_start   = v_slot.hour_start
        AND bs.active       = true
        AND bs.booking_id  != p_booking_id
    )
    AND status = 'pending';
  END LOOP;

  -- Confirm the override booking.
  -- sync_booking_slots_active trigger sets its slots active=true.
  UPDATE bookings
  SET status       = 'confirmed',
      deposit_received = true,
      confirmed_at = now()
  WHERE id = p_booking_id;

END;
$$;
