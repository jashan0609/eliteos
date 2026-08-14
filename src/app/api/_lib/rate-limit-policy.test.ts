import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  allowOnLimiterFailure,
  BUDGETS,
  FAIL_MODE,
  retryAfterSeconds,
  type LimitName,
} from "./rate-limit-policy.ts";

describe("rate limit fail modes", () => {
  // The whole point of the split fail mode. Getting these backwards is silent:
  // everything keeps working right up until Upstash has an outage, and then
  // either the app stops or the enumeration oracle opens.
  test("economy routes fail open so an outage cannot lock people out", () => {
    assert.equal(allowOnLimiterFailure("habitToggle"), true);
    assert.equal(allowOnLimiterFailure("objectiveProgress"), true);
    assert.equal(allowOnLimiterFailure("sync"), true);
  });

  test("enumeration and spam surfaces fail closed", () => {
    assert.equal(allowOnLimiterFailure("checkUsername"), false);
    assert.equal(allowOnLimiterFailure("friendRequest"), false);
  });

  test("every budget declares a fail mode", () => {
    const budgets = Object.keys(BUDGETS) as LimitName[];
    for (const name of budgets) {
      assert.ok(
        FAIL_MODE[name] === "open" || FAIL_MODE[name] === "closed",
        `${name} has no fail mode`
      );
    }
    assert.equal(budgets.length, Object.keys(FAIL_MODE).length);
  });

  test("the unauthenticated route is never allowed to fail open", () => {
    // check-username is the only route reachable without a bearer token. If
    // this ever flips to "open", an Upstash outage becomes an unmetered
    // username enumeration window.
    assert.equal(FAIL_MODE.checkUsername, "closed");
  });
});

describe("budgets", () => {
  test("every budget is positive and windowed", () => {
    for (const [name, budget] of Object.entries(BUDGETS)) {
      assert.ok(budget.limit > 0, `${name} has a non-positive limit`);
      assert.match(budget.window, /^\d+ (s|m|h|d)$/, `${name} window malformed`);
    }
  });

  test("the unauthenticated budget is the tightest per minute", () => {
    // Nothing enforces this beyond review, so it is asserted: check-username
    // costs a service-role query and answers to anyone.
    assert.ok(BUDGETS.checkUsername.limit < BUDGETS.habitToggle.limit);
  });
});

describe("retryAfterSeconds", () => {
  test("rounds up to whole seconds", () => {
    assert.equal(retryAfterSeconds(10_400, 10_000), 1);
    assert.equal(retryAfterSeconds(12_100, 10_000), 3);
  });

  test("never advertises 0, which would invite an immediate retry", () => {
    assert.equal(retryAfterSeconds(10_000, 10_000), 1);
  });

  test("survives a reset already in the past", () => {
    // Upstash reports `reset` as absolute epoch ms. Clock skew between the
    // function and Redis can put it behind us, which naively yields a negative
    // Retry-After.
    assert.equal(retryAfterSeconds(9_000, 10_000), 1);
  });
});
