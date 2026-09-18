\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- Performance audit (2026-09-18): perf-rls-initplan-migration.sql.
--
--   1. Every billiards RLS policy's qual/with_check must now wrap its
--      is_active_admin()/is_superadmin() call as a scalar subquery, and must
--      grant/deny exactly what it did before — this is an optimization, not a
--      permission change, so 90/93/94/95's assertions passing again after
--      this file loads (see run.sh's order) is itself part of the proof.
--   2. billiards.sessions_summary() must return the real sums for any active
--      billiards admin (same rank as sessions_select, not superadmin-only),
--      zero out under RLS for an account with no billiards grant, and be
--      unreachable at all for anon (EXECUTE was revoked, not just RLS-empty).
--
-- Actors reused from 00-scaffold.sql/90-access.sql/93-crosstenant.sql:
--   NEWGUY     44444444-...  billiards admin, not superadmin
--   BMGR       22222222-...  billiards app_access role=superadmin
--   CUSTOMER1  55555555-...  no app_access rows at all
--   STRANGER   66666666-...  app_access for 'futsal' only (added in 93)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. RLS initplan wrapping: every helper call is wrapped, nothing was
--      missed or added by hand ─────────────────────────────────────────────

-- Postgres's stored/deparsed form is `( SELECT billiards.is_superadmin() AS
-- is_superadmin)` (verified against a real 17 instance) — an alias, extra
-- spacing, and casing that can plausibly shift across Postgres versions, so
-- this checks structure (a SELECT is present wherever the helper is called)
-- rather than pinning the exact deparsed text.
select chk('every billiards SELECT/USING policy wraps is_active_admin()/is_superadmin() in a scalar subquery',
  (select count(*)::int from pg_policies
    where schemaname = 'billiards'
      and qual ~* 'is_(active_admin|superadmin)\(\)'
      and qual !~* 'select'),
  0);

select chk('every billiards WITH CHECK policy wraps is_active_admin()/is_superadmin() in a scalar subquery',
  (select count(*)::int from pg_policies
    where schemaname = 'billiards'
      and with_check ~* 'is_(active_admin|superadmin)\(\)'
      and with_check !~* 'select'),
  0);

select chk('control: the wrap did not silently drop any billiards policy (still 19)',
  (select count(*)::int from pg_policies where schemaname = 'billiards'),
  19);

-- ── 2. sessions_summary: isolated fixture, far-future dates so no other
--      file's fixtures (all created at/near now()) can leak into the sum ──

insert into billiards.pool_tables (id, name)
  values ('98883333-0000-0000-0000-000000000001', 'Perf test table');

insert into billiards.sessions
  (id, table_id, opened_by, started_at, ended_at, status,
   billed_minutes, time_charge, food_total, total, payment_method, paid_at)
values
  ('98884444-0000-0000-0000-000000000001', '98883333-0000-0000-0000-000000000001',
   '44444444-4444-4444-4444-444444444444', '2030-01-01 09:00+00', '2030-01-01 10:00+00',
   'closed', 60, 5000, 1000, 6000, 'cash', '2030-01-01 10:00:00+00'),
  ('98884444-0000-0000-0000-000000000002', '98883333-0000-0000-0000-000000000001',
   '44444444-4444-4444-4444-444444444444', '2030-01-01 11:00+00', '2030-01-01 11:30+00',
   'closed', 30, 3000, 0, 3000, 'cash', '2030-01-01 11:30:00+00');

-- A third session outside the [p_from, p_to) window used below — proves the
-- function is actually bounding by paid_at, not just summing every closed
-- session that happens to exist.
insert into billiards.sessions
  (id, table_id, opened_by, started_at, ended_at, status,
   billed_minutes, time_charge, food_total, total, payment_method, paid_at)
values
  ('98884444-0000-0000-0000-000000000003', '98883333-0000-0000-0000-000000000001',
   '44444444-4444-4444-4444-444444444444', '2030-02-01 09:00+00', '2030-02-01 10:00+00',
   'closed', 60, 9999, 9999, 19998, 'cash', '2030-02-01 10:00:00+00');

select chk('control: NEWGUY (billiards admin) can still see the fixture sessions directly (RLS unaffected by the wrap)',
  public.test_value('44444444-4444-4444-4444-444444444444','authenticated',
    $$(select count(*) from billiards.sessions where table_id = '98883333-0000-0000-0000-000000000001')$$),
  '3');

select chk('NEWGUY (plain billiards admin — sessions_summary is not superadmin-gated) gets the correct bounded sums',
  public.test_value('44444444-4444-4444-4444-444444444444','authenticated',
    $$(select row(revenue, time_revenue, food_revenue, session_count)::text
         from billiards.sessions_summary('2030-01-01T00:00:00+00', '2030-01-02T00:00:00+00'))$$),
  '(9000,8000,1000,2)');

select chk('BMGR (billiards superadmin) gets the same correct sums',
  public.test_value('22222222-2222-2222-2222-222222222222','authenticated',
    $$(select row(revenue, time_revenue, food_revenue, session_count)::text
         from billiards.sessions_summary('2030-01-01T00:00:00+00', '2030-01-02T00:00:00+00'))$$),
  '(9000,8000,1000,2)');

select chk('all-time bound (no args) also picks up the out-of-window third fixture session',
  public.test_value('44444444-4444-4444-4444-444444444444','authenticated',
    $$(select session_count from billiards.sessions_summary() where session_count >= 3)$$)::int >= 3,
  true);

select chk('STRANGER (futsal-only grant, no billiards access) gets zeros, not an error — RLS-filtered, same as an empty table',
  public.test_value('66666666-6666-6666-6666-666666666666','authenticated',
    $$(select row(revenue, time_revenue, food_revenue, session_count)::text
         from billiards.sessions_summary('2030-01-01T00:00:00+00', '2030-01-02T00:00:00+00'))$$),
  '(0,0,0,0)');

-- EXECUTE is granted to `authenticated` broadly (not scoped per app the way a
-- SECURITY DEFINER write RPC's own guard would be), so a real admin of a
-- SIBLING business is the case that actually exercises the boundary here —
-- stronger than STRANGER (a grant for an unrelated app) or CUSTOMER1 (no
-- grant at all), because SHOPSTAFF genuinely is an active, real admin
-- somewhere, just not billiards. RLS is what has to stop them, same read-path
-- pattern 93-crosstenant.sql already proved for billiards.app_settings (1.3):
-- zero visible rows, not an exception, because this is a SELECT under RLS,
-- not a SECURITY DEFINER function with its own in-body guard.
select chk('SHOPSTAFF (game admin, no billiards access) also gets zeros',
  public.test_value('33333333-3333-3333-3333-333333333333','authenticated',
    $$(select row(revenue, time_revenue, food_revenue, session_count)::text
         from billiards.sessions_summary('2030-01-01T00:00:00+00', '2030-01-02T00:00:00+00'))$$),
  '(0,0,0,0)');

select chk('CUSTOMER1 (zero app_access rows) also gets zeros',
  public.test_value('55555555-5555-5555-5555-555555555555','authenticated',
    $$(select row(revenue, time_revenue, food_revenue, session_count)::text
         from billiards.sessions_summary('2030-01-01T00:00:00+00', '2030-01-02T00:00:00+00'))$$),
  '(0,0,0,0)');

select chk('anon is denied at the grant, before the body runs (EXECUTE revoked, not just RLS-empty)',
  public.test_call(null, 'anon',
    $$billiards.sessions_summary('2030-01-01T00:00:00+00'::timestamptz, '2030-01-02T00:00:00+00'::timestamptz)$$)
  ~~ '%permission denied for function%',
  true);
