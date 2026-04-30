import { supabaseAdmin } from "@/lib/supabase-admin";

export function formatError(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const parts = ["message", "details", "hint", "code"]
      .map((key) => {
        const value = Reflect.get(err, key);
        return value ? `${key}=${String(value)}` : null;
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
  }
  return String(err);
}

export async function requireUserFromBearer(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) return { error: "Unauthorized", status: 401 as const };

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) return { error: "Unauthorized", status: 401 as const };

  return { user, error: null, status: 200 as const };
}

export function canonicalPair(a: string, b: string) {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}
