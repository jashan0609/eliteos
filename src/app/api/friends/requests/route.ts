import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatError, requireUserFromBearer } from "@/app/api/friends/_lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUserFromBearer(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const userId = auth.user!.id;

    const [inboundRes, outboundRes] = await Promise.all([
      supabaseAdmin
        .from("friend_requests")
        .select("id, sender_id, receiver_id, status, created_at")
        .eq("receiver_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("friend_requests")
        .select("id, sender_id, receiver_id, status, created_at")
        .eq("sender_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    if (inboundRes.error) throw new Error(formatError(inboundRes.error));
    if (outboundRes.error) throw new Error(formatError(outboundRes.error));

    const profileIds = Array.from(
      new Set([
        ...(inboundRes.data ?? []).map((r) => r.sender_id),
        ...(outboundRes.data ?? []).map((r) => r.receiver_id),
      ])
    );

    let usernamesById = new Map<string, string>();
    if (profileIds.length > 0) {
      const profilesRes = await supabaseAdmin
        .from("operator_profile")
        .select("id, username")
        .in("id", profileIds);
      if (profilesRes.error) throw new Error(formatError(profilesRes.error));
      usernamesById = new Map(
        (profilesRes.data ?? []).map((p) => [p.id, p.username ?? "unknown"])
      );
    }

    return NextResponse.json({
      inbound: (inboundRes.data ?? []).map((r) => ({
        id: r.id,
        userId: r.sender_id,
        username: usernamesById.get(r.sender_id) ?? "unknown",
        createdAt: r.created_at,
      })),
      outbound: (outboundRes.data ?? []).map((r) => ({
        id: r.id,
        userId: r.receiver_id,
        username: usernamesById.get(r.receiver_id) ?? "unknown",
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    const message = formatError(err);
    console.error(`[FRIEND_REQUESTS_FAILURE] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
