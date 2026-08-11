import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PENALTY_PER_NN,
  buildResetPlan,
  dateRange,
  getLastCheckInDay,
  getUpdatedGlobalStreak,
  toDateStr,
  type ResettableHabit,
} from "./daily-reset.ts";

function habit(
  title: string,
  completed_today: boolean,
  streak = 0
): ResettableHabit {
  return { id: `id-${title}`, title, completed_today, streak };
}

describe("toDateStr", () => {
  it("formats in UTC by default", () => {
    assert.equal(toDateStr(new Date("2026-08-11T04:00:00Z")), "2026-08-11");
  });

  it("resolves the local day for zones behind UTC", () => {
    // 04:00 UTC is still the previous evening in Los Angeles.
    assert.equal(
      toDateStr(new Date("2026-08-11T04:00:00Z"), "America/Los_Angeles"),
      "2026-08-10"
    );
  });

  it("resolves the local day for zones ahead of UTC", () => {
    // 13:00 UTC is already tomorrow in Auckland.
    assert.equal(
      toDateStr(new Date("2026-08-11T13:00:00Z"), "Pacific/Auckland"),
      "2026-08-12"
    );
  });

  it("falls back to the UTC date when the timezone is invalid", () => {
    assert.equal(
      toDateStr(new Date("2026-08-11T04:00:00Z"), "Not/AZone"),
      "2026-08-11"
    );
  });
});

describe("dateRange", () => {
  it("includes the start day and excludes the end day", () => {
    assert.deepEqual(dateRange("2026-08-08", "2026-08-11"), [
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
    ]);
  });

  it("returns a single day for consecutive dates", () => {
    assert.deepEqual(dateRange("2026-08-10", "2026-08-11"), ["2026-08-10"]);
  });

  it("returns nothing when the range is empty or inverted", () => {
    assert.deepEqual(dateRange("2026-08-11", "2026-08-11"), []);
    assert.deepEqual(dateRange("2026-08-12", "2026-08-11"), []);
  });

  it("crosses month and year boundaries", () => {
    assert.deepEqual(dateRange("2026-12-30", "2027-01-02"), [
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ]);
  });

  it("is unaffected by DST transitions", () => {
    // US spring-forward weekend: still exactly three calendar days.
    assert.deepEqual(dateRange("2026-03-07", "2026-03-10"), [
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
    ]);
  });
});

describe("getLastCheckInDay", () => {
  it("returns null when there is no check-in", () => {
    assert.equal(getLastCheckInDay(null, "UTC"), null);
  });

  it("projects the timestamp into the operator's timezone", () => {
    assert.equal(
      getLastCheckInDay("2026-08-11T04:00:00Z", "America/Los_Angeles"),
      "2026-08-10"
    );
  });
});

describe("getUpdatedGlobalStreak", () => {
  const base = {
    timezone: "UTC",
    today: "2026-08-11",
    yesterday: "2026-08-10",
  };

  it("extends the streak when the last check-in was yesterday", () => {
    assert.equal(
      getUpdatedGlobalStreak({
        ...base,
        streak: 4,
        lastCheckIn: "2026-08-10T18:00:00Z",
      }),
      5
    );
  });

  it("holds the streak when the operator already checked in today", () => {
    assert.equal(
      getUpdatedGlobalStreak({
        ...base,
        streak: 4,
        lastCheckIn: "2026-08-11T06:00:00Z",
      }),
      4
    );
  });

  it("breaks the streak after a missed day", () => {
    assert.equal(
      getUpdatedGlobalStreak({
        ...base,
        streak: 9,
        lastCheckIn: "2026-08-08T18:00:00Z",
      }),
      0
    );
  });

  it("preserves the streak for an operator who has never checked in", () => {
    assert.equal(
      getUpdatedGlobalStreak({ ...base, streak: 3, lastCheckIn: null }),
      3
    );
  });
});

describe("buildResetPlan", () => {
  it("archives one day using live completion state", () => {
    const plan = buildResetPlan({
      today: "2026-08-11",
      lastHabitReset: "2026-08-10",
      xp: 1000,
      nonNegotiables: [habit("train", true), habit("read", false)],
      dailyHabits: [habit("journal", true)],
    });

    assert.equal(plan.days.length, 1);
    const [day] = plan.days;
    assert.equal(day.date, "2026-08-10");
    assert.deepEqual(day.nnSummary, [
      { title: "train", completed: true },
      { title: "read", completed: false },
    ]);
    assert.deepEqual(day.habitSummary, [{ title: "journal", completed: true }]);
    assert.equal(day.penalty, PENALTY_PER_NN);
    assert.equal(day.xpAtTime, 1000);
    assert.equal(plan.finalXp, 940);
  });

  it("treats every backfilled day after the first as fully missed", () => {
    const plan = buildResetPlan({
      today: "2026-08-11",
      lastHabitReset: "2026-08-08",
      xp: 1000,
      nonNegotiables: [habit("train", true)],
      dailyHabits: [habit("journal", true)],
    });

    assert.deepEqual(
      plan.days.map((d) => d.date),
      ["2026-08-08", "2026-08-09", "2026-08-10"]
    );
    // Only the live day keeps its completion state.
    assert.deepEqual(
      plan.days.map((d) => d.penalty),
      [0, PENALTY_PER_NN, PENALTY_PER_NN]
    );
    assert.equal(plan.days[1].habitSummary[0].completed, false);
    // xpAtTime is the balance *before* that day's penalty is applied.
    assert.deepEqual(
      plan.days.map((d) => d.xpAtTime),
      [1000, 1000, 940]
    );
    assert.equal(plan.finalXp, 880);
  });

  it("floors XP at zero instead of going negative", () => {
    const plan = buildResetPlan({
      today: "2026-08-11",
      lastHabitReset: "2026-08-10",
      xp: 50,
      nonNegotiables: [habit("train", false)],
      dailyHabits: [],
    });

    assert.equal(plan.days[0].xpAfterPenalty, 0);
    assert.equal(plan.finalXp, 0);
  });

  it("does nothing when the operator already reset today", () => {
    const plan = buildResetPlan({
      today: "2026-08-11",
      lastHabitReset: "2026-08-11",
      xp: 1000,
      nonNegotiables: [habit("train", false)],
      dailyHabits: [],
    });

    assert.deepEqual(plan.days, []);
    assert.equal(plan.finalXp, 1000);
  });

  it("never penalizes an operator with no non-negotiables", () => {
    const plan = buildResetPlan({
      today: "2026-08-11",
      lastHabitReset: "2026-08-01",
      xp: 1000,
      nonNegotiables: [],
      dailyHabits: [habit("journal", false)],
    });

    assert.equal(plan.days.length, 10);
    assert.ok(plan.days.every((d) => d.penalty === 0));
    assert.equal(plan.finalXp, 1000);
  });

  it("falls back to a single day when last_habit_reset is null", () => {
    const today = toDateStr(new Date());
    const plan = buildResetPlan({
      today,
      lastHabitReset: null,
      xp: 500,
      nonNegotiables: [habit("train", true)],
      dailyHabits: [],
    });

    assert.equal(plan.days.length, 1);
    assert.equal(plan.finalXp, 500);
  });
});
