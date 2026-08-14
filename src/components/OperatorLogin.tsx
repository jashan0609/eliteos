"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import {
  MIN_PASSWORD_LENGTH,
  USERNAME_PATTERN,
  USERNAME_RULE_TEXT,
} from "@/lib/auth-rules";

type Mode = "login" | "register" | "reset";

/**
 * Shown whether or not the address has an account.
 *
 * A message that distinguishes the two turns this form into an oracle for
 * which addresses are registered, which is worth more to an attacker than it
 * is to the operator who mistyped their own email.
 */
const RESET_SENT_MESSAGE =
  "If that email has an account, a reset link is on its way. Check your inbox.";

export default function OperatorLogin() {
  const { signIn, signUp, requestPasswordReset, resendConfirmation } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameInvalid =
    mode === "register" && username.length > 0 && !USERNAME_PATTERN.test(username);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setSuccess(null);
    setUsername("");
    setPassword("");
  };

  const handleResend = async () => {
    setError(null);
    setSuccess(null);
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    setLoading(true);
    await resendConfirmation(email);
    // Same reasoning as the reset message: the outcome must not reveal whether
    // the address exists or is already confirmed.
    setSuccess(
      "If that email needs confirming, another link is on its way."
    );
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === "reset") {
      const err = await requestPasswordReset(email);
      // Errors are deliberately swallowed into the same message. The only
      // failures Supabase reports here are rate limiting and malformed input,
      // and reporting either separately would still separate "sent" from
      // "not sent", which is the distinction being hidden.
      if (err) console.error("[PASSWORD_RESET_REQUEST_FAILURE]", err);
      setSuccess(RESET_SENT_MESSAGE);
      setLoading(false);
      return;
    }

    if (mode === "login") {
      const err = await signIn(email, password);
      if (err) setError(err);
    } else {
      if (!USERNAME_PATTERN.test(username)) {
        setError(`Username must be ${USERNAME_RULE_TEXT}.`);
        setLoading(false);
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        setLoading(false);
        return;
      }
      // Checked server-side — the browser has no read access to other
      // operators' profiles. Advisory only: if a collision slips through this
      // gap, the database resolves it by suffixing rather than failing.
      try {
        const res = await fetch("/api/auth/check-username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Could not check that username.");
        }
        if (!data.available) {
          setError(data.error ?? "That username is already taken.");
          setLoading(false);
          return;
        }
      } catch (checkError) {
        setError(
          checkError instanceof Error
            ? checkError.message
            : "Could not check that username."
        );
        setLoading(false);
        return;
      }
      const err = await signUp(email, password, username);
      if (err) {
        setError(err);
      } else {
        setSuccess("Account created. Check your email to confirm, then log in.");
        setMode("login");
      }
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "manipulation",
      }}
    >
      <div style={{ width: "100%", maxWidth: "24rem", padding: "0 1.5rem" }}>
        {/* Logo */}
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
            {mode === "login"
              ? "Sign In"
              : mode === "register"
                ? "Create Account"
                : "Reset Password"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.65rem",
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "0.5rem",
                fontWeight: 600,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && mode !== "reset") {
                  e.preventDefault();
                  passwordRef.current?.focus();
                }
              }}
              enterKeyHint={mode === "reset" ? "go" : "next"}
              placeholder="you@example.com"
              required
              autoComplete="email"
              style={{
                width: "100%",
                padding: "0.875rem 1rem",
                backgroundColor: "#111",
                border: "1px solid #222",
                borderRadius: "0.75rem",
                color: "#F0F0F0",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {mode === "register" && (
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.65rem",
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "0.5rem",
                  fontWeight: 600,
                }}
              >
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="your_handle"
                required
                minLength={3}
                maxLength={24}
                autoComplete="username"
                style={{
                  width: "100%",
                  padding: "0.875rem 1rem",
                  backgroundColor: "#111",
                  border: usernameInvalid ? "1px solid #F43F5E" : "1px solid #222",
                  borderRadius: "0.75rem",
                  color: "#F0F0F0",
                  fontSize: "16px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <p
                style={{
                  marginTop: "0.4rem",
                  fontSize: "0.65rem",
                  color: usernameInvalid ? "#F43F5E" : "#888",
                }}
              >
                {USERNAME_RULE_TEXT}
              </p>
            </div>
          )}

          {mode !== "reset" && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.65rem",
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "0.5rem",
                fontWeight: 600,
              }}
            >
              Password
            </label>
            <input
              ref={passwordRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              enterKeyHint="go"
              placeholder="••••••••••"
              required
              // Only binds when a password is being *set*. Existing operators
              // signed up under the old 6-character minimum and must still be
              // able to type their current password to log in.
              minLength={mode === "register" ? MIN_PASSWORD_LENGTH : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={{
                width: "100%",
                padding: "0.875rem 1rem",
                backgroundColor: "#111",
                border: "1px solid #222",
                borderRadius: "0.75rem",
                color: "#F0F0F0",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {mode === "register" && (
              <p
                style={{
                  marginTop: "0.4rem",
                  fontSize: "0.65rem",
                  color: "#888",
                }}
              >
                At least {MIN_PASSWORD_LENGTH} characters
              </p>
            )}
          </div>
          )}

          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  color: "#F43F5E",
                  fontSize: "0.75rem",
                  marginBottom: "1rem",
                  textAlign: "center",
                }}
              >
                {error}
              </motion.p>
            )}
            {success && (
              <motion.p
                key="success"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  color: "#06B6D4",
                  fontSize: "0.75rem",
                  marginBottom: "1rem",
                  textAlign: "center",
                }}
              >
                {success}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading || usernameInvalid}
            style={{
              width: "100%",
              padding: "0.875rem",
              backgroundColor: loading ? "#6D28D9" : "#8B5CF6",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              letterSpacing: "0.05em",
              borderRadius: "0.75rem",
              border: "none",
              cursor: loading ? "wait" : "pointer",
              touchAction: "manipulation",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {loading
              ? mode === "login"
                ? "SIGNING IN..."
                : mode === "register"
                  ? "CREATING..."
                  : "SENDING..."
              : mode === "login"
                ? "SIGN IN"
                : mode === "register"
                  ? "CREATE ACCOUNT"
                  : "SEND RESET LINK"}
          </button>
        </form>

        {mode === "login" && (
          <p
            style={{
              textAlign: "center",
              marginTop: "1rem",
              fontSize: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={() => switchMode("reset")}
              style={linkButton}
            >
              Forgot your password?
            </button>
          </p>
        )}

        <p
          style={{
            textAlign: "center",
            marginTop: "1.5rem",
            fontSize: "0.75rem",
            color: "#888",
          }}
        >
          {mode === "register" ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                style={linkButton}
              >
                Log in
              </button>
            </>
          ) : mode === "reset" ? (
            <button
              type="button"
              onClick={() => switchMode("login")}
              style={linkButton}
            >
              Back to sign in
            </button>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                style={linkButton}
              >
                Register
              </button>
            </>
          )}
        </p>

        {/*
          Email confirmation is being turned on, and the link expires. Without
          a way to ask for another one, an operator whose link lapsed has an
          account they can neither use nor re-register with — the address is
          taken. This is the single most common support request once
          confirmations are enabled.
        */}
        {mode === "login" && (
          <p
            style={{
              textAlign: "center",
              marginTop: "0.75rem",
              fontSize: "0.7rem",
              color: "#666",
            }}
          >
            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              style={{ ...linkButton, color: "#666", fontSize: "0.7rem" }}
            >
              Resend confirmation email
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

const linkButton: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#8B5CF6",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.75rem",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};
