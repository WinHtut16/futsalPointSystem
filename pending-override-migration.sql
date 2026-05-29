-- pending-override-migration.sql
-- Run AFTER booking-system-migration.sql in Supabase SQL editor.

-- 1. Add override_request flag to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS override_request BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. New RPC: create an override booking whose slots start as active=false
--    so they don't conflict with the existing pending booking's active slots.
--    The unique partial index (uq_active_slot_per_hour) only covers active=true rows.
CREATE OR REPLACE FUNCTION create_override_booking_transaction(
  p_customer_id   UUID,
  p_booking_date  DATE,
  p_slots         JSONB,
  p_contact_name  TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id  UUID;
  v_seq         BIGINT;
  v_ref         TEXT;
  v_year        INT;
  v_slot        JSONB;
  v_price_total NUMERIC := 0;
  v_deposit     NUMERIC := 10000;
BEGIN
  -- Generate MYF-YYYY-NNNN ref using the same sequence as regular bookings
  v_seq  := nextval('booking_ref_seq');
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_ref  := 'MYF-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');

  -- Compute total price from slot payloads
  FOR v_slot IN SELECT value FROM jsonb_array_elements(p_slots) LOOP
    v_price_total := v_price_total + (v_slot->>'price')::NUMERIC;
  END LOOP;

  -- Insert booking record with override_request = true
  INSERT INTO bookings (
    customer_id, booking_date, status, deposit_received,
    deposit_total, price_total, points_awarded, ref,
    contact_name, contact_phone, override_request
  ) VALUES (
    p_customer_id, p_booking_date, 'pending', false,
    v_deposit, v_price_total, 0, v_ref,
    p_contact_name, p_contact_phone, true
  ) RETURNING id INTO v_booking_id;

  -- Insert slots with active=false — override does NOT claim the slot at creation.
  -- The slot becomes active only when admin confirms and the sync trigger fires.
  FOR v_slot IN SELECT value FROM jsonb_array_elements(p_slots) LOOP
    INSERT INTO booking_slots (booking_id, hour_start, tier, price, active)
    VALUES (
      v_booking_id,
      (v_slot->>'hour_start')::INT,
      v_slot->>'tier',
      (v_slot->>'price')::NUMERIC,
      false
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id',            v_booking_id,
    'ref',           v_ref,
    'status',        'pending',
    'deposit_total', v_deposit,
    'price_total',   v_price_total
  );
END;
$$;
