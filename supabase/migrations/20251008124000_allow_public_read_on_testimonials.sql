/*
  # Allow Public Read Access On Testimonials

  - Ensures testimonials can be fetched from the marketing site using the anon key
  - Grants SELECT privilege to anon and authenticated roles
  - Adds a permissive RLS policy so reads succeed even if RLS is enabled
*/

grant select on table public.testimonials to anon, authenticated;

alter table public.testimonials enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'testimonials'
      and policyname = 'Allow read access to testimonials'
  ) then
    create policy "Allow read access to testimonials"
      on public.testimonials
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;
