-- Fix: enforce_cancel_columns_immutable trigger was not resetting
-- points_cost_snapshot. A customer with direct anon-key access could
-- modify this column on their own pending request and be charged the
-- manipulated (lower) amount when an admin approves it.
--
-- Fix: add points_cost_snapshot to the reset block alongside the
-- other protected columns. CREATE OR REPLACE replaces the existing
-- function in-place — the trigger binding is preserved.
--
-- Run AFTER: rls-redemption-cancel-fix.sql

CREATE OR REPLACE FUNCTION enforce_cancel_columns_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF is_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admin: only status may change (to 'cancelled').
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
