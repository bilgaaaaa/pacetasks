-- Task reminders: a task with a start time can ask for a notification a few
-- minutes before it. The phone schedules the notification itself; the database
-- only stores the choice. Values mirror supabase/functions/_shared/domain/task.ts.

-- 1. Minutes before scheduled_time; null = no reminder. A reminder needs a time.
alter table public.tasks
  add column if not exists reminder_minutes_before smallint;

alter table public.tasks
  add constraint tasks_reminder_minutes_before_range
    check (reminder_minutes_before is null or reminder_minutes_before between 0 and 1440),
  add constraint tasks_reminder_needs_time
    check (reminder_minutes_before is null or scheduled_time is not null);

-- 2. create_task accepts the new field; everything else is unchanged from
-- 20260928000100_task_foundation.sql.
create or replace function public.create_task(draft jsonb)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allowed_keys constant text[] := array[
    'title', 'estimated_minutes', 'timing', 'category', 'scheduled_time',
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

-- 3. Open tasks that already have a start time keep the heads-up they had
-- before reminders became per task: 10 minutes before.
update public.tasks
  set reminder_minutes_before = 10
  where status = 'pending' and scheduled_time is not null and reminder_minutes_before is null;
