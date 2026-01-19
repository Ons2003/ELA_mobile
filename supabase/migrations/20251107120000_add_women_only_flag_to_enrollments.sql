-- Add a flag to capture women-only enrollment requests
alter table if exists program_enrollments
  add column if not exists is_women_only boolean default false;

comment on column program_enrollments.is_women_only is
  'Indicates the learner requested a women-only cohort for this enrollment';
