\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- Game shop perf migration (game-perf-migration.sql): RLS initPlan wrapping,
-- the missing indexes, and the two new RPCs (current_staff, report_summary).
--
-- Structural checks (pg_policies / pg_indexes) prove the migration applied.
-- Behavioural checks prove it didn't change WHO the policies admit - only how
-- often the check runs - by exercising the same three account shapes
-- 93-crosstenant.sql established:
--
--   SHOPSTAFF  33333333-...  game app_access role=admin, active game.staff row
--              -> should see game rows and pass is_active_staff()
--   CUSTOMER1  55555555-...  zero app_access rows, no game.staff row
--              -> should see nothing and fail every guard
--   STRANGER   66666666-...  app_access for 'futsal' only (no game grant)
--              -> proves a grant for the WRONG business is still denied, not
--                 just "denied when there are zero grants at all"
--
-- All three are reused from earlier files, not recreated here.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Fixtures: stations, a product, and three closed sessions with known,
-- deterministic totals, dated relative to now() (not fixed calendar dates) so
-- this file's assertions hold regardless of when the suite runs.
-- ─────────────────────────────────────────────────────────────────────────────

insert into game.stations (id, name, tier, sort_order)
  values ('99990000-0000-0000-0000-000000000001','TV 20','PS4', 199);
insert into game.stations (id, name, tier, sort_order)
  values ('99990000-0000-0000-0000-000000000002','TV 21','PS5', 198);
insert into game.products (id, name_en, name_my, category, price, stock)
  values ('99991111-0000-0000-0000-000000000001','Chips','Chips','snack', 500, 50);

-- Session A: 250 days ago. Old and alone - nothing else in the fixture data
-- shares its distinct calendar day. This is the exact shape that broke the
-- pre-fix "all" byDay: distinctDays(current) counted 3 distinct selling days
-- across A/B/C and walked back only 3 days from today, missing A's day (and
-- its revenue) off the front of the chart entirely.
insert into game.sessions
  (id, station_id, station_name, tier, rate_per_hour, minutes, charged_minutes,
   playtime_total, snacks_total, total, created_by, created_at)
values
  ('99992222-0000-0000-0000-000000000001', '99990000-0000-0000-0000-000000000001',
   'TV 20', 'PS4', 3000, 60, 60, 3000, 0, 3000,
   '33333333-3333-3333-3333-333333333333', now() - interval '250 days'),
  ('99992222-0000-0000-0000-000000000002', '99990000-0000-0000-0000-000000000002',
   'TV 21', 'PS5', 5000, 60, 60, 5000, 500, 5500,
   '33333333-3333-3333-3333-333333333333', now() - interval '1 day'),
  ('99992222-0000-0000-0000-000000000003', '99990000-0000-0000-0000-000000000001',
   'TV 20', 'PS4', 3000, 40, 40, 2000, 0, 2000,
   '33333333-3333-3333-3333-333333333333', now());

insert into game.order_lines (id, session_id, product_id, product_name, qty, unit_price, line_total)
  values ('99993333-0000-0000-0000-000000000001', '99992222-0000-0000-0000-000000000002',
          '99991111-0000-0000-0000-000000000001', 'Chips', 1, 500, 500);

-- For the stock_movements_select behavioural pair below - this is the table
-- that had ZERO select policies at all until game-corrections-migration.sql's
-- guard fix, so it gets its own dedicated row rather than reusing another
-- table's fixture.
insert into game.stock_movements (id, product_id, change, reason, created_by)
  values ('99994444-0000-0000-0000-000000000001', '99991111-0000-0000-0000-000000000001',
          -1, 'sale', '33333333-3333-3333-3333-333333333333');

-- ════════════════════════════════════════════════════════════════════════════
-- 1. RLS policies still wrap the staff/superadmin check in a subquery
-- ════════════════════════════════════════════════════════════════════════════
-- pg_policies.qual / .with_check are pg_get_expr()'d back to text, so a
-- wrapped call round-trips as literally containing "(select". This is a
-- structural check on the migration, not a behavioural one - section 2 below
-- proves the wrapping didn't change who gets past it.

select chk('staff_select: wraps is_superadmin()',
  (select qual ~* '\(\s*select' from pg_policies
    where schemaname='game' and tablename='staff' and policyname='staff_select'), true);
