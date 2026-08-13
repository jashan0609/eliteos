import type {
  EconomyDb,
  HabitRow,
  ObjectiveRow,
  ProfileRow,
} from "./_db.ts";

/**
 * An in-memory `EconomyDb` for handler tests.
 *
 * Enforces the same compare-and-swap semantics as the real implementation —
 * a mismatched expectation returns null rather than writing — because those
 * semantics are exactly what the handlers are being tested for. A fake that
 * always succeeds would pass every test and prove nothing.
 *
 * `onBeforeCasProfileXp` is the hook for simulating contention: it runs before
 * each XP compare-and-swap, so a test can move the balance underneath the
 * handler the way a concurrent request would.
 */
export interface FakeDbOptions {
  habits?: HabitRow[];
  objectives?: ObjectiveRow[];
  profile?: ProfileRow | null;
  onBeforeCasProfileXp?: (state: FakeDbState) => void;
}

export interface FakeDbState {
  habits: HabitRow[];
  objectives: ObjectiveRow[];
  profile: ProfileRow | null;
  calls: {
    casFlipHabit: number;
    casProfileXp: number;
    casObjectiveProgress: number;
  };
}

export function createFakeDb(options: FakeDbOptions = {}): {
  db: EconomyDb;
  state: FakeDbState;
} {
  const state: FakeDbState = {
    habits: (options.habits ?? []).map((h) => ({ ...h })),
    objectives: (options.objectives ?? []).map((o) => ({ ...o })),
    profile:
      options.profile === undefined
        ? { id: "user-1", xp: 100, streak: 3, last_check_in: null }
        : options.profile
          ? { ...options.profile }
          : null,
    calls: { casFlipHabit: 0, casProfileXp: 0, casObjectiveProgress: 0 },
  };

  const db: EconomyDb = {
    async casFlipHabit({ id, userId, completing }) {
      state.calls.casFlipHabit++;
      const row = state.habits.find(
        (h) =>
          h.id === id &&
          h.user_id === userId &&
          h.completed_today === !completing
      );
      if (!row) return null;
      row.completed_today = completing;
      return { ...row };
    },

    async readHabit({ id, userId }) {
      const row = state.habits.find(
        (h) => h.id === id && h.user_id === userId
      );
      return row ? { ...row } : null;
    },

    async readObjective({ id, userId }) {
      const row = state.objectives.find(
        (o) => o.id === id && o.user_id === userId
      );
      return row ? { ...row } : null;
    },

    async casObjectiveProgress({
      id,
      userId,
      expectedProgress,
      nextProgress,
      nextStatus,
    }) {
      state.calls.casObjectiveProgress++;
      const row = state.objectives.find(
        (o) =>
          o.id === id && o.user_id === userId && o.progress === expectedProgress
      );
      if (!row) return null;
      row.progress = nextProgress;
      row.status = nextStatus;
      return { ...row };
    },

    async readProfile(userId) {
      if (!state.profile || state.profile.id !== userId) return null;
      return { ...state.profile };
    },

    async casProfileXp({ userId, expectedXp, nextXp, lastCheckIn }) {
      options.onBeforeCasProfileXp?.(state);
      state.calls.casProfileXp++;
      if (!state.profile || state.profile.id !== userId) return null;
      if (state.profile.xp !== expectedXp) return null;
      state.profile.xp = nextXp;
      if (lastCheckIn !== undefined) state.profile.last_check_in = lastCheckIn;
      return { ...state.profile };
    },
  };

  return { db, state };
}

export const habit = (over: Partial<HabitRow> = {}): HabitRow => ({
  id: "habit-1",
  user_id: "user-1",
  title: "Read book",
  completed_today: false,
  streak: 0,
  ...over,
});

export const objective = (over: Partial<ObjectiveRow> = {}): ObjectiveRow => ({
  id: "obj-1",
  user_id: "user-1",
  type: "sprint",
  progress: 0,
  status: "Active",
  ...over,
});
