-- ============================================================
-- admin-provisioning-migration.sql
--
-- provision_admin(): turns a freshly created auth user into a working admin
-- account in ONE transaction - the futsal profile row plus every business
-- grant the superadmin picked on the form.
--
-- Run in the FUTSAL Supabase project, AFTER app-access-migration.sql and
-- app-access-grants-migration.sql.
--
-- WHY THIS EXISTS
-- Three creation paths had grown apart, and two of them made accounts that
-- could not sign in anywhere:
--
--   futsal /admin/staff/new -> auth user + profiles, NO app_access
--   billiards /admins       -> auth user + billiards.admins, NO profiles
--   game settings           -> linked out to futsal
--
-- The middleware gates every admin route on profiles.role, so the billiards
-- path produced an account that was bounced off every screen; the futsal path
-- produced one that reached the portal and found it empty. Neither errored -
-- each half was written by code that was correct before the three systems
-- shared one auth.users, and nothing shouted when merging them invalidated it.
--
-- So: one function, one transaction, and a rule that makes the empty account
-- unrepresentable - at least one business must be granted, or nothing is
-- written at all.
--
-- SAFE TO RE-RUN? Yes. Only creates or replaces a function.
-- ============================================================

do $$
begin
  if to_regprocedure('public.grant_app_access(uuid,text,text,text)') is null
     or to_regprocedure('public.can_manage_app(text)') is null then
    raise exception
      'app-access-grants-migration.sql has not been applied. Nothing was created.';
  end if;
end $$;

-- p_grants is a JSON array: [{"app":"billiards","role":"admin"}, ...]
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

  -- Authorise EVERY requested business before writing anything. grant_app_access
  -- checks this too, but doing it up front means a caller who may grant billiards
  -- and not futsal gets one clean refusal rather than a partial-looking failure.
  --
  -- coalesce(app,'') keeps a malformed entry out of can_manage_app rather than
  -- passing NULL, which would make the check NULL and `if not NULL` never fire -
  -- the exact NULL-boolean hole that has already cost this project a security bug.
  for g in select value from jsonb_array_elements(p_grants) loop
    if not public.can_manage_app(coalesce(g->>'app', '')) then
      raise exception 'Not authorised to manage access for %.', coalesce(g->>'app', '(missing)')
        using errcode = '42501';
    end if;
  end loop;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'No such user.' using errcode = '23503';
  end if;

  -- The futsal profile: the row every admin route's middleware checks.
  --
  -- A row usually EXISTS already - the handle_new_user trigger writes one with
  -- role 'customer' the moment the auth user is created - so this is a promote,
  -- not an insert. Hence the guard: only a 'customer' row is touched. An account
  -- that is already 'admin' or 'superadmin' keeps its role and its username, so
  -- calling this against an existing staff member (or, heaven forbid, against a
  -- client superadmin) can add grants but can never demote or rename them.
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

  -- Per-business access. grant_app_access writes both the grant and that
  -- business's own staff row, so there is no half-granted state to clean up.
  for g in select value from jsonb_array_elements(p_grants) loop
    perform public.grant_app_access(
      p_user_id,
      g->>'app',
      g->>'role',
      p_username
    );
  end loop;
end $$;

revoke all on function public.provision_admin(uuid, text, jsonb) from public;
grant execute on function public.provision_admin(uuid, text, jsonb) to authenticated;

-- ── Audit: accounts that can sign in but reach nothing ──────────────────────
-- Should return zero rows. Anything listed is a half-made account: no profile
-- row (bounced off every admin screen) or no grants (portal with no tiles).
--   select u.id, u.email, p.role as profile_role,
--          (select count(*) from public.app_access a where a.user_id = u.id) as grants
--     from auth.users u
--     left join public.profiles p on p.id = u.id
--    where u.email like '%@akoatp-staff.com'
--      and coalesce(p.role, '') <> 'superadmin'   -- global superadmins hold no per-app rows
--      and (p.role is null or p.role = 'customer'
--           or not exists (select 1 from public.app_access a where a.user_id = u.id))
--    order by u.email;
