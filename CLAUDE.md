@AGENTS.md

# EliteOS — Project Memory

Working memory for the EliteOS codebase, current as of **August 14, 2026**.

This file records what is *not* obvious from reading the code: the security
boundaries and why they exist, the traps that have already cost real debugging
time, decisions that are settled, and what remains. Descriptions of what the app
does are kept short — the code says that better.

**If you change a security boundary or a product rule, update this file in the
same commit.**

---

## 1. What EliteOS is

A gamified personal operating system: Next.js 16 (App Router, Turbopack), React
19, Tailwind v4, Supabase (auth + Postgres). Dark terminal / glassmorphism
styling, mobile-friendly.

An operator signs up, tracks **objectives** (`north-star` or `sprint`), **daily
habits**, and **non-negotiables**; earns XP and streaks; has each day archived
to `daily_logs` at reset; and competes with friends on a rolling 7-day
leaderboard in the **Arena**.

Six tabs — dashboard, objectives, arena, habits, logs, profile — routed by
`activeTab` in [page.tsx](src/app/page.tsx) and rendered by
[Dashboard.tsx](src/components/Dashboard.tsx), which is the view router as well
as the dashboard itself.

**The app is going to public signups.** Assume strangers can register; that is
the bar for every security, abuse, and compliance decision.

---

## 2. The trust boundary

This is the most important thing in this file.

**The server owns every value that affects rank.** The browser sends *intent*
and never a number. XP, streaks, habit completion, objective progress, and
`daily_logs` are written only by API routes running as `service_role`.

```
browser (anon key, RLS)          server routes (service_role)
  titles, descriptions      →      xp, streak, completed_today,
  username                         progress, status, daily_logs,
  create/delete rows               last_check_in, last_habit_reset
```

The economy arithmetic itself lives in [src/lib/economy.ts](src/lib/economy.ts)
— pure, dependency-free, isomorphic — and is imported by *both* sides, so client
optimism and server truth cannot drift. Constants (15 / 30 / 500 / 200 / step
10) exist there and nowhere else.

### What `authenticated` can still write

| Table | Access |
|---|---|
| `operator_profile` | SELECT + `username` UPDATE |
| `daily_logs` | SELECT only |
| `friendships`, `friend_requests` | SELECT only |
| `daily_habits`, `non_negotiables` | SELECT, DELETE + INSERT/UPDATE on `title` (+`user_id` on insert) |
| `objectives` | SELECT, DELETE + INSERT/UPDATE on `type`/`title`/`description` (+`user_id`) |

Everything else returns `42501`. Verified against production on August 14, 2026:
attempts to inflate XP, inflate streak, forge a `daily_logs` row, mark a habit
complete, complete an objective, or forge a friendship **all fail**.

### Rules that follow

- **Never widen a grant to fix a client error.** A `42501` in the browser means
  client code is writing something the server owns. Move the write to a route.
- **Never re-grant write access on `friendships` / `friend_requests`.** See §4.
- **Run `supabase test db` around any grant or policy change.** The 20 pgTAP
  assertions in
  [supabase/tests/phase5_lockdown.test.sql](supabase/tests/phase5_lockdown.test.sql)
  attempt each forbidden write and assert `42501`. Negative-tested: re-granting
  UPDATE on `operator_profile` makes it fail, so a green run means something.
- **Run `npm run preflight:phase5` before touching `EliteContext`.** It audits
  client source for writes to server-owned columns.

---

## 3. Settled product decisions

Treat as current intent unless the user says otherwise.

- Arena is **friends-based**, not anonymous. Do not reintroduce Ghost mode.
- **No CAPTCHA.** Decided on August 14, 2026, on simplicity grounds, with the
  tradeoff stated: signup is scriptable, so bot registration and email-sender
  abuse are bounded only by rate limiting. Do not add Turnstile or hCaptcha
  back without being asked. The consequence is that the Phase 7 rate limiter
  and Supabase's own email caps are the whole defence — treat them as required,
  not optional.
- Username is **required at signup**, 3–24 chars, `[a-z0-9_]`. Enforced in the
  UI, in `/api/auth/check-username`, and by a CHECK constraint — the database is
  the authority.
- **No runtime username auto-generation.** The signup trigger's collision
  suffixing (`name`, `name_2`, …) is not a violation of this: it is a
  last-resort uniqueness guarantee inside the account-creation transaction, not
  a UX affordance. It exists because the alternative — failing the insert —
  produced auth accounts with no profile row and an unescapable spinner.
