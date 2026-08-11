import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  buildResetPlan,
  getUpdatedGlobalStreak,
  toDateStr,
} from "@/lib/daily-reset";

export const dynamic = "force-dynamic";

function formatError(err: unknown) {
  if (err instanceof Error) {
    return err.message;
  }

  if (err && typeof err === "object") {
    const parts = ["message", "details", "hint", "code"]
      .map((key) => {
        const value = Reflect.get(err, key);
        return value ? `${key}=${String(value)}` : null;
      })
      .filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" | ");
    }
  }

  return String(err);
}

function throwIfError(error: unknown, context: string) {
  if (error) {
    throw new Error(`${context}: ${formatError(error)}`);
  }
}

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

    throwIfError(profileErr, "Failed to load operator profiles");
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: "All operators current.", processed: 0 });
    }

    let processedCount = 0;
    const failures: { userId: string; error: string }[] = [];

    for (const profile of profiles) {
      const userId = profile.id;

      // One operator's failure must not abort the run for every operator after
      // them in the list. Previously a single bad row was a denial of service
      // for the rest of the table — and now that this runs hourly rather than
      // daily, a persistent failure would have starved everyone behind it.
      try {
        const userTz = profile.timezone ?? "UTC";
        const today = toDateStr(new Date(), userTz);
        const yesterdayStr = toDateStr(
          new Date(Date.now() - 86_400_000),
          userTz
        );

        // Skip if already reset today in user's timezone. This guard is what
        // makes the hourly schedule safe: at most one reset lands per local day.
        if (profile.last_habit_reset === today) continue;

        // ── Fetch habits in parallel ──
        const [nnRes, dhRes] = await Promise.all([
          supabaseAdmin.from("non_negotiables").select("*").eq("user_id", userId),
          supabaseAdmin.from("daily_habits").select("*").eq("user_id", userId),
        ]);
        throwIfError(nnRes.error, `Failed to load non-negotiables for ${userId}`);
        throwIfError(dhRes.error, `Failed to load daily habits for ${userId}`);

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
          // Archive log for this day. Upsert, not insert: the client-side reset
          // in EliteContext can archive the same day concurrently, and
          // (user_id, date) is unique — losing that race is expected.
          const { error: logErr } = await supabaseAdmin.from("daily_logs").upsert(
            {
              user_id: userId,
              date: day.date,
              nn_summary: day.nnSummary,
              habit_summary: day.habitSummary,
              total_xp_at_time: day.xpAtTime,
              penalty: day.penalty,
            },
            { onConflict: "user_id,date", ignoreDuplicates: true }
          );
          throwIfError(
            logErr,
            `Failed to archive daily log for ${userId} on ${day.date}`
          );

          // After the first day, streak updates for individual habits happen once
          if (index === 0) {
            for (const h of nns) {
              const newStreak = h.completed_today ? h.streak + 1 : 0;
              const { error } = await supabaseAdmin
                .from("non_negotiables")
                .update({ completed_today: false, streak: newStreak })
                .eq("id", h.id);
              throwIfError(
                error,
                `Failed to reset non-negotiable ${h.id} for ${userId}`
              );
            }
            for (const h of dailyHabits) {
              const newStreak = h.completed_today ? h.streak + 1 : 0;
              const { error } = await supabaseAdmin
                .from("daily_habits")
                .update({ completed_today: false, streak: newStreak })
                .eq("id", h.id);
              throwIfError(
                error,
                `Failed to reset daily habit ${h.id} for ${userId}`
              );
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
        const { error: profileUpdateErr } = await supabaseAdmin
          .from("operator_profile")
          .update({
            xp: resetPlan.finalXp,
            streak: newGlobalStreak,
            last_habit_reset: today,
          })
          .eq("id", userId);
        throwIfError(profileUpdateErr, `Failed to update profile for ${userId}`);

        processedCount++;
      } catch (err) {
        const message = formatError(err);
        console.error(`[DAILY_RESET_USER_FAILURE] user=${userId} ${message}`);
        failures.push({ userId, error: message });
      }
    }

    return NextResponse.json({
      message: "Daily reset complete",
      processed: processedCount,
      failed: failures.length,
      failures,
      date: toDateStr(new Date()),
    });
  } catch (err) {
    const msg = formatError(err);
    console.error(`[DAILY_RESET_FAILURE] ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
