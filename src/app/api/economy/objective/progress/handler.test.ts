import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { handleObjectiveProgress } from "./handler.ts";
import { createFakeDb, objective, type FakeDbState } from "../../_fake-db.ts";

const advance = (
  db: ReturnType<typeof createFakeDb>["db"],
  id = "obj-1",
  userId = "user-1"
) => handleObjectiveProgress({ db, userId, request: { id } });

/** Narrows the outcome union so `body` can be read without casts. */
function expectStatus<S extends number, T extends { status: number }>(
  res: T,
  status: S
): asserts res is Extract<T, { status: S }> {
  assert.equal(res.status, status);
}

describe("handleObjectiveProgress — stepping", () => {
  it("advances by ten without awarding XP mid-flight", async () => {
    const { db, state } = createFakeDb({
      objectives: [objective({ progress: 30 })],
    });

    const res = await advance(db);

    assert.equal(res.status, 200);
    assert.equal(res.body.objective.progress, 40);
    assert.equal(res.body.objective.status, "Active");
    assert.equal(res.body.xpAwarded, 0);
    assert.equal(state.profile!.xp, 100);
  });

  it("awards 200 when a sprint completes", async () => {
    const { db, state } = createFakeDb({
      objectives: [objective({ progress: 90 })],
    });

    const res = await advance(db);

    assert.equal(res.status, 200);
    assert.equal(res.body.objective.progress, 100);
    assert.equal(res.body.objective.status, "Completed");
    assert.equal(res.body.xpAwarded, 200);
    assert.equal(state.profile!.xp, 300);
  });

  it("awards 500 when a north-star completes", async () => {
    const { db } = createFakeDb({
      objectives: [objective({ progress: 90, type: "north-star" })],
    });

    const res = await advance(db);

    expectStatus(res, 200);
    assert.equal(res.body.xpAwarded, 500);
    assert.equal(res.body.xp, 600);
  });
});

describe("handleObjectiveProgress — the double-award defence", () => {
  it("409s on an objective that is already Completed", async () => {
    const { db, state } = createFakeDb({
      objectives: [objective({ progress: 100, status: "Completed" })],
    });

    const res = await advance(db);

    assert.equal(res.status, 409);
    assert.equal(res.body.error, "STALE");
    assert.equal(state.profile!.xp, 100);
    assert.equal(state.calls.casProfileXp, 0);
  });

  it("pays the completion award exactly once across repeated calls", async () => {
    const { db, state } = createFakeDb({
      objectives: [objective({ progress: 90 })],
    });

    const first = await advance(db);
    const second = await advance(db);
    const third = await advance(db);

    assert.equal(first.status, 200);
    assert.equal(first.body.xpAwarded, 200);
    assert.equal(second.status, 409);
    assert.equal(third.status, 409);
    assert.equal(state.profile!.xp, 300);
  });

  it("409s when another writer advanced progress first", async () => {
    const { db, state } = createFakeDb({
      objectives: [objective({ progress: 50 })],
    });
    // Move progress after the handler's read but before its CAS by mutating
    // the row out from under it.
    const originalRead = db.readObjective.bind(db);
    db.readObjective = async (p) => {
      const row = await originalRead(p);
      if (row && state.objectives[0].progress === 50) {
        state.objectives[0].progress = 70;
      }
      return row;
    };

    const res = await advance(db);

    assert.equal(res.status, 409);
    assert.equal(res.body.state.objective!.progress, 70);
    assert.equal(state.profile!.xp, 100);
  });
});

describe("handleObjectiveProgress — ownership and failure", () => {
  it("404s for another operator's objective", async () => {
    const { db, state } = createFakeDb({
      objectives: [objective({ user_id: "someone-else" })],
    });

    const res = await advance(db);

    assert.equal(res.status, 404);
    assert.equal(state.objectives[0].progress, 0);
  });

  it("keeps the completion but reports failure when the award cannot land", async () => {
    const { db, state } = createFakeDb({
      objectives: [objective({ progress: 90 })],
      onBeforeCasProfileXp: (s: FakeDbState) => {
        if (s.profile) s.profile.xp += 1;
      },
    });

    const res = await advance(db);

    assert.equal(res.status, 500);
    // Deliberately not rolled back — reverting a visible completion is worse
    // than a missing award, and the CAS means it can never be paid twice.
    assert.equal(state.objectives[0].status, "Completed");
    assert.equal(state.objectives[0].progress, 100);
  });
});
