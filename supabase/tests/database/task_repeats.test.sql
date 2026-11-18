-- pgTAP tests for repeating tasks and complete_task. Run with `npm run db:test` (needs `npx supabase start`).
begin;
select plan(14);

insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Next dates
select is(public.next_repeat_date('weekdays', '2026-11-16', '2026-11-20'), '2026-11-23'::date, 'weekdays skip the weekend');
select is(public.next_repeat_date('weekly', '2026-11-16', '2026-11-18'), '2026-11-23'::date, 'weekly keeps the anchor''s weekday');
select is(public.next_repeat_date('monthly', '2026-01-31', '2026-01-31'), '2026-02-28'::date, 'a short month uses its last day');
select is(public.next_repeat_date('monthly', '2026-01-31', '2026-02-28'), '2026-03-31'::date, 'and the next month is back on the 31st');

-- Creating
select is(
  (select repeat_anchor from public.create_task('{"title": "walk bruno", "due_date": "2026-11-16", "due_kind": "on", "repeat_rule": "daily"}')),
  '2026-11-16'::date,
  'a repeating task is anchored on its day'
);
select throws_ok(
  $$ select public.create_task('{"title": "x", "repeat_rule": "yearly"}') $$,
  '23514', null, 'rejects an unknown rule'
);
select throws_ok(
  $$ insert into public.tasks (user_id, title, repeat_rule) values ('11111111-1111-1111-1111-111111111111', 'no anchor', 'daily') $$,
  '23514', null, 'a rule needs an anchor'
);

-- Completing
select is(
  (select (public.complete_task(id, 20, '2026-11-16') -> 'next' ->> 'due_date') from public.tasks where title = 'walk bruno'),
  '2026-11-17',
  'completing a daily task adds tomorrow''s'
);
select is(
  (select count(*)::int from public.tasks where title = 'walk bruno' and status = 'pending' and repeat_source_id is not null),
  1,
  'the next occurrence is pending and points to the completed one'
);
select is(
  (select actual_minutes from public.tasks where title = 'walk bruno' and status = 'done'),
  20,
  'the real minutes are saved'
);
select is(
  (select public.complete_task(id, 20, '2026-11-16') -> 'next' from public.tasks where title = 'walk bruno' and status = 'done'),
  'null'::jsonb,
  'completing it again adds nothing'
);

select public.create_task('{"title": "pay rent", "due_date": "2026-11-10", "due_kind": "on", "repeat_rule": "daily"}');
select is(
  (select (public.complete_task(id, null, '2026-11-16') -> 'next' ->> 'due_date') from public.tasks where title = 'pay rent'),
  '2026-11-17',
  'a missed occurrence continues after today, so missed days never pile up'
);

select public.create_task('{"title": "call mum", "due_date": "2026-11-16", "due_kind": "on"}');
select is(
  (select public.complete_task(id, 5, '2026-11-16') -> 'next' from public.tasks where title = 'call mum'),
  'null'::jsonb,
  'a task that doesn''t repeat adds nothing'
);

-- Another user's task is not theirs to complete.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$ select public.complete_task((select id from public.tasks where title = 'pay rent' limit 1), null, '2026-11-16') $$,
  'P0002', null, 'cannot complete someone else''s task'
);

select * from finish();
rollback;
