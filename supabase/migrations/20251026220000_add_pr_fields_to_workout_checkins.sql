/*
  # Track personal records and session metrics on workout check-ins

  Adds nullable fields to persist whether a check-in included a new PR, the
  exercise/value/unit for that PR, and a JSONB payload for any additional
  session metrics we want to chart later (pace, volume, etc.).
*/

alter table if exists workout_checkins
  add column if not exists achieved_pr boolean default false,
  add column if not exists pr_exercise text,
  add column if not exists pr_value numeric,
  add column if not exists pr_unit text,
  add column if not exists performance_metrics jsonb;

update workout_checkins
set performance_metrics = jsonb_build_object(
    'readinessScore', readiness_score,
    'energyLevel', energy_level,
    'sorenessLevel', soreness_level
  )
where performance_metrics is null;

