-- AI Brain Dump: proposal sessions, per-user AI quota, commit/discard RPCs,
-- the auto-create setting, and a 30-day purge of raw brain dump text.

-- 1. Setting that lets high-confidence brain dumps create tasks without review.
alter table public.user_settings
  add column if not exists brain_dump_auto_create boolean not null default false;

-- 2. One row per brain dump: the validated proposal shown for review, and which
-- tasks it produced once committed. Lets Siri hand off to review in the app later.
create table if not exists public.brain_dump_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'proposed' check (status in ('proposed', 'committed', 'discarded')),
  channel text not null check (channel in ('app', 'siri', 'shortcut')),
  raw_text text check (char_length(raw_text) <= 2000), -- nulled after 30 days, see purge below
  time_zone text not null,
  proposal jsonb not null, -- normalized candidates, never raw model output
  ai_provider text not null,
  ai_model text not null,
  prompt_version text not null,
  input_tokens int,
  output_tokens int,
  committed_task_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create index if not exists brain_dump_sessions_user_created_idx
  on public.brain_dump_sessions (user_id, created_at desc);

-- Owners can read and create their sessions; status changes only go through the RPCs below.
alter table public.brain_dump_sessions enable row level security;

drop policy if exists "brain_dump_sessions_select_own" on public.brain_dump_sessions;
create policy "brain_dump_sessions_select_own" on public.brain_dump_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "brain_dump_sessions_insert_own" on public.brain_dump_sessions;
create policy "brain_dump_sessions_insert_own" on public.brain_dump_sessions
  for insert with check (auth.uid() = user_id and status = 'proposed');

revoke update, delete on public.brain_dump_sessions from anon, authenticated;

-- 3. Daily AI usage per user and feature, used by Edge Functions to enforce quotas.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('brain_dump')),
  usage_date date not null default current_date,
  request_count int not null default 0,
  primary key (user_id, feature, usage_date)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.ai_usage from anon, authenticated;

-- Counts one AI request for the caller and returns today's total. Security definer
-- because users can't write ai_usage directly, so they can't reset their own quota.
create or replace function public.increment_ai_usage(feature text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count int;
begin
  if v_user_id is null then
    raise exception 'increment_ai_usage: not authenticated' using errcode = '28000';
  end if;

  insert into public.ai_usage as u (user_id, feature, usage_date, request_count)
  values (v_user_id, increment_ai_usage.feature, current_date, 1)
  on conflict on constraint ai_usage_pkey
  do update set request_count = u.request_count + 1
  returning u.request_count into v_count;

  return v_count;
end;
$$;

-- 4. Creates the reviewed tasks of a proposed session through create_task, in one
-- transaction. Safe to retry: a committed session returns its existing tasks.
create or replace function public.commit_brain_dump(session_id uuid, drafts jsonb)
returns setof public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.brain_dump_sessions;
  v_draft jsonb;
  v_task public.tasks;
  v_task_ids uuid[] := '{}';
begin
  if v_user_id is null then
    raise exception 'commit_brain_dump: not authenticated' using errcode = '28000';
  end if;

  select * into v_session
  from public.brain_dump_sessions s
  where s.id = commit_brain_dump.session_id and s.user_id = v_user_id
  for update;

  if not found then
    raise exception 'commit_brain_dump: session not found' using errcode = 'P0002';
  end if;

  if v_session.status = 'committed' then
    return query
      select t.* from public.tasks t
      where t.id = any (v_session.committed_task_ids) and t.user_id = v_user_id
      order by t.created_at;
    return;
  end if;

  if v_session.status <> 'proposed' then
    raise exception 'commit_brain_dump: session was discarded' using errcode = '22023';
  end if;

  if drafts is null or jsonb_typeof(drafts) <> 'array'
     or jsonb_array_length(drafts) not between 1 and 25 then
    raise exception 'commit_brain_dump: drafts must be an array of 1-25 tasks' using errcode = '22023';
  end if;

  for v_draft in select d.value from jsonb_array_elements(drafts) as d(value) loop
    v_task := public.create_task(v_draft);
    v_task_ids := v_task_ids || v_task.id;
    return next v_task;
  end loop;

  update public.brain_dump_sessions
  set status = 'committed', committed_task_ids = v_task_ids, committed_at = now()
  where id = v_session.id;
end;
$$;

-- 5. Marks a proposed session as discarded (the user dismissed the review).
create or replace function public.discard_brain_dump(session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'discard_brain_dump: not authenticated' using errcode = '28000';
  end if;

  update public.brain_dump_sessions
  set status = 'discarded'
  where id = discard_brain_dump.session_id and user_id = auth.uid() and status = 'proposed';

  if not found then
    raise exception 'discard_brain_dump: no proposed session with that id' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.increment_ai_usage(text) from public, anon;
revoke all on function public.commit_brain_dump(uuid, jsonb) from public, anon;
revoke all on function public.discard_brain_dump(uuid) from public, anon;
grant execute on function public.increment_ai_usage(text) to authenticated;
grant execute on function public.commit_brain_dump(uuid, jsonb) to authenticated;
grant execute on function public.discard_brain_dump(uuid) to authenticated;

-- 6. Privacy: raw brain dump text is kept 30 days, then removed (the proposal stays).
create or replace function public.purge_brain_dump_raw_text()
returns int
language sql
security definer
set search_path = ''
as $$
  with purged as (
    update public.brain_dump_sessions
    set raw_text = null
    where raw_text is not null and created_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::int from purged;
$$;

revoke all on function public.purge_brain_dump_raw_text() from public, anon, authenticated;

-- Runs the purge nightly where pg_cron is available (Supabase hosted and local stack).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'purge-brain-dump-raw-text',
      '17 3 * * *',
      'select public.purge_brain_dump_raw_text()'
    );
  end if;
end;
$$;
