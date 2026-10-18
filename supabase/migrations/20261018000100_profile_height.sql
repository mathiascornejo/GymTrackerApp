-- Height in cm, used to turn steps into distance for the calories estimate. Null until the person sets it.
alter table public.profiles add column height_cm numeric(4,1) check (height_cm between 100 and 250);
