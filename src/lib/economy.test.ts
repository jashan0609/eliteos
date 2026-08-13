import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyXpDelta,
  computeObjectiveProgress,
  computeToggle,
  OBJECTIVE_PROGRESS_MAX,
  OBJECTIVE_PROGRESS_STEP,
  PENALTY_PER_NN,
  XP_NORTH_STAR_COMPLETION,
  XP_PER_DAILY_HABIT,
  XP_PER_NON_NEGOTIABLE,
  XP_SPRINT_COMPLETION,
  xpForHabitKind,
  xpForObjectiveCompletion,
} from "./economy.ts";

describe("constants", () => {
  it("matches the values previously inlined in EliteContext", () => {
    // These are the literals this module replaced. If one of them changes,
    // the client and the Phase 3 server routes must change together — this
    // assertion is the tripwire for that.
    assert.equal(XP_PER_DAILY_HABIT, 15);
    assert.equal(XP_PER_NON_NEGOTIABLE, 30);
    assert.equal(XP_NORTH_STAR_COMPLETION, 500);
    assert.equal(XP_SPRINT_COMPLETION, 200);
    assert.equal(OBJECTIVE_PROGRESS_STEP, 10);
    assert.equal(OBJECTIVE_PROGRESS_MAX, 100);
  });

  it("re-exports the reset penalty so there is one import site", () => {
    assert.equal(PENALTY_PER_NN, 60);
  });

  it("maps habit kinds and objective types to their awards", () => {
    assert.equal(xpForHabitKind("daily"), 15);
    assert.equal(xpForHabitKind("non-negotiable"), 30);
    assert.equal(xpForObjectiveCompletion("north-star"), 500);
    assert.equal(xpForObjectiveCompletion("sprint"), 200);
  });
});

describe("applyXpDelta", () => {
  it("adds and subtracts", () => {
    assert.equal(applyXpDelta(100, 15), 115);
    assert.equal(applyXpDelta(100, -30), 70);
  });

  it("floors at zero rather than going negative", () => {
    assert.equal(applyXpDelta(10, -30), 0);
    assert.equal(applyXpDelta(0, -15), 0);
  });

  it("leaves an exact-zero result at zero", () => {
    assert.equal(applyXpDelta(15, -15), 0);
  });
});

describe("computeToggle", () => {
  it("awards 15 for completing a daily habit", () => {
    const r = computeToggle({ kind: "daily", currentXp: 0, completing: true });
    assert.deepEqual(r, { xpDelta: 15, nextXp: 15, effectiveXpDelta: 15 });
  });

  it("awards 30 for completing a non-negotiable", () => {
    const r = computeToggle({
      kind: "non-negotiable",
      currentXp: 100,
      completing: true,
    });
    assert.deepEqual(r, { xpDelta: 30, nextXp: 130, effectiveXpDelta: 30 });
  });

  it("deducts the same magnitude when un-completing", () => {
    assert.equal(
      computeToggle({ kind: "daily", currentXp: 100, completing: false })
        .nextXp,
      85
    );
    assert.equal(
      computeToggle({
        kind: "non-negotiable",
        currentXp: 100,
        completing: false,
      }).nextXp,
      70
    );
  });

  it("round-trips to the starting balance when XP is clear of the floor", () => {
    const on = computeToggle({ kind: "daily", currentXp: 100, completing: true });
    const off = computeToggle({
      kind: "daily",
      currentXp: on.nextXp,
      completing: false,
    });

    assert.equal(off.nextXp, 100);
  });

  it("reports a smaller effective delta when the floor clamps the deduction", () => {
    // Documents a real property of the economy, not desired behaviour: the
    // floor is lossy. An operator at 10 XP loses only 10, not 15.
    const r = computeToggle({ kind: "daily", currentXp: 10, completing: false });

    assert.equal(r.xpDelta, -15);
    assert.equal(r.nextXp, 0);
    assert.equal(r.effectiveXpDelta, -10);
  });

  it("lets a near-zero operator gain XP by toggling off and back on", () => {
    // Consequence of the lossy floor above, and the reason `effectiveXpDelta`
    // exists: 10 -> 0 -> 15 is a net gain of 5 from two presses. The gain is
    // bounded (the next off/on cycle returns to 15) and closing it means
    // deciding whether XP may go negative — a product call, deferred.
    const off = computeToggle({ kind: "daily", currentXp: 10, completing: false });
    const on = computeToggle({
      kind: "daily",
      currentXp: off.nextXp,
      completing: true,
    });

    assert.equal(on.nextXp, 15);
    assert.ok(on.nextXp > 10);

    const off2 = computeToggle({
      kind: "daily",
      currentXp: on.nextXp,
      completing: false,
    });
    const on2 = computeToggle({
      kind: "daily",
      currentXp: off2.nextXp,
      completing: true,
    });
    assert.equal(on2.nextXp, 15);
  });

  it("is deterministic — the same input always yields the same result", () => {
    const args = { kind: "daily" as const, currentXp: 42, completing: true };
    assert.deepEqual(computeToggle(args), computeToggle(args));
  });
});

