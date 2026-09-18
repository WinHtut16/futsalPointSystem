\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- Phase 2 of the pre-launch audit, as permanent regression tests: the
-- cross-tenant privilege matrix. One database, one login, three businesses —
-- this is the test a single-system review would never think to write, and
-- the one that would have caught the incident 92-integrity.sql's section 8
-- already documents (an account with no billiards grant zeroed a closed
-- session's takings, because `NULL = 'superadmin'` is NULL and `if not NULL`
-- never fires).
--
-- Every assertion below checks the ERROR MESSAGE, not just "did it raise".
-- A wrong actor calling an RPC with a made-up id can raise for the WRONG
-- reason — "session not found" — even when the authorization guard has been
-- deleted entirely. Only the exact denial message proves the guard fired.
--
-- Reuses the actors 00-scaffold.sql / 90-access.sql already built:
--   OWNER      11111111-...  global superadmin
--   BMGR       22222222-...  billiards app_access role=superadmin
--   SHOPSTAFF  33333333-...  game app_access role=admin (non-superadmin)
--   NEWGUY     44444444-...  billiards app_access role=admin (non-superadmin);
--              game access was REVOKED earlier in 90-access.sql — reused here
--              as proof a revoked grant is actually enforced, not just absent
--   CUSTOMER1  55555555-...  plain customer, zero app_access rows — this is "C"
--
-- Adds one actor this file needs:
--   STRANGER   66666666-...  app_access for 'futsal' only — this is "X", the
--              exact account shape from the real incident: a grant that
--              EXISTS, just not for the app under attack. Proves the
--              coalesce() in has_app_access()/app_role(), not merely "denied
--              when there are zero rows at all" (CUSTOMER1 already covers
--              that simpler case).
--
-- Scope: billiards.* and game.* only — the schemas run.sh's migration chain
-- actually loads. The public-schema money-RPC anon-exposure fix
-- (URGENT-fix-anon-rpc-exposure.sql) was verified directly against live
-- production instead (check-for-existing-abuse.sql); wiring its migration
-- chain (booking-system-migration.sql, points-adjust-atomic-fix.sql, etc.)
-- into run.sh is a separate, larger change, not bundled into this file.
-- ════════════════════════════════════════════════════════════════════════════

insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666','stranger@akoatp-staff.com');
update public.profiles set role='customer', username='stranger'
  where id='66666666-6666-6666-6666-666666666666';
-- Act as the owner first. Without this the actor is whoever 92-integrity.sql
-- left behind, can_manage_app('futsal') is false, the grant raises, and this
-- file's central fixture silently does not exist - which quietly weakens every
-- "X denied ..." assertion below from "a grant for the wrong app" to "no grant
-- at all", the weaker case CUSTOMER1 already covers.
select public.test_act_as('11111111-1111-1111-1111-111111111111');
select public.grant_app_access('66666666-6666-6666-6666-666666666666','futsal','admin','stranger');

select chk('setup: STRANGER (X) has a futsal grant, nothing else',
  (select array_agg(app order by app) from public.app_access
    where user_id='66666666-6666-6666-6666-666666666666'), array['futsal']::text[]);

-- ════════════════════════════════════════════════════════════════════════════
-- 2.1 / 2.5 / 2.6 — a customer, an unrelated-grant stranger, and a
-- wrong-business admin, against every billiards write RPC
-- ════════════════════════════════════════════════════════════════════════════
select chk('C denied checkout_session',
  public.test_call('55555555-5555-5555-5555-555555555555','authenticated',
    'billiards.checkout_session(gen_random_uuid(),''cash'')'), 'not authorized');
select chk('X (unrelated grant) denied checkout_session',
  public.test_call('66666666-6666-6666-6666-666666666666','authenticated',
    'billiards.checkout_session(gen_random_uuid(),''cash'')'), 'not authorized');
select chk('SHOPSTAFF (game admin) denied checkout_session',
  public.test_call('33333333-3333-3333-3333-333333333333','authenticated',
    'billiards.checkout_session(gen_random_uuid(),''cash'')'), 'not authorized');

select chk('C denied add_order_item',
  public.test_call('55555555-5555-5555-5555-555555555555','authenticated',
    'billiards.add_order_item(gen_random_uuid(),gen_random_uuid())'), 'not authorized');
select chk('X denied add_order_item',
  public.test_call('66666666-6666-6666-6666-666666666666','authenticated',
    'billiards.add_order_item(gen_random_uuid(),gen_random_uuid())'), 'not authorized');
