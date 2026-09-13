/**
 * The rule deciding whether an abandoned signup may be deleted.
 *
 * Pure and separate from the route because getting it wrong deletes real
 * accounts, irreversibly, on a schedule, with nobody watching.
 */

/** How long an unconfirmed signup may hold a username before it is released. */
export const UNCONFIRMED_TTL_DAYS = 7;

/** Only the fields the decision depends on. */
export interface CleanupCandidate {
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  created_at?: string | null;
}

/**
 * True only for accounts that are unconfirmed, have **never signed in**, and
 * are older than the TTL.
 *
 * The never-signed-in clause is defence in depth. It was written believing that
 * every operator registered before Phase 6 had a null `email_confirmed_at`.
 * That was wrong: with confirmation off, Supabase auto-confirms at signup, and
 * all 13 accounts were confirmed when checked on September 13, 2026.
 *
 * It stays because it costs nothing and covers any account confirmed, imported
 * or migrated out of band. A successful sign-in proves the address reached a
 * real person whatever the confirmation column says.
 */
export function shouldDeleteUnconfirmed(
  user: CleanupCandidate,
  nowMs: number,
  ttlDays: number = UNCONFIRMED_TTL_DAYS
): boolean {
  if (user.email_confirmed_at) return false;
  if (user.last_sign_in_at) return false;
  if (!user.created_at) return false;

  const createdMs = new Date(user.created_at).getTime();
  // An unparseable timestamp must not read as "infinitely old".
  if (!Number.isFinite(createdMs)) return false;

  return createdMs <= nowMs - ttlDays * 86_400_000;
}
