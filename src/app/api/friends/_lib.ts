/**
 * Re-export shim.
 *
 * These helpers moved to `src/app/api/_lib/guard.ts` in Phase 3 when the
 * economy routes became a second consumer. This file stays so the five friends
 * routes keep their existing imports; prefer importing from `_lib/guard`
 * directly in new code.
 */
export {
  canonicalPair,
  formatError,
  requireUserFromBearer,
} from "@/app/api/_lib/guard";
