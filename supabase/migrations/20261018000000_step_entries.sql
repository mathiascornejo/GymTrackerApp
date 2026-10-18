-- One step total per user per day. Logging a day again replaces its total (upsert on user_id, logged_on).
create table public.step_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  logged_on date not null,
  steps integer not null check (steps >= 0 and steps <= 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  unique (user_id, logged_on)
);

alter table public.step_entries enable row level security;
revoke all on public.step_entries from anon;
grant select, insert, update, delete on public.step_entries to authenticated;
create policy owner_all on public.step_entries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index step_entries_user_updated_idx on public.step_entries (user_id, updated_at);
create trigger touch_updated_at before update on public.step_entries
  for each row execute function public.touch_updated_at();