select chk('SHOPSTAFF denied add_order_item',
  public.test_call('33333333-3333-3333-3333-333333333333','authenticated',
    'billiards.add_order_item(gen_random_uuid(),gen_random_uuid())'), 'not authorized');

select chk('C denied remove_order_item',
  public.test_call('55555555-5555-5555-5555-555555555555','authenticated',
    'billiards.remove_order_item(gen_random_uuid(),gen_random_uuid())'), 'not authorized');
select chk('X denied remove_order_item',
  public.test_call('66666666-6666-6666-6666-666666666666','authenticated',
    'billiards.remove_order_item(gen_random_uuid(),gen_random_uuid())'), 'not authorized');

select chk('C denied adjust_stock',
  public.test_call('55555555-5555-5555-5555-555555555555','authenticated',
    'billiards.adjust_stock(gen_random_uuid(),1)'), 'not authorized');
select chk('X denied adjust_stock',
  public.test_call('66666666-6666-6666-6666-666666666666','authenticated',
    'billiards.adjust_stock(gen_random_uuid(),1)'), 'not authorized');
select chk('SHOPSTAFF denied adjust_stock',
  public.test_call('33333333-3333-3333-3333-333333333333','authenticated',
    'billiards.adjust_stock(gen_random_uuid(),1)'), 'not authorized');

select chk('C denied void_active_session',
  public.test_call('55555555-5555-5555-5555-555555555555','authenticated',
    'billiards.void_active_session(gen_random_uuid(),''cash'',''test'')'), 'not authorized');
select chk('X denied void_active_session',
  public.test_call('66666666-6666-6666-6666-666666666666','authenticated',
    'billiards.void_active_session(gen_random_uuid(),''cash'',''test'')'), 'not authorized');

-- ════════════════════════════════════════════════════════════════════════════
-- 2.3 / 2.8 — superadmin-only billiards RPCs: denied for a customer, a
-- stranger, AND a non-superadmin billiards admin
-- ════════════════════════════════════════════════════════════════════════════
select chk('C denied delete_closed_sessions',
  public.test_call('55555555-5555-5555-5555-555555555555','authenticated',
    'billiards.delete_closed_sessions(now() - interval ''30 days'')'),
  'Only a superadmin can delete sessions.');
select chk('X denied delete_closed_sessions',
  public.test_call('66666666-6666-6666-6666-666666666666','authenticated',
    'billiards.delete_closed_sessions(now() - interval ''30 days'')'),
  'Only a superadmin can delete sessions.');
select chk('NEWGUY (billiards admin, not superadmin) denied delete_closed_sessions',
  public.test_call('44444444-4444-4444-4444-444444444444','authenticated',
    'billiards.delete_closed_sessions(now() - interval ''30 days'')'),
  'Only a superadmin can delete sessions.');

select chk('C denied void_closed_session_time',
  public.test_call('55555555-5555-5555-5555-555555555555','authenticated',
    'billiards.void_closed_session_time(gen_random_uuid(),''test'')'), 'not authorized');
select chk('NEWGUY denied void_closed_session_time',
  public.test_call('44444444-4444-4444-4444-444444444444','authenticated',
    'billiards.void_closed_session_time(gen_random_uuid(),''test'')'), 'not authorized');

-- ── Positive controls: NEWGUY and BMGR must actually be let THROUGH the
-- guard, or every denial above just proves random ids don't exist ─────────
select chk('control: NEWGUY (billiards admin) clears the auth guard on checkout_session',
  public.test_call('44444444-4444-4444-4444-444444444444','authenticated',
    'billiards.checkout_session(gen_random_uuid(),''cash'')'),
  'session not found or already closed');
select chk('control: NEWGUY clears the auth guard on add_order_item',
  public.test_call('44444444-4444-4444-4444-444444444444','authenticated',
    'billiards.add_order_item(gen_random_uuid(),gen_random_uuid())'),
  'session not active');
select chk('control: BMGR (billiards superadmin) actually runs delete_closed_sessions',
  public.test_call('22222222-2222-2222-2222-222222222222','authenticated',
    'billiards.delete_closed_sessions(now() - interval ''30 days'')'),
  'NO ERROR');
select chk('control: BMGR clears the auth guard on void_closed_session_time',
  public.test_call('22222222-2222-2222-2222-222222222222','authenticated',
    'billiards.void_closed_session_time(gen_random_uuid(),''test'')'),
  'session not found, still active, or already corrected');

