/*
  # Allow athletes to read template workouts for their enrolled programs

  Previously, workouts RLS only allowed rows where user_id = auth.uid(), so athletes could never fetch
  program templates (user_id IS NULL). That broke the calendar because template workouts were filtered out.
  This policy lets authenticated users read template workouts that belong to programs they are actively enrolled in.
*/

do $policy$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workouts'
      and policyname = 'Enrolled users can view template workouts'
  ) then
    execute '
      create policy "Enrolled users can view template workouts"
        on workouts for select
        to authenticated
        using (
          user_id is null
          and program_id in (
            select program_id
            from program_enrollments
            where user_id = auth.uid()
              and status = ''active''
          )
        )
    ';
  end if;
end
$policy$;
