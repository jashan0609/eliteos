import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  canonicalPair,
  formatError,
  requireUserFromBearer,
  serverError,
} from "@/app/api/_lib/guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireUserFromBearer(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { friendUserId } = (await req.json()) as { friendUserId?: string };
    if (!friendUserId) {
      return NextResponse.json({ error: "friendUserId is required" }, { status: 400 });
    }

    const userId = auth.user.id;
    if (friendUserId === userId) {
      return NextResponse.json({ error: "Invalid friend id" }, { status: 400 });
    }

    const pair = canonicalPair(userId, friendUserId);
    const deleteRes = await supabaseAdmin
      .from("friendships")
      .delete()
      .eq("user_low_id", pair.low)
      .eq("user_high_id", pair.high);

    if (deleteRes.error) throw new Error(formatError(deleteRes.error));

    // Cancels `accepted` as well as `pending`, which it did not used to.
    //
    // The leaderboard cross-checks every friendship against an accepted
    // friend_requests row and logs [FRIENDSHIP_WITHOUT_ACCEPTED_REQUEST] when
    // one is missing — a tripwire for someone having write access to
    // `friendships` that they should not. Leaving the accepted row behind on
    // unfriend blunted it: a forged friendship with anyone you had previously
    // unfriended would still find its accepted row and pass the check.
    //
    // Re-adding is unaffected. Both guards in `request/route.ts` look for a
    // *pending* row, not an accepted one.
    const cancelRes = await supabaseAdmin
      .from("friend_requests")
      .update({ status: "canceled", responded_at: new Date().toISOString() })
      .in("status", ["pending", "accepted"])
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${friendUserId}),and(sender_id.eq.${friendUserId},receiver_id.eq.${userId})`
      );

    // Not fatal — the friendship is already gone — but a silent failure here
    // leaves rows that make the tripwire above cry wolf.
    if (cancelRes.error) {
      console.error(
        `[FRIEND_REQUEST_CANCEL_FAILURE] ${formatError(cancelRes.error)}`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("FRIEND_REMOVE_FAILURE", err);
  }
}