-- ════════════════════════════════════════════════════════════════════════════
-- 2.2 / 2.5 / 2.7 — a customer, a stranger, and a wrong-business admin,
-- against every game write RPC
-- ════════════════════════════════════════════════════════════════════════════
select chk('C denied record_session',
  public.test_call('55555555-5555-5555-5555-555555555555','authenticated',
    'game.record_session(gen_random_uuid(),30)'),
  'Not authorised to record sessions for the game shop.');
select chk('X denied record_session',
  public.test_call('66666666-6666-6666-6666-666666666666','authenticated',
    'game.record_session(gen_random_uuid(),30)'),
  'Not authorised to record sessions for the game shop.');
select chk('NEWGUY (billiards admin, game access revoked) denied record_session',
  public.test_call('44444444-4444-4444-4444-444444444444','authenticated',
    'game.record_session(gen_random_uuid(),30)'),
  'Not authorised to record sessions for the game shop.');

select chk('C denied set_occupied',
  public.test_call('55555555-5555-5555-5555-555555555555','authenticated',
    'game.set_occupied(gen_random_uuid(),true)'), 'Not authorised.');
select chk('X denied set_occupied',
  public.test_call('66666666-6666-6666-6666-666666666666','authenticated',
    'game.set_occupied(gen_random_uuid(),true)'), 'Not authorised.');
select chk('NEWGUY denied set_occupied (revoked game grant actually enforced)',
  public.test_call('44444444-4444-4444-4444-444444444444','authenticated',
    'game.set_occupied(gen_random_uuid(),true)'), 'Not authorised.');

-- ════════════════════════════════════════════════════════════════════════════
-- 2.3 / 2.9 — superadmin-only game RPCs: denied for a customer, a stranger,
-- AND a non-superadmin game admin
-- ════════════════════════════════════════════════════════════════════════════
select chk('C denied void_session',
  public.test_call('55555555-5555-5555-5555-555555555555','authenticated',
    'game.void_session(gen_random_uuid(),''test'')'),
  'Only a superadmin can correct a recorded session.');
select chk('SHOPSTAFF (game admin, not superadmin) denied void_session',
  public.test_call('33333333-3333-3333-3333-333333333333','authenticated',
    'game.void_session(gen_random_uuid(),''test'')'),
  'Only a superadmin can correct a recorded session.');

select chk('C denied set_stock',
  public.test_call('55555555-5555-5555-5555-555555555555','authenticated',
    'game.set_stock(gen_random_uuid(),5)'), 'Only a superadmin can change stock.');
select chk('SHOPSTAFF denied set_stock',
  public.test_call('33333333-3333-3333-3333-333333333333','authenticated',
    'game.set_stock(gen_random_uuid(),5)'), 'Only a superadmin can change stock.');

-- ── Positive controls: SHOPSTAFF and OWNER must clear the guard ──────────────
select chk('control: SHOPSTAFF (game admin) clears the auth guard on record_session',
  public.test_call('33333333-3333-3333-3333-333333333333','authenticated',
    'game.record_session(gen_random_uuid(),30)'), 'Unknown station.');
select chk('control: SHOPSTAFF clears the auth guard on set_occupied',
  public.test_call('33333333-3333-3333-3333-333333333333','authenticated',
    'game.set_occupied(gen_random_uuid(),true)'), 'Unknown station.');
select chk('control: OWNER (global superadmin) clears the auth guard on game.void_session',
  public.test_call('11111111-1111-1111-1111-111111111111','authenticated',
    'game.void_session(gen_random_uuid(),''test'')'),
  'Session not found, or it has already been corrected.');
select chk('control: OWNER clears the auth guard on game.set_stock',
  public.test_call('11111111-1111-1111-1111-111111111111','authenticated',
    'game.set_stock(gen_random_uuid(),5)'), 'Unknown product.');