select chk('staff_write_superadmin: USING and WITH CHECK both wrapped',
  (select qual ~* '\(\s*select' and with_check ~* '\(\s*select' from pg_policies
    where schemaname='game' and tablename='staff' and policyname='staff_write_superadmin'), true);

select chk('stations_select: wraps is_active_staff()',
  (select qual ~* '\(\s*select' from pg_policies
    where schemaname='game' and tablename='stations' and policyname='stations_select'), true);
select chk('stations_write_superadmin: USING and WITH CHECK both wrapped',
  (select qual ~* '\(\s*select' and with_check ~* '\(\s*select' from pg_policies
    where schemaname='game' and tablename='stations' and policyname='stations_write_superadmin'), true);

select chk('pricing_select: wraps is_active_staff()',
  (select qual ~* '\(\s*select' from pg_policies
    where schemaname='game' and tablename='pricing' and policyname='pricing_select'), true);
select chk('pricing_write_superadmin: USING and WITH CHECK both wrapped',
  (select qual ~* '\(\s*select' and with_check ~* '\(\s*select' from pg_policies
    where schemaname='game' and tablename='pricing' and policyname='pricing_write_superadmin'), true);

select chk('products_select: wraps is_active_staff()',
  (select qual ~* '\(\s*select' from pg_policies
    where schemaname='game' and tablename='products' and policyname='products_select'), true);
select chk('products_write_superadmin: USING and WITH CHECK both wrapped',
  (select qual ~* '\(\s*select' and with_check ~* '\(\s*select' from pg_policies
    where schemaname='game' and tablename='products' and policyname='products_write_superadmin'), true);

select chk('sessions_select: wraps is_active_staff()',
  (select qual ~* '\(\s*select' from pg_policies
    where schemaname='game' and tablename='sessions' and policyname='sessions_select'), true);
select chk('order_lines_select: wraps is_active_staff()',
  (select qual ~* '\(\s*select' from pg_policies
    where schemaname='game' and tablename='order_lines' and policyname='order_lines_select'), true);
select chk('stock_movements_select: wraps is_active_staff()',
  (select qual ~* '\(\s*select' from pg_policies
    where schemaname='game' and tablename='stock_movements' and policyname='stock_movements_select'), true);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. The wrapping did not change who the policies admit
-- ════════════════════════════════════════════════════════════════════════════
-- test_value switches to the `authenticated` role for real, unlike a plain
-- query in this script (which runs as the postgres superuser and bypasses RLS
-- outright) - so these are the only checks in this file that actually
-- exercise RLS rather than the SECURITY DEFINER functions' own guards.

select chk('game admin (SHOPSTAFF) sees both fixture stations via RLS',
  public.test_value('33333333-3333-3333-3333-333333333333','authenticated',
    $$select count(*) from game.stations
       where id in ('99990000-0000-0000-0000-000000000001','99990000-0000-0000-0000-000000000002')$$),
  '2');
select chk('no-grant account (CUSTOMER1) sees neither',
  public.test_value('55555555-5555-5555-5555-555555555555','authenticated',
    $$select count(*) from game.stations
       where id in ('99990000-0000-0000-0000-000000000001','99990000-0000-0000-0000-000000000002')$$),
  '0');
select chk('other-business grant (STRANGER, futsal-only) sees neither either',
  public.test_value('66666666-6666-6666-6666-666666666666','authenticated',
    $$select count(*) from game.stations
       where id in ('99990000-0000-0000-0000-000000000001','99990000-0000-0000-0000-000000000002')$$),
  '0');

select chk('game admin (SHOPSTAFF) sees all 3 fixture sessions via RLS',
  public.test_value('33333333-3333-3333-3333-333333333333','authenticated',
    $$select count(*) from game.sessions
       where id::text like '99992222-0000-0000-0000-00000000000%'$$),
  '3');
select chk('no-grant account (CUSTOMER1) sees none of them',
  public.test_value('55555555-5555-5555-5555-555555555555','authenticated',
    $$select count(*) from game.sessions
       where id::text like '99992222-0000-0000-0000-00000000000%'$$),
  '0');