- Username editing lives in the **Profile tab**, not the Arena.
- `daily_logs` retention is a **rolling ~30 days**. The database is deliberately
  not a long-term warehouse; anything depending on logs must assume short
  history.
- Logs UI is weekly-first: 7 shown, `MORE (n)` expands the rest of the retained
  window.
- Legacy `ghost_opt_in` / `ghost_opted_in_at` columns stay unless schema cleanup
  is explicitly requested.

---

## 4. Database

Seven tables, RLS enabled on all: `operator_profile`, `objectives`,
`daily_habits`, `non_negotiables`, `daily_logs`, `friend_requests`,
`friendships`. Every one FKs `auth.users(id) ON DELETE CASCADE`, so account
deletion cascades completely (relevant to the Phase 8 GDPR work).

**`operator_profile`** — `id`, `username`, `xp`, `streak`, `last_check_in`,
`last_habit_reset`, `timezone`, `initialized_at`, `created_at`, plus the legacy
Ghost columns. Created by the `on_auth_user_created` trigger, **never** by the
client.

**`friendships`** — accepted relationships as a canonical low/high pair
(`user_low_id` < `user_high_id`).

> **Write access is service-role only, and this is a security boundary.** The
> original INSERT policy only checked that the caller was one of the two people
> in the pair, so any authenticated user could insert `(self, victim)` through
> the anon-key client and then read that victim's username, XP, streak and full
> `daily_logs` from the leaderboard — no request, no consent. The same applies
> to `friend_requests`. All mutations go through `src/app/api/friends/`.

[leaderboard/route.ts](src/app/api/friends/leaderboard/route.ts) additionally
cross-checks every friendship against an accepted `friend_requests` row and logs
`[FRIENDSHIP_WITHOUT_ACCEPTED_REQUEST]` for any that fail. That is a deliberate
tripwire: if it fires, someone has write access they should not have.

That tripwire used to be blunted by `remove/route.ts`, which cancelled only
*pending* requests on unfriend and left the `accepted` row behind — so a forged
friendship with anyone you had previously unfriended still found its accepted
row and passed. It now cancels `accepted` too. Re-adding is unaffected: both
guards in `request/route.ts` look for a *pending* row.

**`daily_logs`** — archived day summaries, feeding the logs UI, the dashboard XP
chart, and Arena scoring. `(user_id, date)` is UNIQUE; both upsert call sites
depend on it.

### Migrations

**The schema lives in `supabase/migrations/` and nowhere else.** Eleven hand-run
`.sql` files were deleted on August 13, 2026. Git has them for archaeology.

> **Do not resurrect and run them.** `fix-permissions.sql` and `grants.sql` would
> re-grant exactly what Phases 0 and 5 revoked and silently reopen both the
> friendship data-exposure hole and the XP exploit.

| Migration | What it is |
|---|---|
| `20260813080640_remote_schema` | Baseline, captured with `db pull` against production. *Reality*, not an idealised schema — it contains the `daily_logs_user_date_idx` unique index that existed in production but in no repo file. |
| `20260813080755_auth_user_profile_trigger` | The `on_auth_user_created` trigger. Hand-written because `db pull` captures `public` only. |
| `20260813223458_phase5_lockdown` | Column-level grants, `WITH CHECK` on all five UPDATE policies, 12 CHECK constraints, per-operator row caps. |

#### The blind spot that bit twice

`db pull` does **not** see the `auth`, `cron`, or `storage` schemas. Two things
lived there and were nearly lost: the signup trigger (now pinned by its own
migration) and the `pg_cron` jobs (still not in any migration — see below).
Anything outside `public` needs a hand-written migration.

#### Scheduled jobs — not in any migration

Audited August 13, 2026 via `select jobid, jobname, schedule, command from cron.job;`

- **`eliteos-log-retention`** (`pg_cron`, `15 1 * * *`) — **live and
  load-bearing.** Runs `delete from daily_logs where date < (current_date -
  interval '1 month')`. Do not remove. Known cosmetic flaw: compares against
  `current_date` (UTC) while log dates are written in each operator's local day,
  so someone well ahead of UTC can lose a log a few hours early.
