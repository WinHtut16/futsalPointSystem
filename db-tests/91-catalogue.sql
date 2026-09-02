\set ON_ERROR_STOP off
\pset pager off

-- Control: a function that IS meant to be callable must come back true, or the
-- two "not executable" results above prove nothing but a broken check.
select chk('control: grant_app_access IS executable by authenticated',
  has_function_privilege('authenticated','public.grant_app_access(uuid,text,text,text)','execute')::text,
  'true'::text);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. THE NOISE FILTER — the reason this feature is usable at all
-- ════════════════════════════════════════════════════════════════════════════
select public.test_act_as('11111111-1111-1111-1111-111111111111');

insert into game.stations (id, name, tier, sort_order)
  values ('aaaaaaaa-0000-0000-0000-000000000001','PS5 Room A','PS5',1);
insert into game.products (id, name_en, name_my, category, price, stock)
  values ('bbbbbbbb-0000-0000-0000-000000000001','Coke','ကိုကာ','drink',1000,20);
-- PS5 is already seeded by the schema migration; do not touch it here, or the
-- setup itself logs a price change and the assertion below counts two.

create temp table m as select count(*)::int c from public.audit_log;

-- Ordinary trade: a snack sold, a station occupied, a station freed.
update game.products set stock = stock - 1 where id='bbbbbbbb-0000-0000-0000-000000000001';
update game.stations set occupied = true  where id='aaaaaaaa-0000-0000-0000-000000000001';
update game.stations set occupied = false where id='aaaaaaaa-0000-0000-0000-000000000001';

select chk('selling a snack writes NO audit row',
  (select count(*)::int from public.audit_log) - (select c from m), 0);

-- A decision: the price goes up.
update game.products set price = 1200 where id='bbbbbbbb-0000-0000-0000-000000000001';
select chk('a price change writes exactly one',
  (select count(*)::int from public.audit_log) - (select c from m), 1);
select chk('...naming the product',
  (select target_label from public.audit_log order by id desc limit 1), 'Coke'::text);
select chk('...with the before and after',
  (select details->'price'->>'from' || '->' || (details->'price'->>'to')
     from public.audit_log order by id desc limit 1), '1000->1200'::text);

-- The tier rate: the single most consequential number in the shop.
update game.pricing set rate_per_hour = 3500 where tier='PS5';
select chk('a tier rate change is recorded',
  (select count(*)::int from public.audit_log where target_type='pricing'), 1);
select chk('...as a real before-and-after',
  (select (details->'rate_per_hour'->>'from') || '->' || (details->'rate_per_hour'->>'to')
     from public.audit_log where target_type='pricing' order by id desc limit 1), '5000->3500'::text);

-- Same story on the billiards side.
insert into billiards.pool_tables (id, name) values ('cccccccc-0000-0000-0000-000000000001','Table 1');
insert into billiards.menu_categories (id, name_en, name_my)
  values ('dddddddd-0000-0000-0000-000000000001','Drinks','အဖျော်ယမကာ');
insert into billiards.menu_items (id, category_id, name_en, name_my, price, stock_qty)
  values ('eeeeeeee-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','Beer','ဘီယာ',2000,50);

truncate m; insert into m select count(*)::int from public.audit_log;
update billiards.menu_items set stock_qty = stock_qty - 3 where id='eeeeeeee-0000-0000-0000-000000000001';
select chk('billiards: selling stock writes NO audit row',
  (select count(*)::int from public.audit_log) - (select c from m), 0);

update billiards.menu_items set price = 2500 where id='eeeeeeee-0000-0000-0000-000000000001';
select chk('billiards: a price change writes one',
  (select count(*)::int from public.audit_log) - (select c from m), 1);

update billiards.menu_items set is_active = false where id='eeeeeeee-0000-0000-0000-000000000001';
select chk('deactivating reads as "removed", not "changed is_active"',
  (select action from public.audit_log order by id desc limit 1), 'catalogue.removed'::text);

update billiards.app_settings set hourly_rate = 6000 where id;
select chk('the hourly rate is recorded',
  (select count(*)::int from public.audit_log where action='settings.updated'), 1);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Corrections
-- ════════════════════════════════════════════════════════════════════════════
insert into game.sessions
  (id, station_id, station_name, tier, rate_per_hour, minutes, charged_minutes,
   playtime_total, snacks_total, total, created_by)
values
  ('ffffffff-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
   'PS5 Room A','PS5',3000,60,60,3000,1200,4200,
   '33333333-3333-3333-3333-333333333333');

truncate m; insert into m select count(*)::int from public.audit_log;
select game.void_session('ffffffff-0000-0000-0000-000000000001','Wrong duration typed', false);

select chk('a correction zeroes the playtime',
  (select playtime_total from game.sessions where id='ffffffff-0000-0000-0000-000000000001'), 0::numeric);
select chk('...keeps the snacks the customer really drank',
  (select snacks_total from game.sessions where id='ffffffff-0000-0000-0000-000000000001'), 1200::numeric);
select chk('...leaves the total equal to the snacks',
  (select total from game.sessions where id='ffffffff-0000-0000-0000-000000000001'), 1200::numeric);
select chk('...and is recorded exactly once',
  (select count(*)::int from public.audit_log) - (select c from m), 1);
select chk('...with the reason the person typed',
  (select details->>'reason' from public.audit_log order by id desc limit 1), 'Wrong duration typed'::text);
select chk('...and the money it moved',
  (select (details->>'from_total') || '->' || (details->>'to_total')
     from public.audit_log order by id desc limit 1), '4200->1200'::text);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Rewards: the actor comes from the column, not auth.uid()
-- ════════════════════════════════════════════════════════════════════════════
insert into public.rewards (id, name, points_cost, updated_by)
  values ('99999999-0000-0000-0000-000000000001','Free drink',100,
          '11111111-1111-1111-1111-111111111111');

-- Simulate the service-role route: no auth.uid() at all.
select public.test_act_as(null);
update public.rewards set points_cost = 150,
       updated_by = '22222222-2222-2222-2222-222222222222'
 where id='99999999-0000-0000-0000-000000000001';

select chk('a reward change is recorded even with no auth.uid()',
  (select count(*)::int from public.audit_log
    where target_id='99999999-0000-0000-0000-000000000001' and action='catalogue.updated'), 1);
select chk('...attributed to the real admin, not "system"',
  (select actor_name from public.audit_log
    where target_id='99999999-0000-0000-0000-000000000001' and action='catalogue.updated'), 'bmgr'::text);

-- approve_redemption does `set stock = stock - 1`; that must not look like an edit.
select public.test_act_as('11111111-1111-1111-1111-111111111111');
truncate m; insert into m select count(*)::int from public.audit_log;
update public.rewards set stock = coalesce(stock,10) - 1 where id='99999999-0000-0000-0000-000000000001';
select chk('a redemption decrementing reward stock writes NO row',
  (select count(*)::int from public.audit_log) - (select c from m), 0);
