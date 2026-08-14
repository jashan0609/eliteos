import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatError } from "@/app/api/_lib/guard";
import { callerAddress, enforceRateLimit } from "@/app/api/_lib/rate-limit";
import { USERNAME_PATTERN, USERNAME_RULE_TEXT } from "@/lib/auth-rules";

export const dynamic = "force-dynamic";

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
 * Being unauthenticated, it is a username enumeration oracle. The per-address
 * budget below is what bounds it, and it fails closed — an unreachable limiter
 * must not hand out an unlimited enumeration window.
 */
export async function POST(req: Request) {
  const limited = await enforceRateLimit("checkUsername", callerAddress(req));
  if (limited) return limited;

  try {
    const { username } = (await req.json()) as { username?: string };
    const normalized = (username ?? "").trim().toLowerCase();

    if (!USERNAME_PATTERN.test(normalized)) {
      return NextResponse.json({
        available: false,
        error: `Username must be ${USERNAME_RULE_TEXT}.`,
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
