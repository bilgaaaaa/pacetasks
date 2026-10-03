-- pgTAP tests for public.profiles. Run with `npm run db:test` (needs `npx supabase start`).
begin;
select plan(9);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

set local role authenticated;

-- An anonymous session cannot create a profile.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated", "is_anonymous": true}';
select throws_ok(
  $$ insert into public.profiles (first_name, last_name) values ('Bilge', 'Ozcan') $$,
  '42501', null, 'anonymous users cannot create a profile'
);

-- A verified account can.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated", "is_anonymous": false}';
select lives_ok(
  $$ insert into public.profiles (first_name, last_name, marketing_opt_in_at)
     values ('  Bilge ', 'Ozcan', '2020-01-01') $$,
  'a verified user creates their profile'
);
select results_eq(
  $$ select first_name, marketing_opt_in, marketing_opt_in_at is null from public.profiles $$,
  $$ values ('Bilge'::text, false, true) $$,
  'names are trimmed and consent is off, with no consent date, unless given'
);
select throws_ok(
  $$ update public.profiles set last_name = '   ' $$,
  '23514', null, 'rejects an empty name'
);

update public.profiles set marketing_opt_in = true;
select isnt(
  (select marketing_opt_in_at from public.profiles), null,
  'giving consent records when it was given'
);
update public.profiles set marketing_opt_in = false;
select is(
  (select marketing_opt_in_at from public.profiles), null,
  'withdrawing consent clears its date'
);
select throws_ok($$ delete from public.profiles $$, '42501', null, 'a profile cannot be deleted on its own');

-- Isolation: another user neither sees nor changes it.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated", "is_anonymous": false}';
select is((select count(*) from public.profiles), 0::bigint, 'RLS hides other users'' profiles');
select throws_ok(
  $$ insert into public.profiles (user_id, first_name, last_name)
     values ('11111111-1111-1111-1111-111111111111', 'Eve', 'X') $$,
  null, null, 'cannot write a profile for someone else'
);

select * from finish();
rollback;
