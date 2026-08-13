import {
  buildResetPlan,
  getUpdatedGlobalStreak,
  toDateStr,
  type ResettableHabit,
} from "@/lib/daily-reset";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * One operator's daily reset, in one place.
 *
 * Before this existed the logic lived twice: once in the cron route and once
 * in the browser, inside `EliteContext`'s login effect. Two implementations of
 * a timezone-aware, penalty-accruing, streak-updating routine is two chances
 * to get it wrong, and only one of them was ever tested.
 *
 * The browser copy is also what blocks Phase 5: it writes `xp`, `streak`,
 * `last_habit_reset`, per-habit streaks and `daily_logs` directly, so those
 * grants cannot be revoked while it exists. `/api/system/sync` calls this
 * function so the client can stop writing entirely.
 *
 * ## The lost update this fixes
 *
 * The reset computes an absolute final XP from a snapshot taken at the start.
 * If a habit toggle lands between the read and the write, the reset's absolute
 * value silently erases it. The profile write is therefore guarded on
 * `last_habit_reset` still holding the value we read: whoever gets there first
 * wins, and the loser becomes a no-op instead of clobbering.
 *
 * Note this is *not* the double-penalty bug an earlier analysis claimed. Both
 * writers read the profile in a single query, so `xp` and `last_habit_reset`
 * are a consistent snapshot and both compute the same `finalXp`. The defect is
 * a lost update, and a compare-and-swap is the right shape for it.
 */

export interface ResetProfile {
  id: string;
  xp: number;
  streak: number;
  timezone: string | null;
  last_check_in: string | null;
  last_habit_reset: string | null;
}

export interface ResetOutcome {
  /** False when the operator had already been reset for their local day. */
  didReset: boolean;
  xp: number;
  streak: number;
  lastHabitReset: string | null;
  /** Days archived to `daily_logs` on this run. */
  daysArchived: number;
}

function throwIfError(error: unknown, message: string) {
  if (error) {
    const detail =
      error && typeof error === "object" && "message" in error
        ? String(Reflect.get(error, "message"))
        : String(error);
    throw new Error(`${message}: ${detail}`);
  }
}

export async function runDailyResetForUser(params: {
  profile: ResetProfile;
  now?: Date;
  db?: typeof supabaseAdmin;
}): Promise<ResetOutcome> {
  const db = params.db ?? supabaseAdmin;
  const nowDate = params.now ?? new Date();
  const { profile } = params;
  const userId = profile.id;

  const userTz = profile.timezone ?? "UTC";
  const today = toDateStr(nowDate, userTz);
  const yesterdayStr = toDateStr(
    new Date(nowDate.getTime() - 86_400_000),
    userTz
  );

  // Already current for this operator's local day. This guard is what makes
  // the hourly cron safe: at most one reset lands per local day.
  if (profile.last_habit_reset === today) {
    return {
      didReset: false,
      xp: profile.xp,
      streak: profile.streak,
      lastHabitReset: profile.last_habit_reset,
      daysArchived: 0,
    };
  }

  const [nnRes, dhRes] = await Promise.all([
    db.from("non_negotiables").select("*").eq("user_id", userId),
    db.from("daily_habits").select("*").eq("user_id", userId),
  ]);
  throwIfError(nnRes.error, `Failed to load non-negotiables for ${userId}`);
  throwIfError(dhRes.error, `Failed to load daily habits for ${userId}`);

  const nns = (nnRes.data ?? []) as ResettableHabit[];
  const dailyHabits = (dhRes.data ?? []) as ResettableHabit[];

  const resetPlan = buildResetPlan({
    today,
    lastHabitReset: profile.last_habit_reset,
    xp: profile.xp,
    nonNegotiables: nns,
    dailyHabits,
  });

  for (const [index, day] of resetPlan.days.entries()) {
    // Upsert, not insert: the cron and this call can archive the same day
    // concurrently, and (user_id, date) is unique. Losing that race is fine.
    const { error: logErr } = await db.from("daily_logs").upsert(
      {
        user_id: userId,
        date: day.date,
        nn_summary: day.nnSummary,
        habit_summary: day.habitSummary,
        total_xp_at_time: day.xpAtTime,
        penalty: day.penalty,
      },
      { onConflict: "user_id,date", ignoreDuplicates: true }
    );
    throwIfError(logErr, `Failed to archive daily log for ${userId} on ${day.date}`);

    // Per-habit streaks advance once, against the live day only.
    if (index === 0) {
      for (const h of nns) {
        const { error } = await db
          .from("non_negotiables")
          .update({
            completed_today: false,
            streak: h.completed_today ? h.streak + 1 : 0,
          })
          .eq("id", h.id);
        throwIfError(error, `Failed to reset non-negotiable ${h.id}`);
      }
      for (const h of dailyHabits) {
        const { error } = await db
          .from("daily_habits")
          .update({
            completed_today: false,
            streak: h.completed_today ? h.streak + 1 : 0,
          })
          .eq("id", h.id);
        throwIfError(error, `Failed to reset daily habit ${h.id}`);
      }
    }
  }

  const newGlobalStreak = getUpdatedGlobalStreak({
    streak: profile.streak,
    lastCheckIn: profile.last_check_in,
    timezone: userTz,
    today,
    yesterday: yesterdayStr,
  });

  // The compare-and-swap described above. `.is(null)` is required because
  // PostgREST renders `.eq(col, null)` as `col=eq.null`, which never matches —
  // a first-ever reset would otherwise always lose its own race.
  const guarded = db
    .from("operator_profile")
    .update({
      xp: resetPlan.finalXp,
      streak: newGlobalStreak,
      last_habit_reset: today,
    })
    .eq("id", userId);

  const { data: written, error: profileUpdateErr } = await (
    profile.last_habit_reset === null
      ? guarded.is("last_habit_reset", null)
      : guarded.eq("last_habit_reset", profile.last_habit_reset)
  )
    .select("xp, streak, last_habit_reset")
    .maybeSingle();

  throwIfError(profileUpdateErr, `Failed to update profile for ${userId}`);

  if (!written) {
    // Another writer reset this operator first. Report their result, not ours.
    const { data: current } = await db
      .from("operator_profile")
      .select("xp, streak, last_habit_reset")
      .eq("id", userId)
      .maybeSingle();

    return {
      didReset: false,
      xp: current?.xp ?? profile.xp,
      streak: current?.streak ?? profile.streak,
      lastHabitReset: current?.last_habit_reset ?? profile.last_habit_reset,
      daysArchived: resetPlan.days.length,
    };
  }

  return {
    didReset: true,
    xp: written.xp,
    streak: written.streak,
    lastHabitReset: written.last_habit_reset,
    daysArchived: resetPlan.days.length,
  };
}
