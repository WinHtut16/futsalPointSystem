-- Audit the routine money operations, not just the corrections.
--
-- WHY
-- The audit log recorded decisions and corrections: approvals, rejections,
-- voids, catalogue edits, access changes. It did not record trade. A staff
-- member could work an entire shift closing tables and recording rentals and
-- leave no trace on the page called "Audit", while a single void was logged in
-- full. For an owner asking "what did my staff do tonight" that is a thin
-- answer, and it is the gap the client found by testing.
--
-- Two triggers, one per business. Both attribute the row to the person the
-- table already names - billiards.sessions.closed_by, game.sessions.created_by
-- - rather than trusting the caller, and both pass it as audit()'s p_actor
-- fallback so the record survives a service-role path where auth.uid() is null.
--
-- WHAT IS DELIBERATELY NOT HERE
-- Bookings. public.bookings has no _by column of any kind, so a trigger there
-- could say "booking ABC123 was confirmed" and not who confirmed it. An audit
-- row with no actor is not evidence of anything, and /admin/activity already
-- shows booking movement for anyone who wants to see it. Attributing bookings
-- needs an updated_by column set by every route that changes status; that is a
-- separate change and should not be smuggled in here.
--
-- ONE DELIBERATE DIVERGENCE FROM audit-log-migration.sql
-- That file has no exception handler, on purpose: "No action without a
-- record." That trade is right for a price edit, which nobody is waiting on
-- and which can be redone. It is wrong at a counter. If a logging fault made
-- checkout_session raise, a staff member could not close a table with a
-- customer standing in front of them, and the till would stop over a bug in a
-- log. So these two - and only these two, the ones on the money path - catch,
-- warn, and let the transaction through. The warning lands in the Postgres
-- logs, so the hole is visible rather than silent.
--
-- IDEMPOTENT. Safe to re-run.

begin;

do $$
begin
  if to_regprocedure('public.audit(text,text,text,text,text,text,jsonb,uuid)') is null then
    raise exception 'audit-money-migration.sql has not been applied (no 8-arg audit()). Nothing was created.';
  end if;
end $$;

-- ── Billiards: a table closed and paid ──────────────────────────────────────
-- The whole checkout lands in one UPDATE, so the row is already final when
-- this fires and no edit to checkout_session is needed. waived_minutes is read
-- straight off the row: it is the one number that distinguishes a waived bill
-- from a cheap one, and until now nothing recorded who waived it.
create or replace function public.audit_billiards_session_closed()
returns trigger language plpgsql security definer
set search_path = billiards, public as $$
declare
  v_table text;
begin
  select name into v_table from billiards.pool_tables where id = new.table_id;

  begin
    perform public.audit(
      'billiards', 'session.closed',
      format('Closed %s for %s (%s).%s',
             coalesce(v_table, 'a table'),
             coalesce(new.total, 0),
             coalesce(new.payment_method, 'unspecified'),
             case when coalesce(new.waived_minutes, 0) > 0
                  then format(' Waived %s min.', new.waived_minutes)
                  else '' end),
      'session', new.id::text, v_table,
      jsonb_build_object(
        'table',          v_table,
        'billed_minutes', new.billed_minutes,
        'waived_minutes', coalesce(new.waived_minutes, 0),
        'time_charge',    new.time_charge,
        'food_total',     new.food_total,
        'total',          new.total,
        'payment_method', new.payment_method
      ),
      new.closed_by
    );
  exception when others then
    -- See the header: the till must not stop because the log did.
    raise warning 'audit_billiards_session_closed failed for session %: %', new.id, sqlerrm;
  end;

  return new;
end $$;

drop trigger if exists audit_billiards_session_closed on billiards.sessions;
create trigger audit_billiards_session_closed
  after update of status on billiards.sessions
  for each row
  when (old.status = 'active' and new.status = 'closed')
  execute function public.audit_billiards_session_closed();

-- ── Game shop: a rental recorded ────────────────────────────────────────────
-- record_session inserts the row with snacks_total 0, adds the order lines,
-- then finalises with one `update sessions set snacks_total, total`. That final
-- UPDATE always runs - even for a session with no snacks, where it rewrites the
-- same values - so this fires exactly once per rental, with the totals correct.
-- Triggering on the INSERT instead would log the playtime and miss every snack.
--
-- void_reason is null excludes corrections: void_session also rewrites total,
-- and audit_game_void already records those. Without this guard every
-- correction would be logged twice, once as a correction and once as a sale.
create or replace function public.audit_game_session_recorded()
returns trigger language plpgsql security definer
set search_path = game, public as $$
begin
  begin
    perform public.audit(
      'game', 'session.recorded',
      format('Recorded %s min on %s for %s.%s',
             new.charged_minutes,
             coalesce(new.station_name, 'a station'),
             coalesce(new.total, 0),
             case when coalesce(new.snacks_total, 0) > 0
                  then format(' Includes %s of snacks.', new.snacks_total)
                  else '' end),
      'session', new.id::text, new.station_name,
      jsonb_build_object(
        'station',         new.station_name,
        'tier',            new.tier,
        'minutes',         new.minutes,
        'charged_minutes', new.charged_minutes,
        'playtime_total',  new.playtime_total,
        'snacks_total',    new.snacks_total,
        'total',           new.total,
        'label',           new.label
      ),
      new.created_by
    );
  exception when others then
    raise warning 'audit_game_session_recorded failed for session %: %', new.id, sqlerrm;
  end;

  return new;
end $$;

drop trigger if exists audit_game_session_recorded on game.sessions;
create trigger audit_game_session_recorded
  after update of total on game.sessions
  for each row
  when (new.void_reason is null and old.void_reason is null)
  execute function public.audit_game_session_recorded();

commit;

notify pgrst, 'reload schema';

-- VERIFY
--   select tgname, tgrelid::regclass from pg_trigger
--    where tgname in ('audit_billiards_session_closed','audit_game_session_recorded');
--
--   select action, count(*) from public.audit_log group by action order by 2 desc;
