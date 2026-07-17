-- Tracks who created/last edited an expense, and keeps a snapshot of every
-- prior version so edits are auditable after the fact. Needed because
-- migration 007 lets any trip member edit or delete any expense, and there
-- was previously no way to tell an original amount from an edited one.

alter table public.expenses
  add column created_by uuid references public.users(id) on delete restrict,
  add column updated_by uuid references public.users(id) on delete restrict,
  add column updated_at timestamptz not null default now();

-- Backfill: best guess for existing rows is the recorded payer, and treat
-- them as never-edited (updated_at = created_at).
update public.expenses
  set created_by = paid_by, updated_by = paid_by, updated_at = created_at
  where created_by is null;

alter table public.expenses
  alter column created_by set not null,
  alter column updated_by set not null;

create index on public.expenses (updated_at);

-- One row per prior version of an expense, written right before an update
-- overwrites it.
create table public.expense_history (
  id            uuid primary key default uuid_generate_v4(),
  expense_id    uuid not null references public.expenses(id) on delete cascade,
  description   text not null,
  category      text,
  amount        numeric(12, 2) not null,
  paid_by       uuid not null references public.users(id) on delete restrict,
  split_method  text not null,
  expense_date  date not null,
  changed_by    uuid not null references public.users(id) on delete restrict,
  changed_at    timestamptz not null default now()
);

create index on public.expense_history (expense_id);

alter table public.expense_history enable row level security;

create policy "expense_history_select_member" on public.expense_history
  for select using (
    exists (
      select 1 from public.expenses e
      join public.trip_members tm on tm.trip_id = e.trip_id
      where e.id = expense_history.expense_id and tm.user_id = auth.uid()
    )
  );
-- No insert/update/delete policies: only the trigger below (security definer)
-- writes to this table, so clients can't tamper with history directly.

-- On insert, stamp created_by/updated_by/updated_at from the acting user
-- (ignoring whatever the client sent) so they can't be spoofed. On update,
-- snapshot the pre-change row into expense_history, then re-stamp
-- updated_by/updated_at and force created_by/created_at to stay immutable.
create or replace function public.handle_expense_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    new.updated_at := now();
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.expense_history (
      expense_id, description, category, amount, paid_by, split_method, expense_date, changed_by, changed_at
    ) values (
      old.id, old.description, old.category, old.amount, old.paid_by, old.split_method, old.expense_date, auth.uid(), now()
    );
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := auth.uid();
    new.updated_at := now();
    return new;
  end if;
  return new;
end;
$$;

create trigger expenses_audit
  before insert or update on public.expenses
  for each row execute function public.handle_expense_audit();
