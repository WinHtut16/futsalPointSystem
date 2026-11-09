\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- loyalty-zone-admin-migration.sql: points & rewards admin called from the
-- game and billiards admin apps, and my_venue_sessions for customer portals.
-- ════════════════════════════════════════════════════════════════════════════
--
-- Stage 2 (after 105, whose game sessions it reuses). People: 11111111 owner
-- (global superadmin), 22222222 billiards admin, 33333333 game admin,
-- c0d…11 gamer_a and c0d…12 gamer_b (customers from 105).

insert into auth.users (id, email, raw_user_meta_data) values
  ('e0f00000-0000-0000-0000-000000000001','09777500001@akoatp.com',
   '{"phone":"09777500001","username":"loyal_x"}');

create table if not exists _lz (name text primary key, id uuid);

-- ── Who may do what ─────────────────────────────────────────────────────────
select chk('futsal is not managed here',
  test_call('11111111-1111-1111-1111-111111111111', 'authenticated', $$public.loyalty_rewards('futsal')$$),
  'Unknown business.');
select chk('a customer cannot read the admin reward list',
  test_call('e0f00000-0000-0000-0000-000000000001', 'authenticated', $$public.loyalty_rewards('game')$$),
  'You do not have access to this business.');
select chk('a billiards admin cannot read game rewards',
  test_call('22222222-2222-2222-2222-222222222222', 'authenticated', $$public.loyalty_rewards('game')$$),
  'You do not have access to this business.');
