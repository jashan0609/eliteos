import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PENALTY_PER_NN = 60;
const MS_PER_DAY = 86_400_000;

/** Return "YYYY-MM-DD" in a given IANA timezone (e.g. "Asia/Kolkata") */
function toDateStr(d: Date, timezone = "UTC"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone })
      .format(d)
      .slice(0, 10);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Return every date string between `from` (inclusive) and `to` (exclusive) */
function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cursor < end) {
    dates.push(toDateStr(cursor));
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }
  return dates;
}

export async function GET(req: Request) {
  // ── Auth: verify the cron secret ──
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ── Fetch all operators ──
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from("operator_profile")
      .select("id, xp, streak, last_check_in, last_habit_reset, timezone");

    if (profileErr) throw profileErr;
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: "All operators current.", processed: 0 });
    }

    let processedCount = 0;

    for (const profile of profiles) {
      const userId = profile.id;
      const userTz = profile.timezone ?? "UTC";
      const today = toDateStr(new Date(), userTz);
      const yesterdayStr = toDateStr(new Date(Date.now() - MS_PER_DAY), userTz);

      // Skip if already reset today in user's timezone
      if (profile.last_habit_reset === today) continue;

      // ── Fetch habits in parallel ──
      const [nnRes, dhRes] = await Promise.all([
        supabaseAdmin.from("non_negotiables").select("*").eq("user_id", userId),
        supabaseAdmin.from("daily_habits").select("*").eq("user_id", userId),
      ]);

      const nns = nnRes.data ?? [];
      const dailyHabits = dhRes.data ?? [];

      if (nns.length === 0 && dailyHabits.length === 0) continue;

      // ── Determine how many missed days to back-fill ──
      const lastReset = profile.last_habit_reset || toDateStr(new Date(Date.now() - MS_PER_DAY));
      const missedDays = dateRange(lastReset, today);

      // For the FIRST missed day, use actual completed_today values.
      // For subsequent days (cron outage catch-up), everything was already
      // reset to false, so all NNs count as missed.
      let runningXp = profile.xp;
      let isFirstDay = true;

      for (const day of missedDays) {
        let penalty = 0;

        const nnSummary = nns.map((h) => {
          // On first day, use real data. On back-fill days, all are missed (false).
          const completed = isFirstDay ? h.completed_today : false;
          if (!completed) penalty += PENALTY_PER_NN;
          return { title: h.title, completed };
        });

        const habitSummary = dailyHabits.map((h) => ({
          title: h.title,
          completed: isFirstDay ? h.completed_today : false,
        }));

        // Archive log for this day
        await supabaseAdmin.from("daily_logs").insert({
          user_id: userId,
          date: day,
          nn_summary: nnSummary,
          habit_summary: habitSummary,
          total_xp_at_time: runningXp,
          penalty,
        });

        runningXp = Math.max(0, runningXp - penalty);

        // After the first day, streak updates for individual habits happen once
        if (isFirstDay) {
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
        } else {
          // Back-fill days: streaks already 0, just ensure completed_today stays false
          // (already reset on first day — no DB call needed)
        }

        isFirstDay = false;
      }

      // ── Global streak: if user didn't check in yesterday, reset to 0 ──
      const lastCheckInDay = profile.last_check_in
        ? profile.last_check_in.slice(0, 10)
        : null;
      let newGlobalStreak = profile.streak;

      if (lastCheckInDay === yesterdayStr) {
        newGlobalStreak = profile.streak + 1;
      } else if (lastCheckInDay !== today) {
        newGlobalStreak = lastCheckInDay ? 0 : profile.streak;
      }

      // ── Final profile update ──
      await supabaseAdmin
        .from("operator_profile")
        .update({
          xp: runningXp,
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
