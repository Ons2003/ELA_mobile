-- Program ratings per user per program
create table if not exists program_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  program_id uuid references programs(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, program_id)
);

alter table if exists program_ratings enable row level security;

drop policy if exists "users read own program ratings" on program_ratings;
create policy "users read own program ratings"
  on program_ratings
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users upsert own program ratings" on program_ratings;
create policy "users upsert own program ratings"
  on program_ratings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users update own program ratings"
  on program_ratings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
