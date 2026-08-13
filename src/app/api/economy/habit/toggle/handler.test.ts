import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { handleHabitToggle } from "./handler.ts";
import {
  createFakeDb,
  habit,
  type FakeDbState,
} from "../../_fake-db.ts";

const toggle = (
  db: ReturnType<typeof createFakeDb>["db"],
  over: Partial<{ kind: "daily" | "non-negotiable"; id: string; completing: boolean }> = {},
  userId = "user-1"
) =>
  handleHabitToggle({
    db,
    userId,
    request: { kind: "daily", id: "habit-1", completing: true, ...over },
    now: () => new Date("2026-08-13T12:00:00.000Z"),
  });

describe("handleHabitToggle — awards", () => {
  it("awards 15 for a daily habit and returns reconciled state", async () => {
    const { db, state } = createFakeDb({ habits: [habit()] });

    const res = await toggle(db);

    assert.equal(res.status, 200);
    assert.equal(res.body.xp, 115);
    assert.equal(res.body.xpDelta, 15);
    assert.equal(res.body.habit.completedToday, true);
    assert.equal(state.profile!.xp, 115);
  });

  it("awards 30 for a non-negotiable", async () => {
    const { db } = createFakeDb({ habits: [habit({ id: "nn-1" })] });

    const res = await toggle(db, { kind: "non-negotiable", id: "nn-1" });

    assert.equal(res.status, 200);
    assert.equal(res.body.xp, 130);
    assert.equal(res.body.xpDelta, 30);
  });

  it("deducts when un-completing", async () => {
    const { db } = createFakeDb({
      habits: [habit({ completed_today: true })],
    });

    const res = await toggle(db, { completing: false });

    assert.equal(res.status, 200);
    assert.equal(res.body.xp, 85);
    assert.equal(res.body.xpDelta, -15);
  });

  it("stamps last_check_in on completion but not on un-completion", async () => {
    const completing = createFakeDb({ habits: [habit()] });
    const undoing = createFakeDb({
      habits: [habit({ completed_today: true })],
      profile: {
        id: "user-1",
        xp: 100,
        streak: 3,
        last_check_in: "2026-01-01T00:00:00.000Z",
      },
    });

    await toggle(completing.db);
    await toggle(undoing.db, { completing: false });

    assert.equal(
      completing.state.profile!.last_check_in,
      "2026-08-13T12:00:00.000Z"
    );
    assert.equal(
      undoing.state.profile!.last_check_in,
      "2026-01-01T00:00:00.000Z"
    );
  });

  it("reports the effective delta when the zero floor clamps the deduction", async () => {
    const { db, state } = createFakeDb({
      habits: [habit({ completed_today: true })],
      profile: { id: "user-1", xp: 10, streak: 0, last_check_in: null },
    });

    const res = await toggle(db, { completing: false });

    assert.equal(res.status, 200);
    assert.equal(res.body.xp, 0);
    // -10, not the nominal -15. The client reconciles against what happened.
    assert.equal(res.body.xpDelta, -10);
    assert.equal(state.profile!.xp, 0);
  });
});

describe("handleHabitToggle — the double-award defence", () => {
  it("409s instead of awarding twice when the habit is already completed", async () => {
    const { db, state } = createFakeDb({
      habits: [habit({ completed_today: true })],
    });

    const res = await toggle(db, { completing: true });

    assert.equal(res.status, 409);
    assert.equal(res.body.error, "STALE");
    assert.equal(res.body.state.habit!.completedToday, true);
    // The whole point: XP did not move.
    assert.equal(state.profile!.xp, 100);
    assert.equal(state.calls.casProfileXp, 0);
  });

  it("returns current truth on 409 so the client can adopt it", async () => {
    const { db } = createFakeDb({
      habits: [habit({ completed_today: true, streak: 9 })],
    });

    const res = await toggle(db, { completing: true });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body.state.habit, {
      id: "habit-1",
      completedToday: true,
      streak: 9,
    });
    assert.equal(res.body.state.xp, 100);
    assert.equal(res.body.state.streak, 3);
  });

  it("awards exactly once when the same toggle is issued twice", async () => {
    const { db, state } = createFakeDb({ habits: [habit()] });

    const first = await toggle(db);
    const second = await toggle(db);

    assert.equal(first.status, 200);
    assert.equal(second.status, 409);
    assert.equal(state.profile!.xp, 115);
  });
});

describe("handleHabitToggle — ownership", () => {
  it("does not touch another operator's habit", async () => {
    const { db, state } = createFakeDb({
      habits: [habit({ user_id: "someone-else" })],
    });

    const res = await toggle(db);

    assert.equal(res.status, 404);
    assert.equal(state.habits[0].completed_today, false);
    assert.equal(state.profile!.xp, 100);
  });

  it("404s for a habit that does not exist", async () => {
    const { db } = createFakeDb({ habits: [] });

    const res = await toggle(db, { id: "nope" });

    assert.equal(res.status, 404);
  });
});

describe("handleHabitToggle — contention and compensation", () => {
  it("retries against a balance that moved mid-flight", async () => {
    let bumped = false;
    const { db, state } = createFakeDb({
      habits: [habit()],
      // Simulate a concurrent writer landing between our read and our write,
      // exactly once.
      onBeforeCasProfileXp: (s: FakeDbState) => {
        if (!bumped && s.profile) {
          bumped = true;
          s.profile.xp = 500;
        }
      },
    });

    const res = await toggle(db);

    assert.equal(res.status, 200);
    // Recomputed from 500, not clobbering it back to 115.
    assert.equal(res.body.xp, 515);
    assert.equal(state.calls.casProfileXp, 2);
  });

  it("puts the habit back when XP cannot be written", async () => {
    const { db, state } = createFakeDb({
      habits: [habit()],
      // Contention on every attempt — the CAS can never match.
      onBeforeCasProfileXp: (s: FakeDbState) => {
        if (s.profile) s.profile.xp += 1;
      },
    });

    const res = await toggle(db);

    assert.equal(res.status, 500);
    // The compensation: no flipped habit left behind without an award.
    assert.equal(state.habits[0].completed_today, false);
  });

  it("compensates when the profile is missing entirely", async () => {
    const { db, state } = createFakeDb({
      habits: [habit()],
      profile: null,
    });

    const res = await toggle(db);

    assert.equal(res.status, 404);
    assert.equal(state.habits[0].completed_today, false);
  });
});
