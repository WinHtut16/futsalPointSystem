-- ============================================================
-- retire-per-app-superadmin-migration.sql
--
-- Run in the FUTSAL Supabase project (mmyjtvlnuizpwktpkuij), in the SQL
-- Editor, AFTER app-access-migration.sql, app-access-grants-migration.sql and
-- superadmin-directory-migration.sql.
--
-- THE RULE (client decision, 2026-11)
--   * Superadmin is GLOBAL only: profiles.role = 'superadmin'. Those people
--     (the developer and the business owners) own all three businesses.
--   * There is no "futsal superadmin" or "billiards superadmin". A per-business
--     grant in public.app_access only ever means 'admin'.
--
-- WHY
--   app_access allowed role = 'superadmin' per business, and app_role() /
--   can_manage_app() honoured it. That made a per-business superadmin able to
--   grant access, and passed billiards.is_superadmin() / game.is_superadmin()
--   (both built on app_role()). The client says such people should not exist.
--
-- WHAT IT DOES
--   1. Demotes any existing per-business 'superadmin' rows to 'admin'
--      (they keep access to that business, they lose the rank).
--      Same for the billiards local directory, for non-global superadmins.
--   2. Narrows the app_access.role CHECK to 'admin' only.
--   3. app_role(): 'superadmin' only for the global role; any grant -> 'admin'.
--   4. can_manage_app(): global superadmin only.
--   5. grant_app_access(): refuses p_role other than 'admin'.
--
-- SAFE TO RE-RUN? Yes.
--
-- BEFORE RUNNING, see who is affected (changes nothing):
--   select a.user_id, p.username, p.role as profile_role, a.app, a.role
--     from public.app_access a join public.profiles p on p.id = a.user_id
--    where a.role = 'superadmin';
-- If anyone listed should really own every business, set their
-- profiles.role = 'superadmin' instead of relying on a per-app row.
-- ============================================================

do $$
begin
  if to_regclass('public.app_access') is null
     or to_regprocedure('public.app_role(text)') is null
     or to_regprocedure('public.grant_app_access(uuid,text,text,text)') is null then
    raise exception
      'Wrong project, or app-access / app-access-grants migrations not applied. Nothing changed.';
  end if;
end $$;

begin;

-- ── 1. Demote existing per-business superadmin rows ─────────────────────────
update public.app_access
   set role = 'admin'
 where role = 'superadmin';

-- billiards keeps its own rank column. Global superadmins keep 'superadmin'
-- there (superadmin-directory-migration.sql maintains that); everyone else
-- becomes 'admin'.
do $$
begin
  if to_regclass('billiards.admins') is not null then
    execute $b$
      update billiards.admins b
         set role = 'admin'
       where b.role = 'superadmin'
         and not exists (
           select 1 from public.profiles p
            where p.id = b.id and p.role = 'superadmin'
         )
    $b$;
  end if;
end $$;

-- ── 2. Only 'admin' may be stored per business ──────────────────────────────
-- The original CHECK was declared inline, so its name is generated. Drop any
-- check constraint on app_access that mentions the role column, then add ours.
do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'public.app_access'::regclass
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.app_access drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.app_access
  add constraint app_access_role_admin_only check (role = 'admin');

comment on table public.app_access is
  'Per-business admin grants (role is always admin). profiles.role = superadmin is the only superadmin and covers every business.';

-- ── 3. app_role(): superadmin is global only ────────────────────────────────
create or replace function public.app_role(p_app text)
returns text
language sql
security definer stable
set search_path = public
as $$
  select case
    when exists (
      select 1 from profiles
       where id = auth.uid()
         and role = 'superadmin'
    ) then 'superadmin'
    when exists (
      select 1 from app_access
       where user_id = auth.uid()
         and app     = p_app
    ) then 'admin'
    else null
  end;
$$;

-- ── 4. Only a global superadmin manages access ──────────────────────────────
create or replace function public.can_manage_app(p_app text)
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce(public.is_superadmin(), false);
$$;

-- ── 5. grant_app_access(): admin rank only ──────────────────────────────────
-- Same body as app-access-grants-migration.sql except the role check.
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
  if p_role is distinct from 'admin' then
    raise exception 'Only the admin rank can be granted per business. Superadmin is a global role.'
      using errcode = '22023';
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
end $$;

revoke all on function public.grant_app_access(uuid, text, text, text) from public;
grant execute on function public.grant_app_access(uuid, text, text, text) to authenticated;
grant execute on function public.can_manage_app(text)                     to authenticated;

commit;

-- ============================================================
-- Verification (changes nothing)
-- ============================================================
--   -- no per-business superadmin rows left:
--   select count(*) from public.app_access where role <> 'admin';            -- 0
--
--   -- as a global superadmin: every app reports superadmin, manage = true
--   select * from public.my_apps();
--   select public.can_manage_app('game');                                   -- true
--
--   -- as a staff admin: only granted apps, rank admin, manage = false
--   select * from public.my_apps();
--   select public.can_manage_app('futsal');                                 -- false
--
-- ROLLBACK (only if needed): re-run app-access-migration.sql section 2 and
-- app-access-grants-migration.sql, then
--   alter table public.app_access drop constraint app_access_role_admin_only;
--   alter table public.app_access add constraint app_access_role_check
--     check (role in ('admin','superadmin'));
-- Demoted rows are not restored automatically.
