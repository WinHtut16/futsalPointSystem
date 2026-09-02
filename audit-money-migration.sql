-- ============================================================
-- audit-money-migration.sql   (Phase 2: corrections and money)
--
-- Run in the FUTSAL Supabase project, AFTER audit-log-migration.sql.
--
-- Two things happen here.
--
-- 1. A HOLE IN PHASE 1 IS CLOSED. audit-log-migration.sql said
--    `revoke all on function public.audit(...) from public` and claimed that
--    left it uncallable by clients. That is wrong on Supabase. The standard
--    project bootstrap runs
--
--      alter default privileges in schema public
--        grant all on functions to postgres, anon, authenticated, service_role;
--
--    so every NEW function in `public` is created with an explicit EXECUTE
--    grant to anon and authenticated. REVOKE ... FROM PUBLIC does not touch an
--    explicit grant to a named role, so audit() has been reachable from any
--    signed-in session since Phase 1 landed. A signed-in admin could have
--    written rows naming any app and any action. The revokes below fix it, and
--    the same trap applies to every future SECURITY DEFINER helper: revoking
--    from PUBLIC is not enough, name the roles.
--
-- 2. CORRECTIONS AND MONEY GET LOGGED - mostly by trigger.
--
--    Phase 1 said triggers do not work here, because futsal writes through the
--    service role and auth.uid() is NULL under it. That is still true as a
--    GENERAL mechanism. It is not true where the table already records who
--    acted: point_transactions.created_by, redemption_requests.resolved_by,
--    sessions.voided_by. For those, a trigger reads the actor off the row, so
--    it works under the service role AND cannot be forgotten by a future
--    caller - strictly better than the explicit call Phase 1 had to use.
--
--    Explicit calls remain only where no row survives to carry the actor.
--
-- SAFE TO RE-RUN? Yes. Triggers are dropped and recreated; functions are
-- create-or-replace.
-- ============================================================

do $$
begin
  if to_regclass('public.audit_log') is null then
    raise exception 'audit-log-migration.sql has not been applied. Nothing was created.';
  end if;
end $$;

-- ── audit(), with an actor the caller may supply ────────────────────────────
-- Dropped rather than overloaded: a 7-arg and an 8-arg version with defaults
-- would make every existing three-argument call ambiguous and fail at runtime.
drop function if exists public.audit(text, text, text, text, text, text, jsonb);

create or replace function public.audit(
  p_app          text,
  p_action       text,
  p_summary      text,
  p_target_type  text default null,
  p_target_id    text default null,
  p_target_label text default null,
  p_details      jsonb default null,
  p_actor        uuid default null
)
returns void language plpgsql security definer
set search_path = public as $$
declare
  -- auth.uid() FIRST, p_actor only as a fallback. The order is the safety
  -- property: a caller can never claim to be someone else, only fill in a
  -- blank. Triggers pass the row's own actor column, which under a signed-in
  -- session equals auth.uid() anyway and under the service role is the only
  -- truth available.
  v_actor uuid := coalesce(auth.uid(), p_actor);
  v_name  text;
begin
  v_name := coalesce(
    (select username from public.profiles where id = v_actor),
    (select split_part(email, '@', 1) from auth.users where id = v_actor),
    'system'
  );

  insert into public.audit_log
    (app, action, actor_id, actor_name, target_type, target_id, target_label, summary, details)
  values
    (p_app, p_action, v_actor, v_name, p_target_type, p_target_id, p_target_label, p_summary, p_details);
end $$;

-- No exception handler, deliberately - see audit-log-migration.sql.

-- Naming the roles is the whole point; REVOKE FROM PUBLIC does not undo
-- Supabase's default grants. service_role keeps EXECUTE: server-side code
-- holding the secret key is trusted, and it is how the one path that cannot
-- use a trigger (billiards bulk delete) records itself.
revoke all on function public.audit(text, text, text, text, text, text, jsonb, uuid) from public;
revoke all on function public.audit(text, text, text, text, text, text, jsonb, uuid) from anon;
revoke all on function public.audit(text, text, text, text, text, text, jsonb, uuid) from authenticated;
grant execute on function public.audit(text, text, text, text, text, text, jsonb, uuid) to service_role;

-- Same trap, same fix, for the Phase 1 helpers that should never have been
-- callable by an anonymous visitor.
revoke all on function public.can_manage_app(text) from anon;
revoke all on function public.grant_app_access(uuid, text, text, text) from anon;
revoke all on function public.revoke_app_access(uuid, text) from anon;
revoke all on function public.provision_admin(uuid, text, jsonb) from anon;

