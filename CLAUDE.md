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

## 5. SQL / Supabase Scripts

> **Do not run the legacy `.sql` files in this repo.** They describe a state
> the database has moved past, and several of them would actively undo the
> Phase 0 security work. They are kept only as history until the migration
> baseline lands. Git is the archive; they are scheduled for deletion.

### The one script that is current

[supabase/phase-0-hardening.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/phase-0-hardening.sql)
— applied to production on August 11, 2026. Closes the friendship-forgery data
exposure, moves profile creation into an `auth.users` trigger, and removes the
`anon` read grants. Its steps deliberately straddle a code deploy and must not
be run in one go; the header explains the ordering. Already applied — do not
re-run without reading it.

### Why the legacy scripts are dangerous, not merely stale

- [supabase/fix-permissions.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/fix-permissions.sql)
  advertises itself as a safe idempotent repair. It is now the single most
  dangerous file here: running it re-grants table-wide privileges and
  recreates policies that Phase 0 revoked, silently reopening the friendship
  hole. It also predates the friends feature, so it covers only five of the
  seven tables.
- [supabase/grants.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/grants.sql)
  grants `select` to `anon` on five tables, justified by a comment claiming
  PostgREST needs it to initialise. That claim is false. Phase 0 revoked these.
- [supabase/cron-setup.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/cron-setup.sql)
  schedules a `pg_cron` job that reads a GUC nothing sets, so it has been
  sending `Bearer ` and 401ing since it was created. Vercel cron is the real
  scheduler. Unschedule `eliteos-daily-reset` if it still exists.
- [supabase/indexes.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/indexes.sql)
  is an empty stub.
- [supabase-schema.sql](/Users/jashanubhi/Desktop/coding/elite/supabase-schema.sql)
  is **not** an accurate description of production. It lacks the unique
  constraint on `daily_logs (user_id, date)` that both upsert call sites
  depend on, and it still contains the dropped friendship policies.
- [supabase/friends-system.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/friends-system.sql),
  [supabase/log-retention.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/log-retention.sql),
  and [supabase/add-timezone.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/add-timezone.sql)
  have all been applied and are historical.

### Where this is going

The repo and the live database have measurably diverged, because everything
here was applied by hand through the SQL editor in an order nobody recorded.
The fix is `supabase db pull` against production to capture reality as a
migration baseline, after which all schema change flows through
`supabase/migrations/` and nothing is hand-applied again. See section 18.

## 6. Logs Retention Rules

Current retention strategy:

- keep only recent rolling month of `daily_logs`
- show only first 7 logs in UI initially
- reveal rest of retained logs when user clicks `MORE`

Important implication:

- the DB is intentionally not a long-term historical warehouse anymore
- old log months should be pruned
- anything that depends on `daily_logs` should be designed around short-term history

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
- **Never run `supabase/fix-permissions.sql` or `supabase/grants.sql`.** They
  re-grant privileges Phase 0 deliberately revoked. See section 5.
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

### Known-open security gap

**XP and streaks are still client-writable.** `authenticated` holds table-wide
UPDATE on `operator_profile` and INSERT on `daily_logs`, so any logged-in user
can run this from devtools and it will succeed:

```js
supabase.from('operator_profile').update({ xp: 999999, streak: 9999 }).eq('id', myId)
```

Arena scores are forgeable by the same route. This is known and sequenced, not
overlooked: the grants cannot be revoked until the server routes that replace
those writes exist, because the login-time reset in `EliteContext` writes `xp`,
`streak`, `last_habit_reset`, per-habit streaks, and `daily_logs` directly. See
section 18.

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
current divergence between this repo and production. Until the migration
baseline lands (section 18), treat any schema change as blocked on that work,
or apply it deliberately and write it down here.

Once `supabase/migrations/` exists: `supabase migration new <name>`, edit,
`supabase db push`.

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

As of August 11, 2026:

- friends-based Arena is live
- username-at-signup flow is live
- Profile tab is live
- logs are weekly-first in UI
- monthly log retention strategy is implemented
- unit test suite is live (`npm test`, 35 tests, no framework dependency)
- Phase 0 hardening is applied to production, in both code and database
- the app is being taken from "personal tool" to "public signups"; Phases 1-8
  of that work remain (section 18)

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

1. **Phase 1 — migration baseline.** `supabase db pull` against production,
   verify with `supabase db diff` until empty, then delete the legacy `.sql`
   files and update section 5 of this file.
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
5. **Phase 5 — database lockdown.** Column-level grants, `WITH CHECK` on every
   UPDATE policy, CHECK constraints, and revoking `daily_logs` writes entirely.
   This is what actually closes the XP hole. Verify with pgTAP.
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
