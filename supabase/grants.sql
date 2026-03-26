-- ═══════════════════════════════════════════════════════════
-- EliteOS Table Grants
-- Run this in Supabase SQL Editor to fix 403 errors
-- ═══════════════════════════════════════════════════════════

-- Grant the authenticated role access to all tables
grant select, insert, update, delete on operator_profile to authenticated;
grant select, insert, update, delete on objectives to authenticated;
grant select, insert, update, delete on daily_habits to authenticated;
grant select, insert, update, delete on non_negotiables to authenticated;
grant select, insert, update, delete on daily_logs to authenticated;

-- Also grant anon role select (needed for Supabase client initialization)
grant select on operator_profile to anon;
grant select on objectives to anon;
grant select on daily_habits to anon;
grant select on non_negotiables to anon;
grant select on daily_logs to anon;
