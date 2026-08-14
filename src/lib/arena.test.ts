import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildArenaLeaderboard,
  calculateConsistencyMetrics,
  getDailyDisciplineScore,
  MIN_TRACKED,
  type ArenaLog,
} from "./arena.ts";

function items(total: number, completed: number) {
  return Array.from({ length: total }, (_, i) => ({
    title: `item-${i}`,
    completed: i < completed,
  }));
}

function log(
  date: string,
  nn: { total: number; done: number },
  habits: { total: number; done: number }
): ArenaLog {
  return {
    date,
    nnSummary: items(nn.total, nn.done),
    habitSummary: items(habits.total, habits.done),
    totalXpAtTime: 0,
    penalty: 0,
  };
}

function week(
  nn: { total: number; done: number },
  habits: { total: number; done: number },
  days = 7
): ArenaLog[] {
  return Array.from({ length: days }, (_, i) =>
    log(`2026-08-${String(i + 1).padStart(2, "0")}`, nn, habits)
  );
}

describe("getDailyDisciplineScore", () => {
  it("weights non-negotiables at 70% and habits at 30%", () => {
    // Three of each, so no floor applies and the weighting is visible on its
    // own: nn 1/3, habits 3/3 -> 0.333*0.7 + 1.0*0.3 = 0.533
    assert.equal(
      getDailyDisciplineScore(log("2026-08-01", { total: 3, done: 1 }, { total: 3, done: 3 })),
      53
    );
  });

  it("measures a short list against MIN_TRACKED, not its own length", () => {
    // Two non-negotiables, both done. Not 100 — the denominator floors at 3,
    // so completing everything you tracked is not the same as being complete.
    assert.equal(
      getDailyDisciplineScore(log("2026-08-01", { total: 2, done: 2 }, { total: 3, done: 3 })),
      Math.round((2 / MIN_TRACKED) * 0.7 * 100 + 0.3 * 100)
    );
  });

  it("renormalizes when the operator tracks no non-negotiables", () => {
    assert.equal(
      getDailyDisciplineScore(log("2026-08-01", { total: 0, done: 0 }, { total: 4, done: 4 })),
      100
    );
  });

  it("renormalizes when the operator tracks no daily habits", () => {
    assert.equal(
      getDailyDisciplineScore(log("2026-08-01", { total: 4, done: 2 }, { total: 0, done: 0 })),
      50
    );
  });

  it("scores zero when nothing is tracked at all", () => {
    assert.equal(
      getDailyDisciplineScore(log("2026-08-01", { total: 0, done: 0 }, { total: 0, done: 0 })),
      0
    );
  });
});

