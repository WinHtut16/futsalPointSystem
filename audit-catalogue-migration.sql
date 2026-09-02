-- ============================================================
-- audit-catalogue-migration.sql   (Phase 3: prices and catalogue)
--
-- Run in the FUTSAL Supabase project, AFTER audit-money-migration.sql.
--
-- Prices, products, tables and stations. All by trigger: billiards and the
-- game shop write these through the SIGNED-IN client, so auth.uid() inside a
-- trigger is the real person. Futsal's rewards are the exception - those go
-- through the service role, so they are logged explicitly from the route with
-- p_actor. Phase 2's rule, applied again.
--
-- THE THING THAT MAKES THIS USABLE RATHER THAN NOISE
-- Three of these tables are written constantly by ordinary trade:
--
--   billiards.menu_items.stock_qty   decremented on every drink sold
--   game.products.stock              decremented on every snack sold
--   game.stations.occupied           flipped at the start and end of every session
--
-- A naive trigger would file hundreds of "changed a product" entries a week
-- and bury the four price changes anyone actually wants to find. Every trigger
-- below therefore audits a NAMED list of columns and returns early when none
-- of them moved. Stock has its own ledger (stock_movements, with an actor
-- already); occupancy is visible on the floor screen. Neither belongs here.
--
-- SAFE TO RE-RUN? Yes.
-- ============================================================

do $$
begin
  if to_regprocedure('public.audit(text,text,text,text,text,text,jsonb,uuid)') is null then
    raise exception 'audit-money-migration.sql has not been applied. Nothing was created.';
  end if;
end $$;

-- ── Diff helpers ────────────────────────────────────────────────────────────
-- Written once here rather than by hand in each trigger. Six near-identical
-- comparisons copied six times is six chances to compare the wrong column and
-- silently stop logging a price change - the exact class of quiet failure this
-- whole feature exists to catch.

-- Returns {"price": {"from": 5000, "to": 6000}, ...} for the listed keys that
-- actually changed, or NULL when nothing did. NULL is the signal to skip.
create or replace function public.audit_diff(p_old jsonb, p_new jsonb, p_keys text[])
returns jsonb language plpgsql immutable as $$
declare
  k text;
  v jsonb := '{}'::jsonb;
begin
  foreach k in array p_keys loop
    -- `is distinct from` rather than <>, so a NULL on either side counts as a
    -- change instead of evaluating to NULL and being skipped.
    if (p_old -> k) is distinct from (p_new -> k) then
      v := v || jsonb_build_object(k, jsonb_build_object('from', p_old -> k, 'to', p_new -> k));
    end if;
  end loop;
  if v = '{}'::jsonb then return null; end if;
  return v;
end $$;