- **Vercel cron** (`vercel.json`, `0 * * * *`) — hits `/api/system/reset`
  hourly. **The real reset scheduler.** The `last_habit_reset === today` guard
  makes it idempotent, so hourly is safe and closes the timezone-lateness
  window.

A third job, `daily-system-reset`, was unscheduled on August 13, 2026. It had
never worked: its URL was the literal unsubstituted placeholder
`https://<REFERENCE_ID>.supabase.co/functions/v1/daily-reset`. (Earlier notes
blamed an unset GUC — that diagnosis was wrong, the conclusion was right.)

---

## 5. Traps that have already cost real time

- **Never key an effect on the `user` or `session` *object* from `AuthContext`.**
  That context calls `setUser(s?.user ?? null)` on every `onAuthStateChange`
  event, minting a fresh object even when nothing changed. On August 13, 2026
  this produced a permanent request storm: effects re-ran on every auth event,
  and each re-run issued Supabase requests that themselves settled the auth
  state. Measured at **72 fetches in 5 seconds while idle**. Always depend on
  `user?.id` and `session?.access_token` — stable primitives. The symptom reads
  as "the preview is slow" or "StrictMode double-invoking"; it is neither.
  Measure with a `window.fetch` counter before believing either.
- **`fetchSystemState` returns its state rather than committing it**, so a
  single `finally` clears the loading flag on every exit path. Preserve that
  shape. An earlier version had early returns that skipped `setLoading(false)`,
  which turned a visible failure into a permanent spinner.
- **The client never creates the profile row.** A missing profile is an error
  state showing a retry screen, not something to self-heal by inserting one —
  that insert is what used to brick accounts.
- **Do not fix a cross-user read problem by loosening an RLS SELECT policy or
  adding an `anon` grant.** The anon key ships to every browser. Route it
  through a server endpoint with `supabaseAdmin`; that is why
  `/api/auth/check-username` exists.
- **`formatError`** in [_lib/guard.ts](src/app/api/_lib/guard.ts) concatenates
  the Postgres `message | details | hint | code`, leaking constraint and column
  names. It is for logs only. Every route now funnels failures through
  `serverError`, which logs the detail and returns a fixed string, so each
  catch block is one line — do not hand-roll a 500 body and reintroduce the
  leak. The one deliberate exception is `/api/system/reset`, whose `failures`
  array carries per-operator messages; that route requires `Bearer $CRON_SECRET`,
  so its audience is the cron caller, not a browser.
- **An inferred union will not narrow on a `string` property.**
  `requireUserFromBearer` used to infer its result type, which collapsed `user`
  into "possibly undefined" and left `auth.user!` scattered across nine routes.
  TypeScript narrows on a property only when its type is a *unit* type in each
  member, which is why `BearerAuth` declares `error: "Unauthorized" | null`
  rather than `string | null`. Widen it and every assertion has to come back.
- **Seven writes used to end in `.then(() => {})`**, making failure completely
  invisible — a delete that never reached the database still vanished from the
  UI and reappeared on next load. They now await, roll back, and toast. Do not
  reintroduce fire-and-forget writes.
- **Unconfirmed-signup cleanup must check `last_sign_in_at`, not just
  `email_confirmed_at`.** Confirmation was off until Phase 6, so every operator
  who registered before it has a permanently null `email_confirmed_at`. The
  obvious rule — "unconfirmed and older than seven days" — would have deleted
  the entire user base on the cron's first run, cascading through all seven
  tables. The rule lives in
  [unconfirmed-cleanup.ts](src/lib/unconfirmed-cleanup.ts), pure and tested, and
  the never-signed-in clause is negative-tested: removing it fails a test named
  for exactly this.
- **PostgREST renders `.eq(col, null)` as `col=eq.null`, which matches nothing.**
  Use `.is(col, null)`. This bit the reset's compare-and-swap guard, where a
  first-ever reset would otherwise always lose its own race.
- **`zod`'s `.uuid()` enforces RFC 4122 variant bits**, so `1111...1111` is
  rejected as malformed rather than reaching a 404 path. Use real v4 UUIDs in
  tests.
- Be careful with **`daily_logs`** (logs UI + dashboard chart + Arena scoring),
  **username logic** (signup, friend search, leaderboard, profile edit), and
  **reset logic** (timezone-aware and easy to break).

---

## 6. Auth and profile flow

