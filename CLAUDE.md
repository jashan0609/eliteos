@AGENTS.md

# EliteOS Project Memory

This file is a full working memory for the current EliteOS codebase as of August 11, 2026.

It is meant to help future agents and collaborators understand:

- what the app does
- what has already been implemented
- which database scripts matter
- which product decisions have already been made
- what behavior is expected in the UI and backend

## 1. Product Summary

EliteOS is a gamified personal operating system built with Next.js, React, and Supabase.

Core user flows:

- sign up / sign in
- manage objectives
- manage daily habits
- manage non-negotiables
- earn XP and maintain streaks
- archive daily logs at reset
- compare performance with friends in the Arena
- view account data in a Profile tab

The app is mobile-friendly and uses a custom dark terminal / glassmorphism visual style.

## 2. Current High-Level Feature Set

### Authentication

- Email/password auth is handled with Supabase.
- Signup now requires a username.
- Username policy:
  - 3-24 characters
  - lowercase letters
  - numbers
  - underscore only
- Username is collected during account creation, not later in the Arena.
- Username availability is checked **server-side** via
  `POST /api/auth/check-username`, which uses the service-role key. The
  browser cannot read `operator_profile` for anyone but itself, so a
  client-side availability check is structurally impossible — an earlier one
  ran as `anon`, matched zero rows under RLS, and reported every username as
  available. That check is advisory only; the database is the authority.
- The `operator_profile` row is created by the `on_auth_user_created` trigger
  on `auth.users`, **not** by the client. The trigger resolves collisions by
  suffixing (`name`, `name_2`, ...), so signup cannot fail on username
  contention.

Not yet implemented: password reset, email change, account deletion, and data
export. A forgotten password is currently an unrecoverable lockout. Email
confirmation is configured off; see section 17.

Relevant files:

- [src/context/AuthContext.tsx](/Users/jashanubhi/Desktop/coding/elite/src/context/AuthContext.tsx)
- [src/components/OperatorLogin.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/OperatorLogin.tsx)
- [src/app/api/auth/check-username/route.ts](/Users/jashanubhi/Desktop/coding/elite/src/app/api/auth/check-username/route.ts)

### Dashboard

- Dashboard shows:
  - XP trend chart
  - goal progress
  - non-negotiable progress
  - daily habits progress
  - quick stats

Relevant file:

- [src/components/Dashboard.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/Dashboard.tsx)

### Objectives

- Users can add, edit, delete, and progress objectives.
- Objective types:
  - `north-star`
  - `sprint`
- Objective completion rewards XP.

Relevant files:

- [src/components/ObjectivesView.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/ObjectivesView.tsx)
- [src/components/AddObjectiveModal.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/AddObjectiveModal.tsx)

### Habits and Non-Negotiables

- Users can add, edit, delete, and toggle:
  - daily habits
  - non-negotiables
- Toggling affects XP immediately.
- Streaks are persisted and updated at daily reset.

Relevant files:

- [src/components/HabitsView.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/HabitsView.tsx)
- [src/context/EliteContext.tsx](/Users/jashanubhi/Desktop/coding/elite/src/context/EliteContext.tsx)

### Daily Reset

- Daily reset archives the previous day into `daily_logs`.
- It resets `completed_today` flags on habits and non-negotiables.
- It updates:
  - user XP after penalties
  - per-habit streaks
  - overall streak
  - `last_habit_reset`
- Reset is timezone-aware per user profile.

Relevant files:

- [src/lib/daily-reset.ts](/Users/jashanubhi/Desktop/coding/elite/src/lib/daily-reset.ts)
- [src/app/api/system/reset/route.ts](/Users/jashanubhi/Desktop/coding/elite/src/app/api/system/reset/route.ts)

### Arena (Friends Competition)

The old anonymous Ghost benchmark was replaced with a friends-based Arena.

Current Arena behavior:

- add friends by username
- incoming friend requests
- outgoing friend requests
- accept / decline incoming requests
- cancel outgoing requests
- unfriend existing friends
- see a rolling 7-day leaderboard for self + friends

Leaderboard fields:

- rank
- username
- XP
- streak
- 7-day score

