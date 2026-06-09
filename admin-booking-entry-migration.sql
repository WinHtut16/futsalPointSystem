-- admin-booking-entry-migration.sql
-- Run AFTER all previous migrations in Supabase SQL editor.

-- 1. Make customer_id nullable (guest bookings have no linked account)
DO $$
BEGIN
  IF (SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'bookings'
        AND column_name  = 'customer_id') = 'NO'
  THEN
    ALTER TABLE public.bookings ALTER COLUMN customer_id DROP NOT NULL;
  END IF;
END $$;

-- 2. Add source column with check constraint and default
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS source TEXT
    CHECK (source IN ('online','phone','walk_in','other'))
    DEFAULT 'online';

-- 3. Add guest fields
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- 4. Add internal notes (admin-only, never shown to customers)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 5. Backfill source for all existing bookings
UPDATE public.bookings SET source = 'online' WHERE source IS NULL;

-- 6. New RPC: create_admin_booking_transaction
--    Used by POST /api/admin/bookings (admin-only route).
--    Differs from create_booking_transaction in:
--      - customer_id optional (guest bookings)
--      - accepts source, guest_name, guest_phone, internal_notes
--      - accepts deposit_total override and deposit_received flag
--      - p_is_override=true inserts slots active=false + override_request=true
--        (same mechanism as create_override_booking_transaction)
CREATE OR REPLACE FUNCTION public.create_admin_booking_transaction(
  p_customer_id     UUID    DEFAULT NULL,
  p_guest_name      TEXT    DEFAULT NULL,
  p_guest_phone     TEXT    DEFAULT NULL,
  p_booking_date    DATE,
  p_slots           JSONB,
  p_deposit_total   INTEGER DEFAULT 10000,
  p_deposit_received BOOLEAN DEFAULT FALSE,
  p_source          TEXT    DEFAULT 'phone',
  p_internal_notes  TEXT    DEFAULT NULL,
  p_is_override     BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id  UUID;
  v_ref         TEXT;
  v_slot        JSONB;
  v_price_total NUMERIC := 0;
  v_status      TEXT;
  v_active      BOOLEAN;
BEGIN
  -- Validate: must supply either a linked customer or a guest name
  IF p_customer_id IS NULL AND (p_guest_name IS NULL OR trim(p_guest_name) = '') THEN
    RAISE EXCEPTION 'customer_required';
  END IF;

  -- Validate slot count (mirrors create_booking_transaction)
  IF p_slots IS NULL OR jsonb_typeof(p_slots) != 'array' THEN
    RAISE EXCEPTION 'slots_required';
  END IF;
  IF jsonb_array_length(p_slots) < 1 OR jsonb_array_length(p_slots) > 2 THEN
    RAISE EXCEPTION 'A booking must contain 1 or 2 slots (got %).', jsonb_array_length(p_slots);
  END IF;

  -- Generate MYF-YYYY-NNNN ref using the shared sequence
  v_ref := 'MYF-' || to_char(p_booking_date, 'YYYY') || '-'
           || lpad(nextval('public.booking_ref_seq')::text, 4, '0');

  -- Compute total price from slot payloads
  FOR v_slot IN SELECT value FROM jsonb_array_elements(p_slots) LOOP
    v_price_total := v_price_total + (v_slot->>'price')::NUMERIC;
  END LOOP;

  -- Determine status and whether slots are active
  IF p_is_override THEN
    -- Override: slot claimed inactive; admin confirms later which cancels
    -- the conflicting pending booking (existing confirm_override_booking mechanism)
    v_status := 'pending';
    v_active  := false;
  ELSIF p_deposit_received THEN
    v_status := 'confirmed';
    v_active  := true;
  ELSE
    v_status := 'pending';
    v_active  := true;
  END IF;

  -- Insert booking row
  INSERT INTO public.bookings (
    ref,
    customer_id,
    guest_name,
    guest_phone,
    booking_date,
    status,
    deposit_total,
    price_total,
    deposit_received,
    override_request,
    source,
    internal_notes,
    confirmed_at
  ) VALUES (
    v_ref,
    p_customer_id,
    p_guest_name,
    p_guest_phone,
    p_booking_date,
    v_status,
    p_deposit_total,
    v_price_total::INTEGER,
    CASE WHEN p_is_override THEN false ELSE p_deposit_received END,
    p_is_override,
    p_source,
    p_internal_notes,
    CASE WHEN NOT p_is_override AND p_deposit_received THEN now() ELSE NULL END
  ) RETURNING id INTO v_booking_id;

  -- Insert slot rows (booking_date is a NOT NULL column on booking_slots)
  FOR v_slot IN SELECT value FROM jsonb_array_elements(p_slots) LOOP
    INSERT INTO public.booking_slots (booking_id, booking_date, hour_start, tier, price, active)
    VALUES (
      v_booking_id,
      p_booking_date,
      (v_slot->>'hour_start')::INT,
      v_slot->>'tier',
      (v_slot->>'price')::INT,
      v_active
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id',            v_booking_id,
    'ref',           v_ref,
    'status',        v_status,
    'deposit_total', p_deposit_total,
    'price_total',   v_price_total::INTEGER,
    'had_conflict',  p_is_override
  );
END;
$$;
