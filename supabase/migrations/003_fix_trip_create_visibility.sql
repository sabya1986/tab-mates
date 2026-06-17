-- Fix: trip creator couldn't see their own trip immediately after INSERT.
-- Postgres filters INSERT ... RETURNING through the SELECT policy, and the
-- creator isn't added to trip_members until a second insert that runs after
-- the .select().single() call — so that call got 0 rows and createTrip()
-- returned null, leaving an orphaned trip with no members.

drop policy if exists "trips_select_member" on public.trips;

create policy "trips_select_member" on public.trips
  for select using (
    public.is_trip_member(id) or created_by = auth.uid()
  );
