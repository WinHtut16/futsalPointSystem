-- Enough of Supabase for the migrations to run and for the tests to mean
-- something. Not a simulation of Supabase - only the parts these migrations
-- actually touch.
create extension if not exists pgcrypto;

-- The three roles PostgREST connects as.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- THE IMPORTANT BIT. Supabase's bootstrap grants EXECUTE on every new public
-- function to anon and authenticated. Reproducing that is what makes the
-- "audit() must not be callable by a signed-in session" test real: without it
-- the test would pass on a database that was never permissive to begin with,
-- and would have passed just as happily before the phase 2 fix.
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on auth.users to anon, authenticated, service_role;

-- auth.uid() reads a session setting, so a test can say "now act as this
-- person" the way a real JWT would.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
$$;
grant execute on function auth.role() to anon, authenticated, service_role;

-- Test helper: become this user, as `authenticated`.
create or replace function public.test_act_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end $$;

-- Supabase ships this publication; billiards' schema migration adds tables to it.
do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
