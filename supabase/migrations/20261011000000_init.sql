-- Tempered schema. Kilograms are canonical. Every table is owned by user_id and protected by RLS.

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create function public.ping() returns text
language sql stable as $$ select 'ok' $$;
grant execute on function public.ping() to anon, authenticated;

-- Columns every table shares are repeated by hand so each table reads on its own.
-- unique (id, user_id) lets children reference parents with (parent_id, user_id): a row can never point at another user's parent.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  user_id uuid not null unique references auth.users on delete cascade,
  display_name text not null default '',
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  standards_table text check (standards_table in ('male', 'female')), -- null until onboarding picks one
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  default_rest_s smallint not null default 90 check (default_rest_s between 0 and 3600),
  wake_lock_enabled boolean not null default true,
  auto_start_rest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (id = user_id)
);

create table public.bodyweight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  measured_on date not null,
  weight_kg numeric(8,4) not null check (weight_kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text,
  force text,
  mechanic text,
  level text,
  instructions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);
create unique index routines_one_active on public.routines (user_id) where is_active and deleted_at is null;

create table public.routine_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  routine_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  label text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (routine_id, user_id) references public.routines (id, user_id) on delete cascade
);

create table public.routine_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  routine_id uuid not null,
  routine_day_id uuid, -- null = accessory bank
  kind text not null default 'single' check (kind in ('single', 'superset', 'circuit')),
  sort integer not null default 0,
  sets smallint not null default 3 check (sets > 0),
  rest_s smallint not null default 90 check (rest_s >= 0),
  transition_rest_s smallint not null default 0 check (transition_rest_s >= 0),
  weekdays smallint[], -- bank blocks only
  weekly_target smallint check (weekly_target > 0), -- bank blocks only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (routine_id, user_id) references public.routines (id, user_id) on delete cascade,
  foreign key (routine_day_id, user_id) references public.routine_days (id, user_id) on delete cascade
);

create table public.block_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  block_id uuid not null,
  exercise_ref text not null check (exercise_ref ~ '^(ds:.+|custom:[0-9a-fA-F-]{36})$'),
  sort integer not null default 0,
  rep_min smallint not null default 8 check (rep_min > 0),
  rep_max smallint not null default 12,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  check (rep_max >= rep_min),
  foreign key (block_id, user_id) references public.routine_blocks (id, user_id) on delete cascade
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  routine_id uuid,
  routine_day_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text not null default '',
  bodyweight_kg numeric(8,4) check (bodyweight_kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (routine_id, user_id) references public.routines (id, user_id) on delete set null (routine_id),
  foreign key (routine_day_id, user_id) references public.routine_days (id, user_id) on delete set null (routine_day_id)
);

create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null,
  exercise_ref text not null check (exercise_ref ~ '^(ds:.+|custom:[0-9a-fA-F-]{36})$'),
  block_id uuid,
  round_index smallint not null default 0,
  set_number smallint not null,
  weight_kg numeric(8,4) not null check (weight_kg >= 0),
  reps smallint not null check (reps >= 0),
  rpe numeric(3,1) check (rpe between 1 and 10),
  is_warmup boolean not null default false,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade,
  foreign key (block_id, user_id) references public.routine_blocks (id, user_id) on delete set null (block_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  unique (user_id, endpoint)
);

create table public.rest_timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  fire_at timestamptz not null,
  label text not null default '',
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

-- RLS, grants, sync index and updated_at trigger on every table above.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'bodyweight_entries', 'custom_exercises', 'routines', 'routine_days', 'routine_blocks',
    'block_items', 'sessions', 'session_sets', 'push_subscriptions', 'rest_timers'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create index %I on public.%I (user_id, updated_at)', t || '_user_updated_idx', t);
    execute format(
      'create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- A profile row exists for every account from the moment it is created.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, user_id, display_name)
  values (new.id, new.id, split_part(coalesce(new.email, ''), '@', 1));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
