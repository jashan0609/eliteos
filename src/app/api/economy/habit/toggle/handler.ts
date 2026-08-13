// Relative, with extensions: this module is executed directly by the Node test
// runner, which has no bundler and therefore no `@/` alias. Route files may use
// the alias freely — tests never import them.
import { computeToggle, type HabitKind } from "../../../../../lib/economy.ts";
import type { EconomyDb, HabitRow, ProfileRow } from "../../_db.ts";

/**
 * Toggle a habit or non-negotiable, server-authoritative.
 *
 * The client sends *intent* — which habit, and which state to move it to. It
 * never sends a number. The 15 and the 30 exist only in `src/lib/economy.ts`,
 * so a caller with devtools open cannot award themselves anything.
 *
 * Correctness under concurrency comes from compare-and-swap, not transactions:
 *
 *   1. Flip the habit only if it still holds the opposite value. Zero rows
 *      means someone already flipped it (or it is not yours) — 409, and the
 *      caller adopts the truth we return rather than retrying blindly.
 *   2. Read XP, compute the delta, then write it back only if XP has not moved
 *      since. Losing that race means another toggle landed in between, so we
 *      re-read and recompute rather than clobbering their award.
 *   3. If the XP write keeps losing, put the habit back. A flipped habit with
 *      no XP change is a worse outcome than a clean failure.
 *
 * Step 3 is the part worth being honest about: the flip and the XP write are
 * two statements, not one transaction, so there is a window where the process
 * can die between them and leave the habit flipped without the award. The
 * compensation closes the common case (contention), not the rare one (crash).
 * Making it airtight needs both writes in one Postgres function, which trades
 * away the shared TypeScript implementation the plan deliberately chose to keep.
 */

export const MAX_XP_CAS_ATTEMPTS = 3;

export interface ToggleRequest {
  kind: HabitKind;
  id: string;
  completing: boolean;
}

export type ToggleOutcome =
  | {
      status: 200;
      body: {
        xp: number;
        streak: number;
        lastCheckIn: string | null;
        habit: { id: string; completedToday: boolean; streak: number };
        xpDelta: number;
      };
    }
  | {
      status: 409;
      body: {
        error: "STALE";
        state: {
          habit: { id: string; completedToday: boolean; streak: number } | null;
          xp: number | null;
          streak: number | null;
          lastCheckIn: string | null;
        };
      };
    }
  | { status: 404; body: { error: string } }
  | { status: 500; body: { error: string } };

const habitView = (row: HabitRow) => ({
  id: row.id,
  completedToday: row.completed_today,
  streak: row.streak,
});

export async function handleHabitToggle(params: {
  db: EconomyDb;
  userId: string;
  request: ToggleRequest;
  now?: () => Date;
}): Promise<ToggleOutcome> {
  const { db, userId, request } = params;
  const now = params.now ?? (() => new Date());
  const { kind, id, completing } = request;

  // ── 1. Flip the habit, but only from the opposite state ──
  const flipped = await db.casFlipHabit({ kind, id, userId, completing });

  if (!flipped) {
    // Either not ours, missing, or already in the requested state. Report the
    // current truth so the client can adopt it — this is the "another tab did
    // this" case, and rolling the UI back would be wrong.
    const [current, profile] = await Promise.all([
      db.readHabit({ kind, id, userId }),
      db.readProfile(userId),
    ]);

    if (!current) {
      return { status: 404, body: { error: "Habit not found" } };
    }

    return {
      status: 409,
      body: {
        error: "STALE",
        state: {
          habit: habitView(current),
          xp: profile?.xp ?? null,
          streak: profile?.streak ?? null,
          lastCheckIn: profile?.last_check_in ?? null,
        },
      },
    };
  }

  // ── 2. Move XP, retrying against a moving balance ──
  const lastCheckIn = completing ? now().toISOString() : undefined;
  let updated: ProfileRow | null = null;
  let appliedDelta = 0;

  for (let attempt = 0; attempt < MAX_XP_CAS_ATTEMPTS; attempt++) {
    const profile = await db.readProfile(userId);
    if (!profile) {
      await db.casFlipHabit({ kind, id, userId, completing: !completing });
      return { status: 404, body: { error: "Profile not found" } };
    }

    const { nextXp, effectiveXpDelta } = computeToggle({
      kind,
      currentXp: profile.xp,
      completing,
    });

    const result = await db.casProfileXp({
      userId,
      expectedXp: profile.xp,
      nextXp,
      lastCheckIn,
    });

    if (result) {
      updated = result;
      // The *effective* delta, not the nominal one. They differ when the zero
      // floor clamps a deduction, and the client reconciles against this.
      appliedDelta = effectiveXpDelta;
      break;
    }
  }

  // ── 3. Compensate: an un-paid flip is worse than a clean failure ──
  if (!updated) {
    await db.casFlipHabit({ kind, id, userId, completing: !completing });
    return {
      status: 500,
      body: { error: "Could not update XP. Please try again." },
    };
  }

  return {
    status: 200,
    body: {
      xp: updated.xp,
      streak: updated.streak,
      lastCheckIn: updated.last_check_in,
      habit: habitView(flipped),
      xpDelta: appliedDelta,
    },
  };
}