-- ── Futsal: point adjustments ───────────────────────────────────────────────
-- An adjustment is someone changing a customer's balance by hand. It is the
-- single most disputable thing an admin can do in futsal, and until now it
-- left only a ledger row that nobody reads.
--
-- 'earn' and 'redeem' are deliberately NOT logged: they are the system doing
-- its job thousands of times, and burying four hand corrections a month under
-- them would make the log useless. The ledger already has them.
create or replace function public.audit_points_adjustment()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_customer text;
begin
  if new.transaction_type <> 'adjustment' then
    return new;
  end if;

  select username into v_customer from public.profiles where id = new.customer_id;

  perform public.audit(
    'futsal', 'points.adjusted',
    format('Adjusted %s by %s%s points.%s',
           coalesce(v_customer, 'a customer'),
           case when new.points_delta > 0 then '+' else '' end,
           new.points_delta,
           case when coalesce(btrim(new.note), '') = '' then ''
                else ' Reason: ' || new.note end),
    'customer', new.customer_id::text, v_customer,
    jsonb_build_object('delta', new.points_delta, 'note', new.note),
    new.created_by
  );
  return new;
end $$;

drop trigger if exists audit_points_adjustment on public.point_transactions;
create trigger audit_points_adjustment
  after insert on public.point_transactions
  for each row execute function public.audit_points_adjustment();

-- ── Futsal: redemption approvals and rejections ─────────────────────────────
create or replace function public.audit_redemption_resolved()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_customer text;
  v_reward   text;
begin
  -- Only the pending -> resolved step. A no-op update, or a later edit to
  -- notes, is not a decision and should not appear as one.
  if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
    return new;
  end if;

  select username into v_customer from public.profiles where id = new.customer_id;
  select name     into v_reward   from public.rewards  where id = new.reward_id;

  perform public.audit(
    'futsal',
    case when new.status = 'approved' then 'redemption.approved' else 'redemption.rejected' end,
    format('%s %s for %s.',
           case when new.status = 'approved' then 'Approved' else 'Rejected' end,
           coalesce(v_reward, 'a reward'),
           coalesce(v_customer, 'a customer')),
    'redemption', new.id::text, v_reward,
    jsonb_build_object('customer', v_customer, 'reward', v_reward, 'notes', new.notes),
    new.resolved_by
  );
  return new;
end $$;

drop trigger if exists audit_redemption_resolved on public.redemption_requests;
create trigger audit_redemption_resolved
  after update of status on public.redemption_requests
  for each row execute function public.audit_redemption_resolved();

-- ── Billiards: corrected sessions ───────────────────────────────────────────
-- void_reason going from NULL to non-NULL is the correction, whichever of the
-- two void functions did it. Reading it off the row rather than editing both
-- function bodies means a third correction path added later is logged for free.
create or replace function public.audit_billiards_void()
returns trigger language plpgsql security definer
set search_path = billiards, public as $$
declare
  v_table text;
begin
  if old.void_reason is not null or new.void_reason is null then
    return new;
  end if;

  select name into v_table from billiards.pool_tables where id = new.table_id;

  perform public.audit(
    'billiards', 'session.voided',
    format('Corrected a session on %s. Charge %s -> %s. Reason: %s',
           coalesce(v_table, 'a table'),
           coalesce(old.total, 0), coalesce(new.total, 0), new.void_reason),
    'session', new.id::text, v_table,
    jsonb_build_object(
      'from_total', old.total, 'to_total', new.total,
      'from_time_charge', old.time_charge, 'to_time_charge', new.time_charge,
      'reason', new.void_reason
    ),
    new.voided_by
  );
  return new;
end $$;

drop trigger if exists audit_billiards_void on billiards.sessions;
create trigger audit_billiards_void
  after update of void_reason on billiards.sessions
  for each row execute function public.audit_billiards_void();

-- ── Game shop: corrected sessions ───────────────────────────────────────────
create or replace function public.audit_game_void()
returns trigger language plpgsql security definer
set search_path = game, public as $$
begin
  if old.void_reason is not null or new.void_reason is null then
    return new;
  end if;

  perform public.audit(
    'game', 'session.voided',
    format('Corrected a session on %s. Charge %s -> %s. Reason: %s',
           new.station_name, coalesce(old.total, 0), coalesce(new.total, 0), new.void_reason),
    'session', new.id::text, new.station_name,
    jsonb_build_object(
      'from_total', old.total, 'to_total', new.total,
      'from_playtime', old.playtime_total, 'to_playtime', new.playtime_total,
      'reason', new.void_reason
    ),
    new.voided_by
  );
  return new;
