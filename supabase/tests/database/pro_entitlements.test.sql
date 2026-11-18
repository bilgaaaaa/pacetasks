-- pgTAP tests for public.pro_entitlements and is_pro(). Run with `npm run db:test` (needs `npx supabase start`).
begin;
select plan(7);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333');

-- Written as the service role would: one active trial, one expired subscription.
insert into public.pro_entitlements (user_id, product_id, period_type, expires_at) values
  ('11111111-1111-1111-1111-111111111111', 'pacetasks_pro_yearly', 'trial', now() + interval '7 days'),
  ('22222222-2222-2222-2222-222222222222', 'pacetasks_pro_monthly', 'normal', now() - interval '1 day');

set local role authenticated;

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(public.is_pro(), true, 'an active trial counts as Pro');
select is((select count(*) from public.pro_entitlements), 1::bigint, 'a user sees only their own entitlement');
select throws_ok(
  $$ update public.pro_entitlements set expires_at = now() + interval '10 years' $$,
  '42501', null, 'a user cannot extend their own subscription'
);
select throws_ok(
  $$ insert into public.pro_entitlements (user_id, product_id, period_type)
     values ('33333333-3333-3333-3333-333333333333', 'pacetasks_pro_yearly', 'normal') $$,
  '42501', null, 'a user cannot grant Pro to anyone'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(public.is_pro(), false, 'an expired subscription is not Pro');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is(public.is_pro(), false, 'no subscription is not Pro');

reset role;
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*) from public.pro_entitlements where user_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'deleting the account removes its entitlement'
);

select * from finish();
rollback;
