import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  buildArenaLeaderboard,
  type ArenaLeaderboardEntry,
  type ArenaLog,
} from "@/lib/arena";
import { formatError, requireUserFromBearer } from "@/app/api/friends/_lib";

export const dynamic = "force-dynamic";

function mapLogRow(row: {
  date: string;
  nn_summary: unknown;
  habit_summary: unknown;
  total_xp_at_time: number;
  penalty: number;
}): ArenaLog {
  return {
    date: row.date,
    nnSummary: row.nn_summary as { title: string; completed: boolean }[],
    habitSummary: row.habit_summary as { title: string; completed: boolean }[],
    totalXpAtTime: row.total_xp_at_time,
    penalty: row.penalty,
  };
}

export async function GET(req: Request) {
  const auth = await requireUserFromBearer(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const userId = auth.user!.id;
    const [profileRes, friendshipsRes] = await Promise.all([
      supabaseAdmin
        .from("operator_profile")
        .select("id, username, xp, streak")
        .eq("id", userId)
        .single(),
      supabaseAdmin
        .from("friendships")
        .select("user_low_id, user_high_id")
        .or(`user_low_id.eq.${userId},user_high_id.eq.${userId}`),
    ]);
    if (profileRes.error || !profileRes.data) throw new Error(formatError(profileRes.error));
    if (friendshipsRes.error) throw new Error(formatError(friendshipsRes.error));

    const friendIds = (friendshipsRes.data ?? []).map((row) =>
      row.user_low_id === userId ? row.user_high_id : row.user_low_id
    );
    const allIds = Array.from(new Set([userId, ...friendIds]));

    const [profilesRes, logsRes] = await Promise.all([
      supabaseAdmin
        .from("operator_profile")
        .select("id, username, xp, streak")
        .in("id", allIds),
      supabaseAdmin
        .from("daily_logs")
        .select("user_id, date, nn_summary, habit_summary, total_xp_at_time, penalty")
        .in("user_id", allIds)
        .order("date", { ascending: false }),
    ]);

    if (profilesRes.error) throw new Error(formatError(profilesRes.error));
    if (logsRes.error) throw new Error(formatError(logsRes.error));

    const users = (profilesRes.data ?? []).map((profile) => ({
      userId: profile.id,
      username: profile.username ?? "unknown",
      xp: profile.xp ?? 0,
      streak: profile.streak ?? 0,
    }));

    const logsByUserId = new Map<string, ArenaLog[]>();
    for (const row of logsRes.data ?? []) {
      const existing = logsByUserId.get(row.user_id) ?? [];
      existing.push(
        mapLogRow({
          date: row.date,
          nn_summary: row.nn_summary,
          habit_summary: row.habit_summary,
          total_xp_at_time: row.total_xp_at_time,
          penalty: row.penalty,
        })
      );
      logsByUserId.set(row.user_id, existing);
    }

    const leaderboard = buildArenaLeaderboard(users, logsByUserId).map(
      (entry, index) => ({
        ...entry,
        rank: index + 1,
        isSelf: entry.userId === userId,
      })
    );
    const selfEntry: (ArenaLeaderboardEntry & { rank: number; isSelf: boolean }) | null =
      leaderboard.find((entry) => entry.userId === userId) ?? null;

    return NextResponse.json({
      leaderboard,
      self: selfEntry,
      friendCount: Math.max(0, allIds.length - 1),
    });
  } catch (err) {
    const message = formatError(err);
    console.error(`[FRIEND_LEADERBOARD_FAILURE] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
