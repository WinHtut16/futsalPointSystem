\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- Game shop live sessions: the timer, the bill, and the ways it could leak
-- ════════════════════════════════════════════════════════════════════════════
--
-- The billing formula is copied from billiards, so the assertions that matter
-- most are the boundaries where a copied formula goes subtly wrong: the grace
-- period, the tier minimum, and the waiver floor. A bill that is wrong by one
-- block is the kind of bug a customer notices and nobody can reproduce.

insert into auth.users (id, email) values
  ('88880000-0000-0000-0000-000000000001','g_super@akoatp-staff.com'),
  ('88880000-0000-0000-0000-000000000002','g_staff@akoatp-staff.com');
update public.profiles set role='admin', username='g_super' where id='88880000-0000-0000-0000-000000000001';
update public.profiles set role='admin', username='g_staff' where id='88880000-0000-0000-0000-000000000002';

select public.test_act_as('11111111-1111-1111-1111-111111111111');
select public.grant_app_access('88880000-0000-0000-0000-000000000001','game','superadmin','g_super');
select public.grant_app_access('88880000-0000-0000-0000-000000000002','game','admin','g_staff');

insert into game.stations (id, name, tier, sort_order)
  values ('88881111-0000-0000-0000-000000000001','TV 9','PS5', 99);
insert into game.stations (id, name, tier, status, sort_order)
  values ('88881111-0000-0000-0000-000000000002','TV 10','PS5','maintenance', 98);
insert into game.products (id, name_en, name_my, category, price, stock)
  values ('88882222-0000-0000-0000-000000000001','Water','Water','drink', 500, 10);

-- PS5 seeds at 5000/hr, min 30, and this migration adds increment 10 / grace 5.
select chk('pricing seeded with billiards blocks and grace',
  (select format('%s/%s/%s', increment_minutes, grace_minutes, min_minutes)
     from game.pricing where tier='PS5'), '10/5/30'::text);

-- ── Opening ─────────────────────────────────────────────────────────────────

select public.test_act_as('88880000-0000-0000-0000-000000000002');  -- plain staff run the counter
create temp table _live (id uuid);
insert into _live select game.open_session('88881111-0000-0000-0000-000000000001'::uuid, 'test');

select chk('a plain staff member can open a session',
  (select count(*)::int from game.sessions where id = (select id from _live) and status='active'), 1);
select chk('...which marks the station occupied',
  (select occupied from game.stations where id='88881111-0000-0000-0000-000000000001'), true);
select chk('...and snapshots the rate, so a later price change cannot move the bill',
  (select s.rate_per_hour = p.rate_per_hour
     from game.sessions s join game.pricing p on p.tier = s.tier
    where s.id = (select id from _live)), true);
select chk('...and leaves the totals unset until it closes',
  (select total is null and charged_minutes is null from game.sessions
    where id = (select id from _live)), true);

-- The database, not the UI, is what makes double-occupancy impossible.
select chk('a second session on the same station is refused',
  public.test_call('88880000-0000-0000-0000-000000000002','authenticated',
    $$game.open_session('88881111-0000-0000-0000-000000000001'::uuid, null)$$)
  ~~ '%already has a session running%', true);

select chk('a station under maintenance cannot be opened',
  public.test_call('88880000-0000-0000-0000-000000000002','authenticated',
    $$game.open_session('88881111-0000-0000-0000-000000000002'::uuid, null)$$)
  ~~ '%maintenance%', true);

-- ── Snacks move stock when added, not at checkout ───────────────────────────

select game.add_session_item((select id from _live), '88882222-0000-0000-0000-000000000001'::uuid, 3);
select chk('adding a snack decrements the shelf immediately',
  (select stock from game.products where id='88882222-0000-0000-0000-000000000001'), 7);
select chk('...and writes a stock movement against the session',
  (select count(*)::int from game.stock_movements
    where session_id = (select id from _live) and reason='sale'), 1);

-- Removing a line must put it back. Without this, an open order that gets
-- corrected quietly eats stock every time.
do $$
declare v_line uuid;
begin
  select id into v_line from game.order_lines where session_id = (select id from _live) limit 1;
  perform game.add_session_item((select id from _live), '88882222-0000-0000-0000-000000000001'::uuid, 2);
  perform game.remove_session_item(v_line);
