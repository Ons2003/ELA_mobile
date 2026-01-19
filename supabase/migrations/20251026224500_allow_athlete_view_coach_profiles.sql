/*
  # Allow athletes to see coach contact profiles

  Athletes enrolled in a program need to view limited profile details for the
  coaches who run their programs so they can start a conversation.
  This policy grants SELECT access on `profiles` for coaches/admins who are linked
  to a program the athlete is enrolled in.
*/

drop policy if exists "Athletes can view enrolled coaches" on profiles;

create or replace function public.athlete_can_view_coach(target_coach_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or target_coach_id is null then
    return false;
  end if;

  return exists (
    select 1
    from program_enrollments pe
    join programs p on p.id = pe.program_id
    where pe.user_id = current_user_id
      and p.created_by = target_coach_id
  );
end;
$$;

create policy "Athletes can view enrolled coaches"
  on profiles for select
  to authenticated
  using (
    role in ('coach', 'admin')
    and athlete_can_view_coach(id)
  );
