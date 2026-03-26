import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PENALTY_PER_NN = 60;

export async function GET(req: Request) {
  // ── Auth: verify the cron secret ──
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  try {
    // ── Fetch all operators that haven't been reset today ──
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from("operator_profile")
      .select("id, xp, streak, last_check_in, last_habit_reset")
      .or(`last_habit_reset.is.null,last_habit_reset.neq.${today}`);

    if (profileErr) throw profileErr;
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: "All operators current. No reset required.", processed: 0 });
    }

    let processedCount = 0;

    for (const profile of profiles) {
      const userId = profile.id;

      // ── Fetch habits in parallel ──
      const [nnRes, dhRes] = await Promise.all([
        supabaseAdmin.from("non_negotiables").select("*").eq("user_id", userId),
        supabaseAdmin.from("daily_habits").select("*").eq("user_id", userId),
      ]);

      const nns = nnRes.data ?? [];
      const dailyHabits = dhRes.data ?? [];

      // Skip users with no habits
      if (nns.length === 0 && dailyHabits.length === 0) continue;

      // ── Calculate penalties & build summaries ──
      let penalty = 0;
      const nnSummary = nns.map((h) => {
        if (!h.completed_today) penalty += PENALTY_PER_NN;
        return { title: h.title, completed: h.completed_today };
      });

      const habitSummary = dailyHabits.map((h) => ({
        title: h.title,
        completed: h.completed_today,
      }));

      // ── Archive daily log ──
      await supabaseAdmin.from("daily_logs").insert({
        user_id: userId,
        date: profile.last_habit_reset || yesterday,
        nn_summary: nnSummary,
        habit_summary: habitSummary,
        total_xp_at_time: profile.xp,
        penalty,
      });

      // ── Update individual habit streaks & reset completed_today ──
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

      // ── Global streak calculation ──
      const lastCheckInDay = profile.last_check_in
        ? profile.last_check_in.slice(0, 10)
        : null;
      let newGlobalStreak = profile.streak;

      if (lastCheckInDay === yesterday) {
        newGlobalStreak = profile.streak + 1;
      } else if (lastCheckInDay !== today) {
        newGlobalStreak = lastCheckInDay ? 0 : profile.streak;
      }

      // ── Apply penalty & update profile ──
      const newXp = Math.max(0, profile.xp - penalty);

      await supabaseAdmin
        .from("operator_profile")
        .update({
          xp: newXp,
          streak: newGlobalStreak,
          last_habit_reset: today,
        })
        .eq("id", userId);

      processedCount++;
    }

    return NextResponse.json({
      message: "Daily reset complete",
      processed: processedCount,
      date: today,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[DAILY_RESET_FAILURE] ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
