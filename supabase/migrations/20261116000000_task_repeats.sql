-- Repeating tasks: a task can repeat every day, on weekdays, every week or every
-- month. Each occurrence is its own row; completing one through complete_task
-- adds the next. Values mirror supabase/functions/_shared/domain/repeat.ts.

-- 1. The rule, the day the pattern is counted from (its weekday or day of the
-- month), and which completed occurrence a row was made from.
alter table public.tasks
  add column if not exists repeat_rule text,
  add column if not exists repeat_anchor date,
  add column if not exists repeat_source_id uuid references public.tasks (id) on delete set null;

alter table public.tasks
  add constraint tasks_repeat_rule_check check (repeat_rule in ('daily', 'weekdays', 'weekly', 'monthly')),
  add constraint tasks_repeat_anchor_with_rule check ((repeat_rule is null) = (repeat_anchor is null));

comment on column public.tasks.repeat_rule is 'daily | weekdays | weekly | monthly; null = does not repeat.';
comment on column public.tasks.repeat_anchor is 'Day the repeat is counted from: weekly keeps its weekday, monthly its day of the month.';
comment on column public.tasks.repeat_source_id is 'The completed occurrence this one was made from; null for the first.';

create index if not exists tasks_repeat_source_id_idx on public.tasks (repeat_source_id);

-- 2. The first day after `after_day` the rule falls on. A month without the
-- anchor's day (31st, 29 Feb) uses its last day.
create or replace function public.next_repeat_date(rule text, anchor date, after_day date)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day date := after_day + 1;
  v_months int;
  v_candidate date;
begin
  case rule
    when 'daily' then
      return v_day;
    when 'weekdays' then
      while extract(isodow from v_day) > 5 loop
        v_day := v_day + 1;
      end loop;
      return v_day;
    when 'weekly' then
      return v_day + ((extract(isodow from anchor)::int - extract(isodow from v_day)::int + 7) % 7);
    when 'monthly' then
      v_months := greatest(0, (extract(year from v_day)::int - extract(year from anchor)::int) * 12
        + extract(month from v_day)::int - extract(month from anchor)::int - 1);
      loop
        v_candidate := (anchor + make_interval(months => v_months))::date;
        exit when v_candidate >= v_day;
        v_months := v_months + 1;
      end loop;
      return v_candidate;
    else
      raise exception 'next_repeat_date: unknown rule %', rule using errcode = '22023';
  end case;
end;
$$;

-- 3. create_task accepts the rule; the anchor is the task's day, else the
-- caller's local today. Everything else is unchanged from 20261115000000_task_time_windows.sql.
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
    'energy_level', 'flexible', 'tags', 'source', 'source_language', 'ai_confidence',
    'repeat_rule', 'repeat_anchor'
  ];
  v_user_id uuid := auth.uid();
  v_unknown_keys text[];
  v_title text;
  v_tags text[];
  v_repeat_rule text := nullif(btrim(draft ->> 'repeat_rule'), '');
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
    flexible, tags, source, source_language, ai_confidence,
    repeat_rule, repeat_anchor
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
    (draft ->> 'ai_confidence')::real,
    v_repeat_rule,
    case when v_repeat_rule is not null
      then coalesce((draft ->> 'repeat_anchor')::date, (draft ->> 'due_date')::date, current_date)
    end
  )
  returning * into v_task;

  return v_task;
end;
$$;

revoke all on function public.create_task(jsonb) from public, anon;
grant execute on function public.create_task(jsonb) to authenticated;

-- 4. The one way to complete a task, for every app (iPhone, Mac, widgets): marks
-- it done and, for a repeating task, adds the next occurrence after the later of
-- its own day and the caller's today, so a missed day never piles up. Completing
-- a task that is already done changes nothing and adds nothing.
-- Returns {"completed": task, "next": task or null}.
create or replace function public.complete_task(task_id uuid, actual_minutes int, local_day date)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_done public.tasks;
  v_next public.tasks;
begin
  if v_user_id is null then
    raise exception 'complete_task: not authenticated' using errcode = '28000';
  end if;
  if local_day is null then
    raise exception 'complete_task: local_day is required' using errcode = '22023';
  end if;

  update public.tasks t
  set status = 'done', actual_minutes = complete_task.actual_minutes, completed_at = now()
  where t.id = complete_task.task_id and t.user_id = v_user_id and t.status <> 'done'
  returning * into v_done;

  if v_done.id is null then
    select * into v_done from public.tasks t where t.id = complete_task.task_id and t.user_id = v_user_id;
    if v_done.id is null then
      raise exception 'complete_task: task not found' using errcode = 'P0002';
    end if;
    return jsonb_build_object('completed', to_jsonb(v_done), 'next', null);
  end if;

  if v_done.repeat_rule is not null then
    insert into public.tasks (
      user_id, title, estimated_minutes, timing, category, scheduled_time,
      window_start, window_end, reminder_minutes_before, due_date, due_kind, notes,
      priority, energy_level, flexible, tags, source, source_language,
      repeat_rule, repeat_anchor, repeat_source_id
    )
    values (
      v_user_id, v_done.title, v_done.estimated_minutes, v_done.timing, v_done.category, v_done.scheduled_time,
      v_done.window_start, v_done.window_end, v_done.reminder_minutes_before,
      public.next_repeat_date(v_done.repeat_rule, v_done.repeat_anchor, greatest(v_done.due_date, local_day)),
      'on', v_done.notes, v_done.priority, v_done.energy_level, v_done.flexible, v_done.tags,
      v_done.source, v_done.source_language,
      v_done.repeat_rule, v_done.repeat_anchor, v_done.id
    )
    returning * into v_next;
  end if;

  -- An unassigned row variable is a row of nulls, so "no next occurrence" is spelled out.
  return jsonb_build_object('completed', to_jsonb(v_done), 'next', case when v_next.id is null then null else to_jsonb(v_next) end);
end;
$$;

revoke all on function public.complete_task(uuid, int, date) from public, anon;
grant execute on function public.complete_task(uuid, int, date) to authenticated;
