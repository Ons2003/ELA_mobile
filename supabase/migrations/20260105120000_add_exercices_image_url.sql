-- Add image url to exercise library entries
alter table if exists exercises
  add column if not exists image_url text;
