-- Create exercise library table for coach templates
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  exercise_name text not null,
  exercise_type text,
  target_sets integer,
  target_reps text,
  target_weight numeric(6,2),
  target_rpe numeric(3,1),
  rest_seconds integer,
  notes text,
  image_url text,
  created_at timestamptz default now()
);

alter table if exists exercises
  add column if not exists id uuid,
  add column if not exists exercise_name text,
  add column if not exists exercise_type text,
  add column if not exists target_sets integer,
  add column if not exists target_reps text,
  add column if not exists target_weight numeric(6,2),
  add column if not exists target_rpe numeric(3,1),
  add column if not exists rest_seconds integer,
  add column if not exists notes text,
  add column if not exists image_url text,
  add column if not exists created_at timestamptz default now();

do $id$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exercises'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    execute 'update exercises set id = gen_random_uuid() where id is null';
    execute 'alter table exercises alter column id set default gen_random_uuid()';
  end if;
end
$id$;

alter table if exists exercises enable row level security;

do $policies$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exercises'
      and policyname = 'Coaches can view exercises'
  ) then
    execute 'drop policy "Coaches can view exercises" on exercises';
  end if;

  execute '
    create policy "Coaches can view exercises"
      on exercises for select
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
