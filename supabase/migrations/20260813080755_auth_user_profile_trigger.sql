-- The trigger that `db pull` could not see.
--
-- `supabase db pull` captures the `public` schema only. `handle_new_user()`
-- lives in `public` and was captured by the baseline migration; the trigger
-- that actually invokes it sits on `auth.users` and was not.
--
-- Without this file the baseline restores a function nobody calls: new signups
-- would create an `auth.users` row with no `operator_profile`, which is exactly
-- the bricked-account bug Phase 0 closed. The gap is invisible until someone
-- rebuilds from migrations, which is the worst possible moment to find it.
--
-- This trigger already exists in production (applied by hand as Phase 0 step 2
-- on August 11, 2026). The statements below are idempotent, so applying this
-- migration to production is a no-op that simply brings the repo in line with
-- reality — and applying it to a fresh database creates it correctly.

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
