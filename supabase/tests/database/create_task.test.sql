-- pgTAP tests for public.create_task. Run with `npx supabase test db` (needs the local stack: `npx supabase start`).
begin;
select plan(14);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

-- Act as user 1 for everything below, exactly like the app's signed-in client.
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select title from public.create_task('{"title": "  buy dog food  "}')),
  'buy dog food',
  'trims the title'
);

select results_eq(
  $$ select estimated_minutes, timing, flexible, tags, source, status
     from public.tasks where title = 'buy dog food' $$,
  $$ values (5, 'anytime'::text, false, '{}'::text[], 'app'::text, 'pending'::text) $$,
  'applies defaults to a minimal draft'
);

select is(
  (select user_id from public.tasks where title = 'buy dog food'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'owner always comes from the JWT'
);

select is(
  (select tags from public.create_task(
    '{"title": "chiamare il veterinario", "tags": [" phone ", "", "phone", "errands"],
      "due_date": "2026-09-29", "due_kind": "on", "source": "brain_dump",
      "source_language": "it", "ai_confidence": 0.92}')),
  array['phone', 'errands'],
  'cleans tags and keeps a full AI draft'
);

select throws_ok(
  $$ select public.create_task('{"title": "x", "user_id": "22222222-2222-2222-2222-222222222222"}') $$,
  '22023', null, 'rejects a smuggled user_id as an unknown field'
);
select throws_ok($$ select public.create_task('{"title": "   "}') $$, '22023', null, 'rejects an empty title');
select throws_ok($$ select public.create_task('["x"]') $$, '22023', null, 'rejects a non-object draft');
select throws_ok($$ select public.create_task('{"title": "x", "tags": "a"}') $$, '22023', null, 'rejects non-array tags');
select throws_ok($$ select public.create_task('{"title": "x", "priority": "urgent"}') $$, '23514', null, 'rejects an unknown priority');
select throws_ok($$ select public.create_task('{"title": "x", "due_kind": "by"}') $$, '23514', null, 'rejects due_kind without due_date');
select throws_ok($$ select public.create_task('{"title": "x", "scheduled_time": "25:00"}') $$, '23514', null, 'rejects an invalid time');
select throws_ok($$ select public.create_task('{"title": "x", "ai_confidence": 1.5}') $$, '23514', null, 'rejects confidence above 1');

-- User 2 must not see user 1's tasks.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.tasks), 0::bigint, 'RLS hides other users'' tasks');

-- Anonymous (not signed in) callers cannot create tasks at all.
set local role anon;
select throws_ok($$ select public.create_task('{"title": "x"}') $$, '42501', null, 'anon cannot execute create_task');

select * from finish();
rollback;