describe("calculateConsistencyMetrics", () => {
  it("withholds a score until seven days are archived", () => {
    const metrics = calculateConsistencyMetrics(
      week({ total: 2, done: 2 }, { total: 2, done: 2 }, 6),
      6
    );

    assert.equal(metrics.hasEnoughData, false);
    assert.equal(metrics.score, null);
    assert.equal(metrics.nnCompliance, null);
    // Daily points are still exposed so the UI can chart partial history.
    assert.equal(metrics.dailyPoints.length, 6);
  });

  it("scores a perfect week with a full streak at 100", () => {
    // Three per category is the smallest genuinely perfect week; below that the
    // denominator floor means "everything I tracked" is not yet "everything".
    const metrics = calculateConsistencyMetrics(
      week({ total: 3, done: 3 }, { total: 3, done: 3 }),
      7
    );

    assert.equal(metrics.hasEnoughData, true);
    assert.equal(metrics.score, 100);
    assert.equal(metrics.nnCompliance, 100);
    assert.equal(metrics.habitCompletion, 100);
    assert.equal(metrics.streakFactor, 100);
  });

  it("applies the 20% streak weight", () => {
    // Perfect compliance, zero streak -> (0*0.2 + 1*0.5 + 1*0.3) = 0.8
    const metrics = calculateConsistencyMetrics(
      week({ total: 3, done: 3 }, { total: 3, done: 3 }),
      0
    );

    assert.equal(metrics.score, 80);
  });

  it("clamps the streak factor at seven days", () => {
    const thirty = calculateConsistencyMetrics(
      week({ total: 2, done: 1 }, { total: 2, done: 1 }),
      30
    );
    const seven = calculateConsistencyMetrics(
      week({ total: 2, done: 1 }, { total: 2, done: 1 }),
      7
    );

    assert.equal(thirty.streakFactor, 100);
    assert.equal(thirty.score, seven.score);
  });

  it("scores only the seven most recent days", () => {
    const stale = week({ total: 2, done: 0 }, { total: 2, done: 0 }, 7).map(
      (entry, i) => ({ ...entry, date: `2026-07-${String(i + 1).padStart(2, "0")}` })
    );
    const recent = week({ total: 3, done: 3 }, { total: 3, done: 3 });

    const metrics = calculateConsistencyMetrics([...stale, ...recent], 7);

    assert.equal(metrics.score, 100);
    assert.deepEqual(
      metrics.dailyPoints.map((p) => p.date),
      recent.map((r) => r.date)
    );
  });

  it("orders daily points oldest to newest regardless of input order", () => {
    const shuffled = [...week({ total: 1, done: 1 }, { total: 1, done: 1 })].reverse();
    const metrics = calculateConsistencyMetrics(shuffled, 7);

    const dates = metrics.dailyPoints.map((p) => p.date);
    assert.deepEqual(dates, [...dates].sort());
  });

  it("no longer lets a token tracker outrank a committed one", () => {
    // The bug this fixes: one habit, ticked, used to score a flat 100 and beat
    // an operator tracking ten things at 80%. The denominator floor is what
    // closes it.
    const minimal = calculateConsistencyMetrics(
      week({ total: 0, done: 0 }, { total: 1, done: 1 }),
      7
    );
    const committed = calculateConsistencyMetrics(
      week({ total: 5, done: 4 }, { total: 5, done: 4 }),
      7
    );

    assert.equal(committed.score, 84);
    assert.ok(
      committed.score! > minimal.score!,
      `committed ${committed.score} should outrank minimal ${minimal.score}`
    );
  });

  it("still rewards completing more of the same list", () => {
    // The floor must not flatten real differences: 5-of-5 has to beat 4-of-5.
    const all = calculateConsistencyMetrics(week({ total: 5, done: 5 }, { total: 5, done: 5 }), 7);
    const most = calculateConsistencyMetrics(week({ total: 5, done: 4 }, { total: 5, done: 4 }), 7);
    assert.ok(all.score! > most.score!);
  });

  it("documents the residual: a full small list still beats a strong large one", () => {
    // Known and deliberate. Flooring at MIN_TRACKED fixes 1-of-1, but an
    // operator tracking exactly three habits and no non-negotiables still
    // renormalizes to a perfect score. Closing this means deciding whether an
    // untracked category should score zero rather than drop out — a product
    // question, not a rounding one.
    const threeHabitsOnly = calculateConsistencyMetrics(
      week({ total: 0, done: 0 }, { total: 3, done: 3 }),
      7
    );
    const committed = calculateConsistencyMetrics(
      week({ total: 5, done: 4 }, { total: 5, done: 4 }),
      7
    );
    assert.ok(threeHabitsOnly.score! > committed.score!);
  });
});

describe("buildArenaLeaderboard", () => {
  const logsFor = (
    ids: string[],
    nn: { total: number; done: number },
    habits: { total: number; done: number }
  ) => new Map(ids.map((id) => [id, week(nn, habits)]));

  it("ranks by score, then XP, then username", () => {
    const logs = new Map<string, ArenaLog[]>([
      ["dave", week({ total: 2, done: 2 }, { total: 2, done: 2 })],
      ["carol", week({ total: 2, done: 1 }, { total: 2, done: 2 })],
      ["bob", week({ total: 2, done: 1 }, { total: 2, done: 2 })],
      ["alice", week({ total: 2, done: 2 }, { total: 2, done: 2 }, 3)],
    ]);

    const board = buildArenaLeaderboard(
      [
        { userId: "bob", username: "bob", xp: 100, streak: 7 },
        { userId: "alice", username: "alice", xp: 50_000, streak: 7 },
        { userId: "carol", username: "carol", xp: 900, streak: 7 },
        { userId: "dave", username: "dave", xp: 0, streak: 7 },
      ],
      logs
    );

    assert.deepEqual(
      board.map((e) => e.username),
      ["dave", "carol", "bob", "alice"]
    );
    // Unscored operators sink below every scored one, however much XP they hold.
    assert.equal(board[3].score, null);
    assert.equal(board[3].hasEnoughData, false);
  });

  it("breaks exact ties alphabetically", () => {
    const board = buildArenaLeaderboard(
      [
        { userId: "z", username: "zed", xp: 500, streak: 7 },
        { userId: "a", username: "adam", xp: 500, streak: 7 },
      ],
      logsFor(["z", "a"], { total: 2, done: 2 }, { total: 2, done: 2 })
    );

    assert.deepEqual(
      board.map((e) => e.username),
      ["adam", "zed"]
    );
  });

  it("scores an operator with no archived logs as unranked rather than zero", () => {
    const board = buildArenaLeaderboard(
      [{ userId: "new", username: "newbie", xp: 0, streak: 0 }],
      new Map()
    );

    assert.equal(board[0].score, null);
    assert.equal(board[0].hasEnoughData, false);
  });
});
