-- Fix infinite recursion in trip_members RLS policy.
-- The old policy queried trip_members to check if the user is a member of a trip,
-- which triggered itself. The fix: a SECURITY DEFINER function that reads
-- trip_members without RLS, used in all membership-check policies.

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = auth.uid()
  )
$$;

-- Drop the recursive policy and replace it
drop policy if exists "trip_members_select" on public.trip_members;

create policy "trip_members_select" on public.trip_members
  for select using (public.is_trip_member(trip_id));

-- Replace all other policies that referenced trip_members via subquery
-- (they triggered trip_members_select → recursion)

drop policy if exists "trips_select_member"       on public.trips;
drop policy if exists "trips_update_admin"        on public.trips;
drop policy if exists "expenses_select_member"    on public.expenses;
drop policy if exists "expenses_insert_member"    on public.expenses;
drop policy if exists "payments_select_member"    on public.payments;
drop policy if exists "invites_select_member"     on public.trip_invites;
drop policy if exists "invites_insert_admin"      on public.trip_invites;
drop policy if exists "users_select_trip_members" on public.users;

create policy "trips_select_member" on public.trips
  for select using (public.is_trip_member(id));

create policy "trips_update_admin" on public.trips
  for update using (
    exists (
      select 1 from public.trip_members
      where trip_id = trips.id and user_id = auth.uid() and role = 'admin'
    )
  );

create policy "expenses_select_member" on public.expenses
  for select using (public.is_trip_member(trip_id));

create policy "expenses_insert_member" on public.expenses
  for insert with check (
    public.is_trip_member(trip_id) and auth.uid() = paid_by
  );

create policy "payments_select_member" on public.payments
  for select using (public.is_trip_member(trip_id));

create policy "invites_select_member" on public.trip_invites
  for select using (public.is_trip_member(trip_id));

create policy "invites_insert_admin" on public.trip_invites
  for insert with check (
    exists (
      select 1 from public.trip_members
      where trip_id = trip_invites.trip_id and user_id = auth.uid() and role = 'admin'
    )
  );

-- Allow members to see each other's user profiles
create or replace function public.share_a_trip(p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.trip_members tm1
    join public.trip_members tm2 on tm1.trip_id = tm2.trip_id
    where tm1.user_id = auth.uid() and tm2.user_id = p_user_id
  )
$$;

create policy "users_select_trip_members" on public.users
  for select using (public.share_a_trip(id));
