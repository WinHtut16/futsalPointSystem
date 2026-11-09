-- ============================================================
-- Points & rewards admin for the game shop and billiards, called from
-- their own admin apps (zones), plus each customer's own session list.
--
-- Client decision 2026-11-09: game and billiards manage points inside
-- their own admin apps (like futsal's Loyalty section), and each venue has
-- its own customer portal on the hub site.
--
-- Why functions and not table writes: rewards, the points ledger and
-- redemption requests are written only by the service role (RLS), and the
-- game zone has no service role. Each function below checks the caller in
-- the database, so both zones share one guard:
--   * staff of THAT business (public.app_role(p_app) is not null) -
--     requests, switching a reward on/off, customers, corrections;
--   * owner (global superadmin, public.is_superadmin()) - creating,
--     editing and deleting rewards, clearing history.
-- Every query is pinned to p_app, so an id from another business is
-- simply "not found".
--
-- Also: the reward and redemption audit triggers logged everything under
-- 'futsal'; they now log under the row's own business.
--
-- Run AFTER: session-points-migration.sql, game-points-migration.sql,
--            billiards-points-migration.sql. Safe to re-run.
-- ============================================================

do $$
begin
  if to_regprocedure('public.sync_session_points(text,uuid,uuid,boolean,integer,jsonb)') is null then
    raise exception 'Run session-points-migration.sql first.';
  end if;
end $$;

begin;

-- ------------------------------------------------------------
-- Guard
-- ------------------------------------------------------------
create or replace function public.loyalty_guard(p_app text, p_owner boolean default false)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_app is null or p_app not in ('game', 'billiards') then
    raise exception 'Unknown business.' using errcode = '22023';
  end if;
  if public.app_role(p_app) is null then
    raise exception 'You do not have access to this business.' using errcode = '42501';
  end if;
  if p_owner and not public.is_superadmin() then
    raise exception 'Only an owner can do this.' using errcode = '42501';
  end if;
end $$;

revoke all on function public.loyalty_guard(text, boolean) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Rewards
-- ------------------------------------------------------------
create or replace function public.loyalty_rewards(p_app text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform loyalty_guard(p_app);
  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.points_cost, r.name)
      from rewards r
     where r.app = p_app and not r.is_deleted
  ), '[]'::jsonb);
end $$;

-- p_id null = create. Owner only.
create or replace function public.loyalty_save_reward(
  p_app            text,
  p_id             uuid,
  p_name           text,
  p_name_my        text,
  p_description    text,
  p_description_my text,
  p_points_cost    integer,
  p_stock          integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row rewards;
begin
  perform loyalty_guard(p_app, true);

  if btrim(coalesce(p_name, '')) = '' or length(btrim(p_name)) > 100 then
    raise exception 'Name is required (up to 100 characters).' using errcode = '22023';
  end if;
  if p_points_cost is null or p_points_cost < 1 or p_points_cost > 1000000 then
    raise exception 'Points cost must be between 1 and 1,000,000.' using errcode = '22023';
  end if;
  if p_stock is not null and (p_stock < 0 or p_stock > 1000000) then
    raise exception 'Stock must be empty or between 0 and 1,000,000.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into rewards (name, name_my, description, description_my, points_cost, stock, app, updated_by)
    values (btrim(p_name), nullif(btrim(coalesce(p_name_my, '')), ''),
            nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_description_my, '')), ''),
            p_points_cost, p_stock, p_app, auth.uid())
    returning * into v_row;
  else
    update rewards set
      name           = btrim(p_name),
      name_my        = nullif(btrim(coalesce(p_name_my, '')), ''),
      description    = nullif(btrim(coalesce(p_description, '')), ''),
      description_my = nullif(btrim(coalesce(p_description_my, '')), ''),
      points_cost    = p_points_cost,
      stock          = p_stock,
      updated_at     = now(),
      updated_by     = auth.uid()
    where id = p_id and app = p_app and not is_deleted
    returning * into v_row;
    if v_row.id is null then
      raise exception 'Reward not found.' using errcode = 'P0002';
    end if;
  end if;

  return to_jsonb(v_row);
end $$;

