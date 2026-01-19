/*
  # Replace workout_date with day_number on workouts

  Workouts now use a sequential day number (1..n) instead of a fixed date.
  This migration migrates existing data, preserves ordering for templates
  and personalized workouts, and removes the old `workout_date` column.
*/

alter table if exists workouts
  add column if not exists day_number integer;

with ordered_program_workouts as (
  select
    id,
    row_number() over (
      partition by program_id
      order by workout_date asc nulls last, created_at asc, id asc
    ) as seq
  from workouts
  where program_id is not null
),
ordered_personal_workouts as (
  select
    id,
    row_number() over (
      partition by user_id
      order by workout_date asc nulls last, created_at asc, id asc
    ) as seq
  from workouts
  where program_id is null
)
update workouts w
set day_number = coalesce(p.seq, u.seq, w.day_number)
from ordered_program_workouts p
full outer join ordered_personal_workouts u on p.id = u.id
where w.id = coalesce(p.id, u.id);

update workouts
set day_number = 1
where day_number is null;

alter table workouts
  alter column day_number set not null;

drop index if exists idx_workouts_date;

alter table workouts
  drop column if exists workout_date;

create index if not exists idx_workouts_program_day
  on workouts(program_id, day_number);

create index if not exists idx_workouts_user_day
  on workouts(user_id, day_number);

