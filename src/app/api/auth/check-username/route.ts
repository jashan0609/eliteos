import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatError } from "@/app/api/friends/_lib";

export const dynamic = "force-dynamic";

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

/**
 * Advisory username availability check for the signup form.
 *
 * This is the only unauthenticated route in the app. It exists because the
 * browser cannot read `operator_profile` at all — `anon` has no grant, and an
 * authenticated operator's RLS policy only exposes their own row. The previous
 * client-side check ran as `anon`, matched zero rows every time, and therefore
 * reported every username as available.
 *
 * Advisory is the operative word: the answer is stale the moment it is sent.
 * The database is the real authority — `handle_new_user` resolves a collision
 * by suffixing the username inside the same transaction that creates the
 * account, so a race here degrades to `name_2`, never to a failed signup.
 *
 * Being unauthenticated, it is a username enumeration oracle. Phase 7 attaches
 * the per-IP rate limiter that bounds it.
 */
export async function POST(req: Request) {
  try {
    const { username } = (await req.json()) as { username?: string };
    const normalized = (username ?? "").trim().toLowerCase();

    if (!USERNAME_PATTERN.test(normalized)) {
      return NextResponse.json({
        available: false,
        error:
          "Username must be 3-24 chars: lowercase letters, numbers, underscore.",
      });
    }

    // `.eq`, not `.ilike`: underscore is both a legal username character and a
    // LIKE wildcard, so `.ilike` would report `a_c` as taken when `abc` exists.
    // Usernames are stored lowercase by every write path.
    const { data, error } = await supabaseAdmin
      .from("operator_profile")
      .select("id")
      .eq("username", normalized)
      .maybeSingle();

    if (error) throw new Error(formatError(error));

    return NextResponse.json({ available: !data });
  } catch (err) {
    console.error(`[CHECK_USERNAME_FAILURE] ${formatError(err)}`);
    return NextResponse.json(
      { error: "Could not check that username right now." },
      { status: 500 }
    );
  }
}
