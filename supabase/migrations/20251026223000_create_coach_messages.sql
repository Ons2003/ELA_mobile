/*
  # Coach messaging between athletes and coaches

  Creates a new `coach_messages` table that stores threaded messages between an athlete
  and their coach. The sender/receiver can both access the conversation, and coaches
  get read receipts.
*/

create table if not exists coach_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade not null,
  receiver_id uuid references profiles(id) on delete cascade not null,
  sender_role text check (sender_role in ('athlete', 'coach')) not null,
  message text not null,
  is_read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_coach_messages_sender on coach_messages(sender_id, created_at desc);
create index if not exists idx_coach_messages_receiver on coach_messages(receiver_id, created_at desc);

alter table coach_messages enable row level security;

drop policy if exists "Message sender can insert" on coach_messages;
create policy "Message sender can insert"
  on coach_messages for insert
  to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "Participants can view messages" on coach_messages;
create policy "Participants can view messages"
  on coach_messages for select
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Receiver can update message" on coach_messages;
create policy "Receiver can update message"
  on coach_messages for update
  to authenticated
  using (receiver_id = auth.uid())
  with check (receiver_id = auth.uid());
