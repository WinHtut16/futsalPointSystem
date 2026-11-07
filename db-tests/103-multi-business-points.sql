\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- multi-business-points-migration.sql: one wallet per customer per business
-- ════════════════════════════════════════════════════════════════════════════
--
-- Futsal must behave exactly as before (profiles.total_points stays in step),
-- and the game / billiards balances must never leak into each other or into
-- futsal. People from 90-access: 11111111 owner (global superadmin),
-- 22222222 billiards superadmin, 33333333 game admin.

-- Like test_call, but runs a whole statement (INSERT/UPDATE), which
-- test_call's `select <expr>` cannot wrap.
create or replace function public.test_exec(p_actor uuid, p_role text, p_sql text)
returns text language plpgsql as $$
declare
  v_result text;
begin
  perform public.test_act_as(p_actor);
  perform set_config('role', p_role, true);
  begin
    execute p_sql;
    v_result := 'NO ERROR';
  exception when others then
    v_result := sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  return v_result;
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0b00000-0000-0000-0000-000000000001','09777100001@akoatp.com',
   '{"phone":"09777100001","username":"wallet_a"}'),
  ('a0b00000-0000-0000-0000-000000000002','09777100002@akoatp.com',
   '{"phone":"09777100002","username":"wallet_b"}');

-- Customer A already had 50 futsal points under the old single balance and
-- has no wallet row (registered after the backfill ran).
update public.profiles set total_points = 50 where id = 'a0b00000-0000-0000-0000-000000000001';
delete from public.point_wallets where user_id in
  ('a0b00000-0000-0000-0000-000000000001','a0b00000-0000-0000-0000-000000000002');

-- ── Shape ───────────────────────────────────────────────────────────────────
select chk('exactly one add_points_transaction exists (old 7- and 8-arg versions dropped)',
  (select count(*)::int from pg_proc where proname = 'add_points_transaction'), 1);

select chk('a signed-in session cannot call add_points_transaction',
  has_function_privilege('authenticated',
    'public.add_points_transaction(uuid,integer,text,numeric,uuid,text,uuid,integer,text)', 'execute'), false);
select chk('a signed-in session cannot call approve_redemption',
  has_function_privilege('authenticated', 'public.approve_redemption(uuid,uuid,text)', 'execute'), false);
select chk('a signed-in session cannot call lock_point_wallet',
  has_function_privilege('authenticated', 'public.lock_point_wallet(uuid,text)', 'execute'), false);
select chk('control: service_role can call add_points_transaction',
  has_function_privilege('service_role',
    'public.add_points_transaction(uuid,integer,text,numeric,uuid,text,uuid,integer,text)', 'execute'), true);

-- ── Futsal: unchanged behaviour, old call shape ─────────────────────────────
-- Exactly the named arguments app/api/points/add sends today (no p_app).
select public.add_points_transaction(
  p_customer_id => 'a0b00000-0000-0000-0000-000000000001', p_points_delta => 10,
  p_transaction_type => 'earn', p_hours_played => 1, p_reward_id => null,
  p_note => null, p_created_by => '11111111-1111-1111-1111-111111111111', p_min_balance => 0);

select chk('futsal wallet seeded from the old balance, then +10',
  (select balance from public.point_wallets
    where user_id = 'a0b00000-0000-0000-0000-000000000001' and app = 'futsal'), 60);
select chk('profiles.total_points mirrors the futsal wallet',
  (select total_points from public.profiles where id = 'a0b00000-0000-0000-0000-000000000001'), 60);
