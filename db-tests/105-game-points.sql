\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- game-points-migration.sql: game sessions earn points, through the real RPCs
-- ════════════════════════════════════════════════════════════════════════════
--
-- Loaded AFTER the live game schema (station state, pricing tiers): see the
-- stage-2 block in run.sh. PS5 pricing: 30 min minimum, 10 min blocks, 5 min
-- grace. Points: 10 per full 60 CHARGED minutes (after waivers).

insert into auth.users (id, email, raw_user_meta_data) values
  ('c0d00000-0000-0000-0000-000000000001','gp_super@akoatp-staff.com', '{"username":"gp_super"}'),
  ('c0d00000-0000-0000-0000-000000000002','gp_staff@akoatp-staff.com', '{"username":"gp_staff"}'),
  ('c0d00000-0000-0000-0000-000000000011','09777300011@akoatp.com', '{"phone":"09777300011","username":"gamer_a"}'),
  ('c0d00000-0000-0000-0000-000000000012','09777300012@akoatp.com', '{"phone":"09777300012","username":"gamer_b"}');
update public.profiles set role = 'admin' where id in
  ('c0d00000-0000-0000-0000-000000000001','c0d00000-0000-0000-0000-000000000002');

select public.test_act_as('11111111-1111-1111-1111-111111111111');
select public.grant_app_access('c0d00000-0000-0000-0000-000000000001','game','superadmin','gp_super');
select public.grant_app_access('c0d00000-0000-0000-0000-000000000002','game','admin','gp_staff');

insert into game.stations (id, name, tier, sort_order) values
  ('c0d01111-0000-0000-0000-000000000001','Points TV 1','PS5', 201),
  ('c0d01111-0000-0000-0000-000000000002','Points TV 2','PS5', 202);

create table if not exists _ids (name text primary key, id uuid);

create or replace function _gbal(p_user uuid) returns int language sql as $$
  select coalesce((select balance from public.point_wallets where user_id = p_user and app = 'game'), 0);
$$;
create or replace function _gnet(p_sess uuid) returns int language sql as $$
  select coalesce(sum(points_delta), 0)::int from public.point_transactions
   where app = 'game' and source_session_id = p_sess;
$$;

-- ── Typed-in session, customer attached right after (the record flow) ───────
insert into _ids select 'rec120', test_value('c0d00000-0000-0000-0000-000000000002', 'authenticated',
  $$game.record_session('c0d01111-0000-0000-0000-000000000001', 120, '[]'::jsonb, null)$$)::uuid;

select chk('staff attach a customer to a just-recorded session',
  test_value('c0d00000-0000-0000-0000-000000000002', 'authenticated',
    $$game.set_session_customer((select id from _ids where name = 'rec120'), '09777300011')->>'points'$$), '20');
select chk('120 recorded minutes: gamer_a has 20 game points', _gbal('c0d00000-0000-0000-0000-000000000011'), 20);
select chk('name and phone are copied onto the session for display',
  (select customer_name || ' ' || customer_phone from game.sessions where id = (select id from _ids where name = 'rec120')),
  'gamer_a 09777300011');
select chk('the rule is frozen on the session',
  (select points_rule->>'points_per_block' from game.sessions where id = (select id from _ids where name = 'rec120')), '10');
select chk('futsal is untouched',
  (select total_points from public.profiles where id = 'c0d00000-0000-0000-0000-000000000011'), 0);

-- ── Live session: no points while open, points on close ─────────────────────
insert into _ids select 'live', test_value('c0d00000-0000-0000-0000-000000000002', 'authenticated',
  $$game.open_session('c0d01111-0000-0000-0000-000000000002', null)$$)::uuid;
select test_value('c0d00000-0000-0000-0000-000000000002', 'authenticated',
  $$game.set_session_customer((select id from _ids where name = 'live'), '09777 300 012')$$);
select chk('an open session earns nothing yet', _gnet((select id from _ids where name = 'live')), 0);

-- Typing in a session on the busy TV is now refused (it used to free it).
select chk('record_session refuses a station whose timer is running',
  test_call('c0d00000-0000-0000-0000-000000000002', 'authenticated',
    $$game.record_session('c0d01111-0000-0000-0000-000000000002', 60, '[]'::jsonb, null)$$),
  'Points TV 2 has a session running. Close it there instead.');
select chk('...and the station stays occupied',
  (select state from game.stations where id = 'c0d01111-0000-0000-0000-000000000002'), 'occupied');

-- 72 minutes played bills 70 (2 min is inside the grace); waiving one
-- 10-minute block charges 60 -> 10 points.
update game.sessions set started_at = now() - interval '72 minutes'
 where id = (select id from _ids where name = 'live');
select test_value('c0d00000-0000-0000-0000-000000000002', 'authenticated',
  $$game.close_session((select id from _ids where name = 'live'), 'cash', 1)$$);
select chk('closed: charged 60 after the waiver',
  (select charged_minutes from game.sessions where id = (select id from _ids where name = 'live')), 60);