-- ════════════════════════════════════════════════════════════════════════════
-- 2.10 — the anon key, no session at all, against a representative RPC from
-- each schema. Billiards issues no revokes (grants execute to anon by
-- Supabase's default privilege — see billiards-schema-migration.sql:54-59)
-- so this MUST be denied by the function's own internal guard, not by a
-- missing grant.
-- ════════════════════════════════════════════════════════════════════════════
select chk('anon denied checkout_session (billiards grants anon EXECUTE by default; the guard must catch it)',
  public.test_call(null,'anon','billiards.checkout_session(gen_random_uuid(),''cash'')'),
  'not authorized');
-- These two are denied EARLIER than the guard: their execute grant is revoked
-- from anon, so the call never reaches the body. That is the stronger outcome,
-- and the assertion names the layer rather than accepting any error - a
-- wildcard here would also pass if the function simply stopped existing. The
-- in-body guard is not left untested: C, X and NEWGUY hit it above, and
-- SHOPSTAFF passes through it.
select chk('anon denied record_session at the grant, before the body runs',
  public.test_call(null,'anon','game.record_session(gen_random_uuid(),30)')
  ~~ '%permission denied for function%', true);
select chk('anon denied delete_closed_sessions at the grant',
  public.test_call(null,'anon','billiards.delete_closed_sessions(now() - interval ''30 days'')')
  ~~ '%permission denied for function%', true);

-- ════════════════════════════════════════════════════════════════════════════
-- 1.3 regression — billiards.app_settings, tightened by
-- phase1-audit-remediation.sql (loaded by run.sh right after
-- billiards-schema-migration.sql). The old `using (true)` policy made
-- pricing readable by anyone; RLS-filtered UPDATE also returns "success,
-- zero rows" rather than an error, which is its own failure mode (Phase
-- 4.2) — assert the row count, not just "no exception".
-- ════════════════════════════════════════════════════════════════════════════
select chk('C sees zero app_settings rows (RLS-filtered, not an error)',
  public.test_value('55555555-5555-5555-5555-555555555555','authenticated',
    'select count(*) from billiards.app_settings'),
  '0');
select chk('anon sees zero app_settings rows',
  public.test_value(null,'anon','select count(*) from billiards.app_settings'),
  '0');
select chk('NEWGUY (billiards admin) DOES see the settings row',
  public.test_value('44444444-4444-4444-4444-444444444444','authenticated',
    'select count(*) from billiards.app_settings'),
  '1');

do $$
declare v_rows int;
begin
  perform public.test_act_as('44444444-4444-4444-4444-444444444444'); -- NEWGUY: billiards admin, not superadmin
  perform set_config('role','authenticated',true);
  update billiards.app_settings set hourly_rate = 99999 where id = true;
  get diagnostics v_rows = row_count;
  perform set_config('role','postgres',true);
  perform chk('a non-superadmin billiards admin cannot write app_settings (0 rows, not an error)', v_rows, 0);
end $$;

do $$
declare v_rows int;
begin
  perform public.test_act_as('22222222-2222-2222-2222-222222222222'); -- BMGR: billiards superadmin
  perform set_config('role','authenticated',true);
  update billiards.app_settings set hourly_rate = 6000 where id = true;
  get diagnostics v_rows = row_count;
  perform set_config('role','postgres',true);
  perform chk('control: a billiards superadmin CAN write app_settings', v_rows, 1);
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2.13 — self-revocation lockout guard
-- ════════════════════════════════════════════════════════════════════════════
select chk('a superadmin cannot revoke their own access',
  public.test_call('11111111-1111-1111-1111-111111111111','authenticated',
    'public.revoke_app_access(''11111111-1111-1111-1111-111111111111'',''billiards'')'),
  'You cannot remove your own access to billiards.');

-- ════════════════════════════════════════════════════════════════════════════
-- 2.15 — billiards.admins.role / game.staff have no authority. Flip NEWGUY's
-- LOCAL role column to 'superadmin' by hand (the shape of a stale row, or
-- someone editing the directory table directly) while their real grant
-- (public.app_access) stays 'admin'. Nothing should change.
-- ════════════════════════════════════════════════════════════════════════════
update billiards.admins set role = 'superadmin' where id = '44444444-4444-4444-4444-444444444444';

select chk('local admins.role=superadmin confers nothing: is_superadmin() still false',
  public.test_value('44444444-4444-4444-4444-444444444444','authenticated',
    'select billiards.is_superadmin()'), 'false');
select chk('...and delete_closed_sessions is still refused',
  public.test_call('44444444-4444-4444-4444-444444444444','authenticated',
    'billiards.delete_closed_sessions(now() - interval ''30 days'')'),
  'Only a superadmin can delete sessions.');

-- Put it back, in case any test after this one in the run relies on the real
-- grant matching the local row.
update billiards.admins set role = 'admin' where id = '44444444-4444-4444-4444-444444444444';
