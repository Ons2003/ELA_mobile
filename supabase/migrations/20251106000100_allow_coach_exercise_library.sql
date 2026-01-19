-- Allow coaches/admins to read all workout exercises and sets for library use
do $policies$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_exercises'
      and policyname = 'Coaches can view all workout exercises'
  ) then
    execute 'drop policy "Coaches can view all workout exercises" on workout_exercises';
  end if;

  execute '
    create policy "Coaches can view all workout exercises"
      on workout_exercises for select
      to authenticated
      using (
        exists (
          select 1 from profiles
          where id = auth.uid()
            and role in (''coach'', ''admin'')
        )
      )
  ';

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exercise_sets'
      and policyname = 'Coaches can view all exercise sets'
  ) then
    execute 'drop policy "Coaches can view all exercise sets" on exercise_sets';
  end if;

  execute '
    create policy "Coaches can view all exercise sets"
      on exercise_sets for select
      to authenticated
      using (
        exists (
          select 1 from profiles
          where id = auth.uid()
            and role in (''coach'', ''admin'')
        )
      )
  ';
end
$policies$;
