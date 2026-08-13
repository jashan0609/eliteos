// Relative, with extensions — see the note in the habit toggle handler.
import { computeObjectiveProgress } from "../../../../../lib/economy.ts";
import type { EconomyDb, ObjectiveRow } from "../../_db.ts";

/**
 * Advance an objective by one step, server-authoritative.
 *
 * The client sends only an id. The step size and the 500/200 completion awards
 * live in `src/lib/economy.ts` and are never accepted from the caller.
 *
 * The double-award defence is the compare-and-swap on `progress`. Two tabs can
 * both read 90 and both decide "this completes it"; only one write matches
 * `progress = 90`, so only one pays out. The loser gets a 409 carrying current
 * truth rather than a second 500 XP.
 */

export const MAX_XP_CAS_ATTEMPTS = 3;

export type ObjectiveProgressOutcome =
  | {
      status: 200;
      body: {
        objective: { id: string; progress: number; status: string };
        xp: number;
        xpAwarded: number;
      };
    }
  | {
      status: 409;
      body: {
        error: "STALE";
        state: {
          objective: { id: string; progress: number; status: string } | null;
          xp: number | null;
        };
      };
    }
  | { status: 404; body: { error: string } }
  | { status: 500; body: { error: string } };

const objectiveView = (row: ObjectiveRow) => ({
  id: row.id,
  progress: row.progress,
  status: row.status,
});

export async function handleObjectiveProgress(params: {
  db: EconomyDb;
  userId: string;
  request: { id: string };
}): Promise<ObjectiveProgressOutcome> {
  const { db, userId, request } = params;

  const objective = await db.readObjective({ id: request.id, userId });
  if (!objective) {
    return { status: 404, body: { error: "Objective not found" } };
  }

  const plan = computeObjectiveProgress({
    currentProgress: objective.progress,
    currentStatus: objective.status,
    type: objective.type,
    currentXp: 0, // XP is resolved below against the live profile row.
  });

  // Already Completed: inert by design, and worth a 409 rather than a silent
  // 200 so a client that thinks it is still Active corrects itself.
  if (!plan.changed) {
    const profile = await db.readProfile(userId);
    return {
      status: 409,
      body: {
        error: "STALE",
        state: {
          objective: objectiveView(objective),
          xp: profile?.xp ?? null,
        },
      },
    };
  }

  const advanced = await db.casObjectiveProgress({
    id: request.id,
    userId,
    expectedProgress: objective.progress,
    nextProgress: plan.nextProgress,
    nextStatus: plan.nextStatus,
  });

  if (!advanced) {
    // Someone else advanced it between our read and our write.
    const [current, profile] = await Promise.all([
      db.readObjective({ id: request.id, userId }),
      db.readProfile(userId),
    ]);
    return {
      status: 409,
      body: {
        error: "STALE",
        state: {
          objective: current ? objectiveView(current) : null,
          xp: profile?.xp ?? null,
        },
      },
    };
  }

  // No award for a mid-flight step — nothing further to do.
  if (plan.xpAwarded === 0) {
    const profile = await db.readProfile(userId);
    return {
      status: 200,
      body: {
        objective: objectiveView(advanced),
        xp: profile?.xp ?? 0,
        xpAwarded: 0,
      },
    };
  }

  for (let attempt = 0; attempt < MAX_XP_CAS_ATTEMPTS; attempt++) {
    const profile = await db.readProfile(userId);
    if (!profile) return { status: 404, body: { error: "Profile not found" } };

    const result = await db.casProfileXp({
      userId,
      expectedXp: profile.xp,
      nextXp: profile.xp + plan.xpAwarded,
    });

    if (result) {
      return {
        status: 200,
        body: {
          objective: objectiveView(advanced),
          xp: result.xp,
          xpAwarded: plan.xpAwarded,
        },
      };
    }
  }

  // The objective is Completed but the award did not land. Deliberately *not*
  // rolled back: reverting a completion the operator can see is worse than a
  // missing award, and the CAS guarantees it can never be paid twice, so this
  // is safely recoverable by hand.
  return {
    status: 500,
    body: { error: "Objective completed but the XP award failed." },
  };
}
