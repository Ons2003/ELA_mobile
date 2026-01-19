create table if not exists weekly_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  coach_id uuid not null references profiles (id) on delete cascade,
  week_start date not null,
  goal_text text not null,
  status text not null default 'pending' check (status in ('pending', 'achieved', 'partial', 'not_achieved')),
  reflection text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weekly_goals_user_week_idx on weekly_goals (user_id, week_start);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_weekly_goals_updated_at
before update on weekly_goals
for each row
execute function public.set_updated_at();

alter table weekly_goals enable row level security;

create policy "weekly_goals_select_own_or_coach"
on weekly_goals
for select
using (auth.uid() = user_id OR auth.uid() = coach_id);

create policy "weekly_goals_insert_coach_only"
on weekly_goals
for insert
with check (auth.uid() = coach_id);

create policy "weekly_goals_update_coach_only"
on weekly_goals
for update
using (auth.uid() = coach_id);
