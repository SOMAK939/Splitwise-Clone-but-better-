-- =============================================================================
-- SplitFree: use the name from Google for new accounts
--
-- How to use: Supabase → SQL Editor → paste this file → Run (once).
--
-- People who sign up with Google don't type a name; Google sends it as
-- `full_name` (or `name`). Before this change they'd have been called by
-- the start of their email address instead.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), -- typed at sign-up
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),    -- from Google
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),         -- from Google (older)
        split_part(new.email, '@', 1)                                -- last resort
      ),
      50 -- display_name allows at most 50 characters
    )
  );
  return new;
end;
$$;
