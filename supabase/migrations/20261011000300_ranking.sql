-- Ranking support: a set the user confirmed despite looking implausible, editable standards, and the rank-pattern accessibility overlay.
alter table public.session_sets add column confirmed boolean not null default false;
alter table public.profiles add column rank_patterns boolean not null default false;
alter table public.profiles add column standards_overrides jsonb not null default '{}'::jsonb;
