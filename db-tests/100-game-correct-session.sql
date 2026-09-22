\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- game.correct_session: re-price a paid session without moving the money
-- ════════════════════════════════════════════════════════════════════════════
--
-- The bug this exists to prevent is not a wrong charge - it is a RIGHT charge
-- filed on the wrong day. The old repair path was void + record_session, and
-- record_session does not set created_at, so a correction made the next morning
-- moved revenue off the day it was taken. The assertion that matters most in
-- this file is therefore the boring one: created_at does not change.
--
-- Reuses the actors and station from 97-game-live-sessions.sql:
--   88880000-…0001  g_super  (game superadmin)
--   88880000-…0002  g_staff  (game admin, NOT superadmin)
--   88881111-…0001  TV 9     (PS5)

-- This file gets its OWN station. 97-game-live-sessions.sql deliberately ends
-- with a session still running on TV 9 (it asserts that an unfinished row has
-- no total to sum), and record_session now refuses to back-fill over a running
-- session - correctly. A test that borrows another file's fixture inherits its
-- leftovers, so this one does not.
insert into game.stations (id, name, tier, sort_order)
  values ('88881111-0000-0000-0000-000000000009','TV 100','PS5', 100)
  on conflict (id) do nothing;

select public.test_act_as('88880000-0000-0000-0000-000000000002');

-- A settled session, filed three days ago.
create temp table _fix (id uuid);
insert into _fix
  select game.record_session('88881111-0000-0000-0000-000000000009'::uuid, 90);
update game.sessions
   set created_at = now() - interval '3 days'
 where id = (select id from _fix);

create temp table _before as
  select created_at, minutes, charged_minutes, total, snacks_total
    from game.sessions where id = (select id from _fix);

-- ── Who may correct ─────────────────────────────────────────────────────────
-- Widened by game-admin-permissions-migration.sql (2026-09-21): any active
-- staff may correct a session, not superadmin-only — a wrong duration is a
-- mistake anyone on shift should be able to fix, still traceable via
-- corrected_by. Only anon is refused, at the grant.

select chk('anon is denied at the grant, before the body runs',
  public.test_call(null,'anon',
    format($$game.correct_session(%L::uuid, 19, 'nope')$$, (select id from _fix)))
  ~~ '%permission denied for function%', true);

select chk('control: the denied anon attempt changed nothing',
  (select total from game.sessions where id = (select id from _fix))
    = (select total from _before), true);

-- ── The correction itself ───────────────────────────────────────────────────
-- Done by a PLAIN admin (g_staff, NOT superadmin) — proving the widened rank
-- actually works, not just that the old superadmin-only rank still does.

select public.test_act_as('88880000-0000-0000-0000-000000000002');  -- plain admin
select game.correct_session((select id from _fix), 19, 'Timer left running after the customer paid');

-- THE ONE THAT MATTERS. A correction must not move revenue to another day.
select chk('created_at is untouched — the money stays on the day it was taken',
  (select created_at from game.sessions where id = (select id from _fix))
    = (select created_at from _before), true);

select chk('minutes now hold the corrected duration',
  (select minutes from game.sessions where id = (select id from _fix)), 19);
select chk('...priced through the same block rule as the timer (19 -> tier minimum)',
  (select s.charged_minutes = game.bill_minutes(19, p.min_minutes, p.increment_minutes,
                                                p.grace_minutes, 0)
     from game.sessions s join game.pricing p on p.tier = s.tier
    where s.id = (select id from _fix)), true);
select chk('...and the playtime follows the charged minutes at the snapshotted rate',
  (select playtime_total = round(rate_per_hour * charged_minutes / 60.0)
     from game.sessions where id = (select id from _fix)), true);
select chk('...the total is playtime plus the snacks that were already on it',
  (select total = playtime_total + snacks_total
     from game.sessions where id = (select id from _fix)), true);
select chk('...snacks were NOT returned or altered',
  (select snacks_total from game.sessions where id = (select id from _fix))
    = (select snacks_total from _before), true);

-- Without the originals, an in-place edit hides the mistake from the owner.
select chk('the original charged minutes are kept',
  (select original_charged_minutes from game.sessions where id = (select id from _fix)),
  (select charged_minutes from _before));
select chk('the original total is kept',
  (select original_total from game.sessions where id = (select id from _fix)),
  (select total from _before));
