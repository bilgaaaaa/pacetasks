-- Task time windows: besides a fixed start (scheduled_time, "at 19:30"), a task
-- can be done after a time, before a time, or between two times. Values mirror
-- supabase/functions/_shared/domain/task.ts and taskTime.ts.

-- 1. Window edges as "HH:MM", 24h, like scheduled_time. A task has either a fixed
-- start or a window, never both; a window that has both edges starts first.
alter table public.tasks
  add column if not exists window_start text,
  add column if not exists window_end text;

alter table public.tasks
  add constraint tasks_window_start_format check (window_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add constraint tasks_window_end_format check (window_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add constraint tasks_window_order check (window_start is null or window_end is null or window_start < window_end),
  add constraint tasks_time_or_window check (scheduled_time is null or (window_start is null and window_end is null));

comment on column public.tasks.window_start is 'Earliest time to do the task ("after 20:00"), "HH:MM"; null = no lower edge.';
comment on column public.tasks.window_end is 'Latest time to be done by ("before 18:00"), "HH:MM"; null = no upper edge.';

-- 2. A reminder needs a moment to count back from: the fixed start or the window's start.
alter table public.tasks drop constraint if exists tasks_reminder_needs_time;
alter table public.tasks
  add constraint tasks_reminder_needs_time
    check (reminder_minutes_before is null or scheduled_time is not null or window_start is not null);

-- 3. create_task accepts the window; everything else is unchanged from
-- 20261031000000_task_reminders.sql.
create or replace function public.create_task(draft jsonb)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allowed_keys constant text[] := array[
    'title', 'estimated_minutes', 'timing', 'category', 'scheduled_time',
    'window_start', 'window_end',
    'reminder_minutes_before', 'due_date', 'due_kind', 'notes', 'priority',
    'energy_level', 'flexible', 'tags', 'source', 'source_language', 'ai_confidence'
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
    window_start, window_end,
    reminder_minutes_before, due_date, due_kind, notes, priority, energy_level,
    flexible, tags, source, source_language, ai_confidence
  )
  values (
    v_user_id,
    v_title,
    coalesce((draft ->> 'estimated_minutes')::int, 5),
    coalesce(draft ->> 'timing', 'anytime'),
    nullif(btrim(draft ->> 'category'), ''),
    nullif(btrim(draft ->> 'scheduled_time'), ''),
    nullif(btrim(draft ->> 'window_start'), ''),
    nullif(btrim(draft ->> 'window_end'), ''),
    (draft ->> 'reminder_minutes_before')::smallint,
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
