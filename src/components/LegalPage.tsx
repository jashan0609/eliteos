import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared shell for the privacy policy and terms.
 *
 * These two pages are the only ones in the app that must render for someone
 * with no account, so they are server components with no client JavaScript and
 * no dependency on `EliteProvider`.
 */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-bg text-text px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/"
          className="text-xs uppercase tracking-wider text-violet hover:underline underline-offset-2"
        >
          &larr; EliteOS
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-xs uppercase tracking-wider text-dim">
          Last updated {updated}
        </p>

        <div className="legal mt-8 space-y-6 text-sm leading-relaxed text-muted">
          {children}
        </div>
      </div>
    </main>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-text">{heading}</h2>
      {children}
    </section>
  );
}
