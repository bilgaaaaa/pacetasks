-- pgTAP tests for the "someday" state and the postponed counter. Run with `npm run db:test` (needs `npx supabase start`).
begin;
select plan(9);

insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Someday state
insert into public.tasks (user_id, title) values ('11111111-1111-1111-1111-111111111111', 'learn spanish');
select lives_ok(
  $$ update public.tasks set status = 'someday' where title = 'learn spanish' $$,
  'a task can be parked as someday'
);
select throws_ok(
  $$ update public.tasks set status = 'later' where title = 'learn spanish' $$,
  '23514', null, 'rejects an unknown status'
);

-- Postponed counter
select is(
  (select postponed_count from public.create_task('{"title": "call bank", "due_date": "2026-10-01", "due_kind": "on"}')),
  0,
  'a new task starts with no postponements'
);

insert into public.tasks (user_id, title, postponed_count)
values ('11111111-1111-1111-1111-111111111111', 'smuggled counter', 7);
select is(
  (select postponed_count from public.tasks where title = 'smuggled counter'),
  0,
  'the counter cannot be set on insert'
);

update public.tasks set due_date = '2026-10-03' where title = 'call bank';
select is(
  (select postponed_count from public.tasks where title = 'call bank'),
  1,
  'moving the due date later counts as a postponement'
);

update public.tasks set due_date = '2026-10-02' where title = 'call bank';
select is(
  (select postponed_count from public.tasks where title = 'call bank'),
  1,
  'moving the due date earlier is not a postponement'
);

update public.tasks set postponed_count = 0, notes = 'ask about the card' where title = 'call bank';
select is(
  (select postponed_count from public.tasks where title = 'call bank'),
  1,
  'the counter cannot be reset by an update'
);

update public.tasks set due_date = '2026-10-05' where title = 'smuggled counter';
select is(
  (select postponed_count from public.tasks where title = 'smuggled counter'),
  0,
  'giving an undated task a date is not a postponement'
);

update public.tasks set status = 'done', due_date = '2026-10-09' where title = 'call bank';
select is(
  (select postponed_count from public.tasks where title = 'call bank'),
  1,
  'a task being completed is not postponed'
);

select * from finish();
rollback;
