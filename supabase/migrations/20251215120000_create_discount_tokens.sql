create table if not exists public.discount_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  partner_name text not null,
  coupon_code text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by text
);

create index if not exists discount_tokens_user_id_idx on public.discount_tokens (user_id);
create index if not exists discount_tokens_expires_at_idx on public.discount_tokens (expires_at);

alter table public.discount_tokens enable row level security;
