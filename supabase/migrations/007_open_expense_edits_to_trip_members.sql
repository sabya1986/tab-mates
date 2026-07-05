-- Lets any trip member add, edit, or delete an expense regardless of who
-- paid for it (matching Splitwise-style shared bookkeeping, e.g. one person
-- entering a receipt on behalf of the group). Previously only the recorded
-- payer could insert/update/delete their own expense.
--
-- Also adds missing update/delete policies on expense_splits: updateExpense()
-- deletes and reinserts splits on every edit, but no delete policy existed,
-- so that delete silently affected 0 rows and left stale split rows behind.

drop policy if exists "expenses_insert_member" on public.expenses;
create policy "expenses_insert_member" on public.expenses
  for insert with check (
    exists (
      select 1 from public.trip_members
      where trip_id = expenses.trip_id and user_id = auth.uid()
    )
  );

drop policy if exists "expenses_update_owner" on public.expenses;
create policy "expenses_update_member" on public.expenses
  for update using (
    exists (
      select 1 from public.trip_members
      where trip_id = expenses.trip_id and user_id = auth.uid()
    )
  );

drop policy if exists "expenses_delete_owner" on public.expenses;
create policy "expenses_delete_member" on public.expenses
  for delete using (
    exists (
      select 1 from public.trip_members
      where trip_id = expenses.trip_id and user_id = auth.uid()
    )
  );

create policy "expense_splits_update_member" on public.expense_splits
  for update using (
    exists (
      select 1 from public.expenses e
      join public.trip_members tm on tm.trip_id = e.trip_id
      where e.id = expense_splits.expense_id and tm.user_id = auth.uid()
    )
  );

create policy "expense_splits_delete_member" on public.expense_splits
  for delete using (
    exists (
      select 1 from public.expenses e
      join public.trip_members tm on tm.trip_id = e.trip_id
      where e.id = expense_splits.expense_id and tm.user_id = auth.uid()
    )
  );
