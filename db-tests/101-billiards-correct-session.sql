\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- billiards.correct_session: re-price a closed table without moving the money
-- ════════════════════════════════════════════════════════════════════════════
--
-- Billiards' analogue of 100-game-correct-session.sql. Before
-- billiards-correct-session-migration.sql, the only repair for a wrong
-- duration was void_closed_session_time, which zeroes the time charge
-- outright rather than re-pricing it. The assertion that matters most here is
-- the boring one, same as game's: paid_at does not change. Billiards sessions
-- have no created_at column at all — getClosedSessions/getAllTimeSummary key
-- entirely on paid_at, so a correction that moved it would silently shift
-- revenue to the wrong day in every report.

insert into auth.users (id, email) values
  ('99990000-0000-0000-0000-000000000001','csuper@akoatp-staff.com'),
  ('99990000-0000-0000-0000-000000000002','cadmin@akoatp-staff.com');
update public.profiles set role='admin', username='csuper' where id='99990000-0000-0000-0000-000000000001';
update public.profiles set role='admin', username='cadmin' where id='99990000-0000-0000-0000-000000000002';

select public.test_act_as('11111111-1111-1111-1111-111111111111');  -- owner, from 90-access
select public.grant_app_access('99990000-0000-0000-0000-000000000001','billiards','superadmin','csuper');
select public.grant_app_access('99990000-0000-0000-0000-000000000002','billiards','admin','cadmin');

insert into billiards.pool_tables (id, name) values ('99991111-0000-0000-0000-000000000001','Table 99');

-- A settled table, run through the real checkout path so rate_per_hour and
-- actual_minutes are stamped exactly like production — not hand-inserted,
-- since a hand-built row could hide a bug in checkout_session's own stamping.
select public.test_act_as('99990000-0000-0000-0000-000000000002');  -- plain admin
insert into billiards.sessions (id, table_id, opened_by, started_at, status)
  values ('99992222-0000-0000-0000-000000000001','99991111-0000-0000-0000-000000000001',
          '99990000-0000-0000-0000-000000000002', now() - interval '90 minutes', 'active');
select billiards.checkout_session('99992222-0000-0000-0000-000000000001'::uuid, 'cash');

-- Filed three days ago, same as the game fixture.
update billiards.sessions
   set paid_at = now() - interval '3 days'
 where id = '99992222-0000-0000-0000-000000000001';

create temp table _before as
  select paid_at, actual_minutes, billed_minutes, time_charge, total, food_total, rate_per_hour
    from billiards.sessions where id = '99992222-0000-0000-0000-000000000001';

-- ── Who may correct ─────────────────────────────────────────────────────────
-- Any active admin, matching game.correct_session — a wrong duration is a
-- mistake anyone on shift should be able to fix. Only anon is refused, at
-- the grant.

select chk('anon is denied at the grant, before the body runs',
  public.test_call(null,'anon',
    $$billiards.correct_session('99992222-0000-0000-0000-000000000001'::uuid, 19, 'nope')$$)
  ~~ '%permission denied for function%', true);

select chk('control: the denied anon attempt changed nothing',
  (select total from billiards.sessions where id = '99992222-0000-0000-0000-000000000001')
    = (select total from _before), true);

-- ── The correction itself ───────────────────────────────────────────────────
-- Done by a PLAIN admin, not superadmin.

select public.test_act_as('99990000-0000-0000-0000-000000000002');
select billiards.correct_session('99992222-0000-0000-0000-000000000001'::uuid, 19,
  'Clock forgotten, timer started late');

select chk('paid_at is untouched — the money stays on the day it was taken',
  (select paid_at from billiards.sessions where id = '99992222-0000-0000-0000-000000000001')
    = (select paid_at from _before), true);

select chk('actual_minutes now holds the corrected duration',
  (select actual_minutes from billiards.sessions where id = '99992222-0000-0000-0000-000000000001'), 19);

select chk('...priced through the same block rule as checkout (19 -> the minimum)',
  (select s.billed_minutes = billiards.bill_minutes(19, st.min_minutes, st.increment_minutes, st.grace_minutes, 0)
     from billiards.sessions s, billiards.app_settings st
    where s.id = '99992222-0000-0000-0000-000000000001' and st.id = true), true);

select chk('...and the time charge follows the billed minutes at the SNAPSHOTTED rate',
  (select time_charge = round(rate_per_hour * billed_minutes / 60.0)
     from billiards.sessions where id = '99992222-0000-0000-0000-000000000001'), true);

select chk('...the total is time_charge plus the food that was already on it',
  (select total = time_charge + food_total
     from billiards.sessions where id = '99992222-0000-0000-0000-000000000001'), true);

select chk('...food_total was NOT touched',
  (select food_total from billiards.sessions where id = '99992222-0000-0000-0000-000000000001')
    = (select food_total from _before), true);