select chk('a call without p_app is recorded as futsal',
  (select app from public.point_transactions
    where customer_id = 'a0b00000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'futsal');

select chk('futsal adjustment below zero still refused',
  test_call(null, 'postgres', $$public.add_points_transaction('a0b00000-0000-0000-0000-000000000001',
    -61, 'adjustment', null, null, 'too much', '11111111-1111-1111-1111-111111111111', 0)$$),
  'insufficient_balance');

-- ── Game: its own wallet ────────────────────────────────────────────────────
select public.add_points_transaction('a0b00000-0000-0000-0000-000000000001', 20, 'earn', 2, null, null,
  '33333333-3333-3333-3333-333333333333', 0, 'game');

select chk('game wallet starts at 0, then +20',
  (select balance from public.point_wallets
    where user_id = 'a0b00000-0000-0000-0000-000000000001' and app = 'game'), 20);
select chk('game points do not touch the futsal wallet',
  (select balance from public.point_wallets
    where user_id = 'a0b00000-0000-0000-0000-000000000001' and app = 'futsal'), 60);
select chk('game points do not touch profiles.total_points',
  (select total_points from public.profiles where id = 'a0b00000-0000-0000-0000-000000000001'), 60);
select chk('ledger row says game',
  (select count(*)::int from public.point_transactions
    where customer_id = 'a0b00000-0000-0000-0000-000000000001' and app = 'game'), 1);

select chk('game adjustment below zero refused with floor 0',
  test_call(null, 'postgres', $$public.add_points_transaction('a0b00000-0000-0000-0000-000000000001',
    -30, 'adjustment', null, null, 'x', '33333333-3333-3333-3333-333333333333', 0, 'game')$$),
  'insufficient_balance');

select chk('NULL floor lets a reversal go below zero',
  test_call(null, 'postgres', $$public.add_points_transaction('a0b00000-0000-0000-0000-000000000001',
    -30, 'adjustment', null, null, 'void reversal', '33333333-3333-3333-3333-333333333333', null, 'game')$$),
  'NO ERROR');
select chk('game wallet is now -10',
  (select balance from public.point_wallets
    where user_id = 'a0b00000-0000-0000-0000-000000000001' and app = 'game'), -10);

select chk('unknown business refused',
  test_call(null, 'postgres', $$public.add_points_transaction('a0b00000-0000-0000-0000-000000000001',
    5, 'earn', null, null, null, null, 0, 'gaming')$$),
  'invalid_app');

select chk('unknown customer refused',
  test_call(null, 'postgres', $$public.add_points_transaction('a0b00000-0000-0000-0000-0000000000ff',
    5, 'earn', null, null, null, null, 0, 'game')$$),
  'customer_not_found');

select chk('session source must match its business',
  test_exec(null, 'postgres', $$insert into public.point_transactions
      (customer_id, points_delta, transaction_type, app, source_kind, source_session_id)
    values ('a0b00000-0000-0000-0000-000000000001', 10, 'earn', 'futsal', 'game_session',
            gen_random_uuid())$$) like '%chk_point_transactions_source%', true);

-- ── Redemptions follow the reward's business ────────────────────────────────
insert into public.rewards (id, name, points_cost, stock, is_active, app) values
  ('a0b01111-0000-0000-0000-000000000001', 'Game: free hour', 30, 5, true, 'game'),
  ('a0b01111-0000-0000-0000-000000000002', 'Futsal: water',   20, null, true, 'futsal');

-- Customer B: 100 futsal, 40 game.
select public.add_points_transaction('a0b00000-0000-0000-0000-000000000002', 100, 'earn', 10, null, null, null, 0, 'futsal');
select public.add_points_transaction('a0b00000-0000-0000-0000-000000000002',  40, 'earn',  4, null, null, null, 0, 'game');

-- Request a game reward while (wrongly) claiming it is futsal.
insert into public.redemption_requests (id, customer_id, reward_id, points_cost_snapshot, app) values
  ('a0b02222-0000-0000-0000-000000000001', 'a0b00000-0000-0000-0000-000000000002',
   'a0b01111-0000-0000-0000-000000000001', 30, 'futsal');

select chk('request business is taken from the reward, not the caller',
  (select app from public.redemption_requests where id = 'a0b02222-0000-0000-0000-000000000001'), 'game');

update public.redemption_requests set app = 'futsal' where id = 'a0b02222-0000-0000-0000-000000000001';
select chk('request business cannot be changed afterwards',
  (select app from public.redemption_requests where id = 'a0b02222-0000-0000-0000-000000000001'), 'game');

select public.approve_redemption('a0b02222-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', null);

select chk('game redemption deducts the game wallet',
  (select balance from public.point_wallets
    where user_id = 'a0b00000-0000-0000-0000-000000000002' and app = 'game'), 10);
select chk('game redemption leaves futsal alone',
  (select balance from public.point_wallets
    where user_id = 'a0b00000-0000-0000-0000-000000000002' and app = 'futsal'), 100);
select chk('game redemption leaves profiles.total_points alone',
  (select total_points from public.profiles where id = 'a0b00000-0000-0000-0000-000000000002'), 100);
select chk('game reward stock decremented',
  (select stock from public.rewards where id = 'a0b01111-0000-0000-0000-000000000001'), 4);
select chk('redeem ledger row says game',
  (select app from public.point_transactions
    where customer_id = 'a0b00000-0000-0000-0000-000000000002' and transaction_type = 'redeem'), 'game');

-- Futsal redemption still moves the mirror.
insert into public.redemption_requests (id, customer_id, reward_id, points_cost_snapshot) values
  ('a0b02222-0000-0000-0000-000000000002', 'a0b00000-0000-0000-0000-000000000002',
   'a0b01111-0000-0000-0000-000000000002', 20);
select public.approve_redemption('a0b02222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', null);
select chk('futsal redemption updates wallet and mirror together',
  (select w.balance = 80 and p.total_points = 80
     from public.point_wallets w join public.profiles p on p.id = w.user_id
    where w.user_id = 'a0b00000-0000-0000-0000-000000000002' and w.app = 'futsal'), true);

-- A negative wallet blocks redemption.
insert into public.redemption_requests (id, customer_id, reward_id, points_cost_snapshot) values
  ('a0b02222-0000-0000-0000-000000000003', 'a0b00000-0000-0000-0000-000000000001',
   'a0b01111-0000-0000-0000-000000000001', 30);
select chk('wallet below zero cannot redeem',
  test_call(null, 'postgres', $$public.approve_redemption('a0b02222-0000-0000-0000-000000000003',
    '33333333-3333-3333-3333-333333333333', null)$$), 'insufficient_points');

-- ── Who can read which wallet (RLS) ─────────────────────────────────────────
select chk('customer sees both of their own wallets',
  test_value('a0b00000-0000-0000-0000-000000000001', 'authenticated',
    $$(select count(*) from public.point_wallets)$$), '2');
select chk('customer cannot see another customer''s wallets',
  test_value('a0b00000-0000-0000-0000-000000000001', 'authenticated',
    $$(select count(*) from public.point_wallets where user_id = 'a0b00000-0000-0000-0000-000000000002')$$), '0');
select chk('game admin sees game wallets',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$(select count(*) from public.point_wallets where app = 'game' and user_id::text like 'a0b00000%')$$), '2');
select chk('game admin cannot see futsal wallets',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$(select count(*) from public.point_wallets where app = 'futsal')$$), '0');
select chk('billiards superadmin cannot see game wallets',
  test_value('22222222-2222-2222-2222-222222222222', 'authenticated',
    $$(select count(*) from public.point_wallets where app = 'game')$$), '0');
select chk('control: global superadmin sees every business',
  test_value('11111111-1111-1111-1111-111111111111', 'authenticated',
    $$(select count(distinct app) from public.point_wallets where user_id::text like 'a0b00000%')$$), '2');
select chk('a customer cannot write a wallet directly',
  test_exec('a0b00000-0000-0000-0000-000000000001', 'authenticated',
    $$update public.point_wallets set balance = 9999$$) like 'permission denied%', true);
