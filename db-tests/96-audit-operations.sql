\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- A shift is visible in the audit log, and the till never stops for it
-- ════════════════════════════════════════════════════════════════════════════
--
-- The client found this by testing: the audit log showed an approval at 11:12
-- and nothing for the rest of the evening, because trade was not audited at
-- all - only corrections to it. These assertions cover the two triggers that
-- close that gap, and the three ways they could go wrong:
--
--   1. attributing the row to the wrong person (or to nobody)
--   2. double-logging a correction as both a correction and a sale
--   3. logging the game total before the snacks are added

insert into auth.users (id, email) values
  ('77770000-0000-0000-0000-000000000001','ops_super@akoatp-staff.com'),
  ('77770000-0000-0000-0000-000000000002','ops_admin@akoatp-staff.com');
update public.profiles set role='admin', username='ops_super' where id='77770000-0000-0000-0000-000000000001';
update public.profiles set role='admin', username='ops_admin' where id='77770000-0000-0000-0000-000000000002';

select public.test_act_as('11111111-1111-1111-1111-111111111111');  -- owner, from 90-access
select public.grant_app_access('77770000-0000-0000-0000-000000000001','billiards','superadmin','ops_super');
select public.grant_app_access('77770000-0000-0000-0000-000000000002','billiards','admin','ops_admin');
select public.grant_app_access('77770000-0000-0000-0000-000000000001','game','superadmin','ops_super');

-- ── Billiards: closing a table ──────────────────────────────────────────────

insert into billiards.pool_tables (id, name) values ('77771111-0000-0000-0000-000000000001','Table 7');
insert into billiards.menu_categories (id, name_en, name_my) values ('77771111-0000-0000-0000-000000000002','Drinks','Drinks');
insert into billiards.menu_items (id, category_id, name_en, name_my, price, stock_qty)
  values ('77771111-0000-0000-0000-000000000003','77771111-0000-0000-0000-000000000002','Cola','Cola', 1500, 100);

select public.test_act_as('77770000-0000-0000-0000-000000000002');  -- a PLAIN admin runs the counter
insert into billiards.sessions (id, table_id, opened_by, started_at, status)
  values ('77772222-0000-0000-0000-000000000001','77771111-0000-0000-0000-000000000001',
          '77770000-0000-0000-0000-000000000002', now() - interval '80 minutes', 'active');
select billiards.add_order_item('77772222-0000-0000-0000-000000000001'::uuid,'77771111-0000-0000-0000-000000000003'::uuid, 2);
select billiards.checkout_session('77772222-0000-0000-0000-000000000001'::uuid, 'cash');

select chk('closing a table writes exactly one audit row',
  (select count(*)::int from public.audit_log
    where action='session.closed' and target_id='77772222-0000-0000-0000-000000000001'), 1);

-- Attribution is the whole point. closed_by, not whoever happened to be in the
-- GUC, and never NULL - an audit row with no actor is not evidence of anything.
select chk('...attributed to the admin who closed it',
  (select actor_id from public.audit_log
    where action='session.closed' and target_id='77772222-0000-0000-0000-000000000001'),
  '77770000-0000-0000-0000-000000000002'::uuid);
select chk('...with their name resolved, not "system"',
  (select actor_name from public.audit_log
    where action='session.closed' and target_id='77772222-0000-0000-0000-000000000001'), 'ops_admin'::text);
select chk('...filed under billiards, so RLS scopes it to that business',
  (select app from public.audit_log
    where action='session.closed' and target_id='77772222-0000-0000-0000-000000000001'), 'billiards'::text);
select chk('...and the food is in the total, not just the time',
  (select (details->>'food_total')::int from public.audit_log
    where action='session.closed' and target_id='77772222-0000-0000-0000-000000000001'), 3000);

-- ── The waiver: the reason this migration exists ────────────────────────────
-- Nothing recorded who reduced a bill. The numbers just looked smaller.

insert into billiards.sessions (id, table_id, opened_by, started_at, status)
  values ('77772222-0000-0000-0000-000000000002','77771111-0000-0000-0000-000000000001',
          '77770000-0000-0000-0000-000000000002', now() - interval '80 minutes', 'active');
select billiards.checkout_session('77772222-0000-0000-0000-000000000002'::uuid, 'cash', 1);

select chk('a waived checkout records the waiver',
  (select (details->>'waived_minutes')::int > 0 from public.audit_log
    where action='session.closed' and target_id='77772222-0000-0000-0000-000000000002'), true);
select chk('...and says so in words the owner will read',
  (select summary from public.audit_log
    where action='session.closed' and target_id='77772222-0000-0000-0000-000000000002') ~~ '%Waived%',
  true);
