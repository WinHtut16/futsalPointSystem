\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- billiards-points-migration.sql: billiards sessions earn points, through
-- the real RPCs (open / checkout / record / correct / void).
-- ════════════════════════════════════════════════════════════════════════════
--
-- Billing (app_settings): 30 min minimum, 10 min blocks, 5 min grace.
-- Points: the billiards rule ships OFF; the owner switches it on below.

insert into auth.users (id, email, raw_user_meta_data) values
  ('d0e00000-0000-0000-0000-000000000001','bp_super@akoatp-staff.com', '{"username":"bp_super"}'),
  ('d0e00000-0000-0000-0000-000000000002','bp_staff@akoatp-staff.com', '{"username":"bp_staff"}'),
  ('d0e00000-0000-0000-0000-000000000011','09777400011@akoatp.com', '{"phone":"09777400011","username":"cue_a"}'),
  ('d0e00000-0000-0000-0000-000000000012','09777400012@akoatp.com', '{"phone":"09777400012","username":"cue_b"}');
update public.profiles set role = 'admin' where id in
  ('d0e00000-0000-0000-0000-000000000001','d0e00000-0000-0000-0000-000000000002');

select public.test_act_as('11111111-1111-1111-1111-111111111111');
select public.grant_app_access('d0e00000-0000-0000-0000-000000000001','billiards','superadmin','bp_super');
select public.grant_app_access('d0e00000-0000-0000-0000-000000000002','billiards','admin','bp_staff');

insert into billiards.pool_tables (id, name) values
  ('d0e01111-0000-0000-0000-000000000001','Points 1'),
  ('d0e01111-0000-0000-0000-000000000002','Points 2');

create table if not exists _bids (name text primary key, id uuid);

create or replace function _bbal(p_user uuid) returns int language sql as $$
  select coalesce((select balance from public.point_wallets where user_id = p_user and app = 'billiards'), 0);
$$;
create or replace function _bnet(p_sess uuid) returns int language sql as $$
  select coalesce(sum(points_delta), 0)::int from public.point_transactions
   where app = 'billiards' and source_session_id = p_sess;
$$;

-- Make the shipped default explicit (an earlier test file may have changed it).
update public.point_rules set block_minutes = 60, points_per_block = 0, is_active = false where app = 'billiards';

-- ── Rule OFF: a customer can be attached, nothing is earned ────────────────
insert into _bids select 'off', test_value('d0e00000-0000-0000-0000-000000000002', 'authenticated',
  $$billiards.record_session('d0e01111-0000-0000-0000-000000000001', 120, '[]'::jsonb, null)$$)::uuid;
select chk('rule off: attaching works and earns 0',
  test_value('d0e00000-0000-0000-0000-000000000002', 'authenticated',
    $$billiards.set_session_customer((select id from _bids where name = 'off'), '09777400011')->>'points'$$), '0');
select chk('rule off: no ledger rows', _bnet((select id from _bids where name = 'off')), 0);
select chk('rule off: the OFF rule is frozen on that session',
  (select points_rule->>'is_active' from billiards.sessions where id = (select id from _bids where name = 'off')), 'false');

-- ── Owner switches it on: 15 points per full hour ──────────────────────────
select chk('billiards owner sets the rule',
  test_call('d0e00000-0000-0000-0000-000000000001', 'authenticated',
    $$public.set_point_rule('billiards', 60, 15, true)$$), 'NO ERROR');

select chk('switching on does not pay the session that finished while off',
  test_value('d0e00000-0000-0000-0000-000000000002', 'authenticated',
    $$billiards.set_session_customer((select id from _bids where name = 'off'), '09777400011')->>'points'$$), '0');

-- ── Live table: nothing while running, points at checkout ──────────────────
insert into _bids select 'live', test_value('d0e00000-0000-0000-0000-000000000002', 'authenticated',
  $$billiards.open_session('d0e01111-0000-0000-0000-000000000002', null)$$)::uuid;
select test_value('d0e00000-0000-0000-0000-000000000002', 'authenticated',
  $$billiards.set_session_customer((select id from _bids where name = 'live'), '+95 9777 400 012')$$);
select chk('a running table earns nothing yet', _bnet((select id from _bids where name = 'live')), 0);

-- 132 min played bills 130 (2 min in grace); waiving one block bills 120 -> 30.
update billiards.sessions set started_at = now() - interval '132 minutes'
 where id = (select id from _bids where name = 'live');
select test_value('d0e00000-0000-0000-0000-000000000002', 'authenticated',
  $$billiards.checkout_session((select id from _bids where name = 'live'), 'cash', 1)$$);
select chk('checkout: billed 120 after the waiver',
  (select billed_minutes from billiards.sessions where id = (select id from _bids where name = 'live')), 120);
select chk('checkout: cue_b earns 2 x 15 = 30', _bbal('d0e00000-0000-0000-0000-000000000012'), 30);
select chk('...as an earn row tagged billiards_session',
  (select transaction_type = 'earn' and source_kind = 'billiards_session'
     from public.point_transactions where source_session_id = (select id from _bids where name = 'live')), true);