Friend actions use confirmations in the UI.

Relevant files:

- [src/components/GhostView.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/GhostView.tsx)
- [src/lib/arena.ts](/Users/jashanubhi/Desktop/coding/elite/src/lib/arena.ts)
- [src/app/api/friends/request/route.ts](/Users/jashanubhi/Desktop/coding/elite/src/app/api/friends/request/route.ts)
- [src/app/api/friends/respond/route.ts](/Users/jashanubhi/Desktop/coding/elite/src/app/api/friends/respond/route.ts)
- [src/app/api/friends/remove/route.ts](/Users/jashanubhi/Desktop/coding/elite/src/app/api/friends/remove/route.ts)
- [src/app/api/friends/requests/route.ts](/Users/jashanubhi/Desktop/coding/elite/src/app/api/friends/requests/route.ts)
- [src/app/api/friends/leaderboard/route.ts](/Users/jashanubhi/Desktop/coding/elite/src/app/api/friends/leaderboard/route.ts)

### Profile Tab

There is now a dedicated Profile tab.

Profile tab shows:

- username
- email
- created date
- timezone
- level / rank
- XP
- streak
- friend count

Profile tab also allows username editing.

Username editing follows the same validation policy as signup.

Relevant file:

- [src/components/ProfileView.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/ProfileView.tsx)

### Logs

Logs were changed to reduce over-storage.

Current logs behavior:

- Logs tab shows only the latest 7 logs by default.
- A `MORE` button expands to show the rest of the retained logs.
- `SHOW LESS` collapses back to the first 7.
- Only recent-month logs are loaded from the client.

Relevant files:

- [src/components/LogsView.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/LogsView.tsx)
- [src/context/EliteContext.tsx](/Users/jashanubhi/Desktop/coding/elite/src/context/EliteContext.tsx)

## 3. Important Product Decisions Already Made

These decisions should be treated as current intent unless the user explicitly changes them:

- Arena is friends-based, not anonymous.
- Username is required at signup.
- Username is no longer configured from the Arena tab.
- Existing legacy users should get usernames based on email prefix before `@`.
- Username collisions for legacy users are resolved deterministically with suffixes like `_2`, `_3`, etc.
- Profile tab exists and username editing lives there.
- Logs are retained only for a recent rolling month.
- Logs UI is weekly-first with expandable older entries inside that recent-month window.

Decisions made during the production-hardening work (August 11, 2026):

- **The app is being taken to public signups.** Assume strangers can register;
  that is the bar for security, abuse, and compliance decisions.
- **XP and streaks become server-authoritative via Next.js API routes**, reusing
  `requireUserFromBearer` and `supabaseAdmin`. Explicitly *not* Postgres RPCs —
  the economy logic stays in TypeScript so it shares one tested implementation
  with the client-side types and `src/lib/`.
- **The database moves to Supabase CLI migrations.** The hand-run `.sql` files
  are being retired; see section 5.
- **Email confirmation will be turned on**, which requires real SMTP and a
  corrected `site_url`.

## 4. Database Model Overview

Main tables in active use:

- `operator_profile`
- `objectives`
- `daily_habits`
- `non_negotiables`
- `daily_logs`
- `friend_requests`
- `friendships`

### operator_profile

Important fields:

- `id`
- `username`
- `xp`
- `streak`
- `last_check_in`
- `last_habit_reset`
- `timezone`
- `initialized_at`
- `created_at`

Legacy fields still present:

- `ghost_opt_in`
- `ghost_opted_in_at`

These Ghost fields remain in schema for backward compatibility, but product behavior no longer depends on anonymous Ghost mode.

### friend_requests

Used for pending / accepted / declined / canceled friend request flow.

Important columns:

- `sender_id`
- `receiver_id`
- `status`
- `created_at`
- `responded_at`

**Write access is service-role only.** `authenticated` holds SELECT and nothing
else. All mutations go through the routes under `src/app/api/friends/`.

### friendships

Stores accepted friend relationships using a canonical low/high pair:

- `user_low_id`
- `user_high_id`

