"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useElite } from "@/context/EliteContext";
import OperatorLogin from "@/components/OperatorLogin";
import TerminalBoot from "@/components/TerminalBoot";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";

export type TabId =
  | "dashboard"
  | "objectives"
  | "ghost"
  | "habits"
  | "logs"
  | "profile";

function getInitialBootState() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("elite-booted") === "true";
}

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { loading: dataLoading, loadError, retryLoad } = useElite();
  const [booted, setBooted] = useState(getInitialBootState);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  const handleBootComplete = useCallback(() => {
    sessionStorage.setItem("elite-booted", "true");
    setBooted(true);
  }, []);

  // Show nothing while auth is loading
  if (authLoading) {
    return (
      <main className="h-screen w-screen bg-bg flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-violet animate-pulse" />
      </main>
    );
  }

  // Not logged in — show Operator Login
  if (!user) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-bg">
        <OperatorLogin />
      </main>
    );
  }

  // Logged in, but the state load failed. Without this the operator would sit
  // on the sync screen indefinitely with no way out.
  if (loadError) {
    return (
      <main className="h-screen w-screen bg-bg flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            <span className="text-violet">Elite</span>
            <span className="text-text">OS</span>
          </h1>
          <p className="text-xs uppercase tracking-wider text-pink font-semibold mb-3">
            Sync failed
          </p>
          <p className="text-sm text-muted mb-6">{loadError}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={retryLoad}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-violet/15 text-violet hover:bg-violet/25 cursor-pointer transition-colors"
            >
              RETRY
            </button>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-card-border/40 text-muted hover:bg-card-border/60 cursor-pointer transition-colors"
            >
              SIGN OUT
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Logged in but data still loading from Supabase
  if (dataLoading) {
    return (
      <main className="h-screen w-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            <span className="text-violet">Elite</span>
            <span className="text-text">OS</span>
          </h1>
          <p className="text-xs text-muted animate-pulse">
            Syncing system state...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-bg">
      {!booted && <TerminalBoot onBootComplete={handleBootComplete} />}

      <AnimatePresence>
        {booted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="h-full flex flex-col md:flex-row"
          >
            <div className="hidden md:flex">
              <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <Header />
              <Dashboard activeTab={activeTab} />
            </div>

            <div className="md:hidden">
              <Sidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                mobile
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
