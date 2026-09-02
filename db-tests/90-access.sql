\set ON_ERROR_STOP off
\pset pager off

create table if not exists _results (label text, ok boolean, detail text);
truncate _results;

create or replace function chk(p_label text, p_got anyelement, p_want anyelement)
returns void language plpgsql as $$
begin
  insert into _results values (
    p_label,
    p_got is not distinct from p_want,
    format('got %s, want %s', coalesce(p_got::text,'NULL'), coalesce(p_want::text,'NULL'))
  );
end $$;

-- ── People ──────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','owner@akoatp-staff.com'),
  ('22222222-2222-2222-2222-222222222222','bmgr@akoatp-staff.com'),
  ('33333333-3333-3333-3333-333333333333','shopstaff@akoatp-staff.com'),
  ('44444444-4444-4444-4444-444444444444','newguy@akoatp-staff.com'),
  ('55555555-5555-5555-5555-555555555555','09777000111@akoatp.com');

update public.profiles set role='superadmin', username='owner'
  where id='11111111-1111-1111-1111-111111111111';
update public.profiles set role='admin', username='bmgr'
  where id='22222222-2222-2222-2222-222222222222';
update public.profiles set role='admin', username='shopstaff'
  where id='33333333-3333-3333-3333-333333333333';
update public.profiles set role='customer', username='customer1', phone='09777000111'
  where id='55555555-5555-5555-5555-555555555555';

select public.test_act_as('11111111-1111-1111-1111-111111111111');
select public.grant_app_access('22222222-2222-2222-2222-222222222222','billiards','superadmin','bmgr');
select public.grant_app_access('33333333-3333-3333-3333-333333333333','game','admin','shopstaff');

-- ════════════════════════════════════════════════════════════════════════════
-- 1. provision_admin
-- ════════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    perform public.provision_admin('44444444-4444-4444-4444-444444444444','newguy','[]'::jsonb);
    perform chk('provision_admin refuses zero grants', 'no error'::text, 'raises'::text);
  exception when others then
    perform chk('provision_admin refuses zero grants', 'raises'::text, 'raises'::text);
  end;
end $$;

select chk('...and writes nothing when it refuses',
  (select count(*)::int from public.app_access where user_id='44444444-4444-4444-4444-444444444444'), 0);

select public.provision_admin('44444444-4444-4444-4444-444444444444','newguy',
  '[{"app":"billiards","role":"admin"},{"app":"game","role":"admin"}]'::jsonb);

select chk('provision_admin promotes the profile',
  (select role from public.profiles where id='44444444-4444-4444-4444-444444444444'), 'admin'::text);
select chk('provision_admin writes both grants',
  (select count(*)::int from public.app_access where user_id='44444444-4444-4444-4444-444444444444'), 2);
select chk('provision_admin creates the billiards staff row',
  (select is_active from billiards.admins where id='44444444-4444-4444-4444-444444444444'), true);
select chk('provision_admin creates the game staff row',
  (select active from game.staff where id='44444444-4444-4444-4444-444444444444'), true);

-- The client's own superadmins must never be demoted by this path.
select public.provision_admin('11111111-1111-1111-1111-111111111111','owner',
  '[{"app":"game","role":"admin"}]'::jsonb);
select chk('provision_admin never demotes an existing superadmin',
  (select role from public.profiles where id='11111111-1111-1111-1111-111111111111'), 'superadmin'::text);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Revokes leave a trace (the gap phase 1 existed to close)
-- ════════════════════════════════════════════════════════════════════════════
select public.revoke_app_access('44444444-4444-4444-4444-444444444444','game');

select chk('revoke removes the grant',
  (select count(*)::int from public.app_access
    where user_id='44444444-4444-4444-4444-444444444444' and app='game'), 0);
select chk('revoke deactivates the local staff row',
  (select active from game.staff where id='44444444-4444-4444-4444-444444444444'), false);
select chk('revoke is recorded',
  (select count(*)::int from public.audit_log
    where action='access.revoked' and target_id='44444444-4444-4444-4444-444444444444'), 1);
select chk('...with the rank that was removed',
  (select details->>'from' from public.audit_log
    where action='access.revoked' and target_id='44444444-4444-4444-4444-444444444444'), 'admin'::text);
select chk('...and the person who did it',
  (select actor_name from public.audit_log
    where action='access.revoked' and target_id='44444444-4444-4444-4444-444444444444'), 'owner'::text);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. The log cannot be written or edited from a signed-in session
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare v text;
begin
  begin
    execute 'select has_function_privilege(''authenticated'',
      ''public.audit(text,text,text,text,text,text,jsonb,uuid)'', ''execute'')' into v;
    perform chk('audit() is not executable by authenticated', v, 'false'::text);
  exception when others then
    perform chk('audit() is not executable by authenticated', sqlerrm, 'false'::text);
  end;
end $$;

select chk('audit() is not executable by anon',
  has_function_privilege('anon','public.audit(text,text,text,text,text,text,jsonb,uuid)','execute')::text,
  'false'::text);

