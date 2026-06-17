-- Allow any user (including unauthenticated) to read trip_invites by token.
-- The 32-char random hex token IS the secret — possessing it is authorization enough.
-- Without this, a new user trying to join gets "Invalid invite link" because
-- they're not yet a trip member and the existing policy blocks the lookup.

drop policy if exists "invites_select_member" on public.trip_invites;
drop policy if exists "invites_select_by_token" on public.trip_invites;

create policy "invites_select_public" on public.trip_invites
  for select using (true);
