import { NextResponse } from "next/server";
import { z } from "zod";
import {
  parseJsonBody,
  requireUserFromBearer,
  serverError,
} from "@/app/api/_lib/guard";
import { supabaseEconomyDb } from "@/app/api/economy/_db";
import { handleHabitToggle } from "./handler";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(["daily", "non-negotiable"]),
  id: z.string().uuid(),
  completing: z.boolean(),
});

export async function POST(req: Request) {
  const auth = await requireUserFromBearer(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await parseJsonBody(req, bodySchema);
  if (!body.ok) return body.response;

  try {
    const outcome = await handleHabitToggle({
      db: supabaseEconomyDb,
      userId: auth.user!.id,
      request: body.data,
    });
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (err) {
    return serverError("ECONOMY_HABIT_TOGGLE_FAILURE", err);
  }
}
