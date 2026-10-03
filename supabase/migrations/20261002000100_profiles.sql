-- Accounts: the name a user signs up with and their email-marketing consent.
-- The email itself lives only in auth.users (one source of truth); a server job
-- that sends emails later joins it from there. Limits mirror
-- supabase/functions/_shared/domain/account.ts.

create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 50),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 50),
  marketing_opt_in boolean not null default false, -- never true unless the user switched it on
  marketing_opt_in_at timestamptz, -- when consent was given; kept by the trigger below
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A profile belongs to a verified account: anonymous sessions can't create or change one.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (
    auth.uid() = user_id and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- Deleting a profile on its own is not offered; it goes when the account is deleted.
revoke delete on public.profiles from anon, authenticated;

-- Keeps the consent record honest: the timestamp is set when consent is given,
-- cleared when it is withdrawn, and can't be written by the client.
create or replace function public.stamp_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.first_name := btrim(new.first_name);
  new.last_name := btrim(new.last_name);
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.marketing_opt_in_at := case when new.marketing_opt_in then now() end;
  elsif new.marketing_opt_in and not old.marketing_opt_in then
    new.marketing_opt_in_at := now();
  elsif not new.marketing_opt_in then
    new.marketing_opt_in_at := null;
  else
    new.marketing_opt_in_at := old.marketing_opt_in_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_stamp on public.profiles;
create trigger profiles_stamp
  before insert or update on public.profiles
  for each row execute function public.stamp_profile();
