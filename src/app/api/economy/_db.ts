import { supabaseAdmin } from "@/lib/supabase-admin";
import type { HabitKind, ObjectiveStatus, ObjectiveType } from "@/lib/economy";

/**
 * The narrow database surface the economy handlers need.
 *
 * Deliberately not the Supabase client. Handlers depend on this interface, so
 * their tests pass a hand-rolled object instead of faking PostgREST's chained
 * builder (`.from().update().eq().eq().eq().select().maybeSingle()`). Faking
 * that chain tests the fake; this tests the logic.
 *
 * Every method that mutates is a compare-and-swap and reports whether it
 * landed. That is the whole concurrency story: no transactions, no advisory
 * locks, just "update the row only if it still looks like what I read".
 */

export interface HabitRow {
  id: string;
  user_id: string;
  title: string;
  completed_today: boolean;
  streak: number;
}

export interface ObjectiveRow {
  id: string;
  user_id: string;
  type: ObjectiveType;
  progress: number;
  status: ObjectiveStatus;
}

export interface ProfileRow {
  id: string;
  xp: number;
  streak: number;
  last_check_in: string | null;
}

export interface EconomyDb {
  /**
   * Flip `completed_today` only if it currently holds the opposite value, and
   * only if the row belongs to `userId`.
   *
   * Returns the updated row, or null when nothing matched — which means either
   * the habit is not yours, it does not exist, or it is already in the state
   * you asked for. All three are the caller's 409, and the distinction is not
   * worth leaking: telling a caller "that habit exists but isn't yours" is an
   * enumeration oracle.
   */
  casFlipHabit(params: {
    kind: HabitKind;
    id: string;
    userId: string;
    completing: boolean;
  }): Promise<HabitRow | null>;

  readHabit(params: {
    kind: HabitKind;
    id: string;
    userId: string;
  }): Promise<HabitRow | null>;

  readObjective(params: {
    id: string;
    userId: string;
  }): Promise<ObjectiveRow | null>;

  /** CAS on `progress`, so a double-tap cannot advance twice. */
  casObjectiveProgress(params: {
    id: string;
    userId: string;
    expectedProgress: number;
    nextProgress: number;
    nextStatus: ObjectiveStatus;
  }): Promise<ObjectiveRow | null>;

  readProfile(userId: string): Promise<ProfileRow | null>;

  /**
   * CAS on `xp`. Returns the updated row, or null when another writer moved
   * the balance first — the caller retries against the new value rather than
   * clobbering it.
   */
  casProfileXp(params: {
    userId: string;
    expectedXp: number;
    nextXp: number;
    lastCheckIn?: string | null;
  }): Promise<ProfileRow | null>;
}

const habitTable = (kind: HabitKind) =>
  kind === "non-negotiable" ? "non_negotiables" : "daily_habits";

/** Throws on a genuine database fault; a zero-row CAS result is not a fault. */
function unwrap<T>(res: { data: T | null; error: unknown }): T | null {
  if (res.error) throw res.error;
  return res.data;
}

export const supabaseEconomyDb: EconomyDb = {
  async casFlipHabit({ kind, id, userId, completing }) {
    return unwrap(
      await supabaseAdmin
        .from(habitTable(kind))
        .update({ completed_today: completing })
        .eq("id", id)
        .eq("user_id", userId)
        // The guard. Without this, two concurrent requests both flip the row
        // and both award XP for the same completion.
        .eq("completed_today", !completing)
        .select("id, user_id, title, completed_today, streak")
        .maybeSingle()
    ) as HabitRow | null;
  },

  async readHabit({ kind, id, userId }) {
    return unwrap(
      await supabaseAdmin
        .from(habitTable(kind))
        .select("id, user_id, title, completed_today, streak")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle()
    ) as HabitRow | null;
  },

  async readObjective({ id, userId }) {
    return unwrap(
      await supabaseAdmin
        .from("objectives")
        .select("id, user_id, type, progress, status")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle()
    ) as ObjectiveRow | null;
  },

  async casObjectiveProgress({
    id,
    userId,
    expectedProgress,
    nextProgress,
    nextStatus,
  }) {
    return unwrap(
      await supabaseAdmin
        .from("objectives")
        .update({ progress: nextProgress, status: nextStatus })
        .eq("id", id)
        .eq("user_id", userId)
        .eq("progress", expectedProgress)
        .select("id, user_id, type, progress, status")
        .maybeSingle()
    ) as ObjectiveRow | null;
  },

  async readProfile(userId) {
    return unwrap(
      await supabaseAdmin
        .from("operator_profile")
        .select("id, xp, streak, last_check_in")
        .eq("id", userId)
        .maybeSingle()
    ) as ProfileRow | null;
  },

  async casProfileXp({ userId, expectedXp, nextXp, lastCheckIn }) {
    return unwrap(
      await supabaseAdmin
        .from("operator_profile")
        .update({
          xp: nextXp,
          ...(lastCheckIn !== undefined ? { last_check_in: lastCheckIn } : {}),
        })
        .eq("id", userId)
        .eq("xp", expectedXp)
        .select("id, xp, streak, last_check_in")
        .maybeSingle()
    ) as ProfileRow | null;
  },
};