**Write access is service-role only**, same as `friend_requests`. This is a
security boundary, not a style choice: the previous INSERT policy only checked
that the caller was one of the two people in the pair, so any authenticated
user could insert `(self, victim)` through the anon-key client and then read
that victim's username, XP, streak and full `daily_logs` from the leaderboard —
no request, no consent. Do not re-grant INSERT/UPDATE/DELETE on this table to
`authenticated`.

The leaderboard route additionally cross-checks every friendship against an
accepted `friend_requests` row and logs `[FRIENDSHIP_WITHOUT_ACCEPTED_REQUEST]`
for any that fail. That is a deliberate tripwire — if it ever fires, someone has
write access they should not have.

### daily_logs

Archived day summaries used for:

- logs UI
- Arena scoring
- XP history chart

## 5. Database Migrations

**The schema lives in `supabase/migrations/` and nowhere else.** The eleven
hand-run `.sql` files that used to sit here were deleted on August 13, 2026,
when Phase 1 landed. Git has them if you ever need the archaeology; do not
resurrect them, and above all do not run them — `fix-permissions.sql` and
`grants.sql` would silently re-grant exactly what Phase 0 revoked and reopen
the friendship data-exposure hole.

### The baseline

- `supabase/migrations/20260813080640_remote_schema.sql` — captured mechanically
  with `supabase db pull` against production. It is *reality*, not an idealised
  schema: 7 tables, 20 policies, RLS on every table, the FK cascades to
  `auth.users`, and the `daily_logs_user_date_idx` unique index that existed in
  production but appeared in no repo file. `db pull` also recorded it as
  already-applied remotely, so a later `db push` will not re-run this DDL
  against live data.
- `supabase/migrations/20260813080755_auth_user_profile_trigger.sql` — the
  `on_auth_user_created` trigger. **`db pull` captures the `public` schema
  only**, so it took `handle_new_user()` (which lives in `public`) but not the
  trigger on `auth.users` that invokes it. Without this file a rebuild produces
  a function nobody calls, and new signups get an auth row with no profile —
  the bricked-account bug all over again. Idempotent, so applying it to
  production is a no-op.

Verified on August 13, 2026: both migrations apply cleanly to a database built
from scratch (`supabase start`), and the resulting database has the trigger on
`auth.users`, SELECT-only grants for `authenticated` on the friend tables, the
unique index, and zero `anon` grants in `public`. `supabase db diff --linked
--schema public` reports no schema changes.

### The blind spot that bit us twice

`db pull --schema public` does not see the `auth`, `cron`, or `storage`
schemas. Two things lived there and were nearly lost:

- the `on_auth_user_created` trigger (now pinned by its own migration above);
- the `pg_cron` jobs, which are **not** in any migration and must be managed by
  hand in the SQL editor. See section 6.

If you add anything outside `public`, write it a migration by hand — the pull
will not do it for you.

### Adding a schema change

`supabase migration new <name>`, edit the generated file, verify locally with
`supabase db reset`, then `supabase db push`. Nothing is applied by hand again.

## 6. Logs Retention Rules

Current retention strategy:

- keep only recent rolling month of `daily_logs`
- show only first 7 logs in UI initially
- reveal rest of retained logs when user clicks `MORE`

Important implication:

- the DB is intentionally not a long-term historical warehouse anymore
- old log months should be pruned
- anything that depends on `daily_logs` should be designed around short-term history

### Scheduled jobs (not in any migration)

Two schedulers exist and neither is captured by `supabase db pull`. Audited
August 13, 2026 with `select jobid, jobname, schedule, command from cron.job;`:

- **`eliteos-log-retention`** (`pg_cron`, `15 1 * * *`) — **live and load-bearing.**
  Runs `delete from daily_logs where date < (current_date - interval '1 month')`.
  This is what enforces the rolling month; the 31 days of history observed in
  production match it exactly. Do not remove it. Known cosmetic flaw: it
  compares against `current_date` (UTC) while log dates are written in each
  user's local day, so an operator well ahead of UTC can lose a log a few hours
  early.
- **Vercel cron** (`vercel.json`, `0 * * * *`) — hits `/api/system/reset` hourly.
  The `last_habit_reset === today` guard makes it idempotent, so hourly is safe
  and closes the timezone-lateness window. **This is the real reset scheduler.**

