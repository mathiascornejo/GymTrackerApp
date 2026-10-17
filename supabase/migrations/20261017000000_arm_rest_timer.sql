-- Arms a rest alarm in one round trip, timed by the server clock. A client-computed fire_at made the push late by
-- however far the phone clock ran ahead; the client now sends only the remaining duration.
create function public.arm_rest_timer(delay_ms integer, label text default '') returns timestamptz
language plpgsql security invoker set search_path = '' as $$
declare
  fire timestamptz := now() + make_interval(secs => greatest(delay_ms, 0) / 1000.0);
begin
  update public.rest_timers set cancelled_at = now()
    where user_id = (select auth.uid()) and sent_at is null and cancelled_at is null and deleted_at is null;
  insert into public.rest_timers (fire_at, label) values (fire, label);
  return fire;
end $$;
revoke execute on function public.arm_rest_timer(integer, text) from public, anon;
grant execute on function public.arm_rest_timer(integer, text) to authenticated;
