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

Relevant files:

- [src/context/AuthContext.tsx](/Users/jashanubhi/Desktop/coding/elite/src/context/AuthContext.tsx)
- [src/components/OperatorLogin.tsx](/Users/jashanubhi/Desktop/coding/elite/src/components/OperatorLogin.tsx)

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

### friendships

Stores accepted friend relationships using a canonical low/high pair:

- `user_low_id`
- `user_high_id`

### daily_logs

Archived day summaries used for:

- logs UI
- Arena scoring
- XP history chart

## 5. Required SQL / Supabase Scripts

These files are important and represent previous work already completed:

### [supabase/friends-system.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/friends-system.sql)

Purpose:

- add username support
- create friend request tables
- create friendships table
- add indexes
- set up RLS / grants
- backfill legacy usernames from email prefix
- enforce `username not null`

### [supabase/log-retention.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/log-retention.sql)

Purpose:

- delete old logs older than a rolling month
- create helpful `daily_logs` index
- optionally schedule daily retention cleanup with `pg_cron`

### [supabase/cron-setup.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/cron-setup.sql)

Purpose:

- schedule daily reset for the reset function / route flow

### [supabase/fix-permissions.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/fix-permissions.sql)

Purpose:

- reapply table grants and row-level security policies when permissions break

### [supabase/add-timezone.sql](/Users/jashanubhi/Desktop/coding/elite/supabase/add-timezone.sql)

Purpose:

- ensure `timezone` exists on `operator_profile`

### [supabase-schema.sql](/Users/jashanubhi/Desktop/coding/elite/supabase-schema.sql)

Purpose:

- full schema reference for the current project state

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
- username stored in auth metadata and persisted into `operator_profile`
- login loads app state from Supabase
- if profile row does not exist, it is created on first load

Important note:

- runtime username auto-generation was intentionally removed after the required-signup-username change
- future changes should avoid silently generating usernames again unless the user explicitly requests that behavior

## 9. Known Historical Milestones

Recent major implementation history from git:

- `609c4ca` fixed reset logic
- `bb912e9` / `74f6dcb` daily reset login work
- `6acaf71` speed up boot animation and remove Wasted Potential card
- `e5f3466` replaced Ghost arena with friends-based competition
- `9f8ba26` required signup usernames and added profile tab
- `e6d431a` limited logs to weekly view and monthly retention

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

That backend E2E flow passed successfully during prior work.

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

When making DB-related changes, check whether you need to update all of the following together:

- [supabase-schema.sql](/Users/jashanubhi/Desktop/coding/elite/supabase-schema.sql)
- one or more task-specific SQL scripts under [supabase](/Users/jashanubhi/Desktop/coding/elite/supabase)
- any related client assumptions in [src/context/EliteContext.tsx](/Users/jashanubhi/Desktop/coding/elite/src/context/EliteContext.tsx)
- any related API route assumptions in [src/app/api](/Users/jashanubhi/Desktop/coding/elite/src/app/api)

## 15. Current Source Map

Useful entry points:

- App shell:
  - [src/app/page.tsx](/Users/jashanubhi/Desktop/coding/elite/src/app/page.tsx)
- Global auth:
  - [src/context/AuthContext.tsx](/Users/jashanubhi/Desktop/coding/elite/src/context/AuthContext.tsx)
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
- schema helper scripts exist for friends, retention, timezone, grants, and reset scheduling

This file should be updated whenever a significant product, database, or operational change is made.
