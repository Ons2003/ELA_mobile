-- Add image reference to workout exercises
alter table if exists workout_exercises
  add column if not exists image_url text;
