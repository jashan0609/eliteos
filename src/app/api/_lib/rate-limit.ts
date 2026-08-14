import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  allowOnLimiterFailure,
  BUDGETS,
  retryAfterSeconds,
  type LimitName,
} from "./rate-limit-policy";

export { BUDGETS, FAIL_MODE, type LimitName } from "./rate-limit-policy";

/**
 * Per-caller request budgets.
 *
 * Lives here rather than in `middleware.ts` on purpose. Middleware runs before
 * the bearer token is resolved, so it can only key on IP — and IP is the wrong
 * key for abuse control on an authenticated app: it punishes everyone behind a
 * shared NAT and does nothing about one account hammering from many addresses.
 * Called from `guard.ts` after `requireUserFromBearer`, the budget keys on the
 * user id, which is the thing actually being abused.
 *
 * `check-username` is the exception. It is the only unauthenticated route, so
 * it has no user id to key on and falls back to IP.
 *
 * Upstash is HTTP-based, so there is no connection pool to exhaust from a
 * serverless function — the reason it is used here instead of a node-redis
 * client.
 */

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Absent credentials disable the limiter rather than failing.
 *
 * Local development, CI and any preview deployment without Upstash configured
 * would otherwise have every route return 429 or 500 depending on the fail
 * mode. The warning below is what stops "disabled" from being silent in
 * production, where it would be a real hole.
 */
const enabled = Boolean(redisUrl && redisToken);

if (!enabled && process.env.NODE_ENV === "production") {
  console.warn(
    "[RATE_LIMIT_DISABLED] UPSTASH_REDIS_REST_URL / _TOKEN are unset. " +
      "Every budget in rate-limit.ts is inert. With no CAPTCHA in front of " +
      "signup this is the only abuse control there is."
  );
}

const redis = enabled
  ? new Redis({ url: redisUrl!, token: redisToken! })
  : null;

const limiters = new Map<LimitName, Ratelimit>();

function limiterFor(name: LimitName): Ratelimit | null {
  if (!redis) return null;
  const existing = limiters.get(name);
  if (existing) return existing;

  const budget = BUDGETS[name];
  const created = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      budget.limit,
      budget.window as Parameters<typeof Ratelimit.slidingWindow>[1]
    ),
    prefix: `eliteos:${name}`,
    analytics: false,
  });
  limiters.set(name, created);
  return created;
}

/**
 * Applies a budget. Returns a 429 response to return as-is, or null to proceed.
 */
export async function enforceRateLimit(
  name: LimitName,
  identifier: string
): Promise<NextResponse | null> {
  const limiter = limiterFor(name);
  if (!limiter) return null;

  let success: boolean;
  let reset: number;
  try {
    ({ success, reset } = await limiter.limit(identifier));
  } catch (err) {
    console.error(`[RATE_LIMIT_BACKEND_FAILURE] ${name}: ${String(err)}`);
    return allowOnLimiterFailure(name)
      ? null
      : NextResponse.json(
          { error: "Too many requests. Try again shortly." },
          { status: 429 }
        );
  }

  if (success) return null;

  const retryAfter = retryAfterSeconds(reset, Date.now());
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

/**
 * Best-effort caller address for the one route with no user id.
 *
 * `x-forwarded-for` is client-controlled in general, but on Vercel the platform
 * overwrites it, so the leftmost entry is the real peer. Falling back to a
 * single shared bucket is intentional: if the address cannot be determined,
 * every anonymous caller shares one budget, which fails safe rather than
 * handing out an unlimited one per forged header.
 */
export function callerAddress(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}
