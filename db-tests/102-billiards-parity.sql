\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- billiards-gaming-parity-migration.sql: billiards runs like the game shop
-- ════════════════════════════════════════════════════════════════════════════
--
-- Rate card, prices frozen at start, open/record/cancel, food edits and the
-- table chip. The first block is the one the client cares about most: on the
-- day this ships, every duration costs exactly what it did before.

insert into auth.users (id, email) values
  ('99980000-0000-0000-0000-000000000001','psuper@akoatp-staff.com'),
  ('99980000-0000-0000-0000-000000000002','padmin@akoatp-staff.com');
update public.profiles set role='admin', username='psuper' where id='99980000-0000-0000-0000-000000000001';
update public.profiles set role='admin', username='padmin' where id='99980000-0000-0000-0000-000000000002';

select public.test_act_as('11111111-1111-1111-1111-111111111111');  -- owner, from 90-access
select public.grant_app_access('99980000-0000-0000-0000-000000000001','billiards','superadmin','psuper');
select public.grant_app_access('99980000-0000-0000-0000-000000000002','billiards','admin','padmin');

insert into billiards.pool_tables (id, name) values
  ('99981111-0000-0000-0000-000000000001','Parity 1'),
  ('99981111-0000-0000-0000-000000000002','Parity 2');

-- A menu item with known stock.
insert into billiards.menu_items (id, category_id, name_en, name_my, price, stock_qty)
select '99983333-0000-0000-0000-000000000001', id, 'Parity Cola', 'ကိုလာ', 1000, 20
  from billiards.menu_categories limit 1;

-- ── Prices unchanged on day one ─────────────────────────────────────────────
select chk('the card is seeded as 30 = half, 60 = full',
  (select round(rate) from billiards.pricing_tiers where duration_minutes = 30)
    = (select round(rate / 2.0) from billiards.pricing_tiers where duration_minutes = 60), true);

select chk('every billed length 10..600 costs exactly what the old hourly formula charged',
  (select bool_and(round(billiards.tier_rate(m, billiards.pricing_curve()))
                   = round(t.rate * m / 60.0))
     from generate_series(10, 600, 10) m, billiards.pricing_tiers t where t.duration_minutes = 60), true);

-- ── tier_rate matches the game shop (client PS4 shape) ─────────────────────
select chk('overflow: 90 = 60 + 30 (3000 + 2000)',
  billiards.tier_rate(90, '[{"duration_minutes":0,"rate":0},{"duration_minutes":30,"rate":2000},{"duration_minutes":60,"rate":3000}]'::jsonb)::int, 5000);
select chk('overflow: 120 = 2 x 60',
  billiards.tier_rate(120, '[{"duration_minutes":0,"rate":0},{"duration_minutes":30,"rate":2000},{"duration_minutes":60,"rate":3000}]'::jsonb)::int, 6000);
select chk('overflow: 70 = 60 + interpolated 10',
  round(billiards.tier_rate(70, '[{"duration_minutes":0,"rate":0},{"duration_minutes":30,"rate":2000},{"duration_minutes":60,"rate":3000}]'::jsonb))::int, 3667);

-- ── Who may change prices ──────────────────────────────────────────────────
select chk('a plain admin cannot change prices',
  public.test_call('99980000-0000-0000-0000-000000000002','authenticated',
    $$billiards.replace_pricing_tiers('[{"duration_minutes":60,"rate":9000}]'::jsonb, 30, 10, 5)$$)
  ~~ '%Only a superadmin%', true);
select chk('a card without a 60-minute price is refused',
  public.test_call('99980000-0000-0000-0000-000000000001','authenticated',
    $$billiards.replace_pricing_tiers('[{"duration_minutes":30,"rate":2000}]'::jsonb, 30, 10, 5)$$)
  ~~ '%60-minute%', true);
select chk('a duplicate duration is refused',
  public.test_call('99980000-0000-0000-0000-000000000001','authenticated',
    $$billiards.replace_pricing_tiers('[{"duration_minutes":60,"rate":1},{"duration_minutes":60,"rate":2}]'::jsonb, 30, 10, 5)$$)
  ~~ '%only appear once%', true);

