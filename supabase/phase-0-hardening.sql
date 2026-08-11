-- ═══════════════════════════════════════════════════════════════════════
-- EliteOS — Phase 0 hardening
--
-- Run this ONCE, by hand, in the Supabase SQL editor. Phase 1 adopts the
-- Supabase CLI and captures this state as the migration baseline, after
-- which nothing is applied by hand again.
--
-- ⚠ DO NOT RUN THIS FILE IN ONE GO. The steps straddle a code deploy:
--
--   1. Run STEP 0 and read the output before doing anything else.
--   2. Run STEPS 1-3.  Safe against the CURRENTLY deployed code: once the
--      trigger exists the profile row is always present, so the client's
--      old insert path simply never fires.
--   3. Deploy this commit.  The new code REQUIRES the step 2 trigger — it
--      no longer creates profiles itself, and without the trigger a new
--      signup would land on the "Sync failed" screen.
--   4. Only then run STEP 4.  It breaks the OLD code's signup path, which
--      still reads operator_profile as `anon`.
--
-- Running step 4 early blocks all registration. Running steps 1-3 early is
-- harmless. When in doubt, stop after step 3.
-- ═══════════════════════════════════════════════════════════════════════


-- ═══ STEP 0 — Incident audit. READ THE OUTPUT BEFORE CONTINUING. ═══
--
-- Until step 1 below, any authenticated user could insert a friendship row
-- pairing themselves with an arbitrary victim, which grants them that
-- victim's username, xp, streak and full daily_logs via the leaderboard.
--
-- Every row this returns is a friendship with no accepted friend request
-- behind it — i.e. forged. Expect zero rows. If it returns rows, treat it
-- as a security incident: note the user ids, then delete them with the
-- DELETE immediately below.

select
  f.user_low_id,
  f.user_high_id,
  f.created_at,
  lo.username as low_username,
  hi.username as high_username
from friendships f
left join operator_profile lo on lo.id = f.user_low_id
left join operator_profile hi on hi.id = f.user_high_id
where not exists (
  select 1
  from friend_requests r
  where r.status = 'accepted'
    and least(r.sender_id, r.receiver_id)    = f.user_low_id
    and greatest(r.sender_id, r.receiver_id) = f.user_high_id
)
order by f.created_at desc;

-- Only after reviewing the above, uncomment and run:
--
-- delete from friendships f
-- where not exists (
--   select 1 from friend_requests r
--   where r.status = 'accepted'
--     and least(r.sender_id, r.receiver_id)    = f.user_low_id
--     and greatest(r.sender_id, r.receiver_id) = f.user_high_id
-- );


-- ═══ STEP 1 — Friendship and friend-request writes become server-only ═══
--
-- No client code writes either table; the only writers are the five routes
-- under src/app/api/friends/, which use the service-role key and therefore
-- bypass both RLS and these grants. Revoking is safe with no code change.

drop policy if exists "Users create own friendships"          on friendships;
drop policy if exists "Users delete own friendships"          on friendships;
drop policy if exists "Users send friend requests"            on friend_requests;
drop policy if exists "Users update inbound friend requests"  on friend_requests;
drop policy if exists "Users cancel outbound friend requests" on friend_requests;

revoke insert, update, delete on friendships     from authenticated;
revoke insert, update, delete on friend_requests from authenticated;

-- The SELECT policies stay: both are correctly scoped to the two parties.
--   friendships:     using (auth.uid() = user_low_id or auth.uid() = user_high_id)
--   friend_requests: using (auth.uid() = sender_id  or auth.uid() = receiver_id)


-- ═══ STEP 2 — The database creates profiles, not the client ═══
--
-- Previously the browser inserted operator_profile on first login and
-- discarded the error. A username collision therefore produced an auth
-- account with no profile row and a permanently stuck loading screen.
-- Moving creation into an auth.users trigger makes collisions impossible
-- to observe: the username is resolved by suffixing, in the same
-- transaction that creates the user.

-- Recreated here so this script does not depend on friends-system.sql
-- having been run.
create or replace function public.normalize_username_base(input text)
returns text
language sql
immutable
as $norm$
  select left(
    trim(both '_' from regexp_replace(lower(coalesce(input, 'operator')), '[^a-z0-9_]+', '_', 'g')),
    20
  )
