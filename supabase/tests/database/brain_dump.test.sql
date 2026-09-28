-- pgTAP tests for the Brain Dump RPCs and tables. Run with `npm run db:test` (needs `npx supabase start`).
begin;
select plan(16);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Quota counter
select is(public.increment_ai_usage('brain_dump'), 1, 'first AI request of the day counts 1');
select is(public.increment_ai_usage('brain_dump'), 2, 'second request counts 2');
select throws_ok($$ update public.ai_usage set request_count = 0 $$, '42501', null, 'users cannot reset their quota');

-- Sessions: insert own proposed session only
insert into public.brain_dump_sessions (id, channel, raw_text, time_zone, proposal, ai_provider, ai_model, prompt_version)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'app', 'domani chiamare il veterinario', 'Europe/Rome',
        '{"candidates": []}', 'anthropic', 'test-model', 'brain-dump.v1');

select throws_ok(
  $$ insert into public.brain_dump_sessions (channel, time_zone, proposal, ai_provider, ai_model, prompt_version, status)
     values ('app', 'UTC', '{}', 'a', 'm', 'v', 'committed') $$,
  '42501', null, 'cannot insert a session that is already committed'
);
select throws_ok(
  $$ update public.brain_dump_sessions set status = 'committed' $$,
  '42501', null, 'status changes only go through the RPCs'
);

-- Commit: validation, atomicity, idempotency
select throws_ok(
  $$ select * from public.commit_brain_dump('aaaaaaaa-0000-0000-0000-000000000001', '[]') $$,
  '22023', null, 'rejects an empty draft list'
);
select throws_ok(
  $$ select * from public.commit_brain_dump('aaaaaaaa-0000-0000-0000-000000000001', '[{"title": "ok"}, {"title": ""}]') $$,
  '22023', null, 'one invalid draft fails the whole commit'
);
select is((select count(*) from public.tasks), 0::bigint, 'failed commit created no tasks');

select is(
  (select count(*) from public.commit_brain_dump(
    'aaaaaaaa-0000-0000-0000-000000000001',
    '[{"title": "chiamare il veterinario", "due_date": "2026-09-30", "due_kind": "on", "source": "brain_dump", "source_language": "it"},
      {"title": "buy shampoo", "tags": ["errands"], "source": "brain_dump"}]')),
  2::bigint,
  'commit creates every draft'
);
select is(
  (select count(*) from public.commit_brain_dump('aaaaaaaa-0000-0000-0000-000000000001', '[{"title": "again"}]')),
  2::bigint,
  'retrying a committed session returns its tasks'
);
select is((select count(*) from public.tasks), 2::bigint, 'retry created no duplicates');
select is(
  (select status from public.brain_dump_sessions where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'committed',
  'session is marked committed'
);

-- Discard
insert into public.brain_dump_sessions (id, channel, time_zone, proposal, ai_provider, ai_model, prompt_version)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'siri', 'UTC', '{}', 'anthropic', 'test-model', 'brain-dump.v1');
select lives_ok($$ select public.discard_brain_dump('aaaaaaaa-0000-0000-0000-000000000002') $$, 'discards a proposed session');
select throws_ok(
  $$ select * from public.commit_brain_dump('aaaaaaaa-0000-0000-0000-000000000002', '[{"title": "x"}]') $$,
  '22023', null, 'a discarded session cannot be committed'
);

-- Isolation: user 2 can't see or commit user 1's sessions
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.brain_dump_sessions), 0::bigint, 'RLS hides other users'' sessions');
select throws_ok(
  $$ select * from public.commit_brain_dump('aaaaaaaa-0000-0000-0000-000000000001', '[{"title": "x"}]') $$,
  'P0002', null, 'cannot commit another user''s session'
);

select * from finish();
rollback;