A third job, `daily-system-reset` (`pg_cron`, `0 0 * * *`), was unscheduled on
August 13, 2026. It had never worked: its URL was the literal, unsubstituted
placeholder `https://<REFERENCE_ID>.supabase.co/functions/v1/daily-reset`, a
hostname that has never resolved, pointing at a Supabase Edge Function that was
never deployed. (Earlier revisions of this file claimed it failed by reading an
unset GUC and sending an empty `Bearer ` — that diagnosis was wrong. The
conclusion, that the job was dead, was right.)

## 7. Arena Scoring Rules

Arena scoring uses recent archived logs and streaks.

The score calculation lives in [src/lib/arena.ts](/Users/jashanubhi/Desktop/coding/elite/src/lib/arena.ts).

Current scoring behavior:

- built from latest 7 logs
- uses:
  - non-negotiable compliance
  - daily habit completion
  - streak factor
- leaderboard sorts by:
  - score descending
  - XP descending
  - username ascending

## 8. Auth / Profile Flow

Current behavior:

- register with email + password + username
- username is validated client-side, then checked for availability against
  `POST /api/auth/check-username`
- `signUp` writes the username into auth metadata; the `on_auth_user_created`
  trigger reads it and creates the `operator_profile` row in the same
  transaction as the account
- login loads app state from Supabase
- **the client never creates the profile row.** If `fetchSystemState` finds no
  profile, that is an error condition and the app shows a retry screen — it
  does not attempt to self-heal by inserting one

Important notes:

- runtime username auto-generation was intentionally removed after the required-signup-username change
- future changes should avoid silently generating usernames again unless the user explicitly requests that behavior
- the trigger's collision suffixing is *not* a violation of that rule: it is a
  last-resort uniqueness guarantee inside a transaction, not a UX affordance.
  It exists because the alternative — failing the insert — produced auth
  accounts with no profile row and an unescapable loading screen.
- `fetchSystemState` returns its state rather than committing it, so a single
  `finally` clears the loading flag on every exit path. Preserve that shape.
  The previous version had early returns that skipped `setLoading(false)`,
  which is what made the failure permanent rather than merely visible.

## 9. Known Historical Milestones

Recent major implementation history from git:

- `609c4ca` fixed reset logic
- `bb912e9` / `74f6dcb` daily reset login work
- `6acaf71` speed up boot animation and remove Wasted Potential card
- `e5f3466` replaced Ghost arena with friends-based competition
- `9f8ba26` required signup usernames and added profile tab
- `e6d431a` limited logs to weekly view and monthly retention
- `d5d68ff` added the unit test suite for reset and arena logic
- `a41c845` Phase 0 hardening: friends access, signup, daily reset

This timeline is useful when tracing why certain product decisions exist.

## 10. Current App Navigation

Current tabs:

- dashboard
- objectives
- arena
- habits
- logs
- profile

Relevant files:

- [src/app/page.tsx](/Users/jashanubhi/Desktop/coding/elite/src/app/page.tsx)
- [src/components/Sidebar.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/Sidebar.tsx)

## 11. Testing That Has Already Been Done

The project has already had several rounds of verification during previous work:

- lint / build verification after major changes
- API security checks confirming unauthorized friend endpoints return `401`
- end-to-end backend verification for Arena lifecycle:
  - create temporary users
  - send request
  - accept request
  - verify leaderboard
  - remove friend
  - verify cleanup

That backend E2E flow passed successfully during prior work. Note that it left
a synthetic `ghost.e2e.*@elite.local` account behind, which was found and
deleted during Phase 0 — if you write another E2E flow, verify its cleanup
actually cleans up.

As of Phase 0 there is also an automated suite (`npm test`, 35 tests) plus
verification that:

- all five friends endpoints return `401` unauthenticated and with a forged
  bearer token
- `/api/system/reset` returns `401` with no secret and with a wrong one
- registration rejects a taken username with an inline error and issues **zero**
  Supabase requests — the regression test for the bricked-signup bug

