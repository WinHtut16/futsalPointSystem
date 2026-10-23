\set ON_ERROR_STOP off
\pset pager off

-- ════════════════════════════════════════════════════════════════════════════
-- One rule in all three businesses: an admin runs the counter, a superadmin
-- manages the catalogue
-- ════════════════════════════════════════════════════════════════════════════
--
-- Billiards had drifted twice. First: adjust_stock checked is_active_admin(),
-- and so did the menu_items INSERT policy -- while UPDATE and DELETE checked
-- is_superadmin(). A plain admin could create a menu item and then could not
-- fix a typo in its price. billiards-permission-alignment-migration.sql
-- (below, loaded before this file) closed that by moving adjust_stock and
-- menu_items INSERT to superadmin, matching what was believed at the time to
-- be the game shop's rule.
--
-- Second, the game shop was since widened the OTHER way
-- (game-admin-permissions-migration.sql): a plain admin restocks and toggles
-- a snack's availability; only add/rename/reprice/delete stays superadmin.
-- billiards-stock-alignment-migration.sql brings billiards to match THAT --
-- "an admin runs the counter" now includes restocking, not just selling.
-- Creating/renaming/repricing/deleting an item, and any direct write to
-- stock_movements, stay superadmin-only.
--
-- The risk in loosening adjust_stock back to is_active_admin() is that
-- something else regresses along with it. It does not: menu_items
-- INSERT/UPDATE/DELETE and menu_categories writes are untouched RLS policies,
-- unaffected by a change to one SECURITY DEFINER function's internal guard --
-- but that is exactly the kind of reasoning that has to be PROVED, not
-- asserted, which is what the negative control at the bottom of this file is
-- for.

insert into auth.users (id, email) values
  ('66660000-0000-0000-0000-000000000001','bsuper@akoatp-staff.com'),
  ('66660000-0000-0000-0000-000000000002','badmin@akoatp-staff.com'),
  ('66660000-0000-0000-0000-000000000003','futsalonly@akoatp-staff.com');
update public.profiles set role='admin', username='bsuper'     where id='66660000-0000-0000-0000-000000000001';
update public.profiles set role='admin', username='badmin'     where id='66660000-0000-0000-0000-000000000002';
update public.profiles set role='admin', username='futsalonly' where id='66660000-0000-0000-0000-000000000003';

select public.test_act_as('11111111-1111-1111-1111-111111111111');  -- the owner, from 90-access
select public.grant_app_access('66660000-0000-0000-0000-000000000001','billiards','superadmin','bsuper');
select public.grant_app_access('66660000-0000-0000-0000-000000000002','billiards','admin','badmin');
select public.grant_app_access('66660000-0000-0000-0000-000000000003','futsal','superadmin','futsalonly');

insert into billiards.menu_categories (id, name_en, name_my)
  values ('66661111-0000-0000-0000-000000000001','Drinks','Drinks');
insert into billiards.menu_items (id, category_id, name_en, name_my, price, stock_qty)
  values ('66662222-0000-0000-0000-000000000001','66661111-0000-0000-0000-000000000001',
          'Water','Water', 1000, 50);


-- Probes. SECURITY INVOKER on purpose: they run as the calling role, so the
-- RLS policy on the table is what decides, which is the thing under test.
create or replace function public.insert_probe_menu_item(p_who uuid)
returns void language plpgsql as $probe$
begin
  insert into billiards.menu_items (category_id, name_en, name_my, price, stock_qty)
    values ('66661111-0000-0000-0000-000000000001','Probe '||p_who,'Probe', 500, 1);
end $probe$;

create or replace function public.rename_probe_category(p_who uuid)
returns void language plpgsql as $probe$
begin
  update billiards.menu_categories set name_en = 'Renamed by '||p_who
   where id = '66661111-0000-0000-0000-000000000001';
  if not found then raise exception 'RLS BLOCKED THE UPDATE'; end if;
end $probe$;

create or replace function public.insert_probe_stock_movement(p_who uuid)
returns void language plpgsql as $probe$
begin
  insert into billiards.stock_movements (menu_item_id, change, reason, created_by)
    values ('66662222-0000-0000-0000-000000000001', 99, 'adjustment', p_who);
end $probe$;

-- ── 1. Stock adjustment ─────────────────────────────────────────────────────
-- Widened by billiards-stock-alignment-migration.sql: any active admin, not
-- superadmin-only, matching game.set_stock.

