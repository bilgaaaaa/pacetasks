-- Task foundation: the fields AI Brain Dump and Siri need, one server-side task
-- creation path (create_task) for every caller, and Realtime on tasks.

-- 1. New task fields. All nullable or defaulted, so existing rows stay valid.
alter table public.tasks
  add column if not exists due_date date,
  add column if not exists due_kind text,
  add column if not exists notes text,
  add column if not exists priority text,
  add column if not exists energy_level text,
  add column if not exists flexible boolean not null default false,
  add column if not exists tags text[] not null default '{}',
  add column if not exists source text not null default 'app',
  add column if not exists source_language text,
  add column if not exists ai_confidence real;

-- 2. Value rules. Enum values mirror supabase/functions/_shared/domain/task.ts.
alter table public.tasks
  add constraint tasks_due_kind_check check (due_kind in ('on', 'by')),
  add constraint tasks_due_kind_requires_date check (due_kind is null or due_date is not null),
  add constraint tasks_notes_length check (char_length(notes) <= 2000),
  add constraint tasks_priority_check check (priority in ('low', 'medium', 'high')),
  add constraint tasks_energy_level_check check (energy_level in ('low', 'medium', 'high')),
  add constraint tasks_tags_count check (cardinality(tags) <= 20),
  add constraint tasks_source_check check (source in ('app', 'brain_dump', 'siri', 'shortcut')),
  add constraint tasks_source_language_check check (source_language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  add constraint tasks_ai_confidence_check check (ai_confidence between 0 and 1);

-- Rules for pre-existing columns only apply to new/updated rows (NOT VALID),
-- so a legacy row can never block this migration.
alter table public.tasks
  add constraint tasks_title_length check (char_length(title) between 1 and 200) not valid,
  add constraint tasks_estimated_minutes_range check (estimated_minutes between 1 and 480) not valid,
  add constraint tasks_scheduled_time_format check (scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') not valid;

-- 3. "Today" and Siri lookups filter pending tasks by owner and due date.
create index if not exists tasks_user_status_due_idx on public.tasks (user_id, status, due_date);

-- 4. The single task creation path. Runs as the calling user (security invoker),
-- so RLS still applies and user_id always comes from the JWT, never from input.
create or replace function public.create_task(draft jsonb)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allowed_keys constant text[] := array[
    'title', 'estimated_minutes', 'timing', 'category', 'scheduled_time',
    'due_date', 'due_kind', 'notes', 'priority', 'energy_level', 'flexible',
    'tags', 'source', 'source_language', 'ai_confidence'
  ];
  v_user_id uuid := auth.uid();
  v_unknown_keys text[];
  v_title text;
  v_tags text[];
  v_task public.tasks;
begin
  if v_user_id is null then
    raise exception 'create_task: not authenticated' using errcode = '28000';
  end if;

  if draft is null or jsonb_typeof(draft) <> 'object' then
    raise exception 'create_task: draft must be a JSON object' using errcode = '22023';
  end if;

  -- Unknown keys are rejected so a typo or a smuggled user_id fails loudly.
  select array_agg(k) into v_unknown_keys
  from jsonb_object_keys(draft) as k
  where k <> all (allowed_keys);
  if v_unknown_keys is not null then
    raise exception 'create_task: unknown fields %', v_unknown_keys using errcode = '22023';
  end if;

  v_title := btrim(coalesce(draft ->> 'title', ''));
  if v_title = '' then
    raise exception 'create_task: title is required' using errcode = '22023';
  end if;

  if draft ? 'tags' and jsonb_typeof(draft -> 'tags') not in ('array', 'null') then
    raise exception 'create_task: tags must be an array' using errcode = '22023';
  end if;

  -- Trim tags and drop empty/duplicate ones, keeping the caller's order.
  select coalesce(array_agg(tag order by first_pos), '{}') into v_tags
  from (
    select btrim(t.value) as tag, min(t.pos) as first_pos
    from jsonb_array_elements_text(
      case when jsonb_typeof(draft -> 'tags') = 'array' then draft -> 'tags' else '[]'::jsonb end
    ) with ordinality as t(value, pos)
    where btrim(t.value) <> ''
    group by btrim(t.value)
  ) as cleaned;

  insert into public.tasks (
    user_id, title, estimated_minutes, timing, category, scheduled_time,
    due_date, due_kind, notes, priority, energy_level, flexible, tags,
    source, source_language, ai_confidence
  )
  values (
    v_user_id,
    v_title,
    coalesce((draft ->> 'estimated_minutes')::int, 5),
    coalesce(draft ->> 'timing', 'anytime'),
    nullif(btrim(draft ->> 'category'), ''),
    nullif(btrim(draft ->> 'scheduled_time'), ''),
    (draft ->> 'due_date')::date,
    draft ->> 'due_kind',
    nullif(btrim(draft ->> 'notes'), ''),
    draft ->> 'priority',
    draft ->> 'energy_level',
    coalesce((draft ->> 'flexible')::boolean, false),
    v_tags,
    coalesce(draft ->> 'source', 'app'),
    draft ->> 'source_language',
    (draft ->> 'ai_confidence')::real
  )
  returning * into v_task;

  return v_task;
end;
$$;

revoke all on function public.create_task(jsonb) from public, anon;
grant execute on function public.create_task(jsonb) to authenticated;

-- 5. Realtime on tasks, so changes from Siri/Brain Dump show up in an open app.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
     ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end;
$$;
