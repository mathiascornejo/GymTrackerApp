-- User B must not read, write, delete or attach to user A's rows, on every table. Anonymous callers get nothing.
begin;
select plan(3);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated');
-- profiles for both users come from the on_auth_user_created trigger.

insert into public.bodyweight_entries (id, user_id, measured_on, weight_kg) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-01-01', 80);
insert into public.step_entries (id, user_id, logged_on, steps) values
  ('a0000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-01-01', 8000);
insert into public.custom_exercises (id, user_id, name) values
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Neck curl');
insert into public.routines (id, user_id, name, is_active) values
  ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Upper lower', true);
insert into public.routine_days (id, user_id, routine_id, weekday) values
  ('a0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 1);
insert into public.routine_blocks (id, user_id, routine_id, routine_day_id) values
  ('a0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004');
insert into public.block_items (id, user_id, block_id, exercise_ref) values
  ('a0000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'ds:Barbell_Curl');
insert into public.sessions (id, user_id, routine_id) values
  ('a0000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003');
insert into public.session_sets (id, user_id, session_id, exercise_ref, set_number, weight_kg, reps) values
  ('a0000000-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 'ds:Barbell_Curl', 1, 40, 10);
insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth) values
  ('a0000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'https://push.example/a', 'k', 'a');
insert into public.rest_timers (id, user_id, fire_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', now());

-- Every table in public must have RLS enabled, so a forgotten table fails here.
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'RLS is enabled on every public table');

-- Sections run as role authenticated; failures are collected, then asserted once.
select set_config('test.failures', '', true);
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  t text; n bigint; fails text := '';
  a constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    -- B's own row on profiles is visible, so compare against A's rows only.
    execute format('select count(*) from public.%I where user_id = %L', t, a) into n;
    if n <> 0 then fails := fails || t || ': B can read A; '; end if;

    execute format('update public.%I set updated_at = now() where user_id = %L', t, a);
    get diagnostics n = row_count;
    if n <> 0 then fails := fails || t || ': B can update A; '; end if;

    execute format('delete from public.%I where user_id = %L', t, a);
    get diagnostics n = row_count;
    if n <> 0 then fails := fails || t || ': B can delete A; '; end if;

    begin
      execute format('insert into public.%I (id, user_id) values (gen_random_uuid(), %L)', t, a);
      fails := fails || t || ': B can insert as A; ';
    exception
      when insufficient_privilege then null;
      when others then fails := fails || t || ': insert failed for the wrong reason (' || sqlstate || '); ';
    end;
  end loop;

  -- Foreign-key hijack: B tries to hang a day off A's routine.
  begin
    insert into public.routine_days (user_id, routine_id, weekday)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 2);
    fails := fails || 'routine_days: B attached a day to A''s routine; ';
  exception
    when foreign_key_violation then null;
  end;

  perform set_config('test.failures', fails, true);
end $$;

select is(current_setting('test.failures'), '', 'user B cannot read, write, delete or attach to user A rows');

-- Anonymous callers: no table privileges at all.
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok('select count(*) from public.sessions', '42501', null, 'anon cannot read sessions');

select * from finish();
rollback;
