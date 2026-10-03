-- Bringing a task back from Someday is a fresh start: its postponed counter goes
-- back to 0. Without this a task parked for being "moved several times" would be
-- proposed for Someday again the first time it slips. Replaces the trigger
-- function from 20261001000000_task_pace_fields.sql; the trigger itself is unchanged.
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

  -- The counter is owned here: whatever a caller sends for it is discarded.
  new.postponed_count := old.postponed_count;
  if old.status = 'someday' and new.status = 'pending' then
    new.postponed_count := 0;
  elsif old.status <> 'done' and new.status <> 'done'
     and old.due_date is not null and new.due_date > old.due_date then
    new.postponed_count := old.postponed_count + 1;
  end if;
  return new;
end;
$$;