1. Register with email + password + username.
2. Username validated client-side, then checked against
   `POST /api/auth/check-username`, which uses the service-role key. A
   client-side check is structurally impossible — the browser cannot read other
   operators' profiles, so an earlier one ran as `anon`, matched zero rows under
   RLS, and reported every username as available. **The check is advisory; the
   database is the authority.**
3. `signUp` writes the username into auth metadata; the `on_auth_user_created`
   trigger reads it and creates `operator_profile` in the same transaction.
4. On login, `EliteContext` POSTs `/api/system/sync`, which performs the daily
   reset if due and returns authoritative state. Everything else the context
   does on load is a SELECT.

**Not implemented:** email change.

Account deletion and data export ship in
[api/account](src/app/api/account), surfaced in the Profile tab. Deletion goes
through `supabaseAdmin.auth.admin.deleteUser` and removes the **auth user**, not
the profile row — every table FKs `auth.users(id) ON DELETE CASCADE`, so the
database does the rest in one transaction. Doing it the other way round is what
Phase 5 revoked the `operator_profile` DELETE grant to prevent: it strands an
auth account with no profile, which is the bricked state that produced an
unescapable spinner. The target id comes from the bearer token; there is
deliberately no parameter naming whose account to delete.

### Password recovery

`OperatorLogin` has a third mode, `reset`, which calls
`requestPasswordReset` → `supabase.auth.resetPasswordForEmail`. The link lands
on [reset-password/page.tsx](src/app/reset-password/page.tsx).

Rules that are not obvious from the code:

- **The outcome message is identical whether or not the address has an
  account.** Anything else turns the form into an oracle for which addresses are
  registered. Errors from `resetPasswordForEmail` are logged, never shown; the
  same applies to "resend confirmation".
- **The page accepts two link formats, and prefers `token_hash`.**
  `@supabase/ssr` hardcodes `flowType: "pkce"`, and auth-js only exchanges a
  `?code=` if it *also* finds the verifier it stored in that browser when the
  reset was requested. Request on a phone, open on a laptop, and the link dies
  silently. `token_hash` + `verifyOtp` is stateless and survives that, so the
  dashboard email template should use `{{ .TokenHash }}`.
- **It reads the session with `getSession`, not the `PASSWORD_RECOVERY`
  event.** That event fires from a `setTimeout` inside auth-js initialization
  and can land before the component subscribes; `getSession` awaits the same
  initialization and returns the settled answer, so there is no race to lose.
- **Success signs the operator out.** A recovery link is a login bypass, so the
  session it mints is not carried into the app.
- A logged-in operator visiting `/reset-password` can set a new password
  without giving the old one. That is Supabase's default
  (`secure_password_change = false`), not something this page loosened.
  Tightening it is a dashboard setting, but see the warning in `config.toml`:
  it may also gate recovery itself.

**`EliteProvider` stays dormant on `/reset-password`.** It sits in the root
layout, so it mounts on every route, and a recovery session would otherwise be
enough for it to POST `/api/system/sync` and run the daily reset from a page
whose only job is changing a password. Verified: zero API calls on that route.

---

## 7. Arena scoring

Lives in [src/lib/arena.ts](src/lib/arena.ts). Built from the latest 7 archived
logs; combines non-negotiable compliance (50%), habit completion (30%), and a
streak factor (20%, clamped at 7 days). A score is withheld until 7 days exist.
Leaderboard sorts by score desc, XP desc, username asc; unscored operators sink
below every scored one.

**`MIN_TRACKED` is why a rate is not simply `completed / tracked`.** Every
completion denominator floors at 3. Without it, tracking *less* raised your
ceiling: one habit, ticked, scored a flat 100 and outranked an operator tracking
five non-negotiables and five habits at 80%. Fixed on August 14, 2026; the tests
that documented the old behaviour were rewritten to assert the inversion is
gone.

> **Residual, deliberate and documented by a test.** Flooring fixes 1-of-1, but
> an empty category still returns `null` and lets the weights renormalize — so
> an operator tracking exactly three habits and no non-negotiables still scores
> 100. Closing it means deciding whether an untracked category should score zero
> instead of dropping out, which would stop anyone from using only half the app.
> That is a product call, not a bug fix, so it is asserted as current behaviour
> rather than quietly changed.

---

## 8. Commands

```bash
npm run dev -- --port 3002
npm run lint
npm run build
npm test                  # 94 tests, Node's built-in runner, no framework
npm run preflight:phase5  # audits client source for server-owned column writes
```