-- "price 5000 -> 6000, name_en Coke -> Coke 500ml"
create or replace function public.audit_diff_text(p_diff jsonb)
returns text language sql immutable as $$
  select string_agg(
    format('%s %s -> %s',
           key,
           coalesce(nullif(value -> 'from' #>> '{}', ''), '(empty)'),
           coalesce(nullif(value -> 'to'   #>> '{}', ''), '(empty)')),
    ', ' order by key)
  from jsonb_each(coalesce(p_diff, '{}'::jsonb));
$$;

-- ── Billiards: rates and rules ──────────────────────────────────────────────
create or replace function public.audit_billiards_settings()
returns trigger language plpgsql security definer
set search_path = billiards, public as $$
declare
  d jsonb := public.audit_diff(
    to_jsonb(old), to_jsonb(new),
    array['hourly_rate','min_minutes','increment_minutes','business_name','currency']
  );
begin
  if d is null then return new; end if;
  perform public.audit(
    'billiards', 'settings.updated',
    format('Changed billiards settings: %s', public.audit_diff_text(d)),
    'settings', null, null, d
  );
  return new;
end $$;

drop trigger if exists audit_billiards_settings on billiards.app_settings;
create trigger audit_billiards_settings
  after update on billiards.app_settings
  for each row execute function public.audit_billiards_settings();

-- ── Billiards: menu ─────────────────────────────────────────────────────────
-- stock_qty is deliberately absent from the column list: it moves on every
-- drink sold, and stock_movements already records each change with an actor.
create or replace function public.audit_billiards_menu()
returns trigger language plpgsql security definer
set search_path = billiards, public as $$
declare
  d jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.audit(
      'billiards', 'catalogue.created',
      format('Added menu item %s at %s.', new.name_en, new.price),
      'menu_item', new.id::text, new.name_en,
      jsonb_build_object('price', new.price, 'name_my', new.name_my)
    );
    return new;
  end if;

  d := public.audit_diff(to_jsonb(old), to_jsonb(new),
                         array['name_en','name_my','price','is_active','low_stock_threshold']);
  if d is null then return new; end if;

  -- Deactivating is how this app deletes, so say "removed" - "changed
  -- is_active false" is technically true and useless to read.
  if (d ? 'is_active') and new.is_active = false then
    perform public.audit(
      'billiards', 'catalogue.removed',
      format('Removed menu item %s.', new.name_en),
      'menu_item', new.id::text, new.name_en, d
    );
  else
    perform public.audit(
      'billiards', 'catalogue.updated',
      format('Changed menu item %s: %s', new.name_en, public.audit_diff_text(d)),
      'menu_item', new.id::text, new.name_en, d
    );
  end if;
  return new;
end $$;

drop trigger if exists audit_billiards_menu on billiards.menu_items;
create trigger audit_billiards_menu
  after insert or update on billiards.menu_items
  for each row execute function public.audit_billiards_menu();

-- ── Billiards: tables ───────────────────────────────────────────────────────
create or replace function public.audit_billiards_tables()
returns trigger language plpgsql security definer
set search_path = billiards, public as $$
declare
  d jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.audit('billiards', 'catalogue.created',
      format('Added table %s.', new.name),
      'table', new.id::text, new.name, null);
    return new;
  end if;

  d := public.audit_diff(to_jsonb(old), to_jsonb(new),
                         array['name','is_active','display_order']);
  if d is null then return new; end if;

  if (d ? 'is_active') and new.is_active = false then
    perform public.audit('billiards', 'catalogue.removed',
      format('Took table %s out of use.', new.name),
      'table', new.id::text, new.name, d);
  else
    perform public.audit('billiards', 'catalogue.updated',
      format('Changed table %s: %s', new.name, public.audit_diff_text(d)),
      'table', new.id::text, new.name, d);
  end if;
  return new;
end $$;

drop trigger if exists audit_billiards_tables on billiards.pool_tables;
create trigger audit_billiards_tables
  after insert or update on billiards.pool_tables
  for each row execute function public.audit_billiards_tables();

-- ── Game shop: products ─────────────────────────────────────────────────────
-- `stock` absent for the same reason as billiards: game.stock_movements has it.
create or replace function public.audit_game_products()
returns trigger language plpgsql security definer
set search_path = game, public as $$
declare
  d jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.audit('game', 'catalogue.created',
      format('Added product %s at %s.', new.name_en, new.price),
      'product', new.id::text, new.name_en,
      jsonb_build_object('price', new.price, 'category', new.category));
    return new;
  end if;

  d := public.audit_diff(to_jsonb(old), to_jsonb(new),
                         array['name_en','name_my','price','category','active']);
  if d is null then return new; end if;

  if (d ? 'active') and new.active = false then
    perform public.audit('game', 'catalogue.removed',
      format('Removed product %s.', new.name_en),
      'product', new.id::text, new.name_en, d);
  else
    perform public.audit('game', 'catalogue.updated',
      format('Changed product %s: %s', new.name_en, public.audit_diff_text(d)),
      'product', new.id::text, new.name_en, d);
  end if;
  return new;
end $$;

drop trigger if exists audit_game_products on game.products;
create trigger audit_game_products
  after insert or update on game.products
  for each row execute function public.audit_game_products();

-- ── Game shop: pricing ──────────────────────────────────────────────────────
-- The tier rate is the single most consequential number in the shop, and it
-- changed with no record at all until now. Past sessions are unaffected either
-- way: record_session snapshots rate_per_hour onto every row it writes.
create or replace function public.audit_game_pricing()
returns trigger language plpgsql security definer
set search_path = game, public as $$
declare
  d jsonb := public.audit_diff(to_jsonb(old), to_jsonb(new),
                               array['rate_per_hour','min_minutes']);
begin
  if d is null then return new; end if;
  perform public.audit('game', 'catalogue.updated',
    format('Changed %s pricing: %s', new.tier, public.audit_diff_text(d)),
    'pricing', new.tier, new.tier, d);
  return new;
end $$;

drop trigger if exists audit_game_pricing on game.pricing;
create trigger audit_game_pricing
  after update on game.pricing
  for each row execute function public.audit_game_pricing();

-- ── Game shop: stations ─────────────────────────────────────────────────────
-- `occupied` is deliberately absent: it flips at the start and end of every
-- session, and the floor screen already shows it. `status` stays, because
-- taking a station out for maintenance is a decision someone made.
create or replace function public.audit_game_stations()
returns trigger language plpgsql security definer
set search_path = game, public as $$
declare
  d jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.audit('game', 'catalogue.created',
      format('Added station %s (%s).', new.name, new.tier),
      'station', new.id::text, new.name, null);
    return new;
  end if;

  d := public.audit_diff(to_jsonb(old), to_jsonb(new),
                         array['name','tier','status','sort_order']);
  if d is null then return new; end if;

  perform public.audit('game', 'catalogue.updated',
    format('Changed station %s: %s', new.name, public.audit_diff_text(d)),
    'station', new.id::text, new.name, d);
  return new;
end $$;

drop trigger if exists audit_game_stations on game.stations;
create trigger audit_game_stations
  after insert or update on game.stations
  for each row execute function public.audit_game_stations();

-- ── Futsal: rewards ─────────────────────────────────────────────────────────
-- The rewards routes write through the service role, so auth.uid() is NULL and
-- a trigger has no actor of its own. The obvious answer was an explicit
-- audit() call in each of the three routes with p_actor - and that would have
-- been the weakest thing in this whole feature, because the write has already
-- committed by the time the route can log it. A failed log there is a price
-- change with no record and nothing left to roll back.
--
-- One nullable column fixes it. The routes now stamp updated_by on the write
-- itself, and the trigger reads the actor off the row exactly like every other
-- one here: atomic, and impossible for a fourth route added later to skip.
alter table public.rewards
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

comment on column public.rewards.updated_by is
  'Who last created or changed this reward. Written by the admin routes; read by the audit trigger.';

create or replace function public.audit_futsal_rewards()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  d jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.audit('futsal', 'catalogue.created',
      format('Added reward %s at %s points.', new.name, new.points_cost),
      'reward', new.id::text, new.name,
      jsonb_build_object('points_cost', new.points_cost, 'stock', new.stock),
      new.updated_by);
    return new;
  end if;

  -- `stock` is deliberately absent. approve_redemption does
  -- `update rewards set stock = stock - 1`, so watching it would file a
  -- "changed reward" entry beside every single approval - the same noise
  -- problem as menu stock, and the approval itself is already logged.
  d := public.audit_diff(to_jsonb(old), to_jsonb(new),
                         array['name','name_my','description','description_my',
                               'points_cost','is_active','is_deleted']);
  if d is null then return new; end if;

  if (d ? 'is_deleted') and new.is_deleted = true then
    perform public.audit('futsal', 'catalogue.removed',
      format('Removed reward %s.', new.name),
      'reward', new.id::text, new.name, d, new.updated_by);
  else
    perform public.audit('futsal', 'catalogue.updated',
      format('Changed reward %s: %s', new.name, public.audit_diff_text(d)),
      'reward', new.id::text, new.name, d, new.updated_by);
  end if;
  return new;
end $$;

drop trigger if exists audit_futsal_rewards on public.rewards;
create trigger audit_futsal_rewards
  after insert or update on public.rewards
  for each row execute function public.audit_futsal_rewards();

-- ── Sanity checks ───────────────────────────────────────────────────────────
--   -- must produce NO audit row (ordinary trade):
--   update game.products set stock = stock - 1 where id = '...';
--   update game.stations set occupied = true where id = '...';
--   -- must produce one:
--   update game.pricing set rate_per_hour = rate_per_hour + 100 where tier = 'PS5';
--
--   select action, target_type, target_label, summary
--     from public.audit_log order by created_at desc limit 10;
