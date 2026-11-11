\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- game-tier-points-migration.sql: points per FULL hour depend on the tier
-- (client rule 2026-11-11): PS4 3, PS5 5, VIP 7, CINEMA 7.
-- ════════════════════════════════════════════════════════════════════════════
-- Loaded after 105 (which asserts the old flat 10 per hour; its sessions keep
-- that, because their rule is frozen).

insert into auth.users (id, email, raw_user_meta_data) values
  ('c1d00000-0000-0000-0000-000000000001','tp_super@akoatp-staff.com', '{"username":"tp_super"}'),
  ('c1d00000-0000-0000-0000-000000000002','tp_staff@akoatp-staff.com', '{"username":"tp_staff"}'),
  ('c1d00000-0000-0000-0000-000000000011','09777500011@akoatp.com', '{"phone":"09777500011","username":"tier_a"}');
update public.profiles set role = 'superadmin' where id = 'c1d00000-0000-0000-0000-000000000001';
update public.profiles set role = 'admin' where id = 'c1d00000-0000-0000-0000-000000000002';

select public.test_act_as('11111111-1111-1111-1111-111111111111');
select public.grant_app_access('c1d00000-0000-0000-0000-000000000001','game','admin','tp_super');
select public.grant_app_access('c1d00000-0000-0000-0000-000000000002','game','admin','tp_staff');

insert into game.stations (id, name, tier, sort_order) values
  ('c1d01111-0000-0000-0000-000000000001','Tier PS4',    'PS4',    301),
  ('c1d01111-0000-0000-0000-000000000002','Tier PS5',    'PS5',    302),
  ('c1d01111-0000-0000-0000-000000000003','Tier VIP',    'VIP',    303),
  ('c1d01111-0000-0000-0000-000000000004','Tier Cinema', 'CINEMA', 304);

create table if not exists _tids (name text primary key, id uuid);

-- Record a finished session on a station, attach tier_a, return the points
-- that session gave.
create or replace function _tp_play(p_name text, p_station uuid, p_minutes int) returns int
language plpgsql as $fn$
declare v uuid;
begin
  v := test_value('c1d00000-0000-0000-0000-000000000002', 'authenticated',
         format('game.record_session(%L, %s, ''[]''::jsonb, null)', p_station, p_minutes))::uuid;
  insert into _tids values (p_name, v) on conflict (name) do update set id = excluded.id;
  return (test_value('c1d00000-0000-0000-0000-000000000002', 'authenticated',
            format('game.set_session_customer(%L, ''09777500011'')->>''points''', v)))::int;
end $fn$;

create or replace function _tbal() returns int language sql as $fn$
  select coalesce((select balance from public.point_wallets
                    where user_id = 'c1d00000-0000-0000-0000-000000000011' and app = 'game'), 0);
$fn$;

select chk('seeded: PS4 3, PS5 5, VIP 7, CINEMA 7 points per hour',
  (select string_agg(tier || '=' || points_per_hour, ',' order by tier) from game.pricing),
  'CINEMA=7,PS4=3,PS5=5,VIP=7');

select chk('cinema is priced like VIP (7000 an hour, same 30-min price)',
  (select string_agg(duration_minutes || ':' || rate, ',' order by duration_minutes)
     from game.pricing_tiers where tier = 'CINEMA'),
  (select string_agg(duration_minutes || ':' || rate, ',' order by duration_minutes)
     from game.pricing_tiers where tier = 'VIP'));
select chk('cinema hourly rate mirrors VIP''s',
  (select rate_per_hour::int from game.pricing where tier = 'CINEMA'),
  (select rate_per_hour::int from game.pricing where tier = 'VIP'));

select chk('PS4, 60 min: 3 points',     _tp_play('ps4_60',  'c1d01111-0000-0000-0000-000000000001', 60), 3);
select chk('PS4, 30 min (the minimum): 0 points, no part hours',
                                        _tp_play('ps4_30',  'c1d01111-0000-0000-0000-000000000001', 30), 0);
select chk('PS4, 90 min: still 3 (one full hour)',
                                        _tp_play('ps4_90',  'c1d01111-0000-0000-0000-000000000001', 90), 3);
select chk('PS5, 120 min: 10 points',   _tp_play('ps5_120', 'c1d01111-0000-0000-0000-000000000002', 120), 10);
select chk('VIP, 60 min: 7 points',     _tp_play('vip_60',  'c1d01111-0000-0000-0000-000000000003', 60), 7);
select chk('Cinema, 60 min: 7 points (same level as VIP)',
                                        _tp_play('cin_60',  'c1d01111-0000-0000-0000-000000000004', 60), 7);
select chk('wallet: 3+0+3+10+7+7 = 30', _tbal(), 30);

select chk('the frozen rule records the tier',
  (select (points_rule->>'tier') || ':' || (points_rule->>'points_per_block')
     from game.sessions where id = (select id from _tids where name = 'cin_60')),
  'CINEMA:7');

-- ── Editing points per hour ────────────────────────────────────────────────
select chk('staff cannot change points per hour',
  test_call('c1d00000-0000-0000-0000-000000000002', 'authenticated',
    'game.set_tier_points(''PS4'', 50)'),
  'Only the owner can change points.');
select chk('owner can',
  test_value('c1d00000-0000-0000-0000-000000000001', 'authenticated',
    'game.set_tier_points(''PS4'', 4)'), '4');
select chk('...and it is audited',
  (select count(*) from public.audit_log where app = 'game' and action = 'points.rule_changed'
      and target_id = 'PS4')::int, 1);
select chk('a new PS4 hour earns the new number',
  _tp_play('ps4_new', 'c1d01111-0000-0000-0000-000000000001', 60), 4);
select chk('an earlier PS4 session keeps its frozen 3 on re-sync',
  (test_value('c1d00000-0000-0000-0000-000000000002', 'authenticated',
     format('game.set_session_customer(%L, ''09777500011'')->>''points''',
            (select id from _tids where name = 'ps4_60'))))::int, 3);

-- ── Void takes points back ──────────────────────────────────────────────────
update game.sessions set void_reason = 'test void'
 where id = (select id from _tids where name = 'vip_60');
select chk('voided VIP session: its 7 points are taken back',
  (select coalesce(sum(points_delta), 0)::int from public.point_transactions
    where app = 'game' and source_session_id = (select id from _tids where name = 'vip_60')), 0);

-- ── Shop switch off: nobody earns ──────────────────────────────────────────
select test_value('c1d00000-0000-0000-0000-000000000001', 'authenticated',
  '(public.set_point_rule(''game'', 60, 10, false)).app');
select chk('switch off: a new hour earns 0',
  _tp_play('off_60', 'c1d01111-0000-0000-0000-000000000003', 60), 0);
select test_value('c1d00000-0000-0000-0000-000000000001', 'authenticated',
  '(public.set_point_rule(''game'', 60, 10, true)).app');
