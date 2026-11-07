\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- session-points-migration.sql: rules, phone lookup, award/reversal engine
-- ════════════════════════════════════════════════════════════════════════════
--
-- The zone triggers (Phase 4/5) are thin: they pass a session's state to
-- sync_session_points and store the rule it returns. This file drives the
-- engine directly through a stand-in "session" table, so every rule below is
-- pinned before any trigger exists. People from 90-access: 11111111 owner,
-- 22222222 billiards superadmin, 33333333 game admin, 55555555 customer.

insert into auth.users (id, email, raw_user_meta_data) values
  ('b0c00000-0000-0000-0000-000000000001','09777200001@akoatp.com',
   '{"phone":"09777200001","username":"sess_a"}'),
  ('b0c00000-0000-0000-0000-000000000002','09777200002@akoatp.com',
   '{"phone":"09777200002","username":"sess_b"}');

-- Stand-in for game.sessions / billiards.sessions: just the frozen rule.
create table if not exists _sess (id uuid primary key, rule jsonb);

create or replace function _sync(p_app text, p_sess uuid, p_cust uuid, p_eligible boolean, p_mins int)
returns void language plpgsql as $$
declare v_rule jsonb;
begin
  insert into _sess (id) values (p_sess) on conflict do nothing;
  select rule into v_rule from _sess where id = p_sess;
  update _sess set rule = public.sync_session_points(p_app, p_sess, p_cust, p_eligible, p_mins, v_rule)
   where id = p_sess;
end $$;

create or replace function _bal(p_user uuid, p_app text) returns int language sql as $$
  select coalesce((select balance from public.point_wallets where user_id = p_user and app = p_app), 0);
$$;

create or replace function _sess_net(p_sess uuid, p_user uuid) returns int language sql as $$
  select coalesce(sum(points_delta), 0)::int from public.point_transactions
   where source_session_id = p_sess and customer_id = p_user;
$$;

-- ── Seeded rules ────────────────────────────────────────────────────────────
select chk('game rule seeded: 10 points per 60 minutes, on',
  (select block_minutes = 60 and points_per_block = 10 and is_active from public.point_rules where app = 'game'), true);
select chk('billiards rule seeded as an OFF placeholder',
  (select points_per_block = 0 and not is_active from public.point_rules where app = 'billiards'), true);

-- ── 10 points per FULL hour, nothing in between ─────────────────────────────
select _sync('game', 'b0c01111-0000-0000-0000-000000000059', 'b0c00000-0000-0000-0000-000000000001', true, 59);
select _sync('game', 'b0c01111-0000-0000-0000-000000000060', 'b0c00000-0000-0000-0000-000000000001', true, 60);
select _sync('game', 'b0c01111-0000-0000-0000-000000000090', 'b0c00000-0000-0000-0000-000000000001', true, 90);
select _sync('game', 'b0c01111-0000-0000-0000-000000000119', 'b0c00000-0000-0000-0000-000000000001', true, 119);
select _sync('game', 'b0c01111-0000-0000-0000-000000000120', 'b0c00000-0000-0000-0000-000000000001', true, 120);

select chk('59 min earns 0',  _sess_net('b0c01111-0000-0000-0000-000000000059', 'b0c00000-0000-0000-0000-000000000001'), 0);
select chk('60 min earns 10', _sess_net('b0c01111-0000-0000-0000-000000000060', 'b0c00000-0000-0000-0000-000000000001'), 10);
select chk('90 min earns 10', _sess_net('b0c01111-0000-0000-0000-000000000090', 'b0c00000-0000-0000-0000-000000000001'), 10);
select chk('119 min earns 10', _sess_net('b0c01111-0000-0000-0000-000000000119', 'b0c00000-0000-0000-0000-000000000001'), 10);
select chk('120 min earns 20', _sess_net('b0c01111-0000-0000-0000-000000000120', 'b0c00000-0000-0000-0000-000000000001'), 20);
select chk('game wallet = 50, futsal untouched',
  _bal('b0c00000-0000-0000-0000-000000000001', 'game') = 50
  and _bal('b0c00000-0000-0000-0000-000000000001', 'futsal') = 0, true);
select chk('first award is an earn row tagged with its session',
  (select transaction_type = 'earn' and source_kind = 'game_session' and app = 'game' and hours_played = 2
     from public.point_transactions where source_session_id = 'b0c01111-0000-0000-0000-000000000120'), true);
select chk('a 0-point session writes no ledger row',
  (select count(*)::int from public.point_transactions where source_session_id = 'b0c01111-0000-0000-0000-000000000059'), 0);

-- ── Idempotent ──────────────────────────────────────────────────────────────
select _sync('game', 'b0c01111-0000-0000-0000-000000000120', 'b0c00000-0000-0000-0000-000000000001', true, 120);
select chk('running the same state again posts nothing',
  (select count(*)::int from public.point_transactions where source_session_id = 'b0c01111-0000-0000-0000-000000000120'), 1);

