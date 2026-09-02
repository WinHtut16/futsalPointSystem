-- ============================================================
-- audit-log-migration.sql   (Phase 1: table, writer, access events)
--
-- Run in the FUTSAL Supabase project, AFTER app-access-grants-migration.sql
-- and admin-provisioning-migration.sql.
--
-- WHY THIS EXISTS
-- Three businesses, one set of admins, and no record of who did what. The
-- worst case is access: revoke_app_access() does `delete from app_access`, so
-- removing someone's access to a business left literally no trace - not who
-- did it, not when, not that it ever happened. A client asking "who took
-- Kyaw off billiards last Tuesday?" had no answer available anywhere.
--
-- WHY NOT TRIGGERS
-- Triggers cannot be forgotten, which is the right instinct. They do not work
-- here. Futsal writes through the service role in 28 of its 33 API routes, and
-- under the service role auth.uid() is NULL - so a trigger would faithfully
-- record "price changed, by nobody" for almost every futsal action. The usual
-- escape, stashing the actor in a session variable, is worse than useless with
-- this client: PostgREST runs each request in its own transaction, so a
-- transaction-local setting does not survive to the next call, and a
-- session-local one leaks between requests through the connection pooler.
--
-- So writes are explicit: public.audit() is called deliberately at each site.
-- That is forgettable, and the mitigation is that the set of actions is small,
-- named, and listed in one place rather than sprayed across three codebases.
--
-- SAFE TO RE-RUN? Yes. Table creation is IF NOT EXISTS, policies are guarded,
-- functions are create-or-replace.
-- ============================================================

do $$
begin
  if to_regprocedure('public.can_manage_app(text)') is null then
    raise exception
      'app-access-grants-migration.sql has not been applied. Nothing was created.';
  end if;
end $$;

-- ── The log ─────────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  app          text not null check (app in ('futsal','billiards','game')),
  -- Dotted action code, e.g. 'access.revoked'. This is the canonical fact and
  -- what the UI translates from, so a better Burmese wording later does not
  -- rewrite history.
  action       text not null,
  actor_id     uuid references auth.users (id) on delete set null,
  -- SNAPSHOTS, not joins. The point of an audit log is that it still reads
  -- correctly after the person or the thing is gone; a join to a deleted row
  -- renders "Unknown removed Unknown", which is worse than nothing in a
  -- dispute. Same reasoning as the redemption cost snapshot already in this
  -- project. actor_id is kept alongside for filtering, and is allowed to go
  -- NULL when an account is deleted - the NAME is the record.
  actor_name   text not null,
  target_type  text,
  target_id    text,
  target_label text,
  -- A frozen English sentence, written once. The UI renders its own wording
  -- from `action` + `details`; this stays put so that if the renderer is ever
  -- wrong you can still see what was actually recorded at the time.
  summary      text not null,
  details      jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_app_idx     on public.audit_log (app, created_at desc);
create index if not exists audit_log_actor_idx   on public.audit_log (actor_id, created_at desc);

comment on table public.audit_log is
  'Append-only record of administrative actions. Written only by public.audit(); no insert/update/delete policy exists, deliberately.';

alter table public.audit_log enable row level security;

-- Read: any superadmin, scoped to the businesses they manage. A billiards-only
-- superadmin sees billiards rows and nothing else; a global superadmin sees
-- all three, because can_manage_app() admits them for every app.
do $$
begin
  if not exists (select 1 from pg_policy where polname = 'audit_log_select') then
    create policy audit_log_select on public.audit_log
      for select to authenticated
      using (coalesce(public.can_manage_app(app), false));
  end if;
end $$;

-- NO insert, update or delete policy. That is the feature, not an oversight:
-- with RLS on and no write policy, nothing reaching this table through the API
-- can add, edit or remove a row - not an admin, not a superadmin, not the
-- owner. Rows arrive only through public.audit() below, which is SECURITY
-- DEFINER and therefore bypasses RLS. A log a superadmin can quietly edit is
-- not evidence of anything.

-- ── The writer ──────────────────────────────────────────────────────────────
create or replace function public.audit(
  p_app          text,
  p_action       text,
  p_summary      text,
  p_target_type  text default null,
  p_target_id    text default null,
  p_target_label text default null,
  p_details      jsonb default null
)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_name  text;
begin
  -- Resolve the actor's name NOW, while the account still exists.
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

