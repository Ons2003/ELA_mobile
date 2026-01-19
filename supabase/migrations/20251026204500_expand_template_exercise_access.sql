/*
  # Allow athletes to view template workout exercises

  Template workouts replicate across enrollments with `user_id IS NULL`, so the existing RLS
  that requires `workouts.user_id = auth.uid()` blocked athletes from reading the exercise
  details. This migration widens the SELECT policies on `workout_exercises` and `exercise_sets`
  so an authenticated athlete can read exercises when either:
    - The workout belongs to them directly, or
    - The workout is a template for a program they are actively enrolled in.
*/

alter table if exists workout_exercises enable row level security;
alter table if exists exercise_sets enable row level security;

do $policies$
begin
  -- Update workout_exercises SELECT policy
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_exercises'
      and policyname = 'Users can view own workout exercises'
  ) then
    execute 'drop policy "Users can view own workout exercises" on workout_exercises';
  end if;

  execute '
    create policy "Users can view own workout exercises"
      on workout_exercises for select
      to authenticated
      using (
        exists (
          select 1
          from workouts
          where workouts.id = workout_exercises.workout_id
            and (
              workouts.user_id = auth.uid()
              or (
                workouts.user_id is null
                and workouts.program_id in (
                  select program_id
                  from program_enrollments
                  where user_id = auth.uid()
                    and status = ''active''
                )
              )
            )
        )
      )
  ';

  -- Update exercise_sets SELECT policy
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exercise_sets'
      and policyname = 'Users can view own exercise sets'
  ) then
    execute 'drop policy "Users can view own exercise sets" on exercise_sets';
  end if;

  execute '
    create policy "Users can view own exercise sets"
      on exercise_sets for select
      to authenticated
      using (
        exists (
          select 1
          from workout_exercises
          join workouts on workouts.id = workout_exercises.workout_id
          where workout_exercises.id = exercise_sets.workout_exercise_id
            and (
              workouts.user_id = auth.uid()
              or (
                workouts.user_id is null
                and workouts.program_id in (
                  select program_id
                  from program_enrollments
                  where user_id = auth.uid()
                    and status = ''active''
                )
              )
            )
        )
      )
  ';
end
$policies$;

