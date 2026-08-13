-- ═══════════════════════════════════════════════════════════════════════
-- Phase 5 — database lockdown
--
-- This is the migration that actually closes the XP hole. Until now any
-- logged-in operator could run
--
--   supabase.from('operator_profile').update({ xp: 999999 }).eq('id', myId)
--
-- from devtools and it would succeed, because `authenticated` held table-wide
-- UPDATE. Arena scores were forgeable the same way, which on a product whose
-- headline feature is a friends leaderboard is the whole product.
--
-- Phases 3 and 4 built and switched to server routes so the client no longer
-- needs those privileges. This removes them.
--
-- ── Why column-level grants rather than a blanket revoke ──
--
-- A blanket `revoke update on operator_profile` would also kill username
-- editing. Postgres checks UPDATE privilege per referenced column, and
-- PostgREST surfaces a clean 42501, so grants are narrowed to exactly the
-- columns the client still writes. That set was not guessed: it is the output
-- of `npm run preflight:phase5`, which audits every client file for writes.
--
--   operator_profile   username
--   objectives         type, title, description
--   daily_habits       title
--   non_negotiables    title
--   daily_logs         nothing at all
--
-- Note `timezone` is deliberately NOT granted. The plan assumed the client
-- still wrote it; since Phase 4 it does not — POST /api/system/sync owns it.
-- ═══════════════════════════════════════════════════════════════════════


-- ═══ 1. operator_profile ═══
--
-- Creation belongs to the `on_auth_user_created` trigger, so INSERT goes away
-- entirely along with its policy. The client-side insert this replaced is the
-- one that used to brick accounts on a username collision.

-- DELETE goes too. There is no policy permitting it today, so RLS already
-- matches zero rows — but the grant remaining is a loaded gun: deleting a
-- profile does *not* cascade to auth.users, so it would leave an auth account
-- with no profile, which is precisely the bricked state Phase 0 fixed.
-- Account deletion is Phase 8, via the admin API, and removes the auth user.
revoke insert, update, delete on public.operator_profile from authenticated;
grant  update (username) on public.operator_profile to authenticated;

drop policy if exists "Users insert own profile" on public.operator_profile;

-- Every surviving UPDATE policy gains WITH CHECK. USING alone governs which
-- rows may be *targeted*, not what they may become — so without this a widened
-- grant would permit re-parenting a row to another operator.
drop policy if exists "Users update own profile" on public.operator_profile;
create policy "Users update own profile"
  on public.operator_profile for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ═══ 2. daily_habits ═══
--
-- `completed_today` and `streak` are now written only by
-- /api/economy/habit/toggle and the daily reset, both service-role.

revoke insert, update on public.daily_habits from authenticated;
grant  insert (user_id, title) on public.daily_habits to authenticated;
grant  update (title)          on public.daily_habits to authenticated;

drop policy if exists "Users update own daily_habits" on public.daily_habits;
create policy "Users update own daily_habits"
  on public.daily_habits for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ═══ 3. non_negotiables ═══

revoke insert, update on public.non_negotiables from authenticated;
grant  insert (user_id, title) on public.non_negotiables to authenticated;
grant  update (title)          on public.non_negotiables to authenticated;

drop policy if exists "Users update own non_negotiables" on public.non_negotiables;
create policy "Users update own non_negotiables"
  on public.non_negotiables for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ═══ 4. objectives ═══
--
-- `progress` and `status` move to /api/economy/objective/progress, which
-- compare-and-swaps on progress so a double-tap cannot award twice.

revoke insert, update on public.objectives from authenticated;
grant  insert (user_id, type, title, description) on public.objectives to authenticated;
grant  update (title, description)                on public.objectives to authenticated;

drop policy if exists "Users update own objectives" on public.objectives;
create policy "Users update own objectives"
  on public.objectives for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ═══ 5. daily_logs — server-only ═══
--
-- This is what kills Arena forgery. Logs are the scoring input; while the
-- client could insert them, any operator could manufacture a perfect week.
-- Archiving now happens only in src/lib/server/run-daily-reset.ts.

revoke insert, update, delete on public.daily_logs from authenticated;

drop policy if exists "Users insert own daily_logs" on public.daily_logs;
drop policy if exists "Users update own daily_logs" on public.daily_logs;
-- The SELECT policy stays: operators read their own history, and the
-- leaderboard reads friends' logs through a service-role route.


-- ═══ 6. CHECK constraints ═══
--
-- Audited against production on August 13, 2026 before writing this: 13
-- profiles with zero username-format violations, no negative xp/streak, no
-- out-of-range progress, no negative penalties, longest title 27 chars,
-- longest description 37. Every constraint below is satisfied by current data,
-- so these validate immediately rather than needing NOT VALID.

alter table public.operator_profile
  add constraint operator_profile_xp_non_negative     check (xp >= 0),
  add constraint operator_profile_streak_non_negative check (streak >= 0),
  -- Matches `usernamePattern` in OperatorLogin.tsx and the API route. The
  -- database is the authority; the other two are convenience.
  add constraint operator_profile_username_format
    check (username ~ '^[a-z0-9_]{3,24}$');

alter table public.objectives
  add constraint objectives_progress_range check (progress between 0 and 100),
  add constraint objectives_title_length   check (char_length(title) between 1 and 200),
  add constraint objectives_description_length
    check (description is null or char_length(description) <= 1000);

alter table public.daily_habits
  add constraint daily_habits_title_length   check (char_length(title) between 1 and 200),
  add constraint daily_habits_streak_non_negative check (streak >= 0);

alter table public.non_negotiables
  add constraint non_negotiables_title_length   check (char_length(title) between 1 and 200),
  add constraint non_negotiables_streak_non_negative check (streak >= 0);

alter table public.daily_logs
  add constraint daily_logs_penalty_non_negative check (penalty >= 0),
  add constraint daily_logs_xp_non_negative      check (total_xp_at_time >= 0);


-- ═══ 7. Per-operator row caps ═══
--
-- Public signup means someone will eventually insert 50,000 rows. A CHECK
-- cannot count sibling rows, so this is a trigger. 100 is far above real use —
-- the busiest operator today has 9 objectives, 2 non-negotiables, 1 habit.

create or replace function public.enforce_row_cap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $cap$
declare
  row_count integer;
  cap       constant integer := 100;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name)
    into row_count
    using new.user_id;

  if row_count >= cap then
    raise exception 'Limit of % rows reached for %', cap, tg_table_name
      using errcode = 'check_violation';
  end if;

  return new;
end;
$cap$;

drop trigger if exists cap_objectives      on public.objectives;
drop trigger if exists cap_daily_habits    on public.daily_habits;
drop trigger if exists cap_non_negotiables on public.non_negotiables;

create trigger cap_objectives
  before insert on public.objectives
  for each row execute function public.enforce_row_cap();

create trigger cap_daily_habits
  before insert on public.daily_habits
  for each row execute function public.enforce_row_cap();

create trigger cap_non_negotiables
  before insert on public.non_negotiables
  for each row execute function public.enforce_row_cap();