-- No exception handler here, on purpose. The tempting version catches
-- everything and raises a warning, so that auditing can never be the reason a
-- real operation fails. That trade is wrong for this table: it converts every
-- future mistake into a permanently missing row that nobody notices, and a log
-- with silent holes is not evidence of anything. Every caller is a SECURITY
-- DEFINER function in this file, so a failure here means a bug in this file -
-- which should be loud on the first grant, not quiet for a year. No action
-- without a record.

revoke all on function public.audit(text, text, text, text, text, text, jsonb) from public;
-- Deliberately NOT granted to authenticated: nothing outside this file's own
-- SECURITY DEFINER callers may write a row, so a client cannot forge history.

-- ── Access events ───────────────────────────────────────────────────────────
-- Re-declared in full: create-or-replace has no way to patch a function body.
-- These are byte-identical to app-access-grants-migration.sql except for the
-- audit() call at the end of each.

create or replace function public.grant_app_access(
  p_user_id uuid,
  p_app     text,
  p_role    text,
  p_display_name text default null
)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_name text;
  v_prev text;
begin
  if p_app not in ('futsal','billiards','game') then
    raise exception 'Unknown business %.', p_app using errcode = '22023';
  end if;
  if p_role not in ('admin','superadmin') then
    raise exception 'Role must be admin or superadmin.' using errcode = '22023';
  end if;
  if not public.can_manage_app(p_app) then
    raise exception 'Not authorised to manage access for %.', p_app using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'No such user.' using errcode = '23503';
  end if;

  v_name := coalesce(
    nullif(btrim(coalesce(p_display_name, '')), ''),
    (select username from public.profiles where id = p_user_id),
    (select split_part(email, '@', 1) from auth.users where id = p_user_id),
    'Staff'
  );

  -- Read the previous rank before overwriting it, so the log can say whether
  -- this was a new grant or a promotion. After the upsert it is unknowable.
  select role into v_prev from public.app_access where user_id = p_user_id and app = p_app;

  insert into public.app_access (user_id, app, role, granted_by)
  values (p_user_id, p_app, p_role, auth.uid())
  on conflict (user_id, app) do update
    set role = excluded.role, granted_by = excluded.granted_by;

  if p_app = 'billiards' and to_regclass('billiards.admins') is not null then
    execute $b$
      insert into billiards.admins (id, full_name, role, is_active)
      values ($1, $2, $3, true)
      on conflict (id) do update set is_active = true, role = excluded.role
    $b$ using p_user_id, v_name, p_role;

  elsif p_app = 'game' and to_regclass('game.staff') is not null then
    execute $g$
      insert into game.staff (id, name, active)
      values ($1, $2, true)
      on conflict (id) do update set active = true
    $g$ using p_user_id, v_name;
  end if;

  perform public.audit(
    p_app,
    case when v_prev is null then 'access.granted' else 'access.changed' end,
    case when v_prev is null
      then format('Gave %s access to %s as %s.', v_name, p_app, p_role)
      else format('Changed %s on %s from %s to %s.', v_name, p_app, v_prev, p_role)
    end,
    'user', p_user_id::text, v_name,
    jsonb_build_object('from', v_prev, 'to', p_role)
  );
end $$;

create or replace function public.revoke_app_access(p_user_id uuid, p_app text)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_prev text;
  v_name text;
