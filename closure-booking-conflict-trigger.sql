-- closure-booking-conflict-trigger.sql
-- DB-level guard: prevents a booking_slots INSERT on a closed date/slot.
-- Closes the TOCTOU gap between the app-level closure check (FIX 6) and
-- the actual INSERT — both the closure INSERT and the booking INSERT are
-- atomic at the DB level after this trigger is in place.
-- Run AFTER: override-booking-date-fix.sql

CREATE OR REPLACE FUNCTION public.check_slot_not_closed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Full-day closure check
  IF EXISTS (
    SELECT 1 FROM public.court_closures
    WHERE closure_date = NEW.booking_date
      AND hour_start IS NULL
  ) THEN
    RAISE EXCEPTION 'slot_closed'
      USING HINT = 'A full-day court closure exists for this date';
  END IF;

  -- Slot-specific closure check
  IF EXISTS (
    SELECT 1 FROM public.court_closures
    WHERE closure_date = NEW.booking_date
      AND hour_start = NEW.hour_start
  ) THEN
    RAISE EXCEPTION 'slot_closed'
      USING HINT = 'A court closure exists for this specific slot';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_no_booking_on_closed_slot ON public.booking_slots;

CREATE TRIGGER enforce_no_booking_on_closed_slot
BEFORE INSERT ON public.booking_slots
FOR EACH ROW
EXECUTE FUNCTION public.check_slot_not_closed();
