-- PaceTasks database schema.
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Already have a "tasks"/"user_settings" table from an earlier version? Just run these instead:
--   alter table public.tasks add column if not exists category text;
--   alter table public.tasks add column if not exists scheduled_time text;
--   alter table public.user_settings add column if not exists timer_chime_enabled boolean not null default true;
--   alter table public.user_settings add column if not exists haptics_enabled boolean not null default false;
--   alter table public.user_settings add column if not exists pomodoro_work_minutes int not null default 25;
--   alter table public.user_settings add column if not exists pomodoro_break_minutes int not null default 5;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  estimated_minutes int not null default 5,
  actual_minutes int,
  timing text not null default 'anytime' check (timing in ('before_work', 'after_work', 'anytime')),
  category text,
  scheduled_time text,
  status text not null default 'pending' check (status in ('pending', 'done')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  work_start_hour int not null default 9 check (work_start_hour between 0 and 23),
  work_end_hour int not null default 17 check (work_end_hour between 0 and 23),
  reminder_enabled boolean not null default true,
  reminder_time text not null default '18:30',
  timer_chime_enabled boolean not null default true,
  haptics_enabled boolean not null default false,
  pomodoro_work_minutes int not null default 25,
  pomodoro_break_minutes int not null default 5,
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);

drop policy if exists "settings_select_own" on public.user_settings;
create policy "settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);

drop policy if exists "settings_upsert_own" on public.user_settings;
create policy "settings_upsert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "settings_update_own" on public.user_settings;
create policy "settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id);
