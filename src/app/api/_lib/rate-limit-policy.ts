/**
 * Rate-limit policy — pure, dependency-free, testable.
 *
 * Split from `rate-limit.ts` for the same reason `economy.ts` is split from the
 * routes that use it: the decisions worth asserting on are the budgets and the
 * behaviour when the backend is unreachable, and neither should require a Redis
 * or Next's request objects to check.
 */

/** Sliding windows, chosen against real use rather than round numbers. */
export const BUDGETS = {
  // The busiest operator today tracks 9 objectives, 2 non-negotiables and 1
  // habit. These bound a script, not a fast tapper.
  habitToggle: { limit: 60, window: "1 m" },
  objectiveProgress: { limit: 30, window: "1 m" },
  // Login-time sync plus token refreshes. Ten a minute is already generous.
  sync: { limit: 10, window: "1 m" },
  // Unsolicited friend requests are the spam vector on a social feature.
  friendRequest: { limit: 10, window: "1 h" },
  // Unauthenticated, and therefore a username enumeration oracle. This is the
  // budget that bounds it.
  checkUsername: { limit: 20, window: "1 m" },
} as const;

export type LimitName = keyof typeof BUDGETS;

/**
 * What to do when Redis itself is unreachable.
 *
 * Failing open on the economy routes is deliberate: an Upstash outage must not
 * stop people from ticking off their habits. The two that fail closed are the
 * ones where an outage would otherwise hand an attacker exactly the unlimited
 * window they want — enumeration and friend-request spam.
 */
export const FAIL_MODE: Record<LimitName, "open" | "closed"> = {
  habitToggle: "open",
  objectiveProgress: "open",
  sync: "open",
  friendRequest: "closed",
  checkUsername: "closed",
};

/** Whether a request proceeds when the limiter itself failed. */
export function allowOnLimiterFailure(name: LimitName): boolean {
  return FAIL_MODE[name] === "open";
}

/**
 * Seconds to advertise in `Retry-After`.
 *
 * Never below 1: a `Retry-After: 0` invites an immediate retry, which is the
 * opposite of what a 429 is for. Upstash reports `reset` as an absolute epoch
 * milliseconds value, so a clock already past it yields a negative number here.
 */
export function retryAfterSeconds(resetAtMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
}
