/**
 * Account rules shared by every place that enforces them.
 *
 * These constants exist here and nowhere else, for the same reason the XP
 * constants live only in `economy.ts`: a rule copied into three files is a rule
 * that will eventually disagree with itself. Before this module the username
 * pattern was written out in the login form and again in the check-username
 * route, and the password length in the form did not match `config.toml`.
 *
 * The database remains the authority for both. `USERNAME_PATTERN` mirrors the
 * `operator_profile_username_format` CHECK constraint added in the Phase 5
 * lockdown migration, and `MIN_PASSWORD_LENGTH` mirrors
 * `auth.minimum_password_length`. Changing either here without changing it
 * there produces a form that accepts input the backend rejects.
 */

/** Mirrors `operator_profile_username_format`. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export const USERNAME_RULE_TEXT =
  "3-24 chars: lowercase letters, numbers, underscore";

/**
 * Mirrors `auth.minimum_password_length` in `supabase/config.toml` and the
 * matching dashboard setting for the hosted project.
 *
 * Raised from 6 to 10 for public signups. Length alone, with no character-class
 * requirement, because forced classes push people towards `Password1!` — which
 * is shorter, more predictable, and more likely to be reused.
 *
 * This binds new passwords only. Existing operators are not locked out: the
 * minimum is checked when a password is set, never when one is verified.
 */
export const MIN_PASSWORD_LENGTH = 10;
