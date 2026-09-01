-- ============================================================
-- app-access-grants-migration.sql
--
-- Adds grant_app_access() / revoke_app_access() so per-business access can be
-- managed from the admin panel instead of by hand in the SQL editor.
--
-- Run in the FUTSAL Supabase project (mmyjtvlnuizpwktpkuij), AFTER
-- app-access-migration.sql, billiards-schema-migration.sql and
-- game-schema-migration.sql.
--
-- WHY THIS EXISTS
-- Granting someone a business today means two inserts in two schemas:
--   insert into public.app_access ...        -- the gate
--   insert into game.staff / billiards.admins ...  -- the local directory
-- Both must happen. A grant without the local row lets the person in and then
-- fails when they try to record anything, because sessions.created_by is a
-- NOT NULL foreign key to that directory. Done by hand, that half-state is
-- one forgotten paste away, and it has already caught us out.
--
-- These functions do both in one transaction, so a grant is all-or-nothing.
--
-- SAFE TO RE-RUN? Yes. Only creates or replaces functions.
-- ============================================================

do $$
begin
  if to_regclass('public.app_access') is null
     or to_regprocedure('public.app_role(text)') is null then
    raise exception
      'Wrong project, or app-access-migration.sql has not been applied. Nothing was created.';
  end if;
end $$;

-- ── Who may hand out access ─────────────────────────────────────────────────
-- A global superadmin (profiles.role) may grant anything. Someone who is
-- superadmin *for one business* may grant that business - the hall manager can
-- staff the hall without gaining the power to touch futsal.
--
-- The coalesce is load-bearing, exactly as it is everywhere else in this
-- system: public.app_role() returns NULL for someone with no grant, `NULL =
-- 'superadmin'` is NULL, `not NULL` is NULL, and an `if not ... then raise`
-- guard never fires. That precise hole let an account with no billiards grant
-- zero a closed session's takings. Any new guard here must be NOT NULL too.
create or replace function public.can_manage_app(p_app text)
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce(public.is_superadmin(), false)
      or coalesce(public.app_role(p_app) = 'superadmin', false);
$$;

-- ── Grant ───────────────────────────────────────────────────────────────────
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

  -- A name is needed for the local directories, which require one. Prefer what
  -- the caller passed, fall back to the futsal profile, then the email local
  -- part - never NULL, or the insert below fails on a not-null column.
  v_name := coalesce(
    nullif(btrim(coalesce(p_display_name, '')), ''),
    (select username from public.profiles where id = p_user_id),
    (select split_part(email, '@', 1) from auth.users where id = p_user_id),
    'Staff'
  );

  insert into public.app_access (user_id, app, role, granted_by)
  values (p_user_id, p_app, p_role, auth.uid())
  on conflict (user_id, app) do update
    set role = excluded.role, granted_by = excluded.granted_by;

  -- The local staff row. Re-granting someone previously removed reactivates
  -- them rather than creating a second row, so their history stays attached.
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

  -- futsal needs no local row: public.profiles already is its directory.
end $$;

-- ── Revoke ──────────────────────────────────────────────────────────────────
create or replace function public.revoke_app_access(p_user_id uuid, p_app text)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not public.can_manage_app(p_app) then
    raise exception 'Not authorised to manage access for %.', p_app using errcode = '42501';
  end if;

  -- Removing your own access is almost always a slip, and on the last
  -- superadmin for a business it is a lockout that needs the SQL editor to
  -- undo. Refuse it; someone else can do it deliberately.
  if p_user_id = auth.uid() then
    raise exception 'You cannot remove your own access to %.', p_app using errcode = '42501';
  end if;

  delete from public.app_access where user_id = p_user_id and app = p_app;

  -- DEACTIVATE, never delete. billiards.sessions.opened_by and
  -- game.sessions.created_by are NOT NULL foreign keys to these rows, so
  -- deleting a staff member would either be refused by the database or take
  -- their recorded takings with them. A soft delete also means the local
  -- check keeps them out even if a grant is ever restored by mistake.
  if p_app = 'billiards' and to_regclass('billiards.admins') is not null then
    execute 'update billiards.admins set is_active = false where id = $1' using p_user_id;
  elsif p_app = 'game' and to_regclass('game.staff') is not null then
    execute 'update game.staff set active = false where id = $1' using p_user_id;
  end if;
end $$;

-- ── Read: everyone's grants, for the staff screen ───────────────────────────
-- RLS on app_access already lets a superadmin select every row, but the screen
-- also wants people who have NO grants yet, so it starts from profiles.
create or replace function public.access_matrix()
returns table (user_id uuid, username text, profile_role text, app text, role text)
language sql stable security definer
set search_path = public as $$
  select p.id, p.username, p.role, a.app, a.role
    from public.profiles p
    left join public.app_access a on a.user_id = p.id
   where coalesce(public.is_superadmin(), false)
   order by p.username, a.app;
$$;

revoke all on function public.grant_app_access(uuid, text, text, text) from public;
revoke all on function public.revoke_app_access(uuid, text)            from public;
grant execute on function public.grant_app_access(uuid, text, text, text) to authenticated;
grant execute on function public.revoke_app_access(uuid, text)            to authenticated;
grant execute on function public.can_manage_app(text)                     to authenticated;
grant execute on function public.access_matrix()                          to authenticated;

-- ── Sanity checks, signed in as a superadmin ────────────────────────────────
--   select public.can_manage_app('game');   -- must be boolean, never null
--   select * from public.access_matrix();
