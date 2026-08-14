import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUserFromBearer, serverError } from "@/app/api/_lib/guard";

export const dynamic = "force-dynamic";

/**
 * GDPR data portability — everything held about the caller, as one JSON file.
 *
 * Runs as service role rather than letting the browser read its own rows,
 * because the browser deliberately cannot: Phase 5 revoked its access to most
 * of what belongs in an export. Every query below is pinned to the caller's own
 * id — there is no path here that takes an id from the request.
 */
export async function GET(req: Request) {
  const auth = await requireUserFromBearer(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = auth.user.id;

  try {
    const [profile, objectives, habits, nonNegotiables, logs, friendships, requests] =
      await Promise.all([
        supabaseAdmin.from("operator_profile").select("*").eq("id", userId).maybeSingle(),
        supabaseAdmin.from("objectives").select("*").eq("user_id", userId),
        supabaseAdmin.from("daily_habits").select("*").eq("user_id", userId),
        supabaseAdmin.from("non_negotiables").select("*").eq("user_id", userId),
        supabaseAdmin.from("daily_logs").select("*").eq("user_id", userId),
        supabaseAdmin
          .from("friendships")
          .select("*")
          .or(`user_low_id.eq.${userId},user_high_id.eq.${userId}`),
        supabaseAdmin
          .from("friend_requests")
          .select("*")
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      ]);

    for (const result of [
      profile,
      objectives,
      habits,
      nonNegotiables,
      logs,
      friendships,
      requests,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        id: userId,
        email: auth.user.email ?? null,
        createdAt: auth.user.created_at ?? null,
      },
      profile: profile.data ?? null,
      objectives: objectives.data ?? [],
      dailyHabits: habits.data ?? [],
      nonNegotiables: nonNegotiables.data ?? [],
      // Retention is a rolling ~30 days, enforced by a pg_cron job. An export
      // is a copy of what exists now, not an archive of everything that ever
      // did, and saying so here is more honest than a silently short file.
      dailyLogs: logs.data ?? [],
      dailyLogsNote:
        "daily_logs are retained for roughly 30 days; older entries are deleted and cannot be exported.",
      friendships: friendships.data ?? [],
      friendRequests: requests.data ?? [],
    };

    const filename = `eliteos-export-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return serverError("ACCOUNT_EXPORT_FAILURE", err);
  }
}
