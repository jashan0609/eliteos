-- ═══════════════════════════════════════════════════════════
-- EliteOS Database Schema — Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Operator profile (one row per user)
create table if not exists operator_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  xp integer not null default 0,
  streak integer not null default 0,
  last_check_in timestamptz,
  last_habit_reset date,
  timezone text not null default 'UTC',
  ghost_opt_in boolean not null default false,
  ghost_opted_in_at timestamptz,
  initialized_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2. Objectives
create table if not exists objectives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('north-star', 'sprint')),
  title text not null,
  description text not null default '',
  progress integer not null default 0,
  status text not null default 'Active' check (status in ('Active', 'Completed')),
  created_at timestamptz not null default now()
);

-- 3. Daily Habits
create table if not exists daily_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed_today boolean not null default false,
  streak integer not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Non-Negotiables
create table if not exists non_negotiables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed_today boolean not null default false,
  streak integer not null default 0,
  created_at timestamptz not null default now()
);

-- 5. Daily Performance Logs
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  nn_summary jsonb not null default '[]',
  habit_summary jsonb not null default '[]',
  total_xp_at_time integer not null default 0,
  penalty integer not null default 0,
  created_at timestamptz not null default now()
);

-- 6. Friend Requests
create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'canceled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);

-- 7. Friendships
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_low_id < user_high_id),
  unique (user_low_id, user_high_id)
);

create unique index if not exists operator_profile_username_lower_unique
  on operator_profile ((lower(username)))
  where username is not null;
create unique index if not exists friend_requests_pending_pair_unique
  on friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  where status = 'pending';
create index if not exists friend_requests_sender_idx on friend_requests (sender_id, status, created_at desc);
create index if not exists friend_requests_receiver_idx on friend_requests (receiver_id, status, created_at desc);
create index if not exists friendships_low_idx on friendships (user_low_id);
create index if not exists friendships_high_idx on friendships (user_high_id);

-- ═══ Table Grants ═══

grant select, insert, update, delete on operator_profile to authenticated;
grant select, insert, update, delete on objectives to authenticated;
grant select, insert, update, delete on daily_habits to authenticated;
grant select, insert, update, delete on non_negotiables to authenticated;
grant select, insert, update, delete on daily_logs to authenticated;
grant select, insert, update, delete on friend_requests to authenticated;
grant select, insert, update, delete on friendships to authenticated;
grant select, insert, update, delete on operator_profile to service_role;
grant select, insert, update, delete on objectives to service_role;
grant select, insert, update, delete on daily_habits to service_role;
grant select, insert, update, delete on non_negotiables to service_role;
grant select, insert, update, delete on daily_logs to service_role;
grant select, insert, update, delete on friend_requests to service_role;
grant select, insert, update, delete on friendships to service_role;

grant select on operator_profile to anon;
grant select on objectives to anon;
grant select on daily_habits to anon;
grant select on non_negotiables to anon;
grant select on daily_logs to anon;

-- ═══ Row Level Security ═══

alter table operator_profile enable row level security;
alter table objectives enable row level security;
alter table daily_habits enable row level security;
alter table non_negotiables enable row level security;
alter table daily_logs enable row level security;
alter table friend_requests enable row level security;
alter table friendships enable row level security;

-- Policies: users can only access their own data
create policy "Users read own profile" on operator_profile for select using (auth.uid() = id);
create policy "Users update own profile" on operator_profile for update using (auth.uid() = id);
create policy "Users insert own profile" on operator_profile for insert with check (auth.uid() = id);

create policy "Users read own objectives" on objectives for select using (auth.uid() = user_id);
create policy "Users insert own objectives" on objectives for insert with check (auth.uid() = user_id);
create policy "Users update own objectives" on objectives for update using (auth.uid() = user_id);
create policy "Users delete own objectives" on objectives for delete using (auth.uid() = user_id);

create policy "Users read own daily_habits" on daily_habits for select using (auth.uid() = user_id);
create policy "Users insert own daily_habits" on daily_habits for insert with check (auth.uid() = user_id);
create policy "Users update own daily_habits" on daily_habits for update using (auth.uid() = user_id);
create policy "Users delete own daily_habits" on daily_habits for delete using (auth.uid() = user_id);

create policy "Users read own non_negotiables" on non_negotiables for select using (auth.uid() = user_id);
create policy "Users insert own non_negotiables" on non_negotiables for insert with check (auth.uid() = user_id);
create policy "Users update own non_negotiables" on non_negotiables for update using (auth.uid() = user_id);
create policy "Users delete own non_negotiables" on non_negotiables for delete using (auth.uid() = user_id);

create policy "Users read own daily_logs" on daily_logs for select using (auth.uid() = user_id);
create policy "Users insert own daily_logs" on daily_logs for insert with check (auth.uid() = user_id);
create policy "Users update own daily_logs" on daily_logs for update using (auth.uid() = user_id);
create policy "Users delete own daily_logs" on daily_logs for delete using (auth.uid() = user_id);

create policy "Users read own friend requests" on friend_requests
for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Users send friend requests" on friend_requests
for insert with check (auth.uid() = sender_id);
create policy "Users update inbound friend requests" on friend_requests
for update using (auth.uid() = receiver_id);
create policy "Users cancel outbound friend requests" on friend_requests
for update using (auth.uid() = sender_id);

create policy "Users read own friendships" on friendships
for select using (auth.uid() = user_low_id or auth.uid() = user_high_id);
create policy "Users create own friendships" on friendships
for insert with check (auth.uid() = user_low_id or auth.uid() = user_high_id);
create policy "Users delete own friendships" on friendships
for delete using (auth.uid() = user_low_id or auth.uid() = user_high_id);
