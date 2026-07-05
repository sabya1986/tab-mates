-- Lets a trip use group-wide debt simplification (minimum number of payments
-- to settle everyone up) instead of showing every pairwise debt as-is.
-- Chosen once at trip creation; not editable afterward (yet).

alter table public.trips
  add column simplify_debts boolean not null default false;