select chk('a game admin cannot create a reward (owner only)',
  test_call('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$public.loyalty_save_reward('game', null, 'Free hour', null, null, null, 100, 2)$$),
  'Only an owner can do this.');
select chk('anon cannot call the admin functions',
  has_function_privilege('anon', 'public.loyalty_rewards(text)', 'execute'), false);

-- ── Rewards ─────────────────────────────────────────────────────────────────
insert into _lz select 'reward', (test_value('11111111-1111-1111-1111-111111111111', 'authenticated',
  $$public.loyalty_save_reward('game', null, '  Free hour  ', 'အခမဲ့ တစ်နာရီ', null, null, 100, 2)->>'id'$$))::uuid;

select chk('the owner creates a game reward (trimmed, app = game)',
  (select name = 'Free hour' and app = 'game' and stock = 2 from public.rewards where id = (select id from _lz where name = 'reward')), true);
select chk('...and it is audited under game, not futsal',
  (select count(*)::int from public.audit_log where app = 'game' and action = 'catalogue.created'
      and target_id = (select id::text from _lz where name = 'reward')), 1);
select chk('a game admin sees it',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$jsonb_array_length(public.loyalty_rewards('game'))$$)::int >= 1, true);
select chk('a game admin can switch it off',
  test_call('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$public.loyalty_set_reward_active('game', (select id from _lz where name = 'reward'), false)$$), 'NO ERROR');
select chk('a game reward id is not found through billiards',
  test_call('22222222-2222-2222-2222-222222222222', 'authenticated',
    $$public.loyalty_set_reward_active('billiards', (select id from _lz where name = 'reward'), true)$$),
  'Reward not found.');
select chk('a zero-point reward is refused',
  test_call('11111111-1111-1111-1111-111111111111', 'authenticated',
    $$public.loyalty_save_reward('game', null, 'Bad', null, null, null, 0, null)$$),
  'Points cost must be between 1 and 1,000,000.');
select public.test_call('33333333-3333-3333-3333-333333333333', 'authenticated',
  $$public.loyalty_set_reward_active('game', (select id from _lz where name = 'reward'), true)$$);

-- ── Corrections ─────────────────────────────────────────────────────────────
select chk('a game admin adds 100 game points with a reason',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$public.loyalty_adjust_points('game', 'e0f00000-0000-0000-0000-000000000001', 100, 'opening promo')$$), '100');
select chk('...futsal untouched',
  (select total_points from public.profiles where id = 'e0f00000-0000-0000-0000-000000000001'), 0);
select chk('a correction cannot push the balance below zero',
  test_call('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$public.loyalty_adjust_points('game', 'e0f00000-0000-0000-0000-000000000001', -500, 'oops')$$),
  'Adjustment would drive the balance below zero.');
select chk('a reason is required',
  test_call('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$public.loyalty_adjust_points('game', 'e0f00000-0000-0000-0000-000000000001', 5, '  ')$$),
  'A reason is required (up to 500 characters).');
select chk('a billiards admin cannot correct game points',
  test_call('22222222-2222-2222-2222-222222222222', 'authenticated',
    $$public.loyalty_adjust_points('game', 'e0f00000-0000-0000-0000-000000000001', 5, 'x')$$),
  'You do not have access to this business.');

-- ── Requests ────────────────────────────────────────────────────────────────
insert into public.redemption_requests (id, customer_id, reward_id, points_cost_snapshot)
values ('e0f02222-0000-0000-0000-000000000001', 'e0f00000-0000-0000-0000-000000000001',
        (select id from _lz where name = 'reward'), 100);

-- (103 leaves another game request pending, so count against the table.)
select chk('pending count for the badge',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated', $$public.loyalty_pending_count('game')$$)::int
  = (select count(*)::int from public.redemption_requests where app = 'game' and status = 'pending'), true);
select chk('the pending card shows the GAME balance',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$(select e->'customer'->>'balance' from jsonb_array_elements(public.loyalty_requests('game', 'pending')) e
        where e->>'id' = 'e0f02222-0000-0000-0000-000000000001')$$), '100');
select chk('a billiards admin cannot resolve it through billiards',
  test_call('22222222-2222-2222-2222-222222222222', 'authenticated',
    $$public.loyalty_resolve_request('billiards', 'e0f02222-0000-0000-0000-000000000001', 'approve')$$),
  'Request not found.');
select chk('a game admin approves it',
  test_call('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$public.loyalty_resolve_request('game', 'e0f02222-0000-0000-0000-000000000001', 'approve')$$), 'NO ERROR');
select chk('...game balance is now 0',
  (select balance from public.point_wallets where user_id = 'e0f00000-0000-0000-0000-000000000001' and app = 'game'), 0);
select chk('...stock went 2 -> 1',
  (select stock from public.rewards where id = (select id from _lz where name = 'reward')), 1);
select chk('...audited under game',
  (select count(*)::int from public.audit_log where app = 'game' and action = 'redemption.approved'
      and target_id = 'e0f02222-0000-0000-0000-000000000001'), 1);
select chk('approving twice says so in words',
  test_call('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$public.loyalty_resolve_request('game', 'e0f02222-0000-0000-0000-000000000001', 'approve')$$),
  'This request has already been actioned.');
select chk('it is in history now',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$jsonb_array_length(public.loyalty_requests('game', 'history'))$$)::int >= 1, true);
select chk('clearing history is owner only',
  test_call('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$public.loyalty_clear_history('game', array['e0f02222-0000-0000-0000-000000000001'::uuid])$$),
  'Only an owner can do this.');
select chk('the owner clears it',
  test_value('11111111-1111-1111-1111-111111111111', 'authenticated',
    $$public.loyalty_clear_history('game', array['e0f02222-0000-0000-0000-000000000001'::uuid])$$), '1');

-- ── Customers ───────────────────────────────────────────────────────────────
select chk('the customer list finds loyal_x by name',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$public.loyalty_customers('game', 'loyal')->'rows'->0->>'username'$$), 'loyal_x');
select chk('...and by phone',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$(public.loyalty_customers('game', '0977750000')->>'total')$$), '1');
select chk('a customer with no game activity is not in the game list',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$(public.loyalty_customers('game', '09777000111')->>'total')$$), '0');
select chk('customer detail shows the correction and the redemption',
  test_value('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$jsonb_array_length(public.loyalty_customer('game', 'e0f00000-0000-0000-0000-000000000001')->'transactions')$$), '2');
select chk('customer detail of a staff account is refused',
  test_call('33333333-3333-3333-3333-333333333333', 'authenticated',
    $$public.loyalty_customer('game', '22222222-2222-2222-2222-222222222222')$$),
  'Customer not found.');

-- ── Customer portal: own sessions only ──────────────────────────────────────
select chk('gamer_a sees exactly their own closed game sessions',
  test_value('c0d00000-0000-0000-0000-000000000011', 'authenticated',
    $$jsonb_array_length(public.my_venue_sessions('game', null, 50))$$)::int
  = (select count(*)::int from game.sessions
      where customer_id = 'c0d00000-0000-0000-0000-000000000011' and status = 'closed'), true);
select chk('...and none of gamer_b''s',
  test_value('c0d00000-0000-0000-0000-000000000011', 'authenticated',
    $$(select count(*) from jsonb_array_elements(public.my_venue_sessions('game', null, 50)) e
        where (e->>'id')::uuid in (select id from game.sessions
                                    where customer_id = 'c0d00000-0000-0000-0000-000000000012'))$$), '0');
select chk('a customer with no sessions gets an empty list',
  test_value('e0f00000-0000-0000-0000-000000000001', 'authenticated',
    $$jsonb_array_length(public.my_venue_sessions('billiards'))$$), '0');
select chk('signed out: refused',
  test_call(null, 'authenticated', $$public.my_venue_sessions('game')$$),
  'Sign in to see your sessions.');