-- ── Open, then change prices: the running session keeps its price ──────────
create temp table _old_card as select * from billiards.pricing_tiers;
create temp table _old_settings as select * from billiards.app_settings;

select public.test_act_as('99980000-0000-0000-0000-000000000002');
create temp table _s1 as select billiards.open_session('99981111-0000-0000-0000-000000000001', 'Ko Aung') as id;

select chk('open_session marks the table occupied',
  (select state from billiards.pool_tables where id = '99981111-0000-0000-0000-000000000001'), 'occupied');
select chk('...stores the label',
  (select label from billiards.sessions where id = (select id from _s1)), 'Ko Aung');
select chk('a second start on the same table is refused in plain words',
  public.test_call('99980000-0000-0000-0000-000000000002','authenticated',
    $$billiards.open_session('99981111-0000-0000-0000-000000000001')$$)
  ~~ '%already has a session running%', true);
select chk('the chip cannot be changed while the timer runs',
  public.test_call('99980000-0000-0000-0000-000000000002','authenticated',
    $$billiards.set_table_state('99981111-0000-0000-0000-000000000001', 'reserved')$$)
  ~~ '%session running%', true);
select chk('typing in a session on a running table is refused',
  public.test_call('99980000-0000-0000-0000-000000000002','authenticated',
    $$billiards.record_session('99981111-0000-0000-0000-000000000001', 60)$$)
  ~~ '%has a session running%', true);

-- Superadmin doubles every price mid-session.
select public.test_act_as('99980000-0000-0000-0000-000000000001');
select billiards.replace_pricing_tiers(
  (select jsonb_agg(jsonb_build_object('duration_minutes', duration_minutes, 'rate', rate * 2)) from _old_card),
  30, 10, 5);
select chk('hourly_rate mirrors the new 60-minute price',
  (select hourly_rate from billiards.app_settings where id = true),
  (select (rate * 2)::int from _old_card where duration_minutes = 60));

-- 60 minutes of play on the old price.
update billiards.sessions set started_at = now() - interval '60 minutes' where id = (select id from _s1);
select public.test_act_as('99980000-0000-0000-0000-000000000002');
select billiards.checkout_session((select id from _s1), 'cash');

select chk('checkout charges the price frozen at START, not the doubled one',
  (select time_charge from billiards.sessions where id = (select id from _s1)),
  (select round(rate)::int from _old_card where duration_minutes = 60));
select chk('...and frees the table',
  (select state from billiards.pool_tables where id = '99981111-0000-0000-0000-000000000001'), 'free');
select chk('...and the close audit fires once',
  (select count(*)::int from public.audit_log where action = 'session.closed'
     and target_id = (select id from _s1)::text), 1);

-- A correction later still uses the frozen card.
select billiards.correct_session((select id from _s1), 120, 'Timer started late');
select chk('correction replays the frozen card (120 min at old price)',
  (select time_charge from billiards.sessions where id = (select id from _s1)),
  (select round(rate * 2)::int from _old_card where duration_minutes = 60));

-- ── Record afterwards ──────────────────────────────────────────────────────
create temp table _s2 as select billiards.record_session('99981111-0000-0000-0000-000000000002', 45,
  '[{"menuItemId":"99983333-0000-0000-0000-000000000001","qty":2}]'::jsonb, 'walk-in') as id;

select chk('recorded session is closed and flagged',
  (select status = 'closed' and is_recorded from billiards.sessions where id = (select id from _s2)), true);
select chk('...billed through the block rule at TODAY''s card (45 -> 40 min at doubled price)',
  (select time_charge from billiards.sessions where id = (select id from _s2)),
  (select round(billiards.tier_rate(40, billiards.pricing_curve()))::int));
select chk('...food added and stock taken',
  (select food_total from billiards.sessions where id = (select id from _s2)), 2000);
