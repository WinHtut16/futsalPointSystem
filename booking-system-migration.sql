-- ============================================================
-- Booking System — Supabase SQL Migration
--
-- Run this in the Supabase SQL editor AFTER all existing
-- migration files (last: point-adjustment-migration.sql).
--
-- Adds the online court-booking feature alongside the existing
-- loyalty/points system. Reuses is_admin() (SECURITY DEFINER)
-- and the add_points_transaction() RPC. Does NOT touch any
-- existing points-system table or policy.
--
-- Contents:
--   1. bookings
--   2. booking_slots (+ active-sync trigger + race-guard index)
--   3. court_closures
--   4. cms_posts
--   5. extend point_transactions.transaction_type ('booking')
--   6. booking ref sequence + create_booking_transaction() RPC
--   7. RLS policies
--   8. Realtime publication
-- ============================================================

-- ── 1. bookings ─────────────────────────────────────────────
create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  ref               text not null unique,
  customer_id       uuid not null references public.profiles(id) on delete cascade,
  booking_date      date not null,
  status            text not null default 'pending'
                      check (status in ('pending','confirmed','cancelled','closed')),
  deposit_total     integer not null,
  price_total       integer not null,
  deposit_received  boolean not null default false,
  points_awarded    integer not null default 0,
  contact_name      text,
  contact_phone     text,
  cancelled_at      timestamptz,
  confirmed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_bookings_date     on public.bookings (booking_date);
create index if not exists idx_bookings_customer on public.bookings (customer_id);
create index if not exists idx_bookings_status   on public.bookings (status);

-- ── 2. booking_slots ────────────────────────────────────────
-- One row per booked hour (a booking holds 1–2). `active` mirrors
-- whether the parent booking still holds the slot (pending/confirmed);
-- it is the column the race-guard partial unique index filters on.
create table if not exists public.booking_slots (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  booking_date  date not null,
  hour_start    smallint not null check (hour_start between 6 and 21),
  tier          text not null check (tier in ('morning','evening','weekend')),
  price         integer not null,
  active        boolean not null default true
);

create index if not exists idx_booking_slots_booking on public.booking_slots (booking_id);

-- Atomic conflict guard: at most one ACTIVE slot per (date, hour).
-- A pending or confirmed booking blocks the slot; cancelling/closing
-- the booking flips active=false (via the trigger below), freeing it.
create unique index if not exists uq_active_slot_per_hour
  on public.booking_slots (booking_date, hour_start)
  where active;

-- Keep booking_slots.active in sync with the parent booking status.
create or replace function public.sync_booking_slots_active()
returns trigger language plpgsql security definer as $$
begin
  if new.status in ('cancelled','closed') then
    update public.booking_slots set active = false where booking_id = new.id and active;
  elsif new.status in ('pending','confirmed') then
    update public.booking_slots set active = true  where booking_id = new.id and not active;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_booking_slots_active on public.bookings;
create trigger trg_sync_booking_slots_active
  after update of status on public.bookings
  for each row execute function public.sync_booking_slots_active();

