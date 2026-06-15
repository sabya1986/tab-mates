-- Tab Mates — initial schema
-- Run this in your Supabase SQL editor

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null unique,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table public.trips (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  currency    text not null default 'USD',
  status      text not null default 'active' check (status in ('active', 'settled', 'archived')),
  created_by  uuid not null references public.users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table public.trip_members (
  trip_id   uuid not null references public.trips(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.expenses (
  id           uuid primary key default uuid_generate_v4(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  paid_by      uuid not null references public.users(id) on delete restrict,
  description  text not null,
  category     text,
  amount       numeric(12, 2) not null check (amount > 0),
  split_method text not null default 'equal' check (split_method in ('equal', 'exact', 'percentage', 'shares')),
  expense_date date not null default current_date,
  created_at   timestamptz not null default now()
);

create table public.expense_splits (
  id         uuid primary key default uuid_generate_v4(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete restrict,
  amount     numeric(12, 2) not null,
  is_settled boolean not null default false,
  unique (expense_id, user_id)
);

create table public.payments (
  id           uuid primary key default uuid_generate_v4(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  from_user    uuid not null references public.users(id) on delete restrict,
  to_user      uuid not null references public.users(id) on delete restrict,
  amount       numeric(12, 2) not null check (amount > 0),
  note         text,
  payment_date date not null default current_date,
  created_at   timestamptz not null default now(),
  check (from_user <> to_user)
);

create table public.trip_invites (
  id          uuid primary key default uuid_generate_v4(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  created_by  uuid not null references public.users(id) on delete cascade,
  token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  expires_at  timestamptz not null default now() + interval '7 days',
  created_at  timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index on public.trip_members (user_id);
create index on public.expenses (trip_id);
create index on public.expenses (paid_by);
create index on public.expense_splits (expense_id);
create index on public.expense_splits (user_id);
create index on public.payments (trip_id);
create index on public.trip_invites (token);

-- ─── Auto-create user profile on sign up ──────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.users          enable row level security;
alter table public.trips          enable row level security;
alter table public.trip_members   enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;
alter table public.payments       enable row level security;
alter table public.trip_invites   enable row level security;

-- Users: read own profile; update own profile
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_select_trip_members" on public.users
  for select using (
    exists (
      select 1 from public.trip_members tm1
      join public.trip_members tm2 on tm1.trip_id = tm2.trip_id
      where tm1.user_id = auth.uid() and tm2.user_id = users.id
    )
  );

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- Trips: visible to members only
create policy "trips_select_member" on public.trips
  for select using (
    exists (
      select 1 from public.trip_members
      where trip_id = trips.id and user_id = auth.uid()
    )
  );

create policy "trips_insert_authenticated" on public.trips
  for insert with check (auth.uid() = created_by);

create policy "trips_update_admin" on public.trips
  for update using (
    exists (
      select 1 from public.trip_members
      where trip_id = trips.id and user_id = auth.uid() and role = 'admin'
    )
  );

-- Trip members: visible to other members of same trip
create policy "trip_members_select" on public.trip_members
  for select using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_members.trip_id and tm.user_id = auth.uid()
    )
  );

create policy "trip_members_insert_self" on public.trip_members
  for insert with check (auth.uid() = user_id);

-- Expenses: visible to trip members
create policy "expenses_select_member" on public.expenses
  for select using (
    exists (
      select 1 from public.trip_members
      where trip_id = expenses.trip_id and user_id = auth.uid()
    )
  );

create policy "expenses_insert_member" on public.expenses
  for insert with check (
    exists (
      select 1 from public.trip_members
      where trip_id = expenses.trip_id and user_id = auth.uid()
    )
    and auth.uid() = paid_by
  );

create policy "expenses_update_owner" on public.expenses
  for update using (auth.uid() = paid_by);

create policy "expenses_delete_owner" on public.expenses
  for delete using (auth.uid() = paid_by);

-- Expense splits: visible to trip members
create policy "expense_splits_select" on public.expense_splits
  for select using (
    exists (
      select 1 from public.expenses e
      join public.trip_members tm on tm.trip_id = e.trip_id
      where e.id = expense_splits.expense_id and tm.user_id = auth.uid()
    )
  );

create policy "expense_splits_insert_member" on public.expense_splits
  for insert with check (
    exists (
      select 1 from public.expenses e
      join public.trip_members tm on tm.trip_id = e.trip_id
      where e.id = expense_splits.expense_id and tm.user_id = auth.uid()
    )
  );

-- Payments: visible to trip members; insert via Edge Function only
create policy "payments_select_member" on public.payments
  for select using (
    exists (
      select 1 from public.trip_members
      where trip_id = payments.trip_id and user_id = auth.uid()
    )
  );

-- Trip invites: members can read invites for their trips; admins can create
create policy "invites_select_member" on public.trip_invites
  for select using (
    exists (
      select 1 from public.trip_members
      where trip_id = trip_invites.trip_id and user_id = auth.uid()
    )
  );

create policy "invites_insert_admin" on public.trip_invites
  for insert with check (
    exists (
      select 1 from public.trip_members
      where trip_id = trip_invites.trip_id and user_id = auth.uid() and role = 'admin'
    )
  );
