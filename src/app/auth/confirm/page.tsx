"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Phase = "verifying" | "invalid";

/**
 * Landing page for the signup confirmation email.
 *
 * The dashboard template should link here as
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 * which is the pattern Supabase recommends for server-side / PKCE apps.
 *
 * Why not the default `{{ .ConfirmationURL }}`: `@supabase/ssr` pins
 * flowType "pkce", so that link returns a `?code=` that auth-js only exchanges
 * when it finds the verifier stored in the browser that *signed up*. People
 * sign up on a laptop and open the mail on a phone. `token_hash` + `verifyOtp`
 * is stateless, so it confirms and signs in wherever the link is opened — the
 * same reasoning as `/reset-password`.
 *
 * On success this hands straight to `/`, which loads the app for the new
 * session. `EliteProvider` stays dormant here so it does not start a sync
 * against a session that is still being established.
 */
export default function ConfirmEmail() {
  const [phase, setPhase] = useState<Phase>("verifying");
  const [error, setError] = useState<string | null>(null);

  // Tokens are single-use. React mounts effects twice in development, and a
  // second redemption would report a good link as invalid. No `cancelled` flag
  // alongside the ref — see the note in reset-password/page.tsx for why that
  // pairing strands the page on its spinner.
  const redeemed = useRef(false);

  useEffect(() => {
    if (redeemed.current) return;
    redeemed.current = true;

    async function confirm() {
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));

      const urlError =
        params.get("error_description") ??
        params.get("error") ??
        hash.get("error_description") ??
        hash.get("error");
      if (urlError) {
        setError(urlError);
        setPhase("invalid");
        return;
      }

      const tokenHash = params.get("token_hash");
      if (!tokenHash) {
        setPhase("invalid");
        return;
      }

      // Only confirmation types belong on this page. Recovery links go to
      // /reset-password, which signs the operator out after use.
      const type = params.get("type") === "signup" ? "signup" : "email";

      const { error: verifyError } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });

      window.history.replaceState({}, "", window.location.pathname);

      if (verifyError) {
        setError(verifyError.message);
        setPhase("invalid");
        return;
      }

      // A full navigation rather than router.push: the app shell should boot
      // fresh against the session verifyOtp just stored.
      window.location.replace("/");
    }

    confirm().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Could not verify that link.");
      setPhase("invalid");
    });
  }, []);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "24rem",
          padding: "0 1.5rem",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            marginBottom: "0.5rem",
          }}
        >
          <span style={{ color: "#8B5CF6" }}>Elite</span>
          <span style={{ color: "#F0F0F0" }}>OS</span>
        </h1>
        <p
          style={{
            color: "#888",
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: "2rem",
          }}
        >
          Confirm your email
        </p>

        {phase === "verifying" && (
          <p style={{ color: "#888", fontSize: "0.75rem" }}>
            Confirming your email...
          </p>
        )}

        {phase === "invalid" && (
          <>
            <p
              style={{
                color: "#F43F5E",
                fontSize: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              {error ?? "That confirmation link is invalid or has expired."}
            </p>
            <p
              style={{
                color: "#888",
                fontSize: "0.75rem",
                marginBottom: "1.5rem",
                lineHeight: 1.6,
              }}
            >
              Confirmation links can only be used once, and expire. If your
              account is already confirmed, just sign in. Otherwise use
              &ldquo;Resend confirmation email&rdquo; on the sign-in screen.
            </p>
            <Link
              href="/"
              style={{
                color: "#8B5CF6",
                fontWeight: 600,
                fontSize: "0.75rem",
                textDecoration: "underline",
                textUnderlineOffset: "2px",
              }}
            >
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