select chk('...stock now 18',
  (select stock_qty from billiards.menu_items where id = '99983333-0000-0000-0000-000000000001'), 18);
select chk('...logged as session.recorded',
  (select count(*)::int from public.audit_log where action = 'session.recorded'
     and target_id = (select id from _s2)::text), 1);

-- ── Edit food on the closed session ────────────────────────────────────────
select billiards.edit_session_food((select id from _s2),
  jsonb_build_array(jsonb_build_object('kind','set_qty',
    'order_item_id', (select id from billiards.order_items where session_id = (select id from _s2)),
    'qty', 1)),
  'Only one cola');
select chk('food edit lowers food_total',
  (select food_total from billiards.sessions where id = (select id from _s2)), 1000);
select chk('...keeps the original food total',
  (select original_food_total from billiards.sessions where id = (select id from _s2)), 2000);
select chk('...total = time + food',
  (select total = time_charge + food_total from billiards.sessions where id = (select id from _s2)), true);
select chk('...returns one to stock',
  (select stock_qty from billiards.menu_items where id = '99983333-0000-0000-0000-000000000001'), 19);
select chk('...does not write a fake close',
  (select count(*)::int from public.audit_log where action = 'session.closed'
     and target_id = (select id from _s2)::text), 0);
select chk('editing food on an open session is refused',
  public.test_call('99980000-0000-0000-0000-000000000002','authenticated',
    $$billiards.edit_session_food(billiards.open_session('99981111-0000-0000-0000-000000000002'),
      '[{"kind":"add","menu_item_id":"99983333-0000-0000-0000-000000000001","qty":1}]'::jsonb, 'x')$$)
  ~~ '%still open%', true);

-- ── Cancel a running session ───────────────────────────────────────────────
select public.test_act_as('99980000-0000-0000-0000-000000000002');
create temp table _s3 as select billiards.open_session('99981111-0000-0000-0000-000000000002') as id;
select billiards.add_order_item((select id from _s3), '99983333-0000-0000-0000-000000000001', 3);
select chk('cancel needs a reason',
  public.test_call('99980000-0000-0000-0000-000000000002','authenticated',
    format('billiards.cancel_active_session(%L::uuid, %L)', (select id from _s3), ' ')) ~~ '%reason%', true);
select billiards.cancel_active_session((select id from _s3), 'Wrong table');
select chk('cancel deletes the session',
  (select count(*)::int from billiards.sessions where id = (select id from _s3)), 0);
select chk('...returns the food to stock',
  (select stock_qty from billiards.menu_items where id = '99983333-0000-0000-0000-000000000001'), 19);
select chk('...frees the table',
  (select state from billiards.pool_tables where id = '99981111-0000-0000-0000-000000000002'), 'free');
select chk('...and leaves an audit row',
  (select count(*)::int from public.audit_log where action = 'session.cancelled'
     and target_id = (select id from _s3)::text), 1);

-- ── Manual chip ────────────────────────────────────────────────────────────
select billiards.set_table_state('99981111-0000-0000-0000-000000000002', 'reserved');
select chk('chip set to reserved on a free table',
  (select state from billiards.pool_tables where id = '99981111-0000-0000-0000-000000000002'), 'reserved');
select chk('an unknown chip value is refused',
  public.test_call('99980000-0000-0000-0000-000000000002','authenticated',
    $$billiards.set_table_state('99981111-0000-0000-0000-000000000002', 'broken')$$)
  ~~ '%Invalid table state%', true);
select chk('anon cannot start a session',
  public.test_call(null,'anon',
    $$billiards.open_session('99981111-0000-0000-0000-000000000002')$$)
  ~~ '%permission denied%', true);

-- Put prices back for any later file.
select public.test_act_as('99980000-0000-0000-0000-000000000001');
select billiards.replace_pricing_tiers(
  (select jsonb_agg(jsonb_build_object('duration_minutes', duration_minutes, 'rate', rate)) from _old_card),
  (select min_minutes from _old_settings), (select increment_minutes from _old_settings),
  (select grace_minutes from _old_settings));