-- ── 3. court_closures ───────────────────────────────────────
-- Admin-marked closed days or individual slots. Past dates and the
-- Thingyan holiday (Apr 13–16) are computed in code, not stored here.
create table if not exists public.court_closures (
  id            uuid primary key default gen_random_uuid(),
  closure_date  date not null,
  hour_start    smallint check (hour_start between 6 and 21), -- null = whole day
  reason        text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

create index if not exists idx_court_closures_date on public.court_closures (closure_date);
create unique index if not exists uq_closure_date_hour
  on public.court_closures (closure_date, coalesce(hour_start, -1));

-- ── 4. cms_posts ────────────────────────────────────────────
-- News / promotions / league / event posts. Body stored as markdown.
-- Promotions are cms_posts rows with category='promotion' (no separate table).
create table if not exists public.cms_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  category      text not null check (category in ('news','promotion','league','event')),
  title         text not null,
  title_my      text,
  excerpt       text,
  excerpt_my    text,
  body_md       text,
  body_my_md    text,
  cover_url     text,
  published     boolean not null default false,
  published_at  timestamptz,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_cms_published on public.cms_posts (published, published_at desc);
create index if not exists idx_cms_category  on public.cms_posts (category);

-- ── 5. extend point_transactions.transaction_type ───────────
-- Add 'booking' so confirmed-booking points share the existing ledger.
alter table public.point_transactions
  drop constraint if exists point_transactions_transaction_type_check;

alter table public.point_transactions
  add constraint point_transactions_transaction_type_check
    check (transaction_type in ('earn','redeem','adjustment','booking'));

-- ── 6. booking ref + atomic create RPC ──────────────────────
create sequence if not exists public.booking_ref_seq;

-- Inserts a booking + its slots in one transaction and returns the
-- new row. Relies on uq_active_slot_per_hour to reject a slot that
-- was taken concurrently (raises unique_violation → API maps to 409).
-- p_slots: jsonb array of { "hour_start": int, "tier": text, "price": int }
create or replace function public.create_booking_transaction(
  p_customer_id    uuid,
  p_booking_date   date,
  p_slots          jsonb,
  p_contact_name   text,
  p_contact_phone  text
) returns public.bookings language plpgsql security definer as $$
declare
  v_ref          text;
  v_count        integer;
  v_price_total  integer;
  v_booking      public.bookings;
  v_slot         jsonb;
begin
  v_count       := jsonb_array_length(p_slots);
  if v_count < 1 or v_count > 2 then
    raise exception 'A booking must contain 1 or 2 slots (got %).', v_count;
  end if;

  select coalesce(sum((s->>'price')::int), 0)
    into v_price_total
    from jsonb_array_elements(p_slots) as s;

  v_ref := 'MYF-' || to_char(p_booking_date, 'YYYY') || '-'
           || lpad(nextval('public.booking_ref_seq')::text, 4, '0');

  insert into public.bookings (
    ref, customer_id, booking_date, status,
    deposit_total, price_total, contact_name, contact_phone
  ) values (
    v_ref, p_customer_id, p_booking_date, 'pending',
    10000, v_price_total, p_contact_name, p_contact_phone
  ) returning * into v_booking;

  for v_slot in select * from jsonb_array_elements(p_slots)
  loop
    insert into public.booking_slots (booking_id, booking_date, hour_start, tier, price, active)
    values (
      v_booking.id, p_booking_date,
      (v_slot->>'hour_start')::int,
      v_slot->>'tier',
      (v_slot->>'price')::int,
      true
    );
  end loop;

  return v_booking;
end;
$$;

-- ── 7. RLS ──────────────────────────────────────────────────
alter table public.bookings        enable row level security;
alter table public.booking_slots   enable row level security;
alter table public.court_closures  enable row level security;
alter table public.cms_posts       enable row level security;

-- bookings: customers see/insert/cancel their own; admins full access.
-- (Inserts and confirmations actually run through service-role API
--  routes; these policies cover any anon-key reads + customer cancel.)
create policy "bookings_select_own_or_admin"
  on public.bookings for select
  using (auth.uid() = customer_id or is_admin());

create policy "bookings_insert_own"
  on public.bookings for insert
  with check (auth.uid() = customer_id or is_admin());

create policy "bookings_update_own_or_admin"
  on public.bookings for update
  using (auth.uid() = customer_id or is_admin());

-- booking_slots: readable if the parent booking is yours or you are admin.
create policy "booking_slots_select"
  on public.booking_slots for select
  using (
    is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_slots.booking_id and b.customer_id = auth.uid()
    )
  );

-- court_closures: any authenticated user can read (needed to render the
-- calendar); only admins can write.
create policy "closures_select_authenticated"
  on public.court_closures for select
  using (auth.role() = 'authenticated');

create policy "closures_admin_write"
  on public.court_closures for all
  using (is_admin())
  with check (is_admin());

-- cms_posts: anyone can read published posts; admins read all + write.
create policy "cms_select_published"
  on public.cms_posts for select
  using (published = true or is_admin());

create policy "cms_admin_write"
  on public.cms_posts for all
  using (is_admin())
  with check (is_admin());

-- ── 8. Realtime ─────────────────────────────────────────────
-- Live updates for the admin bookings table + customer dashboard
-- (same two-tier pattern as redemption_requests / profiles).
alter table public.bookings replica identity full;
alter publication supabase_realtime add table public.bookings;
