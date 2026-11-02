-- =============================================================================
-- SplitFree: first database schema
--
-- How to use: open your Supabase project → SQL Editor → paste this whole file
-- → Run. (Or with the Supabase CLI: `supabase db push`.)
--
-- Money is stored as whole PAISE in `bigint` columns (₹1 = 100 paise), never
-- as decimals, so sums are always exact.
--
-- Security: every table has Row Level Security (RLS) turned on. RLS is like a
-- bouncer on each table: the app's public key can only see or change rows that
-- the policies below allow, e.g. "only members of a group can see its
-- expenses". Without it, anyone with the key could read everything.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- One row per person. `id` is the same id Supabase Auth gives the user.
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 50),
  upi_id        text check (upi_id is null or upi_id ~ '^[A-Za-z0-9.\-_]+@[A-Za-z0-9]+$'),
  created_at    timestamptz not null default now()
);

-- A shared group like "Goa Trip" or "Flat 302".
create table public.groups (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 1 and 60),
  emoji           text not null default '👥',
  -- How cheeky the fun insights get: off, mild or spicy (see the spec).
  roast_level     text not null default 'mild' check (roast_level in ('off', 'mild', 'spicy')),
  simplify_debts  boolean not null default true,
  -- Short random code used in invite links.
  invite_code     text not null unique default substr(md5(random()::text), 1, 8),
  created_by      uuid not null references public.profiles (id),
  created_at      timestamptz not null default now()
);

-- Who is in which group.
create table public.group_members (
  group_id              uuid not null references public.groups (id) on delete cascade,
  user_id               uuid not null references public.profiles (id) on delete cascade,
  joined_at             timestamptz not null default now(),
  -- Lets a person hide their own "negative" badges (Chindi, Slow Settler...).
  hide_negative_badges  boolean not null default false,
  primary key (group_id, user_id)
);

-- One bill. Who paid and who shares it live in the next two tables.
create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  description   text not null check (char_length(description) between 1 and 100),
  amount_paise  bigint not null check (amount_paise > 0),
  currency      text not null default 'INR',
  category      text not null default 'general',
  spent_on      date not null default current_date,
  created_by    uuid not null default auth.uid() references public.profiles (id),
  created_at    timestamptz not null default now()
);
create index expenses_group_idx on public.expenses (group_id, spent_on desc);

-- Who paid for an expense (usually one person, sometimes several).
create table public.expense_payers (
  expense_id    uuid not null references public.expenses (id) on delete cascade,
  user_id       uuid not null references public.profiles (id),
  amount_paise  bigint not null check (amount_paise > 0),
  primary key (expense_id, user_id)
);

-- How much of an expense each person owes (their share).
create table public.expense_shares (
  expense_id    uuid not null references public.expenses (id) on delete cascade,
  user_id       uuid not null references public.profiles (id),
  amount_paise  bigint not null check (amount_paise >= 0),
  primary key (expense_id, user_id)
);

-- A payment that settles (part of) a debt.
create table public.settlements (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  from_user     uuid not null references public.profiles (id),
  to_user       uuid not null references public.profiles (id),
  amount_paise  bigint not null check (amount_paise > 0),
  method        text not null default 'upi' check (method in ('upi', 'cash', 'other')),
  settled_on    date not null default current_date,
  created_by    uuid not null default auth.uid() references public.profiles (id),
  created_at    timestamptz not null default now(),
  check (from_user <> to_user)
);
create index settlements_group_idx on public.settlements (group_id);


-- ---------------------------------------------------------------------------
-- 2. Helper functions used by the security policies
-- ---------------------------------------------------------------------------

-- "Is the logged-in user a member of this group?"
-- `security definer` lets it read group_members without tripping over the
-- group_members policy itself (which would loop forever).
create function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- "Do I share at least one group with this person?" (so I can see their name)
create function public.shares_group_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members them on them.group_id = me.group_id
    where me.user_id = auth.uid() and them.user_id = other
  );
$$;


-- ---------------------------------------------------------------------------
-- 3. Automatically create a profile when someone signs up
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Use the name typed at sign-up, or the part of the email before the @.
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- 4. Row Level Security policies
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.groups          enable row level security;
alter table public.group_members   enable row level security;
alter table public.expenses        enable row level security;
alter table public.expense_payers  enable row level security;
alter table public.expense_shares  enable row level security;
alter table public.settlements     enable row level security;

-- Profiles: see yourself and people in your groups; edit only yourself.
create policy "see own and group-mates' profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));
create policy "edit own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Groups: members can see and edit. Creating and joining go through the
-- create_group / join_group functions below.
create policy "members see group" on public.groups
  for select to authenticated using (public.is_group_member(id));
create policy "members edit group" on public.groups
  for update to authenticated
  using (public.is_group_member(id))
  with check (public.is_group_member(id));

-- Group members: see who else is in your groups; leave a group yourself.
create policy "members see members" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "update own membership" on public.group_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "leave group" on public.group_members
  for delete to authenticated using (user_id = (select auth.uid()));

