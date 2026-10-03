-- Account deletion: lets a user erase themselves from inside the app (required by
-- the App Store for any app that offers sign-up, and by GDPR's right to erasure).
-- Every table with user data references auth.users with "on delete cascade", so
-- removing the user removes their tasks, settings, profile, brain dumps and AI usage.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'delete_account: not authenticated' using errcode = '28000';
  end if;

  -- Only ever the caller's own user: the id comes from the session, never from an argument.
  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
