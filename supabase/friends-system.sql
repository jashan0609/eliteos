alter table operator_profile
  add column if not exists username text;

create unique index if not exists operator_profile_username_lower_unique
  on operator_profile ((lower(username)))
  where username is not null;

create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'canceled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_low_id < user_high_id),
  unique (user_low_id, user_high_id)
);

create unique index if not exists friend_requests_pending_pair_unique
  on friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  where status = 'pending';
create index if not exists friend_requests_sender_idx on friend_requests (sender_id, status, created_at desc);
create index if not exists friend_requests_receiver_idx on friend_requests (receiver_id, status, created_at desc);
create index if not exists friendships_low_idx on friendships (user_low_id);
create index if not exists friendships_high_idx on friendships (user_high_id);

grant select, insert, update, delete on friend_requests to authenticated;
grant select, insert, update, delete on friendships to authenticated;
grant select, insert, update, delete on friend_requests to service_role;
grant select, insert, update, delete on friendships to service_role;

alter table friend_requests enable row level security;
alter table friendships enable row level security;

drop policy if exists "Users read own friend requests" on friend_requests;
drop policy if exists "Users send friend requests" on friend_requests;
drop policy if exists "Users update inbound friend requests" on friend_requests;
drop policy if exists "Users cancel outbound friend requests" on friend_requests;
drop policy if exists "Users read own friendships" on friendships;
drop policy if exists "Users create own friendships" on friendships;
drop policy if exists "Users delete own friendships" on friendships;

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
