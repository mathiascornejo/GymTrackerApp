-- Archived routines stay in history but leave the active picker; separate from soft delete.
alter table public.routines add column archived_at timestamptz;
