-- Phase 5 grant matrix, asserted.
--
-- Run with `supabase test db`. This is the durable guard: it is the only thing
-- that will stop someone re-running a `grants.sql`-shaped file in six months
-- and silently reopening the hole. Wire it into CI in Phase 7.
--
-- The approach is to become `authenticated` with a JWT claim naming a real
-- operator, then attempt each write the client must no longer be able to make.
-- Asserting on catalog contents would prove the grants exist; this proves they
-- actually stop the write, which is the property that matters.

begin;
select plan(20);

-- ── Fixtures ─────────────────────────────────────────────────────────────
-- Two operators, so cross-user attempts can be tested as well as self-writes.

insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'alice@test.local', '{"username":"alice_test"}'),
  ('22222222-2222-4222-8222-222222222222', 'mallory@test.local', '{"username":"mallory_test"}');

-- The on_auth_user_created trigger creates operator_profile rows. That it does
-- so is itself worth asserting — a rebuild that loses the trigger produces
-- accounts with no profile, which is the bricked-signup bug.
select is(
  (select count(*)::int from public.operator_profile
    where id in ('11111111-1111-4111-8111-111111111111',
                 '22222222-2222-4222-8222-222222222222')),
  2,
  'on_auth_user_created creates a profile for each new auth user'
);

insert into public.objectives (id, user_id, type, title, description, progress, status)
values ('33333333-3333-4333-8333-333333333333',
        '11111111-1111-4111-8111-111111111111',
        'sprint', 'Alice objective', 'desc', 50, 'Active');

insert into public.daily_habits (id, user_id, title, completed_today, streak)
values ('44444444-4444-4444-8444-444444444444',
        '11111111-1111-4111-8111-111111111111', 'Alice habit', false, 0);

insert into public.non_negotiables (id, user_id, title, completed_today, streak)
values ('55555555-5555-4555-8555-555555555555',
        '11111111-1111-4111-8111-111111111111', 'Alice NN', false, 0);

update public.operator_profile set xp = 100
  where id = '11111111-1111-4111-8111-111111111111';

-- ── Become Alice ─────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- ── The headline: XP is no longer client-writable ────────────────────────

select throws_ok(
  $$ update public.operator_profile set xp = 999999
       where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  null,
  'an operator cannot inflate their own XP'
);

select throws_ok(
  $$ update public.operator_profile set streak = 9999
       where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  null,
  'an operator cannot inflate their own streak'
);

select throws_ok(
  $$ update public.operator_profile set last_habit_reset = '2000-01-01'
       where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  null,
  'an operator cannot rewrite last_habit_reset to replay the daily reset'
);

-- ── Arena forgery is closed ──────────────────────────────────────────────

select throws_ok(
  $$ insert into public.daily_logs
       (user_id, date, nn_summary, habit_summary, total_xp_at_time, penalty)
     values ('11111111-1111-4111-8111-111111111111', '2026-01-01',
             '[]'::jsonb, '[]'::jsonb, 99999, 0) $$,
  '42501',
  null,
  'an operator cannot manufacture a daily_log to forge an Arena score'
);

select throws_ok(
  $$ update public.daily_logs set total_xp_at_time = 99999 $$,
  '42501',
  null,
  'an operator cannot edit an archived daily_log'
);

select throws_ok(
  $$ delete from public.daily_logs $$,
  '42501',
  null,
  'an operator cannot delete an archived daily_log'
);

-- ── Habit completion is server-owned ─────────────────────────────────────

select throws_ok(
  $$ update public.daily_habits set completed_today = true
       where id = '44444444-4444-4444-8444-444444444444' $$,
  '42501',
  null,
  'an operator cannot mark a daily habit complete directly'
);

select throws_ok(
  $$ update public.non_negotiables set streak = 500
       where id = '55555555-5555-4555-8555-555555555555' $$,
  '42501',
  null,
  'an operator cannot inflate a non-negotiable streak'
);

select throws_ok(
  $$ update public.objectives set progress = 100, status = 'Completed'
       where id = '33333333-3333-4333-8333-333333333333' $$,
  '42501',
  null,
  'an operator cannot complete an objective directly to claim its award'
);

-- ── The friendship hole stays closed (Phase 0, re-asserted) ──────────────

select throws_ok(
  $$ insert into public.friendships (user_low_id, user_high_id)
     values ('11111111-1111-4111-8111-111111111111',
             '22222222-2222-4222-8222-222222222222') $$,
  '42501',
  null,
  'an operator cannot forge a friendship to read another operator''s data'
);

-- ── What must still work ─────────────────────────────────────────────────

select lives_ok(
  $$ update public.operator_profile set username = 'alice_renamed'
       where id = '11111111-1111-4111-8111-111111111111' $$,
  'an operator can still rename themselves'
);

select lives_ok(
  $$ update public.daily_habits set title = 'Renamed habit'
       where id = '44444444-4444-4444-8444-444444444444' $$,
  'an operator can still retitle a daily habit'
);

select lives_ok(
  $$ update public.objectives set title = 'Renamed', description = 'New'
       where id = '33333333-3333-4333-8333-333333333333' $$,
  'an operator can still edit an objective title and description'
);

select lives_ok(
  $$ insert into public.objectives (user_id, type, title, description)
     values ('11111111-1111-4111-8111-111111111111',
             'sprint', 'Another', 'desc') $$,
  'an operator can still create an objective'
);

select lives_ok(
  $$ delete from public.objectives
       where id = '33333333-3333-4333-8333-333333333333' $$,
  'an operator can still delete their own objective'
);

select throws_ok(
  $$ delete from public.operator_profile
       where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  null,
  'an operator cannot delete their profile row and strand their auth account'
);

-- ── Cross-user isolation ─────────────────────────────────────────────────
-- RLS, not grants: the write is permitted but must match zero rows.

update public.operator_profile set username = 'stolen'
  where id = '22222222-2222-4222-8222-222222222222';

reset role;
select is(
  (select username from public.operator_profile
     where id = '22222222-2222-4222-8222-222222222222'),
  'mallory_test',
  'one operator cannot rename another, even on a granted column'
);

-- ── Constraints reject bad data even from the server role ────────────────

select throws_ok(
  $$ update public.operator_profile set xp = -1
       where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514',
  null,
  'the xp >= 0 CHECK holds even for service_role'
);

select throws_ok(
  $$ update public.operator_profile set username = 'Has Spaces'
       where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514',
  null,
  'the username format CHECK holds even for service_role'
);

select * from finish();
rollback;
