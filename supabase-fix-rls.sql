-- ============================================================
-- Fix: infinite recursion in RLS policies
-- The original admin policies queried `profiles` FROM WITHIN
-- a profiles policy, causing infinite recursion.
-- Solution: security definer function bypasses RLS when checking role.
-- ============================================================

-- 1. Create a security definer helper (bypasses RLS — no recursion)
create or replace function is_admin()
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  )
$$;

-- 2. Drop all old policies
drop policy if exists "customers: own profile"          on profiles;
drop policy if exists "admins: read all profiles"       on profiles;
drop policy if exists "admins: update any profile"      on profiles;
drop policy if exists "customers: own transactions"     on point_transactions;
drop policy if exists "admins: all transactions"        on point_transactions;
drop policy if exists "authenticated: read active rewards" on rewards;
drop policy if exists "admins: read all rewards"        on rewards;
drop policy if exists "admins: manage rewards"          on rewards;

-- 3. Profiles policies (no recursion — is_admin() uses security definer)
create policy "profiles_select"
  on profiles for select
  using (auth.uid() = id or is_admin());

create policy "profiles_insert"
  on profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update"
  on profiles for update
  using (auth.uid() = id or is_admin());

create policy "profiles_delete"
  on profiles for delete
  using (is_admin());

-- 4. Point transactions policies
create policy "transactions_select"
  on point_transactions for select
  using (auth.uid() = customer_id or is_admin());

create policy "transactions_insert"
  on point_transactions for insert
  with check (is_admin() or auth.uid() = customer_id);

create policy "transactions_update"
  on point_transactions for update
  using (is_admin());

create policy "transactions_delete"
  on point_transactions for delete
  using (is_admin());

-- 5. Rewards policies
create policy "rewards_select"
  on rewards for select
  using (is_active = true or is_admin());

create policy "rewards_insert"
  on rewards for insert
  with check (is_admin());

create policy "rewards_update"
  on rewards for update
  using (is_admin());

create policy "rewards_delete"
  on rewards for delete
  using (is_admin());
