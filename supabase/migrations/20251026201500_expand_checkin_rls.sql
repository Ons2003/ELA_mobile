/*
  # Expand workout check-in RLS for media uploads

  We already allow template workouts to be read and check-ins inserted, but athletes also need to:
    - Read their own check-in history (including template workouts)
    - Insert check-ins for personalized workouts (user_id = auth.uid())
    - Upload attachments to workout_checkin_media

  This migration enables those behaviors without loosening access for other users.
*/

alter table if exists workout_checkins enable row level security;
alter table if exists workout_checkin_media enable row level security;

do $policies$
begin
  -- Allow athletes to view their own check-ins (personalized or template-linked)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_checkins'
      and policyname = 'Users can view own check-ins'
  ) then
    execute '
      create policy "Users can view own check-ins"
        on workout_checkins for select
        to authenticated
        using (
          user_id = auth.uid()
        )
    ';
  end if;

  -- Personalized workouts: keep supporting direct inserts
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_checkins'
      and policyname = 'Users can log personalized workout check-ins'
  ) then
    execute '
      create policy "Users can log personalized workout check-ins"
        on workout_checkins for insert
        to authenticated
        with check (
          user_id = auth.uid()
          and workout_id in (
            select id from workouts
            where user_id = auth.uid()
          )
        )
    ';
  end if;

  -- Template workouts policy already created in previous migration

  -- Media inserts: ensure athletes can attach files to their own check-ins
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_checkin_media'
      and policyname = 'Users can add media to own check-ins'
  ) then
    execute '
      create policy "Users can add media to own check-ins"
        on workout_checkin_media for insert
        to authenticated
        with check (
          checkin_id in (
            select id from workout_checkins
            where user_id = auth.uid()
          )
        )
    ';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_checkin_media'
      and policyname = 'Users can view media for own check-ins'
  ) then
    execute '
      create policy "Users can view media for own check-ins"
        on workout_checkin_media for select
        to authenticated
        using (
          checkin_id in (
            select id from workout_checkins
            where user_id = auth.uid()
          )
        )
    ';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_checkins'
      and policyname = 'Users can update recent check-ins'
  ) then
    execute '
      create policy "Users can update recent check-ins"
        on workout_checkins for update
        to authenticated
        using (
          user_id = auth.uid()
          and created_at >= now() - interval ''24 hours''
        )
        with check (
          user_id = auth.uid()
          and created_at >= now() - interval ''24 hours''
        )
    ';
  end if;
end
$policies$;
