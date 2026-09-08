-- ============================================================
-- admin-removal-migration.sql
--
-- Run in the FUTSAL Supabase project, AFTER audit-log-migration.sql.
--
-- WHY THIS EXISTS
-- "Delete admin" returned "An unexpected error occurred" for any admin who had
-- ever done a shift's work. The delete was correctly refused - history is worth
-- more than a tidy list - but the refusal was unreadable, so the only supported
-- way to remove someone looked like a broken button.
--
-- The route tried to recognise the refusal by pattern-matching the error text
-- for 'foreign key|violates|constraint'. Supabase does not return any of those
-- words: GoTrue wraps every failure as the opaque string
--
--     "Database error deleting user"
--
-- which matched nothing and fell through to the generic handler. Guessing at a
-- vendor's error wording was the mistake; asking the database directly is the
-- fix, and it can also say WHICH history is in the way.
--
-- SAFE TO RE-RUN? Yes. Functions only.
-- ============================================================

do $$
begin
  if to_regprocedure('public.revoke_app_access(uuid,text)') is null then
    raise exception 'app-access-grants-migration.sql has not been applied. Nothing was created.';
  end if;
end $$;

-- ── What, if anything, stops this account being deleted outright ────────────
-- Every column below is a foreign key with no cascade, so a single row in any
-- of them aborts the whole delete. Each block is guarded with to_regclass so
-- the function still answers if a business's schema is not installed.
create or replace function public.admin_blocking_history(p_user_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  v jsonb := '{}'::jsonb;
  n bigint;
begin
  if not coalesce(public.is_superadmin(), false) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  select count(*) into n from public.point_transactions where created_by = p_user_id;
  if n > 0 then v := v || jsonb_build_object('futsal_point_entries', n); end if;

  if to_regclass('public.bookings') is not null then
    execute 'select count(*) from public.bookings where created_by = $1' into n using p_user_id;
    if n > 0 then v := v || jsonb_build_object('futsal_bookings', n); end if;
  end if;

  if to_regclass('public.court_closures') is not null then
    execute 'select count(*) from public.court_closures where created_by = $1' into n using p_user_id;
    if n > 0 then v := v || jsonb_build_object('futsal_closures', n); end if;
  end if;

  select count(*) into n from public.redemption_requests where resolved_by = p_user_id;
  if n > 0 then v := v || jsonb_build_object('futsal_redemptions', n); end if;

  if to_regclass('billiards.sessions') is not null then
    execute $b$select count(*) from billiards.sessions
              where opened_by = $1 or closed_by = $1 or voided_by = $1$b$ into n using p_user_id;
    if n > 0 then v := v || jsonb_build_object('billiards_sessions', n); end if;

    execute 'select count(*) from billiards.stock_movements where created_by = $1' into n using p_user_id;
    if n > 0 then v := v || jsonb_build_object('billiards_stock_entries', n); end if;

    execute 'select count(*) from billiards.admins where created_by = $1' into n using p_user_id;
    if n > 0 then v := v || jsonb_build_object('billiards_accounts_created', n); end if;
  end if;

  if to_regclass('game.sessions') is not null then
    execute 'select count(*) from game.sessions where created_by = $1 or voided_by = $1' into n using p_user_id;
    if n > 0 then v := v || jsonb_build_object('game_sessions', n); end if;

    execute 'select count(*) from game.staff where created_by = $1' into n using p_user_id;
    if n > 0 then v := v || jsonb_build_object('game_accounts_created', n); end if;
  end if;

  return v;   -- '{}' means nothing is in the way; a hard delete will succeed
end $$;

-- ── Removing someone without destroying what they recorded ──────────────────
-- The supported removal. Loops the businesses this person actually holds and
-- calls revoke_app_access for each, so every guard and every audit row that
-- normally applies still applies - this adds no new authority of its own, it
-- just saves the caller three round trips and makes the whole removal one
-- transaction instead of three that can half-fail.
create or replace function public.remove_admin_access(p_user_id uuid)
returns int language plpgsql security definer
set search_path = public as $$
declare
  a text;
  v_count int := 0;
begin
  if p_user_id = auth.uid() then
    raise exception 'You cannot remove your own access.' using errcode = '42501';
  end if;

  for a in select app from public.app_access where user_id = p_user_id loop
    perform public.revoke_app_access(p_user_id, a);
    v_count := v_count + 1;
  end loop;

  -- profiles.role is deliberately NOT changed, and the alternatives are worth
  -- recording because each looks tidier and is worse:
  --
  --   role = 'customer' drops a former staff member into the customer list,
  --     the dashboard customer counts and the booking customer picker. Those
  --     are figures the client reads; corrupting them to tidy a list is a bad
  --     trade.
  --   a new role = 'removed' needs the check constraint widened AND
  --     provision_admin taught about it, or re-hiring someone silently fails:
  --     they get their grants back and the middleware still turns them away.
  --   banning the auth user has the same re-hire trap, from further away.
  --
  -- So removal is exactly what it says: every business grant revoked. They can
  -- still sign in and will find a portal with nothing in it, which is the
  -- designed behaviour of a revoke, is fully reversible by granting again, and
  -- leaves their recorded work attached to their name. The cost is that they
  -- stay listed on the staff screen with no access, and the screen says so.

  return v_count;
end $$;

revoke all on function public.admin_blocking_history(uuid) from public, anon;
revoke all on function public.remove_admin_access(uuid)    from public, anon;
grant execute on function public.admin_blocking_history(uuid) to authenticated;
grant execute on function public.remove_admin_access(uuid)    to authenticated;

-- ── Sanity checks, signed in as a superadmin ────────────────────────────────
--   select public.admin_blocking_history('<uuid>');
--     '{}'                              -> safe to delete outright
--     '{"billiards_sessions": 12, ...}' -> remove access instead
