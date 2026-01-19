alter table public.workouts
  add column if not exists scheduled_date date;

create index if not exists idx_workouts_scheduled_date
  on public.workouts (scheduled_date);
