-- Add lead contact fields to program_enrollments to support pre-account submissions
alter table program_enrollments
  add column if not exists lead_first_name text,
  add column if not exists lead_last_name text,
  add column if not exists lead_email text,
  add column if not exists lead_phone text,
  add column if not exists lead_age integer,
  add column if not exists lead_location text,
  add column if not exists lead_experience_level text,
  add column if not exists lead_goals text,
  add column if not exists lead_injuries text,
  add column if not exists lead_additional_info text;

create index if not exists idx_program_enrollments_lead_email
  on program_enrollments (lead_email);

-- Allow authenticated users to create their own profile row after sign-up
drop policy if exists "Users can insert own profile" on profiles;

create policy "Users can insert own profile"
  on profiles
  for insert
  to authenticated
  with check (auth.uid() = id);
