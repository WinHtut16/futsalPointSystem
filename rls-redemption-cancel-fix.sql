-- ============================================================
-- RLS Fix: tighten rr_customer_cancel policy
--
-- Problem: WITH CHECK (status = 'cancelled') only restricts the
-- status column. A customer calling the anon key directly could
-- also mutate notes, resolved_at, resolved_by, or reward_id on
-- their own pending request.
--
-- Fix: drop the permissive UPDATE policy for customers and replace
-- it with a trigger that enforces column immutability. The trigger
-- runs BEFORE UPDATE and resets any non-status column to its OLD
-- value when the actor is not an admin. The RLS policy is kept
-- minimal: USING (own pending row), no WITH CHECK needed because
-- the trigger handles column-level enforcement.
--
-- The app never writes these columns from the customer path — the
-- PATCH /api/redemptions/[id] cancel branch uses service-role and
-- only sets status='cancelled'. This closes the anon-key bypass.
--
-- Run AFTER: redemption-requests-migration.sql
-- ============================================================

-- 1. Replace the customer UPDATE policy (remove the permissive WITH CHECK)
DROP POLICY IF EXISTS "rr_customer_cancel" ON public.redemption_requests;

CREATE POLICY "rr_customer_cancel"
  ON redemption_requests FOR UPDATE
  USING (auth.uid() = customer_id AND status = 'pending')
  WITH CHECK (auth.uid() = customer_id AND status = 'cancelled');

-- 2. Trigger: reset non-status columns to OLD values for non-admin actors
CREATE OR REPLACE FUNCTION enforce_cancel_columns_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Admins (is_admin()) may freely update any column.
  IF is_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admin: only status may change (to 'cancelled').
  -- Reset every other column to its pre-update value.
  NEW.customer_id  := OLD.customer_id;
  NEW.reward_id    := OLD.reward_id;
  NEW.requested_at := OLD.requested_at;
  NEW.resolved_at  := OLD.resolved_at;
  NEW.resolved_by  := OLD.resolved_by;
  NEW.notes        := OLD.notes;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_columns_immutable ON public.redemption_requests;

CREATE TRIGGER trg_cancel_columns_immutable
  BEFORE UPDATE ON public.redemption_requests
  FOR EACH ROW EXECUTE FUNCTION enforce_cancel_columns_immutable();