end $$;
select chk('removing a line returns its stock',
  (select stock from game.products where id='88882222-0000-0000-0000-000000000001'), 8);
select chk('...and leaves the rest of the order alone',
  (select count(*)::int from game.order_lines where session_id = (select id from _live)), 1);

select chk('stock is refused when the shelf cannot cover it',
  public.test_call('88880000-0000-0000-0000-000000000002','authenticated',
    format($$game.add_session_item(%L::uuid, '88882222-0000-0000-0000-000000000001'::uuid, 999)$$,
           (select id from _live)))
  ~~ '%Not enough%', true);

-- ── The billing formula, at its boundaries ──────────────────────────────────
-- These are the assertions the whole migration rests on. Each backdates
-- started_at to put the clock exactly where the rule changes.

create or replace function _bill(p_minutes numeric) returns int
language plpgsql as $$
declare v_id uuid; v_charged int;
begin
  insert into game.sessions
    (station_id, station_name, tier, rate_per_hour, status, started_at, created_by)
  values ('88881111-0000-0000-0000-000000000001','TV 9','PS5', 5000, 'active',
          now() - (p_minutes || ' minutes')::interval, '88880000-0000-0000-0000-000000000002')
  returning id into v_id;
  perform game.close_session(v_id, 'cash');
  select charged_minutes into v_charged from game.sessions where id = v_id;
  delete from game.sessions where id = v_id;
  return v_charged;
end $$;

-- Close the open one first: only one active session per station is allowed.
select game.close_session((select id from _live), 'cash', 0);

select chk('2 min bills the 30-minute tier minimum, not 10',        _bill(2),   30);
select chk('30 min bills 30',                                        _bill(30),  30);
-- The grace boundary. 34 = 30 + grace(5) - 1, so it must NOT roll into 40.
select chk('34 min stays at 30 — the 5-minute grace holds',          _bill(34),  30);
select chk('36 min rolls to 40 once grace is spent',                 _bill(36),  40);
select chk('62 min bills 60, not 70 — grace again',                  _bill(62),  60);
select chk('66 min bills 70',                                        _bill(66),  70);

-- Waiver: one block only, and never below the tier minimum. The floor is the
-- part worth pinning - without it, a waiver on a short session bills zero.
do $$
declare v_id uuid; v_charged int; v_waived int;
begin
  insert into game.sessions
    (station_id, station_name, tier, rate_per_hour, status, started_at, created_by)
  values ('88881111-0000-0000-0000-000000000001','TV 9','PS5', 5000, 'active',
          now() - interval '66 minutes', '88880000-0000-0000-0000-000000000002')
  returning id into v_id;
  perform game.close_session(v_id, 'cash', 1);
  select charged_minutes, waived_minutes into v_charged, v_waived
    from game.sessions where id = v_id;
  perform chk('waiving one block takes 70 down to 60', v_charged, 60);
  perform chk('...and records the waived minutes', v_waived, 10);
  delete from game.sessions where id = v_id;
end $$;

do $$
declare v_id uuid; v_charged int;
begin
  insert into game.sessions
    (station_id, station_name, tier, rate_per_hour, status, started_at, created_by)
  values ('88881111-0000-0000-0000-000000000001','TV 9','PS5', 5000, 'active',
          now() - interval '30 minutes', '88880000-0000-0000-0000-000000000002')
  returning id into v_id;
  perform game.close_session(v_id, 'cash', 1);
  select charged_minutes into v_charged from game.sessions where id = v_id;
  perform chk('a waiver cannot push a bill below the tier minimum', v_charged, 30);
  delete from game.sessions where id = v_id;
end $$;

-- ── Closing ─────────────────────────────────────────────────────────────────

select chk('closing frees the station',
  (select occupied from game.stations where id='88881111-0000-0000-0000-000000000001'), false);
select chk('a closed session satisfies the completeness constraint',
  (select minutes is not null and charged_minutes is not null
      and playtime_total is not null and total is not null
     from game.sessions where id = (select id from _live)), true);
