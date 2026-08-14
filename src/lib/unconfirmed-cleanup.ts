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
 * The never-signed-in clause is the important one. Email confirmation was off
 * until Phase 6, so every operator who registered before it has a permanently
 * null `email_confirmed_at`. The obvious rule — "unconfirmed and older than
 * seven days" — would therefore have deleted the entire existing user base the
 * first time this cron ran, cascading through all seven tables.
 *
 * A successful sign-in proves the address reached a real person whatever the
 * confirmation column says, so it is a better signal than a hardcoded cutoff
 * date, which would silently rot.
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
