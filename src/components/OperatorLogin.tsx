"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function OperatorLogin() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernamePattern = /^[a-z0-9_]{3,24}$/;
  const usernameInvalid =
    mode === "register" && username.length > 0 && !usernamePattern.test(username);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === "login") {
      const err = await signIn(email, password);
      if (err) setError(err);
    } else {
      if (!usernamePattern.test(username)) {
        setError("Username must be 3-24 chars: lowercase letters, numbers, underscore.");
        setLoading(false);
        return;
      }
      const { data: existingRows, error: existsError } = await supabase
        .from("operator_profile")
        .select("id")
        .ilike("username", username)
        .limit(1);
      if (existsError) {
        setError(existsError.message);
        setLoading(false);
        return;
      }
      if ((existingRows ?? []).length > 0) {
        setError("That username is already taken.");
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
            Sign In
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
                if (e.key === "Enter") {
                  e.preventDefault();
                  passwordRef.current?.focus();
                }
              }}
              enterKeyHint="next"
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
                3-24 chars: lowercase letters, numbers, underscore
              </p>
            </div>
          )}

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
              placeholder="••••••••"
              required
              minLength={6}
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
          </div>

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
              ? "SIGNING IN..."
              : mode === "login"
                ? "SIGN IN"
                : "CREATE ACCOUNT"}
          </button>
        </form>

        {/* Toggle login/register */}
        <p
          style={{
            textAlign: "center",
            marginTop: "1.5rem",
            fontSize: "0.75rem",
            color: "#888",
          }}
        >
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
              setSuccess(null);
              setUsername("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#8B5CF6",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.75rem",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            {mode === "login" ? "Register" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