-- The negative control that makes the one above mean something: an ordinary
-- checkout must NOT claim a waiver.
select chk('control: an ordinary checkout claims no waiver',
  (select summary from public.audit_log
    where action='session.closed' and target_id='77772222-0000-0000-0000-000000000001') ~~ '%Waived%',
  false);

-- ── Game shop: a rental, and the snacks-timing trap ─────────────────────────

insert into game.stations (id, name, tier) values ('77773333-0000-0000-0000-000000000001','PS5-2','PS5');
insert into game.products (id, name_en, name_my, category, price, stock)
  values ('77773333-0000-0000-0000-000000000002','Crisps','Crisps','snack', 1000, 50);

select public.test_act_as('77770000-0000-0000-0000-000000000001');

-- Scoped to THIS session by id, never a global count: 94-superadmin.sql already
-- records a rental and 91-catalogue.sql already voids one, so a global count
-- here measures those too and says nothing about this trigger.
create temp table _ops_game (id uuid);
insert into _ops_game
select game.record_session('77773333-0000-0000-0000-000000000001'::uuid, 60,
  '[{"productId":"77773333-0000-0000-0000-000000000002","qty":3}]'::jsonb, 'test rental');

select chk('recording a rental writes exactly one audit row',
  (select count(*)::int from public.audit_log
    where action='session.recorded' and target_id = (select id::text from _ops_game)), 1);
select chk('...attributed to the staff member who recorded it',
  (select actor_id from public.audit_log
    where action='session.recorded' and target_id = (select id::text from _ops_game)),
  '77770000-0000-0000-0000-000000000001'::uuid);

-- THE TIMING TRAP. record_session inserts the row with snacks_total 0, adds the
-- order lines, then finalises the totals in a separate UPDATE. A trigger on the
-- INSERT would log the playtime and silently omit every snack - an audit log
-- that under-reports takings is worse than none.
select chk('...and the snacks are in the logged total',
  (select (details->>'snacks_total')::numeric from public.audit_log
    where action='session.recorded' and target_id = (select id::text from _ops_game)), 3000::numeric);
select chk('...total = playtime + snacks, not playtime alone',
  (select (details->>'total')::numeric > (details->>'playtime_total')::numeric
     from public.audit_log
    where action='session.recorded' and target_id = (select id::text from _ops_game)), true);

-- ── No double-logging ───────────────────────────────────────────────────────
-- void_session also rewrites total. Without the void_reason guard on the
-- trigger, every correction would appear twice: once honestly as a correction,
-- and once falsely as a fresh sale.

select chk('control: this session has no correction row yet',
  (select count(*)::int from public.audit_log
    where action='session.voided' and target_id = (select id::text from _ops_game)), 0);

select public.test_act_as('77770000-0000-0000-0000-000000000001');
do $$
declare v_id uuid;
begin
  select id into v_id from _ops_game;
  perform game.void_session(v_id, 'Wrong duration entered', true);
end $$;

select chk('voiding writes its correction row',
  (select count(*)::int from public.audit_log
    where action='session.voided' and target_id = (select id::text from _ops_game)), 1);

-- The guard that earns its keep: void_session rewrites total, so without
-- `void_reason is null` on the trigger this correction would ALSO be logged as
-- a fresh sale - the takings would read as if the money came in twice.
select chk('...and does NOT also log a second fake sale',
  (select count(*)::int from public.audit_log
    where action='session.recorded' and target_id = (select id::text from _ops_game)), 1);

-- ── The till must not stop because the log did ──────────────────────────────
-- The header explains the divergence: these two triggers swallow logging
-- faults. Proving it means breaking audit() and checking the money still
-- moves. audit_log has no write policy, so revoking the insert is not enough -
-- replace the writer with one that always raises.

create or replace function public.audit(
  p_app text, p_action text, p_summary text,
  p_target_type text default null, p_target_id text default null,
  p_target_label text default null, p_details jsonb default null,
  p_actor uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  raise exception 'simulated audit outage';
end $$;

insert into billiards.sessions (id, table_id, opened_by, started_at, status)
  values ('77772222-0000-0000-0000-000000000003','77771111-0000-0000-0000-000000000001',
          '77770000-0000-0000-0000-000000000002', now() - interval '80 minutes', 'active');
select public.test_act_as('77770000-0000-0000-0000-000000000002');

select chk('a counter transaction still completes when auditing is broken',
  public.test_call('77770000-0000-0000-0000-000000000002','authenticated',
    $$billiards.checkout_session('77772222-0000-0000-0000-000000000003'::uuid, 'cash')$$),
  'NO ERROR'::text);
select chk('...and the money is actually recorded on the session',
  (select status from billiards.sessions where id='77772222-0000-0000-0000-000000000003'), 'closed'::text);
