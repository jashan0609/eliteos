import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  parseJsonBody,
  requireUserFromBearer,
  serverError,
} from "@/app/api/_lib/guard";
import { DELETE_CONFIRMATION } from "@/lib/auth-rules";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  confirmation: z.literal(DELETE_CONFIRMATION),
});

/**
 * GDPR erasure. Irreversible.
 *
 * Deletes the **auth user**, not the profile row, and that ordering is the
 * whole design. Every one of the seven tables FKs `auth.users(id) ON DELETE
 * CASCADE`, so removing the auth account takes the rest with it in one
 * transaction the database owns.
 *
 * Doing it the other way round is the bug Phase 5 removed the DELETE grant to
 * prevent: deleting `operator_profile` does *not* cascade upward, so it strands
 * an auth account that can log in forever and never load a profile — the
 * bricked state that produced an unescapable spinner.
 *
 * The id comes from the bearer token and nowhere else. There is deliberately no
 * parameter for *whose* account to delete.
 */
export async function POST(req: Request) {
  const auth = await requireUserFromBearer(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await parseJsonBody(req, bodySchema);
  if (!body.ok) return body.response;

  const userId = auth.user.id;

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    // Logged at info level on purpose: this is the one action with no undo, so
    // there should be a record that it happened and when.
    console.warn(`[ACCOUNT_DELETED] user=${userId}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("ACCOUNT_DELETE_FAILURE", err);
  }
}
