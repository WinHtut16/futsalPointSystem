-- trigger-else-branch-fix.sql
-- Adds an ELSE branch to sync_booking_slots_active that raises a loud
-- exception for any unrecognised status value. Without this, a future
-- migration introducing a new status (e.g. 'disputed') would silently
-- leave booking_slots.active in its previous state.

CREATE OR REPLACE FUNCTION public.sync_booking_slots_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'closed') THEN
    UPDATE public.booking_slots SET active = false
    WHERE booking_id = NEW.id AND active;

  ELSIF NEW.status = 'confirmed' THEN
    UPDATE public.booking_slots SET active = true
    WHERE booking_id = NEW.id AND NOT active;

  ELSIF NEW.status = 'pending' THEN
    -- pending: active state is set at INSERT time and must not be overwritten
    -- here. Normal bookings start active=true; override bookings start
    -- active=false. Both are intentional — do nothing on a pending transition.
    NULL;

  ELSE
    RAISE EXCEPTION 'sync_booking_slots_active: unhandled status: %', NEW.status
      USING HINT = 'Add a branch for this status in sync_booking_slots_active()';
  END IF;

  RETURN NEW;
END;
$$;
