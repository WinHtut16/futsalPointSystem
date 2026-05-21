-- ============================================================
-- Redemption Requests — run AFTER supabase-fix-rls.sql
-- ============================================================

CREATE TABLE public.redemption_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  reward_id    UUID NOT NULL REFERENCES public.rewards(id)   ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES public.profiles(id),
  notes        TEXT
);

ALTER TABLE public.redemption_requests ENABLE ROW LEVEL SECURITY;

-- Customers: read own requests (all statuses)
CREATE POLICY "rr_customer_select"
  ON redemption_requests FOR SELECT
  USING (auth.uid() = customer_id OR is_admin());

-- Customers: create their own requests
CREATE POLICY "rr_customer_insert"
  ON redemption_requests FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Customers: cancel their own pending requests only
CREATE POLICY "rr_customer_cancel"
  ON redemption_requests FOR UPDATE
  USING (auth.uid() = customer_id AND status = 'pending')
  WITH CHECK (status = 'cancelled');

-- Admins: full access
CREATE POLICY "rr_admin"
  ON redemption_requests FOR ALL
  USING (is_admin());