end $$;

drop trigger if exists audit_game_void on game.sessions;
create trigger audit_game_void
  after update of void_reason on game.sessions
  for each row execute function public.audit_game_void();

-- ── Billiards: bulk deletion of closed sessions ─────────────────────────────
-- The one correction path that cannot be a trigger: a row-level delete trigger
-- would write one audit row per session - hundreds, burying everything else -
-- and the interesting fact is the batch, not each row.
--
-- Moved into the database wholesale rather than just bolting an audit call onto
-- the server action. It was three separate statements (null the stock links,
-- delete, then log), any of which could fail on its own and leave the other two
-- applied - including a log entry for a deletion that did not happen. As one
-- SECURITY DEFINER function it is one transaction, the "at least 7 days old"
-- guard moves out of TypeScript where it could be bypassed by calling the table
-- directly, and it runs under the SIGNED-IN session so auth.uid() is real and
-- no service-role key is involved at all.
create or replace function billiards.delete_closed_sessions(
  p_to   timestamptz,
  p_from timestamptz default null
)
returns integer language plpgsql security definer
set search_path = billiards, public as $$
declare
  v_ids     uuid[];
  v_revenue numeric;
  v_count   integer;
begin
  if not coalesce(billiards.is_superadmin(), false) then
    raise exception 'Only a superadmin can delete sessions.' using errcode = '42501';
  end if;
  if p_to is null or p_to > now() - interval '7 days' then
    raise exception 'Cutoff must be at least 7 days in the past.' using errcode = '22023';
  end if;

  select array_agg(id), coalesce(sum(total), 0)
    into v_ids, v_revenue
    from billiards.sessions
   where status = 'closed'
     and paid_at < p_to
     and (p_from is null or paid_at >= p_from);

  v_count := coalesce(array_length(v_ids, 1), 0);
  if v_count = 0 then
    return 0;
  end if;

  -- stock_movements.session_id has no cascade, so the link is cleared first.
  -- The ledger row itself stays: what left the shelf is still true even after
  -- the session it belonged to is gone.
  update billiards.stock_movements set session_id = null where session_id = any(v_ids);
  delete from billiards.sessions where id = any(v_ids);

  perform public.audit(
    'billiards', 'sessions.bulk_deleted',
    format('Permanently deleted %s closed session(s)%s up to %s, worth %s MMK.',
           v_count,
           case when p_from is null then '' else ' from ' || p_from::date end,
           p_to::date, v_revenue),
    'session_range', null, null,
    jsonb_build_object('count', v_count, 'revenue', v_revenue, 'from', p_from, 'to', p_to)
  );

  return v_count;
end $$;

revoke all on function billiards.delete_closed_sessions(timestamptz, timestamptz) from public;
revoke all on function billiards.delete_closed_sessions(timestamptz, timestamptz) from anon;
grant execute on function billiards.delete_closed_sessions(timestamptz, timestamptz) to authenticated;

-- ── A note on strictness ────────────────────────────────────────────────────
-- audit() still has no exception handler, so a failure here fails the whole
-- operation. That is a bigger claim on the money path than it was for access
-- grants, so it is worth being precise about what is actually exposed:
--
--   - the void triggers fire ONLY on the NULL -> non-NULL correction step, not
--     on ordinary checkouts or order edits
--   - the points trigger returns before calling audit() for 'earn' and
--     'redeem', so the thousands-a-month path never reaches it
--   - the redemption trigger fires only on pending -> approved/rejected
--
-- Nothing on the busy operational path can be blocked by this. What CAN be
-- blocked is zeroing a session's takings without a record of it, which is the
-- correct thing to block.

-- ── Sanity checks ───────────────────────────────────────────────────────────
--   -- as a SIGNED-IN account, not in the SQL editor (which is superuser):
--   supabase.rpc('audit', { p_app:'futsal', p_action:'x', p_summary:'y' })
--   -- expected: permission denied for function audit
--
--   -- then correct a session in either zone and:
--   select action, actor_name, summary from public.audit_log
--    order by created_at desc limit 5;
