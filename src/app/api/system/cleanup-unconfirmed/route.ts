import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatError } from "@/app/api/_lib/guard";
import {
  shouldDeleteUnconfirmed,
  UNCONFIRMED_TTL_DAYS,
} from "@/lib/unconfirmed-cleanup";

export const dynamic = "force-dynamic";

/**
 * Deletes abandoned signups so username squatting is not free.
 *
 * The rule itself lives in `src/lib/unconfirmed-cleanup.ts`, pure and tested,
 * because a mistake in it deletes real accounts on a schedule with nobody
 * watching. Read the note there before changing it — the naive version of this
 * rule would have deleted every operator who registered before Phase 6.
 *
 * Requires `Bearer $CRON_SECRET`, same as the reset sweep.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 500 }
    );
  }

  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const deleted: string[] = [];
  const failures: { userId: string; error: string }[] = [];

  try {
    // The admin API paginates. 1000 is its maximum page size; the loop matters
    // once the user base outgrows a single page, which is the point at which
    // nobody would notice it silently only cleaning the first page.
    let page = 1;
    const perPage = 1000;

    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) throw new Error(error.message);

      const users = data?.users ?? [];
      if (users.length === 0) break;

      for (const user of users) {
        if (!shouldDeleteUnconfirmed(user, now)) continue;

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
          user.id
        );
        if (deleteError) {
          failures.push({ userId: user.id, error: deleteError.message });
        } else {
          deleted.push(user.id);
        }
      }

      if (users.length < perPage) break;
      page += 1;
    }

    if (deleted.length > 0) {
      console.warn(
        `[UNCONFIRMED_CLEANUP] removed ${deleted.length} abandoned signup(s)`
      );
    }

    return NextResponse.json({
      message: "Unconfirmed signup cleanup complete.",
      ttlDays: UNCONFIRMED_TTL_DAYS,
      deleted: deleted.length,
      failed: failures.length,
      failures,
    });
  } catch (err) {
    console.error(`[UNCONFIRMED_CLEANUP_FAILURE] ${formatError(err)}`);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
