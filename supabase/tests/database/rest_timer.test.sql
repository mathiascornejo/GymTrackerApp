-- arm_rest_timer times the alarm by the server clock and keeps one pending timer per user.
begin;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.local', 'authenticated', 'authenticated');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is(public.arm_rest_timer(90000, 'Rest'), now() + interval '90 seconds', 'fire_at is server now plus the delay');
select public.arm_rest_timer(105000, 'Rest');
select is((select count(*)::int from public.rest_timers where cancelled_at is null), 1, 'arming again cancels the old timer');
select is((select fire_at from public.rest_timers where cancelled_at is null), now() + interval '105 seconds', 'the new timer is pending');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select public.arm_rest_timer(1000)$$, '42501', null, 'anon cannot arm a timer');

select * from finish();
