/*
  # Ensure profile avatar uploads work

  - Create the `profile-avatars` bucket if it does not exist and keep it public
  - Allow anyone to read avatar objects (needed for public profile photos)
  - Allow authenticated users to upload, update, and delete only their own avatar files
*/

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can view profile avatars" on storage.objects;
create policy "Public can view profile avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-avatars');

drop policy if exists "Users can upload their own avatars" on storage.objects;
create policy "Users can upload their own avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-avatars' and auth.uid() = owner);

drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-avatars' and auth.uid() = owner)
  with check (bucket_id = 'profile-avatars' and auth.uid() = owner);

drop policy if exists "Users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-avatars' and auth.uid() = owner);
