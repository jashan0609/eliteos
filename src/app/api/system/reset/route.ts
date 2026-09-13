import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatError } from "@/app/api/_lib/guard";
import {
  runDailyResetForUser,
  type ResetProfile,
} from "@/lib/server/run-daily-reset";

export const dynamic = "force-dynamic";

/**
 * The daily reset sweep, driven by Vercel cron (`vercel.json`), at 06:00 UTC.
 *
 * Once a day because Vercel Hobby rejects any cron that runs more often, and it
 * rejects it at deploy time. An hourly schedule here failed every deployment
 * from August 11 to September 13, 2026 while CI stayed green, so production
 * served a June build for a month.
 *
 * Daily is enough. Operators who open the app are reset at login by
 * `/api/system/sync`; anyone skipped is caught up on the next run, because
 * `runDailyResetForUser` archives every day since `last_habit_reset` and no-ops
 * for anyone already current for their local day. 06:00 UTC is after local
 * midnight in every timezone the current operators use, year-round.
 *
 * The per-operator work lives in `src/lib/server/run-daily-reset.ts` and is
 * shared with `/api/system/sync`. It used to be inlined here and duplicated
 * again in the browser.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from("operator_profile")
      .select("*");

    if (profileErr) {
      throw new Error(`Failed to load operator profiles: ${formatError(profileErr)}`);
    }
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: "All operators current.", processed: 0 });
    }

    let processedCount = 0;
    const failures: { userId: string; error: string }[] = [];

    for (const profile of profiles) {
      // One operator's failure must not abort the run for everyone behind them
      // in the list. Because this runs every day, a persistent failure on a
      // single row would otherwise starve the rest of the table indefinitely.
      try {
        const outcome = await runDailyResetForUser({
          profile: profile as ResetProfile,
        });
        if (outcome.didReset) processedCount++;
      } catch (err) {
        const message = formatError(err);
        console.error(
          `[DAILY_RESET_USER_FAILURE] user=${profile.id} ${message}`
        );
        failures.push({ userId: profile.id, error: message });
      }
    }

    return NextResponse.json({
      message: "Daily reset complete.",
      processed: processedCount,
      failed: failures.length,
      failures,
      date: new Date().toISOString(),
    });
  } catch (err) {
    const message = formatError(err);
    console.error(`[DAILY_RESET_FAILURE] ${message}`);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
