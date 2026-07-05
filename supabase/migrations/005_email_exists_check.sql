-- Lets the (unauthenticated) login screen check whether an email already has
-- an account, so it can skip asking for a display name on the invite-join
-- flow for returning users. Returns only a boolean — never exposes the
-- matched user's row — so it's safe to grant to anon.

create or replace function public.user_exists_with_email(check_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users where lower(email) = lower(check_email)
  );
$$;

grant execute on function public.user_exists_with_email(text) to anon, authenticated;
