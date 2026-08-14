"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    email: string,
    password: string,
    username: string
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  resendConfirmation: (email: string) => Promise<string | null>;
}

/**
 * Where Supabase should send the operator back to after they click a link in
 * an email.
 *
 * Read from the live origin rather than an env var so production, Vercel
 * previews and localhost each get themselves without a per-environment
 * variable. Every origin used here must also be listed in the dashboard under
 * Authentication → URL Configuration, or Supabase silently falls back to
 * `site_url` and the operator lands on the wrong deployment.
 */
function redirectTo(path: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${path}`;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, username: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
          // Without this the confirmation link uses `site_url`, which sends
          // everyone to production — including operators who signed up on a
          // preview deployment or on localhost.
          emailRedirectTo: redirectTo("/"),
        },
      });
      return error ? error.message : null;
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  /**
   * Sends the recovery email. The caller must show the same message whether or
   * not the address exists — see OperatorLogin — so this returns an error only
   * for failures that say nothing about the account, such as rate limiting.
   */
  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo("/reset-password"),
    });
    return error ? error.message : null;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? error.message : null;
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo("/") },
    });
    return error ? error.message : null;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        updatePassword,
        resendConfirmation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