-- ── Not eligible yet: no points ─────────────────────────────────────────────
select _sync('game', 'b0c01111-0000-0000-0000-0000000000a1', 'b0c00000-0000-0000-0000-000000000001', false, 180);
select chk('an open (not eligible) session earns nothing',
  _sess_net('b0c01111-0000-0000-0000-0000000000a1', 'b0c00000-0000-0000-0000-000000000001'), 0);
select _sync('game', 'b0c01111-0000-0000-0000-0000000000a2', null, true, 180);
select chk('a closed session with no customer earns nothing',
  (select count(*)::int from public.point_transactions where source_session_id = 'b0c01111-0000-0000-0000-0000000000a2'), 0);

-- ── Correction: 120 -> 60 takes 10 back, -> 180 gives 20 more ───────────────
select _sync('game', 'b0c01111-0000-0000-0000-000000000120', 'b0c00000-0000-0000-0000-000000000001', true, 60);
select chk('corrected down to 60 min: session net is 10',
  _sess_net('b0c01111-0000-0000-0000-000000000120', 'b0c00000-0000-0000-0000-000000000001'), 10);
select chk('the correction is an adjustment row',
  (select transaction_type from public.point_transactions
    where source_session_id = 'b0c01111-0000-0000-0000-000000000120' order by created_at desc, points_delta limit 1),
  'adjustment');
select _sync('game', 'b0c01111-0000-0000-0000-000000000120', 'b0c00000-0000-0000-0000-000000000001', true, 180);
select chk('corrected up to 180 min: session net is 30',
  _sess_net('b0c01111-0000-0000-0000-000000000120', 'b0c00000-0000-0000-0000-000000000001'), 30);

-- ── Void takes everything back ──────────────────────────────────────────────
select _sync('game', 'b0c01111-0000-0000-0000-000000000060', 'b0c00000-0000-0000-0000-000000000001', false, 60);
select chk('voided session: net 0',
  _sess_net('b0c01111-0000-0000-0000-000000000060', 'b0c00000-0000-0000-0000-000000000001'), 0);
select chk('void reversal is logged under game, not futsal',
  (select app from public.audit_log where action = 'points.adjusted'
     and details->>'session_id' = 'b0c01111-0000-0000-0000-000000000060'), 'game');

-- ── Changing the customer moves the points ──────────────────────────────────
select _sync('game', 'b0c01111-0000-0000-0000-000000000090', 'b0c00000-0000-0000-0000-000000000002', true, 90);
select chk('old customer loses the session''s points',
  _sess_net('b0c01111-0000-0000-0000-000000000090', 'b0c00000-0000-0000-0000-000000000001'), 0);
select chk('new customer gets them',
  _sess_net('b0c01111-0000-0000-0000-000000000090', 'b0c00000-0000-0000-0000-000000000002'), 10);

-- ── Reversal after spending: wallet goes negative, never refused ────────────
select public.add_points_transaction('b0c00000-0000-0000-0000-000000000002', -10, 'adjustment', null, null,
  'spent', null, 0, 'game');
select _sync('game', 'b0c01111-0000-0000-0000-000000000090', 'b0c00000-0000-0000-0000-000000000002', false, 90);
select chk('void after the points were spent leaves the wallet at -10',
  _bal('b0c00000-0000-0000-0000-000000000002', 'game'), -10);

-- ── The rule is frozen per session ──────────────────────────────────────────
select _sync('game', 'b0c01111-0000-0000-0000-0000000000f1', 'b0c00000-0000-0000-0000-000000000001', true, 60);
update public.point_rules set points_per_block = 99 where app = 'game';
select _sync('game', 'b0c01111-0000-0000-0000-0000000000f1', 'b0c00000-0000-0000-0000-000000000001', true, 120);
select chk('a rule change does not re-price an old session (120 min at the frozen 10/h = 20)',
  _sess_net('b0c01111-0000-0000-0000-0000000000f1', 'b0c00000-0000-0000-0000-000000000001'), 20);
select _sync('game', 'b0c01111-0000-0000-0000-0000000000f2', 'b0c00000-0000-0000-0000-000000000001', true, 60);
select chk('a new session uses the new rule',
  _sess_net('b0c01111-0000-0000-0000-0000000000f2', 'b0c00000-0000-0000-0000-000000000001'), 99);
update public.point_rules set points_per_block = 10 where app = 'game';

-- ── Billiards placeholder: off means 0, and stays 0 for that session ────────
select _sync('billiards', 'b0c01111-0000-0000-0000-0000000000b1', 'b0c00000-0000-0000-0000-000000000001', true, 240);
select chk('billiards rule off: no points',
  _bal('b0c00000-0000-0000-0000-000000000001', 'billiards'), 0);
