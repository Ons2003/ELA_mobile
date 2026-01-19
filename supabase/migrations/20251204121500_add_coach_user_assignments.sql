-- Track which athletes are assigned to each coach
create table if not exists public.coach_user_assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (coach_id, user_id)
);

alter table public.coach_user_assignments enable row level security;

drop policy if exists "Coaches can view their athletes" on public.coach_user_assignments;
create policy "Coaches can view their athletes"
  on public.coach_user_assignments
  for select
  using (auth.uid() = coach_id);

drop policy if exists "Admins can manage athlete assignments" on public.coach_user_assignments;
create policy "Admins can manage athlete assignments"
  on public.coach_user_assignments
  for all
  using ((auth.jwt() ->> 'role') = 'admin');