-- stock_movements_select specifically: this is the policy that had zero rows
-- reaching anyone at all until game-corrections-migration.sql:67's guard was
-- fixed (see the comment there and on section 1's stock_movements_select
-- check above). NEWGUY (444444..., billiards app_access role=admin, but
-- their game access was explicitly REVOKED in 90-access.sql) is a stronger
-- negative case than CUSTOMER1: a real account with a real grant for a
-- DIFFERENT business, not merely nobody.
select chk('game admin (SHOPSTAFF) can select the fixture stock_movement via RLS',
  public.test_value('33333333-3333-3333-3333-333333333333','authenticated',
    $$select count(*) from game.stock_movements where id = '99994444-0000-0000-0000-000000000001'$$),
  '1');
select chk('billiards-only admin (NEWGUY, game access revoked) sees none of it',
  public.test_value('44444444-4444-4444-4444-444444444444','authenticated',
    $$select count(*) from game.stock_movements where id = '99994444-0000-0000-0000-000000000001'$$),
  '0');

-- ════════════════════════════════════════════════════════════════════════════
-- 3. The 4 missing indexes exist
-- ════════════════════════════════════════════════════════════════════════════

select chk('idx_sessions_created_by exists',
  (select count(*) > 0 from pg_indexes
    where schemaname='game' and indexname='idx_sessions_created_by'), true);
select chk('idx_order_lines_product exists',
  (select count(*) > 0 from pg_indexes
    where schemaname='game' and indexname='idx_order_lines_product'), true);
select chk('idx_stock_movements_session exists',
  (select count(*) > 0 from pg_indexes
    where schemaname='game' and indexname='idx_stock_movements_session'), true);
select chk('idx_sessions_started_at exists',
  (select count(*) > 0 from pg_indexes
    where schemaname='game' and indexname='idx_sessions_started_at'), true);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. game.current_staff()
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER, so - like game.open_session() in 97-game-live-sessions.sql
-- - its own internal is_active_staff() check reads auth.uid() from the JWT
-- claim test_act_as() sets, regardless of the outer connecting role. Using
-- test_value anyway keeps every call in this file exercised the same way a
-- real PostgREST request would be.

select chk('current_staff: returns exactly one row for the caller (not the whole table)',
  public.test_value('33333333-3333-3333-3333-333333333333','authenticated',
    $$select count(*) from game.current_staff()$$),
  '1');
select chk('current_staff: that row is the caller''s own id',
  public.test_value('33333333-3333-3333-3333-333333333333','authenticated',
    $$select id from game.current_staff()$$),
  '33333333-3333-3333-3333-333333333333');
select chk('current_staff: reports is_superadmin=false for a plain admin',
  public.test_value('33333333-3333-3333-3333-333333333333','authenticated',
    $$select is_superadmin from game.current_staff()$$),
  'false');
select chk('current_staff: no rows for a signed-in account with no game.staff row',
  public.test_value('55555555-5555-5555-5555-555555555555','authenticated',
    $$select count(*) from game.current_staff()$$),
  '0');

-- ════════════════════════════════════════════════════════════════════════════
-- 5. game.report_summary()
-- ════════════════════════════════════════════════════════════════════════════

select chk('report_summary: denies a non-staff caller, by name',
  public.test_call('55555555-5555-5555-5555-555555555555','authenticated',
    $$game.report_summary(null, null)$$)
  ~~ '%Not authorised to run reports for the game shop.%', true);

select public.test_act_as('33333333-3333-3333-3333-333333333333');  -- SHOPSTAFF for the rest of this file

-- "all" (p_from null, p_boundary null): totals must match a plain SQL
-- aggregate over the WHOLE table, not a hardcoded number - by this point in
-- the suite game.sessions also holds every fixture 97-game-live-sessions.sql
-- created, so report_summary is expected to sum ALL of them, same as the
-- real dashboard would. Comparing against a live, independently-written SUM
-- is a stronger proof than a fixed literal: it holds regardless of what
-- other fixtures exist or how many times this file is re-run.
select chk('report_summary ("all"): revenue matches a plain SUM(total) over every closed session',
  (select (game.report_summary(null,null)->'totals'->>'revenue')::numeric),
  (select coalesce(sum(total), 0) from game.sessions where status = 'closed'));
select chk('report_summary ("all"): sessions matches a plain COUNT(*)',
  (select (game.report_summary(null,null)->'totals'->>'sessions')::int),
  (select count(*)::int from game.sessions where status = 'closed'));
select chk('report_summary ("all"): playtime matches a plain SUM(playtime_total)',
  (select (game.report_summary(null,null)->'totals'->>'playtime')::numeric),
  (select coalesce(sum(playtime_total), 0) from game.sessions where status = 'closed'));
