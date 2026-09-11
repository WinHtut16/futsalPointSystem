-- Billiards permission alignment — catalogue and stock become superadmin-only.
--
-- WHY
-- Across the three businesses the rule was meant to be: an admin runs the
-- counter, a superadmin manages the catalogue. Futsal and the game shop
-- already work that way (futsal reward stock is a service-role route behind
-- a superadmin guard; game.set_stock checks is_superadmin()). Billiards
-- drifted:
--
--   billiards.adjust_stock      is_active_admin()   <- any admin
--   menu_items INSERT           is_active_admin()   <- any admin
--   menu_items UPDATE/DELETE    is_superadmin()
--   stock_movements INSERT      is_active_admin()   <- any admin
--   menu_categories ALL         is_active_admin()   <- any admin
--
-- So a plain billiards admin could change stock counts and create a menu
-- item, but then could not edit or delete the item they had just created --
-- a typo in a price was unfixable by the person who made it. The
-- menu_categories policy was looser still: one FOR ALL policy open to any
-- admin, so a plain admin could rename or delete the categories the whole
-- menu hangs off. The app has no category-management screen at all (it only
-- ever reads them), so that write surface was reachable only by going
-- straight at PostgREST -- unused, and open. This migration closes all of it
-- and makes the rule the same in all three systems.
--
-- SAFE FOR ORDINARY SALES
-- Every function that writes billiards.stock_movements is SECURITY DEFINER
-- and owned by postgres, which owns both tables and neither table has FORCE
-- ROW LEVEL SECURITY, so those functions bypass RLS entirely:
--
--   add_order_item       secdef  writes stock_movements   (a sale)
--   void_active_session  secdef  writes stock_movements   (restores stock)
--   checkout_session     secdef  no stock_movements write
--   adjust_stock         secdef  writes stock_movements   (guarded below)
--
-- Tightening the stock_movements INSERT policy therefore only closes the
-- direct PostgREST path. A plain admin taking an order still decrements
-- stock normally.
--
-- IDEMPOTENT. Safe to re-run.

begin;

-- 1. Stock adjustment: superadmin only.
--    Byte-identical to the deployed function except the guard.
create or replace function billiards.adjust_stock(
  p_menu_item_id uuid,
  p_delta integer,
  p_reason text default 'adjustment'::text
)
returns billiards.menu_items
language plpgsql
security definer
set search_path to 'billiards', 'public'
as $function$
declare
  result menu_items;
begin
  if not coalesce(is_superadmin(), false) then
    raise exception 'not authorized';
  end if;
  if p_reason not in ('restock','adjustment') then
    raise exception 'invalid reason %', p_reason;
  end if;

  update menu_items set stock_qty = greatest(0, stock_qty + p_delta) where id = p_menu_item_id returning * into result;
  if not found then
    raise exception 'menu item not found';
  end if;

  insert into stock_movements (menu_item_id, change, reason, created_by)
    values (p_menu_item_id, p_delta, p_reason, auth.uid());

  return result;
end;
$function$;

-- Keep the callable surface as it was: the app calls this as a signed-in
-- user, and anon must never reach it.
revoke all on function billiards.adjust_stock(uuid, integer, text) from public, anon;
grant execute on function billiards.adjust_stock(uuid, integer, text) to authenticated, service_role;

-- 2. Menu item creation: superadmin only, matching the existing
--    UPDATE/DELETE policies so create and edit have one rank.
drop policy if exists menu_items_insert on billiards.menu_items;
create policy menu_items_insert on billiards.menu_items
  for insert to authenticated
  with check (billiards.is_superadmin());

-- 3. Direct stock_movements writes: superadmin only. Sales are unaffected
--    (see the header note -- every writer is SECURITY DEFINER).
drop policy if exists stock_movements_insert on billiards.stock_movements;
create policy stock_movements_insert on billiards.stock_movements
  for insert to authenticated
  with check (billiards.is_superadmin());

-- 4. Menu categories: read for any admin, write for superadmins.
--    Replaces one FOR ALL policy. Splitting it is what lets the counter keep
--    reading the menu while the structure of the menu stops being editable
--    by whoever is on shift.
drop policy if exists menu_categories_all on billiards.menu_categories;

drop policy if exists menu_categories_select on billiards.menu_categories;
create policy menu_categories_select on billiards.menu_categories
  for select using (billiards.is_active_admin());

drop policy if exists menu_categories_insert on billiards.menu_categories;
create policy menu_categories_insert on billiards.menu_categories
  for insert to authenticated
  with check (billiards.is_superadmin());

drop policy if exists menu_categories_update on billiards.menu_categories;
create policy menu_categories_update on billiards.menu_categories
  for update to authenticated
  using (billiards.is_superadmin())
  with check (billiards.is_superadmin());

drop policy if exists menu_categories_delete on billiards.menu_categories;
create policy menu_categories_delete on billiards.menu_categories
  for delete to authenticated
  using (billiards.is_superadmin());

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect is_superadmin() on all three, and unchanged select policies)
--
--   select policyname, cmd, coalesce(qual, with_check) as check
--     from pg_policies
--    where schemaname = 'billiards'
--      and tablename in ('menu_items','menu_categories','stock_movements')
--    order by tablename, policyname;
--
--   select pg_get_functiondef(p.oid)
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'billiards' and p.proname = 'adjust_stock';