select chk('closed: 10 points for 60 paid minutes, not 70 played', _gbal('c0d00000-0000-0000-0000-000000000012'), 10);

-- ── Correction re-prices the points with the frozen rule ────────────────────
select test_value('c0d00000-0000-0000-0000-000000000002', 'authenticated',
  $$game.correct_session((select id from _ids where name = 'rec120'), 180, 'typed 120 by mistake')$$);
select chk('corrected to 180 min: session now gave 30', _gnet((select id from _ids where name = 'rec120')), 30);
select chk('gamer_a now has 30', _gbal('c0d00000-0000-0000-0000-000000000011'), 30);

-- ── Void takes it back ──────────────────────────────────────────────────────
select test_value('c0d00000-0000-0000-0000-000000000001', 'authenticated',
  $$game.void_session((select id from _ids where name = 'rec120'), 'test sale', false)$$);
select chk('voided: session net 0', _gnet((select id from _ids where name = 'rec120')), 0);
select chk('gamer_a back to 0', _gbal('c0d00000-0000-0000-0000-000000000011'), 0);
select chk('a voided session cannot get a customer',
  test_call('c0d00000-0000-0000-0000-000000000001', 'authenticated',
    $$game.set_session_customer((select id from _ids where name = 'rec120'), '09777300011')$$),
  'That session was cancelled. It cannot earn points.');

-- ── Changing the customer of a finished session ─────────────────────────────
update game.sessions set ended_at = now() - interval '1 hour', created_at = now() - interval '2 hours'
 where id = (select id from _ids where name = 'live');
select chk('staff cannot change the customer of an older finished session',
  test_call('c0d00000-0000-0000-0000-000000000002', 'authenticated',
    $$game.set_session_customer((select id from _ids where name = 'live'), '09777300011')$$),
  'Only a superadmin can change the customer on a finished session.');
select chk('superadmin can, and the points move',
  test_value('c0d00000-0000-0000-0000-000000000001', 'authenticated',
    $$game.set_session_customer((select id from _ids where name = 'live'), '09777300011')->>'points'$$), '10');
select chk('...gamer_b loses them', _gbal('c0d00000-0000-0000-0000-000000000012'), 0);
select chk('...gamer_a gains them', _gbal('c0d00000-0000-0000-0000-000000000011'), 10);
select chk('...and the change is audited under game',
  (select count(*)::int from public.audit_log where app = 'game' and action = 'session.customer_set'), 1);

-- ── Refusals ────────────────────────────────────────────────────────────────
insert into _ids select 'rec60', test_value('c0d00000-0000-0000-0000-000000000002', 'authenticated',
  $$game.record_session('c0d01111-0000-0000-0000-000000000001', 60, '[]'::jsonb, null)$$)::uuid;
select chk('an unregistered phone is refused with a clear message',
  test_call('c0d00000-0000-0000-0000-000000000002', 'authenticated',
    $$game.set_session_customer((select id from _ids where name = 'rec60'), '09777399999')$$),
  'No customer is registered with that phone number. Ask them to sign up first.');
select chk('a customer cannot attach themselves',
  test_call('c0d00000-0000-0000-0000-000000000011', 'authenticated',
    $$game.set_session_customer((select id from _ids where name = 'rec60'), '09777300011')$$),
  'Not authorised to run sessions for the game shop.');
select chk('billiards staff cannot touch game sessions',
  test_call('22222222-2222-2222-2222-222222222222', 'authenticated',
    $$game.set_session_customer((select id from _ids where name = 'rec60'), '09777300011')$$),
  'Not authorised to run sessions for the game shop.');

-- ── Points failing must not stop the till ───────────────────────────────────
alter function public.lock_point_wallet(uuid, text) rename to lock_point_wallet_broken;
select chk('checkout-style change still succeeds when points break',
  test_call('c0d00000-0000-0000-0000-000000000002', 'authenticated',
    $$game.set_session_customer((select id from _ids where name = 'rec60'), '09777300012')$$), 'NO ERROR');
alter function public.lock_point_wallet_broken(uuid, text) rename to lock_point_wallet;
select chk('...and no half-written points were left behind', _gnet((select id from _ids where name = 'rec60')), 0);
select chk('...entering the same phone again repairs it',
  test_value('c0d00000-0000-0000-0000-000000000002', 'authenticated',
    $$game.set_session_customer((select id from _ids where name = 'rec60'), '09777300012')->>'points'$$), '10');
select chk('...and repeating it posts nothing more',
  test_value('c0d00000-0000-0000-0000-000000000002', 'authenticated',
    $$game.set_session_customer((select id from _ids where name = 'rec60'), '09777300012')->>'points'$$) = '10'
  and (select count(*) from public.point_transactions
        where source_session_id = (select id from _ids where name = 'rec60')) = 1, true);
select chk('routine attach right after recording is not audited (only late changes are)',
  (select count(*)::int from public.audit_log where app = 'game' and action = 'session.customer_set'), 1);
