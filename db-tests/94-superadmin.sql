\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- Superadmin means full power in every business - including the till
-- ════════════════════════════════════════════════════════════════════════════
--
-- A global superadmin holds no app_access row by design, so they never pass
-- through grant_app_access, so nothing ever writes them into each business's
-- own staff directory. Every screen still works, because the zone guards check
-- app_role() and only check the local table negatively. The gap only appears at
-- the moment someone takes money: sessions.opened_by / created_by are NOT NULL
-- foreign keys into those directories.
--
-- Two of the three live superadmins were in exactly that state when this was
-- written. These assertions exist so that can never quietly return.

insert into auth.users (id, email) values
  ('5aaa0000-0000-0000-0000-000000000001','boss@akoatp-staff.com'),
  ('5aaa0000-0000-0000-0000-000000000002','plain@akoatp-staff.com');
update public.profiles set role='superadmin', username='boss'  where id='5aaa0000-0000-0000-0000-000000000001';
update public.profiles set role='admin',      username='plain' where id='5aaa0000-0000-0000-0000-000000000002';

select chk('a new superadmin lands in the billiards directory automatically',
  (select count(*)::int from billiards.admins where id='5aaa0000-0000-0000-0000-000000000001' and is_active), 1);
select chk('...and in the game shop directory',
  (select count(*)::int from game.staff where id='5aaa0000-0000-0000-0000-000000000001' and active), 1);

-- The negative control. Without this, a trigger that handed rows to EVERYONE
-- would pass every assertion above while destroying the per-business isolation
-- the client actually asked for.
select chk('control: a plain admin gets NO free billiards row',
  (select count(*)::int from billiards.admins where id='5aaa0000-0000-0000-0000-000000000002'), 0);
select chk('control: a plain admin gets NO free game row',
  (select count(*)::int from game.staff where id='5aaa0000-0000-0000-0000-000000000002'), 0);

-- The part that was actually broken: writing, not reading.
insert into billiards.pool_tables (id, name) values ('5bbb0000-0000-0000-0000-000000000001','Test table');
insert into game.stations (id, name, tier)  values ('5bbb0000-0000-0000-0000-000000000002','Test station','PS5');
select public.test_act_as('5aaa0000-0000-0000-0000-000000000001');

do $$
declare ok boolean := true;
begin
  begin
    insert into billiards.sessions (table_id, opened_by, started_at, status)
    values ('5bbb0000-0000-0000-0000-000000000001','5aaa0000-0000-0000-0000-000000000001', now(), 'active');
  exception when others then ok := false;
  end;
  perform chk('a superadmin can actually open a billiards table', ok::text, 'true'::text);
end $$;

do $$
declare ok boolean := true;
begin
  begin
    perform game.record_session('5bbb0000-0000-0000-0000-000000000002', 60, '[]'::jsonb, null);
  exception when others then ok := false;
  end;
  perform chk('a superadmin can actually record a game shop session', ok::text, 'true'::text);
end $$;

-- Reactivation: a superadmin whose local row was deactivated by a revoke must
-- not stay locked out of the till while every screen tells them they are the
-- owner.
update billiards.admins set is_active = false where id='5aaa0000-0000-0000-0000-000000000001';
select public.ensure_superadmin_directory('5aaa0000-0000-0000-0000-000000000001');
select chk('a deactivated superadmin row is restored, not left stale',
  (select is_active from billiards.admins where id='5aaa0000-0000-0000-0000-000000000001'), true);

-- Demotion must not strip the directory row: someone dropped to admin usually
-- still works in one business via app_access, and pulling the row would lock
-- them out of the one place they still belong.
update public.profiles set role='admin' where id='5aaa0000-0000-0000-0000-000000000001';
select chk('demoting a superadmin does not tear out their directory row',
  (select count(*)::int from billiards.admins where id='5aaa0000-0000-0000-0000-000000000001'), 1);
