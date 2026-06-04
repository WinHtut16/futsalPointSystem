-- override-conflict-lock-fix.sql
-- Moves the pending-slot validation inside the RPC using SELECT FOR UPDATE,
-- making the check-and-insert atomic and closing the TOCTOU window between
-- the app-layer guard and the RPC call.
-- Also retains the booking_date fix from override-booking-date-fix.sql.
-- Run AFTER: override-booking-date-fix.sql

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
  v_booking_id             UUID;
  v_seq                    BIGINT;
  v_ref                    TEXT;
  v_year                   INT;
  v_slot                   JSONB;
  v_price_total            NUMERIC := 0;
  v_deposit                NUMERIC := 10000;
  v_conflicting_booking_id UUID;
BEGIN
  -- Atomically verify and lock each slot's existing pending booking.
  -- FOR UPDATE on bookings prevents a concurrent admin confirm from racing
  -- between the app-layer check and this INSERT.
  FOR v_slot IN SELECT value FROM jsonb_array_elements(p_slots) LOOP
    SELECT b.id INTO v_conflicting_booking_id
    FROM bookings b
    INNER JOIN booking_slots bs ON bs.booking_id = b.id
    WHERE bs.booking_date = p_booking_date
      AND bs.hour_start   = (v_slot->>'hour_start')::INT
      AND bs.active       = true
      AND b.status        = 'pending'
    FOR UPDATE OF b;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'no_pending_conflict'
        USING HINT = 'No pending booking exists for this slot — override not valid';
    END IF;
  END LOOP;

  v_seq  := nextval('booking_ref_seq');
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_ref  := 'MYF-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');

  FOR v_slot IN SELECT value FROM jsonb_array_elements(p_slots) LOOP
    v_price_total := v_price_total + (v_slot->>'price')::NUMERIC;
  END LOOP;

  INSERT INTO bookings (
    customer_id, booking_date, status, deposit_received,
    deposit_total, price_total, points_awarded, ref,
    contact_name, contact_phone, override_request
  ) VALUES (
    p_customer_id, p_booking_date, 'pending', false,
    v_deposit, v_price_total, 0, v_ref,
    p_contact_name, p_contact_phone, true
  ) RETURNING id INTO v_booking_id;

  FOR v_slot IN SELECT value FROM jsonb_array_elements(p_slots) LOOP
    INSERT INTO booking_slots (
      booking_id,
      booking_date,
      hour_start,
      tier,
      price,
      active
    ) VALUES (
      v_booking_id,
      p_booking_date,
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
