/*
  # Fix Testimonials Table Name

  - Renames the previously misspelled `testemonials` table to `testimonials`
  - Keeps existing data intact if the table already exists
*/

do $$
begin
  if to_regclass('public.testemonials') is not null then
    alter table public.testemonials rename to testimonials;
  end if;
end
$$;
