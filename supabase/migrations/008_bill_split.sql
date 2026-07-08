-- Tab Mates — T-Mobile bill split feature
-- Run this in your Supabase SQL editor
-- Standalone feature, not tied to trips. Gated in the app + Edge Functions to a
-- single allow-listed user email (see lib/featureFlags.ts), but every table is
-- also scoped by created_by so RLS holds even if the allow-list is extended later.

-- Phone number -> person mapping, remembered across billing periods (mirrors
-- the skill's associations.json).
create table public.bill_split_associations (
  user_id      uuid not null references public.users(id) on delete cascade,
  phone_number text not null,
  person_name  text not null,
  email        text,
  line_type    text not null check (line_type in ('voice', 'data', 'wearable')),
  updated_at   timestamptz not null default now(),
  primary key (user_id, phone_number)
);

-- One row per computed & (eventually) emailed bill split.
create table public.bill_splits (
  id              uuid primary key default uuid_generate_v4(),
  created_by      uuid not null references public.users(id) on delete cascade,
  billing_period  text not null,
  bill_total      numeric(10, 2),
  computed_total  numeric(10, 2) not null,
  reconciled      boolean not null default false,
  raw_input       jsonb not null,
  created_at      timestamptz not null default now()
);

-- Per-person share of a bill split, and whether/when their email went out.
create table public.bill_split_shares (
  id             uuid primary key default uuid_generate_v4(),
  bill_split_id  uuid not null references public.bill_splits(id) on delete cascade,
  person_name    text not null,
  email          text not null,
  lines_desc     text not null,
  line_subtotal  numeric(10, 2) not null,
  account_share  numeric(10, 2) not null,
  amount_total   numeric(10, 2) not null,
  sent_at        timestamptz,
  send_error     text
);

create index on public.bill_split_shares (bill_split_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.bill_split_associations enable row level security;
alter table public.bill_splits              enable row level security;
alter table public.bill_split_shares        enable row level security;

create policy "bill_split_associations_owner" on public.bill_split_associations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bill_splits_owner" on public.bill_splits
  for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

create policy "bill_split_shares_owner" on public.bill_split_shares
  for all using (
    exists (
      select 1 from public.bill_splits
      where id = bill_split_shares.bill_split_id and created_by = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.bill_splits
      where id = bill_split_shares.bill_split_id and created_by = auth.uid()
    )
  );
