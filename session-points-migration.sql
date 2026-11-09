-- ============================================================
-- Session points: rules, customer lookup, award/reversal engine.
--
-- Game and billiards award points automatically from their sessions.
-- This file holds the shared parts; each zone adds one trigger on its
-- own sessions table (game-points-migration.sql,
-- billiards-points-migration.sql) that calls sync_session_points().
--
--   1. point_rules(app): "N points per full block of M paid minutes".
--      Game: 10 per 60 min, active. Billiards: placeholder, OFF until the
--      owner sets it. Futsal keeps manual entry (no row).
--   2. set_point_rule(): the owner of that business edits its rule.
--   3. find_customer_by_phone(): counter staff attach a REGISTERED
--      customer to a session. Unregistered phones get nothing.
--   4. sync_session_points(): given a session's current state, makes the
--      ledger agree with it. Idempotent. Handles close, typed-in session,
--      correction, void and changing the customer, all the same way:
--        target = floor(paid / block) * points  (closed, not voided,
--                 customer attached; else 0)
--        already = what this session has given each customer so far
--        -> post the difference.
--      The rule is frozen per session on first use, so a later rule change
--      never re-prices an old session.
--   5. audit_points_adjustment() logs under the row's own business
--      (it was hard-coded to 'futsal').
--
-- Run AFTER: multi-business-points-migration.sql, audit-money-migration.sql
-- Safe to re-run.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.point_wallets') IS NULL THEN
    RAISE EXCEPTION 'Run multi-business-points-migration.sql first.';
  END IF;
  IF to_regprocedure('public.audit(text,text,text,text,text,text,jsonb,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Run audit-money-migration.sql first.';
  END IF;
END $$;

BEGIN;

-- ------------------------------------------------------------
-- 1. Rules
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.point_rules (
  app              TEXT        PRIMARY KEY CHECK (app IN ('futsal', 'game', 'billiards')),
  block_minutes    INTEGER     NOT NULL CHECK (block_minutes BETWEEN 1 AND 1440),
  points_per_block INTEGER     NOT NULL CHECK (points_per_block BETWEEN 0 AND 100000),
  is_active        BOOLEAN     NOT NULL DEFAULT false,
  updated_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.point_rules FROM anon, authenticated;
GRANT SELECT ON public.point_rules TO authenticated;
GRANT ALL ON public.point_rules TO service_role;

-- Not secret: customers may be shown "10 points per hour".
DROP POLICY IF EXISTS pr_select ON public.point_rules;
CREATE POLICY pr_select ON public.point_rules FOR SELECT TO authenticated USING (true);

INSERT INTO public.point_rules (app, block_minutes, points_per_block, is_active) VALUES
  ('game',      60, 10, true),
  ('billiards', 60,  0, false)
ON CONFLICT (app) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Editing a rule: the owner of that business only
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_point_rule(
  p_app              TEXT,
  p_block_minutes    INTEGER,
  p_points_per_block INTEGER,
  p_is_active        BOOLEAN
)
RETURNS public.point_rules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.point_rules;
  v_new public.point_rules;
BEGIN
  IF p_app IS NULL OR p_app NOT IN ('game', 'billiards') THEN
    RAISE EXCEPTION 'Points rules exist for game and billiards only.' USING errcode = '22023';
  END IF;
  IF public.app_role(p_app) IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Only the owner of this business can change its points rule.' USING errcode = '42501';
  END IF;
  IF p_block_minutes IS NULL OR p_block_minutes < 1 OR p_block_minutes > 1440 THEN
    RAISE EXCEPTION 'Block length must be between 1 and 1440 minutes.' USING errcode = '22023';
  END IF;
  IF p_points_per_block IS NULL OR p_points_per_block < 0 OR p_points_per_block > 100000 THEN
    RAISE EXCEPTION 'Points per block must be between 0 and 100000.' USING errcode = '22023';
  END IF;

  SELECT * INTO v_old FROM point_rules WHERE app = p_app FOR UPDATE;

  INSERT INTO point_rules (app, block_minutes, points_per_block, is_active, updated_by, updated_at)
  VALUES (p_app, p_block_minutes, p_points_per_block, COALESCE(p_is_active, false), auth.uid(), now())
  ON CONFLICT (app) DO UPDATE SET
    block_minutes    = EXCLUDED.block_minutes,
    points_per_block = EXCLUDED.points_per_block,
    is_active        = EXCLUDED.is_active,
    updated_by       = EXCLUDED.updated_by,
    updated_at       = EXCLUDED.updated_at
  RETURNING * INTO v_new;

  PERFORM public.audit(
    p_app, 'points.rule_changed',
    format('Points rule set to %s points per %s minutes (%s). Was %s.',
           v_new.points_per_block, v_new.block_minutes,
           CASE WHEN v_new.is_active THEN 'on' ELSE 'off' END,
           CASE WHEN v_old.app IS NULL THEN 'not set'
                ELSE format('%s per %s min (%s)', v_old.points_per_block, v_old.block_minutes,
                            CASE WHEN v_old.is_active THEN 'on' ELSE 'off' END) END),
    'point_rule', p_app, p_app,
    jsonb_build_object('before', to_jsonb(v_old), 'after', to_jsonb(v_new)),
    auth.uid()
  );

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.set_point_rule(TEXT, INTEGER, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_point_rule(TEXT, INTEGER, INTEGER, BOOLEAN) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Customer lookup for counter staff
-- ------------------------------------------------------------
-- Staff of ANY business may look up a customer: one account is shared by
-- all three. Accepts 09..., +959..., 959... with spaces or dashes. Exact
-- match only - no partial search, so staff cannot browse the customer list.
CREATE OR REPLACE FUNCTION public.normalize_mm_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN d LIKE '959%' THEN '0' || substr(d, 3)
    ELSE d
  END
  FROM (SELECT regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') AS d) x;
$$;

CREATE OR REPLACE FUNCTION public.find_customer_by_phone(p_phone TEXT)
RETURNS TABLE (id UUID, username TEXT, phone TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_phone TEXT := public.normalize_mm_phone(p_phone);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.my_apps()) THEN
    RAISE EXCEPTION 'Only staff can look up customers.' USING errcode = '42501';
  END IF;
  IF v_phone !~ '^09[0-9]{7,9}$' THEN
    RAISE EXCEPTION 'Enter a valid Myanmar phone number (e.g. 09XXXXXXXXX).' USING errcode = '22023';
  END IF;

  RETURN QUERY
    SELECT p.id, p.username::TEXT, p.phone::TEXT
      FROM profiles p
     WHERE p.role = 'customer' AND p.phone = v_phone;
END;
$$;

REVOKE ALL ON FUNCTION public.find_customer_by_phone(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_customer_by_phone(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Posting one ledger row with its session source (internal)
-- ------------------------------------------------------------
-- Same wallet/mirror logic as add_points_transaction, plus the session
-- source columns, and no balance floor: a reversal must always be recorded
-- even if the customer already spent the points (the wallet goes negative,
-- which blocks redemption until it recovers).
CREATE OR REPLACE FUNCTION public.post_session_points(
  p_customer_id  UUID,
  p_delta        INTEGER,
  p_type         TEXT,
  p_app          TEXT,
  p_source_kind  TEXT,
  p_session_id   UUID,
  p_paid_minutes INTEGER,
  p_note         TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF p_delta = 0 THEN
    RETURN;
  END IF;

  PERFORM lock_point_wallet(p_customer_id, p_app);

  UPDATE point_wallets
     SET balance = balance + p_delta, updated_at = now()
   WHERE user_id = p_customer_id AND app = p_app
  RETURNING balance INTO v_balance;

  IF p_app = 'futsal' THEN
    UPDATE profiles SET total_points = v_balance WHERE id = p_customer_id;
  END IF;

  INSERT INTO point_transactions (
    customer_id, points_delta, transaction_type, hours_played, note, created_by,
    app, source_kind, source_session_id
  ) VALUES (
    p_customer_id, p_delta, p_type,
    -- hours_played is numeric(4,2): a table left running for days must not
    -- make checkout fail on an overflow.
    CASE WHEN p_paid_minutes BETWEEN 0 AND 5999 THEN round(p_paid_minutes / 60.0, 2) END,
    p_note,
    (SELECT id FROM profiles WHERE id = auth.uid()),
    p_app, p_source_kind, p_session_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.post_session_points(UUID, INTEGER, TEXT, TEXT, TEXT, UUID, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 5. The engine: make the ledger agree with one session
-- ------------------------------------------------------------
-- p_eligible:     closed AND not voided (the zone trigger decides).
-- p_paid_minutes: billed minutes after waivers (game charged_minutes,
--                 billiards billed_minutes).
-- p_rule:         the session's frozen rule, or NULL if never frozen.
-- Returns the rule to store on the session (unchanged if already frozen;
-- frozen now when the session first becomes eligible with a customer).
--
-- Callers are the zone triggers, which run while the session row is locked
-- by the statement that changed it, so two calls for one session cannot
-- interleave. Wallet rows are locked inside post_session_points.
CREATE OR REPLACE FUNCTION public.sync_session_points(
  p_app          TEXT,
  p_session_id   UUID,
  p_customer_id  UUID,
  p_eligible     BOOLEAN,
  p_paid_minutes INTEGER,
  p_rule         JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind     TEXT;
  v_rule     JSONB := p_rule;
  v_target   UUID;
  v_points   INTEGER := 0;
  v_block    INTEGER;
  v_per      INTEGER;
  r          RECORD;
  v_had_rows BOOLEAN;
  v_delta    INTEGER;
  v_label    TEXT;
BEGIN
  IF p_app = 'game' THEN
    v_kind := 'game_session';  v_label := 'Game session';
  ELSIF p_app = 'billiards' THEN
    v_kind := 'billiards_session';  v_label := 'Billiards session';
  ELSE
    RAISE EXCEPTION 'Session points exist for game and billiards only.';
  END IF;

  IF p_eligible AND p_customer_id IS NOT NULL THEN
    v_target := p_customer_id;

    IF v_rule IS NULL THEN
      SELECT jsonb_build_object('block_minutes', block_minutes,
                                'points_per_block', points_per_block,
                                'is_active', is_active)
        INTO v_rule
        FROM point_rules WHERE app = p_app;
      -- No row at all: freeze "off" so a rule added later does not reach
      -- back to this session.
      v_rule := COALESCE(v_rule, jsonb_build_object('block_minutes', 60,
                                                    'points_per_block', 0,
                                                    'is_active', false));
    END IF;

    v_block := (v_rule->>'block_minutes')::INTEGER;
    v_per   := (v_rule->>'points_per_block')::INTEGER;
    IF (v_rule->>'is_active')::BOOLEAN AND v_block > 0 AND v_per > 0 THEN
      v_points := (GREATEST(COALESCE(p_paid_minutes, 0), 0) / v_block) * v_per;
    END IF;
  END IF;

  -- Take back from anyone who is no longer the session's customer.
  FOR r IN
    SELECT customer_id, SUM(points_delta)::INTEGER AS net
      FROM point_transactions
     WHERE app = p_app AND source_session_id = p_session_id
       AND customer_id IS DISTINCT FROM v_target
     GROUP BY customer_id
    HAVING SUM(points_delta) <> 0
  LOOP
    PERFORM post_session_points(r.customer_id, -r.net, 'adjustment', p_app, v_kind, p_session_id,
      p_paid_minutes,
      CASE WHEN p_eligible THEN v_label || ': customer changed, points moved'
           ELSE v_label || ': voided, points taken back' END);
  END LOOP;

  -- Bring the current customer to the target.
  IF v_target IS NOT NULL THEN
    SELECT COUNT(*) > 0, COALESCE(SUM(points_delta), 0)::INTEGER
      INTO v_had_rows, v_delta
      FROM point_transactions
     WHERE app = p_app AND source_session_id = p_session_id AND customer_id = v_target;

    v_delta := v_points - v_delta;

    IF v_delta <> 0 THEN
      PERFORM post_session_points(v_target, v_delta,
        CASE WHEN NOT v_had_rows AND v_delta > 0 THEN 'earn' ELSE 'adjustment' END,
        p_app, v_kind, p_session_id, p_paid_minutes,
        CASE WHEN NOT v_had_rows THEN v_label
             ELSE v_label || ': corrected' END);
    END IF;
  END IF;

  RETURN v_rule;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_session_points(TEXT, UUID, UUID, BOOLEAN, INTEGER, JSONB)
  FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 6. Adjustment audit: log under the row's own business
-- ------------------------------------------------------------
-- Body as in audit-money-migration.sql; only the business (was 'futsal')
-- and a session-specific summary change.
CREATE OR REPLACE FUNCTION public.audit_points_adjustment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_customer TEXT;
BEGIN
  IF new.transaction_type <> 'adjustment' THEN
    RETURN new;
  END IF;

  SELECT username INTO v_customer FROM public.profiles WHERE id = new.customer_id;

  PERFORM public.audit(
    COALESCE(new.app, 'futsal'), 'points.adjusted',
    format('Adjusted %s by %s%s points.%s',
           COALESCE(v_customer, 'a customer'),
           CASE WHEN new.points_delta > 0 THEN '+' ELSE '' END,
           new.points_delta,
           CASE WHEN COALESCE(btrim(new.note), '') = '' THEN ''
                WHEN new.source_session_id IS NOT NULL THEN ' ' || new.note || '.'
                ELSE ' Reason: ' || new.note END),
    'customer', new.customer_id::text, v_customer,
    jsonb_build_object('delta', new.points_delta, 'note', new.note,
                       'session_id', new.source_session_id),
    new.created_by
  );
  RETURN new;
END $$;

COMMIT;
