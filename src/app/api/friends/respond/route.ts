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
    const { requestId, action } = (await req.json()) as {
      requestId?: string;
      action?: "accept" | "decline";
    };

    if (!requestId || (action !== "accept" && action !== "decline")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const userId = auth.user!.id;
    const requestRes = await supabaseAdmin
      .from("friend_requests")
      .select("id, sender_id, receiver_id, status")
      .eq("id", requestId)
      .single();
    if (requestRes.error) throw new Error(formatError(requestRes.error));

    const requestRow = requestRes.data;
    if (requestRow.receiver_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (requestRow.status !== "pending") {
      return NextResponse.json({ ok: true, alreadyHandled: true });
    }

    const nextStatus = action === "accept" ? "accepted" : "declined";
    const updateRes = await supabaseAdmin
      .from("friend_requests")
      .update({ status: nextStatus, responded_at: new Date().toISOString() })
      .eq("id", requestId);
    if (updateRes.error) throw new Error(formatError(updateRes.error));

    if (action === "accept") {
      const pair = canonicalPair(requestRow.sender_id, requestRow.receiver_id);
      const friendshipRes = await supabaseAdmin
        .from("friendships")
        .insert({
          user_low_id: pair.low,
          user_high_id: pair.high,
        });
      if (friendshipRes.error && friendshipRes.error.code !== "23505") {
        throw new Error(formatError(friendshipRes.error));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = formatError(err);
    console.error(`[FRIEND_REQUEST_RESPOND_FAILURE] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