$norm$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
-- Named dollar tag, not bare $$: if you paste this into the SQL editor and
-- cannot see BOTH `as $fn$` and the closing `$fn$;`, you have not copied the
-- whole function and Postgres will report an unterminated dollar-quoted string.
as $fn$
declare
  base      text;
  candidate text;
  i         int;
begin
  base := coalesce(
    nullif(public.normalize_username_base(new.raw_user_meta_data->>'username'), ''),
    nullif(public.normalize_username_base(split_part(new.email, '@', 1)), ''),
    'operator'
  );

  -- The app's username policy is 3-24 chars; pad anything shorter so the
  -- CHECK constraint added in Phase 5 cannot reject a signup.
  if length(base) < 3 then
    base := rpad(base, 3, '0');
  end if;

  candidate := base;

  -- Suffix on collision: name, name_2, name_3, ... Handling unique_violation
  -- rather than pre-checking makes this correct under concurrent signups.
  for i in 1..50 loop
    begin
      insert into public.operator_profile (id, username)
      values (new.id, candidate)
      on conflict (id) do nothing;
      return new;
    exception when unique_violation then
      candidate := left(base, greatest(1, 24 - length('_' || (i + 1)::text)))
                   || '_' || (i + 1)::text;
    end;
  end loop;

  -- Last resort. A uuid fragment is unique by construction, so signup can
  -- never fail on username contention.
  insert into public.operator_profile (id, username)
  values (new.id, left(base, 17) || '_' || substr(replace(new.id::text, '-', ''), 1, 6))
  on conflict (id) do nothing;

  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any account that never got a profile row — these are the
-- accounts bricked by the bug above. The uuid fragment guarantees no
-- collision with an existing username.
insert into public.operator_profile (id, username)
select
  u.id,
  left(
    coalesce(
      nullif(public.normalize_username_base(u.raw_user_meta_data->>'username'), ''),
      nullif(public.normalize_username_base(split_part(u.email, '@', 1)), ''),
      'operator'
    ),
    17
  ) || '_' || substr(replace(u.id::text, '-', ''), 1, 6)
from auth.users u
left join public.operator_profile p on p.id = u.id
where p.id is null
on conflict (id) do nothing;


-- ═══ STEP 3 — Report any account still without a profile ═══
-- Expect zero rows. Anything here means the backfill above failed.

select u.id, u.email, u.created_at
from auth.users u
left join operator_profile p on p.id = u.id
where p.id is null;


-- ═══ STEP 4 — Remove the anon read grants ═══
--
-- ⚠ RUN THIS ONLY AFTER THIS COMMIT IS DEPLOYED. See the header.
--
-- The signup username check used to read operator_profile as `anon`; RLS
-- made it return an empty set every time, so it always reported
-- "available". It now calls POST /api/auth/check-username, which uses the
-- service-role key and is unaffected by this revoke.
--
-- If you run this while the OLD code is still live, registration breaks for
-- everyone: the read starts returning a 403, and OperatorLogin renders the
-- error and refuses to continue.
--
-- PostgREST does not need any table grant to initialise; the comment in
-- the old supabase/grants.sql claiming otherwise is incorrect. These
-- grants were doing nothing but widening the blast radius of any future
-- permissive policy.

revoke select on operator_profile from anon;
revoke select on objectives       from anon;
revoke select on daily_habits     from anon;
revoke select on non_negotiables  from anon;
revoke select on daily_logs       from anon;


-- ═══ STEP 5 — Verify the lockdown ═══
--
-- Expect, for `authenticated`:
--   friend_requests   SELECT only          <- step 1 worked
--   friendships       SELECT only          <- step 1 worked
--   operator_profile  SELECT/INSERT/UPDATE/DELETE   } still wide open;
--   objectives        SELECT/INSERT/UPDATE/DELETE   } narrowing these to
--   daily_habits      SELECT/INSERT/UPDATE/DELETE   } column-level grants
--   non_negotiables   SELECT/INSERT/UPDATE/DELETE   } is PHASE 5, not
--   daily_logs        SELECT/INSERT/UPDATE/DELETE   } phase 0
--
-- And for `anon`: no rows at all.                   <- step 4 worked
--
-- XP remains client-writable until Phase 5. That is deliberate: the server
-- routes that replace those writes do not exist yet, so revoking now would
-- break the app.

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in (
    'operator_profile', 'objectives', 'daily_habits',
    'non_negotiables', 'daily_logs', 'friend_requests', 'friendships'
  )
order by grantee, table_name, privilege_type;
