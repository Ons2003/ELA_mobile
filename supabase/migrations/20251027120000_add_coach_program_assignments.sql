-- Create coach_program_assignments table if it does not exist
create table if not exists public.coach_program_assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (coach_id, program_id)
);

-- Ensure RLS is enabled
alter table public.coach_program_assignments enable row level security;

drop policy if exists "Coaches can view their program assignments" on public.coach_program_assignments;

create policy "Coaches can view their program assignments"
  on public.coach_program_assignments
  for select
  using (auth.uid() = coach_id);

-- Allow admins to manage assignments
drop policy if exists "Admins can manage program assignments" on public.coach_program_assignments;

create policy "Admins can manage program assignments"
  on public.coach_program_assignments
  for all
  using ((auth.jwt() ->> 'role') = 'admin');
