-- Per-exercise progression increment in kg, keyed by exercise_ref. Missing keys fall back to an equipment default.
alter table public.profiles add column increments jsonb not null default '{}'::jsonb;
