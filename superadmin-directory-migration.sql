-- ============================================================
-- superadmin-directory-migration.sql
--
-- Run in the FUTSAL Supabase project, AFTER app-access-grants-migration.sql.
--
-- WHY THIS EXISTS
-- A global superadmin holds no app_access row - that is the design, the role
-- outranks the grants. But each business keeps its OWN staff directory, and
-- billiards.sessions.opened_by and game.sessions.created_by are NOT NULL
-- foreign keys into those directories. A superadmin who never went through
-- grant_app_access therefore has no row to point at.
--
-- The result is a half-state that reads as working: they sign in, all three
-- tiles appear, every zone opens, every report loads - and then opening a
-- billiards table or recording a game session fails with a foreign key
-- violation. Verified: two of the three live superadmins are in exactly this
-- state today.
--
-- grant_app_access() already solves this for ordinary admins by writing the
-- local row alongside the grant. Superadmins skip that path entirely, so the
-- guarantee has to be attached to the role itself rather than to the act of
-- granting - otherwise every future superadmin arrives broken in the same way
-- and nobody finds out until someone tries to take money at a counter.
--
-- SAFE TO RE-RUN? Yes. Idempotent: functions are replaced, the trigger is
-- recreated, and the backfill upserts.
-- ============================================================

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Wrong project. Nothing was created.';
  end if;
end $$;

-- ── Give one superadmin their place in every business directory ─────────────
create or replace function public.ensure_superadmin_directory(p_user_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_name text;
begin
  -- The directories require a name and reject NULL, so fall back the same way
  -- grant_app_access does rather than letting an insert fail on a not-null.
  v_name := coalesce(
    (select nullif(btrim(username), '') from public.profiles where id = p_user_id),
    (select split_part(email, '@', 1) from auth.users where id = p_user_id),
    'Superadmin'
  );

  -- on conflict ... do update is deliberate: it also REACTIVATES a superadmin
  -- whose local row was deactivated by a revoke. A global superadmin is meant
  -- to be able to work in every business, so a stale is_active = false there
  -- would otherwise leave them locked out of the till while still looking
  -- fully powered on every screen.
  if to_regclass('billiards.admins') is not null then
    execute $b$
      insert into billiards.admins (id, full_name, role, is_active)
      values ($1, $2, 'superadmin', true)
      on conflict (id) do update set is_active = true, role = 'superadmin'
    $b$ using p_user_id, v_name;
  end if;

  if to_regclass('game.staff') is not null then
    execute $g$
      insert into game.staff (id, name, active)
      values ($1, $2, true)
      on conflict (id) do update set active = true
    $g$ using p_user_id, v_name;
  end if;
end $$;

-- ── Attach it to the role, so it can never be forgotten ─────────────────────
create or replace function public.sync_superadmin_directory()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.role = 'superadmin' then
    perform public.ensure_superadmin_directory(new.id);
  end if;

  -- Demotion deliberately does NOT deactivate the local rows. Someone dropped
  -- from superadmin to admin usually keeps working in one of the businesses
  -- via app_access, and tearing their directory row out from under them would
  -- lock them out of the one place they still belong. Removing a person is
  -- what revoke_app_access is for, and it is explicit.
  return new;
end $$;

drop trigger if exists sync_superadmin_directory on public.profiles;
create trigger sync_superadmin_directory
  after insert or update of role on public.profiles
  for each row execute function public.sync_superadmin_directory();

-- ── Backfill everyone who is already a superadmin ───────────────────────────
do $$
declare r record;
begin
  for r in select id from public.profiles where role = 'superadmin' loop
    perform public.ensure_superadmin_directory(r.id);
  end loop;
end $$;

revoke all on function public.ensure_superadmin_directory(uuid) from public, anon, authenticated;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Every row must show 1 and 1:
--   select p.username, p.role,
--          (select count(*) from billiards.admins b where b.id = p.id and b.is_active) as billiards_row,
--          (select count(*) from game.staff g where g.id = p.id and g.active)          as game_row
--     from public.profiles p where p.role = 'superadmin' order by p.username;
