import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for an external uptime check.
 *
 * Deliberately does a trivial database read rather than returning a bare
 * `{ ok: true }`. A process that is up but cannot reach Postgres serves every
 * page as a "Sync failed" screen, which is indistinguishable from healthy if
 * the probe only asks whether the function booted.
 *
 * Unauthenticated, so it is public. It therefore reveals nothing beyond
 * up/down: no counts, no versions of anything an attacker could not already
 * fingerprint, and no error detail — a failing probe returns the same fixed
 * string every other route returns, with the reason going to the log.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    // `head: true` fetches no rows — this is a round trip, not a query.
    const { error } = await supabaseAdmin
      .from("operator_profile")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) throw new Error(error.message);

    return NextResponse.json(
      { status: "ok", latencyMs: Date.now() - startedAt },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(
      `[HEALTH_CHECK_FAILURE] ${err instanceof Error ? err.message : String(err)}`
    );
    return NextResponse.json(
      { status: "degraded" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
