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
    const { username } = (await req.json()) as { username?: string };
    const normalized = (username ?? "").trim().toLowerCase();
    if (!normalized) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const senderId = auth.user!.id;
    const [senderProfileRes, receiverProfileRes] = await Promise.all([
      supabaseAdmin.from("operator_profile").select("id, username").eq("id", senderId).single(),
      supabaseAdmin
        .from("operator_profile")
        .select("id, username")
        .ilike("username", normalized)
        .maybeSingle(),
    ]);

    if (senderProfileRes.error) throw new Error(formatError(senderProfileRes.error));
    if (!senderProfileRes.data?.username) {
      return NextResponse.json({ error: "Username is required on your account" }, { status: 400 });
    }
    if (receiverProfileRes.error) throw new Error(formatError(receiverProfileRes.error));
    if (!receiverProfileRes.data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const receiverId = receiverProfileRes.data.id;
    if (receiverId === senderId) {
      return NextResponse.json({ error: "You cannot add yourself" }, { status: 400 });
    }

    const pair = canonicalPair(senderId, receiverId);

    const existingFriendship = await supabaseAdmin
      .from("friendships")
      .select("user_low_id")
      .eq("user_low_id", pair.low)
      .eq("user_high_id", pair.high)
      .maybeSingle();
    if (existingFriendship.error) throw new Error(formatError(existingFriendship.error));
    if (existingFriendship.data) {
      return NextResponse.json({ error: "Already friends" }, { status: 409 });
    }

    const existingPending = await supabaseAdmin
      .from("friend_requests")
      .select("id")
      .or(
        `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId},status.eq.pending),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId},status.eq.pending)`
      )
      .limit(1);
    if (existingPending.error) throw new Error(formatError(existingPending.error));
    if ((existingPending.data ?? []).length > 0) {
      return NextResponse.json({ error: "A pending request already exists" }, { status: 409 });
    }

    const insertRes = await supabaseAdmin
      .from("friend_requests")
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        status: "pending",
      })
      .select("id")
      .single();
    if (insertRes.error) throw new Error(formatError(insertRes.error));

    return NextResponse.json({ ok: true, requestId: insertRes.data.id });
  } catch (err) {
    const message = formatError(err);
    console.error(`[FRIEND_REQUEST_CREATE_FAILURE] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
