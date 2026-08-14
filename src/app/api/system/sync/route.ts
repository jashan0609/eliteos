import { NextResponse } from "next/server";
import { z } from "zod";
import {
  parseJsonBody,
  requireUserFromBearer,
  serverError,
} from "@/app/api/_lib/guard";
import { enforceRateLimit } from "@/app/api/_lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  runDailyResetForUser,
  type ResetProfile,
} from "@/lib/server/run-daily-reset";

export const dynamic = "force-dynamic";

/**
 * Login-time sync, server-authoritative.
 *
 * This is `EliteContext`'s login effect moved server-side. That block writes
 * `xp`, `streak`, `last_habit_reset`, per-habit streaks and `daily_logs`
 * directly from the browser, which is the single reason those grants cannot be
 * revoked. Nothing can be locked down in Phase 5 until the client calls this
 * instead.
 *
 * Additive for now: the route exists and the client still does its own thing.
 * Phase 4 flips the client over.
 */

const bodySchema = z.object({
  // The browser's IANA zone. Trusted only to the extent that it decides *this
  // operator's* day boundary; it cannot affect anyone else's data.
  timezone: z.string().min(1).max(64).optional(),
});

export async function POST(req: Request) {
  const auth = await requireUserFromBearer(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Budget keys on the operator, not the address — see rate-limit.ts.
  const limited = await enforceRateLimit("sync", auth.user.id);
  if (limited) return limited;

  const body = await parseJsonBody(req, bodySchema);
  if (!body.ok) return body.response;

  const userId = auth.user.id;

  try {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("operator_profile")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) throw profileErr;
    if (!profile) {
      // The `on_auth_user_created` trigger owns profile creation. A missing row
      // here is a real fault, not something to paper over by inserting one —
      // that self-healing insert is exactly what used to brick accounts.
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Adopt the browser's timezone when it differs, so the day boundary tracks
    // the operator rather than the server.
    const timezone = body.data.timezone ?? profile.timezone ?? "UTC";
    if (timezone !== profile.timezone) {
      const { error } = await supabaseAdmin
        .from("operator_profile")
        .update({ timezone })
        .eq("id", userId);
      if (error) throw error;
    }

    const outcome = await runDailyResetForUser({
      profile: { ...(profile as ResetProfile), timezone },
    });

    const [objectives, dailyHabits, nonNegotiables] = await Promise.all([
      supabaseAdmin
        .from("objectives")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("daily_habits")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("non_negotiables")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);

    return NextResponse.json({
      xp: outcome.xp,
      streak: outcome.streak,
      lastHabitReset: outcome.lastHabitReset,
      didReset: outcome.didReset,
      daysArchived: outcome.daysArchived,
      timezone,
      objectives: objectives.data ?? [],
      dailyHabits: dailyHabits.data ?? [],
      nonNegotiables: nonNegotiables.data ?? [],
    });
  } catch (err) {
    return serverError("SYSTEM_SYNC_FAILURE", err);
  }
}
