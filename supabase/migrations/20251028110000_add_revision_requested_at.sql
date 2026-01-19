-- Add revision_requested_at column to track when a coach requests edits
alter table if exists public.workout_checkins
  add column if not exists revision_requested_at timestamptz;
