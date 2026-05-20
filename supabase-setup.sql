-- ============================================================
-- AkoATP Point System — Supabase SQL Setup
-- Run these statements in order in the Supabase SQL Editor
-- ============================================================

-- 1. Profiles table
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  phone         varchar(20) not null unique,
  username      varchar(50) not null,
  role          text not null default 'customer' check (role in ('customer', 'admin')),
  total_points  integer not null default 0,
  created_at    timestamptz not null default now()
);

-- 2. Rewards catalog
create table public.rewards (
  id           uuid primary key default gen_random_uuid(),
  name         varchar(100) not null,
  description  text,
  points_cost  integer not null,
  stock        integer,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 3. Point transactions ledger
create table public.point_transactions (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.profiles(id) on delete cascade,
  points_delta      integer not null,
  transaction_type  text not null check (transaction_type in ('earn', 'redeem')),
  hours_played      numeric(4,2),
  reward_id         uuid references public.rewards(id),
  note              text,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);

-- 4. Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, phone, username, role)
  values (
    new.id,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'username',
    'customer'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 5. Atomic add-points function
create or replace function add_points_transaction(
  p_customer_id     uuid,
  p_points_delta    integer,
  p_transaction_type text,
  p_hours_played    numeric,
  p_reward_id       uuid,
  p_note            text,
  p_created_by      uuid
) returns void language plpgsql security definer as $$
begin
  insert into point_transactions (
    customer_id, points_delta, transaction_type,
    hours_played, reward_id, note, created_by
  ) values (
    p_customer_id, p_points_delta, p_transaction_type,
    p_hours_played, p_reward_id, p_note, p_created_by
  );

  update profiles
    set total_points = total_points + p_points_delta
  where id = p_customer_id;
end;
$$;

-- 6. Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.rewards enable row level security;
alter table public.point_transactions enable row level security;

-- 7. RLS policies for profiles
create policy "customers: own profile"
  on profiles for all
  using (auth.uid() = id);

create policy "admins: read all profiles"
  on profiles for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admins: update any profile"
  on profiles for update
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 8. RLS policies for point_transactions
create policy "customers: own transactions"
  on point_transactions for select
  using (auth.uid() = customer_id);

create policy "admins: all transactions"
  on point_transactions for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 9. RLS policies for rewards
create policy "authenticated: read active rewards"
  on rewards for select
  using (auth.role() = 'authenticated' and is_active = true);

create policy "admins: read all rewards"
  on rewards for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admins: manage rewards"
  on rewards for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- After deploying: promote first admin user
-- Update the phone number below to your admin's phone
-- ============================================================
-- update profiles set role = 'admin' where phone = '09XXXXXXXXX';