-- Expenses: any member can see, add and delete expenses in their group.
create policy "members see expenses" on public.expenses
  for select to authenticated using (public.is_group_member(group_id));
create policy "members add expenses" on public.expenses
  for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = (select auth.uid()));
create policy "members delete expenses" on public.expenses
  for delete to authenticated using (public.is_group_member(group_id));

-- Payers and shares follow their expense's group.
create policy "members see payers" on public.expense_payers
  for select to authenticated using (
    exists (select 1 from public.expenses e
            where e.id = expense_id and public.is_group_member(e.group_id)));
create policy "members add payers" on public.expense_payers
  for insert to authenticated with check (
    exists (select 1 from public.expenses e
            where e.id = expense_id and public.is_group_member(e.group_id)));
create policy "members see shares" on public.expense_shares
  for select to authenticated using (
    exists (select 1 from public.expenses e
            where e.id = expense_id and public.is_group_member(e.group_id)));
create policy "members add shares" on public.expense_shares
  for insert to authenticated with check (
    exists (select 1 from public.expenses e
            where e.id = expense_id and public.is_group_member(e.group_id)));

-- Settlements: members see them; you can record a payment that involves you.
create policy "members see settlements" on public.settlements
  for select to authenticated using (public.is_group_member(group_id));
create policy "record own settlement" on public.settlements
  for insert to authenticated with check (
    public.is_group_member(group_id)
    and created_by = (select auth.uid())
    and (select auth.uid()) in (from_user, to_user)
  );
create policy "delete own settlement" on public.settlements
  for delete to authenticated using (created_by = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- 5. Functions the app calls (via supabase.rpc(...))
-- ---------------------------------------------------------------------------

-- Create a group and add the creator as its first member, in one step.
create function public.create_group(p_name text, p_emoji text default '👥')
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;

  insert into public.groups (name, emoji, created_by)
  values (trim(p_name), coalesce(nullif(p_emoji, ''), '👥'), auth.uid())
  returning * into new_group;

  insert into public.group_members (group_id, user_id)
  values (new_group.id, auth.uid());

  return new_group;
end;
$$;

-- Join a group using its invite code. Returns the group's id.
create function public.join_group(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;

  select id into gid from public.groups
  where invite_code = lower(trim(p_invite_code));

  if gid is null then
    raise exception 'That invite code does not match any group';
  end if;

  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid())
  on conflict do nothing; -- already a member? that's fine

  return gid;
end;
$$;

-- Add an expense with its payers and shares all at once, so we never end up
-- with half-saved data. Payers and shares are JSON arrays like:
--   [{"user_id": "…", "amount_paise": 15000}, …]
-- Runs as the logged-in user, so the RLS policies above still apply.
create function public.create_expense(
  p_group_id      uuid,
  p_description   text,
  p_amount_paise  bigint,
  p_payers        jsonb,
  p_shares        jsonb,
  p_category      text default 'general',
  p_spent_on      date default current_date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id       uuid;
  payer_total  bigint;
  share_total  bigint;
  outsiders    int;
begin
  -- The payers must add up to the bill, and so must the shares.
  select coalesce(sum((p ->> 'amount_paise')::bigint), 0) into payer_total
  from jsonb_array_elements(p_payers) p;
  select coalesce(sum((s ->> 'amount_paise')::bigint), 0) into share_total
  from jsonb_array_elements(p_shares) s;

  if payer_total <> p_amount_paise then
    raise exception 'Payers add up to % paise, but the bill is % paise', payer_total, p_amount_paise;
  end if;
  if share_total <> p_amount_paise then
    raise exception 'Shares add up to % paise, but the bill is % paise', share_total, p_amount_paise;
  end if;

  -- Everyone involved has to be in the group.
  select count(*) into outsiders
  from (
    select (x ->> 'user_id')::uuid as uid from jsonb_array_elements(p_payers) x
    union
    select (x ->> 'user_id')::uuid from jsonb_array_elements(p_shares) x
  ) people
  where not exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = people.uid
  );
  if outsiders > 0 then
    raise exception 'Everyone on an expense must be in the group';
  end if;

  insert into public.expenses (group_id, description, amount_paise, category, spent_on)
  values (p_group_id, trim(p_description), p_amount_paise, p_category, p_spent_on)
  returning id into new_id;

  insert into public.expense_payers (expense_id, user_id, amount_paise)
  select new_id, (x ->> 'user_id')::uuid, (x ->> 'amount_paise')::bigint
  from jsonb_array_elements(p_payers) x;

  insert into public.expense_shares (expense_id, user_id, amount_paise)
  select new_id, (x ->> 'user_id')::uuid, (x ->> 'amount_paise')::bigint
  from jsonb_array_elements(p_shares) x
  where (x ->> 'amount_paise')::bigint > 0;

  return new_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- 6. Live updates: let the app hear about new expenses and payments instantly
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.expenses, public.settlements;
