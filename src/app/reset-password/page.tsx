"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";

type Phase = "verifying" | "ready" | "invalid" | "done";

const panel: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  backgroundColor: "#000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  touchAction: "manipulation",
};

const field: React.CSSProperties = {
  width: "100%",
  padding: "0.875rem 1rem",
  backgroundColor: "#111",
  border: "1px solid #222",
  borderRadius: "0.75rem",
  color: "#F0F0F0",
  fontSize: "16px",
  outline: "none",
  boxSizing: "border-box",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: "0.65rem",
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: "0.5rem",
  fontWeight: 600,
};

export default function ResetPassword() {
  const { updatePassword, signOut } = useAuth();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The link may only be redeemed once. In development React mounts effects
  // twice, and a second redemption of a consumed token reports a perfectly
  // good link as invalid — so the attempt is guarded rather than left to run
  // twice.
  //
  // Deliberately no `cancelled` flag alongside it. The pair is a trap: the
  // second mount returns early on this ref while the first mount's cleanup has
  // already set `cancelled`, so nothing is left to move the page off
  // "Verifying" and the operator waits forever. An unmounted component
  // discarding a setState is harmless; a permanent spinner is not.
  const redeemed = useRef(false);

  useEffect(() => {
    if (redeemed.current) return;
    redeemed.current = true;

    async function establishSession() {
      // Read the URL directly instead of `useSearchParams`, which would opt
      // this page into a Suspense boundary for a value only ever needed once,
      // on the client, at mount.
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));

      // An expired or already-used link comes back as an error redirect rather
      // than a failed exchange. Report what Supabase said instead of the
      // misleading "no session" branch below.
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

      // Two delivery mechanisms, and which one arrives depends on the email
      // template configured in the dashboard:
      //
      //   token_hash  — stateless. Redeemed here by verifyOtp, so it works
      //                 when the operator requests the reset on their phone
      //                 and opens the mail on a laptop.
      //   code        — PKCE. @supabase/ssr pins flowType "pkce", and the
      //                 client only exchanges the code if it also finds the
      //                 verifier it stored when the reset was requested. A
      //                 different browser has no verifier, so the link dies
      //                 silently. This is why token_hash is preferred.
      const tokenHash = params.get("token_hash") ?? hash.get("token_hash");
      if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        if (verifyError) {
          clearUrl();
          setError(verifyError.message);
          setPhase("invalid");
          return;
        }
        clearUrl();
        setPhase("ready");
        return;
      }

      // Otherwise the session — if there is one — was already established by
      // the client's own `?code=` exchange. `getSession` awaits that
      // initialization internally, so this reads the settled result rather
      // than racing the PASSWORD_RECOVERY event, which fires on a timeout and
      // may land before this component ever subscribes.
      const { data } = await supabase.auth.getSession();
      clearUrl();
      setPhase(data.session ? "ready" : "invalid");
    }

    establishSession().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Could not verify that link.");
      setPhase("invalid");
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      // A typo here would lock the operator out a second time, through the
      // same flow they just used to get back in.
      if (password !== confirm) {
        setError("Those passwords do not match.");
        return;
      }

      setSubmitting(true);
      const err = await updatePassword(password);
      if (err) {
        setError(err);
        setSubmitting(false);
        return;
      }

      // The recovery link is a login bypass, so the session it created is
      // deliberately not carried into the app. Signing out forces the new
      // password to be used at least once, which also confirms it works while
      // the operator is still here to fix it.
      await signOut();
      setSubmitting(false);
      setPhase("done");
    },
    [password, confirm, updatePassword, signOut]
  );

  return (
    <main style={panel}>
      <div style={{ width: "100%", maxWidth: "24rem", padding: "0 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
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
            }}
          >
            Set a new password
          </p>
        </div>

        {phase === "verifying" && (
          <p style={{ color: "#888", fontSize: "0.75rem", textAlign: "center" }}>
            Verifying your link...
          </p>
        )}

        {phase === "invalid" && (
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                color: "#F43F5E",
                fontSize: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              {error ?? "That reset link is invalid or has expired."}
            </p>
            <p
              style={{
                color: "#888",
                fontSize: "0.75rem",
                marginBottom: "1.5rem",
                lineHeight: 1.6,
              }}
            >
              Reset links can only be used once, and expire. Open the link in
              the same browser you requested it from, or request a new one.
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
              Back to sign in
            </Link>
          </div>
        )}

        {phase === "done" && (
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                color: "#06B6D4",
                fontSize: "0.75rem",
                marginBottom: "1.5rem",
              }}
            >
              Password updated. Sign in with your new password.
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
          </div>
        )}

        {phase === "ready" && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={label}>New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                style={field}
              />
              <p
                style={{
                  marginTop: "0.4rem",
                  fontSize: "0.65rem",
                  color: "#888",
                }}
              >
                At least {MIN_PASSWORD_LENGTH} characters
              </p>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={label}>Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••••"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                style={field}
              />
            </div>

            {error && (
              <p
                style={{
                  color: "#F43F5E",
                  fontSize: "0.75rem",
                  marginBottom: "1rem",
                  textAlign: "center",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "0.875rem",
                backgroundColor: submitting ? "#6D28D9" : "#8B5CF6",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                borderRadius: "0.75rem",
                border: "none",
                cursor: submitting ? "wait" : "pointer",
                touchAction: "manipulation",
                opacity: submitting ? 0.7 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {submitting ? "UPDATING..." : "UPDATE PASSWORD"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

/** Keeps the single-use token out of the address bar, history and screenshots. */
function clearUrl() {
  window.history.replaceState({}, "", window.location.pathname);
}
