create table if not exists physician_appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  coach_id uuid references profiles(id) on delete set null,
  requested_date date not null,
  session_type text not null,
  session_details text,
  status text not null default 'pending',
  proposed_slots text[],
  selected_slot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  approved_at timestamptz,
  partner_email_sent_at timestamptz
);

create index if not exists idx_physician_appointments_user on physician_appointments(user_id);
create index if not exists idx_physician_appointments_coach on physician_appointments(coach_id);

create or replace function physician_appointments_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_physician_appointments_set_updated on physician_appointments;
create trigger trg_physician_appointments_set_updated
before update on physician_appointments
for each row
execute procedure physician_appointments_set_updated_at();
