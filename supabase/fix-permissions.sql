-- ═══════════════════════════════════════════════════════════
-- EliteOS — Fix Permissions (safe to run multiple times)
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── 1. Grants ──
grant select, insert, update, delete on operator_profile to authenticated;
grant select, insert, update, delete on objectives to authenticated;
grant select, insert, update, delete on daily_habits to authenticated;
grant select, insert, update, delete on non_negotiables to authenticated;
grant select, insert, update, delete on daily_logs to authenticated;

-- ── 2. Enable RLS (idempotent) ──
alter table operator_profile enable row level security;
alter table objectives enable row level security;
alter table daily_habits enable row level security;
alter table non_negotiables enable row level security;
alter table daily_logs enable row level security;

-- ── 3. Drop & recreate all policies ──

-- operator_profile
drop policy if exists "Users read own profile" on operator_profile;
drop policy if exists "Users update own profile" on operator_profile;
drop policy if exists "Users insert own profile" on operator_profile;
create policy "Users read own profile"   on operator_profile for select using (auth.uid() = id);
create policy "Users update own profile" on operator_profile for update using (auth.uid() = id);
create policy "Users insert own profile" on operator_profile for insert with check (auth.uid() = id);

-- objectives
drop policy if exists "Users read own objectives"   on objectives;
drop policy if exists "Users insert own objectives" on objectives;
drop policy if exists "Users update own objectives" on objectives;
drop policy if exists "Users delete own objectives" on objectives;
create policy "Users read own objectives"   on objectives for select using (auth.uid() = user_id);
create policy "Users insert own objectives" on objectives for insert with check (auth.uid() = user_id);
create policy "Users update own objectives" on objectives for update using (auth.uid() = user_id);
create policy "Users delete own objectives" on objectives for delete using (auth.uid() = user_id);

-- daily_habits
drop policy if exists "Users read own daily_habits"   on daily_habits;
drop policy if exists "Users insert own daily_habits" on daily_habits;
drop policy if exists "Users update own daily_habits" on daily_habits;
drop policy if exists "Users delete own daily_habits" on daily_habits;
create policy "Users read own daily_habits"   on daily_habits for select using (auth.uid() = user_id);
create policy "Users insert own daily_habits" on daily_habits for insert with check (auth.uid() = user_id);
create policy "Users update own daily_habits" on daily_habits for update using (auth.uid() = user_id);
create policy "Users delete own daily_habits" on daily_habits for delete using (auth.uid() = user_id);

-- non_negotiables
drop policy if exists "Users read own non_negotiables"   on non_negotiables;
drop policy if exists "Users insert own non_negotiables" on non_negotiables;
drop policy if exists "Users update own non_negotiables" on non_negotiables;
drop policy if exists "Users delete own non_negotiables" on non_negotiables;
create policy "Users read own non_negotiables"   on non_negotiables for select using (auth.uid() = user_id);
create policy "Users insert own non_negotiables" on non_negotiables for insert with check (auth.uid() = user_id);
create policy "Users update own non_negotiables" on non_negotiables for update using (auth.uid() = user_id);
create policy "Users delete own non_negotiables" on non_negotiables for delete using (auth.uid() = user_id);

-- daily_logs
drop policy if exists "Users read own daily_logs"   on daily_logs;
drop policy if exists "Users insert own daily_logs" on daily_logs;
drop policy if exists "Users update own daily_logs" on daily_logs;
create policy "Users read own daily_logs"   on daily_logs for select using (auth.uid() = user_id);
create policy "Users insert own daily_logs" on daily_logs for insert with check (auth.uid() = user_id);
create policy "Users update own daily_logs" on daily_logs for update using (auth.uid() = user_id);