select chk('a plain billiards admin CAN adjust stock',
  public.test_call('66660000-0000-0000-0000-000000000002','authenticated',
    $$billiards.adjust_stock('66662222-0000-0000-0000-000000000001'::uuid, 5, 'restock')$$),
  'NO ERROR'::text);

select chk('...and the stock actually moved',
  (select stock_qty from billiards.menu_items where id='66662222-0000-0000-0000-000000000001'), 55);

select chk('a billiards superadmin can too',
  public.test_call('66660000-0000-0000-0000-000000000001','authenticated',
    $$billiards.adjust_stock('66662222-0000-0000-0000-000000000001'::uuid, 5, 'restock')$$),
  'NO ERROR'::text);

select chk('...both adjustments landed',
  (select stock_qty from billiards.menu_items where id='66662222-0000-0000-0000-000000000001'), 60);

-- The guard must refuse for the RIGHT reason. A test that only asked "did it
-- raise" would pass on a database where the not-found check ran first.
select chk('control: a not-found item raises menu-item-not-found, not an authorization error',
  public.test_call('66660000-0000-0000-0000-000000000002','authenticated',
    $$billiards.adjust_stock('00000000-dead-dead-dead-000000000000'::uuid, 5, 'restock')$$),
  'menu item not found'::text);

select chk('control: a futsal-only account (no billiards grant at all) is still refused',
  public.test_call('66660000-0000-0000-0000-000000000003','authenticated',
    $$billiards.adjust_stock('66662222-0000-0000-0000-000000000001'::uuid, 5, 'restock')$$),
  'not authorized'::text);

-- ── 2. Menu item creation ───────────────────────────────────────────────────

select chk('a plain billiards admin cannot create a menu item',
  public.test_call('66660000-0000-0000-0000-000000000002','authenticated',
    $$public.insert_probe_menu_item('66660000-0000-0000-0000-000000000002'::uuid)$$) ~~ '%row-level security%',
  true);

select chk('a billiards superadmin can',
  public.test_call('66660000-0000-0000-0000-000000000001','authenticated',
    $$public.insert_probe_menu_item('66660000-0000-0000-0000-000000000001'::uuid)$$),
  'NO ERROR'::text);

-- Create and edit now carry the same rank, so nobody can make an item they
-- cannot fix. This is the trap the alignment existed to close.
select chk('create and edit require the same rank',
  (select count(distinct coalesce(qual, with_check))::int from pg_policies
    where schemaname='billiards' and tablename='menu_items'
      and cmd in ('INSERT','UPDATE','DELETE')), 1);

-- ── 2b. Menu categories ─────────────────────────────────────────────────────
--
-- The app never writes these -- it only reads them -- so this was an open
-- write surface nobody was using. A rename here changes what the whole menu
-- is filed under; a delete of an unused category is outright destructive.

-- An UPDATE that matches no rows raises nothing, it just reports zero rows.
-- The probe converts that into an error so a silent no-op cannot pass as a
-- successful write.
select chk('a plain billiards admin cannot rename a menu category',
  public.test_call('66660000-0000-0000-0000-000000000002','authenticated',
    $$public.rename_probe_category('66660000-0000-0000-0000-000000000002'::uuid)$$),
  'RLS BLOCKED THE UPDATE'::text);

select chk('a billiards superadmin can',
  public.test_call('66660000-0000-0000-0000-000000000001','authenticated',
    $$public.rename_probe_category('66660000-0000-0000-0000-000000000001'::uuid)$$),
  'NO ERROR'::text);

-- Splitting the FOR ALL policy must not cost the counter its read. Without
-- this the menu screen would come back empty for every plain admin.
select chk('control: a plain admin can still READ the categories',
  public.test_value('66660000-0000-0000-0000-000000000002','authenticated',
    $$(select count(*) from billiards.menu_categories)$$)::int > 0,
  true);

select chk('control: and still read the menu items',
  public.test_value('66660000-0000-0000-0000-000000000002','authenticated',
    $$(select count(*) from billiards.menu_items)$$)::int > 0,
  true);

-- ── 3. Direct stock_movements writes ────────────────────────────────────────

select chk('a plain billiards admin cannot forge a stock movement',
  public.test_call('66660000-0000-0000-0000-000000000002','authenticated',
    $$public.insert_probe_stock_movement('66660000-0000-0000-0000-000000000002'::uuid)$$) ~~ '%row-level security%',
  true);

