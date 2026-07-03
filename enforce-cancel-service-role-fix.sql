-- Fix: enforce_cancel_columns_immutable incorrectly resets resolved_at,
-- resolved_by, notes, and points_cost_snapshot when called from the service
-- role context (auth.uid() IS NULL). This caused every admin approve/reject
-- and every customer cancel (which go through the service-role API) to have
-- those columns silently cleared.
--
-- Fix: treat auth.uid() IS NULL (service role) the same as is_admin() —
-- allow the UPDATE through unrestricted. Only anon-key callers (auth.uid()
-- is set to a real UUID) who are not admins are subject to the column reset.
--
-- Run AFTER: redemption-cancel-snapshot-fix.sql

CREATE OR REPLACE FUNCTION enforce_cancel_columns_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Service role (auth.uid() IS NULL) and admin users pass through unchanged.
  IF auth.uid() IS NULL OR is_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admin anon-key caller: only status may change (to 'cancelled').
  -- Reset every other column to its pre-update value.
  NEW.customer_id          := OLD.customer_id;
  NEW.reward_id            := OLD.reward_id;
  NEW.requested_at         := OLD.requested_at;
  NEW.resolved_at          := OLD.resolved_at;
  NEW.resolved_by          := OLD.resolved_by;
  NEW.notes                := OLD.notes;
  NEW.points_cost_snapshot := OLD.points_cost_snapshot;

  RETURN NEW;
END;
$$;
