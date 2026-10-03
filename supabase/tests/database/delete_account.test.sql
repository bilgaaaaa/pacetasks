-- pgTAP tests for public.delete_account. Run with `npm run db:test` (needs `npx supabase start`).
begin;
select plan(8);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.tasks (user_id, title) values
  ('11111111-1111-1111-1111-111111111111', 'Call the vet'),
  ('11111111-1111-1111-1111-111111111111', 'Buy shampoo'),
  ('22222222-2222-2222-2222-222222222222', 'Someone else''s task');
insert into public.user_settings (user_id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');
insert into public.profiles (user_id, first_name, last_name) values
  ('11111111-1111-1111-1111-111111111111', 'Bilge', 'Ozcan');
insert into public.ai_usage (user_id, feature, request_count) values
  ('11111111-1111-1111-1111-111111111111', 'brain_dump', 3);
insert into public.brain_dump_sessions (user_id, channel, raw_text, time_zone, proposal, ai_provider, ai_model, prompt_version)
values ('11111111-1111-1111-1111-111111111111', 'app', 'call the vet', 'Europe/Rome', '{"candidates": []}', 'rules', 'rules', 'v1');

-- Nobody without a session can call it.
set local role anon;
select throws_ok($$ select public.delete_account() $$, '42501', null, 'anon cannot delete an account');

set local role authenticated;
set local request.jwt.claims = '{"role": "authenticated"}';
select throws_ok($$ select public.delete_account() $$, '28000', null, 'a call without a user is rejected');

-- A signed-in user deletes themselves.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.delete_account() $$, 'a user deletes their own account');

reset role;
select is(
  (select count(*) from auth.users where id = '11111111-1111-1111-1111-111111111111'), 0::bigint,
  'the user is gone'
);
select is(
  (select count(*) from public.tasks where user_id = '11111111-1111-1111-1111-111111111111'), 0::bigint,
  'their tasks are gone'
);
select is(
  (select (select count(*) from public.user_settings where user_id = '11111111-1111-1111-1111-111111111111')
        + (select count(*) from public.profiles where user_id = '11111111-1111-1111-1111-111111111111')
        + (select count(*) from public.ai_usage where user_id = '11111111-1111-1111-1111-111111111111')
        + (select count(*) from public.brain_dump_sessions where user_id = '11111111-1111-1111-1111-111111111111')),
  0::bigint,
  'their settings, profile, AI usage and brain dumps are gone'
);

-- Nobody else is touched.
select is(
  (select count(*) from auth.users where id = '22222222-2222-2222-2222-222222222222'), 1::bigint,
  'other users are kept'
);
select is(
  (select count(*) from public.tasks where user_id = '22222222-2222-2222-2222-222222222222')
    + (select count(*) from public.user_settings where user_id = '22222222-2222-2222-2222-222222222222'),
  2::bigint,
  'other users'' tasks and settings are kept'
);

select * from finish();
rollback;