## 12. Current Risks / Things Future Agents Should Be Careful About

- Do not reintroduce anonymous Ghost behavior unless explicitly requested.
- Do not remove legacy Ghost columns unless the user asks for schema cleanup.
- Be careful with `daily_logs` changes because they affect:
  - logs UI
  - dashboard chart
  - Arena scoring
- Be careful with username logic because it affects:
  - signup
  - friend search
  - leaderboard display
  - Profile edit flow
- Be careful with reset logic because it is timezone-aware and easy to break.
- **Never resurrect the deleted `.sql` files from git history and run them.**
  `fix-permissions.sql` and `grants.sql` in particular re-grant privileges
  Phase 0 deliberately revoked and would reopen the friendship data-exposure
  hole. They are history, not a toolbox. See section 5.
- Do not "fix" a cross-user read problem by loosening an RLS SELECT policy or
  adding an `anon` grant. The anon key ships to every browser. Route it through
  a server endpoint with `supabaseAdmin` instead — that is why
  `/api/auth/check-username` exists.
- `formatError` in
  [src/app/api/friends/_lib.ts](/Users/jashanubhi/Desktop/coding/elite/src/app/api/friends/_lib.ts)
  concatenates the Postgres `message | details | hint | code`, and every route
  returns it to the browser on a 500. That leaks constraint names, column names
  and query hints. Scheduled to be fixed alongside error monitoring; do not
  copy the pattern into new routes.
- **Never key an effect on the `user` or `session` *object* from `AuthContext`.**
  That context calls `setUser(s?.user ?? null)` on every `onAuthStateChange`
  event, minting a fresh object even when nothing changed. On August 13, 2026
  this put the app in a permanent request storm: the system-state load effect
  and the friends-arena effect both re-ran on every auth event, and each re-run
  issued Supabase requests that themselves settled the auth state, firing the
  next event. Measured at 72 fetches in 5 seconds while idle — 8 complete
  re-runs of `fetchSystemState` plus 16 calls each to two API routes. Always
  depend on `user?.id` and `session?.access_token`, which are stable primitives.
  The symptom is easy to misread as "the preview is slow" or "that's just
  StrictMode double-invoking"; it is neither. Measure with a `window.fetch`
  counter before believing either explanation.

### The economy is server-authoritative — do not undo this

**Closed on August 14, 2026 by Phase 5.** This used to succeed from any
logged-in browser and now returns `42501`:

```js
supabase.from('operator_profile').update({ xp: 999999, streak: 9999 }).eq('id', myId)
```

Verified against production: attempts to inflate XP, inflate streak, forge a
`daily_logs` row, mark a habit complete, complete an objective, or forge a
friendship all return `42501 permission denied`.

`authenticated` now holds only:

| Table | Access |
|---|---|
| `operator_profile` | SELECT + `username` UPDATE |
| `daily_logs` | SELECT |
| `friendships`, `friend_requests` | SELECT |
| `daily_habits`, `non_negotiables` | SELECT, DELETE + `title`/`user_id` |
| `objectives` | SELECT, DELETE + `type`/`title`/`description`/`user_id` |

Everything else goes through `src/app/api/economy/*` and `/api/system/sync`,
which run as `service_role`. The rules that follow from that:

- **Never widen these grants to fix a client error.** A `42501` from the
  browser means client code is writing something the server owns; move the
  write to a route instead.
- **`supabase test db` is the guard.** `supabase/tests/phase5_lockdown.test.sql`
  asserts all of the above as 20 pgTAP tests. It is negative-tested — re-granting
  UPDATE on `operator_profile` makes it fail — so a green run is meaningful.
  Run it before and after any grant or policy change.
- **`npm run preflight:phase5`** audits client source for writes to
  server-owned columns. Run it before touching `EliteContext`.

## 13. If You Need To Run The App

Typical commands:

```bash
npm run dev -- --port 3002
```

Other useful commands:

```bash
npm run lint
npm run build
npm test
```

