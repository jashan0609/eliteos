import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type { User } from "@supabase/supabase-js";
import type { ZodType } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Shared entry guard for every API route.
 *
 * Promoted out of `src/app/api/friends/_lib.ts` in Phase 3, when the economy
 * routes became the second consumer. The shim that file left behind was deleted
 * in Phase 7 — every route imports from here directly now.
 */

/**
 * Concatenates whatever a Postgres error carries.
 *
 * ⚠ **Never return this to the browser.** It deliberately includes `details`,
 * `hint` and `code`, which leak constraint names, column names and query hints.
 * It exists for server logs, and `serverError` below is the only thing that
 * should be reaching for it on a failure path.
 *
 * Five friends routes used to return this string straight to the caller on a
 * 500. Fixed in Phase 7; do not reintroduce the pattern.
 */
export function formatError(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const parts = ["message", "details", "hint", "code"]
      .map((key) => {
        const value = Reflect.get(err, key);
        return value ? `${key}=${String(value)}` : null;
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
  }
  return String(err);
}

/**
 * Explicit union so `if (auth.error) return …` actually narrows.
 *
 * Inferred, this collapsed into one shape where `user` was always possibly
 * undefined, which is why every call site carried `auth.user!.id` — a non-null
 * assertion standing in for a type the compiler could have proven.
 *
 * `error` is the literal `"Unauthorized"` rather than `string` because that is
 * what makes it a usable discriminant: TypeScript narrows a union on a property
 * only when its type is a unit type in each member. Widen it back to `string`
 * and the assertions all have to come back.
 */
export type BearerAuth =
  | { user: null; error: "Unauthorized"; status: 401 }
  | { user: User; error: null; status: 200 };

export async function requireUserFromBearer(req: Request): Promise<BearerAuth> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) return { user: null, error: "Unauthorized", status: 401 };

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user)
    return { user: null, error: "Unauthorized", status: 401 };

  return { user, error: null, status: 200 };
}

export function canonicalPair(a: string, b: string) {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

/**
 * Parse and validate a JSON body against a schema.
 *
 * Returns a discriminated result rather than throwing, so routes handle a
 * malformed body as an ordinary 400 rather than falling into the catch-all 500
 * that would otherwise report a client mistake as a server fault.
 */
export async function parseJsonBody<T>(
  req: Request,
  schema: ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      ),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".");
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: path
            ? `Invalid \`${path}\`: ${issue.message}`
            : (issue?.message ?? "Invalid request body"),
        },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * The only 500 body any route emits.
 *
 * Full detail goes to the server log; the caller gets a fixed string. This is
 * the single choke point for that rule, which is why every route's catch block
 * is now one line — there is nowhere left to accidentally spell out the leak.
 *
 * When Sentry is attached, capture here and add its event id to the response
 * so a support conversation can reference a specific failure without the body
 * ever carrying schema internals.
 */
export function serverError(tag: string, err: unknown) {
  console.error(`[${tag}] ${formatError(err)}`);

  // No DSN configured means this returns undefined and the body is unchanged.
  const eventId = Sentry.captureException(err, { tags: { route: tag } });

  return NextResponse.json(
    // `ref` is the whole point of capturing here: it lets a support
    // conversation name one specific failure without the response body ever
    // carrying the constraint and column names `formatError` collects.
    { error: "Something went wrong", ...(eventId ? { ref: eventId } : {}) },
    { status: 500 }
  );
}
