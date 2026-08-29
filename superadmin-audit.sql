-- ============================================================
-- superadmin-audit.sql
-- READ ONLY. Changes nothing. Run the whole file in one go in the SQL Editor.
--
-- Before deleting any account, find out what it is attached to. Two very
-- different things can happen on delete, and the schema decides which:
--
--   CASCADE   rows are silently deleted along with the account. bookings,
--             point_transactions and redemption_requests all cascade from
--             profiles.customer_id. Deleting an account that was ever used as a
--             CUSTOMER destroys that history with no warning.
--
--   NO ACTION the delete is refused. point_transactions.created_by,
--             cms_posts.created_by, court_closures.created_by and
--             redemption_requests.resolved_by all point at profiles with no ON
--             DELETE clause, so an account that ever acted as an ADMIN cannot be
--             deleted at all. That refusal is correct - it is what keeps history
--             attributable. Do NOT work around it by nulling those columns.
--
-- The function below is created in pg_temp, so it disappears when the session
-- ends and leaves nothing behind. It walks every foreign key that actually
-- points at profiles or auth.users, rather than a hand-written list, so it stays
-- correct as the schema grows.
-- ============================================================

CREATE OR REPLACE FUNCTION pg_temp.audit_account(p_email TEXT)
RETURNS TABLE (
  account            TEXT,
  referencing_table  TEXT,
  referencing_column TEXT,
  on_delete          TEXT,
  rows_affected      BIGINT,
  verdict            TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  r   RECORD;
  uid UUID;
  n   BIGINT;
  hit BOOLEAN := FALSE;   -- NOT plpgsql's FOUND: that is true whenever the
                          -- loop iterated at all, which it always does.
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = p_email;

  IF uid IS NULL THEN
    account := p_email; referencing_table := '(no such account)';
    RETURN NEXT;
    RETURN;
  END IF;

  FOR r IN
    SELECT c.conrelid::regclass::TEXT AS tbl,
           a.attname::TEXT            AS col,
           CASE c.confdeltype
             WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
             WHEN 'c' THEN 'CASCADE'   WHEN 'n' THEN 'SET NULL'
             WHEN 'd' THEN 'SET DEFAULT'
           END                        AS del
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.contype = 'f'
      AND c.confrelid IN ('public.profiles'::regclass, 'auth.users'::regclass)
    ORDER BY 1, 2
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.tbl, r.col)
      INTO n USING uid;

    -- profiles.id is the account's own row; it always goes with the auth user,
    -- so reporting it for every account is just noise.
    CONTINUE WHEN r.tbl = 'profiles' AND r.col = 'id';

    IF n > 0 THEN
      account            := p_email;
      referencing_table  := r.tbl;
      referencing_column := r.col;
      on_delete          := r.del;
      rows_affected      := n;
      hit                := TRUE;
      verdict := CASE
        WHEN r.tbl = 'app_access' THEN 'grant removed with the account - expected'
        WHEN r.del = 'CASCADE'  THEN 'THESE ROWS WOULD BE DELETED'
        WHEN r.del = 'SET NULL' THEN 'column would be blanked, row kept'
        ELSE 'DELETE WILL BE REFUSED - keep the account, demote it instead'
      END;
      RETURN NEXT;
    END IF;
  END LOOP;

  IF NOT hit THEN
    account := p_email; referencing_table := '(nothing references it - safe to delete)';
    RETURN NEXT;
  END IF;
END $$;

-- ── The three accounts proposed for removal ──────────────────────────────────
SELECT * FROM pg_temp.audit_account('winhtutcentury@gmail.com')
UNION ALL
SELECT * FROM pg_temp.audit_account('09777219771@akoatp.com')
UNION ALL
SELECT * FROM pg_temp.audit_account('thinyadanaroo43@gmail.com')
ORDER BY account, referencing_table;