`npm test` runs the pure-logic unit suite with Node's built-in test runner
(no test framework dependency). Tests live next to their subject as
`src/lib/*.test.ts` and cover [src/lib/daily-reset.ts](/Users/jashanubhi/Desktop/coding/elite/src/lib/daily-reset.ts)
and [src/lib/arena.ts](/Users/jashanubhi/Desktop/coding/elite/src/lib/arena.ts).
Nothing in the suite touches Supabase, so it is safe to run at any time.

## 14. If You Need To Push Schema Changes

**Do not add another hand-run `.sql` file.** That workflow is what produced the
divergence Phase 1 spent a day reconciling. The migration flow is now live:

```bash
supabase migration new <name>   # creates supabase/migrations/<ts>_<name>.sql
# edit it
supabase db reset               # rebuild locally from scratch and verify
supabase db push                # apply to production
```

`supabase db reset` is the cheap safety net — it replays every migration onto an
empty database, so it catches ordering mistakes and typos before production
does. Run it every time.

Two caveats that have already caused problems:

- **Anything outside the `public` schema needs a hand-written migration.**
  `db pull` will not capture triggers on `auth.users`, `pg_cron` jobs, or
  storage policies. See section 5.
- **The CLI must be authenticated** (`supabase login`, or `SUPABASE_ACCESS_TOKEN`
  exported) and linked (`supabase link --project-ref mfrffkbbkiiznbgwqxdw`).
  On macOS the keychain prompt asks for your *Mac login password*, not a
  Supabase one.

Whatever the mechanism, a DB change usually needs matching updates in:

- client assumptions in [src/context/EliteContext.tsx](/Users/jashanubhi/Desktop/coding/elite/src/context/EliteContext.tsx)
- API route assumptions in [src/app/api](/Users/jashanubhi/Desktop/coding/elite/src/app/api)
- this file, if it changes a security boundary or a product rule

Grant changes specifically: revoking a privilege the client currently relies on
will break the app at runtime with a `42501`, and TypeScript will not warn you.
Check what writes that table first — every browser write in the app lives in
`EliteContext.tsx`, so that one file is the complete list.

## 15. Current Source Map

Useful entry points:

- App shell:
  - [src/app/page.tsx](/Users/jashanubhi/Desktop/coding/elite/src/app/page.tsx)
- Global auth:
  - [src/context/AuthContext.tsx](/Users/jashanubhi/Desktop/coding/elite/src/context/AuthContext.tsx)
  - [src/app/api/auth/check-username/route.ts](/Users/jashanubhi/Desktop/coding/elite/src/app/api/auth/check-username/route.ts)
- Server-side auth guard for API routes:
  - [src/app/api/friends/_lib.ts](/Users/jashanubhi/Desktop/coding/elite/src/app/api/friends/_lib.ts) — `requireUserFromBearer`
- Tests:
  - [src/lib/daily-reset.test.ts](/Users/jashanubhi/Desktop/coding/elite/src/lib/daily-reset.test.ts)
  - [src/lib/arena.test.ts](/Users/jashanubhi/Desktop/coding/elite/src/lib/arena.test.ts)
- Global app state:
  - [src/context/EliteContext.tsx](/Users/jashanubhi/Desktop/coding/elite/src/context/EliteContext.tsx)
- Reset logic:
  - [src/lib/daily-reset.ts](/Users/jashanubhi/Desktop/coding/elite/src/lib/daily-reset.ts)
  - [src/app/api/system/reset/route.ts](/Users/jashanubhi/Desktop/coding/elite/src/app/api/system/reset/route.ts)
- Arena logic:
  - [src/lib/arena.ts](/Users/jashanubhi/Desktop/coding/elite/src/lib/arena.ts)
  - [src/components/GhostView.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/GhostView.tsx)
- Logs:
  - [src/components/LogsView.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/LogsView.tsx)
- Profile:
  - [src/components/ProfileView.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/ProfileView.tsx)

## 16. Short Status Snapshot

As of August 13, 2026:

