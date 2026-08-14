import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  shouldDeleteUnconfirmed,
  UNCONFIRMED_TTL_DAYS,
} from "./unconfirmed-cleanup.ts";

const NOW = Date.parse("2026-08-14T00:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("shouldDeleteUnconfirmed", () => {
  it("deletes an abandoned signup past the TTL", () => {
    assert.equal(
      shouldDeleteUnconfirmed(
        { created_at: daysAgo(UNCONFIRMED_TTL_DAYS + 1) },
        NOW
      ),
      true
    );
  });

  it("spares a signup still inside the TTL", () => {
    assert.equal(
      shouldDeleteUnconfirmed({ created_at: daysAgo(1) }, NOW),
      false
    );
  });

  it("spares anyone who has ever signed in, however old and unconfirmed", () => {
    // The clause that protects every operator who registered before email
    // confirmation was turned on. Without it this cron deletes the user base.
    assert.equal(
      shouldDeleteUnconfirmed(
        {
          created_at: daysAgo(400),
          email_confirmed_at: null,
          last_sign_in_at: daysAgo(399),
        },
        NOW
      ),
      false
    );
  });

  it("spares a confirmed account regardless of age", () => {
    assert.equal(
      shouldDeleteUnconfirmed(
        { created_at: daysAgo(400), email_confirmed_at: daysAgo(399) },
        NOW
      ),
      false
    );
  });

  it("spares an account with no creation date rather than assuming it is old", () => {
    assert.equal(shouldDeleteUnconfirmed({ created_at: null }, NOW), false);
    assert.equal(shouldDeleteUnconfirmed({}, NOW), false);
  });

  it("spares an account whose creation date will not parse", () => {
    // A NaN timestamp compared with <= is false anyway, but relying on that is
    // how a refactor turns "unknown age" into "infinitely old".
    assert.equal(
      shouldDeleteUnconfirmed({ created_at: "not-a-date" }, NOW),
      false
    );
  });

  it("treats the boundary as deletable exactly at the TTL", () => {
    assert.equal(
      shouldDeleteUnconfirmed(
        { created_at: daysAgo(UNCONFIRMED_TTL_DAYS) },
        NOW
      ),
      true
    );
  });
});
