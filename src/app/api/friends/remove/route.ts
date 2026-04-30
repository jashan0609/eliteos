import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  canonicalPair,
  formatError,
  requireUserFromBearer,
} from "@/app/api/friends/_lib";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireUserFromBearer(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { friendUserId } = (await req.json()) as { friendUserId?: string };
    if (!friendUserId) {
      return NextResponse.json({ error: "friendUserId is required" }, { status: 400 });
    }

    const userId = auth.user!.id;
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

    await supabaseAdmin
      .from("friend_requests")
      .update({ status: "canceled", responded_at: new Date().toISOString() })
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${friendUserId},status.eq.pending),and(sender_id.eq.${friendUserId},receiver_id.eq.${userId},status.eq.pending)`
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = formatError(err);
    console.error(`[FRIEND_REMOVE_FAILURE] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
