/*
  # Allow athletes to submit check-ins for template workouts

  Athletes can now view template workouts via the previous policy, but RLS on workout_checkins still
  blocks inserts because those template workouts have user_id IS NULL. This policy lets an enrolled
  athlete create a check-in for any template workout that belongs to one of their active programs.
*/

alter table if exists workout_checkins enable row level security;

do $policy$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_checkins'
      and policyname = 'Enrolled users can log template workout check-ins'
  ) then
    execute '
      create policy "Enrolled users can log template workout check-ins"
        on workout_checkins for insert
        to authenticated
        with check (
          user_id = auth.uid()
          and workout_id in (
            select id
            from workouts
            where user_id is null
              and program_id in (
                select program_id
                from program_enrollments
                where user_id = auth.uid()
                  and status = ''active''
              )
          )
        )
    ';
  end if;
end
$policy$;
