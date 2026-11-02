-- =============================================================================
-- SplitFree: "Delete my account"
--
-- How to use: Supabase → SQL Editor → paste this file → Run (once).
--
-- What deleting does:
-- - Removes the login (email, Google link) completely, so it can't be used again.
-- - Keeps the person's past expenses in their groups, so friends' balances
--   don't suddenly change, but renames them to "Deleted user" and removes
--   their UPI ID. Nothing identifying is left.
-- =============================================================================

-- Profiles used to be deleted automatically together with the login. That
-- can't work once someone has expenses (the expenses still point at the
-- profile), so the profile now stays behind, anonymised, when the login goes.
alter table public.profiles drop constraint if exists profiles_id_fkey;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not logged in';
  end if;

  -- 1. Anonymise the profile that friends see.
  update public.profiles
  set display_name = 'Deleted user', upi_id = null
  where id = me;

  -- 2. Hide any roast badges about them from now on.
  update public.group_members set hide_negative_badges = true where user_id = me;

  -- 3. Remove the login itself (email address, Google connection, sessions).
  delete from auth.users where id = me;
end;
$$;

-- Only logged-in users may call it, and it only ever deletes the caller.
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