-- ── 4. THE NEGATIVE CONTROL: the till still works ───────────────────────────
--
-- If this fails, the migration broke ordinary sales for every admin and has
-- to be reverted. add_order_item writes menu_items AND stock_movements, both
-- of which were just locked to superadmin at the policy level.

insert into billiards.pool_tables (id, name)
  values ('66663333-0000-0000-0000-000000000001','Perm test table');
insert into billiards.sessions (id, table_id, opened_by, started_at, status)
  values ('66664444-0000-0000-0000-000000000001','66663333-0000-0000-0000-000000000001',
          '66660000-0000-0000-0000-000000000002', now(), 'active');

select chk('a plain admin can still take an order',
  public.test_call('66660000-0000-0000-0000-000000000002','authenticated',
    $$billiards.add_order_item('66664444-0000-0000-0000-000000000001'::uuid,
                               '66662222-0000-0000-0000-000000000001'::uuid, 2)$$),
  'NO ERROR'::text);

select chk('...and the sale still decremented stock',
  (select stock_qty from billiards.menu_items where id='66662222-0000-0000-0000-000000000001'), 58);

select chk('...and the sale still wrote its stock movement',
  (select count(*)::int from billiards.stock_movements
    where menu_item_id='66662222-0000-0000-0000-000000000001' and reason='sale'), 1);

select chk('...and a plain admin can still close the table',
  public.test_call('66660000-0000-0000-0000-000000000002','authenticated',
    $$billiards.checkout_session('66664444-0000-0000-0000-000000000001'::uuid, 'cash')$$),
  'NO ERROR'::text);

-- ── 5. The same rule really is the rule everywhere ──────────────────────────
--
-- Introspection rather than three hand-written calls: this keeps biting if
-- someone later relaxes one system and forgets the other two.
--
-- "An admin runs the counter" now means restock AND enable/disable, in both
-- systems -- it is the CATALOGUE (add/rename/reprice/delete) that stays
-- superadmin-only, not stock/availability.

select chk('game shop restocking is active-staff-gated, not superadmin-only',
  (select pg_get_functiondef(p.oid) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='game' and p.proname='set_stock') ~~ '%is_active_staff%',
  true);

select chk('billiards restocking is active-admin-gated, not superadmin-only',
  (select pg_get_functiondef(p.oid) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='billiards' and p.proname='adjust_stock') ~~ '%is_active_admin%',
  true);

select chk('game shop availability toggle is active-staff-gated',
  (select pg_get_functiondef(p.oid) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='game' and p.proname='set_product_active') ~~ '%is_active_staff%',
  true);

select chk('billiards availability toggle is active-admin-gated',
  (select pg_get_functiondef(p.oid) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='billiards' and p.proname='set_menu_item_active') ~~ '%is_active_admin%',
  true);

-- The catalogue itself (add/rename/reprice/delete) is untouched by the stock
-- widening -- RLS policies, not the adjust_stock function, and nothing here
-- rewrote them.
select chk('no billiards catalogue write is left on is_active_admin',
  (select count(*)::int from pg_policies
    where schemaname='billiards'
      and tablename in ('menu_items','menu_categories','stock_movements')
      and cmd <> 'SELECT'
      and coalesce(qual, with_check) like '%is_active_admin%'), 0);

-- ── 6. Enable/disable a menu item ───────────────────────────────────────────

select chk('a plain billiards admin can disable an item',
  public.test_call('66660000-0000-0000-0000-000000000002','authenticated',
    $$billiards.set_menu_item_active('66662222-0000-0000-0000-000000000001'::uuid, false)$$),
  'NO ERROR'::text);

select chk('...and it took effect',
  (select is_active from billiards.menu_items where id='66662222-0000-0000-0000-000000000001'), false);

select chk('...and the same plain admin can re-enable it',
  public.test_call('66660000-0000-0000-0000-000000000002','authenticated',
    $$billiards.set_menu_item_active('66662222-0000-0000-0000-000000000001'::uuid, true)$$),
  'NO ERROR'::text);

select chk('control: it never touched price -- catalogue edits stay superadmin-only',
  (select price from billiards.menu_items where id='66662222-0000-0000-0000-000000000001'), 1000);

select chk('control: a futsal-only account cannot toggle availability',
  public.test_call('66660000-0000-0000-0000-000000000003','authenticated',
    $$billiards.set_menu_item_active('66662222-0000-0000-0000-000000000001'::uuid, false)$$),
  'Only active staff can change item availability.'::text);
