import * as Sentry from "@sentry/nextjs";

/**
 * Server and edge error monitoring.
 *
 * Everything here is gated on a DSN being present. `Sentry.init` with an empty
 * DSN disables the SDK rather than erroring, but the explicit check keeps the
 * intent readable: **no DSN configured means no monitoring, not a broken app.**
 * Until `NEXT_PUBLIC_SENTRY_DSN` is set in Vercel, this is dead weight and the
 * app behaves exactly as it did before.
 *
 * A DSN is public by design — it identifies a project to send events to and
 * grants nothing — which is why one `NEXT_PUBLIC_` value serves client, server
 * and edge rather than maintaining two.
 *
 * Note this file does *not* wrap `next.config.ts` in `withSentryConfig`.
 * That wrapper exists to upload source maps and needs an org, a project and an
 * auth token. Adding it before those exist buys warnings, not stack traces.
 * Run `npx @sentry/wizard@latest -i nextjs` once the account is set up.
 */

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function register() {
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      // The app has 13 operators. Sampling would mostly discard the handful of
      // events that matter; revisit if volume ever justifies it.
      tracesSampleRate: 1,
      environment: process.env.VERCEL_ENV ?? "development",
      release: process.env.VERCEL_GIT_COMMIT_SHA,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      tracesSampleRate: 1,
      environment: process.env.VERCEL_ENV ?? "development",
      release: process.env.VERCEL_GIT_COMMIT_SHA,
    });
  }
}

/**
 * Catches errors Next itself surfaces — render failures and unhandled route
 * throws — which never reach the `serverError` helper because they never reach
 * a catch block.
 */
export const onRequestError = Sentry.captureRequestError;
