-- ═══════════════════════════════════════════════════════════
-- EliteOS — Service Role Grants
-- Run this in Supabase SQL Editor to restore server-side reset access
-- ═══════════════════════════════════════════════════════════

grant select, insert, update, delete on operator_profile to service_role;
grant select, insert, update, delete on objectives to service_role;
grant select, insert, update, delete on daily_habits to service_role;
grant select, insert, update, delete on non_negotiables to service_role;
grant select, insert, update, delete on daily_logs to service_role;
