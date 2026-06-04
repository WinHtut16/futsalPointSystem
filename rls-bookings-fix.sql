-- ============================================================
-- RLS Fix: bookings UPDATE policy WITH CHECK clause
--
-- Problem: bookings_update_own_or_admin had no WITH CHECK clause,
-- allowing a customer to set status='confirmed' directly via the
-- Supabase REST API (anon key + customer JWT), bypassing the app layer.
--
-- Fix: add WITH CHECK so customers can only write status='cancelled'.
-- Admins may write any status value.
--
-- Note: PATCH /api/bookings/[id]/route.ts already restricts customers
-- to action='cancel' at the application layer (line 46 guard). This
-- migration adds a matching RLS defence-in-depth layer.
--
-- Run AFTER: booking-system-migration.sql
-- ============================================================

DROP POLICY IF EXISTS "bookings_update_own_or_admin" ON public.bookings;

CREATE POLICY "bookings_update_own_or_admin"
  ON public.bookings FOR UPDATE
  USING (
    auth.uid() = customer_id
    OR is_admin()
  )
  WITH CHECK (
    is_admin()
    OR (
      auth.uid() = customer_id
      AND status = 'cancelled'
    )
  );
