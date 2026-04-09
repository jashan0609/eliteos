import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  buildResetPlan,
  getUpdatedGlobalStreak,
  toDateStr,
} from "@/lib/daily-reset";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 500 }
    );
  }

  // ── Auth: verify the cron secret ──
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ── Fetch all operators ──
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from("operator_profile")
      .select("*");

    if (profileErr) throw profileErr;
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: "All operators current.", processed: 0 });
    }

    let processedCount = 0;

    for (const profile of profiles) {
      const userId = profile.id;
      const userTz = profile.timezone ?? "UTC";
      const today = toDateStr(new Date(), userTz);
      const yesterdayStr = toDateStr(
        new Date(Date.now() - 86_400_000),
        userTz
      );

      // Skip if already reset today in user's timezone
      if (profile.last_habit_reset === today) continue;

      // ── Fetch habits in parallel ──
      const [nnRes, dhRes] = await Promise.all([
        supabaseAdmin.from("non_negotiables").select("*").eq("user_id", userId),
        supabaseAdmin.from("daily_habits").select("*").eq("user_id", userId),
      ]);

      const nns = nnRes.data ?? [];
      const dailyHabits = dhRes.data ?? [];

      const resetPlan = buildResetPlan({
        today,
        lastHabitReset: profile.last_habit_reset,
        xp: profile.xp,
        nonNegotiables: nns,
        dailyHabits,
      });

      for (const [index, day] of resetPlan.days.entries()) {
        // Archive log for this day
        await supabaseAdmin.from("daily_logs").insert({
          user_id: userId,
          date: day.date,
          nn_summary: day.nnSummary,
          habit_summary: day.habitSummary,
          total_xp_at_time: day.xpAtTime,
          penalty: day.penalty,
        });

        // After the first day, streak updates for individual habits happen once
        if (index === 0) {
          for (const h of nns) {
            const newStreak = h.completed_today ? h.streak + 1 : 0;
            await supabaseAdmin
              .from("non_negotiables")
              .update({ completed_today: false, streak: newStreak })
              .eq("id", h.id);
          }
          for (const h of dailyHabits) {
            const newStreak = h.completed_today ? h.streak + 1 : 0;
            await supabaseAdmin
              .from("daily_habits")
              .update({ completed_today: false, streak: newStreak })
              .eq("id", h.id);
          }
        }
      }

      const newGlobalStreak = getUpdatedGlobalStreak({
        streak: profile.streak,
        lastCheckIn: profile.last_check_in,
        timezone: userTz,
        today,
        yesterday: yesterdayStr,
      });

      // ── Final profile update ──
      await supabaseAdmin
        .from("operator_profile")
        .update({
          xp: resetPlan.finalXp,
          streak: newGlobalStreak,
          last_habit_reset: today,
        })
        .eq("id", userId);

      processedCount++;
    }

    return NextResponse.json({
      message: "Daily reset complete",
      processed: processedCount,
      date: toDateStr(new Date()),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[DAILY_RESET_FAILURE] ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