`npm test` covers `src/**/*.test.ts`: the economy kernel, daily-reset and arena
logic, the economy route handlers (against an in-memory fake `EconomyDb`, so
nothing touches Supabase), the rate-limit policy, and the unconfirmed-signup
cleanup rule. Safe to run any time.

All of it now runs on every push and pull request — see
[.github/workflows/ci.yml](.github/workflows/ci.yml), which also runs the pgTAP
grant matrix in a throwaway Supabase stack. **Require both jobs in branch
protection**; CI that is not required is CI that gets ignored.

Database tests need Docker running:

```bash
supabase start
supabase test db          # 20 pgTAP assertions on the grant matrix
supabase stop --no-backup
```

### Schema changes

**Do not add another hand-run `.sql` file** — that workflow produced the
divergence Phase 1 spent a day reconciling.

```bash
supabase migration new <name>
# edit the generated file
supabase db reset               # rebuild locally from scratch — run every time
supabase test db                # confirm the grant matrix still holds
supabase db push                # apply to production
```

Caveats that have already caused problems:

- Anything outside `public` needs a hand-written migration (see §4).
- The CLI must be authenticated (`supabase login`, or `SUPABASE_ACCESS_TOKEN`)
  and linked (`supabase link --project-ref mfrffkbbkiiznbgwqxdw`). On macOS the
  keychain prompt asks for your **Mac login password**, not a Supabase one.
- **The database password is not currently known**, so schema changes have been
  applied through the dashboard SQL editor. If you do that, record it manually
  or the ledger drifts:
  ```sql
  insert into supabase_migrations.schema_migrations (version, name)
  values ('<timestamp>', '<name>') on conflict (version) do nothing;
  ```
  Reset the password at Project Settings → Database when convenient; the app
  uses the anon and service-role keys, not this password, so resetting it breaks
  nothing.

A schema change usually needs matching updates in
[EliteContext.tsx](src/context/EliteContext.tsx), the routes under
[src/app/api](src/app/api), and this file.

---

## 9. Known configuration issues

- `supabase/config.toml` configures the **local** stack only. Editing `site_url`
  there does nothing to production — hosted auth settings live in the dashboard.
  **Every value changed in that file during Phase 6 still has to be set again in
  the dashboard**, or production keeps the old behaviour: `enable_confirmations`,
  `minimum_password_length`, `additional_redirect_urls`, `max_frequency`,
  `rate_limit.email_sent`.
- **No SMTP.** Supabase's built-in sender is rate-limited and explicitly not for
  production. Until Resend (or equivalent) is attached, confirmation and
  recovery emails are unreliable — which makes the recovery flow only as good as
  the mail behind it.
- **No CAPTCHA, by decision** — see §3. This is the reason the Phase 7 rate
  limiter is load-bearing rather than nice to have: it is the only thing
  standing between a script and the signup endpoint.
- Account rules live in [auth-rules.ts](src/lib/auth-rules.ts) —
  `USERNAME_PATTERN` and `MIN_PASSWORD_LENGTH` (10, raised from 6). They mirror
  the database CHECK constraint and `auth.minimum_password_length`
  respectively; change one without the other and the form accepts input the
  backend rejects. The length binds only when a password is *set*, so operators
  registered under the old 6-character minimum are not locked out.
- The CSP in [next.config.ts](next.config.ts) will **silently** block Sentry —
  it needs a `connect-src` entry. CSP failures surface only in the browser
  console. It also blocks `eval`, which React uses for dev-mode stack traces:
  the console errors that produces in `next dev` are expected and harmless.
- **Rate limiting is inert without Upstash.** `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` are unset, so every budget in
  [rate-limit.ts](src/app/api/_lib/rate-limit.ts) allows everything. That is
  correct for local work and CI, and a real hole in production — where the
  module logs `[RATE_LIMIT_DISABLED]` at startup so it is not silent. With no
  CAPTCHA (§3) this is the only abuse control there is.
- **Sentry is installed but inert.** `NEXT_PUBLIC_SENTRY_DSN` is unset, so
  `instrumentation.ts` returns without initialising and `serverError` captures
  nothing. Set the DSN in Vercel to turn it on — no code change needed. The CSP
  already allows the ingest hosts. `next.config.ts` is deliberately **not**
  wrapped in `withSentryConfig`: that wrapper only uploads source maps and needs
  an org, project and auth token, so adding it early buys warnings rather than
  stack traces. Run the wizard once the account exists.
