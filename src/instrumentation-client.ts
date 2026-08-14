import * as Sentry from "@sentry/nextjs";

/**
 * Browser error monitoring. Inert until a DSN exists — see `instrumentation.ts`.
 *
 * `sendDefaultPii` is left off. This app's errors are about habits and XP;
 * nothing here needs the operator's IP or headers attached to be actionable,
 * and public signups mean the default should be to collect less.
 */

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1,
    sendDefaultPii: false,
    environment: process.env.VERCEL_ENV ?? "development",
    release: process.env.NEXT_PUBLIC_BUILD_ID,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
