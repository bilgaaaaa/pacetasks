-- PaceTasks Pro: the server's copy of each user's subscription, mirrored from
-- RevenueCat (which validates the App Store receipts). Only Edge Functions holding
-- the service role write it; users can read their own row and ask is_pro().

create table if not exists public.pro_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  product_id text not null, -- App Store product, e.g. pacetasks_pro_yearly
  period_type text not null check (period_type in ('trial', 'intro', 'normal')),
  expires_at timestamptz, -- null = never expires
  will_renew boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.pro_entitlements enable row level security;

drop policy if exists "pro_entitlements_select_own" on public.pro_entitlements;
create policy "pro_entitlements_select_own" on public.pro_entitlements
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.pro_entitlements from anon, authenticated;

-- True while the caller has an active Pro subscription (trial included).
-- Edge Functions call it with the user's own JWT before running a Pro feature.
create or replace function public.is_pro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pro_entitlements e
    where e.user_id = auth.uid()
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

revoke all on function public.is_pro() from public, anon;
grant execute on function public.is_pro() to authenticated;