-- Switching a reward on/off: any admin of the business, as in futsal.
create or replace function public.loyalty_set_reward_active(p_app text, p_id uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row rewards;
begin
  perform loyalty_guard(p_app);
  update rewards set is_active = coalesce(p_active, false), updated_at = now(), updated_by = auth.uid()
   where id = p_id and app = p_app and not is_deleted
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Reward not found.' using errcode = 'P0002';
  end if;
  return to_jsonb(v_row);
end $$;

-- Soft delete: the row stays so past redemptions keep their reward name.
create or replace function public.loyalty_delete_reward(p_app text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform loyalty_guard(p_app, true);
  update rewards set is_deleted = true, is_active = false, updated_at = now(), updated_by = auth.uid()
   where id = p_id and app = p_app and not is_deleted;
  if not found then
    raise exception 'Reward not found.' using errcode = 'P0002';
  end if;
end $$;

-- ------------------------------------------------------------
-- Redemption requests
-- ------------------------------------------------------------
-- p_scope: 'pending' (oldest first) or 'history' (newest first).
create or replace function public.loyalty_requests(p_app text, p_scope text default 'pending', p_limit integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform loyalty_guard(p_app);
  return coalesce((
    select jsonb_agg(x.j order by x.k)
      from (
        select jsonb_build_object(
                 'id', rr.id, 'status', rr.status, 'requested_at', rr.requested_at,
                 'resolved_at', rr.resolved_at, 'notes', rr.notes,
                 'points_cost', coalesce(rr.points_cost_snapshot, r.points_cost),
                 'reward', jsonb_build_object('id', r.id, 'name', r.name, 'name_my', r.name_my),
                 'customer', jsonb_build_object(
                   'id', p.id, 'username', p.username, 'phone', p.phone,
                   'balance', coalesce(w.balance, 0))
               ) as j,
               case when p_scope = 'history'
                    then -extract(epoch from coalesce(rr.resolved_at, rr.requested_at))
                    else extract(epoch from rr.requested_at) end as k
          from redemption_requests rr
          join rewards r  on r.id = rr.reward_id
          join profiles p on p.id = rr.customer_id
          left join point_wallets w on w.user_id = rr.customer_id and w.app = p_app
         where rr.app = p_app
           and (case when p_scope = 'history'
                     then rr.status in ('approved', 'rejected', 'cancelled')
                     else rr.status = 'pending' end)
         order by k
         limit greatest(1, least(coalesce(p_limit, 200), 500))
      ) x
  ), '[]'::jsonb);
end $$;

create or replace function public.loyalty_pending_count(p_app text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform loyalty_guard(p_app);
  return (select count(*)::int from redemption_requests where app = p_app and status = 'pending');
end $$;

create or replace function public.loyalty_resolve_request(p_app text, p_id uuid, p_action text, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform loyalty_guard(p_app);

  if not exists (select 1 from redemption_requests where id = p_id and app = p_app) then
    raise exception 'Request not found.' using errcode = 'P0002';
  end if;

  if p_action = 'approve' then
    begin
      perform approve_redemption(p_id, auth.uid(), nullif(btrim(coalesce(p_notes, '')), ''));
    exception when others then
      -- approve_redemption raises short codes; say them in words.
      raise exception '%', case sqlerrm
        when 'not_pending'         then 'This request has already been actioned.'
        when 'out_of_stock'        then 'This reward is out of stock.'
        when 'reward_unavailable'  then 'This reward is no longer available.'
        when 'insufficient_points' then 'The customer no longer has enough points.'
        when 'request_not_found'   then 'Request not found.'
        else sqlerrm end
      using errcode = 'P0001';
    end;
  elsif p_action = 'reject' then
    update redemption_requests
       set status = 'rejected', resolved_at = now(), resolved_by = auth.uid(),
           notes = nullif(btrim(coalesce(p_notes, '')), '')
     where id = p_id and app = p_app and status = 'pending';
    if not found then
      raise exception 'This request has already been actioned.' using errcode = 'P0001';
    end if;
  else
    raise exception 'Choose approve or reject.' using errcode = '22023';
  end if;
end $$;

-- Clear resolved history (owner only, resolved rows of this business only).
create or replace function public.loyalty_clear_history(p_app text, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  perform loyalty_guard(p_app, true);
  delete from redemption_requests
   where id = any(coalesce(p_ids, '{}'::uuid[])) and app = p_app
     and status in ('approved', 'rejected', 'cancelled');
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ------------------------------------------------------------
-- Customers
-- ------------------------------------------------------------
-- Customers who have points activity at this business, newest activity
-- first, with an optional name/phone search.
create or replace function public.loyalty_customers(
  p_app    text,
  p_search text default null,
  p_limit  integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
  v_total integer;
  v_rows jsonb;
begin
  perform loyalty_guard(p_app);

  with active as (
    select t.customer_id,
           sum(t.points_delta) filter (where t.transaction_type = 'earn') as earned,
           max(t.created_at) as last_activity
      from point_transactions t
     where t.app = p_app
     group by t.customer_id
  ), base as (
    select p.id, p.username, p.phone, p.created_at,
           coalesce(w.balance, 0) as balance,
           coalesce(a.earned, 0)  as earned,
           a.last_activity
      from active a
      join profiles p on p.id = a.customer_id and p.role = 'customer'
      left join point_wallets w on w.user_id = p.id and w.app = p_app
     where v_q is null
        or p.username ilike '%' || v_q || '%'
        or p.phone    ilike '%' || v_q || '%'
  )
  select count(*)::int,
         coalesce(jsonb_agg(to_jsonb(b) order by b.last_activity desc nulls last)
                    filter (where b.rn > coalesce(p_offset, 0)
                              and b.rn <= coalesce(p_offset, 0) + greatest(1, least(coalesce(p_limit, 20), 100))),
                  '[]'::jsonb)
    into v_total, v_rows
    from (select base.*, row_number() over (order by last_activity desc nulls last, id) as rn from base) b;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

-- One customer at this business: balance, totals and the last 50 rows.
create or replace function public.loyalty_customer(p_app text, p_customer uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p profiles;
begin
  perform loyalty_guard(p_app);
  select * into v_p from profiles where id = p_customer and role = 'customer';
  if v_p.id is null then
    raise exception 'Customer not found.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_p.id, 'username', v_p.username, 'phone', v_p.phone, 'created_at', v_p.created_at,
    'balance', coalesce((select balance from point_wallets where user_id = v_p.id and app = p_app), 0),
    'earned', coalesce((select sum(points_delta) from point_transactions
                         where customer_id = v_p.id and app = p_app and transaction_type = 'earn'), 0),
    'redeemed', coalesce((select -sum(points_delta) from point_transactions
                           where customer_id = v_p.id and app = p_app and transaction_type = 'redeem'), 0),
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'created_at', t.created_at, 'points_delta', t.points_delta,
               'transaction_type', t.transaction_type, 'hours_played', t.hours_played,
               'note', t.note, 'reward_name', r.name, 'source_session_id', t.source_session_id)
             order by t.created_at desc)
        from (select * from point_transactions
               where customer_id = v_p.id and app = p_app
               order by created_at desc limit 50) t
        left join rewards r on r.id = t.reward_id
    ), '[]'::jsonb)
  );
end $$;

-- Manual correction with a reason; balance may not go below 0.
create or replace function public.loyalty_adjust_points(p_app text, p_customer uuid, p_delta integer, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  perform loyalty_guard(p_app);
  if p_delta is null or p_delta = 0 or abs(p_delta) > 10000 then
    raise exception 'Adjustment must be a whole number between -10,000 and 10,000, not 0.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_reason, '')) = '' or length(p_reason) > 500 then
    raise exception 'A reason is required (up to 500 characters).' using errcode = '22023';
  end if;
  if not exists (select 1 from profiles where id = p_customer and role = 'customer') then
    raise exception 'Customer not found.' using errcode = 'P0002';
  end if;

  begin
    perform add_points_transaction(p_customer, p_delta, 'adjustment', null, null,
                                   btrim(p_reason), auth.uid(), 0, p_app);
  exception when others then
    if sqlerrm = 'insufficient_balance' then
      raise exception 'Adjustment would drive the balance below zero.' using errcode = 'P0001';
    end if;
    raise;
  end;

  return (select balance from point_wallets where user_id = p_customer and app = p_app);
end $$;

-- ------------------------------------------------------------
-- Customer portal: my own sessions at a venue
-- ------------------------------------------------------------
create or replace function public.my_venue_sessions(
  p_app    text,
  p_before timestamptz default null,
  p_limit  integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lim integer := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if v_uid is null then
    raise exception 'Sign in to see your sessions.' using errcode = '42501';
  end if;

  if p_app = 'game' then
    return coalesce((
      select jsonb_agg(j order by played_at desc)
        from (
          select coalesce(s.ended_at, s.created_at) as played_at,
                 jsonb_build_object(
                   'id', s.id, 'played_at', coalesce(s.ended_at, s.created_at),
                   'place', s.station_name, 'paid_minutes', s.charged_minutes,
                   'voided', s.void_reason is not null,
                   'points', coalesce((select sum(points_delta) from point_transactions t
                                        where t.app = 'game' and t.source_session_id = s.id
                                          and t.customer_id = v_uid), 0)) as j
            from game.sessions s
           where s.customer_id = v_uid and s.status = 'closed'
             and (p_before is null or coalesce(s.ended_at, s.created_at) < p_before)
           order by coalesce(s.ended_at, s.created_at) desc
           limit v_lim
        ) x
    ), '[]'::jsonb);
  elsif p_app = 'billiards' then
    return coalesce((
      select jsonb_agg(j order by played_at desc)
        from (
          select coalesce(s.ended_at, s.paid_at, s.started_at) as played_at,
                 jsonb_build_object(
                   'id', s.id, 'played_at', coalesce(s.ended_at, s.paid_at, s.started_at),
                   'place', (select name from billiards.pool_tables pt where pt.id = s.table_id),
                   'paid_minutes', s.billed_minutes,
                   'voided', s.void_reason is not null,
                   'points', coalesce((select sum(points_delta) from point_transactions t
                                        where t.app = 'billiards' and t.source_session_id = s.id
                                          and t.customer_id = v_uid), 0)) as j
            from billiards.sessions s
           where s.customer_id = v_uid and s.status = 'closed'
             and (p_before is null or coalesce(s.ended_at, s.paid_at, s.started_at) < p_before)
           order by coalesce(s.ended_at, s.paid_at, s.started_at) desc
           limit v_lim
        ) x
    ), '[]'::jsonb);
  else
    raise exception 'Unknown business.' using errcode = '22023';
  end if;
end $$;

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.loyalty_rewards(text)',
    'public.loyalty_save_reward(text,uuid,text,text,text,text,integer,integer)',
    'public.loyalty_set_reward_active(text,uuid,boolean)',
    'public.loyalty_delete_reward(text,uuid)',
    'public.loyalty_requests(text,text,integer)',
    'public.loyalty_pending_count(text)',
    'public.loyalty_resolve_request(text,uuid,text,text)',
    'public.loyalty_clear_history(text,uuid[])',
    'public.loyalty_customers(text,text,integer,integer)',
    'public.loyalty_customer(text,uuid)',
    'public.loyalty_adjust_points(text,uuid,integer,text)',
    'public.my_venue_sessions(text,timestamptz,integer)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Audit: log rewards and redemptions under their own business
-- ------------------------------------------------------------
-- Bodies as in audit-catalogue-migration.sql / audit-money-migration.sql;
-- only the business ('futsal' before) changes.
create or replace function public.audit_futsal_rewards()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  d jsonb;
  v_app text := coalesce(new.app, 'futsal');
begin
  if tg_op = 'INSERT' then
    perform public.audit(v_app, 'catalogue.created',
      format('Added reward %s at %s points.', new.name, new.points_cost),
      'reward', new.id::text, new.name,
      jsonb_build_object('points_cost', new.points_cost, 'stock', new.stock),
      new.updated_by);
    return new;
  end if;

  d := public.audit_diff(to_jsonb(old), to_jsonb(new),
                         array['name','name_my','description','description_my',
                               'points_cost','is_active','is_deleted']);
  if d is null then return new; end if;

  if (d ? 'is_deleted') and new.is_deleted = true then
    perform public.audit(v_app, 'catalogue.removed',
      format('Removed reward %s.', new.name),
      'reward', new.id::text, new.name, d, new.updated_by);
  else
    perform public.audit(v_app, 'catalogue.updated',
      format('Changed reward %s: %s', new.name, public.audit_diff_text(d)),
      'reward', new.id::text, new.name, d, new.updated_by);
  end if;
  return new;
end $$;

create or replace function public.audit_redemption_resolved()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_customer text;
  v_reward   text;
begin
  if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
    return new;
  end if;

  select username into v_customer from public.profiles where id = new.customer_id;
  select name     into v_reward   from public.rewards  where id = new.reward_id;

  perform public.audit(
    coalesce(new.app, 'futsal'),
    case when new.status = 'approved' then 'redemption.approved' else 'redemption.rejected' end,
    format('%s %s for %s.',
           case when new.status = 'approved' then 'Approved' else 'Rejected' end,
           coalesce(v_reward, 'a reward'),
           coalesce(v_customer, 'a customer')),
    'redemption', new.id::text, v_reward,
    jsonb_build_object('customer', v_customer, 'reward', v_reward, 'notes', new.notes),
    new.resolved_by
  );
  return new;
end $$;

commit;
