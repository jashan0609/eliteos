import { NextResponse } from "next/server";
import { z } from "zod";
import {
  parseJsonBody,
  requireUserFromBearer,
  serverError,
} from "@/app/api/_lib/guard";
import { enforceRateLimit } from "@/app/api/_lib/rate-limit";
import { supabaseEconomyDb } from "@/app/api/economy/_db";
import { handleObjectiveProgress } from "./handler";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ id: z.string().uuid() });

export async function POST(req: Request) {
  const auth = await requireUserFromBearer(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Budget keys on the operator, not the address — see rate-limit.ts.
  const limited = await enforceRateLimit("objectiveProgress", auth.user.id);
  if (limited) return limited;

  const body = await parseJsonBody(req, bodySchema);
  if (!body.ok) return body.response;

  try {
    const outcome = await handleObjectiveProgress({
      db: supabaseEconomyDb,
      userId: auth.user.id,
      request: body.data,
    });
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (err) {
    return serverError("ECONOMY_OBJECTIVE_PROGRESS_FAILURE", err);
  }
}