- **The legal pages carry placeholders.** `LEGAL_ENTITY` and
  `LEGAL_CONTACT_EMAIL` in [legal.ts](src/lib/legal.ts) still say "the EliteOS
  team" and `support@example.com`. GDPR needs a named controller and a monitored
  address — erasure requests have deadlines. Replace both before public signups.
- `npm audit` reports 3 high-severity advisories in `sharp`, pulled in by Next
  and only fixable by bumping Next itself. Nothing in the app calls it.
- The build-version banner (`x-app-build` → reload prompt) only protects tabs
  loaded since Phase 4 shipped. Older tabs run JS that never checks the header.

---

## 10. Source map

- **App shell** — [page.tsx](src/app/page.tsx),
  [Sidebar.tsx](src/components/Sidebar.tsx),
  [Dashboard.tsx](src/components/Dashboard.tsx) (view router)
- **Global state** — [EliteContext.tsx](src/context/EliteContext.tsx) *(the
  single largest file; all browser writes live here)*
- **Auth** — [AuthContext.tsx](src/context/AuthContext.tsx),
  [OperatorLogin.tsx](src/components/OperatorLogin.tsx) (login / register /
  reset), [reset-password/page.tsx](src/app/reset-password/page.tsx),
  [auth-rules.ts](src/lib/auth-rules.ts) (shared username + password rules),
  [check-username/route.ts](src/app/api/auth/check-username/route.ts)
- **API guard** — [_lib/guard.ts](src/app/api/_lib/guard.ts) —
  `requireUserFromBearer`, `parseJsonBody`, `serverError`. The
  `friends/_lib.ts` re-export shim was deleted in Phase 7; every route imports
  from `_lib/guard` directly.
- **Account and compliance** — [account/export](src/app/api/account/export/route.ts),
  [account/delete](src/app/api/account/delete/route.ts) (both surfaced in
  [ProfileView](src/components/ProfileView.tsx)),
  [privacy](src/app/privacy/page.tsx) and [terms](src/app/terms/page.tsx) over
  [LegalPage.tsx](src/components/LegalPage.tsx), with the names and contact in
  [legal.ts](src/lib/legal.ts)
- **Monitoring** — [instrumentation.ts](src/instrumentation.ts) (server + edge),
  [instrumentation-client.ts](src/instrumentation-client.ts),
  [api/health](src/app/api/health/route.ts)
- **Rate limiting** — [rate-limit.ts](src/app/api/_lib/rate-limit.ts) (Upstash
  I/O) over [rate-limit-policy.ts](src/app/api/_lib/rate-limit-policy.ts)
  (budgets and fail modes, pure and tested). Called from each route after the
  bearer resolves, so budgets key on user id rather than IP — the exception is
  `check-username`, the only unauthenticated route, which keys on address.
- **Economy kernel** — [economy.ts](src/lib/economy.ts) + tests
- **Economy routes** — [habit/toggle](src/app/api/economy/habit/toggle/handler.ts),
  [objective/progress](src/app/api/economy/objective/progress/handler.ts),
  [_db.ts](src/app/api/economy/_db.ts) (the `EconomyDb` port),
  [_fake-db.ts](src/app/api/economy/_fake-db.ts) (in-memory test double).
  Handlers are pure and injectable; `route.ts` files are thin.
- **Reset** — [run-daily-reset.ts](src/lib/server/run-daily-reset.ts) (shared),
  [daily-reset.ts](src/lib/daily-reset.ts) (pure helpers),
  [system/reset](src/app/api/system/reset/route.ts) (cron sweep),
  [system/sync](src/app/api/system/sync/route.ts) (login-time)
- **Arena** — [arena.ts](src/lib/arena.ts),
  [GhostView.tsx](src/components/GhostView.tsx) *(still named Ghost; renders the
  Arena)*, five routes under [src/app/api/friends](src/app/api/friends)
- **Views** — [HabitsView](src/components/HabitsView.tsx),
  [ObjectivesView](src/components/ObjectivesView.tsx),
  [LogsView](src/components/LogsView.tsx),
  [ProfileView](src/components/ProfileView.tsx)
- **Database** — [supabase/migrations](supabase/migrations),
  [supabase/tests](supabase/tests)

