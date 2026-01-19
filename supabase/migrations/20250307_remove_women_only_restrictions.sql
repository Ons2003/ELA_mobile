-- Roll back women-only check-in restrictions and open access again

-- Drop policies added for women-only filtering
drop policy if exists "checkins_owner_access" on workout_checkins;
drop policy if exists "checkins_coach_or_admin_non_women_only" on workout_checkins;
drop policy if exists "checkin_media_owner_access" on workout_checkin_media;
drop policy if exists "checkin_media_coach_or_admin_non_women_only" on workout_checkin_media;

-- Drop helper view
drop view if exists _checkin_access_matrix;

-- Optionally disable RLS if you want fully open tables again
alter table if exists workout_checkins disable row level security;
alter table if exists workout_checkin_media disable row level security;
