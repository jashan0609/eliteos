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

export type TabId = "dashboard" | "objectives" | "ghost" | "habits" | "logs";

function getInitialBootState() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("elite-booted") === "true";
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { loading: dataLoading } = useElite();
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