select chk('...and nothing reached futsal or game',
  (select count(*)::int from public.point_wallets
    where user_id = 'd0e00000-0000-0000-0000-000000000012' and app <> 'billiards' and balance <> 0), 0);

-- ── Correction and void ─────────────────────────────────────────────────────
select test_value('d0e00000-0000-0000-0000-000000000002', 'authenticated',
  $$billiards.correct_session((select id from _bids where name = 'live'), 60, 'clock was wrong')$$);
select chk('corrected to 60 min: session now gave 15', _bnet((select id from _bids where name = 'live')), 15);

select test_value('d0e00000-0000-0000-0000-000000000001', 'authenticated',
  $$billiards.void_closed_session_time((select id from _bids where name = 'live'), 'test game', false)$$);
select chk('voided after checkout: points taken back', _bnet((select id from _bids where name = 'live')), 0);

-- void_active_session keeps the PLAYED minutes in billed_minutes with a zero
-- charge. It must still earn nothing.
insert into _bids select 'voidlive', test_value('d0e00000-0000-0000-0000-000000000002', 'authenticated',
  $$billiards.open_session('d0e01111-0000-0000-0000-000000000002', null)$$)::uuid;
select test_value('d0e00000-0000-0000-0000-000000000002', 'authenticated',
  $$billiards.set_session_customer((select id from _bids where name = 'voidlive'), '09777400011')$$);
update billiards.sessions set started_at = now() - interval '3 hours'
 where id = (select id from _bids where name = 'voidlive');
select test_value('d0e00000-0000-0000-0000-000000000002', 'authenticated',
  $$billiards.void_active_session((select id from _bids where name = 'voidlive'), 'cash', 'left without paying', false)$$);
select chk('void at checkout earns nothing despite 180 billed minutes',
  _bnet((select id from _bids where name = 'voidlive')), 0);

-- ── Typed-in session with the customer attached straight after ─────────────
insert into _bids select 'rec', test_value('d0e00000-0000-0000-0000-000000000002', 'authenticated',
  $$billiards.record_session('d0e01111-0000-0000-0000-000000000001', 65, '[]'::jsonb, null)$$)::uuid;
select chk('recorded 65 min (bills 70): 15 points',
  test_value('d0e00000-0000-0000-0000-000000000002', 'authenticated',
    $$billiards.set_session_customer((select id from _bids where name = 'rec'), '09777400011')->>'points'$$), '15');

-- ── Late changes ────────────────────────────────────────────────────────────
update billiards.sessions set ended_at = now() - interval '1 hour', paid_at = now() - interval '1 hour'
 where id = (select id from _bids where name = 'rec');
select chk('staff cannot move an older session to another customer',
  test_call('d0e00000-0000-0000-0000-000000000002', 'authenticated',
    $$billiards.set_session_customer((select id from _bids where name = 'rec'), '09777400012')$$),
  'Only a superadmin can change the customer on a finished session.');
select chk('staff CAN repeat the same customer (repair path)',
  test_call('d0e00000-0000-0000-0000-000000000002', 'authenticated',
    $$billiards.set_session_customer((select id from _bids where name = 'rec'), '09777400011')$$), 'NO ERROR');
select chk('superadmin moves it',
  test_call('d0e00000-0000-0000-0000-000000000001', 'authenticated',
    $$billiards.set_session_customer((select id from _bids where name = 'rec'), '09777400012')$$), 'NO ERROR');
select chk('...and it is audited under billiards',
  (select count(*)::int from public.audit_log where app = 'billiards' and action = 'session.customer_set'), 1);
select chk('...points moved with it',
  (select coalesce(sum(points_delta), 0)::int from public.point_transactions
    where source_session_id = (select id from _bids where name = 'rec') and customer_id = 'd0e00000-0000-0000-0000-000000000012'), 15);

-- ── Refusals ────────────────────────────────────────────────────────────────
select chk('unregistered phone refused',
  test_call('d0e00000-0000-0000-0000-000000000002', 'authenticated',
    $$billiards.set_session_customer((select id from _bids where name = 'off'), '09777499999')$$),
  'No customer is registered with that phone number. Ask them to sign up first.');
select chk('a voided session cannot get a customer',
  test_call('d0e00000-0000-0000-0000-000000000002', 'authenticated',
    $$billiards.set_session_customer((select id from _bids where name = 'live'), '09777400011')$$),
  'That session was voided. It cannot earn points.');
select chk('game staff cannot touch billiards sessions',
  test_call('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$billiards.set_session_customer((select id from _bids where name = 'off'), '09777400011')$$),
  'Not authorised to run billiards sessions.');

-- Leave the shipped default for any later file.
update public.point_rules set block_minutes = 60, points_per_block = 0, is_active = false where app = 'billiards';
