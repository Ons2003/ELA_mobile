/*
  # Ensure workout check-in media bucket exists

  - Create the `workout-checkins` storage bucket (public) if missing
  - Allow anyone to read check-in media (needed for public playback)
  - Allow authenticated users to upload, update, and delete their own media objects
*/

insert into storage.buckets (id, name, public)
values ('workout-checkins', 'workout-checkins', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can view workout check-in media" on storage.objects;
create policy "Public can view workout check-in media"
  on storage.objects for select
  to public
  using (bucket_id = 'workout-checkins');

drop policy if exists "Users can upload workout check-in media" on storage.objects;
create policy "Users can upload workout check-in media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'workout-checkins' and auth.uid() = owner);

drop policy if exists "Users can update workout check-in media" on storage.objects;
create policy "Users can update workout check-in media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'workout-checkins' and auth.uid() = owner)
  with check (bucket_id = 'workout-checkins' and auth.uid() = owner);

drop policy if exists "Users can delete workout check-in media" on storage.objects;
create policy "Users can delete workout check-in media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'workout-checkins' and auth.uid() = owner);
