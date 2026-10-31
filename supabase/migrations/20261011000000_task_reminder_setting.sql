-- Reminders: a second switch next to the daily check-in (reminder_enabled /
-- reminder_time), for the heads-up shortly before a task with a fixed start time.
alter table public.user_settings
  add column if not exists task_reminder_enabled boolean not null default true;

comment on column public.user_settings.task_reminder_enabled is
  'Remind shortly before a task with a scheduled_time. Scheduled on the phone, never sent by the server.';
