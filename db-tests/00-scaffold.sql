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

-- Test helper: act as p_actor under p_role (authenticated/anon), run one
-- expression through EXECUTE, and hand back what happened — the exact error
-- message on failure, or the literal 'NO ERROR' on success. Matters that this
-- returns the MESSAGE, not just whether it raised: a wrong actor calling an
-- RPC with a made-up id can raise for the WRONG reason (row not found)
-- even when the authorization guard is missing entirely. A test that only
-- checked "did it raise" would pass either way and prove nothing.
create or replace function public.test_call(p_actor uuid, p_role text, p_call text)
returns text language plpgsql as $$
declare
  v_result text;
begin
  perform public.test_act_as(p_actor);
  perform set_config('role', p_role, true);
  begin
    execute 'select ' || p_call;  -- no INTO: discards the result, works for void/record/scalar alike
    v_result := 'NO ERROR';
  exception when others then
    v_result := sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  return v_result;
end $$;

-- Same actor-switch, but for reading back an actual VALUE (a boolean check
-- like is_superadmin(), a row count) rather than testing whether a call was
-- denied. Kept separate from test_call on purpose: test_call discards its
-- result (works for void/record returns alike, and "NO ERROR" IS the
-- signal), which would silently swallow the very value this one exists to
-- return.
create or replace function public.test_value(p_actor uuid, p_role text, p_expr text)
returns text language plpgsql as $$
declare
  v_result text;
begin
  perform public.test_act_as(p_actor);
  perform set_config('role', p_role, true);
  begin
    execute 'select (' || p_expr || ')::text' into v_result;
  exception when others then
    v_result := 'ERROR: ' || sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  return v_result;
end $$;

-- Supabase ships this publication; billiards' schema migration adds tables to it.
do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