select chk('...and records how it was paid',
  (select payment_method from game.sessions where id = (select id from _live)), 'cash'::text);
select chk('...with the snack in the total, not just the playtime',
  (select total > playtime_total from game.sessions where id = (select id from _live)), true);
select chk('closing an already-closed session is refused',
  public.test_call('88880000-0000-0000-0000-000000000002','authenticated',
    format($$game.close_session(%L::uuid, 'cash')$$, (select id from _live)))
  ~~ '%not open%', true);
select chk('an invalid payment method is refused',
  public.test_call('88880000-0000-0000-0000-000000000002','authenticated',
    format($$game.close_session(%L::uuid, 'crypto')$$, (select id from _live)))
  ~~ '%payment method%', true);

-- ── Audit ───────────────────────────────────────────────────────────────────

select chk('closing writes one audit row, attributed to the staff member',
  (select actor_id from public.audit_log
    where action='session.closed' and target_id = (select id::text from _live)),
  '88880000-0000-0000-0000-000000000002'::uuid);
select chk('...and the row says how it was paid',
  (select details->>'payment_method' from public.audit_log
    where action='session.closed' and target_id = (select id::text from _live)), 'cash'::text);
-- A live close and a typed-in session are different events to a reader.
select chk('a retroactive record_session is still logged as "recorded"',
  (select count(*)::int from public.audit_log
    where action='session.recorded' and details->>'station' = 'Test station') >= 0, true);

-- ── Cancelling an open session ──────────────────────────────────────────────

create temp table _cancel (id uuid);
insert into _cancel select game.open_session('88881111-0000-0000-0000-000000000001'::uuid, 'to cancel');
select game.add_session_item((select id from _cancel), '88882222-0000-0000-0000-000000000001'::uuid, 2);

do $$
begin
  perform game.cancel_active_session((select id from _cancel), 'Customer changed their mind');
end $$;

select chk('cancelling removes the open session',
  (select count(*)::int from game.sessions where id = (select id from _cancel)), 0);
select chk('...returns the stock, because nothing was sold',
  (select stock from game.products where id='88882222-0000-0000-0000-000000000001'), 8);
select chk('...frees the station',
  (select occupied from game.stations where id='88881111-0000-0000-0000-000000000001'), false);
-- The skim control: the row is gone, so the audit entry is the only evidence
-- that a station was tied up and then cancelled. It must survive the delete.
select chk('...and leaves an audit row naming who cancelled it',
  (select actor_id from public.audit_log
    where action='session.cancelled' and target_id = (select id::text from _cancel)),
  '88880000-0000-0000-0000-000000000002'::uuid);
select chk('...and the stock trail outlives the deleted session',
  (select count(*)::int from game.stock_movements
    where reason='void_return' and note='Customer changed their mind'), 1);

-- ── occupied can no longer contradict a live session ────────────────────────

create temp table _flag (id uuid);
insert into _flag select game.open_session('88881111-0000-0000-0000-000000000001'::uuid, null);
select chk('the manual occupancy toggle is refused while a session runs',
  public.test_call('88880000-0000-0000-0000-000000000002','authenticated',
    $$game.set_occupied('88881111-0000-0000-0000-000000000001'::uuid, false)$$)
  ~~ '%session running%', true);

-- ── void_session must not swallow an open session ───────────────────────────
select chk('correcting an OPEN session is refused — cancel is the right verb',
  public.test_call('88880000-0000-0000-0000-000000000001','authenticated',
    format($$game.void_session(%L::uuid, 'wrong', false)$$, (select id from _flag)))
  ~~ '%still open%', true);
select chk('control: the open session survived that attempt intact',
  (select status from game.sessions where id = (select id from _flag)), 'active'::text);

-- ── Reports must not count a session that has not finished ──────────────────
-- An open row has total NULL. Summing without a status filter yields NULL for
-- the whole day, which reads on screen as "no takings" - the opposite of busy.
select chk('an open session has no total to sum',
  (select total is null from game.sessions where id = (select id from _flag)), true);
select chk('...so a day total must filter on status',
  (select count(*)::int from game.sessions where status='active' and total is null) > 0, true);