- friends-based Arena is live
- username-at-signup flow is live
- Profile tab is live
- logs are weekly-first in UI
- monthly log retention strategy is implemented, enforced by a `pg_cron` job
- unit test suite is live (`npm test`, 35 tests, no framework dependency)
- Phase 0 hardening is applied to production, in both code and database
- **Phases 1-5 are complete.** The schema is under `supabase/migrations/`; the
  XP economy is a tested kernel (`src/lib/economy.ts`) shared by client and
  server; XP, streaks, habit completion and objective progress are written only
  by API routes; and the client's grants on those columns are revoked. The
  devtools XP exploit is dead.
- the auth-state request storm is fixed — see the note in section 12
- the app is being taken from "personal tool" to "public signups"; Phases 6-8
  remain — auth hardening, CI/monitoring/rate limiting, and GDPR plus the
  Arena scoring fix (section 18)

## 17. Known Configuration Issues

- `supabase/config.toml` configures the **local** dev stack only. Editing
  `site_url` there does nothing to production — hosted auth settings live in
  the Supabase dashboard. It currently reads `http://127.0.0.1:3000`.
- `enable_confirmations = false`, while
  [OperatorLogin.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/OperatorLogin.tsx)
  tells the user to check their email to confirm. One of the two must change;
  the decision is to turn confirmation on.
- `minimum_password_length = 6`, matched by `minLength={6}` in the UI. If you
  raise one, raise the other or client and server disagree.
- No CAPTCHA. Public signup plus working SMTP without one is an open email relay
  pointed at your own domain reputation.
- The CSP in [next.config.ts](/Users/jashanubhi/Desktop/coding/elite/next.config.ts)
  will silently block Turnstile and Sentry if either is added — they need
  `script-src`/`frame-src` and `connect-src` entries respectively. CSP failures
  only surface in the browser console.
- No CI. `npm test` only protects what someone remembers to run.

## 18. Production-Readiness Roadmap

The full plan lives at
`~/.claude/plans/lets-make-a-plan-bright-hopper.md`. Summary of remaining work,
in dependency order — the ordering is load-bearing, not preference:

1. ~~**Phase 1 — migration baseline.**~~ **Done, August 13, 2026.** Baseline
   pulled from production, auth trigger pinned by a second migration, verified
   by a from-scratch local rebuild, `db diff --linked --schema public` clean,
   eleven legacy `.sql` files deleted, dead `daily-system-reset` cron job
   unscheduled. See sections 5 and 6.
2. **Phase 2 — economy kernel.** New `src/lib/economy.ts` holding the XP
   constants currently inlined in `EliteContext` (15/30/500/200) plus the
   toggle and objective-progress calculations. Pure, tested, isomorphic.
3. **Phase 3 — server-authoritative routes.** `POST /api/economy/habit/toggle`,
   `POST /api/economy/objective/progress`, and `POST /api/system/sync`, the last
   of which moves the login-time reset server-side. Compare-and-swap on the
   habit flip and the XP write, so a double-tap or a second tab cannot double
   award. Additive — deploys with the client still writing directly.
4. **Phase 4 — client switchover.** Rewrite the writes in `EliteContext`,
   reconcile from server responses, fix the seven error-swallowing `.then(() => {})`
   writes, and ship a build-version reload banner **before** Phase 5.
5. ~~**Phase 5 — database lockdown.**~~ **Done, August 14, 2026.** Column-level
   grants, `WITH CHECK` on all five UPDATE policies, 12 CHECK constraints,
   per-operator row caps, and `daily_logs` writes revoked entirely. Verified
   against production: six separate exploit attempts all return `42501`, and
   every legitimate write still works. See section 12.
6. **Phase 6 — auth hardening.** Password reset, email confirmation, CAPTCHA,
   real SMTP.
7. **Phase 7 — CI, error monitoring, rate limiting.**
8. **Phase 8 — GDPR (delete/export) and the Arena scoring fix.**

The Arena scoring bug in Phase 8 is worth understanding early because a test
documents it: `getCompletionRate` returns `null` for an empty category and the
weights renormalize, so an operator tracking **one** habit scores 100 while one
tracking five non-negotiables and five habits at 80% scores 84. Tracking less
raises your ceiling. `src/lib/arena.test.ts` asserts the current behaviour and
will fail loudly when it is fixed — that failure is the signal, not a
regression.

---

This file should be updated whenever a significant product, database, or operational change is made.
