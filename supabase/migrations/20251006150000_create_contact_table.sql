/*
  # Contact Table

  - Stores submissions from website contact form
  - Captures basic sender info and message content
  - Provides created_at timestamp for sorting and triage
*/

create table if not exists public.contact (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text,
  message text not null,
  created_at timestamptz not null default now()
);

comment on table public.contact is 'Contact form submissions from the marketing site';

comment on column public.contact.topic is 'Optional topic selected by the sender';

create index if not exists contact_created_at_idx on public.contact (created_at desc);
