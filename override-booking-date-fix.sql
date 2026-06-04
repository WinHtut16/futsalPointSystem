-- override-booking-date-fix.sql
-- Fix: booking_date was missing from booking_slots INSERT in
-- create_override_booking_transaction, causing NOT NULL violation on
-- every override booking attempt (silent 500 rollback).
-- Run AFTER: pending-override-migration.sql

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