describe("computeObjectiveProgress", () => {
  it("advances by ten without awarding XP mid-flight", () => {
    const r = computeObjectiveProgress({
      currentProgress: 30,
      currentStatus: "Active",
      type: "sprint",
      currentXp: 100,
    });

    assert.equal(r.nextProgress, 40);
    assert.equal(r.nextStatus, "Active");
    assert.equal(r.xpAwarded, 0);
    assert.equal(r.nextXp, 100);
    assert.equal(r.changed, true);
  });

  it("awards 200 when a sprint reaches 100", () => {
    const r = computeObjectiveProgress({
      currentProgress: 90,
      currentStatus: "Active",
      type: "sprint",
      currentXp: 0,
    });

    assert.equal(r.nextProgress, 100);
    assert.equal(r.nextStatus, "Completed");
    assert.equal(r.xpAwarded, 200);
    assert.equal(r.nextXp, 200);
  });

  it("awards 500 when a north-star reaches 100", () => {
    const r = computeObjectiveProgress({
      currentProgress: 90,
      currentStatus: "Active",
      type: "north-star",
      currentXp: 0,
    });

    assert.equal(r.xpAwarded, 500);
    assert.equal(r.nextXp, 500);
  });

  it("caps progress at 100 from an unaligned starting point", () => {
    const r = computeObjectiveProgress({
      currentProgress: 95,
      currentStatus: "Active",
      type: "sprint",
      currentXp: 0,
    });

    assert.equal(r.nextProgress, 100);
    assert.equal(r.xpAwarded, 200);
  });

  it("awards nothing and changes nothing once Completed", () => {
    // The double-award guard. Re-incrementing a finished objective must be
    // inert; `changed: false` lets the caller skip the write entirely.
    const r = computeObjectiveProgress({
      currentProgress: 100,
      currentStatus: "Completed",
      type: "north-star",
      currentXp: 500,
    });

    assert.deepEqual(r, {
      nextProgress: 100,
      nextStatus: "Completed",
      xpAwarded: 0,
      nextXp: 500,
      changed: false,
    });
  });

  it("pays the completion award exactly once across a full 0-to-100 run", () => {
    let progress = 0;
    let status: "Active" | "Completed" = "Active";
    let xp = 0;
    let awards = 0;

    // Ten steps to reach 100, then two more presses that must be inert.
    for (let i = 0; i < 12; i++) {
      const r = computeObjectiveProgress({
        currentProgress: progress,
        currentStatus: status,
        type: "sprint",
        currentXp: xp,
      });
      if (r.xpAwarded > 0) awards++;
      progress = r.nextProgress;
      status = r.nextStatus;
      xp = r.nextXp;
    }

    assert.equal(progress, 100);
    assert.equal(status, "Completed");
    assert.equal(awards, 1);
    assert.equal(xp, 200);
  });
});
