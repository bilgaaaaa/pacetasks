-- Pace fields: a "someday" task state and a postponed counter. Weekly Reset,
-- the "I didn't do it" rollover and My Pace insights read this history later,
-- so it starts being recorded now. Values mirror supabase/functions/_shared/domain/task.ts.

-- 1. "someday" joins pending/done: parked tasks that stay out of the daily lists.
-- The old status check is dropped by column, not by name, because a project
-- created from the old schema.sql may have named it differently.
do $$
declare
  v_constraint_name text;
begin
  for v_constraint_name in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attname = 'status'
    where c.conrelid = 'public.tasks'::regclass
      and c.contype = 'c'
      and c.conkey = array[a.attnum]
  loop
    execute format('alter table public.tasks drop constraint %I', v_constraint_name);
  end loop;
end;
$$;

alter table public.tasks
  add constraint tasks_status_check check (status in ('pending', 'someday', 'done'));

-- 2. How many times a task's day was pushed later. Existing rows start at 0.
alter table public.tasks
  add column if not exists postponed_count int not null default 0;

alter table public.tasks
  add constraint tasks_postponed_count_check check (postponed_count >= 0);

-- 3. The counter is owned by this trigger, so every caller (app, Siri, Brain
-- Dump, a future rollover) is counted the same way and nobody can set it by hand.
-- A postponement is an unfinished task whose due date moves to a later day.
create or replace function public.track_task_postponement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.postponed_count := 0;
    return new;
  end if;

  new.postponed_count := old.postponed_count;
  if old.status <> 'done' and new.status <> 'done'
     and old.due_date is not null and new.due_date > old.due_date then
    new.postponed_count := old.postponed_count + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_track_postponement on public.tasks;
create trigger tasks_track_postponement
  before insert or update on public.tasks
  for each row execute function public.track_task_postponement();
