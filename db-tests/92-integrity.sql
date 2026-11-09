\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- 7. The log is append-only, and scoped per business
-- ════════════════════════════════════════════════════════════════════════════

-- A signed-in session must not be able to add to its own history.
do $$
declare refused boolean := false;
begin
  perform public.test_act_as('11111111-1111-1111-1111-111111111111');
  perform set_config('role','authenticated',true);
  begin
    insert into public.audit_log (app, action, actor_name, summary)
      values ('futsal','forged.entry','owner','I did nothing wrong');
  exception when others then
    refused := true;
  end;
  perform set_config('role','postgres',true);
  perform chk('audit_log refuses a direct insert from a signed-in session', refused::text, 'true'::text);
end $$;

-- ...nor edit or delete what is already there.
do $$
declare edited int; deleted int;
begin
  perform public.test_act_as('11111111-1111-1111-1111-111111111111');
  perform set_config('role','authenticated',true);
  update public.audit_log set summary = 'nothing happened';
  get diagnostics edited = row_count;
  delete from public.audit_log;
  get diagnostics deleted = row_count;
  perform set_config('role','postgres',true);
  -- With RLS on and no policy, these are not errors: they simply match no
  -- rows. That is the shape to assert - a silent zero, not an exception.
  perform chk('a superadmin cannot edit history', edited, 0);
  perform chk('a superadmin cannot delete history', deleted, 0);
end $$;

-- No per-business owners any more (client rule): bmgr is the hall's ADMIN.
-- The audit log is owners-only, so a billiards admin sees none of it - not
-- even billiards rows - while the global owner sees every business.
do $$
declare seen_bmgr int; seen_owner_apps int;
begin
  perform public.test_act_as('22222222-2222-2222-2222-222222222222');
  perform set_config('role','authenticated',true);
  select count(*) into seen_bmgr from public.audit_log;
  perform public.test_act_as('11111111-1111-1111-1111-111111111111');
  select count(distinct app) into seen_owner_apps from public.audit_log;
  perform set_config('role','postgres',true);
  perform chk('a billiards admin (per-business grant) sees no audit rows', seen_bmgr, 0);
  perform chk('control: the global owner sees more than one business', (seen_owner_apps > 1)::text, 'true'::text);
end $$;

-- And a plain admin sees nothing at all.
do $$
declare seen int;
begin
  perform public.test_act_as('33333333-3333-3333-3333-333333333333');
  perform set_config('role','authenticated',true);
  select count(*) into seen from public.audit_log;
  perform set_config('role','postgres',true);
  perform chk('a plain admin sees no audit rows', seen, 0);
end $$;

-- Control: the owner sees everything, or the three results above prove only
-- that the table is unreadable by everyone.
do $$
declare seen int;
begin
  perform public.test_act_as('11111111-1111-1111-1111-111111111111');
  perform set_config('role','authenticated',true);
  select count(*) into seen from public.audit_log;
  perform set_config('role','postgres',true);
  perform chk('control: the global superadmin sees every business', (seen > 3)::text, 'true'::text);
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. The NULL-boolean hazard that has bitten this project before
-- ════════════════════════════════════════════════════════════════════════════
-- app_role() returns NULL for someone with no grant. Any guard that forgets to
-- coalesce evaluates to NULL, `if not NULL` never fires, and the check silently
-- admits everyone.
select chk('can_manage_app is never NULL, even for a stranger',
  (public.can_manage_app('billiards') is not null)::text, 'true'::text);

do $$
declare v boolean;
begin
  perform public.test_act_as('55555555-5555-5555-5555-555555555555'); -- a customer
  perform set_config('role','authenticated',true);
  select public.can_manage_app('game') into v;
  perform set_config('role','postgres',true);
  perform chk('a customer cannot manage anything', v::text, 'false'::text);
end $$;

do $$
declare refused boolean := false;
begin
  perform public.test_act_as('55555555-5555-5555-5555-555555555555');
  perform set_config('role','authenticated',true);
  begin
    perform public.grant_app_access('55555555-5555-5555-5555-555555555555','game','superadmin');
    refused := false;
  exception when others then refused := true;
  end;
  perform set_config('role','postgres',true);
  perform chk('a customer cannot grant themselves access', refused::text, 'true'::text);
end $$;