---

## 11. Status and roadmap

The full plan lives at `~/.claude/plans/lets-make-a-plan-bright-hopper.md`.

**Done (August 11–14, 2026).** Phases 0–8:

| Phase | Outcome |
|---|---|
| 0 | Friendship forgery closed; signup un-bricked; `anon` grants revoked; hourly cron; resilient reset loop |
| 1 | Schema under `supabase/migrations/`; repo and production reconciled; legacy `.sql` deleted |
| 2 | XP economy extracted to a tested, isomorphic kernel |
| 3 | Server-authoritative routes with compare-and-swap (additive) |
| 4 | Client switched over; swallowed writes fixed; build-version tripwire |
| 5 | Column-level grants, `WITH CHECK`, CHECK constraints, row caps, pgTAP |
| 6a | Password recovery end to end; enumeration-safe messages; shared account rules; local auth config tightened |
| 7a | CI on every push (app + pgTAP grant matrix); rate limiting; `formatError` leak closed |
| 7b | Sentry wired (inert until a DSN exists); `/api/health` |
| 8 | Account export + deletion; privacy policy and terms; unconfirmed-signup cleanup; Arena scoring fixed |

Also fixed along the way: the auth-state request storm (§5).

**Remaining.** **The code is done.** What is left is not code — it is credentials and
settings in third-party dashboards, and it is listed in §12.

Two things are deliberately *not* done and should not be started without asking:

- **The XP economy is net-negative and everyone sits at 0.** See the operational
  note below. Rebalancing changes how the product feels for every operator, so
  it is a product decision, not a fix.
- **The Arena residual in §7** — an untracked category still drops out of the
  weighting instead of scoring zero.

## 12. What is not code

Everything below needs an account, a card, or a DNS record, so none of it can be
done from this repo. **The app runs without all of it — it just runs without the
protection.** Each line says what is actually unprotected until it is done.

### Supabase dashboard (`config.toml` is the local stack only)

| Setting | Value | Until then |
|---|---|---|
| Authentication → Emails → SMTP | Attach **Resend** | Built-in sender is capped and unreliable; recovery mail mostly will not arrive |
| Emails → Templates → Reset Password | `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery` | Reset links die when opened in a different browser than they were requested from (§6) |
| Sign In → Email | Confirm email **on**, min password length **10** | Signup UI promises a confirmation email nobody sends; the form enforces 10 while the backend accepts 6 |
| URL Configuration | Production origin + Vercel preview wildcard + `http://localhost:3002/**` | Supabase silently substitutes `site_url`, so operators land on the wrong deployment |
| Rate Limits → email sent | 30/hour | 2/hour, breached by three simultaneous signups |

Then verify a real signup → confirm → login and a real forgot → reset → login.
Everything up to `/auth/v1/recover` returning 200 is already verified; the leg
through an actual inbox is not, and cannot be from here.

### Vercel environment variables

| Variable | Until then |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Every rate-limit budget allows everything. With no CAPTCHA (§3) that is the entire abuse control. Logs `[RATE_LIMIT_DISABLED]` in production |
| `NEXT_PUBLIC_SENTRY_DSN` | Nothing reports errors; failures reach `console.error` and Vercel log retention, and nothing alerts |

Both are read at startup — setting them needs a redeploy, not a code change.

### GitHub

Require **both** CI jobs on `main` in branch protection. CI that is not required
is CI that gets ignored.

### In this repo, but needing facts only the owner has

Replace `LEGAL_ENTITY` and `LEGAL_CONTACT_EMAIL` in
[legal.ts](src/lib/legal.ts). GDPR requires a named controller and a monitored
address; erasure requests carry deadlines.

---

## 13. Live operational notes

- 13 registered operators.
- **Every operator's XP sits at or near 0.** Max daily earn is 75 (2 NNs + 1
  habit); max daily penalty is 120 (2 × 60). The economy is net-negative unless
  everything is completed, and XP floors at 0, so penalties are both invisible
  and permanent. Nobody has ever accumulated. This is a product question, not a
  bug — but the leaderboard currently ranks everyone at 0.
- The zero floor is lossy in the other direction too: an operator at 10 XP who
  toggles a habit off and back on lands on 15, a net gain of 5. Bounded, and
  documented by a test in [economy.test.ts](src/lib/economy.test.ts). Closing it
  means deciding whether XP may go negative.