select chk('report_summary ("all"): snacks matches a plain SUM(snacks_total)',
  (select (game.report_summary(null,null)->'totals'->>'snacks')::numeric),
  (select coalesce(sum(snacks_total), 0) from game.sessions where status = 'closed'));
select chk('report_summary ("all"): avgPerSession = round(revenue/sessions) over the same rows',
  (select (game.report_summary(null,null)->'totals'->>'avgPerSession')::numeric),
  (select case when count(*) > 0 then round(coalesce(sum(total), 0) / count(*)) else 0 end
     from game.sessions where status = 'closed'));
select chk('report_summary ("all"): previous is JSON null with no boundary',
  (select (game.report_summary(null,null)->'previous')::text), 'null');

-- The regression this RPC exists to not repeat: byDay's span reaches back to
-- the EARLIEST sale (250 days ago), not a count of distinct selling days.
select chk('report_summary ("all"): byDay reaches back to the 250-day-old session, with its value intact',
  (
    select e->>'value' = '3000'
      from jsonb_array_elements(game.report_summary(null,null)->'byDay') e
     where e->>'key' = (
       select to_char((created_at at time zone 'Asia/Yangon')::date, 'YYYY-MM-DD')
         from game.sessions where id = '99992222-0000-0000-0000-000000000001'
     )
  ),
  true
);
select chk('report_summary ("all"): byDay bucket values sum to the same revenue as totals',
  (select sum((e->>'value')::numeric) from jsonb_array_elements(game.report_summary(null,null)->'byDay') e),
  (select (game.report_summary(null,null)->'totals'->>'revenue')::numeric)
);

-- p_boundary = 2 days ago: splits current (session B and C, the last 2 days
-- - along with everything 97-game-live-sessions.sql created, which all dates
-- to "now") from previous (session A, 250 days back, and anything else older
-- than 2 days - there shouldn't be anything, but the point of a differential
-- check is not to have to assume that). Same window-comparison shape
-- getReports() uses for "today"/"7d"/"30d".
select chk('report_summary (boundary=2d ago): current revenue matches SUM(total) for created_at >= boundary',
  (select (game.report_summary(null, now() - interval '2 days')->'totals'->>'revenue')::numeric),
  (select coalesce(sum(total), 0) from game.sessions
    where status = 'closed' and created_at >= now() - interval '2 days'));
select chk('report_summary (boundary=2d ago): current sessions matches COUNT(*) for created_at >= boundary',
  (select (game.report_summary(null, now() - interval '2 days')->'totals'->>'sessions')::int),
  (select count(*)::int from game.sessions
    where status = 'closed' and created_at >= now() - interval '2 days'));
select chk('report_summary (boundary=2d ago): previous revenue matches SUM(total) for created_at < boundary',
  (select (game.report_summary(null, now() - interval '2 days')->'previous'->>'revenue')::numeric),
  (select coalesce(sum(total), 0) from game.sessions
    where status = 'closed' and created_at < now() - interval '2 days'));
select chk('report_summary (boundary=2d ago): previous sessions matches COUNT(*) for created_at < boundary',
  (select (game.report_summary(null, now() - interval '2 days')->'previous'->>'sessions')::int),
  (select count(*)::int from game.sessions
    where status = 'closed' and created_at < now() - interval '2 days'));
select chk('report_summary (boundary=2d ago): byDay span is exactly boundary-day..today, zero-filled',
  (select jsonb_array_length(game.report_summary(null, now() - interval '2 days')->'byDay')),
  (select (
     (now() at time zone 'Asia/Yangon')::date
     - ((now() - interval '2 days') at time zone 'Asia/Yangon')::date
     + 1
   )::int)
);

-- topSnacks: proves the Chips line is aggregated correctly, without assuming
-- it is the ONLY line in the table (97-game-live-sessions.sql adds its own
-- Water order lines) or that it survives into the top 5 - only that when it
-- is present, its qty/revenue are exactly what the fixture inserted.
select chk('report_summary ("all"): topSnacks includes the Chips line with its real qty/revenue',
  (select exists (
     select 1 from jsonb_array_elements(game.report_summary(null,null)->'topSnacks') e
      where e->>'name' = 'Chips' and (e->>'qty')::int = 1 and (e->>'revenue')::numeric = 500
  )),
  true
);