-- Without the originals, an in-place edit hides the mistake from the owner.
select chk('the original billed minutes are kept',
  (select original_billed_minutes from billiards.sessions where id = '99992222-0000-0000-0000-000000000001'),
  (select billed_minutes from _before));
select chk('the original total is kept',
  (select original_total from billiards.sessions where id = '99992222-0000-0000-0000-000000000001'),
  (select total from _before));
select chk('...attributed to the plain admin who did it',
  (select corrected_by from billiards.sessions where id = '99992222-0000-0000-0000-000000000001'),
  '99990000-0000-0000-0000-000000000002'::uuid);
select chk('...with the reason stored',
  (select correction_reason from billiards.sessions where id = '99992222-0000-0000-0000-000000000001')
  ~~ '%Clock forgotten%', true);

-- ── Audit ───────────────────────────────────────────────────────────────────
-- audit_billiards_session_closed only fires on `update of status`
-- (old='active', new='closed'), which a correction never touches — unlike
-- game, there is no separate double-log guard to prove here, just that
-- exactly one row exists.

select chk('one audit row, action session.corrected',
  (select count(*)::int from public.audit_log
    where action = 'session.corrected' and target_id = '99992222-0000-0000-0000-000000000001'), 1);
select chk('...carrying both the old and the new figures',
  (select (details->>'original_total') is not null and (details->>'total') is not null
     from public.audit_log
    where action = 'session.corrected' and target_id = '99992222-0000-0000-0000-000000000001'), true);
select chk('control: the checkout trigger logged exactly once, not a second time for the correction',
  (select count(*)::int from public.audit_log
    where action = 'session.closed' and target_id = '99992222-0000-0000-0000-000000000001'), 1);

-- ── Correcting twice, after the price has since changed ────────────────────
-- The originals are captured once. A second correction — this time by the
-- superadmin, proving that rank is still allowed too — must still show what
-- was FIRST charged. It also has to keep pricing at the rate the CUSTOMER
-- paid, even though the hall's rate has since changed: a price bump must not
-- retroactively reprice a bill that was already settled.

update billiards.app_settings set hourly_rate = hourly_rate * 2 where id = true;

select public.test_act_as('99990000-0000-0000-0000-000000000001');  -- superadmin
select billiards.correct_session('99992222-0000-0000-0000-000000000001'::uuid, 45, 'Second look at the till tape');

select chk('a second correction keeps the FIRST original, not the previous value',
  (select original_billed_minutes from billiards.sessions where id = '99992222-0000-0000-0000-000000000001'),
  (select billed_minutes from _before));
select chk('...and still has not moved the day',
  (select paid_at from billiards.sessions where id = '99992222-0000-0000-0000-000000000001')
    = (select paid_at from _before), true);
select chk('...and still prices at the ORIGINAL rate, not the hall''s current (doubled) rate',
  (select time_charge from billiards.sessions where id = '99992222-0000-0000-0000-000000000001'),
  (select round(rate_per_hour * (select billed_minutes from billiards.sessions
      where id = '99992222-0000-0000-0000-000000000001') / 60.0) from _before));

update billiards.app_settings set hourly_rate = hourly_rate / 2 where id = true;

-- ── What cannot be corrected ────────────────────────────────────────────────

select chk('a length of zero is refused',
  public.test_call('99990000-0000-0000-0000-000000000001','authenticated',
    $$billiards.correct_session('99992222-0000-0000-0000-000000000001'::uuid, 0, 'nope')$$)
  ~~ '%positive%', true);
select chk('an empty reason is refused',
  public.test_call('99990000-0000-0000-0000-000000000001','authenticated',
    $$billiards.correct_session('99992222-0000-0000-0000-000000000001'::uuid, 20, '   ')$$)
  ~~ '%reason%', true);

select public.test_act_as('99990000-0000-0000-0000-000000000002');
insert into billiards.sessions (id, table_id, opened_by, started_at, status)
  values ('99992222-0000-0000-0000-000000000002','99991111-0000-0000-0000-000000000001',
          '99990000-0000-0000-0000-000000000002', now(), 'active');
select chk('an active session cannot be corrected — check it out first',
  public.test_call('99990000-0000-0000-0000-000000000001','authenticated',
    $$billiards.correct_session('99992222-0000-0000-0000-000000000002'::uuid, 20, 'nope')$$)
  ~~ '%active%', true);
select billiards.void_active_session('99992222-0000-0000-0000-000000000002'::uuid, 'cash', 'test cleanup', false);

-- Voiding is terminal. Re-pricing a written-off table would quietly put
-- revenue back onto a row the owner has already decided to zero.
select chk('a voided session cannot be corrected',
  public.test_call('99990000-0000-0000-0000-000000000001','authenticated',
    $$billiards.correct_session('99992222-0000-0000-0000-000000000002'::uuid, 20, 'nope')$$)
  ~~ '%voided%', true);
select chk('control: the voided session is still zeroed',
  (select time_charge from billiards.sessions where id = '99992222-0000-0000-0000-000000000002'), 0);
