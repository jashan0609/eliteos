/**
 * The XP economy, as pure functions.
 *
 * Every number that affects rank lives here and nowhere else. Until now these
 * were magic literals inlined in `EliteContext.tsx` — 15 in `toggleDailyHabit`,
 * 30 in `toggleNonNegotiable`, 500/200 and the `+10` step buried inside
 * `incrementObjectiveProgress`. That was survivable while the browser was the
 * only writer. It stops being survivable in Phase 3, when the server becomes
 * authoritative and client and server must agree on every award to the point.
 *
 * This module is isomorphic and dependency-free by design: the same file is
 * imported by the React context for optimistic updates and by the API routes
 * for the authoritative write. One implementation, one test suite, no drift.
 *
 * Nothing here touches Supabase, `Date`, or React. Callers own persistence and
 * timestamps; these functions only answer "given this state, what should the
 * numbers become?"
 */

export type ObjectiveType = "north-star" | "sprint";
export type ObjectiveStatus = "Active" | "Completed";
export type HabitKind = "daily" | "non-negotiable";

/** Awarded for completing a daily habit; deducted for un-completing one. */
export const XP_PER_DAILY_HABIT = 15;

/** Awarded for completing a non-negotiable; deducted for un-completing one. */
export const XP_PER_NON_NEGOTIABLE = 30;

/** One-off award for driving a north-star objective to 100%. */
export const XP_NORTH_STAR_COMPLETION = 500;

/** One-off award for driving a sprint objective to 100%. */
export const XP_SPRINT_COMPLETION = 200;

/** Each press of the objective's increment control. */
export const OBJECTIVE_PROGRESS_STEP = 10;

/** Progress is a percentage and saturates here. */
export const OBJECTIVE_PROGRESS_MAX = 100;

/**
 * Re-exported so callers have exactly one import site for economy constants.
 * The penalty itself is applied by the daily reset, not by anything here.
 */
export { PENALTY_PER_NN } from "./daily-reset.ts";

/** XP awarded for a single completion of the given habit kind. */
export function xpForHabitKind(kind: HabitKind): number {
  return kind === "non-negotiable" ? XP_PER_NON_NEGOTIABLE : XP_PER_DAILY_HABIT;
}

/** XP awarded for completing an objective of the given type. */
export function xpForObjectiveCompletion(type: ObjectiveType): number {
  return type === "north-star"
    ? XP_NORTH_STAR_COMPLETION
    : XP_SPRINT_COMPLETION;
}

/**
 * Apply a signed delta to an XP balance, flooring at zero.
 *
 * XP is never negative. Note the consequence, which is a real property of the
 * economy rather than an accident: the floor is lossy, so un-completing a habit
 * when the balance is already near zero deducts less than completing it awarded.
 * An operator at 10 XP who un-completes a daily habit lands on 0, and
 * re-completing it takes them to 15. `computeToggle` reports the *effective*
 * delta so callers reconcile against what actually happened rather than what
 * they intended.
 */
export function applyXpDelta(currentXp: number, delta: number): number {
  return Math.max(0, currentXp + delta);
}

export interface ToggleResult {
  /** The delta that was requested (+15, -30, and so on). */
  xpDelta: number;
  /** The resulting balance, floored at zero. */
  nextXp: number;
  /**
   * `nextXp - currentXp`. Differs from `xpDelta` only when the floor clamped
   * the result. This is the number to trust when reconciling two writers.
   */
  effectiveXpDelta: number;
}

/**
 * Compute the XP effect of flipping a habit or non-negotiable.
 *
 * `completing` is the state being moved *to*, not the current one — callers
 * pass `!habit.completedToday`. Passing the value the habit already holds is
 * not detected here; that is a concurrency question, and Phase 3 answers it
 * with a compare-and-swap on the row rather than a guess in a pure function.
 */
export function computeToggle(params: {
  kind: HabitKind;
  currentXp: number;
  completing: boolean;
}): ToggleResult {
  const { kind, currentXp, completing } = params;
  const magnitude = xpForHabitKind(kind);
  const xpDelta = completing ? magnitude : -magnitude;
  const nextXp = applyXpDelta(currentXp, xpDelta);

  return { xpDelta, nextXp, effectiveXpDelta: nextXp - currentXp };
}

export interface ObjectiveProgressResult {
  nextProgress: number;
  nextStatus: ObjectiveStatus;
  /** Non-zero only on the transition that first reaches 100%. */
  xpAwarded: number;
  nextXp: number;
  /**
   * False when the objective was already Completed, so the caller can skip the
   * write entirely rather than issue a no-op update.
   */
  changed: boolean;
}

/**
 * Advance an objective by one step.
 *
 * The completion award fires exactly once, on the transition from Active to
 * 100%. An objective already marked Completed is inert: no progress, no XP, no
 * write. That is what stops a double-tap from paying out twice — though on the
 * client it is only a guard, since two tabs can both read Active before either
 * writes. Phase 3 makes it real with a compare-and-swap on `progress`.
 */
export function computeObjectiveProgress(params: {
  currentProgress: number;
  currentStatus: ObjectiveStatus;
  type: ObjectiveType;
  currentXp: number;
}): ObjectiveProgressResult {
  const { currentProgress, currentStatus, type, currentXp } = params;

  if (currentStatus === "Completed") {
    return {
      nextProgress: currentProgress,
      nextStatus: "Completed",
      xpAwarded: 0,
      nextXp: currentXp,
      changed: false,
    };
  }

  const nextProgress = Math.min(
    currentProgress + OBJECTIVE_PROGRESS_STEP,
    OBJECTIVE_PROGRESS_MAX
  );
  const justCompleted = nextProgress >= OBJECTIVE_PROGRESS_MAX;
  const xpAwarded = justCompleted ? xpForObjectiveCompletion(type) : 0;

  return {
    nextProgress,
    nextStatus: justCompleted ? "Completed" : "Active",
    xpAwarded,
    // Awards are always non-negative, so the floor cannot bite here. Routed
    // through applyXpDelta anyway so every XP mutation has one implementation.
    nextXp: applyXpDelta(currentXp, xpAwarded),
    changed: true,
  };
}