select chk('...attributed to the plain admin who did it, not a superadmin',
  (select corrected_by from game.sessions where id = (select id from _fix)),
  '88880000-0000-0000-0000-000000000002'::uuid);
select chk('...with the reason stored',
  (select correction_reason from game.sessions where id = (select id from _fix))
  ~~ '%Timer left running%', true);

-- ── Audit ───────────────────────────────────────────────────────────────────

select chk('one audit row, action session.corrected',
  (select count(*)::int from public.audit_log
    where action = 'session.corrected'
      and target_id = (select id::text from _fix)), 1);
select chk('...carrying both the old and the new figures',
  (select (details->>'original_total') is not null and (details->>'total') is not null
     from public.audit_log
    where action = 'session.corrected'
      and target_id = (select id::text from _fix)), true);
-- The checkout trigger fires on `update of total`. A correction updates total,
-- so without its new guard every correction would ALSO log a second, false row
-- claiming a session had just been recorded.
select chk('the checkout trigger did NOT also log a bogus session.recorded',
  (select count(*)::int from public.audit_log
    where action in ('session.recorded','session.closed')
      and target_id = (select id::text from _fix)), 1);

-- ── Correcting twice ────────────────────────────────────────────────────────
-- The originals are captured once. A second correction must still show what the
-- customer was FIRST charged, not what the previous correction left behind.
-- Done by the superadmin this time — proving that rank is still allowed too.

select public.test_act_as('88880000-0000-0000-0000-000000000001');  -- superadmin
select game.correct_session((select id from _fix), 45, 'Second look at the CCTV');
select chk('a second correction keeps the FIRST original, not the previous value',
  (select original_charged_minutes from game.sessions where id = (select id from _fix)),
  (select charged_minutes from _before));
select chk('...and still has not moved the day',
  (select created_at from game.sessions where id = (select id from _fix))
    = (select created_at from _before), true);

-- ── What cannot be corrected ────────────────────────────────────────────────

select chk('a length of zero is refused',
  public.test_call('88880000-0000-0000-0000-000000000001','authenticated',
    format($$game.correct_session(%L::uuid, 0, 'nope')$$, (select id from _fix)))
  ~~ '%positive%', true);
select chk('an empty reason is refused',
  public.test_call('88880000-0000-0000-0000-000000000001','authenticated',
    format($$game.correct_session(%L::uuid, 20, '   ')$$, (select id from _fix)))
  ~~ '%reason%', true);

select public.test_act_as('88880000-0000-0000-0000-000000000002');
create temp table _open (id uuid);
insert into _open select game.open_session('88881111-0000-0000-0000-000000000009'::uuid, 'running');
select chk('a running session cannot be corrected — close it first',
  public.test_call('88880000-0000-0000-0000-000000000001','authenticated',
    format($$game.correct_session(%L::uuid, 20, 'nope')$$, (select id from _open)))
  ~~ '%still open%', true);
select public.test_act_as('88880000-0000-0000-0000-000000000002');
do $$ begin perform game.cancel_active_session((select id from _open), 'test cleanup'); end $$;

-- Cancelling is terminal. Re-pricing a written-off sale would quietly put
-- revenue back onto a row the owner has already decided to zero.
create temp table _dead (id uuid);
insert into _dead
  select game.record_session('88881111-0000-0000-0000-000000000009'::uuid, 60);
select public.test_act_as('88880000-0000-0000-0000-000000000001');
do $$ begin perform game.void_session((select id from _dead), 'wrong customer', false); end $$;
select chk('a cancelled session cannot be corrected',
  public.test_call('88880000-0000-0000-0000-000000000001','authenticated',
    format($$game.correct_session(%L::uuid, 20, 'nope')$$, (select id from _dead)))
  ~~ '%cancelled%', true);
select chk('control: the cancelled session is still zeroed',
  (select playtime_total from game.sessions where id = (select id from _dead)), 0::numeric);

-- ── Reports still add up ────────────────────────────────────────────────────
-- A correction that produced a row the day total cannot sum would be worse than
-- the overcharge it fixed.
select chk('a corrected session still satisfies the completeness constraint',
  (select minutes is not null and charged_minutes is not null
      and playtime_total is not null and total is not null
     from game.sessions where id = (select id from _fix)), true);