update public.point_rules set points_per_block = 15, is_active = true where app = 'billiards';
select _sync('billiards', 'b0c01111-0000-0000-0000-0000000000b1', 'b0c00000-0000-0000-0000-000000000001', true, 240);
select chk('switching the rule on later does not pay out old sessions',
  _bal('b0c00000-0000-0000-0000-000000000001', 'billiards'), 0);
select _sync('billiards', 'b0c01111-0000-0000-0000-0000000000b2', 'b0c00000-0000-0000-0000-000000000001', true, 240);
select chk('a billiards session after switching on earns 4 x 15',
  _bal('b0c00000-0000-0000-0000-000000000001', 'billiards'), 60);
update public.point_rules set points_per_block = 0, is_active = false where app = 'billiards';

select chk('a days-long session does not overflow hours_played',
  test_call(null, 'postgres', $$_sync('game', 'b0c01111-0000-0000-0000-0000000000d1',
    'b0c00000-0000-0000-0000-000000000001', true, 7000)$$), 'NO ERROR');

select chk('engine refuses futsal (manual entry only)',
  test_call(null, 'postgres', $$public.sync_session_points('futsal', gen_random_uuid(), null, true, 60, null)$$),
  'Session points exist for game and billiards only.');

-- ── Engine is internal ──────────────────────────────────────────────────────
select chk('a signed-in session cannot call sync_session_points',
  has_function_privilege('authenticated', 'public.sync_session_points(text,uuid,uuid,boolean,integer,jsonb)', 'execute'), false);
select chk('a signed-in session cannot call post_session_points',
  has_function_privilege('authenticated', 'public.post_session_points(uuid,integer,text,text,text,uuid,integer,text)', 'execute'), false);

-- ── Phone lookup ────────────────────────────────────────────────────────────
select chk('game staff find a registered customer',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$(select username from public.find_customer_by_phone('09777200001'))$$), 'sess_a');
select chk('+959 / spaces / dashes are accepted',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$(select username from public.find_customer_by_phone('+95 9777-200 001'))$$), 'sess_a');
select chk('an unregistered phone finds nobody',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$(select count(*) from public.find_customer_by_phone('09777299999'))$$), '0');
select chk('a staff account is never returned as a customer',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$(select count(*) from public.find_customer_by_phone('09777000111'))$$), '1');
select chk('a customer cannot look people up',
  test_call('b0c00000-0000-0000-0000-000000000002', 'authenticated',
    $$public.find_customer_by_phone('09777200001')$$), 'Only staff can look up customers.');
select chk('anon cannot look people up',
  has_function_privilege('anon', 'public.find_customer_by_phone(text)', 'execute'), false);
select chk('garbage phone refused',
  test_call('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$public.find_customer_by_phone('12345')$$), 'Enter a valid Myanmar phone number (e.g. 09XXXXXXXXX).');

-- ── Who may change a rule ───────────────────────────────────────────────────
select chk('the global owner sets the billiards rule',
  test_call('11111111-1111-1111-1111-111111111111', 'authenticated',
    $$public.set_point_rule('billiards', 60, 5, true)$$), 'NO ERROR');
select chk('...and it is saved',
  (select points_per_block = 5 and is_active from public.point_rules where app = 'billiards'), true);
select chk('...and audited under billiards',
  (select count(*)::int from public.audit_log where app = 'billiards' and action = 'points.rule_changed'), 1);
select chk('billiards staff cannot set the game rule',
  test_call('22222222-2222-2222-2222-222222222222', 'authenticated',
    $$public.set_point_rule('game', 60, 50, true)$$), 'Only the owner of this business can change its points rule.');
select chk('game admin (not superadmin) cannot set the game rule',
  test_call('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$public.set_point_rule('game', 60, 50, true)$$), 'Only the owner of this business can change its points rule.');
select chk('control: the global owner can set the game rule',
  test_call('11111111-1111-1111-1111-111111111111', 'authenticated',
    $$public.set_point_rule('game', 60, 10, true)$$), 'NO ERROR');
select chk('a zero-minute block is refused',
  test_call('11111111-1111-1111-1111-111111111111', 'authenticated',
    $$public.set_point_rule('game', 0, 10, true)$$), 'Block length must be between 1 and 1440 minutes.');
select chk('futsal has no automatic rule',
  test_call('11111111-1111-1111-1111-111111111111', 'authenticated',
    $$public.set_point_rule('futsal', 60, 10, true)$$), 'Points rules exist for game and billiards only.');
select chk('a customer cannot write point_rules directly',
  test_exec('55555555-5555-5555-5555-555555555555', 'authenticated',
    $$update public.point_rules set points_per_block = 1000$$) like 'permission denied%', true);