begin
  if not public.can_manage_app(p_app) then
    raise exception 'Not authorised to manage access for %.', p_app using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot remove your own access to %.', p_app using errcode = '42501';
  end if;

  -- Capture both before the delete. This is the whole reason this migration
  -- exists: once the row is gone there is nothing left to say it was ever
  -- there, who removed it, or what rank was removed.
  select role into v_prev from public.app_access where user_id = p_user_id and app = p_app;
  v_name := coalesce(
    (select username from public.profiles where id = p_user_id),
    (select split_part(email, '@', 1) from auth.users where id = p_user_id),
    'Staff'
  );

  delete from public.app_access where user_id = p_user_id and app = p_app;

  if p_app = 'billiards' and to_regclass('billiards.admins') is not null then
    execute 'update billiards.admins set is_active = false where id = $1' using p_user_id;
  elsif p_app = 'game' and to_regclass('game.staff') is not null then
    execute 'update game.staff set active = false where id = $1' using p_user_id;
  end if;

  -- Log even when there was nothing to remove. An attempt that found no grant
  -- is still someone reaching for that button, and a log that quietly drops
  -- no-ops cannot be read as a complete account of what was tried.
  perform public.audit(
    p_app, 'access.revoked',
    case when v_prev is null
      then format('Removed %s from %s (they had no access).', v_name, p_app)
      else format('Removed %s from %s (was %s).', v_name, p_app, v_prev)
    end,
    'user', p_user_id::text, v_name,
    jsonb_build_object('from', v_prev, 'to', null)
  );
end $$;

-- provision_admin: one row for the account itself. The per-business grants it
-- makes are logged by grant_app_access above, so this does not repeat them.
create or replace function public.provision_admin(
  p_user_id uuid,
  p_username text,
  p_grants jsonb
)
returns void language plpgsql security definer
set search_path = public as $$
declare
  g jsonb;
  v_existing_role text;
  v_count int;
begin
  if p_grants is null or jsonb_typeof(p_grants) <> 'array' then
    raise exception 'Access list must be a JSON array.' using errcode = '22023';
  end if;

  select count(*) into v_count from jsonb_array_elements(p_grants);
  if v_count = 0 then
    raise exception
      'Pick at least one business. An account with no access can sign in and reach nothing.'
      using errcode = '22023';
  end if;

  for g in select value from jsonb_array_elements(p_grants) loop
    if not public.can_manage_app(coalesce(g->>'app', '')) then
      raise exception 'Not authorised to manage access for %.', coalesce(g->>'app', '(missing)')
        using errcode = '42501';
    end if;
  end loop;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'No such user.' using errcode = '23503';
  end if;

  select role into v_existing_role from public.profiles where id = p_user_id;

  if v_existing_role is null then
    insert into public.profiles (id, phone, username, role, total_points)
    values (p_user_id, null, p_username, 'admin', 0);
  elsif v_existing_role = 'customer' then
    update public.profiles
       set username = p_username,
           role = 'admin'
     where id = p_user_id;
  end if;

  for g in select value from jsonb_array_elements(p_grants) loop
    perform public.grant_app_access(
      p_user_id,
      g->>'app',
      g->>'role',
      p_username
    );
  end loop;

  -- Filed under the first business granted, so it appears in that business's
  -- feed rather than nowhere. An account is always created for a reason, and
  -- the reason is the businesses listed in details.
  perform public.audit(
    (select value->>'app' from jsonb_array_elements(p_grants) limit 1),
    'admin.created',
    format('Created admin account %s.', p_username),
    'user', p_user_id::text, p_username,
    jsonb_build_object('grants', p_grants)
  );
end $$;

revoke all on function public.grant_app_access(uuid, text, text, text) from public;
revoke all on function public.revoke_app_access(uuid, text)            from public;
revoke all on function public.provision_admin(uuid, text, jsonb)       from public;
grant execute on function public.grant_app_access(uuid, text, text, text) to authenticated;
grant execute on function public.revoke_app_access(uuid, text)            to authenticated;
grant execute on function public.provision_admin(uuid, text, jsonb)       to authenticated;

-- ── Sanity checks, signed in as a superadmin ────────────────────────────────
--   select * from public.audit_log order by created_at desc limit 20;
--
-- And the one that matters. Do NOT test this in the SQL editor - it connects
-- as a superuser, which bypasses RLS entirely, so the insert will succeed there
-- and tell you nothing. Run it as a normal signed-in account instead, from the
-- browser console on any admin page:
--
--   await (await fetch('/api/net-check')) // (any page that has the client)
--   // or simply, in an app route/server action against the SIGNED-IN client:
--   supabase.from('audit_log').insert({ app:'futsal', action:'test',
--                                       actor_name:'me', summary:'tampering' })
--
-- Expected: 'new row violates row-level security policy for table audit_log'.
-- If that insert succeeds, a write policy has been added by mistake and the
-- log is no longer evidence of anything.
