import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Shared entry guard for every API route.
 *
 * Promoted out of `src/app/api/friends/_lib.ts` in Phase 3, when the economy
 * routes became the second consumer. `friends/_lib.ts` re-exports from here so
 * the five existing routes did not have to churn.
 *
 * This is also the single place Phase 7 hangs rate limiting: it runs after the
 * bearer token is resolved, so budgets can be keyed on user id rather than IP,
 * which is what you actually want for abuse control.
 */

/**
 * Concatenates whatever a Postgres error carries.
 *
 * ⚠ **Never return this to the browser.** It deliberately includes `details`,
 * `hint` and `code`, which leak constraint names, column names and query hints.
 * It exists for server logs. The economy routes added in Phase 3 log this and
 * return a fixed string to the caller; the older friends routes still return it
 * on a 500 and are scheduled to be fixed alongside error monitoring in Phase 7.
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

export async function requireUserFromBearer(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) return { error: "Unauthorized", status: 401 as const };

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) return { error: "Unauthorized", status: 401 as const };

  return { user, error: null, status: 200 as const };
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
 * The only 500 body the economy routes emit.
 *
 * Full detail goes to the server log; the caller gets a fixed string. Phase 7
 * will attach a Sentry event id here so a support conversation can reference a
 * specific failure without the response ever carrying schema internals.
 */
export function serverError(tag: string, err: unknown) {
  console.error(`[${tag}] ${formatError(err)}`);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
